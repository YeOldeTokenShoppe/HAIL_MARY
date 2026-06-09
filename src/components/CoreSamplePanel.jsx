"use client";

import { useState, useMemo } from "react";

const DEPTH_Z = 20;

function classifyDensity(value, maxAvg) {
  if (value === 0) return 0;
  const t = maxAvg > 0 ? value / maxAvg : 0;
  if (t < 0.12) return 1;
  if (t < 0.35) return 2;
  if (t < 0.65) return 3;
  return 4;
}

// Paraboleum is the substance — rock tiers (shale/sandstone) stay neutral slate,
// the oil-bearing tiers (oil sand → crude → rich vein) glow phosphorescent green.
const DENSITY_COLORS_DARK = [
  { fill: "#2a322f", opacity: 0.5, label: "SHALE" },
  { fill: "#46585a", opacity: 0.6, label: "SANDSTONE" },
  { fill: "#2f8f8f", opacity: 0.75, label: "GLIMMER" },
  { fill: "#2dd6c8", opacity: 0.88, label: "LUMEN" },
  { fill: "#7afff2", opacity: 0.95, label: "RADIANCE" },
];

const DENSITY_COLORS_LIGHT = [
  { fill: "#d4ddda", opacity: 0.5, label: "SHALE" },
  { fill: "#a6c2c0", opacity: 0.62, label: "SANDSTONE" },
  { fill: "#5caeb0", opacity: 0.75, label: "GLIMMER" },
  { fill: "#249e9e", opacity: 0.86, label: "LUMEN" },
  { fill: "#0e7a78", opacity: 0.95, label: "RADIANCE" },
];

// Paraboleum is now the universal substance, so the toggle keeps the same green
// strata (the ◈ theme only restyles the console chrome, not the material).
const PARABOLUM_COLORS = (dark) => (dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT);

