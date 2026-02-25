"use client";

import { useState, useMemo, useCallback } from "react";
import { fetchBlockHash, fetchLatestBlockNumber } from "@/lib/fetchBlockHash";
import { generateOilDistribution3D } from "@/lib/oilDistribution";

const DEPTH_Z = 20;

export default function OilVerifyPanel({ numberOfDeposits, totalOilBudget, onApplyHash, gridX = 10, gridY = 10 }) {
  const [collapsed, setCollapsed] = useState(true);
  const [blockInput, setBlockInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | verified | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { blockNumber, blockHash, timestamp, claimTotals }
  const [selectedCell, setSelectedCell] = useState(null); // { x, y }

  const selectedOil = useMemo(() => {
    if (!result || !selectedCell) return null;
    return result.claimTotals[selectedCell.y * gridX + selectedCell.x];
  }, [result, selectedCell]);

  const handleFetchLatest = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);
      const num = await fetchLatestBlockNumber();
      setBlockInput(String(num));
      setStatus("idle");
    } catch (e) {
      setError("Failed to fetch latest block");
      setStatus("error");
    }
  }, []);

  const handleVerify = useCallback(async () => {
    const num = parseInt(blockInput, 10);
    if (!num || num < 1) {
      setError("Enter a valid block number");
      setStatus("error");
      return;
    }
    try {
      setStatus("loading");
      setError(null);
      setSelectedCell(null);
      const { blockNumber, blockHash, timestamp } = await fetchBlockHash(num);

      const { grid } = generateOilDistribution3D({
        blockHash,
        gridX: gridX,
        gridY: gridY,
        depthZ: DEPTH_Z,
        totalOilBudget,
        numberOfDeposits,
      });

      const claimTotals = [];
      for (let y = 0; y < gridY; y++) {
        for (let x = 0; x < gridX; x++) {
          let sum = 0;
          for (let z = 0; z < DEPTH_Z; z++) sum += grid[x][y][z];
          claimTotals.push({ x, y, oil: sum });
        }
      }

      setResult({ blockNumber, blockHash, timestamp, claimTotals });
      setStatus("verified");
    } catch (e) {
      setError(e.message || "Failed to fetch block");
      setStatus("error");
    }
  }, [blockInput, numberOfDeposits, totalOilBudget]);

  const maxOilInGrid = useMemo(() => {
    if (!result) return 1;
    return Math.max(1, ...result.claimTotals.map((c) => c.oil));
  }, [result]);

  return (
    <div style={s.wrap}>
      {/* Collapsible header */}
      <button onClick={() => setCollapsed(!collapsed)} style={s.header}>
        <span style={s.headerIcon}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-6" stroke="#5a8a3a" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span style={s.headerText}>BLOCK VERIFICATION</span>
        <span style={{ ...s.chevron, transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>
          &#9660;
        </span>
      </button>

      {!collapsed && (
        <div style={s.body}>
          {/* Input row */}
          <div style={s.inputRow}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Block #"
              value={blockInput}
              onChange={(e) => {
                setBlockInput(e.target.value.replace(/\D/g, ""));
                if (status === "error") setStatus("idle");
              }}
              style={s.input}
            />
            <button onClick={handleFetchLatest} style={s.smallBtn} disabled={status === "loading"}>
              USE LATEST
            </button>
            <button
              onClick={handleVerify}
              style={{ ...s.smallBtn, ...s.primaryBtn }}
              disabled={status === "loading" || !blockInput}
            >
              {status === "loading" ? "..." : "FETCH & VERIFY"}
            </button>
          </div>

          {error && <div style={s.error}>{error}</div>}

          {/* Verified result */}
          {status === "verified" && result && (
            <>
              {/* Block info */}
              <div style={s.blockInfo}>
                <div style={s.infoRow}>
                  <span style={s.infoKey}>BLOCK</span>
                  <span style={s.infoVal}>{result.blockNumber.toLocaleString()}</span>
                </div>
                <div style={s.infoRow}>
                  <span style={s.infoKey}>HASH</span>
                  <span style={s.hashVal}>{result.blockHash}</span>
                </div>
                <div style={s.infoRow}>
                  <span style={s.infoKey}>TIME</span>
                  <span style={s.infoVal}>
                    {new Date(result.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
                <div style={s.infoRow}>
                  <span style={s.infoKey}>PARAMS</span>
                  <span style={s.infoVal}>
                    {numberOfDeposits} deposits / {totalOilBudget.toLocaleString()} budget
                  </span>
                </div>
              </div>

              {/* Mini-grid */}
              <div style={s.gridLabel}>SELECT CLAIM TO INSPECT</div>
              <div style={s.miniGrid}>
                {Array.from({ length: gridY }, (_, y) => (
                  <div key={y} style={s.gridRow}>
                    {Array.from({ length: gridX }, (_, x) => {
                      const claim = result.claimTotals[y * gridX + x];
                      const intensity = claim.oil / maxOilInGrid;
                      const isSelected = selectedCell?.x === x && selectedCell?.y === y;
                      return (
                        <button
                          key={x}
                          onClick={() => setSelectedCell({ x, y })}
                          style={{
                            ...s.gridCell,
                            background: claim.oil === 0
                              ? "#e8e0d4"
                              : `rgba(180, 140, 60, ${0.15 + intensity * 0.6})`,
                            border: isSelected
                              ? "1.5px solid #7a5a1a"
                              : "1px solid #d4c8b4",
                            boxShadow: isSelected ? "0 0 6px rgba(122,90,26,0.3)" : "none",
                          }}
                          title={`(${x},${y}) — ${claim.oil.toLocaleString()} RL80`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Selected cell info */}
              {selectedOil && (
                <div style={s.cellInfo}>
                  <div style={s.infoRow}>
                    <span style={s.infoKey}>CLAIM ({selectedCell.x}, {selectedCell.y})</span>
                    <span style={{
                      ...s.infoVal,
                      color: selectedOil.oil > 0 ? "#7a5a1a" : "#a08070",
                      fontWeight: 700,
                    }}>
                      {selectedOil.oil.toLocaleString()} RL80
                    </span>
                  </div>
                </div>
              )}

              {/* Apply button */}
              <button onClick={() => onApplyHash(result.blockHash)} style={s.applyBtn}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 6 }}>
                  <path d="M1 6h8M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                APPLY TO MAP
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    borderBottom: "1px solid #d4c8b4",
  },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 14px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
  },
  headerIcon: {
    display: "flex",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    textAlign: "left",
    fontSize: 9,
    color: "#5a8a3a",
    letterSpacing: "0.2em",
  },
  chevron: {
    fontSize: 8,
    color: "#9e8e78",
    transition: "transform 0.2s",
  },
  body: {
    padding: "0 14px 14px",
  },
  inputRow: {
    display: "flex",
    gap: 4,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: "6px 8px",
    background: "#f0e8dc",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#3e2e10",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    outline: "none",
  },
  smallBtn: {
    padding: "5px 8px",
    background: "rgba(180,160,130,0.1)",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#6b5b47",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 8,
    letterSpacing: "0.08em",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
  },
  primaryBtn: {
    background: "#d4a854",
    border: "1px solid #b8922e",
    color: "#fff",
  },
  error: {
    fontSize: 9,
    color: "#c04030",
    marginBottom: 8,
    letterSpacing: "0.05em",
  },
  blockInfo: {
    background: "rgba(180,160,130,0.08)",
    border: "1px solid #d4c8b4",
    padding: 8,
    marginBottom: 8,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 9,
    marginBottom: 3,
  },
  infoKey: {
    color: "#8b7d6b",
    letterSpacing: "0.1em",
    flexShrink: 0,
  },
  infoVal: {
    color: "#5a4e3e",
    fontFamily: "'Orbitron', monospace",
    fontSize: 9,
    textAlign: "right",
  },
  hashVal: {
    color: "#8b7d6b",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "65%",
    textAlign: "right",
  },
  gridLabel: {
    fontSize: 7,
    color: "#9e8e78",
    letterSpacing: "0.15em",
    marginBottom: 6,
  },
  miniGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 8,
  },
  gridRow: {
    display: "flex",
    gap: 2,
  },
  gridCell: {
    flex: 1,
    aspectRatio: "1",
    padding: 0,
    borderRadius: 1,
    cursor: "pointer",
    transition: "all 0.15s",
    minWidth: 0,
  },
  cellInfo: {
    background: "rgba(212,168,84,0.1)",
    border: "1px solid #d4c8b4",
    padding: "6px 8px",
    marginBottom: 8,
  },
  applyBtn: {
    width: "100%",
    padding: 8,
    background: "linear-gradient(180deg, #5a8a3a, #4a7a2e)",
    border: "1px solid #4a7a2e",
    borderRadius: 2,
    color: "#fff",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
};
