#!/usr/bin/env node
// La Lotería RL80 — first playable simulation of the post-suit design (see the card-list doc, 2026-10-17).
// Two players, each AS one Trader (ability / credibility / liquidity). An open market row of Assets
// (value + volatility), bought with accumulated liquidity, held in the Portfolio row, sold into the Bank.
// A 20-card caller's deck of Events, one call per round; LA CAMPANA is shuffled into the last five calls.
// Four dual-use Graces each: play for the mercy, or dedicate to the Good Deeds row for Our Lady's d12.
// The die (once a game): only while trailing, once the deck is past half. Answered: everything you have
// goes to Our Lady and comes back doubled, banked. Unanswered: she keeps half. Wealth at the bell =
// Bank + Portfolio value; unspent liquidity counts for nothing.
//   node loteria-sim.js --games 3000 --a strong --b naive
//   node loteria-sim.js --verbose --seed 7 --ta diablito --tb monje
export function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── Los Traders (8): the playable cast ──
export const TRADERS = [
  { key: 'unicornio', name: 'EL UNICORNIO · Eugene', liq: 2, cred: 4, ability: 'peek' },        // sees the next call
  { key: 'detective', name: 'LA DETECTIVE · Marisol', liq: 2, cred: 5, ability: 'clean' },      // her traps survive LA BALANZA
  { key: 'monje', name: 'EL MONJE · GR80', liq: 1, cred: 6, ability: 'devout' },                // dedications count double
  { key: 'diablito', name: 'EL DIABLITO · Connor', liq: 4, cred: 3, ability: 'feeds' },         // +2 Bank per disaster
  { key: 'gato', name: 'EL GATO · Virgil', liq: 1, cred: 4, ability: 'bury' },                  // twice a game, bury the next call
  { key: 'hermana', name: 'LA HERMANA · Sister Ledger', liq: 1, cred: 5, ability: 'books' },    // opens with 3 banked; EL OSO never taxes her sells
  { key: 'sirena', name: 'LA SIRENA · The Influencer', liq: 3, cred: 2, ability: 'pump' },      // twice a game, double one asset until the next call
  { key: 'pregonero', name: 'EL PREGONERO · The Promoter', liq: 3, cred: 3, ability: 'shill' }, // sells pay +1
];

// ── Los Activos (22, two copies each): cost, value, volatility ○◑●, special ──
const A = (key, name, cost, val, vol, o = {}) => ({ type: 'asset', key, name, cost, val, vol, ...o });
export const ASSETS = [
  A('elote', 'EL ELOTE', 6, 6, 1, { appreciates: 1 }),              // +1 value every other round
  A('moneda', 'LA MONEDA', 4, 4, 0, { pays: 1 }),
  A('lingote', 'EL LINGOTE', 5, 5, 0, { immune: true }),
  A('escalera', 'LA ESCALERA', 3, 3, 0, { ladder: 1 }),             // +1 per round held, cap +5
  A('jardin', 'EL JARDÍN', 4, 3, 1, { pays: 2, fragile: true }),    // dies to any disaster
  A('mina', 'LA MINA', 5, 4, 1, { pays: 2, upkeep: 1 }),
  A('pozo', 'EL POZO', 4, 4, 1, { well: true }),                    // +1 Bank when ANY player buys; LA ARAÑA drains it
  A('puente', 'EL PUENTE', 5, 4, 2, { pays: 3, bridge: true }),     // LA ARAÑA burns it
  A('semilla', 'LA SEMILLA', 2, 1, 1, { blooms: 6 }),               // value 6 after five rounds held
  A('llaves', 'LAS LLAVES', 3, 2, 0, { keys: true }),               // your assets cannot be stolen
  A('candado', 'EL CANDADO', 3, 5, 0, { locked: 3 }),               // untouchable and unsellable for 3 rounds
  A('corona', 'LA CORONA', 4, 3, 1, { crown: true }),               // caprice calls skip you
  A('perla', 'LA PERLA', 3, 0, 1, { pearl: true }),                 // hidden 1–6, revealed at sale or the bell
  A('arte', 'EL ARTE', 4, 4, 2, { reprices: 8 }),                   // re-rolls 1–8 at every call
  A('meme', 'EL MEME', 2, 2, 2, { memetic: true }),                 // doubles on bull calls, halves on bear
  A('cohete', 'EL COHETE', 3, 2, 2, { rocket: 3 }),                 // ×3 if LA LUNA is called while held
  A('burbuja', 'LA BURBUJA', 2, 2, 2, { bubble: 3 }),               // +2 per round; pops at its 3rd call
  A('estampita', 'LA ESTAMPITA', 1, 1, 0, { holy: true }),          // may be dedicated as a Grace
  A('tulipan', 'EL TULIPÁN', 2, 2, 2, { tulip: 2 }),                // +2 per round until anyone sells one, then all → 1
  A('alfombra', 'LA ALFOMBRA', 2, 0, 2, { pays: 2, trap: true }),   // yield with no floor; burned by the audit
  A('aire', 'EL AIRE', 2, 5, 2, { trap: true, paper: true }),       // worth 5 on paper, 0 once examined
  A('piramide', 'LA PIRÁMIDE', 3, 8, 2, { pays: 2, drains: 2, trap: true }), // pays out of its own value
];

