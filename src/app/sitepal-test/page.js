"use client";

// Temporary SitePal diagnostic page — renders the embed VISIBLY and unmuted,
// with buttons to exercise the TTS pipeline and a live event log.
// Visit /sitepal-test, then: 1) watch whether the avatar renders,
// 2) click "Say TTS" and watch the log + listen.
// Delete this route when done debugging.

import { useEffect, useRef, useState } from "react";

const EMBED_PARAMS = `9308752,600,800,"",1,0,2775208,0,1,0,"ems57rTHD1CA9qWccGFh3xItuvs1GN3o",0,1`;

export default function SitePalTestPage() {
  const containerRef = useRef(null);
  const [log, setLog] = useState([]);
  const add = (m) =>
    setLog((l) => [...l, `${new Date().toISOString().slice(11, 19)}  ${m}`]);

  useEffect(() => {
    // SitePal lifecycle callbacks
    window.vh_sceneLoaded = () => add("✅ vh_sceneLoaded — scene is up");
    window.vh_talkStarted = () => add("🗣 vh_talkStarted");
    window.vh_talkEnded = () => add("🔇 vh_talkEnded");
    window.vh_audioStarted = () => add("🔊 vh_audioStarted");
    window.vh_audioEnded = () => add("🔊 vh_audioEnded");
    window.vh_ttsLoaded = () => add("💬 vh_ttsLoaded — TTS audio ready");

    const s = document.createElement("script");
    s.src = "//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=9308752&js=0";
    s.onload = () => {
      add("embed functions script loaded");
      const s2 = document.createElement("script");
      s2.textContent = `AC_VHost_Embed(${EMBED_PARAMS});`;
      containerRef.current?.appendChild(s2);
      add("AC_VHost_Embed called — waiting for scene…");
    };
    s.onerror = () => add("❌ embed functions script FAILED to load");
    document.head.appendChild(s);

    return () => {
      s.remove();
      delete window.vh_sceneLoaded;
      delete window.vh_talkStarted;
      delete window.vh_talkEnded;
      delete window.vh_audioStarted;
      delete window.vh_audioEnded;
      delete window.vh_ttsLoaded;
    };
  }, []);

  const btn = {
    padding: "8px 14px",
    background: "#222",
    color: "#0ff",
    border: "1px solid #0ff",
    cursor: "pointer",
    fontFamily: "monospace",
  };

  return (
    <div
      style={{
        padding: 20,
        background: "#0a0a0f",
        minHeight: "100vh",
        color: "#7CFC00",
        fontFamily: "monospace",
        fontSize: 13,
      }}
    >
      <h2 style={{ color: "#fff" }}>SitePal embed diagnostic — scene 2775208</h2>
      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        <button style={btn} onClick={() => { window.setPlayerVolume?.(7); add(`setPlayerVolume(7) — fn ${typeof window.setPlayerVolume}`); }}>
          1. Unmute
        </button>
        <button
          style={btn}
          onClick={() => {
            add(`sayText typeof: ${typeof window.sayText}`);
            const p = window.sayText?.("Testing, one two three. Oh, hello!", 3, 1, 3);
            add("sayText called (voice 3, lang 1, engine 3)");
            if (p?.then) {
              p.then((r) => add("say promise RESOLVED: " + JSON.stringify(r))).catch(
                (e) => add("say promise REJECTED: " + JSON.stringify(e))
              );
            }
          }}
        >
          2. Say TTS
        </button>
        <button style={btn} onClick={() => { window.stopSpeech?.(); add("stopSpeech()"); }}>
          Stop
        </button>
        <button
          style={btn}
          onClick={() => {
            const c = containerRef.current?.querySelectorAll("canvas").length ?? 0;
            const v = containerRef.current?.querySelectorAll("video").length ?? 0;
            const f = containerRef.current?.querySelectorAll("iframe").length ?? 0;
            add(`container children — canvas:${c} video:${v} iframe:${f}`);
          }}
        >
          Count elements
        </button>
      </div>

      {/* Visible, unclipped, unmuted embed */}
      <div
        ref={containerRef}
        style={{ width: 600, height: 800, background: "#1a1a24", border: "1px solid #333" }}
      />

      <div style={{ marginTop: 12 }}>
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
