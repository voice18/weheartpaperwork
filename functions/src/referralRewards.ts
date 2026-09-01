import * as admin from "firebase-admin";
import Stripe from "stripe";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  calculateRewardCents,
  REFERRAL_HOLD_DAYS,
  REFERRAL_MINIMUM_PAYOUT_CENTS,
  REFERRAL_TERMS_VERSION,
} from "./referralPolicy";

type RewardStatus = "pending" | "held" | "available" | "paid" | "reversed";

function stringId(value: string | { id: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function qualifyingInvoiceCents(invoice: Stripe.Invoice): number {
  if (invoice.status !== "paid" || invoice.amount_paid <= 0) return 0;
  const excludingTax = invoice.total_excluding_tax ?? invoice.total;
  return Math.max(0, Math.min(invoice.amount_paid, excludingTax));
}

function subscriptionIdForInvoice(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return stringId(subscription);
}

async function findCarrierIdForInvoice(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<string | null> {
  const subscriptionId = subscriptionIdForInvoice(invoice);
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const metadataCarrierId = subscription.metadata?.carrierId?.trim();
    if (metadataCarrierId) {
      const carrier = await db.collection("carriers").doc(metadataCarrierId).get();
      if (carrier.exists) return carrier.id;
    }

    const bySubscription = await db.collection("carriers")
      .where("billing.stripeSubscriptionId", "==", subscriptionId).limit(2).get();
    if (bySubscription.size === 1) return bySubscription.docs[0].id;
    if (bySubscription.size > 1) throw new Error(`Multiple carriers use subscription ${subscriptionId}.`);
  }

  const customerId = stringId(invoice.customer);
  if (customerId) {
    const byCustomer = await db.collection("carriers")
      .where("billing.stripeCustomerId", "==", customerId).limit(2).get();
    if (byCustomer.size === 1) return byCustomer.docs[0].id;
    if (byCustomer.size > 1) throw new Error(`Multiple carriers use customer ${customerId}.`);
  }

  return null;
}

function hasActiveSubscription(data: FirebaseFirestore.DocumentData | undefined): boolean {
  const status = data?.billing?.status;
  return status === "active" || status === "trialing";
}

async function paymentIdsForInvoice(
  stripe: Stripe,
  invoiceId: string
): Promise<{ paymentIntentIds: string[]; chargeIds: string[] }> {
  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 100 });
  const paymentIntentIds = new Set<string>();
  const chargeIds = new Set<string>();

  for (const item of payments.data) {
    const paymentIntentId = stringId(item.payment.payment_intent);
    const directChargeId = stringId(item.payment.charge);
    if (paymentIntentId) {
      paymentIntentIds.add(paymentIntentId);
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
      const latestChargeId = stringId(paymentIntent.latest_charge);
      if (latestChargeId) chargeIds.add(latestChargeId);
    }
    if (directChargeId) chargeIds.add(directChargeId);
  }

  return { paymentIntentIds: [...paymentIntentIds], chargeIds: [...chargeIds] };
}

