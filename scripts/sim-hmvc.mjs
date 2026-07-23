// HMVC design-gate sim (CASE_TABLE.md §10.4). Run: node scripts/sim-hmvc.mjs
//
// Models the §10.1 loop: seeded sessions of deals — a spread of prospects is
// revealed, the policy places one as its ACTIVE deal (or passes), optionally
// researches it (research costs rounds while the price moves), takes a
// position, rides the curve, exits or gets caught. Prospects are instanced
// from the REAL coin archetype deck (cards.js caseRef pattern/outcome +
// volatility) with rolled parameters and a legit-exception rate, per §10.2.
//
// Policy bots: researcher (research → pass/short rugs, long solids, sized by
// conviction) · alwaysin (researcher forced to enter — measures whether
// passing pays) · viber (momentum + trailing stop, no research) · rugrider
// (finds rugs and deliberately rides the pump) · coinflip (random).
//
// The five §10.4 gates are asserted at the bottom — exit 1 on any failure.
// Tuned constants live in TUNE; findings recorded in CASE_TABLE.md §10.4a.
import { readFileSync } from "node:fs";

const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
};
const { COIN_CARDS } = await load("../src/game/terminal-traders/cards.js");

const RUNS = 2000;
const TUNE = {
  rounds: 40,            // session length
  startBook: 100,
  ruinAt: 25,            // margin call: the house pulls the book at 75% drawdown
  spread: 3,             // prospects revealed per deal
  history: 5,            // pre-rolled price rounds visible at the spread
  sigmaBase: 0.026, sigmaPerVol: 0.011,
  fee: 0.015,            // entry cost: spread + slippage, charged on size
  driftSolid: 0.012, driftFade: -0.02, driftPump: 0.05,
  collapseMin: 4, collapseMax: 18, salvageMin: 0.05, salvageMax: 0.25,
  sigAccuracy: 0.78,     // research signal accuracy (honest, profile-anchored)
  // exception rates: archetype outcome → true class distribution (§10.2 —
  // pattern-reading stays probabilistic, never lookup)
  classByOutcome: {
    rug:    { RUG: 0.78, FADE: 0.10, SOLID: 0.12 },
    zombie: { RUG: 0.18, FADE: 0.62, SOLID: 0.20 },
    legit:  { RUG: 0.10, FADE: 0.20, SOLID: 0.70 },
  },
};

// ── PRNG (mulberry32 — house standard) ─────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randn = (rand) => {
  const u = Math.max(rand(), 1e-9), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// ── Prospect instancing (§10.2) ────────────────────────────────────────
const ARCHETYPES = COIN_CARDS.map((c) => ({
  id: c.id, outcome: c.caseRef.outcome, vol: c.volatility,
}));
const BASE_RATE = (() => {
  const acc = { RUG: 0, FADE: 0, SOLID: 0 };
  for (const a of ARCHETYPES) {
    const d = TUNE.classByOutcome[a.outcome];
    for (const k of Object.keys(acc)) acc[k] += d[k] / ARCHETYPES.length;
  }
  return acc;
})();

function instanceToken(rand) {
  const arch = ARCHETYPES[Math.floor(rand() * ARCHETYPES.length)];
  const dist = TUNE.classByOutcome[arch.outcome];
  let roll = rand(), cls = "SOLID";
  for (const k of ["RUG", "FADE", "SOLID"]) { roll -= dist[k]; if (roll <= 0) { cls = k; break; } }
  const t = {
    arch, cls,
    sigma: TUNE.sigmaBase + TUNE.sigmaPerVol * arch.vol,
    collapseAt: cls === "RUG"
      ? TUNE.collapseMin + Math.floor(rand() * (TUNE.collapseMax - TUNE.collapseMin + 1))
      : Infinity,
    salvage: TUNE.salvageMin + rand() * (TUNE.salvageMax - TUNE.salvageMin),
    age: 0, price: 1, peak: 1, collapsed: false, hist: [],
  };
  for (let i = 0; i < TUNE.history; i++) step(t, rand); // the market pre-exists you
  return t;
}

function step(t, rand) {
  t.age += 1;
  if (t.cls === "RUG" && !t.collapsed && t.age >= t.collapseAt) {
    t.price *= t.salvage;
    t.collapsed = true;
  } else {
    const drift = t.collapsed ? TUNE.driftFade
      : t.cls === "SOLID" ? TUNE.driftSolid
      : t.cls === "FADE" ? TUNE.driftFade
      : TUNE.driftPump; // pre-collapse rug pumps
    t.price *= Math.max(0.01, 1 + drift + t.sigma * randn(rand));
  }
  t.peak = Math.max(t.peak, t.price);
  t.hist.push(t.price);
}

