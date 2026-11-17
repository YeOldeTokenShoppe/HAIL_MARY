#!/usr/bin/env node
// RL80 R-cana — Playtest 3: ONE MONEY (PLAYTEST3.md). A sim-only prototype, forked from
// playtest2/pt2-sim.js on 2026-11-16. Playtest 2 is untouched.
//
// Money is money. There is one currency, cash, counted in $M, and your cash is your score.
// An Asset counts for nothing until you sell it. First to $1B.
//
// How the fork does it with the Playtest 2 card set (designs.js is shared and unedited):
//   · every Liquidity number on a card — cost, income, "collect N" — is worth RULES.rate $M
//   · every Prosperity number is already $M: "bank 100" is "collect $100M"
//   · p.cash is the one pool. p.liq and p.pros still exist, as VIEWS of it, so the Playtest 2
//     rules text runs unchanged: p.liq is cash counted in old coins, p.pros is the score (cash;
//     with --assets, cash plus the portfolio at its sale price)
//   · an Asset has one sale price (its old Prosperity value); only a gamble keeps a second,
//     safe price. The winner is decided at the end of a turn, not the instant money lands.
//
//   node pt3-sim.js --games 2000              (two players, the default; --players 3 or 4 for more)
//   node pt3-sim.js --rate 10 --goal 1000 --start 5      (the knobs; see RULES)
//   node pt3-sim.js --verbose --seed 7
export function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── The set's designs live in src/game/rcana/set/designs.js — the one source of truth ──
// pt2-build.js inlines that file here for the browser table; Node imports it directly.
import { DESIGNS } from '../rcana/set/designs.js';
import { TRINITY } from '../rcana/set/trinity.js';
const GOD_CANDLE_BONUS = 100; // flat Prosperity bonus per sale while The God Candle burns
// The game calls every card what the CARD calls itself: a design's printed
// name (the lotería La Máquina over the engine's Enigma Machine) becomes its
// name here, so the table, the gallery and the log all match the print.
for (const d of DESIGNS) if (d.printName) d.name = d.printName;
// Playtest 3's own card values, layered over the shared set so designs.js (and Playtest 2) stay as they are.
export const PT3 = {
  // THE TRINITY, as three printed numbers (2026-11-16): Liquidity (liq, and cost = liq), Credibility (halo:
  // what good standing pays) and Equanimity (eq). The values live in ../rcana/set/trinity.js, which the
  // code-drawn card frame reads too, so the card and the engine cannot drift apart.
  ...Object.fromEntries(Object.entries(TRINITY).map(([k, t]) => [k, { liq: t.liq, cost: t.liq, halo: t.cred, eq: t.eq }])),
};
// No halo and no composure: the devil lives on his wager, which is a plain money bet now — heads collect 3.
Object.assign(PT3.diablito, { wager: 3, wagerLoss: 0, text: 'At the start of your turn, flip a coin: heads, collect 3 Liquidity' });
export const byKey = Object.fromEntries(DESIGNS.map((d) => [d.key, { ...d, ...(PT3[d.key] || {}) }]));
// CREDIBILITY IS A STATE, NOT A COUNT (2026-11-16). A Trader is IN GOOD STANDING or IN SCANDAL.
//   · in good standing they earn +1 income (the old full-Credibility bonus)
//   · a strike (any Calamity landing on you, Fall From Grace) puts them in scandal
//   · a second strike while in scandal DISCREDITS them — unless a Saving Face card or the Shroud is spent
//   · a candle, the Press Release, the Tattoo or the Confession puts them back in good standing; while a
//     Scandal card still sits on you, only the Press Release (which clears it) and the Confession can
// The engine keeps the state in the old fields: cred is 2 for every Trader, credNow 2 = good standing,
// 1 = in scandal, 0 = discredited. Nothing is counted at the table.
for (const d of Object.values(byKey)) if (d.type === 'trader') d.cred = 2;
const standing = (t) => (t.credNow == null || t.credNow >= t.cred ? 'in good standing' : 'in scandal');
// Two 40-card starter recipes: Devotion (deeds, remedies, slow money) and Degen
// (hazards, gambles, the Unicorn's compounding). Deck identity is the collectible premise.
export const RECIPES = {
  devotion: [['monje', 2], ['gato', 1], ['celebridad', 1], ['general', 1],
    ['tech', 1], ['vaca', 1], ['cava', 1], ['plata', 1], ['nacimiento', 1], ['moon', 1], ['catedral', 1], ['bluechip', 1], ['semilla', 1], ['investigadora', 1],
    ['bull', 2], ['squeeze', 2],
    ['bear', 1], ['rug', 1],
    ['bell', 1], ['tortilla', 2], ['publicista', 1], ['horchata', 1], ['burro', 1], ['ofrenda', 1],
    ['heart', 1], ['halo', 1], ['rosary', 1], ['grail', 1], ['dashboard', 1], ['tattoo', 1], ['geometry', 1],
    ['cherub', 1], ['fountain', 1], ['limpia', 1], ['anima', 1], ['lagrimas', 1]],
  degen: [['diablito', 2], ['unicornio', 2], ['prospector', 1], ['abuela', 1], ['bot', 1],
    ['meme', 1], ['tech', 2], ['gallo', 1], ['aguacate', 1], ['perp', 1], ['bluechip', 1], ['jardin', 1], ['ponzi', 1], ['catacumbas', 1],
    ['unlock', 1],
    ['ballena', 1], ['rueda', 1], ['moralhazard', 1], ['mardigras', 1], ['godcandle', 1], ['techwreck', 1],
    ['fuego', 1],
    ['illuminati', 1],
    ['bear', 1], ['rug', 1], ['escandalo', 1], ['fall', 1], ['infierno', 1], ['trap', 1],
    ['tortilla', 1],
    ['heart', 1], ['skull', 1], ['enigma', 1], ['rideordie', 1], ['lottery', 1], ['motherboard', 1],
    ['ofrenda', 1]],
};
export const STARTER = RECIPES.devotion;
export const HAIL_DIE_SIDES = 8;
// The knobs of the one-money economy.
//   rate   $M per old Liquidity coin (costs, income, every "collect N")
//   goal   net worth that wins, in $M (1000 = $1B)
//   start  opening cash, in old coins (× rate)
//   crash  the share of their cash a Flash Crash takes from anyone holding 8+ coins' worth (was half)
//   rugFreezes  true: a Rug Pull also takes the victim's portfolio out of their net worth until cleared
//   countAssets false (the rule since 2026-11-16): CASH ONLY — an unsold Asset counts for nothing, you sell to score.
//               true (--assets) is the first draft, where the portfolio counted at its sale price
//   calamityStrikes true (the rule since 2026-11-16): any Calamity that lands on you is a strike (--nostrikes: only Scandal and the Fall)
//   die 8 (the rule since 2026-11-16): ONE DIE, a d8, for every roll in the game. 6 (--d6) is Playtest 2's mix:
//               a d6 for everything but the Hail Mary. On the d8 each target moves up one to keep its odds close:
//               gambles 5+ -> 6+ and 3+ -> 4+, El Gato 4+ -> 5+; El Gallo and the Lottery Ticket pay on an 8
//   earnedHalo  true (the rule since 2026-11-16; --nohalo turns it off): a Trader can EARN a halo by helping the
//               rival — offering them a card, which they may refuse (a refused offer still uses the turn),
//               or clearing a Calamity off their table. One halo at most: +1 income while in good standing,
//               knocked off by a strike. candleHalo (--candlehalo) adds your first candle as a third way.
//               giftBlind (--blind): the rival draws the card at random from your hand and cannot refuse it
//   scandalFuse  trial, off: a Scandal left on you for a full round is a second strike (--fuse)
//   finishRound true (the rule): the round is played out before the win is read, so everyone has had the same
//               number of turns. false (--sudden) ends the game on the turn someone gets there: going first then wins 56%
export const RULES = { rate: 10, goal: 1000, start: 5, crash: 0.25, rugFreezes: false, countAssets: false, finishRound: true, calamityStrikes: true, scandalFuse: false, die: 8, earnedHalo: true, candleHalo: false, giftsAlwaysTaken: false, giftKeen: 1, giftBlind: false };
export const ODDS = [1, 2, 3, 4, 5]; // winning faces, by recorded deeds (cap 3); the fifth rung is only reached by The Fountain
// The starting Trader (2026-11-16): before the deal, every player chooses one Trader from their deck
// and seats them, free. Only a junior may open at the desk — cost STARTER_MAX_COST or less; the
// stars are played from the hand at their price. Set it to null to let any Trader open.
export const STARTER_MAX_COST = 2;
export function starterChoices(recipe) {
  const traders = [...new Set((RECIPES[recipe] || []).map(([k]) => k))].map((k) => byKey[k]).filter((d) => d && d.type === 'trader');
  const juniors = STARTER_MAX_COST == null ? traders : traders.filter((d) => d.cost <= STARTER_MAX_COST);
  if (juniors.length) return juniors;
  const cheapest = Math.min(...traders.map((d) => d.cost)); // a deck with no junior opens with its cheapest Trader
  return traders.filter((d) => d.cost === cheapest);
}

