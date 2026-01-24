/**
 * Firestore Plugin for RL80
 *
 * This plugin connects to the existing HAIL_MARY Firebase/Firestore instance
 * and provides market data to RL80 for trading decisions.
 *
 * Data Sources (from existing Railway service):
 * - marketData/latest: BTC/ETH/SOL/XRP prices, 24h changes, volume
 * - technicalData/latest: RSI, MACD, Bollinger Bands, support/resistance
 * - sentimentData/latest: Fear & Greed, trending topics, social sentiment
 * - macroData/latest: VIX, DXY, Treasury yields, SPY
 * - agentDecisions/RL80: Latest trading decision (READ + WRITE)
 * - tradeHistory: Recent trades for performance tracking
 */

import type { Plugin, Action, ActionResult, HandlerCallback, Content } from '@elizaos/core';
import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().email('Valid Firebase client email required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'Firebase private key is required'),
});

// Type definitions for Firestore data
interface MarketData {
  btc?: { price: number; change24h: number; volume: number };
  eth?: { price: number; change24h: number; volume: number };
  sol?: { price: number; change24h: number; volume: number };
  xrp?: { price: number; change24h: number; volume: number };
  timestamp?: any;
}

interface TechnicalData {
  btc?: { rsi: number; trend: string; support: number; resistance: number };
  eth?: { rsi: number; trend: string; support: number; resistance: number };
  timestamp?: any;
}

interface SentimentData {
  fearGreed?: number;
  fearGreedLabel?: string;
  trendingTopics?: string[];
  timestamp?: any;
}

interface MacroData {
  vix?: number;
  dxy?: number;
  treasury10y?: number;
  spy?: number;
  timestamp?: any;
}

interface AgentDecision {
  action?: string;
  symbol?: string;
  confidence?: number;
  reasoning?: string;
  timestamp?: any;
}

interface TradeHistoryEntry {
  symbol: string;
  direction: string;
  pnl?: number;
  timestamp?: any;
}

// Trading decision interface for posting
interface TradingDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'LONG' | 'SHORT' | 'CLOSE' | 'EMERGENCY_STOP';
  symbol: 'BTC' | 'ETH' | 'SOL' | 'XRP';
  confidence: number; // 0-1
  reasoning: string;
  position_size?: number;
  stop_loss?: number;
  take_profit?: number;
  market_context?: Record<string, any>;
  risk_level?: 'low' | 'normal' | 'elevated' | 'high';
}

/**
 * Firestore Service - manages connection to Firebase
 */
export class FirestoreService extends Service {
  static serviceType = 'firestore';
  capabilityDescription = 'Provides access to HAIL_MARY market data from Firestore and posts trading decisions';

  private db: Firestore | null = null;
  private app: App | null = null;
  private lastDecision: TradingDecision | null = null;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<FirestoreService> {
    logger.info('*** Starting Firestore service ***');
    const service = new FirestoreService(runtime);
    await service.initialize();
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('*** Stopping Firestore service ***');
    const service = runtime.getService(FirestoreService.serviceType) as FirestoreService;
    if (service) {
      await service.stop();
    }
  }

