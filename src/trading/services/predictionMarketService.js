/**
 * Prediction Market Service
 *
 * Manages prediction markets for oracle accuracy and other outcomes.
 * Off-chain first (Firebase), with hooks for on-chain settlement.
 *
 * Market Types:
 * 1. Weekly Oracle Accuracy - "Most accurate oracle this week?"
 * 2. Binary Markets - "BTC > $100k by end of week?"
 * 3. Direction Markets - "RL80's next trade direction?"
 */

import { FIREBASE_COLLECTIONS } from '../config/scoring-config.js';
import { calculateAccuracyStats, getCurrentWeekId, getWeekBounds } from './oracleAccuracyService.js';

// ============================================================================
// FIREBASE INITIALIZATION
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
      updateDoc,
      increment
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
      query, orderBy, limit, getDocs, serverTimestamp,
      where, updateDoc, increment
    };

    console.log('[PredictionMarket] Firebase initialized');
    return db;
  } catch (error) {
    console.error('[PredictionMarket] Firebase init failed:', error);
    return null;
  }
}

// ============================================================================
// MARKET TYPES
// ============================================================================

export const MARKET_TYPES = {
  ORACLE_ACCURACY: 'oracle_accuracy',
  BINARY: 'binary',
  MULTI_OPTION: 'multi_option'
};

export const ORACLE_OPTIONS = [
  { id: 'EMO', name: 'EMO (Sentiment)', color: '#ff8800' },
  { id: 'TEKNO', name: 'TEKNO (Technical)', color: '#aa44ff' },
  { id: 'MACRO', name: 'MACRO (Macro)', color: '#00c8ff' }
];

// ============================================================================
// MARKET CREATION
// ============================================================================

/**
 * Create weekly oracle accuracy market
 * Should be called at the start of each week (Sunday midnight)
 *
 * @param {string} weekId - Optional week ID, defaults to current week
 * @returns {Object} - Created market info
 */
