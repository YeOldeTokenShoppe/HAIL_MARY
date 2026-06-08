import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

// Plot-owner messaging — server-authoritative create + delete.
//
// The `oilPlotMessages` collection is locked to server-only writes
// (firestore.rules), so every mutation lands here:
//  - identity (`fromUserId` / `fromUsername`) is derived from the VERIFIED Clerk
//    session, never trusted from the request body — nobody can post as someone else;
//  - the conversation thread is enforced — a visitor can only write into their own
//    thread; an owner can only reply into a real (non-owner) participant's thread;
//  - deletes are limited to the message author OR the plot owner.
export const runtime = "nodejs";

const GRID_MAX = 50; // sanity cap on coordinates

function parsePlotKey(plotKey) {
  if (typeof plotKey !== "string") return null;
  const m = plotKey.match(/^(\d+)_(\d+)$/);
  if (!m) return null;
  const col = Number(m[1]);
  const row = Number(m[2]);
  if (col < 0 || row < 0 || col > GRID_MAX || row > GRID_MAX) return null;
  return `${col}_${row}`;
}

// Resolve a display name server-side so it can't be spoofed via the body.
async function resolveUsername(db, userId) {
  try {
    const drill = await db.collection("oilDrills").doc(userId).get();
    const u = drill.exists ? drill.data().username : null;
    if (u && String(u).trim()) return String(u).trim().slice(0, 60);
  } catch {}
  try {
    const q = await db.collection("oilQualified").doc(userId).get();
    const n = q.exists ? q.data().clerkName : null;
    if (n && String(n).trim()) return String(n).trim().slice(0, 60);
  } catch {}
  return "anon";
}

export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plotKey = parsePlotKey(body.plotKey);
    if (!plotKey) return NextResponse.json({ error: "Invalid plot" }, { status: 400 });

    const text = typeof body.text === "string" ? body.text.trim().slice(0, 200) : "";
    if (text.length < 1) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const db = getAdminDb();

    // Players only: the sender must be a qualified game participant. `qualified`
    // is the same authoritative flag oil-claim gates on (set by the on-chain
    // RL80 re-check in /api/oil-register + the admin snapshot). A signed-in
    // non-player — or someone disqualified — can't message.
    const qSnap = await db.collection("oilQualified").doc(userId).get();
    if (!qSnap.exists || qSnap.data().qualified !== true) {
      return NextResponse.json({ error: "Only players can message" }, { status: 403 });
    }

    const plotSnap = await db.collection("oilPlots").doc(plotKey).get();
    const ownerId = plotSnap.exists ? plotSnap.data().currentOwnerId : null;
    if (!ownerId) return NextResponse.json({ error: "Plot has no owner" }, { status: 409 });

    // Authoritative thread: a visitor always writes into their OWN thread; an
    // owner replies into the (non-owner) participant's thread named in the body.
    let threadUserId;
    if (userId === ownerId) {
      threadUserId = typeof body.threadUserId === "string" ? body.threadUserId : null;
      if (!threadUserId || threadUserId === ownerId) {
        return NextResponse.json({ error: "Pick a thread to reply to" }, { status: 400 });
      }
    } else {
      threadUserId = userId;
    }

    const fromUsername = await resolveUsername(db, userId);

    await db.collection("oilPlotMessages").add({
      plotKey,
      fromUserId: userId,
      fromUsername,
      threadUserId,
      text,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[oil-message] POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const msgId = typeof body.msgId === "string" ? body.msgId : null;
    if (!msgId) return NextResponse.json({ error: "Missing message id" }, { status: 400 });

    const db = getAdminDb();
    const msgRef = db.collection("oilPlotMessages").doc(msgId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) return NextResponse.json({ ok: true }); // already gone — idempotent
    const msg = msgSnap.data();

    // The author can delete their own message; the plot owner can moderate any
    // message on their plot.
    let allowed = msg.fromUserId === userId;
    if (!allowed && msg.plotKey) {
      const plotSnap = await db.collection("oilPlots").doc(msg.plotKey).get();
      allowed = plotSnap.exists && plotSnap.data().currentOwnerId === userId;
    }
    if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    await msgRef.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[oil-message] DELETE error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
