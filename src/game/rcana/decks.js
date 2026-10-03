// Deck lists and builders for R-cana simulations. There are no Trader cards:
// a deck is two Temperaments and forty cards.
import { DECK_CARDS, MARKETS, EXTERNALITIES, MAJORS, PAIRS, pairById, card } from './cards.js';
import { makeRng } from './engine.js';

const MAX_COPIES = { C: 3, U: 3, R: 3, UR: 3 };
const BUILD_COPIES = { C: 3, U: 2, R: 1, UR: 1 };

export const STARTER_DECKS = {
  degen: { temps: ['hype', 'greed'], name: 'Degen Starter (Hype + Greed)', list: {
    'Paid Shill': 3, 'Clout Chaser': 3, 'Bot Farm': 2, 'Moon Boy': 3, 'Leverage Larry': 2, 'Unihood, Meme Prophet': 2, 'The Closer': 1,
    'Meme Factory': 3, 'Viral Moment': 3, 'Airdrop': 2, 'Trending': 3, 'Arbitrage': 2, 'Degen Play': 2, 'Sandwich Attack': 2, 'Skim': 2, "Ratio'd": 1, 'Insider Dump': 1, 'Shoutout': 1, 'FOMO': 2 } },
  analyst: { temps: ['reason', 'patience'], name: 'Analyst Starter (Reason + Patience)', list: {
    'Ethan, Junior Analyst': 3, 'Ethan, Senior Analyst': 2, 'Chart Reader': 3, 'The Quant': 2, 'The HODLer': 2, 'Grandma Index': 2,
    'Data Feed': 3, 'Staking Pool': 2, 'Bond Ladder': 2, 'Research Desk': 2, 'Undervalued Asset': 3, 'Forecast': 2, 'Dollar-Cost Average': 2, 'Long-Term Hold': 3,
    'Exposé': 2, 'Short Report': 1, 'Margin Call': 1, 'Mentorship': 1, 'Diamond Hands': 2 } },
};

export function expand(list) {
  const out = [];
  for (const [name, n] of Object.entries(list)) { const c = card(name); for (let i = 0; i < n; i++) out.push(c); }
  return out;
}

// Auto-build a 40-card deck from a Temperament pair.
export function buildDeck(pairId, seed = 1) {
  const pair = pairById[pairId]; if (!pair) throw new Error('unknown pair ' + pairId);
  const rng = makeRng(seed * 7919 + 13);
  const pool = DECK_CARDS.filter((c) => pair.temps.includes(c.temp));
  const quota = { personality: 16, position: 6, opportunity: 8, calamity: 4, other: 6 };
  const bucket = (c) => (quota[c.type] ? c.type : 'other');
  const deck = []; const copies = {};
  const take = (c) => { deck.push(c); copies[c.id] = (copies[c.id] || 0) + 1; };
  const shuffled = [...pool].sort(() => rng() - 0.5);
  for (const [b, q] of Object.entries(quota)) {
    let n = 0; let pass = 0;
    while (n < q && pass++ < 6) for (const c of shuffled) { if (n >= q) break; if (bucket(c) !== b) continue; if ((copies[c.id] || 0) >= BUILD_COPIES[c.rarity]) continue; if (rng() < 0.6) { take(c); n++; } }
  }
  let pass = 0;
  while (deck.length < 40 && pass++ < 10) for (const c of shuffled) { if (deck.length >= 40) break; if ((copies[c.id] || 0) < MAX_COPIES[c.rarity] && rng() < 0.5) take(c); }
  return deck.slice(0, 40);
}

export function listDeck(deck) { const m = {}; deck.forEach((c) => { m[c.name] = (m[c.name] || 0) + 1; }); return m; }

export const FIRST_GAME_RCANA = ['Bull Run', 'Bear Market', 'Meme Season', 'Risk-Off', 'Sideways', 'Altseason', 'Dead Cat Bounce', 'Irrational Exuberance', 'Regulation', 'Rate Shock', 'Stimulus', 'THE WHALE', 'THE ORACLE'];

export function buildRcana({ seed = 1, markets = 8, externalities = 3, majors = 2, fixed = null } = {}) {
  if (fixed) return fixed.map((n) => card(n));
  const rng = makeRng(seed * 104729 + 7);
  const pickN = (arr, n) => [...arr].sort(() => rng() - 0.5).slice(0, n);
  return [...pickN(MARKETS, markets), ...pickN(EXTERNALITIES, externalities), ...pickN(MAJORS, majors)];
}

export const DECK_OPTIONS = [...Object.entries(STARTER_DECKS).map(([id, d]) => ({ id, name: d.name })), ...PAIRS.map((p) => ({ id: p.id, name: `${p.name} (auto deck)` }))];

export function deckFor(spec, seed) {
  if (STARTER_DECKS[spec]) return { temps: STARTER_DECKS[spec].temps, deck: expand(STARTER_DECKS[spec].list), label: STARTER_DECKS[spec].name, short: spec === 'degen' ? 'DEGEN STARTER' : 'ANALYST STARTER' };
  const pair = pairById[spec]; if (!pair) throw new Error('unknown deck ' + spec);
  return { temps: pair.temps, deck: buildDeck(spec, seed), label: `${pair.name} (auto)`, short: pair.name.toUpperCase() };
}
