import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

// Admin test bank (password-gated): drain a rig's un-banked tankOil into the
// community tank, mirroring the player banking flow in /api/oil-tank-drain — but
// targeted by cell (or userId) so an admin can test the bank → community-tank
// path without a Clerk session. The banked amount is ALWAYS the server-stored
// tankOil; no client-supplied amount.
async function handle(req) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const pw = body.password || url.searchParams.get("password");
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // Resolve the rig: explicit userId wins; otherwise look up the cell's owner.
  let userId = body.userId || url.searchParams.get("userId") || null;
  const col = body.col ?? (url.searchParams.has("col") ? parseInt(url.searchParams.get("col"), 10) : null);
  const row = body.row ?? (url.searchParams.has("row") ? parseInt(url.searchParams.get("row"), 10) : null);

  if (!userId) {
    if (col == null || row == null) {
      return NextResponse.json({ error: "userId or col+row required" }, { status: 400 });
    }
    const plotSnap = await db.collection("oilPlots").doc(`${col}_${row}`).get();
    userId = plotSnap.exists ? plotSnap.data().currentOwnerId : null;
    if (!userId) {
      return NextResponse.json({ error: "no rig on that plot" }, { status: 404 });
    }
  }

  const drillRef = db.collection("oilDrills").doc(userId);
  const communityRef = db.collection("oilGame").doc("communityStorage");

  // Transaction mirrors oil-tank-drain: bank the server-stored tankOil, zero it,
  // bump totalCollected + tankDrains, and increment the community tank.
  const result = await db.runTransaction(async (t) => {
    const drillSnap = await t.get(drillRef);
    if (!drillSnap.exists) throw new Error("No drill record for user");
    const drill = drillSnap.data();

    const delta = (typeof drill.tankOil === "number" && drill.tankOil > 0) ? drill.tankOil : 0;
    if (delta <= 0) {
      return { delta: 0, newTotal: drill.totalCollected || 0, newDrains: drill.tankDrains || 0 };
    }

    const drillUpdate = {
      updatedAt: FieldValue.serverTimestamp(),
      tankOil: 0,
      totalCollected: (drill.totalCollected || 0) + delta,
      tankDrains: (drill.tankDrains || 0) + 1,
    };
    t.set(communityRef, { totalOil: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    t.set(drillRef, drillUpdate, { merge: true });
    return { delta, newTotal: drillUpdate.totalCollected, newDrains: drillUpdate.tankDrains };
  });

  // Mark this rig's active gusher events done (best-effort, mirrors the player path).
  try {
    const gusherSnap = await db.collection("gusherEvents").where("userId", "==", userId).get();
    const batch = db.batch();
    let n = 0;
    gusherSnap.forEach((d) => { if (d.data().status !== "done") { batch.update(d.ref, { status: "done" }); n++; } });
    if (n > 0) await batch.commit();
  } catch (err) {
    console.error("[oil-admin-bank] gusher cleanup failed:", err.message);
  }

  return NextResponse.json({ ok: true, userId, ...result });
}

export async function POST(req) { return handle(req); }
