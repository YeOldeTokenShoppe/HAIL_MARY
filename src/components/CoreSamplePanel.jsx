"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { PanelSection, PanelTitle, PANEL_ICONS } from "./HailMaryPanel";

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

// Buried-artifact markers (docs/artifact-expansion.md) — drawn as diamonds ON
// the strata band, not as strata: an artifact shares its layer with whatever
// rock it was buried in. Warm/violet hues so they read against the teal strata.
const ARTIFACT_MARKS = {
  amber: { fill: "#ffb84d", label: "AMBER" },
  relic: { fill: "#c79bff", label: "RELIC" },
  map:   { fill: "#ffe9a8", label: "MAP" },
  cache: { fill: "#ffd700", label: "CACHE" },
};

// Horizontal core tray — surface at LEFT, deepest at RIGHT. A core is an
// extracted object laid out to be read, so this is a tray of 20 slots: cored
// strata fill from the left, empty slots wait on the right, and the cut face
// (where the next layer will land) glows. The drilling itself is the 3D rig and
// the DEPTH dial — there is deliberately no drill bit in here.
function PersonalDrillBar({ column, maxOil, drillDepth, dark, hellDepths = [], artifactMarks = [], parabolum = false, animateFrom = Infinity }) {
  const svgW = 280;
  const barX = 14, barW = svgW - 28;        // 252
  const barY = 8, barH = 40;
  const svgH = barY + barH + 32;            // ticks + orientation words below
  const segW = barW / DEPTH_Z;
  const dd = Math.min(Math.max(drillDepth, 0), DEPTH_Z);
  const drilledW = dd * segW;
  const faceX = barX + drilledW;
  const colors = parabolum ? PARABOLUM_COLORS(dark) : dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT;
  const trayFill = dark ? "#141820" : "#e0d8cc";
  const slotLine = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  const hot = parabolum ? "#7fe7ff" : (dark ? "#ffd27f" : "#c8861e");
  const muted = dark ? "rgba(212,168,84,0.6)" : "rgba(139,115,85,0.6)";
  const coring = dd < DEPTH_Z;
  const reduceMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <filter id="bar-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="bar-clip"><rect x={barX} y={barY} width={barW} height={barH} rx={6} /></clipPath>
      </defs>

      <rect x={barX} y={barY} width={barW} height={barH} rx={6}
        fill={dark ? "rgba(18,10,22,0.6)" : "rgba(200,190,175,0.3)"} />

      <g clipPath="url(#bar-clip)">
        {/* Empty slots — not cored yet */}
        {dd < DEPTH_Z && (
          <rect x={faceX} y={barY} width={barW - drilledW} height={barH} fill={trayFill} />
        )}
        {Array.from({ length: DEPTH_Z }, (_, z) => (z > dd ? (
          <line key={`s-${z}`} x1={barX + z * segW} y1={barY + 5} x2={barX + z * segW} y2={barY + barH - 5}
            stroke={slotLine} strokeWidth="1" />
        ) : null))}

        {/* Cored strata (surface → cut face). Layers cored since mount slide in
            from the cut face — the core being pulled. */}
        {column.map((value, z) => {
          if (z >= dd) return null;
          const cc = colors[classifyDensity(value, maxOil)];
          const x = barX + z * segW;
          const fresh = !reduceMotion && z >= animateFrom;
          return (
            <rect key={z} x={x} y={barY} width={segW + 0.5} height={barH} fill={cc.fill} opacity={cc.opacity}>
              {fresh && <animate attributeName="x" from={x + segW * 2.5} to={x} dur="0.45s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" />}
              {fresh && <animate attributeName="opacity" from="0" to={cc.opacity} dur="0.45s" fill="freeze" />}
            </rect>
          );
        })}

        {/* Hell pockets struck */}
        {hellDepths.filter((z) => z < dd).map((z) => (
          <rect key={`h-${z}`} x={barX + z * segW} y={barY} width={segW + 0.5} height={barH} fill="#cc1100" opacity="0.35" />
        ))}

        {/* Artifacts unearthed — diamond over the layer they were buried in */}
        {artifactMarks.filter((m) => m.z < dd).map((m) => {
          const mark = ARTIFACT_MARKS[m.type] || ARTIFACT_MARKS.relic;
          const cx = barX + m.z * segW + segW / 2;
          const cy = barY + barH * 0.28;
          const r = Math.min(5, segW * 0.55);
          return (
            <polygon key={`a-${m.z}`} filter="url(#bar-glow)"
              points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
              fill={mark.fill} opacity="0.95"
              stroke={m.cursed ? "#ff3b1f" : "rgba(0,0,0,0.45)"} strokeWidth={m.cursed ? 1.2 : 0.6} />
          );
        })}

        {/* Cut face — the next layer lands here */}
        {coring && dd > 0 && (
          <rect x={faceX - 1} y={barY} width={2} height={barH} fill={hot} opacity="0.9">
            {!reduceMotion && <animate attributeName="opacity" values="0.35;1;0.35" dur="2.4s" repeatCount="indefinite" />}
          </rect>
        )}
      </g>

      <rect x={barX} y={barY} width={barW} height={barH} rx={6} fill="none"
        stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="0.8" opacity="0.5" />

      {/* Layer ticks */}
      <g fontFamily='"Share Tech Mono", monospace' fontSize="8" fill={muted} letterSpacing="0.05em">
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
      {/* Orientation — a horizontal core still reads surface-to-deep */}
      <g fontFamily='"Share Tech Mono", monospace' fontSize="8" fill={muted} letterSpacing="0.12em">
        <text x={barX} y={barY + barH + 27} textAnchor="start">SURFACE</text>
        <text x={barX + barW} y={barY + barH + 27} textAnchor="end">DEEP →</text>
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

function Legend({ dark, parabolum = false, border }) {
  const colors = parabolum ? PARABOLUM_COLORS(dark) : dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "4px 10px",
      justifyContent: "center",
      marginTop: 6, paddingTop: 6,
      borderTop: `1px solid ${border}`,
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
      {/* Artifact marks — diamonds, matching the drill-bar markers */}
      {Object.entries(ARTIFACT_MARKS).map(([k, m]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 8, height: 8, background: m.fill, opacity: 0.95,
            transform: "rotate(45deg)",
            border: `0.5px solid ${dark ? "#444" : "#bbb"}`,
          }} />
          <span style={{
            fontSize: 9, letterSpacing: "0.08em",
            color: dark ? "#8a98a8" : "#6e6050",
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            {m.label}
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
  // Page theme — drives the section chrome and the text colours below.
  theme = null,
  gridX = 10,
  gridY = 10,
  selectedX = null,
  selectedY = null,
  drillDepth = 0,
  hellPockets = [],
  // Unearthed artifacts on the selected plot: [{ z, type, cursed }] from the
  // server-authoritative revealedArtifacts map (docs/artifact-expansion.md).
  artifactMarks = [],
  // Public per-column placement guarantee — drives the seismic lower bound.
  artifactGuaranteeMin = 3,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const dark = darkMode;
  // Chrome + text colours come from the page theme; the fallback only keeps the
  // component rendering if it is ever mounted without one.
  const t = theme || (dark
    ? { border: "#2a2e36", accent: "#d4a854", muted: "#6a7888" }
    : { border: "#d4c8b4", accent: "#5a4010", muted: "#6e6050" });

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

  // Layers cored after this mount (or after a plot switch) slide in from the
  // cut face; layers already in the tray just sit there.
  const animateFromRef = useRef(drillDepth);
  useEffect(() => { animateFromRef.current = drillDepth; }, [selectedX, selectedY]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!grid3D) return null;

  return (
    <PanelSection theme={t} isMobile={isMobile}>
      <PanelTitle theme={t} isMobile={isMobile} icon={PANEL_ICONS.core} onToggle={() => setExpanded((e) => !e)} open={expanded}>
        CORE SAMPLE
      </PanelTitle>

      {expanded && (
        <div>
          {hasClaim && personalColumn ? (
            <>
              <div style={{
                fontSize: 10, color: t.muted, letterSpacing: "0.1em",
                fontFamily: "'Share Tech Mono', monospace",
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginBottom: 6, padding: "0 2px",
              }}>
                <span>PLOT ({selectedX + 1}, {selectedY + 1})</span>
                <span style={{ color: t.accent }}>
                  CORED {Math.min(Math.max(drillDepth, 0), DEPTH_Z)} / {DEPTH_Z} LAYERS
                </span>
              </div>
              <PersonalDrillBar
                column={personalColumn}
                maxOil={maxOil}
                drillDepth={drillDepth}
                dark={dark}
                hellDepths={hellDepthsForPlot}
                artifactMarks={artifactMarks}
                parabolum={parabolum}
                animateFrom={animateFromRef.current}
              />
              {drillDepth <= 0 && (
                <div style={{
                  fontSize: 10, color: t.muted, letterSpacing: "0.06em", textAlign: "center",
                  padding: "0 0 4px", fontFamily: "'Share Tech Mono', monospace",
                }}>
                  No core yet — the first layer lands at your first strike.
                </div>
              )}
              {(() => {
                // SEISMIC READING — an honest ratchet, not a psychological one.
                // ≥artifactGuaranteeMin artifacts per column is a public,
                // seed-committed guarantee, so (guaranteed − found) ÷ layers
                // remaining is a true LOWER bound on the next-layer find chance.
                // It can only climb as dry layers accumulate.
                const dd = Math.min(Math.max(drillDepth, 0), DEPTH_Z);
                const found = artifactMarks.filter((m) => m.z < dd).length;
                const undrilled = DEPTH_Z - dd;
                const owed = Math.max(0, artifactGuaranteeMin - found);
                const pct = undrilled > 0 && owed > 0 ? Math.min(100, Math.ceil((owed / undrilled) * 100)) : 0;
                return (
                  <div style={{
                    fontSize: 9, letterSpacing: "0.1em", padding: "2px 2px 0",
                    fontFamily: "'Share Tech Mono', monospace",
                    display: "flex", flexDirection: "column", gap: 2,
                    color: t.muted,
                  }}>
                    <span>SEISMIC · ARTIFACTS {found}{owed > 0 ? ` / ${artifactGuaranteeMin}+` : " RECOVERED"}</span>
                    {owed > 0 && undrilled > 0 ? (
                      <span style={{ color: dark ? "#c79bff" : "#7a2dd6" }}>NEXT-LAYER FIND ≥ {pct}%</span>
                    ) : (
                      <span>DEEPER SIGNATURES UNKNOWN</span>
                    )}
                  </div>
                );
              })()}
              {fieldMaxPeak > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{
                    fontSize: 8, color: t.muted, letterSpacing: "0.1em",
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
              <span style={{ fontSize: 10, color: t.muted, letterSpacing: "0.08em" }}>
                {selectedX === null
                  ? "Select a plot to see its drill log."
                  : "Start drilling to build your core sample."}
              </span>
            </div>
          )}

          {hasClaim && personalColumn && <Legend dark={dark} parabolum={parabolum} border={t.border} />}
        </div>
      )}
    </PanelSection>
  );
}
