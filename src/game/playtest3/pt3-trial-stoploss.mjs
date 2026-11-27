#!/usr/bin/env node
// TRIAL (2026-11-26): STOP-LOSS, a candidate for The Whistleblower's slot (42). Sim only: nothing here touches
// pt3-sim.js, designs.js or the table. The card is layered over the engine by subclassing.
//
// Stop-Loss ($20M, a Relic). When a Calamity or a Fate destroys one of your Assets (Rug Pull, Tech Rekt, a
// liquidation), you get money back for it (--back cost: what the Asset costs to buy · half: half its sale
// price · price: its sale price). --scope any: it also returns half of any cash a Calamity or Fate takes.
// --keep: it stays equipped (otherwise it is spent the first time it triggers). --floor: a bear market does
// not lower what your Assets sell for.
//
//   node pt3-trial-stoploss.mjs --games 12000 --back cost [--scope any] [--keep 1] [--floor 1]
import { Game, GreedyBot, byKey, RECIPES } from './pt3-sim.js';
const ARGV = process.argv.slice(2); const arg = (k, d) => { const i = ARGV.indexOf('--' + k); return i < 0 ? d : ARGV[i + 1]; };
const GAMES = +arg('games', 4000), SEED = +arg('seed', 424200), BACK = arg('back', 'cost'), SCOPE = arg('scope', 'asset'), KEEP = !!arg('keep', null), FLOOR = !!arg('floor', null), COST = +arg('cost', 2);
byKey.stoploss = { key: 'stoploss', name: 'Stop-Loss', type: 'artifact', cost: COST, stop: true };
RECIPES.shuffle = RECIPES.shuffle.map(([k, n]) => (k === 'whistle' ? ['stoploss', n] : [k, n]));

class StopGame extends Game {
  get T() { return (this._T ||= { equipped: 0, triggers: 0, back: 0, cause: {} }); }
  async draw(p, silent) { const c = await super.draw(p, silent); if (c && c.stop) p._drew = true; return c; }
  stopOf(q) { return q.artifacts.find((a) => a.stop); }
  before() { return this.players.map((q) => ({ q, inv: [...q.invest], cash: q.cash, rekt: q.stats.rekt || 0 })); }
  after(snap, why) {
    for (const { q, inv, cash, rekt } of snap) { const sl = this.stopOf(q); if (!sl) continue; let n = 0, what = null;
      const wrecked = (q.stats.rekt || 0) > rekt; const gone = inv.filter((a) => !this.players.some((x) => x.invest.includes(a)) && (wrecked || !(a.key === 'jardin' && why !== 'Rug Pull'))); // a Yield Farm that withers when a Fate turns is its own rule, not a loss
      if (gone.length) { const a = gone[0]; const price = a.gamble ? a.pros : this.prosOf(a); n = BACK === 'cost' ? a.cost * this.rules.rate : BACK === 'half' ? Math.round(price / 2) : price; if ((q.stats.rekt || 0) > rekt) n = Math.max(0, n - this.rules.rate); what = 'asset'; }
      else if (SCOPE === 'any' && q.cash < cash) { n = Math.round((cash - q.cash) / 2); what = 'cash'; }
      if (!what || n <= 0) continue;
      q.cash += n; this.T.triggers++; this.T.back += n; this.T.cause[why + ' · ' + what] = (this.T.cause[why + ' · ' + what] || 0) + 1; q._stopped = true;
      this.log(`STOP-LOSS: ${q.name} gets $${n}M back`);
      if (!KEEP) { q.artifacts.splice(q.artifacts.indexOf(sl), 1); q.discard.push(sl); } }
  }
  async playCard(p, c, choice = {}) {
    if (c.stop) { const ok = await super.playCard(p, c, choice); if (ok) { this.T.equipped++; p._played = true; } return ok; }
    if (c.type !== 'hazard') return super.playCard(p, c, choice);
    const snap = this.before().filter((s) => s.q !== p); const ok = await super.playCard(p, c, choice); this.after(snap, c.name); return ok;
  }
  async flipFate(d) { const snap = this.before(); const r = await super.flipFate(d); this.after(snap, this.fateNow && this.fateNow.card ? this.fateNow.card.name : 'a Fate'); return r; }
  async sellAsset(p, a, wantPros) { if (!(FLOOR && this.stopOf(p) && (this.market || 0) < 0)) return super.sellAsset(p, a, wantPros); const m = this.market; this.market = 0; p._floored = (p._floored || 0) + 1; this.T.floor = (this.T.floor || 0) + 1; try { return await super.sellAsset(p, a, wantPros); } finally { this.market = m; } }
}
class StopBot extends GreedyBot {
  relicWorth(g, p, c, left, earns) { if (!c.stop) return super.relicWorth(g, p, c, left, earns); return (SCOPE === 'any' ? 0.12 : 0.06) * left * 60 + (p.invest.length ? 10 : 0) + (FLOOR ? 5 * left : 0); }
}
const res = { noWin: 0, first: 0, rounds: 0, drew: 0, drewPlayed: 0, drewWon: 0, playedN: 0, playedWon: 0, stoppedN: 0, stoppedWon: 0, T: { equipped: 0, triggers: 0, back: 0, floor: 0, cause: {} } };
for (let i = 0; i < GAMES; i++) {
  const players = [0, 1].map((j) => ({ name: 'AB'[j], recipe: 'shuffle', starter: null, policy: new StopBot() })); if (i % 2) players.push(players.shift());
  const g = new StopGame({ players, seed: SEED + i }); await g.run();
  if (!g.winner) res.noWin++; else { res.rounds += g.turnNo; if (g.winner === g.order[0]) res.first++; }
  for (const p of g.players) { const w = g.winner === p; if (p._drew) { res.drew++; if (w) res.drewWon++; if (p._played) res.drewPlayed++; } if (p._played) { res.playedN++; if (w) res.playedWon++; } if (p._stopped) { res.stoppedN++; if (w) res.stoppedWon++; } }
  const T = g.T; for (const k of ['equipped', 'triggers', 'back', 'floor']) res.T[k] += T[k] || 0; for (const [k, v] of Object.entries(T.cause)) res.T.cause[k] = (res.T.cause[k] || 0) + v;
}
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : 'n/a'); const won = GAMES - res.noWin;
console.log(`\n== Stop-Loss · back ${BACK} · scope ${SCOPE}${KEEP ? ' · stays equipped' : ' · spent on use'}${FLOOR ? ' · bear floor' : ''} · costs $${COST * 10}M · ${GAMES} games, seeds ${SEED}+`);
console.log(`rounds ${(res.rounds / won).toFixed(2)} · going first wins ${pct(res.first, won)} · no winner ${res.noWin}`);
console.log(`drawn by ${res.drew} players · equipped by ${pct(res.drewPlayed, res.drew)} of them · those who drew it won ${pct(res.drewWon, res.drew)} · those who equipped it won ${pct(res.playedWon, res.playedN)} · those it paid won ${pct(res.stoppedWon, res.stoppedN)}`);
console.log(`equipped ${res.T.equipped} · triggers ${res.T.triggers} (${(res.T.triggers / Math.max(1, res.T.equipped)).toFixed(2)} per copy equipped) · average $${Math.round(res.T.back / Math.max(1, res.T.triggers))}M back${FLOOR ? ' · bear sales floored ' + res.T.floor : ''}\n  by: ` + Object.entries(res.T.cause).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · '));