// ── Los Eventos (20): the caller's deck ──
const E = (key, name, kind, o = {}) => ({ type: 'event', key, name, kind, ...o });
export const EVENTS = [
  E('gallo', 'EL GALLO', 'grace'), E('toro', 'EL TORO', 'market'), E('oso', 'EL OSO', 'market'),
  E('impresora', 'LA IMPRESORA', 'market'), E('luna', 'LA LUNA', 'market'), E('sol', 'EL SOL', 'market'),
  E('paraguas', 'EL PARAGUAS', 'market'), E('cadenas', 'LAS CADENAS', 'market'),
  E('torre', 'LA TORRE', 'disaster'), E('mano', 'LA MANO', 'disaster'), E('balanza', 'LA BALANZA', 'disaster'),
  E('muerte', 'LA MUERTE', 'disaster'), E('arana', 'LA ARAÑA', 'disaster'), E('alacran', 'EL ALACRÁN', 'disaster'),
  E('calavera', 'LA CALAVERA', 'disaster'), E('borracho', 'EL BORRACHO', 'caprice'), E('rueda', 'LA RUEDA', 'caprice'),
  E('ballena', 'LA BALLENA', 'caprice'), E('campana', 'LA CAMPANA', 'final'), E('senora', 'NUESTRA SEÑORA', 'grace'),
];
const BULL = new Set(['toro', 'luna', 'sol']); const BEAR = new Set(['oso', 'torre', 'cadenas']);
export const GRACES = ['vela', 'limosna', 'diezmo', 'promesa']; // dual-use: play, or dedicate for a rung

