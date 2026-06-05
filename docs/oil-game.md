# Oil Prospector

A 3D oil exploration game where players claim land on a fixed 10x10 grid and drill for $500 USDC hidden in procedurally generated underground deposits.

## Economy & Timing Model (Proposed)

> **Status: design proposal, not yet implemented.** This section captures the intended direction for game pacing, the local tank, theft, and prize economics. Where it conflicts with the *current* implementation described below (daily-drill cadence in **Core Mechanics**, dino tank-theft in **Rogue Characters → Consequences v2**, literal `totalCollected` payout in **Post-Game Payout**), this section is the target model and supersedes those.

### Design through-line

The goal is **constant ambient curiosity** (players compulsively check "did my rig strike?") instead of a predictable daily-appointment loop, while keeping the game **fair, growth-friendly, and never punishing players for being offline** — important because oil is real money.

### Game timing — three independent layers

Timing is three separate knobs, mixed-and-matched:

| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Macro** (game lifecycle) | **Rolling seasons** — back-to-back fixed rounds, each with a start/end | A fixed prize needs an end to rank winners and pay out; rolling keeps the game "always on" and lets traction compound season-over-season |
| **Meso** (player cadence) | **Continuous pump** — kill the 24h drill gate; rig runs 24/7 | Removes the "23 hours until next drill" dead time that trains players to ignore the game |
| **Micro** (strike reveal) | **Armed rig + random-hour strike** on lump-sum blocks | Variable *timing* of reward (not outcome) drives compulsive checking |

**Lump-sum blocks (Family A), not flow-rate.** A block's oil is already fixed by the deterministic block-hash distribution — whether it's dry, holds crude, or is a hell pocket is decided up front. The **only** thing randomized is *when* the rig finishes a block and reveals it. The strike is never random in outcome, only in reveal time — which keeps it fair and un-cheatable.

**The strike mechanic.** The rig is "armed." Once per day it resolves the next block at a **random hour the player can't predict** (variants: one guaranteed strike at a random hour; per-hour dice roll; or a jittered drill-time so it "breaks through overnight"). A server cron rolls each armed rig forward, schedules strikes, writes to Firestore, and fires the existing Telegram alert. The player's only ongoing decision is **whether to keep drilling deeper** — deeper = richer, but more dry-block risk. That single milk-vs-gamble choice preserves agency in an otherwise idle loop.

> Offline strikes require server-authoritative scheduling (a Firebase scheduled function / cron route — the same pattern already planned for rogue auto-deploy).

### Local tank & banking

Keep the local tank, **remove the hard capacity cap.** The cap's only real job was forcing visits — and the dinosaur already does that better, while a cap actively punishes the offline gusher the random-strike design is built to create.

- **Banked oil (`totalCollected`) is the player's safe, scored money.** Nothing can reduce it.
- **Un-banked oil (`tankOil`, new field on `oilDrills`)** sits exposed; the more you let pile up, the more is at risk — so exposure scales with hoarding, which pressures players to bank *without* a cap.
- Optional **soft cap with auto-bank overflow**: tank holds up to X exposed barrels; beyond X, oil auto-secures to the main tank. Keeps a satisfying fill-meter and guarantees no offline gusher is ever lost. Slightly softens dino stakes on big strikes — add only if the meter UX matters.
- **End-of-season:** auto-bank any un-banked oil so nobody loses winnings to timing luck (unless a frantic "bank before the buzzer" finale is wanted).

### Theft → "contested capture"

Because oil is real money, **earned/banked oil must never be stealable.** Loss aversion + money taken while offline by something uncontrollable = the fastest way to destroy trust (and to start looking like something regulators dislike). Note the existing design already refuses to *delete* paid addons (visual degradation only) — this applies that same principle consistently.

- **Banked oil is sacrosanct. Period.**
- Reframe theft as **contested capture**: the threat doesn't steal *your* oil, it tries to make off with a **gusher not yet banked** — and you (or other hunters) race to stop/claim it. Mental model becomes "I might miss out on extra," never "I lost what was mine."
- Any loss must be **preventable and self-determined** — only un-banked oil, only after a fair defense window (the camera/defense path already exists). Timing luck must never cost money.
- The **demon is already fine** (self-inflicted summon cost, defense window, redistributive bounty). The thing to rework is the **dino stealing 20–30% of a random victim's tank offline** → convert to a contested-capture event (dino *en route* to a gusher; bank/defend in time).

