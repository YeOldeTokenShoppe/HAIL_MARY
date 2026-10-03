// Bot policies for R-cana. A policy answers every decision the engine asks of a
// player. The main phase is a greedy loop over game.actions(p) scored in
// "profit-equivalents". Parameters make different Trader styles testable.

export const PRESETS = {
  banker:   { name: 'Bank everything', keep: 0,  insurance: 0, aggression: 1.0, hedgeThreshold: 2.5 },
  hodler:   { name: 'Keep 20 unbanked', keep: 20, insurance: 1, aggression: 0.8, hedgeThreshold: 2.0 },
  degen:    { name: 'Keep 30, aggressive', keep: 30, insurance: 0, aggression: 1.3, hedgeThreshold: 4.0 },
  cautious: { name: 'Keep 10, insured', keep: 10, insurance: 2, aggression: 0.6, hedgeThreshold: 1.5 },
};

const sum = (a) => a.reduce((x, y) => x + y, 0);

export class Policy {
  constructor(opts = {}) { Object.assign(this, PRESETS.banker, opts); }

  horizon(g) {
    const left = g.finalBellRound != null ? g.finalBellRound - g.round + 1 : Math.max(1, 13 - g.round);
    return Math.max(1, Math.min(4, left));
  }
  // ───── opponents / targets ─────
  chooseOpponent(g, p) { return g.opps(p).sort((a, b) => a.bank - b.bank)[0]; }
  pick(g, p, cands, spec) {
    const score = (c) => {
      if (!c.card) return c.portfolio || 0; // a player: biggest portfolio
      const o = c.owner; const yv = c.card.type === 'personality' ? g.yieldOf(o, c) : 1.5;
      switch (spec) {
        case 'heal': return c.drawdown * (c.card.type === 'personality' ? 1 + yv : 1);
        case 'buff': return yv;
        case 'selfHarm': return (c.card.res - c.drawdown);
        default: { const left = c.card.res - c.drawdown; return yv * 2 + (c.card.kw.exitScam || 0) + (left <= 3 ? 4 - left : 0) + (c.card.villain ? 1 : 0); }
      }
    };
    return [...cands].sort((a, b) => score(b) - score(a))[0];
  }
  gamble(g, p, inst) { return inst.card.res - inst.drawdown >= 2; }
  pickFreeHire(g, p) { return [...p.hand].filter((c) => c.type === 'personality').sort((a, b) => b.cost - a.cost)[0] || null; }
  harmful(g, p, c) {
    if (!c) return false;
    if (c.type === 'externality') return !!(c.harm && (c.harm.loss || c.harm.dd || c.harm.lock || c.harm.half));
    if (c.type === 'major') return c.id === 'the_crash' || c.id === 'the_whale';
    return false;
  }
  bottomOmen(g, p, c) { return this.harmful(g, p, c) && !g.modAny(p, 'externalityImmunePlayer'); }
  reorder(g, p, cards) { return [...cards].sort((a, b) => (this.harmful(g, p, a) ? 1 : 0) - (this.harmful(g, p, b) ? 1 : 0)); }
  mulligan(g, p) { // bottom cards costing 5+ if hand has fewer than 3 cards costing <= 3
    const cheap = p.hand.filter((c) => c.cost <= 3).length;
    return cheap < 3 ? p.hand.filter((c) => c.cost >= 5) : [];
  }

  // ───── banking ─────
  bankAmount(g, p) {
    const lastCall = g.finalBellRound != null && g.round >= g.finalBellRound;
    if (lastCall || p.bank + p.portfolio >= 80 || g.round >= 12) return p.portfolio;
    return Math.max(0, p.portfolio - this.keep);
  }

