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
//   /sitepal-test?scene=2775344&hash=Pfnc…&voice=KHYwwEInJIX7PM9tZS0K&engine=14
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

// THE DEFAULT IS NOW CONNOR'S ACTUAL SCENE, and that is a change.
//
// This page used to default to scene 2775208, which was whatever it happened
// to be pinned to when it was written. Michelle opened it on 2026-09-21 and
// got "the resource is missing" with every button inert — a dead scene embeds
// nothing, so no SitePal global is ever defined and `window.sayAudio?.()`
// silently does nothing. A diagnostic page that fails that quietly is worse
// than no page.
//
// It now defaults to the same scene the talk show gives Connor, because that
// is the portal `window.__tsPlayed` measured as starting 662ms late, so the
// experiment runs against the thing actually under suspicion rather than a
// stand-in. Source of truth is SITEPAL_PROJECTION_CONFIG in
// CyborgTempleScene.jsx; copied rather than imported because importing it
// would pull the whole three.js temple into this route.
//
//   Connor (the Demon scene) 2774900  YnR4tCeRwrDH29TfMAxvtPb4anz6oa6n  ctx 1
//   Monk / GR80              2774449  SfJwD81CkTeyemxPllatiMuMQDBGhBgZ  ctx 0
//
// Switch with ?scene=2774449&hash=SfJwD81CkTeyemxPllatiMuMQDBGhBgZ&ctx=0.
const DEFAULT_SCENE = "2774900";
const DEFAULT_HASH = "YnR4tCeRwrDH29TfMAxvtPb4anz6oa6n";
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
    // Two RECORDED clip names from the account's Audio Manager, for the
    // loading experiments below. Two different ones, so a preload of the
    // second cannot be confused with the first already being warm.
    clip: q.get("clip") || "",
    clip2: q.get("clip2") || "",
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

  // The instant the last button issued a call, so every callback can say how
  // long it took to arrive. "How long" is the whole question here: a clip that
  // has to be fetched answers late, and a warm one answers at once.
  const issuedRef = useRef(0);
  const issue = (what) => {
    issuedRef.current = performance.now();
    add(`▶ ${what}`);
  };
  /**
   * Call a SitePal global, and SAY SO when it isn't there.
   *
   * Every one of these used to be `window.sayAudio?.(…)`. When the embed
   * fails — a dead scene id, a bad hash, the functions script blocked — none
   * of the globals is ever defined, so the optional call evaluated to
   * undefined and the button looked broken in exactly the same way a broken
   * experiment would. Michelle hit that on 2026-09-21: "the resource is
   * missing. Clicking the buttons did nothing." The page has to distinguish
   * "SitePal did nothing" from "SitePal was never here".
   */
  const call = (name, ...args) => {
    if (typeof window[name] !== "function") {
      add(`❌ window.${name} is not defined — the embed never came up, so this button cannot work. ` +
        "Fix the scene before reading anything else on this page.");
      return false;
    }
    window[name](...args);
    return true;
  };

  const sinceIssued = (label, args) => {
    const ms = issuedRef.current ? Math.round(performance.now() - issuedRef.current) : null;
    const extra = args && args.length ? ` (${args.join(", ")})` : "";
    return ms === null ? `${label}${extra}` : `${label}${extra} — ${ms}ms after the call`;
  };

  useEffect(() => {
    // SitePal lifecycle callbacks.
    //
    // WIRED WIDER THAN THE DOCUMENTED LIST ON PURPOSE. The question this page
    // is now here to answer is whether SitePal ever says "this recorded clip
    // has finished loading" — the LT TV set needs that to stop two avatars
    // starting a section a few hundred ms apart, and on 2026-09-21 neither
    // the API reference (blocked at this environment's proxy) nor the support
    // forum could settle it. Defining a name SitePal never calls costs
    // nothing, so the speculative ones are defined too: if one of them fires,
    // that IS the answer, and it is marked in the log so it cannot be missed.
    const known = {
      vh_sceneLoaded: "✅ vh_sceneLoaded — scene is up",
      vh_talkStarted: "🗣 vh_talkStarted",
      vh_talkEnded: "🔇 vh_talkEnded",
      vh_audioStarted: "🔊 vh_audioStarted",
      vh_audioEnded: "🔊 vh_audioEnded",
      vh_audioStopped: "🔊 vh_audioStopped",
      vh_ttsLoaded: "💬 vh_ttsLoaded — TTS audio ready",
    };
    // Names nobody has confirmed exist. A line here is a discovery.
    const guesses = [
      "vh_audioLoaded",
      "vh_audioReady",
      "vh_audioPreloaded",
      "vh_audioProgress",
      "vh_loadComplete",
      "vh_playerLoaded",
    ];
    const wired = [];
    for (const [name, label] of Object.entries(known)) {
      window[name] = (...args) => add(sinceIssued(label, args));
      wired.push(name);
    }
    for (const name of guesses) {
      window[name] = (...args) =>
        add(sinceIssued(`⭐ ${name} FIRED — undocumented, this is the answer`, args));
      wired.push(name);
    }
    // Errors carry an audID, which is the hint that the player tracks audios
    // one by one — worth seeing in full.
    window.vh_audioError = (audID, portal, errCode, errMsg) =>
      add(`❌ vh_audioError audID=${audID} code=${errCode} ${errMsg || ""}`);
    wired.push("vh_audioError");

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
      for (const name of wired) delete window[name];
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
        <button style={btn} onClick={() => { if (call("stopSpeech")) add("stopSpeech()"); }}>
          Stop
        </button>
      </div>

      {/*
        THE TWO QUESTIONS THE LT TV SET IS STUCK ON, as buttons.

        On /trade the two avatars are told to play a section in the same tick
        and do not start together, which puts one character's whole track a few
        hundred ms out and makes some exchanges overlap. It only happens on a
        FIRST play, so it looks like the clips are being fetched cold. Fixing
        that needs two facts nobody has:

          A. Does preloading a clip make it start sooner? (Is loadAudio even
             doing anything ahead of time?)
          B. Does loadAudio interrupt a clip that is already playing? If it
             does not, the set can fetch the next section during the current
             one and the problem goes away.

        Pass two recorded clip names to use these:
          /sitepal-test?clip=lttv_rt_ep02_connor&clip2=lttv_rt_ep02_gr80
      */}
      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        <button
          style={btn}
          disabled={!cfg.clip}
          onClick={() => {
            issue(`sayAudio("${cfg.clip}") COLD — nothing preloaded`);
            call("sayAudio", cfg.clip);
          }}
        >
          A1. Say clip cold
        </button>
        <button
          style={btn}
          disabled={!cfg.clip2}
          onClick={() => {
            add(`loadAudio("${cfg.clip2}") — now wait a few seconds, then press A3`);
            call("loadAudio", cfg.clip2);
          }}
        >
          A2. Preload the other clip
        </button>
        <button
          style={btn}
          disabled={!cfg.clip2}
          onClick={() => {
            issue(`sayAudio("${cfg.clip2}") WARM — preloaded by A2`);
            call("sayAudio", cfg.clip2);
          }}
        >
          A3. Say the preloaded one
        </button>
        <button
          style={btn}
          disabled={!cfg.clip || !cfg.clip2}
          onClick={() => {
            issue(`sayAudio("${cfg.clip}"), then loadAudio("${cfg.clip2}") in 2s`);
            call("sayAudio", cfg.clip);
            setTimeout(() => {
              add(`loadAudio("${cfg.clip2}") WHILE SPEAKING — does the voice survive?`);
              call("loadAudio", cfg.clip2);
            }, 2000);
          }}
        >
          B. Preload mid-speech
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
