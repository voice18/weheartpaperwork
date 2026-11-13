const assert = require('node:assert/strict');
const test = require('node:test');
const { approvedCheckoutReturnBaseUrl } = require('../lib/checkoutReturnOrigin.js');

test('Stripe returns to the staging preview that opened checkout', () => {
  const preview = 'https://weheartpaperwork-staging--managed-service-preview-2026-5zmakyg9.web.app';
  assert.equal(approvedCheckoutReturnBaseUrl(preview, 'weheartpaperwork-staging'), preview);
  assert.equal(approvedCheckoutReturnBaseUrl(`${preview}/managed-tracking?source=quote`, 'weheartpaperwork-staging'), preview);
});

test('unapproved origins cannot receive checkout returns', () => {
  const staging = 'https://weheartpaperwork-staging.web.app';
  assert.equal(approvedCheckoutReturnBaseUrl('https://example.com', 'weheartpaperwork-staging'), staging);
  assert.equal(approvedCheckoutReturnBaseUrl('http://weheartpaperwork-staging--test.web.app', 'weheartpaperwork-staging'), staging);
  assert.equal(approvedCheckoutReturnBaseUrl('https://weheartpaperwork-staging--test.web.app', 'dot-compliance-dashboard'), 'https://weheartpaperwork.com');
});
