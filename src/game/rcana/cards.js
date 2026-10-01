// RL80 R-cana — the 160-card base set, executable.
// Rules draft v4 + Villains. Every card is data plus small effect functions that
// call the engine's helpers (see engine.js). Keep card text and code in sync.

const T = { HOPE: 'hope', GREED: 'greed', FEAR: 'fear', HYPE: 'hype', REASON: 'reason', PATIENCE: 'patience' };
export const TEMPERAMENTS = Object.values(T);
export const RARITY = { C: 'common', U: 'uncommon', R: 'rare', UR: 'ultra' };

const cards = [];
function add(c) {
  c.kw = c.kw || {};
  c.cls = c.cls || [];
  c.villain = !!c.villain;
  c.reservable = c.reservable ?? (c.rarity !== 'UR');
  if (!c.id) c.id = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  cards.push(c);
  return c;
}
const P = (temp, o) => add({ type: 'personality', temp, ...o });
const POS = (temp, o) => add({ type: 'position', temp, ...o });
const OPP = (temp, o) => add({ type: 'opportunity', temp, ...o });
const CAL = (temp, o) => add({ type: 'calamity', temp, ...o });
const GRA = (temp, o) => add({ type: 'grace', temp, ...o });
const COM = (temp, o) => add({ type: 'community', temp, ...o });

// ───────────────────────────── HOPE ─────────────────────────────
P(T.HOPE, { name: 'GR80, Monk', cls: ['Monk'], cost: 4, yield: 1, res: 6, rarity: 'R', kw: { hedged: true },
  text: 'Hedged. Whenever you play a Grace, GR80 produces its Yield without Working.',
  onGrace: (g, p, inst) => g.profit(p, g.yieldOf(p, inst), inst.card.name) });
P(T.HOPE, { name: 'GR80, Abbot', cls: ['Monk'], cost: 6, yield: 2, res: 7, rarity: 'UR', kw: { hedged: true, ascend: 3 },
  text: 'Ascend 3. Hedged. Your Grace cards cost 1 less. When you play a Grace, remove 1 Drawdown from each of your cards.',
  mods: { cost: (g, p, card) => (card.type === 'grace' ? -1 : 0) },
  onGrace: (g, p) => g.floor(p).forEach((i) => g.heal(i, 1)) });
P(T.HOPE, { name: 'Sister Ledger', cls: ['Cleric'], cost: 2, yield: 1, res: 3, rarity: 'C',
  text: 'When hired: gain 1 Credibility.', onHired: (g, p) => g.token(p, 'credibility', 1) });
P(T.HOPE, { name: 'The Almoner', cls: ['Cleric'], cost: 3, yield: 2, res: 3, rarity: 'C',
  text: 'Work: another Trader unlocks a Reserve card. Gain 2 Credibility.',
  work: (g, p) => { g.unlock(g.opp(p), 1); g.token(p, 'credibility', 2); } });
P(T.HOPE, { name: 'Connor, Reformed', cls: ['Demon'], cost: 6, yield: 3, res: 5, rarity: 'R', kw: { hedged: true, ascend: 3 },
  text: 'Ascend 3. Hedged. When you Ascend this, remove all its Drawdown. It has no Exit Scam.',
  onAscend: (g, p, inst) => g.heal(inst, 'all') });
P(T.HOPE, { name: 'Pilgrim', cls: ['Pilgrim'], cost: 1, yield: 1, res: 2, rarity: 'C',
  text: 'Bank 20: Yield 3.', yieldFn: (g, p, inst, base) => (g.bankAtLeast(p, 20) ? 3 : base) });
P(T.HOPE, { name: 'The Benefactor', cls: ['Whale'], cost: 5, yield: 3, res: 4, rarity: 'U',
  text: 'When Working: another Trader gains 1 Profit into their Portfolio. Gain 2 Credibility.',
  onWorking: (g, p) => { g.profit(g.opp(p), 1, 'Benefactor'); g.token(p, 'credibility', 2); } });
POS(T.HOPE, { name: 'Chapel Fund', cost: 2, res: 3, rarity: 'C', text: 'At the start of your turn, gain 1 Credibility.',
  startOfTurn: (g, p) => g.token(p, 'credibility', 1) });
POS(T.HOPE, { name: 'Tithe Box', cost: 3, res: 4, rarity: 'U', text: 'Whenever you play a Grace, gain 2 Profit into your Portfolio.',
  onGrace: (g, p) => g.profit(p, 2, 'Tithe Box') });
POS(T.HOPE, { name: 'Sanctuary', cost: 4, res: 5, rarity: 'R',
  text: 'Your idle Personalities ignore Externalities. Your Working Personalities are Hedged.',
  mods: { hedged: (g, p, inst) => inst.card.type === 'personality' && inst.working,
          externalityImmune: (g, p, inst) => inst.card.type === 'personality' && !inst.working } });
OPP(T.HOPE, { name: 'Act of Providence', cost: 3, rarity: 'U', text: 'Spend 2 Credibility: bank 5 Profit directly.',
  can: (g, p) => g.has(p, 'credibility', 2), play: (g, p) => { g.spend(p, 'credibility', 2); g.bank(p, 5, 'Act of Providence'); } });
OPP(T.HOPE, { name: 'Small Miracle', cost: 2, rarity: 'C', kw: { hedge: true },
  text: 'Hedge. Prevent all Drawdown one Calamity or Externality would deal to your cards.',
  hedgeEffect: (g, p) => g.prevent('dd'), play: (g, p) => g.setTemp(p, 'preventDd', true) });
GRA(T.HOPE, { name: 'Random Act of Liquidity', cost: 2, rarity: 'C',
  text: 'Another Trader unlocks two Reserve cards. Gain 2 Attention and 4 Profit into your Portfolio.',
  play: (g, p) => { g.unlock(g.opp(p), 2); g.token(p, 'attention', 2); g.profit(p, 4, 'Random Act of Liquidity'); } });
GRA(T.HOPE, { name: 'Bailout', cost: 3, rarity: 'U', target: 'oppPersonalityHurt',
  text: "Remove all Drawdown from another Trader's Personality. Bank 4 Profit directly.",
  play: (g, p, t) => { g.heal(t, 'all'); g.bank(p, 4, 'Bailout'); } });
GRA(T.HOPE, { name: 'Forgiveness', cost: 1, rarity: 'C',
  text: 'Another Trader draws a card. Remove 2 Drawdown from one of your cards and gain 1 Credibility.',
  play: (g, p) => { g.draw(g.opp(p), 1); const t = g.pick(p, g.targets(p, 'ownHurt'), 'heal'); if (t) g.heal(t, 2); g.token(p, 'credibility', 1); } });
GRA(T.HOPE, { name: 'Charity Drive', cost: 4, rarity: 'U',
  text: 'Each other Trader gains 2 Profit into their Portfolio. Gain 6 Profit into your Portfolio and 2 Credibility.',
  play: (g, p) => { g.opps(p).forEach((o) => g.profit(o, 2, 'Charity Drive')); g.profit(p, 6, 'Charity Drive'); g.token(p, 'credibility', 2); } });
