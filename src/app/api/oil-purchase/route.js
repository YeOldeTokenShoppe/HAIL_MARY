import { NextResponse } from "next/server";
import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "@/lib/firebaseServer";
import { PREMIUM_PRICES, getItemCategory } from "@/lib/oilPremium";
import { getRL80Price } from "@/lib/oilPrice";

// Contracts on Base
const RL80_ADDRESS = "0x30D01555d88c76500a82754A1D53cAc082A6CB75";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dead";

// ERC-20 Transfer event topic
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const MIN_CONFIRMATIONS = 5;

async function baseRpc(method, params) {
  const url = process.env.BASE_RPC_URL;
  if (!url) throw new Error("BASE_RPC_URL not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function verifyTransaction(txHash, itemIds, currency) {
  const receipt = await baseRpc("eth_getTransactionReceipt", [txHash]);
  if (!receipt) throw new Error("Transaction not found or not yet mined");
  if (receipt.status !== "0x1") throw new Error("Transaction reverted");

  // Check confirmations
  const currentBlock = await baseRpc("eth_blockNumber", []);
  const txBlock = parseInt(receipt.blockNumber, 16);
  const headBlock = parseInt(currentBlock, 16);
  if (headBlock - txBlock < MIN_CONFIRMATIONS) {
    throw new Error(`Need ${MIN_CONFIRMATIONS} confirmations, have ${headBlock - txBlock}`);
  }

  // Calculate total USD across all items
  let totalUsdc = 0;
  for (const itemId of itemIds) {
    const category = getItemCategory(itemId);
    if (!category) throw new Error(`Unknown item: ${itemId}`);
    totalUsdc += PREMIUM_PRICES[category].usdc;
  }

  if (currency === "rl80") {
    // Verify RL80 burn — Transfer to address(0) or 0x...dead
    const burnPadded0 = "0x" + "0".repeat(64);
    const burnPaddedDead = "0x" + BURN_ADDRESS.slice(2).toLowerCase().padStart(64, "0");

    const burnLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === RL80_ADDRESS.toLowerCase() &&
        log.topics[0] === TRANSFER_TOPIC &&
        (log.topics[2]?.toLowerCase() === burnPadded0 ||
         log.topics[2]?.toLowerCase() === burnPaddedDead)
    );

    if (!burnLog) throw new Error("No RL80 burn found in transaction");

    // RL80 has 18 decimals
    const amount = BigInt(burnLog.data);
    const burnedTokens = Number(amount / BigInt(10 ** 18));

    // Dynamic pricing: fetch live RL80/USD price from pool
    const { rl80PriceUsd } = await getRL80Price();
    const requiredTokens = Math.ceil(totalUsdc / rl80PriceUsd);
    // Allow 10% tolerance for price movement between quote and execution
    const minRequired = Math.floor(requiredTokens * 0.9);

    if (burnedTokens < minRequired) {
      throw new Error(`Burn too low: got ${burnedTokens.toLocaleString()} RL80, need ~${requiredTokens.toLocaleString()} ($${totalUsdc})`);
    }

    return { type: "RL80_BURN", amount: burnedTokens, usdValue: totalUsdc };
  }

  if (currency === "usdc") {
    // Verify USDC transfer to treasury
    const treasury = process.env.OIL_PURCHASE_TREASURY;
    if (!treasury) throw new Error("OIL_PURCHASE_TREASURY not configured");

    const recipientPadded = "0x" + treasury.slice(2).toLowerCase().padStart(64, "0");
    const usdcLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
        log.topics[0] === TRANSFER_TOPIC &&
        log.topics[2]?.toLowerCase() === recipientPadded
    );

    if (!usdcLog) throw new Error("No USDC transfer to treasury found in transaction");

    // USDC has 6 decimals
    const amount = parseInt(usdcLog.data, 16);
    const required = totalUsdc * 1_000_000;
    if (amount < required) {
      throw new Error(`Payment too low: got $${(amount / 1e6).toFixed(2)}, need $${totalUsdc}`);
    }

    return { type: "USDC", amount };
  }

  throw new Error(`Unknown currency: ${currency}`);
}

export async function POST(req) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { userId, txHash, itemIds, currency } = await req.json();
    if (!userId || !txHash || !itemIds?.length || !currency) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the on-chain payment covers total for all items
    let payment;
    try {
      payment = await verifyTransaction(txHash, itemIds, currency);
    } catch (err) {
      return NextResponse.json({ error: `Payment verification failed: ${err.message}` }, { status: 400 });
    }

    // Atomic write with replay & duplicate prevention
    const userDocRef = doc(db, "oilPurchases", userId);
    const receiptsCol = collection(db, "oilPurchases", userId, "receipts");

    await runTransaction(db, async (transaction) => {
      // Check for duplicate txHash
      const txQuery = query(receiptsCol, where("txHash", "==", txHash));
      const txSnap = await getDocs(txQuery);
      if (!txSnap.empty) {
        throw new Error("Transaction hash already used");
      }

      // Check if any already owned
      const userSnap = await transaction.get(userDocRef);
      const existing = userSnap.exists() ? userSnap.data()?.unlocked || {} : {};
      const alreadyOwned = itemIds.filter((id) => existing[id]);
      if (alreadyOwned.length > 0) {
        throw new Error(`Already owned: ${alreadyOwned.join(", ")}`);
      }

      // Write unlocks for all items
      const unlockData = { updatedAt: serverTimestamp() };
      for (const id of itemIds) {
        unlockData[`unlocked.${id}`] = true;
      }
      transaction.set(userDocRef, unlockData, { merge: true });

      // Write receipt to subcollection
      const receiptRef = doc(receiptsCol);
      transaction.set(receiptRef, {
        txHash,
        itemIds,
        currency,
        paymentType: payment.type,
        paymentAmount: payment.amount,
        createdAt: serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true, itemIds });
  } catch (err) {
    console.error("[oil-purchase] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