### Prize pool — oil as a scoreboard

The buried oil is a **scoreboard**, not the literal payout. At season end the full pot splits **in proportion to each player's score**:

> payout = (your oil found ÷ total oil found) × pot

This guarantees the **entire pot always pays out** regardless of turnout — the "money left in the ground" problem disappears with no dynamic grid resizing. Competition is preserved (rich-vein finders earn a bigger slice). Players keep the *feeling* of extracting money while the accounting redistributes the remainder at payout.

Grid size becomes a **feel/contention** dial, not an economic one: fixed 10×10 is fine (runs sparse at low turnout, EV stays high), or size **once at registration close** for a packed board. Because the distribution is deterministic from a block hash, **resize only once at the `ticket_sale → active` transition — never mid-game** (it would move oil out from under active rigs).

### Scaling & referrals

A **fixed** pot that always fully pays is **zero-sum** — every referred player dilutes everyone's slice, which kills the referral flywheel (and makes the existing extra-depth referral reward just claw back self-inflicted dilution). Two independent decisions:

- **Pot *size*:** must **scale with participation** (not fixed) so referrals are positive-sum.
- **Pot *distribution*:** proportional score (above) — this was never the problem; it's what guarantees full payout.

Keep the **extra-depth referral reward** unchanged — under proportional split it's a personal *kicker* (more depth → higher score → bigger slice) on top of a pot that now grows when you recruit.

### Funding — sponsorship + dev revenue (separate buckets)

| Bucket | Source | Notes |
|--------|--------|-------|
| **Prize pool** | Sponsors (external, additive) + treasury-seeded floor | Additive money keeps referrals positive-sum; nobody's slice shrinks |
| **Dev income** | Premium add-on sales (3–5 USDC via x402) | Kept fully separate — the dev getting paid never reduces the prize |

- **Per-qualified-wallet sponsor bounty:** pitch sponsors "$X base + $Y per qualified wallet, up to a cap." Same deal from two angles — a **referral incentive** for players *and* a **user-acquisition deal** for the sponsor. Makes the pot scale with signups within a season.
- **3D ad inventory:** derricks, edge billboards, the main tank (title sponsor), blimps, loading screens, CCTV overlay. The game manufactures **shareable media** (CCTV clips → Telegram) = organic, measurable impressions on real onchain wallets.
- **Coinbase/CDP angle:** the game already exercises the full CDP stack (onramp, swap, embedded wallets, x402, CDP RPC on Base) → a live **case study** worth pitching to Coinbase ecosystem/devrel, not just a logo slot.
- **Bootstrap first:** keep the **$500 treasury floor**, run 1–2 self-funded seasons to generate traction metrics, *then* pitch sponsors. Don't architect the launch to require them.
- **Regulatory posture:** a sponsor-funded prize with entry = holding tokens reads as a promotional contest/sweepstakes (safer than a player-funded pooled-stakes game). Get a lawyer's eyes once money scales.

### Resource theming (fluids only, for now)

The extracted substance is **themeable** — oil, otherworldly goo, plasma, etc. — but restricted to **fluids** so the pump/tank/drain/overflow/gusher loop above applies unchanged. Solid-mining (gold, diamonds, buried treasure) is a **future build**: a sibling game mode with its own extraction verb (mine, not pump) and machine, sharing only the grid/claim/season/economy engine — explicitly out of scope now.

