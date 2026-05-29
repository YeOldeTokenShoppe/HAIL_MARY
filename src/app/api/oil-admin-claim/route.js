import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// Admin/test bypass: assign a plot to a user without the RL80 qualification flow,
// so you can edit/test your own rig (e.g. sign uploads). Password-gated.
export async function POST(req) {
  try {
    const { password, userId, username, col, row } = await req.json();

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

    // Claim the plot for this user (overwrites any current owner, incl. test users)
    await db.collection("oilPlots").doc(key).set({
      col,
      row,
      currentOwnerId: userId,
      ownerHistory: FieldValue.arrayUnion({
        userId,
        claimedAt: new Date().toISOString(),
        reason: "admin_claim",
      }),
      disqualified: false,
    }, { merge: true });

    await db.collection("oilDrills").doc(userId).set({
      userId,
      col,
      row,
      username: username || "admin",
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
