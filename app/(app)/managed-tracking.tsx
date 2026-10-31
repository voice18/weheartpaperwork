import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db, functions } from "../../lib/firebase";
import { MANAGED_COMPANY_SETUP_TOTAL, MANAGED_PRICING } from "../../lib/managedPricing";

type Area = "company" | "drivers" | "fleet";
type Areas = Record<Area, boolean>;
type Coverage = { status?: string; areas?: Areas; effectiveDate?: string | null };
type ServiceRequest = { status?: string; areas?: Areas; updatedAt?: unknown;
  preferredEmail?: string; preferredPhone?: string; textPermission?: boolean;
  intake?: Intake };
type IntakeDriver = { name: string; cdlNumber: string; cdlClass: string; cdlState: string;
  cdlExpiration: string; medicalExpiration: string };
type IntakeVehicle = { type: "truck" | "trailer"; unitNumber: string; vin: string;
  registrationExpiration: string; inspectionExpiration: string };
type Intake = { drivers: IntakeDriver[]; vehicles: IntakeVehicle[] };
type ManagedQuote = { quoteId: string; status: string; scope: string; expiresAtMillis: number;
  areas: Areas; counts: { drivers: number; trucks: number; trailers: number; dqFiles: number };
  price: { firstYearMonthly: number; renewalMonthly: number;
    fleetOnlyOnboardingOneTime: number; dqFileOneTime: number } };
