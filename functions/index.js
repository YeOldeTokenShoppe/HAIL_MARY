/**
 * Firebase Cloud Functions for HAIL_MARY Prayer Analysis
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// For cost control
setGlobalOptions({ maxInstances: 10 });

// Daily Prayer Analysis - Runs every day at 6 AM UTC (2 AM EST)
exports.analyzePrayersDaily = onSchedule({
  schedule: "0 6 * * *",
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 540,
  secrets: ["OPENAI_API_KEY"]
}, async (event) => {
  try {
    logger.info("[Prayer Analysis] Starting daily prayer analysis...");
    
    // Get OpenAI API key from environment (optional)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.info("[Prayer Analysis] OpenAI API key not configured, using basic sentiment analysis");
    }
    
    // Fetch recent offerings from Firestore
    const offeringsRef = db.collection('offerings');
    const snapshot = await offeringsRef
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    
    logger.info("[Prayer Analysis] Found", snapshot.size, "offerings");
    
    if (snapshot.empty) {
      // Store empty state
      const emptyAnalysis = {
        overall: 0.5,
        label: 'Awaiting Traders',
        emotions: [{ name: 'Hope', value: 100, color: '#4ade80' }],
        prayersPerHour: 0,
        trend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        keywords: ['waiting', 'for', 'traders'],
        summary: 'The trading floor awaits new messages and market sentiments from the community.',
        lastUpdate: new Date().toISOString(),
        totalAnalyzed: 0,
        totalOfferings: 0,
        updatedAt: new Date()
      };
      
      await db.collection('sentiment_analysis').doc('latest').set(emptyAnalysis);
      logger.info("[Prayer Analysis] Stored empty analysis");
      return;
    }
    
    // Extract prayer data
    const prayers = [];
    const hourAgo = Date.now() - (60 * 60 * 1000);
    let recentCount = 0;
    let totalOfferingsCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      totalOfferingsCount++;
      
      const timestamp = data.createdAt?.toMillis ? data.createdAt.toMillis() : 
                       data.timestamp || Date.now();
      
      // Count recent offerings (with or without messages)
      if (timestamp > hourAgo) {
        recentCount++;
      }
      
      // Only add to prayers array if there's a message
      if (data.message && data.message.trim().length > 0) {
        prayers.push({
          id: doc.id,
          message: data.message,
          timestamp: timestamp,
          name: data.name || 'Anonymous'
        });
      }
    });
    
    // Analyze prayers using our helper functions
    const { analyzePrayers, generateSummary } = require('./prayerAnalysisUtils');
    
    logger.info("[Prayer Analysis] Found", prayers.length, "prayers with messages out of", totalOfferingsCount, "total offerings");
    const analysis = await analyzePrayers(prayers.slice(0, 100), apiKey);
    
    // Generate AI summary
    const summary = await generateSummary(prayers.slice(0, 20), apiKey);
    
    // Prepare final analysis
    const finalAnalysis = {
      ...analysis,
      summary: summary || 'The trading community\'s messages reflect the ongoing balance between bullish hope and bearish fear.',
      prayersPerHour: recentCount,
      lastUpdate: new Date().toISOString(),
      totalOfferings: snapshot.size,
      totalAnalyzed: Math.min(prayers.length, 100),
      updatedAt: new Date(),
      nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next day
    };
    
    // Save to Firebase
    await db.collection('sentiment_analysis').doc('latest').set(finalAnalysis);
    
    // Also save historical record
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await db.collection('sentiment_analysis_history').doc(timestamp).set(finalAnalysis);
    
    logger.info("[Prayer Analysis] Analysis complete:", {
      sentiment: finalAnalysis.label,
      analyzed: finalAnalysis.totalAnalyzed,
      summary: summary ? 'Generated' : 'Default'
    });
    
  } catch (error) {
    logger.error("[Prayer Analysis] Error during daily analysis:", error);
    
    // Store error state so users see something
    const errorAnalysis = {
      overall: 0.5,
      label: 'Analysis Error',
      emotions: [{ name: 'Hope', value: 100, color: '#4ade80' }],
      prayersPerHour: 0,
      trend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      keywords: ['error', 'occurred'],
      summary: 'The sentiment algorithms encountered technical turbulence. The analysis will resume on the next scheduled run.',
      lastUpdate: new Date().toISOString(),
      totalAnalyzed: 0,
      error: error.message,
      updatedAt: new Date()
    };
    
    await db.collection('sentiment_analysis').doc('latest').set(errorAnalysis);
  }
});

// Manual trigger endpoint for testing
exports.analyzePrayersManual = onRequest({
  secrets: ["OPENAI_API_KEY"]
}, async (req, res) => {
  try {
    logger.info("[Prayer Analysis] Manual trigger requested");

    // You can call the same analysis logic here
    // For now, just trigger the scheduled function logic
    const event = { scheduleTime: new Date().toISOString() };
    await exports.analyzePrayersDaily.run(event);

    res.json({ success: true, message: "Prayer analysis triggered manually" });
  } catch (error) {
    logger.error("[Prayer Analysis] Manual trigger failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// AGENT SCORING WORKFLOW
// =============================================================================

// Scoring Workflow - Runs every hour
// Triggers the Next.js API endpoint that runs EMO → TEKNO → MACRO → RL80
//
// DISABLED 2026-01-24: Paused to save costs while setting up paper trading
// To re-enable: uncomment the exports below and deploy with `firebase deploy --only functions`
//
// Daily oil-game qualification snapshot. Pings the App Hosting route with the
// CRON_SECRET bearer; the route's GET cron path runs runSnapshot(), which only
// acts during an ACTIVE game (no-op otherwise). The initial/entry qualification
// check runs separately during registration — this is the ongoing re-check:
// disqualify sellers (count-based), credit diamond-hands + deferred referrals.
exports.oilQualifySnapshotDaily = onSchedule({
  schedule: "0 7 * * *",  // 07:00 UTC daily
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 300,
  secrets: ["CRON_SECRET"],
}, async () => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("[oil-qualify cron] CRON_SECRET not configured");
    return;
  }
  const appUrl = process.env.APP_URL || "https://pumpkin--hailmary-3ff6c.us-central1.hosted.app";
  const endpoint = `${appUrl}/api/oil-qualify`;
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { "Authorization": `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(120000),
    });
    const result = await res.json().catch(() => ({}));
    logger.info("[oil-qualify cron] snapshot result:", result);
  } catch (error) {
    logger.error("[oil-qualify cron] failed:", error);
  }
});

// exports.runScoringWorkflow = onSchedule({
//   schedule: "0 * * * *",  // Every hour at minute 0
//   timeZone: "UTC",
//   memory: "256MiB",
//   timeoutSeconds: 540,    // 9 minutes max
//   secrets: ["CRON_SECRET"]
// }, async (event) => {
//   try {
//     logger.info("[Scoring] Starting hourly scoring workflow...");
//
//     const cronSecret = process.env.CRON_SECRET;
//     if (!cronSecret) {
//       logger.error("[Scoring] CRON_SECRET not configured");
//       return;
//     }
//
//     // Firebase App Hosting URL
//     const appUrl = process.env.APP_URL || "https://pumpkin--hailmary-3ff6c.us-central1.hosted.app";
//     const scoringEndpoint = `${appUrl}/api/cron/run-scoring`;
//
//     logger.info("[Scoring] Calling:", scoringEndpoint);
//
//     // Call the Next.js API endpoint
//     const response = await fetch(scoringEndpoint, {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${cronSecret}`,
//         "Content-Type": "application/json"
//       },
//       // 5 minute timeout for the fetch
//       signal: AbortSignal.timeout(300000)
//     });
//
//     const result = await response.json();
//
//     if (result.success) {
//       logger.info("[Scoring] Workflow completed successfully:", {
//         duration: result.duration,
//         agents: result.agentsCompleted,
//         tradeable: result.summary?.tradeable
//       });
//     } else {
//       logger.error("[Scoring] Workflow failed:", result.error);
//     }
//
//     // Log result to Firestore for monitoring
//     await db.collection('scoringRuns').add({
//       timestamp: new Date(),
//       success: result.success,
//       duration: result.duration,
//       agentsCompleted: result.agentsCompleted || [],
//       summary: result.summary || null,
//       error: result.error || null
//     });
//
//   } catch (error) {
//     logger.error("[Scoring] Fatal error:", error);
//
//     // Log failure to Firestore
//     await db.collection('scoringRuns').add({
//       timestamp: new Date(),
//       success: false,
//       error: error.message
//     });
//   }
// });

// Manual trigger for scoring (for testing)
// DISABLED 2026-01-24: Paused along with scheduled workflow
// exports.runScoringManual = onRequest({
//   secrets: ["CRON_SECRET"]
// }, async (req, res) => {
//   try {
//     logger.info("[Scoring] Manual trigger requested");
//
//     const event = { scheduleTime: new Date().toISOString() };
//     await exports.runScoringWorkflow.run(event);
//
//     res.json({ success: true, message: "Scoring workflow triggered manually" });
//   } catch (error) {
//     logger.error("[Scoring] Manual trigger failed:", error);
//     res.status(500).json({ error: error.message });
//   }
// });


// =============================================================================
// FETCH @rl80token X POSTS (AGENT REPLIES)
// =============================================================================

const X_API_BASE = "https://api.twitter.com/2";
const RL80_USERNAME = "rl80token";

/**
 * Core logic: fetch @rl80token's recent replies and write them to Firestore xPost collection.
 * Uses X API v2 with expansions to get both the agent reply and the parent tweet in one call.
 */
