const admin = require("firebase-admin");

const [action, projectId, reviewId] = process.argv.slice(2);
if (!projectId || !["list", "publish", "reject"].includes(action) || (action !== "list" && !reviewId)) {
  throw new Error("Usage: node scripts/customer-review-admin.cjs list PROJECT | publish|reject PROJECT REVIEW_ID");
}
admin.initializeApp({ projectId });
const db = admin.firestore();

async function run() {
  if (action === "list") {
    const rows = await db.collection("customerReviewSubmissions").where("moderationStatus", "==", "pending").get();
    for (const row of rows.docs) {
      const value = row.data();
      console.log(JSON.stringify({ id: row.id, rating: value.rating, reviewerName: value.reviewerName, companyName: value.companyName, reviewText: value.reviewText, incentiveReceived: value.incentiveReceived }));
    }
    console.log(`Pending reviews: ${rows.size}`);
    return;
  }

  const sourceRef = db.collection("customerReviewSubmissions").doc(reviewId);
  const publicRef = db.collection("publicCustomerReviews").doc(reviewId);
  await db.runTransaction(async tx => {
    const source = await tx.get(sourceRef);
    if (!source.exists) throw new Error("Review not found.");
    const value = source.data();
    if (action === "reject") {
      tx.set(sourceRef, { moderationStatus: "rejected", moderatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.delete(publicRef);
      return;
    }
    if (value.consentToPublish !== true || value.verifiedCustomer !== true) throw new Error("Review is not eligible to publish.");
    tx.set(publicRef, {
      rating: value.rating,
      reviewText: value.reviewText,
      reviewerName: value.reviewerName,
      reviewerTitle: value.reviewerTitle || null,
      companyName: value.displayCompanyName ? value.companyName : null,
      verifiedCustomer: true,
      incentiveReceived: value.incentiveReceived === true,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(sourceRef, { moderationStatus: "published", moderatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  console.log(`${action} complete for ${reviewId}.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
