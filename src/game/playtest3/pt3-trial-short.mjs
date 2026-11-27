#!/usr/bin/env node
// TRIAL (2026-11-26): THE SHORT, a candidate for The Whistleblower's slot (42). Sim only: nothing here touches
// pt3-sim.js, designs.js or the table. The card and its rules are layered over the engine by subclassing.
//
// The Short ($20M, a main action): place it on an Asset your rival holds. If that Asset is lost (rugged, wrecked,
// liquidated, panic-sold by Paper Hands, a gamble that misses) or is sold in a bear round, you collect PAY.
// Sold any other way, or moved to another player, The Short is discarded.
//
//   node pt3-trial-short.mjs --games 12000 --mode shuffle --card short --pay price|half|100
//   node pt3-trial-short.mjs --mode starters --swap scam        (The Short in the Degen starter, in that card's place)
import { Game, GreedyBot, byKey, RECIPES } from './pt3-sim.js';
const ARGV = process.argv.slice(2); const arg = (k, d) => { const i = ARGV.indexOf('--' + k); return i < 0 ? d : ARGV[i + 1]; };
const GAMES = +arg('games', 4000), SEED = +arg('seed', 424200), MODE = arg('mode', 'shuffle'), CARD = arg('card', 'short'), PAY = arg('pay', 'price'), SWAP = arg('swap', null), COST = +arg('cost', 2), RULE = arg('rule', 'draft'), BASEP = +arg('basep', RULE === 'nonbull' ? 0.6 : 0.15), COMBO = arg('combo', null);
byKey.short = { key: 'short', name: 'The Short', type: 'short', cost: COST, short: true };
if (CARD === 'short') RECIPES.shuffle = RECIPES.shuffle.map(([k, n]) => (k === 'whistle' ? ['short', n] : [k, n]));
if (CARD === 'none') RECIPES.shuffle = RECIPES.shuffle.filter(([k]) => k !== 'whistle');
if (SWAP) { const i = RECIPES.degen.findIndex(([k]) => k === SWAP); const [k, n] = RECIPES.degen[i]; if (n > 1) RECIPES.degen[i] = [k, n - 1]; else RECIPES.degen.splice(i, 1); RECIPES.degen.push(['short', 1]); }
const WATCH = CARD === 'short' || SWAP ? 'short' : 'whistle';

