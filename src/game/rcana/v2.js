// R-cana version 2: reversals. Every Minor has an upright and a reversed face.
// A deck is one card per slot (56), each chosen upright or reversed. Majors are shared.
import { MINORS, COURTS, SUITS, SUIT_NAME, pipCost } from './tarot.js';

export const REV_PIP_TEXT = {
  coins: 'Bank half of R (rounded up) directly.',
  candles: 'Put an idle Personality to Work. It yields +half of R and cannot be targeted until your next turn.',
  chains: 'Hedge only. When a Chain targets you, play this for free: it absorbs R+2.',
  cups: 'Front-run half of R (rounded up) from another Trader. Gain the same.',
};
export function revCost(suit, r) { const c = Math.ceil(r / 2); return suit === 'candles' ? Math.max(0, c - 1) : c; }

const revPips = [];
for (const suit of SUITS) for (let r = 1; r <= 10; r++) {
  const h = Math.ceil(r / 2);
  revPips.push({ id: `${suit}_${r}_rev`, slot: `${suit}_${r}`, name: `${r === 1 ? 'Ace' : r} of ${SUIT_NAME[suit]} (reversed)`, type: 'pip', suit, rank: r, reversed: true, cost: revCost(suit, r), text: REV_PIP_TEXT[suit].replace(/half of R/g, String(h)).replace(/R\+2/g, String(r + 2)) });
}

// Reversed courts: the same sixteen characters on a bad day (or a better one).
const RC = (slot, o) => { const base = COURTS.find((c) => c.id === slot); return { type: 'court', suit: base.suit, rank: base.rank, title: base.title + ' (reversed)', villain: false, kw: {}, reversed: true, slot, id: slot + '_rev', ...o }; };
export const REV_COURTS = [
  RC('coins_page', { name: 'Ethan, Burned Out', cost: 2, yield: 2, res: 3, text: 'Underdog: Yield 3.', yieldFn: (g, p, i, b) => (g.isUnderdog(p) ? 3 : b) }),
  RC('coins_knight', { name: 'The Day Trader, Humbled', cost: 3, yield: 3, res: 2, kw: { hedged: true }, text: 'Hedged.' }),
  RC('coins_queen', { name: 'Marisol, Prosecutor', cost: 4, yield: 2, res: 4, text: 'Your Chains deal +1.', mods: { chainsBonus: () => 1 } }),
  RC('coins_king', { name: 'New Money', cost: 6, yield: 4, res: 4, text: 'Your Dividend is +1.', mods: { dividendDelta: () => 1 } }),
  RC('candles_page', { name: 'The Apprentice, Promoted', cost: 2, yield: 1, res: 2, text: 'Your Candles give +1.', mods: { candlesBonus: () => 1 } }),
  RC('candles_knight', { name: 'Unihood, Cancelled', cost: 3, yield: 2, res: 3, kw: { fast: true }, text: 'Fast. During THE PANIC, Yield 5.', yieldFn: (g, p, i, b) => (g.marketIs('THE PANIC') ? 5 : b) }),
  RC('candles_queen', { name: 'Eugene, Doomsayer', cost: 4, yield: 2, res: 4, text: 'Whenever a Major is revealed, each opponent loses 1 Profit.', onMajor: (g, p) => g.opps(p).forEach((o) => g.loseProfit(o, 1, 'Eugene, Doomsayer')) }),
  RC('candles_king', { name: 'The Whistleblower', cost: 5, yield: 3, res: 3, text: "Opponents' Chains cost 1 more.", mods: { oppChainsCost: () => 1 } }),
  RC('chains_page', { name: 'The Long', cost: 2, yield: 1, res: 3, text: 'During BULL RUN or THE BOOM, Yield 4.', yieldFn: (g, p, i, b) => (g.marketIs('BULL RUN') || g.marketIs('THE BOOM') ? 4 : b) }),
  RC('chains_knight', { name: 'The Raider, Retired', cost: 4, yield: 2, res: 3, kw: { fast: true, hedged: true }, text: 'Fast. Hedged.' }),
  RC('chains_queen', { name: 'Cassandra, Ignored', cost: 4, yield: 2, res: 3, text: "Whenever an Event resolves, each opponent's Working Personality takes 1 Drawdown.", onEvent: (g, p) => g.opps(p).forEach((o) => g.working(o).forEach((i) => g.drawdown(i, 1, 'Cassandra, Ignored'))) }),
  RC('chains_king', { name: 'Connor, Reformed', cost: 6, yield: 3, res: 5, kw: { hedged: true }, text: 'Hedged. Whenever an Event resolves, remove 2 Drawdown from each of your cards.', onEvent: (g, p) => p.floor.forEach((i) => { i.drawdown = Math.max(0, i.drawdown - 2); }) }),
  RC('cups_page', { name: 'Sister Ledger, Generous', cost: 2, yield: 1, res: 3, text: 'When hired: gain 3 Profit into your Portfolio.', onHired: (g, p) => g.profit(p, 3, 'Sister Ledger') }),
  RC('cups_knight', { name: 'The Collector', cost: 3, yield: 2, res: 3, kw: { fast: true }, text: 'Fast. Your reversed Cups take +1.', mods: { revCupsBonus: () => 1 } }),
  RC('cups_queen', { name: 'Virgil, Blinded', cost: 4, yield: 3, res: 3, text: 'No Foretell. Yield 3.' }),
  RC('cups_king', { name: 'GR80, Tempted', cost: 5, yield: 3, res: 4, text: 'Whenever you play a reversed Cup, GR80 yields without Working.', onRevCup: (g, p, inst) => g.profit(p, g.yieldOf(p, inst), 'GR80, Tempted') }),
];

