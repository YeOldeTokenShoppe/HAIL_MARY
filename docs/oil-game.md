# Oil Prospector

A 3D oil exploration game where players claim land on a fixed 10x10 grid and drill for $500 USDC hidden in procedurally generated underground deposits.

## Economy & Timing Model (Proposed)

> **Status: BUILT (2026-06-07).** The pacing/depth model, the uncapped local tank, the depth levers, and the fixed-rate prize economics in this section are implemented and tested — see *TIMING FRAMEWORK* and *Depth levers* below for specifics and file pointers. Older descriptive sections (Core Mechanics, Game Phase Flow, Data Model) have been reconciled to match. **Still proposal-only:** the *contested-capture* theft rework in **Rogue Characters → Consequences v2** — the dino still takes un-banked tank oil today.

## v2 LOOP — EXTRACT OR PASS (decided 2026-08-23 · NOT BUILT)

> **Status: DESIGN, decided with Michelle 2026-08-23 — supersedes "Local tank & banking" and the "milk-vs-gamble" line of the current loop. Nothing below is implemented yet; see *What changes* for the build list.**

### Why

The current loop is passive: the rig drills to its cap on its own, and the player's only verb is BANK. The one decision the design promised — "keep drilling deeper or not" — doesn't exist in code (`drillStatus` is always `auto-pumping` for real players), and it couldn't work anyway: with free, instant banking, a player who wants to play **never** stops pumping and banks often. A hold/stop control would be dead.

So the tension moves to three places where it's real:

1. **What to take** — a layer, once revealed, is a decision: spend a charge on it or let it go.
2. **Where to take it from** — passed layers are open to neighbours' lateral drills, so a full grid still has a game.
3. **What to spend** — bonus drills are charges; tonics are answers to bad layers.

Banking stops being a chore: extracted oil is banked on extraction.

### The loop

- The bore stays passive and paced exactly as today (`lib/oilStrikeClock.js`): over the season the rig **reveals all 20 layers in order**, one per strike, at a secret moment inside each window. Cadence with the current settings (8-day season): a reveal every **9.6 h**.
- A **drill is an extraction charge.** Passive charges per season + bonus charges (referrals, holding milestones, daily-ticket prizes, demon bounties) up to the layer count. A player with 20 charges extracts everything — their reward for the bonuses is never having to choose. Everyone else plays the game every strike.
- Each strike **reveals** the layer (oil amount, dry, or hell) and fills the rig's tank with it. The layer is **UNDECIDED** until the next strike. The player chooses:
  - **EXTRACT** — spend a charge; the tank pumps down the pipeline to the main tank; BANKED ticks up. Final.
  - **PASS** — the layer is gone from this column; the tank vents it back into the ground at that layer, where it is **open to lateral drills** from neighbours. **Pass is final** (decided; no re-open, not for any price).
- **Offline default — the player's own line.** Every rig has a threshold ("auto-extract any layer ≥ 800 BTR"). If a layer is still undecided when the next strike lands, the rig resolves it by the threshold. Nobody is punished for being asleep; the threshold *is* the strategy dial and the strike alert becomes actionable: "Layer 12: 1,400 BTR — above your line, extracting" / "below it — passing in 9 h unless you say otherwise."
- **Endgame rule (amended 2026-08-27): autopilot is OPT-IN.** The original forced rule ("charges ≥ layers remaining → extract everything") became dominated play once laterals/wildcats compete for the same charges — at 20 charges it would fire from layer 1 and starve the frontier. A player who opts in (`oilDrills.autopilot: true`) gets the original behaviour; default is threshold-only resolution. Unspent charges at the buzzer are still wasted, so hoarding has a cost either way.

### Lateral drills — the full-grid game

- A **passed layer in a neighbouring column** (the 4 orthogonal neighbours; 8 if the field wants it) can be taken by a **lateral drill**: spend a charge, take that layer's oil. Contested between neighbours: first lateral wins; the layer then closes.
- Nothing anyone chose to keep can ever be touched — this is the "contested capture" principle already in this doc, finally with a concrete object. Banked oil stays sacrosanct.
- Claim jumps stay for when plots release. The dino, if it remains, hunts **passed layers only**.
- **Wording is load-bearing:** a lateral takes what its owner irrevocably discarded — the owner loses nothing (pass is final, they were never getting it back). UI language is **taken / salvaged**, never poached or stolen; the race is between the *other* neighbours, not against the owner. Adversarial is fine as long as it's fair, and it reads fair only if the words say what actually happened.
- Laterals never originate from, or salvage from, company land — the ring plays by **wildcat** rules (next section).

### Wildcats generalized — the frontier (decided 2026-08-27 · BUILT)

> **Supersedes the ring-only wildcat scope below for now.** Origin: Michelle's "3×3 territories" proposal (each claim = own center + 8 surrounding columns, contested first-come). Full territories are a v3-scale structural change (claim ≠ column breaks the data model; bore routing unsolved), so the decided bridge keeps 1-column claims and generalizes the wildcat verb: **any of the 8 adjacent columns that is UNCLAIMED is frontier** — spend a charge to drill it blind at a layer your own bore has reached (depth = reach), first wildcat per cell wins, oil banks like an extraction, inclusions ride along, a dormant hell pocket wakes the demon on the wildcatter (tonic caps it). On a sparse field this IS the territory game: everyone is surrounded by frontier, contested exactly where claims sit within 2 cells of each other — and the land rush prices placement. Note the asymmetric reach, deliberately: **wildcats reach 8 neighbours** (territories touch diagonally), **salvage laterals stay 4-orthogonal** (the doc's decided reach into *played* columns). Implemented: `oil-wildcat` route + the FRONTIER board on the Core Sample card + wildcat scars on the live strata wall. The **company ring** below is DEFERRED — if generalized wildcats play as well as the sim suggests, the ring's equal-neighbour rationale may be retired entirely; season data decides. Whether full 3×3 spaced-claim territories become v3 stays open, with this bridge as the experiment.
>
> **Lattice sim (2026-08-27, 15 pads on 10×10 · 30 dep · capture on · 30 seeds):** the economy INVERTS — own-column banking falls to 6–10% of field oil while wildcats + pool drains harvest 54–65%; the rig becomes a base camp, the frontier becomes the mine. Consequences if v3 happens: (1) charges must scale hard (8ch strands 34% of the field; 14ch → 17%; likely ~20 needed); (2) phase-5 capture (pool drains) is near-mandatory — without it blind digs can't harvest enough; (3) pads must be INSET a cell from every board edge (Michelle's sketch already does this — its salmon frame) or edge pads run ~0.78 EV from clipped frontier; (4) relic recovery collapses (7–14% vs 49%) — inclusion distribution would need re-aiming at reachable frontier depths. Extract-or-pass becomes a side dish (bind 0–24%) — v3 is a different game, and these numbers are the eyes-open cost sheet for choosing it.

### The company ring — wildcats & equal neighbours (decided 2026-08-26 · DEFERRED — see "Wildcats generalized" above)

> **Status: DESIGN, decided with Michelle 2026-08-26.** Prototyped live in the `?strata=1` mock-season demo (`src/components/StrataVoxels.jsx`). Motivation: under plain laterals, edge plots have 3 salvage sources and corners 2 against the interior's 4 — a strict dominance gradient (perimeter rots). The ring converts the gradient into a priced tradeoff and gives "poaching unclaimed ground" — an instinct from earlier design rounds — a rules-legal home.

**The rule.**

- The **outer ring of columns is company land**: unclaimable, no rig, no reveals, no passes. The claimable field is the interior (10×10 → **8×8 = 64 claims**, 36 ring columns).
- Every claim therefore touches **exactly 4 columns**. What varies is their *composition*, and that variance is the strategy:

| claim position | player neighbours | private ring columns |
|---|---|---|
| deep interior | 4 | 0 |
| border edge | 3 | 1 |
| border corner | 2 | 2 |

- Each non-corner ring cell is adjacent to exactly **one** claim — ring access is **exclusive**, a private reserve, not a commons. Two play styles, priced at claim time with the geometry in plain sight: the **salvage trader** (interior — maximum contested discards, wall-watching, races) vs the **wildcatter** (border — quieter, a frontier nobody else can touch). Visible-geometry inequality is strategy, not unfairness.
- The 4 ring **corner** cells touch no claim at all: **the company keeps the corners** (they fall into the operator `sweep()` with the rest of the unclaimed remainder).
- Diegesis is free: the commercial strip and water tower already stand on the perimeter — company installations on company land. The cube's outer faces (the public view of the underground) are all ring columns, so the walls show the season's wildcat bites.

