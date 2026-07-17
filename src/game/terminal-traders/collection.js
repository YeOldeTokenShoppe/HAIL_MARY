import { getCardById } from "./cards.js";

// The free starter collection granted to every player on first visit. Design
// constraints: commons plus two cheap uncommons only (rares/mythics/foils stay
// pack-exclusive), every trader style gets at least one on-tag card so no
// starting trader feels dead, enough cred generation to never brick a hand,
// and a couple of duplicates so the collection UI exercises counts > 1.
// Post-§3.2a bonus constraint: the starter seeds a playable case kit — one
// lens key per lens plus both insurance cards (all First Twelve members).
export const STARTER_SET = {
  // coins
  "goblingas": 2,
  "candle-index": 1,
  "zero-choir": 1,
  "bullish-ink": 1,
  "votive-chain": 1,
  "ponzi-siren": 1,
  "terminal-eth": 1,
  // actions — the First Twelve's lens keys (one per lens; audit-flare
  // doubled for the dupe path)
  "audit-flare": 2,
  "forked-rumor": 1,
  "wallet-seance": 1,
  "mempool-prophecy": 1,
  // actions — second keys and economy
  "compliance-siren": 1,
  "short-the-noise": 1,
  "liquidity-ladder": 1,
  "pattern-rosary": 1,
  "diamond-hands": 1,
  "limit-order-prayer": 1,
  "gasless-miracle": 1,
  "candle-vigil": 1,
  // the two cheap uncommons: the kit's insurance pair
  "cold-wallet": 1,
  "neon-stop-loss": 1,
};

export const MIN_DECK_SIZE = 12;

// Sanitize a raw collection map (untrusted Firestore data or API payload)
// into { cardId: positiveInt } with only ids that exist in the Genesis set.
export function normalizeCollection(rawCards) {
  const cards = {};
  if (!rawCards || typeof rawCards !== "object") return cards;
  for (const [id, count] of Object.entries(rawCards)) {
    const parsed = Math.floor(Number(count));
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    if (!getCardById(id)) continue;
    cards[id] = Math.min(parsed, 999);
  }
  return cards;
}

export function countCollection(cards) {
  return Object.values(cards || {}).reduce((sum, count) => sum + count, 0);
}

// Expand an owned-card map into the draw pool for a game: one deck entry per
// owned copy. Traders and market cards never enter the draw pool — traders are
// the cast and markets flip from their own deck — so they are filtered out
// even if a collection somehow contains them.
export function buildDeckFromCollection(cards) {
  const pool = [];
  for (const [id, count] of Object.entries(normalizeCollection(cards))) {
    const card = getCardById(id);
    if (card.type !== "coin" && card.type !== "action") continue;
    for (let i = 0; i < count; i += 1) pool.push(card);
  }
  return pool;
}

export function isDeckPlayable(cards) {
  return buildDeckFromCollection(cards).length >= MIN_DECK_SIZE;
}
