// Speech director for the /main triptych.
//
// lib/oracleSpeech's speakOracle drives the ONE global SitePal player
// (window.sayText, window.vh_talkEnded). The triptych has three characters,
// each in its own iframe portal, so speech here is aimed by calling INTO a
// frame — frame.contentWindow.sayText(...) — and a turn ends when THAT frame
// posts its own talk-ended. No selectPortal, nothing to disambiguate.
// See main2_triple_portrait_panel for why one-frame-per-character exists.

import { setAdviserMouth, resetAdviserMouths } from "./adviserMouth";

// Voices. Engine 7 = SitePal's built-in TTS (numbered voices, optional
// effect/effLevel: "P" pitch ±3, "T" reverb 3, "W" whisper). Engine 14 =
// ElevenLabs via the SitePal-connected account; id = the EL voice UUID.
// TUNE: try voices live in SitePalExpressionPanel (dev-only, mounted on /main).
export const COUNSEL_VOICES = {
  // St. GR80 — his own ElevenLabs voice, the same id /api/counsel-voice serves
  // him (override there with ELEVENLABS_VOICE_GR80). This map is only read on
  // the `?triptych=1` layout, which speaks through a SitePal player; solo — the
  // default at every width — goes through speakAdviserLine and has been on this
  // voice all along. They were different voices until now: SitePal "Gilbert"
  // here, ElevenLabs there, so the same character changed voice with the layout.
  // NOTE this now diverges from /trade and the How-to-Play intro, which still
  // use Gilbert from their OWN literals (src/components/game/cases/*) — nothing
  // imports this map but /main, so aligning those is a separate, deliberate call.
  GR: { id: "JBFqnCBsd6RMkjVDRZzb", lang: 1, engine: 14 },
  // John Barron — his own ElevenLabs voice. (His scripted lines elsewhere are
  // uploaded audio, john_01..06; this is for his live, generated ones.)
  JB: { id: "IcFWazAaBzXNwLWpySgF", lang: 1, engine: 14 },
  // Our Lady — her ElevenLabs voice, set per-apparition by the caller; see
  // ORACLE_VOICE / apparitions[].voice.
  OL: null,
};

// ElevenLabs reads "RL80" as "R-L-eighty"; the shrine says "R-Lady". Spoken
// text only — the on-screen caption keeps the real spelling.
// (Mirrors lib/oracleSpeech's toSpeech.)
function toSpeech(text) {
  return String(text).replace(/\$?\bRL[-\s]?80\b/gi, "R-Lady");
}

/** The window that owns a portal's player, or null if the frame isn't up. */
export function portalWindow(containerId) {
  if (typeof document === "undefined") return null;
  const frame = document.getElementById(containerId)?.querySelector("iframe");
  return frame?.contentWindow || null;
}

/**
 * Speak one line in one character's frame; resolves when that frame reports
 * talk-ended (or the watchdog fires, so a stuck line can never wedge the
 * conversation — the same guard HowToPlayDialogue needed).
 */
/**
 * Resolve once a portal's player can actually take a line, or false on timeout.
 *
 * WHY THIS EXISTS: the portals are mounted behind `!pickerOpen` in /main, so
 * opening the apparition picker UNMOUNTS every SitePal iframe and closing it
 * mounts fresh ones that need seconds to load and register sayText. A question
 * asked in that window used to leave Our Lady MUTE — the advisers still spoke
 * (they're ElevenLabs and need no portal), she alone had no frame, and
 * speakInPortal's early return said nothing about it. The seeker saw two voices
 * argue and her line appear as text with no sound.
 */
export function waitForPortal(containerId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    const ready = () => typeof portalWindow(containerId)?.sayText === "function";
    if (ready()) return resolve(true);
    const started = Date.now();
    const tick = setInterval(() => {
      if (ready()) {
        clearInterval(tick);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(tick);
        console.warn(`[counselSpeech] portal "${containerId}" never came up in ${timeoutMs}ms`);
        resolve(false);
      }
    }, 150);
  });
}

