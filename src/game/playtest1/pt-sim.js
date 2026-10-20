#!/usr/bin/env node
// RL80 R-cana — First Playtest (PLAYTEST1.md as a running game).
// 3–4 players, constructed 40-card decks, one main action a turn, race to bank 1,000 Prosperity.
// Liquidity funds plays; Assets sell later for cash or Prosperity; Hazards stick until cleared;
// Remedies, Artifacts (max two equipped); La Ofrenda lights candles at Our Lady's shrine (max three),
// each doubling the one-per-game Hail Mary from 1/12 up to 8/12 — success clears your hazards and banks 200.
//   node pt-sim.js --games 2000 --players 3 --bots greedy,greedy,random
//   node pt-sim.js --verbose --seed 7 --players 3
export function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── The twenty-four designs of the shared starter ──
// Players are symmetric: nobody IS a character. The Traders are cards in the deck,
// lotería style — you hire one as your main action, and only one sits at your desk.
const D = (key, name, type, cost, o = {}) => ({ key, name, type, cost, ...o });
export const DESIGNS = [
  D('unicornio', 'El Unicornio', 'trader', 3, { text: 'At the start of your turn, collect 1 extra Liquidity' }),
  D('gato', 'El Gato', 'trader', 2, { text: 'When seated, immediately knock one hazard off your table, free' }),
  D('monje', 'El Monje', 'trader', 1, { text: 'When you earn a deed, collect 1 Liquidity' }),
  D('diablito', 'El Diablito', 'trader', 2, { text: 'When a hazard you play lands, collect 1 Liquidity' }),
  D('celebridad', 'La Celebridad', 'trader', 3, { text: 'Pay 1 when banking from a card: +25 Prosperity' }),
  D('gr80', 'St. GR80', 'trader', 2, { text: 'When you earn a deed, bank 25 Prosperity' }),
  D('h80z', 'H80Z', 'trader', 2, { text: 'Hazards you play cost 1 less' }),
  D('eugene', 'Eugene', 'trader', 2, { text: 'Your Hail Mary odds rise one step' }),
  D('abuela', 'La Abuela', 'trader', 2, { text: 'Your Remedies cost 1 less' }),
  D('pope', 'The Pope', 'trader', 3, { text: 'Once a game, a failed Hail Mary is absolved — you may attempt it again' }),
  D('prospector', 'The Prospector', 'trader', 2, { text: 'Assets you buy cost 1 less' }),
  D('tech', 'Tech Stock', 'asset', 3, { cash: 5, pros: 100 }),
  D('meme', 'Meme Coin', 'asset', 2, { cash: 4, pros: 75 }),
  D('moon', 'The Moon', 'asset', 4, { cash: 7, pros: 150 }),
  D('shitcoin', 'Shitcoin', 'asset', 1, { cash: 1, pros: 125, gamble: true, text: 'Sell for Prosperity: a die decides — 5+ moons for 125, else zero' }),
  D('bluechip', 'Blue Chip', 'asset', 6, { cash: 10, pros: 250 }),
  D('bull', 'The Bull', 'progress', 2, { pros: 100 }),
  D('rocket', 'Rocket', 'progress', 4, { pros: 200 }),
  D('inherit', 'The Inheritance', 'progress', 0, { cash: 3, pros: 50, choice: true }),
  D('bear', 'The Bear', 'hazard', 2, { text: 'Bank at most 75 Prosperity from a single card' }),
  D('hack', 'Quantum Hack', 'hazard', 2, { text: 'Trader ability disabled' }),
  D('rug', 'Rug Pull', 'hazard', 3, { text: 'Cannot sell Assets' }),
  D('sirena', 'La Sirena', 'hazard', 3, { text: 'The seated Trader walks into the sea; no new hires until cleared' }),
  D('taxman', 'Tax Collector', 'hazard', 2, { text: 'Pay 1 to the bank at the start of each turn' }),
  D('snake', 'The Snake', 'hazard', 3, { text: 'The serpent at the shrine: your candles count as zero' }),
  D('bell', 'The Bell', 'remedy', 1, { clears: 'bear' }),
  D('resist', 'Quantum Resistance', 'remedy', 1, { clears: 'hack' }),
  D('keys', 'The Keys', 'remedy', 1, { clears: 'rug' }),
  D('tortilla', 'Miracle Tortilla', 'remedy', 2, { clears: 'any' }),
  D('heart', 'Sacred Heart', 'artifact', 2, { text: 'Discard to cancel a hazard just played on you' }),
  D('halo', 'The Halo', 'artifact', 3, { text: 'Any Trader seated at your desk cannot be disabled' }),
  D('xray', 'X-Ray Glasses', 'artifact', 2, { text: 'Once a turn, peek at one random rival card' }),
  D('rosary', 'The Rosary Beads', 'artifact', 2, { text: 'When you light a candle, draw a card' }),
  D('grail', 'The Grail', 'artifact', 3, { text: 'An answered Hail Mary banks 300 instead of 200' }),
  D('enigma', 'Enigma Machine', 'artifact', 2, { text: 'Your hand cannot be peeked' }),
  D('ofrenda', 'La Ofrenda', 'grace', 0, { text: 'Offer this card to Our Lady: it goes to the shrine and lights a candle' }),
  D('cherub', 'Raphael’s Cherub', 'grace', 1, { text: 'To the shrine: light a candle, then draw a card' }),
  D('moneda', 'La Moneda', 'asset', 3, { cash: 3, pros: 50, income: 1, text: 'While held: collect 1 Liquidity at the start of your turn' }),
  D('jardin', 'El Jardín', 'asset', 4, { cash: 2, pros: 50, income: 2, text: 'While held: collect 2 a turn — but it dies the moment any Event fires' }),
  D('semilla', 'La Semilla', 'asset', 1, { cash: 1, pros: 25, bloom: 150, text: 'Sell for 25 Prosperity — or hold four rounds and it blooms to 150' }),
  // Events: the market's own voice. They fire the moment they are drawn, hit the whole
  // table, then the drawer draws a replacement card. Nobody chooses an Event.
  D('halving', 'El Halving', 'event', 0, { text: 'Until the drawer’s next turn, turn income is 1' }),
  D('corrida', 'La Corrida', 'event', 0, { text: 'Until the drawer’s next turn, Assets sold for Prosperity pay +25' }),
  D('crash', 'Flash Crash', 'event', 0, { text: 'Everyone holding 8+ Liquidity loses half' }),
  D('airdrop', 'The Airdrop', 'event', 0, { text: 'Every player draws a card' }),
  D('honeymoon', 'Honeymoon', 'event', 0, { text: 'Until the drawer’s next turn, no hazards can be played' }),
  D('ballena', 'La Ballena', 'event', 0, { text: 'The whale surfaces: the richest portfolio’s best Asset moves to the poorest player' }),
  D('rueda', 'La Rueda', 'event', 0, { text: 'Every portfolio rotates one seat' }),
  D('godcandle', 'The God Candle', 'event', 0, { text: 'Until the drawer’s next turn, Prosperity sales pay double' }),
  D('skull', 'The Skull', 'event', 0, { text: 'Exit liquidity: the biggest seller collects 5; everyone else pays 2' }),
  D('world', 'The World', 'event', 0, { text: 'Every standing effect ends, and everyone draws a card' }),
  D('illuminati', 'The Illuminati', 'event', 0, { text: 'Unseen hands: every player passes one random card to the left' }),
];
export const byKey = Object.fromEntries(DESIGNS.map((d) => [d.key, d]));
// Two 40-card starter recipes: Devotion (deeds, remedies, slow money) and Degen
// (hazards, gambles, the Unicorn's compounding). Deck identity is the collectible premise.
export const RECIPES = {
  devotion: [['gr80', 1], ['monje', 1], ['gato', 1], ['abuela', 1], ['celebridad', 1], ['pope', 1],
    ['tech', 1], ['moon', 1], ['bluechip', 1], ['moneda', 2], ['semilla', 1],
    ['bull', 2], ['rocket', 2], ['inherit', 1],
    ['corrida', 1], ['airdrop', 1], ['honeymoon', 1],
    ['bear', 2], ['rug', 1],
    ['bell', 2], ['resist', 2], ['keys', 2], ['tortilla', 2],
    ['heart', 1], ['halo', 1], ['rosary', 1], ['xray', 1], ['grail', 1],
    ['ofrenda', 3], ['cherub', 1]],
  degen: [['h80z', 1], ['diablito', 1], ['eugene', 1], ['unicornio', 1], ['gato', 1], ['prospector', 1],
    ['meme', 1], ['shitcoin', 2], ['tech', 1], ['moon', 1], ['bluechip', 1], ['jardin', 1],
    ['bull', 2], ['rocket', 2], ['inherit', 1],
    ['crash', 1], ['halving', 1], ['ballena', 1], ['rueda', 1], ['godcandle', 1], ['skull', 1], ['illuminati', 1],
    ['bear', 1], ['hack', 1], ['rug', 2], ['sirena', 1], ['taxman', 1], ['snake', 1],
    ['tortilla', 1], ['keys', 1],
    ['heart', 1], ['xray', 1], ['halo', 1], ['enigma', 1],
    ['ofrenda', 2]],
};
export const STARTER = RECIPES.devotion;
export const ODDS = [1, 2, 4, 8]; // twelfths, by recorded deeds (cap 3)

