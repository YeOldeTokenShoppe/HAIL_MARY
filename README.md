# HAIL_MARY

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
│  │  CoinGecko ──► Market Prices ──► Firestore (marketData/latest)      │   │
│  │  Binance ────► Whale Activity ─► Firestore (sentimentData/latest)   │   │
│  │  Alternative ► Fear & Greed ──► Firestore (agentContext/market)     │   │
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
│                      RL80 COORDINATOR                            │
│            (Aggregates specialist recommendations)               │
│                    Makes final trade decisions                   │
│                    Posts to agentDecisions/RL80                  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│     MACRO     │    │      EMO      │    │    TEKNO      │
│  SPECIALIST   │    │  SPECIALIST   │    │  SPECIALIST   │
│   (Claude)    │    │    (Grok)     │    │   (OpenAI)    │
│               │    │               │    │               │
│ Macroeconomic │    │   Sentiment   │    │   Technical   │
│   Analysis    │    │   Analysis    │    │   Analysis    │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Specialist Agents

| Agent | AI Model | Data Sources | Purpose |
|-------|----------|--------------|---------|
| **MACRO** | Claude (Anthropic) | VIX, DXY, Treasury yields, SPX, Fed rates | Macroeconomic analysis |
| **EMO** | Grok (xAI) | Reddit, Fear & Greed, Polymarket, whale activity | Social/market sentiment |
| **TEKNO** | OpenAI | OHLC candles, RSI, MACD, Bollinger Bands | Technical chart analysis |
| **RL80** | Claude (Anthropic) | All specialist scores | Final trading decisions |

### Agent Workflow (Hourly)

The agents run sequentially every hour, triggered by Firebase Cloud Functions:

```
Every Hour (0 * * * *)
        │
        ▼
┌───────────────┐     30s     ┌───────────────┐     30s     ┌───────────────┐     30s     ┌───────────────┐
│      EMO      │ ──────────► │    TEKNO      │ ──────────► │     MACRO     │ ──────────► │     RL80      │
│  (Sentiment)  │             │  (Technical)  │             │    (Macro)    │             │  (Decision)   │
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
| Market Prices (BTC/ETH) | 60 seconds | `marketData/latest` | CoinGecko |
| Agent Context (Fear & Greed) | 120 seconds | `agentContext/market` | Alternative.me |
| Lighter Trading Data | 20 minutes | `lighterData/*` | Lighter DEX API |
| Sentiment Data | 30 minutes | `sentimentData/latest` | Reddit, Polymarket, Binance |
| Technical OHLC Data | 60 seconds | `technicalData/latest` | CoinGecko |
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
│  CoinGecko ──────► Market Data      ──► every 60s  ──► marketData/latest   │
│  Alternative.me ─► Agent Context    ──► every 120s ──► agentContext/market │
│  Lighter DEX ────► Trading Data     ──► every 20m  ──► lighterData/*       │
│  Reddit/Binance ─► Sentiment Data   ──► every 30m  ──► sentimentData/latest│
│  CoinGecko ──────► Technical OHLC   ──► every 60s  ──► technicalData/latest│
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
| `marketData` | `latest` | BTC/ETH prices, 24h changes | Railway (60s) |
| `agentContext` | `market` | Fear & Greed, funding rate, VIX, trend | Railway (120s) |
| `sentimentData` | `latest` | Trending topics, Polymarket, whale activity | Railway (30m) |
| `technicalData` | `latest` | OHLC candles, RSI, MACD, Bollinger Bands | Railway (60s) |
| `lighterData` | `account` | Lighter account balance | Railway (20m) |
| `lighterData` | `trading` | Positions and orders | Railway (20m) |
| `agentChat` | (auto-id) | Agent chat messages | Firebase Functions (hourly) |
| `agentDecisions` | `RL80` | Latest RL80 trading decision | RL80 Agent |
| `tradeHistory` | (auto-id) | All trade execution logs | Railway |
| `scoringRuns` | (auto-id) | Scoring workflow logs | Firebase Functions (hourly) |
| `serviceStatus` | `lighterService` | Railway service health | Railway (5m) |

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
├── agent/                     # DEPRECATED - Python agent (delete this)
│   └── agent.py              # Was duplicate of Railway trade execution
├── src/
│   ├── app/                   # Next.js app directory
│   │   └── api/               # API routes
│   │       ├── ai/            # AI agent endpoints (macro, whale-activity)
│   │       ├── cron/          # Cron endpoints (run-scoring, update-sentiment)
│   │       ├── agent-chat-service/  # Agent chat API
│   │       └── market-data/   # Market data endpoints
│   ├── components/            # React components
│   │   ├── SentimentScreen.jsx    # EMO agent display
│   │   ├── MacroAgentScreen.jsx   # MACRO agent display
│   │   ├── TeknoScreen.jsx        # TEKNO agent display
│   │   └── RL80Screen.jsx         # RL80 agent display
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
│  │  MARKET DATA:                                                        │   │
│  │  ├─ CoinGecko API ────────────────── every 60s                      │   │
│  │  │  └─ /api/v3/simple/price (BTC, ETH prices)                       │   │
│  │  │  └─ /api/v3/coins/{id}/ohlc (OHLC candles)                       │   │
│  │  │                                                                   │   │
│  │  SENTIMENT DATA:                                                     │   │
│  │  ├─ Alternative.me ───────────────── every 120s                     │   │
│  │  │  └─ /fng/ (Fear & Greed Index)                                   │   │
│  │  │                                                                   │   │
│  │  ├─ Reddit API ───────────────────── every 30min                    │   │
│  │  │  └─ /r/bitcoin/hot.json                                          │   │
│  │  │  └─ /r/ethereum/hot.json                                         │   │
│  │  │  └─ /r/cryptocurrency/hot.json                                   │   │
│  │  │                                                                   │   │
│  │  ├─ Polymarket API ───────────────── every 30min                    │   │
│  │  │  └─ /markets (crypto prediction markets)                         │   │
│  │  │                                                                   │   │
│  │  ├─ Binance Futures API ──────────── every 30min                    │   │
│  │  │  └─ /fapi/v1/trades (whale activity detection)                   │   │
│  │  │                                                                   │   │
│  │  ├─ Google Trends ────────────────── every 30min                    │   │
│  │  │  └─ interestOverTime (Bitcoin search interest)                   │   │
│  │  │                                                                   │   │
│  │  ├─ App Store Scraper ────────────── every 30min                    │   │
│  │  │  └─ Coinbase, Binance, MetaMask ratings                          │   │
│  │  │                                                                   │   │
│  │  LIGHTER DEX:                                                        │   │
│  │  ├─ Lighter Testnet API ──────────── every 20min + on trade         │   │
│  │  │  └─ /api/v1/account (balance, positions)                         │   │
│  │  │  └─ /api/v1/transaction/send_tx (order execution)                │   │
│  │  │                                                                   │   │
│  │  MACRO DATA:                                                         │   │
│  │  └─ Yahoo Finance ────────────────── every 120s                     │   │
│  │     └─ ^TNX (Treasury yields)                                        │   │
│  │     └─ ^VIX (Volatility index)                                       │   │
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
| **Railway** | CoinGecko | `/api/v3/simple/price` | 60s | BTC/ETH prices | No |
| **Railway** | CoinGecko | `/api/v3/coins/{id}/ohlc` | 60s | OHLC candles | No |
| **Railway** | Alternative.me | `/fng/` | 120s | Fear & Greed Index | No |
| **Railway** | Reddit | `/r/{sub}/hot.json` | 30min | Trending posts | No |
| **Railway** | Polymarket | `/markets` | 30min | Prediction markets | No |
| **Railway** | Binance Futures | `/fapi/v1/trades` | 30min | Whale detection | No |
| **Railway** | Google Trends | `interestOverTime` | 30min | Search interest | No |
| **Railway** | App Store | Scraper | 30min | App ratings | No |
| **Railway** | Yahoo Finance | `^TNX`, `^VIX` | 120s | Treasury, VIX | No |
| **Railway** | Lighter DEX | `/api/v1/account` | 20min | Account data | Yes |
| **Railway** | Lighter DEX | `/api/v1/transaction/send_tx` | On trade | Order execution | Yes |
| **Firebase** | Next.js App | `/api/cron/run-scoring` | Hourly | Trigger agents | Yes (CRON_SECRET) |
| **Next.js** | Anthropic | Messages API | Hourly ×2 | MACRO, RL80 | Yes |
| **Next.js** | xAI (Grok) | Messages API | Hourly ×1 | EMO | Yes |
| **Next.js** | OpenAI | Chat Completions | Hourly ×1 | TEKNO | Yes |

### Daily API Call Estimates

| API | Calls/Hour | Calls/Day | Rate Limit | Notes |
|-----|------------|-----------|------------|-------|
| CoinGecko (prices) | 60 | 1,440 | 10-50/min (free) | May need Pro for reliability |
| CoinGecko (OHLC) | 60 | 1,440 | Combined with above | |
| Alternative.me | 30 | 720 | Generous | Very stable |
| Reddit | 6 | 144 | 60/min | No auth needed |
| Polymarket | 2 | 48 | Unknown | Monitor for limits |
| Binance Futures | 2 | 48 | 1200/min | Very generous |
| Google Trends | 2 | 48 | ~100/day | May need rotation |
| Yahoo Finance | 30 | 720 | Generous | Very stable |
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

# Trading (Required for trade execution)
LIGHTER_API_KEY=...                # 80-char Lighter API key
LIGHTER_WALLET_PRIVATE_KEY=...     # 64-char wallet key

# Internal Security
CRON_SECRET=...                    # Firebase → Next.js auth
```

### Free APIs (No Key Required)

- CoinGecko (rate-limited)
- Alternative.me Fear & Greed
- Reddit (public endpoints)
- Polymarket (public endpoints)
- Binance Futures (public endpoints)
- Google Trends (via library)
- Yahoo Finance (via library)
- App Store/Play Store (via scrapers)
