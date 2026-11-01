import * as admin from "firebase-admin";
import { randomUUID } from "node:crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { calculateManagedPrice, ManagedAreas, ManagedCounts, MANAGED_PRICING } from "./managedPricing";
import { managedIntake } from "./managedIntake";
import { managedRoster } from "./managedRoster";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const activeStripeStatuses = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);
function returnOrigin(candidate: unknown): string {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? admin.app().options.projectId;
  const fallback = project === "weheartpaperwork-staging"
    ? "https://weheartpaperwork-staging.web.app" : "https://weheartpaperwork.com";
  if (typeof candidate !== "string") return fallback;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && !(project === "weheartpaperwork-staging" && url.protocol === "http:")) return fallback;
    if (url.origin === fallback) return url.origin;
    if (project === "weheartpaperwork-staging" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
       /^weheartpaperwork-staging--[a-z0-9-]+\.web\.app$/.test(url.hostname))) return url.origin;
  } catch { /* Ignore invalid return origins. */ }
  return fallback;
}
function managedItems(row: Record<string, any>, renewal = false): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const selected = areas(row.areas);
  const counts = row.counts as ManagedCounts;
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const monthly = (name: string, amount: number, quantity: number) => {
    if (quantity > 0) items.push({ price_data: { currency: "usd", unit_amount: amount * 100,
      recurring: { interval: "month" }, product_data: { name } }, quantity });
  };
  const once = (name: string, amount: number, quantity: number) => {
    if (quantity > 0) items.push({ price_data: { currency: "usd", unit_amount: amount * 100,
      product_data: { name } }, quantity });
  };
  if (selected.company) monthly("Managed Company compliance", renewal
    ? MANAGED_PRICING.companyRenewalMonthly : MANAGED_PRICING.companyFirstYearMonthly, 1);
  if (selected.drivers) monthly("Managed Driver compliance", MANAGED_PRICING.driverMonthly, counts.drivers);
  if (selected.fleet) {
    monthly("Managed Truck compliance", MANAGED_PRICING.truckMonthly, counts.trucks);
    monthly("Managed Trailer compliance", MANAGED_PRICING.trailerMonthly, counts.trailers);
  }
  if (!renewal) {
    once("Fleet-only onboarding", MANAGED_PRICING.fleetOnlyOnboardingOneTime,
      selected.fleet && !selected.company && !selected.drivers && counts.trucks + counts.trailers > 0 ? 1 : 0);
    once("Driver qualification file setup", MANAGED_PRICING.dqFileOneTime, counts.dqFiles);
  }
  return items;
}