async function fetchAndStoreXPosts(bearerToken) {
  // 1. Get @rl80token user ID
  const userRes = await fetch(
    `${X_API_BASE}/users/by/username/${RL80_USERNAME}?user.fields=id`,
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );

  if (!userRes.ok) {
    const errText = await userRes.text();
    throw new Error(`User lookup failed (${userRes.status}): ${errText}`);
  }

  const userData = await userRes.json();
  if (!userData.data) throw new Error("User @rl80token not found");
  const userId = userData.data.id;

  // 2. Check for since_id to avoid refetching
  const metaDoc = await db.collection("xPost").doc("_meta").get();
  const sinceId = metaDoc.exists ? metaDoc.data().sinceId : null;

  // 3. Fetch recent tweets with expansions
  const params = new URLSearchParams({
    max_results: "10",
    expansions: "referenced_tweets.id,referenced_tweets.id.author_id,author_id",
    "tweet.fields": "created_at,text,referenced_tweets,in_reply_to_user_id",
    "user.fields": "name,username,profile_image_url",
  });
  if (sinceId) params.set("since_id", sinceId);

  const tweetsRes = await fetch(
    `${X_API_BASE}/users/${userId}/tweets?${params}`,
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );

  if (tweetsRes.status === 429) {
    logger.warn("[XPosts] Rate limited, will retry next run");
    return { fetched: 0, written: 0, rateLimited: true };
  }

  if (!tweetsRes.ok) {
    const errText = await tweetsRes.text();
    throw new Error(`Tweets fetch failed (${tweetsRes.status}): ${errText}`);
  }

  const tweetsData = await tweetsRes.json();

  if (!tweetsData.data || tweetsData.data.length === 0) {
    logger.info("[XPosts] No new tweets found");
    return { fetched: 0, written: 0 };
  }

  // Build lookup maps from includes
  const includedTweets = {};
  (tweetsData.includes?.tweets || []).forEach((t) => {
    includedTweets[t.id] = t;
  });

  const includedUsers = {};
  (tweetsData.includes?.users || []).forEach((u) => {
    includedUsers[u.id] = u;
  });

  // 4. Process replies
  let written = 0;
  let latestId = sinceId;

  for (const tweet of tweetsData.data) {
    // Only process replies (tweets that reference another tweet as "replied_to")
    const repliedRef = tweet.referenced_tweets?.find(
      (r) => r.type === "replied_to"
    );
    if (!repliedRef) continue;

    const parentTweet = includedTweets[repliedRef.id];
    if (!parentTweet) continue; // Parent not in expansion (e.g. deleted)

    // Find parent author
    const parentAuthor = includedUsers[parentTweet.author_id] || {};

    // Build xPost document
    const xPostDoc = {
      author: parentAuthor.name || "Unknown",
      handle: parentAuthor.username || "",
      text: parentTweet.text || "",
      replyText: tweet.text || "",
      replyAuthor: "Our Lady of Perpetual Profit",
      replyHandle: RL80_USERNAME,
      tweetUrl: `https://x.com/${RL80_USERNAME}/status/${tweet.id}`,
      authorImageUrl: (parentAuthor.profile_image_url || "").replace(/_normal\./, "_400x400."),
      screenshotUrl: "",
      tweetId: tweet.id,
      parentTweetId: parentTweet.id,
      createdAt: tweet.created_at
        ? new Date(tweet.created_at)
        : FieldValue.serverTimestamp(),
    };

    // Use tweetId as doc ID to prevent duplicates
    await db.collection("xPost").doc(tweet.id).set(xPostDoc);
    written++;

    // Track latest ID for pagination
    if (!latestId || BigInt(tweet.id) > BigInt(latestId)) {
      latestId = tweet.id;
    }
  }

  // 5. Store since_id for next run
  if (latestId) {
    await db.collection("xPost").doc("_meta").set(
      { sinceId: latestId, updatedAt: new Date() },
      { merge: true }
    );
  }

  logger.info(`[XPosts] Done: fetched=${tweetsData.data.length}, written=${written}`);
  return { fetched: tweetsData.data.length, written };
}