class ShortGame extends Game {
  get T() { return (this._T ||= { shorts: [], played: 0, paid: 0, voided: 0, payTotal: 0, cause: {}, selfRug: 0 }); }
  payOf(a) { const price = a.gamble ? a.pros : this.prosOf(a); return PAY === 'price' ? price : PAY === 'half' ? Math.round(price / 2) : +PAY; }
  async draw(p, silent) { const c = await super.draw(p, silent); if (c && c.key === WATCH) p._drew = true; return c; }
  roll() { const r = super.roll(); this._lastRoll = r; return r; }
  legalActionsAll(p) {
    const A = super.legalActionsAll(p);
    for (const c of p.hand) if (c.short && p.liq >= this.costOf(p, c)) for (const r of this.rivals(p)) for (const a of this.hot(r)) if (!a.shortBy) A.unshift({ t: 'play', c, choice: { target: r, asset: a } });
    return A;
  }
  async playCard(p, c, choice = {}) {
    if (c.key === WATCH) { p._played = true; }
    if (!c.short) return super.playCard(p, c, choice);
    const a = choice.asset, r = choice.target; if (!a || !r || !r.invest.includes(a) || a.shortBy || !this.spend(p, this.costOf(p, c))) return false;
    p.hand.splice(p.hand.indexOf(c), 1); p.stats.plays++; this.T.played++;
    const s = { a, holder: r, by: p, c, snap: this.snap(r) }; a.shortBy = s; this.T.shorts.push(s);
    this.log(`${p.name} plays THE SHORT on ${r.name}'s ${a.name}`); return true;
  }
  snap(q) { return { rugged: q.stats.rugged || 0, rekt: q.stats.rekt || 0, paperSold: q.stats.paperSold || 0 }; }
  settle(s, pays, cause) {
    if (s.done) return; s.done = true; delete s.a.shortBy; s.by.discard.push(s.c);
    if (!pays) { this.T.voided++; this.log(`THE SHORT on ${s.a.name} expires worthless (${cause})`); return; }
    const n = this.payOf(s.a); this.collect(s.by, n / this.rules.rate); this.T.paid++; this.T.payTotal += n; this.T.cause[cause] = (this.T.cause[cause] || 0) + 1; s.by._paid = (s.by._paid || 0) + n;
    if (cause === 'rug' && s.holder.lastFraud && s.holder.lastFraud.by === s.by) this.T.selfRug++;
    this.log(`THE SHORT pays: ${s.by.name} collects $${n}M (${s.a.name}: ${cause})`);
  }
  reconcile() {
    for (const s of this.T.shorts) { if (s.done) continue;
      if (s.holder.invest.includes(s.a)) { s.snap = this.snap(s.holder); continue; }
      if (s.a._uncorked) { this.settle(s, false, 'uncorked'); continue; }
      if (this.players.some((q) => q !== s.holder && q.invest.includes(s.a))) { this.settle(s, false, 'moved'); continue; }
      const now = this.snap(s.holder); const cause = now.rugged > s.snap.rugged ? 'rug' : now.rekt > s.snap.rekt ? 'wrecked' : now.paperSold > s.snap.paperSold ? 'paper hands' : 'lost';
      this.settle(s, true, cause); }
  }
  async sellAsset(p, a, wantPros) {
    const s = a.shortBy; if (!s) return super.sellAsset(p, a, wantPros);
    const mkt = this.market || 0, need = a.gamble ? this.gambleNeed(p, a) : 0; this._lastRoll = null;
    const ok = await super.sellAsset(p, a, wantPros);
    if (ok && !p.invest.includes(a)) { const missed = wantPros && a.gamble && this._lastRoll != null && this._lastRoll < need;
      if (missed) this.settle(s, true, 'gamble missed'); else if (mkt < 0) this.settle(s, true, 'bear sale'); else if (RULE === 'nonbull' && mkt === 0 && !this.fx.godcandle) this.settle(s, true, 'flat sale'); else this.settle(s, false, 'sold'); }
    return ok;
  }
  async act(p, a) { this.reconcile(); if (a.t === 'uncork') a.a._uncorked = true; const r = await super.act(p, a); this.reconcile(); return r; }
  checkWin(active) { this.reconcile(); return super.checkWin(active); }
}
class ShortBot extends GreedyBot {
  score(g, p, a) {
    const R = g.rules.rate;
    if (a.t === 'play' && a.c.short) { const t = a.choice.target, x = a.choice.asset, hot = g.hot(t), last = hot[hot.length - 1] === x;
      const eq = t.trader ? (t.trader.eq || 0) / g.rules.die : 0;
      const rug = last && !g.warded(t, 'rug') && p.hand.some((c) => c.key === 'rug');
      let P = rug ? 0.75 * (1 - eq) : x.gamble ? (1 - g.gambleOdds(t, x)) * 0.8 : BASEP; if (COMBO && !rug && !(last && g.hasHaz(t, 'paperhands'))) return -1; if (!rug && last && g.hasHaz(t, 'paperhands')) P = 0.8;
      return P * g.payOf(x) * 0.8 - g.costOf(p, a.c) * R * 0.5; }
    let s = super.score(g, p, a);
    if (a.t === 'play' && a.c.key === 'rug') { const hot = g.hot(a.choice.target), x = hot[hot.length - 1]; if (x && x.shortBy && x.shortBy.by === p) s += g.payOf(x); } // the degen's play: short it, then pull the rug
    if (a.t === 'sell' && a.a.shortBy && s < 9000) { const x = a.a, pay = g.payOf(x); // a shorted Asset: do not hand the rival their payout
      if (x.gamble && a.pros) s -= (1 - g.gambleOdds(p, x)) * pay * 0.6; else if ((g.market || 0) < 0 || (RULE === 'nonbull' && !(g.market > 0) && !g.fx.godcandle)) s -= pay * 0.6; }
    return s;
  }
}
const res = { n: 0, noWin: 0, first: 0, rounds: 0, wins: {}, games: {}, drew: 0, drewPlayed: 0, playedWon: 0, playedN: 0, drewWon: 0, T: { played: 0, paid: 0, voided: 0, payTotal: 0, selfRug: 0, cause: {} }, starter: {} };
const recs = MODE === 'starters' ? ['devotion', 'degen'] : ['shuffle', 'shuffle'];
for (let i = 0; i < GAMES; i++) {
  const players = [0, 1].map((j) => ({ name: 'AB'[j], recipe: recs[j], starter: null, policy: new ShortBot() })); if (i % 2) players.push(players.shift());
  const g = new ShortGame({ players, seed: SEED + i }); await g.run(); res.n++;
  if (!g.winner) res.noWin++; else { res.rounds += g.turnNo; if (g.winner === g.order[0]) res.first++; }
  for (const p of g.players) { res.games[p.recipe] = (res.games[p.recipe] || 0) + 1; if (g.winner === p) res.wins[p.recipe] = (res.wins[p.recipe] || 0) + 1;
    const S = res.starter[p.starter] ||= { g: 0, w: 0 }; S.g++; if (g.winner === p) S.w++;
    if (p._drew) { res.drew++; if (g.winner === p) res.drewWon++; if (p._played) { res.drewPlayed++; } } if (p._played) { res.playedN++; if (g.winner === p) res.playedWon++; } }
  const T = g.T; for (const k of ['played', 'paid', 'voided', 'payTotal', 'selfRug']) res.T[k] += T[k]; for (const [k, v] of Object.entries(T.cause)) res.T.cause[k] = (res.T.cause[k] || 0) + v;
}
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : 'n/a'); const won = res.n - res.noWin;
console.log(`\n== ${MODE} · card ${SWAP ? 'short in Degen for ' + SWAP : CARD}${WATCH === 'short' ? ' · rule ' + RULE + (COMBO ? ' · bot plays it only as a combo' : '') + ' · pays ' + PAY + ' · costs $' + COST * 10 + 'M' : ''} · ${GAMES} games, seeds ${SEED}+`);
console.log(`rounds ${(res.rounds / won).toFixed(2)} · going first wins ${pct(res.first, won)} · no winner ${res.noWin} · ` + Object.keys(res.games).map((k) => `${k} ${pct(res.wins[k] || 0, res.games[k])}`).join(' · '));
console.log(`${WATCH}: drawn by ${res.drew} players · played by ${pct(res.drewPlayed, res.drew)} of them · those who drew it won ${pct(res.drewWon, res.drew)} · those who played it won ${pct(res.playedWon, res.playedN)}`);
if (WATCH === 'short') console.log(`shorts placed ${res.T.played} · paid ${pct(res.T.paid, res.T.played)} · expired ${pct(res.T.voided, res.T.played)} · still open at the end ${pct(res.T.played - res.T.paid - res.T.voided, res.T.played)} · average payout $${Math.round(res.T.payTotal / Math.max(1, res.T.paid))}M · own Rug Pull ${res.T.selfRug}\n  paid by: ` + Object.entries(res.T.cause).map(([k, v]) => `${k} ${v}`).join(' · '));
if (arg('openers', null)) console.log('openers: ' + Object.entries(res.starter).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g).map(([k, v]) => `${k} ${Math.round(v.w / v.g * 100)}`).join(' · '));