export async function createWeeklyOracleMarket(weekId = null) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { doc, setDoc, serverTimestamp } = firebaseFunctions;

    const id = weekId || getCurrentWeekId();
    const { start, end } = getWeekBounds(id);
    const marketId = `oracle-accuracy-${id}`;

    // Check if market already exists
    const existingMarket = await getMarket(marketId);
    if (existingMarket) {
      console.log(`[PredictionMarket] Market ${marketId} already exists`);
      return { success: true, marketId, market: existingMarket, existed: true };
    }

    const market = {
      id: marketId,
      type: MARKET_TYPES.ORACLE_ACCURACY,
      question: `Most accurate oracle for Week ${id.split('-W')[1]}?`,
      description: 'Bet on which AI oracle will have the highest directional accuracy this week.',
      weekId: id,
      options: ORACLE_OPTIONS.map(opt => ({
        ...opt,
        pool: 0,
        betCount: 0
      })),
      totalPool: 0,
      totalBets: 0,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      resolved: false,
      winner: null,
      winnerAccuracy: null,
      createdAt: serverTimestamp(),
      createdAtISO: new Date().toISOString(),
      // On-chain integration (for future)
      onChainMarketId: null,
      onChainTxHash: null
    };

    await setDoc(
      doc(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS, marketId),
      market
    );

    console.log(`[PredictionMarket] Created weekly market: ${marketId}`);

    return { success: true, marketId, market };
  } catch (error) {
    console.error('[PredictionMarket] Error creating market:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a custom binary market
 *
 * @param {Object} params - Market parameters
 * @returns {Object} - Created market info
 */
export async function createBinaryMarket({
  question,
  description,
  optionA,
  optionB,
  endTime,
  category = 'custom'
}) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { addDoc, collection, serverTimestamp } = firebaseFunctions;

    const market = {
      type: MARKET_TYPES.BINARY,
      question,
      description,
      category,
      options: [
        { id: 'YES', name: optionA || 'YES', pool: 0, betCount: 0, color: '#00ff88' },
        { id: 'NO', name: optionB || 'NO', pool: 0, betCount: 0, color: '#ff4466' }
      ],
      totalPool: 0,
      totalBets: 0,
      startTime: new Date().toISOString(),
      endTime: new Date(endTime).toISOString(),
      resolved: false,
      winner: null,
      createdAt: serverTimestamp(),
      createdAtISO: new Date().toISOString()
    };

    const docRef = await addDoc(
      collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS),
      market
    );

    console.log(`[PredictionMarket] Created binary market: ${docRef.id}`);

    return { success: true, marketId: docRef.id, market };
  } catch (error) {
    console.error('[PredictionMarket] Error creating binary market:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BETTING
// ============================================================================

/**
 * Place a bet on a market
 *
 * @param {Object} params - Bet parameters
 * @returns {Object} - Bet confirmation
 */
export async function placeBet({
  marketId,
  optionId,
  amount,
  userId,
  userAddress = null // For on-chain integration
}) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { doc, getDoc, setDoc, addDoc, collection, updateDoc, increment, serverTimestamp } = firebaseFunctions;

    // Get market
    const marketRef = doc(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS, marketId);
    const marketSnap = await getDoc(marketRef);

    if (!marketSnap.exists()) {
      return { success: false, error: 'Market not found' };
    }

    const market = marketSnap.data();

    // Validate
    if (market.resolved) {
      return { success: false, error: 'Market already resolved' };
    }

    if (new Date() > new Date(market.endTime)) {
      return { success: false, error: 'Market has ended' };
    }

    const option = market.options.find(o => o.id === optionId);
    if (!option) {
      return { success: false, error: 'Invalid option' };
    }

    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    // Create bet record
    const bet = {
      marketId,
      optionId,
      optionName: option.name,
      amount,
      userId,
      userAddress,
      poolAtBet: option.pool,
      totalPoolAtBet: market.totalPool,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      createdAt: serverTimestamp(),
      // Will be filled on resolution
      resolved: false,
      won: null,
      payout: null,
      claimedAt: null
    };

    const betRef = await addDoc(
      collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_BETS),
      bet
    );

    // Update market pools
    const updatedOptions = market.options.map(o => {
      if (o.id === optionId) {
        return {
          ...o,
          pool: o.pool + amount,
          betCount: o.betCount + 1
        };
      }
      return o;
    });

    await updateDoc(marketRef, {
      options: updatedOptions,
      totalPool: increment(amount),
      totalBets: increment(1)
    });

    console.log(`[PredictionMarket] Bet placed: ${amount} on ${optionId} in ${marketId}`);

    return {
      success: true,
      betId: betRef.id,
      bet,
      newPoolSize: option.pool + amount
    };
  } catch (error) {
    console.error('[PredictionMarket] Error placing bet:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// MARKET RESOLUTION
// ============================================================================

/**
 * Resolve an oracle accuracy market based on actual performance
 *
 * @param {string} marketId - Market ID to resolve
 * @returns {Object} - Resolution result
 */
export async function resolveOracleMarket(marketId) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { doc, getDoc, updateDoc, serverTimestamp } = firebaseFunctions;

    // Get market
    const marketRef = doc(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS, marketId);
    const marketSnap = await getDoc(marketRef);

    if (!marketSnap.exists()) {
      return { success: false, error: 'Market not found' };
    }

    const market = marketSnap.data();

    if (market.resolved) {
      return { success: false, error: 'Market already resolved' };
    }

    if (market.type !== MARKET_TYPES.ORACLE_ACCURACY) {
      return { success: false, error: 'Not an oracle accuracy market' };
    }

    // Get accuracy stats for the week
    const endDate = new Date(market.endTime);
    const stats = await calculateAccuracyStats('weekly', endDate);

    if (!stats.success) {
      return { success: false, error: 'Failed to calculate accuracy stats' };
    }

    const winner = stats.winner;
    const winnerAccuracy = stats.winnerAccuracy;

    // Update market
    await updateDoc(marketRef, {
      resolved: true,
      winner,
      winnerAccuracy,
      accuracyStats: stats.stats,
      resolvedAt: serverTimestamp(),
      resolvedAtISO: new Date().toISOString()
    });

    // Calculate payouts
    const payoutResult = await calculatePayouts(marketId, winner);

    console.log(`[PredictionMarket] Resolved ${marketId}: Winner = ${winner} (${winnerAccuracy}%)`);

    return {
      success: true,
      winner,
      winnerAccuracy,
      stats: stats.stats,
      payouts: payoutResult
    };
  } catch (error) {
    console.error('[PredictionMarket] Error resolving market:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolve a binary market manually
 *
 * @param {string} marketId - Market ID
 * @param {string} winner - Winning option ID ('YES' or 'NO')
 * @returns {Object} - Resolution result
 */
export async function resolveBinaryMarket(marketId, winner) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { doc, getDoc, updateDoc, serverTimestamp } = firebaseFunctions;

    const marketRef = doc(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS, marketId);
    const marketSnap = await getDoc(marketRef);

    if (!marketSnap.exists()) {
      return { success: false, error: 'Market not found' };
    }

    const market = marketSnap.data();

    if (market.resolved) {
      return { success: false, error: 'Market already resolved' };
    }

    // Update market
    await updateDoc(marketRef, {
      resolved: true,
      winner,
      resolvedAt: serverTimestamp(),
      resolvedAtISO: new Date().toISOString()
    });

    // Calculate payouts
    const payoutResult = await calculatePayouts(marketId, winner);

    console.log(`[PredictionMarket] Resolved ${marketId}: Winner = ${winner}`);

    return { success: true, winner, payouts: payoutResult };
  } catch (error) {
    console.error('[PredictionMarket] Error resolving binary market:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// PAYOUT CALCULATION
// ============================================================================

/**
 * Calculate payouts for all bets on a resolved market
 *
 * @param {string} marketId - Market ID
 * @param {string} winner - Winning option ID
 * @returns {Object} - Payout summary
 */
async function calculatePayouts(marketId, winner) {
  try {
    const firestore = await initFirebase();
    if (!firestore) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } = firebaseFunctions;

    // Get market for pool info
    const marketRef = doc(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS, marketId);
    const marketSnap = await (await initFirebase() && firebaseFunctions.getDoc(marketRef));
    const market = marketSnap.data();

    const winningOption = market.options.find(o => o.id === winner);
    const losingPools = market.options.filter(o => o.id !== winner);
    const totalLosingPool = losingPools.reduce((sum, o) => sum + o.pool, 0);
    const winningPool = winningOption?.pool || 0;

    // Get all bets for this market
    const betsQuery = query(
      collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_BETS),
      where('marketId', '==', marketId)
    );
    const betsSnap = await getDocs(betsQuery);

    const payouts = [];
    let totalPayouts = 0;

    for (const betDoc of betsSnap.docs) {
      const bet = betDoc.data();
      const won = bet.optionId === winner;

      let payout = 0;
      if (won && winningPool > 0) {
        // Winner gets: stake + (stake / winningPool) * losingPools
        const shareOfPool = bet.amount / winningPool;
        payout = bet.amount + (shareOfPool * totalLosingPool);
      }

      // Update bet record
      await updateDoc(doc(firestore, FIREBASE_COLLECTIONS.PREDICTION_BETS, betDoc.id), {
        resolved: true,
        won,
        payout,
        resolvedAt: serverTimestamp()
      });

      // Create payout record
      if (won && payout > 0) {
        await addDoc(collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_PAYOUTS), {
          betId: betDoc.id,
          marketId,
          userId: bet.userId,
          userAddress: bet.userAddress,
          amount: payout,
          profit: payout - bet.amount,
          claimed: false,
          createdAt: serverTimestamp()
        });

        totalPayouts += payout;
      }

      payouts.push({
        betId: betDoc.id,
        userId: bet.userId,
        optionId: bet.optionId,
        amount: bet.amount,
        won,
        payout
      });
    }

    return {
      success: true,
      totalBets: betsSnap.size,
      totalPayouts,
      winners: payouts.filter(p => p.won).length,
      losers: payouts.filter(p => !p.won).length,
      payouts
    };
  } catch (error) {
    console.error('[PredictionMarket] Error calculating payouts:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get a single market by ID
 */
export async function getMarket(marketId) {
  try {
    const firestore = await initFirebase();
    if (!firestore) return null;

    const { doc, getDoc } = firebaseFunctions;
    const marketSnap = await getDoc(doc(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS, marketId));

    return marketSnap.exists() ? { id: marketSnap.id, ...marketSnap.data() } : null;
  } catch (error) {
    console.error('[PredictionMarket] Error getting market:', error);
    return null;
  }
}

/**
 * Get active (unresolved) markets
 */
export async function getActiveMarkets() {
  try {
    const firestore = await initFirebase();
    if (!firestore) return [];

    const { collection, query, where, orderBy, getDocs } = firebaseFunctions;

    const q = query(
      collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS),
      where('resolved', '==', false),
      orderBy('endTime', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[PredictionMarket] Error getting active markets:', error);
    return [];
  }
}

/**
 * Get user's bets
 */
export async function getUserBets(userId, includeResolved = true) {
  try {
    const firestore = await initFirebase();
    if (!firestore) return [];

    const { collection, query, where, orderBy, getDocs } = firebaseFunctions;

    let q = query(
      collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_BETS),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    let bets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!includeResolved) {
      bets = bets.filter(b => !b.resolved);
    }

    return bets;
  } catch (error) {
    console.error('[PredictionMarket] Error getting user bets:', error);
    return [];
  }
}

/**
 * Get user's unclaimed payouts
 */
export async function getUnclaimedPayouts(userId) {
  try {
    const firestore = await initFirebase();
    if (!firestore) return [];

    const { collection, query, where, getDocs } = firebaseFunctions;

    const q = query(
      collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_PAYOUTS),
      where('userId', '==', userId),
      where('claimed', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[PredictionMarket] Error getting unclaimed payouts:', error);
    return [];
  }
}

/**
 * Get current week's oracle accuracy market
 */
export async function getCurrentOracleMarket() {
  const weekId = getCurrentWeekId();
  const marketId = `oracle-accuracy-${weekId}`;
  return getMarket(marketId);
}

// ============================================================================
// SCHEDULED TASKS
// ============================================================================

/**
 * Initialize weekly market if it doesn't exist
 * Should be called on app startup and/or via cron
 */
export async function ensureCurrentWeekMarket() {
  const result = await createWeeklyOracleMarket();
  return result;
}

/**
 * Check and resolve any markets that have ended
 * Should be called periodically (e.g., every hour)
 */
export async function checkAndResolveMarkets() {
  try {
    const firestore = await initFirebase();
    if (!firestore) return { resolved: [] };

    const { collection, query, where, getDocs } = firebaseFunctions;

    const now = new Date().toISOString();

    // Get unresolved markets that have ended
    const q = query(
      collection(firestore, FIREBASE_COLLECTIONS.PREDICTION_MARKETS),
      where('resolved', '==', false)
    );

    const snapshot = await getDocs(q);
    const resolved = [];

    for (const docSnap of snapshot.docs) {
      const market = docSnap.data();

      if (market.endTime <= now) {
        if (market.type === MARKET_TYPES.ORACLE_ACCURACY) {
          const result = await resolveOracleMarket(docSnap.id);
          if (result.success) {
            resolved.push({ id: docSnap.id, ...result });
          }
        }
        // Binary markets need manual resolution
      }
    }

    return { resolved };
  } catch (error) {
    console.error('[PredictionMarket] Error checking markets:', error);
    return { resolved: [], error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Market creation
  createWeeklyOracleMarket,
  createBinaryMarket,
  // Betting
  placeBet,
  // Resolution
  resolveOracleMarket,
  resolveBinaryMarket,
  // Queries
  getMarket,
  getActiveMarkets,
  getUserBets,
  getUnclaimedPayouts,
  getCurrentOracleMarket,
  // Scheduled
  ensureCurrentWeekMarket,
  checkAndResolveMarkets,
  // Constants
  MARKET_TYPES,
  ORACLE_OPTIONS
};