**Wildcat drills.**

- A border claim may **wildcat**: spend a charge to drill sideways into its adjacent **ring** column — **blind**. Ring columns are never revealed, so a wildcat is a gamble priced only by the **public survey** (which thereby gets a second life mid-season instead of being spent information after the land rush).
- **Depth prerequisite:** a wildcat can only target a ring layer the claim's **own bore has already reached**. Depth = reach; border play gains a progression arc, and the tunnel the client draws is physically honest.
- **One take per ring cell**, permanent — mirror of "first lateral wins" (moot for non-corner cells, which have a single eligible driller; binding if reach ever goes to 8).
- Outcomes resolve against the sealed map: oil → banked as an extraction; dry → the charge is burned (the visible cost of drilling blind); a dormant **hell pocket → wakes the demon on the wildcatter**, tonic applies exactly as on a reveal. Company land carries company hazards.

**Interactions with existing rules.**

- **Grid sizing (cross-ref 2026-06-08):** the ring is proportionally brutal on small grids — 6×6 leaves 16 claims inside a 20-column ring. Size the *interior* to 2–4× expected signups, or accept a deliberately frontier-heavy small season.
- **Field tuning:** deposits under the ring are reachable only by border wildcats, so the ring's share of the oil budget flows to border claims or the sweep. **Re-run the §Field-tuning sim with the ring modelled** before setting `numberOfDeposits` — same before-the-anchor rule as always.
- **Endgame rule tension (flagged 2026-08-26):** "charges ≥ layers remaining → extract everything automatically" becomes *dominated play* once laterals and wildcats exist — auto-extracting your own dregs can be worth less than salvaging a neighbour's discard. Lean: make auto-extract an **opt-in autopilot** rather than a forced rule (open question below).

**Build deltas (on top of the v2 list).**

- **Data:** ring membership is derivable from coords (no flag needed; `oilPlots.ring: true` optional for legibility). Ring `oilPlots/{col_row}` gains `wildcatTaken: { [layer]: userId }`. No `oilDrills` doc ever exists for a ring column; claim/claim-jump routes reject ring coords.
- **Server:** `oil-wildcat { col, row, layer }` — border-adjacency check, depth-prerequisite check against the claimant's bore, one-take check, charge, blind resolve against the sealed map. Results feed FIELD ACTIVITY ("X2·Y5 wildcat L7 — dry hole").
- **Client:** ring columns tinted company land in the world and on the survey map; excluded from the claim flow; a WILDCAT control on border claims' rig card / Core Sample, showing the survey's forecast for the target column (the only information there is).

### Rule of capture — ownerless oil only (decided 2026-08-26 · NOT BUILT)

> **Status: DESIGN, decided with Michelle 2026-08-26.** Named for the real doctrine (you own what your wellhead pumps, even if it migrated from under the neighbour's fence — the dynamic behind Spindletop's derrick forests and the milkshake speech). In real fields there is no dividing wall underground; here, deposits already span columns in the sealed map (blob radius), so hydraulic connection is **derivable from existing data**. The design question was where capture may run without breaking the covenants. Answer: **one universal principle — capture applies only to ownerless oil — instantiated on two terrains.** Raw drainage of a claim's unrevealed layers was considered and **rejected**: it punishes players for a reveal schedule they don't control (the server's, not theirs) and touches oil its owner never got to decide about.

**The principle.** Oil is capturable iff no one owns it: **unclaimed** (ring deposits) or **disclaimed** (passed layers). Revealed-and-kept oil and unrevealed claimed oil are untouchable, always. Both claim archetypes get a capture game; they differ in flavour, not in access — which keeps the trader/wildcatter tradeoff symmetric in principle and prevents capture from reintroducing positional inequality.

**Interior terrain — the siphon (capture of disclaimed oil).**

- An **operating bore passively siphons adjacent open pockets of the same deposit**: a passed layer orthogonally adjacent to a claim's bore, connected through the blob, drains slowly toward that bore — the siphoned oil **banks to the siphoner**. No charge spent.
- Interplay with laterals is the point: a **lateral is buy-it-now** (a charge, the whole pocket, instantly); the **siphon is free, slow, and interruptible** — a rival's lateral can still snap up whatever the siphon hasn't drunk. Speed vs thrift.
- Salvage now **decays**: an open pocket next to an operating bore shrinks tick by tick, so camping on the salvage market has a price and the wall shows it (the green cell visibly deflating toward the bore — fill-level rendering earns its keep here).
- Offline-safe by construction: the siphon only ever drinks what someone **consciously discarded**, and slowly, with a field alert ("X4·Y5's bore is drinking the L7 pocket") in time for rivals to answer with a charge.

**Ring terrain — pool races (capture of unclaimed oil).**

- A **wildcat strike starts draining its connected ring deposit**: cells of the same blob in company land deplete over time toward the wildcatter's take — including cells only a *rival border claim* can reach.
- Where a deposit spans several claims' ring reach, that's the milkshake race proper: wildcat **early** (shallow, with the depth prerequisite biting) or wait for depth and risk the husk. The survey shows shared ring pools **at claim time** — a border plot on an isolated pocket is a true private reserve; one on a shared pool is buying into a race, knowingly.
- The company royalty (open question above) applies to drained oil same as struck oil.

**Balance (required before the anchor).**

- Capture adds upside to both archetypes but not automatically *equal* upside. **Extend the §Field-tuning sim** with both archetypes and capture on (siphon rate, ring drain rate, royalty as knobs) and tune until neither archetype dominates the land-rush EV across seeds. If the numbers won't balance, the rates are per-zone — the milkshake is tunable.
- Supply-side dependency: siphons and laterals both live on **passes**, so this whole section inherits the field-tuning requirement — if charges don't bind (today's 5-deposit field), nobody passes wet layers and the capture economy starves.

**Build sketch.** Deposit membership per cell from the sealed map (blob id at generation); siphon/drain amounts advance on the existing server cron tick, integer-quantized, written to the same `oilPlots.passed` map (a pocket is its remaining value); FIELD ACTIVITY lines for siphon start and pool-drain progress.

### Multi-element core & relic distribution (decided 2026-08-26 · NOT BUILT)

> **Status: DESIGN, decided with Michelle 2026-08-26.** Motivation: bind is a budget dial (deposits/charges) — but the two-thirds of claims whose charges never bind still deserve decisions. The fix is the information axis, WITHOUT breaking "UI numbers are real": **the assay is exact about oil and incomplete about everything else.**

- **A cell holds `{ oil, inclusion? }`.** The core sample reads the oil exactly and flags — but does not identify — anything else: **"82 BTR · anomalous inclusion detected."** The number never lies; ambiguity lives only in the secondary channel. Extract to recover the inclusion; the **appraiser** (commercial strip) identifies it. Builds directly on `artifactDistribution.js` + `docs/artifact-expansion.md` (same seed, already rendered behind the reveal gate).
- **Flag at reveal, hide identity until extracted** — the anti-lottery guard. Unflagged relics would make every dry layer a lottery ticket and resurrect extract-everything (the §Field-tuning failure mode). The ping makes relic-chasing an *informed* purchase.
- **Anti-correlate with oil.** Bias inclusions toward dry layers, deeper strata, and the ring. Rich columns must not also be the relic motherlode — the archaeology lives in the barren rock, so a dry claim can still have a great season as a dig site, and ring inclusions give wildcats a second prize ("struck something weird in company land").
- **Depth-tiered rarity, hell-cursed at the bottom.** Bottle caps shallow → fossils mid → meteor iron deep → cursed pieces in hell strata. Seeded **before the anchor**, same rule as everything.
- **The crew never gambles.** The standing order reads BTR only — auto-resolve ignores inclusions. A below-line layer with a ping is always a *manual* purchase. (A wet above-line layer with a ping extracts normally and the relic rides along.)
- **Taxonomy (Michelle, 2026-08-26): relics/artifacts are BURIED items — they only ever come out of the ground** (drilling, laterals, wildcats). They are a distinct class from **boardwalk goods** — things acquired at the commercial strip (tonics, cards, souvenirs, tattoos, tickets). The two meet only at the vendors: the appraiser *identifies* buried finds and may pay for them in boardwalk credit, but the strip never mints or sells relics. One direction of flow: ground → player → boardwalk, never boardwalk → relic.
- **Knobs (sim-gated):** inclusions per column (~1–2 avg), dry-cell share (~70%), ring share, relic value tiers. Extend `sim-v2-ring-capture.mjs` with inclusion prospecting and measure **demand** (desirable purchases vs charges) for slack-budget claims before fixing counts.

