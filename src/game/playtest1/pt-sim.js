#!/usr/bin/env node
// RL80 R-cana — First Playtest (PLAYTEST1.md as a running game).
// 3–4 players, constructed 40-card decks, one main action a turn, race to bank 1,000 Prosperity.
// Liquidity funds plays; Assets sell later for cash or Prosperity; Hazards stick until cleared;
// Remedies, Artifacts (max two equipped), cooperative actions; Good Deeds (max three candles) raise
// the one-per-game Hail Mary from 1/12 up to 8/12 — success clears your hazards and banks 200.
//   node pt-sim.js --games 2000 --players 3 --bots greedy,greedy,random
//   node pt-sim.js --verbose --seed 7 --players 3
export function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── The nineteen designs of the shared starter ──
const D = (key, name, type, cost, o = {}) => ({ key, name, type, cost, ...o });
export const DESIGNS = [
  D('tech', 'Tech Stock', 'asset', 3, { cash: 5, pros: 100 }),
  D('meme', 'Meme Coin', 'asset', 2, { cash: 4, pros: 75 }),
  D('moon', 'The Moon', 'asset', 4, { cash: 7, pros: 150 }),
  D('bull', 'The Bull', 'progress', 2, { pros: 100 }),
  D('rocket', 'Rocket', 'progress', 4, { pros: 200 }),
  D('inherit', 'The Inheritance', 'progress', 0, { cash: 3, pros: 50, choice: true }),
  D('bear', 'The Bear', 'hazard', 2, { text: 'Bank at most 75 Prosperity from a single card' }),
  D('hack', 'Quantum Hack', 'hazard', 2, { text: 'Trader ability disabled' }),
  D('rug', 'Rug Pull', 'hazard', 3, { text: 'Cannot sell Assets' }),
  D('bell', 'The Bell', 'remedy', 1, { clears: 'bear' }),
  D('resist', 'Quantum Resistance', 'remedy', 1, { clears: 'hack' }),
  D('keys', 'The Keys', 'remedy', 1, { clears: 'rug' }),
  D('tortilla', 'Miracle Tortilla', 'remedy', 2, { clears: 'any' }),
  D('heart', 'Sacred Heart', 'artifact', 2, { text: 'Discard to cancel a hazard just played on you' }),
  D('halo', 'The Halo', 'artifact', 3, { text: 'Your Trader\u2019s ability cannot be disabled' }),
  D('xray', 'X-Ray Glasses', 'artifact', 2, { text: 'Once a turn, peek at one random rival card' }),
  D('rosary', 'The Rosary Beads', 'artifact', 2, { text: 'When you earn a deed, draw a card' }),
  D('rose', 'The Rose', 'coop', 0, { text: 'Give a rival 2 Liquidity: a deed, then draw one' }),
  D('fountain', 'The Fountain', 'coop', 1, { text: 'You and a chosen rival each draw one: a deed' }),
];
export const byKey = Object.fromEntries(DESIGNS.map((d) => [d.key, d]));
export const STARTER = [['tech', 3], ['meme', 3], ['moon', 3], ['bull', 3], ['rocket', 3], ['inherit', 3], ['bear', 2], ['hack', 2], ['rug', 2], ['bell', 2], ['resist', 2], ['keys', 2], ['tortilla', 2], ['heart', 1], ['halo', 1], ['xray', 1], ['rosary', 1], ['rose', 2], ['fountain', 2]];

export const TRADERS = [
  { key: 'unicornio', name: 'El Unicornio' },    // once a turn: a free cycle (discard one, draw one) beside the main action
  { key: 'marisol', name: 'La Detective' },      // once a game: cancel a Rug Pull played on you
  { key: 'monje', name: 'El Monje' },            // +1 Liquidity when you earn a deed
  { key: 'diablito', name: 'El Diablito' },      // +1 Liquidity when your hazard lands
  { key: 'gato', name: 'El Gato' },              // once a game: free hazard discard at start of main action
  { key: 'abuela', name: 'La Abuela' },          // your Remedies cost 1 less
  { key: 'celebridad', name: 'La Celebridad' },  // pay 1 when banking from an Asset/Progress: +25
];
export const ODDS = [1, 2, 4, 8]; // twelfths, by recorded deeds (cap 3)

