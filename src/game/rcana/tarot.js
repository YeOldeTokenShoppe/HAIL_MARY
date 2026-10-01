// RL80 R-cana, tarot configuration: 80 cards.
//   22 Major R-cana, shuffled into the deck, resolve for the table when drawn.
//   56 Minor R-cana: four suits (Coins, Candles, Chains, Cups) × (Ace–10 pips + Page, Knight, Queen, King).
//    2 Querents: the players' own markers (not in the deck).
// Theme: general markets and money. Pips are templates; courts and Majors are unique.

export const SUITS = ['coins', 'candles', 'chains', 'cups'];
export const SUIT_NAME = { coins: 'Coins', candles: 'Candles', chains: 'Chains', cups: 'Cups' };
export const RANKS = ['Page', 'Knight', 'Queen', 'King'];

export const PIP_TEXT = {
  coins: 'Gain R Profit into your Portfolio.',
  candles: 'Put an idle Personality to Work. It yields +R this turn.',
  chains: 'Deal R Drawdown to a Working opposing Personality, or Front-run R from an opposing Portfolio. Hedge: when a Chain targets you, play this to reduce it by R.',
  cups: 'Another Trader gains half of R (rounded up) Profit. You gain R Profit.',
};
export function pipCost(suit, r) { const c = Math.ceil(r / 2); return suit === 'cups' ? Math.max(0, c - 1) : c; }

const pips = [];
for (const suit of SUITS) for (let r = 1; r <= 10; r++) {
  pips.push({ id: `${suit}_${r}`, name: `${r === 1 ? 'Ace' : r} of ${SUIT_NAME[suit]}`, type: 'pip', suit, rank: r, cost: pipCost(suit, r), text: PIP_TEXT[suit].replace(/R/g, String(r)) });
}

// ── Courts: 16 Personalities. cost / yield / res, one ability each. ──
const C = (suit, rank, o) => ({ type: 'court', suit, rank, villain: false, kw: {}, ...o, id: `${suit}_${rank.toLowerCase()}`, title: `${rank} of ${SUIT_NAME[suit]}` });
export const COURTS = [
  C('coins', 'Page', { name: 'Ethan, Junior Analyst', cost: 2, yield: 2, res: 3, text: 'Bank 20: Yield 3.', yieldFn: (g, p, i, b) => (p.bank >= 20 ? 3 : b) }),
  C('coins', 'Knight', { name: 'The Day Trader', cost: 3, yield: 3, res: 2, kw: { fast: true }, text: 'Fast.' }),
  C('coins', 'Queen', { name: 'Marisol, Investigator', cost: 4, yield: 2, res: 4, text: 'When hired: draw a Minor. Your Coins give +1 Profit.', onHired: (g, p) => g.drawMinors(p, 1), mods: { coinsBonus: () => 1 } }),
  C('coins', 'King', { name: 'Old Money', cost: 6, yield: 3, res: 6, text: 'Your Interest is doubled.', mods: { interestMult: () => 2 } }),

  C('candles', 'Page', { name: 'The Apprentice', cost: 2, yield: 1, res: 2, text: 'Your Candles cost 1 less.', mods: { cost: (g, p, c) => (c.suit === 'candles' ? -1 : 0) } }),
  C('candles', 'Knight', { name: 'Unihood, Meme Prophet', cost: 3, yield: 2, res: 3, kw: { fast: true }, text: 'Fast. During THE BOOM, Yield 5.', yieldFn: (g, p, i, b) => (g.marketIs('THE BOOM') ? 5 : b) }),
  C('candles', 'Queen', { name: 'Eugene, Pattern Prophet', cost: 4, yield: 2, res: 4, text: 'Whenever a Major is revealed, gain 2 Profit into your Portfolio.', onMajor: (g, p) => g.profit(p, 2, 'Eugene') }),
  C('candles', 'King', { name: 'The Promoter', cost: 5, yield: 3, res: 3, text: 'Your Coins and Candles give +1.', mods: { coinsBonus: () => 1, candlesBonus: () => 1 } }),

  C('chains', 'Page', { name: 'The Short Seller', cost: 2, yield: 1, res: 3, text: 'During THE PANIC or LEVERAGE, Yield 4.', yieldFn: (g, p, i, b) => (g.marketIs('THE PANIC') || g.marketIs('LEVERAGE') ? 4 : b) }),
  C('chains', 'Knight', { name: 'The Raider', cost: 4, yield: 1, res: 2, villain: true, kw: { fast: true, exitScam: 3 }, text: 'Fast. Exit Scam 3. Work: Front-run 3.', work: (g, p, inst) => { const t = g.richestOpp(p); if (t) g.frontrun(p, t, 3); } }),
  C('chains', 'Queen', { name: 'Cassandra', cost: 4, yield: 2, res: 3, text: 'Chains and Events deal 1 less Drawdown to your cards.', mods: { incomingDd: () => -1 } }),
  C('chains', 'King', { name: 'Connor, Demon', cost: 6, yield: 4, res: 3, villain: true, kw: { exitScam: 4 }, text: 'Exit Scam 4. Whenever an Event resolves, gain 3 Profit into your Portfolio.', onEvent: (g, p) => g.profit(p, 3, 'Connor') }),

  C('cups', 'Page', { name: 'Sister Ledger', cost: 2, yield: 1, res: 3, text: 'When hired: bank 2 directly.', onHired: (g, p) => g.bank(p, 2, 'Sister Ledger') }),
  C('cups', 'Knight', { name: 'The Almoner', cost: 3, yield: 2, res: 3, kw: { fast: true }, text: 'Fast. Your Cups give +1 to you.', mods: { cupsBonus: () => 1 } }),
  C('cups', 'Queen', { name: 'Virgil, Oracle', cost: 4, yield: 2, res: 3, text: 'Foretell: once per turn, look at the top card of the R-cana. You may put it on the bottom.', foretell: true }),
  C('cups', 'King', { name: 'GR80, Monk', cost: 5, yield: 1, res: 6, kw: { hedged: true }, text: 'Hedged. Whenever you play a Cup, GR80 yields without Working.', onCup: (g, p, inst) => g.profit(p, g.yieldOf(p, inst), 'GR80') }),
];