const AREA: { key: Area; title: string; description: string; examples: string }[] = [
  { key: "company", title: "Company", description: "A clear action plan for carrier-wide requirements.",
    examples: "USDOT updates, UCR, IFTA, IRP, 2290, insurance and other applicable company items." },
  { key: "drivers", title: "Driver", description: "Set up each active driver's records and keep their next steps clear.",
    examples: "CDL and medical dates, annual MVR and Clearinghouse reviews, and DQ setup checks." },
  { key: "fleet", title: "Fleet", description: "Organize each active unit's registration and inspection dates.",
    examples: "Registration and annual DOT inspection dates." },
];
const NONE: Areas = { company: false, drivers: false, fleet: false };
const ALL: Areas = { company: true, drivers: true, fleet: true };
const PENDING = new Set(["requested", "change_requested", "end_requested", "contacted", "quoted", "accepted", "paid_awaiting_start"]);
function same(a: Areas, b: Areas): boolean {
  return a.company === b.company && a.drivers === b.drivers && a.fleet === b.fleet;
}
function chosen(value: Areas): string {
  return AREA.filter(row => value[row.key]).map(row => row.title).join(", ") || "None";
}
export default function ManagedTrackingChoices() {
  const router = useRouter();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [quote, setQuote] = useState<ManagedQuote | null>(null);
  const [areas, setAreas] = useState<Areas>(NONE);
  const [step, setStep] = useState(1);
  const [intake, setIntake] = useState<Intake>({ drivers: [], vehicles: [] });
  const [preferredEmail, setPreferredEmail] = useState(auth.currentUser?.email || "");
  const [preferredPhone, setPreferredPhone] = useState("");
  const [textPermission, setTextPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || Platform.OS !== "web") { setLoading(false); return; }
    const coverageRef = doc(db, "managedServiceCoverage", uid);
    const requestRef = doc(db, "managedServiceRequests", uid);
    let active = true;
    void Promise.all([getDoc(coverageRef), getDoc(requestRef)]).then(([current, pending]) => {
      if (!active) return;
      const currentCoverage = current.exists() ? current.data() as Coverage : null;
      const currentRequest = pending.exists() ? pending.data() as ServiceRequest : null;
      setCoverage(currentCoverage);
      setServiceRequest(currentRequest);
      setPreferredEmail(currentRequest?.preferredEmail || auth.currentUser?.email || "");
      setPreferredPhone(currentRequest?.preferredPhone || "");
      setTextPermission(typeof currentRequest?.textPermission === "boolean"
        ? currentRequest.textPermission : null);
      setIntake(currentRequest?.intake || { drivers: [], vehicles: [] });
      setAreas(PENDING.has(currentRequest?.status || "")
        ? { ...NONE, ...currentRequest?.areas }
        : currentCoverage?.status === "active" ? { ...NONE, ...currentCoverage.areas } : NONE);
      if (currentCoverage?.status === "active" || PENDING.has(currentRequest?.status || "")) setStep(2);
      setLoading(false);
    }).catch(() => { if (active) { setMessage("We could not load your support choices. Try again later."); setLoading(false); } });
    const unsubscribeCoverage = onSnapshot(coverageRef,
      snap => { if (active) setCoverage(snap.exists() ? snap.data() as Coverage : null); },
      () => { if (active) setMessage("Coverage status is temporarily unavailable."); });
    const unsubscribeRequest = onSnapshot(requestRef,
      snap => { if (active) setServiceRequest(snap.exists() ? snap.data() as ServiceRequest : null); },
      () => { if (active) setMessage("Request status is temporarily unavailable."); });
    return () => { active = false; unsubscribeCoverage(); unsubscribeRequest(); };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || !auth.currentUser) return;
    let active = true;
    void httpsCallable<Record<string, never>, { quote: ManagedQuote | null }>(
      functions, "getManagedServiceQuote")({}).then(result => {
      if (active) setQuote(result.data.quote);
    }).catch(() => { if (active) setQuote(null); });
    return () => { active = false; };
  }, [serviceRequest?.status, serviceRequest?.updatedAt]);
  const activeCoverage = coverage?.status === "active";
  const lockedQuote = ["accepted", "paid_awaiting_start"].includes(serviceRequest?.status || "");
  const currentAreas = { ...NONE, ...coverage?.areas };
  const pending = PENDING.has(serviceRequest?.status || "");
  const matchesRequest = pending && same(areas, { ...NONE, ...serviceRequest?.areas });
  const matchesCoverage = activeCoverage && same(areas, currentAreas);
  const selected = areas.company || areas.drivers || areas.fleet;
  const intakeMatchesRequest = JSON.stringify({ drivers: areas.drivers ? intake.drivers : [],
    vehicles: areas.fleet ? intake.vehicles : [] }) === JSON.stringify(
    serviceRequest?.intake || { drivers: [], vehicles: [] });
  const updateDriver = (index: number, key: keyof IntakeDriver, value: string) =>
    setIntake(previous => ({ ...previous, drivers: previous.drivers.map((row, i) =>
      i === index ? { ...row, [key]: value } : row) }));
  const updateVehicle = (index: number, key: keyof IntakeVehicle, value: string) =>
    setIntake(previous => ({ ...previous, vehicles: previous.vehicles.map((row, i) =>
      i === index ? { ...row, [key]: value } : row) }));
  const action = useMemo(() => {
    if (!selected && !activeCoverage) return pending
      ? { label: "Withdraw request and keep managing myself", operation: "withdraw", disabled: false }
      : { label: "Continue managing myself", operation: "back", disabled: false };
    if (matchesCoverage && pending) return {
      label: "Keep current coverage and withdraw change request", operation: "request", disabled: false };
    if (matchesCoverage) return { label: "These are already your active areas", operation: "none", disabled: true };
    if (matchesRequest) return { label: "Request already received", operation: "none", disabled: true };
    if (!selected) return { label: "Request to end managed support", operation: "request", disabled: false };
    return { label: activeCoverage ? "Request a scope change" : "Request a written quote",
      operation: "request", disabled: false };
  }, [activeCoverage, matchesCoverage, matchesRequest, pending, selected]);
  const submit = async (override?: "contact") => {
    if (!override && action.operation === "back") { router.replace("/(app)/dashboard"); return; }
    if ((!override && action.disabled) || saving) return;
    const operation = override || action.operation;
    if (!override && operation === "request" && selected) {
      if (areas.drivers && intake.drivers.some(row => !row.name.trim() || !row.cdlNumber.trim() ||
        !/^[ABC]$/i.test(row.cdlClass.trim()) || !/^[A-Z]{2}$/i.test(row.cdlState.trim()))) {
        setMessage("For each listed driver, enter the name, CDL number, class, and issuing state."); return;
      }
      if (areas.fleet && intake.vehicles.some(row => !row.unitNumber.trim() || row.vin.trim().length < 5)) {
        setMessage("For each listed truck or trailer, enter a unit number and VIN or serial number."); return;
      }
    }
    if (operation === "request" || operation === "contact") {
      if (!preferredEmail.trim() || !preferredPhone.trim()) {
        setMessage("Enter the best email and phone number for managed-support updates."); return;
      }
      if (textPermission === null) {
        setMessage("Choose yes or no for service-related texts."); return;
      }
    }
    setSaving(true);
    setMessage("");
    try {
      const callable = httpsCallable(functions, "submitManagedServiceRequest");
      const result = await callable({ action: operation, areas,
        intake: { drivers: areas.drivers ? intake.drivers : [],
          vehicles: areas.fleet ? intake.vehicles : [] },
        preferredEmail, preferredPhone, textPermission });
      const status = (result.data as { status?: string })?.status;
      setMessage(status === "withdrawn" || status === "already-active"
        ? "Your pending change was withdrawn. Your current tracking continues."
        : status === "contact-updated" ? "Your contact details are updated. We will use these for managed-support follow-up."
        : status === "contact-unchanged" ? "These contact details are already on file."
        : status === "already-pending" ? "We already have this request and will use your contact details below."
        : status === "end_requested" ? "Your request to end managed support is recorded. Current coverage continues until we confirm the change."
        : "Your request is recorded. We will contact you with a written scope and price. Nothing has been charged or changed yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your request. Please try again.");
    } finally { setSaving(false); }
  };
  const acceptQuote = async () => {
    if (!quote || saving) return;
    setSaving(true); setMessage("");
    try {
      const callable = httpsCallable(functions, "acceptManagedServiceQuote");
      await callable({ quoteId: quote.quoteId });
      setQuote({ ...quote, status: "accepted" });
      setMessage("Quote accepted. Continue to secure checkout to start payment; service will begin after we confirm setup.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not accept the quote."); }
    finally { setSaving(false); }
  };
  const openManagedCheckout = async () => {
    if (!quote || saving || Platform.OS !== "web") return;
    setSaving(true); setMessage("");
    try {
      const callable = httpsCallable<Record<string, unknown>, { url: string }>(functions, "createManagedCheckoutSession");
      const result = await callable({ quoteId: quote.quoteId, returnOrigin: window.location.origin });
      if (!result.data.url) throw new Error("Checkout is not available. Please try again.");
      await Linking.openURL(result.data.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not open checkout."); }
    finally { setSaving(false); }
  };
  const withdrawQuote = async () => {
    if (!quote || saving) return;
    setSaving(true); setMessage("");
    try {
      await httpsCallable(functions, "withdrawManagedServiceQuote")({});
      setQuote(null);
      setMessage("Your quote and open checkout were withdrawn. No managed service has started.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not withdraw this quote."); }
    finally { setSaving(false); }
  };
  return <><Head><title>Managed Tracking Options | We Heart Paperwork</title>
    <meta name="robots" content="noindex,nofollow" /></Head>
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.replace("/(app)/dashboard")}><Text style={styles.link}>‹ Back to dashboard</Text></Pressable>
      {Platform.OS !== "web" ? <View style={styles.card}>
        <Text style={styles.title}>Your support options</Text>
        <Text style={styles.body}>Managed tracking choices are available after signing in on the We Heart Paperwork website.</Text>
      </View> : <>
        <Text style={styles.eyebrow}>OPTIONAL SUPPORT</Text>
        <Text style={styles.title}>Choose how much help you want</Text>
        <Text style={styles.body}>We help turn your deadlines into a plan. For the areas you choose, we set up the information you give us, identify what is due or missing, tell you what to prepare and where to go, and follow up until you confirm the task is done. You complete the filing or other required action and pay any outside fees.</Text>
        {loading ? <ActivityIndicator color="#27500A" /> : <>
          {activeCoverage && <View style={styles.notice}><Text style={styles.noticeText}>Currently managed: {chosen(currentAreas)}. Your current coverage continues until an agreed change takes effect.</Text></View>}
          {serviceRequest?.status === "end_scheduled" && <View style={styles.notice}><Text style={styles.noticeText}>Managed billing is set to end at the current paid period. Your covered areas remain supported until then.</Text></View>}
          {pending && <View style={styles.notice}><Text style={styles.noticeText}>Your request is {serviceRequest?.status?.replaceAll("_", " ")}. We will use the contact details below. You may change or withdraw the request.</Text></View>}
          {!!message && <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View>}
          {step === 1 && <View style={styles.card}>
            <Text style={styles.section}>How would you like to start?</Text>
            <Text style={styles.body}>Your app tracks Company, Driver, and Fleet. With optional managed support, we help organize the work and guide you through each deadline. You take the final action.</Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setAreas(ALL); setStep(2); }}>
              <Text style={styles.buttonText}>Ask us to manage deadlines</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.contactButton} onPress={() => router.replace("/(app)/dashboard")}>
              <Text style={styles.contactButtonText}>Keep managing them myself</Text>
            </Pressable>
            <Text style={styles.small}>Choosing help starts a request. You can remove any of the three areas on the next screen. We send an exact quote before any managed charge.</Text>
          </View>}
          {step >= 2 && <><Text style={styles.section}>1. Choose your managed areas</Text>
          <Text style={styles.body}>Each area is optional. All three start selected when you ask for help. Tap any area to remove it. Your app still tracks areas you manage yourself.</Text>
          <View style={styles.grid}>{AREA.map(row => <View key={row.key} style={[styles.card, areas[row.key] && styles.selected]}>
            <Text style={styles.section}>{row.title}</Text>
            <Text style={styles.body}>{row.description}</Text>
            <Text style={styles.small}>{row.examples}</Text>
            <Text style={styles.small}>{row.key === "company" ? `$${MANAGED_PRICING.companyFirstYearMonthly}/month in year one; $${MANAGED_PRICING.companyRenewalMonthly}/month after.`
              : row.key === "drivers" ? `$${MANAGED_PRICING.driverMonthly}/month per active driver; $0 when there are none.`
              : `$1/month per active truck and $1/month per active trailer; $0 when there are none.`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`${areas[row.key] ? "Manage" : "Self-manage"} ${row.title}`}
              disabled={lockedQuote} onPress={() => setAreas(previous => ({ ...previous, [row.key]: !previous[row.key] }))}
              style={[styles.choice, areas[row.key] && styles.choiceSelected, lockedQuote && styles.disabled]}>
              <Text style={[styles.choiceText, areas[row.key] && styles.choiceSelectedText]}>{areas[row.key] ? "✓ Included · tap to remove" : "Not included · tap to add"}</Text>
            </Pressable>
          </View>)}</View>
          {step === 2 && <View style={styles.card}>
            <Text style={styles.summary}>Selected: {chosen(areas)}</Text>
            <Text style={styles.small}>You can change this before sending your request. Listing drivers and vehicles next does not start billing.</Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setStep(3)}>
              <Text style={styles.buttonText}>Continue to details</Text>
            </Pressable>
          </View>}</>}
          {step === 3 && <><Text style={styles.section}>2. Tell us who and what to set up</Text>
          {areas.drivers && <View style={styles.card}>
            <Text style={styles.section}>Drivers · {intake.drivers.length} listed</Text>
            <Text style={styles.body}>List your active drivers. If you have none, leave this empty. We only quote managed Driver charges for active drivers entered in your account.</Text>
            {intake.drivers.map((row, index) => <View key={index} style={styles.contact}>
              <Text style={styles.label}>Driver {index + 1}</Text>
              {([ ["name", "Full name"], ["cdlNumber", "CDL number"], ["cdlClass", "CDL class (A, B, or C)"], ["cdlState", "Issuing state (2 letters)"],
                ["cdlExpiration", "CDL expiration (YYYY-MM-DD, if known)"], ["medicalExpiration", "Medical expiration (YYYY-MM-DD, if known)"] ] as [keyof IntakeDriver, string][])
                .map(([key, label]) => <TextInput key={key} style={styles.input} value={row[key]}
                  onChangeText={value => updateDriver(index, key, value)} placeholder={label} accessibilityLabel={`Driver ${index + 1} ${label}`} />)}
              <Pressable accessibilityRole="button" onPress={() => setIntake(previous => ({ ...previous,
                drivers: previous.drivers.filter((_, i) => i !== index) }))}><Text style={styles.link}>Remove driver</Text></Pressable>
            </View>)}
            <Pressable accessibilityRole="button" style={styles.contactButton} onPress={() => setIntake(previous => ({ ...previous,
              drivers: [...previous.drivers, { name: "", cdlNumber: "", cdlClass: "", cdlState: "",
                cdlExpiration: "", medicalExpiration: "" }] }))}><Text style={styles.contactButtonText}>+ Add a driver</Text></Pressable>
          </View>}
          {areas.fleet && <View style={styles.card}>
            <Text style={styles.section}>Trucks and trailers · {intake.vehicles.length} listed</Text>
            <Text style={styles.body}>List active equipment. If you have none, leave this empty. Managed Fleet charges begin only for active units entered in your account.</Text>
            {intake.vehicles.map((row, index) => <View key={index} style={styles.contact}>
              <Text style={styles.label}>Equipment {index + 1}</Text>
              <View style={styles.contactOptions}>{(["truck", "trailer"] as const).map(type => <Pressable key={type}
                accessibilityRole="button" accessibilityState={{ selected: row.type === type }}
                onPress={() => updateVehicle(index, "type", type)} style={[styles.choice, row.type === type && styles.choiceSelected]}>
                <Text style={[styles.choiceText, row.type === type && styles.choiceSelectedText]}>{type === "truck" ? "Truck" : "Trailer"}</Text>
              </Pressable>)}</View>
              {([ ["unitNumber", "Unit number"], ["vin", "VIN or serial number"],
                ["registrationExpiration", "Registration expiration (YYYY-MM-DD, if known)"],
                ["inspectionExpiration", "Inspection expiration (YYYY-MM-DD, if known)"] ] as [keyof IntakeVehicle, string][])
                .map(([key, label]) => <TextInput key={key} style={styles.input} value={row[key]}
                  onChangeText={value => updateVehicle(index, key, value)} placeholder={label} accessibilityLabel={`Equipment ${index + 1} ${label}`} />)}
              <Pressable accessibilityRole="button" onPress={() => setIntake(previous => ({ ...previous,
                vehicles: previous.vehicles.filter((_, i) => i !== index) }))}><Text style={styles.link}>Remove equipment</Text></Pressable>
            </View>)}
            <Pressable accessibilityRole="button" style={styles.contactButton} onPress={() => setIntake(previous => ({ ...previous,
              vehicles: [...previous.vehicles, { type: "truck", unitNumber: "", vin: "",
                registrationExpiration: "", inspectionExpiration: "" }] }))}><Text style={styles.contactButtonText}>+ Add a truck or trailer</Text></Pressable>
          </View>}
          <View style={styles.card}>
            <Text style={styles.section}>Your choices</Text>
            <Text style={styles.summary}>{selected ? "Request help for: " + chosen(areas) : activeCoverage ? "Request to end managed support" : "Self-managed in all areas"}</Text>
            <Text style={styles.body}>{!selected && activeCoverage ? "Your current managed support continues until we confirm an end date with you. This request does not cancel or change a charge automatically." : "We confirm what applies and the number of drivers and vehicles before giving you an exact total. Nothing changes or charges automatically."}</Text>
            {(selected || activeCoverage) && <View style={styles.contact}>
              <Text style={styles.section}>Managed support prices</Text>
              <Text style={styles.body}>{`Company: $${MANAGED_PRICING.companyFirstYearMonthly}/month for the first 12 months, then $${MANAGED_PRICING.companyRenewalMonthly}/month. The first-year rate includes $${MANAGED_COMPANY_SETUP_TOTAL} of setup spread across those 12 months.`}</Text>
              <Text style={styles.body}>{`Driver: $${MANAGED_PRICING.driverMonthly}/month per managed driver. Truck: $${MANAGED_PRICING.truckMonthly}/month each. Trailer: $${MANAGED_PRICING.trailerMonthly}/month each.`}</Text>
              <Text style={styles.body}>{`Fleet-only support has a $${MANAGED_PRICING.fleetOnlyOnboardingOneTime} one-time onboarding charge when at least one active truck or trailer is added.`}</Text>
              <Text style={styles.body}>{`Building a driver qualification file, when requested, is a separate $${MANAGED_PRICING.dqFileOneTime} one-time charge per file.`}</Text>
              <Text style={styles.small}>These managed support charges are in addition to your app subscription ($2/month plus $1 per active driver). When your listed drivers are entered as active in the app, the app's $1-per-driver charge applies even before managed support starts. We confirm the managed scope and exact total before you agree or pay. Your request itself starts no managed charge or service.</Text>
            </View>}
            {(selected || activeCoverage || pending) && <View style={styles.contact}>
              <Text style={styles.section}>How should we reach you?</Text>
              <Text style={styles.body}>Use the email and phone number you want us to use for this service. You can update them here later.</Text>
              <Text style={styles.label}>Best contact email</Text>
              <TextInput style={styles.input} value={preferredEmail} onChangeText={setPreferredEmail}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                maxLength={254} placeholder="name@company.com" accessibilityLabel="Best contact email" />
              <Text style={styles.label}>Best contact phone number</Text>
              <TextInput style={styles.input} value={preferredPhone} onChangeText={value => {
                setPreferredPhone(value);
                if (value !== serviceRequest?.preferredPhone) setTextPermission(null);
              }}
                keyboardType="phone-pad" maxLength={30} placeholder="(509) 555-1234"
                accessibilityLabel="Best contact phone number" />
              <Text style={styles.label}>May we text this number about your managed-tracking request and deadline follow-ups?</Text>
              <View style={styles.contactOptions}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: textPermission === true }}
                  onPress={() => setTextPermission(true)} style={[styles.choice, textPermission === true && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, textPermission === true && styles.choiceSelectedText]}>Yes, service-related texts are okay</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: textPermission === false }}
                  onPress={() => setTextPermission(false)} style={[styles.choice, textPermission === false && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, textPermission === false && styles.choiceSelectedText]}>No, call or email me</Text>
                </Pressable>
              </View>
              <Text style={styles.small}>Your choice applies to managed-service communication, not marketing. You can change it here. We do not send text messages from this page.</Text>
              {(pending || activeCoverage) && <Pressable accessibilityRole="button" disabled={saving}
                onPress={() => void submit("contact")} style={[styles.contactButton, saving && styles.disabled]}>
                <Text style={styles.contactButtonText}>Save contact details</Text>
              </Pressable>}
            </View>}
            <Pressable accessibilityRole="button" disabled={action.disabled || saving || lockedQuote}
              onPress={() => void submit()} style={[styles.button, (action.disabled || saving || lockedQuote) && styles.disabled]}>
              <Text style={styles.buttonText}>{saving ? "Saving…" : lockedQuote ? "Quote in progress · contact us to change" : action.label}</Text>
            </Pressable>
          </View>
          </>}
          {quote && (!same(areas, quote.areas) || !intakeMatchesRequest) && <View style={styles.notice}>
            <Text style={styles.noticeText}>Your existing quote covers the previously submitted areas and units. Submit your revised request for a new quote before accepting or paying.</Text>
          </View>}
          {quote && same(areas, quote.areas) && intakeMatchesRequest && <View style={styles.card}>
            <Text style={styles.section}>Your managed-support quote</Text>
            <Text style={styles.body}>{quote.scope}</Text>
            <Text style={styles.body}>Company: {quote.areas.company ? "included" : "self-managed"} · Driver: {quote.areas.drivers ? `${quote.counts.drivers} managed` : "self-managed"} · Fleet: {quote.areas.fleet ? `${quote.counts.trucks} trucks and ${quote.counts.trailers} trailers managed` : "self-managed"}</Text>
            <Text style={styles.summary}>${quote.price.firstYearMonthly}/month in year one</Text>
            <Text style={styles.body}>${quote.price.renewalMonthly}/month from year two. {quote.price.fleetOnlyOnboardingOneTime + quote.price.dqFileOneTime > 0 ? `$${quote.price.fleetOnlyOnboardingOneTime + quote.price.dqFileOneTime} in one-time charges at checkout.` : "No one-time charges."}</Text>
            <Text style={styles.small}>Your existing app subscription is billed separately. Quote expires {new Date(quote.expiresAtMillis).toLocaleDateString()}. Service starts only after payment and our setup confirmation.</Text>
            {quote.status === "quoted" && <Pressable accessibilityRole="button" disabled={saving}
              onPress={() => void acceptQuote()} style={[styles.button, saving && styles.disabled]}>
              <Text style={styles.buttonText}>Accept quote</Text>
            </Pressable>}
            {quote.status === "accepted" && <Pressable accessibilityRole="button" disabled={saving}
              onPress={() => void openManagedCheckout()} style={[styles.button, saving && styles.disabled]}>
              <Text style={styles.buttonText}>Continue to secure checkout</Text>
            </Pressable>}
            {quote.status === "accepted" && <Pressable accessibilityRole="button" disabled={saving}
              onPress={() => void withdrawQuote()} style={[styles.contactButton, saving && styles.disabled]}>
              <Text style={styles.contactButtonText}>Withdraw accepted quote</Text>
            </Pressable>}
            {quote.status === "paid_awaiting_start" && <Text style={styles.body}>Payment received. We are confirming the start of your selected managed coverage.</Text>}
          </View>}
          <View style={styles.card}>
            <Text style={styles.section}>We get the work ready. You take the final step.</Text>
            <Text style={styles.body}><Text style={styles.bold}>We Heart Paperwork:</Text> sets up the selected areas from the information you provide, reviews upcoming deadlines and missing details, gives you specific next steps and links where available, follows up, and updates your tracking when you confirm completion.</Text>
            <Text style={styles.body}><Text style={styles.bold}>Your company:</Text> provides accurate information, submits filings, orders records such as MVRs, coordinates driver actions and inspections, pays agency or third-party fees, and tells us when each task is complete.</Text>
            <Text style={styles.small}>Custom Company items are included only after we verify and accept their due dates. Unselected areas keep the app's regular tracking.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.section}>Before service starts</Text>
            <Text style={styles.body}>1. We review your request and send a written scope and exact first-year and ongoing price by email.</Text>
            <Text style={styles.body}>2. You accept the exact quote and complete secure Stripe checkout on this page.</Text>
            <Text style={styles.body}>3. We activate the selected areas. Your dashboard shows the start date and who manages each area.</Text>
            <Text style={styles.small}>Your current app subscription and checkout continue unchanged. For help, email aaron@weheartpaperwork.com.</Text>
          </View>
        </>}
      </>}
    </ScrollView></>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F5F1" },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 70 },
  link: { color: "#27500A", fontWeight: "800", marginBottom: 20 },
  eyebrow: { color: "#3B6D11", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#1A1915", fontSize: 32, fontWeight: "800", marginBottom: 12 },
  section: { color: "#1A1915", fontSize: 19, fontWeight: "800", marginBottom: 9 },
  body: { color: "#5F5D57", fontSize: 15, lineHeight: 23, marginBottom: 11 },
  small: { color: "#5F5D57", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  bold: { fontWeight: "800", color: "#1A1915" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 13 },
  card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 14,
    padding: 18, marginBottom: 16, width: "100%" },
  selected: { borderColor: "#5E9833", backgroundColor: "#F3F9ED" },
  choice: { borderWidth: 1, borderColor: "#B8CBA7", backgroundColor: "#F2F7EB", borderRadius: 9,
    padding: 12, alignSelf: "flex-start" },
  choiceSelected: { backgroundColor: "#27500A" },
  choiceText: { color: "#27500A", fontWeight: "800" },
  choiceSelectedText: { color: "#FFF" },
  contact: { borderTopWidth: 1, borderColor: "#E5E3DA", paddingTop: 17, marginTop: 7, marginBottom: 16 },
  contactOptions: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  label: { color: "#3A3833", fontWeight: "700", marginBottom: 7 },
  input: { borderWidth: 1, borderColor: "#CFCBBF", borderRadius: 9, padding: 11,
    minHeight: 44, color: "#1A1915", backgroundColor: "#FFF", marginBottom: 14 },
  contactButton: { borderWidth: 1, borderColor: "#B8CBA7", backgroundColor: "#F2F7EB",
    borderRadius: 9, padding: 12, alignSelf: "flex-start", marginBottom: 8 },
  contactButtonText: { color: "#27500A", fontWeight: "800" },
  summary: { color: "#27500A", fontWeight: "800", fontSize: 18, marginBottom: 10 },
  button: { backgroundColor: "#27500A", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18,
    alignSelf: "flex-start" },
  buttonText: { color: "#FFF", fontWeight: "800" },
  disabled: { opacity: 0.45 },
  notice: { padding: 14, borderRadius: 10, backgroundColor: "#EAF3DE", marginBottom: 15 },
  noticeText: { color: "#27500A", lineHeight: 21 },
});
