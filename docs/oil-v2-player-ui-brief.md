# /hailmary v2 — Player UI pass: design brief

_2026-09-27 · handoff for the Michelle-led pass (build-order step 6, season-one IN #2 in
[oil-game.md](oil-game.md)). Everything the pass needs is on this page or one link away;
nothing here requires reading the code to design against._

## 1. What the pass is

Style and lay out the v2 **decision surfaces** and the **season-end reckoning** so a
first-time player, on a phone, reads a strike alert and states the cost model back
correctly, decides in one tap, and understands what happened at the buzzer.

**Fixed inputs (not the pass's to change):** the loop rules, the copy rule (§4), the data
each surface receives (§6 — the props contracts), the fairness constraints (§5), and the
handlers behind every button. **The pass owns:** layout, hierarchy, colour language, type,
motion, iconography, the split of surfaces between the sidebar card and the in-world rig
panel, and the wording *within* the copy rule.

**Done looks like:** the same components with the same props, restyled; a state sheet
(§3) with every state designed; the open decisions in §8 answered.

## 2. The surfaces — inventory

| # | Surface | Where it lives | Status | File |
|---|---|---|---|---|
| A | **Core Sample card** — the decision surface. **Two builds, same props:** `OilCoreSampleV2` (everything on one surface — Michelle: "too dense", 2026-09-28) and **`OilCoreSampleV3`** (the /space module layout, one decision per screen: CORE · NEXT DOOR · LEDGER tabs, the core cylinder as the rack, two big stats, one CTA row, crew orders behind a link; wall colour schema). V3 is the design-pass base; V2 stays for comparison on the fixture | Sidebar YOUR RIG card (desktop); the panels under the 3D tab (phone) | V3 built plain 2026-09-28, not yet mounted on the live page | `src/components/OilCoreSampleV3.jsx`, `OilCoreSampleV2.jsx` — **2026-09-29: V3 moved onto the `HmHud` kit** (the /space panel chrome, fixed palette; `theme` prop now unused; tabs CORE SAMPLE / NEXT DOOR / LEDGER; each tab ends in a caption + two big stats; EXTRACT is the clipped-corner button; crew orders behind the hint line) |
| B | **In-world machine panel** on the player's rig — pressure gauge, panel screen, the caged PASS (2026-09-08), the red button, four toggles, a key switch, crew who walk to the button on a decision. **Wired 2026-09-28 (v2, own rig only):** caged PASS → pass; red button → EXTRACT; toggle 1 → SALVAGE order (plate under its lamp), toggles 2–4 dead; key → AUTOPILOT (plate under the key); switches pose from the rig doc | Desktop: click the rig; phone: the MACHINE PANEL chip zooms to it | Wired; styling of plates is the pass's | `src/components/OilVoxelGrid.jsx` (Pumpjack: `decideMode`, `orders`, `panelLabels`), `RigCrew.jsx` (`hm:decide`) |
| C | **Strata wall** — the earth block as public game-state voxels: passes, extractions, wildcat scars, tunnel bars for salvage | 3D scene, loopV2 seasons | Built (promoted from the `?strata=1` mock) | `src/components/StrataVoxels.jsx` |
| D | **Alerts** — push + Telegram on every strike (`CORE ASSAY — LAYER n` with the cost-model body), hell breach, tonic cap, artifact, dry layer | Phone lock screen, Telegram | Built, copy follows the rule | `oil-strike-tick/route.js` ~530–665, `lib/oilLoopV2.assayAlertBody` |
| E | **While-you-were-away recap** | v2 desktop: **the rig crew delivers it** — on return the page selects your rig, the operator briefs — spoken through SitePal when the page already has a user gesture (`navigator.userActivation.hasBeenActive`), by bubble otherwise with a 🔊 HEAR IT button on the chip whose click is the gesture — the camera flies to them, a gold chip offers HEAR IT / READ IT / ✕. Phone, low graphics, or no crew in 6 s: the card. | **Built 2026-09-29**: `v2away` (per-core outcomes: kept · taken · open · dry · hell · table; neighbours' takes; the crew's takes) + the crew's v2 lines; card hero = BTR banked by the crew, per-core rows, no share (the share is the polaroid thread) | `src/components/OilAwayRecap.jsx`, `RigCrew.jsx` (`brief({voice:false, auto:true})`, `hm:brief-end`, `BRIEF_FOCUS_DIST`), `hailmary/page.js` (`v2away`, `recapDelivery`) |
| F | **The Reckoning** — the per-player season-end **share card** (2026-09-29: replaces FINAL HAUL under v2) | The season-end slot, both layouts, every v2 rig, dry included | Built in the **/space telemetry-panel language** (Michelle, 2026-09-29: "the displays from /space still look better") on the shared **`HmHud`** kit: dark glass + gold brackets, Orbitron title, RECKONING / FULL ACCOUNT tabs, plain-English story line, 20-cell column strip, label/data/warn/note body, two big stats, "Share the Reckoning?" button (PNG → native sheet / clipboard + X compose with referral link), text-copy hint | `src/components/OilReckoning.jsx`, `src/components/HmHud.jsx`, `lib/oilLoopV2.js` (`reckoningStory`, `reckoningShareText`, `reckoningStrip`) |
| G | **FINAL HAUL share card** (PNG capture + tweet) | v1 only now (`!loopV2`) | Built, v1 numbers (banked + tank) | `hailmary/page.js` `finalHaulCard` |
| H | **Walk mode** — stand on a frontier cell, press E to wildcat | 3D, desktop | Built (beta) | `src/components/PlayerWalker.jsx` |
| I | **Onboarding** — welcome modal saints, intro video, how-to-play | First visit | **Still says BANK** ("Bank what you find", "Bank often") | `OilWelcomeModal.jsx`, intro video |

The pass is A, F and E first. B is the big design question (§8.2). D's copy is fixed by the
rule; its *tone* is open. G and I are copy sweeps, not design.

## 3. States — the sheet to design against

Every state below exists in code today and can be reached with real data. A design that
misses one will show plain chrome there.

**A · Core Sample card**

| State | Trigger | Must show |
|---|---|---|
| Nothing on the table | `pending == null`, season live | cadence line ("next lands before …"), the rack, standing order |
| Pending · wet · above the line | `oil ≥ threshold` | assay, cost copy, "crew would EXTRACT" + deadline, both verbs |
| Pending · wet · below the line | `oil < threshold` | same, "crew would PASS" — this is the decision moment |
| Pending · dry | `oil == 0` | "passing is free", PASS only makes sense; EXTRACT still allowed (never hidden) |
| Pending · inclusion flagged | `hasInclusion` | the anomalous-inclusion ping; "only recovered on EXTRACT — the crew never gambles on it" |
| No charges left | `chargesRemaining == 0` | EXTRACT / TAKE / WILDCAT disabled, PASS live, CHARGES in red |
| Column fully revealed | `remainingLayers == 0` | "nothing more comes up; the buzzer settles what's on the table"; charges still work next door |
| Hot within reach (two down, or next door) | `pending.heat` / `plot.heat[layer]` = `elevated` | Temp elevated · "!! HEAT RISING — SOMETHING HOT WITHIN REACH !!" · glow under the bore head · note: hell or the big one, under you or next door |
| Hot directly below | … = `high` | Temp high · "!! HOT ZONE DIRECTLY BELOW — HELL OR THE MOTHERLODE !!" · red tube outline · persists after the decision until the next strike · the CASING block: strings on the rig, CASE THE NEXT LAYER / DISARM, the forfeit spelled out |
| Casing armed | `casingArmed` | orange CASING block: "ARMED — the next layer is drilled behind steel", disarm button; the crew line says so |
| Cased layer | `plot.cased[layer]` | steel-blue band; ledger "cased through · a pay zone, cased off · N behind steel" / "hell, sealed"; reckoning Cased line + strip |
| Season over | `gameEnded` (the flag, never the clock alone) | hand-off to the Reckoning |
| Season clock run out, not ended | stale start date on a live board | "clock has run out · the buzzer settles what is on the table"; never "closed" |
| No season clock | legacy settings | no cadence line at all (never a fake one) |
| Salvage board | ≥ 1 open pocket next door | first-lateral-wins framing, TAKE −1⚡, +N more |
| Frontier board | ≥ 1 unclaimed neighbour in reach | "blind · assay unknown", WILDCAT −1⚡ |
| Ledger | empty / populated | totals always; rows behind a toggle today (open question §8.5) |
| Spectator · no rig | viewer has no claim (2026-09-28) | the same card, read-only, on the SELECTED plot as the field sees it: owner, revealed, extracted, open pockets, hell; "claim a plot to drill your own"; no verbs, no tabs. **CLAIM THIS PLOT** button when the server would accept it (registration pre-anchor for players; testers while testing is on), else the reason (sign in / claims closed / season over) |

**Core rack cell states (9):** undrilled · pending · extracted · passed (open) · salvaged
(a neighbour took it) · dry · hell · hell capped · revealed (neutral). Plain chrome uses
one glyph each and a legend; the wall already has a colour language for the same states
(§8.1).

**F · The Reckoning**

| State | Trigger | Must show |
|---|---|---|
| Seed published | `revealedSeed` set (post-`gameEnded`) | full column total, never-reached oil, capture % |
| Seed not yet published | ended, seed pending | "N layers still sealed" — never a guessed total |
| Dry rig | banked 0 | the honest "here is what was under you" — this player deserves the best version of the card |
| Core left on the table | `pendingUnresolved` | one line: the crew settles it by the standing order |

**E · Away recap (built for v2, 2026-09-29)** — the crew's briefing on the desktop field,
the card as READ IT and on the phone. Lines, in order: how long you were gone · N cores came
up, L_a to L_b · we kept N, X BTR banked · passed N wet, X BTR still open next door · N of our
passes got taken · N came up dry · we hit hell · neighbours took N of our old pockets · we took
N pockets next door on your orders · L_n is on the table: X BTR · your line says keep it /
pass — by HH:MM · N charges left · one field event · unread messages. Tones per line drive
the crew's gesture (yes = nod, no = shake, thoughtful). The card mirrors it: hero = BTR
banked by your crew, one row per core with its outcome, the neighbours' and the crew's
takes, the core on the table with the crew's call. Tunables: `BRIEF_FOCUS_DIST` (camera
distance to the briefer, 0.7) and `BRIEF_LINE_S` (3.2 s a line) in RigCrew.jsx.