export class Game {
  constructor({ players, seed = 1, verbose = false, rules = {}, maxTurns = 300 }) {
    this.rng = makeRng(seed); this.verbose = verbose; this.lines = []; this.rules = { ...RULES, ...rules }; this.winAt = this.rules.goal; this.maxTurns = maxTurns;
    this.fx = {}; this.dealing = true;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, trader: null, recipe: cfg.recipe || 'devotion',
      deck: this.shuffle(RECIPES[cfg.recipe || 'devotion'].flatMap(([k, n]) => Array.from({ length: n }, () => ({ ...byKey[k] })))),
      hand: [], discard: [], invest: [], seeds: [], artifacts: [], location: null, hazards: [], deeds: 0, hailUsed: false,
      stats: { plays: 0, hires: 0, disgraces: 0, sells: 0, sellCash: 0, sellPros: 0, hazPlayed: 0, hazCleared: 0, remedyRival: 0, candles: 0, hail: 0, hailWon: 0, passes: 0, discards: 0, turns: 0, hazTurns: 0 } }));
    for (const p of this.players) this.oneMoney(p);
    // draw() is async, but while dealing no Event fires, so each call mutates
    // before its first await and the hands are full when the constructor returns.
    this.turnNo = 0; this.over = false; this.winner = null;
    // The starting Trader: the player's choice (cfg.starter) or, for a bot, one of its deck's
    // juniors at random. They leave the deck for the desk before the deal, free, so the game is
    // played from 39 cards and nobody begins with an empty seat. (This replaces the morning's
    // opening rule, the redeal of a hand with no Trader: with the seat filled it has nothing to do.)
    players.forEach((cfg, i) => {
      const p = this.players[i]; const choices = starterChoices(p.recipe); if (!choices.length) return;
      const key = choices.some((d) => d.key === cfg.starter) ? cfg.starter : choices[Math.floor(this.rng() * choices.length)].key;
      const t = p.deck.find((c) => c.key === key); p.deck.splice(p.deck.indexOf(t), 1);
      t.credNow = t.cred; p.trader = t; p.starter = t.key;
      this.log(`${p.name} opens with ${t.name} at the desk (LIQ ${t.liq} · in good standing · EQ ${t.eq || 0})`);
    });
    for (const p of this.players) for (let i = 0; i < 5; i++) this.draw(p, true);
    this.dealing = false;
  }
  // ONE MONEY. p.cash ($M) is all the money a player has. p.liq reads it in old coins and p.pros
  // reads NET WORTH, so "spend 3", "collect 1" and "bank 100" all move the same pool.
  oneMoney(p) {
    const g = this; p.cash = this.rules.start * this.rules.rate;
    Object.defineProperty(p, 'liq', { get() { return this.cash / g.rules.rate; }, set(v) { this.cash = Math.round(v * g.rules.rate); } });
    Object.defineProperty(p, 'pros', { get() { return g.netWorth(this); }, set(v) { this.cash += Math.round(v - g.netWorth(this)); } });
  }
  // What an Asset is worth on paper: its sale price today. A gamble counts at its safe price.
  paperValue(a) { return a.gamble ? a.cash * this.rules.rate : this.prosOf(a); }
  portfolioValue(p) { return !this.rules.countAssets || (this.rules.rugFreezes && this.hasHaz(p, 'rug')) ? 0 : p.invest.reduce((s, a) => s + this.paperValue(a), 0); }
  netWorth(p) { return p.cash + this.portfolioValue(p); }
  // The win is read when the round is complete (RULES.finishRound): anyone at the goal, the richest of
  // them takes it (the player whose turn it was breaks a tie).
  checkWin(active) {
    if (this.over) return;
    const there = this.players.filter((q) => this.netWorth(q) >= this.winAt).sort((x, y) => this.netWorth(y) - this.netWorth(x) || (x === active ? -1 : y === active ? 1 : 0));
    if (there.length) { this.over = true; this.winner = there[0]; this.log(`*** ${this.winner.name} WINS with a net worth of $${this.netWorth(this.winner)}M ***`); }
  }
  async turn(p) { await this.takeTurn(p); if (!this.rules.finishRound || p === this.players[this.players.length - 1]) this.checkWin(p); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  log(t) { if (this.verbose) this.lines.push(`[T${this.turnNo}] ${t}`); }
  rivals(p) { return this.players.filter((q) => q !== p); }
  abilityOn(p) { return !(p.hazards.some((h) => h.key === 'hack') && !p.artifacts.some((a) => a.key === 'halo')); }
  is(p, key) { return !!p.trader && p.trader.key === key && this.abilityOn(p); }
  hasHaz(p, key) { return p.hazards.some((h) => h.key === key); }
  // Async: an on-draw Event can ask a player a question (SAVING FACE on a Fall).
  async draw(p, silent = false) {
    if (!p.deck.length && p.discard.length) { p.deck = this.shuffle(p.discard.splice(0)); this.log(`${p.name} reshuffles`); }
    const c = p.deck.shift(); if (!c) return null;
    if (c.type === 'event' && !c.played) {
      if (this.dealing) { p.deck.push(c); return await this.draw(p, silent); } // no weather before the game starts
      p.discard.push(c);
      const machine = p.artifacts.find((a) => a.key === 'enigma'); // Intercept: the Machine can cancel weather on its owner's draw
      if (machine && await p.policy.useEnigma(this, p, c)) { p.artifacts.splice(p.artifacts.indexOf(machine), 1); p.discard.push(machine); this.log(`✦ ${c.name} is drawn by ${p.name} — the ENIGMA MACHINE intercepts it: the message never goes out`); return await this.draw(p, silent); }
      await this.event(p, c); return await this.draw(p, silent); // the market speaks, then you draw a replacement
    }
    if (c.type === 'trader') { delete c.credNow; delete c.earned; }
    p.hand.push(c);
    if (!silent) this.hooks?.onDraw?.(p, c);
    if (!silent) this.log(`${p.name} draws${p.policy && p.policy.human ? ' ' + c.name : ''}`);
    return c;
  }
  async event(p, c) {
    this.log(`✦ EVENT — ${c.name} (drawn by ${p.name}): ${c.text}`);
    for (const q of this.players) for (const a of [...q.invest]) if (a.key === 'jardin') { q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.log(`${q.name}'s YIELD FARM is wiped by the weather`); }
    if (c.key === 'godcandle') this.fx[c.key] = { owner: p.idx };
    if (c.key === 'fall') for (const q of this.players) if (q.trader) await this.credDamage(q, 1, 'the FALL FROM GRACE');
    if (c.key === 'feast') { this.log('THE FEAST OF PERPETUAL PROFIT — every player lights a candle'); for (const q of this.players) await this.lightCandle(q, 'the Feast'); }
    if (c.key === 'holyroller') { for (const q of this.players) { this.collect(q, 1); await this.draw(q, true); } this.log('THE HOLY ROLLER rolls through — every player draws a card and collects 1'); }
    if (c.key === 'fuego') { this.log('NUESTRA SEÑORA DEL FUEGO rides through the market'); for (const q of this.players) { this.bank(q, 75, 'Nuestra Señora del Fuego'); if (this.over) break; } }
    if (c.key === 'virtual') { for (const q of this.players) { const n = q.hand.length; q.deck.push(...q.hand.splice(0)); q.deck = this.shuffle(q.deck); for (let i = 0; i < n; i++) await this.draw(q, true); this.log(`THE VIRTUAL MARY flickers — ${q.name} shuffles ${n} back and draws ${n}`); } }
    if (c.key === 'techwreck') { let hit = 0; for (const q of this.players) for (const a of [...q.invest]) if (a.tech) { q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.collect(q, 1); hit++; this.log(`${q.name}'s ${a.name.toUpperCase()} is wrecked — scrapped for 1`); } for (const q of this.players) if (q.location && q.location.tech) { this.log(`${q.name}'s ${q.location.name.toUpperCase()} burns down`); q.discard.push(q.location); q.location = null; hit++; }
      if (!hit) this.log('TECH WRECK — no tech on the table; the bubble bursts over nobody'); }
    if (c.key === 'crash') for (const q of this.players) {
      if (q.invest.some((a) => a.silver)) { this.log(`${q.name} holds LA PLATA — flight to safety`); this.bank(q, 25, 'La Plata'); continue; }
      if (q.liq >= 8) { const lost = Math.floor(q.liq * this.rules.crash); q.liq -= lost; this.log(`${q.name} loses ${lost} Liquidity in the crash`); } }
    if (c.key === 'ballena') {
      const worth = (q) => q.invest.reduce((s2, a2) => s2 + this.prosOf(a2), 0);
      const sorted = [...this.players].sort((a2, b2) => worth(b2) - worth(a2));
      for (const q of sorted) { if (this.rideOrDie(q) && q.invest.length) this.log(`RIDE OR DIE: THE WHALE passes ${q.name}'s portfolio by`); }
      const givers = sorted.filter((q) => !this.rideOrDie(q));
      const rich = givers[0], poor = sorted[sorted.length - 1];
      if (rich && rich !== poor && rich.invest.length && worth(rich) > worth(poor)) {
        const best = [...rich.invest].sort((a2, b2) => this.prosOf(b2) - this.prosOf(a2))[0];
        rich.invest.splice(rich.invest.indexOf(best), 1); poor.invest.push(best);
        this.log(`THE WHALE moves ${best.name} from ${rich.name} to ${poor.name}`);
      }
    }
    if (c.key === 'moralhazard') {
      const byLiq = [...this.players].sort((a2, b2) => a2.liq - b2.liq);
      const poor = byLiq[0], rich = byLiq[byLiq.length - 1];
      if (poor !== rich && rich.liq > poor.liq) { this.collect(poor, 5); rich.liq = Math.max(0, rich.liq - 2); this.log(`TOO BIG TO FAIL: ${poor.name} is bailed out (+5); ${rich.name} pays for prudence (-2)`); }
    }
    if (c.key === 'rueda') {
      const seats = this.players.filter((q) => !this.rideOrDie(q)); const held = this.players.filter((q) => this.rideOrDie(q));
      const n = seats.length; const invs = seats.map((q) => q.invest);
      for (let i = 0; i < n; i++) seats[i].invest = invs[(i + n - 1) % n];
      this.log(n > 1 ? 'THE WHEEL turns — every portfolio rotates one seat' : 'THE WHEEL turns — but nobody\'s portfolio moves');
      for (const q of held) this.log(`RIDE OR DIE: THE WHEEL passes ${q.name}'s portfolio by`);
    }
    if (c.key === 'moneda') { for (const q of this.players) { this.collect(q, 2); } this.log('THE AIRDROP — every player collects 2'); }
    const eventResult = {};
    if (c.key === 'mardigras') {
      eventResult.rolls = this.players.map(player => {
        const roll = this.roll();
        const collected = this.collect(player, roll);
        return { player, roll, collected };
      });
      this.log('MARDI GRAS — ' + eventResult.rolls.map(({player, roll, collected}) =>
        `${player.name} rolled ${roll}: ${collected ? '+' + collected + ' Liquidity' : roll + ' to Liquidity Trap'}`).join(' · '));
    }
    if (c.key === 'illuminati') {
      const transfers = eventResult.transfers = [];
      for (const from of this.rivals(p)) {
        if (!from.hand.length) {
          transfers.push({ from, card: null });
          continue;
        }
        const [card] = from.hand.splice(Math.floor(this.rng() * from.hand.length), 1);
        p.hand.push(card);
        transfers.push({ from, card });
        const visible = from.policy.human || p.policy.human;
        this.log(`THE ILLUMIN80 — ${from.name} passed ${visible ? card.name : 'a card'} to ${p.name}`);
      }
    }
    if (this.hooks?.onEvent) await this.hooks.onEvent(p, c, eventResult);
  }
  celebrityBankBonus(p, n, bearProof = false) {
    return this.is(p, 'celebridad') && p.liq >= 1 && (bearProof || !this.hasHaz(p, 'bear')) && !(this.hasHaz(p, 'bear') && n + 25 > 75) ? 25 : 0;
  }
  bank(p, n, src, allowBonus = true, bearProof = false) {
    if (this.hasHaz(p, 'bear') && src !== 'hail' && !bearProof) { if (n > 75) return false; // larger payouts cannot be chosen
      p.pros += n; } else {
      if (allowBonus && src !== 'hail' && this.celebrityBankBonus(p, n, bearProof)) { p.liq -= 1; n += 25; }
      p.pros += n;
    }
    this.log(`${p.name} collects $${n}M (${src}) → net worth $${p.pros}M`);
    return true;
  }
  async lightCandle(p, why) {
    if (this.is(p, 'bot')) { this.log(`THE BOT cannot pray — the candle (${why}) goes unlit`); return false; }
    if (p.deeds >= 3) return false;
    p.deeds += 1; p.stats.candles++;
    if (this.rules.candleHalo && p.deeds === 1) this.earnHalo(p, 'candle');
    if (this.is(p, 'monje')) this.bank(p, p.trader.vow ?? 25, 'El Monje');
    this.restoreStanding(p, 'the candlelight');
    if (p.artifacts.some((a) => a.key === 'rosary')) await this.draw(p);
    this.log(`🕯 ${p.name} lights a candle (${why}) → ${p.deeds} of 3`);
    for (const q of this.players) if (q.location && q.location.key === 'catedral') { this.log(`a green candle in LA CATEDRAL — ${q.name} banks 25`); this.bank(q, 25, 'La Catedral'); }
    return true;
  }
  // A gift cuts both ways: the taker gets a card, the giver gets a halo. These two estimates let a bot weigh one
  // against the other — as taker (is the card worth more to me than the halo is to them?) and as giver.
  roundsLeft() { const top = Math.max(...this.players.map((q) => this.netWorth(q))); return Math.max(1, Math.min(6, Math.ceil((this.winAt - top) / 90))); }
  haloWorth(p) { const good = p.trader && (p.trader.credNow == null || p.trader.credNow >= p.trader.cred); return good && !p.trader.earned ? this.rules.rate * Math.max(0, this.roundsLeft() - 1) * 0.75 : 0; }
  giftValue(to, c) {
    const R = this.rules.rate, price = this.costOf(to, c) * R;
    if (c.type === 'event') return this.hasHaz(to, 'scam') ? 0 : Math.max(0, this.eventPayout(to, c) * (c.bloom ? 0.6 : 1) - price);
    if (c.type === 'asset') return Math.max(0, (c.perp ? c.pros * 2 : c.pros) - price) + (c.income || 0) * R * 3;
    if (c.type === 'trader') return to.trader && c.liq + (c.halo ?? 1) <= to.trader.liq + (to.trader.halo ?? 1) ? 0 : 30;
    if (c.type === 'remedy') return to.hazards.some((h) => c.clears === 'any' || h.key === c.clears) ? 45 : c.refresh ? 15 : 8;
    if (c.type === 'grace') return to.deeds >= 3 || to.hailUsed || this.is(to, 'bot') ? 0 : 20;
    if (c.type === 'location') return to.location ? 0 : 20;
    return this.relicsHeld(to).length >= this.relicSlots(to) ? 5 : 18; // a Relic
  }
  // THE EARNED HALO: a good deed puts a halo marker on your seated Trader. One at most.
  earnHalo(p, why) {
    if (!this.rules.earnedHalo || !p.trader || p.trader.earned) return false;
    p.trader.earned = true; p.stats.halos = (p.stats.halos || 0) + 1; p.stats['halo_' + why] = (p.stats['halo_' + why] || 0) + 1;
    this.log(`◯ ${p.trader.name} earns a HALO (${why}) — +1 while in good standing`); return true;
  }
  // Back in good standing. A Scandal card still on the table blocks it, unless the cure says otherwise.
  restoreStanding(p, why, evenUnderScandal = false) {
    const t = p.trader; if (!t || t.credNow == null || t.credNow >= t.cred) return false;
    if (!evenUnderScandal && this.hasHaz(p, 'escandalo')) return false;
    t.credNow = t.cred; p.stats.restored = (p.stats.restored || 0) + 1; this.log(`${why}: ${t.name} is back in good standing`); return true;
  }
  // Credibility damage. At zero the Trader is discredited — unless the Shroud is on the
  // table, or a card with SAVING FACE is spent from the hand (the policy picks).
  async credDamage(p, n, why) {
    if (!p.trader) return;
    if (/scandal/i.test(why) && this.is(p, 'bot')) { this.log(`THE BOT has no soul — the Scandal finds nothing to grip`); return; }
    p.trader.credNow = (p.trader.credNow == null ? p.trader.cred : p.trader.credNow) - 1; p.stats.strikes = (p.stats.strikes || 0) + 1;
    if (p.trader.earned) { p.trader.earned = false; p.stats.halosLost = (p.stats.halosLost || 0) + 1; this.log(`${p.trader.name}'s earned halo is knocked off`); }
    if (p.trader.credNow > 0) this.log(`${p.trader.name} is IN SCANDAL (${why})`);
    if (p.trader.credNow <= 0) {
      const shroud = p.artifacts.find((a) => a.key === 'shroud');
      if (shroud) { p.artifacts.splice(p.artifacts.indexOf(shroud), 1); p.discard.push(shroud); p.trader.credNow = 1; this.log(`✝ THE SHROUD is spent — ${p.trader.name} stays at ${p.name}'s desk, still in scandal`); }
      else {
        const saviours = p.hand.filter((c) => c.savingGrace);
        const pick = saviours.length ? await p.policy.useSavingGrace(this, p, saviours) : null;
        if (pick && saviours.includes(pick)) { p.hand.splice(p.hand.indexOf(pick), 1); p.discard.push(pick); p.trader.credNow = 1; p.stats.savingGrace = (p.stats.savingGrace || 0) + 1; this.log(`✝ SAVING FACE — ${p.name} gives up ${pick.name}: ${p.trader.name} stays at the desk, still in scandal`); }
        else { this.log(`☠ ${p.trader.name} is DISCREDITED and leaves ${p.name}'s desk`); p.discard.push(p.trader); p.trader = null; p.stats.disgraces++; }
      }
    }
  }
  // The God Candle: a flat bonus on every Prosperity sale while it burns (was ×2 — a 500 swing in a race to 1,000).
  saleBonus() { return this.fx.godcandle ? GOD_CANDLE_BONUS : 0; }
  saleValue(a) { return this.prosOf(a) + this.saleBonus(); }
  eventPayout(p, c) { return c.pros + (c.perHaz ? c.perHaz * p.hazards.length : 0) + (c.perRivalAsset ? c.perRivalAsset * this.rivals(p).reduce((s, q) => s + q.invest.length, 0) : 0) + (p.artifacts.some((a) => a.key === 'geometry') ? 25 : 0); }
  rideOrDie(q) { return q.invest.some((x) => x.key === 'rideordie'); }
  // Relic slots: two, three with the Motherboard — which sits outside the count.
  relicSlots(p) { return 2 + (p.artifacts.some((a) => a.slots) ? 1 : 0); }
  relicsHeld(p) { return p.artifacts.filter((a) => !a.slots); }
  prosOf(a) {
    if (a.gem) { const o = this.players.find((q) => q.invest.includes(a)); return o && o.deeds >= 3 ? a.gem : a.pros; }
    if (a.ripe) { const held = this.turnNo - a.bornTurn; return held < 2 ? 50 : Math.max(0, 150 - 50 * (held - 2)); }
    if (a.perp) return a.pros * 2;
    if (a.bloom && this.turnNo - a.bornTurn >= 4) return a.bloom; if (a.grow) return a.pros + a.grow * Math.max(0, Math.floor((this.turnNo - a.bornTurn) / this.players.length)); return a.pros; }
  clearHazard(victim, h, by, why) {
    this.releaseTrap(victim, h);
    victim.hazards.splice(victim.hazards.indexOf(h), 1); h.owner.discard.push(h); victim.stats.hazCleared++;
    this.log(`${why}: ${h.name} off ${victim.name}`);
  }
  // La Investigadora's open book: the card her player can see, and the once-a-turn burial.
  topCard(p) { return this.is(p, 'investigadora') ? p.deck[0] || null : null; }
  canBury(p) { return this.is(p, 'investigadora') && this.active === p && !p.buriedThisTurn && p.deck.length > 1; }
  bury(p) {
    if (!this.canBury(p)) return false;
    const top = p.deck.shift(); p.deck.push(top); p.buriedThisTurn = true; p.stats.buries = (p.stats.buries || 0) + 1;
    this.log(`DUE DILIGENCE — ${p.name} reads the tape and sends ${top.name} to the bottom`); return true;
  }
  // One die for the whole game (RULES.die). The targets printed for a d6 move up one on the d8.
  roll() { return 1 + Math.floor(this.rng() * this.rules.die); }
  d8() { return this.rules.die === 8 ? 1 : 0; }
  gambleNeed(p, a) { return (a.gambleOn || 5) + this.d8() - (this.is(p, 'abuela') ? 1 : 0); }
  gambleOdds(p, a) { return (this.rules.die + 1 - this.gambleNeed(p, a)) / this.rules.die; }
  spend(p, n) { if (p.liq < n) return false; p.liq -= n; return true; }
  // Income, not refunds: under a LIQUIDITY TRAP the coins pile on the card instead.
  collect(p, n) {
    if (!(n > 0)) return 0;
    const trap = p.hazards.find((h) => h.key === 'trap');
    if (trap) { trap.pile = (trap.pile || 0) + n; this.log(`${p.name}'s ${n} Liquidity falls into the LIQUIDITY TRAP (${trap.pile} trapped)`); return 0; }
    p.liq += n; return n;
  }
  releaseTrap(victim, h) { if (h.key === 'trap' && h.pile) { victim.liq += h.pile; this.log(`the trap springs open: ${victim.name} recovers ${h.pile} Liquidity`); h.pile = 0; } }
  costOf(p, c) { let n = c.cost; if (c.type === 'asset' && this.is(p, 'prospector')) n = Math.max(0, n - 1); return n; }
  odds(p) { const lit = this.hasHaz(p, 'virtue') ? 0 : Math.min(3, p.deeds); return ODDS[Math.min(ODDS.length - 1, lit + (p.fountain || 0))]; }

  // ── the main actions ──
  async playCard(p, c, choice = {}) {
    const cost = this.costOf(p, c); if (!this.spend(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); p.stats.plays++;
    switch (c.type) {
      case 'asset': c.bornTurn = this.turnNo; p.invest.push(c); this.log(`${p.name} invests in ${c.name}`);
        break;
      case 'event': { // a played Event (Bull Run, Full Moon, The Inheritance); fired ones never reach a hand
        if (c.bloom) { c.bornTurn = this.turnNo; p.seeds.push(c); this.log(`${p.name} plants ${c.name} — it blooms in ${c.bloom} rounds`); break; }
        if (c.choice && choice.cash) { this.collect(p, c.cash); p.discard.push(c); this.log(`${p.name} cashes ${c.name} for ${c.cash}`); }
        else { const n = this.eventPayout(p, c); const ok = this.bank(p, n, c.name + (c.perHaz && p.hazards.length ? ` · ${p.hazards.length} Calamit${p.hazards.length === 1 ? 'y' : 'ies'} squeezed` : '') + (p.artifacts.some((a) => a.key === 'geometry') ? ' · SACRED GEOMETRY +25' : ''), true, !!c.bearProof); if (!ok) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; } /* banked cards leave the deck */
          if (c.rivalsCollect) { for (const q of this.rivals(p)) this.collect(q, c.rivalsCollect); this.log(`${c.name.toUpperCase()}: every rival collects ${c.rivalsCollect}`); } }
        break; }
      case 'hazard': {
        const t = choice.target; if (!t || this.hasHaz(t, c.key)) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        // reaction: Sacred Heart
        const heart = t.artifacts.find((a) => a.key === 'heart');
        if (heart && await t.policy.useHeart(this, t, c, p)) { t.artifacts.splice(t.artifacts.indexOf(heart), 1); t.discard.push(heart); p.discard.push(c); this.log(`${t.name} spent ${heart.name} to block ${c.name}. ${c.name} went to ${p.policy.human ? 'your' : p.name + "’s"} discard pile.`); return true; }
        // EQUANIMITY: a seated Trader's composure. The Calamity fails on a roll of eq or lower — a stat, so a Quantum Hack does not switch it off.
        const eq = t.trader ? (t.trader.eq || 0) : 0;
        if (eq > 0) { const roll = this.roll();
          if (roll <= eq) { p.discard.push(c); this.log(`${t.name} blocked ${c.name}. ${t.trader.name} rolled ${roll} on a d${this.rules.die}. Equanimity ${eq} blocks on ${eq} or lower. ${c.name} went to ${p.policy.human ? 'your' : p.name + "’s"} discard pile.`); t.stats.eqSaves = (t.stats.eqSaves || 0) + 1;
            if (this.is(t, 'general')) { this.collect(t, 1); this.log(`FAULT TOLERANCE — ${t.name} collects 1`); } return true; }
          this.log(`the die shows ${roll} against EQUANIMITY ${eq} — ${c.name} lands`); }
        c.owner = p; c.by = p.idx; t.hazards.push(c); p.stats.hazPlayed++;
        this.log(`${p.name} plays ${c.name} on ${t.name}`);
        if (c.key === 'bear') for (const a of [...t.invest]) if (a.perp) { t.invest.splice(t.invest.indexOf(a), 1); t.discard.push(a); this.log(`${t.name}'s ${a.name} is LIQUIDATED by the Bear`); }
        if (c.key === 'escandalo') await this.credDamage(t, 1, 'the SCANDAL breaks');
        else if (this.rules.calamityStrikes) await this.credDamage(t, 1, c.name); // any Calamity that lands is a strike
        break; }
      case 'remedy': {
        if (choice.refresh) { // Horchata: discard up to c.refresh, draw that many plus one
          const picked = (choice.discards || []).filter((x) => x !== c && p.hand.includes(x)).slice(0, c.refresh);
          for (const x of picked) { p.hand.splice(p.hand.indexOf(x), 1); p.discard.push(x); }
          p.discard.push(c); const drawn = []; for (let i = 0; i <= picked.length; i++) { const d = await this.draw(p, true); if (d) drawn.push(d); }
          this.log(`${p.name} drinks ${c.name.toUpperCase()} — lets go of ${picked.length} and draws ${drawn.length}`); break; }
        if (choice.polish) { this.restoreStanding(p, 'THE PRESS RELEASE'); p.discard.push(c); break; }
        const t = choice.target || p; const h = choice.hazard || t.hazards.find((x) => c.clears === 'any' || x.key === c.clears);
        if (!h) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        const back = c.bounce && h.owner !== t && !this.hasHaz(h.owner, h.key) ? h.owner : null;
        if (back) { this.releaseTrap(t, h); t.hazards.splice(t.hazards.indexOf(h), 1); t.stats.hazCleared++; back.hazards.push(h); this.log(`${p.name} plays ${c.name}: ${h.name} off ${t.name} — kicked back onto ${back.name}`); }
        else this.clearHazard(t, h, p, `${p.name} plays ${c.name}`);
        if (c.key === 'publicista' && h.key === 'escandalo') this.restoreStanding(t, 'THE PRESS RELEASE');
        p.discard.push(c);
        if (t !== p) { p.stats.remedyRival++; this.earnHalo(p, 'remedy'); }
        break; }
      case 'location': {
        if (p.location) { p.discard.push(p.location); this.log(`${p.name} tears down ${p.location.name}`); }
        c.figures = 0; p.location = c; this.log(`${p.name} builds ${c.name}`); break; }
      case 'artifact': {
        if (!c.slots && this.relicsHeld(p).length >= this.relicSlots(p)) { const drop = choice.drop || this.relicsHeld(p)[0]; p.artifacts.splice(p.artifacts.indexOf(drop), 1); p.discard.push(drop); this.log(`${p.name} unequips ${drop.name}`); }
        p.artifacts.push(c); this.log(`${p.name} equips ${c.name}`); break; }
      case 'trader': {
        if (p.trader) {
          this.log(`${p.name} discards ${p.trader.name} to seat ${c.name}`);
          p.discard.push(p.trader);
        }
        c.credNow ??= c.cred;
        p.trader = c;
        p.stats.hires++;
        this.log(`${p.name} seats ${c.name} at the desk (LIQ ${c.liq} · ${standing(c)} · EQ ${c.eq || 0})`);
        if (c.key === 'gato' && p.hazards.length && this.abilityOn(p)) {
          this.clearHazard(p, choice.hazard || p.hazards[0], p, 'EL GATO knocks it off the table');
        }
        break; }
      case 'grace': {
        if (c.key === 'rose') {
          const t = choice.target; if (!t) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
          this.log(`${p.name} offers THE ROSE to ${t.name}`);
          if (await t.policy.acceptRose(this, t, p)) { c.bornTurn = this.turnNo; t.invest.push(c); this.log(`${t.name} accepts the Rose`); await this.lightCandle(p, 'the Rose, accepted'); }
          else { p.hand.push(c); this.log(`${t.name} declines the Rose`); }
          break; }
        if (c.key === 'fountain') { p.fountain = (p.fountain || 0) + 1; this.log(`${p.name} tosses a coin in THE FOUNTAIN — Hail Mary odds rise to ${this.odds(p)}/${HAIL_DIE_SIDES}`); break; }
        // the card itself is the offering: it leaves the game for the shrine
        this.log(`${p.name} places ${c.name} at Our Lady’s shrine`);
        await this.lightCandle(p, c.name);
        if (c.key === 'cherub') await this.draw(p);
        if (c.key === 'limpia' && p.hazards.length) this.clearHazard(p, choice.hazard || p.hazards[0], p, 'LA LIMPIA sweeps it away');
        if (c.key === 'anima') { const back = [...p.discard].reverse().find((x) => x.type === 'trader'); if (back) { p.discard.splice(p.discard.indexOf(back), 1); back.credNow = 1; if (p.trader) p.hand.push(back); else p.trader = back; this.log(`ÁNIMA SOLA — ${back.name} returns from purgatory to ${p.name}'s ${p.trader === back ? 'desk' : 'hand'}, in scandal`); } else this.log('ÁNIMA SOLA — nobody to bring back'); }
        if (c.key === 'confession') this.restoreStanding(p, 'THE CONFESSION absolves', true);
        break; }
    }
    return true;
  }
  async sell(p, a, wantPros) {
    if (this.hasHaz(p, 'rug')) return false; if (a.bornTurn === this.turnNo) return false;
    const base = this.prosOf(a);
    p.invest.splice(p.invest.indexOf(a), 1); p.stats.sells++;
    for (const q of this.players) if (q !== p && q.artifacts.some((x) => x.key === 'skull')) { this.collect(q, 1); this.log(`${q.name} holds THE SKULL: +1 from ${p.name}'s sale`); }
    if (wantPros && a.gamble) {
      let roll = this.roll(); p.stats.sellPros++;
      const need = this.gambleNeed(p, a);
      if (roll < need && await this.dashboard(p, { kind: 'gamble', name: a.name, roll })) roll = this.roll();
      if (roll >= need) { const ok = this.bank(p, a.pros + this.saleBonus(), `${a.name} — the die shows ${roll}: IT ${a.gambleOn ? 'GUSHES' : 'MOONS'}${this.saleBonus() ? ` · GOD CANDLE +${this.saleBonus()}` : ''}`); if (!ok) { p.invest.push(a); p.stats.sells--; p.stats.sellPros--; return false; } }
      else if (a.bust) { p.discard.push(a); this.bank(p, a.bust, `${a.name} — the die shows ${roll}: it runs dry`); }
      else { p.discard.push(a); this.log(`${p.name} sells ${a.name}… the die shows ${roll}: it goes to zero`); }
      await this.mapDraw(p);
      return true;
    }
    if (wantPros) { const bonus = this.saleBonus(); const ok = this.bank(p, base + bonus, a.name + (a.bloom && base === a.bloom ? ' IN BLOOM' : '') + (bonus ? ` · GOD CANDLE +${bonus}` : ''), true, !!a.bearProof); if (!ok) { p.invest.push(a); p.stats.sells--; return false; } p.stats.sellPros++; /* banked */ }
    else { this.collect(p, a.cash); p.discard.push(a); p.stats.sellCash++; this.log(`${p.name} sells ${a.name} for ${a.cash}`); }
    await this.mapDraw(p);
    return true;
  }
  async mapDraw(p) { if (p.artifacts.some((a) => a.key === 'map')) { await this.draw(p); this.log(`${p.name} follows EL MAPA and draws a card`); } }
  payClear(p, h) { if (!this.spend(p, 3)) return false; this.clearHazard(p, h, p, `${p.name} pays 3`); return true; }
  // The Dashboard Figure: when a die fails you, she may be spent for one more
  // roll. The policy decides (a human is asked); returns true when she was spent.
  async dashboard(p, w) {
    const fig = p.artifacts.find((a) => a.key === 'dashboard'); if (!fig) return false;
    if (!(await p.policy.useDashboard(this, p, w))) return false;
    p.artifacts.splice(p.artifacts.indexOf(fig), 1); p.discard.push(fig);
    this.log(`${w.kind === 'hail' ? 'the Hail Mary' : w.name} shows ${w.roll} — ${p.name}'s DASHBOARD FIGURE nods: roll again`); return true;
  }
  async hailMary(p) {
    p.hailUsed = true; p.stats.hail++; const winningFaces = this.odds(p);
    const rolls = [1 + Math.floor(this.rng() * HAIL_DIE_SIDES)];
    if (rolls[0] > winningFaces && await this.dashboard(p, { kind: 'hail', roll: rolls[0] })) {
      rolls.push(1 + Math.floor(this.rng() * HAIL_DIE_SIDES));
    }
    const roll = rolls[rolls.length - 1];
    const before = p.pros;
    const cleared = roll <= winningFaces ? p.hazards.map(h => h.name) : [];
    const ok = roll <= winningFaces;
    this.log(`✝ ${p.name} attempts the HAIL MARY at ${winningFaces}/${HAIL_DIE_SIDES} with ${p.deeds} candle${p.deeds === 1 ? '' : 's'}… the die shows ${roll}: ${ok ? 'ANSWERED' : 'unanswered'}`);
    if (ok) { for (const h of [...p.hazards]) this.clearHazard(p, h, p, 'grace'); p.stats.hailWon++; this.bank(p, 200, 'hail'); }
    await this.hooks?.onHailResult?.(p, { rolls, winningFaces, ok, banked: p.pros - before, cleared });
    return ok;
  }

  legalActions(p) {
    const A = [];
    for (const c of p.hand) {
      const cost = this.costOf(p, c); if (p.liq < cost) continue;
      if (c.type === 'asset' || c.type === 'artifact' || c.type === 'location' || c.type === 'trader') A.push({ t: 'play', c });
      else if (c.type === 'event' && c.played) { if (this.hasHaz(p, 'scam')) continue; if (!c.choice) { if (c.bearProof || c.bloom || !(this.hasHaz(p, 'bear') && this.eventPayout(p, c) > 75)) A.push({ t: 'play', c }); } else { A.push({ t: 'play', c, choice: { cash: true } }); if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c, choice: {} }); } }
      else if (c.type === 'hazard') { for (const r of this.rivals(p)) if (!this.hasHaz(r, c.key)) A.push({ t: 'play', c, choice: { target: r } }); }
      else if (c.type === 'remedy') { for (const q of this.players) for (const h of q.hazards) if (c.clears === 'any' || h.key === c.clears) A.push({ t: 'play', c, choice: { target: q, hazard: h } }); if (c.key === 'publicista' && p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) A.push({ t: 'play', c, choice: { polish: true } }); if (c.refresh) A.push({ t: 'play', c, choice: { refresh: true } }); }
      else if (c.type === 'grace') { if (this.is(p, 'bot') || this.hasHaz(p, 'infierno')) continue; if (c.key === 'fountain') { if (!p.hailUsed) A.push({ t: 'play', c }); } else if (p.deeds < 3) { if (c.key === 'rose') { for (const r of this.rivals(p)) A.push({ t: 'play', c, choice: { target: r } }); } else A.push({ t: 'play', c }); } }
    }
    for (const a of p.invest) if (a.uncork && p.deeds < 3 && !this.is(p, 'bot')) A.push({ t: 'uncork', a });
    for (const a of p.invest) { if (this.hasHaz(p, 'rug') || a.bornTurn === this.turnNo) continue; if (a.gamble) A.push({ t: 'sell', a, pros: false }); if (a.bearProof || !(this.hasHaz(p, 'bear') && this.saleValue(a) > 75)) A.push({ t: 'sell', a, pros: true }); }
    if (this.rules.earnedHalo && p.trader && !p.trader.earned) { if (this.rules.giftBlind) { if (p.hand.length) A.push({ t: 'gift', c: null }); } else for (const c of p.hand) if (c.type !== 'hazard') A.push({ t: 'gift', c }); }
    if (p.liq >= 3) for (const h of p.hazards) A.push({ t: 'payclear', h });
    if (!p.hailUsed && !this.hasHaz(p, 'infierno')) A.push({ t: 'hail' });
    A.push({ t: 'pass' });
    return A;
  }
  async act(p, a) {
    switch (a.t) {
      case 'play': return this.playCard(p, a.c, a.choice || {});
      case 'sell': return this.sell(p, a.a, a.pros);
      case 'uncork': { const w = a.a; p.invest.splice(p.invest.indexOf(w), 1); p.discard.push(w); this.log(`${p.name} uncorks ${w.name}`); await this.lightCandle(p, 'La Cava'); return true; }
      case 'gift': { // give a card from your hand to your rival; if they take it, your Trader earns a halo
        const to = a.target || [...this.rivals(p)].sort((x, y) => this.netWorth(x) - this.netWorth(y))[0];
        const blind = !a.c; const c = a.c || p.hand[Math.floor(this.rng() * p.hand.length)]; // giftBlind: the rival draws one at random, and cannot refuse
        this.log(`${p.name} offers ${to.policy.human || p.policy.human ? c.name : 'a card'} to ${to.name}`); p.stats.offers = (p.stats.offers || 0) + 1;
        if (!blind && to.policy.acceptGift && !(await to.policy.acceptGift(this, to, c, p))) { this.log(`${to.name} declines the gift`); return true; }
        p.hand.splice(p.hand.indexOf(c), 1); if (c.type === 'trader') { delete c.credNow; delete c.earned; } to.hand.push(c); p.stats.gifts = (p.stats.gifts || 0) + 1;
        this.earnHalo(p, 'gift'); return true; }
      case 'payclear': return this.payClear(p, a.h);
      case 'hail': return this.hailMary(p);
      case 'pass': p.stats.passes++; this.log(`${p.name} passes`); return true;
    }
  }
  async takeTurn(p) {
    p.peekedThisTurn = false; p.buriedThisTurn = false; p.stats.turns++; if (p.hazards.length) p.stats.hazTurns++;
    for (const k of Object.keys(this.fx)) if (this.fx[k].owner === p.idx) { delete this.fx[k]; this.log(`${byKey[k].name} blows over`); }
    // Compound Interest belongs to the active, enabled Trader. Resolve it
    // through bank() so Calamities and the victory check still apply.
    // CLEAN SWEEP (2026-11-16): the cat no longer swats only on arrival. While he sits, each turn
    // starts with a roll — 4+ and he knocks one Calamity off the table (his pick, not yours). It gives
    // him something to do when he opens the game at a clean desk. A Quantum Hack on the seat stops him.
    if (this.is(p, 'gato') && p.hazards.length) { const r = this.roll();
      if (r >= 4 + this.d8()) this.clearHazard(p, p.hazards[Math.floor(this.rng() * p.hazards.length)], p, `EL GATO rolls ${r} and knocks it off the table`);
      else this.log(`EL GATO rolls ${r} — he only looks at it`); }
    if (this.is(p, 'unicornio') && p.pros >= 100) {
      this.bank(p, 25, 'Compound Interest');
      if (this.over) {
        if (this.hooks && this.hooks.render) await this.hooks.render();
        return;
      }
    }
    if (p.artifacts.some((a) => a.key === 'tattoo')) this.restoreStanding(p, 'THE TATTOO');
    for (const g of [...p.invest]) if (g.rooster) { const r = this.roll();
      if (r === this.rules.die) { this.collect(p, 2); this.log(`EL GALLO wins the fight — ${p.name} collects 2`); }
      else if (r === 1) { p.invest.splice(p.invest.indexOf(g), 1); p.discard.push(g); this.log(`EL GALLO rolls a 1 — he is dead, and ${p.name} gets nothing`); }
      else this.log(`EL GALLO rolls ${r} — he lives to fight again`); }
    const ticket = p.artifacts.find((a) => a.key === 'lottery');
    if (ticket) {
      const roll = this.roll();
      if (roll < this.rules.die) this.log(`${p.name} scratches THE LOTTERY TICKET — the die shows ${roll}: not this time`);
      else if (this.bank(p, 150, `THE LOTTERY TICKET — the die shows ${roll}: a WINNER`)) { p.artifacts.splice(p.artifacts.indexOf(ticket), 1); p.discard.push(ticket); }
      else this.log(`${p.name} scratches THE LOTTERY TICKET — the top face! but the BEAR MARKET caps the prize; the Ticket is held`);
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; }
    }
    if (this.is(p, 'diablito')) {
      if (this.rng() < 0.5) {
        this.collect(p, p.trader.wager ?? 1);
        this.log(`DEVIL'S WAGER — heads: ${p.name} collects ${p.trader.wager ?? 1}`);
      } else {
        if (p.trader.wagerLoss != null) { const lost = Math.min(p.liq, p.trader.wagerLoss); p.liq -= lost; this.log(`DEVIL'S WAGER — tails: ${p.name} pays ${lost}`); }
        // tails costs him his good standing, never his seat: the devil cannot fall twice
        else if (p.trader.credNow == null || p.trader.credNow >= p.trader.cred) { p.trader.credNow = 1; this.log(`DEVIL'S WAGER — tails: El Diablito is in scandal`); }
        else this.log(`DEVIL'S WAGER — tails: nothing left to lose`);
      }
    }
    // EL NACIMIENTO: a figure a turn; the third brings the Niño, and the scene is packed away.
    if (p.location && p.location.key === 'nacimiento') {
      const nac = p.location; nac.figures = (nac.figures || 0) + 1;
      if (nac.figures < 3) this.log(`${p.name} places a figure in EL NACIMIENTO (${nac.figures} of 3)`);
      else { this.log(`midnight at EL NACIMIENTO — the Niño arrives for ${p.name}`); await this.lightCandle(p, 'El Nacimiento'); this.bank(p, 75, 'El Nacimiento'); nac.figures = 0; p.location = null; p.discard.push(nac); this.log(`${p.name} packs the Nativity away`);
        if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; } }
    }
    // LAS CATACUMBAS: bury the seated Trader with honors — 5 Prosperity per point of Credibility they have left.
    if (p.location && p.location.key === 'catacumbas' && p.trader && p.policy.buryTrader && await p.policy.buryTrader(this, p)) {
      const t = p.trader; const honors = (t.credNow ?? t.cred) >= t.cred ? 75 : 25; // in good standing, or in scandal
      this.log(`⚰ ${p.name} buries ${t.name} in LAS CATACUMBAS with honors`); p.trader = null; p.discard.push(t); p.stats.buried = (p.stats.buried || 0) + 1;
      this.bank(p, honors, 'Las Catacumbas');
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; }
    }
    // SEED ROUND: a planted Event blooms after its rounds; a Bear Market holds the harvest until it is cleared.
    for (const sd of [...p.seeds]) { if (this.turnNo - sd.bornTurn < sd.bloom) continue;
      const ok = this.bank(p, this.eventPayout(p, sd), `${sd.name} IN BLOOM` + (p.artifacts.some((a) => a.key === 'geometry') ? ' · SACRED GEOMETRY +25' : ''));
      if (ok) { p.seeds.splice(p.seeds.indexOf(sd), 1); p.discard.push(sd); } else this.log(`${p.name}'s ${sd.name} is in bloom, but the BEAR MARKET holds the harvest`);
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; } }
    if (this.rules.scandalFuse && p.trader && this.hasHaz(p, 'escandalo') && p.scandalSeen) await this.credDamage(p, 1, 'the Scandal was left to burn'); // trial: a Scandal left on the table for a full round is a second strike
    p.scandalSeen = this.hasHaz(p, 'escandalo');
    const employed = p.trader && this.abilityOn(p);
    const spotless = employed && (p.trader.credNow == null || p.trader.credNow === p.trader.cred);
    const tithe = employed && p.trader.tithe ? p.trader.tithe * p.deeds : 0; // El Monje (Playtest 3): income for every candle lit
    const halo = spotless ? (p.trader.halo ?? 1) + (p.trader.earned ? 1 : 0) : 0; // CREDIBILITY, the printed number: what good standing pays this Trader
    this.collect(p, employed ? p.trader.liq + halo + tithe : 1);
    if (tithe) this.log(`${p.trader.name}'s candles pay ${p.name} +${tithe}`);
    if (halo) this.log(`${p.trader.name} is in good standing — ${p.name} collects +${halo}`);
    if (!employed) this.log(`${p.name} is between Traders — collects only 1`);
    if (this.hasHaz(p, 'taxman') && p.liq > 0) { p.liq -= 1; this.log(`${p.name} pays 1 to the TAX COLLECTOR`); }
    const yield2 = p.invest.reduce((s2, a2) => s2 + (a2.income || 0), 0);
    if (yield2) { this.collect(p, yield2); this.log(`${p.name} collects ${yield2} from investments`); }
    // DUE DILIGENCE is an open book (2026-11-16): while La Investigadora sits, the top card of her
    // player's deck is face up to them, and once on their turn they may bury it (bury(), below).
    // Nobody is asked anything: a human uses the Bury button at the table, before or after the draw;
    // a bot decides here, before it draws. An empty deck is reshuffled first so there is a card to read.
    if (this.is(p, 'investigadora') && !p.deck.length && p.discard.length) { p.deck = this.shuffle(p.discard.splice(0)); this.log(`${p.name} reshuffles`); }
    if (p.policy.beforeDraw) await p.policy.beforeDraw(this, p);
    if (this.canBury(p) && p.policy.dueDiligence && await p.policy.dueDiligence(this, p, p.deck[0])) this.bury(p);
    await this.draw(p);
    const action = await p.policy.main(this, p) || { t: 'pass' };
    const before = this.hooks?.beforeAction?.();
    const result = await this.act(p, action);
    await this.hooks?.onAction?.(p, action, before, result);
    while (p.hand.length > 7) { const d = await p.policy.discardOne(this, p); p.hand.splice(p.hand.indexOf(d), 1); p.discard.push(d); p.stats.discards++; }
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  async run() {
    while (!this.over && this.turnNo < this.maxTurns) { this.turnNo++; for (const p of this.players) { if (this.over) break; this.active = p; if (this.hooks && this.hooks.render) await this.hooks.render(); await this.turn(p); } }
    if (this.verbose) { this.lines.forEach((l) => console.log(l)); console.log(`END turn ${this.turnNo}: ${this.players.map((q) => `${q.name} $${q.pros}M net ($${q.cash}M cash)/${q.deeds}d`).join(' · ')}`); }
    return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, turns: this.turnNo,
      players: this.players.map((q) => ({ name: q.name, recipe: q.recipe, trader: q.trader ? q.trader.key : null, starter: q.starter || null, pros: q.pros, cash: q.cash, paper: q.invest.reduce((s, a) => s + this.paperValue(a), 0), ...q.stats })) };
  }
}

