/**
 * Risk Manager Service
 *
 * Enforces risk limits on position recommendations.
 * Checks portfolio heat, daily loss limits, and individual position limits.
 * Scales down recommendations when limits are exceeded.
 */

import { RISK_LIMITS } from '../config/scoring-config.js';

// ============================================================================
// RISK CHECK RESULT TYPES
// ============================================================================

/**
 * @typedef {Object} RiskCheckResult
 * @property {boolean} passed - Whether risk check passed
 * @property {string} reason - Reason for pass/fail
 * @property {number} [allowedSize] - Maximum allowed size if check failed
 * @property {Object} [details] - Additional details
 */

/**
 * @typedef {Object} RiskEnforcementResult
 * @property {PositionRecommendation[]} adjustedRecommendations - Adjusted recommendations
 * @property {Object} riskSummary - Summary of risk checks
 * @property {boolean} anyAdjustments - Whether any adjustments were made
 */

// ============================================================================
// MAIN RISK ENFORCEMENT
// ============================================================================

/**
 * Apply all risk checks and adjust recommendations as needed
 * @param {PositionRecommendation[]} recommendations - Position recommendations
 * @param {Object} portfolioState - Current portfolio state
 * @returns {RiskEnforcementResult}
 */
export function enforceRiskLimits(recommendations, portfolioState = {}) {
  const {
    currentHeat = 0,      // Current portfolio heat (sum of existing positions)
    dailyPnL = 0,         // Today's PnL as percentage
    existingPositions = [] // Existing positions
  } = portfolioState;

  const riskSummary = {
    dailyLossCheck: null,
    portfolioHeatCheck: null,
    individualPositionChecks: {},
    maxPositionsCheck: null
  };

  let anyAdjustments = false;

  // Check 1: Daily loss limit
  const dailyLossCheck = checkDailyLossLimit(dailyPnL);
  riskSummary.dailyLossCheck = dailyLossCheck;

  if (!dailyLossCheck.passed) {
    // Daily loss exceeded - no new positions
    console.warn('[RiskManager] Daily loss limit exceeded, blocking all new positions');
    return {
      adjustedRecommendations: recommendations.map(rec => ({
        ...rec,
        direction: 'FLAT',
        sizePercent: 0,
        reasoning: {
          ...rec.reasoning,
          riskAdjustment: dailyLossCheck.reason
        }
      })),
      riskSummary,
      anyAdjustments: true
    };
  }

  // Check 2: Maximum positions
  const currentPositionCount = existingPositions.filter(p => p.sizePercent > 0).length;
  const newPositions = recommendations.filter(r => r.direction !== 'FLAT');
  const maxPositionsCheck = checkMaxPositions(currentPositionCount, newPositions.length);
  riskSummary.maxPositionsCheck = maxPositionsCheck;

  // Check 3: Portfolio heat
  const proposedHeat = recommendations.reduce((sum, r) =>
    r.direction !== 'FLAT' ? sum + r.sizePercent : sum, 0
  );
  const totalHeat = currentHeat + proposedHeat;
  const portfolioHeatCheck = checkPortfolioHeat(currentHeat, proposedHeat);
  riskSummary.portfolioHeatCheck = portfolioHeatCheck;

  // Apply adjustments if needed
  const adjustedRecommendations = [];

  for (const rec of recommendations) {
    // Check individual position size
    const positionCheck = checkIndividualPositionSize(rec.sizePercent);
    riskSummary.individualPositionChecks[rec.asset] = positionCheck;

    let adjustedRec = { ...rec };

    // Apply individual position limit
    if (!positionCheck.passed && rec.direction !== 'FLAT') {
      adjustedRec.sizePercent = positionCheck.allowedSize;
      adjustedRec.reasoning = {
        ...adjustedRec.reasoning,
        riskAdjustment: positionCheck.reason
      };
      anyAdjustments = true;
    }

    // Apply portfolio heat scaling if needed
    if (!portfolioHeatCheck.passed && rec.direction !== 'FLAT') {
      const scaleFactor = portfolioHeatCheck.scaleFactor || 0.5;
      const scaledSize = adjustedRec.sizePercent * scaleFactor;

      adjustedRec.sizePercent = scaledSize;
      adjustedRec.reasoning = {
        ...adjustedRec.reasoning,
        riskAdjustment: `${adjustedRec.reasoning?.riskAdjustment || ''} ${portfolioHeatCheck.reason}`.trim()
      };
      anyAdjustments = true;
    }

    // Check max positions
    if (!maxPositionsCheck.passed && rec.direction !== 'FLAT') {
      // If we're at max positions, only allow replacing existing positions
      const hasExistingPosition = existingPositions.some(p => p.asset === rec.asset);
      if (!hasExistingPosition) {
        adjustedRec.direction = 'FLAT';
        adjustedRec.sizePercent = 0;
        adjustedRec.reasoning = {
          ...adjustedRec.reasoning,
          riskAdjustment: maxPositionsCheck.reason
        };
        anyAdjustments = true;
      }
    }

    adjustedRecommendations.push(adjustedRec);
  }

  return {
    adjustedRecommendations,
    riskSummary,
    anyAdjustments
  };
}

