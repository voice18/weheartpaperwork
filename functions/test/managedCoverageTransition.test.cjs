const test = require("node:test");
const assert = require("node:assert/strict");
const { managedUnitIdsForSave } = require("../lib/managedCoverageTransition.js");

test("first activation uses the exact paid quote roster", () => {
  const quote = { driverIds: ["driverA"], vehicleIds: ["truckA"] };
  assert.deepEqual(managedUnitIdsForSave("active", false, {}, quote), quote);
});

test("saving active coverage preserves units enrolled after the original quote", () => {
  const quote = { driverIds: ["driverA"], vehicleIds: [] };
  const current = { driverIds: ["driverA", "driverB"], vehicleIds: ["truckA"] };
  assert.deepEqual(managedUnitIdsForSave("active", true, current, quote), current);
});

test("pausing coverage keeps its enrolled roster for the audit trail", () => {
  const current = { driverIds: ["driverA", "driverB"], vehicleIds: [] };
  assert.deepEqual(managedUnitIdsForSave("paused", false, current, {}), current);
});
