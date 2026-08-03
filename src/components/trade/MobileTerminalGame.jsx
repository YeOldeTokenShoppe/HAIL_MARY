"use client";
import React, { useEffect, useState } from "react";
import TerminalBoot from "./TerminalBoot";
import CaseTable from "./case-table/CaseTable";
import PressFlat from "./press/PressFlat";
import MobileTalkShow from "./MobileTalkShow";
import MobileNeuron from "./MobileNeuron";
import { preloadTalkShow } from "./TalkShowScene";
import { dateSeed } from "@/game/terminal-traders/docketRun";

// The mobile "Liminal Terminal" game shell — what opens when you tap into the
// laptop on /trade (mobile). Boots to the hub, then CASE FILES launches the
// Case Table (CASE_TABLE.md §4): the fifth-seat docket game, with live SitePal
// consultant channels.
// `active=false` unmounts the contents (and the live SitePal embed).
//
// POSITION:FIXED, PLUS A BODY SCROLL LOCK. This was `absolute`, which looks
// equivalent and isn't: portaled onto document.body it has no positioned
// ancestor, so its containing block is the INITIAL containing block — anchored
// at the top of the DOCUMENT, not the viewport. It therefore scrolled away with
// the page, and /trade behind it is tall, so you could drag the terminal up and
// see the page underneath.
//
// Fixed alone doesn't finish the job on iOS: rubber-band overscroll still drags
// the whole visual viewport, fixed elements included, exposing whatever is
// behind at the edges. The only reliable stop is to make the document
// unscrollable while the overlay is up, which is what the effect below does —
// recording scrollY, pinning the body, and restoring both on close.
//
// The /trade/comms-preview harness keeps working because its phone frame
// carries a `transform`, which makes it the containing block for fixed
// descendants. That's deliberate: one code path, and the harness emulates a
// viewport instead of diverging from what ships.
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
  // same pure controller as desktop, no WebGL. The pitch bot speaks here through
  // ElevenLabs and the amplitude drives the projection panel rather than a
  // mouth, because the rigs' mouths are LED plates that only exist inside the
  // glb this surface deliberately never loads. (This said "Barron SPEAKS, which
  // the 3D view can't do" — wrong twice since 2026-07-29: the pitch bot took the
  // selling, and desktop took the same audio path.)
  // "THE VC GAME" until 2026-08-02. Renamed to follow the /trade rail and the
  // module header, which both became PITCH BOT — the hub was the last place
  // still calling it by the internal name. (Code still says "the VC game"
  // everywhere; that is the SUBSYSTEM, and it keeps its name.)
  { key: "vc", label: "PITCH BOT", sub: "one deal. one pitch. three interruptions." },
  // NEURAL CATHEDRAL (2026-08-01) — ported from a CodePen by Techartist (MIT).
  // See MobileNeuron for the mobile changes and why it's affordable here.
  { key: "neuron", label: "NEURAL CATHEDRAL", sub: "bioelectric engine — tap to fire" },
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
  const [screen, setScreen] = useState("boot"); // 'boot' | 'lttv' | 'vc' | 'neuron' | 'placeholder' | 'cases'
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

  // Freeze the document behind the overlay. Restores the exact scroll position
  // on close — pinning the body otherwise drops the page back to the top, which
  // on /trade means losing your place when you exit the terminal.
  useEffect(() => {
    if (!active || typeof document === "undefined") return undefined;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      Object.assign(body.style, prev);
      window.scrollTo(0, scrollY);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        // CLAMP to the dynamic viewport. On iOS a fixed element is laid out
        // against the LARGE viewport (toolbars hidden), so with the Safari
        // toolbar showing, the bottom of this overlay sits underneath it and
        // whatever is down there — the EXIT button — is unreachable. It used to
        // merely be awkward; once the body scroll lock landed there was no way
        // to scroll to it at all.
        //
        // max-height rather than height, deliberately. `height: 100dvh` is
        // viewport-relative no matter what contains it, which would blow the
        // /trade/comms-preview phone frame out to the full browser height and
        // make the harness misreport every layout question asked of it. As a
        // max it clamps where it must (real overlay: large viewport -> visible
        // viewport) and does nothing where it shouldn't (harness: 740 frame is
        // already under the cap). Browsers without dvh ignore the line and get
        // the old inset behaviour.
        maxHeight: "100dvh",
        zIndex: 10050,
        background: transparent ? "transparent" : "#02100e",
        // Stops a scroll gesture that starts inside the overlay from chaining
        // out to the document once an inner scroller hits its end.
        overscrollBehavior: "none",
      }}
    >
      {screen === "boot" ? (
        <TerminalBoot
          options={HUB_OPTIONS}
          instant={bootSeen}
          onSelect={(key) => {
            setBootSeen(true);
            if (key === "lttv") { setScreen("lttv"); return; }
            if (key === "vc") { setScreen("vc"); return; }
            if (key === "neuron") { setScreen("neuron"); return; }
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
      ) : screen === "neuron" ? (
        <MobileNeuron onExit={() => setScreen("boot")} />
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
