const { test } = require('node:test');
const assert = require('node:assert/strict');
const { blocksAppOnlyCheckoutForManagedSignup } = require('../lib/managedQuotes.js');

test('an ended managed signup does not block restarting app access', () => {
  const quote = { signupQuote: true, status: 'paid_awaiting_start', requestRevision: 1 };
  assert.equal(blocksAppOnlyCheckoutForManagedSignup(quote, { status: 'ended', revision: 1 }), false);
  assert.equal(blocksAppOnlyCheckoutForManagedSignup(quote, { status: 'paid_awaiting_start', revision: 1 }), true);
  assert.equal(blocksAppOnlyCheckoutForManagedSignup(quote, { status: 'accepted', revision: 1 }), true);
});