### Build order (concept approved 2026-08-26)

> Michelle approved the combined concept off the `?strata=1` playable mock: extract-or-pass + laterals + company ring + rule of capture + the strata-voxel world rendering. The demo panel is **not** the player UI (that gets a proper design pass, Michelle-led) — but the mock's surfaces are the requirements list: decision card with explicit cost copy, the claim's column always visible (core rack), a running ledger, and an end-of-season reckoning (banked vs column total vs what rivals captured).

1. **Sim gate — first, zero production risk.** `scripts/sim-v2-ring-capture.mjs` extends §Field tuning with the ring, both archetypes, and capture. Outputs the deposits / charges / royalty / capture-rate recommendation. Anchor knobs move only on its numbers.
2. **v2 core loop, server + test mode** (no ring/capture yet): charges, pending + threshold resolve on the tick, `oil-layer-decide` / `oil-threshold`, `oilPlots.passed` / `lateralTaken`, alerts under the copy rule. Cell contents are `{ oil, inclusion? }` from day one (§Multi-element core) so relics don't need a second data migration. Lands at a **season boundary** — never hot-swapped mid-season (the anchor rule).
3. **Laterals + the wall:** `oil-lateral`; extraction mirrored onto `oilPlots`; StrataVoxels promoted from mock timeline to Firestore listeners (same instancing — only the event source changes).
4. **Company ring + wildcats:** claim flow excludes ring coords, `oil-wildcat`, ring rendering (tint, no rigs).
5. **Rule of capture:** siphon + pool drain on the server tick; capture lines in FIELD ACTIVITY.
6. **Player UI pass** (Michelle-led) on the Core Sample surface, informed by every confusion the mock surfaced.

### The tonic (daily-ticket prize)

One clear consumable for one clear moment: **cap a hell pocket.** The breach happens on reveal; a tonic in supply neutralizes it — no demon, no halt. (Spent automatically on the breach; a setting can make it manual later.) A second consumable — re-open a passed layer — was considered and **rejected**: pass is final.

### Banking is removed

