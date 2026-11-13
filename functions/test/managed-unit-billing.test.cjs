const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updatedPhaseItems, reducedPhaseItems, addUnitToManagedBilling,
  removeUnitFromManagedBilling } = require('../lib/managedUnitBilling');

test('removing one managed unit preserves other charges and removes the last unit item', () => {
  const items = [{ price: 'price_app', quantity: 1 }, { price: 'price_managed', quantity: 2 }];
  assert.deepEqual(reducedPhaseItems(items, 'price_managed', 2), [
    { price: 'price_app', quantity: 1 }, { price: 'price_managed', quantity: 1 }]);
  assert.deepEqual(reducedPhaseItems(items.slice(0, 1).concat({ price: 'price_managed', quantity: 1 }),
    'price_managed', 1), [{ price: 'price_app', quantity: 1 }]);
  assert.throws(() => reducedPhaseItems(items, 'price_managed', 1), /does not match/);
});

test('removal updates current and renewal phases without proration or a new invoice', async () => {
  const now = Math.floor(Date.now() / 1000);
  const schedule = { id: 'sched_remove', status: 'active', end_behavior: 'release',
    current_phase: { start_date: now - 100 }, phases: [
      { start_date: now - 100, end_date: now + 1000,
        items: [{ price: 'price_app', quantity: 1 }, { price: 'price_company37', quantity: 1 },
          { price: 'price_truck', quantity: 1 }], metadata: {} },
      { start_date: now + 1000, end_date: now + 3000,
        items: [{ price: 'price_app', quantity: 1 }, { price: 'price_company29', quantity: 1 },
          { price: 'price_truck', quantity: 1 }], metadata: {} },
    ] };
  let update;
  const stripe = {
    products: { retrieve: async () => ({ name: 'Managed Truck compliance' }) },
    subscriptionSchedules: { retrieve: async () => schedule, update: async (_id, value) => {
      update = value; schedule.phases = value.phases;
    } },
    subscriptions: { retrieve: async () => ({ status: 'active', metadata: {
      serviceKind: 'app_with_managed', carrierId: 'carrier1' },
      items: { data: [{ price: { id: 'price_app' }, quantity: 1 },
        { price: { id: 'price_company37' }, quantity: 1 }] } }) },
  };
  const subscription = { id: 'sub_remove', schedule: 'sched_remove', status: 'active',
    metadata: { serviceKind: 'app_with_managed', carrierId: 'carrier1' }, items: { data: [
      { id: 'si_app', price: { id: 'price_app' }, quantity: 1 },
      { id: 'si_company', price: { id: 'price_company37' }, quantity: 1 },
      { id: 'si_truck', price: { id: 'price_truck', unit_amount: 100,
        recurring: { interval: 'month' }, product: 'prod_truck' }, quantity: 1 },
    ] } };
  assert.equal(await removeUnitFromManagedBilling(stripe, subscription, 'truck', 1, 1, 'op_remove'),
    'price_truck');
  assert.equal(update.proration_behavior, 'none');
  assert.deepEqual(schedule.phases.map(phase => phase.items.map(item => item.price)), [
    ['price_app', 'price_company37'], ['price_app', 'price_company29']]);
});

test('removal stops before touching Stripe when another scheduled charge is stale', async () => {
  const now = Math.floor(Date.now() / 1000);
  const schedule = { id: 'sched_stale', status: 'active', end_behavior: 'release',
    current_phase: { start_date: now - 100 }, phases: [{ start_date: now - 100,
      end_date: now + 1000, items: [{ price: 'price_app_driver', quantity: 1 },
        { price: 'price_truck', quantity: 1 }], metadata: {} }] };
  let changed = false;
  const stripe = { products: { retrieve: async () => ({ name: 'Managed Truck compliance' }) },
    subscriptionSchedules: { retrieve: async () => schedule,
      update: async () => { changed = true; } } };
  const subscription = { id: 'sub_stale', schedule: 'sched_stale', status: 'active',
    metadata: { serviceKind: 'app_with_managed', carrierId: 'carrier1' }, items: { data: [
      { price: { id: 'price_app_driver' }, quantity: 0 },
      { price: { id: 'price_truck', unit_amount: 100, recurring: { interval: 'month' },
        product: 'prod_truck' }, quantity: 1 },
    ] } };
  await assert.rejects(removeUnitFromManagedBilling(stripe, subscription, 'truck', 1, 1, 'op_stale'),
    /differ from the scheduled phase/);
  assert.equal(changed, false);
});

test('phase update preserves other charges and adds one managed unit', () => {
  assert.deepEqual(updatedPhaseItems([{ price: 'price_company', quantity: 1 },
    { price: 'price_driver', quantity: 1 }], 'price_driver', 1), [
    { price: 'price_company', quantity: 1 }, { price: 'price_driver', quantity: 2 }]);
  assert.deepEqual(updatedPhaseItems([{ price: 'price_company', quantity: 1 }], 'price_driver', 0), [
    { price: 'price_company', quantity: 1 }, { price: 'price_driver', quantity: 1 }]);
  assert.throws(() => updatedPhaseItems([{ price: 'price_driver', quantity: 3 }], 'price_driver', 1),
    /does not match/);
});

