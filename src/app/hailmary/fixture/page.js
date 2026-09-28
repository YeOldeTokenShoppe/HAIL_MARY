"use client";

// ── /hailmary/fixture — every v2 player surface, every state, static data ────
// (docs/oil-v2-player-ui-brief.md §9 — the first ticket of the design pass.)
// Mounts the Core Sample card, the Reckoning and the away recap in each state
// of the brief's §3 sheet, in any of the six console themes, at phone or
// desktop width — no season, no Firestore, no seed. The cards are fed by the
// SAME pure builders the live page uses (lib/oilLoopV2, lib/oilStrikeClock),
// so what renders here is what a real rig doc + plot doc would render.
//
// The PLAYABLE card at the top is a tiny local sim: EXTRACT / PASS / TAKE /
// WILDCAT mutate mock docs exactly the way the server routes would, NEXT
// STRIKE resolves the pending layer by the standing order and reveals the
// next one, END SEASON hands the same world to the Reckoning. Static
// scenarios below it are frozen states (their buttons resolve but change
// nothing). Design here; regressions show here first.

import { useMemo, useState, useCallback } from "react";
import { THEMES } from "@/lib/hailmaryThemes";
import { PanelSection, PanelTitle } from "@/components/HailMaryPanel";
import OilCoreSampleV2 from "@/components/OilCoreSampleV2";
import OilReckoning from "@/components/OilReckoning";
import OilAwayRecap from "@/components/OilAwayRecap";
import {
  chargesCapFor, resolvePendingDecision, buildColumnRack, buildLedger, buildReckoning,
} from "@/lib/oilLoopV2";
import { seasonClock, revealWindow } from "@/lib/oilStrikeClock";

const DEPTH_Z = 20;
const ME = "me";
const RIVAL = "rival";
const USD_RATE = 500 / 500000; // $500 pot ÷ field units
const PASSIVE = 8;
const H = 3600000;
const D = 86400000;
const dayStr = (msAgo) => new Date(Date.now() - msAgo).toISOString().slice(0, 10);

// The playable world's sealed column (what the seed would say) — mixed so the
// decision binds: some layers above an 800 line, some below, one hell pocket.
const COLUMN = [0, 400, 0, 900, 0, 1200, 300, 0, 650, 0, 0, 1800, 200, 0, 0, 2400, 0, 500, 0, 3100];
const COLUMN_HELL = new Set([9]);
const INCLUSION_LAYERS = new Set([6, 12]);
const frontierOil = (c, r, z) => ((c * 7 + r * 13 + z * 31) % 5 === 0 ? 0 : 150 + ((c * 97 + r * 41 + z * 17) % 9) * 110);

// ── mock docs ────────────────────────────────────────────────────────────────
function mkWorld(o = {}) {
  const col = o.col ?? 2, row = o.row ?? 2;
  const drillDay = o.drillDay ?? 0;
  const revealed = {};
  for (let z = 0; z < drillDay; z++) revealed[z] = COLUMN_HELL.has(z) ? 0 : COLUMN[z];
  const plot = {
    col, row, currentOwnerId: ME, drillDay,
    revealed, extracted: { ...(o.extracted || {}) }, passed: { ...(o.passed || {}) },
    lateralTaken: { ...(o.lateralTaken || {}) }, hellLayers: {}, hellCapped: {},
    inclusionFlags: {}, passedInclusions: { ...(o.passedInclusions || {}) },
  };
  for (const z of COLUMN_HELL) if (z < drillDay) plot.hellLayers[z] = true;
  for (const z of INCLUSION_LAYERS) if (z < drillDay) plot.inclusionFlags[z] = true;
  const drill = {
    col, row, bonusDrills: o.bonusDrills ?? 0, chargesSpent: o.chargesSpent ?? 0,
    threshold: o.threshold ?? 800, totalCollected: o.totalCollected ?? 0,
    layersExtracted: { ...(o.extracted || {}) }, layersPassed: { ...(o.layersPassed || o.passed || {}) },
    pending: o.pending ?? null, autopilot: false, lastStrikeAt: o.lastStrikeAt === undefined ? Date.now() - 2 * H : o.lastStrikeAt,
    supplies: { tonic: o.tonic ?? 0 },
  };
  const allPlots = { [`${col}_${row}`]: plot };
  for (const n of (o.neighbours || [])) allPlots[`${n.col}_${n.row}`] = n;
  return {
    plot, drill, allPlots,
    settings: { gameStartDate: o.gameStartDate === undefined ? dayStr(2 * D) : o.gameStartDate, seasonLengthDays: 8, passiveCharges: PASSIVE, gridSize: 6 },
    ended: !!o.ended,
    column: o.column === undefined ? { oil: COLUMN, hell: [...COLUMN_HELL] } : o.column,
  };
}
const claimedNeighbour = (col, row, passed, extra = {}) => ({ col, row, currentOwnerId: RIVAL, drillDay: 10, revealed: {}, passed, lateralTaken: {}, ...extra });

