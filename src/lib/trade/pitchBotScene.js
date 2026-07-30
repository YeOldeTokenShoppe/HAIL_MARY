import * as THREE from "three";
import {
  applyPitchBotHolo, PITCH_BOT_HOLO, startPitchBotCast, pitchBotCastState,
} from "./pitchBotHolo";

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

export const PITCH_BOT_CONFIG = {
  url: "/models/pitch-bot.glb",
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
  position: [-0.04, 1.362, 0.02],
  rotation: [0, 0, 0],
  // "About half size" (author) — halved from the 0.62 that first seated it.
  // Halving needed NO y re-tune: the rig's local origin sits at its feet.
  scale: 0.31,
  // HIDDEN ON ARRIVAL. CyborgTempleScene turns it on when pressMode goes true;
  // loading it visible put the pitcher in the lobby with no game running.
  visible: false,
  /** Project it, rather than stand it in the room. */
  holographic: true,
  holo: PITCH_BOT_HOLO,
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

// Reused across frames — allocating vectors in a render loop is how you get a GC
// sawtooth on a scene that already runs hot.
const _botWorld = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
let _billboardState = null;

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
}

/**
 * Load the bot, park it, register it for animation and focus.
 *
 * @param gltfLoader  the caller's loader — MUST already have a DRACOLoader
 *                    attached. pitch-bot.glb lists KHR_draco_mesh_compression
 *                    AND EXT_texture_webp as extensionsRequired, so a bare
 *                    loader fails on it. (WebP needs no setup.)
 * @param parent      templeScene — the bot is parented here so it inherits the
 *                    room's transform, which carries a 1.2x scale.
 * @param mixersRef   registered as 'PitchBot'; the scene's per-frame loop
 *                    iterates every entry, so no render-loop edit is needed.
 * @param actionsRef  registered as 'PitchBot' -> { idle, talking }.
 * @param onReady     optional (bot) => void once it is in the scene.
 * @param cfg         overrides for PITCH_BOT_CONFIG.
 */
export function mountPitchBot({
  gltfLoader, parent, mixersRef, actionsRef, onReady = null, cfg = {},
}) {
  const c = { ...PITCH_BOT_CONFIG, ...cfg };
  if (!gltfLoader || !parent) return;

  gltfLoader.load(
    c.url,
    (gltf) => {
      const bot = gltf.scene;
      bot.name = "PitchBot_Root";
      bot.position.set(...c.position);
      bot.rotation.set(...c.rotation);
      bot.scale.setScalar(c.scale);
      bot.visible = c.visible;

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

      // JUST THE BOT. The file briefly also carried Presentation_Chart (an easel)
      // and Presentation_Chart_Page (a UV'd quad) as sibling root nodes, and the
      // design leaned on them as the pitch surface for a few hours. Both were
      // removed from the glb on 2026-07-29, so the projector is the pitcher's only
      // staging and the claim text lives in the reading column. See VC_GAME.md §1.
      if (c.holographic) applyPitchBotHolo(bot, c.holo);

      parent.add(bot);

      const mixer = new THREE.AnimationMixer(bot);
      if (mixersRef) mixersRef.current.PitchBot = mixer;
      if (actionsRef) actionsRef.current.PitchBot = {};
      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        if (actionsRef) actionsRef.current.PitchBot[clip.name] = action;
      });
      actionsRef?.current?.PitchBot?.talking?.play();

      _billboardState = {
        bot,
        enabled: !!c.billboard,
        yawOffset: c.yawOffset || 0,
      };

      // LIVE TUNING, because the transform is an eyeball job. Relative nudges,
      // so repeated calls stack.
      if (typeof window !== "undefined") {
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
            position: bot.position.toArray().map((v) => +v.toFixed(3)),
            yawOffset: +(_billboardState?.yawOffset ?? bot.rotation.y).toFixed(3),
            scale: +bot.scale.x.toFixed(3),
            billboard: !!_billboardState?.enabled,
          };
        };
        /** Set the model-forward correction in DEGREES. Returns the radian value
         *  to paste into PITCH_BOT_CONFIG.yawOffset. */
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
        window.__pitchBotRecast = (cfg = {}) => {
          bot.visible = true;
          const ok = startPitchBotCast(bot, cfg);
          const out = { started: ok, ...pitchBotCastState() };
          let el = document.getElementById("__pitchBotCastProbe");
          if (!el) {
            el = document.createElement("div");
            el.id = "__pitchBotCastProbe";
            el.style.display = "none";
            document.body.appendChild(el);
          }
          el.textContent = JSON.stringify(out);
          return out;
        };
        /** Current cast state, bridged the same way. */
        window.__pitchBotCastState = () => {
          const out = pitchBotCastState();
          const el = document.getElementById("__pitchBotCastProbe");
          if (el) el.textContent = JSON.stringify(out);
          return out;
        };
        /** Toggle billboarding without a reload. */
        window.__pitchBotBillboard = (on) => {
          if (_billboardState) _billboardState.enabled = !!on;
          return { billboard: !!_billboardState?.enabled };
        };
      }

      onReady?.(bot);
    },
    undefined,
    (err) => {
      // Never fatal. The game is fully playable with no bot in the room — the
      // flat surface has no 3D at all — so a failed load must not take the
      // scene down with it.
      console.warn("[PitchBot] load failed; room plays without it", err);
    },
  );
}
