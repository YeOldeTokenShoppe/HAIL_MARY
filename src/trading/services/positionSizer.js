/**
 * Position Sizer Service
 *
 * Calculates position sizes based on aggregated scores.
 * Maps score magnitude to position sizes and applies confidence adjustments.
 */

import {
  RISK_LIMITS,
  SL_TP_DEFAULTS,
  POSITION_SIZING,
  isTradeableAsset,
  getPerpSymbol,
  getConvictionLevel,
  getBasePositionSize,
  getMaxPositionSize,
  getConfidenceMultiplier
} from '../config/scoring-config.js';

import {
  createPositionRecommendation,
  getActionFromScore
} from '../types/scoring.js';

// ============================================================================
// MAIN POSITION SIZING FUNCTION
// ============================================================================

/**
 * Calculate position recommendations for all aggregated scores
 * @param {AggregatedScore[]} aggregatedScores - Array of aggregated scores
 * @returns {PositionRecommendation[]}
 */
export function calculatePositionRecommendations(aggregatedScores) {
  return aggregatedScores.map(score => calculatePositionForAsset(score));
}

/**
 * Calculate position recommendation for a single asset
 * @param {AggregatedScore} aggregatedScore - Aggregated score for asset
 * @returns {PositionRecommendation}
 */
export function calculatePositionForAsset(aggregatedScore) {
  const { asset, weightedDirection, weightedConfidence, agreement, analystBreakdown } = aggregatedScore;

  // Check minimum confidence threshold
  if (weightedConfidence < RISK_LIMITS.MIN_CONFIDENCE) {
    return createNoPositionRecommendation(
      asset,
      `Confidence ${(weightedConfidence * 100).toFixed(1)}% below minimum ${RISK_LIMITS.MIN_CONFIDENCE * 100}%`,
      aggregatedScore
    );
  }

  // Check minimum score magnitude
  const scoreMagnitude = Math.abs(weightedDirection);
  if (scoreMagnitude < RISK_LIMITS.MIN_SCORE_MAGNITUDE) {
    return createNoPositionRecommendation(
      asset,
      `Score magnitude ${weightedDirection.toFixed(2)} below threshold +/-${RISK_LIMITS.MIN_SCORE_MAGNITUDE}`,
      aggregatedScore
    );
  }

  // Determine direction
  const direction = getActionFromScore(weightedDirection);

  // Calculate position size
  const sizePercent = calculatePositionSize(
    weightedDirection,
    weightedConfidence,
    agreement
  );

  // Get stop loss and take profit levels
  const conviction = getConvictionLevel(weightedDirection);
  const slTpDefaults = SL_TP_DEFAULTS[conviction] || SL_TP_DEFAULTS.WEAK;

  // Create recommendation
  return createPositionRecommendation(
    asset,
    direction,
    sizePercent,
    {
      stopLoss: slTpDefaults.stopLoss,
      takeProfit: slTpDefaults.takeProfit,
      tradeable: isTradeableAsset(asset),
      perpSymbol: getPerpSymbol(asset),
      reasoning: {
        weightedDirection,
        weightedConfidence,
        agreement,
        conviction,
        analystBreakdown: formatAnalystBreakdown(analystBreakdown)
      }
    }
  );
}

// ============================================================================
// POSITION SIZE CALCULATION
// ============================================================================

/**
 * Calculate position size as percentage of portfolio
 * @param {number} direction - Weighted direction score
 * @param {number} confidence - Weighted confidence
 * @param {number} agreement - Agreement factor
 * @returns {number} - Position size as decimal (0-0.05)
 */
export function calculatePositionSize(direction, confidence, agreement) {
  // Get conviction level and base size
  const conviction = getConvictionLevel(direction);
  if (conviction === 'NONE') return 0;

  const baseSize = getBasePositionSize(conviction);
  const maxSize = getMaxPositionSize(conviction);

  // Apply confidence multiplier
  const confidenceMultiplier = getConfidenceMultiplier(confidence);

  // Calculate adjusted size
  let adjustedSize = baseSize * confidenceMultiplier;

  // Apply agreement bonus (can push toward max)
  if (agreement >= 0.8) {
    // Strong agreement: can reach max size
    adjustedSize = Math.min(maxSize, adjustedSize * 1.15);
  } else if (agreement >= 0.6) {
    // Good agreement: slight boost
    adjustedSize = Math.min(maxSize, adjustedSize * 1.05);
  } else if (agreement < 0.4) {
    // Disagreement: reduce size
    adjustedSize = adjustedSize * 0.8;
  }

  // Apply magnitude scaling within conviction level
  // Higher magnitude = closer to max size for that conviction
  const scoreMagnitude = Math.abs(direction);
  const minScore = POSITION_SIZING[conviction].minScore;
  const nextMinScore = conviction === 'STRONG' ? 11 : POSITION_SIZING[
    conviction === 'MODERATE' ? 'STRONG' : 'MODERATE'
  ].minScore;

  const magnitudeRatio = (scoreMagnitude - minScore) / (nextMinScore - minScore);
  const magnitudeBoost = 1 + (magnitudeRatio * 0.2);

  adjustedSize = Math.min(maxSize, adjustedSize * magnitudeBoost);

  // Enforce absolute max
  return Math.min(RISK_LIMITS.MAX_POSITION, Math.max(0, adjustedSize));
}

