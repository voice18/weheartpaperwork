import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getIdTokenResult } from "firebase/auth";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db, functions } from "../../lib/firebase";
import { MANAGED_PRICING } from "../../lib/managedPricing";
import { collection, onSnapshot } from "firebase/firestore";

type Areas = { company: boolean; drivers: boolean; fleet: boolean };
type Contact = { accountEmail: string; preferredEmail: string; preferredPhone: string;
  accountPhone: string; textPermission: boolean | null };
type Counts = { overdue: number; due30: number; due90: number; needsInfo: number; waiting: number };
type Highlight = { label: string; dueDate: string | null; issue: string | null };
type Highlights = Record<QueueFilter, Highlight | null>;
type Summary = { carrierId: string; companyName: string; billingStatus: string | null;
  contact: Contact;
  coverage: { status: string; areas: Areas; effectiveDate: string | null; anniversaryDate: string | null };
  counts: Counts; itemCount: number; pendingCustomCount: number; highlights: Highlights };
type Item = { key: string; area: string; label: string; dueDate: string | null; days: number | null;
  issue: string | null; status: string; note: string | null;
  sourceVersion: string | null; sourceInputDate: string | null };
type Detail = Omit<Summary, "itemCount" | "pendingCustomCount"> & {
  coverage: Summary["coverage"] & { consentReference?: string };
  items: Item[]; pendingCustom: { id: string; name: string; reason: string; kind?: "unit";
    collectionId?: "drivers" | "vehicles"; unitType?: "driver" | "truck" | "trailer" }[];
  managedStripeSubscriptionId?: string | null;
  selfManagedUnitCounts?: { drivers: number; vehicles: number };
  history: { id: string; type: string; itemKey: string | null; itemLabel: string | null; note: string | null; createdAtMillis: number | null }[];
};
type ServiceRequest = { carrierId: string; companyName: string; accountEmail: string;
  preferredEmail: string; preferredPhone: string; accountPhone: string; textPermission: boolean | null;
  billingStatus: string | null; areas: Areas; status: string; revision: number; updatedAtMillis: number | null;
  intakeUnitsConfirmedRevision?: number | null;
  intakeUnitsAdded?: { drivers: number; vehicles: number } | null;
  intake?: { drivers: { name: string; cdlNumber: string; cdlClass: string; cdlState: string;
    cdlExpiration: string; medicalExpiration: string }[];
    vehicles: { type: string; unitNumber: string; vin: string;
      registrationExpiration: string; inspectionExpiration: string }[] };
  quote?: { status: string; scope: string; price: { firstYearMonthly: number;
    renewalMonthly: number; fleetOnlyOnboardingOneTime: number; dqFileOneTime: number };
    counts: { drivers: number; trucks: number; trailers: number; dqFiles: number } } | null };
type Candidate = { carrierId: string; companyName: string; billingStatus: string | null; coverage?: {
  status?: string; areas?: Areas; effectiveDate?: string; consentReference?: string } | null;
  contact?: Contact };
type QueueFilter = "overdue" | "due30" | "due90" | "needsInfo" | "waiting" | "all";
const QUEUE_FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "overdue", label: "Overdue" }, { key: "due30", label: "Next 30 days" },
  { key: "due90", label: "Days 31–90" }, { key: "needsInfo", label: "Need information" },
  { key: "waiting", label: "Waiting" }, { key: "all", label: "All active" },
];
function matchesQueue(item: Item, filter: QueueFilter): boolean {
  if (filter === "overdue") return item.days !== null && item.days < 0;
  if (filter === "due30") return item.days !== null && item.days >= 0 && item.days <= 30;
  if (filter === "due90") return item.days !== null && item.days >= 31 && item.days <= 90;
  if (filter === "needsInfo") return item.issue !== null || item.status === "needs_review";
  if (filter === "waiting") return item.status === "waiting_on_customer";
  return true;
}
function queueHighlights(items: Item[], pendingCustom: Detail["pendingCustom"]): Highlights {
  const first = (match: (item: Item) => boolean): Highlight | null => {
    const item = items.find(match);
    return item ? { label: item.label, dueDate: item.dueDate, issue: item.issue } : null;
  };
  return {
    overdue: first(item => matchesQueue(item, "overdue")),
    due30: first(item => matchesQueue(item, "due30")),
    due90: first(item => matchesQueue(item, "due90")),
    needsInfo: pendingCustom.length > 0
      ? { label: pendingCustom[0].name, dueDate: null, issue: pendingCustom[0].reason }
      : first(item => matchesQueue(item, "needsInfo")),
    waiting: first(item => matchesQueue(item, "waiting")),
    all: first(() => true),
  };
}
const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles",
  year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const AREA_LABEL: Record<keyof Areas, string> = { company: "Company", drivers: "Driver", fleet: "Fleet" };
const REQUEST_STAGE: Record<string, string> = {
  requested: "New request · verify details and prepare quote",
  contacted: "Contact logged · prepare quote",
  quoted: "Quote ready · waiting for customer acceptance",
  accepted: "Quote accepted · waiting for checkout",
  paid_awaiting_start: "Payment confirmed · finish setup and start coverage",
  change_requested: "Coverage change requested · review before changing billing",
  end_requested: "Support end requested · review billing end date",
  end_scheduled: "Managed billing ending at paid period end · app access continues",
};
function suggestedQuoteScope(areas: Areas): string {
  const work = [
    areas.company && "review company deadlines and provide filing instructions and follow-up",
    areas.drivers && "organize the quoted drivers' dates and qualification-file checks",
    areas.fleet && "organize registration and inspection dates for the quoted equipment",
  ].filter(Boolean).join("; ");
  return `We will ${work}. We will update the shared dashboard from verified information. Your company provides accurate records, completes and pays for filings, inspections, and third-party orders, and confirms when each task is done. Driver qualification file preparation is included only for the number separately shown in this quote.`;
}

