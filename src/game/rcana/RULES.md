# RL80 R-cana — Rules Drafts

The design went through several drafts in conversation before the simulator existed. They are kept here
in order so the reasoning behind the current rules is not lost. The complete, standalone rulebooks for the current games are `RULES-v1.md` (the shared reading) and
`RULES-v2.md` (the duel). This document is the design history; where it disagrees with those two, they win.

| Draft | What it was | Status |
|---|---|---|
| v1 | The original eight-type concept: Personality, Commodity, Opportunity, Calamity, Market, Externality, Community, Grace. Trader archetypes, Faith, Profit coins to 80. | Superseded |
| v2 | Rewrite after reading Lorcana: Reserve as inkwell, exert to Work, Portfolio vs Bank, Faith as a currency, six Temperaments. | Superseded |
| v3 | v2 with Faith removed. Hope replaces the Faith Temperament. | Superseded |
| v4 | After reading Cyberpunk TCG: Final Bell clock, Bank thresholds, Hedge, Front-run, Dividend, formal triggers, 40–50 card decks. Vocabulary: hire, Work, Lock, Refresh. | Superseded, reproduced in full below |
| v5 | Villains, 17 Opportunities / 17 Calamities, Trader cards removed. 152 cards. Built in `cards.js` / `engine.js`. | Implemented, kept as the deck-building game in a drawer |
| Tarot | 80 cards: 22 Majors, 56 Minors in four suits, 2 Querents. One shared deck. Built in `tarot.js` / `tarot-engine.js`. | **Current, version 1** |
| Tarot v2 | Private 56-card decks with reversals, shared Majors. Built in `v2.js` / `v2-engine.js`. | **Current, version 2** |

---

# Draft v4

## The Idea

You are a Trader. The R-cana is the market, and it does not care about you. Each round it reveals something new: a boom, a bust, a regulator, a miracle. You will hire people, open positions, seize opportunities, and occasionally help your rival because it pays. The first Trader to bank 80 Profit wins. If nobody gets there before the R-cana runs out of things to say, the richest Bank wins at the Final Bell.

## The Eight R-cana

Every card belongs to one of the eight R-cana. Four of them are card types. The other four are suits of Action.

| # | R-cana | What it is | Job in the game |
|---|---|---|---|
| 1 | Personality | Card type | People you hire. They Work to produce Profit. |
| 2 | Commodity | Card type (Positions) and tokens | Positions you open. They produce Commodity tokens or grant abilities. |
| 3 | Opportunity | Action suit | One-shot gains. Many can be Seized for free by the right Personality. |
| 4 | Calamity | Action suit | One-shot attacks on an opponent's exposed things. |
| 5 | Market | Shared deck | The standing condition everyone plays under. |
| 6 | Externality | Shared deck | A one-shot shock that hits every Trader. |
| 7 | Community | Action suit | Effects that touch every Trader at once. |
| 8 | Grace | Action suit | You must give another Trader something. You get something else. |

The Trader is not a card in your deck. The Trader is you.

## Components

- Trader cards. One per player, chosen when you build your deck.
- Personal decks. Forty to fifty cards each. Personalities, Positions, and Actions.
- The R-cana deck. One shared deck of Markets, Externalities, and a few Major R-cana. It is also the game clock.
- Profit coins in 1, 5, 10, and 20. The Bank holds them.
- Commodity tokens in three kinds: Attention, Data, Credibility.
- Drawdown counters for damage.

## Card Anatomy

Every card shows a Liquidity cost in the top corner, a Temperament color band, a name, a classification line, and rules text. Most cards also show a Reserve icon around the cost, which means the card may be placed face-down as Liquidity. Cards without the icon are too precious to spend.

Personalities carry three numbers and no more:

- Yield. Profit gained when this Personality Works.
- Resilience. Drawdown this Personality can take before being Liquidated.
- Cost. Liquidity to hire.

Positions carry Cost and Resilience. Actions carry Cost and a suit. Markets, Externalities, and Majors have no cost because nobody plays them. The R-cana plays them.

Reading rules text. Three kinds of highlighted words appear on cards:

- Triggers say when something happens. The base set uses five: *When hired*, *When Working*, *When Liquidated*, *On Reveal*, and *Bank N*. On Reveal fires whenever the R-cana reveals a card, and a card may narrow it. Bank N is true while your Bank holds at least N Profit.
- Keywords are standard effects explained in the Keywords section.
- Underdog is a condition. It is true while your Bank is smaller than any opponent's.

