# RL80 R-cana — Version 1b: Favor and Network

The shared reading (Version 1) with two changes of heart: a trader does not run a payroll, and generosity is noticed. This document lists only what differs from `RULES-v1.md`; everything else is unchanged.

## Why

Playtests of Version 1 found that the game turned into a hiring spree, and that nothing rewarded the one act that is on-brand for Our Lady of Perpetual Profit: giving the other player something. Version 1b caps the Network at two, lets you profit from the other trader's people instead of hiring your own, and turns charity into Favor, the currency of good fortune.

## Vocabulary

| Version 1 | Version 1b |
|---|---|
| Hire a Personality | **Partner** with a Personality |
| Your Floor | Your **Network** |
| Work a Personality | **Trade** with a Personality |
| Interest | **Dividend bonus** (same amount: 1 per full 5 exposed) |

## The Network

You may have at most **two** Personalities in your Network. Partnering costs the card's cost in Liquidity, as hiring did. A Personality rests the turn it arrives (unless Fast) and from then on you may Trade with it once a turn for its earnings. A Trading Personality is the only thing Chains can hit.

## Copy trade

Once per turn, during your main phase, pay 1 Liquidity to copy one of the opponent's **Trading** Personalities. You gain its full earnings into your Portfolio. The opponent gains 1 Profit for being followed. A Copy trade is a gift as well as a trade, so it earns Favor (below).

You cannot copy an idle or shielded Personality, and you cannot copy your own.

## Favor

Our Lady notices generosity. You gain **1 Favor** each time you:

- **Share**: play an upright Cups, giving the opponent Profit.
- **Copy trade**: follow one of the opponent's Personalities.

Favor is kept on your Querent. It is spent three ways:

1. **Foretell** (1 Favor, once per turn): look at the top card of the R-cana deck. You may put it on the bottom. Virgil, Queen of Cups, lets you Foretell for no Favor; that is now her whole ability.
2. **Our Lady's protection** (2 Favor, automatic): when an Event would take Profit from your Portfolio, or would bring down your Hail Mary Pass, and you hold at least 2 Favor, you lose 2 Favor instead and the Event does not touch you. This covers THE REGULATOR, THE AUDIT and THE CRASH.
3. **The World**: when OUR LADY OF PERPETUAL PROFIT is revealed, the Trader with the most Favor banks their entire Portfolio.

## Majors that change

| Major | Version 1b text |
|---|---|
| THE HAIL MARY (The Fool) | Invoke 3: throw a Hail Mary Pass now, even if you have already thrown one this game. (No Underdog clause.) |
| THE ORACLE (The High Priestess) | Reveal the top three cards. The Trader with the most Favor puts them back in any order. Ties go to the active Trader. |
| THE FED (The Emperor) | The Dividend bonus for exposed Profit is doubled. |
| THE BAG HOLDER (The Hanged Man) | Market: no Dividend. |
| OUR LADY OF PERPETUAL PROFIT (The World) | The Trader with the most Favor banks their entire Portfolio. |

Old Money (King of Coins) doubles your Dividend bonus. The Underdog is not referred to anywhere in Version 1b.

## A pass is brought down even from an empty Portfolio

An Event that takes Profit from Portfolios brings down a Hail Mary Pass in the air whether or not the thrower has any Profit exposed at that moment. (Version 1 let a pass survive if the Portfolio happened to be empty; the rules always said otherwise. The engine now matches the rules in every version.)

## Tuning notes

Strong bot against strong bot over 2,000 games, with Cups drawing a card in every version: first seat wins 50%, games last 7.3 rounds on average, the Final Bell is reached in 8% of games (the extra draws turn up more Majors, so THE RECKONING tolls more often than in the first 1b build). Each player partners with about 2.3 Personalities a game, copy trades 1.4 times, earns 3.6 Favor and spends 1.4 of it, mostly on Foretells; Our Lady spares someone in about a quarter of games. The strong bot beats the naive bot 66% of the time. A Network cap of 3 and half-earnings copies were also tested and were balanced; the cap of 2 was chosen because it is the version that stops the hiring spree.
