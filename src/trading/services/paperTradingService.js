// Paper Trading Service
// Fetches paper trading data from Firestore via API

const API_BASE = '/api/paper-trade';

class PaperTradingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10 seconds
  }

  async fetchAllData() {
    const cacheKey = 'all_data';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE}?action=status`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch paper trading data');
      }

      // Transform to match the structure expected by PerformanceDashboard
      const transformed = {
        account: {
          balance: data.account.current,
          accountIndex: 'PAPER',
          collateral: data.account.current,
          availableBalance: data.account.current - this.calculateMarginInUse(data.positions),
          totalAssetValue: data.account.current,
          unrealizedPnl: data.account.totalUnrealizedPnL,
          realizedPnl: data.account.totalRealizedPnL,
          totalPnl: data.account.totalRealizedPnL + data.account.totalUnrealizedPnL,
        },
        positions: {
          positions: data.positions.map(pos => ({
            marketId: pos.symbol,
            symbol: pos.symbol,
            sign: pos.direction === 'LONG' ? 1 : -1,
            position: pos.size,
            avgEntryPrice: pos.entryPrice,
            positionValue: pos.size * pos.currentPrice,
            unrealizedPnl: pos.unrealizedPnL,
            realizedPnl: pos.realizedPnL || 0,
            liquidationPrice: 0,
            marginMode: 'cross',
            // Extra fields for display
            direction: pos.direction,
            leverage: pos.leverage,
            margin: pos.margin,
            currentPrice: pos.currentPrice,
            unrealizedPnLPercent: pos.unrealizedPnLPercent,
            id: pos.id,
          })),
          positionCount: data.positions.length,
          totalValue: data.positions.reduce((sum, pos) => sum + (pos.size * pos.currentPrice), 0),
        },
        orders: {
          orders: [],
          orderCount: 0,
        },
        activeOrders: {
          activeOrders: [],
          activeOrderCount: 0,
          totalOrderValue: 0,
        },
        tradeHistory: {
          trades: [],
          tradeCount: data.account.totalTrades,
          totalVolume: 0,
          realizedPnl: data.account.totalRealizedPnL,
        },
        pnl: {
          totalPnl: data.account.totalRealizedPnL + data.account.totalUnrealizedPnL,
          unrealizedPnl: data.account.totalUnrealizedPnL,
          realizedPnl: data.account.totalRealizedPnL,
          pnlHistory: [{
            timestamp: Date.now(),
            totalPnl: data.account.totalRealizedPnL + data.account.totalUnrealizedPnL,
            unrealizedPnl: data.account.totalUnrealizedPnL,
            realizedPnl: data.account.totalRealizedPnL,
          }],
          isEmpty: data.account.totalTrades === 0,
          hasNoHistory: data.account.totalTrades === 0,
        },
        combined: {
          balance: data.account.current,
          accountIndex: 'PAPER',
          collateral: data.account.current,
          availableBalance: data.account.current - this.calculateMarginInUse(data.positions),
          totalAssetValue: data.account.current,
          unrealizedPnl: data.account.totalUnrealizedPnL,
          realizedPnl: data.account.totalRealizedPnL,
          totalPnl: data.account.totalRealizedPnL + data.account.totalUnrealizedPnL,
          positionCount: data.positions.length,
          positions: data.positions.map(pos => ({
            marketId: pos.symbol,
            symbol: pos.symbol,
            sign: pos.direction === 'LONG' ? 1 : -1,
            position: pos.size,
            avgEntryPrice: pos.entryPrice,
            positionValue: pos.size * pos.currentPrice,
            unrealizedPnl: pos.unrealizedPnL,
            realizedPnl: pos.realizedPnL || 0,
            direction: pos.direction,
            leverage: pos.leverage,
            margin: pos.margin,
            currentPrice: pos.currentPrice,
            unrealizedPnLPercent: pos.unrealizedPnLPercent,
            id: pos.id,
          })),
          orderCount: 0,
          orders: [],
          activeOrderCount: 0,
          activeOrders: [],
          totalOrderValue: 0,
          tradeCount: data.account.totalTrades,
          trades: [],
          totalVolume: 0,
          pnlTotalPnl: data.account.totalRealizedPnL + data.account.totalUnrealizedPnL,
          pnlUnrealizedPnl: data.account.totalUnrealizedPnL,
          pnlRealizedPnl: data.account.totalRealizedPnL,
          pnlHistory: [{
            timestamp: Date.now(),
            totalPnl: data.account.totalRealizedPnL + data.account.totalUnrealizedPnL,
          }],
          hasNoHistory: data.account.totalTrades === 0,
          lastUpdate: Date.now(),
          // Account stats
          wins: data.account.wins,
          losses: data.account.losses,
          winRate: data.account.winRate,
          maxDrawdown: data.account.maxDrawdown,
          peakBalance: data.account.peakBalance,
          initialBalance: data.account.initial,
          // Paper trading indicator
          isPaperTrading: true,
        },
        // Raw data for reference
        raw: data,
        prices: data.prices,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: transformed,
        timestamp: Date.now(),
      });

      return transformed;
    } catch (error) {
      console.error('Failed to fetch paper trading data:', error);
      throw error;
    }
  }

  calculateMarginInUse(positions) {
    return positions.reduce((sum, pos) => sum + (pos.margin || 0), 0);
  }

  async fetchTradeHistory(limit = 20) {
    try {
      const response = await fetch(`${API_BASE}?action=history&limit=${limit}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch trade history');
      }

      return data.trades.map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        action: trade.action,
        size: trade.size,
        price: trade.fillPrice,
        entryPrice: trade.price,
        realizedPnL: trade.realizedPnL,
        slippage: trade.slippage,
        timestamp: new Date(trade.timestamp),
        paperTrade: true,
      }));
    } catch (error) {
      console.error('Failed to fetch trade history:', error);
      return [];
    }
  }

  async openPosition(symbol, direction, size, leverage = 5) {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          symbol,
          direction,
          size,
          leverage,
        }),
      });

      const data = await response.json();
      this.clearCache();
      return data;
    } catch (error) {
      console.error('Failed to open position:', error);
      return { success: false, error: error.message };
    }
  }

  async closePosition(positionId) {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          positionId,
        }),
      });

      const data = await response.json();
      this.clearCache();
      return data;
    } catch (error) {
      console.error('Failed to close position:', error);
      return { success: false, error: error.message };
    }
  }

  async resetAccount() {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const data = await response.json();
      this.clearCache();
      return data;
    } catch (error) {
      console.error('Failed to reset account:', error);
      return { success: false, error: error.message };
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const paperTradingService = new PaperTradingService();
export default paperTradingService;