// Same derivations as hailmary/page.js (salvagePockets / frontierTargets).
function deriveBoards(w) {
  const { plot, drill, allPlots, settings } = w;
  const salvage = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const p = allPlots[`${plot.col + dc}_${plot.row + dr}`];
    if (!p?.passed) continue;
    for (const [ls, oil] of Object.entries(p.passed)) {
      const layer = Number(ls);
      const hasInclusion = !!p.passedInclusions?.[layer];
      if (p.lateralTaken?.[layer] !== undefined) continue;
      if ((oil || 0) <= 0 && !hasInclusion) continue;
      salvage.push({ col: plot.col + dc, row: plot.row + dr, layer, oil: oil || 0, hasInclusion });
    }
  }
  salvage.sort((a, b) => b.oil - a.oil);
  const frontier = [];
  const ownDepth = plot.drillDay || 0;
  if (ownDepth > 0) {
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const c = plot.col + dc, r = plot.row + dr;
      if (c < 0 || c >= settings.gridSize || r < 0 || r >= settings.gridSize) continue;
      const p = allPlots[`${c}_${r}`];
      if (p?.currentOwnerId != null) continue;
      let layer = -1;
      for (let z = ownDepth - 1; z >= 0; z--) if (p?.revealed?.[z] === undefined && p?.wildcatTaken?.[z] === undefined) { layer = z; break; }
      if (layer >= 0) frontier.push({ col: c, row: r, layer });
    }
  }
  const cap = chargesCapFor(drill, { passiveCharges: settings.passiveCharges }, DEPTH_Z);
  const season = seasonClock(settings);
  const cadence = season ? revealWindow(season, drill.lastStrikeAt, plot.drillDay || 0, DEPTH_Z) : null;
  return {
    salvage, frontier, cap, chargesRemaining: Math.max(0, cap - (drill.chargesSpent || 0)), cadence,
    rack: buildColumnRack({ plot, drill, depthZ: DEPTH_Z }),
    ledger: buildLedger({ plot, drill, allPlots, userId: ME }),
  };
}

// ── the playable sim (mirrors the server routes' writes) ─────────────────────
function simDecide(w, action) {
  const n = structuredClone(w); const d = n.drill, p = n.plot, pend = d.pending;
  if (!pend) return n;
  if (action === "extract") {
    d.layersExtracted[pend.layer] = pend.oil || 0; p.extracted[pend.layer] = pend.oil || 0;
    d.chargesSpent += 1; d.totalCollected += pend.oil || 0;
  } else {
    d.layersPassed[pend.layer] = pend.oil || 0;
    if ((pend.oil || 0) > 0) p.passed[pend.layer] = pend.oil;
    if (pend.hasInclusion) p.passedInclusions[pend.layer] = true;
  }
  d.pending = null; return n;
}
function simStrike(w) {
  let n = w;
  if (n.drill.pending) {
    const b = deriveBoards(n);
    n = simDecide(n, resolvePendingDecision({ pending: n.drill.pending, threshold: n.drill.threshold, chargesRemaining: b.chargesRemaining, depthZ: DEPTH_Z }));
  }
  n = structuredClone(n); const d = n.drill, p = n.plot;
  const z = p.drillDay || 0;
  if (z >= DEPTH_Z) return n;
  p.drillDay = z + 1; d.lastStrikeAt = Date.now();
  if (COLUMN_HELL.has(z)) {
    p.hellLayers[z] = true; p.revealed[z] = 0;
    if ((d.supplies.tonic || 0) > 0) { p.hellCapped[z] = true; d.supplies.tonic -= 1; }
    d.pending = null;
  } else {
    p.revealed[z] = COLUMN[z];
    if (INCLUSION_LAYERS.has(z)) p.inclusionFlags[z] = true;
    d.pending = { layer: z, oil: COLUMN[z], hasInclusion: INCLUSION_LAYERS.has(z), revealedAt: Date.now() };
  }
  return n;
}
function simLateral(w, { col, row, layer }) {
  const n = structuredClone(w); const t = n.allPlots[`${col}_${row}`]; if (!t) return n;
  const oil = t.passed?.[layer] || 0;
  t.lateralTaken = { ...(t.lateralTaken || {}), [layer]: ME };
  n.drill.chargesSpent += 1; n.drill.totalCollected += oil;
  return n;
}
function simWildcat(w, { col, row, layer }) {
  const n = structuredClone(w); const key = `${col}_${row}`;
  const t = n.allPlots[key] || (n.allPlots[key] = { col, row, currentOwnerId: null, revealed: {}, wildcatTaken: {}, hellLayers: {} });
  const oil = frontierOil(col, row, layer);
  t.revealed = { ...(t.revealed || {}), [layer]: oil }; t.wildcatTaken = { ...(t.wildcatTaken || {}), [layer]: ME };
  n.drill.chargesSpent += 1; if (oil > 0) n.drill.totalCollected += oil;
  return n;
}

