import { useEffect, useState, useRef } from 'react';
import { db, collection, onSnapshot, query, orderBy, limit } from '@/utilities/firebaseClient';

const PerformanceDashboard = ({ show = true, onClose }) => {
  const [isMobile, setIsMobile] = useState(false);
  const dashboardRef = useRef(null);
  const [metrics, setMetrics] = useState({
    totalPnL: 0,
    winRate: 0,
    totalTrades: 0,
    wins: 0,
    losses: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    currentStreak: 0,
    bestTrade: null,
    worstTrade: null,
    recentTrades: [],
    equityCurve: [],
    agentScores: {
      emo: { accuracy: 0, contribution: 0 },
      tekno: { accuracy: 0, contribution: 0 },
      macro: { accuracy: 0, contribution: 0 },
      rl80: { accuracy: 0, decisiveness: 0 }
    }
  });

  const [timeFrame, setTimeFrame] = useState('24h'); // 24h, 7d, 30d, all
  const [isLoading, setIsLoading] = useState(true);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch and calculate metrics from Firestore
  useEffect(() => {
    if (!db || !show) return;

    const fetchMetrics = async () => {
      try {
        // Get time boundary based on selected timeframe
        const now = Date.now();
        const timeAgo = {
          '24h': now - 24 * 60 * 60 * 1000,
          '7d': now - 7 * 24 * 60 * 60 * 1000,
          '30d': now - 30 * 24 * 60 * 60 * 1000,
          'all': 0
        }[timeFrame];

        // Query trades collection
        const tradesQuery = query(
          collection(db, 'trades'),
          orderBy('timestamp', 'desc'),
          limit(100)
        );

        const unsubscribe = onSnapshot(tradesQuery, (snapshot) => {
          const trades = [];
          let wins = 0;
          let losses = 0;
          let totalPnL = 0;
          let winSum = 0;
          let lossSum = 0;
          let bestTrade = null;
          let worstTrade = null;
          let currentStreak = 0;
          let streakType = null;
          const equityCurve = [];

          // First collect all trades
          const allTrades = [];
          snapshot.forEach(doc => {
            const trade = { id: doc.id, ...doc.data() };
            if (trade.timestamp && trade.timestamp >= timeAgo) {
              allTrades.push(trade);
            }
          });

          // Sort trades by timestamp (oldest first) for equity curve
          const sortedTrades = [...allTrades].sort((a, b) => a.timestamp - b.timestamp);
          let cumPnL = 0;

          sortedTrades.forEach(trade => {
            if (trade.result) {
              const pnl = trade.result.pnl || 0;
              cumPnL += pnl;
              equityCurve.push({
                timestamp: trade.timestamp,
                value: cumPnL,
                pnl: pnl
              });
            }
          });

          // Now process trades in reverse order (newest first) for other metrics
          allTrades.reverse().forEach(trade => {
            trades.push(trade);
            
            // Calculate metrics if trade has a result
            if (trade.result) {
              const pnl = trade.result.pnl || 0;
              totalPnL += pnl;
              
              if (trade.result.success) {
                wins++;
                winSum += pnl;
                if (streakType === 'win' || streakType === null) {
                  currentStreak = streakType === 'win' ? currentStreak + 1 : 1;
                  streakType = 'win';
                } else {
                  streakType = 'win';
                  currentStreak = 1;
                }
              } else {
                losses++;
                lossSum += Math.abs(pnl);
                if (streakType === 'loss' || streakType === null) {
                  currentStreak = streakType === 'loss' ? currentStreak - 1 : -1;
                  streakType = 'loss';
                } else {
                  streakType = 'loss';
                  currentStreak = -1;
                }
              }
              
              // Track best and worst trades
              if (!bestTrade || pnl > bestTrade.pnl) {
                bestTrade = { ...trade, pnl };
              }
              if (!worstTrade || pnl < worstTrade.pnl) {
                worstTrade = { ...trade, pnl };
              }
            }
          });

          // Calculate derived metrics
          const totalTrades = wins + losses;
          const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
          const avgWin = wins > 0 ? winSum / wins : 0;
          const avgLoss = losses > 0 ? lossSum / losses : 0;
          const profitFactor = lossSum > 0 ? winSum / lossSum : winSum > 0 ? 999 : 0;

          // Calculate agent performance scores
          const agentScores = calculateAgentScores(trades);

          setMetrics({
            totalPnL: totalPnL,
            winRate: winRate,
            totalTrades: totalTrades,
            wins: wins,
            losses: losses,
            avgWin: avgWin,
            avgLoss: avgLoss,
            profitFactor: profitFactor,
            sharpeRatio: calculateSharpe(trades),
            maxDrawdown: calculateMaxDrawdown(trades),
            currentStreak: currentStreak,
            bestTrade: bestTrade,
            worstTrade: worstTrade,
            recentTrades: trades.slice(0, 5),
            equityCurve: equityCurve,
            agentScores: agentScores
          });
          
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching metrics:', error);
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [show, timeFrame]);

  // Helper functions
  const calculateSharpe = (trades) => {
    if (trades.length < 2) return 0;
    const returns = trades
      .filter(t => t.result && t.result.pnl)
      .map(t => t.result.pnl);
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0; // Annualized
  };

  const calculateMaxDrawdown = (trades) => {
    let peak = 0;
    let maxDD = 0;
    let cumPnL = 0;
    
    trades.forEach(trade => {
      if (trade.result && trade.result.pnl) {
        cumPnL += trade.result.pnl;
        if (cumPnL > peak) peak = cumPnL;
        const drawdown = peak > 0 ? ((peak - cumPnL) / peak) * 100 : 0;
        if (drawdown > maxDD) maxDD = drawdown;
      }
    });
    
    return maxDD;
  };

  const calculateAgentScores = (trades) => {
    const scores = {
      emo: { correct: 0, total: 0 },
      tekno: { correct: 0, total: 0 },
      macro: { correct: 0, total: 0 },
      rl80: { correct: 0, total: 0 }
    };
    
    trades.forEach(trade => {
      if (trade.preAnalysis && trade.result) {
        const success = trade.result.success;
        
        // Check EMO sentiment
        if (trade.preAnalysis.emoScore !== undefined) {
          scores.emo.total++;
          if ((trade.preAnalysis.emoScore > 60 && success) || 
              (trade.preAnalysis.emoScore < 40 && !success)) {
            scores.emo.correct++;
          }
        }
        
        // Check TEKNO technical
        if (trade.preAnalysis.teknoScore !== undefined) {
          scores.tekno.total++;
          if ((trade.preAnalysis.teknoScore > 60 && success) || 
              (trade.preAnalysis.teknoScore < 40 && !success)) {
            scores.tekno.correct++;
          }
        }
        
        // Check MACRO
        if (trade.preAnalysis.macroScore !== undefined) {
          scores.macro.total++;
          if ((trade.preAnalysis.macroScore > 60 && success) || 
              (trade.preAnalysis.macroScore < 40 && !success)) {
            scores.macro.correct++;
          }
        }
        
        // RL80 decision accuracy
        if (trade.preAnalysis.rl80Decision) {
          scores.rl80.total++;
          const wasBullish = trade.preAnalysis.rl80Decision.includes('BUY');
          if ((wasBullish && success) || (!wasBullish && !success)) {
            scores.rl80.correct++;
          }
        }
      }
    });
    
    return {
      emo: { 
        accuracy: scores.emo.total > 0 ? (scores.emo.correct / scores.emo.total) * 100 : 0,
        contribution: scores.emo.correct 
      },
      tekno: { 
        accuracy: scores.tekno.total > 0 ? (scores.tekno.correct / scores.tekno.total) * 100 : 0,
        contribution: scores.tekno.correct 
      },
      macro: { 
        accuracy: scores.macro.total > 0 ? (scores.macro.correct / scores.macro.total) * 100 : 0,
        contribution: scores.macro.correct 
      },
      rl80: { 
        accuracy: scores.rl80.total > 0 ? (scores.rl80.correct / scores.rl80.total) * 100 : 0,
        decisiveness: scores.rl80.total 
      }
    };
  };

  if (!show) return null;

  // Add floating animation after initial mount
  useEffect(() => {
    // Small delay to ensure proper positioning before animation
    const timer = setTimeout(() => {
      if (dashboardRef.current) {
        dashboardRef.current.style.opacity = '1';
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      ref={dashboardRef}
      style={{
      width: isMobile ? '100vw' : 'auto',
      maxWidth: isMobile ? '100vw' : '1200px',
      margin: '0 auto',
      padding: isMobile ? '15px' : '15px',
      background: 'rgba(0, 20, 15, 0.1)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: isMobile ? '0' : '20px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: isMobile ? '0 8px 32px rgba(0, 255, 255, 0.1)' : '0 8px 32px rgba(0, 255, 255, 0.1), inset 0 0 32px rgba(255, 215, 0, 0.03)',
      color: '#fff',
      fontFamily: 'monospace',
      position: 'fixed',
      top: isMobile ? '0' : '50%',
      left: isMobile ? '0' : '50%',
      transform: isMobile ? 'none' : 'translate(-50%, -50%)',
      zIndex: 1000,
      height: isMobile ? '100vh' : 'auto',
      maxHeight: isMobile ? '100vh' : '90vh',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255, 215, 0, 0.3) transparent',
      overflow: isMobile ? 'auto' : 'hidden',
      opacity: '0',
      animation: isMobile ? 'fadeInMobile 0.5s ease-out forwards' : 'fadeIn 0.4s ease-out forwards, float 6s ease-in-out infinite'
    }}
    onMouseEnter={(e) => {
      if (!isMobile) {
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 255, 255, 0.2), inset 0 0 40px rgba(255, 215, 0, 0.05)';
      }
    }}
    onMouseLeave={(e) => {
      if (!isMobile) {
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 255, 255, 0.1), inset 0 0 32px rgba(255, 215, 0, 0.03)';
      }
    }}>
      {/* Add animated background gradient */}
      {!isMobile && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 255, 255, 0.03) 0%, transparent 70%)',
          animation: 'pulse 4s ease-in-out infinite',
          pointerEvents: 'none',
          borderRadius: 'inherit'
        }} />
      )}
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        marginBottom: isMobile ? '10px' : '15px',
        borderBottom: '1px solid rgba(0, 255, 200, 0.1)',
        background: 'linear-gradient(90deg, rgba(0, 255, 200, 0.03) 0%, transparent 100%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '10px',
        paddingTop: '10px',
        paddingRight: '10px',
        paddingBottom: isMobile ? '8px' : '10px',
        paddingLeft: '10px',
        gap: isMobile ? '10px' : '0',
        position: 'relative'
      }}>
        {/* Close Button - Mobile Only */}
        {onClose && isMobile && (
          <button
            onClick={onClose}
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
            color: '#00FFB8', 
            margin: 0, 
            fontSize: isMobile ? '16px' : '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textShadow: '0 0 20px rgba(0, 255, 184, 0.5)',
            letterSpacing: '1px'
          }}>
            ⚡ {isMobile ? 'RL80 Dashboard' : 'RL80 Dashboard'}
          </h2>
          {!isMobile && (
            <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
              Multi-Agent Trading System Analytics
            </div>
          )}
        </div>
        
        {/* Timeframe Selector */}
        <div style={{ display: 'flex', gap: isMobile ? '4px' : '8px', justifyContent: isMobile ? 'space-between' : 'flex-end', paddingRight: isMobile ? '40px' : '0' }}>
          {['24h', '7d', '30d', 'all'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              style={{
                padding: isMobile ? '5px 10px' : '6px 12px',
                background: timeFrame === tf ? 'rgba(0, 255, 184, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: timeFrame === tf ? '#00FFB8' : 'rgba(255, 255, 255, 0.7)',
                border: `1px solid ${timeFrame === tf ? 'rgba(0, 255, 184, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                boxShadow: timeFrame === tf ? '0 0 15px rgba(0, 255, 184, 0.3)' : 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                flex: isMobile ? '1' : 'none'
              }}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚙️</div>
          Loading performance data...
        </div>
      ) : (
        <div>
          {/* Main P&L Card - Full Width */}
          <div style={{
            background: 'rgba(0, 40, 30, 0.3)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            padding: isMobile ? '12px' : '15px',
            borderRadius: '15px',
            border: '1px solid rgba(0, 255, 184, 0.1)',
            boxShadow: '0 4px 20px rgba(0, 255, 184, 0.1), inset 0 0 20px rgba(0, 255, 184, 0.02)',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: isMobile ? '12px' : '15px'
          }}>
            {/* Total P&L */}
            <div>
              <div style={{ color: '#888', fontSize: isMobile ? '9px' : '10px', marginBottom: '6px', textTransform: 'uppercase' }}>
                Total P&L
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '28px',
                fontWeight: 'bold',
                color: metrics.totalPnL >= 0 ? '#00ff00' : '#ff3333',
                marginBottom: '4px',
                textShadow: metrics.totalPnL >= 0 ? '0 0 15px rgba(0, 255, 0, 0.6)' : '0 0 15px rgba(255, 51, 51, 0.6)'
              }}>
                {metrics.totalPnL >= 0 ? '+' : ''}{metrics.totalPnL.toFixed(2)}%
              </div>
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                color: 'rgba(255, 255, 255, 0.3)', 
                fontSize: '10px',
                alignItems: 'center'
              }}>
                <span>{metrics.totalTrades} trades</span>
                <span>•</span>
                <span>{timeFrame.toUpperCase()}</span>
              </div>
            </div>

            {/* Win Rate with Visual Bar */}
            <div>
              <div style={{ color: '#888', fontSize: isMobile ? '9px' : '10px', marginBottom: '6px', textTransform: 'uppercase' }}>
                Win Rate
              </div>
              <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
                {metrics.winRate.toFixed(0)}%
              </div>
              {/* Win/Loss Bar */}
              <div style={{ 
                display: 'flex', 
                height: '6px', 
                borderRadius: '3px',
                overflow: 'hidden',
                background: 'rgba(255, 51, 51, 0.3)'
              }}>
                <div style={{
                  width: `${metrics.winRate}%`,
                  background: '#00ff00',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginTop: '5px',
                fontSize: '10px',
                color: '#666'
              }}>
                <span>{metrics.wins}W</span>
                <span>{metrics.losses}L</span>
              </div>
            </div>

            {/* Current Streak */}
            <div style={{
              background: metrics.currentStreak > 0 ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              padding: isMobile ? '10px' : '12px',
              borderRadius: '10px',
              border: `1px solid ${metrics.currentStreak > 0 ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)'}`,
              boxShadow: metrics.currentStreak > 0 ? '0 0 20px rgba(0, 255, 0, 0.15)' : '0 0 20px rgba(255, 0, 0, 0.15)'
            }}>
              <div style={{ color: '#888', fontSize: isMobile ? '9px' : '10px', marginBottom: '6px', textTransform: 'uppercase' }}>
                Current Streak
              </div>
              <div style={{
                fontSize: isMobile ? '24px' : '28px',
                fontWeight: 'bold',
                color: metrics.currentStreak > 0 ? '#00ff00' : '#ff3333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {Math.abs(metrics.currentStreak)}
                <span style={{ fontSize: isMobile ? '16px' : '18px' }}>
                  {metrics.currentStreak > 0 ? '🔥' : '❄️'}
                </span>
              </div>
              <div style={{ color: '#666', fontSize: '9px', marginTop: '3px' }}>
                {metrics.currentStreak > 0 ? 'Consecutive Wins' : 
                 metrics.currentStreak < 0 ? 'Consecutive Losses' : 'No Streak'}
              </div>
            </div>
          </div>

          {/* Equity Curve Chart - Compact */}
          <div style={{
              background: 'rgba(0, 20, 40, 0.3)',
              backdropFilter: 'blur(15px)',
              WebkitBackdropFilter: 'blur(15px)',
              padding: isMobile ? '10px' : '12px',
              borderRadius: '15px',
              border: '1px solid rgba(0, 255, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 255, 184, 0.05), inset 0 0 20px rgba(0, 20, 40, 0.05)',
              marginTop: isMobile ? '10px' : '12px'
            }}>
              <div style={{ 
                color: '#888', 
                fontSize: isMobile ? '9px' : '10px', 
                marginBottom: '8px', 
                textTransform: 'uppercase',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>📈 Equity Curve</span>
                <span style={{ color: '#00FFB8', fontSize: '12px' }}>
                  {metrics.equityCurve.length > 0 ? 
                    `${metrics.equityCurve[metrics.equityCurve.length - 1].value >= 0 ? '+' : ''}${metrics.equityCurve[metrics.equityCurve.length - 1].value.toFixed(2)}%` :
                    'No data yet'
                  }
                </span>
              </div>
              
              {/* SVG Chart */}
              {metrics.equityCurve.length > 0 ? (
              <>
              <div style={{ position: 'relative', width: '100%', height: isMobile ? '100px' : '120px' }}>
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox={`0 0 ${isMobile ? 350 : 800} ${isMobile ? 100 : 120}`}
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={`${y}%`}
                      x2="100%"
                      y2={`${y}%`}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="2,4"
                    />
                  ))}
                  
                  {/* Zero line */}
                  <line
                    x1="0"
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="1"
                  />
                  
                  {/* Create path for equity curve */}
                  {(() => {
                    const width = isMobile ? 350 : 800;
                    const height = isMobile ? 100 : 120;
                    const padding = 10;
                    
                    // Find min and max values for scaling
                    const values = metrics.equityCurve.map(d => d.value);
                    const minValue = Math.min(...values, 0);
                    const maxValue = Math.max(...values, 0);
                    const range = maxValue - minValue || 1;
                    
                    // Create points for the line
                    const points = metrics.equityCurve.map((data, index) => {
                      const x = (index / (metrics.equityCurve.length - 1 || 1)) * (width - 2 * padding) + padding;
                      const y = height - ((data.value - minValue) / range * (height - 2 * padding) + padding);
                      return `${x},${y}`;
                    }).join(' ');
                    
                    // Create area under curve
                    const areaPoints = metrics.equityCurve.map((data, index) => {
                      const x = (index / (metrics.equityCurve.length - 1 || 1)) * (width - 2 * padding) + padding;
                      const y = height - ((data.value - minValue) / range * (height - 2 * padding) + padding);
                      return { x, y };
                    });
                    
                    const zeroY = height - ((0 - minValue) / range * (height - 2 * padding) + padding);
                    const areaPath = areaPoints.length > 0 ? 
                      `M ${areaPoints[0].x},${zeroY} ` +
                      areaPoints.map(p => `L ${p.x},${p.y}`).join(' ') +
                      ` L ${areaPoints[areaPoints.length - 1].x},${zeroY} Z` : '';
                    
                    const isPositive = metrics.equityCurve[metrics.equityCurve.length - 1]?.value >= 0;
                    
                    return (
                      <>
                        {/* Gradient definition */}
                        <defs>
                          <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop 
                              offset="0%" 
                              stopColor={isPositive ? '#00ff00' : '#ff3333'} 
                              stopOpacity="0.3"
                            />
                            <stop 
                              offset="100%" 
                              stopColor={isPositive ? '#00ff00' : '#ff3333'} 
                              stopOpacity="0.02"
                            />
                          </linearGradient>
                        </defs>
                        
                        {/* Area under curve */}
                        <path
                          d={areaPath}
                          fill="url(#equityGradient)"
                        />
                        
                        {/* Main curve line */}
                        <polyline
                          points={points}
                          fill="none"
                          stroke={isPositive ? '#00ff00' : '#ff3333'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            filter: `drop-shadow(0 0 8px ${isPositive ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 51, 51, 0.5)'})`
                          }}
                        />
                        
                        {/* Points on the line */}
                        {metrics.equityCurve.length <= 20 && metrics.equityCurve.map((data, index) => {
                          const x = (index / (metrics.equityCurve.length - 1 || 1)) * (width - 2 * padding) + padding;
                          const y = height - ((data.value - minValue) / range * (height - 2 * padding) + padding);
                          return (
                            <circle
                              key={index}
                              cx={x}
                              cy={y}
                              r="3"
                              fill={data.pnl >= 0 ? '#00ff00' : '#ff3333'}
                              stroke="rgba(0, 0, 0, 0.5)"
                              strokeWidth="1"
                              style={{ cursor: 'pointer' }}
                            >
                              <title>{`P&L: ${data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}%\nCumulative: ${data.value >= 0 ? '+' : ''}${data.value.toFixed(2)}%`}</title>
                            </circle>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                
                {/* Y-axis labels */}
                <div style={{
                  position: 'absolute',
                  left: '-30px',
                  top: '0',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontSize: '8px',
                  color: '#666'
                }}>
                  {(() => {
                    const values = metrics.equityCurve.map(d => d.value);
                    const minValue = Math.min(...values, 0);
                    const maxValue = Math.max(...values, 0);
                    return (
                      <>
                        <span>{maxValue.toFixed(0)}%</span>
                        <span>{((maxValue + minValue) / 2).toFixed(0)}%</span>
                        <span>{minValue.toFixed(0)}%</span>
                      </>
                    );
                  })()}
                </div>
              </div>
              {/* Statistics below chart */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '9px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>Start</div>
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>0%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>Peak</div>
                  <div style={{ color: '#00ff00', fontWeight: 'bold' }}>
                    +{Math.max(...metrics.equityCurve.map(d => d.value), 0).toFixed(1)}%
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>Trough</div>
                  <div style={{ color: '#ff3333', fontWeight: 'bold' }}>
                    {Math.min(...metrics.equityCurve.map(d => d.value), 0).toFixed(1)}%
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>Current</div>
                  <div style={{ 
                    color: metrics.equityCurve[metrics.equityCurve.length - 1]?.value >= 0 ? '#00ff00' : '#ff3333', 
                    fontWeight: 'bold' 
                  }}>
                    {metrics.equityCurve[metrics.equityCurve.length - 1]?.value >= 0 ? '+' : ''}
                    {metrics.equityCurve[metrics.equityCurve.length - 1]?.value.toFixed(1)}%
                  </div>
                </div>
              </div>
              </>
            ) : (
              <div style={{
                color: 'rgba(255, 255, 255, 0.3)',
                textAlign: 'center',
                padding: isMobile ? '20px 15px' : '25px 20px',
                fontSize: '11px'
              }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>📊</div>
                No equity curve data yet. Start features/trading to see your performance!
              </div>
            )}
          </div>

          {/* 2x2 Grid Section - Stacks on mobile */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? '10px' : '12px',
            marginTop: isMobile ? '10px' : '12px'
          }}>
            {/* Council Performance */}
            <div style={{
            background: 'rgba(147, 51, 234, 0.05)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            padding: isMobile ? '10px' : '12px',
            borderRadius: '15px',
            border: '1px solid rgba(147, 51, 234, 0.2)',
            boxShadow: '0 4px 20px rgba(147, 51, 234, 0.15), inset 0 0 20px rgba(147, 51, 234, 0.05)'
          }}>
            <div style={{ 
              color: '#9333ea', 
              fontSize: isMobile ? '12px' : '13px', 
              marginBottom: isMobile ? '10px' : '12px', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🤝</span> COUNCIL PERFORMANCE
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '12px' 
            }}>
              {/* EMO */}
              <div style={{
                background: 'rgba(147, 51, 234, 0.03)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '10px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid rgba(147, 51, 234, 0.15)',
                boxShadow: '0 0 15px rgba(147, 51, 234, 0.1)'
              }}>
                <div style={{ color: '#9333ea', fontSize: '10px', marginBottom: '6px' }}>
                  EMO
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                  {metrics.agentScores.emo.accuracy.toFixed(0)}%
                </div>
                {/* Accuracy Bar */}
                <div style={{ 
                  height: '3px', 
                  background: 'rgba(147, 51, 234, 0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.agentScores.emo.accuracy}%`,
                    height: '100%',
                    background: '#9333ea',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ color: '#666', fontSize: '8px', marginTop: '4px' }}>
                  Sentiment Analysis
                </div>
              </div>

              {/* TEKNO */}
              <div style={{
                background: 'rgba(0, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '10px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid rgba(0, 255, 255, 0.15)',
                boxShadow: '0 0 15px rgba(0, 255, 255, 0.1)'
              }}>
                <div style={{ color: '#00ffff', fontSize: '10px', marginBottom: '6px' }}>
                  TEKNO
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                  {metrics.agentScores.tekno.accuracy.toFixed(0)}%
                </div>
                <div style={{ 
                  height: '4px', 
                  background: 'rgba(0, 255, 255, 0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.agentScores.tekno.accuracy}%`,
                    height: '100%',
                    background: '#00ffff',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ color: '#666', fontSize: '8px', marginTop: '4px' }}>
                  Technical Analysis
                </div>
              </div>

              {/* MACRO */}
              <div style={{
                background: 'rgba(0, 255, 0, 0.03)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '10px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid rgba(0, 255, 0, 0.15)',
                boxShadow: '0 0 15px rgba(0, 255, 0, 0.1)'
              }}>
                <div style={{ color: '#00ff00', fontSize: '10px', marginBottom: '6px' }}>
                  MACRO
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                  {metrics.agentScores.macro.accuracy.toFixed(0)}%
                </div>
                <div style={{ 
                  height: '4px', 
                  background: 'rgba(0, 255, 0, 0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.agentScores.macro.accuracy}%`,
                    height: '100%',
                    background: '#00ff00',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ color: '#666', fontSize: '8px', marginTop: '4px' }}>
                  Economic Analysis
                </div>
              </div>

              {/* RL80 */}
              <div style={{
                background: 'rgba(255, 215, 0, 0.05)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '10px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                boxShadow: isMobile ? '0 0 10px rgba(255, 215, 0, 0.1)' : '0 0 20px rgba(255, 215, 0, 0.15)'
              }}>
                <div style={{ color: '#FFD700', fontSize: '10px', marginBottom: '6px' }}>
                  RL80 ⚡
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                  {metrics.agentScores.rl80.accuracy.toFixed(0)}%
                </div>
                <div style={{ 
                  height: '4px', 
                  background: 'rgba(255, 215, 0, 0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.agentScores.rl80.accuracy}%`,
                    height: '100%',
                    background: '#FFD700',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ color: '#666', fontSize: '8px', marginTop: '4px' }}>
                  Master Coordinator
                </div>
              </div>
            </div>
          </div>

            {/* Risk Metrics Card */}
            <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            padding: isMobile ? '12px' : '15px',
            borderRadius: '15px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 255, 255, 0.05), inset 0 0 20px rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ 
              color: '#888', 
              fontSize: '12px', 
              marginBottom: '15px', 
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              📊 Risk Metrics
            </div>
            
            {/* Profit Factor */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '5px'
              }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Profit Factor</span>
                <span style={{ color: '#0096ff', fontSize: '14px', fontWeight: 'bold' }}>
                  {metrics.profitFactor > 100 ? '∞' : metrics.profitFactor.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Sharpe Ratio */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '5px'
              }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Sharpe Ratio</span>
                <span style={{ color: '#FFD700', fontSize: '14px', fontWeight: 'bold' }}>
                  {metrics.sharpeRatio.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Max Drawdown */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '5px'
              }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Max Drawdown</span>
                <span style={{ color: '#ff3333', fontSize: '14px', fontWeight: 'bold' }}>
                  -{metrics.maxDrawdown.toFixed(1)}%
                </span>
              </div>
              {/* Drawdown visualization */}
              <div style={{ 
                height: '4px', 
                background: 'rgba(255, 51, 51, 0.2)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min(metrics.maxDrawdown, 100)}%`,
                  height: '100%',
                  background: '#ff3333'
                }} />
              </div>
            </div>

            {/* Win/Loss Ratio */}
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '5px'
              }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Avg Win/Loss</span>
                <span style={{ color: '#00ff00', fontSize: '14px', fontWeight: 'bold' }}>
                  {metrics.avgLoss > 0 ? (metrics.avgWin / metrics.avgLoss).toFixed(2) : '∞'}
                </span>
              </div>
            </div>
          </div>

            {/* Recent Trades Card */}
            <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            padding: isMobile ? '12px' : '15px',
            borderRadius: '15px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 255, 255, 0.05), inset 0 0 20px rgba(255, 255, 255, 0.02)',
            maxHeight: isMobile ? '150px' : '160px',
            overflowY: 'auto'
          }}>
            <div style={{ 
              color: '#888', 
              fontSize: '12px', 
              marginBottom: '15px', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>📈 Recent Trades</span>
              <span style={{ color: '#666', fontSize: '10px', fontWeight: 'normal' }}>
                Last 5
              </span>
            </div>
            
            {metrics.recentTrades.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {metrics.recentTrades.map((trade, i) => (
                  <div key={trade.id || i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    backdropFilter: 'blur(5px)',
                    WebkitBackdropFilter: 'blur(5px)',
                    borderRadius: '10px',
                    borderLeft: `3px solid ${trade.result?.success ? '#00ff00' : '#ff3333'}`,
                    transition: 'all 0.3s',
                    cursor: 'pointer',
                    boxShadow: trade.result?.success ? '0 0 10px rgba(0, 255, 0, 0.1)' : '0 0 10px rgba(255, 51, 51, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.transform = 'translateX(5px)';
                      e.currentTarget.style.boxShadow = trade.result?.success ? '0 0 20px rgba(0, 255, 0, 0.2)' : '0 0 20px rgba(255, 51, 51, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = trade.result?.success ? '0 0 10px rgba(0, 255, 0, 0.1)' : '0 0 10px rgba(255, 51, 51, 0.1)';
                    }
                  }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ 
                        color: trade.result?.success ? '#00ff00' : '#ff3333',
                        fontSize: '16px'
                      }}>
                        {trade.result?.success ? '✓' : '✗'}
                      </div>
                      <div>
                        <div style={{ color: '#ddd', fontSize: '12px', marginBottom: '2px' }}>
                          {trade.plannedTrade?.asset || 'BTC'} {trade.plannedTrade?.direction || 'N/A'}
                        </div>
                        <div style={{ color: '#666', fontSize: '10px' }}>
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      color: trade.result?.pnl >= 0 ? '#00ff00' : '#ff3333',
                      fontWeight: 'bold',
                      fontSize: '13px'
                    }}>
                      {trade.result?.pnl >= 0 ? '+' : ''}{trade.result?.pnl?.toFixed(2) || '0.00'}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.3)', 
                textAlign: 'center', 
                padding: '40px 20px',
                fontSize: '12px'
              }}>
                No trades in selected timeframe
              </div>
            )}
          </div>

          {/* Best/Worst Trades Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            padding: isMobile ? '12px' : '15px',
            borderRadius: '15px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 255, 255, 0.05), inset 0 0 20px rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ 
              color: '#888', 
              fontSize: '12px', 
              marginBottom: '15px', 
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              🎯 Best & Worst Trades
            </div>
            
            {/* Best Trade */}
            {metrics.bestTrade && (
              <div style={{
                marginBottom: '20px',
                padding: '12px',
                background: 'rgba(0, 255, 0, 0.03)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '12px',
                borderLeft: '3px solid #00ff00',
                boxShadow: '0 0 20px rgba(0, 255, 0, 0.1)'
              }}>
                <div style={{ color: '#00ff00', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Best Performance
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', marginBottom: '2px' }}>
                      {metrics.bestTrade.plannedTrade?.asset || 'BTC'} {metrics.bestTrade.plannedTrade?.direction || 'LONG'}
                    </div>
                    <div style={{ color: '#666', fontSize: '10px' }}>
                      {new Date(metrics.bestTrade.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{
                    fontSize: isMobile ? '18px' : '20px',
                    fontWeight: 'bold',
                    color: '#00ff00',
                    textShadow: '0 0 10px rgba(0, 255, 0, 0.6)'
                  }}>
                    +{metrics.bestTrade.pnl?.toFixed(2)}%
                  </div>
                </div>
              </div>
            )}
            
            {/* Worst Trade */}
            {metrics.worstTrade && (
              <div style={{
                padding: '12px',
                background: 'rgba(255, 0, 0, 0.03)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '12px',
                borderLeft: '3px solid #ff3333',
                boxShadow: '0 0 20px rgba(255, 0, 0, 0.1)'
              }}>
                <div style={{ color: '#ff3333', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Worst Performance
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', marginBottom: '2px' }}>
                      {metrics.worstTrade.plannedTrade?.asset || 'BTC'} {metrics.worstTrade.plannedTrade?.direction || 'SHORT'}
                    </div>
                    <div style={{ color: '#666', fontSize: '10px' }}>
                      {new Date(metrics.worstTrade.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{
                    fontSize: isMobile ? '18px' : '20px',
                    fontWeight: 'bold',
                    color: '#ff3333',
                    textShadow: '0 0 10px rgba(255, 51, 51, 0.6)'
                  }}>
                    {metrics.worstTrade.pnl?.toFixed(2)}%
                  </div>
                </div>
              </div>
            )}
            
            {!metrics.bestTrade && !metrics.worstTrade && (
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.3)', 
                textAlign: 'center', 
                padding: '40px 20px',
                fontSize: '12px'
              }}>
                No trades to display
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;

// Add CSS animations
if (typeof document !== 'undefined' && !document.getElementById('dashboard-animations')) {
  const style = document.createElement('style');
  style.id = 'dashboard-animations';
  style.innerHTML = `
    @keyframes float {
      0%, 100% { transform: translate(-50%, -50%); }
      50% { transform: translate(-50%, calc(-50% - 10px)); }
    }
    
    @keyframes fadeIn {
      0% { 
        opacity: 0; 
        transform: translate(-50%, -50%) scale(0.98);
      }
      100% { 
        opacity: 1; 
        transform: translate(-50%, -50%) scale(1);
      }
    }
    
    @keyframes fadeInMobile {
      0% { 
        opacity: 0; 
        transform: scale(0.95);
      }
      100% { 
        opacity: 1; 
        transform: scale(1);
      }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.8; }
    }
    
    @keyframes glow {
      0%, 100% { 
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
      }
      50% { 
        box-shadow: 0 0 25px rgba(255, 215, 0, 0.5);
      }
    }
  `;
  document.head.appendChild(style);
}