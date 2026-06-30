# Terminal Traders — Learning Modules Roadmap

> **Status: PROPOSAL (2026-06-29).** Design lineup only. Nothing here is built.
> The shipped product today is **Token Case Files** (see *trade-case-taxonomy.md*).
> This doc maps the expansion: more crypto modules, then the pivot **beyond crypto**
> into general investing & economics. Each module lists the **interaction primitives**
> it composes from — defined in *trade-interaction-primitives.md*; the Probability Dial
> has its own deep spec in *trade-probability-dial.md*.

## The spine every module shares

Whatever the subject, a module is the same three beats the game is already built on:

1. **Read a real artifact** — authentic evidence, not a text recap.
2. **Make a probabilistic call** — via the **Probability Dial** (which absorbs
   Believe / Abstain / Doubt into one gauge), or a ranking.
3. **Get Brier-scored** — calibration is the currency; Abstain is a legitimate move.

That spine is what lets the project leave crypto without losing its identity.

## The design rule (how we keep these from going textbook)

**Teach each field through its counterintuitive core, not its 101 surface.**
Don't build "candlestick patterns." Build the lesson that makes a smart person go
*"huh — I had that backwards."* The unusual is the product. Every module below is
chosen for the lesson that *stings*, and the working title is part of the design.

---

## Track 1 — Crypto (extend the Fraud Unit)

Same detective frame as Case Files, but vary the **artifact** and the **format** so
the verb stops being just "judge one token."

- **Follow the Money** — start on one wallet, trace funds outward, call whether the
  trail ends in an exit/CEX dump or disperses organically. Trains graph-reading and
  attribution. The most literally noir module — it's a stakeout.
  *Primitives: Fragment Assembly (build the flow graph) → Inquiry Cards (probe nodes) → Probability Dial (exit likelihood).*
- **Contract Autopsy** — read a contract's *behavior* (honeypot, hidden mint,
  blacklist, transfer tax), surfaced as evidence cards, and answer one brutal
  question: *can you actually sell?*
  *Primitives: Inquiry Cards (which behaviors to probe) → Probability Dial (can-you-sell).*
- **Order Flow / Whale Watch** — market microstructure: is this volume real or
  wash-traded? Read liquidity depth, round-trip trades, bot cadence.
  *Primitives: Inquiry Cards → Probability Dial (real vs. wash).*
- **Unlock Cliffs** — pure tokenomics. Vesting + unlock calendar; predict what
  happens at the cliff. The thing that kills tokens *on a known date*.
  *Primitives: Parameter Sliders (vesting → circulating float) → Probability Dial (cliff outcome).*
- **Sybil Lineup** — given a cluster of wallets, decide: many people, or one actor
  in masks? Trains the clustering instinct under everything else.
  *Primitives: Fragment Assembly (cluster the wallets) → Probability Dial (one actor or many).*
- **Perps → "Right and Liquidated"** — the trap isn't direction, it's *survival*.
  Be correct on the thesis and still get carried out as funding bleeds you and
  leverage turns a temporary drawdown into a permanent one. **Score survival, not
  whether the call was right.** A perp is a bet on *timing*, not direction.
  *Primitives: Parameter Sliders (set the position) → Timeline Scrub (ride the candles) → did-it-survive scoring.*

### Formats that re-skin any content
- **Rug Replay** — a *known* blowup played forward on a timeline scrubber; pause and
  predict the next move. Self-verifying because the outcome is settled.
  *Primitives: Timeline Scrub → Probability Dial (next-move call at each pause).*
- **Lineup / Odd One Out** — N tokens side by side; pick the fake or rank by survival
  odds. Relative judgment is a faster, different muscle than absolute Believe/Doubt.
  *Primitives: Sort / Rank.*
- **Live Wire** — a token launching *right now*, calls made as data streams.
  Dovetails with the conference-call "live" view on the mobile roadmap.
  *Primitives: Inquiry Cards (streaming) → Timeline Scrub → Probability Dial.*

---

## Track 2 — Beyond crypto (general investing & economics)

The expansion. Each is the counterintuitive core of its field, dressed in the same
forecasting-under-uncertainty clothes.

### Risk management → **"Gambler's Ruin"**
Skip diversification platitudes. Teach **ergodicity**: the coin flip paying
+50% / −40% has positive expected value and *still ruins you* if you keep playing it.
Score the player on **surviving N rounds**, not on profit. Time-average vs.
ensemble-average is genuinely unusual — almost no retail product touches it.
*The deepest module on the list; the one people screenshot and argue about.*
*Primitives: Parameter Sliders (bet size / leverage) → repeated rounds → survival scoring.*

