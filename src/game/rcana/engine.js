// RL80 R-cana rules engine (draft v4 + Villains). Deterministic given a seed.
// Works in Node and the browser. Policies (bots) live in bots.js and drive the
// main phase through game.actions(p) / game.act(p, action).
import { MAJORS } from './cards.js';

export const WIN_BANK = 80;
export const MAX_ROUNDS = 40;

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const baseName = (n) => n.split(',')[0].trim();
let UID = 1;

export class Game {
  constructor({ players, rcana, seed = 1, snapshots = true }) {
    this.rng = makeRng(seed);
    this.seed = seed;
    this.snapshotsOn = snapshots;
    this.players = players.map((cfg, idx) => ({
      idx, name: cfg.name || cfg.trader.name, trader: cfg.trader, policy: cfg.policy,
      deck: [...cfg.deck], hand: [], discard: [], reserve: [], floor: [],
      portfolio: 0, bank: 0, tokens: { attention: 0, data: 0, credibility: 0 },
      traderLocked: false, hailMaryUsed: false, reservedThisTurn: 0,
      turnTemp: this.freshTurnTemp(), temp: {}, known: {}, stats: { worked: 0, played: 0, hedged: 0, liquidated: 0, frontrun: 0 },
    }));
    this.rcanaDeck = [...rcana];
    this.rcanaDiscard = [];
    this.market = null; this.omen = null; this.providence = null;
    this.round = 0; this.turnIdx = 0; this.turnCounter = 1; this.active = null;
    this.finalBellRound = null; this.over = false; this.winner = null; this.reason = '';
    this.noCalamityUntil = null; this.current = null;
    this.events = []; this.snapshots = []; this.cardPlays = {};
    this.setup();
  }

  freshTurnTemp() { return { liquidity: 0, interestDiv: null, degenFast: false, gambled: false, freeConsultUsed: false, invoked: false }; }

  // ─────────── setup ───────────
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  setup() {
    this.shuffle(this.rcanaDeck);
    const skipped = [];
    while (this.rcanaDeck.length && !this.market) {
      const c = this.rcanaDeck.shift();
      if (c.type === 'market') this.market = c; else skipped.push(c);
    }
    this.rcanaDeck.push(...skipped);
    this.omen = this.rcanaDeck.shift() || null;
    this.log(`Opening Market: ${this.market ? this.market.name : 'none'}`);
    for (const p of this.players) {
      this.shuffle(p.deck);
      for (let i = 0; i < 8; i++) if (p.deck.length) p.hand.push(p.deck.shift());
      if (p.policy.mulligan) {
        const back = p.policy.mulligan(this, p) || [];
        if (back.length) {
          back.forEach((c) => { p.hand.splice(p.hand.indexOf(c), 1); p.deck.push(c); });
          while (p.hand.length < 8 && p.deck.length) p.hand.push(p.deck.shift());
          this.shuffle(p.deck);
          this.log(`${p.name} mulligans ${back.length}`);
        }
      }
    }
    this.snapshot('setup');
  }

  // ─────────── logging / snapshots ───────────
  log(text) { this.events.push(`${this.active ? `[R${this.round} ${this.active.name}] ` : '[setup] '}${text}`); }
  snapshot(label) {
    if (!this.snapshotsOn) { this.events = []; return; }
    const snap = {
      label, round: this.round, active: this.active ? this.active.name : null, finalBell: this.finalBellRound,
      market: this.market ? this.market.name : null, omen: this.omen ? this.omen.name : null, providence: this.providence ? this.providence.name : null,
      rcanaLeft: this.rcanaDeck.length, over: this.over, winner: this.winner ? this.winner.name : null, reason: this.reason,
      players: this.players.map((p) => ({
        name: p.name, trader: p.trader.name, bank: p.bank, portfolio: p.portfolio, tokens: { ...p.tokens },
        hand: p.hand.map((c) => c.name), deck: p.deck.length, discard: p.discard.length, traderLocked: p.traderLocked,
        reserve: p.reserve.length, locked: p.reserve.filter((r) => r.locked).length, knowsOmen: !!p.known.omen,
        floor: p.floor.map((i) => ({ name: i.card.name, type: i.card.type, working: i.working, drawdown: i.drawdown, res: i.card.res,
          yield: i.card.type === 'personality' ? this.yieldOf(p, i) : null, locked: i.locked, villain: i.card.villain, stack: i.stack.length })),
      })),
      events: this.events,
    };
    this.snapshots.push(snap);
    this.events = [];
  }

