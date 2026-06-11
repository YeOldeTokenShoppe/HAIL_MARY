import { getAdminDb } from "@/lib/firebaseAdmin";

// Shared @rl80token follower-cache plumbing, used by BOTH:
//   - /api/cron/update-followers (daily scheduled backstop)
//   - /api/check-follow (on-demand refresh when a verify misses the cache)
// The cache doc is followers/latest: { usernames[], displayNames[], totalCount,
// updatedAt, success, partial, refreshStartedAt }.

const RL80_X_USERNAME = "rl80token";

// On-demand refreshes are cooldown-gated so a registration rush can't burn the
// X API quota (each refresh re-pages the whole follower list; the followers
// endpoint allows ~15 req/15min app-wide on the Basic tier).
export const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
// Stampede guard: concurrent misses share one in-flight refresh.
const IN_FLIGHT_MS = 2 * 60 * 1000;

// Refresh the OAuth access token using the stored refresh token. Admin SDK —
// config/x_oauth is private (read:false), so the client SDK can't read it.
export async function getXAccessToken() {
  const db = getAdminDb();
  const oauthDoc = await db.collection("config").doc("x_oauth").get();
  if (!oauthDoc.exists) {
    throw new Error("No X OAuth tokens found. Visit /api/auth/x to authorize first.");
  }

  const { refreshToken, accessToken, updatedAt } = oauthDoc.data();

  // Tokens last 2 hours; reuse if updated less than 90 minutes ago.
  const tokenAge = Date.now() - new Date(updatedAt).getTime();
  if (tokenAge < 90 * 60 * 1000) {
    return accessToken;
  }

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
    const errorBody = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorBody}`);
  }

  const tokens = await response.json();
  await db.collection("config").doc("x_oauth").set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    updatedAt: new Date().toISOString(),
  });

  return tokens.access_token;
}

// Page through ALL @rl80token followers and store them in followers/latest.
// On a mid-pagination 429 the partial list is saved with partial:true — a
// cache MISS on a partial list is not proof of not-following.
export async function refreshFollowersCache() {
  const db = getAdminDb();
  const accessToken = await getXAccessToken();

  const userResponse = await fetch(
    `https://api.x.com/2/users/by/username/${RL80_X_USERNAME}?user.fields=id`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!userResponse.ok) {
    const errorBody = await userResponse.text();
    throw new Error(`X API error on user lookup: ${userResponse.status} - ${errorBody}`);
  }
  const userData = await userResponse.json();
  if (!userData.data) throw new Error("User not found");
  const userId = userData.data.id;

  const allDisplayNames = [];
  const allUsernames = [];
  let paginationToken = null;
  let partial = false;

  do {
    const url = new URL(`https://api.x.com/2/users/${userId}/followers`);
    url.searchParams.set("user.fields", "name,username");
    url.searchParams.set("max_results", "1000");
    if (paginationToken) url.searchParams.set("pagination_token", paginationToken);

    const followersResponse = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!followersResponse.ok) {
      const errorBody = await followersResponse.text();
      if (followersResponse.status === 429) {
        console.log(`[xFollowers] Rate limited after ${allUsernames.length} followers — saving partial list`);
        partial = true;
        break;
      }
      throw new Error(`X API error on followers: ${followersResponse.status} - ${errorBody}`);
    }

    const followersData = await followersResponse.json();
    for (const u of followersData.data || []) {
      if (u.name) allDisplayNames.push(u.name);
      if (u.username) allUsernames.push(u.username.toLowerCase());
    }
    paginationToken = followersData.meta?.next_token || null;
  } while (paginationToken);

  await db.collection("followers").doc("latest").set({
    displayNames: allDisplayNames,
    usernames: allUsernames,
    totalCount: allDisplayNames.length,
    updatedAt: new Date().toISOString(),
    success: true,
    partial,
  });

  return { totalCount: allUsernames.length, partial };
}

// Is {username} in the cached follower list? (0 API calls)
export async function isInFollowerCache(username) {
  try {
    const snap = await getAdminDb().collection("followers").doc("latest").get();
    if (snap.exists) {
      const usernames = snap.data().usernames || [];
      return usernames.includes(username.toLowerCase());
    }
  } catch {}
  return false;
}

// Live fallback: scan the first page of the target user's own following list.
// 2 API calls; first-page-only, so a miss here is not definitive for accounts
// following >1000 others.
export async function checkFollowLive(username) {
  const accessToken = await getXAccessToken();

  const userRes = await fetch(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=id`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!userRes.ok) {
    if (userRes.status === 404) return { follows: false, reason: "user_not_found" };
    throw new Error(`User lookup failed: ${userRes.status}`);
  }
  const userData = await userRes.json();
  if (!userData.data?.id) return { follows: false, reason: "user_not_found" };

  const followRes = await fetch(
    `https://api.x.com/2/users/${userData.data.id}/following?user.fields=id,username&max_results=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!followRes.ok) throw new Error(`Following check failed: ${followRes.status}`);

  const followData = await followRes.json();
  const follows = followData.data?.some((u) => u.username?.toLowerCase() === RL80_X_USERNAME) ?? false;
  return { follows };
}

// Full three-tier check — cache, then cooldown-gated refresh, then live.
// Shared by /api/check-follow (UI verify) and /api/oil-register (server
// enforcement) so the button and the gate can never disagree.
// Returns { follows, source, reason?, refreshed }.
export async function checkHandleFollows(username) {
  if (await isInFollowerCache(username)) {
    return { follows: true, source: "cache", refreshed: false };
  }

  let refreshed = false;
  try {
    refreshed = await maybeRefreshFollowersCache();
    if (refreshed && (await isInFollowerCache(username))) {
      return { follows: true, source: "refreshed", refreshed };
    }
  } catch {}

  try {
    const live = await checkFollowLive(username);
    if (live.reason === "user_not_found") {
      return { follows: false, source: "live", reason: "user_not_found", refreshed };
    }
    if (live.follows) {
      return { follows: true, source: "live", refreshed };
    }
  } catch (error) {
    console.error("[xFollowers] live fallback error:", error.message);
  }

  return { follows: false, source: refreshed ? "refreshed" : "cache", refreshed };
}

// Cooldown-gated on-demand refresh: runs refreshFollowersCache() only when the
// cache is older than REFRESH_COOLDOWN_MS and no other refresh is in flight.
// Returns true if a refresh actually ran (caller should re-check the cache).
export async function maybeRefreshFollowersCache() {
  const db = getAdminDb();
  const ref = db.collection("followers").doc("latest");
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};

  const age = data.updatedAt ? Date.now() - new Date(data.updatedAt).getTime() : Infinity;
  if (age < REFRESH_COOLDOWN_MS) return false;

  const inFlight = data.refreshStartedAt
    ? Date.now() - new Date(data.refreshStartedAt).getTime() < IN_FLIGHT_MS
    : false;
  if (inFlight) return false;

  await ref.set({ refreshStartedAt: new Date().toISOString() }, { merge: true });
  try {
    await refreshFollowersCache();
    return true;
  } catch (err) {
    console.error("[xFollowers] on-demand refresh failed:", err.message);
    // Record the failure but keep the last good list intact.
    await ref.set({ error: err.message, refreshStartedAt: null }, { merge: true }).catch(() => {});
    return false;
  }
}