GRA(T.HOPE, { name: 'Second Chance', cost: 3, rarity: 'R',
  text: 'Another Trader returns a Personality from their discard to their hand. Return one from yours to your Floor, idle, with no Drawdown.',
  can: (g, p) => g.opp(p).discard.some((c) => c.type === 'personality'),
  play: (g, p) => { g.returnFromDiscard(g.opp(p), 'hand'); g.returnFromDiscard(p, 'floor'); } });
COM(T.HOPE, { name: 'Mutual Aid', cost: 3, rarity: 'C', text: 'Each Trader removes 2 Drawdown from one card and unlocks one Reserve card.',
  play: (g, p) => g.players.forEach((q) => { const t = q.policy.pick(g, q, g.targets(q, 'ownHurt'), 'heal'); if (t) g.heal(t, 2); g.unlock(q, 1); }) });
COM(T.HOPE, { name: 'Whistleblower', cost: 3, rarity: 'U', text: 'Each Villain takes 3 Drawdown. Each Trader controlling no Villains gains 2 Credibility.',
  play: (g, p) => { g.players.forEach((q) => g.villains(q).forEach((v) => g.drawdown(v, 3, 'Whistleblower'))); g.players.forEach((q) => { if (!g.villains(q).length) g.token(q, 'credibility', 2); }); } });
COM(T.HOPE, { name: 'Jubilee', cost: 5, rarity: 'R', text: 'Each Trader banks up to 5 Profit from their Portfolio. Underdog: you bank up to 10 instead.',
  play: (g, p) => g.players.forEach((q) => g.bankFromPortfolio(q, Math.min(q.portfolio, q === p && g.isUnderdog(p) ? 10 : 5), 'Jubilee')) });

// ───────────────────────────── GREED ─────────────────────────────
P(T.GREED, { name: 'Connor, Demon', cls: ['Demon'], villain: true, cost: 5, yield: 4, res: 3, rarity: 'R', kw: { exitScam: 4 },
  text: 'Exit Scam 4. On Reveal of an Externality: gain 3 Profit into your Portfolio.',
  onReveal: (g, p, inst, c) => { if (c.type === 'externality') g.profit(p, 3, 'Connor, Demon'); } });
P(T.GREED, { name: 'Sam, Con-Artist', cls: ['Con-Artist'], villain: true, cost: 3, yield: 1, res: 2, rarity: 'U', kw: { exitScam: 3 },
  text: 'Exit Scam 3. Work: Front-run 3.', workTarget: 'oppPortfolio', work: (g, p, inst, t) => g.frontrun(p, t, 3) });
P(T.GREED, { name: 'The Manipulator', cls: ['Whale'], villain: true, cost: 6, yield: 3, res: 3, rarity: 'UR', kw: { exitScam: 5 },
  text: 'Exit Scam 5. Work: swap the current Market with the Omen.', work: (g) => g.swapMarketWithOmen() });
P(T.GREED, { name: 'Leverage Larry', cls: ['Degen'], cost: 2, yield: 2, res: 2, rarity: 'C', text: 'When Working: this takes 1 Drawdown.',
  onWorking: (g, p, inst) => g.drawdown(inst, 1, 'Leverage') });
P(T.GREED, { name: 'Moon Boy', cls: ['Degen'], cost: 3, yield: 3, res: 2, rarity: 'C', text: 'During Bull Run, Yield 5.',
  yieldFn: (g, p, i, b) => (g.marketIs('Bull Run') ? 5 : b) });
P(T.GREED, { name: 'The Closer', cls: ['Founder'], cost: 4, yield: 3, res: 3, rarity: 'U', text: 'Your Opportunities produce +1 Profit.',
  mods: { opportunityProfit: () => 1 } });
P(T.GREED, { name: 'Yield Chaser', cls: ['Analyst'], cost: 3, yield: 2, res: 3, rarity: 'C', text: 'Bank 20: Yield 4.',
  yieldFn: (g, p, i, b) => (g.bankAtLeast(p, 20) ? 4 : b) });
P(T.GREED, { name: 'Fat Finger', cls: ['Whale'], cost: 5, yield: 5, res: 2, rarity: 'U', text: 'When Liquidated: lose 3 Profit from your Portfolio.',
  onLiquidated: (g, p) => g.loseProfit(p, 3, 'Fat Finger') });
POS(T.GREED, { name: 'Margin Account', cost: 3, res: 3, rarity: 'U', text: 'Lock this: gain 2 Liquidity this turn, then this takes 1 Drawdown.',
  ability: { can: (g, p, inst) => !inst.locked, run: (g, p, inst) => { inst.locked = true; p.turnTemp.liquidity += 2; g.drawdown(inst, 1, 'Margin'); } } });
POS(T.GREED, { name: 'Leverage Pool', cost: 4, res: 4, rarity: 'R', text: 'Interest counts every full 5. When THE CRASH is revealed, Liquidate this.',
  mods: { interestDiv: () => 5 }, onReveal: (g, p, inst, c) => { if (c.id === 'the_crash') g.liquidate(inst, 'THE CRASH'); } });
OPP(T.GREED, { name: 'Arbitrage', cost: 2, rarity: 'C', kw: { seize: 'Analyst' }, text: 'Seize Analyst. Gain 4 Profit into your Portfolio.', profit: 4 });
OPP(T.GREED, { name: 'Early Entry', cost: 3, rarity: 'C', kw: { seize: 'Founder' }, text: 'Seize Founder. Gain 5 Profit into your Portfolio. Bank 20: gain 8 instead.',
  profitFn: (g, p) => (g.bankAtLeast(p, 20) ? 8 : 5) });
OPP(T.GREED, { name: 'Degen Play', cost: 1, rarity: 'C', text: 'Flip a coin. Heads: gain 6 Profit into your Portfolio. Tails: one of your Working Personalities takes 2 Drawdown.',
  play: (g, p) => { if (g.coin()) g.oppProfit(p, 6, 'Degen Play'); else { const t = g.pick(p, g.working(p), 'selfHarm'); if (t) g.drawdown(t, 2, 'Degen Play'); } } });
OPP(T.GREED, { name: 'Pump', cost: 4, rarity: 'U', kw: { seize: 'Whale' }, text: 'Seize Whale. Gain 8 Profit into your Portfolio. Your Working Personalities stay Working through your next Refresh.',
  profit: 8, after: (g, p) => g.setTemp(p, 'stayWorking', true) });