If a card contradicts these rules, the card wins.

## Working and Locked

Personalities and Reserve cards stand upright when available. Turn a Personality sideways to put it to Work, and it stays Working until your next Refresh. Turn a Reserve card sideways to Lock it and pay 1 Liquidity, and it stays locked until your next Refresh. Only Working Personalities can be targeted by Calamities. Idle Personalities are safe and earn nothing.

## Temperaments

There are six Temperaments. A deck may contain cards of at most two, and your Trader card names which two.

- Hope. Grace, protection, recovery, Majors.
- Greed. High Yield, big Opportunities, Front-running, Portfolio growth.
- Fear. Calamities, Hedges, profiting from Bear markets.
- Hype. Attention, Influencers, Meme Season, fast and fragile.
- Reason. Data, Analysts, Consulting, Seizing undervalued things.
- Patience. Positions, Interest, Dividends, slow and durable.

## Traders

Your Trader is chosen when you build your deck. It is not part of your forty and is never shuffled in. It names your two Temperaments, has one persistent ability, and sits face-up in front of you all game.

You may Lock your Trader for 1 Liquidity, like a Reserve card. While locked, its ability is off. It unlocks at your Refresh.

The base set ships six:

- THE ANALYST. Reason and Patience. Once per turn, Consult for free.
- THE DEGEN. Hype and Greed. Once per turn, a Personality you hire has Fast. Calamities deal 1 extra Drawdown to your Working Personalities.
- THE HODLER. Hope and Patience. Interest counts every full 5 in your Portfolio instead of 10.
- THE CONTRARIAN. Fear and Reason. While the Market is a Bear Market, or no Market is in effect, your Yields are +1.
- THE GAMBLER. Greed and Fear. Once per turn when a Personality Works, you may flip a coin. Heads, it yields +3. Tails, it takes 1 Drawdown.
- THE VALUE INVESTOR. Patience and Greed. Bank 20: your Opportunities produce +1 Profit. Bank 40: +2 instead.

## Your Table

Each Trader has five zones.

- Hand. Hidden.
- Reserve. Face-down cards. Each one is 1 Liquidity.
- Floor. Your hired Personalities and open Positions.
- Portfolio. Profit you have earned but not yet banked. It is exposed.
- Bank. Profit you have realized. Nothing in the game can take it from you. Ever.

The table shares the R-cana deck, the current Market, the Omen slot, and the Providence row.

## Setup

1. Each Trader reveals their chosen Trader card and places it face-up in front of them.
2. Build the R-cana deck: 8 Markets, 3 Externalities, and 2 Majors drawn at random from the 8. Shuffle. Reveal cards until a Market appears and set it as the current Market. Put any others on the bottom. Place the next card face-down in the Omen slot.
3. Shuffle your deck and draw eight.
4. Once, you may put any number of cards from your hand on the bottom of your deck and draw back to eight. Then reshuffle.
5. Decide the first Trader by any fair method. The first Trader skips their first Draw.

Quick Play variant. Shuffle the Trader cards and deal one to each player face-down. Reveal them together. Each player takes the pre-built deck that matches their Trader.

## Your Turn

1. Reveal. First Trader only. Flip the Omen into play. If it is a Market, it replaces the current Market. If it is an Externality, resolve it for every Trader, then discard it. If it is a Major R-cana, resolve it and place it in the Providence row, replacing any Major already there. Then move the top card of the R-cana deck face-down into the Omen slot. If there is no card left to move, this round is the Final Bell.
2. Refresh. All your Working Personalities go idle. All your locked Reserve cards unlock. Your Trader unlocks.
3. Set. In this order: your Positions produce whatever they produce at the start of your turn. Dividend: gain 1 Profit into your Portfolio. Interest: gain 1 Profit into your Portfolio for every full 10 already there. Bank: move any amount of Profit from your Portfolio to your Bank. If your Bank reaches 80, you win immediately. Any other start-of-turn effects.
4. Draw. Draw one card. If your deck is empty, you are Insolvent and lose the game.
5. Main. Do any of the following, as many times as you can afford, in any order: Reserve (once per turn, show a card with the Reserve icon and put it face-down into your Reserve). Hire a Personality, open a Position, or play an Action by locking Reserve cards equal to its cost. Work: put an idle Personality that has been on your Floor since the start of your turn to Work and take Profit equal to its Yield into your Portfolio. Seize: put an idle Personality with the named classification to Work to play an Opportunity with the Seize keyword for free. Use an ability. Consult: lock 1 Reserve card, look at the Omen, and you may put it on the bottom of the R-cana deck and replace it with the top card, face-down. There is no action limit.
6. End. End-of-turn effects resolve. Play passes left.

