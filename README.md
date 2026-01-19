# HAIL_MARY

A Next.js project featuring an AI-powered perpetual trading system with multiple specialized agents.

## Pages

- `/` - Root page with PalmTreeDrive scene
- `/home` - Main home page with 3D scenes and interactions
- `/trade` - **AI Trading Dashboard** - 4 AI agents trading perps on Lighter testnet DEX
- `/fountain` - Fountain visualization page
- `/ethos` - 3D model viewer
- `/tokenomics` - Tokenomics information page

## AI Trading System (`/trade`)

The trading page features a multi-agent AI system for perpetual futures trading on Lighter DEX (testnet).

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    COORDINATOR AGENT                         │
│              (Aggregates specialist recommendations)         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    MACRO      │    │   SENTIMENT   │    │   TECHNICAL   │
│  SPECIALIST   │    │   SPECIALIST  │    │   SPECIALIST  │
│   (Claude)    │    │    (Grok)     │    │   (Claude)    │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Specialist Agents

| Agent | AI Model | Data Sources | Purpose |
|-------|----------|--------------|---------|
| **Macro Specialist** | Claude | Fed rates, VIX, DXY, Treasury yields, BTC dominance | Macroeconomic analysis |
| **Sentiment Specialist** | Grok | Reddit trending, Fear & Greed, Polymarket, whale activity, funding rates | Social/market sentiment |
| **Technical Specialist** | Claude | Price charts, indicators, support/resistance | Technical chart analysis |
| **Coordinator** | Claude | All specialist scores | Final trade decisions |

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Railway Background Service                      │
│        (services/lighter-background-service-standalone.js)   │
├─────────────────────────────────────────────────────────────┤
│  Market Data      → every 60s   → Firestore: marketData     │
│  Agent Context    → every 120s  → Firestore: agentContext   │
│  Lighter Trading  → every 20m   → Firestore: lighterData    │
│  Sentiment Data   → every 30m   → Firestore: sentimentData  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌───────────────┐
                     │   Firestore   │
                     └───────────────┘
                              │
                              ▼ (onSnapshot - real-time)
                     ┌───────────────┐
                     │  Next.js App  │
                     │   (clients)   │
                     └───────────────┘
```

### Sentiment Data Sources (Free APIs)

| Screen Section | Source | Data |
|----------------|--------|------|
| **Fear & Greed Index** | Alternative.me | Crypto Fear & Greed Index (0-100) |
| **Trending Topics** | Reddit + CoinGecko | Hot posts from r/bitcoin, r/ethereum, r/cryptocurrency + trending coins |
| **Prediction Markets** | Polymarket | Crypto-related prediction market odds |
| **Whale Activity** | Binance | Large trades analysis (>$100k) to detect accumulation/distribution |
| **Google Trends** | Google Trends API | Bitcoin search interest (0-100 scale, 7-day trend) |
| **App Rankings** | App Store + Google Play | Ratings for Coinbase, Binance, MetaMask apps |

All sentiment data is fetched by the Railway service every 30 minutes and written to Firestore.

**Note:** Google Trends and App Rankings use web scraping libraries (`google-trends-api`, `app-store-scraper`, `google-play-scraper`) - no API keys required.

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
# ... other Firebase vars

# AI APIs
ANTHROPIC_API_KEY=          # For Claude (Macro, Technical, Coordinator)
GROK_API_KEY=               # For Grok (Sentiment) - via api.x.ai

# Lighter DEX (testnet)
LIGHTER_API_KEY=
LIGHTER_WALLET_PRIVATE_KEY=
```

### 3. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Railway Background Service

The `services/` directory contains a standalone Node.js service that runs on Railway:

```bash
cd services
npm install
node lighter-background-service-standalone.js
```

This service:
- Fetches market data from CoinGecko
- Fetches sentiment data from Reddit, Polymarket, Binance
- Manages Lighter DEX connection and trading data
- Writes all data to Firestore for clients to consume

### Railway Environment Variables

```env
# Firebase (individual vars for Railway compatibility)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_BASE64=  # Base64 encoded private key
FIREBASE_CLIENT_EMAIL=

# Lighter DEX
LIGHTER_API_KEY=
LIGHTER_WALLET_PRIVATE_KEY=
```

## Tech Stack

- **Frontend**: Next.js 14, React Three Fiber, Three.js, Tailwind CSS, Framer Motion
- **Backend**: Firebase Firestore, Railway (background service)
- **AI Models**: Claude (Anthropic), Grok (xAI)
- **Trading**: Lighter DEX (testnet)
- **Auth**: Clerk

## Project Structure

```
HAIL_MARY/
├── public/                    # Static assets
├── services/                  # Railway background service
│   └── lighter-background-service-standalone.js
├── src/
│   ├── app/                   # Next.js app directory
│   │   └── api/               # API routes
│   │       ├── ai/            # AI agent endpoints
│   │       ├── cron/          # Scheduled tasks
│   │       └── market-data/   # Market data endpoints
│   ├── components/            # React components
│   │   ├── SentimentScreen.jsx    # Sentiment agent display
│   │   └── MacroAgentScreen.jsx   # Macro agent display
│   ├── trading/               # Trading system
│   │   ├── agents/            # AI agent configurations
│   │   ├── components/        # Trading UI components
│   │   └── services/          # Trading services
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Firebase clients, utilities
│   └── utils/                 # Utility functions
```

## Firestore Collections

| Collection | Document | Description |
|------------|----------|-------------|
| `marketData` | `latest` | BTC/ETH prices, 24h changes |
| `agentContext` | `market` | Fear & Greed, funding rate, VIX, trend |
| `sentimentData` | `latest` | Trending topics, Polymarket, whale activity |
| `lighterData` | `account` | Lighter account balance |
| `lighterData` | `trading` | Positions and orders |