// ── policies ──
export class RandomBot {
  constructor(rng) { this.rng = rng; }
  useHeart() { return this.rng() < 0.5; }
  acceptRose() { return this.rng() < 0.6; }
  discardOne(g, p) { return p.hand[Math.floor(this.rng() * p.hand.length)]; }
  useDashboard() { return this.rng() < 0.5; }
  useSavingGrace(g, p, cards) { return this.rng() < 0.5 ? cards[Math.floor(this.rng() * cards.length)] : null; }
  buryTrader(g, p) { return p.hand.some(c => c.type === 'trader' && g.costOf(p, c) <= p.liq) && this.rng() < 0.2; }
  useEnigma() { return this.rng() < 0.5; }
  acceptGift() { return true; }
  dueDiligence() { return this.rng() < 0.5; }
  main(g, p) { const A = g.legalActions(p); return A[Math.floor(this.rng() * A.length)]; }
}
export class GreedyBot {
  constructor() {}
  useHeart() { return true; }
  acceptRose() { return true; }
  // She is saved for the Hail Mary unless that prayer has already been said.
  useDashboard(g, p, w) { return w.kind === 'hail' || p.hailUsed; }
  // Intercepts the weather that is not a plain windfall: Calamities and shake-ups.
  useEnigma(g, p, c) { return c.subtype === 'Calamity' || c.subtype === 'Ambiguity'; }
  // Always saves the Trader, with the card that leaves the most Credibility.
  // Bury a seated Trader in the Catacombs when a replacement waits and the honors are worth it, or a Scandal is grinding them down.
  buryTrader(g, p) { const good = (p.trader.credNow ?? p.trader.cred) >= p.trader.cred; return p.hand.some(c => c.type === 'trader' && g.costOf(p, c) <= p.liq) && (good || g.hasHaz(p, 'escandalo')); }
  useSavingGrace(g, p, cards) { return [...cards].sort((a, b) => b.savingGrace - a.savingGrace)[0]; }
  // Takes the card only when it is worth more to them than the halo is to the giver (RULES.giftsAlwaysTaken: any card).
  acceptGift(g, p, c, from) { return g.rules.giftsAlwaysTaken || g.giftValue(p, c) >= g.haloWorth(from); }
  // Bottoms the weather that would hurt (the Enigma's rule), a Trader when a spare is already affordable, or a card too dear to play soon.
  dueDiligence(g, p, c) {
    if (c.type === 'event' && !c.played) return c.subtype === 'Calamity' || c.subtype === 'Ambiguity';
    if (c.type === 'trader') return !!p.trader && p.hand.some(c => c.type === 'trader' && g.costOf(p, c) <= p.liq);
    if (c.type === 'location') return !!p.location;
    return c.cost > p.liq + 3;
  }
  discardOne(g, p) { const order = { hazard: 0, remedy: 1, artifact: 2, trader: 3, grace: 4, asset: 5, event: 6 } /* an event in hand is a played one */; return [...p.hand].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))[0]; }
  // ONE MONEY changes what a play is worth, so the bot counts in net worth ($M) now:
  //   · an investment (Asset, called Event) scores what it adds: value minus price, plus what it will earn
  //   · everything else (Calamities, Remedies, Relics, Graces, a switch of Trader) keeps its Playtest 2
  //     weight, less half its price — spending is now paid for out of the score
  //   · selling adds nothing by itself (the Asset already counted); the bot sells to take a bonus, to get
  //     out of something about to lose value, or to raise cash for a card it cannot afford
  score(g, p, a) {
    const R = g.rules.rate, nw = (q) => g.netWorth(q);
    const lead = [...g.rivals(p)].sort((x, y) => nw(y) - nw(x))[0];
    const left = Math.max(1, Math.min(6, Math.ceil((g.winAt - Math.max(nw(p), nw(lead))) / 90))); // rounds the game probably has left
    const wins = (gain) => (nw(p) + gain >= g.winAt ? 9999 : 0);
    const price = a.t === 'play' ? g.costOf(p, a.c) * R : 0;
    const spend = price * 0.5;
    const earns = (t) => t.liq + (t.halo ?? 1) * 0.75;
    const winningFaces = g.odds(p); const hailEV = (winningFaces / HAIL_DIE_SIDES) * 200;
    let s = 0;
    if (a.t === 'play' && a.c.type === 'event' && a.c.played) {
      const ev = g.eventPayout(p, a.c);
      const gain = a.choice && a.choice.cash ? a.c.cash * R : a.c.bloom ? (left >= a.c.bloom ? ev * 0.75 : 0) - price : ev - price;
      s = gain - (a.c.rivalsCollect ? a.c.rivalsCollect * R * g.rivals(p).length * 0.5 : 0) + (a.c.bloom ? 0 : wins(gain));
    }
    if (a.t === 'uncork') s = p.deeds === 2 && !p.hailUsed ? 52 : 0;
    if (a.t === 'sell') {
      const x = a.a; const paper = g.paperValue(x); const bonus = g.saleBonus();
      const dear = p.hand.some((c) => (c.type === 'asset' || (c.type === 'event' && c.played)) && g.costOf(p, c) * R > p.cash && g.costOf(p, c) * R <= p.cash + paper);
      if (x.gamble && a.pros) { const P = g.gambleOdds(p, x); const edge = P * (x.pros + bonus) + (1 - P) * (x.bust || 0) - paper;
        s = nw(p) - paper + x.pros + bonus >= g.winAt ? 60 + 100 * P : edge > 0 ? 20 + edge : 0; }
      else { const fading = x.ripe && g.turnNo - x.bornTurn >= 2 ? 50 : 0; const earning = ((x.income || 0) * R + (x.grow || 0)) * left;
        s = bonus + fading - earning + (dear ? 22 : 0) + wins(bonus); }
      // CASH ONLY: the Asset counts for nothing until it is sold, so the sale itself is the gain.
      if (!g.rules.countAssets) { const cashNow = x.gamble && !a.pros ? x.cash * R : null;
        if (x.gamble && a.pros) { const P = g.gambleOdds(p, x); s = P * (x.pros + bonus) + (1 - P) * (x.bust || 0) + (p.cash + x.pros + bonus >= g.winAt ? 40 * P : 0); }
        else { const v = cashNow ?? g.prosOf(x) + bonus; const ripening = x.ripe && g.turnNo - x.bornTurn < 2 ? 100 : 0; const waiting = x.gem && p.deeds < 3 && p.deeds >= 2 ? 100 : 0;
          s = v - 10 - ripening - waiting - Math.min(v * 0.4, ((x.income || 0) * R + (x.grow || 0)) * 1.5) + (p.cash + v >= g.winAt ? 9999 : 0); } }
    }
    if (a.t === 'play' && a.c.type === 'asset') {
      const x = a.c; const now = x.gamble ? x.cash * R : x.ripe ? 50 : x.perp ? x.pros * 2 : x.pros;
      const P = x.gamble ? g.gambleOdds(p, x) : 0;
      const later = (x.income || 0) * R * left + (x.grow || 0) * left + (x.ripe && left >= 2 ? 100 : 0) + (x.gamble ? Math.max(0, P * x.pros + (1 - P) * (x.bust || 0) - now) : 0) + (x.gem && p.deeds >= 2 ? 100 : 0);
      s = g.rules.countAssets ? 25 + (now - price) + later * 0.7 + wins(now - price) : 25 + (now - price) * 0.6 + later * 0.7; // cash only: the profit is a second action away
    }
    if (a.t === 'play' && a.c.type === 'hazard') s = (a.choice.target === lead && nw(lead) > nw(p) ? 70 + nw(lead) / 20 : 15) - (a.choice.target.trader ? (a.choice.target.trader.eq || 0) * 4 : 0) - spend;
    const inGood = p.trader && (p.trader.credNow == null || p.trader.credNow >= p.trader.cred);
    const haloWorth = g.rules.earnedHalo && inGood && !p.trader.earned && left >= 3 ? R * (left - 1) * 0.75 : 0; // what an earned halo will pay
    if (a.t === 'play' && a.c.type === 'remedy') { const mine = a.choice.target === p; s = (mine ? 80 : 8 + (haloWorth ? haloWorth - 30 : 0)) - spend; }
    if (a.t === 'gift' && !a.c) { const avg = p.hand.reduce((t, c) => t + (c.type === 'event' ? 80 : c.type === 'asset' ? 60 : c.type === 'hazard' ? 40 : 25), 0) / p.hand.length; s = haloWorth ? haloWorth * g.rules.giftKeen - avg * 0.6 : 0; }
    else if (a.t === 'gift') { const c = a.c; const to = [...g.rivals(p)].sort((x, y) => nw(x) - nw(y))[0];
      const dead = (c.type === 'trader' && p.trader && earns(c) <= earns(p.trader) + 0.5) || (c.type === 'remedy' && !c.refresh && !p.hazards.length) || (c.type === 'grace' && (p.deeds >= 3 || p.hailUsed || g.is(p, 'bot'))) || (c.type === 'location' && !!p.location) || (c.type === 'artifact' && g.relicsHeld(p).length >= g.relicSlots(p));
      const keep = dead ? 0 : c.type === 'event' ? 80 : c.type === 'asset' ? 60 : 25; // what the card is worth to keep
      const taken = g.rules.giftsAlwaysTaken || g.giftValue(to, c) >= haloWorth; // a refused offer wastes the turn: do not make one
      s = haloWorth && taken ? haloWorth * g.rules.giftKeen - keep - g.giftValue(to, c) * 0.5 : 0; }
    if (a.t === 'play' && a.choice && a.choice.refresh) { const dead = p.hand.filter((c) => c !== a.c && c.type !== 'event' && c.cost > p.liq + 1).slice(0, a.c.refresh); a.choice.discards = dead; s = 28 + 10 * dead.length; }
    if (a.t === 'play' && a.c.type === 'artifact') s = 35 - spend;
    if (a.t === 'play' && a.c.type === 'location') s = p.location ? 0 : 58 - spend; // never tear a standing place down for another
    if (a.t === 'play' && a.c.type === 'grace') s = (!p.hailUsed ? 57 - p.deeds * 4 : 2) - spend;
    if (a.t === 'play' && a.c.type === 'trader') s = !p.trader ? 72 + earns(a.c) * 3 : (p.trader.credNow < p.trader.cred && (a.c.credNow ?? a.c.cred) > p.trader.credNow ? 46 : earns(a.c) > earns(p.trader) + 0.5 && left >= 3 ? 75 : 0) - spend;
    if (a.t === 'play' && a.c.key === 'escandalo' && a.choice && !a.choice.target.trader) s = 5;
    if (a.t === 'play' && a.choice && a.choice.polish) s = (p.trader && p.trader.credNow < p.trader.cred && !g.hasHaz(p, 'escandalo') ? 42 : 0) - spend;
    if (a.t === 'payclear') s = 66 - 3 * R * 0.5 + (a.h.key === 'trap' ? (a.h.pile || 0) * R : 0);
    if (a.t === 'hail') s = nw(p) + 200 >= g.winAt ? (winningFaces >= 3 ? 90 : 30) : winningFaces >= 4 ? 72 : lead && nw(lead) >= g.winAt - 150 ? 45 : hailEV / 4;
    if (a.t === 'pass') s = 1;
    return s;
  }
  main(g, p) {
    const A = g.legalActions(p);
    let best = null, bs = -1;
    for (const a of A) { const s = this.score(g, p, a); if (s > bs) { bs = s; best = a; } }
    return best;
  }
}

