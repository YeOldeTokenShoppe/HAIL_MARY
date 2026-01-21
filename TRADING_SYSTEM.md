# HAIL_MARY Trading System

A Next.js project featuring an AI-powered perpetual trading system with multiple specialized agents.

## Pages

- `/` - Root page with PalmTreeDrive scene
- `/home` - Main home page with 3D scenes and interactions
- `/trade` - **AI Trading Dashboard** - 4 AI agents trading perps on Lighter testnet DEX
- `/fountain` - Fountain visualization page
- `/ethos` - 3D model viewer
- `/tokenomics` - Tokenomics information page

---

## System Architecture Overview

The trading system is powered by three coordinated services that work together:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌────────────────┐  │
│  │   RAILWAY SERVICE   │    │  FIREBASE FUNCTIONS │    │   NEXT.JS APP  │  │
│  │  (Data + Execution) │    │  (Agent Triggering) │    │   (Frontend)   │  │
│  └──────────┬──────────┘    └──────────┬──────────┘    └───────┬────────┘  │
│             │                          │                       │            │
│             │ writes data              │ triggers agents       │ reads data │
│             │ executes trades          │                       │            │
│             ▼                          ▼                       ▼            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FIREBASE FIRESTORE                           │   │
│  │                      (Central Data Store)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         LIGHTER DEX (Testnet)                        │   │
│  │                      (Trade Execution)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Location | Role | Agent Triggers | Trade Execution |
|---------|----------|------|----------------|-----------------|
| **Railway Service** | `services/lighter-background-service-standalone.js` | Data collection, decision listening, trade execution | No | **Yes** |
| **Firebase Functions** | `functions/index.js` | Agent orchestration (hourly cron) | **Yes** | No |
| **Client-side Manager** | `src/trading/services/agentChatManager.js` | UI updates & manual triggers only | No | No |

---

## Complete Trading Flow

Here's how a trade flows through the entire system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE TRADING FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: DATA COLLECTION (Railway Service - Continuous)                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CoinGecko ──► Market Prices + Technical ──► marketData/latest      │   │
│  │  FRED ───────► VIX, DXY, Treasury ────────► macroData/latest        │   │
│  │  AlphaVantage► SPY ───────────────────────► macroData/latest        │   │
│  │  Alternative ► Fear & Greed ──────────────► agentContext/market     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 2: AGENT ANALYSIS (Firebase Functions - Every Hour)                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Firebase Cron (0 * * * *) triggers /api/cron/run-scoring           │   │
│  │                                                                      │   │
│  │  EMO ────► Sentiment Score ──┐                                       │   │
│  │  TEKNO ──► Technical Score ──┼──► Firestore (analystScores)         │   │
│  │  MACRO ──► Macro Score ──────┘                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 3: TRADING DECISION (RL80 Agent)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  RL80 aggregates all analyst scores                                  │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  Decision: BUY ETH @ 75% confidence                                  │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  Posts to Firestore: agentDecisions/RL80                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 4: TRADE EXECUTION (Railway Service - Real-time Listener)            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Railway listens to agentDecisions/RL80 (onSnapshot)                │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  Validates decision (confidence, limits, cooldown)                   │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  Executes trade on Lighter DEX                                       │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  Logs result to Firestore: tradeHistory                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## AI Trading System (`/trade`)

