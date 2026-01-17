// Hook to fetch real Mainnet Readiness metrics from Firebase
import { useState, useEffect } from 'react';
import { db, collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc } from '@/lib/firebaseClient';

export const useMainnetReadiness = () => {
  const [metrics, setMetrics] = useState({
    totalTrades: 0,
    winRate: 0,
    maxDrawdown: 0,
    daysLive: 0,
    loading: true,
    lastUpdate: null
  });

  const [systemStartDate, setSystemStartDate] = useState(null);

  useEffect(() => {
    if (!db) {
      console.log('Firebase not available for mainnet readiness metrics');
      setMetrics(prev => ({ ...prev, loading: false }));
      return;
    }

    let unsubscribeTrades = null;

    const fetchMetrics = async () => {
      try {
        // First, get or set the system start date
        const systemRef = doc(db, 'systemConfig', 'mainnet');
        let systemDoc = await getDoc(systemRef);
        let startDate;

        if (!systemDoc.exists()) {
          // If no start date exists, set it to today (first time setup)
          startDate = new Date();
          await setDoc(systemRef, {
            startDate: startDate.toISOString(),
            description: 'Mainnet readiness tracking start date',
            createdAt: new Date().toISOString()
          });
          console.log('🚀 System start date initialized:', startDate.toISOString());
        } else {
          startDate = new Date(systemDoc.data().startDate);
          console.log('📅 System start date loaded:', startDate.toISOString());
        }

        setSystemStartDate(startDate);

        // Calculate days live
        const now = new Date();
        const daysLive = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

        // Listen to multiple collections for trading data
        const trades = [];
        let tradesProcessed = 0;
        const expectedSources = 2; // trades and rl80_executions

        const processAllTrades = () => {
          tradesProcessed++;
          if (tradesProcessed >= expectedSources) {
            // Calculate metrics from all trades
            const calculatedMetrics = calculateMainnetMetrics(trades, daysLive);
            
            setMetrics({
              ...calculatedMetrics,
              daysLive,
              loading: false,
              lastUpdate: new Date().toISOString()
            });

            console.log('✅ Mainnet readiness metrics updated:', calculatedMetrics);
          }
        };

        // Listen to general trades collection
        try {
          const tradesQuery = query(
            collection(db, 'trades'),
            orderBy('timestamp', 'desc'),
            limit(1000)
          );

          unsubscribeTrades = onSnapshot(tradesQuery, (snapshot) => {
            console.log('📊 General trades snapshot received, size:', snapshot.size);
            
            // Clear existing general trades and add new ones
            const startIndex = trades.findIndex(t => t.source === 'general');
            if (startIndex >= 0) {
              const endIndex = trades.findLastIndex(t => t.source === 'general');
              trades.splice(startIndex, endIndex - startIndex + 1);
            }

            snapshot.forEach(doc => {
              const trade = { id: doc.id, source: 'general', ...doc.data() };
              trades.push(trade);
            });

            processAllTrades();
          }, (error) => {
            console.log('⚠️ General trades collection not found or error:', error.message);
            processAllTrades(); // Continue anyway
          });
        } catch (error) {
          console.log('⚠️ Error setting up general trades listener:', error.message);
          processAllTrades();
        }

        // Also listen to RL80 executions
        try {
          const rl80Query = query(
            collection(db, 'lighterData/trades/rl80_executions'),
            orderBy('timestamp', 'desc'),
            limit(1000)
          );

          const unsubscribeRL80 = onSnapshot(rl80Query, (snapshot) => {
            console.log('🤖 RL80 executions snapshot received, size:', snapshot.size);
            
            // Clear existing RL80 trades and add new ones
            const startIndex = trades.findIndex(t => t.source === 'rl80');
            if (startIndex >= 0) {
              const endIndex = trades.findLastIndex(t => t.source === 'rl80');
              trades.splice(startIndex, endIndex - startIndex + 1);
            }

            snapshot.forEach(doc => {
              const execution = doc.data();
              if (execution.success && execution.result) {
                const trade = { 
                  id: doc.id, 
                  source: 'rl80',
                  timestamp: execution.timestamp || doc.data().timestamp,
                  result: execution.result,
                  ...execution.rl80Decision
                };
                trades.push(trade);
              }
            });

            processAllTrades();
          }, (error) => {
            console.log('⚠️ RL80 executions collection not found or error:', error.message);
            processAllTrades(); // Continue anyway
          });
        } catch (error) {
          console.log('⚠️ Error setting up RL80 executions listener:', error.message);
          processAllTrades();
        }

        return () => {
          if (unsubscribeTrades) unsubscribeTrades();
          if (unsubscribeRL80) unsubscribeRL80();
        };

      } catch (error) {
        console.error('❌ Error fetching mainnet readiness metrics:', error);
        setMetrics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchMetrics();

  }, [db]);

  return metrics;
};

// Calculate mainnet readiness metrics from trades data
function calculateMainnetMetrics(trades, daysLive) {
  console.log('🧮 Calculating mainnet metrics from', trades.length, 'trades');

  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      maxDrawdown: 0
    };
  }

  let totalTrades = 0;
  let winningTrades = 0;
  let cumulativePnL = 0;
  let peak = 0;
  let maxDrawdown = 0;

  // Filter for completed trades with results
  const completedTrades = trades.filter(trade => 
    trade.result && 
    typeof trade.result.pnl === 'number' &&
    trade.result.success !== undefined
  );

  totalTrades = completedTrades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      maxDrawdown: 0
    };
  }

  // Sort trades by timestamp for proper drawdown calculation
  const sortedTrades = [...completedTrades].sort((a, b) => a.timestamp - b.timestamp);

  for (const trade of sortedTrades) {
    const pnl = trade.result.pnl;
    const isWin = trade.result.success || pnl > 0;

    if (isWin) {
      winningTrades++;
    }

    // Update cumulative P&L and calculate drawdown
    cumulativePnL += pnl;
    
    if (cumulativePnL > peak) {
      peak = cumulativePnL;
    }
    
    const drawdown = peak > 0 ? ((peak - cumulativePnL) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const winRate = (winningTrades / totalTrades) * 100;

  const metrics = {
    totalTrades,
    winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
    maxDrawdown: Math.round(maxDrawdown * 100) / 100 // Round to 2 decimal places
  };

  console.log('📈 Calculated metrics:', metrics);
  return metrics;
}

export default useMainnetReadiness;