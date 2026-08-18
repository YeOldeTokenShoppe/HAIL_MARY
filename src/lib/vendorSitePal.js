// ── Vendor SitePal bridge (/hailmary commercial strip) ─────────────────────
// Single-host portal for the vendor characters, following the /trade pattern:
// one embed in the page document (VendorSitePalHost.jsx), scenes swapped via
// loadSceneByID(), and the live frame cropped onto the character's face mesh
// by CommercialStrip's per-frame compositor. Only one vendor speaks at a time.
//
// Speech is SitePal engine 14 — ElevenLabs THROUGH the SitePal account:
// sayText(text, <EL voice UUID>, 1, 14) speaks arbitrary text in the
// character's ElevenLabs voice with real lipsync. sayAudio is NOT used here:
// it resolves account track names only, never URLs (proven by
// /trade/spike-sayaudio).
//
// NOTE: SitePal caches rendered TTS by text — after changing a voice, reword
// the greeting lines or the old voice replays from cache.

export const VENDOR_SITEPAL_CONTAINER_ID = "vendor-sitepal-host";
export const VENDOR_SITEPAL_ACCOUNT = "9308752";

// Embed params for AC_VHost_Embed. Positional: account, h, w, bgcolor,
// firstscene, controls, sceneId, sl, load, context, embedId, version,
// responsive. context=1 is REQUIRED on a Next.js page (framework bootstrap
// path — else setPlayerVolume/saySilent/replay misbehave).
export const VENDOR_SITEPAL_EMBED_PARAMS =
  '9308752,600,800,"",1,0,2775386,0,1,1,"NnOEeZgOFXXyFlkCbvkh423d963uH40B",0,1';

// Crop region in the source SitePal canvas → the face mesh's 512² texture.
// Mutable export, read every frame — tune live from the console via
// window.__vendorSitePalCrop then paste the values back here.
export const FORTUNES_SITEPAL_CROP = {
  cropX: 194,
  cropY: 106,
  cropW: 187,
  cropH: 222,
  rotateZ: 0,
  rotateX: 0,
};

// Color correction (CSS filter values; 100 = identity) — SitePal frames come
// back washed out. Also mutable/live like the crop.
export const FORTUNES_SITEPAL_FILTER = {
  saturate: 112,
  contrast: 102,
  brightness: 124,
  hueRotate: 0,
  sepia: 34,
};

// Per-vendor registry, keyed by VENDOR_CATALOG id. `projFace` receives the
// SitePal projection; `regularFaces` are the painted face layers hidden
// while the projection is active.
export const VENDOR_SITEPAL_CONFIG = {
  fortunes: {
    sceneId: 2775386,
    voice: { voice: "3jFgoI5DB1bSRZIjmdho", lang: 1, engine: 14 },
    projFace: "Face3",
    regularFaces: ["Face1", "Face2"],
    crop: FORTUNES_SITEPAL_CROP,
    filter: FORTUNES_SITEPAL_FILTER,
    greetings: [
      "Ah. The ball has been restless all afternoon, and now I see why. Sit.",
      "The cards said nothing about you, stranger. I like that. It means tonight is still negotiable.",
      "Come closer. Every well out there dreams, and I am the only one on this field who listens.",
    ],
  },
};

// The beat between arriving at a vendor and the first word: long enough for
// the camera to settle and for her to visibly notice you (the head tracking
// is already turning her toward the camera during this pause). It also
// absorbs the async tail of a previous visit's stopSpeech — without it, a
// quick defocus/refocus let the stale stop land on the NEW line, clipping it
// after the first syllable.
export const GREETING_DELAY_MS = 1200;

const state = {
  desiredVolume: 0,
  pending: null, // { vendorId, sceneId, text, voice }
  lastGreetingIdx: {},
  sourceEl: null,
  lastSceneVersion: -1,
  speakNotBefore: 0,
  speakTimer: null,
};

const w = () => (typeof window === "undefined" ? null : window);

export function vendorSitePalReady(sceneId) {
  const win = w();
  return !!(
    win &&
    win.__vendorSitePalSceneLoaded === true &&
    win.__vendorSitePalCurrentSceneId === sceneId &&
    typeof win.sayText === "function"
  );
}