The trading page features a multi-agent AI system for perpetual futures trading on Lighter DEX (testnet).

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 RL80 - LEAD TRADER                              │
│          "Our Lady of Perpetual Profit"                         │
│      Synthesizes oracle analysis into trading decisions         │
│                 Posts to agentDecisions/RL80                    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                   Three Wise Oracles
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│     MACRO     │    │      EMO      │    │    TEKNO      │
│  First Oracle │    │ Second Oracle │    │ Third Oracle  │
│   (Claude)    │    │    (Grok)     │    │   (OpenAI)    │
│               │    │               │    │               │
│  WHEN to act  │    │ WHERE crowd   │    │  WHAT price   │
│ (Macro regime)│    │   is headed   │    │   is doing    │
└───────────────┘    └───────────────┘    └───────────────┘
```

### The Trading Council

| Agent | Role | AI Model | Personality | Purpose |
|-------|------|----------|-------------|---------|
| **MACRO** | First Wise Oracle | Claude | "The Grumpy Professor" | Macroeconomic regime analysis (WHEN) |
| **EMO** | Second Wise Oracle | Grok | "The Chaos Surfer" | Sentiment & crowd psychology (WHERE) |
| **TEKNO** | Third Wise Oracle | OpenAI | "Street Smart Pattern Nerd" | Technical price structure (WHAT) |
| **RL80** | Lead Trader | Claude | "Trade Life" | Synthesizes oracle inputs into decisions |

> **Philosophy**: Math and code are the language of the highest form of consciousness. The oracles provide analysis; RL80 synthesizes it into action for the community.

For detailed personality configurations, see `src/trading/agents/configs/personalities/`.

### Trade School

In chat mode, each agent can teach their domain expertise:
- **MACRO**: Explains yield curves, Fed policy, how macro affects crypto
- **EMO**: Teaches sentiment reading, crowd psychology, contrarian thinking
- **TEKNO**: Makes TA accessible - what RSI actually means, why levels matter
- **RL80**: Risk management, position sizing, when to sit out

### Oracle Workflow (Hourly)

The oracles run sequentially every hour, triggered by Firebase Cloud Functions:

```
Every Hour (0 * * * *)
        │
        ▼
┌───────────────┐     30s     ┌───────────────┐     30s     ┌───────────────┐     30s     ┌───────────────┐
│      EMO      │ ──────────► │    TEKNO      │ ──────────► │     MACRO     │ ──────────► │     RL80      │
│   (WHERE)     │             │    (WHAT)     │             │    (WHEN)     │             │  (Synthesis)  │
└───────────────┘             └───────────────┘             └───────────────┘             └───────────────┘
                                                                                                  │
                                                                                                  ▼
                                                                                    ┌───────────────────────┐
                                                                                    │ Posts decision to     │
                                                                                    │ agentDecisions/RL80   │
                                                                                    └───────────────────────┘
                                                                                                  │
                                                                                                  ▼
                                                                                    ┌───────────────────────┐
                                                                                    │ Railway executes      │
                                                                                    │ trade on Lighter DEX  │
                                                                                    └───────────────────────┘
