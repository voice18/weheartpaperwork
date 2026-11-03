// Creates one clearly labeled staging-only company for reviewing the new-unit queue.
// Usage: node scripts/staging-managed-new-unit-demo.mjs seed|verify|clean
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const action = process.argv[2];
if (!["seed", "verify", "clean"].includes(action)) throw new Error("Use seed, verify, or clean.");
const project = "weheartpaperwork-staging";
const id = "whpDemoNewUnit20261103";
const resource = `projects/${project}/databases/(default)/documents`;
const root = `https://firestore.googleapis.com/v1/${resource}`;
const config = JSON.parse(readFileSync(join(homedir(), ".config", "configstore", "firebase-tools.json"), "utf8"));
if (!config.tokens?.access_token || Date.now() >= Number(config.tokens.expires_at) - 60000)
  throw new Error("Firebase CLI sign-in expired. Reauthorize before retrying.");
const headers = { Authorization: `Bearer ${config.tokens.access_token}`, "Content-Type": "application/json" };

function field(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, field(item)])) } };
}
function write(path, data) {
  return { update: { name: `${resource}/${path}`,
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, field(value)])) },
    currentDocument: { exists: false } };
}
async function read(path) {
  const response = await fetch(`${root}/${path}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Staging read failed: ${response.status}`);
  return response.json();
}
async function commit(writes) {
  const response = await fetch(`${root}:commit`, { method: "POST", headers, body: JSON.stringify({ writes }) });
  if (!response.ok) throw new Error(`Staging write failed: ${response.status} ${(await response.text()).slice(0, 400)}`);
}

const carrierPath = `carriers/${id}`;
const coveragePath = `managedServiceCoverage/${id}`;
const requestPath = `managedServiceRequests/${id}`;
const unitPath = `carriers/${id}/drivers/newDriver`;
if (action === "seed") {
  await commit([
    write(carrierPath, { companyName: "DEMO · Newly Added Driver", stagingDemo: true }),
    write(coveragePath, { status: "active", areas: { company: false, drivers: true, fleet: false },
      effectiveDate: "2026-11-03", managedUnitIds: { driverIds: [], vehicleIds: [] },
      consentReference: "STAGING DEMO ONLY — no customer agreement", stagingDemo: true }),
    write(requestPath, { carrierId: id, companyName: "DEMO · Newly Added Driver",
      accountEmail: "demo-new-unit@example.invalid", preferredEmail: "demo-new-unit@example.invalid",
      preferredPhone: "+15095550199", status: "active", stagingDemo: true }),
    write(unitPath, { name: "DEMO New Driver", status: "active", cdlExpiration: "2027-05-01",
      stagingDemo: true }),
  ]);
  console.log(`Created staging-only new-unit demo ${id}. No Stripe subscription or real customer account was created.`);
} else if (action === "verify") {
  const [coverage, unit] = await Promise.all([read(coveragePath), read(unitPath)]);
  if (coverage?.fields?.stagingDemo?.booleanValue !== true || unit?.fields?.stagingDemo?.booleanValue !== true)
    throw new Error("The staging-only demo is missing or was changed.");
  const prefix = `managed_new_unit_${id}_newDriver_`;
  let notification = null;
  let pageToken;
  for (let page = 0; page < 10 && !notification; page++) {
    const url = new URL(`${root}/mail`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Could not inspect staging mail queue: ${response.status}`);
    const listing = await response.json();
    notification = (listing.documents || []).find(row => row.name.split("/").at(-1).startsWith(prefix));
    pageToken = listing.nextPageToken;
    if (!pageToken) break;
  }
  console.log(`Staging unit is outside managed coverage: ${
    (coverage.fields.managedUnitIds?.mapValue?.fields?.driverIds?.arrayValue?.values || []).length === 0}`);
  console.log(`Owner notification queued: ${Boolean(notification)}`);
  if (notification) console.log(`Delivery state: ${notification.fields?.delivery?.mapValue?.fields?.state?.stringValue || "not reported"}`);
} else {
  for (const path of [carrierPath, coveragePath, requestPath, unitPath]) {
    const document = await read(path);
    if (document && document.fields?.stagingDemo?.booleanValue !== true)
      throw new Error(`Refusing to delete non-demo data: ${path}`);
  }
  await commit([carrierPath, coveragePath, requestPath, unitPath].map(path => ({ delete: `${resource}/${path}` })));
  console.log(`Removed staging-only new-unit demo ${id}.`);
}
