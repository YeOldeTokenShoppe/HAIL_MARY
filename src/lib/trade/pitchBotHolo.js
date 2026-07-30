import * as THREE from "three";

// HOLOGRAPHIC TREATMENT FOR THE PITCH BOT.
//
// The look is lifted from HolographicStatue3 — fresnel rim, travelling
// scanlines, cyan tint, additive glow — but NOT the implementation, and the
// reason is load-bearing:
//
//   HolographicStatue3 assigns a raw ShaderMaterial whose vertex shader does
//   `modelMatrix * vec4(position, 1.0)` with NO skinning chunks. The statue can
//   afford that because its motion is object-level (hover / rotate). The pitch
//   bot's body is a SkinnedMesh with a 50-joint skeleton, so the same material
//   would render it FROZEN IN BIND POSE while the mixer happily drove the bones
//   — animation silently gone, no error anywhere.
//
// So we patch the existing MeshStandardMaterial through onBeforeCompile instead.
// three keeps every chunk it already generated — skinning, normals, fog — and we
// only add appearance on top. That is also why this survives a three upgrade
// better than a hand-written vertex shader would.
//
// TWO DELIBERATE DEPARTURES FROM THE STATUE:
//
//   1. depthTest STAYS ON. The statue floats in open air above the altar and
//      draws over everything. The bot stands among desks and monitors — with
//      depthTest off it shows straight through them.
//   2. THE FACE SHIELD IS EXCLUDED BY DEFAULT. That plate is the display for
//      pressure() (four bands, four textures), and dissolving it into the same
//      cyan wash as the body is how you lose the one surface that has to read as
//      a screen. It keeps its own emissive material.

export const PITCH_BOT_HOLO = {
  color: 0x66f7ff,   // matches HologramCard's projector cyan
  tint: 0.72,        // 0 = original albedo, 1 = pure cyan
  glow: 1.35,        // fresnel rim strength
  scan: 9.0,         // scanline frequency
  scanSpeed: 0.35,   // scanline drift
  opacity: 0.88,
  floor: 0.22,       // minimum alpha, so the silhouette never fully vanishes
  /** Material names that keep their own look. The face plate is the pressure
   *  display; see the note above. */
  exclude: ["lambert2.003"],

  // ── THE CAST: the bot assembling up the projector beam ──────────────────────
  // VC_GAME.md §1 has said all along that "the projector casts the bot, its beam
  // is the only staging the pitcher gets", and until now the casting was a
  // `visible = true`. The figure simply existed, mid-air, on the frame the floor
  // began.
  /** Retained for the shader's uniform; the mask it used to soften is gone. */
  revealEdge: 0.17,
  /** How hard the crown flash burns as the figure rises. */
  revealEdgeGlow: 2.4,
  /**
   * How flat the figure starts, as a fraction of its height. Not 0: a zero-height
   * hologram is a horizontal line on the projector plate, which reads as a glitch
   * rather than as something about to happen.
   */
  castCompress: 0.06,
  /**
   * Overshoot on the launch, in fractions of full height. The figure passes its own
   * height and settles back — this is the whole difference between "shooting up" and
   * "growing", and it is the reason the ease is hand-rolled rather than a power
   * curve. 0 disables it.
   */
  castOvershoot: 0.12,
  /** Seconds for the figure to spring to full height. */
  castDuration: 0.7,
  /**
   * Seconds the SHAFT takes to retract to the projector plate before the strike.
   *
   * The beam rises with the figure (author, 2026-07-29: "i think the beam should
   * move up with the pitchbot"), which means it has to be short before the figure
   * launches — and it enters this beat at full height, holding the neon sign. So it
   * pulls down first. Snapping it down instead was the alternative and it looked
   * like a dropped frame. Clamped against castDelay so a fast recast can't ask the
   * shaft to retract after the launch has already begun.
   */
  castRetract: 0.34,
  /**
   * WAIT FOR THE CAMERA BEFORE CASTING ANYTHING. Seconds.
   *
   * The first build fired the cast on the frame the floor began — which is the
   * same frame the camera starts its fly-in to the bot. The whole effect therefore
   * played out while the bot was a ~15px figure in a wide shot, and finished just
   * as the camera arrived: "i wasn't able to catch the animation" (author,
   * 2026-07-29). It was not too fast. It was aimed at nobody.
   *
   * The focus transition is documented as ~1s in this file (see the Reset guard's
   * note), so this sits just past it. The bot stays at reveal 0 — genuinely absent,
   * not dimmed — for the whole delay, which means you fly in toward an EMPTY beam
   * and the figure builds as you settle. That is better staging than either order
   * would have been by accident.
   *
   * If the focus transition is ever retimed, retime this with it. It is deliberately
   * a number and not a hook into the camera: the fly-in has no completion event, and
   * inventing one to serve a flourish would put a flourish in the camera's path.
   */
  castDelay: 1.05,
  /** The beam fires BEFORE the figure appears — cause, then effect. Seconds,
   *  measured back from the end of castDelay. */
  castBeamLead: 0.22,
  /**
   * Peak multiplier on the beam's own opacity during the strike.
   *
   * IT IS A MULTIPLIER ON 0.1, which is what BEAM_BASE authored, so the number has
   * to be big to read at all: 3.4 reached 0.34 on an additively-blended shaft and
   * the author's verdict was "the beam doesn't seem to change". It didn't, visibly.
   * 9 takes it to ~0.9 for the strike and back to 0.1 after.
   */
  castBeamPeak: 9,
};

