/**
 * Scoring Orchestrator - Server-side Agent Workflow
 *
 * Runs the complete EMO → TEKNO → MACRO → RL80 scoring workflow
 * directly on the server (Railway). No API calls - everything runs
 * server-side and logs to Firestore.
 *
 * Usage:
 *   node -r dotenv/config src/trading/services/scoringOrchestrator.js
 *   or import and call runScoringWorkflow()
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Import agent scoring functions
import { callSentimentOracleWithScoring } from '../agents/sentiment-oracle.js';
import { callMarketAnalystWithScoring } from '../agents/market-analyst.js';
import { callMacroSpecialistWithScoring } from '../agents/macro-specialist.js';
import { generateRL80ScoringDecision } from '../agents/rl80-trader.js';

// Import scoring services
import { ANALYST_WEIGHTS, FIREBASE_COLLECTIONS } from '../config/scoring-config.js';
import { logAnalystScores } from './decisionLogger.js';

// Import oracle accuracy tracking for prediction markets
import { logAllOracleCalls, verifyPendingCalls } from './oracleAccuracyService.js';
import { ensureCurrentWeekMarket, checkAndResolveMarkets } from './predictionMarketService.js';

// ============================================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================================

let db = null;

function initFirebaseAdmin() {
  if (db) return db;

  try {
    // Check if already initialized
    if (getApps().length === 0) {
      // Initialize with service account or application default credentials
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Using service account file
        initializeApp({
          credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        });
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Using service account JSON from env var
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      } else {
        // Fallback to application default credentials (for GCP environments)
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        });
      }
    }

    db = getFirestore();
    console.log('[ScoringOrchestrator] Firebase Admin initialized');
    return db;
  } catch (error) {
    console.error('[ScoringOrchestrator] Firebase Admin init failed:', error);
    throw error;
  }
}

// ============================================================================
// MARKET DATA FETCHING
// ============================================================================

/**
 * Fetch live market data from Firestore
 */
async function fetchMarketData() {
  const firestore = initFirebaseAdmin();

  try {
    // Get market data from Railway service
    const marketDataDoc = await firestore.collection('marketData').doc('latest').get();
    const agentContextDoc = await firestore.collection('agentContext').doc('market').get();
    const lighterAccountDoc = await firestore.collection('lighterData').doc('account').get();
    const lighterTradingDoc = await firestore.collection('lighterData').doc('trading').get();
    const newsDataDoc = await firestore.collection('newsData').doc('latest').get();

    const marketData = marketDataDoc.exists ? marketDataDoc.data() : {};
    const agentContext = agentContextDoc.exists ? agentContextDoc.data() : {};
    const lighterAccount = lighterAccountDoc.exists ? lighterAccountDoc.data() : {};
    const lighterTrading = lighterTradingDoc.exists ? lighterTradingDoc.data() : {};
    const newsData = newsDataDoc.exists ? newsDataDoc.data() : {};

    // No fallback values - agents work with whatever data is available
    // Missing data = null, agents should handle gracefully
    return {
      btcPrice: marketData.btcPrice || null,
      ethPrice: marketData.ethPrice || null,
      fearGreed: agentContext.fearGreed ?? null,
      fundingRate: agentContext.fundingRate ?? null,
      vix: agentContext.vix ?? null,
      dxy: agentContext.dxy ?? null,
      openInterest: agentContext.openInterest ?? null,
      marketSentiment: agentContext.marketSentiment || null,
      trend: agentContext.trend || null,
      timestamp: new Date().toISOString(),
      lastUpdate: marketData.lastUpdate || agentContext.lastUpdate || null,
      trading: {
        balance: lighterAccount.balance ?? 0,
        positions: lighterTrading.positions || [],
        orders: lighterTrading.orders || [],
        positionCount: lighterTrading.positionCount ?? 0,
        orderCount: lighterTrading.orderCount ?? 0
      },
      // News data for EMO sentiment analysis
      news: {
        headlines: newsData.headlines || [],
        sentiment: newsData.sentiment || null,
        sentimentScore: newsData.sentimentScore ?? null,
        topStories: newsData.topStories || [],
        lastUpdate: newsData.lastUpdate || null
      }
    };
  } catch (error) {
    console.error('[ScoringOrchestrator] Failed to fetch market data:', error);
    // Return empty data - no fake values, agents handle missing data
    return {
      btcPrice: null,
      ethPrice: null,
      fearGreed: null,
      fundingRate: null,
      vix: null,
      dxy: null,
      openInterest: null,
      marketSentiment: null,
      trend: null,
      timestamp: new Date().toISOString(),
      error: error.message,
      trading: { balance: 0, positions: [], orders: [] },
      news: { headlines: [], sentiment: null, sentimentScore: null, topStories: [] }
    };
  }
}

