const assert = require('node:assert/strict');
const test = require('node:test');

const { scheduleManagedCancellation } = require('../lib/managedQuotes.js');

const periodEnd = Math.floor(Date.now() / 1000) + 25 * 24 * 60 * 60;
const phaseStart = periodEnd - 30 * 24 * 60 * 60;

function subscription(overrides = {}) {
  return {
    id: 'sub_managed_test',
    cancel_at: null,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_company' }, quantity: 1, current_period_end: periodEnd }] },
    ...overrides,
  };
}

test('managed schedule ends after the paid period without touching the app subscription', async () => {
  const calls = [];
  const stripe = {
    subscriptionSchedules: {
      retrieve: async id => {
        calls.push(['retrieveSchedule', id]);
        return { status: 'active', current_phase: { start_date: phaseStart, end_date: phaseStart + 365 * 86400 } };
      },
      update: async (id, params) => {
        calls.push(['updateSchedule', id, params]);
      },
    },
    subscriptions: {
      retrieve: async id => {
        calls.push(['retrieveSubscription', id]);
        return subscription({ schedule: 'sub_sched_managed_test', cancel_at: periodEnd });
      },
      update: async () => { throw new Error('Direct subscription update must not run'); },
    },
  };
  const result = await scheduleManagedCancellation(stripe, subscription({ schedule: 'sub_sched_managed_test' }));
  assert.equal(result.cancelAt, periodEnd);
  assert.deepEqual(calls.map(call => call[0]), ['retrieveSchedule', 'updateSchedule', 'retrieveSubscription']);
  assert.deepEqual(calls[1][2], {
    end_behavior: 'cancel', proration_behavior: 'none',
    phases: [{ start_date: phaseStart, end_date: periodEnd, items: [{ price: 'price_company', quantity: 1 }] }],
  });
});

test('already scheduled cancellation does not update Stripe again', async () => {
  const stripe = { subscriptions: { update: async () => { throw new Error('Unexpected update'); } },
    subscriptionSchedules: { update: async () => { throw new Error('Unexpected update'); } } };
  const result = await scheduleManagedCancellation(stripe,
    subscription({ schedule: 'sub_sched_managed_test', cancel_at: periodEnd }));
  assert.equal(result.cancelAt, periodEnd);
});

test('managed subscriptions without a schedule cancel at period end', async () => {
  let updatedId;
  const stripe = { subscriptions: {
    update: async (id, params) => {
      updatedId = id;
      assert.deepEqual(params, { cancel_at_period_end: true });
      return subscription({ cancel_at_period_end: true });
    },
  } };
  const result = await scheduleManagedCancellation(stripe, subscription());
  assert.equal(updatedId, 'sub_managed_test');
  assert.equal(result.cancelAt, periodEnd);
});
