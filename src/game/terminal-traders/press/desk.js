// THE DESK — who sits where, and the global line banks.
//
// Everything here is ARCHETYPE-AGNOSTIC and paid for once. An archetype
// authors claims; it never authors a word for Eugene or for an adviser's
// dispatch, so adding read #3 through #13 costs nothing on this axis.
//
// ~40 lines of prose, reused forever. That is the whole point of moving the
// four-character layer here instead of into the archetypes.

import { LANES, SEATS, SHAPES } from "./questions.js";

export const DESK = {
  [SEATS.BARRON]: {
    id: SEATS.BARRON, agentId: "Demon", station: "demon",
    name: "John Barron", role: "THE DEAL",
    blurb: "Brought it in. Gets paid if you fund it.",
  },
  [SEATS.MARISOL]: {
    id: SEATS.MARISOL, agentId: "Detective", station: "marisol",
    name: "Detective Marisol", role: "THE MONEY", lane: LANES.CHAIN,
    blurb: "Money movement, wallet ages, unlocks.",
  },
  [SEATS.GR80]: {
    id: SEATS.GR80, agentId: "Monk", station: "monk",
    name: "Saint GR80", role: "THE PAPERWORK", lane: LANES.RECORD,
    blurb: "What the documents actually say.",
  },
};

// Eugene is not spendable and never stamps a receipt. He reads the shape of
// the claim and points at whose lane it is — free, on every claim. His whole
// contribution is generated from the two enums below, so he needs no
// archetype prose, ever.
/**
 * What a lane is CALLED on screen. The enum is CHAIN / RECORD / SHAPE in code,
 * but "RECORD QUESTION" reads as an instruction to record something — noun or
 * verb, you can't tell ("is 'Record' a verb or noun here?" — author,
 * 2026-07-27). Player-facing copy uses a plain noun phrase and the band reads
 * as a sentence, so there is nothing to parse.
 */
export const LANE_LABEL = {
  [LANES.CHAIN]: "the money",
  [LANES.RECORD]: "the paperwork",
  [LANES.SHAPE]: "nobody's lane",
};

/** Who could settle this claim, if anyone. Null on a SHAPE claim. */
export function laneOwner(claim) {
  if (!claim || claim.lane === LANES.SHAPE) return null;
  return claim.lane === LANES.CHAIN ? DESK[SEATS.MARISOL] : DESK[SEATS.GR80];
}

/**
 * The whole band, as one sentence.
 *
 * IT MUST DESCRIBE THE CURRENT STATE, NOT THE LANE MAP. Naming the lane's owner
 * unconditionally told the player "only Detective Marisol can settle it" while
 * her tile read "already used" — an instruction to do something impossible, on
 * a claim where two interruptions were still in hand ("she's greyed out" —
 * author, 2026-07-27). Once her one use is gone the claim is functionally a
 * SHAPE claim, and the band has to say so, because that changes what you do:
 * press him, or let it go.
 */
export function laneSentence(claim, { spent = [] } = {}) {
  if (!claim) return "";
  if (claim.lane === LANES.SHAPE) return "NOBODY HERE CAN SETTLE THIS ONE — press him, or let it go";
  const who = laneOwner(claim);
  if (spent.includes(who.id)) {
    return `THIS ONE'S ${LANE_LABEL[claim.lane].toUpperCase()}, AND ${who.name.toUpperCase()} IS SPENT — press him, or let it go`;
  }
  return `THIS ONE'S ABOUT ${LANE_LABEL[claim.lane].toUpperCase()} — only ${who.name} can settle it`;
}

export const EUGENE = {
  id: "eugene", agentId: "RL80", station: "eugene",
  name: "Eugene", role: "THE READ",
  blurb: "Names the shape. Never has receipts.",
};

// What KIND of weakness this claim would have, if it has one. Never states
// whether it does — that would name the outcome before the reveal.
const SHAPE_READ = {
  [SHAPES.UNSOURCED]: [
    "Assertion. No origin on it.",
    "Somebody said this. He isn't saying who.",
    "That's a claim about a claim.",
  ],
  [SHAPES.POSITIONED]: [
    "He's in it. That's not nothing, it's just not evidence.",
    "Interested party. Worth remembering.",
    "He profits from you agreeing.",
  ],
  [SHAPES.SELECTIVE_WINDOW]: [
    "A number inside a window somebody chose.",
    "True over some period. Which one?",
    "That's a framing, not a fact.",
  ],
  [SHAPES.BORROWED_CREDIBILITY]: [
    "Somebody else's name is doing the work here.",
    "He's standing on a document.",
    "That's borrowed. The question is how far it reaches.",
  ],
  [SHAPES.UNFALSIFIABLE]: [
    "Nothing could count against that.",
    "Shaped so it can't be wrong.",
    "There's no version of this he'd take back.",
  ],
  [SHAPES.SURVIVORSHIP]: [
    "That's the ones that worked.",
    "Survivors only. Where are the rest?",
    "The sample picked itself.",
  ],
};

// EUGENE'S SECOND SENTENCE IS THE AGENDA, NOT THE LANE.
//
// It used to be a LANE_READ bank — "That one's onchain. Marisol can settle it."
// — which is word for word what the colour-coded band directly above him
// already says. Half his output restated the UI and the other half was an
// adjective, so he read as a character with no job: *"I still don't get
// Eugene's off-sides role"* (author, 2026-07-27), the third complaint about him
// in a day. Moving him twice never had a chance of fixing that.
//
// Now he reports HOW MUCH RUNWAY IS LEFT IN THIS LANE, which nothing else on
// the floor knows and which changes the decision the game is actually about:
// spend Marisol on this money question, or hold her for a better one. "Last
// one you'll get" and "three more coming" are different games.
const LANE_NOUN = {
  [LANES.CHAIN]: "money question",
  [LANES.RECORD]: "paperwork question",
};

