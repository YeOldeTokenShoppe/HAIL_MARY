/**
 * Oil Game — Merkle Root Builder (on-chain settlement path)
 *
 * Reuses the SAME fixed-rate payout math as scripts/oil-payout.js, then builds a
 * Merkle tree of (wallet, amount) and writes scripts/oil-merkle.json:
 *   { token, merkleRoot, totalAmount, decimals, claims: [{ wallet, amount, amountUsdc, proof }] }
 *
 * Deploy flow:
 *   1. node scripts/oil-build-merkle.js          # writes oil-merkle.json (+ prints root/total)
 *   2. Deploy OilPayoutDistributor(USDC, merkleRoot, claimDeadline, owner)
 *   3. Transfer `totalAmount` USDC into the deployed contract (escrow)
 *   4. Publish oil-merkle.json so players can look up their { amount, proof } and claim()
 *
 * Leaf format matches contracts/OilPayoutDistributor.sol (OZ StandardMerkleTree style):
 *   leaf  = keccak256( keccak256( abi.encode(address account, uint256 amount) ) )
 *   node  = keccak256( sorted(a, b) )   // commutative — proof order doesn't matter
 *
 * Usage:
 *   node scripts/oil-build-merkle.js
 *
 * Env vars: same Firebase config as scripts/oil-payout.js.
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { keccak256, encodeAbiParameters, parseAbiParameters, parseUnits, concat, getAddress } from 'viem';
import { fetchPayoutData, buildPayoutList } from './oil-payout.js';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
const USDC_DECIMALS = 6;
const OUT_PATH = new URL('./oil-merkle.json', import.meta.url).pathname;

// ── Leaf / node hashing (must mirror the Solidity contract) ──────────────
function leafHash(account, amount) {
  const inner = keccak256(encodeAbiParameters(parseAbiParameters('address, uint256'), [account, amount]));
  return keccak256(inner); // double-hash (OZ StandardMerkleTree leaf encoding)
}

function hashPair(a, b) {
  // Sorted (commutative) pair — compare as bytes (equal-length lowercase hex compare).
  const [lo, hi] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  return keccak256(concat([lo, hi]));
}

function buildTree(leaves) {
  let layer = [...leaves];
  const layers = [layer];
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 === layer.length) next.push(layer[i]);          // odd node carried up
      else next.push(hashPair(layer[i], layer[i + 1]));
    }
    layer = next;
    layers.push(layer);
  }
  return { root: layers[layers.length - 1][0], layers };
}

function getProof(layers, index) {
  const proof = [];
  let idx = index;
  for (let l = 0; l < layers.length - 1; l++) {
    const layer = layers[l];
    const sibling = idx ^ 1;
    if (sibling < layer.length) proof.push(layer[sibling]); // no sibling = carried up, no proof element
    idx = Math.floor(idx / 2);
  }
  return proof;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌳 Building Merkle distribution\n');

  const { drills, qualified, prizePool } = await fetchPayoutData();
  if (!prizePool || prizePool <= 0) {
    console.error('✗ No prize pool set (oilGame/settings.totalOilBudget). Aborting.');
    process.exit(1);
  }

  // Same fixed-rate amounts + cross-scale guard as the push-payout script.
  const payouts = buildPayoutList(drills, qualified, prizePool);
  if (payouts.length === 0) {
    console.log('No payouts to process.');
    process.exit(0);
  }

  // Aggregate by wallet (the contract keys claims by address — one leaf per wallet),
  // summing in integer base units to avoid float drift.
  const byWallet = new Map();
  for (const p of payouts) {
    const wallet = getAddress(p.wallet); // checksummed, validates
    const units = parseUnits(p.amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
    byWallet.set(wallet, (byWallet.get(wallet) || 0n) + units);
  }

  // Stable order, then leaves.
  const entries = [...byWallet.entries()].sort((a, b) => (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1));
  const leaves = entries.map(([wallet, amount]) => leafHash(wallet, amount));
  const { root, layers } = buildTree(leaves);

  let totalAmount = 0n;
  const claims = entries.map(([wallet, amount], i) => {
    totalAmount += amount;
    return {
      wallet,
      amount: amount.toString(),                                  // USDC base units (6 dp) for claim()
      amountUsdc: (Number(amount) / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS),
      proof: getProof(layers, i),
    };
  });

  const output = {
    token: USDC_ADDRESS,
    decimals: USDC_DECIMALS,
    merkleRoot: root,
    totalAmount: totalAmount.toString(),
    totalUsdc: (Number(totalAmount) / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS),
    claimCount: claims.length,
    claims,
  };
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n  merkleRoot:  ${root}`);
  console.log(`  total:       ${output.totalUsdc} USDC across ${claims.length} wallets`);
  console.log(`  token:       ${USDC_ADDRESS} (USDC on Base)`);
  console.log(`\n  → wrote ${OUT_PATH}`);
  console.log('\nNext: deploy OilPayoutDistributor(token, merkleRoot, claimDeadline, owner),');
  console.log(`then transfer ${output.totalUsdc} USDC into it to fund claims.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
