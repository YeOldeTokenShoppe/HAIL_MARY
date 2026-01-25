/**
 * Simulated Trading Plugin for RL80
 *
 * Paper trading engine using CoinGecko prices.
 * Tracks positions, calculates P&L, handles liquidations.
 *
 * Firestore Collections:
 * - simulatedPositions/{positionId}: Open/closed positions
 * - simulatedTradeHistory/{tradeId}: Trade execution logs
 * - simulatedAccount/balance: Account balance and stats
 */

import type { Plugin, Action, ActionResult, Evaluator, Provider, ProviderResult } from '@elizaos/core';
import {
  type IAgentRuntime,
  type Memory,
  Service,
  type State,
  logger,
} from '@elizaos/core';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SimulatedPosition {
  id: string;
  symbol: 'BTC' | 'ETH' | 'SOL' | 'XRP';
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  margin: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  openedAt: Date;
  closedAt: Date | null;
  closedPrice: number | null;
  realizedPnL: number | null;
  agentDecisionId?: string;
}

interface SimulatedTrade {
  id: string;
  positionId: string;
  action: 'OPEN' | 'CLOSE';
  symbol: string;
  direction: 'LONG' | 'SHORT';
  price: number;
  fillPrice: number;
  size: number;
  leverage: number;
  realizedPnL: number | null;
  slippage: number;
  timestamp: Date;
  agentDecisionId?: string;
}

interface SimulatedAccount {
  initial: number;
  current: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  maxDrawdown: number;
  peakBalance: number;
  lastUpdated: Date;
}

interface MarketPrices {
  btc?: number;
  eth?: number;
  sol?: number;
  xrp?: number;
  timestamp?: Date;
}

// Configuration
const DEFAULT_LEVERAGE = 5;
const LIQUIDATION_THRESHOLD = 0.80; // 80% margin loss = liquidation
const INITIAL_BALANCE = 10000;
const MAX_SLIPPAGE = 0.002; // 0.2% max slippage
const FUNDING_RATE_INTERVAL = 8 * 60 * 60 * 1000; // 8 hours in ms
const FUNDING_RATE_RANGE = { min: -0.0001, max: 0.0003 }; // -0.01% to +0.03%

// ============================================
// SIMULATED TRADING SERVICE
// ============================================

export class SimulatedTradingService extends Service {
  static serviceType = 'simulated-trading';
  capabilityDescription = 'Paper trading engine with position tracking, P&L calculation, and liquidation';

  private db: Firestore | null = null;
  private initialized = false;
  private prices: MarketPrices = {};
  private priceUpdateInterval: NodeJS.Timeout | null = null;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    if (this.initialized) return;

    try {
      // Get Firebase credentials from environment
      const projectId = runtime.getSetting('FIREBASE_PROJECT_ID') || process.env.FIREBASE_PROJECT_ID;
      const clientEmail = runtime.getSetting('FIREBASE_CLIENT_EMAIL') || process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = runtime.getSetting('FIREBASE_PRIVATE_KEY') || process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('[SimulatedTrading] Firebase credentials not found, service will be limited');
        return;
      }

      // Handle escaped newlines in private key
      privateKey = privateKey.replace(/\\n/g, '\n');

      // Initialize Firebase Admin SDK
      let app: App;
      const existingApps = getApps();

      if (existingApps.length > 0) {
        app = existingApps[0];
        logger.info('[SimulatedTrading] Using existing Firebase app');
      } else {
        app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        logger.info('[SimulatedTrading] Initialized new Firebase app');
      }

      this.db = getFirestore(app);
      this.initialized = true;

      // Initialize account if not exists
      await this.initializeAccount();

      // Start price update loop
      await this.startPriceUpdates();