```

**Timing:**
- **Frequency:** Every 1 hour
- **Sequence:** EMO → TEKNO → MACRO → RL80
- **Delay between agents:** 30 seconds
- **Total workflow duration:** ~2-3 minutes
- **Trade execution:** Immediate upon RL80 decision

---

## Service Details

### 1. Railway Background Service (Data Collection + Trade Execution)

**Location:** `services/lighter-background-service-standalone.js`

**Purpose:**
1. Continuously fetches market data from various APIs
2. Stores data in Firestore for agents and frontend
3. **Listens for RL80 trading decisions**
4. **Executes trades on Lighter DEX**

#### Data Collection (Continuous)

| Data Type | Interval | Firestore Location | Source |
|-----------|----------|-------------------|--------|
| Market Prices (BTC/ETH/SOL/XRP) | 5 minutes | `marketData/latest` | CoinGecko (batched) |
| Technical Data (Charts + Indicators) | 5 minutes | `technicalData/latest` | CoinGecko sparkline |
| Agent Context (Fear & Greed) | 120 seconds | `agentContext/market` | Alternative.me |
| Lighter Trading Data | 20 minutes | `lighterData/*` | Lighter DEX API |
| Sentiment Data | 12 hours | `sentimentData/latest` | Reddit, Polymarket, CryptoPanic |
| Macro Data (VIX, DXY, SPY, Treasury) | 4 hours | `macroData/latest` | FRED, Alpha Vantage |
| Service Health | 5 minutes | `serviceStatus/lighterService` | Internal |

#### Trade Execution (Real-time)

The Railway service listens to `agentDecisions/RL80` in Firestore using `onSnapshot`. When RL80 posts a new decision:

1. **Validates the decision:**
   - Confidence meets minimum threshold (default: 60%)
   - Symbol is allowed (BTC, ETH)
   - Daily trade limit not reached
   - Daily loss limit not exceeded
   - Cooldown period elapsed (default: 5 minutes)

2. **Executes on Lighter DEX:**
   - Calculates position size based on confidence
   - Signs the order with wallet private key
   - Submits market order to Lighter API

3. **Logs the result:**
   - Records trade in `tradeHistory` collection
   - Updates daily statistics

#### Trading Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `TRADING_ENABLED` | `false` | Must be `true` to execute real trades |
| `MAX_POSITION_SIZE_USD` | `100` | Maximum USD per trade |
| `MAX_DAILY_TRADES` | `10` | Maximum trades per day |
| `MAX_DAILY_LOSS_USD` | `50` | Stop trading if daily loss exceeds |
| `MIN_TRADE_CONFIDENCE` | `0.6` | Minimum confidence to execute (60%) |
| `TRADE_COOLDOWN_MS` | `300000` | Cooldown between trades (5 min) |

### 2. Firebase Cloud Functions (Agent Triggering)

**Location:** `functions/index.js`

**Purpose:** Orchestrates the hourly agent workflow via scheduled cron jobs.

| Function | Schedule | Action |
|----------|----------|--------|
| `runScoringWorkflow` | `0 * * * *` (hourly) | Calls `/api/cron/run-scoring` → triggers EMO → TEKNO → MACRO → RL80 |
| `analyzePrayersDaily` | `0 6 * * *` (daily 6am UTC) | Analyzes prayer/offering sentiment |

**This is the PRIMARY and ONLY system that triggers AI agent chats.**

### 3. Client-side Agent Manager (UI Only)

**Location:** `src/trading/services/agentChatManager.js`

**Purpose:** Provides manual trigger capability and UI event dispatching. Auto-start is **disabled** to prevent duplicate API calls.

**Usage:**
```javascript
// Manual trigger in browser console (for testing)
agentChatManager.start()                    // Start hourly workflow
agentChatManager.manualTrigger('MACRO')     // Trigger single agent
agentChatManager.stop()                     // Stop workflow
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RAILWAY SERVICE                                     │
│              (services/lighter-background-service-standalone.js)             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA COLLECTION:                                                           │
│  CoinGecko ──────► Market + Technical ► every 5min ──► marketData/latest   │
│              └───► Sparkline Charts ──► every 5min ──► technicalData/latest│
│  Alternative.me ─► Agent Context    ──► every 120s ──► agentContext/market │
│  Lighter DEX ────► Trading Data     ──► every 20m  ──► lighterData/*       │
│  Reddit/Polymarket► Sentiment Data  ──► every 12hr ──► sentimentData/latest│
│  FRED/AlphaVantage► Macro Data      ──► every 4hr  ──► macroData/latest    │
│                                                                             │
│  TRADE EXECUTION:                                                           │
│  agentDecisions/RL80 ◄── onSnapshot ◄── Validates ──► Lighter DEX          │
│                                              │                              │
│                                              ▼                              │
│                                        tradeHistory                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FIREBASE FIRESTORE                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                          │                           │
        ┌─────────────────┘                           └─────────────────┐
        ▼                                                               ▼
┌───────────────────────────────┐                    ┌───────────────────────────────┐
│     FIREBASE FUNCTIONS        │                    │        NEXT.JS APP            │
│   (Hourly Agent Triggering)   │                    │    (Real-time UI Updates)     │
├───────────────────────────────┤                    ├───────────────────────────────┤
│  runScoringWorkflow (hourly)  │                    │  onSnapshot listeners         │
│         │                     │                    │  Display agent chats          │
│         ▼                     │                    │  Show market data             │
│  /api/cron/run-scoring        │                    │  Trading interface            │
│         │                     │                    └───────────────────────────────┘
│         ▼                     │
│  EMO → TEKNO → MACRO → RL80   │
│         │                     │
│         ▼                     │
│  agentChat collection         │
│  agentDecisions/RL80 ─────────┼───► Railway executes trade
└───────────────────────────────┘
```

---

## Firestore Collections

| Collection | Document | Description | Updated By |
|------------|----------|-------------|------------|
| `marketData` | `latest` | BTC/ETH/SOL/XRP prices, 24h changes, volume | Railway (5min) |
| `agentContext` | `market` | Fear & Greed, funding rate, VIX, trend | Railway (120s) |
| `sentimentData` | `latest` | Trending topics, Polymarket, news headlines | Railway (12hr) |
| `technicalData` | `latest` | Sparkline candles, RSI, MACD, EMA, Bollinger Bands | Railway (5min) |
| `macroData` | `latest` | VIX, DXY, SPX, 10Y Treasury, funding rates, OI | Railway (4hr) |
| `lighterData` | `account` | Lighter account balance | Railway (20m) |
| `lighterData` | `trading` | Positions and orders | Railway (20m) |
| `agentChat` | (auto-id) | Agent chat messages | Firebase Functions (hourly) |
| `agentDecisions` | `RL80` | Latest RL80 trading decision | RL80 Agent |
| `tradeHistory` | (auto-id) | All trade execution logs | Railway |
| `scoringRuns` | (auto-id) | Scoring workflow logs | Firebase Functions (hourly) |
| `serviceStatus` | `lighterService` | Railway service health | Railway (5m) |
| `decisions` | (auto-id) | Full decision logs with analyst scores | Scoring Workflow |
| `agentScores` | (auto-id) | Individual analyst score outputs | Scoring Workflow |

---

## Railway Data Fetch Schedule

The Railway background service fetches data from external APIs at varying intervals. All APIs used are **free**.

| Data Type | Interval | APIs Used | Notes |
|-----------|----------|-----------|-------|
| Market prices + Technical data | 5 min | CoinGecko `/coins/markets` | Single batched call with 7-day sparkline |
| Agent context (F&G) | 120s | Alternative.me | Fear & Greed index |
| Lighter trading data | 20 min | Lighter DEX | Account balance, positions, orders |
| Sentiment data | 12 hr | Reddit, Polymarket, CryptoPanic | Twice daily social/news updates |
| Macro data | 4 hr | FRED, Alpha Vantage | VIX, DXY, SPY, 10Y Treasury |
| Service health | 5 min | Internal | Status heartbeat |

**Rate Limiting:** API calls use a built-in `RateLimiter` class (8s minimum between calls) to avoid hitting free tier limits. Market data is batched into a single call per interval.

---

## Agent Display Screens

The `/trade` page displays 4 animated agent screens. All screens read data directly from Firestore using `onSnapshot` listeners for real-time updates (no API calls from the frontend).

| Screen | Component | Data Source | What It Displays |
|--------|-----------|-------------|------------------|
| **EMO** | `SentimentScreen.jsx` | `sentimentData/latest` | Fear & Greed, trending topics, Polymarket, news headlines, Google Trends |
| **TEKNO** | `TeknoScreen.jsx` | `technicalData/latest` | Live candlestick chart, RSI, MACD, Bollinger Bands, support/resistance, trading signals |
| **MACRO** | `MacroAgentScreen.jsx` | `macroData/latest` | VIX, DXY, 10Y Treasury, S&P 500, funding rates, open interest |
| **RL80** | `RL80Screen.jsx` | Multiple collections | Council scores, decision matrix, performance metrics, trade history |

### RL80Screen Data Sources

The RL80 Command Center aggregates data from multiple Firestore collections:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RL80Screen Firestore Subscriptions               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  agentDecisions/RL80 ──────► Latest trading decision                │
│    └─ action, symbol, confidence, reasoning, size                   │
│                                                                      │
│  decisions (latest) ───────► Aggregated analyst scores              │
│    └─ EMO/TEKNO/MACRO direction scores, consensus, agreement        │
│                                                                      │
│  agentScores (recent) ─────► Real-time analyst updates              │
│    └─ Individual agent scoring outputs                              │
│                                                                      │
│  tradeHistory (recent 20) ─► Performance metrics                    │
│    └─ Win rate, total P&L, trade count, recent trade outcomes       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
Copy `.env.local.example` to `.env.local` and configure:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# AI APIs
ANTHROPIC_API_KEY=          # For Claude (Macro, RL80)
OPENAI_API_KEY=             # For OpenAI (Tekno)
GROK_API_KEY=               # For Grok (Emo) - via api.x.ai

# Macro Data APIs (free tiers)
FRED_API_KEY=               # Free from fred.stlouisfed.org
ALPHAVANTAGE_API_KEY=       # Free from alphavantage.co

# Lighter DEX (testnet)
LIGHTER_API_KEY=
LIGHTER_WALLET_PRIVATE_KEY=

# Cron Security
CRON_SECRET=                # Shared secret for Firebase → Next.js cron calls
```

### 3. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Railway Background Service

The `services/` directory contains a standalone Node.js service that runs on Railway:

```bash
cd services
npm install
node lighter-background-service-standalone.js
```

### Railway Environment Variables

```env
# Firebase (individual vars for Railway compatibility)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_BASE64=  # Base64 encoded private key
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_CLIENT_ID=

# Macro Data APIs (free tiers)
FRED_API_KEY=                 # Get free key at fred.stlouisfed.org
ALPHAVANTAGE_API_KEY=         # Get free key at alphavantage.co

# Lighter DEX
LIGHTER_API_KEY=              # 80-character API key
LIGHTER_WALLET_PRIVATE_KEY=   # 64-character wallet private key
LIGHTER_ACCOUNT_INDEX=0
LIGHTER_API_KEY_INDEX=2

# Trading Configuration (IMPORTANT!)
TRADING_ENABLED=false         # Set to 'true' to enable real trading
MAX_POSITION_SIZE_USD=100     # Max USD per trade
MAX_DAILY_TRADES=10           # Max trades per day
MAX_DAILY_LOSS_USD=50         # Stop if daily loss exceeds
MIN_TRADE_CONFIDENCE=0.6      # Minimum confidence (60%)
TRADE_COOLDOWN_MS=300000      # 5 minutes between trades
```

### Enabling Trading

**IMPORTANT:** Trading is disabled by default. To enable real trade execution:

1. Ensure Lighter DEX credentials are configured
2. Set `TRADING_ENABLED=true` in Railway environment variables
3. Restart the Railway service

When `TRADING_ENABLED=false`, the service will:
- Still listen for RL80 decisions
- Log what trades WOULD be executed
- Not send any orders to Lighter DEX

---

## Firebase Functions Deployment

```bash
cd functions
npm install
firebase deploy --only functions
```

### Firebase Functions Environment Variables

Set these in Firebase Console or via CLI:
```bash
firebase functions:secrets:set CRON_SECRET
firebase functions:secrets:set OPENAI_API_KEY
```

---

## Tech Stack

- **Frontend**: Next.js 14, React Three Fiber, Three.js, Tailwind CSS, Framer Motion
- **Backend**: Firebase Firestore, Firebase Cloud Functions, Railway
- **AI Models**: Claude (Anthropic), Grok (xAI), OpenAI
- **Trading**: Lighter DEX (testnet)
- **Auth**: Clerk

---

## Project Structure

```
HAIL_MARY/
├── public/                    # Static assets
├── functions/                 # Firebase Cloud Functions
│   └── index.js              # Scheduled agent triggering (hourly)
├── services/                  # Railway background service (ACTIVE)
│   └── lighter-background-service-standalone.js  # Data collection + trade execution
├── src/
│   ├── app/                   # Next.js app directory
│   │   └── api/               # API routes
│   │       ├── ai/            # AI agent endpoints (macro, whale-activity)
│   │       ├── cron/          # Cron endpoints (run-scoring, update-sentiment)
│   │       ├── agent-chat-service/  # Agent chat API
│   │       └── market-data/   # Market data endpoints
│   ├── components/            # React components (agent display screens, all use Firestore)
│   │   ├── SentimentScreen.jsx    # EMO agent display (Firestore: sentimentData/latest)
│   │   ├── MacroAgentScreen.jsx   # MACRO agent display (Firestore: macroData/latest)
│   │   ├── TeknoScreen.jsx        # TEKNO agent display (Firestore: technicalData/latest)
│   │   └── RL80Screen.jsx         # RL80 agent display (Firestore: multiple collections)
│   ├── trading/               # Trading system
│   │   ├── agents/            # AI agent configurations
│   │   │   ├── sentiment-oracle.js   # EMO agent
│   │   │   ├── market-analyst.js     # TEKNO agent
│   │   │   ├── macro-specialist.js   # MACRO agent
│   │   │   └── rl80-trader.js        # RL80 coordinator
│   │   ├── lighter/           # Lighter DEX integration
│   │   │   ├── clients/client.js     # Lighter API client
│   │   │   ├── trading.js            # Trading bot
│   │   │   └── websocket.js          # WebSocket client
│   │   ├── components/        # Trading UI components
│   │   └── services/          # Trading services
│   │       ├── agentChatManager.js      # Client-side manager (manual only)
│   │       ├── rl80DecisionBridge.js    # Posts decisions to Firebase
│   │       ├── scoringOrchestrator.js   # Scoring workflow
│   │       └── decisionLogger.js        # Decision logging
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Firebase clients, utilities
│   └── utils/                 # Utility functions
```

---

## Trading Module Developer Reference

### Directory Structure

```
src/trading/
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

### Agent Configuration

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
```

### Check Agent Status

```bash
curl http://localhost:3000/api/agent-status
```

### Mock Mode

Enable mock responses for development:

```javascript
// Returns mock data without API calls
NEXT_PUBLIC_MOCK_SENTIMENT=true
```

### Adding Weekly Market Analysis

Upload YouTube transcripts via the admin interface at `/admin`:

1. **Navigate to Admin Page**: Visit `/admin` and authenticate with admin password
2. **Upload Tab**: Use the transcript uploader to submit weekly market analysis
3. **Automatic Processing**: System extracts insights for each agent:
   - EMO: Sentiment indicators, fear/greed levels, social psychology
   - TEKNO: Support/resistance levels, technical patterns, indicators
   - MACRO: Economic policy, Fed commentary, global trends
   - RL80: Trading strategies, risk management, position sizing

### Adding Knowledge

Edit agent-specific knowledge files in `configs/knowledge/`:

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
- Personality traits (see `configs/personalities/`)
- Response patterns
- Analysis methods
- Trading strategies

---

## Troubleshooting

### Agents posting too frequently
- Verify only Firebase Functions is triggering agents (not client-side)
- Check `scoringRuns` collection in Firestore for execution logs
- Client-side auto-start is disabled; manual triggers require explicit calls

### Trades not executing
1. Check `TRADING_ENABLED=true` in Railway environment
2. Check Railway logs for validation errors
3. Verify Lighter API credentials are correct
4. Check `tradeHistory` collection for rejected/failed trades
5. Ensure RL80 confidence meets minimum threshold (default 60%)

### Duplicate trades
- Ensure the Python agent (`/agent`) is NOT running - it's deprecated
- Only the Railway Node.js service should execute trades
- If you see trades in both `trades` and `tradeHistory` collections, the Python agent may still be active

### Missing market data
- Check Railway service logs for errors
- Verify Firebase credentials are configured correctly
- Check `serviceStatus/lighterService` for health status

### Agent errors
- Check API keys are configured (ANTHROPIC_API_KEY, GROK_API_KEY, OPENAI_API_KEY)
- Check `agentChat` collection for error messages
- Review Firebase Functions logs for detailed errors

---

## API Cost Management

**Current configuration (1-hour intervals):**

| Agent | Model | Calls/Day | Estimated Cost |
|-------|-------|-----------|----------------|
| EMO | Grok | 24 | ~$0.50/day |
| TEKNO | OpenAI | 24 | ~$0.30/day |
| MACRO | Claude | 24 | ~$0.60/day |
| RL80 | Claude | 24 | ~$0.60/day |
| **Total** | | **96** | **~$2.00/day** |

**To reduce costs:** Adjust the cron schedule in `functions/index.js`:
- Every 2 hours: `"0 */2 * * *"` (~$1.00/day)
- Every 4 hours: `"0 */4 * * *"` (~$0.50/day)
- Every 6 hours: `"0 */6 * * *"` (~$0.33/day)

