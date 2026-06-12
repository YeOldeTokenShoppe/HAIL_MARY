// app/api/burn-offering/route.js
//
// Credits a votive burn offering: the client burns RL80 by transferring
// to the dead address (a pure burn — no funds ever flow to us), then
// POSTs the tx hash here. This route is the ONLY writer of burn credit:
// it verifies the transfer on-chain via the receipt and writes the
// Firestore credit with the ADMIN SDK. firestore.rules block client-SDK
// writes of every burn field, so a forged "I burned 999M" write is
// impossible — the flex in the phone feed / VigilTicker always traces
// back to a real on-chain burn.
//
// Trust model: the only client input is the tx hash. The burner's
// identity (receipt's `from`) and the amount (Transfer event value) come
// from the chain itself, and the landing page's userId IS the lowercased
// wallet address, so the credit can't be pointed at someone else's
// candle. Idempotency: one credit per tx hash, enforced in a Firestore
// transaction on shrineBurns/{txHash}.

import { NextResponse } from 'next/server';
import { erc20Abi, parseEventLogs } from 'viem';
import { publicClient } from '@/lib/viemClient';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { RL80_ADDRESS, BURN_ADDRESS } from '@/lib/contracts';

// Burns older than this can't be claimed as a fresh votive offering —
// without it, someone could dig up a months-old burn tx and have it
// scroll across the homepage as if it just happened. (It's still their
// own burn either way; this is about feed honesty, not theft.)
const MAX_BURN_AGE_MS = 2 * 60 * 60 * 1000;

export async function POST(request) {
  try {
    const { txHash } = await request.json();

    if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'invalid-tx-hash' }, { status: 400 });
    }
    const hash = txHash.toLowerCase();

    // The client POSTs immediately after the wallet returns the hash, so
    // wait for the receipt here (Base blocks land in ~2s).
    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });
    } catch (err) {
      return NextResponse.json(
        { error: 'tx-not-confirmed', retryable: true, message: err.message },
        { status: 504 },
      );
    }

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'tx-reverted' }, { status: 400 });
    }

    // The burn must be an RL80 Transfer to the dead address. Sum all
    // matching logs (fee-on-transfer style tokens can emit several).
    const transfers = parseEventLogs({
      abi: erc20Abi,
      logs: receipt.logs,
      eventName: 'Transfer',
    }).filter(
      (log) =>
        log.address.toLowerCase() === RL80_ADDRESS.toLowerCase() &&
        log.args.to.toLowerCase() === BURN_ADDRESS.toLowerCase(),
    );

    if (transfers.length === 0) {
      return NextResponse.json({ error: 'no-rl80-burn-in-tx' }, { status: 400 });
    }

    const burner = transfers[0].args.from.toLowerCase();
    const totalWei = transfers.reduce((sum, log) => sum + log.args.value, 0n);
    // Whole tokens — RL80 amounts are memecoin-scale, sub-token dust is
    // display noise.
    const tokens = Number(totalWei / 10n ** 18n);
    if (tokens < 1) {
      return NextResponse.json({ error: 'burn-too-small' }, { status: 400 });
    }

    // Freshness: receipt → block timestamp.
    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    });
    const burnedAtMs = Number(block.timestamp) * 1000;
    if (Date.now() - burnedAtMs > MAX_BURN_AGE_MS) {
      return NextResponse.json({ error: 'burn-too-old' }, { status: 400 });
    }

    const adb = getAdminDb();
    if (!adb) {
      return NextResponse.json({ error: 'firestore-unavailable' }, { status: 503 });
    }

    // userId on the landing page == lowercased wallet address, so the
    // receipt's `from` addresses the burner's own candle + stats docs.
    const burnRef = adb.collection('shrineBurns').doc(hash);
    const candleRef = adb.collection('shrineCandles').doc(burner);
    const statsRef = adb.collection('userStats').doc(burner);

    try {
      await adb.runTransaction(async (tx) => {
        const existing = await tx.get(burnRef);
        if (existing.exists) {
          const dup = new Error('already-credited');
          dup.code = 'already-credited';
          throw dup;
        }
        tx.set(burnRef, {
          txHash: hash,
          userId: burner,
          tokensBurned: tokens,
          weiBurned: totalWei.toString(),
          blockNumber: Number(receipt.blockNumber),
          burnedAt: FieldValue.serverTimestamp(),
          burnedAtChainMs: burnedAtMs,
        });
        // Attaches to the CURRENT candle; lightCandle's full overwrite on
        // re-light resets it, which is the intended semantics — each new
        // candle starts unburned. Lifetime totals live in userStats.
        tx.set(
          candleRef,
          {
            tokensBurned: FieldValue.increment(tokens),
            lastBurnTxHash: hash,
            lastBurnAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        // Feeds the Illumin80 top-burners leaderboard.
        tx.set(
          statsRef,
          {
            userId: burner,
            totalBurned: FieldValue.increment(tokens),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
    } catch (err) {
      if (err.code === 'already-credited') {
        // Idempotent success — a retry after a flaky response shouldn't
        // read as failure to the user whose burn IS credited.
        return NextResponse.json({
          success: true,
          alreadyCredited: true,
          tokensBurned: tokens,
        });
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      tokensBurned: tokens,
      userId: burner,
      txHash: hash,
    });
  } catch (error) {
    console.error('[burn-offering] error:', error);
    return NextResponse.json(
      { error: 'credit-failed', retryable: true, message: error.message },
      { status: 500 },
    );
  }
}
