import * as admin from "firebase-admin";
import Stripe from "stripe";

/** Append Stripe's event-time state, even when events arrive out of order.
 * Current billing state is not evidence of eligibility for an older payment. */
export async function recordReferralParticipation(db: FirebaseFirestore.Firestore, event: Stripe.Event): Promise<void> {
  if (!event.type.startsWith("customer.subscription.")) return;
  const subscription = event.data.object as Stripe.Subscription;
  let carrierId = subscription.metadata?.carrierId;
  if (!carrierId) {
    const matches = await db.collection("carriers").where("billing.stripeSubscriptionId", "==", subscription.id).limit(2).get();
    if (matches.size !== 1) return;
    carrierId = matches.docs[0].id;
  }
  const ref = db.collection("referralParticipationEvents").doc(event.id);
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { carrierId, stripeSubscriptionId: subscription.id, status: subscription.status,
      effectiveAt: admin.firestore.Timestamp.fromMillis(event.created * 1000), sourceEventId: event.id,
      recordedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

export async function eligibilityAt(db: FirebaseFirestore.Firestore, carrierId: string, paidAt: number): Promise<"eligible" | "ineligible" | "unknown"> {
  const closure = (await db.collection("referralAccountClosures").doc(carrierId).get()).data();
  if (closure?.closedAt?.toMillis() <= paidAt) return "ineligible";
  const history = await db.collection("referralParticipationEvents").where("carrierId", "==", carrierId)
    .where("effectiveAt", "<=", admin.firestore.Timestamp.fromMillis(paidAt)).orderBy("effectiveAt", "desc").limit(500).get();
  if (history.empty || history.size === 500) return "unknown";
  const latest = new Map<string, { time: number; status: string; ambiguous: boolean }>();
  for (const doc of history.docs) {
    const row = doc.data(), time = row.effectiveAt.toMillis();
    const prior = latest.get(row.stripeSubscriptionId);
    if (!prior || time > prior.time) latest.set(row.stripeSubscriptionId, { time, status: row.status, ambiguous: false });
    else if (time === prior.time && row.status !== prior.status) prior.ambiguous = true;
  }
  const states = [...latest.values()];
  if (states.some(row => row.ambiguous)) return "unknown";
  return states.some(row => ["active", "trialing"].includes(row.status)) ? "eligible" : "ineligible";
}
