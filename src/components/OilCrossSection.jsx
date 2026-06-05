"use client";

const DEPTH_Z = 20;

// Paraboleum — neutral rock when empty, iridescent opal cyan where the substance
// is present (richer = brighter cyan in dark, deeper teal in light). Matches the
// cyan gusher beam + tank liquid.
function getOilColor(value, maxValue, dark) {
  const t = Math.min(value / maxValue, 1);
  if (dark) {
    if (value === 0) return "#101e22";
    if (t < 0.15) { const p = t / 0.15; return `rgb(${Math.round(32 + p * 12)}, ${Math.round(64 + p * 34)}, ${Math.round(72 + p * 36)})`; }
    if (t < 0.35) { const p = (t - 0.15) / 0.2; return `rgb(${Math.round(44 - p * 4)}, ${Math.round(98 + p * 60)}, ${Math.round(108 + p * 55)})`; }
    if (t < 0.6)  { const p = (t - 0.35) / 0.25; return `rgb(${Math.round(43)}, ${Math.round(158 + p * 70)}, ${Math.round(168 + p * 55)})`; }
    if (t < 0.8)  { const p = (t - 0.6) / 0.2; return `rgb(${Math.round(46 + p * 44)}, ${Math.round(228 + p * 27)}, ${Math.round(222 + p * 30)})`; }
    const p = (t - 0.8) / 0.2; return `rgb(${Math.round(92 + p * 28)}, ${Math.round(244 + p * 11)}, ${Math.round(240 + p * 15)})`;
  }
  if (value === 0) return "#dfe9ea";
  if (t < 0.15) { const p = t / 0.15; return `rgb(${Math.round(208 - p * 48)}, ${Math.round(222 - p * 26)}, ${Math.round(226 - p * 28)})`; }
  if (t < 0.35) { const p = (t - 0.15) / 0.2; return `rgb(${Math.round(160 - p * 72)}, ${Math.round(196 - p * 22)}, ${Math.round(198 - p * 30)})`; }
  if (t < 0.6)  { const p = (t - 0.35) / 0.25; return `rgb(${Math.round(88 - p * 54)}, ${Math.round(174 - p * 20)}, ${Math.round(168 - p * 24)})`; }
  if (t < 0.8)  { const p = (t - 0.6) / 0.2; return `rgb(${Math.round(34 - p * 12)}, ${Math.round(154 - p * 40)}, ${Math.round(144 - p * 38)})`; }
  const p = (t - 0.8) / 0.2; return `rgb(${Math.round(22 - p * 8)}, ${Math.round(114 - p * 30)}, ${Math.round(106 - p * 30)})`;
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
  parabolum = false,
  // When true (desktop side-by-side column), the grid flexes to fill the
  // available height instead of a fixed 280px — so it never gets clipped by a
  // short column. Mobile (tabbed) keeps the fixed height.
  fillHeight = false,
}) {
  // Dark-theme bgs: dark (#12161c), parabolumDark (#0c0717), hud (#0f141c).
  const dark = theme?.bg === "#12161c" || theme?.bg === "#0c0717" || theme?.bg === "#0f141c";
  const t = theme || { text: "#5a4e3e", muted: "#9e8e78", inputBg: "#f0e8dc", borderLight: "#c8bfb0", accent: "#7a5a1a", gold: "#d4a854", goldBorder: "#b8922e", textStrong: "#3e2e10", inspectorKey: "#8b7d6b", seedLabel: "#8b7355" };

  return (
    <div style={{ fontFamily: "'Share Tech Mono', 'Courier New', monospace", color: t.text, ...(fillHeight ? { height: "100%", display: "flex", flexDirection: "column", minHeight: 0 } : {}) }}>
      <div style={{
        fontSize: 9, color: t.inspectorKey || t.muted, marginBottom: 6,
        textAlign: "center", letterSpacing: "0.08em",
      }}>
        CROSS-SECTION &mdash; {selectedX !== null ? `Plot (${selectedX + 1}, ${sliceY + 1}) · ` : ""}Row {sliceY + 1} slice (X across, depth down)
      </div>

      {/* Row (Y) slice picker — each button selects which row of the field to
          slice through. marginLeft 28 matches the cross-section below so the
          buttons line up over their columns; the active row uses the same green
          as the selected column. */}
      <div style={{ position: "relative", marginLeft: 28, marginBottom: 6 }}>
        <span style={{
          position: "absolute", left: -28, top: "50%", transform: "translateY(-50%)",
          fontSize: 8, color: t.seedLabel || t.muted, letterSpacing: "0.04em",
        }}>ROW</span>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridY}, 1fr)`, gap: 2 }}>
          {Array.from({ length: gridY }, (_, y) => {
            const sel = sliceY === y;
            return (
              <button
                key={y}
                onClick={() => onSliceY(y)}
                title={`Slice through row ${y + 1}`}
                style={{
                  height: 20,
                  background: sel ? (t.green || "#2f8f8f") : t.inputBg,
                  border: `1px solid ${sel ? (t.green || "#2f8f8f") : t.borderLight}`,
                  borderRadius: 2,
                  color: sel ? t.textStrong : (t.inspectorKey || t.muted),
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  padding: 0,
                }}
              >
                {y + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        position: "relative",
        border: `1px solid ${t.borderLight}`,
        background: t.mapBg || t.inputBg,
        marginLeft: 28,
        ...(fillHeight ? { flex: 1, minHeight: 120 } : {}),
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
          height: fillHeight ? "100%" : 280,
          minHeight: 0,
          cursor: "crosshair",
          gap: dark ? "0 1px" : 0,
          background: dark ? "#333" : "transparent",
        }}>
          {Array.from({ length: DEPTH_Z }, (_, z) =>
            Array.from({ length: gridX }, (_, x) => {
              const value = grid3D[x][sliceY][z];
              const isSelected = x === selectedX;
              const isDrilledCell = isSelected && z < drillDepth;
              // Match the surface-view selection highlight (green) so the two
              // views read as the same selection.
              const selectBorder = t.green || "#2f8f8f";
              // Tint selected column so it's visible even when all values are 0
              const baseBg = (value === 0 && t.mapEmpty)
                ? t.mapEmpty
                : getOilColor(value, maxCellValue, dark, parabolum);
              const selectedTint = isSelected && value === 0
                ? (t.selectOverlay || (dark ? "rgba(122,170,90,0.1)" : "rgba(90,138,58,0.1)"))
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
                  {isSelected && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: t.selectOverlay || (dark ? "rgba(122,170,90,0.18)" : "rgba(90,138,58,0.16)"),
                      pointerEvents: "none",
                    }} />
                  )}
                  {isDrilledCell && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${t.selectHatch || (dark ? "rgba(122,170,90,0.35)" : "rgba(90,138,58,0.3)")} 2px, ${t.selectHatch || (dark ? "rgba(122,170,90,0.35)" : "rgba(90,138,58,0.3)")} 4px)`,
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
      </div>

      {/* X-axis labels + position — moved OUTSIDE the bordered grid box so the
          fill-height grid can take 100% of the box without overlapping them.
          marginLeft 28 matches the box's offset (for the depth labels). */}
      <div style={{ marginLeft: 28 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          padding: "3px 0", fontSize: 7, color: t.muted, textAlign: "center",
        }}>
          {Array.from({ length: gridX }, (_, x) => (
            <span key={x}>{x + 1}</span>
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
              background: getOilColor((i / 30) * maxCellValue, maxCellValue, dark, parabolum),
            }} />
          ))}
        </div>
        <span>GUSHER</span>
      </div>
    </div>
  );
}
