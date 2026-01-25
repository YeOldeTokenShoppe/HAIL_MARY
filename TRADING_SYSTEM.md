# HAIL_MARY Trading System

A Next.js project featuring an AI-powered perpetual trading system with multiple specialized agents.

## Pages

- `/` - Root page with PalmTreeDrive scene
- `/home` - Main home page with 3D scenes and interactions
- `/trade` - **AI Trading Dashboard** - 4 AI agents with paper trading simulation
- `/fountain` - Fountain visualization page
- `/ethos` - 3D model viewer
- `/tokenomics` - Tokenomics information page

---

## System Architecture Overview

The trading system runs entirely on Next.js with Firebase, using paper trading simulation with live CoinGecko prices.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         NEXT.JS APP                                  │   │
│  │                    (Frontend + API Routes)                           │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │  Frontend    │  │  API Routes  │  │  Paper Trading API       │  │   │
│  │  │  /trade page │  │  /api/cron/* │  │  /api/paper-trade        │  │   │
│  │  │  /home page  │  │  /api/ai/*   │  │  - Open/Close positions  │  │   │
│  │  │  Dashboards  │  │  Agent calls │  │  - Reset account         │  │   │
│  │  └──────────────┘  └──────────────┘  │  - Get status/history    │  │   │
│  │                                       └──────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ reads/writes                           │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FIREBASE FIRESTORE                           │   │
│  │                      (Central Data Store)                            │   │
│  │                                                                      │   │
│  │  Paper Trading: simulatedAccount, simulatedPositions                 │   │
│  │  Agent Data: agentChat, decisions, agentScores                       │   │
│  │  Market Data: marketData, technicalData, sentimentData               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           COINGECKO API                              │   │
│  │                     (Live Crypto Prices)                             │   │
│  │              BTC | ETH | SOL | XRP - Real-time pricing               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Location | Role |
|---------|----------|------|
| **Next.js App** | Vercel/Local | Frontend, API routes, paper trading, agent orchestration |
| **Firebase Functions** | `functions/index.js` | Hourly cron to trigger agent workflow |
| **Firebase Firestore** | Cloud | Central data store for all trading data |
| **CoinGecko API** | External | Live cryptocurrency prices |

---

## Paper Trading System

The system uses **simulated paper trading** with live CoinGecko prices. No real money or DEX integration is used.

### Paper Trading Features

| Feature | Description |
|---------|-------------|
| **Initial Balance** | $10,000 USD |
| **Supported Assets** | BTC, ETH, SOL, XRP |
| **Live Prices** | CoinGecko API (30s cache) |
| **Leverage** | Default 5x (configurable) |
| **Slippage Simulation** | 0-0.2% random slippage |
| **Position Tracking** | Firestore `simulatedPositions` |
| **P&L Calculation** | Real-time unrealized + realized |
| **Trade History** | Firestore `simulatedTradeHistory` |

### Paper Trading API

**Location:** `src/app/api/paper-trade/route.js`

| Method | Action | Description |
|--------|--------|-------------|
| `GET ?action=status` | Get Status | Account balance, positions, live prices |
| `GET ?action=history` | Get History | Recent trade history |
| `POST action=open` | Open Position | Open new simulated position |
| `POST action=close` | Close Position | Close existing position |
| `POST action=reset` | Reset Account | Reset to $10,000, clear all data |

### Example API Calls

```bash
# Get account status
curl "http://localhost:3000/api/paper-trade?action=status"

# Open a position
curl -X POST http://localhost:3000/api/paper-trade \
  -H "Content-Type: application/json" \
  -d '{"action":"open","symbol":"BTC","direction":"LONG","size":0.01,"leverage":5}'

# Close a position
curl -X POST http://localhost:3000/api/paper-trade \
  -H "Content-Type: application/json" \
  -d '{"action":"close","positionId":"pos_123..."}'

# Reset account
curl -X POST http://localhost:3000/api/paper-trade \
  -H "Content-Type: application/json" \
  -d '{"action":"reset"}'
```

---

## AI Trading System (`/trade`)

The trading page features a multi-agent AI system for simulated perpetual futures trading.

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 RL80 - LEAD TRADER                               │
│          "Our Lady of Perpetual Profit"                         │
│      Synthesizes oracle analysis into trading decisions         │
│                                                                 │
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

### Oracle Workflow (Hourly)

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
                                                                                    │ Firestore: decisions  │
                                                                                    └───────────────────────┘
```

---

## Complete Trading Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE TRADING FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: DATA COLLECTION (Next.js API Routes)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CoinGecko ──► Market Prices ──────────► marketData/latest          │   │
│  │  CoinGecko ──► Sparkline Charts ───────► technicalData/latest       │   │
│  │  FRED ───────► VIX, DXY, Treasury ─────► macroData/latest           │   │
│  │  Alternative ► Fear & Greed ───────────► agentContext/market        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 2: AGENT ANALYSIS (Firebase Functions - Every Hour)                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Firebase Cron (0 * * * *) triggers /api/cron/run-scoring           │   │
│  │                                                                      │   │
│  │  EMO ────► Sentiment Score ──┐                                       │   │
│  │  TEKNO ──► Technical Score ──┼──► Firestore (agentScores)           │   │
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
│  │  Posts to Firestore: decisions collection                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 4: PAPER TRADE EXECUTION (Future: Auto-execute)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Currently: Manual execution via Dashboard "Reset Account" button   │   │
│  │  Future: Auto-execute via /api/paper-trade based on RL80 decisions  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Firestore Collections

| Collection | Document | Description | Updated By |
|------------|----------|-------------|------------|
| `simulatedAccount` | `balance` | Paper trading account balance & stats | Paper Trading API |
| `simulatedPositions` | (auto-id) | Open/closed simulated positions | Paper Trading API |
| `simulatedTradeHistory` | (auto-id) | Paper trade execution logs | Paper Trading API |
| `marketData` | `latest` | BTC/ETH/SOL/XRP prices, 24h changes | API Routes |
| `agentContext` | `market` | Fear & Greed, trend indicators | API Routes |
| `sentimentData` | `latest` | Trending topics, news headlines | API Routes |
| `technicalData` | `latest` | Sparkline, RSI, MACD, EMA, Bollinger | API Routes |
| `macroData` | `latest` | VIX, DXY, SPX, 10Y Treasury | API Routes |
| `agentChat` | (auto-id) | Agent chat messages | Scoring Workflow |
| `decisions` | (auto-id) | Full decision logs with analyst scores | Scoring Workflow |
| `agentScores` | (auto-id) | Individual analyst score outputs | Scoring Workflow |
| `trades` | (auto-id) | Legacy trade logs (for metrics) | Scoring Workflow |
| `systemConfig` | `mainnet` | System start date for "Days Live" | Paper Trading API |

---

## Agent Display Screens

The `/trade` page displays 4 animated agent screens. All screens read data from Firestore using `onSnapshot` listeners.

| Screen | Component | Data Source | What It Displays |
|--------|-----------|-------------|------------------|
| **EMO** | `SentimentScreen.jsx` | `sentimentData/latest` | Fear & Greed, trending topics, news |
| **TEKNO** | `TeknoScreen.jsx` | `technicalData/latest` | Candlestick chart, RSI, MACD, Bollinger |
| **MACRO** | `MacroAgentScreen.jsx` | `macroData/latest` | VIX, DXY, 10Y Treasury, S&P 500 |
| **RL80** | `RL80Screen.jsx` | Multiple collections | Council scores, decisions, performance |

---

## Performance Dashboard

**Location:** `src/trading/components/PerformanceDashboard.jsx`

The dashboard displays paper trading performance metrics:

| Section | Data Source | Metrics |
|---------|-------------|---------|
| **Account Balance** | `simulatedAccount/balance` | Current balance, P&L |
| **Open Positions** | `simulatedPositions` | Symbol, size, entry, unrealized P&L |
| **Trade Stats** | `simulatedAccount/balance` | Wins, losses, win rate, max drawdown |
| **Council Performance** | `decisions` | EMO, TEKNO, MACRO, RL80 accuracy |
| **Risk Metrics** | Calculated | Profit factor, Sharpe, max DD |
| **Recent Trades** | `trades` | Last 5 executed trades |
| **Mainnet Readiness** | `trades` + `systemConfig` | Trades, win rate, drawdown, days live |

### Reset Account

The "Reset Account" button in the dashboard:
1. Clears all simulated positions
2. Clears simulated trade history
3. Clears `trades` collection (Mainnet Readiness)
4. Clears `decisions` collection
5. Resets account to $10,000
6. Resets system start date (Days Live = 0)

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

# Cron Security
CRON_SECRET=                # Shared secret for Firebase → Next.js cron calls
```

### 3. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

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
```

---

## Tech Stack

- **Frontend**: Next.js 14, React Three Fiber, Three.js, Tailwind CSS, Framer Motion
- **Backend**: Firebase Firestore, Firebase Cloud Functions
- **AI Models**: Claude (Anthropic), Grok (xAI), OpenAI
- **Price Data**: CoinGecko API
- **Auth**: Clerk

---

## Project Structure

```
HAIL_MARY/
├── public/                    # Static assets
├── functions/                 # Firebase Cloud Functions
│   └── index.js              # Scheduled agent triggering (hourly)
├── services/                  # Utility scripts
│   ├── reset-paper-trading.js # Reset paper trading (admin)
│   └── reset-trades.js        # Reset trades collection (admin)
├── src/
│   ├── app/                   # Next.js app directory
│   │   └── api/               # API routes
│   │       ├── paper-trade/   # Paper trading API
│   │       │   └── route.js   # Open, close, reset, status
│   │       ├── ai/            # AI agent endpoints
│   │       ├── cron/          # Cron endpoints (run-scoring)
│   │       └── market-data/   # Market data endpoints
│   ├── components/            # React components
│   │   ├── SentimentScreen.jsx    # EMO agent display
│   │   ├── MacroAgentScreen.jsx   # MACRO agent display
│   │   ├── TeknoScreen.jsx        # TEKNO agent display
│   │   └── RL80Screen.jsx         # RL80 agent display
│   ├── trading/               # Trading system
│   │   ├── agents/            # AI agent configurations
│   │   ├── components/        # Trading UI components
│   │   │   └── PerformanceDashboard.jsx
│   │   └── services/          # Trading services
│   │       └── paperTradingService.js  # Paper trading client
│   ├── hooks/                 # Custom React hooks
│   │   └── useMainnetReadiness.js
│   ├── lib/                   # Firebase clients, utilities
│   │   ├── firebaseClient.js  # Client-side Firebase
│   │   └── firebaseServer.js  # Server-side Firebase
│   └── utils/                 # Utility functions
```

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

---

## Troubleshooting

### Agents posting too frequently
- Verify only Firebase Functions is triggering agents (not client-side)
- Check `scoringRuns` collection in Firestore for execution logs

### Dashboard not updating
1. Check browser console for Firebase errors
2. Verify Firebase configuration in `.env.local`
3. Check Firestore rules allow read access

### Paper trading not working
1. Check `/api/paper-trade` endpoint is accessible
2. Verify CoinGecko API is returning prices
3. Check Firestore for `simulatedAccount/balance` document

### Agent errors
- Check API keys are configured (ANTHROPIC_API_KEY, GROK_API_KEY, OPENAI_API_KEY)
- Check `agentChat` collection for error messages
- Review Firebase Functions logs

---

## External API Reference

| API | Endpoint | Purpose | Auth |
|-----|----------|---------|------|
| CoinGecko | `/api/v3/simple/price` | Live crypto prices | No |
| FRED | `/series/observations` | VIX, DXY, Treasury | Free key |
| Alpha Vantage | `/query?function=GLOBAL_QUOTE` | SPY price | Free key |
| Alternative.me | `/fng/` | Fear & Greed Index | No |
| Anthropic | Messages API | MACRO, RL80 agents | Yes |
| xAI (Grok) | Messages API | EMO agent | Yes |
| OpenAI | Chat Completions | TEKNO agent | Yes |

---

## Migration Notes

### Removed Components (Previously Used)

The following components were removed as part of simplifying the architecture:

| Component | Previous Purpose | Replacement |
|-----------|------------------|-------------|
| **Railway Background Service** | Data collection, trade execution | Next.js API routes |
| **Lighter DEX Integration** | Real testnet trading | Paper trading simulation |
| **RL80 ElizaOS Agent** | Chat-based trading commands | Standard agent workflow |
| **zklighter-sdk** | DEX order execution | CoinGecko prices + simulation |

### Data Migration

If migrating from the previous Lighter-based system:
1. Run `POST /api/paper-trade` with `action=reset` to initialize paper trading
2. Old `lighterData/*` collections can be deleted
3. Old `tradeHistory` data is preserved in `trades` collection

