# RL80 R-cana — Version 1: The Shared Reading

Complete rules for two players. This document stands on its own.

## What you need

- One R-cana deck of 78 cards: 22 Major R-cana and 56 Minor R-cana. The Minors are four suits of fourteen: Ace through 10 (pips) and Page, Knight, Queen, King (courts).
- Two Querent cards, one per Trader. Your Querent sits in front of you and holds your Bank.
- Profit counters, Drawdown counters.

## The goal

Be the first Trader to hold 80 Profit in your **Bank**. Banked Profit can never be taken from you. Profit in your **Portfolio** is yours but exposed until you bank it.

## The suits

Every pip has a rank R from 1 (Ace) to 10. Its cost is half its rank, rounded up. Cups cost one less.

| Suit | Pip effect |
|---|---|
| Coins | Gain R Profit into your Portfolio. |
| Candles | Put an idle Personality to Work. It yields +R this turn. |
| Chains | Choose one: deal R Drawdown to a Working opposing Personality; Front-run R from an opposing Portfolio; or intercept an opposing Hail Mary Pass. Or hold it: when a Chain targets you, play it as a Hedge to absorb R. |
| Cups | Another Trader gains half of R (rounded up). You gain R. |

Courts are Personalities. Each has a cost, a Yield, a Resilience, and one ability printed on the card. The sixteen courts are listed in the card file.

## Your table

- **Hand.** Hidden.
- **Reserve.** Cards placed face-down as Liquidity. Each is 1 Liquidity: lock it to pay, it unlocks at your next Refresh.
- **Floor.** Your hired Personalities.
- **Portfolio.** Profit earned and not yet banked.
- **Bank.** On your Querent. Untouchable.
- Shared: the **R-cana deck**, the standing **Market**, and the **Providence** row of Majors that can be Invoked.

## Setup

1. Separate the Majors. Shuffle the Minors and deal seven to each Trader.
2. Shuffle the Majors into the remaining Minors. This is the R-cana deck.
3. Choose a first Trader. The first Trader skips the Draw step on the first turn only.

## The turn

1. **Refresh.** Your Working Personalities go idle. Your locked Reserve cards unlock.
2. **Set.** In order: if you have a Hail Mary Pass in the air, it comes down (see below). Take your Dividend: 1 Profit into your Portfolio, or as the Market says. Take Interest: 1 Profit for every full 5 already in your Portfolio. Then either bank any amount from Portfolio to Bank, or throw a Hail Mary Pass.
3. **Draw** until you have drawn one Minor. Every Major drawn on the way is revealed and resolves for the table at once.
4. **Main phase**, any number of actions, any order:
   - **Reserve** one card from hand face-down, once per turn.
   - **Hire** a court by locking Reserve cards equal to its cost. It cannot Work this turn unless it is Fast.
   - **Play a pip** by paying its cost.
   - **Work** an idle Personality that has been on your Floor since the start of your turn. Gain its Yield into your Portfolio. It is Working until your next Refresh.
   - **Foretell**, once per turn, if you have Virgil: look at the top card of the R-cana deck and optionally put it on the bottom.
   - **Invoke** a Major in Providence by paying its printed cost. It is discarded afterwards.
5. **End.** The other Trader's turn begins.

## Working and exposure

Only Working Personalities can be targeted by Chains. A Personality whose Drawdown reaches its Resilience is Liquidated: discard it and draw a Minor. Some courts have an Exit Scam: when they leave your Floor you lose that much Profit from your Portfolio.

## Hedging

When an opponent's Chain targets one of your Working Personalities, your Portfolio, or your Hail Mary Pass, you may play a Chain from your hand as a Hedge before it lands, paying its cost. It absorbs its rank. Whatever is left gets through.

## The Majors

When a Major is revealed, it resolves for the whole table. A **Market** replaces the standing Market and stays until replaced. An **Event** happens once and is discarded. An **Invoke** goes to the Providence row, where any Trader may pay its cost on their turn to use it once.

| Major | Kind | Effect |
|---|---|---|
| THE HAIL MARY (The Fool) | Invoke 3 | Underdog only: throw a Hail Mary Pass now, even if you have already thrown one this game. |
| THE FOUNDER (The Magician) | Invoke 2 | Draw two Minors. |
| THE ORACLE (The High Priestess) | Event | Reveal the top three cards. The Underdog puts them back in any order. |
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
| THE RECKONING (Judgement) | Event | The game ends after this round. If more than half the R-cana deck remains, bury it in the bottom half of the deck instead. |
| OUR LADY OF PERPETUAL PROFIT (The World) | Event | The Trader who has played the most Cups banks their entire Portfolio. |

**Underdog** means your Bank is smaller than an opponent's.

## The Hail Mary Pass

Once per game, at your Set, instead of banking you may throw your whole Portfolio (at least 10) into the air. The stake leaves your Portfolio and sits in the air until your next Set.

- Profit you earn after the throw goes into your Portfolio as normal. It is not part of the stake.
- An opponent may aim a Chain at the pass. You may Hedge it. Whatever gets through intercepts the pass: the interceptor takes that much of the stake (up to the stake) into their Portfolio and the rest is lost.
- An Event that takes Profit from Portfolios (THE REGULATOR, THE CRASH, THE AUDIT) also knocks the pass down: the stake is lost.
- Chains and reversed Cups aimed at your Portfolio do not touch the stake. VOLATILITY swaps Portfolios, not stakes. Banking by any effect does not touch the stake.
- If the pass is still in the air at your next Set, it comes down: the stake banks doubled, subject to THE BAG HOLDER's cap.
- If the game ends while a pass is in the air, the stake returns to the Portfolio undoubled.

THE HAIL MARY (The Fool) lets an Underdog throw a second pass.

## Ending the game

The moment any Trader's Bank reaches 80, at any point in any turn, that Trader wins. (The first Trader's skipped first draw is what keeps the seats even in this version; playing out the round would tip it the other way.) If THE RECKONING tolls, or the R-cana deck runs out, the game ends at the end of that round and the largest Bank wins; ties go to the larger Portfolio.

## Players

One deck is a two-player game. Three or four Traders exhaust the Minors too quickly; use Version 2, or shuffle a second deck in.
