// v2 EXTRACT-OR-PASS loop math (docs/oil-game.md → "v2 LOOP"). Pure, no IO —
// unit-testable in isolation and shared by the strike tick, the decide route,
// and sims (mirrors the oilStrikeClock.js pattern).
//
// Vocabulary: a CHARGE is the extraction budget (passive + bonusDrills, capped
// at the field depth). The bore itself is no longer gated by charges — it
// reveals every layer over the season; charges decide what you KEEP.
// BTR only ever flows toward the player; charges only ever flow away.

export const PASSIVE_CHARGES = 8;

// Total charges this rig can ever spend this season.
export function chargesCapFor(drill, settings = {}, depthZ = 20) {
  const passive = Number(settings.passiveCharges ?? PASSIVE_CHARGES);
  const bonus = (drill && drill.bonusDrills) || 0;
  return Math.min(passive + bonus, depthZ);
}

export function chargesRemainingFor(drill, settings = {}, depthZ = 20) {
  return Math.max(0, chargesCapFor(drill, settings, depthZ) - ((drill && drill.chargesSpent) || 0));
}

// Resolve a pending layer by the player's standing order. Rules, in order:
//   • dry layer            → pass (free — extracting nothing would waste a charge)
//   • no charges           → pass (nothing to decide)
//   • autopilot (OPT-IN)   → extract when charges cover every layer left
//   • oil ≥ threshold      → extract
//   • otherwise            → pass
// Autopilot is opt-in (decided 2026-08-27): forced auto-extraction is
// dominated play once laterals/wildcats compete for the same charges — at 20
// charges it would fire from layer 1 and starve the frontier game entirely.
// The crew reads BTR only — inclusions NEVER auto-extract a below-line layer
// (§Multi-element core: "the crew never gambles").
export function resolvePendingDecision({ pending, threshold = 0, chargesRemaining = 0, depthZ = 20, autopilot = false }) {
  const oil = (pending && pending.oil) || 0;
  if (oil <= 0) return "pass";
  if (chargesRemaining <= 0) return "pass";
  if (autopilot && chargesRemaining >= depthZ - pending.layer) return "extract";
  return oil >= threshold ? "extract" : "pass";
}

// Copy-rule strings (docs/oil-game.md → "Copy rule"): the cost model is always
// explicit, and the threshold is always phrased as the crew's standing order —
// never a bare number (a bare "your line: 764" was read as a price).
export function assayAlertBody({ col, row, layer, oil, threshold, chargesRemaining, hasInclusion }) {
  const plot = `Plot (${col + 1}, ${row + 1})`;
  const incl = hasInclusion ? "\n🏺 Anomalous inclusion detected — extract to recover it." : "";
  if (oil <= 0) {
    return `${plot} L${layer + 1}: dry — passes free at the next strike.${incl}`;
  }
  const would = resolvePendingDecision({ pending: { layer, oil }, threshold, chargesRemaining, depthZ: 20 }) === "extract"
    ? "EXTRACT" : "PASS";
  return `${plot} L${layer + 1} assays ${Math.round(oil).toLocaleString()} BTR.\n` +
    `EXTRACT banks the full amount for 1 charge · PASS is free but final (opens to neighbours).\n` +
    `If you're away, the crew follows your standing order ("extract ≥ ${Math.round(threshold).toLocaleString()}") → would ${would}. ` +
    `Charges: ${chargesRemaining}.${incl}`;
}
