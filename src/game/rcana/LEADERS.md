# R-cana — Leaders, Hedge values, loss draws (prototype, 2026-10-15)

Three mechanics borrowed from the One Piece card game and tried against Version 1c in the simulator. All three are
flags in `DEFAULTS`, off by default; the table does not know about them yet. Strong bot against strong bot over
2,000–4,000 games per setting, table defaults otherwise (`--v1c --passLast 1 --traders 1 --actions 3`).

## Why One Piece

The One Piece TCG grew faster than any card game of its generation on four mechanical ideas, each of which maps onto
something R-cana half-has already:

| One Piece | What it does for the game | R-cana today | Prototype |
|---|---|---|---|
| **Leader card**: chosen before play, face up all game, sets the deck's colour, has one ability | Identity, a reason to build a deck, the chase card | The Querent is a scoreboard | `--leaders 1` |
| **Counter values**: every Character has a number you can throw from hand to defend | Hand is offense and defense at once; the opponent's turn is interactive without "instants" | Only Chains Hedge; three suits are dead on the opponent's turn | `--hedgeAny 1` |
| **Life cards**: each hit on your Leader gives you a card | Losing feeds you; attacking early has a price; games stay close | Liquidation draws; Profit losses do not | `--lossDraw 1` |
| **DON!!**: a separate resource deck, 2 a turn, attachable for +power | No resource screw; a tactile every-turn puzzle | Reserve burns a card from hand for ever | not tried (see below) |

## 1. Leaders (`--leaders 1`, `--la <key> --lb <key>`)

Each Trader sits as a cast character. The card is not in any deck. It has a **suit affinity** (that suit's pips give
+1 for its owner: this is the deck-building hook, a Leader wants its suit) and one ability.

| Key | Leader | Suit | Ability |
|---|---|---|---|
| `eugene` | Eugene, Pattern Prophet | Candles | Your Foretells cost no Favor. |
| `marisol` | Marisol, Investigator | Coins | At the start of your turn, if you hold fewer than five cards, draw one. |
| `gr80` | GR80, Monk | Cups | Whenever the opponent plays a Cup, you gain 1 Profit and 1 Favor. |
| `connor` | Connor, Demon | Chains | Whenever an Event resolves, gain 2 Profit into your Portfolio. |

The Queen and King versions of these characters stay in the court as they are; a Leader and a court card of the same
character coexist the way Luffy the Leader and Luffy the Character do.

**Results, 4,000 games, random distinct Leaders each game:**

| Leader | Wins | Worst matchup |
|---|---|---|
| Connor | 54% | — (wins 52–55% against each) |
| GR80 | 51% | 46% against Connor |
| Marisol | 50% | 46% against GR80 |
| Eugene | 46% | 45% against Connor and Marisol |

First seat 51%, 7.8 rounds (7.9 without Leaders). Every pairing sits inside 45–55%. The first draft had Eugene at 60%
(free Foretell **plus** 1 Profit per Omen: the bot Foretold every turn and the extra Profit compounded) and Marisol at 42%
(draw only under four cards, which the strong bot rarely was); this is the second draft.

What a Leader changes on the table: the strong bot Foretells 5.5 times a game instead of 2 (Eugene), plays 1.6 Chains
instead of 1.5 (Connor), and the Favor economy runs 20% warmer (GR80). Partner hires fall a little (5.1 from 5.4) because
the affinity bonus makes pips worth more relative to courts.

**Naming.** The eight one-shot cards are currently called *Trader cards*. If the Leader is the Trader you sit as, which
is the natural reading, the one-shots want a new name: **Plays** or **Moves** (`Stop-Loss`, `Margin Call` and the rest
are plays in the sporting sense, which suits the Hail Mary). The code keeps `type: 'trader'` for the one-shots and
`type: 'leader'` for Leaders until that is decided.

## 2. Hedge values (`--hedgeAny 1`)

Every pip has a Hedge value: Chains their rank; any other pip 1, or 2 from the 6 up. When a Chain targets you, you may
throw any pip from hand as a Hedge for its value. The strong bot weighs the harm prevented against the card's play value.

**Result:** nothing moved. Hedges 0.31 a game against 0.27; off-suit hedges 0.04 a game; seat balance and length
unchanged. The reason is upstream of the rule: **Chains are played 1.5 times a game.** With that little attacking, the
defender's options hardly matter. One Piece's Counter works because every turn is an attack; R-cana's interaction axis
is thin, and this is the real finding of the batch. Before Hedge values are worth anything, Chains need to be worth
playing more often (cheaper, or a Chains Leader with a stronger pull, or Front-run worth more than 1.3× its rank to
the bot). Kept as a flag for human play, where a player holding a 9 of Coins when the Demon swings will enjoy the choice
more than the bot does.