const registry = [];

/* ────────────────────────────────────────────────────────────────────────────
   THE CAST — the bot assembling up the beam.

   ONE AXIS, AND IT IS THE BIND POSE, NOT THE ANIMATED POSE. The wipe rides
   `(modelMatrix * vec4(position, 1.0)).y`: `position` is the raw attribute, which
   three never touches, so it is the mesh's BIND pose whatever the skeleton is
   doing that frame. Read the SKINNED position instead and the cut line swims
   up and down with the talking clip — the figure would look like it was being
   assembled by something with the hiccups.

   Multiplying by each mesh's own `modelMatrix` is what makes the axis shared: the
   bot is a hierarchy (body, head, antenna) whose parts have different local
   origins, so raw `position.y` is a different quantity in each of them. In world
   space they agree. Billboarding is yaw-only, so world Y is stable under it.

   THE BOUNDS ARE MEASURED IN EXACTLY THAT SPACE (see measureCastBounds) rather
   than derived from the config, because the numbers there are a local offset in a
   parented 1.2x chain and are live-tunable — every hand-derived figure in this
   subsystem's history has gone stale. Self-measuring means the wipe spans the
   geometry it is actually wiping, whatever anyone types into __pitchBotTune. */

const CAST_FRAG_DECL = `
  varying float vHoloCastY;
  uniform float uHoloReveal;
  uniform float uHoloY0;
  uniform float uHoloY1;
  uniform float uHoloEdge;
  uniform float uHoloEdgeGlow;
`;

/* THE SHADER NO LONGER MASKS THE FIGURE, AND THAT IS THE SECOND REDESIGN OF THIS
   EFFECT — worth recording, because the first version was mechanically fine and
   still wrong.

   It cut the body on a world-Y line and climbed the line: a reveal mask. The
   author's read was "it appears to fade in instead of shooting up from a compressed
   state", and both halves of that are correct. It DID look like a fade, because
   this body is already semi-transparent everywhere (opacity 0.88, alpha further
   modulated by fresnel and scanlines down to a floor of 0.22) — multiplying a
   translucent surface by a soft vertical ramp over 17% of its height is a
   cross-fade with extra steps, not a build. And the effect wanted is a SHAPE
   animation, which a fragment mask cannot do: the figure should squash to the
   projector plate and spring to full height.

   So the motion is now `scale.y` on the root (see tickPitchBotCast) and the shader
   does only what geometry can't: a brief opacity ramp so the squashed figure
   doesn't pop in solid, and a crown flash riding the top of the rising body.

   A MASK AND A SCALE CANNOT BOTH DRIVE THIS. The mask normalises against measured
   world bounds; scaling the root moves those bounds every frame, so the two fight
   and the cut line drifts through the geometry. Keeping both was never an option. */