function requireOwner(auth: { token: Record<string, unknown> } | undefined): void {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  if (auth.token.ownerAdmin !== true) throw new HttpsError("permission-denied", "Owner access is required.");
}
function carrierId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new HttpsError("invalid-argument", "Choose a valid company.");
  return value;
}
function areas(value: unknown): ManagedAreas {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return { company: row.company === true, drivers: row.drivers === true, fleet: row.fleet === true };
}
function same(a: ManagedAreas, b: ManagedAreas): boolean {
  return a.company === b.company && a.drivers === b.drivers && a.fleet === b.fleet;
}
function safeQuote(snapshot: FirebaseFirestore.DocumentSnapshot) {
  if (!snapshot.exists) return null;
  const row = snapshot.data() ?? {};
  return {
    quoteId: row.quoteId ?? null, status: row.status ?? null,
    areas: areas(row.areas), counts: row.counts ?? null, price: row.price ?? null,
    appDriverIncrease: Number.isSafeInteger(row.appDriverIncrease) ? row.appDriverIncrease : null,
    scope: row.scope ?? "", requestRevision: row.requestRevision ?? null,
    expiresAtMillis: row.expiresAt?.toMillis?.() ?? null,
    acceptedAtMillis: row.acceptedAt?.toMillis?.() ?? null,
  };
}
export const getManagedServiceQuote = onCall({ region: "us-central1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const db = admin.firestore();
  const [quote, serviceRequest] = await Promise.all([
    db.collection("managedServiceQuotes").doc(request.auth.uid).get(),
    db.collection("managedServiceRequests").doc(request.auth.uid).get(),
  ]);
  const result = safeQuote(quote);
  return { quote: result && result.requestRevision === serviceRequest.data()?.revision
    && ["quoted", "accepted", "paid_awaiting_start", "active"].includes(String(serviceRequest.data()?.status))
    ? result : null };
});
export const prepareManagedServiceQuote = onCall({ region: "us-central1" }, async request => {
  requireOwner(request.auth);
  const id = carrierId(request.data?.carrierId);
  const scope = typeof request.data?.scope === "string" ? request.data.scope.trim() : "";
  if (scope.length < 20 || scope.length > 1200)
    throw new HttpsError("invalid-argument", "Describe the service scope in 20–1200 characters.");
  const dqFiles = request.data?.dqFiles;
  if (!Number.isSafeInteger(dqFiles) || dqFiles < 0 || dqFiles > 1000)
    throw new HttpsError("invalid-argument", "Enter a valid DQ-file count.");
  const db = admin.firestore();
  const carrierRef = db.collection("carriers").doc(id);
  const requestRef = db.collection("managedServiceRequests").doc(id);
  const quoteRef = db.collection("managedServiceQuotes").doc(id);
  const coverageRef = db.collection("managedServiceCoverage").doc(id);
  const [carrier, currentRequest, coverage, driverRows, vehicleRows] = await Promise.all([
    carrierRef.get(), requestRef.get(), coverageRef.get(),
    carrierRef.collection("drivers").get(), carrierRef.collection("vehicles").get(),
  ]);
  if (!carrier.exists || carrier.data()?.deletingAccount === true)
    throw new HttpsError("not-found", "Company is no longer available.");
  if (!["active", "trialing"].includes(String(carrier.data()?.billing?.status)))
    throw new HttpsError("failed-precondition", "The app subscription must be active before managed support can be quoted.");
  if (coverage.data()?.status === "active")
    throw new HttpsError("failed-precondition", "An active managed-service scope change needs a separate billing review.");
  if (!["requested", "contacted", "quoted", "accepted"].includes(String(currentRequest.data()?.status)))
    throw new HttpsError("failed-precondition", "The customer must request managed support first.");
  const selected = areas(currentRequest.data()?.areas);
  if (!selected.company && !selected.drivers && !selected.fleet)
    throw new HttpsError("failed-precondition", "The request has no managed areas.");
  let roster;
  try {
    const intake = managedIntake(currentRequest.data()?.intake, selected);
    roster = managedRoster(id, selected, intake,
      driverRows.docs.map(row => ({ id: row.id, data: row.data() })),
      vehicleRows.docs.map(row => ({ id: row.id, data: row.data() })));
  } catch (error) {
    throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Review the listed units before quoting.");
  }
  const counts: ManagedCounts = { drivers: roster.drivers,
    trucks: roster.trucks, trailers: roster.trailers, dqFiles };
  const units = { driverIds: roster.driverIds, vehicleIds: roster.vehicleIds };
  let price;
  try { price = calculateManagedPrice(selected, counts); }
  catch { throw new HttpsError("invalid-argument", "The requested quantities do not match the service areas."); }
  if (price.firstYearMonthly === 0)
    throw new HttpsError("failed-precondition", "There are no active units to manage yet. Enter at least one active driver, truck, or trailer before quoting this request.");
  const quoteId = randomUUID();
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 14 * 86400000);
  await db.runTransaction(async tx => {
    const [latestRequest, oldQuote, latestCoverage] = await Promise.all([
      tx.get(requestRef), tx.get(quoteRef), tx.get(coverageRef),
    ]);
    if (latestRequest.data()?.revision !== currentRequest.data()?.revision ||
      !same(areas(latestRequest.data()?.areas), selected) || latestCoverage.data()?.status === "active")
      throw new HttpsError("aborted", "The request changed. Refresh before preparing a quote.");
    if (["paid_awaiting_start", "active"].includes(String(oldQuote.data()?.status)) ||
        (oldQuote.data()?.status === "accepted" && oldQuote.data()?.expiresAt?.toMillis?.() > Date.now()))
      throw new HttpsError("failed-precondition", "An accepted or paid quote cannot be replaced.");
    tx.set(quoteRef, { quoteId, carrierId: id, companyName: carrier.data()?.companyName ?? "Company",
      areas: selected, counts, units, appDriverIncrease: roster.newDrivers.length,
      price, scope, status: "quoted",
      requestRevision: latestRequest.data()?.revision ?? 0,
      expiresAt, createdAt: now, createdBy: request.auth!.uid });
    tx.update(requestRef, { status: "quoted", updatedAt: now });
    tx.create(quoteRef.collection("events").doc(), { type: "quoted", quoteId,
      actor: request.auth!.uid, createdAt: now });
    const email = String(latestRequest.data()?.preferredEmail || "").trim();
    if (returnOrigin(null) === "https://weheartpaperwork.com" &&
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !email.endsWith(".invalid"))
      tx.create(db.collection("mail").doc(`managed_quote_${quoteId}`), {
        to: [email], category: "managed_service_quote", managedServiceCarrierId: id,
        message: { subject: `Your We Heart Paperwork managed-support quote`,
          text: `We prepared your managed-support quote for ${String(carrier.data()?.companyName || "your company")}.\n\nScope: ${scope}\nFirst 12 months: $${price.firstYearMonthly}/month. After 12 months: $${price.renewalMonthly}/month. One-time charges: $${price.fleetOnlyOnboardingOneTime + price.dqFileOneTime}. Your app subscription remains separate.\n\nSign in at ${returnOrigin(null)}/managed-tracking to review and accept. The quote expires in 14 days. Nothing is charged until you complete secure checkout.\n\nAaron, We Heart Paperwork` },
        createdAt: now,
      });
  });
  return { quoteId, price, counts, expiresAtMillis: expiresAt.toMillis() };
});
export const acceptManagedServiceQuote = onCall({ region: "us-central1" }, async request => {
  const id = request.auth?.uid;
  if (!id) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const quoteId = request.data?.quoteId;
  if (typeof quoteId !== "string" || !/^[a-f0-9-]{36}$/i.test(quoteId))
    throw new HttpsError("invalid-argument", "Choose a valid quote.");
  const db = admin.firestore();
  const quoteRef = db.collection("managedServiceQuotes").doc(id);
  const requestRef = db.collection("managedServiceRequests").doc(id);
  return db.runTransaction(async tx => {
    const [quote, serviceRequest] = await Promise.all([tx.get(quoteRef), tx.get(requestRef)]);
    const row = quote.data() ?? {};
    if (row.quoteId !== quoteId || row.requestRevision !== serviceRequest.data()?.revision ||
      serviceRequest.data()?.status !== "quoted" || row.status !== "quoted")
      throw new HttpsError("failed-precondition", "This quote is no longer available. Ask us for an updated quote.");
    if (!Number.isSafeInteger(row.appDriverIncrease))
      throw new HttpsError("failed-precondition", "Ask us for an updated quote that shows any app Driver charge change.");
    if (!row.expiresAt || row.expiresAt.toMillis() <= Date.now())
      throw new HttpsError("failed-precondition", "This quote has expired. Ask us for an updated quote.");
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.update(quoteRef, { status: "accepted", acceptedAt: now, acceptedBy: id });
    tx.update(requestRef, { status: "accepted", updatedAt: now });
    tx.create(quoteRef.collection("events").doc(), { type: "accepted", quoteId, actor: id, createdAt: now });
    return { status: "accepted", quoteId };
  });
});