const COUNT_WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
const countWord = (n) => COUNT_WORD[n] ?? String(n);

/**
 * What's still coming, in Eugene's voice. Pure in (claim, spent, remaining) —
 * `remaining` comes from pressRun.laneOutlook, which counts LANES ONLY and so
 * cannot leak the branch.
 */
export function eugeneAgenda(claim, { spent = [], remaining = 0 } = {}) {
  const owner = laneOwner(claim);

  // Nobody's lane. The useful question moves up a level: how much of the rest
  // of this pitch can be checked by anyone at all?
  if (!owner) {
    if (remaining === 0) return "Nobody settles that one, and there's nothing checkable left.";
    return `Nobody settles that one. ${countWord(remaining)} left that anybody could.`;
  }

  const noun = LANE_NOUN[claim.lane];
  const plural = remaining === 1 ? "" : "s";

  // You already burned the only person who could answer this lane. Saying so
  // is the band's job; Eugene's is to price what that cost you.
  if (spent.includes(owner.id)) {
    return remaining === 0
      ? `That was the last one, and ${owner.name} was already gone.`
      : `${countWord(remaining)} more ${noun}${plural} after this, and nobody left to send.`;
  }

  if (remaining === 0) return `Last ${noun} you'll get. Spend ${owner.name} now or don't.`;
  return `${countWord(remaining)} more ${noun}${plural} after this one.`;
}

/**
 * Eugene's free read: the SHAPE of the claim, then the agenda. Deterministic in
 * the claim so a replay is identical. `spent` and `remaining` come from the run
 * — see laneSentence for why state has to be threaded rather than assumed.
 */
export function eugeneRead(claim, { spent = [], remaining = 0, salt = 0 } = {}) {
  if (!claim) return "";
  const shape = SHAPE_READ[claim.shape] || ["Hm."];
  const pick = shape[(claim.id.length + salt) % shape.length];
  return `${pick} ${eugeneAgenda(claim, { spent, remaining })}`.trim();
}

// HOW HE CARRIES IT AFTER YOU'VE HAD A GO AT HIM.
//
// Delivered as an ASIDE before his next claim, so the pitch visibly changes
// shape as the room turns on him. Eighteen lines, archetype-agnostic, paid for
// once — a new archetype adds none. None of them names a fact, an outcome or a
// lane; they are posture only, so no line here can ever carry information the
// pressure score didn't already give you.
//
// He never apologises and never concedes. A salesman who folds is a different
// character, and a much less interesting one to have to read.
const BARRON_ASIDE = {
  backed: [
    "Check it again if you like. It'll say the same thing.",
    "Good. Ask me another one.",
    "That's what I like. Somebody who actually looks.",
    "You'll find I don't say things I can't stand behind.",
  ],
  rattled: [
    "I'm not sure what you think you found there.",
    "Alright. You want to do this the long way.",
    // NOTE: "records" and "paperwork" are forbidden here — RECORD is a lane and
    // THE PAPERWORK is GR80's role label, so either word in Barron's mouth
    // reads as him naming a lane. Pinned by an assertion.
    "That's a bookkeeping gap, not a business one.",
    "Show me a company with no loose ends. I'll wait.",
    "You can keep pulling threads. It's your afternoon.",
  ],
  cornered: [
    "You've made your mind up. Let me finish anyway.",
    "Everyone at this table has shipped something. Let's not pretend that's nothing.",
    "Fine — you want the version with every caveat in it? Here it is.",
    "I've watched people talk themselves out of the best deal of their career.",
    "Ask the next one. I'd rather you asked than sat there deciding quietly.",
  ],
};

/**
 * His aside for the claim about to be delivered, or "" while he's still
 * comfortable. Deterministic in (band, index) so a replay is identical.
 *
 * ROTATES ON THE CLAIM INDEX, not on anything about the claim. Keying it to
 * `claim.id.length` made two consecutive claims with same-length ids repeat the
 * line verbatim, which reads as a stuck component rather than a character.
 * Index rotation can't collide with itself.
 */
export function barronAside(band, claim, index = 0) {
  const bank = BARRON_ASIDE[band];
  if (!bank || !claim) return "";
  return bank[((index % bank.length) + bank.length) % bank.length];
}

// What an adviser says. Four results, two advisers — eight short lines that
// every archetype reuses. The FACTS come from the claim's authored receipt;
// these only frame the delivery.
const ADVISER_LINES = {
  [SEATS.MARISOL]: {
    dispatch: "Give me a second. I'll pull it.",
    found: "Here. Timestamped, and you can check it yourself.",
    partial: "Partial. That's as far as the chain goes.",
    nothing: "There's nothing to pull. No record of it anywhere.",
  },
  [SEATS.GR80]: {
    dispatch: "I have read it. One moment.",
    found: "It is in the document. Section and all.",
    partial: "The document says less than he does.",
    nothing: "Nothing on file. Not redacted — absent.",
  },
};

export function adviserLine(seat, result) {
  return ADVISER_LINES[seat]?.[result] ?? "";
}
