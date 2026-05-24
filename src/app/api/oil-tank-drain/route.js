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
    if (typeof playerExtracted !== "number" || playerExtracted < 0 || !Number.isFinite(playerExtracted)) {
      return NextResponse.json({ error: "Invalid playerExtracted" }, { status: 400 });
    }

    const db = getAdminDb();
    const drillRef = db.collection("oilDrills").doc(userId);
    const communityRef = db.collection("oilGame").doc("communityStorage");

    // Transaction ensures concurrent drain calls from the same user can't
    // double-count: the second one reads the already-advanced lastDrainExtracted.
    const result = await db.runTransaction(async (t) => {
      const drillSnap = await t.get(drillRef);
      if (!drillSnap.exists) {
        throw new Error("No drill record for user");
      }
      const drill = drillSnap.data();
      const lastDrain = drill.lastDrainExtracted || 0;
      const delta = playerExtracted - lastDrain;

      if (delta <= 0) {
        return { delta: 0, newTotal: drill.totalCollected || 0 };
      }

      const newTotal = (drill.totalCollected || 0) + delta;
      const newDrains = (drill.tankDrains || 0) + 1;

      t.set(communityRef, {
        totalOil: FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const drillUpdate = {
        totalCollected: newTotal,
        tankDrains: newDrains,
        lastDrainExtracted: playerExtracted,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof username === "string" && username.trim()) {
        drillUpdate.username = username.trim();
      }
      t.set(drillRef, drillUpdate, { merge: true });

      return { delta, newTotal, newDrains };
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
