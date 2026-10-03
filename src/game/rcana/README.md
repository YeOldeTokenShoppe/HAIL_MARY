# RL80 R-cana — rules engine, simulator and card table

The R-cana is an 80-card game in a tarot configuration: 22 Major R-cana, 56 Minors in four suits (Coins, Candles,
Chains, Cups: Ace–10 pips plus Page, Knight, Queen, King), and two Querents. Theme is general markets and money.
Plain JavaScript modules, no dependencies, Node 18+ and the browser.

Three rule sets share one engine:

| Version | What it is | Rulebook | Status |
|---|---|---|---|
| 1, the shared reading | One shared deck with the Majors shuffled in; a Major resolves for both players when drawn. | `RULES-v1.md` | Complete |
| 1b, Favor and Network | Version 1 with a two-partner Network, Copy trades, and Favor earned by generosity. | `RULES-v1b.md` | Complete; superseded by 1c |
| 1c, the Omen | 1b with the Majors as their own deck turned over at the start of each round, free Hedges, partner replacement, Favor from Cups only, the last-play Hail Mary and eight Trader cards (an 88-card deck). | `RULES-v1c.md` (complete, standalone) | Current playtest build; the table opens on it |
| 2, the duel | Private decks with reversed faces, a shared Major deck with a face-down Omen. | `RULES-v2.md` | Complete, parked while 1c is tested |

`RULES.md` is the design history. The earlier 152-card deck-building draft is kept in a drawer at the end of this file.

## Play it

**The card table** (`table.html`) is the way to play. Press Deal, tap the deck to draw, drag cards from your hand onto glowing zones,
tap a Personality to Trade (or Work) with it, tap one of the bot's to Copy trade it. Every pip says what it does on its
face. The coach line under each decision says what the strong bot would do and why; press "Do that" to follow it.
Every Major that turns up stops the table with a pop-up saying who drew it and what it did; a Hail Mary's fate is
announced the moment it lands. Each querent shows what its owner banks to next turn, with a red warning when the bot could
win; the Review button steps back through every turn of the game. Trader cards, eight one-shot moves and reactions, come
up in the draw. Published as a claude.ai artifact with the `sample` capability, the "Ask the coach" box
lets the player put free-form questions to Claude from the rules and the table in front of them.

**In the app** the table lives at `/rcana` (`src/app/rcana/page.js` frames `public/rcana/table.html`). `npm run rcana:build` rebuilds both `table.html` here and the copy under `public/` after any change to the source, the stylesheet or the engine.

**The viewer** (`tarot-viewer.html`) is the lab: Watch (bot vs bot, turn by turn), Versus (play with buttons and a
coach), Batch (hundreds of games with win rates and pacing), Cards (the whole set with a filter). Both pages must be
served, not opened from disk, because they use ES modules:

```bash
cd src/game/rcana && python3 -m http.server 8765
# http://localhost:8765/table.html   http://localhost:8765/tarot-viewer.html
```

## Files

| File | What it is |
|---|---|
| `tarot.js` | The 80 cards plus the eight Trader cards (`TRADERS`, `ALL_88`). `text1b` on a card is its wording under version 1b; `cardText(c, g)` picks the right one. |
| `tarot-engine.js` | `TarotGame`: start of turn (Dividend, Interest or Dividend bonus, bank or throw), draw Minors resolving Majors on the way, Reserve, pips, courts, Chains as attack or Hedge, Invoke, Foretell, the Hail Mary Pass, Final Bell. `DEFAULTS` holds every tunable, including the 1b rules behind `v1b`. |
| `tarot-bots.js` | Strong (heuristic), Naive (random actions, banks everything, always hedges), Random, and `HumanPolicy`, which resolves each decision from a page. |
| `tarot-sim.js` | CLI and the `playOne` / `batch` exports the viewer uses. |
| `v2.js` | Reversed faces for all 56 Minors, deck presets, `buildDeck(preset, rng)`. |
| `v2-engine.js` | `DuelGame`, a subclass of the tarot engine: private decks, Omen, reversed pips, Collateral, free reversed-Chain hedges, shields. `DUEL_DEFAULTS`. |
| `v2-sim.js` | CLI and exports for the duel. |
| `tarot-viewer.html` | The viewer. Loads the modules directly. |
| `table.src.html` | Source of the card table's markup and script. Edit this file, not `table.html`. |
| `table.css` | The table's whole look: a token block (colours, fonts, card size) at the top, then layout, cards and panels, each section commented. Restyle here; rename no selectors. |
| `build-table.js` | Bundles `table.src.html` and the engine modules into the single-file `table.html` (the claude.ai artifact viewer does not load separate script files). Run `node build-table.js` after editing the source, the stylesheet or the engine. |
| `table.html` | Built output of the above. |

## Run the simulator

