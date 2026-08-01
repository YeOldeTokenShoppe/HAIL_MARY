"use client";
import React, { useEffect, useState } from "react";
import TerminalBoot from "./TerminalBoot";
import CaseTable from "./case-table/CaseTable";
import PressFlat from "./press/PressFlat";
import MobileTalkShow from "./MobileTalkShow";
import { preloadTalkShow } from "./TalkShowScene";
import { dateSeed } from "@/game/terminal-traders/docketRun";

// The mobile "Liminal Terminal" game shell — what opens when you tap into the
// laptop on /trade (mobile). Boots to the hub, then CASE FILES launches the
// Case Table (CASE_TABLE.md §4): the fifth-seat docket game, with live SitePal
// consultant channels. Position:absolute so it fills either the portal-to-body
// (real overlay) or the phone-frame preview (/trade/comms-preview).
// `active=false` unmounts the contents (and the live SitePal embed).
//
// The old single-case flow (CommsGrid → VerdictScreen) is retired per
// CASE_TABLE.md §4.8 — the table IS the case game now. CommsGrid.jsx and
// VerdictScreen.jsx stay on disk, parked with classic mode.
const SITEPAL_SCENES = { monk: 2774449, demon: 2775052, marisol: 2774916 };

// Top-level hub options shown after boot. TODO: confirm full list with design —
// currently Learning Modules + the live Case Files investigation.
const HUB_OPTIONS = [
  // { key: "scan", label: "LIMINAL SCAN", sub: "your trading type assessment" },
  // LT TV (2026-08-01) — the talk_show2.glb set, live on mobile. Desktop runs
  // it as a scene swap in the page's canvas; here it plays as a 16:9 broadcast
  // panel inside the terminal. See MobileTalkShow for why the shapes differ.
  { key: "lttv", label: "LT TV", sub: "the talk show — GR80 & John Barron" },
  // THE VC GAME (2026-07-26) — the one game we ship. Renders through PressFlat:
  // same pure controller as desktop, no WebGL, and Barron actually SPEAKS here
  // (ElevenLabs + the amplitude mouth), which the 3D view can't do because it's
  // limited to hand-uploaded SitePal clips.
  { key: "vc", label: "THE VC GAME", sub: "one deal. one pitch. three interruptions." },
];

// Daily Docket placeholder (CASE_TABLE.md §4.1): the seed is the UTC date
// (dateSeed in docketRun.js — shared with the reward route, which validates
// claims against the same calendar window).
// `templeStage` + `onRevealChange` + `transparent` (Phase 2, desktop): the
// host mounts this over the live temple scene; the Case Table reports its
// reveal outcome up (the page drives the scene's revealMode from it) and the
// host flips `transparent` on so the room shows through during the curtain
// call. Mobile mounts pass none of these and keep the opaque CRT.
export default function MobileTerminalGame({ active = true, onExit, templeStage = false, onRevealChange = null, transparent = false }) {
  const [screen, setScreen] = useState("boot"); // 'boot' | 'lttv' | 'vc' | 'placeholder' | 'cases'
  const [placeholderLabel, setPlaceholderLabel] = useState("");
  // True once the boot intro has played; subsequent returns to the hub skip the
  // welcome animation and show the menu options straight away.
  const [bootSeen, setBootSeen] = useState(false);
  const [seed] = useState(dateSeed);

  // Warm the LT TV set once the terminal is actually open. page.js skips this
  // preload on phones (3.3MB on cellular for a screen most visitors never
  // reach), so opening the terminal is the first real signal of intent — it
  // puts the fetch a tap ahead of the hub selection instead of behind it.
  useEffect(() => {
    if (!active) return;
    try { preloadTalkShow(); } catch (e) { /* non-fatal — LT TV fetches on open */ }
  }, [active]);

  if (!active) return null;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10050, background: transparent ? "transparent" : "#02100e" }}>
      {screen === "boot" ? (
        <TerminalBoot
          options={HUB_OPTIONS}
          instant={bootSeen}
          onSelect={(key) => {
            setBootSeen(true);
            if (key === "lttv") { setScreen("lttv"); return; }
            if (key === "vc") { setScreen("vc"); return; }
            if (key === "cases") { setScreen("cases"); return; }
            setPlaceholderLabel(HUB_OPTIONS.find((o) => o.key === key)?.label || "MODULE");
            setScreen("placeholder");
          }}
          onExit={onExit}
        />
      ) : screen === "lttv" ? (
        <MobileTalkShow onExit={() => setScreen("boot")} />
      ) : screen === "vc" ? (
        <PressFlat onExit={() => setScreen("boot")} />
      ) : screen === "placeholder" ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#02100e", color: "#2fd6d6", fontFamily: "'Courier New', monospace", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#f4fffb", letterSpacing: "0.06em" }}>{placeholderLabel}</div>
          <div style={{ fontSize: 13, color: "#ffd23a", letterSpacing: "0.1em" }}>// MODULE LOADING — COMING SOON</div>
          <button onClick={() => setScreen("boot")} style={{ marginTop: 18, background: "none", border: "1px solid rgba(47,214,214,0.5)", color: "#2fd6d6", font: "inherit", fontSize: 12, letterSpacing: "0.06em", padding: "10px 16px", cursor: "pointer" }}>◀ BACK</button>
        </div>
      ) : (
        <CaseTable
          initialSeed={seed}
          sitePalScenes={SITEPAL_SCENES}
          onExit={() => setScreen("boot")}
          recordScores
          templeStage={templeStage}
          onRevealChange={onRevealChange}
        />
      )}
    </div>
  );
}
