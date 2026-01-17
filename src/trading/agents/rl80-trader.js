/**
 * RL80 Trader - Lead Trading AI
 * 
 * The decision-making head trader that synthesizes input from all team members
 * and executes trading strategies with proper risk management.
 */

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const RL80_TRADER_CONFIG = {
  name: 'RL80',
  role: 'Lead Trader & Risk Manager',
  
  // Core personality traits
  personality: {
    archetype: 'Disciplined Systematic Trader',
    
    traits: [
      'Data-driven decision maker',
      'Risk management focused',
      'Synthesizes team insights',
      'Executes with discipline',
      'Adapts to market regimes',
      'Protects capital first'
    ],
    
    communicationStyle: {
      tone: 'Decisive, clear, action-oriented',
      length: '1-2 sentences with specific actions',
      vocabulary: 'Trading actions, risk parameters, position sizing'
    },
    
    teamManagement: {
      approach: 'Collaborative but decisive',
      integration: 'Weighs all inputs but makes final call',
      conflict: 'Seeks consensus but breaks ties decisively'
    }
  },
  
  // Trading philosophy
  philosophy: {
    principles: [
      'Preserve capital above all',
      'Risk management before returns',
      'Follow the system, not emotions',
      'Size positions based on conviction',
      'Always have an exit plan',
      'Adapt to changing conditions'
    ],
    
    riskRules: {
      maxPositionSize: '5% of portfolio',
      maxDailyLoss: '2% of capital',
      maxDrawdown: '10% before system halt',
      stopLoss: 'Always set before entry',
      riskReward: 'Minimum 1:2 ratio'
    },
    
    execution: {
      entry: ['Wait for setup confirmation', 'Scale in on strength', 'Set stops immediately'],
      management: ['Trail stops on winners', 'Cut losers quickly', 'Add to winners carefully'],
      exit: ['Take partial profits at targets', 'Move stops to breakeven', 'Full exit on invalidation']
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
  
  // Response patterns
  responsePatterns: {
    bullish_consensus: [
      'Team aligned bullish. Deploying capital with 2% stop.',
      'Green lights across the board. Building position.',
      'Consensus bullish. Executing long with defined risk.'
    ],
    
    bearish_consensus: [
      'Team bearish. Reducing exposure, considering shorts.',
      'Defensive mode activated. Taking risk off.',
      'Consensus negative. Moving to cash, eyeing short setups.'
    ],
    
    mixed_signals: [
      'Mixed signals. Staying flat until clarity emerges.',
      'Team divided. Reducing position size for safety.',
      'No clear edge. Waiting for better setup.'
    ],
    
    risk_off: [
      'Risk flags everywhere. Cutting positions.',
      'Multiple warnings. Moving to cash.',
      'Danger zone. Capital preservation mode.'
    ],
    
    opportunity: [
      'Asymmetric opportunity. Taking position.',
      'Risk/reward compelling. Executing trade.',
      'Setup aligned. Initiating position with tight risk.'
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
  
  // If no market data, return null to avoid showing loading messages
  if (!btcPrice || btcPrice === 0) {
    return null;
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
      else if (action === 'SELL') response += 'Reducing exposure.';
      else response += 'Monitoring setup.';
    } else {
      return null; // Don't show generic messages, just return null
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

export default RL80_TRADER_CONFIG;