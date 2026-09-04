// functions/src/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firebase Cloud Functions
//
// Deploy with:  cd functions && npm run deploy
// Or from root: firebase deploy --only functions
//
// Firebase Functions backend.
//   dailyComplianceCheck — runs every day at 11am Pacific, scans all carriers,
//      sends push notifications for items due in 30 days / 15 days / 5 days
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from "firebase-functions/v2";
import * as admin     from "firebase-admin";
import {
  onCall,
  onRequest,
  HttpsError,
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { recordReferralParticipation } from "./referralEligibility";
import {
  handleCheckoutCompleted,
  syncSubscriptionToCarrier,
} from "./stripeWebhookHandlers";
import {
  recordReferralRewardForPaidInvoice,
  reconcileReferralCharge,
  stringId,
} from "./referralLedgerRewards";


admin.initializeApp();
const db  = admin.firestore();
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeCompanyPriceId = defineSecret("STRIPE_COMPANY_PRICE_ID");
const stripeDriverPriceId = defineSecret("STRIPE_DRIVER_PRICE_ID");
const stripeWebhookSecret =
  defineSecret("STRIPE_WEBHOOK_SECRET");

function publicAppBaseUrl(): string {
  const projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.GCP_PROJECT ??
    admin.app().options.projectId;

  return projectId === "weheartpaperwork-staging"
    ? "https://weheartpaperwork-staging.web.app"
    : "https://weheartpaperwork.com";
}


// ── Helpers ───────────────────────────────────────────────────────────────────

type AlertType = "30_days" | "15_days" | "5_days" | "1_day";
type ReminderPolicy = "standard" | "five-day-only" | "one-day-only";

type ReminderState = {
  dueDate: string;
  notified30: boolean;
  notified15: boolean;
  notified5: boolean;
  notified1: boolean;
};

type ReminderUpdate = {
  ref: admin.firestore.DocumentReference;
  fieldPath: string;
  state: ReminderState;
  metadata?: Record<string, unknown>;
};

type ReminderCandidate = {
  itemId: string;
  label: string;
  days: number;
  dueDate: string;
  requirementId?: string;
  policy?: ReminderPolicy;
  legacyState?: unknown;
};

type DailyNotificationSummary = {
  carrierId: string;
  userId: string;
  expoPushToken: string;
  dueIn30DaysIds: string[];
  dueIn15DaysIds: string[];
  dueIn5DaysIds: string[];
  dueIn1DayIds: string[];
};

function customReminderPolicy(data: admin.firestore.DocumentData): ReminderPolicy {
  if (data.scheduleType !== "rolling") return "standard";
  if (
    data.recurrenceKind === "calendar-monthly" ||
    data.recurrenceKind === "calendar-quarterly"
  ) return "five-day-only";

  const value = typeof data.intervalValue === "number" ? data.intervalValue : 1;
  const approximateDays =
    data.intervalUnit === "day" ? value :
    data.intervalUnit === "week" ? value * 7 :
    data.intervalUnit === "month" ? value * 30 :
    data.intervalUnit === "year" ? value * 365 : 365;

  if (approximateDays <= 7) return "one-day-only";
  if (approximateDays < 365) return "five-day-only";
  return "standard";
}

function getAlertDecision(
  days: number,
  dueDate: string,
  savedState: unknown,
  requirementId?: string,
  policy: ReminderPolicy = "standard"
): { alertType: AlertType; state: ReminderState } | null {
  if (days < 0) return null;

  const data =
    savedState && typeof savedState === "object"
      ? savedState as Partial<ReminderState>
      : {};
  const sameOccurrence = data.dueDate === dueDate;
  const state: ReminderState = {
    dueDate,
    notified30: sameOccurrence && data.notified30 === true,
    notified15: sameOccurrence && data.notified15 === true,
    notified5: sameOccurrence && data.notified5 === true,
    notified1: sameOccurrence && data.notified1 === true,
  };

  // Short-cycle items are intentionally quieter: Portal maintenance and
  // quarterly IFTA each receive one push at five days remaining.
  if (requirementId === "fmcsa-portal" || requirementId === "ifta-quarterly") {
    if (days <= 5 && !state.notified5) {
      return {
        alertType: "5_days",
        state: { ...state, notified5: true },
      };
    }
    return null;
  }

  if (policy === "one-day-only") {
    if (days <= 1 && !state.notified1) {
      return { alertType: "1_day", state: { ...state, notified1: true } };
    }
    return null;
  }

  if (policy === "five-day-only") {
    if (days <= 5 && !state.notified5) {
      return { alertType: "5_days", state: { ...state, notified5: true } };
    }
    return null;
  }

  // Recover a missed scheduler day by sending the most urgent unsent
  // threshold, while marking broader thresholds complete so reminders
  // never run backward (for example, 5 days followed by 15 days).
  if (days <= 5 && !state.notified5) {
    return {
      alertType: "5_days",
      state: { ...state, notified30: true, notified15: true, notified5: true },
    };
  }
  if (days <= 15 && !state.notified15) {
    return {
      alertType: "15_days",
      state: { ...state, notified30: true, notified15: true },
    };
  }
  if (days <= 30 && !state.notified30) {
    return {
      alertType: "30_days",
      state: { ...state, notified30: true },
    };
  }

  return null;
}

async function saveReminderUpdates(updates: ReminderUpdate[]): Promise<void> {
  const byDocument = new Map<
    string,
    { ref: admin.firestore.DocumentReference; fields: Record<string, unknown> }
  >();

  for (const update of updates) {
    const current = byDocument.get(update.ref.path) ?? {
      ref: update.ref,
      fields: { ...(update.metadata || {}) },
    };
    current.fields[update.fieldPath] = update.state;
    byDocument.set(update.ref.path, current);
  }

  const entries = [...byDocument.values()];
  for (let index = 0; index < entries.length; index += 450) {
    const batch = db.batch();
    for (const entry of entries.slice(index, index + 450)) {
      batch.set(entry.ref, entry.fields, { merge: true });
    }
    await batch.commit();
  }
}

function reminderStateRef(
  carrierId: string,
  userId: string,
  itemId: string
): admin.firestore.DocumentReference {
  const safeItemId = Buffer.from(itemId, "utf8").toString("base64url");
  return db.collection("notificationReminderStates")
    .doc(`${userId}__${carrierId}__${safeItemId}`);
}

function getTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isExpoPushToken(
  token: unknown
): token is string {
  return (
    typeof token === "string" &&
    (
      (
        (
          token.startsWith(
            "ExponentPushToken["
          ) ||
          token.startsWith(
            "ExpoPushToken["
          )
        ) &&
        token.endsWith("]")
      ) ||
      /^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i.test(
        token
      )
    )
  );
}

function buildNotificationId(
  userId: string,
  todayKey: string
): string {
  return `${userId}_daily_summary_${todayKey}`;
}

async function claimNotification(
  notificationId: string,
  details: Record<string, unknown>
): Promise<boolean> {
  const ref = db.collection("notificationRuns").doc(notificationId);

  return db.runTransaction(async transaction => {
    const existing = await transaction.get(ref);

    if (existing.exists) {
      return false;
    }

    transaction.create(ref, {
      ...details,
      status: "claimed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return true;
  });
}

function daysUntil(dueDateStr: string): number {
  const timeZone = "America/Los_Angeles";

  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type: string): number =>
    Number(todayParts.find(part => part.type === type)?.value);

  const todayUtc = Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day")
  );

  const [dueYear, dueMonth, dueDay] = dueDateStr
    .split("-")
    .map(Number);

  const dueUtc = Date.UTC(
    dueYear,
    dueMonth - 1,
    dueDay
  );

  return Math.round((dueUtc - todayUtc) / 86400000);
}

const REQUIREMENT_LABELS: Record<string, string> = {
  mcs150: "MCS-150 / USDOT Biennial Update",
  tax2290: "2290 Heavy Vehicle Use Tax",
  "fmcsa-portal": "FMCSA Portal Account Maintenance",
  ucr: "UCR Registration",
  ifta: "IFTA License Renewal",
  "ifta-quarterly": "IFTA Quarterly Fuel Tax Return",
  irp: "IRP Registration Renewal",
  insurance: "Commercial Auto Insurance Renewal",
  drug: "Drug & Alcohol Consortium Enrollment",
  boc3: "BOC-3 Process Agent Filing",
};

const COMPANY_REQUIREMENT_IDS =
  new Set(Object.keys(REQUIREMENT_LABELS));

function calculatedMcs150DueDate(usdotNumber: unknown): string | null {
  if (typeof usdotNumber !== "string") return null;
  const raw = usdotNumber.replace(/\D/g, "");
  if (raw.length < 2) return null;
  const year = Number(getTodayKey().slice(0, 4));
  const filingYear = Number(raw[raw.length - 2]) % 2 === year % 2 ? year : year + 1;
  const lastDigit = Number(raw[raw.length - 1]);
  const month = lastDigit === 0 ? 10 : lastDigit;
  const lastDay = new Date(Date.UTC(filingYear, month, 0)).getUTCDate();
  return `${filingYear}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function nextIftaDueDate(referenceDate: string): string {
  const year = Number(referenceDate.slice(0, 4));
  return [
    `${year}-04-30`, `${year}-07-31`, `${year}-10-31`, `${year + 1}-01-31`,
  ].find(date => date >= referenceDate) || `${year + 1}-04-30`;
}

async function ensureBuiltInComplianceDocs(
  carrierDoc: admin.firestore.QueryDocumentSnapshot
): Promise<void> {
  const carrierId = carrierDoc.id;
  const today = getTodayKey();
  const year = Number(today.slice(0, 4));
  const defaults: Record<string, string | null> = {
    mcs150: calculatedMcs150DueDate(carrierDoc.data().usdotNumber),
    tax2290: `${year}-08-31`,
    "fmcsa-portal": null,
    ucr: `${year}-12-31`,
    ifta: `${year}-12-31`,
    "ifta-quarterly": nextIftaDueDate(today),
    irp: null,
    insurance: null,
    drug: null,
    boc3: null,
  };

  await Promise.all(Object.entries(defaults).map(async ([id, dueDate]) => {
    const ref = db.collection("carriers").doc(carrierId).collection("compliance").doc(id);
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists) return;
      transaction.set(ref, {
        enteredDate: null,
        dueDate,
        completed: false,
        completedAt: null,
        applicable: true,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }));
}

type DriverRequirementDefinition = {
  field: "cdlExpiration" | "medicalExpiration" | "mvrDue" | "clearinghouseDue";
  itemType: "cdl" | "medical" | "mvr" | "clearinghouse";
  label: string;
  yearsToAdd: number;
  daysToAdd?: number;
};

const DRIVER_REQUIREMENTS: DriverRequirementDefinition[] = [
  {
    field: "cdlExpiration",
    itemType: "cdl",
    label: "CDL expiration",
    yearsToAdd: 0,
  },
    {
    field: "medicalExpiration",
    itemType: "medical",
    label: "Medical card",
    yearsToAdd: 0,
  },
  {
    field: "mvrDue",
    itemType: "mvr",
    label: "Annual MVR",
    yearsToAdd: 1,
  },
  {
    field: "clearinghouseDue",
    itemType: "clearinghouse",
    label: "Clearinghouse annual query",
    yearsToAdd: 0,
    daysToAdd: 365,
  },
];



function addYearsToDate(
  dateStr: string,
  years: number
): string {
  const [year, month, day] =
    dateStr.split("-").map(Number);

  const targetYear = year + years;

  const lastDayOfTargetMonth =
    new Date(
      Date.UTC(
        targetYear,
        month,
        0
      )
    ).getUTCDate();

  const targetDay = Math.min(
    day,
    lastDayOfTargetMonth
  );

  return (
    `${targetYear}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(targetDay).padStart(2, "0")}`
  );
}

function iftaQuarterEndFromDueDate(dueDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month === 4) return `${year}-03-31`;
  if (month === 7) return `${year}-06-30`;
  if (month === 10) return `${year}-09-30`;
  if (month === 1) return `${year - 1}-12-31`;
  return null;
}

function addDaysToDate(dateStr: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match || !Number.isInteger(days)) return "";

  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ── 1. Daily compliance check (runs every day at 11am Pacific) ────────────────────

export const dailyComplianceCheck = functions.scheduler.onSchedule(
  {
    schedule: "0 11 * * *",
    timeZone: "America/Los_Angeles",
  },
  async () => {
  console.log("DAILY COMPLIANCE VERSION: DRIVER-SCAN-V1");
  console.log("DRIVER SCAN CODE IS ACTIVE"); 
    const todayKey = getTodayKey();
    const carriersSnap = await db.collection("carriers").get();

    for (const carrierDoc of carriersSnap.docs) {
      const carrierId = carrierDoc.id;

      const usersSnap = await db
        .collection("users")
        .where("carrierId", "==", carrierId)
        .where("notificationsEnabled", "==", true)
        .get();

      const users = usersSnap.docs
        .map(userDoc => ({
          userId: userDoc.id,
          expoPushToken: userDoc.data().expoPushToken as string | undefined,
        }))
        .filter(user =>
            isExpoPushToken(user.expoPushToken)
          ) as Array<{
          userId: string;
          expoPushToken: string;
        }>;
    console.log("Eligible notification users", {
      carrierId,
      count: users.length,
      users: users.map(user => user.userId),
    });

      if (users.length === 0) {
        continue;
      }

      await ensureBuiltInComplianceDocs(carrierDoc);

      const compSnap = await db
        .collection("carriers")
        .doc(carrierId)
        .collection("compliance")
        .get();

      const reminderCandidates: ReminderCandidate[] = [];

      for (const compDoc of compSnap.docs) {
        if (
          !COMPANY_REQUIREMENT_IDS.has(
            compDoc.id
          )
        ) {
          continue;
        }

        const data = compDoc.data();

        if (
          data.applicable === false ||
          data.completed === true ||
          !data.dueDate
        ) {
          continue;
        }

        const dueDate = String(data.dueDate);
        const reminderDate = compDoc.id === "ifta-quarterly"
          ? iftaQuarterEndFromDueDate(dueDate) || dueDate
          : dueDate;
        const days = daysUntil(reminderDate);
            console.log("Compliance item checked", {
      carrierId,
      itemId: compDoc.id,
      dueDate: data.dueDate,
      completed: data.completed,
      daysUntilDue: days,
    });
        reminderCandidates.push({
          itemId: compDoc.id,
          label: compDoc.id === "ifta-quarterly"
            ? "IFTA reporting quarter ends"
            : REQUIREMENT_LABELS[compDoc.id] || compDoc.id,
          days,
          dueDate,
          requirementId: compDoc.id,
          legacyState: data.reminderState,
        });
      }

      const customRequirementsSnap = await db
        .collection("carriers")
        .doc(carrierId)
        .collection("customRequirements")
        .get();

      for (const customDoc of customRequirementsSnap.docs) {
        const data = customDoc.data();
        if (data.active === false || data.completed === true || !data.dueDate) {
          continue;
        }
        const dueDate = String(data.dueDate);
        const days = daysUntil(dueDate);
        reminderCandidates.push({
          itemId: `custom:${customDoc.id}`,
          label:
            typeof data.name === "string" && data.name.trim()
              ? data.name.trim()
              : "Custom company requirement",
          days,
          dueDate,
          policy: customReminderPolicy(data),
          legacyState: data.reminderState,
        });
      }
const driversSnap = await db
  .collection("carriers")
  .doc(carrierId)
  .collection("drivers")
  .get();
console.log("Drivers collection loaded", {
  carrierId,
  driverCount: driversSnap.size,
});

for (const driverDoc of driversSnap.docs) {
  const driverData = driverDoc.data();

  if (driverData.status === "inactive") {
    continue;
  }
  const driverName =
    typeof driverData.name === "string" && driverData.name.trim()
      ? driverData.name.trim()
      : "Driver";

  for (const requirement of DRIVER_REQUIREMENTS) {
    const storedDate = driverData[requirement.field];

    if (typeof storedDate !== "string" || !storedDate.trim()) {
      continue;
    }

    const dueDate = requirement.daysToAdd
      ? addDaysToDate(storedDate, requirement.daysToAdd)
      : requirement.yearsToAdd > 0
        ? addYearsToDate(storedDate, requirement.yearsToAdd)
        : storedDate;

    const days = daysUntil(dueDate);
    console.log("Driver requirement checked", {
      carrierId,
      driverId: driverDoc.id,
      driverName,
      requirement: requirement.itemType,
      storedDate,
      dueDate,
      daysUntilDue: days,
    });

    reminderCandidates.push({
      itemId: `driver:${driverDoc.id}:${requirement.itemType}`,
      label: `${driverName} — ${requirement.label}`,
      days,
      dueDate,
      legacyState: driverData.reminderStates?.[requirement.itemType],
    });
  }
}

const vehiclesSnap = await db
  .collection("carriers")
  .doc(carrierId)
  .collection("vehicles")
  .get();

for (const vehicleDoc of vehiclesSnap.docs) {
  const vehicleData = vehicleDoc.data();

  if (vehicleData.status === "inactive") {
    continue;
  }

  const unitNumber =
    typeof vehicleData.unitNumber === "string" &&
    vehicleData.unitNumber.trim()
      ? vehicleData.unitNumber.trim()
      : "Vehicle";

  const vehicleType =
    vehicleData.type === "trailer"
      ? "Trailer"
      : "Truck";

  const deadlines = [
    {
      field: "registrationExpiration",
      itemType: "registration",
      label: "Registration",
    },
    {
      field: "inspectionExpiration",
      itemType: "inspection",
      label: "Annual DOT inspection",
    },
  ];

  for (const deadline of deadlines) {
    if (
      deadline.field === "registrationExpiration" &&
      vehicleData.type === "trailer" &&
      vehicleData.registrationPermanent === true
    ) {
      continue;
    }

    const dueDate = vehicleData[deadline.field];

    if (typeof dueDate !== "string" || !dueDate.trim()) {
      continue;
    }

    const days = daysUntil(dueDate);
    reminderCandidates.push({
      itemId: `vehicle:${vehicleDoc.id}:${deadline.itemType}`,
      label: `${vehicleType} ${unitNumber} — ${deadline.label}`,
      days,
      dueDate,
      legacyState: vehicleData.reminderStates?.[deadline.itemType],
    });
  }
}
        for (const user of users) {
          const groupedItems: Record<
            AlertType,
            Array<{ itemId: string; label: string }>
          > = {
            "30_days": [],
            "15_days": [],
            "5_days": [],
            "1_day": [],
          };
          const stateRefs = reminderCandidates.map(candidate =>
            reminderStateRef(carrierId, user.userId, candidate.itemId)
          );
          const stateSnapshots = stateRefs.length > 0
            ? await db.getAll(...stateRefs)
            : [];
          const reminderUpdates: ReminderUpdate[] = [];

          reminderCandidates.forEach((candidate, index) => {
            const decision = getAlertDecision(
              candidate.days,
              candidate.dueDate,
              stateSnapshots[index]?.exists
                ? stateSnapshots[index].data()?.state
                : candidate.legacyState,
              candidate.requirementId,
              candidate.policy
            );
            if (!decision) return;
            groupedItems[decision.alertType].push({
              itemId: candidate.itemId,
              label: candidate.label,
            });
            reminderUpdates.push({
              ref: stateRefs[index],
              fieldPath: "state",
              state: decision.state,
              metadata: {
                carrierId,
                userId: user.userId,
                itemId: candidate.itemId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            });
          });

          const dueIn30DaysItems = groupedItems["30_days"];
          const dueIn15DaysItems = groupedItems["15_days"];
          const dueIn5DaysItems = groupedItems["5_days"];
          const dueIn1DayItems = groupedItems["1_day"];
          const allItems = [
            ...dueIn5DaysItems,
            ...dueIn1DayItems,
            ...dueIn15DaysItems,
            ...dueIn30DaysItems,
          ];

          if (allItems.length === 0) continue;

          const notificationId = buildNotificationId(
            user.userId,
            todayKey
          );

          const claimed = await claimNotification(notificationId, {
            userId: user.userId,
            carrierId,
            alertType: "daily_summary",
            notificationDate: todayKey,
            totalItems: allItems.length,
            dueIn5DaysCount: dueIn5DaysItems.length,
            dueIn1DayCount: dueIn1DayItems.length,
            dueIn15DaysCount: dueIn15DaysItems.length,
            dueIn30DaysCount: dueIn30DaysItems.length,
            itemIds: allItems.map(item => item.itemId),
          });

          if (!claimed) {
            console.log(`Duplicate notification skipped: ${notificationId}`);
            continue;
          }

          try {
            const ticket = await sendDailySummaryNotification({
              carrierId,
              userId: user.userId,
              expoPushToken: user.expoPushToken,
              dueIn30DaysIds: dueIn30DaysItems.map(item => item.itemId),
              dueIn15DaysIds: dueIn15DaysItems.map(item => item.itemId),
              dueIn5DaysIds: dueIn5DaysItems.map(item => item.itemId),
              dueIn1DayIds: dueIn1DayItems.map(item => item.itemId),
            });

            await db.collection("notificationRuns").doc(notificationId).update({
              status: ticket.status === "ok" ? "sent" : "failed",
              expoTicketId: ticket.id || null,
              errorMessage: ticket.message || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            if (ticket.status === "ok") {
              await saveReminderUpdates(reminderUpdates);
            }
          } catch (error) {
            await db.collection("notificationRuns").doc(notificationId).update({
              status: "failed",
              errorMessage:
                error instanceof Error ? error.message : String(error),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.error("Daily summary notification failed:", error);
          }
        }
      }
       console.log("Daily compliance check complete");
    } 
  );

  

async function sendDailySummaryNotification(
  summary: DailyNotificationSummary
): Promise<{
  status: string;
  id?: string;
  message?: string;
}> {
  const dueIn5DaysCount = summary.dueIn5DaysIds.length;
  const dueIn1DayCount = summary.dueIn1DayIds.length;
  const dueIn15DaysCount = summary.dueIn15DaysIds.length;
  const dueIn30DaysCount = summary.dueIn30DaysIds.length;

  const totalItems =
    dueIn5DaysCount +
    dueIn1DayCount +
    dueIn15DaysCount +
    dueIn30DaysCount;

  const title =
    totalItems === 1
      ? "1 compliance item requires attention"
      : `${totalItems} compliance deadlines are approaching`;

  const bodyParts: string[] = [];

  if (dueIn1DayCount > 0) {
    bodyParts.push(`${dueIn1DayCount} need attention within 1 day`);
  }

  if (dueIn5DaysCount > 0) {
    bodyParts.push(`${dueIn5DaysCount} need attention within 5 days`);
  }

  if (dueIn15DaysCount  > 0) {
    bodyParts.push(`${dueIn15DaysCount} need attention within 15 days`);
  }

  if (dueIn30DaysCount > 0) {
    bodyParts.push(`${dueIn30DaysCount} need attention within 30 days`);
  }

  const body = `${bodyParts.join(" • ")}. Tap to review.`;

  const allItemIds = [
    ...summary.dueIn1DayIds,
    ...summary.dueIn5DaysIds,
    ...summary.dueIn15DaysIds,
    ...summary.dueIn30DaysIds,
  ];

  const maxAttempts = 3;

for (
  let attempt = 1;
  attempt <= maxAttempts;
  attempt++
) {
  let response: Response;

  try {
    response = await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: summary.expoPushToken,
          title,
          body,
          sound: "default",
          priority: "high",
          data: {
            screen: "dashboard",
            alertType: "daily_summary",
            carrierId: summary.carrierId,
            itemIds: allItemIds,
            dueIn5DaysIds:
              summary.dueIn5DaysIds,
            dueIn1DayIds:
              summary.dueIn1DayIds,
            dueIn15DaysIds:
              summary.dueIn15DaysIds,
            dueIn30DaysIds:
              summary.dueIn30DaysIds,
          },
        }),
      }
    );
  } catch (error) {
    if (attempt === maxAttempts) {
      throw error;
    }

    await new Promise(resolve =>
      setTimeout(
        resolve,
        1000 * Math.pow(2, attempt - 1)
      )
    );

    continue;
  }

  if (response.ok) {
    const result = (await response.json()) as {
      data: {
        status: string;
        id?: string;
        message?: string;
      };
    };

    return result.data;
  }

  const errorText = await response.text();

  const retryable =
    response.status === 429 ||
    response.status >= 500;

  if (!retryable || attempt === maxAttempts) {
    throw new Error(
      `Expo push request failed: ${response.status} ${errorText}`
    );
  }

  await new Promise(resolve =>
    setTimeout(
      resolve,
      1000 * Math.pow(2, attempt - 1)
    )
  );
}

throw new Error(
  "Expo push request failed after retries."
);
}

export const deleteAccount = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to delete your account."
      );
    }

    const userId = request.auth.uid;

    console.log("Account deletion started", {
      userId,
    });

    const userRef =
      db.collection("users").doc(userId);

    const userSnapshot =
      await userRef.get();

    const userData =
      userSnapshot.data();

    if (
      userSnapshot.exists &&
      typeof userData?.role === "string" &&
      userData.role !== "owner"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Only the account owner can delete this company account."
      );
    }

    const savedCarrierId =
  userData?.carrierId;

if (
  typeof savedCarrierId === "string" &&
  savedCarrierId !== userId
) {
  throw new HttpsError(
    "permission-denied",
    "Your company account link is invalid."
  );
}

const carrierId = userId;

    const carrierRef =
      db.collection("carriers").doc(carrierId);

    const carrierSnapshot =
      await carrierRef.get();
    const accountDeletionStartedAt = admin.firestore.Timestamp.now();

    if (carrierSnapshot.exists) {
  await carrierRef.update({
    deletingAccount: true,
    deletingAccountStartedAt:
      accountDeletionStartedAt,
  });
}

    const stripeCustomerId =
      carrierSnapshot.exists &&
      typeof carrierSnapshot.data()?.billing
        ?.stripeCustomerId === "string"
        ? carrierSnapshot.data()?.billing
            ?.stripeCustomerId
        : null;

    // Remove Stripe billing first so the customer cannot
    // continue being charged if a later cleanup step fails.
    if (stripeCustomerId) {
      const stripe = new Stripe(
        stripeSecretKey.value()
      );

      try {
        await stripe.customers.del(
          stripeCustomerId
        );

        console.log(
          "Stripe customer deleted during account deletion",
          {
            userId,
            carrierId,
            stripeCustomerId,
          }
        );
      } catch (error: any) {
        const isMissingCustomer =
          error?.code === "resource_missing" ||
          error?.statusCode === 404;

        if (!isMissingCustomer) {
          console.error(
            "Stripe customer deletion failed",
            {
              userId,
              carrierId,
              stripeCustomerId,
              error,
            }
          );

          if (carrierSnapshot.exists) {
            try {
              await carrierRef.update({
                deletingAccount: false,
                deletingAccountStartedAt:
                  admin.firestore.FieldValue.delete(),
              });
            } catch (resetError) {
              console.error(
                "Unable to reset account deletion flag",
                {
                  userId,
                  carrierId,
                  resetError,
                }
              );
            }
          }
          throw new HttpsError(
            "internal",
            "Billing could not be removed. Please try deleting your account again."
          );
        }

        console.log(
          "Stripe customer was already deleted",
          {
            userId,
            carrierId,
            stripeCustomerId,
          }
        );
      }
    }

    // Remove notification delivery/history records belonging
    // to either this user or this carrier.
    const [
      notificationRunsByUser,
      notificationRunsByCarrier,
    ] = await Promise.all([
      db
        .collection("notificationRuns")
        .where("userId", "==", userId)
        .get(),

      db
        .collection("notificationRuns")
        .where("carrierId", "==", carrierId)
        .get(),
    ]);

    const notificationRefs =
      new Map<
        string,
        FirebaseFirestore.DocumentReference
      >();

    notificationRunsByUser.docs.forEach(
      (document) => {
        notificationRefs.set(
          document.ref.path,
          document.ref
        );
      }
    );

    notificationRunsByCarrier.docs.forEach(
      (document) => {
        notificationRefs.set(
          document.ref.path,
          document.ref
        );
      }
    );

    if (notificationRefs.size > 0) {
      const writer = db.bulkWriter();

      for (const ref of notificationRefs.values()) {
        writer.delete(ref);
      }

      await writer.close();
    }

    const [reminderStatesByUser, reminderStatesByCarrier] = await Promise.all([
      db.collection("notificationReminderStates").where("userId", "==", userId).get(),
      db.collection("notificationReminderStates").where("carrierId", "==", carrierId).get(),
    ]);
    const reminderStateRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    reminderStatesByUser.docs.forEach(document =>
      reminderStateRefs.set(document.ref.path, document.ref)
    );
    reminderStatesByCarrier.docs.forEach(document =>
      reminderStateRefs.set(document.ref.path, document.ref)
    );
    if (reminderStateRefs.size > 0) {
      const writer = db.bulkWriter();
      for (const ref of reminderStateRefs.values()) writer.delete(ref);
      await writer.close();
    }

    // Referral codes and financial attribution are never recycled.
    // Deactivate the code while preserving its ownership and audit history.
    const referralCodeOwnerRef =
      db
        .collection("carrierReferralCodes")
        .doc(carrierId);

    const ownedReferralCodesSnapshot =
      await db
        .collection("referralCodes")
        .where("carrierId", "==", carrierId)
        .get();

    const referralWriter = db.bulkWriter();
    referralWriter.set(db.collection("referralAccountClosures").doc(carrierId), {
      carrierId, closedAt: accountDeletionStartedAt,
    }, { merge: true });

    // Preserve code tombstones and financial identities, remove the user-owned
    // code lookup. A late refund can still resolve the deleted company.
    referralWriter.delete(referralCodeOwnerRef);
    if (stripeCustomerId) referralWriter.set(
      db.collection("referralBillingIdentities").doc(stripeCustomerId),
      { carrierId, deletedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    for (
      const referralCodeDocument of
      ownedReferralCodesSnapshot.docs
    ) {
      referralWriter.set(
        referralCodeDocument.ref,
        {
          active: false,
          deactivatedReason: "account_deleted",
          deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await referralWriter.close();

    console.log(
      "Referral code records deactivated during account deletion",
      {
        carrierId,
        referralCodeCount:
          ownedReferralCodesSnapshot.size,
      }
    );
    // Delete the carrier document and every descendant:
    // drivers, compliance, complianceRecords, history, etc.
    await db.recursiveDelete(carrierRef);

    // Delete the user's standalone Firestore document.
    await userRef.delete();

    // Authentication is intentionally deleted last.
    try {
      await admin.auth().deleteUser(userId);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") {
        throw error;
      }
    }

    console.log("Account deletion complete", {
      userId,
      carrierId,
    });

    return {
      success: true,
    };
  }
);

export const createBillingPortalSession = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "You must be signed in to manage billing."
        );
      }

      const userId = request.auth.uid;

      console.log(
        "Billing portal step 1: authenticated",
        {
          userId,
        }
      );

      const userSnapshot = await db
        .collection("users")
        .doc(userId)
        .get();

      console.log(
        "Billing portal step 2: user read",
        {
          userId,
          exists: userSnapshot.exists,
        }
      );

      if (!userSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Your user account could not be found."
        );
      }

      const savedCarrierId =
        userSnapshot.data()?.carrierId;

      if (
        typeof savedCarrierId !== "string" ||
        savedCarrierId !== userId
      ) {
        throw new HttpsError(
          "permission-denied",
          "Your company account link is invalid."
        );
      }

      const carrierId = userId;

      console.log(
        "Billing portal step 3: carrier resolved",
        {
          userId,
          carrierId,
        }
      );

      const carrierSnapshot = await db
        .collection("carriers")
        .doc(carrierId)
        .get();

      console.log(
        "Billing portal step 4: carrier read",
        {
          carrierId,
          exists: carrierSnapshot.exists,
        }
      );

      if (!carrierSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Your company account could not be found."
        );
      }

      if (
        carrierSnapshot.data()?.deletingAccount === true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Account deletion is already in progress."
        );
      }

      const stripeCustomerId =
        carrierSnapshot.data()?.billing
          ?.stripeCustomerId;

      if (
        !stripeCustomerId ||
        typeof stripeCustomerId !== "string"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Billing setup has not been completed for this account."
        );
      }

      console.log(
        "Billing portal step 5: Stripe customer resolved",
        {
          carrierId,
          stripeCustomerId,
        }
      );

      const stripe = new Stripe(
        stripeSecretKey.value()
      );

      const customer =
        await stripe.customers.retrieve(
          stripeCustomerId
        );

      if (customer.deleted) {
        throw new HttpsError(
          "failed-precondition",
          "Your previous billing profile is no longer available. Please restart your subscription."
        );
      }

      console.log(
        "Billing portal step 6: Stripe customer confirmed",
        {
          carrierId,
          stripeCustomerId,
        }
      );

      const portalSession =
        await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${publicAppBaseUrl()}/settings`,
        });

      console.log(
        "Billing portal step 7: portal session created",
        {
          carrierId,
          stripeCustomerId,
          portalSessionId:
            portalSession.id,
          hasUrl: Boolean(
            portalSession.url
          ),
        }
      );

      return {
        url: portalSession.url,
      };
    } catch (error) {
      console.error(
        "createBillingPortalSession failed",
        {
          error,
          message:
            error instanceof Error
              ? error.message
              : String(error),
        }
      );

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "unavailable",
        "Billing management is temporarily unavailable. Please try again."
      );
    }
  }
);
export const createCheckoutSession = onCall(
  {
    region: "us-central1",
    secrets: [
      stripeSecretKey,
      stripeCompanyPriceId,
      stripeDriverPriceId,
    ],
  },
  async (request) => {
    try {
      // STEP 1: Confirm the user is signed in.
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "You must be signed in to start a subscription."
        );
      }

      const userId = request.auth.uid;

      console.log("Checkout step 1: authenticated", {
        userId,
      });

      // STEP 2: Read the Firebase user document.
      const userSnapshot = await db
        .collection("users")
        .doc(userId)
        .get();

      console.log("Checkout step 2: user read", {
        exists: userSnapshot.exists,
      });

      if (!userSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Your user account could not be found."
        );
      }

        const userData = userSnapshot.data();
        const savedCarrierId = userData?.carrierId;

        console.log("Checkout step 3: carrier ID found", {
          carrierId: savedCarrierId,
        });

        if (
          typeof savedCarrierId !== "string" ||
          savedCarrierId !== userId
        ) {
          throw new HttpsError(
            "permission-denied",
            "Your company account link is invalid."
          );
        }

        const carrierId = userId;

      // STEP 4: Read the carrier document.
      const carrierRef = db
        .collection("carriers")
        .doc(carrierId);

      const carrierSnapshot = await carrierRef.get();

      console.log("Checkout step 4: carrier read", {
        exists: carrierSnapshot.exists,
      });

      if (!carrierSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Your company account could not be found."
        );
      }
      if (
        carrierSnapshot.data()?.deletingAccount === true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Account deletion is already in progress."
        );
      }

      const carrierData = carrierSnapshot.data();