## 4. The copy rule and the vocabulary

**Copy rule (playtested 2026-08-26, binding):** every decision surface and alert states the
cost model explicitly — *"EXTRACT banks the full N BTR for 1 charge · PASS is free but final
(opens to neighbours)."* The threshold is **never** shown bare: a playtester read "your
line: 764" as a *price* ("do I spend 764 to get 1,285?"). It is always the crew's standing
order: *"if you're away, the crew follows your standing order (extract ≥ 800) → would PASS."*

| Say | Never say | Why |
|---|---|---|
| charge (⚡) | drill, bonus drill | a charge is what you spend; the bore drills by itself |
| standing order | threshold, line, limit, price | see above |
| EXTRACT (the one button); CASE THE NEXT LAYER only when the reading is hot | bank, keep, skip, PASS as a big button, "let it go now", cap it | one button (2026-09-28): doing nothing = the crew's orders; no pass control at all (2026-09-29); casing is the one other verb and it forfeits the layer |
| LATERAL EXTRACT (the switch) · ORDERS / AUTO-PILOT (the key) | SALVAGE as a control name, MANUAL | the crew is always active; the key sets how much initiative it takes |
| salvage · taken | poach, steal | a lateral takes what its owner discarded; the race is between rivals |
| frontier · wildcat | claim-jump, raid | unclaimed ground, drilled blind |
| core · assay · BTR | oil amount, score | the number is exact; the ambiguity lives only in the inclusion ping |
| hell pocket · tonic caps it | trap, curse | one consumable, one moment |
| stranded · stayed in the ground | lost, stolen | nothing kept was ever touched |
| "next lands before 14:32" | "next strike at 14:32" | the moment is unguessable by design (§5) |

