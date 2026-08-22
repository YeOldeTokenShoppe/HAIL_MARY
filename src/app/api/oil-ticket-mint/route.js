import { NextResponse } from "next/server";
import { createHmac, createHash } from "crypto";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import {
  ticketDayKey, dayDiff, seedToInt, mintTicketCells, TICKET_STREAK_GUARANTEE,
} from "@/lib/oilTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DAILY TICKET — mint. One free ticket per player per UTC day, minted lazily
// the first time the player asks for it (idempotent: asking again returns the
// same ticket). Requires a qualified player with a claim (the prizes land on
// the drill doc) — testers only while testing is on, like everything else.
//
// Fairness rides the season's commitment. The ticket seed is
//   HMAC-SHA256(serverSecret, `${userId}:${day}`)
// where serverSecret is the season secret that was committed (sha256 →
// oilGame/settings.seedCommitment) before any ticket existed and is revealed
// at the buzzer. So every ticket is bound to the public commitment and becomes
// verifiable after the reveal — no per-day commit, no per-day reveal that could
// leak the secret. The ticket stores sha256(ticketSeed) for the player to show.
//
// The outcome is decided here and stored with the ticket. The client receives
// the cells (a scratch card in a browser can be peeked at — that is the nature
// of the thing — but it can never be changed: settle recomputes from the stored
// cells). The prize is not returned until the ticket is settled.

const publicTicket = (t) => ({
  day: t.day, seedHash: t.seedHash, cells: t.cells, status: t.status,
  streakAtMint: t.streakAtMint || 0, guaranteeWin: !!t.guaranteeWin,
  ...(t.status === "settled" ? { win: t.win || null, tier: t.tier || null, prize: t.prize || null, drillsAdded: t.drillsAdded || 0 } : {}),
});

export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const db = getAdminDb();
    const [qualSnap, settingsSnap, secretSnap] = await Promise.all([
      db.collection("oilQualified").doc(userId).get(),
      db.collection("oilGame").doc("settings").get(),
      db.collection("oilSecret").doc("seed").get(),
    ]);
    const qual = qualSnap.data() || {};
    const settings = settingsSnap.data() || {};
    if (qual.qualified !== true) {
      return NextResponse.json({ error: "Not qualified — register first." }, { status: 403 });
    }
    if (qual.isTester === true && settings.testingEnabled !== true) {
      return NextResponse.json({ error: "Testing is currently disabled." }, { status: 403 });
    }
    if (settings.ticketsEnabled === false) {
      return NextResponse.json({ error: "Daily tickets are closed right now." }, { status: 403 });
    }
    const serverSecret = secretSnap.exists ? secretSnap.data().serverSecret : null;
    if (!serverSecret) {
      return NextResponse.json({ error: "The season's seed is not committed yet — no tickets until it is." }, { status: 503 });
    }

    const day = ticketDayKey();
    const drillRef = db.collection("oilDrills").doc(userId);
    const ticketRef = drillRef.collection("tickets").doc(day);

    const result = await db.runTransaction(async (tx) => {
      const [tSnap, dSnap] = await Promise.all([tx.get(ticketRef), tx.get(drillRef)]);
      if (tSnap.exists) return { ticket: tSnap.data(), created: false, drill: dSnap.data() || {} };
      if (!dSnap.exists) return { error: "no-claim" };
      const drill = dSnap.data();
      // The streak coming into this ticket: continues only if yesterday's
      // ticket was settled. Fixed at mint — a ticket never re-mints itself.
      const streakAtMint = dayDiff(drill.lastTicketDay, day) === 1 ? (drill.ticketStreak || 0) : 0;
      const guaranteeWin = (streakAtMint + 1) % TICKET_STREAK_GUARANTEE === 0;
      const ticketSeed = createHmac("sha256", serverSecret).update(`${userId}:${day}`).digest("hex");
      const seedHash = createHash("sha256").update(ticketSeed).digest("hex");
      const { cells, win } = mintTicketCells(seedToInt(ticketSeed), { guaranteeWin });
      const doc = {
        userId, day, seedHash, cells,
        win: win ? win.sym : null, tier: win ? win.tier : null, prize: win ? win.prize : null,
        streakAtMint, guaranteeWin, status: "open",
        createdAt: FieldValue.serverTimestamp(),
      };
      tx.set(ticketRef, doc);
      return { ticket: doc, created: true, drill };
    });
    if (result.error === "no-claim") {
      return NextResponse.json({ error: "Claim a plot first — the ticket's prizes land on your rig." }, { status: 403 });
    }

    // The ledger: the last seven settled tickets, newest first (doc ids are day keys).
    const recentSnap = await drillRef.collection("tickets").orderBy("__name__", "desc").limit(9).get();
    const recent = recentSnap.docs.map((d) => d.data()).filter((t) => t.status === "settled").slice(0, 7)
      .map((t) => ({ day: t.day, sym: t.win || null, tier: t.tier || null }));
    const streak = dayDiff(result.drill.lastTicketDay, day) >= 0 && dayDiff(result.drill.lastTicketDay, day) <= 1 ? (result.drill.ticketStreak || 0) : 0;

    return NextResponse.json({ ok: true, created: result.created, ...publicTicket(result.ticket), recent, streak });
  } catch (e) {
    console.error("[oil-ticket-mint]", e);
    return NextResponse.json({ error: e.message || "mint failed" }, { status: 500 });
  }
}
