// React hook for Lighter trading integration
import { useState, useEffect, useCallback, useRef } from 'react';
import { getLighterTradingBot } from '@/lib/lighter/trading';
import { LighterWebSocketManager } from '@/lib/lighter/websocket';

export function useLighterTrading(config = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [marketData, setMarketData] = useState({});
  const [performance, setPerformance] = useState(null);
  
  const botRef = useRef(null);
  const wsManagerRef = useRef(null);
  const updateIntervalRef = useRef(null);

  // Initialize the trading bot
  const initialize = useCallback(async () => {
    if (isInitializing || isConnected) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // Check if API keys are configured
      // Note: Private keys should not be exposed to the browser
      // This check is just for development - in production, use a backend API
      console.log('Initializing Lighter trading...');
      
      // Initialize trading bot
      const bot = getLighterTradingBot(config);
      await bot.initialize();
      botRef.current = bot;
      
      // Initialize WebSocket manager
      const wsManager = new LighterWebSocketManager(bot.client);
      await wsManager.initialize();
      wsManagerRef.current = wsManager;
      
      // Subscribe to default markets
      const defaultMarkets = config.markets || ['BTC-USD', 'ETH-USD', 'SOL-USD'];
      defaultMarkets.forEach(market => {
        wsManager.subscribeToMarket(market);
      });
      
      // Set up WebSocket event handlers
      wsManager.wsClient.on('account', (data) => {
        setAccountData(data);
      });
      
      wsManager.wsClient.on('positions', (data) => {
        setPositions(data);
      });
      
      wsManager.wsClient.on('orders', (data) => {
        setOrders(data);
      });
      
      wsManager.wsClient.on('orderbook', ({ market, data }) => {
        setMarketData(prev => ({
          ...prev,
          [market]: {
            ...prev[market],
            orderbook: data,
            lastUpdate: Date.now()
          }
        }));
      });
      
      wsManager.wsClient.on('ticker', ({ market, data }) => {
        setMarketData(prev => ({
          ...prev,
          [market]: {
            ...prev[market],
            ticker: data,
            lastTickerUpdate: Date.now()
          }
        }));
      });
      
      // Initial sync
      await syncAccountState();
      
      // Set up periodic updates
      updateIntervalRef.current = setInterval(() => {
        updatePerformance();
      }, 5000); // Update every 5 seconds
      
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to initialize Lighter trading:', err);
      setError(err.message);
    } finally {
      setIsInitializing(false);
    }
  }, [config, isInitializing, isConnected]);

  // Sync account state
  const syncAccountState = useCallback(async () => {
    if (!botRef.current) return;
    
    try {
      const state = await botRef.current.syncAccountState();
      setPositions(state.positions);
      setOrders(state.orders);
      setAccountData({
        balance: state.accountBalance,
        availableMargin: state.availableMargin
      });
    } catch (err) {
      console.error('Failed to sync account state:', err);
    }
  }, []);

  // Update performance metrics
  const updatePerformance = useCallback(() => {
    if (!botRef.current) return;
    
    const metrics = botRef.current.getPerformanceMetrics();
    setPerformance(metrics);
  }, []);

  // Create market order
  const createMarketOrder = useCallback(async (market, side, size) => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      const result = await botRef.current.createMarketOrder(market, side, size);
      await syncAccountState();
      return result;
    } catch (err) {
      console.error('Failed to create market order:', err);
      throw err;
    }
  }, [syncAccountState]);

  // Create limit order
  const createLimitOrder = useCallback(async (market, side, size, price) => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      const result = await botRef.current.createLimitOrder(market, side, size, price);
      await syncAccountState();
      return result;
    } catch (err) {
      console.error('Failed to create limit order:', err);
      throw err;
    }
  }, [syncAccountState]);

  // Create stop loss
  const createStopLoss = useCallback(async (market, side, size, triggerPrice, limitPrice = null) => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      const result = await botRef.current.createStopLoss(market, side, size, triggerPrice, limitPrice);
      await syncAccountState();
      return result;
    } catch (err) {
      console.error('Failed to create stop loss:', err);
      throw err;
    }
  }, [syncAccountState]);

  // Cancel order
  const cancelOrder = useCallback(async (orderId) => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      const result = await botRef.current.cancelOrder(orderId);
      await syncAccountState();
      return result;
    } catch (err) {
      console.error('Failed to cancel order:', err);
      throw err;
    }
  }, [syncAccountState]);

  // Cancel all orders
  const cancelAllOrders = useCallback(async () => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      const result = await botRef.current.cancelAllOrders();
      await syncAccountState();
      return result;
    } catch (err) {
      console.error('Failed to cancel all orders:', err);
      throw err;
    }
  }, [syncAccountState]);

  // Close position
  const closePosition = useCallback(async (market) => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      const result = await botRef.current.closePosition(market);
      await syncAccountState();
      return result;
    } catch (err) {
      console.error('Failed to close position:', err);
      throw err;
    }
  }, [syncAccountState]);

  // Analyze market
  const analyzeMarket = useCallback(async (market) => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      return await botRef.current.analyzeMarket(market);
    } catch (err) {
      console.error('Failed to analyze market:', err);
      throw err;
    }
  }, []);

  // Execute trading strategy
  const executeStrategy = useCallback(async (markets) => {
    if (!botRef.current) {
      throw new Error('Trading bot not initialized');
    }
    
    try {
      const result = await botRef.current.executeStrategy(markets);
      await syncAccountState();
      return result;
    } catch (err) {
      console.error('Failed to execute strategy:', err);
      throw err;
    }
  }, [syncAccountState]);

  // Subscribe to market
  const subscribeToMarket = useCallback((market) => {
    if (!wsManagerRef.current) {
      console.warn('WebSocket manager not initialized');
      return;
    }
    
    wsManagerRef.current.subscribeToMarket(market);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
      wsManagerRef.current = null;
    }
    
    botRef.current = null;
    setIsConnected(false);
    setAccountData(null);
    setPositions([]);
    setOrders([]);
    setMarketData({});
    setPerformance(null);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Format data for TradingOverlay component
  const formatTradingData = useCallback(() => {
    const totalPnl = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
    const balance = accountData?.balance || 0;
    const initialBalance = config.initialBalance || 10000;
    
    return {
      // Model Info
      modelName: 'RL80-Lighter',
      modelVersion: 'v1.0',
      rank: 1,
      totalModels: 1,
      
      // Fund Stats
      fundBalance: balance,
      initialBalance,
      dailyPnl: totalPnl,
      dailyPnlPercent: balance > 0 ? (totalPnl / balance) * 100 : 0,
      totalPnl: balance - initialBalance,
      totalPnlPercent: ((balance - initialBalance) / initialBalance) * 100,
      
      // Performance Metrics
      winRate: performance?.winRate || 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      
      // Current State
      positions,
      orders,
      marketData,
      
      // Connection Status
      isConnected,
      error
    };
  }, [accountData, positions, orders, marketData, performance, isConnected, error, config.initialBalance]);

  return {
    // Connection state
    isConnected,
    isInitializing,
    error,
    
    // Account data
    accountData,
    positions,
    orders,
    marketData,
    performance,
    
    // Actions
    initialize,
    disconnect,
    createMarketOrder,
    createLimitOrder,
    createStopLoss,
    cancelOrder,
    cancelAllOrders,
    closePosition,
    analyzeMarket,
    executeStrategy,
    subscribeToMarket,
    syncAccountState,
    
    // Formatted data for UI
    tradingData: formatTradingData()
  };
}

export default useLighterTrading;