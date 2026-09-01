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
import {
  handleCheckoutCompleted,
  syncSubscriptionToCarrier,
} from "./stripeWebhookHandlers";
import {
  recordReferralRewardForPaidInvoice,
  recordRefundAdjustments,
  holdRewardForDispute,
  resolveRewardDispute,
} from "./referralRewards";


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

type AlertType = "15_days" | "5_days" | "due_today";
type ReminderPolicy = "standard" | "five-day-and-due" | "due-day-only";

type ReminderState = {
  dueDate: string;
  notified30: boolean;
  notified15: boolean;
  notified5: boolean;
  notifiedDue: boolean;
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
  expoPushTokens: string[];
  dueIn15DaysIds: string[];
  dueIn5DaysIds: string[];
  dueTodayIds: string[];
};

function customReminderPolicy(data: admin.firestore.DocumentData): ReminderPolicy {
  if (data.scheduleType !== "rolling") return "standard";
  if (
    data.recurrenceKind === "calendar-monthly" ||
    data.recurrenceKind === "calendar-quarterly"
  ) return "five-day-and-due";

  const value = typeof data.intervalValue === "number" ? data.intervalValue : 1;
  if (data.intervalUnit === "year" || (data.intervalUnit === "month" && value >= 12)) {
    return "standard";
  }
  const approximateDays =
    data.intervalUnit === "day" ? value :
    data.intervalUnit === "week" ? value * 7 :
    data.intervalUnit === "month" ? value * 30 :
    data.intervalUnit === "year" ? value * 365 : 365;

  if (approximateDays <= 7) return "due-day-only";
  if (approximateDays < 365) return "five-day-and-due";
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
    notifiedDue: sameOccurrence && data.notifiedDue === true,
  };

  // The 90-day Portal login cycle is intentionally quieter: reminders five
  // days before and on the maintenance date.
  if (requirementId === "fmcsa-portal") {
    if (days === 0 && !state.notifiedDue) {
      return {
        alertType: "due_today",
        state: { ...state, notified5: true, notifiedDue: true },
      };
    }
    if (days <= 5 && !state.notified5) {
      return {
        alertType: "5_days",
        state: { ...state, notified5: true },
      };
    }
    return null;
  }

  if (policy === "due-day-only") {
    if (days === 0 && !state.notifiedDue) {
      return { alertType: "due_today", state: { ...state, notifiedDue: true } };
    }
    return null;
  }

  if (days === 0 && !state.notifiedDue) {
    return {
      alertType: "due_today",
      state: { ...state, notified15: true, notified5: true, notifiedDue: true },
    };
  }

  if (requirementId === "ifta-quarterly" || policy === "five-day-and-due") {
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
      state: { ...state, notified15: true, notified5: true },
    };
  }
  if (days <= 15 && !state.notified15) {
    return {
      alertType: "15_days",
      state: { ...state, notified15: true },
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
      const carrierData = carrierDoc.data();
      if (
        carrierData.deletingAccount === true ||
        (carrierData.billing?.status !== "active" &&
          carrierData.billing?.status !== "trialing")
      ) {
        continue;
      }

      try {
      const usersSnap = await db
        .collection("users")
        .where("carrierId", "==", carrierId)
        .where("notificationsEnabled", "==", true)
        .get();

      const users = usersSnap.docs.map(userDoc => {
        const data = userDoc.data();
        const tokens = [
          ...(Array.isArray(data.expoPushTokens) ? data.expoPushTokens : []),
          data.expoPushToken,
        ].filter(isExpoPushToken);
        return { userId: userDoc.id, expoPushTokens: [...new Set(tokens)] };
      }).filter(user => user.expoPushTokens.length > 0);
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
        const days = daysUntil(dueDate);
            console.log("Compliance item checked", {
      carrierId,
      itemId: compDoc.id,
      dueDate: data.dueDate,
      completed: data.completed,
      daysUntilDue: days,
    });
        reminderCandidates.push({
          itemId: compDoc.id,
          label: REQUIREMENT_LABELS[compDoc.id] || compDoc.id,
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
            "15_days": [],
            "5_days": [],
            "due_today": [],
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

          const dueIn15DaysItems = groupedItems["15_days"];
          const dueIn5DaysItems = groupedItems["5_days"];
          const dueTodayItems = groupedItems["due_today"];
          const allItems = [
            ...dueIn5DaysItems,
            ...dueTodayItems,
            ...dueIn15DaysItems,
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
            dueTodayCount: dueTodayItems.length,
            dueIn15DaysCount: dueIn15DaysItems.length,
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
              expoPushTokens: user.expoPushTokens,
              dueIn15DaysIds: dueIn15DaysItems.map(item => item.itemId),
              dueIn5DaysIds: dueIn5DaysItems.map(item => item.itemId),
              dueTodayIds: dueTodayItems.map(item => item.itemId),
            });

            const acceptedTickets = ticket.filter(item => item.status === "ok" && item.id);
            await db.collection("notificationRuns").doc(notificationId).update({
              status: acceptedTickets.length > 0 ? "sent" : "failed",
              expoTickets: ticket,
              errorMessage: acceptedTickets.length > 0 ? null : "No device accepted the notification.",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            if (acceptedTickets.length > 0) {
              await saveReminderUpdates(reminderUpdates);
              const receiptBatch = db.batch();
              acceptedTickets.forEach(item => receiptBatch.set(
                db.collection("notificationPushReceipts").doc(item.id!),
                {
                  token: item.token,
                  userId: user.userId,
                  carrierId,
                  status: "pending",
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }
              ));
              await receiptBatch.commit();
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
      } catch (error) {
        console.error("Carrier notification processing failed; continuing", {
          carrierId,
          error,
        });
      }
      }
       console.log("Daily compliance check complete");
    } 
  );

  

async function sendDailySummaryNotification(
  summary: DailyNotificationSummary
): Promise<Array<{
  status: string;
  id?: string;
  message?: string;
  token: string;
}>> {
  const dueIn5DaysCount = summary.dueIn5DaysIds.length;
  const dueTodayCount = summary.dueTodayIds.length;
  const dueIn15DaysCount = summary.dueIn15DaysIds.length;

  const totalItems =
    dueIn5DaysCount +
    dueTodayCount +
    dueIn15DaysCount;

  const title =
    totalItems === 1
      ? "1 compliance item requires attention"
      : `${totalItems} compliance deadlines are approaching`;

  const bodyParts: string[] = [];

  if (dueTodayCount > 0) {
    bodyParts.push(`${dueTodayCount} due today`);
  }

  if (dueIn5DaysCount > 0) {
    bodyParts.push(`${dueIn5DaysCount} need attention within 5 days`);
  }

  if (dueIn15DaysCount  > 0) {
    bodyParts.push(`${dueIn15DaysCount} need attention within 15 days`);
  }

  const body = `${bodyParts.join(" • ")}. Tap to review.`;

  const allItemIds = [
    ...summary.dueTodayIds,
    ...summary.dueIn5DaysIds,
    ...summary.dueIn15DaysIds,
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
        body: JSON.stringify(summary.expoPushTokens.map(token => ({
          to: token,
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
            dueTodayIds:
              summary.dueTodayIds,
            dueIn15DaysIds:
              summary.dueIn15DaysIds,
          },
        }))),
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
      data: Array<{
        status: string;
        id?: string;
        message?: string;
      }>;
    };

    return result.data.map((ticket, index) => ({
      ...ticket,
      token: summary.expoPushTokens[index],
    }));
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

export const checkNotificationPushReceipts = functions.scheduler.onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Los_Angeles",
  },
  async () => {
    const pending = await db.collection("notificationPushReceipts")
      .where("status", "==", "pending")
      .limit(1000)
      .get();
    const eligible = pending.docs.filter(document => {
      const createdAt = document.data().createdAt as admin.firestore.Timestamp | undefined;
      return createdAt && Date.now() - createdAt.toMillis() >= 15 * 60 * 1000;
    });
    if (eligible.length === 0) return;

    const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ ids: eligible.map(document => document.id) }),
    });
    if (!response.ok) throw new Error(`Expo receipt request failed: ${response.status}`);
    const result = await response.json() as {
      data?: Record<string, { status: string; message?: string; details?: { error?: string } }>;
    };

    for (const document of eligible) {
      const receipt = result.data?.[document.id];
      if (!receipt) continue;
      await document.ref.update({
        status: receipt.status,
        error: receipt.details?.error ?? null,
        message: receipt.message ?? null,
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (receipt.details?.error === "DeviceNotRegistered") {
        const { userId, token } = document.data();
        if (typeof userId === "string" && typeof token === "string") {
          const userRef = db.collection("users").doc(userId);
          await db.runTransaction(async transaction => {
            const user = await transaction.get(userRef);
            if (!user.exists) return;
            const update: Record<string, unknown> = {
              expoPushTokens: admin.firestore.FieldValue.arrayRemove(token),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (user.data()?.expoPushToken === token) {
              update.expoPushToken = admin.firestore.FieldValue.delete();
            }
            transaction.update(userRef, update);
          });
        }
      }
    }
  }
);

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

    if (carrierSnapshot.exists) {
  await carrierRef.update({
    deletingAccount: true,
    deletingAccountStartedAt:
      admin.firestore.FieldValue.serverTimestamp(),
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

    referralWriter.set(
      referralCodeOwnerRef,
      {
        active: false,
        deactivatedReason: "account_deleted",
        deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
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

export const deleteCarrierEntity = onCall(
  { region: "us-central1", timeoutSeconds: 120 },
  async request => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to delete this record.");
    }
    const entityType = request.data?.entityType;
    const entityId = request.data?.entityId;
    if (
      !["customRequirement", "driver", "vehicle"].includes(entityType) ||
      typeof entityId !== "string" ||
      !entityId ||
      entityId.length > 200 ||
      entityId.includes("/")
    ) {
      throw new HttpsError("invalid-argument", "The deletion target is invalid.");
    }

    const carrierId = request.auth.uid;
    const [user, carrier] = await Promise.all([
      db.collection("users").doc(carrierId).get(),
      db.collection("carriers").doc(carrierId).get(),
    ]);
    if (!user.exists || user.data()?.carrierId !== carrierId || user.data()?.role !== "owner") {
      throw new HttpsError("permission-denied", "Only the company owner can delete this record.");
    }
    if (!carrier.exists) {
      throw new HttpsError("not-found", "Your company account could not be found.");
    }
    if (carrier.data()?.deletingAccount === true) {
      throw new HttpsError("failed-precondition", "Account deletion is already in progress.");
    }

    const collectionName = entityType === "customRequirement"
      ? "customRequirements"
      : entityType === "driver"
        ? "drivers"
        : "vehicles";
    const target = carrier.ref.collection(collectionName).doc(entityId);
    if (!(await target.get()).exists) return { success: true, alreadyDeleted: true };
    await db.recursiveDelete(target);
    return { success: true, alreadyDeleted: false };
  }
);

async function deleteDocumentsByUserOrCarrier(
  collectionName: string,
  userId: string,
  carrierId: string
): Promise<void> {
  const [byUser, byCarrier] = await Promise.all([
    db.collection(collectionName).where("userId", "==", userId).get(),
    db.collection(collectionName).where("carrierId", "==", carrierId).get(),
  ]);
  const refs = new Map<string, FirebaseFirestore.DocumentReference>();
  byUser.docs.forEach(document => refs.set(document.ref.path, document.ref));
  byCarrier.docs.forEach(document => refs.set(document.ref.path, document.ref));
  if (refs.size === 0) return;

  const writer = db.bulkWriter();
  refs.forEach(ref => writer.delete(ref));
  await writer.close();
}

async function resumeStalledDeletion(
  carrierSnapshot: FirebaseFirestore.DocumentSnapshot
): Promise<void> {
  const carrierId = carrierSnapshot.id;
  const carrierRef = carrierSnapshot.ref;
  const stripeCustomerId = carrierSnapshot.data()?.billing?.stripeCustomerId;

  if (typeof stripeCustomerId === "string" && stripeCustomerId) {
    const stripe = new Stripe(stripeSecretKey.value());
    try {
      await stripe.customers.del(stripeCustomerId);
    } catch (error: any) {
      const missing = error?.code === "resource_missing" || error?.statusCode === 404;
      if (!missing) throw error;
    }
  }

  await Promise.all([
    deleteDocumentsByUserOrCarrier("notificationRuns", carrierId, carrierId),
    deleteDocumentsByUserOrCarrier("notificationReminderStates", carrierId, carrierId),
  ]);

  const referralCodeOwnerRef = db.collection("carrierReferralCodes").doc(carrierId);
  const ownedCodes = await db.collection("referralCodes")
    .where("carrierId", "==", carrierId)
    .get();
  const referralWriter = db.bulkWriter();
  referralWriter.set(referralCodeOwnerRef, {
    active: false,
    deactivatedReason: "account_deleted",
    deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  ownedCodes.docs.forEach(document => {
    referralWriter.set(document.ref, {
      active: false,
      deactivatedReason: "account_deleted",
      deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await referralWriter.close();

  await db.recursiveDelete(carrierRef);
  await db.collection("users").doc(carrierId).delete();
  try {
    await admin.auth().deleteUser(carrierId);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
}

/**
 * Safety net for a deletion interrupted by a timeout, deployment, or transient
 * service failure. All operations are idempotent and retry on the next run.
 */
export const resumeStalledAccountDeletions = functions.scheduler.onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "America/Los_Angeles",
    secrets: [stripeSecretKey],
    timeoutSeconds: 540,
  },
  async () => {
    const deletingCarriers = await db.collection("carriers")
      .where("deletingAccount", "==", true)
      .get();
    const staleBefore = Date.now() - 15 * 60 * 1000;

    for (const carrierSnapshot of deletingCarriers.docs) {
      const startedAt = carrierSnapshot.data().deletingAccountStartedAt as
        | admin.firestore.Timestamp
        | undefined;
      if (startedAt && startedAt.toMillis() > staleBefore) continue;

      try {
        await resumeStalledDeletion(carrierSnapshot);
        console.log("Stalled account deletion completed", {
          carrierId: carrierSnapshot.id,
        });
      } catch (error) {
        console.error("Stalled account deletion will be retried", {
          carrierId: carrierSnapshot.id,
          error,
        });
      }
    }
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
/**
 * Repairs a stale Firestore billing snapshot from Stripe.
 *
 * This is intentionally limited to the Stripe customer already linked to the
 * authenticated carrier. An email match alone is not sufficient proof that a
 * Stripe customer belongs to a Firebase account.
 */
export const refreshBillingStatus = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to refresh billing."
      );
    }

    const userId = request.auth.uid;
    const [userSnapshot, carrierSnapshot] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("carriers").doc(userId).get(),
    ]);

    if (!carrierSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Your company account could not be found."
      );
    }

    if (
      userSnapshot.exists &&
      userSnapshot.data()?.carrierId !== userId
    ) {
      throw new HttpsError(
        "permission-denied",
        "Your company account link is invalid."
      );
    }

    if (carrierSnapshot.data()?.deletingAccount === true) {
      throw new HttpsError(
        "failed-precondition",
        "Account deletion is already in progress."
      );
    }

    // Early accounts could have a carrier document without the matching user
    // link. The authenticated UID is already the carrier owner in this app's
    // one-owner data model, so restoring this missing index is safe.
    if (!userSnapshot.exists) {
      await db.collection("users").doc(userId).set({
        email:
          typeof request.auth.token.email === "string"
            ? request.auth.token.email
            : "",
        carrierId: userId,
        role: "owner",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const billing = carrierSnapshot.data()?.billing ?? {};
    const stripeCustomerId = billing.stripeCustomerId;
    const savedSubscriptionId = billing.stripeSubscriptionId;

    if (typeof stripeCustomerId !== "string" || !stripeCustomerId) {
      return { repaired: false, reason: "no-linked-customer" };
    }

    const stripe = new Stripe(stripeSecretKey.value());
    let subscription: Stripe.Subscription | null = null;

    if (
      typeof savedSubscriptionId === "string" &&
      savedSubscriptionId
    ) {
      try {
        subscription = await stripe.subscriptions.retrieve(
          savedSubscriptionId
        );
      } catch (error: any) {
        const missing =
          error?.code === "resource_missing" ||
          error?.statusCode === 404;

        if (!missing) {
          throw error;
        }
      }
    }

    if (!subscription) {
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 100,
      });

      const accessSubscription = subscriptions.data.find(
        (item) => item.status === "active" || item.status === "trialing"
      );

      subscription = accessSubscription ?? subscriptions.data[0] ?? null;
    }

    if (!subscription) {
      return { repaired: false, reason: "no-subscription" };
    }

    const subscriptionCustomerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    if (subscriptionCustomerId !== stripeCustomerId) {
      throw new HttpsError(
        "failed-precondition",
        "The linked billing profile does not match this subscription."
      );
    }

    await syncSubscriptionToCarrier(db, subscription, userId);

    return {
      repaired: true,
      status: subscription.status,
    };
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

      const customerSubscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 100,
      });
      const liveSubscription = customerSubscriptions.data.find(
        subscription =>
          subscription.status === "active" ||
          subscription.status === "trialing" ||
          subscription.status === "past_due" ||
          subscription.status === "unpaid" ||
          subscription.status === "incomplete" ||
          subscription.status === "paused"
      );

      if (liveSubscription) {
        await syncSubscriptionToCarrier(db, liveSubscription, carrierId);
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${publicAppBaseUrl()}/settings`,
        });
        return {
          url: portalSession.url,
          activeDriverCount,
          estimatedMonthlyAmountCents:
            liveSubscription.items.data.reduce(
              (total, item) => total + (item.price.unit_amount ?? 0) * (item.quantity ?? 1),
              0
            ),
        };
      }

      const openCheckoutSessions = await stripe.checkout.sessions.list({
        customer: stripeCustomerId,
        status: "open",
        limit: 100,
      });
      const reusableCheckoutSession = openCheckoutSessions.data.find(
        session =>
          session.mode === "subscription" &&
          session.metadata?.carrierId === carrierId &&
          typeof session.url === "string"
      );

      if (reusableCheckoutSession?.url) {
        return {
          url: reusableCheckoutSession.url,
          activeDriverCount,
          estimatedMonthlyAmountCents: 200 + activeDriverCount * 100,
        };
      }

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
          }, {
            idempotencyKey:
              `checkout_${carrierId}_${Math.floor(Date.now() / (30 * 60 * 1000))}`,
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

    const lockOwner = `driver_event_${event.id}`;
    const reconciliation = await db.runTransaction(async transaction => {
      const ref = db.collection("carriers").doc(carrierId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.deletingAccount === true) {
        return null;
      }

      const data = snapshot.data() ?? {};
      const generation = Number(data.billingReconciliationGeneration ?? 0) + 1;
      const lockUntil = data.billingReconciliationLockUntil as
        | admin.firestore.Timestamp
        | undefined;
      const lockIsActive = lockUntil && lockUntil.toMillis() > Date.now();

      transaction.update(ref, {
        billingReconciliationGeneration: generation,
        billingReconciliationPending: true,
        ...(lockIsActive ? {} : {
          billingReconciliationLockOwner: lockOwner,
          billingReconciliationLockUntil:
            admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        }),
      });

      return { generation, ownsLock: !lockIsActive };
    });

    if (!reconciliation?.ownsLock) {
      // The current lock holder or the scheduled safety net will reconcile the
      // newest generation. This prevents out-of-order Stripe quantity writes.
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

    await db.runTransaction(async transaction => {
      const latest = await transaction.get(carrierRef);
      if (!latest.exists) return;
      if (latest.data()?.billingReconciliationLockOwner !== lockOwner) return;
      const hasNewerGeneration =
        Number(latest.data()?.billingReconciliationGeneration ?? 0) !==
        reconciliation.generation;
      transaction.update(carrierRef, {
        billingReconciliationPending: hasNewerGeneration,
        billingReconciliationLockOwner: admin.firestore.FieldValue.delete(),
        billingReconciliationLockUntil: admin.firestore.FieldValue.delete(),
      });
    });
  }
);

export const reconcilePendingDriverBilling = functions.scheduler.onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/Los_Angeles",
    secrets: [stripeSecretKey, stripeDriverPriceId],
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    const pendingCarriers = await db.collection("carriers")
      .where("billingReconciliationPending", "==", true)
      .get();
    const stripe = new Stripe(stripeSecretKey.value());
    const driverPriceId = stripeDriverPriceId.value();

    for (const pendingCarrier of pendingCarriers.docs) {
      const carrierRef = pendingCarrier.ref;
      const carrierId = pendingCarrier.id;
      const lockOwner = `scheduled_${Date.now()}_${carrierId}`;
      const claim = await db.runTransaction(async transaction => {
        const latest = await transaction.get(carrierRef);
        if (!latest.exists || latest.data()?.deletingAccount === true) return null;
        const lockUntil = latest.data()?.billingReconciliationLockUntil as
          | admin.firestore.Timestamp
          | undefined;
        if (lockUntil && lockUntil.toMillis() > Date.now()) return null;
        const generation = Number(latest.data()?.billingReconciliationGeneration ?? 0);
        transaction.update(carrierRef, {
          billingReconciliationLockOwner: lockOwner,
          billingReconciliationLockUntil:
            admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        });
        return {
          generation,
          subscriptionId: latest.data()?.billing?.stripeSubscriptionId,
        };
      });

      if (!claim) continue;

      try {
        if (typeof claim.subscriptionId === "string" && claim.subscriptionId) {
          const drivers = await carrierRef.collection("drivers").get();
          const activeDriverCount = drivers.docs.filter(
            document => document.data().status !== "inactive"
          ).length;
          let subscription = await stripe.subscriptions.retrieve(claim.subscriptionId);

          if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
            const driverItem = subscription.items.data.find(
              item => item.price.id === driverPriceId
            );
            const currentQuantity = driverItem?.quantity ?? 0;

            if (activeDriverCount > 0 && currentQuantity !== activeDriverCount) {
              if (driverItem) {
                await stripe.subscriptionItems.update(
                  driverItem.id,
                  { quantity: activeDriverCount, proration_behavior: "create_prorations" },
                  { idempotencyKey: `driver_reconcile_${carrierId}_${claim.generation}` }
                );
              } else {
                await stripe.subscriptionItems.create(
                  {
                    subscription: subscription.id,
                    price: driverPriceId,
                    quantity: activeDriverCount,
                    proration_behavior: "create_prorations",
                  },
                  { idempotencyKey: `driver_reconcile_${carrierId}_${claim.generation}` }
                );
              }
            } else if (activeDriverCount === 0 && driverItem) {
              await stripe.subscriptionItems.del(
                driverItem.id,
                { proration_behavior: "create_prorations" }
              );
            }

            subscription = await stripe.subscriptions.retrieve(subscription.id);
            await syncSubscriptionToCarrier(db, subscription, carrierId, activeDriverCount);
          }
        }

        await db.runTransaction(async transaction => {
          const latest = await transaction.get(carrierRef);
          if (!latest.exists || latest.data()?.billingReconciliationLockOwner !== lockOwner) return;
          const hasNewerGeneration =
            Number(latest.data()?.billingReconciliationGeneration ?? 0) !== claim.generation;
          transaction.update(carrierRef, {
            billingReconciliationPending: hasNewerGeneration,
            billingReconciliationLockOwner: admin.firestore.FieldValue.delete(),
            billingReconciliationLockUntil: admin.firestore.FieldValue.delete(),
          });
        });
      } catch (error) {
        console.error("Driver billing reconciliation will be retried", { carrierId, error });
        await db.runTransaction(async transaction => {
          const latest = await transaction.get(carrierRef);
          if (!latest.exists || latest.data()?.billingReconciliationLockOwner !== lockOwner) return;
          transaction.update(carrierRef, {
            billingReconciliationPending: true,
            billingReconciliationLockOwner: admin.firestore.FieldValue.delete(),
            billingReconciliationLockUntil: admin.firestore.FieldValue.delete(),
          });
        });
      }
    }
  }
);

export const queueDailyDriverBillingReconciliation = functions.scheduler.onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "America/Los_Angeles",
    timeoutSeconds: 540,
  },
  async () => {
    const carriers = await db.collection("carriers").get();
    for (let index = 0; index < carriers.docs.length; index += 450) {
      const batch = db.batch();
      for (const carrier of carriers.docs.slice(index, index + 450)) {
        const data = carrier.data();
        const subscriptionId = data.billing?.stripeSubscriptionId;
        if (
          data.deletingAccount === true ||
          typeof subscriptionId !== "string" ||
          !subscriptionId
        ) {
          continue;
        }
        batch.update(carrier.ref, {
          billingReconciliationPending: true,
          billingReconciliationGeneration:
            admin.firestore.FieldValue.increment(1),
        });
      }
      await batch.commit();
    }
  }
);
export const stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [
      stripeSecretKey,
      stripeWebhookSecret,
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
    
    const eventClaimed = await db.runTransaction(
  async (transaction) => {
    const existingEvent =
      await transaction.get(webhookEventRef);

    if (existingEvent.exists) {
      const existing = existingEvent.data();
      if (existing?.status === "processed") {
        return "processed" as const;
      }

      const startedAt = existing?.processingStartedAt as
        | admin.firestore.Timestamp
        | undefined;
      const leaseIsCurrent = startedAt &&
        Date.now() - startedAt.toMillis() < 15 * 60 * 1000;
      if (leaseIsCurrent) {
        return "busy" as const;
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
      processingStartedAt:
        admin.firestore.FieldValue.serverTimestamp(),
      processingAttempts:
        admin.firestore.FieldValue.increment(1),
    }, { merge: true });

    return "claimed" as const;
  }
);

if (eventClaimed === "processed") {
  console.log(
    "Duplicate Stripe webhook ignored",
    {
      eventId: event.id,
      eventType: event.type,
    }
  );

  response.status(200).json({
    received: true,
    duplicate: true,
  });

  return;
}

if (eventClaimed === "busy") {
  // Do not acknowledge a concurrent delivery until the active worker has
  // committed success. If that worker fails, Stripe will retry this event.
  response.status(409).send("Webhook event is already being processed");
  return;
}

    try {
      switch (event.type) {
      case "checkout.session.completed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        await handleCheckoutCompleted(
          db,
          stripe,
          session,
          stripeDriverPriceId.value()
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
        await recordReferralRewardForPaidInvoice(db, stripe, event.id, event.created, invoice);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await recordRefundAdjustments(db, stripe, event.id, charge);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await holdRewardForDispute(db, event.id, dispute);
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        await resolveRewardDispute(db, event.id, dispute);
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
  await webhookEventRef.delete();
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
} from "./referralRewards";