export class Game {
  constructor({ players, seed = 1, verbose = false, paper = false }) {
    this.rng = makeRng(seed); this.verbose = verbose; this.lines = [];
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, t: cfg.trader,
      cred: cfg.trader.cred, bank: cfg.trader.key === 'hermana' ? 3 : 0, cash: 0, row: [], graces: [...GRACES], deeds: 0,
      dieUsed: false, buries: cfg.trader.key === 'gato' ? 2 : 0, pumps: cfg.trader.key === 'sirena' ? 2 : 0,
      stats: { buys: 0, sells: 0, payouts: 0, dedicated: 0, gracesPlayed: 0, rolled: 0, answered: 0, fireSales: 0 } }));
    // the caller's deck: 19 shuffled, LA CAMPANA into the last five calls
    const rest = this.shuffle(EVENTS.filter((e) => e.key !== 'campana'));
    this.calls = rest.slice(0, 19); this.calls.splice(15 + Math.floor(this.rng() * 5), 0, EVENTS.find((e) => e.key === 'campana'));
    // the asset bazaar: two copies of each, shuffled; a market row of four
    this.bazaar = this.shuffle(ASSETS.flatMap((a) => [this.inst(a), this.inst(a)])); this.row = [this.bazaar.shift(), this.bazaar.shift(), this.bazaar.shift(), this.bazaar.shift()];
    this.paper = paper; this.market = null; this.round = 0; this.called = []; this.over = false; this.buyDiscount = 0;
  }
  inst(a) { return { ...a, held: 0, bubbleCalls: 0, age: 0, cur: a.pearl ? 1 + Math.floor(this.rng() * 6) : a.val }; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  log(t) { if (this.verbose) this.lines.push(`[R${this.round}] ${t}`); }
  opp(p) { return this.players[1 - p.idx]; }
  value(a, p) { if (a.paper && a.examined) return 0; if (a.trap && a.burned) return 0; let v = a.cur; if (this.market && this.market.key === 'toro') v += 1; if (a.pumped) v *= 2; return Math.max(0, v); }
  portfolio(p) { return p.row.reduce((s, a) => s + this.value(a, p), 0); }
  wealth(p) { return p.bank + this.portfolio(p); }
  deeds(p) { const d = p.deeds * (p.t.ability === 'devout' ? 2 : 1); return Math.min(4, d); }
  need(p) { return [12, 11, 9, 5, 1][this.deeds(p)]; }
  dieGate(p) { return !p.dieUsed && this.round > 10 && this.wealth(p) < this.wealth(this.opp(p)); }

  sellPrice(a, p) { let v = this.value(a, p); if (a.trap && !a.paper && !a.piramide) v = a.key === 'alfombra' ? 0 : v; if (p.t.ability === 'shill') v += 1; if (this.market && this.market.key === 'oso' && p.t.ability !== 'books') v -= 1; if (this.market && this.market.key === 'sol') v += 1; return Math.max(0, v); }
  sell(p, a) { if (a.locked && a.age < a.locked) return; if (a.paper) a.examined = true; const v = this.sellPrice(a, p); p.row.splice(p.row.indexOf(a), 1); p.bank += v; p.stats.sells++; if (a.tulip && !this.tulipPopped) { this.tulipPopped = true; for (const q of this.players) for (const x of q.row) if (x.tulip) x.cur = 1; } this.log(`${p.name} sells ${a.name} for ${v}`); }
  buy(p, i) { const a = this.row[i]; if (!a) return; const cost = Math.max(0, a.cost - this.buyDiscount); if (p.cash < cost) return; p.cash -= cost; this.buyDiscount = 0; p.row.push(a); a.boughtRound = this.round; p.stats.buys++; this.row[i] = this.bazaar.shift() || null; for (const q of this.players) for (const x of q.row) if (x.well && !x.burned) { q.cash += 1; } this.log(`${p.name} buys ${a.name} for ${cost}`); }
  fireSale(p) { p.stats.fireSales++; this.log(`${p.name}'s credibility is gone: FIRE SALE`); for (const a of [...p.row]) { a.pumped = false; const v = Math.floor(this.sellPrice(a, p) / 2); p.row.splice(p.row.indexOf(a), 1); p.bank += v; } p.cred = 1; }
  hitCred(p, n) { if (p.shield) return; p.cred -= n; if (p.cred <= 0) this.fireSale(p); }

  resolveCall(c) {
    this.called.push(c.key); this.log(`✦ ¡${c.name}!`);
    const all = this.players;
    if (c.kind === 'market') { this.prevMarket = this.market; if (this.prevMarket && this.prevMarket.key === 'impresora') for (const q of all) for (const a of q.row) if (!a.immune) a.cur = Math.max(0, a.cur - 1); this.market = c; }
    for (const q of all) for (const a of q.row) { if (a.reprices) a.cur = 1 + Math.floor(this.rng() * a.reprices); if (a.bubble) { a.bubbleCalls++; if (a.bubbleCalls >= a.bubble) { a.cur = 0; this.log(`${q.name}'s LA BURBUJA pops`); } } if (a.memetic) { if (BULL.has(c.key)) a.cur *= 2; if (BEAR.has(c.key)) a.cur = Math.ceil(a.cur / 2); } a.pumped = false; }
    switch (c.key) {
      case 'gallo': this.buyDiscount = 1; for (const q of all) q.cash += 1; break;
      case 'luna': for (const q of all) for (const a of q.row) { if (a.vol === 2 && !a.trap) a.cur *= 2; if (a.rocket) a.cur = a.val * a.rocket; } break;
      case 'impresora': for (const q of all) q.cash += 1; break;
      case 'torre': if (this.market && this.market.key === 'paraguas') break; for (const q of all) for (const a of q.row) if (!a.immune && !(a.locked && a.age < a.locked)) a.cur = Math.floor(a.cur / 2); this.disaster(); break;
      case 'mano': if (this.market && this.market.key === 'paraguas') break; for (const q of all) { const t = [...q.row].filter((a) => !(a.locked && a.age < a.locked)).sort((x, y) => y.vol - x.vol || this.value(y, q) - this.value(x, q))[0]; if (t) { q.row.splice(q.row.indexOf(t), 1); this.log(`LA MANO takes ${q.name}'s ${t.name}`); } } this.disaster(); break;
      case 'balanza': for (const q of all) { if (q.t.ability === 'clean') continue; let hit = 0; for (const a of q.row) if (a.trap || a.paper) { a.burned = true; a.examined = true; a.cur = 0; hit++; } if (hit) this.hitCred(q, 2); } this.disaster(); break;
      case 'muerte': for (const q of all) this.hitCred(q, 2); this.disaster(); break;
      case 'arana': for (const q of all) for (const a of q.row) if (a.bridge || a.well) { a.burned = true; a.cur = 0; } this.disaster(); break;
      case 'alacran': { const t = [...all].sort((x, y) => x.cred - y.cred)[0]; this.hitCred(t, 2); this.disaster(); break; }
      case 'calavera': { const s = [...all].sort((x, y) => y.stats.sells - x.stats.sells); if (s[0].stats.sells > s[1].stats.sells) { s[0].bank += 3; s[1].bank = Math.max(0, s[1].bank - 2); } this.disaster(); break; }
      case 'borracho': for (const q of all) { if (q.row.some((a) => a.crown)) continue; const a = this.row[0]; if (a && q.cash >= a.cost) this.buyAs(q, 0); } break;
      case 'rueda': if (!all.some((q) => q.row.some((a) => a.crown))) { const [x, y] = all; [x.row, y.row] = [y.row, x.row]; this.log('LA RUEDA: the portfolios change hands'); } break;
      case 'ballena': { const rich = [...all].sort((x, y) => this.portfolio(y) - this.portfolio(x)); if (rich[0] !== rich[1] && !rich[0].row.some((a) => a.keys) && !rich[1].row.some((a) => a.crown)) { const best = [...rich[0].row].filter((a) => !(a.locked && a.age < a.locked)).sort((x, y) => this.value(y, rich[0]) - this.value(x, rich[0]))[0]; if (best) { rich[0].row.splice(rich[0].row.indexOf(best), 1); rich[1].row.push(best); this.log(`LA BALLENA moves ${best.name}`); } } break; }
      case 'senora': { const d = [...all].sort((x, y) => this.deeds(y) - this.deeds(x)); if (this.deeds(d[0]) > this.deeds(d[1])) { const v = this.portfolio(d[0]); d[0].bank += v; d[0].row = []; this.log(`NUESTRA SEÑORA banks ${d[0].name}'s everything: ${v}`); } break; }
      case 'campana': this.bell = true; break;
    }
  }
  disaster() { for (const q of this.players) { for (const a of [...q.row]) if (a.fragile) { q.row.splice(q.row.indexOf(a), 1); this.log(`${q.name}'s EL JARDÍN dies`); } if (q.t.ability === 'feeds') q.cash += 2; } }
  buyAs(p, i) { this.buy(p, i); }

  async turn(p) {
    p.shield = false;
    // income and payouts
    p.cash += p.t.liq + (this.market && this.market.key === 'impresora' ? 1 : 0);
    for (const a of p.row) {
      a.age++; if (a.appreciates && this.round % 2 === 0) a.cur += 1; if (a.ladder) a.cur = Math.min(a.val + 5, a.cur + 1); if (a.blooms && a.age === 5) a.cur = a.blooms; if (a.tulip && !this.tulipPopped) a.cur += a.tulip;
      if (!a.pays || a.burned) continue; if (this.market && this.market.key === 'cadenas' && (a.key === 'mina' || a.key === 'jardin')) continue;
      let n = a.pays; if (a.upkeep) { if (p.cash >= a.upkeep) p.cash -= a.upkeep; else continue; } if (a.drains) { a.cur = Math.max(0, a.cur - a.drains); if (a.cur <= 0 && a.key === 'piramide' && !a.pays) continue; }
      p.cash += n; p.stats.payouts += n;
    }
    // the die, at the start of the turn
    if (this.dieGate(p) && await p.policy.rollDie(this, p)) {
      p.dieUsed = true; p.stats.rolled = 1; const W = this.wealth(p); const roll = 1 + Math.floor(this.rng() * 12); const need = this.need(p);
      this.log(`✝ ${p.name} gives Our Lady everything (${W}), ${this.deeds(p)} deeds showing. Needs ${need}+… rolls ${roll}`);
      p.row = []; if (roll >= need) { p.bank = W * 2; p.stats.answered = 1; this.log('✝ ANSWERED: doubled and banked'); } else { p.bank = Math.floor(W / 2); this.log('✝ UNANSWERED: she keeps half'); }
    }
    // three actions
    for (let k = 0; k < 3; k++) { p.actionsLeft = 3 - k; const a = await p.policy.act(this, p); if (!a) break; this.doAct(p, a); if (this.hooks && this.hooks.render) await this.hooks.render(); if (this.over) return; } p.actionsLeft = 0;
  }
  actions(p) {
    const A = [];
    this.row.forEach((a, i) => { if (a && p.cash >= Math.max(0, a.cost - this.buyDiscount)) A.push({ t: 'buy', i, a }); });
    for (const a of p.row) if (!(a.locked && a.age < a.locked)) A.push({ t: 'sell', a });
    for (const g of p.graces) { A.push({ t: 'grace', g }); A.push({ t: 'dedicate', g }); }
    for (const a of p.row) if (a.holy) A.push({ t: 'dedicate', g: 'estampita', a });
    if (p.buries > 0) A.push({ t: 'bury' });
    if (p.pumps > 0) for (const a of p.row) if (this.value(a, p) >= 3) A.push({ t: 'pump', a });
    return A;
  }
  doAct(p, act) {
    switch (act.t) {
      case 'buy': this.buy(p, act.i); break;
      case 'sell': this.sell(p, act.a); break;
      case 'bury': { p.buries--; const c = this.calls[this.round]; if (c && c.key !== 'campana') { this.calls.splice(this.round, 1); this.calls.push(c); this.log(`${p.name}'s cat knocks ${c.name} off the table`); } break; }
      case 'pump': p.pumps--; act.a.pumped = true; this.log(`${p.name} pumps ${act.a.name}`); break;
      case 'dedicate': if (act.a) { p.row.splice(p.row.indexOf(act.a), 1); } else { p.graces.splice(p.graces.indexOf(act.g), 1); } p.deeds++; p.stats.dedicated++; this.log(`✧ ${p.name} dedicates ${act.g.toUpperCase()} (${this.deeds(p)} deeds)`); break;
      case 'grace': {
        p.graces.splice(p.graces.indexOf(act.g), 1); p.stats.gracesPlayed++;
        if (act.g === 'limosna') { this.opp(p).bank += 2; p.cash += 3; }
        if (act.g === 'diezmo') p.bank += 2;
        if (act.g === 'promesa') p.shield = true;
        if (act.g === 'vela') p.peeked = this.calls.slice(this.round, this.round + 2).map((c) => c.key);
        this.log(`${p.name} plays ${act.g.toUpperCase()}`); break;
      }
    }
  }
  async run() {
    const order = this.rng() < 0.5 ? [0, 1] : [0, 1]; // seat order fixed; batches alternate by swapping configs
    while (this.round < this.calls.length && !this.bell) {
      const c = this.calls[this.round]; this.resolveCall(c); if (this.hooks && this.hooks.onCall) await this.hooks.onCall(c); if (this.bell === undefined || !this.bell) { }
      for (const i of order) { if (!this.over) { this.active = this.players[i]; if (this.hooks && this.hooks.render) await this.hooks.render(); await this.turn(this.players[i]); } }
      this.round++;
      if (this.bell) break;
    }
    const fin = (q) => q.bank + (this.paper ? Math.floor(this.portfolio(q) / 2) : this.portfolio(q));
    const [x, y] = this.players; const wx = fin(x), wy = fin(y);
    const winner = wx === wy ? null : wx > wy ? x : y;
    if (this.verbose) { this.lines.forEach((l) => console.log(l)); console.log(`BELL at round ${this.round}: ${x.name} ${wx} (bank ${x.bank}) vs ${y.name} ${wy} (bank ${y.bank}) → ${winner ? winner.name + ' WINS' : 'DRAW'}`); }
    return { winner: winner ? winner.name : null, winnerIdx: winner ? winner.idx : -1, rounds: this.round, wealth: [wx, wy], players: this.players.map((q) => ({ name: q.name, trader: q.t.key, wealth: this.wealth(q), ...q.stats, deeds: this.deeds(q), cred: q.cred })) };
  }
}

