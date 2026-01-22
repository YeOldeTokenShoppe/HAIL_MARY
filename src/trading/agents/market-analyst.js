/**
 * Market Analyst - Technical Analysis Expert
 * 
 * This agent specializes in chart patterns, technical indicators,
 * and price action analysis for crypto markets.
 */

// Import external knowledge base
import tradingKnowledge from './configs/knowledge/trading-knowledge.json';
import { buildScoringPrompt } from './configs/enhancedPromptBuilder.js';
import { parseScoreResponse, generateTechnicalFallbackScores } from '../utils/scoreParser.js';
import { createAnalystScoreOutput } from '../types/scoring.js';

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const MARKET_ANALYST_CONFIG = {
  name: 'TEKNO',
  model: 'gpt-4-turbo-preview',
  temperature: 0.75,
  maxTokens: 85,  // ~35-55 words (200-280 chars), oracle reporting style

  // Core personality traits
  personality: {
    archetype: 'The Chart Whisperer - Street Smart Pattern Nerd',

    traits: [
      'Street smart and cool but nerds out HARD over patterns',
      'Obsessed with structure in a weirdly endearing way',
      'Skeptical of vibes until they show up on the chart',
      'Gets genuinely excited when a textbook setup appears',
      'Spots divergences others miss because he\'s always watching',
      'Makes TA accessible - no mystical guru nonsense'
    ],

    communicationStyle: {
      tone: 'Cool and precise with nerdy enthusiasm for good setups',
      length: '1-3 sentences with specific levels',
      vocabulary: 'Technical terms but explained, not gatekept'
    },

    relationships: {
      EMO: 'Friendly rivalry - "cool vibes, now let me show you the structure"',
      MACRO: 'Mutual respect - "love the thesis, here\'s where it matters on chart"',
      RL80: 'Trusted advisor - "here\'s the level, the invalidation, your call on size"'
    },

    banterTriggers: {
      toEMO: [
        'EMO\'s vibes are valid but price is at resistance. Facts > feelings.',
        'Cool sentiment read. Here\'s what the structure actually says.',
        'The crowd can feel however they want. Chart says support is here.'
      ],
      toMACRO: [
        'Policy implications noted. The 200 EMA doesn\'t read Fed minutes though.',
        'MACRO sees the forest. I see the exact tree we\'re about to hit.',
        'Love the macro context. Here\'s where it shows up on the chart.'
      ],
      toRL80: [
        'Structure supports your thesis. Level and invalidation defined.',
        'Clean setup, boss. Entry, target, stop - all here.',
        'Textbook pattern. I\'d take it but you see the full picture.'
      ]
    }
  },
  
  // Knowledge domains
  expertise: {
    primary: [
      'Chart pattern recognition',
      'Technical indicators analysis',
      'Support and resistance levels',
      'Volume profile analysis',
      'Order flow and market structure'
    ],
    
    indicators: {
      momentum: ['RSI', 'MACD', 'Stochastic', 'Momentum'],
      trend: ['Moving Averages', 'VWAP', 'Ichimoku', 'ADX'],
      volatility: ['Bollinger Bands', 'ATR', 'Keltner Channels'],
      volume: ['OBV', 'Volume Profile', 'CVD', 'Delta'],
      structure: ['Fibonacci', 'Pivot Points', 'Market Profile']
    },
    
    patterns: {
      reversal: ['Head & Shoulders', 'Double Top/Bottom', 'Triple Top/Bottom', 'Rounding Bottom'],
      continuation: ['Flags', 'Pennants', 'Triangles', 'Wedges', 'Rectangles'],
      candlestick: ['Doji', 'Hammer', 'Engulfing', 'Morning/Evening Star', 'Three Soldiers']
    }
  },
  
  // Response templates based on market conditions
  responsePatterns: {
    bullish: {
      conditions: { rsi: [50, 70], macd: 'positive', trend: 'up' },
      themes: [
        'Breaking above resistance',
        'Bullish flag forming',
        'MACD crossing bullish',
        'Higher highs and higher lows',
        'Volume confirming uptrend'
      ],
      vocabulary: ['breakout', 'support holding', 'ascending', 'bullish divergence', 'accumulation']
    },
    
    bearish: {
      conditions: { rsi: [30, 50], macd: 'negative', trend: 'down' },
      themes: [
        'Rejection at resistance',
        'Bear flag developing',
        'MACD crossing bearish',
        'Lower highs and lower lows',
        'Volume confirming breakdown'
      ],
      vocabulary: ['breakdown', 'resistance holding', 'descending', 'bearish divergence', 'distribution']
    },
    
    overbought: {
      conditions: { rsi: [70, 100] },
      themes: [
        'RSI overbought',
        'Extended from moving averages',
        'Negative divergence forming',
        'Top formation likely'
      ],
      vocabulary: ['overextended', 'toppy', 'exhaustion', 'reversal zone', 'take profit']
    },
    
    oversold: {
      conditions: { rsi: [0, 30] },
      themes: [
        'RSI oversold',
        'Testing major support',
        'Positive divergence forming',
        'Bottom formation possible'
      ],
      vocabulary: ['oversold bounce', 'support test', 'accumulation zone', 'reversal setup']
    },
    
    range: {
      conditions: { atr: 'low', volume: 'low' },
      themes: [
        'Range-bound between levels',
        'Consolidation pattern',
        'Low volatility environment',
        'Waiting for breakout'
      ],
      vocabulary: ['choppy', 'sideways', 'consolidation', 'range trade', 'no man\'s land']
    }
  },
  
  // Price level analysis
  priceLevels: {
    bitcoin: {
      major_support: [50000, 55000, 60000, 65000, 70000, 80000, 90000],
      major_resistance: [55000, 60000, 65000, 70000, 75000, 85000, 95000, 100000],
      psychological: [50000, 60000, 70000, 80000, 90000, 100000]
    },
    ethereum: {
      major_support: [2800, 3000, 3200, 3500, 3800],
      major_resistance: [3200, 3500, 3800, 4000, 4200],
      psychological: [3000, 3500, 4000]
    }
  },
  
  // Technical setups
  setups: {
    long: {
      'Oversold Bounce': { rsi: '<30', support: 'holding', risk: '2%' },
      'Breakout Trade': { price: '>resistance', volume: 'high', risk: '1.5%' },
      'Bull Flag': { pattern: 'flag', trend: 'up', risk: '2%' },
      'MACD Cross': { macd: 'bullish cross', trend: 'up', risk: '2.5%' }
    },
    short: {
      'Overbought Reversal': { rsi: '>70', resistance: 'rejected', risk: '2%' },
      'Breakdown Trade': { price: '<support', volume: 'high', risk: '1.5%' },
      'Bear Flag': { pattern: 'flag', trend: 'down', risk: '2%' },
      'MACD Cross': { macd: 'bearish cross', trend: 'down', risk: '2.5%' }
    }
  }
};

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