// ============================================================================
// INDIVIDUAL RISK CHECKS
// ============================================================================

/**
 * Check if daily loss limit has been exceeded
 * @param {number} dailyPnL - Today's PnL as decimal (e.g., -0.015 = -1.5%)
 * @returns {RiskCheckResult}
 */
export function checkDailyLossLimit(dailyPnL) {
  const maxDailyLoss = RISK_LIMITS.MAX_DAILY_LOSS;

  // dailyPnL is negative for losses
  if (dailyPnL <= -maxDailyLoss) {
    return {
      passed: false,
      reason: `Daily loss limit hit: ${(dailyPnL * 100).toFixed(2)}% (max: -${maxDailyLoss * 100}%)`,
      details: {
        currentLoss: dailyPnL,
        limit: -maxDailyLoss
      }
    };
  }

  // Calculate remaining loss budget
  const remainingBudget = maxDailyLoss + dailyPnL; // If pnl is -0.01 and max is 0.02, remaining is 0.01

  return {
    passed: true,
    reason: `Daily loss within limits: ${(dailyPnL * 100).toFixed(2)}% (${(remainingBudget * 100).toFixed(2)}% remaining)`,
    details: {
      currentLoss: dailyPnL,
      limit: -maxDailyLoss,
      remainingBudget
    }
  };
}

/**
 * Check portfolio heat limit
 * @param {number} currentHeat - Current portfolio heat
 * @param {number} proposedHeat - Heat from proposed positions
 * @returns {RiskCheckResult}
 */
export function checkPortfolioHeat(currentHeat, proposedHeat) {
  const maxHeat = RISK_LIMITS.MAX_HEAT;
  const totalHeat = currentHeat + proposedHeat;

  if (totalHeat > maxHeat) {
    // Calculate how much we need to scale down
    const availableHeat = Math.max(0, maxHeat - currentHeat);
    const scaleFactor = proposedHeat > 0 ? availableHeat / proposedHeat : 0;

    return {
      passed: false,
      reason: `Portfolio heat exceeds limit: ${(totalHeat * 100).toFixed(1)}% (max: ${maxHeat * 100}%)`,
      scaleFactor,
      details: {
        currentHeat,
        proposedHeat,
        totalHeat,
        maxHeat,
        availableHeat,
        scaleFactor
      }
    };
  }

  return {
    passed: true,
    reason: `Portfolio heat within limits: ${(totalHeat * 100).toFixed(1)}% (max: ${maxHeat * 100}%)`,
    details: {
      currentHeat,
      proposedHeat,
      totalHeat,
      maxHeat
    }
  };
}

/**
 * Check individual position size limit
 * @param {number} sizePercent - Proposed position size
 * @returns {RiskCheckResult}
 */
export function checkIndividualPositionSize(sizePercent) {
  const maxPosition = RISK_LIMITS.MAX_POSITION;

  if (sizePercent > maxPosition) {
    return {
      passed: false,
      reason: `Position size ${(sizePercent * 100).toFixed(1)}% exceeds max ${maxPosition * 100}%`,
      allowedSize: maxPosition,
      details: {
        proposedSize: sizePercent,
        maxSize: maxPosition
      }
    };
  }

  return {
    passed: true,
    reason: `Position size within limits: ${(sizePercent * 100).toFixed(1)}%`,
    details: {
      proposedSize: sizePercent,
      maxSize: maxPosition
    }
  };
}

