"use client";
import React, { useEffect, useRef } from "react";

// Live SitePal avatar shown as a flat "video call" feed for the mobile CHANNEL
// view. This is the LIGHT path: we just let SitePal render its own avatar in a
// container — NO per-frame canvas-crop-onto-3D-mesh (that was the heavy desktop
// projection we dropped on mobile). One embed, one character at a time.
//
// Speech: prefers a pre-recorded sayAudio clip when the line has an `audio`
// name; otherwise live TTS via sayText in the character's voice. Reuses the
// account/hash/scene already in the codebase.
//
// Mobile gotcha: audio autoplay needs a user gesture. The intro speak fires
// after the (async) scene load, which may be outside the original tap — so the
// feed is tappable to (re)play the current line from a real gesture.
function loadSitePalScript(account) {
  if (typeof window === "undefined") return Promise.resolve();
  if (!window.__sitePalScriptPromise) {
    window.__sitePalScriptPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = `//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${account}&js=0`;
      s.type = "text/javascript";
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }
  return window.__sitePalScriptPromise;
}

export default function SitePalFeed({
  account = "9308752",
  sceneId = 2774449,
  hash = "YnR4tCeRwrDH29TfMAxvtPb4anz6oa6n",
  width = 420,
  height = 380,
  faceZoom = 1.25,      // CSS zoom into the avatar's face (crops the scene bg)
  faceShiftY = "-8%",
  line,          // { key, audio, text, voice: {voice,lang,engine,effect,effLevel} }
  onStatus,      // (status:'connecting'|'ready'|'speaking') => void
}) {
  const containerRef = useRef(null);
  const readyRef = useRef(false);
  const pendingRef = useRef(null);
  const lineRef = useRef(line);
  lineRef.current = line;

  const speak = (ln) => {
    if (!ln || typeof window === "undefined") return;
    if (!readyRef.current) { pendingRef.current = ln; return; }
    try {
      if (typeof window.setStatus === "function") window.setStatus(1, 0, 0, 1, 0);
      if (ln.audio && typeof window.sayAudio === "function") {
        window.sayAudio(ln.audio);
      } else if (ln.text && typeof window.sayText === "function") {
        const v = ln.voice || {};
        if (v.effect) window.sayText(ln.text, v.voice, v.lang, v.engine, v.effect, v.effLevel);
        else window.sayText(ln.text, v.voice || "9", v.lang || 1, v.engine || 7);
      }
      onStatus?.("speaking");
    } catch (e) { /* SitePal not ready */ }
  };

  // Mount the embed once.
  useEffect(() => {
    let cancelled = false;
    onStatus?.("connecting");
    // vh_sceneLoaded fires on initial load (and any loadSceneByID swap).
    window.vh_sceneLoaded = () => {
      readyRef.current = true;
      onStatus?.("ready");
      try { if (typeof window.setStatus === "function") window.setStatus(1, 0, 0, 1, 0); } catch (e) {}
      const pending = pendingRef.current || lineRef.current;
      if (pending) { pendingRef.current = null; speak(pending); }
    };
    // Talk callbacks drive the LISTENING ↔ TRANSMITTING state so the idle
    // avatar reads as "alert and waiting" rather than dead air.
    window.vh_talkStarted = () => onStatus?.("speaking");
    window.vh_talkEnded = () => onStatus?.("ready");
    loadSitePalScript(account).then(() => {
      if (cancelled || !containerRef.current) return;
      const params = `${account},${width},${height},"",1,1,${sceneId},0,1,1,"${hash}",0,1`;
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.textContent =
        `try { AC_VHost_Embed(${params}); } catch (e) { try { AC_Vhost_Embed(${params}); } catch (e2) {} }`;
      containerRef.current.appendChild(s);
    });
    return () => {
      cancelled = true;
      try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speak whenever the line changes (keyed on line.key).
  useEffect(() => { speak(line); }, [line && line.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="spf-wrap" onClick={() => speak(lineRef.current)}>
      <div id="sitepal-mobile-feed" ref={containerRef} className="spf-embed" />
      <span className="spf-scan" />
      <style>{`
        .spf-wrap { position: absolute; inset: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #02100e; }
        .spf-embed { width: ${width}px; height: ${height}px; pointer-events: none; transform: scale(${faceZoom}) translateY(${faceShiftY}); transform-origin: center 38%; }
        .spf-embed canvas, .spf-embed object, .spf-embed embed, .spf-embed div { max-width: 100%; }
        .spf-scan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px); mix-blend-mode: multiply; }
      `}</style>
    </div>
  );
}