OPP(T.GREED, { name: 'Take the Bag', cost: 5, rarity: 'R', text: 'Bank 5 Profit directly.', play: (g, p) => g.bank(p, 5, 'Take the Bag') });
CAL(T.GREED, { name: 'Sandwich Attack', cost: 3, rarity: 'C', target: 'oppPortfolio', harm: { loss: 4 }, text: 'Front-run 4.', play: (g, p, t) => g.frontrun(p, t, 4) });
CAL(T.GREED, { name: 'Skim', cost: 2, rarity: 'C', target: 'oppPortfolio', harm: { loss: 2 }, text: 'Front-run 2. Draw a card.', play: (g, p, t) => { g.frontrun(p, t, 2); g.draw(p, 1); } });
CAL(T.GREED, { name: 'Hostile Takeover', cost: 6, rarity: 'R', target: 'oppWorkingCheap', harm: { steal: true },
  text: 'Hire a Working opponent Personality of cost 4 or less onto your Floor. It keeps its Drawdown.', play: (g, p, t) => g.takeover(p, t) });
GRA(T.GREED, { name: 'Kickback', cost: 2, rarity: 'U', text: 'Another Trader gains 2 Profit into their Portfolio. Gain 5 Profit into your Portfolio.',
  play: (g, p) => { g.profit(g.opp(p), 2, 'Kickback'); g.oppProfit(p, 5, 'Kickback'); } });
COM(T.GREED, { name: "Everybody's Rich", cost: 4, rarity: 'U', text: 'Each Trader gains 4 Profit into their Portfolio. You gain 2 more.',
  play: (g, p) => { g.players.forEach((q) => g.profit(q, 4, "Everybody's Rich")); g.profit(p, 2, "Everybody's Rich"); } });

// ───────────────────────────── FEAR ─────────────────────────────
P(T.FEAR, { name: '0xNull, Hacker', cls: ['Hacker'], villain: true, cost: 4, yield: 0, res: 2, rarity: 'U',
  text: 'Work: deal 3 Drawdown to a Position.', workTarget: 'oppPosition', work: (g, p, i, t) => g.drawdown(t, 3, '0xNull') });
P(T.FEAR, { name: 'Short-and-Distort', cls: ['Analyst'], villain: true, cost: 3, yield: 1, res: 2, rarity: 'U', kw: { exitScam: 2 },
  text: 'Exit Scam 2. Work: a Working Personality takes 1 Drawdown and its controller loses 1 Profit from their Portfolio.',
  workTarget: 'oppWorking', work: (g, p, i, t) => { g.drawdown(t, 1, 'Short-and-Distort'); g.loseProfit(t.owner, 1, 'Short-and-Distort'); } });
P(T.FEAR, { name: 'The Short Seller', cls: ['Analyst'], cost: 3, yield: 1, res: 3, rarity: 'C', text: 'During Bear Market, Yield 4.',
  yieldFn: (g, p, i, b) => (g.marketIs('Bear Market') ? 4 : b) });
P(T.FEAR, { name: 'The Auditor', cls: ['Analyst'], cost: 4, yield: 2, res: 4, rarity: 'U', text: 'Work: deal 2 Drawdown to a Working Villain or a Position.',
  workTarget: 'oppWorkingVillainOrPosition', work: (g, p, i, t) => g.drawdown(t, 2, 'The Auditor') });
P(T.FEAR, { name: 'Insurance Agent', cls: ['Founder'], cost: 3, yield: 2, res: 3, rarity: 'C', text: 'Your Hedge cards cost 1 less.',
  mods: { cost: (g, p, card) => (card.kw.hedge ? -1 : 0) } });
P(T.FEAR, { name: 'The Bear', cls: ['Whale'], cost: 6, yield: 3, res: 5, rarity: 'UR', kw: { hedged: true },
  text: "Hedged. When Working: each opponent's Working Personality takes 1 Drawdown.",
  onWorking: (g, p) => g.opps(p).forEach((o) => g.working(o).forEach((i) => g.drawdown(i, 1, 'The Bear'))) });
P(T.FEAR, { name: 'Cassandra', cls: ['Oracle'], cost: 4, yield: 2, res: 3, rarity: 'R', text: 'On Reveal of an Externality: its effect does not apply to you.',
  mods: { externalityImmunePlayer: () => true } });
POS(T.FEAR, { name: 'Cold Wallet', cost: 2, res: 5, rarity: 'C', text: "Your Portfolio can't be Front-run.", mods: { noFrontrun: () => true } });
POS(T.FEAR, { name: 'Stop-Loss Order', cost: 3, res: 3, rarity: 'U', text: 'When a Calamity targets one of your cards, lock this: the target takes 1 less Drawdown.', autoShield: 1 });
POS(T.FEAR, { name: 'Short Position', cost: 4, res: 4, rarity: 'U', text: 'On Reveal of a Market: if it is Bear Market or Risk-Off, gain 4 Profit into your Portfolio.',
  onReveal: (g, p, i, c) => { if (c.type === 'market' && (c.name === 'Bear Market' || c.name === 'Risk-Off')) g.profit(p, 4, 'Short Position'); } });
OPP(T.FEAR, { name: 'Stop Loss', cost: 2, rarity: 'C', kw: { hedge: true }, text: 'Hedge. Prevent all Drawdown and Portfolio loss one Calamity or Externality would deal to you.',
  hedgeEffect: (g, p) => { g.prevent('dd'); g.prevent('loss'); }, play: (g, p) => { g.setTemp(p, 'preventDd', true); g.setTemp(p, 'portfolioProtected', true); } });
OPP(T.FEAR, { name: 'Profit from Panic', cost: 3, rarity: 'U', kw: { seize: 'Analyst' },
  text: "Seize Analyst. Gain 2 Profit into your Portfolio for each Drawdown counter on opponents' cards, max 8.",
  profitFn: (g, p) => Math.min(8, 2 * g.opps(p).reduce((s, o) => s + g.floor(o).reduce((a, i) => a + i.drawdown, 0), 0)) });
CAL(T.FEAR, { name: 'Rug Pull', cost: 3, rarity: 'C', target: 'oppWorking', harm: { dd: 3 }, text: 'Deal 3 Drawdown to a Working Personality.', play: (g, p, t) => g.drawdown(t, 3, 'Rug Pull') });
CAL(T.FEAR, { name: 'Hack', cost: 3, rarity: 'C', target: 'oppPosition', harm: { dd: 3 }, text: 'Deal 3 Drawdown to a Position. Draw a card.', play: (g, p, t) => { g.drawdown(t, 3, 'Hack'); g.draw(p, 1); } });
CAL(T.FEAR, { name: 'FUD', cost: 1, rarity: 'C', kw: { hedge: true }, target: 'oppWorking', harm: { dd: 1 }, text: 'Hedge. Deal 1 Drawdown to a Working Personality.',
  play: (g, p, t) => g.drawdown(t, 1, 'FUD'), hedgeEffect: (g, p, threat) => { const t = g.pick(p, g.working(threat.attacker), 'harm'); if (t) g.drawdown(t, 1, 'FUD'); } });
