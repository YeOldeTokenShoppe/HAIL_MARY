"use client";

const DEPTH_Z = 20;

function getOilColor(value, maxValue, dark) {
  if (value === 0) return dark ? "#1e1e26" : "#ede6da";
  const t = Math.min(value / maxValue, 1);
  if (dark) {
    if (t < 0.15) {
      const p = t / 0.15;
      return `rgb(${Math.round(45 + p * 30)}, ${Math.round(48 + p * 25)}, ${Math.round(38 + p * 15)})`;
    }
    if (t < 0.35) {
      const p = (t - 0.15) / 0.2;
      return `rgb(${Math.round(75 + p * 50)}, ${Math.round(73 + p * 30)}, ${Math.round(53 + p * 15)})`;
    }
    if (t < 0.6) {
      const p = (t - 0.35) / 0.25;
      return `rgb(${Math.round(125 + p * 40)}, ${Math.round(103 + p * 25)}, ${Math.round(68 + p * 15)})`;
    }
    if (t < 0.8) {
      const p = (t - 0.6) / 0.2;
      return `rgb(${Math.round(165 + p * 30)}, ${Math.round(128 + p * 20)}, ${Math.round(83 + p * 10)})`;
    }
    const p = (t - 0.8) / 0.2;
    return `rgb(${Math.round(195 + p * 25)}, ${Math.round(148 + p * 20)}, ${Math.round(93 + p * 12)})`;
  }
  if (t < 0.15) {
    const p = t / 0.15;
    return `rgb(${Math.round(220 - p * 20)}, ${Math.round(210 - p * 25)}, ${Math.round(190 - p * 30)})`;
  }
  if (t < 0.35) {
    const p = (t - 0.15) / 0.2;
    return `rgb(${Math.round(200 - p * 50)}, ${Math.round(185 - p * 60)}, ${Math.round(160 - p * 70)})`;
  }
  if (t < 0.6) {
    const p = (t - 0.35) / 0.25;
    return `rgb(${Math.round(150 - p * 30)}, ${Math.round(125 - p * 40)}, ${Math.round(90 - p * 30)})`;
  }
  if (t < 0.8) {
    const p = (t - 0.6) / 0.2;
    return `rgb(${Math.round(120 - p * 30)}, ${Math.round(85 - p * 25)}, ${Math.round(60 - p * 20)})`;
  }
  const p = (t - 0.8) / 0.2;
  return `rgb(${Math.round(90 - p * 30)}, ${Math.round(60 - p * 20)}, ${Math.round(40 - p * 15)})`;
}

export default function OilCrossSection({
  grid3D,
  maxCellValue,
  sliceY,
  selectedX,
  drillDepth,
  onSelectX,
  onSliceY,
  theme,
  gridX = 10,
  gridY = 10,
}) {
  const dark = theme?.bg === "#12161c";
  const t = theme || { text: "#5a4e3e", muted: "#9e8e78", inputBg: "#f0e8dc", borderLight: "#c8bfb0", accent: "#7a5a1a", gold: "#d4a854", goldBorder: "#b8922e", textStrong: "#3e2e10", inspectorKey: "#8b7d6b", seedLabel: "#8b7355" };

  return (
    <div style={{ fontFamily: "'Share Tech Mono', 'Courier New', monospace", color: t.text }}>
      <div style={{
        fontSize: 9, color: t.inspectorKey || t.muted, marginBottom: 6,
        textAlign: "center", letterSpacing: "0.08em",
      }}>
        CROSS-SECTION &mdash; Row Y={sliceY}, looking across X
      </div>

      {/* Y-Slice Selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, justifyContent: "center" }}>
        <span style={{ fontSize: 9, color: t.seedLabel || t.muted, letterSpacing: "0.15em", flexShrink: 0 }}>Y</span>
        <div style={{ display: "flex", gap: 2 }}>
          {Array.from({ length: gridY }, (_, y) => (
            <button
              key={y}
              onClick={() => onSliceY(y)}
              style={{
                width: 22, height: 20,
                background: sliceY === y ? t.gold : t.inputBg,
                border: `1px solid ${sliceY === y ? t.goldBorder : t.borderLight}`,
                borderRadius: 2,
                color: sliceY === y ? t.textStrong : (t.inspectorKey || t.muted),
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 9,
                cursor: "pointer",
                transition: "all 0.15s",
                padding: 0,
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        position: "relative",
        border: `1px solid ${t.borderLight}`,
        background: t.inputBg,
        marginLeft: 28,
      }}>
        <div style={{
          position: "absolute", left: -28, top: 0, height: "100%",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "4px 0",
        }}>
          {[1, 5, 10, 15, 20].map(d => (
            <div key={d} style={{ fontSize: 7, color: t.muted, lineHeight: 1 }}>D{d}</div>
          ))}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          gridTemplateRows: `repeat(${DEPTH_Z}, 1fr)`,
          height: 280,
          cursor: "crosshair",
          gap: dark ? "0 1px" : 0,
          background: dark ? "#333" : "transparent",
        }}>
          {Array.from({ length: DEPTH_Z }, (_, z) =>
            Array.from({ length: gridX }, (_, x) => {
              const value = grid3D[x][sliceY][z];
              const isSelected = x === selectedX;
              const isDrilledCell = isSelected && z < drillDepth;
              const selectBorder = dark ? "#d4a854" : "#8b6914";
              // Tint selected column so it's visible even when all values are 0
              const baseBg = getOilColor(value, maxCellValue, dark);
              const selectedTint = isSelected && value === 0
                ? (dark ? "rgba(212,168,84,0.08)" : "rgba(139,105,20,0.06)")
                : baseBg;
              return (
                <div
                  key={`${x}-${z}`}
                  onClick={() => onSelectX(x)}
                  style={{
                    background: value === 0 && isSelected ? selectedTint : baseBg,
                    borderLeft: isSelected ? `2px solid ${selectBorder}` : "none",
                    borderRight: isSelected ? `2px solid ${selectBorder}` : "none",
                    borderTop: isSelected && z === 0 ? `2px solid ${selectBorder}` : "none",
                    borderBottom: isSelected && z === DEPTH_Z - 1 ? `2px solid ${selectBorder}` : "none",
                    position: "relative",
                    boxSizing: "border-box",
                  }}
                >
                  {isDrilledCell && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${dark ? "rgba(212,168,84,0.3)" : "rgba(139,105,20,0.25)"} 2px, ${dark ? "rgba(212,168,84,0.3)" : "rgba(139,105,20,0.25)"} 4px)`,
                    }} />
                  )}
                  {isSelected && z === drillDepth && drillDepth > 0 && drillDepth < DEPTH_Z && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      color: selectBorder,
                      fontSize: "8px",
                      lineHeight: 1,
                    }}>V</div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          padding: "3px 0", fontSize: 7, color: t.muted, textAlign: "center",
        }}>
          {Array.from({ length: gridX }, (_, x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div style={{
          fontSize: 7, color: t.muted, textAlign: "center",
          letterSpacing: "0.1em", paddingBottom: 2,
        }}>X position &rarr;</div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, marginTop: 6, fontSize: 7, color: t.inspectorKey || t.muted,
        letterSpacing: "0.1em",
      }}>
        <span>DRY</span>
        <div style={{ display: "flex", height: 6, width: 120, borderRadius: 1, overflow: "hidden" }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{
              flex: 1,
              background: getOilColor((i / 30) * maxCellValue, maxCellValue, dark),
            }} />
          ))}
        </div>
        <span>GUSHER</span>
      </div>
    </div>
  );
}
