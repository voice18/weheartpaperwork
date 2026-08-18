// functions/src/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firebase Cloud Functions
//
// Deploy with:  cd functions && npm run deploy
// Or from root: firebase deploy --only functions
//
// Firebase Functions backend.
//   dailyComplianceCheck — runs every day at 8am, scans all carriers,
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


admin.initializeApp();
const db  = admin.firestore();
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeCompanyPriceId = defineSecret("STRIPE_COMPANY_PRICE_ID");
const stripeDriverPriceId = defineSecret("STRIPE_DRIVER_PRICE_ID");
const stripeWebhookSecret =
  defineSecret("STRIPE_WEBHOOK_SECRET");


// ── Helpers ───────────────────────────────────────────────────────────────────

type AlertType = "30_days" | "15_days" | "5_days";

type DailyNotificationSummary = {
  carrierId: string;
  userId: string;
  expoPushToken: string;
  dueIn30DaysIds: string[];
  dueIn15DaysIds: string[];
  dueIn5DaysIds: string[];
};

function getAlertType(
  days: number,
  requirementId?: string
): AlertType | null {
  // FMCSA portal maintenance is intentionally quieter:
  // one push notification at 5 days remaining only.
  if (requirementId === "fmcsa-portal") {
    return days === 5 ? "5_days" : null;
  }

  // Standard notification schedule for all other requirements.
  if (days === 30) return "30_days";
  if (days === 15) return "15_days";
  if (days === 5) return "5_days";

  return null;
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
  irp: "IRP Registration Renewal",
  drug: "Drug & Alcohol Consortium Enrollment",
  boc3: "BOC-3 Process Agent Filing",
};

const COMPANY_REQUIREMENT_IDS =
  new Set(Object.keys(REQUIREMENT_LABELS));

type DriverRequirementDefinition = {
  field: "cdlExpiration" | "medicalExpiration" | "mvrDue" | "clearinghouseDue";
  itemType: "cdl" | "medical" | "mvr" | "clearinghouse";
  label: string;
  yearsToAdd: number;
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
    yearsToAdd: 1,
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

// ── 1. Daily compliance check (runs every day at 8am Pacific) ─────────────────────

export const dailyComplianceCheck = functions.scheduler.onSchedule(
  {
    schedule: "0 8 * * *",
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

      const compSnap = await db
        .collection("carriers")
        .doc(carrierId)
        .collection("compliance")
        .get();

      const groupedItems: Record<
        AlertType,
        Array<{ itemId: string; label: string }>
      > = {
        "30_days": [],
        "15_days": [],
        "5_days": [],
      };

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

        const days = daysUntil(String(data.dueDate));
            console.log("Compliance item checked", {
      carrierId,
      itemId: compDoc.id,
      dueDate: data.dueDate,
      completed: data.completed,
      daysUntilDue: days,
    });
        const alertType = getAlertType(days, compDoc.id);

        if (!alertType) {
          continue;
        }

        groupedItems[alertType].push({
          itemId: compDoc.id,
          label: REQUIREMENT_LABELS[compDoc.id] || compDoc.id,
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

    const dueDate =
      requirement.yearsToAdd > 0
        ? addYearsToDate(storedDate, requirement.yearsToAdd)
        : storedDate;

    const days = daysUntil(dueDate);
    const alertType = getAlertType(days);

    console.log("Driver requirement checked", {
      carrierId,
      driverId: driverDoc.id,
      driverName,
      requirement: requirement.itemType,
      storedDate,
      dueDate,
      daysUntilDue: days,
    });

    if (!alertType) {
      continue;
    }

    groupedItems[alertType].push({
      itemId: `driver:${driverDoc.id}:${requirement.itemType}`,
      label: `${driverName} — ${requirement.label}`,
    });
  }
}
        const dueIn30DaysItems = groupedItems["30_days"];
        const dueIn15DaysItems = groupedItems["15_days"];
        const dueIn5DaysItems = groupedItems["5_days"];

        const allItems = [
          ...dueIn5DaysItems,
          ...dueIn15DaysItems,
          ...dueIn30DaysItems,
        ];

        if (allItems.length === 0) {
          continue;
        }

        for (const user of users) {
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
            });

            await db.collection("notificationRuns").doc(notificationId).update({
              status: ticket.status === "ok" ? "sent" : "failed",
              expoTicketId: ticket.id || null,
              errorMessage: ticket.message || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
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
  const dueIn15DaysCount = summary.dueIn15DaysIds.length;
  const dueIn30DaysCount = summary.dueIn30DaysIds.length;

  const totalItems =
    dueIn5DaysCount +
    dueIn15DaysCount +
    dueIn30DaysCount;

  const title =
    totalItems === 1
      ? "1 compliance item requires attention"
      : `${totalItems} compliance deadlines are approaching`;

  const bodyParts: string[] = [];

  if (dueIn5DaysCount > 0) {
    bodyParts.push(`${dueIn5DaysCount} due in 5 days`);
  }

  if (dueIn15DaysCount  > 0) {
    bodyParts.push(`${dueIn15DaysCount } due in 15 days`);
  }

  if (dueIn30DaysCount > 0) {
    bodyParts.push(`${dueIn30DaysCount} due in 30 days`);
  }

  const body = `${bodyParts.join(" • ")}. Tap to review.`;

  const allItemIds = [
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
          return_url:
            "https://weheartpaperwork.com/settings",
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
            "https://weheartpaperwork.com/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}",

          cancel_url:
            "https://weheartpaperwork.com/subscription-required?checkout=cancelled",
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
    secrets: [
      stripeSecretKey,
      stripeWebhookSecret,
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
      return false;
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
    });

    return true;
  }
);

if (!eventClaimed) {
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

    try {
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
export { getReferralCode } from "./referrals";

