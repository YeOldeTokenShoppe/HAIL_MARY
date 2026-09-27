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

// ── Decision-surface data builders (plain-chrome plumbing, 2026-09-27) ───────
// Pure: the page feeds them the rig doc, the rig's own plot doc and the public
// plots map; the Core Sample renders what comes back. Nothing here reads the
// seed — every input is a server-authoritative reveal or a public plot field.

// Short human span: "42 min", "9.6 h", "3.1 d". Used by the cadence line and
// the pending-layer countdown.
export function fmtSpan(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = ms / 60000;
  if (m < 1) return "<1 min";
  if (m < 90) return `${Math.round(m)} min`;
  const h = m / 60;
  if (h < 48) return `${(Math.round(h * 10) / 10).toString().replace(/\.0$/, "")} h`;
  return `${(Math.round((h / 24) * 10) / 10).toString().replace(/\.0$/, "")} d`;
}

// The claim's column, layer by layer (the "core rack" — always visible).
// States: undrilled · pending · extracted · passed (open next door) ·
// salvaged (a neighbour took the pass) · dry (passed, nothing there) ·
// hell · hell_capped · revealed (resolved outside the v2 maps — legacy data or
// a buzzer sweep that left no map entry; shown as neutral, never as a choice).
export function buildColumnRack({ plot, drill, depthZ = 20 }) {
  const p = plot || {};
  const d = drill || {};
  const pending = d.pending && typeof d.pending.layer === "number" ? d.pending : null;
  const out = [];
  for (let z = 0; z < depthZ; z++) {
    const inclusion = !!(p.inclusionFlags?.[z] || p.passedInclusions?.[z]);
    if (pending && pending.layer === z) {
      out.push({ layer: z, state: "pending", oil: pending.oil || 0, hasInclusion: !!pending.hasInclusion || inclusion, takenBy: null });
      continue;
    }
    if (p.hellLayers?.[z]) {
      out.push({ layer: z, state: p.hellCapped?.[z] ? "hell_capped" : "hell", oil: 0, hasInclusion: false, takenBy: null });
      continue;
    }
    if (d.layersExtracted?.[z] !== undefined || p.extracted?.[z] !== undefined) {
      const oil = d.layersExtracted?.[z] ?? p.extracted?.[z] ?? 0;
      out.push({ layer: z, state: "extracted", oil: oil || 0, hasInclusion: inclusion, takenBy: null });
      continue;
    }
    if (d.layersPassed?.[z] !== undefined || p.passed?.[z] !== undefined) {
      const oil = d.layersPassed?.[z] ?? p.passed?.[z] ?? 0;
      const takenBy = p.lateralTaken?.[z] ?? null;
      const state = takenBy != null ? "salvaged" : (oil || 0) > 0 ? "passed" : "dry";
      out.push({ layer: z, state, oil: oil || 0, hasInclusion: inclusion, takenBy });
      continue;
    }
    if (p.revealed?.[z] !== undefined || z < (p.drillDay || 0)) {
      out.push({ layer: z, state: "revealed", oil: p.revealed?.[z] || 0, hasInclusion: inclusion, takenBy: null });
      continue;
    }
    out.push({ layer: z, state: "undrilled", oil: 0, hasInclusion: false, takenBy: null });
  }
  return out;
}

// The running ledger: every charge spent and every layer let go, with totals.
// Own-column rows come from the rig's layersExtracted / layersPassed maps;
// salvage and wildcat rows are derived from the PUBLIC plot docs (lateralTaken /
// wildcatTaken stamped with this userId), so the ledger needs no private
// history. Rows carry no timestamps (none are stored) — own rows sort by layer,
// then salvage, then wildcats by coordinate.
export function buildLedger({ plot, drill, allPlots = {}, userId }) {
  const p = plot || {};
  const d = drill || {};
  const rows = [];
  let extractedOwn = 0, passedTotal = 0, takenByRivals = 0, salvagedIn = 0, wildcatIn = 0, wildcatDry = 0, wildcatHell = 0;

  for (const [ls, oil] of Object.entries(d.layersExtracted || {})) {
    const layer = Number(ls); const v = Number(oil) || 0;
    extractedOwn += v;
    rows.push({ kind: "extract", layer, oil: v, charge: 1 });
  }
  for (const [ls, oil] of Object.entries(d.layersPassed || {})) {
    const layer = Number(ls); const v = Number(oil) || 0;
    const takenBy = p.lateralTaken?.[layer] ?? null;
    passedTotal += v;
    if (takenBy != null) takenByRivals += v;
    rows.push({ kind: "pass", layer, oil: v, charge: 0, takenBy });
  }
  rows.sort((a, b) => a.layer - b.layer);

  const salvage = [], wildcats = [];
  if (userId) {
    for (const q of Object.values(allPlots)) {
      if (!q || q.col == null || q.row == null) continue;
      for (const [ls, who] of Object.entries(q.lateralTaken || {})) {
        if (who !== userId) continue;
        const layer = Number(ls); const v = Number(q.passed?.[layer]) || 0;
        salvagedIn += v;
        salvage.push({ kind: "salvage", col: q.col, row: q.row, layer, oil: v, charge: 1 });
      }
      for (const [ls, who] of Object.entries(q.wildcatTaken || {})) {
        if (who !== userId) continue;
        const layer = Number(ls);
        const hell = !!q.hellLayers?.[layer];
        const v = hell ? 0 : (Number(q.revealed?.[layer]) || 0);
        if (hell) wildcatHell += 1; else if (v > 0) wildcatIn += v; else wildcatDry += 1;
        wildcats.push({ kind: "wildcat", col: q.col, row: q.row, layer, oil: v, hell, charge: 1 });
      }
    }
  }
  const byCoord = (a, b) => (a.col - b.col) || (a.row - b.row) || (a.layer - b.layer);
  salvage.sort(byCoord); wildcats.sort(byCoord);

  return {
    rows: rows.concat(salvage, wildcats),
    banked: Number(d.totalCollected) || 0,
    chargesSpent: Number(d.chargesSpent) || 0,
    extractedOwn, salvagedIn, wildcatIn, wildcatDry, wildcatHell,
    passedTotal, takenByRivals, leftOpen: passedTotal - takenByRivals,
  };
}
