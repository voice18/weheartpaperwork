export const REFERRAL_RATE_BPS = 1000;
export const REFERRAL_HOLD_DAYS = 30;
export const REFERRAL_MINIMUM_PAYOUT_CENTS = 2500;
export const REFERRAL_TERMS_VERSION = "2026-08-22";

export function calculateRewardCents(
  qualifyingCents: number,
  rateBps: number
): number {
  if (!Number.isInteger(qualifyingCents) || qualifyingCents <= 0) return 0;
  if (!Number.isInteger(rateBps) || rateBps <= 0 || rateBps > 10000) return 0;
  return Math.floor((qualifyingCents * rateBps) / 10000);
}
