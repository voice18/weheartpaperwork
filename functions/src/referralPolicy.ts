export const REFERRAL_RATE_BPS = 1000;
export const REFERRAL_HOLD_DAYS = 30;
export const REFERRAL_MINIMUM_PAYOUT_CENTS = 2500;
export const REFERRAL_TERMS_VERSION = "2026-09-04";

export function calculateRewardCents(
  qualifyingCents: number,
  rateBps: number
): number {
  if (!Number.isSafeInteger(qualifyingCents) || qualifyingCents <= 0) return 0;
  if (!Number.isInteger(rateBps) || rateBps <= 0 || rateBps > 10000) return 0;
  return Number(BigInt(qualifyingCents) * BigInt(rateBps) / 10000n);
}

/** Recalculate the remaining entitlement, never round each refund separately. */
export function retainedRewardCents(grossCents: number, removedCents: number, rateBps: number): number {
  return calculateRewardCents(Math.max(0, grossCents - removedCents), rateBps);
}

export function canPay(availableCents: number, reservedCents = 0): boolean {
  return Number.isSafeInteger(availableCents) && availableCents >= REFERRAL_MINIMUM_PAYOUT_CENTS && reservedCents === 0;
}

export function claimIsTimely(createdAtMillis: number, now: number): boolean {
  return Number.isFinite(createdAtMillis) && now >= createdAtMillis && now - createdAtMillis <= 86400000;
}
