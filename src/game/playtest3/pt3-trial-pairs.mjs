#!/usr/bin/env node
// TRIAL (2026-11-26): COMPANION CARDS, SETS, and TRADING with the rival. Sim only: nothing here touches pt3-sim.js or the set.
//
// COMPANIONS (--pairs): each Trader has one card that does more in their hands.
//   sale    that Asset sells for $50M more for them      gamble  it wins on that many more faces
//   special The Short pays $150M (Garth) · Seed Round blooms in two rounds (Eugene) · equipping Pocket Saint lights a candle (Saint GR80)
// SETS (--sets): while you hold two of a set, each sells for $50M more.
// TRADING (--trade): at the start of your turn you may offer your rival one Asset from your portfolio, or one card from your hand,
//   at a price. Here two bots trade when the card is worth at least $MIN M more to the buyer than to the seller, and split the difference.
//   node pt3-trial-pairs.mjs --games 8000 --mode shuffle|starters [--pairs 1] [--sets 1] [--trade 1] [--min 20]
import { Game, GreedyBot, byKey } from './pt3-sim.js';
const ARGV = process.argv.slice(2); const arg = (k, d) => { const i = ARGV.indexOf('--' + k); return i < 0 ? d : ARGV[i + 1]; };
const GAMES = +arg('games', 8000), SEED = +arg('seed', 424200), MODE = arg('mode', 'shuffle'), PAIRS = !!arg('pairs', null), SETS = !!arg('sets', null), TRADE = !!arg('trade', null), MIN = +arg('min', 20), BONUS = +arg('bonus', 50);
export const COMPANION = { // Trader -> [card, kind, amount]
  prospector: ['oil', 'gamble', 1],        // Brent Crude · Oil Field Claim: his wells gush on one more face
  garth: ['short', 'special'],             // Garth Raider · The Short: his Shorts pay $150M
  monje: ['talisman', 'special'],          // Saint GR80 · Pocket Saint: equipping it lights a candle
  unicornio: ['semilla', 'special'],       // Eugene · Seed Round: it blooms in two rounds, not four
  abuela: ['racehorse', 'gamble', 1],      // The Gambler · Racehorse: her horse wins on one more face (on top of Lucky Streak)
  bot: ['tech', 'sale'],                   // The Octobot · Tech Stock
  celebridad: ['meme', 'gamble', 2],       // The Influencer · Meme Coin: she pumps it, two more winning faces
  diablito: ['perp', 'sale'],              // Connor · Perpetuals
  gato: ['realestate', 'sale'],            // Virgil · Real Estate
  investigadora: ['bluechip', 'sale'],     // Marisol · Blue Chip
  general: ['bono', 'sale'],               // Byzantine General · Savings Bond
};
export const SETLIST = { metals: ['goldbar', 'plata'], collector: ['fineart', 'rideordie', 'grail'], income: ['jardin', 'junk', 'stablecoin'] };
const setOf = (k) => Object.values(SETLIST).find((s) => s.includes(k));
const T = { trades: 0, price: 0, surplus: 0, byKey: {}, fromHand: 0, pairDriven: 0, gamesWithTrade: 0, compSales: 0, setSales: 0, sales: 0 };
class G extends Game {
  // Companions and sets are in the engine since they were built in (2026-11-26): comp(), setMate(), pairBonus(). This trial now only adds the trading.
  async sellAsset(p, a, w) { const comp = !!this.comp(p, a.key), set = this.setMate(p, a); const ok = await super.sellAsset(p, a, w); if (ok && !p.invest.includes(a)) { T.sales++; if (comp) T.compSales++; if (set) T.setSales++; } return ok; }
  // what an Asset is worth to q if q holds it and sells it, in $M
  worth(q, a) {
    let base = a.bornTurn != null && (a.ripe || a.grow) ? this.baseProsOf(a) : a.gem ? (q.deeds >= 3 ? a.gem : a.pros) : a.perp ? a.pros * 2 : a.ripe ? 100 : a.pros;
    if (a.bullOnly) base *= 0.6;
    if (a.gamble) { const c = this.comp(q, a.key); const need = (a.gambleOn || 5) + 1 - this.lucky(q) - (c && c.kind === 'gamble' ? c.n : 0); const P = Math.max(0, Math.min(1, (9 - need) / 8)); base = Math.max(a.cash * 10, P * a.pros + (1 - P) * (a.bust || 0)); }
    const setB = a.set && q.invest.some((x) => x !== a && x.set === a.set) ? BONUS : 0; const c = this.comp(q, a.key);
    return base + (c && c.kind === 'sale' ? c.amount : 0) + setB + this.ethosBonus(q) + (a.income ? a.income * 10 * 2 : 0);
  }
  special(q, c) { const k = this.comp(q, c.key); return k && k.kind === 'special' ? ({ short: 25, semilla: 35, talisman: 20 }[c.key] || 0) : 0; }
  tradePhase(p) {
    const r = this.rivals(p)[0]; let best = null;
    for (const a of this.hot(p)) { if (a.shortBy != null) continue; const vs = this.worth(p, a), vb = this.worth(r, a); const S = vb - vs; if (S >= MIN && (!best || S > best.S)) best = { S, vs, a, hand: false, pair: !!(this.comp(r, a.key) || (a.set && r.invest.some((x) => x.set === a.set))) }; }
    for (const c of p.hand) { let vs, vb;
      if (c.type === 'asset') { vs = Math.max(0, this.worth(p, c) - this.costOf(p, c) * 10); vb = this.worth(r, c) - this.costOf(r, c) * 10; }
      else if (this.special(r, c) && !this.special(p, c)) { vs = 10; vb = 10 + this.special(r, c); } else continue;
      const S = vb - vs; if (S >= MIN && (!best || S > best.S)) best = { S, vs, a: c, hand: true, pair: !!(this.comp(r, c.key) || (c.set && r.invest.some((x) => x.set === c.set))) }; }
    if (!best) return; const price = Math.round((best.vs + best.S / 2) / 10) * 10; if (r.cash < price + (best.hand ? this.costOf(r, best.a) * 10 : 0)) return;
    r.cash -= price; p.cash += price;
    if (best.hand) { p.hand.splice(p.hand.indexOf(best.a), 1); r.hand.push(best.a); } else { p.invest.splice(p.invest.indexOf(best.a), 1); delete best.a.cold; r.invest.push(best.a); }
    T.trades++; T.price += price; T.surplus += best.S; T.byKey[best.a.key] = (T.byKey[best.a.key] || 0) + 1; if (best.hand) T.fromHand++; if (best.pair) T.pairDriven++; this._traded = true;
    this.log(`${p.name} sells ${best.a.name} to ${r.name} for $${price}M`);
  }
  // the offer is made at the start of the turn, before the draw, so no action already chosen can be holding the card that is sold
  async turnDraw(p) { if (TRADE) { const k = this.turnNo + ':' + p.idx; if (this._tk !== k) { this._tk = k; this.tradePhase(p); } } return super.turnDraw(p); }
}
class B extends GreedyBot {}
const recs = MODE === 'starters' ? ['devotion', 'degen'] : ['shuffle', 'shuffle'];
const res = { noWin: 0, first: 0, rounds: 0, wins: {}, games: {}, starter: {} };
for (let i = 0; i < GAMES; i++) {
  const players = [0, 1].map((j) => ({ name: 'AB'[j], recipe: recs[j], starter: null, policy: new B() })); if (i % 2) players.push(players.shift());
  const g = new G({ players, seed: SEED + i }); await g.run(); if (g._traded) T.gamesWithTrade++;
  if (!g.winner) { res.noWin++; continue; } res.rounds += g.turnNo; if (g.winner === g.order[0]) res.first++;
  for (const p of g.players) { res.games[p.recipe] = (res.games[p.recipe] || 0) + 1; if (g.winner === p) res.wins[p.recipe] = (res.wins[p.recipe] || 0) + 1; const S = res.starter[p.starter] ||= { g: 0, w: 0 }; S.g++; if (g.winner === p) S.w++; }
}
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : 'n/a'); const won = GAMES - res.noWin;
const op = Object.entries(res.starter).map(([k, v]) => [byKey[k].name, Math.round(v.w / v.g * 100)]).sort((a, b) => b[1] - a[1]);
console.log(`\n== ${MODE} · ${['companions and sets (in the engine)', TRADE && 'trading (min $' + MIN + 'M)'].filter(Boolean).join(' + ')} · ${GAMES} games`);
console.log(`   rounds ${(res.rounds / won).toFixed(2)} · going first ${pct(res.first, won)} · ` + Object.keys(res.games).map((k) => `${k} ${pct(res.wins[k] || 0, res.games[k])}`).join(' · ') + ` · no winner ${res.noWin}`);
console.log('   openers: ' + op.map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`   sales ${(T.sales / GAMES).toFixed(1)} a game · with a companion bonus ${pct(T.compSales, T.sales)} · with a set bonus ${pct(T.setSales, T.sales)}`);
if (TRADE) console.log(`   trades ${(T.trades / GAMES).toFixed(2)} a game · games with at least one ${pct(T.gamesWithTrade, GAMES)} · average price $${Math.round(T.price / Math.max(1, T.trades))}M · from the hand ${pct(T.fromHand, T.trades)} · driven by a companion or set ${pct(T.pairDriven, T.trades)}\n   most traded: ` + Object.entries(T.byKey).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${byKey[k].name} ${v}`).join(' · '));