### Game theory → **"Beauty Contest"**
Not prisoner's dilemma. The Keynesian beauty contest / "guess ⅔ of the average" —
you're not judging value, you're judging what others will judge. It's *the* market
game, it ties straight into the crowd/forecasting mechanic, and it works **live
against other players** (leans on the conference-call infra). Schelling points and
common-knowledge bank-run coordination are natural follow-ons.
*Primitives: Crowd Guess (the one primitive that needs a crowd — no static answer key).*

### Technical analysis → **"Signal or Noise"**
The honest, slightly subversive version: intermix real charts with **random walks**
and ask the player to tell which is which — or to spot the "head and shoulders" in
pure noise. Teaches apophenia and overfitting *by making the player fail at it.*
Teaches TA and its limits in the same module.
*Primitives: Sort / Rank (pick the real chart) → Probability Dial (confidence it's signal).*

### Macro → **"Trade the Surprise"**
Markets move on the *gap from expectations*, not the number. Show a CPI/jobs print
plus consensus; have the player predict the **reaction**, not the data. Trains
expectations-vs-reality — the real skill, almost never taught to retail.
*Primitives: Probability Dial (direction/magnitude of the reaction).*

### Volatility / options → **"Nickels & Steamrollers"**
Short-vol feels like free money until it doesn't. Sell options, collect premium,
feel great — then meet the tail. Teaches vol as *the price of surprise* and the
asymmetry of picking up nickels in front of a steamroller. No Greeks soup required.
*Primitives: Parameter Sliders (set the short-vol position) → Timeline Scrub (meet the tail).*

### Behavioral finance → **"Know Thyself"**
The unusual artifact is *the player's own track record*. Score them on disposition
effect (riding losers, cutting winners), overconfidence, recency. The mirror is the
lesson. Fits a TIER-3 clearance self-audit you unlock.
*Primitives: none new — it's the **byproduct** of the Probability Dial's hidden diagnostic
layer (calibration curve + bias profile), computed across every case played. See
trade-probability-dial.md §"The free byproduct."*

### Bubbles → **"Mania Replay"**
The Rug Replay engine pointed at TradFi history — tulips, 1929, dot-com, '08. Scrub
forward from inside the bubble and forecast the next leg. Self-verifying, and reuses
tech we'd already build. *Can you spot a top from inside it?*
*Primitives: Timeline Scrub → Probability Dial (next-leg call) — same recipe as Rug Replay.*

### Credit → **"Will It Make It?"**
Balance-sheet forensics: read a company or a bond and forecast default. The detective
frame transfers cleanly from token fraud to corporate distress — same Fraud Unit
energy, new evidence cards.
*Primitives: Fragment Assembly (assemble the balance sheet) → Inquiry Cards → Probability Dial (default likelihood).*

### Auctions → **"Winner's Curse"**
You won the bid *because* you overpaid. Bidding games teach this faster through
losing than any lecture can.
*Primitives: Parameter Sliders (set your bid) → reveal. Possible new primitive — a sealed Bid input — if the slider feels wrong for auctions.*

### The one that justifies the whole pivot → **Prophet proper (superforecasting)**
Tetlock-style real-world econ/geopolitical questions, pure Brier scoring, resolving
against reality over time. The literal generalization of the project — the name is
already pointing at it. Everything else becomes a **training range**; this is live fire.
*Primitives: Inquiry Cards (research the question) → Probability Dial (pure calibrated forecast).*

---

## Suggested build order

Modules sequence into a curriculum — clearance tiers, in the terminal's language:

1. **The Range** (calibration warmup) → learn what a probability *is*
2. **Token Case Files** (shipped) → single-artifact judgment
3. **Follow the Money / Contract Autopsy** → specialist artifact-reading
4. **Rug Replay / Mania Replay** → sequencing and hindsight
5. **Live Wire / Prophet proper** → synthesis under real uncertainty

Modules unlock as Brier improves — fits the "TIER-3 CLEARANCE" panel on the terminal.

## First two to prototype

- **Beauty Contest** — best fit for the live/multiplayer view and the crowd mechanic.
- **Gambler's Ruin** — the most intellectually distinctive thing on the list.

## Open threads
- Each non-crypto module needs an **evidence-artifact** spec (the "authentic on-chain
  artifact" rule generalized — e.g. a real macro print + consensus, a real balance
  sheet, a real-vs-random chart generator).
- Decide how non-crypto modules map to the four lenses (monk/demon/marisol/eugene) or
  whether they introduce new ones.