/**
 * Check max positions limit
 * @param {number} currentCount - Current number of positions
 * @param {number} newCount - Number of new positions proposed
 * @returns {RiskCheckResult}
 */
export function checkMaxPositions(currentCount, newCount) {
  const maxPositions = RISK_LIMITS.MAX_POSITIONS;
  const totalCount = currentCount + newCount;

  if (totalCount > maxPositions) {
    return {
      passed: false,
      reason: `Max positions exceeded: ${totalCount} (max: ${maxPositions})`,
      details: {
        currentCount,
        newCount,
        maxPositions
      }
    };
  }

  return {
    passed: true,
    reason: `Position count within limits: ${totalCount} (max: ${maxPositions})`,
    details: {
      currentCount,
      newCount,
      maxPositions
    }
  };
}

// ============================================================================
// RISK STATE MANAGEMENT
// ============================================================================

/**
 * Calculate current portfolio state from positions
 * @param {Array} positions - Array of current positions
 * @returns {Object} - Portfolio state
 */
export function calculatePortfolioState(positions = []) {
  let currentHeat = 0;

  for (const position of positions) {
    if (position.sizePercent && position.sizePercent > 0) {
      currentHeat += position.sizePercent;
    }
  }

  return {
    currentHeat,
    existingPositions: positions,
    positionCount: positions.filter(p => p.sizePercent > 0).length
  };
}

/**
 * Check if trading should be paused based on risk state
 * @param {Object} portfolioState - Current portfolio state
 * @returns {Object} - { shouldPause, reasons }
 */
export function shouldPauseTrading(portfolioState) {
  const { dailyPnL = 0, currentHeat = 0 } = portfolioState;
  const reasons = [];

  // Check daily loss
  if (dailyPnL <= -RISK_LIMITS.MAX_DAILY_LOSS) {
    reasons.push(`Daily loss limit exceeded: ${(dailyPnL * 100).toFixed(2)}%`);
  }

  // Check if severely overexposed
  if (currentHeat > RISK_LIMITS.MAX_HEAT * 1.5) {
    reasons.push(`Severely overexposed: ${(currentHeat * 100).toFixed(1)}% heat`);
  }

  return {
    shouldPause: reasons.length > 0,
    reasons
  };
}

// ============================================================================
// RISK SUMMARY FORMATTING
// ============================================================================

/**
 * Format risk summary for logging/display
 * @param {Object} riskSummary - Risk summary object
 * @returns {string}
 */
export function formatRiskSummary(riskSummary) {
  const lines = ['=== Risk Summary ==='];

  if (riskSummary.dailyLossCheck) {
    const icon = riskSummary.dailyLossCheck.passed ? '✓' : '✗';
    lines.push(`${icon} Daily Loss: ${riskSummary.dailyLossCheck.reason}`);
  }

  if (riskSummary.portfolioHeatCheck) {
    const icon = riskSummary.portfolioHeatCheck.passed ? '✓' : '✗';
    lines.push(`${icon} Portfolio Heat: ${riskSummary.portfolioHeatCheck.reason}`);
  }

  if (riskSummary.maxPositionsCheck) {
    const icon = riskSummary.maxPositionsCheck.passed ? '✓' : '✗';
    lines.push(`${icon} Max Positions: ${riskSummary.maxPositionsCheck.reason}`);
  }

  if (riskSummary.individualPositionChecks) {
    for (const [asset, check] of Object.entries(riskSummary.individualPositionChecks)) {
      if (!check.passed) {
        lines.push(`✗ ${asset}: ${check.reason}`);
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  enforceRiskLimits,
  checkDailyLossLimit,
  checkPortfolioHeat,
  checkIndividualPositionSize,
  checkMaxPositions,
  calculatePortfolioState,
  shouldPauseTrading,
  formatRiskSummary
};
