import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { authedUserId } from "@/lib/oilAuth";
import { grantCardsInTx } from "@/lib/tcgCollection";
import { openPacks, docketCoin } from "@/game/terminal-traders/packs";
import { dateSeed } from "@/game/terminal-traders/docketRun";

export const runtime = "nodejs";

// ── POST /api/tcg-docket-reward  { seed, won, finalBook?, avgBrier?, patron? } ──
//
// The engagement reward rail (CASE_TABLE.md §6 Phase 1 + §4.6 coin
// trophies). Genesis is earned entirely through play (GENESIS.md §6):
//   - COMPLETING the Daily Docket alive grants the day's DOSSIER COIN —
//     the same coin for every player that day (deterministic from the
//     seed via docketCoin; foil coins stay pack-exclusive).
//   - BEATING THE COUNCIL additionally grants one sealed Genesis pack
//     (contents seeded `docket:<seed>:<userId>` — deterministic,
//     re-derivable, can't be rerolled).
// Both ride the same audit trail as every other grant (cardGrants).
//
// TRUST LEVEL (documented deliberately): the outcome is CLIENT-ATTESTED.
// Until Phase 3's transcript replay lands (§4.10 — the pure engine can
// re-run a docket from seed + action script and verify the claimed
// standings), the server enforces only:
//   1. Clerk identity (never a userId from the body).
//   2. The seed must be the current or previous UTC Daily Docket — no
//      claiming arbitrary seeds, no banking old runs.
//   3. One claim per user per seed (docketRewards/{userId_seed}, atomic
//      with the grant) — so a dishonest claim yields at most what one
//      honest daily win yields: one pack + one coin per day. That bounds
//      abuse to the daily-reward envelope while the rail gets proven.
// A day is one shot: a completion claim consumes the seed's claim, so a
// later "actually I won" replay can't upgrade it. finalBook / avgBrier /
// patron are recorded for the audit trail and the future replay check.

export async function POST(request) {
  try {
    const userId = await authedUserId(request);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const seed = Math.floor(Number(body.seed));
    if (!Number.isFinite(seed)) {
      return NextResponse.json({ error: "invalid-seed" }, { status: 400 });
    }

    // The claimable window: today's docket, or yesterday's for a table that
    // crossed UTC midnight mid-run.
    const now = new Date();
    const validSeeds = [dateSeed(now), dateSeed(new Date(now.getTime() - 24 * 60 * 60 * 1000))];
    if (!validSeeds.includes(seed)) {
      return NextResponse.json({ error: "not-a-live-docket", validSeeds }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "firestore-unavailable" }, { status: 503 });

    const won = body.won === true;
    const coinId = docketCoin(seed);
    const { packs, counts } = won
      ? openPacks(`docket:${seed}:${userId}`, 1)
      : { packs: [], counts: {} };
    const grantCounts = { ...counts, [coinId]: (counts[coinId] || 0) + 1 };
    const claimRef = db.collection("docketRewards").doc(`${userId}_${seed}`);

    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(claimRef);
        if (existing.exists) {
          const dup = new Error("already-claimed");
          dup.code = "already-claimed";
          throw dup;
        }
        tx.set(claimRef, {
          userId,
          seed,
          won,
          coin: coinId,
          pack: packs[0] || null,
          // client-attested run summary — advisory until transcript replay
          finalBook: Number.isFinite(Number(body.finalBook)) ? Number(body.finalBook) : null,
          avgBrier: Number.isFinite(Number(body.avgBrier)) ? Number(body.avgBrier) : null,
          patron: typeof body.patron === "string" ? body.patron.slice(0, 24) : null,
          claimedAt: FieldValue.serverTimestamp(),
        });
        grantCardsInTx(tx, db, userId, grantCounts, won ? `docket-win:${seed}` : `docket-complete:${seed}`);
      });
    } catch (err) {
      if (err.code === "already-claimed") {
        return NextResponse.json({ error: "already-claimed" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true, seed, won, coin: coinId, pack: packs[0] || null });
  } catch (err) {
    console.error("[tcg-docket-reward] failed:", err);
    return NextResponse.json({ error: "docket-reward-failed" }, { status: 500 });
  }
}
