#!/usr/bin/env node
// CARD REPORT (2026-11-26): which cards are weak in play. Sim only; reads the engine, changes nothing.
// General Shuffle, two bots: every card is one copy in one shared deck, so every card gets the same exposure.
// For each card that reaches a hand:  held = players who had it in hand at some point · played = of those, how many played
// (bought, equipped, seated) it · win(held) and win(played) = how often those players won · for an Asset, sold = of those bought.
// The Fates are not in hands; for them: turned, and how often the player they were turned FOR won.
//   node pt3-card-report.mjs --games 20000 [--csv 1]
import { Game, GreedyBot, byKey } from './pt3-sim.js';
const ARGV = process.argv.slice(2); const arg = (k, d) => { const i = ARGV.indexOf('--' + k); return i < 0 ? d : ARGV[i + 1]; };
const GAMES = +arg('games', 20000), SEED = +arg('seed', 424200), CSV = !!arg('csv', null);
class G extends Game {
  mark(p, set, key) { ((p._r ||= { held: new Set(), played: new Set(), sold: new Set() })[set]).add(key); }
  async draw(p, silent) { const c = await super.draw(p, silent); if (c && p.hand.includes(c)) this.mark(p, 'held', c.key); return c; }
  async playCard(p, c, choice = {}) { this.mark(p, 'held', c.key); const ok = await super.playCard(p, c, choice); if (ok) this.mark(p, 'played', c.key); return ok; }
  async sellAsset(p, a, w) { const ok = await super.sellAsset(p, a, w); if (ok && !p.invest.includes(a)) this.mark(p, 'sold', a.key); return ok; }
  async flipFate0(d) { const before = this.fateCount || 0; await super.flipFate0(d); if ((this.fateCount || 0) > before && this.fateNow) (this._fates ||= []).push([this.fateNow.card.key, d]); }
}
const S = {}, F = {}; const row = (k) => (S[k] ||= { held: 0, played: 0, sold: 0, heldWon: 0, playedWon: 0 }); let opener = {};
for (let i = 0; i < GAMES; i++) {
  const players = [0, 1].map((j) => ({ name: 'AB'[j], recipe: 'shuffle', starter: null, policy: new GreedyBot() })); if (i % 2) players.push(players.shift());
  const g = new G({ players, seed: SEED + i }); await g.run();
  for (const p of g.players) { const r = p._r || { held: new Set(), played: new Set(), sold: new Set() }, w = g.winner === p;
    for (const k of r.held) { const s = row(k); s.held++; if (w) s.heldWon++; if (r.played.has(k)) { s.played++; if (w) s.playedWon++; } if (r.sold.has(k)) s.sold++; }
    const o = (opener[p.starter] ||= { g: 0, w: 0 }); o.g++; if (w) o.w++; }
  for (const [k, d] of g._fates || []) { const f = (F[k] ||= { n: 0, w: 0 }); f.n++; if (g.winner === d) f.w++; }
}
const pc = (a, b) => (b ? Math.round(a / b * 100) : 0);
const rows = Object.entries(S).map(([k, s]) => ({ key: k, name: byKey[k].name, type: byKey[k].type, cost: (byKey[k].cost || 0) * 10, held: s.held, played: pc(s.played, s.held), winHeld: +(s.heldWon / s.held * 100).toFixed(1), winPlayed: s.played ? +(s.playedWon / s.played * 100).toFixed(1) : null, sold: byKey[k].type === 'asset' ? pc(s.sold, s.played) : null }));
const avg = rows.reduce((t, r) => t + r.winHeld, 0) / rows.length;
if (CSV) { console.log('type,card,cost,held,played%,win_held%,win_played%,sold%'); for (const r of rows.sort((a, b) => a.type.localeCompare(b.type) || a.played - b.played)) console.log([r.type, JSON.stringify(r.name), r.cost, r.held, r.played, r.winHeld, r.winPlayed ?? '', r.sold ?? ''].join(',')); }
else { console.log(`${GAMES} General Shuffle games · average win rate of a player holding any one card: ${avg.toFixed(1)}%`);
  for (const t of ['trader', 'asset', 'event', 'hazard', 'remedy', 'artifact', 'grace', 'location']) { console.log(`\n${t.toUpperCase()}`); for (const r of rows.filter((x) => x.type === t).sort((a, b) => a.played - b.played)) console.log(`  ${r.name.padEnd(30)} $${String(r.cost).padStart(2)}M  played ${String(r.played).padStart(3)}%  win held ${r.winHeld.toFixed(1)}  win played ${r.winPlayed == null ? '  – ' : r.winPlayed.toFixed(1)}${r.sold == null ? '' : '  sold ' + r.sold + '%'}`); }
  console.log('\nOPENING TRADER (win rate)'); console.log('  ' + Object.entries(opener).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g).map(([k, v]) => `${byKey[k].name} ${pc(v.w, v.g)}`).join(' · '));
  console.log('\nTHE FATES (turned · the player it was turned for won)'); console.log(Object.entries(F).sort((a, b) => a[1].w / a[1].n - b[1].w / b[1].n).map(([k, v]) => `  ${byKey[k].name.padEnd(30)} ${String(v.n).padStart(6)}  ${(v.w / v.n * 100).toFixed(1)}%`).join('\n')); }
