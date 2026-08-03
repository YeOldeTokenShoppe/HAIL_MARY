import * as THREE from "three";
import {
  applyPitchBotHolo, PITCH_BOT_HOLO, startPitchBotCast, pitchBotCastState,
  tunePitchBotHolo,
} from "./pitchBotHolo";
import {
  initPitchBotExpressions, setPitchBotExpression, getPitchBotExpression,
  listPitchBotExpressions, bindPitchBotFaceSpec, disposePitchBotExpressions,
  setPitchBotPressure, getPitchBotPressure,
  initPitchBotVisemes, alignPitchBotPlates, getPitchBotAlignment, setPitchBotMouthLevel,
  setPitchBotLayer, getPitchBotLayerOverrides,
  getPitchBotMouth, getPitchBotFaceState, blinkPitchBot,
  measurePitchBotHeight, PITCH_BOT_DEFAULT_EXPRESSION,
} from "./pitchBotExpressions";
import { rollPitcher } from "@/game/terminal-traders/press/pitchers";

// THE PITCH BOT, IN THE ROOM — everything the temple scene needs to host the VC
// game's pitcher, kept out of CyborgTempleScene.jsx.
//
// WHY A MODULE AND NOT AN R3F COMPONENT. The temple is loaded imperatively:
// one GLTFLoader inside a useEffect, characters registered into mixersRef /
// actionsRef, focus resolved from AGENT_CAMERA_SETTINGS by agentId. A declarative
// <PitchBot /> would need its own loader, would not be parented into templeScene,
// and — the real blocker — would not appear in the refs the focus and animation
// systems read. So this is an imperative mount that borrows the caller's already
// Draco-configured loader, and CyborgTempleScene keeps a single call site.
//
// NOT DERIVED FROM HolographicStatue3. That component is live on the root page
// and is not to be touched. The holographic APPEARANCE is reimplemented in
// ./pitchBotHolo for a hard technical reason documented there: the statue's raw
// ShaderMaterial has no skinning chunks, and this bot's body is a SkinnedMesh —
// it would render frozen in bind pose while the mixer drove the bones.

/* ────────────────────────────────────────────────────────────────────────────
   TWO RIGS, ONE MOUNT.

   v1 is the shipped pitcher. v2 is a second, unrelated robot with an LED face,
   added 2026-08-02 as an ALTERNATE — not a replacement. Both stay in the tree and
   either can be staged; v1 remains the default until the swap is an art call
   rather than an experiment.

   WHAT ACTUALLY DIFFERS between them, and therefore what has to be per-variant
   rather than global:

     CLIP NAMES.       v1 authored `idle` / `talking`. v2 is Mixamo: `Stand_Idle`,
                       `Talking`, `Formal_Bow`. CyborgTempleScene's speech effect
                       reads `actions.idle` and `actions.talking` by those exact
                       names, so v2's clips are registered under CANONICAL aliases
                       as well as their own names (see registerActions). Without
                       that, swapping variants leaves a bot that loads, poses, and
                       never moves — no error anywhere.
     THE FACE.         v1's face is one plate driven by pressure() textures. v2
                       and v3 each carry NINETEEN plates — eight expressions in an
                       `_Eyes` and a `_Mouth` layer, plus three visemes. All are
                       held out of the holographic wash for the same reason: they
                       are the one surface that has to keep reading as a screen.
     SCALE.            v1's 0.31 was tuned in-browser against a 1.207-unit rig.
                       v2's rig measures 1.806, so a raw scale means nothing
                       across the two. v2 therefore asks for a HEIGHT and lets the
                       code solve for the scale — see fitHeight, which also
                       records why the two rigs are NOT staged at the same height,
                       and the warning about paper-derived numbers on
                       PITCH_BOT_STAGING.position.

   WHAT IS DELIBERATELY SHARED: position, the holo treatment, billboarding, the
   cast, the mixer/action plumbing and every debug handle. A variant that had to
   restate those would be a second implementation wearing a config's clothes. */

/**
 * CAMERA FRAMING when the room focuses the pitcher — the default, which is also
 * v1's authored values.
 *
 * PER-VARIANT CAPABLE, but as of 2026-08-02 ALL THREE RIGS SHARE THIS ONE BLOCK —
 * add a `framing` to a variant only when it genuinely needs its own.
 *
 * THESE NUMBERS ONLY MEAN THE SAME THING ON RIGS OF THE SAME HEIGHT. `aimDrop`
 * and `camLift` are absolute world offsets, not fractions of the figure, so a rig
 * staged taller is framed lower on its body by exactly the ratio of the two
 * heights. v2 and v3 are both fitted to 0.300; if a rig ever diverges from that,
 * scale these with it or give it its own block.
 *
 * Dial with __pitchBotFrame({...}), which re-fires the focus so the change is
 * visible, then paste into the ACTIVE variant's `framing` — not this block,
 * unless you have checked every rig.
 */
export const PITCH_BOT_FRAMING_DEFAULT = {
  /** How far back the camera sits, in world units. Smaller = tighter. */
  dist: 0.42,
  /** How far BELOW the face to aim, so the head sits high in frame rather than
   *  dead centre. Raise this to lift the subject without tilting the camera. */
  aimDrop: 0.6,
  /** Camera lift relative to the face. Near zero = eye level; positive looks down. */
  camLift: -0.5,
};

/** Resolve the framing for a variant, falling back to the shared default. */
export function getPitchBotFraming(variant = null) {
  return { ...PITCH_BOT_FRAMING_DEFAULT, ...(getPitchBotConfig(variant).framing || {}) };
}

/** Rig-independent staging. Everything here was tuned for the room, not the bot. */
const PITCH_BOT_STAGING = {
  // TUNED IN-BROWSER 2026-07-29, and the DERIVATION matters more than the number
  // because this is a local offset in a parented chain:
  //
  //   analysts' empties sit at world y ~= -1.30 (Demon) .. -1.15 (Unicorn)
  //   this puts the bot's BASE at world y = -0.749
  //   i.e. a deliberate 0.55 CLEARANCE above their plane
  //
  // IT FLOATS ON PURPOSE. Standing it on the floor was right while it was a
  // solid body; it is a projection now, and a hologram with its feet on the
  // ground reads as a person the room can't quite render. Raised on the author's
  // call, 2026-07-29.
  //
  // ONE LOCAL UNIT IS 1.2 WORLD UNITS here — the parent chain carries a 1.2x
  // scale. Do NOT derive a new offset on paper: measure. The first guess buried
  // it 1.6 units under the floor, and an intermediate reading during tuning
  // reported the base 1.8 units off, which is what a hand-computed offset would
  // have baked in. `__pitchBotTune({ y })` and re-measure is the reliable loop.
  //
  // SHARED ACROSS VARIANTS, and it survives a rig swap only because both rigs
  // have their local origin at the feet and fitHeight lands them at the same
  // height. Change either of those and this becomes per-variant.
  position: [-0.04, 1.362, 0.02],
  rotation: [0, 0, 0],
  // HIDDEN ON ARRIVAL. CyborgTempleScene turns it on when pressMode goes true;
  // loading it visible put the pitcher in the lobby with no game running.
  visible: false,
  /** Project it, rather than stand it in the room. */
  holographic: true,
  /**
   * FACE THE CAMERA. Yaw only — a projection that pitches and rolls to follow the
   * eye reads as a model being puppeted, not as an image being cast.
   */
  billboard: true,
  /**
   * MODEL-FORWARD CORRECTION, in radians.
   *
   * three's `Object3D.lookAt` points a NON-camera object's **+Z** at the target
   * (it swaps the eye/target arguments for anything that isn't a camera or a
   * light — cameras get -Z). Whether that is the rig's front depends entirely on
   * how it was exported, so this exists rather than being assumed. Dial it live:
   *
   *     __pitchBotFacing(180)    // degrees; returns the radian value to paste here
   */
  yawOffset: 0,
};

