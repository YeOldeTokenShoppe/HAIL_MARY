import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { logTimeline } from "@/lib/oilTimeline";
import { MAX_BONUS_DRILLS } from "@/lib/oilBonusMath";
import { ticketDayKey, isDayKey, dayDiff, evaluateCells, isValidLayout } from "@/lib/oilTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DAILY TICKET — settle. The client only says "scratched"; the outcome is
// recomputed from the cells stored at mint — never from anything the client
// claims — and the prize is applied in one transaction:
//   • bonus drills → oilDrills.bonusDrills (capped at MAX_BONUS_DRILLS like
//     every other bonus) + oilDrills.bonusFromTickets, so the rig card can
//     break the source out instead of lumping it under "referrals/hunts";
//   • supplies (tonic, coupon) → oilDrills.supplies.{name};
//   • the jackpot's sidequest → oilDrills.pendingQuests.
// The streak counts consecutive UTC days with a settled ticket. Wins post to
// the FIELD ACTIVITY feed; a loss stays on the ticket. Settling twice is a
// no-op that returns the settled ticket.

const publicTicket = (t) => ({
  day: t.day, seedHash: t.seedHash, cells: t.cells, status: t.status,
  streakAtMint: t.streakAtMint || 0, guaranteeWin: !!t.guaranteeWin,
  win: t.win || null, tier: t.tier || null, prize: t.prize || null, drillsAdded: t.drillsAdded || 0,
});

export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const day = isDayKey(body.day) ? body.day : ticketDayKey();
    if (dayDiff(day, ticketDayKey()) < 0) return NextResponse.json({ error: "That ticket is from the future." }, { status: 400 });

    const db = getAdminDb();
    const drillRef = db.collection("oilDrills").doc(userId);
    const ticketRef = drillRef.collection("tickets").doc(day);

    const out = await db.runTransaction(async (tx) => {
      const [tSnap, dSnap] = await Promise.all([tx.get(ticketRef), tx.get(drillRef)]);
      if (!tSnap.exists) return { error: "no-ticket" };
      const t = tSnap.data();
      const drill = dSnap.data() || {};
      if (t.status === "settled") return { ticket: t, already: true, streak: drill.ticketStreak || 0 };
      if (!isValidLayout(t.cells)) return { error: "corrupt" };

      const { sym, win } = evaluateCells(t.cells);
      const update = {};
      // Streak: continues from yesterday, otherwise restarts at 1.
      const ticketStreak = dayDiff(drill.lastTicketDay, day) === 1 ? (drill.ticketStreak || 0) + 1 : 1;
      update.lastTicketDay = day;
      update.ticketStreak = ticketStreak;
      update.ticketStreakBest = Math.max(drill.ticketStreakBest || 0, ticketStreak);
      update.ticketsSettled = FieldValue.increment(1);
      let drillsAdded = 0;
      if (win?.bonusDrills) {
        const cur = drill.bonusDrills || 0;
        drillsAdded = Math.max(0, Math.min(win.bonusDrills, MAX_BONUS_DRILLS - cur));
        if (drillsAdded > 0) {
          update.bonusDrills = cur + drillsAdded;
          update.bonusFromTickets = (drill.bonusFromTickets || 0) + drillsAdded;
        }
      }
      if (win?.supply) update[`supplies.${win.supply}`] = FieldValue.increment(1);
      if (win?.quest) update.pendingQuests = FieldValue.arrayUnion({ id: `${win.quest}_${day}`, source: "daily_ticket", day });
      tx.set(drillRef, update, { merge: true });

      const settled = {
        status: "settled", settledAt: FieldValue.serverTimestamp(),
        win: sym, tier: win ? win.tier : null, prize: win ? win.prize : null, drillsAdded,
      };
      tx.set(ticketRef, settled, { merge: true });
      return { ticket: { ...t, ...settled }, already: false, streak: ticketStreak, drillsAdded, username: drill.username || null };
    });
    if (out.error === "no-ticket") return NextResponse.json({ error: "No ticket for that day." }, { status: 404 });
    if (out.error === "corrupt") return NextResponse.json({ error: "That ticket is not valid." }, { status: 409 });

    if (!out.already && out.ticket.win) {
      const w = out.ticket;
      const symName = w.win.replace(/^./, (c) => c.toUpperCase());
      await logTimeline(db, {
        type: w.tier === "jackpot" ? "ticket_jackpot" : "ticket",
        userId, username: out.username,
        detail: `three ${symName.toLowerCase()}s · ${String(w.prize).toLowerCase()}`,
      });
    }

    return NextResponse.json({ ok: true, already: out.already, ...publicTicket(out.ticket), streak: out.streak, drillsAdded: out.drillsAdded || 0 });
  } catch (e) {
    console.error("[oil-ticket-settle]", e);
    return NextResponse.json({ error: e.message || "settle failed" }, { status: 500 });
  }
}
