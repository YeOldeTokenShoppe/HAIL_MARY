"use client";

import { useState, useMemo, useCallback } from "react";
import { fetchBlockHash } from "@/lib/fetchBlockHash";
import { generateOilDistribution3D, OIL_FIELD_UNITS, OIL_DEPTH_BIAS } from "@/lib/oilDistribution";

const DEPTH_Z = 20;

const STEPS = [
  {
    num: "1",
    title: "COMMIT",
    desc: "Before the game, the house generates a secret and publishes only its SHA-256 fingerprint (the \"commitment\") plus a FUTURE Base block number. The secret is sealed; the commitment proves it can't be swapped later.",
  },
  {
    num: "2",
    title: "FUTURE-BLOCK ANCHOR",
    desc: "The map is bound to the hash of a Base block that doesn't exist yet. Nobody — not even the house — can predict it, so the field can't be hand-picked (\"ground\") to favor anyone.",
  },
  {
    num: "3",
    title: "FINAL SEED",
    desc: "Once that block is mined, the seed is fixed: finalSeed = SHA-256(secret : blockHash). A deterministic algorithm turns it into the 3D oil field — same seed, same map, every time.",
  },
  {
    num: "4",
    title: "REVEAL",
    desc: "When the game ends, the secret is published. Anyone can confirm SHA-256(secret) matches the original commitment, re-derive the seed, and regenerate the entire field.",
  },
  {
    num: "5",
    title: "VERIFY IT YOURSELF",
    desc: "The button below re-runs the whole chain — commitment, on-chain block hash, seed, and every drilled cell — right here in your browser.",
  },
];

