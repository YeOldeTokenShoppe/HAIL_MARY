import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { checkHandleFollows } from "@/lib/xFollowers";

export const runtime = "nodejs";

// Does {username} follow @rl80token? Thin wrapper over the shared three-tier
// check in lib/xFollowers (cache → cooldown-gated refresh → live look-up) —
// the same check /api/oil-register enforces at registration, so the VERIFY
// button and the server gate can never disagree.
//
// NOTE: this proves the HANDLE follows — not that the caller owns the handle.
// Ownership only comes from the Clerk X-OAuth path (xIdentityVerified).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim().replace(/^@/, "").toLowerCase();

  if (!username || username.length < 1 || username.length > 30) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const result = await checkHandleFollows(username);

  const payload = { follows: result.follows, source: result.source };
  if (result.reason) payload.reason = result.reason;
  if (!result.follows && !result.reason) {
    payload.note = result.refreshed
      ? "Not found in the follower list — double-check you followed @rl80token from this account."
      : "Just followed? It can take a few minutes to register — try again shortly.";
  }

  // Dev-only diagnostics — never leak internals in production.
  if (process.env.NODE_ENV === "development") {
    try {
      const snap = await getAdminDb().collection("followers").doc("latest").get();
      payload.cacheSize = snap.exists ? (snap.data().usernames || []).length : 0;
      payload.cacheUpdatedAt = snap.exists ? snap.data().updatedAt : null;
    } catch {}
  }
  return NextResponse.json(payload);
}
