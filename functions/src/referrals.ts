import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import { randomBytes } from "node:crypto";

const REFERRAL_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_ATTEMPTS = 12;

const REFERRAL_CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function generateReferralCode(): string {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH);

  return Array.from(
    bytes,
    (value) =>
      REFERRAL_CODE_ALPHABET[value & 31]
  ).join("");
}

export const getReferralCode = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to access referral rewards."
      );
    }

    const carrierId = request.auth.uid;
    const db = admin.firestore();

    const carrierRef =
      db.collection("carriers").doc(carrierId);

    const ownerRef =
      db
        .collection("carrierReferralCodes")
        .doc(carrierId);

    for (
      let attempt = 0;
      attempt < REFERRAL_CODE_ATTEMPTS;
      attempt += 1
    ) {
      const candidate = generateReferralCode();

      try {
        const code = await db.runTransaction(
          async (transaction) => {
            const carrierSnapshot =
              await transaction.get(carrierRef);

            if (!carrierSnapshot.exists) {
              throw new HttpsError(
                "failed-precondition",
                "Your company account could not be found."
              );
            }

            const ownerSnapshot =
              await transaction.get(ownerRef);

            if (ownerSnapshot.exists) {
              const storedCode =
                ownerSnapshot.data()?.code;

              if (
                typeof storedCode !== "string" ||
                !REFERRAL_CODE_PATTERN.test(
                  storedCode
                )
              ) {
                throw new HttpsError(
                  "internal",
                  "Your referral code record is invalid."
                );
              }

              const existingCodeRef =
                db
                  .collection("referralCodes")
                  .doc(storedCode);

              const existingCodeSnapshot =
                await transaction.get(
                  existingCodeRef
                );

              const existingCodeData =
                existingCodeSnapshot.data();

              if (
                !existingCodeSnapshot.exists ||
                existingCodeData?.carrierId !==
                  carrierId
              ) {
                throw new HttpsError(
                  "internal",
                  "Your referral code mapping is invalid."
                );
              }

              if (
                existingCodeData?.active !== true
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "Referral rewards are not active for this account."
                );
              }

              return storedCode;
            }

            const codeRef =
              db
                .collection("referralCodes")
                .doc(candidate);

            const codeSnapshot =
              await transaction.get(codeRef);

            if (codeSnapshot.exists) {
              return null;
            }

            transaction.set(ownerRef, {
              code: candidate,
              createdAt:
                admin.firestore.FieldValue
                  .serverTimestamp(),
            });

            transaction.set(codeRef, {
              carrierId,
              active: true,
              createdAt:
                admin.firestore.FieldValue
                  .serverTimestamp(),
            });

            return candidate;
          }
        );

        if (code) {
          return {
            code,
          };
        }
      } catch (error) {
        if (error instanceof HttpsError) {
          throw error;
        }

        console.error(
          "Referral code creation failed",
          {
            carrierId,
            error,
          }
        );

        throw new HttpsError(
          "internal",
          "Unable to create your referral code."
        );
      }
    }

    throw new HttpsError(
      "internal",
      "Unable to create a unique referral code."
    );
  }
);
const REFERRAL_COMMISSION_RATE_BPS = 1000;

export const claimReferral = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to claim a referral."
      );
    }

    const rawCode = request.data?.code;

    if (typeof rawCode !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "A referral code is required."
      );
    }

    const code = rawCode.trim().toUpperCase();

    if (!REFERRAL_CODE_PATTERN.test(code)) {
      throw new HttpsError(
        "invalid-argument",
        "The referral code is invalid."
      );
    }

    const referredCarrierId = request.auth.uid;
    const db = admin.firestore();

    const referralRef =
      db
        .collection("referrals")
        .doc(referredCarrierId);

    const result = await db.runTransaction(
      async (transaction) => {
        // One referred company can only ever have one
        // authoritative referral record.
        const existingReferral =
          await transaction.get(referralRef);

        if (existingReferral.exists) {
          const existingData =
            existingReferral.data();

          if (
            existingData?.referralCode === code &&
            existingData?.referredCarrierId ===
              referredCarrierId
          ) {
            return {
              status: "already-claimed",
              referralCode: code,
              referrerCarrierId:
                existingData.referrerCarrierId,
            };
          }

          throw new HttpsError(
            "already-exists",
            "This company has already been attributed to a referral."
          );
        }

        const codeRef =
          db.collection("referralCodes").doc(code);

        const codeSnapshot =
          await transaction.get(codeRef);

        if (!codeSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "The referral code does not exist."
          );
        }

        const codeData = codeSnapshot.data();

        if (codeData?.active !== true) {
          throw new HttpsError(
            "failed-precondition",
            "This referral code is not active."
          );
        }

        const referrerCarrierId =
          codeData?.carrierId;

        if (
          typeof referrerCarrierId !== "string" ||
          !referrerCarrierId
        ) {
          throw new HttpsError(
            "internal",
            "The referral code is not linked to a valid company."
          );
        }

        if (
          referrerCarrierId === referredCarrierId
        ) {
          throw new HttpsError(
            "failed-precondition",
            "A company cannot refer itself."
          );
        }

        const ownerCodeRef =
          db
            .collection("carrierReferralCodes")
            .doc(referrerCarrierId);

        const ownerCodeSnapshot =
          await transaction.get(ownerCodeRef);

        if (
          !ownerCodeSnapshot.exists ||
          ownerCodeSnapshot.data()?.code !== code
        ) {
          throw new HttpsError(
            "internal",
            "The referral code ownership record is invalid."
          );
        }

        const referrerCarrierRef =
          db
            .collection("carriers")
            .doc(referrerCarrierId);

        const referredCarrierRef =
          db
            .collection("carriers")
            .doc(referredCarrierId);

        const referrerCarrierSnapshot =
          await transaction.get(
            referrerCarrierRef
          );

        const referredCarrierSnapshot =
          await transaction.get(
            referredCarrierRef
          );

        if (!referrerCarrierSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "The referring company no longer exists."
          );
        }

        if (!referredCarrierSnapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            "Finish creating your company before claiming the referral."
          );
        }

        transaction.create(referralRef, {
          referrerCarrierId,
          referredCarrierId,
          referralCode: code,
          commissionRateBps:
            REFERRAL_COMMISSION_RATE_BPS,
          status: "active",
          claimedAt:
            admin.firestore.FieldValue
              .serverTimestamp(),
        });

        return {
          status: "claimed",
          referralCode: code,
          referrerCarrierId,
        };
      }
    );

    return result;
  }
);