  async initialize(): Promise<void> {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      // Log credential status (not the actual values)
      logger.info(`Firebase config check - projectId: ${projectId ? 'SET' : 'MISSING'}`);
      logger.info(`Firebase config check - clientEmail: ${clientEmail ? clientEmail.substring(0, 20) + '...' : 'MISSING'}`);
      logger.info(`Firebase config check - privateKey length: ${privateKey?.length || 0}`);
      logger.info(`Firebase config check - privateKey starts with: ${privateKey?.substring(0, 30) || 'N/A'}`);

      // Handle base64 encoded private key (common in Railway/Heroku)
      if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
        logger.info('Using base64 encoded private key');
        privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
        logger.info(`Decoded privateKey length: ${privateKey?.length || 0}`);
      }

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('Firebase credentials not configured - Firestore service disabled');
        return;
      }

      // Fix escaped newlines in private key
      const hadEscapedNewlines = privateKey.includes('\\n');
      privateKey = privateKey.replace(/\\n/g, '\n');
      logger.info(`Private key newline fix applied: ${hadEscapedNewlines}`);
      logger.info(`Private key has BEGIN marker: ${privateKey.includes('-----BEGIN')}`);
      logger.info(`Private key has END marker: ${privateKey.includes('-----END')}`);
      logger.info(`Private key newline count: ${(privateKey.match(/\n/g) || []).length}`);

      // Check if Firebase is already initialized
      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.app = existingApps[0];
        logger.info('Using existing Firebase app');
      } else {
        this.app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        logger.info('Firebase app initialized');
      }

      this.db = getFirestore(this.app);
      logger.info('Firestore connection established');

      // Test connection with a simple read
      try {
        const testDoc = await this.db.collection('agentDecisions').doc('RL80').get();
        logger.info(`Firestore connection verified - RL80 doc exists: ${testDoc.exists}`);
      } catch (testError: any) {
        // Log everything we can about the error
        logger.warn(`Firestore test read failed`);
        logger.warn(`Error type: ${typeof testError}`);
        logger.warn(`Error constructor: ${testError?.constructor?.name}`);
        logger.warn(`Error JSON: ${JSON.stringify(testError, Object.getOwnPropertyNames(testError || {}), 2)}`);
        logger.warn(`Error keys: ${Object.keys(testError || {}).join(', ')}`);
        if (testError?.details) logger.warn(`Error details: ${testError.details}`);
        if (testError?.metadata) logger.warn(`Error metadata: ${JSON.stringify(testError.metadata)}`);
      }
    } catch (error: any) {
      logger.error(`Failed to initialize Firestore: ${error?.message || error?.code || String(error)}`);
      if (error?.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      this.db = null;
    }
  }

  async stop(): Promise<void> {
    logger.info('*** Stopping Firestore service instance ***');
    this.db = null;
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  // ============================================================================
  // READ METHODS
  // ============================================================================

  async getMarketData(): Promise<MarketData | null> {
    if (!this.db) return null;
    try {
      const doc = await this.db.collection('marketData').doc('latest').get();
      return doc.exists ? (doc.data() as MarketData) : null;
    } catch (error: any) {
      logger.error(`Error fetching market data: ${error?.message || error?.code || String(error)}`);
      return null;
    }
  }

  async getTechnicalData(): Promise<TechnicalData | null> {
    if (!this.db) return null;
    try {
      const doc = await this.db.collection('technicalData').doc('latest').get();
      return doc.exists ? (doc.data() as TechnicalData) : null;
    } catch (error: any) {
      logger.error(`Error fetching technical data: ${error?.message || error?.code || String(error)}`);
      return null;
    }
  }

  async getSentimentData(): Promise<SentimentData | null> {
    if (!this.db) return null;
    try {
      const doc = await this.db.collection('agentContext').doc('market').get();
      return doc.exists ? (doc.data() as SentimentData) : null;
    } catch (error: any) {
      logger.error(`Error fetching sentiment data: ${error?.message || error?.code || String(error)}`);
      return null;
    }
  }

  async getMacroData(): Promise<MacroData | null> {
    if (!this.db) return null;
    try {
      const doc = await this.db.collection('macroData').doc('latest').get();
      return doc.exists ? (doc.data() as MacroData) : null;
    } catch (error: any) {
      logger.error(`Error fetching macro data: ${error?.message || error?.code || String(error)}`);
      return null;
    }
  }

  async getLatestDecision(): Promise<AgentDecision | null> {
    if (!this.db) return null;
    try {
      const doc = await this.db.collection('agentDecisions').doc('RL80').get();
      return doc.exists ? (doc.data() as AgentDecision) : null;
    } catch (error: any) {
      logger.error(`Error fetching latest decision: ${error?.message || error?.code || String(error)}`);
      return null;
    }
  }

  async getRecentTrades(limit: number = 5): Promise<TradeHistoryEntry[]> {
    if (!this.db) return [];
    try {
      const snapshot = await this.db
        .collection('tradeHistory')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map((doc) => doc.data() as TradeHistoryEntry);
    } catch (error: any) {
      logger.error(`Error fetching trade history: ${error?.message || error?.code || String(error)}`);
      return [];
    }
  }

  async getAnalystScores(): Promise<Record<string, any> | null> {
    if (!this.db) return null;
    try {
      const snapshot = await this.db
        .collection('agentScores')
        .orderBy('timestamp', 'desc')
        .limit(4)
        .get();

      const scores: Record<string, any> = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.agentId) {
          scores[data.agentId] = data;
        }
      });
      return scores;
    } catch (error: any) {
      logger.error(`Error fetching analyst scores: ${error?.message || error?.code || String(error)}`);
      return null;
    }
  }

  // ============================================================================
  // WRITE METHODS - Trading Decisions
  // ============================================================================

  /**
   * Post a trading decision to Firestore for Railway service to execute
   * This writes to agentDecisions/RL80 which the Railway service monitors
   */
  async postTradingDecision(decision: TradingDecision): Promise<boolean> {
    if (!this.db) {
      logger.error('Cannot post decision - Firestore not connected');
      return false;
    }

    try {
      // Normalize action (LONG -> BUY, SHORT -> SELL for Railway compatibility)
      let normalizedAction = decision.action;
      if (decision.action === 'LONG') normalizedAction = 'BUY';
      if (decision.action === 'SHORT') normalizedAction = 'SELL';
      if (decision.action === 'CLOSE') normalizedAction = 'SELL';

      const decisionDoc = {
        action: normalizedAction,
        symbol: decision.symbol,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        position_size: decision.position_size || null,
        stop_loss: decision.stop_loss || null,
        take_profit: decision.take_profit || null,
        market_context: decision.market_context || null,
        risk_level: decision.risk_level || 'normal',
        timestamp: Date.now(),
        created_at: FieldValue.serverTimestamp(),
        agent_version: 'ElizaOS_RL80_v1',
        source: 'elizaos',
      };

      // Post to main decision document (Railway listens to this)
      await this.db.collection('agentDecisions').doc('RL80').set(decisionDoc);

      // Also log to decision history for audit trail
      await this.db.collection('agentDecisions').doc(`RL80_${Date.now()}`).set(decisionDoc);

      logger.info(`📤 RL80 decision posted: ${normalizedAction} ${decision.symbol} @ ${(decision.confidence * 100).toFixed(0)}%`);

      this.lastDecision = decision;
      return true;
    } catch (error: any) {
      logger.error(`Failed to post trading decision: ${error?.message || error?.code || String(error)}`);
      if (error?.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      return false;
    }
  }

  /**
   * Post a HOLD/no-action decision
   */
  async postHoldDecision(reasoning: string = 'No clear setup - staying patient'): Promise<boolean> {
    return this.postTradingDecision({
      action: 'HOLD',
      symbol: 'ETH', // Default
      confidence: 0.5,
      reasoning,
      risk_level: 'normal',
    });
  }

  /**
   * Emergency stop - halts all trading
   */
  async postEmergencyStop(reason: string = 'Manual emergency stop'): Promise<boolean> {
    return this.postTradingDecision({
      action: 'EMERGENCY_STOP',
      symbol: 'ETH',
      confidence: 1.0,
      reasoning: `EMERGENCY: ${reason}`,
      risk_level: 'high',
    });
  }

  getLastDecision(): TradingDecision | null {
    return this.lastDecision;
  }
}

