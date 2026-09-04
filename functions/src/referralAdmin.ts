import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { appendLedger, entitlementDelta, Bucket } from "./referralAccounting";
import { canPay } from "./referralPolicy";
import { recordReferralRewardForPaidInvoice } from "./referralLedgerRewards";

function administrator(request: CallableRequest): string {
  if (!request.auth || request.auth.token.referralAdmin !== true) throw new HttpsError("permission-denied", "Referral administrator required.");
  if (Date.now() / 1000 - Number(request.auth.token.auth_time ?? 0) > 900) throw new HttpsError("unauthenticated", "Sign in again before administering financial records.");
  return request.auth.uid;
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", "Invalid record ID.");
  return value;
}
function explanation(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 10 || value.length > 1000) throw new HttpsError("invalid-argument", "Provide a documented reason/reference (10–1000 characters).");
  return value.trim();
}
function audit(db: FirebaseFirestore.Firestore, tx: FirebaseFirestore.Transaction, id: string, data: FirebaseFirestore.DocumentData): void {
  tx.create(db.collection("referralAdminAudit").doc(id), { ...data, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

/** Stable document-ID pagination, with no unordered limit-and-client-sort. */
export const referralAdminReport = onCall({ region: "us-central1" }, async request => {
  administrator(request);
  const names: Record<string, string> = { balances: "referralBalances", ledger: "referralLedger", rewards: "referralRewards",
    payouts: "referralPayouts", reviews: "referralReviewQueue", referrals: "referrals", audit: "referralAdminAudit" };
  const name = names[request.data?.kind];
  if (!name) throw new HttpsError("invalid-argument", "Unknown report.");
  let query: FirebaseFirestore.Query = admin.firestore().collection(name);
  if (request.data?.carrierId) query = query.where("referrerCarrierId", "==", identifier(request.data.carrierId));
  query = query.orderBy(admin.firestore.FieldPath.documentId());
  if (request.data?.cursor) query = query.startAfter(identifier(request.data.cursor));
  const page = await query.limit(200).get();
  return { rows: page.docs.map(doc => ({ id: doc.id, ...doc.data() })), nextCursor: page.size === 200 ? page.docs[199].id : null };
});

const stripeKey = defineSecret("STRIPE_SECRET_KEY");
const companyPrice = defineSecret("STRIPE_COMPANY_PRICE_ID");
const driverPrice = defineSecret("STRIPE_DRIVER_PRICE_ID");
export const reconcileReferralInvoice = onCall({ region: "us-central1", timeoutSeconds: 120,
  secrets: [stripeKey, companyPrice, driverPrice] }, async request => {
  const actor = administrator(request), id = identifier(request.data?.invoiceId);
  const reason = explanation(request.data?.reason);
  const db = admin.firestore();
  await db.collection("referralAdminAudit").add({ actor, action: "reconcile_requested", stripeInvoiceId: id, reason,
    createdAt: admin.firestore.FieldValue.serverTimestamp() });
  await recordReferralRewardForPaidInvoice(db, new Stripe(stripeKey.value()), `admin_${identifier(request.data?.operationId)}`,
    0, { id }, [companyPrice.value(), driverPrice.value()]);
  const reward = await db.collection("referralRewards").doc(id).get();
  return { reward: reward.data() ?? null };
});

export const prepareReferralPayout = onCall({ region: "us-central1" }, async request => {
  const actor = administrator(request), carrierId = identifier(request.data?.carrierId), id = identifier(request.data?.batchId);
  const reason = explanation(request.data?.reason);
  const ids: string[] = request.data?.rewardIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || new Set(ids).size !== ids.length) throw new HttpsError("invalid-argument", "Choose 1–100 distinct invoice reward IDs.");
  ids.forEach(identifier);
  const db = admin.firestore(), batchRef = db.collection("referralPayouts").doc(id);
  return db.runTransaction(async tx => {
    const existing = await tx.get(batchRef);
    if (existing.exists) {
      if (existing.data()!.referrerCarrierId !== carrierId || JSON.stringify(existing.data()!.requestedRewardIds) !== JSON.stringify(ids)) throw new HttpsError("already-exists", "Batch ID already has different instructions.");
      return { id, ...existing.data() };
    }
    const [program, payee, balance, carrier, reviews, ...rewards] = await Promise.all([
      tx.get(db.collection("referralProgram").doc("current")), tx.get(db.collection("referralPayees").doc(carrierId)),
      tx.get(db.collection("referralBalances").doc(carrierId)), tx.get(db.collection("carriers").doc(carrierId)),
      tx.get(db.collection("referralReviewQueue").where("referrerCarrierId", "==", carrierId).where("status", "==", "open").limit(1)),
      ...ids.map(rewardId => tx.get(db.collection("referralRewards").doc(rewardId))),
    ]);
    if (program.data()?.payoutsEnabled !== true || program.data()?.ledgerVersion !== 2) throw new HttpsError("failed-precondition", "Payouts are not activated.");
    if (payee.data()?.verified !== true || !payee.data()?.destinationReference || !(payee.data()?.validUntil?.toMillis() > Date.now())) throw new HttpsError("failed-precondition", "Verify payment destination, company ownership and tax requirements first.");
    if ((!carrier.exists && payee.data()?.allowClosedAccountPayout !== true) || carrier.data()?.deletingAccount || carrier.data()?.referralProgramSuspended || !reviews.empty) throw new HttpsError("failed-precondition", "Resolve account/reward reviews before payout.");
    const totals = balance.data() ?? {};
    if (!canPay(totals.availableCents ?? 0, totals.reservedCents ?? 0)) throw new HttpsError("failed-precondition", "At least $25 net available and no outstanding payout reservation are required.");
    let remaining = totals.availableCents;
    const allocations: { rewardId: string; amountCents: number }[] = [];
    for (const reward of rewards) {
      const row = reward.data();
      if (!row || row.schemaVersion !== 2 || row.referrerCarrierId !== carrierId || row.currency !== "usd" || row.bucket !== "available" || row.eligibilityReview || row.fraudRejected || row.stripeOpenDispute) throw new HttpsError("failed-precondition", "A selected reward is not payable.");
      if (!row.lastReconciledAt || Date.now() - row.lastReconciledAt.toMillis() > 15 * 60000) throw new HttpsError("failed-precondition", "Reconcile each selected invoice with Stripe within 15 minutes before preparing payout.");
      const amountCents = Math.min(remaining, Math.max(0, row.netRewardCents - (row.settledCents ?? 0) - (row.reservedCents ?? 0)));
      if (amountCents > 0) { allocations.push({ rewardId: reward.id, amountCents }); remaining -= amountCents; }
    }
    const amount = totals.availableCents - remaining;
    if (!canPay(amount)) throw new HttpsError("failed-precondition", "Selected rewards total less than $25 after offsets.");
    const batch = { schemaVersion: 2, referrerCarrierId: carrierId, currency: "usd", amountCents: amount, status: "reserved",
      requestedRewardIds: ids, allocations, destinationReference: payee.data()!.destinationReference,
      preparedBy: actor, reason, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    tx.create(batchRef, batch);
    for (const item of allocations) tx.update(db.collection("referralRewards").doc(item.rewardId), {
      reservedCents: admin.firestore.FieldValue.increment(item.amountCents), payoutBatchIds: admin.firestore.FieldValue.arrayUnion(id),
    });
    appendLedger(db, tx, `payout_${id}_reserved`, carrierId, { availableCents: -amount, reservedCents: amount },
      { type: "payout_reserved", payoutBatchId: id, allocations, actor, status: "reserved", rewardAmountCents: 0 });
    audit(db, tx, `payout_${id}_reserved`, { actor, action: "payout_reserved", payoutBatchId: id, reason });
    return { id, ...batch };
  });
});

export const transitionReferralPayout = onCall({ region: "us-central1" }, async request => {
  const actor = administrator(request), id = identifier(request.data?.batchId), reason = explanation(request.data?.reason);
  const action = request.data?.action;
  if (!["sending", "paid", "cancel", "confirmed_not_sent"].includes(action)) throw new HttpsError("invalid-argument", "Unknown payout action.");
  const db = admin.firestore(), ref = db.collection("referralPayouts").doc(id);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), row = snapshot.data();
    if (!row) throw new HttpsError("not-found", "Payout not found.");
    const target = action === "cancel" || action === "confirmed_not_sent" ? "canceled" : action;
    if (row.status === target) {
      if (target === "paid" && row.transferReference !== request.data?.transferReference) throw new HttpsError("already-exists", "Transfer evidence differs from settled payout.");
      return { id, status: row.status };
    }
    const allowed = (row.status === "reserved" && ["sending", "cancel"].includes(action)) ||
      (row.status === "sending" && ["paid", "confirmed_not_sent"].includes(action));
    if (!allowed) throw new HttpsError("failed-precondition", "Invalid payout transition. Never resend an ambiguous transfer.");
    let transferReference: string | null = null;
    if (action === "paid") transferReference = explanation(request.data?.transferReference);
    if (action === "paid" && request.data?.amountCents !== row.amountCents) throw new HttpsError("invalid-argument", "Confirmed transfer amount must exactly match the reserved payout.");
    const transferRef = transferReference ? db.collection("referralTransferReferences").doc(createHash("sha256").update(transferReference).digest("hex")) : null;
    if (transferRef && (await tx.get(transferRef)).exists) throw new HttpsError("already-exists", "This external transfer was already recorded in another payout.");
    if (action === "confirmed_not_sent" && request.data?.noFundsSent !== true) throw new HttpsError("failed-precondition", "Confirm external evidence that no funds were sent.");
    const [balance, program, carrier, reviews, payee, ...rewards] = await Promise.all([
      tx.get(db.collection("referralBalances").doc(row.referrerCarrierId)), tx.get(db.collection("referralProgram").doc("current")),
      tx.get(db.collection("carriers").doc(row.referrerCarrierId)),
      tx.get(db.collection("referralReviewQueue").where("referrerCarrierId", "==", row.referrerCarrierId).where("status", "==", "open").limit(1)),
      tx.get(db.collection("referralPayees").doc(row.referrerCarrierId)),
      ...row.allocations.map((item: { rewardId: string }) => tx.get(db.collection("referralRewards").doc(item.rewardId))),
    ]);
    if (action === "sending") {
      if (program.data()?.payoutsEnabled !== true || (balance.data()?.availableCents ?? 0) < 0 || !reviews.empty ||
          (!carrier.exists && payee.data()?.allowClosedAccountPayout !== true) || carrier.data()?.deletingAccount || carrier.data()?.referralProgramSuspended ||
          payee.data()?.verified !== true || !(payee.data()?.validUntil?.toMillis() > Date.now()) ||
          payee.data()?.destinationReference !== row.destinationReference ||
          rewards.some(reward => reward.data()?.bucket !== "available" || !reward.data()?.lastReconciledAt || Date.now() - reward.data()!.lastReconciledAt.toMillis() > 15 * 60000)) throw new HttpsError("failed-precondition", "Reconcile selected invoices and resolve any destination change, hold or reversal before transfer.");
      tx.update(ref, { status: "sending", sendingBy: actor, sendingAt: admin.firestore.FieldValue.serverTimestamp() });
      audit(db, tx, `payout_${id}_sending`, { actor, action, payoutBatchId: id, reason });
      return { id, status: "sending", amountCents: row.amountCents, destinationReference: row.destinationReference };
    }
    for (let i = 0; i < rewards.length; i++) {
      const reward = rewards[i], data = reward.data()!, allocation = row.allocations[i];
      if (!data || (data.reservedCents ?? 0) < allocation.amountCents) throw new Error("Payout allocation invariant failed.");
      const settled = (data.settledCents ?? 0) + (action === "paid" ? allocation.amountCents : 0);
      tx.update(reward.ref, { reservedCents: data.reservedCents - allocation.amountCents, settledCents: settled,
        status: data.netRewardCents === 0 ? "reversed" : data.bucket === "available" && settled >= data.netRewardCents ? "paid" : data.bucket });
    }
    const deltas = action === "paid" ? { reservedCents: -row.amountCents, paidCents: row.amountCents } : { reservedCents: -row.amountCents, availableCents: row.amountCents };
    appendLedger(db, tx, `payout_${id}_${target}`, row.referrerCarrierId, deltas,
      { type: `payout_${target}`, payoutBatchId: id, allocations: row.allocations, actor, transferReference, status: target, rewardAmountCents: 0 });
    tx.update(ref, { status: target, transferReference, completedBy: actor, completedAt: admin.firestore.FieldValue.serverTimestamp() });
    if (transferRef) tx.create(transferRef, { payoutBatchId: id, referrerCarrierId: row.referrerCarrierId,
      amountCents: row.amountCents, currency: "usd", createdAt: admin.firestore.FieldValue.serverTimestamp() });
    audit(db, tx, `payout_${id}_${target}`, { actor, action, payoutBatchId: id, reason, transferReference });
    return { id, status: target };
  });
});

