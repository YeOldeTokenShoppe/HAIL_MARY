/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const xClientId = defineSecret("X_CLIENT_ID");
const xClientSecret = defineSecret("X_CLIENT_SECRET");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Refresh OAuth access token using stored refresh token
async function getAccessToken(clientId, clientSecret) {
  const oauthDoc = await db.collection("config").doc("x_oauth").get();
  if (!oauthDoc.exists) {
    throw new Error("No X OAuth tokens found. Visit /api/auth/x to authorize first.");
  }

  const { refreshToken, accessToken, updatedAt } = oauthDoc.data();

  // Check if token was updated less than 90 minutes ago (tokens last 2 hours)
  const tokenAge = Date.now() - new Date(updatedAt).getTime();
  if (tokenAge < 90 * 60 * 1000) {
    return accessToken;
  }

  // Refresh the token
  logger.info("Refreshing X OAuth access token...");
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Token refresh failed:", errorBody);
    throw new Error(`Token refresh failed: ${response.status} - ${errorBody}`);
  }

  const tokens = await response.json();

  // Store updated tokens
  await db.collection("config").doc("x_oauth").set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    updatedAt: new Date().toISOString(),
  });

  logger.info("X OAuth tokens refreshed successfully");
  return tokens.access_token;
}

// Update X followers - runs once daily
exports.updateFollowers = onSchedule(
  {
    schedule: "0 6 * * *", // Once a day at 6 AM UTC
    timeZone: "UTC",
    secrets: [xClientId, xClientSecret],
    maxInstances: 1,
  },
  async () => {
    try {
      logger.info("Starting followers update...");

      const accessToken = await getAccessToken(
        xClientId.value(),
        xClientSecret.value()
      );

      // Fetch user ID for rl80token
      const userResponse = await fetch(
        "https://api.x.com/2/users/by/username/rl80token?user.fields=id",
        {
          headers: { "Authorization": `Bearer ${accessToken}` },
        }
      );

      if (!userResponse.ok) {
        if (userResponse.status === 429) {
          logger.warn("Rate limited on user lookup, will try next run");
          return;
        }
        const errorBody = await userResponse.text();
        throw new Error(`X API error on user lookup: ${userResponse.status} - ${errorBody}`);
      }

      const userData = await userResponse.json();
      if (!userData.data) {
        throw new Error("User not found");
      }

      const userId = userData.data.id;
      logger.info(`Fetching followers for user: ${userId}`);

      // Paginate through all followers
      const allDisplayNames = [];
      let paginationToken = null;

      do {
        const url = new URL(`https://api.x.com/2/users/${userId}/followers`);
        url.searchParams.set("user.fields", "name");
        url.searchParams.set("max_results", "1000");
        if (paginationToken) {
          url.searchParams.set("pagination_token", paginationToken);
        }

        const followersResponse = await fetch(url.toString(), {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });

        if (!followersResponse.ok) {
          const errorBody = await followersResponse.text();
          logger.error("Followers API error:", errorBody);
          if (followersResponse.status === 429) {
            logger.warn(`Rate limited after ${allDisplayNames.length} followers, saving partial`);
            break;
          }
          throw new Error(`X API error on followers: ${followersResponse.status} - ${errorBody}`);
        }

        const followersData = await followersResponse.json();

        if (followersData.data) {
          for (const user of followersData.data) {
            if (user.name) {
              allDisplayNames.push(user.name);
            }
          }
        }

        paginationToken = followersData.meta?.next_token || null;
        logger.info(`Collected ${allDisplayNames.length} followers so far...`);
      } while (paginationToken);

      logger.info(`Total followers collected: ${allDisplayNames.length}`);

      // Store in Firestore
      await db.collection("followers").doc("latest").set({
        displayNames: allDisplayNames,
        totalCount: allDisplayNames.length,
        updatedAt: new Date().toISOString(),
        success: true,
      });

      logger.info("Follower data saved to Firestore successfully");

    } catch (error) {
      logger.error("Update followers error:", error);

      try {
        await db.collection("followers").doc("latest").set({
          error: error.message,
          updatedAt: new Date().toISOString(),
          success: false,
        }, { merge: true });
      } catch (firestoreError) {
        logger.error("Failed to save error to Firestore:", firestoreError);
      }
    }
  }
);
