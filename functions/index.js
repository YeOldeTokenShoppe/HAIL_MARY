/**
 * Firebase Cloud Functions for HAIL_MARY Prayer Analysis
 */

const {setGlobalOptions} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/https");
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
exports.runScoringWorkflow = onSchedule({
  schedule: "0 * * * *",  // Every hour at minute 0
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 540,    // 9 minutes max
  secrets: ["CRON_SECRET"]
}, async (event) => {
  try {
    logger.info("[Scoring] Starting hourly scoring workflow...");

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      logger.error("[Scoring] CRON_SECRET not configured");
      return;
    }

    // Firebase App Hosting URL
    const appUrl = process.env.APP_URL || "https://pumpkin--hailmary-3ff6c.us-central1.hosted.app";
    const scoringEndpoint = `${appUrl}/api/cron/run-scoring`;

    logger.info("[Scoring] Calling:", scoringEndpoint);

    // Call the Next.js API endpoint
    const response = await fetch(scoringEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
        "Content-Type": "application/json"
      },
      // 5 minute timeout for the fetch
      signal: AbortSignal.timeout(300000)
    });

    const result = await response.json();

    if (result.success) {
      logger.info("[Scoring] Workflow completed successfully:", {
        duration: result.duration,
        agents: result.agentsCompleted,
        tradeable: result.summary?.tradeable
      });
    } else {
      logger.error("[Scoring] Workflow failed:", result.error);
    }

    // Log result to Firestore for monitoring
    await db.collection('scoringRuns').add({
      timestamp: new Date(),
      success: result.success,
      duration: result.duration,
      agentsCompleted: result.agentsCompleted || [],
      summary: result.summary || null,
      error: result.error || null
    });

  } catch (error) {
    logger.error("[Scoring] Fatal error:", error);

    // Log failure to Firestore
    await db.collection('scoringRuns').add({
      timestamp: new Date(),
      success: false,
      error: error.message
    });
  }
});

// Manual trigger for scoring (for testing)
exports.runScoringManual = onRequest({
  secrets: ["CRON_SECRET"]
}, async (req, res) => {
  try {
    logger.info("[Scoring] Manual trigger requested");

    const event = { scheduleTime: new Date().toISOString() };
    await exports.runScoringWorkflow.run(event);

    res.json({ success: true, message: "Scoring workflow triggered manually" });
  } catch (error) {
    logger.error("[Scoring] Manual trigger failed:", error);
    res.status(500).json({ error: error.message });
  }
});
