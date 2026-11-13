const test = require("node:test");
const assert = require("node:assert/strict");
const { managedSupportAvailable } = require("../lib/managedRollout.js");

test("staging remains available for testing", () => {
  assert.equal(managedSupportAvailable("weheartpaperwork-staging", {}, "test"), true);
});

test("production is closed by default, including unknown projects", () => {
  assert.equal(managedSupportAvailable("dot-compliance-dashboard", {}, "carrier"), false);
  assert.equal(managedSupportAvailable(undefined, { enabled: true }, "carrier"), false);
});

test("pilot access is limited to listed carriers until public release", () => {
  const config = { enabled: true, public: false, pilotCarrierIds: ["pilot-a"] };
  assert.equal(managedSupportAvailable("dot-compliance-dashboard", config, "pilot-a"), true);
  assert.equal(managedSupportAvailable("dot-compliance-dashboard", config, "other"), false);
  assert.equal(managedSupportAvailable("dot-compliance-dashboard", config), false);
  assert.equal(managedSupportAvailable("dot-compliance-dashboard", { ...config, public: true }), true);
});
