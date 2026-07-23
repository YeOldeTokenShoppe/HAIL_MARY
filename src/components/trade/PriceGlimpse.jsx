"use client";
import React, { useMemo } from "react";
import { CASE_SIGNALS } from "@/game/terminal-traders/caseSignals";

// The prospect's price action — the T/A lens (playtest 2026-07-22: "the
// player could opt to skip a deep dive and just start doing T/A").
//
// HONESTY RULE (§3.3 applied to charts): the shape is keyed to the case's
// ground truth, so reading it is real — and really incomplete:
//   · parabolic ramp   = the classic exit-liquidity silhouette (PROPHET)
//   · scary chop + dip = a drawdown that can hide a solid book (HARBORLIGHT)
//   · clean steady grind = the healthiest chart in the deck... belongs to
//     the sophisticated rug (MERIDIAN). The chart can't see a proxy admin.
// Seeded per case id — same prospect, same tape, every visit.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeries(caseData) {
  const sig = CASE_SIGNALS[caseData?.id];
  const ch = parseFloat(String(caseData?.surfaceMetrics?.change24h || "0").replace(/[+%]/g, "")) || 0;
  let h = 0;
  for (const c of String(caseData?.id || "x")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rand = mulberry(h ^ 0x9e3779b9);
  const shape = !sig ? (ch >= 0 ? "grind" : "chop")
    : sig.truth === 1 && ch > 50 ? "parabolic"
    : sig.truth === 1 ? "grind"
    : ch < 0 ? "chop" : "grind";
  const pts = [];
  let p = 1;
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const drift = shape === "parabolic" ? 0.002 + 0.13 * t * t
      : shape === "chop" ? (i === 21 ? -0.17 : i === 12 ? -0.07 : 0.006)
      : 0.006;
    const vol = shape === "chop" ? 0.045 : shape === "parabolic" ? 0.028 : 0.016;
    p *= Math.max(0.2, 1 + drift + vol * (rand() * 2 - 1));
    pts.push(p);
  }
  return pts;
}

export default function PriceGlimpse({ caseData, height = 46 }) {
  const pts = useMemo(() => buildSeries(caseData), [caseData]);
  const min = Math.min(...pts), max = Math.max(...pts);
  const up = pts[pts.length - 1] >= pts[0];
  const color = up ? "#4dffaa" : "#ff6b6b";
  const W = 100, H = 100;
  const path = pts
    .map((p, i) => `${(i / (pts.length - 1)) * W},${H - ((p - min) / (max - min || 1)) * (H - 8) - 4}`)
    .join(" ");
  return (
    <div style={{
      border: "1px solid rgba(47,214,214,0.28)", background: "#04140f",
      padding: "7px 9px 5px", fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#2fd6d6", opacity: 0.7, marginBottom: 3 }}>
        PRICE ACTION · 30D
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height }}>
        <polyline
          points={path}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
    </div>
  );
}