export default function OilVerifyExplainer({
  isMobile,
  darkMode = false,
  numberOfDeposits,
  gridX = 10,
  gridY = 10,
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null); // { phase, verdict, checks, published, claimTotals? }
  const [selectedCell, setSelectedCell] = useState(null);

  const c = darkMode
    ? {
        text: "#c8c0b4", accent: "#d4a854", muted: "#8a8070",
        sectionBorder: "#444", activeBg: "#d4a854", stepNum: "#d4a854",
        cellEmpty: "#3a3530", cellBorder: "#555", cellSelectedBorder: "#d4a854",
        oilColor: (i) => `rgba(212, 168, 84, ${0.15 + i * 0.6})`,
        infoKey: "#8a8070", infoVal: "#c8c0b4", hashVal: "#8a8070",
        infoBg: "rgba(180,160,130,0.08)", infoBorder: "#555",
        oilHighlight: "#d4a854", oilMuted: "#8a8070", noteText: "#6a6258",
        ok: "#5fbf6f", bad: "#d8624c", pending: "#c9a24a",
      }
    : {
        text: "#504030", accent: "#5a4010", muted: "#6e6050",
        sectionBorder: "#d4c8b4", activeBg: "#b8922e", stepNum: "#b8922e",
        cellEmpty: "#e8e0d4", cellBorder: "#d4c8b4", cellSelectedBorder: "#7a5a1a",
        oilColor: (i) => `rgba(180, 140, 60, ${0.15 + i * 0.6})`,
        infoKey: "#8b7d6b", infoVal: "#5a4e3e", hashVal: "#8b7d6b",
        infoBg: "rgba(180,160,130,0.08)", infoBorder: "#d4c8b4",
        oilHighlight: "#7a5a1a", oilMuted: "#a08070", noteText: "#9e8e78",
        ok: "#2e8b40", bad: "#b8402c", pending: "#9a6f10",
      };

  const mono = "'Share Tech Mono', monospace";
  const orbitron = "'Orbitron', monospace";

  const maxOilInGrid = useMemo(() => {
    if (!report?.claimTotals) return 1;
    return Math.max(1, ...report.claimTotals.map((ct) => ct.oil));
  }, [report]);

  const selectedOil = useMemo(() => {
    if (!report?.claimTotals || !selectedCell) return null;
    return report.claimTotals.find((ct) => ct.x === selectedCell.x && ct.y === selectedCell.y) || null;
  }, [report, selectedCell]);

  // Re-run the entire fairness chain in the browser.
  const handleVerify = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);
      setSelectedCell(null);

      // Pull the public fairness state + server's independent verdict.
      const res = await fetch("/api/oil-verify");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "verify failed");

      const out = {
        phase: data.phase,
        verdict: data.verdict,
        commitment: data.commitment,
        anchorBlock: data.anchorBlock,
        anchorBlockHash: data.anchorBlockHash,
        checks: data.checks || {},
        browser: {},
        claimTotals: null,
      };

      // Independent in-browser re-derivation once the secret is revealed.
      if (data.phase === "revealed" && data.checks?.finalSeed?.value) {
        // Re-confirm the on-chain anchor hash directly from Base (client-side).
        if (data.anchorBlock != null && data.anchorBlockHash) {
          try {
            const onChain = await fetchBlockHash(data.anchorBlock);
            out.browser.anchorMatches =
              onChain.blockHash?.toLowerCase() === data.anchorBlockHash.toLowerCase();
          } catch { out.browser.anchorMatches = null; }
        }

        // Regenerate the field locally from the revealed final seed.
        const finalSeed = data.checks.finalSeed.value;
        const { grid } = generateOilDistribution3D({
          blockHash: finalSeed,
          gridX, gridY, depthZ: DEPTH_Z,
          totalOilBudget: OIL_FIELD_UNITS,
          numberOfDeposits,
          depthBias: OIL_DEPTH_BIAS,
        });
        const claimTotals = [];
        for (let y = gridY - 1; y >= 0; y--) {
          for (let x = 0; x < gridX; x++) {
            let sum = 0;
            for (let z = 0; z < DEPTH_Z; z++) sum += grid[x][y][z];
            claimTotals.push({ x, y, oil: sum });
          }
        }
        out.claimTotals = claimTotals;
        out.finalSeed = finalSeed;
      }

      setReport(out);
      setStatus("done");
    } catch (e) {
      setError(e.message || "verify failed");
      setStatus("error");
    }
  }, [gridX, gridY, numberOfDeposits]);

  const verdictColor =
    report?.verdict === "VERIFIED" || report?.verdict === "ANCHOR_OK" ? c.ok
      : report?.verdict === "FAILED" ? c.bad : c.pending;

  const Check = ({ label, state, detail }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, marginBottom: 4, fontFamily: mono }}>
      <span style={{ color: c.infoKey, letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ color: state === true ? c.ok : state === false ? c.bad : c.pending, fontWeight: 700, textAlign: "right" }}>
        {state === true ? "✓ " : state === false ? "✗ " : "• "}{detail}
      </span>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? "12px 12px" : "12px 14px", borderBottom: `1px solid ${c.sectionBorder}` }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <h3 style={{
          margin: 0, fontSize: isMobile ? 12 : 11, fontWeight: 600,
          color: c.accent, letterSpacing: "0.2em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6, fontFamily: mono,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.activeBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
          VERIFY THE MAP
        </h3>
        <span style={{ fontSize: 10, color: c.muted }}>{expanded ? "▴" : "▾"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 8, fontFamily: mono, color: c.muted, letterSpacing: "0.15em", marginBottom: 8, fontWeight: 600 }}>
            PROVABLY FAIR — HOW IT WORKS
          </div>

          {STEPS.map((s) => (
            <div key={s.num} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: c.stepNum, minWidth: 16, textAlign: "center", lineHeight: "16px" }}>
                {s.num}
              </span>
              <div>
                <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.text, letterSpacing: "0.12em", marginBottom: 2 }}>
                  {s.title}
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: c.muted, lineHeight: "1.4", letterSpacing: "0.02em" }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 8, fontFamily: mono, color: c.muted, letterSpacing: "0.15em", marginBottom: 8, marginTop: 14, fontWeight: 600 }}>
            VERIFY THIS GAME
          </div>

          <button
            onClick={handleVerify}
            disabled={status === "loading"}
            style={{
              width: "100%", padding: "7px 8px", background: "#d4a854", border: "1px solid #b8922e",
              borderRadius: 2, color: "#fff", fontFamily: mono, fontSize: 9,
              letterSpacing: "0.12em", cursor: "pointer", marginBottom: 8, textTransform: "uppercase",
            }}
          >
            {status === "loading" ? "VERIFYING…" : "RUN VERIFICATION"}
          </button>

          {error && (
            <div style={{ fontSize: 9, color: c.bad, marginBottom: 8, letterSpacing: "0.05em", fontFamily: mono }}>
              {error}
            </div>
          )}

          {status === "done" && report && (
            <>
              {/* Verdict + phase */}
              <div style={{ background: c.infoBg, border: `1px solid ${verdictColor}`, padding: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ color: c.infoKey, letterSpacing: "0.12em", fontFamily: mono, fontSize: 9 }}>
                    PHASE: {String(report.phase || "—").toUpperCase()}
                  </span>
                  <span style={{ color: verdictColor, fontWeight: 700, fontFamily: orbitron, fontSize: 11, letterSpacing: "0.08em" }}>
                    {report.verdict}
                  </span>
                </div>

                {/* Anchor — on-chain hash matches what was published */}
                {report.checks.anchor && (
                  <Check
                    label={`ANCHOR · BLOCK ${report.checks.anchor.block?.toLocaleString?.() ?? report.checks.anchor.block}`}
                    state={report.checks.anchor.matches ?? null}
                    detail={report.checks.anchor.matches ? "on-chain match" : report.checks.anchor.error ? "fetch error" : "mismatch"}
                  />
                )}
                {/* Browser re-check of the anchor */}
                {report.browser?.anchorMatches != null && (
                  <Check label="ANCHOR · IN-BROWSER" state={report.browser.anchorMatches} detail={report.browser.anchorMatches ? "match" : "mismatch"} />
                )}
                {/* Commitment — SHA256(secret) === published */}
                {report.checks.commitment && (
                  <Check label="COMMITMENT" state={report.checks.commitment.matches ?? null} detail={report.checks.commitment.matches ? "secret valid" : "invalid"} />
                )}
                {/* Field — every drilled cell matches the recomputed field */}
                {report.checks.field && (
                  <Check
                    label={`FIELD · ${report.checks.field.checked} CELLS`}
                    state={report.checks.field.ok ?? null}
                    detail={report.checks.field.ok ? "all match" : `${report.checks.field.mismatches?.length || "?"} off`}
                  />
                )}
                {report.phase !== "revealed" && (
                  <div style={{ fontSize: 8, color: c.noteText, fontFamily: mono, fontStyle: "italic", marginTop: 4, lineHeight: 1.4 }}>
                    {report.phase === "anchored"
                      ? "Anchor is locked. The secret is revealed when the game ends — then the full field can be regenerated."
                      : report.phase === "committed"
                        ? "Commitment recorded. Awaiting the anchor block."
                        : "No game committed yet."}
                  </div>
                )}
              </div>

              {/* Published values */}
              {(report.commitment || report.anchorBlockHash) && (
                <div style={{ background: c.infoBg, border: `1px solid ${c.infoBorder}`, padding: 8, marginBottom: 8 }}>
                  {[
                    report.commitment && { key: "COMMITMENT", val: report.commitment },
                    report.anchorBlock != null && { key: "ANCHOR BLOCK", val: String(report.anchorBlock) },
                    report.anchorBlockHash && { key: "BLOCK HASH", val: report.anchorBlockHash },
                    report.finalSeed && { key: "FINAL SEED", val: report.finalSeed },
                  ].filter(Boolean).map((row) => (
                    <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, marginBottom: 3 }}>
                      <span style={{ color: c.infoKey, letterSpacing: "0.1em", flexShrink: 0, fontFamily: mono }}>{row.key}</span>
                      <span style={{ color: c.hashVal, fontFamily: mono, fontSize: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "62%", textAlign: "right" }}>
                        {row.val}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recomputed map (post-reveal only) */}
              {report.claimTotals && (
                <>
                  <div style={{ fontSize: 7, color: c.noteText, letterSpacing: "0.15em", marginBottom: 6, fontFamily: mono }}>
                    SELECT CLAIM TO INSPECT
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                    {Array.from({ length: gridY }, (_, rowIdx) => (
                      <div key={rowIdx} style={{ display: "flex", gap: 2 }}>
                        {Array.from({ length: gridX }, (_, x) => {
                          const claim = report.claimTotals[rowIdx * gridX + x];
                          const intensity = claim.oil / maxOilInGrid;
                          const isSelected = selectedCell?.x === claim.x && selectedCell?.y === claim.y;
                          return (
                            <button
                              key={x}
                              onClick={() => setSelectedCell({ x: claim.x, y: claim.y })}
                              style={{
                                flex: 1, aspectRatio: "1", padding: 0, borderRadius: 1, cursor: "pointer", minWidth: 0,
                                background: claim.oil === 0 ? c.cellEmpty : c.oilColor(intensity),
                                border: isSelected ? `1.5px solid ${c.cellSelectedBorder}` : `1px solid ${c.cellBorder}`,
                              }}
                              title={`(${claim.x},${claim.y}) — ${claim.oil.toLocaleString()} units`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {selectedOil && (
                    <div style={{ background: `rgba(212,168,84,${darkMode ? 0.08 : 0.1})`, border: `1px solid ${c.infoBorder}`, padding: "6px 8px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9 }}>
                        <span style={{ color: c.infoKey, letterSpacing: "0.1em", fontFamily: mono }}>CLAIM ({selectedCell.x}, {selectedCell.y})</span>
                        <span style={{ color: selectedOil.oil > 0 ? c.oilHighlight : c.oilMuted, fontWeight: 700, fontFamily: orbitron, fontSize: 9 }}>
                          {selectedOil.oil.toLocaleString()} units
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div style={{ fontSize: 8, color: c.noteText, fontFamily: mono, lineHeight: "1.4", letterSpacing: "0.02em", fontStyle: "italic" }}>
                The block hash and field regeneration run in your browser — verify the source yourself.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
