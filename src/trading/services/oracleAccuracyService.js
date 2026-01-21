/**
 * Oracle Accuracy Service
 *
 * Tracks directional accuracy of each oracle (EMO, TEKNO, MACRO)
 * by comparing their calls to actual price movements.
 *
 * Used for:
 * 1. Performance analytics
 * 2. Prediction market resolution ("Most accurate oracle this week?")
 * 3. Dynamic weight adjustment (future)
 */

import { FIREBASE_COLLECTIONS } from '../config/scoring-config.js';

// ============================================================================
// FIREBASE INITIALIZATION (LAZY)
// ============================================================================

let db = null;
let firebaseFunctions = {};

async function initFirebase() {
  if (db) return db;

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const {
      getFirestore,
      collection,
      addDoc,
      doc,
      setDoc,
      getDoc,
      query,
      orderBy,
      limit,
      getDocs,
      serverTimestamp,
      where,
      Timestamp
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

    firebaseFunctions = {
      collection, addDoc, doc, setDoc, getDoc,
      query, orderBy, limit, getDocs, serverTimestamp, where, Timestamp
    };

    console.log('[OracleAccuracy] Firebase initialized');
    return db;
  } catch (error) {
    console.error('[OracleAccuracy] Firebase init failed:', error);
    return null;
  }
}

// ============================================================================
// ACCURACY TRACKING
// ============================================================================

/**
 * Log an oracle's directional call for later accuracy verification
 * Called when each oracle provides their analysis
 *
 * @param {string} oracleId - 'EMO', 'TEKNO', or 'MACRO'
 * @param {string} asset - Asset symbol (BTC, ETH, etc.)
 * @param {number} directionScore - Oracle's direction score (-10 to +10)
 * @param {number} confidence - Oracle's confidence (0 to 1)
 * @param {number} priceAtCall - Price when call was made
 * @returns {Object} - { success, logId }
 */
