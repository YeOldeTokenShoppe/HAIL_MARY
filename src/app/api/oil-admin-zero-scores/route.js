import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

// Admin zero-scores (password-gated): wipe every rig's BANKED score
// (totalCollected) plus the drain bookkeeping that feeds it. Deliberately a
// separate action from oil-admin-reset — the board reset preserves banked
// score so a mid-season glitch wipe can't vaporize players' earned money;
// this is the explicit, destructive "new season starts from zero" step.
async function handle(req) {
  const url = new URL(req.url);
  let pw = url.searchParams.get("password");
  if (!pw) { try { pw = (await req.json())?.password; } catch {} }
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  let batch = db.batch();
  let n = 0;
  const flush = async (force) => {
    if (n >= 400 || (force && n > 0)) { await batch.commit(); batch = db.batch(); n = 0; }
  };

  let rigsZeroed = 0;
  let oilZeroed = 0;
  const drillsSnap = await db.collection("oilDrills").get();
  for (const d of drillsSnap.docs) {
    const dd = d.data();
    if (dd.totalCollected || dd.tankDrains || dd.lastDrainExtracted) {
      oilZeroed += dd.totalCollected || 0;
      batch.set(d.ref, {
        totalCollected: 0,
        tankDrains: 0,
        lastDrainExtracted: 0,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      rigsZeroed++; n++; await flush(false);
    }
  }
  await flush(true);

  return NextResponse.json({ ok: true, rigsZeroed, oilZeroed });
}

export async function POST(req) { return handle(req); }
export async function GET(req) { return handle(req); }