  // ─────────── queries ───────────
  opps(p) { return this.players.filter((q) => q !== p); }
  opp(p) { return p.policy.chooseOpponent(this, p); }
  floor(p) { return p.floor; }
  personalities(p) { return p.floor.filter((i) => i.card.type === 'personality'); }
  positions(p) { return p.floor.filter((i) => i.card.type === 'position'); }
  working(p) { return this.personalities(p).filter((i) => i.working); }
  villains(p) { return p.floor.filter((i) => i.card.villain); }
  villainsCantWork(p) { return this.modAny(p, 'villainsCantWork'); }
  canWork(p, inst) {
    return inst.card.type === 'personality' && !inst.working && (inst.fast || inst.hiredTurn < this.turnCounter) && !(inst.card.villain && this.villainsCantWork(p));
  }
  idleEligible(p) { return this.personalities(p).filter((i) => this.canWork(p, i)); }
  liquidity(p) { return p.reserve.filter((r) => !r.locked).length + p.turnTemp.liquidity; }
  bankAtLeast(p, n) { return p.bank >= n; }
  isUnderdog(p) { return this.opps(p).some((o) => o.bank > p.bank) && !this.opps(p).some((o) => o.bank < p.bank) || (this.opps(p).length === 1 && this.opps(p)[0].bank > p.bank); }
  marketIs(name) { return !!this.market && this.market.name === name; }
  coin() { const h = this.rng() < 0.5; this.log(`Coin: ${h ? 'heads' : 'tails'}`); return h; }

  // ─────────── modifiers ───────────
  modSources(p) {
    const s = [];
    if (!p.traderLocked) s.push(p.trader);
    p.floor.forEach((i) => s.push(i.card));
    if (this.market) s.push(this.market);
    if (this.providence) s.push(this.providence);
    return s;
  }
  modSum(p, key, ...args) { let n = 0; for (const s of this.modSources(p)) if (s.mods && s.mods[key]) n += s.mods[key](this, p, ...args) || 0; return n; }
  modAny(p, key, ...args) { for (const s of this.modSources(p)) if (s.mods && s.mods[key] && s.mods[key](this, p, ...args)) return true; return false; }
  modMax(p, key, init, ...args) { let n = init; for (const s of this.modSources(p)) if (s.mods && s.mods[key]) n = Math.max(n, s.mods[key](this, p, ...args) || 0); return n; }
  modMin(p, key, init, ...args) { let n = init; for (const s of this.modSources(p)) if (s.mods && s.mods[key]) { const v = s.mods[key](this, p, ...args); if (v != null) n = Math.min(n, v); } return n; }
  modProduct(p, key, ...args) { let n = 1; for (const s of this.modSources(p)) if (s.mods && s.mods[key]) n *= s.mods[key](this, p, ...args) || 1; return n; }
  modChain(p, key, init, ...args) { let v = init; for (const s of this.modSources(p)) if (s.mods && s.mods[key]) v = s.mods[key](this, p, ...args, v); return v; }
  modFirst(p, key, ...args) { for (const s of this.modSources(p)) if (s.mods && s.mods[key]) { const v = s.mods[key](this, p, ...args); if (v != null) return v; } return null; }
  isHedged(p, inst) { return !!inst.card.kw.hedged || this.modAny(p, 'hedged', inst); }
  yieldOf(p, inst) {
    let base = inst.card.yield || 0;
    if (inst.card.yieldFn) base = inst.card.yieldFn(this, p, inst, base);
    let y = base + (inst.turnBonus || 0) + this.modSum(p, 'yield', inst);
    y = this.modChain(p, 'yieldFinal', y, inst);
    return Math.max(0, y);
  }
  costOf(p, card) {
    let base = card.cost;
    if (card.costFn) base = card.costFn(this, p, base);
    const ov = this.modFirst(p, 'costOverride', card);
    if (ov != null) return ov;
    return Math.max(0, base + this.modSum(p, 'cost', card));
  }
  consultCost(p) {
    if (this.modAny(p, 'consultFree')) return 0;
    if (!p.turnTemp.freeConsultUsed && this.modAny(p, 'consultFreeOnce')) return 0;
    return 1;
  }
  reserveLimit(p) { return this.modMax(p, 'reserveLimit', 1); }

