import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// Player tank drain. Server is the only writer to oilGame/communityStorage —
// it computes the delta from the user's stored lastDrainExtracted to prevent
// double-counting on duplicate requests (rapid double-click, retries).
export async function POST(req) {
  try {
    const { userId, playerExtracted, username } = await req.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    // playerExtracted is only needed for the legacy fallback path; default it.
    const pe = typeof playerExtracted === "number" ? playerExtracted : 0;
    if (pe < 0 || !Number.isFinite(pe)) {
      return NextResponse.json({ error: "Invalid playerExtracted" }, { status: 400 });
    }

    const db = getAdminDb();
    const drillRef = db.collection("oilDrills").doc(userId);
    const communityRef = db.collection("oilGame").doc("communityStorage");

    // Transaction ensures concurrent drain calls from the same user can't
    // double-count: the second one reads the already-zeroed tankOil (or the
    // already-advanced lastDrainExtracted on the legacy path).
    const result = await db.runTransaction(async (t) => {
      const drillSnap = await t.get(drillRef);
      if (!drillSnap.exists) {
        throw new Error("No drill record for user");
      }
      const drill = drillSnap.data();

      let delta;
      const drillUpdate = { updatedAt: FieldValue.serverTimestamp() };

      if (typeof drill.tankOil === "number" && drill.tankOil > 0) {
        // Preferred: explicit tankOil accumulator written by the strike loop.
        delta = drill.tankOil;
        drillUpdate.tankOil = 0;
        drillUpdate.lastDrainExtracted = pe; // keep legacy marker aligned
      } else {
        // Legacy delta model (data predating the strike loop).
        const lastDrain = drill.lastDrainExtracted || 0;
        delta = pe - lastDrain;
        if (delta <= 0) {
          return { delta: 0, newTotal: drill.totalCollected || 0 };
        }
        drillUpdate.lastDrainExtracted = pe;
      }

      drillUpdate.totalCollected = (drill.totalCollected || 0) + delta;
      drillUpdate.tankDrains = (drill.tankDrains || 0) + 1;
      if (typeof username === "string" && username.trim()) {
        drillUpdate.username = username.trim();
      }

      t.set(communityRef, {
        totalOil: FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      t.set(drillRef, drillUpdate, { merge: true });

      return { delta, newTotal: drillUpdate.totalCollected, newDrains: drillUpdate.tankDrains };
    });

    // Mark this user's active gusher events as done. Best-effort, outside
    // the transaction — failures here shouldn't roll back the drain.
    try {
      const gusherSnap = await db.collection("gusherEvents")
        .where("userId", "==", userId)
        .where("status", "!=", "done")
        .get();
      const batch = db.batch();
      gusherSnap.forEach((d) => batch.update(d.ref, { status: "done" }));
      if (!gusherSnap.empty) await batch.commit();
    } catch (err) {
      console.error("[oil-tank-drain] gusher cleanup failed:", err.message);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[oil-tank-drain] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