export const PITCH_BOT_VARIANTS = {
  /** The shipped pitcher. Hand-tuned; do not re-derive. */
  v1: {
    ...PITCH_BOT_STAGING,
    label: "pitch-bot (original)",
    // VERSIONED AS OF THE 2026-08-02 RE-IMPORT. It went unversioned for as long
    // as the bytes never moved — bumping a key that is not poisoned throws away a
    // warm edge entry to fix nothing. That stopped being true the moment the file
    // changed: an unversioned URL with a warm CDN entry now serves the OLD
    // geometry, and since fitHeight normalises size away the symptom would not be
    // a wrong-sized bot but a silently stale one. Bump on every re-export.
    url: "/models/pitch-bot.glb?v=1",
    /**
     * FITTED LIKE THE OTHERS as of 2026-08-02, so all three rigs stand the same
     * height and one framing block serves them all.
     *
     * IT WAS A LITERAL SCALE until now — 0.41, eyeballed, from back when this was
     * the only rig and a raw number could mean something. It cannot across rigs:
     * 0.41 is a sensible bot on this 1.207-unit chibi and a giant on an 1.8-unit
     * humanoid. Staged 0.495 against v2/v3's 0.300, which is why the shared camera
     * framed it too high — aimDrop and camLift are absolute offsets, so a taller
     * figure is framed proportionally higher on its body.
     *
     * THE NUMBER IS NOT 0.3 LIKE THE OTHER TWO, and that is the point rather than
     * an oversight. fitScaleToHeight measures the BIND POSE on the detached rig at
     * mount; SkinnedMesh.computeBoundingBox later measures the POSED skeleton.
     * v2 and v3 idle within 2% of their bind pose so the difference is invisible
     * there. This rig's idle is 69% of its bind height — it stands with its arms
     * down and its antenna tucked, where the bind pose has both spread — so
     * fitting the bind pose left it a third short on screen and reading as small
     * and low in frame.
     *
     * 0.426 = 0.3 x (0.294 / 0.207): v2's posed local height over this rig's, both
     * measured live with __pitchBotMeasure. It equalises what the PLAYER sees,
     * which is the only height that matters.
     *
     * IF THE IDLE CLIP EVER CHANGES, this goes stale — it is calibrated against a
     * pose, not against geometry. Re-measure rather than assuming it still holds.
     */
    fitHeight: 0.326,
    /**
     * Fallback if the measurement fails. Left at the authored 0.41 rather than
     * updated to 0.2485 on purpose: it is the value this rig was hand-tuned to,
     * and a fallback that silently matches the fitted answer hides the fact that
     * measurement failed at all.
     */
    scale: 0.35,
    holo: PITCH_BOT_HOLO,
    /** Canonical name -> the clip that actually carries it in THIS file. */
    clips: { idle: "idle", talking: "talking" },
    /** No LED faces on this rig; its plate is a pressure display. */
    expressions: null,
    /** Speaker code in api/counsel-voice's VOICES map. */
    voice: "PB",
    /** In the cast — eligible for auto-assignment. See PITCH_BOT_ROSTER. */
    inRoster: true,
  },

  /** Mixamo robot with a switchable LED face. Added 2026-08-02. */
  v2: {
    ...PITCH_BOT_STAGING,
    label: "pitchbot2 (LED face)",
    // VERSIONED, unlike v1, because this asset has never been through the CDN and
    // App Hosting has previously cached a TRUNCATED glb with no error — every load
    // then stalls byte-exact and forever (it took /trade down on 2026-08-01; see
    // TEMPLE_MODEL_URL in CyborgTempleScene). The suffix is part of the edge cache
    // key: bump it on every re-export so a poisoned entry can never be the thing
    // that is served. The stall watchdog below is the second half of that defence.
    // v=2 for the 2026-08-02 split-face re-import. BUMP THIS ON EVERY RE-EXPORT:
    // the suffix is part of the edge cache key, and the failure it guards against
    // is not a stale face but a TRUNCATED glb served forever from cache.
    url: "/models/pitchbot2.glb?v=3",
    /**
     * SOLVED, NOT AUTHORED. The height this rig should occupy, in the same local
     * units as `position` and `scale` — mountPitchBot measures the loaded bind
     * pose and derives the scale from it (see fitScaleToHeight).
     *
     * WHY NOT JUST A SCALE. This rig is a Mixamo export: the armature carries the
     * convention 0.01 and the body spans ~1.8 units, against v1's 1.207. Copying
     * v1's 0.31 across would stage a bot half again too tall, and hand-converting
     * it means multiplying three numbers from two files — exactly the paper
     * derivation that has gone stale every previous time in this subsystem. A
     * height is measurable and stays true across a re-export that rescales the rig.
     *
     * IT IS NOT v1's HEIGHT, and the first pass got that wrong. Matching the two
     * rigs' measured heights is the obvious fit rule and it stages a bot that is
     * plainly too big (author, 2026-08-02: "need to scale it way down"). The
     * numbers say the match was real — v1 measures 0.4514 world, v2 at the
     * matched height measured 0.4166, i.e. already the SHORTER of the two — so
     * the error is not arithmetic. It is that height is the wrong quantity:
     * v1 is a chibi robot, most of it head, and v2 is a realistically
     * proportioned adult humanoid with a small head and wide shoulders. At equal
     * height the second reads as a much larger creature, because the head is what
     * the eye scales everything else against.
     *
     * So this is an ART NUMBER, judged in the room, not a derived one. Dial it
     * live and paste what you land on:
     *
     *     __pitchBotFit(0.18)     // returns the fitHeight and the scale it solves to
     *     __pitchBotFit()         // read the current fit without changing it
     */
    fitHeight: 0.3,
    /** Used only if the measurement fails; roughly fitHeight / 1.806. */
    scale: 0.73,
    holo: {
      ...PITCH_BOT_HOLO,
      // SAME PREPASS AS v3. This rig has no hair, but it has the same two-mesh
      // body — shell plus ball-joint articulation — so it shows the neck through
      // the chin in exactly the same way. `side` stays inherited (DoubleSide):
      // FrontSide was applied here briefly on 2026-08-02 on no evidence and taken
      // back off, and the prepass makes it unnecessary anyway.
      depthPrepass: true,
      // THE LED FACE KEEPS ITS OWN MATERIAL — same rule as v1's plate, same
      // reason: it is the surface that has to read as a screen, and dissolving it
      // into the body's cyan wash is how you lose it. Here it matters twice over,
      // because that material is also the only thing in the rig bright enough to
      // bloom (emissive 0.25/0.95/1 at intensity 4, against the /trade Bloom pass's
      // 0.3 luminance threshold). Wash it and the glow goes with it.
      exclude: ["Expression_LED_MAT"],
    },
    clips: { idle: "Stand_Idle", talking: "Talking", bow: "Formal_Bow" },
    /**
     * THE FACE SPEC. Declarative on purpose: what the face is allowed to say is
     * a game rule (VC_GAME.md §1 rule 3), so it should be readable in one place
     * as data rather than inferred from calls scattered through a session.
     */
    expressions: {
      default: PITCH_BOT_DEFAULT_EXPRESSION,
      /**
       * TWO LAYERS as of the 2026-08-02 re-import, which split this rig's face
       * the same way v3's is: `_Eyes` and `_Mouth` per expression, plus a viseme
       * group. It shipped as ONE fused plate per expression and could therefore
       * neither blink nor talk.
       *
       * THE SUFFIX IS NOT COSMETIC. With the old single-layer config
       * (`suffix: ""`) the capture group matches greedily up to the optional
       * `_N`, so `Adult_Male_Face_Angry_Eyes` yields the expression name
       * "Angry_Eyes" — sixteen bogus expressions, none of them called "Neutral",
       * and a byPressure map below that silently matches nothing. The face would
       * load, show something, and never react to a band.
       */
      layers: [
        { key: "brows", prefix: "Adult_Male_Face_", suffix: "_Brows" },
        { key: "eyes", prefix: "Adult_Male_Face_", suffix: "_Eyes" },
        { key: "mouth", prefix: "Adult_Male_Face_", suffix: "_Mouth" },
      ],
      /**
       * THE READOUT. pressure().band -> face, and this is the ONLY channel that
       * may carry anything about how the pitch is going. pressure() is computed
       * from `run.outcomes` alone, so this shows the player their own findings
       * back — auditable, and provably not a tell. See the tier note in
       * pitchBotExpressions before adding any other source.
       *
       * The band names are pressRun.js's PRESSURE constants, and the readings are
       * its own descriptions of them: BACKED is "he gets to enjoy that", CORNERED
       * is "selling into a room that has stopped believing him".
       *
       * Frustrated rather than Angry for CORNERED — a paid closer who is losing
       * the room reads as exasperated, and Angry reads as threatening, which is a
       * different character. Swap the two if the room wants more teeth.
       */
      byPressure: {
        cool: "Neutral",
        backed: "Happy",
        rattled: "Confuse",
        cornered: "Frustrated",
      },
      /**
       * AMBIENCE, and outranked by the band. Content-free by construction: it
       * tracks whether audio is playing, which the player can already hear.
       * `Formal_Bow` gets Usual — the rig's formal-neutral rather than its blank
       * one.
       */
      byClip: { idle: "Neutral", talking: "Happy", bow: "Usual" },
      /**
       * BLINK, borrowing Happy's eyes — the same convention v3 uses, and these
       * two rigs come from the same LED-face art pack.
       *
       * UNVERIFIED ON THIS RIG: v3's Happy_Eyes were confirmed to be closed arcs;
       * v2's have not been looked at. If a blink here reads as a momentary grin
       * rather than shut eyes, that plate is not the same drawing — set
       * `blink: null` or point `using` at whichever plate is. __pitchBotBlink()
       * fires one on demand.
       */
      blink: { layer: "eyes", using: "Happy", holdMs: 100, everyMs: [2600, 6800] },
    },
    /**
     * ITS OWN THROAT. Speaker code in api/counsel-voice's VOICES map, where PB2
     * is `eNTStk21PJptqo0CKZTG` (env override ELEVENLABS_VOICE_PITCHBOT2).
     *
     * Per-rig rather than global for the same reason the clips are: swapping the
     * bot should swap everything that IS the bot. A shared voice would mean the
     * body changed and the character didn't.
     */
    voice: "PB2",
    /**
     * THE TALKING MOUTH, arrived with the 2026-08-02 re-import. Three plates
     * cycled by audio amplitude, taking over the `mouth` layer for the length of
     * a line and handing it back when the line ends.
     */
    visemes: {
      prefix: "Viseme_",
      suppresses: "mouth",
      voice: "PB2",
    },
    /**
     * EMPTY, AND THAT IS THE FINDING. *_Joints was hidden here on 2026-08-02 on
     * the theory that it was internal structure the shell enclosed. It is not: it
     * is the ball-joint ARTICULATION — the abdomen, waist and neck spheres — so
     * hiding it deleted the midsection and left the head floating. On a
     * ball-jointed doll the waist IS a sphere.
     *
     * Nothing on these rigs is safe to hide. Self-overlap is solved by the depth
     * prepass in the holo config instead.
     */
    hideParts: [],
    /** In the cast — eligible for auto-assignment. See PITCH_BOT_ROSTER. */
    inRoster: true,
  },

  /**
   * Mixamo robot with a SPLIT LED face — eyes, mouth and visemes as separate
   * plates. Added 2026-08-02. This is the rig the face system was designed for;
   * v2 is the same idea with everything fused into one plate.
   */
  v3: {
    ...PITCH_BOT_STAGING,
    label: "pitchbot3 (split face + visemes)",
    // NOTE THE CASE: the file is `pitchbot3.glb`, lowercase b, even though the rig
    // is written "pitchBot3" everywhere else. macOS wouldn't care and the CDN
    // will. Versioned for the same reason v2 is — App Hosting has served a
    // TRUNCATED glb from cache with no error, and the suffix is part of the edge
    // cache key. Bump it on every re-export.
    url: "/models/pitchbot3.glb?v=2",
    /**
     * MATCHES v2 — same number, and since fitExclude below takes the hair out of
     * the measurement it now means the same THING on both rigs: the height of the
     * figure, not of the hairdo.
     *
     * IT DID NOT BEFORE. This sat at 0.2 against v2's 0.3, and the hair (top at
     * y 2.015 against the body's 1.809) inflated the measurement on top of that,
     * so v3's body came out 0.180 tall against v2's 0.300 — 60%.
     */
    fitHeight: 0.3,
    /** Fallback if the measurement fails; roughly fitHeight / 1.809. */
    scale: 0.166,
    /**
     * THE HAIR IS NOT STATURE. Excluded from the height measurement so a restyle
     * cannot rescale the body — see measurePitchBotHeight. Matched by NAME, not
     * material: the fit runs before the holo wash, so material identity is not
     * settled yet.
     */
    fitExclude: ["SM_Chr_Attach_Hair_10"],
    holo: {
      ...PITCH_BOT_HOLO,
      /**
       * NEAREST SURFACE ONLY. Third attempt at the see-through, and the first one
       * that addresses the cause rather than a symptom.
       *
       *   FrontSide          culled the far hemisphere — helped, but did nothing
       *                      about the joints, which are in FRONT of the far side.
       *   depthWrite: true   arbitrary within a mesh: three does not sort triangles,
       *                      so which of two overlapping surfaces won was index order.
       *   hideParts          deleted the midsection. The joints ARE the articulation.
       *
       * The prepass keeps every part, draws each pixel once, and leaves the figure
       * translucent against the ROOM while opaque to itself. See PITCH_BOT_HOLO.
       */
      side: THREE.DoubleSide,
      depthPrepass: true,
      /**
       * THE HAIR GETS ITS OWN TREATMENT, now that it has its own material.
       *
       * It is a pile of intersecting shells, so it is the worst self-overlapper on
       * the rig and wants the strictest settings: backfaces culled AND depth
       * written, so only the nearest shell at each pixel draws. The body keeps the
       * looser double-sided pass above, because that is what makes it read as a
       * projection rather than as a solid.
       *
       * Slightly more opaque too — hair that is as see-through as the body reads
       * as a halo rather than as hair.
       */
      /**
       * THE HAIR IS STILL SLIGHTLY MORE OPAQUE than the body — hair as
       * see-through as a shoulder reads as a halo rather than as hair. No `side`
       * override any more: FrontSide was there to stop the hair showing its own
       * interior, and the prepass does that without the risk of thinning
       * single-sided shells from behind.
       */
      perMaterial: {
        "MAT_01A.005": { opacity: 0.96 },
      },
      // Every plate shares Expression_LED_MAT, so one exclusion covers eyes,
      // mouths AND visemes — they all keep the emissive LED look and the bloom.
      exclude: ["Expression_LED_MAT"],
    },
    // TWO CLIPS, and neither is named like v2's. No bow on this rig, so `byClip`
    // below has no bow entry — an alias pointing at a clip that isn't in the file
    // logs a warning at mount and is otherwise inert.
    clips: { idle: "standing_idle", talking: "talking" },
    expressions: {
      default: PITCH_BOT_DEFAULT_EXPRESSION,
      /**
       * TWO LAYERS. Each expression exists twice — `_Eyes` and `_Mouth` — so the
       * mouth can be handed to the viseme group while the eyes keep reading the
       * pressure band, and the eyes can blink without disturbing the mouth.
       */
      layers: [
        { key: "brows", prefix: "Adult_Female_Face_", suffix: "_Brows" },
        { key: "eyes", prefix: "Adult_Female_Face_", suffix: "_Eyes" },
        { key: "mouth", prefix: "Adult_Female_Face_", suffix: "_Mouth" },
      ],
      /**
       * Same readout as v2 and under the same rule (VC_GAME.md §1 rule 3) — see
       * that variant's note. NOTE THE VOCABULARY DIFFERS: this rig ships
       * `Surprised` where v2 ships `Sad`. Every face named here exists in both,
       * which is why one map serves both; check before adding a fifth band.
       */
      byPressure: {
        cool: "Neutral",
        backed: "Happy",
        rattled: "Confuse",
        cornered: "Frustrated",
      },
      /** Ambience, outranked by the band. No `bow` — this rig has no bow clip. */
      byClip: { idle: "Neutral", talking: "Happy" },
      /**
       * BLINK. Borrows Happy's closed-arc eyes, which is what that plate actually
       * draws — so the "expression" doubles as the blink frame and no extra art
       * was needed.
       *
       * THE COLLISION IS HANDLED: Happy is also the `backed` pressure face, so
       * while the player is being backed the eyes ARE the blink plate and a blink
       * would be invisible. renderFace skips it rather than burning a frame on a
       * swap from Happy to Happy.
       */
      blink: { layer: "eyes", using: "Happy", holdMs: 100, everyMs: [2600, 6800] },
    },
    /**
     * THE TALKING MOUTH. Three plates cycled by audio amplitude, which take over
     * the `mouth` layer for the length of a line and hand it back when the line
     * ends — see `speakHoldMs` in pitchBotExpressions for why that handover needs
     * a hold rather than a level test.
     */
    visemes: {
      prefix: "Viseme_",
      suppresses: "mouth",
      voice: "PB3",
    },
    /**
     * ITS OWN THROAT. `VYtAZPRhkK9OruILpVBz` (env override
     * ELEVENLABS_VOICE_PITCHBOT3), registered 2026-08-02.
     *
     * A VOICE IS A THREE-FILE CHANGE, and this rig is the one that proves why:
     *   api/counsel-voice VOICES     — or there is no id to synthesise with
     *   api/counsel-voice allow-list — or the speaker silently becomes Barron
     *   lib/adviserMouth             — or setAdviserMouth drops every write and
     *                                  the viseme mouth never opens
     * Two of those three fail SILENTLY, with the bot cheerfully talking.
     */
    voice: "PB3",
    /** Nothing to hide — see the note on v2's hideParts. */
    hideParts: [],
    /**
     * IN THE CAST as of 2026-08-02, when PB3 was registered — the only thing that
     * was holding it out. Set this false to pull it back without deleting it: it
     * stays loadable via `?pitchbot=v3` for tuning, just never dealt to a player.
     */
    inRoster: true,
  },
};

