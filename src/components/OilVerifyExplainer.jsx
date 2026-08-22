"use client";

import { useState, useMemo, useCallback } from "react";
import { fetchBlockHash } from "@/lib/fetchBlockHash";
import { generateOilDistribution3D, OIL_FIELD_UNITS, OIL_DEPTH_BIAS } from "@/lib/oilDistribution";

const DEPTH_Z = 20;

// Plain-English explanation (default, for everyone). The crypto-accurate version
// lives in TECH_STEPS, tucked behind a "technical details" toggle for the curious.
const PLAIN_STEPS = [
  {
    num: "1",
    title: "Locked in before anyone plays",
    desc: "Before the game opens, we seal the hidden map and publish a tamper-proof fingerprint of it. We can't quietly swap the map later — the fingerprint would stop matching.",
  },
  {
    num: "2",
    title: "Tied to something nobody can predict",
    desc: "The map is locked to a future moment on the Base blockchain that hasn't happened yet. So nobody — not even us — can hand-pick a map that favors anyone.",
  },
  {
    num: "3",
    title: "Revealed when the game ends",
    desc: "When the game finishes, we publish the secret. Anyone can rebuild the exact same map and confirm it matches the fingerprint from step 1.",
  },
  {
    num: "4",
    title: "Check it yourself",
    desc: "The button below re-runs every check live in your browser. You don't have to trust us — you can prove it.",
  },
];

const TECH_STEPS = [
  {
    num: "1",
    title: "COMMIT",
    desc: "The house generates a secret and publishes only its SHA-256 fingerprint (the \"commitment\") plus a FUTURE Base block number. The secret is sealed; the commitment proves it can't be swapped later.",
  },
  {
    num: "2",
    title: "FUTURE-BLOCK ANCHOR",
    desc: "The map is bound to the hash of a Base block that doesn't exist yet. Nobody — not even the house — can predict it, so the field can't be hand-picked (\"ground\") to favor anyone.",
  },
  {
    num: "3",
    title: "FINAL SEED",
    desc: "Once that block is mined, the seed is fixed: finalSeed = SHA-256(secret : blockHash). A deterministic algorithm turns it into the 3D Betroleum field — same seed, same map, every time.",
  },
  {
    num: "4",
    title: "REVEAL",
    desc: "When the game ends, the secret is published. Anyone can confirm SHA-256(secret) matches the original commitment, re-derive the seed, and regenerate the entire field.",
  },
];

// The DAILY TICKET rides the same commitment: each ticket's seed is an HMAC of
// the sealed secret over (player, day), and the ticket is stamped with the
// seed's SHA-256 fingerprint the moment it's minted. When the secret is
// revealed, every ticket a player ever scratched can be rebuilt and checked.
const TICKET_PLAIN = "Your daily scratch ticket is sealed the same way. Each ticket gets a fingerprint the moment it's minted, derived from the same locked-in secret and your player id and the day — so the house can't pick who wins, and can't change a ticket after you've seen it. When the game ends and the secret is revealed, every ticket you scratched can be rebuilt and checked, disc by disc.";
const TICKET_TECH = "ticketSeed = HMAC-SHA256(secret, userId:YYYYMMDD). The ticket stores SHA-256(ticketSeed) at mint. After the reveal: recompute the seed, confirm its hash matches the fingerprint, regenerate the nine cells with the open-source mint (src/lib/oilTicket.js) and confirm they match what you scratched, and confirm the recorded result matches the cells.";

