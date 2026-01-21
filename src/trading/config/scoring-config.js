/**
 * Scoring System Configuration
 *
 * Central configuration for the agent scoring system including
 * assets, weights, risk limits, and position sizing parameters.
 */

// ============================================================================
// ASSET CONFIGURATION
// ============================================================================

/**
 * All assets analyzed by the agent system
 */
export const ASSETS = ['BTC', 'ETH', 'SOL', 'XRP'];

/**
 * Assets that are tradeable on Lighter DEX (perps)
 */
export const TRADEABLE_ASSETS = ['BTC', 'ETH'];

/**
 * Mapping from asset to perp symbol
 */
export const PERP_SYMBOLS = {
  BTC: 'BTC-PERP',
  ETH: 'ETH-PERP'
};

/**
 * Check if an asset is tradeable
 * @param {string} asset - Asset symbol
 * @returns {boolean}
 */
export function isTradeableAsset(asset) {
  return TRADEABLE_ASSETS.includes(asset.toUpperCase());
}

/**
 * Get perp symbol for an asset
 * @param {string} asset - Asset symbol
 * @returns {string|null}
 */
export function getPerpSymbol(asset) {
  return PERP_SYMBOLS[asset.toUpperCase()] || null;
}

// ============================================================================
// ANALYST WEIGHT CONFIGURATION
// ============================================================================

/**
 * Default analyst weights (equal weighting)
 */
export const ANALYST_WEIGHTS = {
  EMO: 0.333,     // Sentiment Oracle
  TEKNO: 0.333,   // Market Analyst (Technical)
  MACRO: 0.334    // Macro Specialist
};

/**
 * Alternative weight schemes for shadow testing
 * These are logged but not executed to compare performance
 */
export const SHADOW_WEIGHTS = {
  // Momentum/technical focused - trusts TEKNO more
  momentum_focused: {
    EMO: 0.2,
    TEKNO: 0.5,
    MACRO: 0.3
  },
  // Sentiment focused - trusts EMO more
  sentiment_focused: {
    EMO: 0.5,
    TEKNO: 0.25,
    MACRO: 0.25
  },
  // Macro focused - trusts MACRO more
  macro_focused: {
    EMO: 0.2,
    TEKNO: 0.3,
    MACRO: 0.5
  },
  // Contrarian - inverse of sentiment
  contrarian: {
    EMO: 0.15,
    TEKNO: 0.45,
    MACRO: 0.4
  }
};

/**
 * Get all available weight schemes (including default)
 * @returns {Object}
 */
export function getAllWeightSchemes() {
  return {
    default: ANALYST_WEIGHTS,
    ...SHADOW_WEIGHTS
  };
}

// ============================================================================
// RISK LIMIT CONFIGURATION
// ============================================================================

/**
 * Risk management limits
 */
export const RISK_LIMITS = {
  // Maximum position size as % of portfolio
  MAX_POSITION: 0.05,     // 5%

  // Maximum total portfolio heat (sum of all position sizes)
  MAX_HEAT: 0.15,         // 15%

  // Maximum daily loss before stopping trading
  MAX_DAILY_LOSS: 0.02,   // 2%

  // Minimum confidence to take a position
  MIN_CONFIDENCE: 0.4,    // 40%

  // Minimum score magnitude to take a position
  MIN_SCORE_MAGNITUDE: 2, // Must be >= 2 or <= -2

  // Maximum number of simultaneous positions
  MAX_POSITIONS: 3
};

/**
 * Stop loss and take profit defaults by conviction level
 */
export const SL_TP_DEFAULTS = {
  STRONG: {
    stopLoss: 0.03,     // 3% stop loss
    takeProfit: 0.06    // 6% take profit (2:1 R:R)
  },
  MODERATE: {
    stopLoss: 0.025,    // 2.5% stop loss
    takeProfit: 0.05    // 5% take profit (2:1 R:R)
  },
  WEAK: {
    stopLoss: 0.02,     // 2% stop loss
    takeProfit: 0.04    // 4% take profit (2:1 R:R)
  }
};

// ============================================================================
// POSITION SIZING CONFIGURATION
// ============================================================================

/**
 * Position sizing thresholds based on score magnitude
 * Maps absolute score value to conviction level
 */
