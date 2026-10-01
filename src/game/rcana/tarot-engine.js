// Shared-deck engine for the tarot configuration of R-cana.
import { MINORS, MAJORS, byId } from './tarot.js';
import { makeRng } from './engine.js';

export const DEFAULTS = { winBank: 80, openingHand: 7, minorsPerTurn: 1, firstTurnDraw: 0, maxRounds: 40 };
let UID = 1;

export class TarotGame {
  constructor({ players, seed = 1, snapshots = false, rules = {} }) {
    this.rules = { ...DEFAULTS, ...rules }; this.rng = makeRng(seed); this.seed = seed; this.snapshotsOn = snapshots;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, hand: [], reserve: [], floor: [], portfolio: 0, bank: 0,
      hailMaryUsed: false, reservedThisTurn: 0, foretold: false, turnBonusLiquidity: 0,
      stats: { worked: 0, pips: 0, coins: 0, candles: 0, chains: 0, cups: 0, hedges: 0, hires: 0, invokes: 0, liquidated: 0, frontrun: 0, unbankedSum: 0, sets: 0, foretells: 0 } }));
    this.deck = []; this.discard = []; this.market = null; this.providence = []; this.events = []; this.snapshots = []; this.cardPlays = {};
    this.round = 0; this.turnIdx = 0; this.turnCounter = 1; this.active = null; this.over = false; this.winner = null; this.reason = ''; this.bellRound = null; this.current = null; this.majorsSeen = 0;
    this.setup();
  }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setup() {
    const minors = this.shuffle([...MINORS]);
    for (const p of this.players) for (let i = 0; i < this.rules.openingHand; i++) p.hand.push(minors.shift());
    this.deck = this.shuffle([...minors, ...MAJORS]);
    this.log(`The R-cana is shuffled: ${this.deck.length} cards. Each Trader holds ${this.rules.openingHand}.`);
    this.snapshot('setup');
  }
  log(t) { this.events.push(`${this.active ? `[R${this.round} ${this.active.name}] ` : '[setup] '}${t}`); }
  snapshot(label) {
    if (!this.snapshotsOn) { this.events = []; return; }
    this.snapshots.push({ label, round: this.round, active: this.active ? this.active.name : null, bell: this.bellRound, market: this.market ? this.market.name : null,
      providence: this.providence.map((m) => m.name), deckLeft: this.deck.length, over: this.over, winner: this.winner ? this.winner.name : null, reason: this.reason, events: this.events,
      players: this.players.map((p) => ({ name: p.name, bank: p.bank, portfolio: p.portfolio, hand: p.hand.map((c) => c.name), reserve: p.reserve.length, locked: p.reserve.filter((r) => r.locked).length, archetype: this.archetype(p),
        floor: p.floor.map((i) => ({ name: i.card.name, title: i.card.title, suit: i.card.suit, working: i.working, drawdown: i.drawdown, res: i.card.res, yield: this.yieldOf(p, i), villain: i.card.villain })) })) });
    this.events = [];
  }
  // ── queries ──
  opps(p) { return this.players.filter((q) => q !== p); }
  floor(p) { return p.floor; }
  working(p) { return p.floor.filter((i) => i.working); }
  canWork(p, inst) { return !inst.working && (inst.card.kw.fast || inst.hiredTurn < this.turnCounter); }
  idleEligible(p) { return p.floor.filter((i) => this.canWork(p, i)); }
  bestIdle(p) { return [...this.idleEligible(p)].sort((a, b) => this.yieldOf(p, b) - this.yieldOf(p, a))[0] || null; }
  richestOpp(p) { return [...this.opps(p)].sort((a, b) => b.portfolio - a.portfolio)[0] || null; }
  liquidity(p) { return p.reserve.filter((r) => !r.locked).length + p.turnBonusLiquidity; }
  isUnderdog(p) { return this.opps(p).some((o) => o.bank > p.bank); }
  marketIs(n) { return !!this.market && this.market.name === n; }
  coin() { const h = this.rng() < 0.5; this.log(`Coin: ${h ? 'heads' : 'tails'}`); return h; }
  modSources(p) { const s = p.floor.map((i) => i.card); if (this.market) s.push(this.market); return s; }
  modSum(p, k, ...a) { let n = 0; for (const s of this.modSources(p)) if (s.mods && s.mods[k]) n += s.mods[k](this, p, ...a) || 0; return n; }
  modAny(p, k, ...a) { for (const s of this.modSources(p)) if (s.mods && s.mods[k] && s.mods[k](this, p, ...a)) return true; return false; }
  modProduct(p, k, ...a) { let n = 1; for (const s of this.modSources(p)) if (s.mods && s.mods[k]) n *= s.mods[k](this, p, ...a) || 1; return n; }
  modMin(p, k, init, ...a) { let n = init; for (const s of this.modSources(p)) if (s.mods && s.mods[k]) { const v = s.mods[k](this, p, ...a); if (v != null) n = Math.min(n, v); } return n; }
  modFirst(p, k, ...a) { for (const s of this.modSources(p)) if (s.mods && s.mods[k]) { const v = s.mods[k](this, p, ...a); if (v != null) return v; } return null; }
  modChain(p, k, init, ...a) { let v = init; for (const s of this.modSources(p)) if (s.mods && s.mods[k]) v = s.mods[k](this, p, ...a, v); return v; }
  yieldOf(p, inst, bonus = 0) {
    let b = inst.card.yield; if (inst.card.yieldFn) b = inst.card.yieldFn(this, p, inst, b);
    let y = b + bonus + this.modSum(p, 'yield', inst); y = this.modChain(p, 'yieldFinal', y, inst); return Math.max(0, y);
  }
  costOf(p, c) { const ov = this.modFirst(p, 'costOverride', c); if (ov != null) return ov; return Math.max(0, c.cost + this.modSum(p, 'cost', c)); }
  isHedged(p, inst) { return !!inst.card.kw.hedged; }
  // ── economy ──
  profit(p, n, why) { if (n <= 0 || this.over) return 0; p.portfolio += n; this.log(`${p.name} +${n} Profit (${why}) → Portfolio ${p.portfolio}`); return n; }
  bank(p, n, why) { if (n <= 0 || this.over) return; p.bank += n; this.log(`${p.name} banks ${n} directly (${why}) → Bank ${p.bank}`); this.checkWin(p); }
  bankFromPortfolio(p, n, why) { n = Math.min(n, p.portfolio); if (n <= 0 || this.over) return; p.portfolio -= n; p.bank += n; this.log(`${p.name} banks ${n} (${why}) → Bank ${p.bank}, Portfolio ${p.portfolio}`); this.checkWin(p); }
  checkWin(p) { if (!this.over && p.bank >= this.rules.winBank) { this.over = true; this.winner = p; this.reason = `${p.name} banked ${p.bank}`; this.log(`*** ${p.name} WINS with ${p.bank} banked ***`); } }
  loseProfit(p, n, why) {
    if (n <= 0 || this.over) return 0; const cur = this.current; const hostile = !cur || cur.attacker !== p;
    if (cur && cur.victim === p && cur.reduce) { const r = Math.min(n, cur.reduce); n -= r; cur.reduce -= r; if (r) this.log(`${p.name}'s Hedge absorbs ${r}`); }
    if (hostile && this.modAny(p, 'portfolioSafe') && cur && cur.kind === 'chain') { this.log(`${p.name}'s Portfolio is protected by CONVICTION`); return 0; }
    const a = Math.min(n, p.portfolio); if (a <= 0) return 0; p.portfolio -= a; this.log(`${p.name} loses ${a} Profit (${why}) → Portfolio ${p.portfolio}`); return a;
  }
  frontrun(att, victim, n) { const got = this.loseProfit(victim, n, `Front-run by ${att.name}`); if (got) { att.portfolio += got; att.stats.frontrun += got; this.log(`${att.name} front-runs ${got} → Portfolio ${att.portfolio}`); } return got; }
  pay(p, n) { if (n <= 0) return true; if (this.liquidity(p) < n) return false; const t = Math.min(n, p.turnBonusLiquidity); p.turnBonusLiquidity -= t; n -= t; for (const r of p.reserve) { if (n <= 0) break; if (!r.locked) { r.locked = true; n--; } } return true; }
  drawdown(inst, n, why) {
    const o = inst.owner; if (!o.floor.includes(inst) || this.over) return; const cur = this.current;
    if (cur && cur.victim === o && cur.reduce) { const r = Math.min(n, cur.reduce); n -= r; cur.reduce -= r; if (r) this.log(`${o.name}'s Hedge absorbs ${r}`); }
    n += this.modSum(o, 'incomingDd', inst); if (this.isHedged(o, inst)) n -= 1; n = Math.max(0, n); if (!n) return;
    inst.drawdown += n; this.log(`${inst.card.name} (${o.name}) takes ${n} Drawdown (${why}) → ${inst.drawdown}/${inst.card.res}`);
    if (inst.drawdown >= inst.card.res) this.liquidate(inst, why);
  }
  liquidate(inst, why) {
    const o = inst.owner; o.floor.splice(o.floor.indexOf(inst), 1); o.stats.liquidated++; this.discard.push(inst.card);
    this.log(`${inst.card.name} (${o.name}) is LIQUIDATED (${why})`);
    const scam = inst.card.kw.exitScam || 0; if (scam) { const s = this.current; this.current = null; this.loseProfit(o, scam, 'Exit Scam'); this.current = s; }
    this.drawMinors(o, 1);
  }
  // ── deck ──
  drawOne(p) { // returns the Minor drawn, resolving Majors on the way; null if deck empty
    while (this.deck.length) {
      const c = this.deck.shift();
      if (c.type === 'major') { this.revealMajor(c); if (this.over) return null; continue; }
      p.hand.push(c); return c;
    }
    if (this.bellRound == null) this.callBell('the R-cana is empty');
    return null;
  }
  drawMinors(p, n) { let k = 0; for (let i = 0; i < n; i++) if (this.drawOne(p)) k++; if (k) this.log(`${p.name} draws ${k} (hand ${p.hand.length})`); return k; }
  revealMajor(c) {
    this.majorsSeen++; this.log(`✦ The R-cana reveals ${c.name} (${c.tarot})`);
    this.current = { kind: 'major', card: c, attacker: null, victim: null };
    if (c.kind === 'market') { if (this.market) this.discard.push(this.market); this.market = c; }
    else if (c.kind === 'event') { c.buried = false; c.resolve(this); if (!c.buried) this.discard.push(c); for (const q of this.players) for (const i of [...q.floor]) if (i.card.onEvent && q.floor.includes(i)) i.card.onEvent(this, q, i); }
    else this.providence.push(c);
    this.current = null;
    for (const q of this.players) for (const i of [...q.floor]) if (i.card.onMajor && q.floor.includes(i)) i.card.onMajor(this, q, i);
  }
  byId(id) { return byId[id]; }
  bury(c) { const half = Math.floor(this.deck.length / 2); const pos = half + Math.floor(this.rng() * (this.deck.length - half + 1)); this.deck.splice(pos, 0, c); this.log(`${c.name} is buried in the bottom half of the R-cana`); c.buried = true; }
  callBell(why) { if (this.bellRound == null) { this.bellRound = this.round; this.log(`FINAL BELL (${why}): the game ends after round ${this.round}`); } }
  oracle() { const top = this.deck.splice(0, 3); if (!top.length) return; const ud = this.players.filter((q) => this.isUnderdog(q))[0] || this.active || this.players[0]; this.log(`THE ORACLE shows ${top.map((c) => c.name).join(', ')}; ${ud.name} reorders`); this.deck.unshift(...ud.policy.reorder(this, ud, top)); }
  rotatePortfolios() { const vals = this.players.map((q) => q.portfolio); this.players.forEach((q, i) => { q.portfolio = vals[(i + 1) % vals.length]; }); this.log(`VOLATILITY: Portfolios rotate → ${this.players.map((q) => `${q.name} ${q.portfolio}`).join(', ')}`); }
  foretell(p) { if (!this.deck.length || p.foretold) return; p.foretold = true; p.stats.foretells++; const top = this.deck[0]; this.log(`${p.name} foretells: ${top.name}`); if (p.policy.bottomCard(this, p, top)) { this.deck.push(this.deck.shift()); this.log(`${p.name} sends ${top.name} to the bottom`); } }
  // ── plays ──
  count(c) { this.cardPlays[c.name] = (this.cardPlays[c.name] || 0) + 1; }
  hire(p, c) { const cost = this.costOf(p, c); if (!this.pay(p, cost)) return null; p.hand.splice(p.hand.indexOf(c), 1); this.count(c); p.stats.hires++;
    const inst = { uid: UID++, card: c, owner: p, working: false, drawdown: 0, hiredTurn: this.turnCounter }; p.floor.push(inst);
    this.log(`${p.name} hires ${c.name} (${c.title}) for ${cost}`); if (c.onHired) c.onHired(this, p, inst); return inst; }
  work(p, inst, { bonus = 0, ability = false } = {}) {
    inst.working = true; p.stats.worked++;
    if (ability && inst.card.work) { this.log(`${p.name} puts ${inst.card.name} to Work: ability`); inst.card.work(this, p, inst); }
    else { const y = this.yieldOf(p, inst, bonus); this.log(`${p.name} puts ${inst.card.name} to Work${bonus ? ` (+${bonus})` : ''}`); this.profit(p, y, `${inst.card.name} Yield`); }
  }
  playPip(p, c, choice) {
    const cost = this.costOf(p, c); if (!this.pay(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); this.count(c); p.stats.pips++; p.stats[c.suit]++;
    const r = c.rank;
    this.log(`${p.name} plays ${c.name} for ${cost}${choice && choice.target ? ` → ${choice.target.card ? choice.target.card.name : choice.target.name}` : ''}`);
    if (c.suit === 'coins') this.profit(p, r + this.modSum(p, 'coinsBonus'), c.name);
    else if (c.suit === 'candles') { const inst = choice.inst; this.work(p, inst, { bonus: r * this.modProduct(p, 'candlesMult') + this.modSum(p, 'candlesBonus') }); }
    else if (c.suit === 'cups') { const o = choice.opp; const give = Math.ceil(r / 2); const mult = this.modProduct(p, 'cupsMult'); this.profit(o, give * mult, `${c.name} from ${p.name}`); this.profit(p, r * mult + this.modSum(p, 'cupsBonus'), c.name); for (const i of [...p.floor]) if (i.card.onCup && p.floor.includes(i)) i.card.onCup(this, p, i); }
    else if (c.suit === 'chains') {
      const amount = r * this.modProduct(p, 'chainsMult'); const t = choice.target; const victim = t.card ? t.owner : t;
      this.current = { kind: 'chain', card: c, attacker: p, victim, reduce: 0, amount };
      this.offerHedge(victim, { card: c, attacker: p, target: t, amount });
      if (t.card) { if (victim.floor.includes(t)) this.drawdown(t, amount, c.name); } else this.frontrun(p, victim, amount);
      this.current = null;
    }
    this.discard.push(c); return true;
  }
  offerHedge(victim, threat) {
    const opts = victim.hand.filter((c) => c.type === 'pip' && c.suit === 'chains' && this.costOf(victim, c) <= this.liquidity(victim));
    if (!opts.length) return; const ch = victim.policy.wantHedge(this, victim, opts, threat); if (!ch) return;
    this.pay(victim, this.costOf(victim, ch)); victim.hand.splice(victim.hand.indexOf(ch), 1); this.discard.push(ch); victim.stats.hedges++; this.count(ch);
    this.current.reduce += ch.rank; this.log(`${victim.name} HEDGES with ${ch.name} (reduces by ${ch.rank})`);
  }
  invoke(p, m) { if (!this.pay(p, m.cost)) return; p.stats.invokes++; this.log(`${p.name} INVOKES ${m.name} (locks ${m.cost})`); if (m.id === 'major_0') p.hailMaryUsed = true; m.run(this, p); this.providence.splice(this.providence.indexOf(m), 1); this.discard.push(m); }
  // ── legal actions ──
  actions(p) {
    const A = []; const liq = this.liquidity(p);
    if (p.reservedThisTurn < 1) for (const c of p.hand) A.push({ t: 'reserve', card: c, cost: 0 });
    for (const c of p.hand) {
      const cost = this.costOf(p, c); if (cost > liq) continue;
      if (c.type === 'court') { A.push({ t: 'hire', card: c, cost }); continue; }
      if (c.suit === 'coins') A.push({ t: 'pip', card: c, cost, choice: {} });
      else if (c.suit === 'candles') for (const i of this.idleEligible(p)) A.push({ t: 'pip', card: c, cost, choice: { inst: i } });
      else if (c.suit === 'cups') for (const o of this.opps(p)) A.push({ t: 'pip', card: c, cost, choice: { opp: o } });
      else { for (const o of this.opps(p)) { for (const i of this.working(o)) A.push({ t: 'pip', card: c, cost, choice: { target: i } }); if (o.portfolio > 0 && !this.modAny(o, 'portfolioSafe')) A.push({ t: 'pip', card: c, cost, choice: { target: o } }); } }
    }
    for (const i of this.idleEligible(p)) { A.push({ t: 'work', inst: i, cost: 0 }); if (i.card.work) A.push({ t: 'work', inst: i, ability: true, cost: 0 }); }
    if (!p.foretold && p.floor.some((i) => i.card.foretell) && this.deck.length) A.push({ t: 'foretell', cost: 0 });
    for (const m of this.providence) if (m.cost <= liq && m.can(this, p) && !(m.id === 'major_0' && p.hailMaryUsed)) A.push({ t: 'invoke', major: m, cost: m.cost });
    return A;
  }
  act(p, a) {
    switch (a.t) {
      case 'reserve': p.hand.splice(p.hand.indexOf(a.card), 1); p.reserve.push({ card: a.card, locked: false }); p.reservedThisTurn++; this.log(`${p.name} reserves ${a.card.name} (Liquidity ${this.liquidity(p)})`); break;
      case 'hire': this.hire(p, a.card); break;
      case 'pip': this.playPip(p, a.card, a.choice); break;
      case 'work': this.work(p, a.inst, { ability: !!a.ability }); break;
      case 'foretell': this.foretell(p); break;
      case 'invoke': this.invoke(p, a.major); break;
    }
  }
  // ── turn ──
  playTurn() {
    const p = this.players[this.turnIdx]; this.active = p;
    if (this.turnIdx === 0) { this.round++; if (this.round > this.rules.maxRounds) { this.over = true; this.reason = 'round limit'; this.endByBell(); return; } }
    this.log(`── Turn ${this.turnCounter}: ${p.name} ──`);
    for (const i of p.floor) i.working = false; p.reserve.forEach((r) => { r.locked = false; }); p.reservedThisTurn = 0; p.foretold = false; p.turnBonusLiquidity = 0;
    // Set
    const div = this.modFirst(p, 'dividend') ?? 1; this.profit(p, div, 'Dividend');
    const idiv = this.modMin(p, 'interestDiv', 10); const im = this.modProduct(p, 'interestMult'); const interest = Math.floor(p.portfolio / idiv) * im; if (interest) this.profit(p, interest, 'Interest');
    p.stats.unbankedSum += p.portfolio; p.stats.sets++;
    let amt = Math.min(p.portfolio, Math.max(0, p.policy.bankAmount(this, p))); const cap = this.modFirst(p, 'bankCap'); if (cap != null) amt = Math.min(amt, cap);
    if (amt) this.bankFromPortfolio(p, amt, 'Set'); else if (p.portfolio) this.log(`${p.name} keeps ${p.portfolio} in Portfolio`);
    if (this.over) { this.snapshot('turn'); return; }
    // Draw
    this.drawMinors(p, this.round === 1 && this.turnIdx === 0 ? Math.min(this.rules.firstTurnDraw, this.rules.minorsPerTurn) : this.rules.minorsPerTurn);
    if (this.over) { this.snapshot('turn'); return; }
    // Main
    p.policy.takeTurn(this, p);
    const last = this.turnIdx === this.players.length - 1; this.turnCounter++;
    this.snapshot('turn');
    if (!this.over && last && this.bellRound != null && this.round >= this.bellRound) this.endByBell();
    this.turnIdx = (this.turnIdx + 1) % this.players.length;
  }
  endByBell() {
    if (this.winner) return; this.over = true;
    const s = [...this.players].sort((a, b) => b.bank - a.bank || b.portfolio - a.portfolio);
    if (s[0].bank === s[1].bank && s[0].portfolio === s[1].portfolio) { this.winner = null; this.reason = 'Final Bell: draw'; } else { this.winner = s[0]; this.reason = `Final Bell: ${s[0].name} leads ${s[0].bank} to ${s[1].bank}`; }
    this.log(`*** ${this.reason} ***`); this.snapshot('end');
  }
  run() { let g = 0; while (!this.over && g++ < 300) this.playTurn(); if (!this.over) { this.over = true; this.reason = 'guard'; } return this.result(); }
  archetype(p) {
    const s = p.stats; const unbanked = s.unbankedSum / Math.max(1, s.sets);
    const sc = { HODLer: unbanked / 8, Contrarian: s.chains / 2.5, Samaritan: s.cups / 2, Analyst: s.foretells / 2 + s.invokes / 2, Opportunist: s.coins / 3, Degen: (p.floor.filter((i) => i.card.villain).length + s.frontrun / 4) * 0.8 + s.hedges * 0.2, Banker: unbanked < 3 ? 1.05 : 0.5 };
    return Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
  }
  result() { return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, reason: this.reason, rounds: this.round, finalBell: this.reason.startsWith('Final Bell'), majorsSeen: this.majorsSeen,
    players: this.players.map((p) => ({ name: p.name, bank: p.bank, portfolio: p.portfolio, archetype: this.archetype(p), stats: { ...p.stats } })), cardPlays: this.cardPlays }; }
}
