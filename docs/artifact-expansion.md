# Artifact Expansion — "The Substrate"

*Design doc, drafted 2026-07-06. Companion to [oil-game.md](oil-game.md).*

Extends the LYQUID80 QUEST drilling game with buried non-oil discoveries (dino DNA,
cursed burial grounds, treasure caches) so the ~60% of players who never strike oil
still have a game to win across a 7–10 day season. Additive only: the oil economy,
payout math, and commit-reveal fairness scheme are untouched.

---

## 1. Problem statement

The engine is strong — provably-fair seeded world gen, strike pacing that guarantees
every rig finishes by the buzzer, tank-banking risk, demon bounties, the away-recap.
But retention for non-strikers is structurally broken:

- **A dry-plot player's season is ~10–20 silent non-events.** Strikes land 1–2×/day;
  dry strikes deliberately send no push (only a "🪨 dry layer" Telegram line). Nothing
  to bank, no reason to open the app.
- **The action layer is thin even for winners**: bank the tank, claim-jump (2 free),
  hunt a demon if one spawns. Most days have no decision to make.
- **The away-recap salts losers**: a dry player's recap shows other people's gushers
  and their own nothing.
- **Progression is one currency (oil → USDC)** and ~60% of players end at ~$0. There
  is no second axis where they can be winning.

### Why the architecture is ready for this

- Hell pockets already use a **separate RNG stream** from the committed seed so they
  don't displace oil (`src/lib/oilDistribution.js`). Artifacts follow the same pattern.
- Plots already carry generalized per-layer reveal maps (`revealed`, `hellLayers` on
  `oilPlots`) — `revealedArtifacts` is a sibling, not a schema rework.
- The timeline is typed (`strike | gusher | motherlode | hell | contain | claim |
  rogue | system`) — new event types are additive.
- Per [oil-game.md](oil-game.md), the engine is deliberately resource-agnostic with a
  theming layer. New buried entities touch exactly four points:
  **generation → strike-tick detection → reveal map → render/feed**.

---

## 2. Market research: Shovel Up! & Miner Tycoon (Meta Horizon)

Top-charting Horizon titles as of mid-2026 (Shovel Up! reportedly #1, Miner Tycoon #3
— chart positions unverifiable from public web; Horizon in-app charts aren't
published). Both are free-to-play dig/mine loops on Quest + the Horizon mobile app.
Sources at the end of this section.

### Shovel Up! (BigBox Studio / Meta-owned; June 2025)

Core loop: roam an island → glowing dig spots color-coded by rarity → tap-dig
minigame with a fill meter ("perfect digs" bonus) → item pops with a weight stat →
sell → upgrade shovels/backpack → repeat. Sessions are chunked around completing
"regions" (5–15 catalog items each) and NPC fetch-quests.

Retention machinery:
- **Catalog/collection system** — completing a region pays a gem lump sum and gates
  travel (2 completed regions to board the ferry; 20 for the endgame island).
- **Visible ratcheting pity odds** — the rare item's drop % is displayed and climbs
  with every repeated dig at a spot (observed 20% → 33% → 95% with potions). Players
  can always see themselves getting closer; quitting mid-streak feels like leaving
  money buried.
- **Tools expand the loot table, not just the numbers** — the Pizza Shovel "unlocks
  5 new Italian items" that cannot otherwise drop, forcing joyful re-farming of
  completed regions. Shovels evolve with dramatic visual transformations at star
  thresholds (10/15/25/30).
- **Luck potions** as a consumable soft-currency economy (bulk-buying them is itself
  a rarity pull).
- **Minutes-scale FOMO events** — a ghost ship/UFO "materializes" for ~4 minutes with
  exclusive catalog items and big payouts.
- **Daily login rewards, repeatable task board, per-item KG personal-best trophies.**
- **No fail state**: every dig yields something sellable; duplicates feed gem streaks
  and KG-record chances.

Social: up to 9 players per instance, shared-world co-presence; the real social layer
is out-of-game rare-item knowledge trading (Discord/Facebook threads hunting the
"divine shovel"). No evidence of real-money IAP inside the game itself (inference:
it's Meta's engagement flagship for the mobile app).

