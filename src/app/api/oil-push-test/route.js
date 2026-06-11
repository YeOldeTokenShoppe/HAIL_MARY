import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { sendPlayerAlert } from "@/lib/oilAlerts";

export const runtime = "nodejs";

// Self-test: sends a push to the CALLER's own registered devices only — lets a
// player (or the admin on a fresh iPhone install) confirm the channel works
// end-to-end without waiting for a real strike. No spam surface: Clerk-authed,
// own tokens only, push channel only.
export async function POST(req) {
  const userId = await authedUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const { push } = await sendPlayerAlert(db, userId, {
    title: "⛏ HMPC test ping",
    body: "Push alerts are working — this is where your rig will tell you it struck.",
    tag: "hmpc-test",
    channels: { telegram: false, push: true },
  });
  // Surface the real FCM outcome so the UI can diagnose instead of showing a
  // blind "sent": tokens=0 → device never registered; failed>0 → FCM rejected.
  return NextResponse.json({ ok: push.sent > 0, ...push });
}
