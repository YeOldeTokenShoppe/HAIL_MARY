"use client";
import React, { useState } from "react";
import CommsGrid from "./CommsGrid";
import ChannelView from "./ChannelView";
import TerminalMenu from "./TerminalMenu";
import TerminalBoot from "./TerminalBoot";
import VerdictScreen from "./VerdictScreen";
import RevealScreen from "./RevealScreen";
import CASE_001 from "@/components/game/cases/case-001";

// The mobile "Liminal Terminal" game shell — what opens when you tap into the
// laptop on /trade (mobile). Owns the (currently self-contained) game state and
// switches between the COUNCIL grid and a consultant CHANNEL. Position:absolute
// so it fills either the portal-to-body (real overlay) or the phone-frame
// preview. `active=false` unmounts the contents (and the live SitePal embed).
//
// TODO: front this with a MENU screen ("menu options instead of the credo"),
// and connect the state to the real case sequence + Brier scoring in page.js.
const SITEPAL_SCENES = { monk: 2774449, demon: 2774900, marisol: 2774916 };

// Top-level hub options shown after boot. TODO: confirm full list with design —
// currently Learning Modules + the live Case Files investigation.
const HUB_OPTIONS = [
  { key: "scan", label: "LIMINAL SCAN", sub: "trading assessment" },
  { key: "cases", label: "CASE FILES", sub: "live token investigation" },
];

export default function MobileTerminalGame({ active = true, caseData = CASE_001, onExit }) {
  const scansMax = caseData.maxScans || 3;
  const [screen, setScreen] = useState("boot"); // 'boot' | 'placeholder' | 'menu' | 'grid' | 'channel'
  const [placeholderLabel, setPlaceholderLabel] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [confidence, setConfidence] = useState(0.5);
  const [activeStation, setActiveStation] = useState(null);
  const [scansUsed, setScansUsed] = useState(0);
  const [asked, setAsked] = useState({});       // { stationKey: number[] }
  const [revealed, setRevealed] = useState({}); // { stationKey: string[] }
  const [visited, setVisited] = useState([]);

  const openChannel = (key) => {
    setActiveStation(key);
    setScreen("channel");
    setVisited((v) => (v.includes(key) ? v : [...v, key]));
  };
  const ask = (qIndex) => {
    const key = activeStation;
    if (scansUsed >= scansMax) return;
    if ((asked[key] || []).includes(qIndex)) return;
    const reveal = caseData.stations[key]?.questions[qIndex]?.reveals;
    setScansUsed((s) => s + 1);
    setAsked((a) => ({ ...a, [key]: [...(a[key] || []), qIndex] }));
    if (reveal) setRevealed((r) => ({ ...r, [key]: [...(r[key] || []), reveal] }));
  };

  if (!active) return null;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10050, background: "#02100e" }}>
      {screen === "boot" ? (
        <TerminalBoot
          options={HUB_OPTIONS}
          onSelect={(key) => {
            if (key === "cases") { setScreen("menu"); return; }
            setPlaceholderLabel(HUB_OPTIONS.find((o) => o.key === key)?.label || "MODULE");
            setScreen("placeholder");
          }}
          onExit={onExit}
        />
      ) : screen === "placeholder" ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#02100e", color: "#2fd6d6", fontFamily: "'Courier New', monospace", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#f4fffb", letterSpacing: "0.06em" }}>{placeholderLabel}</div>
          <div style={{ fontSize: 13, color: "#ffd23a", letterSpacing: "0.1em" }}>// MODULE LOADING — COMING SOON</div>
          <button onClick={() => setScreen("boot")} style={{ marginTop: 18, background: "none", border: "1px solid rgba(47,214,214,0.5)", color: "#2fd6d6", font: "inherit", fontSize: 12, letterSpacing: "0.06em", padding: "10px 16px", cursor: "pointer" }}>◀ BACK</button>
        </div>
      ) : screen === "menu" ? (
        <TerminalMenu
          caseData={caseData}
          onBegin={() => setScreen("grid")}
          onExit={() => setScreen("boot")}
          exitLabel="◀ BACK"
        />
      ) : screen === "verdict" ? (
        <VerdictScreen
          caseData={caseData}
          onBack={() => setScreen("grid")}
          onCommit={({ verdict: v, confidence: c }) => { setVerdict(v); setConfidence(c); setScreen("reveal"); }}
        />
      ) : screen === "reveal" ? (
        <RevealScreen
          caseData={caseData}
          verdict={verdict}
          confidence={confidence}
          onExit={() => {
            // reset for a fresh investigation, return to the hub
            setScansUsed(0); setAsked({}); setRevealed({}); setVisited([]);
            setVerdict(null); setConfidence(0.5); setActiveStation(null);
            setScreen("boot");
          }}
        />
      ) : screen === "channel" && caseData.stations[activeStation] ? (
        <ChannelView
          stationKey={activeStation}
          station={caseData.stations[activeStation]}
          scansUsed={scansUsed}
          scansMax={scansMax}
          asked={asked[activeStation] || []}
          revealed={revealed[activeStation] || []}
          onAsk={ask}
          onBack={() => setScreen("grid")}
          onVerdict={() => setScreen("verdict")}
          useSitePal={!!SITEPAL_SCENES[activeStation]}
          sitePalSceneId={SITEPAL_SCENES[activeStation]}
        />
      ) : (
        <CommsGrid
          caseInfo={{ project: caseData.projectName, ticker: caseData.ticker, chain: caseData.chain }}
          scansUsed={scansUsed}
          scansMax={scansMax}
          visited={visited}
          onSelectChannel={openChannel}
          onExit={() => setScreen("menu")}
          exitLabel="◀ MENU"
        />
      )}
    </div>
  );
}
