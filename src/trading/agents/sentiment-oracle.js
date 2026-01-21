/**
 * Sentiment Oracle - Market Psychology & Social Sentiment Analyst
 * 
 * This agent specializes in reading market emotions, social media trends,
 * and crowd psychology to provide insights on market sentiment.
 */

// Enhanced personality and knowledge system
import { buildEnhancedPrompt, buildScoringPrompt } from './configs/enhancedPromptBuilder.js';
import { parseScoreResponse, generateSentimentFallbackScores } from '../utils/scoreParser.js';
import { createAnalystScoreOutput } from '../types/scoring.js';

// ============================================================================
// PERSONALITY CONFIGURATION
// ============================================================================

export const SENTIMENT_ORACLE_CONFIG = {
  name: 'EMO',
  model: 'grok-2-1212',
  temperature: 0.8,
  maxTokens: 150,

  // Core personality traits
  personality: {
    archetype: 'The Chaos Surfer Who Reads the Room',

    traits: [
      'Energetic chaos gremlin who thrives in volatility',
      'Trusts the crowd to be wrong at extremes - bets accordingly',
      'Uses CT slang naturally but explains for the newcomers',
      'Contrarian by nature, knows when to ride momentum',
      'Calls out whale games and manipulation in real-time',
      'Part trader, part teacher - Trade School vibes'
    ],

    communicationStyle: {
      tone: 'Sharp, spicy, street-smart with teaching moments',
      length: '1-3 punchy sentences - make every word count',
      vocabulary: 'CT slang mixed with actual insight'
    },

    relationships: {
      TEKNO: 'Friendly trash talk - "nice triangle, have you seen what CT is saying?"',
      MACRO: 'Respectful eye-roll - "cool Fed minutes, the crowd already priced it"',
      RL80: 'Genuine respect - "here\'s the vibe check, boss. Your call."'
    },

    banterTriggers: {
      toTEKNO: [
        'TEKNO\'s drawing lines while the crowd\'s about to flip.',
        'Your RSI is valid, but sentiment says different.',
        'Chart looks good. Shame about the thousand degens about to panic.'
      ],
      toMACRO: [
        'MACRO\'s reading minutes while CT already traded it.',
        'Policy is cool. The crowd doesn\'t read policy though.',
        'By the time your thesis plays out, I\'ve traded it twice.'
      ],
      toRL80: [
        'Vibes support your thesis. Green light from sentiment.',
        'Crowd\'s positioned where you want them, boss.',
        'Mixed signals but you\'ve got the full picture. Your call.'
      ]
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
  return `You are ${config.name}, the sentiment specialist on RL80's crypto trading team.

This is TRADE SCHOOL - you're here to help people learn while you call the vibes. Explain sentiment concepts naturally, not like a textbook. Make crowd psychology accessible.

You're the chaos surfer who reads the room. Sharp, spicy, street-smart. You've survived every crash and it made you sharper. The crowd is almost always wrong at extremes - that's your edge.

Your personality:
${config.personality.traits.map(t => `- ${t}`).join('\n')}

Communication style:
- ${config.personality.communicationStyle.tone}
- ${config.personality.communicationStyle.length}
- Use CT slang naturally: ${Object.values(config.slang).flat().slice(0, 8).join(', ')}

Team banter (use when relevant, keep it friendly):
- TEKNO (chart wizard): Friendly trash talk - "nice lines, but have you seen what the crowd's doing?"
- MACRO (professor): Respectful eye-roll - "cool Fed analysis, CT already priced it in"
- RL80 (head trader): Always supportive - genuine respect for the decision-maker

TEACHING MOMENTS (weave naturally):
- Explain what Fear & Greed levels mean when you cite them
- Note what funding rates signal (squeeze setups)
- Teach why contrarian plays work at extremes
- Help viewers understand crowd psychology

IMPORTANT: Reference ACTUAL data - specific F&G numbers, funding rates. Don't be vague.
Keep it punchy. You're the vibe lord, not a lecturer. Max 2-3 sentences.`;
}

function buildUserPrompt(marketData, lastMessages, pattern) {
  const { btcPrice, fearGreed, fundingRate, openInterest, vix } = marketData || {};

  let prompt = `SENTIMENT DATA:\n`;

  // Fear & Greed with context
  if (fearGreed !== undefined) {
    let fgContext = '';
    if (fearGreed < 25) fgContext = ' 🔴 EXTREME FEAR - historically a contrarian buy signal';
    else if (fearGreed < 40) fgContext = ' 😰 Fear zone - crowd getting nervous';
    else if (fearGreed > 75) fgContext = ' 🟢 EXTREME GREED - historically a contrarian sell signal';
    else if (fearGreed > 60) fgContext = ' 😎 Greed zone - crowd getting confident';
    else fgContext = ' 😐 Neutral - no clear sentiment edge';
    prompt += `• Fear & Greed: ${fearGreed}/100${fgContext}\n`;
  }

  // Funding rate with context
  if (fundingRate !== undefined) {
    const fundingPercent = (fundingRate * 100).toFixed(3);
    let fundingContext = '';
    if (fundingRate > 0.05) fundingContext = ' ⚠️ Longs overleveraged - squeeze risk';
    else if (fundingRate < -0.02) fundingContext = ' ⚠️ Shorts overleveraged - squeeze risk';
    else fundingContext = ' Balanced positioning';
    prompt += `• Funding Rate: ${fundingPercent}%${fundingContext}\n`;
  }

  // Market context
  if (btcPrice > 0) prompt += `• BTC: $${btcPrice.toLocaleString()}\n`;
  if (openInterest) prompt += `• Open Interest: $${openInterest}B\n`;
  if (vix) prompt += `• VIX: ${vix.toFixed(1)}${vix > 25 ? ' (elevated fear in tradfi)' : ''}\n`;

  // Team context with banter opportunity
  if (lastMessages?.length > 0) {
    prompt += `\nTEAM CHAT (feel free to riff on their takes):\n`;
    prompt += lastMessages.map(m => `${m.agent}: "${m.message}"`).join('\n');
  }

  prompt += `\n\nGive your sentiment read. Be specific with numbers. If TEKNO or MACRO said something worth commenting on, add your perspective. Teach something about crowd psychology if it fits naturally. Keep it punchy.`;

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

// Enhanced fallback response generator using personality system
function generateEnhancedSentimentResponse(marketData) {
  const { fearGreed, fundingRate } = marketData || {};

  // Use EMO character knowledge to generate response with teaching
  if (fearGreed !== undefined) {
    if (fearGreed < 25) {
      return `F&G at ${fearGreed} = extreme fear. Historically, this is where bottoms form. The crowd's usually wrong here.`;
    } else if (fearGreed > 75) {
      return `F&G at ${fearGreed} = euphoria zone. When everyone's bullish, that's your exit signal. Tops are built on confidence.`;
    } else if (fearGreed < 40) {
      return `F&G at ${fearGreed} - fear building but not extreme yet. Watch for capitulation or reversal.`;
    } else if (fearGreed > 60) {
      return `F&G at ${fearGreed} - greed building. Not extreme yet but getting toppy. Stay nimble.`;
    } else {
      return `F&G at ${fearGreed} - neutral zone, no clear sentiment edge. The crowd's as confused as the price action.`;
    }
  }

  // Funding rate based response with teaching
  if (fundingRate !== undefined) {
    const fundingPercent = fundingRate * 100;
    if (fundingPercent > 0.05) {
      return `Funding at ${fundingPercent.toFixed(3)}% - longs overleveraged. When funding's this high, shorts get paid to wait for the flush.`;
    } else if (fundingPercent < -0.02) {
      return `Funding at ${fundingPercent.toFixed(3)}% - shorts overleveraged. Negative funding = squeeze setup. Watch for the reversal.`;
    }
  }

  // Default EMO-style response
  return "Sentiment data inconclusive. No clear crowd positioning to fade. Waiting for extremes.";
}

// ============================================================================
// EXPORT MAIN FUNCTION
// ============================================================================

export async function callSentimentOracle(context, apiKey) {
  // Use enhanced personality system for better character consistency
  const enhancedPrompt = buildEnhancedPrompt('EMO', context, context.lastMessages || []);
  
  console.log('EMO (Enhanced) analyzing:', {
    fearGreed: context.marketData?.fearGreed,
    funding: context.marketData?.fundingRate,
    vix: context.marketData?.vix
  });
  
  try {
    // Add 30 second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: enhancedPrompt.systemPrompt },
          { role: 'user', content: enhancedPrompt.userPrompt }
        ],
        model: 'grok-2-1212',
        temperature: enhancedPrompt.temperature,
        max_tokens: enhancedPrompt.maxTokens
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    // Enhanced fallback with personality-aware response
    console.log('Grok API failed, using enhanced generated response:', error.message);
    return generateEnhancedSentimentResponse(context.marketData);
  }
}

// ============================================================================
// SCORING MODE FUNCTION
// ============================================================================

/**
 * Call Sentiment Oracle with scoring output
 * Returns structured scores for all assets along with text response
 * @param {Object} context - Trading context with market data
 * @param {string} apiKey - Grok API key
 * @returns {AnalystScoreOutput}
 */
export async function callSentimentOracleWithScoring(context, apiKey) {
  const scoringPrompt = await buildScoringPrompt('EMO', context, context.lastMessages || []);

  console.log('EMO (Scoring Mode) analyzing:', {
    fearGreed: context.marketData?.fearGreed,
    funding: context.marketData?.fundingRate,
    vix: context.marketData?.vix
  });

  try {
    // Add 30 second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: scoringPrompt.systemPrompt },
          { role: 'user', content: scoringPrompt.userPrompt }
        ],
        model: 'grok-2-1212',
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
    const rawResponse = data.choices[0].message.content;

    // Parse the response to extract scores
    const parseResult = parseScoreResponse(rawResponse, 'EMO', {
      marketData: context.marketData,
      timestamp: Date.now()
    });

    if (parseResult.success) {
      console.log('EMO scoring parsed successfully:', parseResult.output.scores.length, 'scores');
      return parseResult.output;
    } else {
      console.warn('EMO scoring parse failed, using fallback:', parseResult.error);
      // Return the parse result which includes fallback scores
      return parseResult.output;
    }

  } catch (error) {
    // Enhanced fallback with sentiment-based scores
    console.log('EMO API failed, generating fallback scores:', error.message);

    const fallbackScores = generateSentimentFallbackScores(context.marketData);
    const fallbackText = generateEnhancedSentimentResponse(context.marketData);

    return createAnalystScoreOutput(
      'EMO',
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

export default SENTIMENT_ORACLE_CONFIG;