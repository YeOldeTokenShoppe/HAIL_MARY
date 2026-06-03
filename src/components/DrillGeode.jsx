"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const REVEAL_TIME = 10000;
const PRELIM_DELAY = 2500;

// Paraboleum density readout — dim grey-green at barren, phosphorescent green at rich.
const DENSITY_LABELS = [
  { label: "BARREN", color: "#7a8a72" },
  { label: "TRACE", color: "#5cae6c" },
  { label: "GLIMMER", color: "#2f9f4e" },
  { label: "LUMEN", color: "#2dd64a" },
  { label: "RADIANCE", color: "#74ff96" },
];

const PRELIM_LEVELS = [
  { label: "NOMINAL", color: "#7a8a72", threshold: 0 },
  { label: "TRACE ACTIVITY", color: "#5cae6c", threshold: 0.05 },
  { label: "ELEVATED READINGS", color: "#2dd64a", threshold: 0.15 },
  { label: "ANOMALOUS SIGNAL", color: "#74ff96", threshold: 0.35 },
];

// Hell-pocket proximity readings — amber→orange thermal/chemical cues that warn a
// hell pocket is near WITHOUT naming the demon or its direction. Deliberately
// ambiguous (could read as a thermal vent over a rich vein), and visually distinct
// from the green oil scan so it doesn't blend into a normal "good" signal.
const HELL_PRELIM_LEVELS = [
  { label: "THERMAL FLUX", color: "#d6a23c" },
  { label: "SULFUROUS TRACE", color: "#e8742a" },
  { label: "EXOTHERMIC ANOMALY", color: "#ff5a1e" },
];
function getHellPrelimLevel(intensity) {
  if (intensity >= 0.8) return 2;
  if (intensity >= 0.55) return 1;
  return 0;
}

// Status-readout colors (index-aligned). Green everywhere now — dark variant is
// bright for dark/console bg, light variant is deeper for the light console.
const DENSITY_COLORS_PARA_DARK = ["#7a8a72", "#5cae6c", "#2f9f4e", "#2dd64a", "#74ff96"];
const DENSITY_COLORS_PARA_LIGHT = ["#6a7a62", "#3f9a52", "#1f8a3e", "#0e7a32", "#0a5e26"];
const PRELIM_COLORS_PARA_DARK = ["#7a8a72", "#5cae6c", "#2dd64a", "#74ff96"];
const PRELIM_COLORS_PARA_LIGHT = ["#6a7a62", "#2f9a4e", "#0e7a32", "#0a5e26"];

function classifyTier(value, maxOil) {
  if (value === 0) return 0;
  const t = maxOil > 0 ? value / maxOil : 0;
  if (t < 0.08) return 1;
  if (t < 0.25) return 2;
  if (t < 0.50) return 3;
  return 4;
}

function getPrelimLevel(proximity, maxOil) {
  if (!proximity || !maxOil) return PRELIM_LEVELS[0];
  const t = proximity / maxOil;
  for (let i = PRELIM_LEVELS.length - 1; i >= 0; i--) {
    if (t >= PRELIM_LEVELS[i].threshold) return PRELIM_LEVELS[i];
  }
  return PRELIM_LEVELS[0];
}

