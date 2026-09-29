// Unit test for the v2 extract-or-pass math (src/lib/oilLoopV2.js).
// Pure math — no Firebase. Run: node scripts/test-oil-loop-v2.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
};
const { PASSIVE_CHARGES, chargesCapFor, chargesRemainingFor, resolvePendingDecision, assayAlertBody, fmtSpan, buildColumnRack, buildLedger, buildReckoning, reckoningText, reckoningStory, reckoningShareText, reckoningStrip, pickSalvageOrder, heatReading, HEAT_COPY, shouldCase, casedAlertBody } =
  await load("../src/lib/oilLoopV2.js");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

t("charges cap = passive + bonus, capped at depth", () => {
  assert.equal(chargesCapFor({ bonusDrills: 0 }, {}, 20), PASSIVE_CHARGES);
  assert.equal(chargesCapFor({ bonusDrills: 5 }, {}, 20), PASSIVE_CHARGES + 5);
  assert.equal(chargesCapFor({ bonusDrills: 99 }, {}, 20), PASSIVE_CHARGES + 99);   // the bonus is capped where it is granted (MAX_BONUS_DRILLS), not here
  assert.equal(chargesCapFor({ bonusDrills: 0 }, { passiveCharges: 10 }, 20), 10);
  assert.equal(chargesCapFor({ bonusDrills: 3 }, { passiveCharges: 20 }, 20), 23);   // bonus sits on top of the column (2026-09-29)
  assert.equal(chargesCapFor({ bonusDrills: 3 }, { passiveCharges: 40 }, 20), 23);   // passive alone is capped at the column
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

t("fmtSpan: minutes, hours to one decimal, days", () => {
  assert.equal(fmtSpan(20 * 1000), "<1 min");
  assert.equal(fmtSpan(42 * 60000), "42 min");
  assert.equal(fmtSpan(9.6 * 3600000), "9.6 h");
  assert.equal(fmtSpan(3 * 3600000), "3 h");
  assert.equal(fmtSpan(3.1 * 86400000), "3.1 d");
  assert.equal(fmtSpan(-5), "—");
  assert.equal(fmtSpan(NaN), "—");
});

t("buildColumnRack: one entry per layer, states from the rig maps + public plot", () => {
  const plot = {
    drillDay: 6,
    revealed: { 0: 0, 1: 400, 2: 0, 3: 900, 4: 0, 5: 1200 },
    extracted: { 1: 400 },
    passed: { 3: 900 },
    lateralTaken: { 3: "neighbour" },
    hellLayers: { 4: true }, hellCapped: { 4: true },
    inclusionFlags: { 5: true },
  };
  const drill = {
    layersExtracted: { 1: 400 }, layersPassed: { 0: 0, 3: 900 },
    pending: { layer: 5, oil: 1200, hasInclusion: true, revealedAt: 1 },
  };
  const rack = buildColumnRack({ plot, drill, depthZ: 8 });
  assert.equal(rack.length, 8);
  assert.deepEqual(rack.map((r) => r.state),
    ["dry", "extracted", "revealed", "salvaged", "hell_capped", "pending", "undrilled", "undrilled"]);
  assert.equal(rack[1].oil, 400);
  assert.equal(rack[3].takenBy, "neighbour");
  assert.equal(rack[5].hasInclusion, true);
  assert.equal(rack[5].oil, 1200);
});

t("buildColumnRack: untaken pass reads 'passed'; uncapped hell reads 'hell'; empty inputs are all undrilled", () => {
  const rack = buildColumnRack({ plot: { passed: { 2: 300 }, hellLayers: { 0: true } }, drill: { layersPassed: { 2: 300 } }, depthZ: 4 });
  assert.deepEqual(rack.map((r) => r.state), ["hell", "undrilled", "passed", "undrilled"]);
  assert.ok(buildColumnRack({ plot: null, drill: null, depthZ: 3 }).every((r) => r.state === "undrilled"));
});

t("buildLedger: own rows by layer, salvage + wildcats derived from public plots, totals add up", () => {
  const me = "me";
  const plot = { col: 2, row: 2, passed: { 4: 500, 7: 250 }, lateralTaken: { 4: "rival" } };
  const drill = { totalCollected: 1800, chargesSpent: 4, layersExtracted: { 6: 1000, 1: 200 }, layersPassed: { 4: 500, 7: 250, 2: 0 } };
  const allPlots = {
    "2_2": plot,
    "3_2": { col: 3, row: 2, passed: { 5: 600 }, lateralTaken: { 5: me } },
    "1_1": { col: 1, row: 1, revealed: { 3: 0, 8: 450 }, wildcatTaken: { 3: me, 8: me } },
    "1_3": { col: 1, row: 3, revealed: { 2: 0 }, hellLayers: { 2: true }, wildcatTaken: { 2: me } },
    "9_9": { col: 9, row: 9, passed: { 1: 999 }, lateralTaken: { 1: "someone-else" } },
  };
  const L = buildLedger({ plot, drill, allPlots, userId: me });
  assert.deepEqual(L.rows.map((r) => `${r.kind}:${r.layer}`),
    ["extract:1", "pass:2", "pass:4", "extract:6", "pass:7", "salvage:5", "wildcat:3", "wildcat:8", "wildcat:2"]);
  assert.equal(L.rows.find((r) => r.kind === "pass" && r.layer === 4).takenBy, "rival");
  assert.equal(L.banked, 1800);
  assert.equal(L.chargesSpent, 4);
  assert.equal(L.extractedOwn, 1200);
  assert.equal(L.salvagedIn, 600);
  assert.equal(L.wildcatIn, 450);
  assert.equal(L.wildcatDry, 1);
  assert.equal(L.wildcatHell, 1);
  assert.equal(L.passedTotal, 750);
  assert.equal(L.takenByRivals, 500);
  assert.equal(L.leftOpen, 250);
});

t("buildLedger: no userId → no salvage/wildcat scan; empty rig → zeroed totals", () => {
  const L = buildLedger({ plot: null, drill: null, allPlots: { a: { col: 0, row: 0, lateralTaken: { 1: "x" } } }, userId: null });
  assert.deepEqual(L.rows, []);
  assert.equal(L.banked, 0); assert.equal(L.leftOpen, 0); assert.equal(L.chargesSpent, 0);
});

t("buildReckoning: seed known → column total covers unreached layers; stranded = open passes + never reached", () => {
  const me = "me";
  // 6-layer column: reached 4 (L1..L4). L1 dry pass, L2 extracted 400, L3 passed 900 (rival took it), L4 hell (capped).
  const plot = { col: 2, row: 2, drillDay: 4, revealed: { 0: 0, 1: 400, 2: 900, 3: 0 }, extracted: { 1: 400 },
    passed: { 2: 900 }, lateralTaken: { 2: "rival" }, hellLayers: { 3: true }, hellCapped: { 3: true } };
  const drill = { totalCollected: 1000, chargesSpent: 3, layersExtracted: { 1: 400 }, layersPassed: { 0: 0, 2: 900 } };
  const allPlots = { "2_2": plot, "3_2": { col: 3, row: 2, passed: { 5: 600 }, lateralTaken: { 5: me } } };
  const column = { oil: [0, 400, 900, 777, 250, 0], hell: [3] };  // seed says L5 held 250, L6 nothing
  const r = buildReckoning({ plot, drill, allPlots, userId: me, column, depthZ: 6, usdRate: 0.001, chargesCap: 8 });
  assert.equal(r.columnTotal, 400 + 900 + 250);      // hell counts 0, L4's 777 is under a hell pocket → 0
  assert.equal(r.unknownLayers, 0);
  assert.equal(r.hellLayers, 1); assert.equal(r.hellCapped, 1);
  assert.equal(r.extractedOwn, 400);
  assert.equal(Math.round(r.captureRate * 100), 26);
  assert.equal(r.takenByRivals, 900); assert.equal(r.leftOpen, 0);
  assert.equal(r.neverReachedLayers, 2); assert.equal(r.neverReachedOil, 250);
  assert.equal(r.stranded, 250);
  assert.equal(r.salvagedIn, 600); assert.equal(r.salvageCount, 1);
  assert.equal(r.banked, 1000); assert.equal(r.payoutUsd, 1);
  assert.equal(r.chargesUnspent, 5);
  assert.equal(r.pendingUnresolved, false);
});

t("buildReckoning: seed unknown → unreached layers are sealed, not zero", () => {
  const plot = { col: 0, row: 0, drillDay: 2, revealed: { 0: 100, 1: 0 }, extracted: { 0: 100 } };
  const drill = { totalCollected: 100, chargesSpent: 1, layersExtracted: { 0: 100 }, layersPassed: { 1: 0 } };
  const r = buildReckoning({ plot, drill, allPlots: {}, userId: "me", column: null, depthZ: 5, usdRate: 0.001, chargesCap: 8 });
  assert.equal(r.columnTotal, 100);
  assert.equal(r.unknownLayers, 3);
  assert.equal(r.neverReachedLayers, 3); assert.equal(r.neverReachedOil, 0);
  assert.equal(r.stranded, 0);
  assert.match(reckoningText(r, { col: 0, row: 0 }), /3 layers still sealed/);
  assert.match(reckoningText(r, { col: 0, row: 0 }), /plot \(1,1\)/);
});

t("reckoningShareText / reckoningStrip: share line + per-layer strip", () => {
  const plot = { col: 0, row: 0, drillDay: 4, revealed: { 0: 100, 1: 0, 2: 300, 3: 50 }, extracted: { 0: 100 }, passed: { 2: 300, 3: 50 }, lateralTaken: { 2: "rival" }, hellLayers: {} };
  const drill = { totalCollected: 100, chargesSpent: 1, layersExtracted: { 0: 100 }, layersPassed: { 1: 0, 2: 300, 3: 50 } };
  const r = buildReckoning({ plot, drill, allPlots: {}, userId: "me", column: { oil: [100, 0, 300, 50, 700, 0], hell: [5] }, depthZ: 6, usdRate: 0.01, chargesCap: 8 });
  const story = reckoningStory(r, { col: 0, row: 0 });
  assert.match(story, /^I ran a rig on plot \(1,1\) of the Hail Mary oil field/);
  assert.match(story, /brought up 100 BTR and I was paid \$1\.00 in USDC/);
  assert.match(story, /neighbours took 300 BTR/);
  assert.match(story, /750 BTR is still down there\.$/);
  const txt = reckoningShareText(r, { refCode: "ABC", col: 0, row: 0 });
  assert.ok(txt.startsWith(story));
  assert.match(txt, /rl80\.com\/hailmary\?ref=ABC$/);
  assert.equal(reckoningStrip(r).map((x) => x.state).join(","), "extracted,dry,taken,open,missed,hell");
  const dry = buildReckoning({ plot: { col: 0, row: 0, drillDay: 2, revealed: { 0: 0, 1: 0 } }, drill: { totalCollected: 0, layersPassed: { 0: 0, 1: 0 } }, allPlots: {}, userId: "me", column: null, depthZ: 3 });
  assert.match(reckoningStory(dry), /banked nothing\. 1 layer is still sealed/);
  assert.equal(reckoningStrip(dry)[2].state, "sealed");
});

t("heatReading: distance not diagnosis — below = high, two down or next door = elevated, lode counts", () => {
  const rd = (hell, lode, col, row, layer, extra = {}) => heatReading({
    isHellAt: (c, r, z) => hell.has(`${c}_${r}_${z}`), oilAt: (c, r, z) => (lode.has(`${c}_${r}_${z}`) ? 1000 : 10),
    motherlodeMin: 850, col, row, layer, depthZ: 20, gridSize: 10, ...extra });
  const H = (k) => new Set([k]), none = new Set();
  assert.deepEqual(rd(H("5_5_7"), none, 5, 5, 6), { level: "high", kind: "hell", layersDown: 1, lateral: false });
  assert.deepEqual(rd(none, H("5_5_7"), 5, 5, 6), { level: "high", kind: "lode", layersDown: 1, lateral: false });
  assert.deepEqual(rd(H("5_5_7"), none, 5, 5, 5), { level: "elevated", kind: "hell", layersDown: 2, lateral: false });
  assert.deepEqual(rd(H("6_5_7"), none, 5, 5, 6), { level: "elevated", kind: "hell", layersDown: 1, lateral: true });   // next door, next layer
  assert.deepEqual(rd(H("6_6_8"), none, 5, 5, 6), { level: "elevated", kind: "hell", layersDown: 2, lateral: true });   // diagonal, two down
  assert.equal(rd(H("6_6_8"), none, 5, 5, 6, { neighbours: "ortho4" }).level, "nominal");                                // diagonals off
  assert.equal(rd(H("6_5_7"), none, 5, 5, 6, { neighbours: "none" }).level, "nominal");
  assert.equal(rd(H("5_5_7"), none, 5, 5, 4).level, "nominal");                                                          // three down: silent
  assert.equal(rd(H("5_5_7"), none, 5, 5, 7).level, "nominal");                                                          // the hot core itself reads what is below it
  assert.equal(rd(none, H("5_5_20"), 5, 5, 19).level, "nominal");                                                        // never past the floor
  assert.equal(rd(none, H("5_5_7"), 5, 5, 6, { motherlodeMin: 0 }).level, "nominal");                                    // lode source disabled
  assert.match(assayAlertBody({ col: 0, row: 0, layer: 5, oil: 0, threshold: 100, chargesRemaining: 3, heat: "high" }), /Hot zone directly below/);
  assert.doesNotMatch(assayAlertBody({ col: 0, row: 0, layer: 5, oil: 0, threshold: 100, chargesRemaining: 3 }), /Hot zone/);
  const rack = buildColumnRack({ plot: { drillDay: 6, revealed: { 4: 100, 5: 0 }, heat: { 4: "elevated" } }, drill: { drillDay: 6, layersExtracted: { 4: 100 }, pending: { layer: 5, oil: 0, heat: "high" } }, depthZ: 8 });
  assert.equal(rack[4].heat, "elevated"); assert.equal(rack[5].heat, "high"); assert.equal(rack[3].heat, null);
  assert.ok(HEAT_COPY.high.warn && HEAT_COPY.elevated.warn && !HEAT_COPY.nominal.warn);
});

t("casing: shouldCase, the rack, the ledger and the reckoning agree on a cased layer", () => {
  assert.deepEqual(shouldCase({ armed: true, casing: 1 }), { case: true, via: "armed" });
  assert.deepEqual(shouldCase({ armed: true, casing: 0 }), { case: false, via: null });
  assert.deepEqual(shouldCase({ orders: { caseOnHeat: true }, lastHeat: "high", casing: 2 }), { case: true, via: "order" });
  assert.deepEqual(shouldCase({ orders: { caseOnHeat: true }, lastHeat: "elevated", casing: 2 }), { case: false, via: null });
  assert.match(casedAlertBody({ col: 0, row: 0, layer: 6, oil: 0, hell: true }), /HELL POCKET.*Sealed/);
  assert.match(casedAlertBody({ col: 0, row: 0, layer: 6, oil: 1800, hell: false }), /1,800 BTR.*never produced/);
  const plot = { col: 0, row: 0, drillDay: 8, revealed: { 5: 0, 6: 1800, 7: 120 }, extracted: {}, passed: { 5: 0 }, cased: { 6: true }, hellLayers: {} };
  const drill = { totalCollected: 0, chargesSpent: 0, layersPassed: { 5: 0 }, pending: { layer: 7, oil: 120 } };
  const rack = buildColumnRack({ plot, drill, depthZ: 10 });
  assert.equal(rack[6].state, "cased"); assert.equal(rack[6].oil, 1800);
  const led = buildLedger({ plot, drill, allPlots: {}, userId: "me" });
  assert.equal(led.casedOff, 1800); assert.equal(led.casedCount, 1); assert.ok(led.rows.some((r) => r.kind === "cased" && r.layer === 6));
  const r = buildReckoning({ plot, drill, allPlots: {}, userId: "me", column: { oil: [0, 0, 0, 0, 0, 0, 1800, 120, 0, 0], hell: [] }, depthZ: 10, usdRate: 0.001, chargesCap: 8 });
  assert.equal(r.casedOff, 1800);
  assert.match(reckoningText(r, { col: 0, row: 0 }), /Cased through 1 layer: 1,800 BTR cased off/);
  assert.match(reckoningStory(r, { col: 0, row: 0 }), /cased off 1,800 BTR I never saw/);
  assert.equal(reckoningStrip(r)[6].state, "cased");
  // a cased hell pocket is not a breach
  const hp = { col: 0, row: 0, drillDay: 7, revealed: { 6: 0 }, cased: { 6: true }, hellLayers: { 6: true } };
  const hl = buildLedger({ plot: hp, drill: {}, allPlots: {}, userId: "me" });
  assert.equal(hl.casedHell, 1); assert.equal(buildColumnRack({ plot: hp, drill: {}, depthZ: 8 })[6].state, "cased");
});

t("buildReckoning: empty rig → zeros, no NaN; a leftover pending is flagged", () => {
  const r = buildReckoning({ plot: null, drill: { pending: { layer: 3, oil: 5 } }, allPlots: {}, userId: null, column: null, depthZ: 4 });
  assert.equal(r.banked, 0); assert.equal(r.payoutUsd, 0); assert.equal(r.captureRate, null);
  assert.equal(r.unknownLayers, 4); assert.equal(r.pendingUnresolved, true);
  assert.ok(!/NaN/.test(reckoningText(r)));
});

t("reached depth is the deeper of plot.drillDay and drill.drillDay", () => {
  const rack = buildColumnRack({ plot: { drillDay: 0, revealed: {} }, drill: { drillDay: 3 }, depthZ: 5 });
  assert.deepEqual(rack.map((r) => r.state), ["revealed", "revealed", "revealed", "undrilled", "undrilled"]);
  const r = buildReckoning({ plot: { drillDay: 0 }, drill: { drillDay: 3 }, allPlots: {}, userId: "me", column: null, depthZ: 5 });
  assert.equal(r.reached, 3); assert.equal(r.neverReachedLayers, 2);
});

t("pickSalvageOrder: earliest-set order wins; line, charges and dry pockets filter", () => {
  const c = (userId, setAt, extra = {}) => ({ userId, salvage: true, setAt, chargesRemaining: 3, threshold: 500, ...extra });
  assert.equal(pickSalvageOrder({ oil: 900 }, [c("late", 200), c("early", 100)]).userId, "early");
  assert.equal(pickSalvageOrder({ oil: 900 }, [c("a", 100), c("b", 100)]).userId, "a");                 // tie → stable by id
  assert.equal(pickSalvageOrder({ oil: 900 }, [c("unset", undefined), c("set", 999)]).userId, "set");   // never-stamped loses
  assert.equal(pickSalvageOrder({ oil: 400 }, [c("x", 1)]), null);                                       // below the line
  assert.equal(pickSalvageOrder({ oil: 900 }, [c("x", 1, { chargesRemaining: 0 })]), null);              // no charge
  assert.equal(pickSalvageOrder({ oil: 900 }, [c("x", 1, { salvage: false })]), null);                   // order off
  assert.equal(pickSalvageOrder({ oil: 0, hasInclusion: true }, [c("x", 1, { threshold: 0 })]), null);   // crew never gambles
  assert.equal(pickSalvageOrder({ oil: 900 }, []), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