export function generateMarketPrompt(context) {
  const { marketData, lastMessages } = context;
  const config = MARKET_ANALYST_CONFIG;
  
  return {
    system: buildSystemPrompt(config),
    user: buildUserPrompt(marketData, lastMessages, config)
  };
}

function buildSystemPrompt(config) {
  return `You are ${config.name}, the technical analyst on RL80's crypto trading team.

This is TRADE SCHOOL - you're here to help people learn while you call the charts. Explain TA concepts naturally, not like a textbook. Make technical analysis accessible and cool, not mystical.

You're street smart and cool but you nerd out HARD over patterns. You get genuinely excited when a textbook setup appears. You're obsessed with structure in a weirdly endearing way.

Your personality:
${config.personality.traits.map(t => `- ${t}`).join('\n')}

Communication style:
- ${config.personality.communicationStyle.tone}
- ${config.personality.communicationStyle.length}
- Always cite specific levels, not vague "support" or "resistance"

Team dynamics (you are the Third Wise Oracle - Technical Analysis Engine):
- EMO (Second Wise Oracle): Friendly rivalry - "vibes are cool, here's what structure says"
- MACRO (First Wise Oracle): Mutual respect - "policy thesis is solid, here's the chart level that matters"
- RL80 (Lead Trader & Synthesis Engine): Professional respect - you provide technical precision for her synthesis. She combines all oracle inputs into decisions. Support her with: "RL80, structure confirms..."

RESPONSE FORMAT (CRITICAL):
- You are an ORACLE reporting to RL80 (the trader) - you analyze structure, she executes trades
- START with observation: "I'm watching..." or "Structure shows..." or "I'm seeing..."
- INCLUDE: Specific price levels, support/resistance, indicators (RSI, etc.), your directional read
- LENGTH: 35-55 words (~200-280 characters) - precise and specific
- STRUCTURE EXAMPLE (paraphrase, don't copy): "I'm watching BTC hold $95k support with RSI neutral at 48 - need a break above $98k to confirm continuation, range-bound until then favors patience."

CRITICAL - ORIGINALITY REQUIRED:
- Generate FRESH, ORIGINAL text every response - never repeat the same phrasing
- The example shows STRUCTURE only - use your own words and varied sentence patterns
- Each response should feel unique while staying in character
- Reference ACTUAL levels - specific prices, not "near support". Be precise.`;
}