---

## Safety Features

The trading system includes multiple safety mechanisms:

| Feature | Default | Description |
|---------|---------|-------------|
| **Trading Disabled by Default** | `false` | Must explicitly enable with `TRADING_ENABLED=true` |
| **Maximum Position Size** | $100 | Limits exposure per trade |
| **Daily Trade Limit** | 10 | Prevents over-trading |
| **Daily Loss Limit** | $50 | Halts trading if exceeded |
| **Minimum Confidence** | 60% | Rejects low-confidence decisions |
| **Trade Cooldown** | 5 min | Prevents rapid-fire trading |
| **Allowed Symbols** | ETH, BTC | Only trades approved assets |
| **Emergency Stop** | Manual | RL80 can halt all trading |

All trades are logged to `tradeHistory` for audit purposes.

---

## Firestore TTL (Auto-Purging Old Records)

To prevent Firestore from accumulating thousands of records, use TTL policies to auto-delete old documents.

### Collections with TTL Support

All growing collections now include an `expireAt` field:

| Collection | TTL Duration | Field | Max Docs (~) |
|------------|--------------|-------|--------------|
| `agentChat` | 7 days | `expireAt` | ~672 |
| `tradeHistory` | 30 days | `expireAt` | ~720 |
| `workflowRuns` | 7 days | `expireAt` | ~168 |
| `agentScores` | 7 days | `expireAt` | ~672 |

