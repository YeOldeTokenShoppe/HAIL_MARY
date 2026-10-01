# RL80 R-cana — Version 2: The Duel

Complete rules for two players. This document stands on its own; it does not depend on Version 1.

## What you need

- For each of the two Traders: a 56-card Minor deck of their own, and a Querent card.
- One shared set of the 22 Major R-cana.
- Profit counters, Drawdown counters.

## Building your deck

Every Minor slot (Ace through 10 and Page, Knight, Queen, King of each of the four suits) has an upright face and a reversed face. Your deck holds exactly one card per slot, and for each slot you choose upright or reversed. Every deck therefore has the same shape; what differs is which way each card faces.

## The goal

Be the first Trader to hold 80 Profit in your **Bank**. Banked Profit can never be taken from you. Profit in your **Portfolio** is exposed until you bank it.

## The suits

Every pip has a rank R from 1 (Ace) to 10. Its cost is half its rank, rounded up; upright Cups, reversed Candles and reversed Chains cost one less.

| Suit | Upright | Reversed |
|---|---|---|
| Coins | Gain R Profit into your Portfolio. | Bank half of R (rounded up) directly. |
| Candles | Put an idle Personality to Work. It yields +R this turn. | Put an idle Personality to Work. It yields +half of R and cannot be targeted until your next turn. |
| Chains | Deal R Drawdown to a Working opposing Personality, Front-run R from an opposing Portfolio, or intercept an opposing Hail Mary Pass. Or hold it as a Hedge that absorbs R. | Collateral: play on one of your own Personalities that has none. It takes R less Drawdown from every Chain and Event, and yields +half of R (rounded up) for as long as it stays on your Floor. Or Hedge: when a Chain targets you, play it for free to absorb R+2 and draw a card. |
| Cups | Another Trader gains half of R. You gain R and draw a card. | Front-run half of R from another Trader. You gain the same. |

Courts are Personalities with a cost, Yield, Resilience, and one ability each. Each court has a reversed version with a different ability; both are listed in the card file.

## Your table

- **Hand.** Hidden.
- **Reserve.** Cards placed face-down as Liquidity. Each is 1 Liquidity: lock it to pay, it unlocks at your next Refresh.
- **Floor.** Your hired Personalities.
- **Portfolio.** Profit earned and not yet banked.
- **Bank.** On your Querent. Untouchable.
- Shared: the **Major deck**, the face-down **Omen** on top of it, the standing **Market**, and the **Providence** row.

## Setup

1. Each Trader shuffles their own deck. The first Trader draws eight; everyone else draws seven.
2. Shuffle the 22 Majors. Place the top one face-down in the Omen slot.
3. Choose a first Trader. Turn order is fixed for the whole game, so each Trader's exposure window is the same: the opponent's turn plus one reveal.

## The round

A round is one turn for each Trader, in seat order. At the start of each round, before the first Trader's turn, the Omen is turned face up and resolves for the table. A **Market** replaces the standing Market. An **Event** happens once. An **Invoke** goes to Providence, where any Trader may pay its cost on their turn to use it once. Then the next Major is placed face-down in the Omen slot. The Majors table is the same as in Version 1 and is reproduced at the end of this document.

## The turn

1. **Refresh.** Your Working Personalities go idle. Your locked Reserve cards unlock. Your shields expire.
2. **Set.** In order: if you have a Hail Mary Pass in the air, it comes down. Take your Dividend (1 Profit into your Portfolio, or as the Market says). Take Interest (1 Profit for every full 5 already in your Portfolio). Then either bank any amount from Portfolio to Bank, or throw a Hail Mary Pass.
3. **Draw** one Minor from your own deck.
4. **Main phase**, any number of actions, any order: Reserve one card from hand, once per turn. Hire a court. Play a pip. Work an idle Personality that has been on your Floor since the start of your turn. Foretell, once per turn, if you have Virgil: look at the Omen and optionally put it on the bottom of the Major deck. Invoke a Major in Providence.
5. **End.** The next Trader's turn begins.

## Working and exposure

Only Working Personalities can be targeted by Chains. A Personality shielded by a reversed Candle cannot be targeted until its owner's next turn. A Personality whose Drawdown reaches its Resilience is Liquidated: discard it and draw a Minor. Some courts have an Exit Scam: when they leave your Floor you lose that much Profit from your Portfolio.

