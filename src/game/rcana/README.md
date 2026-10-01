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
