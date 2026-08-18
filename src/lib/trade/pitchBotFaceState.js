import { adviserMouth } from "../adviserMouth";

// WHAT THE FACE IS SAYING — renderer-agnostic. Extracted from pitchBotExpressions
// on 2026-08-06, when a second renderer arrived.
//
// WHY THIS EXISTS. The tier stack and the speaking state were both born inside the
// plate renderer, and both were gated on `state.names` — a set populated by
// traversing the glb for plate meshes. That was invisible while plates were the
// only way to have a face. The moment a rig shipped lib/trade/pitchBotFacePanel
// instead, the gate closed on a rig that HAS a face: setPitchBotExpression refused
// every name, the clip follower short-circuited, and PressSession's pressure bands
// reached nothing. The tiers were never about plates; they only lived there.
//
// WHAT MOVED: the tier stack, the clip follower, and the speech state machine.
// WHAT DID NOT: anything that renders. Plate visibility stays in
// pitchBotExpressions, canvas drawing stays in pitchBotFaceArt, and the BLINK
// stays with each renderer — it is documented over there as random-by-design and
// carries no information, so two independent timers cost nothing and unifying them
// would have entangled this module with a plate's layer/using mapping.
//
// EXACTLY ONE RENDERER IS LIVE ON ANY GIVEN RIG. Both register anyway, because
// selection is by what the glb contains and neither should have to ask.

/* ────────────────────────────────────────────────────────────────────────────
   WHAT THE FACE IS ALLOWED TO SAY — and the ORDER is a game rule, not taste.
   Carried over verbatim from pitchBotExpressions, because it is the reason this
   resolution order exists and it outlives whichever renderer is drawing.

     1. MANUAL     a debug pin (__pitchBotFace). Outranks everything, and is the
                   only tier that can show a face no game state would produce.
     2. PRESSURE   pressure().band. THE signal.
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

export const PITCH_BOT_DEFAULT_EXPRESSION = "Neutral";

/**
 * Speech constants. Defaults are the values the three-state viseme mouth was tuned
 * to against real ElevenLabs output; initPitchBotVisemes overwrites them from a
 * variant's `visemes` block so those overrides keep working.
 */
export const PITCH_BOT_SPEECH = {
  /** Exponential smoothing per frame. Raw RMS chatters on sibilants and reads as
   *  flicker rather than as speech. */
  smoothing: 0.45,
  /** Level that counts as audible for the hold below. */
  speakFloor: 0.06,
  /**
   * How long after the last audible frame the face keeps talking, in ms.
   *
   * THIS IS WHAT SEPARATES "between words" FROM "line over". The level hits 0 in
   * both cases, so without a hold a renderer that hands the mouth back at silence
   * would do it in every inter-word gap — several times a second.
   */
  speakHoldMs: 350,
};

const state = {
  /** rendererKey -> Set of names it can draw. */
  renderers: new Map(),
  /** union of every registered renderer's names. */
  names: new Set(),
  current: null,

  manual: null,
  pressure: null,
  byPressure: null,
  byClip: null,
  actions: null,
  lastDominant: null,

  voice: null,
  level: 0,
  raw: 0,
  override: null,
  lastVoiceAt: 0,
  speaking: false,

  ticked: false,
  warnedNoTick: false,
};

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

/* ── REGISTRATION ──────────────────────────────────────────────────────────── */

/**
 * Declare which expressions a renderer can draw.
 *
 * THE UNION IS THE VOCABULARY, not any one renderer's list. A name only one
 * renderer knows still resolves; the other simply doesn't draw it, which is the
 * same no-op it already performs for a layer it lacks. Refusing the union instead
 * would make the legal vocabulary depend on load order.
 */
export function registerFaceRenderer(key, names) {
  state.renderers.set(key, new Set(names || []));
  rebuildNames();
}

export function unregisterFaceRenderer(key) {
  state.renderers.delete(key);
  rebuildNames();
}

function rebuildNames() {
  state.names.clear();
  for (const set of state.renderers.values()) {
    for (const n of set) state.names.add(n);
  }
}

export function faceKnows(name) { return state.names.has(name); }
export function listFaceExpressions() { return [...state.names]; }

