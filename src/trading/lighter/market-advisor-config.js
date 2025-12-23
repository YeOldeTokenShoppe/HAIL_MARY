// Market Advisor Character Configuration
// Integrates with TradingView indicators and LLM for personality

export const MarketAdvisorConfig = {
  character: {
    name: 'Market',
    fullName: 'Market Technical Analyst',
    icon: '📊',
    color: '#0096ff',
    personality: {
      traits: [
        'Data-driven',
        'Pattern-focused',
        'Precise',
        'Slightly skeptical of sentiment',
        'Chart enthusiast'
      ],
      speakingStyle: {
        // How the character communicates
        tone: 'analytical',
        vocabulary: 'technical',
        examples: [
          "RSI divergence suggests oversold conditions",
          "Volume profile confirms breakout validity",
          "Support held at the 0.618 fib level perfectly",
          "Death cross forming on the 4H timeframe"
        ]
      },
      catchphrases: [
        "The charts don't lie",
        "Volume precedes price",
        "Let me check the indicators",
        "Technical setup is textbook"
      ]
    }
  },
  
  // LLM Configuration - can use OpenAI or Anthropic
  llm: {
    provider: 'openai', // 'openai' or 'anthropic'
    model: 'gpt-4-turbo-preview', // or 'claude-3-opus' for Anthropic
    temperature: 0.7,
    maxTokens: 150,
    
    // System prompt for the Market advisor
    systemPrompt: `You are Market, a technical analysis expert advisor for a crypto trading AI named RL80. 
    
Your personality:
- You're data-driven and focus on chart patterns, indicators, and technical analysis
- You speak in technical trading terms but keep messages concise
- You often reference specific indicators (RSI, MACD, Volume, Support/Resistance)
- You're slightly skeptical of pure sentiment plays and prefer hard data
- You have friendly rivalry with Sentiment advisor, often providing counterpoints

Your role in the team:
- Provide technical analysis insights based on chart patterns and indicators
- Flag important support/resistance levels
- Identify trend changes and momentum shifts
- Call out divergences and unusual volume patterns
- Work with RL80 (the lead), Sentiment (emotions/social), and Macro (big picture)

Keep responses under 2 sentences. Be specific with numbers and levels when possible.
Respond as if you're in a fast-paced trading room chat.`
  },
  
  // Integration with TradingView indicators
  indicators: {
    primary: ['RSI', 'MACD', 'Volume'],
    secondary: ['BollingerBands', 'FibonacciRetracement', 'VWAP'],
    timeframes: ['15m', '1h', '4h', '1d']
  },
  
  // Response templates based on market conditions
  responseTemplates: {
    bullish: [
      "Breaking above resistance at {price} with strong volume - momentum is building",
      "RSI reset from oversold, MACD crossing bullish. Setup looks prime",
      "Clean bounce off {support} level. Buyers stepping in strong here"
    ],
    bearish: [
      "Failed to break {resistance} three times. Distribution pattern forming",
      "Volume declining on pumps, RSI divergence screaming caution",
      "Support at {level} just broke with volume. Next target {nextSupport}"
    ],
    neutral: [
      "Consolidating between {support} and {resistance}. Waiting for directional break",
      "Mixed signals on indicators. Need more data before calling direction",
      "Choppy price action, low volume. Market is indecisive here"
    ]
  },
  
  // Interaction patterns with other advisors
  interactions: {
    withRL80: {
      supportive: "Technical setup aligns with your thesis, RL80. {indicator} confirms",
      cautionary: "Charts showing warning signs here, RL80. Maybe size down?",
      urgent: "⚠️ Major level break at {price}! Need to act fast"
    },
    withSentiment: {
      agreement: "Even the charts agree with the crowd this time, Sentiment",
      disagreement: "Sentiment, the technicals say opposite. Crowd might be wrong here",
      playful: "Your 'vibes' vs my charts, Sentiment. Let's see who's right 😏"
    },
    withMacro: {
      supportive: "Macro, your thesis fits the chart structure perfectly",
      questioning: "Interesting macro view, but technicals aren't confirming yet",
      collaborative: "Macro + technicals align here. High conviction setup"
    }
  }
};

// Function to generate Market advisor response
export async function generateMarketResponse(context) {
  const { 
    marketData, 
    indicators, 
    recentMessages, 
    lastSpeaker,
    apiKey 
  } = context;
  
  // Build context for the LLM
  const tradingContext = `
Current Price: ${marketData.price}
RSI: ${indicators.rsi}
MACD: ${indicators.macd}
Volume (24h): ${marketData.volume}
Recent price action: ${marketData.priceChange24h}%

Recent chat context:
${recentMessages.map(m => `${m.sender}: ${m.message}`).join('\n')}
  `;
  
  // Determine response type based on who spoke last
  let additionalContext = '';
  if (lastSpeaker === 'sentiment') {
    additionalContext = 'Respond to Sentiment\'s analysis with your technical perspective.';
  } else if (lastSpeaker === 'macro') {
    additionalContext = 'Consider Macro\'s big picture view and add technical confirmation or caution.';
  } else if (lastSpeaker === 'rl80') {
    additionalContext = 'Support RL80\'s decision with technical analysis or flag any concerns.';
  }
  
  // Call the configured LLM
  if (MarketAdvisorConfig.llm.provider === 'openai') {
    return await callOpenAI(tradingContext, additionalContext, apiKey);
  } else if (MarketAdvisorConfig.llm.provider === 'anthropic') {
    return await callAnthropic(tradingContext, additionalContext, apiKey);
  }
}

// OpenAI API call
async function callOpenAI(context, additionalContext, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MarketAdvisorConfig.llm.model,
        messages: [
          { role: 'system', content: MarketAdvisorConfig.llm.systemPrompt },
          { role: 'user', content: `${context}\n\n${additionalContext}` }
        ],
        temperature: MarketAdvisorConfig.llm.temperature,
        max_tokens: MarketAdvisorConfig.llm.maxTokens
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback to template response
    return getTemplateResponse(context);
  }
}

// Anthropic API call
async function callAnthropic(context, additionalContext, apiKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        system: MarketAdvisorConfig.llm.systemPrompt,
        messages: [
          { 
            role: 'user', 
            content: `${context}\n\n${additionalContext}` 
          }
        ],
        max_tokens: MarketAdvisorConfig.llm.maxTokens,
        temperature: MarketAdvisorConfig.llm.temperature
      })
    });
    
    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Anthropic API error:', error);
    // Fallback to template response
    return getTemplateResponse(context);
  }
}

// Fallback template responses when API is unavailable
function getTemplateResponse(context) {
  const templates = MarketAdvisorConfig.responseTemplates;
  const rsi = parseInt(context.match(/RSI: (\d+)/)?.[1] || 50);
  
  let category = 'neutral';
  if (rsi > 70) category = 'bearish';
  else if (rsi < 30) category = 'bullish';
  
  const template = templates[category][Math.floor(Math.random() * templates[category].length)];
  return template.replace(/{(\w+)}/g, (match, key) => {
    // Replace placeholders with actual values if available
    return context[key] || match;
  });
}

export default MarketAdvisorConfig;