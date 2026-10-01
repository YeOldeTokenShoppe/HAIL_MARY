#!/usr/bin/env node
// CLI batch simulator. Examples:
//   node sim.js --games 500 --a degen --b analyst --pa banker --pb hodler
//   node sim.js --verbose --seed 7            (print one game turn by turn)
//   node sim.js --matrix --games 100           (all 8 Traders, auto decks)
import { Game } from './engine.js';
import { makePolicy, PRESETS } from './bots.js';
import { deckFor, buildRcana, FIRST_GAME_RCANA, listDeck } from './decks.js';
import { TRADERS } from './cards.js';

const ARGV = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
const args = Object.fromEntries(ARGV.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));
const games = +(args.games || 200); const seed0 = +(args.seed || 1);

export function playOne({ a = 'degen', b = 'analyst', pa = 'banker', pb = 'banker', seed = 1, rcana = 'random', snapshots = false, swap = false }) {
  const A = deckFor(a, seed); const B = deckFor(b, seed + 1);
  const rc = buildRcana(rcana === 'first' ? { fixed: FIRST_GAME_RCANA } : { seed });
  const players = [
    { name: `${A.trader.name.replace('THE ', '')}`, trader: A.trader, deck: A.deck, policy: makePolicy(pa) },
    { name: `${B.trader.name.replace('THE ', '')}`, trader: B.trader, deck: B.deck, policy: makePolicy(pb) },
  ];
  if (players[0].name === players[1].name) { players[0].name += ' A'; players[1].name += ' B'; }
  if (swap) players.reverse();
  const g = new Game({ players, rcana: rc, seed, snapshots });
  return g;
}

export function batch(opts, n) {
  const res = { games: n, wins: {}, bell: 0, rounds: [], banks: [], reasons: {}, cardPlays: {}, liquidated: 0, hedged: 0, frontrun: 0, worked: 0, byRound: {} };
  for (let i = 0; i < n; i++) {
    const g = playOne({ ...opts, seed: opts.seed + i, swap: i % 2 === 1, snapshots: false });
    const r = g.run();
    const w = r.winnerIdx >= 0 ? g.players[r.winnerIdx].trader.name + '/' + g.players[r.winnerIdx].policy.name : 'draw';
    res.wins[w] = (res.wins[w] || 0) + 1; if (r.finalBell) res.bell++;
    res.rounds.push(r.rounds); res.banks.push(...r.players.map((p) => p.bank));
    const rk = /banked/.test(r.reason) ? 'banked 80' : r.reason.split(':')[0]; res.reasons[rk] = (res.reasons[rk] || 0) + 1;
    for (const [k, v] of Object.entries(r.cardPlays)) res.cardPlays[k] = (res.cardPlays[k] || 0) + v;
    r.players.forEach((p) => { res.liquidated += p.stats.liquidated; res.hedged += p.stats.hedged; res.frontrun += p.stats.frontrun; res.worked += p.stats.worked; });
  }
  const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  res.avgRounds = avg(res.rounds); res.avgBank = avg(res.banks); res.bellRate = (res.bell / n * 100).toFixed(0) + '%';
  const sorted = [...res.rounds].sort((x, y) => x - y); res.medianRounds = sorted[Math.floor(n / 2)]; res.p10 = sorted[Math.floor(n * 0.1)]; res.p90 = sorted[Math.floor(n * 0.9)];
  return res;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('sim.js')) {
  if (args.verbose) {
    const g = playOne({ a: args.a || 'degen', b: args.b || 'analyst', pa: args.pa || 'banker', pb: args.pb || 'hodler', seed: seed0, rcana: args.rcana || 'first', snapshots: true });
    g.run();
    for (const s of g.snapshots) {
      console.log(`\n=== ${s.label.toUpperCase()} round ${s.round} ${s.active || ''} | Market: ${s.market} | Omen: ${s.omen} | Providence: ${s.providence || '-'} ===`);
      s.events.forEach((e) => console.log('  ' + e));
      s.players.forEach((p) => console.log(`  ${p.name}: Bank ${p.bank} Port ${p.portfolio} Liq ${p.reserve - p.locked}/${p.reserve} Hand ${p.hand.length} | ${p.floor.map((i) => `${i.name}${i.working ? '*' : ''}${i.drawdown ? `(${i.drawdown})` : ''}`).join(', ')}`));
    }
    console.log('\nRESULT', JSON.stringify(g.result(), null, 1));
  } else if (args.matrix) {
    const ids = TRADERS.map((t) => t.id); const table = {};
    for (const a of ids) { table[a] = {}; for (const b of ids) { if (a === b) { table[a][b] = '-'; continue; } const r = batch({ a, b, pa: args.pa || 'banker', pb: args.pb || 'banker', seed: seed0, rcana: 'random' }, games); const wa = Object.entries(r.wins).filter(([k]) => k.startsWith(TRADERS.find((t) => t.id === a).name)).reduce((s, [, v]) => s + v, 0); table[a][b] = Math.round(wa / games * 100) + '%'; } }
    console.log('Row = Trader A win rate vs column (auto decks, ' + games + ' games each)'); console.table(table);
  } else {
    const opts = { a: args.a || 'degen', b: args.b || 'analyst', pa: args.pa || 'banker', pb: args.pb || 'banker', seed: seed0, rcana: args.rcana || 'random' };
    const r = batch(opts, games);
    console.log(`${games} games: ${opts.a}(${opts.pa}) vs ${opts.b}(${opts.pb}) | rcana=${opts.rcana}`);
    console.log('wins', r.wins); console.log('reasons', r.reasons);
    console.log(`rounds avg ${r.avgRounds} median ${r.medianRounds} p10 ${r.p10} p90 ${r.p90} | Final Bell ${r.bellRate} | avg end bank ${r.avgBank}`);
    console.log(`per game: worked ${(r.worked / games).toFixed(1)} liquidated ${(r.liquidated / games).toFixed(2)} hedged ${(r.hedged / games).toFixed(2)} frontrun ${(r.frontrun / games).toFixed(1)}`);
    if (args.cards) { const e = Object.entries(r.cardPlays).sort((x, y) => y[1] - x[1]); console.log('most played', e.slice(0, 12)); console.log('least played', e.slice(-12)); }
  }
}
