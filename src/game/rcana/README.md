# RL80 R-cana — rules engine and simulator

Executable version of the R-cana rules draft v5: Villains, no Trader cards, 17 Opportunities and 17 Calamities. 152 cards.
Plain JavaScript modules, no dependencies. Runs in Node 18+ and in the browser.

## Files

| File | What it is |
|---|---|
| `cards.js` | All 160 cards as data plus effect functions. The single source of truth for the set. |
| `engine.js` | The rules: turn structure, Reserve/Lock, Work, Seize, Ascend, Hedge reactions, Calamity targeting, Drawdown, Exit Scam, Front-run, Dividend, Interest, Reveal/Omen, Majors, Final Bell. |
| `bots.js` | Bot policies (Banker, Hodler, Degen, Cautious). Greedy action scoring in profit-equivalents. |
| `decks.js` | Starter decks, auto deck builder per Trader, R-cana deck builder. |
| `sim.js` | CLI batch simulator. Also exports `playOne` and `batch` for the viewer. |
| `viewer.html` | Browser UI: run a game and step through it turn by turn, run batches, browse the cards. |

## Run

```bash
cd src/game/rcana
node sim.js --verbose --seed 7                      # one game, printed turn by turn
node sim.js --games 500 --a degen --b analyst --pa banker --pb hodler --cards
node sim.js --matrix --games 50                     # all 8 Traders vs each other, auto decks
```

Deck ids: `degen`, `analyst` (hand-built starters) or any Temperament pair such as `reason+patience`, `greed+fear`, `hope+hype` (auto-built).
There are no Trader cards: the archetype is a label the engine awards after the game from how each side played.
Policies: `banker` (banks everything), `hodler` (keeps 20 in Portfolio for Interest), `degen` (keeps 30, aggressive), `cautious` (holds Liquidity for Hedges).

The viewer needs to be served, not opened from disk, because it uses ES modules:

```bash
cd src/game/rcana && python3 -m http.server 8765   # then open http://localhost:8765/viewer.html
```

## Changing the rules

Numbers that matter live in two places: `WIN_BANK` in `engine.js`, and the card fields in `cards.js`.
Dividend and Interest are in `Game.set()`. The Reveal and Final Bell logic is in `Game.reveal()`.
Add a card by adding an entry in `cards.js`; the deck builder and viewer pick it up automatically.

## Tarot configuration (80 cards)

A second, simpler game sharing the same ideas: one shared deck of 22 Major R-cana and 56 Minors
(Coins, Candles, Chains, Cups: Ace–10 pips plus Page, Knight, Queen, King), and two Querents.
Pips are four templates scaled by rank; courts are sixteen named Personalities; Majors resolve for the
whole table when drawn. Theme is general markets and money.

| File | What it is |
|---|---|
| `tarot.js` | The 80 cards. |
| `tarot-engine.js` | Shared-deck rules: Set (Dividend, Interest, Bank), draw Minors resolving Majors on the way, Reserve, pips, courts, Chains as attack or Hedge, Invoke, Foretell, Final Bell. |
| `tarot-bots.js` | Strong (heuristic), Naive (random actions, banks everything, always hedges) and Random (also passes at random) policies. |
| `tarot-sim.js` | CLI and the `playOne` / `batch` exports the viewer uses. |
| `tarot-viewer.html` | Browser UI, same layout as `viewer.html`. |

```bash
node tarot-sim.js --verbose --seed 5
node tarot-sim.js --games 2000 --a strong --b naive
node tarot-sim.js --games 1000 --a strong --b strong --win 60 --draw 2 --hand 5 --first 1 --keepA 10
```

Defaults after tuning: win at 80, opening hand 7, one Minor drawn per turn, the first player skips the
first draw, Interest 1 per full 5 in Portfolio (`--interest 10` to compare). THE RECKONING revealed while more than half the deck remains is buried in the bottom half.

## Version 2: duel with reversals

Each Trader brings a private 56-card Minor deck: one card per slot (Ace–King of each suit), each chosen
upright or reversed. The 22 Majors are a shared deck with a face-down Omen revealed at the start of every
round. Supports two to four players.

