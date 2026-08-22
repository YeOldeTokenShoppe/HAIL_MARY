"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelSection, PanelTitle, PANEL_ICONS } from "./HailMaryPanel";

// DAILY CALL — prototype of the Betroleum "directional call" loop, rendered in
// test mode only. One call per tick; the player picks a side, the call locks,
// the tick resolves it. Three calls rotate:
//   PRICE CALL  — RL80 higher or lower at tomorrow's snapshot (external event)
//   WET OR DRY  — is YOUR next layer wet (GLIMMER+)? The area-scan dial is the
//                 real, partial signal, so this is a skill call.
//   HOT ROW     — which row of the field produces the most Betroleum today?
// Stakes are a free daily grubstake chip; wins pay in-game (a bonus drill), a
// wrong call owes a sidequest. Nothing here talks to the server: WET OR DRY
// and HOT ROW resolve against the grid the page already holds, PRICE CALL
// resolves with a labelled coin flip because the prototype has no price feed.

const MONO = "'Share Tech Mono', monospace";
const DEPTH_Z = 20;
const CALLS = ["price", "wet", "row"];

// Same thresholds as the gauge cluster (DrillGeode).
const classifyTier = (v, maxOil) => (v === 0 ? 0 : (v / (maxOil || 1)) < 0.08 ? 1 : (v / (maxOil || 1)) < 0.25 ? 2 : (v / (maxOil || 1)) < 0.5 ? 3 : 4);
const TIER = ["SHALE", "SANDSTONE", "GLIMMER", "LUMEN", "RADIANCE"];
const scanLevel = (prox, maxOil) => { const t = maxOil > 0 ? prox / maxOil : 0; return t >= 0.35 ? 3 : t >= 0.15 ? 2 : t >= 0.05 ? 1 : 0; };
const SCAN = ["NOMINAL", "TRACE", "ELEVATED", "ANOMALOUS"];
const fmt = (n) => (n || 0).toLocaleString();

