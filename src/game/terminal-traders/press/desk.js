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
    name: "Detective Marisol", role: "CHAIN", lane: LANES.CHAIN,
    blurb: "Money movement, wallet ages, unlocks.",
  },
  [SEATS.GR80]: {
    id: SEATS.GR80, agentId: "Monk", station: "monk",
    name: "Saint GR80", role: "RECORD", lane: LANES.RECORD,
    blurb: "What the documents actually say.",
  },
};

// Eugene is not spendable and never stamps a receipt. He reads the shape of
// the claim and points at whose lane it is — free, on every claim. His whole
// contribution is generated from the two enums below, so he needs no
// archetype prose, ever.
export const EUGENE = {
  id: "eugene", agentId: "RL80", station: "eugene",
  name: "Eugene", role: "SHAPE",
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

const LANE_READ = {
  [LANES.CHAIN]: ["That one's onchain — Marisol's.", "Money question. Marisol can settle it."],
  [LANES.RECORD]: ["That's paper. GR80's lane.", "Somebody has to read the document. GR80."],
  [LANES.SHAPE]: ["Nobody here can settle that one.", "No receipts exist for that. It's a judgement."],
};

/** Eugene's free read. Deterministic in the claim so a replay is identical. */
export function eugeneRead(claim, salt = 0) {
  if (!claim) return "";
  const pick = (arr, n) => arr[(claim.id.length + n + salt) % arr.length];
  return `${pick(SHAPE_READ[claim.shape] || ["Hm."], 0)} ${pick(LANE_READ[claim.lane] || [""], 1)}`.trim();
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
