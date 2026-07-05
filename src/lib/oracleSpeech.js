// Speech director for the /main talking portrait.
// Takes an /api/oracle response ({ reply, expressions }) and orchestrates
// SitePal: speaks the reply and fires setFacialExpression at the annotated
// points across the (estimated) speech duration.

// Voice + engine for the oracle's spoken replies.
// Engine 14 = ElevenLabs via the SitePal-connected account; id = EL voice UUID.
export const ORACLE_VOICE = {
  id: "wLEii5giu6adITuwTzY1", // her chosen ElevenLabs voice
  lang: 1,
  engine: 14,
};

let timers = [];
let hooked = false;
let pendingExpressions = null;
let estMs = 0;

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

// Chain onto SitePal's global callbacks (preserving anything already there):
// arm expression timers when speech actually starts, clean up when it ends.
function hookCallbacks() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  const prevStart = window.vh_talkStarted;
  window.vh_talkStarted = (...args) => {
    if (pendingExpressions) {
      const exprs = pendingExpressions;
      pendingExpressions = null;
      exprs.forEach((e) => {
        const fireAt = Math.max(0, Math.min(e.at * estMs, estMs - 500));
        timers.push(
          setTimeout(() => {
            if (typeof window.setFacialExpression === "function") {
              window.setFacialExpression(e.name, e.amplitude, e.duration);
            }
          }, fireAt)
        );
      });
    }
    prevStart?.(...args);
  };
  const prevEnd = window.vh_talkEnded;
  window.vh_talkEnded = (...args) => {
    clearTimers();
    pendingExpressions = null;
    window.clearExpressionList?.();
    window.recenter?.();
    prevEnd?.(...args);
  };
}

/**
 * Speak an oracle response with timed facial expressions.
 * Interrupts any speech still playing.
 *
 * voice.xData (optional): engine-specific name-value pairs passed to SitePal
 * as xData1 — e.g. "model_id=eleven_v3" to enable ElevenLabs v3 audio tags
 * like "[softly]"/"[whispering]" in the reply text. If a call with xData
 * fails (model not available on the account), it retries once without it,
 * with any [tags] stripped so older models don't read them aloud.
 */
export function speakOracle({ reply, expressions = [] }, voice = ORACLE_VOICE) {
  if (typeof window === "undefined" || typeof window.sayText !== "function" || !reply) {
    return false;
  }
  hookCallbacks();
  clearTimers();
  window.stopSpeech?.();
  window.setPlayerVolume?.(7);
  // Rough ElevenLabs speaking pace ≈ 65ms/char; floor for very short lines
  estMs = Math.max(1800, reply.length * 65);
  pendingExpressions = expressions;
  const res = voice.xData
    ? window.sayText(reply, voice.id, voice.lang, voice.engine, "", "", voice.xData)
    : window.sayText(reply, voice.id, voice.lang, voice.engine);
  // Surface silent failures (bad voice ID, engine not enabled, domain not
  // licensed) — the promise resolves with status 1 instead of throwing
  if (res?.then) {
    res.then((r) => {
      if (r && r.status !== 0) {
        console.warn("[oracleSpeech] sayText failed:", JSON.stringify(r), "— check ORACLE_VOICE id/engine and SitePal licensed domains");
        if (voice.xData) {
          console.warn("[oracleSpeech] retrying without xData (model override unavailable?)");
          const plain = reply.replace(/\[[^\]]*\]\s*/g, "");
          window.sayText(plain, voice.id, voice.lang, voice.engine);
        }
      }
    }).catch(() => {});
  }
  return true;
}

/** POST the conversation to /api/oracle. history: [{role, text}] in drawer format. */
export async function askOracle(history, provider) {
  const messages = history.map((m) => ({
    role: m.role === "character" ? "assistant" : "user",
    content: m.text,
  }));
  const res = await fetch("/api/oracle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(provider ? { messages, provider } : { messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `oracle ${res.status}`);
  }
  return res.json(); // { reply, expressions, provider }
}
