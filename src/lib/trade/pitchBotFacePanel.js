import * as THREE from "three";
import {
  PITCH_BOT_FACE_EXPRESSIONS, PITCH_BOT_FACE_NEUTRAL, PITCH_BOT_FACE_DEFAULT,
  createFaceSurface, drawPitchBotFace,
} from "./pitchBotFaceArt";
import {
  registerFaceRenderer, unregisterFaceRenderer, setFaceManual, setFaceVoice,
  getFaceSpeech, resolveFaceExpression, assertFaceStateTicked,
} from "./pitchBotFaceState";

// THE FACE PANEL — one display, drawn every frame, instead of 27 swapped plates.
//
// WHAT THIS REPLACES. lib/trade/pitchBotExpressions drives a face by toggling
// `visible` across 24 expression plates and a 3-state viseme group. That shape is
// forced by the art: the plates are Synty line-drawings, so an expression can only
// ever be one of the drawings that exists, and a mouth can only be Closed, Mid or
// Open. Everything that module does well — the layer model, the speak-hold, the
// hysteresis — is work spent making a discrete set of drawings behave like a
// continuous face. This skips that: the face is a 2D canvas painted onto a single
// panel mesh, so an expression is a set of NUMBERS and every value between two
// expressions exists.
//
// BOTH PATHS COEXIST ON PURPOSE. init returns 0 when the glb has no Face_Panel
// mesh, so a rig still shipping plates falls through to the old module untouched.
// Call both; whichever finds its geometry takes the face. Nothing here mutates the
// plate maps next door, and the two dispose independently.
//
// THE MOUTH IS A WAVEFORM, NOT LIPS. lib/adviserMouth carries ONE amplitude scalar
// per voice — there is no phoneme alignment anywhere in this project and the TTS
// response does not carry any (see that module's note, and the viseme block in
// pitchBotExpressions, which says the same thing about the plates it drives). Lips
// driven by amplitude alone are a guess, and read as a bad one. A wave driven by
// amplitude is the honest rendering of exactly the signal we have: it is not
// pretending to be a mouth, so it cannot be caught pretending.
//
// A STANDING WAVE, THOUGH — NOT A SCROLLING ONE. This first shipped as an
// oscilloscope with a ring buffer of recent amplitude scrolling across the mouth,
// and it read as a sideways ripple rather than as speech. The lesson is general
// enough to keep: the eye reads MOTION before it reads shape, and a scrolling
// buffer's motion is lateral travel at a fixed rate that the audio does not
// control. Whatever the voice drives has to be the thing that visibly moves, and
// on a mouth that axis is vertical. See the mouth block in pitchBotFaceArt.

/* ── CONFIG ────────────────────────────────────────────────────────────────── */

export const PITCH_BOT_PANEL = {
  /** Mesh name authored in pitchbot*.blend. */
  mesh: "Face_Panel",
  /** Material name the panel gets here. MUST also be in pitchBotHolo's `exclude`
   *  list, or the holo wash repaints the screen as body surface. */
  material: "Face_Panel_MAT",
  /**
   * Canvas resolution. PORTRAIT, matching the faceplate's 7.6 x 11cm aspect —
   * the UV is a planar map of a flat plate, so a square canvas on a tall plate
   * would stretch every glyph vertically.
   */
  width: 208,
  height: 300,
  /** Redraw cap in Hz. The face carries no detail that survives 60Hz, and the
   *  texture upload is the only per-frame cost this module has. */
  fps: 30,
  /**
   * Which voice key in lib/adviserMouth feeds the waveform.
   *
   * NO DEFAULT, deliberately. This used to read "PB2", which meant a variant that
   * forgot `voice` got a face confidently lip-syncing to a DIFFERENT bot's audio —
   * a failure that looks like a working rig. setFaceVoice refuses an unknown key
   * and says so.
   */
  voice: null,
  /** Starting expression. */
  expression: PITCH_BOT_FACE_DEFAULT,
};

/* ── STATE ─────────────────────────────────────────────────────────────────── */

const state = {
  mesh: null, material: null, texture: null, surface: null, cfg: null,
  current: { ...PITCH_BOT_FACE_NEUTRAL },   // what is drawn this frame
  target:  { ...PITCH_BOT_FACE_NEUTRAL },   // what we are easing toward
  name: PITCH_BOT_FACE_DEFAULT,
  level: 0,
  gazeX: 0, gazeY: 0, saccadeX: 0, saccadeY: 0, nextSaccade: 0,
  blinkUntil: 0,
  nextBlink: 0,
  lastDraw: 0,
  t: 0,
  hidden: false,
};

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
const lerp = (a, b, k) => a + (b - a) * k;

/* ── INIT ──────────────────────────────────────────────────────────────────── */

