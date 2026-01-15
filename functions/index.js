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
  timeoutSeconds: 540
}, async (event) => {
  try {
    logger.info("[Prayer Analysis] Starting daily prayer analysis...");
    
    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error("[Prayer Analysis] OpenAI API key not configured");
      return;
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
        label: 'Awaiting Prayers',
        emotions: [{ name: 'Hope', value: 100, color: '#4ade80' }],
        prayersPerHour: 0,
        trend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        keywords: ['waiting', 'for', 'prayers'],
        summary: 'The congregation awaits the faithful to share their trading prayers and offerings to Our Lady of Perpetual Profit.',
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
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.message) {
        const timestamp = data.createdAt?.toMillis ? data.createdAt.toMillis() : 
                         data.timestamp || Date.now();
        
        prayers.push({
          id: doc.id,
          message: data.message,
          timestamp: timestamp,
          name: data.name || 'Anonymous'
        });
        
        if (timestamp > hourAgo) {
          recentCount++;
        }
      }
    });
    
    // Analyze prayers using our helper functions
    const { analyzePrayers, generateSummary } = require('./prayerAnalysisUtils');
    
    logger.info("[Prayer Analysis] Analyzing", prayers.length, "prayers...");
    const analysis = await analyzePrayers(prayers.slice(0, 100), apiKey);
    
    // Generate AI summary
    const summary = await generateSummary(prayers.slice(0, 20), apiKey);
    
    // Prepare final analysis
    const finalAnalysis = {
      ...analysis,
      summary: summary || 'The congregation\'s prayers reflect the eternal dance of hope and fear in the markets.',
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
      summary: 'Our mystical algorithms encountered turbulence in the digital ether. The analysis will resume tomorrow.',
      lastUpdate: new Date().toISOString(),
      totalAnalyzed: 0,
      error: error.message,
      updatedAt: new Date()
    };
    
    await db.collection('sentiment_analysis').doc('latest').set(errorAnalysis);
  }
});

// Manual trigger endpoint for testing
exports.analyzePrayersManual = onRequest(async (req, res) => {
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
