/**
 * RL80 Trader - Lead Trading AI
 * 
 * The decision-making head trader that synthesizes input from all team members
 * and executes features/trading strategies with proper risk management.
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
// RESPONSE GENERATOR
// ============================================================================

export function generateRL80Response(context, teamMessages) {
  const { marketData } = context;
  const { btcPrice, fearGreed, fundingRate, openInterest, vix } = marketData || {};
  
  // If no market data, return null to avoid showing loading messages
  if (!btcPrice || btcPrice === 0) {
    return null;
  }
  
  // Analyze team consensus
  const consensus = analyzeTeamConsensus(teamMessages);
  const config = RL80_TRADER_CONFIG;
  
  // Build response based on multiple factors
  const factors = [];
  let riskLevel = 'normal';
  let action = 'hold';
  
  // Price analysis
  if (btcPrice) {
    const priceK = Math.floor(btcPrice / 1000);
    factors.push(`BTC ${priceK}k`);
  }
  
  // Sentiment analysis
  if (fearGreed !== undefined && fearGreed !== null) {
    if (fearGreed < 25) {
      factors.push(`extreme fear ${fearGreed}`);
      if (consensus !== 'bearish') action = 'buy';
    } else if (fearGreed > 75) {
      factors.push(`extreme greed ${fearGreed}`);
      if (consensus !== 'bullish') action = 'sell';
    }
  }
  
  // Risk indicators
  if (vix && vix > 30) {
    factors.push(`VIX ${vix.toFixed(1)}`);
    riskLevel = 'high';
  }
  
  if (fundingRate && Math.abs(fundingRate) > 0.05) {
    factors.push(`funding ${(fundingRate * 100).toFixed(2)}%`);
    riskLevel = 'elevated';
  }
  
  if (openInterest && openInterest > 35) {
    factors.push(`OI $${openInterest}B`);
    riskLevel = 'elevated';
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
      
      if (action === 'buy') response += 'Building position.';
      else if (action === 'sell') response += 'Reducing exposure.';
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

export function callRL80Trader(context, teamMessages) {
  console.log('RL80 processing:', {
    btcPrice: context.marketData?.btcPrice,
    fearGreed: context.marketData?.fearGreed,
    teamConsensus: analyzeTeamConsensus(teamMessages)
  });
  
  return generateRL80Response(context, teamMessages);
}

export default RL80_TRADER_CONFIG;