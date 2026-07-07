"use client";

import { useState, useMemo } from "react";
import {
  SPECIMENS, RELICS, MAP_PIECES, FRAGMENTS_PER_SPECIMEN,
} from "@/lib/artifactDistribution";

// THE MUSEUM — the player's artifact collection book (docs/artifact-expansion.md).
// Reads the flat oilDrills.artifacts inventory written by the strike-tick:
// amber_{specimenId}_{fragmentIndex}, relic_{relicId}, map_{pieceIndex}, cache.
// Duplicates level an item (count > 1), so counts are shown, never hidden.
// This is the game the 60% can win: progress here is guaranteed by placement,
// not by oil luck.

const mono = "'Share Tech Mono', monospace";

export default function MuseumPanel({
  inventory = {},
  artifactFinds = 0,
  darkMode = false,
  hud = false,
  isMobile = false,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const dark = darkMode;

  const c = hud ? {
    accent: "#6bc7d1", muted: "#7e94a6", sectionBorder: "rgba(107,199,209,0.18)",
  } : dark ? {
    accent: "#c79bff", muted: "#6a7888", sectionBorder: "#2a2e36",
  } : {
    accent: "#7a2dd6", muted: "#6e6050", sectionBorder: "#d4c8b4",
  };
  const amber = "#ffb84d";
  const gold = dark ? "#ffd27f" : "#c8861e";
  const dim = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";

  const { specimens, relics, mapPieces, hasCache, museumScore } = useMemo(() => {
    const specimens = SPECIMENS.map((s) => {
      const frags = Array.from({ length: FRAGMENTS_PER_SPECIMEN }, (_, f) =>
        inventory[`amber_${s.id}_${f}`] || 0);
      const distinct = frags.filter((n) => n > 0).length;
      return { ...s, frags, distinct, complete: distinct === FRAGMENTS_PER_SPECIMEN };
    });
    const relics = RELICS.map((r) => ({ ...r, count: inventory[`relic_${r.id}`] || 0 }));
    const mapPieces = Array.from({ length: MAP_PIECES }, (_, p) => inventory[`map_${p}`] || 0);
    const hasCache = (inventory.cache || 0) > 0;
    // Museum score: distinct items + dupes at half weight + completion bonuses.
    // Mirrors the phase-4 Curators leaderboard formula — keep the two in sync.
    let distinctCount = 0, dupes = 0;
    for (const k in inventory) {
      const n = inventory[k] || 0;
      if (n > 0) { distinctCount++; dupes += n - 1; }
    }
    const setBonus = specimens.filter((s) => s.complete).length * 10;
    const museumScore = distinctCount * 2 + Math.floor(dupes) + setBonus + (hasCache ? 25 : 0);
    return { specimens, relics, mapPieces, hasCache, museumScore };
  }, [inventory]);

  const anyFinds = artifactFinds > 0 || museumScore > 0;

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
          display: "flex", alignItems: "center", gap: 6, fontFamily: mono,
        }}>
          <span style={{ fontSize: 12 }}>🏺</span>
          ARTIFACTS
          {museumScore > 0 && (
            <span style={{ color: gold, letterSpacing: "0.08em" }}>· {museumScore} PTS</span>
          )}
        </h3>
        <span style={{ fontSize: 10, color: c.muted }}>{expanded ? "▴" : "▾"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, fontFamily: mono }}>
          {!anyFinds ? (
            <div style={{ textAlign: "center", padding: "14px 10px" }}>
              <span style={{ fontSize: 16, opacity: 0.5, marginRight: 8 }}>◆</span>
              <span style={{ fontSize: 10, color: c.muted, letterSpacing: "0.08em" }}>
                The drill turns up more than oil. Everything it finds lands here.
              </span>
            </div>
          ) : (
            <>
              {/* Saurian specimens — 6 distinct amber shards each */}
              <div style={{ fontSize: 8, color: c.muted, letterSpacing: "0.15em", marginBottom: 4 }}>
                SAURIAN SEQUENCING · AMBER
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", marginBottom: 10 }}>
                {specimens.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{
                      fontSize: 9, letterSpacing: "0.06em",
                      color: s.complete ? gold : s.distinct > 0 ? (dark ? "#c8d2dc" : "#3a3226") : c.muted,
                      opacity: s.distinct > 0 || s.complete ? 1 : 0.55,
                    }}>
                      {s.complete ? "✦ " : ""}{s.label}
                    </span>
                    <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      {s.frags.map((n, f) => (
                        <span key={f} title={n > 1 ? `fragment ${f + 1} ×${n}` : `fragment ${f + 1}`} style={{
                          width: 6, height: 6, transform: "rotate(45deg)",
                          background: n > 0 ? amber : "transparent",
                          border: `1px solid ${n > 0 ? amber : dim}`,
                          boxShadow: n > 1 ? `0 0 4px ${amber}` : "none",
                        }} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Relics */}
              <div style={{ fontSize: 8, color: c.muted, letterSpacing: "0.15em", marginBottom: 4 }}>
                BURIAL RELICS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", marginBottom: 10 }}>
                {relics.map((r) => (
                  <span key={r.id} style={{
                    fontSize: 9, letterSpacing: "0.05em",
                    color: r.count > 0 ? "#c79bff" : c.muted,
                    opacity: r.count > 0 ? 1 : 0.5,
                  }}>
                    {r.count > 0 ? "◆" : "◇"} {r.label}{r.count > 1 ? ` ×${r.count}` : ""}
                  </span>
                ))}
              </div>

              {/* Outlaw map + cache */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 8, color: c.muted, letterSpacing: "0.15em", marginBottom: 4 }}>
                    OUTLAW MAP
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {mapPieces.map((n, p) => (
                      <span key={p} style={{
                        width: 14, height: 18, borderRadius: 1,
                        border: `1px ${n > 0 ? "solid" : "dashed"} ${n > 0 ? gold : dim}`,
                        background: n > 0 ? `${gold}22` : "transparent",
                        fontSize: 8, color: n > 0 ? gold : c.muted,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>{p + 1}</span>
                    ))}
                  </div>
                </div>
                {hasCache && (
                  <span style={{
                    fontSize: 10, color: gold, letterSpacing: "0.1em",
                    textShadow: `0 0 10px ${gold}66`,
                  }}>
                    💰 CACHE RECOVERED
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
