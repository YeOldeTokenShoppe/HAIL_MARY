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
 * SEATS AND LANES — the four-character layer
 *
 * Cards were cut (2026-07-27). The three verbs a card format promised —
 * choose, commit, forfeit — are supplied by the room instead, at no content
 * cost, and they make all four characters load-bearing during PLAY rather than
 * only at the curtain call.
 *
 * EXPERTISE IS A GRADIENT, NOT A GATE (2026-07-28). The first cut made a lane
 * a permission: off-lane sends were rejected as no-ops, so two of the four
 * seats were greyed out on any given claim and the seat row read as a row of
 * broken buttons — the single most-reported confusion in playtest. Author's
 * reframing: *"they each have an area of expertise but can generalize too."*
 *
 * So: ANYONE CAN BE SENT AT ANYTHING. What the lane decides is DEPTH.
 *
 *   in-lane   -> the claim's `sharp` block: the specialist finding, with the
 *                caveat the speaker hadn't volunteered
 *   off-lane  -> the claim's `generic` block: a true, shallow answer that
 *                mostly fails to settle anything
 *
 * Both blocks already exist on every slot in every branch, so the entire
 * change cost ZERO new archetype prose. The decision stops being "who is
 * legal here" (which the UI could answer for you) and becomes "is this claim
 * worth my one specialist, or will a shallow look do" — which it can't.
 *
 * Four lanes, four seats, one each. Barron pitches and is unlimited within the
 * budget; the other three answer ONE claim per session each, so three
 * interruptions and three specialists is a genuinely tight allocation.
 * ------------------------------------------------------------------------ */

export const LANES = {
  CHAIN: "CHAIN",   // money movement, wallet ages, unlocks — Marisol
  RECORD: "RECORD", // documents: audit scope, references, post-mortems — GR80
  CHART: "CHART",   // price, windows, the tape — Barron, who sells on it
  SOCIAL: "SOCIAL", // narrative, reputation, who vouches for whom — Eugene
  // Retained for archetypes that want a claim nobody specialises in. No slot
  // uses it today: with four lanes the surface is covered, and "nobody can
  // settle this" is now carried by BACKING.VIBES (no receipt for ANY seat),
  // which is the honest place for it — it's a property of the claim, not of
  // who's in the room.
  SHAPE: "SHAPE",
};

export const SEATS = {
  BARRON: "barron",
  MARISOL: "marisol",
  GR80: "gr80",
  EUGENE: "eugene",
};

/**
 * THE PITCHER — the pitch bot, and deliberately NOT a member of SEATS.
 *
 * It is the thing you press, not somebody you ask. It sits in no chair, owns no
 * lane (there is no SEAT_LANE entry, so inLane() is always false for it), and is
 * never spent. Every "is this the pitcher?" branch in pressRun keys on this.
 *
 * WHY IT OWNS NO LANE. Pressing the pitcher therefore always returns the claim's
 * `generic` block — the confident, technically-true, stops-short-of-the-question
 * answer. Invariant 1 ("truth is never for sale") survives that because the
 * loadBearing slot is the one slot permitted a PER-BRANCH `generic`, so the
 * decisive claim still discriminates on a free press. Verified across all three
 * archetypes: team / source / handles each discriminate on generic.
 *
 * WHY IT IS NOT A SEAT. Connor used to be both pitcher and CHART seat, which
 * is why he needed a special case everywhere — and it quietly made his own lane
 * the only one that was deeply answerable for free. An outside agent pitches now,
 * so the desk is four symmetric seats and Barron is a plain specialist.
 * See VC_GAME.md §1.
 */
export const PITCHER = "pitchbot";

/** Everyone owns exactly one lane now, Barron included. His is CHART: he's a
 *  tape reader who sells on the tape, so his own specialism is the one subject
 *  he'll happily go deep on — which is a very salesman thing to be. */
export const SEAT_LANE = {
  [SEATS.BARRON]: LANES.CHART,
  [SEATS.MARISOL]: LANES.CHAIN,
  [SEATS.GR80]: LANES.RECORD,
  [SEATS.EUGENE]: LANES.SOCIAL,
};

/**
 * One use each, all session — and since 2026-07-29 that is ALL FOUR, in
 * DESK_ORDER. Barron used to be excluded because he was the one pitching; the
 * pitch bot took that job (see PITCHER above), so his CHART expertise is now
 * scarce like everyone else's and the desk has no exceptions left.
 *
 * What keeps every verdict reachable for free is no longer "Barron is unlimited"
 * — it is that pressing the PITCHER costs no seat, and the loadBearing claim
 * discriminates on the `generic` block the pitcher hands you.
 */
export const SPENDABLE_SEATS = [SEATS.BARRON, SEATS.MARISOL, SEATS.GR80, SEATS.EUGENE];

/** Is this seat the specialist for this claim? Decides DEPTH, never legality. */
export function inLane(seat, claim) {
  return !!claim && !!SEAT_LANE[seat] && SEAT_LANE[seat] === claim.lane;
}

/**
 * Every seat can be sent at every claim. Kept as a named function because the
 * legality question is still worth asking explicitly at the call sites — it's
 * just that the answer is now always yes, and the interesting question moved
 * to inLane(). Budget and one-use-per-adviser are enforced in pressRun.
 */
export function canSend() {
  return true;
}

export function isShape(v) {
  return v === ANY || SHAPE_LIST.includes(v);
}