  // ───── hedging ─────
  wantHedge(g, p, options, threat) {
    const c = threat.card; const h = c.harm || {};
    let dd = 0, loss = 0;
    if (threat.kind === 'calamity') {
      const t = threat.target;
      if (t && t.card) { dd = (h.dd || 0) + (t.card.villain && c.id === 'expos' ? 2 : 0); const kills = t.drawdown + dd >= t.card.res; dd = kills ? 3 + g.yieldOf(p, t) + (t.card.kw.exitScam || 0) : dd * 0.6; if (h.steal) dd = 4 + g.yieldOf(p, t); }
      if (h.loss) loss = Math.min(h.loss, p.portfolio); if (h.all) dd = sum(g.working(p).map((i) => (i.drawdown + 2 >= i.card.res ? 3 + g.yieldOf(p, i) : 1.2)));
    } else {
      if (h.loss) loss = Math.min(h.loss, p.portfolio); if (h.half) loss = Math.floor(p.portfolio / 2);
      if (h.dd) dd = sum(g.villains(p).map((i) => (i.drawdown + h.dd >= i.card.res ? 3 : 1))) + (c.id === 'pandemic' ? sum(g.working(p).map((i) => (i.drawdown + 1 >= i.card.res ? 3 : 0.5))) : 0);
      if (h.lock) loss += 0.5;
    }
    const best = options.map((o) => {
      let v = 0; const fx = o.id;
      if (fx === 'stop_loss' || fx === 'circuit_breaker') v = dd + loss; else if (fx === 'small_miracle') v = dd; else if (fx === 'long_term_hold') v = loss + 2; else if (fx === 'fud') v = threat.attacker && g.working(threat.attacker).length ? 0.8 : 0;
      return { o, v: v - g.costOf(p, o) * 0.3 };
    }).sort((a, b) => b.v - a.v)[0];
    return best && best.v >= this.hedgeThreshold ? best.o : null;
  }

