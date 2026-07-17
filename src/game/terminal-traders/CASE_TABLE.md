# The Case Table — Unifying Terminal Traders & the Prophet Case Files

*Working design doc, companion to [GENESIS.md](./GENESIS.md). Status: DESIGN —
nothing in this file is implemented unless marked otherwise.
Written 2026-07-11.*

---

## 1. Thesis

The two /trade games are complementary halves of one game:

- **The Prophet case-files game is the game.** Calibration scoring (Brier)
  inside a narrative investigation is genuinely novel; the scan budget forces
  real decisions; the cast carries it. Its weaknesses: content-bound, no
  economy, no reason to return.
- **Terminal Traders is the economy.** Server-authoritative collection,
  deterministic packs, holofoil template, burn/USDC/earn rails. Its weakness:
  the card game itself is shallow and exists only to legitimize the cards.

The merge: **cards become the investigative toolkit; the confidence slider
becomes position sizing; Brier score becomes P&L.** Cards get the best
possible answer to GENESIS.md's open question ("what does owning a card
unlock?"): *"I need this card in my deck to crack advanced cases."*

Three phases. Phase 1 (case wins grant packs) is already on the GENESIS.md
roadmap and needs no design. This doc specs Phases 2 and 3.

**The one inviolable rule, stated up front:** cards buy *information access
and calibration margin*, never the verdict. Every case must remain solvable
with zero cards. If a card can buy the answer, the game dies; if a card can
buy *justified confidence*, the game sings — because Brier rewards precision,
not boldness, and deep evidence is what justifies sliding from 0.7 to 0.9.

---

## 2. Cast reconciliation (prerequisite for both phases)

Halo Node and Bullhorn Broker are discarded. The canonical cast — in both
games — is the Prophet council:

| Canonical id | Name | Lens | Absorbs | What transfers cleanly |
|---|---|---|---|---|
| `gr80` | Saint GR80 | ETHOS · CREDIBILITY | `halo-node` | "Cold Wallet Shield" (ignore first crash) reads as divine protection — keep the ability, keep the name. |
| `john-barron` | John Barron | PATHOS · HYPE | `bullhorn-broker` | "Megaphone Wick" (+4 pump, crashes hit +3 harder) is exactly a WSB cynic diamond-handing into the dip — keep the ability, rename to **"Double Down"**. |
| `eugene` | Eugene | MYTHOS · PATTERN | (himself, recharacterized) | Eugene is **not** the meme guy. He's pattern recognition and rare finds — the one who says "this chart smells like $ORACL3, day 4." Memes move to Barron's lane. |
| `marisol` | Detective Marisol | LOGOS · ONCHAIN | (herself) | Unchanged. "Follow the Wallets" stays. |

### 2.1 Eugene's rework

- `style: "meme"` → `style: "pattern"` (new tag); handle "Meme Prophet" →
  **"Pattern Prophet"**.
- Ability "Rainbow Candle" (+8 first meme coin) → **"Déjà Vu"**: *the first
  coin you buy that shares a tag with a coin already in your holdings enters
  with +8 value.* Pattern-matching made mechanical, and it's a skill trigger,
  not a rarity trigger. (Alternative considered: +8 on first rare-or-better
  coin — stronger collection synergy but pay-to-win optics; parked.)
- Quote/dialog audit: existing Eugene lines in `cards.js` and the case files
  lean vibes/memes in places. One pass to align his voice everywhere:
  pattern-matcher, rare-find hunter, slightly haunted by charts he's seen
  before.

### 2.2 Tag → lens mapping

Every card tag maps to exactly one lens (this table becomes a `LENS_BY_TAG`
export — see §3.5):

| Lens (station) | Tags |
|---|---|
| ETHOS (`gr80`, station key `monk`) | `defense`, `discipline` (renamed from `automation`), `bluechip`, `infra` |
| PATHOS (`john-barron`, station key `demon`) | `hype`, `pump`, `risk`, `meme` |
| LOGOS (`marisol`) | `investigation`, `analysis`, `hack`, `defi` |
| MYTHOS (`eugene`) | `pattern` (new), `terminal` |

Notes:
- `automation` → `discipline`: cold wallets, stop losses, patient systems —
  monk's discipline. Halo Node's old lane re-flavored, not deleted.
  (Card renames where the automation flavor is baked in: "Botnet Arbitrage" →
  e.g. "Vestment Algorithm"; "Server Room Alpha" → "Cloister Uptime" — final
  names at art-pass time.)
- `meme` cards (Meme Blessing, Copium Drip, Airdrop Ambush, and the meme
  coins) now key off **Barron**, not Eugene. Card text like "Eugene and
  Bullhorn get extra edge" gets rewritten in the same pass.
- MYTHOS starts thin — that's fine and even correct (the myth lens should be
  scarce). Retag candidates into `pattern`: Mempool Prophecy, Oracle
  Crosscheck, Neon Oracle (coin), Lucky Capsule (coin, "rare find"). The
  terminal-foils (`terminal` tag) belonging to the myth lens is intentional
  poetry.
- Style-keyed MARKET_CARDS need the same pass (e.g. Meme Season buffs
  Barron's lane now; Halving Eve's `automation` bonus becomes `discipline`;
  Our Lady Appears `analysis`+`meme` → `analysis`+`pattern`).

### 2.3 The set is freely revisable — until art lock

**Decision 2026-07-11: the Genesis set is a live draft.** Most cards have no
art yet and no meaningful collections exist (only starter commons have ever
been granted; nothing calls the pack route). So: rename ids directly
(`halo-node` → `gr80`, `bullhorn-broker` → `john-barron`), redesign card
lists freely (§3.2a), reorder as needed, and reset dev collections if a
rename orphans a starter id. No alias maps, no in-place-position gymnastics.
Update the ability/personality keys in `engine.js` (`applyPlayedCard`,
`applyMarket`, `BOT_PERSONALITIES`) in the same pass.

The flip side: **declare an explicit art-lock milestone.** The moment the
Genesis 80 art run lands and packs go on sale, ids and edition numbers
(n/80) freeze and the GENESIS.md append-only rule takes over. Everything in
this doc that reshapes the set must happen before that line.

