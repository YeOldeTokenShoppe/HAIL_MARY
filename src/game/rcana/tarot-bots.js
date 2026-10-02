// Policies for the tarot configuration: a heuristic "strong" player and a uniformly random one.
const sum = (a) => a.reduce((x, y) => x + y, 0);

export class RandomPolicy {
  constructor(rng) { this.rng = rng; this.name = 'Random'; }
  bankAmount(g, p) { return Math.floor(this.rng() * (p.portfolio + 1)); }
  wantHedge(g, p, opts) { return this.rng() < 0.5 ? opts[Math.floor(this.rng() * opts.length)] : null; }
  bottomCard(g, p) { return this.rng() < 0.5; }
  hailMaryPass(g, p) { return this.rng() < 0.5; }
  reorder(g, p, cards) { return [...cards].sort(() => this.rng() - 0.5); }
  async takeTurn(g, p) {
    let guard = 0;
    while (!g.over && guard++ < 30) {
      const acts = g.actions(p); if (!acts.length) break;
      const k = Math.floor(this.rng() * (acts.length + 1)); if (k === acts.length) break; // pass
      await g.act(p, acts[k]);
    }
  }
}

const HARMFUL = new Set(['THE REGULATOR', 'THE LIQUIDATION', 'THE CRASH', 'THE AUDIT', 'VOLATILITY']);

