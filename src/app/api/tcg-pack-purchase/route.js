import { NextResponse } from "next/server";
import { erc20Abi, parseEventLogs } from "viem";
import { publicClient } from "@/lib/viemClient";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { authedUserId } from "@/lib/oilAuth";
import { getRL80Price } from "@/lib/oilPrice";
import { RL80_ADDRESS, BURN_ADDRESS } from "@/lib/contracts";
import { grantCardsInTx } from "@/lib/tcgCollection";
import { openPacks, packsForUsd, PACK_PRICE_USD, MAX_PACKS_PER_TX } from "@/game/terminal-traders/packs";

export const runtime = "nodejs";

// ── POST /api/tcg-pack-purchase  { txHash } ──
//
// The RL80 burn rail for Genesis booster packs. Same trust model as
// burn-offering: the client burns RL80 to the dead address (a pure burn — no
// funds flow to the project), then POSTs the tx hash. The only client inputs
// are the tx hash and the Clerk session; amount and burner come from the
// verified on-chain receipt, pack count from the burn's USD value at current
// pool price, and pack CONTENTS from an RNG seeded by the tx hash itself —
// deterministic, auditable, and impossible to reroll.
//
// Claim binding: packs credit the authenticated Clerk user. If the user has a
// registered oil wallet (oilQualified/{userId}.walletAddress), the burn must
// come from that wallet; otherwise first-claim-wins on the tx hash (the
// idempotency doc), which matches the shrine-burn model where users submit
// their own hash seconds after the wallet returns it.

const MAX_BURN_AGE_MS = 2 * 60 * 60 * 1000;

export async function POST(request) {
  try {
    const userId = await authedUserId(request);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { txHash } = await request.json();
    if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "invalid-tx-hash" }, { status: 400 });
    }
    const hash = txHash.toLowerCase();

    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
    } catch (err) {
      return NextResponse.json(
        { error: "tx-not-confirmed", retryable: true, message: err.message },
        { status: 504 },
      );
    }
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "tx-reverted" }, { status: 400 });
    }

    // Must be an RL80 Transfer to the dead address; sum all matching logs.
    const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: "Transfer" })
      .filter(
        (log) =>
          log.address.toLowerCase() === RL80_ADDRESS.toLowerCase() &&
          log.args.to.toLowerCase() === BURN_ADDRESS.toLowerCase(),
      );
    if (transfers.length === 0) {
      return NextResponse.json({ error: "no-rl80-burn-in-tx" }, { status: 400 });
    }
    const burner = transfers[0].args.from.toLowerCase();
    const totalWei = transfers.reduce((sum, log) => sum + log.args.value, 0n);
    const tokens = Number(totalWei / 10n ** 18n);
    if (tokens < 1) {
      return NextResponse.json({ error: "burn-too-small" }, { status: 400 });
    }

    // Freshness — stale burns can't be recycled into packs.
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const burnedAtMs = Number(block.timestamp) * 1000;
    if (Date.now() - burnedAtMs > MAX_BURN_AGE_MS) {
      return NextResponse.json({ error: "burn-too-old" }, { status: 400 });
    }

    // Price the burn in USD. A price-feed failure must refuse (retryable),
    // never guess — pack counts ride on this number.
    let priceUsd;
    try {
      const price = await getRL80Price();
      priceUsd = price?.rl80PriceUsd;
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error("bad price");
    } catch (err) {
      return NextResponse.json({ error: "price-unavailable", retryable: true }, { status: 503 });
    }
    const burnedUsd = tokens * priceUsd;
    const packCount = packsForUsd(burnedUsd);
    if (packCount < 1) {
      return NextResponse.json(
        {
          error: "burn-below-pack-price",
          burnedUsd: Number(burnedUsd.toFixed(4)),
          packPriceUsd: PACK_PRICE_USD,
        },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "firestore-unavailable" }, { status: 503 });

    // Wallet binding when one is registered.
    const qualified = await db.collection("oilQualified").doc(userId).get();
    const registeredWallet = qualified.exists
      ? String(qualified.data()?.walletAddress || "").toLowerCase()
      : null;
    if (registeredWallet && registeredWallet !== burner) {
      return NextResponse.json({ error: "burn-not-from-registered-wallet" }, { status: 403 });
    }

    // Contents derive from the tx hash — recomputable by anyone, unchangeable
    // by anyone.
    const { packs, counts } = openPacks(hash, packCount);

    const claimRef = db.collection("packBurns").doc(hash);
    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(claimRef);
        if (existing.exists) {
          const dup = new Error("already-claimed");
          dup.code = "already-claimed";
          throw dup;
        }
        tx.set(claimRef, {
          txHash: hash,
          userId,
          burnerWallet: burner,
          tokensBurned: tokens,
          weiBurned: totalWei.toString(),
          burnedUsd: Number(burnedUsd.toFixed(4)),
          rl80PriceUsd: priceUsd,
          packCount,
          packs,
          blockNumber: Number(receipt.blockNumber),
          burnedAtChainMs: burnedAtMs,
          claimedAt: FieldValue.serverTimestamp(),
        });
        grantCardsInTx(tx, db, userId, counts, `pack:genesis:${hash}`);
      });
    } catch (err) {
      if (err.code === "already-claimed") {
        return NextResponse.json({ error: "already-claimed" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({
      ok: true,
      packCount,
      packs,
      tokensBurned: tokens,
      burnedUsd: Number(burnedUsd.toFixed(4)),
      maxPacksPerTx: MAX_PACKS_PER_TX,
    });
  } catch (err) {
    console.error("[tcg-pack-purchase] failed:", err);
    return NextResponse.json({ error: "pack-purchase-failed" }, { status: 500 });
  }
}