export const UPRIGHT = MINORS.map((c) => ({ ...c, slot: c.id, reversed: false }));
export const REVERSED = [...revPips, ...REV_COURTS];
export const SLOTS = UPRIGHT.map((c) => c.slot);
const upBySlot = Object.fromEntries(UPRIGHT.map((c) => [c.slot, c]));
const revBySlot = Object.fromEntries(REVERSED.map((c) => [c.slot, c]));

// Deck presets: which slots are reversed.
export const DECK_PRESETS = {
  upright: { name: 'All upright', rev: () => false },
  revChains: { name: 'Chains reversed', rev: (s) => s.startsWith('chains_') && !s.endsWith('king') && !s.endsWith('queen') && !s.endsWith('knight') && !s.endsWith('page') },
  revChainsAll: { name: 'Chains reversed incl. courts', rev: (s) => s.startsWith('chains_') },
  revCoins: { name: 'Coins reversed', rev: (s) => s.startsWith('coins_') && /_\d+$/.test(s) },
  revCups: { name: 'Cups reversed (take, not give)', rev: (s) => s.startsWith('cups_') && /_\d+$/.test(s) },
  cautious: { name: 'Cautious: Chains + Coins pips reversed', rev: (s) => (s.startsWith('chains_') || s.startsWith('coins_')) && /_\d+$/.test(s) },
  aggressive: { name: 'Aggressive: Cups + Candles pips reversed', rev: (s) => (s.startsWith('cups_') || s.startsWith('candles_')) && /_\d+$/.test(s) },
  chainsLowRev: { name: 'Chains 1–5 reversed, 6–10 upright', rev: (s) => /^chains_[1-5]$/.test(s) },
  chainsHighRev: { name: 'Chains 6–10 reversed, 1–5 upright', rev: (s) => /^chains_(6|7|8|9|10)$/.test(s) },
  chainsEvenRev: { name: 'Even Chains reversed', rev: (s) => /^chains_(2|4|6|8|10)$/.test(s) },
  random: { name: 'Random reversals', rev: null },
};
export function buildDeck(preset, rng) {
  const d = DECK_PRESETS[preset] || DECK_PRESETS.upright;
  return SLOTS.map((s) => ((d.rev ? d.rev(s) : rng() < 0.5) ? revBySlot[s] : upBySlot[s]));
}
export const ALL_V2 = [...UPRIGHT, ...REVERSED];
