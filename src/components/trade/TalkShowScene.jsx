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
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SITEPAL_PROJECTION_CONFIG } from "@/components/CyborgTempleScene";

// Version the URL when the Blender export changes so drei does not keep an
// older GLTF from its in-memory cache during hot reloads.
const MODEL_URL = "/models/talk_show.glb?v=20260731-camrig";
// World up, for the camera prop's pan.
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SITEPAL_ACCOUNT = "9308752";
const TALK_SHOW_PORTAL_HOST_ID = "talk-show-sitepal-portals";

// Names must match SitePal's Audio Manager exactly.
const TALK_SHOW_AUDIO = {
  Barron: "talk show test for jb",
  Monk: "talk show test GR80",
};

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

// Seconds between the performance clock starting and the first WORD. Those
// line starts come from ElevenLabs' voice_segments, but the clock is stamped
// when sayAudio() is called — and SitePal reports the track as started within
// ~150ms, so the difference is dead air at the head of the uploaded tracks.
// Everything on the timeline (camera shots, reaction cues, listener gazes)
// reads through this, so it stays in sync. Trim by ear via `window.__tsTiming`.
export const TALK_SHOW_TIMING = { leadIn: 2.5 };

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

// ── Camera direction ──────────────────────────────────────────────────────
// Who holds each line. DIRECT_ADDRESS_GAZES names the LISTENER — the one who
// turns to face the speaker — so the speaker is the other character. Lines
// with no listener turn are played to the room; both are Barron's (his intro
// already aims his head at the viewer camera, and line 5 lays out the choice).
const AUDIENCE_LINE_SPEAKERS = { 0: "Barron", 5: "Barron" };

const LINE_SPEAKERS = (() => {
  const opposite = { Barron: "Monk", Monk: "Barron" };
  const speakers = TEST_LINE_STARTS.map(() => null);
  DIRECT_ADDRESS_GAZES.forEach((cue) => {
    speakers[cue.line] = opposite[cue.listener];
  });
  Object.entries(AUDIENCE_LINE_SPEAKERS).forEach(([line, actor]) => {
    speakers[line] = actor;
  });
  return speakers;
})();

// The set has ONE camera, so a "cut" is a physical pan — the director commits
// to a shot per line rather than chasing every exchange. Singles on the
// speaker, pulling back to the two-shot for the lines played to the room and
// whenever the exchange has sat on singles too long. `subject: null` = wide.
const SHOT_AUDIENCE_LINES = new Set(Object.keys(AUDIENCE_LINE_SPEAKERS).map(Number));
const SHOT_MAX_SINGLES = 3;
// An operator reacts to a line instead of anticipating it, and won't whip off
// a shot they only just landed — short lines play out as reaction shots on
// whoever the camera is already holding.
const SHOT_REACTION_DELAY = 0.3;
const SHOT_MIN_HOLD = 2.6;

const TALK_SHOW_SHOTS = (() => {
  const shots = [{ at: 0, subject: null }];
  let singles = 0;
  TEST_LINE_STARTS.forEach((start, line) => {
    const speaker = LINE_SPEAKERS[line];
    const wide =
      !speaker || SHOT_AUDIENCE_LINES.has(line) || singles >= SHOT_MAX_SINGLES;
    const subject = wide ? null : speaker;
    singles = wide ? 0 : singles + 1;
    const at = start + SHOT_REACTION_DELAY;
    const prev = shots[shots.length - 1];
    if (prev.subject === subject || at - prev.at < SHOT_MIN_HOLD) return;
    shots.push({ at, subject });
  });
  return shots;
})();

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
  // later. The clock itself is stamped on SitePal's talk-started message, so
  // this should stay near 0; it's here to trim the pans without touching the
  // reaction cues, which read from the same clock.
  shotLead: 0,
  // 'auto' follows the shot list; 'wide' | 'Barron' | 'Monk' holds one shot
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

// Which shot is live at `elapsed`. `null` subject = the two-shot.
function currentShotSubject(elapsed, running) {
  const override = MONITOR_FEED.shot;
  if (override !== "auto") return override === "wide" ? null : override;
  if (!running) return null;
  const cue = elapsed - MONITOR_FEED.shotLead;
  for (let i = TALK_SHOW_SHOTS.length - 1; i >= 0; i -= 1) {
    if (TALK_SHOW_SHOTS[i].at <= cue) return TALK_SHOW_SHOTS[i].subject;
  }
  return null;
}

// Runs EVERY frame (the feed itself may render at half rate, but the prop must
// swivel smoothly): pick the shot, then ease the pan, the zoom and the aim
// toward it. The physical swivel is cosmetic — the virtual lens aims at the
// subject directly, so the feed stays framed even if the prop lags or the
// authored rest pose is a few degrees off.
function updateCameraRig(feed, headBones, elapsed, running, delta) {
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

  const subject = currentShotSubject(elapsed, running);
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

  // Camera-monitor feed. Built on the first frame (it needs the viewer camera)
  // and torn down with the model it was built against; `undefined` means "not
  // built yet", `null` means the prop wasn't in the GLB.
  const monitorRef = useRef(undefined);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__tsMonitor = MONITOR_FEED;
      window.__tsTiming = TALK_SHOW_TIMING;
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
          // Provisional clock; the first talk-started message re-stamps it.
          audioStarted: false,
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

  useFrame(({ camera, gl, scene }, delta) => {
    const playback = playbackRef.current;
    let elapsed = 0;
    if (playback.running) {
      elapsed =
        (performance.now() - playback.startedAt) / 1000 -
        TALK_SHOW_TIMING.leadIn;

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

    // Camera rig last, so the feed sees this frame's poses and faces.
    if (MONITOR_FEED.enabled) {
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
        updateCameraRig(feed, headBones, elapsed, playback.running, delta);
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
