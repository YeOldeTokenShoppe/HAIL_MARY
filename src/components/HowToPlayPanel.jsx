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
    { num: "1", title: "CLAIM YOUR PLOT", desc: "Click any pumpjack on the grid to stake your claim. This is your drill site for the game." },
    { num: "2", title: "DRILL DAILY", desc: "Come back each day and hit DRILL to dig one layer deeper. Each layer may reveal oil deposits hidden underground." },
    { num: "3", title: "STRIKE OIL", desc: "When your drill hits an oil deposit, your tank starts filling up. Bigger deposits mean more oil." },
    { num: "4", title: "DRAIN YOUR TANK", desc: "Once your tank has oil, drain it to lock in your haul. The more you collect, the higher you climb on the leaderboard." },
    { num: "5", title: "PIMP YOUR PUMP", desc: "Customize your rig with colors, materials, and add-ons. Make it yours." },
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
          <span style={{ fontSize: 12, color: c.activeBg }}>&#9432;</span>
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
