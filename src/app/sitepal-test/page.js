"use client";

// Temporary SitePal diagnostic page — renders the embed VISIBLY and unmuted,
// with buttons to exercise the TTS pipeline and a live event log.
// Visit /sitepal-test, then: 1) watch whether the avatar renders,
// 2) click "Say TTS" and watch the log + listen.
// Delete this route when done debugging.
//
// PARAMETERISED 2026-08-03, because the one question this page could not answer
// was the one worth asking: does a GIVEN scene lip-sync a GIVEN voice? It was
// pinned to one scene and one engine, so testing another meant editing the file
// — and the failure being chased ("audio plays, mouth doesn't move") can only be
// diagnosed by A/B-ing the same call against a scene known to work.
//
//   /sitepal-test?scene=2775344&hash=JHWf…&voice=R4Zv8YQNcHyNDZl0ViUG&engine=14
//   /sitepal-test?scene=2774449&hash=SfJw…            (the Monk — known good)
//
// EMBED FRESH, NEVER loadSceneByID. Swapping scenes in a live player can leave
// the new one's audio subsystem null ("setAudioElementMode of null") and it then
// plays nothing at all — a different bug that looks adjacent to this one. Change
// the query and RELOAD.
//
// `engine`: 7 = SitePal's built-in voices (numbered), 14 = ElevenLabs through
// the connected account, where `voice` is the EL voice UUID.

import { useEffect, useRef, useState } from "react";

// The scene this page was pinned to before it took query params. Kept as the
// default so a bare /sitepal-test behaves exactly as it always did.
const DEFAULT_SCENE = "2775208";
const DEFAULT_HASH = "ems57rTHD1CA9qWccGFh3xItuvs1GN3o";
const ACCOUNT = "9308752";

function readParams() {
  const q = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  return {
    scene: q.get("scene") || DEFAULT_SCENE,
    hash: q.get("hash") || DEFAULT_HASH,
    // Defaults are the page's originals: SitePal voice 3, engine 3.
    voice: q.get("voice") || "3",
    lang: Number(q.get("lang") || 1),
    engine: Number(q.get("engine") || 3),
    text: q.get("text") || "Testing, one two three. Oh, hello!",
    /**
     * THE 10th POSITIONAL, and the reason this page could lie to you.
     *
     * SitePal's docs require context=1 under a JS framework — it switches the
     * embed to the bootstrap path where setPlayerVolume / saySilent / replay and
     * the vh_* callbacks behave (see HOST_SITEPAL_CONFIG in app/trade/page.js,
     * and note SitePalFeed hard-codes 1 for the same reason). Every raw snippet
     * the account emits has 0 there.
     *
     * Defaulted to 1, which is a CHANGE to this page: it embedded with 0 and so
     * could report a scene as mute when the only thing wrong was the flag it
     * itself passed. `?ctx=0` reproduces the old behaviour, which is worth having
     * — it is the difference between "this scene can't speak" and "this embed
     * wasn't asked properly".
     */
    ctx: Number(q.get("ctx") ?? 1),
  };
}

export default function SitePalTestPage() {
  const containerRef = useRef(null);
  const [log, setLog] = useState([]);
  // Read once, on mount: the embed is built from these and cannot be rebuilt in
  // place, so re-reading them per render would only ever disagree with what is
  // actually on screen.
  const [cfg] = useState(readParams);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
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
      const params =
        `${ACCOUNT},600,800,"",1,${cfg.ctx},${cfg.scene},0,1,${cfg.ctx},"${cfg.hash}",0,1`;
      const s2 = document.createElement("script");
      s2.textContent = `AC_VHost_Embed(${params});`;
      containerRef.current?.appendChild(s2);
      add(`AC_VHost_Embed(scene ${cfg.scene}, context ${cfg.ctx}) — waiting for scene…`);
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
      <h2 style={{ color: "#fff" }}>
        SitePal embed diagnostic — scene {cfg.scene}
        <span style={{ color: "#7CFC00", fontSize: 13, fontWeight: "normal" }}>
          {"  "}voice {String(cfg.voice)} · lang {cfg.lang} · engine {cfg.engine}
          {cfg.engine === 14 ? " (ElevenLabs)" : cfg.engine === 7 ? " (SitePal built-in)" : ""}
        </span>
      </h2>
      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        <button style={btn} onClick={() => { window.setPlayerVolume?.(7); add(`setPlayerVolume(7) — fn ${typeof window.setPlayerVolume}`); }}>
          1. Unmute
        </button>
        <button
          style={btn}
          onClick={() => {
            const c = cfgRef.current;
            add(`sayText typeof: ${typeof window.sayText}`);
            const p = window.sayText?.(c.text, c.voice, c.lang, c.engine);
            add(`sayText called (voice ${c.voice}, lang ${c.lang}, engine ${c.engine})`);
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
