import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v2 CREW ORDERS (docs/oil-game.md → "v2 LOOP" + standing orders, 2026-09-28).
// One route, three settings, any subset per call:
//   btr       — the standing order: "auto-extract any layer ≥ N BTR". The tick
//               resolves an undecided pending by this line before the next
//               reveal, so nobody is punished for being offline. 0 = anything wet.
//   autopilot — opt-in: extract everything once charges cover the layers left.
//   salvage   — SALVAGE order: when a neighbour passes a layer ≥ the line, the
//               crew takes it with a charge on the next tick. `salvageSetAt` is
//               stamped when it turns ON (kept while it stays on) — the
//               earliest-set order wins a contested pocket.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const update = { updatedAt: FieldValue.serverTimestamp() };
    if (body.btr !== undefined) {
      const btr = Number(body.btr);
      if (!Number.isFinite(btr) || btr < 0) return NextResponse.json({ error: "btr must be a number ≥ 0" }, { status: 400 });
      update.threshold = btr;
    }
    if (body.autopilot !== undefined) update.autopilot = body.autopilot === true;
    const db = getAdminDb();
    const ref = db.collection("oilDrills").doc(userId);
    if (body.salvage !== undefined) {
      const on = body.salvage === true;
      const cur = (await ref.get()).data()?.orders || {};
      update.orders = on
        ? { salvage: true, salvageSetAt: cur.salvage === true && Number.isFinite(cur.salvageSetAt) ? cur.salvageSetAt : Date.now() }
        : { salvage: false, salvageSetAt: null };
    }
    if (Object.keys(update).length === 1) return NextResponse.json({ error: "nothing to set (btr, autopilot, salvage)" }, { status: 400 });
    await ref.set(update, { merge: true });
    const { updatedAt, ...echo } = update;
    return NextResponse.json({ ok: true, ...echo });
  } catch (err) {
    console.error("[oil-threshold] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