export class Game {
  constructor({ players, seed = 1, verbose = false, winAt = 1000, maxTurns = 300 }) {
    this.rng = makeRng(seed); this.verbose = verbose; this.lines = []; this.winAt = winAt; this.maxTurns = maxTurns;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, t: cfg.trader,
      deck: this.shuffle(STARTER.flatMap(([k, n]) => Array.from({ length: n }, () => ({ ...byKey[k] })))),
      hand: [], discard: [], invest: [], artifacts: [], hazards: [], liq: 5, pros: 0, deeds: 0, hailUsed: false,
      marisolUsed: false, gatoUsed: false, deedThisTurn: false,
      stats: { plays: 0, sells: 0, sellCash: 0, sellPros: 0, hazPlayed: 0, hazCleared: 0, remedyRival: 0, gifts: 0, coop: 0, deeds: 0, hail: 0, hailWon: 0, passes: 0, discards: 0, turns: 0, hazTurns: 0 } }));
    for (const p of this.players) for (let i = 0; i < 5; i++) this.draw(p, true);
    this.turnNo = 0; this.over = false; this.winner = null;
  }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  log(t) { if (this.verbose) this.lines.push(`[T${this.turnNo}] ${t}`); }
  rivals(p) { return this.players.filter((q) => q !== p); }
  abilityOn(p) { return !(p.hazards.some((h) => h.key === 'hack') && !p.artifacts.some((a) => a.key === 'halo')); }
  is(p, key) { return p.t.key === key && this.abilityOn(p); }
  hasHaz(p, key) { return p.hazards.some((h) => h.key === key); }
  draw(p, silent = false) {
    if (!p.deck.length && p.discard.length) { p.deck = this.shuffle(p.discard.splice(0)); this.log(`${p.name} reshuffles`); }
    const c = p.deck.shift(); if (!c) return null; p.hand.push(c); if (!silent) this.log(`${p.name} draws${p.policy && p.policy.human ? ' ' + c.name : ''}`); return c;
  }
  bank(p, n, src, allowBonus = true) {
    if (this.hasHaz(p, 'bear') && src !== 'hail') { if (n > 75) return false; // larger payouts cannot be chosen
      p.pros += n; } else {
      if (allowBonus && this.is(p, 'celebridad') && p.liq >= 1 && src !== 'hail' && !(this.hasHaz(p, 'bear') && n + 25 > 75)) { p.liq -= 1; n += 25; }
      p.pros += n;
    }
    this.log(`${p.name} banks ${n} (${src}) → ${p.pros}`);
    if (p.pros >= this.winAt && !this.over) { this.over = true; this.winner = p; this.log(`*** ${p.name} WINS with ${p.pros} ***`); }
    return true;
  }
  earnDeed(p, why) {
    if (p.deedThisTurn || p.deeds >= 3) return false;
    p.deeds += 1; p.deedThisTurn = true; p.stats.deeds++;
    if (this.is(p, 'monje')) p.liq += 1;
    if (p.artifacts.some((a) => a.key === 'rosary')) this.draw(p);
    this.log(`✧ ${p.name} earns a deed (${why}) → ${p.deeds} candle${p.deeds === 1 ? '' : 's'}`);
    return true;
  }
  clearHazard(victim, h, by, why) {
    victim.hazards.splice(victim.hazards.indexOf(h), 1); h.owner.discard.push(h); victim.stats.hazCleared++;
    this.log(`${why}: ${h.name} off ${victim.name}`);
  }
  spend(p, n) { if (p.liq < n) return false; p.liq -= n; return true; }
  costOf(p, c) { let n = c.cost; if (c.type === 'remedy' && this.is(p, 'abuela')) n = Math.max(0, n - 1); return n; }

  // ── the main actions ──
  async playCard(p, c, choice = {}) {
    const cost = this.costOf(p, c); if (!this.spend(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); p.stats.plays++;
    switch (c.type) {
      case 'asset': c.bornTurn = this.turnNo; p.invest.push(c); this.log(`${p.name} invests in ${c.name}`); break;
      case 'progress': {
        if (c.choice && choice.cash) { p.liq += c.cash; p.discard.push(c); this.log(`${p.name} cashes ${c.name} for ${c.cash}`); }
        else { const ok = this.bank(p, c.pros, c.name); if (!ok) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; } /* banked cards leave the deck */ }
        break; }
      case 'hazard': {
        const t = choice.target; if (!t || this.hasHaz(t, c.key)) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        // reactions: Sacred Heart, then Marisol against a Rug Pull
        const heart = t.artifacts.find((a) => a.key === 'heart');
        if (heart && await t.policy.useHeart(this, t, c, p)) { t.artifacts.splice(t.artifacts.indexOf(heart), 1); t.discard.push(heart); p.discard.push(c); this.log(`${t.name}'s SACRED HEART cancels ${c.name}`); return true; }
        if (c.key === 'rug' && t.t.key === 'marisol' && !t.marisolUsed && this.abilityOn(t) && await t.policy.useMarisol(this, t, c, p)) { t.marisolUsed = true; p.discard.push(c); this.log(`LA DETECTIVE cancels the Rug Pull`); return true; }
        c.owner = p; c.by = p.idx; t.hazards.push(c); p.stats.hazPlayed++;
        if (this.is(p, 'diablito')) p.liq += 1;
        this.log(`${p.name} plays ${c.name} on ${t.name}`); break; }
      case 'remedy': {
        const t = choice.target || p; const h = choice.hazard || t.hazards.find((x) => c.clears === 'any' || x.key === c.clears);
        if (!h) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        this.clearHazard(t, h, p, `${p.name} plays ${c.name}`); p.discard.push(c);
        if (t !== p) { p.stats.remedyRival++; if (h.by !== p.idx) this.earnDeed(p, `cleared ${t.name}'s ${h.name}`); }
        break; }
      case 'artifact': {
        if (p.artifacts.length >= 2) { const drop = choice.drop || p.artifacts[0]; p.artifacts.splice(p.artifacts.indexOf(drop), 1); p.discard.push(drop); this.log(`${p.name} unequips ${drop.name}`); }
        p.artifacts.push(c); this.log(`${p.name} equips ${c.name}`); break; }
      case 'coop': {
        const t = choice.target || this.rivals(p)[0];
        if (c.key === 'rose') { if (p.liq < 2) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; } p.liq -= 2; t.liq += 2; this.earnDeed(p, 'the Rose'); this.draw(p); }
        if (c.key === 'fountain') { this.draw(p); this.draw(t); this.earnDeed(p, 'the Fountain'); }
        p.stats.coop++; p.discard.push(c); this.log(`${p.name} plays ${c.name} with ${t.name}`); break; }
    }
    return true;
  }
  sell(p, a, wantPros) {
    if (this.hasHaz(p, 'rug')) return false; if (a.bornTurn === this.turnNo) return false;
    p.invest.splice(p.invest.indexOf(a), 1); p.stats.sells++;
    if (wantPros) { const ok = this.bank(p, a.pros, a.name); if (!ok) { p.invest.push(a); p.stats.sells--; return false; } p.stats.sellPros++; /* banked */ }
    else { p.liq += a.cash; p.discard.push(a); p.stats.sellCash++; this.log(`${p.name} sells ${a.name} for ${a.cash}`); }
    return true;
  }
  gift(p, t) { if (p.liq < 2) return false; p.liq -= 2; t.liq += 2; p.stats.gifts++; this.earnDeed(p, `2 Liquidity to ${t.name}`); this.log(`${p.name} gives ${t.name} 2 Liquidity`); return true; }
  payClear(p, h) { if (!this.spend(p, 3)) return false; this.clearHazard(p, h, p, `${p.name} pays 3`); return true; }
  hailMary(p) {
    p.hailUsed = true; p.stats.hail++; const twelfths = ODDS[Math.min(3, p.deeds)];
    const roll = 1 + Math.floor(this.rng() * 12); const ok = roll <= twelfths;
    this.log(`✝ ${p.name} attempts the HAIL MARY at ${twelfths}/12 with ${p.deeds} candle${p.deeds === 1 ? '' : 's'}… the die shows ${roll}: ${ok ? 'ANSWERED' : 'unanswered'}`);
    if (ok) { for (const h of [...p.hazards]) this.clearHazard(p, h, p, 'grace'); p.stats.hailWon++; this.bank(p, 200, 'hail'); }
    return ok;
  }

  legalActions(p) {
    const A = [];
    for (const c of p.hand) {
      const cost = this.costOf(p, c); if (p.liq < cost) continue;
      if (c.type === 'asset' || c.type === 'artifact') A.push({ t: 'play', c });
      else if (c.type === 'progress') { if (!c.choice) { if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c }); } else { A.push({ t: 'play', c, choice: { cash: true } }); if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c, choice: {} }); } }
      else if (c.type === 'hazard') { for (const r of this.rivals(p)) if (!this.hasHaz(r, c.key)) A.push({ t: 'play', c, choice: { target: r } }); }
      else if (c.type === 'remedy') { for (const q of this.players) for (const h of q.hazards) if (c.clears === 'any' || h.key === c.clears) A.push({ t: 'play', c, choice: { target: q, hazard: h } }); }
      else if (c.type === 'coop') { if (c.key === 'rose' && p.liq < cost + 2) continue; for (const r of this.rivals(p)) A.push({ t: 'play', c, choice: { target: r } }); }
    }
    for (const a of p.invest) { if (this.hasHaz(p, 'rug') || a.bornTurn === this.turnNo) continue; A.push({ t: 'sell', a, pros: false }); if (!(this.hasHaz(p, 'bear') && a.pros > 75)) A.push({ t: 'sell', a, pros: true }); }
    if (p.liq >= 2) for (const r of this.rivals(p)) A.push({ t: 'gift', target: r });
    if (p.liq >= 3) for (const h of p.hazards) A.push({ t: 'payclear', h });
    if (!p.hailUsed) A.push({ t: 'hail' });
    if (p.hand.length) A.push({ t: 'cycle', c: p.hand[0] });
    if (this.is(p, 'unicornio') && !p.freeCycleUsed && p.hand.length) for (const c of p.hand) A.push({ t: 'freecycle', c });
    A.push({ t: 'pass' });
    return A;
  }
  async act(p, a) {
    switch (a.t) {
      case 'play': return this.playCard(p, a.c, a.choice || {});
      case 'sell': return this.sell(p, a.a, a.pros);
      case 'gift': return this.gift(p, a.target);
      case 'payclear': return this.payClear(p, a.h);
      case 'hail': return this.hailMary(p);
      case 'cycle': { const c = a.c; p.hand.splice(p.hand.indexOf(c), 1); p.discard.push(c); this.draw(p); this.log(`${p.name} cycles a card`); return true; }
      case 'freecycle': { const c = a.c; p.freeCycleUsed = true; p.hand.splice(p.hand.indexOf(c), 1); p.discard.push(c); this.draw(p); this.log(`${p.name} cycles freely (El Unicornio) — main action still to come`); return true; }
      case 'pass': this.log(`${p.name} passes`); return true;
    }
  }
  async turn(p) {
    p.deedThisTurn = false; p.freeCycleUsed = false; p.stats.turns++; if (p.hazards.length) p.stats.hazTurns++;
    p.liq += 2;
    if (this.is(p, 'gato') && !p.gatoUsed && p.hazards.length && await p.policy.useGato(this, p)) { p.gatoUsed = true; const h = p.hazards[0]; this.clearHazard(p, h, p, 'EL GATO knocks it off the table'); }
    if (p.policy.beforeDraw) await p.policy.beforeDraw(this, p);
    this.draw(p);
    let guard = 0; while (guard++ < 4) { const a = await p.policy.main(this, p); const kind = a ? a.t : 'pass'; await this.act(p, a || { t: 'pass' }); if (this.hooks && this.hooks.onAction) await this.hooks.onAction(p, a || { t: 'pass' }); if (kind !== 'freecycle' || this.over) break; }
    while (p.hand.length > 7) { const d = await p.policy.discardOne(this, p); p.hand.splice(p.hand.indexOf(d), 1); p.discard.push(d); p.stats.discards++; }
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  async run() {
    while (!this.over && this.turnNo < this.maxTurns) { this.turnNo++; for (const p of this.players) { if (this.over) break; this.active = p; if (this.hooks && this.hooks.render) await this.hooks.render(); await this.turn(p); } }
    if (this.verbose) { this.lines.forEach((l) => console.log(l)); console.log(`END turn ${this.turnNo}: ${this.players.map((q) => `${q.name} ${q.pros}P/${q.liq}L/${q.deeds}d`).join(' · ')}`); }
    return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, turns: this.turnNo,
      players: this.players.map((q) => ({ name: q.name, trader: q.t.key, pros: q.pros, ...q.stats })) };
  }
}

