const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isManagedSubscription, isLiveAppSubscription } = require('../lib/subscriptionKinds');

test('managed subscriptions never qualify as app access, even when active', () => {
  assert.equal(isManagedSubscription({ metadata: { serviceKind: 'managed' } }), true);
  assert.equal(isLiveAppSubscription({ status: 'active', metadata: { serviceKind: 'managed' } }), false);
  assert.equal(isLiveAppSubscription({ status: 'trialing', metadata: { serviceKind: 'managed' } }), false);
});

test('existing app subscriptions without a service marker retain access', () => {
  assert.equal(isLiveAppSubscription({ status: 'active', metadata: { carrierId: 'test' } }), true);
  assert.equal(isLiveAppSubscription({ status: 'trialing', metadata: {} }), true);
  assert.equal(isLiveAppSubscription({ status: 'canceled', metadata: {} }), false);
});