export default function DailyCallPanel({
  theme, isMobile = false, darkMode = true,
  grid3D, gridX = 10, gridY = 10, maxOil = 1,
  selectedX = null, selectedY = null, drillDepth = 0, drillProximity = 0,
  devControls = false,
}) {
  const t = theme;
  const hasPlot = selectedX !== null && selectedY !== null && !!grid3D;
  const nextLayer = Math.min(Math.max(drillDepth, 0), DEPTH_Z - 1);

  const [callIdx, setCallIdx] = useState(hasPlot ? 1 : 0);
  const [pick, setPick] = useState(null);          // "up" | "down" | "wet" | "dry" | row index
  const [result, setResult] = useState(null);      // { won, detail }
  const [streak, setStreak] = useState(0);
  const call = CALLS[callIdx % CALLS.length];

  // Real readings for the form guide.
  const lastTier = hasPlot && drillDepth > 0 ? classifyTier(grid3D[selectedX]?.[selectedY]?.[drillDepth - 1] ?? 0, maxOil) : null;
  const scan = scanLevel(drillProximity, maxOil);
  const rows = useMemo(() => {
    if (!grid3D) return [];
    return Array.from({ length: gridY }, (_, r) => {
      let sofar = 0, today = 0;
      for (let x = 0; x < gridX; x++) {
        const col = grid3D[x]?.[r] || [];
        for (let z = 0; z < Math.min(drillDepth, DEPTH_Z); z++) sofar += col[z] || 0;
        today += col[nextLayer] || 0;
      }
      return { r, sofar, today };
    });
  }, [grid3D, gridX, gridY, drillDepth, nextLayer]);

  // A new call or a new plot starts the ritual over.
  useEffect(() => { setPick(null); setResult(null); }, [callIdx, selectedX, selectedY]);
  // First plot selection lands on WET OR DRY (the call that uses the dials) —
  // unless the player has already rotated by hand.
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (hasPlot && !touched) setCallIdx(1); }, [hasPlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = () => {
    let won = false, detail = "";
    if (call === "wet") {
      const v = grid3D[selectedX]?.[selectedY]?.[nextLayer] ?? 0;
      const tier = classifyTier(v, maxOil);
      const wet = tier >= 2;
      won = (pick === "wet") === wet;
      detail = `Layer ${nextLayer + 1} came up ${TIER[tier]}${v > 0 ? ` — ${fmt(v)} BTR` : ""}.`;
    } else if (call === "row") {
      const best = rows.reduce((a, b) => (b.today > a.today ? b : a), rows[0]);
      won = pick === best.r;
      detail = `Row ${best.r + 1} produced the most — ${fmt(best.today)} BTR on layer ${nextLayer + 1}.`;
    } else {
      const up = Math.random() < 0.5; // no price feed in the prototype
      won = (pick === "up") === up;
      detail = `Snapshot came in ${up ? "higher" : "lower"} (test coin flip — no price feed wired yet).`;
    }
    setResult({ won, detail });
    setStreak((s) => (won ? s + 1 : 0));
  };

  // ── styles ──
  const muted = t.muted, ink = t.textStrong, gold = t.gold, green = t.green, red = t.red;
  const eyebrow = { fontSize: 9, letterSpacing: "0.18em", color: muted, fontFamily: MONO, textTransform: "uppercase" };
  const question = { fontSize: 12, color: ink, fontFamily: MONO, letterSpacing: "0.04em", lineHeight: 1.45, margin: "4px 0 6px" };
  const guide = { fontSize: 10, color: muted, fontFamily: MONO, letterSpacing: "0.04em", lineHeight: 1.5, marginBottom: 10 };
  const optBtn = (active, disabled) => ({
    flex: 1, minHeight: 44, padding: "8px 10px", borderRadius: 3, cursor: disabled ? "default" : "pointer",
    border: `1px solid ${active ? gold : t.border}`,
    background: active ? `linear-gradient(180deg, ${gold}, ${t.goldBorder})` : t.btnBg,
    color: active ? "#fff" : t.btnText, fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: "0.16em",
    opacity: disabled && !active ? 0.45 : 1, transition: "all 0.15s",
  });
  const rowBtn = (active, disabled) => ({
    padding: "6px 2px 4px", borderRadius: 3, cursor: disabled ? "default" : "pointer",
    border: `1px solid ${active ? gold : t.border}`, background: active ? `${gold}33` : t.btnBg,
    color: active ? gold : t.btnText, fontFamily: MONO, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    opacity: disabled && !active ? 0.45 : 1,
  });
  const link = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: muted, textDecoration: "underline" };

  const locked = pick !== null && !result;
  const chip = (
    <span style={{ fontSize: 9, letterSpacing: "0.14em", padding: "2px 7px", borderRadius: 2, border: `1px solid ${streak > 0 ? gold : t.border}`, color: streak > 0 ? gold : muted, fontFamily: MONO, textTransform: "uppercase" }}>
      STREAK {streak}
    </span>
  );

  return (
    <PanelSection theme={t} isMobile={isMobile}>
      <PanelTitle theme={t} isMobile={isMobile} icon={PANEL_ICONS.call} right={chip}>DAILY CALL</PanelTitle>

      {/* ── the call ── */}
      {call === "price" && (
        <>
          <div style={eyebrow}>RL80 · tomorrow's snapshot</div>
          <div style={question}>Does RL80 close <b style={{ color: "inherit" }}>higher</b> or <b style={{ color: "inherit" }}>lower</b> than today's snapshot?</div>
          <div style={guide}>Today's snapshot price: — (no price feed in the prototype; the lobby's RL80 price + the daily qualification snapshot would drive this).</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={optBtn(pick === "up", pick !== null)} disabled={pick !== null} onClick={() => setPick("up")}>▲ HIGHER</button>
            <button style={optBtn(pick === "down", pick !== null)} disabled={pick !== null} onClick={() => setPick("down")}>▼ LOWER</button>
          </div>
        </>
      )}
      {call === "wet" && (
        <>
          <div style={eyebrow}>Your rig · plot {hasPlot ? `(${selectedX + 1}, ${selectedY + 1})` : "—"} · layer {nextLayer + 1}</div>
          <div style={question}>Is your next layer <b style={{ color: "inherit" }}>wet</b> (GLIMMER or better) or <b style={{ color: "inherit" }}>dry</b>?</div>
          <div style={guide}>
            {hasPlot
              ? <>Area scan: <span style={{ color: t.accent }}>{SCAN[scan]}</span>{lastTier !== null ? <> · last layer: <span style={{ color: t.accent }}>{TIER[lastTier]}</span></> : " · nothing cored yet"}. The scan reads one cell around the bit — it's a hint, not a map.</>
              : "Select your claim to call your next layer."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={optBtn(pick === "wet", pick !== null || !hasPlot)} disabled={pick !== null || !hasPlot} onClick={() => setPick("wet")}>WET</button>
            <button style={optBtn(pick === "dry", pick !== null || !hasPlot)} disabled={pick !== null || !hasPlot} onClick={() => setPick("dry")}>DRY</button>
          </div>
        </>
      )}
      {call === "row" && (
        <>
          <div style={eyebrow}>The field · today's output by row</div>
          <div style={question}>Which <b style={{ color: "inherit" }}>row</b> of the field produces the most Betroleum today?</div>
          <div style={guide}>Form: revealed BTR so far per row. Slice a row in the cross-section to scout it.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
            {rows.map(({ r, sofar }) => (
              <button key={r} style={rowBtn(pick === r, pick !== null)} disabled={pick !== null} onClick={() => setPick(r)} title={`Row ${r + 1}`}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{r + 1}</span>
                <span style={{ fontSize: 8, color: pick === r ? gold : muted, letterSpacing: "0.04em" }}>{sofar > 0 ? (sofar >= 1000 ? `${(sofar / 1000).toFixed(1)}k` : fmt(sofar)) : "—"}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── stake + state ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 10, fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: muted, flexWrap: "wrap" }}>
        <span>STAKE · 1 GRUBSTAKE CHIP <span style={{ color: green }}>free today</span></span>
        <span>WIN · <span style={{ color: gold }}>+1 BONUS DRILL</span></span>
      </div>

      {result ? (
        <div style={{
          marginTop: 10, padding: "9px 12px", borderRadius: 3,
          border: `1px solid ${result.won ? green : red}`, background: result.won ? `${green}18` : `${red}18`,
          fontFamily: MONO, color: ink,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: result.won ? green : red }}>
            {result.won ? `RIGHT CALL — +1 BONUS DRILL · STREAK ${streak}` : "WRONG CALL — THE FORTUNE TELLER OWES YOU A SIDEQUEST"}
          </div>
          <div style={{ fontSize: 10, color: muted, marginTop: 3, lineHeight: 1.5 }}>{result.detail}</div>
          <button style={{ ...link, marginTop: 6 }} onClick={() => { setTouched(true); setCallIdx((i) => i + 1); }}>NEXT CALL ▸</button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: locked ? gold : muted }}>
          <span>{locked ? "LOCKED IN — RESOLVES AT THE NEXT TICK" : "LOCKS AT THE NEXT TICK"}</span>
          {devControls && (
            <span style={{ display: "flex", gap: 10 }}>
              {locked && <button style={{ ...link, color: gold }} onClick={resolve}>RESOLVE TICK (TEST)</button>}
              <button style={link} onClick={() => { setTouched(true); setCallIdx((i) => i + 1); }}>ROTATE ▸</button>
            </span>
          )}
        </div>
      )}
      {devControls && (
        <div style={{ marginTop: 8, fontSize: 8, letterSpacing: "0.14em", color: muted, fontFamily: MONO, textTransform: "uppercase" }}>
          Prototype · test mode only · posted by the Fortune Teller at the tick
        </div>
      )}
    </PanelSection>
  );
}