export async function recordReferralRewardForPaidInvoice(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  eventId: string,
  eventCreated: number,
  eventInvoice: Stripe.Invoice
): Promise<void> {
  const invoice = await stripe.invoices.retrieve(eventInvoice.id);
  const referredCarrierId = await findCarrierIdForInvoice(db, stripe, invoice);
  if (!referredCarrierId) return;

  const referralRef = db.collection("referrals").doc(referredCarrierId);
  const referralSnapshot = await referralRef.get();
  if (!referralSnapshot.exists || referralSnapshot.data()?.status !== "active") return;

  const referral = referralSnapshot.data()!;
  const referrerCarrierId = referral.referrerCarrierId;
  const rateBps = referral.commissionRateBps;
  if (typeof referrerCarrierId !== "string" || !Number.isInteger(rateBps)) {
    throw new Error(`Referral ${referredCarrierId} is malformed.`);
  }

  const qualifyingCents = qualifyingInvoiceCents(invoice);
  const rewardCents = calculateRewardCents(qualifyingCents, rateBps);
  if (rewardCents <= 0) return;

  const [referrerSnapshot, paymentIds] = await Promise.all([
    db.collection("carriers").doc(referrerCarrierId).get(),
    paymentIdsForInvoice(stripe, invoice.id),
  ]);

  const referrer = referrerSnapshot.data();
  // Eligibility is tested when the referred payment is made. A canceled or
  // deleted referrer does not keep accumulating rewards after leaving.
  if (!referrer || !hasActiveSubscription(referrer) || referrer.deletionInProgress === true) {
    return;
  }
  // A fraud/admin suspension holds the otherwise-qualifying reward for review.
  const status: RewardStatus = referrer.referralProgramSuspended === true ? "held" : "pending";
  const paidAt = admin.firestore.Timestamp.fromMillis(eventCreated * 1000);
  const availableAt = admin.firestore.Timestamp.fromMillis(
    eventCreated * 1000 + REFERRAL_HOLD_DAYS * 24 * 60 * 60 * 1000
  );
  const rewardRef = db.collection("referralRewards").doc(invoice.id);
  const maturityRef = db.collection("referralRewardMaturities").doc(invoice.id);
  const summaryRef = db.collection("referralSummaries").doc(referrerCarrierId);

  await db.runTransaction(async transaction => {
    const existing = await transaction.get(rewardRef);
    if (existing.exists) return;

    transaction.create(rewardRef, {
      referrerCarrierId,
      referredCarrierId,
      referralCode: referral.referralCode,
      referralTermsVersion: referral.termsVersion ?? REFERRAL_TERMS_VERSION,
      commissionRateBps: rateBps,
      qualifyingCents,
      originalRewardCents: rewardCents,
      netRewardCents: rewardCents,
      adjustedCents: 0,
      currency: invoice.currency,
      status,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: stringId(invoice.customer),
      stripeSubscriptionId: subscriptionIdForInvoice(invoice),
      stripePaymentIntentIds: paymentIds.paymentIntentIds,
      stripeChargeIds: paymentIds.chargeIds,
      sourceEventId: eventId,
      paidAt,
      availableAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(maturityRef, {
      rewardId: invoice.id,
      referrerCarrierId,
      availableAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(summaryRef, {
      referrerCarrierId,
      pendingCents: admin.firestore.FieldValue.increment(status === "pending" ? rewardCents : 0),
      heldCents: admin.firestore.FieldValue.increment(status === "held" ? rewardCents : 0),
      lifetimeEarnedCents: admin.firestore.FieldValue.increment(rewardCents),
      currency: invoice.currency,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await reconcilePendingDisputesForCharges(db, stripe, paymentIds.chargeIds);
}

async function findRewardForCharge(
  db: FirebaseFirestore.Firestore,
  chargeId: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const snapshot = await db.collection("referralRewards")
    .where("stripeChargeIds", "array-contains", chargeId).limit(2).get();
  if (snapshot.size > 1) throw new Error(`Charge ${chargeId} maps to multiple referral rewards.`);
  return snapshot.docs[0] ?? null;
}

function bucketForStatus(status: RewardStatus): "pendingCents" | "heldCents" | "availableCents" | "paidCents" | null {
  if (status === "pending") return "pendingCents";
  if (status === "held") return "heldCents";
  if (status === "available") return "availableCents";
  if (status === "paid") return "paidCents";
  return null;
}

function disputeIsClosed(status: Stripe.Dispute.Status): boolean {
  return status === "won" ||
    status === "lost" ||
    status === "warning_closed" ||
    status === "prevented";
}

async function reconcilePendingDisputesForCharges(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  chargeIds: string[]
): Promise<void> {
  for (const chargeId of chargeIds) {
    const pendingSnapshot = await db.collection("referralPendingDisputes").doc(chargeId).get();
    const pending = pendingSnapshot.data();
    if (!pendingSnapshot.exists || typeof pending?.stripeDisputeId !== "string") continue;

    const dispute = await stripe.disputes.retrieve(pending.stripeDisputeId);
    await holdRewardForDispute(db, pending.sourceEventId ?? `reconcile_${dispute.id}`, dispute);
    if (disputeIsClosed(dispute.status)) {
      await resolveRewardDispute(db, pending.resolutionEventId ?? `reconcile_resolution_${dispute.id}`, dispute);
    }
  }
}

export async function recordRefundAdjustments(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  eventId: string,
  eventCharge: Stripe.Charge
): Promise<void> {
  // Stripe webhook payloads can omit expandable/list data. Always load the
  // current charge and its authoritative refund records from Stripe.
  const charge = await stripe.charges.retrieve(eventCharge.id);
  const rewardSnapshot = await findRewardForCharge(db, charge.id);
  if (!rewardSnapshot) return;
  const reward = rewardSnapshot.data();
  const refunds: Stripe.Refund[] = [];
  for await (const refund of stripe.refunds.list({
    charge: charge.id,
    limit: 100,
  })) {
    refunds.push(refund);
  }

  for (const refund of refunds) {
    if (refund.status !== "succeeded") continue;
    const adjustmentRef = db.collection("referralRewardAdjustments").doc(`refund_${refund.id}`);
    const rewardRef = rewardSnapshot.ref;
    const summaryRef = db.collection("referralSummaries").doc(reward.referrerCarrierId);

    await db.runTransaction(async transaction => {
      if ((await transaction.get(adjustmentRef)).exists) return;
      const currentSnapshot = await transaction.get(rewardRef);
      if (!currentSnapshot.exists) return;
      const current = currentSnapshot.data()!;
      const currentNet = Math.max(0, Number(current.netRewardCents ?? 0));
      if (currentNet <= 0) return;

      const fullRefund = charge.amount_refunded >= charge.amount;
      const proportional = charge.amount > 0
        ? Math.floor((Number(current.originalRewardCents) * refund.amount) / charge.amount)
        : 0;
      const reversalCents = Math.min(currentNet, fullRefund ? Number(current.originalRewardCents) : proportional);
      if (reversalCents <= 0) return;

      const oldStatus = current.status as RewardStatus;
      const newNet = currentNet - reversalCents;
      const newStatus: RewardStatus = newNet === 0 ? "reversed" : oldStatus;
      const bucket = bucketForStatus(oldStatus);

      transaction.create(adjustmentRef, {
        rewardId: rewardRef.id,
        referrerCarrierId: current.referrerCarrierId,
        referredCarrierId: current.referredCarrierId,
        type: "refund",
        amountCents: -reversalCents,
        currency: current.currency,
        stripeRefundId: refund.id,
        stripeChargeId: charge.id,
        sourceEventId: eventId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const rewardUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        netRewardCents: newNet,
        adjustedCents: admin.firestore.FieldValue.increment(-reversalCents),
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (Number(current.disputeHeldCents ?? 0) > 0) {
        rewardUpdate.disputeHeldCents = Math.min(newNet, Number(current.disputeHeldCents));
      }
      transaction.update(rewardRef, rewardUpdate);
      const summaryUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        reversedCents: admin.firestore.FieldValue.increment(reversalCents),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (bucket) summaryUpdate[bucket] = admin.firestore.FieldValue.increment(-reversalCents);
      transaction.set(summaryRef, summaryUpdate, { merge: true });
      if (newStatus === "reversed") transaction.delete(db.collection("referralRewardMaturities").doc(rewardRef.id));
    });
  }
}

export async function holdRewardForDispute(
  db: FirebaseFirestore.Firestore,
  eventId: string,
  dispute: Stripe.Dispute
): Promise<void> {
  const chargeId = stringId(dispute.charge);
  if (!chargeId) return;
  const pendingRef = db.collection("referralPendingDisputes").doc(chargeId);
  let rewardSnapshot = await findRewardForCharge(db, chargeId);
  if (!rewardSnapshot) {
    await pendingRef.set({
      stripeChargeId: chargeId,
      stripeDisputeId: dispute.id,
      disputeStatus: dispute.status,
      sourceEventId: eventId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Close the race where invoice.paid commits after our first lookup but
    // before the pending marker is written.
    rewardSnapshot = await findRewardForCharge(db, chargeId);
    if (!rewardSnapshot) return;
  }
  const rewardRef = rewardSnapshot.ref;
  const holdRef = db.collection("referralRewardAdjustments").doc(`dispute_hold_${dispute.id}`);

  await db.runTransaction(async transaction => {
    if ((await transaction.get(holdRef)).exists) return;
    const currentSnapshot = await transaction.get(rewardRef);
    if (!currentSnapshot.exists) return;
    const current = currentSnapshot.data()!;
    const net = Math.max(0, Number(current.netRewardCents ?? 0));
    if (net <= 0 || current.status === "paid") return;
    const oldStatus = current.status as RewardStatus;
    const bucket = bucketForStatus(oldStatus);
    const summaryRef = db.collection("referralSummaries").doc(current.referrerCarrierId);

    transaction.create(holdRef, {
      rewardId: rewardRef.id,
      referrerCarrierId: current.referrerCarrierId,
      referredCarrierId: current.referredCarrierId,
      type: "dispute_hold",
      amountCents: -net,
      currency: current.currency,
      stripeDisputeId: dispute.id,
      stripeChargeId: chargeId,
      sourceEventId: eventId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(rewardRef, { status: "held", disputeId: dispute.id, disputeHeldCents: net, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const summaryUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (oldStatus !== "held") {
      summaryUpdate.heldCents = admin.firestore.FieldValue.increment(net);
      if (bucket) summaryUpdate[bucket] = admin.firestore.FieldValue.increment(-net);
    }
    transaction.set(summaryRef, summaryUpdate, { merge: true });
  });

  await pendingRef.delete();
}

export async function resolveRewardDispute(
  db: FirebaseFirestore.Firestore,
  eventId: string,
  dispute: Stripe.Dispute
): Promise<void> {
  const chargeId = stringId(dispute.charge);
  if (!chargeId) return;
  const rewardSnapshot = await findRewardForCharge(db, chargeId);
  if (!rewardSnapshot) {
    await db.collection("referralPendingDisputes").doc(chargeId).set({
      stripeChargeId: chargeId,
      stripeDisputeId: dispute.id,
      disputeStatus: dispute.status,
      resolutionEventId: eventId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  const rewardRef = rewardSnapshot.ref;
  const resolutionRef = db.collection("referralRewardAdjustments").doc(`dispute_resolution_${dispute.id}`);

  await db.runTransaction(async transaction => {
    const existingResolution = await transaction.get(resolutionRef);
    const currentSnapshot = await transaction.get(rewardRef);
    if (!currentSnapshot.exists) return;
    const current = currentSnapshot.data()!;
    if (existingResolution.exists) {
      // Self-heal records created by older code that marked a lost dispute as
      // reversed without zeroing the financial balance. Do not touch summary
      // totals because the original atomic resolution already moved them.
      if (dispute.status === "lost" &&
          (Number(current.netRewardCents ?? 0) !== 0 ||
           Number(current.adjustedCents ?? 0) !== -Number(current.originalRewardCents ?? 0))) {
        transaction.update(rewardRef, {
          status: "reversed",
          netRewardCents: 0,
          adjustedCents: -Number(current.originalRewardCents ?? 0),
          disputeStatus: dispute.status,
          disputeHeldCents: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return;
    }
    if (current.disputeId !== dispute.id) return;
    const heldCents = Math.max(0, Number(current.disputeHeldCents ?? 0));
    if (heldCents <= 0) return;
    const won = dispute.status === "won" || dispute.status === "warning_closed" || dispute.status === "prevented";
    const nextStatus: RewardStatus = won
      ? ((current.availableAt as admin.firestore.Timestamp).toMillis() <= Date.now() ? "available" : "pending")
      : "reversed";
    const summaryRef = db.collection("referralSummaries").doc(current.referrerCarrierId);
    const summaryUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      heldCents: admin.firestore.FieldValue.increment(-heldCents),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (won) {
      const nextBucket = bucketForStatus(nextStatus)!;
      summaryUpdate[nextBucket] = admin.firestore.FieldValue.increment(heldCents);
    } else {
      summaryUpdate.reversedCents = admin.firestore.FieldValue.increment(heldCents);
    }
    transaction.create(resolutionRef, {
      rewardId: rewardRef.id,
      referrerCarrierId: current.referrerCarrierId,
      referredCarrierId: current.referredCarrierId,
      type: won ? "dispute_restored" : "dispute_lost",
      amountCents: won ? heldCents : 0,
      currency: current.currency,
      stripeDisputeId: dispute.id,
      stripeChargeId: chargeId,
      sourceEventId: eventId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const rewardUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      status: nextStatus,
      disputeStatus: dispute.status,
      disputeHeldCents: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!won) {
      rewardUpdate.netRewardCents = Math.max(
        0,
        Number(current.netRewardCents ?? 0) - heldCents
      );
      rewardUpdate.adjustedCents =
        admin.firestore.FieldValue.increment(-heldCents);
    }
    transaction.update(rewardRef, rewardUpdate);
    transaction.set(summaryRef, summaryUpdate, { merge: true });
    if (nextStatus === "reversed" || nextStatus === "available") transaction.delete(db.collection("referralRewardMaturities").doc(rewardRef.id));
  });
}

export const matureReferralRewards = onSchedule(
  { region: "us-central1", schedule: "every day 03:15", timeZone: "America/Los_Angeles" },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const maturities = await db.collection("referralRewardMaturities")
      .where("availableAt", "<=", now).orderBy("availableAt").limit(400).get();

    for (const maturity of maturities.docs) {
      await db.runTransaction(async transaction => {
        const rewardRef = db.collection("referralRewards").doc(maturity.id);
        const rewardSnapshot = await transaction.get(rewardRef);
        if (!rewardSnapshot.exists) { transaction.delete(maturity.ref); return; }
        const reward = rewardSnapshot.data()!;
        if (reward.status !== "pending" && reward.status !== "held") { transaction.delete(maturity.ref); return; }
        if (reward.disputeHeldCents > 0) return;
        const referrerSnapshot = await transaction.get(db.collection("carriers").doc(reward.referrerCarrierId));
        const referrer = referrerSnapshot.data();
        // Rewards that qualified while the account was in good standing remain
        // earned after a later cancellation. Only deletion or a review hold
        // prevents automatic maturity.
        const requiresReview = !referrerSnapshot.exists ||
          referrer?.deletionInProgress === true ||
          referrer?.referralProgramSuspended === true;
        if (requiresReview) {
          if (reward.status !== "held") {
            transaction.update(rewardRef, { status: "held", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            transaction.set(db.collection("referralSummaries").doc(reward.referrerCarrierId), {
              pendingCents: admin.firestore.FieldValue.increment(-reward.netRewardCents),
              heldCents: admin.firestore.FieldValue.increment(reward.netRewardCents),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }
          transaction.update(maturity.ref, { availableAt: admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000) });
          return;
        }
        transaction.update(rewardRef, { status: "available", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        transaction.set(db.collection("referralSummaries").doc(reward.referrerCarrierId), {
          [reward.status === "held" ? "heldCents" : "pendingCents"]: admin.firestore.FieldValue.increment(-reward.netRewardCents),
          availableCents: admin.firestore.FieldValue.increment(reward.netRewardCents),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.delete(maturity.ref);
      });
    }
  }
);

export const getReferralDashboard = onCall(
  { region: "us-central1" },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const db = admin.firestore();
    const carrierId = request.auth.uid;
    const [carrierSnapshot, codeSnapshot, summarySnapshot, rewardsSnapshot] = await Promise.all([
      db.collection("carriers").doc(carrierId).get(),
      db.collection("carrierReferralCodes").doc(carrierId).get(),
      db.collection("referralSummaries").doc(carrierId).get(),
      db.collection("referralRewards").where("referrerCarrierId", "==", carrierId).limit(100).get(),
    ]);
    if (!carrierSnapshot.exists) {
      throw new HttpsError("not-found", "Your company account could not be found.");
    }
    if (carrierSnapshot.data()?.deletingAccount === true) {
      throw new HttpsError("failed-precondition", "Account deletion is already in progress.");
    }
    const rewards = rewardsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        netRewardCents: data.netRewardCents,
        currency: data.currency,
        paidAt: data.paidAt?.toMillis?.() ?? null,
        availableAt: data.availableAt?.toMillis?.() ?? null,
      };
    }).sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
    const summary = summarySnapshot.data() ?? {};
    return {
      code: codeSnapshot.data()?.code ?? null,
      summary: {
        directReferralCount: Number(summary.directReferralCount ?? 0),
        pendingCents: Number(summary.pendingCents ?? 0),
        heldCents: Number(summary.heldCents ?? 0),
        availableCents: Number(summary.availableCents ?? 0),
        paidCents: Number(summary.paidCents ?? 0),
        reversedCents: Number(summary.reversedCents ?? 0),
        lifetimeEarnedCents: Number(summary.lifetimeEarnedCents ?? 0),
        currency: typeof summary.currency === "string" ? summary.currency : "usd",
      },
      rewards,
      minimumPayoutCents: REFERRAL_MINIMUM_PAYOUT_CENTS,
      holdDays: REFERRAL_HOLD_DAYS,
      termsVersion: REFERRAL_TERMS_VERSION,
    };
  }
);
