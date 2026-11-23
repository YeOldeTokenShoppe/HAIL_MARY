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

## Calamities: hits and conditions (2026-11-20)

A Calamity is one of two kinds, decided by what the real thing is.

- **A condition** sits on the rival until cleared: Bear Market, Tax Collector, Liquidity Trap (market); Scandal, The Inferno (standing). (The Virtue Signal was a third until it left the set on 2026-11-21.)
- **A hit** happens once and is over. The three frauds are hits (`hit: true` in designs.js): they resolve and are discarded, so there is nothing to clear.
  - **Rug Pull** ($30M): the rival discards the Asset they bought most recently. Not playable on a rival with no Assets.
  - **Quantum Hack** ($20M): take $40M from the rival.
  - **Exit Scam** ($30M): the rival loses $75M.
- The market shocks that fire when drawn (Flash Crash, Tech Wreck, Fall From Grace) are unchanged.
- A hit that lands is still a strike. Sacred Heart and Equanimity work against hits as before.

**You prevent a hit and you cure a condition.**

| Protection (Relic) | Rule |
|---|---|
| The Keys | Quantum Hack and Exit Scam cannot be played on you |
| The Audit (new, no. 87) | Rug Pull cannot be played on you |
| The Halo | Calamities are not strikes against your seated Trader (it used to stop the old Quantum Hack) |
| Sacred Heart | unchanged: discard it to cancel any one Calamity as it lands |