### Miner Tycoon (Creators Corp; June 2025)

Core loop (per Meta's own Creator Program retention analysis): buy a pickaxe → enter
that pickaxe's zone → mining **auto-plays** ("kind of like an idle miner") but
**tapping accelerates it** → node shrinks, pops an item instantly with SFX/VFX →
coins accrue → upgrade without leaving the mine. A soft energy cap bounces you to a
tavern hub where energy refills "rather fast" — a pacing valve that forces exposure
to shop/quest surfaces, never a paywall.

Retention machinery:
- **Collection Book with item leveling** — every duplicate levels that item,
  permanently raising its coin yield. Duplicates are never trash. Book pages pay gems
  at milestones.
- **Pickaxe-per-zone gating** — buying the next tool *is* buying the next biome;
  old zones stay farmable.
- **Rebirth/prestige** (added Feb 2026) plus an endgame "Void" cave with infinitely
  leveling rocks and a combo system rewarding active play.
- **Chained quest NPC** — completing a quest immediately hands you the next; never a
  "now what?" moment.
- **Critters** — purchasable pets that earn coin while offline.
- **Dual leaderboards** — all-time + monthly-resettable, so everyone periodically has
  a real shot at #1.
- **Seasonal limited-time caves** every 6–10 weeks (fall/winter/Valentine's), each
  with 20+ collectibles and themed cosmetics.
- Monetization: free-to-play; premium gems buy cosmetics, pickaxes, luck powerups.

Meta's stated #1 retention driver: **instant-reward feedback density** — reward
latency of seconds, every cycle.

### The 8 transferable mechanics (ranked by fit for us)

1. **No fail state — every strike yields something** (→ artifacts live in dry cells).
2. **Collection catalog as progression spine** (→ the Museum, fragment sets).
3. **Visible ratcheting odds** (→ seismic reading meter).
4. **Two-currency split**: abundant grind currency for breadth, scarce currency for
   depth (→ oil/USDC vs. Museum points).
5. **Dual leaderboards** (→ Barons board + Curators board).
6. **Minutes-scale FOMO events** (→ seismic anomaly).
7. **Idle-with-active-accelerator + instant feedback** (→ daily field scan).
8. **Evolution spectacle at milestones** (→ specimen-assembly ceremony).

Sources: [Meta Quest Blog — Shovel Up!](https://www.meta.com/blog/shovel-up-horizon/)
· [Meta dev blog — Shovel Up! remixable case study](https://developers.meta.com/horizon/blog/worlds/shovel-up-goes-remixable-best-practices-for-world-builders/)
· [Shovel Up! world page](https://horizon.meta.com/world/733399513180174/)
· [Miner Tycoon world page](https://horizon.meta.com/world/10228047432947262/)
· [Meta Horizon Creator Program — "How 4 Top Worlds Create Player Retention" (Miner Tycoon analysis ~28:54)](https://www.youtube.com/watch?v=-ijOOVDl8lQ)
· Gameplay: [Shovel Up! shovel upgrades](https://www.youtube.com/watch?v=Tp9htXRBSS0),
[Miner Tycoon max pickaxe](https://www.youtube.com/watch?v=VN455iujYmE)

Unverified: exact chart positions; Shovel Up! IAP absence; Reddit/store review
sentiment (not crawlable).

---

## 3. Design: The Substrate

### The core inversion

**Seed artifacts preferentially into dry (SHALE) cells.** Oil-rich plots stay oil
plots; dry plots become dig sites. The 60% aren't losers — they're playing the other
game board, and they discover this gradually ("no Lumerol… but what IS that?").

Placement is **guarantee-based, not dynamic pity**: every plot column gets ≥K
artifacts across its 20 layers, biased toward dry cells, all determined by the
committed seed. This keeps commit-reveal provably fair — publish artifact counts at
anchor time alongside the seed commitment. (Dynamic pity would require post-anchor
world mutation and break the fairness story.)

### Three artifact veins

| Vein | Mechanic it imports | Shape |
|------|--------------------|-------|
| **Dino DNA** (amber fragments) | Collection + evolution spectacle | Amber shards drop as fragments of specific specimens; 6 shards = one saurian sequenced. Completion = full-field feed event, a polaroid-worthy 3D ceremony (holographic skeleton assembling over the rig — fits the Liminal Terminal aesthetic), and a `creditBonusDrills` payout — which also clears `rigDepleted`, so collecting literally revives drilling. |
| **Cursed burial ground** | Risk/drama; composes with demons | Disturbing a burial layer applies a curse — a hell-pocket variant that **spreads to an adjacent plot after 24h unless cleansed**. Cleansing is a bounty-style social action (any player can perform it, small reward). Dry-plot players become the field's drama generators. |
| **Treasure** (outlaw cache) | Cross-plot social play | Map fragments drop across *different players'* plots; assembling the map requires trading intel in plot chat; the X marks one specific field cell. Finder splits the cache (small USDC from the community pool — same precedent as the $5 demon bounty) with fragment holders. Makes plot chat load-bearing. |

### Supporting systems

- **Museum points + Curators leaderboard.** Artifacts score a parallel leaderboard
  with its own small prize or cosmetic trophy. Oil stays the USDC game; the Museum is
  the game the 60% can win. Two-currency split + dual leaderboards in one move.
- **Seismic reading (visible ratcheting odds).** Core Sample panel gains a line —
  "ARTIFACT SIGNATURE: 62%" — that climbs as the player's remaining undrilled layers
  close in on their seeded, guaranteed artifacts. Deterministic under the hood;
  feels like pity ratcheting on the surface.
- **Daily field scan (the active beat).** One free manual action per day: scan any
  undrilled layer of your own plot for a fuzzy hint ("organic signature" /
  "metallic" / "…something else"). The idle game still runs itself; this gives a
  reason to open the app on strike-less days, with instant feedback.
- **Seismic anomaly (minutes-scale event).** Once or twice mid-season, one random
  *unclaimed* cell glows on the survey map for ~15 minutes; anyone can scan it; first
  scanner wins an exclusive artifact. Push-notification-justified; the whole field
  shows up at once.
- **Dry strikes stop being silent.** An artifact find pushes. A truly-empty layer at
  least advances the seismic reading visibly.
- **Away-recap additions**: artifact finds, set progress, curse warnings — so a dry
  player's recap has *their* progress in it, not just others' gushers.

### 10-day season arc

- **Days 1–2** — claims + first scans; first amber shards surface.
- **Days 3–7** — fragments accumulate; first curse triggers and spreads (drama
  spike); seismic anomaly #1.
- **Days 8–9** — treasure maps complete; race to the X.
- **Day 10** — buzzer, seed reveal, **two podiums: Barons (oil) and Curators
  (Museum)**.

---

## 4. Implementation plan

In dependency order. Phases 1–2 are the fairness-sensitive part and are small;
phase 3 is the bulk of the work. Nothing touches oil payout math.

### Phase 1 — Generation (`src/lib/artifactDistribution.js`, new)

- Separate seeded streams per vein, hell-pocket pattern:
  `createRNG(blockHash + "_amber")`, `"_curse"`, `"_cache"`.
- Guarantee-based placement: every column ≥K artifacts across `depthZ` layers,
  biased toward cells where the oil grid is 0 (SHALE); never co-located with hell
  pockets; never at surface (z ≥ 2, matching hell rules).
- Set/fragment definitions (specimen tables, map fragment counts) live here too.
- Pure + deterministic → unit-testable against a fixed seed.

### Phase 2 — Strike loop (`src/app/api/oil-strike-tick/route.js`)

- On strike, read artifact maps alongside the oil grid.
- Write `oilPlots.revealedArtifacts[layerIndex] = {vein, itemId}` (sibling of
  `revealed` / `hellLayers`).
- Credit an `artifacts` inventory map on `oilDrills` (itemId → count; duplicates
  level the item, Miner Tycoon-style, feeding Museum points).
- New timeline types: `artifact_find`, `set_complete`, `curse`, `cleanse`,
  `cache_found`, `anomaly`.
- Artifact finds trigger push (reuse `oilAlerts.js` paths); curse spread runs inside
  the existing 5-min tick.

### Phase 3 — UI

- **CoreSamplePanel**: legend rows for artifact cell types; seismic reading meter.
- **OilVoxelGrid**: voxel treatment for artifact cells — reuse `IRID_PRESETS`
  (amber/bone/gold variants); specimen-assembly ceremony FX (gusher-tier moment,
  polaroid-eligible).
- **Museum panel**: collection book — sets, fragments, per-item levels, Curators
  leaderboard.
- **Away-recap** (`OilAwayRecap.jsx`): artifact finds, set progress, curse warnings.
- **Feed** (`/hailmary/feed`): render new timeline types.
- **Survey map**: anomaly glow state.

### Phase 4 — Economy & API

- Daily field-scan endpoint (idempotent per user per day).
- Curse-cleanse action (bounty-style; small reward from community pool).
- Set-completion rewards via existing `creditBonusDrills`.
- Cache payout: community-pool USDC split (demon-bounty precedent, capped).
- Curators leaderboard query + season-end podium.
- Anomaly scheduler (admin-triggered or tick-driven).

### Fairness notes

- All placement derives from the committed seed; artifact totals are publishable at
  anchor time.
- The timeline's no-coordinates rule still applies: `artifact_find` events log WHO +
  WHAT, never WHERE (prevents treasure-mapping the field — except the treasure vein,
  where mapping the field is the point and fragments are the authorization).
- Curse spread targets derive from a seeded stream, not admin choice.

### Reveal experience — the Concretion (decided 2026-07-07; modal BUILT, FX roadmap below)

The reveal is a separate dopamine beat from the find: occlusion → anticipation →
identification → celebration. The drill never surfaces a clean artifact — it
surfaces an **encasement** the player must open by hand (3–4 taps in a modal).
The push notification hooks ("the drill hit something else…") but never spoils.
This is the dry-plot player's only guaranteed *active* moment — protect it.

**Type-differentiated encasements** — the silhouette telegraphs the vein, never
the item (anticipation starts before the first tap):

| Vein | Encasement | Interaction | Emotional signature |
|------|-----------|-------------|---------------------|
| Amber | Mineral concretion (nature made it) | Chip — crust flakes, glow bleeds through cracks | Delight |
| Relic | Burial bundle — wrapped, tied (someone *interred* this) | Unwrap — cursed looks identical until the last fold | Held breath |
| Map | Rusted tin / stoppered bottle (an outlaw stashed it) | Pry — the paper tears, hence fragments | Intrigue |
| Cache | Iron strongbox — the game's one true "chest" | Unlock — lock plate, pry-bar taps, lid moment | Season highlight |

Art rule: every encasement looks **excavated** — dirt-crusted, oxidized, wrong-
colored under the violet field light. Archaeological, never loot-box, even though
mechanically it scratches the same itch.

Component: `src/components/ConcretionModal.jsx`. Trigger: `oilDrills.lastStrikeArtifact`
+ `lastStrikeAt` newer than the locally stored last-opened timestamp (fires only
for finds credited to THIS player — claim-jumping onto a pre-dug plot never pops
someone else's finds). Cursed relics glitch on the final fold (static frame,
inverted name, brief sky-dim).

**FX roadmap (not built):** violet light-shaft on the field via a `gusherEvents`
artifact tier (red for cursed); set-completion **constellation** — the sequenced
saurian joins the starry sky for the season, finder credited; the **Assayer**
(delayed amber appraisal, ~2h, push on report); cache = field-wide push + gold
shaft + auto-polaroid; cursed CCTV Telegram snapshot "something moved at your rig."

### Naming note

Per the existing convention (keep internal `oil` naming; theme at the display
layer): internals use `artifact`/`vein`/`amber`/`curse`/`cache`; player-facing names
(and the LYQUID80 → Lumerol rename, if adopted) live in the display strings only.
