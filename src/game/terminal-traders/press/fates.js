// WHAT BECAME OF A DEAL WHOSE CLAIMS HELD UP — VC_GAME.md §7 item 7, `[A§16]`.
//
// THE BUG THIS FIXES, and it was in the narration rather than the kernel.
// `truth: 0` reads as "legit", and every archetype's legit RESOLUTION said the
// project was still running or still paying — so `legit` quietly came to mean
// SUCCEEDED, and the only way to lose money in this game was to be cheated.
// That is false about the world (*author, 2026-07-28: "we may only have a 1/10
// hit rate on projects, but they'll fail for different reasons, not just
// because they're legit or not"*), and it made §1's headline sentence
// aspirational: **"a good decision and a bad outcome are not the same mistake"**
// was printed at the top of the spec and could not happen. Now it can.
//
// NOTHING ABOUT SCORING CHANGES, AND THAT IS THE POINT. A fate is narration.
// `deal.truth` is untouched, `casePnl` is untouched, and a legit deal that fails
// STILL PAYS THE FUND CALL — because the player was asked whether the claims
// held, and they held. §7: *say that out loud; the gap IS the lesson.*
// `settlementNote()` in pressRun.js is where it gets said.
//
// WHICH FAILURES BELONG HERE, and it is the SAME TEST that keeps them out of a
// bad branch (§4, decided 2026-08-03): **could a specialist at that desk have
// found it before you called?** If yes, it is a claim and it belongs in an
// archetype. If no, it belongs here. Marisol can tell you whether the money
// moved as claimed and GR80 what the audit covered; nobody at that desk can
// tell you whether the market will show up, whether a competitor is coming, or
// whether two founders will stop liking each other. `[A§16]`.
//
// So the played-out premise — rejected as an archetype twice — lives here, and
// this is the only place it was ever allowed to live. It is `quiet` below.
//
// DO NOT MAKE 1/10 THE ACTUAL RATE. Real VC survives its hit rate through
// asymmetric payoffs, and power-law payoffs end properness (invariant 2). The
// failure share below is a NARRATIVE frequency over the legit branch only; it
// changes no base rate and no expected P&L. It is set where the lesson lands
// often enough to be learned and rarely enough that funding still reads as the
// right move on a deal that checks out.
//
// A FATE REPORTS; IT NEVER DRAWS THE LESSON. Two of these originally ended on a
// line like "nobody at that desk could have told you" — which is `settlementNote`'s
// sentence, arriving one paragraph early and then again a moment later. The split
// is strict: **the fate says what happened to the venture, the note says why the
// number disagrees with it.** Nothing here may mention the call, the score, the
// claims or the desk.
//
// ARCHETYPE-AGNOSTIC, ON PURPOSE — the `desk.js` discipline. An archetype
// authors claims and never a word here, so archetypes 5–13 cost nothing on this
// axis. Every line has to read correctly after a fork, a yield vault, an
// anonymous team and a vesting schedule, which is why none of them names a
// product, a mechanism or a kind of business.

import { mulberry32 } from "../caseTable.js";

/**
 * Mixed into the seed so the fate rides its own stream.
 *
 * The same reasoning as `PITCHER_SALT` in pitchers.js: instanceDeal's rolls come
 * off one mulberry32 sequence in a fixed order, so an extra draw shifts every
 * roll after it and the same seed stops producing the same deal — a `?seed=`
 * link, a sim or a bug report would quietly describe a different game. A
 * separate stream costs one line and cannot disturb the sequence it is not part
 * of. It also makes the independence STRUCTURAL: this roll cannot see the
 * archetype or the branch, because it is not handed either.
 */
const FATE_SALT = 0x2b7e1516;

/**
 * `failed: false` is the common case and needs no explaining. The rest are the
 * four §7 names — ran out of runway, out-competed, team split, market never
 * showed — and each one is a thing NOBODY AT THAT DESK COULD HAVE CHECKED.
 *
 * Weights are over the LEGIT branch only. 70/30 in favour of surviving: a
 * player meets "right call, dead company" roughly one deal in seven across the
 * whole game, which is often enough to learn from and far from the 1-in-10
 * survival rate §7 explicitly forbids modelling.
 */
export const FATES = [
  { id: "standing", failed: false, weight: 30, line: (name) => `${name} is still running.` },
  { id: "boring", failed: false, weight: 22, line: (name) => `${name} is still running, and dull, which here are the same word.` },
  { id: "smaller", failed: false, weight: 18, line: (name) => `${name} is still there — smaller than the pitch, and still there.` },

  {
    id: "runway", failed: true, weight: 8,
    line: (name) => `${name} shipped for another year and then quietly ran out of money. `
      + `The people who wanted it arrived slower than the money left.`,
  },
  {
    id: "outcompeted", failed: true, weight: 8,
    line: (name) => `${name} did everything it said it would. Something else did the same thing eight months later for less, `
      + `and almost everyone moved across inside a fortnight. Being right and being first are different jobs.`,
  },
  {
    id: "split", failed: true, weight: 7,
    line: (name) => `${name} lost two of the three people running it inside a year — not to a scandal, to each other. `
      + `The one who stayed kept the lights on for another eight months, and then turned them off.`,
  },
  {
    id: "quiet", failed: true, weight: 7,
    line: (name) => `${name} still works. It always worked. Almost nobody ever came — the volume never arrived, `
      + `and it faded out somewhere in its second year with the contracts still running and the lights still on.`,
  },
];

const TOTAL = FATES.reduce((s, f) => s + f.weight, 0);

/**
 * Roll what became of it. Deterministic in the seed, on its own stream.
 *
 * TAKES A SEED AND NOTHING ELSE. There is deliberately no way to hand this an
 * archetype, a branch or a deal — the same argument list discipline as
 * `rollPitcher`, and for the same reason: a fate that could see the branch would
 * be a leak the moment anything rendered it early.
 */
export function rollFate(seed) {
  const r = mulberry32((seed ^ FATE_SALT) >>> 0)() * TOTAL;
  let acc = 0;
  for (const f of FATES) { acc += f.weight; if (r < acc) return f; }
  return FATES[0];
}

/** The sentence that goes after the archetype's own line. */
export function fateLine(fate, name) {
  return (fate ?? FATES[0]).line(name);
}
