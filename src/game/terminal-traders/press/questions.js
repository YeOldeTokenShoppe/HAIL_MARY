// THE QUESTION VOCABULARY — the game owns this, cards do not.
//
// Design order matters here and is deliberate (author, 2026-07-26: "the cards
// can be changed — don't design to fit the current cards"). The game defines
// the shapes a claim can be weak in; a card is later NAMED and PAINTED onto a
// shape. Never the reverse. Nothing in this directory may import from cards.js.
//
// A claim's SHAPE is the way its inference is weak — not the way its fact is
// wrong. Every FACT in a deal sheet is true. The SPIN is what's being sold.

export const SHAPES = {
  // "who actually says so?" — an assertion with no traceable origin
  UNSOURCED: "UNSOURCED",
  // "are you holding this?" — the speaker benefits from you believing it
  POSITIONED: "POSITIONED",
  // "over what period?" — true inside a window chosen because it's flattering
  SELECTIVE_WINDOW: "SELECTIVE_WINDOW",
  // "clean within what scope?" — leaning on someone else's authority, past
  // the edge of what that authority actually examined
  BORROWED_CREDIBILITY: "BORROWED_CREDIBILITY",
  // "what would change your mind?" — shaped so no evidence could dent it
  UNFALSIFIABLE: "UNFALSIFIABLE",
  // "and the ones that didn't work?" — the sample quietly excludes its failures
  SURVIVORSHIP: "SURVIVORSHIP",
};

// The free move. Always available, three times, forever. A cardless player
// has the complete game; sharper questions only ever buy AIM, never a fact.
export const ANY = "ANY";

// How well a speaker can back a claim when pressed. This is about what they
// can PRODUCE, not about whether the underlying fact is true — a speaker can
// state a true fact and still have nothing when you ask them to source it.
export const BACKING = {
  HARD: "HARD",   // number + source + the caveat they hadn't volunteered
  SOFT: "SOFT",   // a range and an honest hedge
  VIBES: "VIBES", // louder, faster, still no number — the monitor stays black
};

export const SHAPE_LIST = Object.values(SHAPES);

/* ------------------------------------------------------------------------ *
 * SEATS AND LANES — the four-character layer (2026-07-27)
 *
 * Cards were cut. The three verbs a card format promised — choose, commit,
 * forfeit — are supplied by the room instead, at no content cost, and they
 * make all four characters load-bearing during PLAY rather than only at the
 * curtain call.
 *
 * Barron pitches and can be pressed as often as the budget allows. Marisol
 * and GR80 each answer ONE claim per session, in their own lane. Eugene is
 * free and automatic and never stamps a receipt — he names the shape and
 * whose lane it falls in.
 *
 * The decision is materiality and timing: GR80 has three valid targets in a
 * backdoor-fork and one use, and the agenda rail shows you what's still
 * coming. Spend him on the audit and you can never have him on the wind-down.
 * ------------------------------------------------------------------------ */

export const LANES = {
  CHAIN: "CHAIN",   // money movement, wallet ages, unlocks — Marisol
  RECORD: "RECORD", // documents: audit scope, references, post-mortems — GR80
  SHAPE: "SHAPE",   // neither adviser can settle it; Barron and Eugene only
};

export const SEATS = {
  BARRON: "barron",
  MARISOL: "marisol",
  GR80: "gr80",
};

/** Which lane each spendable adviser can be sent into. Barron has no lane —
 *  he's always available, which is what keeps the verdict reachable for free. */
export const SEAT_LANE = {
  [SEATS.MARISOL]: LANES.CHAIN,
  [SEATS.GR80]: LANES.RECORD,
};

export const SPENDABLE_SEATS = [SEATS.MARISOL, SEATS.GR80];

/** Legal only when the adviser's lane matches the claim's. An illegal send is
 *  a NO-OP, never an error and never a penalty — you can't misclick away a
 *  session, you can only fail to spend well. */
export function canSend(seat, claim) {
  if (seat === SEATS.BARRON) return true;
  const lane = SEAT_LANE[seat];
  return !!lane && !!claim && claim.lane === lane;
}

export function isShape(v) {
  return v === ANY || SHAPE_LIST.includes(v);
}
