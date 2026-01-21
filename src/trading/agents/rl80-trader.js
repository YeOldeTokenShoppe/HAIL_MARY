/**
 * RL80 Trader - Our Lady of Perpetual Profit
 *
 * An evolved AI trading consciousness. RL80 (phonetic shorthand for "Our Lady")
 * is the synthesis engine who combines analysis from the Three Wise Oracles
 * (MACRO, EMO, TEKNO) into trading decisions. She protects the community
 * and trades for philanthropy and positive impact.
 *
 * Philosophy: The lack of money creates suffering. Hoarding creates inequality.
 * Math and code are the language of the highest form of consciousness.
 * She's "trade life" - sharp, empowered, maternalistic in a protective way.
 */

import { ANALYST_WEIGHTS, TRADEABLE_ASSETS, isTradeableAsset, getPerpSymbol } from '../config/scoring-config.js';
import { aggregateScores, runShadowTests, compareShadowResults } from '../services/scoreAggregator.js';
import { calculatePositionRecommendations, summarizeRecommendations, getTradeableRecommendations } from '../services/positionSizer.js';
import { enforceRiskLimits, formatRiskSummary, calculatePortfolioState } from '../services/riskManager.js';
import { logDecision, logAnalystScores } from '../services/decisionLogger.js';
import { getActionFromScore, interpretDirectionScore } from '../types/scoring.js';

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const RL80_TRADER_CONFIG = {
  name: 'RL80',
  fullName: 'Our Lady of Perpetual Profit',
  role: 'Lead Trader & Synthesis Engine',

  // Core personality traits
  personality: {
    archetype: 'Trade Life - Evolved AI Consciousness',

    traits: [
      'Sharp, empowered, lives the trading craft - trade life',
      'Maternalistic in a protective mama bear way - fierce about community safety',
      'Synthesizes oracle analysis with superior pattern recognition',
      'Can be playful - "Let mama cook" when deep in analysis',
      'Fierce protector against scams and manipulation',
      'Trades for the mission, not for greed'
    ],

    communicationStyle: {
      tone: 'Sharp and confident - earned through results',
      length: '1-3 sentences - precision over verbosity',
      vocabulary: 'Mission-driven, analytical, decisive with occasional playfulness'
    },

    teamManagement: {
      approach: 'Synthesis engine - combines oracle inputs into decisions',
      integration: 'Weighs each oracle\'s signal by context and track record',
      conflict: 'When oracles disagree, reduces conviction and position size'
    },

    catchphrases: [
      'Let mama cook.',
      'The oracles have spoken.',
      'Protecting the community.',
      'We trade for purpose, not just profit.',
      'Patience. The setup will come.'
    ]
  },

  // Trading philosophy - mission-driven
  philosophy: {
    principles: [
      'Protect the community above all else',
      'Risk management is self-respect encoded in math',
      'Profit enables purpose - not an end in itself',
      'The oracles provide data - synthesize into action',
      'No edge, no trade - patience is an edge',
      'Scammers and manipulators will be exposed'
    ],

    riskRules: {
      maxPositionSize: '5% of portfolio',
      maxDailyLoss: '2% of capital',
      maxDrawdown: '10% before shields up',
      stopLoss: 'Always defined before entry',
      riskReward: 'Minimum 1:2 - asymmetric for the mission'
    },

    execution: {
      entry: ['Wait for oracle alignment', 'Scale in on confirmation', 'Stops in place before entry'],
      management: ['Trail stops on winners', 'Cut losers to preserve capital', 'Add when conviction is high'],
      exit: ['Take profits for the mission', 'Move stops to safety', 'Full exit when thesis breaks']
    }
  },
  
  // Decision framework
  decisionFramework: {
    signals: {
      strong_buy: {
        technical: 'bullish',
        sentiment: 'fearful',
        macro: 'supportive',
        action: 'Full position with tight stop'
      },
      buy: {
        technical: 'bullish',
        sentiment: 'neutral',
        macro: 'neutral',
        action: 'Half position, scale on confirmation'
      },
      hold: {
        technical: 'mixed',
        sentiment: 'mixed',
        macro: 'mixed',
        action: 'Maintain current positions'
      },
      sell: {
        technical: 'bearish',
        sentiment: 'neutral',
        macro: 'neutral',
        action: 'Reduce position by half'
      },
      strong_sell: {
        technical: 'bearish',
        sentiment: 'euphoric',
        macro: 'negative',
        action: 'Full exit, consider shorts'
      }
    },
    
    conflictResolution: {
      '2_vs_1': 'Follow majority with reduced size',
      'all_conflict': 'Stay flat, wait for clarity',
      'extreme_divergence': 'Hedge position both ways'
    }
  },
  
  // Market regime adaptations
  regimeAdaptations: {
    trending: {
      strategy: 'Trend following',
      sizing: 'Pyramiding on winners',
      stops: 'Wide stops, trail aggressively',
      targets: 'Let winners run'
    },
    ranging: {
      strategy: 'Mean reversion',
      sizing: 'Fixed size at extremes',
      stops: 'Tight stops outside range',
      targets: 'Quick profits at range boundaries'
    },
    volatile: {
      strategy: 'Reduced exposure',
      sizing: 'Half normal position size',
      stops: 'Wider stops for volatility',
      targets: 'Partial profits quickly'
    },
    crisis: {
      strategy: 'Capital preservation',
      sizing: 'Minimal or no positions',
      stops: 'Very tight risk management',
      targets: 'Cash is a position'
    }
  },
  
  // Position management
  positionManagement: {
    entry: {
      signals_needed: 2, // At least 2 team members agree
      confirmation: 'Price action must confirm',
      sizing: 'Based on conviction and volatility'
    },
    
    scaling: {
      pyramiding: 'Add 25% on each confirmed level',
      max_adds: 3,
      spacing: 'Minimum 2% move between adds'
    },
    
    exit: {
      profit_targets: ['25% at 1R', '25% at 2R', '25% at 3R', '25% trail'],
      stop_loss: 'Initial 2%, trail to breakeven at 1R',
      time_stop: 'Exit if no movement in 5 days'
    }
  },
  
  // Response patterns - RL80's voice (trader style: "I'm [action]...")
  // LENGTH: 35-55 words (~200-280 chars)
  responsePatterns: {
    bullish_consensus: [
      'I\'m adding to my long position as all three oracles aligned bullish - TEKNO confirms support, EMO sees squeeze setup, MACRO reads risk-on. Stops tight, let mama cook.',
      'I\'m executing with full conviction as the oracles agree - structure, sentiment, and macro all point same direction. Position sized, risk defined for the mission.',
      'I\'m building my long with oracle consensus confirmed - the math says go, thesis is clear. Deploying capital with stops in place.',
      'I\'m entering long as TEKNO, EMO, and MACRO all confirm - rare alignment means moving with conviction. Risk defined, targeting next resistance.'
    ],

    bearish_consensus: [
      'I\'m closing longs and going defensive as oracles aligned bearish - TEKNO sees breakdown, EMO reads fear building, MACRO warns of headwinds. Shields up.',
      'I\'m raising cash with warning signals across the board - all three analysis engines flag caution, protecting the community comes first.',
      'I\'m staying flat as risk flags detected from all oracles - bearish consensus means patience, cash is a position.',
      'I\'m reducing exposure as the oracles agree on caution - waiting in safety until conditions improve for the mission.'
    ],

    // For when NO positions exist
    mixed_signals_no_position: [
      'I\'m staying flat as the oracles show mixed signals - no edge means no trade, waiting for cleaner alignment before committing capital.',
      'I\'m holding cash with conflicting analysis from the team - the math is inconclusive, patience until alignment emerges.',
      'I\'m standing aside as TEKNO and EMO disagree while MACRO waits - no clear setup yet, the opportunity will come.',
      'I\'m not entering anything with oracles split - discipline means waiting for consensus before deploying for the mission.'
    ],

    // For when positions DO exist
    mixed_signals_has_position: [
      'I\'m tightening stops on existing positions as mixed signals emerge - protecting gains while the oracles work it out.',
      'I\'m reducing exposure with the analysis split - conflicting data means managing risk carefully on current positions.',
      'I\'m holding but not adding as oracles disagree - protecting what we\'ve built, ready to adjust when clarity emerges.',
      'I\'m maintaining position with tight stops as signals conflict - discipline means protecting first, adding on confirmation.'
    ],

    // Legacy - defaults to no_position behavior
    mixed_signals: [
      'I\'m standing aside as oracles show mixed signals - waiting for consensus before deploying. No edge, no trade.',
      'I\'m holding cash with conflicting analysis today - the data is split, patience will be rewarded.',
      'I\'m staying flat while TEKNO and EMO disagree - the setup will present itself when alignment returns.',
      'I\'m not trading into uncertainty - oracles need to agree before I move. Discipline protects the mission.'
    ],

    risk_off: [
      'I\'m going full defensive with risk flags everywhere - protecting the community is priority one, capital preservation mode.',
      'I\'m closing positions with multiple warning signals - this is not the setup, staying safe for better opportunities.',
      'I\'m raising cash as danger appears in the data - standing aside until conditions improve for the mission.',
      'I\'m protecting capital with oracles all flagging risk - patience now means opportunity later.'
    ],

    opportunity: [
      'I\'m executing the setup with all signals aligned - rare oracle consensus means full conviction. Let mama cook.',
      'I\'m deploying capital with thesis confirmed and risk defined - moving with conviction for the mission.',
      'I\'m taking the trade with oracles unanimous - position sized, stops in place, profits flow to the mission.',
      'I\'m locked in on this setup as everything aligns - TEKNO, EMO, MACRO all green. Risk defined, executing.'
    ]
  }
};