export const createManagedCheckoutSession = onCall({ region: "us-central1", secrets: [stripeSecretKey] }, async request => {
  const id = request.auth?.uid;
  if (!id) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const quoteId = request.data?.quoteId;
  if (typeof quoteId !== "string" || !/^[a-f0-9-]{36}$/i.test(quoteId))
    throw new HttpsError("invalid-argument", "Choose a valid quote.");
  const db = admin.firestore();
  const quoteRef = db.collection("managedServiceQuotes").doc(id);
  const requestRef = db.collection("managedServiceRequests").doc(id);
  const carrierRef = db.collection("carriers").doc(id);
  const [quote, serviceRequest, carrier] = await Promise.all([quoteRef.get(), requestRef.get(), carrierRef.get()]);
  const row = quote.data() ?? {};
  if (row.quoteId !== quoteId || row.status !== "accepted" ||
      serviceRequest.data()?.status !== "accepted" || row.requestRevision !== serviceRequest.data()?.revision ||
      row.expiresAt?.toMillis?.() <= Date.now())
    throw new HttpsError("failed-precondition", "This quote is no longer ready for checkout.");
  if (!Number.isSafeInteger(row.appDriverIncrease))
    throw new HttpsError("failed-precondition", "Ask us for an updated quote that shows any app Driver charge change.");
  if (row.expiresAt.toMillis() - Date.now() < 31 * 60 * 1000)
    throw new HttpsError("failed-precondition", "This quote is about to expire. Ask us for a new quote.");
  if (!carrier.exists || carrier.data()?.deletingAccount === true ||
      !["active", "trialing"].includes(String(carrier.data()?.billing?.status)))
    throw new HttpsError("failed-precondition", "An active app subscription is required first.");
  const [driverRows, vehicleRows] = await Promise.all([
    carrierRef.collection("drivers").get(), carrierRef.collection("vehicles").get(),
  ]);
  try {
    const selected = areas(row.areas);
    const intake = managedIntake(serviceRequest.data()?.intake, selected);
    const currentRoster = managedRoster(id, selected, intake,
      driverRows.docs.map(doc => ({ id: doc.id, data: doc.data() })),
      vehicleRows.docs.map(doc => ({ id: doc.id, data: doc.data() })));
    if (JSON.stringify(currentRoster.driverIds) !== JSON.stringify(row.units?.driverIds) ||
        JSON.stringify(currentRoster.vehicleIds) !== JSON.stringify(row.units?.vehicleIds))
      throw new Error("The driver or equipment list changed since the quote.");
  } catch (error) {
    throw new HttpsError("failed-precondition",
      `${error instanceof Error ? error.message : "The quoted roster changed."} Ask us to update the quote before checkout.`);
  }
  const customerId = carrier.data()?.billing?.stripeCustomerId;
  if (typeof customerId !== "string" || !customerId.startsWith("cus_"))
    throw new HttpsError("failed-precondition", "Your app billing account is unavailable. Contact support.");
  const stripe = new Stripe(stripeSecretKey.value());
  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? admin.app().options.projectId;
  if (project === "weheartpaperwork-staging" && !stripeSecretKey.value().startsWith("sk_test_"))
    throw new HttpsError("failed-precondition", "Staging checkout requires a Stripe test key.");
  const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  if (existing.data.some(item => item.metadata.serviceKind === "managed" && activeStripeStatuses.has(item.status)))
    throw new HttpsError("already-exists", "Managed billing already exists. Contact support to change your service.");
  const origin = returnOrigin(request.data?.returnOrigin);
  const token = randomUUID();
  await db.runTransaction(async tx => {
    const [latest, latestRequest] = await Promise.all([tx.get(quoteRef), tx.get(requestRef)]);
    if (latest.data()?.quoteId !== quoteId || latest.data()?.status !== "accepted" ||
        latestRequest.data()?.status !== "accepted" || latest.data()?.requestRevision !== latestRequest.data()?.revision)
      throw new HttpsError("failed-precondition", "This quote changed. Refresh before checkout.");
    if (latest.data()?.checkoutCreationAt?.toMillis?.() > Date.now() - 2 * 60 * 1000)
      throw new HttpsError("aborted", "Checkout is opening in another tab. Try again shortly.");
    tx.update(quoteRef, { checkoutCreationToken: token,
      checkoutCreationAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  try {
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    const reusable = sessions.data.find(item => item.metadata?.serviceKind === "managed" &&
      item.metadata?.quoteId === quoteId && item.url && item.success_url?.startsWith(`${origin}/`));
    const session = reusable ?? await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: managedItems(row),
      client_reference_id: id,
      metadata: { serviceKind: "managed", carrierId: id, quoteId },
      subscription_data: { metadata: { serviceKind: "managed", carrierId: id, quoteId } },
      success_url: `${origin}/managed-tracking?checkout=success`,
      cancel_url: `${origin}/managed-tracking?checkout=cancel`,
      expires_at: Math.min(Math.floor(row.expiresAt.toMillis() / 1000), Math.floor(Date.now() / 1000) + 24 * 3600),
    }, { idempotencyKey: `managed_checkout_${quoteId}` });
    if (!session.url) throw new HttpsError("internal", "Stripe did not return a checkout link.");
    await db.runTransaction(async tx => {
      const latest = await tx.get(quoteRef);
      if (latest.data()?.checkoutCreationToken !== token || latest.data()?.status !== "accepted")
        throw new HttpsError("aborted", "The quote changed while checkout was opening.");
      tx.update(quoteRef, { checkoutSessionId: session.id, checkoutCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        checkoutCreationToken: admin.firestore.FieldValue.delete(), checkoutCreationAt: admin.firestore.FieldValue.delete() });
    });
    return { url: session.url };
  } finally {
    await db.runTransaction(async tx => {
      const latest = await tx.get(quoteRef);
      if (latest.data()?.checkoutCreationToken === token) tx.update(quoteRef, {
        checkoutCreationToken: admin.firestore.FieldValue.delete(),
        checkoutCreationAt: admin.firestore.FieldValue.delete(),
      });
    });
  }
});

export const withdrawManagedServiceQuote = onCall({ region: "us-central1", secrets: [stripeSecretKey] }, async request => {
  const id = request.auth?.uid;
  if (!id) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const db = admin.firestore();
  const quoteRef = db.collection("managedServiceQuotes").doc(id);
  const requestRef = db.collection("managedServiceRequests").doc(id);
  const [quote, serviceRequest] = await Promise.all([quoteRef.get(), requestRef.get()]);
  if (!["quoted", "accepted"].includes(String(quote.data()?.status)) ||
      !["quoted", "accepted"].includes(String(serviceRequest.data()?.status)) ||
      quote.data()?.requestRevision !== serviceRequest.data()?.revision)
    throw new HttpsError("failed-precondition", "This quote can no longer be withdrawn here. Contact support.");
  if (quote.data()?.checkoutCreationAt?.toMillis?.() > Date.now() - 2 * 60 * 1000)
    throw new HttpsError("aborted", "Checkout is opening. Try again shortly.");
  const sessionId = quote.data()?.checkoutSessionId;
  if (typeof sessionId === "string") {
    const stripe = new Stripe(stripeSecretKey.value());
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "complete")
      throw new HttpsError("failed-precondition", "Checkout completed. Contact support about this payment.");
    if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
  }
  const customerId = (await db.collection("carriers").doc(id).get()).data()?.billing?.stripeCustomerId;
  if (typeof customerId === "string") {
    const stripe = new Stripe(stripeSecretKey.value());
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    for (const session of open.data.filter(item => item.metadata?.serviceKind === "managed" && item.metadata.quoteId === quote.data()?.quoteId))
      await stripe.checkout.sessions.expire(session.id);
  }
  await db.runTransaction(async tx => {
    const [latestQuote, latestRequest] = await Promise.all([tx.get(quoteRef), tx.get(requestRef)]);
    if (latestQuote.data()?.quoteId !== quote.data()?.quoteId ||
        latestQuote.data()?.requestRevision !== latestRequest.data()?.revision ||
        !["quoted", "accepted"].includes(String(latestQuote.data()?.status)) ||
        latestQuote.data()?.checkoutCreationAt?.toMillis?.() > Date.now() - 2 * 60 * 1000)
      throw new HttpsError("aborted", "Quote changed while withdrawing. Refresh and try again.");
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.update(quoteRef, { status: "withdrawn", withdrawnAt: now });
    tx.update(requestRef, { status: "withdrawn", revision: Number(latestRequest.data()?.revision || 0) + 1, updatedAt: now });
    tx.create(quoteRef.collection("events").doc(), { type: "withdrawn", actor: id, createdAt: now });
  });
  return { status: "withdrawn" };
});

export async function handleManagedCheckout(db: FirebaseFirestore.Firestore, stripe: Stripe,
  session: Stripe.Checkout.Session): Promise<void> {
  const id = session.metadata?.carrierId;
  const quoteId = session.metadata?.quoteId;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!id || !quoteId || !subscriptionId || session.payment_status !== "paid")
    throw new Error("Managed checkout is missing a paid subscription or customer metadata.");
  const quoteRef = db.collection("managedServiceQuotes").doc(id);
  const requestRef = db.collection("managedServiceRequests").doc(id);
  const [quote, serviceRequest, subscription] = await Promise.all([
    quoteRef.get(), requestRef.get(), stripe.subscriptions.retrieve(subscriptionId),
  ]);
  if (subscription.metadata.serviceKind !== "managed" || subscription.metadata.quoteId !== quoteId ||
      subscription.metadata.carrierId !== id) throw new Error("Managed subscription metadata mismatch.");
  if (quote.data()?.quoteId !== quoteId || quote.data()?.checkoutSessionId !== session.id ||
      !["accepted", "paid_awaiting_start", "active"].includes(String(quote.data()?.status)))
    throw new Error("Managed checkout does not match an accepted quote. Requires owner review.");
  // Never activate from a browser return. Confirm the payment using Stripe's signed webhook.
  if (!activeStripeStatuses.has(subscription.status) || subscription.status !== "active")
    throw new Error(`Managed subscription is ${subscription.status}; await payment confirmation.`);
  if (quote.data()?.status === "accepted" && serviceRequest.data()?.revision !== quote.data()?.requestRevision)
    throw new Error("Customer changed scope before payment. Requires owner review.");
  if (areas(quote.data()?.areas).company) await ensureManagedRenewalSchedule(stripe, subscription, quoteId);
  await db.runTransaction(async tx => {
    const [latestQuote, latestRequest] = await Promise.all([tx.get(quoteRef), tx.get(requestRef)]);
    if (latestQuote.data()?.quoteId !== quoteId || latestQuote.data()?.checkoutSessionId !== session.id)
      throw new Error("Managed quote changed during payment processing.");
    if (latestQuote.data()?.status === "accepted") {
      if (latestRequest.data()?.status !== "accepted" || latestRequest.data()?.revision !== latestQuote.data()?.requestRevision)
        throw new Error("Managed request changed during payment processing.");
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(quoteRef, { status: "paid_awaiting_start", paidAt: now, stripeSubscriptionId: subscriptionId });
      tx.update(requestRef, { status: "paid_awaiting_start", updatedAt: now });
      tx.create(quoteRef.collection("events").doc(), { type: "paid", quoteId, createdAt: now });
      tx.create(db.collection("mail").doc(`managed_paid_${quoteId}`), {
        to: ["aaron@weheartpaperwork.com"], category: "managed_service_payment", managedServiceCarrierId: id,
        message: { subject: `Managed support paid: ${String(latestRequest.data()?.companyName || "Company")}`,
          text: `Payment was confirmed for quote ${quoteId}. Verify setup and activate coverage in the owner workspace.\nCompany ID: ${id}\nStripe subscription: ${subscriptionId}` },
        createdAt: now,
      });
    }
    tx.set(db.collection("managedServiceBilling").doc(id), {
      quoteId, stripeSubscriptionId: subscription.id, stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      status: subscription.status, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function ensureManagedRenewalSchedule(stripe: Stripe, subscription: Stripe.Subscription, quoteId: string): Promise<void> {
  let schedule: Stripe.SubscriptionSchedule;
  if (subscription.schedule) {
    const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  } else {
    schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id },
      { idempotencyKey: `managed_schedule_${quoteId}` });
  }
  if (schedule.phases.length > 1) return;
  const companyItem = subscription.items.data.find(item => item.price.unit_amount === MANAGED_PRICING.companyFirstYearMonthly * 100);
  if (!companyItem) throw new Error("Managed company price is missing from Stripe subscription.");
  const productId = typeof companyItem.price.product === "string" ? companyItem.price.product : companyItem.price.product.id;
  const renewalPrice = await stripe.prices.create({ product: productId, currency: "usd",
    unit_amount: MANAGED_PRICING.companyRenewalMonthly * 100, recurring: { interval: "month" },
    metadata: { serviceKind: "managed", quoteId, phase: "renewal" } },
    { idempotencyKey: `managed_renewal_price_${quoteId}` });
  const currentItems = subscription.items.data.map(item => ({ price: item.price.id, quantity: item.quantity ?? 1 }));
  const nextItems = subscription.items.data.map(item => ({
    price: item.id === companyItem.id ? renewalPrice.id : item.price.id,
    quantity: item.quantity ?? 1,
  }));
  await stripe.subscriptionSchedules.update(schedule.id, { end_behavior: "release", phases: [
    { start_date: schedule.phases[0].start_date, duration: { interval: "month", interval_count: 12 }, items: currentItems },
    { duration: { interval: "month", interval_count: 1 }, items: nextItems,
      metadata: { serviceKind: "managed", quoteId } },
  ] }, { idempotencyKey: `managed_schedule_phases_${quoteId}` });
}

export async function syncManagedSubscription(db: FirebaseFirestore.Firestore, subscription: Stripe.Subscription): Promise<void> {
  if (subscription.metadata.serviceKind !== "managed") return;
  const id = subscription.metadata.carrierId;
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Managed subscription lacks company ID.");
  const carrier = await db.collection("carriers").doc(id).get();
  if (!carrier.exists || carrier.data()?.deletingAccount === true) return;
  const ref = db.collection("managedServiceBilling").doc(id);
  const existing = await ref.get();
  if (existing.exists && existing.data()?.stripeSubscriptionId !== subscription.id) return;
  await ref.set({ quoteId: subscription.metadata.quoteId, stripeSubscriptionId: subscription.id,
    status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at ? admin.firestore.Timestamp.fromMillis(subscription.cancel_at * 1000) : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  if (["canceled", "unpaid", "incomplete_expired"].includes(subscription.status)) {
    const coverageRef = db.collection("managedServiceCoverage").doc(id);
    const coverage = await coverageRef.get();
    if (coverage.data()?.status === "active") await coverageRef.update({ status: "paused",
      pauseReason: "Managed subscription is no longer payable", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const requestRef = db.collection("managedServiceRequests").doc(id);
    const serviceRequest = await requestRef.get();
    if (serviceRequest.data()?.status === "end_scheduled") await requestRef.update({ status: "ended",
      updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
}

export const scheduleManagedServiceEnd = onCall({ region: "us-central1", secrets: [stripeSecretKey] }, async request => {
  requireOwner(request.auth);
  const id = carrierId(request.data?.carrierId);
  const db = admin.firestore();
  const [serviceRequest, billing] = await Promise.all([
    db.collection("managedServiceRequests").doc(id).get(),
    db.collection("managedServiceBilling").doc(id).get(),
  ]);
  if (serviceRequest.data()?.status !== "end_requested")
    throw new HttpsError("failed-precondition", "The customer must request to end service first.");
  const subscriptionId = billing.data()?.stripeSubscriptionId;
  if (typeof subscriptionId !== "string") throw new HttpsError("failed-precondition", "No managed subscription exists.");
  const stripe = new Stripe(stripeSecretKey.value());
  const current = await stripe.subscriptions.retrieve(subscriptionId);
  if (current.metadata.serviceKind !== "managed" || current.metadata.carrierId !== id)
    throw new HttpsError("failed-precondition", "Managed subscription does not match this customer.");
  const updated = current.cancel_at_period_end ? current : await stripe.subscriptions.update(subscriptionId,
    { cancel_at_period_end: true }, { idempotencyKey: `managed_end_${id}_${serviceRequest.data()?.revision}` });
  await db.runTransaction(async tx => {
    const latest = await tx.get(serviceRequest.ref);
    if (latest.data()?.status === "end_requested" && latest.data()?.revision === serviceRequest.data()?.revision) {
      tx.update(serviceRequest.ref, { status: "end_scheduled", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.create(serviceRequest.ref.collection("events").doc(), { type: "end_scheduled",
        actor: request.auth!.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  });
  await syncManagedSubscription(db, updated);
  return { status: "end_scheduled", cancelAtMillis: updated.cancel_at ? updated.cancel_at * 1000 : null };
});
