"use client";
// Talk-show set for the /trade page. Swapped in for CyborgTempleScene (the
// RL80_4anims temple GLB) when the player opens the TALK SHOW tab.
//
// The model (talk_show.glb) ships its own set dressing — chairs, floor, neon
// frame/screen, palms — plus two seated Mixamo characters that each carry a
// looping sit pose:
//   • Demon_Empty  → barron_sit_pose
//   • Monk_Empty   → monk_sit_pose   (monk_talking is also present, unused here)
//
// Both rigs use identically-named `mixamorig:` bones, so — exactly like
// CurtainCallStage — each character gets its OWN mixer rooted at its empty;
// a scene-rooted mixer would bind the shared bone names to the wrong rig.
// The GLB is authored to sit in the same volume as the temple model, so it
// mounts at the same transform CyborgTempleScene receives from page.js.
//
// SITEPAL FACE PROJECTION. Each character owns an isolated, same-origin iframe
// running public/sitepal-portal.html. SitePal's globals collide when two embeds
// share a document; one iframe per character gives Barron and GR80 independent
// players, canvases, audio, and lifecycle callbacks. Both canvases are cropped
// onto the GLB face meshes every frame, and the two equal-length uploaded tracks
// start back-to-back from one user gesture.
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SITEPAL_PROJECTION_CONFIG } from "@/components/CyborgTempleScene";

// Version the URL when the Blender export changes so drei does not keep an
// older GLTF from its in-memory cache during hot reloads.
const MODEL_URL = "/models/talk_show.glb?v=20260725-nla";
const SITEPAL_ACCOUNT = "9308752";
const TALK_SHOW_PORTAL_HOST_ID = "talk-show-sitepal-portals";

// Names must match SitePal's Audio Manager exactly.
const TALK_SHOW_AUDIO = {
  Barron: "talk show test for jb",
  Monk: "talk show test GR80",
};

// talk_show.glb is Draco-compressed (+ WebP textures); point drei at the
// bundled decoder instead of the gstatic CDN so it works offline / under CSP.
const DRACO_PATH = "/draco/";

// Each character gets the pose-2 breathing idle plus the pose-2 reaction
// family. Reactions are full seated clips, not additive layers, so the director
// briefly crossfades from the base, plays only the gesture portion, then blends
// back before the trailing idle section.
const CHARACTER_CLIPS = {
  Demon_Empty: {
    actor: "Barron",
    root: "Armature",
    base: "barron_sit_pose2",
    reactions: {
      headnod: "barron_headnod_pose2",
      headnodSubtle: "barron_headnod_subtle_pose2",
      headshakeDisappointment: "barron_headshake_disappointment_pose2",
      lookAround: "barron_look_around_pose2",
      shrug: "barron_shrug_pose2",
      mockCrying: "barron_mockcrying_pose2",
    },
  },
  Monk_Empty: {
    actor: "Monk",
    // GLTFLoader sanitizes Blender's "Armature.001" to "Armature001".
    root: "Armature001",
    base: "monk_sit_pose2",
    reactions: {
      headnod: "monk_headnod_pose2",
      headnodSubtle: "monk_headnod_subtle_pose2",
      headshake: "monk_headshake_pose2",
      headshakeDisappointment: "monk_headshake_disappointment_pose2",
      lookAround: "monk_look_around_pose2",
      shrug: "monk_shrug_pose2",
      prayCrosschest: "monk_pray_crosschest_pose2",
    },
  },
};

const EMPTY_FOR_ACTOR = { Monk: "Monk_Empty", Barron: "Demon_Empty" };

// Full authored lengths at 30fps. A cue may still supply a shorter `duration`
// when only the expressive portion of a pose-2 clip should play.
const REACTION_DURATIONS = {
  Barron: {
    headnod: 4.33,
    headnodSubtle: 4.33,
    headshakeDisappointment: 4.33,
    shrug: 4.33,
    mockCrying: 4.83,
    lookAround: 7.6,
  },
  Monk: {
    headnod: 4.33,
    headnodSubtle: 4.33,
    headshake: 4.33,
    headshakeDisappointment: 4.33,
    shrug: 4.33,
    prayCrosschest: 3.87,
    lookAround: 7.6,
  },
};

// One-minute test dialogue timing returned by ElevenLabs voice_segments.
// Cues stay attached to line numbers so a future script generator can replace
// this array without hand-authoring absolute timestamps.
const TEST_LINE_STARTS = [
  0, 8.4, 13.92, 20.64, 22.24, 26.239,
  31.92, 35.24, 39.6, 44.64, 48.88, 55.84,
];

