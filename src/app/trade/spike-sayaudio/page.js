"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── SPIKE: can SitePal `sayAudio` play a fresh AUDIO URL with lip-sync? ──────
//
// Question this answers (yes/no): for the PAID live tier, can Demon/Detective
// speak novel ElevenLabs lines live via `sayAudio(<url>)` and lip-sync to them,
// OR do we need the slower runtime-upload-to-Audio-Manager path?
//
// How to read the result:
//   • vh_audioStarted fires + the face's mouth MOVES  → ✓ URL path works.
//     Live Demon/Detective is a one-liner: voice route returns an MP3 URL,
//     client calls sayAudio(url).
//   • vh_audioError fires (or nothing happens / no lip-sync) → ✗ URL rejected.
//     Fall back to runtime upload (generate → upload to SitePal → sayAudio(name)).
//
// Test order:
//   1. Click "① Unlock + verify scene" (a user gesture — required for iOS audio).
//      The Demon should speak a Gilbert TTS line. If THAT works, the pipeline is
//      alive and any sayAudio failure below is specific to the URL path.
//   2. Paste a PUBLIC, GET-able MP3 URL (start with a known-good one, e.g. a
//      static file in /public, before trying your own ElevenLabs endpoint).
//   3. Click "② sayAudio(url)" and watch the log + the face.
//
// Notes:
//   • The MP3 must be reachable by SitePal and served with sane headers
//     (audio/mpeg, and CORS-permissive if SitePal fetches it client-side).
//   • This page mounts its OWN isolated embed and restores the shared window.vh_*
//     callbacks on unmount, so it won't collide with the real /trade page.

const ACCOUNT = "9308752";
// Demon — the lip-synced SitePal character we're testing the live path for.
const DEMON = { sceneId: 2774900, hash: "YnR4tCeRwrDH29TfMAxvtPb4anz6oa6n" };

// A SitePal TTS voice just to prove the scene is alive (Gilbert / UK English).
const TEST_VOICE = "9";
const TEST_LANG = 1;
const TEST_ENGINE = 7;

const AV_W = 300;
const AV_H = 400;

