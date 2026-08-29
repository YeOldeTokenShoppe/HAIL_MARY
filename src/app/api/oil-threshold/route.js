import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v2 standing order (docs/oil-game.md → "v2 LOOP"): "auto-extract any layer
// ≥ N BTR". The tick resolves an undecided pending by this line before the
// next reveal, so nobody is punished for being offline — the threshold IS the
// strategy dial. 0 (the default) means the crew extracts anything wet.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const btr = Number(body.btr);
    if (!Number.isFinite(btr) || btr < 0) {
      return NextResponse.json({ error: "btr must be a number ≥ 0" }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection("oilDrills").doc(userId).set({
      threshold: btr,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, threshold: btr });
  } catch (err) {
    console.error("[oil-threshold] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
