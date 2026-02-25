# Oil Prospector

A 3D oil exploration game where players claim land on a grid and drill for RL80 tokens hidden in procedurally generated underground deposits.

## Game Phase Flow

The game progresses through four phases, controlled by `gamePhase` in Firestore:

1. **`ticket_sale`** — Players buy numbered tickets ($10 USDC on Base). Admin watches sales volume.
2. **`grid_locked`** — Admin locks grid size based on demand. Ticket holders pick their plot in purchase order (async, ~2hr window each).
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

### Ticket Sale (`gamePhase: "ticket_sale"`)
Full-page screen rendered by `OilTicketSale.jsx`. Shows:
- Large ticket counter and grid size targets (6×6 through 10×10)
- Buy flow: user sends $10 USDC on Base to the ticket wallet, then submits the tx hash. The `/api/oil-ticket` endpoint verifies the transaction on-chain before recording the ticket.
- Live ticket holder list (purchase order, name, avatar, timestamp) via Firestore `onSnapshot`
- **Admin:** Grid size selector, "Lock Grid & Start Draft" button, phase override buttons

### Plot Draft (`gamePhase: "grid_locked"`)
Full-page screen rendered by `OilPlotDraft.jsx`. Shows:
- Pick progress and current picker info with countdown timer
- Interactive CSS grid — click to claim when it's your turn
- Plots colored: available / taken / yours (with avatars)
- **Admin:** Skip picker (assigns random plot), Start Game, phase override buttons

## API Routes

### `POST /api/oil-ticket` — Buy Ticket
Verifies a Base chain transaction (USDC or native ETH) then atomically creates a ticket using Firestore `runTransaction`. Prevents duplicate tickets and tx hash replay.

**Body:** `{ userId, clerkName, clerkAvatar, txHash }`
**Returns:** `{ ok: true, purchaseOrder: N }`

### `POST /api/oil-draft-skip` — Admin Skip Picker
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

### `oilTickets/{auto-id}`

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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OIL_TICKET_WALLET` | Recipient wallet address for ticket payments (server-side) |
| `NEXT_PUBLIC_OIL_TICKET_WALLET` | Same wallet address exposed to client for display |
| `BASE_RPC_URL` | Base chain RPC endpoint for tx verification |

**Firestore rules:** Public read, authenticated write (access gated by admin password in UI).
