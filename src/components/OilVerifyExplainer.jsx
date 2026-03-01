"use client";

import { useState, useMemo, useCallback } from "react";
import { fetchBlockHash, fetchLatestBlockNumber } from "@/lib/fetchBlockHash";
import { generateOilDistribution3D } from "@/lib/oilDistribution";

const DEPTH_Z = 20;

const STEPS = [
  {
    num: "1",
    title: "BLOCK HASH SEED",
    desc: "Before the game starts, a future Base block number is chosen. Nobody — not even the game admin — can predict its hash.",
  },
  {
    num: "2",
    title: "DETERMINISTIC DISTRIBUTION",
    desc: "The hash feeds a deterministic algorithm that places oil deposits across the 3D grid. Same hash = same oil map, every time. The map is set in advance so everyone plays on equal footing.",
  },
  {
    num: "3",
    title: "DEPTH BIAS",
    desc: "Just like real geology, the deeper you go the richer the earth tends to be. You'll still find deposits at shallower layers — just less frequently. Deeper drilling is earned through in-game achievements, not luck.",
  },
  {
    num: "4",
    title: "THE ALGORITHM",
    desc: "The hash seeds a PRNG. It places N deposit blobs at random positions/depths with a natural bias toward deeper layers. Oil density falls off with distance² from each center.",
  },
  {
    num: "5",
    title: "BUDGET SCALING",
    desc: "Raw density values are normalized so the entire grid sums to the exact oil budget. Every barrel is accounted for.",
  },
  {
    num: "6",
    title: "VERIFY IT YOURSELF",
    desc: "Use the tool below. Enter the game's block number, and the algorithm runs client-side in your browser — no server involved.",
  },
];