// ── CLI ──
const ARGV = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
const args = Object.fromEntries(ARGV.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));
export function playOne({ seed = 1, nPlayers = 3, bots = null, decks = null, starters = null, verbose = false, rotate = 0, rules = {} }) {
  const kinds = (bots || 'greedy,greedy,greedy,greedy'.split(',').slice(0, nPlayers).join(',')).split(',').slice(0, nPlayers);
  const recs = (decks || 'devotion,degen,devotion,degen').split(',');
  const sts = starters ? starters.split(',') : [];
  const players = kinds.map((k, i) => ({ name: `${k.toUpperCase()} ${'ABCD'[i]}`, recipe: recs[i % recs.length], starter: sts[i] || null, policy: k === 'random' ? new RandomBot(makeRng(seed * 31 + i)) : new GreedyBot() }));
  for (let r = 0; r < rotate; r++) players.push(players.shift());
  return new Game({ players, seed, verbose, rules });
}
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('pt3-sim.js')) {
  const games = +(args.games || 1000); const seed = +(args.seed || 1); const nPlayers = +(args.players || 2);
  const rules = {}; for (const k of ['rate', 'goal', 'start', 'crash']) if (args[k] != null) rules[k] = +args[k]; if (args.rug) rules.rugFreezes = true; if (args.assets) rules.countAssets = true; if (args.sudden) rules.finishRound = false; if (args.nostrikes) rules.calamityStrikes = false; if (args.d6) rules.die = 6; if (args.nohalo) rules.earnedHalo = false; if (args.takeall) rules.giftsAlwaysTaken = true; if (args.blind) rules.giftBlind = true; if (args.keen != null) rules.giftKeen = +args.keen; if (args.candlehalo) { rules.earnedHalo = true; rules.candleHalo = true; } if (args.fuse) rules.scandalFuse = true;
  if (args.verbose) { await playOne({ seed, nPlayers, bots: args.bots, decks: args.decks, starters: args.starters, rules, verbose: true }).run(); process.exit(0); }
  const res = { first: 0, recipeWins: {}, recipeGames: {}, seatWins: [0, 0, 0, 0], turns: [], endTrader: {}, startTrader: {}, s: {}, noWin: 0, wCash: 0, wPaper: 0, n: 0 };
  for (let i = 0; i < games; i++) {
    const r = await playOne({ seed: seed + i, nPlayers, bots: args.bots, decks: args.decks, starters: args.starters, rules, rotate: i % nPlayers }).run();
    for (const p of r.players) res.recipeGames[p.recipe] = (res.recipeGames[p.recipe] || 0) + 1;
    if (!r.winner) { res.noWin++; continue; }
    const wp = r.players.find((p) => p.name === r.winner); res.recipeWins[wp.recipe] = (res.recipeWins[wp.recipe] || 0) + 1; res.wCash += wp.cash; res.wPaper += wp.paper; res.n++;
    res.seatWins[(r.winnerIdx + nPlayers - (i % nPlayers)) % nPlayers]++; res.turns.push(r.turns); if (r.winnerIdx === 0) res.first++;
    for (const p of r.players) { const O = res.startTrader[p.starter || 'none'] = res.startTrader[p.starter || 'none'] || { g: 0, w: 0 }; O.g++; if (r.winner === p.name) O.w++; }
    for (const p of r.players) { const T = res.endTrader[p.trader || 'none'] = res.endTrader[p.trader || 'none'] || { g: 0, w: 0 }; T.g++; if (r.winner === p.name) T.w++;
      for (const k of ['halos', 'halosLost', 'halo_gift', 'halo_remedy', 'halo_candle', 'gifts', 'offers', 'strikes', 'restored', 'savingGrace', 'plays', 'hires', 'disgraces', 'sells', 'hazPlayed', 'hazCleared', 'candles', 'hail', 'hailWon', 'turns', 'hazTurns', 'passes']) res.s[k] = (res.s[k] || 0) + (p[k] || 0); }
  }
  const avg = (x) => (x.reduce((s2, n) => s2 + n, 0) / Math.max(1, x.length)).toFixed(1);
  const R0 = { ...RULES, ...rules };
  console.log(`${games} games · ${nPlayers} players · ONE MONEY: $${R0.rate}M a coin, first to $${R0.goal}M, open with $${R0.start * R0.rate}M${R0.countAssets ? ' · unsold Assets count' : ' · cash only'}`);
  console.log(`the player who goes first wins ${(res.first / Math.max(1, games - res.noWin) * 100).toFixed(1)}% (even is ${(100 / nPlayers).toFixed(0)}%) | no winner ${res.noWin}`);
  console.log(`rounds to win avg ${avg(res.turns)}`);
  console.log('deck recipes:', Object.entries(res.recipeGames).map(([k, g2]) => `${k} wins ${Math.round((res.recipeWins[k] || 0) / Math.max(1, g2) * 100)}% of its seats (${res.recipeWins[k] || 0}/${g2})`).join(' | '));
  console.log(`the winner's $${Math.round((res.wCash + res.wPaper) / Math.max(1, res.n))}M: $${Math.round(res.wCash / Math.max(1, res.n))}M cash + $${Math.round(res.wPaper / Math.max(1, res.n))}M unsold Assets`);
  const s = res.s; const pg = (k) => (s[k] / games).toFixed(2);
  console.log(`Credibility, per game: scandals ${pg('strikes')} · back in good standing ${pg('restored')} · discredited ${pg('disgraces')} · Saving Face spent ${pg('savingGrace')}`);
  if (R0.earnedHalo) console.log(`Earned halos, per game: earned ${pg('halos')} (gift ${pg('halo_gift')} · clearing a rival's Calamity ${pg('halo_remedy')} · first candle ${pg('halo_candle')}) · knocked off ${pg('halosLost')}`);
  console.log(`per game (all players): cards played ${pg('plays')} switches ${pg('hires')} sales ${pg('sells')} calamities ${pg('hazPlayed')} cleared ${pg('hazCleared')} candles ${pg('candles')} hail ${pg('hail')} answered ${pg('hailWon')}`);
  console.log('opening Trader (win rate):', Object.entries(res.startTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
  console.log('trader at the desk when the game ended (win rate):', Object.entries(res.endTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
}