- No BANK button, no "IN TANK · AT RISK". Extraction = banking.
- The per-rig **tank model stays** and becomes the decision buffer: it fills on a strike (something's on the table), drains down the pipeline on EXTRACT (the reward beat — the existing "sent to main tank" animation), or vents on PASS (the visual cue to the field that a layer is open). Fill level is honest: full = a decision is waiting; the "heavy" red state = the decision is about to auto-resolve by the threshold.
- The main tank keeps its meaning: the community total on the leaderboard. Payout stays fixed-rate per unit (`payout = banked × rate`), bounded by the field.

### Field tuning — the decision must bind (measured)

Simulated 2026-08-23 against the real generator (`generateOilDistribution3D`, 6×6×20, 30–40 seeds each) with the extract-or-pass rules above (threshold strategies include the endgame rule):

| deposits | wet layers | wet / column (median) | columns where charges bind | extract-every-wet-layer | best fixed threshold | oracle share of column |
|---|---|---|---|---|---|---|
| **5 (today)**, 10 charges | 13% | 2 | **0%** | 98.7% of oracle | 98.7% | 100% |
| 12, 10 charges | 30% | 6 | 14% | 97.2% | 97.2% | 99% |
| 25, 10 charges | 51% | 10 | 49% | 91.3% | 92.9% | 96% |
| 40, 10 charges | 66% | 14 | 75% | 85.1% | 91.6% | 92% |
| 25, 6 charges | 51% | 10 | 79% | 73.2% | 86.0% | 84% |
| 40, 6 charges | 66% | 14 | 93% | 65.4% | 84.2% | 76% |

Two different "hit rates" — don't confuse them. The generator's hit rate (the one `oilDistribution.js` tunes with the radius band) is **per plot**: does a claim hold oil anywhere in its column. That is healthy as tuned (6×6, 5 deposits → 69% of plots; 10×10, 5 deposits → 36%; 10×10, 30 deposits → 88%). The figure that matters for extract-or-pass is **per layer**: inside a wet plot, oil sits in a median of **3 of 20 layers** (p90 7) at 5 deposits, **6 of 20** (p90 11) at 30. "Wet layers" in the table above is the per-layer figure across the whole field.

Reading it: with the field as tuned today the mechanic is fake — a column rarely has more wet layers than charges, so "extract every wet layer" is the whole game. It becomes a real decision once **wet layers per column exceed passive charges**: at 25–40 smaller deposits, a good threshold beats a naive one by 13–19 points, and a perfect player has ~15 more to find. **Recommendation for the first v2 season: ~30 deposits, 8 passive charges, bonuses to 20.** Re-run the sim at tuning time (the script is trivial — strategies are ten lines) and tune `numberOfDeposits`, not the formula. The distribution knob must be set **before the anchor** (changing it after commit remaps every seed — same rule as the oil radius band).

### What changes (build list)

**Data — `oilDrills/{userId}`:** `charges` (int, replaces the role of `bonusDrills` in the depth math; `bonusDrills` keeps feeding it), `threshold` (BTR), `pending` `{ layer, oil, isHell, revealedAt, decideBy }` or null, `layersExtracted` / `layersPassed` (maps layer → oil), `laterals` (count), `supplies.tonic` (exists). **`oilPlots/{col_row}`:** `passed: { [layer]: oil }` (open to laterals), `lateralTaken: { [layer]: userId }`.

**Server:** the tick reveals (no extraction) and, before revealing the next layer, **resolves the pending one by the threshold**; a hell reveal consumes a tonic if present, else summons the demon as today. New routes: `oil-layer-decide { layer, action: extract|pass }`, `oil-threshold { btr }`, `oil-lateral { col, row, layer }` (neighbour check, passed-and-unclaimed check, charge, transaction). `oil-tank-drain` retires (or becomes a no-op). Alerts: the strike alert carries the number and the line ("above/below your threshold"). `depthCapFor` stops gating the bore (the bore goes to 20) and becomes the charge count.

**Client:** the Core Sample column is the decision surface (EXTRACT / PASS on the pending layer, passed layers marked open, neighbours' open layers marked for laterals); the rig card shows CHARGES n/20, the threshold (editable), the pending layer with its countdown, and the cadence line ("a reveal every 9.6 h · next before …"); the BANK block is replaced by the pending-layer block; the tank animates fill / pipeline / vent.

**Copy rule (playtested 2026-08-26):** every decision surface and alert must state the cost model explicitly — "EXTRACT banks the full N BTR for 1 charge · PASS is free but final." Never present the threshold bare ("your line: 764") — a playtester read it as a *price* ("do I spend 764 to get 1,285?"). The threshold is always phrased as the crew's standing order: "if you're away, the crew follows 'extract ≥ 764' → would EXTRACT." BTR only ever flows toward the player; charges only ever flow away.

**Test mode:** the existing LAYER stepper reveals; add EXTRACT / PASS / LATERAL controls and a threshold field.

### Open questions

- Lateral reach: 4 neighbours or 8? (Start with 4. Note 8 would break the ring's exclusive-access geometry — diagonal reach makes ring cells contested and gives corner claims 4 private columns.)
- Should a lateral cost more than a charge (a charge + a bonus drill) to keep columns primary? (Start at one charge; watch the sim.)
- Whether the dino survives at all once passed layers exist for it to hunt.
- **Wildcat royalty (2026-08-26):** does the pot take a cut of wildcat strikes? It is company land, and a small royalty both reinforces that and prices the blind upside. (Lean: yes, small.)
- ~~**Endgame auto-extract (2026-08-26)**~~ — **DECIDED 2026-08-27: opt-in autopilot** (see the amended Endgame rule above). Implemented in `oilLoopV2.resolvePendingDecision`.
- **Charges scale with frontier share (2026-08-27, measured):** the admin CHARGES knob (8–20) exists and the sim says the two worlds want opposite settings — dense claims-anywhere wants **8** (20 charges there → bind 0%, salvage collapses to 3%, corner EV 2.03 — the decision game dies), sparse/lattice wants **20** (stranded oil falls 34% → **3%**). One knob, set per season with the field shape.
- **Anti-stranding stack (Michelle's concern, 2026-08-27):** charge budget is the main lever (above); phase-5 pool drains do the rest of the harvesting; her further ideas logged for the full-grid case — adjacency-recovery under conditions ("first dibs", already the rule for wildcats/laterals) and an **acquired reach tool** (e.g. a boardwalk/Pimp-My-Pump SKU extending wildcat reach to distance 2 — ties the strip economy in; the stall coupon would apply). Un-won oil is never burned — it stays with the operator — so this is a generosity/game-feel dial, not a solvency one.
- **Relic distribution re-aim for lattice (2026-08-27):** her framing is the mechanic — most relics should surface via the own-column assay ("mostly dry, one unknown object"), i.e. bias inclusions toward CLAIMED pad columns and shallow reachable frontier. Lattice sim recovers only 7–23% of relic value with today's depth-biased spread; re-aim before any lattice season.
- **Depth prerequisite for salvage laterals (2026-08-26):** wildcats require the bore to have reached the target layer — decided. Does the same apply to interior salvage laterals? Yes makes depth strategic everywhere and the tunnels honest; no keeps salvage purely reactive. (Undecided.)
- **Ring on small grids:** run the ring from season one (frontier-heavy 6×6, 16 claims) or only at ≥ 8×8? Interior should size to 2–4× signups either way.
- **Siphon depth prerequisite (2026-08-26):** wildcats require the bore at target depth — does the siphon too (only drink pockets at/above your bore head)? Consistency says yes; simplicity says any adjacent open pocket. (Lean: yes — one depth rule everywhere.)
- **Siphon rate & alerting:** how many BTR per tick, and who gets the "pocket is being drunk" alert — all eligible lateral rivals, or the whole field feed? (Lean: field feed; the wall shows it anyway.)
- **Casing (parked door):** a purchasable per-column seal only matters if capture of *claimed* oil is ever introduced — which was rejected 2026-08-26. Parked: revisit only if a future season wants true interior drainage, in which case casing is the defense economy that makes it fair (drain or defend, both priced).

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

### Provable fairness & insider-tipping defense (BUILT 2026-06-08)

Provable fairness uses a **future-block commit-reveal** (`lib/oilFairness.js`, `/api/oil-fairness` commit/anchor/reveal, public `/api/oil-verify`): commit `SHA-256(secret)` + a *future* Base block number, derive `finalSeed = SHA-256(secret : blockHash)` once that block mines, reveal the secret at game end. This defends against **seed-grinding** — the operator can't search for a self-favoring map, because the map is undetermined (even to the operator) until the unpredictable block is mined.

**It does NOT, by itself, stop insider-tipping.** Once the anchor block is mined the seed is fixed and the operator *holds the secret*, so they can compute the entire map. If players could still pick or move plots after that, the operator could tip insiders toward the rich cells. Hiding the admin distribution view is theater — whoever holds the secret can always derive the map post-anchor.

**Decision (2026-06-08) — split by action: first-plot claims locked pre-anchor; claim-jumps stay live + audited.** The only real defense against tipping is *timing* (lock choices before the map is knowable), but a blanket lock kills engagement (claim-jump is a core live-game loop). So the two actions are treated differently:

```
registration (ticket_sale)  → first-plot claims open; only the commitment is
                              public; anchor block still in the future → the map
                              is unknown to EVERYONE, operator included
   ↓ anchor block mines (at the registration → active transition) → seed fixed
active                      → drilling reveals the pre-set map; NO new first-plot
                              claims, but CLAIM-JUMPS stay enabled (logged/audited)
   ↓ game ends → reveal → anyone verifies via /api/oil-verify + audits oilClaimLog
```

**Enforcement (server-authoritative):**
- **First-plot claims (`oil-claim`)** — real-player requests rejected unless `gamePhase === "ticket_sale" && !anchorBlockHash` (registration *and* pre-anchor). Gating on `!anchorBlockHash` (not just phase) is the precise crypto boundary — even an early/mistaken anchor during registration closes claims. **Operational rule:** run the `oil-fairness` **anchor** step only at the registration→active transition, so `active ⟺ map determined`.
- **Claim-jumps (`oil-claim-jump`)** — **stay enabled during active play** (engagement, 2026-06-08 reversal of the original blanket Option A). This is *not* provably tip-proof — the operator could steer a jump onto a known-rich cell post-anchor — so it's an **operator-trust + auditable** posture, not a cryptographic guarantee. Two things bound the risk: (1) every claim/jump is written to the **public `oilClaimLog`** with `phase` + `anchored`, so post-game (with the revealed map) anyone can spot suspicious jumps onto deposits; (2) a **right-sized small grid** keeps the unclaimed-rich-cell tipping surface small (see *Grid sizing* below). Don't market claims as fully provably-fair — provably-fair covers the **map**; claim placement is trust-plus-audit.

- **Tester exemption:** `isTester` accounts may still claim while `testingEnabled === true` (including the active phase) so the live loop can be exercised. Testing must be **off** for any live game (safe-by-default `testingEnabled`), so this never weakens real-game fairness. See the tester access-code flow (`/api/oil-tester-code`, `/api/oil-redeem-code`).

**Grid sizing (2026-06-08):** size the grid to roughly **2–4× expected signups**, starting small (e.g. 6×6 for a first season) and growing as the base does. Small grids early are better on all the axes that matter then: players actually hit oil (good first-impression UX), and the claim-jump tipping surface shrinks because cells fill up (few unclaimed rich targets). A large sparse grid (10×10 for a handful of players) is both a ghost town *and* a tipping playground. The "higher hit-rate pays out more of the pot" downside of a small grid is controllable via deposit count / depth cap / rate, and early payouts are cheap traction.

**Grid is a PRE-PICK capacity dial — freeze it on the first claim.** Size the grid upfront (from a demand estimate / early interest count) *before plot-picking opens*. Growing is only truly transparent while the board is **empty**: a plot is a `(col,row)` coordinate, so growing adds cells without changing coordinates or (blind, pre-anchor) expected value — BUT it shifts every existing pick's **relative position** (a deliberately-chosen corner becomes an interior cell; the new corner opens up behind them) and resamples the whole distribution under their pick. Players form attachments to position, so that reads as a bait-and-switch. Therefore: **once ≥1 plot is claimed, the grid is frozen** (no grow, no shrink); never shrink below a claimed coordinate; and never resize after the `ticket_sale → active` anchor (it would move oil out from under active rigs). Overflow beyond the frozen capacity → waitlist → next season (opened on a bigger grid, chosen upfront again).

**Overflow → waitlist → next rolling season (BUILT 2026-06-08).** Grid-growing covers demand up to your max grid during registration. Beyond that — or demand arriving *after* anchor (mid-season), when first-plot claims are closed — players join a **next-season waitlist** (`/api/oil-waitlist`: sets `waitlisted:true` + `waitlistedAt` on their `oilQualified` doc; returns position + total). A qualified-but-unplaced player sees a "JOIN NEXT-SEASON WAITLIST → you're #N of M" affordance in the no-claim panel; the admin status banner shows the waitlist count (a sponsor demand metric). **Prefer this over a second parallel pot:** under fixed-rate, adding players is positive-sum (no dilution, liability still capped at the escrowed pot), so the right scaling move is a *bigger pot (sponsors)* + staggered registration for the next rolling season — not splitting the crowd/pot/ops across two simultaneous games. True parallel pots are a sponsor-funded scale feature, not a bootstrap one.
- **Reveal is gated on game-end (2026-06-08):** `/api/oil-verify` and the client only treat the seed as revealed when `gameEnded === true || gamePhase === "ended"` — a stale `seedReveal` on an active board can no longer leak the live map.
- **`oil-admin-reset` wipes the whole fairness lifecycle (2026-06-10):** RESET BOARD deletes `seedScheme`/`seedCommitment`/`anchorBlock`/`anchorBlockHash`/`seedReveal`/`finalSeedReveal` (+ legacy `blockHash`) from `oilGame/settings` AND deletes the server-side `oilSecret/seed` doc. Rationale: a stale commit kept `OilAnchorEvent` counting down to last season's block, and a stale `anchorBlockHash` silently rejected every first-plot claim in the next registration (`oil-claim` requires `ticket_sale && !anchorBlockHash`). After a reset the lobby shows the no-commitment state and strike-tick idles (`skipped:"no_seed"`) until a fresh COMMIT + ANCHOR — so the new-season runbook is: RESET BOARD → ZERO SCORES (`/api/oil-admin-zero-scores`, zeroes every rig's banked `totalCollected` — kept out of RESET BOARD so a mid-season wipe can't destroy earned money) → phase `ticket_sale` → set START DATE → COMMIT (lead sized to the planned start) → claims open → ANCHOR at the registration→active flip.
- **Residual trust note:** the operator still custodies the secret. To remove even that, derive the secret from an external/multi-party source (future work). For bootstrap seasons, pre-anchor claim-locking + on-end reveal is the accepted bar.

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

**"WHILE YOU WERE AWAY" recap — BUILT 2026-06-10** (upgraded from the old "optional toast" idea —
for a game whose engine is "check back," the moment of checking back IS the product):
- `src/components/OilAwayRecap.jsx` — landing overlay for a returning player. **Centered card
  on ALL viewports** (a mobile bottom sheet left ~3/4 of a tall phone viewport as dead dimmed
  space — reworked 2026-06-10 to a centered card over a light dim, 0.55 + 3px blur, so the
  field stays visible as framing). Hero = oil struck while away (count-up animation, ≈$ at the
  fixed rate) or the honest dry read ("N layers of dry shale — the vein is still down there").
  Sections: YOUR RIG (depth from→to, strike count + best, hell-pocket warning, banked-delta,
  tank readout with ⚠ TANK HEAVY — BANK IT NOW wired to `handleTankDrain` when ≥
  `TANK_CAPACITY`) and THE FIELD (up to 4 timeline events by other players + "and N more" +
  unread plot-message count). CTA: BACK TO THE FIELD.
- **Diff source is fully client-side, no new server work:** baseline `{at, col/row, depth,
  tank, banked}` in localStorage (`oil_away_v1`); per-layer oil from the server-authoritative
  `oilPlots.revealed` map over the layers drilled since the baseline; field events filtered
  from the existing `oilTimeline` listener (`> baseline.at`, not self); unread from the
  `plotsWithMessages` listener.
- **Shows once per absence:** active phase, real players with a rig only (admin/test/report/
  preview excluded), ≥30 min away, and at least one notable item; re-baselines on every
  qualifying load. Claim-jumping resets the baseline (plot key mismatch).
- **Preview hooks:** `?recap=1` forces it with real data over a synthetic 26h/3-layer window;
  `?recap=demo` renders a fully synthetic showcase (tagged "DEMO DATA") — use this to eyeball
  the mobile sheet on a real phone.

**Decided (2026-05-31):**
- **End-of-season un-banked oil → credited to the player, never lost.** Un-banked `tankOil` belongs to the player; banking *during* the season is optional theft-protection (the dino can take a % of un-banked oil), not a scoring gate. Payout = `totalCollected` + any remaining `tankOil`. No "bank before the buzzer" pressure. **DONE (2026-06-07):** un-banked oil is paid out two ways over — the season buzzer (`endSeason` in `oil-strike-tick`) auto-sweeps every rig's `tankOil → totalCollected` when the phase flips to `ended`, *and* `scripts/oil-payout.js` independently scores `totalCollected + tankOil` (see *Rail A*). So nothing is lost whether the season ends on the buzzer or early via the admin button (which doesn't run the sweep — the payout's summing covers that case).
- **EV-per-player: flat floor, trending up — never declining.** Pot scales at least linearly with participation (per-qualified-wallet sponsor bounty) so EV stays flat as the game grows; as traction attracts bigger sponsorships the pot grows faster than headcount and EV *rises*. Growth always rewards existing players → referrals stay strongly positive-sum.

**Tank meter copy (done 2026-05-31):** relabeled to reflect the uncapped tank — header "TANK · UNBANKED", readout shows raw `{tankOil} USDC` (no `/cap`), and the over-threshold prompt is "TANK HEAVY — BANK SOON" (button) instead of "TANK FULL". `TANK_CAPACITY = 5` now only drives the meter's red "bank soon" threshold, not a storage limit.

**Open decisions:**
- Default substance: oil vs goo vs hybrid (oil baseline + goo jackpot).

## Game Phase Flow

The game progresses through three phases, controlled by `gamePhase` in Firestore:

1. **`ticket_sale`** (Registration + Plot Pick — labeled **"REGISTRATION"** in admin; the
   `ticket_sale` value is a legacy name, the ticket/draft system is gone). Plot-less users get
   `OilQualify` (the registration lobby): connect a wallet holding ≥ $20 of RL80 **and** verify
   they follow **@rl80token** on X. Once qualified, the plot pick happens **on the live 3D
   field** ("PICK YOUR PLOT ON THE FIELD" — see *Pre-season mode* below; first come, first
   served). `oil-register` re-checks the balance server-side and is the sole writer of
   `qualified`. **X follow is server-enforced too (2026-06-11):** registration runs the same
   three-tier follow check as the VERIFY button (`lib/xFollowers.js` — cached follower list →
   cooldown-gated on-demand refresh → live look-up; the cache also backstops via the daily
   `updateFollowers` Firebase cron). When the Clerk user has an X account linked (OAuth), its
   username overrides the typed one and the doc gets `xVerified:true` (ownership proven); typed
   handles are stored `xVerified:false` — they prove only that the handle follows, not that the
   player owns it (accepted residual risk; the real gate is the $20 hold). Handle uniqueness is
   first-come, except an OAuth-verified owner reclaims their handle from an unverified squatter.
   **Players who already claimed fall through to the 3D field in PRE-SEASON mode.**
2. **`active`** — Game running. Continuous auto-pump drilling: each armed rig grinds on its own and
   **strikes at random, unpredictable times**, paced by the fill-the-season clock (avg interval =
   season ÷ depthCap; see *TIMING FRAMEWORK*). Players can claim-jump. **First-plot claims are
   CLOSED** (registration-locked pre-anchor, per *Provable fairness & insider-tipping defense*) —
   the client only renders CLAIM THIS PLOT while `testingEnabled === true` (the tester exemption,
   the only case the server accepts mid-season); otherwise a qualified-but-unplaced player sees
   "CLAIMS ARE CLOSED" with the **next-season waitlist** as the primary CTA.
3. **`ended`** — Game over (auto-flipped by the strike tick at the season buzzer, or by the admin
   END GAME button). Report mode unlocked. Seed revealed; `/api/oil-verify` returns VERIFIED.

Default is `"active"` for backward compatibility.

### Pre-season mode (BUILT 2026-06-10)

During `ticket_sale`, `/hailmary` is **one destination with state-driven layers** instead of a
hard page swap:

- **Plot-less users** → `OilQualify` (registration lobby / marketing scroll).
- **ON-FIELD PLOT PICK (BUILT 2026-06-10) — the ONLY claiming path.** The lobby's inline 2D
  quick-pick grid was removed (`handleClaimPlot` deleted); a qualified plot-less user instead
  hits **"⛏ PICK YOUR PLOT ON THE FIELD →"** (calls `onEnterField` → `lobbyView=false`), lands
  on the live 3D field in pick mode, clicks an open cell (3D field or surface map — the map IS
  the 2D fallback, so no second claim UI to maintain), and stakes it via **"⛏ STAKE YOUR
  CLAIM (c, r)"** → the existing `handleClaimActivePlot` → `/api/oil-claim` (same `?ref=`
  handling; server enforces qualification + the registration/pre-anchor window). On success the
  drill doc arrives, the camera flies to the rig, and the panel flips to the pre-season
  checklist; "← BACK TO REGISTRATION" returns to the lobby (hidden in `?preview=1`, where the
  lobby gate doesn't apply).
- **Players with a claimed plot** → the 3D field in **pre-season mode**: header reads
  `SEASON STARTS IN Xd Xh` (isolated `SeasonCountdown`, ticks on its own 30s timer) +
  `PRE-SEASON` status, and the drill-button slot renders the **pre-season checklist** — the three
  highest-leverage asks while waiting for the anchor:
  1. **GET STRIKE ALERTS** — Telegram bot deeplink (`t.me/<bot>?start=<userId>`); shows ✓ once
     `oilTelegram/{userId}` exists (live listener).
  2. **RECRUIT YOUR CREW** — referral link copy (+3 layers per confirmed referral).
  3. **PIMP YOUR RIG** — GO TO RIG selects the player's plot (camera fly) for customization.
- **Lobby ↔ field plumbing (`lobbyView` state in `page.js`):** pinned `true` on mount for
  plot-less users so claiming a plot does NOT yank them off the certificate mid-ceremony — they
  stay in the lobby (share moment) until they click the new **⛏ ENTER THE FIELD** button under
  the certificate (`onEnterField` prop). Returning: the pre-season panel's VIEW CLAIM CERTIFICATE
  link (players) or the OPEN LOBBY button next to the admin PHASE controls (admins) set
  `lobbyView = true`. The pin waits on a `drillLoaded` flag (drill-doc listener resolved) so a
  plot-holder's loading-race null can't trap them in the lobby.
- **No-claim panel reconciled with server truth:** the dead active-phase CLAIM button +
  "claims closed" contradiction is gone (claim CTA renders only when a claim can succeed); the
  tester-code input is collapsed behind a "HAVE A TESTER CODE?" link.
- **Anchor-as-event (BUILT 2026-06-10):** the provable-fairness anchor is public theater.
  `OilAnchorEvent` (`src/components/OilAnchorEvent.jsx`) renders three states from the public
  settings fields (`seedCommitment` / `anchorBlock` / `anchorBlockHash`, now mirrored into
  page state): pre-commit ("THE MAP DOES NOT EXIST YET — nobody knows where the Lyquid80 is.
  Not even us."), committed (**live countdown to the anchor block** — polls Base height every
  30s via the CDP RPC lane / `fetchLatestBlockNumber`, ticks locally at ~2s/block between
  polls, shows the truncated commitment hash), and anchored ("THE BLOCK HAS SPOKEN" + BaseScan
  link). Full section in the `OilQualify` lobby (after HOW IT WORKS); `compact` one-liner in
  both pre-season panel branches (checklist + pick mode). **Feed moments:** `oil-fairness`
  commit/anchor/reveal now write `oilTimeline` system events ("map commitment sealed — Base
  block #N will write the map" / "THE BLOCK HAS SPOKEN — map locked by Base block #N" /
  "seed revealed…"); the auto-reveal paths (`oil-settings` on `gameEnded:true`, strike-tick
  `endSeason`) log the reveal line too. **Operational note:** the default commit `lead` is 30
  blocks (~1 min) — for the countdown to be real theater, run COMMIT early in registration
  with `?lead=` sized to the planned season start (≈ seconds-until-start ÷ 2). The crypto is
  unchanged (the anchor block must merely not exist at commit time), and claims still close
  only when the anchor **step** publishes the hash — but run anchor + the phase flip promptly
  once the block mines, since the operator can compute the map from that moment. The fairness
  console (`OilVerifyPanel`, collapsed "PROVABLE FAIRNESS (ADMIN)" accordion) is mounted in
  **both** the field's admin sidebar and the `OilQualify` lobby ADMIN CONTROLS section
  (2026-06-10) — commit happens during registration, when the admin is in the lobby. Its lead
  input now shows a live blocks→wall-clock conversion (+ the landing timestamp).
- `OilQualify` now receives `gridSize` + `prizePool` from `oilGame/settings` (was hardcoded
  10×10 / $500), leads with the prize ("$N USDC IS BURIED IN THIS FIELD" + "holding is the
  ticket" framing), reframes the counter as **plots remaining** (scarcity, not headcount), and
  the HOW IT WORKS / rules copy reflects the auto-pump model with **get paid** as the climax
  step (claim-jump demoted to the rules list).

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
- **Enabled during active play (2026-06-08)** — kept live for engagement, unlike first-plot claims which are registration-locked. Carries an insider-tipping risk that's mitigated by the public `oilClaimLog` (every jump records `phase` + `anchored` for post-game audit) and a right-sized small grid. See *Provable fairness & insider-tipping defense*.
- Players can move to a different unclaimed plot
- **First 2 jumps are free**
- **3rd jump onwards costs 1 bonus drill** (`bonusDrills − 1`) — it eats into your earned depth cap,
  so frequent jumping trades depth for mobility (and you need a bonus drill available to jump at all)
- Old plot is released (becomes unclaimed, but retains its drill depth)

### Disqualification (count-based, 2026-06-08)
- Admin runs snapshots to verify RL80 token balances on-chain.
- **Qualification is count-based, not value-based.** *Entry* is value-gated (`oil-register` requires ≥ $20 worth) and locks a **count floor** `qualifyTokenFloor = $20 ÷ price_at_registration` on the player's `oilQualified` doc. *Ongoing* snapshots (`oil-qualify` POST) then check `balance ≥ qualifyTokenFloor` — **price-independent**. So a holder is disqualified only by **selling below their entry position**, never by a price drop they didn't cause. (Legacy docs with no stored floor get one backfilled once at the current price, fixed thereafter. The pre-registration live check `oil-qualify` GET stays value-based — it's the entry gate.)
- **Why:** removes volatility false-disqualifications, and makes the diamond-hands streak (which keys off continuous qualification) reset only on a real sell, not a price dip — fixing both fairness issues in one rule.
- Disqualified players' plots are released but marked as disqualified (drill depth preserved).
- Released plots are available for others to claim jump to.

### Buried artifacts — "The Substrate" (phases 1–3 BUILT 2026-07-07)
> Full design + phase plan: [artifact-expansion.md](artifact-expansion.md). Short version here.

- A second, non-oil discovery layer for the ~60% of rigs that never strike paydirt: **amber
  shards** (8 sequenceable saurian specimens, 6 distinct fragments each; dupes level the item),
  **burial relics** (a deterministic fraction *cursed* → creates an `oilCurses` doc, spread/cleanse
  logic is phase 4), **outlaw-map fragments** (6 pieces × 2 copies field-wide), and exactly **1 cache**.
- Generated in `src/lib/artifactDistribution.js` from the **same committed seed** on separate RNG
  streams (the hell-pocket pattern) — artifact tuning never moves oil; summary counts are
  publishable at anchor. Unit tests: `scripts/test-artifact-distribution.mjs`.
- **Placement guarantees:** every column ≥ `artifactPerColumn` (default 3) artifacts, ≥ 1 above the
  base depth cap, dry-cell-biased (fully-dry columns get +1); never at z<2, never on hell cells.
  One-way coupling: re-tuning hell pockets can move artifacts, never the reverse.
- Strike-tick detects artifacts alongside oil: reveals into `oilPlots.revealedArtifacts`, credits
  the flat `oilDrills.artifacts` inventory, logs coordinate-free timeline events (`artifact_find`,
  `curse`, `cache_found`). **A dry layer with an artifact sends a real push** (dry-only layers stay
  Telegram-only).
- UI: diamond markers + legend in the Core Sample panel; **SEISMIC** line shows an honest
  next-layer find lower bound `(guaranteed − found) ÷ layers remaining`; **ARTIFACTS** side panel
  (`MuseumPanel.jsx`) is the collection book with a Museum score (phase-4 Curators leaderboard
  uses the same formula); away-recap leads with artifact finds when there's no oil.
- **Phase 4 (not built):** curse spread/cleanse, daily field scan, cache payout split from the
  community pool, Curators leaderboard + season-end second podium, seismic-anomaly event, 3D
  ceremony FX via `gusherEvents`.

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
| `revealedArtifacts` | map | `{ [layer]: { type, ...payload } }` — unearthed artifacts (coordinate-free payload; type `amber`\|`relic`\|`map`\|`cache`) |
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
| `artifacts` | map | Flat inventory `{ itemKey: count }` — keys `amber_{specimen}_{frag}` / `relic_{id}` / `map_{piece}` / `cache`; dupes increment (item leveling) |
| `artifactFinds` | number | Running artifact tally (recap + Curators leaderboard) |
| `lastStrikeArtifact` | map\|null | Payload of the last strike's artifact, if any |
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
| `artifactPerColumn` / `artifactRelicFraction` / `artifactCursedFraction` / `artifactMapCopies` | number | Buried-artifact season knobs (defaults 3 / 0.15 / 0.25 / 2). **Pre-anchor only** — like the deposit radius band, changing them post-commit remaps every seed |

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

### FIELD PROFILE strip (Core Sample) — redesigned 2026-06-09
- The Core Sample is now a **horizontal drill band** (surface-left → deep-right) with the
  live auger; beneath it a thin **field-profile strip** shows the richest revealed strata
  per depth across the whole field, on the *same axis* ("your drill is here ▸ … the field's
  rich zone is there ▸"), with a caret on the richest depth.
- Reads from **revealed data only** (`revealedGrid3D` for players), so it's an *emerging*
  clue that fills in as the field gets drilled — not a seed leak. Admin/report see the full
  field. **No reveal gate** (the old vertical composite + "RUN CORE ANALYSIS" reveal was
  removed). With the depth-cap mechanic it surfaces "the vein is deeper than your reach —
  earn more depth" without exposing *which* plots hold oil.

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
`useClaimStats`/`OilVoxelGrid`, server strike-tick/backfill, verify) so client and
server produce the *same* field. (Callers still pass `depthBias: 0.35`, but it's
**vestigial** now — depth comes from stratification; see *Depth distribution* below.) Oil is a **score in
field units** converted to dollars at the fixed rate `pot ÷ OIL_FIELD_UNITS` (see
*Prize pool — oil has a fixed value*). Player oil readouts (cells, tank, EXTRACTED,
leaderboard) read in OIL units; `TANK_CAPACITY` is rescaled with the field (500K → 2,500).

**Economy pass (done 2026-06-04):** all player + inspector oil readouts now read
in OIL units (only PRIZE POOL + demon bounties stay USDC). `depthBias` / `OIL_DEPTH_BIAS`
is now **vestigial** (see *Depth distribution* below) — still exported and accepted for
signature/verifier compat, but no longer governs placement.

**≈$ equivalents sweep (done 2026-06-10):** every player-facing oil number now carries a
muted `≈ $X.XX` tag at the fixed rate (`fmtOilUsd` helper in `page.js`, rate =
`totalOilBudget ÷ OIL_FIELD_UNITS`): leaderboard rows (both lists), TANK · UNBANKED, SENT TO
STORAGE, the last-strike line in the pump indicator, the away-recap (hero + tank + banked),
and the strike alert itself (push + Telegram, computed server-side in `oil-strike-tick`).
Deliberately NOT tagged: per-cell/per-layer geology readouts (cross-section, core sample,
depth profile) — they're instruments, not wallets, and the density would hurt more than the
conversion helps. EXTRACTED already had the adjacent VALUE stat (kept).

### Depth distribution — stratified ramp, not a depth-bias wall (2026-06-09)

The old model rolled every deposit's depth through a single `OIL_DEPTH_BIAS = 0.35`
power curve, which clustered all `numberOfDeposits` blobs **deep** (median ~12). With the
base cap `PASSIVE_DRILLS = 10`, a seed could leave *every* deposit below base reach →
low-depth rigs had a **structural zero** chance (bait-and-switch). The live field-profile
strip in the Core Sample made this visible.

Now deposits are **stratified across the column**: the usable depth range (~1 → ~`depthZ`−1.5)
is split into `numberOfDeposits` equal bands, with one deposit placed at a random depth
*within* each band. So every season is **guaranteed** reachable shallow oil (≤ the base
cap) **and** deep oil — a ramp, not a wall.

**Richness rises with depth in EXPECTATION, not as a cap.** A uniform roll is raised to a
depth-driven exponent (`richExp = 2.4 − depthFrac·2.0`, i.e. ~2.4 shallow → ~0.4 deep), so:
- a **shallow** deposit usually reads modest but **can still spike rich** (~1-in-7 odds of
  landing in the top richness band);
- a **deep** deposit is usually rich (~60%) but can occasionally be modest.

So "deeper = richer" stays true on average while a low-depth rig keeps a real (if rarer)
shot at a rich pocket.

**Fairness is unchanged.** The band structure + richness curve are **public parameters**
(exactly as `depthBias` was); the secret, unpredictable part is still *which (cx,cy) cells*
hold oil. Hell pockets use a separate RNG stream (`blockHash + "_hell"`) and are untouched.
The **total oil budget is unchanged** — this only *redistributes where* oil sits (and makes
it reachable), it does not change the pot. Lock it before the first committed seed:
`generateOilDistribution3D` is shared by the strike-tick, the public verifier, and the
preview, so any change here remaps every seed.

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

## Share Pipeline (BUILT 2026-06-10)

Three artifacts, one acquisition loop — every share carries the player's `?ref=` link:

- **Share-this-strike (away-recap):** when the recap shows a haul, a "📸 SHARE THIS STRIKE"
  button captures the recap card itself (html2canvas → PNG to clipboard, same pattern as the
  claim-certificate share) and opens the X composer with the haul + ≈$ + referral link.
- **FINAL HAUL card (season end):** `finalHaulCard` in `page.js` — when `gameEnded`, real
  players with a score see a fixed-palette receipt card (LYQUID80 total + ≈$ USDC, "paid to
  your wallet on Base") above the drill panel, with "📸 SHARE YOUR HAUL". The payout-receipt
  moment is the game's best marketing asset.
- **Public Field Dispatch gallery `/hailmary/feed`:** standalone shareable route (server
  wrapper exports OG metadata; `FeedClient.jsx` renders) — polaroid-scatter grid of approved
  `oilFeed` items via the existing public `/api/oil-feed` (admin SDK, no index needed), each
  card linking to its `/snapshot/{id}` page (which already carries per-image OG/Twitter tags),
  with STAKE A CLAIM CTAs top + bottom. ⚠ The uploaded PNG **is** the polaroid —
  PolaroidSnapshot bakes the white frame + handwritten caption into the image, so the gallery
  renders it BARE (drop-shadow + scatter rotation + one metadata line: tag · username · time);
  wrapping it in another frame/caption gives polaroids-of-polaroids (fixed 2026-06-10). Linked from the in-game FIELD DISPATCH accordion
  header ("VIEW ALL"). Pre-existing pieces this builds on: PolaroidSnapshot's clipboard+tweet
  share w/ referral overlay, the `polaroids/{id}` OG docs, and the admin approve flow
  (`oil-feed-admin`, +1 bonus drill to the poster).

## Web Push Alerts (BUILT 2026-06-10)

FCM web push — the low-friction strike-alert channel (one tap on the device in hand, no
account linking). Telegram stays as the secondary channel (it can deliver CCTV video; push
can't).

- **Fan-out helper `src/lib/oilAlerts.js`** — `sendPlayerAlert(db, userId, {title, body, url,
  tag, telegramHtml, channels})` reaches Telegram + all registered push tokens in one call;
  best-effort per channel (never throws into the strike loop); prunes tokens FCM reports dead.
  `oil-strike-tick` now routes ALL its player alerts through it (hell-breach + strike on both
  channels; **dry layers are Telegram-only** so push keeps its signal value). TODO: migrate
  `oil-rogue` + demon-bounty victim alerts to the same helper.
- **Client hook `src/hooks/usePushAlerts.js`** — platform detection (`supported` /
  `needsInstall` for iOS-Safari-not-installed), `enable()` (permission → `getToken` with
  `NEXT_PUBLIC_FIREBASE_VAPID_KEY` → POST `/api/oil-push-subscribe`), silent token re-validation
  on revisit, `sendTest()` → `/api/oil-push-test` (self-only pipeline check).
- **Service worker `public/firebase-messaging-sw.js`** — data-only payloads rendered by the SW
  (no auto-display double-fire); Firebase config arrives via the registration URL's query
  string; notification click focuses/opens `/hailmary` (where the away-recap is waiting —
  push and recap are two halves of one loop).
- **PWA install** — `public/manifest.json` (`start_url: /hailmary`, standalone) + real icons
  (`icon-192/512.png`, `apple-icon.png` — rasterized from `hail-mary-icon.svg`; this also fixed
  the previously-dangling `/apple-icon.png` metadata reference) + `manifest`/`appleWebApp` in
  `layout.js` metadata. **iOS only delivers web push to Home-Screen-installed sites** — the UI
  detects that state and shows "Share → Add to Home Screen" instructions.
- **Storage `oilPush/{userId}`** — `{ tokens: [≤10, newest-wins], updatedAt }`; server-only
  writes via `/api/oil-push-subscribe` (Clerk-authed; DELETE unsubscribes a token); private by
  the deny-by-default Firestore rules (no rules change needed).
- **UI** — the pre-season "GET STRIKE ALERTS" ask is push-first (ENABLE ALERTS) with "or link
  Telegram →" secondary, plus "send a test ping →" / "turn off this device" links once enabled;
  the auto-pumping panel shows a 🔔 nudge for active-phase players with neither channel; admins
  get a STRIKE ALERTS (THIS DEVICE) panel under the fairness console (enable / disable / test
  with real FCM outcome readout).
- **Unsubscribe** — `disable()` in the hook: DELETE the token server-side + FCM `deleteToken`
  + clear the local flag (and suppress silent re-enroll for the session). Browser-level
  blocking also works ungracefully: FCM reports the token dead on the next send and
  `sendPlayerAlert` prunes it.
- **Env:** `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (the PUBLIC "Key pair" value from Firebase Console →
  Cloud Messaging → Web Push certificates; the private key never leaves Firebase). Must also be
  set in App Hosting for production.

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

### 🔖 Pick up later — payout open items (as of 2026-06-07)

The fixed-rate economy, both payout rails, the contract, its tests, and Slither are
all done and green. Outstanding before a real season:

1. **Reset stale-scale Firestore data (do this first).** Existing `oilDrills` /
   `oilPlots.revealed` / `oilGame/communityStorage` were accumulated at the old
   1M-unit scale, so EXTRACTED / VALUE read wrong against the current 500K field (the
   "one player's banked oil > whole field" symptom). Run `node scripts/oil-reset.js
   --dry-run` to preview, then without the flag to clear, then re-seed/re-drill.
   (Cross-scale data also makes `oil-payout.js` abort by design.)
2. **Rail choice is scale-gated.** Launch on **Rail A** (`oil-payout.js`, off-chain
   push). Only move to **Rail B** (the Merkle distributor) — and only then pay for an
   audit — once per-season escrow is large enough to matter.
3. **Before Rail B ever holds real money:** dry-run on Base Sepolia, then the
   stake-gated audit + the lottery-optics legal pass noted above.

## Development Notes (local dev server)

Hard-won on 2026-06-10 — the `/hailmary` page is huge and dev mode needs care:

- **Next 16 dev memory watchdog crash-loops this app on default heap.** Symptom: `/hailmary`
  takes minutes then the terminal prints `⚠ Server is approaching the used memory threshold,
  restarting...` — the dev worker restarts after (or during) every page load, dropping
  in-flight requests and recompiling from scratch each visit ("page won't load", `curl` gets
  empty replies / timeouts). Fix: the `dev` script now runs with
  `NODE_OPTIONS='--max-old-space-size=8192'` (machine has 64 GB). With the bigger heap the
  watchdog stays quiet and the Turbopack cache persists: `/hailmary` ≈ 1.7s cold / ~100ms warm.
- **Never run `next build` while `next dev` is running.** They contend on the shared `.next`
  directory; observed result was a wedged dev worker spinning at >300% CPU serving nothing.
  If the dev server is wedged: kill it, `rm -rf .next`, restart (first `/hailmary` compile
  after a cache wipe is the slow one — a couple of minutes).
- A second `next dev` instance fails on `.next/dev/lock` (and falls to port 3001) — one
  instance at a time.

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

## How-to-Play Intro Video

The first-visit "How to Play" modal (`OilWelcomeModal.jsx`) opens with a short intro: a
two-character dialogue between **St. GR80** (the monk) and **Connor** explaining the game.
What actually ships is a **pre-recorded MP4**, not a live avatar — see "Why a video" below.

### What's mounted

`OilWelcomeModal.jsx` plays a plain `<video controls playsInline preload="metadata">`:

- Video: `public/HMPC_Intro.web.mp4` (served at `/HMPC_Intro.web.mp4`)
- Poster: `public/HMPC_Intro_poster.jpg`

Tap-to-play with sound. No SitePal / WebGL at runtime, so it's bulletproof on mobile.

### Why a video (not live SitePal)

The characters are SitePal avatars. Driving them live in the modal was attempted and abandoned:

- **Two side-by-side live portals don't work** in this React/Next env. A single shared
  embed-functions load collapses both scenes onto portal `0`; loading the script per-portal
  yields distinct ids but the second load clobbers the first portal's registration, so
  `selectPortal()` silently no-ops. (Same limitation `/trade` hit — it uses one portal +
  `loadSceneByID` scene-swapping.)
- A **single-portal scene-swap spotlight** worked on desktop (both lip-sync, one shown at a
  time), but John's scene is **3D** (`SitePal3DJS_R.js`) and on the heavy oil-field page it
  **OOM-crashed iOS Safari/Chrome** when loaded.

A recorded video sidesteps all of it. The live components are kept in the repo for re-recording
(see below) but are not mounted in the modal.

### Re-recording the intro (full runbook)

Because two live portals can't render together, each character is recorded **separately on
desktop** (where the 3D scene is fine) and composited side-by-side in iMovie. The recording
studio enforces a shared timeline so the two clips alternate correctly.

**Studio route:** `src/app/hailmary/studio/page.js` → `/hailmary/studio`

1. **Calibrate once** (only needed if GR80's lines/voice change): open
   `/hailmary/studio?c=monk&cal=1`, click **Run Calibration**. It speaks GR80's lines, measures
   each duration, and saves them to `localStorage["hm_gr80_durations"]`. Do everything afterward
   in the **same browser** so the saved timeline is used. (John's durations are hard-coded from
   `afinfo` on the MP3s; estimates are used for GR80 if uncalibrated.)
2. **Record GR80:** open `/hailmary/studio?c=monk`. Start your screen recorder, click
   **Start Take**. A white **sync flash** plays at t=0, then GR80 speaks on his turns and idles
   during John's. Stop recording at "Take complete."
3. **Record John:** open `/hailmary/studio?c=john`, same steps. (Keep the browser window the
   same size/position between takes so the avatars match.)
4. **Composite in iMovie:** import both clips, drop John as an overlay on GR80, set the overlay
   to **Side by Side**, then slide it so both **white flashes** land on the same frame (that's
   the sync). Trim the ends, export.

**Screen recording on macOS:** use **OBS Studio**, run it from `/Applications` (not the mounted
`.dmg`), and grant **System Settings → Privacy & Security → Screen Recording** then relaunch.
macOS's built-in recorders don't capture system audio. OBS saves to `~/Movies` (format is
"Hybrid MOV" `.mov`, which iMovie imports fine).

**Compress before shipping** (iMovie 1080p exports are ~120 MB — too big for `public/`):

```sh
# from the exported master (keep the master OUT of public/)
ffmpeg -y -i HMPC_Intro.mp4 -vf "scale=-2:720" -c:v libx264 -crf 24 -preset medium \
  -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart public/HMPC_Intro.web.mp4
# poster frame (avoid t=0 in case of the flash/black)
ffmpeg -y -ss 3 -i HMPC_Intro.mp4 -frames:v 1 -vf "scale=-2:720" -q:v 3 public/HMPC_Intro_poster.jpg
```

That took the last cut from **124 MB → ~5 MB** at 720p with no meaningful loss at modal size.
**Only the ~5 MB web mp4 + poster belong in `public/`** — large source MP4s bloat every deploy
(and some hosts reject them).

### Head-turn (look at each other) — `setGaze`

For a livelier take, the listener can turn toward the speaker. SitePal exposes
`setGaze(degrees, duration, amplitude)` (this is exactly what SitePal's own conversation example
uses — `setGaze(90, 5, 100)` / `setGaze(270, 5, 100)` to turn left/right). `degrees` is the gaze
direction (clock-like; ~90 ≈ one side, ~270 ≈ the other — tune per scene), `duration` seconds,
`amplitude` 0–100 how far the head turns. Since the takes are recorded separately, give each
character a gaze toward where the **other** sits in the final side-by-side (GR80 is on the left →
gaze right toward John; John on the right → gaze left toward GR80), e.g. turn toward the other
while listening and back toward camera while speaking.

**Implemented in `studio/page.js`** (2026-06-09): the take recenters the gaze (face camera) on the
recorded character's own slots and turns toward the other on the other's slots. Tune the
`GAZE` constants at the top of that file: `monk.lookDeg` / `john.lookDeg` are the turn directions
(clock-like — if someone turns the wrong way, swap their value, try `90` ↔ `270`), `amp` is how
far (0–100), `durationSec` how long the turn holds. Eyeball it in `/hailmary/studio?c=monk` and
adjust before recording.

### Intro SitePal scenes (account 9308752)

The intro uses **dedicated** scenes, distinct from `/trade` (so retuning the intro never touches
the game). Update these only in `HowToPlayDialogue.jsx` and `src/app/hailmary/studio/page.js`:

| Character | Intro scene | Hash | `/trade` scene (do not touch) |
|-----------|-------------|------|-------------------------------|
| St. GR80  | `2775053` | `I0s05E8rXxvHYHdJIPmcIU5msqkW6t0A` | `2774449` |
| Connor | `2775052` | `IMtOuXOufh3OnQ9ZYUXc2DoYe39vRePb` | `2774900` (Demon) |

- **GR80** speaks via SitePal TTS: `sayText(text, "9", 1, 7, "T", 3)` (voice 9 "Gilbert", engine 7
  Acapela, reverb).
- **John** speaks uploaded audio tracks `john_01`..`john_06` (in the account's Audio Manager) via
  `sayAudio(name)`. The same clips also exist at `public/audio/john_0X.mp3`. SitePal can only
  speak audio it hosts — a `/public` URL or `sayMP3audio(url)` did **not** work; tracks must be
  uploaded by name.

### Key files

- `src/components/OilWelcomeModal.jsx` — the modal; mounts the `<video>`.
- `src/app/hailmary/studio/page.js` — recording studio (one character per take, shared timeline,
  sync flash, GR80 calibration).
- `src/components/HowToPlayDialogue.jsx` — the (now-unmounted) live single-portal scene-swap
  dialogue, kept for reference / future use.
- `public/HMPC_Intro.web.mp4`, `public/HMPC_Intro_poster.jpg` — shipped assets.
*