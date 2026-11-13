# RL80 R-cana — Playtest 2: The Trading Desk

A delta on the First Playtest (see `../playtest1/PLAYTEST1.md` for everything not mentioned here). Playtest 2 asks one question: **does the game get better when your Trader is your paycheck?**

## What changed

### 1. Traders carry three things: LIQ, GRACE, and an ability

Pokémon-style statlines, R-cana values:

- **LIQ** is your income. At the start of your turn you collect your **seated Trader's LIQ** instead of a flat 2. No Trader seated (or your seat is hacked)? You collect **1** — you're between Traders.
- **GRACE** is their reputation, their state of grace, and their health. Scandals drain it. At **zero, the Trader is disgraced**: discarded, seat empty, income back to 1 until someone else sits down.
- **One named ability** for every Trader, printed beside **ABIL80**.

| Trader | Cost | LIQ | GRACE | Ability |
|---|---:|---:|---:|---|
| El Unicornio | 3 | 3 | 20 | Compound Interest: at turn start, if you have at least 100 banked Prosperity, bank 25 more. |
| El Gato | 2 | 2 | 16 | When seated, immediately knock one hazard off your table, free. |
| El Monje | 1 | 1 | 22 | When you light a candle, bank 25 Prosperity. |
| El Diablito | 2 | 2 | 10 | Devil’s Wager: at turn start, flip a coin. Heads gains 1 Liquidity; tails loses 1 CRED (Grace). |
| La Estrella | 3 | 3 | 8 | Pay 1 when banking from a card: +25 Prosperity. Fame is fragile. |
| La Abuela | 2 | 2 | 18 | Your gambles moon on 4+ instead of 5+. |
| El Papa | 3 | 3 | 25 | Once a game, a failed Hail Mary is absolved — attempt it again. |
| El Gambusino | 2 | 2 | 15 | Assets you buy cost 1 less. |

### 2. The seat and the bench

El Unicornio's **Compound Interest** resolves at the start of its controller's
turn, before income and the draw. Only the active, enabled Trader earns it;
playing or swapping it into the active slot does not pay immediately. Quantum
Hack blocks it unless protected by the Halo. The payout uses normal banking
rules, including Bear Market’s cap and the victory check. Its cost, income and CRED
remain 3 / 3 / 20; the added ability still needs balance playtesting.
A paired 200-game check (seeds 1–200, two Greedy bots, alternating seats,
Devotion vs Degen) moved Degen from 107 wins without the ability to 127 with
it, and shortened the average game from 16.73 to 15.67 rounds. This is a bot
balance signal, not a claim of balance under human play.

El Diablito's **Devil’s Wager** resolves before normal income. Only the seated,
enabled Trader flips. Tails damages his own CRED using the normal disgrace and
Shroud rules; it can also end his spotless-reputation income bonus. A benched
or hacked El Diablito does not flip (the Halo still protects from the Hack).
The coin replaces his former Calamity rebate.

- **One active Trader** that you inhabit (ability + LIQ live) and a **bench of up to two**.
- Playing a Trader is a main action: inhabit it if the active slot is empty, otherwise place it on the bench.
- **Once a turn you may swap** seat ↔ bench, **free** — it does not use your main action.
- Quantum Hack disables the *seat* (ability and LIQ) until cleared, whoever sits in it. The Halo still protects.

### 3. The scandal economy — Grace goes down, and comes back up

Drains:
- **El Escándalo** (new hazard, cost 2, Degen ×2): the seated Trader loses **5 Grace** when it breaks, and **2 more** at the start of each turn until cleared.
- Disgrace and the Hack work as above.

Restores:
- **Lighting a candle restores 3 Grace** to your seated Trader. Public piety launders reputation.
- **The Press Release / El Comunicado** (remedy, cost 1, Devotion ×2; was El Publicista until 2026-11-10 — the Remedies row is objects, not people): clear a Scandal — or play it as polish: your seated Trader regains **5 Grace**.