export class Game {
  constructor({ players, seed = 1, verbose = false, winAt = 1000, maxTurns = 300 }) {
    this.rng = makeRng(seed); this.verbose = verbose; this.lines = []; this.winAt = winAt; this.maxTurns = maxTurns;
    this.fx = {}; this.dealing = true;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, trader: null, recipe: cfg.recipe || 'devotion',
      deck: this.shuffle(RECIPES[cfg.recipe || 'devotion'].flatMap(([k, n]) => Array.from({ length: n }, () => ({ ...byKey[k] })))),
      hand: [], discard: [], invest: [], artifacts: [], hazards: [], liq: 5, pros: 0, deeds: 0, hailUsed: false,
      stats: { plays: 0, hires: 0, sells: 0, sellCash: 0, sellPros: 0, hazPlayed: 0, hazCleared: 0, remedyRival: 0, candles: 0, hail: 0, hailWon: 0, passes: 0, discards: 0, turns: 0, hazTurns: 0 } }));
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
    if (c.type === 'event') {
      if (this.dealing) { p.deck.push(c); return this.draw(p, silent); } // no weather before the game starts
      p.discard.push(c); this.event(p, c); return this.draw(p, silent); // the market speaks, then you draw a replacement
    }
    p.hand.push(c); if (!silent) this.log(`${p.name} draws${p.policy && p.policy.human ? ' ' + c.name : ''}`); return c;
  }
  event(p, c) {
    this.log(`✦ EVENT — ${c.name} (drawn by ${p.name}): ${c.text}`);
    for (const q of this.players) for (const a of [...q.invest]) if (a.key === 'jardin') { q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.log(`${q.name}'s EL JARDÍN withers in the weather`); }
    if (c.key === 'halving' || c.key === 'corrida' || c.key === 'honeymoon' || c.key === 'godcandle') this.fx[c.key] = { owner: p.idx };
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
    if (c.key === 'rueda') {
      const n = this.players.length; const invs = this.players.map((q) => q.invest);
      for (let i = 0; i < n; i++) this.players[i].invest = invs[(i + n - 1) % n];
      this.log('LA RUEDA turns — every portfolio rotates one seat');
    }
    if (c.key === 'skull') {
      const top = [...this.players].sort((a2, b2) => b2.stats.sells - a2.stats.sells)[0];
      for (const q of this.players) { if (q === top) { q.liq += 5; this.log(`${q.name} IS the exit liquidity: +5`); } else { const pay = Math.min(2, q.liq); if (pay) { q.liq -= pay; this.log(`${q.name} pays ${pay} on the way out`); } } }
    }
    if (c.key === 'world') { for (const k of Object.keys(this.fx)) { this.log(`${byKey[k].name} blows over`); delete this.fx[k]; } }
    if (c.key === 'illuminati') {
      const n = this.players.length;
      const taken = this.players.map((q) => q.hand.length ? q.hand.splice(Math.floor(this.rng() * q.hand.length), 1)[0] : null);
      for (let i = 0; i < n; i++) if (taken[i]) { const to = this.players[(i + 1) % n]; to.hand.push(taken[i]);
        this.log(`unseen hands move a card from ${this.players[i].name} to ${to.name}${this.players[i].policy.human ? ` (your ${taken[i].name})` : to.policy.human ? ` (${taken[i].name})` : ''}`); }
    }
    if (this.hooks && this.hooks.onEvent) this.hooks.onEvent(p, c);
    if (c.key === 'airdrop' || c.key === 'world') for (const q of this.players) this.draw(q);
  }
  bank(p, n, src, allowBonus = true) {
    if (this.hasHaz(p, 'bear') && src !== 'hail') { if (n > 75) return false; // larger payouts cannot be chosen
      p.pros += n; } else {
      if (allowBonus && this.is(p, 'celebridad') && p.liq >= 1 && src !== 'hail' && !(this.hasHaz(p, 'bear') && n + 25 > 75)) { p.liq -= 1; n += 25; }
      p.pros += n;
    }
    this.log(`${p.name} banks ${n} (${src}) → ${p.pros}`);
    if (p.pros >= this.winAt && !this.over) { this.over = true; this.winner = p; this.log(`*** ${p.name} WINS with ${p.pros} ***`); }
    return true;
  }
  lightCandle(p, why) {
    if (p.deeds >= 3) return false;
    p.deeds += 1; p.stats.candles++;
    if (this.is(p, 'monje')) p.liq += 1;
    if (this.is(p, 'gr80')) this.bank(p, 25, 'St. GR80');
    if (p.artifacts.some((a) => a.key === 'rosary')) this.draw(p);
    this.log(`🕯 ${p.name} lights a candle (${why}) → ${p.deeds} of 3`);
    return true;
  }
  prosOf(a) { return a.bloom && this.turnNo - a.bornTurn >= 4 ? a.bloom : a.pros; }
  clearHazard(victim, h, by, why) {
    victim.hazards.splice(victim.hazards.indexOf(h), 1); h.owner.discard.push(h); victim.stats.hazCleared++;
    this.log(`${why}: ${h.name} off ${victim.name}`);
  }
  spend(p, n) { if (p.liq < n) return false; p.liq -= n; return true; }
  costOf(p, c) { let n = c.cost; if (c.type === 'remedy' && this.is(p, 'abuela')) n = Math.max(0, n - 1); if (c.type === 'hazard' && this.is(p, 'h80z')) n = Math.max(0, n - 1); if (c.type === 'asset' && this.is(p, 'prospector')) n = Math.max(0, n - 1); return n; }
  odds(p) { const lit = this.hasHaz(p, 'snake') ? 0 : p.deeds; return ODDS[Math.min(3, lit + (this.is(p, 'eugene') ? 1 : 0))]; }

  // ── the main actions ──
  async playCard(p, c, choice = {}) {
    const cost = this.costOf(p, c); if (!this.spend(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); p.stats.plays++;
    switch (c.type) {
      case 'asset': c.bornTurn = this.turnNo; p.invest.push(c); this.log(`${p.name} invests in ${c.name}`); break;
      case 'progress': {
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
        if (c.key === 'sirena' && t.trader) { this.log(`${t.trader.name} hears LA SIRENA and walks into the sea`); t.discard.push(t.trader); t.trader = null; }
        break; }
      case 'remedy': {
        const t = choice.target || p; const h = choice.hazard || t.hazards.find((x) => c.clears === 'any' || x.key === c.clears);
        if (!h) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        this.clearHazard(t, h, p, `${p.name} plays ${c.name}`); p.discard.push(c);
        if (t !== p) p.stats.remedyRival++;
        break; }
      case 'artifact': {
        if (p.artifacts.length >= 2) { const drop = choice.drop || p.artifacts[0]; p.artifacts.splice(p.artifacts.indexOf(drop), 1); p.discard.push(drop); this.log(`${p.name} unequips ${drop.name}`); }
        p.artifacts.push(c); this.log(`${p.name} equips ${c.name}`); break; }
      case 'trader': {
        if (p.trader) { p.discard.push(p.trader); this.log(`${p.name} lets ${p.trader.name} go`); }
        p.trader = c; p.stats.hires++; this.log(`${p.name} seats ${c.name} at the desk`);
        if (c.key === 'gato' && p.hazards.length && this.abilityOn(p)) { const h = choice.hazard || p.hazards[0]; this.clearHazard(p, h, p, 'EL GATO knocks it off the table'); }
        break; }
      case 'grace': {
        // the card itself is the offering: it leaves the game for the shrine
        this.log(`${p.name} places ${c.name} at Our Lady’s shrine`);
        this.lightCandle(p, c.name);
        if (c.key === 'cherub') this.draw(p);
        break; }
    }
    return true;
  }
  sell(p, a, wantPros) {
    if (this.hasHaz(p, 'rug')) return false; if (a.bornTurn === this.turnNo) return false;
    p.invest.splice(p.invest.indexOf(a), 1); p.stats.sells++;
    if (wantPros && a.gamble) {
      const roll = 1 + Math.floor(this.rng() * 6); p.stats.sellPros++;
      if (roll >= 5) { const ok = this.bank(p, a.pros * (this.fx.godcandle ? 2 : 1) + (this.fx.corrida ? 25 : 0), `${a.name} — the die shows ${roll}: IT MOONS`); if (!ok) { p.invest.push(a); p.stats.sells--; p.stats.sellPros--; return false; } }
      else { p.discard.push(a); this.log(`${p.name} sells ${a.name}… the die shows ${roll}: it goes to zero`); }
      return true;
    }
    if (wantPros) { const bonus = this.fx.corrida && !this.hasHaz(p, 'bear') ? 25 : 0; const base = this.prosOf(a) * (this.fx.godcandle ? 2 : 1); const ok = this.bank(p, base + bonus, a.name + (a.bloom && base === a.bloom ? ' IN BLOOM' : '') + (bonus ? ' + La Corrida' : '')); if (!ok) { p.invest.push(a); p.stats.sells--; return false; } p.stats.sellPros++; /* banked */ }
    else { p.liq += a.cash; p.discard.push(a); p.stats.sellCash++; this.log(`${p.name} sells ${a.name} for ${a.cash}`); }
    return true;
  }
  payClear(p, h) { if (!this.spend(p, 3)) return false; this.clearHazard(p, h, p, `${p.name} pays 3`); return true; }
  peek(p, t) {
    if (!p.artifacts.some((a) => a.key === 'xray') || p.peekedThisTurn || !t.hand.length || t.artifacts.some((a) => a.key === 'enigma')) return null;
    p.peekedThisTurn = true; const c = t.hand[Math.floor(this.rng() * t.hand.length)];
    this.log(`${p.name} peeks through the X-Ray Glasses at ${t.name}'s hand`);
    return c;
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
      else if (c.type === 'trader') { if (!(p.trader && p.trader.key === c.key) && !this.hasHaz(p, 'sirena')) A.push({ t: 'play', c }); }
      else if (c.type === 'progress') { if (!c.choice) { if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c }); } else { A.push({ t: 'play', c, choice: { cash: true } }); if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c, choice: {} }); } }
      else if (c.type === 'hazard') { if (!this.fx.honeymoon) for (const r of this.rivals(p)) if (!this.hasHaz(r, c.key)) A.push({ t: 'play', c, choice: { target: r } }); }
      else if (c.type === 'remedy') { for (const q of this.players) for (const h of q.hazards) if (c.clears === 'any' || h.key === c.clears) A.push({ t: 'play', c, choice: { target: q, hazard: h } }); }
      else if (c.type === 'grace') { if (p.deeds < 3) A.push({ t: 'play', c }); }
    }
    for (const a of p.invest) { if (this.hasHaz(p, 'rug') || a.bornTurn === this.turnNo) continue; A.push({ t: 'sell', a, pros: false }); if (!(this.hasHaz(p, 'bear') && this.prosOf(a) * (this.fx.godcandle ? 2 : 1) > 75)) A.push({ t: 'sell', a, pros: true }); }
    if (p.liq >= 3) for (const h of p.hazards) A.push({ t: 'payclear', h });
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
      case 'pass': this.log(`${p.name} passes`); return true;
    }
  }
  async turn(p) {
    p.peekedThisTurn = false; p.stats.turns++; if (p.hazards.length) p.stats.hazTurns++;
    for (const k of Object.keys(this.fx)) if (this.fx[k].owner === p.idx) { delete this.fx[k]; this.log(`${byKey[k].name} blows over`); }
    p.liq += this.fx.halving ? 1 : 2;
    if (this.is(p, 'unicornio')) { p.liq += 1; this.log(`${p.name} collects 1 extra (El Unicornio)`); }
    if (this.hasHaz(p, 'taxman') && p.liq > 0) { p.liq -= 1; this.log(`${p.name} pays 1 to the TAX COLLECTOR`); }
    const yield2 = p.invest.reduce((s2, a2) => s2 + (a2.income || 0), 0);
    if (yield2) { p.liq += yield2; this.log(`${p.name} collects ${yield2} from investments`); }
    if (p.policy.beforeDraw) await p.policy.beforeDraw(this, p);
    this.draw(p);
    { const a = await p.policy.main(this, p); await this.act(p, a || { t: 'pass' }); if (this.hooks && this.hooks.onAction) await this.hooks.onAction(p, a || { t: 'pass' }); }
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
  discardOne(g, p) { return p.hand[Math.floor(this.rng() * p.hand.length)]; }
  main(g, p) { const A = g.legalActions(p); return A[Math.floor(this.rng() * A.length)]; }
}
export class GreedyBot {
  constructor() {}
  useHeart() { return true; }
  discardOne(g, p) { const order = { hazard: 0, remedy: 1, artifact: 2, trader: 3, grace: 4, asset: 5, progress: 6 }; return [...p.hand].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))[0]; }
  main(g, p) {
    const A = g.legalActions(p); const lead = [...g.rivals(p)].sort((a, b) => b.pros - a.pros)[0];
    const twelfths = g.odds(p); const hailEV = (twelfths / 12) * 200;
    let best = null, bs = -1;
    for (const a of A) {
      let s = 0;
      if (a.t === 'play' && a.c.type === 'progress') s = a.choice && a.choice.cash ? (p.liq < 3 ? 60 : 20) : a.c.pros - a.c.cost * 5 + (p.pros + a.c.pros >= g.winAt ? 9999 : 0);
      if (a.t === 'sell') { const pv = g.prosOf(a.a); s = a.pros ? (a.a.gamble ? (p.pros + pv >= g.winAt ? 70 : 34) : pv - 10 + (p.pros + pv >= g.winAt ? 9999 : 0) + (g.fx.corrida ? 20 : 0) - (a.a.bloom && pv < a.a.bloom ? 30 : 0)) : (p.liq <= 2 ? 65 : 25); }
      if (a.t === 'play' && a.c.type === 'asset') s = (p.liq >= a.c.cost + 2 ? 55 + a.c.pros / 10 : 30) + (a.c.income ? 16 : 0) + (a.c.bloom ? 8 : 0);
      if (a.t === 'play' && a.c.type === 'hazard') s = a.choice.target === lead && lead.pros > p.pros ? 70 + lead.pros / 20 : 15;
      if (a.t === 'play' && a.c.type === 'remedy') { const mine = a.choice.target === p; s = mine ? 80 : 8; }
      if (a.t === 'play' && a.c.type === 'artifact') s = 35;
      if (a.t === 'play' && a.c.type === 'grace') s = !p.hailUsed ? 57 - p.deeds * 4 : 2;
      if (a.t === 'play' && a.c.type === 'trader') s = p.trader ? 4 : 40 + (a.c.key === 'gato' && p.hazards.length ? 30 : 0) + (a.c.key === 'unicornio' ? 8 : 0);
      if (a.t === 'payclear') s = p.liq >= 5 ? 66 : 20;
      if (a.t === 'hail') s = p.pros + 200 >= g.winAt ? (twelfths >= 4 ? 90 : 30) : twelfths >= 8 ? 72 : lead && lead.pros >= g.winAt - 150 ? 45 : hailEV / 4;
      if (a.t === 'pass') s = 1;
      s += (g.rng ? 0 : 0);
      if (s > bs) { bs = s; best = a; }
    }
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
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('pt-sim.js')) {
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
      for (const k of ['hires', 'sells', 'sellCash', 'sellPros', 'hazPlayed', 'hazCleared', 'remedyRival', 'candles', 'hail', 'hailWon', 'turns', 'hazTurns']) res.s[k] = (res.s[k] || 0) + p[k]; }
  }
  const avg = (x) => (x.reduce((s2, n) => s2 + n, 0) / Math.max(1, x.length)).toFixed(1);
  console.log(`${games} games · ${nPlayers} players · bots ${args.bots || 'greedy all'}`);
  console.log('wins', JSON.stringify(res.wins), '| wins by seat', res.seatWins.slice(0, nPlayers).map((n) => Math.round(n / Math.max(1, games - res.noWin) * 100) + '%').join('/'), '| no winner', res.noWin);
  console.log(`rounds to win avg ${avg(res.turns)} (each player ~that many turns)`);
  console.log('deck recipes:', Object.entries(res.recipeGames).map(([k, g2]) => `${k} wins ${Math.round((res.recipeWins[k] || 0) / Math.max(1, g2) * 100)}% of its seats (${res.recipeWins[k] || 0}/${g2})`).join(' | '));
  const s = res.s; const pg = (k) => (s[k] / games).toFixed(2);
  console.log(`per game (all players): hires ${pg('hires')} sells ${pg('sells')} (cash ${pg('sellCash')} / pros ${pg('sellPros')}) hazards ${pg('hazPlayed')} cleared ${pg('hazCleared')} remedyRival ${pg('remedyRival')} candles ${pg('candles')} hail ${pg('hail')} answered ${pg('hailWon')}`);
  console.log(`hazard-burdened turns: ${Math.round(s.hazTurns / Math.max(1, s.turns) * 100)}% of all turns`);
  console.log('trader at the desk when the game ended (win rate):', Object.entries(res.endTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
}