// ── policies ──
export class RandomBot {
  constructor(rng) { this.rng = rng; }
  useHeart() { return this.rng() < 0.5; } useMarisol() { return this.rng() < 0.5; } useGato() { return this.rng() < 0.5; }
  discardOne(g, p) { return p.hand[Math.floor(this.rng() * p.hand.length)]; }
  main(g, p) { const A = g.legalActions(p); return A[Math.floor(this.rng() * A.length)]; }
}
export class GreedyBot {
  constructor() {}
  useHeart(g, p, c) { return c.key !== 'hack' || p.t.key !== 'gato'; }
  useMarisol() { return true; }
  useGato(g, p) { return p.hazards.length > 0; }
  discardOne(g, p) { const order = { hazard: 0, coop: 1, artifact: 2, remedy: 3, asset: 4, progress: 5 }; return [...p.hand].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))[0]; }
  main(g, p) {
    const A = g.legalActions(p); const lead = [...g.rivals(p)].sort((a, b) => b.pros - a.pros)[0];
    const twelfths = ODDS[Math.min(3, p.deeds)]; const hailEV = (twelfths / 12) * 200;
    let best = null, bs = -1;
    for (const a of A) {
      let s = 0;
      if (a.t === 'play' && a.c.type === 'progress') s = a.choice && a.choice.cash ? (p.liq < 3 ? 60 : 20) : a.c.pros - a.c.cost * 5 + (p.pros + a.c.pros >= g.winAt ? 9999 : 0);
      if (a.t === 'sell') s = a.pros ? a.a.pros - 10 + (p.pros + a.a.pros >= g.winAt ? 9999 : 0) : (p.liq <= 2 ? 65 : 25);
      if (a.t === 'play' && a.c.type === 'asset') s = p.liq >= a.c.cost + 2 ? 55 + a.c.pros / 10 : 30;
      if (a.t === 'play' && a.c.type === 'hazard') s = a.choice.target === lead && lead.pros > p.pros ? 70 + lead.pros / 20 : 15;
      if (a.t === 'play' && a.c.type === 'remedy') { const mine = a.choice.target === p; s = mine ? 80 : (p.deeds < 3 && !p.hailUsed && a.choice.hazard.by !== p.idx ? 62 : 8); }
      if (a.t === 'play' && a.c.type === 'artifact') s = 35;
      if (a.t === 'play' && a.c.type === 'coop') s = p.deeds < 3 && !p.hailUsed ? 58 : 5;
      if (a.t === 'gift') s = p.deeds < 3 && !p.hailUsed && p.liq >= 6 ? 50 : 2;
      if (a.t === 'payclear') s = p.liq >= 5 ? 66 : 20;
      if (a.t === 'hail') s = p.pros + 200 >= g.winAt ? (twelfths >= 4 ? 90 : 30) : twelfths >= 8 ? 72 : lead && lead.pros >= g.winAt - 150 ? 45 : hailEV / 4;
      if (a.t === 'freecycle') s = p.hand.length >= 4 ? 46 + ({ hazard: 3, coop: 2, remedy: 1 }[a.c.type] || 0) - (a.c.type === 'progress' ? 40 : 0) : 8;
      if (a.t === 'cycle') s = 10; if (a.t === 'pass') s = 1;
      s += (g.rng ? 0 : 0);
      if (s > bs) { bs = s; best = a; }
    }
    return best;
  }
}

