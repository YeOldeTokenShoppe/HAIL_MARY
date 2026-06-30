# Terminal Traders — Interaction Primitives

> **Status: PROPOSAL (2026-06-29).** Architectural backbone for the learning-modules
> roadmap (see *trade-learning-modules.md*). Defines the small, reusable vocabulary of
> interactions that every module composes from. **Built today:** Inquiry Cards
> (choose-3-of-16) and a v1 of the Probability Dial (`ConfidenceVerdict.jsx` — continuous
> P(scam) + Brier, absorbing Believe/Abstain/Doubt). Everything else is proposal.

## Why a primitive library

The current game has **one** interaction (pick lenses, render a verdict) doing two
incompatible jobs — *judgment* (scarcity is the point) and *instruction* (you want the
player exposed to all the content). Overloading one primitive is why 13 of 16 authored
questions evaporate per case.

The fix is the Brilliant.org lesson: don't build one mechanic, build **~6 reusable
primitives**, each tied to a skill, and let a case or module compose 2–3 of them. Texture
without a minigame grab-bag — because every primitive is load-bearing for the forecasting
spine.

**Selection rule:** a primitive earns its place by the *skill* it trains, never by novelty.
A jigsaw is not "a fun minigame" — it is graph reconstruction, which *is* Follow the Money.

## Two invariants every primitive obeys

1. **Decide → Reveal.** The player commits under scarcity/uncertainty; *then* the full
   content unlocks as a scored debrief. The cost of not looking is the lesson. No authored
   content is ever wasted — it's gated behind the commit, not behind the choice.
2. **Proper scoring.** Continuous answers use a proper scoring rule (Brier / interval
   score) so honesty about uncertainty is always the dominant strategy. **Abstain stays a
   legitimate, sometimes-optimal move.**

## Three kinds of "teaching" — keep them separate

- **Mechanic tutorial** — how the control works. Shown *just-in-time*, the first time a
  primitive ever appears, ~10 seconds, then never again. **Un-scored.**
- **Content reveal** — what the evidence meant. Shown *after commit*. **Un-scored.**
- **The decision** — the only thing that is **scored**.

There is deliberately **no upfront "read the lesson" module** before case files — that
rebuilds the textbook we're escaping. Domain content is discovered inside the case and
cemented at the reveal; only the *mechanic* is ever taught before the player acts.

---

## The primitives

### 1. Inquiry Cards  *(choose-N-of-M)*  — **BUILT**
- **What:** A set of costly questions; the player may open only N (today: 3 of up to 16).
  On commit, the unopened cards unlock as the debrief.
- **Skill:** Information triage — deciding *what is decisive* when you can't check
  everything. The signature judgment mechanic; do not dilute it.
- **Modules:** Token Case Files, Contract Autopsy (which behaviors to probe), Will It
  Make It? (which statements to pull).
- **Scoring:** Brier on the final verdict. The reveal is teaching, not scored.
- **First-time scaffold:** "You have 3 looks. Spend them on what will move your call."

### 2. Probability Dial  *(calibration slider)*  — **v1 BUILT** (`ConfidenceVerdict.jsx`); Bayesian layer proposed (see *trade-probability-dial.md*)
- **What:** Instead of a discrete Believe/Doubt, set a **%** (or a confidence interval).
- **Skill:** Calibration — owning uncertainty, learning what your "70%" actually means.
- **Modules:** The Range (pure calibration), Trade the Surprise, any case wanting a
  graded answer rather than a binary.
- **Scoring:** Brier for a point %; interval score for a range. Visual feedback at reveal
  shows where the truth fell relative to the stated confidence.
- **First-time scaffold:** one resolved example showing how a confident-and-wrong answer
  is punished harder than a hedged one.

### 3. Parameter Sliders  *(direct manipulation / sensitivity)*  — **the Brilliant move**
- **What:** Manipulate one or more inputs and watch an outcome update *live*, then commit a
  prediction about it.
