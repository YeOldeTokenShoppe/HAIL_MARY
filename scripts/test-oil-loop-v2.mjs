// Unit test for the v2 extract-or-pass math (src/lib/oilLoopV2.js).
// Pure math — no Firebase. Run: node scripts/test-oil-loop-v2.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
};
const { PASSIVE_CHARGES, chargesCapFor, chargesRemainingFor, resolvePendingDecision, assayAlertBody } =
  await load("../src/lib/oilLoopV2.js");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

t("charges cap = passive + bonus, capped at depth", () => {
  assert.equal(chargesCapFor({ bonusDrills: 0 }, {}, 20), PASSIVE_CHARGES);
  assert.equal(chargesCapFor({ bonusDrills: 5 }, {}, 20), PASSIVE_CHARGES + 5);
  assert.equal(chargesCapFor({ bonusDrills: 99 }, {}, 20), 20);
  assert.equal(chargesCapFor({ bonusDrills: 0 }, { passiveCharges: 10 }, 20), 10);
});

t("charges remaining subtracts spent, floors at 0", () => {
  assert.equal(chargesRemainingFor({ bonusDrills: 0, chargesSpent: 3 }, {}, 20), PASSIVE_CHARGES - 3);
  assert.equal(chargesRemainingFor({ bonusDrills: 0, chargesSpent: 99 }, {}, 20), 0);
});

t("dry layer always passes (free)", () => {
  assert.equal(resolvePendingDecision({ pending: { layer: 3, oil: 0 }, threshold: 0, chargesRemaining: 8, depthZ: 20 }), "pass");
});

t("no charges → pass, even above the line", () => {
  assert.equal(resolvePendingDecision({ pending: { layer: 3, oil: 9999 }, threshold: 0, chargesRemaining: 0, depthZ: 20 }), "pass");
});

t("threshold splits extract/pass", () => {
  assert.equal(resolvePendingDecision({ pending: { layer: 3, oil: 800 }, threshold: 800, chargesRemaining: 4, depthZ: 20 }), "extract");
  assert.equal(resolvePendingDecision({ pending: { layer: 3, oil: 799 }, threshold: 800, chargesRemaining: 4, depthZ: 20 }), "pass");
});

t("autopilot is OPT-IN (2026-08-27): off by default even when charges cover the field", () => {
  // 20 charges at layer 0 must NOT force-extract — that would starve the frontier.
  assert.equal(resolvePendingDecision({ pending: { layer: 0, oil: 1 }, threshold: 800, chargesRemaining: 20, depthZ: 20 }), "pass");
  // Opted in: charges ≥ layers remaining → extract below the line.
  assert.equal(resolvePendingDecision({ pending: { layer: 15, oil: 1 }, threshold: 800, chargesRemaining: 5, depthZ: 20, autopilot: true }), "extract");
  // Opted in but charges don't cover: threshold rules.
  assert.equal(resolvePendingDecision({ pending: { layer: 15, oil: 1 }, threshold: 800, chargesRemaining: 4, depthZ: 20, autopilot: true }), "pass");
});

t("alert copy states the cost model and the standing order (copy rule)", () => {
  const body = assayAlertBody({ col: 3, row: 5, layer: 11, oil: 1285, threshold: 764, chargesRemaining: 5, hasInclusion: false });
  assert.match(body, /EXTRACT banks the full amount for 1 charge/);
  assert.match(body, /PASS is free but final/);
  assert.match(body, /standing order \("extract ≥ 764"\)/);
  assert.match(body, /would EXTRACT/);
});

t("alert copy: dry layer says it passes free; inclusion adds the ping line", () => {
  assert.match(assayAlertBody({ col: 0, row: 0, layer: 2, oil: 0, threshold: 500, chargesRemaining: 8, hasInclusion: false }), /dry — passes free/);
  assert.match(assayAlertBody({ col: 0, row: 0, layer: 2, oil: 0, threshold: 500, chargesRemaining: 8, hasInclusion: true }), /Anomalous inclusion detected/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
