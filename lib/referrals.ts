import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpsCallable } from "firebase/functions";

import { functions } from "./firebase";

const PENDING_REFERRAL_KEY =
  "whp_pending_referral_code";

const REFERRAL_CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

type ClaimReferralResponse = {
  status: "claimed" | "already-claimed";
  referralCode: string;
  referrerCarrierId: string;
};

export function normalizeReferralCode(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim().toUpperCase();

  return REFERRAL_CODE_PATTERN.test(code)
    ? code
    : null;
}

export async function savePendingReferralCode(
  value: unknown
): Promise<boolean> {
  const code = normalizeReferralCode(value);

  if (!code) {
    return false;
  }

  await AsyncStorage.setItem(
    PENDING_REFERRAL_KEY,
    code
  );

  return true;
}

export async function getPendingReferralCode():
  Promise<string | null> {
  const storedCode =
    await AsyncStorage.getItem(
      PENDING_REFERRAL_KEY
    );

  const code =
    normalizeReferralCode(storedCode);

  if (!code && storedCode !== null) {
    await AsyncStorage.removeItem(
      PENDING_REFERRAL_KEY
    );
  }

  return code;
}

export async function clearPendingReferralCode():
  Promise<void> {
  await AsyncStorage.removeItem(
    PENDING_REFERRAL_KEY
  );
}

export async function claimPendingReferral():
  Promise<
    | { status: "none" }
    | ClaimReferralResponse
  > {
  const code =
    await getPendingReferralCode();

  if (!code) {
    return {
      status: "none",
    };
  }

  const claimReferral = httpsCallable<
    { code: string },
    ClaimReferralResponse
  >(
    functions,
    "claimReferral"
  );

  const result =
    await claimReferral({
      code,
    });

  const data = result.data;

  if (
    data.status !== "claimed" &&
    data.status !== "already-claimed"
  ) {
    throw new Error(
      "Referral claim was not confirmed."
    );
  }

  if (
    data.referralCode !== code ||
    typeof data.referrerCarrierId !== "string" ||
    !data.referrerCarrierId
  ) {
    throw new Error(
      "Referral claim response was invalid."
    );
  }

  // We only remove the pending referral after
  // the server has confirmed permanent attribution.
  await clearPendingReferralCode();

  return data;
}