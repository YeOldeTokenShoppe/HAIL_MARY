// THE POOL — cards as questions, and the DRAW is the point.
//
// v1 gave every session the same three cards. Playtest, 2026-07-26: "it doesn't
// seem like playing cards are really a factor though, even though we are calling
// the 3 options 'cards'." Correct — a hand you always hold is a menu. Three
// things were missing, and none of them were power:
//
//   1. VARIATION — no "what did I get today", so no identity to a session.
//   2. SCARCITY OF ACCESS — interruptions were scarce; the questions never were.
//   3. CONSEQUENCE — you could never be caught without the right question.
//
// So: a pool of eight, a hand of three, dealt from the session seed. Some days
// you hold the exact question this deal is weak to and it's a windfall. Some
// days you hold two that don't apply and you have to work with the blunt press.
// That swing is what makes holding a card feel like something.
//
// Deliberately NOT fixed by making cards stronger — that's the pay-to-win road
// and it breaks the wallet≠win guarantee. Power stays flat; only the DRAW moves.
//
// Non-collectible by author's decision (2026-07-26) — no ownership, no rarity,
// no legality. `art` keys point at cards that already have paintings.

import { SHAPES } from "./questions.js";

export const POOL = [
  {
    id: "scope", name: "AUDIT FLARE", art: "audit-flare",
    shape: SHAPES.BORROWED_CREDIBILITY,
    question: "Clean within what scope?",
    hint: "when he's standing on someone else's authority",
  },
  {
    id: "coldwallet", name: "COLD WALLET", art: "cold-wallet",
    shape: SHAPES.BORROWED_CREDIBILITY,
    question: "Who checked, and what did they skip?",
    hint: "when the check was real but partial",
  },
  {
    id: "graveyard", name: "WALLET SÉANCE", art: "wallet-seance",
    shape: SHAPES.SURVIVORSHIP,
    question: "And the ones that didn't work?",
    hint: "when the good examples are the only examples",
  },
  {
    id: "exit", name: "RUG WARNING", art: "rug-warning",
    shape: SHAPES.SURVIVORSHIP,
    question: "Where did the last one's money end up?",
    hint: "when a past failure was never accounted for",
  },
  {
    id: "window", name: "CHART EXORCISM", art: "chart-exorcism",
    shape: SHAPES.SELECTIVE_WINDOW,
    question: "True over what period?",
    hint: "for a number that only works inside a flattering window",
  },
  {
    id: "positioned", name: "INSIDER PING", art: "insider-ping",
    shape: SHAPES.POSITIONED,
    question: "Are you personally holding this?",
    hint: "when he profits from you believing him",
  },
  {
    id: "sourced", name: "FORKED RUMOUR", art: "forked-rumor",
    shape: SHAPES.UNSOURCED,
    question: "Who actually told you that?",
    hint: "for a claim with no traceable origin",
  },
  {
    id: "falsify", name: "MEMPOOL PROPHECY", art: "mempool-prophecy",
    shape: SHAPES.UNFALSIFIABLE,
    question: "What would change your mind?",
    hint: "for a claim shaped so nothing could dent it",
  },
];

export const HAND_SIZE = 3;

// How many of your dealt cards are guaranteed to have SOMETHING to hit in this
// deal. Below 2 the draw starts losing sessions for you (bad luck, not bad
// reads); at 3 there's no tension left and we're back to a menu. Two is the
// mulligan rule: you always have a play, never a guaranteed sweep.
export const MIN_LIVE = 2;

/**
 * Deal a hand from the pool, seeded. Pure — same (seed, deal) always deals the
 * same hand, so a daily session is identical for everyone and unrerollable.
 *
 * `liveShapes` is the set of shapes present in today's deal. We guarantee
 * MIN_LIVE cards can hit, then fill the rest at random — so a dead card in
 * hand is a real (and instructive) possibility, but never the whole hand.
 */
export function dealHand(seed = 1, liveShapes = null, pool = POOL, size = HAND_SIZE) {
  let a = (seed * 7919 + 0x9e3779b9) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = (arr) => {
    const c = [...arr];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  };

  if (!liveShapes) return shuffled(pool).slice(0, size);

  const live = shuffled(pool.filter((c) => liveShapes.has(c.shape)));
  const dead = shuffled(pool.filter((c) => !liveShapes.has(c.shape)));

  // Never deal two cards that ask the same question — a duplicate shape is a
  // wasted slot that reads as a bug.
  const hand = [];
  const usedShapes = new Set();
  for (const c of live) {
    if (hand.length >= Math.min(MIN_LIVE, size)) break;
    if (usedShapes.has(c.shape)) continue;
    hand.push(c); usedShapes.add(c.shape);
  }
  for (const c of [...dead, ...live]) {
    if (hand.length >= size) break;
    if (usedShapes.has(c.shape)) continue;
    hand.push(c); usedShapes.add(c.shape);
  }
  return shuffled(hand); // don't leak "the live ones are first"
}

export function cardById(id) {
  return POOL.find((c) => c.id === id) || null;
}

// A fixed starter hand, kept for callers/tests that want a deterministic hand
// with no deal in scope. Built one-card-per-shape, NOT a raw slice — the pool
// has two BORROWED_CREDIBILITY cards up front, so slicing dealt a duplicate
// question and wasted a slot.
export const HAND = (() => {
  const seen = new Set();
  return POOL.filter((c) => !seen.has(c.shape) && seen.add(c.shape)).slice(0, HAND_SIZE);
})();
