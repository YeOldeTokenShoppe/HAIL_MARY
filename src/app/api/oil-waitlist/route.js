import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";

// Next-season waitlist. A qualified player who couldn't get a plot (grid full, or
// registration already closed / game active) reserves a spot for the next rolling
// season. Stored on their own oilQualified doc; server-authoritative (oilQualified
// is write:false for clients). Doubles as a sponsor demand metric (count waiting).

// Rank waitlisted users by when they joined. Small N — a full read is fine.
async function rank(db, userId) {
  const snap = await db.collection("oilQualified").where("waitlisted", "==", true).get();
  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, at: d.data().waitlistedAt?.toMillis?.() ?? 0 }));
  rows.sort((a, b) => a.at - b.at);
  const idx = rows.findIndex((r) => r.id === userId);
  return { position: idx >= 0 ? idx + 1 : null, total: rows.length };
}

export async function GET(req) {
  const userId = await authedUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getAdminDb();
  const me = await db.collection("oilQualified").doc(userId).get();
  const waitlisted = me.exists && me.data().waitlisted === true;
  const { position, total } = await rank(db, userId);
  return NextResponse.json({ ok: true, waitlisted, position: waitlisted ? position : null, total });
}

export async function POST(req) {
  const userId = await authedUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const qref = db.collection("oilQualified").doc(userId);
  const me = await qref.get();
  // Must be a registered/qualified player to hold a spot — keeps the waitlist a
  // real demand signal, not anonymous noise.
  if (!me.exists || me.data().qualified !== true) {
    return NextResponse.json({ error: "Register first to join the waitlist." }, { status: 403 });
  }
  if (me.data().waitlisted !== true) {
    await qref.set({ waitlisted: true, waitlistedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  const { position, total } = await rank(db, userId);
  return NextResponse.json({ ok: true, waitlisted: true, position, total });
}