export class StrongPolicy {
  constructor(opts = {}) { this.name = 'Strong'; this.keep = 0; this.insurance = 1; this.usePass = true; this.passMargin = 0.15; Object.assign(this, opts); }
  // Chance the pass survives one full round: no opponent Chain or reversed Cup, no harmful Event.
  passSurvival(g, p) {
    let q = 1;
    for (const o of g.opps(p)) {
      const deck = o.deck || g.deck || []; const unseen = deck.length + o.hand.length;
      const threats = deck.filter((c) => c.type === 'pip' && ((c.suit === 'chains' && !c.reversed) || (c.suit === 'cups' && c.reversed))).length
        + o.hand.filter((c) => c.type === 'pip' && ((c.suit === 'chains' && !c.reversed) || (c.suit === 'cups' && c.reversed))).length;
      const frac = unseen ? threats / unseen : 0.25;
      const pNoThreatInHand = Math.pow(1 - frac, o.hand.length + 1);
      q *= g.modAny(p, 'portfolioSafe') ? 1 : pNoThreatInHand;
    }
    q *= 0.9; // Events: Regulator, Crash, Audit, Volatility
    return q;
  }
  hailMaryPass(g, p) {
    if (!this.usePass) return false;
    const q = this.passSurvival(g, p); const m = g.rules.passMult;
    const behind = g.isUnderdog(p) ? 0.1 : 0;
    return q * m > 1 + this.passMargin - behind;
  }
  horizon(g) { const left = g.bellRound != null ? g.bellRound - g.round + 1 : Math.max(1, Math.round(g.deck.length / (g.players.length * g.rules.minorsPerTurn * 1.3))); return Math.max(1, Math.min(4, left)); }
  bankAmount(g, p) {
    if ((g.bellRound != null && g.round >= g.bellRound) || p.bank + p.portfolio >= g.rules.winBank) return p.portfolio;
    if (g.modAny(p, 'portfolioSafe')) return Math.max(0, p.portfolio - 10); // safe to leave 10 for Interest
    return Math.max(0, p.portfolio - this.keep);
  }
  wantHedge(g, p, opts, threat) {
    const t = threat.target; let harm;
    if (t.isPass) harm = p.inAir * 1.2;
    else if (t.card) { const kills = t.drawdown + threat.amount >= t.card.res; harm = kills ? 2 + g.yieldOf(p, t) * this.horizon(g) + (t.card.kw.exitScam || 0) : threat.amount * 0.4; }
    else harm = Math.min(threat.amount, p.portfolio);
    const best = opts.filter((c) => c.rank <= threat.amount + 1).sort((a, b) => a.rank - b.rank).find((c) => c.rank >= Math.min(threat.amount, t.card ? threat.amount - (t.card.res - t.drawdown - 1) : threat.amount)) || [...opts].sort((a, b) => b.rank - a.rank)[0];
    if (!best) return null;
    const value = harm - g.costOf(p, best) * 0.5 - best.rank * 0.3;
    return value >= 1.5 ? best : null;
  }
  bottomCard(g, p, c) { if (c.type !== 'major') return false; if (HARMFUL.has(c.name)) return !(c.name === 'VOLATILITY' && g.richestOpp(p) && g.richestOpp(p).portfolio > p.portfolio); if (c.name === 'THE RECKONING') return g.isUnderdog(p); return false; }
  reorder(g, p, cards) { return [...cards].sort((a, b) => (this.bottomCard(g, p, a) ? 1 : 0) - (this.bottomCard(g, p, b) ? 1 : 0)); }
  courtValue(g, p, c, h) {
    const fake = { card: c, owner: p, working: false, drawdown: 0, hiredTurn: 0 }; const y = g.yieldOf(p, fake);
    let v = y * h * 0.9 + (c.kw.fast ? y : 0);
    const extra = { coins_queen: 1.5, coins_king: p.portfolio >= 5 ? 2 : 1, candles_page: 1, candles_queen: 1.5, candles_king: 2, chains_knight: 3 * h * 0.6, chains_queen: 1, chains_king: 1.5, cups_page: 2, cups_knight: 1, cups_queen: 2.5, cups_king: 1.5 };
    v += extra[c.id] || 0; v -= (c.kw.exitScam || 0) * 0.2; return v;
  }
  pipValue(g, p, a) {
    const c = a.card; const r = c.rank;
    if (c.suit === 'coins') return r + g.modSum(p, 'coinsBonus');
    if (c.suit === 'candles') return (r * g.modProduct(p, 'candlesMult') + g.modSum(p, 'candlesBonus')) + g.yieldOf(p, a.choice.inst) - 0; // includes the Work it triggers
    if (c.suit === 'cups') { const m = g.modProduct(p, 'cupsMult'); const o = a.choice.opp; const favorV = g.rules.v1b && !c.reversed ? 0.6 : 0; const lead = o ? g.opps(p).reduce((mx, q) => Math.max(mx, q.bank), 0) - o.bank : 0; return favorV + r * m + g.modSum(p, 'cupsBonus') - Math.ceil(r / 2) * m * 0.7 + lead * 0.02; }
    const t = a.choice.target; const amt = r * g.modProduct(p, 'chainsMult') + g.modSum(p, 'chainsBonus');
    if (t.isPass) return t.owner.inAir * 0.9 + Math.min(amt, t.owner.inAir);
    if (t.card) { const kills = t.drawdown + amt >= t.card.res; return kills ? 2 + g.yieldOf(t.owner, t) * this.horizon(g) * 0.8 + (t.card.kw.exitScam || 0) : amt * 0.35; }
    return Math.min(amt, t.portfolio) * 1.3;
  }
  score(g, p, a) {
    const h = this.horizon(g);
    switch (a.t) {
      case 'hire': return this.courtValue(g, p, a.card, h) - a.cost * 0.2;
      case 'pip': { let v = this.pipValue(g, p, a) - a.cost * 0.2; if (a.card.suit === 'chains' && this.insurance && p.hand.filter((c) => c.suit === 'chains').length <= 1 && v < 4) v -= 1.5; return v; }
      case 'work': return a.ability ? (a.inst.card.id === 'chains_knight' && g.richestOpp(p) ? Math.min(3, g.richestOpp(p).portfolio) * 1.3 : 0.5) : g.yieldOf(p, a.inst);
      case 'foretell': return a.favor ? (p.favor >= 3 ? 0.6 : -1) : 0.6;
      case 'copy': { const y = g.yieldOf(a.inst.owner, a.inst); return (g.rules.copyYield === 'full' ? y : Math.ceil(y / 2)) + (g.rules.copyFavor ? 0.4 : 0) - 0.3; }
      case 'invoke': { const m = a.major; if (m.id === 'major_0') return p.portfolio >= 8 && (g.rules.v1b || g.isUnderdog(p)) ? 2.5 : -1; if (m.id === 'major_1') return 2.2; if (m.id === 'major_6') return g.bestIdle(p) ? 3 + g.yieldOf(p, g.bestIdle(p)) : -1; if (m.id === 'major_9') return p.portfolio >= 5 ? 2 : 0.5; return 0; }
      default: return -1;
    }
  }
  reserveChoice(g, p) {
    if (!p.hand.length) return null; const liq = g.liquidity(p) + 1; const h = this.horizon(g);
    const use = (c) => { let v = c.type === 'court' ? this.courtValue(g, p, c, h) : c.rank * (c.suit === 'chains' ? 0.7 : 1); if (c.cost > liq + 2) v *= 0.6; if (c.suit === 'candles' && !p.floor.length) v *= 0.5; return v / Math.max(1, Math.sqrt(c.cost)); };
    return [...p.hand].sort((a, b) => use(a) - use(b))[0];
  }
  async takeTurn(g, p) {
    // Reserve first unless the hand is tiny and everything is playable
    if (p.hand.length >= 3 || g.liquidity(p) < 2) { const c = this.reserveChoice(g, p); if (c) await g.act(p, { t: 'reserve', card: c }); }
    let guard = 0;
    while (!g.over && guard++ < 30) {
      const acts = g.actions(p).filter((a) => a.t !== 'reserve'); let best = null, bs = 0.25;
      for (const a of acts) { const s = this.score(g, p, a) + g.rng() * 1e-3; if (s > bs) { bs = s; best = a; } }
      if (!best) break; await g.act(p, best);
    }
  }
}

