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

export function isShape(v) {
  return v === ANY || SHAPE_LIST.includes(v);
}