// ── Policies ──
export class Naive {
  constructor(rng) { this.rng = rng; }
  rollDie() { return true; }
  act(g, p) { const A = g.actions(p); if (!A.length) return null; const k = Math.floor(this.rng() * (A.length + 1)); return k === A.length ? null : A[k]; }
}
export class Strong {
  constructor() {}
  disastersLeft(g) { return g.calls.slice(g.round + 1).filter((c) => c.kind === 'disaster').length; }
  rollDie(g, p) { const odds = (13 - g.need(p)) / 12; const behind = g.wealth(g.opp(p)) - g.wealth(p); const left = g.calls.length - g.round;
    if (odds >= 1) return true; if (left <= 3 && g.wealth(p) * 2 > g.wealth(g.opp(p))) return odds >= 1 / 3 || behind > g.wealth(p); return odds >= 2 / 3 && behind >= 5; }
  assetScore(g, p, a) {
    const left = Math.max(1, g.calls.length - g.round - 1); const dis = this.disastersLeft(g); const horizon = Math.min(left, 8);
    let v = g.value(a, p) - a.cost; if (a.pays) v += (a.pays - (a.upkeep || 0)) * Math.min(horizon, 6) * (a.fragile ? (dis ? 0.4 : 1) : 1);
    if (a.ladder) v += Math.min(5, horizon); if (a.blooms && left >= 5) v += a.blooms - a.val; if (a.appreciates) v += horizon / 2;
    if (a.trap) v -= dis * 1.2; if (a.vol === 2) v -= dis * 0.8; if (a.immune || a.locked) v += dis * 0.5; if (a.keys || a.crown) v += 1;
    if (a.holy) v += 0.5; if (a.rocket && g.calls.slice(g.round + 1).some((c) => c.key === 'luna')) v += 2;
    return v;
  }
  act(g, p) {
    const A = g.actions(p); if (!A.length) return null; const left = g.calls.length - g.round; const dis = this.disastersLeft(g); const behind = g.wealth(g.opp(p)) - g.wealth(p);
    let best = null, bs = 0.4;
    for (const a of A) {
      let s = -1;
      if (a.t === 'buy') s = this.assetScore(g, p, a.a) * 0.5 + 0.8;
      if (a.t === 'sell') { const v = g.sellPrice(a.a, p); const future = this.assetScore(g, p, { ...a.a, cost: 0 }); s = a.a.pumped ? v * 0.9 : (g.paper && left <= 2 ? v * 0.6 : left <= 2 || a.a.immune ? -0.5 : v >= 5 && a.a.vol === 2 && dis >= 1 ? v * 0.35 : a.a.bubble && a.a.bubbleCalls === a.a.bubble - 1 ? v : a.a.tulip && g.value(a.a, p) >= 6 ? v * 0.8 : -0.5); }
      if (a.t === 'dedicate') s = !p.dieUsed && g.deeds(p) < 4 ? (behind > 0 ? 1.2 : 0.4) + (p.t.ability === 'devout' ? 0.6 : 0) - (a.a ? g.value(a.a, p) * 0.3 : a.g === 'diezmo' ? 0.4 : 0.2) : -1;
      if (a.t === 'grace') s = a.g === 'diezmo' ? 0.9 : a.g === 'promesa' && dis >= 2 && p.cred <= 3 ? 1.4 : a.g === 'limosna' ? 0.7 : 0.1;
      if (a.t === 'pump') s = g.value(a.a, p) * 0.5;
      if (a.t === 'bury') { const next = g.calls[g.round + 1]; s = next && next.kind === 'disaster' && g.portfolio(p) > g.portfolio(g.opp(p)) ? 2 : -1; }
      if (s > bs) { bs = s; best = a; }
    }
    return best;
  }
}