// Scheduled: every 4 hours
exports.fetchXPosts = onSchedule({
  schedule: "0 */4 * * *",
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: ["X_BEARER_TOKEN"],
}, async (event) => {
  try {
    logger.info("[XPosts] Starting scheduled fetch...");

    const bearerToken = process.env.X_BEARER_TOKEN;
    if (!bearerToken) {
      logger.error("[XPosts] X_BEARER_TOKEN not configured");
      return;
    }

    const result = await fetchAndStoreXPosts(bearerToken);
    logger.info("[XPosts] Scheduled fetch complete:", result);
  } catch (error) {
    logger.error("[XPosts] Scheduled fetch error:", error);
  }
});

// Manual trigger for testing
exports.fetchXPostsManual = onRequest({
  secrets: ["X_BEARER_TOKEN", "CRON_SECRET"],
}, async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || authHeader !== "Bearer " + cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    logger.info("[XPosts] Manual trigger requested");

    const bearerToken = process.env.X_BEARER_TOKEN;
    if (!bearerToken) {
      res.status(500).json({ error: "X_BEARER_TOKEN not configured" });
      return;
    }

    const result = await fetchAndStoreXPosts(bearerToken);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("[XPosts] Manual trigger failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// One-time migration: upgrade existing xPost authorImageUrl to high-res
exports.upgradeXPostImages = onRequest({
  secrets: ["CRON_SECRET"],
}, async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || authHeader !== "Bearer " + cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const snapshot = await db.collection("xPost").get();
    let updated = 0;

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      if (doc.id === "_meta") return;
      const data = doc.data();
      if (data.authorImageUrl && data.authorImageUrl.includes("_normal.")) {
        const highRes = data.authorImageUrl.replace(/_normal\./, "_400x400.");
        batch.update(doc.ref, { authorImageUrl: highRes });
        updated++;
      }
    });

    await batch.commit();
    logger.info(`[XPosts] Upgraded ${updated} docs to high-res images`);
    res.json({ success: true, updated });
  } catch (error) {
    logger.error("[XPosts] Image upgrade failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// RL80 PRICE UPDATE — Fetches from GeckoTerminal and writes to Firestore
// =========================================================================

const POOL_ADDRESS = "0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203";
const GECKO_BASE = "https://api.geckoterminal.com/api/v2/networks/base/pools";

// Scheduled: every 5 minutes
exports.updateRL80Price = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "UTC",
  retryCount: 1,
}, async () => {
  try {
    logger.info("[RL80Price] Fetching price from GeckoTerminal...");

    const [poolRes, dailyRes, hourlyRes, minuteRes] = await Promise.all([
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}/ohlcv/day?aggregate=1&limit=90`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}/ohlcv/hour?aggregate=1&limit=168`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}/ohlcv/minute?aggregate=15&limit=96`, {
        headers: { Accept: "application/json" },
      }),
    ]);

    if (poolRes.status === 429) {
      logger.warn("[RL80Price] GeckoTerminal rate limited, will retry next run");
      return;
    }

    const poolJson = await poolRes.json();
    const dailyJson = await dailyRes.json();
    const hourlyJson = await hourlyRes.json();
    const minuteJson = await minuteRes.json();

    const pool = poolJson?.data?.attributes || {};
    const dailyList = dailyJson?.data?.attributes?.ohlcv_list || [];
    const hourlyList = hourlyJson?.data?.attributes?.ohlcv_list || [];
    const minuteList = minuteJson?.data?.attributes?.ohlcv_list || [];

    const ohlcvList = dailyList.length >= 10 ? dailyList :
                      hourlyList.length >= 10 ? hourlyList :
                      minuteList.length > 0 ? minuteList : hourlyList;

    const price = parseFloat(pool.base_token_price_usd) || null;
    const priceChange24h = parseFloat(pool.price_change_percentage?.h24) || 0;
    const fdv = parseFloat(pool.fdv_usd) || null;
    const liquidity = parseFloat(pool.reserve_in_usd) || null;

    const ohlcv = ohlcvList.map(([ts, , , , close]) => ({
      time: Math.floor(ts),
      value: close,
    })).sort((a, b) => a.time - b.time);

    const candles = ohlcvList.map(([ts, open, high, low, close, volume]) => ({
      time: Math.floor(ts / 1000),
      open,
      high,
      low,
      close,
      volume: volume || 0,
    })).sort((a, b) => a.time - b.time);

    const result = {
      price,
      priceChange24h,
      fdv,
      liquidity,
      ohlcv,
      candles,
      timeframe: dailyList.length >= 10 ? "daily" :
                 hourlyList.length >= 10 ? "hourly" :
                 minuteList.length > 0 ? "15m" : "hourly",
      updatedAt: new Date().toISOString(),
      success: true,
    };

    await db.collection("market").doc("rl80-price").set(result);
    logger.info(`[RL80Price] Price updated: $${price}`);
  } catch (error) {
    logger.error("[RL80Price] Update failed:", error);
    try {
      await db.collection("market").doc("rl80-price").set({
        error: error.message,
        updatedAt: new Date().toISOString(),
        success: false,
      }, { merge: true });
    } catch (fsErr) {
      logger.error("[RL80Price] Failed to save error state:", fsErr);
    }
  }
});

// Manual trigger for testing
exports.updateRL80PriceManual = onRequest({
  secrets: ["CRON_SECRET"],
}, async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || authHeader !== "Bearer " + cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await exports.updateRL80Price.run({});
    res.json({ success: true });
  } catch (error) {
    logger.error("[RL80Price] Manual trigger failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// UPDATE @rl80token FOLLOWERS — Fetches follower usernames for oil game
// qualification check (X follow requirement)
// =========================================================================

const RL80_X_USERNAME = "rl80token";

/**
 * Refresh the OAuth access token stored in Firestore (config/x_oauth).
 * Tokens last 2 hours; we refresh if older than 90 minutes.
 */
async function getXOAuthAccessToken() {
  const oauthDoc = await db.collection("config").doc("x_oauth").get();
  if (!oauthDoc.exists) {
    throw new Error("No X OAuth tokens found. Visit /api/auth/x to authorize first.");
  }

  const { refreshToken, accessToken, updatedAt } = oauthDoc.data();

  // Check if token was updated less than 90 minutes ago
  const tokenAge = Date.now() - new Date(updatedAt).getTime();
  if (tokenAge < 90 * 60 * 1000) {
    return accessToken;
  }

  // Refresh the token
  logger.info("[Followers] Refreshing X OAuth access token...");
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error("Token refresh failed: " + response.status + " - " + errorBody);
  }

  const tokens = await response.json();

  await db.collection("config").doc("x_oauth").set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    updatedAt: new Date().toISOString(),
  });

  logger.info("[Followers] X OAuth tokens refreshed successfully");
  return tokens.access_token;
}

/**
 * Core logic: paginate through all @rl80token followers and store
 * both display names and usernames (lowercase) in Firestore.
 */
async function fetchAndStoreFollowers() {
  const accessToken = await getXOAuthAccessToken();

  // Look up @rl80token user ID
  const userRes = await fetch(
    "https://api.x.com/2/users/by/username/" + RL80_X_USERNAME + "?user.fields=id",
    { headers: { Authorization: "Bearer " + accessToken } }
  );

  if (!userRes.ok) {
    if (userRes.status === 429) {
      logger.warn("[Followers] Rate limited on user lookup, will retry next run");
      return { success: false, rateLimited: true };
    }
    const errorBody = await userRes.text();
    throw new Error("X API user lookup error: " + userRes.status + " - " + errorBody);
  }

  const userData = await userRes.json();
  if (!userData.data) throw new Error("User @rl80token not found");
  const userId = userData.data.id;

  logger.info("[Followers] Fetching followers for user: " + userId);

  const allDisplayNames = [];
  const allUsernames = [];
  let paginationToken = null;

  do {
    const url = new URL("https://api.x.com/2/users/" + userId + "/followers");
    url.searchParams.set("user.fields", "name,username");
    url.searchParams.set("max_results", "1000");
    if (paginationToken) {
      url.searchParams.set("pagination_token", paginationToken);
    }

    const followersRes = await fetch(url.toString(), {
      headers: { Authorization: "Bearer " + accessToken },
    });

    if (!followersRes.ok) {
      if (followersRes.status === 429) {
        logger.warn("[Followers] Rate limited after " + allDisplayNames.length + " followers, saving partial results");
        break;
      }
      const errorBody = await followersRes.text();
      throw new Error("X API followers error: " + followersRes.status + " - " + errorBody);
    }

    const followersData = await followersRes.json();

    if (followersData.data) {
      for (const user of followersData.data) {
        if (user.name) allDisplayNames.push(user.name);
        if (user.username) allUsernames.push(user.username.toLowerCase());
      }
    }

    paginationToken = followersData.meta?.next_token || null;
    logger.info("[Followers] Collected " + allDisplayNames.length + " followers so far...");
  } while (paginationToken);

  logger.info("[Followers] Total followers collected: " + allDisplayNames.length);

  // Store in Firestore
  await db.collection("followers").doc("latest").set({
    displayNames: allDisplayNames,
    usernames: allUsernames,
    totalCount: allDisplayNames.length,
    updatedAt: new Date().toISOString(),
    success: true,
  });

  return { success: true, totalCount: allDisplayNames.length };
}

// Scheduled: once daily at 7 AM UTC
exports.updateFollowers = onSchedule({
  schedule: "0 7 * * *",
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 540,
  secrets: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
}, async (event) => {
  try {
    logger.info("[Followers] Starting daily followers update...");
    const result = await fetchAndStoreFollowers();
    logger.info("[Followers] Daily update complete:", result);
  } catch (error) {
    logger.error("[Followers] Daily update failed:", error);

    try {
      await db.collection("followers").doc("latest").set({
        error: error.message,
        updatedAt: new Date().toISOString(),
        success: false,
      }, { merge: true });
    } catch (fsErr) {
      logger.error("[Followers] Failed to save error state:", fsErr);
    }
  }
});

// Manual trigger for testing
exports.updateFollowersManual = onRequest({
  secrets: ["X_CLIENT_ID", "X_CLIENT_SECRET", "CRON_SECRET"],
}, async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || authHeader !== "Bearer " + cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    logger.info("[Followers] Manual trigger requested");
    const result = await fetchAndStoreFollowers();
    res.json(result);
  } catch (error) {
    logger.error("[Followers] Manual trigger failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// RL80 MARKET DATA — scheduled fetch of pool + OHLC every minute. Clients
// read from marketData/rl80 via onSnapshot so external APIs are called
// once globally instead of once per visitor.
// =========================================================================

const RL80_POOL_ADDRESS = "0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203";
const RL80_GECKO_POOL =
  `https://api.geckoterminal.com/api/v2/networks/base/pools/${RL80_POOL_ADDRESS}`;
const RL80_GECKO_OHLCV =
  `https://api.geckoterminal.com/api/v2/networks/base/pools/${RL80_POOL_ADDRESS}/ohlcv`;
const RL80_CG_ETH_OHLC = "https://api.coingecko.com/api/v3/coins/ethereum/ohlc";
const RL80_PRO_CG_ETH_OHLC =
  "https://pro-api.coingecko.com/api/v3/coins/ethereum/ohlc";
const RL80_ALLOWED_DAYS = [1, 7, 14, 30, 90, 180, 365];
const RL80_GT_OHLCV_BY_DAYS = {
  1:   {timeframe: "minute", aggregate: 30, limit: 48},
  7:   {timeframe: "hour",   aggregate: 4,  limit: 42},
  14:  {timeframe: "hour",   aggregate: 4,  limit: 84},
  30:  {timeframe: "day",    aggregate: 1,  limit: 30},
  90:  {timeframe: "day",    aggregate: 1,  limit: 90},
  180: {timeframe: "day",    aggregate: 1,  limit: 180},
  365: {timeframe: "day",    aggregate: 1,  limit: 365},
};
const RL80_MIN_REAL_CANDLES = 12;

async function fetchRl80Timeframe(days, ratio, cgKey) {
  const conf = RL80_GT_OHLCV_BY_DAYS[days];
  const gtOhlcvUrl =
    `${RL80_GECKO_OHLCV}/${conf.timeframe}` +
    `?aggregate=${conf.aggregate}&limit=${conf.limit}&currency=usd`;

  // Try CoinGecko in this order:
  //   1. Pro endpoint + x-cg-pro-api-key (if key set)
  //   2. Public endpoint + x-cg-demo-api-key (if key set — Demo keys use this)
  //   3. Public endpoint, no key
  // Whichever returns a non-empty array first wins.
  async function fetchCgOhlc() {
    const attempts = [];
    if (cgKey) {
      // Only hit the Pro endpoint when explicitly opted in — a Demo key on
      // pro-api.coingecko.com 400s (error 10011). Default to the Demo path.
      if (process.env.COINGECKO_PRO === "true") {
        attempts.push({
          url: `${RL80_PRO_CG_ETH_OHLC}?vs_currency=usd&days=${days}`,
          headers: {Accept: "application/json", "x-cg-pro-api-key": cgKey},
          label: "pro",
        });
      }
      attempts.push({
        url: `${RL80_CG_ETH_OHLC}?vs_currency=usd&days=${days}`,
        headers: {Accept: "application/json", "x-cg-demo-api-key": cgKey},
        label: "demo",
      });
    }
    attempts.push({
      url: `${RL80_CG_ETH_OHLC}?vs_currency=usd&days=${days}`,
      headers: {Accept: "application/json"},
      label: "public",
    });
    for (const a of attempts) {
      try {
        const r = await fetch(a.url, {headers: a.headers});
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          logger.warn(
              `[rl80 market] CG ${a.label} days=${days} status=${r.status} body=${body.slice(0, 200)}`,
          );
          continue;
        }
        const json = await r.json().catch((e) => {
          logger.warn(`[rl80 market] CG ${a.label} days=${days} parse err: ${e.message}`);
          return [];
        });
        if (Array.isArray(json) && json.length > 0) return json;
        logger.warn(`[rl80 market] CG ${a.label} days=${days} empty array`);
      } catch (err) {
        logger.warn(`[rl80 market] CG ${a.label} days=${days} fetch err: ${err.message}`);
      }
    }
    return [];
  }

  const [ohlcJson, gtOhlcvRes] = await Promise.all([
    fetchCgOhlc(),
    fetch(gtOhlcvUrl, {headers: {Accept: "application/json"}}),
  ]);

  const gtOhlcvJson = await gtOhlcvRes.json().catch(() => ({}));

  const gtList = Array.isArray(gtOhlcvJson?.data?.attributes?.ohlcv_list) ?
    gtOhlcvJson.data.attributes.ohlcv_list :
    [];
  const realCandles = gtList
    .map(([ts, o, h, l, c, v]) => ({
      time: ts,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v || 0,
    }))
    .filter((c) =>
      [c.open, c.high, c.low, c.close].every(
        (v) => Number.isFinite(v) && v > 0,
      ),
    )
    .sort((a, b) => a.time - b.time);

  const ethCandles = Array.isArray(ohlcJson) ? ohlcJson : [];
  const scaledCandles = ratio ?
    ethCandles
        .map(([tsMs, open, high, low, close]) => ({
          time: Math.floor(tsMs / 1000),
          open: open * ratio,
          high: high * ratio,
          low: low * ratio,
          close: close * ratio,
          volume: 0,
        }))
        .filter((c) =>
          [c.open, c.high, c.low, c.close].every(
            (v) => Number.isFinite(v) && v > 0,
          ),
        )
        .sort((a, b) => a.time - b.time) :
    [];

  const useReal = realCandles.length >= RL80_MIN_REAL_CANDLES;
  const candles = useReal ? realCandles : scaledCandles;
  const source = useReal ? "real" : "eth-scaled";
  const timeframe = days === 1 ? "30m" : days <= 14 ? "4h" : "4d";

  return {
    days,
    candles,
    timeframe,
    source,
    realCandleCount: realCandles.length,
  };
}

// GeckoTerminal's free tier throttles bursts, so retry the pool fetch a few
// times with linear backoff before giving up. On ultimate failure the caller
// skips the write entirely, leaving the last-good marketData/rl80 doc intact.
async function fetchPool() {
  const retries = 3;
  let lastStatus = 0;
  for (let i = 0; i < retries; i++) {
    const res = await fetch(RL80_GECKO_POOL, {
      headers: {Accept: "application/json"},
    });
    if (res.ok) return res;
    lastStatus = res.status;
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error(`pool fetch failed: ${lastStatus}`);
}

// Live ETH/USD. GeckoTerminal freezes its quote-token (ETH) USD price on
// zero-volume pools, so its base_token_price_usd / fdv_usd are stale by
// whatever ETH has moved since the pool last traded. We fetch a live ETH
// price and re-derive RL80's USD from the (fresh) on-pool RL80/ETH ratio.
// Tries CoinGecko (Demo key, then public), then Coinbase spot.
async function fetchLiveEthUsd(cgKey) {
  const cgUrl =
    "https://api.coingecko.com/api/v3/simple/price" +
    "?ids=ethereum&vs_currencies=usd";
  const attempts = [];
  if (cgKey) {
    attempts.push({
      url: cgUrl,
      headers: {Accept: "application/json", "x-cg-demo-api-key": cgKey},
      parse: (j) => j?.ethereum?.usd,
      label: "coingecko-demo",
    });
  }
  attempts.push({
    url: cgUrl,
    headers: {Accept: "application/json"},
    parse: (j) => j?.ethereum?.usd,
    label: "coingecko-public",
  });
  attempts.push({
    url: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    headers: {Accept: "application/json"},
    parse: (j) => parseFloat(j?.data?.amount),
    label: "coinbase",
  });
  for (const a of attempts) {
    try {
      const r = await fetch(a.url, {headers: a.headers});
      if (!r.ok) {
        logger.warn(`[rl80 market] ETH price ${a.label} status=${r.status}`);
        continue;
      }
      const j = await r.json().catch(() => null);
      const v = a.parse(j);
      if (Number.isFinite(v) && v > 0) return {usd: v, source: a.label};
    } catch (err) {
      logger.warn(`[rl80 market] ETH price ${a.label} err: ${err.message}`);
    }
  }
  return null;
}

async function refreshRl80MarketData() {
  const cgKey = process.env.COINGECKO_API_KEY || null;

  const poolRes = await fetchPool();
  const poolJson = await poolRes.json().catch(() => ({}));
  const pool = poolJson?.data?.attributes || {};
  const poolPriceChange24h =
    parseFloat(pool.price_change_percentage?.h24) || 0;
  const ratio = parseFloat(pool.base_token_price_native_currency) || null;
  const liquidity = parseFloat(pool.reserve_in_usd) || null;

  // GeckoTerminal's USD figures (stale ETH on dormant pools) — kept as a
  // fallback only.
  const gtPriceUsd = parseFloat(pool.base_token_price_usd) || null;
  const gtEthUsd = parseFloat(pool.quote_token_price_usd) || null;
  const gtFdv = parseFloat(pool.fdv_usd) || null;

  // Re-derive USD from the fresh RL80/ETH ratio × live ETH. Fall back to
  // GeckoTerminal's values if the live ETH fetch fails so we never write null.
  const ethLive = await fetchLiveEthUsd(cgKey);
  let priceUsd = gtPriceUsd;
  let fdv = gtFdv;
  let ethPriceUsd = gtEthUsd;
  let priceSource = "geckoterminal";
  if (ethLive && ratio) {
    ethPriceUsd = ethLive.usd;
    priceUsd = ratio * ethLive.usd;
    // Re-scale FDV off the corrected ETH (cancels GT's stale ETH/USD).
    if (gtFdv && gtEthUsd) fdv = gtFdv * (ethLive.usd / gtEthUsd);
    priceSource = `ratio×eth:${ethLive.source}`;
  }

  const results = await Promise.all(
      RL80_ALLOWED_DAYS.map((d) =>
        fetchRl80Timeframe(d, ratio, cgKey).catch((err) => {
          logger.warn(`[rl80 market] timeframe ${d} failed:`, err);
          return {days: d, candles: [], error: err.message || "fetch failed"};
        }),
      ),
  );

  const timeframes = {};
  for (const r of results) {
    let change24h = poolPriceChange24h;
    if (!change24h && r.candles && r.candles.length >= 2) {
      const first = r.candles[0].open;
      const last = r.candles[r.candles.length - 1].close;
      if (first > 0) change24h = ((last - first) / first) * 100;
    }
    timeframes[String(r.days)] = {
      days: r.days,
      candles: r.candles || [],
      timeframe: r.timeframe || null,
      source: r.source || null,
      realCandleCount: r.realCandleCount || 0,
      priceChange24h: change24h || 0,
      error: r.error || null,
    };
  }

  const payload = {
    price: priceUsd,
    priceChange24h: poolPriceChange24h,
    fdv,
    liquidity,
    ratio,
    ethPriceUsd,
    priceSource,
    timeframes,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtIso: new Date().toISOString(),
  };

  await db.collection("marketData").doc("rl80").set(payload);
  return {ok: true, timeframes: Object.keys(timeframes).length};
}

exports.refreshRl80Market = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: ["COINGECKO_API_KEY"],
}, async () => {
  try {
    const result = await refreshRl80MarketData();
    logger.info("[rl80 market] refreshed", result);
  } catch (err) {
    logger.error("[rl80 market] refresh failed:", err);
  }
});

// Manual bootstrap / debug endpoint. Gate with CRON_SECRET like the others.
exports.refreshRl80MarketManual = onRequest({
  secrets: ["COINGECKO_API_KEY", "CRON_SECRET"],
}, async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || authHeader !== "Bearer " + cronSecret) {
    res.status(401).json({error: "Unauthorized"});
    return;
  }
  try {
    const result = await refreshRl80MarketData();
    res.json(result);
  } catch (err) {
    logger.error("[rl80 market] manual refresh failed:", err);
    res.status(500).json({error: err.message});
  }
});

