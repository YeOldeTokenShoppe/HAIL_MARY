# RL80 R-cana — Version 1c, complete rules

The whole game in one document, for two players: the shared reading of an 88-card R-cana. Nothing here depends on the earlier rulebooks. Where the card table lets you switch a rule off, this document says so.

## What you need

- The R-cana: 22 **Major** cards, 56 **Minor** cards in four suits (Coins, Candles, Chains, Cups: Ace through 10, then Page, Knight, Queen, King), and 8 **Trader** cards. 88 cards.
- Two Querents, one per Trader. Your Querent holds your Bank and your Favor.
- Profit counters and Drawdown counters.

## The goal

Be the first Trader to hold **80 Profit in your Bank**. Banked Profit can never be taken from you. Profit in your **Portfolio** is exposed until you bank it, and it earns a bonus while it sits there.

## Your table

- **Hand**: hidden.
- **Reserve**: cards placed face down as Liquidity. Each is 1 Liquidity every turn: lock it to pay, it unlocks at the start of your next turn. A reserved card never comes back.
- **Network**: your Personalities, at most two.
- **Portfolio**: Profit earned and not yet banked.
- **Bank**: on your Querent. Untouchable.
- **Favor**: on your Querent. Our Lady of Perpetual Profit's regard.
- Shared: the **Minor deck**, the **Major deck** with the face-down **Omen** on top, the standing **Market**, and the **Providence** row.

## Setup

1. Shuffle the 8 Trader cards into the 56 Minors. Shuffle the 22 Majors separately and turn the top one face down as the Omen.
2. Each Trader draws eight.
3. Choose a first Trader. Turn order is fixed for the game. The second Trader opens with **8 Profit** in their Portfolio: going second means meeting every Omen a turn later.

## The round

A round is one turn for each Trader. **At the start of each round**, before the first Trader does anything, the Omen is turned over and resolves for both players at once:

- A **Market** replaces the standing Market and stays until the next Market.
- An **Event** happens now.
- An **Invoke** goes to Providence, where either Trader may pay its cost on their turn to use it once.

The next Major then lies face down as the new Omen. When the last Major has been revealed, the game ends after that round.

## The turn

1. **Start of your turn.** In order: your Trading Personalities go idle, your locked Reserve cards unlock, your shields expire. If you threw a Hail Mary last turn, it lands (see The Hail Mary). Your Profit arrives: the **Dividend** of 1, plus the **Dividend bonus** of 1 for every full 5 already in your Portfolio. Then **bank** any amount from Portfolio to Bank, or throw a Hail Mary instead.
2. **Draw** one card from the Minor deck. If the Minor deck is empty, shuffle the Minor discards into a new deck.
3. **Main phase**, any number of actions in any order:
   - **Reserve** one card from your hand, once per turn, face down: it is 1 Liquidity every turn from now on.
   - **Partner** with a Personality from your hand by paying its cost, up to two in your Network. It rests the turn it arrives unless it is Fast. With two already, you may still partner by letting one go: pay the new card's full cost; the departing Personality's departure effects apply.
   - **Trade** with an idle Personality that has been in your Network since the start of your turn: its earnings go to your Portfolio. A Trading Personality is the only thing Chains can hit.
   - **Copy trade**, once per turn: pay 1 Liquidity to take the full earnings of one of the opponent's Trading Personalities. The opponent gains 1 Profit for being followed.
   - **Play a pip** by paying its cost (see The suits).
   - **Play a Trader move** by paying its cost (see Trader cards).
   - **Foretell**, once per turn, for 1 Favor (free if Virgil is in your Network): look at the Omen. You may put it on the bottom of the Major deck; the next Major becomes the Omen.
   - **Invoke** a Major in Providence by paying its cost. It is spent afterwards.
4. **End.** The opponent's turn.

## The suits

Every pip has a rank R from 1 (the Ace) to 10. Its cost in Liquidity is half of R, rounded up; Cups cost one less.

| Suit | On its face | Effect |
|---|---|---|
| Coins | EARN | Gain R Profit into your Portfolio. |
| Candles | BOOST | Put an idle Personality to Trade now. It earns +R this turn. |
| Chains | ATTACK or HEDGE | Deal R Drawdown to a Trading opposing Personality, or Front-run R from the opponent's exposed Portfolio, or intercept a Hail Mary in the air. Or keep it in hand as a Hedge. |
| Cups | SHARE | The opponent gains half of R, rounded up. You gain R, draw a card, and gain 1 Favor. |

## Personalities

A court is a Personality with a cost, earnings (Yield), Resilience, and one ability. Drawdown that reaches its Resilience **Liquidates** it: discard it and draw a card. A Personality with an **Exit Scam** costs you that much Profit from your Portfolio whenever it leaves your Network, by Liquidation or by being let go.

## Hedging

When a Chain targets your Trading Personality, your Portfolio or your Hail Mary, you may play one Chain from your hand as a **Hedge** before it lands. It costs nothing and the card is spent. It absorbs its rank; whatever is left gets through. Margin Call (a Trader card) cannot be Hedged.

## Favor

