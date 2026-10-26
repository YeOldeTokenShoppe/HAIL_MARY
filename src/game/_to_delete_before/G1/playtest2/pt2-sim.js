#!/usr/bin/env node
// RL80 R-cana — Playtest 2: THE TRADING DESK (PLAYTEST2.md).
// Traders carry CRED (durability) and LIQ (your income); one seat + a bench of two,
// one free swap a turn. Scandals drain Grace — disgrace when all is lost. Candles restore it.
// 3–4 players, constructed 40-card decks, one main action a turn, race to bank 1,000 Prosperity.
// Liquidity funds plays; Assets sell later for cash or Prosperity; Hazards stick until cleared;
// Remedies, Artifacts (max two equipped); La Ofrenda lights candles at Our Lady's shrine (max three),
// each doubling the one-per-game Hail Mary from 1/12 up to 8/12 — success clears your hazards and banks 200.
//   node pt-sim.js --games 2000 --players 3 --bots greedy,greedy,random
//   node pt-sim.js --verbose --seed 7 --players 3
export function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── The set's designs live in src/game/rcana/set/designs.js — the one source of truth ──
// pt2-build.js inlines that file here for the browser table; Node imports it directly.
import { DESIGNS } from '../rcana/set/designs.js';
export const byKey = Object.fromEntries(DESIGNS.map((d) => [d.key, d]));
// Two 40-card starter recipes: Devotion (deeds, remedies, slow money) and Degen
// (hazards, gambles, the Unicorn's compounding). Deck identity is the collectible premise.
export const RECIPES = {
  devotion: [['monje', 2], ['gato', 1], ['celebridad', 1], ['pope', 1],
    ['tech', 1], ['collectibles', 1], ['moon', 1], ['bluechip', 1], ['moneda', 2], ['semilla', 1],
    ['bull', 2], ['rocket', 2], ['inherit', 1],
    ['bear', 1], ['rug', 1],
    ['bell', 2], ['resist', 2], ['keys', 2], ['tortilla', 2], ['publicista', 2],
    ['heart', 1], ['halo', 1], ['rosary', 1], ['grail', 1],
    ['ofrenda', 2], ['cherub', 2], ['rose', 2], ['fountain', 1]],
  degen: [['diablito', 2], ['unicornio', 2], ['gato', 1], ['prospector', 1], ['abuela', 1],
    ['meme', 2], ['tech', 1], ['collectibles', 1], ['moon', 1], ['bluechip', 1], ['jardin', 1],
    ['bull', 3], ['rocket', 2], ['inherit', 2],
    ['ballena', 1], ['rueda', 1], ['moralhazard', 1], ['godcandle', 1],
    ['illuminati', 1],
    ['bear', 1], ['hack', 1], ['rug', 1], ['naranja', 1], ['escandalo', 2],
    ['tortilla', 1], ['keys', 1],
    ['heart', 1], ['skull', 1], ['halo', 1], ['enigma', 1],
    ['ofrenda', 2]],
};
export const STARTER = RECIPES.devotion;
export const ODDS = [1, 2, 4, 8, 11]; // twelfths, by recorded deeds (cap 3); the fifth rung is only reached by The Fountain