## Reacting on Someone Else's Turn

Nothing happens on an opponent's turn except this: when a Calamity or Externality targets you or your cards, you may play any card with the Hedge keyword from your hand, paying its cost by locking Reserve cards. Liquidity you did not spend on your own turn is your insurance budget.

## The Core Tension

Working exposes you twice. The Personality that Works is sideways, and only Working Personalities can be targeted by Calamities. The Profit it earns sits in your Portfolio through every opponent's turn and through the next Reveal, and only at your next Set can you bank it. Leaving Profit in your Portfolio earns Interest and powers Greed and Patience cards. Banking it makes it untouchable and climbs the Bank thresholds that unlock your best cards. That choice is the game.

## Calamity, Drawdown, and Liquidation

A Calamity names a target. Legal targets are an opponent's Working Personality, any Position, or a Portfolio. It never targets a Bank. Calamities deal Drawdown. A Personality or Position with Drawdown equal to or greater than its Resilience is Liquidated and goes to its owner's discard. Drawdown stays until something removes it. When a Personality of yours is Liquidated, draw a card. A Calamity aimed at a Portfolio either destroys coins or Front-runs them into the attacker's Portfolio, where they are still exposed.

## Grace

A Grace card has two halves. The first half gives another Trader a real benefit. The second half gives you a different benefit, and it should be the better half. If no other Trader can receive the benefit, you cannot play the card. Grace cards you have played stay visible in your discard pile. Some Majors count them.

## Community

A Community card affects every Trader, including you. Many Community cards are Underdog cards.

## The R-cana Deck and the Final Bell

Markets are standing conditions. Externalities resolve once and hit everyone. Major R-cana are rare: when one is revealed it resolves as printed and sits in the Providence row until the next Major replaces it; many carry an Invoke ability any Trader may pay Liquidity to use. The Omen is always the next card. When the Omen slot cannot be refilled, the round is the Final Bell. At the end of the round, if nobody has reached 80, the Trader with the largest Bank wins. Ties go to the larger Portfolio.

## Major R-cana

THE BUBBLE. Every Yield is doubled. Interest is doubled. Put THE CRASH into the Omen slot if it is not already in Providence.
THE CRASH. Every Portfolio is emptied. Every Working Personality takes 2 Drawdown. Invoke 2: remove 2 Drawdown from one of your cards.
THE FED. The current Market is discarded and no Market is in effect until the next one. Invoke 2: reveal the Omen to all.
THE WHALE. The Trader with the most Profit in Portfolio banks half of it, rounded down, and loses the rest.
THE ORACLE. Reveal the top three cards of the R-cana deck. The Underdog puts them back in any order.
THE UNICORN. Each Trader may hire a Personality from their hand for free. It cannot Work this round.
THE HAIL MARY. Invoke 3, Underdog only: flip a coin. Heads, double your Portfolio. Tails, empty it. Once per game per Trader.
OUR LADY OF PERPETUAL PROFIT. The Trader with the most Grace cards in their discard banks their entire Portfolio immediately and all their Personalities go idle. Ties bless everyone.

## Keywords

- Seize [classification]. Put an idle Personality of yours with this classification to Work to play this card free.
- Ascend N. Hire this Personality on top of one you have in play with the same name by paying N instead of its cost. It keeps the old card's Drawdown and whether it is Working.
- Fast. This Personality can Work or Seize the turn it is hired.
- Hedged. Calamities deal 1 less Drawdown to this card.
- Hedge. You may play this card from your hand when a Calamity or Externality targets you or your cards.
- Front-run N. Move N Profit from the target Portfolio into your Portfolio.
- Invoke N. Any Trader may lock N Reserve cards on their turn to use this ability.

## Ending the Game, Multiplayer, Deckbuilding

The first Trader whose Bank reaches 80 wins. If the Final Bell round ends with no winner, the largest Bank wins, then the largest Portfolio. A Trader who must draw from an empty deck is Insolvent and loses. Play passes to the left; only the first Trader Reveals. Decks are forty to fifty cards, no more than three copies of one card, one or two Temperaments, one chosen Trader.

## What changed from v3 (and v3 from v2)

