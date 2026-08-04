// THE NUMBER THAT JUSTIFIES A NEW ARCHETYPE — VC_GAME.md §4.
//
// Run: node scripts/sim-press-edge.mjs
//      node scripts/sim-press-edge.mjs --seeds=8000
//      node scripts/sim-press-edge.mjs --only=backdoor-fork,yield-mirage
//
// §4 prints a table justifying anon-but-real and says a fourth archetype has to
// pass the same test — but NOTHING IN scripts/ COMPUTED IT. verify-press-run
// checks the resolver; sim-hmvc and sim-case-table belong to the other game. So
// the gate was a number in a document that no one could re-derive, which is the
// same as no gate at all. This is that gate.
//
// WHAT IS MEASURED, AND WHY IT IS NOT THE HIT RATE.
// `casePnl` is an affine transform of Brier, so it scores CALIBRATION: being
// directionally right most of the time is worth almost nothing if you cannot say
// how confident to be. The proof is printed at the bottom of every run —
// always-FUD-with-conviction is the WORST strategy available, not an exploit.
// The unit here is therefore expected P&L per deal, and the quantity that
// justifies an archetype is the GAP between two players:
//
//   blind   — knows the world's overall rug rate, cannot tell the patterns apart.
//             Reports that one number on every deal, forever.
//   knows   — recognises the archetype and reports ITS base rate.
//   edge    — knows − blind. What recognition is worth per deal.
//
// A fourth archetype earns its place by making that gap bigger. §4's own words:
// "harder for the uninformed and more rewarding for the informed, at once" — so
// the blind column going DOWN is a feature, and this script prints both halves
// rather than the difference alone.
//
// THE STRATEGIES ARE PRIORS, NOT PLAY. Nobody presses anything here. That is
// deliberate: what an archetype is worth is the prior it moves you to before
// the first claim lands, and mixing evidence in would measure the claims'
// authoring rather than the archetype's shape.
//
// PURE PRODUCTION PATH. Deals come from instanceDeal(), so the archetype roll,
// the outcome roll and every weight are exactly what ships. Nothing about the
// world is restated here — add archetype #4 to instanceDeal and this script
// measures it with no edit.

import { instanceDeal, ARCHETYPES, ARCHETYPE_IDS } from "../src/game/terminal-traders/press/instanceDeal.js";
import { STAKE } from "../src/game/terminal-traders/press/pressRun.js";
import { casePnl } from "../src/game/terminal-traders/caseTable.js";

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const SEEDS = Number(arg("seeds", 8000));
const ONLY = arg("only", null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

// A PERFECT READ IS NEVER CERTAIN. §4: "a perfect read still shouldn't go to
// 100%" — the exception rate is what keeps the slider's middle load-bearing, so
// the ceiling strategy reports 0.99, not 1.0. That clamp is the whole difference
// between the +24.99 ceiling and a meaningless +25.00.
const CERTAINTY_CAP = 0.99;
const clamp = (p) => Math.min(CERTAINTY_CAP, Math.max(1 - CERTAINTY_CAP, p));

/* ---------------------------------------------------------------------- */
/* the sample                                                              */
/* ---------------------------------------------------------------------- */

if (ONLY) {
  const unknown = ONLY.filter((id) => !ARCHETYPE_IDS.includes(id));
  if (unknown.length) { console.error(`unknown archetype: ${unknown.join(", ")}`); process.exit(2); }
}

// FILTERING THE PRODUCTION STREAM IS HOW A SUBSET WORLD IS MODELLED. instanceDeal
// picks the archetype uniformly, so dropping the deals that rolled an excluded
// archetype leaves each survivor's own outcome roll untouched — which is exactly
// the world with only those archetypes in it. Reproducing the historical
// two-archetype row is `--only=backdoor-fork,yield-mirage`.
const deals = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const d = instanceDeal(seed);
  if (ONLY && !ONLY.includes(d.archetype)) continue;
  deals.push({ archetype: d.archetype, truth: d.truth });
}
if (deals.length === 0) { console.error("no deals in sample"); process.exit(2); }

const ids = ONLY ?? ARCHETYPE_IDS;