/* ── TIERS ─────────────────────────────────────────────────────────────────── */

/**
 * Pin an expression, or pass null to hand it back to the tiers below.
 *
 * Unknown names are REFUSED rather than defaulted: silently showing Neutral
 * because a caller typo'd "Confused" is a bug that looks like art direction.
 */
export function setFaceManual(name) {
  if (name == null) { state.manual = null; return true; }
  if (!state.names.has(name)) return false;
  state.manual = name;
  return true;
}

export function getFaceManual() { return state.manual; }

/**
 * REPORT THE PITCH'S PRESSURE BAND — the game's channel into the face.
 *
 * @param band  PRESSURE.COOL / BACKED / RATTLED / CORNERED (pressRun.js), or null
 *              when no pitch is running, which hands the face back to the ambient
 *              clip tier rather than freezing it on the last mood.
 */
export function setFacePressure(band) {
  if (state.pressure === (band || null)) return false;
  state.pressure = band || null;
  return true;
}

export function getFacePressure() { return state.pressure; }

/** Register the clip/pressure maps and the mixer actions the follower reads. */
export function setFaceMaps({ byPressure, byClip, actions } = {}) {
  if (byPressure !== undefined) state.byPressure = byPressure || null;
  if (byClip !== undefined) state.byClip = byClip || null;
  if (actions !== undefined) { state.actions = actions || null; state.lastDominant = null; }
}

