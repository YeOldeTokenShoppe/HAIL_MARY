/**
 * Firebase Cloud Functions for HAIL_MARY Prayer Analysis
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

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
// WEEKLY PREDICTION MARKET CREATION
// =============================================================================

const { createThirdwebClient, getContract, prepareContractCall, sendTransaction, readContract } = require("thirdweb");
const { privateKeyToAccount } = require("thirdweb/wallets");
const { defineChain } = require("thirdweb/chains");
const { defineSecret } = require("firebase-functions/params");

// Secret for contract owner private key
const ownerPrivateKey = defineSecret("OWNER_PRIVATE_KEY");

// Contract configuration
const PREDICTION_MARKET_ADDRESS = "0x3e34244D9F9c6CD1Ad970Cf02247d74e5451818c";
const THIRDWEB_CLIENT_ID = "cbae42251fe95b7e26a19a326b96ce5c";
const CHAIN_ID = 84532; // Base Sepolia

// Oracle options for prediction markets
const ORACLE_OPTIONS = [
  { id: 'EMO', name: 'EMO (Sentiment)', color: '#ff8800' },
  { id: 'TEKNO', name: 'TEKNO (Technical)', color: '#aa44ff' },
  { id: 'MACRO', name: 'MACRO (Macro)', color: '#00c8ff' }
];

/**
 * Get current week ID and bounds (Monday-Sunday)
 */
function getWeekInfo() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Monday 00:00:00
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Sunday 23:59:59.999
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Week ID
  const year = weekStart.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const weekNum = Math.ceil(((weekStart - jan1) / 86400000 + 1) / 7);
  const weekId = year + "-W" + weekNum.toString().padStart(2, '0');

  return { weekId, weekStart, weekEnd, weekNum };
}

/**
 * Create weekly oracle market in Firebase and on-chain
 */
async function createWeeklyMarket(privateKey) {
  const { weekId, weekStart, weekEnd, weekNum } = getWeekInfo();
  const marketId = "oracle-accuracy-" + weekId;

  // Check if market already exists
  const existingDoc = await db.collection('predictionMarkets').doc(marketId).get();
  if (existingDoc.exists) {
    logger.info("[PredictionMarket] Market " + marketId + " already exists");
    return { success: true, existed: true, marketId };
  }

  // Format end date as "Jan 26", "Feb 2", etc.
  const endDateStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const question = "Most accurate oracle for week ending " + endDateStr + "?";
  const optionNames = ORACLE_OPTIONS.map(o => o.id);

  // Calculate duration in seconds (from now until Sunday)
  const now = new Date();
  const durationSeconds = Math.floor((weekEnd - now) / 1000);

  logger.info("[PredictionMarket] Creating market: " + question);
  logger.info("[PredictionMarket] Duration: " + durationSeconds + " seconds (until " + weekEnd.toISOString() + ")");

  // Create on-chain market
  let onChainMarketId = null;
  let onChainTxHash = null;

  try {
    const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
    const chain = defineChain(CHAIN_ID);
    const account = privateKeyToAccount({ client, privateKey });

    const contract = getContract({
      client,
      chain,
      address: PREDICTION_MARKET_ADDRESS,
    });

    // Get current market count before creating
    const marketCountBefore = await readContract({
      contract,
      method: "function marketCount() view returns (uint256)",
      params: [],
    });

    // Create the market on-chain
    const tx = prepareContractCall({
      contract,
      method: "function createMarket(string _question, string[] _options, uint256 _duration) returns (uint256)",
      params: [question, optionNames, BigInt(durationSeconds)],
    });

    const txResult = await sendTransaction({
      transaction: tx,
      account,
    });

    onChainTxHash = txResult.transactionHash;
    onChainMarketId = Number(marketCountBefore); // New market ID is the previous count (0-indexed)

    logger.info("[PredictionMarket] On-chain market created: ID=" + onChainMarketId + ", TX=" + onChainTxHash);
  } catch (error) {
    logger.error("[PredictionMarket] Failed to create on-chain market:", error);
    throw error; // Don't continue if on-chain fails
  }

  // Create Firebase market document
  const market = {
    id: marketId,
    type: 'oracle_accuracy',
    question,
    description: 'Bet on which AI oracle will have the highest directional accuracy this week.',
    weekId,
    options: ORACLE_OPTIONS.map(opt => ({
      ...opt,
      pool: 0,
      betCount: 0
    })),
    totalPool: 0,
    totalBets: 0,
    startTime: weekStart.toISOString(),
    endTime: weekEnd.toISOString(),
    resolved: false,
    winner: null,
    winnerAccuracy: null,
    createdAt: new Date(),
    createdAtISO: new Date().toISOString(),
    onChainMarketId,
    onChainTxHash
  };

  await db.collection('predictionMarkets').doc(marketId).set(market);

  logger.info("[PredictionMarket] Firebase market created: " + marketId);

  return {
    success: true,
    marketId,
    onChainMarketId,
    onChainTxHash,
    endTime: weekEnd.toISOString()
  };
}

