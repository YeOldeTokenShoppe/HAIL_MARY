# R-cana — current game overview

**Current playable edition: Version 1c with prototypes enabled · Updated October 15, 2026**

R-cana is a two-player race to bank 80 Profit, played with a shared tarot-style deck. You build a small Network of earning partners, turn cards into spending power, and decide how much money to leave exposed to earn more. A shared Omen changes the conditions each round. Generosity helps your opponent but earns you cards and protection; attacks punish exposed money and working partners. A last-play Hail Mary can keep a losing player in the game.

This describes the initial settings on `/rcana`, including the new mechanics you can play today. It is a playtest edition, not a claim that balance or naming is final. See [the complete rules](RULES-v1c.md) for timing and all card effects, and [the research notes](LEADERS.md) for historical simulations and future proposals.

## The central decision

**Bank now for safety, or keep Profit exposed for growth?** Banked Profit is permanent and counts toward winning. Your exposed Portfolio earns a Dividend bonus, but Chains and Events can take it away. You normally bank at the start of your turn, so money earned during the main phase must survive until then unless you use a special banking card.

Example without modifiers: start with 9 in your Portfolio, receive the Dividend of 1, then a bonus of 2 for the 10 now exposed. You have 12 to bank or risk. The bonus is calculated after the Dividend arrives.

## What you manage

| Resource or zone | Its job |
|---|---|
| Bank | Safe score. Reach 80 to win, except while a Hail Mary stops the clock. |
| Portfolio | Exposed earnings. Fuels growth and can be stolen or lost. |
| Reserve / Liquidity | Once each turn, permanently reserve a hand card. Each reserved card supplies 1 reusable Liquidity per turn to pay costs. |
| Network | Up to two Personalities. Hire them, then Trade with them for earnings. Trading exposes them to attacks. |
| Favor | Earned through Cups and certain abilities. Pays for Foretell and automatic protection from qualifying Events. |
| Hand | Cards compete for three uses: play them, reserve them, or keep eligible pips for defense. |
| Leader | A permanent character with a suit bonus and an ability. Uses no Network slot. |

The shared middle of the table holds the decks, the current Market, available Invokes in Providence, and discards. The last Event is a record of something that already happened.

## Setup and the turn loop

The deck has **88 cards**: 22 Majors, 56 Minors (40 pips and 16 Personalities), and eight Trader moves/reactions. Leaders are separate. Both players draw eight cards; the second player starts with 8 exposed Profit. Both draw on their first turn.

At the start of each round, reveal one shared **Omen**. A Market changes ongoing conditions, an Event resolves immediately, or an Invoke waits in Providence for either player to buy and use.

On your turn:

1. **Refresh and collect.** Ready your Reserve and partners; resolve start-of-turn abilities and any surviving pass. Receive your Dividend and bonus, then choose how much to bank (or throw an eligible Hail Mary).
2. **Draw one card.**
3. **Take up to three main actions.** Hire a partner, Trade, Copy trade an opponent's Trading partner, play a pip or Trader move, or use an Invoke. Costs still apply. You may also Reserve once and Foretell once without spending an action.
4. **End your turn.** Keep useful defensive cards for the opponent's attacks.

Partners normally cannot Trade on the turn they arrive; Fast partners can. Copy trade costs 1 Liquidity, gives you the copied earnings, gives the opponent 1 Profit, and is limited to once per turn. It does not award Favor in 1c.

## The four suits

| Suit | Main purpose |
|---|---|
| Coins | Earn Profit directly. |
| Candles | Put an eligible idle partner to Trade with extra earnings. |
| Chains | Attack a Trading partner, steal exposed Profit, or intercept a pass. Also your strongest Hedge cards. |
| Cups | Give both players Profit; you also draw a card and gain Favor. |

Pips normally cost half their rank, rounded up. Cups cost one less, to a minimum of zero. Markets, partners, and Leaders can modify their effects.

## The new playable mechanics

**Leaders.** Each has +1 to its own suit's pip effect, plus the ability below. The Cups bonus benefits the owner; the Chains bonus boosts attack, not Hedge value. Leader and Personality versions of the same character can coexist and their bonuses stack.

| Leader | Suit | Ability |
|---|---|---|
| Eugene, Pattern Prophet | Candles | Foretell costs no Favor. |
| Marisol, Investigator | Coins | At the start of your turn, draw one if your hand has fewer than five cards. |
| GR80, Monk | Cups | When your opponent plays Cups, gain 1 Profit and 1 Favor. |
| Connor, Demon | Chains | When an Event resolves, gain 2 Profit. |

**All-suit Hedges.** Against a Chain, discard one pip for free to reduce the attack: Chains absorb their rank; other suits absorb 1 at ranks Ace–5 or 2 at ranks 6–10. Personalities and Trader cards are not Hedges. Margin Call cannot be Hedged.

**Draw after a loss.** If a hostile Chain or Event actually removes at least 3 Profit from your Portfolio, draw one card. Check the loss after protection: a fully stopped loss or Stop-Loss reducing it to 2 does not qualify. Losing a pass or damage to a partner does not itself trigger this rule; Liquidation has its own card draw.

## Protection and the comeback

With at least 2 Favor, Our Lady automatically spends 2 to prevent an Event that would remove at least 3 Portfolio Profit or bring down your pass. This protection does not stop Chains. Trader reaction cards provide additional defenses.

The default **last-play Hail Mary** is available once per game, instead of start-of-turn banking, when the opponent could bank to 80 next turn and you cannot already win by banking. Throw your entire positive Portfolio. Nobody wins at 80 while a pass is in the air. If yours survives until your next turn, it banks doubled; an interception or certain Events can destroy it. The Fool Invoke lets you throw early.

When all passes resolve, the clock resumes and the larger qualifying Bank wins. At the Final Bell (The Reckoning or the last Major), finish the round, return any airborne stakes to Portfolio undoubled, and compare Banks, then Portfolios; a full tie is a draw.

## What to evaluate now

Open Table settings before pressing **Deal**. The initial 1c setup enables Leaders, all-suit Hedges, loss draws, Trader cards, three actions, and the last-play Hail Mary with a ×2 payout. You can switch these off to compare; rule changes apply to a new Deal. Table size changes immediately and does not alter the rules.

For a first game, leave the coach on and focus on three questions: Is the bank-versus-growth choice interesting? Do the three actions force useful choices? Do defense and the Hail Mary feel like opportunities to respond? Then compare Leaders and check whether each makes you play differently. Review and Table history help inspect what happened.

## What is not part of this edition

Private constructed decks, Leader suit restrictions, a separate automatic resource deck, attachable resources, joint Hail Marys, shared Favor, cooperative Event payments, and variable Omen timing are **future ideas**, not rules in the current 1c table. Version 2 is a separate parked experiment. Historical bot results in the research notes are evidence about those specific runs, not validation of the current human experience.