- **Three layers:** engine (resource-agnostic, operates on abstract `units`) / resource theme (name, color, VFX, verb, tank visual — a config in `oilGame/settings`) / extraction physics (fluid only for now).
- **Keep internal "oil" naming** (`oilPlots`, `oilDrills`, `oilGame`, `/oil`) — it's the engine's substrate label; renaming the data model buys nothing. Separate internal naming (stays "oil") from the **player-facing substance** (read from a `resourceTheme` config). New strike/tank code should pull substance labels from that config rather than hardcoding "oil."
- Default substance is an open creative call (oil = legible/built; goo = fits the hell/demon theme, brand-safe, more shareable). A hybrid is on the table: oil baseline + otherworldly goo as the rare jackpot strike tied to hell pockets.
- **Player-facing substance name: Lyquid80** (locked 2026-06-04). Reads as "liquidity" when spoken, ties to the **RL80** token and element 80; visually an **iridescent opal** fluid (cyan gusher beam, petrol-rainbow spill puddles, real thin-film iridescence on tank liquids). Display strings only (headers, theme tooltip); internal identifiers stay `parabolum`/`uParabolum` per the layer split above. See the iridescence system in `src/components/OilVoxelGrid.jsx` (`IRID_PRESETS` / `ACTIVE_IRID = opal`).

### Decided & implementation status

**Decided (2026-05-30):**
- **Strike timing:** one guaranteed strike per UTC day at a per-rig **deterministic-but-unpredictable minute-of-day** (`hash(userId + date) % 1440`) — can land at any time, not just on the hour; stable across ticks, no extra writes, idempotent.
- **Cadence:** **auto-advance, depth = cap.** The rig drills one layer deeper per day automatically (no action budget); the old "20 drill actions" becomes the 20-layer depth floor. Agency lives in plot choice + banking timing.
- **Tank:** **uncapped.** `tankOil` grows freely; dino risk scales with hoarding instead of a cap.

**Implemented (server core — Slice 1):**
- `src/app/api/oil-strike-tick/route.js` — the strike loop. Tick-cadence-agnostic, idempotent per day (gates on a per-rig minute-of-day target so a strike fires on the first tick at/after that minute), reuses `generateOilDistribution3D` + `getAdminDb` (single source of truth). Manual test: `GET /api/oil-strike-tick?password=<ADMIN_PASSWORD>&force=1` (add `&deep=N`, 1–20, to drill N layers in one call for testing — bypasses the once-per-day guard; affects all claimed rigs; Telegram suppressed during deep drills). `&scout=1` returns the richest cells (no writes) so a tester can aim a rig — gives 0-based `col`/`row`, the on-screen `label` (col+1,row+1), and `bestLayer`.
- `functions/index.js` → `oilStrikeTick` — every-5-minutes Firebase scheduled function that pings the route (needs `CRON_SECRET`; `APP_URL` optional). Deploy with `firebase deploy --only functions`.
- New `oilDrills` fields written by the striker: `tankOil`, `lastStrikeDate`, `lastStrikeAt`, `lastStrikeOil`, `lastStrikeDepth`, `lastStrikeHell`, `armed`, `rigDepleted`.

**Implemented (client wiring — Slice 2):**
- `oilInTank` now reads the authoritative `tankOil` (falls back to the legacy derived model for pre-loop data). This also fixes a latent bug: the old derived tank summed *all* layers `0..drillDay`, wrongly crediting a claim-jumper for oil a previous owner drilled — `tankOil` counts only layers *this* rig struck.
- `/api/oil-tank-drain` banks `tankOil → totalCollected` and zeroes the tank when present; keeps the legacy delta model as a fallback. Idempotent under concurrent drains.
- The demon bounty drains the real un-banked tank (`tankOil`).
- Manual `handleDailyDrill` now also accumulates `tankOil` (mirrors the strike loop) so admin/test drilling stays consistent.
- The strike is **surfaced through the existing reactive pipeline**: the cron advancing `oilPlots.drillDay` flows through the `oilPlots` listener → `effectiveDrillDay` → the existing `oilStrike` effect + 3D gusher visual + DrillHUD gauges. A returning player sees the strike animation on load.

**Implemented (hell-pocket → demon):**
- Bounty creation extracted to `src/lib/oilDemon.js` (`createDemonBounty`), shared by the player-facing `POST /api/oil-demon-bounty` and the strike loop — no logic drift.
- A hell-pocket strike in `oil-strike-tick` now summons the demon: `unbankedOil` = the rig's post-strike tank, which the creator drains (the cost of unleashing hell). The striker also respects the global blockade (skips the tick while a demon is loose) and stops striking remaining rigs once one is summoned.
- **Bug fixed in the extraction:** the old `POST` called `communitySnap.exists()` (a method) on an **admin** snapshot where `exists` is a property → it threw, so the real-player hell→demon path was 500-ing (masked because admin/test mode uses a local preview, not the API). The shared lib uses the property form. Also: the old "drain summoner's tank" block was a no-op (only re-wrote `lastDrainExtracted`); it now correctly zeroes `tankOil`.