export const reviewReferralReward = onCall({ region: "us-central1" }, async request => {
  const actor = administrator(request), id = identifier(request.data?.invoiceId), operation = identifier(request.data?.operationId);
  const reason = explanation(request.data?.reason), approve = request.data?.decision === "approve";
  if (!approve && request.data?.decision !== "reject") throw new HttpsError("invalid-argument", "Choose approve or reject.");
  const db = admin.firestore(), ref = db.collection("referralRewards").doc(id);
  return db.runTransaction(async tx => {
    const [existing, snapshot] = await Promise.all([tx.get(db.collection("referralAdminAudit").doc(operation)), tx.get(ref)]);
    if (existing.exists) return { status: "already-reviewed" };
    const row = snapshot.data();
    if (!row || row.schemaVersion !== 2) throw new HttpsError("failed-precondition", "Reconcile/migrate this invoice first.");
    const carrier = (await tx.get(db.collection("carriers").doc(row.referrerCarrierId))).data();
    if (approve && (row.stripeOpenDispute || row.stripeFraud || carrier?.referralProgramSuspended)) throw new HttpsError("failed-precondition", "Stripe dispute/fraud or program suspension must be resolved first.");
    const bucket: Bucket = approve ? row.availableAt.toMillis() <= Date.now() ? "available" : "pending" : "held";
    const net = approve ? row.netRewardCents : 0, revision = row.revision + 1;
    const status = net === 0 ? "reversed" : bucket;
    const projection = { ...row, bucket, status, netRewardCents: net, adjustedCents: net - row.originalRewardCents,
      eligibilityReview: false, fraudRejected: !approve, revision, fingerprint: null };
    appendLedger(db, tx, `${id}_${revision}`, row.referrerCarrierId,
      { ...entitlementDelta(row.bucket, row.netRewardCents, bucket, net), reversedCents: row.netRewardCents - net },
      { type: "admin_review", rewardId: id, referredCarrierId: row.referredCarrierId, actor, reason, status,
        rewardAmountCents: net - row.netRewardCents, reversalOf: !approve ? `${id}_1` : null, projection });
    tx.update(ref, projection);
    tx.set(db.collection("referralReviewQueue").doc(id), { status: "resolved", decision: approve ? "approve" : "reject", actor, reason }, { merge: true });
    if (bucket === "pending") tx.set(db.collection("referralRewardMaturities").doc(id), { availableAt: row.availableAt });
    else tx.delete(db.collection("referralRewardMaturities").doc(id));
    audit(db, tx, operation, { actor, action: "reward_review", rewardId: id, reason, decision: approve ? "approve" : "reject" });
    return { status };
  });
});

