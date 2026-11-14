import * as admin from "firebase-admin";
import { createHash } from "node:crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentDeleted, onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { queueOwnerEmail } from "./ownerNotifications";
import { MANAGED_PRICING } from "./managedPricing";
import { managedUnitIdsForSave } from "./managedCoverageTransition";
import { addUnitToManagedBilling, removeUnitFromManagedBilling } from "./managedUnitBilling";
import { complianceAddDays, complianceAddYears, complianceDaysFrom, complianceToday, complianceUsdotDue, complianceNextIftaQuarterDue, complianceFollowingIftaQuarterDue, complianceIftaQuarterEnd, complianceFixedCalendarDue, validComplianceDate } from "./sharedComplianceDates";

type Area = "company" | "drivers" | "fleet";
type Areas = Record<Area, boolean>;
type Data = Record<string, unknown>;
type WorkStatus = "not_started" | "instructions_sent" | "waiting_on_customer" | "follow_up_due" | "needs_review" | "completed" | "not_applicable";
type Item = { key: string; area: Area; label: string; dueDate: string | null; days: number | null;
  issue: string | null; status: WorkStatus; note: string | null;
  sourceVersion: string | null; sourceInputDate: string | null; dqChecks?: Record<string, boolean | string> };
const COMPANY_ITEMS = [
  ["mcs150", "MCS-150 / USDOT update"], ["tax2290", "Form 2290 heavy vehicle use tax"],
  ["fmcsa-portal", "FMCSA Portal access"], ["ucr", "UCR registration"],
  ["ifta", "IFTA license and decals"], ["ifta-quarterly", "IFTA quarterly return"],
  ["irp", "IRP registration renewal"], ["insurance", "Commercial auto insurance"],
  ["drug", "Drug and alcohol consortium renewal"], ["boc3", "BOC-3 process agent status"],
] as const;
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

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
  return validComplianceDate(value);
}
function plus(value: string | null, amount: number, unit: "day" | "year"): string | null {
  if (!value) return null;
  return (unit === "day" ? complianceAddDays(value, amount) : complianceAddYears(value, amount)) || null;
}
function today(): string {
  return complianceToday();
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
    days: complianceDaysFrom(dueDate, current),
    status: "not_started", note: null, sourceVersion: null, sourceInputDate: null });
}
async function account(carrierId: string, coverage: Data) {
  const db = admin.firestore();
  const ref = db.collection("carriers").doc(carrierId);
  const [carrier, compliance, drivers, vehicles, custom, work, request, billing] = await Promise.all([
    ref.get(), ref.collection("compliance").get(), ref.collection("drivers").get(),
    ref.collection("vehicles").get(), ref.collection("customRequirements").get(),
    db.collection("managedServiceWork").doc(carrierId).collection("items").get(),
    db.collection("managedServiceRequests").doc(carrierId).get(),
    db.collection("managedServiceBilling").doc(carrierId).get(),
  ]);
  if (!carrier.exists || carrier.data()?.deletingAccount === true) return null;
  const areas = object(coverage.areas);
  const current = today();
  const items: Item[] = [];
  const pendingCustom: { id: string; name: string; reason: string; kind?: "unit" | "removal";
    collectionId?: "drivers" | "vehicles"; unitType?: "driver" | "truck" | "trailer" }[] = [];
  const managedUnits = object(coverage.managedUnitIds);
  const driverIds = Array.isArray(managedUnits.driverIds) ? new Set(managedUnits.driverIds) : null;
  const vehicleIds = Array.isArray(managedUnits.vehicleIds) ? new Set(managedUnits.vehicleIds) : null;
  const selfManagedUnitCounts = {
    drivers: areas.drivers === true ? 0 : drivers.docs.filter(row => row.data().status !== "inactive").length,
    vehicles: areas.fleet === true ? 0 : vehicles.docs.filter(row => row.data().status !== "inactive").length,
  };
  if (areas.company === true) {
    const stored = new Map(compliance.docs.map(row => [row.id, row.data()]));
    for (const [key, label] of COMPANY_ITEMS) {
      const value = stored.get(key) ?? {};
      if (value.applicable === false) {
        add(items, "company:" + key, "company", label, null, current);
        items[items.length - 1].status = "not_applicable";
        items[items.length - 1].issue = null;
        continue;
      }
      if (value.completed === true) {
        add(items, "company:" + key, "company", label, null, current, null);
        const completedItem = items[items.length - 1];
        completedItem.status = "completed";
        completedItem.issue = null;
        continue;
      }
      const due = key === "fmcsa-portal"
        ? date(value.dueDate) ?? plus(date(value.enteredDate), 90, "day")
        : date(value.dueDate) ?? (key === "mcs150" ? complianceUsdotDue(String(carrier.data()?.usdotNumber || ""), current)
          : key === "ifta-quarterly" ? complianceNextIftaQuarterDue(current)
          : complianceFixedCalendarDue(key, current)
          ?? (["irp", "insurance", "drug"].includes(key) ? date(value.enteredDate) : null));
      add(items, "company:" + key, "company", label, due, current,
        key === "boc3" ? "Verify filing status" : null);
    }
  }
  if (areas.drivers === true) for (const row of drivers.docs) {
    const value = row.data();
    if (value.status === "inactive") {
      if (driverIds?.has(row.id)) pendingCustom.push({ id: row.id,
        name: String(value.name || "Driver"), kind: "removal", collectionId: "drivers", unitType: "driver",
        reason: "Managed driver is inactive. Remove its managed charge before the next invoice." });
      continue;
    }
    const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Driver";
    if (driverIds && !driverIds.has(row.id)) {
      pendingCustom.push({ id: row.id, name, kind: "unit", collectionId: "drivers", unitType: "driver",
        reason: "New driver is outside paid managed scope; contact the customer before enrolling" });
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
    add(items, "driver:" + row.id + ":dq", "drivers",
      name + " · DQ setup checklist (" + checks + "/8)", null, current,
      checks < 8 ? "Setup needs review" : null);
    const dq = items[items.length - 1];
    dq.dqChecks = Object.fromEntries(["employmentApplicationOnFile", "initialMvrOnFile", "roadTestOnFile",
      "preEmploymentClearinghouseQueryComplete", "preEmploymentDrugTestComplete",
      "previousEmployerInvestigationComplete", "speStatus", "lcvStatus"].map(field =>
      [field, value[field] ?? (field.endsWith("Status") ? "missing" : false)]));
    if (checks === 8) { dq.status = "completed"; dq.issue = null; }
  }
  if (areas.fleet === true) for (const row of vehicles.docs) {
    const value = row.data();
    if (value.status === "inactive") {
      if (vehicleIds?.has(row.id)) pendingCustom.push({ id: row.id,
        name: String(value.unitNumber || "Vehicle"), kind: "removal", collectionId: "vehicles",
        unitType: value.type === "trailer" ? "trailer" : "truck",
        reason: "Managed vehicle is inactive. Remove its managed charge before the next invoice." });
      continue;
    }
    const unit = typeof value.unitNumber === "string" && value.unitNumber.trim() ? value.unitNumber.trim() : "Vehicle";
    if (vehicleIds && !vehicleIds.has(row.id)) {
      pendingCustom.push({ id: row.id, name: unit, kind: "unit", collectionId: "vehicles",
        unitType: value.type === "trailer" ? "trailer" : "truck",
        reason: "New vehicle is outside paid managed scope; contact the customer before enrolling" });
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
    if (value.active === false) continue;
    const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Custom requirement";
    if (value.completed === true && accepted.includes(row.id)) {
      add(items, "custom:" + row.id, "company", name, null, current, null);
      items[items.length - 1].status = "completed";
      items[items.length - 1].issue = null;
      continue;
    }
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
    if (!saved || item.status === "completed" || item.status === "not_applicable") continue;
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
    overdue: items.filter(v => !["completed", "not_applicable"].includes(v.status) && v.days !== null && v.days < 0).length,
    due30: items.filter(v => !["completed", "not_applicable"].includes(v.status) && v.days !== null && v.days >= 0 && v.days <= 30).length,
    due90: items.filter(v => !["completed", "not_applicable"].includes(v.status) && v.days !== null && v.days >= 31 && v.days <= 90).length,
    needsInfo: items.filter(v => !["completed", "not_applicable"].includes(v.status) && (v.issue !== null || v.status === "needs_review")).length + pendingCustom.length,
    waiting: items.filter(v => v.status === "waiting_on_customer").length,
  };
  const data = carrier.data() ?? {};
  const contact = await contactForCarrier(carrierId, data, request.data() ?? {});
  return { carrierId, companyName: String(data.companyName || "Unnamed company"),
    stagingDemo: data.stagingDemo === true,
    billingStatus: object(data.billing).status ?? null,
    contact,
    coverage: { status: coverage.status ?? "draft", areas, effectiveDate: coverage.effectiveDate ?? null,
      anniversaryDate: plus(date(coverage.effectiveDate), 1, "year") },
    counts, items, pendingCustom, selfManagedUnitCounts,
    managedStripeSubscriptionId: typeof billing.data()?.stripeSubscriptionId === "string"
      ? billing.data()!.stripeSubscriptionId : null,
    managedBillingStatus: typeof billing.data()?.status === "string" ? billing.data()!.status : null };
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
    if (previous.data()?.status === "active" && status === "draft")
      throw new HttpsError("failed-precondition", "Active managed coverage cannot be changed to a draft. End managed billing before pausing coverage.");
    const continuing = status === "active" && previous.data()?.status === "active" &&
      quote.data()?.status === "active" && serviceRequest.data()?.status === "active";
    if (status === "active") {
      const agreed = object(quote.data()?.areas);
      if (!quote.data()?.acceptedAt || quote.data()?.acceptedBy !== carrierId ||
          typeof quote.data()?.quoteId !== "string")
        throw new HttpsError("failed-precondition", "The customer must accept this exact quote before coverage starts.");
      if ((!continuing && (quote.data()?.status !== "paid_awaiting_start" ||
          serviceRequest.data()?.status !== "paid_awaiting_start")) ||
          quote.data()?.requestRevision !== serviceRequest.data()?.revision ||
          billing.data()?.quoteId !== quote.data()?.quoteId ||
          billing.data()?.stripeSubscriptionId !== quote.data()?.stripeSubscriptionId ||
          billing.data()?.status !== "active" ||
          billing.data()?.cancelAtPeriodEnd === true || billing.data()?.cancelAt ||
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
    const savedEffectiveDate = previous.data()?.status === "active" && status !== "draft"
      ? previous.data()?.effectiveDate : effectiveDate;
    const acceptedQuoteReference = status === "active"
      ? `Customer accepted quote ${quote.data()?.quoteId} at ${quote.data()?.acceptedAt.toDate().toISOString()}`
      : "";
    const savedConsentReference = previous.data()?.status === "active" && status !== "draft"
      ? previous.data()?.consentReference : acceptedQuoteReference || consentReference;
    const savedAreas = previous.data()?.status === "active" && status === "paused"
      ? previous.data()?.areas : areas;
    tx.set(ref, { status, areas: savedAreas, effectiveDate: savedEffectiveDate, consentReference: savedConsentReference, acceptedCustomIds,
      managedUnitIds: managedUnitIdsForSave(status, continuing,
        previous.data()?.managedUnitIds, quote.data()?.units),
      updatedAt: now, updatedBy: actor, ...(previous.exists ? {} : { createdAt: now }) }, { merge: true });
    if (serviceRequest.exists && (status === "active" || status === "paused"))
      tx.set(requestRef, { status, updatedAt: now }, { merge: true });
    if (status === "active" && quote.data()?.status !== "active")
      tx.update(quoteRef, { status: "active", activatedAt: now, activatedBy: actor });
    tx.create(ref.collection("events").doc(), {
      carrierId, actor, type: "coverage_updated", status, areas: savedAreas,
      effectiveDate: savedEffectiveDate, consentReference: savedConsentReference, createdAt: now });
  });
  return { saved: true };
});
export const attachAcceptedManagedQuoteReference = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const quoteRef = db.collection("managedServiceQuotes").doc(carrierId);
  return db.runTransaction(async tx => {
    const [coverage, quote] = await Promise.all([tx.get(coverageRef), tx.get(quoteRef)]);
    if (coverage.data()?.status !== "active" || quote.data()?.status !== "active" ||
        quote.data()?.acceptedBy !== carrierId || !quote.data()?.acceptedAt ||
        typeof quote.data()?.quoteId !== "string")
      throw new HttpsError("failed-precondition", "An active coverage record and accepted customer quote are required.");
    const reference = `Customer accepted quote ${quote.data()!.quoteId} at ${quote.data()!.acceptedAt.toDate().toISOString()}`;
    const previous = String(coverage.data()?.consentReference || "");
    if (previous === reference) return { saved: false, reference };
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.update(coverageRef, { consentReference: reference, updatedAt: now, updatedBy: actor });
    tx.create(coverageRef.collection("events").doc(), { carrierId, actor,
      type: "acceptance_reference_corrected", previousReference: previous,
      consentReference: reference, createdAt: now });
    return { saved: true, reference };
  });
});
function queueHighlights(items: Item[], pendingCustom: { name: string; reason: string }[]) {
  const first = (match: (item: Item) => boolean) => {
    const item = items.find(match);
    return item ? { label: item.label, dueDate: item.dueDate, issue: item.issue } : null;
  };
  return {
    overdue: first(item => !["completed", "not_applicable"].includes(item.status) && item.days !== null && item.days < 0),
    due30: first(item => !["completed", "not_applicable"].includes(item.status) && item.days !== null && item.days >= 0 && item.days <= 30),
    due90: first(item => !["completed", "not_applicable"].includes(item.status) && item.days !== null && item.days >= 31 && item.days <= 90),
    needsInfo: pendingCustom.length > 0
      ? { label: pendingCustom[0].name, dueDate: null, issue: pendingCustom[0].reason }
      : first(item => !["completed", "not_applicable"].includes(item.status) && (item.issue !== null || item.status === "needs_review")),
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
  const completionHistory = await Promise.all(result.items.map(async item => {
    const path = completionHistoryPath(carrierId, item.key);
    if (!path) return { itemKey: item.key, records: [] };
    const records = await admin.firestore().collection(path).get();
    return { itemKey: item.key, records: records.docs.map(row => ({
      id: row.id, completionDate: date(row.data().completionDate),
      previousDueDate: date(row.data().previousDueDate), nextDueDate: date(row.data().nextDueDate),
      completedAtMillis: row.data().completedAt?.toMillis?.() ?? row.data().createdAt?.toMillis?.() ?? 0,
    })).sort((a, b) => b.completedAtMillis - a.completedAtMillis) };
  }));
  return { ...result, completionHistory, coverage: { ...result.coverage, consentReference: coverage.data()?.consentReference ?? "" }, history: history.docs.map(row => ({ id: row.id, type: row.data().type,
    itemKey: row.data().itemKey ?? null, itemLabel: row.data().itemLabel ?? null, note: row.data().note ?? null,
    createdAtMillis: row.data().createdAt?.toMillis?.() ?? null })) };
});
function completionHistoryPath(carrierId: string, key: string): string | null {
  const [kind, id, field] = key.split(":");
  if (kind === "company" && COMPANY_ITEMS.some(row => row[0] === id))
    return `carriers/${carrierId}/complianceRecords/${id}/history`;
  if (kind === "custom" && id) return `carriers/${carrierId}/customRequirements/${id}/history`;
  if (kind === "driver" && id && ["medical", "mvr", "clearinghouse"].includes(field))
    return `carriers/${carrierId}/drivers/${id}/complianceRecords/${field}/history`;
  if (kind === "fleet" && id && ["registration", "inspection"].includes(field))
    return `carriers/${carrierId}/vehicles/${id}/complianceRecords/${field === "registration" ? "registrationExpiration" : "inspectionExpiration"}/history`;
  return null;
}
export const deleteManagedComplianceHistoryRecord = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  // Old open owner tabs used a native confirmation that could submit after dismissal.
  // Require the explicit confirmation emitted only by the current on-page control.
  if (request.data?.confirmation !== "DELETE_COMPLETION_RECORD")
    throw new HttpsError("failed-precondition", "Refresh owner tools before deleting completion history.");
  const carrierId = identifier(request.data?.carrierId);
  const itemKey = typeof request.data?.itemKey === "string" ? request.data.itemKey : "";
  const recordId = identifier(request.data?.recordId);
  const path = completionHistoryPath(carrierId, itemKey);
  if (!path) throw new HttpsError("invalid-argument", "This requirement has no completion history.");
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const source = workSourceRef(db, carrierId, itemKey);
  if (!source) throw new HttpsError("invalid-argument", "Unknown requirement.");
  const [kind, , field] = itemKey.split(":");
  const recordsRef = db.collection(path);
  const recordRef = recordsRef.doc(recordId);
  const eventRef = coverageRef.collection("events").doc();
  return db.runTransaction(async tx => {
    const [coverage, history, record, live] = await Promise.all([
      tx.get(coverageRef), tx.get(recordsRef), tx.get(recordRef), tx.get(source),
    ]);
    const area = kind === "driver" ? "drivers" : kind === "fleet" ? "fleet" : "company";
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas)[area] !== true)
      throw new HttpsError("failed-precondition", "This area is not actively managed.");
    const units = object(coverage.data()?.managedUnitIds);
    if (kind === "driver" && Array.isArray(units.driverIds) && !units.driverIds.includes(itemKey.split(":")[1]))
      throw new HttpsError("permission-denied", "This driver is outside managed coverage.");
    if (kind === "fleet" && Array.isArray(units.vehicleIds) && !units.vehicleIds.includes(itemKey.split(":")[1]))
      throw new HttpsError("permission-denied", "This vehicle is outside managed coverage.");
    if (!record.exists) throw new HttpsError("not-found", "The completion record was already removed.");
    const ordered = history.docs.sort((a, b) =>
      (b.data().completedAt?.toMillis?.() ?? b.data().createdAt?.toMillis?.() ?? 0)
      - (a.data().completedAt?.toMillis?.() ?? a.data().createdAt?.toMillis?.() ?? 0));
    const latest = ordered[0]?.id === recordId;
    const value = record.data() ?? {};
    const current = live.data() ?? {};
    let restored = false;
    const update: Data = {};
    if (latest && live.exists) {
      if (kind === "company" && value.nextDueDate && current.dueDate === value.nextDueDate) {
        Object.assign(update, { dueDate: value.previousDueDate ?? null,
          enteredDate: value.previousEnteredDate ?? null, previousDueDate: null,
          completed: false, completedDate: null, completedAt: null,
          notified30: false, notified90: false });
        restored = true;
      } else if (kind === "company" && !value.nextDueDate && current.completed === true
        && (!value.completionDate || !current.completedDate || current.completedDate === value.completionDate)) {
        Object.assign(update, { completed: false, completedDate: null, completedAt: null,
          notified30: false, notified90: false });
        restored = true;
      } else if (kind === "custom" && current.dueDate === value.nextDueDate
        && (!value.completionDate || current.completedDate === value.completionDate)) {
        Object.assign(update, { dueDate: value.previousDueDate ?? null, completed: false,
          completedDate: null, completedAt: null, notified30: false, notified90: false });
        restored = true;
      } else if (kind === "driver") {
        const driverField = field === "medical" ? "medicalExpiration" : field === "mvr" ? "mvrDue" : "clearinghouseDue";
        const expected = field === "medical" ? value.nextDueDate : value.completionDate;
        if (expected && current[driverField] === expected) {
          update[driverField] = value.previousCompletionDate ?? "";
          restored = true;
        }
      } else if (kind === "fleet") {
        const fleetField = field === "registration" ? "registrationExpiration" : "inspectionExpiration";
        if (value.nextDueDate && current[fleetField] === value.nextDueDate) {
          update[fleetField] = value.previousDueDate ?? "";
          restored = true;
        }
      }
    }
    if (restored) {
      update[kind === "custom" ? "updatedAt" : "lastUpdated"] = admin.firestore.FieldValue.serverTimestamp();
      tx.set(source, update, { merge: true });
      if (kind === "custom") {
        const customId = itemKey.slice(7);
        tx.update(coverageRef, { acceptedCustomDueDates: {
          ...object(coverage.data()?.acceptedCustomDueDates), [customId]: update.dueDate,
        } });
      }
    }
    tx.delete(recordRef);
    tx.create(eventRef, { carrierId, actor, type: "completion_history_deleted", itemKey,
      recordId, restoredDeadline: restored, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { deleted: true, restoredDeadline: restored };
  });
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
// These owner actions write the same carrier records read by the customer dashboard.
export const setManagedCompanyApplicable = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const requirementId = identifier(request.data?.requirementId);
  if (!COMPANY_ITEMS.some(row => row[0] === requirementId))
    throw new HttpsError("invalid-argument", "Unknown Company requirement.");
  if (typeof request.data?.applicable !== "boolean")
    throw new HttpsError("invalid-argument", "Choose whether this requirement applies.");
  const expectedVersion = checkedVersion(request.data?.sourceVersion);
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const sourceRef = db.collection("carriers").doc(carrierId).collection("compliance").doc(requirementId);
  const workRef = db.collection("managedServiceWork").doc(carrierId).collection("items")
    .doc(Buffer.from("company:" + requirementId).toString("base64url"));
  const eventRef = coverageRef.collection("events").doc();
  return db.runTransaction(async tx => {
    const [coverage, source] = await Promise.all([tx.get(coverageRef), tx.get(sourceRef)]);
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas).company !== true)
      throw new HttpsError("failed-precondition", "Company management is not active.");
    if (sourceVersion(source) !== expectedVersion)
      throw new HttpsError("aborted", "This requirement changed. Refresh before updating it.");
    tx.set(sourceRef, { applicable: request.data.applicable, notified30: false,
      notified90: false, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.delete(workRef);
    tx.create(eventRef, { carrierId, actor, itemKey: "company:" + requirementId,
      type: request.data.applicable ? "requirement_reenabled" : "requirement_not_applicable",
      createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { applicable: request.data.applicable };
  });
});