## 3. Loss draws (`--lossDraw 1`, `--lossDrawMin 3`)

Losing 3 or more Profit to a hostile Chain or to an Event draws a card. 0.7 draws a game; seat balance, game length and
the strong bot's edge over the naive bot (75–76%) unchanged. Cheap, invisible in the numbers, and it makes THE CRASH
sting less for the player who was already behind. Recommended as a rule, not a flag, if human play agrees.

## 4. All three together

Seat 52%, 7.6 rounds, Leader spread 43–58% in the first draft, now within the 46–54% above. Nothing interacts badly.

## Toward the deck-builder

The flags above run on the 1c shared deck, where the affinity bonus is the only thing a Leader "needs". The path to a
deck-building game is Version 2 (private Minor decks, shared Majors and Omen, `RULES-v2.md`, parked) plus Leaders, with
the One Piece colour rule: **your deck may hold only your Leader's suit and one other**, 40 cards, at most 2 of any
pip. That rule is what creates "I need this card for my deck", which is the whole commercial point of a Leader. A
Chains Leader wanting Cups for Favor, or a Cups Leader needing a few Chains to hunt a pass, is where the deck choices
live. The sim can test this today with `v2-sim.js` deck presets once Leaders are wired into `DuelGame`.

DON!! is the one idea not tried. Reserve burns a hand card for ever, so a poor opening hand stays poor. Two options:
(a) 1 Liquidity a turn arrives by itself, with Reserve as acceleration; (b) Liquidity becomes tokens that can be
**attached** to a Personality for +1 Yield while they sit there, which is the tactile DON puzzle (spend it on a Chain,
or stack it on Marisol?). (b) would also let Chains versus Personalities become a power comparison rather than a flat
Drawdown count, which is One Piece's other virtue: one number to compare.

## Cooperation and caprice

Two directions the author asked for, not yet prototyped:

**Cooperative play without losing the race.** The R-cana already has the two seeds of this, Cups (Share) and Copy
trade. Three ways to grow them:
- **Table Events.** Some Events hit the table, not a player, and are paid off jointly: THE REGULATOR demands 6 from the
  table; each Trader states what they will pay; if the total falls short both lose the full amount. A prisoner's
  dilemma every few rounds, with Favor as the memory of who paid.
- **A joint Hail Mary.** Both Traders may throw into the same pass; it lands for both or falls for both; the Chains
  that would intercept it have to come from a third party, which at two players means the Omen. At three or four
  players this is the alliance mechanic.
- **Favor as a shared pool that Our Lady draws on.** Her protection spends from whoever has it; the Trader with most
  Favor banks when she turns over. GR80's Leader ability (gain from the opponent's Cups) already makes sharing with
  him attractive to both sides.

**Caprice.** The Omen is already the market's whim once a round. To make it feel like a market rather than a
calendar: let the Omen sometimes turn over **twice** (a Major with a `volatile` keyword flips the next one at once), let
Markets have a hidden **duration** (a die on the card; the Market may end the turn it is read, or linger), and give
THE ORACLE and Foretell more to look at, because caprice is only fun when there is something to be done about it.
Insider Tip already has the right shape. The simulator cannot tell you whether this is fun, only whether it is fair.

## Running it

```bash
node tarot-sim.js --games 4000 --a strong --b strong --v1c --passLast 1 --traders 1 --actions 3 --leaders 1
node tarot-sim.js --games 2000 --a strong --b strong --v1c --passLast 1 --traders 1 --actions 3 --la connor --lb gr80
node tarot-sim.js --verbose --seed 5 --a strong --b strong --v1c --passLast 1 --traders 1 --actions 3 --leaders 1 --hedgeAny 1 --lossDraw 1
```

Code: `LEADERS`, `leaderById`, `hedgeValue` in `tarot.js`; `leaders`, `hedgeAny`, `lossDraw`, `lossDrawMin` in
`DEFAULTS`; `p.leader`, `leaderHook`, `hasForetell`, `hedgeValue` on the engine; `threatHarm`/`hedgeCardCost` in the
strong bot; `--leaders --la --lb --hedgeAny --lossDraw --lossDrawMin` in the sim, which now reports wins per Leader and
per matchup. The snapshot carries `leader` per player for the table when it is ready.