/** Corrections change future attribution only. Existing invoice snapshots and
 * earnings stay with their original owner; financial corrections need review. */
export const correctReferralAttribution = onCall({ region: "us-central1" }, async request => {
  const actor = administrator(request), id = identifier(request.data?.referredCarrierId), next = identifier(request.data?.referrerCarrierId);
  const operation = identifier(request.data?.operationId), reason = explanation(request.data?.reason);
  if (id === next) throw new HttpsError("failed-precondition", "Self-referral is prohibited.");
  const db = admin.firestore(), ref = db.collection("referrals").doc(id);
  await db.runTransaction(async tx => {
    const [auditDoc, referral, owner, referred, codeOwner] = await Promise.all([
      tx.get(db.collection("referralAdminAudit").doc(operation)), tx.get(ref), tx.get(db.collection("carriers").doc(next)),
      tx.get(db.collection("carriers").doc(id)), tx.get(db.collection("carrierReferralCodes").doc(next)),
    ]);
    if (auditDoc.exists) return;
    if (!referral.exists || !owner.exists || !referred.exists || !codeOwner.data()?.active || owner.data()?.deletingAccount ||
        owner.data()?.referralProgramSuspended || owner.data()?.usdotNumber === referred.data()?.usdotNumber) throw new HttpsError("failed-precondition", "Invalid correction parties.");
    audit(db, tx, operation, { actor, action: "attribution_correction", reason, referredCarrierId: id,
      before: referral.data(), afterReferrerCarrierId: next });
    tx.update(ref, { referrerCarrierId: next, referralCode: codeOwner.data()!.code,
      correctedAt: admin.firestore.FieldValue.serverTimestamp(), correctionAuditId: operation });
  });
  return { status: "corrected" };
});
