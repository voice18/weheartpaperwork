// Temporary, clearly labeled staging fixtures for the managed-service owner queue.
// Usage: node scripts/staging-managed-fixtures.mjs seed|contacts|clean walkthrough|load
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [action, set] = process.argv.slice(2);
if (!["seed", "contacts", "clean"].includes(action) || !["walkthrough", "load"].includes(set)
  || (action === "contacts" && set !== "walkthrough")) {
  throw new Error("Usage: node scripts/staging-managed-fixtures.mjs seed|contacts|clean walkthrough|load");
}
const project = "weheartpaperwork-staging";
const resource = `projects/${project}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${resource}`;
const config = JSON.parse(readFileSync(join(homedir(), ".config", "configstore", "firebase-tools.json"), "utf8"));
if (!config.tokens?.access_token || Date.now() >= Number(config.tokens.expires_at) - 60000) {
  throw new Error("Firebase CLI access has expired. Run firebase login:list, then retry.");
}
const headers = { Authorization: `Bearer ${config.tokens.access_token}`, "Content-Type": "application/json" };
const prefix = set === "walkthrough" ? "whpDemoWalk20261030" : "whpDemoLoad20261030";

function field(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, field(item)])) } };
}
function doc(path, data) {
  return { path, update: { name: `${resource}/${path}`, fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, field(v)])) } };
}
const allDue = {
  mcs150: "2027-04-15", tax2290: "2027-08-31", "fmcsa-portal": "2027-03-10",
  ucr: "2027-12-31", ifta: "2027-12-31", "ifta-quarterly": "2027-01-31",
  irp: "2027-05-10", insurance: "2027-04-10", drug: "2027-06-10", boc3: "2027-09-10",
};
const samples = [
  { name: "DEMO 01 · Cascade Trucking", areas: [true, false, false], due: { mcs150: "2026-10-22", irp: "2026-11-12" } },
  { name: "DEMO 02 · Columbia Freight", areas: [true, true, true], due: { irp: "2026-11-16" }, driver: true, fleet: true },
  { name: "DEMO 03 · Yakima Carrier", areas: [true, false, true], due: { mcs150: "2026-12-12" }, fleet: true },
  { name: "DEMO 04 · Olympic Transport", areas: [true, false, false], due: { irp: "2026-11-18" }, waiting: true },
  { name: "DEMO 05 · Rainier Logistics", areas: [true, true, false], due: { insurance: null }, driver: true },
  { name: "DEMO 06 · Evergreen Fleet", areas: [false, false, true], fleet: true },
];
function walkthrough() {
  const rows = [];
  samples.forEach((sample, index) => {
    const id = `${prefix}${String(index + 1).padStart(3, "0")}`;
    rows.push(doc(`carriers/${id}`, { companyName: sample.name, stagingDemo: true }));
    rows.push(doc(`managedServiceCoverage/${id}`, {
      status: "active", areas: { company: sample.areas[0], drivers: sample.areas[1], fleet: sample.areas[2] },
      effectiveDate: "2026-10-30", consentReference: "STAGING DEMO ONLY — no customer agreement",
      stagingDemo: true,
    }));
    rows.push(doc(`managedServiceRequests/${id}`, {
      carrierId: id, companyName: sample.name,
      accountEmail: `demo${String(index + 1).padStart(2, "0")}@example.invalid`,
      preferredEmail: `demo${String(index + 1).padStart(2, "0")}@example.invalid`,
      preferredPhone: `+1509555010${index + 1}`,
      textPermission: index === 1,
      areas: { company: sample.areas[0], drivers: sample.areas[1], fleet: index === 3 ? true : sample.areas[2] },
      status: index === 3 ? "change_requested" : "active", stagingDemo: true,
    }));
    if (sample.areas[0]) for (const [key, defaultDue] of Object.entries(allDue)) {
      rows.push(doc(`carriers/${id}/compliance/${key}`, {
        dueDate: Object.hasOwn(sample.due, key) ? sample.due[key] : defaultDue,
        completed: false, applicable: true, stagingDemo: true,
      }));
    }
    if (sample.driver) rows.push(doc(`carriers/${id}/drivers/demoDriver`, {
      name: "DEMO Driver", status: "active", cdlExpiration: "2026-11-24",
      medicalExpiration: "2027-08-01", mvrDue: "2026-01-15",
      clearinghouseDue: "2026-02-15", stagingDemo: true,
    }));
    if (sample.fleet) rows.push(doc(`carriers/${id}/vehicles/demoTruck`, {
      unitNumber: "DEMO-1", type: "truck", status: "active",
      registrationExpiration: index === 2 ? "2026-12-22" : "2027-07-01",
      inspectionExpiration: index === 1 ? "2026-11-08" : "2027-04-01", stagingDemo: true,
    }));
    if (sample.waiting) {
      const itemKey = "company:irp";
      rows.push(doc(`managedServiceWork/${id}/items/${Buffer.from(itemKey).toString("base64url")}`, {
        status: "waiting_on_customer", dueDateSnapshot: sample.due.irp,
        note: "DEMO ONLY: waiting for customer registration document", stagingDemo: true,
      }));
    }
  });
  return rows;
}
function loadRows() {
  const rows = [];
  for (let n = 1; n <= 100; n++) {
    const id = `${prefix}${String(n).padStart(3, "0")}`;
    rows.push(doc(`carriers/${id}`, { companyName: `DEMO LOAD ${String(n).padStart(3, "0")} · Sample Carrier`, stagingDemo: true }));
    rows.push(doc(`managedServiceCoverage/${id}`, {
      status: "active", areas: { company: true, drivers: false, fleet: false },
      effectiveDate: "2026-10-30", consentReference: "STAGING LOAD TEST ONLY", stagingDemo: true,
    }));
    rows.push(doc(`carriers/${id}/compliance/irp`, {
      dueDate: n % 3 === 0 ? "2026-10-25" : n % 3 === 1 ? "2026-11-18" : "2026-12-18",
      completed: false, applicable: true, stagingDemo: true,
    }));
  }
  return rows;
}
const rows = set === "walkthrough" ? walkthrough() : loadRows();
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 450)}`);
  return response.json();
}
async function listedChildren(parent, collection) {
  const found = [];
  let pageToken;
  do {
    const url = new URL(`${base}/${parent}/${collection}`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers });
    if (response.status === 404) return found;
    if (!response.ok) throw new Error(`Could not list ${collection}: ${response.status}`);
    const data = await response.json();
    found.push(...(data.documents || []).map(row => row.name));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return found;
}
if (action === "seed" || action === "contacts") {
  // Refuse to overwrite any existing record, including old demo records with these IDs.
  const selected = action === "contacts"
    ? rows.filter(row => row.path.startsWith("managedServiceRequests/")) : rows;
  const writes = selected.map(row => ({ update: row.update, currentDocument: { exists: false } }));
  await request(`${base}:commit`, { method: "POST", body: JSON.stringify({ writes }) });
  console.log(`Created ${set} staging ${action === "contacts" ? "contact" : "company"} fixtures: ${selected.length} documents. No customer accounts or messages.`);
} else {
  const names = new Set(rows.map(row => row.update.name));
  const count = set === "load" ? 100 : 6;
  for (let n = 1; n <= count; n++) {
    const id = `${prefix}${String(n).padStart(3, "0")}`;
    if (set === "walkthrough") for (const [parent, sub] of [
      [`carriers/${id}`, "compliance"], [`carriers/${id}`, "drivers"], [`carriers/${id}`, "vehicles"],
      [`carriers/${id}`, "customRequirements"], [`managedServiceWork/${id}`, "items"],
      [`managedServiceCoverage/${id}`, "events"], [`managedServiceActivity/${id}`, "events"],
    ]) for (const name of await listedChildren(parent, sub)) names.add(name);
    for (const collection of ["managedServiceSignals", "managedServiceActivity", "managedServiceRequests"])
      names.add(`${resource}/${collection}/${id}`);
  }
  // A missing document is harmless to delete. Only deterministic DEMO IDs are included.
  const writes = [...names].map(name => ({ delete: name }));
  for (let start = 0; start < writes.length; start += 400)
    await request(`${base}:commit`, { method: "POST", body: JSON.stringify({ writes: writes.slice(start, start + 400) }) });
  console.log(`Removed ${set} staging fixtures for ${count} DEMO companies (${writes.length} document paths).`);
}