// Procedural listener gaze is applied after the animation mixer, so it layers
// over breathing and reaction clips without needing separate look-at actions.
const LISTENER_GAZE_YAW = {
  Barron: THREE.MathUtils.degToRad(30),
  Monk: THREE.MathUtils.degToRad(-23),
};

const TEST_DIALOGUE_END = 57.921;

// Listener turns are deliberately directed rather than automatic. Omitted
// lines play to the audience. Each turn starts a beat into the addressed line
// and releases shortly before it ends for a less mechanical exchange.
const DIRECT_ADDRESS_GAZES = [
  { line: 1, listener: "Barron" },
  { line: 2, listener: "Monk" },
  { line: 3, listener: "Barron" },
  { line: 4, listener: "Monk" },
  // Line 5 presents the choice to the audience.
  { line: 6, listener: "Monk" },
  { line: 7, listener: "Barron" },
  { line: 8, listener: "Monk" },
  { line: 9, listener: "Barron" },
  { line: 10, listener: "Monk" },
  { line: 11, listener: "Barron" },
].map((cue) => ({
  ...cue,
  startAt: TEST_LINE_STARTS[cue.line] + 0.22,
  endAt:
    (TEST_LINE_STARTS[cue.line + 1] ?? TEST_DIALOGUE_END) - 0.18,
}));

const TALK_SHOW_CUE_DEFS = [
  // Barron opens; GR80 quietly surveys the studio before answering.
  { line: 0, offset: 0.1, actor: "Monk", reaction: "lookAround", duration: 7.5 },
  // “Are you saving humanity, or opening a position against it?”
  { line: 1, offset: 0.45, actor: "Monk", reaction: "headshake", duration: 1.3 },
  // “You once shorted optimism.”
  { line: 3, offset: 0.05, actor: "Monk", reaction: "headnodSubtle", duration: 1.55 },
  // “I closed the position at a substantial profit.”
  { line: 4, offset: 0.3, actor: "Barron", reaction: "shrug", duration: 3.3 },
  // GR80 calmly enumerates what “enough” means.
  { line: 7, offset: 0.55, actor: "Monk", reaction: "headnodSubtle", duration: 1.6 },
  // Barron recoils at the economic consequences of peace.
  { line: 8, offset: 0.35, actor: "Barron", reaction: "headshakeDisappointment", duration: 2.77 },
  // “Perhaps humanity could survive one disappointing quarter.”
  { line: 9, offset: 0.35, actor: "Monk", reaction: "shrug", duration: 3.3 },
  // Reluctant agreement, then GR80 closes the segment.
  { line: 10, offset: 0.5, actor: "Barron", reaction: "headnodSubtle", duration: 1.6 },
  { line: 11, offset: 0.05, actor: "Monk", reaction: "headnodSubtle", duration: 1.6 },
];

const TALK_SHOW_CUES = TALK_SHOW_CUE_DEFS
  .map((cue) => ({
    ...cue,
    duration:
      cue.duration ?? REACTION_DURATIONS[cue.actor]?.[cue.reaction] ?? 1.5,
    at: TEST_LINE_STARTS[cue.line] + cue.offset,
  }))
  .sort((a, b) => a.at - b.at);

// ── SitePal crop / filter for the talk-show faces ──────────────────────────
// SEPARATE from the temple's DEMON/MONK crops — these are different meshes
// with their own UVs, so the numbers won't transfer 1:1. Seeded from the
// temple Monk/Demon values as a starting point; fit them live with the
// SitePalCropPanel (?tune=sitepal → "TS Monk" / "TS Barron" tabs). The
// per-frame compositor reads these fields every tick, so edits go live.
export const TALKSHOW_MONK_CROP = { cropX: 249, cropY: 150, cropW: 160, cropH: 205, rotateZ: 0, rotateX: 0 };
export const TALKSHOW_MONK_FILTER = { saturate: 99, contrast: 99, brightness: 93, hueRotate: -27, sepia: 0 };
export const TALKSHOW_BARRON_CROP = { cropX: 180, cropY: 118, cropW: 145, cropH: 195, rotateZ: 0, rotateX: 0 };
export const TALKSHOW_BARRON_FILTER = { saturate: 106, contrast: 102, brightness: 73, hueRotate: 0, sepia: 20 };

