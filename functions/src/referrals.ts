import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import { randomBytes } from "node:crypto";
import {
  REFERRAL_RATE_BPS,
  REFERRAL_TERMS_VERSION,
  claimIsTimely,
} from "./referralPolicy";

const REFERRAL_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_ATTEMPTS = 12;

const REFERRAL_CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function normalizedUsdot(value: unknown): string {
  if (typeof value !== "string" || !/^\s*\d{1,8}\s*$/.test(value)) return "";
  return value.trim().replace(/^0+/, "");
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


            const billingStatus = carrierSnapshot.data()?.billing?.status;
            if (carrierSnapshot.data()?.deletingAccount || carrierSnapshot.data()?.referralProgramSuspended) {
              throw new HttpsError("failed-precondition", "Referral participation is under review or closing.");
            }
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

            if (request.data?.acceptTerms !== true) {
              throw new HttpsError("failed-precondition", "Accept the Referral Rewards terms before creating a code.");
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

    if (
      !claimIsTimely(createdAtMillis, Date.now())
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

        const referredCarrierSnapshot = await transaction.get(
          db.collection("carriers").doc(referredCarrierId)
        );

        if (!referredCarrierSnapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            "Finish creating the company account before claiming a referral."
          );
        }

        const referrerData = referrerCarrierSnapshot.data();
        const referredData = referredCarrierSnapshot.data();
        const referrerUsdot = normalizedUsdot(referrerData?.usdotNumber);
        const referredUsdot = normalizedUsdot(referredData?.usdotNumber);

        if (!referrerUsdot || !referredUsdot) {
          throw new HttpsError("failed-precondition", "Both companies must provide a valid USDOT number before a referral is claimed.");
        }
        if (referrerData?.deletingAccount || referredData?.deletingAccount || referrerData?.referralProgramSuspended) {
          throw new HttpsError("failed-precondition", "A company is closing or under review.");
        }

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

        // Company identity survives account deletion. An alternate Firebase
        // login cannot claim the same USDOT company a second time.
        const referrerCompanyRef = db.collection("referralCompanies").doc(referrerUsdot);
        const referredCompanyRef = db.collection("referralCompanies").doc(referredUsdot);
        const [referrerCompany, referredCompany] = await Promise.all([
          transaction.get(referrerCompanyRef), transaction.get(referredCompanyRef),
        ]);
        if ((referrerCompany.exists && referrerCompany.data()?.carrierId !== referrerCarrierId) ||
            (referredCompany.exists && referredCompany.data()?.carrierId !== referredCarrierId) ||
            referredCompany.data()?.attributed === true) {
          throw new HttpsError("already-exists", "This company identity is already registered or attributed. Contact support for a documented correction.");
        }
        // Check the deadline again inside the transaction, after all reads.
        if (!claimIsTimely(createdAtMillis, Date.now())) throw new HttpsError("failed-precondition", "The 24-hour referral claim window has ended.");
        transaction.set(referrerCompanyRef, { carrierId: referrerCarrierId }, { merge: true });
        transaction.set(referredCompanyRef, { carrierId: referredCarrierId, attributed: true, referralId: referredCarrierId }, { merge: true });
        transaction.update(referrerCarrierRef, { referralCompanyKey: referrerUsdot });
        transaction.update(referredCarrierSnapshot.ref, { referralCompanyKey: referredUsdot });

        transaction.create(referralRef, {
          referrerCarrierId,
          referredCarrierId,
          referralCode: code,
          commissionRateBps:
            REFERRAL_RATE_BPS,
          termsVersion: REFERRAL_TERMS_VERSION,
          status: "active",
          referrerCompanyKey: referrerUsdot,
          referredCompanyKey: referredUsdot,
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