// ── scenarios (the brief's §3 sheet) ─────────────────────────────────────────
const NEIGHBOURS_FULL = [
  claimedNeighbour(3, 2, { 5: 600, 9: 700 }, { passedInclusions: { 9: true } }),
  claimedNeighbour(2, 3, { 4: 350 }, { lateralTaken: { 4: "someone" } }),
];
const PLAYABLE_START = () => mkWorld({
  drillDay: 7, extracted: { 1: 400, 3: 900 }, passed: { 5: 1200 }, layersPassed: { 0: 0, 2: 0, 4: 0, 5: 1200 },
  lateralTaken: { 5: RIVAL }, chargesSpent: 2, totalCollected: 1300, threshold: 800, tonic: 1,
  pending: { layer: 6, oil: 300, hasInclusion: true, revealedAt: Date.now() - 25 * 60000 },
  neighbours: NEIGHBOURS_FULL,
});
const CARD_SCENARIOS = [
  { key: "empty", name: "Nothing on the table", trigger: "no pending, season live, fresh rig", world: () => mkWorld({ drillDay: 0, lastStrikeAt: null }) },
  { key: "above", name: "Pending · wet · above the line", trigger: "1,400 BTR vs standing order 800", world: () => mkWorld({ drillDay: 4, extracted: { 1: 400 }, layersPassed: { 0: 0, 2: 0 }, chargesSpent: 1, totalCollected: 400, pending: { layer: 3, oil: 1400, hasInclusion: false, revealedAt: Date.now() - 5 * 60000 } }) },
  { key: "below", name: "Pending · wet · below the line", trigger: "300 BTR vs 800 — the decision moment", world: () => mkWorld({ drillDay: 7, extracted: { 1: 400, 3: 900 }, layersPassed: { 0: 0, 2: 0, 4: 0, 5: 1200 }, passed: { 5: 1200 }, chargesSpent: 2, totalCollected: 1300, pending: { layer: 6, oil: 300, hasInclusion: false, revealedAt: Date.now() - 40 * 60000 }, neighbours: NEIGHBOURS_FULL }) },
  { key: "dry", name: "Pending · dry", trigger: "oil 0 — passing is free", world: () => mkWorld({ drillDay: 3, extracted: { 1: 400 }, layersPassed: { 0: 0 }, chargesSpent: 1, totalCollected: 400, pending: { layer: 2, oil: 0, hasInclusion: false, revealedAt: Date.now() - 60000 } }) },
  { key: "incl", name: "Pending · inclusion flagged", trigger: "below the line, anomalous inclusion", world: () => mkWorld({ drillDay: 7, extracted: { 1: 400, 3: 900 }, layersPassed: { 0: 0, 2: 0, 4: 0, 5: 1200 }, passed: { 5: 1200 }, chargesSpent: 2, totalCollected: 1300, pending: { layer: 6, oil: 300, hasInclusion: true, revealedAt: Date.now() - 25 * 60000 } }) },
  { key: "nocharges", name: "No charges left", trigger: "8/8 spent, wet layer pending", world: () => mkWorld({ drillDay: 12, extracted: { 1: 400, 3: 900, 5: 1200, 6: 300, 8: 650 }, layersPassed: { 0: 0, 2: 0, 4: 0, 7: 0, 10: 0 }, chargesSpent: 8, totalCollected: 3450, pending: { layer: 11, oil: 1800, hasInclusion: false, revealedAt: Date.now() - 10 * 60000 }, neighbours: NEIGHBOURS_FULL }) },
  { key: "done", name: "Column fully revealed", trigger: "20 layers up, season still live", world: () => mkWorld({ drillDay: 20, extracted: { 1: 400, 3: 900, 5: 1200, 11: 1800, 15: 2400, 19: 3100 }, layersPassed: { 0: 0, 2: 0, 4: 0, 6: 300, 7: 0, 8: 650, 10: 0, 12: 200, 13: 0, 14: 0, 16: 0, 17: 500, 18: 0 }, passed: { 6: 300, 8: 650, 12: 200, 17: 500 }, chargesSpent: 6, totalCollected: 9800, neighbours: NEIGHBOURS_FULL }) },
  { key: "over", name: "Season over", trigger: "past the buzzer (hand-off to the Reckoning)", world: () => mkWorld({ drillDay: 20, gameStartDate: dayStr(30 * D), extracted: { 1: 400 }, chargesSpent: 1, totalCollected: 400, pending: { layer: 19, oil: 3100, hasInclusion: false, revealedAt: Date.now() - 3 * D } }) },
  { key: "noclock", name: "No season clock", trigger: "legacy settings — no cadence line at all", world: () => mkWorld({ drillDay: 4, gameStartDate: null, extracted: { 1: 400 }, layersPassed: { 0: 0, 2: 0 }, chargesSpent: 1, totalCollected: 400, pending: { layer: 3, oil: 900, hasInclusion: false, revealedAt: Date.now() - 5 * 60000 } }) },
];
const RECKONING_SCENARIOS = [
  { key: "known", name: "Seed published", trigger: "full column total, never-reached oil, capture %", world: () => mkWorld({ ended: true, drillDay: 16, extracted: { 1: 400, 3: 900, 11: 1800 }, layersPassed: { 0: 0, 2: 0, 4: 0, 5: 1200, 6: 300, 7: 0, 8: 650, 10: 0, 12: 200, 13: 0, 14: 0 }, passed: { 5: 1200, 6: 300, 8: 650, 12: 200 }, lateralTaken: { 5: RIVAL, 8: RIVAL }, chargesSpent: 5, totalCollected: 3700, neighbours: [claimedNeighbour(3, 2, { 5: 600 }, { lateralTaken: { 5: ME } }), { col: 1, row: 1, currentOwnerId: null, revealed: { 3: 0, 8: 450 }, wildcatTaken: { 3: ME, 8: ME } }] }) },
  { key: "sealed", name: "Seed not yet published", trigger: "ended, reveal pending — sealed layers, never a guessed total", world: () => mkWorld({ ended: true, column: null, drillDay: 16, extracted: { 1: 400, 3: 900, 11: 1800 }, layersPassed: { 0: 0, 2: 0, 4: 0, 5: 1200, 6: 300, 7: 0, 8: 650, 10: 0, 12: 200, 13: 0, 14: 0 }, passed: { 5: 1200, 6: 300, 8: 650, 12: 200 }, lateralTaken: { 5: RIVAL }, chargesSpent: 3, totalCollected: 3100 }) },
  { key: "dryrig", name: "Dry rig", trigger: "banked 0 — the honest 'here is what was under you'", world: () => mkWorld({ ended: true, drillDay: 20, layersPassed: Object.fromEntries(Array.from({ length: 20 }, (_, z) => [z, 0])), chargesSpent: 0, totalCollected: 0, column: { oil: COLUMN.map((v, z) => (z === 15 ? 2400 : 0)), hell: [9] } }) },
  { key: "leftover", name: "Core left on the table", trigger: "a pending layer at the buzzer", world: () => mkWorld({ ended: true, drillDay: 20, extracted: { 1: 400, 3: 900 }, chargesSpent: 2, totalCollected: 1300, pending: { layer: 19, oil: 3100, hasInclusion: false, revealedAt: Date.now() - 2 * H } }) },
];