  // ───── valuation ─────
  estProfit(g, p, card) { // for opportunity-like cards
    if (card.profitFn) return card.profitFn(g, p) + g.modSum(p, 'opportunityProfit');
    if (card.profit != null) return card.profit + g.modSum(p, 'opportunityProfit');
    const m = g.modSum(p, 'opportunityProfit');
    switch (card.id) {
      case 'act_of_providence': return 5.5; case 'take_the_bag': return 5.5; case 'degen_play': return 2.4 + m / 2; case 'trending': return 5 + m - 1;
      case 'airdrop': return 1.6; case 'undervalued_asset': return 5 + m - 0.5; case 'forecast': return 1.3; case 'due_diligence': return g.opp(p).hand.some((c) => c.villain) ? 2 : 0.3;
      case 'perfect_information': return 5 + m; case 'small_miracle': case 'stop_loss': return 0.2; case 'long_term_hold': return 2 + (p.portfolio >= 8 ? 1.5 : 0);
      default: return 2;
    }
  }
  estGrace(g, p, card) {
    switch (card.id) {
      case 'random_act_of_liquidity': return 4 + 1 - 1.2; case 'bailout': return 4 - 1; case 'forgiveness': return 1.5; case 'charity_drive': return 6 + 1 - 1.5;
      case 'second_chance': return 3; case 'kickback': return 5 - 1.4; case 'shoutout': return 2 + 1.5 - 0.8; case 'shared_research': return 2 + 1 - 0.4; case 'mentorship': return 2.4 - 0.8;
      default: return 1.5;
    }
  }
  estCommunity(g, p, card) {
    const und = g.isUnderdog(p);
    switch (card.id) {
      case 'mutual_aid': return sum(p.floor.map((i) => Math.min(2, i.drawdown))) + 0.5; case 'whistleblower': return g.opps(p).reduce((s, o) => s + g.villains(o).length * 3, 0) - g.villains(p).length * 3 + (g.villains(p).length ? 0 : 1);
      case 'jubilee': return und ? 6 : 2; case 'everybody_s_rich': return 2.5; case 'risk_off_rally': return g.opps(p).reduce((s, o) => s + g.working(o).length, 0) ? 0.5 : 0;
      case 'circuit_breaker': return 0.3; case 'fomo': return 3 - g.working(p).length * 0.5; case 'comeback_narrative': return und ? 3 : 0;
      case 'transparency': return p.hand.some((c) => c.villain) ? 0.2 : 1; case 'open_source': return 3.5; case 'diamond_hands': return p.portfolio >= 6 ? 2 : 0.3; case 'slow_and_steady': return 2.5 + (g.bankAtLeast(p, 20) ? 2 : 0);
      default: return 1.5;
    }
  }
  estPersonality(g, p, card, h) {
    const fake = { card, owner: p, working: false, drawdown: 0, turnBonus: 0, hiredTurn: 0, fast: false, stack: [] };
    let y = g.yieldOf(p, fake);
    let v = y * h * 0.9 + (card.kw.fast ? y : 0);
    const abil = { sam_con_artist: 3.3, the_manipulator: 2, _0xnull_hacker: 2.2, short_and_distort: 1.8, the_auditor: 1.5, paid_shill: 1.2, bot_farm: 1.2, the_streamer: 2.2, the_quant: 1.2, the_insider: 1.2, marisol_investigator: 0.8, the_almoner: 1.2 };
    if (abil[card.id]) v = Math.max(v, abil[card.id] * h * 0.8);
    const stat = { the_closer: 2, insurance_agent: 0.5, the_bear: 2.5, cassandra: 1.5, the_celebrity: 2, hype_man: 2, chart_reader: 1.5, the_custodian: 0.5, the_dividend_farmer: h, saint_compound: p.portfolio >= 10 ? 2 : 0.8, the_benefactor: 1, gr80_monk: 1.5, gr80_abbot: 2, sister_ledger: 0.5, connor_demon: 1.5, virgil_oracle: 1, eugene_pattern_prophet: 1.5, the_professor: 0.5, ethan_senior_analyst: 0.5, unihood_ascended: 1 };
    v += stat[card.id] || 0;
    if (card.villain) v -= 0.5 + Math.min(2, p.tokens.credibility * 0.5);
    v -= (card.kw.exitScam || 0) * 0.15;
    return v;
  }
  estPosition(g, p, card, h) {
    const t = { chapel_fund: 0.5, tithe_box: 1.2, sanctuary: 1.5, margin_account: 1.5, leverage_pool: p.portfolio >= 5 ? 2 : 1, cold_wallet: 0.8, stop_loss_order: 1, short_position: 1.2, meme_factory: 0.8, viral_loop: 2, data_feed: 0.7, research_desk: 0.8, model_portfolio: 1, the_terminal: 1, staking_pool: 1, blue_chip: g.bankAtLeast(p, 20) ? 2 : 0.5, vault: 0.8, index_fund: Math.max(0.5, g.positions(p).length / 2), bond_ladder: 2, the_endowment: 2.4 };
    return (t[card.id] ?? 1) * h;
  }
  estCalamity(g, p, card, target) {
    const h = card.harm || {}; let v = 0;
    if (target && target.card) {
      const o = target.owner; const y = target.card.type === 'personality' ? g.yieldOf(o, target) : 1.5;
      let dd = h.dd || 0; if (card.id === 'expos' && target.card.villain) dd = 4;
      const kills = dd > 0 && target.drawdown + dd >= target.card.res;
      v = kills ? 2 + y * this.horizon(g) * 0.7 + (target.card.kw.exitScam || 0) : dd * 0.5;
      if (h.steal) v = 3 + y * this.horizon(g) * 0.8;
      if (h.stall) v = y * 0.8;
      if (card.id === 'cancelled') v += o.tokens.attention * 0.3;
    } else if (target) {
      const o = target;
      if (h.loss) v = Math.min(h.loss, o.portfolio) * (card.play && /frontrun/.test(card.play.toString()) ? 1.4 : 0.9);
      if (card.id === 'fomo_trap') v = Math.min(3, o.portfolio) * (o.tokens.attention > p.tokens.attention ? 1.4 : 0.9);
      if (h.all) v = sum(g.working(o).map((i) => (i.drawdown + 2 >= i.card.res ? 2 + g.yieldOf(o, i) * 2 : 1)));
      if (h.lock) v += 0.8;
      if (o.temp.portfolioProtected && h.loss) v = 0;
    }
    return v * this.aggression;
  }
  estAbility(g, p, inst) {
    const h = this.horizon(g);
    switch (inst.card.id) {
      case 'margin_account': { const liq = g.liquidity(p); const need = g.actions(p).some((a) => a.cost > liq && a.cost <= liq + 2 && a.t !== 'reserve'); return need ? 1.5 : 0; }
      case 'viral_loop': return 3 - 1.2; case 'hype_man': return 2 - 1; case 'chart_reader': return 2 - 0.6; case 'research_desk': return 1.3 - 0.6 * (h < 2 ? 0 : 1);
      default: return 0.5;
    }
  }
  estWorkAbility(g, p, a) {
    const c = a.inst.card; const t = a.target;
    switch (c.id) {
      case 'sam_con_artist': return t ? Math.min(3, t.portfolio) * 1.4 : 0;
      case '_0xnull_hacker': case 'the_auditor': return t ? this.estCalamity(g, p, { harm: { dd: c.id === 'the_auditor' ? 2 : 3 } }, t) / this.aggression : 0;
      case 'short_and_distort': return t ? 0.8 + this.estCalamity(g, p, { harm: { dd: 1 } }, t) / this.aggression : 0;
      case 'the_manipulator': return g.omen && g.omen.type === 'market' ? 1.5 : 0;
      case 'paid_shill': return 1.5 * g.modProduct(p, 'attentionMult'); case 'bot_farm': return 1.3; case 'the_streamer': return 2.2; case 'the_quant': return 1.2; case 'the_almoner': return 1;
      case 'the_insider': return g.omen && !p.known.omen ? 1.2 : 0.3; case 'marisol_investigator': return 0.9;
      default: return 0.5;
    }
  }
  tokenWorth(g, p, c) { return c.id === 'airdrop' ? 1 : 0; }

