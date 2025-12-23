# Trading Module

Consolidated module for all trading-related functionality including AI agents, Lighter testnet integration, market indicators, and trading UI components.

## Structure

```
trading/
├── agents/                    # AI Trading Agents
│   ├── sentiment-oracle.js    # Grok-powered sentiment analysis
│   ├── market-analyst.js      # OpenAI technical analysis
│   ├── macro-specialist.js    # Anthropic macro economics
│   ├── rl80-trader.js        # Lead trader logic
│   └── configs/
│       ├── agent-config.js   # Agent control & settings
│       └── knowledge/         # Shared knowledge base
│
├── lighter/                   # Lighter Testnet Integration
│   ├── clients/              # API client implementations
│   ├── agents/               # Lighter-specific AI agents
│   ├── analysts/             # Market analysis tools
│   ├── trading.js           # Main trading logic
│   ├── websocket.js         # Real-time data
│   └── setup-api-key.js    # Configuration
│
├── api/                      # API Endpoints
│   ├── agents/              # Agent endpoints
│   │   ├── ai-chat.js      # Main chat router
│   │   └── agent-status.js # Status monitoring
│   ├── lighter/             # Lighter endpoints
│   ├── market-data.js      # Market data fetching
│   └── fear-greed.js       # Sentiment indicators
│
├── services/                 # Business Logic
│   ├── tradingBotService.js
│   ├── lighterConnectionManager.js
│   └── risk-appetite-calculator.js
│
├── hooks/                    # React Hooks
│   ├── useLighterAPI.js
│   └── useLighterTrading.js
│
├── components/              # UI Components
│   ├── overlays/           # Trading overlays
│   ├── displays/           # Market displays
│   └── MarketEmojis.jsx   # Visual indicators
│
└── index.js                # Central export file
```

## Quick Start

### Import Everything from One Place

```javascript
// Import agents
import { 
  callSentimentOracle,
  callMarketAnalyst,
  callMacroSpecialist,
  callRL80Trader,
  isAgentEnabled 
} from '@/trading';

// Import hooks
import { useLighterAPI, useLighterTrading } from '@/trading';

// Import components
import { TradingOverlay, FearGreedOverlay } from '@/trading';
```

### Configure Agents

Set environment variables in `.env.local`:

```bash
# Enable/disable agents
NEXT_PUBLIC_AGENTS_ENABLED=true
NEXT_PUBLIC_AGENT_SENTIMENT=true
NEXT_PUBLIC_AGENT_MARKET=true
NEXT_PUBLIC_AGENT_MACRO=true
NEXT_PUBLIC_AGENT_RL80=true

# Mock mode for development
NEXT_PUBLIC_MOCK_SENTIMENT=false
NEXT_PUBLIC_MOCK_MARKET=false
NEXT_PUBLIC_MOCK_MACRO=false
NEXT_PUBLIC_MOCK_RL80=false

# API Keys
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GROK_API_KEY=your_key
```

### Check Agent Status

```bash
curl http://localhost:3000/api/agent-status
```

## AI Agents

### Sentiment Oracle
- **Provider**: Grok (x.ai)
- **Focus**: Crowd psychology, social sentiment
- **Rate Limit**: 1 call per hour
- **Cost**: ~$25 minimum credits

### Market Analyst
- **Provider**: OpenAI GPT-4
- **Focus**: Technical analysis, chart patterns
- **Features**: Support/resistance, indicators

### Macro Specialist
- **Provider**: Anthropic Claude 3.5
- **Focus**: Global economics, central banks
- **Metrics**: DXY, VIX, treasury yields

### RL80 Trader
- **Type**: Logic-based (no API)
- **Role**: Lead trader, synthesizes team input
- **Features**: Risk management, position sizing

## Lighter Integration

### Setup
1. Configure API keys in environment
2. Initialize connection via `/api/lighter/setup-key`
3. Use `useLighterTrading` hook for UI integration

### Features
- Paper trading on testnet
- Real-time WebSocket data
- Order management
- Portfolio tracking

## Development

### Adding Knowledge
Edit `configs/knowledge/trading-knowledge.json`:

```json
{
  "indicators": {
    "custom_indicator": {
      "description": "Your indicator",
      "settings": {}
    }
  }
}
```

### Customizing Agents
Edit individual agent files to modify:
- Personality traits
- Response patterns
- Analysis methods
- Trading strategies

### Mock Mode
Enable mock responses for development:

```javascript
// Returns mock data without API calls
NEXT_PUBLIC_MOCK_SENTIMENT=true
```

## Migration Note

This module consolidates files previously scattered across:
- `/src/lib/agents/` → `/src/trading/agents/`
- `/src/lib/lighter/` → `/src/trading/lighter/`
- `/src/pages/api/` → `/src/trading/api/`
- Various hooks and components → `/src/trading/`

Old API routes in `/src/pages/api/` now redirect to this module for backward compatibility.