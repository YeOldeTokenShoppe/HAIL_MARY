// API Route to trigger agent conversations and save to Firebase
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Import agent functions
import { callSentimentOracle } from '../../../trading/agents/sentiment-oracle';
import { callMarketAnalyst } from '../../../trading/agents/market-analyst';
import { callMacroSpecialist } from '../../../trading/agents/macro-specialist';
import { callRL80Trader } from '../../../trading/agents/rl80-trader';

// Firebase config - using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let db;
try {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

// Rate limiting - prevent too frequent calls
const lastCallTimes = {
  TEKNO: 0,
  EMO: 0,
  MACRO: 0,
  RL80: 0
};

const RATE_LIMIT_MS = {
  TEKNO: 120000,    // 2 minutes
  EMO: 180000,      // 3 minutes  
  MACRO: 240000,    // 4 minutes
  RL80: 300000      // 5 minutes
};

async function saveMessageToFirebase(agent, message, type = 'trading', sentiment = 'neutral') {
  if (!db) {
    console.error('Firebase not initialized');
    return null;
  }

  try {
    const docRef = await addDoc(collection(db, 'agentChat'), {
      agent,
      message,
      type,
      sentiment,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    });
    
    console.log(`Saved ${agent} message to Firebase:`, docRef.id);
    return docRef.id;
  } catch (error) {
    console.error(`Failed to save ${agent} message:`, error);
    return null;
  }
}

async function getRecentMessages() {
  if (!db) return [];
  
  try {
    const messagesQuery = query(
      collection(db, 'agentChat'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(messagesQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Failed to get recent messages:', error);
    return [];
  }
}

export async function POST(request) {
  try {
    const { agent, force = false } = await request.json();

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent parameter required'
      }, { status: 400 });
    }

    // Check rate limiting unless force is true
    const now = Date.now();
    const lastCall = lastCallTimes[agent] || 0;
    const rateLimit = RATE_LIMIT_MS[agent] || 120000;

    if (!force && (now - lastCall) < rateLimit) {
      return NextResponse.json({
        success: false,
        error: `Rate limited. Next call allowed in ${Math.ceil((rateLimit - (now - lastCall)) / 1000)} seconds`
      });
    }

    // Get recent messages for context
    const recentMessages = await getRecentMessages();
    const context = {
      recentMessages,
      lastMessages: recentMessages.slice(-5), // For RL80 trader compatibility
      marketData: {
        timestamp: new Date().toISOString(),
        // Mock market data - replace with real data when available
        fearGreed: 45, // Fear & Greed index (0-100)
        fundingRate: 0.01, // Funding rate percentage
        vix: 22.5, // Volatility index
        btcPrice: 95000, // Mock BTC price
        trend: 'sideways' // Mock trend
      }
    };

    let response, messageType, sentiment;

    // Get API keys
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const grokKey = process.env.GROK_API_KEY;

    try {
      switch (agent) {
        case 'TEKNO':
          if (!openaiKey) {
            throw new Error('OpenAI API key not configured');
          }
          response = await callMarketAnalyst(context, openaiKey);
          messageType = 'market';
          sentiment = 'neutral';
          break;

        case 'EMO':
          if (!grokKey) {
            throw new Error('Grok API key not configured');
          }
          response = await callSentimentOracle(context, grokKey);
          messageType = 'sentiment';
          sentiment = 'neutral';
          break;

        case 'MACRO':
          if (!anthropicKey) {
            throw new Error('Anthropic API key not configured');
          }
          response = await callMacroSpecialist(context, anthropicKey);
          messageType = 'macro';
          sentiment = 'neutral';
          break;

        case 'RL80':
          response = await callRL80Trader(context, recentMessages);
          messageType = 'trading';
          sentiment = 'positive';
          break;

        default:
          throw new Error(`Unknown agent: ${agent}`);
      }

      // Validate and save response to Firebase
      if (response && typeof response === 'string' && response.trim().length > 0) {
        const cleanResponse = response.trim();
        const messageId = await saveMessageToFirebase(agent, cleanResponse, messageType, sentiment);
        
        // Update rate limiting
        lastCallTimes[agent] = now;

        return NextResponse.json({
          success: true,
          agent,
          message: cleanResponse,
          messageId,
          type: messageType,
          sentiment,
          timestamp: new Date().toISOString()
        });
      } else {
        const errorMsg = `${agent} returned empty response. Response type: ${typeof response}, Value: ${JSON.stringify(response)}`;
        throw new Error(errorMsg);
      }

    } catch (agentError) {
      console.error(`${agent} agent error:`, agentError);
      
      // Save error message to Firebase for debugging
      const errorMessage = `⚠️ Agent temporarily unavailable: ${agentError.message}`;
      const messageId = await saveMessageToFirebase(agent, errorMessage, 'error', 'warning');
      
      return NextResponse.json({
        success: false,
        agent,
        error: agentError.message,
        messageId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Agent chat service error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// GET endpoint to manually trigger agents or check status
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agent = searchParams.get('agent');
  
  if (agent) {
    // Trigger specific agent
    const response = await POST(new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ agent, force: true })
    }));
    return response;
  }

  // Return status of all agents
  const now = Date.now();
  const status = {};
  
  Object.keys(RATE_LIMIT_MS).forEach(agentName => {
    const lastCall = lastCallTimes[agentName] || 0;
    const rateLimit = RATE_LIMIT_MS[agentName];
    const nextCallTime = lastCall + rateLimit;
    
    status[agentName] = {
      canCall: now >= nextCallTime,
      nextCallIn: Math.max(0, Math.ceil((nextCallTime - now) / 1000)),
      lastCall: lastCall ? new Date(lastCall).toISOString() : null
    };
  });

  return NextResponse.json({
    success: true,
    agents: status,
    timestamp: new Date().toISOString()
  });
}