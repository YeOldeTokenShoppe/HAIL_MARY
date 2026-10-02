# RL80 R-cana — Version 1c: The Omen

Version 1b (Favor and Network) with the Majors taken out of the draw pile, free Hedges, a capped Hail Mary and partner replacement. This document lists only what differs from `RULES-v1b.md`; everything else is unchanged from 1b and, before it, `RULES-v1.md`.

## Why

An outside review of Version 1 found three things the table had also shown. A Major drawn during a turn hit the two players in very different spots: the drawer had just banked, the other player's earnings were still exposed. Defence was too expensive to prepare, so almost nobody ever Hedged (one game in twenty). And an uncapped Hail Mary could make a whole game hinge on one throw. Version 1c answers each.

## The Omen

The 22 Majors are their own deck. The Minor deck holds only the 56 Minors, so drawing a card never reveals a Major.

At the start of every round, before the first Trader does anything, the face-down **Omen** on top of the Major deck is turned over and resolves for both players at once: a Market replaces the standing Market, an Event happens, an Invoke waits in Providence. The next Major then lies face down as the new Omen. Both players meet every Event with whatever they left exposed at the end of their last turn.

**Foretell** (1 Favor, free with Virgil, once per turn) looks at the Omen. You may send it to the bottom of the Major deck; the next Major becomes the Omen.

THE ORACLE reveals the top three Majors. THE RECKONING is buried in the bottom half of the Major deck if more than ten Majors remain. If the Minor deck runs out, the Minor discards are shuffled into a new deck.

## Hedging is free

When a Chain targets your Trading Personality, your Portfolio or your pass, you may play one Chain from your hand as a Hedge. It costs no Liquidity. The card is spent and you do not draw a replacement. It absorbs its rank; whatever is left gets through.

## The Hail Mary stake is capped

A Hail Mary Pass throws at most **20** into the air. Any Profit beyond that stays in your Portfolio, exposed as usual. You still need at least 10 in your Portfolio to throw, and throwing still replaces banking that turn.

## Replacing a partner

With two Personalities already in your Network, you may still partner with a new one by letting one of the two go. Pay the new card's full cost. The departing Personality's departure effects apply (an Exit Scam costs you its Profit).

## Favor

Favor comes from **Sharing only**: each upright Cups you play earns 1 Favor. Copy trades no longer earn Favor. Our Lady's protection (2 Favor, automatic) applies only when an Event would take **3 or more** Profit from your Portfolio, or would bring down your pass; smaller losses are simply taken.

## Setup and seat balance

Shuffle the Minors and the Majors separately. Each Trader draws **eight** Minors, and both draw on their first turn. The second Trader opens with **8 Profit** in their Portfolio: going second means meeting every Omen a turn later, and eight is the number of this world. Turn the first Major face down as the Omen. The first Omen turns over at the start of round one, before the first Trader's turn.

## Ending

The first Bank to reach 80 wins at once. The game also ends after the round in which THE RECKONING tolls, or when the last Major has been revealed, with the largest Bank winning and ties going to the larger Portfolio.

## Tuning notes

Strong bot against strong bot over 2,000 games: first seat wins 50%, games last about 7 rounds, and THE RECKONING never ended a game (the Majors are revealed one per round, so about seven are seen). A Hedge is played about once every two games, up from once in twenty under Version 1. Each player partners with about 2.5 Personalities a game (replacements included), copy trades 1.3 times and earns about 2.2 Favor. The strong bot beats the naive bot 59% of the time.

Seat balance was the delicate part. Revealing the Omen at round start with an immediate win at 80 gave the first seat 58% with eight cards each; playing out the round instead gave the second seat 64%. A Reserve chip for the second seat overshot (40% for the first seat), two Favor did too little (56%), seven cards for the first Trader balanced but broke the rule of eights. The second Trader opening with 8 Profit, both drawing on their first turn, balanced at 50% and keeps every number an eight: eight cards, 8 Profit, 80 to win. Playing out the round with the first Trader on nine cards also balanced (48%) and is kept as an option (`--finish 1 --firstHand -1 --first 1`).
