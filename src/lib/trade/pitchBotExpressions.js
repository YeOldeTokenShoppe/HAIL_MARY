import * as THREE from "three";
import { adviserMouth } from "../adviserMouth";

// THE LED FACE — expression, viseme mouth and blink for the pitch-bot rigs.
//
// THE RIGS DISAGREE ABOUT WHAT A FACE IS, which is the reason for the layer
// model below rather than a flat list of face meshes:
//
//   pitchbot2  ONE plate per expression AS ORIGINALLY SHIPPED — brows, eyes and
//              mouth fused into a single ~200-vert mesh, so nothing on that face
//              could move independently of anything else. Re-imported split on
//              2026-08-02, so it now matches v3 below; the single-layer shape is
//              still supported and is what a rig looks like before that work.
//   pitchbot3  TWO plates per expression (`_Eyes` and `_Mouth`) plus a separate
//              three-state viseme group. The mouth can talk while the eyes hold
//              an expression, and the eyes can blink while the mouth talks.
//
// So an expression is applied to N LAYERS, and each layer can be overridden
// independently: the viseme group takes the mouth layer while speech is playing,
// the blink takes the eyes layer for ~100ms at a time. A rig with one layer gets
// the v2 behaviour for free, because overriding a layer it doesn't have is a
// no-op rather than a branch.
//
// glTF HAS NO VISIBILITY CHANNEL. The animation spec carries
// translation/rotation/scale/weights and nothing else, so the Blender visibility
// keyframes that authored all of this did not survive export — verified against
// both files: every clip drives only mixamorig bones, and nothing in either glb
// touches a face plate. The consequence is that a rig arrives with EVERY plate
// visible and coincident, which renders as an unreadable z-fighting smear. The
// first thing any consumer must do is switch nineteen of them off.
//
// NO TRANSFORMS. The plates are children of mixamorig:Head, so the skeleton
// carries them through every clip for free. Visibility is the only state here,
// which is also why switching expression mid-animation is safe: it cannot fight
// the mixer, because the mixer has no opinion about these nodes.

/** Shown on load. Only expression that reads as "listening". */
export const PITCH_BOT_DEFAULT_EXPRESSION = "Neutral";

/**
 * Legacy painted-face nodes, killed on sight.
 *
 * PRESENT IN NEITHER RIG — verified against both node tables. Matched anyway
 * because it costs one string to survive a re-export that brings it back, and a
 * legacy face silently sharing the head with the LED plates is the exact failure
 * that would be hardest to attribute later.
 */
const LEGACY_FACE_NODES = ["FacePlate"];

/**
 * GLTFLoader UNIQUIFIES COLLIDING NODE NAMES by appending _1, _2, ... so a
 * re-export that duplicates a plate yields `..._Eyes_1`. An exact-match filter
 * would then quietly stop finding a plate that is very much in the scene and very
 * much visible. Documented gotcha in this repo; the optional suffix is the fix.
 */