  // ─────────── economy helpers ───────────
  profit(p, n, why) { if (n <= 0 || this.over) return 0; p.portfolio += n; this.log(`${p.name} +${n} Profit into Portfolio (${why}) → ${p.portfolio}`); return n; }
  oppProfit(p, n, why) { return this.profit(p, n + this.modSum(p, 'opportunityProfit'), why); }
  bank(p, n, why) { if (n <= 0 || this.over) return; p.bank += n; this.log(`${p.name} banks ${n} directly (${why}) → Bank ${p.bank}`); this.checkWin(p); }
  bankFromPortfolio(p, n, why) {
    n = Math.min(n, p.portfolio); if (n <= 0 || this.over) return;
    p.portfolio -= n; p.bank += n; this.log(`${p.name} banks ${n} from Portfolio (${why}) → Bank ${p.bank}, Portfolio ${p.portfolio}`); this.checkWin(p);
  }
  checkWin(p) { if (!this.over && p.bank >= WIN_BANK) { this.over = true; this.winner = p; this.reason = `${p.name} banked ${p.bank}`; this.log(`*** ${p.name} WINS with ${p.bank} banked ***`); } }
  loseProfit(p, n, why) {
    if (n <= 0 || this.over) return 0;
    const cur = this.current;
    const hostile = !cur || cur.attacker !== p;
    if (cur && cur.victim === p && cur.prevented.loss) { this.log(`${p.name}'s Portfolio loss prevented (${why})`); return 0; }
    if (hostile && p.temp.portfolioProtected) { this.log(`${p.name}'s Portfolio is protected (${why})`); return 0; }
    if (hostile && this.active !== p) { const v = this.modMax(p, 'vault', 0); if (v) n = Math.min(n, Math.max(0, p.portfolio - v)); }
    const actual = Math.min(n, p.portfolio);
    if (actual <= 0) return 0;
    p.portfolio -= actual; this.log(`${p.name} loses ${actual} Profit from Portfolio (${why}) → ${p.portfolio}`);
    return actual;
  }
  frontrun(att, victim, n) {
    if (this.modAny(victim, 'noFrontrun')) { this.log(`${victim.name}'s Cold Wallet blocks the Front-run`); return 0; }
    const got = this.loseProfit(victim, n, `Front-run by ${att.name}`);
    if (got) { att.portfolio += got; att.stats.frontrun += got; this.log(`${att.name} front-runs ${got} → Portfolio ${att.portfolio}`); }
    return got;
  }
  token(p, kind, n) {
    if (n <= 0) return;
    if (kind === 'attention') n *= this.modProduct(p, 'attentionMult');
    if (kind === 'credibility') n *= this.modProduct(p, 'credMult');
    p.tokens[kind] += n; this.log(`${p.name} +${n} ${kind} → ${p.tokens[kind]}`);
  }
  has(p, kind, n) {
    if (p.tokens[kind] >= n) return true;
    if (this.modAny(p, 'tokensInterchangeable') && kind !== 'credibility') return p.tokens.attention + p.tokens.data >= n;
    return false;
  }
  spend(p, kind, n) {
    if (!this.has(p, kind, n)) return false;
    const take = Math.min(n, p.tokens[kind]); p.tokens[kind] -= take; n -= take;
    if (n > 0) { const other = kind === 'attention' ? 'data' : 'attention'; p.tokens[other] -= n; }
    return true;
  }
  draw(p, n) {
    for (let i = 0; i < n; i++) {
      if (!p.deck.length) { this.insolvent(p); return; }
      p.hand.push(p.deck.shift());
    }
    this.log(`${p.name} draws ${n} (hand ${p.hand.length})`);
  }
  insolvent(p) {
    if (this.over) return;
    this.over = true; const others = this.opps(p); this.winner = others.sort((a, b) => b.bank - a.bank)[0]; this.reason = `${p.name} is Insolvent`;
    this.log(`*** ${p.name} must draw from an empty deck: INSOLVENT. ${this.winner.name} wins ***`);
  }
  unlock(p, n) { let k = 0; for (const r of p.reserve) { if (k >= n) break; if (r.locked) { r.locked = false; k++; } } if (k) this.log(`${p.name} unlocks ${k} Reserve`); return k; }
  forceLock(p, n) { let k = 0; for (const r of p.reserve) { if (k >= n) break; if (!r.locked) { r.locked = true; k++; } } if (k) this.log(`${p.name} is forced to lock ${k} Reserve`); return k; }
  pay(p, n) {
    if (n <= 0) return true;
    if (this.liquidity(p) < n) return false;
    const fromTemp = Math.min(n, p.turnTemp.liquidity); p.turnTemp.liquidity -= fromTemp; n -= fromTemp;
    for (const r of p.reserve) { if (n <= 0) break; if (!r.locked) { r.locked = true; n--; } }
    return true;
  }
  setTemp(p, key, val) { p.temp[key] = val; }
  prevent(kind) { if (this.current) this.current.prevented[kind] = true; }

