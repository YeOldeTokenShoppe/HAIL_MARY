// pressRun — the headless run CONTROLLER for THE PRESS.
//
// Pure. No React, no DOM, no imports from any component. Every transition is
// a function from state to state, so a whole session can be replayed
// headlessly in a sim script. The React layer (usePressRun) is a thin wrapper
// that holds one of these in useState; the presentation layer renders it.
//
// TWO INVARIANTS THAT ARE STRUCTURAL, NOT TUNED:
//
//   1. PRESSES is frozen at 3. Nothing ownable may read or write it. If you
//      ever find yourself wanting a card that grants a fourth press, that is
//      the design spiralling — say no.
//
//   2. resolvePress() and settle() take NO collection and NO loadout. The one
//      door the collection may ever open is a future
//      `availableQuestions(collection) -> Question[]` returning enum values.
//      CI should grep this directory for `collection` and find exactly that.

// Explicit .js extensions: scripts/verify-press-run.mjs imports this module
// directly under Node ESM, which will not resolve an extensionless specifier.
import { casePnl } from "../caseTable.js";
import { ANY, BACKING } from "./questions.js";

export const PRESSES = 3;
export const START_BOOK = 100;
export const STAKE = 25; // matches TABLE_RULES.stake — the validated sim value

export const PHASE = {
  FLOOR: "floor",             // characters advocating; presses are live
  ALLOCATION: "allocation",   // the call
  RESOLUTION: "resolution",   // truth + reactions
  AUTOPSY: "autopsy",         // what each chip actually was
};

/**
 * Resolve one press against the claim currently on the floor. Pure.
 *
 * `question` is ANY (the free generic press, three per session, always
 * available) or one of SHAPES.* (a sharper question — slice 3+, sourced from
 * an owned card). A sharper question buys AIM, never a fact:
 *
 *   - matched shape + SOFT backing  -> escalates: you get the number he hedged
 *   - matched shape + VIBES backing -> NAMED: monitor still black, but the
 *                                      hollowness is now classified
 *   - wrong shape                   -> a true, narrow, useless answer
 *
 * Slice 1 only ever passes ANY. The rest is authored but unreachable, which
 * is deliberate: it costs nothing today and makes slice 2 a one-day change.
 */
export function resolvePress(claim, question = ANY) {
  const generic = claim.press?.generic ?? { line: "", receipt: null };

  if (question === ANY) {
    return {
      claimId: claim.id,
      question,
      backing: claim.backing,
      line: generic.line,
      // The product moment: a VIBES claim returns no receipt, so the
      // character's monitor stays black while he keeps talking.
      receipt: claim.backing === BACKING.VIBES ? null : generic.receipt ?? null,
      named: null,
      wasted: false,
    };
  }

  const matched = question === claim.shape;

  if (!matched) {
    // Confident denial: a real, checkable, completely irrelevant answer.
    return {
      claimId: claim.id,
      question,
      backing: claim.backing,
      line: claim.press?.miss?.line ?? "No. Next.",
      receipt: claim.press?.miss?.receipt ?? null,
      named: null,
      wasted: true,
    };
  }

  if (claim.backing === BACKING.VIBES) {
    return {
      claimId: claim.id,
      question,
      backing: claim.backing,
      line: claim.press?.sharp?.line ?? generic.line,
      receipt: null, // still black — a sharp question cannot manufacture a fact
      named: claim.shape,
      wasted: false,
    };
  }

  return {
    claimId: claim.id,
    question,
    backing: claim.backing,
    line: claim.press?.sharp?.line ?? generic.line,
    receipt: claim.press?.sharp?.receipt ?? generic.receipt ?? null,
    named: null,
    wasted: false,
  };
}

/* ---------------------------------------------------------------------- */
/* the run                                                                 */
/* ---------------------------------------------------------------------- */

export function createRun(deal, { book = START_BOOK } = {}) {
  return {
    dealId: deal.id,
    phase: PHASE.FLOOR,
    claimIndex: 0,          // which claim is on the floor right now
    pressesLeft: PRESSES,
    chips: [],              // claims that have been spoken, in order
    outcomes: {},           // claimId -> resolvePress() result
    cardsSpent: [],         // card ids already played — one use each, no refunds
    book,
    call: null,             // { p, pnl } once allocated
    finished: false,
  };
}

export function currentClaim(run, deal) {
  return deal.claims[run.claimIndex] ?? null;
}

/** The speaker has finished a claim — it lands as a chip on the felt. */
export function landClaim(run, deal) {
  const claim = currentClaim(run, deal);
  if (!claim || run.phase !== PHASE.FLOOR) return run;
  if (run.chips.some((c) => c.id === claim.id)) return run;
  return { ...run, chips: [...run.chips, { id: claim.id, fact: claim.fact, spin: claim.spin }] };
}

/**
 * Press the claim currently on the floor. Live — this is only legal while
 * they're still talking, which is the entire point of the verb.
 * A press with no budget left, or off-floor, is a no-op (never an error).
 */