// Research: one round per signal; honest — drawn from the true class.
function signalFor(t, rand) {
  if (rand() < TUNE.sigAccuracy) return t.cls;
  return ["RUG", "FADE", "SOLID"].filter((k) => k !== t.cls)[Math.floor(rand() * 2)];
}
function posterior(signals) {
  const p = { ...BASE_RATE };
  for (const s of signals) {
    for (const k of Object.keys(p)) p[k] *= (k === s ? TUNE.sigAccuracy : (1 - TUNE.sigAccuracy) / 2);
  }
  const z = p.RUG + p.FADE + p.SOLID;
  return { RUG: p.RUG / z, FADE: p.FADE / z, SOLID: p.SOLID / z };
}
const momentum = (t) => t.hist.length >= 4 ? t.hist[t.hist.length - 1] / t.hist[t.hist.length - 4] - 1 : 0;

// ── The session loop ───────────────────────────────────────────────────
// policy = { select(spread), researchN, decide(post, tok), exit(state, tok) }
function runSession(policy, seed) {
  const rand = mulberry32(seed);
  let book = TUNE.startBook, rounds = TUNE.rounds;
  const split = { res: 0, resN: 0, unres: 0, unresN: 0 };
  while (rounds > 0 && book > TUNE.ruinAt) {
    const spread = Array.from({ length: TUNE.spread }, () => instanceToken(rand));
    const tok = spread[policy.select(spread, rand)];
    const signals = [];
    for (let i = 0; i < policy.researchN && rounds > 0; i++) {
      signals.push(signalFor(tok, rand));
      step(tok, rand); rounds -= 1; // knowing is slow: the price moves while you read
    }
    if (rounds <= 0) break;
    const post = posterior(signals);
    const call = policy.decide(post, tok, rand);
    rounds -= 1; // evaluating/passing a deal costs a round
    if (call.action === "pass") continue;
    const entry = tok.price, size = call.size * book, dir = call.action === "long" ? 1 : -1;
    const state = { held: 0, entry, peakSince: tok.price };
    let pnl = -size * TUNE.fee; // the desk charges you on the way in
    while (rounds > 0) {
      step(tok, rand); rounds -= 1; state.held += 1;
      state.peakSince = Math.max(state.peakSince, tok.price);
      pnl = -size * TUNE.fee + (dir === 1
        ? size * (tok.price / entry - 1)
        : Math.max(-1.2 * size, size * (1 - tok.price / entry))); // shorts: capped squeeze
      if (policy.exit(state, tok, post, pnl / size)) break;
    }
    book += pnl;
    if (signals.length > 0) { split.res += pnl; split.resN += 1; } else { split.unres += pnl; split.unresN += 1; }
  }
  return { book: Math.max(0, book), ruined: book <= TUNE.ruinAt, split };
}

// ── Policies ───────────────────────────────────────────────────────────
const pickMomentum = (spread) => spread.reduce((b, t, i, a) => momentum(t) > momentum(a[b]) ? i : b, 0);
const POLICIES = {
  researcher: {
    select: () => 0, researchN: 3,
    decide: (post) => {
      if (post.RUG > 0.55) return { action: "short", size: 0.3 };
      if (post.SOLID > 0.5) return { action: "long", size: 0.25 + 0.5 * post.SOLID };
      return { action: "pass" };
    },
    exit: (s, t, post, r) =>
      (post.RUG > 0.55 ? (r >= 0.4 || r <= -0.2 || s.held >= 12) : (r >= 0.25 || r <= -0.15 || s.held >= 10)),
  },
  alwaysin: {
    select: () => 0, researchN: 3,
    decide: (post) => post.RUG > Math.max(post.SOLID, post.FADE)
      ? { action: "short", size: 0.3 }
      : { action: "long", size: 0.25 + 0.5 * post.SOLID },
    exit: (s, t, post, r) =>
      (post.RUG > 0.55 ? (r >= 0.4 || r <= -0.2 || s.held >= 12) : (r >= 0.25 || r <= -0.15 || s.held >= 10)),
  },
  viber: {
    select: pickMomentum, researchN: 0,
    decide: (post, tok) => {
      const m = momentum(tok);
      // the seasoned viber's one skill: parabolic candles are exit liquidity
      return m > 0.03 && m < 0.14 ? { action: "long", size: 0.35 } : { action: "pass" };
    },
    exit: (s, t, post, r) => (t.price <= s.peakSince * 0.91 || r >= 0.25 || s.held >= 10),
  },
  rugrider: {
    // One quick check, then rides ANY strong pump degen-sized — knowing it's
    // probably a rug is the point; the plan is being gone before the floor is.
    select: pickMomentum, researchN: 1,
    decide: (post, tok) => (momentum(tok) > 0.1 || post.RUG > 0.45)
      ? { action: "long", size: 0.75 }
      : { action: "pass" },
    exit: (s, t, post, r) => (t.price <= s.peakSince * 0.87 || r >= 0.6 || s.held >= 12),
  },
  coinflip: {
    select: (spread, rand) => Math.floor(rand() * spread.length), researchN: 0,
    decide: (post, tok, rand) => rand() < 0.6 ? { action: "long", size: 0.3 } : { action: "pass" },
    exit: (s) => s.held >= 3 + Math.floor(6 * ((s.entry * 997) % 1)),
  },
};

