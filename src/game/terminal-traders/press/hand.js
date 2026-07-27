// THE HAND — cards as questions.
//
// A card is not a resource, a stat, or a permission. It is one sentence you
// are allowed to say instead of "put a number on it". Playing one costs the
// same press as the generic move; you never get a fourth press, and no card
// can make a fact exist that the speaker doesn't have.
//
// Author, 2026-07-26: "I may just make them in-game and non-collectible —
// let's just get the mechanics down." So there is deliberately NO ownership,
// no collection read, no loadout legality, no rarity. This file is a flat
// list. If a collection ever comes back, the ONLY legal shape is a function
// that filters this list — nothing else may read it (see pressRun.js).
//
// `art` keys point at existing painted cards whose flavour already matches the
// question. They are placeholders, not commitments — rename or repaint freely.

import { SHAPES } from "./questions.js";

export const HAND = [
  {
    id: "scope",
    name: "AUDIT FLARE",
    art: "audit-flare",
    shape: SHAPES.BORROWED_CREDIBILITY,
    // What the player is actually saying. Shown on the card face — the card
    // IS the question, so the rules text and the dialogue are the same string.
    question: "Clean within what scope?",
    hint: "for when he's standing on someone else's authority",
  },
  {
    id: "graveyard",
    name: "WALLET SÉANCE",
    art: "wallet-seance",
    shape: SHAPES.SURVIVORSHIP,
    question: "And the ones that didn't work?",
    hint: "for when the good examples are the only examples",
  },
  {
    id: "window",
    name: "CHART EXORCISM",
    art: "chart-exorcism",
    shape: SHAPES.SELECTIVE_WINDOW,
    question: "True over what period?",
    hint: "for a number that only works inside a flattering window",
  },
];

export function cardById(id) {
  return HAND.find((c) => c.id === id) || null;
}
