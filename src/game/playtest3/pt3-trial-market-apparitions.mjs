#!/usr/bin/env node
// TRIAL (2026-11-26): market effects for two apparition Fates, in place of their handouts. Sim only: nothing here touches
// pt3-sim.js, designs.js or the table.
//   Fire Horse      now: every player collects $75M.            --fuego N: instead, a bull Fate: every Asset sells for $N M more this round
//   The Holy Roller now: every player draws a card, collects $10M.  --roller split: instead, the die is rolled: 5+ a bull round, 4- a bear round
//                                                               --roller tails: 6+ bull, 3- bear, 4 or 5 nothing        (--amt N: by $N M, default 50)
//                                                               --roller up: 5+ bull, otherwise nothing
//   node pt3-trial-market-apparitions.mjs --games 12000 --mode starters|shuffle [--fuego 50] [--roller split]
import { Game, GreedyBot, byKey } from './pt3-sim.js';
const ARGV = process.argv.slice(2); const arg = (k, d) => { const i = ARGV.indexOf('--' + k); return i < 0 ? d : ARGV[i + 1]; };
const GAMES = +arg('games', 4000), SEED = +arg('seed', 424200), MODE = arg('mode', 'starters'), FUEGO = +arg('fuego', 0), ROLLER = arg('roller', 'off'), AMT = +arg('amt', 50);
if (FUEGO) byKey.fuego.market = FUEGO;
const T = { bull: 0, bear: 0, flat: 0, fuego: 0 };
class G extends Game {
  async event(p, c) {
    if (FUEGO && c.key === 'fuego') { T.fuego++; return; } // the market line is logged by flipFate from c.market
    if (ROLLER !== 'off' && c.key === 'holyroller') { const r = this.roll(); const hi = ROLLER === 'tails' ? 6 : 5, lo = ROLLER === 'tails' ? 3 : ROLLER === 'up' ? 0 : 4;
      this.market = r >= hi ? AMT : r <= lo ? -AMT : 0; T[this.market > 0 ? 'bull' : this.market < 0 ? 'bear' : 'flat']++; this.log(`THE HOLY ROLLER rolls ${r}: ${this.market > 0 ? 'a BULL' : this.market < 0 ? 'a BEAR' : 'a quiet'} round`); return; }
    return super.event(p, c);
  }
}
const recs = MODE === 'starters' ? ['devotion', 'degen'] : ['shuffle', 'shuffle'];
const res = { noWin: 0, first: 0, rounds: 0, wins: {}, games: {}, sells: 0, starter: {} };
for (let i = 0; i < GAMES; i++) {
  const players = [0, 1].map((j) => ({ name: 'AB'[j], recipe: recs[j], starter: null, policy: new GreedyBot() })); if (i % 2) players.push(players.shift());
  const g = new G({ players, seed: SEED + i }); await g.run();
  if (!g.winner) res.noWin++; else { res.rounds += g.turnNo; if (g.winner === g.order[0]) res.first++; }
  for (const p of g.players) { res.games[p.recipe] = (res.games[p.recipe] || 0) + 1; if (g.winner === p) res.wins[p.recipe] = (res.wins[p.recipe] || 0) + 1; res.sells += p.stats.sells; const S = res.starter[p.starter] ||= { g: 0, w: 0 }; S.g++; if (g.winner === p) S.w++; }
}
const pct = (a, b) => (a / b * 100).toFixed(1) + '%'; const won = GAMES - res.noWin; const op = Object.entries(res.starter).map(([k, v]) => [k, Math.round(v.w / v.g * 100)]).sort((a, b) => b[1] - a[1]);
console.log(`== ${MODE} · Fire Horse ${FUEGO ? 'bull +$' + FUEGO + 'M' : 'as now'} · Holy Roller ${ROLLER === 'off' ? 'as now' : ROLLER + ' ±$' + AMT + 'M'} · ${GAMES} games\n   rounds ${(res.rounds / won).toFixed(2)} · going first ${pct(res.first, won)} · ` + Object.keys(res.games).map((k) => `${k} ${pct(res.wins[k] || 0, res.games[k])}`).join(' · ') + ` · sales a player ${(res.sells / GAMES / 2).toFixed(2)} · openers ${op[0][0]} ${op[0][1]} … ${op[op.length - 1][0]} ${op[op.length - 1][1]}` + (ROLLER !== 'off' ? ` · roller: bull ${T.bull} bear ${T.bear} quiet ${T.flat}` : ''));
