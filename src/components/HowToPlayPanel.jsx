"use client";

import { useState } from "react";

export default function HowToPlayPanel({ isMobile, darkMode = false, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const c = darkMode ? {
    text: "#c8c0b4", accent: "#d4a854", muted: "#8a8070",
    panelBg: "rgba(26,26,31,0.95)", sectionBorder: "#444",
    activeBg: "#d4a854", stepNum: "#d4a854",
  } : {
    text: "#504030", accent: "#5a4010", muted: "#6e6050",
    panelBg: "rgba(245,239,230,0.95)", sectionBorder: "#d4c8b4",
    activeBg: "#b8922e", stepNum: "#b8922e",
  };

  const steps = [
    { num: "1", title: "GET YOUR KEY", desc: "Hold around $20 worth of Our Lady tokens and follow our Our Lady account. Holding the token is your key — no spending required. If you decide to leave, you're always free to sell." },
    { num: "2", title: "CLAIM YOUR PLOT", desc: "Pick any unclaimed pumpjack on the 10x10 grid. This is your drill site for the game." },
    { num: "3", title: "DRILL DEEPER", desc: "Each day a new layer unlocks (up to 10 passive). Click DRILL to dig each unlocked layer. Refer friends for up to 10 bonus layers — max depth: 20." },
    { num: "4", title: "DEPTH = RICHES", desc: "Just like real geology, the deeper you go the richer the earth tends to be. You'll still find deposits at shallower layers — just less frequently. Everyone starts with the potential to reach about halfway down, and in-game achievements let you go deeper. It's not about luck — it's about strategy and commitment." },
    { num: "5", title: "DRAIN YOUR TANK", desc: "Once your tank has oil, drain it to lock in your haul. The more you collect, the higher you climb on the leaderboard." },
    { num: "6", title: "CLAIM JUMP", desc: "Move to a different unclaimed plot. First 2 jumps are free — each jump after costs 1 bonus drill." },
    { num: "7", title: "PIMP YOUR PUMP", desc: "Customize your rig with colors, materials, and add-ons. Make it yours." },
  ];

  return (
    <div style={{ padding: isMobile ? "12px 12px" : "12px 14px", borderBottom: `1px solid ${c.sectionBorder}` }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <h3 style={{
          margin: 0, fontSize: isMobile ? 12 : 11, fontWeight: 600,
          color: c.accent, letterSpacing: "0.2em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.activeBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999"/><path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"/><path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/></svg>
          HOW TO PLAY
        </h3>
        <span style={{ fontSize: 10, color: c.muted }}>{expanded ? "\u25B4" : "\u25BE"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {steps.map((s) => (
            <div key={s.num} style={{
              display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start",
            }}>
              <span style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 11, fontWeight: 700, color: c.stepNum,
                minWidth: 16, textAlign: "center", lineHeight: "16px",
              }}>
                {s.num}
              </span>
              <div>
                <div style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 10, fontWeight: 600, color: c.text,
                  letterSpacing: "0.12em", marginBottom: 2,
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 10, color: c.muted, lineHeight: "1.4",
                  letterSpacing: "0.02em",
                }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