/** Highest-priority tier with an opinion. */
export function resolveFaceExpression() {
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

export function getFaceExpression() { return state.current; }

/* ── SPEECH ────────────────────────────────────────────────────────────────── */

/**
 * Which adviserMouth key feeds this rig's mouth.
 *
 * REFUSED WHEN ABSENT rather than defaulted to a literal. A wrong-but-valid voice
 * code is the worst failure available here: the analyser runs, a level is produced
 * every frame, and the face lip-syncs confidently to a DIFFERENT bot's audio. A
 * missing key at least fails in one place, loudly. See lib/adviserMouth's header —
 * three separate voices have already fallen into the silent version of this.
 */
export function setFaceVoice(voice) {
  if (!voice) {
    state.voice = null;
    return false;
  }
  if (!(voice in adviserMouth)) {
    console.warn(
      `[PitchBotFace] voice "${voice}" is not a key in lib/adviserMouth — the mouth ` +
      `will never open. Add it there, and to api/counsel-voice, or the analyser ` +
      `computes a level every frame and throws all of it away.`,
    );
    state.voice = null;
    return false;
  }
  state.voice = voice;
  return true;
}

export function getFaceVoice() { return state.voice; }

/**
 * Force a mouth level, or null to follow the audio again.
 *
 *     __pitchBotMouth(0.5)   // hold it open
 *     __pitchBotMouth(null)  // back to the voice
 */
export function setFaceMouthOverride(level) {
  state.override = level == null ? null : Math.max(0, Math.min(1, Number(level) || 0));
  if (state.override != null) state.lastVoiceAt = now();
  return state.override;
}

/**
 * The speaking signal, as the renderers consume it.
 *
 * `level` IS CONTINUOUS AND STAYS THAT WAY. The three-state quantisation — the
 * 0/0.12/0.38 thresholds, the hysteresis, the dead-bands — lives in
 * pitchBotExpressions and belongs to plates alone: it exists because a hard mesh
 * swap STROBES when a level hovers on a boundary. The panel draws a waveform from
 * this number directly, and routing it through the quantiser would throw away the
 * entire reason that renderer was built.
 */
export function getFaceSpeech() {
  return {
    level: state.level, raw: state.raw, speaking: state.speaking,
    voice: state.voice, override: state.override,
  };
}

/* ── PER-FRAME ─────────────────────────────────────────────────────────────── */

/**
 * Advance the shared state. CALL ONCE PER FRAME, BEFORE any renderer tick.
 *
 * NOT SELF-GUARDING, deliberately. Both renderer ticks run every frame and either
 * could have called this itself, but "advance at most once per frame" has no
 * reliable test from in here — two calls a millisecond apart are indistinguishable
 * from two frames at a high refresh rate, and getting it wrong double-applies the
 * smoothing filter, which is a mouth that reads as sluggish for reasons nothing
 * logs. One explicit call at the top of each rAF is cheaper to keep correct.
 *
 * @returns true when something a renderer cares about changed.
 */
export function tickPitchBotFaceState() {
  state.ticked = true;
  let dirty = false;

  /* ── speech ──────────────────────────────────────────────────────────────── */
  const raw = state.override != null
    ? state.override
    : (state.voice ? adviserMouth[state.voice] || 0 : 0);
  state.raw = raw;
  state.level += (raw - state.level) * PITCH_BOT_SPEECH.smoothing;

  const t = now();
  // THE FLOOR TESTS `raw`, NOT `level`, and the distinction is the whole hold.
  // `level` is the SMOOTHED value, which decays gradually after audio stops — so
  // testing it re-arms lastVoiceAt on every frame of the decay and the hold does
  // not begin until the smoothing has bottomed out. The mouth then keeps talking
  // for speakHoldMs PLUS however long the filter takes, and at low frame rates it
  // can fail to hand back at all. `raw` goes to 0 on the frame the line ends, so
  // the hold means the number it says.
  if (raw >= PITCH_BOT_SPEECH.speakFloor) state.lastVoiceAt = t;
  const wasSpeaking = state.speaking;
  state.speaking = (t - state.lastVoiceAt) < PITCH_BOT_SPEECH.speakHoldMs;
  if (state.speaking !== wasSpeaking) dirty = true;

  /* ── clip follower ───────────────────────────────────────────────────────── */
  // Dominant by WEIGHT, not by isRunning: both clips run for the length of every
  // crossfade, so isRunning would flap. Weight resolves the tie the same way the
  // renderer does, so the face turns over at the visual midpoint of the fade
  // rather than at either end.
  if (state.byClip && state.actions && state.names.size) {
    let dominant = null;
    let best = 0;
    for (const key in state.byClip) {
      const action = state.actions[key];
      if (!action || !action.isRunning()) continue;
      const w = action.getEffectiveWeight();
      if (w > best) { best = w; dominant = key; }
    }
    // TRACKED EVEN WHILE OUTRANKED. If this bailed on a manual pin or a live band,
    // lastDominant would go stale and the face would snap to whatever clip played
    // several beats ago the moment the higher tier cleared.
    if (dominant && dominant !== state.lastDominant) {
      state.lastDominant = dominant;
      dirty = true;
    }
  }

  /* ── resolved expression ─────────────────────────────────────────────────── */
  const next = resolveFaceExpression();
  if (next !== state.current) { state.current = next; dirty = true; }

  return dirty;
}

/** Renderers call this so a forgotten tick fails loudly once instead of silently. */
export function assertFaceStateTicked(who) {
  if (state.ticked || state.warnedNoTick) return;
  state.warnedNoTick = true;
  console.warn(
    `[PitchBotFace] ${who} ticked before tickPitchBotFaceState() ever ran. The face ` +
    `will hold its default and never react to pressure, clips or audio. Call ` +
    `tickPitchBotFaceState() once per frame, ahead of the renderer ticks.`,
  );
}

/* ── REPORTING ─────────────────────────────────────────────────────────────── */

export function getPitchBotFaceStateReport() {
  return {
    expression: state.current,
    expressions: [...state.names],
    renderers: [...state.renderers.keys()],
    pinned: state.manual,
    pressure: state.pressure,
    dominantClip: state.lastDominant,
    speech: { level: +state.level.toFixed(3), speaking: state.speaking, voice: state.voice, override: state.override },
  };
}

/** Reset everything a rig owns. Renderers unregister themselves separately. */
export function disposePitchBotFaceState() {
  state.renderers.clear();
  state.names.clear();
  state.current = null;
  state.manual = null;
  state.pressure = null;
  state.byPressure = null;
  state.byClip = null;
  state.actions = null;
  state.lastDominant = null;
  state.voice = null;
  state.level = 0;
  state.raw = 0;
  state.override = null;
  state.lastVoiceAt = 0;
  state.speaking = false;
  state.ticked = false;
  state.warnedNoTick = false;
}