// ── Oil game: continuous-pump strike loop ───────────────────────────────────
// Hourly trigger that pings the Next.js route holding the strike logic. The
// route is the single source of truth (it reuses generateOilDistribution3D and
// firebaseAdmin), so the cron never drifts from what the client renders.
// Each armed rig strikes once/day at its own unpredictable hour; the route's
// per-day idempotency guard makes running every hour safe.
exports.oilStrikeTick = onSchedule({
  // Every 5 minutes: a rig's strike can land at any time of day (not just on the
  // hour) without the cost of an every-minute full rig scan. The route gates on a
  // per-rig minute-of-day target, so the strike fires on the first 5-min tick
  // at/after that minute. The `lastStrikeDate` guard still enforces ONE strike
  // per UTC day per rig — this cadence only sharpens *when* within the day.
  schedule: "every 5 minutes",
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 120,
  secrets: ["CRON_SECRET"],
}, async () => {
  const base = process.env.APP_URL ||
    "https://pumpkin--hailmary-3ff6c.us-central1.hosted.app";
  try {
    const res = await fetch(base + "/api/oil-strike-tick", {
      method: "POST",
      headers: {Authorization: "Bearer " + process.env.CRON_SECRET},
    });
    const body = await res.json().catch(() => ({}));
    logger.info("[oilStrikeTick] tick complete", {status: res.status, body});
  } catch (err) {
    logger.error("[oilStrikeTick] tick failed:", err);
  }
});
