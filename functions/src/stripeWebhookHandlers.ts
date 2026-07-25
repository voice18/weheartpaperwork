import Stripe from "stripe";
import * as admin from "firebase-admin";

type SubscriptionWithLegacyPeriod =
  Stripe.Subscription & {
    current_period_end?: number;
  };

type SubscriptionItemWithPeriod =
  Stripe.SubscriptionItem & {
    current_period_end?: number;
  };

/**
 * Stripe has exposed the billing-period end at slightly
 * different locations across API and SDK versions.
 *
 * This helper safely supports both:
 * - subscription.current_period_end
 * - subscription.items.data[].current_period_end
 */
function getCurrentPeriodEnd(
  subscription: Stripe.Subscription
): number | null {
  const legacyPeriodEnd =
    (
      subscription as SubscriptionWithLegacyPeriod
    ).current_period_end;

  if (
    typeof legacyPeriodEnd === "number"
  ) {
    return legacyPeriodEnd;
  }

  const itemPeriodEnds =
    subscription.items.data
      .map((item) => {
        return (
          item as SubscriptionItemWithPeriod
        ).current_period_end;
      })
      .filter(
        (value): value is number =>
          typeof value === "number"
      );

  if (itemPeriodEnds.length === 0) {
    return null;
  }

  return Math.max(...itemPeriodEnds);
}

/**
 * Calculates the subscription's recurring monthly amount
 * using the actual Stripe subscription items.
 *
 * This avoids relying only on locally hard-coded pricing.
 */
function calculateMonthlyAmountCents(
  subscription: Stripe.Subscription
): number {
  return subscription.items.data.reduce(
    (total, item) => {
      const unitAmount =
        item.price.unit_amount ?? 0;

      const quantity =
        item.quantity ?? 1;

      return total + unitAmount * quantity;
    },
    0
  );
}

/**
 * Finds the carrier attached to a Stripe subscription.
 *
 * Preferred method:
 * subscription.metadata.carrierId
 *
 * Fallback:
 * search Firestore by saved Stripe subscription ID
 */
async function findCarrierIdForSubscription(
  db: FirebaseFirestore.Firestore,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const metadataCarrierId =
    subscription.metadata?.carrierId;

  if (metadataCarrierId) {
    return metadataCarrierId;
  }

  const carrierSnapshot = await db
    .collection("carriers")
    .where(
      "billing.stripeSubscriptionId",
      "==",
      subscription.id
    )
    .limit(1)
    .get();

  if (carrierSnapshot.empty) {
    return null;
  }

  return carrierSnapshot.docs[0].id;
}

/**
 * Writes the current Stripe subscription state into
 * the carrier's Firestore billing object.
 */
export async function syncSubscriptionToCarrier(
  db: FirebaseFirestore.Firestore,
  subscription: Stripe.Subscription,
  carrierIdOverride?: string,
  activeDriverCountOverride?: number
) {
  const carrierId =
    carrierIdOverride ??
    (await findCarrierIdForSubscription(
      db,
      subscription
    ));

  if (!carrierId) {
    throw new Error(
      `Unable to find carrier for Stripe subscription ${subscription.id}.`
    );
  }

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const currentPeriodEndSeconds =
    getCurrentPeriodEnd(subscription);

  const currentPeriodEnd =
    currentPeriodEndSeconds
      ? admin.firestore.Timestamp.fromMillis(
          currentPeriodEndSeconds * 1000
        )
      : null;

  const trialEndsAt =
    subscription.trial_end
      ? admin.firestore.Timestamp.fromMillis(
          subscription.trial_end * 1000
        )
      : null;

  const cancelAt =
    subscription.cancel_at
      ? admin.firestore.Timestamp.fromMillis(
          subscription.cancel_at * 1000
        )
      : null;

  const carrierRef = db
    .collection("carriers")
    .doc(carrierId);

  const carrierSnapshot =
    await carrierRef.get();

  const existingBilling =
    carrierSnapshot.data()?.billing ?? {};

  const activeDriverCountAtBilling =
    activeDriverCountOverride ??
    existingBilling.activeDriverCountAtBilling ??
    0;

  const monthlyAmountCents =
    calculateMonthlyAmountCents(
      subscription
    );

  await carrierRef.set(
    {
      billing: {
        status: subscription.status,

        stripeCustomerId,

        stripeSubscriptionId:
          subscription.id,

        trialEndsAt,

        currentPeriodEnd,

        cancelAtPeriodEnd:
          subscription.cancel_at_period_end,

        cancelAt,

        canceledAt:
          subscription.canceled_at
            ? admin.firestore.Timestamp.fromMillis(
                subscription.canceled_at *
                  1000
              )
            : null,

        activeDriverCountAtBilling,

        monthlyAmountCents,

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    {
      merge: true,
    }
  );

  console.log(
    "Stripe subscription synchronized",
    {
      carrierId,
      stripeSubscriptionId:
        subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd:
        subscription.cancel_at_period_end,
      activeDriverCountAtBilling,
      monthlyAmountCents,
    }
  );
}

/**
 * Handles the first successful Stripe Checkout flow.
 */
export async function handleCheckoutCompleted(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const carrierId =
    session.metadata?.carrierId;

  const firebaseUserId =
    session.metadata?.firebaseUserId;

  const activeDriverCount = Number(
    session.metadata
      ?.activeDriverCountAtCheckout ?? "0"
  );

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  console.log(
    "Processing checkout.session.completed",
    {
      carrierId,
      firebaseUserId,
      stripeCustomerId,
      stripeSubscriptionId,
      activeDriverCount,
    }
  );

  if (!carrierId) {
    throw new Error(
      "Missing carrierId metadata."
    );
  }

  if (!stripeCustomerId) {
    throw new Error(
      "Missing Stripe customer."
    );
  }

  if (!stripeSubscriptionId) {
    throw new Error(
      "Missing Stripe subscription."
    );
  }

  const subscription =
    await stripe.subscriptions.retrieve(
      stripeSubscriptionId
    );

  await syncSubscriptionToCarrier(
    db,
    subscription,
    carrierId,
    activeDriverCount
  );
  await db
  .collection("carriers")
  .doc(carrierId)
  .set(
    {
      billing: {
        hasUsedTrial: true,

        trialFirstStartedAt:
          subscription.trial_start
            ? admin.firestore.Timestamp.fromMillis(
                subscription.trial_start *
                  1000
              )
            : admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    {
      merge: true,
    }
  );

console.log(
  "Trial usage permanently recorded",
  {
    carrierId,
    stripeSubscriptionId:
      subscription.id,
    hasUsedTrial: true,
  }
);
}