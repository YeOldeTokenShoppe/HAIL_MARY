"use client";

import { useState, useCallback } from "react";
import { ROGUE_CATALOG } from "@/components/RogueCharacter";

export default function RogueAdminPanel({ rogueEvents = [], gridSize = 10, darkMode, adminPassword }) {
  const [charType, setCharType] = useState(ROGUE_CATALOG[0]?.id || "dinosaur");
  const [autoTarget, setAutoTarget] = useState(true);
  // 1-indexed in the UI; we subtract 1 before sending to the API which uses 0-indexed cells.
  const [targetCol, setTargetCol] = useState(1);
  const [targetRow, setTargetRow] = useState(1);
  const [deploying, setDeploying] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const c = darkMode
    ? {
        bg: "rgba(18,22,28,0.95)",
        border: "#242c38",
        text: "#b0bcc8",
        accent: "#d4a854",
        muted: "#6a7888",
        inputBg: "#1a2028",
        btnBg: "linear-gradient(180deg, #d4a854, #b8922e)",
        dangerBg: "linear-gradient(180deg, #b03030, #802020)",
        activeBg: "rgba(212,168,84,0.15)",
        greenText: "#6aaa6a",
      }
    : {
        bg: "rgba(245,239,230,0.95)",
        border: "#d4c8b4",
        text: "#44392c",
        accent: "#5a4010",
        muted: "#6e6050",
        inputBg: "#f0e8dc",
        btnBg: "linear-gradient(180deg, #d4a854, #b8922e)",
        dangerBg: "linear-gradient(180deg, #b03030, #802020)",
        activeBg: "rgba(180,160,130,0.08)",
        greenText: "#3a7a20",
      };

  const getPw = useCallback(() => {
    if (adminPassword) return adminPassword;
    return localStorage.getItem("oil_admin_pw") || sessionStorage.getItem("oil_admin_pw") || "";
  }, [adminPassword]);

  const deploy = useCallback(async () => {
    setDeploying(true);
    setLastResult(null);
    try {
      const pw = getPw();

      const body = {
        password: pw,
        characterType: charType,
      };
      if (autoTarget) {
        body.autoTarget = true;
      } else {
        body.targetCol = Number(targetCol) - 1;
        body.targetRow = Number(targetRow) - 1;
      }

      const res = await fetch("/api/oil-rogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLastResult(data);
    } catch (err) {
      setLastResult({ ok: false, error: err.message });
    } finally {
      setDeploying(false);
    }
  }, [charType, autoTarget, targetCol, targetRow]);

  const markDone = useCallback(async (eventId) => {
    const pw = getPw();
    try {
      await fetch("/api/oil-rogue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, eventId }),
      });
    } catch (err) {
      console.error("Mark done failed:", err);
    }
  }, []);

  const s = {
    wrap: {
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      padding: 16,
      fontFamily: "'Share Tech Mono', monospace",
      color: c.text,
      marginBottom: 12,
    },
    header: {
      fontFamily: "'Orbitron', monospace",
      fontSize: 11,
      letterSpacing: "0.15em",
      color: c.accent,
      marginBottom: 12,
      textAlign: "center",
    },
    label: {
      fontSize: 9,
      letterSpacing: "0.12em",
      color: c.muted,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    select: {
      width: "100%",
      padding: "6px 8px",
      background: c.inputBg,
      border: `1px solid ${c.border}`,
      borderRadius: 3,
      color: c.text,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 11,
      marginBottom: 8,
      outline: "none",
    },
    input: {
      width: 50,
      padding: "6px 8px",
      background: c.inputBg,
      border: `1px solid ${c.border}`,
      borderRadius: 3,
      color: c.text,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 11,
      textAlign: "center",
      outline: "none",
    },
    toggle: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
      cursor: "pointer",
      fontSize: 10,
    },
    toggleBox: (on) => ({
      width: 14,
      height: 14,
      borderRadius: 2,
      border: `1px solid ${on ? c.accent : c.border}`,
      background: on ? c.accent : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 9,
      flexShrink: 0,
    }),
    btn: {
      width: "100%",
      padding: "8px 16px",
      background: c.btnBg,
      border: "1px solid #b8922e",
      borderRadius: 3,
      color: "#fff",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 10,
      letterSpacing: "0.12em",
      cursor: "pointer",
      marginTop: 8,
    },
    doneBtn: {
      padding: "3px 8px",
      background: c.dangerBg,
      border: "1px solid #802020",
      borderRadius: 2,
      color: "#fff",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 9,
      cursor: "pointer",
    },
    eventRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "4px 0",
      borderBottom: `1px solid ${c.border}`,
      fontSize: 10,
    },
  };

  const activeEvents = rogueEvents.filter((e) => e.status === "active");
  const selected = ROGUE_CATALOG.find((r) => r.id === charType);

  return (
    <div style={s.wrap}>
      <div style={s.header}>ROGUE DEPLOY</div>

      <div style={s.label}>CHARACTER</div>
      <select style={s.select} value={charType} onChange={(e) => setCharType(e.target.value)}>
        {ROGUE_CATALOG.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label} — {r.description}
          </option>
        ))}
      </select>

      <div
        style={s.toggle}
        onClick={() => setAutoTarget((v) => !v)}
      >
        <div style={s.toggleBox(autoTarget)}>
          {autoTarget ? "✓" : ""}
        </div>
        <span style={{ color: autoTarget ? c.accent : c.muted }}>
          AUTO TARGET
        </span>
        <span style={{ color: c.muted, fontSize: 8 }}>
          {autoTarget ? "picks unfenced rig with addons" : "manual col/row"}
        </span>
      </div>

      {!autoTarget && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={s.label}>COL</div>
            <input
              style={s.input}
              type="number"
              min={1}
              max={gridSize}
              value={targetCol}
              onChange={(e) => setTargetCol(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.label}>ROW</div>
            <input
              style={s.input}
              type="number"
              min={1}
              max={gridSize}
              value={targetRow}
              onChange={(e) => setTargetRow(e.target.value)}
            />
          </div>
        </div>
      )}

      {selected && (
        <div style={{ fontSize: 9, color: c.muted, marginBottom: 4 }}>
          Effect: {selected.description}
        </div>
      )}

      <button style={s.btn} onClick={deploy} disabled={deploying}>
        {deploying ? "DEPLOYING..." : "DEPLOY ROGUE"}
      </button>

      {lastResult && (
        <div
          style={{
            marginTop: 8,
            fontSize: 9,
            color: lastResult.ok ? c.greenText : "#e06060",
            padding: "4px 6px",
            background: c.activeBg,
            borderRadius: 2,
          }}
        >
          {lastResult.ok ? (
            <>
              <div>{`Deployed! → (${lastResult.targetCol + 1},${lastResult.targetRow + 1}) | ${lastResult.consequence?.type || "none"} | slot:${lastResult.consequence?.addonSlot ?? "none"} | ${lastResult.consequence?.addonId ?? ""}${lastResult.telegramSent ? " | TG sent" : ""}`}</div>
              {lastResult.pathDebug && (
                <div style={{ marginTop: 4, color: c.muted, wordBreak: "break-all" }}>
                  Path: {lastResult.pathDebug}
                </div>
              )}
            </>
          ) : (
            `Error: ${lastResult.error}`
          )}
        </div>
      )}

      {activeEvents.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={s.label}>ACTIVE ROGUES ({activeEvents.length})</div>
          {activeEvents.map((ev) => (
            <div key={ev.id} style={s.eventRow}>
              <span>
                {ev.characterType?.toUpperCase()} → ({ev.targetCol + 1},{ev.targetRow + 1})
                {ev.path ? ` [${ev.path.length}wp]` : ""}
              </span>
              <button style={s.doneBtn} onClick={() => markDone(ev.id)}>
                DONE
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