function plateRe(prefix, suffix = "") {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc(prefix)}(.+?)${esc(suffix)}(?:_\\d+)?$`);
}

/* ────────────────────────────────────────────────────────────────────────────
   WHAT THE FACE IS ALLOWED TO SAY — and the ORDER is a game rule, not taste.

     1. MANUAL     a debug pin (__pitchBotFace). Outranks everything, and is the
                   only tier that can show a face no game state would produce.
     2. PRESSURE   pressure().band. THE signal — see below.
     3. CLIP       idle/talking/bow. Ambience, and only while no band is set.

   THE EXPRESSION MAY READ pressure() AND NOTHING ELSE — VC_GAME.md §1 rule 3.
   pressure() is computed from `run.outcomes` alone: never `deal.truth`, never the
   branch, never `discriminates`. It is a summary of findings THE PLAYER HAS
   ALREADY SEEN, handed back to them, so a face keyed to it shows *what you found,
   not who you drew*, and it is AUDITABLE — two deals with opposite truths and
   identical outcome-sets produce an identical face. A performance authored per
   line, per claim, or per archetype could never make that claim, and the leak
   would be invisible: the bot would simply look shifty on the rugs, and players
   would learn to read the face instead of the evidence.

   THE MOUTH AND THE BLINK ARE EXEMPT, and for a stated reason rather than by
   oversight. The mouth tracks audio the player is already hearing; the blink is
   on a random timer that sees nothing at all. Neither can carry information the
   player doesn't have, which is the same test the clip tier passes.

   If a `byArchetype` map is ever proposed, it fails that test in one line. ───── */

const state = {
  /** layerKey -> (expressionName -> nodes[]). Order preserved for reporting. */
  layers: new Map(),
  /** every expression name any layer knows about. */
  names: new Set(),
  current: null,
  /** debug pin; outranks every other tier. */
  manual: null,
  /** pressure().band — the game signal. */
  pressure: null,
  byPressure: null,
  byClip: null,
  actions: null,
  lastDominant: null,

  /* ── VISEMES: the talking mouth ─────────────────────────────────────────── */
  /** stateName -> nodes[] (Closed / Mid / Open). */
  visemes: new Map(),
  visemeSpec: null,
  /** which expression LAYER goes dark while the viseme mouth is talking. */
  visemeSuppresses: null,
  /** adviserMouth key to read — the rig's voice code. */
  mouthVoice: null,
  visemeIndex: 0,
  mouthLevel: 0,
  mouthOverride: null,
  /** ms timestamp the level last cleared the speaking floor. */
  lastVoiceAt: 0,
  speaking: false,

  /* ── BLINK ──────────────────────────────────────────────────────────────── */
  blinkSpec: null,
  blinkUntil: 0,
  blinkNextAt: 0,

  /**
   * layerKey -> expression name, held until cleared.
   *
   * THE EMPHASIS CHANNEL. Brows split from eyes on 2026-08-02 precisely so one
   * feature can be driven against the rest — raise the brows on a question while
   * the eyes and mouth carry on with whatever the band says. Generic rather than
   * brow-specific because the layer set is per-rig config; naming a layer in the
   * API would hard-code an art decision.
   *
   * IT IS EXEMPT FROM THE §1 rule 3 CONSTRAINT ONLY IF THE CALLER KEEPS IT SO.
   * A brow raise tied to "the player asked a question" is safe — the player knows
   * they asked. A brow raise tied to whether the CLAIM is true is a tell, and a
   * subtle enough one to survive review. Drive it from interaction, never from
   * the deal.
   */
  layerOverrides: new Map(),
  /** node -> its AUTHORED transform, captured before the first align. */
  originals: new Map(),
  /** name of the plate every other plate was snapped to. */
  alignedTo: null,
  /**
   * Blanket suppression of every plate — the cast's, not the game's.
   *
   * SEPARATE FROM THE TIERS on purpose. manual/pressure/clip all answer "which
   * face"; this answers "any face at all", and it belongs to the arrival rather
   * than to the character. Folding it into resolveExpression would mean every
   * tier had to know about a state none of them cause.
   */
  suppressed: false,
};

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

/**
 * Find every plate, kill the legacy face, leave exactly one expression showing.
 *
 * Safe on a rig with no LED plates at all (v1) — it finds nothing, returns 0, and
 * every other entry point then no-ops. That is what lets pitchBotScene call this
 * unconditionally instead of branching on variant.
 *
 * @param root  the loaded gltf.scene
 * @param spec  the variant's `expressions` block: { layers, default, blink, ... }
 * @returns the number of expressions found
 */
export function initPitchBotExpressions(root, spec = {}) {
  disposePitchBotExpressions();
  if (!root || !spec.layers?.length) return 0;

  for (const layer of spec.layers) {
    const re = plateRe(layer.prefix, layer.suffix || "");
    const byName = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = re.exec(o.name);
      if (!m) return;
      if (!byName.has(m[1])) byName.set(m[1], []);
      byName.get(m[1]).push(o);
      state.names.add(m[1]);
      o.visible = false;
    });
    if (byName.size) state.layers.set(layer.key, byName);
  }

  // The legacy plate goes off and STAYS off — it is not an expression, so it must
  // never enter a layer map that renderFace() toggles.
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (LEGACY_FACE_NODES.some((n) => o.name === n || o.name.startsWith(`${n}_`))) {
      o.visible = false;
    }
  });

  if (state.layers.size === 0) return 0;

  // ABSORB THE TIER MAPS HERE TOO, even though bindPitchBotFaceSpec sets them
  // again at mount. They arrive in the SAME `expressions` block, so a caller that
  // reasonably assumes one call is enough would otherwise get a face that loads,
  // shows its default, and never reacts to a pressure band — with nothing in the
  // console to say why. bindPitchBotFaceSpec then only has to add `actions`.
  if (spec.byPressure) state.byPressure = spec.byPressure;
  if (spec.byClip) state.byClip = spec.byClip;

  if (spec.blink && state.layers.has(spec.blink.layer)) {
    state.blinkSpec = { holdMs: 100, everyMs: [2600, 6800], ...spec.blink };
    scheduleBlink();
  }

  const want = spec.default || PITCH_BOT_DEFAULT_EXPRESSION;
  state.current = state.names.has(want)
    ? want
    : state.names.has(PITCH_BOT_DEFAULT_EXPRESSION)
      ? PITCH_BOT_DEFAULT_EXPRESSION
      : [...state.names][0];

  return state.names.size;
}

/**
 * Load the viseme group — the mouth that talks.
 *
 * Separate from the expression layers because it is a different vocabulary:
 * Closed/Mid/Open are amplitude bands, not moods, and they OVERRIDE a layer
 * rather than living in one.
 */
export function initPitchBotVisemes(root, spec = {}) {
  state.visemes.clear();
  state.visemeSpec = null;
  state.visemeIndex = 0;
  state.mouthLevel = 0;
  state.mouthOverride = null;
  state.speaking = false;
  if (!root || !spec.prefix) return 0;

  const o = { ...PITCH_BOT_VISEMES, ...spec };
  const re = plateRe(o.prefix, o.suffix || "");
  root.traverse((n) => {
    if (!n.isMesh) return;
    const m = re.exec(n.name);
    if (!m) return;
    if (!state.visemes.has(m[1])) state.visemes.set(m[1], []);
    state.visemes.get(m[1]).push(n);
    n.visible = false;
  });
  if (state.visemes.size === 0) return 0;

  // Keep only the states this rig shipped, in the spec's order, so a partial
  // export degrades to fewer steps rather than throwing.
  const states = o.states.filter((s) => state.visemes.has(s.name));
  if (states.length === 0) {
    console.warn(
      `[PitchBot] found ${state.visemes.size} "${o.prefix}*" mesh(es) but none match the ` +
      `configured states (${o.states.map((s) => s.name).join(", ")}). Viseme mouth disabled.`,
    );
    state.visemes.clear();
    return 0;
  }

  state.visemeSpec = { ...o, states };
  state.visemeSuppresses = o.suppresses || null;
  state.mouthVoice = o.voice || null;
  return state.visemes.size;
}

/**
 * PUT EVERY PLATE IN THE SAME PLACE.
 *
 * THE BUG THIS FIXES, because it looks like a shader problem and is not one: the
 * plates do NOT share a transform in either rig, and the strays are never the
 * ones you would guess. Measured in head-bone space:
 *
 *   pitchbot2   Neutral -8.64 · Sad -3.29 · the other six +0.13 .. +0.52
 *   pitchbot3   Happy and Neutral authored on a different plane entirely; the
 *               other seventeen cluster within ~1.4 units of each other
 *
 * The plate is ~12 units wide in that space, so a stray hangs off the side of the
 * skull with half the face in open air. In BOTH rigs a stray landed on a plate
 * that matters more than the others — v2's default expression, v3's default AND
 * its blink target — which is what makes this so easy to misfile as "the
 * alternate expressions are broken". Nothing is broken. They are parented
 * correctly and they ride the head correctly; they were authored at different
 * offsets, and glTF preserved exactly what Blender exported.
 *
 * ALL GROUPS ARE POOLED INTO ONE VOTE, deliberately. Aligning eyes, mouths and
 * visemes separately would let each group agree internally and still sit on three
 * slightly different planes — and the viseme mouth REPLACES the expression mouth,
 * so those two disagreeing is a mouth that jumps the moment the bot speaks.
 *
 * SYMMETRY, NOT POPULARITY — and this was got wrong first, so the reasoning
 * matters. The original rule picked the transform the LARGEST group shared, which
 * is correct on v2 and WRONG ON v3. Measured in head-bone space, v3's groups sit
 * at x = -1.24 (9 plates), -1.04 (6), +0.96 (2) and 0.00 (2), and the 9-plate
 * majority is also 6.3 units too high and 10.4 too far back. Snapping to it put
 * every feature up and to the left of the skull — "a little off", which is a far
 * more expensive failure than being obviously broken.
 *
 * A HEAD IS BILATERALLY SYMMETRIC, so a correctly-placed face plate has its
 * centre on the midline: x ≈ 0 in the parent bone's frame. That is a property of
 * the thing being aligned rather than a vote about it, so it cannot be outnumbered
 * by nine plates that agree with each other and disagree with the skull. On v2 it
 * picks the same group the majority rule did (the good cluster measured ~0.2
 * against strays at -8.64 and -3.29); on v3 it picks the one that is actually
 * right. A mean or component-wise median is worse than either — on v2 the median
 * z landed at 11.46, between two clusters and therefore a position no plate was
 * ever authored at.
 *
 * PARENT SPACE NEEDS NO BONE LOOKUP: every plate is a direct child of
 * mixamorig:Head, so comparing centres in parent space IS comparing them in
 * head-bone space.
 *
 * OVERRIDE IT with `alignTo: "<PlateName>"` when the heuristic is wrong again —
 * and check with __pitchBotAlign(), which re-snaps to any plate's ORIGINAL
 * transform live so the candidates can be compared without a rebuild.
 *
 * IT IS AN AUTHORING FIX *OR* THIS. Aligning them in Blender is tidier and this
 * stays a no-op if that happens — when the transforms already agree there is
 * nothing to move. Doing it here means the rig is correct on the files we have,
 * survives a re-export that forgets, and needs no re-export to ship.
 */
export function alignPitchBotPlates(alignTo = null) {
  const all = [];
  for (const byName of state.layers.values()) {
    for (const nodes of byName.values()) all.push(...nodes);
  }
  for (const nodes of state.visemes.values()) all.push(...nodes);
  if (all.length === 0) return 0;

  // Snapshot the authored transforms ONCE, so a later re-align picks a reference
  // from the file rather than from whatever the last align already flattened
  // everything to. Without this, __pitchBotAlign could only ever return the
  // answer it was already showing.
  if (!state.originals.size) {
    for (const node of all) {
      state.originals.set(node, {
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
        scale: node.scale.clone(),
      });
    }
  }

  const orig = (n) => state.originals.get(n) || n;
  const key = (n) => {
    const o = orig(n);
    return [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()]
      .map((v) => v.toFixed(3)).join(",");
  };

  const groups = new Map();
  for (const node of all) {
    const k = key(node);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(node);
  }
  if (groups.size <= 1) return 0;

  let model = null;
  if (alignTo) {
    model = all.find((n) => n.name === alignTo)
      || all.find((n) => n.name.startsWith(alignTo));
    if (!model) {
      console.warn(`[PitchBot] alignTo "${alignTo}" matches no plate; falling back to the midline pick.`);
    }
  }

  if (!model) {
    // MIDLINE PICK. Each plate's geometry centre through its OWN authored matrix
    // gives its position in the parent bone's frame; the group whose centre sits
    // closest to x = 0 is the one actually registered to the skull.
    const centre = new THREE.Vector3();
    const m = new THREE.Matrix4();
    let best = Infinity;
    for (const nodes of groups.values()) {
      const n = nodes[0];
      if (!n.geometry) continue;
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      if (!n.geometry.boundingBox) continue;
      const o = orig(n);
      n.geometry.boundingBox.getCenter(centre);
      m.compose(o.position, o.quaternion, o.scale);
      centre.applyMatrix4(m);
      const off = Math.abs(centre.x);
      if (off < best) { best = off; model = n; }
    }
  }
  if (!model) return 0;

  const ref = orig(model);
  const moved = [];
  for (const node of all) {
    if (key(node) === key(model)) {
      // Still restore: a previous align may have moved this one away from the
      // transform it is now the reference for.
      node.position.copy(ref.position);
      node.quaternion.copy(ref.quaternion);
      node.scale.copy(ref.scale);
      continue;
    }
    node.position.copy(ref.position);
    node.quaternion.copy(ref.quaternion);
    node.scale.copy(ref.scale);
    moved.push(node.name);
  }
  if (moved.length) {
    console.warn(
      `[PitchBot] ${moved.length} plate(s) were authored off-register and have been snapped to ` +
      `"${model.name}" (${alignTo ? "explicit alignTo" : "closest to the head's midline"}). ` +
      `Fix in Blender to make this a no-op; __pitchBotAlign() to try another reference.`,
    );
  }
  state.alignedTo = model.name;
  return moved.length;
}

/** Which plate every other plate was snapped to, and the candidates. */
export function getPitchBotAlignment() {
  const seen = new Map();
  for (const [node, o] of state.originals) {
    const k = [...o.position.toArray()].map((v) => v.toFixed(1)).join(",");
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(node.name);
  }
  return {
    alignedTo: state.alignedTo,
    candidates: [...seen.values()].map((names) => ({ count: names.length, example: names[0] })),
  };
}

/* ── VISEME CONFIG ─────────────────────────────────────────────────────────── */

/**
 * AMPLITUDE, NOT PHONEMES — and the name "viseme" in the glb is the rig author's,
 * not a claim about the technique.
 *
 * WHAT DRIVES IT. counselSpeech.speakAdviserLine runs an AnalyserNode over the
 * decoded ElevenLabs buffer and writes one normalised scalar per frame into
 * lib/adviserMouth, keyed by VOICE code. The pitcher already goes through that
 * path, so by the time this reads `adviserMouth[voice]` the number is being
 * produced — nothing new is plumbed, and no second audio path can drift from the
 * first. (The key must exist in that module's map or setAdviserMouth silently
 * drops every write.)
 *
 * REAL VISEMES WOULD NEED PHONEME ALIGNMENT, which nothing in this project does
 * and the TTS response does not carry — see lib/adviserMouth's note, and the
 * "Path A: jaw flap, no visemes, no Blender" line in lib/trade/unicornMouth. This
 * is the same scalar already moving Eugene's jaw and the /main duo's sprite
 * mouths: one signal, three renderers.
 */
export const PITCH_BOT_VISEMES = {
  prefix: "Viseme_",
  /**
   * Ascending by `at`. The FIRST entry is the resting state and must sit at 0.
   *
   * Thresholds are against the PER-LINE NORMALISED level, not raw RMS:
   * speakingLevel divides by the clip's 95th percentile (not its max — one
   * plosive would otherwise set a ceiling that keeps the whole line shut), so
   * these numbers mean the same thing on a loud line and a quiet one.
   *
   * 0.12 IS THE SAME THRESHOLD PressFigure ALREADY OPENS AT against real
   * ElevenLabs output, so the "is it speaking at all" line is not a new guess;
   * only the 0.38 second step is. Simulated against a syllabic envelope these
   * split the time roughly 23 / 33 / 44 across the three plates — a mouth using
   * its whole range rather than one parked open.
   *
   * STILL OWED A REAL-AUDIO PASS. If the mouth hangs open both numbers go UP; if
   * it mumbles shut, both come DOWN. Move them together — it is the ratio between
   * them that decides whether the middle state ever reads.
   */
  states: [
    { name: "Closed", at: 0 },
    { name: "Mid", at: 0.12 },
    { name: "Open", at: 0.38 },
  ],
  /** Exponential smoothing per frame. 0.45 is PressFigure's measured value —
   *  raw RMS chatters on sibilants and reads as flicker rather than speech. */
  smoothing: 0.45,
  /**
   * Dead-band around each threshold. NOT OPTIONAL WITH THREE STATES: a level
   * hovering on a boundary flips the visible mesh every frame, which on a
   * cross-fade is a shimmer and on a hard mesh swap is a strobe. PressFigure gets
   * away without it because it has one threshold and a 60ms opacity fade.
   */
  hysteresis: 0.04,
  /**
   * How long after the last audible frame the mouth keeps talking, in ms.
   *
   * THIS IS WHAT SEPARATES "between words" FROM "line over". The level hits 0 in
   * both cases, so without a hold the expression mouth would flash back on in
   * every inter-word gap — a visible stutter several times a second. 350ms is
   * longer than a gap between words and far shorter than a gap between lines.
   */
  speakHoldMs: 350,
  /** Level that counts as audible for the hold above. */
  speakFloor: 0.06,
  /**
   * KEEP THE VISEME MOUTH ON AT ALL TIMES, resting on states[0].
   *
   * The expression `_Mouth` plates then never render — the face is _Brows +
   * _Eyes + Viseme_Closed at rest. That is the author's call and it costs the
   * per-expression mouth shapes, which stay in the glb unused; set this false to
   * get them back and the speaking handover with them.
   */
  alwaysOn: true,
};

/* ── TIERS ─────────────────────────────────────────────────────────────────── */

/**
 * Show one expression. Unknown names are refused rather than defaulted: silently
 * showing Neutral because a caller typo'd "Confused" is a bug that looks like art
 * direction.
 *
 * @param opts.manual  true (default) pins until cleared with `null`.
 */
export function setPitchBotExpression(name, opts = {}) {
  const manual = opts.manual !== false;
  if (name == null && manual) {
    state.manual = null;
    renderFace();
    return true;
  }
  if (!state.names.has(name)) return false;
  if (manual) state.manual = name;
  renderFace();
  return true;
}

export function getPitchBotExpression() { return state.current; }
export function listPitchBotExpressions() { return [...state.names]; }
export function listPitchBotLayers() { return [...state.layers.keys()]; }

/** Register the clip/pressure maps and the actions the follower reads. */
export function bindPitchBotFaceSpec(actions, spec = {}) {
  state.actions = actions || null;
  state.byPressure = spec.byPressure || null;
  state.byClip = spec.byClip || null;
  state.lastDominant = null;
  renderFace();
}

/**
 * REPORT THE PITCH'S PRESSURE BAND — the game's channel into the face.
 *
 * @param band  PRESSURE.COOL / BACKED / RATTLED / CORNERED (pressRun.js), or null
 *              when no pitch is running, which hands the face back to the ambient
 *              clip tier rather than freezing it on the last mood.
 *
 * Call it with `pressure(run).band` and nothing else.
 */
export function setPitchBotPressure(band) {
  if (state.pressure === band) return false;
  state.pressure = band || null;
  renderFace();
  return true;
}

export function getPitchBotPressure() { return state.pressure; }

/**
 * HOLD ONE LAYER on a named expression — the emphasis channel.
 *
 *     setPitchBotLayer("brows", "Surprised")  // raise them
 *     setPitchBotLayer("brows", null)         // release
 *
 * Drive it from what the PLAYER did (they pressed, they asked, they called it),
 * never from what the deal IS. See the note on state.layerOverrides: a brow that
 * moves with the truth is a tell, and a quiet one.
 *
 * Unknown layers and unknown expressions are refused rather than ignored, so a
 * typo fails at the call site instead of becoming a face that never emphasises.
 */
export function setPitchBotLayer(layer, name) {
  if (!state.layers.has(layer)) return false;
  if (name == null) state.layerOverrides.delete(layer);
  else if (state.names.has(name)) state.layerOverrides.set(layer, name);
  else return false;
  renderFace();
  return true;
}

/** Every layer currently held, as { layer: expression }. */
export function getPitchBotLayerOverrides() {
  return Object.fromEntries(state.layerOverrides);
}

/** Highest-priority tier with an opinion. */
function resolveExpression() {
  if (state.manual && state.names.has(state.manual)) return state.manual;
  if (state.pressure && state.byPressure) {
    const want = state.byPressure[state.pressure];
    if (want && state.names.has(want)) return want;
  }
  if (state.byClip && state.lastDominant) {
    const want = state.byClip[state.lastDominant];
    if (want && state.names.has(want)) return want;
  }
  return state.current || PITCH_BOT_DEFAULT_EXPRESSION;
}

/* ── RENDER ────────────────────────────────────────────────────────────────── */

/**
 * THE ONLY PLACE `.visible` IS TOUCHED, and it recomputes from scratch every
 * time rather than toggling incrementally.
 *
 * WHY FULL RECOMPUTE. Three independent things now claim parts of this face —
 * the expression tiers, the viseme mouth, the blink — and they overlap: a blink
 * during speech overrides the eyes while the visemes own the mouth. Incremental
 * toggles would need every pair of those to agree about who turns what back on,
 * and the failure mode is a plate stuck visible with no obvious owner. Nineteen
 * booleans a frame is nothing; the invariant "exactly one plate per layer" being
 * enforced in one function is worth a great deal.
 */
function renderFace() {
  if (state.layers.size === 0) return;

  if (state.suppressed) {
    for (const byName of state.layers.values()) {
      for (const nodes of byName.values()) {
        for (let i = 0; i < nodes.length; i++) nodes[i].visible = false;
      }
    }
    for (const nodes of state.visemes.values()) {
      for (let i = 0; i < nodes.length; i++) nodes[i].visible = false;
    }
    return;
  }

  const expr = resolveExpression();
  state.current = expr;

  const blinking = state.blinkSpec && now() < state.blinkUntil;
  /**
   * THE MOUTH IS ALWAYS A VISEME on an `alwaysOn` rig (author, 2026-08-02): rest
   * is _Brows + _Eyes + Viseme_Closed, and the expression's own _Mouth plate is
   * never shown at all.
   *
   * THIS DELETES THE HANDOVER, and with it the thing the handover could get
   * wrong. The previous model swapped the expression mouth out when speech
   * started and back in when it stopped, which is why speakHoldMs exists — an
   * inter-word gap drops the level to 0 exactly like the end of a line does, so
   * without a hold the expression mouth flashed back on several times a second.
   * With the viseme group permanently in charge, a gap simply closes the mouth,
   * which is what a mouth does between words. `speaking` and `speakHoldMs` still
   * govern rigs that set alwaysOn false.
   */
  const visemesLive = state.visemes.size > 0
    && (state.visemeSpec?.alwaysOn || state.speaking);

  for (const [layerKey, byName] of state.layers) {
    let want = expr;
    // EMPHASIS. A held override for one layer — brows raised on a question while
    // the rest of the face carries on with the band.
    const held = state.layerOverrides.get(layerKey);
    if (held && state.names.has(held)) want = held;
    // BLINK takes the eyes layer, and outranks the override: it is momentary, and
    // eyes pinned open through every blink read as a stare. Skipped when the plate
    // already showing IS the blink plate (Happy is both a pressure face and the
    // closed-arc eyes), since swapping Happy for Happy is an invisible blink that
    // still costs a frame.
    if (blinking && layerKey === state.blinkSpec.layer && want !== state.blinkSpec.using) {
      want = state.blinkSpec.using;
    }
    // VISEMES own the mouth layer — for the length of a line, or permanently.
    const suppressed = visemesLive && layerKey === state.visemeSuppresses;
    for (const [name, nodes] of byName) {
      const on = !suppressed && name === want;
      for (let i = 0; i < nodes.length; i++) nodes[i].visible = on;
    }
  }

  const vState = visemesLive ? state.visemeSpec?.states?.[state.visemeIndex]?.name : null;
  for (const [name, nodes] of state.visemes) {
    const on = name === vState;
    for (let i = 0; i < nodes.length; i++) nodes[i].visible = on;
  }
}

/* ── PER-FRAME ─────────────────────────────────────────────────────────────── */

/** Advance the viseme mouth from the audio analyser. */
function tickVisemes() {
  const spec = state.visemeSpec;
  if (!spec || state.visemes.size === 0) return false;

  const raw = state.mouthOverride != null
    ? state.mouthOverride
    : (state.mouthVoice ? adviserMouth[state.mouthVoice] || 0 : 0);

  state.mouthLevel += (raw - state.mouthLevel) * spec.smoothing;
  const level = state.mouthLevel;

  const t = now();
  // THE FLOOR TESTS `raw`, NOT `level`, and the distinction is the whole hold.
  // `level` is the SMOOTHED value, which decays gradually after audio stops — so
  // testing it re-arms lastVoiceAt on every frame of the decay and the hold does
  // not begin until the smoothing has bottomed out. The mouth then keeps talking
  // for speakHoldMs PLUS however long the filter takes, and at low frame rates it
  // can fail to hand back at all. `raw` goes to 0 on the frame the line ends, so
  // the hold means the number it says.
  if (raw >= spec.speakFloor) state.lastVoiceAt = t;
  const wasSpeaking = state.speaking;
  state.speaking = (t - state.lastVoiceAt) < spec.speakHoldMs;

  // Rise and fall one band at a time, each move needing the level to clear the
  // boundary by `hysteresis`. Stepping rather than jumping also means a sudden
  // loud onset opens THROUGH the middle state instead of snapping past it, which
  // is what makes a three-state mouth read as a mouth.
  const states = spec.states;
  let i = state.visemeIndex;
  while (i < states.length - 1 && level >= states[i + 1].at + spec.hysteresis) i++;
  while (i > 0 && level < states[i].at - spec.hysteresis) i--;

  const changed = i !== state.visemeIndex || state.speaking !== wasSpeaking;
  state.visemeIndex = i;
  return changed;
}

function scheduleBlink() {
  const [lo, hi] = state.blinkSpec.everyMs;
  state.blinkNextAt = now() + lo + Math.random() * Math.max(0, hi - lo);
}

/**
 * Blink on a random timer.
 *
 * RANDOM ON PURPOSE, and it is the one thing on this face allowed to be: a blink
 * on a fixed interval reads as a metronome, and unlike the expression it carries
 * no information for the timing to leak. Nothing about the deal is in scope here.
 */
function tickBlink() {
  if (!state.blinkSpec) return false;
  const t = now();
  if (t >= state.blinkNextAt) {
    state.blinkUntil = t + state.blinkSpec.holdMs;
    scheduleBlink();
    return true;
  }
  // One frame of change when the blink ends, so renderFace runs to close it.
  return state.blinkUntil !== 0 && t >= state.blinkUntil
    ? ((state.blinkUntil = 0), true)
    : false;
}

/**
 * Advance the whole face. Call once per frame.
 *
 * ONE CALL FOR THREE SYSTEMS, so CyborgTempleScene's useFrame keeps a single
 * line. Each sub-tick reports whether anything changed and renderFace runs only
 * when something did — the common case is a frame where the mouth is between
 * thresholds and nothing moves at all.
 */
export function tickPitchBotFace() {
  let dirty = false;
  if (tickVisemes()) dirty = true;
  if (tickBlink()) dirty = true;

  // CLIP FOLLOWER. Dominant by WEIGHT, not by isRunning: both clips run for the
  // length of every crossfade, so isRunning would flap. Weight resolves the tie
  // the same way the renderer does, so the face turns over at the visual midpoint
  // of the fade rather than at either end.
  if (state.byClip && state.actions && state.names.size) {
    let dominant = null;
    let best = 0;
    for (const key in state.byClip) {
      const action = state.actions[key];
      if (!action || !action.isRunning()) continue;
      const w = action.getEffectiveWeight();
      if (w > best) { best = w; dominant = key; }
    }
    // TRACKED EVEN WHILE OUTRANKED. If this bailed on a manual pin or a live
    // band, lastDominant would go stale and the face would snap to whatever clip
    // played several beats ago the moment the higher tier cleared.
    if (dominant && dominant !== state.lastDominant) {
      state.lastDominant = dominant;
      dirty = true;
    }
  }

  if (dirty) renderFace();
}

/* ── DEBUG / REPORTING ─────────────────────────────────────────────────────── */

/**
 * Force a mouth level, or null to follow the audio again.
 *
 *     __pitchBotMouth(0.5)   // hold it open
 *     __pitchBotMouth(null)  // back to the voice
 */
export function setPitchBotMouthLevel(level) {
  state.mouthOverride = level == null ? null : Math.max(0, Math.min(1, Number(level) || 0));
  if (state.mouthOverride != null) state.lastVoiceAt = now();
  return state.mouthOverride;
}

export function getPitchBotMouth() {
  return {
    visemes: [...state.visemes.keys()],
    active: state.speaking ? state.visemeSpec?.states?.[state.visemeIndex]?.name ?? null : null,
    speaking: state.speaking,
    alwaysOn: !!state.visemeSpec?.alwaysOn,
    resting: state.visemeSpec?.states?.[0]?.name ?? null,
    level: +state.mouthLevel.toFixed(3),
    voice: state.mouthVoice,
    override: state.mouthOverride,
    suppresses: state.visemeSuppresses,
    enabled: !!state.visemeSpec,
  };
}

/**
 * Hide or show EVERY plate at once — used by the cast while the body is still
 * fading in, so the LED face does not arrive a beat ahead of the figure it is on.
 *
 * Cheap to call every frame: it early-returns unless the flag actually changed,
 * so the per-frame driver needs no edge detection of its own.
 */
export function setPitchBotFaceHidden(hidden) {
  const next = !!hidden;
  if (state.suppressed === next) return false;
  state.suppressed = next;
  // Force a repaint on the way back: renderFace short-circuits while suppressed,
  // so `current` is stale and the usual no-change guard would skip the restore.
  if (!next) state.current = null;
  renderFace();
  return true;
}

/** Fire a blink now, for inspection. */
export function blinkPitchBot() {
  if (!state.blinkSpec) return false;
  state.blinkUntil = now() + state.blinkSpec.holdMs;
  renderFace();
  return true;
}

export function getPitchBotFaceState() {
  return {
    expression: state.current,
    layers: [...state.layers.keys()],
    expressions: [...state.names],
    pinned: state.manual,
    pressure: state.pressure,
    held: Object.fromEntries(state.layerOverrides),
    blink: state.blinkSpec
      ? { layer: state.blinkSpec.layer, using: state.blinkSpec.using, holdMs: state.blinkSpec.holdMs }
      : null,
  };
}

/** Drop every reference. Call on unmount, beside disposePitchBotHolo. */
export function disposePitchBotExpressions() {
  state.layers.clear();
  state.names.clear();
  state.visemes.clear();
  state.current = null;
  state.manual = null;
  state.pressure = null;
  state.byPressure = null;
  state.byClip = null;
  state.actions = null;
  state.lastDominant = null;
  state.visemeSpec = null;
  state.visemeSuppresses = null;
  state.mouthVoice = null;
  state.visemeIndex = 0;
  state.mouthLevel = 0;
  state.mouthOverride = null;
  state.lastVoiceAt = 0;
  state.speaking = false;
  state.blinkSpec = null;
  state.blinkUntil = 0;
  state.blinkNextAt = 0;
  state.layerOverrides.clear();
  state.originals.clear();
  state.alignedTo = null;
  state.suppressed = false;
}

/**
 * Bind-pose height of the loaded rig, in the units `root` currently sits in.
 *
 * SKINNED MESHES NEED SkinnedMesh.computeBoundingBox, NOT geometry.boundingBox.
 * The geometry box is the raw attribute extent, and on a Mixamo rig the mesh node
 * hangs under an Armature carrying the convention 0.01 scale — so putting the
 * geometry box through matrixWorld reports this 1.8-unit bot as 0.018 units tall
 * and any fit derived from it lands two orders of magnitude out. computeBoundingBox
 * walks the vertices through the skeleton (three r165+) and returns the extent the
 * renderer will actually draw, in mesh-local space, which matrixWorld then takes
 * to world correctly.
 *
 * Costs a full vertex walk — ~19k verts here, once, at load. Not per frame.
 */
export function measurePitchBotHeight(root, exclude = null) {
  if (!root) return null;
  const skip = exclude ? new Set(exclude) : null;
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.updateWorldMatrix(true, true);

  // Every face plate is excluded: all but one per group is switched off by the
  // time anyone measures, so including them would make the height depend on
  // which expression — or which mouth state — happened to be showing.
  const plates = new Set();
  for (const byName of state.layers.values()) {
    for (const nodes of byName.values()) for (const n of nodes) plates.add(n);
  }
  for (const nodes of state.visemes.values()) for (const n of nodes) plates.add(n);

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || plates.has(o)) return;
    // ACCESSORIES ARE NOT STATURE. A hairdo that reaches above the skull makes the
    // rig measure taller, and fitting THAT to a height shrinks the body to
    // compensate — so the same fitHeight produced a 0.30 figure on one rig and a
    // 0.18 figure on another whose only difference was hair. Excluded by name, so
    // the number means "how tall is the person" on every rig.
    if (skip?.has(o.name)) return;
    if (o.userData?.holoDepthTwin) return;
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      if (o.boundingBox) { box.union(tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld)); return; }
    }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (!o.geometry.boundingBox) return;
    box.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  if (box.isEmpty()) return null;
  return { y0: box.min.y, y1: box.max.y, height: box.max.y - box.min.y };
}
