/**
 * Weekly Analysis Service for RL80
 *
 * Fetches and processes external intelligence from the weeklyAnalysis
 * Firestore collection to give RL80 independent insight beyond sub-agent opinions.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Fetch all recent weekly analysis from Firestore
 * Unlike getRecentAnalysisForAgent, this gets ALL analysis regardless of agent
 * @param {number} daysBack - How many days to look back (default 14)
 * @returns {Array} - All recent analysis documents
 */
export async function fetchAllWeeklyAnalysis(daysBack = 14) {
  try {
    let db;
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
      db = getFirestore(app);
    } catch (error) {
      console.log('Firebase not available for weekly analysis');
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const q = query(
      collection(db, 'weeklyAnalysis'),
      where('timestamp', '>=', cutoffDate),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const analyses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 RL80 fetched ${analyses.length} weekly analysis documents`);
    return analyses;

  } catch (error) {
    console.error('Failed to fetch weekly analysis:', error.message);
    return [];
  }
}

/**
 * Extract directional bias from weekly analysis
 * Analyzes all recent insights to determine if external intelligence
 * suggests bullish, bearish, or neutral bias for each asset
 *
 * @param {Array} analyses - Array of weekly analysis documents
 * @returns {Object} - Bias adjustments per asset { BTC: { bias: 0.5, confidence: 0.6, sources: [...] }, ... }
 */
export function extractWeeklyBias(analyses) {
  if (!analyses || analyses.length === 0) {
    return { hasBias: false, assets: {} };
  }

  const assetBias = {
    BTC: { bullishCount: 0, bearishCount: 0, neutralCount: 0, insights: [] },
    ETH: { bullishCount: 0, bearishCount: 0, neutralCount: 0, insights: [] },
    SOL: { bullishCount: 0, bearishCount: 0, neutralCount: 0, insights: [] },
    XRP: { bullishCount: 0, bearishCount: 0, neutralCount: 0, insights: [] }
  };

  // Keywords that indicate bullish/bearish sentiment
  const bullishKeywords = [
    'bullish', 'buy', 'long', 'accumulate', 'breakout', 'rally', 'moon',
    'upside', 'support holding', 'bottom', 'reversal up', 'oversold',
    'accumulation', 'institutional buying', 'bullrun'
  ];

  const bearishKeywords = [
    'bearish', 'sell', 'short', 'distribute', 'breakdown', 'crash', 'dump',
    'downside', 'resistance rejection', 'top', 'reversal down', 'overbought',
    'distribution', 'institutional selling', 'capitulation'
  ];

  // Process each analysis
  for (const analysis of analyses) {
    const content = JSON.stringify(analysis).toLowerCase();
    const title = (analysis.title || '').toLowerCase();
    const source = analysis.channel || analysis.source || 'unknown';

    // Check each asset
    for (const asset of ['BTC', 'ETH', 'SOL', 'XRP']) {
      const assetLower = asset.toLowerCase();
      const assetAliases = getAssetAliases(asset);

      // Check if this analysis mentions this asset
      const mentionsAsset = assetAliases.some(alias =>
        content.includes(alias.toLowerCase())
      );

      if (mentionsAsset) {
        // Count bullish/bearish signals
        let bullishScore = 0;
        let bearishScore = 0;

        for (const keyword of bullishKeywords) {
          if (content.includes(keyword)) bullishScore++;
        }
        for (const keyword of bearishKeywords) {
          if (content.includes(keyword)) bearishScore++;
        }

        if (bullishScore > bearishScore) {
          assetBias[asset].bullishCount++;
          assetBias[asset].insights.push({ source, sentiment: 'bullish', title });
        } else if (bearishScore > bullishScore) {
          assetBias[asset].bearishCount++;
          assetBias[asset].insights.push({ source, sentiment: 'bearish', title });
        } else if (bullishScore > 0 || bearishScore > 0) {
          assetBias[asset].neutralCount++;
          assetBias[asset].insights.push({ source, sentiment: 'mixed', title });
        }
      }
    }
  }

  // Calculate final bias for each asset
  const result = {
    hasBias: false,
    assets: {},
    summary: []
  };

  for (const [asset, data] of Object.entries(assetBias)) {
    const total = data.bullishCount + data.bearishCount + data.neutralCount;

    if (total === 0) {
      result.assets[asset] = { bias: 0, confidence: 0, sources: [] };
      continue;
    }

    // Calculate bias (-1 to +1)
    const netBullish = data.bullishCount - data.bearishCount;
    const bias = netBullish / total; // -1 (all bearish) to +1 (all bullish)

    // Calculate confidence based on consensus strength
    const maxCount = Math.max(data.bullishCount, data.bearishCount, data.neutralCount);
    const confidence = maxCount / total;

    result.assets[asset] = {
      bias: bias,
      confidence: confidence,
      bullishCount: data.bullishCount,
      bearishCount: data.bearishCount,
      sources: data.insights.slice(0, 3) // Top 3 sources
    };

    // Only flag as having meaningful bias if confidence is decent
    if (Math.abs(bias) >= 0.3 && confidence >= 0.4) {
      result.hasBias = true;
      const direction = bias > 0 ? 'bullish' : 'bearish';
      result.summary.push(`${asset}: ${direction} (${(bias * 100).toFixed(0)}% bias from ${total} sources)`);
    }
  }

  if (result.summary.length > 0) {
    console.log('📰 Weekly analysis bias:', result.summary.join(', '));
  }

  return result;
}

/**
 * Apply weekly analysis bias to aggregated scores
 * This gives RL80 independent input beyond just the sub-agents
 *
 * @param {Array} aggregatedScores - Scores from sub-agents
 * @param {Object} weeklyBias - Bias extracted from weekly analysis
 * @param {number} weight - How much to weight external intelligence (0-1, default 0.2)
 * @returns {Array} - Adjusted scores
 */
export function applyWeeklyBiasToScores(aggregatedScores, weeklyBias, weight = 0.2) {
  if (!weeklyBias?.hasBias) {
    return { adjustedScores: aggregatedScores, adjustments: [] };
  }

  const adjustments = [];
  const adjustedScores = aggregatedScores.map(score => {
    const assetBias = weeklyBias.assets[score.asset];

    if (!assetBias || Math.abs(assetBias.bias) < 0.2 || assetBias.confidence < 0.3) {
      return score; // No meaningful bias for this asset
    }

    // Calculate adjustment: bias * weight * 10 (to scale to -10 to +10 score range)
    // Max adjustment is +/- 2 points to prevent external intel from dominating
    const maxAdjustment = 2;
    const rawAdjustment = assetBias.bias * weight * 10;
    const adjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, rawAdjustment));

    if (Math.abs(adjustment) >= 0.1) {
      adjustments.push({
        asset: score.asset,
        originalDirection: score.weightedDirection,
        adjustment: adjustment,
        newDirection: score.weightedDirection + adjustment,
        reason: `Weekly analysis ${assetBias.bias > 0 ? 'bullish' : 'bearish'} (${assetBias.sources.length} sources)`
      });
    }

    return {
      ...score,
      weightedDirection: score.weightedDirection + adjustment,
      weeklyBiasApplied: {
        adjustment,
        bias: assetBias.bias,
        confidence: assetBias.confidence
      }
    };
  });

  return { adjustedScores, adjustments };
}

/**
 * Get aliases for asset names (for matching in text)
 */
function getAssetAliases(asset) {
  const aliases = {
    BTC: ['btc', 'bitcoin', 'btc-perp', 'xbt'],
    ETH: ['eth', 'ethereum', 'ether', 'eth-perp'],
    SOL: ['sol', 'solana', 'sol-perp'],
    XRP: ['xrp', 'ripple', 'xrp-perp']
  };
  return aliases[asset] || [asset.toLowerCase()];
}

/**
 * Format weekly analysis summary for RL80's response text
 */
export function formatWeeklyAnalysisSummary(weeklyBias, adjustments) {
  if (!weeklyBias?.hasBias || adjustments.length === 0) {
    return '';
  }

  const parts = adjustments.map(adj => {
    const direction = adj.adjustment > 0 ? '↑' : '↓';
    return `${adj.asset}${direction}`;
  });

  return ` External intel adjustments: ${parts.join(', ')}.`;
}

export default {
  fetchAllWeeklyAnalysis,
  extractWeeklyBias,
  applyWeeklyBiasToScores,
  formatWeeklyAnalysisSummary
};