/**
 * Fetch recent chat messages from Firestore
 */
async function fetchRecentMessages(limit = 10) {
  const firestore = initFirebaseAdmin();

  try {
    const snapshot = await firestore
      .collection('agentChat')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse(); // Reverse to get chronological order
  } catch (error) {
    console.error('[ScoringOrchestrator] Failed to fetch messages:', error);
    return [];
  }
}

/**
 * Fetch portfolio state for risk checks
 */
async function fetchPortfolioState() {
  const firestore = initFirebaseAdmin();

  try {
    const lighterTradingDoc = await firestore.collection('lighterData').doc('trading').get();
    const dailyPnLDoc = await firestore.collection('tradingStats').doc('daily').get();

    const tradingData = lighterTradingDoc.exists ? lighterTradingDoc.data() : {};
    const dailyStats = dailyPnLDoc.exists ? dailyPnLDoc.data() : {};

    return {
      positions: tradingData.positions || [],
      dailyPnL: dailyStats.pnlPercent || 0
    };
  } catch (error) {
    console.error('[ScoringOrchestrator] Failed to fetch portfolio state:', error);
    return { positions: [], dailyPnL: 0 };
  }
}

// ============================================================================
// FIRESTORE LOGGING
// ============================================================================

/**
 * Save agent chat message to Firestore
 */
async function saveMessageToFirestore(agent, message, type = 'trading', sentiment = 'neutral', additionalData = {}) {
  const firestore = initFirebaseAdmin();

  try {
    // Calculate expireAt for TTL (7 days from now)
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 7);

    const docRef = await firestore.collection('agentChat').add({
      agent,
      message,
      type,
      sentiment,
      timestamp: FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
      expireAt: expireAt,  // TTL field - document expires after 7 days
      ...additionalData
    });

    console.log(`[ScoringOrchestrator] Saved ${agent} message: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error(`[ScoringOrchestrator] Failed to save ${agent} message:`, error);
    return null;
  }
}

/**
 * Save agent scores to Firestore
 */
async function saveAgentScoresToFirestore(scoreOutput) {
  const firestore = initFirebaseAdmin();

  try {
    const docId = `${scoreOutput.timestamp}_${scoreOutput.agentId}`;

    // Calculate expireAt for TTL (7 days from now)
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 7);

    await firestore.collection(FIREBASE_COLLECTIONS.AGENT_SCORES).doc(docId).set({
      ...scoreOutput,
      createdAt: FieldValue.serverTimestamp(),
      createdAtISO: new Date().toISOString(),
      expireAt: expireAt  // TTL field - document expires after 7 days
    });

    console.log(`[ScoringOrchestrator] Saved ${scoreOutput.agentId} scores: ${docId}`);
    return docId;
  } catch (error) {
    console.error(`[ScoringOrchestrator] Failed to save scores:`, error);
    return null;
  }
}

/**
 * Save workflow summary to Firestore
 */
async function saveWorkflowSummary(workflowResult) {
  const firestore = initFirebaseAdmin();

  try {
    // Calculate expireAt for TTL (7 days from now)
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 7);

    const docRef = await firestore.collection('workflowRuns').add({
      timestamp: FieldValue.serverTimestamp(),
      expireAt: expireAt,  // TTL field - document expires after 7 days
      startedAt: workflowResult.startedAt,
      completedAt: workflowResult.completedAt,
      duration: workflowResult.duration,
      success: workflowResult.success,
      agentsCompleted: workflowResult.agentsCompleted,
      decision: workflowResult.decision ? {
        recommendations: workflowResult.decision.tradeableRecommendations,
        summary: workflowResult.decision.summary
      } : null,
      error: workflowResult.error || null
    });

    console.log(`[ScoringOrchestrator] Saved workflow summary: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('[ScoringOrchestrator] Failed to save workflow summary:', error);
    return null;
  }
}

