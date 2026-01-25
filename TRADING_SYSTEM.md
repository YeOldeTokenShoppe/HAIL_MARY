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

The trading system is powered by four coordinated services that work together:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌────────────────┐  │
│  │  RAILWAY: RL80      │    │  RAILWAY: LIGHTER   │    │   NEXT.JS APP  │  │
│  │  (ElizaOS Agent)    │    │  (Background Svc)   │    │   (Frontend)   │  │
│  └──────────┬──────────┘    └──────────┬──────────┘    └───────┬────────┘  │
│             │                          │                       │            │
│             │ posts decisions          │ executes trades       │ reads data │
│             │ chat interface           │ collects data         │            │
│             ▼                          ▼                       ▼            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FIREBASE FIRESTORE                           │   │
│  │                      (Central Data Store)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         LIGHTER DEX (Testnet)                        │   │
│  │              ETH-PERP (index 0) | BTC-PERP (index 1)                 │   │
│  │                   (Trade Execution via zklighter-sdk)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Location | Role | Agent Triggers | Trade Execution |
|---------|----------|------|----------------|-----------------|
| **RL80 ElizaOS Agent** | `eliza/rl80-agent/` (Railway) | Chat interface, trading decisions, oracle synthesis | **Yes** (chat-driven) | No (posts to Firestore) |
| **Lighter Background Service** | `services/lighter-background-service-standalone.js` (Railway) | Data collection, decision listening, trade execution | No | **Yes** (via zklighter-sdk) |
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
│                 RL80 - LEAD TRADER (ElizaOS)                    │
│          "Our Lady of Perpetual Profit"                         │
│      Synthesizes oracle analysis into trading decisions         │
│   Posts to agentDecisions/RL80 → Railway executes via SDK       │
│                                                                 │
│   🌐 Chat Interface: https://rl80-agent-production.up.railway.app │
│   📦 Framework: ElizaOS with custom Firestore plugin            │
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

| Agent | Role | AI Model | Framework | Personality | Purpose |
|-------|------|----------|-----------|-------------|---------|
| **MACRO** | First Wise Oracle | Claude | Next.js API | "The Grumpy Professor" | Macroeconomic regime analysis (WHEN) |
| **EMO** | Second Wise Oracle | Grok | Next.js API | "The Chaos Surfer" | Sentiment & crowd psychology (WHERE) |
| **TEKNO** | Third Wise Oracle | OpenAI | Next.js API | "Street Smart Pattern Nerd" | Technical price structure (WHAT) |
| **RL80** | Lead Trader | Claude | **ElizaOS** | "Trade Life" | Synthesizes oracle inputs, executes trades |

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
| Agent Context (Fear & Greed) | 120 seconds | `agentContext/market` | CoinMarketCap (primary), Alternative.me (fallback) |
| Lighter Trading Data | 20 minutes | `lighterData/*` | Lighter DEX API |
| Sentiment Data | 6 hours | `sentimentData/latest` | Reddit, Polymarket, CryptoPanic RSS |
| Macro Data (VIX, DXY, SPY, Treasury) | 4 hours | `macroData/latest` | FRED, Alpha Vantage |
| Service Health | 5 minutes | `serviceStatus/lighterService` | Internal |

#### Trade Execution (Real-time)

The Railway background service listens to `agentDecisions/RL80` in Firestore using `onSnapshot`. When RL80 posts a new decision:

1. **Validates the decision:**
   - Confidence meets minimum threshold (default: 60%)
   - Symbol is supported on testnet (**BTC or ETH only** - SOL/XRP not available)
   - Daily trade limit not reached
   - Daily loss limit not exceeded
   - Cooldown period elapsed (default: 5 minutes)

2. **Executes on Lighter DEX via zklighter-sdk:**
   - Fetches current price from Firebase cache or CoinGecko
   - Calculates position size based on confidence
   - Fetches nonce from Lighter API (`/api/v1/nextNonce`)
   - Creates **LIMIT order** (not market order) with 0.5% slippage buffer
   - Signs transaction with **API Key Private Key** (80 hex chars)
   - Submits order via `SignerClient.create_order()`

