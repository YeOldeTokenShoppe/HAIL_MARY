// Case Table — balance-sim engine (CASE_TABLE.md §4, mock phase A).
// Pure, seeded, dependency-free, same discipline as engine.js: cases and
// signals are passed IN (see caseSignals.js), nothing is imported, so the
// scripts/ data:-URL loader can run it headlessly.
//
// Scope: the numbers, not the fun. Models the docket loop — scans → beliefs
// → positions → payouts → docket events — to tune the payout curve and the
// bot calibration parameters before any UI exists. Deliberately absent:
// kits/cards (approximated by scan-count experiments), Cred, table talk,
// patternRefs (Eugene runs on seeded noise), shields (crash hits everyone).

export const TABLE_RULES = {
  startPortfolio: 100,
  stake: 25,              // fixed-stake v1 (§4.3)
  scansPerSeat: 2,        // investigation actions spent scanning
  beliefScale: 0.11,      // K: signal-sum → logit (weights enter SQUARED, so
                          // a smoking-gun station ~|32| lands p ≈ 0.97 and a
                          // §4.3 "measured lean" ~|9| lands p ≈ 0.73)
  clampP: [0.02, 0.98],
};

// Calibration personalities (CASE_TABLE.md §4.4). `station` is the seat's
// home lens (always scanned first). `prior` is a logit offset toward scam
// (+) or believe (−). `shrink`/`overconf` distort the REPORTED p away from
// the believed p. `rational` is the human-proxy seat for experiments.
export const SEAT_MODELS = {
  gr80: { station: "monk", prior: 0.5, lensMult: 1.5, shrink: 0.7 },
  marisol: { station: "marisol", prior: 0, lensMult: 1.5, needsHomeLens: 0.3 },
  "john-barron": { station: "demon", prior: -0.5, lensMult: 1.5, overconf: 1.3 },
  eugene: { station: "eugene", prior: 0, lensMult: 1.5, noise: 0.9 },
  rational: { station: null, prior: 0, lensMult: 1 },
};

export const STATIONS = ["monk", "demon", "marisol", "eugene"];

// Docket events between cases — simplified stand-ins for MARKET_CARDS (§4.6).
const EVENTS = [
  { id: "crash", p: 0.3, portfolioAll: -10 },
  { id: "boost", p: 0.2, payoutMult: 1.25 },
  { id: "calm", p: 0.5 },
];

// --- deterministic RNG (same family as packs.js) ---
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  // Box-Muller; rand() is never 0 with mulberry32's output range guard below
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Signed evidence sum for the stations a seat has scanned. Weights enter
// SQUARED: a w3 smoking gun (9) is not cancelled by a stack of w1 green
// vibes (1 each) — evidential strength dominates volume, which is the
// forensic logic the cases are written around (decisiveLenses).
function evidenceSum(caseSignals, scanned, model) {
  let sum = 0;
  for (const station of scanned) {
    const mult = station === model.station ? model.lensMult : 1;
    for (const entry of caseSignals.stations[station]) {
      sum += (entry.dir === "scam" ? 1 : -1) * entry.w * entry.w * mult;
    }
  }
  return sum;
}

// Which stations a seat scans: home lens first, then seeded-random others.
function chooseScans(model, scanCount, rand) {
  const scanned = [];
  if (model.station && scanCount > 0) scanned.push(model.station);
  const rest = STATIONS.filter((s) => !scanned.includes(s));
  while (scanned.length < Math.min(scanCount, STATIONS.length) && rest.length) {
    const i = Math.floor(rand() * rest.length);
    scanned.push(rest.splice(i, 1)[0]);
  }
  return scanned;
}