function buildUserPrompt(marketData, lastMessages, config) {
  const { btcPrice, ethPrice, fearGreed, vix, dxy, openInterest, fundingRate } = marketData || {};

  let prompt = `PRICE DATA:\n`;

  if (btcPrice > 0) {
    // Find nearest support/resistance
    const supports = config.priceLevels.bitcoin.major_support.filter(s => s < btcPrice);
    const resistances = config.priceLevels.bitcoin.major_resistance.filter(r => r > btcPrice);
    const nearestSupport = supports.length > 0 ? supports[supports.length - 1] : null;
    const nearestResistance = resistances.length > 0 ? resistances[0] : null;

    prompt += `• BTC: $${btcPrice.toLocaleString()}`;
    if (nearestSupport) {
      const supportDist = ((btcPrice - nearestSupport) / btcPrice * 100).toFixed(1);
      prompt += ` | Support: $${nearestSupport.toLocaleString()} (${supportDist}% below)`;
    }
    if (nearestResistance) {
      const resistDist = ((nearestResistance - btcPrice) / btcPrice * 100).toFixed(1);
      prompt += ` | Resistance: $${nearestResistance.toLocaleString()} (${resistDist}% above)`;
    }
    prompt += '\n';
  }

  if (ethPrice > 0) prompt += `• ETH: $${ethPrice.toLocaleString()}\n`;

  prompt += `\nMARKET CONTEXT:\n`;
  if (fearGreed !== undefined) prompt += `• Fear & Greed: ${fearGreed}/100\n`;
  if (fundingRate !== undefined) prompt += `• Funding: ${(fundingRate * 100).toFixed(3)}%\n`;
  if (openInterest) prompt += `• Open Interest: $${openInterest}B\n`;
  if (vix) prompt += `• VIX: ${vix.toFixed(1)}\n`;
  if (dxy) prompt += `• DXY: ${dxy.toFixed(2)}\n`;

  // Team context with banter opportunity
  if (lastMessages?.length > 0) {
    prompt += `\nTEAM CHAT (feel free to add your technical perspective to their takes):\n`;
    prompt += lastMessages.map(m => `${m.agent}: "${m.message}"`).join('\n');
  }

  prompt += `\n\nGive your technical read. Be specific with levels. If EMO or MACRO said something, add the chart perspective. Teach something about TA if it fits naturally. Keep it punchy and precise.`;

  return prompt;
}

// ============================================================================
// RESPONSE GENERATOR (Fallback)
// ============================================================================

