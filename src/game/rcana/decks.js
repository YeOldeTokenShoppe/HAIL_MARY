// Deck lists and builders for R-cana simulations.
import { DECK_CARDS, TRADERS, MARKETS, EXTERNALITIES, MAJORS, card } from './cards.js';
import { makeRng } from './engine.js';

const MAX_COPIES = { C: 3, U: 3, R: 3, UR: 3 };
const BUILD_COPIES = { C: 3, U: 2, R: 1, UR: 1 };

export const STARTER_DECKS = {
  degen: { trader: 'degen', name: 'Degen Starter', list: {
    'Paid Shill': 3, 'Clout Chaser': 3, 'Bot Farm': 2, 'Moon Boy': 3, 'Leverage Larry': 2, 'Unihood, Meme Prophet': 2, 'The Closer': 1,
    'Meme Factory': 3, 'Viral Moment': 3, 'Airdrop': 3, 'Trending': 3, 'Arbitrage': 2, 'Degen Play': 3, 'Sandwich Attack': 2, 'Skim': 2, 'Shoutout': 1, 'FOMO': 2 } },
  analyst: { trader: 'analyst', name: 'Analyst Starter', list: {
    'Ethan, Junior Analyst': 3, 'Ethan, Senior Analyst': 2, 'Chart Reader': 3, 'The Quant': 2, 'The HODLer': 2, 'Grandma Index': 2,
    'Data Feed': 3, 'Staking Pool': 2, 'Bond Ladder': 2, 'Research Desk': 2, 'Undervalued Asset': 3, 'Forecast': 3, 'Dollar-Cost Average': 3, 'Long-Term Hold': 3,
    'Exposé': 2, 'Mentorship': 1, 'Diamond Hands': 2 } },
};

export function expand(list) {
  const out = [];
  for (const [name, n] of Object.entries(list)) { const c = card(name); for (let i = 0; i < n; i++) out.push(c); }
  return out;
}
export function traderById(id) { const t = TRADERS.find((t) => t.id === id); if (!t) throw new Error('unknown trader ' + id); return t; }

// Auto-build a 40-card deck for a Trader from its two Temperaments.
export function buildDeck(traderId, seed = 1) {
  const t = traderById(traderId); const rng = makeRng(seed * 7919 + 13);
  const pool = DECK_CARDS.filter((c) => t.temps.includes(c.temp));
  const quota = { personality: 16, position: 6, opportunity: 10, other: 8 };
  const bucket = (c) => (c.type === 'personality' || c.type === 'position' || c.type === 'opportunity' ? c.type : 'other');
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

export function deckFor(spec, seed) {
  if (STARTER_DECKS[spec]) return { trader: traderById(STARTER_DECKS[spec].trader), deck: expand(STARTER_DECKS[spec].list), label: STARTER_DECKS[spec].name };
  return { trader: traderById(spec), deck: buildDeck(spec, seed), label: `${traderById(spec).name} (auto)` };
}
