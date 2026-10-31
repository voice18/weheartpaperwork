const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MANAGED_COMPANY_SETUP_TOTAL, calculateManagedPrice } = require('../lib/managedPricing.js');

test('first-year and renewal amounts are whole dollars and setup is $96', () => {
  const price = calculateManagedPrice(
    { company: true, drivers: true, fleet: true },
    { drivers: 1, trucks: 1, trailers: 1, dqFiles: 1 });
  assert.equal(MANAGED_COMPANY_SETUP_TOTAL, 96);
  assert.equal(price.firstYearMonthly, 52);
  assert.equal(price.renewalMonthly, 44);
  assert.equal(price.dqFileOneTime, 99);
  assert.equal(price.fleetOnlyOnboardingOneTime, 0);
});

test('fleet-only has a one-time onboarding charge; combined coverage does not', () => {
  const fleet = calculateManagedPrice(
    { company: false, drivers: false, fleet: true },
    { drivers: 0, trucks: 1, trailers: 1, dqFiles: 0 });
  assert.equal(fleet.firstYearMonthly, 2);
  assert.equal(fleet.fleetOnlyOnboardingOneTime, 40);
  const combined = calculateManagedPrice(
    { company: false, drivers: true, fleet: true },
    { drivers: 1, trucks: 1, trailers: 0, dqFiles: 0 });
  assert.equal(combined.fleetOnlyOnboardingOneTime, 0);
});

test('unselected areas cannot be billed and DQ files cannot exceed drivers', () => {
  assert.throws(() => calculateManagedPrice(
    { company: true, drivers: false, fleet: false },
    { drivers: 1, trucks: 0, trailers: 0, dqFiles: 0 }));
  assert.throws(() => calculateManagedPrice(
    { company: true, drivers: true, fleet: false },
    { drivers: 1, trucks: 0, trailers: 0, dqFiles: 2 }));
});

test('empty selected Driver and Fleet areas do not add unit charges', () => {
  const price = calculateManagedPrice(
    { company: true, drivers: true, fleet: true },
    { drivers: 0, trucks: 0, trailers: 0, dqFiles: 0 });
  assert.equal(price.firstYearMonthly, 37);
  assert.equal(price.renewalMonthly, 29);
  assert.equal(price.driverMonthly, 0);
  assert.equal(price.truckMonthly, 0);
  assert.equal(price.trailerMonthly, 0);
  const emptyFleet = calculateManagedPrice(
    { company: false, drivers: false, fleet: true },
    { drivers: 0, trucks: 0, trailers: 0, dqFiles: 0 });
  assert.equal(emptyFleet.firstYearMonthly, 0);
  assert.equal(emptyFleet.fleetOnlyOnboardingOneTime, 0);
});
