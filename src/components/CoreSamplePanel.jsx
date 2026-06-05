"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";

const DEPTH_Z = 20;
const REVEAL_DURATION = 2800;

function classifyDensity(value, maxAvg) {
  if (value === 0) return 0;
  const t = maxAvg > 0 ? value / maxAvg : 0;
  if (t < 0.12) return 1;
  if (t < 0.35) return 2;
  if (t < 0.65) return 3;
  return 4;
}

// Composite (field-average) classifier. The average is dominated by the single
// richest deposit, so a linear peak-relative scale buries every smaller deposit
// below the green threshold — making a multi-level field read as one band. A
// sqrt (perceptual) scale lifts the low end so each depth that holds oil glows
// proportionally, while the peak still tops out at RADIANCE.
function classifyComposite(value, maxAvg) {
  if (value === 0) return 0;
  const t = maxAvg > 0 ? Math.sqrt(value / maxAvg) : 0;
  if (t < 0.18) return 1;
  if (t < 0.45) return 2;
  if (t < 0.72) return 3;
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

function CompositeCoreTube({ avgColumn, maxAvg, peakDepth, dark, revealRatio, parabolum = false }) {
  const tubeX = 42;
  const tubeY = 10;
  const tubeW = 56;
  const tubeH = 260;
  const bandH = tubeH / DEPTH_Z;
  const colors = parabolum ? PARABOLUM_COLORS(dark) : dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT;
  const svgW = 270;
  const svgH = tubeH + 24;
  const fillHeight = tubeH * Math.min(1, Math.max(0, revealRatio));
  const revealedDepths = Math.floor(revealRatio * DEPTH_Z);

  return (
    <svg
      width="100%"
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="core-clip">
          <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={8} />
        </clipPath>
        <clipPath id="core-reveal">
          <rect x={tubeX} y={tubeY} width={tubeW} height={fillHeight} />
        </clipPath>
      </defs>

      {/* Tube background */}
      <rect
        x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={8}
        fill={dark ? "rgba(18,10,22,0.6)" : "rgba(200,190,175,0.3)"}
      />

      {/* Stratigraphy bands */}
      <g clipPath="url(#core-clip)">
        <g clipPath="url(#core-reveal)">
          {avgColumn.map((value, z) => {
            const tier = classifyComposite(value, maxAvg);
            const c = colors[tier];
            return (
              <rect
                key={z}
                x={tubeX}
                y={tubeY + z * bandH}
                width={tubeW}
                height={bandH + 0.5}
                fill={c.fill}
                opacity={c.opacity}
              />
            );
          })}
          <g opacity="0.2" stroke={dark ? "#e8d9b8" : "#8a7d6b"} strokeWidth="0.4" fill="none">
            {[4, 8, 12, 16].map((z) => (
              <line
                key={z}
                x1={tubeX}
                y1={tubeY + z * bandH}
                x2={tubeX + tubeW}
                y2={tubeY + z * bandH}
              />
            ))}
          </g>
        </g>
      </g>

      {/* Tube outline */}
      <rect
        x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={8}
        fill="none" stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="0.8" opacity="0.5"
      />

      {/* Glass highlight */}
      <rect
        x={tubeX + 3} y={tubeY + 4} width={5} height={tubeH - 8} rx={2.5}
        fill={dark ? "rgba(232,217,184,0.06)" : "rgba(255,255,255,0.15)"}
      />

      {/* Drill head indicator */}
      {revealRatio > 0 && revealRatio < 1 && (
        <g>
          <line
            x1={tubeX - 2} y1={tubeY + fillHeight}
            x2={tubeX + tubeW + 2} y2={tubeY + fillHeight}
            stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="1" opacity="0.6"
          />
          <text
            x={tubeX + tubeW + 8} y={tubeY + fillHeight + 4}
            fontFamily='"Share Tech Mono", monospace' fontSize="9"
            fill={dark ? "#d4a854" : "#b8922e"} letterSpacing="0.1em" opacity="0.8"
          >
            LV {revealedDepths}
          </text>
        </g>
      )}

      {/* Depth ticks — LEFT */}
      <g fontFamily='"Share Tech Mono", monospace' fontSize="9"
         fill={dark ? "rgba(212,168,84,0.55)" : "rgba(139,115,85,0.6)"} letterSpacing="0.05em">
        {[0, 5, 10, 15, 19].filter((z) => z < revealedDepths).map((z) => {
          const yPos = tubeY + z * bandH + bandH * 0.5;
          return (
            <g key={z}>
              <line
                x1={tubeX - 5} y1={yPos}
                x2={tubeX} y2={yPos}
                stroke={dark ? "rgba(212,168,84,0.3)" : "rgba(139,115,85,0.3)"}
                strokeWidth="0.6"
              />
              <text x={tubeX - 8} y={yPos + 3} textAnchor="end">
                {z + 1}
              </text>
            </g>
          );
        })}
      </g>

      {/* Callout labels + peak marker — RIGHT */}
      <g fontFamily='"Share Tech Mono", monospace' letterSpacing="0.08em">
        {(() => {
          const MIN_SPACING = 24;
          const candidates = [];
          let lastTier = -1;
          let runStart = 0;

          for (let z = 0; z <= DEPTH_Z; z++) {
            const tier = z < DEPTH_Z ? classifyComposite(avgColumn[z], maxAvg) : -2;
            if (tier !== lastTier && lastTier >= 0) {
              const span = z - runStart;
              if (lastTier >= 3 && span >= 2) {
                const midZ = (runStart + z - 1) / 2;
                const yPos = tubeY + midZ * bandH + bandH * 0.5;
                candidates.push({
                  yPos, tier: lastTier, span,
                  startLv: runStart + 1, endLv: z,
                  midDepth: midZ,
                  score: lastTier * 10 + span,
                });
              }
            }
            if (tier !== lastTier) { runStart = z; lastTier = tier; }
          }

          candidates.sort((a, b) => b.score - a.score);

          const peakY = peakDepth >= 0 ? tubeY + peakDepth * bandH + bandH * 0.5 : -999;
          const placed = [];
          if (peakDepth >= 0 && peakDepth < revealedDepths) placed.push(peakY);

          const filtered = [];
          for (const c of candidates) {
            if (c.midDepth >= revealedDepths) continue;
            if (!placed.some((py) => Math.abs(py - c.yPos) < MIN_SPACING)) {
              filtered.push(c);
              placed.push(c.yPos);
              if (filtered.length >= 3) break;
            }
          }

          return (
            <>
              {filtered.map((c) => {
                const col = colors[c.tier];
                return (
                  <g key={`callout-${c.startLv}`}>
                    <line
                      x1={tubeX + tubeW} y1={c.yPos}
                      x2={tubeX + tubeW + 14} y2={c.yPos}
                      stroke={dark ? "rgba(212,168,84,0.3)" : "rgba(139,115,85,0.3)"}
                      strokeWidth="0.6"
                    />
                    <text
                      x={tubeX + tubeW + 18} y={c.yPos + 3}
                      fill={col.fill} fontSize="10"
                      opacity={Math.min(col.opacity + 0.1, 1)}
                    >
                      {col.label}
                    </text>
                    <text
                      x={tubeX + tubeW + 18} y={c.yPos + 15}
                      fill={dark ? "#6a7888" : "#8b7d6b"}
                      fontSize="8"
                    >
                      LV {c.startLv}–{c.endLv}
                    </text>
                  </g>
                );
              })}
              {peakDepth >= 0 && peakDepth < revealedDepths && (
                <>
                  <g filter="url(#core-glow)">
                    <circle cx={tubeX + tubeW * 0.5} cy={peakY} r="3" fill="#e87a2b">
                      <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="r" values="3;4.2;3" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                  </g>
                  <line
                    x1={tubeX + tubeW} y1={peakY}
                    x2={tubeX + tubeW + 14} y2={peakY}
                    stroke="#e87a2b" strokeWidth="0.6" opacity="0.5"
                  />
                  <text
                    x={tubeX + tubeW + 18} y={peakY + 3}
                    fontSize="9" fill="#e87a2b" letterSpacing="0.12em"
                    style={{ filter: "drop-shadow(0 0 2px rgba(232,122,43,0.5))" }}
                  >
                    PEAK DENSITY
                  </text>
                </>
              )}
            </>
          );
        })()}
      </g>
    </svg>
  );
}

function PersonalCoreTube({ column, maxOil, drillDepth, dark, hellDepths = [], parabolum = false }) {
  const tubeX = 42;
  const tubeY = 10;
  const tubeW = 56;
  const tubeH = 260;
  const bandH = tubeH / DEPTH_Z;
  const colors = parabolum ? PARABOLUM_COLORS(dark) : dark ? DENSITY_COLORS_DARK : DENSITY_COLORS_LIGHT;
  const svgW = 270;
  const svgH = tubeH + 24;
  const drilledH = Math.min(drillDepth, DEPTH_Z) * bandH;
  const unknownFill = dark ? "#141820" : "#e0d8cc";
  const unknownStroke = dark ? "#1e2430" : "#d0c8b8";

  let bestDrilledZ = -1;
  let bestVal = 0;
  for (let z = 0; z < Math.min(drillDepth, DEPTH_Z); z++) {
    if ((column[z] || 0) > bestVal) { bestVal = column[z]; bestDrilledZ = z; }
  }

  return (
    <svg
      width="100%"
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <filter id="personal-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="personal-clip">
          <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={8} />
        </clipPath>
        <pattern id="unknown-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6"
            stroke={dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}
            strokeWidth="2" />
        </pattern>
      </defs>

      {/* Tube background */}
      <rect
        x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={8}
        fill={dark ? "rgba(18,10,22,0.6)" : "rgba(200,190,175,0.3)"}
      />

      <g clipPath="url(#personal-clip)">
        {/* Drilled layers — real results */}
        {column.map((value, z) => {
          if (z >= drillDepth) return null;
          const tier = classifyDensity(value, maxOil);
          const c = colors[tier];
          return (
            <rect
              key={z}
              x={tubeX} y={tubeY + z * bandH}
              width={tubeW} height={bandH + 0.5}
              fill={c.fill} opacity={c.opacity}
            />
          );
        })}

        {/* Strata lines in drilled zone */}
        <g opacity="0.2" stroke={dark ? "#e8d9b8" : "#8a7d6b"} strokeWidth="0.4" fill="none">
          {[4, 8, 12, 16].filter(z => z < drillDepth).map((z) => (
            <line key={z}
              x1={tubeX} y1={tubeY + z * bandH}
              x2={tubeX + tubeW} y2={tubeY + z * bandH}
            />
          ))}
        </g>

        {/* Unknown zone — hatched pattern */}
        {drillDepth < DEPTH_Z && (
          <>
            <rect
              x={tubeX} y={tubeY + drilledH}
              width={tubeW} height={tubeH - drilledH}
              fill={unknownFill}
            />
            <rect
              x={tubeX} y={tubeY + drilledH}
              width={tubeW} height={tubeH - drilledH}
              fill="url(#unknown-hatch)"
            />
          </>
        )}

        {/* Drill boundary line */}
        {drillDepth > 0 && drillDepth < DEPTH_Z && (
          <line
            x1={tubeX} y1={tubeY + drilledH}
            x2={tubeX + tubeW} y2={tubeY + drilledH}
            stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="1.5" opacity="0.7"
          />
        )}
      </g>

      {/* Tube outline */}
      <rect
        x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={8}
        fill="none" stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="0.8" opacity="0.5"
      />

      {/* Glass highlight */}
      <rect
        x={tubeX + 3} y={tubeY + 4} width={5} height={tubeH - 8} rx={2.5}
        fill={dark ? "rgba(232,217,184,0.06)" : "rgba(255,255,255,0.15)"}
      />

      {/* Depth ticks — LEFT */}
      <g fontFamily='"Share Tech Mono", monospace' fontSize="9"
         fill={dark ? "rgba(212,168,84,0.55)" : "rgba(139,115,85,0.6)"} letterSpacing="0.05em">
        {[0, 5, 10, 15, 19].map((z) => {
          const yPos = tubeY + z * bandH + bandH * 0.5;
          const isDrilled = z < drillDepth;
          return (
            <g key={z} opacity={isDrilled ? 1 : 0.35}>
              <line
                x1={tubeX - 5} y1={yPos}
                x2={tubeX} y2={yPos}
                stroke={dark ? "rgba(212,168,84,0.3)" : "rgba(139,115,85,0.3)"}
                strokeWidth="0.6"
              />
              <text x={tubeX - 8} y={yPos + 3} textAnchor="end">
                {z + 1}
              </text>
            </g>
          );
        })}
      </g>

      {/* RIGHT side — callouts for drilled zone */}
      <g fontFamily='"Share Tech Mono", monospace' letterSpacing="0.08em">
        {/* Drill depth marker */}
        {drillDepth > 0 && drillDepth < DEPTH_Z && (
          <>
            <line
              x1={tubeX + tubeW} y1={tubeY + drilledH}
              x2={tubeX + tubeW + 14} y2={tubeY + drilledH}
              stroke={dark ? "#d4a854" : "#b8922e"} strokeWidth="0.8" opacity="0.6"
            />
            <text
              x={tubeX + tubeW + 18} y={tubeY + drilledH + 3}
              fontSize="9" fill={dark ? "#d4a854" : "#b8922e"} letterSpacing="0.1em"
            >
              DRILL HEAD
            </text>
            <text
              x={tubeX + tubeW + 18} y={tubeY + drilledH + 14}
              fontSize="8" fill={dark ? "#6a7888" : "#8b7d6b"}
            >
              LV {drillDepth}/{DEPTH_Z}
            </text>
          </>
        )}

        {/* Unknown zone label */}
        {drillDepth < DEPTH_Z && (
          <text
            x={tubeX + tubeW + 18}
            y={tubeY + drilledH + (tubeH - drilledH) / 2 + 3}
            fontSize="8" fill={dark ? "#3a4454" : "#b8b0a4"} letterSpacing="0.15em"
          >
            UNCHARTED
          </text>
        )}

        {/* Hell pocket markers */}
        {hellDepths.filter(z => z < drillDepth).map((z) => {
          const cy = tubeY + z * bandH + bandH * 0.5;
          return (
            <g key={`hell-${z}`}>
              <rect
                x={tubeX} y={tubeY + z * bandH}
                width={tubeW} height={bandH + 0.5}
                fill="#cc1100" opacity="0.35"
                clipPath="url(#personal-clip)"
              />
              <g filter="url(#personal-glow)">
                <circle cx={tubeX + tubeW * 0.5} cy={cy} r="3" fill="#ff2200">
                  <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="r" values="3;5;3" dur="0.8s" repeatCount="indefinite" />
                </circle>
              </g>
              <line
                x1={tubeX + tubeW} y1={cy}
                x2={tubeX + tubeW + 14} y2={cy}
                stroke="#ff2200" strokeWidth="0.6" opacity="0.7"
              />
              <text
                x={tubeX + tubeW + 18} y={cy + 3}
                fontSize="8" fill="#ff2200" letterSpacing="0.1em"
                fontFamily='"Share Tech Mono", monospace'
                style={{ filter: "drop-shadow(0 0 3px rgba(255,34,0,0.6))" }}
              >
                DEMONIC FORCE
              </text>
            </g>
          );
        })}

        {/* Best find marker */}
        {bestDrilledZ >= 0 && bestVal > 0 && (
          (() => {
            const cy = tubeY + bestDrilledZ * bandH + bandH * 0.5;
            const tier = classifyDensity(bestVal, maxOil);
            if (tier < 3) return null;
            return (
              <>
                <g filter="url(#personal-glow)">
                  <circle cx={tubeX + tubeW * 0.5} cy={cy} r="3" fill="#e87a2b">
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="r" values="3;4.2;3" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                </g>
                <line
                  x1={tubeX + tubeW} y1={cy}
                  x2={tubeX + tubeW + 14} y2={cy}
                  stroke="#e87a2b" strokeWidth="0.6" opacity="0.5"
                />
                <text
                  x={tubeX + tubeW + 18} y={cy + 3}
                  fontSize="9" fill="#e87a2b" letterSpacing="0.12em"
                  style={{ filter: "drop-shadow(0 0 2px rgba(232,122,43,0.5))" }}
                >
                  {colors[tier].label}
                </text>
              </>
            );
          })()
        )}
      </g>
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
  defaultExpanded = false,
  gridX = 10,
  gridY = 10,
  selectedX = null,
  selectedY = null,
  drillDepth = 0,
  hellPockets = [],
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [coreTab, setCoreTab] = useState("field");
  const [analysisState, setAnalysisState] = useState("idle");
  const [revealRatio, setRevealRatio] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);

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

  // Depth profile = PEAK density per depth (richest cell at each level), NOT the
  // field average. Deposits are sparse — a few cells each — so averaging across
  // all 100 plots dilutes every deposit but the single richest into nothing,
  // collapsing the survey to one band. Peak-per-depth registers each deposit's
  // core, so the profile shows oil at every level it actually exists (matching
  // the 3D). (Name kept `avgColumn` so downstream rendering is unchanged.)
  const { avgColumn, maxAvg, peakDepth } = useMemo(() => {
    if (!grid3D) return { avgColumn: [], maxAvg: 0, peakDepth: -1 };
    const col = new Array(DEPTH_Z).fill(0);
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        for (let z = 0; z < DEPTH_Z; z++) {
          const v = grid3D[x]?.[y]?.[z] ?? 0;
          if (v > col[z]) col[z] = v;
        }
      }
    }
    let mx = 0;
    let peak = -1;
    for (let z = 0; z < DEPTH_Z; z++) {
      if (col[z] > mx) { mx = col[z]; peak = z; }
    }
    return { avgColumn: col, maxAvg: mx, peakDepth: peak };
  }, [grid3D, gridX, gridY]);

  const runAnalysis = useCallback(() => {
    if (analysisState === "running") return;
    setAnalysisState("running");
    setRevealRatio(0);
    startRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / REVEAL_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setRevealRatio(eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setAnalysisState("complete");
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [analysisState]);

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

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

  const hasClaim = selectedX !== null && selectedY !== null && drillDepth > 0;

  if (!grid3D || avgColumn.length === 0) return null;

  const tabStyle = (active) => ({
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10, fontWeight: active ? 600 : 400,
    letterSpacing: "0.12em",
    color: active ? c.accent : c.muted,
    background: "none",
    border: "none",
    borderBottom: active ? `2px solid ${c.accent}` : "2px solid transparent",
    padding: "4px 10px",
    cursor: "pointer",
    textTransform: "uppercase",
  });

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
          {/* Sub-tabs */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 4,
            marginBottom: 10,
            borderBottom: `1px solid ${dark ? "#2a2e36" : "#d4c8b4"}`,
            paddingBottom: 6,
          }}>
            <button style={tabStyle(coreTab === "field")} onClick={() => setCoreTab("field")}>
              FIELD SURVEY
            </button>
            <button style={tabStyle(coreTab === "personal")} onClick={() => setCoreTab("personal")}>
              YOUR CLAIM
            </button>
          </div>

          {coreTab === "personal" && (
            hasClaim && personalColumn ? (
              <div>
                <div style={{
                  fontSize: 10, color: c.muted, letterSpacing: "0.1em",
                  fontFamily: "'Share Tech Mono', monospace",
                  textAlign: "center", marginBottom: 8, lineHeight: 1.5,
                }}>
                  PLOT ({selectedX}, {selectedY}) — DRILL LOG
                </div>
                <PersonalCoreTube
                  column={personalColumn}
                  maxOil={maxOil}
                  drillDepth={drillDepth}
                  dark={dark}
                  hellDepths={hellDepthsForPlot}
                  parabolum={parabolum}
                />
                <Legend dark={dark} parabolum={parabolum} />
                <div style={{
                  fontSize: 9, color: dark ? "#5a6878" : "#908878",
                  fontFamily: "'Share Tech Mono', monospace",
                  textAlign: "center", marginTop: 8,
                  letterSpacing: "0.06em", lineHeight: 1.5,
                }}>
                  {drillDepth < DEPTH_Z
                    ? `${DEPTH_Z - drillDepth} layers remain. Keep drilling.`
                    : "Full depth reached."}
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: "center", padding: "20px 10px",
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>⛏️</div>
                <div style={{
                  fontSize: 10, color: c.muted, letterSpacing: "0.1em", lineHeight: 1.6,
                }}>
                  {selectedX === null
                    ? "Select a claim to see your drill log."
                    : "Start drilling to build your core sample."}
                </div>
              </div>
            )
          )}

          {coreTab === "field" && (
            <>
              <div style={{
                fontSize: 10, color: c.muted, letterSpacing: "0.1em",
                fontFamily: "'Share Tech Mono', monospace",
                textAlign: "center", marginBottom: 8, lineHeight: 1.5,
              }}>
                COMPOSITE FIELD SURVEY
                <br />
                DEPTH LEVELS 1–{DEPTH_Z}
              </div>

          {analysisState === "idle" ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
              <button
                onClick={runAnalysis}
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.18em",
                  color: dark ? "#d4a854" : "#5a4010",
                  background: c.btnBg,
                  border: `1.5px solid ${c.btnBorder}`,
                  borderRadius: 3,
                  padding: "10px 24px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = c.btnBgHover}
                onMouseLeave={(e) => e.currentTarget.style.background = c.btnBg}
              >
                RUN CORE ANALYSIS
              </button>
            </div>
          ) : (
            <>
              <CompositeCoreTube
                avgColumn={avgColumn}
                maxAvg={maxAvg}
                peakDepth={peakDepth}
                dark={dark}
                revealRatio={revealRatio}
                parabolum={parabolum}
              />

              {analysisState === "running" && (
                <div style={{
                  fontSize: 10, color: c.accent, letterSpacing: "0.15em",
                  fontFamily: "'Share Tech Mono', monospace",
                  textAlign: "center", marginTop: 4,
                }}>
                  ANALYZING... {Math.round(revealRatio * 100)}%
                </div>
              )}

              {analysisState === "complete" && (
                <>
                  <Legend dark={dark} parabolum={parabolum} />
                  <div style={{
                    fontSize: 9, color: dark ? "#5a6878" : "#908878",
                    fontFamily: "'Share Tech Mono', monospace",
                    textAlign: "center", marginTop: 8,
                    letterSpacing: "0.06em", lineHeight: 1.5,
                  }}>
                    Average density across all {gridX * gridY} plots.
                    <br />
                    Deeper strata tend to hold richer deposits.
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                    <button
                      onClick={() => {
                        setAnalysisState("idle");
                        setRevealRatio(0);
                      }}
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: 10, letterSpacing: "0.12em",
                        color: c.muted,
                        background: "none",
                        border: `1px solid ${dark ? "#2a2e36" : "#d4c8b4"}`,
                        borderRadius: 3,
                        padding: "6px 14px",
                        cursor: "pointer",
                      }}
                    >
                      RE-RUN ANALYSIS
                    </button>
                  </div>
                </>
              )}
            </>
            )}
          </>
          )}
        </div>
      )}
    </div>
  );
}
