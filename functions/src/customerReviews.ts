import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

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
    await db.collection("customerReviewSubmissions").doc(carrierId).set({
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
    }, { merge: false });

    return { status: "pending" };
  },
);

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
