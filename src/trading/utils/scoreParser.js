/**
 * Score Parser Utility
 *
 * Parses LLM responses to extract scoring JSON from <scores> tags.
 * Validates and normalizes scores, provides fallback mechanisms.
 */

import { ASSETS } from '../config/scoring-config.js';
import {
  createAssetScore,
  createAnalystScoreOutput,
  isValidDirectionScore,
  isValidConfidence,
  isValidAsset
} from '../types/scoring.js';

// ============================================================================
// MAIN PARSER FUNCTION
// ============================================================================

/**
 * Parse LLM response to extract scores and text
 * @param {string} response - Full LLM response text
 * @param {string} agentId - Agent identifier (EMO, TEKNO, MACRO)
 * @param {Object} metadata - Additional metadata to include
 * @returns {Object} - { success, output: AnalystScoreOutput, error? }
 */
export function parseScoreResponse(response, agentId, metadata = {}) {
  try {
    // Extract scores JSON from <scores> tags
    const scoresMatch = response.match(/<scores>([\s\S]*?)<\/scores>/i);

    if (!scoresMatch) {
      console.warn(`[ScoreParser] No <scores> tags found in ${agentId} response`);
      return {
        success: false,
        output: createFallbackOutput(agentId, response, metadata),
        error: 'No scores tags found'
      };
    }

    const scoresJson = scoresMatch[1].trim();

    // Try to parse JSON
    let parsedScores;
    try {
      parsedScores = JSON.parse(scoresJson);
    } catch (jsonError) {
      console.warn(`[ScoreParser] Invalid JSON in ${agentId} scores:`, jsonError.message);
      return {
        success: false,
        output: createFallbackOutput(agentId, response, metadata),
        error: `Invalid JSON: ${jsonError.message}`
      };
    }

    // Extract text response (everything before <scores> tags)
    const textResponse = extractTextResponse(response);

    // Validate and normalize scores
    const validatedScores = validateAndNormalizeScores(
      parsedScores.scores || [],
      agentId
    );

    // Create output
    const output = createAnalystScoreOutput(
      agentId,
      validatedScores,
      textResponse,
      {
        ...metadata,
        parseSuccess: true,
        rawScoreCount: parsedScores.scores?.length || 0
      }
    );

    return {
      success: true,
      output
    };
  } catch (error) {
    console.error(`[ScoreParser] Error parsing ${agentId} response:`, error);
    return {
      success: false,
      output: createFallbackOutput(agentId, response, metadata),
      error: error.message
    };
  }
}

// ============================================================================
// VALIDATION & NORMALIZATION
// ============================================================================

/**
 * Validate and normalize array of scores
 * @param {Array} scores - Raw scores from LLM
 * @param {string} agentId - Agent ID for logging
 * @returns {AssetScore[]} - Validated scores
 */
function validateAndNormalizeScores(scores, agentId) {
  const validatedScores = [];
  const processedAssets = new Set();

  // Process provided scores
  for (const score of scores) {
    if (!score || typeof score !== 'object') continue;

    const asset = score.asset?.toUpperCase();

    // Skip if invalid or already processed
    if (!isValidAsset(asset, ASSETS) || processedAssets.has(asset)) {
      continue;
    }

    // Normalize direction
    let direction = parseFloat(score.direction);
    if (!isValidDirectionScore(direction)) {
      console.warn(`[ScoreParser] Invalid direction for ${asset} from ${agentId}: ${score.direction}`);
      direction = 0;
    }
    direction = Math.max(-10, Math.min(10, direction));

    // Normalize confidence
    let confidence = parseFloat(score.confidence);
    if (!isValidConfidence(confidence)) {
      console.warn(`[ScoreParser] Invalid confidence for ${asset} from ${agentId}: ${score.confidence}`);
      confidence = 0.5;
    }
    confidence = Math.max(0, Math.min(1, confidence));

    // Extract rationale
    const rationale = typeof score.rationale === 'string'
      ? score.rationale.substring(0, 500) // Limit length
      : '';

    validatedScores.push(createAssetScore(asset, direction, confidence, rationale));
    processedAssets.add(asset);
  }

  // Fill in missing assets with neutral scores
  for (const asset of ASSETS) {
    if (!processedAssets.has(asset)) {
      validatedScores.push(createAssetScore(asset, 0, 0.3, 'No analysis provided'));
    }
  }

  return validatedScores;
}

// ============================================================================
// TEXT EXTRACTION
// ============================================================================

