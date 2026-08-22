"use client";

import { useState } from "react";

// Single source of truth for the rules copy — also consumed by OilWelcomeModal.
export const HOW_TO_PLAY_STEPS = [
  { num: "1", title: "GET YOUR KEY", desc: "Hold around $20 worth of RL80 tokens and follow the RL80 'X' account. Holding the token is your key — no spending required, and you can sell anytime. Once you're in, simply holding keeps you qualified; only selling out drops you." },
  { num: "2", title: "CLAIM YOUR PLOT", desc: "Before the season starts, pick any open plot — it becomes your claim for the season. Here's the fair part: the field is sealed with a tamper-proof commitment before anyone plays, but the actual Betroleum map isn't generated until AFTER every plot is locked in — from a future blockchain event nobody (not even us) can predict. So when you choose, the map doesn't exist yet. You're picking blind, like a real prospector, and it can't be rigged." },
  { num: "3", title: "YOUR RIG PUMPS 24/7", desc: "No clicking required. Once the season is live, your rig drills on its own around the clock and hits 'strikes' at random, unpredictable moments. Check back often to see if you struck Betroleum." },
  { num: "4", title: "DEPTH = RICHES", desc: "Just like real geology, the deeper you go the richer the earth tends to be — you'll find Betroleum at shallower layers too, just less often. Everyone can reach about halfway down; effort, referrals, and loyalty earn extra depth, down to a max of 20. It's not luck — it's strategy and commitment." },
  { num: "5", title: "BANK YOUR BETROLEUM", desc: "Drain your tank to bank your haul — banked Betroleum is safe and counts toward the leaderboard. Your payout is your Betroleum × a fixed rate, so your reward depends only on your OWN haul, never on what anyone else finds." },
  { num: "6", title: "BEWARE HELL POCKETS", desc: "Not everything underground is Betroleum. Hell pockets are hidden through the layers below the surface — and the deeper your rig pushes chasing richer Betroleum, the more chances it has to breach one. You can't aim around them, but your gauges may flag unusual activity nearby as a heads-up. Breach one and an evil entity breaks loose: the unlucky driller is frozen for 2 minutes and ALL Betroleum production across the field halts until it's contained. Other players can hunt it down for a bounty paid from the Community Tank — turning one player's bad luck into a field-wide scramble. Your best defense is to bank often: the less un-banked Betroleum you're holding, the less you expose when hell breaks loose." },
  { num: "7", title: "ROGUE CHARACTERS", desc: "Hell pockets aren't the only hazard — rogue characters can wander onto the field and cause temporary trouble around your rig. Equip your plot with cameras to be notified of unusual activity nearby, so you can respond before it costs you." },
  { num: "8", title: "CLAIM JUMP", desc: "Move to a different open plot anytime. Your first 2 jumps are free — each jump after costs 1 bonus drill." },
  { num: "9", title: "PIMP YOUR PUMP", desc: "Customize your rig with colors, materials, and add-ons — including defensive cameras. Make it yours." },
];

export default function HowToPlayPanel({ isMobile, darkMode = false, defaultExpanded = false, onLaunch = null }) {
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

  const steps = HOW_TO_PLAY_STEPS;

  const titleIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.activeBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999"/><path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"/><path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/></svg>
  );

  const titleStyle = {
    margin: 0, fontSize: isMobile ? 12 : 11, fontWeight: 600,
    color: c.accent, letterSpacing: "0.2em", textTransform: "uppercase",
    display: "flex", alignItems: "center", gap: 6,
    fontFamily: "'Share Tech Mono', monospace",
  };

  // Launcher mode: render a single row that opens the full rules modal instead
  // of expanding the steps inline (keeps the rules in one canonical surface).
  if (onLaunch) {
    return (
      <div style={{ padding: isMobile ? "12px 12px" : "12px 14px", borderBottom: `1px solid ${c.sectionBorder}` }}>
        <div
          onClick={onLaunch}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLaunch(); } }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
        >
          <h3 style={titleStyle}>
            {titleIcon}
            HOW TO PLAY
          </h3>
          <span style={{ fontSize: 12, color: c.muted }}>{"\u25B8"}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "12px 12px" : "12px 14px", borderBottom: `1px solid ${c.sectionBorder}` }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <h3 style={titleStyle}>
          {titleIcon}
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