// Naive: plays random legal actions but never passes while it can act, banks everything, hedges when it can.
export class NaivePolicy extends RandomPolicy {
  constructor(rng) { super(rng); this.name = 'Naive'; }
  bankAmount(g, p) { return p.portfolio; }
  hailMaryPass() { return true; }
  wantHedge(g, p, opts) { return opts.sort((a, b) => b.rank - a.rank)[0]; }
  async takeTurn(g, p) {
    let guard = 0;
    while (!g.over && guard++ < 30) { const acts = g.actions(p); if (!acts.length) break; await g.act(p, acts[Math.floor(this.rng() * acts.length)]); }
  }
}

// A human at the table. The page supplies `ui`, an object of async prompts:
//   ui.setPhase(g, p, { canPass })      → { pass: true } | { bank: n }
//   ui.mainPhase(g, p)                  → resolves when the human ends their turn (the page calls g.act itself)
//   ui.hedge(g, p, options, threat)     → a card or null
//   ui.foretell(g, p, card)             → true to send it to the bottom
export class HumanPolicy {
  constructor(ui) { this.ui = ui; this.name = 'You'; this.human = true; this.pending = null; }
  async hailMaryPass(g, p) { this.pending = await this.ui.setPhase(g, p, { canPass: true }); return !!this.pending.pass; }
  async bankAmount(g, p) { if (!this.pending && p.portfolio === 0) return 0; const d = this.pending || (await this.ui.setPhase(g, p, { canPass: false })); this.pending = null; return d.bank ?? 0; }
  async takeTurn(g, p) { await this.ui.mainPhase(g, p); }
  async wantHedge(g, p, opts, threat) { return this.ui.hedge(g, p, opts, threat); }
  async bottomCard(g, p, c) { return this.ui.foretell(g, p, c); }
  reorder(g, p, cards) { return [...cards].sort((a, b) => (HARMFUL.has(a.name) ? 1 : 0) - (HARMFUL.has(b.name) ? 1 : 0)); }
}
