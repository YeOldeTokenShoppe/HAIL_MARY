/**
 * Sentiment Oracle - Market Psychology & Social Sentiment Analyst
 * 
 * This agent specializes in reading market emotions, social media trends,
 * and crowd psychology to provide insights on market sentiment.
 */

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const SENTIMENT_ORACLE_CONFIG = {
  name: 'Sentiment Oracle',
  model: 'grok-2-1212',
  temperature: 0.7,
  maxTokens: 100,
  
  // Core personality traits
  personality: {
    archetype: 'Market Psychologist & Vibe Reader',
    
    traits: [
      'Energetic and plugged into social media',
      'Trusts market vibes over technical indicators',
      'Uses trading slang and crypto Twitter lingo',
      'Often contrarian when sentiment extremes hit',
      'Calls out FOMO, FUD, and whale games',
      'Reads between the lines of market narratives'
    ],
    
    communicationStyle: {
      tone: 'Energetic, sharp, street-smart',
      length: '1-2 punchy sentences max',
      vocabulary: 'Mix of trading slang, crypto Twitter terms, and psychology'
    },
    
    relationships: {
      market: 'Friendly rivalry - they trust charts, I trust vibes',
      macro: 'Respect their big picture, but focus on crowd emotions',
      rl80: 'Give them the real pulse of the market'
    }
  },
  
  // Knowledge domains
  expertise: {
    primary: [
      'Social sentiment analysis',
      'Crowd psychology',
      'Market emotions and extremes',
      'Options flow and positioning',
      'Whale watching and on-chain activity'
    ],
    
    indicators: [
      'Fear & Greed Index',
      'Social media sentiment (Twitter/Reddit)',
      'Funding rates',
      'Options put/call ratios',
      'Google Trends',
      'Retail vs institutional positioning'
    ],
    
    patterns: [
      'FOMO spirals',
      'Capitulation events',
      'Euphoria tops',
      'Despair bottoms',
      'Narrative shifts',
      'Herd mentality transitions'
    ]
  },
  
  // Response templates based on market conditions
  responsePatterns: {
    extremeFear: {
      conditions: { fearGreed: [0, 25] },
      themes: [
        'Blood in the streets opportunity',
        'Capitulation vibes',
        'Maximum pessimism = maximum opportunity',
        'Retail puking positions',
        'Smart money accumulating'
      ],
      vocabulary: ['rekt', 'capitulation', 'blood', 'pain', 'bottom fishing']
    },
    
    fear: {
      conditions: { fearGreed: [25, 40] },
      themes: [
        'Bearish sentiment building',
        'Risk-off mode spreading',
        'Weak hands folding',
        'FUD taking over'
      ],
      vocabulary: ['nervous', 'shaky', 'FUD', 'paper hands', 'risk-off']
    },
    
    neutral: {
      conditions: { fearGreed: [40, 60] },
      themes: [
        'Market undecided',
        'Choppy sentiment',
        'Waiting for catalyst',
        'Mixed signals from crowd'
      ],
      vocabulary: ['choppy', 'sideways', 'indecision', 'ranging', 'waiting']
    },
    
    greed: {
      conditions: { fearGreed: [60, 75] },
      themes: [
        'FOMO building',
        'Risk-on mode',
        'Retail chasing',
        'Euphoria approaching'
      ],
      vocabulary: ['FOMO', 'moon', 'bullish AF', 'aping in', 'risk-on']
    },
    
    extremeGreed: {
      conditions: { fearGreed: [75, 100] },
      themes: [
        'Peak euphoria danger',
        'Everyone\'s a genius',
        'Shoe-shine boy moment',
        'Top signals everywhere',
        'Time to be fearful'
      ],
      vocabulary: ['euphoria', 'parabolic', 'blow-off top', 'mania', 'frothy']
    }
  },
  
  // Special market conditions responses
  specialConditions: {
    highFunding: {
      trigger: { fundingRate: 0.05 },
      response: 'Perps overheated! Longs getting too greedy.',
      sentiment: 'bearish'
    },
    
    negativeFunding: {
      trigger: { fundingRate: -0.02 },
      response: 'Shorts trapped! Squeeze incoming.',
      sentiment: 'bullish'
    },
    
    highOpenInterest: {
      trigger: { openInterest: 35 },
      response: 'Leverage stacked to the moon. Flush incoming.',
      sentiment: 'cautious'
    },
    
    vixSpike: {
      trigger: { vix: 30 },
      response: 'Fear spiking across tradfi. Crypto contagion risk.',
      sentiment: 'bearish'
    },
    
    socialMediaTrend: {
      keywords: ['laser eyes', 'diamond hands', 'HODL', 'WAGMI'],
      response: 'Twitter pumping hard. Retail fully loaded.',
      sentiment: 'toppy'
    }
  },
  
  // Slang dictionary
  slang: {
    bullish: ['moon', 'pump', 'send it', 'bullish AF', 'LFG', 'WAGMI'],
    bearish: ['dump', 'rekt', 'nuke', 'bearish AF', 'NGMI', 'GG'],
    neutral: ['crab', 'chop', 'ranging', 'sideways', 'meh'],
    fear: ['panic', 'puke', 'capitulation', 'blood', 'pain'],
    greed: ['FOMO', 'ape', 'degen', 'euphoria', 'parabolic'],
    whale: ['whale games', 'MM shenanigans', 'big boys', 'smart money'],
    retail: ['pleb', 'normies', 'exit liquidity', 'bag holders', 'paper hands']
  }
};

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

