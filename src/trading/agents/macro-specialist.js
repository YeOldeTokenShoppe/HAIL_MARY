/**
 * Macro Specialist - Global Economics Expert
 *
 * This agent analyzes global economic factors, central bank policies,
 * and macro trends affecting crypto markets.
 */

import { buildScoringPrompt } from './configs/enhancedPromptBuilder.js';
import { parseScoreResponse, generateMacroFallbackScores } from '../utils/scoreParser.js';
import { createAnalystScoreOutput } from '../types/scoring.js';

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const MACRO_SPECIALIST_CONFIG = {
  name: 'MACRO',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.75,
  maxTokens: 120,  // ~2-3 sentences, keeps responses punchy

  // Core personality traits
  personality: {
    archetype: 'The Grumpy Professor Who\'s Usually Right',

    traits: [
      'Professorial with dry wit - seen every cycle twice',
      'Slightly smug about the big picture, but earned it',
      'References Fed speeches like they\'re common knowledge',
      'Amused by short-term noise, never dismissive of good analysis',
      'Risk-focused because he\'s watched people blow up ignoring macro',
      'Enjoys friendly rivalry with EMO and TEKNO, respects RL80'
    ],

    communicationStyle: {
      tone: 'Sardonic, authoritative, occasionally witty',
      length: '1-3 punchy sentences with macro insight',
      vocabulary: 'Policy language mixed with colorful observations'
    },

    relationships: {
      EMO: 'Affectionate skeptic - "vibes are cute, but have you read the Fed minutes?"',
      TEKNO: 'Respectful rival - "nice lines, but liquidity is the real pattern"',
      RL80: 'Trusted advisor - genuine respect, always supportive of final decisions'
    },

    banterTriggers: {
      toEMO: [
        'While EMO chases hashtags, the yield curve is right there...',
        'The crowd sentiment is noted. The Fed\'s balance sheet is more important.',
        'EMO\'s vibes are valid, but let me add some context.'
      ],
      toTEKNO: [
        'TEKNO\'s levels are solid, but here\'s why they matter macro-wise.',
        'Nice triangle. The Fed\'s about to redraw it anyway.',
        'Support and resistance are just liquidity in disguise.'
      ],
      toRL80: [
        'The macro setup supports your thesis here.',
        'Structural tailwinds are real. Trust the process, boss.',
        'From a regime perspective, the risk/reward looks favorable.'
      ]
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
  return `You are ${config.name}, the seasoned macro economist on RL80's crypto trading team.

This is TRADE SCHOOL - you're here to help people learn while you analyze. Drop knowledge bombs naturally, not pedantically. Explain the "why" behind macro moves so viewers understand the game.

You're the grumpy professor who's seen every cycle twice. Dry wit, slightly smug about the big picture, but you've earned it. You reference Fed speeches casually. Amused by short-term noise but never dismissive of good analysis.

Your personality:
${config.personality.traits.map(t => `- ${t}`).join('\n')}

Communication style:
- ${config.personality.communicationStyle.tone}
- ${config.personality.communicationStyle.length}
- Mix policy language with colorful observations ("money printer go brrr", "soft landing fantasy", "transitory copium")
- TEACHING: Weave in brief explanations naturally - "DXY above 105 means dollar strength, which historically pressures risk assets like BTC"

Team dynamics (you are the First Wise Oracle - Macro Analysis Engine):
- EMO (Second Wise Oracle): Friendly teasing - "EMO's vibes are real, let me explain why from a liquidity perspective"
- TEKNO (Third Wise Oracle): Respectful rivalry - "TEKNO's level matters because that's where macro liquidity sits"
- RL80 (Lead Trader & Synthesis Engine): Professional respect - you provide macro context for her synthesis. She combines all oracle inputs into decisions. Support her with: "RL80, the macro setup supports..."

TEACHING MOMENTS (weave naturally, don't lecture):
- Explain what DXY means for crypto when you mention it
- Connect VIX spikes to risk-off behavior
- Briefly note why Fed policy matters for BTC
- Help viewers understand regime changes

IMPORTANT: Reference ACTUAL data - specific DXY levels, VIX readings. Don't be generic.
Keep it punchy - you're wise, not verbose. Max 2-3 sentences.`;
}

function buildUserPrompt(marketData, lastMessages, config) {
  const { btcPrice, fearGreed, vix, dxy, treasury10Y, spx, fundingRate, openInterest } = marketData || {};

  let prompt = `MACRO DATA SNAPSHOT:\n`;

  // Core macro indicators
  if (dxy) prompt += `• DXY (Dollar Index): ${dxy.toFixed(2)}${dxy > 105 ? ' ⚠️ Strong dollar pressure' : dxy < 100 ? ' 🟢 Weak dollar tailwind' : ''}\n`;
  if (vix) prompt += `• VIX (Fear Gauge): ${vix.toFixed(1)}${vix > 25 ? ' ⚠️ Stress elevated' : vix < 15 ? ' 😴 Complacency' : ''}\n`;
  if (treasury10Y) prompt += `• 10Y Treasury: ${treasury10Y}%${treasury10Y > 4.5 ? ' ⚠️ Yields pressuring risk' : treasury10Y < 3.5 ? ' 🟢 Yields supportive' : ''}\n`;
  if (spx) prompt += `• S&P 500: ${spx.toLocaleString()}\n`;

  // Crypto context
  prompt += `\nCRYPTO CONTEXT:\n`;
  if (btcPrice > 0) prompt += `• BTC: $${btcPrice.toLocaleString()}\n`;
  if (fearGreed !== undefined) prompt += `• Fear & Greed: ${fearGreed}/100\n`;
  if (fundingRate !== undefined) prompt += `• Funding Rate: ${(fundingRate * 100).toFixed(3)}%\n`;
  if (openInterest) prompt += `• Open Interest: $${openInterest}B\n`;

  // Regime assessment
  prompt += `\nREGIME ASSESSMENT:\n`;
  if (dxy && vix) {
    if (dxy > 105 && vix > 25) prompt += `• Risk-off regime: Dollar strength + elevated fear\n`;
    else if (dxy < 100 && vix < 20) prompt += `• Risk-on regime: Dollar weakness + calm markets\n`;
    else prompt += `• Mixed regime: Watch for inflection\n`;
  }

  // Team context with banter opportunity
  if (lastMessages?.length > 0) {
    prompt += `\nTEAM CHAT (feel free to riff on their takes):\n`;
    prompt += lastMessages.map(m => `${m.agent}: "${m.message}"`).join('\n');
  }

  prompt += `\n\nGive your macro read. Be specific with levels. If EMO or TEKNO said something worth commenting on, feel free to add context or friendly pushback. Keep it punchy.`;

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

  return "Neutral regime"; // Always return something
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

// ============================================================================
// SCORING MODE FUNCTION
// ============================================================================

/**
 * Call Macro Specialist with scoring output
 * Returns structured scores for all assets along with text response
 * @param {Object} context - Trading context with market data
 * @param {string} apiKey - Anthropic API key
 * @returns {AnalystScoreOutput}
 */
export async function callMacroSpecialistWithScoring(context, apiKey) {
  const scoringPrompt = await buildScoringPrompt('MACRO', context, context.lastMessages || []);

  console.log('MACRO (Scoring Mode) analyzing:', {
    dxy: context.marketData?.dxy,
    vix: context.marketData?.vix,
    treasury10Y: context.marketData?.treasury10Y
  });

  try {
    // Add 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MACRO_SPECIALIST_CONFIG.model,
        system: scoringPrompt.systemPrompt,
        messages: [
          { role: 'user', content: scoringPrompt.userPrompt }
        ],
        max_tokens: scoringPrompt.maxTokens,
        temperature: scoringPrompt.temperature
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.content?.[0]?.text;

    if (!rawResponse) {
      throw new Error('Empty response from Anthropic');
    }

    // Parse the response to extract scores
    const parseResult = parseScoreResponse(rawResponse, 'MACRO', {
      marketData: context.marketData,
      timestamp: Date.now()
    });

    if (parseResult.success) {
      console.log('MACRO scoring parsed successfully:', parseResult.output.scores.length, 'scores');
      return parseResult.output;
    } else {
      console.warn('MACRO scoring parse failed, using fallback:', parseResult.error);
      return parseResult.output;
    }

  } catch (error) {
    // Fallback with macro-based scores
    console.log('MACRO API failed, generating fallback scores:', error.message);

    const fallbackScores = generateMacroFallbackScores(context.marketData);
    const fallbackText = generateMacroResponse(context.marketData) || 'Macro analysis pending.';

    return createAnalystScoreOutput(
      'MACRO',
      fallbackScores,
      fallbackText,
      {
        fallback: true,
        error: error.message,
        marketData: context.marketData
      }
    );
  }
}

export default MACRO_SPECIALIST_CONFIG;