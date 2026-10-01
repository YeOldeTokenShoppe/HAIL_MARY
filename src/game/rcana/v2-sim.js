#!/usr/bin/env node
// Version 2 (duel) simulator.
//   node v2-sim.js --games 1000 --a strong --b strong --da revChains --db upright
import { DuelGame } from './v2-engine.js';
import { StrongPolicy, NaivePolicy, RandomPolicy } from './tarot-bots.js';
import { buildDeck, DECK_PRESETS } from './v2.js';
import { makeRng } from './engine.js';

const ARGV = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
const args = Object.fromEntries(ARGV.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));

class StrongV2 extends StrongPolicy {
  pipValue(g, p, a) {
    const c = a.card; if (!c.reversed) return super.pipValue(g, p, a);
    const h = Math.ceil(c.rank / 2);
    if (c.suit === 'coins') return h * 1.15; // banked, safe
    if (c.suit === 'candles') return h + g.modSum(p, 'candlesBonus') + g.yieldOf(p, a.choice.inst) + 0.5;
    if (c.suit === 'cups') { const o = a.choice.opp; return Math.min(h, o.portfolio) * 1.2 + h + g.modSum(p, 'revCupsBonus'); }
    return -1;
  }
  wantHedge(g, p, opts, threat) {
    const t = threat.target; let harm;
    if (t.card) { const kills = t.drawdown + threat.amount >= t.card.res; harm = kills ? 2 + g.yieldOf(p, t) * this.horizon(g) + (t.card.kw.exitScam || 0) : threat.amount * 0.4; }
    else harm = Math.min(threat.amount, p.portfolio);
    const rev = opts.filter((c) => c.reversed).sort((a, b) => a.rank - b.rank);
    const free = rev.find((c) => c.rank + 2 >= threat.amount) || rev[rev.length - 1];
    if (free && harm >= 0.8) return free;
    return super.wantHedge(g, p, opts.filter((c) => !c.reversed), threat);
  }
  reserveChoice(g, p) {
    if (!p.hand.length) return null; const liq = g.liquidity(p) + 1; const h = this.horizon(g);
    const use = (c) => { let v = c.type === 'court' ? this.courtValue(g, p, c, h) : c.reversed ? (c.suit === 'chains' ? (c.rank + 2) * 0.5 : Math.ceil(c.rank / 2) * 1.1) : c.rank * (c.suit === 'chains' ? 0.7 : 1); if (c.cost > liq + 2) v *= 0.6; if (c.suit === 'candles' && !p.floor.length) v *= 0.5; return v / Math.max(1, Math.sqrt(c.cost || 1)); };
    return [...p.hand].sort((a, b) => use(a) - use(b))[0];
  }
}
export function policy(kind, seed, opts = {}) { if (kind === 'random') return new RandomPolicy(makeRng(seed * 31 + 7)); if (kind === 'naive') return new NaivePolicy(makeRng(seed * 31 + 7)); return new StrongV2(opts); }
export function playOne({ a = 'strong', b = 'strong', da = 'upright', db = 'upright', seed = 1, swap = false, snapshots = false, rules = {}, optsA = {}, optsB = {}, extra = [] }) {
  const rng = makeRng(seed * 977 + 3);
  const players = [
    { name: `${DECK_PRESETS[da].name} (${a})`, policy: policy(a, seed, optsA), deckList: buildDeck(da, rng), deckPreset: da },
    { name: `${DECK_PRESETS[db].name} (${b})`, policy: policy(b, seed + 1, optsB), deckList: buildDeck(db, rng), deckPreset: db },
    ...extra.map((e, i) => ({ name: `${DECK_PRESETS[e.d].name} #${i + 3}`, policy: policy(e.p || 'strong', seed + 2 + i), deckList: buildDeck(e.d, rng), deckPreset: e.d })),
  ];
  if (players[0].name === players[1].name) { players[0].name += ' A'; players[1].name += ' B'; }
  if (swap) { const t = players[0]; players[0] = players[1]; players[1] = t; }
  return new DuelGame({ players, seed, snapshots, rules });
}
export function batch(opts, n) {
  const res = { games: n, wins: {}, firstWins: 0, bell: 0, rounds: [], banks: [], majors: 0, cardPlays: {}, stats: {}, archetypes: {}, reasons: {} };
  for (let i = 0; i < n; i++) {
    const g = playOne({ ...opts, seed: opts.seed + i, swap: i % 2 === 1 }); const r = g.run();
    const w = r.winner || 'draw'; res.wins[w] = (res.wins[w] || 0) + 1; if (r.winnerIdx === 0) res.firstWins++; if (r.finalBell) res.bell++;
    res.rounds.push(r.rounds); res.banks.push(...r.players.map((p) => p.bank)); res.majors += r.majorsSeen;
    const rk = /banked/.test(r.reason) ? 'banked target' : r.reason.split(':')[0]; res.reasons[rk] = (res.reasons[rk] || 0) + 1;
    for (const [k, v] of Object.entries(r.cardPlays)) res.cardPlays[k] = (res.cardPlays[k] || 0) + v;
    for (const p of r.players) { for (const [k, v] of Object.entries(p.stats)) res.stats[k] = (res.stats[k] || 0) + v; const key = `${p.name}: ${p.archetype}`; res.archetypes[key] = (res.archetypes[key] || 0) + 1; }
  }
  const sum = (a) => a.reduce((x, y) => x + y, 0); const avg = (a) => (sum(a) / a.length).toFixed(1); const sorted = [...res.rounds].sort((x, y) => x - y);
  res.avgRounds = avg(res.rounds); res.medianRounds = sorted[Math.floor(n / 2)]; res.p10 = sorted[Math.floor(n * 0.1)]; res.p90 = sorted[Math.floor(n * 0.9)]; res.avgBank = avg(res.banks); res.bellRate = Math.round(res.bell / n * 100) + '%';
  return res;
}
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('v2-sim.js')) {
  const games = +(args.games || 500); const seed = +(args.seed || 1); const rules = {}; if (args.win) rules.winBank = +args.win; if (args.interest) rules.interestDiv = +args.interest; if (args.firstHand) rules.firstHandPenalty = +args.firstHand; if (args.chainsBonus) rules.revChainsBonus = +args.chainsBonus; if (args.chainsDraw) rules.revChainsDraw = true; if (args.cupsPenalty) rules.revCupsPenalty = +args.cupsPenalty; if (args.cupsCost) rules.revCupsCost = +args.cupsCost; if (args.cupsDiv) rules.revCupsTakeDiv = +args.cupsDiv; if (args.cupsDraw) rules.cupsDraw = true;
  const o = { a: args.a || 'strong', b: args.b || 'strong', da: args.da || 'upright', db: args.db || 'upright', seed, rules };
  if (args.verbose) { const g = playOne({ ...o, snapshots: true }); g.run(); for (const s of g.snapshots) { console.log(`\n=== ${s.label} R${s.round} ${s.active || ''} | Market: ${s.market || '-'} | Providence: ${s.providence.join(', ') || '-'} ===`); s.events.forEach((e) => console.log('  ' + e)); s.players.forEach((p) => console.log(`  ${p.name}: Bank ${p.bank} Port ${p.portfolio} Liq ${p.reserve - p.locked}/${p.reserve} Hand ${p.hand.length} | ${p.floor.map((i) => `${i.name}${i.working ? '*' : ''}${i.drawdown ? `(${i.drawdown})` : ''}`).join(', ')}`)); } console.log(JSON.stringify(g.result(), null, 1)); }
  else {
    const r = batch(o, games); const s = r.stats; const pg = (k) => ((s[k] || 0) / games).toFixed(2);
    console.log(`${games} games: ${o.da}(${o.a}) vs ${o.db}(${o.b}) | win ${rules.winBank || 80}`);
    console.log('wins', JSON.stringify(r.wins), '| first player', Math.round(r.firstWins / games * 100) + '%'); console.log('reasons', r.reasons);
    console.log(`rounds avg ${r.avgRounds} median ${r.medianRounds} p10 ${r.p10} p90 ${r.p90} | Final Bell ${r.bellRate} | avg end bank ${r.avgBank} | majors seen/game ${(r.majors / games).toFixed(1)}`);
    console.log(`per game: chains attacks ${pg('chains')} hedges ${pg('hedges')} coins ${pg('coins')} coinsRev ${pg('coinsRev')} candles ${pg('candles')} candlesRev ${pg('candlesRev')} cups ${pg('cups')} cupsRev ${pg('cupsRev')} liquidated ${pg('liquidated')} frontrun ${pg('frontrun')} foretells ${pg('foretells')} invokes ${pg('invokes')}`);
  }
}
