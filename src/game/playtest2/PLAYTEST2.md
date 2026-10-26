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
| El Monje | 1 | 1 | 22 | When you light a candle, bank 25 Prosperity. |
| El Diablito | 2 | 2 | 10 | When a hazard you play lands, collect 1 Liquidity. |
| La Estrella | 3 | 3 | 8 | Pay 1 when banking from a card: +25 Prosperity. Fame is fragile. |
| La Abuela | 2 | 2 | 18 | Your gambles moon on 4+ instead of 5+. |
| El Papa | 3 | 3 | 25 | Once a game, a failed Hail Mary is absolved — attempt it again. |
| El Gambusino | 2 | 2 | 15 | Assets you buy cost 1 less. |

### 2. The seat and the bench

- **One seat** (ability + LIQ live) and a **bench of up to two**.
- Hiring is a main action: the seat if it's empty, otherwise the bench.
- **Once a turn you may swap** seat ↔ bench, **free** — it does not use your main action.
- Quantum Hack disables the *seat* (ability and LIQ) until cleared, whoever sits in it. The Halo still protects.

### 3. The scandal economy — Grace goes down, and comes back up

Drains:
- **El Escándalo** (new hazard, cost 2, Degen ×2): the seated Trader loses **5 Grace** when it breaks, and **2 more** at the start of each turn until cleared.
- Disgrace and the Hack work as above.

Restores:
- **Lighting a candle restores 3 Grace** to your seated Trader. Public piety launders reputation.
- **El Publicista** (new remedy, cost 1, Devotion ×2): clear a Scandal — or play it as polish: your seated Trader regains **5 Grace**.

Upside:
- **A spotless reputation pays**: while your seated Trader is at **full Grace** (and not hacked), they earn **+1 Liquidity** on top of their LIQ. Grace damage persists after a Scandal is cleared — the scar outlives the story — so polishing back to full has a real payoff.

### 4. Deck adjustments (both still 40)

