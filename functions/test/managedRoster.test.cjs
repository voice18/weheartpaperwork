const test = require("node:test");
const assert = require("node:assert/strict");
const { managedRoster } = require("../lib/managedRoster.js");

const driver = { name: "Alex", cdlState: "WA", cdlNumber: "AB 123", cdlClass: "A",
  cdlExpiration: "", medicalExpiration: "" };
const truck = { type: "truck", unitNumber: "T1", vin: "VIN12345",
  registrationExpiration: "", inspectionExpiration: "" };

test("quotes selected intake without creating active records", () => {
  const roster = managedRoster("carrier1", { drivers: true, fleet: true },
    { drivers: [driver], vehicles: [truck] }, [], []);
  assert.equal(roster.drivers, 1);
  assert.equal(roster.trucks, 1);
  assert.equal(roster.newDrivers.length, 1);
  assert.equal(roster.newVehicles.length, 1);
  assert.deepEqual(roster.driverIds, [roster.newDrivers[0].id]);
});

test("existing matching active units count once and are not added again", () => {
  const first = managedRoster("carrier1", { drivers: true, fleet: true },
    { drivers: [driver], vehicles: [truck] }, [], []);
  const second = managedRoster("carrier1", { drivers: true, fleet: true },
    { drivers: [driver], vehicles: [truck] },
    [{ id: first.newDrivers[0].id, data: { ...driver, status: "active" } }],
    [{ id: first.newVehicles[0].id, data: { ...truck, status: "active" } }]);
  assert.deepEqual(second.driverIds, first.driverIds);
  assert.deepEqual(second.vehicleIds, first.vehicleIds);
  assert.equal(second.newDrivers.length, 0);
  assert.equal(second.newVehicles.length, 0);
});

test("unselected areas do not enter a managed quote", () => {
  const roster = managedRoster("carrier1", { drivers: false, fleet: false },
    { drivers: [], vehicles: [] },
    [{ id: "existing-driver", data: { ...driver, status: "active" } }],
    [{ id: "existing-truck", data: { ...truck, status: "active" } }]);
  assert.equal(roster.drivers, 0);
  assert.equal(roster.trucks, 0);
  assert.deepEqual(roster.driverIds, []);
});

test("inactive matching units require manual review", () => {
  assert.throws(() => managedRoster("carrier1", { drivers: true, fleet: false },
    { drivers: [driver], vehicles: [] },
    [{ id: "old", data: { ...driver, status: "inactive" } }], []), /inactive/);
});