```bash
node tarot-sim.js --verbose --seed 5                       # one shared reading, printed turn by turn
node tarot-sim.js --games 2000 --a strong --b naive          # version 1 batch
node tarot-sim.js --games 2000 --a strong --b strong --v1b   # version 1b batch
node v2-sim.js --games 1000 --da revChains --db upright      # duel batch
node v2-sim.js --verbose --seed 3 --da cautious --db aggressive
```

Sides alternate each game; the batch reports wins by policy, first-seat win rate, how games ended, rounds, and per-game
counts of everything that happened.

### Version 1 defaults and flags

Win at 80 (`--win`), opening hand 8 (`--hand`), one Minor drawn per turn (`--draw`), the first player skips the first
draw (`--first 1` to let them draw), Interest 1 per full 5 in Portfolio (`--interest 10` to compare), the Hail Mary
doubles (`--passMult`) and needs 10 in Portfolio (`--passMin`); `--passUnderdog`, `--noPassA`, `--noPassB`, `--keepA N`
(bot A keeps N exposed). THE RECKONING revealed while more than half the deck remains is buried in the bottom half.

### Version 1b defaults and flags

`--v1b` turns on the 1b rules: at most two Personalities in your Network (`--cap`), a once-a-turn Copy trade of an
opponent's Trading Personality for 1 Liquidity (`--copyCost`, `--copyYield half|full`, `--copyFavor 0|1`), and Favor earned
by Sharing and copying, spent on Foretells (`--foretellFavor`) or taken by Our Lady in place of an Event's losses
(`--spare`). Defaults: cap 2, full-earnings copies, copies earn Favor, Foretell 1, spare 2. Chosen after testing cap 3
and half-earnings copies, which were also balanced; see the tuning notes in `RULES-v1b.md`.

### Version 1c defaults and flags

`--v1c` turns on 1c, which is 1b plus: the Majors as a separate deck with an Omen revealed at round start (`--majors 0|1`),
free Hedges (`--hedgeFree 0|1`), a pass cap (`--passMax N`, 0 for none), partner replacement at capacity (`--replace 0|1`),
Favor from Cups only (`--copyFavor 0`), protection only against losses of 3 or more (`--spareMin N`), and the second
Trader opening with 8 Profit (`--seatProfit N`; also `--seatLiq N`, `--seatFavor N`). Both draw on their first turn.
The last-play Hail Mary (`--passLast 1`: a pass only when the opponent could win next turn, no cap, the clock stops while it
is in the air; `--passNoHedge 1` to make it un-Hedgeable) is a prototype described in `RULES-v1c.md`; the table turns it on by default.
Three actions per main phase (`--actions 3`; Reserve and Foretell free) is a third option, on at the table by default.
Trader cards (`--traders 1`: eight one-shot moves and reactions shuffled into the Minor deck, an 88-card R-cana) are a second
prototype described there; the table turns them on by default too. The game is won at once at 80; `--finish 1 --firstHand -1 --first 1` is the
balanced played-out-round alternative.

### Version 2 defaults and flags

Deck presets: `upright`, `revChains`, `revChainsAll`, `revCoins`, `revCups`, `cautious`, `aggressive`, `chainsLowRev`,
`chainsHighRev`, `chainsEvenRev`, `random`. Opening hand 8 with the first Trader drawing one extra (`--firstHand`,
`--seatHand 9,8`), fixed seat order, a game that reaches 80 plays out the round before the largest Bank wins
(`--finish 0` to win at once), reversed Chains are Collateral and still Hedge for free with a card draw
(`--chainsMode hedge|collateral|both|bothDraw`, `--cy one|third|half`, `--collCost N`), upright Cups draw a card.
Experiment flags: `--rotate 1` (rotating lead; rejected because it gives one player consecutive turns at two players),
`--revIntercept 1`, `--revealLast 1`, `--sharedSet 1`, `--chainsDraw 1`, `--chainsBonus N`, `--cupsCost N`,
`--cupsPenalty N`, `--cupsDiv N`.

### Changing the rules

Every number lives in `DEFAULTS` in `tarot-engine.js` or `DUEL_DEFAULTS` in `v2-engine.js`; pass overrides as `rules`
when constructing a game, or through the CLI flags above. Card text and effects live in `tarot.js` and `v2.js`; add or
change a card there and every page and bot picks it up. After any change to the engine or the table source, run
`node build-table.js`.

## How a game of version 1b plays, turn by turn

(Version 1c differs as `RULES-v1c.md` describes: the Omen turns over at the start of each round instead of Majors being drawn, Hedges are free, a Hail Mary is the last play when the bot could win next turn, Trader cards come up in the draw, a partner can be replaced, Favor comes from Cups only, and the second Trader opens with 8 Profit.)

**Setup.** Shuffle the 22 Majors into the 56 Minors. Each Trader draws eight. The first Trader skips their first draw.
Querents start with an empty Bank and no Favor.