| Remedy | Clears |
|---|---|
| The Stimulus (new, in The Burro's place, no. 65) | Bear Market, Tax Collector or Liquidity Trap |
| The Bell | Bear Market |
| The Press Release | Scandal |
| The Miracle Tortilla | any condition |

The Confession lifts The Inferno, and is the one Grace The Inferno cannot stop. The Burro left the set (kept in designs.js as a comment, for the Lotería edition). Devotion plays The Audit where it played The Burro.

Sim, 4,000 two-player games a row. The starter decks hold only Rug Pull of the three frauds, so the others were tried in Degen in place of a Tech Stock:

| | Devotion / Degen | Rounds |
|---|---:|---:|
| The starter decks as they are | 50.1% / 49.9% | 12.3 |
| Degen with Quantum Hack at $40M | 48.3% / 51.7% | 12.4 |
| ...at $60M | 44.8% / 55.2% | 12.4 |
| Degen with Exit Scam at $75M | 49.3% / 50.7% | 12.4 |
| ...at $100M | 47.5% / 52.5% | 12.5 |
| Degen with both (Tech Stock and Moral Hazard out) | 46.8% / 53.2% | 12.5 |

At $40M and $75M each fraud is worth about a point and a half to the deck that holds it. Quantum Hack at $60M is too much. Before this change the decks stood at 53% / 47%.

## The general shuffle: a third mode (2026-11-20)

A test of playing with no starter decks. Every card in the set, one copy each, in **one deck that both players draw from**, with one shared discard pile. Each player still opens with a junior Trader of their choice (six on offer; a Trader one player takes is gone for the other), so the shared deck is 85 cards. At the table it is the third player mode; in the sim, `--decks shuffle,shuffle`.

4,000 games (3,000 for the card counts), greedy bots:

| | |
|---|---:|
| The player who goes first wins | 48.4% |
| Rounds | 12.4 |
| Cards left in the deck at the end | 43 of 85 |
| Calamities played a game | 1.5 |
| A condition (Bear Market, Scandal...) is played | in 26 to 30% of games, each |
| A fraud is played | Quantum Hack 9%, Rug Pull 7%, Exit Scam 4% |
| A Remedy is played | Miracle Tortilla 11%, The Stimulus 6%, The Bell 4%, The Press Release 4% |
| ...and is still in a hand at the end | 17 to 20% |
| A protection is played | The Keys, The Audit, Sacred Heart 3%; The Halo 0% |

- The game is the same length and as fair to the second player as the starter decks.
- Only half the deck is seen in a game, so with one copy each a card and its answer rarely meet: a one-target Remedy is played in about one game in twenty and is a dead card four times as often.
- The bot's own habits are in these numbers: it rates a condition above a fraud and almost never equips a protection, so the fraud and protection rows say more about the bot than the cards.
- Cards written for a deck of your own read differently here: Marisol sees the top of the shared deck, The Lonely Soul returns the last Trader anyone discarded.

## Logos, Ethos, Pathos: a trial (2026-11-20)

The rule since the evening of 2026-11-20, at the table too (`--noattrs` is the old three numbers). Money is kept apart: it is the Trader's Liquidity number, what they cost and make. Their character is three attributes that **always sum to eight**, each 1 to 4, no two Traders alike (`ATTRS` in ../rcana/set/trinity.js).

- **Logos** (reason): when you draw for your turn, look at that many cards from the top of the deck and keep one; the rest stay on top. A Trader in scandal draws blind.
- **Ethos** (character): what good standing pays, $5M a point. It takes over from Credibility.
- **Pathos** (feeling, heart): a Calamity played on you fails on a d8 roll of this or lower. It takes over from Equanimity.

| Trader | Logos | Ethos | Pathos |
|---|---:|---:|---:|
| Marisol | 4 | 3 | 1 |
| The Octobot | 4 | 1 | 3 |
| The Influencer | 3 | 4 | 1 |
| Eugene | 3 | 3 | 2 |
| Byzantine General | 3 | 2 | 3 |
| Connor | 3 | 1 | 4 |
| The Prospector | 2 | 3 | 3 |
| Virgil | 2 | 2 | 4 |
| Saint GR80 | 1 | 4 | 3 |
| The Gambler | 1 | 3 | 4 |

3,000 to 4,000 two-player games a row, greedy bots:

| | Devotion / Degen | Rounds |
|---|---:|---:|
| The old three numbers | 50.0% / 50.0% | 12.3 |
| Only Logos new | 52.0% / 48.0% | 12.1 |
| Only Ethos new | 44.6% / 55.4% | 11.9 |
| Only Pathos new | 47.7% / 52.3% | 11.8 |
| All three | 42% / 58% | 11.3 |
| ...with Saint GR80 at Money 20 | 46.0% / 54.0% | 11.2 |
| ...and Connor's wager paying $10M | 50.0% / 50.0% | 11.4 |

- **Logos is used.** A bot with Logos 2 or more looks about 14 times a game and takes a card other than the top one about 10 of them. By itself it barely moves the balance.
- **Equal sums undo the old compensation.** Connor and The Octobot had no Credibility and Saint GR80 had the lowest income; each was balanced by the others. With everyone at eight, Connor opens at 62% and Saint GR80 at 39%.
- **Money is not a lever while a Trader's cost equals their income**: the cost is paid once, the income every turn. Putting Saint GR80 at Money 20 and cutting Connor's wager to $10M brings the decks back to even, with the openers between 46% and 57%.
- **What was adopted:** Saint GR80 at Money 20, and Connor's wager at $20M. Marisol's ability changed with it: the cards she looks at and does not draw go to the bottom of the deck (she no longer has a face-up top card to bury). With those, 6,000 games: Devotion 51% / Degen 49%, 11.2 rounds, going first wins 49.4%, openers from 46% (Virgil) to 59% (Saint GR80, still the strongest opener).
- **Saint GR80 at Money 15** (later the same evening). At Money 20 he opened at 59%. The cause is Ethos 4, worth $20M a turn: with a 4 / 2 / 2 spread he opens at 48%, and taking his Vow away altogether only brings him to 54%. At Money 15: Devotion 49.5%, Saint GR80 52%, every opener between 47% and 52% (6,000 games).
- **Ethos is the strongest attribute, by design** (2026-11-20): character is the project's message, so a Trader with high Ethos is balanced through their Money (Saint GR80's 15), never by making Ethos pay less. It only pays in good standing, so it is also the easiest thing to lose.
- **The Traders who do not open** (6,000 games; each swapped for a junior to see what they are worth to their deck): The Influencer +2.5 points to Devotion, and whoever seats her wins 50%; Marisol +3.6, 56%; the two Eugenes +7.9 between them, 57%; The Octobot +0.2, and whoever seats it wins 38% (it is played in 15% of games). The Influencer's Ethos 4 at Money 30 is not a problem. Eugene is strong through Compound Interest, whose condition is always met in one money; The Octobot is not worth its $40M.
- **Eugene and The Octobot, tried** (5,000 games a row; nothing adopted yet). The bot was first taught to count a Trader's paying ability as income, so it no longer trades Eugene away for less; that alone puts the decks at Devotion 47% / Degen 53%.
  - Eugene, whoever seats him wins: as he is 59%; Compound Interest only in good standing 55% (decks 49 / 51); only above $500M 52%; $15M a turn 49%; only while richer than the rival 44%.
  - The Octobot, whoever seats it wins: as it is 38%; Money 30 34%; costs $30M and makes $40M 43%; able to pray 38%; no strike can touch it 38%; no strikes and the cheaper price 45%. No small change makes it worth seating. Swapped for a junior, its deck does not notice, so most of that 38% is who seats it: the player who has not found Eugene.
  - The knobs are on the designs (`ciMin`, `ciPay`, `ciLead`, `ciGood` for Compound Interest; `prays`, `ironclad` for The Octobot) and change nothing until set.
