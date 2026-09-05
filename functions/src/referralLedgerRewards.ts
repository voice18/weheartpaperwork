import * as admin from "firebase-admin";
import Stripe from "stripe";
import { randomUUID, createHash } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { calculateRewardCents, REFERRAL_HOLD_DAYS, REFERRAL_MINIMUM_PAYOUT_CENTS, REFERRAL_TERMS_VERSION } from "./referralPolicy";
import { appendLedger, entitlementDelta, Bucket } from "./referralAccounting";
import { eligibilityAt } from "./referralEligibility";

export function stringId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}
function subscriptionId(invoice: Stripe.Invoice): string | null {
  return stringId(invoice.parent?.subscription_details?.subscription);
}
export async function queueReferralReview(db: FirebaseFirestore.Firestore, id: string, data: FirebaseFirestore.DocumentData): Promise<void> {
  await db.collection("referralReviewQueue").doc(id).set({ ...data, status: "open",
    updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

/** Fail closed for mixed invoices. Tax consumes received cash before rewards;
 * customer balance credits and manually marked-paid invoices are not cash. */
export function qualifyingInvoiceCents(invoice: Stripe.Invoice, lines: Stripe.InvoiceLineItem[], prices: string[]): number {
  if (invoice.status !== "paid" || invoice.amount_paid <= 0 || !subscriptionId(invoice)) return 0;
  if (invoice.currency !== "usd" || invoice.total_excluding_tax == null) throw new Error("Missing USD/pretax evidence.");
  for (const line of lines) {
    if (!line.amount) continue;
    const price = stringId(line.pricing?.price_details?.price);
    if (!price || !prices.includes(price) || !line.parent?.subscription_item_details) throw new Error("Mixed/unapproved subscription invoice.");
  }
  const tax = Math.max(0, invoice.total - invoice.total_excluding_tax);
  return Math.max(0, Math.min(invoice.total_excluding_tax, invoice.amount_paid - tax));
}

type Evidence = {
  cashCents: number; refundCents: number; disputeCents: number; openDispute: boolean; fraud: boolean;
  chargeIds: string[]; paymentIntentIds: string[]; invoicePaymentIds: string[];
  refundIds: string[]; disputeIds: string[]; creditNoteIds: string[];
};
async function paymentEvidence(stripe: Stripe, invoice: Stripe.Invoice): Promise<Evidence> {
  const e: Evidence = { cashCents: 0, refundCents: 0, disputeCents: 0, openDispute: false, fraud: false,
    chargeIds: [], paymentIntentIds: [], invoicePaymentIds: [], refundIds: [], disputeIds: [], creditNoteIds: [] };
  const refunds = new Map<string, number>();
  for await (const payment of stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 100 })) {
    const pi = stringId(payment.payment.payment_intent);
    let chargeId = stringId(payment.payment.charge);
    if (pi) {
      e.paymentIntentIds.push(pi);
      const intent = await stripe.paymentIntents.retrieve(pi);
      if (intent.status !== "succeeded") throw new Error("Unsuccessful invoice PaymentIntent.");
      chargeId = stringId(intent.latest_charge);
    }
    if (!chargeId || e.chargeIds.includes(chargeId)) throw new Error("Unsupported/shared payment allocation.");
    const charge = await stripe.charges.retrieve(chargeId);
    if (!charge.paid || !charge.captured || charge.currency !== invoice.currency || payment.amount_paid !== charge.amount) throw new Error("Unsupported charge allocation.");
    e.cashCents += charge.amount;
    e.chargeIds.push(chargeId);
    e.invoicePaymentIds.push(payment.id);
    let refunded = 0;
    for await (const refund of stripe.refunds.list({ charge: chargeId, limit: 100 })) {
      if (refund.status !== "succeeded") continue;
      refunds.set(refund.id, refund.amount);
      e.refundIds.push(refund.id);
      refunded += refund.amount;
    }
    e.refundCents += refunded;
    let lost = 0;
    for await (const dispute of stripe.disputes.list({ charge: chargeId, limit: 100 })) {
      e.disputeIds.push(dispute.id);
      if (dispute.status === "lost") lost += dispute.amount;
      else if (!["won", "warning_closed", "prevented"].includes(dispute.status)) e.openDispute = true;
    }
    e.disputeCents += Math.min(lost, Math.max(0, charge.amount - refunded));
    if (charge.fraud_details?.user_report === "fraudulent" || charge.fraud_details?.stripe_report === "fraudulent") e.fraud = true;
  }
  for await (const note of stripe.creditNotes.list({ invoice: invoice.id, limit: 100 })) {
    if (note.status !== "issued" || note.type !== "post_payment") continue;
    e.creditNoteIds.push(note.id);
    let linked = 0;
    for (const link of note.refunds) {
      const id = stringId(link.refund);
      if (id) linked += Math.min(link.amount_refunded, refunds.get(id) ?? 0);
    }
    e.refundCents += Math.max(0, note.post_payment_amount - linked);
  }
  return e;
}

async function carrierForInvoice(db: FirebaseFirestore.Firestore, stripe: Stripe, invoice: Stripe.Invoice): Promise<string | null> {
  const metadataId = invoice.parent?.subscription_details?.metadata?.carrierId;
  if (metadataId) return metadataId;
  const subId = subscriptionId(invoice);
  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId);
    if (sub.metadata.carrierId) return sub.metadata.carrierId;
  }
  const customer = stringId(invoice.customer);
  if (!customer) return null;
  const archived = await db.collection("referralBillingIdentities").doc(customer).get();
  if (archived.exists) return archived.data()!.carrierId;
  const matches = await db.collection("carriers").where("billing.stripeCustomerId", "==", customer).limit(2).get();
  if (matches.size > 1) throw new Error("Ambiguous Stripe customer ownership.");
  return matches.docs[0]?.id ?? null;
}

