// Unit test for the fill-the-season strike clock (src/lib/oilStrikeClock.js).
// Pure math — no Firebase. Run: node scripts/test-oil-clock.mjs
//
// Loads the REAL lib source (so we test the shipped file, not a copy) by
// importing it as a data: module — the lib has no relative imports.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const libSrc = readFileSync(new URL("../src/lib/oilStrikeClock.js", import.meta.url), "utf8");
const clock = await import("data:text/javascript;charset=utf-8," + encodeURIComponent(libSrc));
const { PASSIVE_DRILLS, MAX_DEPTH, depthCapFor, seasonClock, strikeFraction, strikeTargetMs } = clock;

const DAY = 86400000;
const TICK = 5 * 60000; // 5-min cron cadence, matches the Firebase scheduled fn

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

// Simulate the strike-tick loop for one rig across a season (deep=1, one layer
// per tick). Mirrors the route: strike when now ≥ target, then lastStrike = now,
// recompute target from remaining-time ÷ remaining-layers. `bump` lets a bonus
// raise depthCap mid-season (referrals/diamond-hands).
function simulate({ userId, season, depthCap, bump }) {
  let depth = 0, lastStrikeMs = null;
  const strikes = [];
  for (let now = season.startMs; now <= season.endMs + TICK; now += TICK) {
    const cap = bump && now >= bump.atMs ? bump.toCap : depthCap;
    if (depth >= cap) continue;
    const { targetMs } = strikeTargetMs(season, lastStrikeMs, depth, cap, userId);
    if (now >= targetMs) { strikes.push(now); lastStrikeMs = now; depth += 1; }
  }
  const gaps = strikes.slice(1).map((s, i) => s - strikes[i]);
  return { depth, strikes, gaps };
}

console.log("\noilStrikeClock — timing math\n");

console.log("depthCapFor");
t("no bonus → base 10", () => assert.equal(depthCapFor({ bonusDrills: 0 }, 20), 10));
t("half bonus → 15", () => assert.equal(depthCapFor({ bonusDrills: 5 }, 20), 15));
t("full bonus → 20", () => assert.equal(depthCapFor({ bonusDrills: 10 }, 20), 20));
t("over-cap clamps to MAX_DEPTH", () => assert.equal(depthCapFor({ bonusDrills: 50 }, 20), MAX_DEPTH));
t("shallow field clamps cap to depthZ", () => assert.equal(depthCapFor({ bonusDrills: 10 }, 8), 8));
t("missing drill → base 10", () => assert.equal(depthCapFor(undefined, 20), PASSIVE_DRILLS));

console.log("seasonClock");
t("null without seasonLengthDays (legacy)", () => assert.equal(seasonClock({ gameStartDate: "2026-06-07" }), null));
t("null without gameStartDate", () => assert.equal(seasonClock({ seasonLengthDays: 10 }), null));
t("null on zero/negative length", () => assert.equal(seasonClock({ gameStartDate: "2026-06-07", seasonLengthDays: 0 }), null));
t("valid → correct start/end span", () => {
  const s = seasonClock({ gameStartDate: "2026-06-07", seasonLengthDays: 10 });
  assert.equal(s.startMs, Date.parse("2026-06-07T00:00:00Z"));
  assert.equal(s.endMs - s.startMs, 10 * DAY);
});

console.log("strikeFraction (random placement inside window)");
t("always in [0,1)", () => {
  for (let i = 0; i < 500; i++) { const f = strikeFraction("user" + i, i % 20); assert.ok(f >= 0 && f < 1, `f=${f}`); }
});
t("deterministic (idempotent across ticks)", () => {
  assert.equal(strikeFraction("alice", 3), strikeFraction("alice", 3));
});
t("varies by window index (unpredictable per layer)", () => {
  const set = new Set([0,1,2,3,4,5,6,7,8,9].map((i) => strikeFraction("alice", i)));
  assert.ok(set.size >= 8, `only ${set.size}/10 distinct`);
});
t("reasonably spread across [0,1)", () => {
  const buckets = [0,0,0,0];
  for (let i = 0; i < 400; i++) buckets[Math.floor(strikeFraction("u" + i, 0) * 4)]++;
  assert.ok(buckets.every((b) => b > 40), `skewed: ${buckets}`);
});

