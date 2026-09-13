import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { randomUUID } from "node:crypto";

const REVIEW_TERMS_VERSION = "2026-09-10";
const ALLOWED_STATUSES = new Set(["active", "trialing"]);

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export const submitCustomerReview = onCall(
  { region: "us-central1" },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to submit a review.");

    const carrierId = request.auth.uid;
    const rating = Number(request.data?.rating);
    const reviewText = cleanText(request.data?.reviewText, 1500);
    const reviewerName = cleanText(request.data?.reviewerName, 80);
    const reviewerTitle = cleanText(request.data?.reviewerTitle, 80);
    const displayCompanyName = request.data?.displayCompanyName === true;
    const consentToPublish = request.data?.consentToPublish === true;
    const incentiveReceived = request.data?.incentiveReceived === true;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpsError("invalid-argument", "Choose a rating from 1 to 5.");
    }
    if (reviewText.length < 30) throw new HttpsError("invalid-argument", "Please write at least 30 characters.");
    if (reviewerName.length < 2) throw new HttpsError("invalid-argument", "Enter the name you want displayed.");
    if (!consentToPublish) throw new HttpsError("failed-precondition", "Permission to publish is required.");

    const db = admin.firestore();
    const carrier = await db.collection("carriers").doc(carrierId).get();
    if (!carrier.exists || carrier.data()?.deletingAccount === true) {
      throw new HttpsError("failed-precondition", "Your company account is not available.");
    }
    if (!ALLOWED_STATUSES.has(String(carrier.data()?.billing?.status ?? ""))) {
      throw new HttpsError("permission-denied", "Reviews are limited to verified customers with an active account or trial.");
    }

    const companyName = cleanText(carrier.data()?.companyName, 120);
    const submission = {
      carrierId,
      rating,
      reviewText,
      reviewerName,
      reviewerTitle: reviewerTitle || null,
      companyName: displayCompanyName ? companyName : null,
      displayCompanyName,
      consentToPublish,
      incentiveReceived,
      verifiedCustomer: true,
      verificationBasis: "authenticated_active_or_trialing_carrier",
      moderationStatus: "pending",
      termsVersion: REVIEW_TERMS_VERSION,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    batch.set(db.collection("customerReviewSubmissions").doc(carrierId), submission, { merge: false });
    const mailId = `review_${carrierId}_${randomUUID()}`;
    batch.create(db.collection("mail").doc(mailId), {
      to: ["aaron@weheartpaperwork.com"],
      message: {
        subject: `New customer review: ${rating}/5 from ${reviewerName}`,
        text: `A verified customer review is waiting for approval.\n\nRating: ${rating}/5\nReviewer: ${reviewerName}\nCompany: ${displayCompanyName ? companyName : "Not authorized for public display"}\n\n${reviewText}\n\nReview it at https://weheartpaperwork.com/owner-reviews`,
      },
      category: "customer_review",
      carrierId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return { status: "pending" };
  },
);

function requireOwner(request: { auth?: { token: Record<string, unknown> } }): void {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  if (request.auth.token.ownerAdmin !== true) throw new HttpsError("permission-denied", "Owner access is required.");
}

export const listCustomerReviewsForModeration = onCall({ region: "us-central1" }, async request => {
  requireOwner(request);
  const db = admin.firestore();
  const [snapshot, feedbackSnapshot] = await Promise.all([
    db.collection("customerReviewSubmissions").orderBy("submittedAt", "desc").limit(100).get(),
    db.collection("customerFeedback").orderBy("submittedAt", "desc").limit(100).get(),
  ]);
  return { reviews: snapshot.docs.map(row => {
    const value = row.data();
    return { id: row.id, rating: value.rating, reviewText: value.reviewText, reviewerName: value.reviewerName,
      reviewerTitle: value.reviewerTitle ?? null, companyName: value.companyName ?? null,
      displayCompanyName: value.displayCompanyName === true, incentiveReceived: value.incentiveReceived === true,
      verifiedCustomer: value.verifiedCustomer === true, moderationStatus: value.moderationStatus,
      submittedAtMillis: value.submittedAt?.toMillis?.() ?? null };
  }), feedback: feedbackSnapshot.docs.map(row => {
    const value = row.data();
    return { id: row.id, category: value.category, message: value.message, companyName: value.companyName,
      contactAllowed: value.contactAllowed === true, contactEmail: value.contactAllowed === true ? value.contactEmail ?? null : null,
      status: value.status, submittedAtMillis: value.submittedAt?.toMillis?.() ?? null };
  }) };
});

export const submitCustomerFeedback = onCall({ region: "us-central1" }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to send feedback.");
  const category = ["idea", "problem", "question", "praise"].includes(request.data?.category) ? request.data.category : "idea";
  const message = cleanText(request.data?.message, 2000);
  const contactAllowed = request.data?.contactAllowed === true;
  if (message.length < 10) throw new HttpsError("invalid-argument", "Please share at least a few details.");
  const db = admin.firestore(); const carrierId = request.auth.uid;
  const carrier = await db.collection("carriers").doc(carrierId).get();
  if (!carrier.exists || carrier.data()?.deletingAccount === true) throw new HttpsError("failed-precondition", "Your company account is not available.");
  const companyName = cleanText(carrier.data()?.companyName, 120) || "Company name unavailable";
  const contactEmail = typeof request.auth.token.email === "string" ? request.auth.token.email : null;
  const feedbackRef = db.collection("customerFeedback").doc();
  const batch = db.batch();
  batch.create(feedbackRef, { carrierId, companyName, category, message, contactAllowed, contactEmail,
    status: "new", submittedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  batch.create(db.collection("mail").doc(`feedback_${feedbackRef.id}`), {
    to: ["aaron@weheartpaperwork.com"], category: "customer_feedback", carrierId,
    message: { subject: `Customer feedback from ${companyName}`,
      text: `New customer feedback is waiting.\n\nCompany: ${companyName}\nCategory: ${category}\nContact permitted: ${contactAllowed ? `Yes (${contactEmail || "account email unavailable"})` : "No"}\n\n${message}\n\nOpen https://weheartpaperwork.com/owner-reviews` },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { status: "received" };
});

export const updateCustomerFeedbackStatus = onCall({ region: "us-central1" }, async request => {
  requireOwner(request);
  const feedbackId = typeof request.data?.feedbackId === "string" ? request.data.feedbackId.trim() : "";
  const status = request.data?.status;
  if (!feedbackId || !["acknowledged", "closed"].includes(status)) throw new HttpsError("invalid-argument", "Choose a valid feedback item and status.");
  await admin.firestore().collection("customerFeedback").doc(feedbackId).set({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { status };
});

export const moderateCustomerReview = onCall({ region: "us-central1" }, async request => {
  requireOwner(request);
  const reviewId = typeof request.data?.reviewId === "string" ? request.data.reviewId.trim() : "";
  const decision = request.data?.decision;
  if (!reviewId || !["publish", "reject"].includes(decision)) throw new HttpsError("invalid-argument", "Choose a valid review and decision.");
  const db = admin.firestore();
  const sourceRef = db.collection("customerReviewSubmissions").doc(reviewId);
  const publicRef = db.collection("publicCustomerReviews").doc(reviewId);
  await db.runTransaction(async transaction => {
    const source = await transaction.get(sourceRef);
    if (!source.exists) throw new HttpsError("not-found", "Review not found.");
    const value = source.data()!;
    if (decision === "reject") {
      transaction.set(sourceRef, { moderationStatus: "rejected", moderatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      transaction.delete(publicRef);
      return;
    }
    if (value.consentToPublish !== true || value.verifiedCustomer !== true) throw new HttpsError("failed-precondition", "This review is not eligible to publish.");
    transaction.set(publicRef, { rating: value.rating, reviewText: value.reviewText, reviewerName: value.reviewerName,
      reviewerTitle: value.reviewerTitle ?? null, companyName: value.displayCompanyName ? value.companyName ?? null : null,
      verifiedCustomer: true, incentiveReceived: value.incentiveReceived === true,
      publishedAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(sourceRef, { moderationStatus: "published", moderatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  return { status: decision === "publish" ? "published" : "rejected" };
});

export const withdrawCustomerReview = onCall(
  { region: "us-central1" },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to withdraw a review.");
    const carrierId = request.auth.uid;
    const db = admin.firestore();
    const submission = db.collection("customerReviewSubmissions").doc(carrierId);
    const published = db.collection("publicCustomerReviews").doc(carrierId);
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(submission);
      if (existing.exists) transaction.set(submission, {
        consentToPublish: false,
        moderationStatus: "withdrawn",
        withdrawnAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.delete(published);
    });
    return { status: "withdrawn" };
  },
);
