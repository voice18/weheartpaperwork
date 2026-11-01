import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { OWNER_EMAIL } from "./ownerNotifications";
import { contactChanged, managedContact } from "./managedContact";
import { managedIntake } from "./managedIntake";
import { managedRoster } from "./managedRoster";

type Areas = { company: boolean; drivers: boolean; fleet: boolean };
const PENDING = new Set(["requested", "change_requested", "end_requested", "contacted", "quoted", "accepted"]);
function owner(request: { auth?: { token: Record<string, unknown> } }): void {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  if (request.auth.token.ownerAdmin !== true) throw new HttpsError("permission-denied", "Owner access is required.");
}
function areas(value: unknown): Areas {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return { company: input.company === true, drivers: input.drivers === true, fleet: input.fleet === true };
}
function same(a: Areas, b: Areas): boolean {
  return a.company === b.company && a.drivers === b.drivers && a.fleet === b.fleet;
}
function any(a: Areas): boolean { return a.company || a.drivers || a.fleet; }
function description(a: Areas): string {
  return ([a.company && "Company", a.drivers && "Driver", a.fleet && "Fleet"]
    .filter(Boolean).join(", ")) || "No managed areas (request to end support)";
}
export const submitManagedServiceRequest = onCall({ region: "us-central1" }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const action = request.data?.action;
  if (action !== "request" && action !== "withdraw" && action !== "contact")
    throw new HttpsError("invalid-argument", "Choose a valid request action.");
  const selected = areas(request.data?.areas);
  const db = admin.firestore();
  const carrierRef = db.collection("carriers").doc(uid);
  const coverageRef = db.collection("managedServiceCoverage").doc(uid);
  const requestRef = db.collection("managedServiceRequests").doc(uid);
  const quoteRef = db.collection("managedServiceQuotes").doc(uid);
  return db.runTransaction(async tx => {
    const [carrier, coverage, previous, quote] = await Promise.all([
      tx.get(carrierRef), tx.get(coverageRef), tx.get(requestRef), tx.get(quoteRef),
    ]);
    if (!carrier.exists || carrier.data()?.deletingAccount === true)
      throw new HttpsError("failed-precondition", "Complete your company setup first.");
    const before = previous.data() ?? {};
    const activeCoverage = coverage.data()?.status === "active";
    const currentAreas = areas(coverage.data()?.areas);
    const previousAreas = areas(before.areas);
    if (before.status === "end_scheduled" && action !== "contact")
      throw new HttpsError("failed-precondition", "Managed service is scheduled to end. Contact us to change this request.");
    if (["accepted", "paid_awaiting_start"].includes(String(before.status)) && action !== "contact")
      throw new HttpsError("failed-precondition", "Your accepted quote is being processed. Contact us to change or cancel it.");
    if (action === "withdraw") {
      if (!previous.exists || !PENDING.has(String(before.status))) return { status: "unchanged" };
      const revision = Number(before.revision || 0) + 1;
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(requestRef, { status: "withdrawn", revision, updatedAt: now }, { merge: true });
      tx.create(requestRef.collection("events").doc(), { type: "withdrawn", revision, createdAt: now });
      tx.create(db.collection("mail").doc(`managed_request_${uid}_${revision}`), {
        to: [OWNER_EMAIL], category: "managed_service_request", managedServiceCarrierId: uid,
        message: { subject: `Managed support request withdrawn: ${String(carrier.data()?.companyName || "Company")}`,
          text: `The customer withdrew the pending managed-support request.\n\nCompany: ${String(carrier.data()?.companyName || "Company")}\nAccount email: ${String(request.auth?.token.email || "Unavailable")}\n\nCheck the owner workspace before taking action.` },
        createdAt: now,
      });
      return { status: "withdrawn" };
    }
    if (action === "contact") {
      if ((!previous.exists || !PENDING.has(String(before.status))) && !activeCoverage)
        throw new HttpsError("failed-precondition", "Request managed support before saving contact details.");
      const contact = managedContact(request.data ?? {});
      if (!contactChanged(before, contact)) return { status: "contact-unchanged" };
      const revision = Number(before.revision || 0) + 1;
      const now = admin.firestore.FieldValue.serverTimestamp();
      const companyName = String(carrier.data()?.companyName || "Unnamed company").slice(0, 150);
      tx.set(requestRef, { ...contact, carrierId: uid, companyName,
        accountEmail: String(request.auth?.token.email || "").slice(0, 254),
        textConsentAt: contact.textPermission ? now : null,
        status: before.status || "active", revision, updatedAt: now }, { merge: true });
      if (quote.exists && ["quoted", "accepted", "active"].includes(String(quote.data()?.status)) &&
          quote.data()?.requestRevision === before.revision)
        tx.update(quoteRef, { requestRevision: revision });
      tx.create(requestRef.collection("events").doc(), {
        type: "contact_updated", revision, textPermission: contact.textPermission, createdAt: now,
      });
      tx.create(db.collection("mail").doc(`managed_contact_${uid}_${revision}`), {
        to: [OWNER_EMAIL], category: "managed_service_request", managedServiceCarrierId: uid,
        message: { subject: `Managed support contact updated: ${companyName}`,
          text: `The customer updated their contact preferences.\n\nCompany: ${companyName}\nBest email: ${contact.preferredEmail}\nBest phone: ${contact.preferredPhone}\nService-related texts permitted: ${contact.textPermission ? "Yes" : "No"}\n\nReview the owner workspace before contacting them.` },
        createdAt: now,
      });
      return { status: "contact-updated" };
    }
    if (!activeCoverage && !any(selected)) return { status: "self-managed" };
    if (activeCoverage && same(selected, currentAreas)) {
      if (previous.exists && PENDING.has(String(before.status))) {
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.set(requestRef, { status: "withdrawn", updatedAt: now }, { merge: true });
        tx.create(requestRef.collection("events").doc(), { type: "withdrawn", createdAt: now });
      }
      return { status: "already-active" };
    }
    if (!["trialing", "active"].includes(String(carrier.data()?.billing?.status)))
      throw new HttpsError("failed-precondition", "Complete app checkout before requesting managed support.");
    const contact = managedContact(request.data ?? {});
    let intake;
    try { intake = managedIntake(request.data?.intake, selected); }
    catch (error) { throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Invalid intake details."); }
    const nextStatus = activeCoverage
      ? any(selected) ? "change_requested" : "end_requested"
      : "requested";
    const intakeChanged = JSON.stringify(before.intake || { drivers: [], vehicles: [] }) !== JSON.stringify(intake);
    if (PENDING.has(String(before.status)) && same(selected, previousAreas)
      && !contactChanged(before, contact) && !intakeChanged)
      return { status: "already-pending" };
    const revision = Number(before.revision || 0) + 1;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const companyName = String(carrier.data()?.companyName || "Unnamed company").slice(0, 150);
    const accountEmail = String(request.auth?.token.email || "").slice(0, 254);
    const contactOnly = PENDING.has(String(before.status)) && same(selected, previousAreas) && !intakeChanged;
    tx.set(requestRef, { carrierId: uid, companyName, accountEmail, ...contact,
      intake,
      textConsentAt: contact.textPermission ? now : null,
      billingStatus: carrier.data()?.billing?.status ?? null, areas: selected,
      status: contactOnly ? before.status : nextStatus, revision,
      ...(contactOnly ? {} : { submittedAt: now }), updatedAt: now }, { merge: true });
    if (contactOnly && quote.exists && ["quoted", "accepted"].includes(String(quote.data()?.status)) &&
        quote.data()?.requestRevision === before.revision)
      tx.update(quoteRef, { requestRevision: revision });
    tx.create(requestRef.collection("events").doc(), {
      type: contactOnly ? "contact_updated" : nextStatus,
      areas: selected, revision, textPermission: contact.textPermission, createdAt: now,
    });
    tx.create(db.collection("mail").doc(`managed_request_${uid}_${revision}`), {
      to: [OWNER_EMAIL], category: "managed_service_request", managedServiceCarrierId: uid,
      message: { subject: `${contactOnly ? "Managed support contact updated" : "Managed support request"}: ${companyName}`,
        text: `A customer ${contactOnly ? "updated contact preferences for" : "requested"} managed tracking.\n\nCompany: ${companyName}\nAccount email: ${accountEmail}\nBest email: ${contact.preferredEmail}\nBest phone: ${contact.preferredPhone}\nService-related texts permitted: ${contact.textPermission ? "Yes" : "No"}\nRequest: ${description(selected)}\nIntake: ${intake.drivers.length} drivers, ${intake.vehicles.length} trucks/trailers.\nRequest type: ${contactOnly ? before.status : nextStatus}\n\nReview the owner workspace. No quote, payment, or coverage change happened automatically.` },
      createdAt: now,
    });
    return { status: contactOnly ? "contact-updated" : nextStatus };
  });
});
export const listManagedServiceRequests = onCall({ region: "us-central1" }, async request => {
  owner(request);
  const db = admin.firestore();
  const snapshot = await db.collection("managedServiceRequests")
    .where("status", "in", ["requested", "change_requested", "end_requested", "contacted", "quoted", "accepted", "paid_awaiting_start"]).get();
  const requests = await Promise.all(snapshot.docs.map(async row => {
    const value = row.data();
    const [carrier, quote] = await Promise.all([
      db.collection("carriers").doc(row.id).get(),
      db.collection("managedServiceQuotes").doc(row.id).get(),
    ]);
    return { carrierId: row.id, companyName: String(value.companyName || "Unnamed company"),
      accountEmail: String(value.accountEmail || ""),
      preferredEmail: String(value.preferredEmail || ""),
      preferredPhone: String(value.preferredPhone || ""),
      accountPhone: typeof carrier.data()?.phoneNumber === "string" ? carrier.data()!.phoneNumber : "",
      textPermission: typeof value.textPermission === "boolean" ? value.textPermission : null,
      quote: quote.exists && quote.data()?.requestRevision === value.revision
        ? { status: quote.data()?.status ?? null, scope: quote.data()?.scope ?? "",
          price: quote.data()?.price ?? null, counts: quote.data()?.counts ?? null } : null,
      billingStatus: value.billingStatus ?? null,
      intake: value.intake || { drivers: [], vehicles: [] },
      areas: areas(value.areas), status: String(value.status || "requested"),
      updatedAtMillis: value.updatedAt?.toMillis?.() ?? null };
  }));
  requests.sort((a, b) => (b.updatedAtMillis || 0) - (a.updatedAtMillis || 0));
  return { requests };
});
export const enterManagedIntakeUnits = onCall({ region: "us-central1" }, async request => {
  owner(request);
  const uid = request.data?.carrierId;
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    throw new HttpsError("invalid-argument", "Choose a valid company.");
  const db = admin.firestore();
  const carrierRef = db.collection("carriers").doc(uid);
  const requestRef = db.collection("managedServiceRequests").doc(uid);
  const quoteRef = db.collection("managedServiceQuotes").doc(uid);
  const [carrier, currentRequest, quote, existingDrivers, existingVehicles] = await Promise.all([
    carrierRef.get(), requestRef.get(), quoteRef.get(), carrierRef.collection("drivers").get(), carrierRef.collection("vehicles").get(),
  ]);
  if (!carrier.exists || carrier.data()?.deletingAccount === true ||
      !["active", "trialing"].includes(String(carrier.data()?.billing?.status)))
    throw new HttpsError("failed-precondition", "The customer needs an active app subscription.");
  if (currentRequest.data()?.status !== "paid_awaiting_start" ||
      quote.data()?.status !== "paid_awaiting_start" ||
      quote.data()?.requestRevision !== currentRequest.data()?.revision)
    throw new HttpsError("failed-precondition", "Confirm the customer's managed payment before adding listed units.");
  const selected = areas(currentRequest.data()?.areas);
  let roster;
  try {
    const intake = managedIntake(currentRequest.data()?.intake, selected);
    roster = managedRoster(uid, selected, intake,
      existingDrivers.docs.map(row => ({ id: row.id, data: row.data() })),
      existingVehicles.docs.map(row => ({ id: row.id, data: row.data() })));
  } catch (error) {
    throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Review the listed units.");
  }
  const quotedUnits = quote.data()?.units ?? {};
  if (JSON.stringify(roster.driverIds) !== JSON.stringify(quotedUnits.driverIds) ||
      JSON.stringify(roster.vehicleIds) !== JSON.stringify(quotedUnits.vehicleIds))
    throw new HttpsError("failed-precondition", "The active roster changed after the quote. Review billing before adding units.");
  if (!roster.newDrivers.length && !roster.newVehicles.length) return { driversAdded: 0, vehiclesAdded: 0 };
  const batch = db.batch();
  for (const { id, row } of roster.newDrivers) {
    batch.create(carrierRef.collection("drivers").doc(id), {
      ...row, status: "active", inactiveAt: null, rehiredAt: null, mvrDue: "", clearinghouseDue: "",
      roadTestOnFile: false, employmentApplicationOnFile: false, initialMvrOnFile: false,
      preEmploymentClearinghouseQueryComplete: false, preEmploymentDrugTestComplete: false,
      speStatus: "missing", lcvStatus: "missing", previousEmployerInvestigationComplete: false,
      source: "managed_intake", createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  for (const { id, row } of roster.newVehicles) {
    batch.create(carrierRef.collection("vehicles").doc(id), {
      ...row, year: "", make: "", model: "", plateNumber: "", registrationState: "",
      registrationPermanent: false, status: "active", source: "managed_intake",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  batch.create(requestRef.collection("events").doc(), { type: "intake_units_entered",
    driversAdded: roster.newDrivers.length, vehiclesAdded: roster.newVehicles.length,
    actor: request.auth!.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  try { await batch.commit(); }
  catch (error) { throw new HttpsError("aborted", "The intake or account changed while adding units. Refresh and check the customer account before retrying."); }
  return { driversAdded: roster.newDrivers.length, vehiclesAdded: roster.newVehicles.length };
});
export const updateManagedServiceRequestStatus = onCall({ region: "us-central1" }, async request => {
  owner(request);
  const carrierId = request.data?.carrierId;
  if (typeof carrierId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(carrierId))
    throw new HttpsError("invalid-argument", "Invalid company ID.");
  const status = request.data?.status;
  if (status !== "contacted" && status !== "closed")
    throw new HttpsError("invalid-argument", "Choose a valid request status.");
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 500) : "";
  if (note.length < 3) throw new HttpsError("invalid-argument", "Add a short action note.");
  const db = admin.firestore();
  const ref = db.collection("managedServiceRequests").doc(carrierId);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || !["requested", "contacted"].includes(String(snapshot.data()?.status)))
      throw new HttpsError("failed-precondition", "This request is no longer waiting for review.");
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.update(ref, { status, updatedAt: now });
    tx.create(ref.collection("events").doc(), {
      type: status, note, actor: request.auth!.uid, createdAt: now,
    });
  });
  return { status };
});
