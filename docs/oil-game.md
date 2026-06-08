# Oil Prospector

A 3D oil exploration game where players claim land on a fixed 10x10 grid and drill for $500 USDC hidden in procedurally generated underground deposits.

## Economy & Timing Model (Proposed)

> **Status: BUILT (2026-06-07).** The pacing/depth model, the uncapped local tank, the depth levers, and the fixed-rate prize economics in this section are implemented and tested — see *TIMING FRAMEWORK* and *Depth levers* below for specifics and file pointers. Older descriptive sections (Core Mechanics, Game Phase Flow, Data Model) have been reconciled to match. **Still proposal-only:** the *contested-capture* theft rework in **Rogue Characters → Consequences v2** — the dino still takes un-banked tank oil today.

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

**The strike mechanic.** The rig is "armed." It resolves the next block at a **random time the player can't predict**, paced by the depth-scaled interval (see *TIMING FRAMEWORK* — avg interval = season ÷ depthCap, with the strike placed at a random moment inside each window). A server cron rolls each armed rig forward, schedules strikes, writes to Firestore, and fires the existing Telegram alert. The player's only ongoing decision is **whether to keep drilling deeper** — deeper = richer, but more dry-block risk. That single milk-vs-gamble choice preserves agency in an otherwise idle loop.

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

### Prize pool — oil has a fixed value (2026-06-07, supersedes the share model)

**Every oil unit is worth a fixed rate: `rate = pot ÷ OIL_FIELD_UNITS`** (e.g. `$500 ÷ 500,000 = $0.001/unit` → 1,000 oil = $1). A player's payout is simply:

> payout = (your banked + tank oil) × rate

Your value depends **only on your own haul** — never on what anyone else finds. Properties:

- **Liability is bounded by construction.** The field is finite and deterministic (`OIL_FIELD_UNITS` total), so the most that can ever be owed is `OIL_FIELD_UNITS × rate = the pot`, reached only at 100% extraction. Escrow the pot and you're always solvent — no separate cap mechanism needed.
- **You pay only for oil actually found.** Unfound oil is never paid out; the operator keeps the remainder. (This deliberately *reverses* the old "entire pot always pays out" goal.)
- **Referrals are positive-sum with no pot-scaling tricks.** A new player digging their own claim can't shrink your value, because there are no slices — there's a fixed price per unit. This removes the whole zero-sum/dilution problem the share model had to engineer around.
- **Anti-sybil matters more.** Fixed-rate rewards total oil found, so one entity farming many wallets to grab deposit cells captures more of the bounded pot directly. Defend with the entry gate (hold tokens) + per-wallet claim limits.

Payout concentration follows oil concentration: with the field's value massed in a few deposit blobs, hitting a deposit pays big and missing pays cents — authentic prospector variance. Flatten it (if desired) by spreading the **distribution** (more deposits, less peaky), *not* by changing the formula.

Grid size becomes a **feel/contention** dial, not an economic one: fixed 10×10 is fine. Because the distribution is deterministic from a block hash, **resize only once at the `ticket_sale → active` transition — never mid-game** (it would move oil out from under active rigs).

Keep the **extra-depth referral reward** unchanged — under fixed-rate it's a clean personal kicker (more depth → more oil found → bigger check) that costs no other player anything.

> **Superseded share model (pre-2026-06-07):** the pot used to split *pari-mutuel* — `payout = (your oil ÷ total oil found) × pot` — so the entire pot always paid out regardless of turnout. Abandoned because it (a) paid the full pot even to a handful of players who barely dug, and (b) was zero-sum, so every referral diluted everyone's slice (which forced a "pot must scale with participation" workaround and sponsor-additive funding just to keep referrals positive-sum). The fixed-rate model fixes both directly.

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
- **Keep internal "oil" naming** (`oilPlots`, `oilDrills`, `oilGame`, `/api/oil-*`, `oil_*` localStorage) — it's the engine's substrate label; renaming the data model buys nothing. Separate internal naming (stays "oil") from the **player-facing substance** (read from a `resourceTheme` config). New strike/tank code should pull substance labels from that config rather than hardcoding "oil." NOTE: the player-facing **route** moved `/oil` → `/hailmary` (2026-06-07; `/oil` 308-redirects, query preserved). Only the URL + the page file (`src/app/hailmary/page.js`) changed — the data model/API/storage keep the "oil" label.
- Default substance is an open creative call (oil = legible/built; goo = fits the hell/demon theme, brand-safe, more shareable). A hybrid is on the table: oil baseline + otherworldly goo as the rare jackpot strike tied to hell pockets.
- **Player-facing substance name: Lyquid80** (locked 2026-06-04). Reads as "liquidity" when spoken, ties to the **RL80** token and element 80; visually an **iridescent opal** fluid (cyan gusher beam, petrol-rainbow spill puddles, real thin-film iridescence on tank liquids). Display strings only (headers, theme tooltip); internal identifiers stay `parabolum`/`uParabolum` per the layer split above. See the iridescence system in `src/components/OilVoxelGrid.jsx` (`IRID_PRESETS` / `ACTIVE_IRID = opal`).

### Decided & implementation status

**Decided (2026-06-07) — TIMING FRAMEWORK (supersedes the 2026-05-30 "1 layer/day" cadence below):**

Three independent clocks, deliberately **decoupled** so depth never doubles as a countdown timer (the bug in flat-1/day + referral-gated depth: low-referral rigs deplete early and idle the back half of the season):