// THE REALIZED RATE, NOT THE AUTHORED WEIGHT. A player learns the base rate by
// playing, so the prior they converge on is the one this sample actually
// exhibits — and over 8000 seeds those differ by enough to move the third
// decimal. The authored weight is printed beside it so a drift between the two
// is visible rather than silently absorbed.
const nominalRate = (id) => {
  const o = ARCHETYPES[id].OUTCOMES;
  const total = o.reduce((s, x) => s + x.weight, 0);
  return (o.find((x) => x.outcome === "rug")?.weight ?? 0) / total;
};

const byArchetype = new Map(ids.map((id) => [id, { n: 0, rugs: 0 }]));
for (const d of deals) {
  const row = byArchetype.get(d.archetype);
  row.n++; row.rugs += d.truth;
}
const realizedRate = (id) => {
  const r = byArchetype.get(id);
  return r.n ? r.rugs / r.n : 0;
};
const worldRate = deals.reduce((s, d) => s + d.truth, 0) / deals.length;

/* ---------------------------------------------------------------------- */
/* the strategies                                                          */
/* ---------------------------------------------------------------------- */

const STRATEGIES = [
  { key: "blind", label: "blind (knows the world's rate)", p: () => clamp(worldRate) },
  { key: "knows", label: "knows the archetype", p: (d) => clamp(realizedRate(d.archetype)) },
  { key: "perfect", label: "perfect read", p: (d) => clamp(d.truth) },
];

const expected = (fn) => deals.reduce((s, d) => s + casePnl(fn(d), d.truth, STAKE), 0) / deals.length;
const results = Object.fromEntries(STRATEGIES.map((s) => [s.key, expected(s.p)]));
const edge = results.knows - results.blind;

/* ---------------------------------------------------------------------- */
/* the report                                                              */
/* ---------------------------------------------------------------------- */

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const signed = (x) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;

console.log(`\nTHE PRESS — edge from recognition`);
console.log(`${deals.length} deals from ${SEEDS} seeds · stake ${STAKE} · ${ids.length} archetype${ids.length === 1 ? "" : "s"}\n`);

console.log(`  archetype            n      authored   realized`);
for (const id of ids) {
  const r = byArchetype.get(id);
  console.log(`  ${id.padEnd(20)} ${String(r.n).padStart(5)}   ${pct(nominalRate(id)).padStart(7)}   ${pct(realizedRate(id)).padStart(7)}`);
}
console.log(`  ${"WORLD".padEnd(20)} ${String(deals.length).padStart(5)}   ${" ".repeat(7)}   ${pct(worldRate).padStart(7)} rug\n`);

console.log(`  strategy                            reports          E[P&L]/deal`);
for (const s of STRATEGIES) {
  const sample = s.key === "blind" ? worldRate.toFixed(3)
    : s.key === "knows" ? "its base rate"
      : "truth, capped .99";
  console.log(`  ${s.label.padEnd(33)} ${sample.padStart(17)}   ${signed(results[s.key]).padStart(11)}`);
}
console.log(`\n  EDGE FROM RECOGNITION  (knows − blind)                ${signed(edge).padStart(11)}\n`);

// THE TRAP, PRINTED EVERY RUN. §4: "Never measure hit rate." The heuristic that
// is directionally right on most deals in a rug-heavy world still loses money,
// and the argument for anon-but-real was once made on a hit rate by mistake.
// Keeping the refutation in the output means the next person to reach for that
// number meets the counter-example first.
//
// "The worst strategy available" is how §4 phrases it and it is a shade strong —
// always-FUND-with-conviction is worse still in a rug-heavy world. The point
// that survives is the one that matters: the heuristic that LOOKS like an
// exploit is deeply negative, so a hit rate cannot be evidence for anything.
const alwaysFud = expected(() => CERTAINTY_CAP);
const alwaysFund = expected(() => 1 - CERTAINTY_CAP);
const hitRate = deals.filter((d) => d.truth === 1).length / deals.length;
console.log(`  the hit-rate trap: always-FUD-with-conviction is directionally right`);
console.log(`  on ${pct(hitRate)} of deals and still earns ${signed(alwaysFud)} per deal.`);
console.log(`  (always-FUND, for scale: ${signed(alwaysFund)}.) Hit rate is not the score.\n`);