| File | What it is |
|---|---|
| `v2.js` | Reversed faces for all 56 Minors, deck presets, `buildDeck(preset, rng)`. |
| `v2-engine.js` | `DuelGame`, a subclass of the tarot engine: private decks, Omen, reversed pips, free reversed-Chain hedges, shields. |
| `v2-sim.js` | CLI and the `playOne` / `batch` exports the viewer's duel mode uses. |

```bash
node v2-sim.js --games 1000 --da revChains --db upright
node v2-sim.js --games 1000 --da random --db random --a strong --b naive
node v2-sim.js --verbose --seed 3 --da cautious --db aggressive
```

Deck presets: `upright`, `revChains`, `revChainsAll`, `revCoins`, `revCups`, `cautious`, `aggressive`, `random`.
Duel defaults after tuning: the lead seat rotates each round, a game that reaches 80 plays out the round
before the largest Bank wins, reversed Chains draw a card when used as a Hedge, upright Cups draw a card. Rule flags for experiments: `--firstHand N` (first player's opening-hand penalty), `--chainsDraw 1`
(reversed Chains draw a card when used), `--chainsBonus N`, `--cupsCost N`, `--cupsPenalty N`, `--cupsDiv N`.

## How a game of version 2 plays, turn by turn

**Setup.** Each Trader shuffles their own 56-card deck and draws seven. The 22 Majors are shuffled into
one shared pile; its top card is placed face-down in the Omen slot. Each Trader's Querent sits in front of
them with an empty Bank. Portfolios start at zero.

**A round** is one turn for every Trader. The seat that leads rotates each round, so nobody is always the
first to act after a Major.

**At the start of each round** the leading Trader turns the Omen face up. If it is a Market, it replaces the
standing Market. If it is an Event, it resolves for everyone at once. If it is an Invoke, it goes to the
Providence row where any Trader may later pay to use it. The next Major slides face-down into the Omen slot.

**Each turn, in order:**

1. **Refresh.** Your Working Personalities stand up. Your locked Reserve cards unlock. Shields expire.
2. **Set.** Take your Dividend (1 Profit into your Portfolio, more under some Markets). Take Interest (1 Profit
   for every full 5 already in your Portfolio). Then bank any amount you like from Portfolio to Bank.
   Banked Profit can never be touched again.
3. **Draw** one Minor from your deck.
4. **Main phase**, any number of actions in any order:
   - **Reserve** one card from hand face-down. It is now 1 Liquidity, locked when spent, back every Refresh.
   - **Hire** a court by paying its cost. It cannot Work until your next turn unless it is Fast.
   - **Play a pip** by paying its cost: Coins for Profit, Candles to put a Personality to Work with a bonus,
     Cups to share Profit (and draw a card), Chains to attack a Working opposing Personality or Front-run a
     Portfolio. Reversed pips do their reversed thing; reversed Chains cannot be played on your own turn.
   - **Work** an idle Personality for its Yield. Working Personalities are the only ones Chains can hit.
   - **Foretell**, if you have Virgil: look at the Omen and optionally send it to the bottom.
   - **Invoke** a Major in Providence by paying its cost. It is spent afterwards.
5. **End.** Play passes left.

**When someone is attacked.** A Chain names its target. Before it lands, the defender may play a Chain from
hand as a Hedge: an upright Chain costs its Liquidity and absorbs its rank; a reversed Chain is free, absorbs
its rank plus two, and draws a card.

**The Hail Mary Pass.** Once per game, at your Set, instead of banking you may throw your whole Portfolio
(at least 10) into the air. It stays in the air through your turn and every opponent's turn. If anything
takes Profit from your Portfolio before your next Set, the pass is incomplete and you lose all of it; if the
taker was an opponent's Chain, they intercepted it. If it comes down untouched, what you threw banks doubled.
Profit you earn after the throw sits in the Portfolio as normal. THE HAIL MARY (The Fool) lets an Underdog
throw a second one. Rule flags: `--passMult`, `--passMin`, `--passUnderdog`, `--noPassA`, `--noPassB`.

**Winning.** When any Trader's Bank reaches 80 at a Set, the round is played out so everyone has had the
same number of turns, and the largest Bank wins. If THE RECKONING is revealed in the second half of the Majors,
or the Majors run out, the game ends after that round the same way.