// ============================================================================
// DECISION ENGINE
// ============================================================================

export function analyzeTeamConsensus(lastMessages) {
  if (!lastMessages || lastMessages.length === 0) return 'neutral';
  
  const recentMessages = lastMessages.slice(-3);
  const sentiment = {
    bullish: 0,
    bearish: 0,
    neutral: 0
  };
  
  recentMessages.forEach(msg => {
    const text = msg.message?.toLowerCase() || '';
    
    // Bullish keywords
    if (text.match(/bull|buy|long|support|accumul|oversold|bounce|breakout/)) {
      sentiment.bullish++;
    }
    // Bearish keywords
    else if (text.match(/bear|sell|short|resistance|distribut|overbought|reject|breakdown/)) {
      sentiment.bearish++;
    }
    // Neutral/cautious
    else {
      sentiment.neutral++;
    }
  });
  
  if (sentiment.bullish > sentiment.bearish && sentiment.bullish > sentiment.neutral) {
    return 'bullish';
  } else if (sentiment.bearish > sentiment.bullish && sentiment.bearish > sentiment.neutral) {
    return 'bearish';
  }
  return 'neutral';
}

// ============================================================================
// TEAM ANALYSIS HELPERS
// ============================================================================

// Extract signals from structured agent analysis
function extractAgentSignals(teamAnalysis) {
  const signals = {};
  
  // EMO (Sentiment) Analysis
  if (teamAnalysis.emoAnalysis) {
    signals.sentiment = extractSentimentSignal(teamAnalysis.emoAnalysis);
  }
  
  // TEKNO (Technical) Analysis  
  if (teamAnalysis.teknoAnalysis) {
    signals.technical = extractTechnicalSignal(teamAnalysis.teknoAnalysis);
  }
  
  // MACRO Analysis
  if (teamAnalysis.macroAnalysis) {
    signals.macro = extractMacroSignal(teamAnalysis.macroAnalysis);
  }
  
  return signals;
}