export const completeManagedCompanyRequirement = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const requirementId = identifier(request.data?.requirementId);
  if (!["tax2290", "ucr", "ifta", "boc3", "ifta-quarterly"].includes(requirementId))
    throw new HttpsError("invalid-argument", "Use the applicable date or completion control for this requirement.");
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  if (note.length < 8) throw new HttpsError("invalid-argument", "Record the document or source confirming completion.");
  const completionDate = date(request.data?.completionDate);
  if (!completionDate) throw new HttpsError("invalid-argument", "Enter a valid completion date.");
  const expectedVersion = checkedVersion(request.data?.sourceVersion);
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const sourceRef = db.collection("carriers").doc(carrierId).collection("compliance").doc(requirementId);
  const historyRef = db.collection("carriers").doc(carrierId).collection("complianceRecords")
    .doc(requirementId).collection("history").doc();
  const eventRef = coverageRef.collection("events").doc();
  return db.runTransaction(async tx => {
    const [coverage, source] = await Promise.all([tx.get(coverageRef), tx.get(sourceRef)]);
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas).company !== true)
      throw new HttpsError("failed-precondition", "Company management is not active.");
    if (sourceVersion(source) !== expectedVersion)
      throw new HttpsError("aborted", "The customer changed this requirement. Refresh before confirming completion.");
    const value = source.data() ?? {};
    if (value.applicable === false || value.completed === true)
      throw new HttpsError("failed-precondition", "This requirement cannot be completed in its current state.");
    const previousEnteredDate = date(value.enteredDate);
    const current = today();
    const due = date(value.dueDate) ?? previousEnteredDate ?? complianceFixedCalendarDue(requirementId, current)
      ?? (requirementId === "ifta-quarterly" ? complianceNextIftaQuarterDue(current) : null);
    if (requirementId === "ifta-quarterly") {
      if (!due) throw new HttpsError("failed-precondition", "The quarterly due date is missing.");
      const periodEnd = complianceIftaQuarterEnd(due);
      if (!periodEnd || completionDate <= periodEnd)
        throw new HttpsError("failed-precondition", "The quarterly filing period has not ended.");
    }
    if (requirementId !== "boc3" && !due)
      throw new HttpsError("failed-precondition", "The current deadline is missing.");
    const nextDueDate = requirementId === "boc3" ? null
      : requirementId === "ifta-quarterly" ? complianceFollowingIftaQuarterDue(due!)
        : complianceAddYears(due!, 1);
    if (requirementId !== "boc3" && !nextDueDate)
      throw new HttpsError("failed-precondition", "The next deadline could not be calculated.");
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(sourceRef, requirementId === "boc3"
      ? { completed: true, completedDate: completionDate, completedAt: now, lastUpdated: now }
      : { previousDueDate: due, dueDate: nextDueDate, completed: false,
          completedDate: null, completedAt: null, lastUpdated: now, notified30: false, notified90: false },
    { merge: true });
    tx.create(historyRef, { recordType: "completion", requirementId, carrierId, completionDate,
      completedAt: now, completedByUserId: actor, completedByName: request.auth?.token.email || "Managed service owner",
      previousDueDate: due, previousEnteredDate, nextDueDate, note, file: null,
      source: "company", createdAt: now });
    tx.create(eventRef, { carrierId, actor, type: "requirement_completed", itemKey: "company:" + requirementId,
      note, previousDueDate: due, nextDueDate, createdAt: now });
    return { nextDueDate };
  });
});

