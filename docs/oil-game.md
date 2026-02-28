# Oil Prospector

A 3D oil exploration game where players claim land on a grid and drill for RL80 tokens hidden in procedurally generated underground deposits.

## Game Phase Flow

The game progresses through four phases, controlled by `gamePhase` in Firestore:

1. **`ticket_sale`** (Qualification) — Players register by connecting a wallet that holds ≥$20 USD worth of RL80 tokens. Admin runs daily snapshots to verify balances on-chain.
2. **`grid_locked`** — Admin locks grid size based on qualified player count. Qualified players pick plots first-come, first-served.
3. **`active`** — Remaining plots become "wild". Game starts (daily drilling flow).
4. **`ended`** — Game over. Report mode unlocked.

Default is `"active"` for backward compatibility — existing games without this field work unchanged.

## Routes

### `/oil` — Active Game (Player View)
The default player-facing view during an active game. Phase gates redirect to the ticket sale or draft screen when `gamePhase` is not `"active"`.

**Visible:** 3D canvas with pumpjacks and CCTV, surface map (2D grid), cross-section, geological survey (4 basic stats), Pimp My Pump customization.

**Hidden:** Oil data is blanked from the 2D views so players can't see deposit locations. Parameters, drill demo, top claims, dry zones, deposit locations, and inspector are all hidden.

The header shows the current game day (e.g. "DAY 1") synced from Firestore in real time.

### `/oil?mode=admin` — Admin Controls
Password-gated using `NEXT_PUBLIC_ADMIN_PASSWORD`. Credentials persist in localStorage.

**Everything from Active Game plus:**
- **Parameters panel** — deposit count, oil budget, seed/randomize
- **Game Day** — increment/decrement the day counter
- **Drill Demo** — day slider, play/pause, reset
- **Inspector** — full claim stats and depth profile
- **Top Claims / Dry Zones / Deposit Locations** — full reveal
- **Verify Panel** — hash verification
- **End Game button** — sets `gameEnded = true`, unlocks report mode

All settings (blockHash, numberOfDeposits, totalOilBudget, gridSize, gamePhase, gameDay, gameEnded) are persisted to Firestore at `oilGame/settings` and sync to player views in real time.

### `/oil?mode=test` — Test Mode
No sign-in or Firestore required. Lets you simulate the player drill experience for any cell.

**How to use:**
1. Visit `/oil?mode=test`
2. Click any cell on the surface map or cross-section to select it
3. Use the day stepper (−/+ buttons or slider) to scrub through depths 0–20

**What it shows:** The same player-facing feedback as Active Game — cross-section reveals drilled cells, depth profile bars fill in with gold/values, and geological survey shows YOUR DEPTH and EXTRACTED stats. The selected cell acts as your "claim" without writing to Firestore.

### `/oil?mode=report` — Post-Game Report
Available only after admin ends the game. Redirects to `/oil` if game is still active.

**Everything from Active Game plus:**
- **Geological Survey** expands with Peak Cell, Dry Claims, Hit Rate
- **Top Claims** ranking
- **Dry Zones** panel
- **Deposit Locations** revealed
- **Drill Demo** — replay tool for post-game analysis
- **Inspector** — full claim details
- **Verify Panel** — hash verification for fairness audit

## Pre-Game Screens