/**
 * Find the panel in a loaded glb and take it over.
 * @returns 1 if a panel was found and bound, 0 if this rig has none.
 */
export function initPitchBotFacePanel(root, spec = {}) {
  disposePitchBotFacePanel();
  if (!root) return 0;

  const cfg = { ...PITCH_BOT_PANEL, ...spec };
  state.cfg = cfg;

  let mesh = null;
  root.traverse((n) => { if (!mesh && n.isMesh && n.name === cfg.mesh) mesh = n; });
  if (!mesh) return 0;

  const surface = createFaceSurface(cfg.width, cfg.height);
  const texture = new THREE.CanvasTexture(surface.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // FLIPPED TWICE OTHERWISE — the face renders upside down. CanvasTexture defaults
  // flipY to true, which is right for a canvas drawn against UVs authored in
  // Blender's bottom-left origin; but the glTF exporter has ALREADY inverted V on
  // the way out, because glTF's origin is top-left. Two corrections for one
  // mismatch. This is only ever right for a texture painted in code against
  // glb-imported UVs, which is exactly what this is.
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // UNLIT AND UNTONEMAPPED. The panel is a light source, not a surface catching
  // one: a MeshStandardMaterial would let the scene's grade pull the glyphs toward
  // the room, and tone mapping would crush the core back to grey exactly where it
  // is supposed to clip.
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide,
  });
  material.name = cfg.material;
  // SAYS SO ITSELF rather than trusting a name to appear in some variant's
  // `holo.exclude`. This material is unlit: the holo wash's injection reads
  // `normal` and `vViewPosition`, neither of which a MeshBasicMaterial declares,
  // so being washed is a fragment shader that does not compile and a face that
  // renders black. See the matching note in pitchBotHolo's applyPitchBotHolo.
  material.userData.holoSkip = true;

  mesh.material = material;
  mesh.renderOrder = 2;      // after the body, so the panel never loses a depth tie

  state.mesh = mesh;
  state.material = material;
  state.texture = texture;
  state.surface = surface;
  state.nextBlink = now() + 1200 + Math.random() * 2600;
  state.lastDraw = 0;

  registerFaceRenderer("panel", Object.keys(PITCH_BOT_FACE_EXPRESSIONS));
  setFaceVoice(cfg.voice);

  state.name = cfg.expression;
  state.target = { ...(PITCH_BOT_FACE_EXPRESSIONS[cfg.expression] || PITCH_BOT_FACE_NEUTRAL) };
  state.current = { ...state.target };
  return 1;
}

export function disposePitchBotFacePanel() {
  if (state.texture) state.texture.dispose();
  if (state.material) state.material.dispose();
  state.mesh = null; state.material = null; state.texture = null;
  state.surface = null; state.hidden = false;
  // Only this renderer's registration — the shared state outlives it. See the
  // matching note in disposePitchBotExpressions.
  unregisterFaceRenderer("panel");
}

export function hasPitchBotFacePanel() { return !!state.mesh; }

/* ── CONTROLS ──────────────────────────────────────────────────────────────── */

/**
 * Unknown names are REFUSED rather than defaulted, matching pitchBotExpressions:
 * silently showing Neutral because a caller typo'd "Confused" is a bug that looks
 * like art direction.
 */
export function setPitchBotPanelExpression(name, opts = {}) {
  // DELEGATED TO THE MANUAL TIER rather than set locally. Writing state.target
  // here would be overwritten on the very next tick, since the panel follows the
  // resolved expression every frame — a setter that silently loses its value one
  // frame later is worse than one that refuses.
  if (!setFaceManual(name)) return false;
  if (opts.snap && PITCH_BOT_FACE_EXPRESSIONS[name]) {
    state.name = name;
    state.target = { ...PITCH_BOT_FACE_EXPRESSIONS[name] };
    state.current = { ...state.target };
  }
  return true;
}

export function getPitchBotPanelExpression() { return state.name; }
export function listPitchBotPanelExpressions() { return Object.keys(PITCH_BOT_FACE_EXPRESSIONS); }

export function setPitchBotPanelHidden(hidden) {
  state.hidden = !!hidden;
  if (state.mesh) state.mesh.visible = !hidden;
}

/** Nudge one parameter directly — for tuning from the console. */
export function setPitchBotPanelParam(key, value) {
  if (!(key in state.target)) return false;
  state.target[key] = value;
  return true;
}

/* ── TICK ──────────────────────────────────────────────────────────────────── */

/**
 * Per-frame. Safe to call unconditionally — no-ops when this rig has no panel, so
 * it can sit next to tickPitchBotFace() for as long as both rigs are in flight.
 * @param dt seconds since last frame; falls back to its own clock.
 */