export function speakInPortal(containerId, text, voice, { watchdogMs } = {}) {
  return new Promise((resolve) => {
    const w = portalWindow(containerId);
    // NAME THE REASON. Both of this function's failure exits used to be a bare
    // `resolve(false)`, so a mute character produced no signal anywhere — the
    // caller just moved on and the line became text-only. If you are here
    // debugging silence, this warn and the watchdog's below are the two places
    // that tell you which kind of silence it was.
    if (!w || typeof w.sayText !== "function" || !text) {
      console.warn(
        `[counselSpeech] cannot speak in "${containerId}":`,
        !text ? "empty text" : !w ? "no portal frame" : "frame has no sayText yet",
      );
      resolve(false);
      return;
    }
    const spoken = toSpeech(text);
    // Rough pace ≈ 65ms/char, floored — the watchdog only exists to unstick a
    // line whose end-event never lands, so it sits well past the estimate.
    const limit = watchdogMs ?? Math.max(6000, spoken.length * 130);

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(ok);
    };
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== w) return; // only THIS character's frame ends this turn
      if (e.data?.type === "sitepal-portal-talk-ended") finish(true);
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => {
      // Distinct from the guard above: sayText WAS called, but the frame never
      // reported talk-ended. Either it produced no audio, or the end event was
      // lost. Both look identical to a seeker — silence — so say which.
      console.warn(
        `[counselSpeech] "${containerId}" never reported talk-ended in ${limit}ms`,
      );
      finish(false);
    }, limit);

    try {
      w.stopSpeech?.();
      w.saySilent?.(0);
      w.setPlayerVolume?.(7);
      if (voice?.effect) {
        w.sayText(spoken, voice.voice ?? voice.id, voice.lang, voice.engine, voice.effect, voice.effLevel);
      } else {
        w.sayText(spoken, voice.voice ?? voice.id, voice.lang, voice.engine);
      }
    } catch (err) {
      console.warn("[counselSpeech] sayText failed:", err);
      finish(false);
    }
  });
}

/**
 * SPOTLIGHT — point one frame at a different character.
 *
 * Phones can only afford ONE live player (three OOM-crash iOS Safari), so the
 * single frame is swapped to whoever is speaking; the other panels show their
 * greyed still. Resolves when the new scene reports loaded, so the caller never
 * hands a line to a character who isn't there yet. Resolves true immediately if
 * the frame already holds that scene.
 *
 * CAUTION: loadSceneByID is the fast swap but has bitten this project before —
 * it can leave the new scene's audio subsystem null ("setAudioElementMode of
 * null") so the character won't speak (see project_main_portrait_page). The
 * How-to-Play dialogue swaps this way successfully, so it is viable with care.
 * If a swapped-in character is reliably mute, re-embed the frame (set its src)
 * instead — correct, but several seconds slower.
 */
export function swapPortalScene(containerId, sceneId, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const w = portalWindow(containerId);
    if (!w || typeof w.loadSceneByID !== "function" || !sceneId) {
      resolve(false);
      return;
    }
    if (w.__portalScene === sceneId) {
      resolve(true); // already showing this character
      return;
    }
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(ok);
    };
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.source !== w) return;
      if (e.data?.type === "sitepal-portal-ready") finish(true);
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      w.__portalScene = sceneId;
      w.loadSceneByID(sceneId);
    } catch (err) {
      console.warn("[counselSpeech] loadSceneByID failed:", err);
      finish(false);
    }
  });
}

