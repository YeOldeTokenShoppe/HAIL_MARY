import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { logTimeline } from "@/lib/oilTimeline";
import { MAX_BONUS_DRILLS } from "@/lib/oilBonusMath";
import {
  ticketDayKey, isDayKey, isTicketId, isTestTicketId, dayDiff, evaluateCells, isValidLayout,
  COUPON_PCT, COUPON_DAYS, couponValid,
} from "@/lib/oilTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DAILY TICKET — settle. The client only says "scratched"; the outcome is
// recomputed from the cells stored at mint — never from anything the client
// claims — and the prize is applied in one transaction:
//   • bonus drills → oilDrills.bonusDrills (capped at MAX_BONUS_DRILLS like
//     every other bonus) + oilDrills.bonusFromTickets, so the rig card can
//     break the source out instead of lumping it under "referrals/hunts";
//   • a claim jump → oilDrills.bonusClaimJumps (an extra free rig move);
//   • a tonic → oilDrills.supplies.tonic (the strike tick spends one to drill
//     two layers in a single strike);
//   • a coupon → oilDrills.coupon { pct, expiresAt, issuedDay } — COUPON_PCT
//     off one Pimp My Pump purchase, COUPON_DAYS to use it (a second coupon
//     extends the first; there is only ever one live coupon).
// The streak counts consecutive UTC days with a settled DAILY ticket; admin
// test tickets (`${day}_t${n}`) pay their prize but never touch the streak or
// the ledger. Wins post to the FIELD ACTIVITY feed; a loss stays on the
// ticket. Settling twice is a no-op that returns the settled ticket.

const publicTicket = (t) => ({
  id: t.id || t.day, day: t.day, seedHash: t.seedHash, cells: t.cells, status: t.status, test: !!t.test,
  streakAtMint: t.streakAtMint || 0, guaranteeWin: !!t.guaranteeWin,
  win: t.win || null, tier: t.tier || null, prize: t.prize || null, drillsAdded: t.drillsAdded || 0,
});

export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = isTicketId(body.id) ? body.id : isDayKey(body.day) ? body.day : ticketDayKey();
    const today = ticketDayKey();
    if (dayDiff(id.slice(0, 8), today) < 0) return NextResponse.json({ error: "That ticket is from the future." }, { status: 400 });

    const db = getAdminDb();
    const drillRef = db.collection("oilDrills").doc(userId);
    const ticketRef = drillRef.collection("tickets").doc(id);

    const out = await db.runTransaction(async (tx) => {
      const [tSnap, dSnap] = await Promise.all([tx.get(ticketRef), tx.get(drillRef)]);
      if (!tSnap.exists) return { error: "no-ticket" };
      const t = { id, ...tSnap.data() };
      const drill = dSnap.data() || {};
      if (t.status === "settled") return { ticket: t, already: true, streak: drill.ticketStreak || 0 };
      if (!isValidLayout(t.cells)) return { error: "corrupt" };

      const { sym, win } = evaluateCells(t.cells);
      const isTest = isTestTicketId(id) || t.test === true;
      const day = t.day || id.slice(0, 8);
      const update = {};

      // Streak: daily tickets only — continues from yesterday, otherwise restarts at 1.
      let ticketStreak = drill.ticketStreak || 0;
      if (!isTest) {
        ticketStreak = dayDiff(drill.lastTicketDay, day) === 1 ? (drill.ticketStreak || 0) + 1 : 1;
        update.lastTicketDay = day;
        update.ticketStreak = ticketStreak;
        update.ticketStreakBest = Math.max(drill.ticketStreakBest || 0, ticketStreak);
        update.ticketsSettled = FieldValue.increment(1);
      }

      // Prizes.
      let drillsAdded = 0;
      if (win?.bonusDrills) {
        const cur = drill.bonusDrills || 0;
        drillsAdded = Math.max(0, Math.min(win.bonusDrills, MAX_BONUS_DRILLS - cur));
        if (drillsAdded > 0) {
          update.bonusDrills = cur + drillsAdded;
          update.bonusFromTickets = (drill.bonusFromTickets || 0) + drillsAdded;
        }
      }
      if (win?.claimJumps) update.bonusClaimJumps = (drill.bonusClaimJumps || 0) + win.claimJumps;
      if (win?.supply) update[`supplies.${win.supply}`] = FieldValue.increment(1);
      let coupon = null;
      if (win?.coupon) {
        const from = couponValid(drill.coupon) ? drill.coupon.expiresAt : Date.now();
        coupon = { pct: COUPON_PCT, expiresAt: from + COUPON_DAYS * 86400000, issuedDay: day, issuedBy: id };
        update.coupon = coupon;
      }
      if (Object.keys(update).length) tx.set(drillRef, update, { merge: true });

      const settled = {
        status: "settled", settledAt: FieldValue.serverTimestamp(),
        win: sym, tier: win ? win.tier : null, prize: win ? win.prize : null, drillsAdded,
      };
      tx.set(ticketRef, settled, { merge: true });
      return { ticket: { ...t, ...settled }, already: false, streak: ticketStreak, drillsAdded, coupon, isTest, username: drill.username || null };
    });
    if (out.error === "no-ticket") return NextResponse.json({ error: "No such ticket." }, { status: 404 });
    if (out.error === "corrupt") return NextResponse.json({ error: "That ticket is not valid." }, { status: 409 });

    if (!out.already && out.ticket.win && !out.isTest) {
      const w = out.ticket;
      await logTimeline(db, {
        type: w.tier === "jackpot" ? "ticket_jackpot" : "ticket",
        userId, username: out.username,
        detail: `three ${w.win}s · ${String(w.prize).toLowerCase()}`,
      });
    }

    return NextResponse.json({ ok: true, already: out.already, ...publicTicket(out.ticket), streak: out.streak, drillsAdded: out.drillsAdded || 0, coupon: out.coupon || null });
  } catch (e) {
    console.error("[oil-ticket-settle]", e);
    return NextResponse.json({ error: e.message || "settle failed" }, { status: 500 });
  }
}