export const POSITION_SIZING = {
  // Strong conviction: |score| >= 7
  STRONG: {
    minScore: 7,
    baseSize: 0.04,      // 4% base position
    maxSize: 0.05        // 5% max after confidence adjustment
  },
  // Moderate conviction: |score| >= 4 && < 7
  MODERATE: {
    minScore: 4,
    baseSize: 0.025,     // 2.5% base position
    maxSize: 0.035       // 3.5% max
  },
  // Weak conviction: |score| >= 2 && < 4
  WEAK: {
    minScore: 2,
    baseSize: 0.015,     // 1.5% base position
    maxSize: 0.02        // 2% max
  },
  // No position: |score| < 2
  NONE: {
    minScore: 0,
    baseSize: 0,
    maxSize: 0
  }
};

/**
 * Get conviction level from score magnitude
 * @param {number} score - Direction score (-10 to +10)
 * @returns {'STRONG'|'MODERATE'|'WEAK'|'NONE'}
 */
export function getConvictionLevel(score) {
  const magnitude = Math.abs(score);

  if (magnitude >= POSITION_SIZING.STRONG.minScore) return 'STRONG';
  if (magnitude >= POSITION_SIZING.MODERATE.minScore) return 'MODERATE';
  if (magnitude >= POSITION_SIZING.WEAK.minScore) return 'WEAK';
  return 'NONE';
}

/**
 * Get base position size for a conviction level
 * @param {'STRONG'|'MODERATE'|'WEAK'|'NONE'} conviction - Conviction level
 * @returns {number}
 */
export function getBasePositionSize(conviction) {
  return POSITION_SIZING[conviction]?.baseSize || 0;
}

/**
 * Get max position size for a conviction level
 * @param {'STRONG'|'MODERATE'|'WEAK'|'NONE'} conviction - Conviction level
 * @returns {number}
 */
export function getMaxPositionSize(conviction) {
  return POSITION_SIZING[conviction]?.maxSize || 0;
}

// ============================================================================
// CONFIDENCE ADJUSTMENT CONFIGURATION
// ============================================================================

/**
 * Confidence multiplier brackets
 * Adjusts position size based on confidence level
 */
export const CONFIDENCE_MULTIPLIERS = {
  // Very high confidence (>= 0.8): slight boost
  high: {
    minConfidence: 0.8,
    multiplier: 1.1
  },
  // Normal confidence (>= 0.6): no adjustment
  normal: {
    minConfidence: 0.6,
    multiplier: 1.0
  },
  // Low confidence (>= 0.4): reduced size
  low: {
    minConfidence: 0.4,
    multiplier: 0.75
  },
  // Very low confidence (< 0.4): no position
  veryLow: {
    minConfidence: 0,
    multiplier: 0
  }
};

/**
 * Get confidence multiplier
 * @param {number} confidence - Confidence value (0-1)
 * @returns {number}
 */
export function getConfidenceMultiplier(confidence) {
  if (confidence >= CONFIDENCE_MULTIPLIERS.high.minConfidence) {
    return CONFIDENCE_MULTIPLIERS.high.multiplier;
  }
  if (confidence >= CONFIDENCE_MULTIPLIERS.normal.minConfidence) {
    return CONFIDENCE_MULTIPLIERS.normal.multiplier;
  }
  if (confidence >= CONFIDENCE_MULTIPLIERS.low.minConfidence) {
    return CONFIDENCE_MULTIPLIERS.low.multiplier;
  }
  return CONFIDENCE_MULTIPLIERS.veryLow.multiplier;
}

// ============================================================================
// AGREEMENT BONUS CONFIGURATION
// ============================================================================

/**
 * Agreement bonus configuration
 * Boosts confidence when analysts agree on direction
 */
export const AGREEMENT_CONFIG = {
  // All 3 agree: significant boost
  unanimous: {
    minAgreement: 0.9,
    confidenceBoost: 0.1    // +10% confidence
  },
  // 2 of 3 agree strongly: moderate boost
  strong: {
    minAgreement: 0.7,
    confidenceBoost: 0.05   // +5% confidence
  },
  // Partial agreement: no boost
  partial: {
    minAgreement: 0.5,
    confidenceBoost: 0
  },
  // Disagreement: penalty
  disagreement: {
    minAgreement: 0,
    confidenceBoost: -0.1   // -10% confidence
  }
};

/**
 * Get agreement boost for confidence
 * @param {number} agreement - Agreement factor (0-1)
 * @returns {number} - Boost to add to confidence
 */
