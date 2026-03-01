/**
 * Oil Game Batch USDC Payout Script
 *
 * Reads the oilDrills + oilQualified collections from Firestore,
 * builds a payout manifest, and sends USDC transfers on Base.
 *
 * Usage:
 *   node scripts/oil-payout.js --dry-run   # preview only
 *   node scripts/oil-payout.js             # execute payouts
 *
 * Env vars required:
 *   BASE_RPC_URL          — Base RPC endpoint
 *   PAYOUT_PRIVATE_KEY    — private key of wallet holding USDC
 *   NEXT_PUBLIC_FIREBASE_* — Firebase config (already in .env)
 */

import 'dotenv/config';
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { createPublicClient, createWalletClient, http, parseUnits, encodeFunctionData, erc20Abi, isAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// ── Constants ──────────────────────────────────────────────────────────
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;
const RESULTS_PATH = new URL('./payout-results.json', import.meta.url).pathname;

// ── CLI flags ──────────────────────────────────────────────────────────
const isDryRun = process.argv.includes('--dry-run');

// ── Firebase init (server-side, no auth needed — rules allow read: true) ──
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig, 'oil-payout');
const db = getFirestore(app);

// ── Viem clients ───────────────────────────────────────────────────────
function createClients() {
  const rpcUrl = process.env.BASE_RPC_URL;
  const privKey = process.env.PAYOUT_PRIVATE_KEY;

  if (!rpcUrl) throw new Error('Missing BASE_RPC_URL env var');
  if (!privKey) throw new Error('Missing PAYOUT_PRIVATE_KEY env var');

  const account = privateKeyToAccount(privKey.startsWith('0x') ? privKey : `0x${privKey}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  return { publicClient, walletClient, account };
}

// ── Firestore data fetch ───────────────────────────────────────────────
async function fetchPayoutData() {
  console.log('Fetching oilDrills...');
  const drillsSnap = await getDocs(collection(db, 'oilDrills'));
  const drills = new Map();
  drillsSnap.forEach((doc) => {
    const d = doc.data();
    drills.set(doc.id, {
      userId: d.userId || doc.id,
      username: d.username || null,
      totalCollected: d.totalCollected || 0,
    });
  });
  console.log(`  → ${drills.size} drill records`);

  console.log('Fetching oilQualified...');
  const qualSnap = await getDocs(collection(db, 'oilQualified'));
  const qualified = new Map();
  qualSnap.forEach((doc) => {
    const d = doc.data();
    qualified.set(doc.id, {
      userId: d.userId || doc.id,
      walletAddress: d.walletAddress || null,
      clerkName: d.clerkName || null,
    });
  });
  console.log(`  → ${qualified.size} qualified records`);

  return { drills, qualified };
}

// ── Build payout list ──────────────────────────────────────────────────
function buildPayoutList(drills, qualified) {
  const payouts = [];

  for (const [userId, drill] of drills) {
    if (drill.totalCollected <= 0) continue;

    const qual = qualified.get(userId);
    if (!qual?.walletAddress || !isAddress(qual.walletAddress)) {
      console.warn(`  ⚠ Skipping ${userId} (${drill.username || 'no name'}): no valid wallet address`);
      continue;
    }

    payouts.push({
      userId,
      wallet: qual.walletAddress,
      username: drill.username || qual.clerkName || userId.slice(0, 8),
      amount: drill.totalCollected, // USDC units (e.g. 12.5 = $12.50)
    });
  }

  // Sort by amount descending
  payouts.sort((a, b) => b.amount - a.amount);
  return payouts;
}

// ── Load previous results for resume support ───────────────────────────
function loadPreviousResults() {
  if (!existsSync(RESULTS_PATH)) return new Map();
  try {
    const data = JSON.parse(readFileSync(RESULTS_PATH, 'utf-8'));
    const map = new Map();
    for (const entry of data) {
      if (entry.txHash && entry.status === 'success') {
        map.set(entry.wallet.toLowerCase(), entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

// ── Display manifest ───────────────────────────────────────────────────
function displayManifest(payouts, alreadyPaid) {
  console.log('\n' + '═'.repeat(80));
  console.log('  OIL GAME PAYOUT MANIFEST');
  console.log('═'.repeat(80));
  console.log(`  ${'#'.padEnd(4)} ${'Wallet'.padEnd(44)} ${'Username'.padEnd(20)} ${'Amount'.padStart(12)}`);
  console.log('─'.repeat(80));

  let total = 0;
  let skippedCount = 0;

  for (let i = 0; i < payouts.length; i++) {
    const p = payouts[i];
    const paid = alreadyPaid.has(p.wallet.toLowerCase());
    const marker = paid ? ' ✓ PAID' : '';
    if (paid) skippedCount++;
    total += p.amount;

    console.log(
      `  ${String(i + 1).padEnd(4)} ${p.wallet.padEnd(44)} ${p.username.slice(0, 18).padEnd(20)} ${p.amount.toFixed(2).padStart(10)} USDC${marker}`
    );
  }

  console.log('─'.repeat(80));
  console.log(`  TOTAL: ${total.toFixed(2)} USDC across ${payouts.length} players`);
  if (skippedCount > 0) {
    console.log(`  Already paid: ${skippedCount} (will be skipped)`);
  }
  console.log(`  Remaining: ${payouts.length - skippedCount} transfers`);
  console.log('═'.repeat(80) + '\n');

  return { total, remaining: payouts.length - skippedCount };
}

// ── Prompt for confirmation ────────────────────────────────────────────
function promptConfirm(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ── Execute payouts ────────────────────────────────────────────────────
async function executePayouts(payouts, alreadyPaid) {
  const { publicClient, walletClient, account } = createClients();

  // Check USDC balance
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  const balanceUsdc = Number(balance) / 1e6;
  const totalNeeded = payouts
    .filter((p) => !alreadyPaid.has(p.wallet.toLowerCase()))
    .reduce((sum, p) => sum + p.amount, 0);

  console.log(`Payout wallet: ${account.address}`);
  console.log(`USDC balance:  ${balanceUsdc.toFixed(2)} USDC`);
  console.log(`Total needed:  ${totalNeeded.toFixed(2)} USDC\n`);

  if (balanceUsdc < totalNeeded) {
    console.error(`✗ Insufficient USDC balance. Need ${totalNeeded.toFixed(2)} but have ${balanceUsdc.toFixed(2)}`);
    process.exit(1);
  }

  // Load or create results array
  let results = [];
  if (existsSync(RESULTS_PATH)) {
    try {
      results = JSON.parse(readFileSync(RESULTS_PATH, 'utf-8'));
    } catch {
      results = [];
    }
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < payouts.length; i++) {
    const p = payouts[i];

    // Skip already paid
    if (alreadyPaid.has(p.wallet.toLowerCase())) {
      console.log(`[${i + 1}/${payouts.length}] ✓ ${p.wallet.slice(0, 10)}... already paid — skipping`);
      continue;
    }

    const onChainAmount = parseUnits(p.amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

    try {
      console.log(`[${i + 1}/${payouts.length}] Sending ${p.amount.toFixed(2)} USDC → ${p.wallet.slice(0, 10)}... (${p.username})`);

      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [p.wallet, onChainAmount],
      });

      console.log(`  → tx: ${hash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const success = receipt.status === 'success';

      console.log(`  → ${success ? '✓ confirmed' : '✗ REVERTED'} (block ${receipt.blockNumber})`);

      const result = {
        userId: p.userId,
        wallet: p.wallet,
        username: p.username,
        amount: p.amount,
        txHash: hash,
        blockNumber: Number(receipt.blockNumber),
        status: success ? 'success' : 'reverted',
        timestamp: new Date().toISOString(),
      };

      results.push(result);
      writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

      if (success) {
        successCount++;
        alreadyPaid.set(p.wallet.toLowerCase(), result);
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);

      results.push({
        userId: p.userId,
        wallet: p.wallet,
        username: p.username,
        amount: p.amount,
        txHash: null,
        status: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
      failCount++;
    }
  }

  console.log(`\nDone. ${successCount} successful, ${failCount} failed.`);
  console.log(`Results saved to ${RESULTS_PATH}`);
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(isDryRun ? '🔍 DRY RUN MODE\n' : '💸 LIVE PAYOUT MODE\n');

  const { drills, qualified } = await fetchPayoutData();
  const payouts = buildPayoutList(drills, qualified);

  if (payouts.length === 0) {
    console.log('No payouts to process.');
    process.exit(0);
  }

  const alreadyPaid = loadPreviousResults();
  const { total, remaining } = displayManifest(payouts, alreadyPaid);

  if (isDryRun) {
    console.log('Dry run complete. No transfers sent.');
    process.exit(0);
  }

  if (remaining === 0) {
    console.log('All players already paid. Nothing to do.');
    process.exit(0);
  }

  const confirmed = await promptConfirm(`Send ${total.toFixed(2)} USDC to ${remaining} players? (y/n) `);
  if (!confirmed) {
    console.log('Aborted.');
    process.exit(0);
  }

  await executePayouts(payouts, alreadyPaid);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
