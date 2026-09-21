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
// share a document; one iframe per character gives Connor and GR80 independent
// players, canvases, audio, and lifecycle callbacks. Both canvases are cropped
// onto the GLB face meshes every frame, and the two equal-length uploaded tracks
// start back-to-back from one user gesture.
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, SpotLight } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SITEPAL_PROJECTION_CONFIG } from "@/components/CyborgTempleScene";
import { useChannelScreen } from "@/components/trade/ltTvChannelScreen";
import {
  buildEpisodeTimeline,
  chapterIndexAt,
  cueIndexAt,
  sectionIndexAt,
  shotSubjectAt,
  speakerAt,
  stepSection,
  validateEpisode,
} from "@/lib/ltTv/episodeTimeline.mjs";
import { findEpisode } from "@/content/lt-tv";

// Version the URL when the Blender export changes so drei does not keep an
// older GLTF from its in-memory cache during hot reloads.
const MODEL_URL = "/models/talk_show3-textures.glb?v=news-desk-hierarchy-1";
// World up, for the camera prop's pan.
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SITEPAL_ACCOUNT = "9308752";
const TALK_SHOW_PORTAL_HOST_ID = "talk-show-sitepal-portals";

// A portal occasionally comes up with no player at all — SitePal's embed runs
// (window.__portal is set) but never builds its canvas, so that character never
// reports ready. Because the START control waits on BOTH portals, one silent
// failure used to hang the set on "Loading voices…" forever with no way out but
// a page reload. Reload the offending iframe instead, then give up loudly.
// Generous first window — a healthy portal is ready well inside it, and
// reloading one that was merely slow makes things worse. Backs off rather than
// hammering, because the failure mode this guards against may itself be SitePal
// refusing loads. Worst case the retry button appears after ~45s.
const PORTAL_READY_TIMEOUT_MS = 18000;
const PORTAL_RETRY_BACKOFF = 1.5;
const PORTAL_MAX_ATTEMPTS = 2;

// WHAT PLAYS IS THE EPISODE'S, NOT THE SET'S. The SitePal clip names, the
// line starts, who holds each line and the reaction cues all arrive on the
// `episode` prop as a record from src/content/lt-tv, and buildEpisodeTimeline
// turns that record into the performance this file drives. Everything below is
// the SET: the rig, the clips it can play, the crops, the camera. Producing an
// episode never touches it.

// Point drei at the bundled Draco decoder instead of the gstatic CDN so it
// works offline / under CSP. NOTE: the 2026-07-31 re-export dropped Draco
// (3.4MB → 7MB; textures are still WebP) — this stays wired so re-enabling
// compression on the next export needs no code change.
const DRACO_PATH = "/draco/";

