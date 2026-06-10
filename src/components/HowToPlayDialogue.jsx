"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── "How to Play" SitePal dialogue (single-portal spotlight) ───────────────
// Replaces the static greeting video in OilWelcomeModal.
//
// St. GR80 (monk, scene 2774449) and John Barron (scene 2774900) trade lines.
// To get RELIABLE lip-sync for BOTH, we use ONE SitePal portal and swap which
// scene is loaded to spotlight the current speaker — the same single-portal +
// loadSceneByID() pattern /trade uses. (Two independently-addressable portals
// are not reliable in this React env: a shared embed-functions load collapses
// both scenes onto portal 0, and per-portal loads clobber each other so
// selectPortal() silently no-ops. So: one portal, swap the scene per turn.)
//
// Only the current speaker is shown; there's a brief load pause between turns
// while the scene swaps. GR80 speaks via SitePal TTS (sayText); John speaks
// his uploaded audio tracks (sayAudio by name). Both fire vh_talkEnded when
// done, which advances the conversation.
//
// We override the shared window.vh_* callbacks on mount and restore them on
// unmount so this never collides with /trade's single-portal integration.

const ACCOUNT = "9308752";

// SitePal scene identity (from CyborgTempleScene's SITEPAL_PROJECTION_CONFIG).
// Intro-only GR80 scene (a dedicated build for the How-to-Play dialogue) —
// distinct from /trade's monk scene (2774449), which is unchanged.
const MONK = { key: "monk", label: "St. GR80", sceneId: 2775053, hash: "I0s05E8rXxvHYHdJIPmcIU5msqkW6t0A" };
// Intro-only John scene (a dedicated, better build for the How-to-Play
// dialogue) — distinct from /trade's Demon scene (2774900), which is unchanged.
const JOHN = { key: "john", label: "John Barron", sceneId: 2775052, hash: "IMtOuXOufh3OnQ9ZYUXc2DoYe39vRePb" };

// St. GR80's SitePal TTS voice — "Gilbert" (UK English male), with the reverb
// effect the character uses on /trade.
const MONK_VOICE = "9";
const MONK_LANG = 1;
const MONK_ENGINE = 7;
const MONK_EFFECT = "T";
const MONK_EFF_LEVEL = 3;

const TURN_GAP_MS = 350;        // beat between speakers
const LINE_WATCHDOG_MS = 30000; // hard cap per line so a stuck line can't freeze the run

// SitePal canvas render size (px). The two scenes are framed differently in
// the SitePal editor (GR80 larger w/ a blue backdrop, John smaller on black),
// so we render the full canvas then CROP each to a shared head-and-shoulders
// VIEWPORT with a per-character zoom/offset, so both read at a consistent size
// and the empty vertical space is hidden. The whole viewport then scales down
// to fit narrow modals.
const AV_W = 300;
const AV_H = 400;

// Shared display viewport (head + shoulders). Both characters fill this.
const VIEW_W = 230;
const VIEW_H = 268;

// Per-character framing INTO that viewport. `zoom` scales the 300×400 canvas;
// offsetX/offsetY (px, in canvas space, pre-zoom) nudge it. Tweak these two
// blocks to center each head — John needs more zoom since his scene frames him
// smaller, so the two end up the same apparent size.
const FRAME = {
  monk: { zoom: 1.30, offsetX: 0, offsetY: -14 },
  john: { zoom: 1.55, offsetX: 0, offsetY: -2 },
};

// Best-effort: force a consistent backdrop on both scenes (GR80's is blue,
// John's is transparent). Hex without '#'. Some scenes bake a background image
// that this can't override — harmless if so.
const BG_COLOR = "0b0b0f";

