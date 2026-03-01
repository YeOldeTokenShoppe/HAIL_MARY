"use client";

import { useState, useMemo, useCallback } from "react";
import { generateOilDistribution3D } from "@/lib/oilDistribution";

const GRID_X = 10;
const GRID_Y = 10;
const DEPTH_Z = 20;

function getOilColor(value, maxValue) {
  if (value === 0) return "#0a0a0f";
  const t = Math.min(value / maxValue, 1);
  if (t < 0.15) {
    const p = t / 0.15;
    return `rgb(${Math.round(15 + p * 25)}, ${Math.round(10 + p * 15)}, ${Math.round(15 + p * 20)})`;
  }
  if (t < 0.35) {
    const p = (t - 0.15) / 0.2;
    return `rgb(${Math.round(40 + p * 100)}, ${Math.round(25 + p * 20)}, ${Math.round(35 - p * 15)})`;
  }
  if (t < 0.6) {
    const p = (t - 0.35) / 0.25;
    return `rgb(${Math.round(140 + p * 80)}, ${Math.round(45 + p * 60)}, ${Math.round(20 + p * 10)})`;
  }
  if (t < 0.8) {
    const p = (t - 0.6) / 0.2;
    return `rgb(${Math.round(220 + p * 35)}, ${Math.round(105 + p * 100)}, ${Math.round(30 + p * 20)})`;
  }
  const p = (t - 0.8) / 0.2;
  return `rgb(${255}, ${Math.round(205 + p * 50)}, ${Math.round(50 + p * 150)})`;
}

function getSurfaceColor(value, maxValue) {
  if (value === 0) return "#1a1a2e";
  const t = Math.min(value / maxValue, 1);
  if (t < 0.3) return `rgba(139, 69, 19, ${0.3 + t})`;
  if (t < 0.6) return `rgba(180, 100, 30, ${0.5 + t * 0.5})`;
  return `rgba(220, 160, 40, ${0.7 + t * 0.3})`;
}

