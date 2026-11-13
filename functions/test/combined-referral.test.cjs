const assert = require('node:assert/strict');
const test = require('node:test');
const { qualifyingInvoiceCents } = require('../lib/referralLedgerRewards.js');

const appLine = { amount: 300, currency: 'usd', pricing: { price_details: { price: 'price_app' } },
  parent: { subscription_item_details: { subscription_item: 'si_app' } } };
const managedLine = { amount: 3700, currency: 'usd', pricing: { price_details: { price: 'price_managed' } },
  parent: { subscription_item_details: { subscription_item: 'si_managed' } } };
const invoice = { status: 'paid', amount_paid: 4000, total: 4000, total_excluding_tax: 4000,
  currency: 'usd', parent: { subscription_details: { subscription: 'sub_combined',
    metadata: { serviceKind: 'app_with_managed' } } } };

test('combined invoice rewards only the paid app portion', () => {
  assert.equal(qualifyingInvoiceCents(invoice, [appLine, managedLine], ['price_app']), 300);
});

test('partial cash and tax reduce the combined app allocation', () => {
  assert.equal(qualifyingInvoiceCents({ ...invoice, amount_paid: 2100, total: 4100 },
    [appLine, managedLine], ['price_app']), 150);
});

test('discounted combined invoices require review instead of guessed rewards', () => {
  assert.throws(() => qualifyingInvoiceCents({ ...invoice, total_excluding_tax: 3500, total: 3500 },
    [appLine, managedLine], ['price_app']), /discounts or adjustments/);
});

test('unknown mixed invoices remain in review', () => {
  assert.throws(() => qualifyingInvoiceCents({ ...invoice, parent: { subscription_details: {
    subscription: 'sub_other', metadata: {} } } }, [appLine, managedLine], ['price_app']),
  /Mixed\/unapproved/);
});