const CAST_FRAG_BODY = `
  if (uHoloReveal < 0.999) {
    gl_FragColor.a *= smoothstep(0.0, 0.4, uHoloReveal);
    float span = max(uHoloY1 - uHoloY0, 1e-4);
    float h = clamp((vHoloCastY - uHoloY0) / span, 0.0, 1.0);
    gl_FragColor.rgb += uHoloColor * uHoloEdgeGlow * pow(h, 5.0) * (1.0 - uHoloReveal);
  }
`;

/* The face plate's variant. It is EXCLUDED from the holographic treatment because
   it is the pressure display and must keep reading as a screen — but it rides the
   root's scale like everything else, so the CAST needs nothing from it but the
   crown flash. No alpha: the plate is opaque, and turning it transparent to fade
   would move it into the sorted pass in front of a body that draws with depthWrite
   off. It is at the top of the figure, so the flash lands on it hardest, which is
   the right place for it — the face is what you are waiting to see. */
const CAST_FRAG_BODY_OPAQUE = `
  if (uHoloReveal < 0.999) {
    float span = max(uHoloY1 - uHoloY0, 1e-4);
    float h = clamp((vHoloCastY - uHoloY0) / span, 0.0, 1.0);
    gl_FragColor.rgb += uHoloColor * uHoloEdgeGlow * pow(h, 5.0) * (1.0 - uHoloReveal);
  }
`;

/**
 * Give an EXCLUDED material the cut and nothing else.
 *
 * Clones for the same two reasons the holo path does — the temple model may share
 * a material, and Material.clone() JSON-round-trips userData, so a Texture parked
 * there returns as a plain object that crashes on the next frame.
 */
function castOnly(src, o, color) {
  const m = src.clone();
  m.userData = {};
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHoloColor = { value: color };
    addCastUniforms(shader, o);
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `uniform vec3 uHoloColor;
       ${CAST_FRAG_DECL}
       void main() {`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
       ${CAST_FRAG_BODY_OPAQUE}`,
    );
    patchCastVertex(shader);
    registry.push(shader.uniforms);
  };
  m.needsUpdate = true;
  return m;
}

function addCastUniforms(shader, o) {
  shader.uniforms.uHoloReveal = { value: castState.reveal };
  shader.uniforms.uHoloY0 = { value: castState.y0 };
  shader.uniforms.uHoloY1 = { value: castState.y1 };
  shader.uniforms.uHoloEdge = { value: o.revealEdge };
  shader.uniforms.uHoloEdgeGlow = { value: o.revealEdgeGlow };
}

/* Injected after <begin_vertex>, which is where `transformed` is initialised from
   `position` — but we deliberately read `position`, not `transformed`, so this is
   also correct anywhere later. */
function patchCastVertex(shader) {
  shader.vertexShader = shader.vertexShader.replace(
    "void main() {",
    `varying float vHoloCastY;
     void main() {`,
  );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
     vHoloCastY = (modelMatrix * vec4(position, 1.0)).y;`,
  );
}

/**
 * Bind-pose world-space Y extent of everything under `root`.
 *
 * Uses each geometry's boundingBox through the mesh's own matrixWorld, which is
 * the same quantity the vertex shader computes. NOTE the warning in
 * CyborgTempleScene's focus code: a SkinnedMesh's boundingBox is its BIND pose and
 * "reports the figure as 0.07 units wide". That is a real caveat for measuring the
 * ANIMATED silhouette and irrelevant here — bind pose is precisely what we want,
 * because bind pose is what the shader is reading.
 */
export function measureCastBounds(root) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (!o.geometry.boundingBox) return;
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(tmp);
  });
  if (box.isEmpty()) return null;
  return { y0: box.min.y, y1: box.max.y };
}