- **Skill:** Mechanism intuition and sensitivity — feeling how an output moves with an input.
- **Modules:** Perps "Right and Liquidated" (leverage/funding → liquidation price),
  Gambler's Ruin (bet size → ruin probability over N rounds), Nickels & Steamrollers
  (position → tail payoff), Unlock Cliffs (vesting → circulating float).
- **Scoring:** Score the *prediction* the manipulation leads to (e.g. "set leverage, now
  predict whether this position survives the wick"), not the fiddling.
- **First-time scaffold:** a free, consequence-free drag so the player sees the linkage
  before anything is scored.

### 4. Fragment Assembly  *(jigsaw / graph build)*
- **What:** Reconstruct a structure from scattered pieces — a fund-flow graph, a wallet
  cluster, a cap table, an event timeline.
- **Skill:** Synthesis — seeing the whole that the fragments imply.
- **Modules:** Follow the Money (rebuild the transaction graph), Sybil Lineup (cluster the
  wallets), Will It Make It? (assemble the balance sheet).
- **Scoring:** Structural correctness (edges/links placed right) **plus** the downstream
  call the assembled structure enables (e.g. "now that it's built — exit, or organic?").
- **First-time scaffold:** snap the first two pieces for the player to show the interaction.

### 5. Timeline Scrub  *(sequencing)*  — **partly designed (Rug Replay)**
- **What:** Order events, or scrub a known timeline and predict the next beat at each pause.
- **Skill:** Temporal reasoning — turning hindsight into foresight; reading warning signs in
  order.
- **Modules:** Rug Replay, Mania Replay.
- **Scoring:** Next-move prediction at each checkpoint; the settled outcome makes every
  replay self-verifying.
- **First-time scaffold:** one auto-played beat before handing over the scrubber.

### 6. Sort / Rank  *(odd-one-out)*
- **What:** Order a set by some criterion, or pick the outlier.
- **Skill:** Relative judgment — faster and distinct from absolute Believe/Doubt.
- **Modules:** Lineup.
- **Scoring:** Rank correlation, or pick accuracy for odd-one-out.
- **First-time scaffold:** a two-item warmup sort.

### 7. Crowd Guess  *(advanced — needs a crowd mechanic)*
- **What:** Answer relative to what *other players* answer (e.g. ⅔-of-the-average).
- **Skill:** Second-order / strategic reasoning — predicting people, not ground truth.
- **Modules:** Beauty Contest.
- **Scoring:** Distance from the crowd-derived target. **No static answer key** — the crowd
  is the puzzle.
- **Infra note:** the only primitive that breaks the single-player, answer-key model. Can
  be sourced live, by asynchronous aggregate, or from a frozen distribution (see
  *trade-learning-modules.md*). Flagged as the heaviest lift; everything 1–6 stays
  single-player.

---

## How a module composes primitives

A module is a short recipe, not a new engine:

- **Token Case Files** = Inquiry Cards → (verdict) → reveal.
- **Follow the Money** = Fragment Assembly (build the graph) → Inquiry Cards (probe two
  nodes) → Probability Dial (exit likelihood) → reveal.
- **Perps "Right and Liquidated"** = Parameter Sliders (set the position) → Timeline Scrub
  (ride the candles) → did-it-survive scoring.
- **Gambler's Ruin** = Parameter Sliders (bet size) → repeated rounds → survival scoring.

Reusing six primitives across a dozen modules is what keeps the build tractable *and* the
product coherent.

## Open threads
- A primitive needs a uniform **scaffold-once** flag per player (first-appearance teaching,
  then suppressed) — likely a profile-level set of "primitives seen."
- Difficulty ramp: which knobs fade with rising Brier (lens hints, # hidden cards, tell
  loudness) and how that maps to clearance tiers.
- Whether the Probability Dial should *replace* binary Believe/Doubt in Case Files or live
  alongside it as a harder mode.
