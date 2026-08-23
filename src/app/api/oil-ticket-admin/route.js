import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { ticketDayKey, hashStr, mintTicketCells, TICKET_SYMBOLS, TICKET_PRIZE_BY_SYM } from "@/lib/oilTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST /api/oil-ticket-admin ──  admin password; QA only.
// Mints an EXTRA ticket for a player with a chosen outcome, as
// oilDrills/{userId}/tickets/{day}_t{n}, flagged `test: true`. It takes the
// stage in the player's DAILY TICKET panel once today's daily is settled, pays
// its prize for real when scratched (so every prize can be watched landing on
// the rig), and never touches the streak or the ledger. Not seeded from the
// season secret — its fingerprint is literally "test" — so it can never be
// mistaken for a fair ticket.
//   body: { adminPassword, userId, outcome }   outcome ∈ prize symbol | "lose"

function checkAuth(pw) {
  const correct = process.env.ADMIN_PASSWORD;
  return !!correct && pw === correct;
}

export async function POST(req) {
  try {
    const { adminPassword, userId, outcome } = await req.json().catch(() => ({}));
    if (!checkAuth(adminPassword)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (typeof userId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    const forced = outcome === "lose" ? "lose" : (TICKET_PRIZE_BY_SYM[outcome] ? outcome : null);
    if (!forced) return NextResponse.json({ error: `outcome must be one of ${Object.keys(TICKET_PRIZE_BY_SYM).join(", ")} or "lose"` }, { status: 400 });
    if (!TICKET_SYMBOLS.includes(forced) && forced !== "lose") return NextResponse.json({ error: "bad outcome" }, { status: 400 });

    const db = getAdminDb();
    const drillRef = db.collection("oilDrills").doc(userId);
    const dSnap = await drillRef.get();
    if (!dSnap.exists) return NextResponse.json({ error: "That player has no rig yet." }, { status: 404 });

    const day = ticketDayKey();
    const existing = await drillRef.collection("tickets").get();
    const n = existing.docs.filter((d) => d.id.startsWith(`${day}_t`)).length + 1;
    const id = `${day}_t${n}`;
    const { cells, win } = mintTicketCells(hashStr(`${id}:${userId}:${Date.now()}`), { forced });
    const doc = {
      userId, day, id, test: true, forced, seedHash: "test", cells,
      win: win ? win.sym : null, tier: win ? win.tier : null, prize: win ? win.prize : null,
      streakAtMint: 0, guaranteeWin: false, status: "open",
      createdAt: FieldValue.serverTimestamp(),
    };
    await drillRef.collection("tickets").doc(id).set(doc);
    return NextResponse.json({ ok: true, id, outcome: forced, cells });
  } catch (e) {
    console.error("[oil-ticket-admin]", e);
    return NextResponse.json({ error: e.message || "mint failed" }, { status: 500 });
  }
}