const castState = {
  reveal: 1, y0: 0, y1: 1, t: -1,
  duration: 0.7, delay: 1.05, lead: 0.22, peak: 9,
  // THE LAUNCH acts on the root's scale.y, which works only because the rig's local
  // origin sits at its feet (stated in PITCH_BOT_CONFIG, and the reason halving the
  // scale needed no y re-tune). Scaling about the feet keeps them on the projector
  // plate; scaling about a centred origin would sink the figure through it.
  root: null, baseScaleY: 1, y1Full: 1, compress: 0.06, overshoot: 0.12,
  retract: 0.34,
};

/* REUSED, NOT REALLOCATED. tickPitchBotCast runs every frame on a scene that this
   file already warns about allocating in ("a GC sawtooth on a scene that already
   runs hot"), so the return value is one long-lived object. Callers must read it
   immediately and never retain it. */
const castOut = { opacity: 1, height: 1 };

/** Push the current reveal (and bounds) into every patched material. */
function pushCast() {
  for (let i = 0; i < registry.length; i++) {
    const u = registry[i];
    if (u.uHoloReveal) u.uHoloReveal.value = castState.reveal;
    if (u.uHoloY0) u.uHoloY0.value = castState.y0;
    if (u.uHoloY1) u.uHoloY1.value = castState.y1;
  }
}

/**
 * Begin the cast. Measures at CALL time, never at mount — the bot's transform is
 * live-tunable and has been retuned three times.
 *
 * Returns false when there is nothing to cast — no bot, no measurable geometry, or
 * the viewer asked not to be moved. The caller should then just show the figure: a
 * projector effect that fails must not take the pitch with it.
 *
 * THE REDUCED-MOTION CHECK LIVES HERE rather than at the call site, so it is one
 * decision the module owns instead of a branch every future caller has to remember
 * — and so "declined" and "couldn't" collapse into the same already-handled return.
 */
export function startPitchBotCast(root, cfg = {}) {
  const o = { ...PITCH_BOT_HOLO, ...cfg };
  if (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    cancelPitchBotCast();
    return false;
  }
  // RESTORE BEFORE MEASURING. A restart mid-cast would otherwise capture the
  // SQUASHED scale as baseScaleY and the bot would settle permanently short — and
  // the bounds would be measured off a compressed rig too. Both surfaces can
  // re-trigger this effect (its deps include pitchBotReady), so a restart is a
  // normal event, not an edge case.
  cancelPitchBotCast();
  const bounds = root ? measureCastBounds(root) : null;
  if (!bounds) return false;
  castState.y0 = bounds.y0;
  castState.y1 = bounds.y1;
  castState.y1Full = bounds.y1;
  castState.root = root;
  castState.baseScaleY = root.scale.y;
  castState.compress = Math.min(Math.max(o.castCompress, 0.001), 1);
  castState.retract = Math.min(Math.max(o.castRetract, 0), castState.delay * 0.6);
  castState.overshoot = Math.max(0, o.castOvershoot);
  castState.duration = Math.max(0.01, o.castDuration);
  castState.delay = Math.max(0, o.castDelay);
  castState.lead = Math.max(0, o.castBeamLead);
  castState.peak = o.castBeamPeak;
  castState.t = 0;
  castState.reveal = 0;
  pushCast();
  return true;
}

/** Snap to fully cast and stop. Use when hiding, and on reduced motion. */
export function cancelPitchBotCast() {
  castState.t = -1;
  castState.reveal = 1;
  castState.y1 = castState.y1Full;
  // Hand the rig back at its authored height. Skipping this is how a cancelled cast
  // leaves a permanently squashed bot in the room.
  if (castState.root) castState.root.scale.y = castState.baseScaleY;
  castState.root = null;
  pushCast();
}

/**
 * Advance the cast. Call once per frame with the frame delta.
 *
 * Returns the multiplier the BEAM should apply to its own opacity this frame, so
 * the strike and the figure come from one clock instead of two that can drift.
 * Always returns a usable number, including while idle, so the caller needs no
 * branch: 1 means "beam as authored".
 *
 * DELTA-DRIVEN AND NOT gsap, on purpose. This scene already owns a useFrame that
 * ticks the holo uniforms, so the cast rides the same clock as the thing it is
 * animating. It also sidesteps gsap's lagSmoothing, which turns a stalled frame
 * into a fifteen-second crawl on this page (see runArrival in engagement.jsx) —
 * a frame delta just makes the cast jump, which is the right failure.
 */