function GaugeArc({ value, max, label, unit, color, size = 80, dark = true }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.52;
  const startAngle = -225;
  const endAngle = 45;
  const range = endAngle - startAngle;
  const fillAngle = startAngle + (Math.min(value, max) / max) * range;

  const toXY = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const [sx, sy] = toXY(startAngle);
  const [ex, ey] = toXY(fillAngle);
  const largeArc = fillAngle - startAngle > 180 ? 1 : 0;
  const [bsx, bsy] = toXY(startAngle);
  const [bex, bey] = toXY(endAngle);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`}>
        <path
          d={`M ${bsx} ${bsy} A ${r} ${r} 0 1 1 ${bex} ${bey}`}
          fill="none" stroke={dark ? "rgba(212,168,84,0.2)" : "rgba(90,64,16,0.2)"} strokeWidth="5" strokeLinecap="round"
        />
        {value > 0 && (
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
            fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
        <text
          x={cx} y={cy + 2}
          textAnchor="middle" fontFamily="'Share Tech Mono', monospace"
          fontSize="14" fontWeight="700" fill={color}
          style={{ filter: `drop-shadow(0 0 2px ${color})` }}
        >
          {typeof value === "number" ? value.toFixed(1) : value}
        </text>
        {unit && (
          <text
            x={cx} y={cy + 14}
            textAnchor="middle" fontFamily="'Share Tech Mono', monospace"
            fontSize="7.5" fill={dark ? "rgba(212,168,84,0.7)" : "rgba(90,64,16,0.6)"} letterSpacing="0.1em"
          >
            {unit}
          </text>
        )}
      </svg>
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: "0.15em",
        color: dark ? "rgba(212,168,84,0.8)" : "rgba(90,64,16,0.7)",
        fontFamily: "'Share Tech Mono', monospace",
        textAlign: "center",
      }}>
        {label}
      </div>
    </div>
  );
}

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
}) {
  const [phase, setPhase] = useState("standby");
  // Mirrors for the zero-dep animate() callback to read current theme state.
  const parabolumRef = useRef(parabolum);
  parabolumRef.current = parabolum;
  const darkRef = useRef(darkMode);
  darkRef.current = darkMode;
  // HUD reuses the Parabolum (dark) violet status palette so the readout matches
  // the violet selection highlights.
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const [pressure, setPressure] = useState(0);
  const [density, setDensity] = useState(0);
  const [status, setStatus] = useState("STANDBY");
  const [statusColor, setStatusColor] = useState(null);
  const [prelimPressure, setPrelimPressure] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const prevDrillEvent = useRef(0);
  const pendingOilValue = useRef(0);
  const pendingMaxOil = useRef(1);
  const pendingProximity = useRef(0);
  const pendingHellProximity = useRef(0);
  const prelimTimerRef = useRef(null);

  const animate = useCallback(() => {
    const now = performance.now();
    const ms = now - startRef.current;
    const t = ms / REVEAL_TIME;

    if (ms < REVEAL_TIME * 0.6) {
      setPhase("drilling");
      setStatus("DRILLING...");
      setStatusColor(null);
      const base = 15 + t * 45;
      const noise = Math.sin(ms * 0.008) * 10 + Math.sin(ms * 0.013) * 6 + Math.sin(ms * 0.021) * 4;
      setPressure(Math.max(0, Math.min(99, base + noise)));
      setDensity(0);
    } else if (ms < REVEAL_TIME) {
      setPhase("analyzing");
      setStatus("ANALYZING SAMPLE...");
      setStatusColor(null);
      const base = 50 + (t - 0.6) / 0.4 * 30;
      const noise = Math.sin(ms * 0.01) * 12 + Math.sin(ms * 0.019) * 6;
      const spike = t > 0.85 ? (t - 0.85) / 0.15 * 20 : 0;
      setPressure(Math.max(0, Math.min(99, base + noise + spike)));
      const analysisT = (ms - REVEAL_TIME * 0.6) / (REVEAL_TIME * 0.4);
      const dNoise = Math.sin(ms * 0.012) * 18 + Math.sin(ms * 0.019) * 10;
      setDensity(Math.max(0, analysisT * 45 + dNoise));
    } else if (ms < REVEAL_TIME + 300) {
      setPhase("result");
      const val = pendingOilValue.current;
      const mx = pendingMaxOil.current;
      const tier = classifyTier(val, mx);
      const info = DENSITY_LABELS[tier];
      setStatus(`RESULT: ${info.label}`);
      setStatusColor((parabolumRef.current || hudRef.current) ? (darkRef.current ? DENSITY_COLORS_PARA_DARK : DENSITY_COLORS_PARA_LIGHT)[tier] : info.color);
      setPressure(val > 0 ? 80 + (tier / 4) * 19 : 3 + Math.random() * 8);
      setDensity(val > 0 ? 55 + (tier / 4) * 44 : 1 + Math.random() * 4);
    }

    if (ms >= REVEAL_TIME + 300) {
      // Drill animation done — schedule preliminary scan transition
      prelimTimerRef.current = setTimeout(() => {
        const prox = pendingProximity.current;
        const mx = pendingMaxOil.current;
        const hellProx = pendingHellProximity.current;
        // A nearby hell pocket overrides the oil scan with an ambiguous thermal
        // cue — it's the more important (and more dangerous) thing under the bit.
        if (hellProx > 0) {
          const hi = getHellPrelimLevel(hellProx);
          const hl = HELL_PRELIM_LEVELS[hi];
          const hp = 55 + hellProx * 40; // elevated pressure — reads as "energetic"
          setPrelimPressure(hp);
          setPressure(hp);
          setDensity(0);
          setStatus(`AREA SCAN: ${hl.label}`);
          setStatusColor(hl.color);
          setPhase("preliminary");
          return;
        }
        const prelim = getPrelimLevel(prox, mx);
        const prelimIdx = PRELIM_LEVELS.indexOf(prelim);
        const proxRatio = mx > 0 ? prox / mx : 0;
        const prelimP = 5 + proxRatio * 65;
        setPrelimPressure(prelimP);
        setPressure(prelimP);
        setDensity(0);
        setStatus(`AREA SCAN: ${prelim.label}`);
        setStatusColor((parabolumRef.current || hudRef.current) ? (darkRef.current ? PRELIM_COLORS_PARA_DARK : PRELIM_COLORS_PARA_LIGHT)[prelimIdx] : prelim.color);
        setPhase("preliminary");
      }, PRELIM_DELAY);
      return;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (drillEvent > 0 && drillEvent !== prevDrillEvent.current) {
      prevDrillEvent.current = drillEvent;
      pendingOilValue.current = oilValue;
      pendingMaxOil.current = maxOil;
      pendingProximity.current = drillProximity;
      pendingHellProximity.current = hellProximity;
      if (prelimTimerRef.current) clearTimeout(prelimTimerRef.current);
      setPhase("drilling");
      setStatus("DRILLING...");
      setStatusColor(null);
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (prelimTimerRef.current) clearTimeout(prelimTimerRef.current);
    };
  }, [drillEvent, animate, oilValue, maxOil, drillProximity, hellProximity]);

  const dark = darkMode;
  const hellColor = "#ff2200";
  const isHellOrBlockade = hellActive || demonBlockade?.active;
  const bg = isHellOrBlockade ? "rgba(204,17,0,0.08)" : (dark ? "rgba(212,168,84,0.06)" : "rgba(90,64,16,0.04)");
  const border = isHellOrBlockade ? "rgba(255,34,0,0.4)" : (dark ? "rgba(212,168,84,0.2)" : "rgba(90,64,16,0.18)");
  const sectionBorder = dark ? "#2a2e36" : "#d4c8b4";
  const mutedColor = dark ? "#6a7888" : "#8b7d6b";
  const accentColor = dark ? "#d4a854" : "#5a4010";
  const isPrelim = phase === "preliminary";
  const isDrilling = phase === "drilling" || phase === "analyzing";
  const displayPressure = isHellOrBlockade ? 99 : pressure;
  const displayDensity = isHellOrBlockade ? 99 : density;
  const displayStatus = hellActive
    ? "DEMONIC FORCE DETECTED"
    : demonBlockade?.active
      ? `OIL BLOCKADE — BOUNTY: ${demonBlockade.bountyAmount || 0} USDC`
      : status;
  const displayStatusColor = isHellOrBlockade ? hellColor : statusColor;

  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: `1px solid ${sectionBorder}`,
    }}>
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
        {/* Status line */}
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.18em",
          color: displayStatusColor || (isDrilling ? accentColor : mutedColor),
          fontFamily: "'Share Tech Mono', monospace",
          textAlign: "center",
          textShadow: displayStatusColor && displayStatusColor !== "#6e6050" ? `0 0 6px ${displayStatusColor}` : "none",
          minHeight: 14,
          transition: "color 0.5s",
        }}>
          {displayStatus}
        </div>

        {/* Gauges */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <GaugeArc
            value={depthLevel}
            max={maxDepth}
            label="DEPTH"
            unit={`LV ${depthLevel}`}
            color={dark ? "#d4a854" : "#8b7355"}
            size={76}
            dark={dark}
          />
          <GaugeArc
            value={displayPressure}
            max={100}
            label="PRESSURE"
            unit="PSI"
            color={
              hellActive ? hellColor
              : isPrelim
                ? (statusColor || mutedColor)
                : statusColor && statusColor !== "#6e6050"
                  ? statusColor
                  : (dark ? "#8a98a8" : "#6e6050")
            }
            size={76}
            dark={dark}
          />
          <GaugeArc
            value={displayDensity}
            max={100}
            label="DENSITY"
            unit={
              hellActive
                ? "HELL"
                : isPrelim
                  ? "???"
                  : phase === "result" && statusColor
                    ? status.replace("RESULT: ", "")
                    : "g/cm³"
            }
            color={
              hellActive ? hellColor
              : isPrelim
                ? mutedColor
                : statusColor || (dark ? "#8a98a8" : "#6e6050")
            }
            size={76}
            dark={dark}
          />
        </div>

        {/* Progress bar — only during active drilling */}
        {isDrilling && (
          <div style={{
            width: "100%", height: 3, borderRadius: 2,
            background: dark ? "rgba(212,168,84,0.1)" : "rgba(90,64,16,0.08)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: dark ? "rgba(212,168,84,0.4)" : "rgba(90,64,16,0.3)",
              width: `${Math.min(100, ((performance.now() - startRef.current) / (REVEAL_TIME + 300)) * 100)}%`,
              transition: "width 0.3s linear",
            }} />
          </div>
        )}

        {/* Preliminary scan hint */}
        {isPrelim && depthLevel < maxDepth && (
          <div style={{
            fontSize: 8, letterSpacing: "0.1em",
            color: dark ? "#4a5565" : "#a09888",
            fontFamily: "'Share Tech Mono', monospace",
            textAlign: "center", lineHeight: 1.4,
            marginTop: 2,
          }}>
            PROXIMITY SCAN — 1 CELL RADIUS
          </div>
        )}
      </div>
    </div>
  );
}
