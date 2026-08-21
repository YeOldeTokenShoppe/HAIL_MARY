"use client";

import { useState, useEffect, useRef } from "react";

const REVEAL_TIME = 10000;
const ANALYZE_AT = REVEAL_TIME * 0.6;
const PRELIM_DELAY = 2500;

// Yield tiers for a drilled layer — the same five names as the core sample's
// strata, in the substance's own teal, so the dial, the drill bar and the
// cross-section agree on what "rich" looks like. Index-aligned with classifyTier().
const TIER_LABELS = ["SHALE", "SANDSTONE", "GLIMMER", "LUMEN", "RADIANCE"];
const TIER_COLORS_DARK = ["#5a6a68", "#5f8a8c", "#2f9f9f", "#2dd6c8", "#7afff2"];
// Light-console tints run darker as they get richer (≥4.5:1 on the cream panels).
const TIER_COLORS_LIGHT = ["#5c6866", "#32706f", "#25706e", "#1b6e70", "#0e5e60"];

// Area scan — oil within one cell of the bit, as a level. `short` is what fits
// in the centre of a 76px dial; `label` is the status-line wording.
const SCAN_LEVELS = [
  { label: "NOMINAL", short: "NOMINAL", threshold: 0 },
  { label: "TRACE ACTIVITY", short: "TRACE", threshold: 0.05 },
  { label: "ELEVATED READINGS", short: "ELEVATED", threshold: 0.15 },
  { label: "ANOMALOUS SIGNAL", short: "ANOMALOUS", threshold: 0.35 },
];
const SCAN_COLORS_DARK = ["#7a8a72", "#5cae6c", "#2dd64a", "#74ff96"];
// Light-console greens sit at ≥4.5:1 on the cream panels (the dark phosphor set is ~1.2:1 there).
const SCAN_COLORS_LIGHT = ["#5a6a53", "#21743b", "#0e7a32", "#0a5e26"];

// Hell-pocket proximity — amber→orange thermal/chemical cues that warn a hell
// pocket is near WITHOUT naming the demon or its direction. Deliberately
// ambiguous (could read as a thermal vent over a rich vein) and visually
// distinct from the green scan. `lit` = how many of the four scan segments glow.
const HELL_LEVELS = [
  { label: "THERMAL FLUX", short: "THERMAL", lit: 2, color: "#d6a23c", light: "#9a6410" },
  { label: "SULFUROUS TRACE", short: "SULFUROUS", lit: 3, color: "#e8742a", light: "#b5480e" },
  { label: "EXOTHERMIC ANOMALY", short: "EXOTHERMIC", lit: 4, color: "#ff5a1e", light: "#c0330a" },
];
const HELL_COLOR = "#ff2200";
const MONO = "'Share Tech Mono', monospace";

function hellLevelIndex(intensity) {
  if (intensity >= 0.8) return 2;
  if (intensity >= 0.55) return 1;
  return 0;
}

function classifyTier(value, maxOil) {
  if (value === 0) return 0;
  const t = maxOil > 0 ? value / maxOil : 0;
  if (t < 0.08) return 1;
  if (t < 0.25) return 2;
  if (t < 0.50) return 3;
  return 4;
}

function scanLevelIndex(proximity, maxOil) {
  if (!proximity || !maxOil) return 0;
  const t = proximity / maxOil;
  for (let i = SCAN_LEVELS.length - 1; i >= 0; i--) {
    if (t >= SCAN_LEVELS[i].threshold) return i;
  }
  return 0;
}

// Dial animation — namespaced so it can't collide with the page's own keyframes.
const DIAL_CSS = `
@keyframes hmDialChase { 0%, 100% { opacity: 0.22; } 50% { opacity: 1; } }
@keyframes hmDialBreathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes hmDialProgress { from { width: 0; } to { width: 100%; } }
.hm-dial-chase { animation: hmDialChase 1.2s ease-in-out infinite; }
.hm-dial-breathe { animation: hmDialBreathe 3s ease-in-out infinite; }
.hm-dial-pulse { animation: hmDialBreathe 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .hm-dial-chase, .hm-dial-breathe, .hm-dial-pulse { animation: none !important; opacity: 1 !important; }
}
`;

