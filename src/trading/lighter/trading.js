// Lighter Trading Functions Module
import { getLighterClient } from './clients/client';

// Trading strategy for the AI agent
export class LighterTradingBot {
  constructor(config = {}) {
    this.client = getLighterClient(config);
    this.positions = new Map();
    this.activeOrders = new Map();
    this.maxPositions = config.maxPositions || 5;
    this.riskPerTrade = config.riskPerTrade || 0.02; // 2% risk per trade
    this.defaultLeverage = config.defaultLeverage || 2;
  }

  // Initialize the bot
  async initialize() {
    await this.client.initializeSigner();
    await this.syncAccountState();
  }

  // Sync account state with Lighter
  async syncAccountState() {
    try {
      const accountData = await this.client.getAccountData();
      
      // Update positions from account data
      if (accountData.positions) {
        this.positions.clear();
        accountData.positions.forEach(pos => {
          this.positions.set(pos.market, {
            market: pos.market,
            side: pos.side,
            size: pos.size,
            entryPrice: pos.entry_price,
            unrealizedPnl: pos.unrealized_pnl,
            margin: pos.margin
          });
        });
      }
      
      // Update active orders
      if (accountData.orders) {
        this.activeOrders.clear();
        accountData.orders.forEach(order => {
          this.activeOrders.set(order.client_order_index, {
            id: order.client_order_index,
            market: order.market,
            side: order.side,
            type: order.order_type,
            size: order.base_amount,
            price: order.price,
            status: order.status
          });
        });
      }
      
      return {
        positions: Array.from(this.positions.values()),
        orders: Array.from(this.activeOrders.values()),
        accountBalance: accountData.balance,
        availableMargin: accountData.available_margin
      };
    } catch (error) {
      console.error('Error syncing account state:', error);
      throw error;
    }
  }

  // Create market order
  async createMarketOrder(market, side, size) {
    try {
      const orderParams = {
        market,
        side,
        orderType: 'market',
        baseAmount: size,
        price: 0, // Market orders don't need price
        clientOrderIndex: Date.now(),
        timeInForce: 'immediate_or_cancel'
      };
      
      const result = await this.client.createOrder(orderParams);
      
      // Track the order
      this.activeOrders.set(orderParams.clientOrderIndex, {
        ...orderParams,
        status: 'pending'
      });
      
      return result;
    } catch (error) {
      console.error('Error creating market order:', error);
      throw error;
    }
  }

  // Create limit order
  async createLimitOrder(market, side, size, price) {
    try {
      const orderParams = {
        market,
        side,
        orderType: 'limit',
        baseAmount: size,
        price,
        clientOrderIndex: Date.now(),
        timeInForce: 'good_till_time'
      };
      
      const result = await this.client.createOrder(orderParams);
      
      // Track the order
      this.activeOrders.set(orderParams.clientOrderIndex, {
        ...orderParams,
        status: 'pending'
      });
      
      return result;
    } catch (error) {
      console.error('Error creating limit order:', error);
      throw error;
    }
  }

  // Create stop loss order
  async createStopLoss(market, side, size, triggerPrice, limitPrice = null) {
    try {
      const orderParams = {
        market,
        side: side === 'buy' ? 'sell' : 'buy', // Stop loss is opposite side
        orderType: limitPrice ? 'stop_loss_limit' : 'stop_loss',
        baseAmount: size,
        price: limitPrice || triggerPrice,
        triggerPrice,
        clientOrderIndex: Date.now(),
        timeInForce: 'good_till_time'
      };
      
      const result = await this.client.createOrder(orderParams);
      
      // Track the order
      this.activeOrders.set(orderParams.clientOrderIndex, {
        ...orderParams,
        status: 'pending'
      });
      
      return result;
    } catch (error) {
      console.error('Error creating stop loss:', error);
      throw error;
    }
  }

  // Cancel order
  async cancelOrder(clientOrderIndex) {
    try {
      const result = await this.client.cancelOrder(clientOrderIndex);
      
      // Remove from tracked orders
      this.activeOrders.delete(clientOrderIndex);
      
      return result;
    } catch (error) {
      console.error('Error canceling order:', error);
      throw error;
    }
  }

  // Cancel all orders
  async cancelAllOrders() {
    try {
      const promises = Array.from(this.activeOrders.keys()).map(id => 
        this.cancelOrder(id)
      );
      
      const results = await Promise.allSettled(promises);
      
      return {
        success: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
        results
      };
    } catch (error) {
      console.error('Error canceling all orders:', error);
      throw error;
    }
  }

