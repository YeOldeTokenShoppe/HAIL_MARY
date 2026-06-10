"use client";

// ── How-to-Play recording studio ───────────────────────────────────────────
// A clean, isolated page for RECORDING the two-character dialogue as separate
// clips that you then place side-by-side in iMovie.
//
// Two live SitePal portals don't work, so for a side-by-side video you record
// each character on their own (on DESKTOP, where John's 3D scene is fine):
//   1) /hailmary/studio?c=monk&cal=1  → "Calibrate" once: measures GR80's
//      spoken line lengths and saves them (so both clips share one timeline).
//   2) /hailmary/studio?c=monk        → record GR80's take.
//   3) /hailmary/studio?c=john        → record John's take.
//   4) In iMovie, drop both clips side-by-side and line them up at the white
//      SYNC FLASH that appears at the start of each take.
//
// Each take plays the SAME fixed timeline: the recorded character speaks on
// their turns and stays idle (silent) for the other's turns, for exactly the
// duration that turn takes — so when the two clips are aligned at the flash,
// they alternate perfectly.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ACCOUNT = "9308752";
const MONK = { key: "monk", label: "St. GR80", sceneId: 2775053, hash: "I0s05E8rXxvHYHdJIPmcIU5msqkW6t0A" };
const JOHN = { key: "john", label: "John Barron", sceneId: 2775052, hash: "IMtOuXOufh3OnQ9ZYUXc2DoYe39vRePb" };

const MONK_VOICE = "9";
const MONK_LANG = 1;
const MONK_ENGINE = 7;
const MONK_EFFECT = "T";
const MONK_EFF_LEVEL = 3;

// Big, crisp render for recording.
const AV_W = 420;
const AV_H = 560;

const GAP_MS = 600;   // pause appended after each turn
const LEAD_MS = 1200; // delay after the sync flash before the first line

// Head-turn ("look at each other"). SitePal: setGaze(degrees, durationSec,
// amplitude). `degrees` is a clock-like gaze direction — TUNE per scene; if a
// character turns the WRONG way in the studio preview, swap its value with the
// other's (try 90 ↔ 270). `amp` 0–100 = how far the head turns. In the final
// side-by-side GR80 is on the LEFT (turns right toward John) and John is on the
// RIGHT (turns left toward GR80); while speaking, each faces the camera.
const GAZE = {
  monk: { lookDeg: 90, amp: 100 },   // GR80 turns toward John (screen-right)
  john: { lookDeg: 270, amp: 100 },  // John turns toward GR80 (screen-left)
  durationSec: 9,                   // hold the turn through the other's line
  centerDeg: 0,
  centerAmp: 0,                     // face the camera while speaking
};

// John's exact track lengths (sec), measured with afinfo.
const JOHN_DUR_SEC = {
  john_01: 7.00, john_02: 4.44, john_03: 9.09, john_04: 9.48, john_05: 4.36, john_06: 1.07,
};

// Generous fallback estimates (sec) for GR80's lines, in order, used until a
// calibration pass measures the real values. Better too long (a small pause)
// than too short (the clips would overlap).
const GR80_EST_SEC = [7.6, 6.8, 7.2, 9.2, 8.8, 2.4, 2.6];

const LS_KEY = "hm_gr80_durations";

const SCRIPT = [
  { who: "monk", text: "Welcome prospector! The field is sealed before anyone plays — its riches hidden even from us. Provably fair." },
  { who: "john", audioName: "john_01" },
  { who: "monk", text: "Hold a little R-Lady — that is your key. No spending. Sell whenever you wish." },
  { who: "john", audioName: "john_02" },
  { who: "monk", text: "Your rig drills on its own, day and night. It strikes when the earth decides. Patience." },
  { who: "john", audioName: "john_03" },
  { who: "monk", text: "The deeper you go, the richer the ground. Bank what you find, and it is yours — safe, and counted." },
  { who: "john", audioName: "john_04" },
  { who: "monk", text: "Should one breach, the whole field freezes — and hunters race for the bounty. Keep your cameras watching. Bank often." },
  { who: "john", audioName: "john_05" },
  { who: "monk", text: "Drill wisely prospector." },
  { who: "john", audioName: "john_06" },
  { who: "monk", text: "Welcome to Hail Mary." },
];

function loadSitePalScriptOnce() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!window.__hmStudioScript) {
    window.__hmStudioScript = new Promise((resolve) => {
      const sc = document.createElement("script");
      sc.type = "text/javascript";
      sc.src = `//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${ACCOUNT}&js=1`;
      sc.onload = () => resolve();
      sc.onerror = () => resolve();
      document.head.appendChild(sc);
    });
  }
  return window.__hmStudioScript;
}

