import * as admin from "firebase-admin";

export const OWNER_EMAIL = "aaron@weheartpaperwork.com";

export async function queueOwnerEmail(
  db: FirebaseFirestore.Firestore,
  id: string,
  subject: string,
  text: string,
): Promise<void> {
  const ref = db.collection("mail").doc(id);
  await db.runTransaction(async transaction => {
    if ((await transaction.get(ref)).exists) return;
    transaction.create(ref, {
      to: [OWNER_EMAIL],
      message: { subject, text },
      category: "owner_notification",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}