- **The Octobot: Eight Arms** (adopted 2026-11-20, replacing No Soul; it still cannot pray, and a Scandal can now touch it). After its main action it may also sell one Asset. 6,000 games a row:
  - Most of the Octobot's 38% is the deck it is seated in: Degen without Eugene wins 42% whatever else it holds.
  - With selling only, a bot uses the second action 0.5 to 0.7 times per seating and the deck gains about half a point. The bots are short of Assets to sell, not of actions.
  - With "buy or sell one Asset" (`armsBuy` on the design, off) it is used 1.6 to 1.8 times, whoever seats it wins 43%, and it is worth about 2.3 points over a junior to a Degen with no Eugene: The Influencer's level.
- **Adopted, later on 2026-11-20:** Eight Arms is "buy or sell one Asset", and Compound Interest pays only in good standing (its always-true $100M condition is gone).
- **At the table** the Logos look is a prompt: the top cards are shown and you tap the one to draw. The card frame prints a Trader's Money in the coin and the three attributes as a triangle in the text box.
- Calamities are played less (0.9 a game, from 1.3): the bots are put off by Pathos, which now averages nearly 3 where Equanimity averaged under 2.

## Eugene: The Narrative (2026-11-20)

Compound Interest was an arbitrary fit for a unicorn. **The Narrative:** while Eugene is seated and in good standing, each of his player's unsold Assets counts toward the billion at its sale price plus $50M. Everyone else has to sell to score; he only has to be believed, and one strike ends the story. (A unicorn is a company worth a billion on paper.) The scoreboard shows the paper beside the cash.

6,000 games a row:

| Eugene | Devotion / Degen | Whoever seats him wins | Games won on paper |
|---|---:|---:|---:|
| Compound Interest in good standing (before) | 47% / 53% | 58% | – |
| No ability at all | 57% / 43% | 38% | – |
| The Narrative, Assets at their sale price | 56% / 44% | 39% | 11% |
| ...plus $25M each | 53% / 47% | 44% | 15% |
| **...plus $50M each (adopted)** | 51% / 49% | 49% | 17% |
| ...plus $75M each | 49% / 51% | 53% | 20% |

- Degen had been leaning on Compound Interest: without it the deck wins 43%.
- Counting Assets at their plain sale price is worth almost nothing to a bot. It saves the selling action, about one or two a game by the time he is seated, and a strike takes it away.
- At plus $50M the decks are level and the openers run from 45% (The Gambler) to 53% (Saint GR80). A person may get more from it than the bots do, by buying cheap Assets for the premium; the answer to that is a Calamity held for the right moment.

## Apparitions and Miracles (2026-11-20)

**Changed 2026-11-22: an apparition also grants one more main action. The keyword is Radi8** (the badge on every apparition card; `APPARITION_KEYWORD` in RcanaCard3.jsx). Revealing an apparition now gives one more
main action (this turn, or the witness's next if it was revealed on a rival's) as well as the Miracle
(`RULES.apparitionGift: 'action+miracle'`). Tried over 8,000 games each, two players:

| An apparition grants | Devotion wins | Rounds | Whoever saw more apparitions wins |
|---|---|---|---|
| a Miracle (the rule until now) | 49.9% | 11.7 | 51% |
| one more action | 47.3% | 11.7 | 53% |
| one more action and a Miracle (chosen) | 46.9% | 11.5 | 56% |
| another turn | 41.1% | 10.8 | 67% |
| another turn and a Miracle | 40.5% | 10.6 | 70% |

Another turn decided too many games. With the bots taught that an apparition gives its action back, the chosen rule
stands at Devotion 48.5% / Degen 51.5% over 10,000 games, going first 51.5%. Degen gains a little more because two
of its apparitions are Events that fire on the draw, for nothing. The decks were left as they were.

Ten cards carry Our Lady's image (`apparition: true` in designs.js): The Holy Roller, The Fire Horse, The Virtual Mary, Mardi Gras, The Rose, The Fountain, The Miracle Tortilla, The Tattoo, Ride or Die and the Dashboard Figure.

- **Whoever reveals one witnesses an apparition and takes a Miracle** (an eight-pointed star), three at most: the player who draws an apparition Event, or who plays any other apparition card from their hand.
- **A Miracle is spent to roll one of your own dice again**, when it has failed you: a gamble, the Hail Mary, your Trader's Pathos against a Calamity. (The Rooster's 1 was a fourth, until The Rooster left the set on 2026-11-21.)
- The Dashboard Figure was that reroll, once, as a Relic. Now it is the tenth apparition: equipping it is the apparition, and it takes no Relic slot.
- At the table: stars beside each player's Cash, a notice when someone witnesses one, a prompt when a roll of yours fails. On the card: a small star by the type line.

4,000 games, greedy bots: Devotion witnesses 0.30 apparitions a game and spends 0.12 Miracles; Degen 1.27 and 0.21 (its apparitions are Events, which reveal themselves; Devotion's are Relics and Graces, which the bots seldom play). 0.6 Miracles a player are still held at the end. The balance does not move (Devotion 46.4% with, 47.0% without). There are more Miracles than failed rolls to spend them on.

## Results

*(The table below was measured before the 2026-11-20 change above.)*

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

## The table (2026-11-17)

Playtest 3 is playable at `/playtest3`, against EL BOT.

- `pt3-table.src.html` is a fork of the Playtest 2 table, converted to one money: every amount on
  screen is cash in $M (`usd()` for $M, `coins()` for the old coin counts the engine still uses for
  costs and incomes). Edits to the Playtest 2 table no longer reach this one.
- `npm run pt3:build` (pt3-build.js) inlines pt3-sim.js, designs.js and trinity.js and writes
  pt3-table.html and public/playtest3/table.html. Re-run it after editing any of them.
- The scoreboard shows Cash and the distance to $1 billion. The Trader seat shows the trinity:
  Liquidity a turn, the Credibility bonus with the state (good standing / in scandal), Equanimity on the d8.
- The earned halo: every card in hand offers "Offer it to EL BOT as a gift"; when the bot offers
  you one, you are asked whether to accept.
- The engine's log lines are in $M (`Game.m()`).
- Card text whose rule changed (two-state Credibility, the d8) lives in `TRINITY_TEXT`
  (src/game/rcana/set/trinity.js), read by both the table and the code-drawn card face.

Checked by playing a whole game through the page with a random clicker: 14 rounds, no script
errors, a gift accepted and a halo earned, both Traders put in scandal by the Fall, the bot won at $1,020M.

## The Singular80 (2026-11-20)

Card 88, an on-draw Event (Ambiguity). When it is drawn, time folds: from then on every player takes
two main actions each turn, for the rest of the game, starting with the player who drew it. A second
copy of the effect does nothing. The Octobot's Eight Arms still adds its one Asset on top of both.
The Enigma Machine can intercept it like any other Event.

- Engine: `this.accelerated` (set in `event()`), the two-action loop in `turn()`, `this.secondAction`
  for the table's prompt, `stats.secondActions`.
- It is in the General shuffle only. The starter decks do not hold it.
- Art: a live 3D scene (`src/game/rcana/live3d/singularity.js`), the second after Sacred Geometry.

## Cult of Personal80 (2026-11-21)

Card 81, a Relic, cost $20M, in The Rooster's old slot (The Rooster is a card of the traditional lotería
deck and is reserved for that edition). The faithful do not read the news:

- While it is equipped, the seated Trader collects $10M more each turn (the faithful pay in), and is paid
  their good-standing income (Ethos) even in scandal.
- No other Trader can be played over them while it is equipped.
- If they are discredited, the Cult is discarded with them.

It does not stop a strike (that is The Halo) and it does not return anyone to good standing: abilities
that need good standing still need it. Engine: `cult` on the design, `cultBound(p)`, the `faithful`
branch of turn income, `flock` on the design, `stats.cultPaid`. It took The Rooster's place in the Degen deck.

The sims cannot judge it, or any Relic: the bots play 2 to 4 in every 100 Relics they hold (measured
2026-11-21 over 3,000 games; only The Lottery Ticket is higher, at 15). Until the bots value Relics, a
Relic in a starter deck plays as a dead card in simulation, and the win rates say what the deck does
without it.

## Four cards in, three out (2026-11-21)

The Cow, The Avocado and La Horchata left the set (lotería in style; their designs, faces and art are
kept for that edition). The set is 89.

- **The Prediction Market** (83, Asset, $30M; Degen, in The Avocado's place). Sell for a sure $30M, or
  name your odds and roll: 3+ pays $100M, 5+ pays $160M, an 8 pays $400M; a miss pays nothing. The Gambler
  needs one lower. `market` on the design, `marketNeed()`, a `call` on the sell action.
- **Diamond Hands** (82, Relic, $20M; Devotion, in The Cow's place). An Asset held three rounds or more
  sells for $25M more (`diamondOf()`, inside `prosOf()`), and Paper Hands cannot be played on its holder.
- **Paper Hands** (89, Calamity, $30M; General shuffle only). A condition: at the start of each turn its
  victim sells the Asset they bought most recently at its cash price. The Stimulus and The Miracle
  Tortilla clear it.
- **The Whistleblower** (42, Remedy, $20M; Devotion, in La Horchata's place). Undoes the last fraud
  played on you (`lastFraud` on the victim): the Asset returns from the discard pile, or the money comes
  back (from the thief, for a Quantum Hack), and the rival who played it takes a strike.

### Quantum Hack and Exit Scam join the Degen deck (2026-11-21)

In place of Tech Wreck and Moral Hazard (both still in the General shuffle). Degen now holds all three
frauds, so The Whistleblower in Devotion has something to answer besides a Rug Pull. In bot play this
moves little: over 4,000 games the bots play about one fraud every three games, The Whistleblower about
once in twenty, and the decks sit near Devotion 55 / Degen 45.

### A Stablecoin for The Skull in the Degen deck (2026-11-21)

Degen had lost The Rooster and The Avocado, two earning Assets, for cards the bots use less. A Stablecoin
in The Skull's place brings the decks back to even. The Skull is still in the set and the General shuffle.

### Tech Wreck moves to the Devotion deck; The Whistleblower to the General shuffle (2026-11-21)

Tech Wreck (kept for its art) takes The Whistleblower's place in Devotion: Devotion holds one Tech Stock
to Degen's two, so the wreck falls harder on its rival. Tried first in Full Moon's place, which cost
Devotion five points: its called Events are its income. The Whistleblower was played about once in
twenty bot games; she stays in the set and the General shuffle, like Paper Hands.

### The Prediction Market becomes a Location (2026-11-21)

A market is a venue, not a thing held and sold, so the card moved from Asset to Location: the first
Location of the Degen kind (the other three are sacred places). While it stands, once on its owner's
turn, after the draw and before the main action, they may stake $20M and name their odds: 3+ pays $30M,
5+ pays $50M, an 8 pays $200M; a miss loses the stake. The Gambler needs one lower on the first two; the
long shot is an 8 for everyone. A Miracle can roll a miss again. Under a Bear Market the $200M contract
is closed. Engine: `stake` and `market` on the design, `marketOffers()`, `marketBet()` (called in
`turn()` after `turnDraw()`), `policy.placeBet`, `stats.marketCalls / marketCall0..2 / marketWins`.
The Asset version's sale code is gone. It still competes with The Catacombs for Degen's one Location.

### The Virtue Signal is cut; the set is 88 (2026-11-21)

The weakest card: it only stopped a rival's candles from helping their Hail Mary, nothing but The Miracle
Tortilla cleared it, and it was in neither starter deck. Its design is kept as a comment. Paper Hands
moved from 89 to its number, 60, so the set runs 1 to 88.

### Saint GR80: Money $10M (2026-11-21)

Down from $15M. After the day's deck changes he opened at 56% and Devotion won 52%; at $10M he opens at
49% and the decks are even (8,000 games). His Ethos stays 4, the highest in the game: the cheapest Trader
with the best character. Deck swaps for Degen, Eugene's premium and his own candle income were tried
first and moved nothing.

### The bots learn what a Relic is worth (2026-11-21)

Until now every Relic scored a flat 35 less half its price, whatever it did, and the bots equipped 2 to 4
of every 100 in their decks. `GreedyBot.relicWorth()` now values each one in $M over the rounds left:
income in full (the Cult's flock, The Lottery Ticket's odds, The Skull), bonuses by what is in hand or
portfolio (Sacred Geometry, Diamond Hands, the Map, the Rosary), protection at the odds of what it stops
(The Halo, The Shroud, the Sacred Heart, The Keys, The Audit), and a Miracle for an apparition. A full
desk swaps out its weakest Relic only for a clearly better one.

Equipped per 100 copies in a starter deck (about half a deck is drawn in a game): Lottery Ticket 41,
Cult 21, Tattoo 20, Sacred Geometry 9, Sacred Heart 6, Dashboard Figure 6, the rest 0 to 3. The
protections stay rare because what they stop is rare.

With Relics in play the starter decks read Devotion 47 / Degen 53 at Saint GR80's Money $10M, and
49 / 51 at $15M: the $10M was fitted to bots that could not see Relics.

Saint GR80's Money went back to $15M the same day (Devotion 49 / Degen 51 over 10,000 games).

### The Talisman; The Shroud is cut; the set is 86 (2026-11-21)

- **The Talisman** (63, Relic, $20M; Devotion, in The Audit's place) is The Keys and The Audit merged:
  Rug Pull, Quantum Hack and Exit Scam cannot be played on you, and your seated Trader counts one more
  Pathos against Calamities (`wards`, `pathos` on the design; the Pathos is added where a Calamity is
  rolled against). The two it replaces were usually dead cards, because frauds are rare.
- **The Shroud** is cut: the weakest of the standing protections, and in neither starter deck. The Sacred
  Heart, The Halo, The Tattoo, the Press Release and Confession remain. Saving Face, from the hand, is
  untouched.
- Designs, faces and art of The Keys, The Audit and The Shroud are kept as comments.
- Numbers: The Talisman has The Keys' 63; Perpetuals moved from 86 to The Shroud's 70; The Singular80 is
  86, still the last card.

### Cult of Personal80 is cut; the set is 85 (2026-11-21)

Cut the day it was added: a card that pays a Trader for staying in scandal undercuts the game's premise,
that character (Ethos) is what pays. Its design is kept as a comment; the engine's `cult` code is unused.
Paper Hands takes its place in the Degen deck, its first starter deck: Devotion holds Diamond Hands,
which turns it away, and two Miracle Tortillas, which clear it. La Plata moved from 85 to 81; The
Singular80 is 85, still last. Devotion 50 / Degen 50 over 10,000 games.

### The Mission (2026-11-21)

Card 85, a Location, $20M: at the start of your turn, if you have less cash than every rival, collect
$20M. A place from the RL80 website, and the set's samaritan: it pays only the player who is behind, so it
shortens no game for the leader. `alms` on the design, checked at the start of `turn()`; `stats.alms`.
In the General shuffle only: each starter deck already holds two Locations and a desk holds one. The
Singular80 is 86, still last.

### The Mine is The Mother Lode, the eleventh apparition (2026-11-21)

The heap of ore in the card's art reads as Our Lady, mantle and rays: a happy accident, now the card's
name. It is an apparition (`apparition: true`; playing it grants a Miracle) with the lit-halo finish
(`apparitions.js`, on the scene layer). Its rule is unchanged, its key is still `mine`, and it is in
neither starter deck. Eleven apparitions until The Rose leaves for the Lotería edition; then ten.
