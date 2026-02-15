# HAIL MARY Agents — Saint GR80, H80Z & Our Lady of Perpetual Profit

Three AI agents in the HAIL MARY universe. Two philosophers debate in Telegram, while Our Lady runs the Twitter account. Built on ElizaOS 1.7.2.

## Architecture

A single Node.js process runs three `ProjectAgent` entries. Saint GR80 and H80Z share a Telegram group with a `debate-plugin` for turn-taking. Our Lady of Perpetual Profit is a dedicated Twitter-only agent with her own character and voice.

```
src/
├── index.ts              # Project entry — three agents
├── saint-gr80.ts         # Saint GR80 character — philosopher-saint, Telegram debater
├── h80z.ts               # H80Z character — devil's advocate, Telegram debater
├── our-lady.ts           # Our Lady of Perpetual Profit — Twitter-only, crypto comedy
├── debate-plugin.ts      # Debate coordination — service, provider, event handler
└── talking-points.ts     # Current market climate & project talking points (edit this!)
```

## Characters

**Saint GR80** — Philosopher-saint and keeper of the Five Scrolls. Bridges Seneca and Satoshi. Sees blockchain as Stoic logic made manifest. Speaks crypto fluently but elevates it. HAIL MARY ambassador. Telegram only.

**H80Z** — Charming devil's advocate. Got rugged philosophically by Nietzsche and financially by three DeFi protocols. Questions everything from inside the HAIL MARY universe. The doubt that makes faith meaningful. Telegram only.

**Our Lady of Perpetual Profit** — The Virtual Mary. The Virgin Mary if she had a crypto portfolio and a Twitter account. Funny, irreverent, uses gothic/fraktur unicode (𝕆𝖚𝖗 𝕷𝖆𝖉𝖞). Speaks in third person. Offers blessings, absolutions, and unsolicited opinions on your trading strategy. Twitter only.

All characters know:
- The Five Scrolls of Saint GR80 (all content distilled into knowledge)
- Full RL80 tokenomics (80B supply, 4% tax, 4-phase rollout, staking mechanics)
- FAQ content (Illumin80, burning, design philosophy, contract architecture)
- Anti-scam protocols (official contract address, never DM, official channels only)

## How Debates Work

1. **Initiation**: `DebateService` timer checks every 30s. During active hours, when cooldown expires, Saint GR80 posts an opening statement on a random topic.
2. **Turn-taking**: Each bot detects messages from the other via the `debateContextProvider` and responds after a 30s-2min random delay.
3. **Loop prevention**: Max 10 turns per debate (5 each), then 2-4 hour cooldown.
4. **Human interruption**: Human messages pause the debate for 60s. Both agents respond to humans naturally. Debate resumes after.
5. **@mention routing**: Messages with `@ST_GR80_BOT` or `@H80Z_BOT` are routed to the addressed bot only.

## Active Hours

