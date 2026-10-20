# RL80 R-cana — First Playtest Plan

A digital-first, Lotería-inspired collectible card game about building prosperity, surviving market disasters, and deciding when helping a rival is worth the sacrifice.

Players build their decks before the game. During play, they use Liquidity to fund investments, disrupt competitors, and help one another. Every player has one chance to invoke a Hail Mary, with better chances earned through offerings to Our Lady.

## 1. Players and objective

Start with **2–4 players**. The digital table defaults to a 2-player game for quick testing.

The first player to bank **1,000 Prosperity or more** wins immediately.

Banked Prosperity cannot be spent, stolen, or lost. Liquidity and investments remain available for card effects to influence.

## 2. What each player brings

- A **40-card deck**, which includes Trader and Event cards. Two starter recipes are provided (section 11): **Devotion** and **Degen**.
- **Our Lady of Perpetual Profit**, the universal Hail Mary card, outside the deck.

Decks may contain **up to three copies of the same card**, regardless of artwork or finish.

Players themselves are identical — nobody *is* a character. The Traders are cards in the deck, in the lotería spirit: the cast is something you draw, not something you pick. Each Trader has one modest ability. For this prototype, Traders have no health, attacks, or supporting roster.

**Credibility is reserved for a later test.** The first version uses Liquidity, Prosperity, and Good Deeds.

## 3. The three resources

| Resource | Purpose | Presentation |
|---|---|---|
| **Liquidity** | Spend on cards, investments, and assistance | Coins or banknotes in denominations of 1, 5, and 10 |
| **Prosperity** | Progress toward the 1,000-point victory target | Banked cards and a visible total (the digital table labels the counter **Banked**) |
| **Candles** | Offerings to Our Lady that improve your Hail Mary probability | Up to three illuminated candles at the shrine |

Money comes from a shared bank. Bank supply is unlimited in the digital game.

## 4. Setup and turns

Each player starts with **5 Liquidity**, five cards in hand, zero Prosperity, and zero deeds.

Choose the first player randomly.

On your turn:

1. Collect **2 Liquidity**.
2. Draw **one card**.
3. Take **one main action**.
4. Discard down to **seven cards** in hand.

Your main action can be:

- Play one card, paying its cost.
- Sell one investment you already own.
- Pay to clear one of your hazards.
- Attempt your Hail Mary.
- Pass.

The rhythm of a turn is simple: **every player draws a card, then plays a card.**

If your draw turns up an **Event**, it fires immediately for the whole table and you draw a replacement card (section 10).

Trader abilities and Artifact reactions follow their own timing and do not consume your main action unless stated.

When your draw deck is empty, shuffle your discard pile to form a new one. Banked progress cards and cards still in play stay out of the deck.

## 5. Investments and progress

**Assets** enter your investment area when purchased. They cannot be sold on the turn they enter play.

Selling one Asset uses your main action. Choose its printed payout:

- **Cash payout:** collect Liquidity and discard the Asset.
- **Prosperity payout:** bank the Asset under your Prosperity total.

**Progress cards** award Prosperity immediately when played. Bank them after resolving.

This creates a recurring choice: build spending power or advance toward victory.

## 6. Hazards, Remedies, and protection

Hazards remain in front of their target until cleared.

- A player may have different hazards at once.
- A player cannot receive a second copy of a hazard already affecting them.
- A matching Remedy removes one hazard.
- As a universal escape, spend your main action and **3 Liquidity** to discard one hazard affecting you.
- Cleared hazards and used Remedies go to their owners’ discard piles.

You may play a Remedy on a rival’s hazard instead of your own. Pay its normal cost and use your main action.

Artifacts remain equipped until discarded by an effect. You may equip **at most two**. When playing a third, discard one of your existing Artifacts.

## 7. Offerings and candles

**La Ofrenda** is a Grace card in the deck. Playing it is your main action: the card itself is the offering — it goes to Our Lady's shrine, out of the game, and lights **one candle**.