### Qualification (`gamePhase: "ticket_sale"`)
Full-page screen rendered by `OilQualify.jsx`. Shows:
- Qualified player counter and grid size targets (6×6 through 10×10)
- Qualification flow: user signs in via Clerk, connects wallet via `useWalletAuth()`, balance is checked against RL80/USD price from Uniswap V2. Users with ≥$20 USD of RL80 can register.
- Live balance check via `GET /api/oil-qualify?wallet=0x...`
- Registered player list (qualification status, name, avatar, wallet, USD value) via Firestore `onSnapshot`
- **Admin:** "Run Snapshot" button (verifies all registered players' balances on-chain), grid size selector, "Lock Grid & Start Draft" button, phase override buttons

### Plot Draft (`gamePhase: "grid_locked"`)
Full-page screen rendered by `OilPlotDraft.jsx`. Shows:
- Pick progress (picked / total qualified)
- Interactive CSS grid — any qualified player can click to claim (first-come, first-served)
- Plots colored: available / taken / yours (with avatars)
- **Admin:** Start Game, phase override buttons

## API Routes

### `GET /api/oil-qualify?wallet=0x...` — Live Qualification Check
Reads RL80 balance + price in real-time for a single wallet. Used by frontend for instant feedback.

**Returns:** `{ qualified, balance, usdValue, price, threshold: 20 }`

### `POST /api/oil-qualify` — Admin Qualification Snapshot
Admin-only. Reads all registered players from `oilQualified`, checks each wallet's RL80 balance on-chain, marks `qualified: true/false` based on $20 threshold.

**Body:** `{ adminPassword }`
**Returns:** `{ ok, price, qualifiedCount, totalChecked, timestamp }`

### `POST /api/oil-ticket` — Buy Ticket (Legacy)
Verifies a Base chain transaction (USDC or native ETH) then atomically creates a ticket using Firestore `runTransaction`. Prevents duplicate tickets and tx hash replay.

**Body:** `{ userId, clerkName, clerkAvatar, txHash }`
**Returns:** `{ ok: true, purchaseOrder: N }`

### `POST /api/oil-draft-skip` — Admin Skip Picker (Legacy)
Admin-only. Assigns a random available plot to the current timed-out picker, advances `currentPickOrder`, sets new `pickDeadline`.

**Body:** `{ adminPassword }`

## Game State (Firestore)

### `oilGame/settings`

| Field | Type | Description |
|-------|------|-------------|
| `blockHash` | string | Deterministic seed for oil distribution |
| `numberOfDeposits` | number | Number of underground oil blobs |
| `totalOilBudget` | number | Total RL80 tokens distributed underground |
| `gridSize` | number | Grid dimensions (e.g. 8 = 8×8) |
| `gamePhase` | string | `"ticket_sale"` / `"grid_locked"` / `"active"` / `"ended"` |
| `gameDay` | number | Current game day (shown in header) |
| `gameEnded` | boolean | Unlocks report mode when true |
| `ticketCount` | number | Total tickets sold (sequential counter) |
| `ticketPrice` | number | Price per ticket (10) |
| `currentPickOrder` | number | Whose turn in draft (1-based) |
| `pickDeadline` | Timestamp | Current picker's deadline |
| `pickWindowMinutes` | number | Minutes per pick (default 120) |
| `updatedAt` | timestamp | Last modification time |

### `oilQualified/{clerkUserId}`

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Clerk user.id |
| `clerkName` | string | Display name at registration time |
| `clerkAvatar` | string | Avatar URL at registration time |
| `walletAddress` | string | Connected wallet address |
| `registeredAt` | Timestamp | When registered |
| `qualified` | boolean | Set by admin snapshot |
| `lastSnapshotBalance` | string | RL80 balance at last snapshot |
| `lastSnapshotUsdValue` | number | USD value at last snapshot |
| `lastSnapshotAt` | Timestamp | When last snapshot ran |
| `plotCol` | number \| null | Grid column (set during draft) |
| `plotRow` | number \| null | Grid row (set during draft) |
| `pickedAt` | Timestamp \| null | When plot was picked |

### `oilGame/lastSnapshot`

| Field | Type | Description |
|-------|------|-------------|
| `price` | number | RL80/USD price at snapshot time |
| `ethPrice` | number | ETH/USD price at snapshot time |
| `qualifiedCount` | number | Players meeting $20 threshold |
| `totalChecked` | number | Total registered players checked |
| `threshold` | number | USD threshold (20) |
| `timestamp` | Timestamp | When snapshot ran |
| `results` | array | Per-player results |

### `oilTickets/{auto-id}` (Legacy)

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Clerk user.id |
| `clerkName` | string | Display name at purchase time |
| `clerkAvatar` | string | Avatar URL at purchase time |
| `purchaseOrder` | number | Sequential (1, 2, 3...) |
| `purchasedAt` | Timestamp | When bought |
| `txHash` | string | On-chain transaction hash |
| `paymentType` | string | `"USDC"` or `"ETH"` |
| `plotCol` | number \| null | Grid column (set during draft) |
| `plotRow` | number \| null | Grid row (set during draft) |
| `pickedAt` | Timestamp \| null | When plot was picked |
| `skipped` | boolean | True if admin skipped this picker |

## RL80 Price Reading (On-Chain)

The qualification system reads the RL80/USD price from the Uniswap V2 pool on Base, implemented in `src/lib/oilPrice.js`.

- **Pool:** `0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203` (RL80/WETH on Base)
- Calls `getReserves()` and `token0()` on the pair contract via Base RPC
- Computes RL80/ETH price from reserve ratio (both tokens are 18 decimals)
- Fetches ETH/USD from CoinGecko simple price API
- RL80/USD = (RL80/ETH) × (ETH/USD)
- Balance check: calls `balanceOf(address)` on the RL80 contract

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/oilPrice.js` | Server-side RL80/USD price + balance reading |
| `src/app/api/oil-qualify/route.js` | Qualification API (GET for live check, POST for admin snapshot) |
| `src/components/OilQualify.jsx` | Qualification screen (replaces OilTicketSale) |

## Rogue Characters System

Admin-deployed animated characters that roam the grid, cause mischief (eating add-ons, leaving graffiti), and trigger Telegram security alerts for camera-equipped plots.

### How It Works

1. Admin opens Rogue Deploy panel in `/oil?mode=admin`
2. Picks a character type, target cell (col/row), hits DEPLOY
3. `POST /api/oil-rogue` writes a `rogueEvents` doc, executes the consequence (removes addon or sets graffiti), and sends a Telegram alert if the plot owner has a linked account + security camera
4. All clients receive the event via `onSnapshot` → a `RogueCharacter` component renders the animated GLB on the 3D grid
5. Character lifecycle: Spawn at grid edge (0–2s) → Walk to target (2–5s) → Act (5–8s) → Leave (8–11s)
6. Rogue characters appear in CCTV feeds automatically (rendered in the same scene as pumpjacks)

### Rogue Catalog

| ID | Model | Consequence | Description |
|----|-------|-------------|-------------|
| `dinosaur` | `/models/addons/dinosaur.glb` | `delete_addon` | Eats a random add-on from the target plot |
| `troll` | `/models/rogues/troll.glb` | `graffiti` | Sets `config.graffiti = true` on the target plot |

New characters: drop a GLB in `public/models/rogues/`, add an entry to `ROGUE_CATALOG` in `RogueCharacter.jsx`, and optionally add a consequence handler in `/api/oil-rogue`.

### Telegram Integration

**Linking flow:**
1. Player enables Security Cam in Pimp My Pump, clicks "LINK TELEGRAM"
2. Opens `t.me/BotName?start={clerkUserId}` → user taps Start
3. Webhook at `/api/oil-telegram-webhook` saves `{ chatId, username }` to `oilTelegram/{clerkUserId}`

**Alerts:** When a rogue is deployed to a camera-equipped plot with a linked TG account, the API sends a text alert with character type, plot coordinates, and consequence.

### Key Files

| File | Purpose |
|------|---------|
| `src/app/api/oil-rogue/route.js` | Admin deploy (POST) + mark done (PATCH) |
| `src/app/api/oil-telegram-webhook/route.js` | Telegram bot webhook for account linking |
| `src/components/RogueCharacter.jsx` | R3F animated character + `ROGUE_CATALOG` export |
| `src/components/RogueAdminPanel.jsx` | Admin panel: character picker, target selector, deploy button, active list |

### API Routes

#### `POST /api/oil-rogue` — Deploy Rogue Character
Admin-only. Deploys a rogue character, executes consequence, sends Telegram alert.

**Body:** `{ password, characterType, targetCol, targetRow }`
**Returns:** `{ ok, eventId, consequence, telegramSent }`

#### `PATCH /api/oil-rogue` — Mark Event Done
Admin-only. Sets event status to `"done"`.

**Body:** `{ password, eventId }`

#### `POST /api/oil-telegram-webhook` — Telegram Webhook
Receives Telegram updates. On `/start {clerkUserId}`, links the Telegram chat to the Clerk user.

### Firestore Collections

#### `rogueEvents/{autoId}`

| Field | Type | Description |
|-------|------|-------------|
| `characterType` | string | `"dinosaur"`, `"troll"`, etc. |
| `targetCol` | number | Grid column |
| `targetRow` | number | Grid row |
| `targetUserId` | string\|null | Plot owner's Clerk ID |
| `status` | string | `"active"` → `"done"` |
| `consequence` | object | `{ type, addonSlot?, addonId? }` |
| `createdAt` | timestamp | Server timestamp |

#### `oilTelegram/{clerkUserId}`

| Field | Type | Description |
|-------|------|-------------|
| `chatId` | number | Telegram chat ID |
| `username` | string\|null | TG username |
| `linkedAt` | timestamp | When linked |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OIL_TICKET_WALLET` | Recipient wallet address for ticket payments (server-side) |
| `NEXT_PUBLIC_OIL_TICKET_WALLET` | Same wallet address exposed to client for display |
| `BASE_RPC_URL` | Base chain RPC endpoint for tx verification |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather (server-side) |
| `NEXT_PUBLIC_TELEGRAM_BOT_NAME` | Telegram bot username for deeplinks (defaults to "OilRogueBot") |

**Firestore rules:** Public read, authenticated write (access gated by admin password in UI).
