import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import { randomBytes } from "node:crypto";
import {
  REFERRAL_RATE_BPS,
  REFERRAL_TERMS_VERSION,
} from "./referralPolicy";

const REFERRAL_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_ATTEMPTS = 12;

const REFERRAL_CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function normalizedUsdot(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

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

            if (carrierSnapshot.data()?.deletingAccount === true) {
              throw new HttpsError(
                "failed-precondition",
                "Account deletion is already in progress."
              );
            }


            const billingStatus = carrierSnapshot.data()?.billing?.status;
            if (billingStatus !== "active" && billingStatus !== "trialing") {
              throw new HttpsError(
                "failed-precondition",
                "Referral rewards require an active account in good standing."
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
              active: true,
              termsVersion: REFERRAL_TERMS_VERSION,
              termsAcceptedAt:
                admin.firestore.FieldValue.serverTimestamp(),
              createdAt:
                admin.firestore.FieldValue
                  .serverTimestamp(),
            });

            transaction.set(codeRef, {
              carrierId,
              active: true,
              termsVersion: REFERRAL_TERMS_VERSION,
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

    const attemptRef = db.collection("referralClaimAttempts").doc(referredCarrierId);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(attemptRef);
      const data = snapshot.data();
      const windowStartedAt = data?.windowStartedAt as admin.firestore.Timestamp | undefined;
      const withinWindow = windowStartedAt && Date.now() - windowStartedAt.toMillis() < 60 * 60 * 1000;
      const attempts = withinWindow ? Number(data?.attempts ?? 0) : 0;
      if (attempts >= 5) {
        throw new HttpsError("resource-exhausted", "Too many referral-code attempts. Try again later.");
      }
      transaction.set(attemptRef, {
        attempts: attempts + 1,
        windowStartedAt: withinWindow ? windowStartedAt : admin.firestore.FieldValue.serverTimestamp(),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    const referralRef =
      db
        .collection("referrals")
        .doc(referredCarrierId);

    const existingReferralSnapshot =
      await referralRef.get();

    if (existingReferralSnapshot.exists) {
      const existingData =
        existingReferralSnapshot.data();

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

    const referredUser =
      await admin.auth().getUser(
        referredCarrierId
      );

    const createdAtMillis =
      Date.parse(
        referredUser.metadata.creationTime
      );

    const accountAgeMillis =
      Date.now() - createdAtMillis;

    const maxReferralClaimAgeMillis =
      24 * 60 * 60 * 1000;

    if (
      !Number.isFinite(createdAtMillis) ||
      accountAgeMillis < 0 ||
      accountAgeMillis >
        maxReferralClaimAgeMillis
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Referral rewards must be claimed during initial account signup."
      );
    }

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

        const referrerCarrierSnapshot =
          await transaction.get(
            referrerCarrierRef
          );

        if (!referrerCarrierSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "The referring company no longer exists."
          );
        }

        if (referrerCarrierSnapshot.data()?.deletingAccount === true) {
          throw new HttpsError(
            "failed-precondition",
            "The referring company is no longer eligible for referral rewards."
          );
        }

        const referredCarrierSnapshot = await transaction.get(
          db.collection("carriers").doc(referredCarrierId)
        );

        if (!referredCarrierSnapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            "Finish creating the company account before claiming a referral."
          );
        }

        if (referredCarrierSnapshot.data()?.deletingAccount === true) {
          throw new HttpsError(
            "failed-precondition",
            "Account deletion is already in progress."
          );
        }

        const referrerData = referrerCarrierSnapshot.data();
        const referredData = referredCarrierSnapshot.data();
        const referrerUsdot = normalizedUsdot(referrerData?.usdotNumber);
        const referredUsdot = normalizedUsdot(referredData?.usdotNumber);

        if (referrerUsdot && referredUsdot && referrerUsdot === referredUsdot) {
          throw new HttpsError(
            "failed-precondition",
            "A company cannot refer another account using the same USDOT number."
          );
        }

        const referrerBillingStatus = referrerData?.billing?.status;
        if (referrerBillingStatus !== "active" && referrerBillingStatus !== "trialing") {
          throw new HttpsError(
            "failed-precondition",
            "The referring company is not currently eligible for referral rewards."
          );
        }

        transaction.create(referralRef, {
          referrerCarrierId,
          referredCarrierId,
          referralCode: code,
          commissionRateBps:
            REFERRAL_RATE_BPS,
          termsVersion: REFERRAL_TERMS_VERSION,
          status: "active",
          claimedAt:
            admin.firestore.FieldValue
              .serverTimestamp(),
        });

        transaction.set(
          db.collection("referralSummaries").doc(referrerCarrierId),
          {
            referrerCarrierId,
            directReferralCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

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