// ── CLI ──
const ARGV = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
const args = Object.fromEntries(ARGV.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));
export function playOne({ a = 'strong', b = 'naive', ta = null, tb = null, seed = 1, swap = false, verbose = false, paper = false }) {
  const rng = makeRng(seed * 7 + 3); const pool = [...TRADERS].sort(() => rng() - 0.5);
  const pick = (k) => (k ? TRADERS.find((t) => t.key === k) : pool.pop());
  const P = (kind, s) => (kind === 'naive' ? new Naive(makeRng(s)) : new Strong());
  let players = [{ name: `${a.toUpperCase()} A`, policy: P(a, seed * 31 + 7), trader: pick(ta) }, { name: `${b.toUpperCase()} B`, policy: P(b, seed * 31 + 9), trader: pick(tb) }];
  if (swap) players = [players[1], players[0]];
  return new Game({ players, seed, verbose, paper });
}
if (process.argv[1] && process.argv[1].endsWith('loteria-sim.js')) {
  const games = +(args.games || 1000); const seed = +(args.seed || 1);
  if (args.verbose) { await playOne({ a: args.a || 'strong', b: args.b || 'naive', ta: args.ta, tb: args.tb, seed, verbose: true, paper: +(args.paper||0) === 1 }).run(); process.exit(0); }
  const res = { wins: {}, firstWins: 0, draws: 0, rounds: [], wealth: [], gap: [], byTrader: {}, dice: { rolled: 0, answered: 0, wonAfter: 0 }, stats: {} };
  for (let i = 0; i < games; i++) {
    const g = playOne({ a: args.a || 'strong', b: args.b || 'naive', ta: args.ta, tb: args.tb, seed: seed + i, swap: i % 2 === 1, paper: +(args.paper||0) === 1 });
    const r = await g.run(); const w = r.winner || 'draw'; res.wins[w] = (res.wins[w] || 0) + 1; if (r.winnerIdx === 0) res.firstWins++; if (!r.winner) res.draws++;
    res.rounds.push(r.rounds); res.wealth.push(...r.wealth); res.gap.push(Math.abs(r.wealth[0] - r.wealth[1]));
    for (const p of r.players) { const T = res.byTrader[p.trader] = res.byTrader[p.trader] || { games: 0, wins: 0, wealth: 0 }; T.games++; T.wealth += p.wealth; if (r.winner === p.name) T.wins++;
      if (p.rolled) { res.dice.rolled++; if (p.answered) { res.dice.answered++; if (r.winner === p.name) res.dice.wonAfter++; } }
      for (const k of ['buys', 'sells', 'payouts', 'dedicated', 'gracesPlayed', 'fireSales']) res.stats[k] = (res.stats[k] || 0) + p[k]; }
  }
  const avg = (x) => (x.reduce((s, n) => s + n, 0) / x.length).toFixed(1);
  console.log(`${games} games: ${args.a || 'strong'} vs ${args.b || 'naive'}`);
  console.log('wins', JSON.stringify(res.wins), '| first seat', Math.round(res.firstWins / games * 100) + '%', '| draws', res.draws);
  console.log(`rounds avg ${avg(res.rounds)} | wealth avg ${avg(res.wealth)} | winning gap avg ${avg(res.gap)}`);
  const s = res.stats; const pg = (k) => (s[k] / games).toFixed(1);
  console.log(`per game: buys ${pg('buys')} sells ${pg('sells')} payouts ${pg('payouts')} dedicated ${pg('dedicated')} graces ${pg('gracesPlayed')} fireSales ${pg('fireSales')}`);
  console.log(`die: rolled ${(res.dice.rolled / games).toFixed(2)}/game, answered ${res.dice.rolled ? Math.round(res.dice.answered / res.dice.rolled * 100) : 0}%, roller wins after answer ${res.dice.answered ? Math.round(res.dice.wonAfter / res.dice.answered * 100) : 0}%`);
  console.log('traders:', Object.entries(res.byTrader).map(([k, v]) => `${k} ${Math.round(v.wins / v.games * 100)}% (avg wealth ${(v.wealth / v.games).toFixed(0)})`).join(' | '));
}
