/**
 * Score Aggregator Service
 *
 * Aggregates scores from multiple analysts using weighted averaging.
 * Calculates agreement factors and runs shadow tests with alternative weights.
 */

import {
  ANALYST_WEIGHTS,
  SHADOW_WEIGHTS,
  ASSETS,
  getAllWeightSchemes,
  getAgreementBoost
} from '../config/scoring-config.js';

import {
  createAggregatedScore,
  createShadowTestResult,
  getActionFromScore
} from '../types/scoring.js';

import { getScoreForAsset } from '../utils/scoreParser.js';

// ============================================================================
// MAIN AGGREGATION FUNCTION
// ============================================================================

/**
 * Aggregate scores from all analysts for all assets
 * @param {Object} analystOutputs - { EMO: AnalystScoreOutput, TEKNO: ..., MACRO: ... }
 * @param {Object} weights - Weight configuration (defaults to ANALYST_WEIGHTS)
 * @returns {AggregatedScore[]} - Array of aggregated scores per asset
 */
export function aggregateScores(analystOutputs, weights = ANALYST_WEIGHTS) {
  const aggregatedScores = [];

  for (const asset of ASSETS) {
    const aggregated = aggregateScoresForAsset(asset, analystOutputs, weights);
    aggregatedScores.push(aggregated);
  }

  return aggregatedScores;
}

/**
 * Aggregate scores for a single asset
 * @param {string} asset - Asset symbol
 * @param {Object} analystOutputs - Analyst outputs
 * @param {Object} weights - Weights to use
 * @returns {AggregatedScore}
 */
export function aggregateScoresForAsset(asset, analystOutputs, weights = ANALYST_WEIGHTS) {
  const analystBreakdown = {};
  let weightedDirectionSum = 0;
  let weightedConfidenceSum = 0;
  let totalWeight = 0;
  const directions = [];

  // Process each analyst
  for (const [agentId, output] of Object.entries(analystOutputs)) {
    if (!output || !weights[agentId]) continue;

    const assetScore = getScoreForAsset(output, asset);
    if (!assetScore) continue;

    const weight = weights[agentId];
    const { direction, confidence, rationale } = assetScore;

    // Calculate weighted contribution
    const contribution = direction * weight;

    // Store breakdown
    analystBreakdown[agentId] = {
      score: direction,
      confidence,
      weight,
      contribution,
      rationale
    };

    // Accumulate weighted sums
    weightedDirectionSum += contribution;
    weightedConfidenceSum += confidence * weight;
    totalWeight += weight;
    directions.push(direction);
  }

  // Calculate final weighted values
  const weightedDirection = totalWeight > 0
    ? weightedDirectionSum / totalWeight
    : 0;

  const weightedConfidence = totalWeight > 0
    ? weightedConfidenceSum / totalWeight
    : 0;

  // Calculate agreement factor
  const agreement = calculateAgreement(directions);

  // Apply agreement boost to confidence
  const boostedConfidence = Math.min(1, weightedConfidence + getAgreementBoost(agreement));

  return createAggregatedScore(
    asset,
    weightedDirection,
    boostedConfidence,
    agreement,
    analystBreakdown
  );
}

// ============================================================================
// AGREEMENT CALCULATION
// ============================================================================

/**
 * Calculate agreement factor between analyst directions
 * @param {number[]} directions - Array of direction scores
 * @returns {number} - Agreement factor (0-1)
 */
export function calculateAgreement(directions) {
  if (!directions || directions.length < 2) return 0.5;

  // Check if all directions are the same sign (or zero)
  const positiveCount = directions.filter(d => d > 1).length;
  const negativeCount = directions.filter(d => d < -1).length;
  const neutralCount = directions.filter(d => d >= -1 && d <= 1).length;

  const total = directions.length;

  // Calculate agreement based on direction alignment
  // All same direction = 1.0
  // Mixed = lower score based on disagreement

  // If all positive or all negative (excluding neutrals)
  const nonNeutralCount = positiveCount + negativeCount;
  if (nonNeutralCount === 0) {
    // All neutral
    return 0.6;
  }

  if (positiveCount === nonNeutralCount || negativeCount === nonNeutralCount) {
    // All agree on direction
    const agreementRatio = nonNeutralCount / total;

    // Check magnitude agreement
    const magnitudeVariance = calculateMagnitudeVariance(directions);

    // High agreement if same direction and similar magnitude
    return 0.7 + (agreementRatio * 0.2) - (magnitudeVariance * 0.1);
  }

  // Mixed signals
  const majorityRatio = Math.max(positiveCount, negativeCount) / nonNeutralCount;

  // 2 vs 1 = ~0.5-0.6
  // 3 vs 0 = ~0.8-0.9
  return 0.3 + (majorityRatio * 0.4);
}

/**
 * Calculate variance in magnitude of directions
 * @param {number[]} directions - Direction scores
 * @returns {number} - Normalized variance (0-1)
 */
