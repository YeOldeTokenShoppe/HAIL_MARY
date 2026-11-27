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
- Cards written for a deck of your own read differently here: Marisol sees the top of the shared deck, Purgatory (The Lonely Soul until 2026-11-23) returns the last Trader anyone discarded.

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

## Eugene: The Spectacle (2026-11-20; named The Narrative until 2026-11-23)

The ability was renamed The Spectacle on 2026-11-23. The notes below were written under its first name, and the engine's flag is still `narrative`.

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

## Saint's Skull (2026-11-23)

The Skull was renamed Saint's Skull and given a rule that pays. Tried over 8,000 games each, the card added to both decks ("holder wins": games where one player has it out and the other does not):

| Rule | Played in | Holder wins | Brings in, a game |
|---|---|---|---|
| $10M when a rival sells an Asset (the rule until now) | 10% | 47% | $1M |
| $30M when a rival sells | 25% | 44% | $11M |
| $50M when a rival sells | 36% | 51% | $35M |
| $30M on every sale, the holder's own included (chosen) | 43% | 53% | $55M |
| a tithe: each rival pays the holder $10M at the start of the holder's turn | 43% | 61% | $50M |

A player sells about once in five rounds, so a rival's sales alone never paid. The tithe was too strong (every $10M is a $20M swing) and costing it $30M did not tame it (59%). The trial settings stay in the engine (`cut`, `cutAll`, `tithe` on the design).

It went into the Devotion deck in The Press Release's place: Devotion 50.5% / Degen 49.5% over 8,000 games (48.5% before), going first 51.1%.

## The set on 2026-11-23: three out, two in

- **The Press Release left** (played about once in sixteen copies; Coin-op Confession and Miracle Tortilla do its two jobs). **Pawn Shop** took its number, 64: a Location, once on your turn before the main action discard a card for $20M. In both decks over 8,000 games: built in 37% of seats, 2.6 cards pawned per builder, a one-sided builder wins 49% (the bots pawn only dead cards).
- **The Halo left** (played in 5 games in 100, its player winning 49%; and "halo" is also a game term). **The Black Swan** took its number, 67: an Event on the draw, the richest player loses $50M (each of them, if tied). In both decks over 8,000 games it fired in 46% of games and the player it hit still won 54% (a richer player wins 62% at any other moment); at $100M that fell to 46%, so it stays at $50M. With The 80/20 Rule beside it: 57%.
- Devotion: Saint's Skull where The Press Release was, Pawn Shop where The Halo was. Neither The Black Swan, The 80/20 Rule, Rewind nor Back to the 80s is in a starter deck.

## The Visitor (2026-11-23)