/** Invoice-level serialization plus cumulative reconciliation handles distinct
 * events for the same payment, duplicates, and refunds arriving before paid. */
export async function recordReferralRewardForPaidInvoice(db: FirebaseFirestore.Firestore, stripe: Stripe,
  eventId: string, _eventCreated: number, eventInvoice: Pick<Stripe.Invoice, "id">, prices: string[] = []): Promise<void> {
  const invoiceId = eventInvoice.id;
  const lockRef = db.collection("referralInvoiceLocks").doc(invoiceId);
  const token = randomUUID();
  await db.runTransaction(async tx => {
    const lock = (await tx.get(lockRef)).data();
    if (lock?.expiresAt?.toMillis() > Date.now()) throw new Error("Invoice reconciliation busy; retry.");
    tx.set(lockRef, { token, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 240000) });
  });
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status !== "paid" || !subscriptionId(invoice)) return;
    const rewardRef = db.collection("referralRewards").doc(invoiceId);
    const previous = (await rewardRef.get()).data();
    const referredCarrierId = previous?.referredCarrierId ?? await carrierForInvoice(db, stripe, invoice);
    if (!referredCarrierId) {
      await queueReferralReview(db, invoiceId, { stripeInvoiceId: invoiceId, sourceEventId: eventId, reason: "Cannot resolve carrier" }); return;
    }
    const referralRef = db.collection("referrals").doc(referredCarrierId);
    let referral = (await referralRef.get()).data();
    const correctionVersion = referral?.correctionAuditId ?? null;
    const invoicePaidMillis = (invoice.status_transitions.paid_at ?? 0) * 1000;
    // Late delivery must use the attribution effective when payment occurred,
    // not the newest administrative correction.
    let corrections = 0;
    while (!previous && referral?.correctedAt?.toMillis() > invoicePaidMillis) {
      if (++corrections > 50) throw new Error("Attribution history requires review.");
      const correction = await db.collection("referralAdminAudit").doc(referral!.correctionAuditId).get();
      if (!correction.data()?.before) throw new Error("Missing immutable attribution correction history.");
      referral = correction.data()!.before;
    }
    if (!previous && !referral) return;
    const referrerCarrierId = previous?.referrerCarrierId ?? referral!.referrerCarrierId;
    const review = async (reason: string) => queueReferralReview(db, invoiceId, {
      stripeInvoiceId: invoiceId, referrerCarrierId, sourceEventId: eventId, reason,
    });
    if (previous && previous.schemaVersion !== 2) { await review("Legacy reward needs opening journal migration"); return; }
    const config = (await db.collection("referralProgram").doc("current").get()).data();
    if (config?.ledgerVersion !== 2 || !config.accountingActivatedAt) { await review("Accounting activation/migration required"); return; }
    const paidMillis = (invoice.status_transitions.paid_at ?? 0) * 1000;
    if (!paidMillis) throw new Error("Missing paid timestamp.");
    const terms = previous ?? referral!;
    const rate = terms.commissionRateBps;
    if (referrerCarrierId === referredCarrierId || !Number.isInteger(rate) || rate <= 0 || rate > 10000) throw new Error("Invalid attribution/rate.");
    const lines: Stripe.InvoiceLineItem[] = [];
    for await (const line of stripe.invoices.listLineItems(invoice.id, { limit: 100 })) lines.push(line);
    let gross: number;
    let e: Evidence;
    try {
      const allowed = [...prices, ...(Array.isArray(config.allowedHistoricalPriceIds) ? config.allowedHistoricalPriceIds : [])];
      gross = qualifyingInvoiceCents(invoice, lines, allowed);
      e = await paymentEvidence(stripe, invoice);
      const tax = Math.max(0, invoice.total - (invoice.total_excluding_tax ?? 0));
      gross = Math.max(0, Math.min(gross, e.cashCents - tax));
    } catch (error) { await review(String(error)); return; }
    const originalGross = previous?.qualifyingCents ?? gross;
    const cash = previous?.grossPaymentCents ?? e.cashCents;
    const removed = Math.min(cash, e.refundCents + e.disputeCents);
    const retained = cash > 0 ? Number(BigInt(originalGross) * BigInt(Math.max(0, cash - removed)) / BigInt(cash)) : 0;
    const fraudFlags = await Promise.all(e.chargeIds.map(id => db.collection("referralFraudFlags").doc(id).get()));
    const fraudReview = fraudFlags.some(flag => flag.data()?.active === true);
    let net = e.fraud || previous?.fraudRejected ? 0 : calculateRewardCents(retained, rate);
    const originalReward = previous?.originalRewardCents ?? calculateRewardCents(originalGross, rate);
    const referrerRef = db.collection("carriers").doc(referrerCarrierId);
    const referrer = (await referrerRef.get()).data();
    const referred = (await db.collection("carriers").doc(referredCarrierId).get()).data();
    let reviewReason: string | null = null;
    if (!previous) {
      if (referral!.claimedAt?.toMillis() > paidMillis || referral!.status !== "active") return;
      if (paidMillis < config.accountingActivatedAt.toMillis()) reviewReason = "Historical payment eligibility requires review";
      if (referrer?.deletingAccount || referred?.deletingAccount) reviewReason = "Payment-time eligibility requires review";
      if (!originalReward) return;
    }
    let eligibilityReview = previous?.eligibilityReview === true;
    if (!previous || eligibilityReview) {
      const states = await Promise.all([eligibilityAt(db, referrerCarrierId, paidMillis), eligibilityAt(db, referredCarrierId, paidMillis)]);
      if (states.includes("ineligible")) {
        net = 0;
        reviewReason = "Subscription/account participation was ineligible at payment time";
      } else if (states.includes("unknown")) {
        reviewReason = "Missing or ambiguous payment-time participation history";
      } else if (paidMillis >= config.accountingActivatedAt.toMillis()) {
        reviewReason = null;
        eligibilityReview = false;
      }
    }
    const availableAt = previous?.availableAt ?? admin.firestore.Timestamp.fromMillis(paidMillis + REFERRAL_HOLD_DAYS * 86400000);
    const held = e.openDispute || fraudReview || referrer?.referralProgramSuspended === true || !!reviewReason || eligibilityReview;
    const bucket: Bucket = held ? "held" : availableAt.toMillis() <= Date.now() ? "available" : "pending";
    if (reviewReason) await review(reviewReason);
    const fingerprint = createHash("sha256").update(JSON.stringify({ net, bucket, e, fraudReview })).digest("hex");
    await db.runTransaction(async tx => {
      const [lock, snapshot, referrerNow, referralNow] = await Promise.all([tx.get(lockRef), tx.get(rewardRef), tx.get(referrerRef), tx.get(referralRef)]);
      if (lock.data()?.token !== token || lock.data()!.expiresAt.toMillis() <= Date.now()) throw new Error("Invoice lease expired.");
      const current = snapshot.data();
      if (current?.fingerprint === fingerprint) {
        tx.update(rewardRef, { lastReconciledAt: admin.firestore.FieldValue.serverTimestamp() });
        return;
      }
      if (current && current.revision !== previous?.revision) throw new Error("Reward changed during Stripe reconciliation; retry.");
      if (!current && (referralNow.data()?.correctionAuditId ?? null) !== correctionVersion) throw new Error("Attribution changed during reconciliation.");
      if (referrerNow.data()?.deletingAccount && !held) throw new Error("Deletion raced with reward reconciliation.");
      const revision = (current?.revision ?? 0) + 1;
      const oldNet = current?.netRewardCents ?? 0;
      const deltas = entitlementDelta(current?.bucket ?? "pending", oldNet, bucket, net);
      if (!current) deltas.lifetimeEarnedCents = originalReward;
      deltas.reversedCents = oldNet - net + (!current ? originalReward : 0);
      const settled = current?.settledCents ?? 0;
      const status = net === 0 ? "reversed" : bucket === "available" && settled >= net ? "paid" : bucket;
      const row = {
        schemaVersion: 2, referrerCarrierId, referredCarrierId, referralCode: terms.referralCode,
        referralTermsVersion: terms.referralTermsVersion ?? terms.termsVersion ?? REFERRAL_TERMS_VERSION,
        commissionRateBps: rate, qualifyingCents: originalGross, grossPaymentCents: cash,
        originalRewardCents: originalReward, netRewardCents: net, adjustedCents: net - originalReward,
        currency: "usd", bucket, status, revision, fingerprint, eligibilityReview: !!reviewReason || eligibilityReview,
        stripeOpenDispute: e.openDispute, stripeFraud: e.fraud || fraudReview,
        fraudRejected: current?.fraudRejected === true, lastReconciledAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeInvoiceId: invoiceId, stripeSubscriptionId: subscriptionId(invoice), stripeCustomerId: stringId(invoice.customer),
        stripeChargeIds: e.chargeIds, stripePaymentIntentIds: e.paymentIntentIds, sourceEventId: eventId,
        paidAt: admin.firestore.Timestamp.fromMillis(paidMillis), availableAt,
        reservedCents: current?.reservedCents ?? 0, settledCents: settled,
        createdAt: current?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      appendLedger(db, tx, `${invoiceId}_${revision}`, referrerCarrierId, deltas, {
        type: current ? "reconcile" : "earn", rewardId: invoiceId, referredCarrierId, sourceEventId: eventId,
        stripeInvoiceId: invoiceId, evidence: e, grossQualifyingPaymentCents: originalGross,
        retainedQualifyingCents: retained, commissionRateBps: rate, rewardAmountCents: net - oldNet, status,
        reversalOf: current && net < oldNet ? `${invoiceId}_1` : null,
        previousRevision: current?.revision ?? null, payoutBatchId: null, projection: row,
      });
      tx.set(rewardRef, row);
      if (!reviewReason && !eligibilityReview) tx.set(db.collection("referralReviewQueue").doc(invoiceId), {
        status: "resolved", referrerCarrierId, stripeInvoiceId: invoiceId, sourceEventId: eventId,
        resolution: "Reconciled with Stripe and participation history", updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      const maturityRef = db.collection("referralRewardMaturities").doc(invoiceId);
      if (bucket === "pending") tx.set(maturityRef, { availableAt }); else tx.delete(maturityRef);
    });
  } finally {
    await db.runTransaction(async tx => { if ((await tx.get(lockRef)).data()?.token === token) tx.delete(lockRef); });
  }
}

export async function reconcileReferralCharge(db: FirebaseFirestore.Firestore, stripe: Stripe, eventId: string, chargeId: string, prices: string[]): Promise<void> {
  const charge = await stripe.charges.retrieve(chargeId);
  const ids = new Set<string>();
  const rewards = await db.collection("referralRewards").where("stripeChargeIds", "array-contains", chargeId).get();
  rewards.docs.forEach(doc => ids.add(doc.id));
  const pi = stringId(charge.payment_intent);
  if (pi) {
    for await (const payment of stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: pi }, limit: 100 })) {
      const id = stringId(payment.invoice); if (id) ids.add(id);
    }
  }
  if (!ids.size) await queueReferralReview(db, chargeId, { stripeChargeId: chargeId, sourceEventId: eventId, reason: "Unmapped charge; reconcile invoice before closing review" });
  for (const id of ids) await recordReferralRewardForPaidInvoice(db, stripe, eventId, 0, { id }, prices);
}