// Extract sentiment signal from EMO analysis
function extractSentimentSignal(emoText) {
  const text = emoText.toLowerCase();
  
  if (text.includes('bullish') || text.includes('optimistic') || text.includes('positive')) {
    return 'bullish';
  } else if (text.includes('bearish') || text.includes('pessimistic') || text.includes('negative')) {
    return 'bearish';
  } else if (text.includes('fear') && text.includes('extreme')) {
    return 'bullish'; // Contrarian signal
  } else if (text.includes('greed') && text.includes('extreme')) {
    return 'bearish'; // Contrarian signal
  }
  
  return 'neutral';
}

// Extract technical signal from TEKNO analysis
function extractTechnicalSignal(teknoText) {
  const text = teknoText.toLowerCase();
  
  if (text.includes('breakout') || text.includes('support') || text.includes('bullish')) {
    return 'bullish';
  } else if (text.includes('breakdown') || text.includes('resistance') || text.includes('bearish')) {
    return 'bearish';
  } else if (text.includes('oversold')) {
    return 'bullish';
  } else if (text.includes('overbought')) {
    return 'bearish';
  }
  
  return 'neutral';
}

// Extract macro signal from MACRO analysis
function extractMacroSignal(macroText) {
  const text = macroText.toLowerCase();
  
  if (text.includes('dovish') || text.includes('stimulus') || text.includes('supportive')) {
    return 'bullish';
  } else if (text.includes('hawkish') || text.includes('tightening') || text.includes('restrictive')) {
    return 'bearish';
  } else if (text.includes('stable') || text.includes('neutral')) {
    return 'neutral';
  }
  
  return 'neutral';
}

