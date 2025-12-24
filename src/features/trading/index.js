/**
 * Trading Module - Central Export File
 * 
 * This file provides a clean API for importing all features/trading-related functionality
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
export { default as features/tradingKnowledge } from './agents/configs/knowledge/features/trading-knowledge.json';

// ============================================================================
// LIGHTER TRADING
// ============================================================================

// Clients
export { LighterClient } from './lighter/clients/client';
export { SimpleClient } from './lighter/clients/simple-client';
export { AuthenticatedClient } from './lighter/clients/authenticated-client';

// Lighter Agents
export { AIAgent } from './lighter/agents/ai-agent';
export { AIAgentLLM } from './lighter/agents/ai-agent-llm';

// Lighter Trading
export { features/trading } from './lighter/features/trading';
export { setupApiKey } from './lighter/setup-api-key';
export { websocket } from './lighter/websocket';

// ============================================================================
// SERVICES
// ============================================================================

export { features/tradingBotService } from './services/features/tradingBotService';
export { lighterConnectionManager } from './services/lighterConnectionManager';
export { calculateRiskAppetite } from './services/risk-appetite-calculator';

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

// Note: API route handlers are typically not imported directly,
// but we export them here for reference and potential server-side use

export { default as aiChatHandler } from './api/agents/ai-chat';
export { default as agentStatusHandler } from './api/agents/agent-status';
export { default as fearGreedHandler } from './api/fear-greed';
export { default as marketDataHandler } from './api/market-data';
export { default as marketAdvisorHandler } from './api/market-advisor';
export { default as lighterDataHandler } from './api/lighter-data';