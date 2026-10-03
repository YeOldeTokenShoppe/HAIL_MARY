#!/usr/bin/env node
// Tarot-configuration batch simulator.
//   node tarot-sim.js --games 2000 --a strong --b random
//   node tarot-sim.js --verbose --seed 5
//   node tarot-sim.js --games 1000 --a strong --b strong --win 60
import { TarotGame } from './tarot-engine.js';
import { StrongPolicy, RandomPolicy, NaivePolicy } from './tarot-bots.js';
import { makeRng } from './engine.js';

const ARGV = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
const args = Object.fromEntries(ARGV.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));

export function policy(kind, seed, opts = {}) { if (kind === 'random') return new RandomPolicy(makeRng(seed * 31 + 7)); if (kind === 'naive') return new NaivePolicy(makeRng(seed * 31 + 7)); return new StrongPolicy(opts); }
export function playOne({ a = 'strong', b = 'random', seed = 1, swap = false, snapshots = false, rules = {}, optsA = {}, optsB = {} }) {
  const players = [{ name: `${a.toUpperCase()} A`, policy: policy(a, seed, optsA) }, { name: `${b.toUpperCase()} B`, policy: policy(b, seed + 1, optsB) }];
  if (swap) players.reverse();
  return new TarotGame({ players, seed, snapshots, rules });
}
export async function batch(opts, n) {
  const res = { games: n, wins: {}, firstWins: 0, bell: 0, rounds: [], banks: [], majors: 0, cardPlays: {}, stats: {}, archetypes: {}, reasons: {} };
  for (let i = 0; i < n; i++) {
    const g = playOne({ ...opts, seed: opts.seed + i, swap: i % 2 === 1 }); const r = await g.run();
    const w = r.winner || 'draw'; res.wins[w] = (res.wins[w] || 0) + 1; if (r.winnerIdx === 0) res.firstWins++; if (r.finalBell) res.bell++;
    res.rounds.push(r.rounds); res.banks.push(...r.players.map((p) => p.bank)); res.majors += r.majorsSeen;
    const rk = /banked/.test(r.reason) ? 'banked target' : r.reason.split(':')[0]; res.reasons[rk] = (res.reasons[rk] || 0) + 1;
    for (const [k, v] of Object.entries(r.cardPlays)) res.cardPlays[k] = (res.cardPlays[k] || 0) + v;
    for (const p of r.players) { for (const [k, v] of Object.entries(p.stats)) res.stats[k] = (res.stats[k] || 0) + v; const key = `${p.name}: ${p.archetype}`; res.archetypes[key] = (res.archetypes[key] || 0) + 1; }
  }
  const avg = (a) => (sum(a) / a.length).toFixed(1); const sorted = [...res.rounds].sort((x, y) => x - y);
  res.avgRounds = avg(res.rounds); res.medianRounds = sorted[Math.floor(n / 2)]; res.p10 = sorted[Math.floor(n * 0.1)]; res.p90 = sorted[Math.floor(n * 0.9)]; res.avgBank = avg(res.banks); res.bellRate = Math.round(res.bell / n * 100) + '%';
  return res;
}
const sum = (a) => a.reduce((x, y) => x + y, 0);

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('tarot-sim.js')) {
  const optsA = {}; if (args.keepA != null) optsA.keep = +args.keepA; const optsB = {}; if (args.keepB != null) optsB.keep = +args.keepB;
  const games = +(args.games || 500); const seed = +(args.seed || 1); const rules = {}; if (args.win) rules.winBank = +args.win; if (args.hand) rules.openingHand = +args.hand; if (args.draw) rules.minorsPerTurn = +args.draw; if (args.first != null) rules.firstTurnDraw = +args.first; if (args.v1b) rules.v1b = true; if (args.v1c) rules.v1c = true; if (args.passLast != null) rules.passLast = +args.passLast === 1; if (args.traders != null) rules.traders = +args.traders === 1; if (args.actions != null) rules.actionsPerTurn = +args.actions; if (args.passNoHedge != null) rules.passNoHedge = +args.passNoHedge === 1; if (args.seatLiq != null) rules.seatLiq = +args.seatLiq; if (args.seatProfit != null) rules.seatProfit = +args.seatProfit; if (args.seatFavor != null) rules.seatFavor = +args.seatFavor; if (args.firstHand != null) rules.firstHandPenalty = +args.firstHand; if (args.passMax != null) rules.passMax = +args.passMax; if (args.hedgeFree != null) rules.hedgeFree = +args.hedgeFree === 1; if (args.spareMin != null) rules.spareMin = +args.spareMin; if (args.replace != null) rules.replacePartner = +args.replace === 1; if (args.majors != null) rules.majorsSeparate = +args.majors === 1; if (args.cap) rules.networkCap = +args.cap; if (args.copyFavor != null) rules.copyFavor = +args.copyFavor === 1; if (args.copyCost != null) rules.copyCost = +args.copyCost; if (args.copyYield) rules.copyYield = args.copyYield; if (args.spare) rules.spareFavor = +args.spare; if (args.foretellFavor) rules.foretellFavor = +args.foretellFavor; if (args.interest) rules.interestDiv = +args.interest; if (args.passMult) rules.passMult = +args.passMult; if (args.passMin) rules.passMin = +args.passMin; if (args.passUnderdog) rules.passUnderdogOnly = true; if (args.noPassA) optsA.usePass = false; if (args.noPassB) optsB.usePass = false; if (args.finish != null) rules.finishRound = +args.finish === 1; if (args.first != null) rules.firstTurnDraw = +args.first;
  if (args.verbose) {
    const g = playOne({ a: args.a || 'strong', b: args.b || 'random', seed, snapshots: true, rules, optsA, optsB }); await g.run();
    for (const s of g.snapshots) { console.log(`\n=== ${s.label} R${s.round} ${s.active || ''} | Market: ${s.market || '-'} | Providence: ${s.providence.join(', ') || '-'} | deck ${s.deckLeft} ===`); s.events.forEach((e) => console.log('  ' + e)); s.players.forEach((p) => console.log(`  ${p.name}: Bank ${p.bank} Port ${p.portfolio} Liq ${p.reserve - p.locked}/${p.reserve} Hand ${p.hand.length} | ${p.floor.map((i) => `${i.name}${i.working ? '*' : ''}${i.drawdown ? `(${i.drawdown})` : ''}`).join(', ')}`)); }
    console.log(JSON.stringify(g.result(), null, 1));
  } else {
    const r = await batch({ a: args.a || 'strong', b: args.b || 'random', seed, rules, optsA, optsB }, games);
    console.log(`${games} games: ${args.a || 'strong'} vs ${args.b || 'random'} | win target ${rules.winBank || 80}`);
    console.log('wins', JSON.stringify(r.wins), '| first player wins', Math.round(r.firstWins / games * 100) + '%'); console.log('reasons', r.reasons);
    console.log(`rounds avg ${r.avgRounds} median ${r.medianRounds} p10 ${r.p10} p90 ${r.p90} | Final Bell ${r.bellRate} | avg end bank ${r.avgBank} | majors seen/game ${(r.majors / games).toFixed(1)}`);
    const s = r.stats; const pg = (k) => (s[k] / games).toFixed(2);
    console.log(`per game: passes ${pg('passes')} complete ${pg('completions')} intercepted ${pg('interceptions')} | worked ${pg('worked')} pips ${pg('pips')} coins ${pg('coins')} candles ${pg('candles')} chains ${pg('chains')} cups ${pg('cups')} hedges ${pg('hedges')} hires ${pg('hires')} invokes ${pg('invokes')} liquidated ${pg('liquidated')} foretells ${pg('foretells')} passOffers ${pg('passOffers')} passWins ${pg('passWins')} traders ${pg('traderPlays')} copies ${pg('copies')} favor ${pg('favorGained')} spent ${pg('favorSpent')} spared ${pg('spared')}`);
    console.log('archetypes', r.archetypes);
    if (args.cards) { const e = Object.entries(r.cardPlays).sort((x, y) => y[1] - x[1]); console.log('most', e.slice(0, 10)); console.log('least', e.slice(-10)); }
  }
}
