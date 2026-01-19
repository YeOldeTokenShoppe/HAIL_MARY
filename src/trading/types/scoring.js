/**
 * Agent Scoring System Type Definitions
 *
 * Defines the data structures for score-based agent outputs,
 * aggregation, position recommendations, and decision logging.
 */

// ============================================================================
// ASSET SCORE TYPES
// ============================================================================

/**
 * AssetScore - Individual score for a single asset from one analyst
 * @typedef {Object} AssetScore
 * @property {string} asset - Asset symbol (BTC, ETH, SOL, XRP)
 * @property {number} direction - Directional score from -10 (strong sell) to +10 (strong buy)
 * @property {number} confidence - Confidence level from 0 to 1
 * @property {string} rationale - Brief explanation for the score
 */

/**
 * Creates a validated AssetScore object
 * @param {string} asset - Asset symbol
 * @param {number} direction - Direction score (-10 to +10)
 * @param {number} confidence - Confidence (0 to 1)
 * @param {string} rationale - Reasoning
 * @returns {AssetScore}
 */
export function createAssetScore(asset, direction, confidence, rationale = '') {
  return {
    asset: asset.toUpperCase(),
    direction: Math.max(-10, Math.min(10, direction)),
    confidence: Math.max(0, Math.min(1, confidence)),
    rationale: rationale || ''
  };
}

// ============================================================================
// ANALYST OUTPUT TYPES
// ============================================================================

/**
 * AnalystScoreOutput - Complete output from one analyst
 * @typedef {Object} AnalystScoreOutput
 * @property {string} agentId - Agent identifier (EMO, TEKNO, MACRO)
 * @property {number} timestamp - Unix timestamp of analysis
 * @property {AssetScore[]} scores - Array of scores per asset
 * @property {string} textResponse - Original text response for chat display
 * @property {Object} metadata - Additional context (market data, etc)
 */

/**
 * Creates an AnalystScoreOutput object
 * @param {string} agentId - Agent ID
 * @param {AssetScore[]} scores - Asset scores array
 * @param {string} textResponse - Text response
 * @param {Object} metadata - Additional metadata
 * @returns {AnalystScoreOutput}
 */
export function createAnalystScoreOutput(agentId, scores = [], textResponse = '', metadata = {}) {
  return {
    agentId,
    timestamp: Date.now(),
    scores,
    textResponse,
    metadata
  };
}

// ============================================================================
// AGGREGATED SCORE TYPES
// ============================================================================

/**
 * AnalystBreakdown - Individual analyst contribution to aggregated score
 * @typedef {Object} AnalystBreakdown
 * @property {number} score - Raw direction score
 * @property {number} confidence - Raw confidence
 * @property {number} weight - Weight applied
 * @property {number} contribution - Weighted contribution to final score
 * @property {string} rationale - Analyst's rationale
 */

/**
 * AggregatedScore - Combined score across all analysts for one asset
 * @typedef {Object} AggregatedScore
 * @property {string} asset - Asset symbol
 * @property {number} weightedDirection - Weighted average direction (-10 to +10)
 * @property {number} weightedConfidence - Weighted average confidence (0 to 1)
 * @property {number} agreement - Agreement factor (0 to 1) - higher when analysts agree
 * @property {Object.<string, AnalystBreakdown>} analystBreakdown - Per-analyst breakdown
 */

/**
 * Creates an AggregatedScore object
 * @param {string} asset - Asset symbol
 * @param {number} weightedDirection - Weighted direction
 * @param {number} weightedConfidence - Weighted confidence
 * @param {number} agreement - Agreement factor
 * @param {Object} analystBreakdown - Breakdown by analyst
 * @returns {AggregatedScore}
 */
export function createAggregatedScore(asset, weightedDirection, weightedConfidence, agreement, analystBreakdown = {}) {
  return {
    asset: asset.toUpperCase(),
    weightedDirection: Math.max(-10, Math.min(10, weightedDirection)),
    weightedConfidence: Math.max(0, Math.min(1, weightedConfidence)),
    agreement: Math.max(0, Math.min(1, agreement)),
    analystBreakdown
  };
}

// ============================================================================
// POSITION RECOMMENDATION TYPES
// ============================================================================