// 270° sweep, open at the bottom — same geometry as the old continuous arc, so
// the cluster keeps its footprint.
const ARC_START = -225;
const ARC_END = 45;
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function arcPath(cx, cy, r, a, b) {
  const [sx, sy] = polar(cx, cy, r, a);
  const [ex, ey] = polar(cx, cy, r, b);
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

// One instrument: the sweep cut into `segments`, lit from the left.
//   mode "lit"   — the first `lit` segments on, each in colorFor(i)
//   mode "chase" — every segment cycles through its own colour (reveal running)
//   mode "hell"  — every segment in the hell red, centre word pulsing
// `value` is a number (a count, set large) or a word (a reading, set small).
function SegmentDial({ segments, lit = 0, colorFor, mode = "lit", value, sub, label, dark, breathe = false, size = 76 }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.52;
  const gap = segments > 8 ? 2.5 : 3.5;
  const span = (ARC_END - ARC_START) / segments;
  const track = dark ? "rgba(212,168,84,0.2)" : "rgba(90,64,16,0.2)";
  const muted = dark ? "#6a7888" : "#8b7d6b";
  const ink = dark ? "#d4dce4" : "#3e2e10";
  const isNumber = typeof value === "number";
  const topLit = Math.min(lit, segments) - 1;

  const paths = [];
  for (let i = 0; i < segments; i++) {
    const a = ARC_START + i * span + gap / 2;
    const b = ARC_START + (i + 1) * span - gap / 2;
    const on = mode === "chase" || mode === "hell" || i < lit;
    const color = mode === "hell" ? HELL_COLOR : on ? colorFor(i) : track;
    const className = mode === "chase" ? "hm-dial-chase"
      : breathe && mode === "lit" && i === topLit ? "hm-dial-breathe"
      : undefined;
    paths.push(
      <path
        key={i}
        className={className}
        d={arcPath(cx, cy, r, a, b)}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap={segments > 8 ? "butt" : "round"}
        style={{
          animationDelay: mode === "chase" ? `${((i * 1.2) / segments).toFixed(2)}s` : undefined,
          filter: dark && on && mode !== "chase" ? `drop-shadow(0 0 3px ${color})` : "none",
        }}
      />
    );
  }

  const valueColor = mode === "hell" ? HELL_COLOR
    : mode === "chase" ? muted
    : isNumber ? ink
    : lit > 0 ? colorFor(topLit)
    : muted;
  const word = String(value);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`} aria-label={`${label} ${word}${sub ? ` ${sub}` : ""}`}>
        {paths}
        <text
          x={cx}
          y={cy + (isNumber ? 3 : 2)}
          textAnchor="middle"
          className={mode === "hell" ? "hm-dial-pulse" : undefined}
          fontFamily={isNumber ? "'Orbitron', 'Share Tech Mono', monospace" : MONO}
          fontSize={isNumber ? 15 : word.length > 7 ? 8 : 9}
          fontWeight="700"
          letterSpacing={isNumber ? 0 : "0.08em"}
          fill={valueColor}
          style={{ filter: dark && !isNumber && mode === "lit" && lit > 0 ? `drop-shadow(0 0 2px ${valueColor})` : "none" }}
        >
          {word}
        </text>
        {sub && (
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontFamily={MONO}
            fontSize="7.5"
            letterSpacing="0.05em"
            fill={dark ? "rgba(212,168,84,0.7)" : "rgba(90,64,16,0.6)"}
          >
            {sub}
          </text>
        )}
      </svg>
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: "0.15em",
        color: dark ? "rgba(212,168,84,0.8)" : "rgba(90,64,16,0.7)",
        fontFamily: MONO,
        textAlign: "center",
      }}>
        {label}
      </div>
    </div>
  );
}

// The rig's instrument cluster: one count (DEPTH) and two readings (PRESSURE =
// the area scan, DENSITY = the last layer's yield). At rest both readings come
// straight from the live props; a strike runs the reveal, which masks them with
// a chase for ten seconds and then settles on the result and the scan.
export default function DrillHUD({
  drillEvent,
  depthLevel,
  maxDepth = 20,
  oilStrike,
  oilValue = 0,
  maxOil = 1,
  drillProximity = 0,
  hellProximity = 0,
  darkMode = true,
  parabolum = false,
  hud = false,
  hellActive = false,
  demonBlockade = null,
  drillingActive = false,
  // Rendered inside another card (YOUR RIG): drop the section padding/rule.
  embedded = false,
}) {
  const [phase, setPhase] = useState("standby"); // standby | drilling | analyzing | result | preliminary
  // Tier of the layer the running/last reveal uncovered — shown while the
  // reveal settles; afterwards the dial reads the live layer again.
  const [resultTier, setResultTier] = useState(null);
  const prevDrillEvent = useRef(0);
  const timersRef = useRef([]);

  useEffect(() => {
    if (!(drillEvent > 0 && drillEvent !== prevDrillEvent.current)) return;
    prevDrillEvent.current = drillEvent;
    const tier = classifyTier(oilValue, maxOil);
    timersRef.current.forEach(clearTimeout);
    setPhase("drilling");
    timersRef.current = [
      setTimeout(() => setPhase("analyzing"), ANALYZE_AT),
      setTimeout(() => { setResultTier(tier); setPhase("result"); }, REVEAL_TIME),
      setTimeout(() => setPhase("preliminary"), REVEAL_TIME + 300 + PRELIM_DELAY),
    ];
  }, [drillEvent, oilValue, maxOil]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const dark = darkMode;
  const isHell = hellActive || !!demonBlockade?.active;
  const busy = phase === "drilling" || phase === "analyzing";
  const scanColors = dark ? SCAN_COLORS_DARK : SCAN_COLORS_LIGHT;
  const tierColors = dark ? TIER_COLORS_DARK : TIER_COLORS_LIGHT;
  const muted = dark ? "#6a7888" : "#8b7d6b";
  const accent = dark ? "#d4a854" : "#5a4010";
  const gold = dark ? "#d4a854" : "#8b7355";

  // Area scan, live. A nearby hell pocket overrides the oil scan — it's the more
  // important (and more dangerous) thing under the bit. Nothing to scan until
  // the bit has been in the ground.
  const hellIdx = hellProximity > 0 ? hellLevelIndex(hellProximity) : -1;
  const hasScan = depthLevel > 0 || drillProximity > 0 || hellProximity > 0;
  let scan;
  if (hellIdx >= 0) {
    const h = HELL_LEVELS[hellIdx];
    const color = dark ? h.color : h.light;
    scan = { lit: h.lit, word: h.short, label: h.label, color, colorFor: () => color };
  } else if (hasScan) {
    const i = scanLevelIndex(drillProximity, maxOil);
    scan = { lit: i + 1, word: SCAN_LEVELS[i].short, label: SCAN_LEVELS[i].label, color: scanColors[i], colorFor: (k) => scanColors[k] };
  } else {
    scan = { lit: 0, word: "—", label: null, color: muted, colorFor: (k) => scanColors[k] };
  }

  // Last layer: the strike's tier while the reveal settles, else the live layer.
  const liveTier = depthLevel > 0 ? classifyTier(oilValue, maxOil) : null;
  const tier = (phase === "result" || phase === "preliminary") && resultTier !== null ? resultTier : liveTier;

  let status, statusColor;
  if (hellActive) { status = "DEMONIC FORCE DETECTED"; statusColor = HELL_COLOR; }
  else if (demonBlockade?.active) { status = `OIL BLOCKADE — BOUNTY: ${demonBlockade.bountyAmount || 0} USDC`; statusColor = HELL_COLOR; }
  else if (phase === "drilling") { status = "DRILLING..."; statusColor = accent; }
  else if (phase === "analyzing") { status = "ANALYZING SAMPLE..."; statusColor = accent; }
  else if (phase === "result") { status = `RESULT: ${TIER_LABELS[tier ?? 0]}`; statusColor = tierColors[tier ?? 0]; }
  else if (phase === "preliminary" && scan.label) { status = `AREA SCAN: ${scan.label}`; statusColor = scan.color; }
  else { status = drillingActive ? "PUMPING" : "STANDBY"; statusColor = drillingActive ? accent : muted; }

  const scanMode = isHell ? "hell" : (busy || phase === "result") ? "chase" : "lit";
  const tierMode = isHell ? "hell" : phase === "analyzing" ? "chase" : "lit";
  const tierLit = isHell || phase === "drilling" || tier === null ? 0 : tier + 1;
  const tierWord = isHell || phase === "drilling" || tier === null ? "—"
    : phase === "analyzing" ? "…"
    : TIER_LABELS[tier];
  const scanWord = isHell ? (hellActive ? "BREACH" : "BLOCKADE")
    : scanMode === "chase" ? "…"
    : scan.word;

  const bg = isHell ? "rgba(204,17,0,0.08)" : (dark ? "rgba(212,168,84,0.06)" : "rgba(90,64,16,0.04)");
  const border = isHell ? "rgba(255,34,0,0.4)" : (dark ? "rgba(212,168,84,0.2)" : "rgba(90,64,16,0.18)");
  const sectionBorder = dark ? "#2a2e36" : "#d4c8b4";

  return (
    <div style={{
      padding: embedded ? "2px 0 8px" : "10px 14px",
      borderBottom: embedded ? "none" : `1px solid ${sectionBorder}`,
    }}>
      <style>{DIAL_CSS}</style>
      <div style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 4,
        padding: "10px 12px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}>
        {/* Status line — the colour rides on the indicator, the words stay in ink. */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 14 }}>
          <span
            className={isHell ? "hm-dial-pulse" : undefined}
            style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: statusColor,
              boxShadow: dark ? `0 0 6px ${statusColor}` : "none",
              transition: "background 0.5s",
            }}
          />
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.18em",
            color: isHell ? HELL_COLOR : accent,
            fontFamily: MONO, textAlign: "center",
          }}>
            {status}
          </span>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <SegmentDial
            segments={maxDepth}
            lit={depthLevel}
            colorFor={() => gold}
            value={depthLevel}
            sub={`OF ${maxDepth}`}
            label="DEPTH"
            dark={dark}
          />
          <SegmentDial
            segments={4}
            lit={scan.lit}
            colorFor={scan.colorFor}
            mode={scanMode}
            value={scanWord}
            sub="AREA SCAN"
            label="PRESSURE"
            dark={dark}
            breathe={drillingActive && scanMode === "lit"}
          />
          <SegmentDial
            segments={TIER_LABELS.length}
            lit={tierLit}
            colorFor={(i) => tierColors[i]}
            mode={tierMode}
            value={tierWord}
            sub="LAST LAYER"
            label="DENSITY"
            dark={dark}
          />
        </div>

        {/* Reveal progress — only while the bit is running */}
        {busy && (
          <div key={drillEvent} style={{
            width: "100%", height: 3, borderRadius: 2,
            background: dark ? "rgba(212,168,84,0.1)" : "rgba(90,64,16,0.08)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: dark ? "rgba(212,168,84,0.4)" : "rgba(90,64,16,0.3)",
              animation: `hmDialProgress ${REVEAL_TIME}ms linear forwards`,
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
