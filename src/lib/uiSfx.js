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
    .then((r) => { if (!r.ok) throw new Error(`sfx ${r.status}`); return r.arrayBuffer(); })
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

// True once a fetch/decode of `url` has failed (404, CORS, bad file). Lets a
// caller with a stand-in sound (`fallback`) stay audible while the real file
// is still to be authored — preload the slot on mount so the answer is known
// before the first play.
export function sfxMissing(url) {
  return _failed.has(url);
}

// Fire a one-shot SFX. Prefers a decoded buffer (mixes, never steals the audio
// session); only falls back to an HTMLAudioElement when Web Audio is
// unavailable or the asset can't be decoded. `rate` repitches (0.72 turns a
// roar into a death bellow); the element fallback plays at normal rate.
// `fallback`: another url to play instead when `url` is known to be missing.
export function playSfx(url, { volume = 1, rate = 1, fallback = null } = {}) {
  if (typeof window === "undefined" || !url) return;
  if (fallback && fallback !== url && _failed.has(url)) { playSfx(fallback, { volume, rate }); return; }
  // test/debug hook: what actually played (last 16 calls)
  window.__hmSfxLast = url; (window.__hmSfxLog ||= []).push({ t: Math.round(performance.now()), url, volume: +volume.toFixed(2), rate: +rate.toFixed(3) }); if (window.__hmSfxLog.length > 16) window.__hmSfxLog.shift();
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
      src.playbackRate.value = rate;
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

// A continuous looping SFX with live volume/pitch control — furnace beds,
// engine hums, anything that plays *while* something happens rather than
// *when* it happens. Returns a handle immediately; audio starts once the
// buffer decodes (setVolume/setRate/stop are all safe to call before then).
// `loopTrim` shaves the mp3 encoder's padding off both loop points so the
// seam doesn't click. No element fallback: a loop that can't mix through the
// shared context (the iOS rule) is better silent than session-stealing.
export function startSfxLoop(url, { volume = 1, rate = 1, loopTrim = 0.06 } = {}) {
  const handle = {
    _vol: volume, _rate: rate, _src: null, _gain: null, _stopped: false,
    setVolume(v) { this._vol = v; if (this._gain) this._gain.gain.value = v; },
    setRate(r) { this._rate = r; if (this._src) this._src.playbackRate.value = r; },
    stop(fade = 0.3) {
      this._stopped = true;
      const ctx = getCtx();
      if (this._gain && this._src && ctx) {
        try {
          this._gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
          this._src.stop(ctx.currentTime + fade);
        } catch {}
      }
    },
  };
  const ctx = getCtx();
  if (!ctx || !url) return handle;
  if (typeof window !== "undefined") { (window.__hmSfxLog ||= []).push({ t: Math.round(performance.now()), url, volume: +volume.toFixed(2), rate: +rate.toFixed(3), loop: true }); if (window.__hmSfxLog.length > 16) window.__hmSfxLog.shift(); }
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  const begin = (buf) => {
    if (handle._stopped) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = Math.min(loopTrim, buf.duration / 4);
      src.loopEnd = Math.max(buf.duration - loopTrim, buf.duration * 0.75);
      src.playbackRate.value = handle._rate;
      const gain = ctx.createGain();
      gain.gain.value = handle._vol;
      src.connect(gain).connect(ctx.destination);
      src.start(0, src.loopStart);
      handle._src = src;
      handle._gain = gain;
    } catch {}
  };
  const buf = _buffers.get(url);
  if (buf) begin(buf);
  else {
    decode(url, ctx);
    const poll = setInterval(() => {
      if (handle._stopped || _failed.has(url)) { clearInterval(poll); return; }
      const b = _buffers.get(url);
      if (b) { clearInterval(poll); begin(b); }
    }, 120);
  }
  return handle;
}