/**
 * PositionRecommendation - Trading recommendation for one asset
 * @typedef {Object} PositionRecommendation
 * @property {string} asset - Asset symbol
 * @property {'LONG'|'SHORT'|'FLAT'} direction - Position direction
 * @property {number} sizePercent - Position size as percent of portfolio (0-5%)
 * @property {number} stopLoss - Stop loss percentage (e.g., 0.02 = 2%)
 * @property {number} takeProfit - Take profit percentage (e.g., 0.04 = 4%)
 * @property {boolean} tradeable - Whether this asset is tradeable on Lighter DEX
 * @property {string} perpSymbol - Perp symbol if tradeable (e.g., 'BTC-PERP')
 * @property {Object} reasoning - Explanation for the recommendation
 */

/**
 * Creates a PositionRecommendation object
 * @param {string} asset - Asset symbol
 * @param {'LONG'|'SHORT'|'FLAT'} direction - Direction
 * @param {number} sizePercent - Size percent
 * @param {Object} options - Additional options
 * @returns {PositionRecommendation}
 */
export function createPositionRecommendation(asset, direction, sizePercent, options = {}) {
  const {
    stopLoss = 0.02,
    takeProfit = 0.04,
    tradeable = false,
    perpSymbol = null,
    reasoning = {}
  } = options;

  return {
    asset: asset.toUpperCase(),
    direction,
    sizePercent: Math.max(0, Math.min(0.05, sizePercent)), // Max 5%
    stopLoss,
    takeProfit,
    tradeable,
    perpSymbol,
    reasoning
  };
}

// ============================================================================
// DECISION LOG TYPES
// ============================================================================

/**
 * DecisionLog - Complete log of a trading decision
 * @typedef {Object} DecisionLog
 * @property {string} id - Unique decision ID
 * @property {number} timestamp - Unix timestamp
 * @property {string} asset - Asset being traded
 * @property {Object} analysts - Per-analyst breakdown
 * @property {Object} aggregated - Aggregated scores
 * @property {Object} decision - Final decision details
 * @property {Object} shadowTests - Results from alternative weight schemes
 * @property {Object|null} outcome - Filled when position closes
 */

/**
 * Creates a DecisionLog object
 * @param {string} asset - Asset symbol
 * @param {Object} analysts - Analyst data
 * @param {Object} aggregated - Aggregated data
 * @param {Object} decision - Decision data
 * @param {Object} shadowTests - Shadow test results
 * @returns {DecisionLog}
 */
export function createDecisionLog(asset, analysts, aggregated, decision, shadowTests = {}) {
  const timestamp = Date.now();
  const id = `${timestamp}_${asset}`;

  return {
    id,
    timestamp,
    asset: asset.toUpperCase(),
    analysts: {
      EMO: analysts.EMO || { score: 0, confidence: 0, rationale: '' },
      TEKNO: analysts.TEKNO || { score: 0, confidence: 0, rationale: '' },
      MACRO: analysts.MACRO || { score: 0, confidence: 0, rationale: '' }
    },
    aggregated: {
      weightedScore: aggregated.weightedDirection || 0,
      weightedConfidence: aggregated.weightedConfidence || 0,
      agreement: aggregated.agreement || 0
    },
    decision: {
      action: decision.direction || 'FLAT',
      positionSize: decision.sizePercent || 0,
      stopLoss: decision.stopLoss || 0.02,
      takeProfit: decision.takeProfit || 0.04
    },
    shadowTests,
    outcome: null // Filled later when position closes
  };
}

/**
 * DecisionOutcome - Outcome data when a position closes
 * @typedef {Object} DecisionOutcome
 * @property {number} pnl - Absolute PnL in USD
 * @property {number} pnlPercent - PnL as percentage
 * @property {number} holdingPeriod - Duration in hours
 * @property {string} exitReason - Why position was closed
 */

/**
 * Creates a DecisionOutcome object
 * @param {number} pnl - PnL in USD
 * @param {number} pnlPercent - PnL percentage
 * @param {number} holdingPeriod - Holding time in hours
 * @param {string} exitReason - Exit reason
 * @returns {DecisionOutcome}
 */
