import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// USDC on Base — 6 decimals
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TICKET_PRICE_USDC = 10_000_000; // $10 in 6-decimal USDC
const MIN_CONFIRMATIONS = 5;

// ERC-20 Transfer event topic
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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

async function verifyTransaction(txHash) {
  const wallet = process.env.OIL_TICKET_WALLET;
  if (!wallet) throw new Error("OIL_TICKET_WALLET not configured");

  // Get receipt
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

  // Check for USDC transfer to our wallet
  const recipientPadded = "0x" + wallet.slice(2).toLowerCase().padStart(64, "0");
  const usdcTransfer = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === USDC_BASE.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics[2]?.toLowerCase() === recipientPadded
  );

  if (!usdcTransfer) {
    // Fallback: check if it's a native ETH transfer to our wallet
    const tx = await baseRpc("eth_getTransactionByHash", [txHash]);
    if (tx && tx.to?.toLowerCase() === wallet.toLowerCase()) {
      // Accept native ETH — we trust admin set a reasonable price display
      return { type: "ETH", amount: parseInt(tx.value, 16) };
    }
    throw new Error("No valid payment to ticket wallet found in transaction");
  }

  const amount = parseInt(usdcTransfer.data, 16);
  if (amount < TICKET_PRICE_USDC) {
    throw new Error(`Payment too low: got ${amount / 1e6} USDC, need ${TICKET_PRICE_USDC / 1e6}`);
  }

  return { type: "USDC", amount };
}

export async function POST(req) {
  try {
    const { userId, clerkName, clerkAvatar, txHash } = await req.json();
    if (!userId || !txHash) {
      return NextResponse.json({ error: "Missing userId or txHash" }, { status: 400 });
    }

    // Verify the on-chain payment
    let payment;
    try {
      payment = await verifyTransaction(txHash);
    } catch (err) {
      return NextResponse.json({ error: `Payment verification failed: ${err.message}` }, { status: 400 });
    }

    const db = getAdminDb();
    const settingsRef = db.collection("oilGame").doc("settings");
    const ticketsCol = db.collection("oilTickets");

    const result = await db.runTransaction(async (t) => {
      // Uniqueness checks via queries — Admin SDK supports query reads in transactions
      const existingSnap = await t.get(ticketsCol.where("userId", "==", userId));
      if (!existingSnap.empty) {
        throw new Error("User already has a ticket");
      }

      const txSnap = await t.get(ticketsCol.where("txHash", "==", txHash));
      if (!txSnap.empty) {
        throw new Error("Transaction hash already used");
      }

      const settingsSnap = await t.get(settingsRef);
      const currentCount = settingsSnap.exists ? (settingsSnap.data().ticketCount || 0) : 0;
      const purchaseOrder = currentCount + 1;

      t.update(settingsRef, { ticketCount: purchaseOrder });

      const ticketRef = ticketsCol.doc();
      t.set(ticketRef, {
        userId,
        clerkName: clerkName || "Anonymous",
        clerkAvatar: clerkAvatar || null,
        purchaseOrder,
        purchasedAt: FieldValue.serverTimestamp(),
        txHash,
        paymentType: payment.type,
        paymentAmount: payment.amount,
        plotCol: null,
        plotRow: null,
        pickedAt: null,
      });

      return purchaseOrder;
    });

    return NextResponse.json({ ok: true, purchaseOrder: result });
  } catch (err) {
    console.error("[oil-ticket] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