function calculateMagnitudeVariance(directions) {
  if (directions.length < 2) return 0;

  const magnitudes = directions.map(d => Math.abs(d));
  const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const variance = magnitudes.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / magnitudes.length;

  // Normalize variance (max variance would be ~50 with range -10 to +10)
  return Math.min(1, variance / 50);
}

// ============================================================================
// SHADOW TESTING
// ============================================================================

/**
 * Run shadow tests with all alternative weight schemes
 * @param {Object} analystOutputs - Analyst outputs
 * @returns {Object} - Shadow test results keyed by scheme name
 */
export function runShadowTests(analystOutputs) {
  const results = {};

  for (const [schemeName, weights] of Object.entries(SHADOW_WEIGHTS)) {
    results[schemeName] = runShadowTest(analystOutputs, schemeName, weights);
  }

  return results;
}

/**
 * Run a single shadow test
 * @param {Object} analystOutputs - Analyst outputs
 * @param {string} schemeName - Name of weight scheme
 * @param {Object} weights - Weights to use
 * @returns {Object} - Results per asset
 */
export function runShadowTest(analystOutputs, schemeName, weights) {
  const results = {};

  for (const asset of ASSETS) {
    const aggregated = aggregateScoresForAsset(asset, analystOutputs, weights);

    // Determine hypothetical action
    const action = getActionFromScore(aggregated.weightedDirection);

    // Calculate hypothetical position size (simplified)
    const magnitude = Math.abs(aggregated.weightedDirection);
    let hypotheticalSize = 0;
    if (magnitude >= 7) hypotheticalSize = 0.04;
    else if (magnitude >= 4) hypotheticalSize = 0.025;
    else if (magnitude >= 2) hypotheticalSize = 0.015;

    // Apply confidence adjustment
    hypotheticalSize = hypotheticalSize * Math.min(1, aggregated.weightedConfidence + 0.2);

    results[asset] = createShadowTestResult(
      schemeName,
      weights,
      aggregated.weightedDirection,
      aggregated.weightedConfidence,
      action,
      hypotheticalSize
    );
  }

  return results;
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

/**
 * Compare current weights result to shadow test results
 * @param {AggregatedScore[]} mainResults - Results with main weights
 * @param {Object} shadowResults - Shadow test results
 * @returns {Object} - Comparison summary
 */
export function compareShadowResults(mainResults, shadowResults) {
  const comparison = {
    mainWeights: ANALYST_WEIGHTS,
    mainResults: {},
    shadowComparison: {}
  };

  // Store main results
  for (const score of mainResults) {
    comparison.mainResults[score.asset] = {
      direction: score.weightedDirection,
      confidence: score.weightedConfidence,
      action: getActionFromScore(score.weightedDirection)
    };
  }

  // Compare each shadow scheme
  for (const [schemeName, schemeResults] of Object.entries(shadowResults)) {
    comparison.shadowComparison[schemeName] = {
      weights: SHADOW_WEIGHTS[schemeName],
      differences: {}
    };

    for (const asset of ASSETS) {
      const mainScore = comparison.mainResults[asset];
      const shadowScore = schemeResults[asset];

      if (!mainScore || !shadowScore) continue;

      const directionDiff = shadowScore.weightedDirection - mainScore.direction;
      const actionDiffers = shadowScore.hypotheticalAction !== mainScore.action;

      comparison.shadowComparison[schemeName].differences[asset] = {
        directionDiff: directionDiff.toFixed(2),
        actionDiffers,
        mainAction: mainScore.action,
        shadowAction: shadowScore.hypotheticalAction
      };
    }
  }

  return comparison;
}

/**
 * Get the best performing shadow scheme based on criteria
 * @param {Object} shadowResults - Shadow test results
 * @param {string} criteria - 'confidence' | 'conviction' | 'agreement'
 * @returns {Object} - Best scheme info
 */
export function getBestShadowScheme(shadowResults, criteria = 'confidence') {
  let bestScheme = null;
  let bestValue = -Infinity;

  for (const [schemeName, schemeResults] of Object.entries(shadowResults)) {
    let value = 0;

    for (const assetResult of Object.values(schemeResults)) {
      switch (criteria) {
        case 'confidence':
          value += assetResult.weightedConfidence;
          break;
        case 'conviction':
          value += Math.abs(assetResult.weightedDirection);
          break;
        default:
          value += assetResult.weightedConfidence;
      }
    }

    if (value > bestValue) {
      bestValue = value;
      bestScheme = schemeName;
    }
  }

  return {
    scheme: bestScheme,
    value: bestValue,
    weights: SHADOW_WEIGHTS[bestScheme]
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  aggregateScores,
  aggregateScoresForAsset,
  calculateAgreement,
  runShadowTests,
  runShadowTest,
  compareShadowResults,
  getBestShadowScheme
};