/**
 * Scheduled function - runs every Monday at 00:05 UTC
 * Creates the weekly oracle accuracy market
 *
 * DISABLED 2026-01-23: Automated prediction market creation turned off per user request
 */
// exports.createWeeklyPredictionMarket = onSchedule({
//   schedule: "5 0 * * 1", // Every Monday at 00:05 UTC
//   timeZone: "UTC",
//   memory: "256MiB",
//   timeoutSeconds: 120,
//   secrets: [ownerPrivateKey],
// }, async (event) => {
//   logger.info("[PredictionMarket] Running scheduled weekly market creation...");
//
//   try {
//     const result = await createWeeklyMarket(ownerPrivateKey.value());
//     logger.info("[PredictionMarket] Weekly market creation result:", result);
//
//     // Log to Firestore for monitoring
//     await db.collection('predictionMarketRuns').add({
//       timestamp: new Date(),
//       success: true,
//       ...result
//     });
//
//     return result;
//   } catch (error) {
//     logger.error("[PredictionMarket] Error creating weekly market:", error);
//
//     await db.collection('predictionMarketRuns').add({
//       timestamp: new Date(),
//       success: false,
//       error: error.message
//     });
//
//     throw error;
//   }
// });

/**
 * Manual trigger to create weekly market
 *
 * DISABLED 2026-01-23: Automated prediction market creation turned off per user request
 */
// exports.createWeeklyPredictionMarketManual = onRequest({
//   secrets: [ownerPrivateKey, "CRON_SECRET"],
// }, async (req, res) => {
//   // Verify authorization
//   const authHeader = req.headers.authorization;
//   const cronSecret = process.env.CRON_SECRET;
//
//   if (!authHeader || authHeader !== "Bearer " + cronSecret) {
//     res.status(401).json({ error: "Unauthorized" });
//     return;
//   }
//
//   try {
//     logger.info("[PredictionMarket] Manual trigger requested");
//     const result = await createWeeklyMarket(ownerPrivateKey.value());
//     res.json(result);
//   } catch (error) {
//     logger.error("[PredictionMarket] Manual trigger failed:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// =============================================================================
// WEEKLY PREDICTION MARKET RESOLUTION
// =============================================================================

/**
 * Calculate oracle accuracy for the week from stored oracle calls
 */
async function calculateWeeklyAccuracy(weekStart, weekEnd) {
  // Query oracle calls for this week
  const oracleCallsRef = db.collection('oracleCalls');
  const snapshot = await oracleCallsRef
    .where('timestamp', '>=', weekStart.toISOString())
    .where('timestamp', '<=', weekEnd.toISOString())
    .get();

  if (snapshot.empty) {
    logger.warn("[PredictionMarket] No oracle calls found for this week");
    return null;
  }

  // Track accuracy for each oracle
  const oracleStats = {
    EMO: { correct: 0, total: 0 },
    TEKNO: { correct: 0, total: 0 },
    MACRO: { correct: 0, total: 0 }
  };

  snapshot.forEach(doc => {
    const data = doc.data();

    // Check if this call has been verified (has actual outcome)
    if (data.verified && data.actualDirection) {
      const oracles = ['EMO', 'TEKNO', 'MACRO'];

      oracles.forEach(oracle => {
        if (data[oracle.toLowerCase() + 'Direction'] || data[oracle + '_direction']) {
          oracleStats[oracle].total++;
          const predicted = data[oracle.toLowerCase() + 'Direction'] || data[oracle + '_direction'];
          if (predicted === data.actualDirection) {
            oracleStats[oracle].correct++;
          }
        }
      });
    }
  });

  // Calculate accuracy percentages
  const results = {};
  let winner = null;
  let highestAccuracy = -1;

  Object.entries(oracleStats).forEach(([oracle, stats]) => {
    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    results[oracle] = {
      accuracy: accuracy.toFixed(2),
      correct: stats.correct,
      total: stats.total
    };

    if (accuracy > highestAccuracy) {
      highestAccuracy = accuracy;
      winner = oracle;
    }
  });

  return {
    stats: results,
    winner,
    winnerAccuracy: highestAccuracy.toFixed(2)
  };
}