- v3 removed Faith entirely as a currency, a token, a Temperament, and the opening line "You begin with nothing but eight cards and a little faith." Liquidity became the only currency. Hope replaced the sixth Temperament.
- v4 renamed exert to Work and Lock, Ready to Refresh, and playing to hire / open / play. Traders became chosen in deckbuilding. Added the Final Bell, Bank N, Underdog, Hedge, Front-run, Dividend, formal triggers, 40–50 card decks, and the Trader lock.

---

# Draft v5 additions

- Villain is a classification. Villains have Work abilities that replace Yield (steal, sabotage, cheat), low Resilience, and Exit Scam N: when the card leaves your Floor for any reason, lose N Profit from your Portfolio. Villain Work abilities obey Calamity targeting.
- Credibility is the price of honesty. Grace, Community, and some Positions produce it; strong Opportunities and Hope cards spend it. When you hire a Villain, lose all your Credibility. Some Externalities and Community cards punish Villains.
- Four Opportunities (Pump, Launch Day, Perfect Information, Compounding) became four cheap Calamities (Insider Dump, Ratio'd, Short Report, Margin Call). 17 of each.
- Trader cards removed. A deck is two Temperaments. The engine names the player's archetype after the game from how they played.
- The set is 152 cards. The full list is `cards.js`.

Simulation findings on v5: median 10 rounds, Final Bell 2–4%, Hedge almost never fires because bots spend all Liquidity, Greed pairs win 55–69% of matchups. Kept as the deck-building game in a drawer.

---

# The Tarot Configuration (current)

## What 80 means

Eighty cards is a deck in the sense that a tarot deck is a deck: everyone plays with the same 80. Collecting is by edition, the way tarot decks are sold. One shared draw pile on the table: both players consult the same oracle.

## The 58 Minor R-cana

Four suits of fourteen (Ace–10 pips plus Page, Knight, Queen, King), plus two Querents. The Querent is you: it sits in front of you, your Bank goes on it, and it never shuffles.

The suits are the Four C's ("foresees"). Each is a market object and a sacred object: Coins (the asset and the collection plate), Candles (the chart and the votive), Chains (the rails and Saint Peter's), Cups (the cup-and-handle pattern and the chalice).

| Suit | Job | Pip template, rank R, cost ⌈R/2⌉ |
|---|---|---|
| Coins | Profit | Gain R Profit into your Portfolio. |
| Candles | Momentum | Put an idle Personality to Work. It yields +R this turn. |
| Chains | Calamity or Hedge | Deal R Drawdown to a Working opposing Personality, or Front-run R. Or hold it: when a Chain targets you, play this to reduce it by R. |
| Cups | Grace | Give another Trader ⌈R/2⌉ Profit. Gain R Profit. Costs one less. |

There are no tokens. Liquidity, Profit, and Drawdown are the only currencies.

The courts are the sixteen Personalities. Page is cheap and small, Knight is Fast, Queen is an engine, King is the closer. The current sixteen, with abilities, are in `tarot.js`:
Coins: Ethan, Junior Analyst · The Day Trader · Marisol, Investigator · Old Money.
Candles: The Apprentice · Unihood, Meme Prophet · Eugene, Pattern Prophet · The Promoter.
Chains: The Short Seller · The Raider · Cassandra · Connor, Demon.
Cups: Sister Ledger · The Almoner · Virgil, Oracle · GR80, Monk.

## The 22 Major R-cana

Shuffled into the deck. When drawn, a Major does not go to your hand: it resolves for the whole table. A third are standing Markets, a third instant Events, a third Invoke powers that sit in Providence until a Trader pays for them.