Case-file **station keys stay `monk` / `demon`** — they're baked into three
authored cases and into SitePal audio identifiers with a hard 25-char budget.
Instead, `characterMeta.js` gains a `traderId` field (`monk → gr80`,
`demon → john-barron`) as the join key between the two systems. Don't churn
the case files.

---

## 3. Phase 2 — Card-powered scans

**Goal:** your collection becomes your investigative kit inside the existing
case game. Small change to the case flow, immediate instrumental demand for
cards, ships on the three existing cases.

### 3.1 The Kit

- Before a case begins (after TerminalMenu, before CommsGrid) the player
  assembles a **Kit of up to 5 action cards** from their collection. One tap
  "RUN BASIC KIT" auto-picks and skips the screen — never force deckbuilding
  on someone who came for the mystery.
- **Kit legality (the whale guard): max 2 rare-or-better, max 1 foil.** At
  most **3 kit cards may be played per case.** A maxed wallet buys breadth of
  options, not a bigger information firehose.
- Kit cards are **not consumed.** The collection is a library, not ammo.
  Demand comes from breadth (different cases reward different lens keys) and
  depth (rarity tiers below), not from burn-per-use — consumables would feel
  bad and worsen the loot-box posture (GENESIS.md §6).

### 3.2 What cards do

The base budget stays **3 free scans** (no F2P nerf — a cardless player has
exactly today's game). Kit cards layer on top, each mapped to a lens by
`LENS_BY_TAG`:

| Tier | Effect (played during investigation, once each) |
|---|---|
| Common — **Lens Key** | Your next free scan at the matching station *also* reveals one Tier-2 deep entry (see §3.3). |
| Uncommon — **Deep Scan** | Reveal a Tier-2 entry at the matching station *without* spending a scan, **or** unlock the station's locked 4th question. |
| Rare — **Cross-Reference** | After you have scanned two different stations, reveals the case's authored *connection* entry (the case-003 "dots connect ACROSS lenses" moment, made mechanical). |
| Terminal-foil — **Wildcard** | One extra full scan at any station, deep entry included. The table-stopper. |

Flavor writes itself from existing cards: Wallet Séance is a LOGOS lens key,
Cold Wallet is an ETHOS deep scan, Oracle Crosscheck is literally a
cross-reference, Terminal Foil Moment is the wildcard.

### 3.2a Author to the kit — don't retrofit (Genesis revision pass)

Since the set is a live draft (§2.3), the 33 action cards should be
**designed as investigation tools**, not mapped onto after the fact — their
current `+N portfolio` effects serve the loop being retired.

**APPLIED 2026-07-16** — final composition (reconciled with the §3.2b v4
deviations), landing on exactly 33 in `cards.js`:

| Count | Role | Rarity | Shape |
|---|---|---|---|
| 16 | Lens keys | common | 4 per lens |
| 8 | Deep scans | uncommon | 2 per lens |
| 4 | Cross-references | rare | each names a lens *pair* — printed: LOGOS+ETHOS (Oracle Crosscheck), LOGOS+MYTHOS (Ledger vs Legend), ETHOS+PATHOS (Faith Audit), PATHOS+MYTHOS (Choir vs Canon) |
| 1 | Exit trace | rare | Rug Warning — the HORIZON-dial read (§3.2b) |
| 1 | Pundit audit | uncommon | Insider Ping — §4.5's sanctioned crack |
| 2 | Insurance | common/uncommon | shield (Candle Vigil) + ticket floor (Neon Stop Loss) — two fears, two cards (§3.2b) |
| 1 | Wildcard | terminal-foil | Terminal Foil Moment, unchanged |

The original draft's **2 table-talk slots were superseded** by Exit Trace +
Pundit Audit: the v3 pivot shelved sabotage for live PvP (§4.5b tier 3),
and cards that do something in the shipped solo game beat inert
placeholders. The "print now so the set doesn't need reissuing" argument is
answered by seasons (GENESIS.md §1) — sabotage prints in the set that ships
alongside live tables. Action rarity spread: 17 common / 10 uncommon /
5 rare / 1 foil. Eight legacy ids retired for the eugene/cross-ref slots
(botnet-arbitrage, flash-fill, whale-wake, meme-blessing, airdrop-ambush,
leverage-spiral, tithe-rebate, rug-pull-reversal → pattern-rosary,
candle-palmistry, origin-story, prophecy-backtest, apocrypha-dive,
ledger-vs-legend, faith-audit, choir-vs-canon) — sanctioned pre-art-lock,
no alias maps (§2.3).

Schema (implemented): actions gain `kit: { role, lens, text }` (or
`lenses: [a, b]` for cross-refs) as the primary rules text; the card
template prints kit text and role labels. The legacy `cost`/`effectText`/
`effect` fields survive only as long as classic mode does (§4.8) — new card
text is written kit-first. `caseKit.js` derives the First Twelve from
`cards.js`, so the set is the single source of truth.

Coin cards get canonized rather than redesigned: the 28 coins **are past
cases** (Ponzi Siren, Prophet Margin, and friends retroactively become
solved dossiers). Each gains `caseRef: { outcome, pattern, note }`
(implemented — outcome ∈ rug/legit/zombie, pattern from the exported
`CASE_PATTERNS` archetype vocabulary), which also gives Eugene's
`patternRefs` (§4.4) a lore-native vocabulary — "this smells like Ponzi
Siren" is both a bot mechanic and a collector hook, and the dossier note
prints as the coin's flavor text. Market cards are authored directly as
docket events (§4.6): each gains `docket: { weight, text, banner, …mech }` —
portfolioAll/payoutMult resolve at the table today; disableLens /
silenceLeans / extraAction / grantShield are authored ahead of the Phase 3
docket-events implementation.

### 3.2b The First Twelve (art scope, 2026-07-14)

The first cards to get art — a playable, representative slice of the §3.2a
composition, chosen so every kit role, every rarity tier, and **every ticket
dial** (read / stake / horizon) has at least one card that serves it. All
twelve are live in the `/case-table-dev` mock (stand-in effects noted where
Tier-2 `deepEntries` don't exist yet). Expand outward from these — the
remaining lens keys and deep scans are variations on shapes proven here.

| # | Card | Tier | Role | Effect (mock stand-in in parens) |
|---|---|---|---|---|
| 1 | Audit Flare | common | Lens Key · ETHOS | GR80 slides his 2 strongest evidence cards |
| 2 | Forked Rumor | common | Lens Key · PATHOS | Barron slides his 2 strongest evidence cards |
| 3 | Wallet Séance | common | Lens Key · LOGOS | Marisol slides her 2 strongest evidence cards |
| 4 | Mempool Prophecy | common | Lens Key · MYTHOS | Eugene slides his 2 strongest evidence cards |
| 5 | Cold Wallet | uncommon | Deep Scan · ETHOS | opens GR80's cold archive (mock: reveal ALL his remaining entries) — the §3.2 flavor note already names it the ETHOS deep scan |
| 6 | Chart Exorcism | uncommon | Deep Scan · LOGOS | drags out everything the chain still hides (mock: reveal ALL of Marisol's remaining entries) |
| 7 | Oracle Crosscheck | rare | Cross-Reference · LOGOS+ETHOS | the authored connection entry (mock: strongest card from every unvisited station) |
| 8 | Rug Warning | rare | **Exit Trace** (new role, v4) | sweeps for a fast-exit fingerprint: reveals "DAYS" only when `collapseDay ≤ 7`; slow rugs and legit tokens both read "no fingerprint" — informs the HORIZON dial without buying the verdict |
| 9 | Candle Vigil | common | Insurance · shield | absorb one negative docket event |
| 10 | Neon Stop Loss | uncommon | Insurance · floor | this case's ticket can't lose more than 25, whatever you staked — sizing insurance for the STAKE dial |
| 11 | Insider Ping | uncommon | Pundit Audit | wiretap one partner's exact sealed number at pundit calls (§4.5's sanctioned crack) |
| 12 | Terminal Foil Moment | terminal-foil | Wildcard | the table-stopper (mock: +2 actions this case) |

Deviations from §3.2a, both deliberate: (1) **Exit Trace** is a new role the
v4 three-dial ticket created demand for — it makes the horizon side pot a
read instead of a coin flip, and only on fast rugs; (2) the two insurance
cards split into **shield** (docket events) and **floor** (ticket P&L)
rather than two shields — two distinct fears, two distinct cards. Tier
spread: 5 common / 4 uncommon / 2 rare / 1 foil, matching the §3.2a pyramid.
Cold Wallet's old mock role (shield) moves to Candle Vigil, which held the
`shield: 1` effect in Genesis anyway.

### 3.3 Case schema extensions

Per station (extends the `_template.js` schema):

```javascript
deepEntries: [ { label, value, threat, visual? } ],  // Tier-2, card-gated
lockedQuestion: { q, a: { text, audio }, reveals },   // optional 4th question
```

Case-level:

```javascript
connections: [
  { lenses: ["marisol", "monk"],       // both must have been scanned
    entry: { label, value, threat, visual? } },
]
```

**Authoring rules (the §1 guarantee, operationalized):**

1. Every case must be solvable — correct verdict reachable at reasonable
   confidence — on 3 free scans. Decisive evidence lives in Tier-1, always.
2. Deep entries raise *justified confidence* (they corroborate, quantify, or
   exonerate); they never contain the only copy of the crack.
3. Advanced cases spread corroborating signal across lenses so
   Cross-Reference cards shine; beginner cases may have empty `connections`.

Content cost: ~2 deep entries per station × 4 stations for cases 001–003,
plus one connection entry for 003. A day of writing, not a new pipeline. The
review-case generator gains the same fields (Marisol's deep entries can carry
the richer CDP pulls that don't fit her Tier-1 cards).

### 3.4 Scoring & rewards

- Brier scoring is untouched. The scorecard adds a `deepReveals` count and
  the reveal screen may note "your Cross-Reference caught the wallet link" —
  flavor, not score.
- With Phase 1 live, the flywheel closes: better information → better
  calibration → streaks → packs → better kit.

### 3.5 Implementation map

```
src/game/terminal-traders/caseKit.js   # NEW, pure JS like engine.js:
                                       #   LENS_BY_TAG, kit legality,
                                       #   kit-effect resolution
src/components/trade/KitSelect.jsx     # NEW: kit picker (skippable)
src/components/trade/MobileTerminalGame.jsx  # kit state + scan accounting
src/components/trade/ChannelView.jsx   # deep-entry rendering (CLASSIFIED
                                       #   styling), locked-question UI
src/components/game/cases/*.js         # deepEntries/lockedQuestion/connections
src/hooks/useCardCollection.js         # already provides the owned pool
```

No new server surface: kit effects are information-only; rewards ride the
Phase 1 routes. (Server-side docket validation arrives in Phase 3.)

### 3.6 Phase 2 checklist

- [x] Cast reconciliation (§2) — rename ids, retag pass, Eugene rework
      (applied 2026-07-14: cards.js/engine.js ids + tags, `LENS_BY_TAG`
      export in cards.js, `traderId` join in characterMeta.js)
- [x] Genesis revision pass (§3.2a) — applied 2026-07-16: actions
      redesigned kit-first (composition table in §3.2a), coins gain
      `caseRef` dossiers + `CASE_PATTERNS` vocabulary, markets gain
      authored `docket` events, Genesis Candle demoted to rare (§4.6),
      starter deck rebuilt around the kit (21 distinct / 23 copies,
      classic-sim validated), card template prints kit-first text.
      Art-lock rule stands as declared in GENESIS.md §2 / §2.3 here.
- [x] `caseKit.js` + `LENS_BY_TAG` (applied 2026-07-16: First Twelve defs,
      kit legality, effect resolution extracted from the mock into
      `caseKit.js`; the docket turn engine / ticket math / settle into
      `docketRun.js`; behavior pinned by `scripts/verify-docket-run.mjs` —
      the extraction step of promoting the mock into /trade)
- [x] Case Table UI componentized (2026-07-16): the mock's screens now live
      in `src/components/trade/case-table/` — `CaseTable.jsx` orchestrator
      + Lobby / DeskGrid / TableDock / PunditCalls / PositionTicket /
      Ledger / Standings. `CaseTableDev.jsx` is a thin dev wrapper (seed
      stepper + tips reset are dev-only); `CaseTable` takes `docket`,
      `initialSeed`, `sitePalScenes` (voices for the /trade mount, null =
      silent), and `onExit` (back to the terminal hub).
- [x] Mounted on /trade (2026-07-16): MobileTerminalGame's CASE FILES hub
      option now launches `CaseTable` with the live SitePal scenes
      (monk/demon/marisol; Eugene stays text-only), a date-derived Daily
      Docket placeholder seed (`YYYYMMDD` — server verification still
      pending, §4.10), and a ◀ TERMINAL exit back to the boot hub. The old
      single-case flow is retired; `CommsGrid.jsx` / `VerdictScreen.jsx`
      are parked on disk, unimported. Run state is in-memory only — exiting
      or unmounting mid-docket abandons the run (persistence is Daily
      Docket work).
- [x] Session scoring wired (2026-07-16): each locked ticket on a graded
      case folds into the GameOverlay session scorecard
      (`recordCaseResult`, same localStorage key the desktop 3D reveal
      writes) — brier from the read dial, `correct` null on an abstain
      band, exactly the desktop semantics. Gated by `CaseTable`'s
      `recordScores` prop: on for the /trade mount, off for
      /case-table-dev so sandbox runs don't pollute the calibration trail.
- [ ] Kit select screen (skippable, legality enforced)
- [ ] ChannelView deep-entry + locked-question rendering
- [ ] Author Tier-2 content for cases 001–003 (+ connection for 003)
- [ ] Extend `_template.js` + `specs/_TEMPLATE.spec.js` + review generator
- [ ] Reveal-screen kit callouts

---

## 4. Phase 3 — The Case Table

**Goal:** one game. **You are the fifth seat** — the analyst-prophet at the
Liminal Terminal's trading desk, running a book the house has allocated
you. The four characters are the desk's **partners**: your advisors, your
patron, and the pundits you're measured against — **never your opponents**
(v3 pivot, §4.7a). You play against the market itself: your calibration
*is* your P&L; the collection is your edge. Cards stop printing portfolio.
**Verdicts are the only way the book moves.** That's the soul transplant.

**Framing (decided 2026-07-12):** the Liminal Terminal is a temple-fund —
Our Lady of Perpetual Profit's trading desk. Cases are deal flow; Believe
is taking the position, Doubt is shorting the rug; busting your book means
the Order withdraws its blessing. (Considered and rejected: *player as
independent VC* — VCs don't short and can pass on everything, which kills
the Doubt lane and the bankroll pressure; *player as salaried consultant* —
kills liquidation drama. Analyst-with-an-allocated-book keeps both.)

### 4.1 Session shape: the Docket

- A session is a **Docket of 3 cases** (difficulty-mixed or themed). One
  human seat; the council investigates alongside you as pundits (§4.4).
- Before the docket you choose a **patron** — one partner sponsors your run
  with a passive perk (e.g. GR80: one crash shield per docket; Marisol:
  first LOGOS action free; Barron: +25% payout on your boldest call;
  Eugene: one pattern hint per docket). This is what a TRADER card *is*
  now — the patron system answers GENESIS.md's open question ("what does
  owning a trader unlock?"). Choosing a patron is free; owning their
  Mythic upgrades cosmetics/flavor, with the power delta held near zero
  (§5.3 wallet ≠ win).
- Your book starts at **100** — the house's capital. Grow it; **0 is
  liquidation**: off the desk, GR80 delivers the sermon. (The old
  `WIN_PORTFOLIO = 100` race dies with the old loop.) A rank ladder
  (streaks / lifetime P&L) can grow starting allocation slowly — sim any
  snowball before shipping it.
- Every docket scores you two ways: your final book, and **did you beat
  the council** — the pundits' benchmark books (same stakes, same cases)
  sit on the standings screen every run.
- Daily Docket (same seed for everyone, leaderboard on final book + avg
  Brier) is the retention spine — the deterministic engine makes
  same-seed-for-all trivial. See §4.5b for the multiplayer tiers.

### 4.2 Per-case flow

1. **Listing** — dossier opens; surface metrics public.
2. **Investigation** — turn-based rounds (validated by mock v2, §4.7a): an
   action = ask a station a question, play a kit card, or bank Cred. Each
   player action advances the table a round, and the pundits visibly act —
   scan a lens, play their signature card — in the table dock. *Where a
   pundit digs is itself information* ("Marisol spent both rounds in LOGOS
   and sounds calm — the chain is clean").
3. **Pundit calls** — each partner states a **lean only**, in character
   ("The house of the Lord does not chase this"). Exact probabilities stay
   sealed until the Ledger — otherwise the dominant strategy is "copy
   Marisol." (Insider Ping's single-player job is breaking this seal for
   one pundit, once — §4.5.)
4. **Position** — you alone commit the confidence slider, unchanged UX.
   The slider is the whole bet (§4.3) — no separate stake input.
5. **Ledger** — truth revealed (RevealScreen + vindication chorus), then
   the table ledger: your P&L beside each pundit's now-unsealed call and
   benchmark P&L. Between cases, a **docket event** flips (§4.6).

The v2 tabletalk-sabotage cards and the rare+ *private intel* asymmetry are
**shelved for live PvP** (§4.5b tier 3), where hidden information has real
targets — human seats. They are not part of the solo game.

### 4.3 Positions & payouts: the slider is the stake

Player reports `p = P(scam)` on the slider; outcome `o ∈ {0,1}`;
Brier `B = (p − o)²`. Per case:

```
P&L = STAKE × (1 − 4B)
```

- Perfect call (`B = 0`): **+STAKE**. Dead center (`p = 0.5`, abstain):
  exactly **0** — abstention needs no special case, it falls out of the
  formula. Maximally wrong (`B = 1`): **−3 × STAKE** — full-confidence wrong
  *is* getting rugged, and it should hurt exactly that much.
- Because this is an affine transform of the Brier score, it is a **proper
  scoring rule**: reporting your true belief maximizes expected P&L. This is
  the design theorem the whole game rests on — any future payout tweak must
  preserve properness, or the slider starts lying to the player.
- **v1: fixed `STAKE = 25`** per case (worst docket: 100 − 225 → liquidated
  mid-docket 2; perfect docket: 175). Portfolio-proportional stakes
  (25% of current) are the v2 candidate — more dramatic, but leaders risk
  more in absolute terms; tune via sim suite (§4.7) before switching.
- Abstain still pays **+2 Cred** (patience buys tempo, not portfolio).

### 4.4 Pundits: personality as calibration bias

The four partners investigate every case alongside you and run **benchmark
books** — same stakes, same payout rule, visible on the ledger and
standings. Their books never touch yours; they exist so "beat the council"
is a measurable outcome and so their busts stay dramatic (Barron
liquidating is content). Learning their biases IS a game skill: a player
who knows Barron over-believes reads his lean as signal.

Case entries gain an authored, player-invisible field:

```javascript
signal: { direction: "scam" | "legit", weight: 0..3 }
```

A pundit's belief = `logistic(prior + Σ weights of entries it has actually
seen × lens multiplier + noise(seed))`. Pundits only "know" what their
scans revealed — they play the same information game.

| Pundit | Prior | Lens weighting | Calibration quirk |
|---|---|---|---|
| Saint GR80 | leans doubt | ETHOS ×1.5 | Shrinks reported p toward 0.5 — under-stakes, rarely liquidated, rarely tops the docket. "The house of the Lord does not chase." |
| Detective Marisol | neutral | LOGOS ×1.5 | Refuses conviction without chain data: if she hasn't scanned LOGOS, she stays near center regardless of other signal. |
| John Barron | leans believe | PATHOS ×1.5 | Overconfidence ×1.4 away from center. The table's variance engine — wins huge, liquidates huge. |
| Eugene | neutral | MYTHOS ×1.5 | Keys off `patternRefs` (below): near-oracular when a case matches a pattern he knows, badly wrong when the pattern is a trap. |

Eugene's mechanism — cases gain an optional field:

```javascript
patternRefs: [ { ref: "case-001", strength: -2 } ]  // negative = scam-like
```

He reads resemblance to *prior cases in the library*, so his accuracy is
authorable per case: case-002-style traps (scary surface, legit core) are
written to bait him; deep rugs reward him. Advanced cases can be designed
*around* which bot they fool — that's a new authoring axis the hand-written
cases already gesture at.

### 4.5 Cards at the table

| Role | Cards | Notes |
|---|---|---|
| Information | Lens keys / deep scans / cross-refs / wildcard | The Phase 2 kit; plays cost actions (v2 lesson, §4.7a). |
| Pundit audit | Insider Ping | Unseals ONE pundit's exact probability before you commit — the sanctioned crack in the §4.2.3 anti-copy seal, once per case. |
| Patron | The 4 TRADER cards | Pre-docket loadout perk (§4.1). Not played in-case. |
| Insurance | `shield`-granting defense cards | A shield absorbs one negative docket event (§4.6) — the existing shield mechanic, unmodified. |
| Trophies | Coin cards | §4.6. Coin cards are **not playable** at the table in v1 — no side positions, no portfolio-printing. Flagged open (§4.9). |
| PvP shelf | Tabletalk sabotage, rare+ private-intel asymmetry | NOT printed in Genesis — the §3.2a revision spent those slots on Exit Trace + Pundit Audit; sabotage prints in the season that ships with live human tables (§4.5b tier 3). |

Kit legality from Phase 2 carries over unchanged (5 cards, ≤2 rare+, ≤1
foil), with plays bounded by the action economy rather than a separate cap.

### 4.5b Multiplayer: three tiers, none requiring live tables first

1. **Daily Docket (async — ships first).** Everyone plays the same seeded
   docket; leaderboard on final book + Brier. Two ladders for card
   fairness: **house rules** (loaner kit, pure skill) and **open** (your
   collection rides). Wordle-shaped competition; free with the
   deterministic engine.
2. **Crowd odds (players affect each other, truth stays pure).** Once a
   real player base exists, the day's aggregate Believe/Doubt split sets a
   payout multiplier: right *with* the crowd pays modestly, right *against*
   it pays big. Other players influence your payout, never the outcome.
   NOTE: this bends pure properness toward value-betting (belief vs.
   price) — that's the truer trading game, but ship pure Brier first and
   add this as an explicit layer (§4.9).
3. **Live human tables (later).** The shelved poker layer comes off the
   shelf: human seats with sealed positions, private intel, tabletalk
   sabotage, patron + kit loadouts — the council serving everyone at the
   table while the humans compete. Server-refereed per GENESIS.md §8.
   Never wager owned cards between players (§5); prizes are house-funded.

### 4.6 Docket events & coin trophies

- **Market cards become docket events**: one flips between cases. Dead Chain
  Hour: everyone −10 unless shielded. Regulator Sweep: PATHOS-lens kit cards
  disabled next case. Bull Run: next case's payouts +25%. The 15 existing
  MARKET_CARDS re-flavor almost one-for-one.
- **Docket events stay collectible but never grant power.** They remain in
  the Genesis 80 and the pack pool (set completion + the 80-slot binder are
  collection drivers), but the event deck at the table is the same 15 for
  every player — ownership never changes odds. Ceiling for ownership flavor:
  a cosmetic credit when an event you own flips ("from the collection
  of…", rendered in your holofoil). Related cleanup: GENESIS.md claims 3
  terminal-foils but Genesis Candle (market) is also FOIL rarity — demote it
  to rare pre-art-lock so the 3-foil scarcity story stays true.
  *(Demoted 2026-07-16 with the §3.2a revision pass — exactly 3 foils now.)*
- **Winning a case** (best P&L at the table; ties → best Brier) **grants that
  case's coin card.** The Genesis coin roster becomes a record of solved
  cases — Prophet Margin, Ponzi Siren and friends retroactively *are* past
  cases — and every future case mints a new coin appended to the set
  (edition-safe per the GENESIS.md appending rule). The review pipeline
  doubles as a card factory: cases in, collectibles out. Review cases based
  on real tokens mint **fictionalized** coins (name/art riff, never the real
  ticker) — taste and legal both say don't put someone's actual token on a
  collectible (§5).

### 4.6a NPCs: the rogues' gallery

The universe's NPCs (scammers, retail buyers, influencers, auditors,
regulators) enter through three lanes — only the first is a card type:

1. **Underworld cards (new type: `underworld`) — the prestige trophy
   tier.** The coin is the trophy for the *token*; the Underworld card is
   the rarer trophy for the *perpetrator*. Case solved → coin; case solved
   at high calibration (Brier ≤ 0.1 on the decisive verdict) → the
   culprit's Underworld card too. The name carries the universe's double
   meaning — criminal underworld and the mythological one beneath the
   saints and detectives — and the type is wider than culprits: fixers,
   launderers, mixer operators all live there (Season 2 space). Like
   coins, Underworld cards are **never playable** — for NPCs this is
   load-bearing, not just tidy: a playable "known rugger" card would sell
   the answer (§5.1). Genesis composition change: coins 28 → 25, add
   3 Underworld cards (one per hand-authored case) —
   4 + 25 + 33 + 15 + 3 = 80.
2. **Crowd NPCs are art direction, not cards.** Exit Liquidity is a retail
   bagholder; FOMO Cascade is the retail wave; Regulator Sweep is the
   agency; Compliance Siren is an auditor. The style bible casts these as
   *recurring, recognizable characters* across action/market art, and case
   files reuse them as named background characters. Universe density, zero
   new mechanics.
3. **Future case mechanic (Season 2 — "Underworld"): the suspect as an
   unreliable fifth station.** The council never lies; a suspect would.
   Spending a scan interrogating someone whose testimony may be false is a
   calibration test the current design can't produce. Case content, not a
   card type; the three Genesis Underworld cards seed the recurring
   characters for it, and Season 2 takes the type's name as its expansion
   theme.

### 4.7 Engine & trust model

- `caseTable.js` sits beside `engine.js` as a **pure, seeded, framework-free
  sibling** — same shuffle/clone/log idioms, same headless-simulation
  discipline. `BOT_PERSONALITIES` migrates and gains the calibration
  parameters; `applyMarket`/shield logic transfers nearly verbatim.
- **Sim suite before tuning ships**: 200+ seeded dockets per trader ×
  difficulty mix, watching liquidation rate, bot win spread (Barron should
  win ~as often as he liquidates), and whether kit-heavy beats kit-less by
  edge-not-landslide (target: single-digit pp win-rate advantage for a
  legal maxed kit over basic kit).
- **Rewards become server-verified**: client submits the docket transcript
  (seed + action list); the server replays it through the same pure engine
  and pays out only if it reproduces. Deterministic engine = free
  anti-cheat, the same trust model as tx-hash-seeded packs.

### 4.7a Balance-sim findings (mock phase A, 2026-07-11)

Implemented: [`caseTable.js`](./caseTable.js) (pure seeded table engine),
[`caseSignals.js`](./caseSignals.js) (per-entry evidence signals for cases
001–003, sim-side sidecar until they fold into the case files), and
`scripts/sim-case-table.mjs` (2,000-docket suites; run
`node scripts/sim-case-table.mjs`).

**Playable mock (phase B, v3 — post-pivot): `/case-table-dev`** —
`src/components/trade/CaseTableDev.jsx` implements §4 as written: you are
the fifth seat with a 100-point allocated book; lobby = **patron select**
(all four perks live: GR80 docket shield, Marisol free first question,
Barron ±25% on bold calls, Eugene decisive-lens hint); investigation is
turn-based rounds where an action = a question OR a kit card, with the
partners visibly working the case in the bottom **table dock** (feed +
hand strip); signature-card tells (Cold Wallet / Market Sermon / Wallet
Séance / Mempool Prophecy); then **pundit calls** (leans only — Insider
Ping unseals one number), your slider, and the **Ledger**: truth, your
P&L beside all four now-unsealed benchmark books, docket events, and
standings scored as "you beat N of 4 partners" (bust = "the Order
withdraws its blessing"). Deterministic per docket seed. Mock omissions:
Cred costs, crowd odds, voices, persistence. (v1/v2 lessons below.)

**v4 (2026-07-14): the three-dial position ticket.** The commit is a ticket,
not a slider: **P(SCAM)** (calibration), **STAKE 0–50** (sizing — the council
benchmarks a flat 25; the Ledger names your sizing against the
conviction-justified stake `|p−.5|/.5 × 50`), and **HORIZON** (opt-in timing
side pot: DAYS / WEEKS / MONTHS window, +10 hit / −4 miss, keyed to a new
`collapseDay` field in `caseSignals.js` — the evidence genuinely informs it:
PRPHT's deployer history says days, MERIDIAN's latent upgrade door says
months, and a call on a token that holds always loses). Design rules carried
in: **three dials max**, **no unscored dials** (each gets its own named
Ledger line), sizing math hidden at commit ("felt, not computed"), side-pot
terms public. A max-conviction full-stake miss costs 150 — more than the
book — so one case can now end you, which is the drama the stake dial exists
to create. Open question for playtests: does the sizing debrief coach too
hard, and should HORIZON appear only on cases with timing-relevant evidence?
*v4.1 (same day): onboarding pass — lobby copy restructured into three
numbered steps, first-run scaffolds on the desk / pundit calls / ticket
(localStorage-once, per the primitives doc's scaffold-once rule), the dock
counter reads ACTIONS n/max with a KIT label, an out-of-actions nudge in the
desk feed, and the docket seed tucked into a DEV chip (in production it
becomes the Daily Docket date, not a control). Pundit calls now GATE on the
investigation being spent (§4.2 order; actions don't bank, so an early call
was a pure newbie trap). Open question: does a deliberate "fast fold" —
calling the table early on a case you've already decided — ever earn its
place, e.g. banking the saved action as +1 Cred?*

**Playtest lesson (v1 → v2, 2026-07-12):** a kit that lives in a separate
drawer outside the scan economy reads as "the old game plus a menu" — the
user couldn't feel the merge. Cards must share the action economy and
rivals must visibly act each round; the §4.2 turn structure isn't
polish, it's what makes the table a different game. (Phase 2's solo-case
"cards don't cost scans" rule in §3.2 may need the same treatment — open
question.)

**Design pivot (v2 → v3, 2026-07-12):** playing v2 exposed the structural
contradiction — the four characters can't be your honest consultants AND
sealed-bet opponents ("it seems weird to get questions and answers from
the other players"). The sims had already shown rival books never touched
the player's P&L: the opponents were benchmarks wearing poker faces. v3
names what was true: **player is the fifth seat, playing the market (the
house); the council are advisors/pundits/patrons, never opponents.**
Trader-select is dead; the patron system replaces it. Sealed-position
poker mechanics move to the PvP shelf (§4.5b tier 3). §4 above is written
post-pivot; mock v3 should implement it.

Sim findings:

- **Evidence must aggregate by strength, not volume.** A linear sum let
  three stations of green vibes outvote a serial-rugger smoking gun (full
  information concluded case-001 was legit). Weights now enter squared
  (3 = smoking gun → 9, 1 = vibes → 1); carry this rule into the real
  `signal` schema.
- **Payout curve at fixed STAKE 25 behaves.** Calibrated seats never
  liquidate; the −3× penalty lands almost entirely on the anti-calibrated
  character (Barron liquidates ~44% of dockets — thematically perfect for
  him, and the cautionary tale the scoring is supposed to teach).
  Proportional stakes (E2) also proved viable: they rubber-band (Barron
  liq drops to ~3%) — a real launch candidate, not just a v2 idea.
- **One extra full scan ≈ +15pp win rate** (rational seat: 12% → 19% →
  34% → 57% across scans 1–4). This is far above the single-digit kit-edge
  target and *confirms* the Phase 2 shape: kit cards must grant deep
  entries / cross-refs (fractional information), never whole extra
  stations — and the wildcard foil (a true extra scan) must stay
  one-per-kit.
- **Docket composition is a balance lever.** Marisol wins ~61% of sims
  because her lens is decisive in 2 of the 3 existing cases while the
  PATHOS lens is decisive in zero. Content need: author a
  **demon-decisive case** (a hype-manufactured pump where sentiment
  analysis cracks it), and rotate decisive lenses when building dockets.
- **Cred has no sink at the table.** The rules bank +3 Cred and pay +2 on
  abstain, but nothing spends it. Obvious fix: kit-card plays cost Cred
  (making bank-vs-scan a real tempo decision) — added to open questions.

### 4.8 What happens to classic Terminal Traders

The 10-round coin-flipping loop is retired as the headline game. Options,
in preference order: (a) sunset it — the table *is* Terminal Traders now;
(b) keep it as "Quick Match" practice with no rewards. Do not maintain two
reward-bearing games — split liquidity of attention is how both stay so-so,
which is the exact failure this doc exists to prevent.

### 4.9 Open questions

- [ ] Coin cards as playable side-positions at the table (v2+; only if it
      can't reintroduce portfolio-printing)
- [ ] Stake model v2: fixed vs portfolio-proportional (sim first, §4.3 —
      first sims in §4.7a say proportional is viable and gentler)
- [ ] Cred sink at the table: kit-card plays cost Cred? (§4.7a — today
      Cred is earned but never spent)
- [ ] Crowd-odds layer (§4.5b tier 2): how far to bend pure Brier toward
      value-betting once a real crowd exists; explicit odds display?
- [ ] Patron perk tuning: keep owned-Mythic upgrades cosmetic, or allow a
      tiny power delta? (§4.1, §5 wallet ≠ win)
- [ ] Beat-the-council kicker: small flat bonus for out-calling ≥3 pundits
      on a case? (distorts properness slightly — sim first)
- [ ] Docket length 3 vs 5; themed dockets ("Serial Deployer Week")
- [ ] Leaderboard scope: global vs weekly reset vs friends
- [ ] PvP: human seats with secret positions + private intel (the design
      already supports it — server-refereed per GENESIS.md §8; sequencing
      question only)
- [x] Pack-reveal moment — resolved 2026-07-16: "Chain of Custody"
      (PackReveal.jsx, see GENESIS.md roadmap). Both intuitions held: the
      pack gets the full envelope/flip ceremony, and the trophy grant IS
      the coin's reveal (the CASE CLOSED stamp beat).

### 4.10 Phase 3 checklist

- [x] `caseTable.js` (sim version): docket state machine, payout rule,
      simplified docket events — 2026-07-11, see §4.7a
- [x] `signal` weights for cases 001–003 (sidecar `caseSignals.js`; still
      to fold into the case files) — `patternRefs` not yet authored
- [x] Bot calibration models (sim version, validated against authored
      intent via the calibration table in `sim-case-table.mjs`)
- [ ] Table-talk beat (reuse consensus/reaction UI)
- [ ] Secret simultaneous positions + 4-seat reveal P&L
- [x] Coin trophy grants (server route, same audit trail as pack grants) —
      first form applied 2026-07-16: completing the Daily Docket alive
      grants the day's dossier coin (`docketCoin(seed)` — same coin for
      everyone that day, foils excluded) via `/api/tcg-docket-reward`.
      The §4.6 per-case form (winning a case grants THAT case's coin)
      activates when future cases mint their own coins.
- [ ] Docket events + shield absorption
- [x] Sim suite v1: liquidation/win-spread/kit-edge (`scripts/
      sim-case-table.mjs`, 2,000 dockets/experiment) — findings in §4.7a;
      re-run as cases and models evolve
- [ ] Server-verified docket rewards (transcript replay)
- [ ] Daily Docket + leaderboard
- [ ] Retire/park classic mode (§4.8)

---

## 5. Guardrails (both phases)

1. **Truth is never for sale.** Tier-1 evidence solves every case; cards buy
   corroboration and confidence margin. Enforced at authoring time (§3.3),
   re-checked whenever the review generator changes.
2. **Payouts stay proper.** Any scoring/payout change must remain a
   monotonic affine transform of Brier, or honest sliding stops being
   optimal and the core loop is poisoned.
3. **Wallet ≠ win.** Kit legality caps + the sim-suite kit-edge target
   (single-digit pp) are the enforcement, not a vibe.
4. **Loot-box posture** (GENESIS.md §6) fully applies: published odds,
   deterministic path to every card, viable earn path — the Case Table
   *strengthens* the earn story (trophies + docket rewards are gameplay
   grants with audit trails).
5. **In-game Portfolio is never cashable** and is never marketed as
   investment anything. Real-token review cases mint fictionalized trophies
   only.
6. **Voice consistency.** Eugene's rework (§2.1) needs a one-pass dialog
   audit across `cards.js` and all case files before any new content is
   authored against the old characterization.

---

## 6. Rollout order

1. **Cast reconciliation** (§2) — do first, while collections are empty.
   *(Applied 2026-07-14.)*
2. **Phase 1** (GENESIS.md roadmap): case wins grant packs. Proves the
   reward rail. *(Applied 2026-07-16: Daily Docket wins grant one sealed
   pack — `/api/tcg-docket-reward`, client-attested win bounded by
   one-claim-per-user-per-seed + the UTC docket calendar; hardening to
   transcript replay is §4.10's server-verified rewards item.)*
3. **Phase 2** on the existing 3 cases. Proves instrumental card demand
   without touching scoring.
4. **Phase 3 alpha**: one hand-authored docket vs bots, fixed stakes, local
   only. Sim suite runs before any reward is attached.
5. **Daily Docket + server-verified rewards.** This is launch.
6. **The Gauntlet** (§7) — post-launch second mode; its design gate sim
   (§7.5) can run any time after Phase 2, but it ships only after the
   Docket is live. It must never preempt steps 2–5.

---

## 7. The Gauntlet — survival mode (PROPOSAL, 2026-07-14)

**One line:** the Docket trains *judgment under hidden truth*; the Gauntlet
trains *sizing under randomness*. Same terminal, same cast, same cards —
a different fear. It is the learning-modules doc's **Gambler's Ruin**
(survive repeated rounds; ergodicity is the lesson) and **Right and
Liquidated** (correct and dead anyway) wearing the Liminal Terminal's
fiction, and it is where the retired classic mode's chassis (§4.8) gets
recycled instead of deleted.

### 7.1 Shape of a run

- A **book of 100**, a seeded run of **10 rounds** (count is a sim lever).
  Daily seed → everyone plays the same storm (§4.7 trust model applies:
  transcript replay, server-verified rewards).
- **Draft**: pick 3 coin cards into the book (from collection; a cardless
  player gets a starter draft). Market cards hit coins **by tag** — the
  dormant `volatility` stat finally works: high-vol coins swing harder both
  ways. This answers §4.9's "coins at the table" open question: **not at
  the table — in the Gauntlet.**
- **Round loop**, four beats:
  1. **TELEGRAPH** — an imperfect weather read ("vol rising, probably";
     "regulator activity smells close"). Authored per market card with
     deliberate noise; reading it is the skill.
  2. **POSITION** — one dial: **exposure**, 0–100% of the book riding this
     round. Optionally one kit-card play (insurance cards do their §3.2b
     jobs; lens keys are inert here — different mode, different tools).
  3. **FLIP** — a market card resolves from the full 15-card deck. Exposed
     fraction takes the hit or the gain.
  4. **LINE** — a named Ledger line on the *sizing decision* ("right read,
     oversized — the wick got you"), same debrief voice as the ticket.
- **Bust = out** (Barron's fate, now yours to dodge). Survive all 10 →
  graded on final book **and** telegraph-forecast calibration.

### 7.2 The three invariants (anti-slot-machine rules)

1. **Score survival and sizing, never raw P&L.** A +EV bet at the wrong
   size still ruins you — that's the module's whole lesson. Leaderboard =
   survived rounds, then book, with a calibration multiplier from the
   telegraph forecasts.
2. **Seeded and replayable.** No un-seeded randomness anywhere in a run.
3. **Every round contains a read.** Telegraphs, tells, offers — if a round
   has no decision that changes the player's expected outcome, cut the
   round. Randomness sets the stage; judgment must move the result.

### 7.3 Rogues — the adversarial layer

§4.6a lane 3, brought forward from Season 2 in miniature: **the council
never lies; a rogue would.** Two or three rounds per run, a rogue
interrupts with an **offer** instead of a market flip:

- the **honeypot dealer** — yield too good, exit fee buried;
- the **exit-pumping KOL** — a "buy signal" on a coin he is dumping;
- the **false auditor** — insurance that never pays out.

An offer is a mini-ticket: **P(trap)** plus accept/decline, Brier-scored
like everything else. Tells are authored and *recur across runs* — learning
a rogue's tell is pattern recognition made mechanical (Eugene's lens as
gameplay). Rogues are seeded from the three Genesis Underworld cards
(§4.6a); declining a trap (or riding a genuine offer) at high calibration
is a natural second path to their Underworld trophy drops. Crowd NPCs
(§4.6a lane 2) populate the art. The two inert table-talk cards (§3.2a)
may find a PvE life as anti-rogue counters — open question.

### 7.4 What it reuses

`applyMarket` + shield logic and the 15 MARKET_CARDS from `engine.js`
(authored once as docket events, consumed by both modes); `mulberry32`
seeding and the pure-sim discipline from `caseTable.js`; the mock's book /
event-banner / ticket / debrief UI, nearly verbatim; §3.2b's insurance
cards (Candle Vigil, Neon Stop Loss) in their existing roles. Estimated
new surface: telegraph authoring (15 lines + noise model), rogue offers
(3 characters × tells), exposure math, one lobby mode-select.

### 7.5 Design gate & checklist

**The gate (run before any UI is built):** a Gauntlet sim suite where a
Kelly-ish exposure policy must beat coin-flip exposure by a wide, stable
margin across 2,000 seeded runs — and a tell-reading rogue policy must
beat tell-blind by a visible margin. If sizing skill and reads don't
dominate luck over 10 rounds, the mode is a lottery and doesn't ship.

- [ ] Gauntlet sim (`gauntlet.js` beside `caseTable.js`, same idioms) +
      the design-gate experiments above
- [ ] Market deck authoring pass: 15 cards → gauntlet effects + telegraphs
- [ ] Rogue offers ×3 authored (tells, payouts, Underworld drop hooks)
- [ ] `/gauntlet-dev` mock (phase B, CaseTableDev pattern)
- [ ] Daily Gauntlet seed + leaderboard (post-launch)

Open questions: one bankroll across modes or separate books; telegraph
Brier's weight in the final grade; whether exposure is one dial or
per-coin (start with one — three dials max applies to rounds too).