export class Game {
  constructor({ players, seed = 1, verbose = false, winAt = 1000, maxTurns = 300 }) {
    this.rng = makeRng(seed); this.verbose = verbose; this.lines = []; this.winAt = winAt; this.maxTurns = maxTurns;
    this.fx = {}; this.dealing = true;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, trader: null, bench: [], recipe: cfg.recipe || 'devotion',
      deck: this.shuffle(RECIPES[cfg.recipe || 'devotion'].flatMap(([k, n]) => Array.from({ length: n }, () => ({ ...byKey[k] })))),
      hand: [], discard: [], invest: [], artifacts: [], hazards: [], liq: 5, pros: 0, deeds: 0, hailUsed: false,
      stats: { plays: 0, hires: 0, disgraces: 0, sells: 0, sellCash: 0, sellPros: 0, hazPlayed: 0, hazCleared: 0, remedyRival: 0, candles: 0, hail: 0, hailWon: 0, passes: 0, discards: 0, turns: 0, hazTurns: 0 } }));
    for (const p of this.players) for (let i = 0; i < 5; i++) this.draw(p, true);
    this.dealing = false;
    this.turnNo = 0; this.over = false; this.winner = null;
  }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  log(t) { if (this.verbose) this.lines.push(`[T${this.turnNo}] ${t}`); }
  rivals(p) { return this.players.filter((q) => q !== p); }
  abilityOn(p) { return !(p.hazards.some((h) => h.key === 'hack') && !p.artifacts.some((a) => a.key === 'halo')); }
  is(p, key) { return !!p.trader && p.trader.key === key && this.abilityOn(p); }
  hasHaz(p, key) { return p.hazards.some((h) => h.key === key); }
  draw(p, silent = false) {
    if (!p.deck.length && p.discard.length) { p.deck = this.shuffle(p.discard.splice(0)); this.log(`${p.name} reshuffles`); }
    const c = p.deck.shift(); if (!c) return null;
    if (c.type === 'event' && !c.played) {
      if (this.dealing) { p.deck.push(c); return this.draw(p, silent); } // no weather before the game starts
      p.discard.push(c); this.event(p, c); return this.draw(p, silent); // the market speaks, then you draw a replacement
    }
    p.hand.push(c); if (!silent) this.log(`${p.name} draws${p.policy && p.policy.human ? ' ' + c.name : ''}`); return c;
  }
  event(p, c) {
    this.log(`✦ EVENT — ${c.name} (drawn by ${p.name}): ${c.text}`);
    for (const q of this.players) for (const a of [...q.invest]) if (a.key === 'jardin') { q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.log(`${q.name}'s YIELD FARM is wiped by the weather`); }
    if (c.key === 'godcandle') this.fx[c.key] = { owner: p.idx };
    if (c.key === 'crash') for (const q of this.players) if (q.liq >= 8) { const lost = Math.floor(q.liq / 2); q.liq -= lost; this.log(`${q.name} loses ${lost} Liquidity in the crash`); }
    if (c.key === 'ballena') {
      const worth = (q) => q.invest.reduce((s2, a2) => s2 + this.prosOf(a2), 0);
      const sorted = [...this.players].sort((a2, b2) => worth(b2) - worth(a2));
      const rich = sorted[0], poor = sorted[sorted.length - 1];
      if (rich !== poor && rich.invest.length && worth(rich) > worth(poor)) {
        const best = [...rich.invest].sort((a2, b2) => this.prosOf(b2) - this.prosOf(a2))[0];
        rich.invest.splice(rich.invest.indexOf(best), 1); poor.invest.push(best);
        this.log(`THE WHALE moves ${best.name} from ${rich.name} to ${poor.name}`);
      }
    }
    if (c.key === 'moralhazard') {
      const byLiq = [...this.players].sort((a2, b2) => a2.liq - b2.liq);
      const poor = byLiq[0], rich = byLiq[byLiq.length - 1];
      if (poor !== rich && rich.liq > poor.liq) { poor.liq += 5; rich.liq = Math.max(0, rich.liq - 2); this.log(`TOO BIG TO FAIL: ${poor.name} is bailed out (+5); ${rich.name} pays for prudence (-2)`); }
    }
    if (c.key === 'rueda') {
      const n = this.players.length; const invs = this.players.map((q) => q.invest);
      for (let i = 0; i < n; i++) this.players[i].invest = invs[(i + n - 1) % n];
      this.log('LA RUEDA turns — every portfolio rotates one seat');
    }
    if (c.key === 'moneda') { for (const q of this.players) { q.liq += 2; } this.log('PAY DAY — every player collects 2'); }
    if (c.key === 'world') { for (const k of Object.keys(this.fx)) { this.log(`${byKey[k].name} blows over`); delete this.fx[k]; } }
    if (this.hooks && this.hooks.onEvent) this.hooks.onEvent(p, c);
    if (c.key === 'world') for (const q of this.players) this.draw(q);
  }
  bank(p, n, src, allowBonus = true, bearProof = false) {
    if (this.hasHaz(p, 'bear') && src !== 'hail' && !bearProof) { if (n > 75) return false; // larger payouts cannot be chosen
      p.pros += n; } else {
      if (allowBonus && this.is(p, 'celebridad') && p.liq >= 1 && src !== 'hail' && !(this.hasHaz(p, 'bear') && n + 25 > 75)) { p.liq -= 1; n += 25; }
      p.pros += n;
    }
    this.log(`${p.name} banks ${n} (${src}) → ${p.pros}`);
    if (src !== 'hail') { const nj = p.hazards.find((h) => h.key === 'naranja'); if (nj && nj.owner && nj.owner !== p) { nj.owner.liq += 2; this.log(`EL NARANJA takes his cut: ${nj.owner.name} collects 2`); } }
    if (p.pros >= this.winAt && !this.over) { this.over = true; this.winner = p; this.log(`*** ${p.name} WINS with ${p.pros} ***`); }
    return true;
  }
  lightCandle(p, why) {
    if (p.deeds >= 3) return false;
    p.deeds += 1; p.stats.candles++;
    if (this.is(p, 'monje')) this.bank(p, 25, 'El Monje');
    if (p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) { p.trader.credNow = Math.min(p.trader.cred, p.trader.credNow + 3); this.log(`the candlelight restores ${p.trader.name} → ${p.trader.credNow}/${p.trader.cred} Grace`); }
    if (p.artifacts.some((a) => a.key === 'rosary')) this.draw(p);
    this.log(`🕯 ${p.name} lights a candle (${why}) → ${p.deeds} of 3`);
    return true;
  }
  credDamage(p, n, why) {
    if (!p.trader) return;
    p.trader.credNow = (p.trader.credNow == null ? p.trader.cred : p.trader.credNow) - n;
    this.log(`${p.trader.name} loses ${n} Grace (${why}) → ${Math.max(0, p.trader.credNow)}/${p.trader.cred}`);
    if (p.trader.credNow <= 0) {
      const shroud = p.artifacts.find((a) => a.key === 'shroud');
      if (shroud) { p.artifacts.splice(p.artifacts.indexOf(shroud), 1); p.discard.push(shroud); p.trader.credNow = Math.min(5, p.trader.cred); this.log(`✝ THE SHROUD is spent — ${p.trader.name} rises again at ${p.name}'s desk with 5 Grace`); }
      else { this.log(`☠ ${p.trader.name} is DISGRACED and leaves ${p.name}'s desk`); p.discard.push(p.trader); p.trader = null; p.stats.disgraces++; }
    }
  }
  prosOf(a) { if (a.bloom && this.turnNo - a.bornTurn >= 4) return a.bloom; if (a.grow) return a.pros + a.grow * Math.max(0, Math.floor((this.turnNo - a.bornTurn) / this.players.length)); return a.pros; }
  clearHazard(victim, h, by, why) {
    victim.hazards.splice(victim.hazards.indexOf(h), 1); h.owner.discard.push(h); victim.stats.hazCleared++;
    this.log(`${why}: ${h.name} off ${victim.name}`);
  }
  spend(p, n) { if (p.liq < n) return false; p.liq -= n; return true; }
  costOf(p, c) { let n = c.cost; if (c.type === 'asset' && this.is(p, 'prospector')) n = Math.max(0, n - 1); return n; }
  odds(p) { const lit = Math.min(3, p.deeds); return ODDS[Math.min(ODDS.length - 1, lit + (p.fountain || 0))]; }

  // ── the main actions ──
  async playCard(p, c, choice = {}) {
    const cost = this.costOf(p, c); if (!this.spend(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); p.stats.plays++;
    switch (c.type) {
      case 'asset': c.bornTurn = this.turnNo; p.invest.push(c); this.log(`${p.name} invests in ${c.name}`); break;
      case 'event': { // a played Event (The Bull, Rocket, The Inheritance); fired ones never reach a hand
        if (c.choice && choice.cash) { p.liq += c.cash; p.discard.push(c); this.log(`${p.name} cashes ${c.name} for ${c.cash}`); }
        else { const ok = this.bank(p, c.pros, c.name); if (!ok) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; } /* banked cards leave the deck */ }
        break; }
      case 'hazard': {
        const t = choice.target; if (!t || this.hasHaz(t, c.key)) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        // reaction: Sacred Heart
        const heart = t.artifacts.find((a) => a.key === 'heart');
        if (heart && await t.policy.useHeart(this, t, c, p)) { t.artifacts.splice(t.artifacts.indexOf(heart), 1); t.discard.push(heart); p.discard.push(c); this.log(`${t.name}'s SACRED HEART cancels ${c.name}`); return true; }
        c.owner = p; c.by = p.idx; t.hazards.push(c); p.stats.hazPlayed++;
        if (this.is(p, 'diablito')) p.liq += 1;
        this.log(`${p.name} plays ${c.name} on ${t.name}`);
        if (c.key === 'escandalo') this.credDamage(t, 5, 'EL ESCÁNDALO breaks');
        break; }
      case 'remedy': {
        if (choice.polish) { if (p.trader) { p.trader.credNow = Math.min(p.trader.cred, (p.trader.credNow == null ? p.trader.cred : p.trader.credNow) + 5); this.log(`EL PUBLICISTA polishes ${p.trader.name} → ${p.trader.credNow}/${p.trader.cred} Grace`); } p.discard.push(c); break; }
        const t = choice.target || p; const h = choice.hazard || t.hazards.find((x) => c.clears === 'any' || x.key === c.clears);
        if (!h) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        this.clearHazard(t, h, p, `${p.name} plays ${c.name}`); p.discard.push(c);
        if (t !== p) p.stats.remedyRival++;
        break; }
      case 'artifact': {
        if (p.artifacts.length >= 2) { const drop = choice.drop || p.artifacts[0]; p.artifacts.splice(p.artifacts.indexOf(drop), 1); p.discard.push(drop); this.log(`${p.name} unequips ${drop.name}`); }
        p.artifacts.push(c); this.log(`${p.name} equips ${c.name}`); break; }
      case 'trader': {
        c.credNow = c.cred; p.stats.hires++;
        if (!p.trader) { p.trader = c; this.log(`${p.name} seats ${c.name} at the desk (LIQ ${c.liq} · GRACE ${c.cred})`);
          if (c.key === 'gato' && p.hazards.length && this.abilityOn(p)) { const h = choice.hazard || p.hazards[0]; this.clearHazard(p, h, p, 'EL GATO knocks it off the table'); }
          if (c.key === 'illuminati' && this.abilityOn(p)) for (const q of this.players) if (q !== p && q.hand.length) { const t = q.hand.splice(Math.floor(this.rng() * q.hand.length), 1)[0]; p.hand.push(t); this.log(`unseen hands move a card from ${q.name} to ${p.name}${q.policy.human ? ` (your ${t.name})` : p.policy.human ? ` (${t.name})` : ''}`); } }
        else { p.bench.push(c); this.log(`${c.name} joins ${p.name}'s bench`); }
        break; }
      case 'grace': {
        if (c.key === 'rose') {
          const t = choice.target; if (!t) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
          this.log(`${p.name} offers THE ROSE to ${t.name}`);
          if (await t.policy.acceptRose(this, t, p)) { c.bornTurn = this.turnNo; t.invest.push(c); this.log(`${t.name} accepts the Rose`); this.lightCandle(p, 'the Rose, accepted'); }
          else { p.hand.push(c); this.log(`${t.name} declines the Rose`); }
          break; }
        if (c.key === 'fountain') { p.fountain = (p.fountain || 0) + 1; this.log(`${p.name} tosses a coin in THE FOUNTAIN — Hail Mary odds rise to ${this.odds(p)}/12`); break; }
        // the card itself is the offering: it leaves the game for the shrine
        this.log(`${p.name} places ${c.name} at Our Lady’s shrine`);
        this.lightCandle(p, c.name);
        if (c.key === 'cherub') this.draw(p);
        if (c.key === 'confession' && p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) { p.trader.credNow = p.trader.cred; this.log(`${p.trader.name} is absolved — Grace restored to ${p.trader.cred}`); }
        break; }
    }
    return true;
  }
  sell(p, a, wantPros) {
    if (this.hasHaz(p, 'rug')) return false; if (a.bornTurn === this.turnNo) return false;
    p.invest.splice(p.invest.indexOf(a), 1); p.stats.sells++;
    for (const q of this.players) if (q !== p && q.artifacts.some((x) => x.key === 'skull')) { q.liq += 1; this.log(`${q.name} holds THE SKULL: +1 from ${p.name}'s sale`); }
    if (wantPros && a.gamble) {
      const roll = 1 + Math.floor(this.rng() * 6); p.stats.sellPros++;
      const need = (a.gambleOn || 5) - (this.is(p, 'abuela') ? 1 : 0);
      if (roll >= need) { const ok = this.bank(p, a.pros * (this.fx.godcandle ? 2 : 1), `${a.name} — the die shows ${roll}: IT ${a.gambleOn ? 'GUSHES' : 'MOONS'}`); if (!ok) { p.invest.push(a); p.stats.sells--; p.stats.sellPros--; return false; } }
      else if (a.bust) { p.discard.push(a); this.bank(p, a.bust, `${a.name} — the die shows ${roll}: it runs dry`); }
      else { p.discard.push(a); this.log(`${p.name} sells ${a.name}… the die shows ${roll}: it goes to zero`); }
      return true;
    }
    if (wantPros) { const bonus = 0; const base = this.prosOf(a) * (this.fx.godcandle ? 2 : 1); const ok = this.bank(p, base + bonus, a.name + (a.bloom && base === a.bloom ? ' IN BLOOM' : ''), true, !!a.bearProof); if (!ok) { p.invest.push(a); p.stats.sells--; return false; } p.stats.sellPros++; /* banked */ }
    else { p.liq += a.cash; p.discard.push(a); p.stats.sellCash++; this.log(`${p.name} sells ${a.name} for ${a.cash}`); }
    if (a.key === 'map') { this.draw(p); this.draw(p); this.log(`${p.name} follows THE TREASURE MAP and draws 2`); }
    return true;
  }
  payClear(p, h) { if (!this.spend(p, 3)) return false; this.clearHazard(p, h, p, `${p.name} pays 3`); return true; }
  // The Enigma Machine: once a turn, free, discard up to three cards and draw
  // as many. Returns the cards drawn, or null if it cannot be used.
  enigma(p, cards) {
    if (!p.artifacts.some((a) => a.key === 'enigma') || p.enigmaUsed || !cards || !cards.length) return null;
    const picked = cards.filter((c) => p.hand.includes(c)).slice(0, 3); if (!picked.length) return null;
    p.enigmaUsed = true;
    for (const c of picked) { p.hand.splice(p.hand.indexOf(c), 1); p.discard.push(c); }
    const drawn = []; for (let i = 0; i < picked.length; i++) { const d = this.draw(p, true); if (d) drawn.push(d); }
    this.log(`${p.name} feeds ${picked.length} card${picked.length === 1 ? '' : 's'} to the ENIGMA MACHINE and draws ${drawn.length}`);
    return drawn;
  }
  hailMary(p) {
    p.hailUsed = true; p.stats.hail++; const twelfths = this.odds(p);
    const roll = 1 + Math.floor(this.rng() * 12); const ok = roll <= twelfths;
    this.log(`✝ ${p.name} attempts the HAIL MARY at ${twelfths}/12 with ${p.deeds} candle${p.deeds === 1 ? '' : 's'}… the die shows ${roll}: ${ok ? 'ANSWERED' : 'unanswered'}`);
    if (ok) { for (const h of [...p.hazards]) this.clearHazard(p, h, p, 'grace'); p.stats.hailWon++; this.bank(p, p.artifacts.some((a) => a.key === 'grail') ? 300 : 200, 'hail'); }
    else if (this.is(p, 'pope') && !p.popeUsed) { p.popeUsed = true; p.hailUsed = false; this.log('THE POPE absolves the attempt — Our Lady may be petitioned once more'); }
    return ok;
  }

  legalActions(p) {
    const A = [];
    for (const c of p.hand) {
      const cost = this.costOf(p, c); if (p.liq < cost) continue;
      if (c.type === 'asset' || c.type === 'artifact') A.push({ t: 'play', c });
      else if (c.type === 'trader') { if (!p.trader || p.bench.length < 2) A.push({ t: 'play', c }); }
      else if (c.type === 'event' && c.played) { if (this.hasHaz(p, 'scam')) continue; if (!c.choice) { if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c }); } else { A.push({ t: 'play', c, choice: { cash: true } }); if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c, choice: {} }); } }
      else if (c.type === 'hazard') { for (const r of this.rivals(p)) if (!this.hasHaz(r, c.key)) A.push({ t: 'play', c, choice: { target: r } }); }
      else if (c.type === 'remedy') { for (const q of this.players) for (const h of q.hazards) if (c.clears === 'any' || h.key === c.clears) A.push({ t: 'play', c, choice: { target: q, hazard: h } }); if (c.key === 'publicista' && p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) A.push({ t: 'play', c, choice: { polish: true } }); }
      else if (c.type === 'grace') { if (c.key === 'fountain') { if (!p.hailUsed) A.push({ t: 'play', c }); } else if (p.deeds < 3) { if (c.key === 'rose') { for (const r of this.rivals(p)) A.push({ t: 'play', c, choice: { target: r } }); } else A.push({ t: 'play', c }); } }
    }
    for (const a of p.invest) { if (this.hasHaz(p, 'rug') || a.bornTurn === this.turnNo) continue; A.push({ t: 'sell', a, pros: false }); if (a.bearProof || !(this.hasHaz(p, 'bear') && this.prosOf(a) * (this.fx.godcandle ? 2 : 1) > 75)) A.push({ t: 'sell', a, pros: true }); }
    if (p.liq >= 3) for (const h of p.hazards) A.push({ t: 'payclear', h });
    if (!p.swapUsed) for (let i = 0; i < p.bench.length; i++) A.push({ t: 'swap', i });
    if (!p.hailUsed) A.push({ t: 'hail' });
    A.push({ t: 'pass' });
    return A;
  }
  async act(p, a) {
    switch (a.t) {
      case 'play': return this.playCard(p, a.c, a.choice || {});
      case 'sell': return this.sell(p, a.a, a.pros);
      case 'payclear': return this.payClear(p, a.h);
      case 'hail': return this.hailMary(p);
      case 'swap': { p.swapUsed = true; const b = p.bench[a.i];
        if (p.trader) { p.bench[a.i] = p.trader; this.log(`${p.name} swaps: ${b.name} takes the seat, ${p.trader.name} to the bench`); p.trader = b; }
        else { p.bench.splice(a.i, 1); p.trader = b; this.log(`${p.name} promotes ${b.name} from the bench`); }
        return true; }
      case 'pass': this.log(`${p.name} passes`); return true;
    }
  }
  async turn(p) {
    p.peekedThisTurn = false; p.enigmaUsed = false; p.stats.turns++; if (p.hazards.length) p.stats.hazTurns++;
    for (const k of Object.keys(this.fx)) if (this.fx[k].owner === p.idx) { delete this.fx[k]; this.log(`${byKey[k].name} blows over`); }
    p.swapUsed = false;
    const employed = p.trader && this.abilityOn(p);
    const spotless = employed && (p.trader.credNow == null || p.trader.credNow === p.trader.cred);
    p.liq += employed ? p.trader.liq + (spotless ? 1 : 0) : 1;
    if (spotless) this.log(`${p.trader.name}'s spotless reputation pays ${p.name} +1`);
    if (!employed) this.log(`${p.name} is between Traders — collects only 1`);
    if (this.hasHaz(p, 'escandalo')) this.credDamage(p, 2, 'the Scandal grinds on');
    if (!p.policy.human && p.artifacts.some((a) => a.key === 'enigma')) {
      // A bot feeds the machine whatever it cannot afford this turn.
      const dead = p.hand.filter((c) => c.type !== 'event' && c.cost > p.liq + 1).slice(0, 3);
      if (dead.length) this.enigma(p, dead);
    }
    if (this.hasHaz(p, 'taxman') && p.liq > 0) { p.liq -= 1; this.log(`${p.name} pays 1 to the TAX COLLECTOR`); }
    const yield2 = p.invest.reduce((s2, a2) => s2 + (a2.income || 0), 0);
    if (yield2) { p.liq += yield2; this.log(`${p.name} collects ${yield2} from investments`); }
    if (p.policy.beforeDraw) await p.policy.beforeDraw(this, p);
    this.draw(p);
    let guard = 0; while (guard++ < 4) { const a = await p.policy.main(this, p); const kind = a ? a.t : 'pass'; await this.act(p, a || { t: 'pass' }); if (this.hooks && this.hooks.onAction) await this.hooks.onAction(p, a || { t: 'pass' }); if (kind !== 'swap' || this.over) break; }
    while (p.hand.length > 7) { const d = await p.policy.discardOne(this, p); p.hand.splice(p.hand.indexOf(d), 1); p.discard.push(d); p.stats.discards++; }
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  async run() {
    while (!this.over && this.turnNo < this.maxTurns) { this.turnNo++; for (const p of this.players) { if (this.over) break; this.active = p; if (this.hooks && this.hooks.render) await this.hooks.render(); await this.turn(p); } }
    if (this.verbose) { this.lines.forEach((l) => console.log(l)); console.log(`END turn ${this.turnNo}: ${this.players.map((q) => `${q.name} ${q.pros}P/${q.liq}L/${q.deeds}d`).join(' · ')}`); }
    return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, turns: this.turnNo,
      players: this.players.map((q) => ({ name: q.name, recipe: q.recipe, trader: q.trader ? q.trader.key : null, pros: q.pros, ...q.stats })) };
  }
}