**Each turn, in order:**

1. **Start of your turn.** If you threw a Hail Mary Pass last turn and nothing touched it, it lands now and banks
   doubled. Then your Profit arrives: the Dividend of 1, plus the Dividend bonus of 1 for every full 5 already in your
   Portfolio. Then bank any amount from Portfolio to Bank, or, once per game with at least 10 exposed, throw it all into
   the air as a Hail Mary Pass instead.
2. **Draw** one card. If it is a Major it resolves for both players at once (a Market replaces the standing Market, an
   Event happens, an Invoke waits in Providence) and you draw again.
3. **Main phase**, any order:
   - **Reserve** one card from hand, once per turn. It is gone, but it is 1 Liquidity every turn from now on.
   - **Partner** with a Personality by paying its cost, up to two in your Network. It rests the turn it arrives.
   - **Trade** with an idle Personality for its earnings. A Trading Personality is the only thing Chains can hit.
   - **Copy trade**, once per turn: pay 1 Liquidity to take the full earnings of one of the opponent's Trading
     Personalities. They gain 1. You gain 1 Favor.
   - **Play a pip**: Coins earn, Candles boost a Personality, Chains attack a Trading Personality or Front-run a
     Portfolio or intercept a pass, Cups share (the opponent gains half, you gain the rank, draw a card, and gain 1 Favor).
   - **Foretell** for 1 Favor (free with Virgil): look at the top card and optionally put it on the bottom.
   - **Invoke** a Major in Providence by paying its cost.
4. **End.** The opponent's turn. If they aim a Chain at you, you may Hedge with a Chain from your hand first.

**Favor.** Hold 2 or more when an Event would take your Profit or bring down your pass, and Our Lady spares you, taking
2 Favor instead. When OUR LADY OF PERPETUAL PROFIT turns up, the Trader with the most Favor banks everything.

**Winning.** The first Bank to reach 80 wins at once. If THE RECKONING is drawn in the second half of the deck, the game
ends after that round and the largest Bank wins.

## How a game of version 2 plays, turn by turn

**Setup.** Each Trader shuffles their own 56-card deck and draws eight; the first Trader draws nine. The 22 Majors are
shuffled into one shared pile; its top card is placed face-down in the Omen slot. Seat order is fixed for the game.

**At the start of each round** the Omen is turned face up. A Market replaces the standing Market, an Event resolves for
everyone at once, an Invoke goes to Providence. The next Major slides face-down into the Omen slot.

**Each turn, in order:**

1. **Refresh.** Working Personalities stand up, locked Reserve cards unlock, shields expire.
2. **Start of turn.** A pass in the air lands. Take your Dividend and Interest. Bank any amount, or throw a Hail Mary.
3. **Draw** one Minor from your deck.
4. **Main phase**, any order: Reserve one card; hire a court (it cannot Work until your next turn unless Fast); play a
   pip (reversed pips do their reversed thing; reversed Chains are Collateral on your own Personality, or a free Hedge
   that draws a card); Work an idle Personality; Foretell with Virgil (look at the Omen, optionally bury it); Invoke.
5. **End.**

**Hedging.** Before a Chain lands, the defender may play a Chain from hand: an upright Chain costs its Liquidity and
absorbs its rank; a reversed Chain is free, absorbs its rank plus two, and draws a card.

**The Hail Mary Pass** works as in version 1. THE HAIL MARY (The Fool) lets an Underdog throw a second one.

**Winning.** When a Bank reaches 80, the round is played out so both players have had the same number of turns, then
the largest Bank wins, ties to the larger Portfolio. THE RECKONING in the second half of the Majors, or the last Major
revealed, ends the game after that round the same way.

## In a drawer: the 152-card deck-builder (rules draft v5)

The earlier game: eight card types across six Temperaments, Villains with Credibility rules, Opportunities and
Calamities, Trader archetypes awarded after the game. Kept runnable; not the current direction.

| File | What it is |
|---|---|
| `cards.js` | All 152 cards as data plus effect functions. |
| `engine.js` | The rules: Reserve/Lock, Work, Seize, Ascend, Hedge reactions, Calamity targeting, Drawdown, Exit Scam, Front-run, Dividend, Interest, Reveal, Final Bell. Also exports `makeRng`, which every engine uses. |
| `bots.js` | Bot policies (Banker, Hodler, Degen, Cautious). |
| `decks.js` | Starter decks and the auto deck builder by Temperament pair. |
| `sim.js` | CLI: `--verbose`, `--games`, `--matrix`, `--cards`. |
| `viewer.html` | Its browser UI. |

```bash
node sim.js --verbose --seed 7
node sim.js --games 500 --a degen --b analyst --pa banker --pb hodler --cards
node sim.js --matrix --games 50
```