/**
 * Get previous week's info (for resolving last week's market)
 */
function getPreviousWeekInfo() {
  const now = new Date();
  // Go back to last week
  const lastWeek = new Date(now);
  lastWeek.setDate(now.getDate() - 7);

  const dayOfWeek = lastWeek.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Monday 00:00:00 of last week
  const weekStart = new Date(lastWeek);
  weekStart.setDate(lastWeek.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Sunday 23:59:59.999 of last week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Week ID
  const year = weekStart.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const weekNum = Math.ceil(((weekStart - jan1) / 86400000 + 1) / 7);
  const weekId = year + "-W" + weekNum.toString().padStart(2, '0');

  return { weekId, weekStart, weekEnd, weekNum };
}

/**
 * Resolve a prediction market
 */
async function resolveWeeklyMarket(privateKey, marketId = null) {
  // Get previous week's info (we resolve last week's market)
  const { weekId, weekStart, weekEnd } = getPreviousWeekInfo();
  const firebaseMarketId = marketId || ("oracle-accuracy-" + weekId);

  logger.info("[PredictionMarket] Resolving market: " + firebaseMarketId);

  // Get the market from Firebase
  const marketDoc = await db.collection('predictionMarkets').doc(firebaseMarketId).get();

  if (!marketDoc.exists) {
    logger.error("[PredictionMarket] Market not found: " + firebaseMarketId);
    return { success: false, error: "Market not found" };
  }

  const market = marketDoc.data();

  if (market.resolved) {
    logger.info("[PredictionMarket] Market already resolved: " + firebaseMarketId);
    return { success: true, alreadyResolved: true };
  }

  // Calculate accuracy for the week
  const accuracyResult = await calculateWeeklyAccuracy(weekStart, weekEnd);

  if (!accuracyResult || !accuracyResult.winner) {
    logger.error("[PredictionMarket] Could not determine winner - no accuracy data");
    return { success: false, error: "No accuracy data available" };
  }

  const { winner, winnerAccuracy, stats } = accuracyResult;

  // Map winner to option index (EMO=1, TEKNO=2, MACRO=3 for 1-based contract)
  const optionIndex = ORACLE_OPTIONS.findIndex(o => o.id === winner) + 1;

  logger.info("[PredictionMarket] Winner: " + winner + " (" + winnerAccuracy + "%) - Option index: " + optionIndex);

  // Resolve on-chain
  const onChainMarketId = market.onChainMarketId;
  let onChainResolved = false;
  let onChainCancelled = false;
  let resolveTxHash = null;

  if (onChainMarketId !== null && onChainMarketId !== undefined) {
    try {
      const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
      const chain = defineChain(CHAIN_ID);
      const account = privateKeyToAccount({ client, privateKey });

      const contract = getContract({
        client,
        chain,
        address: PREDICTION_MARKET_ADDRESS,
      });

      // Try to resolve the market
      try {
        const tx = prepareContractCall({
          contract,
          method: "function resolveMarket(uint256 _marketId, uint8 _winningOption)",
          params: [BigInt(onChainMarketId), optionIndex],
        });

        const txResult = await sendTransaction({
          transaction: tx,
          account,
        });

        resolveTxHash = txResult.transactionHash;
        onChainResolved = true;
        logger.info("[PredictionMarket] On-chain market resolved: TX=" + resolveTxHash);
      } catch (resolveError) {
        // If resolve fails (likely no bets on winner), try to cancel
        logger.warn("[PredictionMarket] Resolve failed, attempting cancel:", resolveError.message);

        if (resolveError.message && resolveError.message.includes("No one bet on winning option")) {
          const cancelTx = prepareContractCall({
            contract,
            method: "function cancelMarket(uint256 _marketId)",
            params: [BigInt(onChainMarketId)],
          });

          const cancelResult = await sendTransaction({
            transaction: cancelTx,
            account,
          });

          resolveTxHash = cancelResult.transactionHash;
          onChainCancelled = true;
          logger.info("[PredictionMarket] On-chain market cancelled: TX=" + resolveTxHash);
        } else {
          throw resolveError;
        }
      }
    } catch (error) {
      logger.error("[PredictionMarket] On-chain resolution failed:", error);
      // Continue with Firebase update even if on-chain fails
    }
  }

  // Update Firebase market
  const updateData = {
    resolved: true,
    winner: onChainCancelled ? null : winner,
    winnerAccuracy: onChainCancelled ? null : parseFloat(winnerAccuracy),
    accuracyStats: stats,
    resolvedAt: new Date(),
    resolvedAtISO: new Date().toISOString(),
    resolveTxHash,
    onChainResolved,
    onChainCancelled,
    winningOption: onChainCancelled ? 0 : optionIndex
  };

  await db.collection('predictionMarkets').doc(firebaseMarketId).update(updateData);

  logger.info("[PredictionMarket] Market resolved in Firebase: " + firebaseMarketId);

  // Update all bets for this market
  const betsSnapshot = await db.collection('predictionBets')
    .where('marketId', '==', firebaseMarketId)
    .get();

  const batch = db.batch();
  betsSnapshot.forEach(betDoc => {
    const bet = betDoc.data();
    const won = !onChainCancelled && bet.optionId === winner;

    batch.update(betDoc.ref, {
      resolved: true,
      won: onChainCancelled ? null : won,
      cancelled: onChainCancelled,
      resolvedAt: new Date()
    });
  });

  if (!betsSnapshot.empty) {
    await batch.commit();
    logger.info("[PredictionMarket] Updated " + betsSnapshot.size + " bets");
  }

  return {
    success: true,
    marketId: firebaseMarketId,
    winner: onChainCancelled ? null : winner,
    winnerAccuracy: onChainCancelled ? null : winnerAccuracy,
    stats,
    onChainResolved,
    onChainCancelled,
    resolveTxHash
  };
}

/**
 * Scheduled function - runs every Sunday at 23:55 UTC
 * Resolves the current week's market based on oracle accuracy
 *
 * DISABLED 2026-01-23: Automated prediction market resolution turned off per user request
 */
// exports.resolveWeeklyPredictionMarket = onSchedule({
//   schedule: "55 23 * * 0", // Every Sunday at 23:55 UTC
//   timeZone: "UTC",
//   memory: "256MiB",
//   timeoutSeconds: 120,
//   secrets: [ownerPrivateKey],
// }, async (event) => {
//   logger.info("[PredictionMarket] Running scheduled weekly market resolution...");
//
//   try {
//     // For Sunday resolution, we resolve the CURRENT week's market
//     const { weekId } = getWeekInfo();
//     const marketId = "oracle-accuracy-" + weekId;
//
//     const result = await resolveWeeklyMarket(ownerPrivateKey.value(), marketId);
//     logger.info("[PredictionMarket] Weekly market resolution result:", result);
//
//     // Log to Firestore for monitoring
//     await db.collection('predictionMarketRuns').add({
//       timestamp: new Date(),
//       action: 'resolve',
//       success: result.success,
//       ...result
//     });
//
//     return result;
//   } catch (error) {
//     logger.error("[PredictionMarket] Error resolving weekly market:", error);
//
//     await db.collection('predictionMarketRuns').add({
//       timestamp: new Date(),
//       action: 'resolve',
//       success: false,
//       error: error.message
//     });
//
//     throw error;
//   }
// });

/**
 * Manual trigger to resolve a market
 *
 * DISABLED 2026-01-23: Automated prediction market resolution turned off per user request
 */
// exports.resolveWeeklyPredictionMarketManual = onRequest({
//   secrets: [ownerPrivateKey, "CRON_SECRET"],
// }, async (req, res) => {
//   // Verify authorization
//   const authHeader = req.headers.authorization;
//   const cronSecret = process.env.CRON_SECRET;
//
//   if (!authHeader || authHeader !== "Bearer " + cronSecret) {
//     res.status(401).json({ error: "Unauthorized" });
//     return;
//   }
//
//   try {
//     logger.info("[PredictionMarket] Manual resolution trigger requested");
//
//     // Allow specifying a specific market ID in query params
//     const marketId = req.query.marketId || null;
//
//     const result = await resolveWeeklyMarket(ownerPrivateKey.value(), marketId);
//     res.json(result);
//   } catch (error) {
//     logger.error("[PredictionMarket] Manual resolution failed:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
