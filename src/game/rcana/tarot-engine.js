// Shared-deck engine for the tarot configuration of R-cana.
import { MINORS, MAJORS, byId } from './tarot.js';
import { makeRng } from './engine.js';

export const DEFAULTS = { winBank: 80, openingHand: 8, minorsPerTurn: 1, firstTurnDraw: 0, interestDiv: 5, rotateLead: false, finishRound: false, passMult: 2, passMin: 10, passUnderdogOnly: false, maxRounds: 40, cupsDraw: true,
  // version 1b: Favor and Network. Share (upright Cups) earns Favor; Favor buys Foretells and Our Lady's protection from Events; at most networkCap Personalities; Copy trade an opponent's Working Personality once a turn.
  v1b: false, networkCap: 2, copyCost: 1, copyYield: 'full', copyFavor: true, favorPerShare: 1, foretellFavor: 1, spareFavor: 2,
  // version 1c: the Majors are their own deck revealed at the start of each round (Omen), partners can be replaced at capacity, Hedges are free, Favor comes from Cups only, Our Lady spares only real losses, the Hail Mary stake is capped.
  v1c: false, majorsSeparate: false, replacePartner: false, hedgeFree: false, spareMin: 0, passMax: 0,
  // compensation for the second seat (applied to player index 1 at setup): Reserve chips, Profit in the Portfolio, Favor
  seatLiq: 0, seatProfit: 0, seatFavor: 0,
  // the last-play pass: a Hail Mary may only be thrown when the opponent could win by banking at their next turn; no cap; while it is in the air nobody wins (the clock stops), and the game resolves when it lands
  passLast: false, passNoHedge: false };
export const V1C_PRESET = { v1b: true, majorsSeparate: true, replacePartner: true, hedgeFree: true, copyFavor: false, spareMin: 3, passMax: 20, firstHandPenalty: 0, firstTurnDraw: 1, seatProfit: 8 };
let UID = 1;