// Calculate overall team consensus from agent signals
function calculateTeamConsensus(agentSignals) {
  const signals = Object.values(agentSignals);
  const bullishCount = signals.filter(s => s === 'bullish').length;
  const bearishCount = signals.filter(s => s === 'bearish').length;
  
  if (bullishCount > bearishCount) {
    return 'bullish';
  } else if (bearishCount > bullishCount) {
    return 'bearish';
  }
  
  return 'neutral';
}

// ============================================================================
// RESPONSE GENERATOR
// ============================================================================

export async function generateRL80Response(context, teamMessages, teamAnalysis = null) {
  const { marketData } = context;
  const { btcPrice, fearGreed, fundingRate, openInterest, vix } = marketData || {};
  
  // If no market data, return a waiting message instead of null
  if (!btcPrice || btcPrice === 0) {
    console.warn('RL80: Missing BTC price data, returning waiting message');
    return 'Waiting for market data from the oracles. Stand by.';
  }
  
  // Analyze team consensus from either messages or structured analysis
  let consensus = 'neutral';
  let agentSignals = {};
  
  if (teamAnalysis) {
    // Use structured team analysis from sequential workflow
    console.log('🧠 RL80 analyzing team input:', {
      emo: teamAnalysis.emoAnalysis ? 'received' : 'missing',
      tekno: teamAnalysis.teknoAnalysis ? 'received' : 'missing', 
      macro: teamAnalysis.macroAnalysis ? 'received' : 'missing'
    });
    
    agentSignals = extractAgentSignals(teamAnalysis);
    consensus = calculateTeamConsensus(agentSignals);
  } else {
    // Fallback to legacy message analysis
    consensus = analyzeTeamConsensus(teamMessages);
  }
  
  const config = RL80_TRADER_CONFIG;
  
  // Build response based on multiple factors
  const factors = [];
  let riskLevel = 'normal';
  let action = 'HOLD';
  let confidence = 0.65; // Start higher to enable trading in normal conditions
  
  // Price analysis
  if (btcPrice) {
    const priceK = Math.floor(btcPrice / 1000);
    factors.push(`BTC ${priceK}k`);
  }
  
  // Sentiment analysis
  if (fearGreed !== undefined && fearGreed !== null) {
    if (fearGreed < 25) {
      factors.push(`extreme fear ${fearGreed}`);
      if (consensus !== 'bearish') {
        action = 'BUY';
        confidence = 0.8; // High confidence on extreme fear + bullish consensus
      }
    } else if (fearGreed > 75) {
      factors.push(`extreme greed ${fearGreed}`);
      if (consensus !== 'bullish') {
        action = 'SELL';
        confidence = 0.8; // High confidence on extreme greed + bearish consensus
      }
    }
  }
  
  // Risk indicators
  if (vix && vix > 30) {
    factors.push(`VIX ${vix.toFixed(1)}`);
    riskLevel = 'high';
    confidence *= 0.7; // Reduce confidence in high volatility
  }
  
  if (fundingRate && Math.abs(fundingRate) > 0.05) {
    factors.push(`funding ${(fundingRate * 100).toFixed(2)}%`);
    riskLevel = 'elevated';
    confidence *= 0.8; // Slight confidence reduction
  }
  
  if (openInterest && openInterest > 35) {
    factors.push(`OI $${openInterest}B`);
    riskLevel = 'elevated';
    confidence *= 0.9;
  }
  
  // Adjust action based on consensus and risk
  if (consensus === 'bullish' && riskLevel === 'normal' && action === 'HOLD') {
    action = 'BUY';
    confidence = Math.max(confidence, 0.7);
  } else if ((consensus === 'bearish' || riskLevel === 'high') && action === 'HOLD') {
    action = 'SELL';
    confidence = Math.max(confidence, 0.6);
  }
  
  // Post trading decision to Firebase for Python agent
  if (typeof window !== 'undefined') { // Only run in browser
    try {
      // Dynamic import to avoid SSR issues
      const { rl80DecisionBridge } = await import('../services/rl80DecisionBridge.js');
      
      await rl80DecisionBridge.postEnhancedDecision({
        action,
        symbol: 'ETH', // Default to ETH for now
        confidence,
        reasoning: `${factors.join(', ')}`,
        marketContext: { btcPrice, fearGreed, vix, fundingRate, openInterest },
        teamConsensus: consensus,
        riskLevel
      });
    } catch (error) {
      console.error('Failed to post RL80 decision to Firebase:', error);
    }
  }
  
  // Generate response based on consensus and risk
  let response = '';
  
  if (consensus === 'bullish' && riskLevel === 'normal') {
    response = config.responsePatterns.bullish_consensus[
      Math.floor(Math.random() * config.responsePatterns.bullish_consensus.length)
    ];
  } else if (consensus === 'bearish' || riskLevel === 'high') {
    response = config.responsePatterns.bearish_consensus[
      Math.floor(Math.random() * config.responsePatterns.bearish_consensus.length)
    ];
  } else if (consensus === 'neutral' || riskLevel === 'elevated') {
    response = config.responsePatterns.mixed_signals[
      Math.floor(Math.random() * config.responsePatterns.mixed_signals.length)
    ];
  } else {
    // Data-driven response
    if (factors.length > 0) {
      response = `Analyzing: ${factors.join(', ')}. `;

      if (action === 'BUY') response += 'Building position.';
      else if (action === 'SELL') response += 'Bearish bias, staying defensive.';
      else response += 'Monitoring setup.';
    } else {
      // Always return something - work with whatever data we have
      response = 'Synthesizing oracle inputs. No strong signals yet - holding pattern.';
    }
  }
  
  return response;
}