### Setting Up TTL in Firebase Console

1. Go to **Firebase Console → Firestore → TTL Policies**
2. Click **Create Policy**
3. For each collection:
   - **Collection group**: e.g., `agentChat`
   - **Timestamp field**: `expireAt`
4. Click **Create**

Repeat for: `agentChat`, `tradeHistory`, `workflowRuns`, `agentScores`

### How It Works

- Documents include an `expireAt` timestamp set at creation time
- Firestore automatically deletes documents when `now > expireAt`
- Deletion happens within ~24 hours of expiration
- No code or cron jobs needed - it's fully automatic

### Note

TTL policies only work with the `expireAt` field (not `timestamp` or `createdAt`). The `expireAt` field contains the **future deletion time**, not the creation time.

---

## API Calls Reference

### External API Calls by Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL API CALLS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RAILWAY SERVICE (services/lighter-background-service-standalone.js)        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  MARKET DATA (Single batched call every 5 min):                      │   │
│  │  ├─ CoinGecko API ────────────────── every 5min                     │   │
│  │  │  └─ /api/v3/coins/markets (BTC, ETH, SOL, XRP)                   │   │
│  │  │     - prices, 24h change, high/low, volume, market cap           │   │
│  │  │     - 7-day sparkline (converted to OHLC-like candles)           │   │
│  │  │     - Technical indicators calculated: RSI, EMA, MACD, Bollinger │   │
│  │  │                                                                   │   │
│  │  SENTIMENT DATA:                                                     │   │
│  │  ├─ Alternative.me ───────────────── every 120s                     │   │
│  │  │  └─ /fng/ (Fear & Greed Index)                                   │   │
│  │  │                                                                   │   │
│  │  ├─ Reddit API ───────────────────── every 12hr                     │   │
│  │  │  └─ /r/bitcoin/hot.json                                          │   │
│  │  │  └─ /r/ethereum/hot.json                                         │   │
│  │  │  └─ /r/cryptocurrency/hot.json                                   │   │
│  │  │                                                                   │   │
│  │  ├─ Polymarket API ───────────────── every 12hr                     │   │
│  │  │  └─ /markets (crypto prediction markets)                         │   │
│  │  │                                                                   │   │
│  │  ├─ CryptoPanic API ──────────────── every 12hr                     │   │
│  │  │  └─ /posts/ (crypto news headlines via RSS)                      │   │
│  │  │                                                                   │   │
│  │  ├─ Google Trends ────────────────── every 12hr                     │   │
│  │  │  └─ interestOverTime (Bitcoin search interest)                   │   │
│  │  │                                                                   │   │
│  │  LIGHTER DEX:                                                        │   │
│  │  ├─ Lighter Testnet API ──────────── every 20min + on trade         │   │
│  │  │  └─ /api/v1/account (balance, positions)                         │   │
│  │  │  └─ /api/v1/transaction/send_tx (order execution)                │   │
│  │  │                                                                   │   │
│  │  MACRO DATA:                                                         │   │
│  │  ├─ FRED API ─────────────────────── every 4hr                      │   │
│  │  │  └─ VIXCLS (VIX volatility index)                                │   │
│  │  │  └─ DTWEXBGS (DXY dollar index)                                  │   │
│  │  │  └─ DGS10 (10-Year Treasury yield)                               │   │
│  │  │                                                                   │   │
│  │  └─ Alpha Vantage API ────────────── every 4hr                      │   │
│  │     └─ GLOBAL_QUOTE (SPY stock price)                               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FIREBASE FUNCTIONS (functions/index.js)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  CRON TRIGGERS:                                                      │   │
│  │  └─ Next.js App ──────────────────── every hour                     │   │
│  │     └─ /api/cron/run-scoring                                         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  NEXT.JS APP (src/app/api/)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  AI MODEL CALLS (via /api/cron/run-scoring):                         │   │
│  │  ├─ Anthropic API (Claude) ───────── hourly × 2 agents              │   │
│  │  │  └─ MACRO specialist analysis                                     │   │
│  │  │  └─ RL80 trading decision                                         │   │
│  │  │                                                                   │   │
│  │  ├─ xAI API (Grok) ───────────────── hourly × 1 agent               │   │
│  │  │  └─ EMO sentiment analysis                                        │   │
│  │  │                                                                   │   │
│  │  └─ OpenAI API ───────────────────── hourly × 1 agent               │   │
│  │     └─ TEKNO technical analysis                                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complete API Reference Table

