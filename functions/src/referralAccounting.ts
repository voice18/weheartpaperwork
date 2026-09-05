import * as admin from "firebase-admin";

export type Bucket = "pending" | "held" | "available";
export type Deltas = Partial<Record<"pendingCents" | "heldCents" | "availableCents" | "reservedCents" | "paidCents" | "reversedCents" | "lifetimeEarnedCents", number>>;

export function entitlementDelta(oldBucket: Bucket, oldNet: number, newBucket: Bucket, newNet: number): Deltas {
  const result: Deltas = {};
  result[`${oldBucket}Cents`] = -oldNet;
  result[`${newBucket}Cents`] = (result[`${newBucket}Cents`] ?? 0) + newNet;
  return result;
}

/** Immutable journal and rebuildable projection commit together. Negative
 * available balances represent overpayments recoverable from future earnings. */
export function appendLedger(db: FirebaseFirestore.Firestore, tx: FirebaseFirestore.Transaction,
  id: string, carrierId: string, deltas: Deltas, details: FirebaseFirestore.DocumentData): void {
  for (const amount of Object.values(deltas)) {
    if (!Number.isSafeInteger(amount)) throw new Error("Non-integer accounting amount.");
  }
  tx.create(db.collection("referralLedger").doc(id), {
    schemaVersion: 2, referrerCarrierId: carrierId, currency: "usd", ...details, deltas,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const update: FirebaseFirestore.DocumentData = {
    referrerCarrierId: carrierId, schemaVersion: 2, currency: "usd",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  for (const [bucket, amount] of Object.entries(deltas)) update[bucket] = admin.firestore.FieldValue.increment(amount);
  tx.set(db.collection("referralBalances").doc(carrierId), update, { merge: true });
}