**Implemented (auto-pump UI — Slice 3):**
- New `drillStatus === "auto-pumping"` for real players: replaces the manual DRILL button with a non-clickable "⛏ RIG PUMPING" indicator + depth bar, the last-strike result (`depth N — struck X` / `dry layer`), and a "strikes once a day at an hour you can't predict" hint. `rigDepleted` falls through to "max-depth".
- Manual drilling is cleanly disabled for real players (drillStatus never "ready" for them, and `handleDailyDrill` already guards on `"ready"`); **admin/test keep the manual DRILL path** for verification.
- **Mobile overlap fix (pre-existing bug):** the mobile 3D tab rendered `DrillHUD` twice — once inside the canvas wrap and once in the control block below — so the gauges crowded/overlapped the drill button. Removed the in-canvas copy; now one `DrillHUD` per layout (mobile control block / desktop side panel), matching desktop.

**Remaining UI polish (optional):**
- A "while you were away" summary toast (uses `lastStrikeAt`/`lastStrikeOil`/`lastStrikeDepth`) — the result is currently surfaced inline in the pump indicator + via the existing 3D strike visual, so this is purely a flourish.

**Decided (2026-05-31):**
- **End-of-season un-banked oil → credited to the player, never lost.** Un-banked `tankOil` belongs to the player; banking *during* the season is optional theft-protection (the dino can take a % of un-banked oil), not a scoring gate. Payout = `totalCollected` + any remaining `tankOil`. No "bank before the buzzer" pressure. **Implementation TODO:** `scripts/oil-payout.js` reads only `totalCollected` today — either sweep all `tankOil → totalCollected` at season end, or sum both in the payout.
- **EV-per-player: flat floor, trending up — never declining.** Pot scales at least linearly with participation (per-qualified-wallet sponsor bounty) so EV stays flat as the game grows; as traction attracts bigger sponsorships the pot grows faster than headcount and EV *rises*. Growth always rewards existing players → referrals stay strongly positive-sum.

**Tank meter copy (done 2026-05-31):** relabeled to reflect the uncapped tank — header "TANK · UNBANKED", readout shows raw `{tankOil} USDC` (no `/cap`), and the over-threshold prompt is "TANK HEAVY — BANK SOON" (button) instead of "TANK FULL". `TANK_CAPACITY = 5` now only drives the meter's red "bank soon" threshold, not a storage limit.

**Open decisions:**
- Default substance: oil vs goo vs hybrid (oil baseline + goo jackpot).

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

## Core Sample Panel

Collapsible panel in the right sidebar (`src/components/CoreSamplePanel.jsx`) with two sub-tabs:

### YOUR CLAIM (Personal Core)
- Shows the 20-layer depth column at the player's specific claim (x, y)
- **Drilled layers**: color-coded by actual oil value (SHALE → SANDSTONE → OIL SAND → CRUDE → RICH VEIN)
- **Undrilled layers**: hatched "UNCHARTED" zone below the drill head
- Best find marked with pulsing orange dot
- Updates each time the player drills — even dry layers fill in a new band

### FIELD SURVEY (Composite Core)
- Single core tube averaging oil density across all 100 plots at each depth level
- "RUN CORE ANALYSIS" button triggers a 2.8-second top-to-bottom reveal animation
- Shows the depth bias visually (deeper = richer) without revealing location-specific data
- Callout labels auto-generated for significant zones, pulsing PEAK DENSITY marker

## Drill HUD (Instrument Gauges)

Always-visible gauge panel in the right sidebar (`src/components/DrillHUD.jsx`) with three arc gauges:

| Gauge | Shows |
|-------|-------|
| DEPTH | Current drill level |
| PRESSURE | Fluctuating PSI reading during drill, locks to result |
| DENSITY | Material classification (g/cm³ during drill, tier label after) |

### Drill Animation Phases (~18 seconds total)