/**
 * Extract text response from LLM output (everything before <scores>)
 * @param {string} response - Full response
 * @returns {string} - Text portion
 */
function extractTextResponse(response) {
  // Find where scores tags start
  const scoresIndex = response.indexOf('<scores>');

  if (scoresIndex === -1) {
    return response.trim();
  }

  // Get everything before <scores>
  let textResponse = response.substring(0, scoresIndex).trim();

  // Clean up any trailing whitespace or incomplete sentences
  if (textResponse.length > 0) {
    // Remove any incomplete JSON or tags at the end
    textResponse = textResponse.replace(/[\[\{,\s]*$/, '').trim();
  }

  return textResponse || 'Analysis complete.';
}

// ============================================================================
// FALLBACK GENERATION
// ============================================================================

/**
 * Create fallback output when parsing fails
 * @param {string} agentId - Agent ID
 * @param {string} response - Original response text
 * @param {Object} metadata - Additional metadata
 * @returns {AnalystScoreOutput}
 */
function createFallbackOutput(agentId, response, metadata = {}) {
  // Generate neutral fallback scores
  const fallbackScores = ASSETS.map(asset =>
    createAssetScore(asset, 0, 0.3, 'Fallback neutral score - parsing failed')
  );

  // Strip <scores> tags even in fallback mode - don't show raw JSON to users
  const textResponse = extractTextResponse(response) || `${agentId} analysis pending.`;

  return createAnalystScoreOutput(
    agentId,
    fallbackScores,
    textResponse,
    {
      ...metadata,
      parseSuccess: false,
      fallback: true
    }
  );
}

// ============================================================================
// SENTIMENT-BASED FALLBACK SCORES
// ============================================================================

/**
 * Generate fallback scores based on market data for sentiment analysis
 * Used when EMO API fails
 * @param {Object} marketData - Market data object
 * @returns {AssetScore[]}
 */
export function generateSentimentFallbackScores(marketData) {
  const { fearGreed, fundingRate, btcPrice, vix } = marketData || {};
  const scores = [];

  // Base direction from Fear & Greed (contrarian interpretation)
  let baseDirection = 0;
  let baseConfidence = 0.4;
  let rationale = '';

  if (fearGreed !== undefined) {
    if (fearGreed < 25) {
      // Extreme fear = contrarian bullish
      baseDirection = 4;
      baseConfidence = 0.6;
      rationale = `Extreme fear at ${fearGreed} - contrarian bullish signal`;
    } else if (fearGreed < 40) {
      baseDirection = 2;
      baseConfidence = 0.5;
      rationale = `Fear zone at ${fearGreed} - slight bullish lean`;
    } else if (fearGreed > 75) {
      // Extreme greed = contrarian bearish
      baseDirection = -4;
      baseConfidence = 0.6;
      rationale = `Extreme greed at ${fearGreed} - contrarian bearish signal`;
    } else if (fearGreed > 60) {
      baseDirection = -2;
      baseConfidence = 0.5;
      rationale = `Greed zone at ${fearGreed} - slight bearish lean`;
    } else {
      rationale = `Neutral sentiment at ${fearGreed}`;
    }
  }

  // Adjust for funding rate
  if (fundingRate !== undefined) {
    const fundingPercent = fundingRate * 100;
    if (Math.abs(fundingPercent) > 0.05) {
      if (fundingPercent > 0) {
        baseDirection -= 1; // Overheated longs
        rationale += ` Funding elevated at ${fundingPercent.toFixed(3)}%.`;
      } else {
        baseDirection += 1; // Shorts getting squeezed
        rationale += ` Funding negative at ${fundingPercent.toFixed(3)}%.`;
      }
    }
  }

  // Apply to all assets (sentiment affects all similarly)
  for (const asset of ASSETS) {
    // Slight variation per asset
    let assetDirection = baseDirection;
    if (asset === 'SOL' || asset === 'XRP') {
      // Alts more volatile, so amplify
      assetDirection = Math.round(baseDirection * 1.2);
    }

    scores.push(createAssetScore(
      asset,
      Math.max(-10, Math.min(10, assetDirection)),
      baseConfidence,
      rationale || 'Sentiment-based fallback score'
    ));
  }

  return scores;
}

/**
 * Generate fallback scores based on market data for technical analysis
 * Used when TEKNO API fails
 * @param {Object} marketData - Market data object
 * @returns {AssetScore[]}
 */
export function generateTechnicalFallbackScores(marketData) {
  const { btcPrice, ethPrice, fearGreed } = marketData || {};
  const scores = [];

  // BTC analysis based on price levels
  let btcDirection = 0;
  let btcConfidence = 0.4;
  let btcRationale = 'Technical fallback';

  if (btcPrice) {
    // Simple support/resistance logic
    if (btcPrice < 85000) {
      btcDirection = 3;
      btcRationale = `BTC at $${Math.floor(btcPrice)} near support zone`;
      btcConfidence = 0.5;
    } else if (btcPrice > 100000) {
      btcDirection = -2;
      btcRationale = `BTC at $${Math.floor(btcPrice)} in extended territory`;
      btcConfidence = 0.5;
    } else {
      btcRationale = `BTC at $${Math.floor(btcPrice)} mid-range`;
    }
  }

  scores.push(createAssetScore('BTC', btcDirection, btcConfidence, btcRationale));

  // ETH analysis
  let ethDirection = Math.round(btcDirection * 0.9);
  let ethRationale = ethPrice
    ? `ETH at $${Math.floor(ethPrice)} following BTC`
    : 'ETH following BTC trend';

  scores.push(createAssetScore('ETH', ethDirection, 0.4, ethRationale));

  // SOL and XRP - more volatile, follow BTC with amplification
  scores.push(createAssetScore('SOL', Math.round(btcDirection * 1.1), 0.35, 'SOL following market with beta'));
  scores.push(createAssetScore('XRP', Math.round(btcDirection * 0.8), 0.35, 'XRP following market'));

  return scores;
}

/**
 * Generate fallback scores based on market data for macro analysis
 * Used when MACRO API fails
 * @param {Object} marketData - Market data object
 * @returns {AssetScore[]}
 */
export function generateMacroFallbackScores(marketData) {
  const { dxy, vix, treasury10Y } = marketData || {};
  const scores = [];

  let baseDirection = 0;
  let baseConfidence = 0.4;
  let rationale = 'Macro fallback';

  // DXY analysis
  if (dxy !== undefined) {
    if (dxy > 105) {
      baseDirection = -3;
      rationale = `Strong dollar at ${dxy.toFixed(1)} pressuring risk assets`;
      baseConfidence = 0.55;
    } else if (dxy < 100) {
      baseDirection = 3;
      rationale = `Weak dollar at ${dxy.toFixed(1)} supporting risk assets`;
      baseConfidence = 0.55;
    } else {
      rationale = `DXY at ${dxy.toFixed(1)} neutral`;
    }
  }

  // VIX adjustment
  if (vix !== undefined) {
    if (vix > 30) {
      baseDirection -= 2;
      baseConfidence *= 0.8; // Less confident in high vol
      rationale += ` VIX spiking at ${vix.toFixed(1)}.`;
    } else if (vix < 15) {
      baseDirection += 1;
      rationale += ` Low VIX at ${vix.toFixed(1)}.`;
    }
  }

  // Apply to all assets
  for (const asset of ASSETS) {
    scores.push(createAssetScore(
      asset,
      Math.max(-10, Math.min(10, baseDirection)),
      baseConfidence,
      rationale || 'Macro-based fallback score'
    ));
  }

  return scores;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if response contains valid scores
 * @param {string} response - LLM response
 * @returns {boolean}
 */
export function hasValidScores(response) {
  if (!response) return false;

  const scoresMatch = response.match(/<scores>([\s\S]*?)<\/scores>/i);
  if (!scoresMatch) return false;

  try {
    const parsed = JSON.parse(scoresMatch[1].trim());
    return Array.isArray(parsed.scores) && parsed.scores.length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract just the scores array from a response
 * @param {string} response - LLM response
 * @returns {Array|null}
 */
export function extractScoresArray(response) {
  const result = parseScoreResponse(response, 'UNKNOWN');
  if (result.success) {
    return result.output.scores;
  }
  return null;
}

/**
 * Get score for a specific asset from parsed output
 * @param {AnalystScoreOutput} output - Parsed analyst output
 * @param {string} asset - Asset symbol
 * @returns {AssetScore|null}
 */
export function getScoreForAsset(output, asset) {
  if (!output?.scores) return null;
  return output.scores.find(s => s.asset.toUpperCase() === asset.toUpperCase()) || null;
}

export default {
  parseScoreResponse,
  generateSentimentFallbackScores,
  generateTechnicalFallbackScores,
  generateMacroFallbackScores,
  hasValidScores,
  extractScoresArray,
  getScoreForAsset
};
