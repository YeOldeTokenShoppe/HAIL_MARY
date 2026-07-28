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
import { BACKING, LANES, SEATS, SEAT_LANE, SPENDABLE_SEATS, canSend } from "./questions.js";
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
 * TWO KINDS OF INTERRUPTION, one budget:
 *
 *   BARRON — always legal, reusable. Returns his authored `generic` block. A
 *   VIBES claim returns no receipt, so his board stays black: the free press
 *   is enough to reach every verdict (truth is never for sale) but it only
 *   ever gets what he'd concede about himself.
 *
 *   AN ADVISER — legal only in their own lane, and ONCE PER SESSION. Someone
 *   who is not him goes and looks, so the answer lands on THEIR board:
 *     - the claim's authored `sharp` receipt, if there is one
 *     - NOTHING ON FILE, if there isn't
 *   Then Barron reacts with his authored `sharp` line. Not one word of
 *   archetype prose was written for this — the same blocks that used to be a
 *   card's payoff are now a colleague's.
 *
 * NOTHING ON FILE is deliberately not the same event as a black board. A
 * black board is Barron declining to produce. An empty file is an independent
 * party having looked and found an absence — strictly stronger, and it is the
 * only way the game can prove a negative.
 */
export function resolvePress(claim, seat = SEATS.BARRON) {
  if (!claim) return null;

  if (seat === SEATS.BARRON) {
    const g = claim.press?.generic ?? { line: "", receipt: null };
    return {
      claimId: claim.id, seat, board: SEATS.BARRON,
      backing: claim.backing,
      adviserSays: null,
      barronSays: g.line,
      receipt: claim.backing === BACKING.VIBES ? null : g.receipt ?? null,
      nothingOnFile: false,
    };
  }

  // Off-lane sends never reach here — press() rejects them as a no-op — but
  // resolvePress is exported and sim-callable, so it holds the line itself.
  if (!canSend(seat, claim)) return null;

  const sharp = claim.press?.sharp ?? {};
  const receipt = sharp.receipt ?? null;
  const result = receipt ? (receipt.partial ? "partial" : "found") : "nothing";

  return {
    claimId: claim.id, seat, board: seat,
    backing: claim.backing,
    adviserSays: adviserLine(seat, result),
    barronSays: sharp.line ?? claim.press?.generic?.line ?? "",
    receipt,
    nothingOnFile: !receipt,
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
export function press(run, deal, seat = SEATS.BARRON) {
  if (run.phase !== PHASE.FLOOR) return run;
  if (run.pressesLeft <= 0) return run;
  const claim = currentClaim(run, deal);
  if (!claim) return run;
  if (run.outcomes[claim.id]) return run;                    // one per claim
  if (!canSend(seat, claim)) return run;                     // off-lane: no-op
  if (seat !== SEATS.BARRON && run.advisersSpent.includes(seat)) return run;

  const outcome = resolvePress(claim, seat);
  if (!outcome) return run;

  return {
    ...run,
    pressesLeft: run.pressesLeft - 1,
    // Sending an adviser costs an interruption AND the adviser. Two resources
    // for one action is what makes the timing decision real — you can be out
    // of GR80 long before you're out of interruptions.
    advisersSpent: seat === SEATS.BARRON ? run.advisersSpent : [...run.advisersSpent, seat],
    outcomes: { ...run.outcomes, [claim.id]: outcome },
  };
}

/**
 * WHAT IS STILL COMING IN THIS LANE. Eugene's job, and the only piece of
 * information on the floor that nobody else supplies.
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

/** Who can legally be sent at the claim on the floor right now, and why not. */
export function seatOptions(run, deal) {
  const claim = currentClaim(run, deal);
  const done = !!(claim && run.outcomes[claim.id]);
  const broke = run.pressesLeft <= 0;
  return [SEATS.BARRON, ...SPENDABLE_SEATS].map((seat) => {
    const spent = seat !== SEATS.BARRON && run.advisersSpent.includes(seat);
    const offLane = !canSend(seat, claim);
    return {
      seat,
      enabled: !done && !broke && !spent && !offLane,
      reason: broke ? "out" : done ? "answered" : spent ? "spent" : offLane ? "off-lane" : null,
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