// ── Her reactions ──
// She doesn't just wait her turn: she TURNS toward whoever is whispering and
// reacts to what they say. Both are SitePal 3D-character features, which the
// whole council is (all three frames load SitePal3DJS_R.js and her expressions
// already work on /main — SitePal only supports them for 3D characters).
//
// setGaze(degrees, duration, [amplitude]) — 0=top, 90=right, 180=bottom,
// 270=left, in SCREEN terms. Her gaze recenters by itself when the duration
// lapses OR the moment she's asked to speak, which is exactly what we want:
// she watches the advisers, then faces front to deliver her own line.
export const GAZE = { LEFT: 270, RIGHT: 90 };

// Expressions SitePal accepts (see SitePalExpressionPanel for the full list).
// The counsel endpoint picks one per adviser line.
export const REACTIONS = [
  "None", "ClosedSmile", "OpenSmile", "Sad", "Angry",
  "Fear", "Disgust", "Surprise", "Thinking", "Blush",
];

/**
 * Have the character in `containerId` look toward `degrees` and (optionally)
 * react, for `seconds`. Safe to call on a frame that isn't up yet.
 */
export function reactInPortal(containerId, { gaze, expression, seconds = 6, amplitude = 85 } = {}) {
  const w = portalWindow(containerId);
  if (!w) return false;
  try {
    if (gaze != null && typeof w.setGaze === "function") {
      w.setGaze(gaze, seconds, amplitude);
    }
    if (expression && expression !== "None" && typeof w.setFacialExpression === "function") {
      // (name, amplitude 0-1, duration seconds)
      w.setFacialExpression(expression, 0.85, seconds);
    }
    return true;
  } catch (err) {
    console.warn("[counselSpeech] reactInPortal failed:", err);
    return false;
  }
}

/** Drop any held expression and face front. */
export function recenterPortal(containerId) {
  const w = portalWindow(containerId);
  if (!w) return;
  try {
    w.clearExpressionList?.();
    w.recenter?.();
  } catch { /* frame not up */ }
}

/** Which character a spotlighted frame currently holds. */
export function portalScene(containerId) {
  return portalWindow(containerId)?.__portalScene ?? null;
}

// ── Adviser voices, without a player ──
// The advisers have no SitePal player on the solo layout (and three OOM-crash
// iOS), so they speak straight from ElevenLabs.
//
// TWO PLAYBACK PATHS, and the choice is about LIP-SYNC, not about audio:
//
//   PREFERRED — decode to an AudioBuffer and play it through a Web Audio graph
//   with an AnalyserNode. This is the only way to get the per-frame amplitude
//   that drives their 2D mouths (see [[adviserMouth]]); an <audio> element's
//   signal is unreachable, and createMediaElementSource — the usual way to tap
//   one — is SILENT on iOS (same gotcha as the fountain and playUnicornBeat).
//   Reuses the page's single shared context (window.__faCtx) because iOS allows
//   exactly one live AudioContext.
//
//   FALLBACK — the original single reused <audio> element, for anything with no
//   AudioContext at all. Their voice still plays; only the mouths stay shut.
//
// Why ONE reused element in the fallback: iOS only lets audio start inside a
// user gesture, and that permission attaches to the ELEMENT, not the page. So we
// unlock a single element during a real tap and every later line plays through
// that same one. A fresh element per line would be blocked. unlockAdviserAudio
// spends that same gesture resuming the shared AudioContext, which iOS also
// requires — one tap, both paths armed.
let adviserAudio = null;

// The in-flight buffer-source line, so a new question can cut it off. Mirrors
// playUnicornBeat's _activeBeat: whoever starts a line claims this slot, and
// every async continuation checks it still holds the slot before touching
// shared state (the mouth level).
let activeAdviserLine = null;

