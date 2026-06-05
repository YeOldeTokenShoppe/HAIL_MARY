import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";

// Normalize a social handle: strip a leading @, trim, cap length.
const handle = (s) => (typeof s === "string" ? s.replace(/^@/, "").trim().slice(0, 40) : undefined);

// Update the authenticated user's profile fields (display name + social links).
// Only the session user's own oilDrills doc is touched — never a body userId.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const update = { userId, updatedAt: FieldValue.serverTimestamp() };
    if (typeof body.username === "string" && body.username.trim()) {
      update.username = body.username.trim().slice(0, 60);
    }
    if (body.telegramHandle != null) update.telegramHandle = handle(body.telegramHandle);
    if (body.xHandle != null) update.xHandle = handle(body.xHandle);

    const db = getAdminDb();
    await db.collection("oilDrills").doc(userId).set(update, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[oil-profile] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
