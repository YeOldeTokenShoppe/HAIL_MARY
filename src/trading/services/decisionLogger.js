/**
 * Decision Logger Service
 *
 * Logs all trading decisions to Firebase for analysis.
 * Includes analyst scores, aggregated results, shadow tests, and outcomes.
 */

import { FIREBASE_COLLECTIONS } from '../config/scoring-config.js';
import { createDecisionLog, createDecisionOutcome } from '../types/scoring.js';

// ============================================================================
// FIREBASE INITIALIZATION (LAZY)
// ============================================================================

let db = null;
let addDocFn = null;
let docFn = null;
let updateDocFn = null;
let getDocFn = null;
let queryFn = null;
let collectionFn = null;
let orderByFn = null;
let limitFn = null;
let getDocsFn = null;
let serverTimestampFn = null;
let whereFn = null;

/**
 * Initialize Firebase lazily
 */
async function initFirebase() {
  if (db) return db;

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const {
      getFirestore,
      collection,
      addDoc,
      doc,
      updateDoc,
      getDoc,
      query,
      orderBy,
      limit,
      getDocs,
      serverTimestamp,
      where
    } = await import('firebase/firestore');

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    };

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);

    // Store function references
    addDocFn = addDoc;
    docFn = doc;
    updateDocFn = updateDoc;
    getDocFn = getDoc;
    queryFn = query;
    collectionFn = collection;
    orderByFn = orderBy;
    limitFn = limit;
    getDocsFn = getDocs;
    serverTimestampFn = serverTimestamp;
    whereFn = where;

    console.log('[DecisionLogger] Firebase initialized');
    return db;
  } catch (error) {
    console.error('[DecisionLogger] Firebase init failed:', error);
    return null;
  }
}

// ============================================================================
// MAIN LOGGING FUNCTIONS
// ============================================================================

/**
 * Log a complete trading decision
 * @param {Object} params - Decision parameters
 * @param {string} params.asset - Asset symbol
 * @param {Object} params.analystOutputs - Outputs from each analyst
 * @param {Object} params.aggregatedScore - Aggregated score for asset
 * @param {Object} params.recommendation - Position recommendation
 * @param {Object} params.shadowTests - Shadow test results
 * @param {Object} params.marketData - Market data at decision time
 * @returns {Object} - { success, decisionId, error? }
 */