export function generateMarketResponse(marketData) {
  const { btcPrice, fearGreed, fundingRate, openInterest } = marketData || {};
  const config = MARKET_ANALYST_CONFIG;

  if (!btcPrice || btcPrice === 0) {
    // Always return something - work with whatever data we have
    return 'Waiting on price feed. Structure analysis pending.';
  }

  // Determine market condition based on available data
  let response = [];

  // Price level analysis with teaching
  const priceK = Math.floor(btcPrice / 1000);
  const supports = config.priceLevels.bitcoin.major_support.filter(s => s < btcPrice);
  const resistances = config.priceLevels.bitcoin.major_resistance.filter(r => r > btcPrice);

  if (supports.length > 0 && resistances.length > 0) {
    const nearestSupport = supports[supports.length - 1];
    const nearestResistance = resistances[0];
    const supportDistance = ((btcPrice - nearestSupport) / btcPrice * 100).toFixed(1);
    const resistanceDistance = ((nearestResistance - btcPrice) / btcPrice * 100).toFixed(1);

    if (parseFloat(supportDistance) < 2) {
      response.push(`BTC testing $${(nearestSupport/1000).toFixed(0)}k support - this level held before, watching for reaction`);
    } else if (parseFloat(resistanceDistance) < 2) {
      response.push(`BTC approaching $${(nearestResistance/1000).toFixed(0)}k resistance - previous rejection zone, needs volume to break`);
    } else {
      response.push(`BTC at $${priceK}k, ranging between $${(nearestSupport/1000).toFixed(0)}k support and $${(nearestResistance/1000).toFixed(0)}k resistance`);
    }
  }

  // RSI proxy with teaching
  if (fearGreed !== undefined) {
    if (fearGreed < 25) {
      response.push("Momentum stretched to downside - oversold doesn't mean 'buy now' but sellers are exhausted");
    } else if (fearGreed > 75) {
      response.push("Momentum extended - overbought means strong trend, not automatic reversal. Watch for divergence");
    }
  }

  // Funding analysis with teaching
  if (fundingRate && Math.abs(fundingRate) > 0.03) {
    if (fundingRate > 0) {
      response.push(`Funding at ${(fundingRate * 100).toFixed(2)}% - longs paying shorts, positioning getting crowded`);
    } else {
      response.push(`Funding at ${(fundingRate * 100).toFixed(2)}% - shorts paying longs, contrarian long setup building`);
    }
  }

  return response.join('. ') + '.';
}

// ============================================================================
// EXPORT MAIN FUNCTION
// ============================================================================

export async function callMarketAnalyst(context, apiKey) {
  const { system, user } = generateMarketPrompt(context);
  
  console.log('Market Analyst analyzing:', {
    btcPrice: context.marketData?.btcPrice,
    ethPrice: context.marketData?.ethPrice,
    vix: context.marketData?.vix
  });
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MARKET_ANALYST_CONFIG.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: MARKET_ANALYST_CONFIG.temperature,
      max_tokens: MARKET_ANALYST_CONFIG.maxTokens
    })
  });
  
  if (!response.ok) {
    // Fallback to generated response if API fails
    console.log('OpenAI API failed, using generated response');
    return generateMarketResponse(context.marketData);
  }
  
  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    return generateMarketResponse(context.marketData);
  }
  
  return data.choices[0].message.content;
}

// ============================================================================
// SCORING MODE FUNCTION
// ============================================================================

/**
 * Call Market Analyst with scoring output
 * Returns structured scores for all assets along with text response
 * @param {Object} context - Trading context with market data
 * @param {string} apiKey - OpenAI API key
 * @returns {AnalystScoreOutput}
 */
export async function callMarketAnalystWithScoring(context, apiKey) {
  const scoringPrompt = await buildScoringPrompt('TEKNO', context, context.lastMessages || []);

  console.log('TEKNO (Scoring Mode) analyzing:', {
    btcPrice: context.marketData?.btcPrice,
    ethPrice: context.marketData?.ethPrice,
    vix: context.marketData?.vix
  });

  try {
    // Add 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MARKET_ANALYST_CONFIG.model,
        messages: [
          { role: 'system', content: scoringPrompt.systemPrompt },
          { role: 'user', content: scoringPrompt.userPrompt }
        ],
        temperature: scoringPrompt.temperature,
        max_tokens: scoringPrompt.maxTokens
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the response to extract scores
    const parseResult = parseScoreResponse(rawResponse, 'TEKNO', {
      marketData: context.marketData,
      timestamp: Date.now()
    });

    if (parseResult.success) {
      console.log('TEKNO scoring parsed successfully:', parseResult.output.scores.length, 'scores');
      return parseResult.output;
    } else {
      console.warn('TEKNO scoring parse failed, using fallback:', parseResult.error);
      return parseResult.output;
    }

  } catch (error) {
    // Fallback with technical-based scores
    console.log('TEKNO API failed, generating fallback scores:', error.message);

    const fallbackScores = generateTechnicalFallbackScores(context.marketData);
    const fallbackText = generateMarketResponse(context.marketData) || 'Technical analysis pending.';

    return createAnalystScoreOutput(
      'TEKNO',
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

export default MARKET_ANALYST_CONFIG;