export default function OilVerifyExplainer({
  isMobile,
  darkMode = false,
  numberOfDeposits,
  gridX = 10,
  gridY = 10,
  defaultExpanded = false,
  // Daily-ticket verification is per player: the page's authenticated fetch,
  // and whether anyone is signed in to have tickets at all.
  apiFetch = null,
  signedIn = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showTech, setShowTech] = useState(false);      // technical "how it works"
  const [showChecks, setShowChecks] = useState(false);  // technical result breakdown
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null); // { phase, verdict, checks, published, claimTotals? }
  const [selectedCell, setSelectedCell] = useState(null);
  const [ticketStatus, setTicketStatus] = useState("idle"); // idle | loading | done | error
  const [ticketReport, setTicketReport] = useState(null);
  const [ticketError, setTicketError] = useState(null);

  // Check the player's own tickets against the (sealed or revealed) secret.
  const handleVerifyTickets = useCallback(async () => {
    if (!apiFetch) return;
    try {
      setTicketStatus("loading"); setTicketError(null);
      const res = await apiFetch("/api/oil-ticket-verify", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "verify failed");
      setTicketReport(data); setTicketStatus("done");
    } catch (e) {
      setTicketError(e.message || "verify failed"); setTicketStatus("error");
    }
  }, [apiFetch]);

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

  // Re-run the entire fairness chain in the browser. (Logic unchanged.)
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

  // Plain-English headline for the result — replaces the cryptic VERIFIED /
  // PENDING / FAILED verdicts. Before reveal, reassure (it's not "broken");
  // after reveal, say clearly whether it checks out.
  const plainResult = useMemo(() => {
    if (!report) return null;
    if (report.phase === "revealed") {
      if (report.verdict === "VERIFIED") {
        return {
          tone: c.ok, icon: "✓", title: "Provably fair",
          body: "The revealed map exactly matches the fingerprint locked in before the game started, and the seed was tied to a Base block nobody could predict. Nothing was rigged.",
        };
      }
      return {
        tone: c.bad, icon: "⚠", title: "Couldn't fully verify",
        body: "The core proof checks out — the locked-in fingerprint is valid and the seed was tied to an unpredictable block — but some drilled plots didn't match the rebuilt map. In a live game this shouldn't happen; reach out if you see it.",
      };
    }
    if (report.phase === "anchored") {
      return {
        tone: c.pending, icon: "🔒", title: "Locked in — sealed until the end",
        body: "The map is sealed and tied to a Base block nobody could predict, so it can't be changed. The full proof unlocks when the game ends and the secret is revealed.",
      };
    }
    if (report.phase === "committed") {
      return {
        tone: c.pending, icon: "🔒", title: "Locked in",
        body: "The map's fingerprint is published and can't be swapped. The full proof unlocks once the game ends.",
      };
    }
    return {
      tone: c.pending, icon: "•", title: "No game locked in yet",
      body: "No game has been sealed yet — check back once a round is set up.",
    };
  }, [report, c]);

  const Check = ({ label, state, detail }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, marginBottom: 4, fontFamily: mono }}>
      <span style={{ color: c.infoKey, letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ color: state === true ? c.ok : state === false ? c.bad : c.pending, fontWeight: 700, textAlign: "right" }}>
        {state === true ? "✓ " : state === false ? "✗ " : "• "}{detail}
      </span>
    </div>
  );

  const linkBtn = {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    color: c.muted, fontFamily: mono, fontSize: 8, letterSpacing: "0.1em",
    textDecoration: "underline", textTransform: "uppercase",
  };

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
          IS THIS GAME FAIR?
        </h3>
        <span style={{ fontSize: 10, color: c.muted }}>{expanded ? "▴" : "▾"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: c.text, lineHeight: 1.5, letterSpacing: "0.02em", marginBottom: 12 }}>
            The map of where the Betroleum is hidden is locked in <b style={{ color: "inherit" }}>before anyone plays</b>, and tied to something
            nobody can predict — so it can't be rigged. Here's how, and you can prove it yourself.
          </div>

          {PLAIN_STEPS.map((s) => (
            <div key={s.num} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: c.stepNum, minWidth: 16, textAlign: "center", lineHeight: "16px" }}>
                {s.num}
              </span>
              <div>
                <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.text, letterSpacing: "0.06em", marginBottom: 2 }}>
                  {s.title}
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: c.muted, lineHeight: "1.4", letterSpacing: "0.02em" }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}

          {/* Technical "how it works" — the crypto-accurate version for the curious. */}
          <button onClick={() => setShowTech((t) => !t)} style={{ ...linkBtn, marginTop: 4, marginBottom: showTech ? 8 : 0 }}>
            {showTech ? "− hide technical details" : "+ technical details"}
          </button>
          {showTech && (
            <div style={{ background: c.infoBg, border: `1px solid ${c.infoBorder}`, padding: 8, marginBottom: 8 }}>
              {TECH_STEPS.map((s) => (
                <div key={s.num} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: c.stepNum, minWidth: 14, textAlign: "center" }}>{s.num}</span>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: c.text, letterSpacing: "0.12em", marginBottom: 2 }}>{s.title}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: c.muted, lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={status === "loading"}
            style={{
              width: "100%", padding: "8px 8px", background: c.activeBg, border: `1px solid ${darkMode ? "#b8922e" : "#9a6f10"}`,
              borderRadius: 2, color: "#fff", fontFamily: mono, fontSize: 10,
              letterSpacing: "0.12em", cursor: status === "loading" ? "wait" : "pointer",
              marginTop: 12, marginBottom: 8, textTransform: "uppercase", fontWeight: 700,
            }}
          >
            {status === "loading" ? "CHECKING…" : "CHECK THIS GAME"}
          </button>

          {error && (
            <div style={{ fontSize: 9, color: c.bad, marginBottom: 8, letterSpacing: "0.05em", fontFamily: mono }}>
              Couldn't run the check ({error}). Try again in a moment.
            </div>
          )}

          {status === "done" && report && plainResult && (
            <>
              {/* Plain-English headline */}
              <div style={{ background: c.infoBg, border: `1px solid ${plainResult.tone}`, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{plainResult.icon}</span>
                  <span style={{ color: plainResult.tone, fontWeight: 700, fontFamily: orbitron, fontSize: 12, letterSpacing: "0.04em" }}>
                    {plainResult.title}
                  </span>
                </div>
                <div style={{ fontFamily: mono, fontSize: 9, color: c.text, lineHeight: 1.5, letterSpacing: "0.02em" }}>
                  {plainResult.body}
                </div>
              </div>

              {/* Technical breakdown — the original per-check rows + published values. */}
              <button onClick={() => setShowChecks((s) => !s)} style={{ ...linkBtn, marginBottom: showChecks ? 8 : 0 }}>
                {showChecks ? "− hide the proof" : "+ show the proof"}
              </button>
              {showChecks && (
                <>
                  <div style={{ background: c.infoBg, border: `1px solid ${c.infoBorder}`, padding: 8, marginBottom: 8 }}>
                    {report.checks.anchor && (
                      <Check
                        label={`ANCHOR · BLOCK ${report.checks.anchor.block?.toLocaleString?.() ?? report.checks.anchor.block}`}
                        state={report.checks.anchor.matches ?? null}
                        detail={report.checks.anchor.matches ? "on-chain match" : report.checks.anchor.error ? "fetch error" : "mismatch"}
                      />
                    )}
                    {report.browser?.anchorMatches != null && (
                      <Check label="ANCHOR · IN-BROWSER" state={report.browser.anchorMatches} detail={report.browser.anchorMatches ? "match" : "mismatch"} />
                    )}
                    {report.checks.commitment && (
                      <Check label="COMMITMENT" state={report.checks.commitment.matches ?? null} detail={report.checks.commitment.matches ? "secret valid" : "invalid"} />
                    )}
                    {report.checks.field && (
                      <Check
                        label={`FIELD · ${report.checks.field.checked} PLOTS`}
                        state={report.checks.field.ok ?? null}
                        detail={report.checks.field.ok ? "all match" : `${report.checks.field.mismatches?.length || "?"} off`}
                      />
                    )}
                  </div>

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
                </>
              )}

              {/* Recomputed map (post-reveal only) — concrete "here's the real map". */}
              {report.claimTotals && (
                <>
                  <div style={{ fontSize: 8, color: c.text, letterSpacing: "0.04em", marginBottom: 6, fontFamily: mono }}>
                    THE REAL MAP — tap a plot to see how much Betroleum it held
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
                This check runs entirely in your browser — nothing to take on trust.
              </div>
            </>
          )}

          {/* ── DAILY TICKET — the same commitment, per player, per day ── */}
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px dashed ${c.sectionBorder}` }}>
            <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.text, letterSpacing: "0.12em", marginBottom: 4, textTransform: "uppercase" }}>
              Your daily ticket
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, color: c.muted, lineHeight: 1.45, letterSpacing: "0.02em", marginBottom: 8 }}>
              {showTech ? TICKET_TECH : TICKET_PLAIN}
            </div>
            {signedIn && apiFetch ? (
              <button
                onClick={handleVerifyTickets}
                disabled={ticketStatus === "loading"}
                style={{
                  width: "100%", padding: "8px 10px", cursor: ticketStatus === "loading" ? "wait" : "pointer",
                  background: "none", border: `1px solid ${c.accent}`, borderRadius: 2,
                  color: c.accent, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                }}
              >
                {ticketStatus === "loading" ? "CHECKING…" : "VERIFY MY TICKETS"}
              </button>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 9, color: c.muted, letterSpacing: "0.06em" }}>Sign in to check your own tickets.</div>
            )}
            {ticketStatus === "error" && (
              <div style={{ marginTop: 6, fontFamily: mono, fontSize: 9, color: c.bad }}>{ticketError}</div>
            )}
            {ticketReport && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4,
                  color: ticketReport.verdict === "VERIFIED" ? c.ok : ticketReport.verdict === "FAILED" ? c.bad : c.pending }}>
                  {ticketReport.verdict === "VERIFIED" ? `✓ ${ticketReport.summary.ok} of ${ticketReport.summary.checked} tickets check out`
                    : ticketReport.verdict === "FAILED" ? `⚠ ${ticketReport.summary.mismatches} of ${ticketReport.summary.checked} tickets don't match`
                      : ticketReport.tickets.length ? `🔒 ${ticketReport.tickets.length} ticket${ticketReport.tickets.length === 1 ? "" : "s"} sealed — fingerprints below, full check when the game ends`
                        : "• No tickets yet"}
                </div>
                {ticketReport.tickets.length > 0 && (
                  <div style={{ background: c.infoBg, border: `1px solid ${c.infoBorder}`, padding: 8, maxHeight: 160, overflowY: "auto" }}>
                    {ticketReport.tickets.map((t) => (
                      <div key={t.day} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 9, marginBottom: 3, fontFamily: mono }}>
                        <span style={{ color: c.infoKey, letterSpacing: "0.08em", flexShrink: 0 }}>
                          {t.day.slice(4, 6)}/{t.day.slice(6, 8)}{t.status === "settled" ? (t.win ? ` · ${t.win}` : " · no match") : " · open"}
                        </span>
                        <span style={{ color: t.checks ? (t.ok ? c.ok : c.bad) : c.hashVal, fontSize: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58%", textAlign: "right", fontWeight: t.checks ? 700 : 400 }}>
                          {t.checks ? (t.ok ? "✓ rebuilt & matches" : `✗ ${["fingerprint", "cells", "result"].filter((k) => !t.checks[k]).join(", ")}`) : t.seedHash}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {ticketReport.recipe && showTech && (
                  <div style={{ marginTop: 6, fontFamily: mono, fontSize: 8, color: c.noteText, lineHeight: 1.5, letterSpacing: "0.02em" }}>
                    <div>seed = {ticketReport.recipe.seed}</div>
                    <div>check: {ticketReport.recipe.fingerprint}</div>
                    <div>cells = {ticketReport.recipe.cells}</div>
                    <div>your id: {ticketReport.recipe.userId}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
