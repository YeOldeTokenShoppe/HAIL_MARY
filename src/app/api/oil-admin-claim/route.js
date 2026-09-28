import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// Admin/test bypass: assign a plot to a user without the RL80 qualification flow,
// so you can edit/test your own rig (e.g. sign uploads). Password-gated.
export async function POST(req) {
  try {
    // `threshold` / `orders` / `autopilot` are optional — TEST BOTS use them:
    // a PASSER bot (threshold 1e9 → its line passes every wet layer) and TAKER
    // bots (threshold 0 + orders.salvage) exercise the lateral-extract queue
    // from one admin account (Michelle, 2026-09-28).
    const { password, userId, username, col, row, threshold, orders, autopilot } = await req.json();

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (!userId || col == null || row == null) {
      return NextResponse.json({ ok: false, error: "userId, col, row required" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
    }

    const key = `${col}_${row}`;

    // Claim the plot for this user (overwrites any current owner, incl. test
    // users). Reset the cell to a clean slate (depth 0, no prior reveal) so an
    // admin test-claim can drill it fresh — otherwise a previously bottomed-out
    // cell starts depleted.
    await db.collection("oilPlots").doc(key).set({
      col,
      row,
      currentOwnerId: userId,
      drillDay: 0,
      revealed: FieldValue.delete(),
      hellLayers: FieldValue.delete(),
      hellCapped: FieldValue.delete(),
      // v2 state — a re-claimed plot starts clean (no stale passes/takes)
      extracted: FieldValue.delete(),
      passed: FieldValue.delete(),
      passedInclusions: FieldValue.delete(),
      lateralTaken: FieldValue.delete(),
      lateralByOrder: FieldValue.delete(),
      wildcatTaken: FieldValue.delete(),
      inclusionFlags: FieldValue.delete(),
      ownerHistory: FieldValue.arrayUnion({
        userId,
        claimedAt: new Date().toISOString(),
        reason: "admin_claim",
      }),
      disqualified: false,
    }, { merge: true });

    // Arm the rig — without armed:true / rigDepleted:false a previously
    // depleted rig is skipped by strike-tick forever (the symptom that made
    // FORCE STRIKE never fire after an admin claim).
    await db.collection("oilDrills").doc(userId).set({
      userId,
      col,
      row,
      armed: true,
      rigDepleted: false,
      username: username || "admin",
      // v2 decision state starts clean (banked totalCollected is left alone —
      // ZERO SCORES is the tool for money)
      pending: null,
      chargesSpent: 0,
      layersExtracted: {},
      layersPassed: {},
      ...(typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0 ? { threshold } : {}),
      ...(typeof autopilot === "boolean" ? { autopilot } : {}),
      ...(orders && typeof orders === "object"
        ? { orders: { salvage: orders.salvage === true, salvageSetAt: orders.salvage === true ? (Number.isFinite(orders.salvageSetAt) ? orders.salvageSetAt : Date.now()) : null } }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Mark qualified so the normal gates treat the plot as theirs
    await db.collection("oilQualified").doc(userId).set({
      userId,
      qualified: true,
      plotCol: col,
      plotRow: row,
    }, { merge: true });

    return NextResponse.json({ ok: true, userId, col, row });
  } catch (err) {
    console.error("[oil-admin-claim] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
