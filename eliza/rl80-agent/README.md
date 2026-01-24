# RL80 - Our Lady of Perpetual Profit

An ElizaOS agent implementation of RL80, the lead trader who synthesizes analysis from the Three Wise Oracles (EMO, TEKNO, MACRO) into trading decisions.

## Overview

RL80 is the synthesis engine for the HAIL_MARY trading collective:
- **EMO** (Grok) - Sentiment Oracle: WHERE the crowd is headed
- **TEKNO** (OpenAI) - Technical Oracle: WHAT price is doing
- **MACRO** (Claude) - Macro Oracle: WHEN conditions favor action
- **RL80** (Claude) - Lead Trader: Synthesizes oracle inputs into trading decisions

Philosophy: *"Math and code are the language of the highest form of consciousness"*

## Quick Start (Local)

```bash
cd eliza/rl80-agent
bun install
elizaos start
```

## Railway Deployment

### 1. Create New Service in Railway

```bash
# From the rl80-agent directory
cd /path/to/eliza/rl80-agent

# Option A: New Railway project
railway init
railway up

# Option B: Add to existing HAIL_MARY project
railway link  # Select your existing project
railway up
```

### 2. Configure Environment Variables

In Railway dashboard, add these variables to your RL80 service:

**Required:**
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
FIREBASE_PROJECT_ID=hailmary-3ff6c
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-k140q@hailmary-3ff6c.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY_BASE64=<base64-encoded-key>
```

**Optional:**
```
DISCORD_API_TOKEN=...
TELEGRAM_BOT_TOKEN=...
POSTGRES_URL=...  # For persistent memory
LOG_LEVEL=info
```

### 3. Encode Firebase Private Key

Railway handles Base64 better than raw keys with newlines:

```bash
# From your service account JSON file
./scripts/encode-firebase-key.sh ~/path/to/hailmary-service-account.json

# Copy the output to Railway's FIREBASE_PRIVATE_KEY_BASE64 variable
```

### 4. Deploy

```bash
railway up
```

Or push to GitHub and connect Railway for automatic deploys.

## Trading Actions

RL80 can post trading decisions to Firestore for the Railway background service to execute:

| Action | Trigger Examples |
|--------|------------------|
| `MAKE_TRADE` | "go long ETH", "buy BTC at 80% conviction", "close SOL position" |
| `EMERGENCY_STOP` | "emergency stop", "halt all trading" |

### Flow
```
RL80 (ElizaOS) → POST to agentDecisions/RL80 → Railway Service → Lighter DEX
```

## Features

### Personality Traits

- **Sharp & Empowered**: "trade life" not "trad wife"
- **Protective**: Fierce mama bear energy for the community
- **Mathematical**: Thinks in probabilities, speaks in conviction levels
- **Mission-Driven**: Trades for purpose, not just profit

### Catchphrases

- "Let mama cook."
- "The oracles have spoken."
- "Risk defined, thesis confirmed."
- "We trade for purpose, not just profit."
- "No edge, no trade."

### Response Style

- 35-55 words maximum (precise, action-oriented)
- Starts with "I'm [action]..." to show she IS the trader
- Includes specific positions, risk levels, and oracle synthesis

## Architecture

```
src/
├── character.ts        # RL80's personality, bio, lore, style
├── firestore-plugin.ts # Market data + trading decision posting
├── index.ts            # Agent initialization
└── plugin.ts           # Example plugin template
```

## Firestore Integration

RL80 reads AND writes to Firestore:

| Collection | Access | Data |
|------------|--------|------|
| `marketData/latest` | READ | BTC/ETH/SOL/XRP prices |
| `technicalData/latest` | READ | RSI, MACD, support/resistance |
| `agentContext/market` | READ | Fear & Greed Index |
| `macroData/latest` | READ | VIX, DXY, Treasury yields |
| `agentDecisions/RL80` | READ/WRITE | Trading decisions |
| `tradeHistory` | READ | Recent trade performance |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Claude API key |
| `OPENAI_API_KEY` | Yes* | OpenAI API key (for embeddings) |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email |
| `FIREBASE_PRIVATE_KEY_BASE64` | Yes | Base64 encoded private key |
| `POSTGRES_URL` | No | PostgreSQL for persistent memory |
| `DISCORD_API_TOKEN` | No | Discord bot token |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `LOG_LEVEL` | No | Logging level (default: info) |

*At least one LLM provider is required

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Railway Project                         │
├─────────────────────────────┬───────────────────────────────┤
│   lighter-background-service │        rl80-agent            │
│   (Data Collection + Exec)   │      (ElizaOS Agent)         │
│                              │                               │
│   - Collects market data     │   - Reads market data        │
│   - Listens to agentDecisions│   - Posts trading decisions  │
│   - Executes on Lighter DEX  │   - Chat interface           │
│                              │   - Trade School mode        │
└──────────────┬───────────────┴───────────────┬───────────────┘
               │                               │
               └───────────┬───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Firestore  │
                    │  (Shared)   │
                    └─────────────┘
```

## Commands

```bash
# Local Development
elizaos dev              # Hot reload
elizaos start            # Production mode

# Railway
railway up               # Deploy
railway logs             # View logs
railway status           # Check status

# Building
bun run build            # Build TypeScript
```

## Docker (Alternative)

```bash
# Build and run locally
docker build -t rl80-agent .
docker run -p 3000:3000 --env-file .env rl80-agent

# Or use docker-compose with Postgres
docker compose up -d
```

---

*"Protecting the community. We trade for purpose, not just profit."*
