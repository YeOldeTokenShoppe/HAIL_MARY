#!/usr/bin/env node
// TRIAL (2026-11-26): an ending for the dry table (every Asset sold, nobody at $1B). Sim only: nothing here touches pt3-sim.js.
//   --recycle 1   a sold Asset goes to its seller's discard pile and comes round again (now it leaves the game)
//   --cap N       the game lasts at most N rounds; then the most cash wins
//   node pt3-trial-ending.mjs --games 12000 --mode starters|shuffle [--recycle 1] [--cap 20]
import { Game, GreedyBot } from './pt3-sim.js';
const ARGV = process.argv.slice(2); const arg = (k, d) => { const i = ARGV.indexOf('--' + k); return i < 0 ? d : ARGV[i + 1]; };
const GAMES = +arg('games', 12000), SEED = +arg('seed', 424200), MODE = arg('mode', 'starters'), RECYCLE = !!arg('recycle', null), CAP = +arg('cap', 0);
class G extends Game {
  async sellAsset(p, a, wantPros) { const ok = await super.sellAsset(p, a, wantPros); if (RECYCLE && ok && !this.players.some((q) => q.invest.includes(a) || q.discard.includes(a))) { delete a.cold; p.discard.push(a); } return ok; }
}
const recs = MODE === 'starters' ? ['devotion', 'degen'] : ['shuffle', 'shuffle'];
const res = { stall: 0, capped: 0, first: 0, rounds: [], wins: {}, games: {}, margin: 0 };
for (let i = 0; i < GAMES; i++) {
  const players = [0, 1].map((j) => ({ name: 'AB'[j], recipe: recs[j], starter: null, policy: new GreedyBot() })); if (i % 2) players.push(players.shift());
  const g = new G({ players, seed: SEED + i, maxTurns: CAP || 300 }); await g.run(); let w = g.winner;
  if (!w && CAP) { const [x, y] = [...g.players].sort((a, b) => b.cash - a.cash); if (x.cash > y.cash) w = x; res.capped++; res.margin += x.cash - y.cash; }
  if (!w) { res.stall++; continue; }
  res.rounds.push(g.turnNo); if (w === g.order[0]) res.first++;
  for (const p of g.players) { res.games[p.recipe] = (res.games[p.recipe] || 0) + 1; if (w === p) res.wins[p.recipe] = (res.wins[p.recipe] || 0) + 1; }
}
const pct = (a, b) => (a / b * 100).toFixed(1) + '%'; const R = res.rounds.sort((a, b) => a - b), n = R.length; const q = (f) => R[Math.min(n - 1, Math.floor(n * f))];
console.log(`== ${MODE} · ${RECYCLE ? 'sold Assets recycle' : 'sold Assets leave'}${CAP ? ' · cap ' + CAP + ' rounds' : ''} · ${GAMES} games\n   rounds avg ${(R.reduce((s, x) => s + x, 0) / n).toFixed(2)} · median ${q(0.5)} · 95% by ${q(0.95)} · 99% by ${q(0.99)} · longest ${R[n - 1]} · going first ${pct(res.first, n)} · ` + Object.keys(res.games).map((k) => `${k} ${pct(res.wins[k] || 0, res.games[k])}`).join(' · ') + ` · no result ${res.stall}` + (CAP ? ` · ended by the cap ${res.capped} (${pct(res.capped, GAMES)}), average lead then $${Math.round(res.margin / Math.max(1, res.capped))}M` : ''));