- Maximum **three candles**. Each one doubles your Hail Mary chance (section 8).
- The shrine is the only road to candles. Piety rides the deck: if La Ofrenda never comes, grace never comes.
- Helping a rival — clearing their hazard with a Remedy, striking deals — is allowed and often wise, but it earns no candle. Charity is its own reward; the Lady counts only what is placed on her shrine.

Players may discuss deals, but informal promises are not enforced by the game.

## 8. The Hail Mary

Every player gets **one attempt per game**. It replaces their main action.

| Candles lit | Success chance |
|---:|---:|
| 0 | 1/12 |
| 1 | 2/12 |
| 2 | 4/12 |
| 3 | 8/12 |

Each candle doubles the success chance, capped at **8/12**.

**Success:** clear all hazards affecting you and bank **200 Prosperity**.

**Failure:** gain nothing.

Either result consumes the attempt. Flip Our Lady’s card to show it has been used. A successful Hail Mary can win the game.

The digital interface displays the exact probability before the player commits. All collectible editions have identical odds.

## 9. Traders are cards

Traders are a card type inside the deck — you hire them by drawing and playing them, like everything else.

- Playing a Trader is your **main action**. Pay its cost and place it in your Trader seat.
- You can have **one active Trader** at a time. Playing a new one sends the old one to your discard pile.
- A Trader's ability is passive while it is seated.
- **Quantum Hack** disables your seated Trader's ability until cleared. The hazard stays in place even if you hire a new Trader. **The Halo** protects whoever sits in your Trader seat, current or future.
- Traders are not Assets: they cannot be sold.

| Trader | Cost | Prototype ability |
|---|---:|---|
| **El Unicornio** | 3 | At the start of your turn, collect **1 extra Liquidity**. |
| **El Gato** | 2 | When El Gato is seated, immediately discard **one hazard** affecting you, free. |
| **El Monje** | 1 | When you light a candle, collect 1 Liquidity. |
| **El Diablito — Connor** | 2 | When a hazard you play successfully enters a rival's hazard area, collect 1 Liquidity. |
| **La Estrella — The Star** | 3 | The influencer. When you bank Prosperity from an Asset or Progress card, you may pay 1 Liquidity to add 25 Prosperity. |
| **St. GR80** | 2 | When you light a candle, bank **25 Prosperity**. |
| **H80Z** | 2 | Hazards you play cost 1 less Liquidity, minimum zero. |
| **Eugene** | 2 | Your Hail Mary odds rise **one step** on the deeds table. |
| **La Abuela** | 2 | The gambling grandmother. Your gambles (Shitcoin) moon on **4+** instead of 5+. |
| **The Pope** | 3 | Once per game, a failed Hail Mary is absolved — you may attempt it again. |
| **The Prospector** | 2 | Assets you buy cost 1 less Liquidity, minimum zero. |

The Star's bonus does not apply to the Hail Mary. Eugene's step respects the 8/12 cap.

One more design is reserved as a collectible alternate outside the starters: **La Detective — Marisol** (Rug Pulls cannot be played on you).

## 10. Events

Events are the market's own voice — the caprice. They are cards in the deck, but nobody chooses to play one: an Event **fires the moment it is drawn**, affects the whole table, goes to the drawer's discard pile, and the drawer draws a replacement card.

| Event | Effect |
|---|---|
| **El Halving** | Until the drawer's next turn, turn income is **1** instead of 2. |
| **La Corrida** | Until the drawer's next turn, Assets sold for Prosperity pay **+25**. |
| **Flash Crash** | Every player holding **8 or more Liquidity** immediately loses half, rounded down. |
| **The Airdrop** | Every player draws a card. (With the replacement, the drawer draws two.) |
| **Honeymoon** | Until the drawer's next turn, **no hazards** can be played. |
| **La Ballena** | The whale surfaces: the richest portfolio's best Asset moves to the poorest player. |
| **La Rueda** | Every portfolio rotates one seat. |
| **The God Candle** | Until the drawer's next turn, Prosperity sales pay **double**. |
| **The Skull** | Exit liquidity: the player with the most sales collects 5 Liquidity; everyone else pays 2. |
| **The World** | Every standing effect ends, and everyone draws a card. |
| **The Illuminati** | Unseen hands: every player passes one random card to the player on their left. |
| **Moral Hazard** | The bailout: the player with the least Liquidity collects 5 from the bank; the player with the most loses 2. Too big to fail. |

