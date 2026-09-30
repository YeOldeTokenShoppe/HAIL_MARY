// v2 EXTRACT-OR-PASS loop math (docs/oil-game.md → "v2 LOOP"). Pure, no IO —
// unit-testable in isolation and shared by the strike tick, the decide route,
// and sims (mirrors the oilStrikeClock.js pattern).
//
// Vocabulary: a CHARGE is the extraction budget. The bore itself is no longer
// gated by charges — it reveals every layer over the season; charges decide
// what you KEEP. BTR only ever flows toward the player; charges only ever
// flow away.
//
// Cap (Michelle, 2026-09-29): passive charges are capped at the column depth
// (20 = enough to keep every layer under you); BONUS charges sit ON TOP —
// they are the extra you spend next door (laterals, wildcats), so a rig on a
// board with passive 20 still sees its ticket and referral bonuses. The bonus
// itself is capped where it is granted (MAX_BONUS_DRILLS = 10 in
// lib/oilBonusMath.js), so the most a rig ever holds is depthZ + 10.

export const PASSIVE_CHARGES = 8;

// Total charges this rig can ever spend this season.
export function chargesCapFor(drill, settings = {}, depthZ = 20) {
  const passive = Number(settings.passiveCharges ?? PASSIVE_CHARGES);
  const bonus = Math.max(0, (drill && drill.bonusDrills) || 0);
  return Math.min(passive, depthZ) + bonus;
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
// ── Heat on the assay — a distance, not a diagnosis (Michelle, 2026-09-29) ──
// The strike tick knows the map; each revealed core carries a coarse, honest
// reading of the nearest HOT BODY within reach of the bit: a hell pocket or a
// motherlode (the season's top tier, ≥ 85% of the richest cell). Intensity
// encodes distance only, never kind, never whose column:
//   high      the cell directly below the bore head (next layer)
//   elevated  two layers below, or a neighbouring column at the next layer or
//             two (HEAT_NEIGHBOURS: the 8 around, the 4 orthogonal, or none)
//   nominal   nothing hot within reach — silent
// So a reading has honest rivals: hell under you, riches under you, hell next
// door, riches next door. Only `level` is published (pending.heat on the rig,
// plot.heat[layer] on the plot, public); the breakdown this returns is for the
// tick, the tests and the tuning script — never written anywhere a client reads.
// Counterplay (step 2): casing through the next layer seals whatever it holds.
export const HEAT_LOOKAHEAD = 2;         // layers below the bore head that read
export const HEAT_NEIGHBOURS = "all8";   // "all8" | "ortho4" | "none" — tune with scripts/oil-heat-rate.mjs
export const HEAT_LODE_FRACTION = 0.85;  // motherlode = this share of the field's richest cell (strike-tick tier)
export const HEAT_COPY = {
  nominal:  { temp: "Ambient",  warn: null },
  elevated: { temp: "Elevated", warn: "!! HEAT RISING — SOMETHING HOT WITHIN REACH !!",
              alert: "🌡 Heat rising in the core: a hell pocket or a motherlode within two cells — under you or next door." },
  high:     { temp: "High",     warn: "!! HOT ZONE DIRECTLY BELOW — HELL OR THE MOTHERLODE !!",
              alert: "🔥 Hot zone directly below the bit: the next layer is a hell pocket or a motherlode. Arm the casing to seal it — whatever it is — or ride it." },
};

// ── Casing (step 2, Michelle 2026-09-29) ─────────────────────────────────────
// The bore cannot skip a layer; it can drill THROUGH one with the hole sealed.
// Casing is FREE (Michelle, 2026-09-30): no supply, no stall, no count — the
// layer's forfeit is the whole price. Armed before the strike (`casingArmed`,
// one-shot) — or the standing order CASE ON HEAT when the last core read HIGH —
// makes the tick case the next layer: no core on the table, no charge, no
// breach if it was hell, and no oil if it was the motherlode — cased off, never
// produced. The forfeit is what makes the reading a decision.
// (`supplies.casing` / casingCount were the 2026-09-29 supply model; dropped.)
export function shouldCase({ armed = false, orders = null, lastHeat = null } = {}) {
  if (armed === true) return { case: true, via: "armed" };
  if (orders?.caseOnHeat === true && lastHeat === "high") return { case: true, via: "order" };
  return { case: false, via: null };
}
export function casedAlertBody({ col, row, layer, oil, hell }) {
  const plot = `Plot (${col + 1}, ${row + 1})`;
  if (hell) return `${plot} L${layer + 1}: the crew cased through a HELL POCKET. Sealed behind steel — no breach, no demon.`;
  if (oil > 0) return `${plot} L${layer + 1}: the crew cased through ${Math.round(oil).toLocaleString()} BTR. Cased off — behind steel, never produced.`;
  return `${plot} L${layer + 1}: the crew cased through dry shale. Nothing lost but the layer.`;
}
const NEIGHBOUR_SETS = {
  all8: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
  ortho4: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  none: [],
};
// isHellAt(c, r, z) · oilAt(c, r, z) → number · motherlodeMin: oil at or above = a lode (0 disables).
export function heatReading({ isHellAt, oilAt, motherlodeMin = 0, col, row, layer, depthZ = 20, gridSize = 10, lookahead = HEAT_LOOKAHEAD, neighbours = HEAT_NEIGHBOURS }) {
  const hot = (c, r, z) => {
    if (c < 0 || r < 0 || c >= gridSize || r >= gridSize || z >= depthZ) return null;
    if (isHellAt(c, r, z)) return "hell";
    if (motherlodeMin > 0 && (Number(oilAt(c, r, z)) || 0) >= motherlodeMin) return "lode";
    return null;
  };
  // directly below first (the only "high"), then the rest of the box
  const below = hot(col, row, layer + 1);
  if (below) return { level: "high", kind: below, layersDown: 1, lateral: false };
  let best = null;
  for (let k = 1; k <= lookahead; k++) {
    const z = layer + k;
    if (k > 1) { const own = hot(col, row, z); if (own) { best = { level: "elevated", kind: own, layersDown: k, lateral: false }; break; } }
    for (const [dc, dr] of (NEIGHBOUR_SETS[neighbours] || [])) {
      const h = hot(col + dc, row + dr, z);
      if (h) { best = { level: "elevated", kind: h, layersDown: k, lateral: true }; break; }
    }
    if (best) break;
  }
  return best || { level: "nominal", kind: null, layersDown: null, lateral: false };
}

export function assayAlertBody({ col, row, layer, oil, threshold, chargesRemaining, hasInclusion, heat = "nominal" }) {
  const plot = `Plot (${col + 1}, ${row + 1})`;
  const incl = hasInclusion ? "\n🏺 Anomalous inclusion detected — extract to recover it." : "";
  const hot = HEAT_COPY[heat]?.alert ? `\n${HEAT_COPY[heat].alert}` : "";
  if (oil <= 0) {
    return `${plot} L${layer + 1}: dry — passes free at the next strike.${incl}${hot}`;
  }
  const would = resolvePendingDecision({ pending: { layer, oil }, threshold, chargesRemaining, depthZ: 20 }) === "extract"
    ? "EXTRACT" : "PASS";
  return `${plot} L${layer + 1} assays ${Math.round(oil).toLocaleString()} BTR.\n` +
    `EXTRACT banks the full amount for 1 charge · PASS is free but final (opens to neighbours).\n` +
    `If you're away, the crew follows your standing order ("extract ≥ ${Math.round(threshold).toLocaleString()}") → would ${would}. ` +
    `Charges: ${chargesRemaining}.${incl}${hot}`;
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
// cased (drilled through behind steel — the reveal says what it held) ·
// hell · hell_capped · revealed (resolved outside the v2 maps — legacy data or
// a buzzer sweep that left no map entry; shown as neutral, never as a choice).
export function buildColumnRack({ plot, drill, depthZ = 20 }) {
  const p = plot || {};
  const d = drill || {};
  const pending = d.pending && typeof d.pending.layer === "number" ? d.pending : null;
  // Reached depth: the plot doc is authoritative, but a rig doc can carry it
  // too (legacy / optimistic paths) — take the deeper of the two.
  const reached = Math.max(Number(p.drillDay) || 0, Number(d.drillDay) || 0);
  const out = [];
  for (let z = 0; z < depthZ; z++) {
    const inclusion = !!(p.inclusionFlags?.[z] || p.passedInclusions?.[z]);
    // heat: the hell warning read on this core (plot.heat is public; the
    // pending core carries its own copy) — "elevated" | "high" | null
    const heat = (pending && pending.layer === z && pending.heat && pending.heat !== "nominal") ? pending.heat
      : (p.heat?.[z] && p.heat[z] !== "nominal") ? p.heat[z] : null;
    if (pending && pending.layer === z) {
      out.push({ layer: z, state: "pending", oil: pending.oil || 0, hasInclusion: !!pending.hasInclusion || inclusion, takenBy: null, heat });
      continue;
    }
    if (p.cased?.[z]) {
      // cased through: sealed behind steel — the reveal says what was there
      out.push({ layer: z, state: "cased", oil: Number(p.revealed?.[z]) || 0, hell: !!p.hellLayers?.[z], hasInclusion: false, takenBy: null, heat });
      continue;
    }
    if (p.hellLayers?.[z]) {
      out.push({ layer: z, state: p.hellCapped?.[z] ? "hell_capped" : "hell", oil: 0, hasInclusion: false, takenBy: null, heat });
      continue;
    }
    if (d.layersExtracted?.[z] !== undefined || p.extracted?.[z] !== undefined) {
      const oil = d.layersExtracted?.[z] ?? p.extracted?.[z] ?? 0;
      out.push({ layer: z, state: "extracted", oil: oil || 0, hasInclusion: inclusion, takenBy: null, heat });
      continue;
    }
    if (d.layersPassed?.[z] !== undefined || p.passed?.[z] !== undefined) {
      const oil = d.layersPassed?.[z] ?? p.passed?.[z] ?? 0;
      const takenBy = p.lateralTaken?.[z] ?? null;
      const state = takenBy != null ? "salvaged" : (oil || 0) > 0 ? "passed" : "dry";
      out.push({ layer: z, state, oil: oil || 0, hasInclusion: inclusion, takenBy, heat });
      continue;
    }
    if (p.revealed?.[z] !== undefined || z < reached) {
      out.push({ layer: z, state: "revealed", oil: p.revealed?.[z] || 0, hasInclusion: inclusion, takenBy: null, heat });
      continue;
    }
    out.push({ layer: z, state: "undrilled", oil: 0, hasInclusion: false, takenBy: null, heat });
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
  let casedOff = 0, casedHell = 0, casedCount = 0;

  for (const ls of Object.keys(p.cased || {})) {
    const layer = Number(ls); const hell = !!p.hellLayers?.[layer]; const v = hell ? 0 : (Number(p.revealed?.[layer]) || 0);
    casedCount += 1; if (hell) casedHell += 1; else casedOff += v;
    rows.push({ kind: "cased", layer, oil: v, hell, charge: 0 });
  }
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
    casedOff, casedHell, casedCount,
  };
}

// ── THE RECKONING — the player's season-end account (plain, 2026-09-27) ──────
// "Banked · what was under your column · what rivals took from your passes ·
// what you left stranded · what your wildcats found · payout." Everything is
// derived from server reveals + public plot docs, EXCEPT the column total for
// layers the bore never reached: that needs the map, so the page passes
// `column` ({ oil: number[depthZ], hell: number[] }) ONLY after the game has
// ended and the server has published the seed — before that `column` is null
// and the total is reported with `unknownLayers` still sealed.
export function buildReckoning({ plot, drill, allPlots = {}, userId, column = null, depthZ = 20, usdRate = 0, chargesCap = 0 }) {
  const p = plot || {};
  const d = drill || {};
  const ledger = buildLedger({ plot: p, drill: d, allPlots, userId });
  const reached = Math.max(0, Math.min(depthZ, Math.max(Number(p.drillDay) || 0, Number(d.drillDay) || 0)));
  const colHell = new Set((column && column.hell) || []);

  let columnTotal = 0, unknownLayers = 0, neverReachedOil = 0, hellLayers = 0, hellCapped = 0;
  const layers = [];
  for (let z = 0; z < depthZ; z++) {
    const hell = !!p.hellLayers?.[z] || colHell.has(z);
    const revealed = p.revealed?.[z];
    let oil = null;
    if (hell) oil = 0;
    else if (revealed !== undefined) oil = Number(revealed) || 0;
    else if (column && Array.isArray(column.oil)) oil = Number(column.oil[z]) || 0;
    if (hell) { hellLayers += 1; if (p.hellCapped?.[z]) hellCapped += 1; }
    if (oil == null) unknownLayers += 1; else columnTotal += oil;
    const reachedZ = z < reached || revealed !== undefined;
    if (!reachedZ && oil != null) neverReachedOil += oil;
    layers.push({ layer: z, oil, hell, reached: reachedZ });
  }
  const neverReachedLayers = layers.filter((l) => !l.reached).length;
  const stranded = ledger.leftOpen + neverReachedOil;
  const banked = ledger.banked;
  const chargesUnspent = Math.max(0, (Number(chargesCap) || 0) - ledger.chargesSpent);
  const pendingUnresolved = !!(d.pending && typeof d.pending.layer === "number");

  return {
    ledger, layers,
    banked, payoutUsd: banked * (Number(usdRate) || 0), usdRate: Number(usdRate) || 0,
    columnTotal, unknownLayers, hellLayers, hellCapped,
    extractedOwn: ledger.extractedOwn,
    captureRate: columnTotal > 0 ? ledger.extractedOwn / columnTotal : null,
    passedTotal: ledger.passedTotal, takenByRivals: ledger.takenByRivals, leftOpen: ledger.leftOpen,
    neverReachedLayers, neverReachedOil, stranded,
    salvagedIn: ledger.salvagedIn, salvageCount: ledger.rows.filter((r) => r.kind === "salvage").length,
    wildcatIn: ledger.wildcatIn, wildcatDry: ledger.wildcatDry, wildcatHell: ledger.wildcatHell,
    wildcatCount: ledger.rows.filter((r) => r.kind === "wildcat").length,
    chargesSpent: ledger.chargesSpent, chargesCap: Number(chargesCap) || 0, chargesUnspent,
    casedOff: ledger.casedOff, casedHell: ledger.casedHell, casedCount: ledger.casedCount,
    pendingUnresolved, reached, depthZ,
  };
}

// Plain-text version of the reckoning (the COPY REPORT button; also what a
// share card would print). Pure so the wording is testable.
export function reckoningText(r, { col, row } = {}) {
  const btr = (n) => Math.round(n || 0).toLocaleString();
  const usd = (n) => `$${(n || 0).toFixed(2)}`;
  const where = col != null && row != null ? ` · plot (${col + 1},${row + 1})` : "";
  const lines = [
    `HAIL MARY PROSPECTING CO. — THE RECKONING${where}`,
    `BANKED ${btr(r.banked)} BTR ≈ ${usd(r.payoutUsd)} USDC`,
    r.unknownLayers > 0
      ? `Under your column: ${btr(r.columnTotal)} BTR known · ${r.unknownLayers} layer${r.unknownLayers === 1 ? "" : "s"} still sealed`
      : `Under your column: ${btr(r.columnTotal)} BTR${r.hellLayers ? ` · ${r.hellLayers} hell pocket${r.hellLayers === 1 ? "" : "s"}` : ""}`,
    `You extracted ${btr(r.extractedOwn)}${r.captureRate != null ? ` (${Math.round(r.captureRate * 100)}%)` : ""}`,
    `You passed ${btr(r.passedTotal)} — neighbours took ${btr(r.takenByRivals)}, ${btr(r.leftOpen)} stayed in the ground`,
    `Never reached: ${r.neverReachedLayers} layer${r.neverReachedLayers === 1 ? "" : "s"}${r.neverReachedOil > 0 ? ` holding ${btr(r.neverReachedOil)}` : ""}`,
    `Salvaged next door: +${btr(r.salvagedIn)} (${r.salvageCount})`,
    `Wildcats: +${btr(r.wildcatIn)} (${r.wildcatCount}${r.wildcatDry ? `, ${r.wildcatDry} dry` : ""}${r.wildcatHell ? `, ${r.wildcatHell} hell` : ""})`,
    `Charges: ${r.chargesSpent}/${r.chargesCap} spent${r.chargesUnspent ? ` · ${r.chargesUnspent} wasted` : ""}`,
  ];
  if (r.casedCount > 0) lines.splice(5, 0, `Cased through ${r.casedCount} layer${r.casedCount === 1 ? "" : "s"}: ${r.casedHell ? `${r.casedHell} hell pocket${r.casedHell === 1 ? "" : "s"} sealed` : ""}${r.casedHell && r.casedOff > 0 ? ", " : ""}${r.casedOff > 0 ? `${btr(r.casedOff)} BTR cased off` : ""}`);
  return lines.join("\n");
}

// The reckoning in plain English — the sentence a stranger can read on the
// shared picture without knowing the game (Michelle, 2026-09-29: "just data
// with no context" is not shareable). Pure; also the first line of the post.
export function reckoningStory(r, { col, row } = {}) {
  const btr = (n) => Math.round(n || 0).toLocaleString();
  const usd = (n) => `$${(n || 0).toFixed(2)}`;
  const where = col != null && row != null ? `plot (${col + 1},${row + 1}) of` : "a plot in";
  const first = r.banked > 0
    ? `I ran a rig on ${where} the Hail Mary oil field for a season. The crew brought up ${btr(r.banked)} BTR and I was paid ${usd(r.payoutUsd)} in USDC.`
    : `I ran a rig on ${where} the Hail Mary oil field for a season and banked nothing.`;
  const rest = [];
  if (r.captureRate != null && r.extractedOwn > 0 && r.unknownLayers === 0) rest.push(`I kept ${Math.round(r.captureRate * 100)}% of what was under me`);
  if (r.takenByRivals > 0) rest.push(`neighbours took ${btr(r.takenByRivals)} BTR from layers I passed`);
  if (r.salvagedIn > 0) rest.push(`I took ${btr(r.salvagedIn)} BTR from next door`);
  if (r.wildcatIn > 0) rest.push(`my wildcats found ${btr(r.wildcatIn)} BTR`);
  if (r.casedHell > 0) rest.push(`I cased through ${r.casedHell === 1 ? "a hell pocket" : `${r.casedHell} hell pockets`}`);
  if (r.casedOff > 0) rest.push(`I cased off ${btr(r.casedOff)} BTR I never saw`);
  if (r.unknownLayers === 0 && r.stranded > 0) rest.push(`${btr(r.stranded)} BTR is still down there`);
  if (r.unknownLayers > 0) rest.push(`${r.unknownLayers} layer${r.unknownLayers === 1 ? " is" : "s are"} still sealed until the map is published`);
  if (rest.length === 0) return first;
  const tail = rest.length === 1 ? rest[0] : `${rest.slice(0, -1).join(", ")}, and ${rest[rest.length - 1]}`;
  return `${first} ${tail.charAt(0).toUpperCase()}${tail.slice(1)}.`;
}

// One-line share text for the reckoning card (the post that rides the PNG).
// Pure so the wording is testable. The link carries the player's referral
// code — the season-end result is the game's best acquisition creative.
export function reckoningShareText(r, { refCode = null, url = "rl80.com/hailmary", col, row } = {}) {
  return `${reckoningStory(r, { col, row })} ⛏ Hail Mary Prospecting Co.\n\nNext season: ${url}${refCode ? `?ref=${refCode}` : ""}`;
}

// Per-layer state for the reckoning's column strip (top → bottom), from the
// reckoning's layers + ledger rows. States: extracted · taken (a neighbour
// took your pass) · open (passed, still in the ground) · dry (passed, 0) ·
// hell · missed (never reached, oil known) · sealed (never reached, unknown).
export function reckoningStrip(r) {
  const byLayer = new Map();
  for (const row of (r.ledger && r.ledger.rows) || []) {
    if (row.kind === "cased") byLayer.set(row.layer, "cased");
    if (row.kind === "extract") byLayer.set(row.layer, "extracted");
    else if (row.kind === "pass") byLayer.set(row.layer, row.takenBy ? "taken" : (row.oil > 0 ? "open" : "dry"));
  }
  return (r.layers || []).map((l) => {
    const s = byLayer.get(l.layer);
    if (s === "cased") return { layer: l.layer, state: "cased", oil: l.oil || 0 };
    if (l.hell) return { layer: l.layer, state: "hell", oil: 0 };
    if (s) return { layer: l.layer, state: s, oil: l.oil || 0 };
    if (!l.reached) return { layer: l.layer, state: l.oil == null ? "sealed" : (l.oil > 0 ? "missed" : "dry"), oil: l.oil || 0 };
    return { layer: l.layer, state: l.oil > 0 ? "open" : "dry", oil: l.oil || 0 };
  });
}

// ── Standing orders (decided 2026-09-28, option B) ───────────────────────────
// Orders are per RIG, not per neighbour: SALVAGE = "when any orthogonal
// neighbour passes a layer at or above my line, take it with a charge";
// AUTOPILOT = the existing opt-in extract-all rule. The server sweeps open
// pockets on its tick; when several neighbours hold a SALVAGE order for the
// same pocket, the order that has WAITED LONGEST wins and then goes to the
// back (the server re-stamps it on the take) — a queue, not a season-long
// ranking. The crew never gambles: inclusion-only pockets are left alone.
export function pickSalvageOrder(pocket, candidates = []) {
  const oil = Number(pocket && pocket.oil) || 0;
  if (oil <= 0) return null;
  const eligible = candidates.filter((c) => c && c.salvage === true
    && (Number(c.chargesRemaining) || 0) > 0
    && oil >= (Number(c.threshold) || 0));
  if (eligible.length === 0) return null;
  const setAt = (c) => (Number.isFinite(Number(c.setAt)) ? Number(c.setAt) : Number.POSITIVE_INFINITY);
  eligible.sort((a, b) => (setAt(a) - setAt(b)) || String(a.userId).localeCompare(String(b.userId)));
  return eligible[0];
}