| Phase | Time | Behavior |
|-------|------|----------|
| DRILLING | 0-6s | Pressure fluctuates, density at 0, dust bursts every 3s, rig rumble builds |
| ANALYZING SAMPLE | 6-10s | Pressure spikes, density flickers, gauge agitation increases for oil finds |
| RESULT | 10s | Gauges snap to final values (BARREN / TRACE / OIL SAND / CRUDE / RICH VEIN) |
| AREA SCAN | 12.5s | Transitions to proximity reading for nearby deposits |

### Preliminary Area Scan
After the result, gauges show a proximity-based reading using `drillProximity` (max oil in 3x3x3 cube, 1 cell radius):
- **NOMINAL** (< 5%) — barely moves
- **TRACE ACTIVITY** (5-15%) — slight reading
- **ELEVATED READINGS** (15-35%) — moderate signal
- **ANOMALOUS SIGNAL** (35%+) — strong nearby deposits

Density gauge shows "???" during the scan. Label reads "AREA SCAN" (not "NEXT LAYER") to avoid implying the signal is directly below.

### 3D Animation (OilVoxelGrid.jsx)
Oil strike visual effects are **delayed 10 seconds** (`STRIKE_REVEAL_DELAY`) to create suspense:
- Dust spawns in waves every ~3s during boring phase
- Drill rumble ramps from 30% → 150% intensity across the sequence
- Gauge needle behavior differs subtly for oil vs dry (builds agitation before oil reveals)
- Camera shake delayed to coincide with the strike reveal

## Server-Authoritative Reveal (anti-cheat — 2026-06-04)

The distribution used to be computed **client-side** from a public `blockHash`, so any
player could copy the seed and run `generateOilDistribution3D` to print the entire field
(or just read `stats.grid3D` from memory). The reveal is now server-authoritative:

- **Seed is secret (commit-reveal).** The raw seed lives in the server-only `oilSecret/seed`
  doc (`firestore.rules`: `read/write: if false`). `oilGame/settings` publishes only the
  SHA-256 **commitment** (`seedCommitment`); the raw seed (`seedReveal`) is published at game
  end for verification. `/api/oil-settings` POST stores the seed + commitment and purges any
  legacy public `blockHash`; an admin-only GET returns the seed for the live inspector.
- **Server writes the reveal per cell.** On each strike, `oil-strike-tick` writes the
  discovered oil into `oilPlots/{col_row}.revealed[layer]` (+ `hellLayers`). `/api/oil-backfill-revealed`
  (admin-gated) backfills already-drilled cells.
- **Client renders from reveals, never the seed.** `useClaimStats` only computes when
  `seedVisible` (admin/report/test); normal players run it disabled. `displayGrid3D` /
  `displayHellMap` assemble the field from `oilPlots.revealed` (memos `revealedGrid3D` /
  `revealedHellMap` / `claimOrder`, all seed-free). Surface view, cross-section, core sample,
  proximity/area-scan, and hit-rate all read revealed data only.
- **Hell is server-authoritative.** The strike-tick summons the demon on a hell strike;
  the client only mirrors visuals via the `demonBounty` listener (admin/test keep a local preview).
- **Still a live intelligence map** via the `allPlotsMap` listener — it just reflects what's
  actually been drilled, by anyone, and leaks nothing about the undrilled field.

### Resolution decoupled from prize (2026-06-04)

The field is generated at a fixed internal resolution — `OIL_FIELD_UNITS` (500,000)
in `oilDistribution.js` — **not** the dollar prize. At a low total, scaling+rounding
wiped out each deposit blob's edges and collapsed the distribution to its cores
(one composite band, "0.0k" cells). Every `generateOilDistribution3D` caller now
passes `OIL_FIELD_UNITS` (client `useClaimStats`/`OilVoxelGrid`, server strike-tick/
backfill, verify) **and** `depthBias: 0.35` so client and server produce the *same*
field. Oil is now a **score in field units**; the **prize pool** (`settings.totalOilBudget`,
shown as "PRIZE POOL") is separate and pays out by share. Player oil readouts (cells,
tank, EXTRACTED, leaderboard) read in OIL units; `TANK_CAPACITY` rescaled to units.