// Projection registry. sceneId reuses the temple's SitePal scenes (Monk =
// GR80, Barron = the Demon/H80Z scene). face1 = static face to hide, face2 =
// projection target to reveal.
export const TALKSHOW_PROJECTION_CONFIG = {
  Monk: {
    label: "TS Monk",
    sceneId: SITEPAL_PROJECTION_CONFIG.Monk.sceneId,
    face1: "Face1",
    face2: "Face2",
    crop: TALKSHOW_MONK_CROP,
    filter: TALKSHOW_MONK_FILTER,
    // Extra static meshes hidden with the face swap so they don't float over
    // the projected face (the temple hides brows/eyes the same way). Brows
    // lives under Monk_Empty, so it pairs with the Monk's Face1.
    hideExtra: ["Brows"],
  },
  Barron: {
    label: "TS Barron",
    sceneId: SITEPAL_PROJECTION_CONFIG.Demon.sceneId,
    face1: "FaceDemon1",
    face2: "FaceDemon2",
    crop: TALKSHOW_BARRON_CROP,
    filter: TALKSHOW_BARRON_FILTER,
    // Barron's brows live under Demon_Empty as `Demon_Brows` (the Monk's are
    // just `Brows`). Hide with the face swap so they don't float over Face2.
    hideExtra: ["Demon_Brows"],
  },
};

// Warm the GLB fetch before the tab is opened (page.js calls this on mount).
export function preloadTalkShow() {
  useGLTF.preload(MODEL_URL, DRACO_PATH);
}

// Build (once) the crop canvas + CanvasTexture + MeshBasicMaterial for a
// projected face, mirroring CyborgTempleScene's ensureProjectionMaterial.
function ensureProjectionMaterial(st) {
  if (!st.cropCanvas) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = 512;
    cropCanvas.height = 512;
    st.cropCanvas = cropCanvas;
    st.cropCtx = cropCanvas.getContext("2d");
  }
  if (!st.texture) {
    const tex = new THREE.CanvasTexture(st.cropCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    st.texture = tex;
  }
  if (!st.material) {
    st.material = new THREE.MeshBasicMaterial({
      map: st.texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
  }
  if (!st.materialApplied && st.face2) {
    st.face2.material = st.material;
    st.materialApplied = true;
  }
}

// Crop the shared SitePal source into the 512² face canvas (filter + rotate),
// matching CyborgTempleScene's paintProjection exactly.
function paintCrop(st, cfg, source) {
  const ctx = st.cropCtx;
  const canvas = st.cropCanvas;
  const { cropX, cropY, cropW, cropH, rotateZ, rotateX } = cfg.crop;
  const f = cfg.filter;
  ctx.fillStyle = "#9F7854";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try {
    ctx.save();
    ctx.filter = `saturate(${f.saturate}%) contrast(${f.contrast}%) brightness(${f.brightness}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%)`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotateZ * Math.PI) / 180);
    ctx.scale(1, Math.cos((rotateX * Math.PI) / 180));
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.filter = "none";
  } catch (e) {
    // Source canvas not yet renderable (preserveDrawingBuffer race) — skip.
  }
  if (st.texture) st.texture.needsUpdate = true;
}