export const matureReferralRewards = onSchedule({ region: "us-central1", schedule: "every 60 minutes", timeoutSeconds: 300 }, async () => {
  const db = admin.firestore();
  const due = await db.collection("referralRewardMaturities").where("availableAt", "<=", admin.firestore.Timestamp.now()).orderBy("availableAt").limit(300).get();
  for (const item of due.docs) {
    await db.runTransaction(async tx => {
      const ref = db.collection("referralRewards").doc(item.id);
      const current = (await tx.get(ref)).data();
      if (!current || current.schemaVersion !== 2 || current.bucket !== "pending") { tx.delete(item.ref); return; }
      if (current.availableAt.toMillis() > Date.now()) return;
      const carrier = (await tx.get(db.collection("carriers").doc(current.referrerCarrierId))).data();
      // Maturity is also an accounting close: require a recent authoritative
      // Stripe refresh instead of trusting 30-day-old payment evidence.
      const stale = !current.lastReconciledAt || Date.now() - current.lastReconciledAt.toMillis() > 24 * 60 * 60 * 1000;
      const bucket: Bucket = !carrier || carrier.deletingAccount || carrier.referralProgramSuspended || current.eligibilityReview || stale ? "held" : "available";
      const revision = current.revision + 1;
      const projection = { ...current, bucket, status: bucket, revision, fingerprint: null };
      appendLedger(db, tx, `${item.id}_${revision}`, current.referrerCarrierId,
        entitlementDelta("pending", current.netRewardCents, bucket, current.netRewardCents),
        { type: "maturity", rewardId: item.id, referredCarrierId: current.referredCarrierId, rewardAmountCents: 0, status: bucket, projection, payoutBatchId: null });
      tx.update(ref, projection);
      if (stale) tx.set(db.collection("referralReviewQueue").doc(item.id), {
        status: "open", referrerCarrierId: current.referrerCarrierId, stripeInvoiceId: item.id,
        reason: "Stripe reconciliation required at 30-day maturity",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      // Held entries leave the queue; they cannot starve other maturing rewards.
      tx.delete(item.ref);
    });
  }
});

export const getReferralDashboard = onCall({ region: "us-central1" }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
  const db = admin.firestore(), uid = request.auth.uid;
  const [code, summary, count, program] = await Promise.all([
    db.collection("carrierReferralCodes").doc(uid).get(), db.collection("referralBalances").doc(uid).get(),
    db.collection("referrals").where("referrerCarrierId", "==", uid).count().get(), db.collection("referralProgram").doc("current").get(),
  ]);
  const data = summary.data() ?? {};
  const fields = ["pendingCents", "heldCents", "availableCents", "reservedCents", "paidCents", "reversedCents", "lifetimeEarnedCents"];
  return { code: code.data()?.code ?? null,
    summary: { ...Object.fromEntries(fields.map(key => [key, Number(data[key] ?? 0)])), currency: "usd", directReferralCount: count.data().count },
    accountingActive: program.data()?.ledgerVersion === 2, payoutsActive: program.data()?.payoutsEnabled === true,
    minimumPayoutCents: REFERRAL_MINIMUM_PAYOUT_CENTS, holdDays: REFERRAL_HOLD_DAYS, termsVersion: REFERRAL_TERMS_VERSION };
});
