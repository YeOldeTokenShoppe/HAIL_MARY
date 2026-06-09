import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

// Admin-managed tester access code (password-gated). Stored in oilSecret, which
// is read:false / write:false in firestore.rules — so the code is server-only
// and never exposed to clients. A non-crypto tester redeems it via
// /api/oil-redeem-code to get `qualified:true` without the on-chain $20 gate.
//
// NOTE: a tester who qualifies via this code can claim a rig and win real oil —
// the code is a money gate. Use a long, non-guessable value.
const MIN_CODE_LEN = 6;
const codeRef = (db) => db.collection("oilSecret").doc("testerCode");

function checkAuth(req, body, url) {
  const pw = body?.password || url.searchParams.get("password");
  return process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

// GET ?password= — return whether a code is set (and the code, for the admin).
export async function GET(req) {
  const url = new URL(req.url);
  if (!checkAuth(req, null, url)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getAdminDb();
  const snap = await codeRef(db).get();
  const code = snap.exists ? (snap.data().code || "") : "";
  return NextResponse.json({ ok: true, hasCode: !!code, code });
}

// POST { password, code } — set the code; empty/blank code clears it.
export async function POST(req) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  if (!checkAuth(req, body, url)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code) {
    await codeRef(db).set({ code: "", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true, hasCode: false });
  }
  if (code.length < MIN_CODE_LEN) {
    return NextResponse.json({ error: `Code must be at least ${MIN_CODE_LEN} characters` }, { status: 400 });
  }
  await codeRef(db).set({ code, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true, hasCode: true, code });
}