  // ─────────── drawdown / liquidation ───────────
  drawdown(inst, n, why) {
    if (n <= 0 || this.over || !inst) return;
    const owner = inst.owner; const cur = this.current;
    if (!owner.floor.includes(inst)) return;
    if (cur && cur.victim === owner && cur.prevented.dd) { this.log(`Drawdown to ${inst.card.name} prevented (${why})`); return; }
    if (owner.temp.preventDd && (!cur || cur.attacker !== owner)) { owner.temp.preventDd = false; this.log(`Drawdown to ${inst.card.name} prevented by Small Miracle`); return; }
    if (cur && cur.type === 'externality' && this.modAny(owner, 'externalityImmune', inst)) { this.log(`${inst.card.name} ignores the Externality`); return; }
    n += this.modSum(owner, 'incomingDd', inst, cur ? cur.card : null);
    if (this.isHedged(owner, inst)) n -= 1;
    if (cur && cur.type === 'calamity' && cur.attacker !== owner) {
      const shield = owner.floor.find((i) => i.card.autoShield && !i.locked);
      if (shield) { shield.locked = true; n -= shield.card.autoShield; this.log(`${owner.name} locks ${shield.card.name}`); }
    }
    n = Math.max(0, n); if (!n) return;
    inst.drawdown += n;
    this.log(`${inst.card.name} (${owner.name}) takes ${n} Drawdown (${why}) → ${inst.drawdown}/${inst.card.res}`);
    if (inst.drawdown >= inst.card.res) this.liquidate(inst, why);
  }
  heal(inst, n) { if (!inst) return; const k = n === 'all' ? inst.drawdown : Math.min(n, inst.drawdown); if (k > 0) { inst.drawdown -= k; this.log(`${inst.card.name} removes ${k} Drawdown → ${inst.drawdown}`); } }
  leaveFloor(inst, why) {
    const owner = inst.owner; const ix = owner.floor.indexOf(inst); if (ix < 0) return;
    owner.floor.splice(ix, 1);
    const scam = (inst.card.kw.exitScam || 0) * this.modProduct(owner, 'exitScamMult');
    if (scam) { const saved = this.current; this.current = null; this.log(`Exit Scam: ${inst.card.name} takes ${scam} from ${owner.name}'s Portfolio`); this.loseProfit(owner, scam, 'Exit Scam'); this.current = saved; }
  }
  liquidate(inst, why) {
    const owner = inst.owner; if (!owner.floor.includes(inst)) return;
    this.log(`${inst.card.name} (${owner.name}) is LIQUIDATED (${why})`);
    this.leaveFloor(inst, why);
    owner.discard.push(inst.card, ...inst.stack); owner.stats.liquidated++;
    if (inst.card.onLiquidated) inst.card.onLiquidated(this, owner, inst);
    if (inst.card.type === 'personality') this.draw(owner, 1);
  }
  idleAll(p) { let k = 0; this.working(p).forEach((i) => { i.working = false; k++; }); if (k) this.log(`${p.name}'s ${k} Working Personalities go idle`); }

  // ─────────── targeting ───────────
  targets(p, kind) {
    const O = this.opps(p);
    switch (kind) {
      case 'oppWorking': return O.flatMap((o) => this.working(o));
      case 'oppWorkingCheap': return O.flatMap((o) => this.working(o)).filter((i) => i.card.cost <= 4);
      case 'oppPosition': return O.flatMap((o) => this.positions(o));
      case 'oppWorkingVillainOrPosition': return O.flatMap((o) => [...this.working(o).filter((i) => i.card.villain), ...this.positions(o)]);
      case 'oppPortfolio': return O.filter((o) => o.portfolio > 0);
      case 'oppPlayer': return O;
      case 'oppPersonalityHurt': return O.flatMap((o) => this.personalities(o)).filter((i) => i.drawdown > 0);
      case 'ownHurt': return p.floor.filter((i) => i.drawdown > 0);
      case 'selfHarm': return this.working(p);
      default: return [];
    }
  }
  pick(p, cands, spec) { if (!cands.length) return null; return p.policy.pick(this, p, cands, spec) || cands[0]; }

