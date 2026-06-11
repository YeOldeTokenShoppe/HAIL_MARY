"use client";

import { useState, useCallback, useEffect } from "react";

// Admin fairness console — drives the future-block-anchored commit-reveal flow:
//   COMMIT  → generate a secret, publish its commitment + a future Base block.
//   ANCHOR  → once that block is mined, bind the seed to its on-chain hash.
//   REVEAL  → publish the secret so anyone can regenerate + verify the field.
// All actions hit /api/oil-fairness (admin-gated); status comes from the public
// /api/oil-verify endpoint so the admin sees exactly what players will see.
export default function OilVerifyPanel({ adminPassword }) {
  const [collapsed, setCollapsed] = useState(true);
  const [lead, setLead] = useState("");
  const [busy, setBusy] = useState(null); // 'commit' | 'anchor' | 'reveal' | 'refresh'
  const [error, setError] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [state, setState] = useState(null); // /api/oil-verify response

  const refresh = useCallback(async () => {
    try {
      setBusy("refresh");
      setError(null);
      const res = await fetch("/api/oil-verify");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "status failed");
      setState(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => { if (!collapsed && !state) refresh(); }, [collapsed, state, refresh]);

  const runAction = useCallback(async (action) => {
    try {
      setBusy(action);
      setError(null);
      setActionResult(null);
      const body = { adminPassword, action };
      if (action === "commit" && lead) body.lead = parseInt(lead, 10);
      const res = await fetch("/api/oil-fairness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
      setActionResult(data);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }, [adminPassword, lead, refresh]);

  const phase = state?.phase || "—";
  const verdict = state?.verdict;
  const verdictColor =
    verdict === "VERIFIED" || verdict === "ANCHOR_OK" ? "#5a8a3a"
      : verdict === "FAILED" ? "#b8402c" : "#9a6f10";

  return (
    <div style={s.wrap}>
      <button onClick={() => setCollapsed(!collapsed)} style={s.header}>
        <span style={s.headerIcon}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-6" stroke="#5a8a3a" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span style={s.headerText}>PROVABLE FAIRNESS (ADMIN)</span>
        <span style={{ ...s.chevron, transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>
      </button>

      {!collapsed && (
        <div style={s.body}>
          {/* Current state */}
          <div style={s.blockInfo}>
            <div style={s.infoRow}>
              <span style={s.infoKey}>PHASE</span>
              <span style={s.infoVal}>{String(phase).toUpperCase()}</span>
            </div>
            {verdict && (
              <div style={s.infoRow}>
                <span style={s.infoKey}>VERDICT</span>
                <span style={{ ...s.infoVal, color: verdictColor, fontWeight: 700 }}>{verdict}</span>
              </div>
            )}
            {state?.anchorBlock != null && (
              <div style={s.infoRow}>
                <span style={s.infoKey}>ANCHOR BLOCK</span>
                <span style={s.infoVal}>{state.anchorBlock.toLocaleString()}</span>
              </div>
            )}
            {state?.commitment && (
              <div style={s.infoRow}>
                <span style={s.infoKey}>COMMITMENT</span>
                <span style={s.hashVal}>{state.commitment}</span>
              </div>
            )}
            {state?.anchorBlockHash && (
              <div style={s.infoRow}>
                <span style={s.infoKey}>BLOCK HASH</span>
                <span style={s.hashVal}>{state.anchorBlockHash}</span>
              </div>
            )}
            {state?.checks?.field && (
              <div style={s.infoRow}>
                <span style={s.infoKey}>FIELD CHECK</span>
                <span style={{ ...s.infoVal, color: state.checks.field.ok ? "#5a8a3a" : "#b8402c" }}>
                  {state.checks.field.ok ? `✓ ${state.checks.field.checked} cells` : `✗ ${state.checks.field.mismatches?.length} off`}
                </span>
              </div>
            )}
          </div>

          {/* Commit (with optional lead override) */}
          <div style={s.inputRow}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="lead blocks (opt)"
              value={lead}
              onChange={(e) => setLead(e.target.value.replace(/\D/g, ""))}
              style={s.input}
            />
            <button onClick={() => runAction("commit")} style={{ ...s.smallBtn, ...s.primaryBtn }} disabled={!!busy}>
              {busy === "commit" ? "..." : "COMMIT"}
            </button>
          </div>
          {/* Lead → wall-clock conversion (Base ≈ 2s/block) so sizing the
              countdown to the season start needs no math. Default lead is 30
              blocks (~1 min) — fine for testing, blink-and-miss-it as theater. */}
          <div style={{ ...s.note, marginTop: -4, marginBottom: 8 }}>
            {(() => {
              const n = parseInt(lead, 10);
              if (!Number.isFinite(n) || n <= 0) return "lead = blocks until the map locks (~2s each). 1d ≈ 43200 · 3d ≈ 129600 · 7d ≈ 302400. Empty = 30 (~1 min).";
              const sec = n * 2;
              const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
              const human = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
              return `${n.toLocaleString()} blocks ≈ ${human} — countdown lands ${new Date(Date.now() + sec * 1000).toLocaleString()}`;
            })()}
          </div>

          {/* Anchor / Reveal / Refresh */}
          <div style={s.inputRow}>
            <button onClick={() => runAction("anchor")} style={{ ...s.smallBtn, flex: 1 }} disabled={!!busy}>
              {busy === "anchor" ? "..." : "ANCHOR"}
            </button>
            <button onClick={() => runAction("reveal")} style={{ ...s.smallBtn, flex: 1 }} disabled={!!busy}>
              {busy === "reveal" ? "..." : "REVEAL"}
            </button>
            <button onClick={refresh} style={{ ...s.smallBtn, flex: 1 }} disabled={!!busy}>
              {busy === "refresh" ? "..." : "REFRESH"}
            </button>
          </div>

          {error && <div style={s.error}>{error}</div>}
          {actionResult && (
            <div style={s.okMsg}>
              {actionResult.step?.toUpperCase()} OK
              {actionResult.anchorBlock != null ? ` — block ${actionResult.anchorBlock}` : ""}
            </div>
          )}

          <div style={s.note}>
            Flow: COMMIT (before play) → wait for the anchor block → ANCHOR (enables strikes) → REVEAL (at game end).
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { borderBottom: "1px solid #d4c8b4" },
  header: {
    width: "100%", display: "flex", alignItems: "center", gap: 6,
    padding: "10px 14px", background: "transparent", border: "none",
    cursor: "pointer", fontFamily: "'Share Tech Mono', monospace",
  },
  headerIcon: { display: "flex", alignItems: "center" },
  headerText: { flex: 1, textAlign: "left", fontSize: 9, color: "#5a8a3a", letterSpacing: "0.2em" },
  chevron: { fontSize: 8, color: "#9e8e78", transition: "transform 0.2s" },
  body: { padding: "0 14px 14px" },
  blockInfo: {
    background: "rgba(180,160,130,0.08)", border: "1px solid #d4c8b4",
    padding: 8, marginBottom: 8,
  },
  infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, marginBottom: 3 },
  infoKey: { color: "#8b7d6b", letterSpacing: "0.1em", flexShrink: 0, fontFamily: "'Share Tech Mono', monospace" },
  infoVal: { color: "#5a4e3e", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, textAlign: "right" },
  hashVal: {
    color: "#8b7d6b", fontFamily: "'Share Tech Mono', monospace", fontSize: 8,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "62%", textAlign: "right",
  },
  inputRow: { display: "flex", gap: 4, marginBottom: 8 },
  input: {
    flex: 1, minWidth: 0, padding: "6px 8px", background: "#f0e8dc",
    border: "1px solid #c8bfb0", borderRadius: 2, color: "#3e2e10",
    fontFamily: "'Share Tech Mono', monospace", fontSize: 11, outline: "none",
  },
  smallBtn: {
    padding: "6px 8px", background: "rgba(180,160,130,0.1)", border: "1px solid #c8bfb0",
    borderRadius: 2, color: "#6b5b47", fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap",
  },
  primaryBtn: { background: "#d4a854", border: "1px solid #b8922e", color: "#fff" },
  error: { fontSize: 9, color: "#b8402c", marginBottom: 8, letterSpacing: "0.05em", fontFamily: "'Share Tech Mono', monospace" },
  okMsg: { fontSize: 9, color: "#5a8a3a", marginBottom: 8, letterSpacing: "0.05em", fontFamily: "'Share Tech Mono', monospace" },
  note: { fontSize: 8, color: "#9e8e78", fontFamily: "'Share Tech Mono', monospace", fontStyle: "italic", lineHeight: 1.4 },
};