export async function logDecision({
  asset,
  analystOutputs,
  aggregatedScore,
  recommendation,
  shadowTests = {},
  marketData = {}
}) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      console.warn('[DecisionLogger] Firebase not available, logging to console');
      return logToConsole({ asset, analystOutputs, aggregatedScore, recommendation, shadowTests });
    }

    // Build analyst breakdown
    const analysts = {};
    for (const [agentId, output] of Object.entries(analystOutputs || {})) {
      const assetScore = output?.scores?.find(s => s.asset === asset);
      analysts[agentId] = {
        score: assetScore?.direction || 0,
        confidence: assetScore?.confidence || 0,
        rationale: assetScore?.rationale || ''
      };
    }

    // Create decision log
    const decisionLog = createDecisionLog(
      asset,
      analysts,
      aggregatedScore,
      recommendation,
      shadowTests
    );

    // Add market data and server timestamp
    const logDocument = {
      ...decisionLog,
      marketData: {
        btcPrice: marketData.btcPrice,
        ethPrice: marketData.ethPrice,
        fearGreed: marketData.fearGreed,
        vix: marketData.vix,
        dxy: marketData.dxy,
        fundingRate: marketData.fundingRate
      },
      createdAt: serverTimestampFn(),
      createdAtISO: new Date().toISOString()
    };

    // Save to Firebase
    const docRef = await addDocFn(
      collectionFn(firestore, FIREBASE_COLLECTIONS.DECISIONS),
      logDocument
    );

    console.log(`[DecisionLogger] Decision logged: ${docRef.id} for ${asset}`);

    return {
      success: true,
      decisionId: docRef.id,
      decision: decisionLog
    };
  } catch (error) {
    console.error('[DecisionLogger] Error logging decision:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Log analyst scores to Firebase
 * @param {Object} analystOutput - AnalystScoreOutput object
 * @returns {Object} - { success, docId, error? }
 */
export async function logAnalystScores(analystOutput) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      console.warn('[DecisionLogger] Firebase not available');
      return { success: false, error: 'Firebase not initialized' };
    }

    const docId = `${analystOutput.timestamp}_${analystOutput.agentId}`;

    const scoreDocument = {
      ...analystOutput,
      docId,
      createdAt: serverTimestampFn(),
      createdAtISO: new Date().toISOString()
    };

    const docRef = await addDocFn(
      collectionFn(firestore, FIREBASE_COLLECTIONS.AGENT_SCORES),
      scoreDocument
    );

    console.log(`[DecisionLogger] Analyst scores logged: ${docRef.id} for ${analystOutput.agentId}`);

    return {
      success: true,
      docId: docRef.id
    };
  } catch (error) {
    console.error('[DecisionLogger] Error logging analyst scores:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update decision with outcome when position closes
 * @param {string} decisionId - ID of the decision document
 * @param {Object} outcomeData - Outcome data
 * @returns {Object} - { success, error? }
 */
export async function logDecisionOutcome(decisionId, outcomeData) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { pnl, pnlPercent, holdingPeriod, exitReason } = outcomeData;
    const outcome = createDecisionOutcome(pnl, pnlPercent, holdingPeriod, exitReason);

    // Update the decision document
    const decisionRef = docFn(firestore, FIREBASE_COLLECTIONS.DECISIONS, decisionId);
    await updateDocFn(decisionRef, {
      outcome,
      outcomeLoggedAt: serverTimestampFn()
    });

    // Also save to separate outcomes collection for easier querying
    await addDocFn(
      collectionFn(firestore, FIREBASE_COLLECTIONS.DECISION_OUTCOMES),
      {
        decisionId,
        ...outcome,
        createdAt: serverTimestampFn()
      }
    );

    console.log(`[DecisionLogger] Outcome logged for decision: ${decisionId}`);

    return { success: true };
  } catch (error) {
    console.error('[DecisionLogger] Error logging outcome:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log shadow test analysis summary (for weekly aggregation)
 * @param {Object} shadowTestSummary - Aggregated shadow test performance
 * @param {string} period - Period identifier (e.g., 'weekly/2024-01-15')
 * @returns {Object} - { success, error? }
 */
export async function logShadowTestAnalysis(shadowTestSummary, period) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const docId = period.replace(/\//g, '_');

    await addDocFn(
      collectionFn(firestore, FIREBASE_COLLECTIONS.SHADOW_TEST_ANALYSIS),
      {
        period,
        docId,
        ...shadowTestSummary,
        createdAt: serverTimestampFn()
      }
    );

    console.log(`[DecisionLogger] Shadow test analysis logged for: ${period}`);

    return { success: true };
  } catch (error) {
    console.error('[DecisionLogger] Error logging shadow test analysis:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get recent decisions
 * @param {number} count - Number of decisions to retrieve
 * @returns {Array} - Array of decisions
 */
export async function getRecentDecisions(count = 10) {
  try {
    const firestore = await initFirebase();
    if (!firestore) return [];

    const q = queryFn(
      collectionFn(firestore, FIREBASE_COLLECTIONS.DECISIONS),
      orderByFn('timestamp', 'desc'),
      limitFn(count)
    );

    const snapshot = await getDocsFn(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[DecisionLogger] Error fetching decisions:', error);
    return [];
  }
}

/**
 * Get decisions for a specific asset
 * @param {string} asset - Asset symbol
 * @param {number} count - Number of decisions
 * @returns {Array} - Array of decisions
 */
export async function getDecisionsForAsset(asset, count = 10) {
  try {
    const firestore = await initFirebase();
    if (!firestore) return [];

    const q = queryFn(
      collectionFn(firestore, FIREBASE_COLLECTIONS.DECISIONS),
      whereFn('asset', '==', asset.toUpperCase()),
      orderByFn('timestamp', 'desc'),
      limitFn(count)
    );

    const snapshot = await getDocsFn(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[DecisionLogger] Error fetching asset decisions:', error);
    return [];
  }
}

/**
 * Get decisions with outcomes for analysis
 * @param {number} count - Number of decisions
 * @returns {Array} - Array of decisions with outcomes
 */
export async function getDecisionsWithOutcomes(count = 50) {
  try {
    const firestore = await initFirebase();
    if (!firestore) return [];

    // Get decisions that have outcomes
    const q = queryFn(
      collectionFn(firestore, FIREBASE_COLLECTIONS.DECISIONS),
      orderByFn('timestamp', 'desc'),
      limitFn(count)
    );

    const snapshot = await getDocsFn(q);
    const decisions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter to only those with outcomes
    return decisions.filter(d => d.outcome !== null);
  } catch (error) {
    console.error('[DecisionLogger] Error fetching decisions with outcomes:', error);
    return [];
  }
}

// ============================================================================
// CONSOLE FALLBACK
// ============================================================================

/**
 * Log to console when Firebase is unavailable
 * @param {Object} data - Data to log
 * @returns {Object}
 */
function logToConsole(data) {
  const timestamp = Date.now();
  const id = `console_${timestamp}_${data.asset}`;

  console.log('='.repeat(60));
  console.log('[DecisionLogger] Decision Log (Console Fallback)');
  console.log('='.repeat(60));
  console.log(`ID: ${id}`);
  console.log(`Asset: ${data.asset}`);
  console.log(`Timestamp: ${new Date(timestamp).toISOString()}`);

  console.log('\nAnalyst Scores:');
  for (const [agent, output] of Object.entries(data.analystOutputs || {})) {
    const score = output?.scores?.find(s => s.asset === data.asset);
    if (score) {
      console.log(`  ${agent}: direction=${score.direction}, confidence=${score.confidence}`);
    }
  }

  console.log('\nAggregated:');
  console.log(`  Direction: ${data.aggregatedScore?.weightedDirection?.toFixed(2)}`);
  console.log(`  Confidence: ${data.aggregatedScore?.weightedConfidence?.toFixed(2)}`);
  console.log(`  Agreement: ${data.aggregatedScore?.agreement?.toFixed(2)}`);

  console.log('\nRecommendation:');
  console.log(`  Action: ${data.recommendation?.direction}`);
  console.log(`  Size: ${(data.recommendation?.sizePercent * 100)?.toFixed(1)}%`);

  console.log('='.repeat(60));

  return {
    success: true,
    decisionId: id,
    console: true
  };
}

// ============================================================================
// ANALYSIS HELPERS
// ============================================================================

/**
 * Calculate accuracy metrics from decisions with outcomes
 * @param {Array} decisions - Decisions with outcomes
 * @returns {Object} - Accuracy metrics
 */
export function calculateAccuracyMetrics(decisions) {
  if (!decisions || decisions.length === 0) {
    return { totalDecisions: 0 };
  }

  let profitable = 0;
  let unprofitable = 0;
  let totalPnL = 0;
  let totalPnLPercent = 0;

  const byAsset = {};
  const byAnalyst = {
    EMO: { correct: 0, total: 0 },
    TEKNO: { correct: 0, total: 0 },
    MACRO: { correct: 0, total: 0 }
  };

  for (const decision of decisions) {
    if (!decision.outcome) continue;

    const { pnl, pnlPercent } = decision.outcome;
    const isProfitable = pnl > 0;

    if (isProfitable) profitable++;
    else unprofitable++;

    totalPnL += pnl;
    totalPnLPercent += pnlPercent;

    // Track by asset
    if (!byAsset[decision.asset]) {
      byAsset[decision.asset] = { profitable: 0, total: 0, pnl: 0 };
    }
    byAsset[decision.asset].total++;
    byAsset[decision.asset].pnl += pnl;
    if (isProfitable) byAsset[decision.asset].profitable++;

    // Track analyst accuracy
    for (const [analyst, data] of Object.entries(decision.analysts || {})) {
      if (!byAnalyst[analyst]) continue;
      byAnalyst[analyst].total++;

      // Check if analyst's direction matched outcome
      const analystDirection = data.score > 1 ? 'LONG' : data.score < -1 ? 'SHORT' : 'FLAT';
      const outcomeDirection = pnl > 0 ? decision.decision.action : (
        decision.decision.action === 'LONG' ? 'SHORT' : 'LONG'
      );

      if (analystDirection === outcomeDirection || analystDirection === 'FLAT') {
        byAnalyst[analyst].correct++;
      }
    }
  }

  return {
    totalDecisions: decisions.length,
    profitable,
    unprofitable,
    winRate: (profitable / decisions.length * 100).toFixed(1) + '%',
    totalPnL,
    avgPnLPercent: (totalPnLPercent / decisions.length * 100).toFixed(2) + '%',
    byAsset,
    byAnalyst: Object.fromEntries(
      Object.entries(byAnalyst).map(([analyst, data]) => [
        analyst,
        {
          accuracy: data.total > 0 ? (data.correct / data.total * 100).toFixed(1) + '%' : 'N/A',
          total: data.total
        }
      ])
    )
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  logDecision,
  logAnalystScores,
  logDecisionOutcome,
  logShadowTestAnalysis,
  getRecentDecisions,
  getDecisionsForAsset,
  getDecisionsWithOutcomes,
  calculateAccuracyMetrics
};