function TalkShowModel({
  anchorY,
  projectCharacter,
  onPlaybackReady,
  onPlaybackStateChange,
}) {
  const { scene, animations } = useGLTF(MODEL_URL, DRACO_PATH);
  const portalsRef = useRef({
    Monk: { frame: null, ready: false, source: null },
    Barron: { frame: null, ready: false, source: null },
  });
  const playbackRef = useRef({ running: false, startedAt: 0, cueIndex: 0 });

  // Clone so toggling the tab (unmount/remount) and HMR never reuse a mutated
  // tree, and so R3F isn't handed the same cached object twice.
  const cloned = useMemo(() => {
    const c = skeletonClone(scene);
    // Hide the blank inner screen for now (the neon Frame border stays) —
    // reserved for a future topic screen. Flip visible = true to bring back.
    const screen = c.getObjectByName("Content_Screen");
    if (screen) screen.visible = false;
    // Projection targets start hidden; Face1 / FaceDemon1 are the visible
    // static faces until a SitePal projection activates.
    Object.values(TALKSHOW_PROJECTION_CONFIG).forEach((cfg) => {
      const m = c.getObjectByName(cfg.face2);
      if (m) m.visible = false;
    });
    return c;
  }, [scene]);

  // Per-character projection state (face refs + lazily-built canvas/texture/mat).
  const projRef = useRef({});
  useMemo(() => {
    const build = {};
    Object.entries(TALKSHOW_PROJECTION_CONFIG).forEach(([key, cfg]) => {
      build[key] = {
        face1: cloned.getObjectByName(cfg.face1) || null,
        face2: cloned.getObjectByName(cfg.face2) || null,
        hideExtra: (cfg.hideExtra || [])
          .map((n) => cloned.getObjectByName(n))
          .filter(Boolean),
        cropCanvas: null,
        cropCtx: null,
        texture: null,
        material: null,
        materialApplied: false,
      };
    });
    projRef.current = build;
  }, [cloned]);

  // Blender's NLA actions target bones relative to their Armature object.
  // Rooting the mixers at the enclosing empties leaves those tracks unresolved
  // (and both characters in their bind-pose T). Keep the action-bank keys tied
  // to the character empties, but bind each mixer directly to its armature.
  const mixers = useMemo(() => {
    const out = {};
    Object.entries(CHARACTER_CLIPS).forEach(([emptyName, clips]) => {
      const root = cloned.getObjectByName(clips.root);
      if (root) out[emptyName] = new THREE.AnimationMixer(root);
    });
    return out;
  }, [cloned]);

  const headBones = useMemo(() => {
    const out = {};
    Object.values(CHARACTER_CLIPS).forEach((clips) => {
      const root = cloned.getObjectByName(clips.root);
      if (!root) return;
      root.traverse((node) => {
        // GLTFLoader sanitizes "mixamorig:Head" and adds a numeric suffix to
        // duplicate rig names. Exclude HeadTop_End from the match.
        const cleanName = node.name.replace(/[^a-z0-9]/gi, "");
        if (node.isBone && /^mixamorighead\d*$/i.test(cleanName)) {
          out[clips.actor] = node;
        }
      });
    });
    return out;
  }, [cloned]);

  // The bind-pose head orientation is the neutral, straight-ahead direction
  // for these rigs. Barron's intro blends toward it to address the camera
  // without completely removing the breathing motion underneath.
  const neutralHeadQuaternions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(headBones).map(([actor, head]) => [
          actor,
          head.quaternion.clone(),
        ]),
      ),
    [headBones],
  );

  const listenerGazeRef = useRef({ Barron: 0, Monk: 0 });
  const listenerGazeQuatRef = useRef(new THREE.Quaternion());
  const listenerGazeAxisRef = useRef(new THREE.Vector3(0, 1, 0));
  const cameraAimRef = useRef({
    dummy: new THREE.Object3D(),
    cameraPosition: new THREE.Vector3(),
    headPosition: new THREE.Vector3(),
    parentWorldQuaternion: new THREE.Quaternion(),
    desiredLocalQuaternion: new THREE.Quaternion(),
    deltaQuaternion: new THREE.Quaternion(),
    clampedDeltaQuaternion: new THREE.Quaternion(),
    targetQuaternion: new THREE.Quaternion(),
    blendedTargetQuaternion: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    smoothedQuaternion: null,
  });

  // Per-character action banks. Bases loop continuously. Reactions are created
  // up front but only played when the script director reaches their cue.
  const actionsRef = useRef({});
  useEffect(() => {
    const started = [];
    const out = {};
    const findAction = (mixer, name) => {
      const clip = animations.find((a) => a.name === name);
      if (!clip) {
        console.warn(`[TalkShowScene] clip "${name}" not found`);
        return null;
      }
      return mixer.clipAction(clip);
    };
    Object.entries(CHARACTER_CLIPS).forEach(([emptyName, clips]) => {
      const mixer = mixers[emptyName];
      if (!mixer) return;
      const base = findAction(mixer, clips.base);
      if (base) {
        base.reset();
        base.setLoop(THREE.LoopRepeat, Infinity);
        base.setEffectiveWeight(1);
        base.play();
        started.push(base);
      }
      const reactions = {};
      Object.entries(clips.reactions).forEach(([key, clipName]) => {
        const action = findAction(mixer, clipName);
        if (!action) return;
        action.enabled = true;
        action.setEffectiveWeight(0);
        reactions[key] = action;
      });
      out[emptyName] = {
        actor: clips.actor,
        base,
        reactions,
        active: null,
      };
    });
    actionsRef.current = out;
    return () => {
      playbackRef.current = { running: false, startedAt: 0, cueIndex: 0 };
      Object.values(out).forEach((bank) => {
        Object.values(bank.reactions).forEach((action) => action.stop());
      });
      started.forEach((action) => action.stop());
    };
  }, [mixers, animations]);

  // Build one hidden iframe per character. The iframe stays renderable (rather
  // than display:none) so SitePal continues painting the WebGL canvas that is
  // used as the live face texture.
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const existing = document.getElementById(TALK_SHOW_PORTAL_HOST_ID);
    if (existing) existing.remove();

    const host = document.createElement("div");
    host.id = TALK_SHOW_PORTAL_HOST_ID;
    Object.assign(host.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "600px",
      height: "800px",
      overflow: "hidden",
      opacity: "0.01",
      pointerEvents: "none",
      zIndex: "-1",
    });
    document.body.appendChild(host);

    let stopped = false;
    const ended = new Set();

    const resetPerformance = () => {
      playbackRef.current = { running: false, startedAt: 0, cueIndex: 0 };
      Object.values(actionsRef.current).forEach((bank) => {
        if (!bank) return;
        Object.values(bank.reactions || {}).forEach((action) => {
          action.stop();
          action.stopFading();
          action.enabled = true;
          action.setEffectiveWeight(0);
        });
        bank.active = null;
        if (bank.base) {
          bank.base.reset();
          bank.base.stopFading();
          bank.base.enabled = true;
          bank.base.setEffectiveWeight(1);
          bank.base.play();
        }
      });
    };

    const notifyReady = () => {
      const ready = Object.values(portalsRef.current).every((p) => p.ready);
      onPlaybackReady?.(ready);
    };

    const portalForSource = (source) =>
      Object.entries(portalsRef.current).find(([, p]) => p.frame?.contentWindow === source);

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const match = portalForSource(event.source);
      if (!match) return;
      const [key, portal] = match;

      if (event.data?.type === "sitepal-portal-ready") {
        portal.ready = true;
        portal.source = null;
        try {
          const w = portal.frame.contentWindow;
          w.setPlayerVolume?.(0);
          w.loadAudio?.(TALK_SHOW_AUDIO[key]);
        } catch (e) {
          console.warn(`[TalkShowScene] could not preload ${key} audio`, e);
        }
        notifyReady();
      }

      if (event.data?.type === "sitepal-portal-talk-ended") {
        ended.add(key);
        if (ended.size === Object.keys(portalsRef.current).length) {
          resetPerformance();
          onPlaybackStateChange?.(false);
        }
      }
    };

    window.addEventListener("message", onMessage);

    Object.entries(TALKSHOW_PROJECTION_CONFIG).forEach(([key, cfg]) => {
      const frame = document.createElement("iframe");
      frame.title = `Talk show SitePal portal: ${key}`;
      frame.width = "600";
      frame.height = "800";
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.border = "0";
      frame.style.width = "600px";
      frame.style.height = "800px";
      frame.src =
        `/sitepal-portal.html?acc=${SITEPAL_ACCOUNT}` +
        `&scene=${cfg.sceneId}` +
        `&embed=${encodeURIComponent(cfg.hash || "")}`;
      portalsRef.current[key] = { frame, ready: false, source: null };
      host.appendChild(frame);
    });

    const stopShow = () => {
      stopped = true;
      Object.values(portalsRef.current).forEach((portal) => {
        try {
          portal.frame?.contentWindow?.stopSpeech?.();
          portal.frame?.contentWindow?.setPlayerVolume?.(0);
        } catch (e) {}
      });
      ended.clear();
      resetPerformance();
      onPlaybackStateChange?.(false);
    };

    const playShow = () => {
      if (stopped) stopped = false;
      if (!Object.values(portalsRef.current).every((p) => p.ready)) return false;
      ended.clear();

      let started = 0;
      Object.entries(portalsRef.current).forEach(([key, portal]) => {
        try {
          const w = portal.frame.contentWindow;
          w.stopSpeech?.();
          w.saySilent?.(0);
          w.setPlayerVolume?.(7);
          w.loadAudio?.(TALK_SHOW_AUDIO[key]);
          w.sayAudio?.(TALK_SHOW_AUDIO[key]);
          started += 1;
        } catch (e) {
          console.warn(`[TalkShowScene] could not start ${key} audio`, e);
        }
      });

      const ok = started === Object.keys(portalsRef.current).length;
      if (ok) {
        resetPerformance();
        playbackRef.current = {
          running: true,
          startedAt: performance.now(),
          cueIndex: 0,
        };
      }
      onPlaybackStateChange?.(ok);
      return ok;
    };

    window.__talkShowPlay = playShow;
    window.__talkShowStop = stopShow;

    return () => {
      stopShow();
      onPlaybackReady?.(false);
      window.removeEventListener("message", onMessage);
      if (window.__talkShowPlay === playShow) delete window.__talkShowPlay;
      if (window.__talkShowStop === stopShow) delete window.__talkShowStop;
      host.remove();
      portalsRef.current = {
        Monk: { frame: null, ready: false, source: null },
        Barron: { frame: null, ready: false, source: null },
      };
    };
  }, [onPlaybackReady, onPlaybackStateChange]);

  useFrame(({ camera }, delta) => {
    const playback = playbackRef.current;
    let elapsed = 0;
    if (playback.running) {
      elapsed = (performance.now() - playback.startedAt) / 1000;

      // Finish reactions at their authored gesture length instead of allowing
      // the pose-2 clip's trailing breathing idle to run to frame 129.
      Object.values(actionsRef.current).forEach((bank) => {
        if (!bank?.active || elapsed < bank.active.endAt) return;
        bank.base.enabled = true;
        bank.active.action.crossFadeTo(bank.base, 0.24, false);
        bank.active = null;
      });

      // Consume every cue reached this frame. The performance clock is derived
      // from performance.now(), so a dropped render frame cannot permanently
      // skip a reaction.
      while (
        playback.cueIndex < TALK_SHOW_CUES.length &&
        TALK_SHOW_CUES[playback.cueIndex].at <= elapsed
      ) {
        const cue = TALK_SHOW_CUES[playback.cueIndex];
        playback.cueIndex += 1;
        const emptyName = EMPTY_FOR_ACTOR[cue.actor];
        const bank = actionsRef.current[emptyName];
        const action = bank?.reactions?.[cue.reaction];
        if (!bank?.base || !action) continue;

        const outgoing = bank.active?.action || bank.base;
        action.stop();
        action.reset();
        action.stopFading();
        action.enabled = true;
        action.setLoop(THREE.LoopOnce, 1);
        // Hold the authored final pose while the return crossfade completes.
        // Otherwise a reaction that reaches its last frame can disable itself
        // before the base idle has regained full weight, flashing the bind pose.
        action.clampWhenFinished = true;
        action.setEffectiveWeight(1);
        action.play();
        outgoing.crossFadeTo(action, 0.18, false);
        bank.active = {
          action,
          endAt: elapsed + cue.duration,
        };
      }
    }

    Object.values(mixers).forEach((m) => m.update(delta));

    const introCameraFocus = playback.running
      ? 1 -
        THREE.MathUtils.smoothstep(
          elapsed,
          TEST_LINE_STARTS[1] - 0.6,
          TEST_LINE_STARTS[1],
        )
      : 0;
    if (
      introCameraFocus > 0.001 &&
      headBones.Barron &&
      neutralHeadQuaternions.Barron
    ) {
      const head = headBones.Barron;
      if (head.parent) {
        // Mirror CyborgTempleScene's proven Demon look-at math. A dummy
        // Object3D aims at the actual viewer camera, then its world rotation is
        // converted into the head bone's local space and clamped without roll.
        const aim = cameraAimRef.current;
        cloned.updateWorldMatrix(true, true);
        camera.getWorldPosition(aim.cameraPosition);
        head.getWorldPosition(aim.headPosition);
        aim.dummy.position.copy(aim.headPosition);
        aim.dummy.lookAt(aim.cameraPosition);
        head.parent.getWorldQuaternion(aim.parentWorldQuaternion).invert();
        aim.desiredLocalQuaternion
          .copy(aim.parentWorldQuaternion)
          .multiply(aim.dummy.quaternion);

        const baseLocal = neutralHeadQuaternions.Barron;
        aim.deltaQuaternion
          .copy(baseLocal)
          .invert()
          .multiply(aim.desiredLocalQuaternion);
        aim.euler.setFromQuaternion(aim.deltaQuaternion, "YXZ");
        aim.euler.y = THREE.MathUtils.clamp(aim.euler.y, -1.15, 1.15);
        aim.euler.x = THREE.MathUtils.clamp(aim.euler.x, -0.5, 0.5);
        aim.euler.z = 0;
        aim.clampedDeltaQuaternion.setFromEuler(aim.euler);
        aim.targetQuaternion
          .copy(baseLocal)
          .multiply(aim.clampedDeltaQuaternion);

        // Retain a trace of the authored breathing pose, and keep smoothing
        // state between frames just like the Temple focus interaction.
        aim.blendedTargetQuaternion
          .copy(head.quaternion)
          .slerp(aim.targetQuaternion, introCameraFocus);
        if (!aim.smoothedQuaternion) {
          aim.smoothedQuaternion = head.quaternion.clone();
        }
        aim.smoothedQuaternion.slerp(aim.blendedTargetQuaternion, 0.08);
        head.quaternion.copy(aim.smoothedQuaternion);
      }
    } else if (cameraAimRef.current.smoothedQuaternion && headBones.Barron) {
      const aim = cameraAimRef.current;
      const animQuaternion = headBones.Barron.quaternion.clone();
      aim.smoothedQuaternion.slerp(animQuaternion, 0.08);
      headBones.Barron.quaternion.copy(aim.smoothedQuaternion);
      if (aim.smoothedQuaternion.angleTo(animQuaternion) < 0.01) {
        aim.smoothedQuaternion = null;
      }
    }

    let addressedListener = null;
    if (playback.running) {
      for (const cue of DIRECT_ADDRESS_GAZES) {
        if (elapsed >= cue.startAt && elapsed < cue.endAt) {
          addressedListener = cue.listener;
          break;
        }
      }
    }

    Object.entries(headBones).forEach(([actor, head]) => {
      const target =
        addressedListener === actor ? LISTENER_GAZE_YAW[actor] : 0;
      const current = listenerGazeRef.current[actor] || 0;
      const eased = THREE.MathUtils.damp(
        current,
        target,
        target === 0 ? 6.5 : 4.5,
        delta,
      );
      listenerGazeRef.current[actor] = eased;
      listenerGazeQuatRef.current.setFromAxisAngle(
        listenerGazeAxisRef.current,
        eased,
      );
      head.quaternion.multiply(listenerGazeQuatRef.current);
    });

    Object.entries(TALKSHOW_PROJECTION_CONFIG).forEach(([key, cfg]) => {
      const st = projRef.current[key];
      if (!st) return;
      const portal = portalsRef.current[key];
      if (portal?.ready && !portal.source) {
        try {
          const canvases = portal.frame?.contentDocument?.querySelectorAll("canvas");
          if (canvases?.length) portal.source = canvases[canvases.length - 1];
        } catch (e) {}
      }
      const source = portal?.source;
      // Default production mode projects both characters. The existing
      // ?tune=sitepal control can still isolate either face while fitting.
      const selectedForFit =
        projectCharacter !== "Off" &&
        (!projectCharacter || projectCharacter === key);
      const show = selectedForFit && portal?.ready && !!source;
      if (show) ensureProjectionMaterial(st);
      if (st.face1) st.face1.visible = !show;
      if (st.face2) st.face2.visible = show;
      st.hideExtra.forEach((m) => { m.visible = !show; });
      if (show && st.cropCtx) paintCrop(st, cfg, source);
    });
  });

  // Mirror CyborgTempleScene's internal anchor offset so the set lands at the
  // same height the temple model does.
  return (
    <group position={[0, anchorY, 0]}>
      <primitive object={cloned} />
    </group>
  );
}

// Mounts inside the existing CleanCanvas (no Canvas of its own). Takes the
// same position/scale/rotation CyborgTempleScene receives so the swap keeps
// the model in the same spot. `projectCharacter` ('Monk' | 'Barron' | null)
// activates the live SitePal projection on that character's face for fitting.
export default function TalkShowScene({
  position = [0, -1.9, 0],
  scale = [1.2, 1.2, 1.2],
  rotation = [0, 0, 0],
  anchorY = 0.3,
  projectCharacter = null,
  onPlaybackReady,
  onPlaybackStateChange,
}) {
  return (
    <group position={position} scale={scale} rotation={rotation}>
      <Suspense fallback={null}>
        <TalkShowModel
          anchorY={anchorY}
          projectCharacter={projectCharacter}
          onPlaybackReady={onPlaybackReady}
          onPlaybackStateChange={onPlaybackStateChange}
        />
      </Suspense>
    </group>
  );
}