export function getAgreementBoost(agreement) {
  if (agreement >= AGREEMENT_CONFIG.unanimous.minAgreement) {
    return AGREEMENT_CONFIG.unanimous.confidenceBoost;
  }
  if (agreement >= AGREEMENT_CONFIG.strong.minAgreement) {
    return AGREEMENT_CONFIG.strong.confidenceBoost;
  }
  if (agreement >= AGREEMENT_CONFIG.partial.minAgreement) {
    return AGREEMENT_CONFIG.partial.confidenceBoost;
  }
  return AGREEMENT_CONFIG.disagreement.confidenceBoost;
}

// ============================================================================
// FIREBASE COLLECTION NAMES
// ============================================================================

/**
 * Firebase collection names for the scoring system
 */
export const FIREBASE_COLLECTIONS = {
  AGENT_SCORES: 'agentScores',
  DECISIONS: 'decisions',
  DECISION_OUTCOMES: 'decisionOutcomes',
  SHADOW_TEST_ANALYSIS: 'shadowTestAnalysis'
};

// ============================================================================
// SCORING PROMPT TEMPLATES
// ============================================================================

/**
 * Scoring instruction template for LLM prompts
 */
export const SCORING_PROMPT_TEMPLATE = `
## SCORING OUTPUT REQUIRED

After your analysis, you MUST provide scores in the following JSON format wrapped in <scores> tags:

<scores>
{
  "scores": [
    {
      "asset": "BTC",
      "direction": 0,
      "confidence": 0.5,
      "rationale": "Brief reason for this score"
    },
    {
      "asset": "ETH",
      "direction": 0,
      "confidence": 0.5,
      "rationale": "Brief reason for this score"
    },
    {
      "asset": "SOL",
      "direction": 0,
      "confidence": 0.5,
      "rationale": "Brief reason for this score"
    },
    {
      "asset": "XRP",
      "direction": 0,
      "confidence": 0.5,
      "rationale": "Brief reason for this score"
    }
  ]
}
</scores>

## DIRECTION SCORE GUIDE (-10 to +10):
- **+8 to +10**: STRONG BUY - High conviction bullish
- **+5 to +7**: BUY - Moderate bullish outlook
- **+2 to +4**: WEAK BUY - Slight bullish lean
- **-1 to +1**: NEUTRAL - No clear direction
- **-2 to -4**: WEAK SELL - Slight bearish lean
- **-5 to -7**: SELL - Moderate bearish outlook
- **-8 to -10**: STRONG SELL - High conviction bearish

## CONFIDENCE GUIDE (0 to 1):
- **0.8-1.0**: Very confident in your assessment
- **0.6-0.8**: Reasonably confident
- **0.4-0.6**: Moderate confidence
- **0.2-0.4**: Low confidence, uncertain
- **0.0-0.2**: Very uncertain

IMPORTANT: Keep your text analysis BRIEF (2-3 sentences max) before the <scores> block.
Save detailed reasoning for the rationale fields inside each score.
`;

/**
 * Direction score guide for reference
 */
export const DIRECTION_SCORE_GUIDE = {
  STRONG_BUY: { min: 8, max: 10, description: 'High conviction bullish' },
  BUY: { min: 5, max: 7, description: 'Moderate bullish outlook' },
  WEAK_BUY: { min: 2, max: 4, description: 'Slight bullish lean' },
  NEUTRAL: { min: -1, max: 1, description: 'No clear direction' },
  WEAK_SELL: { min: -4, max: -2, description: 'Slight bearish lean' },
  SELL: { min: -7, max: -5, description: 'Moderate bearish outlook' },
  STRONG_SELL: { min: -10, max: -8, description: 'High conviction bearish' }
};

// ============================================================================
// EXPORT DEFAULT CONFIG
// ============================================================================

export default {
  ASSETS,
  TRADEABLE_ASSETS,
  PERP_SYMBOLS,
  ANALYST_WEIGHTS,
  SHADOW_WEIGHTS,
  RISK_LIMITS,
  SL_TP_DEFAULTS,
  POSITION_SIZING,
  CONFIDENCE_MULTIPLIERS,
  AGREEMENT_CONFIG,
  FIREBASE_COLLECTIONS,
  SCORING_PROMPT_TEMPLATE,
  DIRECTION_SCORE_GUIDE,
  isTradeableAsset,
  getPerpSymbol,
  getAllWeightSchemes,
  getConvictionLevel,
  getBasePositionSize,
  getMaxPositionSize,
  getConfidenceMultiplier,
  getAgreementBoost
};