export function tickPitchBotCast(delta) {
  if (castState.t < 0) { castOut.opacity = 1; castOut.height = 1; return castOut; }
  castState.t += Math.min(Math.max(delta, 0), 0.25);  // clamp a tab-switch gap

  const startAt = castState.delay;            // when the figure begins to build
  const flareAt = startAt - castState.lead;   // when the beam strikes
  const endAt = startAt + castState.duration;

  // THE BEAM FIRES FIRST. Cause, then effect — a figure that appears on the same
  // frame as the strike reads as the beam being an afterthought drawn around it.
  // The flare rises over `lead` and decays across the first part of the build, so
  // the shaft is brightest exactly while there is least figure in it.
  let strike = 0;
  if (castState.t >= flareAt) {
    strike = castState.t < startAt
      ? (castState.t - flareAt) / Math.max(castState.lead, 1e-4)
      : 1 - Math.min(1, (castState.t - startAt) / Math.max(castState.duration * 0.7, 1e-4));
  }
  castOut.opacity = 1 + (castState.peak - 1) * Math.max(0, strike);

  if (castState.t >= endAt) {
    cancelPitchBotCast();
    castOut.opacity = 1; castOut.height = 1;
    return castOut;
  }

  // Held flat and invisible until the camera has arrived.
  const p = Math.max(0, (castState.t - startAt) / castState.duration);
  castState.reveal = p;

  // THE LAUNCH. Hand-rolled back-out: overshoots 1 and settles, which is what makes
  // it read as a spring rather than a grow.
  //
  // THE 15.9 IS DERIVED, NOT PICKED. This is the standard back-out — f = 1 + (c+1)q³
  // + cq², q = p-1 — whose peak solves to q = -2c/(3(c+1)); the canonical c =
  // 1.70158 puts it at ~10% over. Working backwards, c ≈ 15.9 × the overshoot you
  // want, so castOvershoot reads in fractions of full height instead of in units of
  // a magic constant. The first pass used 3.0 and produced a 0.4% overshoot —
  // arithmetically a spring, visually a grow, which is exactly the failure this
  // ease exists to avoid. Verified numerically: f(0) = compress and f(1) = 1
  // EXACTLY; the peak lands a little under 1 + castOvershoot (0.12 measures 0.114)
  // because the compress term dilutes it. Close enough to read the knob as height,
  // not close enough to call it exact.
  const s1 = castState.overshoot * 15.9;
  const q = p - 1;
  const eased = p <= 0 ? 0 : 1 + (s1 + 1) * q * q * q + s1 * q * q;
  const f = castState.compress + (1 - castState.compress) * eased;
  if (castState.root) castState.root.scale.y = castState.baseScaleY * f;
  // The crown flash normalises against the CURRENT top, not the authored one, or it
  // would sit above a figure that hasn't got there yet.
  castState.y1 = castState.y0 + (castState.y1Full - castState.y0) * Math.max(f, 1e-3);

  // THE SHAFT RISES WITH THE FIGURE. Three phases, and the first two only exist
  // because the beam arrives at full height with the neon sign in it: pull down to
  // the plate, wait there through the strike, then carry the figure up on the same
  // eased factor — so the top of the beam and the crown of the bot are never out of
  // step, including through the overshoot.
  if (castState.t < castState.retract && castState.retract > 0) {
    const r = castState.t / castState.retract;
    castOut.height = 1 + (castState.compress - 1) * (1 - Math.pow(1 - r, 2));
  } else if (castState.t < startAt) {
    castOut.height = castState.compress;
  } else {
    castOut.height = f;
  }

  pushCast();
  return castOut;
}

/** Clear the registry. Call on unmount, or stale uniforms tick forever. */
export function disposePitchBotHolo() {
  registry.length = 0;
  // AND STOP THE CAST. Without this a remount mid-cast leaves the timer running
  // against an empty registry: it advances, writes to nothing, and the next bot to
  // load inherits a clock that is already part-way through a cast it never began.
  castState.t = -1;
  castState.reveal = 1;
}