// ── Per-line loudness, measured up front ──
// Returns the level the mouth should treat as "wide open" for this clip.
//
// WHY THIS EXISTS: a fixed gain does not work across two voices. Measured on one
// exchange (2026-07-22) with playUnicornBeat's ×3.8: Barron pinned at the 1.0
// clamp for his whole line while GR80 peaked at 0.155. Barron's mouth would hang
// permanently open and GR80's would barely part — the two ElevenLabs voices
// simply render at different levels, and GR80's settings (stability 0.85, style
// 0.1) are a flatter delivery by design. Eugene never hit this because he is one
// voice tuned once.
//
// We already hold the entire decoded buffer before playback, so the honest
// answer is to measure it rather than guess: window the samples at the analyser's
// own fftSize and take a high PERCENTILE of the window RMS. Percentile, not max —
// one plosive or click sets a max far above the speaking level and would leave
// the whole line reading as closed.
function speakingLevel(audioBuf) {
  const ch = audioBuf.getChannelData(0);
  const win = 256; // matches analyser.fftSize below, so both measure alike
  const levels = [];
  for (let i = 0; i + win <= ch.length; i += win) {
    let sum = 0;
    for (let j = 0; j < win; j++) {
      const v = ch[i + j];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / win);
    if (rms > 0.004) levels.push(rms); // ignore the silence between words
  }
  if (!levels.length) return 0.12; // all quiet — fall back to something sane
  levels.sort((a, b) => a - b);
  const p95 = levels[Math.min(levels.length - 1, Math.floor(levels.length * 0.95))];
  // Floor it: a whispered line shouldn't be amplified into a screaming mouth.
  return Math.max(0.03, p95);
}

function getSharedCtx() {
  if (typeof window === "undefined") return null;
  if (window.__faCtx) return window.__faCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    window.__faCtx = new Ctx();
  } catch {
    return null;
  }
  return window.__faCtx;
}

function getAdviserAudio() {
  if (typeof document === "undefined") return null;
  if (!adviserAudio) {
    adviserAudio = document.createElement("audio");
    adviserAudio.preload = "auto";
    adviserAudio.playsInline = true;
  }
  return adviserAudio;
}

/**
 * Spend a user gesture unlocking the adviser audio element. Call from a real
 * tap (the input's first focus, the SPEAK button). Silent and idempotent.
 */
export function unlockAdviserAudio() {
  // Spend the gesture on the Web Audio path too — iOS starts its context
  // "suspended" and only a real user gesture may resume it. Without this the
  // first adviser line decodes fine and then plays into a suspended graph:
  // silent, and with a flat analyser the mouths never move either.
  try {
    const ctx = getSharedCtx();
    if (ctx?.state === "suspended") ctx.resume();
  } catch { /* fall through to the element path */ }

  const el = getAdviserAudio();
  if (!el || el.dataset.unlocked === "1") return;
  try {
    // A tiny silent mp3 — playing ANY source inside the gesture is what marks
    // the element as user-approved for later programmatic play().
    el.src =
      "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNJsPSCBFAlpjaawgKtwRUJUgg4YB1LmGGKKC+kfMFHXOQxq+trAdWs2/anGtNfTF/2Zwq3/6f/ULR+7/Nf5+MdWa/57/////z/pn/z/////+X/8v//5f/y//L///////8f///////8v//5f/l//L///////8f///////8v//5f/y//L///////8f///////8v//5f/y//L///////8f//////8=";
    const p = el.play();
    if (p?.then) p.then(() => el.pause()).catch(() => {});
    el.dataset.unlocked = "1";
  } catch { /* not fatal — worst case the adviser lines are silent */ }
}

/**
 * Speak an adviser's line via ElevenLabs and resolve when the audio ENDS, so
 * the argument stays paced. Resolves false if this speaker has no voice yet,
 * the request fails, or playback is blocked — the caller then holds a silent
 * reading beat instead of stalling.
 */
