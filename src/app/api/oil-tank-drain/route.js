import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

// Player tank drain (banking). The acting user is taken from the verified Clerk
// session — never the request body — so nobody can bank on another's behalf. The
// banked amount is ALWAYS the server-stored `tankOil` (written by the strike
// loop); the client supplies no amounts, so the score can't be inflated.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : null;

    const db = getAdminDb();
    const drillRef = db.collection("oilDrills").doc(userId);
    const communityRef = db.collection("oilGame").doc("communityStorage");

    // Transaction ensures concurrent drain calls from the same user can't
    // double-count: the second one reads the already-zeroed tankOil.
    const result = await db.runTransaction(async (t) => {
      const drillSnap = await t.get(drillRef);
      if (!drillSnap.exists) {
        throw new Error("No drill record for user");
      }
      const drill = drillSnap.data();

      // Authoritative un-banked balance written by the strike loop. Server-
      // derived only — never trusted from the client.
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
      if (username) drillUpdate.username = username;

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
