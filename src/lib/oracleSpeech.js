// Speech director for the /main talking portrait.
// Takes an /api/oracle response ({ reply, expressions }) and orchestrates
// SitePal: speaks the reply and fires setFacialExpression at the annotated
// points across the (estimated) speech duration.

// Voice + engine for the oracle's spoken replies.
// Engine 14 = ElevenLabs via the SitePal-connected account; id = EL voice UUID.
export const ORACLE_VOICE = {
  id: "7NjvbWLjy10CTPz8IsPC", // her chosen ElevenLabs voice
  lang: 1,
  engine: 14,
};

// Greeting variety — used by the portrait tap and the chat drawer's opener.
// NOTE: SitePal caches rendered TTS by text, so after a voice change each
// line replays in the old voice once cached — reword lines to bust the cache.
export const ORACLE_GREETINGS = [
  "Oh, hello! Speak, seeker — the ticker tape hears all things.",
  "Ah, a pilgrim approaches. What troubles your portfolio today?",
  "Blessings, wanderer. The candles flicker in your favor — for now.",
  "You have found me. Ask, before the market opens its jaws again.",
  "Welcome, dear degen. Confess your positions freely.",
  "The mirror sees you, traveler. What wisdom do you seek?",
];

export function pickGreeting() {
  return ORACLE_GREETINGS[Math.floor(Math.random() * ORACLE_GREETINGS.length)];
}

// ElevenLabs (SitePal engine 14) reads the token "RL80" as "R-L-eighty".
// The project pronounces it "R-Lady" (≈ "are lady"), so rewrite it phonetically
// for the spoken audio ONLY — the on-screen reply text keeps the real "RL80"
// spelling. "R-Lady" matches the studio/how-to-play scripts so the whole app
// says the token the same way. Handles an optional "$" ticker prefix and
// RL-80 / RL 80 spacing variants.
function toSpeech(text) {
  return text.replace(/\$?\bRL[-\s]?80\b/gi, "R-Lady");
}

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
  // Phonetic rewrite for the spoken audio; the displayed reply is untouched.
  const spoken = toSpeech(reply);
  // Rough ElevenLabs speaking pace ≈ 65ms/char; floor for very short lines
  estMs = Math.max(1800, spoken.length * 65);
  pendingExpressions = expressions;
  const res = voice.xData
    ? window.sayText(spoken, voice.id, voice.lang, voice.engine, "", "", voice.xData)
    : window.sayText(spoken, voice.id, voice.lang, voice.engine);
  // Surface silent failures (bad voice ID, engine not enabled, domain not
  // licensed) — the promise resolves with status 1 instead of throwing
  if (res?.then) {
    res.then((r) => {
      if (r && r.status !== 0) {
        console.warn("[oracleSpeech] sayText failed:", JSON.stringify(r), "— check ORACLE_VOICE id/engine and SitePal licensed domains");
        if (voice.xData) {
          console.warn("[oracleSpeech] retrying without xData (model override unavailable?)");
          const plain = spoken.replace(/\[[^\]]*\]\s*/g, "");
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
