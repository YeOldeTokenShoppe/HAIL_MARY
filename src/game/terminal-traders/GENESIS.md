# Terminal Traders — Genesis Trading Card Collection & Game

*Working design doc. Follows the convention of `src/game/ascension/SLICE.md`.
Status markers reflect the codebase as of 2026-07-06.*

---

## 1. Positioning

**Collection-first, game-legitimized.** The Genesis 80 card set is the
product; Terminal Traders (the card game) is what makes the cards *real* — a
card whose ability demonstrably does something in a game is categorically
different from art with flavor text. Most buyers of any TCG never play it
(Pokémon's collectors vastly outnumber its players); the game exists so the
collection has rules-text gravity, a free on-ramp, and instrumental demand
("I need this card in my deck"), even if pure collection becomes the primary
driver.

The set lives in the RL80 / Our Lady of Perpetual Profit universe. Cards are
artifacts of the site's existing mythology — Eugene, Marisol, the Demon
of Wall Street, votive burns, the Prophet cases — not generic crypto art.

**Seasons.** Genesis is set one. If demand proves out, later sets follow the
Pokémon expansion model (new themes, same template/pipeline). AI-generated art
keeps a season's marginal cost near zero, so Genesis revenue funds Season 2
almost regardless of scale.

---

## 2. The Genesis 80

80 cards total, defined in [`cards.js`](./cards.js) (single source of truth):

| Type | Count | Notes |
|---|---|---|
| Traders | 4 | The cast: Eugene, Marisol, Halo Node, Bullhorn Broker. All Mythic. Playable characters, never in the draw pool. **Cast reconciliation planned** — Halo Node → Saint GR80, Bullhorn Broker → John Barron, Eugene recharacterized (pattern/rare-finds, not memes); see [CASE_TABLE.md](./CASE_TABLE.md) §2. |
| Coin cards | 28 | Buy-and-hold portfolio entries. `cost` → `baseValue`, plus `volatility` (bot-AI signal today; reserved for future market mechanics). |
| Action cards | 33 | One-shot effects. Engine-supported effect fields: `portfolio`, `cred`, `shield`, `draw`, `opponentPortfolio`. |
| Market cards | 15 | Global end-of-round events. Effect fields: `portfolioAll`, `credAll`, `styleBonus`, `stylePenalty`, `styleCred`, `crash`. |

**Rarity tiers & foil mapping** (applied automatically by
[`templateCard.js`](./templateCard.js)):

| Rarity | Foil tier on card | Notes |
|---|---|---|
| common | subtle | |
| uncommon | subtle | |
| rare | v | |
| mythic | hero | traders |
| terminal-foil | radiant | 3 exist: Genesis Terminal, Our Lady RL80 (coins), Terminal Foil Moment (action — the only foil action, keep it unique) |

Edition numbers ("n/80") derive from each card's position in `GENESIS_SET` —
stable as long as new cards are only ever appended. **Pre-art-lock, the set
is a live draft** (decided 2026-07-11): ids, tags, and card lists may be
revised freely until the Genesis art run lands and packs go on sale, at
which point ids/editions freeze and append-only takes over
(see [CASE_TABLE.md](./CASE_TABLE.md) §2.3 and §3.2a).

**Balance envelope** (hold these when adding cards): coin value ≈ cost +2…+5;
action portfolio gain ≈ 3–5× cost; volatility 0–7. Cross-universe names are
encouraged (Monk Stack, Demon Desk, Oil Standard, Lucky Capsule, Prophet
Margin) — they make the set a tour of the RL80 world.

---

## 3. Game rules (as implemented)

- 4 players: the human's chosen trader + the other three as AI bots with
  personality-driven card preferences (`BOT_PERSONALITIES` in
  [`engine.js`](./engine.js)).
- Win: first to **100 Portfolio**, or highest Portfolio after **10 rounds**.
- Turn: up to **2 plays**; Cred pays card costs; bank +3 Cred when nothing is
  playable; end of round flips a Market card affecting everyone; shields
  absorb one negative market hit.
- Trader abilities are engine-coded per trader id (e.g. Eugene's first meme
  coin +8; Halo Node ignores the first crash).
- Engine is **pure JS, framework-free, seeded-deterministic** — simulate
  thousands of games headlessly for balance work (200-game sim suites were
  used to validate the Genesis 80 and the starter deck).

---

## 4. Architecture

```
src/game/terminal-traders/
  cards.js          # the 80 card definitions (data only)
  engine.js         # pure game engine; createGame({ traderId, seed, cardPool })
  collection.js     # STARTER_SET, normalizeCollection, buildDeckFromCollection
  packs.js          # pack odds, tx-hash-seeded openPacks(), USD->packs math
  templateCard.js   # engine card -> TradingCard template data; CARD_ART map
src/components/
  TradingCard.jsx        # the 744x1038 holofoil card template (also used by /card-template)
  TerminalTradersGame.jsx# game UI; inspect overlay renders real TradingCard
src/hooks/
  useCardCollection.js   # client hook: fetch collection, derive deck pool
src/lib/
  tcgCollection.js       # server-only ownership writes (Admin SDK)
src/app/api/tcg-collection/route.js     # GET: collection (+ one-time starter grant)
src/app/api/tcg-pack-purchase/route.js  # POST {txHash}: burn -> packs -> cards
src/app/terminal-traders/page.js        # signed-in: owned pool; signed-out: full pool
```

**Ownership trust model** (mirrors `burn-offering`): Firestore
`cardCollections/{userId}` = `{ cards: {cardId: count}, total,
starterGrantedAt }`. Client writes are blocked by `firestore.rules`
(public read for future shareable binders); the **only** writers are server
routes using the Admin SDK via `tcgCollection.js`. Every grant also writes an
audit doc to `cardGrants` (`userId`, `source`, `cards`, `at`) so any owned
card traces to a recorded grant. Identity always comes from the verified
Clerk Bearer token (`authedUserId`), never a request body.

**Starter deck**: 18 distinct / 22 copies, commons + two cheap uncommons,
granted idempotently on first `/api/tcg-collection` fetch. Validated: ~90% of
simulated starter-deck games reach 100 Portfolio inside 10 rounds. Rares and
foils are pack-exclusive by design.

**Collection-gated play**: `createGame` accepts a `cardPool` built from owned
cards (one entry per copy). Pools under 10 cards fall back to the full set so
a broken collection can never produce a dead table.

---

## 5. Card art pipeline

- Template: `TradingCard.jsx`, tuned at `/card-template` (art-Y / zoom / foil
  controls). 744×1038 standard, 1488×2076 retina export.
- **Generate raw artwork only** — portrait, ≥744×1038, no frames, no text.
  The template supplies the frame, name, stats, ability box, foil. The two
  legacy assets (`coinCard_MoonPony.png`, `actionCard_PumpSignal.png`) are
  pre-rendered full cards and are hard-cropped as a stopgap
  (see `CARD_ART` in `templateCard.js`); regenerate them as raw art.
- Per-card wiring is one `CARD_ART` entry:
  `{ src, artFocus, artZoom, overlayImage? }`.
- **Style bible before batch generation.** 80 images generated ad-hoc will
  read as five different sets. Lock palette (the app's neon-noir), framing,
  and recurring motifs; generate in themed batches; spend iteration time on
  the ~12 rares/mythics/foils that will get screenshotted and shared.

---

## 6. Economy design

Three rails, deliberately separated:

1. **RL80 burn → standard packs** (token utility, zero revenue by design).
   Clone the hardened `burn-offering` flow: client burns RL80 to the dead
   address, POSTs the tx hash, server verifies the Transfer event on-chain,
   credits sealed packs. Deflationary; no project wallet ever accumulates
   RL80 (avoids "dev dumping" optics — see the `DEV_WALLET` note in
   `src/lib/contracts.js`). Price packs in USD-equivalent RL80 via the
   existing `rl80-price` API.
2. **USDC → premium SKUs** (the revenue rail). Reuse the x402 checkout from
   `oil-purchase` (settles to `rl80treasury.base.eth`): numbered collector
   editions, guaranteed-foil packs, season boxes, direct card purchases.
3. **Earn** — pack rewards from gameplay (wins/streaks/daily), Prophet case
   results, oil milestones. Required for engagement *and* the regulatory
   posture below.

Optional hybrid: standard pack price split 80% burn / 20% to the rewards
splitter to fund race/tournament prize pools — visibly recycled to players.

**Pack system as implemented** (`packs.js` + `/api/tcg-pack-purchase`):
5 cards per pack, **$3/pack** in USD-equivalent RL80 (5% price tolerance,
max 20 packs per tx). Slots 1–4 roll 68% common / 22% uncommon / 8% rare /
1.5% mythic / 0.5% terminal-foil; slot 5 is guaranteed uncommon-or-better
(70/24.5/4/1.5). **Contents are seeded by the burn tx hash** — deterministic,
publicly re-derivable, impossible to reroll. The route verifies the burn
on-chain (RL80 Transfer → dead address, 2h freshness), binds the claim to the
authed Clerk user (must match the registered oil wallet when one exists), and
commits the one-claim-per-txHash doc (`packBurns/{txHash}`) atomically with
the card grant. Odds verified over 40k simulated packs.

**Compliance guardrails** (not legal advice; get counsel before launch):
randomized paid packs are loot boxes. Publish exact drop odds; provide a
deterministic path to every card (direct purchase or crafting from dupes);
keep the earn path viable; never market cards as investments. Duplicates need
a sink regardless — crafting (e.g. burn 3 commons → 1 uncommon roll) solves
dupes and deterministic access at once.

**Revenue expectations, honestly**: direct revenue scales with community
size (~200 active collectors × ~$15/mo ≈ $3k/mo gross). The larger effect is
token demand/retention from the burn sink; USDC premium sales spike around
drops (a weekly drop cadence = 52 spikes/yr); royalties are a bonus, not a
pillar.

---

## 7. Launch strategy

Active site surfaces (as of 2026-07-06): `/`, `/main`, `/trade`,
`/fountain`, `/exlibris`, `/hailmary`. The card economy maps onto them:

- `/` (root): the burn ritual + pack pulls scrolling in the ticker.
- `/hailmary` (oil game): earn path + existing USDC purchase plumbing.
- `/trade`: the play surface (side-dock slot per the /trade revamp plan).

Seed demand before opening destinations: first packs arrive as rewards from
live loops (Prophet case wins, oil milestones), the ticker shows pulls, and
the binder/game pages go live once people are already holding packs.
(Note: `/gachapon` is an archived novelty page, NOT part of this plan — the
pack-opening reveal mechanism is an open design question.)

---

## 8. Native-engine client (Unity / Godot) — considered option

The R3F performance concern is real but scoped: **Terminal Traders itself is
DOM/CSS and has no 3D perf problem.** The concern applies to Ascension-style
scenes (many animated GLB characters + effects), especially on mobile. If
those grow beyond a few racers, a native engine client is a legitimate path.

Ground rules that keep the option open (already true today, keep them true):

- **The server is the game's spine, not the renderer.** Card definitions,
  ownership (`cardCollections`), grants, and (future) pack RNG are
  authoritative server-side. Any client — web, Unity, Godot — is a view.
- **Keep card data portable.** `cards.js` is plain data; add a build step
  exporting `genesis-set.json` when a non-JS client needs it, rather than
  letting a second engine grow its own card list.
- **Auth**: native clients authenticate the same way the web does — Clerk
  session token as `Authorization: Bearer` against the same API routes.
  Nothing in the API layer assumes a browser.
- **Engine choice, if/when needed**: Godot web export is the better embed
  (5–15 MB wasm, loads inside the existing site pages, GDScript/C# — and
  Godot starter-kit experience already exists in-house); Unity WebGL builds
  are heavier (~30 MB+) and slower to first frame, but Unity is stronger for
  a *standalone* desktop/mobile app with richer character work. Rule of
  thumb: embedded-in-site 3D → Godot; separate downloadable game → Unity.
- **Don't fork game logic.** The pure-JS engine can run server-side as the
  referee (submit moves, receive state) so a native client never needs its
  own rules implementation — same pattern as any future PvP.

The card *template* (holofoil CSS) is web-only; native clients would render
cards from the same raw art + a shader, so the "raw artwork only" pipeline
rule (section 5) is also what keeps assets engine-portable.

---

## 9. Roadmap & status

- [x] Genesis 80 card definitions (60 → 80 completed 2026-07-06)
- [x] `TradingCard` template wired into the game (inspect overlay)
- [x] Collection schema, server-authoritative grants + audit trail
- [x] Free starter deck (18 distinct / 22 copies), one-time grant
- [x] Collection-gated deck pool with full-set fallback
- [x] Deploy updated `firestore.rules` (deployed 2026-07-06)
- [x] Pack RNG + published odds table (`packs.js` — tx-hash-seeded, deterministic)
- [x] `tcg-pack-purchase` route: RL80 burn rail (verified burn → atomic claim + grant)
- [ ] Genesis 80 art run (style bible → batches → `CARD_ART` entries) — IN PROGRESS
- [ ] Buy-packs UI: wallet burns RL80 via wagmi, POSTs tx hash to
      `tcg-pack-purchase` (route done, nothing calls it yet)
- [ ] Pack-opening reveal moment (mechanism TBD — /gachapon is archived, not the plan)
- [ ] Binder/album page (80 slots, owned in holofoil, unowned ghosted, share)
- [ ] Game results persistence (wins/streaks to Firestore — nothing recorded today)
- [ ] Reward hooks: game wins / Prophet cases / oil milestones grant packs
      (= Phase 1 of the Case Table plan)
- [ ] **Case Table integration** — merge with the Prophet case-files game:
      cards as investigative kit (Phase 2), then the unified Case Table
      (Phase 3). Full spec: [CASE_TABLE.md](./CASE_TABLE.md). Supersedes the
      standalone 10-round game as the headline mode (see CASE_TABLE.md §4.8).
- [ ] Duplicate crafting sink
- [ ] USDC premium SKUs via x402
- [ ] Launch surfaces: /trade dock entry + root ticker events
- [ ] Balance pass: large-scale sims per trader/card (engine supports it)
- [ ] Open design question: what does owning a TRADER card unlock? (all four
      traders are free to play as; a pulled Mythic is purely collectible today)
- [ ] Later: manual deck-builder, PvP (server-refereed), on-chain NFT claims,
      Season 2, Ascension tie-in (race deck drawn from owned cards),
      native-engine client (section 8)
