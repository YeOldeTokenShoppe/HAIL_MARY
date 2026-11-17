#!/usr/bin/env node
// RL80 R-cana — Playtest 2: THE TRADING DESK (PLAYTEST2.md).
// Traders carry CRED (durability) and LIQ (your income); one active seat.
// Scandals drain Credibility — discredited when all is lost. Candles restore it.
// 3–4 players, constructed 40-card decks, one main action a turn, race to bank 1,000 Prosperity.
// Liquidity funds plays; Assets sell later for cash or Prosperity; Hazards stick until cleared;
// Remedies, Artifacts (max two equipped); La Ofrenda lights candles at Our Lady's shrine (max three),
// each adding a winning face to the once-per-game Hail Mary, from 1/8 to 4/8 — success clears your hazards and banks 200.
//   node pt-sim.js --games 2000 --players 3 --bots greedy,greedy,random
//   node pt-sim.js --verbose --seed 7 --players 3
//   node pt-sim.js --starters monje,diablito,gato     (opening Trader per seat; unset seats pick a junior at random)
export function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── The set's designs live in src/game/rcana/set/designs.js — the one source of truth ──
// pt2-build.js inlines that file here for the browser table; Node imports it directly.
import { DESIGNS } from '../rcana/set/designs.js';
const GOD_CANDLE_BONUS = 100; // flat Prosperity bonus per sale while The God Candle burns
// The game calls every card what the CARD calls itself: a design's printed
// name (the lotería La Máquina over the engine's Enigma Machine) becomes its
// name here, so the table, the gallery and the log all match the print.
for (const d of DESIGNS) if (d.printName) d.name = d.printName;
export const byKey = Object.fromEntries(DESIGNS.map((d) => [d.key, d]));
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
  constructor({ players, seed = 1, verbose = false, winAt = 1000, maxTurns = 300 }) {
    this.rng = makeRng(seed); this.verbose = verbose; this.lines = []; this.winAt = winAt; this.maxTurns = maxTurns;
    this.fx = {}; this.dealing = true;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, trader: null, recipe: cfg.recipe || 'devotion',
      deck: this.shuffle(RECIPES[cfg.recipe || 'devotion'].flatMap(([k, n]) => Array.from({ length: n }, () => ({ ...byKey[k] })))),
      hand: [], discard: [], invest: [], seeds: [], artifacts: [], location: null, hazards: [], liq: 5, pros: 0, deeds: 0, hailUsed: false,
      stats: { plays: 0, hires: 0, disgraces: 0, sells: 0, sellCash: 0, sellPros: 0, hazPlayed: 0, hazCleared: 0, remedyRival: 0, candles: 0, hail: 0, hailWon: 0, passes: 0, discards: 0, turns: 0, hazTurns: 0 } }));
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
      this.log(`${p.name} opens with ${t.name} at the desk (LIQ ${t.liq} · CRED ${t.cred} · EQ ${t.eq || 0})`);
    });
    for (const p of this.players) for (let i = 0; i < 5; i++) this.draw(p, true);
    this.dealing = false;
  }
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
    if (c.type === 'trader') delete c.credNow;
    p.hand.push(c);
    if (!silent) this.hooks?.onDraw?.(p, c);
    if (!silent) this.log(`${p.name} draws${p.policy && p.policy.human ? ' ' + c.name : ''}`);
    return c;
  }
  async event(p, c) {
    this.log(`✦ EVENT — ${c.name} (drawn by ${p.name}): ${c.text}`);
    for (const q of this.players) for (const a of [...q.invest]) if (a.key === 'jardin') { q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.log(`${q.name}'s YIELD FARM is wiped by the weather`); }
    if (c.key === 'godcandle') this.fx[c.key] = { owner: p.idx };
    if (c.key === 'fall') for (const q of this.players) if (q.trader) await this.credDamage(q, 4, 'the FALL FROM GRACE');
    if (c.key === 'feast') { this.log('THE FEAST OF PERPETUAL PROFIT — every player lights a candle'); for (const q of this.players) await this.lightCandle(q, 'the Feast'); }
    if (c.key === 'holyroller') { for (const q of this.players) { this.collect(q, 1); await this.draw(q, true); } this.log('THE HOLY ROLLER rolls through — every player draws a card and collects 1'); }
    if (c.key === 'fuego') { this.log('NUESTRA SEÑORA DEL FUEGO rides through the market'); for (const q of this.players) { this.bank(q, 75, 'Nuestra Señora del Fuego'); if (this.over) break; } }
    if (c.key === 'virtual') { for (const q of this.players) { const n = q.hand.length; q.deck.push(...q.hand.splice(0)); q.deck = this.shuffle(q.deck); for (let i = 0; i < n; i++) await this.draw(q, true); this.log(`THE VIRTUAL MARY flickers — ${q.name} shuffles ${n} back and draws ${n}`); } }
    if (c.key === 'techwreck') { let hit = 0; for (const q of this.players) for (const a of [...q.invest]) if (a.tech) { q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.collect(q, 1); hit++; this.log(`${q.name}'s ${a.name.toUpperCase()} is wrecked — scrapped for 1`); } for (const q of this.players) if (q.location && q.location.tech) { this.log(`${q.name}'s ${q.location.name.toUpperCase()} burns down`); q.discard.push(q.location); q.location = null; hit++; }
      if (!hit) this.log('TECH WRECK — no tech on the table; the bubble bursts over nobody'); }
    if (c.key === 'crash') for (const q of this.players) {
      if (q.invest.some((a) => a.silver)) { this.log(`${q.name} holds LA PLATA — flight to safety`); this.bank(q, 25, 'La Plata'); continue; }
      if (q.liq >= 8) { const lost = Math.floor(q.liq / 2); q.liq -= lost; this.log(`${q.name} loses ${lost} Liquidity in the crash`); } }
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
        const roll = 1 + Math.floor(this.rng() * 6);
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
    this.log(`${p.name} banks ${n} (${src}) → ${p.pros}`);
    if (p.pros >= this.winAt && !this.over) { this.over = true; this.winner = p; this.log(`*** ${p.name} WINS with ${p.pros} ***`); }
    return true;
  }
  async lightCandle(p, why) {
    if (this.is(p, 'bot')) { this.log(`THE BOT cannot pray — the candle (${why}) goes unlit`); return false; }
    if (p.deeds >= 3) return false;
    p.deeds += 1; p.stats.candles++;
    if (this.is(p, 'monje')) this.bank(p, 25, 'El Monje');
    if (p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) { p.trader.credNow = Math.min(p.trader.cred, p.trader.credNow + 3); this.log(`the candlelight restores ${p.trader.name} → ${p.trader.credNow}/${p.trader.cred} Grace`); }
    if (p.artifacts.some((a) => a.key === 'rosary')) await this.draw(p);
    this.log(`🕯 ${p.name} lights a candle (${why}) → ${p.deeds} of 3`);
    for (const q of this.players) if (q.location && q.location.key === 'catedral') { this.log(`a green candle in LA CATEDRAL — ${q.name} banks 25`); this.bank(q, 25, 'La Catedral'); }
    return true;
  }
  // Credibility damage. At zero the Trader is discredited — unless the Shroud is on the
  // table, or a card with SAVING FACE is spent from the hand (the policy picks).
  async credDamage(p, n, why) {
    if (!p.trader) return;
    if (/scandal/i.test(why) && this.is(p, 'bot')) { this.log(`THE BOT has no soul — the Scandal finds nothing to grip`); return; }
    p.trader.credNow = (p.trader.credNow == null ? p.trader.cred : p.trader.credNow) - n;
    this.log(`${p.trader.name} loses ${n} Credibility (${why}) → ${Math.max(0, p.trader.credNow)}/${p.trader.cred}`);
    if (p.trader.credNow <= 0) {
      const shroud = p.artifacts.find((a) => a.key === 'shroud');
      if (shroud) { p.artifacts.splice(p.artifacts.indexOf(shroud), 1); p.discard.push(shroud); p.trader.credNow = Math.min(5, p.trader.cred); this.log(`✝ THE SHROUD is spent — ${p.trader.name} rises again at ${p.name}'s desk with 5 Grace`); }
      else {
        const saviours = p.hand.filter((c) => c.savingGrace);
        const pick = saviours.length ? await p.policy.useSavingGrace(this, p, saviours) : null;
        if (pick && saviours.includes(pick)) { p.hand.splice(p.hand.indexOf(pick), 1); p.discard.push(pick); p.trader.credNow = Math.min(pick.savingGrace, p.trader.cred); p.stats.savingGrace = (p.stats.savingGrace || 0) + 1; this.log(`✝ SAVING FACE — ${p.name} gives up ${pick.name}: ${p.trader.name} stays at the desk with ${p.trader.credNow} Grace`); }
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
        if (eq > 0) { const roll = 1 + Math.floor(this.rng() * 6);
          if (roll <= eq) { p.discard.push(c); this.log(`${t.name} blocked ${c.name}. ${t.trader.name} rolled ${roll} on a d6. Equanimity ${eq} blocks on ${eq} or lower. ${c.name} went to ${p.policy.human ? 'your' : p.name + "’s"} discard pile.`); t.stats.eqSaves = (t.stats.eqSaves || 0) + 1;
            if (this.is(t, 'general')) { this.collect(t, 1); this.log(`FAULT TOLERANCE — ${t.name} collects 1`); } return true; }
          this.log(`the die shows ${roll} against EQUANIMITY ${eq} — ${c.name} lands`); }
        c.owner = p; c.by = p.idx; t.hazards.push(c); p.stats.hazPlayed++;
        this.log(`${p.name} plays ${c.name} on ${t.name}`);
        if (c.key === 'bear') for (const a of [...t.invest]) if (a.perp) { t.invest.splice(t.invest.indexOf(a), 1); t.discard.push(a); this.log(`${t.name}'s ${a.name} is LIQUIDATED by the Bear`); }
        if (c.key === 'escandalo') await this.credDamage(t, 5, 'the SCANDAL breaks');
        break; }
      case 'remedy': {
        if (choice.refresh) { // Horchata: discard up to c.refresh, draw that many plus one
          const picked = (choice.discards || []).filter((x) => x !== c && p.hand.includes(x)).slice(0, c.refresh);
          for (const x of picked) { p.hand.splice(p.hand.indexOf(x), 1); p.discard.push(x); }
          p.discard.push(c); const drawn = []; for (let i = 0; i <= picked.length; i++) { const d = await this.draw(p, true); if (d) drawn.push(d); }
          this.log(`${p.name} drinks ${c.name.toUpperCase()} — lets go of ${picked.length} and draws ${drawn.length}`); break; }
        if (choice.polish) { if (p.trader) { p.trader.credNow = Math.min(p.trader.cred, (p.trader.credNow == null ? p.trader.cred : p.trader.credNow) + 5); this.log(`THE PRESS RELEASE polishes ${p.trader.name} → ${p.trader.credNow}/${p.trader.cred} Grace`); } p.discard.push(c); break; }
        const t = choice.target || p; const h = choice.hazard || t.hazards.find((x) => c.clears === 'any' || x.key === c.clears);
        if (!h) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        const back = c.bounce && h.owner !== t && !this.hasHaz(h.owner, h.key) ? h.owner : null;
        if (back) { this.releaseTrap(t, h); t.hazards.splice(t.hazards.indexOf(h), 1); t.stats.hazCleared++; back.hazards.push(h); this.log(`${p.name} plays ${c.name}: ${h.name} off ${t.name} — kicked back onto ${back.name}`); }
        else this.clearHazard(t, h, p, `${p.name} plays ${c.name}`);
        p.discard.push(c);
        if (t !== p) p.stats.remedyRival++;
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
        this.log(`${p.name} seats ${c.name} at the desk (LIQ ${c.liq} · CRED ${c.credNow} · EQ ${c.eq || 0})`);
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
        if (c.key === 'anima') { const back = [...p.discard].reverse().find((x) => x.type === 'trader'); if (back) { p.discard.splice(p.discard.indexOf(back), 1); back.credNow = Math.min(5, back.cred); if (p.trader) p.hand.push(back); else p.trader = back; this.log(`ÁNIMA SOLA — ${back.name} returns from purgatory to ${p.name}'s ${p.trader === back ? 'desk' : 'hand'} with ${back.credNow} Grace`); } else this.log('ÁNIMA SOLA — nobody to bring back'); }
        if (c.key === 'confession' && p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) { p.trader.credNow = p.trader.cred; this.log(`${p.trader.name} is absolved — Grace restored to ${p.trader.cred}`); }
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
      let roll = 1 + Math.floor(this.rng() * 6); p.stats.sellPros++;
      const need = (a.gambleOn || 5) - (this.is(p, 'abuela') ? 1 : 0);
      if (roll < need && await this.dashboard(p, { kind: 'gamble', name: a.name, roll })) roll = 1 + Math.floor(this.rng() * 6);
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
    for (const a of p.invest) { if (this.hasHaz(p, 'rug') || a.bornTurn === this.turnNo) continue; A.push({ t: 'sell', a, pros: false }); if (a.bearProof || !(this.hasHaz(p, 'bear') && this.saleValue(a) > 75)) A.push({ t: 'sell', a, pros: true }); }
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
      case 'payclear': return this.payClear(p, a.h);
      case 'hail': return this.hailMary(p);
      case 'pass': this.log(`${p.name} passes`); return true;
    }
  }
  async turn(p) {
    p.peekedThisTurn = false; p.buriedThisTurn = false; p.stats.turns++; if (p.hazards.length) p.stats.hazTurns++;
    for (const k of Object.keys(this.fx)) if (this.fx[k].owner === p.idx) { delete this.fx[k]; this.log(`${byKey[k].name} blows over`); }
    // Compound Interest belongs to the active, enabled Trader. Resolve it
    // through bank() so Calamities and the victory check still apply.
    // CLEAN SWEEP (2026-11-16): the cat no longer swats only on arrival. While he sits, each turn
    // starts with a roll — 4+ and he knocks one Calamity off the table (his pick, not yours). It gives
    // him something to do when he opens the game at a clean desk. A Quantum Hack on the seat stops him.
    if (this.is(p, 'gato') && p.hazards.length) { const r = 1 + Math.floor(this.rng() * 6);
      if (r >= 4) this.clearHazard(p, p.hazards[Math.floor(this.rng() * p.hazards.length)], p, `EL GATO rolls ${r} and knocks it off the table`);
      else this.log(`EL GATO rolls ${r} — he only looks at it`); }
    if (this.is(p, 'unicornio') && p.pros >= 100) {
      this.bank(p, 25, 'Compound Interest');
      if (this.over) {
        if (this.hooks && this.hooks.render) await this.hooks.render();
        return;
      }
    }
    if (p.artifacts.some((a) => a.key === 'tattoo') && p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) {
      p.trader.credNow += 1; this.log(`THE TATTOO: ${p.trader.name} regains 1 Credibility → ${p.trader.credNow}/${p.trader.cred}`);
    }
    for (const g of [...p.invest]) if (g.rooster) { const r = 1 + Math.floor(this.rng() * 6);
      if (r === 6) { this.collect(p, 2); this.log(`EL GALLO wins the fight — ${p.name} collects 2`); }
      else if (r === 1) { p.invest.splice(p.invest.indexOf(g), 1); p.discard.push(g); this.log(`EL GALLO rolls a 1 — he is dead, and ${p.name} gets nothing`); }
      else this.log(`EL GALLO rolls ${r} — he lives to fight again`); }
    const ticket = p.artifacts.find((a) => a.key === 'lottery');
    if (ticket) {
      const roll = 1 + Math.floor(this.rng() * 6);
      if (roll < 6) this.log(`${p.name} scratches THE LOTTERY TICKET — the die shows ${roll}: not this time`);
      else if (this.bank(p, 150, 'THE LOTTERY TICKET — the die shows 6: a WINNER')) { p.artifacts.splice(p.artifacts.indexOf(ticket), 1); p.discard.push(ticket); }
      else this.log(`${p.name} scratches THE LOTTERY TICKET — a 6! but the BEAR MARKET caps the prize; the Ticket is held`);
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; }
    }
    if (this.is(p, 'diablito')) {
      if (this.rng() < 0.5) {
        this.collect(p, 1);
        this.log(`DEVIL'S WAGER — heads: ${p.name} collects 1 Liquidity`);
      } else {
        this.log(`DEVIL'S WAGER — tails: El Diablito loses 1 CRED`);
        await this.credDamage(p, 1, "Devil's Wager");
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
      const t = p.trader; const honors = 5 * (t.credNow ?? t.cred);
      this.log(`⚰ ${p.name} buries ${t.name} in LAS CATACUMBAS with honors`); p.trader = null; p.discard.push(t); p.stats.buried = (p.stats.buried || 0) + 1;
      this.bank(p, honors, 'Las Catacumbas');
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; }
    }
    // SEED ROUND: a planted Event blooms after its rounds; a Bear Market holds the harvest until it is cleared.
    for (const sd of [...p.seeds]) { if (this.turnNo - sd.bornTurn < sd.bloom) continue;
      const ok = this.bank(p, this.eventPayout(p, sd), `${sd.name} IN BLOOM` + (p.artifacts.some((a) => a.key === 'geometry') ? ' · SACRED GEOMETRY +25' : ''));
      if (ok) { p.seeds.splice(p.seeds.indexOf(sd), 1); p.discard.push(sd); } else this.log(`${p.name}'s ${sd.name} is in bloom, but the BEAR MARKET holds the harvest`);
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; } }
    const employed = p.trader && this.abilityOn(p);
    const spotless = employed && (p.trader.credNow == null || p.trader.credNow === p.trader.cred);
    this.collect(p, employed ? p.trader.liq + (spotless ? 1 : 0) : 1);
    if (spotless) this.log(`${p.trader.name}'s spotless reputation pays ${p.name} +1`);
    if (!employed) this.log(`${p.name} is between Traders — collects only 1`);
    if (this.hasHaz(p, 'escandalo')) await this.credDamage(p, 2, 'the Scandal grinds on');
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
    if (this.verbose) { this.lines.forEach((l) => console.log(l)); console.log(`END turn ${this.turnNo}: ${this.players.map((q) => `${q.name} ${q.pros}P/${q.liq}L/${q.deeds}d`).join(' · ')}`); }
    return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, turns: this.turnNo,
      players: this.players.map((q) => ({ name: q.name, recipe: q.recipe, trader: q.trader ? q.trader.key : null, starter: q.starter || null, pros: q.pros, ...q.stats })) };
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
  buryTrader(g, p) { const c = p.trader.credNow ?? p.trader.cred; return p.hand.some(c => c.type === 'trader' && g.costOf(p, c) <= p.liq) && (c * 5 >= 60 || g.hasHaz(p, 'escandalo')); }
  useSavingGrace(g, p, cards) { return [...cards].sort((a, b) => b.savingGrace - a.savingGrace)[0]; }
  // Bottoms the weather that would hurt (the Enigma's rule), a Trader when a spare is already affordable, or a card too dear to play soon.
  dueDiligence(g, p, c) {
    if (c.type === 'event' && !c.played) return c.subtype === 'Calamity' || c.subtype === 'Ambiguity';
    if (c.type === 'trader') return !!p.trader && p.hand.some(c => c.type === 'trader' && g.costOf(p, c) <= p.liq);
    if (c.type === 'location') return !!p.location;
    return c.cost > p.liq + 3;
  }
  discardOne(g, p) { const order = { hazard: 0, remedy: 1, artifact: 2, trader: 3, grace: 4, asset: 5, event: 6 } /* an event in hand is a played one */; return [...p.hand].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))[0]; }
  score(g, p, a) {
    const lead = [...g.rivals(p)].sort((x, y) => y.pros - x.pros)[0];
    const winningFaces = g.odds(p); const hailEV = (winningFaces / HAIL_DIE_SIDES) * 200;
    let s = 0;
    if (a.t === 'play' && a.c.type === 'event' && a.c.played) { const ev = g.eventPayout(p, a.c); s = a.choice && a.choice.cash ? (p.liq < 3 ? 60 : 20) : ev - a.c.cost * 5 - (a.c.bloom ? 60 : 0) - (a.c.rivalsCollect ? 8 : 0) + (p.pros + ev >= g.winAt ? 9999 : 0); }
    if (a.t === 'uncork') s = p.deeds === 2 && !p.hailUsed ? 52 : p.deeds < 3 && p.liq >= 4 ? 18 : 0;
    // The Grail is a chase card: the bot holds it for the third candle unless the sale wins the game.
    if (a.t === 'sell' && a.a.gem && a.pros && p.deeds < 3 && p.pros + g.saleValue(a.a) < g.winAt) { s = 6; return s; }
    if (a.t === 'sell') { const pv = g.prosOf(a.a); const sv = g.saleValue(a.a); s = a.pros ? (a.a.gamble ? (p.pros + sv >= g.winAt ? 70 : 34) : sv - 10 + (p.pros + sv >= g.winAt ? 9999 : 0)  - (a.a.bloom && pv < a.a.bloom ? 30 : 0)) : (p.liq <= 2 ? 65 : 25) - (a.a.bloom && pv < a.a.bloom ? 40 : 0); }
    if (a.t === 'play' && a.c.type === 'asset') s = (p.liq >= a.c.cost + 2 ? 55 + a.c.pros / 10 : 30) + (a.c.income ? 16 : 0) + (a.c.bloom ? 8 : 0);
    if (a.t === 'play' && a.c.type === 'hazard') s = (a.choice.target === lead && lead.pros > p.pros ? 70 + lead.pros / 20 : 15) - (a.choice.target.trader ? (a.choice.target.trader.eq || 0) * 4 : 0);
    if (a.t === 'play' && a.c.type === 'remedy') { const mine = a.choice.target === p; s = mine ? 80 : 8; }
    if (a.t === 'play' && a.choice && a.choice.refresh) { const dead = p.hand.filter((c) => c !== a.c && c.type !== 'event' && c.cost > p.liq + 1).slice(0, a.c.refresh); a.choice.discards = dead; s = 28 + 10 * dead.length; }
    if (a.t === 'play' && a.c.type === 'artifact') s = 35;
    if (a.t === 'play' && a.c.type === 'location') s = p.location ? 0 : (p.liq >= a.c.cost + 2 ? 58 : 30); // never tear a standing place down for another
    if (a.t === 'play' && a.c.type === 'grace') s = !p.hailUsed ? 57 - p.deeds * 4 : 2;
    if (a.t === 'play' && a.c.type === 'trader') s = !p.trader ? 72 + a.c.liq * 3 : (p.trader.credNow <= 4 && (a.c.credNow ?? a.c.cred) > p.trader.credNow ? 46 : a.c.liq > p.trader.liq ? 75 : 0); // the bot switches to a better-paid Trader in hand: the stars no longer open at the desk
    if (a.t === 'play' && a.c.key === 'escandalo' && a.choice && !a.choice.target.trader) s = 5;
    if (a.t === 'play' && a.choice && a.choice.polish) s = p.trader && p.trader.credNow <= p.trader.cred - 5 ? 42 : 6;
    if (a.t === 'payclear') s = (p.liq >= 5 ? 66 : 20) + (a.h.key === 'trap' ? (a.h.pile || 0) * 8 : 0);
    if (a.t === 'hail') s = p.pros + 200 >= g.winAt ? (winningFaces >= 3 ? 90 : 30) : winningFaces >= 4 ? 72 : lead && lead.pros >= g.winAt - 150 ? 45 : hailEV / 4;
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
export function playOne({ seed = 1, nPlayers = 3, bots = null, decks = null, starters = null, verbose = false, rotate = 0 }) {
  const kinds = (bots || 'greedy,greedy,greedy,greedy'.split(',').slice(0, nPlayers).join(',')).split(',').slice(0, nPlayers);
  const recs = (decks || 'devotion,degen,devotion,degen').split(',');
  const sts = starters ? starters.split(',') : [];
  const players = kinds.map((k, i) => ({ name: `${k.toUpperCase()} ${'ABCD'[i]}`, recipe: recs[i % recs.length], starter: sts[i] || null, policy: k === 'random' ? new RandomBot(makeRng(seed * 31 + i)) : new GreedyBot() }));
  for (let r = 0; r < rotate; r++) players.push(players.shift());
  return new Game({ players, seed, verbose });
}
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('pt2-sim.js')) {
  const games = +(args.games || 1000); const seed = +(args.seed || 1); const nPlayers = +(args.players || 3);
  if (args.verbose) { await playOne({ seed, nPlayers, bots: args.bots, decks: args.decks, starters: args.starters, verbose: true }).run(); process.exit(0); }
  const res = { wins: {}, recipeWins: {}, recipeGames: {}, seatWins: [0, 0, 0, 0], turns: [], endTrader: {}, startTrader: {}, s: {}, noWin: 0 };
  for (let i = 0; i < games; i++) {
    const r = await playOne({ seed: seed + i, nPlayers, bots: args.bots, decks: args.decks, starters: args.starters, rotate: i % nPlayers }).run();
    for (const p of r.players) res.recipeGames[p.recipe] = (res.recipeGames[p.recipe] || 0) + 1;
    if (!r.winner) { res.noWin++; continue; }
    res.wins[r.winner.replace(/ [A-D]$/, '')] = (res.wins[r.winner.replace(/ [A-D]$/, '')] || 0) + 1;
    const wp = r.players.find((p) => p.name === r.winner); if (wp) res.recipeWins[wp.recipe] = (res.recipeWins[wp.recipe] || 0) + 1;
    res.seatWins[(r.winnerIdx + nPlayers - (i % nPlayers)) % nPlayers]++; res.turns.push(r.turns);
    for (const p of r.players) { const O = res.startTrader[p.starter || 'none'] = res.startTrader[p.starter || 'none'] || { g: 0, w: 0 }; O.g++; if (r.winner === p.name) O.w++; }
    for (const p of r.players) { const T = res.endTrader[p.trader || 'none'] = res.endTrader[p.trader || 'none'] || { g: 0, w: 0 }; T.g++; if (r.winner === p.name) T.w++;
      for (const k of ['hires', 'disgraces', 'sells', 'sellCash', 'sellPros', 'hazPlayed', 'hazCleared', 'remedyRival', 'candles', 'hail', 'hailWon', 'turns', 'hazTurns']) res.s[k] = (res.s[k] || 0) + p[k]; }
  }
  const avg = (x) => (x.reduce((s2, n) => s2 + n, 0) / Math.max(1, x.length)).toFixed(1);
  console.log(`${games} games · ${nPlayers} players · bots ${args.bots || 'greedy all'}`);
  console.log('wins', JSON.stringify(res.wins), '| wins by seat', res.seatWins.slice(0, nPlayers).map((n) => Math.round(n / Math.max(1, games - res.noWin) * 100) + '%').join('/'), '| no winner', res.noWin);
  console.log(`rounds to win avg ${avg(res.turns)} (each player ~that many turns)`);
  console.log('deck recipes:', Object.entries(res.recipeGames).map(([k, g2]) => `${k} wins ${Math.round((res.recipeWins[k] || 0) / Math.max(1, g2) * 100)}% of its seats (${res.recipeWins[k] || 0}/${g2})`).join(' | '));
  const s = res.s; const pg = (k) => (s[k] / games).toFixed(2);
  console.log(`per game (all players): hires ${pg('hires')} disgraces ${pg('disgraces')} sells ${pg('sells')} (cash ${pg('sellCash')} / pros ${pg('sellPros')}) hazards ${pg('hazPlayed')} cleared ${pg('hazCleared')} remedyRival ${pg('remedyRival')} candles ${pg('candles')} hail ${pg('hail')} answered ${pg('hailWon')}`);
  console.log(`hazard-burdened turns: ${Math.round(s.hazTurns / Math.max(1, s.turns) * 100)}% of all turns`);
  console.log('opening Trader (win rate):', Object.entries(res.startTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
  console.log('trader at the desk when the game ended (win rate):', Object.entries(res.endTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
}
