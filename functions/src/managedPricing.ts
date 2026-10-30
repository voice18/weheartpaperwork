export const MANAGED_PRICING = {
  companyFirstYearMonthly: 37,
  companyRenewalMonthly: 29,
  driverMonthly: 13,
  truckMonthly: 1,
  trailerMonthly: 1,
  fleetOnlyOnboardingOneTime: 40,
  dqFileOneTime: 99,
} as const;

export const MANAGED_COMPANY_SETUP_TOTAL =
  (MANAGED_PRICING.companyFirstYearMonthly - MANAGED_PRICING.companyRenewalMonthly) * 12;

export type ManagedAreas = { company: boolean; drivers: boolean; fleet: boolean };
export type ManagedCounts = { drivers: number; trucks: number; trailers: number; dqFiles: number };

export function calculateManagedPrice(areas: ManagedAreas, counts: ManagedCounts) {
  for (const value of Object.values(counts)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 10000) {
      throw new Error("Managed-service quantity must be a nonnegative whole number.");
    }
  }
  if ((!areas.drivers && (counts.drivers || counts.dqFiles)) ||
      (!areas.fleet && (counts.trucks || counts.trailers)) || counts.dqFiles > counts.drivers) {
    throw new Error("Managed-service quantities do not match the selected areas.");
  }
  const recurringUnits = counts.drivers * MANAGED_PRICING.driverMonthly +
    counts.trucks * MANAGED_PRICING.truckMonthly +
    counts.trailers * MANAGED_PRICING.trailerMonthly;
  return {
    companyFirstYearMonthly: areas.company ? MANAGED_PRICING.companyFirstYearMonthly : 0,
    companyRenewalMonthly: areas.company ? MANAGED_PRICING.companyRenewalMonthly : 0,
    driverMonthly: counts.drivers * MANAGED_PRICING.driverMonthly,
    truckMonthly: counts.trucks * MANAGED_PRICING.truckMonthly,
    trailerMonthly: counts.trailers * MANAGED_PRICING.trailerMonthly,
    firstYearMonthly: (areas.company ? MANAGED_PRICING.companyFirstYearMonthly : 0) + recurringUnits,
    renewalMonthly: (areas.company ? MANAGED_PRICING.companyRenewalMonthly : 0) + recurringUnits,
    fleetOnlyOnboardingOneTime: areas.fleet && !areas.company && !areas.drivers
      ? MANAGED_PRICING.fleetOnlyOnboardingOneTime : 0,
    dqFileOneTime: counts.dqFiles * MANAGED_PRICING.dqFileOneTime,
  };
}