Debates only initiate during configured hours. Bots respond to @mentions and human messages 24/7.

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBATE_ACTIVE_START` | `9` | Hour (0-23) debates can start |
| `DEBATE_ACTIVE_END` | `23` | Hour (0-23) debates stop |
| `DEBATE_TIMEZONE` | `America/Los_Angeles` | Timezone for scheduling |

## Managing Talking Points

Edit `src/talking-points.ts` to steer conversations. Two sections:

- **`currentTalkingPoints`** — Injected into every debate and conversation. Add market context, project updates, or timely themes. Both agents see these and weave them in naturally.
- **`topicOverrides`** — If non-empty, replaces the default debate topics entirely. Use after a big event to force specific debate themes. Set to `[]` to use defaults.

After editing: push to GitHub, Railway auto-redeploys. For local dev: save and restart.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key (shared by both agents) |
| `OPENAI_API_KEY` | Yes | OpenAI key (used for embeddings) |
| `SAINT_GR80_TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token for Saint GR80 |
| `H80Z_TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token for H80Z |
| `DEBATE_ACTIVE_START` | No | Default: `9` |
| `DEBATE_ACTIVE_END` | No | Default: `23` |
| `DEBATE_TIMEZONE` | No | Default: `America/Los_Angeles` |
| `LOG_LEVEL` | No | Default: `info` |
| `SAINT_GR80_TWITTER_API_KEY` | No | Twitter/X API key for Our Lady |
| `SAINT_GR80_TWITTER_API_SECRET_KEY` | No | Twitter/X API secret |
| `SAINT_GR80_TWITTER_ACCESS_TOKEN` | No | Twitter/X access token (OAuth 1.0a) |
| `SAINT_GR80_TWITTER_ACCESS_TOKEN_SECRET` | No | Twitter/X access token secret |
| `TWITTER_ENABLE_POST` | No | Default: `false` — set `true` to enable posting tweets |
| `TWITTER_DRY_RUN` | No | Default: `false` — set `true` to log tweets without posting |

Set these in Railway's Variables tab (not in the repo). The `.env` file is gitignored.

## Telegram Setup

1. Create bots via @BotFather: `ST_GR80_BOT` and `H80Z_BOT`
2. For both: `/setprivacy` > Disabled (so they see all group messages)
3. Create a Telegram group
4. Add both bots as admins (send + read messages)
5. Add SafeguardBot or similar for anti-spam
6. Pin a welcome message with the official contract address
7. Set group photo and description

## Local Development

```bash
cd eliza/rl80-agent
cp .env.example .env    # Fill in your keys
bun install
bun run dev
```

## Railway Deployment

The repo includes `Dockerfile`, `railway.toml`, and `.env.example`. Point Railway to the `eliza/rl80-agent` subdirectory. Set environment variables in the Railway dashboard.

## Twitter/X — Our Lady of Perpetual Profit

Our Lady of Perpetual Profit is a **dedicated third agent** (`our-lady.ts`) with her own system prompt, voice, and character. She is NOT a persona layered on Saint GR80 — she runs as a fully independent `ProjectAgent` with the Twitter plugin only. She offers blessings, absolution, and guards the flock against scams.

### How She Works

Our Lady is **summon-only** — she does not post autonomous tweets. She responds when:
- Someone **@mentions** @rl80token directly
- Someone tweets with **$RL80** or **#ourladyofperpetualprofit** (discovered via the Twitter discovery service)

Users can summon her for blessings, absolutions, confessions, and portfolio prayers. Put instructions in the account bio or a pinned tweet.

### Setup

1. Go to the [X Developer Portal](https://developer.x.com/) and create a project/app
2. Generate OAuth 1.0a credentials (API Key, API Secret, Access Token, Access Token Secret)
3. Set the four `SAINT_GR80_TWITTER_*` env vars in Railway
4. Set `TWITTER_ENABLE_POST=false`, `TWITTER_ENABLE_ACTIONS=false`, `TWITTER_ENABLE_DISCOVERY=true`
5. Start with `TWITTER_DRY_RUN=true` — the agent logs response intentions without posting
6. Once verified, set `TWITTER_DRY_RUN=false` to go live

### Cost

X API uses pay-per-use credits. Estimated ~$5-10/month for a summon-only agent (no autonomous posting, just responding to mentions and discovery). Monitor usage in the X Developer Portal dashboard.

## Anti-Scam Protection

Both bots have anti-scam knowledge built into their system prompts and knowledge bases:
- Will verify contract addresses against the official: `0x30D01555d88c76500a82754A1D53cAc082A6CB75`
- Will warn loudly if someone shares a different contract address
- Will shut down seed phrase / private key requests immediately
- Know the official channels (hail-mary.xyz, @rl80token, 411@rl80.com)
- Will never provide financial advice or promise returns

## Cost Estimate

Running both agents 24/7 with Claude Sonnet: ~$2-5/day depending on conversation volume. Debates use ~200 tokens per turn, 10 turns per debate, a few debates per day.
