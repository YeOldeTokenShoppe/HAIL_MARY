# Oil Prospector

A 3D oil exploration game where players claim land on a fixed 10x10 grid and drill for $500 USDC hidden in procedurally generated underground deposits.

## Game Phase Flow

The game progresses through three phases, controlled by `gamePhase` in Firestore:

1. **`ticket_sale`** (Registration + Plot Pick) — Players register by connecting a wallet that holds ≥$20 USD worth of RL80 tokens. After registration, they immediately pick a plot on the fixed 10x10 grid (first come, first served). Players who already picked a plot fall through to the 3D canvas.
2. **`active`** — Game starts. Daily drilling flow. Players can claim jump to different plots.
3. **`ended`** — Game over. Report mode unlocked.

Default is `"active"` for backward compatibility.

## Core Mechanics

### Drilling
- Each player gets **20 total drill actions** across all plots
- Each day, a player can drill one layer deeper on their current plot
- Cell depth persists across owners (if you claim jump to a pre-drilled cell, you continue from that depth)

### Claim Jumping
- Players can move to a different unclaimed plot
- **First 2 jumps are free** (no drill action cost)
- **3rd jump onwards** costs 1 drill action per jump
- Old plot is released (becomes unclaimed, but retains its drill depth)

### Disqualification
- Admin runs snapshots to verify RL80 token balances on-chain
- Players who drop below $20 USD threshold are disqualified
- Disqualified players' plots are released but marked as disqualified (drill depth preserved)
- Released plots are available for others to claim jump to

## Data Model

### `oilPlots/{col_row}` — Per-Cell State
Per-cell state that persists across owners.

| Field | Type | Description |
|-------|------|-------------|
| `col` | number | Grid column |
| `row` | number | Grid row |
| `drillDay` | number | Depth drilled (persists across owners) |
| `currentOwnerId` | string\|null | Clerk userId, null = unclaimed |
| `ownerHistory` | array | `[{ userId, claimedAt, releasedAt?, reason? }]` |
| `disqualified` | boolean | True if released due to disqualification |
| `lastDrillDate` | string\|null | "YYYY-MM-DD" |

### `oilDrills/{userId}` — Player Stats

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Clerk user.id |
| `col` | number\|null | Current plot column |
| `row` | number\|null | Current plot row |
| `totalDrillActions` | number | Max 20 (player's action counter) |
| `claimJumpsUsed` | number | Tracks jumps (first 2 free) |
| `totalCollected` | number | Oil sent to main tank |
| `tankDrains` | number | Number of tank drains |
| `lastDrainExtracted` | number | Extracted at last drain |
| `lastDrillDate` | string\|null | "YYYY-MM-DD" |
| `username` | string | Display name |
| `updatedAt` | timestamp | Last modification |

### `oilQualified/{userId}` — Registration Data

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Clerk user.id |
| `clerkName` | string | Display name at registration time |
| `clerkAvatar` | string | Avatar URL at registration time |
| `walletAddress` | string | Connected wallet address |
| `xUsername` | string | X/Twitter username |
| `registeredAt` | Timestamp | When registered |
| `qualified` | boolean | Set by admin snapshot |
| `lastSnapshotBalance` | string | RL80 balance at last snapshot |
| `lastSnapshotUsdValue` | number | USD value at last snapshot |
| `lastSnapshotAt` | Timestamp | When last snapshot ran |
| `plotCol` | number\|null | Grid column (backward compat) |
| `plotRow` | number\|null | Grid row (backward compat) |
| `pickedAt` | Timestamp\|null | When plot was picked |

### `pumpConfigs/{userId_col_row}` — Pump Customization
No schema change. Stores pump visual config per cell.

## Routes

### `/oil` — Active Game (Player View)
The default player-facing view during an active game. During `ticket_sale` phase, shows OilQualify if the user hasn't picked a plot yet; falls through to the 3D canvas if they have.

**Visible:** 3D canvas with pumpjacks and CCTV, surface map (2D grid with ownership coloring), cross-section, geological survey, Pimp My Pump customization, claim jump toggle.

### `/oil?mode=admin` — Admin Controls
Password-gated. Everything from Active Game plus parameters, drill demo, inspector, top claims, dry zones, deposits, verify panel, end game button, phase overrides.

### `/oil?mode=test` — Test Mode
No sign-in required. Simulate the player drill experience for any cell.

### `/oil?mode=report` — Post-Game Report
Available after admin ends the game. Full reveal of all data.

## API Routes

### `GET /api/oil-qualify?wallet=0x...` — Live Qualification Check
**Returns:** `{ qualified, balance, usdValue, price, threshold: 20 }`

### `POST /api/oil-qualify` — Admin Qualification Snapshot
Reads all registered players, checks balances. When a player drops below threshold:
- Releases their `oilPlots` cell (`currentOwnerId = null, disqualified = true`)
- Appends to `ownerHistory` with `reason: "disqualified"`
- Clears `col/row` in `oilDrills`

**Body:** `{ adminPassword }`
**Returns:** `{ ok, price, qualifiedCount, totalChecked, timestamp }`

## Key Files

| File | Changes |
|------|---------|
| `src/components/OilQualify.jsx` | Registration + inline plot picking (merged), fixed 10x10 grid, $500 USDC copy |
| `src/app/oil/page.js` | oilPlots subscription, drill handler (writes to both oilPlots + oilDrills), claim jump handler, phase gates, drillStatus with pre-game/max-actions |
| `src/components/OilSurfaceMap.jsx` | allPlotsMap prop, ownership coloring, claim-jump mode with pulsing cells |
| `src/app/api/oil-qualify/route.js` | Disqualification releases oilPlots cells |
| `src/lib/firebaseClient.js` | Added arrayUnion export |
| `src/lib/firebaseServer.js` | Added arrayUnion export |

## Rogue Characters System

Admin-deployed animated characters that roam the grid, cause mischief (eating add-ons, leaving graffiti), and trigger Telegram security alerts for camera-equipped plots.

### How It Works

1. Admin opens Rogue Deploy panel in `/oil?mode=admin`
2. Picks a character type, target cell (col/row), hits DEPLOY
3. `POST /api/oil-rogue` writes a `rogueEvents` doc, executes the consequence, and sends a Telegram alert
4. All clients receive the event via `onSnapshot` → a `RogueCharacter` renders the animated GLB on the 3D grid
5. Character lifecycle: Spawn at grid edge → Walk to target → Act → Leave
6. Rogue characters appear in CCTV feeds automatically

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OIL_TICKET_WALLET` | Recipient wallet address for ticket payments (server-side) |
| `NEXT_PUBLIC_OIL_TICKET_WALLET` | Same wallet address exposed to client |
| `BASE_RPC_URL` | Base chain RPC endpoint |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `NEXT_PUBLIC_TELEGRAM_BOT_NAME` | Telegram bot username for deeplinks |
