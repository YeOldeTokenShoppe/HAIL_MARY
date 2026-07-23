import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { dateSeed } from "@/game/terminal-traders/docketRun";

export const runtime = "nodejs";

// ── GET /api/tcg-docket-leaderboard?seed=NNN ──
//
// The Daily Deal Flow leaderboard (CASE_TABLE.md §6) — the read side of the
// docketRewards rail. tcg-docket-reward writes one doc per user per seed at
// claim time (finalBook / won / patron); this ranks a day's docs by
// finalBook and returns the top of the table.
//
// - `seed` optional; defaults to today's UTC docket. Only today's or
//   yesterday's seed is queryable — mirrors the claim window and keeps the
//   scan bounded. Historical boards can widen this once there's a UI for it.
// - Equality-only Firestore query (no orderBy) so no composite index is
//   required; sorted in memory. Volume is bounded at one doc per user per
//   day, capped defensively at MAX_DOCS.
// - finalBook is CLIENT-ATTESTED until transcript replay lands (§4.10) —
//   the leaderboard inherits exactly the reward rail's trust envelope,
//   nothing more.
// - Handles are pseudonymous (stable hash of the Clerk userId): no PII in
//   the response. The caller's own row is flagged `you` when the request
//   carries a session; auth is OPTIONAL — signed-out gets the same board.

const MAX_DOCS = 500;
const TOP_N = 20;

// FNV-1a over the userId → 4 chars of a confusion-free alphabet. Stable per
// user across days, meaningless to everyone else.
function handleFor(userId) {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[(h >>> (i * 5)) & 31];
  return `TRADER-${out}`;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const now = new Date();
    const todaySeed = dateSeed(now);
    const validSeeds = [todaySeed, dateSeed(new Date(now.getTime() - 24 * 60 * 60 * 1000))];
    const seedParam = url.searchParams.get("seed");
    const seed = seedParam == null ? todaySeed : Math.floor(Number(seedParam));
    if (!validSeeds.includes(seed)) {
      return NextResponse.json({ error: "not-a-live-docket", validSeeds }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "firestore-unavailable" }, { status: 503 });

    const callerId = await authedUserId(request).catch(() => null);

    const snap = await db.collection("docketRewards").where("seed", "==", seed).limit(MAX_DOCS).get();
    const rows = snap.docs
      .map((d) => d.data())
      .filter((r) => r && typeof r.userId === "string")
      .map((r) => ({
        userId: r.userId,
        finalBook: Number.isFinite(Number(r.finalBook)) ? Number(r.finalBook) : null,
        won: r.won === true,
        patron: typeof r.patron === "string" ? r.patron : null,
      }))
      .sort((a, b) => {
        // Ranked by finalBook; runs that never reported one sink to the end.
        if (a.finalBook == null && b.finalBook == null) return 0;
        if (a.finalBook == null) return 1;
        if (b.finalBook == null) return -1;
        return b.finalBook - a.finalBook;
      });

    const entries = rows.slice(0, TOP_N).map((r, i) => ({
      rank: i + 1,
      handle: handleFor(r.userId),
      finalBook: r.finalBook,
      won: r.won,
      patron: r.patron,
      you: callerId != null && r.userId === callerId,
    }));

    // The caller's own standing even when they're below the fold.
    let you = null;
    if (callerId) {
      const idx = rows.findIndex((r) => r.userId === callerId);
      if (idx !== -1) you = { rank: idx + 1, finalBook: rows[idx].finalBook };
    }

    return NextResponse.json({ seed, total: rows.length, entries, you });
  } catch (err) {
    console.error("[tcg-docket-leaderboard] failed:", err);
    return NextResponse.json({ error: "leaderboard-failed" }, { status: 500 });
  }
}
