"use client";

import React, { useState } from "react";
import { probabilityToVerdict } from "./GameOverlay";

// Player-facing leaning label for a given P(scam). The band boundaries line up
// with VERDICT_THRESHOLDS in GameOverlay (≤0.34 → believe bucket, ≥0.66 → doubt
// bucket, middle → abstain bucket) so the word the player reads matches the
// character reaction / vindication line they'll get.
function leaning(p) {
  if (p <= 0.15) return { word: "TRUST", color: "#8effc4" };
  if (p <= 0.34) return { word: "LEAN TRUST", color: "#7fe6b3" };
  if (p < 0.5)   return { word: "UNSURE", color: "#dcdce4" };
  if (p === 0.5) return { word: "ABSTAIN", color: "#dcdce4" };
  if (p < 0.66)  return { word: "UNSURE", color: "#f0c98a" };
  if (p < 0.85)  return { word: "LEAN DOUBT", color: "#ff8a8a" };
  return { word: "DOUBT", color: "#ff4d6d" };
}

// The verdict control for forensic (graded) cases. Instead of three discrete
// buttons it captures a calibrated probability that the project is a scam, so
// the Brier score can reward genuine confidence and punish overconfident wrong
// calls. The committed probability buckets to believe/abstain/doubt only for
// picking which line + glyph the scene plays back.
export default function ConfidenceVerdict({
  enabled,
  onCommit,        // (p: 0..1, bucket: "believe"|"abstain"|"doubt") => void
  isMobileView,
  disabledHint,
}) {
  const [pct, setPct] = useState(50); // 0..100, P(scam)
  const p = pct / 100;
  const lean = leaning(p);

  const commit = () => {
    if (!enabled) return;
    onCommit(p, probabilityToVerdict(p));
  };

  return (
    <div
      title={!enabled ? (disabledHint || "Investigate at least one station first") : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: isMobileView ? 8 : 12,
        height: 60,
        padding: "0 6px",
        opacity: enabled ? 1 : 0.45,
        pointerEvents: enabled ? "auto" : "none",
        minWidth: isMobileView ? 250 : 340,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 8, letterSpacing: "0.22em", color: "#3a6b54" }}>
            P(SCAM)
          </span>
          <span style={{ fontSize: 11, letterSpacing: "0.10em" }}>
            <span style={{ color: "#c8ffe0", fontWeight: 700 }}>{pct}%</span>
            <span style={{ color: lean.color, marginLeft: 8, fontWeight: 700 }}>
              {lean.word}
            </span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-label="Probability this project is a scam"
          className="cv-range"
          style={{
            width: "100%",
            // Green (legit) → grey (unsure) → red (scam). The fill is the whole
            // track; the thumb is styled via the injected stylesheet below.
            background:
              "linear-gradient(90deg, #2fae5a 0%, #4dffaa 18%, #6b7a72 50%, #ffb84d 70%, #ff4d6d 100%)",
          }}
        />
      </div>

      <button
        type="button"
        onClick={commit}
        disabled={!enabled}
        aria-label={`Render verdict: ${pct}% scam probability`}
        style={{
          flexShrink: 0,
          height: 44,
          padding: "0 16px",
          borderRadius: 10,
          background: enabled
            ? "linear-gradient(135deg, rgba(255,62,160,0.30), rgba(80,13,50,0.40))"
            : "rgba(20,30,40,0.45)",
          border: `1px solid ${enabled ? "rgba(255,142,196,0.85)" : "rgba(255,142,196,0.25)"}`,
          color: enabled ? "#ffe2f1" : "rgba(255,226,241,0.35)",
          fontFamily: "'Orbitron', monospace",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.16em",
          cursor: enabled ? "pointer" : "not-allowed",
          textShadow: enabled ? "0 0 10px rgba(255,142,196,0.5)" : "none",
          boxShadow: enabled
            ? "0 0 14px rgba(255,62,160,0.35), inset 0 1px 0 rgba(255,255,255,0.1)"
            : "none",
          whiteSpace: "nowrap",
        }}
      >
        ⌖ LOCK IN
      </button>

      <style>{`
        .cv-range {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 4px;
          outline: none;
          cursor: pointer;
        }
        .cv-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #050a07;
          border: 2px solid #c8ffe0;
          box-shadow: 0 0 8px rgba(200,255,224,0.7);
          cursor: grab;
        }
        .cv-range::-webkit-slider-thumb:active { cursor: grabbing; }
        .cv-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #050a07;
          border: 2px solid #c8ffe0;
          box-shadow: 0 0 8px rgba(200,255,224,0.7);
          cursor: grab;
        }
      `}</style>
    </div>
  );
}