CAL(T.FEAR, { name: 'Liquidity Crisis', cost: 4, rarity: 'U', target: 'oppPlayer', harm: { loss: 4, lock: 3 },
  text: 'Target Trader locks three Reserve cards and loses 4 Profit from their Portfolio.', play: (g, p, t) => { g.forceLock(t, 3); g.loseProfit(t, 4, 'Liquidity Crisis'); } });
CAL(T.FEAR, { name: 'Bank Run', cost: 4, rarity: 'U', target: 'oppPlayer', harm: { loss: 6 }, text: 'Target Trader loses 6 Profit from their Portfolio. Underdog: this costs 2.',
  costFn: (g, p, base) => (g.isUnderdog(p) ? 2 : base), play: (g, p, t) => g.loseProfit(t, 6, 'Bank Run') });
CAL(T.FEAR, { name: 'Liquidation Cascade', cost: 5, rarity: 'R', target: 'oppPlayer', harm: { dd: 2, all: true },
  text: 'Deal 2 Drawdown to each Working Personality an opponent controls.', play: (g, p, t) => g.working(t).forEach((i) => g.drawdown(i, 2, 'Liquidation Cascade')) });
COM(T.FEAR, { name: 'Risk-Off Rally', cost: 3, rarity: 'C', text: "Each Trader's Working Personalities go idle.", play: (g) => g.players.forEach((q) => g.idleAll(q)) });
COM(T.FEAR, { name: 'Circuit Breaker', cost: 2, rarity: 'U', kw: { hedge: true }, text: 'Hedge. No Calamity can be played until your next turn.',
  play: (g, p) => { g.noCalamityUntil = p; }, hedgeEffect: (g, p) => { g.prevent('dd'); g.prevent('loss'); g.noCalamityUntil = p; } });

// ───────────────────────────── HYPE ─────────────────────────────
P(T.HYPE, { name: 'Unihood, Meme Prophet', cls: ['Influencer'], cost: 3, yield: 2, res: 3, rarity: 'R', text: 'Working during Meme Season yields 5 instead.',
  yieldFn: (g, p, i, b) => (g.marketIs('Meme Season') ? 5 : b) });
P(T.HYPE, { name: 'Unihood, Ascended', cls: ['Influencer'], cost: 6, yield: 4, res: 4, rarity: 'UR', kw: { ascend: 3, fast: true },
  text: 'Ascend 3. Fast. Attention you gain is doubled.', mods: { attentionMult: () => 2 } });
P(T.HYPE, { name: 'Paid Shill', cls: ['Shill'], villain: true, cost: 2, yield: 1, res: 2, rarity: 'C',
  text: 'When hired: lose all your Credibility. Work: gain 3 Attention.', work: (g, p) => g.token(p, 'attention', 3) });
P(T.HYPE, { name: 'Bot Farm', cls: ['Shill'], villain: true, cost: 2, yield: 1, res: 2, rarity: 'C', kw: { exitScam: 1 },
  text: 'Exit Scam 1. Work: gain 2 Attention. Each opponent loses 1 Attention.',
  work: (g, p) => { g.token(p, 'attention', 2); g.opps(p).forEach((o) => g.spend(o, 'attention', 1)); } });
P(T.HYPE, { name: 'The Streamer', cls: ['Influencer'], cost: 4, yield: 2, res: 3, rarity: 'U', text: 'Work: gain 2 Attention and draw a card.',
  work: (g, p) => { g.token(p, 'attention', 2); g.draw(p, 1); } });
P(T.HYPE, { name: 'Clout Chaser', cls: ['Degen'], cost: 3, yield: 2, res: 2, rarity: 'C', kw: { fast: true }, text: 'Fast.' });
P(T.HYPE, { name: 'Hype Man', cls: ['Founder'], cost: 4, yield: 1, res: 3, rarity: 'U', text: 'Spend 2 Attention: another of your Personalities yields +2 this turn.',
  ability: { can: (g, p, inst) => g.has(p, 'attention', 2) && g.idleEligible(p).some((i) => i !== inst),
    run: (g, p, inst) => { g.spend(p, 'attention', 2); const t = g.pick(p, g.idleEligible(p).filter((i) => i !== inst), 'buff'); if (t) t.turnBonus += 2; } } });
P(T.HYPE, { name: 'The Celebrity', cls: ['Whale'], cost: 5, yield: 3, res: 3, rarity: 'R', text: 'When hired: gain 3 Attention. You may pay 3 Attention instead of Seizing.',
  onHired: (g, p) => g.token(p, 'attention', 3), mods: { seizeWithAttention: () => true } });
POS(T.HYPE, { name: 'Meme Factory', cost: 3, res: 3, rarity: 'C', text: 'At the start of your turn, gain 1 Attention.', startOfTurn: (g, p) => g.token(p, 'attention', 1) });
POS(T.HYPE, { name: 'Viral Loop', cost: 4, res: 3, rarity: 'R', text: 'Spend 3 Attention: gain 3 Profit into your Portfolio. Any number of times per turn.',
  ability: { can: (g, p) => g.has(p, 'attention', 3), run: (g, p) => { g.spend(p, 'attention', 3); g.profit(p, 3, 'Viral Loop'); } } });
OPP(T.HYPE, { name: 'Viral Moment', cost: 4, rarity: 'C', kw: { seize: 'Influencer' }, text: 'Seize Influencer. Gain 6 Profit into your Portfolio, or 9 during Meme Season.',
  profitFn: (g) => (g.marketIs('Meme Season') ? 9 : 6) });
OPP(T.HYPE, { name: 'Airdrop', cost: 2, rarity: 'C', text: 'Gain 2 Attention. Draw a card.', play: (g, p) => { g.token(p, 'attention', 2); g.draw(p, 1); } });
OPP(T.HYPE, { name: 'Trending', cost: 3, rarity: 'C', text: 'Spend 2 Attention: gain 5 Profit into your Portfolio.',
  can: (g, p) => g.has(p, 'attention', 2), play: (g, p) => { g.spend(p, 'attention', 2); g.oppProfit(p, 5, 'Trending'); } });
OPP(T.HYPE, { name: 'Launch Day', cost: 5, rarity: 'U', kw: { seize: 'Founder' }, text: 'Seize Founder. Gain 7 Profit into your Portfolio. Each opponent gains 2 Attention.',
  profit: 7, after: (g, p) => g.opps(p).forEach((o) => g.token(o, 'attention', 2)) });
OPP(T.HYPE, { name: 'Main Character Moment', cost: 4, rarity: 'R', kw: { seize: 'Influencer' }, text: 'Seize Influencer. Gain Profit into your Portfolio equal to twice your Attention, max 10.',
  profitFn: (g, p) => Math.min(10, 2 * p.tokens.attention) });
CAL(T.HYPE, { name: 'Cancelled', cost: 3, rarity: 'C', target: 'oppWorking', harm: { dd: 2 }, text: 'A Working Personality takes 2 Drawdown. Its controller loses all Attention.',
  play: (g, p, t) => { g.drawdown(t, 2, 'Cancelled'); t.owner.tokens.attention = 0; } });
