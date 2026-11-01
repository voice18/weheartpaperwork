import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentDeleted, onDocumentWritten } from "firebase-functions/v2/firestore";

type Area = "company" | "drivers" | "fleet";
type Areas = Record<Area, boolean>;
type Data = Record<string, unknown>;
type WorkStatus = "not_started" | "instructions_sent" | "waiting_on_customer" | "follow_up_due" | "needs_review";
type Item = { key: string; area: Area; label: string; dueDate: string | null; days: number | null;
  issue: string | null; status: WorkStatus; note: string | null;
  sourceVersion: string | null; sourceInputDate: string | null };
const COMPANY_ITEMS = [
  ["mcs150", "MCS-150 / USDOT update"], ["tax2290", "Form 2290 heavy vehicle use tax"],
  ["fmcsa-portal", "FMCSA Portal access"], ["ucr", "UCR registration"],
  ["ifta", "IFTA license and decals"], ["ifta-quarterly", "IFTA quarterly return"],
  ["irp", "IRP registration renewal"], ["insurance", "Commercial auto insurance"],
  ["drug", "Drug and alcohol consortium renewal"], ["boc3", "BOC-3 process agent status"],
] as const;

function owner(request: { auth?: { uid: string; token: Record<string, unknown> } }): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  if (request.auth.token.ownerAdmin !== true) throw new HttpsError("permission-denied", "Owner access is required.");
  return request.auth.uid;
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new HttpsError("invalid-argument", "Invalid account or item ID.");
  return value;
}
function object(value: unknown): Data {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
}
function date(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
function plus(value: string | null, amount: number, unit: "day" | "year"): string | null {
  if (!value) return null;
  const parsed = new Date(value + "T00:00:00Z");
  if (unit === "day") parsed.setUTCDate(parsed.getUTCDate() + amount);
  else {
    const targetYear = parsed.getUTCFullYear() + amount;
    const month = parsed.getUTCMonth();
    const day = parsed.getUTCDate();
    const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
    parsed.setUTCFullYear(targetYear, month, Math.min(day, lastDay));
  }
  return parsed.toISOString().slice(0, 10);
}
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
async function contactForCarrier(carrierId: string, carrier: Data, request: Data) {
  let accountEmail = typeof request.accountEmail === "string" ? request.accountEmail : "";
  if (!accountEmail && typeof carrier.email === "string") accountEmail = carrier.email;
  if (!accountEmail && carrier.stagingDemo !== true) {
    try { accountEmail = (await admin.auth().getUser(carrierId)).email || ""; }
    catch { /* A carrier record can outlive its auth account. */ }
  }
  return {
    accountEmail,
    preferredEmail: typeof request.preferredEmail === "string" ? request.preferredEmail : "",
    preferredPhone: typeof request.preferredPhone === "string" ? request.preferredPhone : "",
    accountPhone: typeof carrier.phoneNumber === "string" ? carrier.phoneNumber : "",
    textPermission: typeof request.textPermission === "boolean" ? request.textPermission : null,
  };
}
function add(items: Item[], key: string, area: Area, label: string, raw: unknown,
  current: string, issue: string | null = null): void {
  const dueDate = date(raw);
  items.push({ key, area, label, dueDate, issue: issue ?? (dueDate ? null : "Missing date"),
    days: dueDate ? Math.round((Date.parse(dueDate + "T00:00:00Z") - Date.parse(current + "T00:00:00Z")) / 86400000) : null,
    status: "not_started", note: null, sourceVersion: null, sourceInputDate: null });
}
async function account(carrierId: string, coverage: Data) {
  const db = admin.firestore();
  const ref = db.collection("carriers").doc(carrierId);
  const [carrier, compliance, drivers, vehicles, custom, work, request] = await Promise.all([
    ref.get(), ref.collection("compliance").get(), ref.collection("drivers").get(),
    ref.collection("vehicles").get(), ref.collection("customRequirements").get(),
    db.collection("managedServiceWork").doc(carrierId).collection("items").get(),
    db.collection("managedServiceRequests").doc(carrierId).get(),
  ]);
  if (!carrier.exists || carrier.data()?.deletingAccount === true) return null;
  const areas = object(coverage.areas);
  const current = today();
  const items: Item[] = [];
  const pendingCustom: { id: string; name: string; reason: string; kind?: "unit" }[] = [];
  const managedUnits = object(coverage.managedUnitIds);
  const driverIds = Array.isArray(managedUnits.driverIds) ? new Set(managedUnits.driverIds) : null;
  const vehicleIds = Array.isArray(managedUnits.vehicleIds) ? new Set(managedUnits.vehicleIds) : null;
  if (areas.company === true) {
    const stored = new Map(compliance.docs.map(row => [row.id, row.data()]));
    for (const [key, label] of COMPANY_ITEMS) {
      const value = stored.get(key) ?? {};
      if (value.applicable === false || value.completed === true) continue;
      const due = key === "fmcsa-portal"
        ? date(value.dueDate) ?? plus(date(value.enteredDate), 90, "day") : value.dueDate;
      add(items, "company:" + key, "company", label, due, current,
        key === "boc3" ? "Verify filing status" : null);
    }
  }
  if (areas.drivers === true) for (const row of drivers.docs) {
    const value = row.data();
    if (value.status === "inactive") continue;
    const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Driver";
    if (driverIds && !driverIds.has(row.id)) {
      pendingCustom.push({ id: row.id, name, kind: "unit", reason: "New driver is outside the paid scope; review and quote before managing" });
      continue;
    }
    add(items, "driver:" + row.id + ":cdl", "drivers", name + " · CDL expiration", value.cdlExpiration, current);
    add(items, "driver:" + row.id + ":medical", "drivers", name + " · Medical qualification", value.medicalExpiration, current);
    add(items, "driver:" + row.id + ":mvr", "drivers", name + " · Annual MVR review",
      plus(date(value.mvrDue), 1, "year"), current);
    add(items, "driver:" + row.id + ":clearinghouse", "drivers", name + " · Annual Clearinghouse query",
      plus(date(value.clearinghouseDue), 365, "day"), current);
    const checks = ["employmentApplicationOnFile", "initialMvrOnFile", "roadTestOnFile",
      "preEmploymentClearinghouseQueryComplete", "preEmploymentDrugTestComplete",
      "previousEmployerInvestigationComplete"].filter(field => value[field] === true).length
      + ["speStatus", "lcvStatus"].filter(field =>
        value[field] === "on_file" || value[field] === "not_applicable").length;
    if (checks < 8) add(items, "driver:" + row.id + ":dq", "drivers",
      name + " · DQ setup checklist (" + checks + "/8)", null, current, "Setup needs review");
  }
  if (areas.fleet === true) for (const row of vehicles.docs) {
    const value = row.data();
    if (value.status === "inactive") continue;
    const unit = typeof value.unitNumber === "string" && value.unitNumber.trim() ? value.unitNumber.trim() : "Vehicle";
    if (vehicleIds && !vehicleIds.has(row.id)) {
      pendingCustom.push({ id: row.id, name: unit, kind: "unit", reason: "New vehicle is outside the paid scope; review and quote before managing" });
      continue;
    }
    const label = (value.type === "trailer" ? "Trailer " : "Truck ") + unit;
    if (!(value.type === "trailer" && value.registrationPermanent === true))
      add(items, "fleet:" + row.id + ":registration", "fleet", label + " · Registration",
        value.registrationExpiration, current);
    add(items, "fleet:" + row.id + ":inspection", "fleet", label + " · Annual DOT inspection",
      value.inspectionExpiration, current);
  }
  const accepted = Array.isArray(coverage.acceptedCustomIds)
    ? coverage.acceptedCustomIds.filter((v): v is string => typeof v === "string") : [];
  const acceptedDueDates = object(coverage.acceptedCustomDueDates);
  if (areas.company === true) for (const row of custom.docs) {
    const value = row.data();
    if (value.active === false || value.completed === true) continue;
    const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Custom requirement";
    const unverifiedRecurrence = value.scheduleType === "rolling";
    if (!accepted.includes(row.id) || unverifiedRecurrence || acceptedDueDates[row.id] !== value.dueDate) {
      pendingCustom.push({ id: row.id, name, reason: unverifiedRecurrence
        ? "Recurring custom schedule needs review; use a fixed verified filing due date"
        : accepted.includes(row.id) ? "Due date changed after acceptance; verify again"
        : "Confirm applicability and actual due date before accepting" });
      continue;
    }
    add(items, "custom:" + row.id, "company", name, value.dueDate, current);
  }
  const states = new Map(work.docs.map(row => [row.id, row.data()]));
  for (const item of items) {
    const saved = states.get(Buffer.from(item.key).toString("base64url"));
    if (!saved) continue;
    if (saved.dueDateSnapshot !== item.dueDate) {
      item.status = "needs_review";
      item.note = "The app date changed since your last action";
    } else if (["instructions_sent", "waiting_on_customer", "follow_up_due"].includes(saved.status)) {
      item.status = saved.status;
      item.note = typeof saved.note === "string" ? saved.note : null;
    }
  }
  const complianceSources = new Map(compliance.docs.map(row => [row.id, row]));
  const driverSources = new Map(drivers.docs.map(row => [row.id, row]));
  const vehicleSources = new Map(vehicles.docs.map(row => [row.id, row]));
  const customSources = new Map(custom.docs.map(row => [row.id, row]));
  for (const item of items) {
    const parts = item.key.split(":");
    const source = parts[0] === "company" ? complianceSources.get(parts[1])
      : parts[0] === "driver" ? driverSources.get(parts[1])
      : parts[0] === "fleet" ? vehicleSources.get(parts[1])
      : parts[0] === "custom" ? customSources.get(parts[1]) : undefined;
    item.sourceVersion = source?.updateTime ? source.updateTime.seconds + "." + String(source.updateTime.nanoseconds).padStart(9, "0") : null;
    const field = parts[0] === "company" ? parts[1] === "fmcsa-portal" ? "enteredDate" : "dueDate"
      : parts[0] === "custom" ? "dueDate"
      : parts[0] === "driver" ? ({
        cdl: "cdlExpiration", medical: "medicalExpiration", mvr: "mvrDue",
        clearinghouse: "clearinghouseDue",
      } as Record<string, string>)[parts[2]]
      : parts[0] === "fleet" ? parts[2] === "registration" ? "registrationExpiration"
        : parts[2] === "inspection" ? "inspectionExpiration" : null : null;
    item.sourceInputDate = field ? date(source?.data()?.[field]) : null;
  }
  items.sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99")
    || a.label.localeCompare(b.label));
  const counts = {
    overdue: items.filter(v => v.days !== null && v.days < 0).length,
    due30: items.filter(v => v.days !== null && v.days >= 0 && v.days <= 30).length,
    due90: items.filter(v => v.days !== null && v.days >= 0 && v.days <= 90).length,
    needsInfo: items.filter(v => v.issue !== null || v.status === "needs_review").length + pendingCustom.length,
    waiting: items.filter(v => v.status === "waiting_on_customer").length,
  };
  const data = carrier.data() ?? {};
  const contact = await contactForCarrier(carrierId, data, request.data() ?? {});
  return { carrierId, companyName: String(data.companyName || "Unnamed company"),
    billingStatus: object(data.billing).status ?? null,
    contact,
    coverage: { status: coverage.status ?? "draft", areas, effectiveDate: coverage.effectiveDate ?? null,
      anniversaryDate: plus(date(coverage.effectiveDate), 1, "year") },
    counts, items, pendingCustom };
}
export const findManagedServiceCandidate = onCall({ region: "us-central1" }, async request => {
  owner(request);
  if (request.data?.carrierId !== undefined) {
    const carrierId = identifier(request.data.carrierId);
    const db = admin.firestore();
    const [carrier, coverage, serviceRequest] = await Promise.all([
      db.collection("carriers").doc(carrierId).get(),
      db.collection("managedServiceCoverage").doc(carrierId).get(),
      db.collection("managedServiceRequests").doc(carrierId).get(),
    ]);
    if (!carrier.exists || carrier.data()?.deletingAccount === true)
      throw new HttpsError("not-found", "No active carrier record found.");
    return { carrierId, companyName: carrier.data()?.companyName ?? "Unnamed company",
      billingStatus: carrier.data()?.billing?.status ?? null,
      contact: await contactForCarrier(carrierId, carrier.data() ?? {}, serviceRequest.data() ?? {}),
      coverage: coverage.exists ? coverage.data() : null };
  }
  const email = typeof request.data?.email === "string" ? request.data.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)
    throw new HttpsError("invalid-argument", "Enter the customer's account email.");
  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch (error) {
    if ((error as { code?: string })?.code === "auth/user-not-found")
      throw new HttpsError("not-found", "No account found for that email.");
    throw error;
  }
  const carrier = await admin.firestore().collection("carriers").doc(user.uid).get();
  if (!carrier.exists || carrier.data()?.deletingAccount === true)
    throw new HttpsError("not-found", "No active carrier record found.");
  const coverage = await admin.firestore().collection("managedServiceCoverage").doc(user.uid).get();
  const serviceRequest = await admin.firestore().collection("managedServiceRequests").doc(user.uid).get();
  return { carrierId: user.uid, companyName: carrier.data()?.companyName ?? "Unnamed company",
    billingStatus: carrier.data()?.billing?.status ?? null,
    contact: await contactForCarrier(user.uid, carrier.data() ?? {}, serviceRequest.data() ?? {}),
    coverage: coverage.exists ? coverage.data() : null };
});
export const listManagedServiceCandidates = onCall({ region: "us-central1" }, async request => {
  owner(request);
  const cursor = request.data?.cursor === undefined ? null : identifier(request.data.cursor);
  const db = admin.firestore();
  let query = db.collection("carriers").orderBy(admin.firestore.FieldPath.documentId()).limit(51);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  const page = snapshot.docs.slice(0, 50).filter(row => row.data().deletingAccount !== true);
  const coverage = await Promise.all(page.map(row =>
    db.collection("managedServiceCoverage").doc(row.id).get()));
  const companies = page.map((row, index) => ({
    carrierId: row.id,
    companyName: String(row.data().companyName || "Unnamed company"),
    billingStatus: row.data().billing?.status ?? null,
    coverage: coverage[index].exists ? coverage[index].data() : null,
  }));
  companies.sort((a, b) => a.companyName.localeCompare(b.companyName));
  return { companies, nextCursor: snapshot.docs.length > 50 ? snapshot.docs[49].id : null };
});
export const saveManagedServiceCoverage = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const status = request.data?.status;
  if (!["draft", "active", "paused"].includes(status))
    throw new HttpsError("invalid-argument", "Invalid service status.");
  const input = object(request.data?.areas);
  const areas: Areas = { company: input.company === true, drivers: input.drivers === true, fleet: input.fleet === true };
  if (!areas.company && !areas.drivers && !areas.fleet)
    throw new HttpsError("invalid-argument", "Select at least one managed tab.");
  const effectiveDate = date(request.data?.effectiveDate);
  if (!effectiveDate) throw new HttpsError("invalid-argument", "Enter YYYY-MM-DD effective date.");
  const consentReference = typeof request.data?.consentReference === "string"
    ? request.data.consentReference.trim().slice(0, 300) : "";
  if (status === "active" && consentReference.length < 8)
    throw new HttpsError("failed-precondition", "Record where the customer agreed to this scope.");
  const db = admin.firestore();
  const carrier = await db.collection("carriers").doc(carrierId).get();
  if (!carrier.exists || carrier.data()?.deletingAccount === true)
    throw new HttpsError("not-found", "Carrier not found.");
  if (status === "active" && effectiveDate > today())
    throw new HttpsError("failed-precondition", "Use draft until the effective date arrives.");
  if (status === "active" && !["active", "trialing"].includes(carrier.data()?.billing?.status))
    throw new HttpsError("failed-precondition", "Customer app access must be active before managed coverage begins.");
  const ref = db.collection("managedServiceCoverage").doc(carrierId);
  const requestRef = db.collection("managedServiceRequests").doc(carrierId);
  const quoteRef = db.collection("managedServiceQuotes").doc(carrierId);
  const billingRef = db.collection("managedServiceBilling").doc(carrierId);
  await db.runTransaction(async tx => {
    const [previous, serviceRequest, quote, billing] = await Promise.all([
      tx.get(ref), tx.get(requestRef), tx.get(quoteRef), tx.get(billingRef),
    ]);
    if (status === "active") {
      const agreed = object(quote.data()?.areas);
      const continuing = previous.data()?.status === "active" && quote.data()?.status === "active" &&
        serviceRequest.data()?.status === "active";
      if ((!continuing && (quote.data()?.status !== "paid_awaiting_start" ||
          serviceRequest.data()?.status !== "paid_awaiting_start")) ||
          quote.data()?.requestRevision !== serviceRequest.data()?.revision ||
          billing.data()?.quoteId !== quote.data()?.quoteId ||
          billing.data()?.stripeSubscriptionId !== quote.data()?.stripeSubscriptionId ||
          billing.data()?.status !== "active" ||
          !["company", "drivers", "fleet"].every(key => (agreed[key] === true) === areas[key as Area]))
        throw new HttpsError("failed-precondition", "A matching paid managed quote is required before starting this coverage.");
      if (!continuing) {
        const unitIds = quote.data()?.units ?? {};
        const driverIds: string[] = Array.isArray(unitIds.driverIds) ? unitIds.driverIds : [];
        const vehicleIds: string[] = Array.isArray(unitIds.vehicleIds) ? unitIds.vehicleIds : [];
        const counts = quote.data()?.counts ?? {};
        if (driverIds.length !== counts.drivers || vehicleIds.length !== (counts.trucks || 0) + (counts.trailers || 0))
          throw new HttpsError("failed-precondition", "Quoted unit counts do not match the setup list.");
        const [driverDocs, vehicleDocs] = await Promise.all([
          Promise.all(driverIds.map(id => tx.get(db.collection("carriers").doc(carrierId).collection("drivers").doc(id)))),
          Promise.all(vehicleIds.map(id => tx.get(db.collection("carriers").doc(carrierId).collection("vehicles").doc(id)))),
        ]);
        if (driverDocs.some(row => !row.exists || row.data()?.status === "inactive") ||
            vehicleDocs.some(row => !row.exists || row.data()?.status === "inactive") ||
            vehicleDocs.filter(row => row.data()?.type === "trailer").length !== counts.trailers)
          throw new HttpsError("failed-precondition", "Add and verify every quoted active unit before starting managed coverage.");
      }
    }
    if (status === "paused" && billing.data()?.status === "active")
      throw new HttpsError("failed-precondition", "Managed billing is still active. Arrange cancellation before pausing coverage.");
    const acceptedCustomIds = Array.isArray(previous.data()?.acceptedCustomIds)
      ? previous.data()!.acceptedCustomIds : [];
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(ref, { status, areas, effectiveDate, consentReference, acceptedCustomIds,
      managedUnitIds: status === "active" ? quote.data()?.units ?? {} : previous.data()?.managedUnitIds ?? {},
      updatedAt: now, updatedBy: actor, ...(previous.exists ? {} : { createdAt: now }) }, { merge: true });
    if (serviceRequest.exists && (status === "active" || status === "paused"))
      tx.set(requestRef, { status, updatedAt: now }, { merge: true });
    if (status === "active" && quote.data()?.status !== "active")
      tx.update(quoteRef, { status: "active", activatedAt: now, activatedBy: actor });
    tx.create(ref.collection("events").doc(), {
      carrierId, actor, type: "coverage_updated", status, areas, effectiveDate, consentReference, createdAt: now });
  });
  return { saved: true };
});
function queueHighlights(items: Item[], pendingCustom: { name: string; reason: string }[]) {
  const first = (match: (item: Item) => boolean) => {
    const item = items.find(match);
    return item ? { label: item.label, dueDate: item.dueDate, issue: item.issue } : null;
  };
  return {
    overdue: first(item => item.days !== null && item.days < 0),
    due30: first(item => item.days !== null && item.days >= 0 && item.days <= 30),
    due90: first(item => item.days !== null && item.days >= 31 && item.days <= 90),
    needsInfo: pendingCustom.length > 0
      ? { label: pendingCustom[0].name, dueDate: null, issue: pendingCustom[0].reason }
      : first(item => item.issue !== null || item.status === "needs_review"),
    waiting: first(item => item.status === "waiting_on_customer"),
    all: first(() => true),
  };
}
export const listManagedServiceAccounts = onCall({ region: "us-central1", timeoutSeconds: 120 }, async request => {
  owner(request);
  const rows = await admin.firestore().collection("managedServiceCoverage").where("status", "==", "active").get();
  const accounts = [];
  for (let start = 0; start < rows.docs.length; start += 10) {
    const page = await Promise.all(rows.docs.slice(start, start + 10).map(row => account(row.id, row.data())));
    accounts.push(...page.filter((row): row is NonNullable<typeof row> => row !== null));
  }
  accounts.sort((a, b) => b.counts.overdue - a.counts.overdue
    || b.counts.needsInfo - a.counts.needsInfo || a.companyName.localeCompare(b.companyName));
  return { accounts: accounts.map(({ items, pendingCustom, ...row }) =>
    ({ ...row, itemCount: items.length, pendingCustomCount: pendingCustom.length,
      highlights: queueHighlights(items, pendingCustom) })) };
});
export const getManagedServiceAccount = onCall({ region: "us-central1" }, async request => {
  owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const coverage = await admin.firestore().collection("managedServiceCoverage").doc(carrierId).get();
  if (!coverage.exists) throw new HttpsError("not-found", "Managed coverage not found.");
  const result = await account(carrierId, coverage.data() ?? {});
  if (!result) throw new HttpsError("not-found", "Carrier not found.");
  const history = await admin.firestore().collection("managedServiceCoverage").doc(carrierId).collection("events")
    .orderBy("createdAt", "desc").limit(30).get();
  return { ...result, coverage: { ...result.coverage, consentReference: coverage.data()?.consentReference ?? "" }, history: history.docs.map(row => ({ id: row.id, type: row.data().type,
    itemKey: row.data().itemKey ?? null, itemLabel: row.data().itemLabel ?? null, note: row.data().note ?? null,
    createdAtMillis: row.data().createdAt?.toMillis?.() ?? null })) };
});
type EditableSource = { ref: FirebaseFirestore.DocumentReference; field: string; area: Area;
  mode: "due" | "lastYear" | "last365" | "last90"; kind: "company" | "driver" | "fleet" | "custom" };
