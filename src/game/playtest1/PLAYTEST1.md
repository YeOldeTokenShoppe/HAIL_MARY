# RL80 R-cana — First Playtest Plan

A digital-first, Lotería-inspired collectible card game about building prosperity, surviving market disasters, and deciding when helping a rival is worth the sacrifice.

Players build their decks before the game. During play, they use Liquidity to fund investments, disrupt competitors, and help one another. Every player has one chance to invoke a Hail Mary, with better chances earned through cooperation.

## 1. Players and objective

Start with **3–4 players**.

The first player to bank **1,000 Prosperity or more** wins immediately.

Banked Prosperity cannot be spent, stolen, or lost. Liquidity and investments remain available for card effects to influence.

## 2. What each player brings

- A **40-card deck**.
- **One starting Trader**, placed face-up outside the deck.
- **Our Lady of Perpetual Profit**, the universal Hail Mary card, also outside the deck.

Decks may contain **up to three copies of the same card**, regardless of artwork or finish.

Each Trader has one modest ability. For this prototype, Traders have no health, attacks, switching, or supporting roster.

**Credibility is reserved for a later test.** The first version uses Liquidity, Prosperity, and Good Deeds.

## 3. The three resources

| Resource | Purpose | Presentation |
|---|---|---|
| **Liquidity** | Spend on cards, investments, and assistance | Coins or banknotes in denominations of 1, 5, and 10 |
| **Prosperity** | Progress toward the 1,000-point victory target | Banked cards and a visible total |
| **Good Deeds** | Improve your Hail Mary probability | Up to three illuminated candles |

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
- Help a rival.
- Pay to clear one of your hazards.
- Attempt your Hail Mary.
- Discard one card to draw one replacement.
- Pass.

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

## 7. Cooperation and Good Deeds

Earn one deed when you:

- Use a matching Remedy to clear a rival’s hazard.
- Spend your main action to give a rival **2 of your own Liquidity**.
- Resolve a card explicitly marked as a cooperative action.

Limits:

- Maximum **one deed per turn** and **three recorded deeds**.
- Clearing a hazard you caused earns no deed.
- Trades, repayments, and gifts conditional on receiving something in return earn no deed.
- One action earns at most one deed, even if it helps several players.

Players may discuss deals, but informal promises are not enforced by the game.

## 8. The Hail Mary

Every player gets **one attempt per game**. It replaces their main action.

| Recorded deeds | Success chance |
|---:|---:|
| 0 | 1/12 |
| 1 | 2/12 |
| 2 | 4/12 |
| 3 | 8/12 |

Each deed doubles the success chance, capped at **8/12**.

**Success:** clear all hazards affecting you and bank **200 Prosperity**.

**Failure:** gain nothing.

Either result consumes the attempt. Flip Our Lady’s card to show it has been used. A successful Hail Mary can win the game.

The digital interface displays the exact probability before the player commits. All collectible editions have identical odds.

## 9. Starting Trader choices

Choose one. These are outside the 40-card deck.

| Trader | Prototype ability |
|---|---|
| **El Unicornio** | Before your normal draw, inspect the top card of your deck. Leave it there or move it to the bottom. |
| **La Detective — Marisol** | Once per game, cancel a Rug Pull just played on you. The attacker still spends the card, cost, and action. |
| **El Monje** | When you earn a deed, collect 1 Liquidity. |
| **El Diablito — Connor** | When a hazard you play successfully enters a rival’s hazard area, collect 1 Liquidity. |
| **El Gato** | Once per game, at the start of your main action, discard one hazard affecting you for free. |
| **La Abuela** | Remedies you play cost 1 less Liquidity, minimum zero. |
| **La Celebridad** | When you bank Prosperity from an Asset or Progress card, you may pay 1 Liquidity to add 25 Prosperity. |

The Celebrity’s bonus does not apply to the Hail Mary.

## 10. Sample 40-card starter deck

This is one shared starter recipe for testing different Traders. The category quantities are not permanent deck-building requirements.

All costs below are paid in Liquidity when the card is played.

### Assets and progress — 18 cards