  // Close position
  async closePosition(market) {
    try {
      const position = this.positions.get(market);
      if (!position) {
        throw new Error(`No position found for market ${market}`);
      }
      
      // Create market order in opposite direction
      const result = await this.createMarketOrder(
        market,
        position.side === 'buy' ? 'sell' : 'buy',
        position.size
      );
      
      // Remove from tracked positions
      this.positions.delete(market);
      
      return result;
    } catch (error) {
      console.error('Error closing position:', error);
      throw error;
    }
  }

  // Calculate position size based on risk management
  calculatePositionSize(accountBalance, entryPrice, stopLossPrice) {
    const riskAmount = accountBalance * this.riskPerTrade;
    const priceDiff = Math.abs(entryPrice - stopLossPrice);
    const positionSize = riskAmount / priceDiff;
    
    return Math.floor(positionSize * 100) / 100; // Round to 2 decimals
  }

  // Get market analysis (placeholder for AI strategy)
  async analyzeMarket(market) {
    try {
      const orderbook = await this.client.getOrderbook(market);
      
      // Basic analysis based on orderbook
      const bestBid = orderbook.bids[0]?.price || 0;
      const bestAsk = orderbook.asks[0]?.price || 0;
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;
      
      // Calculate order imbalance
      const bidVolume = orderbook.bids.reduce((sum, bid) => sum + bid.size, 0);
      const askVolume = orderbook.asks.reduce((sum, ask) => sum + ask.size, 0);
      const imbalance = (bidVolume - askVolume) / (bidVolume + askVolume);
      
      // Simple signal generation
      let signal = 'neutral';
      if (imbalance > 0.2) signal = 'bullish';
      if (imbalance < -0.2) signal = 'bearish';
      
      return {
        market,
        bestBid,
        bestAsk,
        spread,
        midPrice,
        bidVolume,
        askVolume,
        imbalance,
        signal,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error analyzing market:', error);
      throw error;
    }
  }

  // Execute trading strategy
  async executeStrategy(markets = ['BTC-USD', 'ETH-USD']) {
    try {
      const analyses = [];
      const trades = [];
      
      // Analyze each market
      for (const market of markets) {
        const analysis = await this.analyzeMarket(market);
        analyses.push(analysis);
        
        // Check if we should trade
        if (analysis.signal !== 'neutral' && this.positions.size < this.maxPositions) {
          // Check if we already have a position in this market
          if (!this.positions.has(market)) {
            const accountData = await this.client.getAccountData();
            const positionSize = this.calculatePositionSize(
              accountData.balance,
              analysis.midPrice,
              analysis.midPrice * (analysis.signal === 'bullish' ? 0.98 : 1.02)
            );
            
            // Create order based on signal
            const trade = await this.createLimitOrder(
              market,
              analysis.signal === 'bullish' ? 'buy' : 'sell',
              positionSize,
              analysis.signal === 'bullish' ? analysis.bestBid : analysis.bestAsk
            );
            
            trades.push({
              market,
              signal: analysis.signal,
              size: positionSize,
              price: analysis.signal === 'bullish' ? analysis.bestBid : analysis.bestAsk,
              result: trade
            });
          }
        }
      }
      
      return {
        analyses,
        trades,
        positions: Array.from(this.positions.values()),
        orders: Array.from(this.activeOrders.values())
      };
    } catch (error) {
      console.error('Error executing strategy:', error);
      throw error;
    }
  }

  // Get trading performance metrics
  getPerformanceMetrics() {
    let totalPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    
    // Calculate from positions
    this.positions.forEach(pos => {
      if (pos.unrealizedPnl > 0) winningTrades++;
      if (pos.unrealizedPnl < 0) losingTrades++;
      totalPnl += pos.unrealizedPnl || 0;
    });
    
    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    return {
      totalPnl,
      winningTrades,
      losingTrades,
      totalTrades,
      winRate,
      openPositions: this.positions.size,
      activeOrders: this.activeOrders.size
    };
  }
}

// Export singleton instance
let botInstance = null;

export const getLighterTradingBot = (config) => {
  if (!botInstance) {
    botInstance = new LighterTradingBot(config);
  }
  return botInstance;
};

export default LighterTradingBot;