/**
 * Turn a loaded pitch-bot into a projection.
 *
 * @param root the loaded gltf.scene (bot + easel + page — all of it)
 * @param cfg  overrides for PITCH_BOT_HOLO
 * @returns how many materials were patched
 */
export function applyPitchBotHolo(root, cfg = {}) {
  const o = { ...PITCH_BOT_HOLO, ...cfg };
  const color = new THREE.Color(o.color);
  let patched = 0;

  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];

    const next = mats.map((src) => {
      if (o.exclude.includes(src.name)) return castOnly(src, o, color);

      // CLONE, so the easel and the body can diverge later and so we never
      // mutate a material the temple model might share. Then SCRUB userData:
      // Material.clone() JSON-round-trips userData, and a Texture living in
      // there comes back as a plain object that crashes on the next frame.
      // (Documented gotcha in this repo — it has bitten before.)
      const m = src.clone();
      m.userData = {};

      m.transparent = true;
      m.depthWrite = false;   // transparent additive-ish surfaces shouldn't occlude
      m.depthTest = true;     // ...but they must still be occluded BY the desks
      m.side = THREE.DoubleSide;
      m.opacity = o.opacity;

      m.onBeforeCompile = (shader) => {
        shader.uniforms.uHoloTime = { value: 0 };
        shader.uniforms.uHoloColor = { value: color };
        shader.uniforms.uHoloTint = { value: o.tint };
        shader.uniforms.uHoloGlow = { value: o.glow };
        shader.uniforms.uHoloScan = { value: o.scan };
        shader.uniforms.uHoloScanSpeed = { value: o.scanSpeed };
        shader.uniforms.uHoloFloor = { value: o.floor };
        addCastUniforms(shader, o);

        shader.fragmentShader = shader.fragmentShader.replace(
          "void main() {",
          `uniform float uHoloTime;
           uniform vec3  uHoloColor;
           uniform float uHoloTint;
           uniform float uHoloGlow;
           uniform float uHoloScan;
           uniform float uHoloScanSpeed;
           uniform float uHoloFloor;
           ${CAST_FRAG_DECL}
           void main() {`,
        );
        patchCastVertex(shader);

        // Appended at the very END of the fragment program, so every lighting
        // chunk three generated has already run and we are only re-grading the
        // result. `vViewPosition` and `normal` are both in scope here for
        // MeshStandardMaterial.
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
           {
             vec3 vDir = normalize(vViewPosition);
             float fres = 1.0 - abs(dot(normalize(normal), vDir));
             fres = pow(clamp(fres, 0.0, 1.0), 1.6);
             float stripes = pow(
               mod((-vViewPosition.y + uHoloTime * uHoloScanSpeed) * uHoloScan, 1.0),
               2.5);
             gl_FragColor.rgb = mix(gl_FragColor.rgb, uHoloColor, uHoloTint);
             gl_FragColor.rgb += uHoloColor * fres * uHoloGlow * 0.55;
             gl_FragColor.a *= clamp(
               max(uHoloFloor, fres * uHoloGlow + stripes * 0.3), 0.0, 1.0);
           }
           ${CAST_FRAG_BODY}`,
        );

        registry.push(shader.uniforms);
      };

      m.needsUpdate = true;
      patched += 1;
      return m;
    });

    node.material = Array.isArray(node.material) ? next : next[0];
  });

  return patched;
}

/** Read the cast's live state. For probes and the tuning handles; see
 *  __pitchBotRecast in pitchBotScene. */
export function pitchBotCastState() {
  return { ...castState, materials: registry.length, running: castState.t >= 0 };
}

/** Drive the scanlines. Call once per frame with elapsed seconds. */
export function tickPitchBotHolo(elapsed) {
  for (let i = 0; i < registry.length; i++) {
    const u = registry[i];
    if (u.uHoloTime) u.uHoloTime.value = elapsed;
  }
}