export async function speakAdviserLine(speaker, text, { signal, apparition } = {}) {
  if (!text) return false;

  let bytes;
  try {
    const res = await fetch("/api/counsel-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `apparition` is only meaningful for OL — the route resolves HER voice
      // from the key (her voice changes with her face). Advisers ignore it.
      body: JSON.stringify({ speaker, text, apparition }),
      signal,
    });
    // 409 = this adviser has no ElevenLabs voice configured.
    if (!res.ok) return false;
    bytes = await res.arrayBuffer();
  } catch (err) {
    console.warn("[counselSpeech] adviser voice failed:", err?.message || err);
    return false;
  }

  // ── Preferred: buffer + analyser, so the mouth can follow the voice ──
  const ctx = getSharedCtx();
  if (ctx) {
    try {
      // decodeAudioData needs its own copy: the fallback below re-reads these
      // bytes, and some implementations detach the buffer while decoding.
      const audioBuf = await ctx.decodeAudioData(bytes.slice(0));
      try { if (ctx.state === "suspended") await ctx.resume(); } catch {}

      const self = {};
      activeAdviserLine = self;
      const isCurrent = () => activeAdviserLine === self;

      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);

      // Drive the mouth from the audio RMS each frame — the same measurement
      // playUnicornBeat uses for Eugene's jaw, but normalised PER LINE against
      // this clip's own speaking level (see speakingLevel) instead of a fixed
      // gain, so both advisers articulate over the same 0..1 range no matter how
      // hot their voice renders.
      const level = speakingLevel(audioBuf);
      const data = new Uint8Array(analyser.fftSize);
      let raf;
      const tick = () => {
        if (!isCurrent()) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setAdviserMouth(speaker, Math.min(1, rms / level));
        raf = requestAnimationFrame(tick);
      };
      tick();

      await new Promise((resolve) => {
        // Interruptible: stopAdviserAudio stops the source, which resolves via
        // the same path as natural end-of-audio.
        self.stop = () => {
          try { src.onended = null; src.stop(); } catch {}
          resolve();
        };
        src.onended = resolve;
        try { src.start(0); } catch { resolve(); }
      });

      cancelAnimationFrame(raf);
      setAdviserMouth(speaker, 0);
      if (isCurrent()) activeAdviserLine = null;
      return true;
    } catch (err) {
      // Decode/playback failed — fall through to the element path rather than
      // dropping the line. Their voice matters more than their mouth.
      console.warn("[counselSpeech] adviser buffer path failed:", err?.message || err);
      setAdviserMouth(speaker, 0);
    }
  }

  // ── Fallback: the plain element. Voice plays, mouth stays shut. ──
  const el = getAdviserAudio();
  if (!el) return false;
  let url = null;
  try {
    url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    el.src = url;
    await el.play();
    await new Promise((resolve) => {
      const done = () => {
        el.removeEventListener("ended", done);
        el.removeEventListener("error", done);
        resolve();
      };
      el.addEventListener("ended", done);
      el.addEventListener("error", done);
    });
    return true;
  } catch (err) {
    console.warn("[counselSpeech] adviser playback failed:", err?.message || err);
    return false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/** Cut an adviser off mid-line (a new question interrupts the old one). */
export function stopAdviserAudio() {
  // Both paths: the buffer source (if that's what's playing) and the element.
  const line = activeAdviserLine;
  activeAdviserLine = null; // drops the analyser loop on its next tick
  try { line?.stop?.(); } catch { /* already ended */ }
  resetAdviserMouths(); // never leave a mouth frozen open mid-word
  try {
    adviserAudio?.pause();
  } catch { /* nothing playing */ }
}

/** Stop every character mid-sentence (a new question interrupts the old one). */
export function stopAllPortals(containerIds) {
  containerIds.forEach((id) => {
    try { portalWindow(id)?.stopSpeech?.(); } catch { /* frame not up */ }
  });
}

/**
 * POST the seeker's conversation to /api/counsel.
 * history: [{ role: "user"|"assistant", content }]
 * → { lines: [{s:"JB"|"GR"|"OL", t}] }, always in that order.
 */
export async function askCounsel(history) {
  const res = await fetch("/api/counsel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: history }),
  });
  if (!res.ok && res.status !== 429) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `counsel ${res.status}`);
  }
  return res.json();
}
