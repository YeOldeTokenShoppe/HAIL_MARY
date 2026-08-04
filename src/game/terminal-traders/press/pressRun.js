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
import { BACKING, LANES, PITCHER, SEATS, SEAT_LANE, SPENDABLE_SEATS, inLane } from "./questions.js";
import { adviserLine } from "./desk.js";

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
 * Resolve one interruption. Pure.
 *
 * ONE BUDGET, FOUR SEATS, AND THE LANE DECIDES DEPTH — NOT LEGALITY.
 * Any seat can be sent at any claim. In their lane you get the specialist
 * finding; outside it you get a true, shallow answer that mostly settles
 * nothing. The PITCHER is unlimited within the budget (it's the one selling, so
 * it's always in the room); all four seats are one use each.
 *
 * THE PITCHER OWNS NO LANE, so pressing it is always the shallow `generic`
 * block. That is what makes it free: you can always go back to the seller, and
 * you will always get the version that stops short of the question.
 *
 * NOTHING ON FILE is deliberately not the same event as a black board. A black
 * board is someone declining, or unable, to produce. An empty file is an
 * independent specialist having LOOKED and found an absence — strictly
 * stronger, and the only way this game can prove a negative. It therefore
 * requires both that you asked somebody who isn't the pitcher AND that it was
 * their area; a shallow look finding nothing means only that you asked the wrong
 * person, which is a fact about your choice, not about the deal.
 */
export function resolvePress(claim, seat = PITCHER) {
  if (!claim) return null;

  // DEPTH, NOT PERMISSION. In their lane you get the `sharp` block — the
  // specialist finding, with the caveat the speaker hadn't volunteered. Outside
  // it you get `generic`: true, shallow, and mostly unable to settle anything.
  // Both already existed on every slot, which is why the gradient model cost no
  // archetype prose at all.
  const deep = inLane(seat, claim);
  const block = (deep ? claim.press?.sharp : claim.press?.generic) ?? { line: "", receipt: null };

  // VIBES means nobody can produce anything on this claim, specialist or not.
  // That's a property of the CLAIM, not of who you sent, which is why it
  // survived the lane rework untouched: it's the honest home for "no receipt
  // exists" now that every lane has an owner.
  const receipt = claim.backing === BACKING.VIBES ? null : block.receipt ?? null;
  const result = receipt ? (receipt.partial ? "partial" : "found") : "nothing";

  return {
    claimId: claim.id, seat, board: seat, deep,
    backing: claim.backing,
    // The pitcher answers under its own name in the panel, so it gets no second
    // voice. Every SEAT reports first — they're the one who went and looked,
    // Barron included now that he is a plain specialist.
    adviserSays: seat === PITCHER ? null : adviserLine(seat, result, deep),
    // Historical field name: this is whatever the PITCHER says. On a seat press
    // it is the pitcher's reaction to the finding, which is why it is still
    // populated for every seat — see the TWO VOICES PER PRESS note in
    // PressSession.jsx / PressFlat.jsx, which own that ordering.
    barronSays: block.line ?? "",
    receipt,
    // NOTHING ON FILE is an independent party having LOOKED and found an
    // absence — strictly stronger than a board simply staying dark, and the
    // only way this game can prove a negative. It needs someone who actually
    // looked, so it can't be the pitcher (which is also never `deep`), and it
    // needs the deep look to mean anything.
    nothingOnFile: seat !== PITCHER && deep && !receipt,
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
    // Advisers are the scarce resource, not cards. One use each, all session.
    // This is the whole decision: GR80 has three valid targets in a
    // backdoor-fork and one use, and the agenda rail tells you what's coming.
    advisersSpent: [],
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
export function press(run, deal, seat = PITCHER) {
  if (run.phase !== PHASE.FLOOR) return run;
  if (run.pressesLeft <= 0) return run;
  const claim = currentClaim(run, deal);
  if (!claim) return run;
  if (run.outcomes[claim.id]) return run;                    // one per claim
  // No lane check: every seat can be asked about every claim. The only refusals
  // left are the two real resources — the budget, and each colleague's one use.
  if (seat !== PITCHER && run.advisersSpent.includes(seat)) return run;

  const outcome = resolvePress(claim, seat);
  if (!outcome) return run;

  return {
    ...run,
    pressesLeft: run.pressesLeft - 1,
    // Asking a seat costs an interruption AND that seat. Two resources for one
    // action is what makes the timing decision real — you can be out of GR80
    // long before you're out of interruptions. Pressing the pitcher costs only
    // the interruption, which is what keeps every verdict reachable.
    advisersSpent: seat === PITCHER ? run.advisersSpent : [...run.advisersSpent, seat],
    outcomes: { ...run.outcomes, [claim.id]: outcome },
  };
}

/**
 * WHAT IS STILL COMING IN THIS LANE. Virgil's job (it was Eugene's until the
 * read moved to the cat), and the only piece of information on the floor that
 * nobody else supplies.
 *
 * The core decision this game claims to be about is *which claim inside a lane
 * deserves the one use* — and until this existed you made it BLIND. Sending
 * Marisol on the first money question you saw was indistinguishable from
 * sending her on the best one, because you had no idea whether a better one was
 * coming. That's not a decision, it's a coin flip with extra steps.
 *
 * LEAK-FREE BY CONSTRUCTION. It counts LANES ONLY — never backing, never
 * `discriminates`, never the branch. Lanes are public from second zero by
 * design (see VC_GAME.md §3), so this tells you how much runway you have and
 * nothing whatsoever about who's lying.
 *
 * On a SHAPE claim — nobody's lane — it reports how many settleable claims are
 * left instead, which is the same question one level up.
 */
export function laneOutlook(run, deal) {
  const claim = currentClaim(run, deal);
  if (!claim) return { lane: null, remaining: 0 };
  const later = deal.claims.slice(run.claimIndex + 1);
  const remaining = claim.lane === LANES.SHAPE
    ? later.filter((c) => c.lane !== LANES.SHAPE).length
    : later.filter((c) => c.lane === claim.lane).length;
  return { lane: claim.lane, remaining };
}

/* ---------------------------------------------------------------------- */
/* pressure — how the pitch is going FOR HIM                               */
/* ---------------------------------------------------------------------- */

export const PRESSURE = {
  COOL: "cool",          // nothing has happened to him yet
  BACKED: "backed",      // you checked and he held up — he gets to enjoy that
  RATTLED: "rattled",    // one or two things didn't land
  CORNERED: "cornered",  // he is selling into a room that has stopped believing him
};

/**
 * WHAT THE ROOM HAS DONE TO HIM SO FAR.
 *
 * The session used to have no arc: six claims of equal weight, and Barron
 * delivered the sixth exactly as he delivered the first no matter what you had
 * caught him doing. He is a rigged, voiced character in a room — a tape
 * recorder was a waste of the only asset this page has.
 *
 * Weighted, because the ways of not-answering are not equal:
 *
 *   NOTHING ON FILE  +2  an independent party looked and found an absence.
 *                        Nothing else on the floor is this bad for him.
 *   black board      +1  he declined to produce. Damning, but deniable —
 *                        "I don't have it in front of me" is a real sentence.
 *   partial          +1  the document says less than he does.
 *   a real receipt   -1  you checked him and he held up, and he gets to enjoy
 *                        that. Without this, pressing is pure downside for him
 *                        and the smart play is to never let you check anything.
 *
 * IT CANNOT LEAK. Every input is an outcome you have ALREADY SEEN — it reads
 * `run.outcomes` and nothing else, never `deal.truth`, never the branch, never
 * `discriminates`. It is a summary of your own findings handed back to you, in
 * the same way showing your own score is not a leak. A harness assertion pins
 * that two deals with opposite outcomes and identical outcome-sets produce
 * identical pressure.
 *
 * (It will still CORRELATE with truth — a legit deal yields fewer catches. That
 * correlation is information you earned, not information you were given.)
 */
export function pressure(run) {
  let score = 0, caught = 0, backed = 0;
  for (const o of Object.values(run.outcomes || {})) {
    if (o.nothingOnFile) { score += 2; caught += 1; }
    else if (!o.receipt) { score += 1; caught += 1; }
    else if (o.receipt.partial) { score += 1; caught += 1; }
    else { score -= 1; backed += 1; }
  }
  const band = score >= 3 ? PRESSURE.CORNERED
    : score >= 1 ? PRESSURE.RATTLED
      : score < 0 ? PRESSURE.BACKED
        : PRESSURE.COOL;
  return { score, band, caught, backed };
}

/**
 * Who you can send right now, and what you'd get.
 *
 * `enabled` no longer encodes the lane — every seat is live until it's spent or
 * the budget is gone. `deep` is what the UI shows instead: sending the wrong
 * specialist is a legal, sometimes correct, and always slightly disappointing
 * move, which is a far better thing for a button to communicate than "no".
 */
export function seatOptions(run, deal) {
  const claim = currentClaim(run, deal);
  const done = !!(claim && run.outcomes[claim.id]);
  const broke = run.pressesLeft <= 0;
  return [PITCHER, ...SPENDABLE_SEATS].map((seat) => {
    const spent = seat !== PITCHER && run.advisersSpent.includes(seat);
    return {
      seat,
      enabled: !done && !broke && !spent,
      deep: inLane(seat, claim),
      reason: broke ? "out" : done ? "answered" : spent ? "spent" : null,
      lane: SEAT_LANE[seat] ?? null,
    };
  });
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

  // COMES APART / HOLDS UP — the axis the resolver actually settles, no wider.
  // "Doesn't work out" was tried first and pulled back the same day: it is a
  // SUPERSET of what is modelled (it takes in an illiquid book and a played-out
  // premise, neither of which any archetype writes), and a superset in UI copy
  // invites a call the scoring will mark wrong — the file prints HOLDERS and
  // MCAP, so a player can reason "too thin to ever exit" and FUD an honest
  // project. [A§13]: copy cannot fix a mechanic mismatch. Widen this line when
  // an archetype exists whose bad branch is survival-neutral, not before.
  //
  // NOT "A RUG" EITHER (author, 2026-08-03). The bad branch is not always a theft:
  // yieldMirage's is a structure that could not work — "stopped paying... the
  // rest of the yield had been coming out of the deposits the whole time" —
  // and the failure space the game wants is wider still, including a sound
  // project that is illiquid, or one whose premise is simply played out.
  // Naming the downside "a rug" teaches the player that bad means FRAUD, which
  // is the read this game most wants to complicate. It also fixed a grammar
  // bug: the old template produced "this is leaning a rug".
  const sure =
    pct >= 85 || pct <= 15 ? "almost certain"
      : pct >= 70 || pct <= 30 ? "fairly sure"
        : "leaning";
  const saying = sure === "leaning"
    ? (p > 0.5 ? "You're leaning against this one." : "You're leaning toward this one.")
    : `You're ${sure} this one ${p > 0.5 ? "comes apart" : "holds up"}.`;

  const win = casePnl(p, p > 0.5 ? 1 : 0, STAKE);
  const lose = casePnl(p, p > 0.5 ? 0 : 1, STAKE);
  return {
    saying,
    risk: `Right, you make ${Math.round(win)}. Wrong, you lose ${Math.abs(Math.round(lose))}.`,
  };
}

// READ — did you spend your interruptions where the answer could have changed
// your mind?
//
// THIS REPLACED A METRIC THAT REWARDED FINDING DIRT. Scoring "how many hollow
// claims did you catch" teaches that the goal is to catch someone out, which
// is exactly the bias this game exists to correct: a good analyst who checks a
// genuinely clean audit has done their job. So the unit is COVERAGE OF
// DISCRIMINATING CLAIMS — the ones whose answer differs between a rug and an
// honest run. Pressing a clean-in-both-branches claim like backdoor-fork's
// `funding` scores nothing, however impressive it sounds; that is the lesson.
//
// AUTOPSY ONLY. `discriminates` is on the claim object because it's derived
// from authored data, but nothing on the FLOOR may read it — a harness
// assertion pins that no in-play payload exposes it, because showing it would
// name the outcome before the reveal.
export function coverageScore(run, deal) {
  const discriminating = deal.claims.filter((c) => c.discriminates);
  const covered = discriminating.filter((c) => !!run.outcomes[c.id]);
  const spent = Object.keys(run.outcomes).length;
  const wasted = spent - covered.length;

  const note = spent === 0
    ? "You took all of it on faith."
    : covered.length === 0
      ? `You asked ${spent}, and none of them could have changed your mind.`
      : `${covered.length} of your ${spent} landed where the answer actually differed.`;

  return {
    hit: covered.length,
    spent,
    wasted,
    available: discriminating.length,
    note,
  };
}

// Kept as an alias so the two presentations can be migrated one at a time
// rather than in the same commit as the controller.
export const readScore = coverageScore;