      logger.info('[SimulatedTrading] Service initialized successfully');
    } catch (error) {
      logger.error('[SimulatedTrading] Failed to initialize:', error);
    }
  }

  private async initializeAccount(): Promise<void> {
    if (!this.db) return;

    const accountRef = this.db.collection('simulatedAccount').doc('balance');
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      const initialAccount: SimulatedAccount = {
        initial: INITIAL_BALANCE,
        current: INITIAL_BALANCE,
        totalRealizedPnL: 0,
        totalUnrealizedPnL: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        maxDrawdown: 0,
        peakBalance: INITIAL_BALANCE,
        lastUpdated: new Date(),
      };

      await accountRef.set(initialAccount);
      logger.info('[SimulatedTrading] Initialized account with $' + INITIAL_BALANCE);
    }
  }

  private async startPriceUpdates(): Promise<void> {
    // Initial price fetch
    await this.fetchPrices();

    // Update prices every 60 seconds
    this.priceUpdateInterval = setInterval(async () => {
      await this.fetchPrices();
      await this.updateAllPositions();
      await this.checkLiquidations();
    }, 60000);
  }

  async stop(): Promise<void> {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }
  }

  // ============================================
  // PRICE FETCHING
  // ============================================

  private async fetchPrices(): Promise<void> {
    try {
      // Try to get prices from Firestore first (from background service)
      if (this.db) {
        const marketDoc = await this.db.collection('marketData').doc('latest').get();
        if (marketDoc.exists) {
          const data = marketDoc.data();
          this.prices = {
            btc: data?.btc?.price,
            eth: data?.eth?.price,
            sol: data?.sol?.price,
            xrp: data?.xrp?.price,
            timestamp: data?.timestamp?.toDate() || new Date(),
          };
          logger.debug('[SimulatedTrading] Prices from Firestore:', this.prices);
          return;
        }
      }

      // Fallback to CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd'
      );
      const data = await response.json();

      this.prices = {
        btc: data.bitcoin?.usd,
        eth: data.ethereum?.usd,
        sol: data.solana?.usd,
        xrp: data.ripple?.usd,
        timestamp: new Date(),
      };

      logger.debug('[SimulatedTrading] Prices from CoinGecko:', this.prices);
    } catch (error) {
      logger.error('[SimulatedTrading] Failed to fetch prices:', error);
    }
  }

  getPrice(symbol: string): number | null {
    const key = symbol.toLowerCase() as keyof MarketPrices;
    return this.prices[key] as number || null;
  }

  // ============================================
  // POSITION MANAGEMENT
  // ============================================

  async openPosition(
    symbol: 'BTC' | 'ETH' | 'SOL' | 'XRP',
    direction: 'LONG' | 'SHORT',
    size: number,
    leverage: number = DEFAULT_LEVERAGE,
    agentDecisionId?: string
  ): Promise<{ success: boolean; position?: SimulatedPosition; error?: string }> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    // Get current price
    const currentPrice = this.getPrice(symbol);
    if (!currentPrice) {
      return { success: false, error: `No price available for ${symbol}` };
    }

    // Calculate margin required
    const notionalValue = size * currentPrice;
    const marginRequired = notionalValue / leverage;

    // Check available balance
    const account = await this.getAccount();
    if (!account) {
      return { success: false, error: 'Could not fetch account' };
    }

    // Calculate available margin (current balance minus margin in use)
    const openPositions = await this.getOpenPositions();
    const marginInUse = openPositions.reduce((sum, pos) => sum + pos.margin, 0);
    const availableMargin = account.current - marginInUse;

    if (marginRequired > availableMargin) {
      return {
        success: false,
        error: `Insufficient margin. Required: $${marginRequired.toFixed(2)}, Available: $${availableMargin.toFixed(2)}`
      };
    }

    // Simulate slippage
    const slippage = Math.random() * MAX_SLIPPAGE;
    const fillPrice = direction === 'LONG'
      ? currentPrice * (1 + slippage)
      : currentPrice * (1 - slippage);

    // Create position
    const positionId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const position: SimulatedPosition = {
      id: positionId,
      symbol,
      direction,
      entryPrice: fillPrice,
      currentPrice: fillPrice,
      size,
      leverage,
      margin: marginRequired,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      status: 'OPEN',
      openedAt: new Date(),
      closedAt: null,
      closedPrice: null,
      realizedPnL: null,
      agentDecisionId,
    };

    // Save position to Firestore
    await this.db.collection('simulatedPositions').doc(positionId).set({
      ...position,
      openedAt: Timestamp.fromDate(position.openedAt),
    });

    // Log trade
    await this.logTrade({
      id: `trade_${Date.now()}`,
      positionId,
      action: 'OPEN',
      symbol,
      direction,
      price: currentPrice,
      fillPrice,
      size,
      leverage,
      realizedPnL: null,
      slippage: slippage * 100,
      timestamp: new Date(),
      agentDecisionId,
    });

    // Update account stats
    await this.updateAccountStats();

    logger.info(`[SimulatedTrading] Opened ${direction} ${symbol} position: ${size} @ $${fillPrice.toFixed(2)} (${leverage}x)`);

    return { success: true, position };
  }

  async closePosition(
    positionId: string,
    agentDecisionId?: string
  ): Promise<{ success: boolean; position?: SimulatedPosition; realizedPnL?: number; error?: string }> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    // Get position
    const positionDoc = await this.db.collection('simulatedPositions').doc(positionId).get();
    if (!positionDoc.exists) {
      return { success: false, error: `Position ${positionId} not found` };
    }

    const position = positionDoc.data() as SimulatedPosition;
    if (position.status !== 'OPEN') {
      return { success: false, error: `Position ${positionId} is already ${position.status}` };
    }

    // Get current price
    const currentPrice = this.getPrice(position.symbol);
    if (!currentPrice) {
      return { success: false, error: `No price available for ${position.symbol}` };
    }

    // Simulate slippage (opposite direction for closing)
    const slippage = Math.random() * MAX_SLIPPAGE;
    const fillPrice = position.direction === 'LONG'
      ? currentPrice * (1 - slippage)  // Selling, so worse price
      : currentPrice * (1 + slippage); // Buying back, so worse price

    // Calculate realized P&L
    const directionMultiplier = position.direction === 'LONG' ? 1 : -1;
    const priceDelta = fillPrice - position.entryPrice;
    const realizedPnL = directionMultiplier * priceDelta * position.size;

    // Update position
    const closedPosition: Partial<SimulatedPosition> = {
      status: 'CLOSED',
      closedAt: new Date(),
      closedPrice: fillPrice,
      currentPrice: fillPrice,
      realizedPnL,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
    };

    await this.db.collection('simulatedPositions').doc(positionId).update({
      ...closedPosition,
      closedAt: Timestamp.fromDate(closedPosition.closedAt!),
    });

    // Log trade
    await this.logTrade({
      id: `trade_${Date.now()}`,
      positionId,
      action: 'CLOSE',
      symbol: position.symbol,
      direction: position.direction,
      price: currentPrice,
      fillPrice,
      size: position.size,
      leverage: position.leverage,
      realizedPnL,
      slippage: slippage * 100,
      timestamp: new Date(),
      agentDecisionId,
    });

    // Update account balance
    await this.updateAccountBalance(realizedPnL);
    await this.updateAccountStats();

    logger.info(`[SimulatedTrading] Closed ${position.direction} ${position.symbol} position: P&L $${realizedPnL.toFixed(2)}`);

    return {
      success: true,
      position: { ...position, ...closedPosition } as SimulatedPosition,
      realizedPnL
    };
  }

  // ============================================
  // P&L CALCULATIONS
  // ============================================

  calculateUnrealizedPnL(position: SimulatedPosition, currentPrice: number): { pnl: number; pnlPercent: number } {
    const directionMultiplier = position.direction === 'LONG' ? 1 : -1;
    const priceDelta = currentPrice - position.entryPrice;
    const pnl = directionMultiplier * priceDelta * position.size;
    const pnlPercent = (pnl / position.margin) * 100;

    return { pnl, pnlPercent };
  }

  async updateAllPositions(): Promise<void> {
    if (!this.db) return;

    const openPositions = await this.getOpenPositions();
    let totalUnrealizedPnL = 0;

    for (const position of openPositions) {
      const currentPrice = this.getPrice(position.symbol);
      if (!currentPrice) continue;

      const { pnl, pnlPercent } = this.calculateUnrealizedPnL(position, currentPrice);

      await this.db.collection('simulatedPositions').doc(position.id).update({
        currentPrice,
        unrealizedPnL: pnl,
        unrealizedPnLPercent: pnlPercent,
      });

      totalUnrealizedPnL += pnl;
    }

    // Update account unrealized P&L
    await this.db.collection('simulatedAccount').doc('balance').update({
      totalUnrealizedPnL,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  }

  // ============================================
  // LIQUIDATION
  // ============================================

  isLiquidated(position: SimulatedPosition, currentPrice: number): boolean {
    const { pnlPercent } = this.calculateUnrealizedPnL(position, currentPrice);
    return pnlPercent <= -(LIQUIDATION_THRESHOLD * 100);
  }

  async checkLiquidations(): Promise<SimulatedPosition[]> {
    if (!this.db) return [];

    const liquidatedPositions: SimulatedPosition[] = [];
    const openPositions = await this.getOpenPositions();

    for (const position of openPositions) {
      const currentPrice = this.getPrice(position.symbol);
      if (!currentPrice) continue;

      if (this.isLiquidated(position, currentPrice)) {
        // Liquidate position
        const { pnl } = this.calculateUnrealizedPnL(position, currentPrice);

        await this.db.collection('simulatedPositions').doc(position.id).update({
          status: 'LIQUIDATED',
          closedAt: FieldValue.serverTimestamp(),
          closedPrice: currentPrice,
          currentPrice,
          realizedPnL: pnl,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
        });

        // Log liquidation trade
        await this.logTrade({
          id: `trade_${Date.now()}_liq`,
          positionId: position.id,
          action: 'CLOSE',
          symbol: position.symbol,
          direction: position.direction,
          price: currentPrice,
          fillPrice: currentPrice,
          size: position.size,
          leverage: position.leverage,
          realizedPnL: pnl,
          slippage: 0,
          timestamp: new Date(),
        });

        // Update account
        await this.updateAccountBalance(pnl);

        liquidatedPositions.push({ ...position, status: 'LIQUIDATED', realizedPnL: pnl });
        logger.warn(`[SimulatedTrading] LIQUIDATED ${position.direction} ${position.symbol} position: Loss $${pnl.toFixed(2)}`);
      }
    }

    if (liquidatedPositions.length > 0) {
      await this.updateAccountStats();
    }

    return liquidatedPositions;
  }

  // ============================================
  // ACCOUNT MANAGEMENT
  // ============================================

  async getAccount(): Promise<SimulatedAccount | null> {
    if (!this.db) return null;

    const accountDoc = await this.db.collection('simulatedAccount').doc('balance').get();
    if (!accountDoc.exists) return null;

    const data = accountDoc.data();
    return {
      ...data,
      lastUpdated: data?.lastUpdated?.toDate() || new Date(),
    } as SimulatedAccount;
  }

  private async updateAccountBalance(pnlChange: number): Promise<void> {
    if (!this.db) return;

    const accountRef = this.db.collection('simulatedAccount').doc('balance');
    const account = await this.getAccount();
    if (!account) return;

    const newBalance = account.current + pnlChange;
    const newPeakBalance = Math.max(account.peakBalance, newBalance);
    const drawdown = newPeakBalance > 0 ? ((newPeakBalance - newBalance) / newPeakBalance) * 100 : 0;
    const maxDrawdown = Math.max(account.maxDrawdown, drawdown);

    await accountRef.update({
      current: newBalance,
      totalRealizedPnL: FieldValue.increment(pnlChange),
      peakBalance: newPeakBalance,
      maxDrawdown,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  }

  private async updateAccountStats(): Promise<void> {
    if (!this.db) return;

    // Get all closed positions
    const tradesSnapshot = await this.db
      .collection('simulatedPositions')
      .where('status', 'in', ['CLOSED', 'LIQUIDATED'])
      .get();

    let wins = 0;
    let losses = 0;

    tradesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.realizedPnL !== null) {
        if (data.realizedPnL >= 0) {
          wins++;
        } else {
          losses++;
        }
      }
    });

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? wins / totalTrades : 0;

    await this.db.collection('simulatedAccount').doc('balance').update({
      totalTrades,
      wins,
      losses,
      winRate,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  }

  // ============================================
  // DATA RETRIEVAL
  // ============================================

  async getOpenPositions(): Promise<SimulatedPosition[]> {
    if (!this.db) return [];

    const snapshot = await this.db
      .collection('simulatedPositions')
      .where('status', '==', 'OPEN')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        openedAt: data.openedAt?.toDate() || new Date(),
        closedAt: data.closedAt?.toDate() || null,
      } as SimulatedPosition;
    });
  }

  async getAllPositions(): Promise<SimulatedPosition[]> {
    if (!this.db) return [];

    const snapshot = await this.db
      .collection('simulatedPositions')
      .orderBy('openedAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        openedAt: data.openedAt?.toDate() || new Date(),
        closedAt: data.closedAt?.toDate() || null,
      } as SimulatedPosition;
    });
  }

  async getTradeHistory(limit: number = 20): Promise<SimulatedTrade[]> {
    if (!this.db) return [];

    const snapshot = await this.db
      .collection('simulatedTradeHistory')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as SimulatedTrade;
    });
  }

  private async logTrade(trade: SimulatedTrade): Promise<void> {
    if (!this.db) return;

    await this.db.collection('simulatedTradeHistory').doc(trade.id).set({
      ...trade,
      timestamp: Timestamp.fromDate(trade.timestamp),
    });
  }
}