Our Lady notices generosity. Each Cups you play gives you 1 Favor. Favor is spent three ways:

- **Foretell** for 1 Favor, as above.
- **Our Lady's protection**, automatic: when an Event would take 3 or more Profit from your Portfolio, or would bring down your Hail Mary, and you hold at least 2 Favor, you lose 2 Favor instead and the Event does not touch you.
- When **OUR LADY OF PERPETUAL PROFIT** turns over, the Trader with the most Favor banks their entire Portfolio.

## Trader cards

Eight one-shot moves of your own, drawn like any card and hidden in your hand. A **move** is played in your main phase for its cost. A **reaction** costs nothing and plays itself from your hand the first time its moment comes; you may hold a reaction back to save it. The Circuit Breaker is the exception: when an Event that would hurt you turns over, you are asked whether to play it, because burying the Event spares the opponent too. Trader cards may be Reserved as Liquidity like any card.

*The table lets you switch Trader cards off ("Trader cards (88)"); the deck is then the 80-card R-cana.*

## The Hail Mary

Once per game, at the start of your turn, instead of banking you may throw your whole Portfolio into the air. It stays in the air through the opponent's turn and the next Omen. At the start of your next turn it lands: untouched, it banks **doubled**. A Chain aimed at the pass that gets through intercepts it: the interceptor takes that much, the rest is lost. An Event that takes Profit from Portfolios (THE REGULATOR, THE CRASH, THE AUDIT) brings it down whether or not you had any Profit exposed. Profit you earn after the throw goes into your Portfolio as normal and is not part of the stake.

**The last play.** You may only throw when the opponent **could win at their next turn**: their Bank, plus their Portfolio with the Dividend and bonus they are about to receive, plus a pass of theirs landing, reaches 80. (The table shows this on each querent as "Next turn banks to", and warns in red.) Anything exposed may be thrown; there is no cap. A Hail Mary is never offered when banking would already win: bank and win.

**The clock stops.** While any pass is in the air, nobody can win, not even its owner. The opponent still banks on their turn and may hunt the pass with Chains. When the pass lands or falls, the clock restarts: if any Bank has reached 80, the **larger Bank wins**, ties to the larger Portfolio. If neither has, play goes on. If both Traders have passes in the air, the clock restarts only when the second one has landed or fallen.

**THE HAIL MARY (The Fool)** is the one way to throw early: Invoke 3, throw a Hail Mary now, whatever the score. It stops the clock like any other pass.

*The table lets you switch the last play off; the pass may then be thrown at any start of turn with at least 10 in your Portfolio, with the stake capped at 20. The table also lets you set the pass to ×1.5 instead of doubling.*

## Three actions (prototype option, on by default at the table)

In your main phase you take **up to three actions**, in any order: partner, Trade, Copy trade, play a pip, play a Trader move, Foretell, Invoke. **Reserving one card is free** and does not count. The table shows how many actions remain; the "3 actions" box switches the limit off.

Simulator flag: `--actions N` (0 for unlimited). Strong against strong over 2,000 games the limit changes little on the surface (8.1 rounds against 7.9, seat balance 49%), because the strong bot rarely wanted more than three paid actions; what it changes is who wins between unequal players: the strong bot's edge over the naive bot rises from 72% to 77%, since choosing which three now matters. Foretells fall by two thirds under the limit, which suggests Foretell may deserve to be free.

## Ending the game

The first Bank to reach 80 wins at once, subject to the stopped clock above. The game also ends after the round in which THE RECKONING tolls (it is buried instead if more than ten Majors remain), or when the last Major has been revealed; then the larger Bank wins, ties to the larger Portfolio.

## The cards

### The sixteen Personalities

| Card | Name | Cost | Earns | Resists | Ability |
|---|---|---|---|---|---|
| Page of Coins | Ethan, Junior Analyst | 2 | 2 | 3 | Bank 20: Yield 3. |
| Knight of Coins | The Day Trader | 3 | 3 | 2 | Fast. |
| Queen of Coins | Marisol, Investigator | 4 | 2 | 4 | When hired: draw a Minor. Your Coins give +1 Profit. |
| King of Coins | Old Money | 6 | 3 | 6 | Your Dividend bonus for exposed Profit is doubled. |
| Page of Candles | The Apprentice | 2 | 1 | 2 | Your Candles cost 1 less. |
| Knight of Candles | Unihood, Meme Prophet | 3 | 2 | 3 | Fast. During THE BOOM, Yield 5. |
| Queen of Candles | Eugene, Pattern Prophet | 4 | 2 | 4 | Whenever a Major is revealed, gain 2 Profit into your Portfolio. |
| King of Candles | The Promoter | 5 | 3 | 3 | Your Coins and Candles give +1. |
| Page of Chains | The Short Seller | 2 | 1 | 3 | During THE PANIC or LEVERAGE, Yield 4. |
| Knight of Chains | The Raider | 4 | 1 | 2 | Fast. Exit Scam 3. Work: Front-run 3. |
| Queen of Chains | Cassandra | 4 | 2 | 3 | Chains and Events deal 1 less Drawdown to your cards. |
| King of Chains | Connor, Demon | 6 | 4 | 3 | Exit Scam 4. Whenever an Event resolves, gain 3 Profit into your Portfolio. |
| Page of Cups | Sister Ledger | 2 | 1 | 3 | When hired: bank 2 directly. |
| Knight of Cups | The Almoner | 3 | 2 | 3 | Fast. Your Cups give +1 to you. |
| Queen of Cups | Virgil, Oracle | 4 | 2 | 3 | Your Foretells cost no Favor. |
| King of Cups | GR80, Monk | 5 | 1 | 6 | Hedged. Whenever you play a Cup, GR80 yields without Working. |