// ============================================================================
// NO POSITION HELPERS
// ============================================================================

/**
 * Create a recommendation for no position
 * @param {string} asset - Asset symbol
 * @param {string} reason - Why no position
 * @param {AggregatedScore} aggregatedScore - Original score
 * @returns {PositionRecommendation}
 */
function createNoPositionRecommendation(asset, reason, aggregatedScore) {
  return createPositionRecommendation(
    asset,
    'FLAT',
    0,
    {
      stopLoss: 0,
      takeProfit: 0,
      tradeable: isTradeableAsset(asset),
      perpSymbol: getPerpSymbol(asset),
      reasoning: {
        noPositionReason: reason,
        weightedDirection: aggregatedScore.weightedDirection,
        weightedConfidence: aggregatedScore.weightedConfidence,
        agreement: aggregatedScore.agreement
      }
    }
  );
}

/**
 * Format analyst breakdown for reasoning
 * @param {Object} breakdown - Raw breakdown
 * @returns {Object} - Formatted breakdown
 */
function formatAnalystBreakdown(breakdown) {
  const formatted = {};

  for (const [agent, data] of Object.entries(breakdown || {})) {
    formatted[agent] = {
      score: data.score?.toFixed(1) || '0',
      confidence: `${((data.confidence || 0) * 100).toFixed(0)}%`,
      weight: `${((data.weight || 0) * 100).toFixed(0)}%`,
      contribution: data.contribution?.toFixed(2) || '0'
    };
  }

  return formatted;
}

// ============================================================================
// STOP LOSS / TAKE PROFIT CALCULATION
// ============================================================================

/**
 * Calculate dynamic stop loss based on volatility
 * @param {number} baseStopLoss - Base stop loss percentage
 * @param {number} volatility - Current volatility (e.g., VIX or ATR ratio)
 * @returns {number} - Adjusted stop loss
 */
export function adjustStopLossForVolatility(baseStopLoss, volatility) {
  // Higher volatility = wider stops
  let multiplier = 1.0;

  if (volatility > 30) {
    // High volatility (VIX > 30)
    multiplier = 1.5;
  } else if (volatility > 20) {
    // Elevated volatility
    multiplier = 1.25;
  } else if (volatility < 15) {
    // Low volatility
    multiplier = 0.85;
  }

  // Max stop loss of 5%
  return Math.min(0.05, baseStopLoss * multiplier);
}

/**
 * Calculate take profit maintaining risk/reward ratio
 * @param {number} stopLoss - Stop loss percentage
 * @param {number} rrRatio - Risk/reward ratio (default 2:1)
 * @returns {number} - Take profit percentage
 */
export function calculateTakeProfit(stopLoss, rrRatio = 2) {
  return stopLoss * rrRatio;
}

// ============================================================================
// POSITION SUMMARY UTILITIES
// ============================================================================

/**
 * Get total proposed portfolio heat from recommendations
 * @param {PositionRecommendation[]} recommendations - Position recommendations
 * @returns {number} - Total heat as decimal
 */
export function getTotalProposedHeat(recommendations) {
  return recommendations.reduce((total, rec) => {
    if (rec.direction !== 'FLAT') {
      return total + rec.sizePercent;
    }
    return total;
  }, 0);
}

/**
 * Get only tradeable recommendations
 * @param {PositionRecommendation[]} recommendations - All recommendations
 * @returns {PositionRecommendation[]} - Filtered to tradeable only
 */
export function getTradeableRecommendations(recommendations) {
  return recommendations.filter(rec => rec.tradeable && rec.direction !== 'FLAT');
}

/**
 * Summarize recommendations for logging
 * @param {PositionRecommendation[]} recommendations - Recommendations
 * @returns {Object} - Summary object
 */
export function summarizeRecommendations(recommendations) {
  const summary = {
    total: recommendations.length,
    longs: 0,
    shorts: 0,
    flat: 0,
    tradeable: 0,
    totalHeat: 0,
    byAsset: {}
  };

  for (const rec of recommendations) {
    summary.byAsset[rec.asset] = {
      direction: rec.direction,
      size: `${(rec.sizePercent * 100).toFixed(1)}%`,
      tradeable: rec.tradeable
    };

    if (rec.direction === 'LONG') summary.longs++;
    else if (rec.direction === 'SHORT') summary.shorts++;
    else summary.flat++;

    if (rec.tradeable && rec.direction !== 'FLAT') {
      summary.tradeable++;
      summary.totalHeat += rec.sizePercent;
    }
  }

  summary.totalHeat = `${(summary.totalHeat * 100).toFixed(1)}%`;

  return summary;
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  calculatePositionRecommendations,
  calculatePositionForAsset,
  calculatePositionSize,
  adjustStopLossForVolatility,
  calculateTakeProfit,
  getTotalProposedHeat,
  getTradeableRecommendations,
  summarizeRecommendations
};
