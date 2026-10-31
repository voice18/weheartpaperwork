const { test } = require('node:test');
const assert = require('node:assert/strict');
const { managedIntake } = require('../lib/managedIntake.js');

test('accepts empty selected areas and normalizes complete intake', () => {
  assert.deepEqual(managedIntake({}, { drivers: true, fleet: true }), { drivers: [], vehicles: [] });
  const intake = managedIntake({
    drivers: [{ name: ' Aaron Driver ', cdlNumber: 'abc123', cdlClass: 'a', cdlState: 'wa',
      cdlExpiration: '2028-08-27', medicalExpiration: '' }],
    vehicles: [{ type: 'truck', unitNumber: 'T-1', vin: 'abc123456',
      registrationExpiration: '', inspectionExpiration: '2027-10-01' }],
  }, { drivers: true, fleet: true });
  assert.equal(intake.drivers[0].cdlState, 'WA');
  assert.equal(intake.vehicles[0].vin, 'ABC123456');
});

test('rejects duplicate units, incomplete identities, and unselected areas', () => {
  const driver = { name: 'A', cdlNumber: '12345', cdlClass: 'A', cdlState: 'WA' };
  assert.throws(() => managedIntake({ drivers: [driver, driver] }, { drivers: true, fleet: false }));
  assert.throws(() => managedIntake({ drivers: [driver] }, { drivers: false, fleet: false }));
  assert.throws(() => managedIntake({ vehicles: [{ type: 'truck', unitNumber: '1', vin: '12345',
    inspectionExpiration: '2026-02-31' }] }, { drivers: false, fleet: true }));
});