function sourceForItem(db: FirebaseFirestore.Firestore, carrierId: string, key: string): EditableSource | null {
  const parts = key.split(":");
  const carrier = db.collection("carriers").doc(carrierId);
  if (parts[0] === "company" && parts.length === 2) {
    const id = parts[1];
    if (!["mcs150", "irp", "insurance", "drug", "fmcsa-portal"].includes(id)) return null;
    return { ref: carrier.collection("compliance").doc(id), field: id === "fmcsa-portal" ? "enteredDate" : "dueDate",
      area: "company", mode: id === "fmcsa-portal" ? "last90" : "due", kind: "company" };
  }
  if (parts[0] === "driver" && parts.length === 3) {
    const id = identifier(parts[1]);
    const mode = parts[2] === "mvr" ? "lastYear" : parts[2] === "clearinghouse" ? "last365" : "due";
    const field = ({ cdl: "cdlExpiration", medical: "medicalExpiration",
      mvr: "mvrDue", clearinghouse: "clearinghouseDue" } as Record<string, string>)[parts[2]];
    return field ? { ref: carrier.collection("drivers").doc(id), field, area: "drivers", mode, kind: "driver" } : null;
  }
  if (parts[0] === "fleet" && parts.length === 3) {
    const id = identifier(parts[1]);
    const field = parts[2] === "registration" ? "registrationExpiration"
      : parts[2] === "inspection" ? "inspectionExpiration" : null;
    return field ? { ref: carrier.collection("vehicles").doc(id), field, area: "fleet",
      mode: "due", kind: "fleet" } : null;
  }
  if (parts[0] === "custom" && parts.length === 2) {
    return { ref: carrier.collection("customRequirements").doc(identifier(parts[1])), field: "dueDate",
      area: "company", mode: "due", kind: "custom" };
  }
  return null;
}
function workSourceRef(db: FirebaseFirestore.Firestore, carrierId: string, key: string):
  FirebaseFirestore.DocumentReference | null {
  const parts = key.split(":");
  const carrier = db.collection("carriers").doc(carrierId);
  if (parts[0] === "company" && parts.length === 2 && COMPANY_ITEMS.some(row => row[0] === parts[1]))
    return carrier.collection("compliance").doc(parts[1]);
  if (parts[0] === "driver" && parts.length === 3
    && ["cdl", "medical", "mvr", "clearinghouse", "dq"].includes(parts[2]))
    return carrier.collection("drivers").doc(identifier(parts[1]));
  if (parts[0] === "fleet" && parts.length === 3
    && ["registration", "inspection"].includes(parts[2]))
    return carrier.collection("vehicles").doc(identifier(parts[1]));
  if (parts[0] === "custom" && parts.length === 2)
    return carrier.collection("customRequirements").doc(identifier(parts[1]));
  return null;
}
function sourceVersion(snapshot: FirebaseFirestore.DocumentSnapshot): string | null {
  const timestamp = snapshot.updateTime;
  return timestamp ? timestamp.seconds + "." + String(timestamp.nanoseconds).padStart(9, "0") : null;
}
function checkedVersion(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d+\.\d{9}$/.test(value))
    throw new HttpsError("invalid-argument", "Refresh this item before saving.");
  return value;
}
export const saveManagedServiceDeadline = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const itemKey = typeof request.data?.itemKey === "string" ? request.data.itemKey : "";
  const source = sourceForItem(admin.firestore(), carrierId, itemKey);
  if (!source) throw new HttpsError("failed-precondition", "This item does not support an owner date edit.");
  const inputDate = date(request.data?.inputDate);
  if (!inputDate) throw new HttpsError("invalid-argument", "Enter a valid date in YYYY-MM-DD format.");
  const expectedVersion = checkedVersion(request.data?.sourceVersion);
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  if (note.length < 8) throw new HttpsError("invalid-argument", "Record where you verified this date.");
  const nextDueDate = source.mode === "lastYear" ? plus(inputDate, 1, "year")
    : source.mode === "last365" ? plus(inputDate, 365, "day")
    : source.mode === "last90" ? plus(inputDate, 90, "day") : inputDate;
  if (!nextDueDate) throw new HttpsError("invalid-argument", "Could not calculate the next due date.");
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const activityRef = db.collection("managedServiceActivity").doc(carrierId).collection("events").doc();
  const privateEventRef = coverageRef.collection("events").doc();
  const coverageBefore = await coverageRef.get();
  const currentItem = (await account(carrierId, coverageBefore.data() ?? {}))
    ?.items.find(item => item.key === itemKey);
  if (!currentItem || currentItem.sourceVersion !== expectedVersion)
    throw new HttpsError("aborted", "This item changed. Refresh before saving.");
  return db.runTransaction(async tx => {
    const [coverage, current] = await Promise.all([tx.get(coverageRef), tx.get(source.ref)]);
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas)[source.area] !== true)
      throw new HttpsError("failed-precondition", "This area is not actively managed.");
    if (sourceVersion(current) !== expectedVersion)
      throw new HttpsError("aborted", "This item changed on the customer side. Refresh before saving.");
    if (source.kind !== "company" && !current.exists)
      throw new HttpsError("not-found", "This item no longer exists.");
    if (current.data()?.status === "inactive" || current.data()?.active === false
      || current.data()?.applicable === false || current.data()?.completed === true)
      throw new HttpsError("failed-precondition", "This item is no longer active.");
    if (source.kind === "custom") {
      const accepted = Array.isArray(coverage.data()?.acceptedCustomIds)
        ? coverage.data()!.acceptedCustomIds : [];
      if (!accepted.includes(itemKey.slice(7)) || current.data()?.scheduleType !== "fixed")
        throw new HttpsError("failed-precondition", "Verify and accept this custom date first.");
    }
    const previousInputDate = date(current.data()?.[source.field]);
    const previousDueDate = source.kind === "company" ? date(current.data()?.dueDate)
      : source.mode === "lastYear" ? plus(previousInputDate, 1, "year")
      : source.mode === "last365" ? plus(previousInputDate, 365, "day")
      : source.mode === "last90" ? plus(previousInputDate, 90, "day")
      : previousInputDate;
    if (previousInputDate === inputDate)
      return { saved: false, nextDueDate };
    const now = admin.firestore.FieldValue.serverTimestamp();
    const update: Record<string, unknown> = { [source.field]: inputDate, lastUpdated: now };
    if (source.kind === "company") {
      update.dueDate = nextDueDate;
      update.enteredDate = inputDate;
      update.completed = false;
      update.completedAt = null;
      update.notified30 = false;
      update.notified90 = false;
    }
    if (source.kind === "custom") update.completed = false;
    tx.set(source.ref, update, { merge: true });
    if (source.kind === "custom") {
      tx.update(coverageRef, { acceptedCustomDueDates: {
        ...object(coverage.data()?.acceptedCustomDueDates), [itemKey.slice(7)]: nextDueDate },
        updatedAt: now, updatedBy: actor });
    }
    tx.create(privateEventRef, { carrierId, actor, type: "date_updated", itemKey,
      itemLabel: currentItem.label, note,
      previousInputDate, inputDate, previousDueDate, nextDueDate, createdAt: now });
    tx.create(activityRef, { type: "date_updated", itemKey,
      itemLabel: currentItem.label,
      previousDueDate, nextDueDate, createdAt: now });
    return { saved: true, nextDueDate };
  });
});
export const updateManagedServiceWork = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const itemKey = typeof request.data?.itemKey === "string" ? request.data.itemKey : "";
  const status = request.data?.status;
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  const expectedVersion = checkedVersion(request.data?.sourceVersion);
  if (!["instructions_sent", "waiting_on_customer", "follow_up_due"].includes(status) || note.length < 3)
    throw new HttpsError("invalid-argument", "Choose an action and add a short note.");
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const coverage = await coverageRef.get();
  if (!coverage.exists || coverage.data()?.status !== "active")
    throw new HttpsError("failed-precondition", "Activate managed coverage first.");
  const result = await account(carrierId, coverage.data() ?? {});
  const item = result?.items.find(candidate => candidate.key === itemKey);
  if (!item) throw new HttpsError("not-found", "The managed item is no longer active.");
  if (item.sourceVersion !== expectedVersion)
    throw new HttpsError("aborted", "This item changed on the customer side. Refresh before logging work.");
  const sourceRef = workSourceRef(db, carrierId, itemKey);
  if (!sourceRef) throw new HttpsError("invalid-argument", "Unknown managed item.");
  const workRef = db.collection("managedServiceWork").doc(carrierId).collection("items")
    .doc(Buffer.from(itemKey).toString("base64url"));
  const eventRef = coverageRef.collection("events").doc();
  const activityRef = db.collection("managedServiceActivity").doc(carrierId).collection("events").doc();
  await db.runTransaction(async tx => {
    const [liveCoverage, liveSource] = await Promise.all([tx.get(coverageRef), tx.get(sourceRef)]);
    if (liveCoverage.data()?.status !== "active"
      || object(liveCoverage.data()?.areas)[item.area] !== true)
      throw new HttpsError("failed-precondition", "This area is not actively managed.");
    if (sourceVersion(liveSource) !== expectedVersion)
      throw new HttpsError("aborted", "This item changed on the customer side. Refresh before logging work.");
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(workRef, { itemKey, status, note, dueDateSnapshot: item.dueDate,
      updatedAt: now, updatedBy: actor });
    tx.create(eventRef, { carrierId, actor, type: status, itemKey, itemLabel: item.label,
      dueDateSnapshot: item.dueDate, note, createdAt: now });
    tx.create(activityRef, { type: status, itemKey, itemLabel: item.label,
      dueDateSnapshot: item.dueDate, createdAt: now });
  });
  return { saved: true };
});
export const acceptManagedCustomRequirement = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const customId = identifier(request.data?.customId);
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  if (note.length < 8) throw new HttpsError("invalid-argument", "Record how you verified this due date.");
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const customRef = db.collection("carriers").doc(carrierId).collection("customRequirements").doc(customId);
  const eventRef = coverageRef.collection("events").doc();
  return db.runTransaction(async tx => {
    const [coverage, custom] = await Promise.all([tx.get(coverageRef), tx.get(customRef)]);
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas).company !== true || !custom.exists)
      throw new HttpsError("failed-precondition", "Active managed Company coverage and an active custom item are required.");
    const value = custom.data() ?? {};
    if (value.active === false || value.completed === true || !date(value.dueDate) || value.scheduleType !== "fixed")
      throw new HttpsError("failed-precondition", "Use a verified active filing due date, not a period-end preset.");
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.update(coverageRef, { acceptedCustomIds: admin.firestore.FieldValue.arrayUnion(customId),
      acceptedCustomDueDates: { ...object(coverage.data()?.acceptedCustomDueDates), [customId]: value.dueDate },
      updatedAt: now, updatedBy: actor });
    tx.create(eventRef, { carrierId, actor, type: "custom_accepted", itemKey: "custom:" + customId,
      itemLabel: String(value.name || "Custom requirement"), dueDateSnapshot: value.dueDate,
      note, createdAt: now });
    return { saved: true };
  });
});