function StudioInner() {
  const params = useSearchParams();
  const who = params.get("c") === "john" ? JOHN : MONK;
  const calMode = params.get("cal") === "1";

  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading character…");
  const [flash, setFlash] = useState(false);
  const [running, setRunning] = useState(false);

  const sceneLoadedRef = useRef(false);
  const timersRef = useRef([]);
  const calRef = useRef(null); // calibration state

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  // Embed the single chosen scene.
  useEffect(() => {
    let cancelled = false;

    window.vh_sceneLoaded = () => {
      sceneLoadedRef.current = true;
      try { if (typeof window.setStatus === "function") window.setStatus(1, 0, 0, 0, 0); } catch (e) {}
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      try { if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(0); } catch (e) {}
      if (!cancelled) { setReady(true); setStatus("Ready"); }
    };
    window.vh_talkEnded = () => {
      // Used only by calibration to measure GR80 line lengths.
      const cal = calRef.current;
      if (!cal) return;
      const now = performance.now();
      const dur = (now - cal.startedAt) / 1000;
      cal.durations.push(Number(dur.toFixed(2)));
      cal.i += 1;
      setStatus(`Calibrating… measured ${cal.durations.length}/${cal.monkLines.length}`);
      if (cal.i >= cal.monkLines.length) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(cal.durations)); } catch (e) {}
        setStatus(`Calibration saved: [${cal.durations.join(", ")}] sec. You can record takes now.`);
        calRef.current = null;
        setRunning(false);
      } else {
        const t = setTimeout(() => calSpeakNext(), 500);
        timersRef.current.push(t);
      }
    };
    window.vh_audioStarted = () => {};
    window.vh_audioError = () => {};

    loadSitePalScriptOnce().then(() => {
      if (cancelled || !containerRef.current) return;
      const params2 = `${ACCOUNT},${AV_W},${AV_H},"",1,1,${who.sceneId},0,1,1,"${who.hash}",0,1`;
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.innerHTML =
        `try { AC_VHost_Embed(${params2}); } catch (e) { try { AC_Vhost_Embed(${params2}); } catch (e2) {} }`;
      containerRef.current.appendChild(s);
    });

    return () => {
      cancelled = true;
      clearTimers();
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [who, clearTimers]);

  const speak = useCallback((line) => {
    try { if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(7); } catch (e) {}
    try {
      if (line.who === "monk") {
        if (typeof window.sayText === "function") {
          window.sayText(line.text, MONK_VOICE, MONK_LANG, MONK_ENGINE, MONK_EFFECT, MONK_EFF_LEVEL);
        }
      } else {
        if (typeof window.loadAudio === "function") { try { window.loadAudio(line.audioName); } catch (e) {} }
        if (typeof window.sayAudio === "function") window.sayAudio(line.audioName);
      }
    } catch (e) {}
  }, []);

  const gaze = useCallback((deg, amp) => {
    try { if (typeof window.setGaze === "function") window.setGaze(deg, GAZE.durationSec, amp); } catch (e) {}
  }, []);

  // Calibration: speak GR80's lines one at a time, measuring each via vh_talkEnded.
  const calSpeakNext = useCallback(() => {
    const cal = calRef.current;
    if (!cal) return;
    cal.startedAt = performance.now();
    speak(cal.monkLines[cal.i]);
  }, [speak]);

  const runCalibration = useCallback(() => {
    if (!ready) return;
    try { if (typeof window.saySilent === "function") window.saySilent(0); } catch (e) {}
    const monkLines = SCRIPT.filter((l) => l.who === "monk");
    calRef.current = { monkLines, i: 0, durations: [], startedAt: 0 };
    setRunning(true);
    setStatus("Calibrating… measured 0/" + monkLines.length);
    calSpeakNext();
  }, [ready, calSpeakNext]);

  // Recording take: play the SHARED fixed timeline; this character speaks on
  // their turns, idles for the other's.
  const runTake = useCallback(() => {
    if (!ready) return;
    clearTimers();
    try { if (typeof window.saySilent === "function") window.saySilent(0); } catch (e) {}

    let gr80 = null;
    try { gr80 = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
    const monkDur = Array.isArray(gr80) && gr80.length === GR80_EST_SEC.length ? gr80 : GR80_EST_SEC;

    setRunning(true);
    setStatus("Recording take — speak when the avatar does.");

    // Sync flash at t≈0 so both clips can be aligned in the editor.
    setFlash(true);
    timersRef.current.push(setTimeout(() => setFlash(false), 140));

    const mine = GAZE[who.key]; // this character's turn-toward-the-other angle

    let monkI = 0;
    let t = LEAD_MS;
    SCRIPT.forEach((line) => {
      const isJohn = line.who === "john";
      const durMs = (isJohn ? (JOHN_DUR_SEC[line.audioName] || 5) : monkDur[monkI]) * 1000;
      if (!isJohn) monkI += 1;
      const at = t;
      if (line.who === who.key) {
        // My turn: face the camera, then speak.
        timersRef.current.push(setTimeout(() => { gaze(GAZE.centerDeg, GAZE.centerAmp); speak(line); }, at));
      } else {
        // Other's turn: turn to look at them (listening).
        timersRef.current.push(setTimeout(() => gaze(mine.lookDeg, mine.amp), at));
      }
      t += durMs + GAP_MS;
    });
    timersRef.current.push(setTimeout(() => {
      setRunning(false);
      setStatus("Take complete — stop your recording.");
    }, t + 400));
  }, [ready, who, speak, gaze, clearTimers]);

  return (
    <div style={{
      minHeight: "100dvh", background: "#0b0b0f", color: "#cfc8bc",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Share Tech Mono', monospace", padding: 24, gap: 18, position: "relative",
    }}>
      {/* Sync flash overlay */}
      {flash && <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9999 }} />}

      {/* Avatar */}
      <div ref={containerRef} style={{ width: AV_W, height: AV_H, background: "#0b0b0f" }} />
      <div style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.75 }}>
        {who.label}{calMode ? " · CALIBRATION" : " · RECORDING TAKE"}
      </div>

      {/* Controls — keep these OUT of frame: crop to just the avatar when recording,
          or stop after the take. */}
      {!running && (
        <button
          onClick={calMode ? runCalibration : runTake}
          disabled={!ready}
          style={{
            fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "12px 30px", border: "none", borderRadius: 6,
            background: ready ? "#b8922e" : "#555", color: "#1a1208",
            cursor: ready ? "pointer" : "default", fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {calMode ? "Run Calibration" : "Start Take"}
        </button>
      )}

      <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 520, textAlign: "center", lineHeight: 1.5 }}>
        {status}
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioInner />
    </Suspense>
  );
}