export async function logOracleCall({
  oracleId,
  asset,
  directionScore,
  confidence,
  priceAtCall
}) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      console.warn('[OracleAccuracy] Firebase not available');
      return { success: false, error: 'Firebase not initialized' };
    }

    const { collection, addDoc, serverTimestamp } = firebaseFunctions;

    const timestamp = Date.now();
    const callLog = {
      oracleId,
      asset,
      directionScore,
      direction: scoreToDirection(directionScore),
      confidence,
      priceAtCall,
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      // Will be filled in by verification job
      verified: false,
      priceAfter24h: null,
      actualDirection: null,
      wasCorrect: null,
      verifiedAt: null
    };

    const docRef = await addDoc(
      collection(firestore, FIREBASE_COLLECTIONS.ORACLE_ACCURACY_LOGS),
      {
        ...callLog,
        createdAt: serverTimestamp()
      }
    );

    console.log(`[OracleAccuracy] Logged ${oracleId} call for ${asset}: ${callLog.direction}`);

    return {
      success: true,
      logId: docRef.id,
      call: callLog
    };
  } catch (error) {
    console.error('[OracleAccuracy] Error logging call:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify oracle calls from ~24 hours ago
 * Should be run periodically (e.g., every hour)
 *
 * @param {Object} currentPrices - { BTC: 97000, ETH: 3400, ... }
 * @returns {Object} - { success, verified, errors }
 */
export async function verifyPendingCalls(currentPrices) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { collection, query, where, getDocs, doc, setDoc, serverTimestamp } = firebaseFunctions;

    // Get unverified calls from 23-25 hours ago
    const now = Date.now();
    const windowStart = now - (25 * 60 * 60 * 1000); // 25 hours ago
    const windowEnd = now - (23 * 60 * 60 * 1000);   // 23 hours ago

    const q = query(
      collection(firestore, FIREBASE_COLLECTIONS.ORACLE_ACCURACY_LOGS),
      where('verified', '==', false),
      where('timestamp', '>=', windowStart),
      where('timestamp', '<=', windowEnd)
    );

    const snapshot = await getDocs(q);
    const verified = [];
    const errors = [];

    for (const docSnap of snapshot.docs) {
      const call = docSnap.data();
      const currentPrice = currentPrices[call.asset];

      if (!currentPrice) {
        errors.push({ id: docSnap.id, error: `No price for ${call.asset}` });
        continue;
      }

      // Determine actual price movement
      const priceChange = currentPrice - call.priceAtCall;
      const priceChangePercent = (priceChange / call.priceAtCall) * 100;
      const actualDirection = priceChangePercent > 0.5 ? 'BULLISH' :
                              priceChangePercent < -0.5 ? 'BEARISH' : 'NEUTRAL';

      // Check if oracle was correct
      const wasCorrect = checkDirectionMatch(call.direction, actualDirection);

      // Update the document
      await setDoc(doc(firestore, FIREBASE_COLLECTIONS.ORACLE_ACCURACY_LOGS, docSnap.id), {
        ...call,
        verified: true,
        priceAfter24h: currentPrice,
        priceChangePercent,
        actualDirection,
        wasCorrect,
        verifiedAt: serverTimestamp(),
        verifiedAtISO: new Date().toISOString()
      });

      verified.push({
        id: docSnap.id,
        oracleId: call.oracleId,
        asset: call.asset,
        predicted: call.direction,
        actual: actualDirection,
        wasCorrect
      });
    }

    console.log(`[OracleAccuracy] Verified ${verified.length} calls, ${errors.length} errors`);

    return { success: true, verified, errors };
  } catch (error) {
    console.error('[OracleAccuracy] Error verifying calls:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate oracle accuracy stats for a time period
 *
 * @param {string} period - 'daily' or 'weekly'
 * @param {Date} endDate - End of period (defaults to now)
 * @returns {Object} - Accuracy stats by oracle
 */
export async function calculateAccuracyStats(period = 'weekly', endDate = new Date()) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { collection, query, where, getDocs } = firebaseFunctions;

    // Calculate time window
    const endTimestamp = endDate.getTime();
    const startTimestamp = period === 'daily'
      ? endTimestamp - (24 * 60 * 60 * 1000)
      : endTimestamp - (7 * 24 * 60 * 60 * 1000);

    // Query verified calls in the period
    const q = query(
      collection(firestore, FIREBASE_COLLECTIONS.ORACLE_ACCURACY_LOGS),
      where('verified', '==', true),
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp)
    );

    const snapshot = await getDocs(q);

    // Aggregate by oracle
    const stats = {
      EMO: { correct: 0, total: 0, calls: [] },
      TEKNO: { correct: 0, total: 0, calls: [] },
      MACRO: { correct: 0, total: 0, calls: [] }
    };

    snapshot.docs.forEach(docSnap => {
      const call = docSnap.data();
      const oracleId = call.oracleId;

      if (stats[oracleId]) {
        stats[oracleId].total++;
        if (call.wasCorrect) {
          stats[oracleId].correct++;
        }
        stats[oracleId].calls.push({
          asset: call.asset,
          direction: call.direction,
          actualDirection: call.actualDirection,
          wasCorrect: call.wasCorrect,
          timestamp: call.timestamp
        });
      }
    });

    // Calculate percentages
    const result = {};
    for (const [oracleId, data] of Object.entries(stats)) {
      result[oracleId] = {
        correct: data.correct,
        total: data.total,
        accuracy: data.total > 0 ? (data.correct / data.total * 100).toFixed(1) : '0.0',
        accuracyDecimal: data.total > 0 ? data.correct / data.total : 0,
        callCount: data.total
      };
    }

    // Determine winner
    const oracles = Object.entries(result);
    oracles.sort((a, b) => b[1].accuracyDecimal - a[1].accuracyDecimal);
    const winner = oracles[0][0];

    return {
      success: true,
      period,
      startDate: new Date(startTimestamp).toISOString(),
      endDate: endDate.toISOString(),
      stats: result,
      winner,
      winnerAccuracy: result[winner].accuracy
    };
  } catch (error) {
    console.error('[OracleAccuracy] Error calculating stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save weekly accuracy stats (for historical tracking)
 *
 * @param {string} weekId - Week identifier (e.g., '2026-W03')
 * @param {Object} stats - Stats from calculateAccuracyStats
 */
export async function saveWeeklyStats(weekId, stats) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { doc, setDoc, serverTimestamp } = firebaseFunctions;

    await setDoc(
      doc(firestore, FIREBASE_COLLECTIONS.ORACLE_ACCURACY_STATS, weekId),
      {
        weekId,
        ...stats,
        savedAt: serverTimestamp()
      }
    );

    console.log(`[OracleAccuracy] Saved weekly stats for ${weekId}`);

    return { success: true };
  } catch (error) {
    console.error('[OracleAccuracy] Error saving weekly stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get historical accuracy stats
 *
 * @param {number} weeks - Number of weeks to retrieve
 * @returns {Array} - Array of weekly stats
 */
export async function getHistoricalStats(weeks = 4) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return [];
    }

    const { collection, query, orderBy, limit, getDocs } = firebaseFunctions;

    const q = query(
      collection(firestore, FIREBASE_COLLECTIONS.ORACLE_ACCURACY_STATS),
      orderBy('endDate', 'desc'),
      limit(weeks)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[OracleAccuracy] Error fetching historical stats:', error);
    return [];
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert direction score to direction label
 */
function scoreToDirection(score) {
  if (score >= 2) return 'BULLISH';
  if (score <= -2) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Check if predicted direction matches actual direction
 */
function checkDirectionMatch(predicted, actual) {
  // Neutral predictions are considered correct if market was neutral
  // OR partially correct (50% credit) if they didn't pick wrong direction
  if (predicted === 'NEUTRAL') {
    return actual === 'NEUTRAL' ? true : null; // null = no penalty, no credit
  }

  // Direct match
  if (predicted === actual) return true;

  // Wrong direction
  if (
    (predicted === 'BULLISH' && actual === 'BEARISH') ||
    (predicted === 'BEARISH' && actual === 'BULLISH')
  ) {
    return false;
  }

  // Bullish/Bearish vs Neutral = partial (we'll count as correct for simplicity)
  return true;
}

/**
 * Get current week identifier
 */
export function getCurrentWeekId() {
  const now = new Date();
  const year = now.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const weekNum = Math.ceil(((now - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${year}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Get week start and end dates
 */
export function getWeekBounds(weekId = null) {
  const id = weekId || getCurrentWeekId();
  const [year, weekPart] = id.split('-W');
  const weekNum = parseInt(weekPart);

  const jan1 = new Date(parseInt(year), 0, 1);
  const daysToMonday = (8 - jan1.getDay()) % 7;
  const firstMonday = new Date(jan1.getTime() + daysToMonday * 86400000);

  const weekStart = new Date(firstMonday.getTime() + (weekNum - 1) * 7 * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000 - 1);

  return { start: weekStart, end: weekEnd };
}

// ============================================================================
// INTEGRATION HOOK
// ============================================================================

/**
 * Hook to call from scoringOrchestrator when oracles report
 * Logs all oracle calls for accuracy tracking
 *
 * @param {Object} analystScores - { EMO: output, TEKNO: output, MACRO: output }
 * @param {Object} prices - { BTC: 97000, ETH: 3400, ... }
 */
export async function logAllOracleCalls(analystScores, prices) {
  const results = [];

  for (const [oracleId, output] of Object.entries(analystScores || {})) {
    if (!output?.scores) continue;

    for (const score of output.scores) {
      const priceAtCall = prices[score.asset];
      if (!priceAtCall) continue;

      const result = await logOracleCall({
        oracleId,
        asset: score.asset,
        directionScore: score.direction,
        confidence: score.confidence,
        priceAtCall
      });

      results.push(result);
    }
  }

  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  logOracleCall,
  logAllOracleCalls,
  verifyPendingCalls,
  calculateAccuracyStats,
  saveWeeklyStats,
  getHistoricalStats,
  getCurrentWeekId,
  getWeekBounds
};