The Tears left (a plain candle for $10M beside The Offering's free one). **The Visitor** took its number, 6, and its place in Devotion: Our Lady in the beam of a saucer, arriving or leaving, and deliberately not saying which. A Grace and the twelfth apparition (so one card in 7.3 now, not one in eight). It lights a candle, then its player chooses: she arrives (draw two cards) or she departs (take any card back from the discard pile).

Over 8,000 games each (its player's win rate is against 55% for the same card as a plain candle, since an apparition already gives an action and a Miracle):

| Rule | Devotion wins | Its player wins |
|---|---|---|
| a candle only | 52.4% | 55% |
| arrive (draw two) or depart, $10M (chosen) | 55.0% | 61% |
| the same, draw one | 54.2% | 59% |
| the same, $30M | 53.9% | 59% |
| a trial: send a seated Trader back to its owner's hand | 55.3% | 62% |

Cost and the number of cards hardly moved it, so the rule stayed as written and the decks were levelled another way: **The Black Swan went into Devotion in Full Moon's place.** The bots chose "arrives" about nine times in ten.

## Tech Rekt (2026-11-23)

Tech Wrecked was renamed Tech Rekt and made a general Calamity. Over 8,000 games each:

| On the draw, it wrecks | Wrecks something | Assets a firing | The player ahead still wins |
|---|---|---|---|
| every Tech Stock (the rule until now) | 18% of firings | 0.20 | 62% |
| each player's most valuable Asset (chosen) | 64% | 0.79 | 59% |
| each player's most recent Asset | 64% | 0.79 | 59% |
| the best Asset of whoever holds the most | 64% | 0.76 | 59% |

Players mostly hold one Asset at a time, so the three general rules pick the same card; the first is the plainest to read. Deck balance did not move (it fires in under a quarter of games). The others stay in the engine behind `wreck`.

## The Inheritance (2026-11-23)

It read "3 coins, or 50 Prosperity". Two currencies made that a choice; with one money it was $50M for nothing. The choice is now time. Over 8,000 games each, the card added to both decks (it is in neither starter deck):

| Rule | Taken now / put in trust, per 100 games | A lone player of it wins |
|---|---|---|
| $30M or $50M, both at once (as it was) | all take the $50M | 54% |
| $50M now, or $100M in 3 rounds | 14 / 87 | 60% |
| $50M now, or $80M in 3 rounds | 21 / 72 | 57% |
| $50M now, or $90M in 4 rounds | 22 / 75 | 57% |
| $50M now, or $100M in 5 rounds (chosen) | 27 / 71 | 57% |

Three rounds was too little to wait for double. Five rounds is close to half a game, so late in a game the money now is right, and about nine trusts in ten pay out before the game ends.

## The Black Swan, the long tail (2026-11-23)

Its first rule (the richest loses $50M) was only ever bad news, and a black swan is neither good nor bad: it is rare and large. Now its drawer rolls the die; a 1 hits the richest, an 8 lifts the poorest, and on 2 to 7 nothing happens. Over 12,000 games each, a copy in both decks (a player ahead wins 62% at an ordinary moment, a player behind 38%):

| On a 1, the richest / on an 8, the poorest | The richest then wins | The poorest then wins |
|---|---|---|
| loses half / doubles | 27% | 83% |
| loses a third / gains half again | 36% | 70% |
| loses $200M / gains $200M (chosen) | 34% | 67% |
| loses $150M / gains $150M | 41% | 60% |
| loses $100M / gains $100M | 50% | 52% |

Half and double ended games (a doubling is worth about $430M by the time it fires). $200M turns the game around and leaves a game to play. Deck balance and length did not move in any version. Also tried and set aside: doubling the next Event to fire; a one-in-eight swap of the two players' cash.

## Traders are free (2026-11-24)

A Trader is who you are, not something you buy, so the price is gone. **Any Trader in your deck may open**, and becoming another from your hand **costs the main action and no money**. Money on a Trader card is now income only (`liq` in ../rcana/set/trinity.js; `cost` is 0 and `STARTER_MAX_COST` is `null` in pt3-sim.js). The starter rule about juniors is retired with it.

The price was never the lever (it is paid once, the income every turn), but the income gap was. Free, with the incomes as they were, openers ran from 43% to 61% (Marisol 61%, The Influencer 60%, The Octobot 57%); free with everyone at $20M was worse (Saint GR80 64%, The Octobot 39%, Devotion 58%). So income now offsets character: the strongest abilities earn least.

| Trader | Income was | Income now | Opens at |
|---|---:|---:|---:|
| Saint GR80 | $15M | $20M | 52% |
| The Influencer | $30M | $20M | 49% |
| Marisol | $30M | $20M | 49% |
| The Gambler | $20M | $25M | 47% |
| Connor | $20M | $25M | 48% |
| The Prospector | $20M | $25M | 50% |
| Eugene | $30M | $25M | 53% |
| Virgil | $20M | $30M | 53% |
| Byzantine General | $20M | $30M | 52% |
| The Octobot | $40M | $30M | 48% |

16,000 two-player games, greedy bots choosing an opener at random, with The Catacombs as cold storage (below): Devotion 51.0%, 10.7 rounds (11.5 before), going first 51%. Logos, Ethos and Pathos and every ability are unchanged.

- Eugene was first left at $30M and opened at 58% to 60% once the Catacombs stopped burying him; $25M brings him to 53%. At $20M he opens at 49% but Devotion goes to 54%.
- Still open: Eugene is the Trader at the desk at the end of 29% of seats, and those seats win 55%. The Octobot, The Gambler and Connor end games at 37% to 41%.

## The Catacombs: cold storage (2026-11-24)

Burying your own character for cash made no sense once a Trader is who you are, and it carried the bury-and-reseat exploit. The Catacombs are now **cold storage** (`vault` on the design; `isCold`, `hot`, `coldStorage` in pt3-sim.js). Once on your turn, after the draw and before the main action (the Pawn Shop's moment), move one Asset down or bring one up.

- Down there nothing reaches it: Rug Pull, Tech Rekt, The Whale, The Wheel, Paper Hands, a Bear Market's liquidation of The Perp, the weather on a Yield Farm.
- It cannot be sold or uncorked until it is back up. It still ages, pays its income, and counts for Eugene.
- If the Catacombs close (a second Location is opened over them), everything is back in reach.

12,000 to 16,000 games: the bots use it in 12% of seats (the card is in Degen only), 0.42 Assets sent down and 0.13 brought up a game, and a player who used it wins 49%. Against the same card doing nothing, deck balance moves about a point. Assets are hit rarely (a Rug Pull 0.13, Tech Rekt 0.16, Paper Hands 0.11 a game), so it is insurance, not an engine. Bringing an Asset up and selling it happen on the same turn, so storage costs no tempo; the one exposed turn is the turn an Asset is bought.

## The Degen leads (2026-11-24)

Eugene was where Degen games ended: with two copies he was at the desk at the end of 59% of Degen's games, and those seats won 56%. Connor (10%, 41%), The Prospector (8%, 42%) and The Gambler (7%, 40%) are the Traders who behave like degens, so they now carry the deck and Eugene is its wild card.

- **Eugene**: one copy in Degen (a second Gambler in his place), and The Spectacle adds $25M an Asset, not $50M (`premium` in `PT3`).
- **Connor**: the wager pays $30M on 5 or higher (it was $20M).
- **The Prospector**: Assets cost $20M less (it was $10M; `discount` in `PT3`).
- **The Gambler**: Lucky Streak covers every die her player rolls (`lucky()` in pt3-sim.js): a gamble and a market bet need one less, the Hail Mary has one more winning face, her Pathos blocks on one more, Mardi Gras pays one more point, The Lottery Ticket wins on the top two faces, and a Black Swan she draws moves one face her way.
- **The Octobot**: income $35M (it was $30M this morning, $40M before). It was the weak opener at 40%.
- The bots now count The Gambler's and The Prospector's abilities when they weigh one Trader against another, as they already did Eugene's.

16,000 games: Degen 48%, 10.7 rounds, openers from 46% (The Octobot, The Gambler) to 55% (Virgil). Who Degen ends as: The Octobot 34% (wins 44%), Eugene 19% (54%), The Gambler 17% (47%), Connor 16% (50%), The Prospector 15% (48%). This supersedes the incomes table above for The Octobot only.

- Each $5M of income moves that Trader's opening about seven points, so there is no room between steps: The Gambler at $30M opens at 56%, Connor at $30M or with a $40M wager at 57%, The Octobot at $40M at 55%.
- The end-of-game shares follow the bots' taste (they move to whoever they value most), so read them as a rough guide. The Octobot's 34% is that.
- Still open: Degen sits a point or two under even, and Virgil opens at 54% to 55%.

## Trade only (2026-11-24)

Traders should earn through trading, not a salary. **A Trader now earns nothing each turn** (`RULES.income` false; `--income` in the sim is the old game, opening with $50M), **players open with $100M** (`start: 10`), and **Ethos is a better price**: each point adds $10M to every Asset sold in good standing (`ETHOS_UNIT`, `ethosBonus()`; a forced sale pays none). An earned halo counts as one more point of Ethos. `TRADER_INCOME` in trinity.js takes the Money coin off the Trader card; the `liq` values stay there as history. This supersedes the income tables in the two sections above; free Traders, cold storage and Lucky Streak stand.

Salary was about 40% of the money in the game, so the abilities that pay each turn became the only steady income and were re-set: **Connor's wager $20M** (at $30M he opened at 60% to 63%), **Saint GR80's Vow $15M a candle** (was $25M), **Eugene's Spectacle $50M an Asset** (was cut to $25M that morning; he opened at 43% without it).

Starting capital, 8,000 games a row in a trial with those settings:

| Opens with | Rounds | Passes a player | Devotion | Openers |
|---|---:|---:|---:|---|
| $10M | 18.4 | 4.4 | 40% | 35% to 69% |
| $50M | 17.0 | 1.0 | 51% | 40% to 55% |
| $100M (chosen) | 15.9 | 0.7 | 52% | 42% to 55% |
| $200M | 14.0 | 0.5 | 50% | 44% to 54% |
| $300M | 12.0 | 0.3 | 49% | 45% to 54% |

At $10M the game stalls (in rounds 1 to 4, 78% of turns begin with under $20M and 31% end in a pass) and belongs to whoever can make money from nothing: Connor 69%, The Prospector 68%. $100M is the least that never stalls (0% and 2%). $100M with the goal at $750M runs 10.9 rounds, the old length.

As built, 12,000 to 16,000 games: 16.2 rounds (10.8 with a salary), Devotion 53% to 54%, going first 50%, 3.2 sales a player, the Ethos bonus about $71M a player a game. Openers: Marisol 56, The Influencer 55, Saint GR80 54, The Prospector 53, Virgil 50, The Gambler 49, Byzantine General 49, Connor 48, Eugene 45, The Octobot 40.

- The built game leans a little more to Devotion than the trial did, because the bots now count the Ethos bonus when they decide to sell, and Devotion holds the high-Ethos Traders. At $5M a point it is the same (Devotion 52.5%), so the lean is not the size of the bonus.
- **Still open: The Octobot** (40%). Its strength was its income. Letting it pray changes nothing. It needs a trading ability. Eugene (45%) is low with it, and the two are why Degen is behind.
- Ethos at $5M a point paid about $29M a player a game, too little to matter; $10M is the rule.

## The Octobot: Speed (2026-11-24)

A bot's edge is speed: it sees an opportunity and takes it before a person can. With no salary The Octobot opened at 40%, and a player who stayed as it won 32%. **Speed** replaces Eight Arms (`PT3.bot`; knobs `first`, `draws`, `graceSale`, `fastSell`, `speed` in pt3-sim.js):

- Whoever **opens** the game as The Octobot takes the first turn (`seatOrder()`; becoming it later changes nothing, and two Octobots cancel out).
- It **draws two cards** each turn.
- It has **no religious observances** (the old "cannot pray"): no candle lights while it sits, so its Hail Mary odds cannot rise. A Grace in its hand is sold for $30M as a main action.

16,000 games each, counting players who opened as The Octobot and stayed as it (a first trial counted every opener, and read 50% for a version whose players were mostly leaving it):

| Version | Stays and wins | Degen |
|---|---:|---:|
| Eight Arms | 32% | 46% |
| Two main actions, sells the turn it buys | 33% to 36% | 46% |
| ...and an extra card when the hand is three or fewer | 42% | 48% |
| Two actions and two cards | 89% | 61% |
| First turn, two cards, sells Graces (chosen) | 49% | 50% |
| ...and sells the turn it buys | 52% | 50% |

Two actions were not worth much because it had one card a turn and no salary to spend: it passed on 40% of the second actions. Going first is worth a point or so (the round is always played out), and is there as a sign of what it is. Selling Graces does not move the numbers in Degen, which carries one.

With it, 12,000 games: Devotion 50.2%, 14.7 rounds, openers Marisol 56, The Influencer 54, The Prospector 53, The Octobot 52, Saint GR80 50, The Gambler 50, Connor 48, Virgil 46, Eugene 46, Byzantine General 45.

**Eight Arms, later the same day.** The ability keeps its old name and the eight becomes its signature: The Octobot **opens with eight cards and holds eight** (`opens`, `holds`; everyone else five and seven), with the first turn, two cards a turn and no religious observances as above. The bigger hand is not the engine: a hand limit of eight alone left a player staying as it at 31%, opening with eight as well at 36%, opening with ten at 40%. With two cards a turn: 54% (16,000 games), an opener at 52% to 55%, Devotion 50.3%, 14.6 rounds. The old Eight Arms (an extra Asset bought or sold) stays off behind `arms`.

## The opening prayer (2026-11-24)

Players are scrappy would-be capitalists, and some people simply start ahead. **Nobody starts with money.** Before the first turn each player rolls the die, a prayer for a windfall (`RULES.prayer`, `openingPrayer()`; `--noprayer` opens everyone with `start`). **The higher roll is answered and starts with $200M. The other starts with $100M and two candles lit**, so their Hail Mary begins at 3 in 8: capital for one, grace for the other. A tie is rolled again (12% of games). The rolls are plain: Lucky Streak does not touch them, and The Octobot keeps candles lit before the game. Both are open questions.

How much a head start decides, 12,000 games a row (set by hand, before the rule was built):

| Lucky / unlucky | The lucky player wins |
|---|---:|
| $150M / $100M | 57% |
| $200M / $100M | 63% |
| $200M / $50M | 69% |
| $300M / $100M | 74% |
| $200M / $0 | 84% (the other passes 2.3 turns a game) |
| $200M / $100M and one candle | 60% |
| $200M / $100M and two candles (chosen) | 55.5% |
| $200M / $100M and three candles | 53% |

Every $50M is worth six or seven points, so the bare windfall would settle too much on a roll nobody can answer. As built, 16,000 games: the answered prayer wins 55.3%, 13.1 rounds, Devotion 48%. Openers: The Octobot 57, The Prospector 54, The Influencer 52, Marisol 52, Connor 50, The Gambler 50, Eugene 49, Saint GR80 48, Byzantine General 44, Virgil 44.

- At the table the prayer is a dialog after the deal: both dice, a Roll button, the result, Begin.
- Still open: The Octobot rose to 57% with more money on the table at the start, and Virgil and the General sit at 44%.

## The fuller turn (2026-11-24)

Set beside Pokémon and One Piece, a turn here held too little: one card drawn, one main action, under one card played a turn. **A turn is now: draw two cards, then do up to three things in any order, one of each kind: buy one Asset, sell one Asset (or uncork one), and take one main action** (any other card, a gift, paying a Calamity off, the Hail Mary). Passing ends the turn (`RULES.slots`, `RULES.draws`, `catOf()`; `--oneaction` is the old turn). An apparition and The Singular80 add free actions of any kind after the three.

8,000 games a row, in a trial before it was built:

| Turn | Actions a turn | Rounds | Cards played a player | Devotion | Openers |
|---|---:|---:|---:|---:|---|
| Draw 1, one action (before) | 1.1 | 13.0 | 10.6 | 47% | 40% to 57% |
| Draw 1; buy, sell, main | 1.45 | 13.1 | 13.9 | 38% | 36% to 78% |
| Draw 2, one action | 1.2 | 9.6 | 8.1 | 50% | 38% to 59% |
| Draw 2; buy, sell, main (chosen) | 1.95 | 8.7 | 12.5 | 50% | 46% to 54% |
| Draw 3; buy, sell, main | 2.3 | 6.7 | 11.3 | 49% | 46% to 54% |

- **Card flow was the constraint.** With one card a turn the three kinds go unused, and only The Octobot (who drew two) could use them: 77%. It is why Speed as two actions failed the same morning.
- As built, 16,000 games: 8.7 rounds, 1.95 actions a turn, Devotion 50.4%, the answered prayer wins 54%, openers from 47% (The Gambler) to 53%. A player takes about 17 actions a game, against 14 before, in fewer rounds.
- **The Octobot** no longer draws more than anyone (everyone draws two): its edge is the first turn, eight cards to open and eight held. A player staying as it wins 50%; drawing three, 57%.
- It balances at $1 billion. With the goal at $1.5 billion the same turn gives Devotion 63% and openers from 34% to 67%.
- Still low: under one Calamity a player a game. The fuller turn makes the race busier, not more of a contest.
- At the table: three lines by the End turn button (Buy an Asset, Sell an Asset, Play a card) are struck through as they are used; the turn ends by itself when nothing is left to do.

## The Fates (2026-11-24)

The Events that fire for the whole table are no longer in anyone's deck. They are **The Fates**: one shared deck of 16 (17 in the General shuffle, which adds The Singular80), and **one is turned at the start of each round** (`RULES.fates`, `flipFate()`; `--nofates` puts them back in the decks, firing on the draw). Each Fate is turned *for* one player, alternating by round: that player witnesses an apparition, rolls The Black Swan, is initiated by The Illumin80, and their Enigma Machine may intercept. "Fires on draw, then draw a replacement" is gone, and a player's own deck is all theirs.

Degen carried seven of these Events and Devotion two, so the starter decks changed (both still 40):

- **Devotion**: out, The Black Swan and Tech Rekt. In, Tax Collector and Paper Hands.
- **Degen**: out, The Whale, The Wheel, Mardi Gras, God Candle, Fire Horse, The Illumin80, Fall From Grace. In, Oil Field Claim, Bull Run, Full Moon, Tax Collector, and a second Bear Market, Rug Pull and Exit Scam.

8,000 games a row, in a trial:

| Version | Rounds | Devotion | Openers | Calamities a player |
|---|---:|---:|---|---:|
| Events in the decks (before) | 8.7 | 51% | 47% to 53% | 0.96 |
| The Fates, decks not refilled | 8.5 | 58% | 38% to 60% | 1.01 |
| The Fates, one every turn | 7.9 | 61% | 37% to 62% | 0.94 |
| Degen refilled with seven money cards | 6.8 to 7.2 | 32% to 43% | up to 28% to 71% | 0.60 |
| Refilled with the mix above (chosen) | 8.7 | 49% | 46% to 54% | 1.09 |

As built: 8.5 rounds, 8.5 Fates a game, Devotion 49.4%, openers 47% to 54% (The Octobot highest), the answered prayer 53%, going first 53% (it was 51% to 52%).

- The refill is a first mix that balanced, not a designed deck.
- Interaction is unchanged: about one Calamity a player a game. The Fates share the weather; they do not make the players contest each other. Long and short positions on the next Fate are the idea for that, not built.
- Not built: the next Fate lying face down to be peeked at (Marisol, The Enigma Machine).
- At the table: the round label reads "Round 3 · The Fates: The Whale", and a Fate's notice is headed "The Fates · turned for you". Card text loses "Fires when drawn".

## Disgraced, not discarded (2026-11-24)

A second strike used to discard the Trader and leave an empty seat. A Trader is who you play as, so now they are **disgraced and stay** (`RULES.disgrace: 'stay'`; `--leave` is the old rule): no ability, no Ethos bonus, no Pathos and a blind draw, until they are back in good standing (a candle, The Confession) or the player becomes another Trader. The seat shows them drained of colour.

12,000 games each: it changes nothing in the balance (8.6 rounds, Devotion 49%, openers 45% to 55% in every version). A Trader is disgraced 0.35 times a game, and a player it happens to wins 55%, because the bots strike whoever is ahead. Also tried: no Trader, no buying or selling until one is seated (the same numbers; the bots reseat within a turn, a person in the General shuffle might wait much longer), and the same with the next Trader dug out of the deck.

## The market (2026-11-24)

A bull run happens to everybody. The four Events a player paid for and collected on at once (Bull Run, Full Moon, Short Squeeze, Token Unlock) are **Fates** now, and they move the price of every Asset for the round they are turned (`market` on the card, `Game.market`, read by `saleBonus()`): **Bull Run, Full Moon and Short Squeeze are bull markets, +$50M a sale; Token Unlock and Flash Crash are bear markets, -$50M** (Flash Crash still takes its quarter of the cash). The God Candle's +$100M is the same thing, larger. The Fates are 20 cards. **The next Fate lies face down, and a Trader with Logos 4 in good standing reads it** (`foresees()`: Marisol, The Octobot).

On the cards that left: free at the net amount (Bull Run collects $80M) played identically to paying $20M for $100M (8.6 rounds, Devotion 49%, the same openers), so the price did nothing; free at the full amount took a round off the game.

Starter decks (both 40): **Devotion** loses Bull Run x2 and Short Squeeze x2 for a second Tech Stock and Cellar, a Savings Bond and a Stablecoin. **Degen** loses Bull Run, Full Moon and Token Unlock for Real Estate, a second Blue Chip and a third Tech Stock. Devotion's are modest on purpose: Ethos 4 is paid on every sale, and with strong Assets in those slots Devotion won 58% to 67%.

As built, 16,000 games: 9.3 rounds, Devotion 48.5%, going first 52.5%, 4.9 sales a player (3.1 before), openers from 44% (The Influencer) to 57% (The Octobot).

- **The bots do not time the market.** In a trial bull rounds were 14% of rounds and saw 15% to 16% of the sales; bear rounds 13% and 12% to 13%. Reading the next Fate moves no opener by more than a point (nobody reads it, Marisol only, Logos 4, Logos 3: all the same). Whether a person uses it is for the table to show.
- Bear Market is still the Calamity played on one rival; as a Fate it would need that card renamed (a Bear Raid is the trader's word for an attack on one target).
- Sacred Geometry now adds $25M only to Seed Round, The Inheritance and The Ponzi, the Events still played from the hand. It needs a new job.
- The Octobot opens at 55% to 57% with or without the reading: its eight cards are worth more in a deck that is mostly Assets.
- At the table: the Fates band shows the market for the round (green for bull, red for bear) and the next Fate, face down, or its name and picture to a player who can read it.

## Special Offer (2026-11-25)

**The 80/20 Rule left the Fates; Special Offer took its place and its number (85).** The 80/20 Rule paid the richest player
$80M and everyone else $20M: a leader's card, and its picture never came right. Special Offer is a sale: for the round it is
turned, every Asset costs $20M less to buy, for everyone, on top of the Prospector's own discount (`sale: 2` on the design;
`Game.sale`, read in `costOf`, cleared when the next Fate is turned, like `Game.market`). The market Fates move what Assets
sell for; this is the first that moves what they cost.

12,000 games each, two players, seeds 424200+:

| Fate in slot 85 | rounds | Devotion | Octobot | Prospector | Influencer |
|---|---|---|---|---|---|
| The 80/20 Rule | 9.3 | 48.6% | 56 | 55 | 45 |
| nothing (blank card) | 9.7 | 48.6% | 56 | 55 | 45 |
| Special Offer, $20M off | 9.6 | 48.5% | 56 | 55 | 44 |
| Special Offer, $30M off | 9.5 | 48.3% | 57 | 55 | 44 |
| Special Offer, $50M off | 9.5 | 48.2% | 57 | 55 | 44 |

Balance does not move at any size, and it does not stack into a Prospector problem. The game is about a third of a round
longer than with The 80/20 Rule, which handed out $100M each time it turned. $20M stands. The bots do not hold a purchase
back for a sale; a person can.

**Half off (later the same day).** The sale became half price (`saleRate: 0.5`; the Prospector's $20M comes off first, then
the half, so a $60M Blue Chip costs him $20M). 12,000 games: 9.6 rounds, Devotion 48.4%, Octobot 56, Prospector 54,
Influencer 44: the same as $20M off. A flat $20M made the two cheapest Assets free and barely dented a Blue Chip; half off
saves $10M to $30M, most on the dearest, so the sale is the round to buy big. `sale` (a flat amount) still works.

## Thirteen and fourteen apparitions (2026-11-25)

**The Motherboard** (Our Lady drawn in its traces) and **The Votive** (her icon on the candle) joined the apparitions: playing
either gives one more action and a Miracle, as the other twelve do. 12,000 games each, two players, seeds 424200+:

| apparitions | rounds | Devotion | Octobot | Prospector | Influencer | apparition actions per player |
|---|---|---|---|---|---|---|
| 12 | 9.6 | 48.4% | 56 | 54 | 44 | not measured |
| 13, The Motherboard | 9.5 | 48.2% | 55 | 55 | 45 | 2.69 |
| 14, The Votive too | 9.5 | 49.2% | 52 | 55 | 46 | 2.81 |

The Motherboard is only in the General Shuffle and moves nothing. The Votive is in the Devotion starter: Devotion gains a
point and the Octobot, which was the strongest opener, loses three.

## The Airdrop and The Whistleblower (2026-11-25)

**The Airdrop goes to holders.** Every player with at least one Asset (cold storage counts) collects $20M; it paid everyone, so
it changed nothing. 12,000 games each way: 9.5 rounds, Devotion 49.3% before and 49.2% after. Tried and not taken: $20M per
Asset held, $10M plus $10M per Asset, $40M to players with no Asset, $40M to whoever holds fewest (all within a point).

**The Whistleblower answers any Calamity played on you** (`clears: 'any'`, her own player's only). A fraud is undone, as before;
any other Calamity on you is cleared; either way the rival who played it takes a strike. She is only in the General Shuffle.
There she was played in 12% of the hands that drew her and is now played in 27%, winning 55% of those; starter games are
unchanged (Devotion 49.2%). Not taken: a copy in the Devotion starter for Sacred Geom8ry (Devotion 52.7%, Gambler 44, Eugene 41).
A control, The Stimulus for Sacred Geom8ry, gave Devotion 50.0%: Sacred Geom8ry still wants a new job.

## The Short replaces The Whistleblower (2026-11-26)

**The Whistleblower left the set** (kept on file in designs.js): the game is about trading, and a whistleblower belongs to a
story about companies and regulators. Her number, 42, goes to **The Short**, an Event played from the hand for $20M.

**The Short.** Play it on an Asset your rival holds (the player chooses which; not one in cold storage, and one Short an Asset
at most). It waits on its player's desk (`p.shorts`) until that Asset leaves the rival's portfolio, however it leaves: sold,
rugged, wrecked, sold by Paper Hands, moved by The Whale or The Wheel. Then it pays $100M (`short: 10` on the design), unless
the rival sold it in a round when the market adds to sale prices (a bull Fate or The God Candle): then The Short is lost.
`settleShorts()` runs after every action, after each Fate, after the start-of-turn effects and before the win is read. Frauds
that have landed have no answer now, which is the hit-versus-condition rule: hits are prevented, not cured.

Trials first (`pt3-trial-short.mjs`, `pt3-trial-stoploss.mjs`; 12,000 General Shuffle games each, seeds 424200+):

| card in slot 42 | played by those who drew it | paid | those who drew it won |
|---|---|---|---|
| The Whistleblower | 26% | | 48.2% |
| The Short, first draft: pays the sale price, only if rugged, wrecked or sold in a bear round | 29% | 13% | 45.8% |
| The Short, pays unless sold in a bull round, $50M | 22% | 56% | 46.3% |
| The Short, the same, $100M | 46% | 51% | 47.2% |
| Stop-Loss (a Relic), Assets only, pays what the Asset cost, spent on use | | 0.12 a copy | 45.6% |
| Stop-Loss, Assets and half of any cash taken, stays equipped | | 0.55 a copy | 45.7% |

The first draft expired worthless 69% of the time: nine rounds is too short a game for a bet on something rare. Stop-Loss
worked but returned about $38M on a $20M card, a fourth protection beside The Talisman, Sacred Heart and The Catacombs.

**As built**, 12,000 General Shuffle games: 9.3 rounds, going first 58.2% (both unchanged); The Short is played by 45% of the
players who draw it, 58% of Shorts pay, 21% are lost to a bull sale and 21% are still open at the end; the players who draw it
win 50.0%. Starter games are unchanged (it is only in the General Shuffle): Devotion 49.2%.

- The bots do not play around a Short: a shorted Asset is held back outside a bull round, but they do not wait for one on
  purpose. A person will, so the 58% is a ceiling.
- Shorting an Asset and then playing Rug Pull on it happened in fewer than 100 of 12,000 trial games.
- Not built: the Short Squeeze Fate discarding every Short on the table.
- The card has no face or art yet.

## Fire Horse and The Holy Roller move the market (2026-11-26)

Both were handouts with nothing to do with trading (everyone collects $75M; everyone draws a card and collects $10M). They stay
apparitions with Radi8, and now they are market Fates:

- **Fire Horse**: a bull round, every Asset sells for $75M more (`market: 75` on the design; flipFate sets it like any market
  Fate). Between the ordinary bull Fates (+$50M) and The God Candle (+$100M).
- **The Holy Roller**: the die is rolled when she is turned. 5 or higher is a bull round, 4 or lower a bear round, $50M a sale
  either way (`marketRoll: { bull: 5, amount: 50 }`). A plain roll: no Trader's ability touches it. Her subtype is Ambiguity now.

12,000 starter games, seeds 424200+ (the trial, `pt3-trial-market-apparitions.mjs`, left Yield Farms standing through these two
Fates and read a little short; the rows below are the engine as built):

| | rounds | Devotion | games with no winner |
|---|---|---|---|
| both as handouts (before) | 9.5 | 49.2% | 0 |
| Fire Horse +$75M, Holy Roller 5+ / 4- (built) | 9.85 | 47.9% | 4 |
| Fire Horse +$100M, the same Holy Roller | 9.7 | 47.7% | 2 |
| Fire Horse +$75M, Holy Roller also deals everyone a card (`marketRoll.draw: 1`, a knob, off) | 9.6 | 48.5% | 2 |

- A third of a round longer: $170M a cycle of the Fates no longer falls on the table.
- **A dry table is now possible, rarely.** A sold Asset leaves the game, so the supply is finite; Fire Horse's $75M each time
  she came round was what always got someone to the billion. In 2 to 4 bot games in 12,000 every Asset is sold, nobody is at
  $1B, and the two trade frauds until the turn limit. The game wants an ending for that case (most cash when the Assets run
  out, say).
- More bull rounds are more ways out for a shorted Asset.
- The printed faces of both cards carry the old text until they are rendered again.

## A sold Asset goes to the discard pile (2026-11-26)

The fix for the dry table. A sold Asset used to leave the game; now it goes to its seller's discard pile and comes round again
when the deck is reshuffled (`recycle: true` in RULES; `recycle()` in the engine). The Assets never run out, so the game always
ends. Rewind can take a sold Asset back, as its text already said. Trial: `pt3-trial-ending.mjs`, 12,000 games each.

| starters | rounds | 99% of games over by | longest | Devotion | no result |
|---|---|---|---|---|---|
| sold Assets leave | 9.85 | 19 | 247 | 47.9% | 4 |
| sold Assets recycle (built) | 9.79 | 19 | 24 | 48.0% | 0 |
| leave, and a cap of 20 rounds (most cash wins) | 9.79 | 19 | 20 | 48.0% | 2 ties; 72 games ended by the cap |
| leave, and a cap of 30 rounds | 9.81 | 19 | 30 | 48.0% | 0; 11 ended by the cap |

General Shuffle: 9.69 rounds, longest 154 and 2 with no result before; 9.45 rounds, longest 21 and none after. A round cap also
works, but it is one more rule to teach and it decides some games on a count.

## Quantum Hack costs $30M (2026-11-26)

It was $20M, the cheapest of the three frauds and the most efficient (the thief gains $40M and the victim loses $40M). Now all
three cost $30M. 12,000 starter games: 9.8 rounds, Devotion 48.3% (48.0% before). 20,000 General Shuffle games
(`pt3-card-report.mjs`): played by 35% of the players who hold it (39% before); those who land it win 64.5% (64.7%). The price
moved little: the card is still as good as Exit Scam. The printed face shows 20 until it is rendered again.

## Token Unlock is The Sell-Off (2026-11-26)

A rename: a crypto term gave way to a general trading one. The same bear Fate ($50M less a sale for the round); the design key
stays `unlock`, and the face id and art folder keep `token-unlock`. Its line reads "Everyone heads for the exit."

## Seven out, seven in: more Assets, and Garth Raider (2026-11-26)

`pt3-card-report.mjs` (20,000 General Shuffle games, every card one copy) showed what was weak and what the groups were short
of: Assets were one card in six and holding them is what wins; Relics, Locations and Traders mostly sat in the hand.

**Out** (kept on file in designs.js and faces.js): Enigma Machine, Sacred Geom8ry, Diamond Hands, Treasure Map (Relics), The
Mission (Location), Paper Hands (Calamity), The Bell (Remedy; played by 5% of the players who held it).

**In**, on their numbers:

| card | | rule |
|---|---|---|
| Garth Raider (82) | Trader, Logos 4 Ethos 2 Pathos 2 | in a bear market his Assets sell for more instead of less (`bearish`) |
| Gold Bar (17) | Asset $40M, sells $100M | a bear market raises its price instead of lowering it (`haven`) |
| Index Fund (33) | Asset $30M, sells $75M | Rug Pull and Tech Rekt cannot take it (`diversified`; `exposed()`) |
| Junk Bond (60) | Asset $20M, sells $25M | $20M a turn, but first the die: on a 1 it defaults (`junk`) |
| Pork Bellies (69) | Asset $30M | $50M, $150M on the second round held, then $50M less a round (`ripe`, The Avocado's rule) |
| Fine Art (72) | Asset $50M, sells $300M | only in a bull market (`bullOnly`) |
| Racehorse (77) | Asset $30M | sell for $30M, or race her: 7 or 8 wins $350M (`gamble`) |

**Renamed:** Yield Farm is Dividend Stock ($20M a turn, and it no longer withers when a Fate turns: with a Fate every round it
never lasted one; in the report it was never once sold). The Prospector is Brent Crude, an oil man (title The Wildcatter).

The set is 88: Traders 11, Assets 20, Fates 21, played Events 4, Calamities 8, Remedies 3, Relics 8, Graces 7, Locations 6.
Starters: Devotion gets Gold Bar, Index Fund, Junk Bond and Fine Art for Diamond Hands, Paper Hands, The Bell and Sacred
Geom8ry; Degen gets Garth (for the second Gambler), Racehorse and Pork Bellies for Paper Hands and the Enigma Machine.

12,000 starter games, seeds 424200+:

| | rounds | Devotion | openers |
|---|---|---|---|
| before | 9.8 | 48.3% | |
| after | 7.9 | 50.7% | 47% (Garth) to 55% (Saint GR80) |

**The game is two rounds shorter.** More Assets means more sales: the buy and sell slots are used. General Shuffle: 7.3
rounds (9.45 before); The Octobot opens at 66% there (72% before). In the report every new Asset sits inside the old range
(players holding one win 52% to 59%; Blue Chip is 61%, Savings Bond 47%). If nine or ten rounds was the right length, the
goal or the prices want a look.

Not done: faces and art for the seven new cards; Brent Crude's art (he is still drawn as a gold prospector); Dividend Stock's
art (still the farm); the vice named on each Trader.

## Companion cards and sets (2026-11-26)

The idea is Pokémon's: a card that does more when its partner is present, which is also the best reason for two players to
trade. On the designs: `companion` on each Trader, `set` on eight Assets; in the engine `comp()`, `setMate()`, `pairBonus()`.

| Trader | companion | together |
|---|---|---|
| Brent Crude | Oil Field Claim | gushes on one more face |
| Garth Raider | The Short | pays $150M |
| Saint GR80 | Pocket Saint | equipping it lights a candle |
| Eugene | Seed Round | blooms in two rounds |
| The Gambler | Racehorse | wins on one more face |
| The Influencer | Meme Coin | moons on two more faces |
| The Octobot · Connor · Virgil · Marisol · Byzantine General | Tech Stock · Perpetuals · Real Estate · Blue Chip · Savings Bond | sells for $50M more (placeholders) |

Sets, $50M more on each sale while two are held: Metals (Gold Bar, Quicksilver), Collector (Fine Art, Classic Car, Grail
Card), Income (Dividend Stock, Junk Bond, Stablecoin).

As built, 8,000 games: starters 7.7 rounds (7.9), Devotion 48.7% (50.7%), openers 47% to 54%; General Shuffle 7.1 rounds (7.3).
Left to chance the pairs seldom meet: 5% to 8% of sales carry a companion bonus, 4% to 6% a set bonus.

**Trading with the rival** is not built. Trial (`pt3-trial-pairs.mjs --trade 1`): at the start of a turn a player may sell
the rival one Asset from the portfolio or one card from the hand; the bots trade when it is worth $MIN more to the buyer, and
split the difference.

| | rounds | trades a game | driven by a companion or set | Devotion |
|---|---|---|---|---|
| General Shuffle, min $20M | 6.8 | 3.3 | 36% | |
| General Shuffle, min $50M | 6.9 | 0.9 | 76% | |
| starters, min $20M | 7.4 | 3.6 | 41% | 43.6% |
| starters, min $50M | 7.5 | 1.1 | 84% | 47.1% |

Without companions the bots still trade 2.6 times a game: Ethos, The Gambler's odds and three candles for a Grail Card
already make a card worth more to one player. With a $50M bar the trades are nearly all about a pair, and the starters hold.

Not done: the small symbol of the key card on the printed frame (RcanaCard3.jsx); rules of their own for the five placeholder pairs.

## The five other companions, the card medallions, and trading (2026-11-26, later)

**The five placeholder pairs have a rule of their own** (they were a plain $50M on the sale): The Octobot sells its Tech Stock
the turn it buys it (`fast`); Connor's wager pays double while he holds Perpetuals (`wager`); Virgil collects $10M rent a turn
from Real Estate (`rent`); Marisol pays $20M less for a Blue Chip (kind `cost`); Byzantine General's Savings Bond grows twice
as fast (`growth`). 8,000 starter games: 7.8 rounds, Devotion 50.3%, openers 47% to 55%.

**On the printed card** (RcanaCard3.jsx: `pair` and `set` on the model): a small medallion of the partner card on the text box's
top edge, at the right (a Trader shows their companion, the companion shows the Trader; the partner's subject art, or its
initials while it has none), and a set's diamond at the left. Not yet seen rendered; the faces want rendering again.

**Trading with the rival is built** (`trade: { min: 50 }` in RULES; `offerSale()`, `tradeWorth()`, `tradeStep()`; --notrade).
Once on your turn you may offer the rival one card at a price you name: an Asset from your portfolio, or a card from your
hand. They take it or leave it, and it uses none of the three actions. A person uses the Offer a card button; a bot offers at
the start of its turn, the card worth at least $50M more to the buyer, at the price that splits the gap, and buys when its
gain is no smaller than the seller's. A sale to the rival is a way of leaving the portfolio: a Short on that Asset pays.

8,000 games, bots: starters 7.7 rounds, Devotion 48.8% (50.3% without trading), 0.58 trades a game (a trade in 45% of games),
average price $113M; General Shuffle 7.0 rounds, 0.53 trades a game, $129M. About half the bots' offers are turned down.

## The bar: fuel as a temptation (2026-11-26)

Pokémon's energy, turned round: not something a Trader needs, but something they may give in to. No cards (the set is still
88): on your turn you may order one drink, or none, never the same one two turns running. A kick now, a comedown after; a
Trader's own drink (`prefers` on the design) has no comedown. The Octobot takes the same five as power boosts. `bar: true` in
RULES, `DRINKS`, `drink()`, `canDrink()`, `barStep()`; --nobar.

| drink | kick | comedown |
|---|---|---|
| Espresso | everything sold this turn brings $30M more | next turn: one card fewer, no buying |
| Energy Drink | two more actions, and sell what you buy this turn | next turn: one card fewer, no buying, ability off |
| Champagne | the next gamble wins on two more faces | the next sale brings $50M less |
| Whiskey | no Calamity can be played on you until your next turn | next turn: ability off |
| Sugar Rush | draw two cards | discard one at the end of the turn |

Their own: espresso Garth Raider, Marisol · energy drink The Influencer · champagne The Gambler, Eugene · whiskey Brent Crude,
Byzantine General, Connor · sugar rush Virgil, Saint GR80.

Trials (`pt3-trial-fuel.mjs`, 8,000 games each; "drinker" is a bot that drinks against one that never does, General Shuffle):

| | the drinker wins |
|---|---|
| fuel the Trader NEEDS (attached, ability off without it) | ability off on 19% to 23% of turns, a round longer: dropped |
| drinks as five cards, first kicks (an extra action) | 48.6%: an extra action is worth little |
| drinks as five cards, the kicks above, light comedowns | 50.6% |
| the bar, each drink once a game, light comedowns | 54.2% |
| the bar, one a turn, light comedowns, the bot free to repeat | 50.0%: it chained energy drinks and never bought; starter games ran 12 rounds |
| the bar, one a turn, light comedowns, never the same twice running | 60.8% |
| the bar, one a turn, the comedowns above, never the same twice running | 52.6% |

As built, 8,000 games: starters 7.2 rounds (7.7 with no bar), Devotion 48.9%, openers 43% (Byzantine General) to 57% (Brent
Crude), The Octobot 52%; General Shuffle, the drinker wins 54.0% against a player who never drinks, at six drinks a game.

## Two keywords renamed (2026-11-26)

**Epiphany** is the apparition keyword (Radi8 before): the same badge, the same gift, one more action and a Miracle.
**Synergy** is what a companion card or a set is called on the cards and at the table (the engine still says `companion` and
`set`). The printed faces carry the old badge until they are rendered again.

## The Synergy line on the card, and The Usual (2026-11-26)

A card with a Synergy and no keyword of its own prints it in the badge slot at the head of the text box (RcanaCard3.jsx): a
Trader's card says what the pairing does (`short` on the companion entry, 30 letters at most), the partner card names its
Trader, a set Asset its set. Apparitions keep Epiphany there and show their Synergy by the medallion alone.

A Trader's own drink is **The Usual**. Connor's is the Energy Drink now (it was Whiskey, which three Traders shared).

## The track: Racehorse and Prediction Market (2026-11-26)

Two racetrack cards, so they have Synergy: while its holder has Prediction Market open, their Racehorse wins on one more face
(6, 7 or 8; with The Gambler seated as well, 4 or higher). `venue` on the Asset, `synergy` on the Location, `atVenue()`. The
first Synergy between an Asset and a Location.

## Four drinks, and a shorter menu (2026-11-26)

Sugar Rush left the bar: it was the Energy Drink over again, and the menu was too much to read at the table. Its two Traders
have a new usual: Saint GR80 the Espresso, Virgil the Whiskey. The menu prints each drink on one short line (`menu` in DRINKS:
the kick, then what comes after), under a one-line rule.

## Three drinks (2026-11-26)

Coffee, an Energy Drink, or a Stiff Drink. Coffee is the Espresso renamed (the key is still `espresso`). The Stiff Drink is
Champagne and Whiskey in one glass: this turn your gambles win on two more faces, and no Calamity can be played on you until
your next turn; next turn the Trader's ability is off. Champagne's own comedown ($50M off the next sale) went with it.
The usual: Coffee for Garth Raider, Marisol, Saint GR80 · Energy Drink for The Influencer, Connor, Eugene · Stiff Drink for
The Gambler, Brent Crude, Byzantine General, Virgil.

## Synergy marks: portraits and four glyphs (2026-11-26)

Fifteen Synergies on 31 of the 88 cards: eleven Trader pairs, three sets, the track. At the table the words covered the card's
name and "synergy" told a new player nothing, so a card's Synergies are small round marks on its left edge: the Trader's
portrait on that Trader's own card, and a glyph for the rest (`SYNERGY_GLYPHS` in designs.js: an ingot for Metals, a picture
frame for Collector, a stack of coins for Income, a horseshoe for the track). Dim while the partner is missing, lit once it is
working; the words are in the tooltip and under the card when it is opened. The printed card uses the same glyphs in its left
medallion (it was one diamond for every set). A set pays on the NEXT sale while two are held, and the card and the rules now
say so ("hold two, next sale +$50M").

## The bar is a vending machine (2026-11-26)

The same rule (one drink a turn or none, never the same one twice running), behind a machine instead of a list: a button on the
table opens a modal drawn in code (`openVending()` in pt3-table.src.html), three cans behind the glass and a button for each;
press one and its can drops in about half a second. The drink you had last turn is SOLD OUT; your Trader's usual is ringed in
teal. For The Octobot it is a charging station. Art, when it exists, goes in `public/TCG/rcana/vending/`: `machine.webp` (the
cabinet, behind everything), `coffee.webp`, `energy.webp`, `alcohol.webp` (the cans, about 1:2, upright). Each drawn part stays
until its file is there. The idea came from a CodePen of a soft-drink machine; none of its code, pictures or brands is used.

## The vending machine, redrawn around the art (2026-11-26)

The modal no longer draws its own sign, glass, button panel or tray: `public/TCG/rcana/vending/machine.webp` (1448x1086) is the
machine, and the drinks standing on its two shelves are the buttons. Top shelf: `coffee.webp`, `energy.webp`. Bottom shelf:
`beer.webp`, `cocktail.webp`, `wine.webp`, all three the one alcohol drink (Stiff Drink), so the rules stay at three options.
Tap a drink to read its one line under the machine; tap it again and it falls to the tray and is yours. A drink you had last
turn is greyed out; your Trader's usual has a teal light under it. Positions are in `VEND_SHELF` in `pt3-table.src.html`
(`[drink, art file, centre x %, bottom %, width %]`). No rule or engine change. Edited in the source and in both built pages by
hand (the device shell was down); the next `npm run pt3:build` should reproduce them.