## Hedging

When an opponent's Chain or reversed Cup targets one of your Working Personalities, your Portfolio, or your Hail Mary Pass, you may play a Chain from your hand as a Hedge before it lands. An upright Chain costs its Liquidity and absorbs its rank. A reversed Chain is free, absorbs its rank plus two, and draws you a card. Whatever is left gets through.

## The Hail Mary Pass

Once per game, at your Set, instead of banking you may throw your whole Portfolio (at least 10) into the air. The stake leaves your Portfolio and sits in the air until your next Set.

- Profit you earn after the throw goes into your Portfolio as normal. It is not part of the stake.
- An opponent may aim a Chain at the pass. You may Hedge it. Whatever gets through intercepts the pass: the interceptor takes that much of the stake into their Portfolio and the rest is lost.
- An Event that takes Profit from Portfolios (THE REGULATOR, THE CRASH, THE AUDIT) also knocks the pass down: the stake is lost.
- Chains and reversed Cups aimed at your Portfolio do not touch the stake. VOLATILITY swaps Portfolios, not stakes. Banking by any effect does not touch the stake.
- If the pass is still in the air at your next Set, the stake banks doubled, subject to THE BAG HOLDER's cap.
- If the game ends while a pass is in the air, the stake returns to the Portfolio undoubled.

THE HAIL MARY (The Fool) lets an Underdog throw a second pass.

## Ending the game

When any Trader's Bank reaches 80, at any point, the current round is played out so that every Trader has had the same number of turns. Then the largest Bank wins; ties go to the larger Portfolio. The same happens at the end of the round in which THE RECKONING tolls (unless it is buried: if more than ten Majors remain, it goes into the bottom half of the Major deck instead), or when the last Major has been revealed.

## The Majors

| Major | Kind | Effect |
|---|---|---|
| THE HAIL MARY (The Fool) | Invoke 3 | Underdog only: throw a Hail Mary Pass now, even if you have already thrown one this game. |
| THE FOUNDER (The Magician) | Invoke 2 | Draw two Minors. |
| THE ORACLE (The High Priestess) | Event | Reveal the top three Majors. The Underdog puts them back in any order. |
| THE BOOM (The Empress) | Market | Candles give double. |
| THE FED (The Emperor) | Market | Interest is doubled. |
| THE REGULATOR (The Hierophant) | Event | Every Portfolio loses 3. Every Chains Personality takes 2 Drawdown. |
| THE MERGER (The Lovers) | Invoke 2 | An idle Personality Works with +3 Yield. |
| BULL RUN (The Chariot) | Market | Every Yield is +1. |
| CONVICTION (Strength) | Market | Portfolios cannot be targeted by Chains. |
| THE VAULT (The Hermit) | Invoke 1 | Bank up to 5 from your Portfolio. |
| VOLATILITY (Wheel of Fortune) | Event | Every Trader passes their Portfolio to the Trader on their left. |
| THE AUDIT (Justice) | Event | Each Trader with the most Chains Personalities loses half their Portfolio. |
| THE BAG HOLDER (The Hanged Man) | Market | No Trader may bank more than 5 per turn, by any means. Excess stays in the Portfolio. |
| THE LIQUIDATION (Death) | Event | Every Working Personality takes 3 Drawdown. |
| DOLLAR-COST AVERAGE (Temperance) | Market | Dividend is 3. Yields above 3 become 3. |
| LEVERAGE (The Devil) | Market | Every Yield is doubled. Every Chain is doubled. |
| THE CRASH (The Tower) | Event | Every Portfolio is emptied. |
| THE WINDFALL (The Star) | Event | Every Trader draws two Minors and gains 3 Profit. |
| THE PANIC (The Moon) | Market | Chains cost 0. |
| GOLDEN AGE (The Sun) | Market | Cups cost 0 and give double. |
| THE RECKONING (Judgement) | Event | The game ends after this round, or is buried if more than ten Majors remain. |
| OUR LADY OF PERPETUAL PROFIT (The World) | Event | The Trader who has played the most upright Cups banks their entire Portfolio. |