/**
 * Market Data Provider - injects current market state into RL80's context
 */
const marketDataProvider: Provider = {
  name: 'MARKET_DATA_PROVIDER',
  description: 'Provides real-time market data from Firestore for trading decisions',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    const service = runtime.getService(FirestoreService.serviceType) as FirestoreService;

    if (!service || !service.isConnected()) {
      return {
        text: '[Market data unavailable - Firestore not connected]',
        values: { connected: false },
        data: {},
      };
    }

    try {
      // Fetch all data in parallel
      const [marketData, technicalData, sentimentData, macroData, latestDecision, recentTrades] =
        await Promise.all([
          service.getMarketData(),
          service.getTechnicalData(),
          service.getSentimentData(),
          service.getMacroData(),
          service.getLatestDecision(),
          service.getRecentTrades(5),
        ]);

      // Build context text for RL80
      const contextParts: string[] = [];
      contextParts.push('=== CURRENT MARKET STATE ===');

      // Market prices
      if (marketData) {
        contextParts.push('\n📊 PRICES:');
        if (marketData.btc) {
          contextParts.push(
            `  BTC: $${marketData.btc.price?.toLocaleString()} (${marketData.btc.change24h?.toFixed(2)}% 24h)`
          );
        }
        if (marketData.eth) {
          contextParts.push(
            `  ETH: $${marketData.eth.price?.toLocaleString()} (${marketData.eth.change24h?.toFixed(2)}% 24h)`
          );
        }
        if (marketData.sol) {
          contextParts.push(
            `  SOL: $${marketData.sol.price?.toLocaleString()} (${marketData.sol.change24h?.toFixed(2)}% 24h)`
          );
        }
      }

      // Sentiment
      if (sentimentData) {
        contextParts.push('\n😱 SENTIMENT:');
        contextParts.push(
          `  Fear & Greed: ${sentimentData.fearGreed} (${sentimentData.fearGreedLabel || 'N/A'})`
        );
      }

      // Technical
      if (technicalData?.btc) {
        contextParts.push('\n📈 TECHNICALS (BTC):');
        contextParts.push(`  RSI: ${technicalData.btc.rsi?.toFixed(1)}`);
        contextParts.push(`  Trend: ${technicalData.btc.trend || 'N/A'}`);
        if (technicalData.btc.support) {
          contextParts.push(`  Support: $${technicalData.btc.support.toLocaleString()}`);
        }
        if (technicalData.btc.resistance) {
          contextParts.push(`  Resistance: $${technicalData.btc.resistance.toLocaleString()}`);
        }
      }

      // Macro
      if (macroData) {
        contextParts.push('\n🌍 MACRO:');
        if (macroData.vix) contextParts.push(`  VIX: ${macroData.vix.toFixed(2)}`);
        if (macroData.dxy) contextParts.push(`  DXY: ${macroData.dxy.toFixed(2)}`);
        if (macroData.treasury10y)
          contextParts.push(`  10Y Treasury: ${macroData.treasury10y.toFixed(2)}%`);
      }

      // Latest decision
      if (latestDecision) {
        contextParts.push('\n🎯 LATEST DECISION:');
        contextParts.push(
          `  ${latestDecision.action || 'HOLD'} ${latestDecision.symbol || 'N/A'} @ ${((latestDecision.confidence || 0) * 100).toFixed(0)}% confidence`
        );
        if (latestDecision.reasoning) {
          contextParts.push(`  Reasoning: ${latestDecision.reasoning}`);
        }
      }

      // Recent trades
      if (recentTrades.length > 0) {
        const winCount = recentTrades.filter((t) => (t.pnl || 0) > 0).length;
        const totalPnl = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        contextParts.push('\n📜 RECENT TRADES:');
        contextParts.push(`  Last ${recentTrades.length}: ${winCount}W/${recentTrades.length - winCount}L`);
        contextParts.push(`  Total P&L: $${totalPnl.toFixed(2)}`);
      }

      contextParts.push('\n=== END MARKET STATE ===');

      return {
        text: contextParts.join('\n'),
        values: {
          connected: true,
          hasMarketData: !!marketData,
          hasSentiment: !!sentimentData,
          hasTechnical: !!technicalData,
          hasMacro: !!macroData,
        },
        data: {
          marketData,
          technicalData,
          sentimentData,
          macroData,
          latestDecision,
          recentTrades,
        },
      };
    } catch (error: any) {
      logger.error(`Error in market data provider: ${error?.message || error?.code || String(error)}`);
      return {
        text: '[Error fetching market data]',
        values: { connected: false, error: true },
        data: {},
      };
    }
  },
};