export default function OilHeatmap2D({ blockHash, numberOfDeposits = 8, totalOilBudget = 500000 }) {
  const [selectedX, setSelectedX] = useState(null);
  const [sliceY, setSliceY] = useState(0);
  const [drillDepth, setDrillDepth] = useState(0);
  const [isDrilling, setIsDrilling] = useState(false);
  const [view, setView] = useState("cross-section");

  // Use the same 3D distribution as OilVoxelGrid — keep the full 3D grid
  const { grid3D, deposits, maxCellValue, claimTotals, maxClaimTotal } = useMemo(() => {
    const { grid, deposits, maxOil } = generateOilDistribution3D({
      blockHash,
      gridX: GRID_X,
      gridY: GRID_Y,
      depthZ: DEPTH_Z,
      totalOilBudget,
      numberOfDeposits,
      depthBias: 0.35,
    });

    // Compute per-claim totals (claim = surface position x,y)
    const claimTotals = [];
    let maxClaimTotal = 0;
    for (let y = GRID_Y - 1; y >= 0; y--) {
      for (let x = 0; x < GRID_X; x++) {
        let sum = 0;
        for (let z = 0; z < DEPTH_Z; z++) sum += grid[x][y][z];
        claimTotals.push({ x, y, index: y * GRID_X + x, total: sum });
        if (sum > maxClaimTotal) maxClaimTotal = sum;
      }
    }

    return { grid3D: grid, deposits, maxCellValue: maxOil, claimTotals, maxClaimTotal };
  }, [blockHash, numberOfDeposits, totalOilBudget]);

  // Depth column for the selected claim at (selectedX, sliceY)
  const selectedDepthData = useMemo(() => {
    if (selectedX === null) return null;
    const col = [];
    for (let z = 0; z < DEPTH_Z; z++) col.push(grid3D[selectedX][sliceY][z]);
    return col;
  }, [grid3D, selectedX, sliceY]);

  const selectedClaimIndex = selectedX !== null ? sliceY * GRID_X + selectedX : null;

  const selectedData = useMemo(() => {
    if (selectedDepthData === null) return null;
    const total = selectedDepthData.reduce((a, b) => a + b, 0);
    return {
      total,
      extracted: selectedDepthData.slice(0, drillDepth).reduce((a, b) => a + b, 0),
      missed: selectedDepthData.slice(drillDepth).reduce((a, b) => a + b, 0),
      depthData: selectedDepthData,
      richestDepth: selectedDepthData.indexOf(Math.max(...selectedDepthData)),
    };
  }, [selectedDepthData, drillDepth]);

  const ranked = useMemo(() =>
    [...claimTotals].sort((a, b) => b.total - a.total),
    [claimTotals]
  );

  const handleDrill = useCallback(() => {
    if (selectedX === null || isDrilling) return;
    setIsDrilling(true);
    setDrillDepth(0);
    let depth = 0;
    const interval = setInterval(() => {
      depth++;
      setDrillDepth(depth);
      if (depth >= DEPTH_Z) {
        clearInterval(interval);
        setIsDrilling(false);
      }
    }, 200);
  }, [selectedX, isDrilling]);

  return (
    <div style={s.root}>
      {/* View Toggle */}
      <div style={s.viewToggle}>
        {["cross-section", "surface"].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              ...s.viewBtn,
              ...(view === v ? s.viewBtnActive : {}),
            }}
          >
            {v === "cross-section" ? "CROSS SECTION" : "SURFACE MAP"}
          </button>
        ))}
      </div>

      <div style={s.layout}>
        {/* Main Visualization */}
        <div style={s.vizWrap}>
          {view === "cross-section" ? (
            <div>
              <div style={s.vizLabel}>
                UNDERGROUND CROSS-SECTION — Y-slice through the 10&times;10 grid
              </div>

              {/* Y-Slice Selector */}
              <div style={s.sliceSelector}>
                <span style={s.sliceLabel}>Y SLICE</span>
                <div style={s.sliceButtons}>
                  {Array.from({ length: GRID_Y }, (_, y) => (
                    <button
                      key={y}
                      onClick={() => { setSliceY(y); setDrillDepth(0); }}
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
                          onClick={() => { setSelectedX(x); setDrillDepth(0); }}
                          style={{
                            background: getOilColor(value, maxCellValue),
                            borderLeft: isSelected ? "1px solid rgba(200,120,48,0.6)" : "none",
                            borderRight: isSelected ? "1px solid rgba(200,120,48,0.6)" : "none",
                            borderTop: isSelected && z === 0 ? "1px solid rgba(200,120,48,0.6)" : "none",
                            borderBottom: isSelected && z === DEPTH_Z - 1 ? "1px solid rgba(200,120,48,0.6)" : "none",
                            position: "relative",
                            boxSizing: "border-box",
                          }}
                        >
                          {isDrilledCell && (
                            <div style={{
                              position: "absolute",
                              inset: 0,
                              background: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(200,120,48,0.15) 2px, rgba(200,120,48,0.15) 4px)",
                            }} />
                          )}
                          {isSelected && z === drillDepth && drillDepth > 0 && drillDepth < DEPTH_Z && (
                            <div style={{
                              position: "absolute",
                              bottom: 0,
                              left: "50%",
                              transform: "translateX(-50%)",
                              color: "#c87830",
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
                    <span key={x}>X{x}</span>
                  ))}
                </div>
              </div>
              {/* Legend */}
              <div style={s.legend}>
                <span>DRY</span>
                <div style={s.legendBar}>
                  {Array.from({ length: 40 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1,
                      background: getOilColor((i / 40) * maxCellValue, maxCellValue),
                    }} />
                  ))}
                </div>
                <span>GUSHER</span>
              </div>
            </div>
          ) : (
            <div>
              <div style={s.vizLabel}>
                SURFACE VIEW — Total oil per claim (what drillers don&apos;t know)
              </div>
              <div style={s.surfaceGrid}>
                {claimTotals.map((claim, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedX(claim.x);
                      setSliceY(claim.y);
                      setDrillDepth(0);
                      setView("cross-section");
                    }}
                    style={{
                      aspectRatio: "1",
                      background: getSurfaceColor(claim.total, maxClaimTotal),
                      border: claim.index === selectedClaimIndex ? "2px solid #c87830" : "1px solid #1a1a2e",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "9px",
                      color: claim.total > 0 ? "#c87830" : "#333",
                      position: "relative",
                      transition: "transform 0.15s",
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>{claim.index + 1}</div>
                    {claim.total > 0 && (
                      <div style={{ fontSize: "7px", color: "#a08520", marginTop: "1px" }}>
                        {(claim.total / 1000).toFixed(1)}k
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div style={s.sidePanel}>
          {/* Claim Inspector */}
          <div style={s.panelBox}>
            <div style={s.panelLabel}>
              {selectedX !== null
                ? `CLAIM (${selectedX}, ${sliceY}) INSPECTOR`
                : "SELECT A CLAIM"}
            </div>

            {selectedData ? (
              <>
                <div style={s.inspectorStats}>
                  <div style={s.inspectorRow}>
                    <span style={s.inspectorKey}>Position:</span>
                    <span style={s.inspectorVal}>X{selectedX}, Y{sliceY}</span>
                  </div>
                  <div style={s.inspectorRow}>
                    <span style={s.inspectorKey}>Total Oil:</span>
                    <span style={s.inspectorVal}>{selectedData.total.toLocaleString()} RL80</span>
                  </div>
                  <div style={s.inspectorRow}>
                    <span style={s.inspectorKey}>Richest Depth:</span>
                    <span style={s.inspectorVal}>Level {selectedData.richestDepth + 1}</span>
                  </div>
                  <div style={s.inspectorRow}>
                    <span style={s.inspectorKey}>Rank:</span>
                    <span style={s.inspectorVal}>
                      #{ranked.findIndex(r => r.index === selectedClaimIndex) + 1} of {GRID_X * GRID_Y}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDrill}
                  disabled={isDrilling}
                  style={{
                    ...s.drillBtn,
                    ...(isDrilling ? s.drillBtnDisabled : {}),
                  }}
                >
                  {isDrilling ? `DRILLING... DEPTH ${drillDepth}` : drillDepth > 0 ? "DRILL AGAIN" : "START DRILLING"}
                </button>

                {drillDepth > 0 && (
                  <div style={s.drillResults}>
                    <div style={s.inspectorRow}>
                      <span style={s.inspectorKey}>Drilled to:</span>
                      <span style={s.inspectorVal}>Depth {drillDepth}</span>
                    </div>
                    <div style={s.inspectorRow}>
                      <span style={{ ...s.inspectorKey, color: "#4a4" }}>Extracted:</span>
                      <span style={{ ...s.inspectorVal, color: "#4a4" }}>
                        {selectedData.extracted.toLocaleString()} RL80
                      </span>
                    </div>
                    {drillDepth < DEPTH_Z && selectedData.missed > 0 && (
                      <div style={s.inspectorRow}>
                        <span style={{ ...s.inspectorKey, color: "#a44" }}>Underground:</span>
                        <span style={{ ...s.inspectorVal, color: "#a44" }}>
                          {selectedData.missed.toLocaleString()} RL80
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Depth Chart */}
                <div style={{ ...s.panelLabel, marginTop: 12, marginBottom: 6 }}>DEPTH PROFILE</div>
                <div style={s.depthChart}>
                  {selectedData.depthData.map((oil, d) => {
                    const barWidth = maxCellValue > 0 ? (oil / maxCellValue) * 100 : 0;
                    const drilled = d < drillDepth;
                    return (
                      <div key={d} style={s.depthRow}>
                        <span style={{
                          ...s.depthRowLabel,
                          color: drilled ? "#c87830" : "#444",
                        }}>
                          D{d + 1}
                        </span>
                        <div style={s.depthBarWrap}>
                          <div style={{
                            width: `${barWidth}%`,
                            height: "100%",
                            background: drilled
                              ? "linear-gradient(90deg, #c87830, #8b6914)"
                              : "linear-gradient(90deg, #3a2a0a, #2a1a05)",
                            transition: "all 0.3s",
                          }} />
                        </div>
                        <span style={{
                          ...s.depthRowVal,
                          color: drilled ? "#c87830" : "#555",
                        }}>
                          {oil > 0 ? oil.toLocaleString() : "\u2014"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={s.emptyState}>
                Click any column on the cross-section to inspect its depth profile
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div style={s.panelBox}>
            <div style={s.panelLabel}>RICHEST CLAIMS</div>
            {ranked.slice(0, 10).map((claim, rank) => (
              <div
                key={claim.index}
                onClick={() => {
                  setSelectedX(claim.x);
                  setSliceY(claim.y);
                  setDrillDepth(0);
                }}
                style={{
                  ...s.leaderRow,
                  background: claim.index === selectedClaimIndex ? "rgba(200,120,48,0.1)" : "transparent",
                  borderLeft: claim.index === selectedClaimIndex ? "2px solid #c87830" : "2px solid transparent",
                }}
              >
                <span>
                  <span style={{
                    color: rank < 3 ? "#c87830" : "#666",
                    marginRight: 6,
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 9,
                  }}>
                    #{rank + 1}
                  </span>
                  <span style={{ color: "#aaa" }}>({claim.x}, {claim.y})</span>
                </span>
                <span style={{ color: "#c87830", fontFamily: "'Orbitron', monospace", fontSize: 10 }}>
                  {claim.total.toLocaleString()}
                </span>
              </div>
            ))}

            <div style={{ ...s.panelLabel, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(200,120,48,0.08)" }}>
              DRIEST CLAIMS
            </div>
            {ranked.slice(-5).reverse().map((claim) => (
              <div
                key={claim.index}
                onClick={() => {
                  setSelectedX(claim.x);
                  setSliceY(claim.y);
                  setDrillDepth(0);
                }}
                style={{
                  ...s.leaderRow,
                  background: claim.index === selectedClaimIndex ? "rgba(200,120,48,0.1)" : "transparent",
                  borderLeft: claim.index === selectedClaimIndex ? "2px solid #c87830" : "2px solid transparent",
                }}
              >
                <span style={{ color: "#555" }}>({claim.x}, {claim.y})</span>
                <span style={{ color: "#a44", fontSize: 10 }}>
                  {claim.total === 0 ? "DRY" : claim.total.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Deposits */}
          <div style={s.panelBox}>
            <div style={s.panelLabel}>DEPOSIT LOCATIONS (POST-GAME)</div>
            <div style={s.depositGrid}>
              {deposits.map((dep, i) => (
                <div key={i} style={s.depositCard}>
                  <div style={{ color: "#c87830", marginBottom: 2, fontSize: 10 }}>Deposit {i + 1}</div>
                  <div style={{ color: "#888", fontSize: 10 }}>
                    ({dep.cx.toFixed(1)}, {dep.cy.toFixed(1)}) / Depth ~{dep.cz.toFixed(1)}
                  </div>
                  <div style={{ color: "#555", fontSize: 9 }}>
                    r{dep.radius.toFixed(1)} / {dep.richness.toFixed(2)}x
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  root: {
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    color: "#b0b0b0",
  },

  viewToggle: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },

  viewBtn: {
    background: "transparent",
    color: "#665533",
    border: "1px solid rgba(200,120,48,0.2)",
    padding: "6px 16px",
    fontSize: 10,
    letterSpacing: "0.15em",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    transition: "all 0.2s",
  },

  viewBtnActive: {
    background: "rgba(200,120,48,0.15)",
    color: "#c87830",
    border: "1px solid rgba(200,120,48,0.4)",
  },

  layout: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  vizWrap: {
    flex: "1 1 500px",
    maxWidth: 700,
  },

  vizLabel: {
    fontSize: 9,
    color: "#555",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: "0.08em",
  },

  sliceSelector: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    justifyContent: "center",
  },

  sliceLabel: {
    fontSize: 9,
    color: "#665533",
    letterSpacing: "0.15em",
    flexShrink: 0,
  },

  sliceButtons: {
    display: "flex",
    gap: 2,
  },

  sliceBtn: {
    width: 28,
    height: 24,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 2,
    color: "#555",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    cursor: "pointer",
    transition: "all 0.15s",
    padding: 0,
  },

  sliceBtnActive: {
    background: "rgba(200,120,48,0.2)",
    border: "1px solid rgba(200,120,48,0.5)",
    color: "#c87830",
  },

  heatmapWrap: {
    position: "relative",
    border: "1px solid rgba(200,120,48,0.1)",
    background: "#0a0a0f",
  },

  depthLabels: {
    position: "absolute",
    left: -32,
    top: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "4px 0",
  },

  depthLabel: {
    fontSize: 8,
    color: "#444",
    lineHeight: 1,
  },

  heatmapGrid: {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_X}, 1fr)`,
    gridTemplateRows: `repeat(${DEPTH_Z}, 1fr)`,
    height: 400,
    cursor: "crosshair",
  },

  claimMarkers: {
    display: "flex",
    justifyContent: "space-around",
    padding: "4px 0",
    fontSize: 8,
    color: "#444",
  },

  legend: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    fontSize: 8,
    color: "#555",
    letterSpacing: "0.1em",
  },

  legendBar: {
    display: "flex",
    height: 8,
    width: 180,
    borderRadius: 1,
    overflow: "hidden",
  },

  surfaceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(10, 1fr)",
    gap: 3,
    padding: 12,
    background: "#0a0a0f",
    border: "1px solid rgba(200,120,48,0.1)",
  },

  sidePanel: {
    flex: "0 0 260px",
    minWidth: 240,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  panelBox: {
    border: "1px solid rgba(200,120,48,0.1)",
    background: "rgba(12,12,22,0.8)",
    padding: 14,
  },

  panelLabel: {
    fontSize: 9,
    letterSpacing: "0.15em",
    color: "#c87830",
    marginBottom: 10,
  },

  inspectorStats: {
    marginBottom: 12,
  },

  inspectorRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    marginBottom: 4,
  },

  inspectorKey: {
    color: "#666",
  },

  inspectorVal: {
    color: "#c87830",
    fontFamily: "'Orbitron', monospace",
    fontSize: 10,
  },

  drillBtn: {
    width: "100%",
    padding: 10,
    background: "linear-gradient(180deg, rgba(200,120,48,0.3), rgba(139,105,20,0.3))",
    color: "#c87830",
    border: "1px solid rgba(200,120,48,0.3)",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: "0.12em",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    marginBottom: 10,
    transition: "all 0.2s",
  },

  drillBtnDisabled: {
    background: "rgba(42,42,62,0.5)",
    color: "#555",
    cursor: "not-allowed",
    border: "1px solid rgba(255,255,255,0.05)",
  },

  drillResults: {
    background: "rgba(10,10,18,0.8)",
    padding: 10,
    border: "1px solid rgba(200,120,48,0.08)",
    marginBottom: 10,
  },

  depthChart: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  depthRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    height: 12,
  },

  depthRowLabel: {
    width: 22,
    fontSize: 7,
    textAlign: "right",
  },

  depthBarWrap: {
    flex: 1,
    height: 7,
    background: "#0a0a12",
    position: "relative",
    overflow: "hidden",
  },

  depthRowVal: {
    width: 36,
    fontSize: 7,
    textAlign: "right",
  },

  emptyState: {
    fontSize: 11,
    color: "#444",
    textAlign: "center",
    padding: "20px 0",
  },

  leaderRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 6px",
    fontSize: 10,
    cursor: "pointer",
    transition: "background 0.15s",
  },

  depositGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },

  depositCard: {
    background: "rgba(10,10,18,0.8)",
    padding: "6px 8px",
    border: "1px solid rgba(200,120,48,0.06)",
  },
};
