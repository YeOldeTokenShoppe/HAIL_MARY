import { NextResponse } from "next/server";
import {
  db,
  doc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "@/lib/firebaseServer";
import { PREMIUM_PRICES, getItemCategory } from "@/lib/oilPremium";
import { useFacilitator } from "x402/verify";
import { exact } from "x402/schemes";
import { createFacilitatorConfig } from "@coinbase/x402";

// USDC on Base (mainnet)
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const X402_VERSION = 1;

// CDP facilitator — bridge memory's CDP_API_KEY_NAME/PRIVATE_KEY env names
// to @coinbase/x402's expected CDP_API_KEY_ID/SECRET.
const facilitatorConfig = createFacilitatorConfig(
  process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME,
  process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY,
);
const { verify, settle } = useFacilitator(facilitatorConfig);

function computeTotalUsdc(itemIds) {
  let total = 0;
  for (const id of itemIds) {
    const category = getItemCategory(id);
    if (!category) throw new Error(`Unknown item: ${id}`);
    total += PREMIUM_PRICES[category].usdc;
  }
  return total;
}

function buildPaymentRequirements(itemIds, totalUsdc, resourceUrl) {
  const treasury = process.env.OIL_PURCHASE_TREASURY;
  if (!treasury) throw new Error("OIL_PURCHASE_TREASURY not configured");
  return {
    scheme: "exact",
    network: "base",
    maxAmountRequired: String(totalUsdc * 1_000_000), // USDC has 6 decimals
    resource: resourceUrl,
    description: `Unlock ${itemIds.length} oil rig ${itemIds.length === 1 ? "item" : "items"}`,
    mimeType: "application/json",
    payTo: treasury,
    maxTimeoutSeconds: 120,
    asset: USDC_ADDRESS,
    // EIP-712 domain for USDC on Base — required for transferWithAuthorization
    extra: { name: "USD Coin", version: "2" },
  };
}

export async function POST(req) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { userId, itemIds } = await req.json();
    if (!userId || !itemIds?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let totalUsdc;
    try {
      totalUsdc = computeTotalUsdc(itemIds);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (totalUsdc <= 0) {
      return NextResponse.json({ error: "Nothing to charge" }, { status: 400 });
    }

    const paymentRequirements = buildPaymentRequirements(itemIds, totalUsdc, req.url);

    // No payment header → return 402 with requirements so x402-fetch can sign + retry.
    const paymentHeader = req.headers.get("x-payment");
    if (!paymentHeader) {
      return NextResponse.json(
        {
          x402Version: X402_VERSION,
          error: "X-PAYMENT header required",
          accepts: [paymentRequirements],
        },
        { status: 402 },
      );
    }

    let payload;
    try {
      payload = exact.decodePayment(paymentHeader);
    } catch (err) {
      return NextResponse.json(
        { x402Version: X402_VERSION, error: `Invalid payment payload: ${err.message}` },
        { status: 402 },
      );
    }

    const verifyResult = await verify(payload, paymentRequirements);
    if (!verifyResult.isValid) {
      return NextResponse.json(
        {
          x402Version: X402_VERSION,
          error: `Payment verification failed: ${verifyResult.invalidReason || "unknown"}`,
        },
        { status: 402 },
      );
    }

    // Use the EIP-3009 authorization nonce as the dedupe key — USDC enforces
    // single-use on-chain, so this nonce will never legitimately appear twice.
    const nonce = payload.payload?.authorization?.nonce;
    if (!nonce) {
      return NextResponse.json(
        { error: "Payment payload missing nonce" },
        { status: 400 },
      );
    }

    const userDocRef = doc(db, "oilPurchases", userId);
    const receiptsCol = collection(db, "oilPurchases", userId, "receipts");

    try {
      await runTransaction(db, async (transaction) => {
        const nonceQuery = query(receiptsCol, where("nonce", "==", nonce));
        const nonceSnap = await getDocs(nonceQuery);
        if (!nonceSnap.empty) {
          throw new Error("Payment nonce already used");
        }

        const userSnap = await transaction.get(userDocRef);
        const existing = userSnap.exists() ? userSnap.data()?.unlocked || {} : {};
        const alreadyOwned = itemIds.filter((id) => existing[id]);
        if (alreadyOwned.length > 0) {
          throw new Error(`Already owned: ${alreadyOwned.join(", ")}`);
        }

        const unlockData = { updatedAt: serverTimestamp() };
        for (const id of itemIds) {
          unlockData[`unlocked.${id}`] = true;
        }
        transaction.set(userDocRef, unlockData, { merge: true });

        const receiptRef = doc(receiptsCol);
        transaction.set(receiptRef, {
          nonce,
          itemIds,
          currency: "usdc",
          paymentType: "X402",
          paymentAmount: totalUsdc * 1_000_000,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Settle on-chain via the facilitator. If settle fails after the unlock
    // was granted, we still return the unlock — refund logic would belong
    // in a separate reconciliation pass.
    let settleResult;
    try {
      settleResult = await settle(payload, paymentRequirements);
    } catch (err) {
      console.error("[oil-purchase] Settle failed:", err.message);
      settleResult = { success: false, error: err.message };
    }

    const response = NextResponse.json({ ok: true, itemIds, settle: settleResult });
    if (settleResult?.transaction) {
      response.headers.set(
        "x-payment-response",
        Buffer.from(JSON.stringify(settleResult)).toString("base64"),
      );
    }
    return response;
  } catch (err) {
    console.error("[oil-purchase] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
