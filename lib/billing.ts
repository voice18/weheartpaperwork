import { Timestamp } from "firebase/firestore";

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type CarrierBilling = {
  status: BillingStatus;
  trialEndsAt?: Timestamp | null;
  currentPeriodEnd?: Timestamp | null;

  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;

  activeDriverCountAtBilling?: number;
  monthlyAmountCents?: number;

  updatedAt?: Timestamp | null;
  cancelAt?: {
  toDate: () => Date;
} | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: {
  toDate: () => Date;
} | null;
};

export function hasBillingAccess(
  billing: CarrierBilling | null
): boolean {
  if (!billing) {
    return false;
  }

  return (
    billing.status === "trialing" ||
    billing.status === "active"
  );
}