/**
 * Post trading decision to agentDecisions/RL80 for Railway to execute
 * THIS IS THE CRITICAL FUNCTION that triggers actual trade execution
 */
async function postDecisionForExecution(recommendation, decisionOutput, marketData) {
  const firestore = initFirebaseAdmin();

  try {
    // Map direction to action
    const action = recommendation.direction === 'LONG' ? 'BUY' :
                   recommendation.direction === 'SHORT' ? 'SELL' : 'HOLD';

    // Build the decision document that Railway service expects
    const decision = {
      action,
      symbol: recommendation.asset || 'ETH',
      confidence: recommendation.confidence || 0.6,
      reasoning: decisionOutput.textResponse?.substring(0, 500) || 'Team consensus trade',
      position_size: recommendation.sizePercent || null,
      stop_loss: null,
      take_profit: null,
      timestamp: Date.now(),
      created_at: FieldValue.serverTimestamp(),
      agent_version: 'ScoringOrchestrator_v1',
      // Additional context for logging
      team_score: recommendation.teamScore || null,
      tradeable_count: decisionOutput.summary?.tradeable || 0
    };

    // Post to agentDecisions/RL80 - this is what Railway listens to
    await firestore.collection('agentDecisions').doc('RL80').set(decision);

    console.log(`[ScoringOrchestrator] 🚀 Posted ${action} decision to agentDecisions/RL80:`, {
      action,
      symbol: decision.symbol,
      confidence: (decision.confidence * 100).toFixed(0) + '%',
      size: decision.position_size ? (decision.position_size * 100).toFixed(1) + '%' : 'default'
    });

    return true;
  } catch (error) {
    console.error('[ScoringOrchestrator] Failed to post decision for execution:', error);
    return false;
  }
}

/**
 * Post a HOLD decision when there are no tradeable signals
 */