- Devotion: +El Publicista ×2; −1 Bell, −1 Bear.
- Degen: +El Escándalo ×2; −Tax Collector, −The Skull.
- El Unicornio's old "+1 income" ability is now just his statline (LIQ 3). El Monje banks 25 Prosperity on a candle (GR80's old hook — the monk inherits it; income is scarcer here, piety pays in standing).
- **Names by row.** Things you hold are lotería (Traders, Artifacts, Remedies, Graces — Enigma Machine prints La Máquina, Quantum Resistance La Resistencia); the market is English (Assets, Events, Hazards — Full Moon, The God Candle, The World, The Wheel, Scandal). El Naranja stays, on purpose — he is a figure; La Ballena is The Whale, like the rest of its row.
- **Traders are lotería figures in the engine too**: The Pope is El Papa, The Prospector El Gambusino, The Illuminati El Ojo — one name on the card, the table and in the log.
- **La Semilla is Seed Round** — the Asset row prints in English throughout (the three Prospecting claims too: Treasure Map, The Mine, Oil Field Claim).
- **Bull Run** and **Bear Market** are the printed names of the bull and the bear — they are Events, not lotería figures.
- **Hire cost = income** for every Trader; La Estrella and The Illuminati go to LIQ 3, The Pope to LIQ 3. The card prints one number. Sim unchanged at 50/50.
- **Eugene retired** — he is El Unicornio by another name, and the Fountain now owns the odds step. Degen runs El Unicornio ×2.
- **El Jardín re-themed as Yield Farm** (La Granja) — same fragile income, no longer a plant beside the seed. Three Hail Mary Prospecting claims (all collectible): **Treasure Map** (cost 2 — 2 Liquidity or 75 Prosperity; *when sold, draw 2 cards*; El Mapa), **The Mine** (cost 4 — 4 Liquidity, or Prosperity that grows 25 a round from 75; La Mina), **Oil Field Claim** (cost 3 — *roll: 3+ gushes for 175, else runs dry for 25*; El Pozo). 57 designs: 54 numbered will be chosen from them.
- **The Confession** (Grace, cost 1 — *light a candle, and your seated Trader’s Grace is restored in full*; La Confesión). The set reaches **54 numbered designs**.
- **Real Estate** (Asset, cost 5 — 8 Liquidity or 150 Prosperity; *while held, immune to The Bear*; La Casa), **Stablecoin** (Asset, cost 2 — 3 Liquidity or 50 Prosperity; *collect 1 a turn while held*; El Dólar) and **Exit Scam** (Hazard, cost 3 — *the target cannot play the Events they call until cleared*; La Estafa). All collectible for now; 53 designs.
- **Gold** (new Asset, cost 3, collectible): sell for 6 Liquidity or 75 Prosperity — the one asset that pays better in cash than in standing. (El Oro.)
- **The Shroud** (new Artifact, cost 2, collectible — in neither starter): *when your seated Trader would be disgraced, discard the Shroud instead; they stay, with 5 Grace.* (El Sudario.)
- **The Fountain** (new Grace, cost 2, Devotion ×1 for one Ofrenda): *toss in 2 Liquidity — your Hail Mary odds rise one step, even past the shrine's three.* The odds ladder gains a fifth rung: 1 → 2 → 4 → 8 → **11** twelfths. (La Fuente.)
- **Third pass.** **The Moon** is **Full Moon**, an Event you call (cost 4 → bank 150; prints La Luna). New Asset **Collectibles** (cost 3 — sell for 5 Liquidity or 125 Prosperity; La Colección), ×1 in both starters. **Enigma Machine** has a job again: *once a turn, discard up to 3 cards and draw that many* (free; bots feed it what they cannot afford). **Honeymoon** removed. Degen swaps one Tech Stock for Collectibles. Both 40; sim 49/51, 17.3 rounds.
- **Second trim.** Removed: La Corrida, X-Ray Glasses, El Halving, The Airdrop. Changed: **The Skull** is an Artifact (cost 2 — *whenever a rival sells an Asset, collect 1 Liquidity*); **La Moneda** is the Event **Pay Day** (fires on draw — *every player collects 2 Liquidity*; prints as La Moneda); **The Illuminati** is a Trader (cost 3, LIQ 2, GRACE 12 — *when hired, each rival passes you one random card*); **Raphael's Cherub** is **The Votive** (El Exvoto). Enigma Machine's "cannot be peeked" now has nothing to block — pending. Devotion refilled with The Votive ×2, The Bell ×2, The Rose ×2; Degen with The Skull ×1, The Bull ×3. Both 40. Sim after: devotion/degen 49/51, 17.7 rounds.
- **La Sirena and The Snake retired** — too many hazards. Degen fills the two slots with The Inheritance ×2 (was 1) and Tech Stock ×2 (was 1); still 40. (A third Rocket was tried and tipped Degen to 63%; two more Assets to 64%.)
- **No more "Progress" type.** The Bull, Rocket and The Inheritance are Events you *call* — played from the hand for their cost and banked on the spot — where the other Events fire on draw. Same play, one fewer kind of card; the engine keeps a `played` flag on them.
- **St. GR80 and H80Z retired** — they were El Monje and El Diablito by other names. Devotion runs El Monje ×2, Degen El Diablito ×2 (both still 40). GR80's "bank 25 on a candle" and H80Z's "hazards cost 1 less" leave the set with them.
- **Shitcoin folded into Meme Coin.** One degen asset instead of two: Meme Coin (cost 2) sells safe for 4 Liquidity, or rolls the die for Prosperity — 5+ moons for 125, else zero. It is the set's only gamble, so La Abuela's "4+ instead of 5+" reads off it. Degen's Shitcoin ×2 became Meme Coin ×2 (still 40).

## The set and the number 80

The lotería set stays **54 numbered designs**; specials (Moral Hazard, The World, Flash Crash…) ride unnumbered. Target for the RL80 Genesis set: **80 cards total** — 54 numbered + 26 specials. Decks remain 40, constructed from the set.

## What this playtest needs to answer

- Does income-through-Traders make hiring feel essential without making unemployment miserable?
- Does the bench create real decisions (who sits when a Scandal breaks)?
- Is 3-Grace-per-candle the right lifeline, or does devotion trivialize scandals?
- Does La Estrella (GRACE 8) die too fast? Does anyone ever disgrace at all?
- Sim baseline at ship: 2p devotion/degen 48/52, ~21 rounds, hires 3.3/game, disgraces 0.14/game, cash sales up 6× over Playtest 1.