| Clock | Decision | Controls |
|-------|----------|----------|
| **Season** (macro) | **Fixed 10-day rounds**, wall-clock end for everyone | Payout/ranking clock. Everyone ends together → **no staggered finishes**. Fast iteration for the bootstrapped 1–2 season test. |
| **Depth** (earned) | Base 10 + earned bonus, capped at 20 | *How deep & rich* you extract — a resource reward, never *how long* you play. |
| **Cadence** (strike) | **Fill-the-season pace + random reveal time:** avg interval = `seasonMs ÷ depthCap`, but each strike fires at an **unpredictable moment within its interval window** | TWO knobs: the interval is the *metronome* (depth-10 ≈ 1/day, depth-20 ≈ 2/day — fills the whole season, nobody idles); the *random placement inside each window* is the **engagement engine** — continuous drilling yields strikes at times you can't predict, driving the "did my rig hit?" compulsion to keep checking. Don't lose the randomness — it's the whole point of the strike mechanic. |

- **What a "strike" actually is — grind vs. paydirt:** the drill **continuously grinds** through each unit (the always-on baseline). **Most units are just shale (dry)** — passed through as low-key, ambient non-events. A **"strike" is specifically hitting something of interest** (a deposit), and *that* event surfaces at a **random, unpredictable time of day**. The unit's content is predetermined (block-hash deterministic, un-cheatable); only the *reveal moment* is random. So the loop is **variable-ratio** (does this unit hold anything?) × **variable-interval** (when does it pop?) — mostly-dry grinding punctuated by rare, randomly-timed payoffs = the slot-machine reinforcement that drives compulsive checking. (Code already distinguishes the two: `lastStrikeOil` / `lastStrikeDepth` vs the "dry layer" readout in the Slice-3 pump UI.)
- **`depthCap = PASSIVE_DRILLS(10) + bonusDrills`** (capped at `MAX_DEPTH = 20`). `bonusDrills` now does **double duty** — deeper layers *and* a shorter strike interval → referrals/effort buy **intensity + richness**, not an earlier finish. Base-10 (depth-10) maps exactly onto the already-shipped ~1/day tick; bonuses densify it up to ~2/day.
- **Mid-season bonus drills recompute the interval** from the current `depthCap` each tick — earn referrals on day 5 and the remaining strikes densify (a small catch-up burst). Rewards referring early.
- **Random reveal time is the engagement engine (preserved from the original "random-hour strike" design):** the interval sets *average* pace, but the strike fires at an unpredictable moment **within** each window — `strikeTarget = windowStart + (hash(userId + windowIndex) mod intervalMs)` (hash-derived → stable/idempotent across ticks, unguessable; cron fires on the first tick at/after the target). This is what makes players check back; the interval change only altered the *average* spacing (was a flat daily gate), never the unpredictability.
- **Fixed-rate kills the "wait-and-see" worry:** payout = `your oil × pot/OIL_FIELD_UNITS`, depends only on your own haul. Watching the live map only helps you *aim* a claim-jump, never your rate — no payout incentive to hoard/stall. Auto-pump removes the "when to drill" lever; the residual info-leak (jumping onto a revealed-rich column) is dampened because only drilled layers are public and the rich deep layers stay secret.
- **Full payout is NOT the target.** Unfound oil stays in treasury (operator keeps the remainder); the depth cap is a throttle on how much of the pot is won. A partially-extracted field is the intended, solvent outcome.

