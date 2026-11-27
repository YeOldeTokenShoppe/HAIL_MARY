#!/usr/bin/env node
// TRIAL (2026-11-26): FUEL for the Traders, two ways. Sim only: nothing here touches pt3-sim.js or the set.
//
// --mode tempt   TEMPTATIONS, an optional boost. Five cards; playing one is free (no action, no price), one a turn, after the draw.
//                Each gives a kick now and a comedown on your next turn. A Trader's preferred one has no comedown.
//     espresso   one more action this turn            · next turn, draw one card fewer
//     energy     two more actions this turn           · next turn, no buying
//     champagne  your next gamble wins on 2 more faces · your next plain sale brings $20M less
//     whiskey    no Calamity can be played on you until your next turn · next turn, your Trader's ability is off
//     sugar      draw two cards                        · discard one at the end of this turn
// --mode need    FUEL THE TRADER NEEDS, the Pokémon way. Fuel cards are attached to the Trader, one a turn, free. With no fuel
//                attached the Trader's ability (and Ethos, and companion) is off. Spend two for one more action.
// --mode none    the game as built.
//   node pt3-trial-fuel.mjs --games 8000 --decks starters|shuffle --mode tempt|need|none [--copies N]
import { Game, GreedyBot, byKey, RECIPES } from './pt3-sim.js';
const ARGV = process.argv.slice(2); const arg = (k, d) => { const i = ARGV.indexOf('--' + k); return i < 0 ? d : ARGV[i + 1]; };
const GAMES = +arg('games', 8000), SEED = +arg('seed', 424200), DECKS = arg('decks', 'starters'), MODE = arg('mode', 'tempt'), COPIES = +arg('copies', MODE === 'need' ? 8 : 1), NOCOME = !!arg('nocomedown', null), ABSTAIN = !!arg('abstain', null), HARSH = !!arg('harsh', null), V2 = !!arg('v2', null); // --v2: stronger kicks (espresso: your sales this turn bring $30M more · energy: two more actions, and you may sell what you buy this turn)
const KINDS = ['espresso', 'energy', 'champagne', 'whiskey', 'sugar'];
const PREFERS = { garth: 'espresso', investigadora: 'espresso', bot: 'energy', celebridad: 'energy', abuela: 'champagne', unicornio: 'champagne', prospector: 'whiskey', general: 'whiskey', diablito: 'whiskey', gato: 'sugar', monje: 'sugar' };
for (const k of KINDS) byKey[k] = { key: k, name: k[0].toUpperCase() + k.slice(1), type: 'temptation', cost: 0, tempt: k };
byKey.fuel = { key: 'fuel', name: 'Fuel', type: 'fuel', cost: 0, fuel: true };
if (MODE === 'tempt') { RECIPES.shuffle = [...RECIPES.shuffle, ...KINDS.map((k) => [k, COPIES])]; RECIPES.devotion = [...RECIPES.devotion, ['espresso', COPIES], ['sugar', COPIES], ['whiskey', COPIES]]; RECIPES.degen = [...RECIPES.degen, ['espresso', COPIES], ['energy', COPIES], ['champagne', COPIES]]; }
if (MODE === 'need') for (const r of ['shuffle', 'devotion', 'degen']) RECIPES[r] = [...RECIPES[r], ['fuel', r === 'shuffle' ? Math.round(COPIES * 1.5) : COPIES]];
const T = { held: {}, used: {}, pref: 0, turns: 0, dry: 0, attached: 0, power: 0, scandal: 0 };
class G extends Game {
  async takeTurn(p) { p.cdNow = p.cdNext || {}; p.cdNext = {}; p.shield = false; p.tempted = false; p.buzz = 0; p.wired = false; T.turns++; if (MODE === 'need' && p.trader && !(p.fuel >= 1)) T.dry++;
    await super.takeTurn(p);
    if (p.cdEnd) { p.cdEnd = false; if (p.hand.length) { const d = await p.policy.discardOne(this, p); p.hand.splice(p.hand.indexOf(d), 1); p.discard.push(d); } } }
  abilityOn(p) { return super.abilityOn(p) && !(p.cdNow && p.cdNow.abilityOff) && !(MODE === 'need' && !(p.fuel >= 1)); }
  drawsOf(p) { return Math.max(1, super.drawsOf(p) - (p.cdNow && p.cdNow.drawLess ? 1 : 0)); }
  canHit(t, c) { return !t.shield && super.canHit(t, c); }
  quick(p, a) { return !!p.wired || super.quick(p, a); }
  gambleNeed(p, a) { return super.gambleNeed(p, a) - (p.champ ? 2 : 0); }
  legalActionsAll(p) { const A = super.legalActionsAll(p); return p.cdNow && p.cdNow.noBuy && this.active === p ? A.filter((a) => !(a.t === 'play' && a.c.type === 'asset')) : A; }
  async sellAsset(p, a, w) { const gamble = !!a.gamble && w; const ok = await super.sellAsset(p, a, w); if (ok && !p.invest.includes(a)) { if (p.buzz) p.cash += p.buzz; if (gamble) p.champ = false; else if (p.saleLess) { p.cash = Math.max(0, p.cash - p.saleLess); p.saleLess = 0; } } return ok; }
  async marketBet(p) { if (MODE === 'bar') await this.bar(p); if (MODE === 'tempt') await this.tempt(p); if (MODE === 'need') this.refuel(p); return super.marketBet(p); } // right after the draw, before the actions
  async tempt(p) {
    for (const c of p.hand) if (c.tempt) (T.held[c.tempt] ||= new Set()).add(this.gid + ':' + p.idx);
    const r = this.rivals(p)[0]; const want = (k) => k === 'espresso' ? (V2 ? p.invest.some((a) => a.bornTurn !== this.turnNo) : p.hand.length >= 4) : k === 'energy' ? p.hand.length >= 5 : k === 'champagne' ? p.invest.some((a) => a.gamble && a.bornTurn !== this.turnNo) : k === 'whiskey' ? this.netWorth(p) >= this.netWorth(r) && p.invest.length >= 1 : p.hand.length <= 5;
    if (ABSTAIN && p.name === 'A') return; // --abstain: player A never gives in, player B does: is giving in the better play?
    const c = p.hand.find((x) => x.tempt && want(x.tempt)); if (!c || p.tempted) return; p.tempted = true; p.hand.splice(p.hand.indexOf(c), 1); p.discard.push(c);
    const k = c.tempt, pref = !!(p.trader && PREFERS[p.trader.key] === k), come = !pref && !NOCOME; T.used[k] = (T.used[k] || 0) + 1; if (pref) T.pref++; p._used = true;
    if (V2 && k === 'espresso') p.buzz = 30; if (V2 && k === 'energy') p.wired = true;
    if (k === 'espresso') { p.extraActions = (p.extraActions || 0) + 1; if (come) { p.cdNext.drawLess = true; if (HARSH) p.cdNext.noBuy = true; } }
    if (k === 'energy') { p.extraActions = (p.extraActions || 0) + 2; if (come) { p.cdNext.noBuy = true; if (HARSH) { p.cdNext.drawLess = true; p.cdNext.abilityOff = true; } } }
    if (k === 'champagne') { p.champ = true; if (come) p.saleLess = HARSH ? 50 : 20; }
    if (k === 'whiskey') { p.shield = true; if (come) p.cdNext.abilityOff = true; }
    if (k === 'sugar') { await this.draw(p, true); await this.draw(p, true); if (come) p.cdEnd = true; }
    this.log(`${p.name} gives in to ${c.name}${pref ? ' (their own: no comedown)' : ''}`);
  }
  // --mode bar: THE BAR IS ALWAYS OPEN. No cards: once a turn a player may order one drink, and each drink once a game (--each N: N times).
  async bar(p) { if (ABSTAIN && p.name === 'A') return; if (p.trader && p.trader.key === 'bot') return; /* The Octobot does not drink */ p.had ||= {}; const EACH = +arg('each', 1);
    const r = this.rivals(p)[0]; const want = (k) => k === 'espresso' ? p.invest.some((a) => a.bornTurn !== this.turnNo) : k === 'energy' ? p.hand.length >= 5 : k === 'champagne' ? p.invest.some((a) => a.gamble && a.bornTurn !== this.turnNo) : k === 'whiskey' ? this.netWorth(p) >= this.netWorth(r) && p.invest.length >= 1 : p.hand.length <= 4;
    const NOREP = !!arg('norepeat', null); const k = (arg('order', null) ? ['champagne', 'whiskey', 'espresso', 'energy', 'sugar'] : KINDS).find((x) => (p.had[x] || 0) < EACH && !(NOREP && p.lastDrink === x && p.lastDrinkTurn === this.turnNo - 1) && want(x)); if (!k) { return; } p.had[k] = (p.had[k] || 0) + 1; p.lastDrink = k; p.lastDrinkTurn = this.turnNo; T.drinkTurns = (T.drinkTurns || 0) + 1; const pref = !!(p.trader && PREFERS[p.trader.key] === k), come = !pref && !NOCOME; T.used[k] = (T.used[k] || 0) + 1; if (pref) T.pref++; p._used = true;
    if (k === 'espresso') { p.buzz = 30; if (come) { p.cdNext.drawLess = true; if (HARSH) p.cdNext.noBuy = true; } }
    if (k === 'energy') { p.wired = true; p.extraActions = (p.extraActions || 0) + 2; if (come) { p.cdNext.noBuy = true; if (HARSH) { p.cdNext.drawLess = true; p.cdNext.abilityOff = true; } } }
    if (k === 'champagne') { p.champ = true; if (come) p.saleLess = HARSH ? 50 : 20; }
    if (k === 'whiskey') { p.shield = true; if (come) p.cdNext.abilityOff = true; }
    if (k === 'sugar') { await this.draw(p, true); await this.draw(p, true); if (come) p.cdEnd = true; } }
  refuel(p) { const c = p.hand.find((x) => x.fuel); if (c) { p.hand.splice(p.hand.indexOf(c), 1); p.fuel = (p.fuel || 0) + 1; T.attached++; } if ((p.fuel || 0) >= 3) { p.fuel -= 2; p.extraActions = (p.extraActions || 0) + 1; T.power++; } }
}
const recs = DECKS === 'starters' ? ['devotion', 'degen'] : ['shuffle', 'shuffle'];
const res = { noWin: 0, first: 0, rounds: 0, wins: {}, games: {}, starter: {}, usedN: 0, usedW: 0 };
for (let i = 0; i < GAMES; i++) {
  const players = [0, 1].map((j) => ({ name: 'AB'[j], recipe: recs[j], starter: null, policy: new GreedyBot() })); if (i % 2) players.push(players.shift());
  const g = new G({ players, seed: SEED + i }); g.gid = i; await g.run();
  if (!g.winner) { res.noWin++; continue; } res.rounds += g.turnNo; if (g.winner === g.order[0]) res.first++;
  if (g.winner.name === 'B') res.bWins = (res.bWins || 0) + 1;
  for (const p of g.players) { res.games[p.recipe] = (res.games[p.recipe] || 0) + 1; if (g.winner === p) res.wins[p.recipe] = (res.wins[p.recipe] || 0) + 1; const S = res.starter[p.starter] ||= { g: 0, w: 0 }; S.g++; if (g.winner === p) S.w++; if (p._used) { res.usedN++; if (g.winner === p) res.usedW++; } }
}
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : 'n/a'); const won = GAMES - res.noWin; const op = Object.entries(res.starter).map(([k, v]) => [byKey[k].name, Math.round(v.w / v.g * 100)]).sort((a, b) => b[1] - a[1]);
console.log(`\n== ${DECKS} · ${MODE === 'bar' ? 'THE BAR, always open, each drink ' + arg('each', 1) + ' a game' + (NOCOME ? ', no comedowns' : '') + (HARSH ? ', harsher comedowns' : '') : MODE === 'tempt' ? 'TEMPTATIONS (optional boost' + (NOCOME ? ', no comedowns' : '') + ')' : MODE === 'need' ? 'FUEL THE TRADER NEEDS (' + COPIES + ' a deck)' : 'as built'} · ${GAMES} games`);
console.log(`   rounds ${(res.rounds / won).toFixed(2)} · going first ${pct(res.first, won)} · ` + Object.keys(res.games).map((k) => `${k} ${pct(res.wins[k] || 0, res.games[k])}`).join(' · ') + ` · no winner ${res.noWin}`);
if (ABSTAIN) { let a = 0, b = 0; } 
console.log(`   openers: ${op[0][0]} ${op[0][1]} … ${op[op.length - 1][0]} ${op[op.length - 1][1]}`);
if (MODE === 'bar') console.log('   drinks a game: ' + KINDS.map((k) => `${k} ${((T.used[k] || 0) / GAMES).toFixed(2)}`).join(' · ') + ` · ${(Object.values(T.used).reduce((s, n) => s + n, 0) / GAMES / 2).toFixed(2)} a player · a drink on ${pct(T.drinkTurns || 0, T.turns)} of all turns`);
if (MODE === 'tempt') console.log('   taken, of the players who held one: ' + KINDS.map((k) => `${k} ${pct(T.used[k] || 0, (T.held[k] || new Set()).size)}`).join(' · ') + `\n   ${(Object.values(T.used).reduce((s, n) => s + n, 0) / GAMES).toFixed(2)} taken a game · ${pct(T.pref, Object.values(T.used).reduce((s, n) => s + n, 0))} were the Trader's own · players who took one won ${pct(res.usedW, res.usedN)}`);
if (ABSTAIN) console.log(`   A never gives in, B does: B wins ${pct(res.bWins || 0, won)}${HARSH ? ' (harsher comedowns)' : ''}`);
if (MODE === 'need') console.log(`   turns with no fuel on the Trader (ability off) ${pct(T.dry, T.turns)} · fuel attached ${(T.attached / GAMES / 2).toFixed(1)} a player a game · the extra action bought ${(T.power / GAMES / 2).toFixed(2)} times a player a game`);
