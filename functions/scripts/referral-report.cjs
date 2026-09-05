// Read-only, consistent-snapshot export. Uses standard Google ADC credentials.
// node scripts/referral-report.cjs PROJECT_ID OUTPUT_DIRECTORY [CARRIER_ID]
const admin = require('firebase-admin');
const fs = require('node:fs/promises');
const path = require('node:path');
const [projectId, outputDirectory, carrierId] = process.argv.slice(2);
if (!projectId || !outputDirectory) throw new Error('Usage: node scripts/referral-report.cjs PROJECT_ID OUTPUT_DIRECTORY [CARRIER_ID]');
admin.initializeApp({ projectId });
const db = admin.firestore();
const keys = ['pendingCents', 'heldCents', 'availableCents', 'reservedCents', 'paidCents', 'reversedCents', 'lifetimeEarnedCents'];
async function pageAll(tx, collection) {
  let query = db.collection(collection);
  if (carrierId) query = query.where('referrerCarrierId', '==', carrierId);
  query = query.orderBy(admin.firestore.FieldPath.documentId());
  const rows = [];
  for (;;) {
    const page = await tx.get(query.limit(500));
    rows.push(...page.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    if (page.size < 500) return rows;
    query = query.startAfter(page.docs.at(-1).id);
  }
}
(async () => {
  const snapshot = await db.runTransaction(async tx => {
    const [ledger, balances, payouts, reviews, rewards] = await Promise.all([
      pageAll(tx, 'referralLedger'), pageAll(tx, 'referralBalances'), pageAll(tx, 'referralPayouts'),
      pageAll(tx, 'referralReviewQueue'), pageAll(tx, 'referralRewards'),
    ]);
    return { ledger, balances, payouts, reviews, rewards };
  }, { readOnly: true });
  const rebuilt = new Map();
  for (const entry of snapshot.ledger) {
    if (entry.currency !== 'usd') throw new Error(`Unsupported journal currency: ${entry.id}`);
    const row = rebuilt.get(entry.referrerCarrierId) ?? Object.fromEntries(keys.map(key => [key, 0]));
    for (const key of keys) row[key] += entry.deltas[key] ?? 0;
    rebuilt.set(entry.referrerCarrierId, row);
  }
  const byCarrier = new Map(snapshot.balances.map(row => [row.id, row]));
  const discrepancies = [];
  for (const id of new Set([...rebuilt.keys(), ...byCarrier.keys()])) {
    const actual = byCarrier.get(id) ?? {}, expected = rebuilt.get(id) ?? {};
    for (const key of keys) if ((actual[key] ?? 0) !== (expected[key] ?? 0)) discrepancies.push({ carrierId: id, key, actual: actual[key] ?? 0, expected: expected[key] ?? 0 });
    const obligation = (expected.pendingCents ?? 0) + (expected.heldCents ?? 0) + (expected.availableCents ?? 0) + (expected.reservedCents ?? 0) + (expected.paidCents ?? 0);
    if (obligation !== (expected.lifetimeEarnedCents ?? 0) - (expected.reversedCents ?? 0)) discrepancies.push({ carrierId: id, key: 'journal_conservation', obligation });
  }
  const csv = [['carrierId', 'currency', ...keys, 'meetsThreshold', 'openReviews'].join(',')];
  for (const [id, row] of [...rebuilt].sort()) {
    const openReviews = snapshot.reviews.filter(review => review.referrerCarrierId === id && review.status === 'open').length;
    csv.push([id, 'usd', ...keys.map(key => row[key]), row.availableCents >= 2500 && row.reservedCents === 0 && openReviews === 0, openReviews].join(','));
  }
  const destination = path.resolve(outputDirectory);
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, 'referral-balances.csv'), csv.join('\n') + '\n');
  await fs.writeFile(path.join(destination, 'referral-accounting.json'), JSON.stringify({ projectId, exportedAt: new Date().toISOString(), carrierId: carrierId ?? null, discrepancies, ...snapshot }, null, 2));
  console.log(`Exported ${snapshot.ledger.length} journal entries, ${rebuilt.size} carriers; ${discrepancies.length} discrepancies.`);
  if (discrepancies.length) process.exitCode = 2;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