const existingBilling =
  carrierData?.billing ?? {};

const existingCustomerId =
  existingBilling.stripeCustomerId;

/**
 * hasUsedTrial is the permanent source of truth going forward.
 *
 * trialEndsAt provides backward compatibility for customers
 * who completed a trial before hasUsedTrial was introduced.
 */
const hasUsedTrial =
  existingBilling.hasUsedTrial === true ||
  existingBilling.trialEndsAt != null;

console.log(
  "Checkout trial eligibility resolved",
  {
    carrierId,
    hasUsedTrial,
    hasPermanentTrialFlag:
      existingBilling.hasUsedTrial === true,
    hasPreviousTrialEnd:
      existingBilling.trialEndsAt != null,
  }
);

      // STEP 5: Count active drivers.
      console.log(
        "Checkout step 5: counting active drivers"
      );

      const driversSnapshot = await carrierRef
        .collection("drivers")
        .get();

      const activeDriverCount =
        driversSnapshot.docs.filter(
          (driverDoc) =>
            driverDoc.data().status !== "inactive"
        ).length;

      console.log(
        "Checkout step 6: active drivers counted",
        {
          count: activeDriverCount,
        }
      );

      // STEP 7: Create the Stripe client.
      const stripe = new Stripe(
        stripeSecretKey.value()
      );

      console.log(
        "Checkout step 7: Stripe client created",
        {
          hasSecret: Boolean(
            stripeSecretKey.value()
          ),
          companyPriceId:
            stripeCompanyPriceId.value(),
          driverPriceId:
            stripeDriverPriceId.value(),
        }
      );

      // STEP 8: Determine whether to reuse or create
      // the Stripe customer.
      console.log(
        "Checkout step 8: resolving Stripe customer",
        {
          existingCustomerId:
            existingCustomerId ?? null,
        }
      );

            let stripeCustomerId: string | null = null;

      if (
        existingCustomerId &&
        typeof existingCustomerId === "string"
      ) {
        try {
          const existingCustomer =
            await stripe.customers.retrieve(
              existingCustomerId
            );

          if (!existingCustomer.deleted) {
            stripeCustomerId = existingCustomer.id;

            console.log(
              "Existing Stripe customer confirmed",
              {
                carrierId,
                stripeCustomerId,
              }
            );
          } else {
            console.warn(
              "Saved Stripe customer was deleted",
              {
                carrierId,
                existingCustomerId,
              }
            );
          }
        } catch (error: any) {
          const isMissingCustomer =
            error?.code === "resource_missing" ||
            error?.statusCode === 404;

          if (!isMissingCustomer) {
            throw error;
          }

          console.warn(
            "Saved Stripe customer does not exist",
            {
              carrierId,
              existingCustomerId,
            }
          );
        }
      }

      if (!stripeCustomerId) {
        console.log(
          "Creating replacement Stripe customer",
          {
            carrierId,
            previousCustomerId:
              existingCustomerId ?? null,
          }
        );

        const customer =
          await stripe.customers.create({
            email:
              typeof userData?.email === "string"
                ? userData.email
                : typeof request.auth.token.email ===
                    "string"
                  ? request.auth.token.email
                  : undefined,

            metadata: {
              carrierId,
              firebaseUserId: userId,
            },
          });

        stripeCustomerId = customer.id;

        await carrierRef.set(
          {
            billing: {
              stripeCustomerId,
              stripeSubscriptionId: null,
              status: null,
              trialEndsAt: null,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              cancelAt: null,
              canceledAt: null,
              activeDriverCountAtBilling: 0,
              monthlyAmountCents: 0,
              updatedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );

        console.log(
          "Replacement Stripe customer saved",
          {
            carrierId,
            stripeCustomerId,
          }
        );
      }
        
      // STEP 9 belongs outside the if/else because it
      // should run whether the customer was reused or created.
      console.log(
        "Checkout step 9: Stripe customer ready",
        {
          stripeCustomerId,
        }
      );

      // Create the invoice line items.
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        [
          {
            price:
              stripeCompanyPriceId.value(),
            quantity: 1,
          },
        ];

      if (activeDriverCount > 0) {
        lineItems.push({
          price: stripeDriverPriceId.value(),
          quantity: activeDriverCount,
        });
      }

      // STEP 10: Ask Stripe to create Checkout.
      console.log(
        "Checkout step 10: creating Checkout Session",
        {
          stripeCustomerId,
          activeDriverCount,
          lineItemCount: lineItems.length,
        }
      );
      const subscriptionData:
        Stripe.Checkout.SessionCreateParams.SubscriptionData =
        {
          metadata: {
            carrierId,
            firebaseUserId: userId,
            activeDriverCountAtCheckout:
              String(activeDriverCount),
          },
        };

      if (!hasUsedTrial) {
        subscriptionData.trial_period_days = 14;
      }

      console.log(
        "Checkout subscription terms resolved",
        {
          carrierId,
          hasUsedTrial,
          includesTrial: !hasUsedTrial,
          trialDays: hasUsedTrial ? 0 : 14,
        }
      );

const checkoutBaseUrl = publicAppBaseUrl();

console.log("Checkout return origin resolved", {
  firebaseProjectId:
    process.env.GCLOUD_PROJECT ??
    process.env.GCP_PROJECT ??
    admin.app().options.projectId ?? null,
  checkoutBaseUrl,
});

      const checkoutSession =
        await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: stripeCustomerId,

          line_items: lineItems,

          payment_method_collection: "always",

          subscription_data: subscriptionData,

          metadata: {
            carrierId,
            firebaseUserId: userId,
            activeDriverCountAtCheckout:
              String(activeDriverCount),
          },

          success_url:
          `${checkoutBaseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${checkoutBaseUrl}/subscription-required?checkout=cancelled`,
          });

      // STEP 11 belongs immediately after the Stripe
      // sessions.create call.
      console.log(
        "Checkout step 11: Checkout Session created",
        {
          sessionId: checkoutSession.id,
          hasUrl: Boolean(checkoutSession.url),
        }
      );

      if (!checkoutSession.url) {
        throw new HttpsError(
          "internal",
          "Stripe did not return a Checkout URL."
        );
      }

      return {
        url: checkoutSession.url,
        activeDriverCount,
        estimatedMonthlyAmountCents:
          200 + activeDriverCount * 100,
      };
    } catch (error) {
      // This catches any Firestore, Stripe, secret,
      // price, or customer error.
      console.error(
        "createCheckoutSession failed:",
        error
      );

      // Preserve the useful messages from errors we
      // intentionally created above.
      if (error instanceof HttpsError) {
        throw error;
      }

      // Convert all other errors into a callable error
      // that the app can display.
      throw new HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "Checkout could not be created."
      );
    }
  }
);
export const syncDriverBilling = onDocumentWritten(
  {
    document: "carriers/{carrierId}/drivers/{driverId}",
    region: "us-central1",
    secrets: [
      stripeSecretKey,
      stripeDriverPriceId,
    ],
  },
  async (event) => {
    const carrierId = event.params.carrierId;
    const driverId = event.params.driverId;

    const beforeExists =
  event.data?.before.exists === true;

const afterExists =
  event.data?.after.exists === true;

const beforeData = beforeExists
  ? event.data?.before.data()
  : undefined;

const afterData = afterExists
  ? event.data?.after.data()
  : undefined;

const wasActive =
  beforeExists &&
  beforeData?.status !== "inactive";

const isActive =
  afterExists &&
  afterData?.status !== "inactive";

    console.log("Driver billing event received", {
      carrierId,
      driverId,
      wasActive,
      isActive,
    });

    // Ignore edits that do not change whether the driver is billable.
    // Examples: CDL date, MVR date, driver name, license number.
    if (wasActive === isActive) {
      console.log(
        "Driver billing sync skipped because active status did not change",
        {
          carrierId,
          driverId,
        }
      );

      return;
    }

    const carrierRef = db
      .collection("carriers")
      .doc(carrierId);

    const carrierSnapshot =
      await carrierRef.get();

    if (!carrierSnapshot.exists) {
  console.error("Carrier not found during driver billing sync", {
    carrierId,
  });

  return;
}

const carrierData =
  carrierSnapshot.data();

if (carrierData?.deletingAccount === true) {
  console.log(
    "Driver billing sync skipped because account is being deleted",
    {
      carrierId,
      driverId,
    }
  );

  return;
}

const billing =
  carrierData?.billing;

    const stripeSubscriptionId =
      billing?.stripeSubscriptionId;

    if (
      !stripeSubscriptionId ||
      typeof stripeSubscriptionId !== "string"
    ) {
      console.log(
        "Driver billing sync skipped because carrier has no Stripe subscription",
        {
          carrierId,
        }
      );

      return;
    }

    // Count all current active drivers.
    // Missing status is treated as active for compatibility
    // with older driver records.
    const driversSnapshot = await carrierRef
      .collection("drivers")
      .get();

    const activeDriverCount =
      driversSnapshot.docs.filter(
        (driverDocument) =>
          driverDocument.data().status !== "inactive"
      ).length;

    const stripe = new Stripe(
      stripeSecretKey.value()
    );

    let subscription =
      await stripe.subscriptions.retrieve(
        stripeSubscriptionId
      );

    const driverPriceId =
      stripeDriverPriceId.value();

    const existingDriverItem =
      subscription.items.data.find(
        (item) =>
          item.price.id === driverPriceId
      );

    console.log("Updating Stripe driver quantity", {
      carrierId,
      stripeSubscriptionId,
      activeDriverCount,
      existingDriverItemId:
        existingDriverItem?.id ?? null,
    });

    if (activeDriverCount > 0) {
      if (existingDriverItem) {
        await stripe.subscriptionItems.update(
          existingDriverItem.id,
          {
            quantity: activeDriverCount,
            proration_behavior:
              "create_prorations",
          }
        );
      } else {
        await stripe.subscriptionItems.create({
          subscription:
            stripeSubscriptionId,
          price: driverPriceId,
          quantity: activeDriverCount,
          proration_behavior:
            "create_prorations",
        });
      }
    } else if (existingDriverItem) {
      await stripe.subscriptionItems.del(
        existingDriverItem.id,
        {
          proration_behavior:
            "create_prorations",
        }
      );
    }

    // Retrieve the newest Stripe state so Firestore reflects
    // the actual updated subscription amount and items.
    subscription =
      await stripe.subscriptions.retrieve(
        stripeSubscriptionId
      );

        await syncSubscriptionToCarrier(
      db,
      subscription,
      carrierId,
      activeDriverCount
    );

    console.log("Driver billing sync complete", {
      carrierId,
      stripeSubscriptionId,
      activeDriverCount,
      monthlyAmountCents:
        subscription.items.data.reduce(
          (total, item) =>
            total +
            (item.price.unit_amount ?? 0) *
              (item.quantity ?? 1),
          0
        ),
    });
  }
);
export const stripeWebhook = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    secrets: [
      stripeSecretKey,
      stripeWebhookSecret,
      stripeCompanyPriceId,
      stripeDriverPriceId,
    ],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method not allowed");
      return;
    }

    const signature =
      request.headers["stripe-signature"];

    if (typeof signature !== "string") {
      console.error(
        "Stripe webhook request is missing its signature."
      );

      response
        .status(400)
        .send("Missing Stripe signature");

      return;
    }

    const stripe = new Stripe(
      stripeSecretKey.value()
    );

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        stripeWebhookSecret.value()
      );
    } catch (error) {
      console.error(
        "Stripe webhook signature verification failed:",
        error
      );

      response
        .status(400)
        .send("Invalid Stripe signature");

      return;
    }

    console.log("Stripe webhook received", {
      eventId: event.id,
      eventType: event.type,
    });
    const webhookEventRef = db
  .collection("stripeWebhookEvents")
  .doc(event.id);
    const processingToken = randomUUID();
    
    const eventClaimed = await db.runTransaction(
  async (transaction) => {
    const existingEvent =
      await transaction.get(webhookEventRef);

    if (existingEvent.exists) {
      const existing = existingEvent.data();
      if (existing?.status === "processed") {
        return "processed";
      }

      const startedAt = existing?.processingStartedAt as
        | admin.firestore.Timestamp
        | undefined;
      const leaseIsCurrent = startedAt &&
        Date.now() - startedAt.toMillis() < 15 * 60 * 1000;
      if (leaseIsCurrent) {
        return "busy";
      }
    }

    transaction.set(webhookEventRef, {
      eventId: event.id,
      eventType: event.type,
      stripeCreatedAt:
        admin.firestore.Timestamp.fromMillis(
          event.created * 1000
        ),
      livemode: event.livemode,
      status: "processing",
      processingToken,
      processingStartedAt:
        admin.firestore.FieldValue.serverTimestamp(),
      processingAttempts:
        admin.firestore.FieldValue.increment(1),
    }, { merge: true });

    return "claimed";
  }
);

