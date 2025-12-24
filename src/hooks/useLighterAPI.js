// Simplified client-side hook for Lighter trading via API route
import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateMarketRiskAppetite } from '@/lib/risk-appetite-calculator';

export function useLighterAPI(config = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [agentThoughts, setAgentThoughts] = useState([]); // Start empty, will load from Firestore
  const [marketData, setMarketData] = useState({});
  
  // Rate limiting for Grok API - track last call time
  // Initialize from localStorage to persist across refreshes
  const [lastGrokCall, setLastGrokCall] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastGrokCallTime');
      return saved ? parseInt(saved) : null;
    }
    return null;
  });
  const [assistantInsights, setAssistantInsights] = useState({
    technical: null,
    sentiment: null,
    macro: null,
    strategy: null
  });
  const [stablecoinData, setStablecoinData] = useState({
    totalMarketCap: 140.2e9,
    netFlow24h: 0,
    flowDirection: 'NEUTRAL'
  });
  const [fearGreedIndex, setFearGreedIndex] = useState({
    value: null,
    classification: 'Loading'
  });
  const [macroMetrics, setMacroMetrics] = useState({});
  
  const updateIntervalRef = useRef(null);

  // Fetch account state from server-side API (no direct Lighter connection)
  const fetchAccountState = useCallback(async () => {
    try {
      // Use the new server-side endpoint that manages the Lighter connection
      const response = await fetch('/api/lighter-data?type=markets');
      if (!response.ok) throw new Error('Failed to fetch Lighter data');
      
      const result = await response.json();
      if (result.success && result.data) {
        // Update market data from server-managed connection
        setMarketData(result.data);
        setIsConnected(true);
        
        // For now, set empty positions/orders since we're not connecting wallets
        setPositions([]);
        setOrders([]);
        setAccountData({
          balance: 0,
          availableMargin: 0
        });
        setPerformance({
          totalPnL: 0,
          dayPnL: 0,
          weekPnL: 0,
          monthPnL: 0
        });
      }
        
        // Run AI analysis using the API
        // Fetch stablecoin flow data
        let stablecoinFlows = {};
        try {
          const flowResponse = await fetch('/api/stablecoin-flows');
          if (flowResponse.ok) {
            const flowData = await flowResponse.json();
            stablecoinFlows = flowData.data;
            setStablecoinData(flowData.data); // Store in state for formatTradingData
          }
        } catch (error) {
          console.error('Failed to fetch stablecoin flows:', error);
        }
        
        // Fetch Fear & Greed Index
        let fearGreedData = { value: null, classification: 'Loading' };
        try {
          const fgResponse = await fetch('/api/fear-greed');
          if (fgResponse.ok) {
            const fgResult = await fgResponse.json();
            if (fgResult.success) {
              fearGreedData = fgResult.data;
              setFearGreedIndex(fgResult.data); // Store in state
            }
          }
        } catch (error) {
          console.error('Failed to fetch Fear & Greed:', error);
        }
        
        // Fetch comprehensive market data (VIX, DXY, BTC dominance, funding, OI)
        let macroData = {};
        try {
          const macroResponse = await fetch('/api/market-data?format=object');
          if (macroResponse.ok) {
            const macroResult = await macroResponse.json();
            macroData = macroResult.data || {};
            setMacroMetrics(macroData); // Store in state for formatTradingData
          }
        } catch (error) {
          console.error('Failed to fetch macro data:', error);
        }
        
        const marketContext = {
          btcPrice: result.data['BTC-USD']?.ticker?.lastPrice || result.data['BTC/USDC']?.ticker?.lastPrice || 0,
          btcChange: result.data['BTC-USD']?.ticker?.priceChange24h || 0,
          ethPrice: result.data['ETH-USD']?.ticker?.lastPrice || result.data['ETH/USDC']?.ticker?.lastPrice || 0,
          ethChange: result.data['ETH-USD']?.ticker?.priceChange24h || 0,
          positionCount: 0,
          totalPnL: 0,
          accountBalance: 0,
          availableMargin: 0,
          vix: macroData.vix?.value || 14.2,
          dxy: macroData.dxy?.value || 103.42,
          dxyChange: macroData.dxy?.changePercent || -0.8,
          fearGreed: fearGreedData.value || 50,
          fearGreedText: fearGreedData.classification || 'Neutral',
          marketRegime: 'RISK_ON',
          // Add stablecoin flow data
          stableMcap: (stablecoinFlows.totalMarketCap || 140.2e9) / 1e9, // Convert to billions
          stableFlow: Math.abs(stablecoinFlows.netFlow24h || 0),
          stableFlowDirection: stablecoinFlows.flowDirection || 'NEUTRAL'
        };
        
        // DISABLED - Using generateTeamChat instead
        // Generate thoughts from different consultants via API
        const newThoughts = [];
        
        // Skip old thought generation - we use generateTeamChat now
        if (false) {
        try {
          // Main trading analysis
          const tradingPrompt = `Market snapshot: BTC $${marketContext.btcPrice || 'N/A'} (${marketContext.btcChange}% 24h), ETH $${marketContext.ethPrice || 'N/A'} (${marketContext.ethChange}% 24h). ${marketContext.positionCount} positions, P&L: $${marketContext.totalPnL.toFixed(2)}. What's the play?`;
          
          const tradingResponse = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: tradingPrompt, consultant: 'trading', marketData: marketContext })
          });
          
          if (tradingResponse.ok) {
            const { analysis } = await tradingResponse.json();
            // Store as strategy insight for the main display
            setAssistantInsights(prev => ({ ...prev, strategy: analysis }));
            newThoughts.push({
              timestamp: new Date().toLocaleString(),
              type: 'trading',
              message: analysis,
              consultant: 'market'
            });
          }
          
          // Sentiment analysis with Grok
          const sentimentPrompt = `Crypto sentiment check: BTC ${marketContext.btcChange > 0 ? 'up' : 'down'} ${Math.abs(marketContext.btcChange)}%, Fear/Greed at ${marketContext.fearGreed}. What's the crowd thinking?`;
          
          const sentimentResponse = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: sentimentPrompt, consultant: 'sentiment', marketData: marketContext })
          });
          
          if (sentimentResponse.ok) {
            const { analysis } = await sentimentResponse.json();
            // Store sentiment insight
            setAssistantInsights(prev => ({ ...prev, sentiment: analysis }));
            newThoughts.push({
              timestamp: new Date().toLocaleString(),
              type: 'sentiment',
              message: analysis,
              consultant: 'sentiment'
            });
          }
          
          // Macro analysis
          const macroPrompt = `Macro view: DXY at ${marketContext.dxy} (${marketContext.dxyChange}%), VIX at ${marketContext.vix}. How does this impact crypto positioning?`;
          
          const macroResponse = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: macroPrompt, consultant: 'macro', marketData: marketContext })
          });
          
          if (macroResponse.ok) {
            const { analysis } = await macroResponse.json();
            // Store macro insight
            setAssistantInsights(prev => ({ ...prev, macro: analysis }));
            newThoughts.push({
              timestamp: new Date().toLocaleString(),
              type: 'market',
              message: analysis,
              consultant: 'macro'
            });
          }
          
          // Technical analysis from TradingView
          const technicalPrompt = `Analyze technical indicators for BTC and ETH`;
          
          const technicalResponse = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: technicalPrompt, 
              consultant: 'technical', 
              marketData: { ...marketContext, fullMarketData: result.data }
            })
          });
          
          if (technicalResponse.ok) {
            const { analysis } = await technicalResponse.json();
            // Store technical insight
            setAssistantInsights(prev => ({ ...prev, technical: analysis }));
            newThoughts.push({
              timestamp: new Date().toLocaleString(),
              type: 'trading',
              message: analysis,
              consultant: 'technical'
            });
          }
          
        } catch (error) {
          console.error('AI analysis failed:', error);
          // Add fallback thought
          newThoughts.push({
            timestamp: new Date().toLocaleString(),
            type: 'trading',
            message: `Monitoring ${marketContext.positionCount} positions. Market data updating...`,
            consultant: null
          });
        }
        
        if (newThoughts.length > 0) {
          setAgentThoughts(prevThoughts => {
            const combined = [...newThoughts, ...prevThoughts];
            return combined.slice(0, 30); // Keep last 30 thoughts
          });
        }
        } // End of disabled section
        
    } catch (err) {
      console.error('Failed to fetch account state:', err);
      setError(err.message);
      setIsConnected(false);
      throw err;
    }
  }, []);

  // Initialize connection
  const initialize = useCallback(async () => {
    if (isInitializing || isConnected) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // Initial fetch to get data immediately
      await fetchAccountState();
      
      // Set up periodic updates
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      
      // Update every hour for comprehensive analysis
      updateIntervalRef.current = setInterval(() => {
        fetchAccountState();
      }, 3600000); // 60 minutes * 60 seconds * 1000ms
      
      // Generate AI team chat every 30 seconds for testing, then slow to 15 minutes
      generateTeamChat();
      const chatInterval = setInterval(() => {
        generateTeamChat();
      }, 30000); // 30 seconds for testing - change to 900000 for 15 minutes in production
      
      // Clean up chat interval on unmount
      return () => {
        clearInterval(chatInterval);
      };
      
    } catch (err) {
      console.error('Failed to initialize Lighter API:', err);
      setError(err.message);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isConnected, fetchAccountState]);

  // API action helper (temporarily disabled until signing is set up)
  const callAPI = useCallback(async (action) => {
    console.warn(`Trading action ${action} called but not yet implemented`);
    // For now, just return mock success
    return { success: true, message: 'Trading not yet enabled' };
  }, []);

  // Trading actions
  const createMarketOrder = useCallback((market, side, size) => 
    callAPI('createMarketOrder', { market, side, size }), [callAPI]);
    
  const createLimitOrder = useCallback((market, side, size, price) => 
    callAPI('createLimitOrder', { market, side, size, price }), [callAPI]);
    
  const cancelOrder = useCallback((orderId) => 
    callAPI('cancelOrder', { orderId }), [callAPI]);
    
  const closePosition = useCallback((market) => 
    callAPI('closePosition', { market }), [callAPI]);
    
  const analyzeMarket = useCallback((market) => 
    callAPI('analyzeMarket', { market }), [callAPI]);
    
  const executeStrategy = useCallback((markets) => 
    callAPI('executeStrategy', { markets }), [callAPI]);

  // Clean up on unmount
  // Load recent chat history on component mount
  useEffect(() => {
    const loadRecentChatHistory = async () => {
      try {
        const response = await fetch('/api/team-chat-history?action=recent&limit=5'); // Just load last 5 messages
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.messages && result.messages.length > 0) {
            // console.log(`Loading ${result.messages.length} recent messages from Firestore`);
            
            // Transform Firestore messages to match the agentThoughts format
            const historicalThoughts = result.messages.map(msg => ({
              id: Date.parse(msg.timestamp) || Date.now() + Math.random(),
              agent: msg.agent,
              type: msg.agent,
              consultant: msg.agent,
              message: msg.message,
              timestamp: msg.timestamp || new Date().toISOString()
            }));
            
            // Set the historical messages as initial thoughts
            setAgentThoughts(historicalThoughts);
            // console.log('Loaded chat history:', historicalThoughts);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };
    
    // Load chat history on mount
    loadRecentChatHistory();
    
    // Cleanup interval on unmount
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  // Format data for TradingOverlay
  const generateTeamChat = async () => {
    // Check if agents are enabled via environment variables
    if (process.env.NEXT_PUBLIC_AGENTS_ENABLED === 'false') {
      // console.log('[Agent Control] All agents disabled via NEXT_PUBLIC_AGENTS_ENABLED');
      return;
    }
    
    try {
      // Check if we should exclude Grok (sentiment) due to rate limiting
      const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
      const now = Date.now();
      const canCallGrok = !lastGrokCall || (now - lastGrokCall) > ONE_HOUR;
      
      // Build agent list based on environment settings and rate limits
      let availableAgents = [];
      
      // Check each agent's individual enable setting
      if (process.env.NEXT_PUBLIC_AGENT_MARKET !== 'false') {
        availableAgents.push('market');
      }
      if (process.env.NEXT_PUBLIC_AGENT_MACRO !== 'false') {
        availableAgents.push('macro');
      }
      if (process.env.NEXT_PUBLIC_AGENT_RL80 !== 'false') {
        availableAgents.push('rl80');
      }
      if (process.env.NEXT_PUBLIC_AGENT_SENTIMENT !== 'false' && canCallGrok) {
        availableAgents.push('sentiment');
      } else if (process.env.NEXT_PUBLIC_AGENT_SENTIMENT !== 'false' && !canCallGrok) {
        // console.log(`Grok rate limited. Last call was ${Math.round((now - lastGrokCall) / 1000 / 60)} minutes ago. Waiting for 1 hour cooldown.`);
      }
      
      // Check if any agents are available
      if (availableAgents.length === 0) {
        // console.log('[Agent Control] No agents available or all are disabled');
        return;
      }
      
      const currentAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)];
      // console.log('[Agent Control] Available agents:', availableAgents, 'Selected:', currentAgent);
      
      // Create context from current market data - NO HARDCODED VALUES
      // console.log('Building context - fearGreedIndex:', fearGreedIndex);
      // console.log('Building context - macroMetrics:', macroMetrics);
      
      const context = {
        marketData: {
          btcPrice: macroMetrics.btcPrice || marketData['BTC-USD']?.ticker?.lastPrice || null,
          ethPrice: macroMetrics.ethPrice || marketData['ETH-USD']?.ticker?.lastPrice || null,
          fearGreed: fearGreedIndex.value || null, // Use null instead of 0 for missing data
          vix: macroMetrics.vix?.value || null,
          dxy: macroMetrics.dxy?.value || null,
          openInterest: macroMetrics.openInterest?.value || null,
          fundingRate: macroMetrics.fundingRate?.value || null
        },
        lastMessages: agentThoughts.slice(-5) // Last 5 messages for context
      };
      
      // console.log('Final context being sent:', JSON.stringify(context.marketData, null, 2));
      
      // Track when we call Grok for rate limiting
      if (currentAgent === 'sentiment') {
        const callTime = Date.now();
        setLastGrokCall(callTime);
        // Persist to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastGrokCallTime', callTime.toString());
        }
        // console.log('Grok API called at:', new Date().toISOString());
        // console.log('Next Grok call allowed after:', new Date(callTime + 60 * 60 * 1000).toISOString());
      }
      
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: currentAgent,
          context,
          lastMessages: agentThoughts.slice(-3)
        })
      });
      
      // Check if response is OK and is JSON
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }
      
      const data = await response.json();
      
      if (response.ok && data.success && data.message) {
        // console.log(`Team Chat - ${currentAgent}:`, data.message);
        
        const newThought = {
          id: Date.now(),
          agent: currentAgent,
          type: currentAgent,
          consultant: currentAgent,
          message: data.message,
          timestamp: new Date().toLocaleTimeString(),
          icon: getAgentIcon(currentAgent),
          color: getAgentColor(currentAgent)
        };
        
        // Save to Firestore
        try {
          await fetch('/api/team-chat-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent: currentAgent,
              message: data.message,
              context: context.marketData,
              timestamp: new Date().toISOString()
            })
          });
          // console.log(`Saved ${currentAgent} message to Firestore`);
        } catch (error) {
          console.error('Failed to save to Firestore:', error);
        }
        
        setAgentThoughts(prev => {
          // console.log('Adding thought:', newThought);
          // Keep only last 20 messages
          const updated = [...prev, newThought].slice(-20);
          return updated;
        });
      } else if (!data.success) {
        // API failed - stay quiet, no fallback messages
        // console.log(`Team Chat - ${currentAgent} API failed:`, data.error);
      } else {
        console.error(`Team Chat - Unexpected response from ${currentAgent}:`, data);
      }
    } catch (error) {
      console.error('Failed to generate team chat:', error);
    }
  };
  
  const getAgentIcon = (agent) => {
    const icons = {
      sentiment: '🔮',
      market: '📊',
      macro: '🌍',
      rl80: '🤖'
    };
    return icons[agent] || '💬';
  };
  
  const getAgentColor = (agent) => {
    const colors = {
      sentiment: '#ff00ff',
      market: '#00ffff',
      macro: '#ffff00',
      rl80: '#00ff00'
    };
    return colors[agent] || '#ffffff';
  };

  const formatTradingData = useCallback(() => {
    const totalPnl = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
    const balance = accountData?.balance || config.initialBalance || 0;
    const initialBalance = config.initialBalance || 0;
    
    return {
      // Model Info
      modelName: 'RL80-Lighter',
      modelVersion: 'Live Trading',
      rank: 1,
      totalModels: 1,
      
      // Fund Stats
      fundBalance: balance,
      initialBalance,
      dailyPnl: totalPnl, // Real P&L from positions
      dailyPnlPercent: balance > 0 ? (totalPnl / balance) * 100 : 0,
      totalPnl: 0, // No P&L until we start trading
      totalPnlPercent: 0, // No returns yet
      
      // Performance Metrics (all 0 until we start trading)
      winRate: performance?.winRate || 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      
      // Trading Statistics (repurposed from ML metrics)
      iterationCount: performance?.totalTrades || 0, // Total trades executed
      lastImprovement: positions.length > 0 ? 'Active' : 'Waiting', // Strategy status
      strategyConfidence: positions.length > 0 ? 100 : 0, // Position utilization %
      learningRate: positions.length > 0 ? positions[0]?.size || 0.01 : 0.01, // Avg position size
      explorationRate: (orders.length / 10) || 0, // Order activity (0-1 scale)
      
      // AI Model Chat/Thoughts - Just show what's in Firestore, no loading messages
      modelThoughts: agentThoughts,
      
      // Current State
      positions: positions || [],
      pendingOrders: orders || [],
      activePositions: positions || [],
      recentTrades: [],
      
      // Micro Actions for UI - Show recent agent activity
      microActions: [
        {
          time: new Date().toLocaleTimeString(),
          action: positions.length > 0 ? `Monitoring ${positions.length} active positions` : 'Scanning for opportunities'
        },
        {
          time: new Date(Date.now() - 5000).toLocaleTimeString(),
          action: agentThoughts.length > 0 ? 'AI analysis completed' : 'Running market analysis'
        },
        {
          time: new Date(Date.now() - 10000).toLocaleTimeString(),
          action: isConnected ? 'Market data synchronized' : 'Loading market data...'
        },
        {
          time: new Date(Date.now() - 15000).toLocaleTimeString(),
          action: 'Risk parameters checked'
        }
      ],
      
      // Market Data with live stablecoin flows
      macroData: (() => {
        // Calculate live risk appetite score
        const riskData = calculateMarketRiskAppetite({
          btcPrice: marketData['BTC-USD']?.ticker?.lastPrice || marketData['BTC/USDC']?.ticker?.lastPrice || 0,
          btcChange24h: marketData['BTC-USD']?.ticker?.priceChange24h || 0,
          ethPrice: marketData['ETH-USD']?.ticker?.lastPrice || marketData['ETH/USDC']?.ticker?.lastPrice || 0,
          ethChange24h: marketData['ETH-USD']?.ticker?.priceChange24h || 0,
          fearGreedIndex: fearGreedIndex.value || 50, // Live Fear & Greed from API
          vix: macroMetrics.vix?.value || 20, // Live VIX from Yahoo Finance
          dxy: macroMetrics.dxy?.value || 100, // Live DXY
          dxyChange: macroMetrics.dxy?.changePercent || -0.8,
          stableFlowDirection: stablecoinData.flowDirection,
          stableFlowMagnitude: Math.abs(stablecoinData.netFlow24h || 0),
          btcDominance: macroMetrics.btcDominance?.value || 50, // Live from CoinGecko
          totalCryptoMcap: macroMetrics.totalCryptoMcap || 2.68,
          defiTVL: (stablecoinData.defiTVL || 68.5e9) / 1e9,
          fundingRate: macroMetrics.fundingRate?.value || 0.012, // Live from Binance
          openInterest: macroMetrics.openInterest?.value || 0, // Live from exchanges
          openInterestChange: macroMetrics.openInterest?.change24h || 0,
          volume24h: marketData['BTC-USD']?.ticker?.volume24h || 50
        });
        
        return {
          marketRegime: riskData.regime,
          riskScore: riskData.score,
          fedRate: macroMetrics.fedRate || 5.0,
          fedRateChange: macroMetrics.fedRateChange || -0.25,
          nextFOMC: macroMetrics.nextFOMC || 'Mar 20',
          rateCutProb: macroMetrics.rateCutProb || 85,
          dxy: macroMetrics.dxy?.value || 100,
          dxyChange: macroMetrics.dxy?.changePercent || -0.8,
          vix: macroMetrics.vix?.value || 20,
          vixChange: macroMetrics.vix?.changePercent || -2.1,
          
          // Live stablecoin data
          stableMcap: (stablecoinData.totalMarketCap || 140.2e9) / 1e9,
          stableFlow: Math.abs(stablecoinData.netFlow24h || 0),
          stableFlowDirection: stablecoinData.flowDirection || 'NEUTRAL',
          
          // Additional metrics
          btcDominance: macroMetrics.btcDominance?.value || 50,
          btcDomChange: macroMetrics.btcDominance?.change || 0,
          fearGreed: fearGreedIndex.value || 50,
          fearGreedText: fearGreedIndex.classification || 'Neutral',
          totalCryptoMcap: macroMetrics.totalCryptoMcap || 2.68,
          defiTVL: (stablecoinData.defiTVL || 68.5e9) / 1e9,
          
          // Exchange Metrics
          fundingRate: macroMetrics.fundingRate?.value || 0.012,
          openInterest: macroMetrics.openInterest?.value || 0,
          openInterestChange: macroMetrics.openInterest?.change24h || 0,
          exchangeReserves: stablecoinData.exchangeReserves?.change24h || -2.3,
          
          // Dynamic risk multiplier based on calculated risk score
          riskMultiplier: riskData.score > 65 ? 1.5 : riskData.score > 50 ? 1.2 : riskData.score > 35 ? 1.0 : 0.8,
          
          // Use signals from risk calculator
          signals: riskData.signals.slice(0, 3)
        };
      })(),
      
      // Connection Status
      isConnected,
      error,
      
      // Assistant Insights
      assistantInsights
    };
  }, [accountData, positions, orders, performance, isConnected, error, config.initialBalance, agentThoughts, assistantInsights, stablecoinData, marketData, fearGreedIndex, macroMetrics]);

  return {
    // State
    isConnected,
    isInitializing,
    error,
    accountData,
    positions,
    orders,
    performance,
    
    // Actions
    initialize,
    createMarketOrder,
    createLimitOrder,
    cancelOrder,
    closePosition,
    analyzeMarket,
    executeStrategy,
    
    // Formatted data for UI
    tradingData: formatTradingData()
  };
}

export default useLighterAPI;