Upside:
- **A spotless reputation pays**: while your seated Trader is at **full Grace** (and not hacked), they earn **+1 Liquidity** on top of their LIQ. Grace damage persists after a Scandal is cleared — the scar outlives the story — so polishing back to full has a real payoff.

### 4. Deck adjustments (both still 40)

- Devotion: +The Press Release ×2; −1 Bell, −1 Bear.
- Degen: +El Escándalo ×2; −Tax Collector, −The Skull.
- El Unicornio's old "+1 income" ability is now just his statline (LIQ 3). El Monje banks 25 Prosperity on a candle (GR80's old hook — the monk inherits it; income is scarcer here, piety pays in standing).
- **Names by row.** Things you hold are lotería (Traders, Artifacts, Remedies, Graces — Enigma Machine prints El Enigma, Quantum Resistance La Resistencia); the market is English (Assets, Events, Hazards — Full Moon, The God Candle, The World, The Wheel, Scandal). Ride or Die keeps its English name in the lotería row, on purpose — it is a caption, not a title; La Ballena is The Whale, like the rest of its row. (El Naranja, the old exception the other way, was dropped.)
- **Traders are lotería figures in the engine too**: The Pope is El Papa, The Prospector El Gambusino, The Illuminati El Ojo — one name on the card, the table and in the log.
- **La Semilla is Seed Round** — the Asset row prints in English throughout (the three Prospecting claims too: Treasure Map, The Mine, Oil Field Claim).
- **Bull Run** and **Bear Market** are the printed names of the bull and the bear — they are Events, not lotería figures.
- **Play cost = income** for every Trader; La Estrella and The Illuminati go to LIQ 3, The Pope to LIQ 3. The card prints one number. Sim unchanged at 50/50.
- **Eugene retired** — he is El Unicornio by another name, and the Fountain now owns the odds step. Degen runs El Unicornio ×2.
- **El Jardín re-themed as Yield Farm** (La Granja) — same fragile income, no longer a plant beside the seed. Three Hail Mary Prospecting claims (all collectible): **Treasure Map** (cost 2 — 2 Liquidity or 75 Prosperity; *when sold, draw 2 cards*; El Mapa), **The Mine** (cost 4 — 4 Liquidity, or Prosperity that grows 25 a round from 75; La Mina), **Oil Field Claim** (cost 3 — *roll: 3+ gushes for 175, else runs dry for 25*; El Pozo). 57 designs: 54 numbered will be chosen from them.
- **The Confession** (Grace, cost 1 — *light a candle, and your seated Trader’s Grace is restored in full*; La Confesión). The set reaches **54 numbered designs**.
- **Real Estate** (Asset, cost 5 — 8 Liquidity or 150 Prosperity; *while held, immune to The Bear*; La Casa), **Stablecoin** (Asset, cost 2 — 3 Liquidity or 50 Prosperity; *collect 1 a turn while held*; El Dólar) and **Exit Scam** (Hazard, cost 3 — *the target cannot play the Events they call until cleared*; La Estafa). All collectible for now; 53 designs.
- **Gold** was dropped (2026-11-10): its cash role is Stablecoin’s, its 75 is Treasure Map’s, its safe-haven story is Real Estate’s. Its mine artwork now prints as **The Mine**.
- **The Shroud** (new Artifact, cost 2, collectible — in neither starter): *when your seated Trader would be disgraced, discard the Shroud instead; they stay, with 5 Grace.* (El Sudario.)
- **The Fountain** (new Grace, cost 2, Devotion ×1 for one Ofrenda): *toss in 2 Liquidity — your Hail Mary odds rise one step, even past the shrine's three.* The odds ladder gains a fifth rung: 1 → 2 → 4 → 8 → **11** twelfths. (La Fuente.)
- **Third pass.** **The Moon** is **Full Moon**, an Event you call (cost 4 → bank 150; prints La Luna). New Asset **Collectibles** (cost 3 — sell for 5 Liquidity or 125 Prosperity; La Colección), ×1 in both starters. **Enigma Machine** has a job again: *once a turn, discard up to 3 cards and draw that many* (free; bots feed it what they cannot afford). **Honeymoon** removed. Degen swaps one Tech Stock for Collectibles. Both 40; sim 49/51, 17.3 rounds.
- **Second trim.** Removed: La Corrida, X-Ray Glasses, El Halving, The Airdrop. Changed: **The Skull** is an Artifact (cost 2 — *whenever a rival sells an Asset, collect 1 Liquidity*); **La Moneda** is the Event **Pay Day** (fires on draw — *every player collects 2 Liquidity*; prints as La Moneda); **The Illuminati** is a Trader (cost 3, LIQ 2, GRACE 12 — *when played as your active Trader, each rival passes you one random card*); **Raphael's Cherub** is **The Votive** (El Exvoto). Enigma Machine's "cannot be peeked" now has nothing to block — pending. Devotion refilled with The Votive ×2, The Bell ×2, The Rose ×2; Degen with The Skull ×1, The Bull ×3. Both 40. Sim after: devotion/degen 49/51, 17.7 rounds.
- **La Sirena and The Snake retired** — too many hazards. Degen fills the two slots with The Inheritance ×2 (was 1) and Tech Stock ×2 (was 1); still 40. (A third Rocket was tried and tipped Degen to 63%; two more Assets to 64%.)
- **Rocket dropped** (2026-11-10): the rocket is Meme Coin's art now. Its two slots per deck went to new called Events that read the table: **Short Squeeze** (Devotion ×2, cost 3: bank 100 + 50 per Calamity on you, bear-proof) and **Token Unlock** (Degen ×2, cost 4: bank 200, every rival collects 1). Decks stay at 40.
- **Five more** (2026-11-12). **The Angel Investor** (Trader, cost 2, LIQ 2, GRACE 16 — *Angel Round: when you invest in an Asset, collect 1 back*; El Ángel; Devotion ×1 for Pay Day). **The Neural Cathedral** (Asset, cost 4 — 6 Liquidity or 150; tech; Devotion ×1 for Collectibles). **El Infierno** (Hazard, cost 3 — *they cannot attempt the Hail Mary or offer a Grace until cleared*; a lock, not damage; its Spanish name stays in the English row by choice; Degen ×1 for Quantum Hack). **Divine Intervention** (Grace, cost 3, Saving Grace 3 — *a candle, and every Calamity on you is lifted*; La Intervención; Devotion ×1 for one Horchata). **The Feast of Perpetual Profit** (on-draw Event — *every player lights a candle*; Degen ×1 for its Halo). **Shady Lady** (Trader, cost 2, LIQ 2, GRACE 8 — *Insider Tip: when you play a Calamity on a rival, draw a card*; La Tramposa; Degen ×1 for its Gato). (The Cloud was tried in that seat first — a backup-as-resurrection ability — and withdrawn the same day: a cloud is not someone you seat.) Both starters 40. **Set: 80 designs.**
- **Eleven at once** (2026-11-12). Traders: **Byzantine General** (cost 2, LIQ 2, GRACE 14 — *Consensus: a Calamity played on you must reach consensus; roll the die, on a 1 or 2 it fails*; El General; Devotion ×1 for one Gato) and **The Bot** (cost 3, LIQ 3, GRACE 6 — *No Soul: Scandal cannot touch it; it cannot pray, so your Graces go unheard while it sits*; El Robot; Degen ×1 for one Diablito). Asset: **The Motherboard** (cost 3 — 4 Liquidity or 125; tech, so Tech Wreck takes it; Degen ×1 for Collectibles) — Tech Stock and it carry a `tech` flag the Wreck reads. Hazard: **The Virtue Signal** (cost 2 — *their candles count for nothing: Hail Mary odds fall to 1 in 12 until cleared*; Degen ×1 for one Ofrenda). Remedy: **The Burro** (cost 2 — *clear one Calamity and kick it back onto the rival who played it*; El Burro; Devotion ×1 for its Keys). Relic: **Sacred Geometry** (cost 2 — *your called Events bank 25 more*; La Geometría; Devotion ×1 for one Press Release). Graces: **The Intercession** (cost 2, Saving Grace 3 — *a candle, and one Calamity on you is lifted*; La Intercesión; Devotion ×1 for one Bell) and **Ánima Sola** (cost 1 — *a candle, and a disgraced Trader returns from your discard to your bench with 5 Grace*; Devotion ×1 for one Ofrenda). Apparitions (on-draw Events named for Our Lady, all Degen ×1 — for one Bull Run, The Inheritance and one Token Unlock): **The Holy Roller** (*every player draws a card and collects 1*), **Nuestra Señora en Fuego** (*every player banks 75* — her name stays Spanish in the English row, like Ride or Die the other way) and **The Virtual Mary** (Ambiguity — *every player shuffles their hand into their deck and draws that many*). Both starters still 40. Set: 74 designs.
- **Fall From Grace** (new on-draw Event, Calamity, Degen ×1 — for one Scandal; 2026-11-12): *the fall — every seated Trader loses 4 Grace.* The whole table, drawer included. The push that makes SAVING GRACE matter: on a Trader already scarred by a Scandal it is the second blow. Degen's Grace pressure stays about level but spreads across the table instead of landing on one rival.
- **SAVING GRACE N** (keyword, 2026-11-12): *discard this card from your hand when your seated Trader would be disgraced — they stay, with N Grace.* Not a card: a line printed on five. The Shroud 5 (it still works from the table too), The Confession 3, The Votive 3, La Ofrenda 2, The Press Release 2. It reads as the Shroud's rescue spread thin across the Grace row, and gives a Grace a second life once the shrine's three candles are lit and it can no longer be offered. You are asked each time (a hand with several offers the choice); the bot always saves, with the card that leaves the most Grace.
- **The Lottery Ticket** (new Relic, cost 1, Degen ×1 — for its Keys; 2026-11-11): *scratch it at the start of each turn — roll the die; a 6 wins 150 Prosperity and the Ticket is spent.* A Relic slot on a long shot: 1-in-6 a turn, so it usually pays once before the game ends. A win the Bear caps is held, not lost. Prints El Boleto.
- **The Tattoo** (new Relic, cost 2, Devotion ×1 — for one Quantum Resistance; 2026-11-11): *inked devotion — at the start of your turn, your seated Trader regains 1 Grace.* The slow heal under the Press Release's polish and the Confession's full restore; it also walks a scarred Trader back to spotless, where the +1 income lives. Prints El Tatuaje.
- **Tech Wreck** (new on-draw Event, Calamity, Degen ×1 — for one Inheritance; 2026-11-11): *the bubble bursts — every Tech Stock on the table is wrecked, scrapped for 1 Liquidity.* Whoever holds it. Both starters now run **Tech Stock ×2** (Devotion for one Pay Day, Degen for one Bull Run) so the Wreck has something to find.
- **Dashboard Figure** (new Relic, cost 2, Devotion ×1 — for one Rose; 2026-11-10): *Our Lady of the Dashboard — when a die fails you, a gamble that busts or an unanswered Hail Mary, discard her and roll again.* A one-shot charm like the Sacred Heart. You are asked each time, so she can be saved for the prayer; the bot saves her for it unless the prayer is already said. Prints La Virgencita.
- **Horchata** (new Remedy, cost 0, Devotion ×2 — for one Keys and one Votive; 2026-11-10): *refresh — discard up to 2 cards, then draw that many plus one.* The refreshment: a Remedy that clears nothing, in the row with the Tortilla. The +1 means it replaces itself, so it is never dead in hand. Prints La Horchata. **Enigma Machine** hands its cycle to Horchata. (It decoded the deck for a day — look at the top card, keep or bury — but that is La Investigadora's Due Diligence word for word, so on 2026-11-12 it became *Intercept*: when an Event fires on your draw, discard the Machine and the Event is cancelled for everyone. One-shot, like the Sacred Heart; you are asked, so a Pay Day can go through and a Fall From Grace cannot. The bot intercepts Calamities and Ambiguities. Prints El Enigma — La Máquina lost the cipher.)
- **Mardi Gras** (new on-draw Event, Opportunity, Degen ×1 — in place of a third Bull Run; 2026-11-10): *let the good times roll — every player rolls the die and collects that much Liquidity.* Pay Day with variance: 3.5 a head on average instead of a flat 2.
- **No more "Progress" type.** The Bull, Full Moon and The Inheritance are Events you *call* — played from the hand for their cost and banked on the spot — where the other Events fire on draw. Same play, one fewer kind of card; the engine keeps a `played` flag on them.
- **St. GR80 and H80Z retired** — they were El Monje and El Diablito by other names. Devotion runs El Monje ×2, Degen El Diablito ×2 (both still 40). GR80's "bank 25 on a candle" and H80Z's "hazards cost 1 less" leave the set with them.
- **Shitcoin folded into Meme Coin.** One degen asset instead of two: Meme Coin (cost 2) sells safe for 4 Liquidity, or rolls the die for Prosperity — 5+ moons for 125, else zero. It is the set's only gamble, so La Abuela's "4+ instead of 5+" reads off it. Degen's Shitcoin ×2 became Meme Coin ×2 (still 40).

## The set and the number 80

**Neither was an Asset** (2026-11-12). **The Motherboard** is a Relic (cost 2 — *expansion slots: the board takes no Relic slot, and you may hold a third Relic*; La Placa Madre; Degen ×1). (First draft had it take a slot to grant one — a net zero the bots never bought.) **The Neural Cathedral** opens a new row, **Locations** (engine type `location`, printed under the Artifact class with its own subtype like Remedy and Grace): places you build, one standing per player, a new one replaces the old, no Relic slot, never sold. The Cathedral itself was then replaced by **Las Lágrimas** (Grace, cost 1 — *to the shrine: light a candle*; Saving Grace 4, the strongest rescue in the hand; Devotion ×1 for one Ofrenda), so the Location row stands empty in Genesis: the engine and the table support it, the gallery hides an empty row, and the Stadium-style shared version with more places is second-set material. Collectibles went back into Devotion for the Asset slot. Rows: Traders 12, Assets 11, Events 20, Hazards 8, Remedies 7, Relics 13, Graces 9.

**La Celebridad is The Influencer / La Influencer** (2026-11-12) — the card's own ability text always called her the influencer; the name caught up. Key `celebridad` and the `the-celebrity` art folder are unchanged.

**Numbering (2026-11-12).** All 80 are numbered 1–80 — no numbered/special split, since rarity is deferred (every new face is Common until the set earns tiers). `src/game/rcana/set/numbers.js` reserves one number per design: the 40 faces already rendered keep their provisional numbers (7–49), and the 40 text cards were dealt the open slots (1–6, 8–10, 50–80) in row order. Lint checks every face against the table, so a number cannot be handed out twice as art arrives.

The lotería set stays **54 numbered designs**; specials (Moral Hazard, The World, Flash Crash…) ride unnumbered. Target for the RL80 Genesis set: **80 cards total** — 54 numbered + 26 specials. Decks remain 40, constructed from the set.

## What this playtest needs to answer

- Does income-through-Traders make inhabiting an active Trader feel essential without making the time between Traders miserable?
- Does the bench create real decisions (who sits when a Scandal breaks)?
- Is 3-Grace-per-candle the right lifeline, or does devotion trivialize scandals?
- Does La Estrella (GRACE 8) die too fast? Does anyone ever disgrace at all?
- Sim baseline at ship: 2p devotion/degen 48/52, ~21 rounds, hires 3.3/game, disgraces 0.14/game, cash sales up 6× over Playtest 1.