// The dialogue. Monk lines are SitePal TTS (`text`); John lines play his
// uploaded SitePal audio tracks by name (`audioName` → john_01..john_06 in the
// account's Audio Manager).
const SCRIPT = [
  { who: "monk", text: "Welcome prospector! The field is sealed before anyone plays — its riches hidden even from us. Provably fair." },
  { who: "john", audioName: "john_01" },
  { who: "monk", text: "Hold a little RL80 — that is your key. No spending. Sell whenever you wish." },
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

// On-screen captions (John's lines are baked into his MP3s, shown here too).
const CAPTIONS = [
  "St. GR80: Welcome, prospector. The field is sealed before anyone plays — its riches hidden even from us. Provably fair.",
  "John Barron: Which means nobody knows where the big strike hides… not even you. Delicious, isn't it?",
  "St. GR80: Hold a little RL80 — that is your key. No spending. Sell whenever you wish.",
  "John Barron: But why would you leave? Claim your plot, and the hunt begins.",
  "St. GR80: Your rig drills on its own, day and night. It strikes when the earth decides. Patience.",
  "John Barron: Random. Unpredictable. You'll check back again… and again… and again.",
  "St. GR80: The deeper you go, the richer the ground. Bank what you find, and it is yours — safe, and counted.",
  "John Barron: Or push deeper for the motherlode… and pray you don't crack a hell pocket. I do love when they crack a hell pocket.",
  "St. GR80: Should one breach, the whole field freezes — and hunters race for the bounty. Keep your cameras watching. Bank often.",
  "John Barron: Or don't. Greedy hands make the best stories.",
  "St. GR80: Drill wisely, prospector.",
  "John Barron: Push your luck.",
  "St. GR80: Welcome to Hail Mary.",
];

const sceneFor = (who) => (who === "monk" ? MONK : JOHN);

export default function HowToPlayDialogue({ darkMode = false, autoPlay = true }) {
  const containerRef = useRef(null);
  const stageWrapRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [caption, setCaption] = useState("");
  const [scale, setScale] = useState(1);
  const [speaker, setSpeaker] = useState("monk"); // who is currently spotlit (drives framing)

  // Run state. runToken invalidates stale callbacks after close/replay.
  const idxRef = useRef(0);
  const runTokenRef = useRef(0);
  const playingRef = useRef(false);
  const awaitingRef = useRef(-1);        // line index we're waiting to advance FROM
  const watchdogRef = useRef(null);
  const autoTriedRef = useRef(false);

  // Single-portal scene state.
  const currentSceneIdRef = useRef(MONK.sceneId); // initial embed = monk
  const sceneLoadedRef = useRef(false);
  const readyOnceRef = useRef(false);
  const pendingRef = useRef(null);        // { n, token, targetScene } awaiting a scene swap
  // Startup preload: warm John's scene (swap there and back) so the first real
  // swap to him during the conversation is fast. 'init' → 'warming' → 'done'.
  const preloadRef = useRef("init");

  // Audio-start tracking for the iOS retry path.
  const audioStartedRef = useRef(false);
  const speakRetryRef = useRef(null);
  const SPEAK_RETRY_MS = 2600;

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
  }, []);
  const clearSpeakRetry = useCallback(() => {
    if (speakRetryRef.current) { clearTimeout(speakRetryRef.current); speakRetryRef.current = null; }
  }, []);

  // Actually speak line n on the (now-loaded) correct scene. On mobile the
  // first sayText/sayAudio after a gesture sometimes silently no-ops; if
  // vh_audioStarted hasn't fired by SPEAK_RETRY_MS we re-prime with saySilent
  // and try again (up to 3 attempts) — the same robustness /trade relies on.
  const doSpeak = useCallback((n, token, attempt = 1) => {
    if (token !== runTokenRef.current) return;
    const L = SCRIPT[n];
    audioStartedRef.current = false;
    clearSpeakRetry();
    try {
      // Re-prime the audio pipeline on every attempt — cheap, and it's what
      // actually unsticks iOS Safari/Chrome.
      if (typeof window.saySilent === "function") window.saySilent(0);
    } catch (e) {}
    try { if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(7); } catch (e) {}
    if (attempt > 1) { try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {} }
    try {
      if (L.who === "monk") {
        if (typeof window.sayText === "function") {
          window.sayText(L.text, MONK_VOICE, MONK_LANG, MONK_ENGINE, MONK_EFFECT, MONK_EFF_LEVEL);
        }
      } else {
        if (typeof window.loadAudio === "function") { try { window.loadAudio(L.audioName); } catch (e) {} }
        if (typeof window.sayAudio === "function") window.sayAudio(L.audioName);
      }
    } catch (e) {
      console.warn("[HowToPlayDialogue] speak error", e);
    }
    speakRetryRef.current = setTimeout(() => {
      if (token !== runTokenRef.current || audioStartedRef.current) return;
      if (attempt < 3) {
        console.warn("[HowToPlayDialogue] speech did not start; retrying", { n, attempt });
        doSpeak(n, token, attempt + 1);
      }
    }, SPEAK_RETRY_MS);
  }, [clearSpeakRetry]);

  const speakLine = useCallback((n, token) => {
    if (token !== runTokenRef.current) return;
    if (n >= SCRIPT.length) {
      setPlaying(false);
      playingRef.current = false;
      awaitingRef.current = -1;
      pendingRef.current = null;
      clearWatchdog();
      clearSpeakRetry();
      setCaption("");
      return;
    }
    const L = SCRIPT[n];
    const target = sceneFor(L.who).sceneId;
    setCaption(CAPTIONS[n] || "");
    setSpeaker(L.who);
    awaitingRef.current = n;

    // Watchdog so a stuck line (failed swap / no end-event) can't freeze the run.
    clearWatchdog();
    watchdogRef.current = setTimeout(() => advance(n, token), LINE_WATCHDOG_MS);

    if (currentSceneIdRef.current === target && sceneLoadedRef.current) {
      // Already spotlighting this speaker — speak immediately.
      doSpeak(n, token);
    } else {
      // Swap the portal to this speaker's scene; vh_sceneLoaded will speak.
      pendingRef.current = { n, token, targetScene: target };
      sceneLoadedRef.current = false;
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      try { if (typeof window.loadSceneByID === "function") window.loadSceneByID(target); } catch (e) {}
    }
  }, [clearWatchdog, clearSpeakRetry, doSpeak]);

  // Advance from line n to n+1 exactly once (guarded by awaitingRef).
  const advance = useCallback((n, token) => {
    if (token !== runTokenRef.current) return;
    if (awaitingRef.current !== n) return;
    awaitingRef.current = -1;
    clearWatchdog();
    const next = n + 1;
    idxRef.current = next;
    setTimeout(() => speakLine(next, token), TURN_GAP_MS);
  }, [clearWatchdog, speakLine]);

  // iOS/Safari audio unlock — MUST run inside a real user gesture. saySilent(0)
  // primes SitePal (its own example does this on mobile), and resuming a
  // WebAudio context + SitePal's internal _vhssAudioCtx releases the suspended
  // audio pipeline. Without this, speech is silent on mobile and the watchdog
  // churns through the script with no sound.
  const unlockAudio = useCallback(() => {
    try { if (typeof window.saySilent === "function") window.saySilent(0); } catch (e) {}
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const ctx = window.__rl80UnlockCtx || new Ctx();
        window.__rl80UnlockCtx = ctx;
        if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(() => {});
        try {
          const s = ctx.createBufferSource();
          s.buffer = ctx.createBuffer(1, 1, 22050);
          s.connect(ctx.destination);
          s.start(0);
        } catch (e) {}
      }
    } catch (e) {}
    try { if (window._vhssAudioCtx && window._vhssAudioCtx.resume) window._vhssAudioCtx.resume(); } catch (e) {}
    // Resume the AudioContext(s) SitePal itself created (collected via the
    // constructor patch in the embed effect) — this is the one that actually
    // plays speech and stays suspended on iOS until a gesture resumes it.
    try {
      (window.__hmAudioInstances || []).forEach((ctx) => {
        try { if (ctx && ctx.state === "suspended" && ctx.resume) ctx.resume(); } catch (e) {}
      });
    } catch (e) {}
  }, []);

  const start = useCallback(() => {
    if (!ready) return;
    unlockAudio(); // runs inside the click/tap gesture
    try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
    runTokenRef.current += 1;
    const token = runTokenRef.current;
    idxRef.current = 0;
    awaitingRef.current = -1;
    pendingRef.current = null;
    setStarted(true);
    setPlaying(true);
    playingRef.current = true;
    speakLine(0, token);
  }, [ready, speakLine, unlockAudio]);

  // Embed the single portal + wire shared SitePal callbacks.
  useEffect(() => {
    let cancelled = false;

    // Patch AudioContext BEFORE SitePal loads so we can collect (and later
    // resume) the audio context IT creates — that context is suspended on iOS
    // until a gesture resumes it, and it's the one that plays speech.
    try {
      const key = window.AudioContext ? "AudioContext" : (window.webkitAudioContext ? "webkitAudioContext" : null);
      if (key && !window.__hmCtxPatched) {
        window.__hmCtxPatched = true;
        window.__hmAudioInstances = window.__hmAudioInstances || [];
        const Orig = window[key];
        const Patched = function (...args) {
          const inst = new Orig(...args);
          try { window.__hmAudioInstances.push(inst); } catch (e) {}
          return inst;
        };
        Patched.prototype = Orig.prototype;
        window[key] = Patched;
      }
    } catch (e) {}

    const prev = {
      vh_sceneLoaded: window.vh_sceneLoaded,
      vh_talkEnded: window.vh_talkEnded,
      vh_audioStarted: window.vh_audioStarted,
      vh_audioError: window.vh_audioError,
    };

    // vh_sceneLoaded fires on the initial load AND on every loadSceneByID swap.
    window.vh_sceneLoaded = () => {
      try {
        if (typeof window.getSceneAttributes === "function") {
          const attrs = window.getSceneAttributes();
          if (attrs && attrs.sceneID) currentSceneIdRef.current = Number(attrs.sceneID);
        }
      } catch (e) {}
      sceneLoadedRef.current = true;
      // interruptMode=1 (new speech cuts off old); displayControls=0 hides the
      // on-scene play/controls overlay.
      try { if (typeof window.setStatus === "function") window.setStatus(1, 0, 0, 0, 0); } catch (e) {}
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      try { if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(playingRef.current ? 7 : 0); } catch (e) {}
      // Unify the backdrop across the two scenes (best effort).
      try { if (typeof window.setBackgroundColor === "function") window.setBackgroundColor(BG_COLOR); } catch (e) {}

      // Startup preload: swap to John once (warm his 3D assets) then back to
      // monk, so the first in-conversation swap to John isn't a cold load.
      if (preloadRef.current === "init") {
        preloadRef.current = "warming";
        try { if (typeof window.loadSceneByID === "function") window.loadSceneByID(JOHN.sceneId); } catch (e) {}
        return;
      }
      if (preloadRef.current === "warming") {
        preloadRef.current = "done";
        try { if (typeof window.loadSceneByID === "function") window.loadSceneByID(MONK.sceneId); } catch (e) {}
        return;
      }

      if (!readyOnceRef.current) { readyOnceRef.current = true; if (!cancelled) setReady(true); }

      // If a line was waiting on this swap, speak it now.
      const p = pendingRef.current;
      if (p && p.token === runTokenRef.current && currentSceneIdRef.current === p.targetScene) {
        pendingRef.current = null;
        doSpeak(p.n, p.token);
      }
    };

    // Fires when GR80's TTS or John's audio finishes → advance. Ignore while a
    // swap is pending (the line hasn't actually been spoken yet) so a swap-
    // induced talk-end can't skip a line.
    window.vh_talkEnded = () => {
      if (!playingRef.current || pendingRef.current) return;
      advance(awaitingRef.current, runTokenRef.current);
    };

    window.vh_audioStarted = () => {
      audioStartedRef.current = true;
      clearSpeakRetry();
    };
    window.vh_audioError = (audID, portal, errCode, errMsg) => {
      console.warn("[HowToPlayDialogue] vh_audioError", { audID, errCode, errMsg });
    };

    // Single embed, initial scene = monk (the first speaker). context=1 (10th
    // positional) = JS-framework bootstrap; trailing ,0,1 matches /trade's
    // proven embed string for this account + loadSceneByID swapping.
    const params = `${ACCOUNT},${AV_W},${AV_H},"",1,1,${MONK.sceneId},0,1,1,"${MONK.hash}",0,1`;
    const loader = document.createElement("script");
    loader.type = "text/javascript";
    loader.src = `//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${ACCOUNT}&js=1`;
    loader.onload = () => {
      if (cancelled || !containerRef.current) return;
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.innerHTML =
        `try { AC_VHost_Embed(${params}); } ` +
        `catch (e) { try { AC_Vhost_Embed(${params}); } catch (e2) {} }`;
      containerRef.current.appendChild(s);
    };
    if (containerRef.current) containerRef.current.appendChild(loader);

    // Fallback: enable Start even if the preload swaps / vh_sceneLoaded stall.
    const readyFallback = setTimeout(() => {
      if (cancelled || readyOnceRef.current) return;
      preloadRef.current = "done";
      readyOnceRef.current = true;
      setReady(true);
    }, 12000);

    return () => {
      cancelled = true;
      runTokenRef.current += 1;
      clearTimeout(readyFallback);
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
      if (speakRetryRef.current) { clearTimeout(speakRetryRef.current); speakRetryRef.current = null; }
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      window.vh_sceneLoaded = prev.vh_sceneLoaded;
      window.vh_talkEnded = prev.vh_talkEnded;
      window.vh_audioStarted = prev.vh_audioStarted;
      window.vh_audioError = prev.vh_audioError;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [advance, doSpeak, clearSpeakRetry]);

  // Autoplay once ready — but NOT on touch devices: iOS/Android block audio
  // without a gesture, so autoplaying there just churns the script silently.
  // On touch, the user taps Start (which unlocks audio in the gesture).
  useEffect(() => {
    if (!autoPlay || !ready || autoTriedRef.current || playingRef.current) return;
    const isTouch = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;
    autoTriedRef.current = true;
    start();
  }, [autoPlay, ready, start]);

  // Insurance: unlock audio on the first tap/click anywhere (some browsers need
  // the gesture before SitePal's context exists; Start also unlocks directly).
  useEffect(() => {
    const onGesture = () => unlockAudio();
    document.addEventListener("pointerdown", onGesture, { capture: true });
    document.addEventListener("touchstart", onGesture, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onGesture, { capture: true });
      document.removeEventListener("touchstart", onGesture, { capture: true });
    };
  }, [unlockAudio]);

  // Scale the fixed-size stage down to fit narrow containers.
  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || VIEW_W;
      setScale(Math.min(1, w / VIEW_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const c = darkMode
    ? { capText: "#c8c0b4", labelText: "#8a8070", btnBg: "#d4a854", btnText: "#1a1a1f", stageBg: "#0b0b0f" }
    : { capText: "#504030", labelText: "#6e6050", btnBg: "#b8922e", btnText: "#fff", stageBg: "#0b0b0f" };

  const frame = FRAME[speaker] || FRAME.monk;
  const btnLabel = playing ? "Playing…" : !ready ? "Loading…" : started ? "Replay" : "Start the Conversation";

  return (
    <div style={{
      background: c.stageBg,
      borderTopLeftRadius: 10, borderTopRightRadius: 10,
      overflow: "hidden",
      padding: "16px 12px 12px",
    }}>
      {/* Single avatar stage — a fixed viewport that crops each scene to a
          consistent head-and-shoulders frame; scales down to fit narrow modals. */}
      <div ref={stageWrapRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{
          width: VIEW_W,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          height: VIEW_H * scale + 24,
          textAlign: "center",
        }}>
          <div style={{
            width: VIEW_W, height: VIEW_H, position: "relative", overflow: "hidden",
            margin: "0 auto", background: `#${BG_COLOR}`, borderRadius: 8,
          }}>
            <div
              ref={containerRef}
              style={{
                width: AV_W, height: AV_H,
                position: "absolute", left: "50%", top: `${frame.offsetY}px`,
                transform: `translateX(calc(-50% + ${frame.offsetX}px)) scale(${frame.zoom})`,
                transformOrigin: "top center",
              }}
            />
          </div>
          <div style={{
            margin: "8px 0 0", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
            color: c.labelText, fontFamily: "'Share Tech Mono', monospace",
          }}>
            {playing || started ? sceneFor(speaker).label : "St. GR80 · John Barron"}
          </div>
        </div>
      </div>

      {/* Caption */}
      <div style={{
        minHeight: "3.2em", textAlign: "center", margin: "8px auto 12px", maxWidth: 420,
        fontSize: 13, lineHeight: 1.45, color: c.capText, padding: "0 8px",
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        {caption}
      </div>

      {/* Start / Replay */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={start}
          disabled={!ready || playing}
          style={{
            fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "11px 26px", border: "none", borderRadius: 6,
            background: c.btnBg, color: c.btnText,
            cursor: ready && !playing ? "pointer" : "default",
            opacity: ready && !playing ? 1 : 0.45,
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
