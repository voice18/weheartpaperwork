const test = require("node:test");
const assert = require("node:assert/strict");
const { managedContact, contactChanged } = require("../lib/managedContact.js");

test("normalizes a customer-entered US phone and preserves explicit no-text choice", () => {
  assert.deepEqual(managedContact({
    preferredEmail: " Owner@Example.com ", preferredPhone: "(509) 731-3164",
    textPermission: false,
  }), { preferredEmail: "owner@example.com", preferredPhone: "+15097313164", textPermission: false });
});

test("rejects a request without an explicit text choice or usable contact", () => {
  assert.throws(() => managedContact({ preferredEmail: "owner@example.com", preferredPhone: "509-731-3164" }), /Choose yes or no/);
  assert.throws(() => managedContact({ preferredEmail: "bad-email", preferredPhone: "509-731-3164", textPermission: true }), /valid best contact email/);
  assert.throws(() => managedContact({ preferredEmail: "owner@example.com", preferredPhone: "123", textPermission: false }), /valid best contact phone/);
});

test("a new number or changed text answer is a contact update", () => {
  const original = managedContact({ preferredEmail: "owner@example.com", preferredPhone: "509-731-3164", textPermission: false });
  assert.equal(contactChanged(original, { ...original }), false);
  assert.equal(contactChanged(original, { ...original, preferredPhone: "+15095550000" }), true);
  assert.equal(contactChanged(original, { ...original, textPermission: true }), true);
});
