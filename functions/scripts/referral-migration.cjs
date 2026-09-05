// Never infer money already sent from a mutable reward status alone.
// plan PROJECT FILE writes a review manifest; apply PROJECT FILE requires every
// opening balance to be explicitly reviewed against Stripe and bank evidence.
const admin = require('firebase-admin');
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { appendLedger } = require('../lib/referralAccounting');
const { calculateRewardCents } = require('../lib/referralPolicy');
const [mode, projectId, file] = process.argv.slice(2);
if (!['plan', 'apply'].includes(mode) || !projectId || !file) throw new Error('Usage: node scripts/referral-migration.cjs plan|apply PROJECT FILE');
admin.initializeApp({ projectId });
const db = admin.firestore();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
(async () => {
  if (mode === 'plan') {
    const rows = await db.collection('referralRewards').get();
    const entries = rows.docs.filter(doc => doc.data().schemaVersion !== 2).map(doc => ({ invoiceId: doc.id,
      legacyDigest: digest(doc.data()), legacy: doc.data(), reviewed: false, grossPaymentCents: null,
      verifiedPaidCents: null, verifiedNetRewardCents: null, settlementEvidence: '', reviewReason: '' }));
    await fs.writeFile(file, JSON.stringify({ projectId, generatedAt: new Date().toISOString(), entries }, null, 2));
    console.log(`Wrote ${entries.length} legacy rewards for review. No Firebase changes.`); return;
  }
  const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  if (manifest.projectId !== projectId) throw new Error('Manifest project mismatch.');
  const config = await db.collection('referralProgram').doc('current').get();
  if (config.data()?.payoutsEnabled) throw new Error('Disable payouts before migrating.');
  // Validate the complete manifest before any mutation.
  for (const entry of manifest.entries) {
    const old = entry.legacy;
    if (!entry.reviewed || !entry.reviewReason || !entry.settlementEvidence || !Number.isSafeInteger(entry.grossPaymentCents) ||
        entry.grossPaymentCents < old.qualifyingCents || !Number.isSafeInteger(entry.verifiedPaidCents) || entry.verifiedPaidCents < 0 ||
        old.currency !== 'usd' || !['pending', 'held', 'available', 'reversed', 'paid'].includes(old.status) ||
        calculateRewardCents(old.qualifyingCents, old.commissionRateBps) !== old.originalRewardCents ||
        !Number.isSafeInteger(entry.verifiedNetRewardCents) || entry.verifiedNetRewardCents < 0 || entry.verifiedNetRewardCents > old.originalRewardCents) throw new Error(`Incomplete/inconsistent reviewed opening: ${entry.invoiceId}`);
  }
  for (const entry of manifest.entries) {
    const ref = db.collection('referralRewards').doc(entry.invoiceId);
    await db.runTransaction(async tx => {
      if ((await tx.get(db.collection('referralProgram').doc('current'))).data()?.payoutsEnabled) throw new Error('Payouts were activated during migration.');
      const old = (await tx.get(ref)).data();
      if (old?.schemaVersion === 2) {
        if (old.migrationDigest !== entry.legacyDigest) throw new Error(`Different migration already applied: ${entry.invoiceId}`);
        return;
      }
      if (digest(old) !== entry.legacyDigest) throw new Error(`Reward changed since review: ${entry.invoiceId}`);
      const row = { ...old, schemaVersion: 2, revision: 1, bucket: 'held', status: entry.verifiedNetRewardCents ? 'held' : 'reversed',
        netRewardCents: entry.verifiedNetRewardCents, adjustedCents: entry.verifiedNetRewardCents - old.originalRewardCents,
        grossPaymentCents: entry.grossPaymentCents, settledCents: entry.verifiedPaidCents, reservedCents: 0,
        eligibilityReview: true, fingerprint: null, migrationDigest: entry.legacyDigest };
      appendLedger(db, tx, `${entry.invoiceId}_1`, old.referrerCarrierId, {
        heldCents: entry.verifiedNetRewardCents, availableCents: -entry.verifiedPaidCents, paidCents: entry.verifiedPaidCents,
        lifetimeEarnedCents: old.originalRewardCents, reversedCents: old.originalRewardCents - entry.verifiedNetRewardCents,
      }, { type: 'reviewed_legacy_opening', rewardId: entry.invoiceId, referredCarrierId: old.referredCarrierId,
        stripeInvoiceId: entry.invoiceId, grossQualifyingPaymentCents: old.qualifyingCents, commissionRateBps: old.commissionRateBps,
        rewardAmountCents: entry.verifiedNetRewardCents, status: row.status, projection: row,
        reviewReason: entry.reviewReason, settlementEvidence: entry.settlementEvidence, migrationDigest: entry.legacyDigest });
      tx.set(ref, row);
      tx.delete(db.collection('referralRewardMaturities').doc(entry.invoiceId));
      tx.set(db.collection('referralReviewQueue').doc(entry.invoiceId), { status: 'open', referrerCarrierId: old.referrerCarrierId,
        stripeInvoiceId: entry.invoiceId, reason: 'Migrated opening; reconcile Stripe and verify historical eligibility before release' });
      tx.create(db.collection('referralAdminAudit').doc(`migration_${entry.invoiceId}`), { action: 'legacy_opening', projectId,
        migrationDigest: entry.legacyDigest, reviewReason: entry.reviewReason, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
  }
  console.log(`Migrated ${manifest.entries.length} reviewed entries. Payout activation remains a separate step.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
