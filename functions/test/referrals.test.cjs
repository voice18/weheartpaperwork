const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const realAdmin = require('firebase-admin');
const { Timestamp, FieldValue, FieldPath } = realAdmin.firestore;
const clone = value => {
  if (value instanceof Timestamp || value instanceof FieldValue) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  return value;
};
const field = (row, key) => key.split('.').reduce((value, part) => value?.[part], row);
class MemoryFirestore {
  constructor() { this.rows = new Map(); this.tail = Promise.resolve(); }
  collection(name) { return new Query(this, name); }
  seed(path, row) { this.rows.set(path, clone(row)); }
  read(path) { return clone(this.rows.get(path)); }
  async runTransaction(callback) {
    const result = this.tail.then(async () => {
      const operations = [];
      let wrote = false;
      const tx = { get: async ref => { assert.equal(wrote, false, 'Firestore reads must precede all writes'); return ref.get(); },
        create: (ref, row) => { wrote = true; operations.push(() => ref.create(row)); },
        set: (ref, row, options) => { wrote = true; operations.push(() => ref.set(row, options)); },
        update: (ref, row) => { wrote = true; operations.push(() => ref.update(row)); },
        delete: ref => { wrote = true; operations.push(() => ref.delete()); } };
      const before = new Map([...this.rows].map(([k, v]) => [k, clone(v)]));
      try { const value = await callback(tx); for (const op of operations) await op(); return value; }
      catch (error) { this.rows = before; throw error; }
    });
    this.tail = result.catch(() => {});
    return result;
  }
}
function transforms(value, old) {
  if (value instanceof FieldValue) {
    if (value.constructor.name === 'NumericIncrementTransform') return (old ?? 0) + value.operand;
    if (value.constructor.name === 'ServerTimestampTransform') return Timestamp.now();
    if (value.constructor.name === 'ArrayUnionTransform') return [...new Set([...(old ?? []), ...value.elements])];
    throw new Error(`Unhandled transform ${value.constructor.name}`);
  }
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) return value.map((item, i) => transforms(item, old?.[i]));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, transforms(v, old?.[k])]));
  return value;
}
class Ref {
  constructor(db, path) { this.db = db; this.path = path; this.id = path.split('/').at(-1); }
  async get() { const row = this.db.read(this.path); return { id: this.id, ref: this, exists: row !== undefined, data: () => clone(row) }; }
  async create(row) { assert(!this.db.rows.has(this.path), `Duplicate immutable record ${this.path}`); return this.set(row); }
  async set(row, options) { const previous = this.db.read(this.path); this.db.seed(this.path, { ...(options?.merge ? previous : {}), ...transforms(row, previous) }); }
  async update(row) { assert(this.db.rows.has(this.path), `Missing update target ${this.path}`); return this.set(row, { merge: true }); }
  async delete() { this.db.rows.delete(this.path); }
}
class Query {
  constructor(db, name, filters = [], max = Infinity, cursor = '') { Object.assign(this, { db, name, filters, max, cursor }); }
  doc(id) { return new Ref(this.db, `${this.name}/${id}`); }
  where(key, op, value) { return new Query(this.db, this.name, [...this.filters, [key, op, value]], this.max, this.cursor); }
  orderBy() { return this; }
  startAfter(cursor) { return new Query(this.db, this.name, this.filters, this.max, cursor); }
  limit(max) { return new Query(this.db, this.name, this.filters, max, this.cursor); }
  count() { return { get: async () => ({ data: () => ({ count: [...this.db.rows.keys()].filter(key => key.startsWith(this.name + '/')).length }) }) }; }
  async add(row) { const ref = this.doc(`auto_${this.db.rows.size}`); await ref.create(row); return ref; }
  async get() {
    const docs = [];
    for (const [path, row] of [...this.db.rows].sort()) {
      if (!path.startsWith(`${this.name}/`) || path.split('/').length !== 2 || path.split('/')[1] <= this.cursor) continue;
      if (!this.filters.every(([key, op, expected]) => {
        const actual = field(row, key);
        if (op === '==') return actual === expected;
        if (op === 'array-contains') return actual?.includes(expected);
        if (op === '<=') return (actual?.toMillis?.() ?? actual) <= (expected?.toMillis?.() ?? expected);
        throw new Error(`Unhandled query ${op}`);
      })) continue;
      docs.push(await new Ref(this.db, path).get());
      if (docs.length >= this.max) break;
    }
    return { docs, size: docs.length, empty: !docs.length };
  }
}
let db, userCreated;
const fakeFirestore = Object.assign(() => db, { Timestamp, FieldValue, FieldPath });
const fakeAdmin = { firestore: fakeFirestore, auth: () => ({ getUser: async () => ({ metadata: { creationTime: new Date(userCreated).toISOString() } }) }) };
const originalLoad = Module._load;
Module._load = function(name, ...args) { return name === 'firebase-admin' ? fakeAdmin : originalLoad.call(this, name, ...args); };
const rewards = require('../lib/referralLedgerRewards');
const adminApi = require('../lib/referralAdmin');
const referrals = require('../lib/referrals');
Module._load = originalLoad;
const { calculateRewardCents, claimIsTimely, canPay } = require('../lib/referralPolicy');
const { entitlementDelta } = require('../lib/referralAccounting');
const list = values => ({ async *[Symbol.asyncIterator]() { yield* values; } });
let invoice, charge, refunds, disputes, notes, stripe;
const paid = () => rewards.recordReferralRewardForPaidInvoice(db, stripe, 'evt_paid', Date.now() / 1000, invoice, ['price_base']);
const adminRequest = data => ({ data, auth: { uid: 'admin', token: { referralAdmin: true, auth_time: Date.now() / 1000 } } });
const callAdmin = (fn, data) => fn.run(adminRequest(data));
const balance = () => db.read('referralBalances/A') ?? {};
const journal = () => [...db.rows].filter(([path]) => path.startsWith('referralLedger/'));
function assertBalanced() {
  const sum = {};
  for (const [, row] of journal()) for (const [key, value] of Object.entries(row.deltas)) sum[key] = (sum[key] ?? 0) + value;
  for (const [key, value] of Object.entries(sum)) assert.equal(balance()[key], value, key);
  assert.equal((balance().pendingCents ?? 0) + (balance().heldCents ?? 0) + (balance().availableCents ?? 0) +
    (balance().reservedCents ?? 0) + (balance().paidCents ?? 0), (balance().lifetimeEarnedCents ?? 0) - (balance().reversedCents ?? 0));
}
beforeEach(() => {
  db = new MemoryFirestore(); userCreated = Date.now() - 1000;
  db.seed('carriers/A', { usdotNumber: '123', billing: { status: 'active' } });
  db.seed('carriers/B', { usdotNumber: '456', billing: { status: 'active' } });
  for (const id of ['A', 'B']) db.seed(`referralParticipationEvents/baseline_${id}`, {
    carrierId: id, stripeSubscriptionId: `sub_${id}`, status: 'active', effectiveAt: Timestamp.fromMillis(Date.now() - 200000) });
  db.seed('referrals/B', { referrerCarrierId: 'A', referredCarrierId: 'B', referralCode: 'ABCDEFGH', commissionRateBps: 1000,
    status: 'active', termsVersion: '2026-08-22', claimedAt: Timestamp.fromMillis(Date.now() - 100000) });
  db.seed('referralProgram/current', { ledgerVersion: 2, accountingActivatedAt: Timestamp.fromMillis(Date.now() - 200000), payoutsEnabled: true });
  db.seed('referralPayees/A', { verified: true, destinationReference: 'approved-payee-A', validUntil: Timestamp.fromMillis(Date.now() + 10000000) });
  invoice = { id: 'in_1', status: 'paid', currency: 'usd', amount_paid: 30000, total: 30000, total_excluding_tax: 30000,
    status_transitions: { paid_at: Math.floor(Date.now() / 1000) }, customer: 'cus_B',
    parent: { subscription_details: { subscription: 'sub_B', metadata: { carrierId: 'B' } } } };
  charge = { id: 'ch_1', amount: 30000, paid: true, captured: true, currency: 'usd', payment_intent: 'pi_1' };
  refunds = []; disputes = []; notes = [];
  stripe = { invoices: { retrieve: async () => invoice, listLineItems: () => list([{ amount: invoice.total, pricing: { price_details: { price: 'price_base' } }, parent: { subscription_item_details: {} } }]) },
    invoicePayments: { list: () => list([{ id: 'ip_1', invoice: invoice.id, amount_paid: charge.amount, payment: { payment_intent: 'pi_1' } }]) },
    paymentIntents: { retrieve: async () => ({ status: 'succeeded', latest_charge: 'ch_1' }) },
    charges: { retrieve: async () => charge }, refunds: { list: () => list(refunds) }, disputes: { list: () => list(disputes) }, creditNotes: { list: () => list(notes) } };
});
async function available() {
  await paid();
  const at = Timestamp.fromMillis(Date.now() - 1);
  await db.collection('referralRewards').doc('in_1').update({ availableAt: at });
  await db.collection('referralRewards').doc('in_1').update({ lastReconciledAt: Timestamp.now() });
  await db.collection('referralRewardMaturities').doc('in_1').update({ availableAt: at });
  await rewards.matureReferralRewards.run({});
}
test('duplicate invoice events credit once; journal rebuild equals balances', async () => {
  await paid(); await paid(); await rewards.recordReferralRewardForPaidInvoice(db, stripe, 'evt_other', 0, invoice, ['price_base']);
  assert.equal(balance().pendingCents, 3000); assert.equal(journal().length, 1); assertBalanced();
});
test('simultaneous delivery serializes invoice work; a busy worker retries', async () => {
  const result = await Promise.allSettled([paid(), paid()]);
  assert(result.some(row => row.status === 'fulfilled')); await paid();
  assert.equal(balance().pendingCents, 3000); assertBalanced();
});
test('partial, repeated tiny, then full refund; no rounding drift', async () => {
  await paid(); refunds.push({ id: 're_1', amount: 10001, status: 'succeeded' }); await paid();
  assert.equal(db.read('referralRewards/in_1').netRewardCents, 1999);
  refunds.push({ id: 're_2', amount: 1, status: 'succeeded' }); await paid();
  assert.equal(db.read('referralRewards/in_1').netRewardCents, 1999);
  refunds.push({ id: 're_3', amount: 19998, status: 'succeeded' }); await paid(); await paid();
  assert.equal(balance().pendingCents, 0); assert.equal(balance().reversedCents, 3000); assertBalanced();
});
test('refund delivered before invoice event produces only retained entitlement', async () => {
  refunds.push({ id: 're_1', amount: 15000, status: 'succeeded' });
  await rewards.reconcileReferralCharge(db, stripe, 'evt_refund', charge.id, ['price_base']); await paid();
  assert.equal(balance().pendingCents, 1500); assertBalanced();
});
test('credit note referencing a refund does not reverse twice; noncash credit reverses', async () => {
  await paid(); refunds.push({ id: 're_1', amount: 10000, status: 'succeeded' });
  notes.push({ id: 'cn_1', status: 'issued', type: 'post_payment', post_payment_amount: 15000,
    refunds: [{ refund: 're_1', amount_refunded: 10000 }] });
  await paid(); assert.equal(balance().pendingCents, 1500); assertBalanced();
});
test('open dispute holds, won dispute restores; lost partial dispute reverses actual share', async () => {
  await paid(); disputes.push({ id: 'dp_1', status: 'needs_response', amount: 10000 }); await paid();
  assert.equal(balance().heldCents, 3000); disputes[0].status = 'won'; await paid(); assert.equal(balance().pendingCents, 3000);
  disputes[0].status = 'lost'; await paid(); assert.equal(balance().pendingCents, 2000); assertBalanced();
});
test('trial zero invoices and non-subscription payments create no reward', async () => {
  invoice.total = invoice.amount_paid = invoice.total_excluding_tax = charge.amount = 0; await paid(); assert.equal(journal().length, 0);
  invoice.parent = null; await paid(); assert.equal(journal().length, 0);
});
test('tax excluded and unapproved line held for review without credit', async () => {
  invoice.total_excluding_tax = 25000; await paid(); assert.equal(balance().pendingCents, 2500);
  invoice.id = 'in_other'; await rewards.recordReferralRewardForPaidInvoice(db, stripe, 'evt', 0, invoice, ['different']);
  assert.equal(db.read('referralReviewQueue/in_other').status, 'open'); assert.equal(journal().length, 1);
});
test('driver price/quantity and rate changes never rewrite earned invoices', async () => {
  await paid(); await db.collection('referrals').doc('B').update({ commissionRateBps: 500 });
  invoice.amount_paid = invoice.total = invoice.total_excluding_tax = charge.amount = 60000;
  await paid(); assert.equal(db.read('referralRewards/in_1').netRewardCents, 3000);
  invoice.id = 'in_2'; await paid(); assert.equal(db.read('referralRewards/in_2').netRewardCents, 3000);
  assertBalanced();
});
test('cancellation preserves earned rewards; reactivation pays later invoices at locked rate', async () => {
  await paid(); await db.collection('carriers').doc('A').update({ billing: { status: 'canceled' } });
  await paid(); assert.equal(balance().pendingCents, 3000);
  db.seed('referralParticipationEvents/cancel_A', { carrierId: 'A', stripeSubscriptionId: 'sub_A', status: 'canceled', effectiveAt: Timestamp.fromMillis(invoice.status_transitions.paid_at * 1000 - 1000) });
  invoice.id = 'in_2'; await paid(); assert.equal(db.read('referralRewards/in_2').status, 'reversed');
  await db.collection('carriers').doc('A').update({ billing: { status: 'active' } });
  db.seed('referralParticipationEvents/reactivate_A', { carrierId: 'A', stripeSubscriptionId: 'sub_A2', status: 'active', effectiveAt: Timestamp.fromMillis(invoice.status_transitions.paid_at * 1000 - 500) });
  invoice.id = 'in_3'; await paid(); assert.equal(db.read('referralRewards/in_3').commissionRateBps, 1000);
  assertBalanced();
});
test('only the direct referrer earns, not their upstream referrer', async () => {
  db.seed('referrals/A', { referrerCarrierId: 'UPSTREAM', commissionRateBps: 1000, status: 'active' });
  await paid(); assert.equal(db.read('referralBalances/UPSTREAM'), undefined); assert.equal(balance().pendingCents, 3000);
});
test('payout threshold, retry reservation, settlement and post-payment refund debt', async () => {
  assert(!canPay(2499)); assert(canPay(2500)); assert(!canPay(2500, 1));
  await available();
  const args = { carrierId: 'A', batchId: 'batch1', rewardIds: ['in_1'], reason: 'Verified payout test' };
  await callAdmin(adminApi.prepareReferralPayout, args); await callAdmin(adminApi.prepareReferralPayout, args);
  assert.equal(balance().reservedCents, 3000); assert.equal(balance().availableCents, 0);
  await assert.rejects(callAdmin(adminApi.prepareReferralPayout, { ...args, batchId: 'batch2' }));
  await callAdmin(adminApi.transitionReferralPayout, { batchId: 'batch1', action: 'sending', reason: 'Bank transfer prepared' });
  const settle = { batchId: 'batch1', action: 'paid', amountCents: 3000, reason: 'Bank confirms settled', transferReference: 'bank-confirmation-123' };
  await callAdmin(adminApi.transitionReferralPayout, settle); await callAdmin(adminApi.transitionReferralPayout, settle);
  refunds.push({ id: 're_1', amount: 30000, status: 'succeeded' }); await paid();
  assert.equal(balance().paidCents, 3000); assert.equal(balance().availableCents, -3000); assertBalanced();
});
test('refund during reservation prevents sending; cancel releases only net funds', async () => {
  await available(); await callAdmin(adminApi.prepareReferralPayout, { carrierId: 'A', batchId: 'batch1', rewardIds: ['in_1'], reason: 'Verified payout test' });
  refunds.push({ id: 're_1', amount: 10000, status: 'succeeded' }); await paid();
  await assert.rejects(callAdmin(adminApi.transitionReferralPayout, { batchId: 'batch1', action: 'sending', reason: 'Bank transfer prepared' }));
  await callAdmin(adminApi.transitionReferralPayout, { batchId: 'batch1', action: 'cancel', reason: 'Refund before transfer' });
  assert.equal(balance().availableCents, 2000); assert.equal(balance().reservedCents, 0); assertBalanced();
});
test('post-payout dispute holds debt, loss preserves payment history', async () => {
  await available(); await callAdmin(adminApi.prepareReferralPayout, { carrierId: 'A', batchId: 'batch1', rewardIds: ['in_1'], reason: 'Verified payout test' });
  await callAdmin(adminApi.transitionReferralPayout, { batchId: 'batch1', action: 'sending', reason: 'Bank transfer prepared' });
  await callAdmin(adminApi.transitionReferralPayout, { batchId: 'batch1', action: 'paid', amountCents: 3000, reason: 'Bank confirms settled', transferReference: 'bank-confirmation-123' });
  disputes.push({ id: 'dp_1', status: 'needs_response', amount: 30000 }); await paid();
  assert.equal(balance().availableCents, -3000); assert.equal(balance().heldCents, 3000);
  disputes[0].status = 'lost'; await paid(); assert.equal(balance().heldCents, 0); assert.equal(balance().paidCents, 3000); assertBalanced();
});
test('clients without financial admin claims cannot retrieve or change payouts', async () => {
  await assert.rejects(adminApi.referralAdminReport.run({ data: { kind: 'ledger' }, auth: { uid: 'A', token: {} } }), /administrator/);
});
test('claim deadline boundaries', () => {
  assert(claimIsTimely(0, 86400000)); assert(!claimIsTimely(0, 86400001)); assert(!claimIsTimely(100, 99));
  assert.equal(calculateRewardCents(19, 1000), 1);
  assert.deepEqual(entitlementDelta('available', 100, 'held', 100), { availableCents: -100, heldCents: 100 });
});
function seedCode() {
  db.seed('referralCodes/ABCDEFGH', { carrierId: 'A', active: true });
  db.seed('carrierReferralCodes/A', { code: 'ABCDEFGH', active: true });
}
const claim = (uid, code = 'ABCDEFGH') => referrals.claimReferral.run({ auth: { uid }, data: { code } });
test('self-referral, late claim and duplicate claim cannot alter attribution', async () => {
  seedCode(); await assert.rejects(claim('A'), /itself/);
  await db.collection('referrals').doc('B').delete(); userCreated = Date.now() - 86401000;
  await assert.rejects(claim('B'), /initial account/); userCreated = Date.now() - 1000;
  await claim('B'); assert.equal((await claim('B')).status, 'already-claimed');
  await assert.rejects(claim('B', 'BCDEFGHJ'), /already been attributed/);
});
test('same normalized company cannot self-refer or register twice', async () => {
  seedCode(); await db.collection('referrals').doc('B').delete();
  db.seed('carriers/B', { usdotNumber: '000123', billing: { status: 'active' } });
  await assert.rejects(claim('B'), /same USDOT/);
  db.seed('carriers/B', { usdotNumber: '456', billing: { status: 'active' } });
  db.seed('referralCompanies/456', { carrierId: 'OLD_LOGIN', attributed: true });
  await assert.rejects(claim('B'), /already registered/);
});
test('code collision retries without overwriting another owner', async () => {
  const crypto = require('node:crypto'), original = crypto.randomBytes;
  let draws = 0;
  crypto.randomBytes = () => Buffer.alloc(8, draws++ === 0 ? 0 : 1);
  db.seed('referralCodes/AAAAAAAA', { carrierId: 'OTHER', active: false });
  try {
    const result = await referrals.getReferralCode.run({ auth: { uid: 'A' }, data: { acceptTerms: true } });
    assert.equal(result.code, 'BBBBBBBB'); assert.equal(db.read('referralCodes/AAAAAAAA').carrierId, 'OTHER');
  } finally { crypto.randomBytes = original; }
});
test('deleted accounts keep existing reward refunds and immutable journals', async () => {
  await paid(); await db.collection('carriers').doc('B').delete();
  refunds.push({ id: 're_1', amount: 30000, status: 'succeeded' }); await paid();
  assert.equal(balance().pendingCents, 0); assert(journal().length >= 2); assertBalanced();
});