test('active schedule updates current and renewal phases without proration', async () => {
  const now = Math.floor(Date.now() / 1000);
  const schedule = { status: 'active', end_behavior: 'release', current_phase: { start_date: now - 100 },
    phases: [
      { start_date: now - 100, end_date: now + 1000, items: [{ price: 'price_company37', quantity: 1 },
        { price: 'price_driver', quantity: 1 }], metadata: {} },
      { start_date: now + 1000, end_date: now + 3000, items: [{ price: 'price_company29', quantity: 1 },
        { price: 'price_driver', quantity: 1 }], metadata: { serviceKind: 'managed' } },
    ] };
  let update;
  const stripe = {
    products: { retrieve: async () => ({ name: 'Managed Driver compliance' }) },
    subscriptionSchedules: { retrieve: async () => schedule, update: async (_id, value) => {
      update = value; schedule.phases = value.phases; return schedule;
    } },
    subscriptions: { retrieve: async () => ({ status: 'active', metadata: { serviceKind: 'app_with_managed', carrierId: 'carrier1' },
      items: { data: [{ price: { id: 'price_driver' }, quantity: 2 }] } }) },
  };
  const subscription = { id: 'sub_test', schedule: 'sched_test', metadata: { serviceKind: 'app_with_managed', carrierId: 'carrier1' }, items: { data: [
    { id: 'si_company', price: { id: 'price_company37' }, quantity: 1 },
    { id: 'si_driver', price: { id: 'price_driver', unit_amount: 1300,
      recurring: { interval: 'month' }, product: 'prod_driver' }, quantity: 1 },
  ] } };
  assert.equal(await addUnitToManagedBilling(stripe, subscription, 'driver', 13, 1, 'op1'), 'price_driver');
  assert.equal(update.proration_behavior, 'none');
  assert.deepEqual(update.phases.map(phase => phase.items.find(item => item.price === 'price_driver').quantity), [2, 2]);
  assert.deepEqual(update.phases.map(phase => phase.items[0].price), ['price_company37', 'price_company29']);
  assert.deepEqual(update.phases.map(phase => phase.metadata.serviceKind), ['app_with_managed', 'app_with_managed']);
});

test('scheduled managed cancellation blocks a unit addition', async () => {
  const now = Math.floor(Date.now() / 1000);
  const schedule = { status: 'active', end_behavior: 'release', current_phase: { start_date: now - 100 },
    phases: [{ start_date: now - 100, end_date: now + 1000,
      items: [{ price: 'price_company', quantity: 1 }], metadata: {} },
    { start_date: now + 1000, end_date: now + 3000,
      items: [{ price: 'price_app', quantity: 1 }], metadata: {} }] };
  const stripe = { products: { retrieve: async () => ({ name: 'Managed Driver compliance' }) },
    subscriptionSchedules: { retrieve: async () => schedule } };
  const subscription = { id: 'sub_test', schedule: 'sched_test',
    metadata: { appCompanyPriceId: 'price_app' }, items: { data: [
      { price: { id: 'price_driver', unit_amount: 1300,
        recurring: { interval: 'month' }, product: 'prod_driver' }, quantity: 1 },
    ] } };
  await assert.rejects(addUnitToManagedBilling(stripe, subscription, 'driver', 13, 1, 'op2'),
    /scheduled to end/);
});

test('first managed unit creates a recurring price and keeps the Company rate', async () => {
  const now = Math.floor(Date.now() / 1000);
  const schedule = { id: 'sched_new', status: 'active', end_behavior: 'release',
    current_phase: { start_date: now - 100 }, phases: [
      { start_date: now - 100, end_date: now + 1000,
        items: [{ price: 'price_company37', quantity: 1 }], metadata: {} },
      { start_date: now + 1000, end_date: now + 3000,
        items: [{ price: 'price_company29', quantity: 1 }], metadata: {} },
    ] };
  let createdPrice;
  const stripe = {
    products: { create: async () => ({ id: 'prod_new' }) },
    prices: { create: async value => { createdPrice = value; return { id: 'price_new' }; } },
    subscriptionSchedules: { retrieve: async () => schedule, update: async (_id, value) => {
      schedule.phases = value.phases; return schedule;
    } },
    subscriptions: { retrieve: async () => ({ status: 'active', metadata: { serviceKind: 'managed', carrierId: 'carrier1' },
      items: { data: [
      { price: { id: 'price_new' }, quantity: 1 },
    ] } }) },
  };
  const subscription = { id: 'sub_new', schedule: 'sched_new', metadata: { serviceKind: 'managed', carrierId: 'carrier1' },
    items: { data: [{ id: 'si_company', price: { id: 'price_company37' }, quantity: 1 }] } };
  assert.equal(await addUnitToManagedBilling(stripe, subscription, 'truck', 1, 0, 'op3'), 'price_new');
  assert.equal(createdPrice.unit_amount, 100);
  assert.equal(createdPrice.recurring.interval, 'month');
  assert.deepEqual(schedule.phases.map(phase => phase.items.map(item => item.price)), [
    ['price_company37', 'price_new'], ['price_company29', 'price_new']]);
});