CAL(T.HYPE, { name: 'FOMO Trap', cost: 3, rarity: 'U', target: 'oppPlayer', harm: { loss: 3 }, text: 'Target Trader loses 3 Profit from their Portfolio. If they have more Attention than you, Front-run 3 instead.',
  play: (g, p, t) => { if (t.tokens.attention > p.tokens.attention) g.frontrun(p, t, 3); else g.loseProfit(t, 3, 'FOMO Trap'); } });
GRA(T.HYPE, { name: 'Shoutout', cost: 2, rarity: 'C', text: 'Another Trader gains 2 Attention. Gain 3 Attention and 2 Profit into your Portfolio.',
  play: (g, p) => { g.token(g.opp(p), 'attention', 2); g.token(p, 'attention', 3); g.profit(p, 2, 'Shoutout'); } });
COM(T.HYPE, { name: 'FOMO', cost: 3, rarity: 'U', text: 'Each Trader gains 3 Profit into their Portfolio. Each Working Personality takes 1 Drawdown.',
  play: (g) => { g.players.forEach((q) => g.profit(q, 3, 'FOMO')); g.players.forEach((q) => g.working(q).forEach((i) => g.drawdown(i, 1, 'FOMO'))); } });
COM(T.HYPE, { name: 'Comeback Narrative', cost: 2, rarity: 'C', text: 'Each Underdog gains 3 Profit into their Portfolio.',
  play: (g) => g.players.forEach((q) => { if (g.isUnderdog(q)) g.profit(q, 3, 'Comeback Narrative'); }) });

// ───────────────────────────── REASON ─────────────────────────────
P(T.REASON, { name: 'Ethan, Junior Analyst', cls: ['Analyst'], cost: 2, yield: 2, res: 3, rarity: 'C', text: '' });
P(T.REASON, { name: 'Ethan, Senior Analyst', cls: ['Analyst'], cost: 5, yield: 4, res: 4, rarity: 'R', kw: { ascend: 3 },
  text: 'Ascend 3. When you Consult, you may Consult again for free.', mods: { consultTwice: () => true } });
P(T.REASON, { name: 'Virgil, Oracle', cls: ['Oracle'], cost: 4, yield: 2, res: 3, rarity: 'U', text: 'On Reveal: look at the new Omen.',
  onReveal: (g, p) => g.peekOmen(p) });
P(T.REASON, { name: 'The Insider', cls: ['Insider'], villain: true, cost: 4, yield: 2, res: 3, rarity: 'U', kw: { exitScam: 2 },
  text: 'Exit Scam 2. Work: look at the Omen and the top two cards of the R-cana deck. You may put the Omen on the bottom.',
  work: (g, p) => { g.peekOmen(p); g.peekDeck(p, 2); if (g.omen && p.policy.bottomOmen(g, p, g.omen)) g.omenToBottom(); } });
P(T.REASON, { name: 'The Quant', cls: ['Analyst'], cost: 3, yield: 1, res: 3, rarity: 'C', text: 'Work: gain 2 Data.', work: (g, p) => g.token(p, 'data', 2) });
P(T.REASON, { name: 'Chart Reader', cls: ['Analyst'], cost: 2, yield: 1, res: 2, rarity: 'C', text: 'Spend 1 Data: this yields +2 this turn.',
  ability: { can: (g, p, inst) => g.has(p, 'data', 1) && !inst.working && g.canWork(p, inst) && inst.turnBonus === 0,
    run: (g, p, inst) => { g.spend(p, 'data', 1); inst.turnBonus += 2; } } });
P(T.REASON, { name: 'The Professor', cls: ['Oracle'], cost: 5, yield: 3, res: 4, rarity: 'U', text: 'Bank 20: Consult costs nothing.',
  mods: { consultFree: (g, p) => g.bankAtLeast(p, 20) } });
P(T.REASON, { name: 'Marisol, Investigator', cls: ['Analyst'], cost: 4, yield: 2, res: 4, rarity: 'R', text: "Work: look at an opponent's hand. If it holds a Villain, draw a card.",
  work: (g, p) => { const o = g.opp(p); g.log(`${p.name} looks at ${o.name}'s hand`); if (o.hand.some((c) => c.villain)) g.draw(p, 1); } });
POS(T.REASON, { name: 'Data Feed', cost: 2, res: 2, rarity: 'C', text: 'At the start of your turn, gain 1 Data.', startOfTurn: (g, p) => g.token(p, 'data', 1) });
POS(T.REASON, { name: 'Research Desk', cost: 3, res: 3, rarity: 'C', text: 'Spend 2 Data: draw a card.',
  ability: { can: (g, p) => g.has(p, 'data', 2), run: (g, p) => { g.spend(p, 'data', 2); g.draw(p, 1); } } });
POS(T.REASON, { name: 'Model Portfolio', cost: 4, res: 4, rarity: 'U', text: 'At your Set, spend 1 Data: Interest counts every full 5 this turn.',
  startOfTurn: (g, p) => { if (p.portfolio >= 5 && g.has(p, 'data', 1)) { g.spend(p, 'data', 1); p.turnTemp.interestDiv = 5; } } });
POS(T.REASON, { name: 'The Terminal', cost: 5, res: 4, rarity: 'R', text: 'When you Consult, also look at the top card of the R-cana deck. Bank 20: Consult is free.',
  mods: { consultSeesTop: () => true, consultFree: (g, p) => g.bankAtLeast(p, 20) } });
OPP(T.REASON, { name: 'Undervalued Asset', cost: 3, rarity: 'C', kw: { seize: 'Analyst' }, text: 'Seize Analyst. Spend 1 Data: gain 5 Profit into your Portfolio.',
  can: (g, p) => g.has(p, 'data', 1), play: (g, p) => { g.spend(p, 'data', 1); g.oppProfit(p, 5, 'Undervalued Asset'); } });
OPP(T.REASON, { name: 'Forecast', cost: 1, rarity: 'C', text: 'Consult for free. Draw a card.', play: (g, p) => { g.consult(p, { free: true }); g.draw(p, 1); } });
OPP(T.REASON, { name: 'Due Diligence', cost: 2, rarity: 'U', text: "Spend 2 Credibility: look at an opponent's hand and discard a Villain from it.",
  can: (g, p) => g.has(p, 'credibility', 2), play: (g, p) => { g.spend(p, 'credibility', 2); g.discardVillainFromHand(g.opp(p)); } });
OPP(T.REASON, { name: 'Perfect Information', cost: 4, rarity: 'U', kw: { seize: 'Oracle' }, text: 'Seize Oracle. Reveal the Omen to all. Gain 6 Profit into your Portfolio if it is a Market, 4 otherwise.',
  play: (g, p) => { g.revealOmen(); g.oppProfit(p, g.omen && g.omen.type === 'market' ? 6 : 4, 'Perfect Information'); } });