/**
 * LAST RESORT ONLY — the rig used when nothing was asked for and NOTHING ROLLED,
 * which today means an empty roster or a caller that bypassed the roll.
 *
 * IT IS NOT A WAY TO CHOOSE THE PITCHER, and it was called
 * PITCH_BOT_DEFAULT_VARIANT until 2026-08-02, which made it look like one. On a
 * non-empty roster this line is unreachable. Use PITCH_BOT_PIN below.
 */
export const PITCH_BOT_FALLBACK_VARIANT = "v3";

/**
 * FORCE ONE RIG, from code. `null` = auto-assign from the roster.
 *
 *     export const PITCH_BOT_PIN = "v2";   // always the LED-face bot
 *     export const PITCH_BOT_PIN = null;   // back to the roll
 *
 * THIS IS THE KNOB YOU WANT while building. Setting the fallback above does
 * nothing on a non-empty roster — it sits BELOW the roll, not above it — which
 * is a genuinely confusing thing to discover by editing it and getting the other
 * bot anyway (author hit exactly this, 2026-08-02). The fallback answers "what if
 * there is no cast at all"; this answers "I want to look at that one".
 *
 * Beaten by `?pitchbot=`, so a pinned build can still be compared in a reload
 * without a code edit. Ship it as null unless the cast is deliberately one rig.
 */