  scoreAction(g, p, a) {
    const h = this.horizon(g);
    switch (a.t) {
      case 'reserve': return -1; // handled separately
      case 'hire': { const v = a.ascend ? this.estPersonality(g, p, a.card, h) - this.estPersonality(g, p, a.ascend.card, h) + 1 : this.estPersonality(g, p, a.card, h); return v - a.cost * 0.2; }
      case 'open': return this.estPosition(g, p, a.card, h) - a.cost * 0.2;
      case 'play': {
        const c = a.card; let v;
        if (c.type === 'opportunity') v = this.estProfit(g, p, c); else if (c.type === 'calamity') v = this.estCalamity(g, p, c, a.target); else if (c.type === 'grace') v = this.estGrace(g, p, c); else v = this.estCommunity(g, p, c);
        if (c.kw.hedge && this.insurance > 0 && c.id !== 'long_term_hold') v -= 1.5; // keep hedges in hand
        return v - a.cost * 0.2;
      }
      case 'seize': { const c = a.card; const gain = this.estProfit(g, p, c); const lost = a.attention ? 1.5 : g.yieldOf(p, a.inst); return gain - lost + 0.3; }
      case 'work': return a.ability ? this.estWorkAbility(g, p, a) : a.value + (a.inst.card.onWorking && a.inst.card.id === 'leverage_larry' ? -0.3 : 0);
      case 'ability': return this.estAbility(g, p, a.inst);
      case 'consult': { if (p.known.omen) return -1; const v = this.harmful(g, p, g.omen) ? 1.5 : 0.4; return v - a.cost * 0.6; }
      case 'invoke': { const pr = g.providence; if (pr.id === 'the_hail_mary') return p.portfolio >= 6 && g.isUnderdog(p) ? 2 : -1; if (pr.id === 'the_crash') return 1.2; if (pr.id === 'the_fed') return 0.3; return 0; }
      default: return 0;
    }
  }
  reserveChoice(g, p) {
    const cands = p.hand.filter((c) => c.reservable); if (!cands.length) return null;
    const liq = g.liquidity(p) + 1; const h = this.horizon(g);
    const usefulness = (c) => {
      let v;
      if (c.type === 'personality') v = this.estPersonality(g, p, c, h); else if (c.type === 'position') v = this.estPosition(g, p, c, h);
      else if (c.type === 'opportunity') v = this.estProfit(g, p, c) + (c.kw.seize ? 0.5 : 0); else if (c.type === 'calamity') { const ts = c.target ? g.targets(p, c.target) : [null]; v = Math.max(2.5, ...ts.map((t) => this.estCalamity(g, p, c, t))); } else if (c.type === 'grace') v = this.estGrace(g, p, c); else v = this.estCommunity(g, p, c);
      if (c.cost > liq + 2) v *= 0.6; // can't play soon
      if (c.cost > liq + 4) v *= 0.5;
      if (c.kw.hedge) v += this.insurance * 3;
      const dup = p.hand.filter((x) => x === c).length; if (dup > 1) v *= 0.7;
      return v / Math.max(1, Math.sqrt(c.cost));
    };
    return [...cands].sort((a, b) => usefulness(a) - usefulness(b))[0];
  }
  takeTurn(g, p) {
    let guard = 0;
    // reserve first (always, if allowed) — like inking in Lorcana
    while (p.reservedThisTurn < g.reserveLimit(p) && guard++ < 3) { const c = this.reserveChoice(g, p); if (!c) break; g.act(p, { t: 'reserve', card: c }); }
    guard = 0;
    while (!g.over && guard++ < 40) {
      const acts = g.actions(p).filter((a) => a.t !== 'reserve');
      let best = null, bestScore = 0.25;
      const hasHedge = p.hand.some((c) => c.kw.hedge);
      for (const a of acts) {
        let s = this.scoreAction(g, p, a);
        if (a.cost > 0 && hasHedge && this.insurance > 0 && g.liquidity(p) - a.cost < this.insurance && s < 8 && (this.insurance >= 2 || g.round >= 3)) continue;
        if (s > bestScore) { bestScore = s; best = a; }
      }
      if (!best) break;
      g.act(p, best);
    }
  }
}

export function makePolicy(preset = 'banker', overrides = {}) { return new Policy({ ...(PRESETS[preset] || PRESETS.banker), ...overrides }); }