async function signalManagedChange(carrierId: string): Promise<void> {
  const db = admin.firestore();
  const [coverage, carrier] = await Promise.all([
    db.collection("managedServiceCoverage").doc(carrierId).get(),
    db.collection("carriers").doc(carrierId).get(),
  ]);
  const signal = db.collection("managedServiceSignals").doc(carrierId);
  if (carrier.exists && carrier.data()?.deletingAccount !== true && coverage.data()?.status === "active") {
    await signal.set({ changedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await signal.delete();
  }
}
export const signalManagedCarrierChange = onDocumentWritten(
  { document: "carriers/{carrierId}", region: "us-central1" },
  async event => signalManagedChange(event.params.carrierId));
export const signalManagedItemChange = onDocumentWritten(
  { document: "carriers/{carrierId}/{collectionId}/{docId}", region: "us-central1" },
  async event => signalManagedChange(event.params.carrierId));
export const signalManagedCoverageChange = onDocumentWritten(
  { document: "managedServiceCoverage/{carrierId}", region: "us-central1" },
  async event => signalManagedChange(event.params.carrierId));
export const signalManagedWorkChange = onDocumentWritten(
  { document: "managedServiceWork/{carrierId}/items/{itemId}", region: "us-central1" },
  async event => signalManagedChange(event.params.carrierId));

export const removeManagedServiceOnCarrierDeletion = onDocumentDeleted(
  { document: "carriers/{carrierId}", region: "us-central1" }, async event => {
    const carrierId = event.params.carrierId;
    const db = admin.firestore();
    await Promise.all([
      db.recursiveDelete(db.collection("managedServiceCoverage").doc(carrierId)),
      db.recursiveDelete(db.collection("managedServiceWork").doc(carrierId)),
      db.recursiveDelete(db.collection("managedServiceRequests").doc(carrierId)),
      db.recursiveDelete(db.collection("managedServiceQuotes").doc(carrierId)),
      db.collection("managedServiceBilling").doc(carrierId).delete(),
      db.recursiveDelete(db.collection("managedServiceActivity").doc(carrierId)),
      db.collection("managedServiceSignals").doc(carrierId).delete(),
    ]);
  });