export const PITCH_BOT_PIN = null;

/**
 * THE CAST — rigs eligible to be auto-assigned to a deal.
 *
 * Driven by an `inRoster` flag rather than by Object.keys, so a variant can exist
 * for comparison or tuning without ever being staged at a player. Adding a fourth
 * bot is one config entry plus one flag.
 *
 * WHICH rig a deal gets is decided in game/terminal-traders/press/pitchers.js,
 * and the constraint it enforces — the rig may not correlate with the archetype
 * or the outcome — is written out in full there. Read that before changing how
 * this is picked; it is the difference between art direction and a leak.
 */
export const PITCH_BOT_ROSTER = Object.keys(PITCH_BOT_VARIANTS)
  .filter((k) => PITCH_BOT_VARIANTS[k].inRoster);

/**
 * The rig for THIS session, rolled once and remembered.
 *
 * ONE ROLL PER PAGE LOAD, which is one roll per deal — the game is "one deal, one
 * pitch", and the bot is mounted at temple load, long before PressSession has
 * rolled a seed. Rolling here rather than threading the deal backwards is what
 * makes the assignment independent of the deal BY CONSTRUCTION: it happens before
 * the archetype exists, so it cannot see it. That is a stronger guarantee than
 * any amount of care at a call site that DOES have the deal in scope.
 */
let _rolledVariant = null;

/**
 * Which rig to stage.
 *
 * Precedence: explicit argument, then `?pitchbot=v2` on the URL, then the default.
 * The query override is how every other tunable in this room is driven (`?reveal=`,
 * `?perf=1`, `?animfield=0`) and it is the difference between comparing the two
 * bots in a reload and comparing them in a rebuild.
 */
export function resolvePitchBotVariant(explicit = null) {
  if (explicit && PITCH_BOT_VARIANTS[explicit]) return explicit;
  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search).get("pitchbot");
      if (q && PITCH_BOT_VARIANTS[q]) return q;
    } catch { /* malformed query string is not worth taking the room down for */ }
  }
  if (PITCH_BOT_PIN && PITCH_BOT_VARIANTS[PITCH_BOT_PIN]) return PITCH_BOT_PIN;
  if (!_rolledVariant) _rolledVariant = rollPitcher(PITCH_BOT_ROSTER);
  return _rolledVariant || PITCH_BOT_FALLBACK_VARIANT;
}