  // ─────────── R-cana deck ───────────
  resetKnown() { this.players.forEach((q) => { q.known.omen = null; }); }
  peekOmen(p) { if (this.omen) { p.known.omen = this.omen; this.log(`${p.name} looks at the Omen: ${this.omen.name}`); } }
  peekDeck(p, n) { const top = this.rcanaDeck.slice(0, n); p.known.deckTop = top; if (top.length) this.log(`${p.name} looks at the top ${top.length}: ${top.map((c) => c.name).join(', ')}`); }
  revealOmen() { if (!this.omen) return; this.players.forEach((q) => { q.known.omen = this.omen; }); this.log(`The Omen is revealed to all: ${this.omen.name}`); }
  omenToBottom() { if (!this.omen || !this.rcanaDeck.length) return; this.log(`The Omen (${this.omen.name}) goes to the bottom`); this.rcanaDeck.push(this.omen); this.omen = this.rcanaDeck.shift(); this.resetKnown(); }
  consult(p, { free = false, inner = false } = {}) {
    if (!this.omen) return;
    const cost = free ? 0 : this.consultCost(p);
    if (!free && cost === 0 && !this.modAny(p, 'consultFree')) p.turnTemp.freeConsultUsed = true;
    if (!this.pay(p, cost)) return;
    this.log(`${p.name} consults the R-cana${cost ? ` (locks ${cost})` : ''}`);
    this.peekOmen(p);
    if (this.modAny(p, 'consultSeesTop')) this.peekDeck(p, 1);
    if (p.policy.bottomOmen(this, p, this.omen)) this.omenToBottom();
    if (!inner && this.modAny(p, 'consultTwice')) this.consult(p, { free: true, inner: true });
  }
  swapMarketWithOmen() {
    if (!this.omen) return;
    const o = this.omen; const m = this.market;
    this.log(`The Market (${m ? m.name : 'none'}) is swapped with the Omen (${o.name})`);
    if (o.type === 'market') { this.omen = m; this.market = o; this.resetKnown(); }
    else { this.omen = m; this.market = null; this.resolveRevealed(o, true); }
  }
  clearMarket(why) { if (this.market) { this.log(`The Market (${this.market.name}) is discarded (${why})`); this.rcanaDiscard.push(this.market); this.market = null; } }
  summonCrash() {
    const crash = MAJORS.find((m) => m.id === 'the_crash');
    if (this.providence && this.providence.id === 'the_crash') return;
    const ix = this.rcanaDeck.indexOf(crash); if (ix >= 0) this.rcanaDeck.splice(ix, 1);
    if (this.omen) this.rcanaDeck.unshift(this.omen);
    this.omen = crash; this.resetKnown(); this.log('THE CRASH is placed in the Omen slot');
  }
  oracleReorder() {
    const top = this.rcanaDeck.splice(0, 3);
    if (!top.length) return;
    const ud = this.players.filter((q) => this.isUnderdog(q))[0] || this.active;
    this.log(`THE ORACLE reveals: ${top.map((c) => c.name).join(', ')}. ${ud.name} reorders.`);
    const order = ud.policy.reorder(this, ud, top);
    this.rcanaDeck.unshift(...order); ud.known.deckTop = order;
  }
  reveal() {
    if (!this.omen) { if (this.finalBellRound == null) { this.finalBellRound = this.round; this.log('FINAL BELL: the R-cana has nothing left to reveal'); } return; }
    const c = this.omen; this.omen = null; this.resetKnown();
    this.log(`The R-cana reveals: ${c.name} (${c.type})`);
    this.resolveRevealed(c, false);
    if (this.rcanaDeck.length) this.omen = this.rcanaDeck.shift();
    else { this.finalBellRound = this.round; this.log(`FINAL BELL: this is the last round (${this.round})`); }
  }
  resolveRevealed(c, viaSwap) {
    const prevMarket = this.market;
    if (c.type === 'market') { if (this.market) this.rcanaDiscard.push(this.market); this.market = c; }
    else if (c.type === 'externality') this.resolveExternality(c);
    else if (c.type === 'major') { if (this.providence) this.rcanaDiscard.push(this.providence); this.providence = c; this.current = { type: 'major', card: c, attacker: null, victim: null, prevented: {} }; c.resolve && c.resolve(this); this.current = null; }
    for (const q of this.players) for (const i of [...q.floor]) if (i.card.onReveal && q.floor.includes(i)) i.card.onReveal(this, q, i, c);
    if (this.market && this.market !== c && this.market === prevMarket && this.market.afterReveal && !viaSwap) this.market.afterReveal(this);
    if (c.type === 'externality') this.rcanaDiscard.push(c);
  }
  resolveExternality(c) {
    this.current = { type: 'externality', card: c, attacker: null, victim: null, prevented: {} };
    if (c.global) c.global(this);
    const order = [...this.players.slice(this.turnIdx), ...this.players.slice(0, this.turnIdx)];
    for (const q of order) {
      if (this.over) break;
      if (this.modAny(q, 'externalityImmunePlayer')) { this.log(`${q.name} ignores ${c.name} (Cassandra)`); continue; }
      this.current.victim = q; this.current.prevented = {};
      this.offerHedge(q, { card: c, attacker: null, kind: 'externality' });
      if (c.each) c.each(this, q);
    }
    this.current = null;
  }

  // ─────────── reactions ───────────
  offerHedge(victim, threat) {
    const options = victim.hand.filter((c) => c.kw.hedge && this.costOf(victim, c) <= this.liquidity(victim));
    if (!options.length) return;
    const choice = victim.policy.wantHedge(this, victim, options, threat);
    if (!choice) return;
    const cost = this.costOf(victim, choice); this.pay(victim, cost);
    victim.hand.splice(victim.hand.indexOf(choice), 1); victim.discard.push(choice); victim.stats.hedged++;
    this.log(`${victim.name} HEDGES with ${choice.name} (locks ${cost})`);
    choice.hedgeEffect(this, victim, threat);
  }

