"use client";

const GRID_X = 10;
const GRID_Y = 10;
const DEPTH_Z = 20;

function getOilColor(value, maxValue) {
  if (value === 0) return "#ede6da";
  const t = Math.min(value / maxValue, 1);
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
}) {
  return (
    <div style={s.root}>
      <div style={s.vizLabel}>
        CROSS-SECTION &mdash; Row Y={sliceY}, looking across X
      </div>

      {/* Y-Slice Selector */}
      <div style={s.sliceSelector}>
        <span style={s.sliceLabel}>Y</span>
        <div style={s.sliceButtons}>
          {Array.from({ length: GRID_Y }, (_, y) => (
            <button
              key={y}
              onClick={() => onSliceY(y)}
              style={{
                ...s.sliceBtn,
                ...(sliceY === y ? s.sliceBtnActive : {}),
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div style={s.heatmapWrap}>
        <div style={s.depthLabels}>
          {[1, 5, 10, 15, 20].map(d => (
            <div key={d} style={s.depthLabel}>D{d}</div>
          ))}
        </div>
        <div style={s.heatmapGrid}>
          {Array.from({ length: DEPTH_Z }, (_, z) =>
            Array.from({ length: GRID_X }, (_, x) => {
              const value = grid3D[x][sliceY][z];
              const isSelected = x === selectedX;
              const isDrilledCell = isSelected && z < drillDepth;
              return (
                <div
                  key={`${x}-${z}`}
                  onClick={() => onSelectX(x)}
                  style={{
                    background: getOilColor(value, maxCellValue),
                    borderLeft: isSelected ? "1px solid #8b6914" : "none",
                    borderRight: isSelected ? "1px solid #8b6914" : "none",
                    borderTop: isSelected && z === 0 ? "1px solid #8b6914" : "none",
                    borderBottom: isSelected && z === DEPTH_Z - 1 ? "1px solid #8b6914" : "none",
                    position: "relative",
                    boxSizing: "border-box",
                  }}
                >
                  {isDrilledCell && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(139,105,20,0.25) 2px, rgba(139,105,20,0.25) 4px)",
                    }} />
                  )}
                  {isSelected && z === drillDepth && drillDepth > 0 && drillDepth < DEPTH_Z && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      color: "#8b6914",
                      fontSize: "8px",
                      lineHeight: 1,
                    }}>V</div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div style={s.claimMarkers}>
          {Array.from({ length: GRID_X }, (_, x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div style={s.axisLabelX}>X position &rarr;</div>
      </div>

      {/* Legend */}
      <div style={s.legend}>
        <span>DRY</span>
        <div style={s.legendBar}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{
              flex: 1,
              background: getOilColor((i / 30) * maxCellValue, maxCellValue),
            }} />
          ))}
        </div>
        <span>GUSHER</span>
      </div>
    </div>
  );
}

const s = {
  root: {
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    color: "#5a4e3e",
  },
  vizLabel: {
    fontSize: 9,
    color: "#8b7d6b",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: "0.08em",
  },
  sliceSelector: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    justifyContent: "center",
  },
  sliceLabel: {
    fontSize: 9,
    color: "#8b7355",
    letterSpacing: "0.15em",
    flexShrink: 0,
  },
  sliceButtons: {
    display: "flex",
    gap: 2,
  },
  sliceBtn: {
    width: 22,
    height: 20,
    background: "#f0e8dc",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#8b7d6b",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9,
    cursor: "pointer",
    transition: "all 0.15s",
    padding: 0,
  },
  sliceBtnActive: {
    background: "#d4a854",
    border: "1px solid #b8922e",
    color: "#3e2e10",
  },
  heatmapWrap: {
    position: "relative",
    border: "1px solid #c8bfb0",
    background: "#f0e8dc",
    marginLeft: 28,
  },
  depthLabels: {
    position: "absolute",
    left: -28,
    top: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "4px 0",
  },
  depthLabel: {
    fontSize: 7,
    color: "#9e8e78",
    lineHeight: 1,
  },
  heatmapGrid: {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_X}, 1fr)`,
    gridTemplateRows: `repeat(${DEPTH_Z}, 1fr)`,
    height: 280,
    cursor: "crosshair",
  },
  claimMarkers: {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_X}, 1fr)`,
    padding: "3px 0",
    fontSize: 7,
    color: "#9e8e78",
    textAlign: "center",
  },
  axisLabelX: {
    fontSize: 7,
    color: "#9e8e78",
    textAlign: "center",
    letterSpacing: "0.1em",
    paddingBottom: 2,
  },
  legend: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
    fontSize: 7,
    color: "#8b7d6b",
    letterSpacing: "0.1em",
  },
  legendBar: {
    display: "flex",
    height: 6,
    width: 120,
    borderRadius: 1,
    overflow: "hidden",
  },
};