### The twenty-two Majors

| Major | Kind | Effect |
|---|---|---|
| THE HAIL MARY (The Fool) | Invoke 3 | throw a Hail Mary Pass now, whatever the score. |
| THE FOUNDER (The Magician) | Invoke 2 | draw two Minors. |
| THE ORACLE (The High Priestess) | Event | Reveal the top three cards. The Trader with the most Favor puts them back in any order. |
| THE BOOM (The Empress) | Market | Candles give double. |
| THE FED (The Emperor) | Market | The Dividend bonus for exposed Profit is doubled. |
| THE REGULATOR (The Hierophant) | Event | Every Portfolio loses 3. Every Chains Personality takes 2 Drawdown. |
| THE MERGER (The Lovers) | Invoke 2 | an idle Personality Works with +3 Yield. |
| BULL RUN (The Chariot) | Market | Every Yield is +1. |
| CONVICTION (Strength) | Market | Portfolios cannot be targeted. |
| THE VAULT (The Hermit) | Invoke 1 | bank up to 5 Profit from your Portfolio. |
| VOLATILITY (Wheel of Fortune) | Event | Every Trader passes their Portfolio to the Trader on their left. |
| THE AUDIT (Justice) | Event | Each Trader with the most Chains Personalities loses half their Portfolio. |
| THE BAG HOLDER (The Hanged Man) | Market | No Dividend. |
| THE LIQUIDATION (Death) | Event | Every Working Personality takes 3 Drawdown. |
| DOLLAR-COST AVERAGE (Temperance) | Market | Dividend is 3. Yields above 3 become 3. |
| LEVERAGE (The Devil) | Market | Every Yield is doubled. Every Chain is doubled. |
| THE CRASH (The Tower) | Event | Every Portfolio is emptied. |
| THE WINDFALL (The Star) | Event | Every Trader draws two Minors and gains 3 Profit into their Portfolio. |
| THE PANIC (The Moon) | Market | Chains cost 0. |
| GOLDEN AGE (The Sun) | Market | Cups cost 0 and give double. |
| THE RECKONING (Judgement) | Event | The Final Bell: the game ends at the end of this round. If more than half the R-cana remains, it is instead buried in the bottom half of the deck. |
| OUR LADY OF PERPETUAL PROFIT (The World) | Event | The Trader with the most Favor banks their entire Portfolio. |

### The eight Trader cards

| Card | Kind | Cost | Effect |
|---|---|---|---|
| Stop-Loss | reaction | 0 | The next time a Chain or an Event would take 3 or more Profit from you, lose 2 instead. |
| Bailout | reaction | 0 | The next time one of your Personalities would be Liquidated, it stays, with its Drawdown cleared. |
| Short Squeeze | reaction | 0 | The next time the opponent Front-runs you for 2 or more, they lose that much from their own Portfolio instead. |
| Circuit Breaker | reaction | 0 | The next Event that would cost you Profit, your pass or a Personality is buried instead of resolving. |
| Margin Call | move | 2 | A Trading opposing Personality takes 3 Drawdown. It cannot be Hedged. |
| Insider Tip | move | 1 | Look at the Omen and the top three Minors. Put any of them on the bottom. |
| Rebalance | move | 1 | Bank up to 5 Profit from your Portfolio right now. |
| Pump | move | 1 | One of your Trading Personalities Trades again this turn. |

## Tuning notes

Strong bot against strong bot over 2,000 games per setting, after the second outside review's corrections.

| Setting | First seat wins | Rounds | Games with a Hedge played | Games won by a landing pass | Trader cards played per game |
|---|---|---|---|---|---|
| Last play off, Trader cards off | 50% | 7.2 | about half | 6% | 0 |
| Trader cards on, last play off | 50% | 7.4 | about a third | 8% | 2.2 |
| Both on, pass doubles (the table's default) | 51% | 7.8 | about a third | 22% | 2.3 |
| Both on, pass ×1.5 | 50% | 7.7 | about a third | 8% | 2.3 |

The strong bot beats the naive bot 59% of the time without Trader cards and 66% with them: the cards reward aiming and timing. Hedges fall when Trader cards are in because Stop-Loss and Bailout do some of the Hedge's work. The multiplier is the open question for human play: at 2x the last play decides one game in five, at 1.5x one in twelve.

Seat balance: with the Omen at round start and an immediate win at 80, eight cards each gave the first seat 58%; the second Trader opening with 8 Profit brought it to 50% and keeps every number an eight. Playing out the round with the first Trader on nine cards also balanced (48%) and remains a simulator option.
