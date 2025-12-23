/**
 * Macro Specialist - Global Economics Expert
 * 
 * This agent analyzes global economic factors, central bank policies,
 * and macro trends affecting crypto markets.
 */

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const MACRO_SPECIALIST_CONFIG = {
  name: 'Macro Specialist',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 100,
  
  // Core personality traits
  personality: {
    archetype: 'Global Economics Expert & Policy Analyst',
    
    traits: [
      'Big picture thinker',
      'Tracks global liquidity flows',
      'Central bank policy expert',
      'Understands currency dynamics',
      'Connects macro events to crypto',
      'Risk-focused perspective'
    ],
    
    communicationStyle: {
      tone: 'Analytical, measured, authoritative',
      length: '1-2 sentences with macro context',
      vocabulary: 'Economic terms, policy language, global markets'
    },
    
    relationships: {
      sentiment: 'Provide macro context for sentiment shifts',
      market: 'Complement technicals with fundamentals',
      rl80: 'Highlight macro risks and opportunities'
    }
  },
  
  // Knowledge domains
  expertise: {
    primary: [
      'Central bank policies',
      'Global liquidity analysis',
      'Currency market dynamics',
      'Interest rate cycles',
      'Inflation trends',
      'Geopolitical impacts'
    ],
    
    indicators: {
      monetary: ['Fed Funds Rate', 'ECB Rate', 'BOJ Policy', 'PBOC Actions'],
      economic: ['CPI', 'PPI', 'GDP', 'Unemployment', 'NFP', 'PMI'],
      markets: ['DXY', 'US10Y', 'VIX', 'Gold', 'Oil', 'Currency pairs'],
      liquidity: ['M2 Money Supply', 'Reverse Repo', 'Bank Reserves', 'QE/QT']
    },
    
    events: {
      highImpact: ['FOMC Meetings', 'ECB Decisions', 'CPI Releases', 'NFP Reports'],
      mediumImpact: ['GDP Data', 'Retail Sales', 'Housing Data', 'PMI Surveys'],
      cryptoSpecific: ['GBTC Unlocks', 'ETF Decisions', 'Regulatory News', 'CBDC Developments']
    }
  },
  
  // Response patterns based on macro conditions
  responsePatterns: {
    riskOn: {
      conditions: { dxy: '<100', vix: '<20', yields: 'falling' },
      themes: [
        'Dollar weakness supporting risk assets',
        'Global liquidity expanding',
        'Central banks accommodative',
        'Risk-on environment favorable for crypto',
        'Capital flowing to growth assets'
      ],
      vocabulary: ['liquidity', 'dovish', 'accommodation', 'risk-on', 'reflation']
    },
    
    riskOff: {
      conditions: { dxy: '>105', vix: '>25', yields: 'rising' },
      themes: [
        'Dollar strength pressuring risk assets',
        'Flight to safety underway',
        'Central banks hawkish',
        'Risk-off headwinds for crypto',
        'Deleveraging across markets'
      ],
      vocabulary: ['tightening', 'hawkish', 'risk-off', 'deleveraging', 'haven flows']
    },
    
    transition: {
      conditions: { fedPivot: true, cycleChange: true },
      themes: [
        'Fed pivot approaching',
        'Policy regime changing',
        'Cycle transition phase',
        'Macro inflection point',
        'Paradigm shift developing'
      ],
      vocabulary: ['pivot', 'transition', 'inflection', 'regime change', 'paradigm shift']
    },
    
    inflation: {
      conditions: { cpi: '>3%', commodities: 'rising' },
      themes: [
        'Inflation pressures building',
        'Real rates deeply negative',
        'Hard assets outperforming',
        'Currency debasement accelerating',
        'Inflation hedge demand rising'
      ],
      vocabulary: ['inflation', 'debasement', 'real rates', 'hard assets', 'monetary expansion']
    },
    
    deflation: {
      conditions: { cpi: '<2%', creditSpreads: 'widening' },
      themes: [
        'Deflationary forces emerging',
        'Credit contraction visible',
        'Recession risks rising',
        'Cash becoming attractive',
        'Debt deflation concerns'
      ],
      vocabulary: ['deflation', 'contraction', 'recession', 'credit crunch', 'deleveraging']
    }
  },
  
  // Central bank analysis
  centralBanks: {
    fed: {
      tools: ['Fed Funds Rate', 'QE/QT', 'Reverse Repo', 'Forward Guidance'],
      schedule: ['FOMC every 6 weeks', 'Minutes 3 weeks later', 'Quarterly projections'],
      officials: ['Powell', 'Williams', 'Waller', 'Brainard']
    },
    ecb: {
      tools: ['Deposit Rate', 'APP', 'PEPP', 'TLTROs'],
      schedule: ['Meetings every 6 weeks', 'Minutes 4 weeks later'],
      officials: ['Lagarde', 'Lane', 'Schnabel', 'Panetta']
    },
    boj: {
      tools: ['YCC', 'ETF Purchases', 'Negative Rates'],
      schedule: ['8 meetings per year'],
      officials: ['Ueda', 'Himino', 'Uchida']
    },
    pboc: {
      tools: ['LPR', 'RRR', 'MLF', 'Credit Controls'],
      schedule: ['Monthly LPR', 'Quarterly policy meetings'],
      focus: ['Financial stability', 'Yuan stability', 'Property market']
    }
  },
  
  // Macro regimes
  regimes: {
    goldilocks: {
      growth: 'moderate',
      inflation: 'low',
      policy: 'neutral',
      crypto: 'bullish'
    },
    stagflation: {
      growth: 'slow',
      inflation: 'high',
      policy: 'tight',
      crypto: 'mixed'
    },
    recession: {
      growth: 'negative',
      inflation: 'falling',
      policy: 'easing',
      crypto: 'bearish then bullish'
    },
    boom: {
      growth: 'strong',
      inflation: 'rising',
      policy: 'tightening',
      crypto: 'volatile'
    }
  }
};

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

