import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getIdTokenResult, onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db, functions } from "../../lib/firebase";
import { MANAGED_PRICING } from "../../lib/managedPricing";
import { formatDateInput, inputToIso, isoToInput } from "../../lib/dateUtils";
import { rememberOwnerReturn } from "../../lib/ownerReturn";
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
  sourceVersion: string | null; sourceInputDate: string | null; dqChecks?: Record<string, boolean | string> };
type CompletionHistory = { itemKey: string; records: { id: string; completionDate: string | null;
  previousDueDate: string | null; nextDueDate: string | null; completedAtMillis: number }[] };
type Detail = Omit<Summary, "itemCount" | "pendingCustomCount"> & {
  stagingDemo?: boolean;
  coverage: Summary["coverage"] & { consentReference?: string };
  items: Item[]; pendingCustom: { id: string; name: string; reason: string; kind?: "unit" | "removal";
    collectionId?: "drivers" | "vehicles"; unitType?: "driver" | "truck" | "trailer" }[];
  managedStripeSubscriptionId?: string | null;
  managedBillingStatus?: string | null;
  selfManagedUnitCounts?: { drivers: number; vehicles: number };
  history: { id: string; type: string; itemKey: string | null; itemLabel: string | null; note: string | null; createdAtMillis: number | null }[];
  completionHistory: CompletionHistory[];
};
type ServiceRequest = { carrierId: string; companyName: string; accountEmail: string;
  preferredEmail: string; preferredPhone: string; accountPhone: string; textPermission: boolean | null;
  billingStatus: string | null; appEndScheduled?: boolean; managedEndScheduled?: boolean; areas: Areas; status: string; revision: number; updatedAtMillis: number | null;
  intakeUnitsConfirmedRevision?: number | null;
  intakeUnitsAdded?: { drivers: number; vehicles: number } | null;
  intake?: { drivers: { name: string; cdlNumber: string; cdlClass: string; cdlState: string;
    cdlExpiration: string; medicalExpiration: string }[];
    vehicles: { type: string; unitNumber: string; vin: string;
      registrationExpiration: string; inspectionExpiration: string }[] };
  quote?: { status: string; scope: string; price: { firstYearMonthly: number;
    renewalMonthly: number; fleetOnlyOnboardingOneTime: number; dqFileOneTime: number };
    signupQuote?: boolean; appMonthly?: number | null;
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
  if (item.status === "completed" || item.status === "not_applicable") return filter === "all";
  if (filter === "overdue") return item.days !== null && item.days < 0;
  if (filter === "due30") return item.days !== null && item.days >= 0 && item.days <= 30;
  if (filter === "due90") return item.days !== null && item.days >= 31 && item.days <= 90;
  if (filter === "needsInfo") return item.issue !== null || item.status === "needs_review";
  if (filter === "waiting") return item.status === "waiting_on_customer";
  return true;
}
function urgency(item: Item): { label: string; rank: number; color: string } {
  if (item.status === "not_applicable") return { label: "DOES NOT APPLY", rank: 7, color: "#5F5D57" };
  if (item.status === "completed") return { label: "COMPLETED", rank: 6, color: "#476E23" };
  if (item.days !== null && item.days < 0)
    return { label: "OVERDUE", rank: 0, color: "#9C2F24" };
  if (item.days !== null && item.days <= 30)
    return { label: "NEXT 30 DAYS", rank: 1, color: "#A35B10" };
  if (item.status === "needs_review" || item.issue)
    return { label: "NEEDS INFORMATION", rank: 2, color: "#A35B10" };
  if (item.status === "waiting_on_customer")
    return { label: "WAITING ON CUSTOMER", rank: 3, color: "#5F5D57" };
  if (item.days !== null && item.days <= 90)
    return { label: "31–90 DAYS", rank: 4, color: "#476E23" };
  return { label: "LATER", rank: 5, color: "#476E23" };
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
const OWNER_COMPLETION_IDS = ["tax2290", "ucr", "ifta", "ifta-quarterly", "boc3"];
const DQ_CHECKS: { field: string; label: string; status?: boolean }[] = [
  { field: "employmentApplicationOnFile", label: "Employment application" },
  { field: "initialMvrOnFile", label: "Initial 3-year MVR(s)" },
  { field: "roadTestOnFile", label: "Road test certificate or equivalent" },
  { field: "preEmploymentClearinghouseQueryComplete", label: "Pre-employment Clearinghouse query" },
  { field: "preEmploymentDrugTestComplete", label: "Pre-employment drug test or exception" },
  { field: "previousEmployerInvestigationComplete", label: "Previous employer investigation" },
  { field: "speStatus", label: "SPE or medical variance", status: true },
  { field: "lcvStatus", label: "LCV qualification", status: true },
];
function dateInputLabel(item: Item): string {
  if (item.key.endsWith(":mvr")) return "Date of last MVR review";
  if (item.key.endsWith(":clearinghouse")) return "Date of last Clearinghouse query";
  if (item.key === "company:fmcsa-portal") return "Date of last FMCSA Portal update";
  return "Next due or expiration date (MM-DD-YYYY)";
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
  const [completionDates, setCompletionDates] = useState<Record<string, string>>({});
  const [itemFeedback, setItemFeedback] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [pendingHistoryDelete, setPendingHistoryDelete] = useState<string | null>(null);
  useEffect(() => {
    let generation = 0;
    return onAuthStateChanged(auth, user => {
      const current = ++generation;
      setOwnerAccess("checking");
      setRequests([]);
      setAccounts([]);
      setCompanies([]);
      setDetail(null);
      setCandidate(null);
      detailId.current = null;
      if (!user) { setOwnerAccess("denied"); return; }
      void getIdTokenResult(user, true).then(token => {
        if (current === generation) setOwnerAccess(token.claims.ownerAdmin === true ? "allowed" : "denied");
      }).catch(() => { if (current === generation) setOwnerAccess("error"); });
    });
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await call<{ accounts: Summary[] }>("listManagedServiceAccounts", {});
      setAccounts(result.accounts);
      setMessage("");
    } catch (error) { setAccounts([]); setMessage(errorText(error)); }
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
      setRequests([]);
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
      const sameCompany = detailId.current === result.carrierId;
      detailId.current = result.carrierId;
      setDetail(result);
      setExpandedItems(previous => sameCompany ? previous : {});
      if (!sameCompany) setCompletionDates({});
      setCandidate(null);
      setShowSetup(setup);
      setItemDates(Object.fromEntries(result.items.map(item => [item.key, isoToInput(item.sourceInputDate || "")])));
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
      setMessage(`${row.name} is now in managed coverage. Stripe will add the unit rate at the next billing cycle; the Company rate did not change.`);
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusyItem(null); }
  };
  const removeUnit = async (row: Detail["pendingCustom"][number]) => {
    if (!detail || !row.collectionId) return;
    const key = row.collectionId + ":" + row.id;
    setBusyItem(key);
    try {
      await call("removeInactiveManagedUnit", {
        carrierId: detail.carrierId, collectionId: row.collectionId, unitId: row.id,
      });
      await open(detail.carrierId);
      setMessage("Managed coverage and the next monthly charge were reduced. Confirm the next invoice in Stripe.");
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
            setItemDates(Object.fromEntries(result.items.map(item => [item.key, isoToInput(item.sourceInputDate || "")])));
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
    if (note.length < 3) {
      setItemFeedback(previous => ({ ...previous, [item.key]: "Add a work note of at least 3 characters above, then select the action again. No action was saved." }));
      return;
    }
    setBusyItem(item.key);
    try {
      await call("updateManagedServiceWork", { carrierId: detail.carrierId, itemKey: item.key,
        status, note, sourceVersion: item.sourceVersion });
      setItemNotes(previous => ({ ...previous, [item.key]: "" }));
      await open(detail.carrierId);
      setExpandedItems(previous => ({ ...previous, [item.key]: true }));
      setItemFeedback(previous => ({ ...previous, [item.key]: "Work action saved. It appears in Action history below; this button does not send a message." }));
    } catch (error) {
      await open(detail.carrierId);
      setExpandedItems(previous => ({ ...previous, [item.key]: true }));
      setItemFeedback(previous => ({ ...previous, [item.key]: errorText(error) }));
    }
    finally { setBusyItem(null); }
  };
  const saveDeadline = async (item: Item) => {
    if (!detail) return;
    const note = (itemNotes[item.key] || "").trim();
    const inputDate = inputToIso((itemDates[item.key] || "").trim());
    if (!inputDate) {
      setItemFeedback(previous => ({ ...previous, [item.key]: "Enter a valid date as MM-DD-YYYY." }));
      return;
    }
    if (note.length < 8) {
      setItemFeedback(previous => ({ ...previous, [item.key]: "Add a note of at least 8 characters naming where you verified this date." }));
      return;
    }
    setItemFeedback(previous => ({ ...previous, [item.key]: "Saving verified date…" }));
    setBusyItem(item.key);
    try {
      const outcome = await call<{ saved: boolean }>("saveManagedServiceDeadline", { carrierId: detail.carrierId,
        itemKey: item.key, inputDate, note, sourceVersion: item.sourceVersion });
      setItemNotes(previous => ({ ...previous, [item.key]: "" }));
      await open(detail.carrierId);
      setExpandedItems(previous => ({ ...previous, [item.key]: true }));
      setItemFeedback(previous => ({ ...previous, [item.key]: outcome.saved
        ? "Saved to the customer's dashboard. The current app date below should now match."
        : "This date was already on the customer's dashboard. No change was needed." }));
    } catch (error) {
      await open(detail.carrierId);
      setItemDates(previous => ({ ...previous, [item.key]: isoToInput(inputDate) }));
      setExpandedItems(previous => ({ ...previous, [item.key]: true }));
      setItemFeedback(previous => ({ ...previous, [item.key]: errorText(error) }));
    } finally { setBusyItem(null); }
  };
  const completeCompany = async (item: Item) => {
    if (!detail || busyItem) return;
    const note = (itemNotes[item.key] || "").trim();
    const completionDate = inputToIso((completionDates[item.key] || isoToInput(currentDate)).trim());
    if (note.length < 8 || !completionDate) {
      setItemFeedback(previous => ({ ...previous, [item.key]: "Enter the completion date and a note of at least 8 characters naming the confirming document or source." }));
      return;
    }
    const perform = async () => {
      setBusyItem(item.key);
      try {
        await call("completeManagedCompanyRequirement", { carrierId: detail.carrierId,
          requirementId: item.key.slice(8), completionDate, note, sourceVersion: item.sourceVersion });
        setItemNotes(previous => ({ ...previous, [item.key]: "" }));
        setCompletionDates(previous => ({ ...previous, [item.key]: "" }));
        await open(detail.carrierId);
        setExpandedItems(previous => ({ ...previous, [item.key]: true }));
        setItemFeedback(previous => ({ ...previous, [item.key]: "Completion saved to the customer's dashboard and history." }));
      } catch (error) { await open(detail.carrierId); setItemFeedback(previous => ({ ...previous, [item.key]: errorText(error) })); }
      finally { setBusyItem(null); }
    };
    await perform();
  };
  const setCompanyApplicable = async (item: Item, applicable: boolean) => {
    if (!detail || busyItem) return;
    const perform = async () => {
      setBusyItem(item.key);
      try {
        await call("setManagedCompanyApplicable", { carrierId: detail.carrierId,
          requirementId: item.key.slice(8), applicable, sourceVersion: item.sourceVersion });
        await open(detail.carrierId);
        setExpandedItems(previous => ({ ...previous, [item.key]: true }));
        setItemFeedback(previous => ({ ...previous, [item.key]: applicable
          ? "Requirement is active again on the customer's dashboard."
          : "Marked as not applicable on the customer's dashboard; it is excluded from urgent counts." }));
      } catch (error) { await open(detail.carrierId); setItemFeedback(previous => ({ ...previous, [item.key]: errorText(error) })); }
      finally { setBusyItem(null); }
    };
    await perform();
  };
  const updateDq = async (item: Item, field: string, value: boolean | string) => {
    if (!detail || busyItem) return;
    const note = (itemNotes[item.key] || "").trim();
    if (note.length < 8) { setItemFeedback(previous => ({ ...previous, [item.key]: "Note the document or source used to verify this DQ check (at least 8 characters)." })); return; }
    setBusyItem(item.key);
    try {
      await call("updateManagedDqCheck", { carrierId: detail.carrierId,
        driverId: item.key.split(":")[1], field, value, note, sourceVersion: item.sourceVersion });
      await open(detail.carrierId);
      setExpandedItems(previous => ({ ...previous, [item.key]: true }));
      setItemFeedback(previous => ({ ...previous, [item.key]: "DQ check updated on the customer's driver file. The file shows complete when all eight checks are confirmed." }));
    } catch (error) { await open(detail.carrierId); setItemFeedback(previous => ({ ...previous, [item.key]: errorText(error) })); }
    finally { setBusyItem(null); }
  };
  const deleteCompletion = async (item: Item, record: CompletionHistory["records"][number]) => {
    if (!detail || busyItem) return;
    setBusyItem(item.key);
    try {
      const result = await call<{ restoredDeadline: boolean }>("deleteManagedComplianceHistoryRecord", {
        carrierId: detail.carrierId, itemKey: item.key, recordId: record.id,
      });
      await open(detail.carrierId);
      setExpandedItems(previous => ({ ...previous, [item.key]: true }));
      setItemFeedback(previous => ({ ...previous, [item.key]: result.restoredDeadline
        ? "Completion deleted; the previous date was restored on the customer's dashboard."
        : "Completion deleted; the customer's current date was left unchanged." }));
    } catch (error) { setItemFeedback(previous => ({ ...previous, [item.key]: errorText(error) })); }
    finally { setBusyItem(null); setPendingHistoryDelete(null); }
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
      : "This account does not have owner access."}</Text>
      {ownerAccess === "denied" && <>
        <Text style={styles.small}>Signed in as: {auth.currentUser?.email || "unknown account"}</Text>
        <Button label="Switch to owner account" onPress={() => {
          rememberOwnerReturn();
          void signOut(auth).then(() => router.replace("/(auth)/login?returnTo=%2Fowner-managed" as any))
            .catch(error => setMessage(errorText(error)));
        }} />
        {!!message && <Text style={styles.small}>{message}</Text>}
      </>}
    </View>
  </ScrollView>;
  return <><Head><title>Owner Managed Tracking | We Heart Paperwork</title><meta name="robots" content="noindex,nofollow" /></Head><ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => void signOut(auth).then(() => router.replace("/(auth)/login?returnTo=%2Fowner-managed" as any))
      .catch(error => setMessage(errorText(error)))}><Text style={styles.back}>Sign out of owner tools</Text></Pressable>
    <Text style={styles.eyebrow}>OWNER TOOLS</Text>
    <Text style={styles.title}>Managed tracking</Text>
    <Text style={styles.small}>Signed in as {auth.currentUser?.email || "owner account"}</Text>
    <Text style={styles.help}>A private work queue across the companies you support. Preparing a quote makes its price and scope visible to the customer. Production also emails the quote; staging does not. Payment goes through Stripe after the customer accepts.</Text>
    <View style={styles.warning}><Text style={styles.warningText}>Start coverage only after the request shows “paid awaiting start.” App access and managed support have distinct charges and controls. Staging checkout requires Stripe test mode.</Text></View>
    {!!message && <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>}
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.section}>Customer requests</Text>
        <Button label="Refresh" subtle onPress={() => void loadRequests()} disabled={working || requestLoading} /></View>
      <Text style={styles.help}>New customers can choose managed support during signup; existing customers can request it later. Review the paid status, selected areas, and quoted units before starting coverage.</Text>
      {requestLoading && <ActivityIndicator color="#27500A" />}
      {!!requestError && <Text style={styles.warningText}>{requestError}</Text>}
      {!requestLoading && !requestError && requests.length === 0 && <Text style={styles.help}>No requests are waiting for review.</Text>}
      {requests.map(row => <View key={row.carrierId} style={styles.item}>
        <Text style={styles.accountTitle}>{row.companyName}</Text>
        <Text style={styles.small}>{row.status === "end_scheduled" && row.appEndScheduled
          ? "App access and managed billing ending at paid period end"
          : REQUEST_STAGE[row.status] || row.status.replaceAll("_", " ")} · Requested: {(["company", "drivers", "fleet"] as (keyof Areas)[])
          .filter(key => row.areas[key]).map(key => AREA_LABEL[key]).join(", ") || "End managed support"}</Text>
        <ContactDetails contact={{ accountEmail: row.accountEmail,
          preferredEmail: row.preferredEmail, preferredPhone: row.preferredPhone,
          accountPhone: row.accountPhone, textPermission: row.textPermission }} />
        {(row.areas.drivers || row.areas.fleet) && <View style={styles.contactBox}>
          <Text style={styles.small}>Customer intake · {row.intake?.drivers?.length || 0} {row.intake?.drivers?.length === 1 ? "driver" : "drivers"} · {row.intake?.vehicles?.length || 0} {row.intake?.vehicles?.length === 1 ? "unit" : "units"}</Text>
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
          <Text style={styles.small}>{row.status === "end_scheduled"
            ? row.appEndScheduled
              ? "Both services are ending. Do not start coverage or add units from this request. The account and records remain until the customer deletes them."
              : "Managed billing is ending. Do not start coverage or add units from this request. The app records remain available to the customer."
            : row.status === "paid_awaiting_start" && row.intakeUnitsConfirmedRevision === row.revision
              ? "Paid checkout added any missing quoted units. Review the names, dates, and billing before finishing setup; do not add them again."
              : "Review these details and existing account records before quoting. Listing units does not add them or start billing. After payment, check the quoted units and add any missing records."}</Text>
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
          <Text style={styles.small}>{row.status === "end_scheduled" ? "Original paid quote" : `Quote: ${row.quote.status}`} · ${row.quote.price.firstYearMonthly}/month in year one,
            then ${row.quote.price.renewalMonthly}/month · ${row.quote.price.fleetOnlyOnboardingOneTime + row.quote.price.dqFileOneTime} one-time</Text>
          {row.quote.signupQuote && row.quote.appMonthly != null && <Text style={styles.small}>
            {row.status === "end_scheduled" ? "Original signup total" : "First-time signup total"}: ${row.quote.appMonthly + row.quote.price.firstYearMonthly}/month in year one
            (app ${row.quote.appMonthly} + managed ${row.quote.price.firstYearMonthly})
            {row.status === "end_scheduled" && row.appEndScheduled ? ". Both services are now scheduled to end." : `; $${row.quote.appMonthly + row.quote.price.renewalMonthly}/month after Company setup ends, assuming the same active units.`}
          </Text>}
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
      <Text style={styles.help}>Showing all active managed requirements for {detail.companyName}. The work-list choice above only selects which companies to open. Choose Next company or close this company to return to that list.</Text>
      <ContactDetails contact={detail.contact} />
      <View style={styles.overview}>
        <Text style={styles.accountTitle}>At a glance · {detail.items.length} tracked requirements</Text>
        <Text style={styles.small}>{detail.counts.overdue} overdue · {detail.counts.due30} due in 30 days · {Math.max(0, detail.counts.due90 - detail.counts.due30)} due in 31–90 days · {detail.counts.needsInfo} need information · {detail.counts.waiting} waiting on customer</Text>
        <Text style={styles.small}>A requirement can appear in more than one count, such as overdue and waiting.</Text>
      </View>
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
      <Text style={styles.help}>Open a public guide, send your message outside this app, then log what you did here. These buttons do not send email. Verified date and Company completion changes here update the customer's dashboard. Customers confirm other completed reviews and inspections in their app.</Text>
      {!!(detail.selfManagedUnitCounts?.drivers || detail.selfManagedUnitCounts?.vehicles) &&
        <Text style={styles.help}>Outside managed coverage: {detail.selfManagedUnitCounts?.drivers || 0} self-managed drivers and {detail.selfManagedUnitCounts?.vehicles || 0} self-managed trucks/trailers. If the customer wants an area they did not select, prepare a separate scope and billing change before managing its units.</Text>}
      {detail.pendingCustom.length > 0 && <>
        <Text style={styles.subheading}>Unit changes and custom items awaiting review</Text>
        {detail.managedStripeSubscriptionId && <Text selectable style={styles.small}>Managed Stripe subscription: {detail.managedStripeSubscriptionId}</Text>}
        {detail.pendingCustom.map(row => <View key={row.id} style={styles.item}>
          <Text style={styles.accountTitle}>{row.name}</Text><Text style={styles.small}>{row.reason}</Text>
          {row.kind === "unit" && row.collectionId && !detail.managedStripeSubscriptionId &&
            <Text style={styles.small}>No paid managed subscription is linked to this company. You can review the new unit here, but it cannot be enrolled in managed coverage yet.</Text>}
          {row.kind === "unit" && row.collectionId && detail.managedStripeSubscriptionId && <>
            <Text style={styles.small}>Added managed price: ${row.unitType === "driver" ? MANAGED_PRICING.driverMonthly
              : row.unitType === "trailer" ? MANAGED_PRICING.trailerMonthly : MANAGED_PRICING.truckMonthly}/month beginning at the next billing cycle. A newly active driver also adds the app's separate $1/month driver charge, whether or not managed support is selected. The existing Company rate stays the same. Contact the customer, confirm this exact added managed charge, and record where their agreement can be found. This action updates Stripe without a mid-cycle managed charge, checks future billing phases, and then enrolls the unit. No DQ-file setup fee is added here.</Text>
            <TextInput style={styles.input} value={unitAgreements[row.collectionId + ":" + row.id] || ""}
              onChangeText={value => setUnitAgreements(previous => ({ ...previous, [row.collectionId + ":" + row.id]: value }))}
              placeholder="Where the customer agreed to the added monthly charge" />
            <Button label="Update billing and enroll approved unit" subtle
              onPress={() => void enrollUnit(row)} disabled={!!busyItem} />
          </>}
          {row.kind === "removal" && row.collectionId && <>
            <Text style={styles.small}>The unit is inactive, so its deadlines are no longer in the work queue. Its managed charge remains until this billing change succeeds. Review the customer's change, then remove the ${row.unitType === "driver" ? MANAGED_PRICING.driverMonthly : row.unitType === "trailer" ? MANAGED_PRICING.trailerMonthly : MANAGED_PRICING.truckMonthly}/month managed charge from the next billing cycle. No midcycle credit is created. The app subscription continues.</Text>
            <Button label="Reduce billing and remove managed unit" subtle
              onPress={() => void removeUnit(row)} disabled={!!busyItem || !detail.managedStripeSubscriptionId} />
          </>}
          {!row.kind && <TextInput style={styles.input} value={itemNotes["custom:" + row.id] || ""}
            onChangeText={value => setItemNotes(previous => ({ ...previous, ["custom:" + row.id]: value }))}
            placeholder="Where did you verify the filing due date?" multiline />}
          {!row.kind && !row.reason.startsWith("Recurring") && <Button label="Accept verified due date" subtle
            onPress={() => void acceptCustom(row.id)} disabled={!!busyItem} />}
        </View>)}
      </>}
      {(["company", "drivers", "fleet"] as (keyof Areas)[]).map(area => {
        if (!detail.coverage.areas[area]) return null;
        const list = detail.items.filter(item => item.area === area).sort((a, b) =>
          urgency(a).rank - urgency(b).rank || (a.days ?? Infinity) - (b.days ?? Infinity) || a.label.localeCompare(b.label));
        return <View key={area}><Text style={styles.subheading}>{AREA_LABEL[area]}</Text>
          {list.length === 0 && <Text style={styles.help}>{area === "drivers" ? "No active managed driver requirements." : area === "fleet" ? "No active managed trucks or trailers." : "No open managed Company requirements."}</Text>}
          {list.map(item => <View key={item.key} style={styles.item}>
            <Text style={[styles.urgency, { color: urgency(item).color }]}>{urgency(item).label}</Text>
            <Text style={styles.accountTitle}>{item.label}</Text>
            <Text style={styles.small}>{item.status === "not_applicable" ? "Not applicable · excluded from urgent counts" : item.status === "completed" ? item.key.endsWith(":dq") ? "All eight DQ checks confirmed" : "Completed · view completion history below" : item.dueDate ? "Due " + item.dueDate + " · " + (item.days! < 0 ? Math.abs(item.days!) + " days overdue" : item.days + " days left") : item.issue || "Date not set"}
              {" · "}{item.status.replaceAll("_", " ")}</Text>
            <Button label={expandedItems[item.key] ? "Hide actions" : "Update or log work ›"} subtle
              onPress={() => setExpandedItems(previous => ({ ...previous, [item.key]: !previous[item.key] }))} />
            {expandedItems[item.key] && <>
            {!!item.note && <Text style={styles.small}>Last note: {item.note}</Text>}
            {item.key === "company:boc3" && <Text style={styles.help}>BOC-3 has no annual renewal. Confirm the filing from the customer's record, then mark it complete here. This updates their Company view.</Text>}
            {item.key.endsWith(":dq") && <Text style={styles.help}>Verify each document or qualification before updating its check. These are the same eight checks shown in the customer's Driver view. Do not mark an item on file until the carrier confirms it.</Text>}
            {detail.coverage.status === "active" && item.status !== "completed" && item.status !== "not_applicable" && editableDate(item) && <>
              <Text style={styles.label}>{dateInputLabel(item)}</Text>
              <TextInput style={styles.input} value={itemDates[item.key] || ""}
                onChangeText={value => { setItemDates(previous => ({ ...previous, [item.key]: formatDateInput(value) }));
                  setItemFeedback(previous => ({ ...previous, [item.key]: "" })); }}
                placeholder="MM-DD-YYYY" keyboardType="numbers-and-punctuation" />
              <Text style={styles.small}>Current app date: {item.sourceInputDate ? isoToInput(item.sourceInputDate) : "not set"}. A source note is required to save a new date.</Text>
            </>}
            {item.status !== "completed" && item.status !== "not_applicable" && editableDate(item) && <Text style={styles.label}>Where did you verify this date? (required to save)</Text>}
            {item.key.startsWith("company:") && OWNER_COMPLETION_IDS.includes(item.key.slice(8)) && item.status !== "completed" && item.status !== "not_applicable" && <>
              <Text style={styles.label}>Completion date (MM-DD-YYYY)</Text>
              <TextInput style={styles.input} value={completionDates[item.key] || isoToInput(currentDate)}
                onChangeText={value => setCompletionDates(previous => ({ ...previous, [item.key]: formatDateInput(value) }))}
                placeholder="MM-DD-YYYY" keyboardType="numbers-and-punctuation" />
              <Text style={styles.help}>Confirm the filing or renewal first. Mark complete advances recurring deadlines or closes one-time BOC-3, just as it does in the customer view.</Text>
            </>}
            <Text style={styles.label}>Work note or verification source (required for dates, completion, and work logs)</Text>
            <TextInput style={styles.input} value={itemNotes[item.key] || ""}
              onChangeText={value => { setItemNotes(previous => ({ ...previous, [item.key]: value }));
                setItemFeedback(previous => ({ ...previous, [item.key]: "" })); }}
              placeholder={item.key.endsWith(":dq") || OWNER_COMPLETION_IDS.includes(item.key.slice(8)) ? "Document or source confirming this update" : editableDate(item) ? "Source of verified date, such as the carrier's document" : "Note what you sent or what needs follow-up"} multiline />
            {item.key.endsWith(":dq") && DQ_CHECKS.map(check => {
              const current = item.dqChecks?.[check.field] ?? (check.status ? "missing" : false);
              const next = check.status ? current === "missing" ? "on_file" : current === "on_file" ? "not_applicable" : "missing" : !current;
              const label = check.status ? String(current).replaceAll("_", " ") : current === true ? "On file" : "Missing";
              return <View key={check.field} style={styles.row}>
                <Text style={styles.small}>{check.label}: {label}</Text>
                <Button label={check.status ? "Change status" : current === true ? "Mark missing" : "Confirm on file"} subtle
                  disabled={!!busyItem || detail.coverage.status !== "active"}
                  onPress={() => void updateDq(item, check.field, next)} />
              </View>;
            })}
            <View style={styles.row}>
              {detail.coverage.status === "active" && item.status !== "completed" && item.status !== "not_applicable" && editableDate(item) &&
                <Button label="Save verified date" disabled={!!busyItem}
                  onPress={() => void saveDeadline(item)} />}
              {guideUrl(item.key) && <Button label="Open public guide" subtle
                onPress={() => { const url = guideUrl(item.key); if (url) void Linking.openURL(url); }} />}
              {item.key.startsWith("company:") && OWNER_COMPLETION_IDS.includes(item.key.slice(8)) && item.status !== "completed" && item.status !== "not_applicable" &&
                <Button label="Mark complete" disabled={!!busyItem || detail.coverage.status !== "active"}
                  onPress={() => void completeCompany(item)} />}
              {item.key.startsWith("company:") && !item.key.startsWith("custom:") &&
                <Button label={item.status === "not_applicable" ? "Start tracking again" : "This requirement does not apply"} subtle
                  disabled={!!busyItem || detail.coverage.status !== "active"}
                  onPress={() => void setCompanyApplicable(item, item.status === "not_applicable")} />}
              <Button label="Log instructions I sent" subtle disabled={!!busyItem || detail.coverage.status !== "active" || item.status === "completed" || item.status === "not_applicable"}
                onPress={() => void record(item, "instructions_sent")} />
              <Button label="Log waiting on customer" subtle disabled={!!busyItem || detail.coverage.status !== "active" || item.status === "completed" || item.status === "not_applicable"}
                onPress={() => void record(item, "waiting_on_customer")} />
              <Button label="Flag for follow-up" subtle disabled={!!busyItem || detail.coverage.status !== "active" || item.status === "completed" || item.status === "not_applicable"}
                onPress={() => void record(item, "follow_up_due")} />
            </View>
            {(() => {
              const records = detail.completionHistory?.find(row => row.itemKey === item.key)?.records || [];
              return <View>
                <Text style={styles.label}>Completion history ({records.length})</Text>
                {records.length === 0 && <Text style={styles.small}>No completion records yet.</Text>}
                {records.map((record, index) => {
                  const deleteKey = `${detail.carrierId}:${item.key}:${record.id}`;
                  return <View key={record.id}>
                    <View style={styles.row}>
                      <Text style={styles.small}>{record.completionDate || "Date not recorded"} · {record.previousDueDate || "—"} → {record.nextDueDate || "—"}</Text>
                      <Button label="Delete" subtle disabled={!!busyItem} onPress={() => setPendingHistoryDelete(deleteKey)} />
                    </View>
                    {pendingHistoryDelete === deleteKey && <>
                      <Text style={styles.help}>{index === 0
                        ? "Delete this completion? If its result is still current, the previous date will be restored. The deletion cannot be undone."
                        : "Delete this older completion? The current date will stay the same. The deletion cannot be undone."}</Text>
                      <View style={styles.row}>
                        <Button label="Confirm delete" disabled={!!busyItem} onPress={() => void deleteCompletion(item, record)} />
                        <Button label="Keep record" subtle onPress={() => setPendingHistoryDelete(null)} />
                      </View>
                    </>}
                  </View>;
                })}
              </View>;
            })()}
            {!!itemFeedback[item.key] && <Text style={styles.small} accessibilityRole="alert">{itemFeedback[item.key]}</Text>}
            </>}
          </View>)}
        </View>;
      })}
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
      <Text style={styles.help}>Use this to start a paid managed plan. Active scope changes need a separate customer agreement and billing review. Custom Company items require separate due-date verification.</Text>
      <View style={styles.row}>{(["company", "drivers", "fleet"] as (keyof Areas)[]).map(key =>
        <Pressable key={key} disabled={detail?.coverage.status === "active"}
          onPress={() => setAreas(value => ({ ...value, [key]: !value[key] }))}
          style={[styles.choice, areas[key] && styles.selected]}>
          <Text style={styles.choiceText}>{areas[key] ? "✓ " : ""}{AREA_LABEL[key]}</Text>
        </Pressable>)}</View>
      <Text style={styles.label}>Effective date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={effectiveDate} onChangeText={setEffectiveDate} />
      <Text style={styles.label}>Customer acceptance record</Text>
      <Text style={styles.help}>Starting paid coverage records the customer's accepted quote ID and acceptance time automatically. Review the paid quote and scope above before starting. Keep any separate signed agreement in your normal business records.</Text>
      {!!detail?.coverage.consentReference && <Text selectable style={styles.small}>{detail.coverage.consentReference}</Text>}
      {detail?.coverage.status === "active" && !detail.stagingDemo &&
        !detail.coverage.consentReference?.startsWith("Customer accepted quote ") &&
        <Button label="Attach customer's accepted quote reference" subtle disabled={working}
          onPress={() => void (async () => {
            setWorking(true);
            try {
              await call("attachAcceptedManagedQuoteReference", { carrierId: detail.carrierId });
              await open(detail.carrierId);
              setMessage("The accepted quote ID and time are now in the coverage audit record.");
            } catch (error) { setMessage(errorText(error)); }
            finally { setWorking(false); }
          })()} />}
      {detail?.stagingDemo && <Text style={styles.help}>Demo company: this sample coverage has no customer payment or agreement. Review its queue without changing its setup.</Text>}
      {detail?.coverage.status === "active" && !detail.stagingDemo && <Text style={styles.help}>Managed coverage is already active. The customer paid through Stripe before it started. This screen does not charge the customer again.</Text>}
      <View style={styles.row}>
        {detail?.coverage.status !== "active" && !detail?.stagingDemo && <>
          <Button label="Save setup draft" subtle onPress={() => void save("draft")} disabled={working} />
          <Button label="Start paid managed coverage" onPress={() => void save("active")}
            disabled={working || !requests.some(row => row.carrierId === (detail?.carrierId || candidate?.carrierId) && row.status === "paid_awaiting_start")} />
        </>}
        {detail?.coverage.status === "active" && !detail.stagingDemo && detail.managedBillingStatus !== "active" &&
          <Button label="Pause managed coverage" subtle onPress={() => void save("paused")} disabled={working} />}
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
  overview: { backgroundColor: "#F2F7EB", borderRadius: 10, padding: 14, marginBottom: 14 },
  urgency: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, marginBottom: 5 },
  small: { color: "#5F5D57", fontSize: 13, lineHeight: 19 },
  item: { padding: 14, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 10, marginBottom: 9 },
  contactBox: { padding: 12, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 10,
    backgroundColor: "#F8FAF5", marginBottom: 12 },
  history: { color: "#5F5D57", borderTopWidth: 1, borderColor: "#E5E3DA", paddingVertical: 9, fontSize: 12 },
});
