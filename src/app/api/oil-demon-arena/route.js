import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

// POST — arena presence for the demon bounty race strip. Every hunter who
// enters the arena registers on the bounty document and reports each hit, so
// every other hunter's HUD shows the race: who is in, how close they are.
// Hunter identity is the verified session; the username is the drill doc's
// (server-derived), falling back to a sanitized display name from the body.
// Hits are capped at the hard-phase count so nobody can decorate the strip.
// "vial" spends one holy water (supplies.holyWater on the drill doc, bought from
// the snake oil salesman) in a transaction and counts it on the hunter's entry;
// the client throws on tap and this is the ledger — 409 when the vial is gone.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { bountyId, action, hits, username } = await req.json().catch(() => ({}));
    if (!bountyId || !["enter", "hit", "leave", "vial"].includes(action)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const db = getAdminDb();
    const bountyRef = db.collection("demonBounty").doc(bountyId);
    const snap = await bountyRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    const drillRef = db.collection("oilDrills").doc(userId);
    const drillSnap = await drillRef.get();
    const name = (drillSnap.exists && drillSnap.data().username) || (typeof username === "string" ? username.slice(0, 40) : null) || "Hunter";
    const entry = {
      username: name,
      active: action !== "leave",
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (action === "enter") entry.enteredAt = FieldValue.serverTimestamp();
    if (action === "hit") entry.hits = Math.max(0, Math.min(3, Number(hits) || 0));
    if (action === "vial") {
      const spent = await db.runTransaction(async (t) => {
        const d = (await t.get(drillRef)).data() || {};
        const have = d.supplies?.holyWater || 0;
        if (have <= 0) return { ok: false, holyWater: 0 };
        t.update(drillRef, { "supplies.holyWater": have - 1, holyWaterUsed: FieldValue.increment(1), lastHolyWaterAt: FieldValue.serverTimestamp() });
        return { ok: true, holyWater: have - 1 };
      });
      if (!spent.ok) return NextResponse.json({ error: "no_holy_water" }, { status: 409 });
      entry.vials = FieldValue.increment(1);
      await bountyRef.set({ hunters: { [userId]: entry } }, { merge: true });
      return NextResponse.json({ ok: true, holyWater: spent.holyWater });
    }
    await bountyRef.set({ hunters: { [userId]: entry } }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