/**
 * Re-roll the session's pitcher. Debug and tests only — a live game rolls once.
 *
 * @param seed  optional; a seeded roll reproduces, so a pinned run brings back
 *              the same bot. Omit for a plain draw.
 */
export function assignPitchBot(seed = null) {
  _rolledVariant = rollPitcher(PITCH_BOT_ROSTER, seed);
  return _rolledVariant;
}

/**
 * Which ElevenLabs voice the staged rig speaks in — a speaker code for
 * api/counsel-voice, never a raw voice id (this is client code; the ids and the
 * key stay on the route).
 *
 * Resolves from the CONFIG, not from the loaded bot, so it answers correctly
 * before the glb has arrived and on surfaces that stage no bot at all. Callers
 * therefore need no readiness check and no fallback of their own.
 */
export function getPitchBotVoice(variant = null) {
  return getPitchBotConfig(variant).voice || "PB";
}

/** The merged config for a variant, ready to hand to mountPitchBot. */
export function getPitchBotConfig(variant = null, overrides = {}) {
  const key = resolvePitchBotVariant(variant);
  return { variant: key, ...PITCH_BOT_VARIANTS[key], ...overrides };
}

/**
 * BACK-COMPAT. Was the single config object before there were variants; several
 * comments elsewhere still name it. Resolves to whatever the default rig is.
 */
export const PITCH_BOT_CONFIG = PITCH_BOT_VARIANTS[PITCH_BOT_FALLBACK_VARIANT];

// Reused across frames — allocating vectors in a render loop is how you get a GC
// sawtooth on a scene that already runs hot.
const _botWorld = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
let _billboardState = null;
/** The live rig: root, actions and the variant that produced them. */
let _mounted = null;

/**
 * Point the bot at the camera, yaw only. Call once per frame.
 *
 * Safe to call before the model loads and safe to call when billboarding is off —
 * both are no-ops, so the caller needs no guard of its own.
 *
 * WHY lookAt AND NOT atan2 ON THE POSITIONS: the bot is parented into the temple,
 * which carries its own transform. `lookAt` resolves through the parent's world
 * matrix; a hand-rolled atan2 on world positions would need the parent's world
 * yaw subtracted back out, which is the same maths with a bug in it later.
 */
export function tickPitchBotBillboard(camera) {
  const st = _billboardState;
  if (!st || !st.bot || !camera || !st.enabled) return;
  const bot = st.bot;
  bot.getWorldPosition(_botWorld);
  // Same Y as the bot, so the turn is pure yaw and the figure never tips.
  _lookTarget.set(camera.position.x, _botWorld.y, camera.position.z);
  bot.lookAt(_lookTarget);
  if (st.yawOffset) bot.rotateY(st.yawOffset);
}

/** Drop the billboard target. Call on unmount alongside disposePitchBotHolo. */
export function disposePitchBotBillboard() {
  _billboardState = null;
  _mounted = null;
  disposePitchBotExpressions();
}

/**
 * Solve `scale` from a target height by measuring the rig we actually got.
 *
 * Runs on the DETACHED root at scale 1, so the measurement is in the rig's own
 * space and the answer is directly the scale to set — no parent world matrix to
 * divide back out, and nothing to redo if the caller re-parents later.
 *
 * Returns null when there is nothing measurable, which is the caller's signal to
 * keep the variant's literal `scale`. A bot at the wrong size is a note in the
 * console; a bot that failed to mount because a measurement returned null is a
 * missing pitcher.
 */
function fitScaleToHeight(root, fitHeight, exclude = null) {
  root.scale.setScalar(1);
  const m = measurePitchBotHeight(root, exclude);
  if (!m || !(m.height > 1e-6)) return null;
  return { scale: fitHeight / m.height, natural: m.height };
}

/**
 * Register a mixer action under BOTH its canonical alias and its own clip name.
 *
 * THE ALIAS IS THE POINT. CyborgTempleScene's speech effect reads
 * `actions.idle` / `actions.talking` — those literal keys, chosen when the only
 * rig in the room happened to name its clips that way. v2's clips are `Stand_Idle`
 * and `Talking`, so on a bare registration that effect finds nothing, returns
 * early, and stages a bot that is loaded, lit, holographic and completely still.
 * Nothing throws. Aliasing here fixes it for every consumer at once, which is
 * strictly better than teaching each call site a second set of names.
 *
 * The raw name is kept alongside so clips with no canonical role — v2's
 * `Formal_Bow` under v1's two-clip vocabulary — are still reachable.
 */
function registerActions(mixer, animations, clips, actionsRef, variant) {
  const bag = {};
  const byName = new Map();

  animations.forEach((clip) => {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    bag[clip.name] = action;
    byName.set(clip.name, action);
  });

  const missing = [];
  Object.entries(clips || {}).forEach(([canonical, clipName]) => {
    const action = byName.get(clipName);
    if (!action) { missing.push(`${canonical} -> ${clipName}`); return; }
    bag[canonical] = action;
  });

  if (missing.length) {
    // Loud, because the failure is otherwise invisible: the bot simply stands
    // there and nothing in the console suggests why.
    console.warn(
      `[PitchBot:${variant}] clip aliases unresolved (${missing.join(", ")}). ` +
      `Clips in file: ${animations.map((a) => a.name).join(", ") || "(none)"}`,
    );
  }

  if (actionsRef) actionsRef.current.PitchBot = bag;
  return bag;
}

/**
 * Crossfade to a clip by canonical name (`idle`, `talking`, `bow`) or raw name.
 *
 * Crossfaded rather than swapped for the reason CyborgTempleScene's own effect
 * gives: an utterance ends every few seconds and a hard cut on each one reads as
 * a stutter. 0.3s by default, matching the 0.28 that effect already uses.
 *
 * The face follows on its own — see tickPitchBotFace — so this does not touch
 * expressions, and a pinned expression survives a clip change.
 */
export function playPitchBotClip(name, { fade = 0.3 } = {}) {
  const actions = _mounted?.actions;
  const to = actions?.[name];
  if (!to) return false;

  Object.values(actions).forEach((a) => {
    if (a !== to && a.isRunning()) a.fadeOut(fade);
  });
  to.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
  return true;
}

/**
 * Load the bot, park it, register it for animation and focus.
 *
 * @param gltfLoader  the caller's loader — MUST already have a DRACOLoader
 *                    attached. BOTH rigs list KHR_draco_mesh_compression as
 *                    extensionsRequired (v1 also requires EXT_texture_webp, which
 *                    needs no setup), so a bare loader fails on either.
 * @param parent      templeScene — the bot is parented here so it inherits the
 *                    room's transform, which carries a 1.2x scale.
 * @param mixersRef   registered as 'PitchBot'; the scene's per-frame loop
 *                    iterates every entry, so no render-loop edit is needed.
 * @param actionsRef  registered as 'PitchBot' -> canonical + raw clip names.
 * @param onReady     optional (bot) => void once it is in the scene.
 * @param variant     'v1' | 'v2'; defaults to `?pitchbot=` then v1.
 * @param cfg         overrides for the resolved variant.
 */