/**
 * Oracle Scores Provider - provides analyst scores from EMO, TEKNO, MACRO
 */
const oracleScoresProvider: Provider = {
  name: 'ORACLE_SCORES_PROVIDER',
  description: 'Provides the Three Wise Oracles analysis scores',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    const service = runtime.getService(FirestoreService.serviceType) as FirestoreService;

    if (!service || !service.isConnected()) {
      return {
        text: '',
        values: {},
        data: {},
      };
    }

    try {
      const scores = await service.getAnalystScores();

      if (!scores || Object.keys(scores).length === 0) {
        return {
          text: '',
          values: {},
          data: {},
        };
      }

      const contextParts: string[] = [];
      contextParts.push('\n=== ORACLE COUNCIL SCORES ===');

      for (const [agentId, scoreData] of Object.entries(scores)) {
        if (scoreData.scores && Array.isArray(scoreData.scores)) {
          contextParts.push(`\n${agentId}:`);
          scoreData.scores.forEach((s: any) => {
            contextParts.push(
              `  ${s.asset}: ${s.direction > 0 ? '+' : ''}${s.direction?.toFixed(1)} @ ${(s.confidence * 100).toFixed(0)}% conf`
            );
          });
        }
      }

      contextParts.push('\n=== END ORACLE SCORES ===');

      return {
        text: contextParts.join('\n'),
        values: { hasScores: true },
        data: { scores },
      };
    } catch (error: any) {
      logger.error(`Error in oracle scores provider: ${error?.message || error?.code || String(error)}`);
      return {
        text: '',
        values: {},
        data: {},
      };
    }
  },
};

