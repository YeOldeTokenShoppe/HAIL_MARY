// API Route to trigger agent conversations and save to Firebase
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

// Import agent functions
import { callSentimentOracle, callSentimentOracleWithScoring } from '../../../trading/agents/sentiment-oracle';
import { callMarketAnalyst, callMarketAnalystWithScoring } from '../../../trading/agents/market-analyst';
import { callMacroSpecialist, callMacroSpecialistWithScoring } from '../../../trading/agents/macro-specialist';
import { callRL80Trader, generateRL80ScoringDecision } from '../../../trading/agents/rl80-trader';
import { logAnalystScores } from '../../../trading/services/decisionLogger';

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

async function getLiveMarketData() {
  if (!db) return null;

  try {
    // Fetch Firestore data and real macro data in parallel
    const [firestoreData, macroData] = await Promise.all([
      fetchFirestoreData(),
      fetchRealMacroData()
    ]);

    const { marketData, agentContext, lighterAccount, lighterTrading } = firestoreData;

    // No fallback values - agents work with real data only
    return {
      btcPrice: marketData.btcPrice || null,
      ethPrice: marketData.ethPrice || null,
      fearGreed: agentContext.fearGreed ?? null,
      fundingRate: macroData.funding?.btc ?? agentContext.fundingRate ?? null,
      vix: macroData.vix?.value ?? agentContext.vix ?? null,
      dxy: macroData.dxy?.value ?? agentContext.dxy ?? null,
      spx: macroData.spx?.value ?? null,
      treasury10y: macroData.treasury10y?.value ?? null,
      marketSentiment: agentContext.marketSentiment || null,
      trend: agentContext.trend || null,
      timestamp: new Date().toISOString(),
      lastUpdate: marketData.lastUpdate || agentContext.lastUpdate || null,
      // Add Lighter trading data for agents
      trading: {
        balance: lighterAccount.balance ?? 0,
        positions: lighterTrading.positions || [],
        orders: lighterTrading.orders || [],
        positionCount: lighterTrading.positionCount ?? 0,
        orderCount: lighterTrading.orderCount ?? 0
      }
    };

  } catch (error) {
    console.error('Failed to get live market data:', error);
    // Return null values - no fake data
    return {
      btcPrice: null,
      ethPrice: null,
      fearGreed: null,
      fundingRate: null,
      vix: null,
      dxy: null,
      spx: null,
      treasury10y: null,
      marketSentiment: null,
      trend: null,
      timestamp: new Date().toISOString(),
      error: error.message,
      trading: {
        balance: 0,
        positions: [],
        orders: [],
        positionCount: 0,
        orderCount: 0
      }
    };
  }
}

async function fetchFirestoreData() {
  const marketDataRef = doc(db, 'marketData', 'latest');
  const agentContextRef = doc(db, 'agentContext', 'market');
  const lighterAccountRef = doc(db, 'lighterData', 'account');
  const lighterTradingRef = doc(db, 'lighterData', 'trading');

  const [marketDataSnap, agentContextSnap, lighterAccountSnap, lighterTradingSnap] = await Promise.all([
    getDoc(marketDataRef),
    getDoc(agentContextRef),
    getDoc(lighterAccountRef),
    getDoc(lighterTradingRef)
  ]);

  return {
    marketData: marketDataSnap.exists() ? marketDataSnap.data() : {},
    agentContext: agentContextSnap.exists() ? agentContextSnap.data() : {},
    lighterAccount: lighterAccountSnap.exists() ? lighterAccountSnap.data() : {},
    lighterTrading: lighterTradingSnap.exists() ? lighterTradingSnap.data() : {}
  };
}