// ── Majors: 22. kind = market (standing), event (instant), invoke (sits in Providence; one use). ──
const M = (n, tarot, name, kind, text, o = {}) => ({ type: 'major', n, tarot, name, kind, text, id: 'major_' + n, ...o });
export const MAJORS = [
  M(0, 'The Fool', 'THE HAIL MARY', 'invoke', 'Invoke 3, Underdog only: throw a Hail Mary Pass now, even if you have already thrown one this game.', { cost: 3, can: (g, p) => g.isUnderdog(p) && !p.pass && p.portfolio >= g.rules.passMin, run: (g, p) => g.throwPass(p, { extra: true }) }),
  M(1, 'The Magician', 'THE FOUNDER', 'invoke', 'Invoke 2: draw two Minors.', { cost: 2, can: () => true, run: (g, p) => g.drawMinors(p, 2) }),
  M(2, 'The High Priestess', 'THE ORACLE', 'event', 'Reveal the top three cards. The Underdog puts them back in any order.', { resolve: (g) => g.oracle() }),
  M(3, 'The Empress', 'THE BOOM', 'market', 'Candles give double.', { mods: { candlesMult: () => 2 } }),
  M(4, 'The Emperor', 'THE FED', 'market', 'Interest is doubled.', { mods: { interestMult: () => 2 } }),
  M(5, 'The Hierophant', 'THE REGULATOR', 'event', 'Every Portfolio loses 3. Every Chains Personality takes 2 Drawdown.', { resolve: (g) => g.players.forEach((q) => { g.loseProfit(q, 3, 'THE REGULATOR'); g.floor(q).filter((i) => i.card.suit === 'chains').forEach((i) => g.drawdown(i, 2, 'THE REGULATOR')); }) }),
  M(6, 'The Lovers', 'THE MERGER', 'invoke', 'Invoke 2: an idle Personality Works with +3 Yield.', { cost: 2, can: (g, p) => g.idleEligible(p).length > 0, run: (g, p) => { const i = g.bestIdle(p); if (i) g.work(p, i, { bonus: 3 }); } }),
  M(7, 'The Chariot', 'BULL RUN', 'market', 'Every Yield is +1.', { mods: { yield: () => 1 } }),
  M(8, 'Strength', 'CONVICTION', 'market', 'Portfolios cannot be targeted.', { mods: { portfolioSafe: () => true } }),
  M(9, 'The Hermit', 'THE VAULT', 'invoke', 'Invoke 1: bank up to 5 Profit from your Portfolio.', { cost: 1, can: (g, p) => p.portfolio >= 3, run: (g, p) => g.bankFromPortfolio(p, Math.min(5, p.portfolio), 'THE VAULT') }),
  M(10, 'Wheel of Fortune', 'VOLATILITY', 'event', 'Every Trader passes their Portfolio to the Trader on their left.', { resolve: (g) => g.rotatePortfolios() }),
  M(11, 'Justice', 'THE AUDIT', 'event', 'Each Trader with the most Chains Personalities loses half their Portfolio.', { resolve: (g) => { const n = (q) => g.floor(q).filter((i) => i.card.suit === 'chains').length; const mx = Math.max(...g.players.map(n)); if (mx > 0) g.players.filter((q) => n(q) === mx).forEach((q) => g.loseProfit(q, Math.floor(q.portfolio / 2), 'THE AUDIT')); } }),
  M(12, 'The Hanged Man', 'THE BAG HOLDER', 'market', 'No Trader may bank more than 5 per turn.', { mods: { bankCap: () => 5 } }),
  M(13, 'Death', 'THE LIQUIDATION', 'event', 'Every Working Personality takes 3 Drawdown.', { resolve: (g) => g.players.forEach((q) => g.working(q).forEach((i) => g.drawdown(i, 3, 'THE LIQUIDATION'))) }),
  M(14, 'Temperance', 'DOLLAR-COST AVERAGE', 'market', 'Dividend is 3. Yields above 3 become 3.', { mods: { dividend: () => 3, yieldFinal: (g, p, i, y) => Math.min(3, y) } }),
  M(15, 'The Devil', 'LEVERAGE', 'market', 'Every Yield is doubled. Every Chain is doubled.', { mods: { yieldFinal: (g, p, i, y) => y * 2, chainsMult: () => 2 } }),
  M(16, 'The Tower', 'THE CRASH', 'event', 'Every Portfolio is emptied.', { resolve: (g) => g.players.forEach((q) => g.loseProfit(q, q.portfolio, 'THE CRASH')) }),
  M(17, 'The Star', 'THE WINDFALL', 'event', 'Every Trader draws two Minors and gains 3 Profit into their Portfolio.', { resolve: (g) => g.players.forEach((q) => { g.drawMinors(q, 2); g.profit(q, 3, 'THE WINDFALL'); }) }),
  M(18, 'The Moon', 'THE PANIC', 'market', 'Chains cost 0.', { mods: { costOverride: (g, p, c) => (c.suit === 'chains' && c.type === 'pip' ? 0 : null) } }),
  M(19, 'The Sun', 'GOLDEN AGE', 'market', 'Cups cost 0 and give double.', { mods: { costOverride: (g, p, c) => (c.suit === 'cups' && c.type === 'pip' ? 0 : null), cupsMult: () => 2 } }),
  M(20, 'Judgement', 'THE RECKONING', 'event', 'The Final Bell: the game ends at the end of this round. If more than half the R-cana remains, it is instead buried in the bottom half of the deck.', { resolve: (g) => { if (g.deck.length > g.buryThreshold()) g.bury(g.byId('major_20')); else g.callBell('THE RECKONING'); } }),
  M(21, 'The World', 'OUR LADY OF PERPETUAL PROFIT', 'event', 'The Trader who has played the most Cups banks their entire Portfolio.', { resolve: (g) => { const mx = Math.max(...g.players.map((q) => q.stats.cups)); g.players.filter((q) => q.stats.cups === mx).forEach((q) => g.bankFromPortfolio(q, q.portfolio, 'OUR LADY')); } }),
];

export const MINORS = [...pips, ...COURTS];
export const ALL = [...MINORS, ...MAJORS];
export const byId = Object.fromEntries(ALL.map((c) => [c.id, c]));