Events do not fire during the opening deal.

## 11. The card pool and two starter recipes

All costs below are paid in Liquidity when the card is played. Traders are listed in section 9 and Events in section 10.

### Assets and progress

| Card | Cost | Effect |
|---|---:|---|
| **Tech Stock** | 3 | Asset. Later sell for **5 Liquidity** or **100 Prosperity**. |
| **Meme Coin** | 2 | Asset. Later sell for **4 Liquidity** or **75 Prosperity**. |
| **The Moon** | 4 | Asset. Later sell for **7 Liquidity** or **150 Prosperity**. |
| **Shitcoin** | 1 | Asset. Later sell for **1 Liquidity** — or gamble it for Prosperity: roll a die, **5+ banks 125**, anything else pays nothing. |
| **Blue Chip** | 6 | Asset. Later sell for **10 Liquidity** or **250 Prosperity**. |
| **La Moneda** | 3 | Asset. While held, collect **1 Liquidity** at the start of your turn. Sell for 3 Liquidity or 50 Prosperity. |
| **El Jardín** | 4 | Asset. While held, collect **2 Liquidity** a turn — but it dies the moment **any Event** fires. Sell for 2 Liquidity or 50 Prosperity. |
| **La Semilla** | 1 | Asset. Sell for 1 Liquidity or **25 Prosperity** — or hold four rounds and it blooms to **150**. |
| **The Bull** | 2 | Progress. Bank **100 Prosperity**. |
| **Rocket** | 4 | Progress. Bank **200 Prosperity**. |
| **The Inheritance** | 0 | Choose **3 Liquidity** or **50 Prosperity**. Discard after taking cash; bank after taking Prosperity. |

For rules purposes, The Inheritance is a Progress card.

### Hazards

| Card | Cost | Effect |
|---|---:|---|
| **The Bear** | 2 | Target rival cannot bank more than **75 Prosperity from a single Asset or Progress card**, including bonuses. Larger payouts cannot be chosen. |
| **Quantum Hack** | 2 | Disable target rival’s seated Trader until cleared. |
| **Rug Pull** | 3 | Target rival cannot sell Assets until cleared. |
| **La Sirena** | 3 | The target's seated Trader walks into the sea (discarded). They cannot seat a new Trader until cleared. |
| **Tax Collector** | 2 | The target pays 1 Liquidity to the bank at the start of each of their turns. |
| **The Snake** | 3 | The serpent at the shrine: the target's candles count as zero for the Hail Mary. |
| **El Naranja** | 3 | The Orange One takes his cut: whenever the target banks Prosperity, the hazard's owner collects 2 Liquidity. (Not the Hail Mary.) |
| **El Alacrán** | 2 | The social engineer's sting: the target's hand is played face-up until cleared. Enigma Machine shields against it. |

These hazards do not prevent a Hail Mary attempt or reduce its payout. Rug Pull still allows direct Progress cards.

### Remedies

| Card | Cost | Effect |
|---|---:|---|
| **The Bell** | 1 | Clear The Bear. |
| **Quantum Resistance** | 1 | Clear Quantum Hack. |
| **The Keys** | 1 | Clear Rug Pull. |
| **Miracle Tortilla** | 2 | Clear any one hazard. |

Each Remedy can help you or a rival. Helping earns goodwill, not candles.

### Artifacts

| Card | Cost | Effect |
|---|---:|---|
| **Sacred Heart** | 2 | Discard this equipped Artifact to cancel a hazard just played on you. |
| **The Halo** | 3 | While equipped, any Trader seated at your desk — now or later — cannot be disabled. A Quantum Hack on you remains until cleared, but does nothing. |
| **X-Ray Glasses** | 2 | Once during your turn, inspect one randomly selected card in a rival’s hand. This does not use your main action. |
| **The Rosary Beads** | 2 | When you light a candle, you may draw one card. |
| **The Grail** | 3 | While equipped, an answered Hail Mary banks **300** instead of 200. |
| **Enigma Machine** | 2 | While equipped, your hand cannot be peeked. |