// The live SitePal frame source: the LAST canvas in the host container
// (earlier ones are bootstrap stubs). Re-acquired whenever the host bumps
// __vendorSitePalSceneVersion (initial load and every scene swap).
export function getVendorSitePalSource() {
  const win = w();
  if (!win) return null;
  const v = win.__vendorSitePalSceneVersion || 0;
  if (state.lastSceneVersion !== v || !state.sourceEl) {
    const container = document.getElementById(VENDOR_SITEPAL_CONTAINER_ID);
    if (container) {
      const canvases = container.querySelectorAll("canvas");
      if (canvases.length >= 1) state.sourceEl = canvases[canvases.length - 1];
    }
    state.lastSceneVersion = v;
  }
  return state.sourceEl;
}

function pickGreeting(vendorId, config) {
  const lines = config.greetings || [];
  if (!lines.length) return null;
  const last = state.lastGreetingIdx[vendorId];
  let idx = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && idx === last) idx = (idx + 1) % lines.length;
  state.lastGreetingIdx[vendorId] = idx;
  return lines[idx];
}

function speakNow(text, voice) {
  const win = w();
  if (!win || typeof win.sayText !== "function") return;
  try {
    if (typeof win.setPlayerVolume === "function") win.setPlayerVolume(7);
    win.sayText(text, voice.voice, voice.lang, voice.engine);
  } catch (e) {}
}

// Called by VendorSitePalHost's vh_sceneLoaded once the (possibly swapped)
// scene is up — speaks whatever activateVendorSitePal staged, holding the
// line until the greeting delay has elapsed.
export function speakPendingVendorLine() {
  const win = w();
  if (!win || !state.pending) return;
  if (state.desiredVolume <= 0) return;
  if (win.__vendorSitePalCurrentSceneId !== state.pending.sceneId) return;
  const wait = state.speakNotBefore - Date.now();
  if (wait > 0) {
    if (state.speakTimer) clearTimeout(state.speakTimer);
    state.speakTimer = setTimeout(() => {
      state.speakTimer = null;
      speakPendingVendorLine();
    }, wait);
    return;
  }
  const { text, voice } = state.pending;
  state.pending = null;
  if (text) speakNow(text, voice);
}

// Focus a vendor: raise volume, stage a greeting, swap scenes if needed.
// Speaks immediately when the right scene is already loaded.
export function activateVendorSitePal(vendorId) {
  const win = w();
  const config = VENDOR_SITEPAL_CONFIG[vendorId];
  if (!win || !config) return;
  try {
    state.desiredVolume = 7;
    win.__vendorSitePalDesiredVolume = 7;
    state.speakNotBefore = Date.now() + GREETING_DELAY_MS;
    if (state.speakTimer) { clearTimeout(state.speakTimer); state.speakTimer = null; }
    // saySilent(0) is the framework-page audio-activation primer (iOS).
    if (typeof win.saySilent === "function") { try { win.saySilent(0); } catch (e) {} }
    const text = pickGreeting(vendorId, config);
    state.pending = { vendorId, sceneId: config.sceneId, text, voice: config.voice };
    if (vendorSitePalReady(config.sceneId)) {
      speakPendingVendorLine();
    } else if (
      win.__vendorSitePalSceneLoaded === true &&
      typeof win.loadSceneByID === "function"
    ) {
      win.__vendorSitePalSceneLoaded = false;
      win.loadSceneByID(config.sceneId);
      // vh_sceneLoaded in VendorSitePalHost calls speakPendingVendorLine().
    }
    // else: host still booting — vh_sceneLoaded will pick up the pending line.
  } catch (e) {}
}

// Unfocus: mute, stop anything in flight, drop staged speech. stopSpeech()
// cannot cancel speech that hasn't STARTED, which is why pending is cleared.
export function deactivateVendorSitePal() {
  const win = w();
  if (!win) return;
  state.pending = null;
  if (state.speakTimer) { clearTimeout(state.speakTimer); state.speakTimer = null; }
  state.speakNotBefore = 0;
  state.desiredVolume = 0;
  win.__vendorSitePalDesiredVolume = 0;
  try { if (typeof win.setPlayerVolume === "function") win.setPlayerVolume(0); } catch (e) {}
  try { if (typeof win.stopSpeech === "function") win.stopSpeech(); } catch (e) {}
}

export function vendorSitePalDesiredVolume() {
  return state.desiredVolume;
}
