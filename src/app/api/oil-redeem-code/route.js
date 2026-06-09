import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";

// Tester access-code redemption. A signed-in user submits the code; if it matches
// the admin-set code in oilSecret/testerCode, we mark THEIR OWN oilQualified doc
// `qualified:true` — the same flag /api/oil-register sets after the on-chain $20
// check. This is the only non-wallet path to qualification; oilQualified stays
// write:false so the client still can't forge it. The acting user comes from the
// verified Clerk session, never the body — nobody can qualify someone else.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const submitted = typeof body.code === "string" ? body.code.trim() : "";
    if (!submitted) return NextResponse.json({ error: "Enter a code" }, { status: 400 });

    const db = getAdminDb();

    // Hard kill-switch: the tester code is INERT unless testing is explicitly
    // enabled. Safe-by-default (testingEnabled must be true) so a live game is
    // locked even if the admin forgets the toggle or the code leaks/gets guessed.
    const settingsSnap = await db.collection("oilGame").doc("settings").get();
    if (!settingsSnap.exists || settingsSnap.data().testingEnabled !== true) {
      return NextResponse.json({ error: "Invalid code" }, { status: 403 });
    }

    const codeSnap = await db.collection("oilSecret").doc("testerCode").get();
    const code = codeSnap.exists ? (codeSnap.data().code || "") : "";

    // No code configured, or mismatch — refuse. (Exact, case-sensitive match.)
    if (!code || submitted !== code) {
      return NextResponse.json({ error: "Invalid code" }, { status: 403 });
    }

    const clerkName = (typeof body.clerkName === "string" ? body.clerkName : "Tester").trim().slice(0, 80) || "Tester";

    // Mark qualified as a tester. Preserve any existing plot pick/counters (merge).
    await db.collection("oilQualified").doc(userId).set({
      userId,
      clerkName,
      qualified: true,
      isTester: true,
      redeemedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, qualified: true });
  } catch (err) {
    console.error("[oil-redeem-code]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
