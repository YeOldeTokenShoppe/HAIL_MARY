# RL80 R-cana — Playtest 2: The Trading Desk

A delta on the First Playtest (see `../playtest1/PLAYTEST1.md` for everything not mentioned here). Playtest 2 asks one question: **does the game get better when your Trader is your paycheck?**

## What changed

### 1. Traders carry three things: LIQ, GRACE, and an ability

Pokémon-style statlines, R-cana values:

- **LIQ** is your income. At the start of your turn you collect your **seated Trader's LIQ** instead of a flat 2. No Trader seated (or your seat is hacked)? You collect **1** — you're between Traders.
- **GRACE** is their reputation, their state of grace, and their health. Scandals drain it. At **zero, the Trader is disgraced**: discarded, seat empty, income back to 1 until someone else sits down.
- **One ability**, as before.

| Trader | Cost | LIQ | GRACE | Ability |
|---|---:|---:|---:|---|
| El Unicornio | 3 | 3 | 20 | None — pure compounding, the best paycheck at the desk. |
| El Gato | 2 | 2 | 16 | When seated, immediately knock one hazard off your table, free. |
| El Monje | 1 | 1 | 22 | When you light a candle, collect 2 Liquidity. |
| El Diablito | 2 | 2 | 10 | When a hazard you play lands, collect 1 Liquidity. |
| La Estrella | 3 | 2 | 8 | Pay 1 when banking from a card: +25 Prosperity. Fame is fragile. |
| St. GR80 | 2 | 1 | 25 | When you light a candle, bank 25 Prosperity. |
| H80Z | 2 | 2 | 10 | Hazards you play cost 1 less. |
| Eugene | 2 | 1 | 14 | Your Hail Mary odds rise one step. |
| La Abuela | 2 | 2 | 18 | Your gambles moon on 4+ instead of 5+. |
| The Pope | 3 | 1 | 25 | Once a game, a failed Hail Mary is absolved — attempt it again. |
| The Prospector | 2 | 2 | 15 | Assets you buy cost 1 less. |

### 2. The seat and the bench

- **One seat** (ability + LIQ live) and a **bench of up to two**.
- Hiring is a main action: the seat if it's empty, otherwise the bench.
- **Once a turn you may swap** seat ↔ bench, **free** — it does not use your main action.
- Quantum Hack disables the *seat* (ability and LIQ) until cleared, whoever sits in it. La Sirena still drowns the seated Trader and blocks new *hires* (swaps still work). The Halo still protects.

### 3. The scandal economy — Grace goes down, and comes back up

Drains:
- **El Escándalo** (new hazard, cost 2, Degen ×2): the seated Trader loses **5 Grace** when it breaks, and **2 more** at the start of each turn until cleared.
- La Sirena, disgrace, and the Hack work as above.

Restores:
- **Lighting a candle restores 3 Grace** to your seated Trader. Public piety launders reputation.
- **El Publicista** (new remedy, cost 1, Devotion ×2): clear a Scandal — or play it as polish: your seated Trader regains **5 Grace**.

Upside:
- **A spotless reputation pays**: while your seated Trader is at **full Grace** (and not hacked), they earn **+1 Liquidity** on top of their LIQ. Grace damage persists after a Scandal is cleared — the scar outlives the story — so polishing back to full has a real payoff.

### 4. Deck adjustments (both still 40)

- Devotion: +El Publicista ×2; −1 Bell, −1 Bear.
- Degen: +El Escándalo ×2; −Tax Collector, −The Skull.
- El Unicornio's old "+1 income" ability is now just his statline (LIQ 3). El Monje pays 2 on a candle (income is scarcer here).

## The set and the number 80

The lotería set stays **54 numbered designs**; specials (Moral Hazard, The World, Flash Crash…) ride unnumbered. Target for the RL80 Genesis set: **80 cards total** — 54 numbered + 26 specials. Decks remain 40, constructed from the set.

## What this playtest needs to answer

- Does income-through-Traders make hiring feel essential without making unemployment miserable?
- Does the bench create real decisions (who sits when a Scandal breaks)?
- Is 3-Grace-per-candle the right lifeline, or does devotion trivialize scandals?
- Does La Estrella (GRACE 8) die too fast? Does anyone ever disgrace at all?
- Sim baseline at ship: 2p devotion/degen 48/52, ~21 rounds, hires 3.3/game, disgraces 0.14/game, cash sales up 6× over Playtest 1.