CAL(T.REASON, { name: 'Exposé', cost: 3, rarity: 'C', target: 'oppWorking', harm: { dd: 2 }, text: 'Deal 2 Drawdown to a Working Personality, or 4 if it is a Villain.',
  play: (g, p, t) => g.drawdown(t, t.card.villain ? 4 : 2, 'Exposé') });
GRA(T.REASON, { name: 'Shared Research', cost: 2, rarity: 'C', text: 'Another Trader gains 1 Data. Gain 2 Data and 2 Profit into your Portfolio.',
  play: (g, p) => { g.token(g.opp(p), 'data', 1); g.token(p, 'data', 2); g.profit(p, 2, 'Shared Research'); } });
COM(T.REASON, { name: 'Transparency', cost: 2, rarity: 'C', text: 'Each Trader reveals their hand. Each Trader with no Villain in hand draws a card.',
  play: (g) => g.players.forEach((q) => { if (!q.hand.some((c) => c.villain)) g.draw(q, 1); }) });
COM(T.REASON, { name: 'Open Source', cost: 3, rarity: 'U', text: 'Each Trader gains 1 Data. Gain 3 Profit into your Portfolio.',
  play: (g, p) => { g.players.forEach((q) => g.token(q, 'data', 1)); g.profit(p, 3, 'Open Source'); } });

// ───────────────────────────── PATIENCE ─────────────────────────────
P(T.PATIENCE, { name: 'The HODLer', cls: ['HODLer'], cost: 2, yield: 1, res: 4, rarity: 'C', text: 'Yield +1 for every full 10 Profit in your Portfolio, max +3.',
  yieldFn: (g, p, i, b) => b + Math.min(3, Math.floor(p.portfolio / 10)) });
P(T.PATIENCE, { name: 'Grandma Index', cls: ['Value Investor'], cost: 3, yield: 2, res: 5, rarity: 'C', kw: { hedged: true }, text: 'Hedged.' });
P(T.PATIENCE, { name: 'The Custodian', cls: ['Founder'], cost: 4, yield: 1, res: 6, rarity: 'U', text: 'Your Positions are Hedged.',
  mods: { hedged: (g, p, inst) => inst.card.type === 'position' } });
P(T.PATIENCE, { name: 'Old Money', cls: ['Whale'], cost: 6, yield: 3, res: 6, rarity: 'R', text: 'Bank 40: Yield 6.', yieldFn: (g, p, i, b) => (g.bankAtLeast(p, 40) ? 6 : b) });
P(T.PATIENCE, { name: 'Eugene, Pattern Prophet', cls: ['Oracle'], cost: 4, yield: 2, res: 4, rarity: 'U', text: 'On Reveal of a Market: gain 2 Profit into your Portfolio.',
  onReveal: (g, p, i, c) => { if (c.type === 'market') g.profit(p, 2, 'Eugene'); } });
P(T.PATIENCE, { name: 'The Dividend Farmer', cls: ['Value Investor'], cost: 3, yield: 1, res: 4, rarity: 'C', text: 'Your Dividend pays +1.', mods: { dividendDelta: () => 1 } });
P(T.PATIENCE, { name: 'Saint Compound', cls: ['Monk'], cost: 5, yield: 2, res: 5, rarity: 'R', text: 'Interest is paid twice during your Set.', mods: { interestTimes: () => 2 } });
POS(T.PATIENCE, { name: 'Staking Pool', cost: 3, res: 4, rarity: 'C', text: 'Your Dividend pays 2 instead of 1.', mods: { dividendBase: () => 2 } });
POS(T.PATIENCE, { name: 'Blue Chip', cost: 4, res: 5, rarity: 'U', text: 'Bank 20: your Dividend pays 3 instead.', mods: { dividendBase: (g, p) => (g.bankAtLeast(p, 20) ? 3 : 0) } });
POS(T.PATIENCE, { name: 'Vault', cost: 2, res: 6, rarity: 'C', text: "Up to 5 Profit in your Portfolio can't be targeted during opponents' turns.", mods: { vault: () => 5 } });
POS(T.PATIENCE, { name: 'Index Fund', cost: 3, res: 4, rarity: 'U', text: 'At the start of your turn, gain 1 Profit into your Portfolio for every 2 Positions you control.',
  startOfTurn: (g, p) => g.profit(p, Math.floor(g.positions(p).length / 2), 'Index Fund') });
POS(T.PATIENCE, { name: 'Bond Ladder', cost: 4, res: 5, rarity: 'C', text: 'At the start of your turn, gain 2 Profit into your Portfolio.', startOfTurn: (g, p) => g.profit(p, 2, 'Bond Ladder') });
POS(T.PATIENCE, { name: 'The Endowment', cost: 6, res: 7, rarity: 'R', text: 'At the start of your turn, bank 2 Profit directly.', startOfTurn: (g, p) => g.bank(p, 2, 'The Endowment') });
OPP(T.PATIENCE, { name: 'Dollar-Cost Average', cost: 2, rarity: 'C', text: 'Gain 3 Profit into your Portfolio. Bank 20: gain 5 instead.', profitFn: (g, p) => (g.bankAtLeast(p, 20) ? 5 : 3) });
OPP(T.PATIENCE, { name: 'Long-Term Hold', cost: 3, rarity: 'C', kw: { hedge: true }, text: "Hedge. Your Portfolio can't be targeted until your next turn. Gain 2 Profit into your Portfolio.",
  play: (g, p) => { g.setTemp(p, 'portfolioProtected', true); g.profit(p, 2, 'Long-Term Hold'); },
  hedgeEffect: (g, p) => { g.prevent('loss'); g.setTemp(p, 'portfolioProtected', true); g.profit(p, 2, 'Long-Term Hold'); } });
OPP(T.PATIENCE, { name: 'Compounding', cost: 4, rarity: 'U', kw: { seize: 'Value Investor' }, text: 'Seize Value Investor. Gain Profit into your Portfolio equal to the Profit already there, max 8.',
  profitFn: (g, p) => Math.min(8, p.portfolio) });
CAL(T.PATIENCE, { name: 'Vesting Cliff', cost: 3, rarity: 'U', target: 'oppWorking', harm: { dd: 0, stall: true }, text: "A Working Personality stays Working through its controller's next Refresh.",
  play: (g, p, t) => { t.stayWorking = true; } });
GRA(T.PATIENCE, { name: 'Mentorship', cost: 2, rarity: 'C', target: 'oppPersonalityHurt', text: "Remove 2 Drawdown from another Trader's Personality. Draw two cards.",
  play: (g, p, t) => { g.heal(t, 2); g.draw(p, 2); } });