  // ─────────── playing cards ───────────
  newInst(p, card) { return { uid: UID++, card, owner: p, working: false, drawdown: 0, locked: false, turnBonus: 0, hiredTurn: this.turnCounter, fast: !!card.kw.fast, stayWorking: false, stack: [] }; }
  hire(p, card, { free = false, ascend = null } = {}) {
    const cost = ascend ? card.kw.ascend : this.costOf(p, card);
    if (!free && !this.pay(p, cost)) return null;
    const hi = p.hand.indexOf(card); if (hi >= 0) p.hand.splice(hi, 1);
    this.count(card);
    let inst;
    if (ascend) {
      inst = this.newInst(p, card);
      inst.drawdown = ascend.drawdown; inst.working = ascend.working; inst.hiredTurn = ascend.hiredTurn; inst.stack = [ascend.card, ...ascend.stack];
      p.floor[p.floor.indexOf(ascend)] = inst;
      this.log(`${p.name} ASCENDS ${ascend.card.name} into ${card.name} for ${cost}`);
      if (card.onAscend) card.onAscend(this, p, inst);
    } else {
      inst = this.newInst(p, card); p.floor.push(inst);
      this.log(`${p.name} hires ${card.name}${free ? ' for free' : ` for ${cost}`}`);
      if (card.villain && p.tokens.credibility) { this.log(`${p.name} loses all Credibility for hiring a Villain`); p.tokens.credibility = 0; }
      if (p.trader.onHire && !p.traderLocked) p.trader.onHire(this, p, inst);
      if (card.onHired) card.onHired(this, p, inst);
    }
    return inst;
  }
  open(p, card) {
    const cost = this.costOf(p, card); if (!this.pay(p, cost)) return null;
    p.hand.splice(p.hand.indexOf(card), 1); this.count(card);
    const inst = this.newInst(p, card); p.floor.push(inst);
    this.log(`${p.name} opens ${card.name} for ${cost}`);
    if (card.onHired) card.onHired(this, p, inst);
    return inst;
  }
  count(card) { this.cardPlays[card.name] = (this.cardPlays[card.name] || 0) + 1; }
  resolveAction(p, card, target, { free = false } = {}) {
    const cost = free ? 0 : this.costOf(p, card);
    if (!this.pay(p, cost)) return false;
    const hi = p.hand.indexOf(card); if (hi >= 0) p.hand.splice(hi, 1);
    this.count(card); p.stats.played++;
    this.log(`${p.name} plays ${card.name}${free ? ' (free)' : ` for ${cost}`}${target ? ` → ${target.card ? target.card.name : target.name}` : ''}`);
    if (card.type === 'calamity') {
      const victim = target ? (target.card ? target.owner : target) : null;
      this.current = { type: 'calamity', card, attacker: p, victim, prevented: {} };
      if (victim) this.offerHedge(victim, { card, attacker: p, target, kind: 'calamity' });
      const stillThere = !target || !target.card || target.owner.floor.includes(target);
      if (stillThere) card.play(this, p, target);
      this.current = null;
    } else {
      this.current = { type: 'action', card, attacker: p, victim: null, prevented: {} };
      if (card.type === 'opportunity') {
        const n = card.profitFn ? card.profitFn(this, p) : card.profit;
        if (n != null) this.oppProfit(p, n, card.name);
      }
      if (card.play) card.play(this, p, target);
      if (card.after) card.after(this, p);
      this.current = null;
      if (card.type === 'grace') {
        for (const s of this.modSources(p)) if (s.onGrace) s.onGrace(this, p, p.floor.find((i) => i.card === s));
        for (const o of this.opps(p)) if (o.trader.onOppGrace && !o.traderLocked) o.trader.onOppGrace(this, o);
      }
    }
    p.discard.push(card);
    return true;
  }
  work(p, inst, { ability = false, target = null, seizeCard = null } = {}) {
    inst.working = true; p.stats.worked++;
    if (seizeCard) { this.log(`${p.name} puts ${inst.card.name} to Work to SEIZE ${seizeCard.name}`); this.resolveAction(p, seizeCard, null, { free: true }); }
    else if (ability) { this.log(`${p.name} puts ${inst.card.name} to Work: ability${target ? ` → ${target.card ? target.card.name : target.name}` : ''}`); inst.card.work(this, p, inst, target); }
    else { const y = this.yieldOf(p, inst); this.log(`${p.name} puts ${inst.card.name} to Work`); this.profit(p, y, `${inst.card.name} Yield`); }
    if (inst.card.onWorking && p.floor.includes(inst)) inst.card.onWorking(this, p, inst);
    if (p.trader.onAnyWork && !p.traderLocked && p.floor.includes(inst)) p.trader.onAnyWork(this, p, inst);
  }
  takeover(p, inst) {
    const from = inst.owner; this.log(`${p.name} takes over ${inst.card.name} from ${from.name}`);
    this.leaveFloor(inst, 'Hostile Takeover'); inst.owner = p; inst.hiredTurn = this.turnCounter; p.floor.push(inst);
  }
  returnFromDiscard(q, where) {
    const cands = q.discard.filter((c) => c.type === 'personality').sort((a, b) => b.cost - a.cost);
    const c = cands[0]; if (!c) return;
    q.discard.splice(q.discard.indexOf(c), 1);
    if (where === 'hand') { q.hand.push(c); this.log(`${q.name} returns ${c.name} to hand`); }
    else { const inst = this.newInst(q, c); q.floor.push(inst); this.log(`${q.name} returns ${c.name} to the Floor`); }
  }
  discardVillainFromHand(q) { const v = q.hand.find((c) => c.villain); if (v) { q.hand.splice(q.hand.indexOf(v), 1); q.discard.push(v); this.log(`${q.name} discards ${v.name} from hand`); } else this.log(`${q.name} has no Villain in hand`); }