// Horizontal drill core / depth-progress band — surface at LEFT, deepest at RIGHT.
// Drilled strata (colored) fill the left; UNCHARTED (hatched) on the right; the
// steel auger bores rightward at the cut face. Tight horizontal element so it reads
// as a live "drilling" status line, distinct from the vertical strata charts.
function PersonalDrillBar({ column, maxOil, drillDepth, dark, hellDepths = [], parabolum = false }) {
  const svgW = 280;
  const barX = 14, barW = svgW - 28;        // 252
  const barY = 8, barH = 40;
  const svgH = barY + barH + 22;            // room for ticks below
  const segW = barW / DEPTH_Z;
  const dd = Math.min(Math.max(drillDepth, 0), DEPTH_Z);
  const drilledW = dd * segW;
  const faceX = barX + drilledW;
  const colors = parabolum ? PARABOLUM_COLORS(dark) : dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT;
  const unknownFill = dark ? "#141820" : "#e0d8cc";
  const steel = dark ? "#46627e" : "#34495e";
  const hot = parabolum ? "#7fe7ff" : (dark ? "#ffd27f" : "#c8861e");
  const drilling = dd < DEPTH_Z;

  // Auger geometry (horizontal, boring right). Anchored at the surface (left),
  // grows to the cut face, spine + arrowhead jut a touch past into the unknown.
  const augerT = 17, rodT = 8;
  const augerCY = barY + barH / 2;
  const augerTop = augerCY - augerT / 2;
  const rodRight = Math.min(barX + barW, faceX + segW * 0.5);
  const tipLen = augerT * 0.55;
  const fluteP = 11;

  return (
    <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <filter id="bar-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="bar-clip"><rect x={barX} y={barY} width={barW} height={barH} rx={6} /></clipPath>
        <clipPath id="auger-clip"><rect x={barX} y={augerTop} width={Math.max(0, faceX - barX)} height={augerT} /></clipPath>
        <pattern id="bar-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} strokeWidth="2" />
        </pattern>
        <linearGradient id="bar-depth" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={hot} stopOpacity="0.16" />
          <stop offset="0.5" stopColor={hot} stopOpacity="0.03" />
          <stop offset="1" stopColor={hot} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x={barX} y={barY} width={barW} height={barH} rx={6}
        fill={dark ? "rgba(18,10,22,0.6)" : "rgba(200,190,175,0.3)"} />

      <g clipPath="url(#bar-clip)">
        {/* Drilled strata segments (left → cut face) */}
        {column.map((value, z) => {
          if (z >= dd) return null;
          const cc = colors[classifyDensity(value, maxOil)];
          return <rect key={z} x={barX + z * segW} y={barY} width={segW + 0.5} height={barH} fill={cc.fill} opacity={cc.opacity} />;
        })}

        {/* Unknown zone (cut face → right) */}
        {dd < DEPTH_Z && (
          <>
            <rect x={faceX} y={barY} width={barW - drilledW} height={barH} fill={unknownFill} />
            <rect x={faceX} y={barY} width={barW - drilledW} height={barH} fill="url(#bar-hatch)" />
            {drilling && (
              <rect x={faceX} y={barY} width={Math.min(segW * 3.5, barW - drilledW)} height={barH} fill="url(#bar-depth)">
                <animate attributeName="opacity" values="0.55;1;0.7;0.55" dur="3.2s" repeatCount="indefinite" />
              </rect>
            )}
          </>
        )}

        {/* Hell pockets struck */}
        {hellDepths.filter((z) => z < dd).map((z) => (
          <rect key={`h-${z}`} x={barX + z * segW} y={barY} width={segW + 0.5} height={barH} fill="#cc1100" opacity="0.35" />
        ))}

        {/* Drill auger — bores rightward at the cut face */}
        {drilling && (
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 1.2; 0 0" dur="1.4s" repeatCount="indefinite" />
            {/* spine: surface → past the cut face */}
            <rect x={barX} y={augerCY - rodT / 2} width={rodRight - barX} height={rodT} fill={steel} />
            {/* augered threads scrolling RIGHT → spinning */}
            <g clipPath="url(#auger-clip)" stroke={steel} strokeWidth="5" strokeLinecap="butt">
              <animateTransform attributeName="transform" type="translate" from="0 0" to={`${fluteP} 0`} dur="0.3s" repeatCount="indefinite" />
              {Array.from({ length: Math.ceil((faceX - barX) / fluteP) + 4 }).map((_, i) => {
                const x = barX - fluteP * 2 + i * fluteP;
                return <line key={i} x1={x} y1={augerTop + augerT} x2={x + augerT * 1.1} y2={augerTop} />;
              })}
            </g>
            {/* head cap at the surface (left edge) */}
            <rect x={barX - 1} y={augerTop - 1} width={5} height={augerT + 2} rx={1.5} fill={steel} />
            {/* arrowhead pointing right (into the unknown) */}
            <polygon points={`${rodRight},${augerCY - 7} ${rodRight},${augerCY + 7} ${rodRight + tipLen},${augerCY}`} fill={steel} />
          </g>
        )}
      </g>

      <rect x={barX} y={barY} width={barW} height={barH} rx={6} fill="none"
        stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="0.8" opacity="0.5" />

      {/* Depth ticks below */}
      <g fontFamily='"Share Tech Mono", monospace' fontSize="8"
        fill={dark ? "rgba(212,168,84,0.6)" : "rgba(139,115,85,0.6)"} letterSpacing="0.05em">
        {[0, 4, 9, 14, 19].map((z) => {
          const xPos = barX + z * segW + segW * 0.5;
          return (
            <g key={z} opacity={z < dd ? 1 : 0.4}>
              <line x1={xPos} y1={barY + barH} x2={xPos} y2={barY + barH + 4}
                stroke={dark ? "rgba(212,168,84,0.3)" : "rgba(139,115,85,0.3)"} strokeWidth="0.6" />
              <text x={xPos} y={barY + barH + 14} textAnchor="middle">{z + 1}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Thin field-profile strip — the richest strata revealed across the WHOLE field,
// by depth. Shares the drill band's axis (surface LEFT → deep RIGHT) so it sits
// directly under it: "your drill is here ▸ … the field's rich zone is there ▸".
// Reads from revealed data only (players), so it's an emerging clue, not a leak.
function FieldProfileBar({ profile, maxPeak, dark, parabolum = false }) {
  const svgW = 280;
  const barX = 14, barW = svgW - 28;        // matches PersonalDrillBar
  const barY = 2, barH = 11;
  const svgH = barH + 4;
  const segW = barW / DEPTH_Z;
  const colors = parabolum ? PARABOLUM_COLORS(dark) : dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT;
  const emptyFill = dark ? "rgba(30,36,48,0.5)" : "rgba(200,190,175,0.4)";
  let peakZ = -1, peakV = 0;
  for (let z = 0; z < profile.length; z++) if (profile[z] > peakV) { peakV = profile[z]; peakZ = z; }
  return (
    <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet" style={{ display: "block" }} aria-hidden="true">
      <rect x={barX} y={barY} width={barW} height={barH} rx={3} fill={emptyFill} />
      {profile.map((v, z) => {
        if (v <= 0) return null;
        const cc = colors[classifyDensity(v, maxPeak)];
        return <rect key={z} x={barX + z * segW} y={barY} width={segW + 0.5} height={barH} fill={cc.fill} opacity={cc.opacity} />;
      })}
      {/* mark the richest revealed depth */}
      {peakZ >= 0 && (
        <polygon
          points={`${barX + peakZ * segW + segW / 2 - 3},${barY - 1} ${barX + peakZ * segW + segW / 2 + 3},${barY - 1} ${barX + peakZ * segW + segW / 2},${barY + 2}`}
          fill={dark ? "#ffd27f" : "#c8861e"} />
      )}
      <rect x={barX} y={barY} width={barW} height={barH} rx={3} fill="none"
        stroke={dark ? "#3a4454" : "#c8bca8"} strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}

function Legend({ dark, parabolum = false }) {
  const colors = parabolum ? PARABOLUM_COLORS(dark) : dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "4px 10px",
      justifyContent: "center",
      marginTop: 6, paddingTop: 6,
      borderTop: `1px solid ${dark ? "#2a2e36" : "#d4c8b4"}`,
    }}>
      {colors.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 1,
            background: c.fill, opacity: c.opacity,
            border: `0.5px solid ${dark ? "#444" : "#bbb"}`,
          }} />
          <span style={{
            fontSize: 9, letterSpacing: "0.08em",
            color: dark ? "#8a98a8" : "#6e6050",
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CoreSamplePanel({
  grid3D,
  maxOil,
  darkMode = false,
  parabolum = false,
  hud = false,
  isMobile = false,
  defaultExpanded = true,
  gridX = 10,
  gridY = 10,
  selectedX = null,
  selectedY = null,
  drillDepth = 0,
  hellPockets = [],
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const dark = darkMode;
  // HUD console — cyan chrome (tabs, headings, callouts) around the gold/amber
  // core tube, mirroring the SpaceScene prospecting HUD. Takes precedence over
  // the day/dark/parabolum palettes; the stratigraphy colors stay amber.
  const c = hud ? {
    accent: "#6bc7d1", muted: "#7e94a6",
    sectionBorder: "rgba(107,199,209,0.18)",
    btnBg: "rgba(107,199,209,0.1)", btnBorder: "rgba(107,199,209,0.35)",
    btnBgHover: "rgba(107,199,209,0.2)",
  } : parabolum ? (dark ? {
    accent: "#c79bff", muted: "#7a6a9c",
    sectionBorder: "#2a1d44",
    btnBg: "rgba(123,45,214,0.16)", btnBorder: "rgba(164,92,255,0.35)",
    btnBgHover: "rgba(123,45,214,0.28)",
  } : {
    accent: "#7a2dd6", muted: "#5e7178",
    sectionBorder: "#c8dcd9",
    btnBg: "rgba(123,45,214,0.08)", btnBorder: "rgba(106,45,176,0.28)",
    btnBgHover: "rgba(123,45,214,0.16)",
  }) : dark ? {
    accent: "#d4a854", muted: "#6a7888",
    sectionBorder: "#2a2e36",
    btnBg: "rgba(212,168,84,0.12)", btnBorder: "rgba(212,168,84,0.3)",
    btnBgHover: "rgba(212,168,84,0.2)",
  } : {
    accent: "#5a4010", muted: "#6e6050",
    sectionBorder: "#d4c8b4",
    btnBg: "rgba(139,105,20,0.06)", btnBorder: "rgba(139,105,20,0.25)",
    btnBgHover: "rgba(139,105,20,0.12)",
  };

  const personalColumn = useMemo(() => {
    if (selectedX === null || selectedY === null || !grid3D) return null;
    const col = [];
    for (let z = 0; z < DEPTH_Z; z++) col.push(grid3D[selectedX]?.[selectedY]?.[z] ?? 0);
    return col;
  }, [grid3D, selectedX, selectedY]);

  const hellDepthsForPlot = useMemo(() => {
    if (selectedX === null || selectedY === null) return [];
    return hellPockets
      .filter(hp => hp.x === selectedX && hp.y === selectedY)
      .map(hp => hp.z);
  }, [hellPockets, selectedX, selectedY]);

  // Field profile = richest revealed cell per depth across the whole field (for
  // players, that's revealed data only — an emerging "where the vein lies" clue).
  const { fieldProfile, fieldMaxPeak } = useMemo(() => {
    if (!grid3D) return { fieldProfile: [], fieldMaxPeak: 0 };
    const col = new Array(DEPTH_Z).fill(0);
    for (let x = 0; x < gridX; x++)
      for (let y = 0; y < gridY; y++)
        for (let z = 0; z < DEPTH_Z; z++) {
          const v = grid3D[x]?.[y]?.[z] ?? 0;
          if (v > col[z]) col[z] = v;
        }
    let mx = 0;
    for (let z = 0; z < DEPTH_Z; z++) if (col[z] > mx) mx = col[z];
    return { fieldProfile: col, fieldMaxPeak: mx };
  }, [grid3D, gridX, gridY]);

  // A selected claim shows the core tube even at depth 0 — the rig is auto-pumping,
  // so the live drill face churns at the surface (all-unknown below) instead of an
  // inert "start drilling" placeholder. Only a no-selection state stays empty.
  const hasClaim = selectedX !== null && selectedY !== null;

  if (!grid3D) return null;

  return (
    <div style={{
      padding: isMobile ? "12px 12px" : "12px 14px",
      borderBottom: `1px solid ${c.sectionBorder}`,
    }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <h3 style={{
          margin: 0, fontSize: isMobile ? 12 : 11, fontWeight: 600,
          color: c.accent, letterSpacing: "0.2em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 2v20" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <circle cx="12" cy="12" r="3" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
          </svg>
          CORE SAMPLE
        </h3>
        <span style={{ fontSize: 10, color: c.muted }}>{expanded ? "▴" : "▾"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {hasClaim && personalColumn ? (
            <>
              <div style={{
                fontSize: 10, color: c.muted, letterSpacing: "0.1em",
                fontFamily: "'Share Tech Mono', monospace",
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginBottom: 6, padding: "0 2px",
              }}>
                <span>PLOT ({selectedX}, {selectedY})</span>
                <span style={{ color: c.accent }}>
                  {drillDepth < DEPTH_Z
                    ? `DRILLING · ${Math.min(drillDepth, DEPTH_Z)}/${DEPTH_Z}`
                    : `DEPTH ${DEPTH_Z}/${DEPTH_Z}`}
                </span>
              </div>
              <PersonalDrillBar
                column={personalColumn}
                maxOil={maxOil}
                drillDepth={drillDepth}
                dark={dark}
                hellDepths={hellDepthsForPlot}
                parabolum={parabolum}
              />
              {fieldMaxPeak > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{
                    fontSize: 8, color: c.muted, letterSpacing: "0.1em",
                    fontFamily: "'Share Tech Mono', monospace",
                    padding: "0 2px", marginBottom: 2, textTransform: "uppercase",
                  }}>
                    Field Sample Average (by depth)
                  </div>
                  <FieldProfileBar profile={fieldProfile} maxPeak={fieldMaxPeak} dark={dark} parabolum={parabolum} />
                </div>
              )}
            </>
          ) : (
            <div style={{
              textAlign: "center", padding: "16px 10px",
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              <span style={{ fontSize: 18, opacity: 0.5, marginRight: 8 }}>⛏️</span>
              <span style={{ fontSize: 10, color: c.muted, letterSpacing: "0.08em" }}>
                {selectedX === null
                  ? "Select a claim to see your drill log."
                  : "Start drilling to build your core sample."}
              </span>
            </div>
          )}

          <Legend dark={dark} parabolum={parabolum} />
        </div>
      )}
    </div>
  );
}