export function createDecisionOutcome(pnl, pnlPercent, holdingPeriod, exitReason) {
  return {
    pnl,
    pnlPercent,
    holdingPeriod,
    exitReason,
    closedAt: Date.now()
  };
}

// ============================================================================
// SHADOW TEST TYPES
// ============================================================================

/**
 * ShadowTestResult - Hypothetical result using alternative weights
 * @typedef {Object} ShadowTestResult
 * @property {string} weightScheme - Name of weight scheme
 * @property {Object} weights - Weight configuration used
 * @property {number} weightedDirection - Direction with these weights
 * @property {number} weightedConfidence - Confidence with these weights
 * @property {string} hypotheticalAction - What action would have been taken
 * @property {number} hypotheticalSize - What size would have been used
 */

/**
 * Creates a ShadowTestResult object
 * @param {string} weightScheme - Scheme name
 * @param {Object} weights - Weights used
 * @param {number} weightedDirection - Weighted direction
 * @param {number} weightedConfidence - Weighted confidence
 * @param {string} hypotheticalAction - Hypothetical action
 * @param {number} hypotheticalSize - Hypothetical size
 * @returns {ShadowTestResult}
 */
export function createShadowTestResult(weightScheme, weights, weightedDirection, weightedConfidence, hypotheticalAction, hypotheticalSize) {
  return {
    weightScheme,
    weights,
    weightedDirection,
    weightedConfidence,
    hypotheticalAction,
    hypotheticalSize
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a direction score is within bounds
 * @param {number} score - Score to validate
 * @returns {boolean}
 */
export function isValidDirectionScore(score) {
  return typeof score === 'number' && score >= -10 && score <= 10 && !isNaN(score);
}

/**
 * Validates a confidence value is within bounds
 * @param {number} confidence - Confidence to validate
 * @returns {boolean}
 */
export function isValidConfidence(confidence) {
  return typeof confidence === 'number' && confidence >= 0 && confidence <= 1 && !isNaN(confidence);
}

/**
 * Validates an asset symbol
 * @param {string} asset - Asset to validate
 * @param {string[]} validAssets - List of valid assets
 * @returns {boolean}
 */
export function isValidAsset(asset, validAssets = ['BTC', 'ETH', 'SOL', 'XRP']) {
  return typeof asset === 'string' && validAssets.includes(asset.toUpperCase());
}

// ============================================================================
// DIRECTION INTERPRETATION
// ============================================================================

/**
 * Direction score interpretation guide
 */
export const DIRECTION_SCALE = {
  '-10 to -8': 'STRONG SELL - High conviction bearish',
  '-7 to -5': 'SELL - Moderate bearish outlook',
  '-4 to -2': 'WEAK SELL - Slight bearish lean',
  '-1 to +1': 'NEUTRAL - No clear direction',
  '+2 to +4': 'WEAK BUY - Slight bullish lean',
  '+5 to +7': 'BUY - Moderate bullish outlook',
  '+8 to +10': 'STRONG BUY - High conviction bullish'
};

/**
 * Gets text interpretation for a direction score
 * @param {number} score - Direction score
 * @returns {string}
 */
export function interpretDirectionScore(score) {
  if (score <= -8) return 'STRONG_SELL';
  if (score <= -5) return 'SELL';
  if (score <= -2) return 'WEAK_SELL';
  if (score <= 1) return 'NEUTRAL';
  if (score <= 4) return 'WEAK_BUY';
  if (score <= 7) return 'BUY';
  return 'STRONG_BUY';
}

/**
 * Gets action from direction score
 * @param {number} score - Direction score
 * @returns {'LONG'|'SHORT'|'FLAT'}
 */
export function getActionFromScore(score) {
  if (score >= 2) return 'LONG';
  if (score <= -2) return 'SHORT';
  return 'FLAT';
}

export default {
  createAssetScore,
  createAnalystScoreOutput,
  createAggregatedScore,
  createPositionRecommendation,
  createDecisionLog,
  createDecisionOutcome,
  createShadowTestResult,
  isValidDirectionScore,
  isValidConfidence,
  isValidAsset,
  interpretDirectionScore,
  getActionFromScore,
  DIRECTION_SCALE
};