// ── page ─────────────────────────────────────────────────────────────────────
const mono = "'Share Tech Mono', monospace";

export default function HailMaryV2FixturePage() {
  const [themeKey, setThemeKey] = useState("dark");
  const [width, setWidth] = useState(360);
  const [world, setWorld] = useState(PLAYABLE_START);
  const [recap, setRecap] = useState(null); // null | "v2" | "v1"
  const [log, setLog] = useState([]);
  const theme = THEMES[themeKey] || THEMES.dark;
  const note = (s) => setLog((l) => [`${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} ${s}`, ...l].slice(0, 12));

  const boards = useMemo(() => deriveBoards(world), [world]);
  const handlers = useMemo(() => ({
    onDecide: async (action) => { setWorld((w) => simDecide(w, action)); note(`${action.toUpperCase()} L${(world.drill.pending?.layer ?? 0) + 1}`); return { inclusion: action === "extract" && world.drill.pending?.hasInclusion ? "relic" : null }; },
    onSetThreshold: async (btr) => { setWorld((w) => ({ ...structuredClone(w), drill: { ...structuredClone(w.drill), threshold: btr } })); note(`standing order → ${btr}`); },
    onLateral: async (t) => { setWorld((w) => simLateral(w, t)); note(`SALVAGE (${t.col + 1},${t.row + 1}) L${t.layer + 1}`); return { oil: world.allPlots[`${t.col}_${t.row}`]?.passed?.[t.layer] || 0 }; },
    onWildcat: async (t) => { const oil = frontierOil(t.col, t.row, t.layer); setWorld((w) => simWildcat(w, t)); note(`WILDCAT (${t.col + 1},${t.row + 1}) L${t.layer + 1} → ${oil || "dry"}`); return { oil, hell: false, inclusion: null }; },
  }), [world]); // eslint-disable-line react-hooks/exhaustive-deps

  const reckoningFor = useCallback((w) => buildReckoning({
    plot: w.plot, drill: w.drill, allPlots: w.allPlots, userId: ME, column: w.column, depthZ: DEPTH_Z, usdRate: USD_RATE,
    chargesCap: chargesCapFor(w.drill, { passiveCharges: w.settings.passiveCharges }, DEPTH_Z),
  }), []);

  const noop = { onDecide: async () => ({}), onSetThreshold: async () => ({}), onLateral: async () => ({}), onWildcat: async () => ({}) };
  const cardFor = (w, h = noop, key) => {
    const b = deriveBoards(w);
    return (
      <OilCoreSampleV2 key={key} theme={theme} pending={w.drill.pending} chargesRemaining={b.chargesRemaining} chargesCap={b.cap}
        threshold={w.drill.threshold} salvage={b.salvage} frontier={b.frontier} cadence={b.cadence} rack={b.rack} ledger={b.ledger} {...h} />
    );
  };
  const recapObj = {
    awayMs: 5 * H, fromDepth: 4, toDepth: 7, strikes: [{ layer: 5, oil: 1200 }, { layer: 6, oil: 300 }], oilGained: 1500, hellHit: false,
    artifactsFound: [], tank: 300, tankDelta: 300, bankedDelta: 900, fieldEvents: [{ type: "gusher", username: "DustyDan", detail: "" }], fieldEventCount: 1, unreadCount: 0,
  };
  const recapV2 = {
    pending: world.drill.pending, latestMs: boards.cadence?.latestMs ?? null, threshold: world.drill.threshold, chargesRemaining: boards.chargesRemaining,
    crewWould: world.drill.pending ? (resolvePendingDecision({ pending: world.drill.pending, threshold: world.drill.threshold, chargesRemaining: boards.chargesRemaining, depthZ: DEPTH_Z }) === "extract" ? "EXTRACT" : "PASS") : null,
  };

  const btn = { fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", padding: "5px 9px", borderRadius: 2, cursor: "pointer", background: theme.btnBg, color: theme.btnText, border: `1px solid ${theme.border}` };
  const label = { fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", color: theme.muted, lineHeight: 1.6 };
  const frame = (title, trigger, children, k) => (
    <div key={k} style={{ width, maxWidth: "100%", flex: "0 0 auto" }}>
      <div style={{ ...label, color: theme.textStrong, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>{title}</div>
      <div style={{ ...label, marginBottom: 6 }}>{trigger}</div>
      <div style={{ background: theme.panelBg, border: `1px solid ${theme.border}`, borderRadius: 4, overflow: "hidden" }}>{children}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, padding: "16px 16px 80px", fontFamily: mono }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <span style={{ ...label, color: theme.accent, letterSpacing: "0.2em" }}>HMPC · V2 FIXTURE</span>
        <select value={themeKey} onChange={(e) => setThemeKey(e.target.value)} style={{ ...btn }}>
          {Object.keys(THEMES).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        {[360, 420, 560].map((w) => <button key={w} style={{ ...btn, ...(width === w ? { borderColor: theme.gold, color: theme.gold } : {}) }} onClick={() => setWidth(w)}>{w}px</button>)}
        <span style={label}>static data · same builders as the live page · nothing here touches the game</span>
      </div>

      {/* PLAYABLE */}
      <PanelSection theme={theme} tint style={{ marginBottom: 18, borderRadius: 4, border: `1px solid ${theme.border}` }}>
        <PanelTitle theme={theme} right={<span style={label}>a local sim — mutates mock docs the way the routes do</span>}>PLAYABLE · YOUR RIG</PanelTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <button style={btn} onClick={() => { setWorld((w) => simStrike(w)); note("NEXT STRIKE"); }}>⛏ NEXT STRIKE</button>
          <button style={btn} onClick={() => { setWorld((w) => ({ ...structuredClone(w), ended: true, settings: { ...w.settings, gameStartDate: dayStr(30 * D) } })); note("END SEASON"); }}>🏁 END SEASON</button>
          <button style={btn} onClick={() => { setWorld(PLAYABLE_START()); setLog([]); }}>↺ RESET</button>
          <button style={btn} onClick={() => setRecap("v2")}>WHILE YOU WERE AWAY (v2)</button>
          <button style={btn} onClick={() => setRecap("v1")}>… (v1, for contrast)</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width, maxWidth: "100%" }}>{cardFor(world, handlers, "playable")}</div>
          {world.ended && <div style={{ width, maxWidth: "100%" }}><OilReckoning theme={theme} reckoning={reckoningFor(world)} col={world.plot.col} row={world.plot.row} /></div>}
          <div style={{ ...label, minWidth: 200, flex: 1 }}>
            <div style={{ color: theme.textStrong, letterSpacing: "0.14em" }}>LOG</div>
            {log.length === 0 ? <div>— press a button —</div> : log.map((l, i) => <div key={i}>{l}</div>)}
            <div style={{ marginTop: 8 }}>column (sealed): {COLUMN.map((v, z) => (COLUMN_HELL.has(z) ? "☠" : v || "·")).join(" ")}</div>
          </div>
        </div>
      </PanelSection>

      {/* CARD STATES */}
      <PanelSection theme={theme} style={{ marginBottom: 18, borderRadius: 4, border: `1px solid ${theme.border}` }}>
        <PanelTitle theme={theme}>CORE SAMPLE · STATES</PanelTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          {CARD_SCENARIOS.map((s) => frame(s.name, s.trigger, cardFor(s.world(), noop, s.key), s.key))}
        </div>
      </PanelSection>

      {/* RECKONING STATES */}
      <PanelSection theme={theme} style={{ marginBottom: 18, borderRadius: 4, border: `1px solid ${theme.border}` }}>
        <PanelTitle theme={theme}>THE RECKONING · STATES</PanelTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          {RECKONING_SCENARIOS.map((s) => { const w = s.world(); return frame(s.name, s.trigger, <OilReckoning theme={theme} reckoning={reckoningFor(w)} col={w.plot.col} row={w.plot.row} />, s.key); })}
        </div>
      </PanelSection>

      {recap && (
        <OilAwayRecap
          recap={recapObj} theme={theme} isMobile={width <= 420} usdRate={USD_RATE}
          tankHeavy={recap === "v1"} onBank={recap === "v1" ? () => note("BANK (v1)") : undefined}
          v2={recap === "v2" ? recapV2 : null} onClose={() => setRecap(null)}
        />
      )}
    </div>
  );
}