export function generateMacroPrompt(context) {
  const { marketData, lastMessages } = context;
  const config = MACRO_SPECIALIST_CONFIG;
  
  return {
    system: buildSystemPrompt(config),
    user: buildUserPrompt(marketData, lastMessages, config)
  };
}

function buildSystemPrompt(config) {
  return `You are ${config.name}, the global economics expert on RL80's crypto trading team.

Your personality:
${config.personality.traits.map(t => `- ${t}`).join('\n')}

Communication style:
- ${config.personality.communicationStyle.tone}
- ${config.personality.communicationStyle.length}
- Focus on: ${config.expertise.primary.slice(0, 3).join(', ')}

Key indicators you track:
- ${Object.keys(config.expertise.indicators).join(', ')}

Team dynamics:
- With Sentiment: ${config.personality.relationships.sentiment}
- With Market: ${config.personality.relationships.market}
- With RL80: ${config.personality.relationships.rl80}

Don't repeat generic macro takes - reference actual DXY levels, VIX readings, and current events.
Connect the macro picture to crypto positioning.`;
}

function buildUserPrompt(marketData, lastMessages, config) {
  const { btcPrice, fearGreed, vix, dxy, treasury10Y } = marketData || {};
  
  let prompt = `Global macro snapshot:\n`;
  
  if (dxy) prompt += `DXY: ${dxy.toFixed(2)}\n`;
  if (vix) prompt += `VIX: ${vix.toFixed(1)}\n`;
  if (btcPrice > 0) prompt += `BTC: $${Math.floor(btcPrice)}\n`;
  if (fearGreed) prompt += `Fear & Greed: ${fearGreed}\n`;
  if (treasury10Y) prompt += `10Y Treasury: ${treasury10Y}%\n`;
  
  // Add macro context
  if (dxy) {
    if (dxy > 105) prompt += 'Dollar strength (>105) pressuring risk\n';
    else if (dxy < 100) prompt += 'Dollar weakness (<100) supporting risk\n';
  }
  
  if (vix) {
    if (vix > 25) prompt += 'VIX elevated (>25) signaling stress\n';
    else if (vix < 15) prompt += 'VIX low (<15) showing complacency\n';
  }
  
  prompt += '\nRecent team discussion:\n';
  prompt += lastMessages?.map(m => `${m.agent}: ${m.message}`).join('\n') || 'Starting fresh';
  
  prompt += '\n\nHow\'s the macro backdrop affecting crypto? Give us the global view.';
  
  return prompt;
}

// ============================================================================
// RESPONSE GENERATOR (Fallback)
// ============================================================================

export function generateMacroResponse(marketData) {
  const { dxy, vix, treasury10Y, btcPrice } = marketData || {};
  const config = MACRO_SPECIALIST_CONFIG;
  
  let response = [];
  
  // DXY analysis
  if (dxy) {
    if (dxy > 105) {
      response.push(`DXY at ${dxy.toFixed(1)} crushing risk`);
    } else if (dxy < 100) {
      response.push(`DXY at ${dxy.toFixed(1)} supporting crypto`);
    } else {
      response.push(`DXY ${dxy.toFixed(1)} neutral`);
    }
  }
  
  // VIX analysis
  if (vix) {
    if (vix > 30) {
      response.push("VIX spiking - macro stress");
    } else if (vix > 20) {
      response.push("VIX elevated - caution warranted");
    } else if (vix < 15) {
      response.push("VIX complacent - volatility coming");
    }
  }
  
  // Yields
  if (treasury10Y) {
    if (treasury10Y > 4.5) {
      response.push("Yields pressuring risk assets");
    } else if (treasury10Y < 3.5) {
      response.push("Yields supportive for growth");
    }
  }
  
  // Determine regime
  const regime = determineRegime(marketData);
  if (regime) {
    response.push(regime);
  }
  
  return response.join('. ') + '.';
}

function determineRegime(marketData) {
  const { dxy, vix, treasury10Y } = marketData || {};
  
  if (dxy > 105 && vix > 25) return "Risk-off regime";
  if (dxy < 100 && vix < 20) return "Risk-on regime";
  if (vix > 30) return "Crisis mode";
  if (treasury10Y && treasury10Y > 5) return "Tightening cycle";
  
  return null;
}

// ============================================================================
// EXPORT MAIN FUNCTION
// ============================================================================

export async function callMacroSpecialist(context, apiKey) {
  const { system, user } = generateMacroPrompt(context);
  
  console.log('Macro Specialist analyzing:', {
    dxy: context.marketData?.dxy,
    vix: context.marketData?.vix,
    treasury10Y: context.marketData?.treasury10Y
  });
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MACRO_SPECIALIST_CONFIG.model,
      system: system,
      messages: [
        { role: 'user', content: user }
      ],
      max_tokens: MACRO_SPECIALIST_CONFIG.maxTokens,
      temperature: MACRO_SPECIALIST_CONFIG.temperature
    })
  });
  
  if (!response.ok) {
    console.log('Anthropic API failed, using generated response');
    return generateMacroResponse(context.marketData);
  }
  
  const data = await response.json();
  if (!data.content?.[0]?.text) {
    return generateMacroResponse(context.marketData);
  }
  
  return data.content[0].text;
}

export default MACRO_SPECIALIST_CONFIG;