## 5. Constraints that are not negotiable

- **No seed on the client during a season.** The card and rack render only server
  reveals and public plot fields. The reckoning regenerates the player's column from the
  seed only after `gameEnded`. A design cannot ask for a number the client does not have
  (e.g. "how much is left in my column" mid-season — it is unknown by construction; the
  SEISMIC lower bound is the honest stand-in).
- **The strike moment stays unguessable.** The countdown shows the end of the reveal
  window, never the target. "In 3.2 h" means "no later than", and the copy must read that
  way.
- **Numbers are real.** The assay is exact. Only the inclusion is ambiguous ("anomalous
  inclusion detected"). Nothing may imply odds on the oil number.
- **Every action states its cost on the control** (−1⚡), and PASS is always marked final.
- **Six theme palettes** ship: `light`, `duskLight`, `Geode`, `dark`, `solsticeLight`,
  `parabolumDark` (`hailmary/page.js` ~258–400). Components receive `theme` tokens
  (`text`, `muted`, `gold`, `green`, `red`, `warn`, `border`, `accent`); a design must
  hold in all six. **2026-09-29:** the V3 core sample, the spectator card and the reckoning run the `HmHud` kit (the /space panel) — a dark instrument screen on every console, **tuned per theme** (`THEME_HUD` in `lib/hailmaryThemes.js`, merged by `hudFor(theme)`): dark consoles keep the dark screen in their own ink and bright (cyan on the blue ones, mint on the violet); **paper consoles put the card ON the paper** (second pass, same day — a dark screen still fought the page): the page tone one shade deeper, ink text, deep teal data (the survey map's BTR swatch), darker gold brackets, no glows. The "HAIL MARY PROSPECTING CO." heading is gone from the cards. **One title per section** (Michelle, 2026-09-29): on the page the cards render `chrome="section"` — no meta row, no corner brackets, flat inset — and the section's own title row carries the status cluster (`HudTitleStatus`: PLOT · **next core in 6.5 h** · ● LIVE — the cadence moved up out of the card, where its gold line read as a second title; the spectator section shows 01/20 instead); the reckoning sits in a THE RECKONING section the same way. Section tabs are **underline** tabs (a hairline under the row, the active tab underlined in the data colour), not the boxed /space strip. The fixture keeps the standalone card form (brackets, meta row, cadence line, boxed tabs). The column beside the cylinder uses label-over-value fields (`HudField`), not padded lines — they wrapped word by word. The FINAL HAUL card is the older exception (fixed dark palette for PNG
  capture).
- **Phone first**: the card lives in a panel column under the 3D tab; 16 px gutters, no
  horizontal scroll; the rack is 20 cells wide on a ~360 px column.
- **Type**: `'Share Tech Mono'` is the instrument voice throughout the panels.
- **Handlers are fixed:** `onDecide`, `onSetThreshold`, `onLateral`, `onWildcat`,
  `onWalk`. Wire the in-world PASS/EXTRACT to the same handlers (they already dispatch
  `hm:decide` for the crew).

## 6. Props contracts (design against these; nothing else is available)

**`OilCoreSampleV2`**
```
theme, pending: { layer, oil, hasInclusion, revealedAt } | null,
chargesRemaining, chargesCap, threshold,
salvage: [{ col, row, layer, oil, hasInclusion }],
frontier: [{ col, row, layer }],
cadence: { intervalMs, latestMs, remainingLayers, seasonEndMs } | null,
rack:    [{ layer, state, oil, hasInclusion, takenBy }]            // 20 entries
ledger:  { rows: [{ kind: extract|pass|salvage|wildcat, layer, oil, charge, col?, row?, takenBy?, hell? }],
           banked, chargesSpent, extractedOwn, salvagedIn, wildcatIn, wildcatDry, wildcatHell,
           passedTotal, takenByRivals, leftOpen }
onDecide(action), onSetThreshold(btr), onLateral({col,row,layer}), onWildcat({col,row,layer}), onWalk(),
orders: { salvage, autopilot }, onSetOrders({ salvage?, autopilot? }), ended, spectator
```
Ledger rows carry **no timestamps** (none are stored) — own rows sort by layer, then
salvage, then wildcats by coordinate. A timeline design would need a server change (out
of scope for season one).

**`OilReckoning`**
```
theme, col, row, refCode (referral code for the share link), shareUrl ("rl80.com/hailmary"),
reckoning: { banked, payoutUsd, usdRate,
             columnTotal, unknownLayers, hellLayers, hellCapped,
             extractedOwn, captureRate | null,
             passedTotal, takenByRivals, leftOpen,
             neverReachedLayers, neverReachedOil, stranded,
             salvagedIn, salvageCount, wildcatIn, wildcatDry, wildcatHell, wildcatCount,
             chargesSpent, chargesCap, chargesUnspent, pendingUnresolved,
             layers: [{ layer, oil | null, hell, reached }], ledger }
```
`reckoningText()` in `lib/oilLoopV2.js` is the plain-text version (COPY REPORT) — the
share card's words, if the reckoning becomes the share.

## 7. The plain versions, as they read today

Server-rendered text of the current components (styling stripped), so the pass starts
from what exists. Sizes: the card is ~330 lines of plain JSX; the reckoning ~110.

**Card · pending, below the line, inclusion, everything populated**
> CORE SAMPLE — EXTRACT OR PASS · CHARGES 6/8 · REVEALS every 9.1 h · next lands before
> 10:40 AM (in 7.1 h) · 13 layers to go · CORE RACK — your column, L1 → L20
> `✕ ■ ○ ▣ ⛨ ○ ? · · · · · · · · · · · · ·` · L7 · 300 BTR · 🏺 ANOMALOUS INCLUSION ·
> EXTRACT banks the full 300 BTR for 1 charge · PASS is free but final (opens to
> neighbours). The inclusion is only recovered on EXTRACT — the crew never gambles on it.
> Revealed 25m ago · if you do nothing, the crew follows your standing order at the next
> strike — before 10:40 AM (in 7.1 h) → would PASS. [EXTRACT −1⚡] [PASS · FINAL] ·
> SALVAGE BOARD — open next door · first lateral wins · (4,3) L10 · 700 BTR [TAKE −1⚡] ·
> FRONTIER — unclaimed ground in reach · blind, first wildcat wins · (2,2) · deepest in
> reach L5 · 🎲 assay unknown [WILDCAT −1⚡] · LEDGER [5 ENTRIES ▾] BANKED 1,000 BTR ·
> 2/8 charges spent · passed 900 BTR — neighbours took 900, 0 still open · salvaged in
> 600 · wildcats +0, 1 dry · STANDING ORDER: extract ≥ [800] BTR [SET]

**Card · nothing on the table, no season clock, fresh rig**
> CORE SAMPLE — EXTRACT OR PASS · CHARGES 8/8 · CORE RACK `· · · · …` · No core on the
> table — the next strike pulls one. Your standing order decides it if you're away. ·
> LEDGER [0 ENTRIES ▾] BANKED 0 BTR · 0/8 charges spent · STANDING ORDER …

**Card · column fully revealed**
> COLUMN FULLY REVEALED — nothing more comes up; the buzzer settles anything still on the
> table. · No core on the table — your column is fully revealed. Charges left still work
> next door and on the frontier.

**Reckoning · seed published**
> THE RECKONING — SEASON CLOSED · plot (3,3) · BANKED 1,000 BTR ≈ $1.00 USDC · real USDC,
> paid to your wallet on Base at the season's fixed rate · YOUR COLUMN · under your column
> 1,550 BTR · 1 hell pocket (1 capped) · you extracted 400 BTR (26% of your column) · you
> passed 900 BTR · neighbours took 900 BTR · stayed in the ground 0 BTR · never reached 2
> layers · 250 BTR · stranded — never banked 250 BTR · BEYOND YOUR FENCE · salvaged next
> door +600 BTR · 1 lateral · wildcats +0 BTR · 1 dug, 1 dry · charges 3/8 spent · 5 wasted
> [COPY REPORT]

**Reckoning · seed not yet published**
> under your column (2 layers still sealed) 1,300 BTR … never reached 2 layers · sealed …
> The sealed layers fill in when the season's seed is published — check VERIFY THE MAP.

## 8. Open decisions for the pass (Michelle's)

1. **One colour language for cell states.** The strata wall already speaks: gold pulse =
   pending, dark = extracted, green = passed (open), amber = taken by a neighbour, red =
   hell, grey stub = dry wildcat. The plain rack currently uses **green for extracted** and
   a gold outline for passed — it disagrees with the wall. Pick one language and apply it
   to the rack, the ledger, the wall and the reckoning.
2. **Where does the decision live on desktop — the rig or the card?** The in-world panel
   (gauge, screen, DEPTH board, PASS cover, crew) is already the more theatrical surface
   and the MACHINE PANEL chip exists to reach it. Options: (a) rig panel is primary,
   card becomes ledger + boards; (b) card is primary, rig panel mirrors state only;
   (c) both act, same handlers. Phone is card-only either way.
3. ~~**Does the Reckoning replace the FINAL HAUL card as the share?**~~ **Yes (Michelle, 2026-09-28; built 2026-09-29).** One card, PNG-captured in the fixed palette, dry players included. The card's composition (which four totals, the strip, the words) is provisional — Michelle modifies on the fixture.
4. ~~**The away recap for v2.**~~ **Built 2026-09-29** — the crew delivers it (§3·E); the
   card is the fallback. Open: whether the phone should also use the crew (RigScene mounts
   one) once the camera framing is designed there.
5. **Ledger: totals + toggle, or always-open list?** Rows have no times; a "timeline"
   look would promise ordering we don't have.
6. **Rack orientation.** Horizontal strip (fits the phone column) vs a vertical core that
   matches the physical core sample and the wall's columns.
7. **How loud is the countdown?** A deadline that reads as urgency drives checking; one
   that reads as a timer contradicts "never punished for being offline" (the standing
   order already covers you). The copy says "if you do nothing" for that reason.
8. **Alert tone.** Titles today: "⛏ CORE ASSAY — LAYER 7", "🔥 YOUR RIG BREACHED A HELL
   POCKET!", "🧪 TONIC CAPPED A HELL POCKET", "🪨 Dry layer". Same information, the voice
   is open.

## 9. How to see the states while designing

- **Live components with real data:** admin test tools on `/hailmary?mode=test` (the
  LAYER stepper reveals; EXTRACT / PASS / LATERAL controls and a threshold field are on the
  v2 build list and should be added if not present — one-line ask to whoever picks this
  up). `settings.loopV2 = true` on the dev season.
- **The wall's mock season:** `/hailmary?strata=mock` runs a 90-second v2 season on the real
  seeded field with PLAY / +1 DAY / PLAY AS controls — the fastest way to watch pending →
  resolve → salvage rhythm. (`?strata=1` shows the LIVE field when the v2 flag is on, which
  is empty until real strikes land — that is what Michelle saw on 2026-09-28.)
- **Every state on one page — BUILT 2026-09-28: `/hailmary/fixture`.** Mounts the Core Sample
  card in every §3 state, the Reckoning in its four states, and the away recap (v2 and v1),
  in any of the six themes at 360 / 420 / 560 px. The PLAYABLE card at the top is a local
  sim: EXTRACT / PASS / TAKE / WILDCAT mutate mock docs the way the routes do, NEXT STRIKE
  resolves by the standing order and reveals the next layer, END SEASON hands the same world
  to the Reckoning. Static data, same builders as the live page, nothing touches the game.
  Not indexed. Design here; regressions show here first. **V3 / V2 / side-by-side** switch at the top
  (2026-09-28): V3 is the three-tab /space layout; V2 the plain stack.

## 10. Hand-back

The pass returns: the two components restyled against the §6 contracts (props unchanged;
new presentational props are fine), the state sheet with each §3 state screenshotted on
phone and desktop in at least `dark` and `light`, the §8 answers written into
[oil-game.md](oil-game.md) as dated decisions, and the list of copy changes (all within
§4). Anything that needs data the props do not carry goes on the season-two list with a
line saying what server field it would need.