// ── Run + report ───────────────────────────────────────────────────────
const results = {};
for (const [name, policy] of Object.entries(POLICIES)) {
  const books = [], batches = [0, 0, 0, 0], batchN = RUNS / 4;
  let ruins = 0, res = 0, resN = 0, unres = 0, unresN = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = runSession(policy, (i + 1) * 7919);
    books.push(r.book);
    batches[Math.floor(i / batchN)] += r.book / batchN;
    if (r.ruined) ruins += 1;
    res += r.split.res; resN += r.split.resN;
    unres += r.split.unres; unresN += r.split.unresN;
  }
  books.sort((a, b) => a - b);
  results[name] = {
    mean: books.reduce((x, y) => x + y, 0) / RUNS,
    p10: books[Math.floor(RUNS * 0.1)], p50: books[Math.floor(RUNS * 0.5)], p90: books[Math.floor(RUNS * 0.9)],
    ruin: (ruins / RUNS) * 100, batches,
    resPerDeal: resN ? res / resN : null, unresPerDeal: unresN ? unres / unresN : null,
  };
}

console.log(`=== HMVC design-gate sim (${RUNS} sessions/policy, ${TUNE.rounds} rounds) ===`);
console.log("policy       mean book    p10    p50    p90   ruin%   P&L/researched deal   P&L/unresearched");
for (const [name, r] of Object.entries(results)) {
  console.log(
    name.padEnd(12),
    r.mean.toFixed(1).padStart(9),
    r.p10.toFixed(0).padStart(6), r.p50.toFixed(0).padStart(6), r.p90.toFixed(0).padStart(6),
    r.ruin.toFixed(1).padStart(6) + "%",
    String(r.resPerDeal === null ? "—" : r.resPerDeal.toFixed(2)).padStart(12),
    String(r.unresPerDeal === null ? "—" : r.unresPerDeal.toFixed(2)).padStart(12),
  );
}

// ── §10.4 gates ────────────────────────────────────────────────────────
let failures = 0;
const gate = (label, ok) => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
};
const R = results;
console.log("\n=== gates (§10.4) ===");
gate("G1 research edge visible, not crushing: researcher beats viber by 5-60 pts; viber beats coinflip",
  R.researcher.mean - R.viber.mean >= 5 && R.researcher.mean - R.viber.mean <= 60 &&
  R.viber.mean > R.coinflip.mean);
// §10.4's words, formalized in absolutes: the best-timed decile wins BIG
// (+30% sessions — the siren call is real), the tail is genuinely ruinous
// (margin-called at least 1-in-5), and the habit loses to research by a
// wide statistical margin. (v1 compared rider p90 to the researcher's —
// stricter than the spec intends; the rider's ceiling needn't rival the
// grinder's, it needs to be seductive.)
gate("G2 ride-the-rug: top decile ≥ +30%, ruin ≥ 20%, mean trails research by 20+",
  R.rugrider.p90 >= 130 && R.rugrider.ruin >= 20 &&
  R.rugrider.mean <= R.researcher.mean - 20);
gate("G3 skill dominance: researcher ≥ coinflip +20 pts; ordering stable across 4 seed batches",
  R.researcher.mean - R.coinflip.mean >= 20 &&
  R.researcher.batches.every((b, i) => b > R.viber.batches[i] && R.viber.batches[i] > R.coinflip.batches[i]));
gate("G4 ruin real but not dominant at honest sizing: 0 < researcher ruin ≤ 12%",
  R.researcher.ruin > 0 && R.researcher.ruin <= 12);
gate("G5 passing is respectable: researcher (with passing) ≥ alwaysin (forced entry)",
  R.researcher.mean >= R.alwaysin.mean);

if (failures) {
  console.error(`\n${failures} gate(s) FAILED — tune TUNE/policies before building any UI.`);
  process.exit(1);
}
console.log("\nAll §10.4 gates passed.");
