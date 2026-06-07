/**
 * Oil Game Reset Script
 *
 * Wipes the per-season MUTABLE game state so a fresh season starts at the current
 * OIL_FIELD_UNITS / totalOilBudget scale. Required whenever you change the field
 * scale or prize pool between seasons — oil amounts persist and accumulate, so
 * old-scale data would otherwise produce wrong EXTRACTED / VALUE / payout numbers
 * (e.g. a single player's banked oil exceeding the whole field). See docs/oil-game.md
 * "Prize pool — oil has a fixed value".
 *
 * Clears:
 *   oilDrills/*               — per-player drill state (totalCollected, tankOil, drillDay, …)
 *   oilPlots/*                — per-cell ownership + server-revealed oil
 *   oilGame/communityStorage  — community tank total (totalOil → 0)
 *
 * Does NOT touch: oilQualified (registrations/wallets), oilGame/settings,
 * oilSecret/seed (the fairness commit). The next strike-tick re-reveals oilPlots
 * from the existing seed at the current scale.
 *
 * Usage:
 *   node scripts/oil-reset.js --dry-run   # count what WOULD be cleared, no writes
 *   node scripts/oil-reset.js             # clear (prompts for confirmation)
 *
 * Env vars (any one, same as src/lib/firebaseAdmin.js):
 *   GOOGLE_APPLICATION_CREDENTIALS — path to a service-account JSON, OR
 *   FIREBASE_SERVICE_ACCOUNT       — service-account JSON as a string, OR
 *   (Application Default Credentials) + FIREBASE_PROJECT_ID
 */

import 'dotenv/config';
import { createInterface } from 'readline';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── CLI flags ──────────────────────────────────────────────────────────
const isDryRun = process.argv.includes('--dry-run');

// Collections deleted in full, and the single doc reset to zero.
const WIPE_COLLECTIONS = ['oilDrills', 'oilPlots'];
const COMMUNITY_DOC = { collection: 'oilGame', id: 'communityStorage' };

// ── Firebase Admin init (mirrors src/lib/firebaseAdmin.js) ───────────────
function initAdmin() {
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  }
  return getFirestore();
}

// ── Delete an entire collection in batches (admin batch cap = 500) ───────
async function deleteCollection(db, name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs;
  if (docs.length === 0) return 0;

  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 500)) batch.delete(d.ref);
    await batch.commit();
  }
  return docs.length;
}

// ── Prompt for confirmation ──────────────────────────────────────────────
function promptConfirm(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(isDryRun ? '🔍 DRY RUN — counting only, no writes\n' : '🧨 RESET MODE\n');

  const db = initAdmin();

  // Count current state first.
  const counts = {};
  for (const name of WIPE_COLLECTIONS) {
    counts[name] = (await db.collection(name).get()).size;
  }
  const communitySnap = await db.collection(COMMUNITY_DOC.collection).doc(COMMUNITY_DOC.id).get();
  const communityTotal = communitySnap.exists ? (communitySnap.data().totalOil || 0) : 0;

  console.log('Current per-season state:');
  for (const name of WIPE_COLLECTIONS) console.log(`  ${name.padEnd(24)} ${counts[name]} docs`);
  console.log(`  ${`${COMMUNITY_DOC.collection}/${COMMUNITY_DOC.id}`.padEnd(24)} totalOil = ${communityTotal.toLocaleString()}`);
  console.log('');

  if (isDryRun) {
    console.log('Dry run complete. Nothing was changed.');
    return;
  }

  const totalDocs = WIPE_COLLECTIONS.reduce((s, n) => s + counts[n], 0);
  const confirmed = await promptConfirm(
    `Delete ${totalDocs} docs across [${WIPE_COLLECTIONS.join(', ')}] and zero the community tank? This is irreversible. (y/n) `
  );
  if (!confirmed) {
    console.log('Aborted. Nothing was changed.');
    return;
  }

  for (const name of WIPE_COLLECTIONS) {
    process.stdout.write(`Clearing ${name}... `);
    const n = await deleteCollection(db, name);
    console.log(`✓ deleted ${n}`);
  }

  process.stdout.write(`Resetting ${COMMUNITY_DOC.collection}/${COMMUNITY_DOC.id}.totalOil → 0... `);
  await db.collection(COMMUNITY_DOC.collection).doc(COMMUNITY_DOC.id).set({ totalOil: 0 }, { merge: true });
  console.log('✓');

  console.log('\nDone. Re-seed / re-drill to populate a clean season at the current scale.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
