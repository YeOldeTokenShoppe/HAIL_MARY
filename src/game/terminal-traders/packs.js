import { GENESIS_SET, RARITIES } from "./cards.js";

// Genesis booster packs. Opening is DETERMINISTIC: the RNG is seeded from the
// burn tx hash, so a given burn always yields the same cards — the pull is
// provably tied to the on-chain event, can't be rerolled by resubmitting, and
// disputed pulls can be re-derived from public data.

export const PACK_SIZE = 5;
export const PACK_PRICE_USD = 3;
export const MAX_PACKS_PER_TX = 20;

// Published odds (compliance guardrail: these are surfaced to players, keep
// this table in sync with any UI that displays drop rates). Slots 1-4 roll
// STANDARD_SLOT; slot 5 rolls BONUS_SLOT — every pack contains at least one
// uncommon-or-better.
export const STANDARD_SLOT = [
  { rarity: RARITIES.COMMON, weight: 680 },
  { rarity: RARITIES.UNCOMMON, weight: 220 },
  { rarity: RARITIES.RARE, weight: 80 },
  { rarity: RARITIES.MYTHIC, weight: 15 },
  { rarity: RARITIES.FOIL, weight: 5 },
];
export const BONUS_SLOT = [
  { rarity: RARITIES.UNCOMMON, weight: 700 },
  { rarity: RARITIES.RARE, weight: 245 },
  { rarity: RARITIES.MYTHIC, weight: 40 },
  { rarity: RARITIES.FOIL, weight: 15 },
];

const POOLS = GENESIS_SET.reduce((pools, card) => {
  (pools[card.rarity] ||= []).push(card.id);
  return pools;
}, {});

// FNV-1a hash of a string → 32-bit seed.
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 — small deterministic PRNG, same quality bar as the engine's
// seeded shuffle. NOT for secrets; fine here because the seed (tx hash) is
// already public and immutable.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollRarity(rand, slotTable) {
  const total = slotTable.reduce((sum, row) => sum + row.weight, 0);
  let roll = rand() * total;
  for (const row of slotTable) {
    roll -= row.weight;
    if (roll <= 0) return row.rarity;
  }
  return slotTable[slotTable.length - 1].rarity;
}

function rollCard(rand, slotTable) {
  const rarity = rollRarity(rand, slotTable);
  const pool = POOLS[rarity];
  return pool[Math.floor(rand() * pool.length)];
}

// Open `count` packs seeded by `seedString` (the burn tx hash). Returns
// { packs: [[cardId x5], ...], counts: {cardId: n} } — counts feed grantCards
// directly.
export function openPacks(seedString, count) {
  const rand = mulberry32(hashSeed(String(seedString)));
  const packs = [];
  const counts = {};
  for (let p = 0; p < count; p += 1) {
    const pack = [];
    for (let slot = 0; slot < PACK_SIZE; slot += 1) {
      const table = slot === PACK_SIZE - 1 ? BONUS_SLOT : STANDARD_SLOT;
      const cardId = rollCard(rand, table);
      pack.push(cardId);
      counts[cardId] = (counts[cardId] || 0) + 1;
    }
    packs.push(pack);
  }
  return { packs, counts };
}

// USD burned → whole packs. 5% tolerance absorbs price movement between the
// client's quote and the burn landing on-chain, so a burn sized "exactly one
// pack" at quote time doesn't come up short.
export function packsForUsd(burnedUsd) {
  if (!Number.isFinite(burnedUsd) || burnedUsd <= 0) return 0;
  const packs = Math.floor((burnedUsd * 1.05) / PACK_PRICE_USD);
  return Math.max(0, Math.min(packs, MAX_PACKS_PER_TX));
}
