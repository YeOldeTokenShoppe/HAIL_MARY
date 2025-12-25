import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRandomCandles } from '@/lib/utils/useRandomCandles';
import CompactCandleModal from '@/components/CompactCandleModal';
import NotificationBadge from '@/components/NotificationBadge';
import TradingCardsDisplay from '@/components/TradingCardsDisplay';
import PerformanceDashboard from '../PerformanceDashboard';
import { useUser } from '@clerk/nextjs';
import { db, collection, onSnapshot, query, orderBy, limit } from '@/lib/firebaseClient';

// Dynamically import SingleCandleDisplay to avoid SSR issues with Three.js
const SingleCandleDisplay = dynamic(() => import('../displays/SingleCandleDisplay'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '280px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: '#666'
    }}>
      Loading 3D...
    </div>
  )
});

const TradingOverlay = ({ show = false, data = null, isConnected = false, onModalStateChange = null, onNavigationClick = null }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [activeTab, setActiveTab] = useState(null); // for mobile view - start with no tab selected
  const [desktopPositionsTab, setDesktopPositionsTab] = useState('positions'); // for desktop tabbed interface
  const [mainTab, setMainTab] = useState('overview'); // main tabs: overview, chat
  const [leftPanelTab, setLeftPanelTab] = useState('performance'); // tabs for left panel - default to performance dashboard
  const [rightTopTab, setRightTopTab] = useState('macro'); // tabs for top right panel
  const [showMobileMenu, setShowMobileMenu] = useState(false); // for mobile menu display
  const [candleTab, setCandleTab] = useState('community'); // 'mine' or 'community'
  const [userCandle, setUserCandle] = useState(null); // User's own candle data
  const [showAddCandleModal, setShowAddCandleModal] = useState(false); // Modal for adding user's candle
  const [showCompactCandleModal, setShowCompactCandleModal] = React.useState(false); // Modal for CompactCandleModal
  const [showSingleCandleDisplay, setShowSingleCandleDisplay] = useState(false); // For showing the petite SingleCandleDisplay
  
  // Notification states for all buttons
  const [notifications, setNotifications] = useState({
    trades: 0,      // For 📊 Trading Data & Positions
    messages: 0,    // For 💬 Team Chat
    analyses: 0,    // For 🤖 AI Traders
    candles: 0      // For 🕯️ Candlelaria
  });
  
  // Track the last seen candle timestamp to detect new ones
  const lastCandleTimestamp = useRef(null);
  
  // Simulate notifications for demo (remove in production)
  // DISABLED - Fake notifications turned off
  /*
  useEffect(() => {
    if (!show) return;
    
    // Simulate random notifications
    const notificationInterval = setInterval(() => {
      const rand = Math.random();
      if (rand < 0.3) {
        // New trade notification
        setNotifications(prev => ({ 
          ...prev, 
          trades: Math.min(prev.trades + 1, 99) 
        }));
      } else if (rand < 0.6) {
        // New message notification
        setNotifications(prev => ({ 
          ...prev, 
          messages: Math.min(prev.messages + 1, 99) 
        }));
      } else if (rand < 0.8) {
        // New analysis notification
        setNotifications(prev => ({ 
          ...prev, 
          analyses: Math.min(prev.analyses + 1, 99) 
        }));
      }
    }, 5000); // Every 5 seconds
    
    return () => clearInterval(notificationInterval);
  }, [show]);
  */
  
  // Debug initial state
  // console.log('TradingOverlay initial render, showCompactCandleModal:', showCompactCandleModal);
  
  // Get user info from Clerk
  const { user, isSignedIn } = useUser();
  
  // Monitor Firestore for new candles
  useEffect(() => {
    // Check if Firebase is properly initialized
    if (!db || !db._delegate) {
      console.warn("Firebase Firestore not properly initialized. Skipping candle listener.");
      return;
    }
    
    try {
      // Query to get the most recent candles
      const candlesQuery = query(
        collection(db, 'candles'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(candlesQuery, (snapshot) => {
        if (!snapshot.empty) {
          const latestCandle = snapshot.docs[0].data();
          const latestTimestamp = latestCandle.createdAt?.toMillis?.() || latestCandle.createdAt;
          
          // Check if this is a new candle (not the initial load)
          if (lastCandleTimestamp.current && latestTimestamp > lastCandleTimestamp.current) {
            // New candle detected - increment notification
            setNotifications(prev => ({
              ...prev,
              candles: Math.min(prev.candles + 1, 99)
            }));
          }
          
          // Update the last seen timestamp
          lastCandleTimestamp.current = latestTimestamp;
        }
      }, (error) => {
        console.error('Error monitoring candles:', error);
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up candle listener:', error);
    }
  }, []);
  
  // Get random selection of candles (user's + random community candles)
  const firestoreResults = useRandomCandles(25); // Get max 25 candles total
  // // console.log('TradingOverlay firestoreResults from candles collection:', firestoreResults);
  const [candleIndex, setCandleIndex] = useState(0);
  const [userCandleIndex, setUserCandleIndex] = useState(0);
  
  // Filter user's candles
  const userCandles = useMemo(() => {
    // // console.log('userCandles useMemo called');
    // // console.log('isSignedIn:', isSignedIn);
    // // console.log('user:', user);
    // // console.log('firestoreResults length:', firestoreResults?.length);
    
    if (!isSignedIn || !user || !firestoreResults) {
      // // console.log('Returning empty array - missing requirements');
      return [];
    }
    
    // // console.log('Filtering user candles...');
    // // console.log('Current user:', user);
    // // console.log('All firestore candles:', firestoreResults);
    
    // Simply filter by the isUserCandle flag already set by useRandomCandles
    return firestoreResults.filter(candle => candle.isUserCandle === true);
  }, [firestoreResults, user, isSignedIn]);
  
  // Current user candle for display
  const currentUserCandle = useMemo(() => {
    if (userCandles.length === 0) return null;
    return userCandles[userCandleIndex % userCandles.length];
  }, [userCandles, userCandleIndex]);
  
  // Rotate through different candles more frequently
  useEffect(() => {
    if (firestoreResults && firestoreResults.length > 0) {
      const interval = setInterval(() => {
        setCandleIndex(prev => (prev + 1) % firestoreResults.length);
      }, 10000); // Change every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [firestoreResults]);

  
  // Select user based on current index
  const randomFirestoreData = useMemo(() => {
    if (firestoreResults && firestoreResults.length > 0) {
      return firestoreResults[candleIndex % firestoreResults.length];
    }
    return null;
  }, [firestoreResults, candleIndex]);
  
  // Initialize with minimal default data structure
  const getDefaultData = () => ({
    // Model Info
    modelName: 'RL80-Lighter',
    modelVersion: 'Initializing...',
    rank: 0,
    totalModels: 1,
    
    // Fund Stats - all zeros until connected
    fundBalance: 0,
    initialBalance: 0,
    dailyPnl: 0,
    dailyPnlPercent: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    
    // Performance Metrics - zeros until we have real data
    winRate: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    
    // Strategy Evolution
    iterationCount: 0,
    lastImprovement: 'Waiting...',
    strategyConfidence: 0,
    learningRate: 0,
    explorationRate: 0,
    
    // AI Model Chat/Thoughts - Start empty, will load from Firestore
    modelThoughts: [],
    
    // Mini-Assistant Consultants - Initialize with inactive status
    consultants: {
      market: {
        name: 'Market Analyst',
        icon: '📊',
        status: 'inactive',
        confidence: 0,
        lastSignal: 'WAITING',
        contribution: 0
      },
      macro: {
        name: 'Macro Specialist',
        icon: '🌍',
        status: 'inactive',
        confidence: 0,
        lastSignal: 'WAITING',
        contribution: 0
      },
      sentiment: {
        name: 'Sentiment Oracle',
        icon: '💭',
        status: 'inactive',
        confidence: 0,
        lastSignal: 'WAITING',
        contribution: 0
      }
    },
    
    // Community - zeros until connected
    stakersCount: 0,
    tvl: 0,
    apy: 0,
    performanceScore: 0,
    activePositions: [],
    recentTrades: [],
    nextAnalysis: '--:--:--',
    agentStatus: 'inactive',
    microActions: [],
    winStreak: 0,
    profitMultiplier: 0,
    
    // Macro Economic Data - will be populated from API
    macroData: {
      marketRegime: 'LOADING',
      riskScore: 0,
      fedRate: 0,
      fedRateChange: 0,
      nextFOMC: 'Loading...',
      rateCutProb: 0,
      dxy: 0,
      dxyChange: 0,
      vix: 0,
      vixChange: 0,
      cpi: 0,
      cpiPrev: 0,
      treasury10Y: 0,
      btcDominance: 0,
      btcDomChange: 0,
      fearGreed: 0,
      fearGreedText: 'Loading',
      stableMcap: 0,
      stableFlow: 0,
      stableFlowDirection: 'NEUTRAL',
      totalCryptoMcap: 0,
      defiTVL: 0,
      fundingRate: 0,
      openInterest: 0,
      exchangeReserves: 0,
      riskMultiplier: 1.0,
      signals: ['Loading...']
    }
  });
  
  const [tradingData, setTradingData] = useState(getDefaultData());

  // Update features/trading data when props change
  useEffect(() => {
    if (data && isConnected) {
      // Merge real data from Lighter API with any missing fields
      setTradingData(prevData => ({
        ...prevData,
        ...data,
        // Ensure consultants are properly formatted if they exist in data
        consultants: data.consultants || prevData.consultants,
        // Ensure macro data is properly merged
        macroData: {
          ...prevData.macroData,
          ...(data.macroData || {})
        }
      }));
    } else if (!isConnected) {
      // Reset to default when disconnected
      setTradingData(getDefaultData());
    }
  }, [data, isConnected]);

  // Check for mobile and tablet on mount and resize
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1200);
    };
    
    checkViewport();
    window.addEventListener('resize', checkViewport);
    
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Listen for new agent messages from AgentCollaboration
  useEffect(() => {
    const handleTradingTeamMessage = (event) => {
      const msg = event.detail;
      const newThought = {
        id: `msg_${Date.now()}_${msg.consultant}`,
        agent: msg.consultant,
        type: msg.type || msg.consultant,
        consultant: msg.consultant,
        message: msg.message?.replace('[MOCK] ', ''), // Remove mock prefix if present
        timestamp: new Date(msg.timestamp).toLocaleTimeString(),
        confidence: msg.confidence,
        icon: msg.consultant === 'rl80' ? '🤖' : 
              msg.consultant === 'sentiment' ? '🔮' :
              msg.consultant === 'market' ? '📊' :
              msg.consultant === 'macro' ? '🌍' : '💬',
        color: msg.consultant === 'rl80' ? '#00ff00' :
               msg.consultant === 'sentiment' ? '#ff00ff' :
               msg.consultant === 'market' ? '#0096ff' :
               msg.consultant === 'macro' ? '#ffdd00' : '#888'
      };
      
      setTradingData(prev => ({
        ...prev,
        modelThoughts: [...prev.modelThoughts, newThought].slice(-50) // Keep last 50 messages
      }));
    };
    
    window.addEventListener('features/tradingTeamMessage', handleTradingTeamMessage);
    return () => window.removeEventListener('features/tradingTeamMessage', handleTradingTeamMessage);
  }, []);
  
  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch('/api/team-chat-history?limit=20');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages && data.messages.length > 0) {
            // console.log(`Loaded ${data.messages.length} historical chat messages`);
            
            // Convert historical messages to the format expected by modelThoughts
            const historicalThoughts = data.messages.map(msg => ({
              id: msg.id,
              agent: msg.agent,
              type: msg.agent,
              consultant: msg.agent,
              message: msg.message,
              timestamp: new Date(msg.createdAt || msg.timestamp).toLocaleTimeString(),
              icon: msg.agent === 'rl80' ? '🤖' : 
                    msg.agent === 'sentiment' ? '📊' :
                    msg.agent === 'market' ? '📈' :
                    msg.agent === 'macro' ? '🌍' : '💬',
              color: msg.agent === 'rl80' ? '#00ff00' :
                     msg.agent === 'sentiment' ? '#ff9800' :
                     msg.agent === 'market' ? '#2196f3' :
                     msg.agent === 'macro' ? '#9c27b0' : '#888'
            }));
            
            // Update the features/trading data with historical messages
            setTradingData(prev => ({
              ...prev,
              modelThoughts: [...historicalThoughts, ...prev.modelThoughts]
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };
    
    loadChatHistory();
  }, []);

  // Remove the random data update effect - data should only come from API
  // Real-time updates will come from the Lighter API websocket connection

  if (!show) return null;

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num/1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num/1000).toFixed(1)}K`;
    return num.toFixed(2);
  };


  // Simplified UI with bottom navigation for all screen sizes
  if (show) {
    return (
      <>
        {/* Bottom Navigation Bar */}
        {!activeTab && (
          <div style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '20px',
            display: 'flex',
            gap: '10px',
            zIndex: 1000
          }}>
            {/* Chart Button */}
            <button
              onClick={() => {
                setActiveTab('stats');  // Go directly to stats instead of showing menu
                // Clear trade notifications when viewing
                setNotifications(prev => ({ ...prev, trades: 0 }));
                // Trigger panel collapse callback
                if (onNavigationClick) onNavigationClick();
              }}
              style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.9) 0%, rgba(0, 150, 0, 0.7) 100%)',
                border: '2px solid #00ff00',
                borderRadius: '50%',
                color: '#000',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 25px rgba(0, 255, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace'
              }}
              title="Trading Data & Positions"
            >
              📊
              <NotificationBadge 
                count={notifications.trades}
                color="#ff0041"
                pulse={true}
                position="top-right"
              />
            </button>
            
            {/* Chat Button */}
            <button
              onClick={() => {
                setActiveTab('chat');
                // Clear message notifications when viewing
                setNotifications(prev => ({ ...prev, messages: 0 }));
                // Trigger panel collapse callback
                if (onNavigationClick) onNavigationClick();
              }}
              style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, rgba(255, 0, 255, 0.9) 0%, rgba(150, 0, 150, 0.7) 100%)',
                border: '2px solid #ff00ff',
                borderRadius: '50%',
                color: '#000',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 25px rgba(255, 0, 255, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace'
              }}
              title="Team Chat"
            >
              💬
              <NotificationBadge 
                count={notifications.messages}
                color="#ff0041"
                pulse={true}
                position="top-right"
              />
            </button>
            
            {/* Candle Display Button - Opens SingleCandleDisplay */}
            <button
              onClick={() => {
                setShowSingleCandleDisplay(true);
                // Clear candle notifications when viewing
                setNotifications(prev => ({ ...prev, candles: 0 }));
                // Trigger panel collapse callback
                if (onNavigationClick) onNavigationClick();
              }}
              style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, rgba(255, 136, 0, 0.9) 0%, rgba(200, 100, 0, 0.7) 100%)',
                border: '2px solid #ff8800',
                borderRadius: '50%',
                color: '#000',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 25px rgba(255, 136, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace'
              }}
              title="Candlelaria"
            >
              🕯️
              <NotificationBadge 
                count={notifications.candles}
                color="#ff0041"
                pulse={true}
                position="top-right"
              />
            </button>
          </div>
        )}


        {/* Content Panel - Only show for tabs that don't use portals */}
        {activeTab && activeTab !== 'aitraders' && activeTab !== 'candle' && (
          <>
            {/* Background Overlay */}
            <div
              onClick={() => {
                setActiveTab(null);
                setShowMobileMenu(false);  // Close menu when closing tab
              }}
              style={{
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                // backdropFilter: 'blur(20px)',
                // WebkitBackdropFilter: 'blur(20px)',
                zIndex: 999998,
                transition: 'all 0.3s ease'
              }}
            />
            

            {/* Content Panel */}
            <div style={{
              position: 'fixed',
              // Different positioning for chat modal on desktop - bottom right corner
              left: activeTab === 'chat' && !isMobile ? 'auto' : 
                    activeTab === 'stats' || (activeTab === 'chat' && isMobile) ? '8px' : '20px',
              top: activeTab === 'chat' && !isMobile ? 'auto' : 
                   activeTab === 'chat' && isMobile ? '80px' : '120px',  // Moved lower on mobile
              right: activeTab === 'chat' && !isMobile ? '20px' : 
                     activeTab === 'stats' || (activeTab === 'chat' && isMobile) ? '8px' : '20px',
              bottom: activeTab === 'chat' && !isMobile ? '20px' : 'auto',
              transform: 'none',
              maxHeight: activeTab === 'chat' && isMobile ? 'calc(100vh - 100px)' :  // Adjusted for new top position
                        activeTab === 'chat' && !isMobile ? '600px' : 'calc(100vh - 160px)',
              background: activeTab === 'stats' ? 'rgba(0, 0, 0, 0.3)' :
                        activeTab === 'chat' ? 'transparent' :  // No background for chat
                        'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
              border: activeTab === 'stats' || activeTab === 'chat' ? 'none' : '1px solid rgba(0, 255, 0, 0.3)',
              borderRadius: activeTab === 'chat' && isMobile ? '0' : '12px',
              padding: activeTab === 'stats' || activeTab === 'chat' ? '0' : '15px',
              boxShadow: activeTab === 'stats' || activeTab === 'chat' ? 'none' :
                        '0 0 30px rgba(0, 0, 0, 0.5)',
              zIndex: 999999,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '11px',
              width: activeTab === 'chat' && !isMobile ? '450px' :
                     activeTab === 'stats' || (activeTab === 'chat' && isMobile) ? 'calc(100vw - 16px)' : 
                     'calc(100vw - 40px)',
              height: activeTab === 'chat' && isMobile ? '100vh' : 'auto',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}>
          {/* Stats Tab - Show Performance Dashboard */}
          {activeTab === 'stats' && (
            <PerformanceDashboard 
              show={true} 
              embedded={true}
              onClose={() => setActiveTab(null)}
            />
          )}
          
          {/* Old Stats Tab (disabled) */}
          {activeTab === 'stats_old' && (
            <>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(0, 255, 0, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    background: '#00ff00',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite',
                    boxShadow: '0 0 10px #00ff00'
                  }} />
                  <div>
                    <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '11px' }}>
                      {features/tradingData.modelName}
                    </div>
                    <div style={{ color: '#888', fontSize: '8px' }}>
                      {features/tradingData.modelVersion}
                    </div>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  alignItems: 'flex-end'
                }}>
                  <div style={{
                    padding: '2px 8px',
                    background: 'rgba(255, 221, 0, 0.3)',
                    border: '1px solid #ffdd00',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    color: '#ffdd00',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}>
                    <div style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: '#ffdd00'
                    }} />
                    📝 PAPER
                  </div>
                  {isConnected && (
                    <div style={{
                      padding: '1px 4px',
                      background: 'rgba(0, 255, 0, 0.2)',
                      border: '1px solid rgba(0, 255, 0, 0.4)',
                      borderRadius: '2px',
                      fontSize: '7px',
                      color: '#00ff00',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <div style={{
                        width: '3px',
                        height: '3px',
                        borderRadius: '50%',
                        background: '#00ff00',
                        animation: 'pulse 2s infinite'
                      }} />
                      LIVE MARKET
                    </div>
                  )}
                </div>
              </div>

              {/* Fund Balance with Total P&L */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <div style={{ color: '#00ff00', fontSize: '10px', opacity: 0.7 }}>
                    TOTAL P&L
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: features/tradingData.totalPnl > 0 ? '#00ff00' : '#ff3333',
                    textShadow: '0 0 10px rgba(0, 255, 0, 0.5)'
                  }}>
                    {features/tradingData.totalPnl > 0 ? '+' : ''}${formatNumber(Math.abs(features/tradingData.totalPnl))}
                  </div>
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: '#00ff00',
                  marginBottom: '3px'
                }}>
                  ${formatNumber(features/tradingData.fundBalance)}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  background: features/tradingData.totalPnlPercent > 0 ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                  borderRadius: '3px'
                }}>
                  <span style={{ color: '#888', fontSize: '9px' }}>TOTAL RETURN</span>
                  <span style={{ 
                    color: features/tradingData.totalPnlPercent > 0 ? '#00ff00' : '#ff3333',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {features/tradingData.totalPnlPercent > 0 ? '+' : ''}{features/tradingData.totalPnlPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Performance Metrics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                marginBottom: '8px'
              }}>
                <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '4px' }}>
                  <div style={{ color: '#888', fontSize: '9px' }}>WIN RATE</div>
                  <div style={{ color: '#00ff00', fontSize: '13px', fontWeight: 'bold' }}>
                    {features/tradingData.winRate}%
                  </div>
                </div>
                <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '4px' }}>
                  <div style={{ color: '#888', fontSize: '9px' }}>SHARPE</div>
                  <div style={{ color: '#00ff00', fontSize: '13px', fontWeight: 'bold' }}>
                    {features/tradingData.sharpeRatio}
                  </div>
                </div>
                <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '4px' }}>
                  <div style={{ color: '#888', fontSize: '9px' }}>MAX DD</div>
                  <div style={{ color: '#ff3333', fontSize: '13px', fontWeight: 'bold' }}>
                    {features/tradingData.maxDrawdown}%
                  </div>
                </div>
                <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '4px' }}>
                  <div style={{ color: '#888', fontSize: '9px' }}>P. FACTOR</div>
                  <div style={{ color: '#00ff00', fontSize: '13px', fontWeight: 'bold' }}>
                    {features/tradingData.profitFactor}
                  </div>
                </div>
              </div>

              {/* Trading Activity Stats */}
              <div style={{
                padding: '6px',
                background: 'linear-gradient(90deg, rgba(255, 221, 0, 0.1) 0%, rgba(0, 255, 0, 0.1) 100%)',
                borderRadius: '5px',
                marginBottom: '12px', // Increased from 8px to prevent overlap
                border: '1px solid rgba(255, 221, 0, 0.3)'
              }}>
                <div style={{ color: '#ffdd00', fontSize: '9px', marginBottom: '4px', fontWeight: 'bold' }}>
                  📊 TRADES EXECUTED: {features/tradingData.iterationCount}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: '#888', fontSize: '9px' }}>Strategy Status</span>
                  <span style={{ color: features/tradingData.lastImprovement === 'Active' ? '#00ff00' : '#ffdd00', fontSize: '10px', fontWeight: 'bold' }}>
                    {features/tradingData.lastImprovement}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '9px' }}>Open Positions</span>
                  <span style={{ color: '#00ff00', fontSize: '10px' }}>
                    {features/tradingData.positions?.length || 0} / 5
                  </span>
                </div>
              </div>

              {/* Assistant Insights Section */}
              <div style={{
                marginBottom: '12px',
                padding: '8px',
                background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.9) 0%, rgba(0, 40, 20, 0.8) 100%)',
                borderRadius: '6px',
                border: '1px solid rgba(0, 255, 0, 0.4)',
                boxShadow: '0 2px 8px rgba(0, 255, 0, 0.2)'
              }}>
                <div style={{ 
                  color: '#00ff00', 
                  fontSize: '10px', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🤖 ASSISTANT INSIGHTS
                </div>
                
                {/* Technical Analysis from TradingView */}
                <div style={{
                  marginBottom: '5px',
                  padding: '4px',
                  background: 'rgba(0, 150, 255, 0.1)',
                  borderLeft: '2px solid #0096ff',
                  borderRadius: '2px'
                }}>
                  <div style={{ color: '#0096ff', fontSize: '8px', fontWeight: 'bold', marginBottom: '2px' }}>
                    📈 TECHNICAL (TradingView)
                  </div>
                  <div style={{ color: '#ddd', fontSize: '9px', lineHeight: '1.3' }}>
                    {features/tradingData.assistantInsights?.technical || 'RSI 52, MACD neutral. Waiting for breakout above resistance at $98,500.'}
                  </div>
                </div>
                
                {/* Sentiment from Grok */}
                <div style={{
                  marginBottom: '5px',
                  padding: '4px',
                  background: 'rgba(255, 0, 255, 0.1)',
                  borderLeft: '2px solid #ff00ff',
                  borderRadius: '2px'
                }}>
                  <div style={{ color: '#ff00ff', fontSize: '8px', fontWeight: 'bold', marginBottom: '2px' }}>
                    💭 SENTIMENT (Grok)
                  </div>
                  <div style={{ color: '#ddd', fontSize: '9px', lineHeight: '1.3' }}>
                    {features/tradingData.assistantInsights?.sentiment || 'Crowd euphoric on BTC. Fear/Greed at 72 (Greed). Retail FOMO building.'}
                  </div>
                </div>
                
                {/* Macro from Claude */}
                <div style={{
                  marginBottom: '5px',
                  padding: '4px',
                  background: 'rgba(255, 165, 0, 0.1)',
                  borderLeft: '2px solid #ffa500',
                  borderRadius: '2px'
                }}>
                  <div style={{ color: '#ffa500', fontSize: '8px', fontWeight: 'bold', marginBottom: '2px' }}>
                    🌍 MACRO (Claude)
                  </div>
                  <div style={{ color: '#ddd', fontSize: '9px', lineHeight: '1.3' }}>
                    {features/tradingData.assistantInsights?.macro || 'Fed pivot narrative intact. DXY weakening supports crypto. Risk-on environment.'}
                  </div>
                </div>
                
                {/* Main Agent Summary */}
                <div style={{
                  padding: '4px',
                  background: 'rgba(0, 255, 0, 0.1)',
                  borderLeft: '2px solid #00ff00',
                  borderRadius: '2px'
                }}>
                  <div style={{ color: '#00ff00', fontSize: '8px', fontWeight: 'bold', marginBottom: '2px' }}>
                    ⚡ STRATEGY (RL80 Main)
                  </div>
                  <div style={{ color: '#ddd', fontSize: '9px', lineHeight: '1.3', fontWeight: 'bold' }}>
                    {features/tradingData.assistantInsights?.strategy || 'Long bias maintained. Adding on dips to $95K support. Target $105K by month end.'}
                  </div>
                </div>
              </div>

              {/* Agent Status & Next Analysis */}
              <div style={{
                marginBottom: '8px'
              }}>
                {/* Live Status Indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '6px',
                  gap: '6px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#00ff00',
                    boxShadow: '0 0 8px #00ff00',
                    animation: 'pulse 2s infinite'
                  }} />
                  <span style={{ color: '#00ff00', fontSize: '10px', fontWeight: 'bold' }}>
                    LIVE MONITORING
                  </span>
                </div>
                
                {/* Next Deep Analysis Timer */}
                <div style={{
                  textAlign: 'center',
                  padding: '4px',
                  background: 'rgba(0, 255, 0, 0.1)',
                  borderRadius: '5px',
                  border: '1px solid rgba(0, 255, 0, 0.3)',
                  marginBottom: '6px'
                }}>
                  <div style={{ color: '#888', fontSize: '9px', marginBottom: '2px' }}>
                    NEXT DEEP ANALYSIS
                  </div>
                  <div style={{ color: '#00ff00', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {features/tradingData.nextAnalysis}
                  </div>
                </div>
                
                {/* Recent Micro-Actions - More Visible */}
                <div style={{
                  padding: '6px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 255, 0, 0.3)',
                  boxShadow: '0 2px 6px rgba(0, 255, 0, 0.2)'
                }}>
                  <div style={{ 
                    color: '#00ff00', 
                    fontSize: '8px', 
                    marginBottom: '4px', 
                    textTransform: 'uppercase',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '5px',
                      height: '5px',
                      background: '#00ff00',
                      borderRadius: '50%',
                      animation: 'pulse 1s infinite'
                    }} />
                    Recent Actions
                    <span style={{
                      fontSize: '7px',
                      color: '#ffdd00',
                      marginLeft: 'auto',
                      animation: 'bounce 2s infinite'
                    }}>↓</span>
                  </div>
                  {features/tradingData.microActions.slice(0, 2).map((action, idx) => (
                    <div key={idx} style={{
                      fontSize: '9px',
                      color: '#aaa',
                      marginBottom: '2px',
                      paddingLeft: '8px',
                      borderLeft: '2px solid rgba(0, 255, 0, 0.3)'
                    }}>
                      <span style={{ color: '#00ff00', opacity: 0.7 }}>{action.time}:</span> {action.action}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* AI Thoughts Tab */}
          {activeTab === 'thoughts' && (
            <>
              <div style={{
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(0, 255, 0, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '13px' }}>
                  💬 4-AGENT TEAM CHAT
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <div style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#00ff00',
                    animation: 'pulse 2s infinite'
                  }} />
                  <span style={{ color: '#00ff00', fontSize: '9px' }}>LIVE</span>
                </div>
              </div>
              
              {/* Thoughts Messages */}
              <div style={{
                maxHeight: 'calc(100vh - 240px)',
                overflowY: 'auto',
                paddingRight: '5px'
              }}>
                {features/tradingData.modelThoughts.map((thought, idx) => (
                  <div key={idx} style={{
                    marginBottom: '10px',
                    padding: '8px',
                    background: thought.type === 'learning' ? 'rgba(255, 221, 0, 0.05)' :
                               thought.type === 'features/trading' ? 'rgba(0, 255, 0, 0.05)' :
                               thought.type === 'market' ? 'rgba(0, 150, 255, 0.05)' :
                               thought.type === 'sentiment' ? 'rgba(255, 0, 255, 0.05)' :
                               'rgba(255, 255, 255, 0.02)',
                    borderLeft: `2px solid ${
                      thought.type === 'learning' ? '#ffdd00' :
                      thought.type === 'features/trading' ? '#00ff00' :
                      thought.type === 'market' ? '#0096ff' :
                      thought.type === 'sentiment' ? '#ff00ff' :
                      '#888'
                    }`,
                    borderRadius: '3px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        color: thought.type === 'learning' ? '#ffdd00' :
                               thought.type === 'features/trading' ? '#00ff00' :
                               thought.type === 'market' ? '#0096ff' :
                               thought.type === 'sentiment' ? '#ff00ff' :
                               '#888',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {thought.type === 'learning' ? '🧠 LEARNING' :
                         thought.type === 'features/trading' ? '📈 TRADING' :
                         thought.type === 'market' ? '🌍 MARKET' :
                         thought.type === 'sentiment' ? '💭 SENTIMENT' : '💡 INSIGHT'}
                      </span>
                      <span style={{
                        color: '#666',
                        fontSize: '8px'
                      }}>
                        {thought.timestamp}
                      </span>
                    </div>
                    <div style={{
                      color: '#ddd',
                      fontSize: '10px',
                      lineHeight: '1.4'
                    }}>
                      {thought.message}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Macro Tab */}
          {activeTab === 'macro' && (
            <>
              <div style={{
                marginBottom: '10px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(0, 255, 0, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '12px' }}>
                  🌍 MACRO ANALYSIS
                </div>
                <div style={{
                  padding: '3px 8px',
                  background: features/tradingData.macroData.marketRegime === 'RISK_ON' ? 'rgba(0, 255, 0, 0.2)' :
                            features/tradingData.macroData.marketRegime === 'RISK_OFF' ? 'rgba(255, 0, 0, 0.2)' :
                            'rgba(255, 255, 0, 0.2)',
                  color: features/tradingData.macroData.marketRegime === 'RISK_ON' ? '#00ff00' :
                        features/tradingData.macroData.marketRegime === 'RISK_OFF' ? '#ff3333' :
                        '#ffdd00',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {features/tradingData.macroData.marketRegime}
                </div>
              </div>

              {/* Risk Score */}
              <div style={{
                marginBottom: '12px',
                padding: '8px',
                background: 'rgba(0, 255, 0, 0.05)',
                borderRadius: '5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ color: '#888', fontSize: '10px' }}>MARKET RISK SCORE</span>
                  <span style={{ 
                    color: features/tradingData.macroData.riskScore > 70 ? '#00ff00' :
                          features/tradingData.macroData.riskScore > 30 ? '#ffdd00' : '#ff3333',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {features/tradingData.macroData.riskScore}/100
                  </span>
                </div>
                <div style={{
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${features/tradingData.macroData.riskScore}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, #ff3333 0%, #ffdd00 50%, #00ff00 100%)`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Traditional Macro Grid */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '10px', marginBottom: '6px' }}>TRADITIONAL MACRO</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px'
                }}>
                  <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '3px' }}>
                    <div style={{ color: '#888', fontSize: '9px' }}>FED RATE</div>
                    <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                      {features/tradingData.macroData.fedRate}%
                      <span style={{
                        color: features/tradingData.macroData.fedRateChange < 0 ? '#00ff00' : '#ff3333',
                        fontSize: '10px',
                        marginLeft: '4px'
                      }}>
                        {features/tradingData.macroData.fedRateChange > 0 ? '+' : ''}{features/tradingData.macroData.fedRateChange}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '3px' }}>
                    <div style={{ color: '#888', fontSize: '9px' }}>DXY</div>
                    <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                      {features/tradingData.macroData.dxy}
                      <span style={{
                        color: features/tradingData.macroData.dxyChange < 0 ? '#00ff00' : '#ff3333',
                        fontSize: '10px',
                        marginLeft: '4px'
                      }}>
                        {features/tradingData.macroData.dxyChange > 0 ? '+' : ''}{features/tradingData.macroData.dxyChange}%
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '3px' }}>
                    <div style={{ color: '#888', fontSize: '9px' }}>VIX</div>
                    <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                      {features/tradingData.macroData.vix}
                      <span style={{
                        color: features/tradingData.macroData.vixChange < 0 ? '#00ff00' : '#ff3333',
                        fontSize: '10px',
                        marginLeft: '4px'
                      }}>
                        {features/tradingData.macroData.vixChange > 0 ? '+' : ''}{features/tradingData.macroData.vixChange}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '3px' }}>
                    <div style={{ color: '#888', fontSize: '9px' }}>CPI</div>
                    <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                      {features/tradingData.macroData.cpi}%
                      <span style={{
                        color: features/tradingData.macroData.cpi < features/tradingData.macroData.cpiPrev ? '#00ff00' : '#ff3333',
                        fontSize: '10px',
                        marginLeft: '4px'
                      }}>
                        ↓
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Crypto Macro */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '10px', marginBottom: '6px' }}>CRYPTO METRICS</div>
                <div style={{
                  padding: '8px',
                  background: 'rgba(0, 255, 0, 0.05)',
                  borderRadius: '5px'
                }}>
                  {/* Fear & Greed */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#888', fontSize: '10px' }}>Fear & Greed</span>
                    <span style={{
                      color: features/tradingData.macroData.fearGreed > 70 ? '#00ff00' :
                            features/tradingData.macroData.fearGreed > 30 ? '#ffdd00' : '#ff3333',
                      fontWeight: 'bold',
                      fontSize: '11px'
                    }}>
                      {features/tradingData.macroData.fearGreed} - {features/tradingData.macroData.fearGreedText}
                    </span>
                  </div>
                  
                  {/* BTC Dominance */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#888', fontSize: '10px' }}>BTC Dominance</span>
                    <span style={{ color: '#fff', fontSize: '11px' }}>
                      {features/tradingData.macroData.btcDominance?.toFixed(1) || '0.0'}%
                      <span style={{
                        color: features/tradingData.macroData.btcDomChange > 0 ? '#ffdd00' : '#00ff00',
                        fontSize: '10px',
                        marginLeft: '4px'
                      }}>
                        {features/tradingData.macroData.btcDomChange > 0 ? '+' : ''}{features/tradingData.macroData.btcDomChange}%
                      </span>
                    </span>
                  </div>

                  {/* Stablecoin Flows */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#888', fontSize: '10px' }}>Stable Flows 24h</span>
                    <span style={{
                      color: features/tradingData.macroData.stableFlowDirection === 'IN' ? '#00ff00' : '#ff3333',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {features/tradingData.macroData.stableFlowDirection === 'IN' ? '+' : '-'}${features/tradingData.macroData.stableFlow?.toFixed(2) || '0.00'}B
                    </span>
                  </div>

                  {/* Funding Rate */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888', fontSize: '10px' }}>Funding Rate</span>
                    <span style={{
                      color: Math.abs(features/tradingData.macroData.fundingRate) > 0.01 ? '#ffdd00' : '#00ff00',
                      fontSize: '11px'
                    }}>
                      {(features/tradingData.macroData.fundingRate * 100).toFixed(3)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Signals */}
              <div style={{
                padding: '8px',
                background: 'linear-gradient(90deg, rgba(0, 255, 0, 0.1) 0%, transparent 100%)',
                borderRadius: '5px'
              }}>
                <div style={{ color: '#888', fontSize: '10px', marginBottom: '6px' }}>AI SIGNALS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {features/tradingData.macroData.signals.map((signal, idx) => (
                    <span key={idx} style={{
                      padding: '3px 6px',
                      background: 'rgba(0, 255, 0, 0.2)',
                      border: '1px solid rgba(0, 255, 0, 0.4)',
                      borderRadius: '3px',
                      color: '#00ff00',
                      fontSize: '9px'
                    }}>
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Positions Tab */}
          {activeTab === 'positions' && (
            <>
              <div style={{
                marginBottom: '8px',
                paddingBottom: '4px',
                borderBottom: '1px solid rgba(0, 255, 0, 0.3)',
                color: '#00ff00',
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                ⚡ ACTIVE POSITIONS ({features/tradingData.activePositions.length})
              </div>
              
              {features/tradingData.activePositions.map((pos, idx) => (
                <div key={idx} style={{
                  padding: '6px',
                  marginBottom: '6px',
                  background: pos.pnl > 0 ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
                  border: `1px solid ${pos.pnl > 0 ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'}`,
                  borderRadius: '5px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '11px' }}>
                      {pos.symbol}
                    </div>
                    <div style={{
                      padding: '2px 5px',
                      background: pos.side === 'LONG' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
                      color: pos.side === 'LONG' ? '#00ff00' : '#ff3333',
                      borderRadius: '3px',
                      fontSize: '9px',
                      fontWeight: 'bold'
                    }}>
                      {pos.side}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px' }}>
                    <div>
                      <span style={{ color: '#888' }}>Entry: </span>
                      <span style={{ color: '#fff' }}>${pos.entry.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Current: </span>
                      <span style={{ color: '#fff' }}>${pos.current.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Size: </span>
                      <span style={{ color: '#fff' }}>{pos.size}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>P&L: </span>
                      <span style={{ 
                        color: pos.pnl > 0 ? '#00ff00' : '#ff3333',
                        fontWeight: 'bold'
                      }}>
                        {pos.pnl > 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Trades Tab */}
          {activeTab === 'trades' && (
            <>
              <div style={{
                marginBottom: '8px',
                paddingBottom: '4px',
                borderBottom: '1px solid rgba(0, 255, 0, 0.3)',
                color: '#00ff00',
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                📜 COMPLETED TRADES
              </div>
              
              {features/tradingData.recentTrades.map((trade, idx) => (
                <div key={idx} style={{
                  padding: '4px',
                  marginBottom: '4px',
                  background: trade.status === 'exceptional' ? 'rgba(255, 215, 0, 0.05)' : 
                            trade.status === 'profit' ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
                  borderLeft: `3px solid ${
                    trade.status === 'exceptional' ? '#ffd700' : 
                    trade.status === 'profit' ? '#00ff00' : '#ff3333'
                  }`,
                  borderRadius: '3px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ color: '#888', fontSize: '9px' }}>{trade.time}</span>
                      <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '10px' }}>{trade.symbol}</span>
                      <span style={{
                        color: trade.side === 'BUY' ? '#00ff00' : '#ff3333',
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}>
                        {trade.side}
                      </span>
                    </div>
                    <span style={{ 
                      color: trade.status === 'exceptional' ? '#ffd700' : 
                            trade.status === 'profit' ? '#00ff00' : '#ff3333',
                      fontWeight: 'bold',
                      fontSize: '10px'
                    }}>
                      {trade.pnl} {trade.status === 'exceptional' ? '✨' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#888' }}>
                    {trade.amount} @ ${trade.price}
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* Candle Tab - Mobile View - Full Screen with Portal */}
          {/* Chat Panel - Redesigned to match PerformanceDashboard */}
          {activeTab === 'chat' && (
            <>
              {/* Invisible backdrop for desktop to detect clicks outside */}
              {!isMobile && (
                <div
                  onClick={() => setActiveTab(null)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'transparent',
                    zIndex: 999998
                  }}
                />
              )}
              
              <div style={{
                width: '100%',
                height: '100%',
                background: isMobile ? 'rgba(10, 10, 20, 0.1)' : 'rgba(10, 10, 20, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: isMobile ? '0' : '20px',
                border: !isMobile ? '1px solid rgba(147, 51, 234, 0.3)' : 'none',
                padding: '0',
                overflowY: 'auto',
                boxShadow: !isMobile ? 'inset 0 0 30px rgba(147, 51, 234, 0.1)' : 'none',
                position: 'relative',
                zIndex: 999999
              }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px',
                borderBottom: '1px solid rgba(147, 51, 234, 0.2)',
                background: 'linear-gradient(90deg, rgba(147, 51, 234, 0.05) 0%, transparent 100%)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: isMobile ? '10px' : '20px 20px 10px 10px',
                paddingTop: '12px',
                paddingRight: '12px',
                paddingBottom: '12px',
                paddingLeft: '12px',
                position: 'relative'
              }}>
                {/* Close Button - Mobile Only */}
                {isMobile && (
                  <button
                    onClick={() => setActiveTab(null)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(255, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 0, 0, 0.3)',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '18px',
                      color: '#ff6666',
                      transition: 'all 0.2s',
                      zIndex: 10
                    }}
                  >
                    ✕
                  </button>
                )}
                
                <div>
                  <h2 style={{ 
                    color: '#9333ea',
                    margin: 0,
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textShadow: '0 0 20px rgba(147, 51, 234, 0.5)',
                    letterSpacing: '0.5px'
                  }}>
                    💬 AI TEAM CHAT
                  </h2>
                  <div style={{ color: '#888', fontSize: '10px', marginTop: '2px' }}>
                    Real-time agent coordination
                  </div>
                </div>
                
                {/* Live indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  paddingRight: isMobile ? '40px' : '0'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#00ff00',
                    boxShadow: '0 0 8px rgba(0, 255, 0, 0.8)',
                    animation: 'pulse 2s infinite'
                  }} />
                  <span style={{ color: '#00ff00', fontSize: '10px', fontWeight: 'bold' }}>LIVE</span>
                </div>
              </div>
              
              {/* Agent Indicators */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                marginBottom: '15px',
                padding: '0 12px'
              }}>
                {[
                  { name: 'RL80', icon: '⚡', color: '#FFD700' },
                  { name: 'EMO', icon: '🔮', color: '#9333ea' },
                  { name: 'TEKNO', icon: '📊', color: '#00ffff' },
                  { name: 'MACRO', icon: '🌍', color: '#00ff00' }
                ].map(agent => (
                  <div key={agent.name} style={{
                    background: `rgba(${
                      agent.color === '#FFD700' ? '255, 215, 0' : 
                      agent.color === '#9333ea' ? '147, 51, 234' :
                      agent.color === '#00ffff' ? '0, 255, 255' : '0, 255, 0'
                    }, 0.05)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    padding: '8px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: `1px solid ${agent.color}33`,
                    boxShadow: `0 0 10px ${agent.color}1A`
                  }}>
                    <div style={{ fontSize: '14px', marginBottom: '2px' }}>{agent.icon}</div>
                    <div style={{ color: agent.color, fontSize: '9px', fontWeight: 'bold' }}>
                      {agent.name}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Chat Messages Container */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)',
                borderRadius: '12px',
                padding: '12px',
                margin: '0 12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 20px rgba(147, 51, 234, 0.05), inset 0 0 20px rgba(255, 255, 255, 0.02)',
                maxHeight: 'calc(100vh - 350px)',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(147, 51, 234, 0.3) transparent'
              }}>
                {tradingData.modelThoughts.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '30px 15px',
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: '11px'
                  }}>
                    Waiting for agent communications...
                  </div>
                ) : (
                  features/tradingData.modelThoughts.map((thought, idx) => (
                    <div key={idx} style={{
                      marginBottom: '10px',
                      padding: '10px',
                      background: thought.type === 'learning' ? 'rgba(255, 215, 0, 0.03)' :
                                 thought.type === 'features/trading' ? 'rgba(0, 255, 0, 0.03)' :
                                 thought.type === 'market' ? 'rgba(0, 255, 255, 0.03)' :
                                 thought.type === 'sentiment' ? 'rgba(147, 51, 234, 0.03)' :
                                 'rgba(255, 255, 255, 0.01)',
                      backdropFilter: 'blur(5px)',
                      WebkitBackdropFilter: 'blur(5px)',
                      borderLeft: `3px solid ${
                        thought.type === 'learning' ? '#FFD700' :
                        thought.type === 'features/trading' ? '#00ff00' :
                        thought.type === 'market' ? '#00ffff' :
                        thought.type === 'sentiment' ? '#9333ea' :
                        '#888'
                      }`,
                      borderRadius: '8px',
                      boxShadow: `0 0 8px ${
                        thought.type === 'learning' ? 'rgba(255, 215, 0, 0.1)' :
                        thought.type === 'features/trading' ? 'rgba(0, 255, 0, 0.1)' :
                        thought.type === 'market' ? 'rgba(0, 255, 255, 0.1)' :
                        thought.type === 'sentiment' ? 'rgba(147, 51, 234, 0.1)' :
                        'rgba(255, 255, 255, 0.05)'
                      }`,
                      transition: 'all 0.3s'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px'
                      }}>
                        <span style={{ 
                          color: thought.type === 'learning' ? '#FFD700' :
                                 thought.type === 'features/trading' ? '#00ff00' :
                                 thought.type === 'market' ? '#00ffff' :
                                 thought.type === 'sentiment' ? '#9333ea' :
                                 '#888',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {thought.icon} {thought.agent}
                        </span>
                        <span style={{ color: '#666', fontSize: '9px' }}>
                          {new Date(thought.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div style={{ 
                        color: '#ddd', 
                        fontSize: '10px', 
                        lineHeight: '1.4',
                        opacity: 0.9
                      }}>
                        {thought.message}
                      </div>
                      {thought.confidence && (
                        <div style={{
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ color: '#666', fontSize: '8px' }}>Confidence:</span>
                          <div style={{
                            flex: 1,
                            height: '3px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${thought.confidence}%`,
                              height: '100%',
                              background: thought.confidence > 70 ? '#00ff00' : 
                                         thought.confidence > 40 ? '#FFD700' : '#ff3333',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          <span style={{ 
                            color: thought.confidence > 70 ? '#00ff00' : 
                                   thought.confidence > 40 ? '#FFD700' : '#ff3333',
                            fontSize: '8px',
                            fontWeight: 'bold'
                          }}>
                            {thought.confidence}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            </>
          )}


            </div>
          </>
        )}

        {/* Candle Panel Portal - Removed */}
        {/* Compact Candle Modal for mobile - COMMENTED OUT FOR DEBUGGING */}
        {/* <CompactCandleModal
          isOpen={showCompactCandleModal}
          onClose={() => {
            setShowCompactCandleModal(false);
            setShowMobileMenu(false);  // Also close the menu panel
          }}
          onCandleCreated={() => {
            setShowCompactCandleModal(false);
            setShowMobileMenu(false);  // Also close the menu panel
          }}
        /> */}

        {/* Single Candle Display Modal */}
        {showSingleCandleDisplay && (
          <>
            {/* Backdrop */}
            <div 
              onClick={() => setShowSingleCandleDisplay(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                zIndex: window.innerWidth <= 768 ? 99999 : 9999,
                backdropFilter: 'blur(5px)'
              }}
            />
            
            {/* Modal content - responsive for mobile */}
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
              position: 'fixed',
              top: window.innerWidth <= 768 ? 0 : '50%',
              left: window.innerWidth <= 768 ? 0 : '50%',
              transform: window.innerWidth <= 768 ? 'none' : 'translate(-50%, -50%)',
              width: window.innerWidth <= 768 ? '100%' : 'auto',
              height: window.innerWidth <= 768 ? '100%' : 'auto',
              zIndex: window.innerWidth <= 768 ? 100000 : 10000,
              borderRadius: window.innerWidth <= 768 ? 0 : '10px',
              overflow: 'visible'
            }}>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSingleCandleDisplay(false);
                }}
                style={{
                  position: 'absolute',
                  top: window.innerWidth <= 768 ? '20px' : '-10px',
                  right: window.innerWidth <= 768 ? '20px' : '-10px',
                  background: 'rgba(255, 0, 0, 0.8)',
                  border: '2px solid #ff0000',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#fff',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10001,
                  fontWeight: 'bold',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
                }}
              >
                ✕
              </button>
              
              {/* The SingleCandleDisplay component */}
              <SingleCandleDisplay 
                onOpenCompactModal={() => {
                  setShowSingleCandleDisplay(false); // Close this modal
                  // Add a delay to allow WebGL context cleanup
                  setTimeout(() => {
                    setShowCompactCandleModal(true); // Open the CompactCandleModal
                  }, 500);
                }}
                onClose={() => setShowSingleCandleDisplay(false)}
              />
            </div>
          </>
        )}
        
        {/* Compact Candle Modal - Renders on top when opened */}
        <CompactCandleModal
          isOpen={showCompactCandleModal}
          onClose={() => {
            setShowCompactCandleModal(false);
            setShowMobileMenu(false);  // Also close the menu panel
          }}
          onCandleCreated={() => {
            setShowCompactCandleModal(false);
            setShowMobileMenu(false);  // Also close the menu panel
          }}
        />
      </>
    );
  }

  // Desktop view - original layout (deprecated - now using simplified UI for all screen sizes)
  // This code should never be reached since we're always showing the simplified UI above
  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        
        /* Webkit scrollbar styles */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 255, 0, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 0, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 255, 0, 0.7);
        }
        
        @keyframes pulse {
          0% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.6;
            transform: scale(1.1);
          }
          100% { 
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      {/* Combined Left Panel with Tabs */}
      <div style={{
        position: 'fixed',
        top: '120px',
        left: '20px',
        background: leftPanelTab === 'performance' 
          ? 'rgba(0, 0, 0, 0.3)' 
          : 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
        border: leftPanelTab === 'performance' ? 'none' : '1px solid #00ff00',
        borderRadius: '8px',
        padding: leftPanelTab === 'performance' ? '0' : '12px',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 9999,
        width: 'min(320px, 25vw)',
        minWidth: '260px',
        maxWidth: '340px',
        // Improved height calculation to prevent overlap
        height: 'calc(50vh - 140px)', // Use 50% of viewport minus top offset and gap
        maxHeight: '400px', // Maximum height to ensure space for bottom panels
        minHeight: '200px', // Minimum usable height
        boxShadow: '0 0 20px rgba(0, 255, 0, 0.3), inset 0 0 20px rgba(0, 255, 0, 0.05)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Tab Navigation */}
        <div style={{
          display: leftPanelTab === 'performance' ? 'none' : 'flex',
          marginBottom: '12px',
          borderBottom: '1px solid rgba(0, 255, 0, 0.3)'
        }}>
          <button
            onClick={() => setLeftPanelTab('summary')}
            style={{
              flex: 1,
              padding: '8px',
              background: leftPanelTab === 'summary' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: leftPanelTab === 'summary' ? '2px solid #00ff00' : '2px solid transparent',
              color: leftPanelTab === 'summary' ? '#00ff00' : '#888',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            📊 SUMMARY
          </button>
          <button
            onClick={() => setLeftPanelTab('positions')}
            style={{
              flex: 1,
              padding: '8px',
              background: leftPanelTab === 'positions' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: leftPanelTab === 'positions' ? '2px solid #00ff00' : '2px solid transparent',
              color: leftPanelTab === 'positions' ? '#00ff00' : '#888',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            ⚡ POSITIONS
          </button>
          <button
            onClick={() => setLeftPanelTab('trades')}
            style={{
              flex: 1,
              padding: '8px',
              background: leftPanelTab === 'trades' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: leftPanelTab === 'trades' ? '2px solid #00ff00' : '2px solid transparent',
              color: leftPanelTab === 'trades' ? '#00ff00' : '#888',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            📜 TRADES
          </button>
        </div>
        
        {/* Tab Content Container */}
        <div className="custom-scrollbar" style={{ 
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          scrollbarWidth: 'thin',
          scrollbarColor: '#00ff00 rgba(0, 255, 0, 0.1)',
          minHeight: '150px'
        }}>
        
        {/* Performance Tab - New clean dashboard */}
        {leftPanelTab === 'performance' && (
          <div style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}>
            <PerformanceDashboard 
              show={true} 
              embedded={true}
              onClose={() => setLeftPanelTab('summary')}
            />
          </div>
        )}
        
        {/* Summary Tab */}
        {leftPanelTab === 'summary' && (
          <div style={{ marginBottom: '30px' }}>
        {/* Header with Model Info */}
        <div style={{
          marginBottom: '15px',
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(0, 255, 0, 0.3)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#00ff00',
                borderRadius: '50%',
                animation: 'pulse 2s infinite',
                boxShadow: '0 0 10px #00ff00'
              }} />
              <div>
                <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '14px' }}>
                  {features/tradingData.modelName}
                </div>
                <div style={{ color: '#888', fontSize: '10px' }}>
                  {features/tradingData.modelVersion}
                </div>
              </div>
            </div>
            <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'flex-end'
          }}>
            <div style={{
              padding: '3px 8px',
              background: 'rgba(255, 221, 0, 0.3)',
              border: '1px solid #ffdd00',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#ffdd00',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ffdd00'
              }} />
              📝 PAPER TRADING
            </div>
            {isConnected && (
              <div style={{
                padding: '2px 6px',
                background: 'rgba(0, 255, 0, 0.2)',
                border: '1px solid rgba(0, 255, 0, 0.4)',
                borderRadius: '3px',
                fontSize: '8px',
                color: '#00ff00',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#00ff00',
                  animation: 'pulse 2s infinite'
                }} />
                LIVE MARKET
              </div>
            )}
          </div>
          </div>
        </div>
        
        {/* Connection Status Info */}
        {!isConnected && (
          <div style={{
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(255, 221, 0, 0.1)',
            border: '1px solid rgba(255, 221, 0, 0.3)',
            borderRadius: '5px'
          }}>
            <div style={{ color: '#ffdd00', fontSize: '10px', marginBottom: '4px' }}>
              📌 Simulated Data Mode
            </div>
            <div style={{ color: '#888', fontSize: '9px' }}>
              Currently using simulated market data for demonstration
            </div>
          </div>
        )}
        
        {/* Fund Stats with nof1 Style */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <div>
              <div style={{ color: '#888', fontSize: '10px', marginBottom: '2px' }}>
                TOTAL P&L
              </div>
              <div style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: features/tradingData.totalPnl > 0 ? '#00ff00' : '#ff3333',
                textShadow: `0 0 10px ${features/tradingData.totalPnl > 0 ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 51, 51, 0.5)'}`
              }}>
                {features/tradingData.totalPnl > 0 ? '+' : ''}${formatNumber(Math.abs(features/tradingData.totalPnl))}
              </div>
            </div>
            <div style={{
              padding: '8px 12px',
              background: features/tradingData.totalPnlPercent > 0 ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
              border: `2px solid ${features/tradingData.totalPnlPercent > 0 ? '#00ff00' : '#ff3333'}`,
              borderRadius: '5px'
            }}>
              <div style={{ color: '#888', fontSize: '9px', marginBottom: '2px' }}>RETURN</div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                color: features/tradingData.totalPnlPercent > 0 ? '#00ff00' : '#ff3333'
              }}>
                {features/tradingData.totalPnlPercent > 0 ? '+' : ''}{features/tradingData.totalPnlPercent.toFixed(2)}%
              </div>
            </div>
          </div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '5px'
          }}>
            Balance: ${formatNumber(features/tradingData.fundBalance)}
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div>
              <span style={{ color: '#888', fontSize: '10px' }}>Initial: </span>
              <span style={{ color: '#fff', fontSize: '11px' }}>
                ${formatNumber(features/tradingData.initialBalance)}
              </span>
            </div>
            <div>
              <span style={{ color: '#888', fontSize: '10px' }}>24H: </span>
              <span style={{ 
                color: features/tradingData.dailyPnl > 0 ? '#00ff00' : '#ff3333',
                fontSize: '11px'
              }}>
                {features/tradingData.dailyPnl > 0 ? '+' : ''}{features/tradingData.dailyPnlPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Strategy Evolution Metrics */}
        <div style={{
          padding: '10px',
          background: 'linear-gradient(135deg, rgba(255, 221, 0, 0.1) 0%, rgba(0, 255, 0, 0.1) 100%)',
          borderRadius: '5px',
          marginBottom: '15px', // Increased spacing to prevent overlap
          border: '1px solid rgba(255, 221, 0, 0.3)'
        }}>
          <div style={{ color: '#ffdd00', fontSize: '11px', marginBottom: '8px', fontWeight: 'bold' }}>
            📊 TRADING ACTIVITY
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ color: '#888', fontSize: '10px' }}>TOTAL TRADES</div>
              <div style={{ color: '#00ff00', fontSize: '14px', fontWeight: 'bold' }}>
                {features/tradingData.iterationCount}
              </div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '10px' }}>POSITIONS</div>
              <div style={{ color: '#ffdd00', fontSize: '14px', fontWeight: 'bold' }}>
                {features/tradingData.positions?.length || 0} / 5
              </div>
            </div>
          </div>
          <div style={{
            marginTop: '8px',
            padding: '4px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '3px',
            fontSize: '10px',
            color: '#888',
            textAlign: 'center'
          }}>
            Last improvement: <span style={{ color: '#ffdd00' }}>{features/tradingData.lastImprovement}</span>
          </div>
        </div>

        {/* Agent Status & Next Analysis */}
        <div style={{
          marginBottom: '12px'
        }}>
          {/* Live Status Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px',
            gap: '8px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#00ff00',
              boxShadow: '0 0 10px #00ff00',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ color: '#00ff00', fontSize: '11px', fontWeight: 'bold' }}>
              ⚡ LIVE MONITORING
            </span>
          </div>
          
          {/* Next Deep Analysis Timer */}
          <div style={{
            textAlign: 'center',
            padding: '8px',
            background: 'rgba(0, 255, 0, 0.1)',
            borderRadius: '5px',
            border: '1px solid rgba(0, 255, 0, 0.3)',
            marginBottom: '8px'
          }}>
            <div style={{ color: '#888', fontSize: '10px', marginBottom: '3px' }}>
              NEXT DEEP ANALYSIS
            </div>
            <div style={{ color: '#00ff00', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {features/tradingData.nextAnalysis}
            </div>
          </div>
          
          {/* Recent Micro-Actions - More Prominent */}
          <div style={{
            padding: '8px',
            background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 255, 0, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 255, 0, 0.2)',
            marginTop: '8px'
          }}>
            <div style={{ 
              color: '#00ff00', 
              fontSize: '10px', 
              marginBottom: '6px', 
              textTransform: 'uppercase',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                background: '#00ff00',
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }} />
              Recent Actions
            </div>
            {features/tradingData.microActions.map((action, idx) => (
              <div key={idx} style={{
                fontSize: '10px',
                color: '#aaa',
                marginBottom: '4px',
                paddingLeft: '10px',
                borderLeft: '2px solid rgba(0, 255, 0, 0.3)'
              }}>
                <span style={{ color: '#00ff00', opacity: 0.7 }}>{action.time}:</span> {action.action}
              </div>
            ))}
          </div>
        </div>
          </div>
        )}
        
        {/* Positions Tab */}
        {leftPanelTab === 'positions' && (
          <div>
            <div style={{ marginBottom: '8px', color: '#00ff00', fontWeight: 'bold', fontSize: '12px' }}>
              ACTIVE POSITIONS ({features/tradingData.activePositions.length})
            </div>
            {features/tradingData.activePositions.map((pos, idx) => (
              <div key={idx} style={{
                padding: '8px',
                marginBottom: '8px',
                background: pos.pnl > 0 ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
                border: `1px solid ${pos.pnl > 0 ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'}`,
                borderRadius: '5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <div style={{ color: '#00ff00', fontWeight: 'bold' }}>
                    {pos.symbol}
                  </div>
                  <div style={{
                    padding: '2px 6px',
                    background: pos.side === 'LONG' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
                    color: pos.side === 'LONG' ? '#00ff00' : '#ff3333',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    {pos.side}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px' }}>
                  <div>
                    <span style={{ color: '#888' }}>Entry: </span>
                    <span style={{ color: '#fff' }}>${pos.entry.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>Current: </span>
                    <span style={{ color: '#fff' }}>${pos.current.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>Size: </span>
                    <span style={{ color: '#fff' }}>{pos.size}</span>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>P&L: </span>
                    <span style={{ 
                      color: pos.pnl > 0 ? '#00ff00' : '#ff3333',
                      fontWeight: 'bold'
                    }}>
                      {pos.pnl > 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Trades Tab */}
        {leftPanelTab === 'trades' && (
          <div>
            <div style={{ marginBottom: '8px', color: '#00ff00', fontWeight: 'bold', fontSize: '12px' }}>
              COMPLETED TRADES
            </div>
            {features/tradingData.recentTrades.map((trade, idx) => (
              <div key={idx} style={{
                padding: '8px',
                marginBottom: '6px',
                background: trade.status === 'exceptional' ? 'rgba(255, 215, 0, 0.05)' : 
                          trade.status === 'profit' ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
                borderLeft: `3px solid ${
                  trade.status === 'exceptional' ? '#ffd700' : 
                  trade.status === 'profit' ? '#00ff00' : '#ff3333'
                }`,
                borderRadius: '3px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#888', fontSize: '10px' }}>{trade.time}</span>
                    <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{trade.symbol}</span>
                    <span style={{
                      color: trade.side === 'BUY' ? '#00ff00' : '#ff3333',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {trade.side}
                    </span>
                  </div>
                  <span style={{ 
                    color: trade.status === 'exceptional' ? '#ffd700' : 
                          trade.status === 'profit' ? '#00ff00' : '#ff3333',
                    fontWeight: 'bold'
                  }}>
                    {trade.pnl} {trade.status === 'exceptional' ? '✨' : ''}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#888' }}>
                  {trade.amount} @ ${trade.price}
                </div>
              </div>
            ))}
          </div>
        )}
        
        </div>
      </div>

      {/* Removed old Combined Positions & Trades Panel - Bottom Left */}
      {false && (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
        border: '1px solid #00ff00',
        borderRadius: '8px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 9999,
        width: 'min(380px, 30vw)',
        minWidth: '320px',
        maxWidth: '400px',
        maxHeight: '280px',
        boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          marginBottom: '12px',
          borderBottom: '1px solid rgba(0, 255, 0, 0.3)'
        }}>
          <button
            onClick={() => setDesktopPositionsTab('positions')}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: desktopPositionsTab === 'positions' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: desktopPositionsTab === 'positions' ? '2px solid #00ff00' : '2px solid transparent',
              color: desktopPositionsTab === 'positions' ? '#00ff00' : '#888',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            ⚡ ACTIVE POSITIONS ({features/tradingData.activePositions.length})
          </button>
          <button
            onClick={() => setDesktopPositionsTab('trades')}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: desktopPositionsTab === 'trades' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: desktopPositionsTab === 'trades' ? '2px solid #00ff00' : '2px solid transparent',
              color: desktopPositionsTab === 'trades' ? '#00ff00' : '#888',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            📜 COMPLETED TRADES
          </button>
        </div>
        
        {/* Tab Content */}
        <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
          {desktopPositionsTab === 'positions' && (
            <div>
              {features/tradingData.activePositions.map((pos, idx) => (
                <div key={idx} style={{
                  padding: '8px',
                  marginBottom: '8px',
                  background: pos.pnl > 0 ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
                  border: `1px solid ${pos.pnl > 0 ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'}`,
                  borderRadius: '5px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ color: '#00ff00', fontWeight: 'bold' }}>
                      {pos.symbol}
                    </div>
                    <div style={{
                      padding: '2px 6px',
                      background: pos.side === 'LONG' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
                      color: pos.side === 'LONG' ? '#00ff00' : '#ff3333',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {pos.side}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: '#888' }}>Entry: </span>
                      <span style={{ color: '#fff' }}>${pos.entry.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Current: </span>
                      <span style={{ color: '#fff' }}>${pos.current.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Size: </span>
                      <span style={{ color: '#fff' }}>{pos.size}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>P&L: </span>
                      <span style={{ 
                        color: pos.pnl > 0 ? '#00ff00' : '#ff3333',
                        fontWeight: 'bold'
                      }}>
                        {pos.pnl > 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnlPercent}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {desktopPositionsTab === 'trades' && (
            <div>
              {features/tradingData.recentTrades.map((trade, idx) => (
                <div key={idx} style={{
                  padding: '8px',
                  marginBottom: '6px',
                  background: trade.status === 'exceptional' ? 'rgba(255, 215, 0, 0.05)' : 
                            trade.status === 'profit' ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
                  borderLeft: `3px solid ${
                    trade.status === 'exceptional' ? '#ffd700' : 
                    trade.status === 'profit' ? '#00ff00' : '#ff3333'
                  }`,
                  borderRadius: '3px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#888', fontSize: '10px' }}>{trade.time}</span>
                      <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{trade.symbol}</span>
                      <span style={{
                        color: trade.side === 'BUY' ? '#00ff00' : '#ff3333',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        {trade.side}
                      </span>
                    </div>
                    <span style={{ 
                      color: trade.status === 'exceptional' ? '#ffd700' : 
                            trade.status === 'profit' ? '#00ff00' : '#ff3333',
                      fontWeight: 'bold'
                    }}>
                      {trade.pnl} {trade.status === 'exceptional' ? '✨' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#888' }}>
                    {trade.amount} @ ${trade.price}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}


      {/* Candle Visualization Panel - Bottom Left */}
      <div style={{
          position: 'fixed',
          top: 'calc(50vh + 40px)', // Position below top panel with gap
          left: '20px',
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
          border: '2px solid #00ff00',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '11px',
          zIndex: 9999,
          width: 'min(320px, 25vw)',
          minWidth: '260px',
          maxWidth: '340px',
          // Adjusted height calculation
          height: 'calc(50vh - 80px)', // Use remaining 50% of viewport minus gap and bottom margin
          minHeight: '320px', // Minimum for candle display
          maxHeight: '400px', // Reduced cap to prevent overlap
          boxShadow: '0 0 20px rgba(0, 255, 0, 0.3), inset 0 0 20px rgba(0, 255, 0, 0.05)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
        {/* Header */}
        <div style={{
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(0, 255, 0, 0.3)'
        }}>
          <div style={{
            color: '#00ff00',
            fontWeight: 'bold',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              background: '#00ff00',
              borderRadius: '50%',
              animation: 'pulse 2s infinite',
              boxShadow: '0 0 6px #00ff00'
            }} />
            🕯️ {(() => {
              const currentCandle = candleTab === 'mine' ? currentUserCandle : randomFirestoreData;
              const messageType = currentCandle?.messageType;
              if (messageType) {
                const displayType = messageType.charAt(0).toUpperCase() + messageType.slice(1);
                return `Msg Protocol: ${displayType}`;
              }
              return 'TEMPLE CANDLES';
            })()}
          </div>
          
          {/* Tab Selector */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '8px'
          }}>
            <button
              onClick={() => setCandleTab('mine')}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: candleTab === 'mine' 
                  ? 'linear-gradient(90deg, rgba(0, 255, 0, 0.3) 0%, rgba(0, 255, 0, 0.1) 100%)'
                  : 'rgba(0, 255, 0, 0.05)',
                border: `1px solid ${candleTab === 'mine' ? '#00ff00' : 'rgba(0, 255, 0, 0.2)'}`,
                borderRadius: '4px',
                color: candleTab === 'mine' ? '#00ff00' : '#888',
                fontSize: '10px',
                fontWeight: candleTab === 'mine' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: 'monospace'
              }}
            >
              My Candle
            </button>
            <button
              onClick={() => setCandleTab('community')}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: candleTab === 'community' 
                  ? 'linear-gradient(90deg, rgba(0, 255, 0, 0.3) 0%, rgba(0, 255, 0, 0.1) 100%)'
                  : 'rgba(0, 255, 0, 0.05)',
                border: `1px solid ${candleTab === 'community' ? '#00ff00' : 'rgba(0, 255, 0, 0.2)'}`,
                borderRadius: '4px',
                color: candleTab === 'community' ? '#00ff00' : '#888',
                fontSize: '10px',
                fontWeight: candleTab === 'community' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: 'monospace'
              }}
            >
              All Candles
            </button>
          </div>
        </div>

        {/* Three.js Canvas Container */}
        <div 
          id="candle-visualization-container"
          style={{
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 255, 0, 0.2)',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {candleTab === 'mine' ? (
            currentUserCandle ? (
              <>
                <SingleCandleDisplay 
                  firestoreData={currentUserCandle}
                  isUserCandle={true}
                />
                {/* Navigation controls for multiple candles */}
                {userCandles.length > 1 && (
                  <div style={{
                    position: 'absolute',
                    top: '40px',
                    right: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.9)',
                    borderRadius: '8px',
                    padding: '8px',
                    border: '2px solid #00ff00',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.8)',
                    zIndex: 1000
                  }}>
                    <button
                      onClick={() => {
                        // console.log('Desktop Previous button clicked');
                        setUserCandleIndex(prev => (prev - 1 + userCandles.length) % userCandles.length);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #00ff00 0%, #00dd00 100%)',
                        border: '1px solid #00ff00',
                        borderRadius: '4px',
                        color: '#000',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        minWidth: '40px'
                      }}
                    >
                      ↑ Prev
                    </button>
                    <div style={{
                      color: '#00ff00',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      textShadow: '0 0 5px #00ff00',
                      textAlign: 'center'
                    }}>
                      {userCandleIndex + 1} / {userCandles.length}
                    </div>
                    <button
                      onClick={() => {
                        // console.log('Desktop Next button clicked');
                        setUserCandleIndex(prev => (prev + 1) % userCandles.length);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #00ff00 0%, #00dd00 100%)',
                        border: '1px solid #00ff00',
                        borderRadius: '4px',
                        color: '#000',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        minWidth: '40px'
                      }}
                    >
                      Next ↓
                    </button>
                  </div>
                )}
                {/* Create additional candle button */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '10px'
                }}>
                  <button
                    onClick={() => setShowCompactCandleModal(true)}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      setShowCompactCandleModal(true);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #00ff00 0%, #00dd00 100%)',
                      border: '1px solid #00ff00',
                      borderRadius: '4px',
                      color: '#000',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      minWidth: '50px',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation'
                    }}
                  >
                    + Create
                  </button>
                </div>
              </>
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                padding: '20px'
              }}>
                <div style={{
                  fontSize: '40px',
                  opacity: 0.3
                }}>🕯️</div>
                <div style={{
                  color: '#888',
                  fontSize: '11px',
                  textAlign: 'center',
                  lineHeight: '1.4'
                }}>
                  {!isSignedIn ? 'Sign in to view your candles' : 'You haven\'t lit a candle yet'}
                </div>
                {isSignedIn && (
                  <button
                    onClick={() => setShowCompactCandleModal(true)}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      setShowCompactCandleModal(true);
                    }}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.2) 0%, rgba(0, 255, 0, 0.1) 100%)',
                    border: '1px solid #00ff00',
                    borderRadius: '6px',
                    color: '#00ff00',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    fontFamily: 'monospace',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, rgba(0, 255, 0, 0.3) 0%, rgba(0, 255, 0, 0.2) 100%)';
                    e.target.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, rgba(0, 255, 0, 0.2) 0%, rgba(0, 255, 0, 0.1) 100%)';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  Light Your Candle
                </button>
                )}
              </div>
            )
          ) : (
            <>
              <SingleCandleDisplay 
                firestoreData={randomFirestoreData}
                isUserCandle={false}
              />
              {/* Navigation controls for community candles */}
              {firestoreResults && firestoreResults.length > 1 && (
                <div style={{
                  position: 'absolute',
                  top: '40px',
                  right: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.9)',
                  borderRadius: '8px',
                  padding: '8px',
                  border: '2px solid #00ff00',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.8)',
                  zIndex: 1000
                }}>
                  <button
                    onClick={() => {
                      // console.log('Desktop Community Previous button clicked');
                      setCandleIndex(prev => (prev - 1 + firestoreResults.length) % firestoreResults.length);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #00ff00 0%, #00dd00 100%)',
                      border: '1px solid #00ff00',
                      borderRadius: '4px',
                      color: '#000',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      minWidth: '40px'
                    }}
                  >
                    ↑ Prev
                  </button>
                  <div style={{
                    color: '#00ff00',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    textShadow: '0 0 5px #00ff00',
                    textAlign: 'center'
                  }}>
                    {candleIndex + 1} / {firestoreResults.length}
                  </div>
                  <button
                    onClick={() => {
                      // console.log('Desktop Community Next button clicked');
                      setCandleIndex(prev => (prev + 1) % firestoreResults.length);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #00ff00 0%, #00dd00 100%)',
                      border: '1px solid #00ff00',
                      borderRadius: '4px',
                      color: '#000',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      minWidth: '40px'
                    }}
                  >
                    Next ↓
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Compact Status - Moved to user overlay */}
        {/* <div style={{
          marginTop: '8px',
          padding: '4px 6px',
          background: 'rgba(0, 255, 0, 0.05)',
          borderRadius: '3px',
          border: '1px solid rgba(0, 255, 0, 0.1)'
        }}>
          <div style={{ 
            color: '#888', 
            fontSize: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span><span style={{ color: '#00ff00', fontSize: '7px' }}>●</span> Live</span>
            <span style={{ color: '#666' }}>Cycling Users</span>
          </div>
        </div> */}
      </div>

      {/* Model Chat Panel - Bottom Right - Always Visible */}
      <div style={{
          position: 'fixed',
          top: 'calc(50vh + 40px)', // Position below top panel with gap
          right: '20px',
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
          border: '2px solid #00ff00',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '11px',
          zIndex: 9999,
          width: 'min(320px, 25vw)',
          minWidth: '260px',
          maxWidth: '340px',
          // Match left bottom panel height
          height: 'calc(50vh - 80px)', // Use remaining 50% of viewport minus gap and bottom margin
          minHeight: '250px', // Minimum for chat display
          maxHeight: '400px',
          boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Chat Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            paddingBottom: '10px',
            borderBottom: '2px solid rgba(0, 255, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '13px' }}>
                💬 TRADING TEAM CHAT
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '9px', color: '#666' }}>
                <span title="RL80 - Lead Trader">🤖</span>
                <span title="Sentiment Oracle">🔮</span>
                <span title="Market Analyst">📊</span>
                <span title="Macro Specialist">🌍</span>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                background: '#00ff00',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }} />
              <span style={{ color: '#00ff00', fontSize: '9px' }}>LIVE</span>
            </div>
          </div>
          
          {/* Chat Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {features/tradingData.modelThoughts.map((thought, idx) => {
              // Determine sender based on consultant field or type
              const sender = thought.consultant || 
                           (thought.type === 'sentiment' ? 'sentiment' :
                            thought.type === 'market' ? 'market' :
                            thought.type === 'macro' ? 'macro' : 'rl80');
              
              const isRL80 = sender === 'rl80' || (!thought.consultant && thought.type === 'features/trading');
              
              // Character configs
              const characters = {
                rl80: { name: 'RL80', icon: '🤖', color: '#00ff00', align: 'right' },
                sentiment: { name: 'Sentiment', icon: '🔮', color: '#ff00ff', align: 'left' },
                market: { name: 'Market', icon: '📊', color: '#0096ff', align: 'left' },
                macro: { name: 'Macro', icon: '🌍', color: '#ffdd00', align: 'left' },
                system: { name: 'System', icon: '⚙️', color: '#888', align: 'center' }
              };
              
              const char = characters[sender] || characters.rl80;
              
              return (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: char.align === 'right' ? 'flex-end' : 
                                 char.align === 'center' ? 'center' : 'flex-start',
                  marginBottom: '4px'
                }}>
                  <div style={{
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: char.align === 'right' ? 'row-reverse' : 'row',
                    gap: '6px',
                    alignItems: 'flex-start'
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${char.color}22 0%, ${char.color}44 100%)`,
                      border: `1px solid ${char.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      flexShrink: 0
                    }}>
                      {char.icon}
                    </div>
                    
                    {/* Message Bubble */}
                    <div style={{
                      background: char.align === 'right' ? 
                                `linear-gradient(135deg, ${char.color}15 0%, ${char.color}08 100%)` :
                                'rgba(0, 0, 0, 0.3)',
                      border: `1px solid ${char.color}33`,
                      borderRadius: char.align === 'right' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      padding: '8px 10px',
                      position: 'relative'
                    }}>
                      {/* Sender Name & Time */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                        gap: '12px'
                      }}>
                        <span style={{
                          color: char.color,
                          fontSize: '9px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          {char.name}
                        </span>
                        <span style={{
                          color: '#555',
                          fontSize: '8px'
                        }}>
                          {thought.timestamp}
                        </span>
                      </div>
                      
                      {/* Message Content */}
                      <div style={{
                        color: '#ddd',
                        fontSize: '11px',
                        lineHeight: '1.4'
                      }}>
                        {thought.message}
                      </div>
                      
                      {/* Message Type Badge */}
                      {thought.type && thought.type !== 'features/trading' && (
                        <div style={{
                          marginTop: '4px',
                          display: 'inline-block',
                          padding: '2px 5px',
                          background: 'rgba(0, 0, 0, 0.5)',
                          borderRadius: '3px',
                          fontSize: '8px',
                          color: '#666',
                          textTransform: 'uppercase'
                        }}>
                          {thought.type}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* AI Consultants Panel with Tabs - Top Right */}
      <div style={{
        position: 'fixed',
        top: '120px',
        right: '20px',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
        border: '1px solid #00ff00',
        borderRadius: '8px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 9999,
        width: 'min(320px, 25vw)',
        minWidth: '260px',
        maxWidth: '340px',
        // Match left panel height calculation to prevent overlap
        height: 'calc(50vh - 140px)', // Use 50% of viewport minus top offset and gap
        maxHeight: '400px', // Maximum height to ensure space for bottom panels
        minHeight: '200px',
        boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          marginBottom: '12px',
          borderBottom: '1px solid rgba(0, 255, 0, 0.3)'
        }}>
          <button
            onClick={() => setRightTopTab('market')}
            style={{
              flex: 1,
              padding: '8px',
              background: rightTopTab === 'market' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: rightTopTab === 'market' ? '2px solid #00ff00' : '2px solid transparent',
              color: rightTopTab === 'market' ? '#00ff00' : '#888',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            📊 MARKET
          </button>
          <button
            onClick={() => setRightTopTab('macro')}
            style={{
              flex: 1,
              padding: '8px',
              background: rightTopTab === 'macro' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: rightTopTab === 'macro' ? '2px solid #00ff00' : '2px solid transparent',
              color: rightTopTab === 'macro' ? '#00ff00' : '#888',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            🌍 MACRO
          </button>
          <button
            onClick={() => setRightTopTab('sentiment')}
            style={{
              flex: 1,
              padding: '8px',
              background: rightTopTab === 'sentiment' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: rightTopTab === 'sentiment' ? '2px solid #00ff00' : '2px solid transparent',
              color: rightTopTab === 'sentiment' ? '#00ff00' : '#888',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
          >
            💭 SENTIMENT
          </button>
        </div>
        
        {/* Tab Content Container with Scrolling */}
        <div className="custom-scrollbar" style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          scrollbarWidth: 'thin',
          scrollbarColor: '#00ff00 rgba(0, 255, 0, 0.1)',
          minHeight: '150px'
        }}>
        
        {/* Market Analyst Tab */}
        {rightTopTab === 'market' && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '12px' }}>
                📊 MARKET ANALYST
              </div>
          <div style={{
            padding: '4px 10px',
            background: features/tradingData.macroData.marketRegime === 'RISK_ON' ? 'rgba(0, 255, 0, 0.2)' :
                      features/tradingData.macroData.marketRegime === 'RISK_OFF' ? 'rgba(255, 0, 0, 0.2)' :
                      'rgba(255, 255, 0, 0.2)',
            color: features/tradingData.macroData.marketRegime === 'RISK_ON' ? '#00ff00' :
                  features/tradingData.macroData.marketRegime === 'RISK_OFF' ? '#ff3333' :
                  '#ffdd00',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold'
          }}>
            {features/tradingData.macroData.marketRegime}
          </div>
            </div>
          </>
        )}

        {/* Macro Specialist Tab */}
        {rightTopTab === 'macro' && (
          <>
        {/* Risk Score Bar */}
        <div style={{ marginBottom: '15px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ 
              color: '#888', 
              fontSize: '11px',
              cursor: 'help',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              position: 'relative'
            }}
            title="Click for details"
            onMouseEnter={(e) => {
              const tooltip = e.currentTarget.querySelector('.risk-tooltip');
              if (tooltip) tooltip.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              const tooltip = e.currentTarget.querySelector('.risk-tooltip');
              if (tooltip) tooltip.style.display = 'none';
            }}>
              MARKET RISK APPETITE
              <span style={{ fontSize: '9px', opacity: 0.6 }}>ⓘ</span>
              
              {/* Tooltip */}
              <div className="risk-tooltip" style={{
                display: 'none',
                position: 'absolute',
                top: '20px',
                left: '0',
                width: '280px',
                background: 'rgba(0, 0, 0, 0.95)',
                border: '1px solid #00ff00',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '10px',
                lineHeight: '1.5',
                zIndex: 10000,
                boxShadow: '0 4px 12px rgba(0, 255, 0, 0.2)',
                color: '#ddd'
              }}>
                <div style={{ marginBottom: '8px', color: '#00ff00', fontWeight: 'bold', fontSize: '11px' }}>
                  📊 Live Risk Calculation
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <strong>Components:</strong>
                </div>
                <div style={{ marginLeft: '8px', marginBottom: '8px', fontSize: '9px' }}>
                  • <span style={{ color: '#00ff00' }}>Price Action (20%)</span> - BTC/ETH momentum<br/>
                  • <span style={{ color: '#00ff00' }}>Sentiment (25%)</span> - Fear & Greed Index<br/>
                  • <span style={{ color: '#00ff00' }}>Capital Flows (20%)</span> - Stablecoin in/out<br/>
                  • <span style={{ color: '#00ff00' }}>Volatility (15%)</span> - VIX levels<br/>
                  • <span style={{ color: '#00ff00' }}>Structure (10%)</span> - Funding, OI, dominance<br/>
                  • <span style={{ color: '#00ff00' }}>Macro (10%)</span> - Dollar, traditional markets
                </div>
                
                <div style={{ marginBottom: '6px', borderTop: '1px solid rgba(0, 255, 0, 0.2)', paddingTop: '6px' }}>
                  <strong>Score Ranges:</strong>
                </div>
                <div style={{ fontSize: '9px', lineHeight: '1.6' }}>
                  <span style={{ color: '#ff3333' }}>80-100</span>: Extreme Greed (take profits)<br/>
                  <span style={{ color: '#ff9500' }}>65-79</span>: Greed (stay cautious)<br/>
                  <span style={{ color: '#00ff00' }}>55-64</span>: Risk On (favorable)<br/>
                  <span style={{ color: '#888' }}>45-54</span>: Neutral (wait)<br/>
                  <span style={{ color: '#ffdd00' }}>35-44</span>: Risk Off (reduce)<br/>
                  <span style={{ color: '#ff9500' }}>20-34</span>: Fear (contrarian)<br/>
                  <span style={{ color: '#ff3333' }}>0-19</span>: Extreme Fear (potential bottom)
                </div>
                
                <div style={{ 
                  marginTop: '8px', 
                  paddingTop: '6px', 
                  borderTop: '1px solid rgba(0, 255, 0, 0.2)',
                  fontSize: '9px',
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  Updates every 15 minutes with live market data
                </div>
              </div>
            </span>
            <span style={{ 
              color: features/tradingData.macroData.riskScore > 70 ? '#00ff00' :
                    features/tradingData.macroData.riskScore > 30 ? '#ffdd00' : '#ff3333',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {features/tradingData.macroData.riskScore}/100
            </span>
          </div>
          <div style={{
            height: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${features/tradingData.macroData.riskScore}%`,
              height: '100%',
              background: `linear-gradient(90deg, #ff3333 0%, #ffdd00 50%, #00ff00 100%)`,
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          {/* Fed & Traditional */}
          <div style={{ padding: '8px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '5px' }}>
            <div style={{ color: '#00ff00', fontSize: '10px', marginBottom: '6px', fontWeight: 'bold' }}>
              TRADITIONAL
            </div>
            <div style={{ fontSize: '11px' }}>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>FED: </span>
                <span style={{ color: '#fff' }}>{features/tradingData.macroData.fedRate?.toFixed(2) || '0.00'}%</span>
                <span style={{
                  color: features/tradingData.macroData.fedRateChange < 0 ? '#00ff00' : '#ff3333',
                  marginLeft: '4px'
                }}>
                  ({features/tradingData.macroData.fedRateChange > 0 ? '+' : ''}{features/tradingData.macroData.fedRateChange})
                </span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>DXY: </span>
                <span style={{ color: '#fff' }}>{features/tradingData.macroData.dxy}</span>
                <span style={{
                  color: features/tradingData.macroData.dxyChange < 0 ? '#00ff00' : '#ff3333',
                  marginLeft: '4px',
                  fontSize: '10px'
                }}>
                  {features/tradingData.macroData.dxyChange > 0 ? '↑' : '↓'}
                </span>
              </div>
              <div>
                <span style={{ color: '#888' }}>VIX: </span>
                <span style={{ 
                  color: features/tradingData.macroData.vix < 20 ? '#00ff00' : 
                        features/tradingData.macroData.vix < 30 ? '#ffdd00' : '#ff3333'
                }}>
                  {features/tradingData.macroData.vix}
                </span>
              </div>
            </div>
          </div>

          {/* Crypto Metrics */}
          <div style={{ padding: '8px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '5px' }}>
            <div style={{ color: '#00ff00', fontSize: '10px', marginBottom: '6px', fontWeight: 'bold' }}>
              CRYPTO
            </div>
            <div style={{ fontSize: '11px' }}>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>F&G: </span>
                <span style={{
                  color: features/tradingData.macroData.fearGreed > 70 ? '#00ff00' :
                        features/tradingData.macroData.fearGreed > 30 ? '#ffdd00' : '#ff3333'
                }}>
                  {features/tradingData.macroData.fearGreed} {features/tradingData.macroData.fearGreedText}
                </span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>BTC.D: </span>
                <span style={{ color: '#fff' }}>{features/tradingData.macroData.btcDominance?.toFixed(1) || '0.0'}%</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>Funding: </span>
                <span style={{
                  color: Math.abs(features/tradingData.macroData.fundingRate) > 0.01 ? '#ffdd00' : '#00ff00'
                }}>
                  {(features/tradingData.macroData.fundingRate * 100).toFixed(3)}%
                </span>
              </div>
              <div>
                <span style={{ color: '#888' }}>Open Int: </span>
                <span style={{ color: '#fff' }}>
                  ${features/tradingData.macroData.openInterest?.toFixed(1) || '0.0'}B
                </span>
                {features/tradingData.macroData.openInterestChange !== 0 && (
                  <span style={{
                    color: features/tradingData.macroData.openInterestChange > 0 ? '#00ff00' : '#ff3333',
                    fontSize: '9px',
                    marginLeft: '4px'
                  }}>
                    {features/tradingData.macroData.openInterestChange > 0 ? '+' : ''}
                    {features/tradingData.macroData.openInterestChange?.toFixed(1) || '0.0'}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stablecoin Flows */}
        <div style={{
          padding: '8px',
          background: features/tradingData.macroData.stableFlowDirection === 'IN' ? 
                     'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
          borderRadius: '5px',
          marginBottom: '12px',
          border: `1px solid ${features/tradingData.macroData.stableFlowDirection === 'IN' ? 
                              'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#888', fontSize: '10px' }}>STABLECOIN FLOWS (24H)</div>
              <div style={{
                color: features/tradingData.macroData.stableFlowDirection === 'IN' ? '#00ff00' : '#ff3333',
                fontSize: '16px',
                fontWeight: 'bold'
              }}>
                {features/tradingData.macroData.stableFlowDirection === 'IN' ? '+' : '-'}${features/tradingData.macroData.stableFlow?.toFixed(2) || '0.00'}B
              </div>
            </div>
            <div style={{
              fontSize: '24px',
              color: features/tradingData.macroData.stableFlowDirection === 'IN' ? '#00ff00' : '#ff3333'
            }}>
              {features/tradingData.macroData.stableFlowDirection === 'IN' ? '↗' : '↘'}
            </div>
          </div>
        </div>

        {/* AI Signals */}
        <div style={{
          padding: '10px',
          background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.1) 0%, transparent 100%)',
          borderRadius: '5px',
          border: '1px solid rgba(0, 255, 0, 0.2)'
        }}>
          <div style={{ color: '#00ff00', fontSize: '11px', marginBottom: '8px', fontWeight: 'bold' }}>
            🤖 AI MARKET SIGNALS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {features/tradingData.macroData.signals.map((signal, idx) => {
              // Check if signal is bearish/negative
              const isBearish = signal.toLowerCase().includes('bearish') || 
                               signal.toLowerCase().includes('weakness') || 
                               signal.toLowerCase().includes('outflow') || 
                               signal.toLowerCase().includes('weak') ||
                               signal.toLowerCase().includes('caution') ||
                               signal.toLowerCase().includes('fear');
              
              return (
                <span key={idx} style={{
                  padding: '4px 8px',
                  background: isBearish ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 0, 0.2)',
                  border: isBearish ? '1px solid rgba(255, 0, 0, 0.4)' : '1px solid rgba(0, 255, 0, 0.4)',
                  borderRadius: '4px',
                  color: isBearish ? '#ff3333' : '#00ff00',
                  fontSize: '10px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}>
                  <span style={{ marginRight: '4px' }}>•</span>
                  {signal}
                </span>
              );
            })}
          </div>
          <div style={{
            marginTop: '8px',
            padding: '6px',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '3px',
            fontSize: '10px',
            color: '#888',
            textAlign: 'center'
          }}>
            Risk Multiplier: <span style={{ color: '#00ff00', fontWeight: 'bold' }}>
              {features/tradingData.macroData.riskMultiplier}x
            </span>
          </div>
        </div>
          </>
        )}
        
        {/* Sentiment Oracle Tab */}
        {rightTopTab === 'sentiment' && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '12px' }}>
                💭 SENTIMENT ORACLE
              </div>
              <div style={{
                padding: '2px 6px',
                background: 'rgba(255, 221, 0, 0.2)',
                border: '1px solid rgba(255, 221, 0, 0.4)',
                borderRadius: '3px',
                fontSize: '9px',
                color: '#ffdd00'
              }}>
                GREED • 85%
              </div>
            </div>
            
            {/* Fear & Greed Index */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#888', fontSize: '10px', marginBottom: '6px' }}>FEAR & GREED INDEX</div>
              <div style={{
                padding: '8px',
                background: 'linear-gradient(90deg, #ff3333 0%, #ffdd00 50%, #00ff00 100%)',
                borderRadius: '4px',
                position: 'relative',
                height: '30px'
              }}>
                <div style={{
                  position: 'absolute',
                  left: '72%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '4px',
                  height: '20px',
                  background: '#fff',
                  borderRadius: '2px'
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: '-18px',
                  left: '72%',
                  transform: 'translateX(-50%)',
                  color: '#ffdd00',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  72
                </div>
              </div>
            </div>
            
            {/* Social Metrics */}
            <div style={{ marginBottom: '12px', marginTop: '24px' }}>
              <div style={{ color: '#888', fontSize: '10px', marginBottom: '6px' }}>SOCIAL METRICS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '3px' }}>
                  <div style={{ color: '#888', fontSize: '9px' }}>MENTIONS</div>
                  <div style={{ color: '#00ff00', fontSize: '12px', fontWeight: 'bold' }}>↑ 145%</div>
                </div>
                <div style={{ padding: '6px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '3px' }}>
                  <div style={{ color: '#888', fontSize: '9px' }}>SENTIMENT</div>
                  <div style={{ color: '#00ff00', fontSize: '12px', fontWeight: 'bold' }}>87% +</div>
                </div>
              </div>
            </div>
          </>
        )}
        </div>{/* End of scrollable tab content container */}
      </div>

      {/* Add Candle Modal */}
      {showAddCandleModal && (
        <>
          {/* Background Overlay */}
          <div
            onClick={() => setShowAddCandleModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              zIndex: 10000,
              backdropFilter: 'blur(5px)'
            }}
          />
          
          {/* Modal Content */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
            border: '2px solid #00ff88',
            borderRadius: '12px',
            padding: '30px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 0 40px rgba(0, 255, 136, 0.4)',
            zIndex: 10001
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#00ff88',
              fontSize: '18px',
              fontFamily: 'monospace',
              textAlign: 'center'
            }}>
              🕯️ Light Your Temple Candle
            </h3>
            
            <p style={{
              color: '#888',
              fontSize: '12px',
              lineHeight: '1.5',
              marginBottom: '20px',
              textAlign: 'center',
              fontFamily: 'monospace'
            }}>
              Your candle will be added to the temple.<br/>
              Feature coming soon!
            </p>
            
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowAddCandleModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 255, 136, 0.1) 100%)',
                  border: '1px solid #00ff88',
                  borderRadius: '6px',
                  color: '#00ff88',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.2) 100%)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 255, 136, 0.1) 100%)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
export default TradingOverlay;