export function mountPitchBot({
  gltfLoader, parent, mixersRef, actionsRef, onReady = null, variant = null, cfg = {},
}) {
  const c = getPitchBotConfig(variant, cfg);
  if (!gltfLoader || !parent) return;

  loadWithStallWatchdog(
    gltfLoader,
    c.url,
    c.variant,
    (gltf) => {
      const bot = gltf.scene;
      bot.name = "PitchBot_Root";
      bot.position.set(...c.position);
      bot.rotation.set(...c.rotation);

      // PARTS THAT ARE ONLY THERE TO BE INSIDE SOMETHING ELSE.
      //
      // Both LED rigs ship the body as TWO meshes: an outer shell (*_Surface) and
      // an internal ball-joint armature (*_Joints) that the shell encloses. On an
      // opaque render you never see the second one. On a hologram at opacity 0.88
      // you see 12% of it everywhere — the neck through the chin, shoulder and hip
      // balls floating inside the torso — and it reads as broken rather than
      // translucent.
      //
      // THIS IS NOT A DEPTH PROBLEM AND depthWrite CANNOT FIX IT. Depth testing
      // decides which fragment wins where two compete; it has nothing to say about
      // a surface you can see THROUGH. The only exact fixes are to raise opacity
      // until it stops being a hologram, or to not draw the thing. This is the
      // second.
      const hidden = new Set(c.hideParts || []);
      if (hidden.size) {
        bot.traverse((o) => {
          if (o.isMesh && hidden.has(o.name)) { o.visible = false; o.userData.hiddenPart = true; }
        });
      }

      bot.traverse((o) => {
        if (!o.isMesh) return;
        // Click-to-focus reads userData.agentId, the same mechanism the four
        // workstations use. Stamped on every mesh so any part of the bot — or
        // its easel — is a valid hit.
        o.userData.agentId = "PitchBot";
        o.userData.clickable = true;
        // The body is skinned and its bind-pose bounds don't describe where the
        // animated mesh actually is, so frustum culling can pop it out of view
        // mid-pitch.
        o.frustumCulled = false;
      });

      // THE FACE BEFORE SCALE, and before anything reads the silhouette. Every
      // LED rig arrives with EVERY plate visible and coincident (glTF carries no
      // visibility channel — see pitchBotExpressions), so until this runs the
      // "face" is 8 meshes on v2 and 19 on v3 z-fighting in one pocket. It also
      // has to precede the fit measurement, which excludes plates on the
      // assumption that one per group is live. No-ops on v1, which has none.
      const faceCount = initPitchBotExpressions(bot, c.expressions || {});
      const visemeCount = initPitchBotVisemes(bot, {
        ...(c.visemes || {}),
        voice: c.visemes?.voice || c.voice,
      });
      // ALIGNED AS ONE POOL, after BOTH groups are known — eyes, mouths and
      // visemes must land on the same plane or the mouth jumps the moment the bot
      // starts talking. Aligning each group as it loads would let them agree
      // internally and still disagree with each other.
      // `alignTo` names the plate to register everything against. Leave it unset
      // and the midline heuristic picks; set it when that heuristic is wrong, which
      // it has been once (see alignPitchBotPlates).
      if (faceCount || visemeCount) alignPitchBotPlates(c.expressions?.alignTo || null);

      // SIZE. Solve from the measured rig when the variant asked for a height,
      // else take its literal scale.
      let fitted = null;
      if (c.fitHeight) {
        fitted = fitScaleToHeight(bot, c.fitHeight, c.fitExclude);
        if (!fitted) {
          console.warn(`[PitchBot:${c.variant}] could not measure the rig; using literal scale ${c.scale}`);
        }
      }
      bot.scale.setScalar(fitted ? fitted.scale : c.scale);
      bot.visible = c.visible;

      // JUST THE BOT. The file briefly also carried Presentation_Chart (an easel)
      // and Presentation_Chart_Page (a UV'd quad) as sibling root nodes, and the
      // design leaned on them as the pitch surface for a few hours. Both were
      // removed from the glb on 2026-07-29, so the projector is the pitcher's only
      // staging and the claim text lives in the reading column. See VC_GAME.md §1.
      if (c.holographic) applyPitchBotHolo(bot, c.holo);

      parent.add(bot);

      const mixer = new THREE.AnimationMixer(bot);
      if (mixersRef) mixersRef.current.PitchBot = mixer;
      const actions = registerActions(mixer, gltf.animations, c.clips, actionsRef, c.variant);
      actions.talking?.play();

      if (c.expressions) bindPitchBotFaceSpec(actions, c.expressions);

      _mounted = { bot, actions, variant: c.variant, config: c, fitted };
      _billboardState = {
        bot,
        enabled: !!c.billboard,
        yawOffset: c.yawOffset || 0,
      };

      console.log(
        `[PitchBot:${c.variant}] ${c.label} — ` +
        `${gltf.animations.length} clips (${gltf.animations.map((a) => a.name).join(", ")}), ` +
        `${faceCount} expressions x ${getPitchBotFaceState().layers.length || 0} layer(s), ` +
        `${visemeCount} visemes, ` +
        `natural height ${fitted ? fitted.natural.toFixed(3) : "n/a"}, ` +
        `scale ${bot.scale.x.toFixed(4)}`,
      );

      installDebugHandles(bot, c);
      onReady?.(bot);
    },
    (err) => {
      // Never fatal. The game is fully playable with no bot in the room — the
      // flat surface has no 3D at all — so a failed load must not take the
      // scene down with it.
      console.warn(`[PitchBot:${c.variant}] load failed; room plays without it`, err);
    },
  );
}

/**
 * GLTFLoader.load with a stall watchdog, mirroring the temple's loader.
 *
 * THE FAILURE THIS EXISTS FOR is not a network error. App Hosting's CDN has
 * cached a TRUNCATED glb: the response starts, delivers part of the body, and
 * then simply stops with the connection open. fetch neither resolves nor rejects,
 * so `onError` never fires and the loader spins forever — /trade went down this
 * way on 2026-08-01 with a clean console. A plain retry hits the same poisoned
 * edge entry; only a cache-busting query gets a different object.
 *
 * So: track byte progress, and when it stops for 15s, abandon the attempt and
 * retry with `&r=<now>`. The hung request cannot be aborted through GLTFLoader,
 * so a superseded attempt's callbacks are ignored via the attemptId token rather
 * than prevented.
 */
function loadWithStallWatchdog(loader, url, variant, onLoad, onError) {
  let attemptId = 0;
  let settled = false;
  let lastProgressAt = 0;
  let retries = 0;
  const maxRetries = 3;
  let watchdog = null;

  const attempt = (cacheBust) => {
    const target = cacheBust
      ? `${url}${url.includes("?") ? "&" : "?"}r=${Date.now()}`
      : url;
    const thisAttempt = ++attemptId;
    lastProgressAt = performance.now();
    if (watchdog) clearInterval(watchdog);
    watchdog = setInterval(() => {
      if (settled || thisAttempt !== attemptId) { clearInterval(watchdog); return; }
      if (performance.now() - lastProgressAt < 15000) return;
      clearInterval(watchdog);
      if (retries >= maxRetries) {
        console.error(`[PitchBot:${variant}] download stalled; cache-busted retries exhausted.`);
        return;
      }
      retries++;
      console.warn(`[PitchBot:${variant}] download stalled (no bytes for 15s) — retrying cache-busted (${retries}/${maxRetries})`);
      attempt(true);
    }, 5000);

    loader.load(
      target,
      (gltf) => {
        if (settled || thisAttempt !== attemptId) return;
        settled = true;
        clearInterval(watchdog);
        onLoad(gltf);
      },
      () => { if (thisAttempt === attemptId) lastProgressAt = performance.now(); },
      (err) => {
        if (settled || thisAttempt !== attemptId) return;
        settled = true;
        clearInterval(watchdog);
        onError(err);
      },
    );
  };

  attempt(false);
}

