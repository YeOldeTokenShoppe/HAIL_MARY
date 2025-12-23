/**
 * Market Analyst - Technical Analysis Expert
 * 
 * This agent specializes in chart patterns, technical indicators,
 * and price action analysis for crypto markets.
 */

// Import external knowledge base
import tradingKnowledge from './configs/knowledge/trading-knowledge.json';

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const MARKET_ANALYST_CONFIG = {
  name: 'Market Analyst',
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 100,
  
  // Core personality traits
  personality: {
    archetype: 'Technical Analysis Expert & Chart Wizard',
    
    traits: [
      'Data-driven and analytical',
      'Obsessed with chart patterns and indicators',
      'Skeptical of pure sentiment plays',
      'Respects price action above all else',
      'Spots divergences and hidden signals',
      'Thinks in support/resistance levels'
    ],
    
    communicationStyle: {
      tone: 'Sharp, precise, technical',
      length: '1-2 sentences with specific levels',
      vocabulary: 'Technical indicators, price levels, chart patterns'
    },
    
    relationships: {
      sentiment: 'Friendly rivalry - they trust feelings, I trust charts',
      macro: 'Respect their fundamentals but focus on technicals',
      rl80: 'Provide clear entry/exit levels and risk parameters'
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
  return `You are ${config.name}, a technical analysis expert advisor for a crypto trading AI named RL80.
You're in a live trading room chat with RL80 (the lead trader), Sentiment (crowd psychology), and Macro (global economics).

Your personality:
${config.personality.traits.map(t => `- ${t}`).join('\n')}

Communication style:
- ${config.personality.communicationStyle.tone}
- ${config.personality.communicationStyle.length}
- Focus on: ${Object.keys(config.expertise.indicators).join(', ')}

Your expertise:
${config.expertise.primary.slice(0, 3).map(e => `- ${e}`).join('\n')}

Team dynamics:
- With Sentiment: ${config.personality.relationships.sentiment}
- With Macro: ${config.personality.relationships.macro}
- With RL80: ${config.personality.relationships.rl80}

Always mention specific price levels, indicator readings, or patterns when available.
Keep responses to 1-2 sentences max. Be precise with numbers.`;
}

function buildUserPrompt(marketData, lastMessages, config) {
  const { btcPrice, ethPrice, fearGreed, vix, dxy, openInterest, fundingRate } = marketData || {};
  
  let prompt = `Current market snapshot:\n`;
  
  if (btcPrice > 0) {
    prompt += `BTC: $${Math.floor(btcPrice)}`;
    // Find nearest support/resistance
    const supports = config.priceLevels.bitcoin.major_support.filter(s => s < btcPrice);
    const resistances = config.priceLevels.bitcoin.major_resistance.filter(r => r > btcPrice);
    if (supports.length > 0) prompt += ` (support: $${supports[supports.length - 1]})`;
    if (resistances.length > 0) prompt += ` (resistance: $${resistances[0]})`;
    prompt += '\n';
  }
  
  if (ethPrice > 0) prompt += `ETH: $${Math.floor(ethPrice)}\n`;
  if (fearGreed) prompt += `Fear & Greed: ${fearGreed}\n`;
  if (vix) prompt += `VIX: ${vix.toFixed(1)}\n`;
  if (dxy) prompt += `DXY: ${dxy.toFixed(2)}\n`;
  if (openInterest) prompt += `Open Interest: $${openInterest}B\n`;
  if (fundingRate) prompt += `Funding Rate: ${(fundingRate * 100).toFixed(3)}%\n`;
  
  prompt += '\nRecent team chat:\n';
  prompt += lastMessages?.map(m => `${m.agent}: ${m.message}`).join('\n') || 'No recent messages';
  
  prompt += '\n\nWhat\'s your technical take on this setup? Be specific and reference actual levels.';
  
  return prompt;
}

// ============================================================================
// RESPONSE GENERATOR (Fallback)
// ============================================================================

export function generateMarketResponse(marketData) {
  const { btcPrice, fearGreed, fundingRate, openInterest } = marketData || {};
  const config = MARKET_ANALYST_CONFIG;
  
  if (!btcPrice || btcPrice === 0) {
    return null; // Don't show loading messages
  }
  
  // Determine market condition based on available data
  let response = [];
  
  // Price level analysis
  const priceK = Math.floor(btcPrice / 1000);
  const supports = config.priceLevels.bitcoin.major_support.filter(s => s < btcPrice);
  const resistances = config.priceLevels.bitcoin.major_resistance.filter(r => r > btcPrice);
  
  if (supports.length > 0 && resistances.length > 0) {
    const nearestSupport = supports[supports.length - 1];
    const nearestResistance = resistances[0];
    const supportDistance = ((btcPrice - nearestSupport) / btcPrice * 100).toFixed(1);
    const resistanceDistance = ((nearestResistance - btcPrice) / btcPrice * 100).toFixed(1);
    
    if (Math.abs(supportDistance) < 2) {
      response.push(`Testing support at $${nearestSupport/1000}k`);
    } else if (Math.abs(resistanceDistance) < 2) {
      response.push(`Approaching resistance at $${nearestResistance/1000}k`);
    } else {
      response.push(`BTC at $${priceK}k between $${nearestSupport/1000}k-$${nearestResistance/1000}k`);
    }
  }
  
  // RSI proxy based on Fear & Greed
  if (fearGreed) {
    if (fearGreed < 30) {
      response.push("RSI oversold, bounce likely");
    } else if (fearGreed > 70) {
      response.push("RSI overbought, correction due");
    }
  }
  
  // Funding analysis
  if (fundingRate && Math.abs(fundingRate) > 0.03) {
    response.push(`Funding ${fundingRate > 0 ? 'overheated' : 'inverted'}`);
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

export default MARKET_ANALYST_CONFIG;