| # | Tarot | R-cana | Kind | Effect |
|---|---|---|---|---|
| 0 | The Fool | THE HAIL MARY | Invoke 3 | Underdog only: throw a Hail Mary Pass now, even if you have already thrown one. |
| I | The Magician | THE FOUNDER | Invoke 2 | Draw two Minors. |
| II | The High Priestess | THE ORACLE | Event | Reveal the top three. The Underdog reorders them. |
| III | The Empress | THE BOOM | Market | Candles give double. |
| IV | The Emperor | THE FED | Market | Interest is doubled. |
| V | The Hierophant | THE REGULATOR | Event | Every Portfolio loses 3. Every Chains Personality takes 2 Drawdown. |
| VI | The Lovers | THE MERGER | Invoke 2 | An idle Personality Works with +3 Yield. |
| VII | The Chariot | BULL RUN | Market | Every Yield is +1. |
| VIII | Strength | CONVICTION | Market | Portfolios cannot be targeted. |
| IX | The Hermit | THE VAULT | Invoke 1 | Bank up to 5 from your Portfolio. |
| X | Wheel of Fortune | VOLATILITY | Event | Every Trader passes their Portfolio to the left. |
| XI | Justice | THE AUDIT | Event | Each Trader with the most Chains Personalities loses half their Portfolio. |
| XII | The Hanged Man | THE BAG HOLDER | Market | No Trader may bank more than 5 per turn. |
| XIII | Death | THE LIQUIDATION | Event | Every Working Personality takes 3 Drawdown. |
| XIV | Temperance | DOLLAR-COST AVERAGE | Market | Dividend is 3. Yields above 3 become 3. |
| XV | The Devil | LEVERAGE | Market | Every Yield is doubled. Every Chain is doubled. |
| XVI | The Tower | THE CRASH | Event | Every Portfolio is emptied. |
| XVII | The Star | THE WINDFALL | Event | Every Trader draws two Minors and gains 3 Profit. |
| XVIII | The Moon | THE PANIC | Market | Chains cost 0. |
| XIX | The Sun | GOLDEN AGE | Market | Cups cost 0 and give double. |
| XX | Judgement | THE RECKONING | Event | The Final Bell: the game ends after this round. If more than half the deck remains, it is buried in the bottom half instead. |
| XXI | The World | OUR LADY OF PERPETUAL PROFIT | Event | The Trader who has played the most Cups banks their entire Portfolio. |

## Version 1: the shared reading (two players)

Setup: each Trader draws eight Minors. The rest of the Minors and all 22 Majors are shuffled together. The first player skips the first draw.

Each turn: Refresh (Working Personalities stand up, Reserve unlocks). Set (Dividend 1; Interest 1 per full 5 in Portfolio; resolve or throw a Hail Mary Pass; bank any amount). Draw one Minor, resolving every Major drawn along the way. Main: Reserve one card as Liquidity, hire courts, play pips, Work idle Personalities, Foretell with Virgil, Invoke a Major in Providence. Only Working Personalities can be hit by Chains. Banked Profit is untouchable.

The game ends at 80 banked, at THE RECKONING, or when the deck runs out (Final Bell: largest Bank wins).

One deck is a two-player game: three players run out of Minors more than half the time and four almost always. Four players need a second deck shuffled in.

Tuned by simulation: strong play beats naive play 75% of the time; median 9 rounds; first player 50%; Interest at 1 per 5 makes holding Profit a near coin flip against banking everything.

## Version 2: the duel with reversals (two to four players)

Each Trader brings a private 56-card deck: one card per slot, each chosen upright or reversed. The 22 Majors are a shared deck with a face-down Omen revealed at the start of every round. The lead seat rotates each round.

| Suit | Upright | Reversed |
|---|---|---|
| Coins | Gain R into your Portfolio. | Bank half of R directly. |
| Candles | A Personality yields +R this turn. | A Personality Works with +half of R and cannot be targeted until your next turn. |
| Chains | Attack or hedge for R. | Hedge only, free to use, absorbs R+2, draws a card. |
| Cups | Give half of R, gain R, draw a card. | Front-run half of R from another Trader, gain the same. |

Courts have reversed versions too (the same character on a different day). Every deck has the same skeleton, so balance is structural; there are 2^56 possible decks. Reversed courts and pips are in `v2.js`.

When any Bank reaches 80 at a Set, the round is played out so everyone has had the same number of turns, then the largest Bank wins.

Tuned by simulation: reversed Chains lifted hedging from near zero to a third of a game and need the card draw to be an even trade; a deck that never gives (reversed Cups) had a structural edge until upright Cups drew a card; seat order is fair at two, three and four players with the rotating lead and the played-out final round.

## The Hail Mary Pass

Once per game, at your Set, instead of banking you may throw your whole Portfolio (at least 10) into the air. It stays in the air through your turn and every opponent's turn. If anything takes Profit from your Portfolio before your next Set, the pass is incomplete and you lose all of it; if the taker was an opponent, they intercepted it. If it comes down untouched, what you threw banks doubled. Profit earned after the throw sits in the Portfolio as normal. THE HAIL MARY (The Fool) lets an Underdog throw a second one.

Tuned by simulation: at double, a thrower has a 52–54% edge over a non-thrower; at 1.5 times nobody throws. About 70% of passes complete, 5% are intercepted, the rest fall to Events.

## Turn by turn, version 2

See the README's walkthrough; it is the same text.