// Believed → reported P(scam) for a KNOWN set of scanned stations. The
// turn-based client tracks scans round by round and calls this at settle;
// the sim wraps it via seatReport below.
export function seatBelief(caseSignals, model, scanned, rand, rules = TABLE_RULES) {
  let logit = model.prior + rules.beliefScale * evidenceSum(caseSignals, scanned, model);
  if (model.noise) logit += gaussian(rand) * model.noise;
  let p = sigmoid(logit);
  if (model.needsHomeLens && !scanned.includes(model.station)) {
    p = 0.5 + (p - 0.5) * model.needsHomeLens; // no chain data, no conviction
  }
  if (model.shrink) p = 0.5 + (p - 0.5) * model.shrink;
  if (model.overconf) p = 0.5 + (p - 0.5) * model.overconf;
  return clamp(p, rules.clampP[0], rules.clampP[1]);
}

// Believed → reported P(scam) for one seat on one case (self-chosen scans).
export function seatReport(caseSignals, model, scanCount, rand, rules = TABLE_RULES) {
  const scanned = chooseScans(model, scanCount, rand);
  return { p: seatBelief(caseSignals, model, scanned, rand, rules), scanned };
}

// §4.3: P&L = STAKE × (1 − 4·Brier). Proper (affine in Brier), zero at p=0.5.
export function casePnl(p, truth, stake) {
  const brier = (p - truth) ** 2;
  return stake * (1 - 4 * brier);
}

/**
 * Run one seeded docket.
 * @param {object} opts
 *   cases        — array of caseSignals objects (in docket order)
 *   seatKeys     — 4 SEAT_MODELS keys; seat 0 is the "player" seat
 *   seed         — RNG seed
 *   stakeMode    — "fixed" | "proportional" (0.25 × current portfolio)
 *   stake        — fixed-stake size (default TABLE_RULES.stake)
 *   scanOverride — { seatIndex: scanCount } to test information edge
 */
export function runDocket({ cases, seatKeys, seed, stakeMode = "fixed", stake = TABLE_RULES.stake, scanOverride = {} }) {
  const rand = mulberry32(seed);
  const seats = seatKeys.map((key) => ({
    key,
    model: SEAT_MODELS[key],
    portfolio: TABLE_RULES.startPortfolio,
    briers: [],
    liquidatedAt: null,
  }));
  let payoutMult = 1;

  cases.forEach((caseSignals, caseIndex) => {
    seats.forEach((seat, seatIndex) => {
      if (seat.liquidatedAt !== null) return;
      const scanCount = scanOverride[seatIndex] ?? TABLE_RULES.scansPerSeat;
      const { p } = seatReport(caseSignals, seat.model, scanCount, rand);
      const stakeSize = stakeMode === "proportional"
        ? Math.max(5, 0.25 * seat.portfolio)
        : stake;
      seat.portfolio += casePnl(p, caseSignals.truth, stakeSize) * payoutMult;
      seat.briers.push((p - caseSignals.truth) ** 2);
      if (seat.portfolio <= 0) {
        seat.portfolio = 0;
        seat.liquidatedAt = caseIndex;
      }
    });

    payoutMult = 1;
    if (caseIndex < cases.length - 1) {
      // docket event flip
      let roll = rand();
      for (const event of EVENTS) {
        roll -= event.p;
        if (roll > 0) continue;
        if (event.portfolioAll) {
          seats.forEach((seat) => {
            if (seat.liquidatedAt !== null) return;
            seat.portfolio = Math.max(0, seat.portfolio + event.portfolioAll);
            if (seat.portfolio === 0) seat.liquidatedAt = caseIndex;
          });
        }
        if (event.payoutMult) payoutMult = event.payoutMult;
        break;
      }
    }
  });

  const best = Math.max(...seats.map((s) => s.portfolio));
  return seats.map((seat) => ({
    key: seat.key,
    portfolio: seat.portfolio,
    avgBrier: seat.briers.reduce((a, b) => a + b, 0) / (seat.briers.length || 1),
    liquidatedAt: seat.liquidatedAt,
    won: seat.portfolio === best && best > 0,
  }));
}