// ── policies ──
export class RandomBot {
  constructor(rng) { this.rng = rng; }
  useHeart() { return this.rng() < 0.5; }
  acceptRose() { return this.rng() < 0.6; }
  discardOne(g, p) { return p.hand[Math.floor(this.rng() * p.hand.length)]; }
  main(g, p) { const A = g.legalActions(p); return A[Math.floor(this.rng() * A.length)]; }
}
export class GreedyBot {
  constructor() {}
  useHeart() { return true; }
  acceptRose() { return true; }
  discardOne(g, p) { const order = { hazard: 0, remedy: 1, artifact: 2, trader: 3, grace: 4, asset: 5, event: 6 } /* an event in hand is a played one */; return [...p.hand].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))[0]; }
  score(g, p, a) {
    const lead = [...g.rivals(p)].sort((x, y) => y.pros - x.pros)[0];
    const twelfths = g.odds(p); const hailEV = (twelfths / 12) * 200;
    let s = 0;
    if (a.t === 'play' && a.c.type === 'event' && a.c.played) s = a.choice && a.choice.cash ? (p.liq < 3 ? 60 : 20) : a.c.pros - a.c.cost * 5 + (p.pros + a.c.pros >= g.winAt ? 9999 : 0);
    if (a.t === 'sell') { const pv = g.prosOf(a.a); s = a.pros ? (a.a.gamble ? (p.pros + pv >= g.winAt ? 70 : 34) : pv - 10 + (p.pros + pv >= g.winAt ? 9999 : 0)  - (a.a.bloom && pv < a.a.bloom ? 30 : 0)) : (p.liq <= 2 ? 65 : 25) - (a.a.bloom && pv < a.a.bloom ? 40 : 0); }
    if (a.t === 'play' && a.c.type === 'asset') s = (p.liq >= a.c.cost + 2 ? 55 + a.c.pros / 10 : 30) + (a.c.income ? 16 : 0) + (a.c.bloom ? 8 : 0);
    if (a.t === 'play' && a.c.type === 'hazard') s = a.choice.target === lead && lead.pros > p.pros ? 70 + lead.pros / 20 : 15;
    if (a.t === 'play' && a.c.type === 'remedy') { const mine = a.choice.target === p; s = mine ? 80 : 8; }
    if (a.t === 'play' && a.c.type === 'artifact') s = 35;
    if (a.t === 'play' && a.c.type === 'grace') s = !p.hailUsed ? 57 - p.deeds * 4 : 2;
    if (a.t === 'play' && a.c.type === 'trader') s = !p.trader ? 72 + a.c.liq * 3 : (p.bench.length < 2 ? 26 + a.c.liq * 3 : 4);
    if (a.t === 'swap') { const b = p.bench[a.i]; s = !p.trader ? 85 : (p.trader.credNow != null && p.trader.credNow <= 4 && b.credNow > p.trader.credNow ? 46 : 3); }
    if (a.t === 'play' && a.c.key === 'escandalo' && a.choice && !a.choice.target.trader) s = 5;
    if (a.t === 'play' && a.choice && a.choice.polish) s = p.trader && p.trader.credNow <= p.trader.cred - 5 ? 42 : 6;
    if (a.t === 'payclear') s = p.liq >= 5 ? 66 : 20;
    if (a.t === 'hail') s = p.pros + 200 >= g.winAt ? (twelfths >= 4 ? 90 : 30) : twelfths >= 8 ? 72 : lead && lead.pros >= g.winAt - 150 ? 45 : hailEV / 4;
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
export function playOne({ seed = 1, nPlayers = 3, bots = null, decks = null, verbose = false, rotate = 0 }) {
  const kinds = (bots || 'greedy,greedy,greedy,greedy'.split(',').slice(0, nPlayers).join(',')).split(',').slice(0, nPlayers);
  const recs = (decks || 'devotion,degen,devotion,degen').split(',');
  const players = kinds.map((k, i) => ({ name: `${k.toUpperCase()} ${'ABCD'[i]}`, recipe: recs[i % recs.length], policy: k === 'random' ? new RandomBot(makeRng(seed * 31 + i)) : new GreedyBot() }));
  for (let r = 0; r < rotate; r++) players.push(players.shift());
  return new Game({ players, seed, verbose });
}
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('pt2-sim.js')) {
  const games = +(args.games || 1000); const seed = +(args.seed || 1); const nPlayers = +(args.players || 3);
  if (args.verbose) { await playOne({ seed, nPlayers, bots: args.bots, decks: args.decks, verbose: true }).run(); process.exit(0); }
  const res = { wins: {}, recipeWins: {}, recipeGames: {}, seatWins: [0, 0, 0, 0], turns: [], endTrader: {}, s: {}, noWin: 0 };
  for (let i = 0; i < games; i++) {
    const r = await playOne({ seed: seed + i, nPlayers, bots: args.bots, decks: args.decks, rotate: i % nPlayers }).run();
    for (const p of r.players) res.recipeGames[p.recipe] = (res.recipeGames[p.recipe] || 0) + 1;
    if (!r.winner) { res.noWin++; continue; }
    res.wins[r.winner.replace(/ [A-D]$/, '')] = (res.wins[r.winner.replace(/ [A-D]$/, '')] || 0) + 1;
    const wp = r.players.find((p) => p.name === r.winner); if (wp) res.recipeWins[wp.recipe] = (res.recipeWins[wp.recipe] || 0) + 1;
    res.seatWins[(r.winnerIdx + nPlayers - (i % nPlayers)) % nPlayers]++; res.turns.push(r.turns);
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
  console.log('trader at the desk when the game ended (win rate):', Object.entries(res.endTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
}
