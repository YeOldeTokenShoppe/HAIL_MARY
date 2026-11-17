# RL80 R-cana — Playtest 3: One Money

A sim-only prototype (2026-11-16), forked from Playtest 2. There is no table yet; `pt3-sim.js` is the whole of it. Playtest 2 and the shared card set are untouched.

## The rules being tested

- **Two players.**
- **One currency: cash**, counted in $M. **Your cash is your score.**
- **An Asset counts for nothing until you sell it.** Buying is money out; selling is money back.
- **First to $1B**, read when the round is complete, so both players have had the same number of turns. If both are there, the richer wins.
- **Credibility is a state, not a count.** A Trader is *in good standing* or *in scandal* (see below).
- **One die: a d8, for every roll.** Playtest 2 rolled a d6 for everything but the Hail Mary. On the d8 each printed target moves up one to keep its odds close: gambles 5+ → 6+ (Meme Coin) and 3+ → 4+ (Oil Field Claim), La Abuela's 4+ → 5+, El Gato's 4+ → 5+. El Gallo and The Lottery Ticket pay on an 8 (12.5%, was 17%); El Gallo dies on a 1 (12.5%, was 17%). Mardi Gras pays the roll, so 1 to 8 coins. Equanimity keeps its values and blocks a little less: 1 is 12.5% (was 17%), 2 is 25% (33%), 3 is 37.5% (50%). `--d6` is the old mix.
- Everything else is Playtest 2: a starting Trader chosen from the juniors, one main action a turn, the Hail Mary.

## How the Playtest 2 cards convert

The card set (`../rcana/set/designs.js`) is shared and unedited.