export function tickPitchBotFacePanel(dt) {
  if (!state.mesh || state.hidden) return;
  const t = now();
  const step = dt != null ? dt : Math.min((t - state.t) / 1000 || 0.016, 0.1);
  state.t = t;

  /* ── follow the tier stack ───────────────────────────────────────────────── */
  // EVERY FRAME, not on a setter. manual pin, pressure band and clip follower all
  // resolve in pitchBotFaceState, and any of the three can change without anything
  // calling in here — a pressure band arriving mid-pitch is a plain state write
  // over there, not an event.
  assertFaceStateTicked("tickPitchBotFacePanel");
  const want = resolveFaceExpression();
  if (want !== state.name && PITCH_BOT_FACE_EXPRESSIONS[want]) {
    state.name = want;
    state.target = { ...PITCH_BOT_FACE_EXPRESSIONS[want] };
  }

  /* ── audio → mouth opening ───────────────────────────────────────────────── */
  // SMOOTHED UPSTREAM. This used to run its own 0.45 exponential over
  // adviserMouth; two filters over one signal gave the plates and the panel
  // measurably different mouths on the same line.
  //
  // ONE NUMBER, NO HISTORY. There was a 72-sample ring buffer here feeding a
  // scrolling oscilloscope trace; it was removed because the scroll, not the
  // audio, was what the eye actually saw. See the mouth note in pitchBotFaceArt.
  state.level = Math.max(state.current.mouthOpen, getFaceSpeech().level);

  /* ── gaze: micro-motion, and DELIBERATELY BLIND ──────────────────────────── */
  //
  // A slow drift plus occasional saccades. This is most of what makes the face
  // read as alive, and it is generated HERE from a clock and a PRNG rather than
  // from anything the game knows.
  //
  // THAT IS A RULE, NOT A SHORTCUT. Gaze is the most expressive channel this face
  // has, which makes it the most dangerous: a bot that glanced away while lying
  // would hand the player the answer, and VC_GAME.md §1 rule 3 says the expression
  // may read pressure() and nothing else. The blink next door is exempt for
  // exactly this reason — a random timer sees nothing — and gaze earns the same
  // exemption only for as long as it stays blind. If it is ever driven, drive it
  // from pressure or from what the PLAYER did, never from the deal.
  const gt = t / 1000;
  if (t > state.nextSaccade) {
    state.saccadeX = (Math.random() * 2 - 1) * 0.55;
    state.saccadeY = (Math.random() * 2 - 1) * 0.35;
    state.nextSaccade = t + 900 + Math.random() * 2600;
  }
  state.gazeX = lerp(state.gazeX, Math.sin(gt * 0.37) * 0.22 + state.saccadeX, 0.18);
  state.gazeY = lerp(state.gazeY, Math.sin(gt * 0.23) * 0.16 + state.saccadeY, 0.18);

  /* ── blink ───────────────────────────────────────────────────────────────── */
  let blinkK = 1;
  if (t > state.nextBlink) {
    state.blinkUntil = t + 95;
    state.nextBlink = t + 1800 + Math.random() * 3800;
  }
  if (t < state.blinkUntil) blinkK = 0.08;

  /* ── ease toward the target expression ───────────────────────────────────── */
  // ~120ms to settle, framerate-independent so a 30Hz redraw and a 60Hz one land
  // on the same curve.
  const k = 1 - Math.exp(-step / 0.12);
  for (const key in state.target) {
    state.current[key] = lerp(state.current[key], state.target[key], k);
  }
  state.current.eyeOpen = Math.min(state.current.eyeOpen, state.target.eyeOpen * blinkK);
  // AFTER the lerp, never through it: gaze is per-frame micro-motion, not a
  // property of the expression, so easing it toward a preset would fight the
  // saccade and produce a face that drifts instead of flicking.
  state.current.gazeX = state.gazeX;
  state.current.gazeY = state.gazeY;

  /* ── redraw, capped ──────────────────────────────────────────────────────── */
  const interval = 1000 / state.cfg.fps;
  if (t - state.lastDraw < interval) return;
  state.lastDraw = t;
  drawPitchBotFace(state.surface, state.current, state.level, t / 1000);
  state.texture.needsUpdate = true;
}

/* ── DEBUG ─────────────────────────────────────────────────────────────────── */

// Every failure in this chain is silent and looks identical from the outside: a
// dead panel is a missing Face_Panel mesh, or a voice key absent from adviserMouth,
// or the holo wash having repainted the material. This answers which in one look.
if (typeof window !== "undefined") {
  window.__pitchBotPanel = {
    state,
    set: setPitchBotPanelExpression,
    param: setPitchBotPanelParam,
    list: listPitchBotPanelExpressions,
  };
}