// Each character gets the pose-2 breathing idle plus the pose-2 reaction
// family. Reactions are full seated clips, not additive layers, so the director
// briefly crossfades from the base, plays only the gesture portion, then blends
// back before the trailing idle section.
const CHARACTER_CLIPS = {
  Demon_Empty: {
    actor: "Connor",
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

const EMPTY_FOR_ACTOR = { Monk: "Monk_Empty", Connor: "Demon_Empty" };

// Full authored lengths at 30fps. A cue may still supply a shorter `duration`
// when only the expressive portion of a pose-2 clip should play.
const REACTION_DURATIONS = {
  Connor: {
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

// Seconds between the performance clock starting and the first WORD. Line
// starts come from ElevenLabs' voice_segments, but the clock is stamped when
// sayAudio() is called — and SitePal reports the track as started within
// ~150ms, so the difference is dead air at the head of the uploaded tracks.
// Everything on the timeline (camera shots, reaction cues, listener gazes)
// reads through this, so it stays in sync. Seeded from the episode record's
// `leadIn` when an episode mounts; trim by ear via `window.__tsTiming` and
// write the value you land on back into the record.
export const TALK_SHOW_TIMING = {
  leadIn: 2.5,
  // The same idea at a SECTION join. SitePal will not play a clip over 90
  // seconds, so an episode of any length is several clips per character and
  // the set plays them in order. Section one is stamped as it always was; the
  // rest re-stamp the clock when SitePal says it has started talking, so a
  // slow join cannot push the picture out. This trims what is left, and starts
  // at zero because there is no dead air at the head of a section — it was cut
  // out of the middle of a track, not rendered.
  sectionLeadIn: 0,
};

// How long to wait for BOTH clips of a section to report themselves loaded
// before starting anyway. A cold 88-second clip took 6939ms to load on
// Michelle's machine (measured 2026-09-21), so this is a backstop against a
// callback that never comes, not a schedule anything is expected to hit.
const ARM_FAILSAFE_MS = 12000;

// How long to hold the picture at a section join before running on regardless.
// It must outlast ARM_FAILSAFE_MS: the audio now waits for both clips to land,
// and a picture that gave up first would run the next section's opening over
// silence — the exact desync this file spends so much effort avoiding.
const HOLD_FAILSAFE_MS = ARM_FAILSAFE_MS + 3000;

// Nothing playing. `section` is which clip of the episode is up; `holdingAt`
// is the second of the episode to freeze the picture on while the next one
// starts, and null the rest of the time.
//
// `pausedAt` is the page clock at the instant the viewer paused, and null
// whenever the episode is running. Everything on the performance clock is
// derived from `performance.now()`, which does not stop for a pause — so the
// frame loop reads `pausedAt` INSTEAD of the live clock while it is set, and
// the resume adds the whole paused interval back onto `startedAt`. A pause is
// therefore invisible to the picture: the same second is on screen when it
// comes back as when it went away.
const idlePlayback = () => ({
  running: false,
  startedAt: 0,
  cueIndex: 0,
  section: 0,
  holdingAt: null,
  heldSince: 0,
  // Which chapter the graphics are showing. -1 is "nothing published yet", so
  // stopping the show re-publishes the opening chapter rather than leaving the
  // chiron on whatever story it was cut off in the middle of.
  chapterIndex: -1,
  pausedAt: null,
  // Set when the pause had to be done with stopSpeech because this build of
  // the player has no freezeToggle: the resume then restarts the section the
  // viewer was in rather than picking up mid-line.
  resumesFromSectionStart: false,
  // The last second of the episode the frame loop drew. Read by the transport
  // controls, which need to know where playback is without running a clock of
  // their own (and the only clock that survives a pause is this one).
  elapsed: 0,
});

// Procedural listener gaze is applied after the animation mixer, so it layers
// over breathing and reaction clips without needing separate look-at actions.
const LISTENER_GAZE_YAW = {
  Connor: THREE.MathUtils.degToRad(30),
  Monk: THREE.MathUtils.degToRad(-23),
};

// SOLO PROJECTION (mobile) paints one face per frame instead of two, because a
// phone running two SitePal avatar renderers plus two per-frame canvas crops is
// the load that crashed iOS Safari on this page before. It asks the timeline
// who holds the floor (speakerAt — distinct from currentShotSubject, which
// returns null on the two-shot, and a projection has to name someone).
//
// How often the LISTENER's face is resampled in solo mode, in frames. They're
// not talking, so their face only has to carry idle motion and blinks — 1-in-6
// reads as alive while costing a sixth of a full-rate second face.
const SOLO_LISTENER_EVERY_NTH = 6;

// ── SitePal crop / filter for the talk-show faces ──────────────────────────
// SEPARATE from the temple's DEMON/MONK crops — these are different meshes
// with their own UVs, so the numbers won't transfer 1:1. Seeded from the
// temple Monk/Demon values as a starting point; fit them live with the
// SitePalCropPanel (?tune=sitepal → "TS Monk" / "TS Connor" tabs). The
// per-frame compositor reads these fields every tick, so edits go live.
export const TALKSHOW_MONK_CROP = { cropX: 249, cropY: 150, cropW: 160, cropH: 205, rotateZ: 0, rotateX: 0 };
export const TALKSHOW_MONK_FILTER = { saturate: 99, contrast: 99, brightness: 93, hueRotate: -27, sepia: 0 };
export const TALKSHOW_CONNOR_CROP = { cropX: 180, cropY: 118, cropW: 145, cropH: 195, rotateZ: 0, rotateX: 0 };
export const TALKSHOW_CONNOR_FILTER = { saturate: 106, contrast: 102, brightness: 73, hueRotate: 0, sepia: 20 };

// Projection registry. sceneId reuses the temple's SitePal scenes (Monk =
// GR80, Connor = the Demon/H80Z scene). face1 = static face to hide, face2 =
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
  Connor: {
    label: "TS Connor",
    sceneId: SITEPAL_PROJECTION_CONFIG.Demon.sceneId,
    face1: "FaceDemon1",
    face2: "FaceDemon2",
    crop: TALKSHOW_CONNOR_CROP,
    filter: TALKSHOW_CONNOR_FILTER,
    // Connor's brows live under Demon_Empty as `Demon_Brows` (the Monk's are
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

// ── In-scene camera monitor ───────────────────────────────────────────────
// `Camera_Screen` is the flip-out monitor on the tripod camera prop. It shows
// what the lens sees: a second, low-res render of THIS scene from the prop's
// point of view, drawn into an offscreen target each frame and mapped onto the
// screen mesh. Live-tunable from the console via `window.__tsMonitor`.
//
// Two things shaped the implementation:
//   • /trade mounts an EffectComposer (PostProcessingEffects) at useFrame
//     priority 1, and renderer state left behind by an offscreen pass is what
//     blacks the whole canvas. This pass runs at the default priority — before
//     the composer — and restores every flag it touches.
//   • The screen's authored UVs are an unknown island in the prop's texture
//     atlas, so the feed gets its own planar UV set on a cloned geometry: u
//     across the panel, v up it, matching the render target's bottom-left
//     texel origin.
const MONITOR_SCREEN_MESH = "Camera_Screen";
// `Camera` is the swivel head (its origin sits at the top of the tripod) and
// parents `Camera_Screen`; `Tripod` is the legs and stays put. Both are hidden
// for the offscreen pass, so the feed is a clean lens POV with no feedback.
const MONITOR_PIVOT_NODE = "Camera";
const MONITOR_HIDDEN_NODES = ["Camera", "Tripod"];

export const MONITOR_FEED = {
  enabled: true,
  // Long edge of the offscreen target. The monitor is ~90px on screen, so this
  // is already generous; it exists to survive a camera push-in.
  resolution: 384,
  // Refresh every Nth frame. A video tap that lags the room slightly reads as
  // real, and it halves the cost of the second scene pass.
  everyNthFrame: 2,
  // Two-shot fitted live: wide enough to hold both guests and the neon frame
  // between them, with headroom. The single tightens onto one head.
  wideFov: 50,
  closeFov: 27,
  // Where the shot sits relative to its subject. The two-shot rides slightly
  // above the eyeline; the single aims a touch low so the head aims high.
  wideLift: 0.02,
  closeLift: -0.1,
  // Metres in front of the monitor the virtual lens sits, and how far below it.
  push: 0.14,
  lift: -0.02,
  // Easing rates (per second). The pan is deliberately unhurried — an operator
  // swinging a tripod head, not a snap.
  panLambda: 2.4,
  zoomLambda: 2.2,
  // Scale on the PHYSICAL swivel only; the virtual lens always aims true. Drop
  // toward 0.5 if the prop turning its full ~30° reads as too much.
  panScale: 1,
  // ── Operator control: grab the prop to take the handle ──────────────────
  mouseControl: true,
  // Radians per pixel dragged. Direct manipulation — the part you grabbed
  // follows the cursor, so the lens swings the other way (the Street View
  // convention). Flip `dragInvert` for the opposite feel.
  dragSensitivity: 0.005,
  dragInvert: false,
  maxPitch: 0.4,
  wheelSensitivity: 0.03,
  minFov: 16,
  maxFov: 70,
  // Seconds after letting go before the director takes the shot back.
  handBackAfter: 4,
  // How far down the lens axis the manual aim point sits — roughly the
  // distance to the guests, so a manual zoom stays focused on the set.
  aimDistance: 2,
  // Manual overrides for the panel's orientation. The UV build derives both
  // from the authored normals, so these should stay false — they're here to
  // flip a feed by hand without a rebuild if a re-export lands upside down or
  // mirrored.
  flipY: false,
  mirrorX: false,
  // Seconds to shift every shot change, CAMERA ONLY — positive lands the pan
  // later. This should stay near 0; it's here to trim the pans without
  // touching the reaction cues, which read from the same clock. That clock is
  // `leadIn` for the first section and SitePal's own talk-started message for
  // every section after it — see TALK_SHOW_TIMING.
  shotLead: 0,
  // 'auto' follows the shot list; 'wide' | 'Connor' | 'Monk' holds one shot
  // (for fitting without running the show).
  shot: "auto",
  // Read-only: the shot the director is on, written every frame. Watch it
  // against the audio to trim `window.__tsTiming.leadIn`.
  current: null,
};

// Pan and tilt are applied in the PARENT's frame — `yaw * pitch * base` rather
// than writing rotation.y/.x — so the head swivels about world up and tilts
// about its own rest-right axis regardless of how it is authored (this one
// carries the FBX Z-up conversion plus a slight tilt, so its local Y is NOT up).
function applyRigOrientation(feed) {
  feed.yawQuaternion.setFromAxisAngle(WORLD_UP, feed.yaw);
  feed.pitchQuaternion.setFromAxisAngle(feed.restRight, feed.pitch);
  feed.pivot.quaternion
    .copy(feed.yawQuaternion)
    .multiply(feed.pitchQuaternion)
    .multiply(feed.baseQuaternion);
}

// Build the feed once the viewer camera exists (its position picks the side of
// the panel that faces front). Returns null if the prop is missing.
function buildMonitorFeed(root, viewerCamera) {
  const screen = root.getObjectByName(MONITOR_SCREEN_MESH);
  if (!screen?.geometry?.attributes?.position) return null;
  const hidden = MONITOR_HIDDEN_NODES.map((n) => root.getObjectByName(n)).filter(
    Boolean,
  );
  const pivot = root.getObjectByName(MONITOR_PIVOT_NODE) || null;

  screen.updateWorldMatrix(true, false);

  const geometry = screen.geometry.clone();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());

  // The panel's thinnest local axis is its normal; the other two are its width
  // and height. Their world directions decide which reads as "up" and which
  // face points at the room.
  const dims = [size.x, size.y, size.z];
  const normalAxis = dims.indexOf(Math.min(...dims));
  const planeAxes = [0, 1, 2].filter((a) => a !== normalAxis);
  const axisVec = (i, s = 1) =>
    new THREE.Vector3(i === 0 ? s : 0, i === 1 ? s : 0, i === 2 ? s : 0);
  const worldDir = (v) => v.clone().transformDirection(screen.matrixWorld);

  const upness = planeAxes.map((a) => Math.abs(worldDir(axisVec(a)).dot(WORLD_UP)));
  const upAxis = upness[0] >= upness[1] ? planeAxes[0] : planeAxes[1];

  // Which face is the display side. Prefer the AUTHORED normals: deciding it
  // from where the viewer camera happens to be on the first frame depends on
  // whether the rig had finished flying in, and getting it wrong mirrors the
  // whole feed. Fall back to the camera only if the normals are inconclusive
  // (a thick panel whose two faces cancel out).
  const normals = geometry.attributes.normal;
  let normalSign = 0;
  if (normals) {
    let sum = 0;
    for (let i = 0; i < normals.count; i += 1) {
      sum += normals.getComponent(i, normalAxis);
    }
    const mean = sum / normals.count;
    if (Math.abs(mean) > 0.5) normalSign = Math.sign(mean);
  }
  if (!normalSign) {
    const screenWorld = center.clone().applyMatrix4(screen.matrixWorld);
    const towardViewer = viewerCamera
      .getWorldPosition(new THREE.Vector3())
      .sub(screenWorld);
    normalSign = worldDir(axisVec(normalAxis)).dot(towardViewer) >= 0 ? 1 : -1;
  }

  const upLocal = axisVec(upAxis, worldDir(axisVec(upAxis)).dot(WORLD_UP) >= 0 ? 1 : -1);
  const normalLocal = axisVec(normalAxis, normalSign);
  // With the normal pointing at the viewer and up onscreen-up, up × normal is
  // the direction that reads as "right" from the front of the panel.
  const rightLocal = upLocal.clone().cross(normalLocal);

  const rightAxis = rightLocal.x !== 0 ? 0 : rightLocal.y !== 0 ? 1 : 2;
  const uSpan = dims[rightAxis] || 1;
  const vSpan = dims[upAxis] || 1;

  // (0,0) = bottom-left of the panel seen from the front, which is also the
  // render target's first texel, so the feed lands upright and unmirrored.
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i).sub(center);
    uv[i * 2] = THREE.MathUtils.clamp(vertex.dot(rightLocal) / uSpan + 0.5, 0, 1);
    uv[i * 2 + 1] = THREE.MathUtils.clamp(vertex.dot(upLocal) / vSpan + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  screen.geometry = geometry;

  const aspect = uSpan / vSpan;
  const width = Math.round(MONITOR_FEED.resolution);
  const target = new THREE.WebGLRenderTarget(
    width,
    Math.max(2, Math.round(width / aspect)),
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    },
  );
  // Render targets hold linear values (three only applies the output transfer
  // when drawing to the canvas), so the feed must not be decoded again here.
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: target.texture,
    toneMapped: false,
    // The prop's body carries a second, coincident screen quad (material
    // `Screen.001`); the offset keeps the live feed on top of it.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  screen.material = material;

  return {
    root,
    screen,
    hidden,
    pivot,
    geometry,
    material,
    target,
    center,
    camera: new THREE.PerspectiveCamera(MONITOR_FEED.wideFov, aspect, 0.05, 200),
    // Pan state. `restYaw` is the bearing the prop was authored pointing along,
    // taken on the first frame, so yaw 0 is always the modelled pose, and
    // `restRight` is the axis it tilts about.
    baseQuaternion: pivot ? pivot.quaternion.clone() : null,
    yawQuaternion: new THREE.Quaternion(),
    pitchQuaternion: new THREE.Quaternion(),
    restYaw: null,
    restRight: new THREE.Vector3(1, 0, 0),
    yaw: 0,
    pitch: 0,
    eye: new THREE.Vector3(),
    aim: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    fov: MONITOR_FEED.wideFov,
    primed: false,
    tick: 0,
    // Operator control.
    dragging: false,
    releasedAt: 0,
    manualFov: null,
    lastX: 0,
    lastY: 0,
    tmpA: new THREE.Vector3(),
    tmpB: new THREE.Vector3(),
    prevClear: new THREE.Color(),
  };
}

// Which shot is live at `elapsed`, on the episode currently mounted. `null`
// subject = the two-shot.
function currentShotSubject(timeline, elapsed, running) {
  const override = MONITOR_FEED.shot;
  if (override !== "auto") return override === "wide" ? null : override;
  if (!running) return null;
  return shotSubjectAt(timeline, elapsed - MONITOR_FEED.shotLead);
}

// Runs EVERY frame (the feed itself may render at half rate, but the prop must
// swivel smoothly): pick the shot, then ease the pan, the zoom and the aim
// toward it. The physical swivel is cosmetic — the virtual lens aims at the
// subject directly, so the feed stays framed even if the prop lags or the
// authored rest pose is a few degrees off.
function updateCameraRig(feed, headBones, timeline, elapsed, running, delta) {
  const pivot = feed.pivot;
  const panEase = 1 - Math.exp(-MONITOR_FEED.panLambda * delta);

  // Manual holds through the drag and for a beat after, so letting go doesn't
  // instantly snatch the camera back.
  const heldRecently =
    feed.releasedAt > 0 &&
    (performance.now() - feed.releasedAt) / 1000 < MONITOR_FEED.handBackAfter;
  const manual = pivot && (feed.dragging || heldRecently);
  if (!manual && feed.releasedAt) {
    feed.releasedAt = 0;
    feed.manualFov = null;
  }

  // Where the lens sits: the monitor's own position, nudged forward once the
  // aim is known. It swings with the swivel because the screen does.
  feed.screen.updateWorldMatrix(true, false);
  const eye = feed.eye.copy(feed.center).applyMatrix4(feed.screen.matrixWorld);

  if (manual) {
    // Hands on: the LENS follows the PROP, so it can be pointed anywhere —
    // the floor, the neon frame — not just at whoever is talking.
    MONITOR_FEED.current = "manual";
    const bearing = feed.restYaw + feed.yaw;
    const flat = Math.cos(feed.pitch);
    feed.forward.set(
      flat * Math.sin(bearing),
      Math.sin(feed.pitch),
      flat * Math.cos(bearing),
    );
    eye.addScaledVector(feed.forward, MONITOR_FEED.push);
    eye.y += MONITOR_FEED.lift;
    feed.aim.copy(eye).addScaledVector(feed.forward, MONITOR_FEED.aimDistance);
    feed.fov = THREE.MathUtils.lerp(
      feed.fov,
      feed.manualFov ?? feed.fov,
      1 - Math.exp(-MONITOR_FEED.zoomLambda * delta),
    );
    applyRigOrientation(feed);
    return;
  }

  const subject = currentShotSubject(timeline, elapsed, running);
  MONITOR_FEED.current = subject ?? "wide";
  const head = subject ? headBones[subject] : null;

  const desired = feed.tmpA.set(0, 0, 0);
  if (head) {
    head.getWorldPosition(desired);
    desired.y += MONITOR_FEED.closeLift;
  } else {
    let heads = 0;
    Object.values(headBones).forEach((bone) => {
      desired.add(bone.getWorldPosition(feed.tmpB));
      heads += 1;
    });
    if (heads) desired.multiplyScalar(1 / heads);
    else feed.root.getWorldPosition(desired);
    desired.y += MONITOR_FEED.wideLift;
  }

  if (feed.primed) feed.aim.lerp(desired, panEase);
  else {
    feed.aim.copy(desired);
    feed.primed = true;
  }

  const forward = feed.forward.copy(feed.aim).sub(eye);
  if (forward.lengthSq() > 1e-8) {
    forward.normalize();
    eye.addScaledVector(forward, MONITOR_FEED.push);
    eye.y += MONITOR_FEED.lift;
  }

  feed.fov = THREE.MathUtils.lerp(
    feed.fov,
    head ? MONITOR_FEED.closeFov : MONITOR_FEED.wideFov,
    1 - Math.exp(-MONITOR_FEED.zoomLambda * delta),
  );

  if (!pivot) return;
  pivot.updateWorldMatrix(true, false);
  pivot.getWorldPosition(feed.tmpB);
  const bearing = Math.atan2(
    desired.x - feed.tmpB.x,
    desired.z - feed.tmpB.z,
  );
  if (feed.restYaw === null) {
    feed.restYaw = bearing;
    // The axis the head tilts about at rest — perpendicular to the rest aim.
    feed.restRight.set(-Math.cos(bearing), 0, Math.sin(bearing));
  }
  // Shortest way round, so a bearing that crosses ±π never unwinds the long way.
  const offset = bearing - feed.restYaw;
  const target =
    Math.atan2(Math.sin(offset), Math.cos(offset)) * MONITOR_FEED.panScale;
  feed.yaw += (target - feed.yaw) * panEase;
  feed.pitch += (0 - feed.pitch) * panEase;
  applyRigOrientation(feed);
}

// One offscreen pass from the prop's point of view. Every renderer flag it
// touches is restored before the EffectComposer's pass runs.
function renderMonitorFeed(feed, gl, scene) {
  const { screen, camera, target } = feed;

  // Orientation overrides ride on the texture transform, so flipping one is
  // live and never touches the rebuilt UVs.
  const flipX = MONITOR_FEED.mirrorX ? -1 : 1;
  const flipY = MONITOR_FEED.flipY ? -1 : 1;
  const tex = target.texture;
  if (tex.repeat.x !== flipX || tex.repeat.y !== flipY) {
    tex.repeat.set(flipX, flipY);
    tex.offset.set(flipX < 0 ? 1 : 0, flipY < 0 ? 1 : 0);
  }

  // eye/aim were resolved this frame by updateCameraRig.
  if (feed.eye.distanceToSquared(feed.aim) < 1e-8) return;
  camera.position.copy(feed.eye);
  camera.up.set(0, 1, 0);
  camera.lookAt(feed.aim);
  camera.fov = feed.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const prevTarget = gl.getRenderTarget();
  const prevXr = gl.xr.enabled;
  const prevAlpha = gl.getClearAlpha();
  gl.getClearColor(feed.prevClear);
  const wasVisible = feed.hidden.map((o) => o.visible);
  feed.hidden.forEach((o) => { o.visible = false; });
  screen.visible = false;
  try {
    gl.xr.enabled = false;
    // The canvas is alpha:true — clearing the feed opaque keeps the monitor
    // from punching a transparent hole in the page behind it.
    gl.setClearColor(0x000000, 1);
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
  } finally {
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(feed.prevClear, prevAlpha);
    gl.xr.enabled = prevXr;
    feed.hidden.forEach((o, i) => { o.visible = wasVisible[i]; });
    screen.visible = true;
  }
}

// ── Studio lighting ───────────────────────────────────────────────────────
// The four fixtures on the overhead bar are GEOMETRY ONLY — the GLB carries no
// KHR_lights_punctual — so until now the set was lit entirely by the page's
// ambientLight and the lamps read as dead props. Each one gets a real
// THREE.SpotLight hung in its aperture, aimed down its own barrel, plus drei's
// volumetric cone so the shaft is visible against the black stage.
//
// THE AIM IS THE MODEL'S, NOT OURS. The fixtures were angled in Blender: the
// outer pair rakes the two chairs and the inner pair washes the middle of the
// set, so the plot below just names what was already authored rather than
// pointing lights at hand-picked coordinates that a re-export would invalidate.
const LAMP_HEAD_NODES = [
  // Bar order as modelled, +x first — so 01 is on GR80's side of the set and
  // 04 is on Connor's.
  "SM_Prop_Light_Spotlight_02_Light_01",
  "SM_Prop_Light_Spotlight_02_Light_02",
  "SM_Prop_Light_Spotlight_02_Light_03",
  "SM_Prop_Light_Spotlight_02_Light_04",
];

// Live-tunable from the console via `window.__tsLights`, same contract as
// `__tsMonitor`: the per-frame sync in StudioLights reads these fields every
// tick, so edits go live. THE TWO EXCEPTIONS ARE `coneLength` and `radiusTop`,
// which are baked into the cone geometry at mount — change those and reopen the
// tab.
//
// THREE LENGTH KNOBS, AND THEY ARE NOT THE SAME UNITS. `range` and `beamLength`
// are consumed in WORLD space (the light's own falloff, and SpotLightMaterial's
// `distance(worldPosition, spotPosition)`), while the cone MESH is built in the
// set's local space — which /trade scales by 1.2. `coneLength` is therefore
// stated in model units and the other two in world units. Keep
// `coneLength * <the page's scale>` a little longer than `beamLength` so the
// shaft fades out on its own rather than ending in a cut-off disc.
export const STUDIO_LIGHTS = {
  enabled: true,
  // Beams off leaves the illumination but hides the visible shafts.
  beams: true,
  // HOUSE LIGHTS. The rig is at full only while an episode is actually
  // running; off air it sits at this fraction of the plot, so tuning in and
  // pressing play brings the studio up and the end of the show takes it back
  // down. Everything the fixture contributes rides it together — the
  // illumination, the visible shaft and the lens glare — because a dimmed lamp
  // with its lens still blazing reads as a bug rather than a cue.
  //
  // Not zero: off air is the lineup and the pre-show set, which still have to
  // be lit enough to see. Tune by eye from the console like every other knob.
  //
  // THIS NUMBER ALONE IS NOT THE CUE, and 0.3 of it was invisible on the news
  // set — see HOUSE_AMBIENT. The page lights the whole canvas with a flat
  // ambient several times brighter than anything these four fixtures add, so
  // dimming only the rig moves a fraction of what is on screen. Both ride the
  // same signal now.
  offAir: 0.22,
  // Fade rate, per second, for that transition. Around this figure the change
  // lands in roughly a second — a lighting board, not a switch.
  fadeLambda: 2.2,
  angle: 0.24,
  penumbra: 0.75,
  // Real inverse-square (2) drops ~18:1 between the guests and the floor and
  // loses the pools on the carpet entirely. This is the flattering-studio-rig
  // cheat, not physics.
  decay: 1.2,
  // Where the ILLUMINATION cuts out (world units). Well past the floor: three
  // rolls the last stretch off hard, so a range that only just reaches kills
  // the floor pools.
  range: 9,
  // Where the VISIBLE SHAFT fades to nothing (world units) — the fixtures hang
  // ~5.4 world units above the carpet at these rake angles.
  beamLength: 5.6,
  // Cone MESH length, in model units. Mount-time only.
  coneLength: 5.5,
  // Softness of the shaft's edge. Higher = the rim falls off sooner.
  anglePower: 5,
  // Mouth of the cone. Mount-time only.
  radiusTop: 0.05,
  // All the lamp geometry shares one material (PolygonClub_MAT), so there is no
  // lens mesh to make emissive — this is an additive sprite parked in each
  // aperture instead. Bloom (desktop only, and this tab is desktop only) turns
  // it into the glare that sells the fixture as switched on.
  lens: { enabled: true, size: 0.11, opacity: 0.5 },
  // Per fixture, in LAMP_HEAD_NODES order. `opacity` is the shaft's, and it
  // stacks where cones overlap — the same trap the curtain-call spotlights hit
  // on 2026-07-26, so judge brightness from a few camera angles.
  //
  // `yaw` / `pitch` are DEGREES OFF THE MODELLED AIM, not absolute angles, so 0
  // is always whatever Blender authored. Positive yaw swings the beam toward
  // Connor (−x), positive pitch lifts it. The lamp head itself turns with the
  // beam, so a re-aim still looks like it is coming out of the fixture.
  plot: [
    // key — lands on GR80
    { intensity: 8, color: "#ffe6c4", opacity: 0.13, yaw: 0, pitch: 0 },
    // fill — centre right
    { intensity: 4, color: "#ffd9b0", opacity: 0.085, yaw: 0, pitch: 0 },
    // fill — neon frame
    { intensity: 4, color: "#ffd9b0", opacity: 0.085, yaw: 0, pitch: 0 },
    // key — lands on Connor
    { intensity: 8, color: "#ffe6c4", opacity: 0.13, yaw: 0, pitch: 0 },
  ],
};

// ── House ambient ─────────────────────────────────────────────────────────
// THE FLAT AMBIENT IS MOST OF THE LIGHT IN THE ROOM, which is why dimming the
// overhead rig on its own did nothing a viewer could see. /trade lights the
// whole canvas with one `ambientLight` at 1.5, and the four spots add 8 and 4
// over a small part of the set — so taking the rig to a fraction of its plot
// still left every surface flatly lit and the cue read as "nothing happened".
//
// `HouseAmbient` is that same ambient light with its intensity eased on the
// same signal. Off air the surfaces go down and the set's own neon — the
// frame, the desk edge, the programme screen, the lens sprites — stays where
// it is, because none of it is lit by this light. That is the studio going
// dark around the sign, which is the cue asked for.
//
// It is mounted for the WHOLE page, so `dimmed` must only ever be true while
// the talk show tab is on. Outside it, the value is the 1.5 the page has
// always had. Live-tunable from `window.__tsAmbient`.
export const HOUSE_AMBIENT = {
  onAir: 1.5,
  offAir: 0.5,
  // Matches STUDIO_LIGHTS.fadeLambda so the room and the rig move together;
  // two different rates read as two separate faults.
  fadeLambda: 2.2,
};

export function HouseAmbient({ dimmed = false }) {
  const lightRef = useRef(null);
  const levelRef = useRef(dimmed ? HOUSE_AMBIENT.offAir : HOUSE_AMBIENT.onAir);

  useEffect(() => {
    if (typeof window !== "undefined") window.__tsAmbient = HOUSE_AMBIENT;
  }, []);

  useFrame((state, delta) => {
    const target = dimmed ? HOUSE_AMBIENT.offAir : HOUSE_AMBIENT.onAir;
    levelRef.current = THREE.MathUtils.damp(
      levelRef.current,
      target,
      HOUSE_AMBIENT.fadeLambda,
      delta,
    );
    if (lightRef.current) lightRef.current.intensity = levelRef.current;
  });

  return <ambientLight ref={lightRef} intensity={levelRef.current} />;
}

// How far down the beam the SpotLight's target is parked. Direction-only, so
// the value just has to be comfortably clear of the light itself.
const AIM_THROW = 4;
const AIM_UP = new THREE.Vector3(0, 1, 0);

// Read each fixture's aperture and barrel direction straight off the model.
//
// The lamp head's origin is its YOKE PIVOT, so the housing reaches much further
// along the barrel than along anything else — the bounding-box face furthest
// from that pivot IS the aperture, which gives both the beam axis and the point
// to hang the light at. Deriving it beats hard-coding local +Y (what this
// export happens to use — the FBX Z-up conversion means the barrel axis is NOT
// the fixture's visual "down"): a re-export that lands the heads in a different
// orientation still lights the set.
//
// Everything is returned in `root`'s PARENT space, which is where the lights
// mount as its siblings.
function readLightFixtures(root) {
  root.updateWorldMatrix(false, true);
  const toParent = new THREE.Matrix4()
    .copy(root.matrixWorld)
    .invert()
    .premultiply(root.matrix);
  const local = new THREE.Matrix4();

  return LAMP_HEAD_NODES.map((name) => {
    const head = root.getObjectByName(name);
    if (!head?.geometry) {
      console.warn(`[TalkShowScene] lamp head "${name}" not found — no spotlight`);
      return null;
    }
    if (!head.geometry.boundingBox) head.geometry.computeBoundingBox();
    const box = head.geometry.boundingBox;
    const [axis, reach] = [
      [new THREE.Vector3(1, 0, 0), box.max.x],
      [new THREE.Vector3(-1, 0, 0), -box.min.x],
      [new THREE.Vector3(0, 1, 0), box.max.y],
      [new THREE.Vector3(0, -1, 0), -box.min.y],
      [new THREE.Vector3(0, 0, 1), box.max.z],
      [new THREE.Vector3(0, 0, -1), -box.min.z],
    ].sort((a, b) => b[1] - a[1])[0];

    local.multiplyMatrices(toParent, head.matrixWorld);
    const pivot = new THREE.Vector3().setFromMatrixPosition(local);
    const position = axis.clone().multiplyScalar(reach).applyMatrix4(local);
    const direction = axis.clone().transformDirection(local).normalize();

    // These hang over the set and rake down onto it. An axis that came back
    // pointing up means the bounding-box read picked the wrong end, and the
    // beam would shine off into the starfield with nothing to show for it.
    if (direction.y > -0.15) {
      console.warn(
        `[TalkShowScene] "${name}" barrel axis reads as ` +
          `${direction.toArray().map((v) => v.toFixed(2)).join(", ")} — not aimed ` +
          `at the set; check the fixture's pivot in the export`,
      );
    }

    // Direction only — the SpotLight looks at this, the distance is irrelevant.
    const target = new THREE.Object3D();
    target.position.copy(position).addScaledVector(direction, AIM_THROW);
    return {
      name,
      head,
      // Yoke pivot and how far past it the aperture sits, so re-aiming can put
      // the light back in the mouth of the lamp after the head swings.
      pivot,
      reach: pivot.distanceTo(position),
      // The modelled aim, which yaw/pitch are offsets FROM.
      position,
      direction,
      target,
      restQuaternion: head.quaternion.clone(),
      aimedYaw: null,
      aimedPitch: null,
    };
  }).filter(Boolean);
}

// Soft radial disc for the lens glare. Built as a DataTexture rather than a
// CanvasTexture on purpose — see the iOS CanvasTexture note; a generated
// texture also can't race the first paint.
function makeLensTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      // Hot core, long tail — a linear falloff reads as a flat dot.
      data[i + 3] = Math.round(255 * Math.pow(1 - d, 2.2));
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Swing one fixture to `yaw`/`pitch` degrees off its modelled aim: the beam,
// the light's position in the (now moved) aperture, and the lamp head itself.
// Called only when a knob actually changes, so the quaternion work is free
// during normal playback.
function aimFixture(fixture, yawDeg, pitchDeg, scratch, light, sprite) {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);

  // Swing about world up first, then lift about the horizontal axis square to
  // the swung aim — so pitch always reads as "raise the beam", whichever way
  // the fixture is pointing.
  scratch.yaw.setFromAxisAngle(AIM_UP, yaw);
  scratch.direction.copy(fixture.direction).applyQuaternion(scratch.yaw);
  scratch.right.copy(scratch.direction).cross(AIM_UP).normalize();
  scratch.pitch.setFromAxisAngle(scratch.right, pitch);
  scratch.delta.copy(scratch.pitch).multiply(scratch.yaw);
  scratch.direction.copy(fixture.direction).applyQuaternion(scratch.delta);

  const aperture = scratch.aperture
    .copy(fixture.pivot)
    .addScaledVector(scratch.direction, fixture.reach);
  fixture.target.position
    .copy(aperture)
    .addScaledVector(scratch.direction, AIM_THROW);
  if (light) light.position.copy(aperture);
  if (sprite) sprite.position.copy(aperture);

  // Turn the prop to match. The swing is a WORLD-space rotation and the head
  // hangs off a bracket under the bar's own Z-up conversion, so it has to be
  // conjugated into the parent's frame before it can multiply the rest pose —
  // writing it straight onto the head would rotate it about the wrong axes.
  const parent = fixture.head.parent;
  if (parent) {
    parent.getWorldQuaternion(scratch.parent);
    scratch.local
      .copy(scratch.parent)
      .invert()
      .multiply(scratch.delta)
      .multiply(scratch.parent);
    fixture.head.quaternion.copy(scratch.local).multiply(fixture.restQuaternion);
  }
}

// `onAir` is true while an episode is actually running. It comes down as a
// prop from the page's own playback state rather than being read off the set's
// playback ref: that ref and the page state are set on the same line at every
// end-of-show, but the page state is the one whose value is visible on screen
// (it is what collapses and reopens the console), so a cue that disagrees with
// it would be a cue nobody could explain.
function StudioLights({ fixtures, onAir }) {
  const lightsRef = useRef([]);
  const spritesRef = useRef([]);
  const colorsRef = useRef([]);
  // Where the rig is between `offAir` and full. Starts off air, so the first
  // episode of a visit brings the lights up rather than starting at full and
  // having nowhere to go.
  const levelRef = useRef(STUDIO_LIGHTS.offAir);
  const aimScratch = useMemo(
    () => ({
      direction: new THREE.Vector3(),
      right: new THREE.Vector3(),
      aperture: new THREE.Vector3(),
      yaw: new THREE.Quaternion(),
      pitch: new THREE.Quaternion(),
      delta: new THREE.Quaternion(),
      parent: new THREE.Quaternion(),
      local: new THREE.Quaternion(),
    }),
    [],
  );

  const lenses = useMemo(() => {
    const texture = makeLensTexture();
    const materials = fixtures.map(
      () =>
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          // Left tone-mapped-out so the lens stays hot enough to drive Bloom.
          toneMapped: false,
        }),
    );
    return { texture, materials };
  }, [fixtures]);

  useEffect(
    () => () => {
      lenses.materials.forEach((m) => m.dispose());
      lenses.texture.dispose();
    },
    [lenses],
  );

  // Push the live config every tick. Cheap (four lights), and it means the
  // console knobs work without re-rendering a component that owns the whole set.
  useFrame((state, delta) => {
    const on = STUDIO_LIGHTS.enabled;
    // Ease toward the house level for whichever way the show is. Damping on
    // delta rather than a fixed step so the fade takes the same time whatever
    // the frame rate.
    const target = onAir ? 1 : STUDIO_LIGHTS.offAir;
    levelRef.current = THREE.MathUtils.damp(
      levelRef.current,
      target,
      STUDIO_LIGHTS.fadeLambda,
      delta,
    );
    const level = levelRef.current;
    fixtures.forEach((fixture, i) => {
      const light = lightsRef.current[i];
      if (!light) return;
      const plot = STUDIO_LIGHTS.plot[i] || STUDIO_LIGHTS.plot[0];

      // Re-aim only on the frames the knobs move. The first pass always runs
      // (rest is null), which is what puts the light in the aperture.
      const yaw = plot.yaw || 0;
      const pitch = plot.pitch || 0;
      if (fixture.aimedYaw !== yaw || fixture.aimedPitch !== pitch) {
        fixture.aimedYaw = yaw;
        fixture.aimedPitch = pitch;
        aimFixture(fixture, yaw, pitch, aimScratch, light, spritesRef.current[i]);
      }

      light.intensity = on ? plot.intensity * level : 0;
      light.angle = STUDIO_LIGHTS.angle;
      light.penumbra = STUDIO_LIGHTS.penumbra;
      light.distance = STUDIO_LIGHTS.range;
      light.decay = STUDIO_LIGHTS.decay;
      // Re-parsing a colour string every frame for four lights is pointless
      // work; only pay for it when the knob actually moves.
      if (colorsRef.current[i] !== plot.color) {
        colorsRef.current[i] = plot.color;
        light.color.set(plot.color);
        lenses.materials[i]?.color.set(plot.color);
      }
      lenses.materials[i].opacity =
        on && STUDIO_LIGHTS.lens.enabled ? STUDIO_LIGHTS.lens.opacity * level : 0;
      spritesRef.current[i]?.scale.setScalar(STUDIO_LIGHTS.lens.size);

      const cone = light.children.find(
        (child) => child.isMesh && child.material?.uniforms?.attenuation,
      );
      if (!cone) return;
      cone.visible = on && STUDIO_LIGHTS.beams;
      const u = cone.material.uniforms;
      u.attenuation.value = STUDIO_LIGHTS.beamLength;
      u.anglePower.value = STUDIO_LIGHTS.anglePower;
      u.opacity.value = plot.opacity * level;
      u.lightColor.value.set(plot.color);
    });
  });

  return fixtures.map((fixture, i) => (
    <group key={fixture.name}>
      <primitive object={fixture.target} />
      <SpotLight
        ref={(node) => { lightsRef.current[i] = node; }}
        position={fixture.position}
        target={fixture.target}
        // `distance` shapes the cone MESH; the light's own falloff distance is
        // set to `range` by the sync above, so the shaft can stay short while
        // the illumination still carries to the floor.
        distance={STUDIO_LIGHTS.coneLength}
        angle={STUDIO_LIGHTS.angle}
        radiusTop={STUDIO_LIGHTS.radiusTop}
        // drei's default (`angle * 7`) is fitted to its default 5-unit cone and
        // flares wider than the light it is meant to draw. This makes the shaft
        // exactly as wide as the lit pool, at any page scale.
        radiusBottom={STUDIO_LIGHTS.coneLength * Math.tan(STUDIO_LIGHTS.angle)}
        attenuation={STUDIO_LIGHTS.beamLength}
        anglePower={STUDIO_LIGHTS.anglePower}
        // drei hard-codes castShadow before its prop spread. /trade's Canvas
        // never enabled shadowMap so it is inert either way, but four shadow
        // cameras is not something to leave switched on by accident on a page
        // that also renders the scene a second time for the monitor feed.
        castShadow={false}
      />
      {/* Always mounted — `lens.enabled` rides the material's opacity in the
          sync above, so toggling it from the console is instant. */}
      <sprite
        ref={(node) => { spritesRef.current[i] = node; }}
        position={fixture.position}
        scale={[STUDIO_LIGHTS.lens.size, STUDIO_LIGHTS.lens.size, 1]}
      >
        <primitive object={lenses.materials[i]} attach="material" />
      </sprite>
    </group>
  ));
}