export function press(run, deal, question = ANY, cardId = null) {
  if (run.phase !== PHASE.FLOOR) return run;
  if (run.pressesLeft <= 0) return run;
  const claim = currentClaim(run, deal);
  if (!claim) return run;
  if (run.outcomes[claim.id]) return run;             // one press per claim
  if (cardId && run.cardsSpent.includes(cardId)) return run; // one use per card

  const outcome = resolvePress(claim, question);
  return {
    ...run,
    pressesLeft: run.pressesLeft - 1,
    // NO REFUND ON A MISS — and this is load-bearing, not an oversight.
    // caseKit.js:187 refunds a whiffed play because there the whiff was the
    // SHUFFLER's fault: you were dealt a card with no target. Here you chose
    // both the card and the moment, so a miss is your read being wrong. Refund
    // it and asking the wrong question becomes free, which collapses the whole
    // decision. This one rule is what makes cards an edge you can misuse.
    cardsSpent: cardId ? [...run.cardsSpent, cardId] : run.cardsSpent,
    outcomes: { ...run.outcomes, [claim.id]: { ...outcome, cardId } },
  };
}

/** Let the speaker move on. Not pressing is a real, forfeiting choice. */
export function advance(run, deal) {
  if (run.phase !== PHASE.FLOOR) return run;
  const landed = landClaim(run, deal);
  const next = landed.claimIndex + 1;
  if (next >= deal.claims.length) {
    return { ...landed, claimIndex: deal.claims.length - 1, phase: PHASE.ALLOCATION };
  }
  return { ...landed, claimIndex: next };
}

/** Skip straight to the call — legal at any time; you keep your unspent presses. */
export function callIt(run, deal) {
  if (run.phase !== PHASE.FLOOR) return run;
  return { ...landClaim(run, deal), phase: PHASE.ALLOCATION };
}

/* ---------------------------------------------------------------------- */
/* the call                                                                */
/* ---------------------------------------------------------------------- */

// ONE SLIDER, FIXED STAKE. `v` runs -100 (hardest SHORT) .. +100 (hardest
// LONG); 0 is FLAT.
//
// DESIGN NOTE — this is a correction to the plan, made while writing the math.
// The plan said "magnitude = size", i.e. couple the stake to conviction. Worked
// out, that coupling is NOT a proper scoring rule: with stake = S|u| and
// p = (1-u)/2, expected P&L is maximised at u = -4d/3 where honest reporting is
// u = -d. It pays you 4/3 of your true conviction — it literally rewards
// overconfidence, which is the one thing this game exists to punish.
//
// Fixed stake with the plain Brier-affine payout is proper AND still reads as
// "sizing", because conviction already scales the payout on its own:
//   right at 0.9 -> +0.96·S     right at 0.6 -> +0.36·S
//   wrong at 0.9 -> -2.24·S     wrong at 0.6 -> -0.44·S
// So sliding further still means risking more. You just can't game it.
// (This is also what CASE_TABLE.md §4.3 originally said: "the slider is the
// whole bet — no separate stake input." It was right the first time.)

export function sliderToP(v) {
  const u = Math.max(-100, Math.min(100, v)) / 100;
  return 0.5 * (1 - u); // +100 -> p=0 (LONG), -100 -> p=1 (SHORT), 0 -> 0.5
}

export function allocate(run, deal, v) {
  if (run.phase !== PHASE.ALLOCATION) return run;
  const p = sliderToP(v);
  const pnl = casePnl(p, deal.truth, STAKE);
  return {
    ...run,
    call: { v, p, pnl, direction: v === 0 ? "FLAT" : v < 0 ? "SHORT" : "LONG" },
    book: run.book + pnl,
    phase: PHASE.RESOLUTION,
  };
}

export function toAutopsy(run) {
  if (run.phase !== PHASE.RESOLUTION) return run;
  return { ...run, phase: PHASE.AUTOPSY, finished: true };
}

/* ---------------------------------------------------------------------- */
/* readouts                                                                */
/* ---------------------------------------------------------------------- */

// Plain language, no finance literacy required, no visible math. The loss
// line is stated up front because the whole lesson is that being confident
// and wrong is expensive.
export function callReadout(v) {
  const p = sliderToP(v);
  const pct = Math.round(p * 100);
  if (v === 0) return { saying: "You're passing on this one.", risk: "You win nothing and lose nothing." };

  const strength =
    pct >= 85 || pct <= 15 ? "almost certainly"
      : pct >= 70 || pct <= 30 ? "probably"
        : "leaning";
  const saying = p > 0.5
    ? `You're saying: this is ${strength} a rug.`
    : `You're saying: this is ${strength} real.`;

  const win = casePnl(p, p > 0.5 ? 1 : 0, STAKE);
  const lose = casePnl(p, p > 0.5 ? 0 : 1, STAKE);
  return {
    saying,
    risk: `Right, you make ${Math.round(win)}. Wrong, you lose ${Math.abs(Math.round(lose))}.`,
  };
}

// READ — did you spend presses on the claims that were hollow? Scored on the
// press decisions alone, entirely separately from P&L, so a lucky call can
// never look like good judgement.
export function readScore(run, deal) {
  const spent = Object.keys(run.outcomes);
  if (spent.length === 0) return { hit: 0, spent: 0, hollow: 0, note: "You took all six on faith." };
  const hollow = deal.claims.filter((c) => c.backing === BACKING.VIBES).length;
  const hit = spent.filter((id) => {
    const c = deal.claims.find((x) => x.id === id);
    return c && c.backing !== BACKING.HARD; // SOFT or VIBES — you found give
  }).length;
  return {
    hit,
    spent: spent.length,
    hollow,
    note: `${hit} of your ${spent.length} press${spent.length === 1 ? "" : "es"} landed on a claim that couldn't be backed.`,
  };
}