console.log("strikeTargetMs (interval pacing)");
const SEASON = seasonClock({ gameStartDate: "2026-06-07", seasonLengthDays: 10 });
t("depth-10 rig: first interval ≈ 1 day", () => {
  const { intervalMs } = strikeTargetMs(SEASON, null, 0, 10, "x");
  assert.equal(intervalMs, 10 * DAY / 10);
});
t("depth-20 rig: first interval ≈ 0.5 day (bonus → 2× faster)", () => {
  const { intervalMs } = strikeTargetMs(SEASON, null, 0, 20, "x");
  assert.equal(intervalMs, 10 * DAY / 20);
});
t("first strike target inside first window", () => {
  const { targetMs } = strikeTargetMs(SEASON, null, 0, 10, "x");
  assert.ok(targetMs >= SEASON.startMs && targetMs < SEASON.startMs + DAY);
});
t("depleted rig (depth ≥ cap) → target Infinity", () => {
  assert.equal(strikeTargetMs(SEASON, SEASON.startMs, 10, 10, "x").targetMs, Infinity);
});
t("re-paces from remaining time/layers mid-season", () => {
  const mid = SEASON.startMs + 6 * DAY; // 4 days left
  const { intervalMs } = strikeTargetMs(SEASON, mid, 6, 10, "x"); // 4 layers left
  assert.equal(intervalMs, 4 * DAY / 4); // → 1 day each, exactly fills the rest
});

console.log("full-season simulation (the real loop)");
t("depth-10 rig strikes exactly 10× and finishes by the buzzer", () => {
  const { depth, strikes } = simulate({ userId: "alice", season: SEASON, depthCap: 10 });
  assert.equal(depth, 10, `reached depth ${depth}`);
  assert.equal(strikes.length, 10);
  assert.ok(strikes[strikes.length - 1] <= SEASON.endMs, "last strike after buzzer");
  assert.ok(strikes[0] >= SEASON.startMs, "first strike before season");
});
t("depth-20 rig strikes exactly 20× (≈2× the depth-10 rig)", () => {
  const { depth, strikes } = simulate({ userId: "bob", season: SEASON, depthCap: 20 });
  assert.equal(depth, 20);
  assert.equal(strikes.length, 20);
  assert.ok(strikes[strikes.length - 1] <= SEASON.endMs);
});
t("no idle: strikes span the whole season, none clustered at the start", () => {
  const { strikes } = simulate({ userId: "alice", season: SEASON, depthCap: 10 });
  const span = strikes[strikes.length - 1] - strikes[0];
  assert.ok(span > 7 * DAY, `strikes spanned only ${(span / DAY).toFixed(1)}d`);
  const maxGap = Math.max(...strikes.slice(1).map((s, i) => s - strikes[i]));
  assert.ok(maxGap < 3 * DAY, `a ${(maxGap / DAY).toFixed(1)}d dead zone opened`);
});
t("mid-season bonus densifies the rest and lifts the cap (10→15)", () => {
  const base = simulate({ userId: "carol", season: SEASON, depthCap: 10 });
  const bumped = simulate({ userId: "carol", season: SEASON, depthCap: 10, bump: { atMs: SEASON.startMs + 5 * DAY, toCap: 15 } });
  assert.equal(bumped.depth, 15, `reached ${bumped.depth}, expected 15`);
  assert.ok(bumped.strikes[bumped.strikes.length - 1] <= SEASON.endMs, "ran past the buzzer");
  assert.ok(bumped.strikes.length > base.strikes.length, "bonus didn't add strikes");
});
t("strikes are unpredictable but each lands once (idempotent re-runs match)", () => {
  const a = simulate({ userId: "dave", season: SEASON, depthCap: 12 });
  const b = simulate({ userId: "dave", season: SEASON, depthCap: 12 });
  assert.deepEqual(a.strikes, b.strikes, "non-deterministic across runs");
});

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