export class TarotGame {
  constructor({ players, seed = 1, snapshots = false, rules = {}, hiddenInfo = false }) {
    this.hiddenInfo = hiddenInfo;
    this.rules = { ...DEFAULTS, ...rules }; if (this.rules.v1c) this.rules = { ...this.rules, ...V1C_PRESET, ...rules, v1c: true }; this.rng = makeRng(seed); this.seed = seed; this.snapshotsOn = snapshots;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, deckList: cfg.deckList || null, deckPreset: cfg.deckPreset || null, hand: [], reserve: [], floor: [], portfolio: 0, bank: 0,
      hailMaryUsed: false, pass: null, inAir: 0, bankedThisTurn: 0, reservedThisTurn: 0, foretold: false, turnBonusLiquidity: 0, favor: 0, copiedThisTurn: false,
      stats: { worked: 0, pips: 0, coins: 0, candles: 0, chains: 0, cups: 0, hedges: 0, hires: 0, invokes: 0, liquidated: 0, frontrun: 0, unbankedSum: 0, sets: 0, foretells: 0, passes: 0, completions: 0, interceptions: 0, passBanked: 0, passWins: 0, passOffers: 0, copies: 0, favorGained: 0, favorSpent: 0, spared: 0 } }));
    this.deck = []; this.discard = []; this.market = null; this.providence = []; this.events = []; this.snapshots = []; this.cardPlays = {};
    this.round = 0; this.turnIdx = 0; this.turnCounter = 1; this.active = null; this.over = false; this.winner = null; this.reason = ''; this.bellRound = null; this.current = null; this.majorsSeen = 0; this.closing = false;
    this.setup();
  }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setup() {
    const minors = this.shuffle([...MINORS]);
    for (const p of this.players) { const n = this.rules.openingHand - (p.idx === 0 ? (this.rules.firstHandPenalty || 0) : 0); for (let i = 0; i < n; i++) p.hand.push(minors.shift()); }
    const second = this.players[1]; if (second) { for (let i = 0; i < (this.rules.seatLiq || 0); i++) second.reserve.push({ card: null, locked: false }); second.portfolio += this.rules.seatProfit || 0; second.favor += this.rules.v1b ? (this.rules.seatFavor || 0) : 0; if (this.rules.seatLiq || this.rules.seatProfit || this.rules.seatFavor) this.log(`${second.name} goes second and opens with${this.rules.seatLiq ? ` ${this.rules.seatLiq} Liquidity` : ''}${this.rules.seatProfit ? ` ${this.rules.seatProfit} Profit` : ''}${this.rules.seatFavor && this.rules.v1b ? ` ${this.rules.seatFavor} Favor` : ''}`); }
    if (this.rules.majorsSeparate) { this.deck = this.shuffle([...minors]); this.majors = this.shuffle([...MAJORS]); this.omen = this.majors.shift(); this.log(`The Minors are shuffled: ${this.deck.length} cards; each Trader holds ${this.rules.openingHand}. The 22 Majors are shuffled; the first lies face-down as the Omen.`); }
    else { this.deck = this.shuffle([...minors, ...MAJORS]); this.log(`The R-cana is shuffled: ${this.deck.length} cards. Each Trader holds ${this.rules.openingHand}.`); }
    this.snapshot('setup');
  }
  log(t) { this.events.push(`${this.active ? `[R${this.round} ${this.active.name}] ` : '[setup] '}${t}`); }
  snapshot(label) {
    if (!this.snapshotsOn) { this.events = []; return; }
    this.snapshots.push(this.makeSnapshot(label)); this.events = [];
  }
  makeSnapshot(label) {
    return { label, round: this.round, turn: this.turnCounter, active: this.active ? this.active.name : null, bell: this.bellRound, market: this.market ? this.market.name : null,
      providence: this.providence.map((m) => m.name), deckLeft: this.deck.length, majorsLeft: this.majors ? this.majors.length : null, omen: !!this.omen, projected: this.players.map((q) => this.projectedBank(q)), over: this.over, winner: this.winner ? this.winner.name : null, reason: this.reason, events: this.events,
      players: this.players.map((p) => ({ name: p.name, bank: p.bank, portfolio: p.portfolio, favor: p.favor, pass: p.pass ? p.inAir : null, passUsed: p.hailMaryUsed, hand: p.hand.map((c) => c.name), reserve: p.reserve.length, locked: p.reserve.filter((r) => r.locked).length, archetype: this.archetype(p),
        floor: p.floor.map((i) => ({ name: i.card.name, title: i.card.title, suit: i.card.suit, working: i.working, drawdown: i.drawdown, res: i.card.res, yield: this.yieldOf(p, i), shielded: !!i.shielded, armor: i.armor || 0, canWork: this.canWork(p, i) })) })) };
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
    let y = b + bonus + (inst.bonusYield || 0) + this.modSum(p, 'yield', inst); y = this.modChain(p, 'yieldFinal', y, inst); return Math.max(0, y);
  }
  costOf(p, c) { const ov = this.modFirst(p, 'costOverride', c); if (ov != null) return ov; return Math.max(0, c.cost + this.modSum(p, 'cost', c)); }
  isHedged(p, inst) { return !!inst.card.kw.hedged; }
  // ── economy ──
  profit(p, n, why) { if (n <= 0 || this.over) return 0; p.portfolio += n; this.log(`${p.name} +${n} Profit (${why}) → Portfolio ${p.portfolio}`); return n; }
  bankRoom(p) { const cap = this.modFirst(p, 'bankCap'); return cap == null ? Infinity : Math.max(0, cap - p.bankedThisTurn); }
  bank(p, n, why) {
    if (n <= 0 || this.over) return; const room = this.bankRoom(p); const b = Math.min(n, room); const rest = n - b;
    if (b > 0) { p.bank += b; p.bankedThisTurn += b; this.log(`${p.name} banks ${b} directly (${why}) → Bank ${p.bank}`); }
    if (rest > 0) { p.portfolio += rest; this.log(`THE BAG HOLDER: ${rest} of it lands in ${p.name}'s Portfolio instead`); }
    if (b > 0) this.checkWin(p);
  }
  bankFromPortfolio(p, n, why) {
    n = Math.min(n, p.portfolio, this.bankRoom(p)); if (n <= 0 || this.over) return;
    p.portfolio -= n; p.bank += n; p.bankedThisTurn += n; this.log(`${p.name} banks ${n} (${why}) → Bank ${p.bank}, Portfolio ${p.portfolio}`); this.checkWin(p);
  }
  projectedBank(o) { // what the opponent can have banked by the end of their next turn, by every visible route: the Portfolio with its Dividend and bonus, a pass landing doubled, THE VAULT from Providence
    const div = (this.modFirst(o, 'dividend') ?? 1) + this.modSum(o, 'dividendDelta'); const after = o.portfolio + div; const idiv = this.modMin(o, 'interestDiv', this.rules.interestDiv); const bonus = Math.floor(after / idiv) * this.modProduct(o, 'interestMult');
    const landing = o.pass ? Math.floor(o.inAir * this.rules.passMult) : 0; const vault = this.providence.some((m) => m.id === 'major_9') && o.reserve.length >= 1 ? 5 : 0;
    const cap = this.modFirst(o, 'bankCap'); const banked = cap == null ? after + bonus + vault : Math.min(after + bonus + vault, cap);
    return o.bank + landing + banked;
  }
  wouldWinNext(o) { return this.projectedBank(o) >= this.rules.winBank; }
  clockStopped(p) { return this.rules.passLast && this.players.some((q) => q !== p && q.pass); }
  resumeClock() { // a pass has landed or fallen: whoever is over the line now wins, the larger Bank first
    if (this.over || !this.rules.passLast) return; const s = [...this.players].filter((q) => q.bank >= this.rules.winBank).sort((a, b) => b.bank - a.bank || b.portfolio - a.portfolio);
    if (!s.length) return; if (this.rules.finishRound) { this.checkWin(s[0]); return; }
    const w = s[0]; this.over = true; this.winner = w; this.reason = `${w.name} banked ${w.bank}`; if (w.justLanded) w.stats.passWins++; this.log(`*** ${w.name} WINS with ${w.bank} banked${s.length > 1 ? ` (over ${s[1].name}'s ${s[1].bank})` : ''} ***`);
  }
  checkWin(p) {
    if (this.over || p.bank < this.rules.winBank) return;
    if (this.rules.passLast && p.justLanded) return; // the landing resolves through resumeClock, larger Bank first
    if (this.clockStopped(p)) { this.log(`${p.name} has ${p.bank} banked, but a Hail Mary is in the air: the clock is stopped until it lands`); return; }
    if (this.rules.finishRound) { if (!this.closing) { this.closing = true; this.log(`${p.name} reaches ${p.bank}: the round is played out, then the largest Bank wins`); } return; }
    this.over = true; this.winner = p; this.reason = `${p.name} banked ${p.bank}`; this.log(`*** ${p.name} WINS with ${p.bank} banked ***`);
  }
  loseProfit(p, n, why) {
    if (this.over) return 0; const cur = this.current; const hostile = !cur || cur.attacker !== p;
    if (n <= 0) { if (cur && cur.kind === 'major' && p.pass) { if (this.rules.v1b && p.favor >= this.rules.spareFavor) { p.favor -= this.rules.spareFavor; p.stats.favorSpent += this.rules.spareFavor; p.stats.spared++; this.log(`✧ OUR LADY SPARES ${p.name}'s pass from ${why} (${this.rules.spareFavor} Favor given) → Favor ${p.favor}`); } else this.knockDown(p, why, null); } return 0; }
    if (cur && cur.victim === p && cur.reduce) { const r = Math.min(n, cur.reduce); n -= r; cur.reduce -= r; if (r) this.log(`${p.name}'s Hedge absorbs ${r}`); }
    if (hostile && this.modAny(p, 'portfolioSafe') && cur && cur.kind === 'chain') { this.log(`${p.name}'s Portfolio is protected by CONVICTION`); return 0; }
    const fromEvent = cur && cur.kind === 'major';
    if (fromEvent && this.rules.v1b && p.favor >= this.rules.spareFavor && (p.pass || (p.portfolio > 0 && Math.min(n, p.portfolio) >= (this.rules.spareMin || 0)))) { p.favor -= this.rules.spareFavor; p.stats.favorSpent += this.rules.spareFavor; p.stats.spared++; this.log(`✧ OUR LADY SPARES ${p.name} from ${why} (${this.rules.spareFavor} Favor given) → Favor ${p.favor}`); return 0; }
    if (fromEvent && p.pass) this.knockDown(p, why, null);
    const a = Math.min(n, p.portfolio); if (a <= 0) return 0; p.portfolio -= a; this.log(`${p.name} loses ${a} Profit (${why}) → Portfolio ${p.portfolio}`);
    return a;
  }
  gainFavor(p, n, why) { if (n <= 0 || !this.rules.v1b) return; p.favor += n; p.stats.favorGained += n; this.log(`✧ ${p.name} +${n} Favor (${why}) → Favor ${p.favor}`); }
  hasFavor(p, n) { return this.rules.v1b && p.favor >= n; }
  frontrun(att, victim, n) { const got = this.loseProfit(victim, n, `Front-run by ${att.name}`); if (got) { att.portfolio += got; att.stats.frontrun += got; this.log(`${att.name} front-runs ${got} → Portfolio ${att.portfolio}`); } return got; }
  pay(p, n) { if (n <= 0) return true; if (this.liquidity(p) < n) return false; const t = Math.min(n, p.turnBonusLiquidity); p.turnBonusLiquidity -= t; n -= t; for (const r of p.reserve) { if (n <= 0) break; if (!r.locked) { r.locked = true; n--; } } return true; }
  drawdown(inst, n, why) {
    const o = inst.owner; if (!o.floor.includes(inst) || this.over) return; const cur = this.current;
    if (cur && cur.victim === o && cur.reduce) { const r = Math.min(n, cur.reduce); n -= r; cur.reduce -= r; if (r) this.log(`${o.name}'s Hedge absorbs ${r}`); }
    n += this.modSum(o, 'incomingDd', inst); if (this.isHedged(o, inst)) n -= 1; if (inst.armor) { const a = Math.min(n, inst.armor); n -= a; if (a) this.log(`${inst.card.name}'s Collateral absorbs ${a}`); } n = Math.max(0, n); if (!n) return;
    inst.drawdown += n; this.log(`${inst.card.name} (${o.name}) takes ${n} Drawdown (${why}) → ${inst.drawdown}/${inst.card.res}`);
    if (inst.drawdown >= inst.card.res) this.liquidate(inst, why);
  }
  release(inst) { // a partner let go to make room: departure effects apply
    const o = inst.owner; if (!o.floor.includes(inst)) return; o.floor.splice(o.floor.indexOf(inst), 1); this.discard.push(inst.card); this.log(`${o.name} lets ${inst.card.name} go`);
    const scam = inst.card.kw.exitScam || 0; if (scam) { const s = this.current; this.current = null; this.loseProfit(o, scam, 'Exit Scam'); this.current = s; }
  }
  liquidate(inst, why) {
    const o = inst.owner; o.floor.splice(o.floor.indexOf(inst), 1); o.stats.liquidated++; this.discard.push(inst.card);
    this.log(`${inst.card.name} (${o.name}) is LIQUIDATED (${why})`);
    const scam = inst.card.kw.exitScam || 0; if (scam) { const s = this.current; this.current = null; this.loseProfit(o, scam, 'Exit Scam'); this.current = s; }
    this.drawMinors(o, 1);
  }
  // ── deck ──
  drawOne(p) { // returns the Minor drawn, resolving Majors on the way; null if deck empty
    if (!this.deck.length && this.rules.majorsSeparate) { const m = this.discard.filter((c) => c.type !== 'major'); if (m.length) { this.discard = this.discard.filter((c) => c.type === 'major'); this.deck = this.shuffle(m); this.log(`The Minor discards are shuffled into a new deck of ${this.deck.length}`); } }
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
  buryThreshold() { return this.rules.majorsSeparate ? 10 : 34; }
  bury(c) {
    if (this.rules.majorsSeparate) { const half = Math.floor(this.majors.length / 2); this.majors.splice(half + Math.floor(this.rng() * (this.majors.length - half + 1)), 0, c); this.log(`${c.name} is buried in the bottom half of the Majors`); c.buried = true; return; } const half = Math.floor(this.deck.length / 2); const pos = half + Math.floor(this.rng() * (this.deck.length - half + 1)); this.deck.splice(pos, 0, c); this.log(`${c.name} is buried in the bottom half of the R-cana`); c.buried = true; }
  callBell(why) { if (this.bellRound == null) { this.bellRound = this.round; this.log(`FINAL BELL (${why}): the game ends after round ${this.round}`); } }
  oracle() { const pile = this.rules.majorsSeparate ? this.majors : this.deck; const top = pile.splice(0, 3); if (!top.length) return; const ud = this.rules.v1b ? [...this.players].sort((a, b) => b.favor - a.favor || (a === this.active ? -1 : 1))[0] : (this.players.filter((q) => this.isUnderdog(q))[0] || this.active || this.players[0]); this.log(`THE ORACLE shows ${top.map((c) => c.name).join(', ')}; ${ud.name} reorders`); pile.unshift(...ud.policy.reorder(this, ud, top)); }
  rotatePortfolios() { const vals = this.players.map((q) => q.portfolio); this.players.forEach((q, i) => { q.portfolio = vals[(i + 1) % vals.length]; }); this.log(`VOLATILITY: Portfolios rotate → ${this.players.map((q) => `${q.name} ${q.portfolio}`).join(', ')}`); }
  async foretell(p) {
    if (this.rules.majorsSeparate) { if (!this.omen || p.foretold) return; p.foretold = true; p.stats.foretells++; const show = !this.hiddenInfo || p.policy.human; this.log(`${p.name} foretells the Omen${show ? `: ${this.omen.name}` : ''}`); if (await p.policy.bottomCard(this, p, this.omen)) { this.majors.push(this.omen); this.omen = this.majors.shift(); this.log(`${p.name} sends it to the bottom`); } return; }
    if (!this.deck.length || p.foretold) return; p.foretold = true; p.stats.foretells++; const top = this.deck[0]; const show = !this.hiddenInfo || p.policy.human; this.log(`${p.name} foretells${show ? `: ${top.name}` : ''}`); if (await p.policy.bottomCard(this, p, top)) { this.deck.push(this.deck.shift()); this.log(`${p.name} sends ${show ? top.name : 'it'} to the bottom`); } }
  // ── plays ──
  count(c) { this.cardPlays[c.name] = (this.cardPlays[c.name] || 0) + 1; }
  hire(p, c) { const cost = this.costOf(p, c); if (!this.pay(p, cost)) return null; p.hand.splice(p.hand.indexOf(c), 1); this.count(c); p.stats.hires++;
    const inst = { uid: UID++, card: c, owner: p, working: false, drawdown: 0, hiredTurn: this.turnCounter }; p.floor.push(inst);
    this.log(`${p.name} ${this.rules.v1b ? 'partners with' : 'hires'} ${c.name} (${c.title}) for ${cost}`); if (c.onHired) c.onHired(this, p, inst); return inst; }
  work(p, inst, { bonus = 0, ability = false } = {}) {
    inst.working = true; p.stats.worked++;
    if (ability && inst.card.work) { this.log(`${p.name} puts ${inst.card.name} to Work: ability`); inst.card.work(this, p, inst); }
    else { const y = this.yieldOf(p, inst, bonus); this.log(`${p.name} puts ${inst.card.name} to Work${bonus ? ` (+${bonus})` : ''}`); this.profit(p, y, `${inst.card.name} Yield`); }
  }
  async playPip(p, c, choice) {
    const cost = this.costOf(p, c); if (!this.pay(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); this.count(c); p.stats.pips++; p.stats[c.suit]++;
    const r = c.rank;
    this.log(`${p.name} plays ${c.name} for ${cost}${choice && choice.target ? ` → ${choice.target.card ? choice.target.card.name : choice.target.name}` : ''}`);
    if (c.suit === 'coins') this.profit(p, r + this.modSum(p, 'coinsBonus'), c.name);
    else if (c.suit === 'candles') { const inst = choice.inst; this.work(p, inst, { bonus: r * this.modProduct(p, 'candlesMult') + this.modSum(p, 'candlesBonus') }); }
    else if (c.suit === 'cups') { const o = choice.opp; const give = Math.ceil(r / 2); const mult = this.modProduct(p, 'cupsMult'); this.profit(o, give * mult, `${c.name} from ${p.name}`); this.profit(p, r * mult + this.modSum(p, 'cupsBonus'), c.name); if (this.rules.cupsDraw) this.drawMinors(p, 1); this.gainFavor(p, this.rules.favorPerShare, c.name); for (const i of [...p.floor]) if (i.card.onCup && p.floor.includes(i)) i.card.onCup(this, p, i); }
    else if (c.suit === 'chains') {
      const amount = r * this.modProduct(p, 'chainsMult') + this.modSum(p, 'chainsBonus'); const t = choice.target; const victim = t.card || t.isPass ? t.owner : t;
      this.current = { kind: 'chain', card: c, attacker: p, victim, reduce: 0, amount };
      await this.offerHedge(victim, { card: c, attacker: p, target: t, amount });
      if (t.isPass) this.intercept(p, victim, amount); else if (t.card) { if (victim.floor.includes(t)) this.drawdown(t, amount, c.name); } else this.frontrun(p, victim, amount);
      this.current = null;
    }
    this.discard.push(c); return true;
  }
  async offerHedge(victim, threat) {
    if (this.rules.passNoHedge && threat.target && threat.target.isPass) return; // a pass in the air cannot be Hedged
    const opts = victim.hand.filter((c) => c.type === 'pip' && c.suit === 'chains' && (this.rules.hedgeFree || this.costOf(victim, c) <= this.liquidity(victim)));
    if (!opts.length) return; const ch = await victim.policy.wantHedge(this, victim, opts, threat); if (!ch) return;
    if (!this.rules.hedgeFree) this.pay(victim, this.costOf(victim, ch)); victim.hand.splice(victim.hand.indexOf(ch), 1); this.discard.push(ch); victim.stats.hedges++; this.count(ch);
    this.current.reduce += ch.rank; this.log(`${victim.name} HEDGES with ${ch.name} (reduces by ${ch.rank})`);
  }
  copyTrade(p, inst) {
    if (!this.pay(p, this.rules.copyCost)) return; const o = inst.owner; p.copiedThisTurn = true; p.stats.copies++;
    const y = this.yieldOf(o, inst); const mine = this.rules.copyYield === 'full' ? y : Math.ceil(y / 2); this.log(`${p.name} COPY TRADES ${inst.card.name} (locks ${this.rules.copyCost})`);
    this.profit(p, mine, `copy of ${inst.card.name}`); this.profit(o, 1, `${p.name} follows ${inst.card.name}`); if (this.rules.copyFavor) this.gainFavor(p, 1, 'copy trade');
  }
  invoke(p, m) { if (!this.pay(p, m.cost)) return; p.stats.invokes++; this.log(`${p.name} INVOKES ${m.name} (locks ${m.cost})`); m.run(this, p); this.providence.splice(this.providence.indexOf(m), 1); this.discard.push(m); }
  // ── legal actions ──
  actions(p) {
    const A = []; const liq = this.liquidity(p);
    if (p.reservedThisTurn < 1) for (const c of p.hand) A.push({ t: 'reserve', card: c, cost: 0 });
    for (const c of p.hand) {
      const cost = this.costOf(p, c); if (cost > liq) continue;
      if (c.type === 'court') { if (!this.rules.v1b || p.floor.length < this.rules.networkCap) A.push({ t: 'hire', card: c, cost }); else if (this.rules.replacePartner) for (const i of p.floor) A.push({ t: 'hire', card: c, cost, replace: i }); continue; }
      if (c.suit === 'coins') A.push({ t: 'pip', card: c, cost, choice: {} });
      else if (c.suit === 'candles') for (const i of this.idleEligible(p)) A.push({ t: 'pip', card: c, cost, choice: { inst: i } });
      else if (c.suit === 'cups') for (const o of this.opps(p)) A.push({ t: 'pip', card: c, cost, choice: { opp: o } });
      else { for (const o of this.opps(p)) { for (const i of this.working(o)) A.push({ t: 'pip', card: c, cost, choice: { target: i } }); if (o.portfolio > 0 && !this.modAny(o, 'portfolioSafe')) A.push({ t: 'pip', card: c, cost, choice: { target: o } }); if (o.pass && o.inAir > 0) A.push({ t: 'pip', card: c, cost, choice: { target: this.passTarget(o) } }); } }
    }
    for (const i of this.idleEligible(p)) { A.push({ t: 'work', inst: i, cost: 0 }); if (i.card.work) A.push({ t: 'work', inst: i, ability: true, cost: 0 }); }
    const virgil = p.floor.some((i) => i.card.foretell);
    if (!p.foretold && (this.rules.majorsSeparate ? !!this.omen : this.deck.length) && (virgil || this.hasFavor(p, this.rules.foretellFavor))) A.push({ t: 'foretell', cost: 0, favor: virgil ? 0 : this.rules.foretellFavor });
    if (this.rules.v1b && !p.copiedThisTurn && liq >= this.rules.copyCost) for (const o of this.opps(p)) for (const i of this.working(o)) A.push({ t: 'copy', inst: i, cost: this.rules.copyCost });
    for (const m of this.providence) if (m.cost <= liq && m.can(this, p)) A.push({ t: 'invoke', major: m, cost: m.cost });
    return A;
  }
  async act(p, a) {
    switch (a.t) {
      case 'reserve': p.hand.splice(p.hand.indexOf(a.card), 1); p.reserve.push({ card: a.card, locked: false }); p.reservedThisTurn++; this.log(`${p.name} reserves ${a.card.name} (Liquidity ${this.liquidity(p)})`); break;
      case 'hire': if (a.replace) { if (this.liquidity(p) < a.cost) break; this.release(a.replace); } this.hire(p, a.card); break;
      case 'pip': await this.playPip(p, a.card, a.choice); break;
      case 'work': this.work(p, a.inst, { ability: !!a.ability }); break;
      case 'foretell': if (a.favor) { p.favor -= a.favor; p.stats.favorSpent += a.favor; this.log(`✧ ${p.name} gives ${a.favor} Favor to Foretell → Favor ${p.favor}`); } await this.foretell(p); break;
      case 'copy': this.copyTrade(p, a.inst); break;
      case 'invoke': this.invoke(p, a.major); break;
    }
  }
  // ── turn ──
  turnOrder() { const n = this.players.length; const lead = this.rules.rotateLead ? (this.round - 1) % n : 0; return Array.from({ length: n }, (_, k) => (lead + k) % n); }
  async playRound() {
    this.round++;
    if (this.round > this.rules.maxRounds) { this.over = true; this.reason = 'round limit'; this.endByBell(); return; }
    const order = this.turnOrder();
    for (let k = 0; k < order.length; k++) { if (this.over) break; this.turnIdx = order[k]; await this.playTurn(order[k], k === 0, k === order.length - 1); }
    if (!this.over && this.closing) { this.landPasses(); const s = [...this.players].sort((a, b) => b.bank - a.bank || b.portfolio - a.portfolio); this.over = true; this.winner = s[0]; this.reason = `${s[0].name} banked ${s[0].bank}`; this.log(`*** ${s[0].name} WINS with ${s[0].bank} banked (round played out) ***`); this.snapshot('end'); }
  }
  async playTurn(idx, firstOfRound, lastOfRound) {
    const p = this.players[idx]; this.active = p;
    this.log(`── Turn ${this.turnCounter}: ${p.name}${firstOfRound ? ' (leads the round)' : ''} ──`);
    if (firstOfRound) await this.startOfRound(p);
    this.phase = 'set';
    if (!this.rules.sharedSet) await this.doSet(p);
    if (this.over) { this.snapshot('turn'); return; }
    // Draw
    const nDraw = this.turnCounter === 1 ? Math.min(this.rules.firstTurnDraw, this.rules.minorsPerTurn) : this.rules.minorsPerTurn;
    if (nDraw > 0 && p.policy.beforeDraw && !this.over) { this.phase = 'draw'; await p.policy.beforeDraw(this, p); }
    this.drawMinors(p, nDraw);
    if (this.over) { this.snapshot('turn'); return; }
    // Main
    this.phase = 'main';
    await p.policy.takeTurn(this, p);
    this.phase = 'end';
    this.turnCounter++;
    this.snapshot('turn');
    if (!this.over && lastOfRound && this.bellRound != null && this.round >= this.bellRound) this.endByBell();
  }
  canPass(p) { return !p.hailMaryUsed && !p.pass && p.portfolio >= (this.rules.passLast ? 1 : this.rules.passMin) && (!this.rules.passUnderdogOnly || this.isUnderdog(p)) && !this.closing && (!this.rules.passLast || this.opps(p).some((o) => this.wouldWinNext(o))); }
  throwPass(p, { extra = false } = {}) {
    if (!extra) p.hailMaryUsed = true; const stake = this.rules.passMax && !this.rules.passLast ? Math.min(p.portfolio, this.rules.passMax) : p.portfolio; p.inAir = stake; p.portfolio -= stake; p.pass = { round: this.round }; p.stats.passes++;
    this.log(`✝ ${p.name} throws a HAIL MARY PASS: ${p.inAir} in the air until the start of their next turn${p.portfolio ? ` (${p.portfolio} stays in the Portfolio)` : ''}. Intercept it, or watch it double.`);
  }
  passTarget(o) { return { isPass: true, owner: o, name: `${o.name}'s Hail Mary Pass` }; }
  // An opponent's Chain aimed at the pass itself. Hedges reduce it; whatever gets through brings the pass down.
  intercept(att, victim, amount) {
    const cur = this.current; let n = amount;
    if (cur && cur.victim === victim && cur.reduce) { const r = Math.min(n, cur.reduce); n -= r; cur.reduce -= r; if (r) this.log(`${victim.name}'s Hedge absorbs ${r}`); }
    if (n <= 0 || !victim.pass) { this.log(`${att.name}'s interception is turned away`); return 0; }
    const stake = victim.inAir; const take = Math.min(n, stake); victim.inAir = 0; victim.pass = null; att.portfolio += take; att.stats.interceptions++; att.stats.frontrun += take; this.passNews(victim, { result: 'intercepted', stake, amount: take, by: att.name });
    this.log(`✝ INTERCEPTED by ${att.name}: ${victim.name}'s Hail Mary Pass falls. ${att.name} takes ${take}; the rest of the ${stake} is lost.`);
    this.resumeClock();
    return take;
  }
  knockDown(p, why, by) { if (!p.pass) return; const stake = p.inAir; p.inAir = 0; p.pass = null; this.passNews(p, { result: 'knocked', stake, amount: 0, by: why }); this.log(`✝ INCOMPLETE: ${p.name}'s Hail Mary Pass falls (${why}). The ${stake} in the air is lost.`); this.resumeClock(); }
  passNews(p, news) { p.lastPass = { ...news, seq: (this.passSeq = (this.passSeq || 0) + 1), round: this.round }; }
  landPasses() { for (const q of this.players) if (q.pass) { this.log(`✝ The Final Bell catches ${q.name}'s Hail Mary Pass in the air: ${q.inAir} returns to their Portfolio, undoubled.`); this.passNews(q, { result: 'returned', stake: q.inAir, amount: q.inAir, by: 'the Final Bell' }); q.portfolio += q.inAir; q.inAir = 0; q.pass = null; } }
  async doSet(p) {
    for (const i of p.floor) i.working = false; p.reserve.forEach((r) => { r.locked = false; }); p.reservedThisTurn = 0; p.copiedThisTurn = false; p.foretold = false; p.turnBonusLiquidity = 0; p.bankedThisTurn = 0;
    // Start of turn: pass lands, Dividend, bonus, bank or throw
    if (p.pass) { const stake = p.inAir; const n = Math.floor(stake * this.rules.passMult); p.inAir = 0; p.pass = null; p.stats.completions++; p.stats.passBanked += n; this.passNews(p, { result: 'complete', stake, amount: n, by: null }); this.log(`✝ COMPLETE: ${p.name}'s Hail Mary Pass comes down. ${stake} in the air banks as ${n}.`); p.justLanded = true; this.bank(p, n, 'Hail Mary Pass'); this.resumeClock(); p.justLanded = false; if (this.over) return; }
    const div = (this.modFirst(p, 'dividend') ?? 1) + this.modSum(p, 'dividendDelta'); this.profit(p, div, 'Dividend');
    const idiv = this.modMin(p, 'interestDiv', this.rules.interestDiv); const im = this.modProduct(p, 'interestMult'); const interest = Math.floor(p.portfolio / idiv) * im; if (interest) this.profit(p, interest, this.rules.v1b ? `Dividend bonus: ${p.portfolio} exposed` : 'Interest');
    p.stats.unbankedSum += p.portfolio; p.stats.sets++;
    if (this.canPass(p)) p.stats.passOffers++;
    if (this.canPass(p) && await p.policy.hailMaryPass(this, p)) { this.throwPass(p); }
    else {
      let amt = Math.min(p.portfolio, Math.max(0, await p.policy.bankAmount(this, p)));
      if (amt) this.bankFromPortfolio(p, amt, 'start of turn'); else if (p.portfolio) this.log(`${p.name} keeps ${p.portfolio} in Portfolio`);
    }
  }
  startOfRound() { if (this.rules.majorsSeparate && this.round >= 1 && !this.over) this.revealOmen(); }
  revealOmen() {
    if (!this.omen) { this.callBell('the Majors are spent'); return; }
    const c = this.omen; this.omen = null; this.revealMajor(c);
    this.omen = this.majors.shift() || null; if (!this.omen && this.bellRound == null) this.callBell('the last Major has been revealed');
  }
  endByBell() {
    if (this.winner) return; this.landPasses(); this.over = true;
    const s = [...this.players].sort((a, b) => b.bank - a.bank || b.portfolio - a.portfolio);
    if (s[0].bank === s[1].bank && s[0].portfolio === s[1].portfolio) { this.winner = null; this.reason = 'Final Bell: draw'; } else { this.winner = s[0]; this.reason = `Final Bell: ${s[0].name} leads ${s[0].bank} to ${s[1].bank}`; }
    this.log(`*** ${this.reason} ***`); this.snapshot('end');
  }
  async run() { let g = 0; while (!this.over && g++ < 100) await this.playRound(); if (!this.over) { this.over = true; this.reason = 'guard'; } return this.result(); }
  archetype(p) {
    const s = p.stats; const unbanked = s.unbankedSum / Math.max(1, s.sets);
    const sc = { HODLer: unbanked / 8, Contrarian: s.chains / 2.5, Samaritan: s.cups / 2, Analyst: s.foretells / 2 + s.invokes / 2, Opportunist: s.coins / 3, Degen: (p.floor.filter((i) => i.card.kw.exitScam).length + s.frontrun / 4) * 0.8 + s.hedges * 0.2, Banker: unbanked < 3 ? 1.05 : 0.5 };
    return Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
  }
  result() { return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, reason: this.reason, rounds: this.round, finalBell: this.reason.startsWith('Final Bell'), majorsSeen: this.majorsSeen,
    players: this.players.map((p) => ({ name: p.name, bank: p.bank, portfolio: p.portfolio, archetype: this.archetype(p), stats: { ...p.stats } })), cardPlays: this.cardPlays }; }
}
