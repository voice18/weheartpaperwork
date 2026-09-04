// Builds company-identity and payment-time eligibility baselines. Deploy the
// new webhook first so subscription changes after baseline start are captured.
// STRIPE_SECRET_KEY is required only for apply; it is never written to output.
const admin = require('firebase-admin');
const Stripe = require('stripe');
const fs = require('node:fs/promises');
const [mode, projectId, file] = process.argv.slice(2);
if (!['plan', 'apply'].includes(mode) || !projectId || !file) throw new Error('Usage: node scripts/referral-bootstrap.cjs plan|apply PROJECT FILE');
admin.initializeApp({ projectId }); const db = admin.firestore();
const usdot = value => typeof value === 'string' && /^\s*\d{1,8}\s*$/.test(value) ? value.trim().replace(/^0+/, '') : '';
(async () => {
  if (mode === 'plan') {
    const [referrals, codeOwners] = await Promise.all([db.collection('referrals').get(), db.collection('carrierReferralCodes').get()]);
    const ids = new Set(codeOwners.docs.map(doc => doc.id));
    referrals.docs.forEach(doc => { ids.add(doc.id); ids.add(doc.data().referrerCarrierId); });
    const entries = [];
    for (const id of [...ids].sort()) {
      const carrier = await db.collection('carriers').doc(id).get();
      entries.push({ carrierId: id, exists: carrier.exists, usdot: usdot(carrier.data()?.usdotNumber),
        stripeSubscriptionId: carrier.data()?.billing?.stripeSubscriptionId ?? null, reviewed: false });
    }
    const collisions = entries.filter((row, index) => row.usdot && entries.findIndex(other => other.usdot === row.usdot) !== index).map(row => row.usdot);
    await fs.writeFile(file, JSON.stringify({ projectId, generatedAt: new Date().toISOString(), collisions: [...new Set(collisions)], entries }, null, 2));
    console.log(`Planned ${entries.length} identities; ${collisions.length} collisions. No Firebase changes.`); return;
  }
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required for apply.');
  const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  if (manifest.projectId !== projectId || manifest.collisions.length || manifest.entries.some(row => !row.reviewed || !row.exists || !row.usdot || !row.stripeSubscriptionId)) throw new Error('Manifest has unresolved identities, collisions, or review boxes.');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const baselineAt = admin.firestore.Timestamp.now();
  const snapshots = [];
  for (const entry of manifest.entries) {
    const subscription = await stripe.subscriptions.retrieve(entry.stripeSubscriptionId);
    snapshots.push({ ...entry, status: subscription.status, stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id });
  }
  const batchId = baselineAt.toMillis().toString();
  for (const row of snapshots) {
    await db.runTransaction(async tx => {
      const companyRef = db.collection('referralCompanies').doc(row.usdot);
      const company = await tx.get(companyRef);
      if (company.exists && company.data().carrierId !== row.carrierId) throw new Error(`USDOT collision after review: ${row.usdot}`);
      tx.set(companyRef, { carrierId: row.carrierId }, { merge: true });
      tx.update(db.collection('carriers').doc(row.carrierId), { referralCompanyKey: row.usdot });
      tx.create(db.collection('referralParticipationEvents').doc(`bootstrap_${batchId}_${row.carrierId}`), {
        carrierId: row.carrierId, stripeSubscriptionId: row.stripeSubscriptionId, status: row.status,
        effectiveAt: baselineAt, sourceEventId: `bootstrap_${batchId}`, recordedAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(db.collection('referralBillingIdentities').doc(row.stripeCustomerId), { carrierId: row.carrierId }, { merge: true });
    });
  }
  await db.collection('referralBootstrapRuns').doc(batchId).create({ status: 'complete', carrierCount: snapshots.length,
    baselineAt, manifestFile: file, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`Bootstrapped ${snapshots.length} carriers. Use accountingActivatedAt=${baselineAt.toDate().toISOString()} only after ledger migration passes.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