async function postHoldDecision(reasoning) {
  const firestore = initFirebaseAdmin();

  try {
    const decision = {
      action: 'HOLD',
      symbol: 'ETH',
      confidence: 0.3,
      reasoning: reasoning || 'No clear edge - waiting for better setup',
      timestamp: Date.now(),
      created_at: FieldValue.serverTimestamp(),
      agent_version: 'ScoringOrchestrator_v1'
    };

    await firestore.collection('agentDecisions').doc('RL80').set(decision);
    console.log('[ScoringOrchestrator] Posted HOLD decision to agentDecisions/RL80');

    return true;
  } catch (error) {
    console.error('[ScoringOrchestrator] Failed to post HOLD decision:', error);
    return false;
  }
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

/**
 * Run the complete scoring workflow
 * EMO → TEKNO → MACRO → RL80
 */
export async function runScoringWorkflow() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('[ScoringOrchestrator] Starting scoring workflow...');
  console.log(`[ScoringOrchestrator] Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Initialize Firebase
  initFirebaseAdmin();

  // Fetch market data and recent messages
  const marketData = await fetchMarketData();
  const recentMessages = await fetchRecentMessages();
  const portfolioState = await fetchPortfolioState();

  console.log('[ScoringOrchestrator] Market data:', {
    btcPrice: marketData.btcPrice,
    fearGreed: marketData.fearGreed,
    vix: marketData.vix
  });

  // Build context
  const context = {
    marketData,
    lastMessages: recentMessages.slice(-5),
    recentMessages
  };

  // Get API keys
  const grokKey = process.env.GROK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Workflow state
  const workflowResult = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    duration: 0,
    success: false,
    agentsCompleted: [],
    scores: {},
    decision: null,
    error: null
  };

  try {
    // =========================================================================
    // Step 1: EMO (Sentiment Analysis)
    // =========================================================================
    console.log('\n📍 Step 1/4: EMO starting sentiment analysis...');

    let emoScoreOutput = null;
    try {
      if (!grokKey) throw new Error('GROK_API_KEY not configured');

      emoScoreOutput = await callSentimentOracleWithScoring(context, grokKey);

      // Save to Firestore
      await saveMessageToFirestore('EMO', emoScoreOutput.textResponse, 'sentiment', 'neutral', {
        scoringMode: true,
        scores: emoScoreOutput.scores
      });
      await saveAgentScoresToFirestore(emoScoreOutput);

      workflowResult.scores.EMO = emoScoreOutput;
      workflowResult.agentsCompleted.push('EMO');
      console.log(`✅ EMO completed: ${emoScoreOutput.scores?.length || 0} scores`);

    } catch (error) {
      console.error('❌ EMO failed:', error.message);
      await saveMessageToFirestore('EMO', `⚠️ Analysis unavailable: ${error.message}`, 'error', 'warning');
    }

    // Wait between agents
    await delay(5000);

    // =========================================================================
    // Step 2: TEKNO (Technical Analysis)
    // =========================================================================
    console.log('\n📍 Step 2/4: TEKNO starting technical analysis...');

    let teknoScoreOutput = null;
    try {
      if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

      teknoScoreOutput = await callMarketAnalystWithScoring(context, openaiKey);

      await saveMessageToFirestore('TEKNO', teknoScoreOutput.textResponse, 'market', 'neutral', {
        scoringMode: true,
        scores: teknoScoreOutput.scores
      });
      await saveAgentScoresToFirestore(teknoScoreOutput);

      workflowResult.scores.TEKNO = teknoScoreOutput;
      workflowResult.agentsCompleted.push('TEKNO');
      console.log(`✅ TEKNO completed: ${teknoScoreOutput.scores?.length || 0} scores`);

    } catch (error) {
      console.error('❌ TEKNO failed:', error.message);
      await saveMessageToFirestore('TEKNO', `⚠️ Analysis unavailable: ${error.message}`, 'error', 'warning');
    }

    await delay(5000);

    // =========================================================================
    // Step 3: MACRO (Macroeconomic Analysis)
    // =========================================================================
    console.log('\n📍 Step 3/4: MACRO starting macro analysis...');

    let macroScoreOutput = null;
    try {
      if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

      macroScoreOutput = await callMacroSpecialistWithScoring(context, anthropicKey);

      await saveMessageToFirestore('MACRO', macroScoreOutput.textResponse, 'macro', 'neutral', {
        scoringMode: true,
        scores: macroScoreOutput.scores
      });
      await saveAgentScoresToFirestore(macroScoreOutput);

      workflowResult.scores.MACRO = macroScoreOutput;
      workflowResult.agentsCompleted.push('MACRO');
      console.log(`✅ MACRO completed: ${macroScoreOutput.scores?.length || 0} scores`);

    } catch (error) {
      console.error('❌ MACRO failed:', error.message);
      await saveMessageToFirestore('MACRO', `⚠️ Analysis unavailable: ${error.message}`, 'error', 'warning');
    }

    await delay(5000);

    // =========================================================================
    // Oracle Accuracy Tracking (for Prediction Markets)
    // =========================================================================
    try {
      // Log all oracle calls for accuracy tracking
      const prices = {
        BTC: marketData.btcPrice,
        ETH: marketData.ethPrice,
        SOL: marketData.solPrice || null,
        XRP: marketData.xrpPrice || null
      };

      await logAllOracleCalls(workflowResult.scores, prices);
      console.log('📊 Oracle calls logged for accuracy tracking');

      // Verify any pending calls from ~24 hours ago
      const verification = await verifyPendingCalls(prices);
      if (verification.verified?.length > 0) {
        console.log(`📊 Verified ${verification.verified.length} oracle predictions from 24h ago`);
      }
    } catch (error) {
      console.error('⚠️ Oracle accuracy tracking failed (non-blocking):', error.message);
      // Non-blocking - don't fail the workflow for accuracy tracking
    }

    // =========================================================================
    // Step 4: RL80 (Final Trading Decision)
    // =========================================================================
    console.log('\n📍 Step 4/4: RL80 making final trading decision...');

    try {
      // Only proceed if we have at least some scores
      const hasScores = Object.values(workflowResult.scores).some(s => s !== null);

      if (!hasScores) {
        throw new Error('No analyst scores available for decision');
      }

      const decisionOutput = await generateRL80ScoringDecision(
        context,
        workflowResult.scores,
        portfolioState
      );

      await saveMessageToFirestore('RL80', decisionOutput.textResponse, 'trading', 'positive', {
        scoringMode: true,
        decision: {
          recommendations: decisionOutput.tradeableRecommendations,
          summary: decisionOutput.summary
        }
      });

      // POST TO agentDecisions/RL80 for Railway service to execute
      // This is the critical step that triggers actual trade execution
      if (decisionOutput.tradeableRecommendations && decisionOutput.tradeableRecommendations.length > 0) {
        const primaryRec = decisionOutput.tradeableRecommendations[0];
        await postDecisionForExecution(primaryRec, decisionOutput, marketData);
      } else {
        // Post HOLD decision so Railway knows we're still active
        await postHoldDecision('No tradeable signals above threshold');
      }

      workflowResult.decision = decisionOutput;
      workflowResult.agentsCompleted.push('RL80');
      console.log(`✅ RL80 completed: ${decisionOutput.summary?.tradeable || 0} tradeable recommendations`);

    } catch (error) {
      console.error('❌ RL80 failed:', error.message);
      await saveMessageToFirestore('RL80', `⚠️ Decision unavailable: ${error.message}`, 'error', 'warning');
      workflowResult.error = error.message;
    }

    // =========================================================================
    // Workflow Complete
    // =========================================================================
    workflowResult.success = workflowResult.agentsCompleted.length === 4;
    workflowResult.completedAt = new Date().toISOString();
    workflowResult.duration = Date.now() - startTime;

    // Save workflow summary
    await saveWorkflowSummary(workflowResult);

    // =========================================================================
    // Prediction Market Maintenance (runs after workflow)
    // =========================================================================
    try {
      // Ensure current week's oracle accuracy market exists
      const marketResult = await ensureCurrentWeekMarket();
      if (marketResult.success && !marketResult.existed) {
        console.log('🎲 Created new weekly oracle accuracy market');
      }

      // Check and resolve any ended markets
      const resolveResult = await checkAndResolveMarkets();
      if (resolveResult.resolved?.length > 0) {
        console.log(`🎲 Resolved ${resolveResult.resolved.length} prediction market(s)`);
      }
    } catch (error) {
      console.error('⚠️ Prediction market maintenance failed (non-blocking):', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('[ScoringOrchestrator] Workflow completed!');
    console.log(`[ScoringOrchestrator] Duration: ${(workflowResult.duration / 1000).toFixed(1)}s`);
    console.log(`[ScoringOrchestrator] Agents: ${workflowResult.agentsCompleted.join(' → ')}`);
    console.log(`[ScoringOrchestrator] Success: ${workflowResult.success}`);
    console.log('='.repeat(60));

    return workflowResult;

  } catch (error) {
    console.error('[ScoringOrchestrator] Workflow failed:', error);
    workflowResult.error = error.message;
    workflowResult.completedAt = new Date().toISOString();
    workflowResult.duration = Date.now() - startTime;

    await saveWorkflowSummary(workflowResult);

    return workflowResult;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run workflow on a schedule
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 */
export function startScheduledWorkflow(intervalMs = 3600000) {
  console.log(`[ScoringOrchestrator] Starting scheduled workflow (every ${intervalMs / 60000} minutes)`);

  // Run immediately
  runScoringWorkflow();

  // Then run on interval
  setInterval(() => {
    runScoringWorkflow();
  }, intervalMs);
}

/**
 * Health check - verify all services are accessible
 */
export async function healthCheck() {
  const results = {
    firebase: false,
    grokApi: !!process.env.GROK_API_KEY,
    openaiApi: !!process.env.OPENAI_API_KEY,
    anthropicApi: !!process.env.ANTHROPIC_API_KEY
  };

  try {
    initFirebaseAdmin();
    const testDoc = await db.collection('healthCheck').doc('test').get();
    results.firebase = true;
  } catch (error) {
    console.error('Health check - Firebase failed:', error.message);
  }

  console.log('[ScoringOrchestrator] Health check:', results);
  return results;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    healthCheck().then(() => process.exit(0));
  } else if (args.includes('--scheduled')) {
    const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1]) || 3600000;
    startScheduledWorkflow(interval);
  } else {
    // Single run
    runScoringWorkflow().then(result => {
      process.exit(result.success ? 0 : 1);
    });
  }
}

export default {
  runScoringWorkflow,
  startScheduledWorkflow,
  healthCheck
};