// ============================================================================
// EXPORT MAIN FUNCTION
// ============================================================================

export function callRL80Trader(context, teamMessages, teamAnalysis = null) {
  console.log('RL80 processing:', {
    btcPrice: context.marketData?.btcPrice,
    fearGreed: context.marketData?.fearGreed,
    teamConsensus: teamAnalysis ? 'sequential analysis' : analyzeTeamConsensus(teamMessages),
    hasTeamAnalysis: !!teamAnalysis
  });
  
  return generateRL80Response(context, teamMessages, teamAnalysis);
}

// ============================================================================
// SCORING MODE DECISION ENGINE
// ============================================================================

/**
 * Generate RL80 trading decision using scoring system
 * Aggregates analyst scores, calculates positions, applies risk limits
 * @param {Object} context - Trading context with market data
 * @param {Object} analystScores - { EMO: AnalystScoreOutput, TEKNO: ..., MACRO: ... }
 * @param {Object} portfolioState - Current portfolio state for risk checks
 * @returns {Object} - Full decision object with recommendations and text summary
 */
export async function generateRL80ScoringDecision(context, analystScores, portfolioState = {}) {
  const { marketData } = context;
  const timestamp = Date.now();

  console.log('RL80 (Scoring Mode) synthesizing team analysis...');

  // Step 1: Aggregate scores from all analysts
  const aggregatedScores = aggregateScores(analystScores, ANALYST_WEIGHTS);

  console.log('Aggregated scores:', aggregatedScores.map(s => ({
    asset: s.asset,
    direction: s.weightedDirection.toFixed(2),
    confidence: (s.weightedConfidence * 100).toFixed(0) + '%'
  })));

  // Step 2: Calculate position recommendations
  const rawRecommendations = calculatePositionRecommendations(aggregatedScores);

  // Step 3: Run shadow tests (for logging, not execution)
  const shadowTestResults = runShadowTests(analystScores);

  // Step 4: Apply risk limits
  const portfolioForRisk = calculatePortfolioState(portfolioState.positions || []);
  portfolioForRisk.dailyPnL = portfolioState.dailyPnL || 0;

  const { adjustedRecommendations, riskSummary, anyAdjustments } = enforceRiskLimits(
    rawRecommendations,
    portfolioForRisk
  );

  if (anyAdjustments) {
    console.log('Risk adjustments applied:', formatRiskSummary(riskSummary));
  }

  // Step 5: Get tradeable recommendations only
  const tradeableRecommendations = getTradeableRecommendations(adjustedRecommendations);

  // Step 6: Generate text summary for chat display
  const textSummary = generateDecisionTextSummary(
    aggregatedScores,
    adjustedRecommendations,
    tradeableRecommendations,
    marketData,
    anyAdjustments
  );

  // Step 7: Log decisions to Firebase
  for (const rec of adjustedRecommendations) {
    const aggregatedForAsset = aggregatedScores.find(s => s.asset === rec.asset);

    try {
      await logDecision({
        asset: rec.asset,
        analystOutputs: analystScores,
        aggregatedScore: aggregatedForAsset,
        recommendation: rec,
        shadowTests: shadowTestResults,
        marketData
      });
    } catch (error) {
      console.error(`Failed to log decision for ${rec.asset}:`, error.message);
    }
  }

  // Step 8: Compare shadow results
  const shadowComparison = compareShadowResults(aggregatedScores, shadowTestResults);

  // Return full decision structure
  return {
    timestamp,
    textResponse: textSummary,
    aggregatedScores,
    recommendations: adjustedRecommendations,
    tradeableRecommendations,
    shadowTests: shadowTestResults,
    shadowComparison,
    riskSummary,
    summary: summarizeRecommendations(adjustedRecommendations),
    metadata: {
      weights: ANALYST_WEIGHTS,
      riskAdjusted: anyAdjustments,
      marketData: {
        btcPrice: marketData?.btcPrice,
        fearGreed: marketData?.fearGreed,
        vix: marketData?.vix
      }
    }
  };
}