A canceled hazard is discarded. Its player does not recover the cost or action.

### Graces

| Card | Cost | Effect |
|---|---:|---|
| **La Ofrenda** | 0 | Your main action: place it at Our Lady's shrine (out of the game) and light one candle. |
| **Raphael's Cherub** | 1 | Your main action: to the shrine — light one candle, then draw a card. |
| **The Rose** | 0 | Your main action: offer it to a rival. If they **accept**, they keep it in their investments (worth 50 Prosperity) and you light a candle. If they **refuse**, it returns to your hand. |

### The recipes — 40 cards each

Two starters replace the single shared deck, so the first playtests are archetype tests. Deck identity is the collectible premise.

**Devotion** — deeds, remedies, slow money:
St. GR80, El Monje, El Gato, La Estrella, The Pope (1 each) · Tech Stock ×1, The Moon ×1, Blue Chip ×1, La Moneda ×2, La Semilla ×1 · The Bull ×2, Rocket ×2, The Inheritance ×1 · La Corrida, The Airdrop, Honeymoon (1 each) · The Bear ×2, Rug Pull ×1 · The Bell ×2, Quantum Resistance ×2, The Keys ×2, Miracle Tortilla ×2 · Sacred Heart, The Halo, The Rosary Beads, X-Ray Glasses, The Grail (1 each) · La Ofrenda ×3, Raphael's Cherub ×1, The Rose ×1.

**Degen** — hazards, gambles, compounding:
H80Z, El Diablito, Eugene, El Unicornio, El Gato, The Prospector, La Abuela (1 each) · Shitcoin ×2, Tech Stock ×1, The Moon ×1, Blue Chip ×1, El Jardín ×1 · The Bull ×2, Rocket ×2, The Inheritance ×1 · El Halving, La Ballena, La Rueda, Moral Hazard, The God Candle, The Skull, The Illuminati (1 each) · Quantum Hack ×1, Rug Pull ×1, La Sirena ×1, Tax Collector ×1, The Snake ×1, El Naranja ×1, El Alacrán ×1 · Miracle Tortilla ×1, The Keys ×1 · Sacred Heart, X-Ray Glasses, The Halo, Enigma Machine (1 each) · La Ofrenda ×2.

The pool holds **55 distinct designs**: the numbered lotería 54 plus **Moral Hazard**, the unnumbered bailout. Flash Crash and The World ride outside the starters as collectibles (plus La Detective as a spec-only alternate). Including Our Lady, each player begins with 41 cards in total. The digital table lists every design with its recipe counts under **"All cards in this playtest"** at the bottom of the page.

## 12. Collectibility and presentation

Collecting supports both strategy and visual expression:

- New Traders encourage different deck choices.
- New card designs offer alternative tactics and tradeoffs.
- Extra copies help players make a strategy more consistent.
- Alternate art, foil, and animated editions provide collectible prestige.

Special finishes never change card effects or Hail Mary odds.

Keep the Lotería look through numbered cards, strong individual illustrations, bilingual titles where appropriate, and short caller verses. The personal tabla organizes the Trader, investments, Artifacts, hazards, and banked progress.

For the first prototype, there is **no separate caller deck**. Each player draws from their own constructed deck.

## 13. What the first playtest needs to answer

These numbers are starting hypotheses, not established balance.

Watch for:

- Whether investing for cash is worth delaying Prosperity.
- Whether players voluntarily help rivals even without candles for it.
- Whether hazards create decisions without causing long stalls.
- Whether hiring a Trader is worth a main action, and whether replacing one ever happens.
- Whether the Hail Mary feels exciting at both low and high deed counts.
- Whether the 40-card deck produces enough variety before someone wins.
- Whether Events feel like weather or like noise.
- Whether candles riding the deck (La Ofrenda) makes devotion feel like grace or like bad luck.
- Whether Devotion and Degen feel different to pilot, and whether either dominates.

Start with the two starter recipes. Build custom decks after the basic economy and turn structure feel good.