// The episode's chapters as a deck for the set's frame screen. A chapter with
// no headline is dropped rather than drawn blank — the deck is what the show
// has, not a slot per segment.
function chapterCards(timeline) {
  return (timeline?.chapters || [])
    .map((chapter) => ({
      kind: "chapter",
      kicker: chapter.screen?.kicker ?? chapter.kicker ?? "",
      headline: chapter.screen?.headline ?? chapter.headline ?? "",
      lines: chapter.screen?.lines ?? [],
      note: chapter.screen?.note ?? "",
    }))
    .filter((card) => card.headline);
}

function TalkShowModel({
  episode,
  anchorY,
  projectCharacter,
  soloProjection,
  enableMonitorFeed,
  compactPortalHost,
  hideCameraRig,
  castHidden,
  newsMode,
  onAir,
  channelCards,
  onPlaybackReady,
  onPlaybackStateChange,
  onChapterChange,
}) {
  const { scene, animations } = useGLTF(MODEL_URL, DRACO_PATH);
  const raisedSet = castHidden || newsMode;
  const portalsRef = useRef({
    Monk: { frame: null, ready: false, source: null },
    Connor: { frame: null, ready: false, source: null },
  });
  const playbackRef = useRef(idlePlayback());
  // The chiron lives outside the canvas, so chapter changes leave the set
  // through a callback. Held in a ref for the same reason the timeline is: the
  // frame loop should not care that a parent re-rendered.
  const onChapterChangeRef = useRef(onChapterChange);
  onChapterChangeRef.current = onChapterChange;
  // Frame counter for solo mode's listener-repaint throttle.
  const solotickRef = useRef(0);

  // THE EPISODE, AS A PERFORMANCE. The record is data; this is the resolved
  // timeline the frame loop reads — absolute cue times, listener turns, camera
  // shots. `null` for an episode that has no recording yet, which is what the
  // START control and playShow check before offering to run anything.
  const timeline = useMemo(
    () => buildEpisodeTimeline(episode, { reactionDurations: REACTION_DURATIONS }),
    [episode],
  );
  // The SitePal portals are built once and outlive an episode change, and the
  // frame loop must never re-subscribe just because next week's show loaded —
  // so both read the live timeline through a ref rather than closing over it.
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const stopShowRef = useRef(null);
  // Set by the portal effect below: preloads every section of the mounted
  // episode into one portal. The timeline effect calls it on an episode swap.
  const preloadRef = useRef(null);

  // SWITCHING EPISODES. The portals stay up — rebuilding them costs ~18s of
  // "Loading voices…" — so changing episode takes the set off air and swaps
  // the preloaded clips underneath instead.
  useEffect(() => {
    stopShowRef.current?.();
    Object.entries(portalsRef.current).forEach(([key, portal]) => {
      if (!portal?.ready) return;
      preloadRef.current?.(key);
    });
  }, [timeline]);

  useEffect(() => {
    if (!episode) return;
    const problems = validateEpisode(episode);
    if (problems.length && process.env.NODE_ENV !== "production") {
      console.warn(
        `[LT TV] episode "${episode.id}" has problems a producer should fix:\n  ` +
          problems.join("\n  "),
      );
    }
    // Per-episode lead-in, still trimmable by ear through window.__tsTiming.
    if (timeline) TALK_SHOW_TIMING.leadIn = timeline.leadIn;
  }, [episode, timeline]);

  // Clone so toggling the tab (unmount/remount) and HMR never reuse a mutated
  // tree, and so R3F isn't handed the same cached object twice.
  const cloned = useMemo(() => {
    const c = skeletonClone(scene);
    // Hide the blank inner screen (the neon Frame border stays). LT TV's
    // lineup view lights it up as the channel screen — see useChannelScreen.
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

  // Where the overhead bar's four fixtures are and which way they point. Read
  // once per model — nothing on the bar animates.
  const lightFixtures = useMemo(() => readLightFixtures(cloned), [cloned]);

  // The tripod camera prop earns its place on desktop: its flip-out monitor
  // carries the live lens feed and the head is draggable. With the feed off it
  // is set dressing standing dead centre between the guests, blocking the neon
  // frame — so the mobile mount strikes it, and so does LT TV's lineup, where
  // the frame is carrying the channel. Toggled (not culled at clone time) so
  // flipping the prop back on doesn't need a re-clone.
  // Node names may carry GLTFLoader's collision suffix, hence the pattern.
  useEffect(() => {
    const rig = MONITOR_HIDDEN_NODES.map(
      (n) => new RegExp(`^${n}(_\\d+)?$`),
    );
    const hidden = [];
    cloned.traverse((o) => {
      if (rig.some((re) => re.test(o.name))) hidden.push(o);
    });
    hidden.forEach((o) => { o.visible = !hideCameraRig; });
    return () => { hidden.forEach((o) => { o.visible = true; }); };
  }, [cloned, hideCameraRig]);

  // Empty chairs for LT TV's lineup. Each guest's empty parents the rig, the
  // body and both faces, so hiding it takes the whole character.
  useEffect(() => {
    const guests = Object.values(EMPTY_FOR_ACTOR)
      .map((name) => cloned.getObjectByName(name))
      .filter(Boolean);
    guests.forEach((o) => { o.visible = !castHidden; });
    return () => { guests.forEach((o) => { o.visible = true; }); };
  }, [cloned, castHidden]);

  // The NewsDesk parent hides its entire prop hierarchy outside pre-show/news.
  // Desk chairs and sign supports follow the same rule. Lounge chairs
  // (seats and legs) appear only in the regular roundtable set.
  // Match Blender duplicates (.001) and GLTFLoader's sanitized names (001).
  useEffect(() => {
    const deskPropName = /^(?:NewsDesk|CoffeeCup|Microphone|Laptop|DeskChair|Cylinder|SM_Prop_(?:Cup_Coffee_Disposable_Open_01|Microphone_03|Laptop_01))(?:[._]?\d+)?$/;
    const loungeChairName = /^Chair1?_Color_[12]_0(?:_\d+)?$/;
    const props = [];
    cloned.traverse((object) => {
      if (deskPropName.test(object.name) || loungeChairName.test(object.name)) {
        props.push({ object, visible: object.visible });
        object.visible = loungeChairName.test(object.name)
          ? object.visible && !raisedSet
          : object.visible && raisedSet;
      }
    });
    return () => props.forEach(({ object, visible }) => { object.visible = visible; });
  }, [cloned, raisedSet]);

  // Pre-show backdrop: lift the screen assembly above the news desk and
  // hide only its old platform. Work in world Y because imported parents may
  // rotate/scale their local axes. Cleanup restores the authored studio pose.
  useEffect(() => {
    if (!raisedSet) return;
    const studio = cloned.getObjectByName("Studio_Set") || cloned;
    const frame = studio.getObjectByName("Frame001") || studio.getObjectByName("Frame.001");
    const neons = studio.getObjectByName("Neons001") || studio.getObjectByName("Neons.001");
    const floor = studio.getObjectByName("Floor");
    const originalFloorVisible = floor?.visible;
    const moved = [];
    if (frame && neons) {
      cloned.updateWorldMatrix(true, true);
      const height = new THREE.Box3().setFromObject(frame).getSize(new THREE.Vector3()).y;
      if (Number.isFinite(height) && height > 0) {
        const lift = new THREE.Vector3(0, (height / 3) * 1.25, 0);
        for (const object of [frame, neons]) {
          moved.push({ object, position: object.position.clone() });
          const raised = object.getWorldPosition(new THREE.Vector3()).add(lift);
          object.position.copy(object.parent ? object.parent.worldToLocal(raised) : raised);
          object.updateWorldMatrix(false, true);
        }
      }
    }
    if (floor) floor.visible = false;
    return () => {
      for (const { object, position } of moved) {
        object.position.copy(position);
        object.updateWorldMatrix(false, true);
      }
      if (floor) floor.visible = originalFloorVisible;
    };
  }, [cloned, raisedSet]);

  // Screenshot transforms use Blender Z-up and quaternion WXYZ. Convert to
  // glTF Y-up: position (x,z,-y), quaternion (x,z,-y,w). Actor empties are
  // unparented in the export; their local coordinates are the model's basis.
  useEffect(() => {
    if (!newsMode) return;
    const poses = {
      Demon_Empty: { position: [-0.44472, 0.42248, 0.018999], quaternion: [0, 0.255, 0, 0.967], scale: 1.125 },
      Monk_Empty: { position: [0.53267, 0.39882, -0.049794], quaternion: [0, -0.030, 0, 1.000], scale: 1.081 },
    };
    const originals = [];
    for (const [name, pose] of Object.entries(poses)) {
      const actor = cloned.getObjectByName(name);
      if (!actor) continue;
      originals.push({ actor, position: actor.position.clone(), quaternion: actor.quaternion.clone(), scale: actor.scale.clone() });
      actor.position.fromArray(pose.position);
      actor.quaternion.fromArray(pose.quaternion).normalize();
      actor.scale.setScalar(pose.scale);
      actor.updateWorldMatrix(false, true);
    }
    return () => originals.forEach(({ actor, position, quaternion, scale }) => {
      actor.position.copy(position);
      actor.quaternion.copy(quaternion);
      actor.scale.copy(scale);
      actor.updateWorldMatrix(false, true);
    });
  }, [cloned, newsMode]);

  // These props share atlas materials in the GLB. Clone per mesh so the
  // lounge treatment never alters the actors or the cached source asset.
  useEffect(() => {
    const adjusted = [];
    cloned.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const chair = /^Chair1?_Color_1_0$/.test(mesh.name);
      const palm = /^Palm_Leaf/.test(mesh.name);
      const floor = /^Floor/.test(mesh.name);
      const frame = mesh.name === "Frame_Color_1_0";
      if (!chair && !palm && !floor && !frame) return;
      const original = mesh.material;
      const copies = (Array.isArray(original) ? original : [original]).map((material) => {
        const copy = material.clone();
        copy.color?.multiplyScalar(floor ? 0.65 : palm ? 0.72 : frame ? 0.8 : 0.9);
        if ("roughness" in copy) copy.roughness = Math.max(copy.roughness, chair ? 0.55 : 0.8);
        return copy;
      });
      mesh.material = Array.isArray(original) ? copies : copies[0];
      adjusted.push({ mesh, original, copies });
    });
    return () => adjusted.forEach(({ mesh, original, copies }) => {
      mesh.material = original;
      copies.forEach((material) => material.dispose());
    });
  }, [cloned]);

  // THE FRAME'S SCREEN. On the lineup it is the channel display, cycling a
  // card per show. On the news set it is the studio screen, and it carries the
  // episode's own chapters — so it follows the show rather than sitting on the
  // channel card for six minutes. `castHidden` is the lineup (empty chairs),
  // which keeps the channel deck.
  const episodeDeck = useMemo(() => chapterCards(timeline), [timeline]);
  const chapterIndexRef = useRef(0);
  const onSet = !castHidden && episodeDeck.length > 0;
  useChannelScreen(cloned, onSet ? episodeDeck : channelCards, {
    indexRef: onSet ? chapterIndexRef : null,
  });

  // Camera-monitor feed. Built on the first frame (it needs the viewer camera)
  // and torn down with the model it was built against; `undefined` means "not
  // built yet", `null` means the prop wasn't in the GLB.
  const monitorRef = useRef(undefined);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__tsMonitor = MONITOR_FEED;
      window.__tsTiming = TALK_SHOW_TIMING;
      window.__tsLights = STUDIO_LIGHTS;
    }
    return () => {
      const feed = monitorRef.current;
      monitorRef.current = undefined;
      if (!feed) return;
      feed.target.dispose();
      feed.material.dispose();
      feed.geometry.dispose();
    };
  }, [cloned]);

  // Operator control. Listeners live on the DOM rather than on the R3F
  // primitive: attaching pointer handlers to the set would make every mouse
  // move raycast two skinned characters, and this only ever needs to hit the
  // four prop meshes. They run in the CAPTURE phase on window so a grab is
  // swallowed before CameraControlsRig's own listener sees it — otherwise the
  // same drag would orbit the viewer camera at the same time.
  const { gl: renderer, camera: viewerCamera } = useThree();
  useEffect(() => {
    const el = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovering = false;

    const liveFeed = () => {
      const feed = monitorRef.current;
      if (!feed?.pivot || !MONITOR_FEED.enabled || !MONITOR_FEED.mouseControl) {
        return null;
      }
      return feed;
    };

    const hitsProp = (event, feed) => {
      const rect = el.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, viewerCamera);
      return raycaster.intersectObjects(feed.hidden, true).length > 0;
    };

    const onPointerDown = (event) => {
      // Only a plain left-press that landed on the canvas itself — otherwise a
      // press on the rail or the dock could be stolen by a prop behind it.
      if (event.button !== 0 || event.target !== el) return;
      const feed = liveFeed();
      if (!feed || !hitsProp(event, feed)) return;
      event.stopPropagation();
      feed.dragging = true;
      feed.releasedAt = 0;
      feed.manualFov = feed.manualFov ?? feed.fov;
      feed.lastX = event.clientX;
      feed.lastY = event.clientY;
      el.style.cursor = "grabbing";
    };

    const onPointerMove = (event) => {
      const feed = liveFeed();
      if (!feed) return;
      if (feed.dragging) {
        event.stopPropagation();
        const sign = MONITOR_FEED.dragInvert ? -1 : 1;
        const step = MONITOR_FEED.dragSensitivity * sign;
        feed.yaw += (event.clientX - feed.lastX) * step;
        feed.pitch = THREE.MathUtils.clamp(
          feed.pitch + (event.clientY - feed.lastY) * step,
          -MONITOR_FEED.maxPitch,
          MONITOR_FEED.maxPitch,
        );
        feed.lastX = event.clientX;
        feed.lastY = event.clientY;
        return;
      }
      const over = event.target === el && hitsProp(event, feed);
      if (over !== hovering) {
        hovering = over;
        el.style.cursor = over ? "grab" : "";
      }
    };

    const onPointerUp = () => {
      const feed = monitorRef.current;
      if (!feed?.dragging) return;
      feed.dragging = false;
      feed.releasedAt = performance.now();
      el.style.cursor = hovering ? "grab" : "";
    };

    const onWheel = (event) => {
      if (event.target !== el) return;
      const feed = liveFeed();
      if (!feed || !hitsProp(event, feed)) return;
      // Zoom the lens, not the room.
      event.stopPropagation();
      event.preventDefault();
      feed.manualFov = THREE.MathUtils.clamp(
        (feed.manualFov ?? feed.fov) + event.deltaY * MONITOR_FEED.wheelSensitivity,
        MONITOR_FEED.minFov,
        MONITOR_FEED.maxFov,
      );
      feed.releasedAt = performance.now();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      window.removeEventListener("wheel", onWheel, { capture: true });
      el.style.cursor = "";
    };
  }, [renderer, viewerCamera]);

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
  // for these rigs. Connor's intro blends toward it to address the camera
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

  // Keep animation output separate from procedural gaze. PropertyMixer skips
  // unchanged values, so leaving the previous gaze on the bone can accumulate it.
  const animatedHeadQuaternions = useMemo(
    () => Object.fromEntries(Object.entries(headBones).map(([actor, head]) => [actor, head.quaternion.clone()])),
    [headBones],
  );
  const listenerGazeRef = useRef({ Connor: 0, Monk: 0 });
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
      playbackRef.current = idlePlayback();
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
      // ONSCREEN at left:0 — NOT off at -10000px, which is what this was and
      // what broke iPad. WebKit throttles a subframe outside the viewport to
      // ~0.1fps, so SitePal kept playing audio while its canvas sat on its
      // last painted frame: face visible, lips still. Chrome is lenient
      // enough that desktop never showed it. Same rule (and the same
      // opacity 0.01 + pointerEvents:none + zIndex:-1 cloak) as the temple's
      // shared host in app/trade/page.js — it sits BEHIND the 3D canvas, so
      // being onscreen costs nothing visually.
      position: "fixed",
      left: "0",
      top: "0",
      // Wide enough for BOTH portals side by side. They used to stack
      // vertically inside a 600×800 box with overflow:hidden, which clipped
      // the second one out of the layout — the same "not really onscreen"
      // hazard by a different route. `display:flex` keeps them in a row.
      display: "flex",
      width: "1200px",
      height: "800px",
      overflow: "hidden",
      opacity: "0.01",
      pointerEvents: "none",
      zIndex: "-1",
    });
    // PHONES: 1200px of portals does not fit beside a 390px viewport, and the
    // SECOND one lands entirely outside it — which is the exact off-screen
    // subframe WebKit throttles to ~0.1fps (audio keeps playing, face freezes).
    // Scale the host down so both stay within the visual viewport. The iframes
    // still paint at their native 600×800, so the crop source keeps full res —
    // only the (invisible, opacity 0.01) presentation shrinks.
    if (compactPortalHost) {
      const fit = Math.min(
        1,
        (window.innerWidth || 1200) / 1200,
        (window.innerHeight || 800) / 800,
      );
      host.style.transformOrigin = "0 0";
      host.style.transform = `scale(${fit})`;
    }
    document.body.appendChild(host);

    let stopped = false;
    const ended = new Set();
    const started = new Map();
    const finished = new Map();
    const audioStarted = new Map();
    let issuedAt = 0;
    // The arm/release handshake. `phase` is "idle" until a section is being
    // loaded, "arming" while its clips are in flight, "playing" once both have
    // been told to speak — and the talk callbacks only count in "playing", so
    // the muted load cannot be mistaken for the performance.
    const armed = new Set();
    let phase = "idle";
    let arming = null;
    let armTimer = 0;
    let armedExpected = 0;
    let releaseArmed = null;
    const armingClips = new Map();
    // Which arming this is. Pressing play twice would otherwise let a stale
    // release fire with the previous attempt's clips, because two attempts at
    // the same section share an index but not a set of buffers.
    let armGen = 0;

    /**
     * HOW FAR APART THE TWO PORTALS REALLY START, measured rather than assumed.
     *
     * Both are told to play a section in the same tick, and the code below has
     * always assumed the second is "milliseconds behind". Nobody had measured
     * it. Michelle reported on 2026-09-21 that about one exchange in ten
     * overlaps on the set while the master WAV is clean, which is what a
     * constant skew of a few hundred ms looks like once per-line rendering
     * lays lines out 0.45s apart instead of the second the old dialogue
     * breathed: every other junction loses the skew and the tightest ones
     * close up.
     *
     * It records the skew AND how long each portal took to answer, because
     * those answer different questions. Michelle played the same episode twice
     * on 2026-09-21 and the second play had no overlap at all, which says the
     * skew is not a fixed offset to subtract but the difference between two
     * cold fetches. If that is right, the per-portal times are large and
     * unequal on a first play and small on a second, and a fix has to be about
     * having the audio in hand before either portal is told to speak. The
     * numbers say whether that story is true.
     *
     * This only WATCHES. It changes no timing, because the last thing this
     * problem needs is another confident untested fix. Everything lands in the
     * console and in `window.__tsSkew` so there is something real to design
     * against.
     */
    const recordStart = (key) => {
      if (started.has(key)) return;
      started.set(key, performance.now());
      if (started.size !== Object.keys(portalsRef.current).length) return;
      const times = [...started.values()];
      const ms = Math.round(Math.max(...times) - Math.min(...times));
      window.__tsSkew = window.__tsSkew || [];

      // The portal-ready preload calls loadAudio, which SitePal answers with a
      // talk-started of its own — before anything has been told to play, so
      // `issuedAt` is still zero and `took` would be the raw page clock. It
      // read as a section-one reading of 35797ms on 2026-09-21 and cost a
      // round explaining itself. It is worth keeping (it says how far apart
      // the two portals become ready) but not worth disguising as playback.
      if (!issuedAt) {
        window.__tsSkew.push({ phase: "preload", ms });
        console.info(`[TalkShowScene] the two portals finished preloading ${ms}ms apart`);
        return;
      }

      const section = (playbackRef.current.section ?? 0) + 1;
      // How long each portal took from being told to play to actually
      // speaking. A cold fetch shows up here and nowhere else.
      const took = {};
      for (const [who, at] of started) took[who] = Math.round(at - issuedAt);
      window.__tsSkew.push({ section, ms, took });
      console.info(
        `[TalkShowScene] section ${section}: the two portals started ${ms}ms apart ` +
          `(${Object.entries(took).map(([w, t]) => `${w} ${t}ms`).join(", ")} ` +
          "from being told to play; window.__tsSkew holds every reading)",
      );
    };

    /**
     * HOW LONG EACH PORTAL ACTUALLY PLAYED, which is the number that was
     * missing.
     *
     * `recordStart` measured the two portals as 0-2ms apart on every section
     * join, and that reading cannot be taken at face value: 1-2ms is far too
     * quick to contain the fetch of a 60-second clip, so `vh_talkStarted`
     * is almost certainly SitePal acknowledging the command rather than
     * announcing the first sample. The gap it measures is therefore the gap
     * between two messages, not between two voices.
     *
     * Talk-ENDED does not have that problem. Both characters' clips for a
     * section are cut from the same two byte offsets, so they are identical
     * in length by construction — checked in `lt-tv-split.mjs`, which slices
     * both actors with the same section bounds. Two clips of equal length
     * that are commanded together can only END apart if one of them STARTED
     * apart. So `played` (end minus start, per portal) measures the real
     * onset skew through a signal that cannot be faked by an early ack.
     *
     * Michelle confirmed on 2026-09-21 that the master WAV has no overlap at
     * all while the set does, which leaves the two players as the only thing
     * that differs between them. This says whether they drift, and by how
     * much. It still only WATCHES: no timing anywhere is changed by it.
     */
    const recordEnd = (key) => {
      if (finished.has(key)) return;
      finished.set(key, performance.now());
      const count = Object.keys(portalsRef.current).length;
      if (finished.size !== count || started.size !== count) return;
      // A preload reports talk-started too, and may report an end. Same guard as
      // recordStart: nothing has been told to play, so there is no playback
      // to time and `played` would be measured from the wrong instant.
      if (!issuedAt) return;
      const times = [...finished.values()];
      const ms = Math.round(Math.max(...times) - Math.min(...times));
      const section = (playbackRef.current.section ?? 0) + 1;
      const played = {};
      for (const [who, at] of finished) played[who] = Math.round(at - (started.get(who) ?? at));
      const spread = Math.max(...Object.values(played)) - Math.min(...Object.values(played));
      window.__tsPlayed = window.__tsPlayed || [];
      window.__tsPlayed.push({ section, ms, played, spread });
      console.info(
        `[TalkShowScene] section ${section}: the two portals ended ${ms}ms apart ` +
          `(played ${Object.entries(played).map(([w, t]) => `${w} ${t}ms`).join(", ")}, ` +
          `a spread of ${spread}ms — identical clips, so this is the real start skew; ` +
          "window.__tsPlayed holds every reading)",
      );
    };

    // Put both actors back on their idle loop, dropping any reaction that was
    // mid-gesture. Split out of resetPerformance because a SEEK needs exactly
    // this and must NOT have the rest of it: the show is still running, and
    // resetting the playback state would take it off air.
    const resetReactions = () => {
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

    const resetPerformance = () => {
      playbackRef.current = idlePlayback();
      resetReactions();
    };

    const timers = {};

    const portalSrc = (key, portal) => {
      const cfg = TALKSHOW_PROJECTION_CONFIG[key];
      portal.loads += 1;
      // `n` only exists to guarantee a fresh document on a retry — assigning an
      // identical src is not reliably a reload.
      return (
        `/sitepal-portal.html?acc=${SITEPAL_ACCOUNT}` +
        `&scene=${cfg.sceneId}` +
        `&embed=${encodeURIComponent(cfg.hash || "")}` +
        `&n=${portal.loads}`
      );
    };

    const notifyReady = () => {
      const portals = Object.values(portalsRef.current);
      const ready = portals.every((p) => p.ready);
      const failed = portals.some((p) => !p.ready && p.exhausted);
      onPlaybackReady?.(ready, ready ? "ready" : failed ? "failed" : "loading");
    };

    // One watchdog per portal, re-armed (longer each time) on every attempt.
    const armWatchdog = (key) => {
      clearTimeout(timers[key]);
      const attempt = portalsRef.current[key]?.attempt || 0;
      const wait =
        PORTAL_READY_TIMEOUT_MS * Math.pow(PORTAL_RETRY_BACKOFF, attempt);
      timers[key] = setTimeout(() => {
        const portal = portalsRef.current[key];
        if (!portal?.frame || portal.ready) return;
        if (portal.attempt >= PORTAL_MAX_ATTEMPTS) {
          portal.exhausted = true;
          console.warn(
            `[TalkShowScene] ${key} portal never reported ready after ` +
              `${PORTAL_MAX_ATTEMPTS} attempts — surfacing as failed`,
          );
          notifyReady();
          return;
        }
        portal.attempt += 1;
        portal.source = null;
        console.warn(
          `[TalkShowScene] ${key} portal did not load in ${Math.round(wait)}ms ` +
            `— reloading (attempt ${portal.attempt}/${PORTAL_MAX_ATTEMPTS})`,
        );
        portal.frame.src = portalSrc(key, portal);
        armWatchdog(key);
      }, wait);
    };

    // Manual escape hatch behind the START control once retries are spent.
    const retryPortals = () => {
      Object.entries(portalsRef.current).forEach(([key, portal]) => {
        if (!portal?.frame || portal.ready) return;
        portal.attempt = 0;
        portal.exhausted = false;
        portal.source = null;
        portal.frame.src = portalSrc(key, portal);
        armWatchdog(key);
      });
      notifyReady();
    };

    const portalForSource = (source) =>
      Object.entries(portalsRef.current).find(([, p]) => p.frame?.contentWindow === source);

    /**
     * PRELOAD EVERY SECTION, ONE CLIP AT A TIME, FROM THE MOMENT A PORTAL IS
     * READY.
     *
     * Only section one was ever preloaded here, and the one playthrough taken
     * with the browser cache on (2026-09-21 05:07) showed exactly that:
     * section one started 25ms apart with no overlap, and the first overlap
     * was line 22, the first line of section two, whose clips nobody had
     * asked for until the join. `loadAudio` is documented (docs/sitepal.md,
     * Speech Functions) as a preload that shortens the later `sayAudio`, and
     * calling it again for a loaded clip "has no effect", so the arm/release
     * in startSection keeps working on top of this: a clip that is already in
     * reports loaded at once and the section releases without a hold.
     *
     * Sequential, not parallel, so section one's clip is never slowed by the
     * three behind it. Paused while a section is arming or playing — nothing
     * is loaded into a portal that is speaking, because whether `loadAudio`
     * interrupts speech under interruptMode 1 has not been tested — and it
     * picks up again when the set goes idle, so a replay finds the rest warm.
     * Every readiness callback is optional, so a step that never reports
     * moves on after a timeout rather than stalling the chain.
     *
     * Note that DevTools' "Disable cache" defeats all of this by design: the
     * player fetches the clip again on `sayAudio` and the two portals race.
     * A play with that ticked says nothing about the set.
     */
    const PRELOAD_STEP_TIMEOUT_MS = 15000;
    const preloads = {};
    const preloadNext = (key) => {
      const q = preloads[key];
      if (!q) return;
      clearTimeout(q.timer);
      q.timer = 0;
      if (phase !== "idle") return; // resumes from the next idle audio-loaded
      const clip = q.clips[q.at];
      if (!clip) return;
      q.at += 1;
      q.inFlight = clip;
      try {
        portalsRef.current[key]?.frame?.contentWindow?.loadAudio?.(clip);
      } catch (e) {
        console.warn(`[TalkShowScene] could not preload ${key} audio`, e);
      }
      q.timer = setTimeout(() => preloadNext(key), PRELOAD_STEP_TIMEOUT_MS);
    };
    const preloadEpisode = (key) => {
      const sections = timelineRef.current?.sections || [];
      const clips = sections.map((s) => s.audio?.[key]).filter(Boolean);
      clearTimeout(preloads[key]?.timer);
      preloads[key] = { clips, at: 0, inFlight: null, timer: 0 };
      preloadNext(key);
    };
    const resumePreloads = () => {
      Object.keys(preloads).forEach((key) => {
        if (!preloads[key].timer && !preloads[key].inFlight) preloadNext(key);
      });
    };
    preloadRef.current = preloadEpisode;

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const match = portalForSource(event.source);
      if (!match) return;
      const [key, portal] = match;

      if (event.data?.type === "sitepal-portal-ready") {
        portal.ready = true;
        portal.exhausted = false;
        portal.source = null;
        // A scene that has just loaded is in a fresh document, whatever this
        // portal was doing before the reload.
        portal.frozen = false;
        clearTimeout(timers[key]);
        try {
          portal.frame.contentWindow.setPlayerVolume?.(0);
        } catch (e) {
          console.warn(`[TalkShowScene] could not silence ${key} portal`, e);
        }
        preloadEpisode(key);
        notifyReady();
      }

      if (event.data?.type === "sitepal-portal-audio-loaded") {
        // `vh_audioLoaded` (docs/sitepal.md, Status Callback Functions): a
        // preload is done. `name` is the clip for a `loadAudio`, and empty
        // when `sayAudio` loaded it itself.
        const name = event.data.name || "";
        const q = preloads[key];
        if (q && q.inFlight && (!name || name === q.inFlight)) {
          q.inFlight = null;
          if (phase === "idle") preloadNext(key);
        }
        if (phase !== "arming") return;
        // Only the clip this section asked for counts. A step of the preload
        // chain landing mid-arm would otherwise release the section on a
        // different section's audio.
        const wanted = armingClips.get(key);
        if (name && wanted && name !== wanted) return;
        armed.add(key);
        if (armed.size >= armedExpected) releaseArmed?.("both clips landed");
        return;
      }

      if (event.data?.type === "sitepal-portal-audio-started") {
        // `vh_audioStarted` (docs/sitepal.md): "triggered when audio playback
        // begins", per audio. Unlike talk-started it does not fire for a
        // `loadAudio`, so the gap between the two portals' audio-started is
        // how far apart the voices actually began. Measured only; it changes
        // no timing. `window.__tsStart` holds every reading.
        if (phase !== "playing" || audioStarted.has(key)) return;
        audioStarted.set(key, performance.now());
        if (audioStarted.size !== Object.keys(portalsRef.current).length) return;
        const times = [...audioStarted.values()];
        const ms = Math.round(Math.max(...times) - Math.min(...times));
        const section = (playbackRef.current.section ?? 0) + 1;
        const late = [...audioStarted.entries()].sort((a, b) => b[1] - a[1])[0][0];
        window.__tsStart = window.__tsStart || [];
        window.__tsStart.push({ section, ms, late });
        console.info(
          `[TalkShowScene] section ${section}: the voices began ${ms}ms apart ` +
            `(${late} second; window.__tsStart holds every reading)`,
        );
        // A pause pressed while this section's clips were still loading. Both
        // voices are now genuinely playing, which is the first moment there is
        // anything to freeze.
        if (pausePending) applyPause();
        return;
      }

      if (event.data?.type === "sitepal-portal-talk-started") {
        // The muted load speaks too, so only a started that belongs to the
        // performance counts. Everything below this line assumes playback.
        if (phase !== "playing") return;
        // Measured before anything returns: the re-stamp below acts on the
        // FIRST portal to report and swallows the second, so the skew has to
        // be taken here or it is never seen.
        recordStart(key);

        // Only sections past the first re-stamp, and only on the first portal
        // to report — the two are told to start in the same tick, so the
        // second follows close behind and would only add jitter.
        const playback = playbackRef.current;
        if (!playback.running || playback.holdingAt === null) return;
        const sections = timelineRef.current?.sections || [];
        const startsAt = sections[playback.section]?.startsAt ?? playback.holdingAt;
        playback.startedAt =
          performance.now() -
          (startsAt + TALK_SHOW_TIMING.leadIn + TALK_SHOW_TIMING.sectionLeadIn) * 1000;
        playback.holdingAt = null;
        playback.heldSince = 0;
      }

      if (event.data?.type === "sitepal-portal-talk-ended") {
        // A portal this phase never saw start cannot have finished: that is a
        // leftover from the muted load, and counting it would advance the
        // episode a section early.
        if (!started.has(key)) return;
        // A section that runs out WHILE THE SET IS PAUSED is counted but not
        // acted on: the join happens on the resume instead. freezeToggle is
        // documented to hold speech, so this should not arrive — but if a
        // player ever lets the audio run on under a freeze, dropping the end
        // outright would leave the episode stuck at that section forever, and
        // the viewer with no way out but Stop.
        if (phase === "paused") {
          ended.add(key);
          return;
        }
        if (phase !== "playing") return;
        ended.add(key);
        // Before the early return below, for the same reason recordStart sits
        // at the top of talk-started: the second portal to report is the one
        // that carries the skew, and everything after this line discards it.
        recordEnd(key);
        if (ended.size !== Object.keys(portalsRef.current).length) return;
        finishSection();
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
      // Don't let a narrow viewport shrink either portal to nothing — the
      // canvas we sample every frame is the one this iframe paints.
      frame.style.flex = "0 0 600px";
      const portal = {
        frame,
        ready: false,
        source: null,
        attempt: 0,
        exhausted: false,
        loads: 0,
        // Whether this portal is currently frozen for a pause. See setFrozen.
        frozen: false,
      };
      portalsRef.current[key] = portal;
      frame.src = portalSrc(key, portal);
      host.appendChild(frame);
      armWatchdog(key);
    });

    const stopShow = () => {
      stopped = true;
      // A stop while the set is paused has to leave the players ready to
      // speak: a frozen character stays frozen through the next sayAudio, so
      // the following episode would come up as two silent faces.
      clearTimeout(pausePendingTimer);
      pausePending = false;
      setFrozen(false);
      Object.values(portalsRef.current).forEach((portal) => {
        try {
          portal.frame?.contentWindow?.stopSpeech?.();
          portal.frame?.contentWindow?.setPlayerVolume?.(0);
        } catch (e) {}
      });
      clearTimeout(armTimer);
      arming = null;
      armed.clear();
      phase = "idle";
      ended.clear();
      started.clear();
      finished.clear();
      resetPerformance();
      onPlaybackStateChange?.(false);
      resumePreloads();
    };

    /**
     * ARM A SECTION: load both clips, and DO NOT SPEAK UNTIL BOTH HAVE LANDED.
     *
     * This used to say that telling both portals at once was all the
     * synchronising there is, because the two tracks are one timeline twice
     * over. The tracks are — the playback was not. Measured on 2026-09-21:
     * the two portals began a section 662ms apart, which is most of the 750ms
     * gap between lines, so Connor's tail landed on top of the Monk's next
     * line about one exchange in ten. Every file in the pipeline was correct.
     *
     * The cause is that `loadAudio` was called and then `sayAudio` in the very
     * next statement, which asks a clip to play whether or not it has arrived.
     * A cold clip is not quick: on Michelle's machine an 88-second WAV took
     * 6939ms to load. Whichever portal was still fetching started late by
     * however long it had left.
     *
     * So a section is now armed and then released. `vh_audioLoaded` — which is
     * documented in docs/sitepal.md, though it was found on 2026-09-21 by
     * wiring up guessed callback names until one fired — says when a clip is
     * genuinely ready. Both portals load muted, both report, and only then
     * does either speak.
     *
     * Returns how many portals took the load, so the callers that check for
     * "none of them would start" keep working unchanged.
     */
    const startSection = (index) => {
      const active = timelineRef.current;
      const section = active?.sections?.[index];
      if (!section) return 0;

      clearTimeout(armTimer);
      armed.clear();
      armingClips.clear();
      // Nothing loads or speaks into a frozen player. Anything that starts a
      // section — play, a join, a seek, the fallback resume — comes through
      // here, so this one line is where the freeze can never be left on.
      setFrozen(false);
      phase = "arming";
      arming = index;
      const gen = ++armGen;
      // Any preload step still in flight is abandoned to the arm, which loads
      // what it needs itself; the chain resumes when the set is idle again.
      Object.values(preloads).forEach((q) => {
        clearTimeout(q.timer);
        q.timer = 0;
        if (q.inFlight) {
          q.at -= 1;
          q.inFlight = null;
        }
      });

      const clips = new Map();
      Object.entries(portalsRef.current).forEach(([key, portal]) => {
        const clip = section.audio?.[key];
        if (!clip) {
          console.warn(
            `[TalkShowScene] episode "${active.id}" section ${index + 1} has no ${key} clip`,
          );
          return;
        }
        try {
          const w = portal.frame.contentWindow;
          // EVERYTHING THAT DISTURBS THE PLAYER HAPPENS BEFORE THE LOAD, and
          // the order here is load-bearing. The original sequence was
          // stopSpeech, saySilent, setPlayerVolume, loadAudio, sayAudio, all
          // in one breath. Splitting it left `saySilent(0)` sitting between
          // the load and the speak, and that threw the loaded clip away:
          // measured 2026-09-21, the portals took 3159ms and 6732ms to start
          // talking AFTER both had reported their audio was in, which is a
          // fresh fetch rather than a warm start. Nothing may come between
          // loadAudio and sayAudio except the unmute.
          w.stopSpeech?.();
          w.saySilent?.(0);
          // Muted while it loads: `loadAudio` raises talk-started, which is why the portals
          // are silenced before they are preloaded anywhere else in this file.
          w.setPlayerVolume?.(0);
          w.loadAudio?.(clip);
          clips.set(key, clip);
          armingClips.set(key, clip);
        } catch (e) {
          console.warn(`[TalkShowScene] could not load ${key} audio`, e);
        }
      });

      if (clips.size === 0) {
        phase = "idle";
        arming = null;
        resumePreloads();
        return 0;
      }

      const armedAt = performance.now();

      /** Both clips are in (or we have waited long enough). Speak, together. */
      const release = (why) => {
        if (armGen !== gen || arming === null) return;
        clearTimeout(armTimer);
        arming = null;
        ended.clear();
        started.clear();
        finished.clear();
        audioStarted.clear();
        // Set before the calls below, so a talk-started that follows one of
        // them is recorded rather than dropped. A stray event left over from
        // the muted load cannot be mistaken for playback: `ended` only counts
        // a portal that this phase already saw start.
        phase = "playing";
        issuedAt = performance.now();
        for (const [key, clip] of clips) {
          try {
            const w = portalsRef.current[key]?.frame?.contentWindow;
            // Unmute and speak. NOTHING ELSE BELONGS HERE — see the note in
            // the arming loop above about what an extra call costs.
            w?.setPlayerVolume?.(7);
            w?.sayAudio?.(clip);
          } catch (e) {
            console.warn(`[TalkShowScene] could not start ${key} audio`, e);
          }
        }
        // SECTION ONE'S CLOCK MOVES TO HERE, and it has to.
        //
        // `playShow` stamps it at the instant the button is pressed, because
        // until now that was also the instant the audio was asked for. Arming
        // breaks that: the clips may take seconds to land, and a picture
        // stamped at press time would run that far ahead of the voices — the
        // same desync from the other direction. Later sections already
        // re-stamp on talk-started and are unaffected.
        const playback = playbackRef.current;
        if (index === 0 && playback.running && playback.holdingAt === null) {
          playback.startedAt = performance.now();
        }
        // WHAT THE ARMING ACTUALLY DID, in one readable place.
        //
        // Whether a section waited for its clips or gave up and started
        // anyway has so far had to be inferred from how far apart the voices
        // came out, which is the reasoning that has been wrong all night.
        // `window.__tsArm` says it outright: which portals reported in, how
        // long it took, and whether the release was the clips landing or the
        // failsafe running out.
        const armMs = Math.round(performance.now() - armedAt);
        window.__tsArm = window.__tsArm || [];
        window.__tsArm.push({
          section: index + 1,
          why,
          ms: armMs,
          reported: [...armed],
          expected: clips.size,
        });
        console.info(
          `[TalkShowScene] section ${index + 1} released after ${why} ` +
            `(${armMs}ms arming, ${armed.size} of ${clips.size} reported; ` +
            "window.__tsArm holds every reading)",
        );
      };

      releaseArmed = release;
      armedExpected = clips.size;
      // Never let a missing callback freeze the show. Generous, because a cold
      // clip legitimately takes seconds — this is a backstop, not a schedule.
      armTimer = setTimeout(() => {
        console.warn(
          `[TalkShowScene] section ${index + 1}: only ${armed.size} of ` +
            `${clips.size} clips reported loaded in ${ARM_FAILSAFE_MS}ms — ` +
            "starting anyway rather than stalling",
        );
        release("the failsafe");
      }, ARM_FAILSAFE_MS);

      return clips.size;
    };

    const playShow = () => {
      // Whatever episode is mounted right now — the portals outlive any one
      // of them, so this is read at press time, not captured when they built.
      const active = timelineRef.current;
      if (!active) return false;
      if (stopped) stopped = false;
      if (!Object.values(portalsRef.current).every((p) => p.ready)) return false;
      ended.clear();
      started.clear();
      finished.clear();

      clearTimeout(pausePendingTimer);
      pausePending = false;
      const ok = startSection(0) === Object.keys(portalsRef.current).length;
      if (ok) {
        resetPerformance();
        playbackRef.current = {
          ...idlePlayback(),
          running: true,
          // Section one keeps the clock it has always had, stamped here and
          // trimmed by `leadIn`, because `leadIn` was tuned against exactly
          // this. Later sections re-stamp on SitePal's talk-started instead.
          startedAt: performance.now(),
        };
      }
      onPlaybackStateChange?.(ok);
      return ok;
    };

    /**
     * BOTH TRACKS HAVE RUN OUT. On a sectioned episode that is a join, not the
     * end: the next clip goes in and the picture holds where the cut was until
     * it is actually heard to start. Called from talk-ended, and from a resume
     * that finds the section ended while the set was paused.
     */
    const finishSection = () => {
      const playback = playbackRef.current;
      const sections = timelineRef.current?.sections || [];
      const next = playback.section + 1;
      if (playback.running && sections[next]) {
        ended.clear();
        started.clear();
        finished.clear();
        audioStarted.clear();
        playback.section = next;
        playback.holdingAt = sections[next].startsAt;
        playback.heldSince = performance.now();
        if (startSection(next) === 0) {
          console.warn(`[TalkShowScene] section ${next + 1} would not start`);
          phase = "idle";
          resetPerformance();
          onPlaybackStateChange?.(false);
          resumePreloads();
        }
        return;
      }

      phase = "idle";
      resetPerformance();
      onPlaybackStateChange?.(false);
      resumePreloads();
    };

    /* ── PAUSE, RESUME AND SKIPPING ───────────────────────────────────────
     *
     * WHAT THE PLAYER GIVES US, from docs/sitepal.md rather than from guessing
     * (the night of 2026-09-21 was spent guessing at callback names that were
     * documented in that file all along):
     *
     *   freezeToggle()  "If the character is speaking, speech is paused... If
     *                   the character was previously paused in mid-speech,
     *                   speech resumes from that point."  An exact pause, to
     *                   the sample, and the only one there is.
     *   sayAudio(clip)  starts a clip AT THE BEGINNING. There is no argument
     *                   for a position and no function that sets one.
     *
     * So pausing is exact and seeking is not possible inside a clip — not with
     * more effort, not at all. What IS possible: an episode over 90 seconds is
     * already several clips, because SitePal refuses one longer than that, and
     * starting a clip is what the set does at every section join anyway. The
     * section boundaries are therefore free, real seek points, about a minute
     * and a half apart, and skipping runs through the same arm/release path a
     * join already uses rather than a second one written for seeking.
     *
     * THE PICTURE HAS TO MOVE WITH THE VOICES. Every camera cut, head turn and
     * reaction hangs off `startedAt` through `performance.now()`, which does
     * not stop for a pause and knows nothing about a jump. A pause therefore
     * freezes the clock by reading `pausedAt` in its place, and the resume
     * adds the whole paused interval back on; a jump re-seats the clock, the
     * cue index and the reactions together, then holds the picture on the cut
     * until SitePal is heard to start — the same hold the joins use.
     *
     * AND IT MUST NOT COST THE OVERLAP FIX. The two avatars start together
     * because a section arms both clips and releases them in one tick (PRs #19
     * and #20). Nothing here touches that sequence: a jump calls the same
     * `startSection`, and a pause freezes two players that are already in step
     * and lets them both go in the same tick. `window.__tsPlayed` still
     * measures the result at the end of every section, so a pause that pulled
     * them apart would show up there as a spread — see `recordEnd`.
     */

    // freezeToggle() takes no argument and reports no state, so each portal's
    // frozen state is tracked on the portal itself (`portal.frozen`) and only
    // toggled when it is genuinely changing. Per portal rather than for the
    // pair because a portal that reloads comes back in a FRESH document, which
    // is never frozen — a single flag for both would then be wrong about one
    // of them, and the next toggle would freeze the one that just came back.
    // A pause pressed while a section's clips are still loading. There is
    // nothing to freeze yet, so it is held and applied the moment the audio is
    // heard to start.
    let pausePending = false;
    let pausePendingTimer = 0;

    const portalWindows = () =>
      Object.values(portalsRef.current)
        .map((portal) => {
          try {
            return portal?.frame?.contentWindow || null;
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

    // Whether this player build actually has the freeze. It is documented, but
    // so much of what this file relies on turned out to be revocable that the
    // transport asks rather than assumes — and falls back to a pause that
    // resumes at the top of the current section, which is coarse but never
    // sends the viewer back to the start of the episode.
    const canFreeze = () => {
      const windows = portalWindows();
      return (
        windows.length === Object.keys(portalsRef.current).length &&
        windows.length > 0 &&
        windows.every((w) => typeof w.freezeToggle === "function")
      );
    };

    const setFrozen = (next) => {
      Object.values(portalsRef.current).forEach((portal) => {
        if (!portal || Boolean(portal.frozen) === next) return;
        try {
          const w = portal.frame?.contentWindow;
          if (typeof w?.freezeToggle !== "function") return;
          w.freezeToggle();
          portal.frozen = next;
        } catch (e) {}
      });
      return next;
    };

    const silencePortals = () => {
      portalWindows().forEach((w) => {
        try {
          w.stopSpeech?.();
          w.setPlayerVolume?.(0);
        } catch (e) {}
      });
    };

    /** Freeze the set where it stands. Returns whether it is now paused. */
    const applyPause = () => {
      const playback = playbackRef.current;
      if (!playback.running || playback.pausedAt !== null) return false;
      clearTimeout(pausePendingTimer);
      pausePending = false;
      // EVERY talk callback is guarded on `phase === "playing"`, so moving the
      // phase off it is what stops a pause from being read as the end of a
      // section — which would advance the episode while the viewer is away.
      phase = "paused";
      playback.pausedAt = performance.now();
      playback.resumesFromSectionStart = !canFreeze();
      if (playback.resumesFromSectionStart) silencePortals();
      else setFrozen(true);
      return true;
    };

    const pauseShow = () => {
      const playback = playbackRef.current;
      if (!playback.running) return false;
      if (playback.pausedAt !== null || pausePending) return true;
      if (phase === "arming" || phase === "seeking") {
        // Held until the clips land. The failsafe is only there so a viewer
        // cannot be left looking at a Pause button that never took.
        pausePending = true;
        clearTimeout(pausePendingTimer);
        pausePendingTimer = setTimeout(() => {
          if (pausePending && playbackRef.current.running) applyPause();
        }, ARM_FAILSAFE_MS);
        return true;
      }
      if (phase !== "playing") return false;
      return applyPause();
    };

    const resumeShow = () => {
      const playback = playbackRef.current;
      clearTimeout(pausePendingTimer);
      if (pausePending && playback.pausedAt === null) {
        // It never took effect — the clips were still loading and the viewer
        // changed their mind. Nothing to undo.
        pausePending = false;
        return true;
      }
      if (!playback.running || playback.pausedAt === null) return false;
      if (playback.resumesFromSectionStart) return jumpToSection(playback.section);

      const held = performance.now() - playback.pausedAt;
      // The performance clock, and with it every cut, turn and reaction.
      playback.startedAt += held;
      if (playback.heldSince) playback.heldSince += held;
      // The SKEW INSTRUMENTS are stamped off the same page clock, and they are
      // the only honest read on whether the two avatars are still in step. A
      // pause that was not added back here would show up in `window.__tsPlayed`
      // as a portal that "played" minutes longer than its clip, and the next
      // person reading it would be chasing a bug that is a paused viewer.
      if (issuedAt) issuedAt += held;
      for (const [key, at] of started) started.set(key, at + held);
      for (const [key, at] of audioStarted) audioStarted.set(key, at + held);
      playback.pausedAt = null;
      phase = "playing";
      setFrozen(false);
      window.__tsPause = window.__tsPause || [];
      window.__tsPause.push({
        section: playback.section + 1,
        at: Math.round(playback.elapsed),
        heldMs: Math.round(held),
      });
      // See the talk-ended handler: a section that ran out under the pause is
      // joined here rather than lost.
      if (ended.size >= Object.keys(portalsRef.current).length) finishSection();
      return true;
    };

    /**
     * Start the episode again at the top of a section: the only seek SitePal
     * allows. Always plays from there — a clip cannot be started into a paused
     * state, so landing somewhere and staying frozen is not something the
     * player can do.
     */
    const jumpToSection = (index) => {
      const active = timelineRef.current;
      const sections = active?.sections || [];
      const section = sections[index];
      const playback = playbackRef.current;
      if (!section || !playback.running) return false;
      clearTimeout(pausePendingTimer);
      pausePending = false;
      // Same trick as the pause: off "playing" first, so the talk-ended that
      // stopSpeech may raise cannot be read as this section finishing.
      phase = "seeking";
      setFrozen(false);
      silencePortals();
      ended.clear();
      started.clear();
      finished.clear();
      audioStarted.clear();
      // A reaction caught mid-gesture belongs to a moment the show is leaving.
      resetReactions();
      playback.pausedAt = null;
      playback.resumesFromSectionStart = false;
      playback.section = index;
      // The picture holds on the cut until SitePal is heard to start, exactly
      // as it does at a join, so a seek lands the way a section change already
      // does rather than running ahead of silence.
      playback.holdingAt = section.startsAt;
      playback.heldSince = performance.now();
      playback.elapsed = section.startsAt;
      // Cues are walked forward and never revisited, so the index is computed
      // for the new position instead of left where the last one was.
      playback.cueIndex = cueIndexAt(active?.cues, section.startsAt);
      if (startSection(index) === 0) {
        console.warn(`[TalkShowScene] section ${index + 1} would not start on a seek`);
        stopShow();
        return false;
      }
      return true;
    };

    /** Seek to a second of the episode; lands on the section that holds it. */
    const seekShow = (seconds) => {
      const sections = timelineRef.current?.sections || [];
      if (!sections.length || !playbackRef.current.running) return null;
      const index = sectionIndexAt(sections, seconds);
      return jumpToSection(index) ? sections[index].startsAt ?? 0 : null;
    };

    /** Skip a section back (-1) or forward (+1). Past the end ends the show. */
    const stepShow = (step) => {
      const sections = timelineRef.current?.sections || [];
      const playback = playbackRef.current;
      if (!sections.length || !playback.running) return null;
      const target = stepSection(sections, playback.elapsed, step);
      if (target === null) {
        stopShow();
        return null;
      }
      return jumpToSection(target) ? sections[target].startsAt ?? 0 : null;
    };

    /**
     * Where playback is, for the transport controls. They poll this rather
     * than being pushed to: the clock moves every frame and nothing on the
     * page should re-render at that rate.
     */
    const talkShowStatus = () => {
      const active = timelineRef.current;
      const playback = playbackRef.current;
      const sections = active?.sections || [];
      return {
        running: playback.running,
        paused: playback.pausedAt !== null || pausePending,
        // A section is loading: there is a moment at the start and at each
        // join where the transport can be pressed but nothing has begun.
        settling: phase === "arming" || phase === "seeking",
        elapsed: playback.running ? Math.max(0, playback.elapsed) : 0,
        duration: active?.dialogueEnd ?? 0,
        section: playback.section,
        sectionCount: sections.length,
        sectionStart: sections[playback.section]?.startsAt ?? 0,
        // Where the seekable blocks begin. The transport draws one per
        // section, which is the honest picture of what can be skipped to.
        sectionStarts: sections.map((section) => section.startsAt ?? 0),
        // Whether pause is the real thing or the section-start fallback.
        exactPause: canFreeze(),
      };
    };

    stopShowRef.current = stopShow;
    window.__talkShowPlay = playShow;
    window.__talkShowStop = stopShow;
    window.__talkShowRetryPortals = retryPortals;
    window.__talkShowPause = pauseShow;
    window.__talkShowResume = resumeShow;
    window.__talkShowSeek = seekShow;
    window.__talkShowStep = stepShow;
    window.__talkShowStatus = talkShowStatus;

    return () => {
      stopShow();
      Object.values(timers).forEach(clearTimeout);
      Object.values(preloads).forEach((q) => clearTimeout(q.timer));
      if (preloadRef.current === preloadEpisode) preloadRef.current = null;
      onPlaybackReady?.(false, "loading");
      window.removeEventListener("message", onMessage);
      clearTimeout(armTimer);
      clearTimeout(pausePendingTimer);
      if (window.__talkShowPlay === playShow) delete window.__talkShowPlay;
      if (window.__talkShowStop === stopShow) delete window.__talkShowStop;
      if (window.__talkShowPause === pauseShow) delete window.__talkShowPause;
      if (window.__talkShowResume === resumeShow) delete window.__talkShowResume;
      if (window.__talkShowSeek === seekShow) delete window.__talkShowSeek;
      if (window.__talkShowStep === stepShow) delete window.__talkShowStep;
      if (window.__talkShowStatus === talkShowStatus) delete window.__talkShowStatus;
      if (window.__talkShowRetryPortals === retryPortals) {
        delete window.__talkShowRetryPortals;
      }
      host.remove();
      portalsRef.current = {
        Monk: { frame: null, ready: false, source: null, attempt: 0, exhausted: false, loads: 0, frozen: false },
        Connor: { frame: null, ready: false, source: null, attempt: 0, exhausted: false, loads: 0, frozen: false },
      };
    };
  }, [onPlaybackReady, onPlaybackStateChange, compactPortalHost]);

  useFrame(({ camera, gl, scene }, delta) => {
    const playback = playbackRef.current;
    const timeline = timelineRef.current;
    let elapsed = 0;
    if (playback.running) {
      if (playback.holdingAt !== null) {
        // Between one section ending and the next being heard to start, the
        // picture holds on the cut rather than running on through silence —
        // otherwise the camera and the reactions would spend the join playing
        // the next section's opening to nobody.
        elapsed = playback.holdingAt;
        // Unless the start never comes. A portal that drops its talk-started
        // would otherwise freeze the show at a join forever, which is a worse
        // failure than a join that lands a little late.
        if (
          playback.pausedAt === null &&
          performance.now() - playback.heldSince > HOLD_FAILSAFE_MS
        ) {
          playback.startedAt =
            performance.now() -
            (playback.holdingAt + TALK_SHOW_TIMING.leadIn + TALK_SHOW_TIMING.sectionLeadIn) * 1000;
          playback.holdingAt = null;
          playback.heldSince = 0;
        }
      } else {
        // PAUSED READS THE CLOCK IT STOPPED AT. Everything on the timeline is
        // derived from this one subtraction, so holding `now` still is the
        // whole pause as far as the picture is concerned — no cut, turn or
        // reaction advances, and the resume adds the interval back onto
        // `startedAt` so the show carries on from the same second.
        const now = playback.pausedAt ?? performance.now();
        elapsed = (now - playback.startedAt) / 1000 - TALK_SHOW_TIMING.leadIn;
      }
      // What the transport controls read. Kept here, where it is already
      // worked out, rather than derived a second time somewhere else.
      playback.elapsed = elapsed;

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
      const cues = timeline?.cues || [];
      while (
        playback.cueIndex < cues.length &&
        cues[playback.cueIndex].at <= elapsed
      ) {
        const cue = cues[playback.cueIndex];
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

    // WHICH PART OF THE SHOW IS ON AIR. The set owns the clock, so it is the
    // only thing that can say — the chiron and the frame's screen both read
    // it from here. Published only when it CHANGES: that is a handful of
    // updates across an episode rather than one a frame, which is the
    // difference between a lower third that follows the running order and a
    // set that re-renders sixty times a second to no effect.
    const chapterIndex = chapterIndexAt(timeline, elapsed, playback.running);
    if (chapterIndex !== playback.chapterIndex) {
      playback.chapterIndex = chapterIndex;
      chapterIndexRef.current = Math.max(chapterIndex, 0);
      onChapterChangeRef.current?.(timeline?.chapters?.[chapterIndex] ?? null);
    }

    Object.entries(headBones).forEach(([actor, head]) => {
      head.quaternion.copy(animatedHeadQuaternions[actor]);
    });
    // A paused set holds its pose. The faces are frozen by SitePal itself, so
    // letting the bodies carry on breathing would leave two still faces on two
    // moving characters, which reads as a fault rather than as a pause.
    Object.values(mixers).forEach((m) =>
      m.update(playback.pausedAt === null ? delta : 0),
    );
    Object.entries(headBones).forEach(([actor, head]) => {
      animatedHeadQuaternions[actor].copy(head.quaternion);
    });

    // The opener is played to the viewer, so the host holds the camera until
    // the second line lands.
    const secondLineAt = timeline?.lineStarts?.[1];
    const introCameraFocus =
      playback.running && secondLineAt !== undefined
        ? 1 -
          THREE.MathUtils.smoothstep(elapsed, secondLineAt - 0.6, secondLineAt)
        : 0;
    if (
      introCameraFocus > 0.001 &&
      headBones.Connor &&
      neutralHeadQuaternions.Connor
    ) {
      const head = headBones.Connor;
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

        const baseLocal = neutralHeadQuaternions.Connor;
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
    } else if (cameraAimRef.current.smoothedQuaternion && headBones.Connor) {
      const aim = cameraAimRef.current;
      const animQuaternion = headBones.Connor.quaternion.clone();
      aim.smoothedQuaternion.slerp(animQuaternion, 0.08);
      headBones.Connor.quaternion.copy(aim.smoothedQuaternion);
      if (aim.smoothedQuaternion.angleTo(animQuaternion) < 0.01) {
        aim.smoothedQuaternion = null;
      }
    }

    let addressedListener = null;
    if (playback.running) {
      for (const cue of timeline?.gazes || []) {
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

    // SOLO MODE THROTTLES THE REPAINT, IT DOES NOT UNPROJECT.
    //
    // Swapping the visible mesh per speaker (Face2 → back to the static Face1)
    // is what it did first, and the two materials don't tone-match: every
    // handoff popped a visible shade change on both guests. Desktop never shows
    // it because it projects both faces continuously and so never swaps.
    //
    // So once a face is projected it STAYS projected — no mesh ever swaps
    // mid-show — and solo mode instead decides who gets REPAINTED this frame.
    // That keeps the saving that mattered: paintCrop is the drawImage + filter
    // + 512² texture upload, and it's now skipped for the listener rather than
    // run for both. The listener still refreshes slowly (they idle and blink
    // rather than freezing on one frame), which is a fraction of the cost of
    // painting them every tick.
    const soloKey = soloProjection
      ? speakerAt(timeline, elapsed, playback.running)
      : null;
    solotickRef.current = (solotickRef.current + 1) % SOLO_LISTENER_EVERY_NTH;

    Object.entries(TALKSHOW_PROJECTION_CONFIG).forEach(([key, cfg]) => {
      const st = projRef.current[key];
      // No one in the chairs, nothing to paint.
      if (!st || castHidden) return;
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
      // NOTE: soloKey is deliberately NOT part of this — see above.
      const selectedForFit =
        projectCharacter !== "Off" &&
        (!projectCharacter || projectCharacter === key);
      const show = selectedForFit && portal?.ready && !!source;
      if (show) ensureProjectionMaterial(st);
      if (st.face1) st.face1.visible = !show;
      if (st.face2) st.face2.visible = show;
      st.hideExtra.forEach((m) => { m.visible = !show; });

      const isListener = soloKey && soloKey !== key;
      const repaint = show && (!isListener || solotickRef.current === 0);
      if (repaint && st.cropCtx) paintCrop(st, cfg, source);
    });

    // Camera rig last, so the feed sees this frame's poses and faces. The feed
    // is a SECOND scene render (half rate, 384px) — worth it on desktop, but
    // the mobile mount turns it off to spend that budget on the SitePal faces.
    if (MONITOR_FEED.enabled && enableMonitorFeed) {
      if (monitorRef.current === undefined) {
        monitorRef.current = buildMonitorFeed(cloned, camera);
        if (!monitorRef.current) {
          console.warn(
            `[TalkShowScene] "${MONITOR_SCREEN_MESH}" not found — no camera monitor feed`,
          );
        }
      }
      const feed = monitorRef.current;
      if (feed) {
        // The swivel updates every frame even when the feed renders at half
        // rate, or the prop pans in visible steps.
        updateCameraRig(feed, headBones, timeline, elapsed, playback.running, delta);
        const every = Math.max(1, Math.round(MONITOR_FEED.everyNthFrame));
        feed.tick = (feed.tick + 1) % every;
        if (feed.tick === 0) renderMonitorFeed(feed, gl, scene);
      }
    }
  });

  // Mirror CyborgTempleScene's internal anchor offset so the set lands at the
  // same height the temple model does.
  return (
    <group position={[0, anchorY, 0]}>
      <primitive object={cloned} />
      {/* Siblings, not children of the set: readLightFixtures returns model
          coordinates in `cloned`'s parent space, which is exactly here. */}
      {lightFixtures.length > 0 && (
        <StudioLights fixtures={lightFixtures} onAir={onAir} />
      )}
    </group>
  );
}

// Mounts inside a host Canvas (no Canvas of its own). Takes the same
// position/scale/rotation CyborgTempleScene receives so the swap keeps the
// model in the same spot. `projectCharacter` ('Monk' | 'Connor' | null)
// activates the live SitePal projection on that character's face for fitting.
//
// The last four props are the MOBILE switches (see MobileTalkShow):
// `soloProjection` paints one face per frame instead of two, `enableMonitorFeed`
// drops the in-scene camera monitor's second scene render, `compactPortalHost`
// scales the hidden portal host to fit a phone viewport so WebKit doesn't
// throttle the off-screen half of it, and `hideCameraRig` strikes the tripod
// prop that the (now inert) monitor feed existed to justify. Desktop leaves all
// four at their defaults and behaves exactly as before.
//
// LT TV's lineup view uses the same set off air: `castHidden` empties the chairs
// (and skips painting the hidden faces), and `channelCards` puts the channel on
// the frame's screen — see ltTvChannelScreen.
//
// `onAir` is true only while an episode is actually running, and is what the
// overhead rig follows. A caller that dims the page's ambient with
// `HouseAmbient` must drive both off the same value, or the room and the rig
// disagree about whether the show is on.
export default function TalkShowScene({
  // WHICH EPISODE IS ON. A record from src/content/lt-tv — the guide's
  // selection, handed straight to the set. Defaults to the slate's first
  // episode so the set still has something to play if a caller doesn't say.
  episode = findEpisode(),
  position = [0, -1.9, 0],
  scale = [1.2, 1.2, 1.2],
  rotation = [0, 0, 0],
  anchorY = 0.3,
  projectCharacter = null,
  soloProjection = false,
  enableMonitorFeed = true,
  compactPortalHost = false,
  hideCameraRig = false,
  castHidden = false,
  newsMode = false,
  onAir = false,
  channelCards = null,
  onPlaybackReady,
  onPlaybackStateChange,
  onChapterChange,
}) {
  return (
    <group position={position} scale={scale} rotation={rotation}>
      <Suspense fallback={null}>
        <TalkShowModel
          episode={episode}
          anchorY={anchorY}
          projectCharacter={projectCharacter}
          soloProjection={soloProjection}
          enableMonitorFeed={enableMonitorFeed}
          compactPortalHost={compactPortalHost}
          hideCameraRig={hideCameraRig}
          castHidden={castHidden}
          newsMode={newsMode}
          onAir={onAir}
          channelCards={channelCards}
          onPlaybackReady={onPlaybackReady}
          onPlaybackStateChange={onPlaybackStateChange}
          onChapterChange={onChapterChange}
        />
      </Suspense>
    </group>
  );
}