async function call<T>(name: string, data: Record<string, unknown>): Promise<T> {
  const result = await httpsCallable<Record<string, unknown>, T>(functions, name)(data);
  return result.data;
}
function guideUrl(key: string): string | null {
  const guides: Record<string, string> = {
    "company:mcs150": "update-mcs-150-motus",
    "company:tax2290": "file-form-2290",
    "company:ucr": "file-ucr-registration",
    "company:ifta-quarterly": "file-ifta-quarterly-return",
    "company:irp": "renew-irp-registration",
    "company:drug": "enroll-drug-alcohol-consortium",
    "company:boc3": "file-boc-3",
  };
  const slug = guides[key]
    || (key.endsWith(":mvr") ? "complete-annual-mvr-review" : null)
    || (key.endsWith(":clearinghouse") ? "run-annual-clearinghouse-query" : null)
    || (key.endsWith(":medical") ? "renew-dot-medical-certification" : null)
    || (key.endsWith(":dq") ? "build-driver-qualification-file" : null)
    || (key.endsWith(":inspection") ? "complete-annual-dot-inspection" : null);
  return slug ? "https://weheartpaperwork.com/how-to/" + slug : null;
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Please try again.";
}
function Button({ label, onPress, disabled = false, subtle = false }: {
  label: string; onPress: () => void; disabled?: boolean; subtle?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress}
    style={[styles.button, subtle && styles.subtle, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, subtle && styles.subtleText]}>{label}</Text>
  </Pressable>;
}
function ContactDetails({ contact }: { contact: Contact }) {
  const email = contact.preferredEmail || contact.accountEmail;
  const phone = contact.preferredPhone || contact.accountPhone;
  return <View style={styles.contactBox}>
    <Text selectable style={styles.small}>{contact.preferredEmail ? "Best email: " : "Account email (best email not confirmed): "}{email || "Not provided"}</Text>
    <Text selectable style={styles.small}>{contact.preferredPhone ? "Best phone: " : "Phone (best number not confirmed): "}{phone || "Not provided"}</Text>
    <Text style={styles.small}>Service-related texts: {contact.textPermission === true ? "Customer said yes" : contact.textPermission === false ? "Customer said no" : "No answer recorded — do not text"}</Text>
    <View style={styles.row}>
      {email && <Button label="Email" subtle onPress={() => void Linking.openURL(`mailto:${email}`)} />}
      {phone && <Button label="Call" subtle onPress={() => void Linking.openURL(`tel:${phone}`)} />}
    </View>
  </View>;
}