- Every **Liquidity** number (a cost, a Trader's income, any "collect N") is worth **$10M a coin**. A Tech Stock costs $30M; El Unicornio earns $30M a turn; you open with $50M.
- Every **Prosperity** number is already $M. "Bank 100" is "collect $100M".
- An Asset has **one sale price**, its old Prosperity value. Only a gamble (Meme Coin, Oil Field Claim) keeps a second, safe price.
- **Flash Crash** takes a quarter of your cash, not half: cash is the score now.
- **Liquidity Trap** catches income-type money only, as before; the pile is not yours until the trap is cleared.

## The trinity: three printed numbers

Every Trader carries three fixed numbers (`PT3` in pt3-sim.js), and each Trader leans a different way:

- **Liquidity**: what they earn each turn, and what they cost to play.
- **Credibility**: what they earn on top while in good standing. It was a flat 1 for everyone.
- **Equanimity**: a Calamity played on you fails on a d8 roll of this or lower.

| Trader | Liquidity | Credibility | Equanimity | |
|---|---:|---:|---:|---|
| El Monje | 1 | 2 | 2 | humble income, a bright halo |
| El Gato | 2 | 1 | 2 | |
| El General | 2 | 1 | 3 | the rock |
| El Diablito | 2 | 0 | 0 | lives on his wager: heads collect 3 |
| El Gambusino | 2 | 1 | 1 | |
| La Abuela | 2 | 2 | 2 | respected, unflappable |
| El Unicornio | 3 | 1 | 1 | |
| La Influencer | 3 | 2 | 0 | pays well, falls at the first Calamity |
| La Investigadora | 3 | 1 | 2 | |
| El Octobot | 4 | 0 | 3 | the grinder: no halo, the best income |

Before this, Liquidity was only ever 2 or 3 and Credibility was 1 for all ten. The spread was tuned on the two-player sim. What did not work on the way: El Monje at 1 / 3 / 2 won 63% of his openings; La Influencer costing 2 (an opener at 2 / 3 / 0) won 69%. El Diablito's Devil's Wager is a plain money bet now, heads collect 3, and no longer touches his Credibility.

## The earned halo

The printed Credibility never changes, so a Trader could lose standing but never build it, and El Diablito and El Octobot (Credibility 0) had no reason to behave. **A Trader can earn one halo by helping the rival** (adopted 2026-11-16 as the offer that can be refused; `--nohalo` turns it off).

- **Offer your rival a card from your hand** as your main action. They may refuse it; if they take it, your seated Trader earns a halo. A refused offer still uses your turn.
- **Clear a Calamity off your rival's table** with a Remedy: the same.
- The halo is a marker on the Trader: **+1 income while in good standing**, one at most, **knocked off by a strike**, and it can be earned again. It leaves with the Trader.

Two-player sim, 5,000 to 6,000 games a row. The stock bot rarely gives (0.19 gifts a game), so the rows below use a bot told to:

| | Devotion / Degen | Rounds | Halos earned a game | Knocked off |
|---|---:|---:|---:|---:|
| No earned halo | 53% / 47% | 12.4 | – | – |
| Both give readily | 53% / 47% | 12.2 | 1.46 | 0.47 |
| Both give at every chance | 51% / 49% | 11.8 | 3.22 | 1.26 |
| Only Devotion gives | 54% / 46% | 12.3 | 0.99 | 0.37 |
| Only Degen gives | 51% / 49% | 12.4 | 0.66 | 0.18 |

- **Giving is worth about 1 to 1.5 points of win rate to the giver**, for either deck: a real reason to be generous, not a winning strategy by itself.
- **It does not favour a deck.** Tying the halo to candles does: with the first candle as a third way to earn it (`--candlehalo`) Devotion goes to 55%, and a plain +1 income per candle put it at 61%. Devotion holds seven cards that light candles, Degen one.
- Nobody cleared a rival's Calamity for a halo: in a two-player game the Calamity on your rival is one you played.

**A rival who thinks.** The rows above use a rival who takes any card. Taking one strengthens the giver, so the bot now weighs it: it accepts only when the card is worth more to it than the halo is to the giver (`--takeall` is the old behaviour). 5,000 games a row:

| | Gifts taken a game | Devotion / Degen |
|---|---:|---:|
| No earned halo | – | 52.5% / 47.5% |
| Rival weighs it, givers as before | 0.00 | 52.5% / 47.5% |
| Rival weighs it, givers four times as keen | 0.73 | 51.7% / 48.3% |
| ...only Devotion keen | 0.30 | 51.7% / 48.3% |
| ...only Degen keen | 0.36 | 52.2% / 47.8% |
| `--blind`: the rival draws at random from your hand and cannot refuse; only Devotion gives | 1.38 | 52.4% / 47.6% |
| `--blind`; only Degen gives | 1.25 | 51.2% / 48.8% |

- Against a rival who weighs it, **free generosity disappears**: a gift is only taken when it is a fair trade, so giving is worth nothing either way (within a point, which is noise at this sample).
- What does change hands is what is worth more to the taker than to the giver: spare Traders (54%), Remedies (22%), Assets (20%).
- The blind draw cannot be refused or gamed with a junk card. It is worth between nothing and about a point to the giver.
- Clearing a Calamity off your rival still earns the halo. The bots never do it.

## Credibility: two states

In play the Credibility number went unwatched, and the sim agrees it did nothing: Traders carried 6 to 22 points, lost about 3 a game, and were discredited once in 17 games. Even at a quarter of the points the balance did not move. The live part was the on/off bonus for being at full.

So the number is gone:

- **In good standing**, a Trader earns their Credibility number on top of their income ($10M a point).
- **A strike** puts them **in scandal**: no bonus. **Any Calamity that lands on you is a strike**, and so is Fall From Grace.
- **A second strike while in scandal discredits them**, unless a Saving Face card or The Shroud is spent; then they stay, still in scandal.
- **Back in good standing:** a candle, The Press Release, The Tattoo (at the start of your turn) or The Confession. While a Scandal card still sits on you, only The Press Release (which clears it) and The Confession work.
- Scandal no longer grinds each turn. Ánima Sola returns a Trader in scandal. Las Catacumbas pays $75M for a Trader in good standing, $25M for one in scandal.
- Equanimity is unchanged. It blocks 0.44 Calamities a game; with it at 0 for everyone the balance moves by about a point.

With only Scandal and the Fall dealing strikes, a discredit was a non-event: once in 50 games. Making every landed Calamity a strike (adopted 2026-11-16) puts a Trader at risk about every game and a half, with half of those saved by a Saving Face card:

| | Scandals a game | Discredited | Saving Face spent | Good standing | Devotion / Degen | Rounds |
|---|---:|---:|---:|---:|---:|---:|
| `--nostrikes`: only Scandal and the Fall strike | 0.98 | 0.02 | 0.04 | 85% | 52% / 48% | 12.1 |
| `--fuse`: a Scandal left on you for a full round is a second strike | 1.25 | 0.13 | 0.11 | 85% | 51% / 49% | 12.1 |
| **The rule: any Calamity that lands on you is a strike** | 2.33 | 0.32 | 0.32 | 75% | 52% / 48% | 12.5 |

## Results

Greedy bots, juniors opening at random, 6,000 two-player games, with the trinity spread, two-state Credibility, every landed Calamity a strike, and one d8. (On the old dice the same run gives 53% / 47% and 12.5 rounds: the d8 changes nothing measurable.)

| | |
|---|---:|
| Devotion / Degen | 53% / 47% |
| The player who goes first wins | 48.6% |
| Rounds | 12.4 |
| Opening Traders | 45% (El Gambusino) to 53% (El Gato, El General) |
| Asset sales a game | 5.5 |
| Traders discredited a game | 0.32 |
| The loser's cash at the end | $822M |
| Games where the loser is within $200M | 61% |

Playtest 2 for comparison (two players): 49% / 51%, 15.9 rounds, going first wins 52.9%.

## What two players fixes

- **Degen's multiplayer weakness.** At three players Degen wins 29% of its seats (even is 33%) and at four 19% (even is 25%). A Calamity costs a card, a turn and now cash, and with several rivals it only slows one of them; Degen carries six. Its "everyone collects" cards also pay every rival. With one rival both problems go away.
- **The Whale, The Wheel, Moral Hazard** have one obvious reading: you and your rival.

## What it does not fix

- **Going first.** Ending the game the turn someone reaches $1B gives the first player 56%. Playing the round out fixes it (about 50%), and is the rule above. `--sudden` is the old ending.
- **El Unicornio.** Without Compound Interest Degen fell from 49% to 38% (measured before the Credibility change). His "at least 100 banked" condition is always true in one money, so he pays $25M every turn. Not yet addressed.
- **The other abilities are still light.** La Influencer's is worth about a point.

## How the rule was reached

1. **25 to 1 breaks.** Playtest 2's cards imply about 25 Prosperity to the coin, but at $25M a coin income alone wins in 7.8 rounds. At $10M the cards drive the game and cash funds them.
2. **Counting unsold Assets** (`--assets`) was the first draft. It balanced, but nobody sold (1.0 sales a game), The Skull, El Mapa and Rug Pull lost their jobs, and The Whale moved $250M of score at a stroke.
3. **Cash only** brings selling back (5.5 sales a game) and suits the cards that pay for waiting: you hold La Cava or El Aguacate until the price is right, then sell.

## Caveats

- **The bot was rewritten** to count in cash: it buys what will pay, charges itself half the price of anything that will not, and sells to score. These are that bot's numbers, not a human's.
- No card was redesigned beyond El Monje, El Diablito and the Credibility cards above. Card faces still print the old Credibility numbers.
- An exploit carried over from Playtest 2: with Las Catacumbas a bot buries a Trader for cash and seats another the same turn, repeatedly.

## Running it

    node src/game/playtest3/pt3-sim.js --games 4000
    node src/game/playtest3/pt3-sim.js --players 3
    node src/game/playtest3/pt3-sim.js --rate 10 --goal 1000 --start 5 --crash 0.25
    node src/game/playtest3/pt3-sim.js --assets        (unsold Assets count)
    node src/game/playtest3/pt3-sim.js --sudden        (end the turn someone gets there)
    node src/game/playtest3/pt3-sim.js --nostrikes     (only Scandal and the Fall are strikes)
    node src/game/playtest3/pt3-sim.js --d6            (Playtest 2's dice: a d6 for all but the Hail Mary)
    node src/game/playtest3/pt3-sim.js --nohalo        (no earned halo)
    node src/game/playtest3/pt3-sim.js --blind         (the rival draws the gift at random and cannot refuse)
    node src/game/playtest3/pt3-sim.js --keen 4        (bots four times as keen to offer)
    node src/game/playtest3/pt3-sim.js --fuse          (a Scandal left a full round is a second strike)
    node src/game/playtest3/pt3-sim.js --verbose --seed 7

`RULES` and `PT3` at the top of the file hold the defaults.