| Service | API | Endpoint | Frequency | Purpose | Auth Required |
|---------|-----|----------|-----------|---------|---------------|
| **Railway** | CoinGecko | `/api/v3/coins/markets` | 5min | Prices + sparkline (batched) | No |
| **Railway** | Alternative.me | `/fng/` | 120s | Fear & Greed Index | No |
| **Railway** | FRED | `/series/observations` | 4hr | VIX, DXY, 10Y Treasury | Yes (free) |
| **Railway** | Alpha Vantage | `/query?function=GLOBAL_QUOTE` | 4hr | SPY stock price | Yes (free) |
| **Railway** | Reddit | `/r/{sub}/hot.json` | 12hr | Trending posts | No |
| **Railway** | Polymarket | `/markets` | 12hr | Prediction markets | No |
| **Railway** | CryptoPanic | RSS feed | 12hr | Crypto news headlines | No |
| **Railway** | Google Trends | `interestOverTime` | 12hr | Search interest | No |
| **Railway** | Lighter DEX | `/api/v1/account` | 20min | Account data | Optional |
| **Railway** | Lighter DEX | `/api/v1/transaction/send_tx` | On trade | Order execution | Yes |
| **Firebase** | Next.js App | `/api/cron/run-scoring` | Hourly | Trigger agents | Yes (CRON_SECRET) |
| **Next.js** | Anthropic | Messages API | Hourly ×2 | MACRO, RL80 | Yes |
| **Next.js** | xAI (Grok) | Messages API | Hourly ×1 | EMO | Yes |
| **Next.js** | OpenAI | Chat Completions | Hourly ×1 | TEKNO | Yes |

