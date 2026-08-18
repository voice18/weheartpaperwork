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