export default function SpikeSayAudio() {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [url, setUrl] = useState("");
  const [log, setLog] = useState([]);

  const push = useCallback((msg, kind = "info") => {
    // No Date.now in scope concerns here — this is app client code.
    const ts = new Date().toLocaleTimeString();
    setLog((l) => [...l, { ts, msg, kind }]);
    // eslint-disable-next-line no-console
    console.log(`[spike-sayaudio] ${msg}`);
  }, []);

  // iOS audio unlock — must run inside a real user gesture.
  const unlock = useCallback(() => {
    try { if (typeof window.saySilent === "function") window.saySilent(0); } catch (e) {}
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const ctx = window.__faCtx || new Ctx();
        window.__faCtx = ctx;
        if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(() => {});
      }
    } catch (e) {}
    try { if (window._vhssAudioCtx && window._vhssAudioCtx.resume) window._vhssAudioCtx.resume(); } catch (e) {}
  }, []);

  // ① Prove the scene is alive with a Gilbert TTS line (also unlocks iOS audio).
  const verifyScene = useCallback(() => {
    unlock();
    try { if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(7); } catch (e) {}
    try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
    if (typeof window.sayText === "function") {
      push("calling sayText(…) — expect to hear Gilbert + see the mouth move");
      try {
        window.sayText("Scene check. If you can hear me, the audio pipeline is alive.", TEST_VOICE, TEST_LANG, TEST_ENGINE);
      } catch (e) {
        push(`sayText threw: ${e?.message || e}`, "err");
      }
    } else {
      push("window.sayText is not a function — embed not ready", "err");
    }
  }, [unlock, push]);

  // ② The actual test: sayAudio(url).
  const trySayAudioUrl = useCallback(() => {
    unlock();
    const u = url.trim();
    if (!u) { push("enter an audio URL first", "err"); return; }
    try { if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(7); } catch (e) {}
    try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
    push(`typeof sayAudio = ${typeof window.sayAudio}`);
    if (typeof window.sayAudio !== "function") { push("window.sayAudio missing — embed not ready", "err"); return; }
    push(`calling sayAudio("${u.slice(0, 80)}${u.length > 80 ? "…" : ""}")`);
    push("WATCH FOR: vh_audioStarted + mouth movement = ✓   |   vh_audioError = ✗", "watch");
    try {
      window.sayAudio(u);
    } catch (e) {
      push(`sayAudio threw: ${e?.message || e}`, "err");
    }
  }, [unlock, url, push]);

  // ③ Fallback shape: loadAudio(url) then sayAudio(url) — some SitePal builds
  // want the URL warmed first.
  const tryLoadThenSay = useCallback(() => {
    unlock();
    const u = url.trim();
    if (!u) { push("enter an audio URL first", "err"); return; }
    try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
    push("calling loadAudio(url) then sayAudio(url)");
    try { if (typeof window.loadAudio === "function") window.loadAudio(u); } catch (e) { push(`loadAudio threw: ${e?.message || e}`, "err"); }
    try { if (typeof window.sayAudio === "function") window.sayAudio(u); } catch (e) { push(`sayAudio threw: ${e?.message || e}`, "err"); }
  }, [unlock, url, push]);

  // Embed the Demon portal once and wire the vh_* callbacks to the log.
  useEffect(() => {
    let cancelled = false;
    const prev = {
      vh_sceneLoaded: window.vh_sceneLoaded,
      vh_talkEnded: window.vh_talkEnded,
      vh_audioStarted: window.vh_audioStarted,
      vh_audioError: window.vh_audioError,
    };

    window.vh_sceneLoaded = () => {
      try { if (typeof window.setStatus === "function") window.setStatus(1, 0, 0, 0, 0); } catch (e) {}
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      try { if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(7); } catch (e) {}
      if (!cancelled) { setReady(true); push("vh_sceneLoaded — Demon scene ready"); }
    };
    window.vh_audioStarted = () => push("vh_audioStarted ✓ — SitePal is PLAYING the audio (watch the mouth)", "ok");
    window.vh_talkEnded = () => push("vh_talkEnded — playback finished");
    window.vh_audioError = (audID, portal, errCode, errMsg) =>
      push(`vh_audioError ✗ — code=${errCode} msg=${errMsg || "(none)"}  → URL path rejected`, "err");

    const params = `${ACCOUNT},${AV_W},${AV_H},"",1,1,${DEMON.sceneId},0,1,1,"${DEMON.hash}",0,1`;
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
      push("embed injected — waiting for vh_sceneLoaded…");
    };
    if (containerRef.current) containerRef.current.appendChild(loader);
    push("loading SitePal embed functions…");

    return () => {
      cancelled = true;
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      window.vh_sceneLoaded = prev.vh_sceneLoaded;
      window.vh_talkEnded = prev.vh_talkEnded;
      window.vh_audioStarted = prev.vh_audioStarted;
      window.vh_audioError = prev.vh_audioError;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [push]);

  const btn = {
    padding: "10px 16px", border: "1px solid #444", borderRadius: 6,
    background: "#1b1b22", color: "#e8e2d4", cursor: "pointer",
    fontFamily: "monospace", fontSize: 13,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0f", color: "#e8e2d4", padding: 24, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>SitePal sayAudio(URL) spike — Demon scene</h1>
      <p style={{ fontSize: 13, color: "#9a927f", maxWidth: 720, lineHeight: 1.5 }}>
        Goal: does <code>sayAudio(url)</code> play a fresh audio URL <b>with lip-sync</b>?
        Run ① first (proves the scene is alive + unlocks iOS audio), then paste an
        MP3 URL and run ②. <b>vh_audioStarted + mouth movement = ✓.  vh_audioError = ✗.</b>
      </p>

      <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
        {/* Avatar */}
        <div style={{ width: AV_W, height: AV_H, background: "#000", borderRadius: 8, overflow: "hidden" }}>
          <div ref={containerRef} style={{ width: AV_W, height: AV_H }} />
        </div>

        {/* Controls + log */}
        <div style={{ flex: 1, minWidth: 360 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button style={btn} onClick={verifyScene} disabled={!ready}>① Unlock + verify scene</button>
          </div>

          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/some-audio.mp3   (a public, GET-able MP3)"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 6,
              border: "1px solid #444", background: "#101016", color: "#e8e2d4",
              fontFamily: "monospace", fontSize: 13, marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button style={btn} onClick={trySayAudioUrl} disabled={!ready}>② sayAudio(url)</button>
            <button style={btn} onClick={tryLoadThenSay} disabled={!ready}>③ loadAudio → sayAudio (fallback shape)</button>
          </div>

          <div style={{
            background: "#101016", border: "1px solid #2a2a33", borderRadius: 6,
            padding: 12, height: 320, overflowY: "auto", fontSize: 12.5, lineHeight: 1.55,
          }}>
            {log.length === 0 ? <div style={{ color: "#6a6354" }}>log…</div> : null}
            {log.map((l, i) => (
              <div key={i} style={{
                color: l.kind === "ok" ? "#7fdca0" : l.kind === "err" ? "#ff8a8a"
                  : l.kind === "watch" ? "#e8c66a" : "#b9b2a0",
              }}>
                <span style={{ color: "#5a5444" }}>{l.ts} </span>{l.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
