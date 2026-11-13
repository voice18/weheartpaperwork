const assert = require('node:assert/strict');
const test = require('node:test');

const { scheduleManagedCancellation, scheduleCombinedManagedEnd, syncManagedSubscription } = require('../lib/managedQuotes.js');
const { syncSubscriptionToCarrier } = require('../lib/stripeWebhookHandlers.js');

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

test('ending managed items on a combined subscription keeps the app base and driver items', async () => {
  let changed;
  const stripe = { subscriptionSchedules: {
    retrieve: async () => ({ status: 'active', current_phase: { start_date: phaseStart }, phases: [] }),
    update: async (_id, params) => { changed = params; },
  } };
  const current = subscription({ metadata: { appCompanyPriceId: 'price_app', appDriverPriceId: 'price_app_driver' },
    schedule: 'sub_sched_combined', items: { data: [
      { price: { id: 'price_app' }, quantity: 1, current_period_end: periodEnd },
      { price: { id: 'price_app_driver' }, quantity: 2, current_period_end: periodEnd },
      { price: { id: 'price_managed_company' }, quantity: 1, current_period_end: periodEnd },
      { price: { id: 'price_managed_driver' }, quantity: 2, current_period_end: periodEnd },
    ] } });
  assert.equal(await scheduleCombinedManagedEnd(stripe, current), periodEnd);
  assert.equal(changed.end_behavior, 'release');
  assert.equal(changed.phases[0].items.length, 4);
  assert.deepEqual(changed.phases[1].items, [
    { price: 'price_app', quantity: 1 }, { price: 'price_app_driver', quantity: 2 },
  ]);
});

test('combined managed cancellation fails closed if the app base price is missing', async () => {
  const stripe = { subscriptionSchedules: { update: async () => { throw new Error('Unexpected schedule update'); } } };
  await assert.rejects(() => scheduleCombinedManagedEnd(stripe, subscription({
    metadata: { appCompanyPriceId: 'price_app', appDriverPriceId: 'price_app_driver' },
  })), /app billing item is missing/);
});

test('paid-period transition to app-only ends managed billing and pauses owner coverage', async () => {
  const writes = [];
  const documents = {
    carriers: { exists: true, data: () => ({}) },
    managedServiceBilling: { exists: true, data: () => ({ stripeSubscriptionId: 'sub_combined' }) },
    managedServiceCoverage: { exists: true, data: () => ({ status: 'active' }) },
    managedServiceRequests: { exists: true, data: () => ({ status: 'end_scheduled' }) },
    managedServiceQuotes: { exists: false, data: () => ({}) },
  };
  const db = { collection: name => ({ doc: () => ({
    get: async () => documents[name],
    set: async value => writes.push([name, 'set', value]),
    update: async value => writes.push([name, 'update', value]),
  }) }) };
  const stripe = { products: { retrieve: async () => ({ deleted: false, metadata: { serviceKind: 'app' }, name: 'Base Subscription' }) } };
  const current = subscription({ id: 'sub_combined', metadata: {
    serviceKind: 'app_with_managed', carrierId: 'carrier_test', quoteId: 'quote_test',
    appCompanyPriceId: 'price_app', appDriverPriceId: 'price_app_driver',
  }, items: { data: [{ price: { id: 'price_app', product: 'prod_app', unit_amount: 200 }, quantity: 1 }] } });
  await syncManagedSubscription(db, stripe, current);
  const billing = writes.find(row => row[0] === 'managedServiceBilling')[2];
  assert.equal(billing.monthlyAmountCents, 0);
  assert.equal(billing.status, 'ended');
  assert.equal(writes.find(row => row[0] === 'managedServiceCoverage')[2].status, 'paused');
  assert.equal(writes.find(row => row[0] === 'managedServiceRequests')[2].status, 'ended');
});

test('full subscription end marks app billing canceled while managed coverage pauses', async () => {
  const writes = [];
  const documents = {
    carriers: { exists: true, data: () => ({ billing: { stripeSubscriptionId: 'sub_combined' } }) },
    managedServiceBilling: { exists: true, data: () => ({ stripeSubscriptionId: 'sub_combined' }) },
    managedServiceCoverage: { exists: true, data: () => ({ status: 'active' }) },
    managedServiceRequests: { exists: true, data: () => ({ status: 'end_scheduled' }) },
    managedServiceQuotes: { exists: false, data: () => ({}) },
  };
  const db = { collection: name => ({ doc: () => ({
    get: async () => documents[name],
    set: async value => writes.push([name, 'set', value]),
    update: async value => writes.push([name, 'update', value]),
  }) }), runTransaction: async fn => fn({
    get: async () => documents.carriers,
    update: (_ref, value) => writes.push(['carriers', 'update', value]),
  }) };
  const stripe = { products: { retrieve: async () => ({ deleted: false, metadata: { serviceKind: 'managed' }, name: 'Managed Company compliance' }) } };
  const current = subscription({ id: 'sub_combined', status: 'canceled', customer: 'cus_test', created: 1,
    canceled_at: periodEnd, metadata: {
      serviceKind: 'app_with_managed', carrierId: 'carrier_test', quoteId: 'quote_test',
      appCompanyPriceId: 'price_app', appDriverPriceId: 'price_app_driver',
    }, items: { data: [
      { price: { id: 'price_app', product: 'prod_app', unit_amount: 200 }, quantity: 1 },
      { price: { id: 'price_managed', product: 'prod_managed', unit_amount: 3700 }, quantity: 1 },
    ] } });
  await syncSubscriptionToCarrier(db, current, 'carrier_test');
  await syncManagedSubscription(db, stripe, current);
  assert.equal(writes.find(row => row[0] === 'carriers')[2]['billing.status'], 'canceled');
  assert.equal(writes.find(row => row[0] === 'managedServiceBilling')[2].status, 'canceled');
  assert.equal(writes.find(row => row[0] === 'managedServiceCoverage')[2].status, 'paused');
  assert.equal(writes.find(row => row[0] === 'managedServiceRequests')[2].status, 'ended');
});