// ============================================
// ACTIONS
// ============================================

const openPositionAction: Action = {
  name: 'OPEN_POSITION',
  description: 'Opens a new simulated trading position (paper trade)',
  similes: ['open position', 'buy', 'sell', 'long', 'short', 'enter trade'],

  validate: async (runtime, message) => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes('open') || text.includes('buy') || text.includes('sell') ||
           text.includes('long') || text.includes('short') || text.includes('position');
  },

  handler: async (runtime, message, state, options, callback): Promise<ActionResult> => {
    try {
      const service = runtime.getService<SimulatedTradingService>('simulated-trading');
      if (!service) {
        await callback({ text: 'Simulated trading service not available' });
        return { success: false, error: new Error('Service not available') };
      }

      // Parse the message for trading parameters
      const text = message.content.text?.toLowerCase() || '';

      // Determine direction
      let direction: 'LONG' | 'SHORT' = 'LONG';
      if (text.includes('short') || text.includes('sell')) {
        direction = 'SHORT';
      }

      // Determine symbol
      let symbol: 'BTC' | 'ETH' | 'SOL' | 'XRP' = 'BTC';
      if (text.includes('eth')) symbol = 'ETH';
      else if (text.includes('sol')) symbol = 'SOL';
      else if (text.includes('xrp')) symbol = 'XRP';

      // Parse size (default to small position)
      const sizeMatch = text.match(/(\d+\.?\d*)\s*(btc|eth|sol|xrp)?/i);
      const size = sizeMatch ? parseFloat(sizeMatch[1]) : (symbol === 'BTC' ? 0.001 : 0.1);

      // Parse leverage
      const leverageMatch = text.match(/(\d+)x/i);
      const leverage = leverageMatch ? parseInt(leverageMatch[1]) : DEFAULT_LEVERAGE;

      // Open position
      const result = await service.openPosition(symbol, direction, size, leverage);

      if (result.success && result.position) {
        const pos = result.position;
        await callback({
          text: `✅ Opened ${pos.direction} ${pos.symbol} position:\n` +
                `• Size: ${pos.size} ${pos.symbol}\n` +
                `• Entry: $${pos.entryPrice.toFixed(2)}\n` +
                `• Leverage: ${pos.leverage}x\n` +
                `• Margin: $${pos.margin.toFixed(2)}\n` +
                `• Position ID: ${pos.id}`,
          action: 'OPEN_POSITION',
        });

        return {
          success: true,
          text: `Opened ${direction} ${symbol} position`,
          values: { position: pos },
          data: { position: pos },
        };
      } else {
        await callback({ text: `❌ Failed to open position: ${result.error}` });
        return { success: false, error: new Error(result.error) };
      }
    } catch (error) {
      logger.error('[OPEN_POSITION] Error:', error);
      await callback({ text: 'Failed to open position due to an error' });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

const closePositionAction: Action = {
  name: 'CLOSE_POSITION',
  description: 'Closes an open simulated trading position',
  similes: ['close position', 'exit trade', 'take profit', 'stop loss', 'close'],

  validate: async (runtime, message) => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes('close') || text.includes('exit');
  },

  handler: async (runtime, message, state, options, callback): Promise<ActionResult> => {
    try {
      const service = runtime.getService<SimulatedTradingService>('simulated-trading');
      if (!service) {
        await callback({ text: 'Simulated trading service not available' });
        return { success: false, error: new Error('Service not available') };
      }

      const text = message.content.text || '';

      // Try to extract position ID from message
      const idMatch = text.match(/pos_[\w]+/);
      let positionId = idMatch ? idMatch[0] : null;

      // If no ID provided, close the most recent open position for the mentioned symbol
      if (!positionId) {
        const openPositions = await service.getOpenPositions();

        if (openPositions.length === 0) {
          await callback({ text: '❌ No open positions to close' });
          return { success: false, error: new Error('No open positions') };
        }

        // Check if a specific symbol was mentioned
        const textLower = text.toLowerCase();
        let targetPosition = openPositions[0]; // Default to first

        if (textLower.includes('btc')) {
          targetPosition = openPositions.find(p => p.symbol === 'BTC') || targetPosition;
        } else if (textLower.includes('eth')) {
          targetPosition = openPositions.find(p => p.symbol === 'ETH') || targetPosition;
        } else if (textLower.includes('sol')) {
          targetPosition = openPositions.find(p => p.symbol === 'SOL') || targetPosition;
        } else if (textLower.includes('xrp')) {
          targetPosition = openPositions.find(p => p.symbol === 'XRP') || targetPosition;
        }

        positionId = targetPosition.id;
      }

      // Close position
      const result = await service.closePosition(positionId);

      if (result.success && result.position) {
        const pos = result.position;
        const pnlEmoji = (result.realizedPnL || 0) >= 0 ? '🟢' : '🔴';

        await callback({
          text: `✅ Closed ${pos.direction} ${pos.symbol} position:\n` +
                `• Entry: $${pos.entryPrice.toFixed(2)}\n` +
                `• Exit: $${pos.closedPrice?.toFixed(2)}\n` +
                `• Size: ${pos.size} ${pos.symbol}\n` +
                `${pnlEmoji} Realized P&L: $${result.realizedPnL?.toFixed(2)}`,
          action: 'CLOSE_POSITION',
        });

        return {
          success: true,
          text: `Closed position with P&L $${result.realizedPnL?.toFixed(2)}`,
          values: { position: pos, realizedPnL: result.realizedPnL },
          data: { position: pos },
        };
      } else {
        await callback({ text: `❌ Failed to close position: ${result.error}` });
        return { success: false, error: new Error(result.error) };
      }
    } catch (error) {
      logger.error('[CLOSE_POSITION] Error:', error);
      await callback({ text: 'Failed to close position due to an error' });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

// ============================================
// PROVIDER
// ============================================

const positionsProvider: Provider = {
  name: 'simulatedPositions',
  description: 'Provides current simulated trading positions and account status',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<ProviderResult> => {
    try {
      const service = runtime.getService<SimulatedTradingService>('simulated-trading');
      if (!service) {
        return { text: 'Simulated trading service not available', values: {} };
      }

      const [openPositions, account] = await Promise.all([
        service.getOpenPositions(),
        service.getAccount(),
      ]);

      if (!account) {
        return { text: 'Account not initialized', values: {} };
      }

      let text = `📊 PAPER TRADING ACCOUNT\n`;
      text += `Balance: $${account.current.toFixed(2)} (Initial: $${account.initial.toFixed(2)})\n`;
      text += `Total P&L: $${account.totalRealizedPnL.toFixed(2)}\n`;
      text += `Win Rate: ${(account.winRate * 100).toFixed(1)}% (${account.wins}W/${account.losses}L)\n`;
      text += `Max Drawdown: ${account.maxDrawdown.toFixed(1)}%\n\n`;

      if (openPositions.length > 0) {
        text += `📈 OPEN POSITIONS (${openPositions.length}):\n`;
        for (const pos of openPositions) {
          const pnlEmoji = pos.unrealizedPnL >= 0 ? '🟢' : '🔴';
          text += `• ${pos.direction} ${pos.symbol}: ${pos.size} @ $${pos.entryPrice.toFixed(2)}\n`;
          text += `  ${pnlEmoji} P&L: $${pos.unrealizedPnL.toFixed(2)} (${pos.unrealizedPnLPercent.toFixed(1)}%)\n`;
        }
      } else {
        text += `No open positions.\n`;
      }

      return {
        text,
        values: {
          account,
          openPositions,
          hasOpenPositions: openPositions.length > 0,
        },
      };
    } catch (error) {
      logger.error('[PositionsProvider] Error:', error);
      return { text: 'Error fetching positions', values: {} };
    }
  },
};

// ============================================
// EVALUATOR
// ============================================

const liquidationEvaluator: Evaluator = {
  name: 'checkLiquidations',
  description: 'Checks for positions that should be liquidated',
  similes: ['liquidation check', 'margin call'],

  validate: async (runtime) => {
    // Always run on price updates
    return true;
  },

  handler: async (runtime) => {
    try {
      const service = runtime.getService<SimulatedTradingService>('simulated-trading');
      if (!service) return;

      const liquidated = await service.checkLiquidations();

      if (liquidated.length > 0) {
        logger.warn(`[LiquidationEvaluator] ${liquidated.length} positions liquidated`);
      }
    } catch (error) {
      logger.error('[LiquidationEvaluator] Error:', error);
    }
  },
};

// ============================================
// PLUGIN EXPORT
// ============================================

export const simulatedTradingPlugin: Plugin = {
  name: 'plugin-simulated-trading',
  description: 'Paper trading engine with CoinGecko prices, position tracking, P&L calculation, and liquidation',
  services: [SimulatedTradingService],
  actions: [openPositionAction, closePositionAction],
  providers: [positionsProvider],
  evaluators: [liquidationEvaluator],
};

export default simulatedTradingPlugin;
