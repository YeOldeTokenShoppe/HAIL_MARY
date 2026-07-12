// Case Table balance sim (CASE_TABLE.md §4.7). Run: node scripts/sim-case-table.mjs
// Loads the REAL sources via data: modules (repo convention, see
// test-artifact-distribution.mjs) — both files are dependency-free.
import { readFileSync } from "node:fs";

const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
};

const { CASE_SIGNALS, DOCKET_CASE_IDS } = await load("../src/game/terminal-traders/caseSignals.js");
const { runDocket } = await load("../src/game/terminal-traders/caseTable.js");

const CASES = DOCKET_CASE_IDS.map((id) => CASE_SIGNALS[id]);
const RUNS = 2000;

function simulate(label, opts) {
  const stats = {};
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const results = runDocket({ cases: CASES, seed: seed * 7919, ...opts });
    for (const seat of results) {
      const s = (stats[seat.key] ||= { wins: 0, liq: 0, pf: 0, brier: 0, n: 0 });
      s.n += 1;
      s.pf += seat.portfolio;
      s.brier += seat.avgBrier;
      if (seat.won) s.wins += 1;
      if (seat.liquidatedAt !== null) s.liq += 1;
    }
  }
  console.log(`\n=== ${label} (${RUNS} dockets) ===`);
  console.log("seat            win%   liq%   avg final PF   avg Brier");
  for (const [key, s] of Object.entries(stats)) {
    console.log(
      key.padEnd(15),
      ((s.wins / s.n) * 100).toFixed(1).padStart(5) + "%",
      ((s.liq / s.n) * 100).toFixed(1).padStart(5) + "%",
      (s.pf / s.n).toFixed(1).padStart(12),
      (s.brier / s.n).toFixed(3).padStart(11),
    );
  }
  return stats;
}

const CAST = ["eugene", "gr80", "john-barron", "marisol"];
const PLAYER_TABLE = ["rational", "gr80", "john-barron", "marisol"];

// Calibration table: avg reported P(scam) per character per case at the
// standard 2 scans — verifies the authored intent (traps trap, cracks crack)
// before reading any win rates.
const { seatReport, SEAT_MODELS, mulberry32 } = await load("../src/game/terminal-traders/caseTable.js");
console.log("=== calibration: avg reported P(scam), 2 scans (truth in brackets) ===");
console.log("seat            " + DOCKET_CASE_IDS.map((id) => `${id} [${CASE_SIGNALS[id].truth}]`).join("   "));
for (const [key, model] of Object.entries(SEAT_MODELS)) {
  const cols = DOCKET_CASE_IDS.map((id) => {
    let sum = 0;
    const N = 500;
    for (let i = 1; i <= N; i += 1) sum += seatReport(CASE_SIGNALS[id], model, 2, mulberry32(i * 31)).p;
    return (sum / N).toFixed(2).padStart(12);
  });
  console.log(key.padEnd(15), cols.join("   "));
}

// E0 — the four characters alone: is any personality dominant/doomed?
simulate("E0 character table, fixed stake 25", { seatKeys: CAST, stakeMode: "fixed" });

// E1 — human proxy replaces Eugene: does honest calibration beat the cast?
simulate("E1 rational player seat, fixed stake 25", { seatKeys: PLAYER_TABLE, stakeMode: "fixed" });

// E2 — proportional stakes (25% of portfolio): rubber-banding check.
simulate("E2 rational player seat, proportional stakes", { seatKeys: PLAYER_TABLE, stakeMode: "proportional" });

// E3 — information edge: player seat with 1..4 scans (kit-power proxy).
// Target (§4.7): win-rate should rise meaningfully but not to a landslide.
for (const scans of [1, 2, 3, 4]) {
  simulate(`E3 player scans=${scans}, fixed stake 25`, {
    seatKeys: PLAYER_TABLE,
    stakeMode: "fixed",
    scanOverride: { 0: scans },
  });
}

// E4 — stake sensitivity: how brutal is the payout curve?
for (const stake of [15, 35]) {
  simulate(`E4 fixed stake ${stake}`, { seatKeys: PLAYER_TABLE, stakeMode: "fixed", stake });
}