// ============================================================================
// TRADING ACTIONS
// ============================================================================

/**
 * MAKE_TRADE Action - Allows RL80 to post trading decisions
 * Railway service will pick these up and execute on Lighter DEX
 */
const makeTradeAction: Action = {
  name: 'MAKE_TRADE',
  similes: ['EXECUTE_TRADE', 'OPEN_POSITION', 'POST_DECISION', 'TRADE'],
  description: 'Post a trading decision to Firestore for execution by Railway service on Lighter DEX',

  validate: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    // Validate if message contains trading intent
    const tradingKeywords = [
      'go long', 'going long', 'open long', 'buy',
      'go short', 'going short', 'open short', 'sell',
      'close position', 'exit', 'take profit',
      'execute', 'trade', 'position',
      'i\'m going', 'i\'m opening', 'i\'m closing',
      'entering', 'exiting',
    ];

    const hasTradeIntent = tradingKeywords.some(kw => text.includes(kw));

    // Also check for asset mentions
    const assets = ['btc', 'eth', 'sol', 'xrp', 'bitcoin', 'ethereum', 'solana'];
    const hasAsset = assets.some(asset => text.includes(asset));

    return hasTradeIntent && hasAsset;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService(FirestoreService.serviceType) as FirestoreService;

    if (!service || !service.isConnected()) {
      await callback({
        text: "I can't post this decision - Firestore connection is down. The trade won't execute until reconnected.",
        action: 'MAKE_TRADE',
      });

      return {
        success: false,
        text: 'Firestore not connected',
        error: new Error('Firestore not connected'),
      };
    }

    try {
      const text = message.content?.text?.toLowerCase() || '';

      // Parse trading intent from message
      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (text.includes('long') || text.includes('buy') || text.includes('bullish')) {
        action = 'BUY';
      } else if (text.includes('short') || text.includes('sell') || text.includes('close') || text.includes('exit')) {
        action = 'SELL';
      }

      // Parse symbol
      let symbol: 'BTC' | 'ETH' | 'SOL' | 'XRP' = 'ETH';
      if (text.includes('btc') || text.includes('bitcoin')) symbol = 'BTC';
      else if (text.includes('sol') || text.includes('solana')) symbol = 'SOL';
      else if (text.includes('xrp')) symbol = 'XRP';

      // Parse confidence (look for percentages)
      let confidence = 0.7; // Default
      const confMatch = text.match(/(\d+)%?\s*(confidence|conviction|conf)/i);
      if (confMatch) {
        confidence = parseInt(confMatch[1]) / 100;
      }

      // Get market context from state/providers
      const marketContext = (state as any)?.marketData || {};

      // Post the decision
      const success = await service.postTradingDecision({
        action,
        symbol,
        confidence,
        reasoning: message.content?.text || 'Trade decision from RL80',
        market_context: marketContext,
        risk_level: confidence >= 0.8 ? 'normal' : confidence >= 0.6 ? 'elevated' : 'low',
      });

      if (success) {
        const responseContent: Content = {
          text: `Decision posted: ${action} ${symbol}-PERP @ ${(confidence * 100).toFixed(0)}% conviction. Railway will execute. Risk defined, thesis confirmed.`,
          action: 'MAKE_TRADE',
        };

        await callback(responseContent);

        return {
          success: true,
          text: `Posted ${action} ${symbol} decision`,
          values: {
            action,
            symbol,
            confidence,
            posted: true,
          },
          data: {
            action,
            symbol,
            confidence,
            timestamp: Date.now(),
          },
        };
      } else {
        await callback({
          text: 'Failed to post decision to Firestore. Will retry on next analysis.',
          action: 'MAKE_TRADE',
        });

        return {
          success: false,
          text: 'Failed to post decision',
          error: new Error('Firestore write failed'),
        };
      }
    } catch (error: any) {
      logger.error(`Error in MAKE_TRADE action: ${error?.message || error?.code || String(error)}`);

      await callback({
        text: 'Error posting trade decision. Protecting capital - staying flat.',
        action: 'MAKE_TRADE',
      });

      return {
        success: false,
        text: 'Error in trade action',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'The oracles are aligned bullish. Go long on ETH.' },
      },
      {
        name: 'RL80',
        content: {
          text: "Decision posted: BUY ETH-PERP @ 75% conviction. Railway will execute. Risk defined, thesis confirmed.",
          action: 'MAKE_TRADE',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'Close the BTC position, take profits.' },
      },
      {
        name: 'RL80',
        content: {
          text: "Decision posted: SELL BTC-PERP @ 80% conviction. Railway will execute. Risk defined, thesis confirmed.",
          action: 'MAKE_TRADE',
        },
      },
    ],
  ],
};

