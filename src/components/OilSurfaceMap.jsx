"use client";

function getSurfaceColor(value, maxValue, dark) {
  if (value === 0) return dark ? "#2a2a34" : "#e8e0d4";
  const t = Math.min(value / maxValue, 1);
  if (dark) {
    // Dark mode: dark teal → amber → bright gold
    if (t < 0.3) return `rgb(${Math.round(40 + t * 80)}, ${Math.round(50 + t * 60)}, ${Math.round(50 + t * 30)})`;
    if (t < 0.6) return `rgb(${Math.round(64 + t * 100)}, ${Math.round(68 + t * 60)}, ${Math.round(44 + t * 20)})`;
    return `rgb(${Math.round(120 + t * 60)}, ${Math.round(98 + t * 30)}, ${Math.round(40 + t * 10)})`;
  }
  if (t < 0.3) return `rgb(${Math.round(210 - t * 80)}, ${Math.round(195 - t * 80)}, ${Math.round(170 - t * 80)})`;
  if (t < 0.6) return `rgb(${Math.round(186 - t * 60)}, ${Math.round(145 - t * 60)}, ${Math.round(100 - t * 40)})`;
  return `rgb(${Math.round(160 - t * 40)}, ${Math.round(105 - t * 30)}, ${Math.round(50 - t * 10)})`;
}

export default function OilSurfaceMap({ claimTotals, maxClaimTotal, selectedClaimIndex, onSelectClaim, theme, gridX = 10, gridY = 10 }) {
  const dark = theme?.bg === "#12161c";
  const t = theme || { muted: "#9e8e78", inputBg: "#f0e8dc", borderLight: "#c8bfb0", green: "#5a8a3a", accent: "#7a5a1a" };

  return (
    <div style={{ fontFamily: "'Share Tech Mono', 'Courier New', monospace", color: t.muted, position: "relative" }}>
      <div style={{
        fontSize: 9, color: t.inspectorKey || t.muted, marginBottom: 8,
        textAlign: "center", letterSpacing: "0.08em",
      }}>
        SURFACE VIEW &mdash; Total oil per claim
      </div>
      {/* X axis labels along top */}
      <div style={{
        display: "grid", gridTemplateColumns: `14px repeat(${gridX}, 1fr)`,
        gap: 2, paddingRight: 8, marginBottom: 1,
      }}>
        <div style={{ width: 14 }} />
        {Array.from({ length: gridX }, (_, x) => (
          <span key={x} style={{
            fontSize: 7, color: t.muted, textAlign: "center", lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", flex: 1,
          }}>{x}</span>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        {/* Y axis labels */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 2,
          paddingTop: 8, paddingBottom: 8, width: 14, flexShrink: 0,
        }}>
          {Array.from({ length: gridY }, (_, y) => (
            <span key={y} style={{
              fontSize: 7, color: t.muted, textAlign: "center", lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center", flex: 1,
            }}>{y}</span>
          ))}
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          gap: 2, padding: 8,
          background: t.inputBg, border: `1px solid ${t.borderLight}`, flex: 1,
        }}>
          {claimTotals.map((claim, i) => (
            <div
              key={i}
              onClick={() => onSelectClaim(claim)}
              style={{
                aspectRatio: "1",
                background: claim.index === selectedClaimIndex
                  ? (dark ? "rgba(122,170,90,0.7)" : "rgba(90, 138, 58, 0.7)")
                  : getSurfaceColor(claim.total, maxClaimTotal, dark),
                border: claim.index === selectedClaimIndex ? `2px solid ${t.green}` : `1px solid ${t.borderLight}`,
                boxShadow: claim.index === selectedClaimIndex ? `0 0 8px rgba(90, 138, 58, 0.4)` : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "9px",
                color: claim.total > 0 ? (dark ? "#e8e0d4" : "#f5efe6") : t.muted,
                position: "relative",
                transition: "transform 0.15s",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{claim.index + 1}</div>
              {claim.total > 0 && (
                <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.7)", marginTop: "1px" }}>
                  {(claim.total / 1000).toFixed(1)}k
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{
        fontSize: 7, color: t.muted, textAlign: "center",
        letterSpacing: "0.1em", marginTop: 2, paddingLeft: 14,
      }}>X &rarr;</div>
      <div style={{
        position: "absolute", left: 1, top: "50%",
        fontSize: 7, color: t.muted, letterSpacing: "0.1em",
      }}>Y &darr;</div>
    </div>
  );
}