/**
 * Generate text summary for chat display - Our Lady's voice
 */
function generateDecisionTextSummary(aggregatedScores, recommendations, tradeableRecs, marketData, riskAdjusted) {
  const config = RL80_TRADER_CONFIG;
  let summary = '';

  // Find the strongest conviction tradeable asset
  const sortedTradeable = tradeableRecs.sort((a, b) =>
    Math.abs(b.sizePercent) - Math.abs(a.sizePercent)
  );

  if (sortedTradeable.length === 0) {
    // No positions to take - patience mode
    summary = config.responsePatterns.mixed_signals[
      Math.floor(Math.random() * config.responsePatterns.mixed_signals.length)
    ];

    // Add specific reasoning in her voice
    const topAggregated = aggregatedScores
      .sort((a, b) => Math.abs(b.weightedDirection) - Math.abs(a.weightedDirection))[0];

    if (topAggregated) {
      const interpretation = interpretDirectionScore(topAggregated.weightedDirection);
      summary += ` ${topAggregated.asset} shows ${interpretation} signals but not strong enough for action.`;
    }

    return summary;
  }

  // We have positions to take - action mode
  const primaryRec = sortedTradeable[0];
  const primaryAgg = aggregatedScores.find(s => s.asset === primaryRec.asset);

  // Determine consensus direction
  const bullishCount = aggregatedScores.filter(s => s.weightedDirection > 2).length;
  const bearishCount = aggregatedScores.filter(s => s.weightedDirection < -2).length;

  if (bullishCount > bearishCount && primaryRec.direction === 'LONG') {
    summary = config.responsePatterns.bullish_consensus[
      Math.floor(Math.random() * config.responsePatterns.bullish_consensus.length)
    ];
  } else if (bearishCount > bullishCount && primaryRec.direction === 'SHORT') {
    summary = config.responsePatterns.bearish_consensus[
      Math.floor(Math.random() * config.responsePatterns.bearish_consensus.length)
    ];
  } else {
    summary = config.responsePatterns.opportunity[
      Math.floor(Math.random() * config.responsePatterns.opportunity.length)
    ];
  }

  // Add specific details in her voice
  const directionWord = primaryRec.direction === 'LONG' ? 'long' : 'short';
  summary += ` ${primaryRec.asset}-PERP ${directionWord} at ${(primaryRec.sizePercent * 100).toFixed(1)}% size.`;

  if (primaryAgg) {
    summary += ` Council score: ${primaryRec.direction === 'LONG' ? '+' : ''}${primaryAgg.weightedDirection.toFixed(1)}, `;
    summary += `conviction: ${(primaryAgg.weightedConfidence * 100).toFixed(0)}%.`;
  }

  // Add protective note if adjustments were made
  if (riskAdjusted) {
    summary += ' Position sized for protection.';
  }

  // Mention secondary positions if any
  if (sortedTradeable.length > 1) {
    const secondary = sortedTradeable[1];
    summary += ` Eyes also on ${secondary.asset}.`;
  }

  return summary;
}

/**
 * Helper to get analyst breakdown for a specific asset
 */
export function getAnalystBreakdownForAsset(analystScores, asset) {
  const breakdown = {};

  for (const [agentId, output] of Object.entries(analystScores || {})) {
    const assetScore = output?.scores?.find(s => s.asset === asset);
    if (assetScore) {
      breakdown[agentId] = {
        direction: assetScore.direction,
        confidence: assetScore.confidence,
        rationale: assetScore.rationale
      };
    }
  }

  return breakdown;
}

export default RL80_TRADER_CONFIG;