  // ─────────── legal actions (for policies) ───────────
  actions(p) {
    const A = []; const liq = this.liquidity(p);
    if (p.reservedThisTurn < this.reserveLimit(p)) for (const c of p.hand) if (c.reservable) A.push({ t: 'reserve', card: c, cost: 0 });
    for (const c of p.hand) {
      if (c.type === 'personality') {
        const cost = this.costOf(p, c); if (cost <= liq) A.push({ t: 'hire', card: c, cost });
        if (c.kw.ascend != null && c.kw.ascend <= liq) {
          const tgt = this.personalities(p).find((i) => baseName(i.card.name) === baseName(c.name) && i.card !== c);
          if (tgt) A.push({ t: 'hire', card: c, cost: c.kw.ascend, ascend: tgt });
        }
      } else if (c.type === 'position') {
        const cost = this.costOf(p, c); if (cost <= liq) A.push({ t: 'open', card: c, cost });
      } else {
        const cost = this.costOf(p, c);
        if (c.can && !c.can(this, p)) continue;
        if (c.type === 'calamity' && this.noCalamityUntil && this.noCalamityUntil !== p) continue;
        if (cost <= liq) {
          if (c.target) { for (const t of this.targets(p, c.target)) A.push({ t: 'play', card: c, cost, target: t }); }
          else A.push({ t: 'play', card: c, cost, target: null });
        }
        if (c.type === 'opportunity' && c.kw.seize) {
          for (const i of this.idleEligible(p)) if (i.card.cls.includes(c.kw.seize)) A.push({ t: 'seize', card: c, inst: i, cost: 0 });
          if (this.modAny(p, 'seizeWithAttention') && this.has(p, 'attention', 3)) A.push({ t: 'seize', card: c, attention: true, cost: 0 });
        }
      }
    }
    for (const i of this.idleEligible(p)) {
      A.push({ t: 'work', inst: i, cost: 0, value: this.yieldOf(p, i) });
      if (i.card.work) {
        if (i.card.workTarget) { for (const t of this.targets(p, i.card.workTarget)) A.push({ t: 'work', inst: i, ability: true, target: t, cost: 0 }); }
        else if (!(i.card.id === 'the_manipulator' && !this.omen)) A.push({ t: 'work', inst: i, ability: true, cost: 0 });
      }
    }
    for (const i of p.floor) if (i.card.ability && i.card.ability.can(this, p, i)) A.push({ t: 'ability', inst: i, cost: 0 });
    if (this.omen) { const cc = this.consultCost(p); if (cc <= liq) A.push({ t: 'consult', cost: cc }); }
    if (this.providence && this.providence.invoke && !p.turnTemp.invoked) {
      const iv = this.providence.invoke; if (iv.cost <= liq && iv.can(this, p)) A.push({ t: 'invoke', cost: iv.cost });
    }
    if (!p.traderLocked) A.push({ t: 'lockTrader', cost: 0 });
    return A;
  }
  act(p, a) {
    switch (a.t) {
      case 'reserve': p.hand.splice(p.hand.indexOf(a.card), 1); p.reserve.push({ card: a.card, locked: false }); p.reservedThisTurn++; this.log(`${p.name} reserves ${a.card.name} (Liquidity ${this.liquidity(p)})`); break;
      case 'hire': this.hire(p, a.card, { ascend: a.ascend || null }); break;
      case 'open': this.open(p, a.card); break;
      case 'play': this.resolveAction(p, a.card, a.target); break;
      case 'seize':
        if (a.attention) { this.spend(p, 'attention', 3); this.log(`${p.name} pays 3 Attention to seize ${a.card.name}`); this.resolveAction(p, a.card, null, { free: true }); }
        else this.work(p, a.inst, { seizeCard: a.card });
        break;
      case 'work': this.work(p, a.inst, { ability: !!a.ability, target: a.target || null }); break;
      case 'ability': this.log(`${p.name} uses ${a.inst.card.name}`); a.inst.card.ability.run(this, p, a.inst); break;
      case 'consult': this.consult(p); break;
      case 'invoke': { const iv = this.providence.invoke; this.pay(p, iv.cost); p.turnTemp.invoked = true; this.log(`${p.name} INVOKES ${this.providence.name} (locks ${iv.cost})`); iv.run(this, p); break; }
      case 'lockTrader': p.traderLocked = true; p.turnTemp.liquidity += 1; this.log(`${p.name} locks their Trader for 1 Liquidity`); break;
      default: throw new Error('unknown action ' + a.t);
    }
  }

