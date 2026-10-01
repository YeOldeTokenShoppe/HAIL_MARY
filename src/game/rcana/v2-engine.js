// Version 2 engine: private Minor decks with reversals, shared Major deck with an Omen slot.
import { TarotGame } from './tarot-engine.js';
import { MAJORS, byId } from './tarot.js';

export const DUEL_DEFAULTS = { firstHandPenalty: 0, firstTurnDraw: 1, revChainsDraw: true, cupsDraw: true, rotateLead: true, finishRound: true };
export class DuelGame extends TarotGame {
  constructor(opts) { super({ ...opts, rules: { ...DUEL_DEFAULTS, ...(opts.rules || {}) } }); }
  setup() {
    for (const p of this.players) { p.deck = this.shuffle([...p.deckList]); const n = this.rules.openingHand - (p.idx === 0 ? (this.rules.firstHandPenalty || 0) : 0); for (let i = 0; i < n; i++) if (p.deck.length) p.hand.push(p.deck.shift()); }
    this.majors = this.shuffle([...MAJORS]); this.deck = this.majors; // Final Bell when the Majors run out
    this.omen = this.majors.shift();
    this.log(`Each Trader shuffles their own 56. The 22 Majors are shuffled; the first lies face-down as the Omen.`);
    this.snapshot('setup');
  }
  buryThreshold() { return 10; }
  drawOne(p) { const c = p.deck.shift(); if (!c) return null; p.hand.push(c); return c; }
  revealOmen() {
    if (!this.omen) { this.callBell('the Majors are spent'); return; }
    const c = this.omen; this.omen = null; this.players.forEach((q) => { q.knowsOmen = false; });
    this.revealMajor(c);
    this.omen = this.majors.shift() || null; if (!this.omen && this.bellRound == null) this.callBell('the last Major has been revealed');
  }
  bury(c) { const half = Math.floor(this.majors.length / 2); this.majors.splice(half + Math.floor(this.rng() * (this.majors.length - half + 1)), 0, c); this.log(`${c.name} is buried in the bottom half of the Majors`); c.buried = true; }
  oracle() { const top = this.majors.splice(0, 3); if (!top.length) return; const ud = this.players.filter((q) => this.isUnderdog(q))[0] || this.active || this.players[0]; this.log(`THE ORACLE shows ${top.map((c) => c.name).join(', ')}; ${ud.name} reorders`); this.majors.unshift(...ud.policy.reorder(this, ud, top)); }
  foretell(p) { if (!this.omen || p.foretold) return; p.foretold = true; p.stats.foretells++; this.log(`${p.name} foretells the Omen: ${this.omen.name}`); if (p.policy.bottomCard(this, p, this.omen)) { this.majors.push(this.omen); this.omen = this.majors.shift(); this.log(`${p.name} sends it to the bottom`); } }
  costOf(p, c) { let base = super.costOf(p, c); if (c.reversed && c.suit === 'cups' && c.type === 'pip') base += (this.rules.revCupsCost || 0); if (c.suit === 'chains' && c.type === 'pip' && !c.reversed) for (const o of this.opps(p)) base += this.modSum(o, 'oppChainsCost'); return base; }
  // reversed pips
  playPip(p, c, choice) {
    if (!c.reversed) return super.playPip(p, c, choice);
    const cost = this.costOf(p, c); if (!this.pay(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); this.count(c); p.stats.pips++; p.stats[c.suit + 'Rev'] = (p.stats[c.suit + 'Rev'] || 0) + 1;
    const h = c.suit === 'cups' ? Math.ceil(c.rank / (this.rules.revCupsTakeDiv || 2)) : Math.ceil(c.rank / 2);
    this.log(`${p.name} plays ${c.name} for ${cost}${choice && choice.opp ? ` → ${choice.opp.name}` : ''}`);
    if (c.suit === 'coins') this.bank(p, h, c.name);
    else if (c.suit === 'candles') { const inst = choice.inst; inst.shielded = true; this.work(p, inst, { bonus: h + this.modSum(p, 'candlesBonus') }); this.log(`${inst.card.name} cannot be targeted until ${p.name}'s next turn`); }
    else if (c.suit === 'cups') { const o = choice.opp; this.current = { kind: 'chain', card: c, attacker: p, victim: o, reduce: 0, amount: h }; this.offerHedge(o, { card: c, attacker: p, target: o, amount: h }); this.frontrun(p, o, h); this.current = null; this.profit(p, Math.max(0, h - (this.rules.revCupsPenalty || 0)) + this.modSum(p, 'revCupsBonus'), c.name); for (const i of [...p.floor]) if (i.card.onRevCup && p.floor.includes(i)) i.card.onRevCup(this, p, i); }
    this.discard.push(c); return true;
  }
  offerHedge(victim, threat) {
    const upright = victim.hand.filter((c) => c.type === 'pip' && c.suit === 'chains' && !c.reversed && this.costOf(victim, c) <= this.liquidity(victim));
    const reversed = victim.hand.filter((c) => c.type === 'pip' && c.suit === 'chains' && c.reversed);
    const opts = [...reversed, ...upright]; if (!opts.length) return;
    const ch = victim.policy.wantHedge(this, victim, opts, threat); if (!ch) return;
    if (!ch.reversed) this.pay(victim, this.costOf(victim, ch));
    victim.hand.splice(victim.hand.indexOf(ch), 1); this.discard.push(ch); victim.stats.hedges++; this.count(ch);
    const absorb = ch.reversed ? ch.rank + 2 + (this.rules.revChainsBonus || 0) : ch.rank; this.current.reduce += absorb; this.log(`${victim.name} HEDGES with ${ch.name} (absorbs ${absorb}${ch.reversed ? ', free' : ''})`);
    if (ch.reversed && this.rules.revChainsDraw) this.drawMinors(victim, 1);
  }
  drawdown(inst, n, why) { if (inst.shielded && this.current && this.current.attacker && this.current.attacker !== inst.owner) { this.log(`${inst.card.name} is shielded`); return; } super.drawdown(inst, n, why); }
  actions(p) {
    const A = super.actions(p).filter((a) => !(a.t === 'pip' && a.card.suit === 'chains' && a.card.reversed) && !(a.t === 'pip' && a.card.suit === 'chains' && a.choice.target && a.choice.target.shielded));
    // reversed Cups target an opponent (take); super enumerated them as 'opp' choices already via suit 'cups'
    if (!p.foretold && p.floor.some((i) => i.card.foretell) && this.omen) { if (!A.some((a) => a.t === 'foretell')) A.push({ t: 'foretell', cost: 0 }); }
    return A.filter((a) => !(a.t === 'foretell' && !this.omen));
  }
  startOfRound() { if (this.round >= 1 && !this.over) this.revealOmen(); for (const q of this.players) for (const i of q.floor) if (i.owner === this.active) i.shielded = false; }
  playTurn(idx, firstOfRound, lastOfRound) { const p = this.players[idx]; for (const i of p.floor) i.shielded = false; super.playTurn(idx, firstOfRound, lastOfRound); }
  result() { const r = super.result(); r.players.forEach((q, i) => { q.deckPreset = this.players[i].deckPreset; }); return r; }
}