COM(T.PATIENCE, { name: 'Diamond Hands', cost: 2, rarity: 'C', text: "Each Trader's Portfolio can't be targeted until their next turn.", play: (g) => g.players.forEach((q) => g.setTemp(q, 'portfolioProtected', true)) });
COM(T.PATIENCE, { name: 'Slow and Steady', cost: 3, rarity: 'U', text: 'Each Trader gains 2 Profit into their Portfolio. Gain 1 Credibility. Bank 20: also bank 2 directly.',
  play: (g, p) => { g.players.forEach((q) => g.profit(q, 2, 'Slow and Steady')); g.token(p, 'credibility', 1); if (g.bankAtLeast(p, 20)) g.bank(p, 2, 'Slow and Steady'); } });

// ───────────────────────────── TRADERS ─────────────────────────────
export const TRADERS = [
  { id: 'analyst', name: 'THE ANALYST', temps: [T.REASON, T.PATIENCE], text: 'Once per turn, Consult for free.', mods: { consultFreeOnce: () => true } },
  { id: 'degen', name: 'THE DEGEN', temps: [T.HYPE, T.GREED], text: 'Once per turn, a Personality you hire has Fast. Calamities deal 1 extra Drawdown to your Working Personalities.',
    onHire: (g, p, inst) => { if (!p.turnTemp.degenFast) { p.turnTemp.degenFast = true; inst.fast = true; } },
    mods: { incomingDd: (g, p, inst, src) => (src && src.type === 'calamity' && inst.working && inst.card.type === 'personality' ? 1 : 0) } },
  { id: 'hodler', name: 'THE HODLER', temps: [T.HOPE, T.PATIENCE], text: 'Interest counts every full 5 in your Portfolio.', mods: { interestDiv: () => 5 } },
  { id: 'contrarian', name: 'THE CONTRARIAN', temps: [T.FEAR, T.REASON], text: 'While the Market is Bear Market, or no Market is in effect, your Yields are +1.',
    mods: { yield: (g) => (!g.market || g.market.name === 'Bear Market' ? 1 : 0) } },
  { id: 'gambler', name: 'THE GAMBLER', temps: [T.GREED, T.FEAR], text: 'Once per turn when a Personality Works, you may flip a coin. Heads: it yields +3. Tails: it takes 1 Drawdown.',
    onAnyWork: (g, p, inst) => { if (p.turnTemp.gambled) return; if (!p.policy.gamble(g, p, inst)) return; p.turnTemp.gambled = true; if (g.coin()) g.profit(p, 3, 'Gambler heads'); else g.drawdown(inst, 1, 'Gambler tails'); } },
  { id: 'value', name: 'THE VALUE INVESTOR', temps: [T.PATIENCE, T.GREED], text: 'Bank 20: your Opportunities produce +1 Profit. Bank 40: +2 instead.',
    mods: { opportunityProfit: (g, p) => (g.bankAtLeast(p, 40) ? 2 : g.bankAtLeast(p, 20) ? 1 : 0) } },
  { id: 'quant', name: 'THE QUANT', temps: [T.REASON, T.HYPE], text: 'You may spend Data as Attention and Attention as Data.', mods: { tokensInterchangeable: () => true } },
  { id: 'evangelist', name: 'THE EVANGELIST', temps: [T.HOPE, T.HYPE], text: 'Whenever you play a Grace, gain 2 Attention. Whenever an opponent plays a Grace, gain 1 Credibility.',
    onGrace: (g, p) => g.token(p, 'attention', 2), onOppGrace: (g, p) => g.token(p, 'credibility', 1) },
].map((t) => ({ type: 'trader', rarity: 'R', kw: {}, cls: [], ...t }));