async function fetchRealMacroData() {
  try {
    // Fetch from internal macro API to get real VIX, DXY, SPX
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/ai/macro`, {
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch real macro data:', error.message);
  }

  // Return empty object if fetch fails - will use Firestore fallbacks
  return {};
}

export async function POST(request) {
  try {
    const {
      agent,
      force = false,
      context: clientContext,
      teamAnalysis,
      isSequentialWorkflow,
      scoringMode = false,
      analystScores = null,
      portfolioState = null
    } = await request.json();

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent parameter required'
      }, { status: 400 });
    }

    // Check rate limiting unless force is true - Updated to hourly intervals
    const now = Date.now();
    const lastCall = lastCallTimes[agent] || 0;
    const rateLimit = 3600000; // 1 hour for sequential workflow

    if (!force && (now - lastCall) < rateLimit) {
      return NextResponse.json({
        success: false,
        error: `Rate limited. Next call allowed in ${Math.ceil((rateLimit - (now - lastCall)) / 1000)} seconds`
      });
    }

    // Get recent messages and live market data for context
    const recentMessages = await getRecentMessages();
    const liveMarketData = await getLiveMarketData();
    
    const context = {
      recentMessages,
      lastMessages: recentMessages.slice(-5), // For RL80 trader compatibility
      marketData: liveMarketData,
      ...clientContext // Merge any additional context from client
    };

    console.log(`[${scoringMode ? 'Scoring' : 'Sequential'} Workflow] ${agent} triggered with context:`, {
      btcPrice: liveMarketData.btcPrice,
      fearGreed: liveMarketData.fearGreed,
      hasTeamAnalysis: !!teamAnalysis,
      isSequentialWorkflow,
      scoringMode
    });

    let response, messageType, sentiment, scoreOutput = null, decisionOutput = null;

    // Get API keys
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const grokKey = process.env.GROK_API_KEY;

    try {
      switch (agent) {
        case 'TEKNO':
        case 'market':
          if (!openaiKey) {
            throw new Error('OpenAI API key not configured');
          }
          if (scoringMode) {
            // Scoring mode: return structured scores
            scoreOutput = await callMarketAnalystWithScoring(context, openaiKey);
            response = scoreOutput.textResponse;
            // Log scores to Firebase
            await logAnalystScores(scoreOutput);
          } else {
            response = await callMarketAnalyst(context, openaiKey);
          }
          messageType = 'market';
          sentiment = 'neutral';
          break;

        case 'EMO':
        case 'sentiment':
          if (!grokKey) {
            throw new Error('Grok API key not configured');
          }
          if (scoringMode) {
            scoreOutput = await callSentimentOracleWithScoring(context, grokKey);
            response = scoreOutput.textResponse;
            await logAnalystScores(scoreOutput);
          } else {
            response = await callSentimentOracle(context, grokKey);
          }
          messageType = 'sentiment';
          sentiment = 'neutral';
          break;

        case 'MACRO':
        case 'macro':
          if (!anthropicKey) {
            throw new Error('Anthropic API key not configured');
          }
          if (scoringMode) {
            scoreOutput = await callMacroSpecialistWithScoring(context, anthropicKey);
            response = scoreOutput.textResponse;
            await logAnalystScores(scoreOutput);
          } else {
            response = await callMacroSpecialist(context, anthropicKey);
          }
          messageType = 'macro';
          sentiment = 'neutral';
          break;

        case 'RL80':
        case 'rl80':
          if (scoringMode && analystScores) {
            // Scoring mode: generate decision from analyst scores
            console.log('🧠 RL80 processing scoring mode with analyst scores');
            decisionOutput = await generateRL80ScoringDecision(
              context,
              analystScores,
              portfolioState || {}
            );
            response = decisionOutput.textResponse;
          } else if (isSequentialWorkflow && teamAnalysis) {
            console.log('🧠 RL80 processing team analysis from sequential workflow');
            response = await callRL80Trader(context, recentMessages, teamAnalysis);
          } else {
            response = await callRL80Trader(context, recentMessages);
          }
          messageType = 'trading';
          sentiment = 'positive';
          break;

        default:
          throw new Error(`Unknown agent: ${agent}`);
      }

      // Validate response
      const textResponse = response && typeof response === 'string' ? response.trim() : '';

      if (textResponse.length > 0 || scoreOutput || decisionOutput) {
        const cleanResponse = textResponse || `${agent} analysis complete.`;
        const messageId = await saveMessageToFirebase(agent, cleanResponse, messageType, sentiment);

        // Update rate limiting
        lastCallTimes[agent] = now;

        // Build response object
        const responseData = {
          success: true,
          agent,
          message: cleanResponse,
          messageId,
          type: messageType,
          sentiment,
          timestamp: new Date().toISOString(),
          isSequentialWorkflow,
          scoringMode
        };

        // Include scoring data if available
        if (scoreOutput) {
          responseData.scores = scoreOutput.scores;
          responseData.scoreOutput = scoreOutput;
        }

        // Include decision data if available
        if (decisionOutput) {
          responseData.decision = {
            recommendations: decisionOutput.tradeableRecommendations,
            summary: decisionOutput.summary,
            aggregatedScores: decisionOutput.aggregatedScores,
            shadowComparison: decisionOutput.shadowComparison
          };
          responseData.decisionOutput = decisionOutput;
        }

        return NextResponse.json(responseData);
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
        timestamp: new Date().toISOString(),
        scoringMode
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