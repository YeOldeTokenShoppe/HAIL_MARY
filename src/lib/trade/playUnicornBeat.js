// playUnicornBeat — renders a single Unicorn beat from /api/trade/director.
//
// The Unicorn is the only /trade voice that doesn't lip-sync through SitePal.
// It speaks via its own ElevenLabs TTS (proxied by /api/trade/unicorn-voice),
// played as a decoded AudioBuffer so it stays audible on iOS Safari (where
// createMediaElementSource is silent — same gotcha as the fountain). An
// AnalyserNode drives the horn glow off the audio amplitude, and the 3D model
// plays a body gesture chosen from the beat's mood. No mouth, no visemes —
// that absence IS the character (intuition speaks without a face).
//
// Returns a Promise that resolves when the line finishes, so the beat runner
// can `await playUnicornBeat(beat, hooks)` exactly like it awaits a SitePal
// vh_talkEnded. On any TTS failure it degrades to a caption-only beat timed to
// the line length, so the scene never hangs.
//
// hooks — wire these to your CyborgTempleScene:
//   setCaption(text)   show the line (Unicorn has no mouth, so caption carries it)
//   setSpeaker('Unicorn')  spotlight/label
//   setGlow(0..1)      horn emissive intensity — read this in your R3F frame loop
//   playAnim(name)     crossfade the unicorn mixer to a body gesture
//   audioCtx           optional shared AudioContext (reuse the page's single ctx)

// Director mood → an existing unicorn animation state. Reuse what you have
// (unicorn_clapping / unicorn_disappointed / UnicornWaving from the verdict
// reaction map); add a neutral "unicorn_speak" gesture for the common cases.
const MOOD_TO_UNICORN_ANIM = {
  approving: 'unicorn_clapping',
  grave: 'unicorn_disappointed',
  playful: 'UnicornWaving',
  smug: 'unicorn_speak',
  flat: 'unicorn_speak',
  urgent: 'unicorn_speak',
};
const UNICORN_IDLE_ANIM = 'unicorn_idle';

// One shared context for the whole page (iOS allows only one live AudioContext).
function getCtx(injected) {
  if (injected) return injected;
  if (typeof window === 'undefined') return null;
  if (window.__faCtx) return window.__faCtx; // reuse the fountain's shared ctx if present
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  window.__faCtx = window.__faCtx || new Ctx();
  return window.__faCtx;
}

// Synthesize a decaying-noise impulse response so we get reverb with no asset.
let _ir = null;
function getReverbIR(ctx) {
  if (_ir && _ir.sampleRate === ctx.sampleRate) return _ir;
  const seconds = 2.6;
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
  }
  _ir = ir;
  return ir;
}

const wordCount = (s) => (s ? s.trim().split(/\s+/).length : 0);
const estimateMs = (line) => Math.max(1400, wordCount(line) * 360 + 700);

export async function playUnicornBeat(beat, hooks = {}) {
  const { setCaption, setSpeaker, setGlow, playAnim, audioCtx } = hooks;
  const line = (beat && beat.line) || '';

  console.log('[playUnicornBeat] start', { line: line.slice(0, 50) });
  setSpeaker?.('Unicorn');
  setCaption?.(line);
  playAnim?.(MOOD_TO_UNICORN_ANIM[beat?.mood] || 'unicorn_speak');

  const ctx = getCtx(audioCtx);

  // Fetch the TTS bytes. If anything fails, fall back to a caption-only beat.
  let audioBuf = null;
  if (ctx) {
    try {
      const res = await fetch('/api/trade/unicorn-voice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: line }),
      });
      console.log('[playUnicornBeat] voice route status', res.status);
      if (res.ok) {
        const bytes = await res.arrayBuffer();
        audioBuf = await ctx.decodeAudioData(bytes);
      }
    } catch (err) {
      console.warn('[playUnicornBeat] tts failed, caption-only:', err?.message || err);
    }
  }

  // No audio → hold the caption + gesture for an estimated beat, then resolve.
  if (!ctx || !audioBuf) {
    const ms = estimateMs(line);
    // Soft glow pulse so the horn still reacts even without audio.
    let raf, t0 = performance.now();
    const pulse = () => {
      const e = (performance.now() - t0) / ms;
      if (e >= 1) { setGlow?.(0); return; }
      setGlow?.(0.4 + 0.3 * Math.sin(e * Math.PI * 6));
      raf = requestAnimationFrame(pulse);
    };
    pulse();
    await new Promise((r) => setTimeout(r, ms));
    cancelAnimationFrame(raf);
    setGlow?.(0);
    playAnim?.(UNICORN_IDLE_ANIM);
    return;
  }

  // Build the graph: source → [dry + reverb] → analyser → destination.
  try { if (ctx.state === 'suspended') await ctx.resume(); } catch {}

  const src = ctx.createBufferSource();
  src.buffer = audioBuf;

  const dry = ctx.createGain(); dry.gain.value = 0.85;
  const wet = ctx.createGain(); wet.gain.value = 0.45;
  const convolver = ctx.createConvolver();
  convolver.buffer = getReverbIR(ctx);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;

  src.connect(dry).connect(analyser);
  src.connect(convolver).connect(wet).connect(analyser);
  analyser.connect(ctx.destination);

  // Drive the horn glow from the audio RMS each frame.
  const data = new Uint8Array(analyser.fftSize);
  let raf, glow = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);          // 0..~0.5
    glow += (Math.min(1, rms * 3.2) - glow) * 0.3;     // smooth
    setGlow?.(glow);
    raf = requestAnimationFrame(tick);
  };
  tick();

  await new Promise((resolve) => {
    src.onended = resolve;
    try { src.start(0); } catch { resolve(); }
  });

  cancelAnimationFrame(raf);
  setGlow?.(0);
  playAnim?.(UNICORN_IDLE_ANIM);
}