/**
 * EMERGENCY_STOP Action - Halt all trading immediately
 */
const emergencyStopAction: Action = {
  name: 'EMERGENCY_STOP',
  similes: ['HALT_TRADING', 'STOP_ALL', 'PANIC_SELL'],
  description: 'Emergency halt of all trading activity',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return text.includes('emergency') || text.includes('halt') || text.includes('stop all');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService(FirestoreService.serviceType) as FirestoreService;

    if (!service || !service.isConnected()) {
      await callback({
        text: 'EMERGENCY: Cannot reach Firestore to post stop signal. Manual intervention required!',
        action: 'EMERGENCY_STOP',
      });
      return { success: false, text: 'Firestore not connected', error: new Error('No connection') };
    }

    const reason = message.content?.text || 'Emergency stop triggered';
    const success = await service.postEmergencyStop(reason);

    if (success) {
      await callback({
        text: '🚨 EMERGENCY STOP POSTED. All trading halted. Railway will cease execution. Protecting the community.',
        action: 'EMERGENCY_STOP',
      });
      return { success: true, text: 'Emergency stop posted' };
    } else {
      await callback({
        text: 'Failed to post emergency stop! Manual intervention required!',
        action: 'EMERGENCY_STOP',
      });
      return { success: false, text: 'Failed to post emergency stop', error: new Error('Write failed') };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Emergency stop! Market is crashing!' },
      },
      {
        name: 'RL80',
        content: {
          text: '🚨 EMERGENCY STOP POSTED. All trading halted. Railway will cease execution. Protecting the community.',
          action: 'EMERGENCY_STOP',
        },
      },
    ],
  ],
};

/**
 * Firestore Plugin - bundles service, providers, and actions
 */
const firestorePlugin: Plugin = {
  name: 'firestore-hailmary',
  description: 'Connects RL80 to HAIL_MARY market data in Firestore with trading decision posting',
  config: {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_PRIVATE_KEY_BASE64: process.env.FIREBASE_PRIVATE_KEY_BASE64,
  },

  async init(config: Record<string, string>) {
    logger.info('*** Initializing Firestore plugin with trading actions ***');
  },

  services: [FirestoreService],
  providers: [marketDataProvider, oracleScoresProvider],
  actions: [makeTradeAction, emergencyStopAction],
};

export default firestorePlugin;