// The historical row this reproduces, so a drift is loud rather than quiet.
if (!ONLY && ARCHETYPE_IDS.length === 3) {
  const REF = { blind: 0.54, knows: 4.62, edge: 4.08, perfect: 24.99 };
  const off = Math.abs(edge - REF.edge);
  console.log(`  §4 records +${REF.edge.toFixed(2)} for these three archetypes; this run says`);
  console.log(`  ${signed(edge)} (${off < 0.35 ? "reproduced" : "DRIFTED — reconcile before trusting a candidate"}).\n`);
}

/* ---------------------------------------------------------------------- *
 * THE CLOSED FORM — what a fourth archetype actually has to do.
 *
 * Falls out of the sim rather than replacing it, and it is worth stating
 * because it converts §4's gate from "author it, then find out" into a
 * question answerable BEFORE a word of prose is written.
 *
 * With a uniform archetype roll and base rates r_i, mean r̄:
 *
 *   blind reports r̄ on everything     E = S(1 − 4·r̄(1−r̄))
 *   knows reports r_i                 E = S·mean(1 − 4·r_i(1−r_i))
 *   edge  = 4S·[ r̄(1−r̄) − mean(r_i(1−r_i)) ]
 *         = 4S·[ mean(r_i²) − r̄² ]
 *         = 4S · VAR(r_i)                       ... = 100·VAR at STAKE 25
 *
 * SO THE ONLY THING RECOGNITION IS WORTH IS THE SPREAD OF THE BASE RATES.
 * Nothing else about an archetype — not its prose, not its lanes, not how
 * cleverly it hides its mechanism — moves this number at all. Two consequences
 * that are easy to get backwards:
 *
 *   1. A FOURTH ARCHETYPE NEAR THE CURRENT MEAN MAKES THE GAME WORSE. It adds a
 *      near-zero deviation and dilutes the ones that carry the spread. There is
 *      a real range of base rates that FAIL this gate, and it is the middle.
 *   2. The gate pulls toward extremes, and §4's exception rate pushes back:
 *      "make an archetype deterministic and correct play collapses to a binary."
 *      The design lives in the gap between those two, which the sweep prints.
 * ---------------------------------------------------------------------- */

const authored = ARCHETYPE_IDS.map(nominalRate);
const varianceEdge = (rates) => {
  const m = rates.reduce((s, x) => s + x, 0) / rates.length;
  const v = rates.reduce((s, x) => s + (x - m) ** 2, 0) / rates.length;
  return { mean: m, edge: 4 * STAKE * v };
};

if (process.argv.includes("--sweep")) {
  const base = varianceEdge(authored);
  console.log(`  SWEEP — a fourth archetype at base rate x, against the authored`);
  console.log(`  rates ${authored.map(pct).join(" / ")}. Baseline edge ${signed(base.edge)}.\n`);
  console.log(`     x     world mean    blind     knows      edge     vs baseline`);
  for (let x = 5; x <= 95; x += 5) {
    const r = x / 100;
    const { mean, edge: e } = varianceEdge([...authored, r]);
    const blind = STAKE * (1 - 4 * mean * (1 - mean));
    const knows = blind + e;
    const delta = e - base.edge;
    const flag = delta <= 0 ? "  FAILS" : r <= 0.15 || r >= 0.85 ? "  near-deterministic" : "";
    console.log(`    ${pct(r).padStart(5)}   ${pct(mean).padStart(8)}   ${signed(blind).padStart(7)}   ${signed(knows).padStart(7)}   ${signed(e).padStart(7)}   ${signed(delta).padStart(7)}${flag}`);
  }
  console.log(`\n  Read the "vs baseline" column, not the "edge" one: a candidate has to`);
  console.log(`  beat what the three already do, and the middle of the range does not.\n`);
} else {
  const a = varianceEdge(authored);
  console.log(`  closed form: edge = 4·STAKE·VAR(base rates) = ${signed(a.edge)} on the`);
  console.log(`  AUTHORED rates (the ${signed(edge)} above is the realized sample, which`);
  console.log(`  runs wider). --sweep prints what a fourth archetype would do.\n`);
}
