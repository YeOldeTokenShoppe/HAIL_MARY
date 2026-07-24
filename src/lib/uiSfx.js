// Mixable one-shot UI sound effects.
//
// Short UI sounds (CyberButton's slide / proceed / cancel) used to be plain
// HTMLAudioElements. On iOS a second HTMLMediaElement steals the audio session
// from the page's background music (a plain HTMLAudioElement in globalAudio.js)
// and pauses it. Routing these SFX through the ONE shared Web Audio context
// makes them MIX with the music instead of interrupting it — the same pattern
// the /fountain coin SFX and playUnicornBeat use. See memory
// ios-web-audio-single-context.

// The single shared context. In the main page window this holds a raw
// AudioContext (same convention as playUnicornBeat). The /fountain iframe keeps
// a { get, resume } wrapper in ITS own window — a different window object, so
// there's no shape clash — but we tolerate that shape here just in case.
function getCtx() {
  if (typeof window === "undefined") return null;
  const existing = window.__faCtx;
  if (existing) return typeof existing.get === "function" ? existing.get() : existing;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    window.__faCtx = new AC();
  } catch {
    return null;
  }
  return window.__faCtx;
}

const _buffers = new Map(); // url -> AudioBuffer (decoded, ready to play)
const _pending = new Set(); // urls currently decoding
const _failed = new Set(); // urls that couldn't be fetched/decoded (e.g. CORS)
const _elements = new Map(); // url -> HTMLAudioElement, used only as a fallback

function decode(url, ctx) {
  if (_buffers.has(url) || _pending.has(url) || _failed.has(url)) return;
  _pending.add(url);
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((ab) => ctx.decodeAudioData(ab))
    .then((buf) => {
      _buffers.set(url, buf);
      _pending.delete(url);
    })
    .catch(() => {
      _pending.delete(url);
      _failed.add(url); // remote URL without CORS — fall back to an element
    });
}

// Warm the buffer ahead of time so the first play already mixes. Safe to call
// on mount: decodeAudioData works on a still-suspended context.
export function preloadSfx(url) {
  if (!url) return;
  const ctx = getCtx();
  if (ctx) decode(url, ctx);
}

function playViaElement(url, volume) {
  let el = _elements.get(url);
  if (!el) {
    el = new Audio(url);
    _elements.set(url, el);
  }
  el.volume = volume;
  try {
    el.currentTime = 0;
  } catch {}
  el.play().catch(() => {});
}

// Fire a one-shot SFX. Prefers a decoded buffer (mixes, never steals the audio
// session); only falls back to an HTMLAudioElement when Web Audio is
// unavailable or the asset can't be decoded.
export function playSfx(url, { volume = 1 } = {}) {
  if (typeof window === "undefined" || !url) return;
  const ctx = getCtx();
  if (!ctx) {
    playViaElement(url, volume);
    return;
  }
  if (ctx.state !== "running") ctx.resume().catch(() => {});

  const buf = _buffers.get(url);
  if (buf) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(ctx.destination);
      src.start();
    } catch {}
    return;
  }

  // Not decoded yet. If it already failed to decode, it never will — use the
  // element. Otherwise kick off the decode (so the NEXT play mixes) and cover
  // this first click with the element so it still sounds.
  decode(url, ctx);
  playViaElement(url, volume);
}