if (eventClaimed !== "claimed") {
  console.log(
    "Duplicate Stripe webhook ignored",
    {
      eventId: event.id,
      eventType: event.type,
    }
  );

  response.status(eventClaimed === "busy" ? 503 : 200).json({
    received: true,
    duplicate: true,
  });

  return;
}

    try {
      await recordReferralParticipation(db, event);
      switch (event.type) {
      case "checkout.session.completed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        await handleCheckoutCompleted(
          db,
          stripe,
          session
        );

        break;
      }

        case "customer.subscription.created": {
        const eventSubscription =
          event.data.object as Stripe.Subscription;

        console.log(
          "Processing customer.subscription.created",
          {
            stripeSubscriptionId:
              eventSubscription.id,
            eventStatus:
              eventSubscription.status,
          }
        );

        const latestSubscription =
          await stripe.subscriptions.retrieve(
            eventSubscription.id
          );

        console.log(
          "Latest created subscription retrieved",
          {
            stripeSubscriptionId:
              latestSubscription.id,
            latestStatus:
              latestSubscription.status,
          }
        );

        await syncSubscriptionToCarrier(
            db,
            latestSubscription
          );

        break;
      }

          case "customer.subscription.updated": {
      const eventSubscription =
        event.data.object as Stripe.Subscription;

      console.log(
        "Processing customer.subscription.updated",
        {
          stripeSubscriptionId:
            eventSubscription.id,
          eventStatus:
            eventSubscription.status,
        }
      );

      const latestSubscription =
        await stripe.subscriptions.retrieve(
          eventSubscription.id
        );

      console.log(
        "Latest Stripe subscription retrieved",
        {
          stripeSubscriptionId:
            latestSubscription.id,
          latestStatus:
            latestSubscription.status,
          cancelAt:
            latestSubscription.cancel_at,
          cancelAtPeriodEnd:
            latestSubscription.cancel_at_period_end,
        }
      );

      await syncSubscriptionToCarrier(
        db,
        latestSubscription
      );

      break;
    }

      case "customer.subscription.deleted": {
        const subscription =
          event.data.object as Stripe.Subscription;

        console.log(
          "Processing customer.subscription.deleted",
          {
            stripeSubscriptionId:
              subscription.id,
            status: subscription.status,
          }
        );

        await syncSubscriptionToCarrier(
          db,
          subscription
        );

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await recordReferralRewardForPaidInvoice(db, stripe, event.id, event.created, invoice,
          [stripeCompanyPriceId.value(), stripeDriverPriceId.value()]);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await reconcileReferralCharge(db, stripe, event.id, charge.id,
          [stripeCompanyPriceId.value(), stripeDriverPriceId.value()]);
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated":
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = stringId(dispute.charge);
        if (chargeId) await reconcileReferralCharge(db, stripe, event.id, chargeId,
          [stripeCompanyPriceId.value(), stripeDriverPriceId.value()]);
        break;
      }

      case "refund.created":
      case "refund.updated":
      case "refund.failed": {
        const refund = event.data.object as Stripe.Refund;
        const chargeId = stringId(refund.charge);
        if (chargeId) await reconcileReferralCharge(db, stripe, event.id, chargeId,
          [stripeCompanyPriceId.value(), stripeDriverPriceId.value()]);
        break;
      }
      case "credit_note.created":
      case "credit_note.updated":
      case "credit_note.voided": {
        const note = event.data.object as Stripe.CreditNote;
        const invoiceId = stringId(note.invoice);
        if (invoiceId) await recordReferralRewardForPaidInvoice(db, stripe, event.id, event.created, { id: invoiceId },
          [stripeCompanyPriceId.value(), stripeDriverPriceId.value()]);
        break;
      }
      case "radar.early_fraud_warning.created":
      case "radar.early_fraud_warning.updated": {
        const warning = event.data.object as Stripe.Radar.EarlyFraudWarning;
        const chargeId = stringId(warning.charge);
        if (chargeId) {
          await db.collection("referralFraudFlags").doc(chargeId).set({ active: warning.actionable === true, sourceEventId: event.id,
            warningId: warning.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          await reconcileReferralCharge(db, stripe, event.id, chargeId,
            [stripeCompanyPriceId.value(), stripeDriverPriceId.value()]);
        }
        break;
      }

      default: {
        console.log(
          "Stripe webhook event ignored",
          {
            eventType: event.type,
          }
        );
      }
    }

        await webhookEventRef.set(
          
      {
        status: "processed",
        processedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

          console.log(
        "Stripe webhook processed successfully",
        {
          eventId: event.id,
          eventType: event.type,
        }
      );
      response.status(200).json({
        received: true,
      });
    } catch (error) {
      console.error(
        "Stripe webhook processing failed:",
        error
      );

      try {
  await db.runTransaction(async tx => {
    if ((await tx.get(webhookEventRef)).data()?.processingToken === processingToken) {
      tx.update(webhookEventRef, { status: "failed", processingStartedAt: admin.firestore.Timestamp.fromMillis(0),
        lastError: String(error), failedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  });
} catch (cleanupError) {
  console.error(
    "Unable to release failed Stripe event claim:",
    {
      eventId: event.id,
      cleanupError,
    }
  );
}

      response
        .status(500)
        .send("Webhook processing failed");
    }
  }
);
// ── 2. On new user signup — create Firestore user doc ─────────────────────
export {
  getReferralCode,
  claimReferral,
} from "./referrals";
export {
  getReferralDashboard,
  matureReferralRewards,
} from "./referralLedgerRewards";
export { referralAdminReport, prepareReferralPayout, transitionReferralPayout, reviewReferralReward, correctReferralAttribution, reconcileReferralInvoice } from "./referralAdmin";