  // ─────────── turn structure ───────────
  refresh(p) {
    for (const i of p.floor) {
      if (i.working) { if (i.stayWorking || p.temp.stayWorking) { i.stayWorking = false; } else i.working = false; }
      i.locked = false;
    }
    p.reserve.forEach((r) => { r.locked = false; }); p.traderLocked = false; p.temp = {}; p.reservedThisTurn = 0;
    if (this.noCalamityUntil === p) this.noCalamityUntil = null;
  }
  set(p) {
    const twice = this.modAny(p, 'positionsTwice');
    for (const i of [...p.floor]) if (i.card.startOfTurn && p.floor.includes(i)) { i.card.startOfTurn(this, p, i); if (twice && i.card.type === 'position') i.card.startOfTurn(this, p, i); }
    if (!this.modAny(p, 'dividendOff')) { const base = this.modMax(p, 'dividendBase', 1); const d = base + this.modSum(p, 'dividendDelta'); this.profit(p, d, 'Dividend'); }
    if (!this.modAny(p, 'interestOff')) {
      let div = this.modMin(p, 'interestDiv', 10); if (p.turnTemp.interestDiv) div = Math.min(div, p.turnTemp.interestDiv);
      const times = this.modMax(p, 'interestTimes', 1); const mult = this.modProduct(p, 'interestMult');
      for (let k = 0; k < times; k++) { const n = Math.floor(p.portfolio / div) * mult; if (n) this.profit(p, n, 'Interest'); }
    }
    const amt = Math.min(p.portfolio, Math.max(0, p.policy.bankAmount(this, p)));
    if (amt) this.bankFromPortfolio(p, amt, 'Set'); else if (p.portfolio) this.log(`${p.name} keeps ${p.portfolio} in Portfolio`);
  }
  playTurn() {
    const p = this.players[this.turnIdx]; this.active = p;
    if (this.turnIdx === 0) { this.round++; if (this.round > MAX_ROUNDS) { this.over = true; this.reason = 'round limit'; this.endByBell(); return; } }
    this.log(`── Turn ${this.turnCounter}: ${p.name} (${p.trader.name}) ──`);
    if (this.turnIdx === 0 && this.round > 1 && !this.over) this.reveal();
    if (this.over) { this.snapshot('turn'); return; }
    this.refresh(p);
    this.set(p);
    if (this.over) { this.snapshot('turn'); return; }
    if (!(this.round === 1 && this.turnIdx === 0)) this.draw(p, 1);
    if (this.over) { this.snapshot('turn'); return; }
    p.policy.takeTurn(this, p);
    for (const i of p.floor) i.turnBonus = 0;
    p.turnTemp = this.freshTurnTemp();
    const last = this.turnIdx === this.players.length - 1;
    this.turnCounter++;
    this.snapshot('turn');
    if (!this.over && last && this.finalBellRound != null && this.round >= this.finalBellRound) this.endByBell();
    this.turnIdx = (this.turnIdx + 1) % this.players.length;
  }
  endByBell() {
    if (this.winner) return;
    this.over = true;
    const sorted = [...this.players].sort((a, b) => b.bank - a.bank || b.portfolio - a.portfolio);
    if (sorted.length > 1 && sorted[0].bank === sorted[1].bank && sorted[0].portfolio === sorted[1].portfolio) { this.winner = null; this.reason = 'Final Bell: draw'; }
    else { this.winner = sorted[0]; this.reason = `Final Bell: ${sorted[0].name} leads ${sorted[0].bank} to ${sorted[1] ? sorted[1].bank : 0}`; }
    this.log(`*** ${this.reason} ***`);
    this.snapshot('end');
  }
  run() {
    let guard = 0;
    while (!this.over && guard++ < 400) this.playTurn();
    if (!this.over) { this.over = true; this.reason = 'guard'; }
    return this.result();
  }
  result() {
    return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, reason: this.reason, rounds: this.round, turns: this.turnCounter - 1,
      finalBell: this.finalBellRound != null && this.reason.startsWith('Final Bell'),
      players: this.players.map((p) => ({ name: p.name, trader: p.trader.name, bank: p.bank, portfolio: p.portfolio, stats: { ...p.stats } })), cardPlays: this.cardPlays };
  }
}