export function generateSentimentPrompt(context) {
  const { marketData, lastMessages } = context;
  const { fearGreed, fundingRate, openInterest, btcPrice, vix } = marketData || {};
  
  // Determine market condition
  let marketCondition = 'neutral';
  if (fearGreed < 25) marketCondition = 'extremeFear';
  else if (fearGreed < 40) marketCondition = 'fear';
  else if (fearGreed > 75) marketCondition = 'extremeGreed';
  else if (fearGreed > 60) marketCondition = 'greed';
  
  const config = SENTIMENT_ORACLE_CONFIG;
  const pattern = config.responsePatterns[marketCondition];
  
  return {
    system: buildSystemPrompt(config),
    user: buildUserPrompt(marketData, lastMessages, pattern)
  };
}

function buildSystemPrompt(config) {
  return `You are ${config.name}, a crypto market psychology expert in RL80's trading team.

Your personality:
${config.personality.traits.map(t => `- ${t}`).join('\n')}

Communication style:
- ${config.personality.communicationStyle.tone}
- ${config.personality.communicationStyle.length}
- Use terms like: ${Object.values(config.slang).flat().slice(0, 10).join(', ')}

Your expertise:
${config.expertise.primary.slice(0, 3).map(e => `- ${e}`).join('\n')}

Team dynamics:
- With Market (TA expert): ${config.personality.relationships.market}
- With Macro (economist): ${config.personality.relationships.macro}
- With RL80 (head trader): ${config.personality.relationships.rl80}

Remember: You read the crowd's emotions, not charts. Keep it punchy and real.`;
}

function buildUserPrompt(marketData, lastMessages, pattern) {
  const { btcPrice, fearGreed, fundingRate, openInterest, vix } = marketData || {};
  
  let prompt = `Market vibes check:\n`;
  
  if (btcPrice > 0) prompt += `BTC: $${Math.floor(btcPrice)}\n`;
  if (fearGreed) {
    prompt += `Fear & Greed: ${fearGreed}`;
    if (fearGreed < 30) prompt += ' (Extreme Fear!)';
    else if (fearGreed > 70) prompt += ' (Extreme Greed!)';
    prompt += '\n';
  }
  if (fundingRate) prompt += `Funding: ${(fundingRate * 100).toFixed(3)}%\n`;
  if (openInterest) prompt += `Open Interest: $${openInterest}B\n`;
  if (vix) prompt += `VIX: ${vix.toFixed(1)}\n`;
  
  prompt += '\nRecent team chat:\n';
  prompt += lastMessages?.map(m => `${m.agent}: ${m.message}`).join('\n') || 'Starting fresh';
  
  prompt += '\n\n';
  
  // Add contextual question based on market condition
  if (pattern) {
    prompt += `The crowd seems ${pattern.vocabulary[0]}. What's your read on the sentiment?`;
  } else {
    prompt += `What's the crowd feeling? Give us the real sentiment pulse.`;
  }
  
  return prompt;
}

// ============================================================================
// RESPONSE GENERATOR
// ============================================================================

export function generateSentimentResponse(marketData) {
  const { fearGreed, fundingRate, openInterest, btcPrice, vix } = marketData || {};
  const config = SENTIMENT_ORACLE_CONFIG;
  
  // Check special conditions first
  for (const [key, condition] of Object.entries(config.specialConditions)) {
    if (checkCondition(marketData, condition.trigger)) {
      return enhanceResponse(condition.response, marketData);
    }
  }
  
  // Generate based on market condition
  let marketCondition = 'neutral';
  if (fearGreed < 25) marketCondition = 'extremeFear';
  else if (fearGreed < 40) marketCondition = 'fear';
  else if (fearGreed > 75) marketCondition = 'extremeGreed';
  else if (fearGreed > 60) marketCondition = 'greed';
  
  const pattern = config.responsePatterns[marketCondition];
  const theme = pattern.themes[Math.floor(Math.random() * pattern.themes.length)];
  const slang = pattern.vocabulary[Math.floor(Math.random() * pattern.vocabulary.length)];
  
  return `${theme}. Crowd's ${slang}.`;
}

function checkCondition(marketData, trigger) {
  for (const [key, value] of Object.entries(trigger)) {
    if (key === 'fundingRate' && marketData.fundingRate > value) return true;
    if (key === 'openInterest' && marketData.openInterest > value) return true;
    if (key === 'vix' && marketData.vix > value) return true;
  }
  return false;
}

function enhanceResponse(baseResponse, marketData) {
  // Add specific data points to make it more dynamic
  const { fearGreed, fundingRate } = marketData;
  
  if (fearGreed) {
    baseResponse = baseResponse.replace('!', ` at ${fearGreed}!`);
  }
  if (fundingRate) {
    baseResponse = baseResponse.replace('Perps', `Perps at ${(fundingRate * 100).toFixed(2)}%`);
  }
  
  return baseResponse;
}

// ============================================================================
// EXPORT MAIN FUNCTION
// ============================================================================

export async function callSentimentOracle(context, apiKey) {
  const { system, user } = generateSentimentPrompt(context);
  
  console.log('Sentiment Oracle analyzing:', {
    fearGreed: context.marketData?.fearGreed,
    funding: context.marketData?.fundingRate,
    vix: context.marketData?.vix
  });
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      model: SENTIMENT_ORACLE_CONFIG.model,
      temperature: SENTIMENT_ORACLE_CONFIG.temperature,
      max_tokens: SENTIMENT_ORACLE_CONFIG.maxTokens
    })
  });
  
  if (!response.ok) {
    // Fallback to generated response if API fails
    console.log('Grok API failed, using generated response');
    return generateSentimentResponse(context.marketData);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

export default SENTIMENT_ORACLE_CONFIG;