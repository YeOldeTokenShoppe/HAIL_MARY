// API Route for AI Trading Team Chat
// Handles multi-agent conversations with OpenAI, Anthropic, and Grok

// Import all modular agents
import { callSentimentOracle } from '../../agents/sentiment-oracle';
import { callMarketAnalyst } from '../../agents/market-analyst';
import { callMacroSpecialist } from '../../agents/macro-specialist';
import { callRL80Trader } from '../../agents/rl80-trader';

// Import agent control configuration
import { isAgentEnabled, getMockResponse, isRateLimited, logApiCall, logResponse } from '../../agents/configs/agent-config';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { context, agent, lastMessages } = req.body;

  // Get API keys from environment
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const grokKey = process.env.GROK_API_KEY;

  try {
    let response;
    
    switch (agent) {
      case 'market':
        // Check if agent is enabled
        const marketEnabled = isAgentEnabled('market');
        
        if (!marketEnabled) {
          console.log('[Agent Control] Market agent is disabled');
          return res.status(200).json({ 
            success: false, 
            message: null,
            agent: 'market',
            error: 'Agent disabled'
          });
        }
        
        if (marketEnabled === 'mock') {
          response = getMockResponse('market');
          console.log('[Agent Control] Market agent returning mock response');
        } else {
          // Market Analyst uses OpenAI
          if (!openaiKey) {
            console.log('OpenAI key not found, skipping Market agent');
            return res.status(200).json({ 
              success: false, 
              message: null,
              agent: 'market',
              error: 'API key not configured'
            });
          }
          
          // Log the API call
          logApiCall('market', context);
          response = await callMarketAnalyst(context, openaiKey);
          logResponse('market', response);
        }
        break;
        
      case 'sentiment':
        // Check if agent is enabled
        const sentimentEnabled = isAgentEnabled('sentiment');
        
        if (!sentimentEnabled) {
          console.log('[Agent Control] Sentiment agent is disabled');
          return res.status(200).json({ 
            success: false, 
            message: null,
            agent: 'sentiment',
            error: 'Agent disabled'
          });
        }
        
        // Check rate limiting (stored in browser, passed from client)
        const lastCallTime = context.lastSentimentCall;
        if (isRateLimited('sentiment', lastCallTime)) {
          console.log('[Agent Control] Sentiment agent is rate limited');
          return res.status(200).json({ 
            success: false, 
            message: null,
            agent: 'sentiment',
            error: 'Rate limited'
          });
        }
        
        if (sentimentEnabled === 'mock') {
          response = getMockResponse('sentiment');
          console.log('[Agent Control] Sentiment agent returning mock response');
        } else {
          // Sentiment Oracle uses Grok
          if (!grokKey) {
            console.log('Grok key not found, skipping Sentiment agent');
            return res.status(200).json({ 
              success: false, 
              message: null,
              agent: 'sentiment',
              error: 'API key not configured'
            });
          }
          
          // Log the API call
          logApiCall('sentiment', context);
          response = await callSentimentOracle(context, grokKey);
          logResponse('sentiment', response);
        }
        break;
        
      case 'macro':
        // Check if agent is enabled
        const macroEnabled = isAgentEnabled('macro');
        
        if (!macroEnabled) {
          console.log('[Agent Control] Macro agent is disabled');
          return res.status(200).json({ 
            success: false, 
            message: null,
            agent: 'macro',
            error: 'Agent disabled'
          });
        }
        
        if (macroEnabled === 'mock') {
          response = getMockResponse('macro');
          console.log('[Agent Control] Macro agent returning mock response');
        } else {
          // Macro Specialist uses Anthropic
          if (!anthropicKey) {
            console.log('Anthropic key not found, skipping Macro agent');
            return res.status(200).json({ 
              success: false, 
              message: null,
              agent: 'macro',
              error: 'API key not configured'
            });
          }
          
          // Log the API call
          logApiCall('macro', context);
          response = await callMacroSpecialist(context, anthropicKey);
          logResponse('macro', response);
        }
        break;
        
      case 'rl80':
        // Check if agent is enabled
        const rl80Enabled = isAgentEnabled('rl80');
        
        if (!rl80Enabled) {
          console.log('[Agent Control] RL80 agent is disabled');
          return res.status(200).json({ 
            success: false, 
            message: null,
            agent: 'rl80',
            error: 'Agent disabled'
          });
        }
        
        if (rl80Enabled === 'mock') {
          response = getMockResponse('rl80');
          console.log('[Agent Control] RL80 agent returning mock response');
        } else {
          // RL80 makes decisions based on team input
          logApiCall('rl80', context);
          response = callRL80Trader(context, lastMessages);
          logResponse('rl80', response);
        }
        break;
        
      default:
        response = 'Unknown agent';
    }

    res.status(200).json({ 
      success: true, 
      message: response,
      agent,
      timestamp: new Date().toLocaleString()
    });
    
  } catch (error) {
    console.error('AI chat error:', error);
    // Return null message instead of fallback
    res.status(200).json({ 
      success: false,
      message: null,
      agent: req.body.agent || 'rl80',
      error: error.message,
      timestamp: new Date().toLocaleString()
    });
  }
}