3. **Logs the result:**
   - Records trade in `trades` collection (for PerformanceDashboard)
   - Updates daily statistics

**Why Limit Orders?** Market orders on testnet can fill at extreme prices due to thin liquidity (e.g., $200,000 BTC). Limit orders with small slippage ensure reasonable execution prices.

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
│  CoinMarketCap ──► Fear & Greed     ──► every 120s ──► agentContext/market │
│   (Alt.me fallback)                                                         │
│  Lighter DEX ────► Trading Data     ──► every 20m  ──► lighterData/*       │
│  Reddit/Polymarket► Sentiment Data  ──► every 6hr  ──► sentimentData/latest│
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
| `agentDecisions` | `RL80` | Latest RL80 trading decision | RL80 ElizaOS Agent |
| `trades` | (auto-id) | Trade execution logs (for PerformanceDashboard) | Railway Background Service |
| `scoringRuns` | (auto-id) | Scoring workflow logs | Firebase Functions (hourly) |
| `serviceStatus` | `lighterService` | Railway service health | Railway (5m) |
| `decisions` | (auto-id) | Full decision logs with analyst scores | Scoring Workflow |
| `agentScores` | (auto-id) | Individual analyst score outputs | Scoring Workflow |
| `predictionMarkets` | (market-id) | Prediction market metadata | Admin |
| `predictionBets` | (auto-id) | User prediction bets | Users |
| `predictionPayouts` | (auto-id) | Payout records | Service |
| `oracleAccuracyLogs` | (auto-id) | Oracle directional call logs | Scoring Workflow |
| `oracleAccuracyStats` | (oracle-id) | Aggregated oracle accuracy | Scoring Workflow |

---

## Railway Data Fetch Schedule

The Railway background service fetches data from external APIs at varying intervals. All APIs used are **free** (some require free API keys).

| Data Type | Interval | APIs Used | Notes |
|-----------|----------|-----------|-------|
| Market prices + Technical data | 5 min | CoinGecko `/coins/markets` | Single batched call with 7-day sparkline |
| Agent context (F&G) | 120s | CoinMarketCap (primary), Alternative.me (fallback) | Fear & Greed index with real-time updates |
| Lighter trading data | 20 min | Lighter DEX | Account balance, positions, orders |
| Sentiment data | 6 hr | Reddit, Polymarket, CryptoPanic RSS | 4× daily social/news updates |
| Macro data | 4 hr | FRED, Alpha Vantage | VIX, DXY, SPY, 10Y Treasury |
| Service health | 5 min | Internal | Status heartbeat |

**Rate Limiting:** API calls use a built-in `RateLimiter` class (8s minimum between calls) to avoid hitting free tier limits. Market data is batched into a single call per interval.

**CryptoPanic Conservation:** To conserve API quota, CryptoPanic uses RSS feeds instead of the API. Set `CRYPTOPANIC_DISABLED=true` to completely disable CryptoPanic calls if needed.

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

### Railway Environment Variables (Background Service)

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

# Lighter DEX (zklighter-sdk)
LIGHTER_API_KEY_PRIVATE_KEY=  # 80-character API Key Private Key (NOT wallet key!)
LIGHTER_ACCOUNT_INDEX=227     # Your Lighter account index
LIGHTER_API_KEY_INDEX=222     # Your API key index (from Lighter settings)

# Trading Configuration (IMPORTANT!)
TRADING_ENABLED=false         # Set to 'true' to enable real trading
MAX_POSITION_SIZE_USD=100     # Max USD per trade
MAX_DAILY_TRADES=10           # Max trades per day
MAX_DAILY_LOSS_USD=50         # Stop if daily loss exceeds
MIN_TRADE_CONFIDENCE=0.6      # Minimum confidence (60%)
TRADE_COOLDOWN_MS=300000      # 5 minutes between trades
```

### Railway Environment Variables (RL80 ElizaOS Agent)

```env
# Firebase (full JSON or individual vars)
GOOGLE_APPLICATION_CREDENTIALS_JSON=  # Full service account JSON (recommended)
# Or use individual vars:
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# AI Model Provider
ANTHROPIC_API_KEY=            # For Claude model

# Optional: Communication channels
DISCORD_API_TOKEN=            # If using Discord plugin
TELEGRAM_BOT_TOKEN=           # If using Telegram plugin
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

## RL80 ElizaOS Agent

RL80 "Our Lady of Perpetual Profit" is now deployed as an ElizaOS agent on Railway, providing a chat interface for trading commands.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RL80 ELIZAOS ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Chat                                                                  │
│      │                                                                      │
│      ▼                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  ElizaOS Runtime (Railway)                                             │ │
│  │  https://rl80-agent-production.up.railway.app                          │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │ │
│  │  │  character.ts   │  │ firestore-plugin │  │  @elizaos/plugins   │   │ │
│  │  │  - Personality  │  │  - Market data   │  │  - anthropic        │   │ │
│  │  │  - System prompt│  │  - Oracle scores │  │  - bootstrap        │   │ │
│  │  │  - Style rules  │  │  - Post decisions│  │  - sql              │   │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    │ Posts decision to                      │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Firebase Firestore: agentDecisions/RL80                              │ │
│  │  { action: "BUY", symbol: "ETH", confidence: 0.75, reasoning: "..." } │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    │ onSnapshot listener                    │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Lighter Background Service (Railway)                                  │ │
│  │  - Validates decision                                                  │ │
│  │  - Creates LIMIT order via zklighter-sdk                              │ │
│  │  - Logs to trades collection                                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Lighter DEX Testnet                                                   │ │
│  │  ETH-PERP (market 0) | BTC-PERP (market 1)                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Chat Interface** | Web-based chat at Railway URL for trading commands |
| **Market Data Provider** | Injects live prices, sentiment, technicals into context |
| **Oracle Scores Provider** | Fetches EMO/TEKNO/MACRO scores from Firestore |
| **MAKE_TRADE Action** | Posts trading decisions to Firestore for execution |
| **EMERGENCY_STOP Action** | Halts all trading immediately |

### Trading Commands (via Chat)

Users can instruct RL80 to trade:
- "Go long on ETH" → Posts BUY ETH decision
- "Close the BTC position" → Posts SELL BTC decision
- "What do the oracles say?" → Returns current oracle scores
- "Emergency stop" → Halts all trading

### Files

| File | Purpose |
|------|---------|
| `eliza/rl80-agent/src/character.ts` | RL80 personality, plugins, system prompt |
| `eliza/rl80-agent/src/firestore-plugin.ts` | Custom Firestore service + trading actions |
| `eliza/rl80-agent/src/index.ts` | Entry point |
| `eliza/rl80-agent/CLAUDE.md` | ElizaOS development guide |

### Deployment

```bash
cd eliza/rl80-agent
bun install
# Deploy to Railway via GitHub integration
```

Railway auto-deploys from the `main` branch when changes are pushed.

---

## Tech Stack

- **Frontend**: Next.js 14, React Three Fiber, Three.js, Tailwind CSS, Framer Motion
- **Backend**: Firebase Firestore, Firebase Cloud Functions, Railway (x2 services)
- **AI Models**: Claude (Anthropic), Grok (xAI), OpenAI
- **Agent Framework**: ElizaOS (for RL80)
- **Trading**: Lighter DEX (testnet) via zklighter-sdk
- **Auth**: Clerk

---

## Project Structure

```
HAIL_MARY/
├── public/                    # Static assets
├── eliza/                     # ElizaOS Agent Projects
│   └── rl80-agent/           # RL80 Lead Trader (Railway deployed)
│       ├── src/
│       │   ├── character.ts       # RL80 personality & plugins
│       │   ├── firestore-plugin.ts # Custom Firestore integration
│       │   └── index.ts           # Entry point
│       ├── package.json           # ElizaOS dependencies
│       └── CLAUDE.md              # Development guide
├── functions/                 # Firebase Cloud Functions
│   └── index.js              # Scheduled agent triggering (hourly)
├── services/                  # Railway background service
│   ├── lighter-background-service-standalone.js  # Data collection + trade execution
│   └── package.json          # Includes zklighter-sdk
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

Upload YouTube transcripts via the admin interface at `/admin` to keep agent knowledge current with the latest market analysis.

#### Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEEKLY ANALYSIS KNOWLEDGE FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. UPLOAD (Admin Page)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  /admin → WeeklyAnalysisUploader.jsx                                │   │
│  │  User pastes YouTube transcript with title, channel, date           │   │
│  │  POST /api/weekly-analysis                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  2. PROCESSING (weeklyAnalysisSystem.js)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  processWeeklyAnalysis() extracts domain-specific insights:         │   │
│  │                                                                      │   │
│  │  extractSentimentInsights() ──► EMO insights                        │   │
│  │    - fear/greed mentions, retail behavior, whale activity           │   │
│  │                                                                      │   │
│  │  extractTechnicalInsights() ──► TEKNO insights                      │   │
│  │    - support/resistance levels, RSI/MACD mentions, patterns         │   │
│  │                                                                      │   │
│  │  extractMacroInsights() ──────► MACRO insights                      │   │
│  │    - Fed policy, inflation, DXY, recession/growth mentions          │   │
│  │                                                                      │   │
│  │  extractTradingInsights() ────► RL80 insights                       │   │
│  │    - position sizing, risk management, entry/exit strategies        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  3. STORAGE (Firebase)                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Collection: weeklyAnalysis                                         │   │
│  │  Documents: One per agent (EMO, TEKNO, MACRO, RL80)                 │   │
│  │  Fields: agent, source, timestamp, insights[], keyQuotes[]          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  4. RETRIEVAL (During Agent Runs - Hourly)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  enhancedPromptBuilder.js: buildEnhancedPrompt()                    │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  buildKnowledgeSection(agentName, marketData, includeWeeklyAnalysis)│   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  getRecentAnalysisForAgent(agentName, 7) // last 7 days             │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │  Adds "## RECENT WEEKLY ANALYSIS" section to agent's system prompt  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### How to Upload

1. **Navigate to Admin Page**: Visit `/admin` and authenticate with admin password
2. **Upload Tab**: Use the transcript uploader to submit weekly market analysis
3. **Fill in Details**: Title, channel/source, publish date, and full transcript
4. **Submit**: Click "Upload & Process" to extract insights

#### What Gets Extracted

| Agent | Extracted Insights | Pattern Examples |
|-------|-------------------|------------------|
| **EMO** | Sentiment indicators, crowd psychology | "fear greed", "retail panic", "whale accumulation", "funding rates" |
| **TEKNO** | Price levels, technical patterns | "support $95,000", "resistance", "RSI", "MACD", "breakout" |
| **MACRO** | Economic policy, global trends | "Fed", "inflation", "CPI", "DXY", "rate cuts", "recession" |
| **RL80** | Trading strategies, risk management | "position size", "stop loss", "risk management", "entry/exit" |

#### Agent Knowledge Sources

Each agent uses TWO types of knowledge:

1. **Static JSON Knowledge** (foundational, rarely changes):
   - `src/trading/agents/configs/knowledge/emo-knowledge.json`
   - `src/trading/agents/configs/knowledge/tekno-knowledge.json`
   - `src/trading/agents/configs/knowledge/macro-knowledge.json`
   - `src/trading/agents/configs/knowledge/rl80-knowledge.json`

2. **Dynamic Weekly Analysis** (current, uploaded via admin):
   - Firebase `weeklyAnalysis` collection
   - Automatically included in prompts (last 7 days)
   - Refreshed each time you upload new transcripts

#### Key Files

| File | Purpose |
|------|---------|
| `src/app/admin/page.js` | Admin interface with upload tab |
| `src/components/WeeklyAnalysisUploader.jsx` | Upload form component |
| `src/app/api/weekly-analysis/route.js` | API endpoint for processing |
| `src/trading/agents/configs/knowledge/weeklyAnalysisSystem.js` | Extraction and storage logic |
| `src/trading/agents/configs/enhancedPromptBuilder.js` | Includes weekly analysis in prompts |

#### Verifying Integration

To check if weekly analysis is being used:

```bash
# Check recent analysis for an agent
curl "http://localhost:3000/api/weekly-analysis?agent=EMO&days=7"
```

The response shows how many insights are available for that agent from recent uploads.

### Adding Static Knowledge

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
1. Check `TRADING_ENABLED=true` in Railway background service environment
2. Check Railway logs for validation errors
3. Verify `LIGHTER_API_KEY_PRIVATE_KEY` is 80 characters (NOT wallet private key)
4. Verify `LIGHTER_ACCOUNT_INDEX` and `LIGHTER_API_KEY_INDEX` match your Lighter account
5. Check `trades` collection for rejected/failed trades
6. Ensure RL80 confidence meets minimum threshold (default 60%)
7. Ensure symbol is supported (only ETH and BTC on testnet)

### RL80 ElizaOS not responding
1. Check Railway logs for the rl80-agent service
2. Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` or Firebase env vars are set
3. Verify `ANTHROPIC_API_KEY` is configured
4. Check Firestore connection: logs should show "Firestore connection verified"
5. Try the health endpoint: `https://rl80-agent-production.up.railway.app/health`

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
| **Supported Markets** | ETH, BTC | Only these perpetuals available on Lighter testnet |
| **Limit Orders Only** | 0.5% slippage | Prevents bad fills on illiquid testnet orderbook |
| **24h Order Expiry** | Auto-cancel | Unfilled limit orders expire automatically |
| **Emergency Stop** | Manual | RL80 can halt all trading via chat command |

All trades are logged to `trades` collection for PerformanceDashboard and audit purposes.

---

## Prediction Market

The trading system includes a prediction market where users can bet RL80 tokens on which oracle (EMO, TEKNO, MACRO) will be most accurate over a week.

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PREDICTION MARKET FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. MARKET CREATION (Admin)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  npm run create-market                                               │   │
│  │  Creates on-chain market: "Most accurate oracle this week?"          │   │
│  │  Options: EMO, TEKNO, MACRO                                          │   │
│  │  Duration: 7 days                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  2. USERS PLACE BETS                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  User approves RL80 tokens → Buys shares on chosen oracle            │   │
│  │  Shares represent proportional claim on the losing pools             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  3. ORACLE ACCURACY TRACKING (Automatic)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Each hour: Log oracle directional calls                             │   │
│  │  24 hours later: Compare to actual price movement                    │   │
│  │  Aggregate weekly stats per oracle                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  4. MARKET RESOLUTION (Admin at week end)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Admin resolves market with winning oracle (highest accuracy)        │   │
│  │  Winners claim: original stake + share of losing pools               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Smart Contract

| Property | Value |
|----------|-------|
| **Network** | Base Sepolia Testnet (Chain ID: 84532) |
| **Contract Address** | `0x3e34244D9F9c6CD1Ad970Cf02247d74e5451818c` |
| **Betting Token** | RL80 (`0x3841c83409714e0BA0eA33444a0D4354Da19A084`) |
| **Market Type** | Parimutuel (winners split loser pools) |

### How Parimutuel Betting Works

The prediction market uses **parimutuel betting** (also called "pool betting"), which differs from traditional fixed-odds betting:

| Aspect | Fixed-Odds Betting | Parimutuel (This System) |
|--------|-------------------|--------------------------|
| **Odds** | Set when you bet | Change as more bets come in |
| **Payout** | Known at bet time | Only known after betting closes |
| **House edge** | Bookmaker sets odds | Can be zero (pure pool split) |
| **Risk to house** | House can lose | House never loses (just facilitates) |

**Why parimutuel works well here:**
- No need to set odds manually (the market determines them)
- No house risk (the contract just facilitates the pool)
- Underdogs naturally have higher payouts
- Simple, fair, transparent on-chain math

It's the same system used by horse racing tracks, lottery games, and prediction markets like Polymarket.

**How the math works:**

```
Example: Market with 3 options (EMO, TEKNO, MACRO)

Pool Distribution:
  EMO:    1000 RL80 (25%)
  TEKNO:  2000 RL80 (50%)
  MACRO:  1000 RL80 (25%)
  TOTAL:  4000 RL80

If EMO wins:
  - EMO bettors split: 1000 (their pool) + 3000 (losing pools) = 4000 RL80
  - A user with 100 RL80 in EMO (10% of EMO pool) receives:
    100 + (10% × 3000) = 100 + 300 = 400 RL80 (4x return)

If TEKNO wins:
  - TEKNO bettors split: 2000 + 2000 = 4000 RL80
  - A user with 100 RL80 in TEKNO (5% of TEKNO pool) receives:
    100 + (5% × 2000) = 100 + 100 = 200 RL80 (2x return)
```

**Key insight:** Betting on underdogs yields higher returns if they win.

### Contract Functions

#### Read Functions (via `predictionMarketFunctions`)

| Function | Description |
|----------|-------------|
| `getMarketInfo(marketId)` | Returns question, endTime, winningOption, optionCount, resolved |
| `getAllOptions(marketId)` | Returns array of option names |
| `getAllOptionShares(marketId)` | Returns array of pool sizes (wei) |
| `getAllUserShares(marketId, userAddress)` | Returns user's shares per option |
| `calculatePotentialWinnings(marketId, user, assumedWinner)` | Calculates payout if option wins |
| `getMarketCount()` | Returns total number of markets |
| `hasUserClaimed(marketId, user)` | Check if user claimed winnings |

#### Write Functions

| Function | Description | Access |
|----------|-------------|--------|
| `buyShares(marketId, optionId, amount)` | Buy shares on an option | Anyone |
| `claimWinnings(marketId)` | Claim winnings after resolution | Winners |
| `claimRefund(marketId)` | Claim refund if market cancelled | Anyone |
| `createMarket(question, options, duration)` | Create new market | Owner only |
| `resolveMarket(marketId, winningOption)` | Resolve with winner | Owner only |
| `cancelMarket(marketId)` | Cancel and enable refunds | Owner only |

### Creating a Market

Use the provided script:

```bash
# 1. Add private key to .env
OWNER_PRIVATE_KEY=your_deployer_wallet_private_key

# 2. (Optional) Edit market config in scripts/createMarket.js
const MARKET_CONFIG = {
  question: "Most accurate oracle this week?",
  options: ["EMO", "TEKNO", "MACRO"],
  durationDays: 7
};

# 3. Run the script
npm run create-market
```

The script outputs the market ID (starts at 0 for first market).

### Oracle Accuracy Tracking

The system automatically tracks oracle accuracy:

1. **Logging calls** (`oracleAccuracyService.js`):
   - After each scoring run, logs each oracle's directional call (LONG/SHORT/NEUTRAL)
   - Records the BTC price at time of call
   - Sets verification time to 24 hours later

2. **Verifying calls**:
   - Compares actual price movement to predicted direction
   - Marks call as correct/incorrect
   - Updates running accuracy stats

3. **Weekly aggregation**:
   - Calculates accuracy percentage per oracle
   - Used to resolve weekly prediction markets

### Firebase Collections

| Collection | Purpose | Updated By |
|------------|---------|------------|
| `predictionMarkets` | Market metadata (synced from chain) | Admin/Service |
| `predictionBets` | User bet records | Users (on bet) |
| `predictionPayouts` | Payout records | Service (on claim) |
| `oracleAccuracyLogs` | Individual oracle call logs | Scoring workflow |
| `oracleAccuracyStats` | Aggregated accuracy stats | Scoring workflow |

### UI Components

**Location:** `src/trading/components/overlays/PredictionMarketOverlay.jsx`

Features:
- Market cards showing pool distribution
- Live on-chain data via `useReadContract`
- Two-step betting: Approve RL80 → Buy shares
- User position display with potential winnings
- Claim winnings button for resolved markets

### Linking Firebase to On-Chain

When loading markets from Firebase, include the `onChainId` to enable live data:

```javascript
const market = {
  id: 'weekly-oracle-market',
  onChainId: 0,  // <-- Links to contract market ID
  question: "Most accurate oracle this week?",
  options: [
    { id: 'EMO', name: 'EMO', color: '#ff8800' },
    { id: 'TEKNO', name: 'TEKNO', color: '#aa44ff' },
    { id: 'MACRO', name: 'MACRO', color: '#00c8ff' }
  ],
  endTime: new Date('2026-01-27'),
  // ...
};
```

When `onChainId` is present, the UI:
- Fetches live pool sizes from the contract
- Shows "LIVE ON-CHAIN" indicator
- Displays user's shares and potential winnings

### Environment Variables

```env
# Required for market creation
OWNER_PRIVATE_KEY=...              # Wallet that deployed the contract

# Already configured (from Thirdweb setup)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=... # Thirdweb client ID
```

### Resolving a Market

At the end of the week, the admin resolves the market:

1. Check oracle accuracy stats in Firebase (`oracleAccuracyStats`)
2. Determine winning oracle (highest accuracy)
3. Call `resolveMarket(marketId, winningOptionIndex)`:
   - EMO = 0, TEKNO = 1, MACRO = 2

This can be done via Thirdweb dashboard or a resolution script.

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
│  │  FEAR & GREED DATA:                                                  │   │
│  │  ├─ CoinMarketCap API ────────────── every 120s (primary)           │   │
│  │  │  └─ /v3/fear-and-greed/latest (Fear & Greed Index)               │   │
│  │  │                                                                   │   │
│  │  ├─ Alternative.me ───────────────── every 120s (fallback)          │   │
│  │  │  └─ /fng/ (Fear & Greed Index)                                   │   │
│  │  │                                                                   │   │
│  │  SENTIMENT DATA:                                                     │   │
│  │  ├─ Reddit API ───────────────────── every 6hr                      │   │
│  │  │  └─ /r/bitcoin/hot.json                                          │   │
│  │  │  └─ /r/ethereum/hot.json                                         │   │
│  │  │  └─ /r/cryptocurrency/hot.json                                   │   │
│  │  │                                                                   │   │
│  │  ├─ Polymarket API ───────────────── every 6hr                      │   │
│  │  │  └─ /markets (crypto/finance prediction markets only)            │   │
│  │  │                                                                   │   │
│  │  ├─ CryptoPanic RSS ──────────────── every 6hr                      │   │
│  │  │  └─ /news/rss/ (crypto news headlines - no API quota used)       │   │
│  │  │                                                                   │   │
│  │  ├─ Google Trends ────────────────── every 6hr                      │   │
│  │  │  └─ interestOverTime (Bitcoin search interest)                   │   │
│  │  │                                                                   │   │
│  │  LIGHTER DEX:                                                        │   │
│  │  ├─ Lighter Testnet API ──────────── every 20min + on trade         │   │
│  │  │  └─ /api/v1/account (balance, positions, P&L)                    │   │
│  │  │  └─ /api/v1/nextNonce (nonce for signing)                        │   │
│  │  │  └─ zklighter-sdk SignerClient.create_order() (LIMIT orders)     │   │
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
| **Railway** | CoinMarketCap | `/v3/fear-and-greed/latest` | 120s | Fear & Greed Index (primary) | Yes (free) |
| **Railway** | Alternative.me | `/fng/` | 120s | Fear & Greed Index (fallback) | No |
| **Railway** | FRED | `/series/observations` | 4hr | VIX, DXY, 10Y Treasury | Yes (free) |
| **Railway** | Alpha Vantage | `/query?function=GLOBAL_QUOTE` | 4hr | SPY stock price | Yes (free) |
| **Railway** | Reddit | `/r/{sub}/hot.json` | 6hr | Trending posts | No |
| **Railway** | Polymarket | `/markets` | 6hr | Crypto/finance prediction markets | No |
| **Railway** | CryptoPanic | RSS feed (`/news/rss/`) | 6hr | Crypto news headlines (no API quota) | No |
| **Railway** | Google Trends | `interestOverTime` | 6hr | Search interest | No |
| **Railway** | Lighter DEX | `/api/v1/account` | 20min | Account data, positions, P&L | Optional |
| **Railway** | Lighter DEX | `/api/v1/nextNonce` | On trade | Nonce for signing | Yes |
| **Railway** | Lighter DEX | `zklighter-sdk` | On trade | LIMIT order execution | Yes (API Key Private Key) |
| **Firebase** | Next.js App | `/api/cron/run-scoring` | Hourly | Trigger agents | Yes (CRON_SECRET) |
| **Next.js** | Anthropic | Messages API | Hourly ×2 | MACRO, RL80 | Yes |
| **Next.js** | xAI (Grok) | Messages API | Hourly ×1 | EMO | Yes |
| **Next.js** | OpenAI | Chat Completions | Hourly ×1 | TEKNO | Yes |

### Daily API Call Estimates

| API | Calls/Hour | Calls/Day | Rate Limit | Notes |
|-----|------------|-----------|------------|-------|
| CoinGecko (batched) | 12 | 288 | 10-50/min (free) | Single call every 5 min |
| CoinMarketCap | 30 | 720 | 10,000/month (free) | Primary F&G source, ~2% of quota |
| Alternative.me | 30 | 720 | Generous | Fallback F&G source |
| FRED | 0.25 | 6 | 120/min | Very generous (free with key) |
| Alpha Vantage | 0.25 | 6 | 25/day (free) | Well within limits |
| Reddit | 0.17 | 4 | 60/min | 4× daily (every 6hr) |
| Polymarket | 0.17 | 4 | Unknown | 4× daily (every 6hr) |
| CryptoPanic RSS | 0.17 | 4 | Unlimited | RSS feed - no API quota used |
| Google Trends | 0.17 | 4 | ~100/day | 4× daily (every 6hr) |
| Lighter DEX | 3 + trades | ~72 + trades | Unknown | Testnet is lenient |
| **Anthropic** | 2 | 48 | Tier-based | ~$0.60/day |
| **xAI (Grok)** | 1 | 24 | Tier-based | ~$0.50/day |
| **OpenAI** | 1 | 24 | Tier-based | ~$0.30/day |

### API Keys Required

```env
# AI Models (Required for agent analysis)
ANTHROPIC_API_KEY=sk-ant-...      # Claude for MACRO + RL80 (ElizaOS)
OPENAI_API_KEY=sk-...              # GPT for TEKNO
GROK_API_KEY=xai-...               # Grok for EMO

# Market Data APIs (Free tiers)
COINMARKETCAP_API_KEY=...          # CoinMarketCap for Fear & Greed (primary)
FRED_API_KEY=...                   # FRED API for VIX, DXY, Treasury
ALPHAVANTAGE_API_KEY=...           # Alpha Vantage for SPY

# Trading (Required for trade execution via zklighter-sdk)
LIGHTER_API_KEY_PRIVATE_KEY=...    # 80-char API Key Private Key (NOT wallet key!)
LIGHTER_ACCOUNT_INDEX=227          # Your Lighter account index
LIGHTER_API_KEY_INDEX=222          # Your API key index

# Internal Security
CRON_SECRET=...                    # Firebase → Next.js auth

# Optional Feature Flags
CRYPTOPANIC_DISABLED=true          # Set to disable CryptoPanic entirely
```

**Important:** The `LIGHTER_API_KEY_PRIVATE_KEY` is your **API Key Private Key** (80 hex characters) from your Lighter account settings, NOT your wallet private key. This is used by `zklighter-sdk` to sign transactions.

### Free APIs (No Key Required)

- CoinGecko (rate-limited, batched calls)
- Alternative.me Fear & Greed (fallback source)
- Reddit (public endpoints)
- Polymarket (public endpoints, filtered to crypto/finance)
- CryptoPanic RSS (no API quota, unlimited)
- Google Trends (via library)

### Free APIs (Key Required)

- CoinMarketCap (free key from coinmarketcap.com - 10,000 calls/month, primary F&G source)
- FRED API (free key from fred.stlouisfed.org - 120 calls/min)
- Alpha Vantage (free key from alphavantage.co - 25 calls/day)

### API Conservation Notes

**CryptoPanic:** The system uses RSS feeds (`/news/rss/`) instead of the paid API to conserve quota. This provides unlimited news headlines without using API credits. Set `CRYPTOPANIC_DISABLED=true` to completely disable if needed.

**Fear & Greed Index:** CoinMarketCap is the primary source (updates more frequently than Alternative.me). Alternative.me serves as an automatic fallback if CoinMarketCap fails or no API key is configured.

