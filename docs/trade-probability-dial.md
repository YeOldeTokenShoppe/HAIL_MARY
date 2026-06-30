# Terminal Traders — The Probability Dial (Bayesian Mechanic)

> **Status: PARTLY BUILT (2026-06-29).** Full spec for one primitive in the library
> (see *trade-interaction-primitives.md* §2/§3) and the Bayesian scoring model behind it.
> Builds on Token Case Files (*trade-case-taxonomy.md*).
>
> **Already shipped:** the v1 dial — `ConfidenceVerdict.jsx`, a continuous `P(scam)`
> slider that commits a calibrated probability, Brier-scores it, and absorbs
> Believe/Abstain/Doubt (bucketed via `probabilityToVerdict` / `VERDICT_THRESHOLDS` in
> `GameOverlay.jsx`). A reveal screen exists (`RevealView`) showing ground truth + Brier.
>
> **Not built (the rest of this doc):** the Bayesian *process* (prior → per-card updating →
> posterior), per-card likelihood-ratio weights, the bias-detection layer, the
> normative-path reveal overlay, and the calibration/bias profile. Also unbuilt and
> independent of the dial: **decide→reveal content exposure** (the current reveal does not
> surface the unopened stations' content).

## One line

Replace the binary Believe / Abstain / Doubt buttons with a single **gauge** that the
player drags from a **prior** to a **posterior**, updating it as each piece of evidence
lands. The forecast becomes a *process*, and the Bayesian-correct path is the (hidden)
yardstick we grade against.

## Why this, over three buttons

- **It absorbs Believe / Abstain / Doubt into one axis.** Doubt is the low end, Believe the
  high end, **Abstain is the dead-center band** — sitting at 50% already locks in the
  guaranteed-mediocre score that "I won't commit" should cost. No separate Abstain button,
  strictly more expressive.
- **It makes Brier literal.** State `p = P(legitimate)`, truth is 0 or 1, loss `(p − outcome)²`.
  Honesty about uncertainty becomes the dominant strategy — the whole point of the game.
- **It teaches the skill that actually matters: updating.** Base rates + correct reaction to
  evidence. Most players anchor, overreact to vivid tells, and ignore priors. This mechanic
  trains the fix.

## The governing principle: **felt, not computed**

The player never sees a prior, a likelihood ratio, or posterior arithmetic. They drag a
needle and *experience* "this is damning, I'm sliding toward Doubt." **All Bayesian
machinery lives in the scoring and reveal layer, invisible during play.** Exposed math
turns a noir investigation into homework and kills the feel. This is non-negotiable.

---

## Play flow

1. **Set the prior.** Before opening any card, the player places the needle at a starting
   probability. We either hand them the base rate ("68% of tokens in this archetype have
   rugged → start near 32% legit") or make them estimate it first — base-rate *neglect* is
   one of the lessons, so making them set it is the harder, better mode.
2. **Open a card, move the needle.** Each Inquiry Card reveals evidence; the player drags
   the needle to a new posterior. A strong tell should swing it hard; a weak signal barely
   at all. The dial is a **running posterior** across their (up to) 3 cards.
3. **Commit.** The final needle position is the Brier-scored forecast.
4. **Reveal.** Unopened cards unlock *and* the normative Bayesian path is shown against the
   player's path (see *Reveal screen*).

The needle is **continuously draggable** (commit at any value), not five notches — updating
wants finer movement than notches allow. A 5-notch face is the optional beginner mode; the
continuous gauge is the real thing.

---

## Authoring model

Each case gains a thin Bayesian layer on top of its existing content:

- **Prior / base rate** — one number per case (or per archetype): `P(legitimate)` before any
  evidence. Drives the starting position and the base-rate-neglect check.
- **Diagnostic weight per card** — each Inquiry Card carries a **likelihood ratio**
  `LR = P(evidence | legit) / P(evidence | scam)`. `LR > 1` pushes toward legit, `< 1`
  toward scam, `≈ 1` is a non-decisive lens (a *false tell* — loud but uninformative).
- **Normative posterior** — computed, not authored: work in **log-odds**, where updating is
  just addition.

  ```
  logit(posterior) = logit(prior) + Σ log(LR_i)   over opened cards i
  ```

  In log-odds space each card contributes a **fixed step** = `log(LR_i)`. That's the elegant
  core: the Bayesian-correct update per card is a known constant, so the player's deviation
  from it per step *is* their bias signature.

- **Target is a band, not a point.** Author a tolerance (e.g. ±8% around the normative
  posterior) so "close enough" is generous. Never grade to 1%.
- **Correlation handled by hand.** Naive chaining assumes cards are independent; they aren't
  (two lenses can echo each other). Where two cards are correlated, author their *joint*
  weight rather than letting the LRs multiply naively.

---

## Scoring — two layers

- **Player-facing score (simple):** Brier on the committed posterior, `(p − outcome)²`,
  surfaced as a clean score. This is what ranks players. Abstain-at-50% scores 0.25 — the
  honest floor.
- **Hidden diagnostic (rich):** compare the player's *path* of needle moves to the normative
  per-card steps. This drives the reveal and the bias profile — it does **not** affect the
  leaderboard score (or it's a soft secondary metric), so players aren't punished for a
  right answer reached imperfectly. The diagnostic is teaching, not judgment.

## Bias detection

Per card, compare the player's move in log-odds, `Δplayer_i = logit(p_i) − logit(p_{i−1})`,
to the normative step `log(LR_i)`:

| Signature | Detection | Reveal message |
|---|---|---|
| **Base-rate neglect** | Prior set far from the given/known base rate, or final posterior ≈ pure-evidence with the prior effectively discarded | "You ignored that most of these rug — you judged the token as if it had no history." |
| **Overreaction** | `\|Δplayer_i\| ≫ \|log(LR_i)\|` on weak cards | "You swung hard on the sentiment lens, but it barely moves the truth." |
| **Conservatism / under-update** | `\|Δplayer_i\| ≪ \|log(LR_i)\|` on strong cards | "An on-chain card this damning should have moved you far more." |
| **Anti-Bayesian** | `sign(Δplayer_i) ≠ sign(log(LR_i))` | "This evidence points toward scam — you moved toward Believe." |
| **Confirmation** | All moves share one sign despite mixed-sign evidence; or the player avoids the lens most likely to disconfirm their lean | "Every look you took confirmed your first hunch. You never tried to break your own thesis." |

---

## Reveal screen

After commit, show the two paths over the same gauge track:

- The player's needle path (prior → each update → commit).
- The normative Bayesian path (faint, the "perfect updater").
- One headline diagnosis from the table above — the single biggest deviation, named.
- The unopened cards, with a one-line note on which would have moved the needle most
  ("the LP-lock card was the decisive one — and you never opened it").

The lesson lands as *"a perfect updater finishes at 82%; you committed 96% — you overreacted
to sentiment,"* not as a wrong/right stamp.

## The free byproduct: a calibration + bias profile

Because every answer is graded and every update is diagnosed, the player accrues:

- a **calibration curve** ("your 80%s come true 64% of the time — overconfident"), and
- a **bias profile** ("you chronically under-update on on-chain evidence").

That *is* the "Know Thyself" behavioral module (*trade-learning-modules.md*) — computed
across every case played, no separate build. It also becomes a better long-term progression
metric than a raw score and maps naturally to clearance tiers.

## UI / aesthetic

A **gauge with a needle**, not a flat slider — polygraph energy that belongs on the Liminal
Terminal workstation. The needle twitches as each card resolves; committing "locks" it with
a satisfying detent. On mobile, the continuous drag stays, with the 5-notch face
(*Strong Doubt / Lean Doubt / Coin Flip / Lean Believe / Strong Believe*) as the friendlier
default for new players.

## Open threads
- **Replace vs. augment:** recommendation is the dial *replaces* binary in Case Files, with
  the 5-notch version as the beginner face of the same control. Confirm before migrating the
  existing case schema.
- **Does the diagnostic touch the leaderboard?** Leaning no (keep ranking = pure Brier;
  diagnostics are teaching) — but a soft "updater rating" could be a second axis.
- **Authoring burden:** every card needs an LR. Consider a small rubric (decisive ±, strong ±,
  weak ±, false-tell ≈1) so authors pick from ~7 buckets instead of inventing numbers.
- **Prior delivery:** given base rate (easier) vs. player-estimated (teaches base-rate
  neglect). Possibly difficulty-gated — given early, estimated at higher clearance.
