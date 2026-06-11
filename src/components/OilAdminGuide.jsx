"use client";

import { useState } from "react";

// Admin runbook accordion — the docs/admin-cheatsheet.md content, in-app, so the
// season procedure lives next to the buttons it refers to. Static content only
// (no actions, no secrets beyond what the admin panel already shows); mounted
// admin-only in the field sidebar and the OilQualify lobby ADMIN CONTROLS.

const RUNBOOK = [
  ["RESET BOARD", "TEST TOOLS — wipes plots, rigs, gushers, timeline, dispatch-feed polaroids (incl. storage blobs), community tank AND the whole fairness state (commit + anchor + reveal + server seed). Banked scores survive — that's the next step."],
  ["ZERO SCORES", "TEST TOOLS — erases every rig's banked totalCollected (separate from RESET BOARD so a mid-season glitch wipe can't destroy earned money). Skip only if scores should carry over."],
  ["PHASE → REGISTRATION", "sidebar PHASE buttons (they keep gameEnded in sync) or lobby PHASE OVERRIDE."],
  ["SET GRID SIZE", "size for expected demand NOW — frozen once the first plot is claimed; never resize after anchor."],
  ["START DATE + SEASON LENGTH", "drives “SEASON STARTS IN” and the season clock / GAME DAY."],
  ["COMMIT", "fairness console, lead ≈ seconds-until-start ÷ 2 (1d ≈ 43,200 · 3d ≈ 129,600 · 7d ≈ 302,400 blocks; empty = 30 ≈ 1 min). Starts the public countdown; claims stay open while there's no anchor hash."],
  ["DURING REGISTRATION", "RUN QUALIFICATION SNAPSHOT (lobby) re-checks holders vs their token floor; watch the waitlist count."],
  ["SEASON START", "once the anchor block mines: ANCHOR, then PHASE → ACTIVE — promptly and together. Anchor closes first-plot claims and enables strikes; the map is computable from that moment."],
  ["SEASON END", "strike-tick auto-flips to ended at the buzzer (auto-banks tanks, auto-reveals). Manual fallback: END GAME button (sets ended + triggers reveal); REVEAL in the console if it didn't auto-publish."],
];

const TEST_CYCLE =
  "Quick test cycle: RESET BOARD → COMMIT (empty lead ≈ 1 min) → ANCHOR → TESTING: ON → SEED + REVEAL FIELD or CLAIM SELECTED + FORCE STRIKE → REMOVE TEST BOTS / RESET BOARD when done → TESTING: OFF.";

const GOTCHAS = [
  "ticket_sale is the stored value behind the REGISTRATION label.",
  "Claims 403 during registration? Check for a leftover anchorBlockHash — RESET BOARD clears it.",
  "Lobby PHASE OVERRIDE sets only gamePhase; the sidebar buttons also sync gameEnded. Leaving ENDED? Use the sidebar (or RESET BOARD).",
  "FORCE STRIKE / SEED + REVEAL error no_seed until COMMIT + ANCHOR.",
  "TESTING: ON exempts testers from registration locks — turn OFF for live play.",
  "As authed admin the GEOLOGICAL SURVEY shows the live map — never screen-share it mid-season.",
];

export default function OilAdminGuide() {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div style={s.wrap}>
      <button onClick={() => setCollapsed(!collapsed)} style={s.header}>
        <span style={s.headerIcon}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2.5h8M2 6h8M2 9.5h5" stroke="#b8922e" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span style={s.headerText}>HOW TO RUN A SEASON (ADMIN)</span>
        <span style={{ ...s.chevron, transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>
      </button>

      {!collapsed && (
        <div style={s.body}>
          <div style={s.sectionTitle}>SEASON RUNBOOK — IN ORDER</div>
          <ol style={s.list}>
            {RUNBOOK.map(([action, detail], i) => (
              <li key={i} style={s.step}>
                <span style={s.stepAction}>{action}</span>
                <span style={s.stepDetail}> — {detail}</span>
              </li>
            ))}
          </ol>

          <div style={s.testCycle}>{TEST_CYCLE}</div>

          <div style={{ ...s.sectionTitle, marginTop: 10 }}>GOTCHAS</div>
          <ul style={s.list}>
            {GOTCHAS.map((g, i) => (
              <li key={i} style={{ ...s.step, listStyleType: "square" }}>
                <span style={s.stepDetail}>{g}</span>
              </li>
            ))}
          </ul>

          <div style={s.note}>Full version: docs/admin-cheatsheet.md</div>
        </div>
      )}
    </div>
  );
}

// Same parchment style language as OilVerifyPanel so the two admin accordions
// read as one console.
const s = {
  wrap: { borderBottom: "1px solid #d4c8b4" },
  header: {
    width: "100%", display: "flex", alignItems: "center", gap: 6,
    padding: "10px 14px", background: "transparent", border: "none",
    cursor: "pointer", fontFamily: "'Share Tech Mono', monospace",
  },
  headerIcon: { display: "flex", alignItems: "center" },
  headerText: { flex: 1, textAlign: "left", fontSize: 9, color: "#9a6f10", letterSpacing: "0.2em" },
  chevron: { fontSize: 8, color: "#9e8e78", transition: "transform 0.2s" },
  body: { padding: "0 14px 14px", fontFamily: "'Share Tech Mono', monospace" },
  sectionTitle: { fontSize: 8, color: "#8b7d6b", letterSpacing: "0.15em", marginBottom: 6 },
  list: { margin: 0, paddingLeft: 16 },
  step: { fontSize: 9, lineHeight: 1.5, marginBottom: 5, color: "#5a4e3e" },
  stepAction: { color: "#9a6f10", fontWeight: 700, letterSpacing: "0.05em" },
  stepDetail: { color: "#5a4e3e" },
  testCycle: {
    marginTop: 8, padding: 8, fontSize: 8.5, lineHeight: 1.5, color: "#6b5b47",
    background: "rgba(180,160,130,0.08)", border: "1px solid #d4c8b4",
  },
  note: { fontSize: 8, color: "#9e8e78", fontStyle: "italic", marginTop: 8, lineHeight: 1.4 },
};