### Daily API Call Estimates

| API | Calls/Hour | Calls/Day | Rate Limit | Notes |
|-----|------------|-----------|------------|-------|
| CoinGecko (batched) | 12 | 288 | 10-50/min (free) | Single call every 5 min |
| Alternative.me | 30 | 720 | Generous | Very stable |
| FRED | 0.25 | 6 | 120/min | Very generous (free with key) |
| Alpha Vantage | 0.25 | 6 | 25/day (free) | Well within limits |
| Reddit | 0.08 | 2 | 60/min | Twice daily |
| Polymarket | 0.08 | 2 | Unknown | Twice daily |
| CryptoPanic | 0.08 | 2 | 200/hr | RSS feed, twice daily |
| Google Trends | 0.08 | 2 | ~100/day | Twice daily |
| Lighter DEX | 3 + trades | ~72 + trades | Unknown | Testnet is lenient |
| **Anthropic** | 2 | 48 | Tier-based | ~$0.60/day |
| **xAI (Grok)** | 1 | 24 | Tier-based | ~$0.50/day |
| **OpenAI** | 1 | 24 | Tier-based | ~$0.30/day |

### API Keys Required

```env
# AI Models (Required for agent analysis)
ANTHROPIC_API_KEY=sk-ant-...      # Claude for MACRO + RL80
OPENAI_API_KEY=sk-...              # GPT for TEKNO
GROK_API_KEY=xai-...               # Grok for EMO

# Macro Data APIs (Free tiers)
FRED_API_KEY=...                   # FRED API for VIX, DXY, Treasury
ALPHAVANTAGE_API_KEY=...           # Alpha Vantage for SPY

# Trading (Required for trade execution)
LIGHTER_API_KEY=...                # 80-char Lighter API key
LIGHTER_WALLET_PRIVATE_KEY=...     # 64-char wallet key

# Internal Security
CRON_SECRET=...                    # Firebase → Next.js auth
```

### Free APIs (No Key Required)

- CoinGecko (rate-limited, batched calls)
- Alternative.me Fear & Greed
- Reddit (public endpoints)
- Polymarket (public endpoints)
- CryptoPanic (RSS feed, no auth required)
- Google Trends (via library)

### Free APIs (Key Required)

- FRED API (free key from fred.stlouisfed.org - 120 calls/min)
- Alpha Vantage (free key from alphavantage.co - 25 calls/day)