const DQ_BOOLEAN_FIELDS = ["employmentApplicationOnFile", "initialMvrOnFile", "roadTestOnFile",
  "preEmploymentClearinghouseQueryComplete", "preEmploymentDrugTestComplete",
  "previousEmployerInvestigationComplete"];
export const updateManagedDqCheck = onCall({ region: "us-central1" }, async request => {
  const actor = owner(request);
  const carrierId = identifier(request.data?.carrierId);
  const driverId = identifier(request.data?.driverId);
  const field = identifier(request.data?.field);
  const isBoolean = DQ_BOOLEAN_FIELDS.includes(field);
  if (!isBoolean && !["speStatus", "lcvStatus"].includes(field))
    throw new HttpsError("invalid-argument", "Unknown DQ checklist item.");
  const value = request.data?.value;
  if (isBoolean ? typeof value !== "boolean" : !["missing", "on_file", "not_applicable"].includes(value))
    throw new HttpsError("invalid-argument", "Invalid DQ checklist value.");
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  if (note.length < 8) throw new HttpsError("invalid-argument", "Record how this DQ item was verified.");
  const expectedVersion = checkedVersion(request.data?.sourceVersion);
  const db = admin.firestore();
  const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
  const driverRef = db.collection("carriers").doc(carrierId).collection("drivers").doc(driverId);
  const eventRef = coverageRef.collection("events").doc();
  return db.runTransaction(async tx => {
    const [coverage, driver] = await Promise.all([tx.get(coverageRef), tx.get(driverRef)]);
    const units = object(coverage.data()?.managedUnitIds);
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas).drivers !== true
      || (Array.isArray(units.driverIds) && !units.driverIds.includes(driverId)))
      throw new HttpsError("failed-precondition", "This driver is outside active managed coverage.");
    if (!driver.exists || driver.data()?.status === "inactive")
      throw new HttpsError("not-found", "This driver is no longer active.");
    if (sourceVersion(driver) !== expectedVersion)
      throw new HttpsError("aborted", "The driver changed. Refresh before saving.");
    const previous = driver.data()?.[field] ?? (isBoolean ? false : "missing");
    if (previous === value) return { saved: false };
    tx.update(driverRef, { [field]: value, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
    tx.create(eventRef, { carrierId, actor, type: "dq_check_updated", itemKey: `driver:${driverId}:dq`,
      field, previous, value, note, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { saved: true };
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
  if (item.status === "completed" || item.status === "not_applicable")
    throw new HttpsError("failed-precondition", "This requirement is closed or not applicable.");
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
export const enrollApprovedManagedUnit = onCall(
  { region: "us-central1", secrets: [stripeSecretKey] }, async request => {
    const actor = owner(request);
    const carrierId = identifier(request.data?.carrierId);
    const unitId = identifier(request.data?.unitId);
    const collectionId = request.data?.collectionId;
    if (collectionId !== "drivers" && collectionId !== "vehicles")
      throw new HttpsError("invalid-argument", "Choose a driver or vehicle.");
    const agreement = typeof request.data?.agreementReference === "string"
      ? request.data.agreementReference.trim().slice(0, 300) : "";
    if (agreement.length < 8)
      throw new HttpsError("failed-precondition", "Record where the customer agreed to the added monthly charge.");
    const db = admin.firestore();
    const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
    const billingRef = db.collection("managedServiceBilling").doc(carrierId);
    const unitRef = db.collection("carriers").doc(carrierId).collection(collectionId).doc(unitId);
    const [coverage, billing, unit] = await Promise.all([coverageRef.get(), billingRef.get(), unitRef.get()]);
    const area = collectionId === "drivers" ? "drivers" : "fleet";
    const units = object(coverage.data()?.managedUnitIds);
    const field = collectionId === "drivers" ? "driverIds" : "vehicleIds";
    const enrolled = units[field];
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas)[area] !== true ||
        billing.data()?.status !== "active" || !Array.isArray(enrolled) || !unit.exists ||
        unit.data()?.status === "inactive")
      throw new HttpsError("failed-precondition", "Active managed coverage, billing, and an active unit in this area are required.");
    if (enrolled.includes(unitId)) return { alreadyEnrolled: true };
    const subscriptionId = billing.data()?.stripeSubscriptionId;
    if (typeof subscriptionId !== "string" || !subscriptionId.startsWith("sub_"))
      throw new HttpsError("failed-precondition", "Find the managed Stripe subscription before enrolling this unit.");
    const kind = collectionId === "drivers" ? "driver" : unit.data()?.type === "trailer" ? "trailer" : "truck";
    const amount = kind === "driver" ? MANAGED_PRICING.driverMonthly
      : kind === "trailer" ? MANAGED_PRICING.trailerMonthly : MANAGED_PRICING.truckMonthly;
    const enrolledDocs = await Promise.all(enrolled.map(id =>
      db.collection("carriers").doc(carrierId).collection(collectionId).doc(id).get()));
    const currentCount = collectionId === "drivers" ? enrolled.length
      : enrolledDocs.filter(row => (row.data()?.type === "trailer" ? "trailer" : "truck") === kind).length;
    const targetQuantity = currentCount + 1;
    const stripe = new Stripe(stripeSecretKey.value());
    const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? admin.app().options.projectId;
    if (project === "weheartpaperwork-staging" && !stripeSecretKey.value().startsWith("sk_test_"))
      throw new HttpsError("failed-precondition", "Staging verification requires a Stripe test key.");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.status !== "active" || subscription.cancel_at_period_end || subscription.cancel_at ||
        billing.data()?.cancelAtPeriodEnd === true ||
        !["managed", "app_with_managed"].includes(subscription.metadata.serviceKind) || subscription.metadata.carrierId !== carrierId)
      throw new HttpsError("failed-precondition", "The managed subscription is not active and payable.");
    const operationRef = db.collection("managedServiceUnitOperations").doc(carrierId);
    const operationKey = `${carrierId}_${collectionId}_${unitId}_${targetQuantity}`;
    await db.runTransaction(async tx => {
      const current = await tx.get(operationRef);
      const value = current.data() ?? {};
      if (value.status === "applying" && value.startedAt?.toMillis?.() > Date.now() - 2 * 60 * 1000)
        throw new HttpsError("aborted", "Another unit billing change is in progress. Refresh shortly.");
      if (value.status === "needs_reconciliation" && value.operationKey !== operationKey)
        throw new HttpsError("failed-precondition", "A prior Stripe change needs reconciliation before another unit can be added.");
      tx.set(operationRef, { operationKey, collectionId, unitId, kind, targetQuantity,
        agreementReference: agreement, status: "applying", startedAt: admin.firestore.FieldValue.serverTimestamp(), actor });
    });
    let priceId: string;
    try {
      priceId = await addUnitToManagedBilling(stripe, subscription, kind, amount, currentCount, operationKey);
    } catch (error) {
      await operationRef.set({ status: "needs_reconciliation", error: String(error).slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      throw new HttpsError("failed-precondition", `${error instanceof Error ? error.message : "Stripe update failed."} Review Stripe before retrying.`);
    }
    try { await db.runTransaction(async tx => {
      const [latestCoverage, latestBilling, latestUnit] = await Promise.all([
        tx.get(coverageRef), tx.get(billingRef), tx.get(unitRef),
      ]);
      const latestIds = object(latestCoverage.data()?.managedUnitIds)[field];
      if (latestCoverage.data()?.status !== "active" ||
          object(latestCoverage.data()?.areas)[area] !== true || !latestUnit.exists ||
          latestUnit.data()?.status === "inactive" ||
          latestBilling.data()?.stripeSubscriptionId !== subscriptionId ||
          latestBilling.data()?.status !== "active" ||
          !Array.isArray(latestIds))
        throw new HttpsError("aborted", "Coverage or billing changed. Refresh and review before retrying.");
      if (latestIds.includes(unitId)) return;
      if (latestIds.length !== enrolled.length ||
          latestIds.some((id: unknown, index: number) => id !== enrolled[index]))
        throw new HttpsError("aborted", "Another unit was enrolled. Verify Stripe quantity again before retrying.");
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(coverageRef, { [`managedUnitIds.${field}`]: admin.firestore.FieldValue.arrayUnion(unitId),
        updatedAt: now, updatedBy: actor });
      tx.create(coverageRef.collection("events").doc(), { type: "unit_enrolled", collectionId, unitId,
        kind, monthlyAdded: amount, agreementReference: agreement, stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId, actor, createdAt: now });
      tx.set(operationRef, { status: "completed", completedAt: now }, { merge: true });
    }); } catch (error) {
      await operationRef.set({ status: "needs_reconciliation", error: String(error).slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      throw new HttpsError("aborted", "Stripe changed, but coverage could not be confirmed. Reconcile billing and coverage before retrying.");
    }
    return { enrolled: true, monthlyAdded: amount };
  });
export const removeInactiveManagedUnit = onCall(
  { region: "us-central1", secrets: [stripeSecretKey] }, async request => {
    const actor = owner(request);
    const carrierId = identifier(request.data?.carrierId);
    const unitId = identifier(request.data?.unitId);
    const collectionId = request.data?.collectionId;
    if (collectionId !== "drivers" && collectionId !== "vehicles")
      throw new HttpsError("invalid-argument", "Choose a driver or vehicle.");
    const db = admin.firestore();
    const coverageRef = db.collection("managedServiceCoverage").doc(carrierId);
    const billingRef = db.collection("managedServiceBilling").doc(carrierId);
    const unitRef = db.collection("carriers").doc(carrierId).collection(collectionId).doc(unitId);
    const field = collectionId === "drivers" ? "driverIds" : "vehicleIds";
    const area = collectionId === "drivers" ? "drivers" : "fleet";
    const [coverage, billing, unit] = await Promise.all([coverageRef.get(), billingRef.get(), unitRef.get()]);
    const enrolled = object(coverage.data()?.managedUnitIds)[field];
    if (coverage.data()?.status !== "active" || object(coverage.data()?.areas)[area] !== true ||
        !Array.isArray(enrolled) || !unit.exists)
      throw new HttpsError("failed-precondition", "Active managed coverage and the original unit record are required.");
    if (!enrolled.includes(unitId)) return { alreadyRemoved: true };
    if (unit.data()?.status !== "inactive")
      throw new HttpsError("failed-precondition", "Mark the unit inactive before removing its managed charge.");
    const subscriptionId = billing.data()?.stripeSubscriptionId;
    if (billing.data()?.status !== "active" || typeof subscriptionId !== "string" || !subscriptionId.startsWith("sub_"))
      throw new HttpsError("failed-precondition", "An active managed Stripe subscription is required.");
    const kind = collectionId === "drivers" ? "driver" : unit.data()?.type === "trailer" ? "trailer" : "truck";
    const amount = kind === "driver" ? MANAGED_PRICING.driverMonthly
      : kind === "trailer" ? MANAGED_PRICING.trailerMonthly : MANAGED_PRICING.truckMonthly;
    const enrolledDocs = await Promise.all(enrolled.map(id =>
      db.collection("carriers").doc(carrierId).collection(collectionId).doc(id).get()));
    if (enrolledDocs.some(row => !row.exists))
      throw new HttpsError("failed-precondition", "A managed unit record is missing. Reconcile the roster before billing changes.");
    const currentCount = collectionId === "drivers" ? enrolled.length
      : enrolledDocs.filter(row => (row.data()?.type === "trailer" ? "trailer" : "truck") === kind).length;
    const stripe = new Stripe(stripeSecretKey.value());
    const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? admin.app().options.projectId;
    if (project === "weheartpaperwork-staging" && !stripeSecretKey.value().startsWith("sk_test_"))
      throw new HttpsError("failed-precondition", "Staging verification requires a Stripe test key.");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.status !== "active" || subscription.cancel_at_period_end || subscription.cancel_at ||
        billing.data()?.cancelAtPeriodEnd === true ||
        !["managed", "app_with_managed"].includes(subscription.metadata.serviceKind) ||
        subscription.metadata.carrierId !== carrierId)
      throw new HttpsError("failed-precondition", "Review the managed subscription before reducing its charge.");
    const operationRef = db.collection("managedServiceUnitOperations").doc(carrierId);
    const operationKey = `${carrierId}_${collectionId}_${unitId}_remove_${currentCount}`;
    await db.runTransaction(async tx => {
      const current = await tx.get(operationRef);
      const value = current.data() ?? {};
      if (value.status === "applying" && value.startedAt?.toMillis?.() > Date.now() - 2 * 60 * 1000)
        throw new HttpsError("aborted", "Another unit billing change is in progress. Refresh shortly.");
      if (value.status === "needs_reconciliation" && value.operationKey !== operationKey)
        throw new HttpsError("failed-precondition", "A prior Stripe change needs reconciliation first.");
      tx.set(operationRef, { operationKey, collectionId, unitId, kind,
        targetQuantity: currentCount - 1, status: "applying",
        startedAt: admin.firestore.FieldValue.serverTimestamp(), actor });
    });
    let priceId: string;
    try {
      priceId = await removeUnitFromManagedBilling(stripe, subscription, kind, amount, currentCount, operationKey);
    } catch (error) {
      await operationRef.set({ status: "needs_reconciliation", error: String(error).slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      throw new HttpsError("failed-precondition", `${error instanceof Error ? error.message : "Stripe update failed."} Review Stripe before retrying.`);
    }
    try { await db.runTransaction(async tx => {
      const [latestCoverage, latestBilling, latestUnit] = await Promise.all([
        tx.get(coverageRef), tx.get(billingRef), tx.get(unitRef),
      ]);
      const latestIds = object(latestCoverage.data()?.managedUnitIds)[field];
      if (latestCoverage.data()?.status !== "active" ||
          object(latestCoverage.data()?.areas)[area] !== true ||
          latestBilling.data()?.stripeSubscriptionId !== subscriptionId ||
          latestBilling.data()?.status !== "active" || latestUnit.data()?.status !== "inactive" ||
          !Array.isArray(latestIds) || latestIds.length !== enrolled.length ||
          latestIds.some((id: unknown, index: number) => id !== enrolled[index]))
        throw new HttpsError("aborted", "Coverage or billing changed. Reconcile before retrying.");
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(coverageRef, { [`managedUnitIds.${field}`]: admin.firestore.FieldValue.arrayRemove(unitId),
        updatedAt: now, updatedBy: actor });
      tx.create(coverageRef.collection("events").doc(), { type: "unit_removed", collectionId, unitId,
        kind, monthlyRemoved: amount, stripeSubscriptionId: subscriptionId, stripePriceId: priceId,
        actor, createdAt: now });
      tx.set(operationRef, { status: "completed", completedAt: now }, { merge: true });
    }); } catch (error) {
      await operationRef.set({ status: "needs_reconciliation", error: String(error).slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      throw new HttpsError("aborted", "Stripe changed, but coverage could not be confirmed. Reconcile billing and coverage before retrying.");
    }
    return { removed: true, monthlyRemoved: amount };
  });
export const signalManagedCarrierChange = onDocumentWritten(
  { document: "carriers/{carrierId}", region: "us-central1" },
  async event => signalManagedChange(event.params.carrierId));
export const signalManagedItemChange = onDocumentWritten(
  { document: "carriers/{carrierId}/{collectionId}/{docId}", region: "us-central1" },
  async event => {
    const { carrierId, collectionId, docId } = event.params;
    await signalManagedChange(carrierId);
    if (collectionId !== "drivers" && collectionId !== "vehicles") return;
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (before && before.status !== "inactive" && (!after || after.status === "inactive")) {
      const db = admin.firestore();
      const [coverage, carrier, serviceRequest] = await Promise.all([
        db.collection("managedServiceCoverage").doc(carrierId).get(),
        db.collection("carriers").doc(carrierId).get(),
        db.collection("managedServiceRequests").doc(carrierId).get(),
      ]);
      const enrolled = object(coverage.data()?.managedUnitIds)[collectionId === "drivers" ? "driverIds" : "vehicleIds"];
      if (coverage.data()?.status === "active" && Array.isArray(enrolled) && enrolled.includes(docId) &&
          carrier.exists && carrier.data()?.deletingAccount !== true) {
        const kind = collectionId === "drivers" ? "driver" : before.type === "trailer" ? "trailer" : "truck";
        const label = String(collectionId === "drivers" ? before.name || "Driver" : before.unitNumber || "Vehicle").slice(0, 100);
        const company = String(carrier.data()?.companyName || "Company").slice(0, 150);
        const contact = String(serviceRequest.data()?.preferredEmail || carrier.data()?.email || "Not provided").slice(0, 254);
        const digest = createHash("sha256").update(event.id).digest("hex").slice(0, 24);
        await queueOwnerEmail(db, `managed_removed_unit_${carrierId}_${docId}_${digest}`,
          `Managed ${kind} removed: ${company}`,
          `${company} removed managed ${kind} ${label}.\n\nContact: ${contact}\n\nThe managed charge is still on the subscription until you process this removal. Open the owner managed queue before the next invoice, verify the unit is inactive, and use the reduce-charge action. The customer keeps app access and saved records.`);
      }
      return;
    }
    if (!after || after.status === "inactive" || (before && before.status !== "inactive")) return;
    const db = admin.firestore();
    const [coverage, carrier, serviceRequest] = await Promise.all([
      db.collection("managedServiceCoverage").doc(carrierId).get(),
      db.collection("carriers").doc(carrierId).get(),
      db.collection("managedServiceRequests").doc(carrierId).get(),
    ]);
    if (coverage.data()?.status !== "active" || !carrier.exists || carrier.data()?.deletingAccount === true) return;
    const managedUnits = object(coverage.data()?.managedUnitIds);
    const enrolled = collectionId === "drivers" ? managedUnits.driverIds : managedUnits.vehicleIds;
    if (Array.isArray(enrolled) && enrolled.includes(docId)) return;
    const areaSelected = object(coverage.data()?.areas)[collectionId === "drivers" ? "drivers" : "fleet"] === true;
    const kind = collectionId === "drivers" ? "driver" : after.type === "trailer" ? "trailer" : "truck";
    const label = String(collectionId === "drivers" ? after.name || "Driver" : after.unitNumber || "Vehicle").slice(0, 100);
    const company = String(carrier.data()?.companyName || "Company").slice(0, 150);
    const contact = String(serviceRequest.data()?.preferredEmail || carrier.data()?.email || "Not provided").slice(0, 254);
    const digest = createHash("sha256").update(event.id).digest("hex").slice(0, 24);
    await queueOwnerEmail(db, `managed_new_unit_${carrierId}_${docId}_${digest}`,
      `Managed customer added a ${kind}: ${company}`,
      `${company} added or reactivated ${kind} ${label}.\n\nContact: ${contact}\n\nThis unit is not in the paid managed scope. The current managed price and coverage have not changed. Contact the customer to ask whether they want it managed, then confirm the added monthly price and record their agreement before updating coverage.\n\n${areaSelected
        ? "Open the owner managed work queue to review the unit."
        : "This customer did not select this managed area. A separate scope and billing review is required before it can be added."}`);
  });
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