export default function OilVerifyExplainer({
  isMobile,
  darkMode = false,
  numberOfDeposits,
  totalOilBudget,
  gridX = 10,
  gridY = 10,
  depthBias = 0.35,
}) {
  const [expanded, setExpanded] = useState(false);
  const [blockInput, setBlockInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  const c = darkMode
    ? {
        text: "#c8c0b4",
        accent: "#d4a854",
        muted: "#8a8070",
        panelBg: "rgba(26,26,31,0.95)",
        sectionBorder: "#444",
        activeBg: "#d4a854",
        stepNum: "#d4a854",
        inputBg: "#2a2a30",
        inputBorder: "#555",
        inputText: "#c8c0b4",
        cellEmpty: "#3a3530",
        cellBorder: "#555",
        cellSelectedBorder: "#d4a854",
        oilColor: (intensity) => `rgba(212, 168, 84, ${0.15 + intensity * 0.6})`,
        infoKey: "#8a8070",
        infoVal: "#c8c0b4",
        hashVal: "#8a8070",
        infoBg: "rgba(180,160,130,0.08)",
        infoBorder: "#555",
        btnBg: "rgba(180,160,130,0.15)",
        btnBorder: "#555",
        btnText: "#c8c0b4",
        oilHighlight: "#d4a854",
        oilMuted: "#8a8070",
        noteText: "#6a6258",
      }
    : {
        text: "#504030",
        accent: "#5a4010",
        muted: "#6e6050",
        panelBg: "rgba(245,239,230,0.95)",
        sectionBorder: "#d4c8b4",
        activeBg: "#b8922e",
        stepNum: "#b8922e",
        inputBg: "#f0e8dc",
        inputBorder: "#c8bfb0",
        inputText: "#3e2e10",
        cellEmpty: "#e8e0d4",
        cellBorder: "#d4c8b4",
        cellSelectedBorder: "#7a5a1a",
        oilColor: (intensity) => `rgba(180, 140, 60, ${0.15 + intensity * 0.6})`,
        infoKey: "#8b7d6b",
        infoVal: "#5a4e3e",
        hashVal: "#8b7d6b",
        infoBg: "rgba(180,160,130,0.08)",
        infoBorder: "#d4c8b4",
        btnBg: "rgba(180,160,130,0.1)",
        btnBorder: "#c8bfb0",
        btnText: "#6b5b47",
        oilHighlight: "#7a5a1a",
        oilMuted: "#a08070",
        noteText: "#9e8e78",
      };

  const selectedOil = useMemo(() => {
    if (!result || !selectedCell) return null;
    return result.claimTotals.find((c) => c.x === selectedCell.x && c.y === selectedCell.y) || null;
  }, [result, selectedCell]);

  const maxOilInGrid = useMemo(() => {
    if (!result) return 1;
    return Math.max(1, ...result.claimTotals.map((ct) => ct.oil));
  }, [result]);

  const handleFetchLatest = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);
      const num = await fetchLatestBlockNumber();
      setBlockInput(String(num));
      setStatus("idle");
    } catch {
      setError("Failed to fetch latest block");
      setStatus("error");
    }
  }, []);

  const handleGenerate = useCallback(async () => {
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
        gridX,
        gridY,
        depthZ: DEPTH_Z,
        totalOilBudget,
        numberOfDeposits,
        depthBias,
      });

      const claimTotals = [];
      for (let y = gridY - 1; y >= 0; y--) {
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
  }, [blockInput, numberOfDeposits, totalOilBudget, gridX, gridY, depthBias]);

  const mono = "'Share Tech Mono', monospace";
  const orbitron = "'Orbitron', monospace";

  return (
    <div style={{ padding: isMobile ? "12px 12px" : "12px 14px", borderBottom: `1px solid ${c.sectionBorder}` }}>
      {/* Collapsible header */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <h3 style={{
          margin: 0, fontSize: isMobile ? 12 : 11, fontWeight: 600,
          color: c.accent, letterSpacing: "0.2em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: mono,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z" stroke={c.activeBg} strokeWidth="2" fill="none" />
            <path d="M9 12l2 2 4-4" stroke={c.activeBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          VERIFY THE MAP
        </h3>
        <span style={{ fontSize: 10, color: c.muted }}>{expanded ? "\u25B4" : "\u25BE"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {/* Section 1: How Verification Works */}
          <div style={{
            fontSize: 8, fontFamily: mono, color: c.muted,
            letterSpacing: "0.15em", marginBottom: 8, fontWeight: 600,
          }}>
            HOW VERIFICATION WORKS
          </div>

          {STEPS.map((s) => (
            <div key={s.num} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{
                fontFamily: mono, fontSize: 11, fontWeight: 700, color: c.stepNum,
                minWidth: 16, textAlign: "center", lineHeight: "16px",
              }}>
                {s.num}
              </span>
              <div>
                <div style={{
                  fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.text,
                  letterSpacing: "0.12em", marginBottom: 2,
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontFamily: mono, fontSize: 10, color: c.muted, lineHeight: "1.4",
                  letterSpacing: "0.02em",
                }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}

          {/* Section 2: Try It */}
          <div style={{
            fontSize: 8, fontFamily: mono, color: c.muted,
            letterSpacing: "0.15em", marginBottom: 8, marginTop: 14, fontWeight: 600,
          }}>
            TRY IT
          </div>

          {/* Input row */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Block #"
              value={blockInput}
              onChange={(e) => {
                setBlockInput(e.target.value.replace(/\D/g, ""));
                if (status === "error") setStatus("idle");
              }}
              style={{
                flex: 1, minWidth: 0, padding: "6px 8px",
                background: c.inputBg, border: `1px solid ${c.inputBorder}`,
                borderRadius: 2, color: c.inputText, fontFamily: mono, fontSize: 11, outline: "none",
              }}
            />
            <button
              onClick={handleFetchLatest}
              disabled={status === "loading"}
              style={{
                padding: "5px 8px", background: c.btnBg, border: `1px solid ${c.btnBorder}`,
                borderRadius: 2, color: c.btnText, fontFamily: mono, fontSize: 8,
                letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              USE LATEST
            </button>
            <button
              onClick={handleGenerate}
              disabled={status === "loading" || !blockInput}
              style={{
                padding: "5px 8px", background: "#d4a854", border: "1px solid #b8922e",
                borderRadius: 2, color: "#fff", fontFamily: mono, fontSize: 8,
                letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {status === "loading" ? "..." : "GENERATE"}
            </button>
          </div>

          {error && (
            <div style={{ fontSize: 9, color: "#c04030", marginBottom: 8, letterSpacing: "0.05em", fontFamily: mono }}>
              {error}
            </div>
          )}

          {/* Verified result */}
          {status === "verified" && result && (
            <>
              {/* Block info */}
              <div style={{
                background: c.infoBg, border: `1px solid ${c.infoBorder}`,
                padding: 8, marginBottom: 8,
              }}>
                {[
                  { key: "BLOCK", val: result.blockNumber.toLocaleString() },
                  { key: "HASH", val: result.blockHash, isHash: true },
                  { key: "TIME", val: new Date(result.timestamp * 1000).toLocaleString() },
                  { key: "PARAMS", val: `${numberOfDeposits} deposits / ${totalOilBudget.toLocaleString()} budget` },
                ].map((row) => (
                  <div key={row.key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    fontSize: 9, marginBottom: 3,
                  }}>
                    <span style={{ color: c.infoKey, letterSpacing: "0.1em", flexShrink: 0, fontFamily: mono }}>
                      {row.key}
                    </span>
                    <span style={{
                      color: row.isHash ? c.hashVal : c.infoVal,
                      fontFamily: row.isHash ? mono : orbitron,
                      fontSize: row.isHash ? 8 : 9,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      maxWidth: row.isHash ? "65%" : undefined, textAlign: "right",
                    }}>
                      {row.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mini grid */}
              <div style={{
                fontSize: 7, color: c.noteText, letterSpacing: "0.15em", marginBottom: 6, fontFamily: mono,
              }}>
                SELECT CLAIM TO INSPECT
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                {Array.from({ length: gridY }, (_, rowIdx) => (
                  <div key={rowIdx} style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: gridX }, (_, x) => {
                      const claim = result.claimTotals[rowIdx * gridX + x];
                      const intensity = claim.oil / maxOilInGrid;
                      const isSelected = selectedCell?.x === claim.x && selectedCell?.y === claim.y;
                      return (
                        <button
                          key={x}
                          onClick={() => setSelectedCell({ x: claim.x, y: claim.y })}
                          style={{
                            flex: 1, aspectRatio: "1", padding: 0, borderRadius: 1,
                            cursor: "pointer", minWidth: 0,
                            background: claim.oil === 0 ? c.cellEmpty : c.oilColor(intensity),
                            border: isSelected
                              ? `1.5px solid ${c.cellSelectedBorder}`
                              : `1px solid ${c.cellBorder}`,
                            boxShadow: isSelected ? `0 0 6px rgba(122,90,26,0.3)` : "none",
                          }}
                          title={`(${claim.x},${claim.y}) — ${claim.oil.toLocaleString()} USDC`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Selected cell info */}
              {selectedOil && (
                <div style={{
                  background: `rgba(212,168,84,${darkMode ? 0.08 : 0.1})`,
                  border: `1px solid ${c.infoBorder}`, padding: "6px 8px", marginBottom: 8,
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9,
                  }}>
                    <span style={{ color: c.infoKey, letterSpacing: "0.1em", fontFamily: mono }}>
                      CLAIM ({selectedCell.x}, {selectedCell.y})
                    </span>
                    <span style={{
                      color: selectedOil.oil > 0 ? c.oilHighlight : c.oilMuted,
                      fontWeight: 700, fontFamily: orbitron, fontSize: 9,
                    }}>
                      {selectedOil.oil.toLocaleString()} USDC
                    </span>
                  </div>
                </div>
              )}

              {/* Note */}
              <div style={{
                fontSize: 8, color: c.noteText, fontFamily: mono,
                lineHeight: "1.4", letterSpacing: "0.02em", fontStyle: "italic",
              }}>
                This runs entirely in your browser — verify the source code yourself
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