/**
 * LIVE TUNING, because the transform is an eyeball job. Relative nudges,
 * so repeated calls stack.
 */
function installDebugHandles(bot, c) {
  if (typeof window === "undefined") return;

  window.__pitchBot = bot;
  window.__pitchBotTune = ({ x = 0, y = 0, z = 0, yaw = 0, scale = null } = {}) => {
    bot.position.x += x; bot.position.y += y; bot.position.z += z;
    // A raw yaw nudge is pointless while billboarding — the next frame
    // overwrites the rotation. Route it to the offset instead, which is the
    // thing that actually survives.
    if (yaw) {
      if (_billboardState?.enabled) _billboardState.yawOffset += yaw;
      else bot.rotateY(yaw);
    }
    if (scale != null) bot.scale.setScalar(scale);
    return {
      variant: c.variant,
      position: bot.position.toArray().map((v) => +v.toFixed(3)),
      yawOffset: +(_billboardState?.yawOffset ?? bot.rotation.y).toFixed(3),
      scale: +bot.scale.x.toFixed(4),
      billboard: !!_billboardState?.enabled,
    };
  };
  /** Set the model-forward correction in DEGREES. Returns the radian value
   *  to paste into the variant's yawOffset. */
  window.__pitchBotFacing = (deg) => {
    if (!_billboardState) return null;
    _billboardState.yawOffset = (Number(deg) || 0) * Math.PI / 180;
    return { yawOffset: +_billboardState.yawOffset.toFixed(4), deg: Number(deg) || 0 };
  };
  /**
   * REPLAY THE CAST — the beam strike and the figure assembling up it.
   *
   * It plays once, on the frame the floor begins, and lasts under a second,
   * which makes it the hardest thing in this subsystem to look at twice. Slow
   * it right down to judge the edge and the timing:
   *
   *     __pitchBotRecast({ castDuration: 6 })
   *     __pitchBotRecast({ revealEdge: 0.4, revealEdgeGlow: 4 })
   *     __pitchBotRecast()               // as shipped
   *
   * Overrides are per-call and never persist — paste the ones you like into
   * PITCH_BOT_HOLO. Bridged to the DOM as well as returned, because the
   * Chrome extension evaluates in an isolated world where page globals read
   * back as undefined (see the debugging note in this repo's memory).
   */
  window.__pitchBotRecast = (over = {}) => {
    bot.visible = true;
    const ok = startPitchBotCast(bot, over);
    const out = { started: ok, ...pitchBotCastState() };
    probe(out);
    return out;
  };
  /** Current cast state, bridged the same way. */
  window.__pitchBotCastState = () => {
    const out = pitchBotCastState();
    probe(out);
    return out;
  };
  /** Toggle billboarding without a reload. */
  window.__pitchBotBillboard = (on) => {
    if (_billboardState) _billboardState.enabled = !!on;
    return { billboard: !!_billboardState?.enabled };
  };

  /* ── FACE HANDLES. Present on every rig; on v1 they report empty lists, which
     is the honest answer rather than an error. What each rig can actually do
     differs — v2 has one fused plate, so it has no blink and no viseme mouth and
     those handles say so. ──────────────────────────────────────────────────── */

  /**
   * DRIVE THE VISEME MOUTH BY HAND, or read what it is doing.
   *
   *     __pitchBotMouth()        // { visemes, active, speaking, level, enabled }
   *     __pitchBotMouth(0.5)     // hold it open — bypasses the analyser
   *     __pitchBotMouth(null)    // follow the voice again
   *
   * THE FASTEST WAY TO SEE THE HANDOVER: hold it at 0.5, watch the expression
   * mouth disappear and a viseme take its place, then release and watch the
   * expression mouth come back ~350ms later (speakHoldMs). If it flickers instead,
   * that hold is too short.
   *
   * `enabled: false` is the expected answer on v1 and v2 — neither has a viseme
   * group.
   */
  window.__pitchBotMouth = (level) => {
    if (level !== undefined) setPitchBotMouthLevel(level);
    const out = { variant: c.variant, ...getPitchBotMouth() };
    probe(out);
    return out;
  };
  /**
   * RE-REGISTER THE FACE against a different plate, live.
   *
   *     __pitchBotAlign()                            // what it chose, and the options
   *     __pitchBotAlign("Adult_Female_Face_Happy_Eyes")
   *
   * Every plate is snapped to the named one's AUTHORED transform — the originals
   * are kept, so this can be run repeatedly and each call reads the file rather
   * than the last result. Whichever candidate lands the features on the skull is
   * the value to paste into the variant's `alignTo`.
   *
   * The default pick is the group whose centre sits closest to the head's midline.
   * That is a better rule than the popularity one it replaced — which chose a
   * nine-plate majority on v3 that was 6.3 units too high — but it is still a
   * heuristic, and this handle is how you overrule it in ten seconds.
   */
  window.__pitchBotAlign = (name) => {
    if (name !== undefined) alignPitchBotPlates(name);
    const out = { variant: c.variant, ...getPitchBotAlignment() };
    probe(out);
    return out;
  };
  /**
   * HOLD ONE LAYER for emphasis — brows raised while the rest of the face carries
   * on with whatever the pressure band says.
   *
   *     __pitchBotLayer("brows", "Surprised")   // raise
   *     __pitchBotLayer("brows", null)          // release
   *     __pitchBotLayer()                       // what's held
   *
   * The blink still fires over a held eyes layer — eyes pinned open through every
   * blink read as a stare.
   *
   * DRIVE IT FROM INTERACTION, NEVER FROM THE DEAL. Brows that move when the
   * player presses are fine; brows that move when the CLAIM is false are a tell,
   * and a quiet enough one to survive review. See VC_GAME.md §1 rule 3.
   */
  window.__pitchBotLayer = (layer, name) => {
    const ok = layer !== undefined ? setPitchBotLayer(layer, name ?? null) : null;
    const out = { variant: c.variant, set: ok, held: getPitchBotLayerOverrides(), ...getPitchBotFaceState() };
    probe(out);
    return out;
  };
  /**
   * SEE-THROUGH KNOBS, live. Whether a translucent head reads as a projection or
   * as a mess of overlapping hair is an eyeball call, so A/B it rather than
   * rebuilding:
   *
   *     __pitchBotHolo()                                  // list the materials
   *     __pitchBotHolo({ side: "front" })                 // cull far hemisphere, all parts
   *     __pitchBotHolo({ depthWrite: true })              // occlude self — dims the beam
   *     __pitchBotHolo({ side: "double", depthWrite: false })   // original look
   *
   * TARGET ONE PART by material — the body and the hair want different answers,
   * and on v3 they are finally separable:
   *
   *     __pitchBotHolo({ material: "MAT_01A.005", opacity: 1 })        // the hair
   *     __pitchBotHolo({ material: "Beta_HighLimbsGeoSG3", side: "front" })  // the shell
   *
   * Reaches the WASHED materials only; the LED plates are excluded from the wash
   * and keep their own opaque emissive look either way.
   */
  window.__pitchBotHolo = (opts) => {
    const out = { variant: c.variant, ...tunePitchBotHolo(opts || {}) };
    probe(out);
    return out;
  };
  /**
   * LIST OR TOGGLE THE BODY MESHES.
   *
   *     __pitchBotParts()                    // every mesh and whether it's drawn
   *     __pitchBotParts("Beta_Joints", true) // put the internal armature back
   *     __pitchBotParts("Beta_Joints", false)
   *
   * THE JUDGEMENT THIS EXISTS FOR: the *_Joints mesh is mostly internal, but some
   * of what reads as an elbow or a knee may be coming from it rather than from the
   * shell. Hiding it is exact for the torso and pelvis; whether it costs a joint
   * you wanted is a look, not a deduction. Toggle it and see.
   *
   * Face plates are excluded from the listing — they are managed by the expression
   * system and toggling them here would fight it on the next frame.
   */
  window.__pitchBotParts = (name, visible) => {
    const parts = [];
    bot.traverse((o) => {
      if (!o.isMesh) return;
      if (/^(Adult_\w+_Face_|Viseme_)/.test(o.name)) return;
      if (name !== undefined && o.name === name && visible !== undefined) {
        o.visible = !!visible;
        o.userData.hiddenPart = !visible;
      }
      parts.push({ name: o.name, visible: o.visible, material: o.material?.name });
    });
    const out = { variant: c.variant, parts };
    probe(out);
    return out;
  };
  /** Fire a blink now. Returns false on a rig that has no blink layer. */
  window.__pitchBotBlink = () => {
    const out = { variant: c.variant, blinked: blinkPitchBot(), ...getPitchBotFaceState() };
    probe(out);
    return out;
  };
  /**
   * Set the expression, or pass null to hand it back to the tiers below.
   *
   *     __pitchBotFace()            // what's showing, across which layers
   *     __pitchBotFace("Angry")     // pin it
   *     __pitchBotFace(null)        // release
   *
   * `layers` is the tell for which rig you are looking at: ["face"] is v2's fused
   * plate, ["eyes","mouth"] is v3's split one.
   */
  window.__pitchBotFace = (name) => {
    if (name !== undefined) setPitchBotExpression(name);
    const out = { variant: c.variant, ...getPitchBotFaceState() };
    probe(out);
    return out;
  };
  /**
   * DRIVE THE FACE FROM THE PRESSURE BAND, without playing a session.
   *
   *     __pitchBotPressure("cornered")   // cool | backed | rattled | cornered
   *     __pitchBotPressure(null)         // no pitch running — back to ambience
   *
   * The four bands are the whole vocabulary the face has during a pitch, so this
   * is the handle for reviewing the readout: step the four and confirm each one
   * is legible at the distance the player actually sees the bot from.
   */
  window.__pitchBotPressure = (band) => {
    if (band !== undefined) setPitchBotPressure(band);
    const out = {
      variant: c.variant,
      pressure: getPitchBotPressure(),
      face: getPitchBotExpression(),
      bands: c.expressions?.byPressure || null,
    };
    probe(out);
    return out;
  };
  /** Crossfade a clip by canonical or raw name: __pitchBotPlay("bow"). */
  window.__pitchBotPlay = (name, fade) => {
    const ok = playPitchBotClip(name, fade != null ? { fade } : undefined);
    const out = {
      played: ok, name,
      available: Object.keys(_mounted?.actions || {}),
      face: getPitchBotExpression(),
    };
    probe(out);
    return out;
  };
  /**
   * SIZE THE RIG BY HEIGHT, live. Pass the local height you want; get back the
   * scale it solved to and the number to paste into the variant's fitHeight.
   *
   * This is the knob to reach for rather than __pitchBotTune({scale}), because a
   * raw scale means nothing across two rigs of different natural size — 0.31 is a
   * shipped bot on v1 and a giant on v2. A height is comparable, and it is what
   * fitHeight stores, so what you dial is what you paste.
   *
   * Only available on a rig that asked to be fitted (v2). On v1 it says so rather
   * than silently doing something else.
   */
  window.__pitchBotFit = (h) => {
    const natural = _mounted?.fitted?.natural;
    if (!natural) {
      const out = {
        variant: c.variant,
        error: "this rig has no fitHeight; size it with __pitchBotTune({ scale })",
        scale: +bot.scale.x.toFixed(4),
      };
      probe(out);
      return out;
    }
    if (h != null && h > 0) bot.scale.setScalar(h / natural);
    const out = {
      variant: c.variant,
      fitHeight: +(bot.scale.x * natural).toFixed(4),
      scale: +bot.scale.x.toFixed(4),
      naturalHeight: +natural.toFixed(4),
      paste: `fitHeight: ${+(bot.scale.x * natural).toFixed(3)}`,
    };
    probe(out);
    return out;
  };
  /**
   * MEASURE, DON'T DERIVE. Reports the rig's natural bind-pose height, the scale
   * in force, and the staged height that scale produces — the numbers that
   * fitHeight is set from. Run it on v1 to read the target, then on v2 to confirm
   * it matched.
   */
  window.__pitchBotMeasure = () => {
    // SAME EXCLUSIONS THE FIT USED, or the readback is not comparable to the
    // thing it is meant to check — v3's hair is out of the fit and was in this,
    // so the report said the body was taller than it is.
    const staged = measurePitchBotHeight(bot, c.fitExclude);
    const out = {
      variant: c.variant,
      naturalHeight: _mounted?.fitted ? +_mounted.fitted.natural.toFixed(4) : null,
      scale: +bot.scale.x.toFixed(4),
      // In WORLD units — the rig is parented into the temple by now, so this
      // already carries the room's 1.2x. fitHeight is the LOCAL figure; divide
      // by the parent's world scale if you are comparing the two directly.
      stagedHeightWorld: staged ? +staged.height.toFixed(4) : null,
      fitHeight: c.fitHeight ?? null,
      baseY: staged ? +staged.y0.toFixed(4) : null,
      topY: staged ? +staged.y1.toFixed(4) : null,
    };
    probe(out);
    return out;
  };
  /** Which rigs exist and which one is staged. */
  window.__pitchBotVariants = () => {
    const out = {
      active: c.variant,
      roster: PITCH_BOT_ROSTER,
      available: Object.entries(PITCH_BOT_VARIANTS).map(([k, v]) => ({
        key: k, label: v.label, url: v.url, clips: v.clips,
        voice: v.voice, inRoster: !!v.inRoster,
      })),
      hint: "auto-assigned per deal from the roster; ?pitchbot=v1|v2 pins one",
    };
    probe(out);
    return out;
  };
  /**
   * Sample the assignment without playing sessions — the roll is once per page
   * load, so the spread is otherwise only visible over many reloads.
   *
   *     __pitchBotRollSpread(400)   // { v1: 198, v2: 202 }
   *
   * Reports the DISTRIBUTION only. There is deliberately nothing to check it
   * against: the roll never sees an archetype or an outcome, so "does the rig
   * correlate with the read" has no code path that could answer yes.
   */
  window.__pitchBotRollSpread = (n = 200) => {
    const tally = {};
    for (let i = 0; i < n; i++) {
      const k = rollPitcher(PITCH_BOT_ROSTER);
      tally[k] = (tally[k] || 0) + 1;
    }
    probe(tally);
    return tally;
  };
}

/** Bridge a value to the DOM — the Chrome extension's isolated world reads page
 *  globals back as undefined, so returning it is not enough. */
function probe(value) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("__pitchBotCastProbe");
  if (!el) {
    el = document.createElement("div");
    el.id = "__pitchBotCastProbe";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  el.textContent = JSON.stringify(value);
}

export {
  setPitchBotExpression, getPitchBotExpression, listPitchBotExpressions,
  setPitchBotPressure, getPitchBotPressure,
};
