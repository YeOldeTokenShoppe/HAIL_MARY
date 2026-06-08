// Unit test for the pure depth-lever math (src/lib/oilBonusMath.js).
// No Firebase. Run: node scripts/test-oil-bonus.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../src/lib/oilBonusMath.js", import.meta.url), "utf8");
const m = await import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
const { MAX_BONUS_DRILLS, BONUS_LEVERS, HOLDING_MILESTONE_DAYS, holdingMilestonesPassed, bonusAddFor } = m;

const DAY = 86400000;
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log(`  ✓ ${name}`); } catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); } };

console.log("\noilBonusMath — depth-lever math\n");

console.log("config");
t("global cap is 10 (→ 20 depth)", () => assert.equal(MAX_BONUS_DRILLS, 10));
t("share + holding sub-caps both 3", () => { assert.equal(BONUS_LEVERS.share.max, 3); assert.equal(BONUS_LEVERS.holding.max, 3); });
t("milestones are 30/60/90 days", () => assert.deepEqual(HOLDING_MILESTONE_DAYS, [30, 60, 90]));

console.log("holdingMilestonesPassed (diamond-hands, absolute days)");
t("under 30 days → 0 (dormant — distinct from per-season floor)", () => assert.equal(holdingMilestonesPassed(29 * DAY), 0));
t("30 days → 1", () => assert.equal(holdingMilestonesPassed(30 * DAY), 1));
t("60 days → 2", () => assert.equal(holdingMilestonesPassed(60 * DAY), 2));
t("90 days → 3 (full)", () => assert.equal(holdingMilestonesPassed(90 * DAY), 3));
t("200 days → still 3 (capped at milestone count)", () => assert.equal(holdingMilestonesPassed(200 * DAY), 3));
t("zero / negative held → 0", () => { assert.equal(holdingMilestonesPassed(0), 0); assert.equal(holdingMilestonesPassed(-5 * DAY), 0); });

console.log("bonusAddFor — incremental (per-event, e.g. an approved share)");
t("fresh lever adds +1", () => assert.equal(bonusAddFor({ current: 0, used: 0, per: 1, max: 3 }), 1));
t("sub-cap reached → 0 (one lever can't fill the whole pool)", () => assert.equal(bonusAddFor({ current: 3, used: 3, per: 1, max: 3 }), 0));
t("global cap reached → 0 even with sub-cap room", () => assert.equal(bonusAddFor({ current: 10, used: 0, per: 1, max: 3 }), 0));
t("global cap clamps the last unit", () => assert.equal(bonusAddFor({ current: 9, used: 0, per: 1, max: 3 }), 1));

console.log("bonusAddFor — top-up (duration, e.g. diamond-hands milestones)");
t("tops up to the target", () => assert.equal(bonusAddFor({ current: 0, used: 0, max: 3, targetTotal: 2 }), 2));
t("already at target → 0 (idempotent across snapshots)", () => assert.equal(bonusAddFor({ current: 2, used: 2, max: 3, targetTotal: 2 }), 0));
t("partial top-up from prior credit", () => assert.equal(bonusAddFor({ current: 1, used: 1, max: 3, targetTotal: 3 }), 2));
t("target above sub-cap clamps to sub-cap", () => assert.equal(bonusAddFor({ current: 0, used: 0, max: 3, targetTotal: 5 }), 3));
t("global cap clamps the top-up", () => assert.equal(bonusAddFor({ current: 9, used: 0, max: 3, targetTotal: 3 }), 1));

console.log("interaction — levers stack toward the shared cap");
t("referrals (8) + share top-up still respects global 10", () => {
  // referrals already put bonusDrills at 8; a fresh share lever can add only up to 2 more.
  assert.equal(bonusAddFor({ current: 8, used: 0, per: 1, max: 3 }), 1); // +1 (room: 2, per: 1)
  assert.equal(bonusAddFor({ current: 9, used: 1, per: 1, max: 3 }), 1); // +1 → hits 10
  assert.equal(bonusAddFor({ current: 10, used: 2, per: 1, max: 3 }), 0); // capped
});

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
