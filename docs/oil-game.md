# Oil Prospector

A 3D oil exploration game where players claim land on a 10x10 grid and drill for RL80 tokens hidden in procedurally generated underground deposits.

## Routes

### `/oil` — Active Game (Player View)
The default player-facing view during an active game.

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

All settings (blockHash, numberOfDeposits, totalOilBudget, gameDay, gameEnded) are persisted to Firestore at `oilGame/settings` and sync to player views in real time.

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

## Game State (Firestore)

Stored at `oilGame/settings`:

| Field | Type | Description |
|-------|------|-------------|
| `blockHash` | string | Deterministic seed for oil distribution |
| `numberOfDeposits` | number | Number of underground oil blobs |
| `totalOilBudget` | number | Total RL80 tokens distributed underground |
| `gameDay` | number | Current game day (shown in header) |
| `gameEnded` | boolean | Unlocks report mode when true |
| `updatedAt` | timestamp | Last modification time |

**Firestore rules:** Public read, authenticated write (access gated by admin password in UI).
