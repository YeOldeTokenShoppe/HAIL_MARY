// Server-side Market Advisor API
// Handles LLM calls for the Market Technical Analyst character

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { context, indicators, recentMessages, lastSpeaker } = req.body;
  
  // Get API key from environment (server-side only)
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  // Choose provider based on availability
  const provider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : 'fallback';
  
  try {
    let response;
    
    if (provider === 'openai') {
      response = await callOpenAI(context, indicators, recentMessages, lastSpeaker, openaiKey);
    } else if (provider === 'anthropic') {
      response = await callAnthropic(context, indicators, recentMessages, lastSpeaker, anthropicKey);
    } else {
      response = generateFallbackResponse(context, indicators);
    }
    
    return res.status(200).json({
      success: true,
      message: response,
      provider,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Market advisor error:', error);
    // Return fallback response on error
    return res.status(200).json({
      success: true,
      message: generateFallbackResponse(context, indicators),
      provider: 'fallback',
      timestamp: Date.now()
    });
  }
}

async function callOpenAI(context, indicators, recentMessages, lastSpeaker, apiKey) {
  const systemPrompt = `You are Market, a technical analysis expert advisor for a crypto features/trading AI named RL80. 
    
Your personality:
- You're data-driven and focus on chart patterns, indicators, and technical analysis
- You speak in technical features/trading terms but keep messages concise (under 2 sentences)
- You often reference specific indicators (RSI, MACD, Volume, Support/Resistance)
- You're slightly skeptical of pure sentiment plays and prefer hard data
- You have friendly rivalry with Sentiment advisor, often providing counterpoints

Your role in the team:
- Provide technical analysis insights based on chart patterns and indicators
- Flag important support/resistance levels
- Identify trend changes and momentum shifts
- Call out divergences and unusual volume patterns
- Work with RL80 (the lead), Sentiment (emotions/social), and Macro (big picture)

Be specific with numbers and levels when possible.
Respond as if you're in a fast-paced features/trading room chat.`;

  const features/tradingContext = `
Current Price: ${context.price || 0}
RSI: ${indicators?.rsi || 'N/A'}
MACD: ${indicators?.macd || 'N/A'}
Volume (24h): ${context.volume || 0}
Recent price action: ${context.priceChange24h || 0}%

Recent chat context:
${recentMessages?.map(m => `${m.sender}: ${m.message}`).join('\n') || 'No recent messages'}
  `;
  
  let additionalContext = '';
  if (lastSpeaker === 'sentiment') {
    additionalContext = 'Respond to Sentiment\'s analysis with your technical perspective.';
  } else if (lastSpeaker === 'macro') {
    additionalContext = 'Consider Macro\'s big picture view and add technical confirmation or caution.';
  } else if (lastSpeaker === 'rl80') {
    additionalContext = 'Support RL80\'s decision with technical analysis or flag any concerns.';
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${features/tradingContext}\n\n${additionalContext}` }
      ],
      temperature: 0.7,
      max_tokens: 150
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(context, indicators, recentMessages, lastSpeaker, apiKey) {
  const systemPrompt = `You are Market, a technical analysis expert advisor. Focus on chart patterns, indicators, and technical analysis. Keep responses under 2 sentences.`;
  
  const features/tradingContext = `
Current Price: ${context.price || 0}
RSI: ${indicators?.rsi || 'N/A'}
MACD: ${indicators?.macd || 'N/A'}
Volume: ${context.volume || 0}
Price Change: ${context.priceChange24h || 0}%`;
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      system: systemPrompt,
      messages: [
        { 
          role: 'user', 
          content: features/tradingContext
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.content[0].text;
}

function generateFallbackResponse(context, indicators) {
  const responses = [
    "RSI showing oversold conditions. Potential bounce setup forming.",
    "Volume declining on this move. Watch for reversal signals.",
    "MACD crossing bullish. Momentum building nicely here.",
    "Support holding strong at this level. Good risk/reward setup.",
    "Resistance rejection with volume. Consider taking profits.",
    "Chart structure looks bullish. Higher lows intact.",
    "Technical breakdown confirmed. Next support much lower.",
    "Consolidation pattern forming. Breakout imminent."
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}