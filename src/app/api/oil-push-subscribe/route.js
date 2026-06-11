import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";

// Register an FCM web-push token for the signed-in player. Tokens live in
// oilPush/{userId} (deny-by-default Firestore rules keep them private; all
// writes come through here). A device re-registers on each visit, so the
// token list self-heals; sendPlayerAlert prunes tokens FCM reports dead.

const MAX_TOKENS_PER_USER = 10; // newest wins — bounds doc size across devices

export async function POST(req) {
  const userId = await authedUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 4096) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection("oilPush").doc(userId);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    let tokens = snap.exists ? snap.data().tokens || [] : [];
    tokens = tokens.filter((x) => x !== token); // de-dupe, then append as newest
    tokens.push(token);
    if (tokens.length > MAX_TOKENS_PER_USER) tokens = tokens.slice(-MAX_TOKENS_PER_USER);
    t.set(ref, { tokens, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return NextResponse.json({ ok: true });
}

// Unsubscribe this device's token (e.g. a future alerts-off toggle).
export async function DELETE(req) {
  const userId = await authedUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "invalid token" }, { status: 400 });

  const db = getAdminDb();
  await db.collection("oilPush").doc(userId).set(
    { tokens: FieldValue.arrayRemove(token), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return NextResponse.json({ ok: true });
}