// ───────────────────────────── MARKETS ─────────────────────────────
const M = (o) => ({ type: 'market', kw: {}, cls: [], ...o, id: o.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') });
export const MARKETS = [
  M({ name: 'Bull Run', rarity: 'C', text: 'Every Yield is +1.', mods: { yield: () => 1 } }),
  M({ name: 'Bear Market', rarity: 'C', text: 'Fear cards cost 1 less. Yields above 3 are -1.', mods: { cost: (g, p, c) => (c.temp === 'fear' ? -1 : 0), yieldFinal: (g, p, i, y) => (y > 3 ? y - 1 : y) } }),
  M({ name: 'Meme Season', rarity: 'C', text: 'Attention gains are doubled.', mods: { attentionMult: () => 2 } }),
  M({ name: 'Risk-Off', rarity: 'C', text: 'Yields above 3 are halved, rounded up. Hedge cards cost 1 less.', mods: { yieldFinal: (g, p, i, y) => (y > 3 ? Math.ceil(y / 2) : y), cost: (g, p, c) => (c.kw.hedge ? -1 : 0) } }),
  M({ name: 'Sideways', rarity: 'C', text: 'Consult is free.', mods: { consultFree: () => true } }),
  M({ name: 'Altseason', rarity: 'C', text: 'Personalities of cost 3 or less yield +1.', mods: { yield: (g, p, i) => (i.card.cost <= 3 ? 1 : 0) } }),
  M({ name: 'Rate Hike', rarity: 'C', text: 'Interest is not paid.', mods: { interestOff: () => true } }),
  M({ name: 'Liquidity Flood', rarity: 'C', text: 'Each Trader may Reserve twice per turn.', mods: { reserveLimit: () => 2 } }),
  M({ name: 'Dead Cat Bounce', rarity: 'C', text: "Underdogs' Yields are +2.", mods: { yield: (g, p) => (g.isUnderdog(p) ? 2 : 0) } }),
  M({ name: 'Earnings Season', rarity: 'C', text: "Positions' start-of-turn effects happen twice.", mods: { positionsTwice: () => true } }),
  M({ name: 'Irrational Exuberance', rarity: 'U', text: 'Opportunities produce +3 Profit. Calamities deal +1 Drawdown.', mods: { opportunityProfit: () => 3, incomingDd: (g, p, i, src) => (src && src.type === 'calamity' ? 1 : 0) } }),
  M({ name: 'Regulatory Winter', rarity: 'U', text: "Villains can't Work. Exit Scams are doubled.", mods: { villainsCantWork: () => true, exitScamMult: () => 2 } }),
  M({ name: 'Golden Age', rarity: 'U', text: 'Grace cards cost 0. Credibility gains are doubled.', mods: { costOverride: (g, p, c) => (c.type === 'grace' ? 0 : null), credMult: () => 2 } }),
  M({ name: 'Max Pain', rarity: 'U', text: 'Interest is doubled. Every Portfolio loses 2 on each Reveal.', mods: { interestMult: () => 2 }, afterReveal: (g) => g.players.forEach((q) => g.loseProfit(q, 2, 'Max Pain')) }),
  M({ name: 'Narrative Market', rarity: 'U', text: 'Attention and Data are interchangeable.', mods: { tokensInterchangeable: () => true } }),
  M({ name: 'Crypto Winter', rarity: 'U', text: 'No Dividend. Hedged cards yield +1.', mods: { dividendOff: () => true, yield: (g, p, i) => (g.isHedged(p, i) ? 1 : 0) } }),
];

// ───────────────────────────── EXTERNALITIES ─────────────────────────────
const X = (o) => ({ type: 'externality', rarity: 'U', kw: {}, cls: [], ...o, id: o.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') });
export const EXTERNALITIES = [
  X({ name: 'Regulation', text: 'Every Portfolio loses 3. Each Villain takes 2 Drawdown.', harm: { loss: 3, dd: 2 },
    each: (g, p) => { g.loseProfit(p, 3, 'Regulation'); g.villains(p).forEach((v) => g.drawdown(v, 2, 'Regulation')); } }),
  X({ name: 'Rate Shock', text: 'Every Trader locks two Reserve cards.', harm: { lock: 2 }, each: (g, p) => g.forceLock(p, 2) }),
  X({ name: 'Technological Breakthrough', text: 'Every Trader draws two.', harm: {}, each: (g, p) => g.draw(p, 2) }),
  X({ name: 'Crackdown', text: 'Each Villain takes 2 Drawdown. Each Trader loses 1 Profit from their Portfolio per Villain they control.', harm: { dd: 2 },
    each: (g, p) => { const v = g.villains(p); v.forEach((i) => g.drawdown(i, 2, 'Crackdown')); if (v.length) g.loseProfit(p, v.length, 'Crackdown'); } }),
  X({ name: 'Pandemic', text: 'Every Working Personality takes 1 Drawdown. Each Trader gains 1 Credibility.', harm: { dd: 1 },
    each: (g, p) => { g.working(p).forEach((i) => g.drawdown(i, 1, 'Pandemic')); g.token(p, 'credibility', 1); } }),
  X({ name: 'Geopolitical Crisis', text: 'Discard the current Market. No Market is in effect until the next Reveal. Every Portfolio loses 2.', harm: { loss: 2 },
    global: (g) => g.clearMarket('Geopolitical Crisis'), each: (g, p) => g.loseProfit(p, 2, 'Geopolitical Crisis') }),
  X({ name: 'Stimulus', text: 'Every Trader gains 3 Profit into their Portfolio and unlocks all Reserve cards.', harm: {},
    each: (g, p) => { g.profit(p, 3, 'Stimulus'); g.unlock(p, 99); } }),
  X({ name: 'Exchange Collapse', text: 'The Trader with the most Profit in Portfolio loses half of it, rounded down.', harm: { half: true },
    global: (g) => { const mx = Math.max(...g.players.map((q) => q.portfolio)); if (mx > 0) g.players.filter((q) => q.portfolio === mx).forEach((q) => g.loseProfit(q, Math.floor(q.portfolio / 2), 'Exchange Collapse')); } }),
];

// ───────────────────────────── MAJOR R-CANA ─────────────────────────────
const MJ = (o) => ({ type: 'major', rarity: 'UR', kw: {}, cls: [], ...o });
export const MAJORS = [
  MJ({ id: 'the_bubble', name: 'THE BUBBLE', text: 'Every Yield is doubled. Interest is doubled. Put THE CRASH into the Omen slot if it is not already in Providence, and put the current Omen on top of the deck.',
    mods: { yieldFinal: (g, p, i, y) => y * 2, interestMult: () => 2 }, resolve: (g) => g.summonCrash() }),
  MJ({ id: 'the_crash', name: 'THE CRASH', text: 'Every Portfolio is emptied. Every Working Personality takes 2 Drawdown. Invoke 2: remove 2 Drawdown from one of your cards.',
    resolve: (g) => { g.players.forEach((q) => g.loseProfit(q, q.portfolio, 'THE CRASH')); g.players.forEach((q) => g.working(q).forEach((i) => g.drawdown(i, 2, 'THE CRASH'))); },
    invoke: { cost: 2, can: (g, p) => g.targets(p, 'ownHurt').length > 0, run: (g, p) => { const t = g.pick(p, g.targets(p, 'ownHurt'), 'heal'); if (t) g.heal(t, 2); } } }),
  MJ({ id: 'the_fed', name: 'THE FED', text: 'The current Market is discarded and no Market is in effect until the next one. Invoke 2: reveal the Omen to all.',
    resolve: (g) => g.clearMarket('THE FED'), invoke: { cost: 2, can: (g, p) => !!g.omen && !p.known.omen, run: (g) => g.revealOmen() } }),
  MJ({ id: 'the_whale', name: 'THE WHALE', text: 'The Trader with the most Profit in Portfolio banks half of it, rounded down, and loses the rest.',
    resolve: (g) => { const mx = Math.max(...g.players.map((q) => q.portfolio)); if (mx > 0) g.players.filter((q) => q.portfolio === mx).forEach((q) => { const h = Math.floor(q.portfolio / 2); g.bankFromPortfolio(q, h, 'THE WHALE'); g.loseProfit(q, q.portfolio, 'THE WHALE'); }); } }),
  MJ({ id: 'the_oracle', name: 'THE ORACLE', text: 'Reveal the top three cards of the R-cana deck. The Underdog puts them back in any order.',
    resolve: (g) => g.oracleReorder() }),
  MJ({ id: 'the_unicorn', name: 'THE UNICORN', text: 'Each Trader may hire a Personality from their hand for free. It cannot Work this round.',
    resolve: (g) => g.players.forEach((q) => { const c = q.policy.pickFreeHire(g, q); if (c) g.hire(q, c, { free: true }); }) }),
  MJ({ id: 'the_hail_mary', name: 'THE HAIL MARY', text: 'Invoke 3, Underdog only: flip a coin. Heads: double your Portfolio. Tails: empty it. Once per game per Trader.',
    resolve: () => {}, invoke: { cost: 3, can: (g, p) => g.isUnderdog(p) && !p.hailMaryUsed && p.portfolio >= 4,
      run: (g, p) => { p.hailMaryUsed = true; if (g.coin()) g.profit(p, p.portfolio, 'HAIL MARY heads'); else g.loseProfit(p, p.portfolio, 'HAIL MARY tails'); } } }),
  MJ({ id: 'our_lady', name: 'OUR LADY OF PERPETUAL PROFIT', text: 'The Trader with the most Grace cards in their discard banks their entire Portfolio immediately and all their Personalities go idle. Ties bless everyone.',
    resolve: (g) => { const n = (q) => q.discard.filter((c) => c.type === 'grace').length; const mx = Math.max(...g.players.map(n)); g.players.filter((q) => n(q) === mx).forEach((q) => { g.bankFromPortfolio(q, q.portfolio, 'OUR LADY'); g.idleAll(q); }); } }),
];

export const DECK_CARDS = cards;
export const ALL_CARDS = [...cards, ...TRADERS, ...MARKETS, ...EXTERNALITIES, ...MAJORS];
export const byId = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));
export const byName = Object.fromEntries(ALL_CARDS.map((c) => [c.name, c]));
export function card(nameOrId) {
  const c = byName[nameOrId] || byId[nameOrId];
  if (!c) throw new Error('Unknown card: ' + nameOrId);
  return c;
}
