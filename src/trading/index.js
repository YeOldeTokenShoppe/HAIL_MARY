/**
 * Trading Module - Central Export File
 *
 * This file provides a clean API for importing all trading-related functionality
 * from a single location.
 */

// ============================================================================
// AGENTS
// ============================================================================

// Individual Agents
export { callSentimentOracle, SENTIMENT_ORACLE_CONFIG } from './agents/sentiment-oracle';
export { callMarketAnalyst, MARKET_ANALYST_CONFIG } from './agents/market-analyst';
export { callMacroSpecialist, MACRO_SPECIALIST_CONFIG } from './agents/macro-specialist';
export { callRL80Trader, RL80_TRADER_CONFIG } from './agents/rl80-trader';

// Agent Configuration
export {
  AGENT_CONFIG,
  isAgentEnabled,
  getMockResponse,
  isRateLimited,
  getAgentStatus,
  printAgentStatus,
  logApiCall,
  logResponse
} from './agents/configs/agent-config';

// Knowledge Base
export { default as tradingKnowledge } from './agents/configs/knowledge/trading-knowledge.json';

// ============================================================================
// SERVICES
// ============================================================================

export { tradingBotService } from './services/tradingBotService';
export { calculateRiskAppetite } from './services/risk-appetite-calculator';
export { paperTradingService } from './services/paperTradingService';

// ============================================================================
// HOOKS
// ============================================================================

export { useLighterAPI } from './hooks/useLighterAPI';
export { useLighterTrading } from './hooks/useLighterTrading';

// ============================================================================
// COMPONENTS
// ============================================================================

// Overlays
export { default as TradingOverlay } from './components/overlays/TradingOverlay';
export { FearGreedOverlay } from './components/overlays/FearGreedOverlay';

// Displays
export { TickerDisplay } from './components/displays/TickerDisplay';
export { TickerDisplay3 } from './components/displays/TickerDisplay3';
export { SingleCandleDisplay } from './components/displays/SingleCandleDisplay';

// Market Components
export { MarketEmojis } from './components/MarketEmojis';

// ============================================================================
// API HANDLERS
// ============================================================================

export { default as aiChatHandler } from './api/agents/ai-chat';
export { default as agentStatusHandler } from './api/agents/agent-status';
export { default as fearGreedHandler } from './api/fear-greed';
export { default as marketDataHandler } from './api/market-data';
export { default as marketAdvisorHandler } from './api/market-advisor';