| Card | Copies | Cost | Effect |
|---|---:|---:|---|
| **Tech Stock** | 3 | 3 | Asset. Later sell for **5 Liquidity** or **100 Prosperity**. |
| **Meme Coin** | 3 | 2 | Asset. Later sell for **4 Liquidity** or **75 Prosperity**. |
| **The Moon** | 3 | 4 | Asset. Later sell for **7 Liquidity** or **150 Prosperity**. |
| **The Bull** | 3 | 2 | Progress. Bank **100 Prosperity**. |
| **Rocket** | 3 | 4 | Progress. Bank **200 Prosperity**. |
| **The Inheritance** | 3 | 0 | Choose **3 Liquidity** or **50 Prosperity**. Discard after taking cash; bank after taking Prosperity. |

For rules purposes, The Inheritance is a Progress card.

### Hazards — 6 cards

| Card | Copies | Cost | Effect |
|---|---:|---:|---|
| **The Bear** | 2 | 2 | Target rival cannot bank more than **75 Prosperity from a single Asset or Progress card**, including bonuses. Larger payouts cannot be chosen. |
| **Quantum Hack** | 2 | 2 | Disable target rival’s Trader ability until cleared. |
| **Rug Pull** | 2 | 3 | Target rival cannot sell Assets until cleared. |

These hazards do not prevent a Hail Mary attempt or reduce its payout. Rug Pull still allows direct Progress cards.

### Remedies — 8 cards

| Card | Copies | Cost | Effect |
|---|---:|---:|---|
| **The Bell** | 2 | 1 | Clear The Bear. |
| **Quantum Resistance** | 2 | 1 | Clear Quantum Hack. |
| **The Keys** | 2 | 1 | Clear Rug Pull. |
| **Miracle Tortilla** | 2 | 2 | Clear any one hazard. |

Each Remedy can help you or a rival. Only qualifying help to a rival earns a deed.

### Artifacts — 4 cards

| Card | Copies | Cost | Effect |
|---|---:|---:|---|
| **Sacred Heart** | 1 | 2 | Discard this equipped Artifact to cancel a hazard just played on you. |
| **The Halo** | 1 | 3 | While equipped, your Trader’s ability cannot be disabled. A Quantum Hack on you remains until cleared, but does nothing. |
| **X-Ray Glasses** | 1 | 2 | Once during your turn, inspect one randomly selected card in a rival’s hand. |
| **The Rosary Beads** | 1 | 2 | When you earn a deed, you may draw one card. |

A canceled hazard is discarded. Its player does not recover the cost or action.

### Cooperative actions — 4 cards

| Card | Copies | Cost | Effect |
|---|---:|---:|---|
| **The Rose** | 2 | 0 | Give a rival 2 Liquidity from your funds. Earn one deed, then draw one card. |
| **The Fountain** | 2 | 1 | You and one chosen rival each draw one card. Earn one deed. |

Discard these cards after resolving. You must have the required money to play The Rose.

**Deck total: 18 + 6 + 8 + 4 + 4 = 40 cards.**

This starter uses **19 distinct designs**. Including the chosen Trader and Our Lady, each player begins with **42 cards in total**.

## 11. Collectibility and presentation

Collecting supports both strategy and visual expression:

- New Traders encourage different deck choices.
- New card designs offer alternative tactics and tradeoffs.
- Extra copies help players make a strategy more consistent.
- Alternate art, foil, and animated editions provide collectible prestige.

Special finishes never change card effects or Hail Mary odds.

Keep the Lotería look through numbered cards, strong individual illustrations, bilingual titles where appropriate, and short caller verses. The personal tabla organizes the Trader, investments, Artifacts, hazards, and banked progress.

For the first prototype, there is **no separate caller deck**. Each player draws from their own constructed deck.

## 12. What the first playtest needs to answer

These numbers are starting hypotheses, not established balance.

Watch for:

- Whether investing for cash is worth delaying Prosperity.
- Whether players voluntarily help rivals.
- Whether hazards create decisions without causing long stalls.
- Whether Traders change choices without dominating results.
- Whether the Hail Mary feels exciting at both low and high deed counts.
- Whether the 40-card deck produces enough variety before someone wins.

Start with identical decks and different Traders. Test customized decks after the basic economy and turn structure feel good.