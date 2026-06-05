import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseServer";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Reuse the same OAuth token refresh logic from the cron job
async function getAccessToken() {
  const oauthDoc = await getDoc(doc(db, "config", "x_oauth"));
  if (!oauthDoc.exists()) {
    throw new Error("No X OAuth tokens found.");
  }

  const { refreshToken, accessToken, updatedAt } = oauthDoc.data();

  // Token still fresh (< 90 min)
  const tokenAge = Date.now() - new Date(updatedAt).getTime();
  if (tokenAge < 90 * 60 * 1000) {
    return accessToken;
  }

  // Refresh
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const tokens = await response.json();
  await setDoc(doc(db, "config", "x_oauth"), {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    updatedAt: new Date().toISOString(),
  });

  return tokens.access_token;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim().replace(/^@/, "").toLowerCase();

  if (!username || username.length < 1 || username.length > 30) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken();

    // Look up the target user's ID
    const userRes = await fetch(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=id`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!userRes.ok) {
      if (userRes.status === 429) {
        // Rate limited — fall back to cached list
        return fallbackToCache(username);
      }
      if (userRes.status === 404) {
        return NextResponse.json({ follows: false, reason: "user_not_found" });
      }
      throw new Error(`User lookup failed: ${userRes.status}`);
    }

    const userData = await userRes.json();
    if (!userData.data?.id) {
      return NextResponse.json({ follows: false, reason: "user_not_found" });
    }

    const targetUserId = userData.data.id;

    // Get rl80token's user ID
    const rl80Res = await fetch(
      "https://api.x.com/2/users/by/username/rl80token?user.fields=id",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!rl80Res.ok) {
      if (rl80Res.status === 429) return fallbackToCache(username);
      throw new Error(`rl80token lookup failed: ${rl80Res.status}`);
    }

    const rl80Data = await rl80Res.json();
    const rl80UserId = rl80Data.data?.id;
    if (!rl80UserId) {
      throw new Error("Could not find rl80token user");
    }

    // Check if targetUser follows rl80token
    // GET /2/users/:source_user_id/following — check if target is in source's following list
    // More efficient: use the "relationship" approach
    const followRes = await fetch(
      `https://api.x.com/2/users/${targetUserId}/following?user.fields=id,username&max_results=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!followRes.ok) {
      if (followRes.status === 429) return fallbackToCache(username);
      throw new Error(`Following check failed: ${followRes.status}`);
    }

    const followData = await followRes.json();
    const follows = followData.data?.some(
      (u) => u.username?.toLowerCase() === "rl80token"
    ) ?? false;

    // If the full following list is paginated we might miss it, so also check followers list as fallback
    if (!follows) {
      // Check cached followers list as secondary source
      const cached = await checkCache(username);
      if (cached) {
        return NextResponse.json({ follows: true, source: "cache" });
      }
    }

    return NextResponse.json({ follows, source: "live" });
  } catch (error) {
    console.error("check-follow error:", error);
    // Fall back to cached list on any error
    return fallbackToCache(username, error.message);
  }
}

async function checkCache(username) {
  try {
    const snap = await getDoc(doc(db, "followers", "latest"));
    if (snap.exists()) {
      const usernames = snap.data().usernames || [];
      return usernames.includes(username.toLowerCase());
    }
  } catch {}
  return false;
}

async function fallbackToCache(username, debugError) {
  const found = await checkCache(username);
  const payload = {
    follows: found,
    source: "cache",
    note: found ? undefined : "Could not verify live. Try again shortly.",
  };
  // Dev-only diagnostics — never leak internal error strings in production.
  if (process.env.NODE_ENV === "development") {
    let cacheSize = null;
    try {
      const snap = await getDoc(doc(db, "followers", "latest"));
      cacheSize = snap.exists() ? (snap.data().usernames || []).length : 0;
    } catch {}
    payload.debugError = debugError || null;
    payload.cacheSize = cacheSize;
  }
  return NextResponse.json(payload);
}
