const { test } = require('node:test');
const assert = require('node:assert/strict');
const { managedItems } = require('../lib/managedQuotes.js');
const { calculateManagedPrice } = require('../lib/managedPricing.js');

test('the $10 driver quote matches Stripe checkout and renewal line items', () => {
  const areas = { company: true, drivers: true, fleet: true };
  const counts = { drivers: 1, trucks: 1, trailers: 1, dqFiles: 1 };
  const price = calculateManagedPrice(areas, counts);
  const row = { areas, counts, price };
  const checkout = managedItems(row);
  const recurring = checkout.filter(item => item.price_data.recurring);
  const oneTime = checkout.filter(item => !item.price_data.recurring);
  const sum = items => items.reduce((total, item) =>
    total + item.price_data.unit_amount * item.quantity, 0);
  assert.equal(sum(recurring), price.firstYearMonthly * 100);
  assert.equal(sum(oneTime), price.dqFileOneTime * 100);
  assert.equal(recurring.find(item => item.price_data.product_data.name === 'Managed Driver compliance').price_data.unit_amount, 1000);
  assert.equal(sum(managedItems(row, true)), price.renewalMonthly * 100);
});
