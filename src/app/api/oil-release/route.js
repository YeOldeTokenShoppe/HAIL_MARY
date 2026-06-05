import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";

// Release the authenticated user's plot(s). Only the session user's own plots are
// freed — and ALL of them (covers stray multi-claims), then the rig is cleared.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const ownedSnap = await db.collection("oilPlots").where("currentOwnerId", "==", userId).get();
    const batch = db.batch();
    let released = 0;
    ownedSnap.forEach((d) => {
      batch.set(d.ref, {
        currentOwnerId: null,
        ownerHistory: FieldValue.arrayUnion({ userId, releasedAt: nowIso, reason: "voluntary" }),
      }, { merge: true });
      released++;
    });
    batch.set(db.collection("oilDrills").doc(userId), {
      col: null, row: null, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(db.collection("oilQualified").doc(userId), {
      plotCol: null, plotRow: null, pickedAt: null,
    }, { merge: true });
    await batch.commit();

    return NextResponse.json({ ok: true, released });
  } catch (err) {
    console.error("[oil-release] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