**Implementation — BUILT 2026-06-07** (evolves the existing idempotent strike-tick — not a rewrite; `next build` clean):
- **`oil-strike-tick`** (`src/app/api/oil-strike-tick/route.js`): per-rig `depthCap = min(PASSIVE_DRILLS(10) + bonusDrills, MAX_DEPTH(20), depthZ)`. Strike target `= windowStart + strikeFraction(userId, currentDepth)·interval`, where `windowStart = lastStrikeAt ?? seasonStart` and `interval = (seasonEnd − windowStart) ÷ (depthCap − currentDepth)` — **remaining-time ÷ remaining-layers**, recomputed each strike so mid-season bonus drills and late joins re-pace automatically (last strike always lands ~buzzer). `strikeFraction` is the hash-derived random placement (engagement engine). Fires when `now ≥ target`; txn re-checks `lastStrikeAt` vs the gated window for idempotency under concurrent ticks. The cell-depth cap moved from the absolute `depthZ` to the per-rig `depthCap`. **Legacy fallback:** no `seasonLengthDays` ⇒ the original once-per-day `hash(userId+date)%1440` cadence (so in-flight test games don't break).
- **Season clock:** `seasonClock(settings)` reads `gameStartDate` + new `seasonLengthDays` (whitelisted in `oil-settings`); `seasonEnd = start + lengthDays·86400000`.
- **Buzzer:** `endSeason()` — at `now ≥ seasonEnd` the tick txn-flips `gamePhase→ended` + `gameEnded:true` (once), sweeps every rig's `tankOil → totalCollected` (auto-bank, idempotent), and publishes the fairness reveal (mirrors `oil-settings` `gameEnded:true`). Revives: a capped rig sets `rigDepleted:true` (not disarmed) so a later bonus raises `depthCap` and it strikes again.
- **Client** (`page.js`): `seasonLengthDays` state from the settings listener; `passiveDepth` re-paced to `round(seasonProgress · PASSIVE_DRILLS)` over the real season length (was flat `floor(days since start)`); admin **SEASON LENGTH** input + live ENDS-date / strike-cadence readout next to START DATE.
- **Depth levers BUILT 2026-06-07** (separate from the clock): social-share (`oil-feed-admin` approve → `+1`/post, sub-cap 3, idempotent) + diamond-hands (`oil-qualify` snapshot → 30/60/90-day milestones, +1 each). Pure math in `lib/oilBonusMath.js` (19 unit tests), credit helper in `lib/oilBonus.js`. See *Depth levers* above.

**Depth levers feeding `bonusDrills` (base 10 → cap 20) — decided 2026-06-07:**

Governing principle: **effort / network / loyalty earns depth (real prize money); token *holdings size* earns status (cosmetics), NEVER depth** — tying payout capacity to stake size breaks the promotional-sweepstakes framing and hands the prize to whales.

All levers feed the shared `bonusDrills` field; `depthCap = min(10 + bonusDrills, 20)`. Pure math + sub-caps live in `src/lib/oilBonusMath.js`; the Firestore credit helper is `creditBonusDrills` in `src/lib/oilBonus.js`.

- **Live (pre-existing):** referrals (`+3`/referral, `oil-claim`) + demon-hunting (`BOUNTY_BONUS_DRILLS`, `oil-demon-bounty`).
- **BUILT 2026-06-07 — social shares:** when an admin **approves** a player's Field Dispatch (Polaroid) post, the poster is credited `+1` (sub-cap `+3`). The approval gate **is** the anti-sybil check (a vetted, shareable moment). Idempotent via a `depthCredited` flag on the `oilFeed` doc. Hook: `oil-feed-admin` `approve` / `approve_all`. *Live-tested end-to-end.*
- **BUILT 2026-06-07 — diamond-hands (LONG-TERM holding):** held continuously qualified for **30 / 60 / 90 days** → `+1` each (sub-cap `+3`). **Absolute days, deliberately longer than a season**, because the per-season qualification floor *already* disqualifies anyone who sells below $20 mid-round — so a within-season holding bonus would be redundant (it'd hand +3 to everyone still playing). The 30-day horizon rewards holding **across** seasons (a fresh $20 buyer clears the floor but isn't a diamond hand). Measured from `qualifiedSince` (set on first qualification, persists across seasons, **reset if the wallet drops below $20**); credited in the `oil-qualify` snapshot via a top-up toward the milestones reached. **Dormant at launch** (nobody has 30 days yet) — kicks in as the project matures. ⚠️ stake-*adjacent* (keys on duration, not bag size) — lawyer it before money scales. Knobs: `HOLDING_MILESTONE_DAYS` in `oilBonusMath.js`.
- **Holdings *size* → cosmetics/status only:** bigger bag earns a fancier rig / exclusive themes / leaderboard flair / extra pump slots / whale badge — buy pressure without selling payout access. (Not depth.)
- **Caps:** every lever is sub-capped (`share` +3, `holding` +3) so no single lever fills the pool and referrals stay primary; the global `MAX_BONUS_DRILLS = 10` clamps the total (10 base + 10 bonus = 20). Tracked per-lever (`bonusFromShares`, `bonusFromHolding`); referrals via `confirmedReferrals`.
- **Anti-sybil:** shares gate on admin approval; diamond-hands gates on a 30-day continuous hold (resets on any sub-$20 dip). **Referral hardening BUILT 2026-06-07:** `oil-claim` no longer credits the referrer at claim time — it records `referredByUserId` + `referralCredited:false` on the referred player's `oilQualified` doc, and the `oil-qualify` snapshot pays the referrer (`+REFERRAL_BONUS`, capped, `confirmedReferrals++`) only once that wallet is confirmed **still qualified**. Kills the buy-$20 → refer → sell → recycle farm. (Pre-existing referrals carry only the legacy `referredBy` *code*, not `referredByUserId`, so they're never re-credited.) **Operational note:** referrals now pay out *on snapshot*, so run the qualification snapshot regularly.
- **Client breakdown (BUILT 2026-06-07):** the bonus panel shows a per-source split — `+N referrals/hunts · +N shares · +N holding` (shares/holding tracked precisely via `bonusFromShares`/`bonusFromHolding`; referrals + demon hunts share one counter, so they're lumped).

**Decided (2026-05-30) — SUPERSEDED by the 2026-06-07 framework above (kept for history):**
- **Strike timing:** the **deterministic-but-unpredictable random reveal time** (`hash(userId + ...)`-derived, lands at any moment, not on the hour) is **KEPT** — it's the engagement engine. Only the *window size* changed: from a fixed once-per-UTC-day gate to a depth-scaled interval (`seasonMs ÷ depthCap`), so the strike still fires at an unguessable time, just inside a window whose width is set by depth.
- ~~**Cadence:** auto-advance, depth = cap. One layer deeper per day automatically.~~ Replaced by fill-the-season pacing so depth ≠ duration.
- **Tank:** **uncapped.** `tankOil` grows freely; dino risk scales with hoarding instead of a cap. *(still current)*

**Implemented (server core — Slice 1):**
- `src/app/api/oil-strike-tick/route.js` — the strike loop. Tick-cadence-agnostic, idempotent (gates on the per-rig **interval target + `lastStrikeAt`**; legacy once-per-day minute-of-day fallback when no `seasonLengthDays` is set), reuses `generateOilDistribution3D` + `getAdminDb` (single source of truth). Pure timing math is extracted to `src/lib/oilStrikeClock.js` (24 unit tests). Manual test: `GET /api/oil-strike-tick?password=<ADMIN_PASSWORD>&force=1` (add `&deep=N`, 1–20, to drill N layers in one call — bypasses the time gate **and** the per-rig depthCap; affects all claimed rigs; Telegram suppressed during deep drills). `&scout=1` returns the richest cells (no writes) so a tester can aim a rig — 0-based `col`/`row`, on-screen `label` (col+1,row+1), and `bestLayer`.
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
- New `drillStatus === "auto-pumping"` for real players: replaces the manual DRILL button with a non-clickable "⛏ RIG PUMPING" indicator + depth bar, the last-strike result (`depth N — struck X` / `dry layer`), and a "can strike at any moment — no telling when" hint (the cadence is the depth-scaled interval; the *timing* is unpredictable). `rigDepleted` falls through to "max-depth".
- Manual drilling is cleanly disabled for real players (drillStatus never "ready" for them, and `handleDailyDrill` already guards on `"ready"`); **admin/test keep the manual DRILL path** for verification.
- **Mobile overlap fix (pre-existing bug):** the mobile 3D tab rendered `DrillHUD` twice — once inside the canvas wrap and once in the control block below — so the gauges crowded/overlapped the drill button. Removed the in-canvas copy; now one `DrillHUD` per layout (mobile control block / desktop side panel), matching desktop.

**Remaining UI polish (optional):**
- A "while you were away" summary toast (uses `lastStrikeAt`/`lastStrikeOil`/`lastStrikeDepth`) — the result is currently surfaced inline in the pump indicator + via the existing 3D strike visual, so this is purely a flourish.

**Decided (2026-05-31):**
- **End-of-season un-banked oil → credited to the player, never lost.** Un-banked `tankOil` belongs to the player; banking *during* the season is optional theft-protection (the dino can take a % of un-banked oil), not a scoring gate. Payout = `totalCollected` + any remaining `tankOil`. No "bank before the buzzer" pressure. **DONE (2026-06-07):** un-banked oil is paid out two ways over — the season buzzer (`endSeason` in `oil-strike-tick`) auto-sweeps every rig's `tankOil → totalCollected` when the phase flips to `ended`, *and* `scripts/oil-payout.js` independently scores `totalCollected + tankOil` (see *Rail A*). So nothing is lost whether the season ends on the buzzer or early via the admin button (which doesn't run the sweep — the payout's summing covers that case).
- **EV-per-player: flat floor, trending up — never declining.** Pot scales at least linearly with participation (per-qualified-wallet sponsor bounty) so EV stays flat as the game grows; as traction attracts bigger sponsorships the pot grows faster than headcount and EV *rises*. Growth always rewards existing players → referrals stay strongly positive-sum.

**Tank meter copy (done 2026-05-31):** relabeled to reflect the uncapped tank — header "TANK · UNBANKED", readout shows raw `{tankOil} USDC` (no `/cap`), and the over-threshold prompt is "TANK HEAVY — BANK SOON" (button) instead of "TANK FULL". `TANK_CAPACITY = 5` now only drives the meter's red "bank soon" threshold, not a storage limit.

**Open decisions:**
- Default substance: oil vs goo vs hybrid (oil baseline + goo jackpot).

## Game Phase Flow

The game progresses through three phases, controlled by `gamePhase` in Firestore:

1. **`ticket_sale`** (Registration + Plot Pick — labeled **"REGISTRATION"** in admin; the
   `ticket_sale` value is a legacy name, the ticket/draft system is gone). Renders `OilQualify`:
   players connect a wallet holding ≥ $20 of RL80 **and** verify they follow **@rl80token** on X,
   then pick a plot on the grid (first come, first served). `oil-register` re-checks the balance
   server-side and is the sole writer of `qualified`. Already-picked players fall through to the 3D canvas.
2. **`active`** — Game running. Continuous auto-pump drilling: each armed rig grinds on its own and
   **strikes at random, unpredictable times**, paced by the fill-the-season clock (avg interval =
   season ÷ depthCap; see *TIMING FRAMEWORK*). Players can claim-jump. A qualified, plot-less player
   can **join mid-season** by selecting an unclaimed cell → **CLAIM THIS PLOT**
   (`handleClaimActivePlot` → `oil-claim`).
3. **`ended`** — Game over (auto-flipped by the strike tick at the season buzzer, or by the admin
   END GAME button). Report mode unlocked. Seed revealed; `/api/oil-verify` returns VERIFIED.

Default is `"active"` for backward compatibility.

## Core Mechanics

> The drilling model below is the **fill-the-season auto-pump** (current). The full timing/depth/
> economy design lives in *Economy & Timing Model* near the top; this is the short version.

### Drilling (auto-pump)
- Rigs drill **automatically** — there is **no manual drill action or per-day budget**. Each armed
  rig grinds continuously and **strikes** (reveals the next layer) at a random, unpredictable time.
- Reachable depth is **`depthCap = min(10 + bonusDrills, 20)`** — base 10 plus earned bonus
  (referrals, demon hunts, social shares, diamond-hands); hard cap 20.
- Strikes are **paced to fill the fixed season** (avg interval = season ÷ depthCap), so more bonus =
  deeper *and* more frequent strikes, and every rig finishes near the buzzer (no idle).
- Most layers are dry **shale**; a "strike" proper is hitting a **deposit**, lump-summed into the tank.
- Cell depth persists across owners (claim-jump to a pre-drilled cell → continue from that depth).
- Admin/test mode keeps a manual DRILL path; real players see the auto-pump indicator.

### Claim Jumping (`oil-claim-jump`)
- Players can move to a different unclaimed plot
- **First 2 jumps are free**
- **3rd jump onwards costs 1 bonus drill** (`bonusDrills − 1`) — it eats into your earned depth cap,
  so frequent jumping trades depth for mobility (and you need a bonus drill available to jump at all)
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
| `revealed` | map | Server-authoritative per-layer oil reveal `{ [layer]: oil }` (client renders from this, never the seed) |
| `hellLayers` | map | `{ [layer]: true }` for hell-pocket layers |
| `lastStrikeAt` | timestamp | Last strike on this cell |

### `oilDrills/{userId}` — Player Stats

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Clerk user.id |
| `col` / `row` | number\|null | Current plot |
| `claimJumpsUsed` | number | Jumps used (first 2 free, then 1 bonus drill each) |
| `totalCollected` | number | **Banked** oil — sacrosanct, scored (OIL units) |
| `tankOil` | number | **Un-banked** oil in the tank (auto-banked at the buzzer) |
| `tankDrains` / `lastDrainExtracted` | number | Banking stats |
| `bonusDrills` | number | Earned depth bonus (global cap `MAX_BONUS_DRILLS = 10`) → `depthCap = min(10 + bonusDrills, 20)` |
| `confirmedReferrals` | number | Referrals credited (at a qualification snapshot) |
| `bonusFromShares` | number | Bonus from approved feed posts (sub-cap 3) |
| `bonusFromHolding` | number | Bonus from diamond-hands milestones (sub-cap 3) |
| `referralCode` | string | This player's shareable referral code |
| `armed` / `rigDepleted` | boolean | Strike-loop state (armed pumps; depleted = reached `depthCap`) |
| `lastStrikeAt` | timestamp | Last strike time — opens the next interval window |
| `lastStrikeOil` / `lastStrikeDepth` / `lastStrikeHell` | number/number/bool | Last strike result |
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
| `qualifiedSince` | number\|null | ms of first continuous qualification (diamond-hands clock; reset on a sub-$20 dip) |
| `referredBy` | string\|null | Referral *code* used at registration (admin display) |
| `referredByUserId` | string\|null | Resolved referrer userId — pending referral credit |
| `referralCredited` | boolean | True once the referrer has been paid (at a snapshot); blocks double-credit |

### `oilGame/settings` — Game Config (selected fields)

| Field | Type | Description |
|-------|------|-------------|
| `gamePhase` | string | `ticket_sale` / `active` / `ended` |
| `gameStartDate` | string | Season start "YYYY-MM-DD" (with `seasonLengthDays` → the season clock) |
| `seasonLengthDays` | number | Fixed season length (default 10); enables the fill-the-season strike pacing |
| `seasonEndedAt` | timestamp | Set when the buzzer auto-ends the season |
| `seedCommitment` / `seedReveal` | string | Provable-fairness commit / post-game reveal |

### `pumpConfigs/{userId_col_row}` — Pump Customization
No schema change. Stores pump visual config per cell.

## Routes

> The game lives at `/hailmary` (renamed from `/oil`, 2026-06-07). `/oil` 308-redirects there with query strings preserved, so old links keep working.

### `/hailmary` — Active Game (Player View)
The default player-facing view during an active game. During `ticket_sale` phase, shows OilQualify if the user hasn't picked a plot yet; falls through to the 3D canvas if they have.

**Visible:** 3D canvas with pumpjacks and CCTV, surface map (2D grid with ownership coloring), cross-section, geological survey, Pimp My Pump customization, claim jump toggle.

### `/hailmary?mode=admin` — Admin Controls
Password-gated. Everything from Active Game plus parameters, drill demo, inspector, top claims, dry zones, deposits, verify panel, end game button, phase overrides.

### `/hailmary?mode=test` — Test Mode
No sign-in required. Simulate the player drill experience for any cell.

### `/hailmary?mode=report` — Post-Game Report
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
  SHA-256 **commitment** (`seedCommitment`); the secret (`seedReveal`) is published at game
  end for verification. `/api/oil-settings` POST stores the seed + commitment and purges any
  legacy public `blockHash`; an admin-only GET returns the seed for the live inspector.
- **Future-block anchor (provable fairness — 2026-06-04).** Commit-reveal alone stops the
  house changing the seed *after* commit, but not from *grinding* one before. The seed is
  now anchored to a **future Base block hash** the operator can't predict: `finalSeed =
  SHA256(serverSecret : anchorBlockHash)`. Flow (`/api/oil-fairness`, admin):
  `commit` (random `serverSecret`, publish `seedCommitment` + a future `anchorBlock`) →
  `anchor` (once mined, fetch the block hash, derive + store `finalSeed`; strike-tick reads
  it) → `reveal` (publish `serverSecret` at game end; also auto-fires on `gameEnded:true`).
  `lib/oilFairness.js` holds the pure helpers (`computeCommitment` / `computeFinalSeed` /
  `verifyRevealedField`). **`/api/oil-verify`** is public/no-auth: it re-fetches the anchor
  block from Base, recomputes the commitment + finalSeed + entire field, and checks every
  drilled `oilPlots.revealed` cell — returning `{phase, verdict, checks}`. It handles both
  the future-block scheme and the legacy direct-seed scheme.
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

The field is generated at a fixed internal resolution — `OIL_FIELD_UNITS` (500,000
as of 2026-06-07; was 1,000,000) in `oilDistribution.js` — **not** the dollar prize.
At a low total, scaling+rounding wiped out each deposit blob's edges and collapsed the
distribution to its cores (one composite band, "0.0k" cells) — that collapse happened
at the **~$500 prize scale**, so 500K still has ample resolution. Every
`generateOilDistribution3D` caller now passes `OIL_FIELD_UNITS` (client
`useClaimStats`/`OilVoxelGrid`, server strike-tick/backfill, verify) **and**
`depthBias: 0.35` so client and server produce the *same* field. Oil is a **score in
field units** converted to dollars at the fixed rate `pot ÷ OIL_FIELD_UNITS` (see
*Prize pool — oil has a fixed value*). Player oil readouts (cells, tank, EXTRACTED,
leaderboard) read in OIL units; `TANK_CAPACITY` is rescaled with the field (500K → 2,500).

**Economy pass (done 2026-06-04):** all player + inspector oil readouts now read
in OIL units (only PRIZE POOL + demon bounties stay USDC); `depthBias` is the single
`OIL_DEPTH_BIAS` constant in `oilDistribution.js` — every live caller uses the
default (the dead `OilHeatmap2D` still has a literal but isn't imported).

**Done (2026-06-04):** `oilPlots`/`oilDrills`/`oilQualified` are locked to server-only writes
(all writers go through admin-SDK endpoints). The verify UI is reconciled to the new model:
- **`OilVerifyExplainer`** ("VERIFY THE MAP", player-facing) explains commit → future-block
  anchor → reveal, and its "RUN VERIFICATION" button calls `/api/oil-verify`, shows the
  phase/verdict + per-check results, and (post-reveal) regenerates the field in-browser from
  the revealed `finalSeed` and re-confirms the anchor hash from Base directly.
- **`OilVerifyPanel`** (admin) is now the fairness console: COMMIT / ANCHOR / REVEAL buttons
  driving `/api/oil-fairness`, with live status from `/api/oil-verify`.

## Security Model & Firestore Rules (integrity hardening — 2026-06-05)

Prize money is on the line, so every money-or-ownership-critical write is server-only and
every secret is private. Three layers:

### 1. Auth on every mutation
- **Player mutations** (`oil-claim`, `oil-claim-jump`, `oil-release`, `oil-transfer`,
  `oil-profile`, `oil-register`, `oil-tank-drain`, `oil-demon-bounty`, `oil-ticket`, `oil-message`) derive the
  acting user from the **verified Clerk session token** via `authedUserId(req)`
  (`lib/oilAuth.js`): `Authorization: Bearer <token>` → `verifyToken({secretKey:
  CLERK_SECRET_KEY})` → `payload.sub`. **A userId is NEVER trusted from the request body.** The
  client attaches the token via `useOilApiFetch()` (`lib/oilApiClient.js`).
- **Admin actions** (`oil-settings`, `oil-fairness`, `oil-admin-reset`, `oil-admin-claim`,
  `oil-strike-tick` force/scout, `oil-seed-test`, `oil-rogue`, `oil-backfill-revealed`,
  `oil-qualify` POST) are gated on `process.env.ADMIN_PASSWORD` **only** — never a
  `NEXT_PUBLIC_*` fallback (that var is inlined into the client bundle). Cron routes
  (`oil-strike-tick`, `cron/update-followers`) accept `Bearer ${CRON_SECRET}`.
- **Qualification is server-verified:** `qualified` is written ONLY by `/api/oil-register`
  (re-reads the on-chain RL80 balance, requires ≥ $20) and the admin snapshot. `oil-claim`
  refuses unless `oilQualified.qualified === true`. The client cannot self-qualify.

### 2. Firestore rules are deny-by-default
**Firestore evaluates rules additively (OR) — there is no deny-override.** A permissive
`match /{document=**} { allow read: if true }` therefore silently OVERRODE every
`read: if false`, leaking `config/x_oauth` (X OAuth refresh + access tokens), `oilSecret/seed`
(the distribution seed), `chatReports`, and `testimonialRateLimits`. Fixed:
- Catch-all is now `read: if false; write: if false`.
- Public-read collections are granted `read: if true` **explicitly**, per collection.
- Money-critical collections (`oilPlots`, `oilDrills`, `oilQualified`, `oilGame`,
  `oilReferrals`) are `write: if false` — server-only.
- Secrets (`oilSecret` seed, `config` OAuth tokens) are `read: if false; write: if false`.
- **Lesson:** never rely on a specific `read:false` to "beat" a broad catch-all; deny by
  default and grant reads explicitly. (A REST `GET .../documents/<path>` is the quickest way
  to verify a lockdown actually took effect after `firebase deploy --only firestore:rules`.)

### 3. Server routes use the Admin SDK
Routes touching private collections use `getAdminDb()` (firebase-admin, **bypasses rules**),
not the client SDK. The X-OAuth routes (`check-follow`, `cron/update-followers`,
`auth/x/callback`) were converted to the Admin SDK so `config/x_oauth` can stay private.
Note: `lib/firebaseServer.js` is the **client** SDK (subject to rules) — don't use it for
privileged reads in API routes.

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

## Plot Messaging

Per-plot chat so players can negotiate trades / plot buys (or just say "Sick rig!").
Rendered by `OilPlotChat` (sidebar accordion) and `OilChatModal` (popup); both share the
same model and back end. The plot owner can also publish **social links** (`telegramHandle`
/ `xHandle` on their `oilDrills` doc, edited via `/api/oil-profile`) which surface as
clickable TG/X links in the panel, plus a **Transfer Plot** action (`/api/oil-transfer`).

### Threading
A conversation is keyed by `plotKey` + `threadUserId`, where `threadUserId` is always the
**non-owner participant**:
- A **visitor** sees only their own thread with the owner and writes into it
  (`threadUserId == their id`).
- The **owner** sees *all* threads on their plot, grouped by sender, and replies per-thread.

### Server-authoritative writes (security)
Money + identity are on the line, so this follows the same model as every other mutation:
the collection is **read-public but server-only for writes**, and all mutations go through
`POST` / `DELETE /api/oil-message` (Clerk-authed via `authedUserId`). Specifically:
- **No identity spoofing.** `fromUserId` is taken from the verified Clerk session, never the
  body; `fromUsername` is resolved server-side (`oilDrills.username` → `oilQualified.clerkName`
  → `"anon"`). The thread is enforced — a visitor can only write into their own thread; an
  owner can only reply into a real participant's thread.
- **Players only.** The sender must have `oilQualified.qualified === true` (the same flag
  `oil-claim` gates on) — a signed-in non-player, or someone disqualified, gets `403`. The
  client mirrors this with an `isPlayer={!!userDrill}` prop (shows "Only players can message"
  instead of an input); the prop is a proxy, the route is the real gate.
- **Moderated deletes.** Only the message **author** or the **plot owner** can delete a message.
- There is **no send cooldown** — the token/qualification gate is the spam throttle (a fixed
  per-message timer added friction for real conversation while being trivially bypassable
  client-side, so it was removed).

When the selected plot is **unclaimed**, the panel shows "no owner to message yet" and, for an
eligible player, a **CLAIM JUMP HERE** button (wired to `handleClaimJump` via the page's
`buildClaimJumpOption` helper, mirroring the CLAIM JUMP toggle's gating + cost note).

### Firestore
| Collection | Purpose |
|------------|---------|
| `oilPlotMessages/{msgId}` | `plotKey`, `fromUserId`, `fromUsername`, `threadUserId`, `text` (≤200), `timestamp`. Read-public; `create/update/delete: if false` (server-only). |

Three composite indexes back the listeners (in `firestore.indexes.json`):
`plotKey+timestamp` (owner thread view), `plotKey+threadUserId+timestamp` (visitor thread),
and `threadUserId+timestamp` (the page's cross-plot unread-message dots).

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
| `src/app/hailmary/page.js` | Main game page — drill handler, community grid, drill HUD, core sample, Telegram shake delay |
| `src/components/CoreSamplePanel.jsx` | Core sample panel — personal drill log + field survey with animation |
| `src/components/DrillHUD.jsx` | Instrument gauges — phased drill animation, area scan |
| `src/components/OilVoxelGrid.jsx` | 3D scene — pumpjacks, staged drill effects, delayed strike reveal |
| `src/components/OilSurfaceMap.jsx` | 2D grid — ownership coloring, claim-jump mode |
| `src/components/OilQualify.jsx` | Registration + plot picking |
| `src/components/UnifiedAccountModal.jsx` | Account/Wallet/Assets tabs |
| `src/components/PimpMyPumpPanel.jsx` | Pump customization + premium item shop |
| `src/components/OilPlotChat.jsx` | Plot messaging — sidebar accordion (threads, social links, transfer, claim-jump offer) |
| `src/components/OilChatModal.jsx` | Plot messaging — popup variant of the same chat |
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
| `src/app/api/oil-message/route.js` | Plot messaging — server-authoritative create/delete (players-only, thread-enforced) |

## Rogue Characters System

Animated characters that roam the grid and cause mischief. Deployed by admin or automatically on a schedule. Trigger Telegram security alerts for camera-equipped plots.

### How It Works (Current)

1. Admin opens Rogue Deploy panel in `/hailmary?mode=admin`
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

1. A player drills a cell whose column contains a hell pocket → `/hailmary` POSTs to
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

After the game ends (`gamePhase = "ended"`), players are paid out in USDC on Base.
Both rails below pay the **same fixed-rate amount** the UI shows —
`payout = (banked + tank) × pot ÷ OIL_FIELD_UNITS` (the cross-scale guard in
`buildPayoutList` aborts if total oil > field, i.e. data left over from a different
scale; reset first via `scripts/oil-reset.js`).

### Which rail to use — staged by scale

A payout contract makes **settlement** verifiable, not **scoring** (scores live
off-chain in Firestore regardless), so it's not needed day one. Stage it:

| Stage | Rail | Why |
|-------|------|-----|
| **Launch (handful of players, bootstrapped)** | **Off-chain push** — `scripts/oil-payout.js` | Done, simplest. The "operator could just not pay" trust gap is identical to a push-from-contract, so a contract adds little. |
| **Cheap interim trust** | Hold the pot in a public address / multisig | Most of the escrow-trust benefit, zero contract code. |
| **Scale (dozens+ players, or want non-custodial credibility)** | **Merkle distributor** — `OilPayoutDistributor.sol` + `scripts/oil-build-merkle.js` | Visible escrow, players self-claim (they pay gas), no hot-wallet key risk during distribution, on-chain record. |

Do **not** put scoring on-chain — gas-per-drill on a 24/7 game is a huge
re-architecture that doesn't remove the real (server) trust dependency. Provable
fairness (commit-reveal seed) already covers field verifiability.

### Rail A — off-chain push: `scripts/oil-payout.js`

Reads `oilDrills` (score = `totalCollected + tankOil`, in **OIL units**) + `oilQualified`
(`walletAddress`) + `oilGame/settings` (pot), computes `score × pot/OIL_FIELD_UNITS`,
and sends USDC transfers sequentially.

```bash
node scripts/oil-payout.js --dry-run   # preview manifest, no transfers
node scripts/oil-payout.js             # execute (prompts to confirm)
```

- Manifest table + USDC balance check before sending; total is bounded by the pot.
- Resume support: writes `scripts/payout-results.json` after each tx — re-running skips paid wallets.
- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals).
- **Env:** `BASE_RPC_URL`, `PAYOUT_PRIVATE_KEY`.

### Rail B — on-chain Merkle distributor (scaffold)

`contracts/src/OilPayoutDistributor.sol` — pull-payment USDC distributor. Operator
publishes a Merkle root + funds the contract; players `claim(amount, proof)`;
operator `sweep()`s the unclaimed remainder after `claimDeadline` (the on-chain form
of "operator keeps unfound/unclaimed oil"). Leaf =
`keccak256(keccak256(abi.encode(account, amount)))`, sorted-pair nodes (OZ
StandardMerkleTree compatible).

```bash
node scripts/oil-build-merkle.js   # reuses oil-payout's math → scripts/oil-merkle.json
```

Deploy flow:
1. `node scripts/oil-build-merkle.js` → `oil-merkle.json` (prints `merkleRoot`, `totalUsdc`).
2. Deploy `OilPayoutDistributor(USDC, merkleRoot, claimDeadline, owner)`.
3. Transfer `totalAmount` USDC into the deployed contract (escrow).
4. Publish `oil-merkle.json`; players look up their `{ amount, proof }` and call `claim()`.

Built on **OpenZeppelin 5.6.1** — `SafeERC20`, `MerkleProof.verifyCalldata`, `Ownable`,
`ReentrancyGuard` (no more inlined primitives). OZ is vendored into `contracts/lib`
(gitignored); reinstall with the `git clone` in `foundry.toml` if missing.

**Build & test (Foundry):** `foundry.toml` is scoped (`src = contracts/src`, sibling to
`contracts/lib`) so it never collides with the Next.js `src/`. The test itself stays
dependency-free (inline cheatcode interface + mock USDC — no forge-std needed).

```bash
forge test --match-path 'contracts/test/*' -vv
```

`contracts/test/OilPayoutDistributor.t.sol` covers: happy-path claim, double-claim
revert, bad-proof / wrong-amount / wrong-claimant reverts, sweep-before-deadline and
non-owner reverts, and post-deadline sweep of the remainder. `test_RootMatchesJsBuilder`
pins the Solidity-built Merkle root to the JS builder's root for identical input, so
`oil-build-merkle.js` and the contract provably agree on leaf/proof encoding (9 tests,
all passing).

**Static analysis:** Slither (101 detectors, OZ lib + tests filtered out) reports a
single low-severity informational — `block.timestamp` used in the `sweep` deadline
check. Benign: the deadline is days/weeks long and `sweep` is owner-only, so a few
seconds of miner timestamp drift grants nothing. No reentrancy / arbitrary-send /
unchecked-transfer / access-control findings.

```bash
slither . --filter-paths "contracts/lib|contracts/test"
```

> **Audit is stake-gated, not a launch blocker.** A formal audit isn't cost-justified
> for a small (~$500) escrow — the contract is small, standard (OZ primitives), passes
> the suite above, and is Slither-clean bar the benign timestamp note. A bug can only
> ever lose what you funded (max loss ≈ escrow), so a $10k+ audit to protect $500 is
> upside-down. Mitigate cheaply: short claim window + low escrow, fresh deploy address,
> dry-run on Base Sepolia first. Commission a real audit only once per-season escrow is
> large enough that an exploit would hurt — the same threshold at which you'd reach for
> this on-chain rail at all (below it, use Rail A). At that point also revisit the
> "lottery optics" legal question with a lawyer.

## Environment Variables

All server-only secrets must be in Firebase **App Hosting** (Secret Manager + `apphosting.yaml`),
not just `.env.local`. NEVER give a server secret a `NEXT_PUBLIC_*` twin (it would ship in the
client bundle).

| Variable | Description |
|----------|-------------|
| `CLERK_SECRET_KEY` | Verifies player session tokens (`authedUserId`). Server-only. |
| `ADMIN_PASSWORD` | Gates all admin endpoints. Server-only; never `NEXT_PUBLIC_*`. |
| `CRON_SECRET` | Bearer secret for cron routes (`oil-strike-tick`, `update-followers`). |
| `NEXT_PUBLIC_CDP_CLIENT_API_KEY` | Coinbase CDP key — Base RPC lane (`viemClient`, and `BASE_RPC_URL` fallback). |
| `BASE_RPC_URL` | Optional Base RPC override. If unset, built from the CDP key (`lib/baseRpcUrl.js`). |
| `OIL_PURCHASE_TREASURY` | `0x` Base address receiving x402 premium-item payments. |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | Validates Telegram's `X-Telegram-Bot-Api-Secret-Token` on the webhook (fail-closed). |
| `NEXT_PUBLIC_TELEGRAM_BOT_NAME` | Telegram bot username for deeplinks. |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X (Twitter) OAuth app for the follow-check token (`config/x_oauth`). |
| `PAYOUT_PRIVATE_KEY` | Private key of wallet holding USDC (post-game payout script). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path/JSON for the firebase-admin service account (Admin SDK). |

**Removed:** `OIL_TICKET_WALLET` / `NEXT_PUBLIC_OIL_TICKET_WALLET` — the ticket/draft system was
deleted (registration + plot-pick is now `OilQualify`; mid-season join is "CLAIM THIS PLOT").
*