function editableDate(item: Item): boolean {
  if (item.key.startsWith("driver:")) return !item.key.endsWith(":dq");
  if (item.key.startsWith("fleet:") || item.key.startsWith("custom:")) return true;
  return ["company:mcs150", "company:irp", "company:insurance", "company:drug", "company:fmcsa-portal"].includes(item.key);
}
function dateInputLabel(item: Item): string {
  if (item.key.endsWith(":mvr")) return "Date of last MVR review";
  if (item.key.endsWith(":clearinghouse")) return "Date of last Clearinghouse query";
  if (item.key === "company:fmcsa-portal") return "Date of last FMCSA Portal update";
  return "Next due or expiration date (YYYY-MM-DD)";
}
export default function OwnerManaged() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const detailPosition = useRef(0);
  const focusDetail = useRef(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("overdue");
  const [visibleCompanies, setVisibleCompanies] = useState(10);
  const [showDirectory, setShowDirectory] = useState(false);
  const [accounts, setAccounts] = useState<Summary[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [ownerAccess, setOwnerAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [quoteScopes, setQuoteScopes] = useState<Record<string, string>>({});
  const [quoteDqFiles, setQuoteDqFiles] = useState<Record<string, string>>({});
  const [quoteFeedback, setQuoteFeedback] = useState<Record<string, string>>({});
  const [intakeFeedback, setIntakeFeedback] = useState<Record<string, string>>({});
  const [confirmIntakeId, setConfirmIntakeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [companies, setCompanies] = useState<Candidate[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [areas, setAreas] = useState<Areas>({ company: true, drivers: true, fleet: true });
  const [effectiveDate, setEffectiveDate] = useState(currentDate);
  const [consentReference, setConsentReference] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const detailId = useRef<string | null>(null);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [unitAgreements, setUnitAgreements] = useState<Record<string, string>>({});
  const [itemDates, setItemDates] = useState<Record<string, string>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setOwnerAccess("denied"); return; }
    void getIdTokenResult(user, true).then(token =>
      setOwnerAccess(token.claims.ownerAdmin === true ? "allowed" : "denied"))
      .catch(() => setOwnerAccess("error"));
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await call<{ accounts: Summary[] }>("listManagedServiceAccounts", {});
      setAccounts(result.accounts);
      setMessage("");
    } catch (error) { setMessage(errorText(error)); }
    finally { setLoading(false); }
  }, []);
  const loadCompanies = useCallback(async (cursor: string | null = null) => {
    setLoadingCompanies(true);
    try {
      const result = await call<{ companies: Candidate[]; nextCursor: string | null }>(
        "listManagedServiceCandidates", cursor ? { cursor } : {});
      setCompanies(previous => cursor
        ? [...previous, ...result.companies.filter(row => !previous.some(item => item.carrierId === row.carrierId))]
        : result.companies);
      setNextCursor(result.nextCursor);
    } catch (error) { setMessage(errorText(error)); }
    finally { setLoadingCompanies(false); }
  }, []);
  const loadRequests = useCallback(async () => {
    setRequestLoading(true);
    setRequestError("");
    try {
      const result = await call<{ requests: ServiceRequest[] }>("listManagedServiceRequests", {});
      setRequests(result.requests);
    } catch (error) {
      setRequestError(errorText(error) === "internal"
        ? "The request service could not load. Try Refresh; if it continues, check the staging function logs."
        : errorText(error));
    } finally { setRequestLoading(false); }
  }, []);
  useEffect(() => {
  if (ownerAccess !== "allowed") return;
    void loadRequests();
  }, [ownerAccess, refresh, loadCompanies, loadRequests]);
  const open = async (carrierId: string, setup = false) => {
    setWorking(true);
    try {
      const result = await call<Detail>("getManagedServiceAccount", { carrierId });
      detailId.current = result.carrierId;
      setDetail(result);
      setCandidate(null);
      setShowSetup(setup);
      setItemDates(Object.fromEntries(result.items.map(item => [item.key, item.sourceInputDate || ""])));
      setAccounts(previous => previous.map(row => row.carrierId === result.carrierId
        ? { ...row, counts: result.counts, itemCount: result.items.length,
          pendingCustomCount: result.pendingCustom.length,
          highlights: queueHighlights(result.items, result.pendingCustom) } : row));
      setAreas({ company: result.coverage.areas.company === true,
        drivers: result.coverage.areas.drivers === true, fleet: result.coverage.areas.fleet === true });
      setEffectiveDate(result.coverage.effectiveDate || currentDate);
      setConsentReference(result.coverage.consentReference || "");
      setMessage("");
      focusDetail.current = true;
    } catch (error) { setMessage(errorText(error)); }
    finally { setWorking(false); }
  };
  const enrollUnit = async (row: Detail["pendingCustom"][number]) => {
    if (!detail || !row.collectionId) return;
    const key = row.collectionId + ":" + row.id;
    const agreementReference = (unitAgreements[key] || "").trim();
    if (agreementReference.length < 8) {
      setMessage("Record where the customer agreed to this added monthly charge.");
      return;
    }
    setBusyItem(key);
    try {
      await call("enrollApprovedManagedUnit", {
        carrierId: detail.carrierId, collectionId: row.collectionId,
        unitId: row.id, agreementReference,
      });
      setUnitAgreements(previous => ({ ...previous, [key]: "" }));
      await open(detail.carrierId);
      setMessage(`${row.name} is now in managed coverage. The existing Company rate was not changed.`);
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusyItem(null); }
  };
  useEffect(() => {
    if (ownerAccess !== "allowed") return;
    let started = false;
    let stopped = false;
    const unsubscribe = onSnapshot(collection(db, "managedServiceSignals"), snapshot => {
      if (!started) { started = true; void refresh(); return; }
      const ids = [...new Set(snapshot.docChanges().map(change => change.doc.id))];
      void Promise.all(ids.map(async carrierId => {
        try {
          const result = await call<Detail>("getManagedServiceAccount", { carrierId });
          if (stopped) return;
          const row: Summary = { carrierId, companyName: result.companyName,
            billingStatus: result.billingStatus, contact: result.contact, coverage: result.coverage,
            counts: result.counts, itemCount: result.items.length,
            pendingCustomCount: result.pendingCustom.length,
            highlights: queueHighlights(result.items, result.pendingCustom) };
          setAccounts(previous => result.coverage.status === "active"
            ? previous.some(v => v.carrierId === carrierId)
              ? previous.map(v => v.carrierId === carrierId ? row : v)
              : [...previous, row]
            : previous.filter(v => v.carrierId !== carrierId));
          if (detailId.current === carrierId) {
            setDetail(result);
            setItemDates(Object.fromEntries(result.items.map(item => [item.key, item.sourceInputDate || ""])));
            setItemNotes({});
            setMessage(previous => previous.startsWith("Verified date saved")
              ? previous : "Company data refreshed. Review current dates before logging work.");
          }
        } catch { if (!stopped) { if (detailId.current === carrierId) { detailId.current = null; setDetail(null); } void refresh(); } }
      }));
    }, error => { setMessage(errorText(error)); void refresh(); });
    return () => { stopped = true; unsubscribe(); };
  }, [ownerAccess, refresh]);
  const selectCompany = async (company: Candidate) => {
    const selected = company.contact ? company
      : await call<Candidate>("findManagedServiceCandidate", { carrierId: company.carrierId });
    if (selected.coverage) {
      setCandidate(null);
      await open(selected.carrierId, true);
      return;
    }
    setCandidate(selected);
    setShowSetup(true);
    detailId.current = null;
    setDetail(null);
    focusDetail.current = true;
    setAreas({ company: true, drivers: true, fleet: true });
    setEffectiveDate(currentDate);
    setConsentReference("");
    setMessage("");
  };
  const chooseRequest = async (row: ServiceRequest) => {
    setWorking(true);
    try {
      const found = await call<Candidate>("findManagedServiceCandidate", { carrierId: row.carrierId });
      if (found.carrierId !== row.carrierId)
        throw new Error("This account no longer matches the request. Find the company in the list below.");
      await selectCompany(found);
      if (row.areas.company || row.areas.drivers || row.areas.fleet)
        setAreas({ company: row.areas.company === true,
          drivers: row.areas.drivers === true, fleet: row.areas.fleet === true });
      setMessage(row.areas.company || row.areas.drivers || row.areas.fleet
        ? "Requested areas are selected below. Confirm the written agreement before starting coverage."
        : "The customer asked to end managed support. Use Pause managed coverage below after confirming the end date.");
    } catch (error) { setMessage(errorText(error)); }
    finally { setWorking(false); }
  };
  const recordRequest = async (row: ServiceRequest, status: "contacted" | "closed") => {
    const note = (requestNotes[row.carrierId] || "").trim();
    if (note.length < 3) { setMessage("Add a note about this request before changing its status."); return; }
    setWorking(true);
    try {
      await call("updateManagedServiceRequestStatus", { carrierId: row.carrierId, status, note });
      setRequestNotes(previous => ({ ...previous, [row.carrierId]: "" }));
      await loadRequests();
      setMessage(status === "contacted" ? "Contact logged. No email was sent by this button."
        : row.status === "change_requested" ? "Change request closed. Existing coverage and billing remain in place."
        : "Request closed without a quote.");
    } catch (error) { setMessage(errorText(error)); }
    finally { setWorking(false); }
  };
  const prepareQuote = async (row: ServiceRequest) => {
    const scope = (quoteScopes[row.carrierId] ?? row.quote?.scope ?? suggestedQuoteScope(row.areas)).trim();
    const dqFiles = Number(quoteDqFiles[row.carrierId] || "0");
    if (scope.length < 20 || !Number.isSafeInteger(dqFiles) || dqFiles < 0) {
      setQuoteFeedback(previous => ({ ...previous, [row.carrierId]:
        "Add a scope of at least 20 characters and a valid DQ-file count before preparing the quote." }));
      return;
    }
    setQuoteFeedback(previous => ({ ...previous, [row.carrierId]: "Preparing the customer quote…" }));
    setWorking(true);
    try {
      await call("prepareManagedServiceQuote", { carrierId: row.carrierId, scope, dqFiles });
      await loadRequests();
      setQuoteFeedback(previous => ({ ...previous, [row.carrierId]:
        "Quote ready on the customer's Managed tracking page. No payment or coverage change occurred." }));
    } catch (error) {
      setQuoteFeedback(previous => ({ ...previous, [row.carrierId]: errorText(error) }));
    }
    finally { setWorking(false); }
  };
  const enterIntake = async (row: ServiceRequest) => {
    const drivers = row.intake?.drivers?.length || 0;
    const vehicles = row.intake?.vehicles?.length || 0;
    if (!drivers && !vehicles) return;
    setWorking(true);
    try {
      const result = await call<{ driversAdded: number; vehiclesAdded: number; alreadyConfirmed: boolean }>(
        "enterManagedIntakeUnits", { carrierId: row.carrierId });
      setConfirmIntakeId(null);
      await loadRequests();
      setIntakeFeedback(previous => ({ ...previous, [row.carrierId]: result.alreadyConfirmed
        ? "These quoted records were already checked. Continue with paid company setup below."
        : result.driversAdded || result.vehiclesAdded
          ? `Added ${result.driversAdded} driver${result.driversAdded === 1 ? "" : "s"} and ${result.vehiclesAdded} vehicle${result.vehiclesAdded === 1 ? "" : "s"}. Check their dates and app billing, then finish paid company setup below.`
          : "All quoted drivers and vehicles were already on the customer's dashboard. No new records were added. Continue with paid company setup below." }));
    } catch (error) { setIntakeFeedback(previous => ({ ...previous, [row.carrierId]: errorText(error) })); }
    finally { setWorking(false); }
  };
  const scheduleEnd = async (row: ServiceRequest) => {
    setWorking(true);
    try {
      const result = await call<{ cancelAtMillis: number | null }>("scheduleManagedServiceEnd", { carrierId: row.carrierId });
      await loadRequests();
      setMessage(`Managed billing is set to end at the current paid period${result.cancelAtMillis ? ` on ${new Date(result.cancelAtMillis).toLocaleDateString()}` : ""}. Coverage continues until then.`);
    } catch (error) { setMessage(errorText(error)); }
    finally { setWorking(false); }
  };
  const save = async (status: "draft" | "active" | "paused") => {
    const carrierId = detail?.carrierId || candidate?.carrierId;
    if (!carrierId) return;
    if (status === "active" && consentReference.trim().length < 8) {
      setMessage("Before activating, enter where the customer agreed to the managed scope.");
      return;
    }
    setWorking(true);
    try {
      await call("saveManagedServiceCoverage", { carrierId, status, areas, effectiveDate, consentReference });
      setMessage(status === "active" ? "Managed coverage is active. Billing is handled separately." : "Coverage saved.");
      setCandidate(null);
      await refresh();
      await loadCompanies();
      await loadRequests();
      await open(carrierId, true);
    } catch (error) { setMessage(errorText(error)); }
    finally { setWorking(false); }
  };
  const record = async (item: Item, status: string) => {
    if (!detail) return;
    const note = (itemNotes[item.key] || "").trim();
    if (note.length < 3) { setMessage("Add a note to this item before logging an action."); return; }
    setBusyItem(item.key);
    try {
      await call("updateManagedServiceWork", { carrierId: detail.carrierId, itemKey: item.key,
        status, note, sourceVersion: item.sourceVersion });
      setItemNotes(previous => ({ ...previous, [item.key]: "" }));
      await open(detail.carrierId);
    } catch (error) { await open(detail.carrierId); setMessage(errorText(error)); }
    finally { setBusyItem(null); }
  };
  const saveDeadline = async (item: Item) => {
    if (!detail) return;
    const note = (itemNotes[item.key] || "").trim();
    const inputDate = (itemDates[item.key] || "").trim();
    if (note.length < 8) { setMessage("Record where you verified the date."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
      setMessage("Enter a date as YYYY-MM-DD."); return;
    }
    setBusyItem(item.key);
    try {
      const outcome = await call<{ saved: boolean }>("saveManagedServiceDeadline", { carrierId: detail.carrierId,
        itemKey: item.key, inputDate, note, sourceVersion: item.sourceVersion });
      setItemNotes(previous => ({ ...previous, [item.key]: "" }));
      await open(detail.carrierId);
      setMessage(outcome.saved ? "Verified date saved to the customer's dashboard." : "This date was already on the customer's dashboard.");
    } catch (error) {
      await open(detail.carrierId);
      setMessage(errorText(error));
    } finally { setBusyItem(null); }
  };
  const acceptCustom = async (customId: string) => {
    if (!detail) return;
    const noteKey = "custom:" + customId;
    const note = (itemNotes[noteKey] || "").trim();
    if (note.length < 8) { setMessage("Note the source and filing due date you verified."); return; }
    setBusyItem(customId);
    try {
      await call("acceptManagedCustomRequirement", { carrierId: detail.carrierId, customId,
        note });
      setItemNotes(previous => ({ ...previous, [noteKey]: "" }));
      await open(detail.carrierId);
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusyItem(null); }
  };
  const totals = accounts.filter(row => row.coverage.status === "active").reduce((sum, row) => ({
    overdue: sum.overdue + row.counts.overdue,
    due30: sum.due30 + row.counts.due30,
    due90: sum.due90 + row.counts.due90,
    needsInfo: sum.needsInfo + row.counts.needsInfo,
    waiting: sum.waiting + row.counts.waiting,
  }), { overdue: 0, due30: 0, due90: 0, needsInfo: 0, waiting: 0 });
  const activeAccounts = accounts.filter(row => row.coverage.status === "active");
  const queueCount = (row: Summary, filter: QueueFilter): number => {
    if (filter === "due90") return Math.max(0, row.counts.due90 - row.counts.due30);
    if (filter === "all") return row.itemCount;
    return row.counts[filter];
  };
  const queueAccounts = (queueFilter === "all" ? accounts : activeAccounts)
    .filter(row => queueFilter === "all" || queueCount(row, queueFilter) > 0)
    .sort((a, b) => {
      if (queueFilter === "overdue" || queueFilter === "due30" || queueFilter === "due90") {
        const firstDue = (a.highlights?.[queueFilter]?.dueDate || "9999-99-99")
          .localeCompare(b.highlights?.[queueFilter]?.dueDate || "9999-99-99");
        if (firstDue !== 0) return firstDue;
      }
      return queueCount(b, queueFilter) - queueCount(a, queueFilter)
        || a.companyName.localeCompare(b.companyName);
    });
  const selectedQueueIndex = detail ? queueAccounts.findIndex(row => row.carrierId === detail.carrierId) : -1;
  const filterCount = (filter: QueueFilter): number =>
    filter === "overdue" ? totals.overdue : filter === "due30" ? totals.due30
      : filter === "due90" ? Math.max(0, totals.due90 - totals.due30)
      : filter === "needsInfo" ? totals.needsInfo : filter === "waiting" ? totals.waiting : accounts.length;
  const selectFilter = (filter: QueueFilter) => {
    setQueueFilter(filter);
    setVisibleCompanies(10);
    detailId.current = null;
    setDetail(null);
    setCandidate(null);
    setShowSetup(false);
  };
  if (ownerAccess !== "allowed") return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.replace("/(app)/settings")}><Text style={styles.back}>‹ Back to Settings</Text></Pressable>
    <Text style={styles.eyebrow}>OWNER TOOLS</Text>
    <Text style={styles.title}>Managed tracking</Text>
    <View style={styles.card}><Text style={styles.help}>{ownerAccess === "checking"
      ? "Checking owner access…"
      : ownerAccess === "error" ? "We could not verify owner access. Return to Settings and try again."
      : "This staging account does not have owner access. Sign in with the staging owner account to review customer requests."}</Text></View>
  </ScrollView>;
  return <><Head><title>Owner Managed Tracking | We Heart Paperwork</title><meta name="robots" content="noindex,nofollow" /></Head><ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.replace("/(app)/settings")}><Text style={styles.back}>‹ Back to Settings</Text></Pressable>
    <Text style={styles.eyebrow}>OWNER TOOLS</Text>
    <Text style={styles.title}>Managed tracking</Text>
    <Text style={styles.help}>A private work queue across the companies you support. Preparing a quote makes its price and scope visible to the customer. Production also emails the quote; staging does not. Payment goes through Stripe after the customer accepts.</Text>
    <View style={styles.warning}><Text style={styles.warningText}>Start coverage only after the request shows “paid awaiting start.” The app subscription remains separate. Staging checkout requires Stripe test mode.</Text></View>
    {!!message && <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>}
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.section}>Customer requests</Text>
        <Button label="Refresh" subtle onPress={() => void loadRequests()} disabled={working || requestLoading} /></View>
      <Text style={styles.help}>Customers choose whole areas after app checkout. Review their dates, quantities, and scope; prepare a quote; then wait for the customer to accept and pay before activation.</Text>
      {requestLoading && <ActivityIndicator color="#27500A" />}
      {!!requestError && <Text style={styles.warningText}>{requestError}</Text>}
      {!requestLoading && !requestError && requests.length === 0 && <Text style={styles.help}>No requests are waiting for review.</Text>}
      {requests.map(row => <View key={row.carrierId} style={styles.item}>
        <Text style={styles.accountTitle}>{row.companyName}</Text>
        <Text style={styles.small}>{REQUEST_STAGE[row.status] || row.status.replaceAll("_", " ")} · Requested: {(["company", "drivers", "fleet"] as (keyof Areas)[])
          .filter(key => row.areas[key]).map(key => AREA_LABEL[key]).join(", ") || "End managed support"}</Text>
        <ContactDetails contact={{ accountEmail: row.accountEmail,
          preferredEmail: row.preferredEmail, preferredPhone: row.preferredPhone,
          accountPhone: row.accountPhone, textPermission: row.textPermission }} />
        {(row.areas.drivers || row.areas.fleet) && <View style={styles.contactBox}>
          <Text style={styles.small}>Customer intake · {row.intake?.drivers?.length || 0} drivers · {row.intake?.vehicles?.length || 0} units</Text>
          {(row.intake?.drivers || []).map((driver, index) => <Text key={`d${index}`} style={styles.small}>
            Driver: {driver.name} · {driver.cdlState} CDL {driver.cdlNumber} · Class {driver.cdlClass}
            {driver.cdlExpiration ? ` · CDL expires ${driver.cdlExpiration}` : ""}
            {driver.medicalExpiration ? ` · Medical expires ${driver.medicalExpiration}` : ""}
          </Text>)}
          {(row.intake?.vehicles || []).map((vehicle, index) => <Text key={`v${index}`} style={styles.small}>
            {vehicle.type === "trailer" ? "Trailer" : "Truck"} {vehicle.unitNumber} · VIN/serial {vehicle.vin}
            {vehicle.registrationExpiration ? ` · Registration expires ${vehicle.registrationExpiration}` : ""}
            {vehicle.inspectionExpiration ? ` · Inspection expires ${vehicle.inspectionExpiration}` : ""}
          </Text>)}
          <Text style={styles.small}>Review these details and existing account records before quoting. Intake is information only; it does not add units or start billing. After payment, you can check the quoted units and add any missing records.</Text>
          {row.status === "paid_awaiting_start" && !!(row.intake?.drivers?.length || row.intake?.vehicles?.length) && <>
            {row.intakeUnitsConfirmedRevision === row.revision ? <Text style={styles.small} accessibilityRole="alert">
              Quoted units checked. {row.intakeUnitsAdded?.drivers || 0} driver{row.intakeUnitsAdded?.drivers === 1 ? "" : "s"} and {row.intakeUnitsAdded?.vehicles || 0} vehicle{row.intakeUnitsAdded?.vehicles === 1 ? "" : "s"} added. Any matching records were left unchanged. Continue with paid company setup below.
            </Text> : confirmIntakeId !== row.carrierId ? <Button label="Check quoted units against dashboard" subtle
              onPress={() => setConfirmIntakeId(row.carrierId)} disabled={working} /> : <View style={styles.contactBox}>
              <Text style={styles.small}>Check the list above against the paid quote. This adds missing driver or vehicle records only; matching records are left as they are. A new active driver also increases the separate app subscription by $1/month per driver.</Text>
              <Button label="Confirm and add missing records" onPress={() => void enterIntake(row)} disabled={working} />
              <Button label="Cancel setup" subtle onPress={() => setConfirmIntakeId(null)} disabled={working} />
            </View>}
            {!!intakeFeedback[row.carrierId] && row.intakeUnitsConfirmedRevision !== row.revision &&
              <Text style={styles.small} accessibilityRole="alert">{intakeFeedback[row.carrierId]}</Text>}
          </>}
        </View>}
        {row.quote && <View style={styles.contactBox}>
          <Text style={styles.small}>Quote: {row.quote.status} · ${row.quote.price.firstYearMonthly}/month in year one,
            then ${row.quote.price.renewalMonthly}/month · ${row.quote.price.fleetOnlyOnboardingOneTime + row.quote.price.dqFileOneTime} one-time</Text>
          <Text style={styles.small}>Quoted units: {row.quote.counts.drivers} drivers, {row.quote.counts.trucks} trucks, {row.quote.counts.trailers} trailers, {row.quote.counts.dqFiles} DQ files</Text>
          <Text style={styles.small}>Scope: {row.quote.scope}</Text>
        </View>}
        <Text style={styles.small}>Updated: {row.updatedAtMillis
          ? new Date(row.updatedAtMillis).toLocaleString() : "Recently"}</Text>
        {["requested", "contacted", "quoted"].includes(row.status) && !!(row.areas.company || row.areas.drivers || row.areas.fleet) && <View style={styles.contactBox}>
          <Text style={styles.small}>Prepare the written scope and exact price from active account units plus the listed intake. Matching units count once. No unit or charge is added when you prepare a quote.</Text>
          <Text style={styles.small}>Written scope shown to the customer · Review and edit this draft before sending the quote.</Text>
          <TextInput style={styles.input} value={quoteScopes[row.carrierId] ?? row.quote?.scope ?? suggestedQuoteScope(row.areas)}
            onChangeText={value => setQuoteScopes(previous => ({ ...previous, [row.carrierId]: value }))}
            placeholder="What we will set up, review, guide, and follow up on; what the customer submits and pays" multiline />
          {row.areas.drivers && <><Text style={styles.small}>Driver qualification files to prepare separately · $99 each. Enter 0 if none.</Text>
          <TextInput style={styles.input} value={quoteDqFiles[row.carrierId] || "0"}
            onChangeText={value => setQuoteDqFiles(previous => ({ ...previous, [row.carrierId]: value }))}
            keyboardType="number-pad" placeholder="Number of DQ files to build separately" /></>}
          <Button label={row.status === "quoted" ? "Replace unaccepted quote" : "Prepare exact customer quote"}
            onPress={() => void prepareQuote(row)} disabled={working} />
          {!!quoteFeedback[row.carrierId] && <Text style={styles.small} accessibilityRole="alert">{quoteFeedback[row.carrierId]}</Text>}
        </View>}
        {row.status === "change_requested" && <View style={styles.contactBox}>
          <Text style={styles.small}>Existing managed coverage and billing remain active. Contact the customer to confirm the requested scope. This preview cannot revise an active managed subscription or activate a changed scope. Do not promise a new price or coverage until the billing change is ready.</Text>
          <TextInput style={styles.input} value={requestNotes[row.carrierId] || ""}
            onChangeText={value => setRequestNotes(previous => ({ ...previous, [row.carrierId]: value }))}
            placeholder="Note your follow-up or why the change will not proceed" multiline />
          <View style={styles.row}>
            <Button label="Log customer follow-up" subtle onPress={() => void recordRequest(row, "contacted")} disabled={working} />
            <Button label="Close without changing coverage" subtle onPress={() => void recordRequest(row, "closed")} disabled={working} />
          </View>
        </View>}
        {row.status === "paid_awaiting_start" && <Button label="Finish paid company setup" subtle onPress={() => void chooseRequest(row)} disabled={working} />}
        {row.status === "end_requested" && <Button label="Review current coverage" subtle onPress={() => void chooseRequest(row)} disabled={working} />}
        {row.status === "end_requested" && <Button label="End managed billing at period end"
          onPress={() => void scheduleEnd(row)} disabled={working} />}
        {["requested", "contacted"].includes(row.status) && <><TextInput style={styles.input} value={requestNotes[row.carrierId] || ""}
          onChangeText={value => setRequestNotes(previous => ({ ...previous, [row.carrierId]: value }))}
          placeholder="Note the contact or reason for closing" multiline />
        <View style={styles.row}>
          <Button label="Log customer contacted" subtle onPress={() => void recordRequest(row, "contacted")} disabled={working} />
          <Button label="Decline and close request" subtle onPress={() => void recordRequest(row, "closed")} disabled={working} />
        </View></>}
      </View>)}
    </View>
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.section}>Managed company queue</Text>
        <Button label="Refresh" subtle onPress={() => void refresh()} disabled={loading} /></View>
      <Text style={styles.help}>Choose a work list, then open one company at a time. Its work appears below the queue. The 30-day and 31–90-day lists do not overlap. Items needing information or waiting on a customer can also appear in a deadline list.</Text>
      {loading ? <ActivityIndicator color="#27500A" /> :
        <Text style={styles.totals}>{activeAccounts.length} active companies · {totals.overdue} overdue {totals.overdue === 1 ? "item" : "items"} · {totals.due30} {totals.due30 === 1 ? "item" : "items"} due in 30 days · {Math.max(0, totals.due90 - totals.due30)} {totals.due90 - totals.due30 === 1 ? "item" : "items"} due in 31–90 days · {totals.needsInfo} {totals.needsInfo === 1 ? "item needs" : "items need"} information · {totals.waiting} {totals.waiting === 1 ? "item" : "items"} waiting</Text>}
      <View style={styles.filterRow}>{QUEUE_FILTERS.map(filter =>
        <Pressable key={filter.key} onPress={() => selectFilter(filter.key)}
          accessibilityRole="button" accessibilityState={{ selected: queueFilter === filter.key }}
          style={[styles.filterChip, queueFilter === filter.key && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, queueFilter === filter.key && styles.filterChipTextActive]}>
            {filter.label} ({filterCount(filter.key)} {filter.key === "all" ? "companies" : filterCount(filter.key) === 1 ? "item" : "items"})</Text>
        </Pressable>)}</View>
      {!loading && <Text style={styles.help}>{queueAccounts.length} {queueAccounts.length === 1 ? "company" : "companies"} in this list. Deadline lists show the earliest due dates first.</Text>}
      {!loading && queueAccounts.length === 0 && <Text style={styles.help}>No companies have items in this list right now. Choose another list above.</Text>}
      {queueAccounts.slice(0, visibleCompanies).map(row => <Pressable key={row.carrierId}
        onPress={() => void open(row.carrierId)} style={[styles.account, detail?.carrierId === row.carrierId && styles.selectedAccount]}>
        <Text style={styles.accountTitle}>{row.companyName}</Text>
        <Text style={styles.small}>{row.coverage.status.toUpperCase()} · {queueCount(row, queueFilter)} {queueFilter === "all" ? "tracked items" : "items in this list"}</Text>
        {row.highlights?.[queueFilter] && <Text style={styles.queueHighlight}>
          {row.highlights[queueFilter]!.label}
          {row.highlights[queueFilter]!.dueDate ? " · Due " + row.highlights[queueFilter]!.dueDate
            : row.highlights[queueFilter]!.issue ? " · " + row.highlights[queueFilter]!.issue : ""}
        </Text>}
        <Text style={styles.small}>Items: {row.counts.overdue} overdue · {row.counts.due30} next 30 days · {Math.max(0, row.counts.due90 - row.counts.due30)} days 31–90 · {row.counts.needsInfo} need information · {row.counts.waiting} waiting</Text>
        <Text selectable style={styles.small}>Email: {row.contact.preferredEmail || row.contact.accountEmail || "Not provided"} · Phone: {row.contact.preferredPhone || row.contact.accountPhone || "Not provided"}</Text>
        <Text style={styles.back}>Open work ›</Text>
      </Pressable>)}
      {queueAccounts.length > visibleCompanies && <Button label={"Show next " + Math.min(10, queueAccounts.length - visibleCompanies) + " companies"} subtle
        onPress={() => setVisibleCompanies(count => count + 10)} />}
    </View>
    {detail && <View style={styles.card} onLayout={event => {
      detailPosition.current = event.nativeEvent.layout.y;
      if (focusDetail.current) {
        focusDetail.current = false;
        scrollRef.current?.scrollTo({ y: Math.max(0, detailPosition.current - 12), animated: true });
      }
    }}>
      <View style={styles.row}><Text style={styles.section}>{detail.companyName} · managed work</Text>
        <Button label="Close company" subtle onPress={() => { detailId.current = null; setDetail(null); setShowSetup(false); }} />
      </View>
      <Text style={styles.help}>Only {detail.companyName}'s items are shown here. Choose Next company or close this company to return to the queue.</Text>
      <ContactDetails contact={detail.contact} />
      {selectedQueueIndex >= 0 && <View style={styles.row}>
        <Text style={styles.small}>Company {selectedQueueIndex + 1} of {queueAccounts.length} in {QUEUE_FILTERS.find(row => row.key === queueFilter)?.label}</Text>
        {selectedQueueIndex > 0 && <Button label="Previous company" subtle
          onPress={() => void open(queueAccounts[selectedQueueIndex - 1].carrierId)} disabled={working} />}
        {selectedQueueIndex + 1 < queueAccounts.length && <Button label="Next company ›" subtle
          onPress={() => void open(queueAccounts[selectedQueueIndex + 1].carrierId)} disabled={working} />}
      </View>}
      {selectedQueueIndex < 0 && queueAccounts.length > 0 && <View style={styles.row}>
        <Text style={styles.help}>This company has no work left in {QUEUE_FILTERS.find(row => row.key === queueFilter)?.label}. Continue with another company in this list.</Text>
        <Button label="Open next listed company ›" subtle onPress={() => void open(queueAccounts[0].carrierId)} disabled={working} />
      </View>}
      <Text style={styles.help}>Open a public guide, send your message outside this app, then log what you did here. These buttons do not send email. Verified date changes here update the customer's dashboard. Customers confirm completed filings, reviews, and inspections in their app.</Text>
      {!!(detail.selfManagedUnitCounts?.drivers || detail.selfManagedUnitCounts?.vehicles) &&
        <Text style={styles.help}>Outside managed coverage: {detail.selfManagedUnitCounts?.drivers || 0} self-managed drivers and {detail.selfManagedUnitCounts?.vehicles || 0} self-managed trucks/trailers. If the customer wants an area they did not select, prepare a separate scope and billing change before managing its units.</Text>}
      {detail.pendingCustom.length > 0 && (queueFilter === "all" || queueFilter === "needsInfo") && <>
        <Text style={styles.subheading}>New units and custom items awaiting review</Text>
        {detail.managedStripeSubscriptionId && <Text selectable style={styles.small}>Managed Stripe subscription: {detail.managedStripeSubscriptionId}</Text>}
        {detail.pendingCustom.map(row => <View key={row.id} style={styles.item}>
          <Text style={styles.accountTitle}>{row.name}</Text><Text style={styles.small}>{row.reason}</Text>
          {row.kind === "unit" && row.collectionId && <>
            <Text style={styles.small}>Added managed price: ${row.unitType === "driver" ? MANAGED_PRICING.driverMonthly
              : row.unitType === "trailer" ? MANAGED_PRICING.trailerMonthly : MANAGED_PRICING.truckMonthly}/month. The existing Company rate stays the same. Contact the customer first and record their agreement. Update this unit's recurring quantity in the managed Stripe subscription and every remaining schedule phase, with no proration. Then verify and enroll it here.</Text>
            <TextInput style={styles.input} value={unitAgreements[row.collectionId + ":" + row.id] || ""}
              onChangeText={value => setUnitAgreements(previous => ({ ...previous, [row.collectionId + ":" + row.id]: value }))}
              placeholder="Where the customer agreed to the added monthly charge" />
            <Button label="Verify billing and enroll this unit" subtle
              onPress={() => void enrollUnit(row)} disabled={!!busyItem} />
          </>}
          {row.kind !== "unit" && <TextInput style={styles.input} value={itemNotes["custom:" + row.id] || ""}
            onChangeText={value => setItemNotes(previous => ({ ...previous, ["custom:" + row.id]: value }))}
            placeholder="Where did you verify the filing due date?" multiline />}
          {row.kind !== "unit" && !row.reason.startsWith("Recurring") && <Button label="Accept verified due date" subtle
            onPress={() => void acceptCustom(row.id)} disabled={!!busyItem} />}
        </View>)}
      </>}
      {(["company", "drivers", "fleet"] as (keyof Areas)[]).map(area => {
        const list = detail.items.filter(item => item.area === area && matchesQueue(item, queueFilter));
        if (list.length === 0) return null;
        return <View key={area}><Text style={styles.subheading}>{AREA_LABEL[area]}</Text>
          {list.map(item => <View key={item.key} style={styles.item}>
            <Text style={styles.accountTitle}>{item.label}</Text>
            <Text style={styles.small}>{item.dueDate ? "Due " + item.dueDate + " · " + (item.days! < 0 ? "Overdue" : item.days + " days left") : item.issue}
              {" · "}{item.status.replaceAll("_", " ")}</Text>
            {!!item.note && <Text style={styles.small}>Last note: {item.note}</Text>}
            {detail.coverage.status === "active" && editableDate(item) && <>
              <Text style={styles.label}>{dateInputLabel(item)}</Text>
              <TextInput style={styles.input} value={itemDates[item.key] || ""}
                onChangeText={value => setItemDates(previous => ({ ...previous, [item.key]: value }))}
                placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
              <Text style={styles.small}>Current app date: {item.sourceInputDate || "not set"}.
                Record the source in the note below before saving.</Text>
            </>}
            <TextInput style={styles.input} value={itemNotes[item.key] || ""}
              onChangeText={value => setItemNotes(previous => ({ ...previous, [item.key]: value }))}
              placeholder="Note what you sent or what needs follow-up" multiline />
            <View style={styles.row}>
              {detail.coverage.status === "active" && editableDate(item) &&
                <Button label="Save verified date" disabled={!!busyItem}
                  onPress={() => void saveDeadline(item)} />}
              {guideUrl(item.key) && <Button label="Open public guide" subtle
                onPress={() => { const url = guideUrl(item.key); if (url) void Linking.openURL(url); }} />}
              <Button label="Log instructions I sent" subtle disabled={!!busyItem || detail.coverage.status !== "active"}
                onPress={() => void record(item, "instructions_sent")} />
              <Button label="Log waiting on customer" subtle disabled={!!busyItem || detail.coverage.status !== "active"}
                onPress={() => void record(item, "waiting_on_customer")} />
              <Button label="Flag for follow-up" subtle disabled={!!busyItem || detail.coverage.status !== "active"}
                onPress={() => void record(item, "follow_up_due")} />
            </View>
          </View>)}
        </View>;
      })}
      {detail.items.filter(item => matchesQueue(item, queueFilter)).length === 0
        && !(detail.pendingCustom.length > 0 && (queueFilter === "all" || queueFilter === "needsInfo"))
        && <Text style={styles.help}>No items for this company in the selected list.</Text>}
      <Text style={styles.subheading}>Action history</Text>
      <Text style={styles.help}>Each entry is saved with the item, your note, and the time. This history records your work; it does not confirm an email was delivered.</Text>
      {detail.history.length === 0 && <Text style={styles.small}>No action recorded yet.</Text>}
      {detail.history.map(row => <Text key={row.id} style={styles.history}>
        {row.createdAtMillis ? new Date(row.createdAtMillis).toLocaleString() : "Recent"} · {row.type.replaceAll("_", " ")}{row.itemLabel || row.itemKey ? " · " + (row.itemLabel || detail.items.find(item => item.key === row.itemKey)?.label || row.itemKey) : ""}{row.note ? " · " + row.note : ""}
      </Text>)}
    </View>}
    {(candidate || (detail && showSetup)) && <View style={styles.card} onLayout={event => {
      detailPosition.current = event.nativeEvent.layout.y;
      if (focusDetail.current && !detail) {
        focusDetail.current = false;
        scrollRef.current?.scrollTo({ y: Math.max(0, detailPosition.current - 12), animated: true });
      }
    }}>
      <View style={styles.row}><Text style={styles.section}>{detail?.companyName || candidate?.companyName} · service setup</Text>
        <Button label="Close setup" subtle onPress={() => { setShowSetup(false); setCandidate(null); }} />
      </View>
      <Text style={styles.help}>This setup applies only to {detail?.companyName || candidate?.companyName}. It is separate from the daily work queue.</Text>
      {(detail?.contact || candidate?.contact) && <ContactDetails contact={(detail?.contact || candidate?.contact)!} />}
      <Text style={styles.help}>Use this when the service starts or its scope changes. It is not part of your daily work. Choose whole tabs; custom Company items require separate due-date verification.</Text>
      <View style={styles.row}>{(["company", "drivers", "fleet"] as (keyof Areas)[]).map(key =>
        <Pressable key={key} onPress={() => setAreas(value => ({ ...value, [key]: !value[key] }))}
          style={[styles.choice, areas[key] && styles.selected]}>
          <Text style={styles.choiceText}>{areas[key] ? "✓ " : ""}{AREA_LABEL[key]}</Text>
        </Pressable>)}</View>
      <Text style={styles.label}>Effective date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={effectiveDate} onChangeText={setEffectiveDate} />
      <Text style={styles.label}>Customer agreement reference</Text>
      <TextInput style={styles.input} value={consentReference} onChangeText={setConsentReference}
        placeholder="For example: email agreement dated Oct 27" />
      <Text style={styles.help}>Keep the agreement itself in your normal business records. This field records where to find it.</Text>
      <View style={styles.row}>
        <Button label="Save setup draft" subtle onPress={() => void save("draft")} disabled={working} />
        <Button label="Start managed coverage" onPress={() => void save("active")}
          disabled={working || !(detail?.coverage.status === "active" ||
            requests.some(row => row.carrierId === (detail?.carrierId || candidate?.carrierId) && row.status === "paid_awaiting_start"))} />
        {detail?.coverage.status === "active" && <Button label="Pause managed coverage" subtle onPress={() => void save("paused")} disabled={working} />}
      </View>
      {detail && <Text style={styles.help}>Current status: {detail.coverage.status}. First-year anniversary: {detail.coverage.anniversaryDate || "Not set"}. Coverage changes appear in the customer dashboard after saving.</Text>}
    </View>}
    {detail && !showSetup && <Button label={"Change managed coverage for " + detail.companyName} subtle onPress={() => setShowSetup(true)} />}
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.section}>Company setup directory</Text>
        <Button label={showDirectory ? "Hide directory" : "Show directory"} subtle
          onPress={() => { if (!showDirectory && companies.length === 0) void loadCompanies();
            setShowDirectory(value => !value); }} /></View>
      <Text style={styles.help}>Use this directory to review a company's current setup. Start new coverage only after payment is confirmed. Daily deadline work is in the queue above.</Text>
      {showDirectory && <>
      <Text style={styles.help}>Select a company by name to set up or change managed service. No email address is needed.</Text>
      <TextInput style={styles.input} value={companyFilter} onChangeText={setCompanyFilter}
        placeholder="Filter loaded companies by name" autoCapitalize="words" />
      <Text style={styles.small}>Showing {companies.length} company accounts. Load more if the company is not here yet.</Text>
      {loadingCompanies && companies.length === 0 && <ActivityIndicator color="#27500A" />}
      {companies.filter(row => row.companyName.toLowerCase().includes(companyFilter.trim().toLowerCase()))
        .map(row => <Pressable key={row.carrierId} onPress={() => void selectCompany(row)} style={styles.account}>
          <Text style={styles.accountTitle}>{row.companyName}</Text>
          <Text style={styles.small}>App access: {row.billingStatus || "not active"} · Managed service: {row.coverage?.status || "not set up"}</Text>
          <Text style={styles.back}>Open company ›</Text>
        </Pressable>)}
      {nextCursor && <Button label={loadingCompanies ? "Loading…" : "Load more companies"} subtle
        onPress={() => void loadCompanies(nextCursor)} disabled={loadingCompanies} />}
      </>}
    </View>
  </ScrollView></>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F5F1" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 20, paddingBottom: 70 },
  back: { color: "#27500A", fontWeight: "800", marginBottom: 20 },
  eyebrow: { color: "#3B6D11", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#1A1915", fontSize: 32, fontWeight: "800", marginVertical: 8 },
  section: { color: "#1A1915", fontSize: 21, fontWeight: "800", marginBottom: 9 },
  subheading: { color: "#27500A", fontSize: 17, fontWeight: "800", marginTop: 18, marginBottom: 8 },
  help: { color: "#5F5D57", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  warning: { backgroundColor: "#FFF2DA", borderRadius: 10, padding: 14, marginVertical: 15 },
  warningText: { color: "#704914", lineHeight: 21 },
  message: { backgroundColor: "#EAF3DE", padding: 13, borderRadius: 10, marginBottom: 12 },
  messageText: { color: "#27500A" },
  card: { backgroundColor: "#FFF", padding: 18, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: "#E5E3DA" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  filterChip: { borderWidth: 1, borderColor: "#B8C7A8", borderRadius: 22, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: "#F8FAF5" },
  filterChipActive: { backgroundColor: "#27500A", borderColor: "#27500A" },
  filterChipText: { color: "#27500A", fontWeight: "700" },
  filterChipTextActive: { color: "#FFF" },
  selectedAccount: { borderColor: "#27500A", backgroundColor: "#F0F7E8" },
  queueHighlight: { color: "#24281E", fontSize: 15, fontWeight: "700", marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#CFCBBF", borderRadius: 9, padding: 11, marginBottom: 11,
    minHeight: 44, color: "#1A1915", backgroundColor: "#FFF" },
  label: { color: "#3A3833", fontWeight: "700", marginBottom: 6 },
  button: { backgroundColor: "#27500A", paddingHorizontal: 15, paddingVertical: 11, borderRadius: 9, marginRight: 7, marginBottom: 7 },
  buttonText: { color: "#FFF", fontWeight: "800" },
  subtle: { backgroundColor: "#F2F7EB", borderWidth: 1, borderColor: "#B8CBA7" },
  subtleText: { color: "#27500A" },
  disabled: { opacity: 0.4 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginVertical: 5 },
  choice: { borderColor: "#CCC9BE", borderWidth: 1, borderRadius: 9, padding: 11, marginRight: 8, marginBottom: 8 },
  selected: { backgroundColor: "#EAF3DE", borderColor: "#96B976" },
  choiceText: { color: "#27500A", fontWeight: "700" },
  found: { color: "#27500A", fontWeight: "800", marginTop: 12 },
  totals: { color: "#27500A", fontWeight: "700", lineHeight: 22, marginBottom: 10 },
  account: { paddingVertical: 14, borderTopWidth: 1, borderColor: "#E5E3DA" },
  accountTitle: { color: "#1A1915", fontWeight: "800", fontSize: 16, marginBottom: 4 },
  small: { color: "#5F5D57", fontSize: 13, lineHeight: 19 },
  item: { padding: 14, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 10, marginBottom: 9 },
  contactBox: { padding: 12, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 10,
    backgroundColor: "#F8FAF5", marginBottom: 12 },
  history: { color: "#5F5D57", borderTopWidth: 1, borderColor: "#E5E3DA", paddingVertical: 9, fontSize: 12 },
});
