"use client";

function getSurfaceColor(value, maxValue) {
  if (value === 0) return "#e8e0d4";
  const t = Math.min(value / maxValue, 1);
  if (t < 0.3) return `rgb(${Math.round(210 - t * 80)}, ${Math.round(195 - t * 80)}, ${Math.round(170 - t * 80)})`;
  if (t < 0.6) return `rgb(${Math.round(186 - t * 60)}, ${Math.round(145 - t * 60)}, ${Math.round(100 - t * 40)})`;
  return `rgb(${Math.round(160 - t * 40)}, ${Math.round(105 - t * 30)}, ${Math.round(50 - t * 10)})`;
}

export default function OilSurfaceMap({ claimTotals, maxClaimTotal, selectedClaimIndex, onSelectClaim }) {
  return (
    <div style={s.root}>
      <div style={s.vizLabel}>
        SURFACE VIEW &mdash; Total oil per claim
      </div>
      {/* X axis labels along top */}
      <div style={s.xLabels}>
        <div style={s.cornerLabel} />
        {Array.from({ length: 10 }, (_, x) => (
          <span key={x} style={s.axisNum}>{x}</span>
        ))}
      </div>
      <div style={s.gridWithY}>
        {/* Y axis labels */}
        <div style={s.yLabels}>
          {Array.from({ length: 10 }, (_, y) => (
            <span key={y} style={s.axisNum}>{y}</span>
          ))}
        </div>
        <div style={s.surfaceGrid}>
          {claimTotals.map((claim, i) => (
            <div
              key={i}
              onClick={() => onSelectClaim(claim)}
              style={{
                aspectRatio: "1",
                background: claim.index === selectedClaimIndex
                  ? "rgba(90, 138, 58, 0.7)"
                  : getSurfaceColor(claim.total, maxClaimTotal),
                border: claim.index === selectedClaimIndex ? "2px solid #5a8a3a" : "1px solid #c8bfb0",
                boxShadow: claim.index === selectedClaimIndex ? "0 0 8px rgba(90, 138, 58, 0.4)" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "9px",
                color: claim.total > 0 ? "#f5efe6" : "#a09888",
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
      <div style={s.axisLabelX}>X &rarr;</div>
      <div style={s.axisLabelY}>Y &darr;</div>
    </div>
  );
}

const s = {
  root: {
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    color: "#b0b0b0",
    position: "relative",
  },
  vizLabel: {
    fontSize: 9,
    color: "#8b7d6b",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: "0.08em",
  },
  xLabels: {
    display: "grid",
    gridTemplateColumns: "14px repeat(10, 1fr)",
    gap: 2,
    paddingLeft: 0,
    paddingRight: 8,
    marginBottom: 1,
  },
  cornerLabel: {
    width: 14,
  },
  yLabels: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    paddingTop: 8,
    paddingBottom: 8,
    width: 14,
    flexShrink: 0,
  },
  axisNum: {
    fontSize: 7,
    color: "#9e8e78",
    textAlign: "center",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  gridWithY: {
    display: "flex",
  },
  surfaceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(10, 1fr)",
    gap: 2,
    padding: 8,
    background: "#f0e8dc",
    border: "1px solid #c8bfb0",
    flex: 1,
  },
  axisLabelX: {
    fontSize: 7,
    color: "#9e8e78",
    textAlign: "center",
    letterSpacing: "0.1em",
    marginTop: 2,
    paddingLeft: 14,
  },
  axisLabelY: {
    position: "absolute",
    left: 1,
    top: "50%",
    fontSize: 7,
    color: "#9e8e78",
    letterSpacing: "0.1em",
  },
};