**Economy pass (done 2026-06-04):** all player + inspector oil readouts now read
in OIL units (only PRIZE POOL + demon bounties stay USDC); `scripts/oil-payout.js`
splits the pool by score share (`payout = (banked+tank) / totalScore × prizePool`,
pool read from `oilGame/settings.totalOilBudget`); `depthBias` is the single
`OIL_DEPTH_BIAS` constant in `oilDistribution.js` — every live caller uses the
default (the dead `OilHeatmap2D` still has a literal but isn't imported).

**Deferred (pre-launch):** lock `oilPlots`/`oilDrills` to server-only writes (needs
`/api/oil-claim-jump` + `/api/oil-drill` endpoints first), and reconcile `OilVerifyPanel`/
`OilVerifyExplainer` to the commit-reveal model (verify `SHA256(seedReveal) == seedCommitment`
post-game instead of recomputing from a block hash).

## Telegram Integration

### Bot: `@hailmary_securitybot`
- Webhook: `https://rl80.com/api/oil-telegram-webhook`
- Linking: `/start {clerkUserId}` command stores `chatId` in `oilTelegram/{userId}`

### Notifications
1. **Text alert** (immediate): `POST /api/oil-rogue` sends rogue intrusion details when plot has camera enabled
2. **CCTV footage** (after recording): `useCctvRecorder` uploads 14s WebM to Firebase Storage, then `POST /api/oil-telegram-cctv` sends the video to Telegram via `sendVideo` (falls back to `sendDocument` → text link)

### Firestore
| Collection | Purpose |
|------------|---------|
| `oilTelegram/{userId}` | `chatId`, `username`, `linkedAt` |
| `cctvRecordings/{docId}` | `downloadUrl`, `storagePath`, `eventType`, `col`, `row`, `durationMs` |

## Assets Tab (UnifiedAccountModal)

New "Assets" tab in the account modal showing all premium items the player owns, grouped by category (Themes, Fences, Add-ons, Accessories, Slot Unlocks). Items persist across all game rounds — stored in `oilPurchases/{userId}.unlocked`. Supports both `cyber` and `industrial` themes.

## Premium Items

| Category | Price | Examples |
|----------|-------|---------|
| Theme | 5 USDC | Full Chrome, Dragonforge, Celestial Execution, Metal AF |
| Fence | 3 USDC | Iron, White Picket, Stone |
| Add-on | 3 USDC | T-Rex, Pet Zombie, Tubeman |
| Accessory | 5 USDC | Security Camera |
| Slot Unlock | 5 USDC | Addon Slot 4, Slot 5 |

Purchases are permanent account-level unlocks via x402 on-chain payment. Free items: stock themes, chainlink fence, most addons (flamingo, gravestone, sunflowers, gnome, etc.), text signs.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/oil/page.js` | Main game page — drill handler, community grid, drill HUD, core sample, Telegram shake delay |
| `src/components/CoreSamplePanel.jsx` | Core sample panel — personal drill log + field survey with animation |
| `src/components/DrillHUD.jsx` | Instrument gauges — phased drill animation, area scan |
| `src/components/OilVoxelGrid.jsx` | 3D scene — pumpjacks, staged drill effects, delayed strike reveal |
| `src/components/OilSurfaceMap.jsx` | 2D grid — ownership coloring, claim-jump mode |
| `src/components/OilQualify.jsx` | Registration + plot picking |
| `src/components/UnifiedAccountModal.jsx` | Account/Wallet/Assets tabs |
| `src/components/PimpMyPumpPanel.jsx` | Pump customization + premium item shop |
| `src/hooks/useCctvRecorder.js` | CCTV recording + Firebase upload + Telegram delivery |
| `src/lib/oilDistribution.js` | Deterministic 3D oil distribution from block hash |
| `src/lib/oilPremium.js` | Premium item registry, pricing, free/premium classification |
| `src/app/api/oil-rogue/route.js` | Rogue deployment + Telegram text alerts |
| `src/app/api/oil-demon-bounty/route.js` | Hell demon bounty lifecycle (create / claim / expire) |
| `src/app/api/oil-telegram-webhook/route.js` | Telegram bot linking |
| `src/app/api/oil-telegram-cctv/route.js` | CCTV footage delivery to Telegram |
| `src/app/api/oil-purchase/route.js` | x402 premium purchase handler |
| `src/app/api/oil-seed-test/route.js` | Admin: seed fake players for testing |
| `src/app/api/oil-qualify/route.js` | Qualification check + admin snapshot |

## Rogue Characters System

Animated characters that roam the grid and cause mischief. Deployed by admin or automatically on a schedule. Trigger Telegram security alerts for camera-equipped plots.

### How It Works (Current)

1. Admin opens Rogue Deploy panel in `/oil?mode=admin`
2. Picks a character type, target cell (col/row), hits DEPLOY
3. `POST /api/oil-rogue` writes a `rogueEvents` doc, executes the consequence, and sends a Telegram alert
4. All clients receive the event via `onSnapshot` → a `RogueCharacter` renders the animated GLB on the 3D grid
5. Character lifecycle: Spawn at grid edge → Walk to target → Act → Leave
6. Rogue characters appear in CCTV feeds automatically

### Consequences v2 (Planned)

Rogues create engagement hooks that pull players back to the game. Most consequences require player attention to fix (visit UI, tap to clean/repair), not money. The dinosaur is the genuine threat.

| Rogue | Consequence | Severity | Player Fix |
|-------|------------|----------|------------|
| Crudingo (bird) | Poops on plot | Cosmetic | Visit UI → tap to clean |
| Troll | Graffiti on pad | Cosmetic | Visit UI → tap to clean |
| Blue Demon | Damages an addon (visual degradation, not deletion) | Moderate | Visit UI → tap to repair |
| Dinosaur | **Steals 20-30% of stored tank oil** | Real loss | Cannot undo — the oil is gone |

Design principles:
- **Without camera**: player doesn't know damage happened until they visit
- **With camera**: Telegram alert on rogue spawn (early warning), footage recorded on arrival
- **Dinosaur defense**: camera triggers early "INTRUDER EN ROUTE" Telegram alert with inline "ACTIVATE DEFENSE" button. Player taps before rogue arrives → rogue repelled, oil safe. Miss the window → oil stolen. Response window ~10-15 seconds (rogue walk time across grid).
- Cleanup actions (poop, graffiti, repair) are small satisfying interactions — makes the plot feel owned

### Auto-Deployment (Planned)

Rogues should also deploy automatically, not just manually by admin:
- Scheduled/random spawns (e.g., 2-4 rogues per day during active game phase)
- Random target selection weighted toward plots with more stored oil (dinosaurs target rich tanks)
- Character type randomized or on a rotation
- Could use a Firebase scheduled function or a cron-triggered API route
- Admin manual deploy remains available for special events or testing
- Auto-deploy frequency and rogue mix configurable in `oilGame/settings`

## Hell Demon (Bounty Hunt)

A special multiplayer event triggered when a player drills into a **hell pocket** (`stats.hellMap`).
Unlike rogues (admin/auto-deployed mischief), the demon is a player-driven, grid-wide event with a
shared bounty and a skill-based capture. Implemented as `HellDemon` in `OilVoxelGrid.jsx`, driven by
the `demonBounty` Firestore collection + `oilGame/demonBlockade` doc.

### Trigger & Lifecycle

1. A player drills a cell whose column contains a hell pocket → `/oil` POSTs to
   `/api/oil-demon-bounty` (real players; admin/test mode runs a local-only preview instead).
2. The API creates a `demonBounty` doc (`status: "active"`) and sets the global `demonBlockade`:
   - Picks a random **victim plot** (another player's occupied cell) as the demon's target.
   - Computes a **bounty** = up to 5 USDC from the community pool + the summoner's unbanked tank oil
     (the summoner's tank is drained as the cost of unleashing hell).
   - **Stuns the summoner** for 2 minutes (`stunEndsAt`) — they can't drill or catch the demon until it expires.
   - Sets the env preset to `hell` and halts all drilling globally while the demon is loose.
3. A Telegram alert fires to the victim plot owner if their plot has a camera.
4. All clients render the demon via the `demonBounty` listener; it appears in CCTV feeds automatically.

### Demon Behavior (client-side, `HellDemon`)

A phase state machine in `useFrame` (same idioms as `RogueCharacter.jsx`):

`spawn` (rises from below) → `transit_turn` (turns to face the victim) → `transit_walk` (walks across
the grid on the ground via `Walk Forward In Place`) → **wander loop** (`Turn Left/Right` →
`Walk Forward In Place` between nearby cells, with `idle`/`Look Around` **pause** windows and
`Slash`/`Projectile Attack` **mischief** — purely cosmetic, no stat impact).

Movement is deterministic via a seeded PRNG (keyed on the bountyId) so every client animates roughly
the same wander path without extra Firestore writes. The authoritative sync point is the bounty
`status` — when it goes to `claimed`/`dismissed`, every client removes the demon.

### Capture — Timing Challenge

The demon is **only banishable during its vulnerable pause windows** (when it stops to idle / look
around — it glows brighter and a 3D **BANISH** ring appears). Clicking it (the body or the ring) then:
- **During a pause** → banish: it shrinks and sinks with a burst, then claims the bounty.
- **While moving/attacking** → it dodges to a new cell with a taunt ("THE DEMON DODGES"). No banish.
- **During the spawn/fly/land intro** → it can't be caught at all.

There is no always-on banish button — catching the demon in its window is the only way.

### Claiming Outcomes (`PATCH /api/oil-demon-bounty`)

The claim is gated by `status in ["active","flying","waiting"]` (the challenge lives client-side, so
the bounty stays `active` for its whole life and is claimable throughout) and runs in a transaction:

| Who catches it | Result |
|----------------|--------|
| **A hunter** (anyone but the summoner) | Earns the bounty USDC (`totalCollected`) + up to 3 bonus drills; blockade clears |
| **The summoner** (only after stun expires) | Dismisses it — bounty returns to the community pool, no reward |

A stunned summoner is blocked from catching their own demon client-side (`demonCapturable`) so the
visual never desyncs from a server rejection. `DELETE` force-expires a stale bounty (admin or
auto-expiry), returning the bounty to the community pool.

### Data Model

| Collection / Doc | Purpose |
|------------------|---------|
| `demonBounty/{id}` | `status` (`active`→`claimed`/`dismissed`/`expired`), `summoner*`/`target*` cells, `bountyAmount`, `hunter*`, `stunEndsAt` |
| `oilGame/demonBlockade` | Global single-demon lock: `active`, `bountyId`, bounty/target info, `stunEndsAt` |

### Tuning Knobs (`HellDemon`, top of the section in `OilVoxelGrid.jsx`)

Phase durations (`DEMON_*_DUR`), `DEMON_PAUSE_DUR` (size of the catchable window), `DEMON_WALK_SPEED`,
`DEMON_WANDER_RADIUS`, and two visual offsets: `DEMON_GROUND_Y` (raise if the model sits sunk) and
`DEMON_YAW_OFFSET` (if it faces the wrong way).

## Post-Game Payout

After the game ends (`gamePhase = "ended"`), players are paid out in USDC on Base using the batch payout script.

### Script: `scripts/oil-payout.js`

Reads `oilDrills` (for `totalCollected`) and `oilQualified` (for `walletAddress`), joins on userId, and sends USDC transfers sequentially.

```bash
# Preview payout manifest (no transfers sent)
node scripts/oil-payout.js --dry-run

# Execute payouts
node scripts/oil-payout.js
```

**Features:**
- Displays a full manifest table (wallet, username, amount) before prompting for confirmation
- Checks payout wallet USDC balance before starting
- Resume support: writes results to `scripts/payout-results.json` after each tx — re-running skips already-paid wallets
- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
- `totalCollected` is in USDC units (e.g. 12.5 = $12.50)

**Required env vars:** `BASE_RPC_URL`, `PAYOUT_PRIVATE_KEY`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OIL_TICKET_WALLET` | Recipient wallet address for ticket payments (server-side) |
| `NEXT_PUBLIC_OIL_TICKET_WALLET` | Same wallet address exposed to client |
| `BASE_RPC_URL` | Base chain RPC endpoint |
| `PAYOUT_PRIVATE_KEY` | Private key of wallet holding USDC (for post-game payouts) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `NEXT_PUBLIC_TELEGRAM_BOT_NAME` | Telegram bot username for deeplinks |
*