// ── CLI ──
const ARGV = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
const args = Object.fromEntries(ARGV.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));
export function playOne({ seed = 1, nPlayers = 3, bots = null, traders = null, verbose = false, rotate = 0 }) {
  const rng = makeRng(seed * 13 + 5); const pool = [...TRADERS].sort(() => rng() - 0.5);
  const kinds = (bots || 'greedy,greedy,greedy,greedy'.split(',').slice(0, nPlayers).join(',')).split(',').slice(0, nPlayers);
  const players = kinds.map((k, i) => ({ name: `${k.toUpperCase()} ${'ABCD'[i]}`, policy: k === 'random' ? new RandomBot(makeRng(seed * 31 + i)) : new GreedyBot(), trader: traders && traders[i] ? TRADERS.find((t) => t.key === traders[i]) : pool.pop() }));
  for (let r = 0; r < rotate; r++) players.push(players.shift());
  return new Game({ players, seed, verbose });
}
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('pt-sim.js')) {
  const games = +(args.games || 1000); const seed = +(args.seed || 1); const nPlayers = +(args.players || 3);
  if (args.verbose) { await playOne({ seed, nPlayers, bots: args.bots, verbose: true }).run(); process.exit(0); }
  const res = { wins: {}, seatWins: [0, 0, 0, 0], turns: [], byTrader: {}, s: {}, noWin: 0 };
  for (let i = 0; i < games; i++) {
    const r = await playOne({ seed: seed + i, nPlayers, bots: args.bots, rotate: i % nPlayers }).run();
    if (!r.winner) { res.noWin++; continue; }
    res.wins[r.winner.replace(/ [A-D]$/, '')] = (res.wins[r.winner.replace(/ [A-D]$/, '')] || 0) + 1;
    res.seatWins[(r.winnerIdx + nPlayers - (i % nPlayers)) % nPlayers]++; res.turns.push(r.turns);
    for (const p of r.players) { const T = res.byTrader[p.trader] = res.byTrader[p.trader] || { g: 0, w: 0 }; T.g++; if (r.winner === p.name) T.w++;
      for (const k of ['sells', 'sellCash', 'sellPros', 'hazPlayed', 'hazCleared', 'remedyRival', 'gifts', 'coop', 'deeds', 'hail', 'hailWon', 'turns', 'hazTurns']) res.s[k] = (res.s[k] || 0) + p[k]; }
  }
  const avg = (x) => (x.reduce((s2, n) => s2 + n, 0) / Math.max(1, x.length)).toFixed(1);
  console.log(`${games} games · ${nPlayers} players · bots ${args.bots || 'greedy all'}`);
  console.log('wins', JSON.stringify(res.wins), '| wins by seat', res.seatWins.slice(0, nPlayers).map((n) => Math.round(n / Math.max(1, games - res.noWin) * 100) + '%').join('/'), '| no winner', res.noWin);
  console.log(`rounds to win avg ${avg(res.turns)} (each player ~that many turns)`);
  const s = res.s; const pg = (k) => (s[k] / games).toFixed(2);
  console.log(`per game (all players): sells ${pg('sells')} (cash ${pg('sellCash')} / pros ${pg('sellPros')}) hazards ${pg('hazPlayed')} cleared ${pg('hazCleared')} remedyRival ${pg('remedyRival')} gifts ${pg('gifts')} coop ${pg('coop')} deeds ${pg('deeds')} hail ${pg('hail')} answered ${pg('hailWon')}`);
  console.log(`hazard-burdened turns: ${Math.round(s.hazTurns / Math.max(1, s.turns) * 100)}% of all turns`);
  console.log('traders:', Object.entries(res.byTrader).map(([k, v]) => `${k} ${Math.round(v.w / v.g * 100)}%`).join(' | '));
}
