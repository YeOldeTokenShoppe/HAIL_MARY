// Speech director for the /main triptych.
//
// lib/oracleSpeech's speakOracle drives the ONE global SitePal player
// (window.sayText, window.vh_talkEnded). The triptych has three characters,
// each in its own iframe portal, so speech here is aimed by calling INTO a
// frame — frame.contentWindow.sayText(...) — and a turn ends when THAT frame
// posts its own talk-ended. No selectPortal, nothing to disambiguate.
// See main2_triple_portrait_panel for why one-frame-per-character exists.

// Voices. Engine 7 = SitePal's built-in TTS (numbered voices, optional
// effect/effLevel: "P" pitch ±3, "T" reverb 3, "W" whisper). Engine 14 =
// ElevenLabs via the SitePal-connected account; id = the EL voice UUID.
// TUNE: try voices live in SitePalExpressionPanel (dev-only, mounted on /main).
export const COUNSEL_VOICES = {
  // St. GR80 — "Gilbert" + cathedral reverb: the voice the character already
  // uses on /trade and in the How-to-Play intro. Keep them in sync.
  GR: { voice: "9", lang: 1, engine: 7, effect: "T", effLevel: 3 },
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
export function speakInPortal(containerId, text, voice, { watchdogMs } = {}) {
  return new Promise((resolve) => {
    const w = portalWindow(containerId);
    if (!w || typeof w.sayText !== "function" || !text) {
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
    const timer = setTimeout(() => finish(false), limit);

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
// The advisers have no SitePal player on phones (three OOM-crash iOS), so they
// speak straight from ElevenLabs through ONE reused <audio> element.
//
// Why one element, reused: iOS only lets audio start inside a user gesture, and
// that permission attaches to the ELEMENT, not the page. So we unlock a single
// element during a real tap and every later line plays through that same one.
// A fresh element per line would be blocked. Plain <audio> also needs no
// AudioContext, which keeps us clear of iOS's one-context limit.
let adviserAudio = null;

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
export async function speakAdviserLine(speaker, text, { signal } = {}) {
  const el = getAdviserAudio();
  if (!el || !text) return false;
  let url = null;
  try {
    const res = await fetch("/api/counsel-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ speaker, text }),
      signal,
    });
    // 409 = this adviser has no ElevenLabs voice configured (GR80, for now).
    if (!res.ok) return false;
    const blob = await res.blob();
    url = URL.createObjectURL(blob);
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
    console.warn("[counselSpeech] adviser voice failed:", err?.message || err);
    return false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/** Cut an adviser off mid-line (a new question interrupts the old one). */
export function stopAdviserAudio() {
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
