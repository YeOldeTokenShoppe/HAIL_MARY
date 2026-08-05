import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import {
  mountPitchBot, tickPitchBotBillboard, disposePitchBotBillboard, getPitchBotFraming,
} from "@/lib/trade/pitchBotScene";
import { tickPitchBotFace, setPitchBotFaceHidden } from "@/lib/trade/pitchBotExpressions";
import { TEMPLE_ANCHOR_NAME } from "@/lib/templePresence";
import {
  tickPitchBotHolo, disposePitchBotHolo,
  startPitchBotCast, cancelPitchBotCast, tickPitchBotCast,
} from "@/lib/trade/pitchBotHolo";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { unicornGlow } from "@/lib/trade/unicornGlow";
import { registerUnicornWave } from "@/lib/trade/unicornWave";
import { unicornMouth } from "@/lib/trade/unicornMouth";
import { Html, SpotLight } from "@react-three/drei";
import AnnotationSystem from "@/components/AnnotationSystem";
import { db, collection, query, orderBy, limit, getDocs } from '@/lib/firebaseClient';
import HolographicStatue3 from "@/components/HolographicStatue3";
import BeaconBeam from "@/components/BeaconBeam";
import HologramCard from "@/components/trade/HologramCard";
import { createLaptopCrtScreen } from "@/components/laptopCrtScreen";

// Temple model URLs. The `?v=` suffix is part of the CDN cache key, so bumping
// it is a guaranteed cache-bust. On 2026-08-01 the App Hosting edge had cached
// a TRUNCATED copy of the un-versioned lite GLB — every load stalled byte-exact
// at 2,106,067 of 4,252,240 with the connection held open, so GLTFLoader's
// fetch neither resolved nor errored and /trade hung on the loader forever.
// If that ever recurs, bump the version here. page.js's preload <link> imports
// this so the cache warm stays on the same key as GLTFLoader's request.
export const TEMPLE_MODEL_URL = "/models/RL80_4anims_v00_lite.glb?v=2";
export const TEMPLE_MODEL_FALLBACK_URL = "/models/RL80_4anims_v00_opt.glb?v=2";

// Agent camera focus settings — module-level so the dev tuning panel
// (CameraTuningPanel) can mutate values in place. The click handler reads
// from this object on every focus, so live edits take effect on the next
// agent click without a reload.
//
// Mobile shifts the entire workstation along the Y axis, so on mobile we
// apply a single global Y offset (MOBILE_Y_OFFSET below) to cameraPos /
// lookAtPos / orbitCenter when resolving for a click. Tune via the panel.
export const MOBILE_CAMERA_OFFSET = { y: 0.7 };

export const AGENT_CAMERA_SETTINGS = {
  RL80: {
    cameraPos: new THREE.Vector3(1.91, -0.07, 0.595),
    lookAtPos: new THREE.Vector3(-0.775, -0.73, 0.755),
    orbitCenter: null,
  },
  Demon: {
    // Retuned in-app 2026-08-02 (?tune=1): brought in from z 2.215 and dropped
    // 0.015, which is the difference between watching him from across the room
    // and sitting at the desk with him. lookAtPos unchanged.
    cameraPos: new THREE.Vector3(-0.375, -0.575, 1.565),
    lookAtPos: new THREE.Vector3(1.785, -0.485, -0.22),
    orbitCenter: null,
  },
  Monk: {
    // Retuned in-app 2026-08-02 (?tune=1). Same story as the Demon's: almost all
    // of the move is distance (x -1.79 -> -1.555), a little z, no height change.
    cameraPos: new THREE.Vector3(-1.555, -0.325, -0.38),
    lookAtPos: new THREE.Vector3(0.125, -0.215, -1.325),
    orbitCenter: null,
  },

  Virgil: {
    cameraPos: new THREE.Vector3(0.54, 0.11, -1.65),
    lookAtPos: new THREE.Vector3(1.87, -1.35, 0.745),
    orbitCenter: null,
  },
  // THE PITCH BOT — BOOTSTRAP ONLY. The real pose is derived from the bot's face
  // plate at focus time (getPitchBotFocusSettings in CyborgTempleScene); this is
  // just what gets used if focus fires before the model has landed.
  //
  // Static coordinates went stale three times on this character because it moves —
  // rescaled twice, raised once — so do not treat these as the source of truth.
  //
  // MEASURED, not guessed. The first pass aimed lookAtPos at y = -0.55 and the
  // camera flew to a patch of floor about a unit BELOW the bot, because the bot
  // was raised to float after that pose was written and nothing re-derived it.
  //
  // The datum is the FACE PLATE at world y ~= 0.45. Do not use the body's
  // bounding box: SM_Chr_Kid_Robot_01 is a SkinnedMesh, so geometry.boundingBox
  // is its BIND POSE and ignores the skeleton entirely — measuring that way
  // reported the figure as 0.07 units wide. The face plate is unskinned, so its
  // world position is real. The bot spans roughly y 0.0 -> 0.5.
  //
  // Aimed slightly below the face so the head sits in the upper third of frame,
  // and z kept at 1.6 (a distance already known to clear the monitors — the
  // desks sit down at y ~= -1.2, so this shot passes well above them).
  //
  // Both vectors are plain WORLD coordinates: they go straight into
  // controls.setLookAt(camX, camY, camZ, targetX, targetY, targetZ).
  PitchBot: {
    cameraPos: new THREE.Vector3(0, 0.45, 1.6),
    lookAtPos: new THREE.Vector3(-0.06, 0.33, 0.06),
    orbitCenter: null,
  },
  // Detective — placeholder cameraPos/lookAtPos. Tune via the in-app
  // CameraTuningPanel (?tune=1) or by editing here directly.
  Detective: {
    cameraPos: new THREE.Vector3(0.495, -0.215, -1.915),
    lookAtPos: new THREE.Vector3(0.57, -1.075, 1.33),
    orbitCenter: null,
  },
  Angel: {
    cameraPos: new THREE.Vector3(0, 1.8, 1.2),
    lookAtPos: new THREE.Vector3(0, 1.9, 0),
    orbitCenter: null,
  },
  Screen1: {
    cameraPos: new THREE.Vector3(-0.87, -0.4, -0.76),
    lookAtPos: new THREE.Vector3(-0.48, -0.27, 0.775),
    orbitCenter: null,
  },
  Screen2: {
    cameraPos: new THREE.Vector3(-0.81, -0.375, 0.84),
    lookAtPos: new THREE.Vector3(1.57, -0.25, 0.205),
    orbitCenter: null,
  },
  Screen3: {
    cameraPos: new THREE.Vector3(0.73, -0.32, -0.77),
    lookAtPos: new THREE.Vector3(-0.585, -0.305, -0.47),
    orbitCenter: null,
  },
  Screen4: {
    cameraPos: new THREE.Vector3(0.765, -0.36, 0.66),
    lookAtPos: new THREE.Vector3(0.595, -0.35, -0.005),
    orbitCenter: null,
  },
  // ScreenA-D are the secondary (council-chat) monitors. Initial values
  // mirror each character's primary-screen sibling — tune with ?tune=1.
  ScreenA: {
    cameraPos: new THREE.Vector3(-1.225, -0.36, -0.7),
    lookAtPos: new THREE.Vector3(-1.665, -0.34, 1.07),
    orbitCenter: null,
  },
  ScreenB: {
    cameraPos: new THREE.Vector3(-0.76, -0.355, 1.28),
    lookAtPos: new THREE.Vector3(-0.315, -0.32, 1.34),
    orbitCenter: null,
  },
  ScreenC: {
    cameraPos: new THREE.Vector3(0.695, -0.22, -1.12),
    lookAtPos: new THREE.Vector3(-0.865, -0.455, -1.525),
    orbitCenter: null,
  },
  ScreenD: {
    cameraPos: new THREE.Vector3(1.005, -0.36, 0.7),
    lookAtPos: new THREE.Vector3(1.615, -0.305, -1.015),
    orbitCenter: null,
  },
  // Curtain-call framing for the reveal flow — wide, near floor level, fits
  // all four characters on the platform with StageProps hidden. Consumed via
  // externalFocusAgent='Stage' (see trade/page.js). Tune live with ?tune=1.
  //
  // Camera pitch is driven by cameraPos.y against lookAtPos.y over the 3.2
  // horizontal distance: y 0.7 = ~17° looking down, 0.3 = ~11°, 0.0 = ~5°,
  // -0.3 = dead level, -0.6 = ~5° looking up. The stage floor sits at world
  // y ≈ -1.6 and the characters' heads at ≈ -0.3, so lookAtPos is head height.
  Stage: {
    cameraPos: new THREE.Vector3(0, -0.9, 3.5),
    lookAtPos: new THREE.Vector3(0, -0.3, 0),
    orbitCenter: null,
  },
};

// Holographic statue (the small floating figure above the workstation).
// Desktop and mobile positions tuned independently — mobile model shifts
// the workstation up so the statue has its own offset.
export const HOLO_STATUE_DESKTOP = {
  position: [-0.085, 0.2, -0.03],
  scale: [0.5, 0.5, 0.5],
  rotation: [0, -Math.PI * 0.2, 0],
};
export const HOLO_STATUE_MOBILE = {
  position: [-0.085, 0.9, -0.03], // placeholder — tune for the mobile shift
  scale: [0.5, 0.5, 0.5],
  rotation: [0, -Math.PI * 0.2, 0],
};

// Nudge the geometric "sacred geometry" beacon from code instead of
// re-exporting the GLB. Applied every frame on top of the shape cluster's
// baked transform (the "Empty" container of the Shape* meshes):
//   position — added, in the container's local units (x, y, z)
//   rotation — added, in radians (the Take 001 spin is separate; this just
//              reorients the whole cluster)
//   scale    — multiplies the baked scale
// All-zero / scale 1 leaves it exactly as baked. Edit + save to see it live.
export const GEOMETRIC_SHAPE_NUDGE = {
  position: [-0.05, 0, 0.05],
  rotation: [0, 0, 0],
  scale: 1,
};

// Legacy geometric-beacon toggle. false = the HologramCard (the card in play)
// replaces the GLB knot at the beacon spot; flip to true to restore the knot
// instantly while comparing. The hidden knot still anchors beam aim + card
// position, so nothing else moves when you toggle.
export const SHOW_LEGACY_BEACON = false;

// HologramCard (the card in play, projected above the projector base) toggle.
// Temporarily false — the beam still renders on its own; only the card is
// hidden. Flip to true to bring the card back. Note that with the card hidden
// there's nothing at the beacon spot to click, so the card's camera fly-in
// (handleClick → agentId 'HologramCard') is inert until this is re-enabled.
export const SHOW_HOLOGRAM_CARD = false;

/* THE PROJECTOR BEAM — the shaft rising from the projector base at the centre of
   the desks. These were inline props on <BeaconBeam>, which is why nobody could
   find them: the obvious-looking knob is HOLO_HEIGHT in HoloProjector.jsx, and
   that component is NOT MOUNTED on /trade (SpaceScene imports it, and even there
   the mount is commented out). Editing it changes nothing here.

   ONE BEAM, TWO PAYLOADS, TWO HEIGHTS. The shaft is always the same object, but
   what sits in it swaps with the session: the neon sign hangs in it in the lobby,
   and the pitch bot is cast into it during a pitch. They are different sizes, so a
   single height cannot fit both — sizing it to the bot (half its first scale, and
   floating) left it far short of the sign. Keyed off the same `pitchStarted` latch
   that swaps the payloads, so the shaft can never be sized for the thing that
   isn't there.

   Lengths are in the parent group's local units. Tune live, no reload:

       __pitchBeamTune({ height: 0.28 })            // the active preset
       __pitchBeamTune({ height: 0.6 }, 'neon')     // name one explicitly
*/
/* HOW THE PITCH BOT IS FRAMED when the camera flies to it.
 *
 * The pose itself is DERIVED at focus time from the bot's face plate (see
 * getPitchBotFocusSettings) rather than authored, because this character moves and
 * static coordinates went stale on it three times. These are the three numbers
 * that shape that derivation — the only part worth tuning by hand.
 *
 * Dial live and see it immediately (the handle re-fires the focus):
 *
 *     __pitchBotFrame({ dist: 1.0, aimDrop: 0.09 })
 *     __pitchBotFrame()                 // read current + the derived pose
 */
// MOVED to lib/trade/pitchBotScene, where it became per-variant — a rig swap
// changes what the camera should do, so the numbers belong next to the rigs.
// Re-exported under the old name so nothing that imported it has to care; it is
// the DEFAULT now, not the setting. Use getPitchBotFraming() to resolve the
// active rig's values.
export { PITCH_BOT_FRAMING_DEFAULT as PITCH_BOT_FRAMING } from "@/lib/trade/pitchBotScene";

const BEAM_BASE = { color: "#35e8ff", topRadius: 0.10, bottomRadius: 0.03, opacity: 0.1 };
export const BEAM_PRESETS = {
  // Lobby: rises into the neon sign. The original 0.55, which was authored for it.
  neon: { ...BEAM_BASE, height: 0.55 },
  // A pitch is on: rises into the bot, which is smaller and floats lower.
  pitch: { ...BEAM_BASE, height: 0.5 },
};


// ── Neon sign ────────────────────────────────────────────────────────────
// The sign lives in its own GLB (it was ~40% of the main model's geometry),
// so only the one variant picked for this load is ever downloaded. Add a
// variant by adding a line here — nothing else needs to change.
//
// Per-entry knobs, since the signs won't all be the same size or face the
// same way out of Blender:
//   yOffset — raise/lower the sign (scene units; the temple is ~2 tall)
//   scale   — multiplier on the sign's authored scale
//   yaw     — extra spin (radians) if a sign's front isn't its geometry +Z
// Each sign is exported from its placed position in the main model, so its
// own file already carries the right transform — offsets below default to 0
// and only exist for per-sign touch-ups.
export const NEON_SIGNS = [
  { id: 'open',  url: '/models/neon_open.glb',  yOffset: 0, scale: 1, yaw: 0 },
  { id: 'face',  url: '/models/neon_face.glb',  yOffset: 0, scale: 1, yaw: 0 },
  // { id: 'poker', url: '/models/neon_poker.glb', yOffset: 0, scale: 1, yaw: 0 },
  { id: 'earth', url: '/models/neon_earth.glb', yOffset: 0, scale: 1, yaw: 0 },
];

// Height/placement offsets applied to every sign on top of its per-entry
// values. Tune yOffset here to move the sign as a whole — it's the knob to
// reach for first; the per-entry yOffset is for one sign that sits differently.
export const NEON_SIGN_CONFIG = { yOffset: 0.0, xOffset: -0.02, zOffset: 0.01 };

// false = re-roll on every page load (the default — a refresh gives you a
// different sign). true = keep one sign for the whole browser tab, which is
// steadier while tuning since it stops HMR reshuffling on every save. Note
// that sessionStorage survives a hard refresh, so with this on you only get a
// new sign by closing the tab or passing ?sign=random.
// ?sign=<id> pins one regardless; ?sign=random always re-rolls.
export const NEON_SIGN_STICKY = false;

// The sign shown on the FIRST load of a browser tab — the flagship, so a
// visitor's first impression of the temple is a known one. Every load after
// that in the same tab randomizes normally. Set to null to randomize from the
// very first load. ?sign=random skips the pin.
export const NEON_SIGN_FIRST = 'open';

// XZ nudge applied to Angel_Empty so the angel sits centered on the
// altar spotlight when viewed top-down. Y is left to the hover animation.
export const ANGEL_POSITION_OFFSET = { x: -0.10, z: 0.01 };

// SitePal face overlay onto the Demon's Face mesh. Crop region in the
// source SitePal canvas (matches the pattern used by MainScene/Fortune
// Teller). Tweak in place — the per-frame compositor reads these values
// each frame, so live edits take effect on the next paint.
export const DEMON_SITEPAL_CROP = {
  cropX: 180,
  cropY: 118,
  cropW: 145,
  cropH: 195,
  rotateZ: 0,
  rotateX: 0,
};

// Color correction applied to the SitePal frame before it lands on
// Face2. SitePal's render comes back washed-out / grey-toned even
// when the avatar art is colorful; these knobs map to CSS filter
// syntax (ctx.filter) and are composed into a single filter string
// per frame. Tweak in place — edits go live on the next paint.
//   saturate / contrast / brightness: 100 = identity (percent)
//   hueRotate: degrees (+ warmer when positive at low values, depends)
//   sepia: 0-100, mixes in a warm tan tone for skin matching
export const DEMON_SITEPAL_FILTER = {
 saturate: 106,
  contrast: 102,
  brightness: 73,
  hueRotate: 0,
  sepia: 20,
};

// DOM container id polled by the per-frame compositor. The trade page
// mounts the (single) host SitePal embed into this container —
// characters share one portal and swap scenes via loadSceneByID().
export const DEMON_SITEPAL_CONTAINER_ID = "sitepal-container-host";

// On focus, the Demon plays an audio track from the SitePal account
// by name (sayAudio in the SitePal API). Tracks must exist in the
// SitePal account that owns the embed; the lipsync / timing is bound
// server-side. activateSitePalProjection() picks one at click time
// (avoiding immediate repeats). Empty array = fall back to the
// scene's bound audio. Currently `preferSceneAudio: true` on the
// Demon config means the scene's auto-loaded track wins when present,
// so these names act as a fallback unless you flip preferSceneAudio.
//
// PLACEHOLDERS — record these in the SitePal account on scene 2774900, save
// each under the name shown, then uncomment. Names must match EXACTLY.
// Voice: John Barron (old logs call him H80Z) — smug, market-brained, hostile
// to new wallets as a bit. Short sentences, one clipped cut per line.
export const DEMON_SITEPAL_AUDIO_NAMES = [
  '11devil1',
  // 'barron greeting 2',  → "New wallet. No history. Of course you found me first."
  // 'barron greeting 3',  → "Let me guess. You want a number. Everybody wants a number."
  // 'barron greeting 4',  → "Burner. ...Fine. Sit down. I've been wrong once."
];

// ── Detective SitePal config (parallel to Demon) ────────────────
// Face2-mapping crop region for Detective_Face2. Tweak via the
// SitePalCropPanel after selecting the Detective character.
export const DETECTIVE_SITEPAL_CROP = {
  cropX: 209,
  cropY: 63,
  cropW: 192,
  cropH: 199,
  rotateZ: 0,
  rotateX: 0,
};
export const DETECTIVE_SITEPAL_FILTER = {
saturate: 210,
  contrast: 68,
  brightness: 82,
  hueRotate: -10,
  sepia: 0,
};
// (Detective container id no longer needed — single host portal.)
// Empty array = use scene-level audio via replay() (which is what
// worked for Demon — the published SitePal scene auto-plays its bound
// track). Add named tracks here once you record them.
//
// PLACEHOLDERS — record on scene 2774916, save under these exact names, then
// uncomment. Voice: Marisol, onchain detective — dry, factual, mildly
// exasperated; cites timestamps, always has a trace running.
//
// NOTE: she has no named track today, so her greeting is the scene's bound
// audio. Uncommenting ANY name switches her to named playback — so either
// record all four, or include a named copy of her current greeting as #1,
// otherwise that line stops being reachable.
export const DETECTIVE_SITEPAL_AUDIO_NAMES = [
  // 'marisol greeting 1',  → "I already ran your wallet. Fwiw, it's clean. Mostly."
  // 'marisol greeting 2',  → "Indexer's behind again. Last sync, fourteen twenty-one. Don't quote me on anything before that."
  // 'marisol greeting 3',  → "Everyone here has a theory. I have receipts. Sit down."
  // 'marisol greeting 4',  → "I trace, I timestamp, I screenshot. That's the whole job."
];

// ── Monk / Saint GR80 SitePal config ─────────────────────────────
// Face2-mapping crop region for Monk_Face2. Tweak via the
// SitePalCropPanel after selecting the Monk character.
export const MONK_SITEPAL_CROP = {
  cropX: 249,
  cropY: 150,
  cropW: 160,
  cropH: 205,
  rotateZ: 0,
  rotateX: 0,
};
export const MONK_SITEPAL_FILTER = {
  saturate: 53,
  contrast: 99,
  brightness: 93,
  hueRotate: -27,
  sepia: 0,
};
// Multiple short snippets for variety. activateSitePalProjection() picks
// one at click time (avoiding immediate repeats) so the Monk doesn't say
// the same line twice in a row. Names must match audio tracks saved in
// the SitePal account on scene 2774449.
//
// PLACEHOLDERS — record on scene 2774449, save under these exact names, then
// uncomment. Voice: St. GR80, android monk and keeper of logs — terse,
// reverent, procedural. Reads log entries aloud flatly; courteous to visitors.
// Never "child" — visitors are seekers, pilgrims, travelers.
export const MONK_SITEPAL_AUDIO_NAMES = [
  'GR80 greeting 1',
  // 'GR80 greeting 2',  → "Log. Visitor at station one. Welcome, seeker."
  // 'GR80 greeting 3',  → "You may look. Everything here is recorded. Nothing here is judged."
  // 'GR80 greeting 4',  → "I keep the logs. The candles, the prayers, the losses. Especially the losses."
];

// Per-character SitePal projection registry. This keeps scene metadata
// in one place while crop/filter remain exported as mutable objects for
// the live tuning panel. `hash` is retained from the character's embed
// snippet for future direct-embed/context-specific flows; the current
// shared host swaps scenes by `sceneId` via loadSceneByID().
export const SITEPAL_PROJECTION_CONFIG = {
  Demon: {
    label: 'Demon',
    sceneId: 2774900,
    hash: 'YnR4tCeRwrDH29TfMAxvtPb4anz6oa6n',
    embedContext: 1,
    crop: DEMON_SITEPAL_CROP,
    filter: DEMON_SITEPAL_FILTER,
    audioNames: DEMON_SITEPAL_AUDIO_NAMES,
    // preferSceneAudio:true makes the scene's own bound track WIN over the
    // random pick from audioNames (see the resolution in page.js
    // runSpeechRequest). Flip to false once the extra greetings are recorded,
    // or he'll keep saying the same one no matter how many names are listed.
    speech: { type: 'audio', preferSceneAudio: true },
    preload: true,
  },
  Detective: {
    label: 'Detective',
    sceneId: 2774916,
    hash: '',
    embedContext: 1,
    crop: DETECTIVE_SITEPAL_CROP,
    filter: DETECTIVE_SITEPAL_FILTER,
    audioNames: DETECTIVE_SITEPAL_AUDIO_NAMES,
    // Same as the Demon: flip to false once her named tracks exist, otherwise
    // the scene's bound track overrides every pick from audioNames.
    speech: { type: 'audio', preferSceneAudio: true },
    preload: true,
  },
  Monk: {
    label: 'Monk',
    sceneId: 2774449,
    hash: 'SfJwD81CkTeyemxPllatiMuMQDBGhBgZ',
    embedContext: 0,
    crop: MONK_SITEPAL_CROP,
    filter: MONK_SITEPAL_FILTER,
    audioNames: MONK_SITEPAL_AUDIO_NAMES,
    speech: { type: 'audio', preferSceneAudio: false },
    preload: false,
  },
};

// Back-compat convenience map used by the trade page and scene swap code.
export const SITEPAL_SCENE_IDS = Object.fromEntries(
  Object.entries(SITEPAL_PROJECTION_CONFIG).map(([key, config]) => [key, config.sceneId])
);

// Returns the active cameraPos/lookAtPos/orbitCenter for the given agent.
// On mobile, MOBILE_CAMERA_OFFSET.y is added to the Y component of every
// vector to compensate for the workstation model's mobile-only vertical
// shift. Always returns fresh THREE.Vector3 instances safe to mutate.
export function resolveAgentSettings(agentId, isMobile) {
  const base = AGENT_CAMERA_SETTINGS[agentId];
  if (!base) return null;
  const dy = isMobile ? (MOBILE_CAMERA_OFFSET.y || 0) : 0;
  const apply = (v) => {
    if (!v) return null;
    const out = v.clone();
    if (dy) out.y += dy;
    return out;
  };
  return {
    cameraPos: apply(base.cameraPos),
    lookAtPos: apply(base.lookAtPos),
    orbitCenter: apply(base.orbitCenter),
  };
}

// --- Word cluster configuration ---
const WORD_CLUSTER_WORDS = [
  '✨ blessed', '🕯️ light', '🔥 fire', '💫 cosmic', '🌟 shine',
  '⭐ glow', '🌙 luna', '☀️ sol', '💎 gem', '🪐 orbit',
  '🚀 launch', '💥 boom', '🍀 luck', '🦋 morph', '🎯 focus',
  'RL80', 'HODL', 'wagmi', 'gm', 'based',
  'moon', 'degen', 'alpha', 'bullish', 'vibes',
  'candle', 'shrine', 'prayer', 'light it up', 'blessed be',
  'to the moon', 'diamond hands', 'lets go', 'believe', 'manifest',
  'power', 'energy', 'spirit', 'flame', 'radiant',
  'eternal', 'sacred', 'divine', 'cosmic', 'infinite',
  'transcend', 'illuminate', 'ascend', 'harmony', 'unity',
  '🕯️', '🔥', '✨',
];

const WORD_GLOW_COLORS = [
  '#ff66ff', '#66ccff', '#ffd36b', '#ff9966', '#8df59a',
  '#ffa0f8', '#c6a7ff', '#ff4444', '#44ff99', '#99ccff',
];

function createWordTexture(text, colorIndex = 0) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 60;
  const padding = 80; // extra space for glow/shadow
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const measured = ctx.measureText(text);
  canvas.width = Math.max(512, Math.ceil(measured.width) + padding);
  canvas.height = 128;
  // Re-set font after canvas resize (resets context)
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = WORD_GLOW_COLORS[colorIndex % WORD_GLOW_COLORS.length];
  ctx.shadowBlur = 30;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData = { aspect: canvas.width / canvas.height };
  return texture;
}

// --- Floating Word Cluster (adapted from CosmicOrbit for temple scene scale) ---
function FloatingWordCluster({ words = WORD_CLUSTER_WORDS, center = [0, 1.5, 0], clusterScale = 1 }) {
  const groupRef = useRef();

  const wordData = useMemo(() => {
    const n = words.length;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.3999 radians
    return words.map((text, i) => {
      const texture = createWordTexture(text, i);
      const aspect = texture.userData?.aspect || 4;
      // Fibonacci sphere for even distribution
      const phi = Math.acos(1 - 2 * (i + 0.5) / n); // polar angle, evenly spaced
      const theta = goldenAngle * i; // azimuthal angle, golden spiral
      // Vary radius slightly per point for depth
      const minR = 3;
      const maxR = 5;
      const r = minR + (maxR - minR) * ((i % 3) / 2.5 + Math.random() * 0.15);
      return {
        texture,
        aspect,
        radius: r,
        phi,
        theta,
        speed: 0.08 + Math.random() * 0.04,
        scale: 0.4 + Math.random() * 0.3,
      };
    });
  }, [words]);

  useEffect(() => {
    return () => {
      wordData.forEach((d) => d.texture.dispose());
    };
  }, [wordData]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((sprite, i) => {
      const d = wordData[i];
      if (!d) return;
      const angle = d.theta + t * d.speed;
      sprite.position.x = d.radius * Math.sin(d.phi) * Math.cos(angle);
      sprite.position.y = d.radius * Math.cos(d.phi);
      sprite.position.z = d.radius * Math.sin(d.phi) * Math.sin(angle);
      sprite.material.opacity = 0.6 + 0.2 * Math.sin(t * 2 + i);
    });
  });

  return (
    <group ref={groupRef} position={center} scale={[clusterScale, clusterScale, clusterScale]}>
      {wordData.map((d, i) => (
        <sprite key={i} scale={[d.scale * d.aspect, d.scale, 1]}>
          <spriteMaterial map={d.texture} transparent opacity={0.6} depthWrite={false} depthTest={true} />
        </sprite>
      ))}
    </group>
  );
}


// Single source of truth for Eugene's code-made mouth overlay (Path A2).
// BOTH the live-tuner init and the per-frame driver read these — edit here (or
// tune live with Shift+M + keys / window.__rl80Mouth) and there's no "which
// section?" ambiguity. offset is HEAD-LOCAL: +z toward the muzzle tip, so a
// SMALLER z sits the mouth closer to her head. rot is [pitchX, yawY, rollZ] deg.
const RL80_MOUTH_DEFAULTS = {
  offset: [0, 0.012, 0.191],
  rot: [15, 0, 0], // pitch forward (rot[0]=pitch; flip sign if it tilts back)
  width: 0.024,
  maxH: 0.016,           // FIXED mouth height now — the canvas draws the opening
                         // within it (was the open-scale height before teeth).
  color: 0x140a10,       // maw interior (dark)
  teeth: 4,              // number of blocky upper teeth (0 = none)
  toothColor: 0xefe6d2,  // tooth cream/bone
  gain: 1,
};

// Hex 0xRRGGBB → "#rrggbb" for canvas fillStyle.
const _rl80hex = (n) => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');

// Draw Eugene's mouth onto its canvas for a given openness (0..1): a dark maw
// ellipse whose height grows with `open`, plus `teeth` blocky upper teeth that
// drop in as he opens (clipped to the maw so they never poke past the lips).
// Redrawing per-openness (rather than scaling the mesh) keeps the teeth a fixed
// shape instead of stretching.
function drawUnicornMouth(ctx, W, H, open, interiorHex, toothHex, teeth) {
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const rx = W * 0.46;
  const ry = H * (0.06 + 0.42 * open); // thin slit when closed, tall when open
  // Maw interior.
  ctx.fillStyle = interiorHex;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Upper teeth — blocky rects hanging from the top lip, clipped to the maw so
  // they curve with it. Hidden until he opens a bit, then grow in.
  const reveal = Math.max(0, (open - 0.15) / 0.85);
  if (teeth > 0 && reveal > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    const span = rx * 2 * 0.9;
    const gap = Math.max(1, span * 0.04);
    const tw = (span - gap * (teeth - 1)) / teeth;
    const th = Math.min(ry * 1.3, H * 0.17) * reveal;
    const topY = cy - ry;
    let x = cx - span / 2;
    ctx.fillStyle = toothHex;
    for (let i = 0; i < teeth; i++) {
      ctx.fillRect(x, topY, tw, th);
      x += tw + gap;
    }
    ctx.restore();
  }
}


// How strongly the camera-follow head aim overrides the ANIMATION's own head
// motion during a reveal, per outcome. 1 = hard overwrite (the clip's head
// track is discarded entirely), 0 = animation wins outright.
//
// 'aligned' can afford a full overwrite: demon_clapping barely moves the head
// (0.9° peak), so pinning it at the player costs nothing. 'missed' cannot —
// a dejected reaction lives in the head drop, and overwriting it leaves him
// upright and eye-contacting the player, which reads as flat. Outcomes absent
// from this map default to 1; 'abstained' never triggers the follow at all.
const REVEAL_HEAD_FOLLOW = { aligned: 1, missed: 0.5 };

// Cat clips during which the head-look-at-camera is allowed to take over.
// Everything else — cat_cleaning_face, cat_scratching_self, any future
// behaviour clip — drives the head itself: cleaning_face brings the head DOWN
// to meet the paw, and pinning it at the camera cancels exactly that motion.
// Allow-list rather than a block-list so new behaviour clips own their head by
// default; only the neutral poses cede it.
// Clips that OWN the head — a paw comes up to meet the face, so a camera
// look-at must yield or the motion is cancelled. Deliberately a BLOCK-list,
// not an allow-list: the cat has to be able to notice the player from whatever
// he happens to be doing (loafing, stretching, walking, mid-transition), so
// head tracking is the default and only these two clips take it back.
const CAT_HEAD_OWNED_RE = /^cat_(cleaning_face|scratching_self)$/i;

// ── Virgil's idle behaviour graph ────────────────────────────────────────
// Derived from the GLB, not guessed: comparing each clip's END pose to every
// other clip's START pose (mean bone-angle delta) shows the cat's clips fall
// into posture groups, and only certain pairs flow without a visible pop.
// Within a group the delta is 0–8°; across groups it's 14–28°, which reads as
// a snap. STANDING is the hub — every other posture is entered and left
// through it.
//
// The transitions are authored ONE WAY only. Nothing flows into cat_loaf
// (14–28° from everything), and cat_sleeping has no exit at all, so the return
// legs replay the same clip time-reversed — the same trick the typing↔idle
// bridges use. `rev: true` means play it backwards.
//
// Regexes not string keys: 'cat_sitting_down ' has a TRAILING SPACE in the GLB.
const CAT_STATES = {
  loaf:     { idle: /^cat_loaf$/i,        actions: [] },
  sitting:  { idle: /^cat_sitting_idle$/i, actions: [/^cat_cleaning_face$/i, /^cat_scratching_self$/i] },
  standing: { idle: /^cat_standing$/i,    actions: [/^cat_meowing$/i] },
  lying:    { idle: /^cat_lying idle$/i,  actions: [] },
  sleeping: { idle: /^cat_sleeping$/i,    actions: [] },
};
// standing → state, and state → standing.
const CAT_ENTER = {
  loaf:     { re: /^cat_loaf_to_stand$/i,   rev: true },
  sitting:  { re: /^cat_sitting_down\s*$/i, rev: false },
  lying:    { re: /^cat_lying down$/i,      rev: false },
  sleeping: { re: /^cat_stand_to_sleep$/i,  rev: false },
};
const CAT_EXIT = {
  loaf:     { re: /^cat_loaf_to_stand$/i,    rev: false },
  sitting:  { re: /^cat_sitting_to_stand$/i, rev: false },
  lying:    { re: /^cat_lying down$/i,       rev: true },
  sleeping: { re: /^cat_stand_to_sleep$/i,   rev: true },
};
// A cat is mostly resting; standing is a brief stopover, not a destination.
const CAT_STATE_WEIGHTS = { loaf: 4, sitting: 4, lying: 2, sleeping: 2, standing: 1 };
const CAT_DWELL_MS = [14000, 32000];  // how long to hold a posture
const CAT_ACTION_CHANCE = 0.55;      // chance of a groom/stretch during a dwell
const CAT_XFADE = 0.35;

// Virgil roams. The four desks sit ~90° apart around the beacon at the model
// origin (measured: Unicorn 52.0°, Demon 141.7°, Monk 233.3°, Detective 320.2°
// — gaps of 91.8/89.7/91.5/86.9°), so the other three perches are just his
// authored transform rotated about Y in quarter turns. Rotating his YAW by the
// same amount matters: without it he'd face outward at three of the four.
const CAT_PERCH_AUTHORED = [1.313975, 0.6785147, 0.4336617];
const CAT_PERCHES = [0, 1, 2, 3].map((k) => {
  const a = (k * Math.PI) / 2;
  const [x, y, z] = CAT_PERCH_AUTHORED;
  return {
    desk: ['RL80', 'Detective', 'Monk', 'Demon'][k], // nearest character, verified
    position: [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)],
    rotationY: a,
  };
});

// Close-up framing for the cat, derived from his LIVE world transform rather
// than baked vectors — he moves, so a static preset would fly the camera to
// wherever he used to be. Camera sits in front of his face (his local +Z,
// which rotates with the perch) at eye height.
// dist = camera distance in front of his face; camY / lookY are heights ABOVE
// Cat_Empty's origin (which sits well below the cat — the node origin is not
// his feet, so these are not intuitive numbers; tune by eye, don't derive).
// lookY must exceed camY or the camera pitches DOWN and shoves him to the top
// of the frame with desk filling the bottom.
const CAT_FOCUS = { dist: 0.75, camY: 0.25, lookY: 0.48 };
// Per-frame ramp for that hand-off. ~0.05/frame ≈ 0.3s to settle, matching the
// cycle's 0.6s crossfade, so entering/leaving a groom doesn't pop.
const CAT_HEAD_FOLLOW_RAMP = 0.05;

const CyborgTempleScene = ({
  onLoad,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1.2, 1.2, 1.2],
  isPlaying = false, 
  currentTrack = null,
  showAnnotations = true,
  is80sMode = false,
  onAnnotationClick = null, // Callback when annotation is clicked
  onAgentClick = null, // Callback when an agent is clicked
  isMobile = false, // Pass this prop to determine device type
  onCoinFaceTap = null, // Callback when a CoinFace is tapped in agents mode (coinIndex)
  templeCandles = [], // Array of claimed candle objects from Firestore templeCandles collection
  disableCandleInteraction = false, // When true, XCandle nodes are not made clickable (no zoom-to-candle, no inspector)
  jackpotOnlyFistPump = false, // When true, FistPump only fires from slotMachineJackpot — removed from Demon's random alternation and the price-poll trigger
  // A PITCH IS HAPPENING — latched from HEAR THE PITCH ▸ until the player leaves.
  // Everything that restages centre stage for the pitcher reads THIS, and reading
  // one signal is what keeps those dressings in sync with each other.
  //
  // Three nearby signals are deliberately NOT used:
  //   gameStarted  — held until START in GameOverlay, which the VC game never
  //                  shows, so it is false for the whole pitch. A SILENT no-op.
  //   pressMode    — true from game SELECTION, so it includes the briefing; the
  //                  room restaged a screen or two before anyone appeared.
  //   the raw floor flag — false at CALL IT, so dressings popped back for the
  //                  slider beat and away again for the reveal.
  pitchStarted = false,
  gameStarted = false, // When true, the focused character is in game-mode idle/typing handoff (vs lobby head-tracking). Held off until the user clicks START in GameOverlay.
  attractMonk = false, // When true (game started AND first-time player), run the monk_hail/monk_beckon attention-getter loop. Returning players (rules already heard) get this set false so GR80 doesn't loop.
  showCharacterHints = false, // When true, render small "?" badges over each agent's head as a tap affordance
  useSitePalForDemon = false, // When true, overlay the SitePal avatar canvas onto the Demon's Face mesh. Parent should mount the SitePal embed into DEMON_SITEPAL_CONTAINER_ID.
  useSitePalForDetective = false, // Same as above, for the Detective character.
  useSitePalForMonk = false, // Same shared SitePal portal, mapped onto Monk_Face2.
  externalFocusAgent = null, // When set, sync internal focus to this agentId — lets the parent (e.g. the consultant railway in /trade) fly the camera to a character without an in-scene click. Pass `null` to clear focus.
  /* THE PARENT OWNS THE CAMERA — set during the VC game, where PressSession
   * drives every cut itself and an in-scene gesture can only get in the way.
   *
   * IT IS A ONE-WAY TRAP WITHOUT THIS, which is the bug it fixes. A click sets
   * focus LOCALLY as well as calling onAgentClick, and during the press game the
   * parent deliberately ignores that callback (externalFocusAgent is pressFocus,
   * not focusedAgent). So the scene zooms out on its own and the sync effect
   * cannot put it back — it early-returns when the prop's VALUE is unchanged
   * (`prev.agentId === externalFocusAgent`), and pressFocus has not changed.
   * Recovery had to wait for the next claim or press: "if i accidentally click
   * the pitchbot, i am zoomed out and can't return" (author, 2026-08-04).
   *
   * Locking the gestures is the right half to disable rather than making the
   * sync effect re-fire on an unchanged value: during the game the room is a
   * stage, not something you browse, and every shot it needs is one the game
   * asks for. Orbit and zoom are untouched — this is only the focus/unfocus
   * gestures. */
  focusLocked = false,
  speechActive = false, // When true, the focused character cross-fades to idle (speaking to player). When false, they cross-fade to typing (looking up info). Parent flips this when game-flow audio starts/ends.
  revealMode = null, // null | 'aligned' | 'missed' | 'abstained'. When set, hides the StageProps collection, flies the camera to the Stage preset, and plays each character's reaction animation. Parent sets this after the verdict is locked; clear it to restore the gameplay scene for the next case.
}) => {
  const groupRef = useRef();
  const { scene, camera, gl } = useThree();
  const hasLoadedRef = useRef(false);
  // Store multiple mixers for each animated character
  const mixersRef = useRef({}); // { characterName: mixer }
  const actionsRef = useRef({}); // { characterName: { animationName: action } }
  const smartPhoneRef = useRef(null); // Demon's SmartPhone prop (Hand_R_1); shown only during demon_phone
  const smartPhoneGateRef = useRef(null); // { action, showTime, hideTime } while demon_phone plays; drives the phone's per-frame visibility window
  const monkCouncilSeqRef = useRef({ active: false, timer: null }); // monk council argue↔standPray alternation
  const demonRevealSeqRef = useRef({ active: false, timer: null }); // demon missed/abstained reaction↔stand-idle alternation
  const catRevealSeqRef = useRef({ active: false, timer: null }); // cat curtain-call sit/groom cycle
  const catBehaviourRef = useRef({ active: false, timer: null, state: 'loaf', goal: null }); // desk-gameplay posture driver
  const catEmptyRef = useRef(null);   // Cat_Empty node, for perch moves + focus framing
  const catPerchRef = useRef(0);      // index into CAT_PERCHES
  const bridgeTimersRef = useRef({}); // { charName: timeoutId } for the typing↔idle bridge hand-off
  const [loadedModel, setLoadedModel] = useState(null);
  const [detectedMobile, setDetectedMobile] = useState(false);
  const xCandleNodesRef = useRef([]); // Sorted array of XCandle01* root nodes
  const cylinderMeshRef = useRef(); // Ref for the specific cylinder mesh
  const object7MeshRef = useRef(); // Ref for Object_5 (was Object_7)
  const cube010MeshRef = useRef(); // Ref for Cube010
  
  // Refs for MOBILE.glb animated objects
  const angelEmptyRef = useRef(); // Parent container for angel and coins
  const angelRef = useRef();
  // Neon sign at scene center, loaded from its own GLB (see NEON_SIGNS) and
  // billboarded toward the camera each frame. _restQuat holds its authored
  // local rotation (the FBX axis-conversion correction), which the billboard
  // math composes with; see the useFrame block.
  const neonSignRef = useRef(null);
  // Optional "Neon_Empty" anchor in the main GLB. When present the sign is
  // parented to it, so its placement stays authorable in Blender; when absent
  // the sign falls back to the transform baked into its own file.
  const neonAnchorRef = useRef(null);
  // Broadcast-beam target — tracks the geometric beacon baked into the scene
  // GLB (captured into beaconRef at load). Renamed from angelSpotTarget: the
  // cherub it used to reference is gone as of v76.
  const beamTarget = useMemo(() => new THREE.Object3D(), []);
  const beaconRef = useRef(null);
  const projectorRef = useRef(null); // hologram-projector base the beam rises from
  const beamTmp = useRef(new THREE.Vector3());
  const beaconContainerRef = useRef(null); // "Empty" parent of the Shape* meshes
  const beaconBaked = useRef(null);        // its baked transform (nudge baseline)
  const laptopCrtRef = useRef(null);       // shared CRT terminal texture for desk laptops
  useEffect(() => () => { laptopCrtRef.current?.dispose?.(); laptopCrtRef.current = null; }, []);
  // Per-character spotlight targets for the curtain call. Positioned at
  // each character's stage-lineup x, mid-chest height, so the spotlights
  // converge on their torsos. Created once and reused via primitive refs.
  // Beam shape for those spotlights. drei's volumetric SpotLight is easy to
  // misread: `distance` sets only the CONE GEOMETRY's length (and the three.js
  // light's range). What you SEE fades to nothing at `attenuation` world units
  // from the light — `vIntensity = 1 - saturate(d / attenuation)` in
  // SpotLightMaterial — so ATTENUATION IS THE BEAM LENGTH KNOB. At the old
  // 3 the shaft died in mid-air above the characters' heads while the 6.5-long
  // cone carried on invisibly. Width comes from `angle`, which also drives
  // drei's default cone radius (`angle * 7`), so narrowing it tightens both the
  // lit pool and the visible shaft.
  const CURTAIN_SPOT = {
    angle: 0.2,        // was 0.42 — a shaft rather than a flare
    penumbra: 0.55,
    intensity: 9,
    distance: 8,       // cone geometry; keep >= attenuation or the beam is cut
    attenuation: 6,    // visible length: light at y=3.4 → past the floor
    anglePower: 6,
    opacity: 0.3,
  };
  const curtainSpotTargets = useMemo(() => [
    { name: 'Monk',      x: -0.75, color: '#8effc4', missColor: '#ff6e6e', neutralColor: '#dceede', ref: new THREE.Object3D() },
    { name: 'Demon',     x: -0.25, color: '#8effc4', missColor: '#ff6e6e', neutralColor: '#dceede', ref: new THREE.Object3D() },
    { name: 'Detective', x:  0.25, color: '#8effc4', missColor: '#ff6e6e', neutralColor: '#dceede', ref: new THREE.Object3D() },
    { name: 'RL80',      x:  0.75, color: '#8effc4', missColor: '#ff6e6e', neutralColor: '#dceede', ref: new THREE.Object3D() },
  ], []);
  const coin1Ref = useRef();
  const coin2Ref = useRef();
  const coin3Ref = useRef();
  const coin4Ref = useRef();
  const coinSpokeRef = useRef(); // Parent group of all coins — rotate this for carousel

  // Camera focus state
  const [focusTarget, setFocusTarget] = useState(null);
  // Beam presets as STATE, not constants, purely so they can be tuned by eye
  // without a reload — BeaconBeam rebuilds its geometry from these props.
  // THE BOT ARRIVES ON ITS OWN GLTF REQUEST, which resolves after the temple's, so
  // effects that stage it must depend on THIS rather than on loadedModel — a late
  // arrival would otherwise miss state that was already set (the visibility effect
  // had exactly that hole: land after pitchStarted flipped and it stayed hidden).
  //
  // DECLARED HERE, NOT BESIDE pitchBotRef further down, and the distinction cost a
  // white screen: a ref read inside an effect BODY is fine at any position because
  // the body runs after render, but anything named in a DEPS ARRAY is evaluated
  // DURING render — so a const declared below the effect is in its TDZ and throws
  // "Cannot access 'pitchBotReady' before initialization". Not a compile error;
  // only the browser shows it.
  const [pitchBotReady, setPitchBotReady] = useState(false);
  // Framing knobs as a REF: read inside the deriver, patched by __pitchBotFrame.
  // A ref rather than state so a nudge doesn't rebuild the deriver callback and
  // strand the focus effect on a stale copy of it.
  /* PER-VARIANT SINCE 2026-08-02. Resolved from the rig that is about to be
   * staged, not from a shared constant — v1 is a chibi bot and v2/v3 are lanky
   * humanoids, and one camera cannot frame both. Safe to read at init: the
   * variant is decided by query/pin/roll synchronously, long before the glb
   * lands. PITCH_BOT_FRAMING below stays as the re-export of the default. */
  const framingRef = useRef(getPitchBotFraming());
  // Mirrored for the externalFocusAgent switch, whose deps are
  // [externalFocusAgent, isMobile, detectedMobile] — the prop itself would be a
  // stale closure in there.
  const pitchStartedRef = useRef(false);
  useEffect(() => { pitchStartedRef.current = !!pitchStarted; }, [pitchStarted]);
  /* Mirrored for the same reason: the pointer/key handlers are bound once in an
   * effect that must not re-run on every prop change (rebinding them mid-gesture
   * drops the gesture), so they read the lock through a ref rather than closing
   * over the prop. See focusLocked. */
  const focusLockedRef = useRef(false);
  useEffect(() => { focusLockedRef.current = !!focusLocked; }, [focusLocked]);
  /* THE BOT IS TALKING RIGHT NOW. Same signal that picks his talking clip, mirrored
   * into a ref so useFrame can read it without re-subscribing every beat. */
  const speechActiveRef = useRef(false);
  /** When the last utterance ENDED. 0 = never spoken, which reads as long ago. */
  const speechEndedAtRef = useRef(0);
  useEffect(() => {
    speechActiveRef.current = !!speechActive;
    if (!speechActive) speechEndedAtRef.current = performance.now();
  }, [speechActive]);

  /* HOW LONG EACH SEAT KEEPS WATCHING after he stops, in ms.
   *
   * TWO JOBS IN ONE TABLE. The floor (~1.5s) stops the heads snapping away the
   * instant a line ends — attention that releases on the exact frame of silence
   * reads as four machines being switched off. The SPREAD stops them releasing in
   * unison, which is the same tell one beat later: people in a room stop paying
   * attention at slightly different moments.
   *
   * NOT IN SEATING ORDER, deliberately. Around a square desk, seating order
   * releases as a visible wave travelling round the table. This ordering is
   * scattered so it reads as four independent attention spans.
   *
   * Also used to stagger the posture handoff, so a given character's head and body
   * give up together rather than at two different times.
   */
  const ATTENTION_RELEASE_MS = { Demon: 1500, RL80: 2350, Monk: 1850, Detective: 2750 };
  const [beamPresets, setBeamPresets] = useState(BEAM_PRESETS);
  // Per-frame multipliers on the beam's authored opacity and height, written by the
  // cast choreography and read inside BeaconBeam's own loop. Refs because props
  // would re-render this entire component once per frame — and height would rebuild
  // the cylinder geometry too. See the note on the props.
  const beamBoostRef = useRef(1);
  const beamHeightRef = useRef(1);
  // SAME LATCH AS THE PAYLOADS. pitchStarted is what hides the sign and shows the
  // bot, so deriving the shaft from it means the beam is never sized for whichever
  // one isn't currently in it.
  const beam = pitchStarted ? beamPresets.pitch : beamPresets.neon;
  // A REF MIRROR, so the tune handle can return the value it just set.
  // Reading it out of the setState updater looked fine and wasn't: React does not
  // promise when an updater runs, so the return was full on one call and
  // `{preset}` only on the next — useless for a handle whose entire job is
  // handing you numbers to paste back into BEAM_PRESETS.
  const beamRef = useRef(BEAM_PRESETS);
  useEffect(() => { beamRef.current = beamPresets; }, [beamPresets]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // No `which` argument -> patch whichever preset is live right now, which is
    // what you want while looking at it.
    window.__pitchBeamTune = (patch = {}, which = null) => {
      const key = which || (pitchStarted ? "pitch" : "neon");
      const next = { ...beamRef.current[key], ...patch };
      beamRef.current = { ...beamRef.current, [key]: next };
      setBeamPresets(beamRef.current);
      return { preset: key, ...next };
    };
    return () => { delete window.__pitchBeamTune; };
  }, [pitchStarted]);
  const ourLadyRef = useRef(); // Reference to RL80 (OurLady) mesh
  const originalCameraPosition = useRef(null); // Store original camera position

  // Dev tuning bridge — lets CameraTuningPanel drive focus directly so values
  // can be dialed in live. Mounted only when ?tune=1 is in the URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes('tune=1')) return;
    window.__cameraTuner = {
      settings: AGENT_CAMERA_SETTINGS,
      mobileOffset: MOBILE_CAMERA_OFFSET,
      // Pass `mobilePreview: true` from the panel to preview the mobile
      // Y-offset without changing the device.
      focusOn: (agentId, mobilePreview = false) => {
        const resolved = resolveAgentSettings(agentId, mobilePreview);
        if (!resolved) return;
        setFocusTarget({
          position: resolved.cameraPos,
          lookAt: resolved.lookAtPos,
          orbitCenter: resolved.orbitCenter,
          agentId,
          agentName: agentId,
        });
      },
      clearFocus: () => setFocusTarget(null),
    };
    return () => {
      if (window.__cameraTuner) delete window.__cameraTuner;
    };
  }, []);

  // Live tuning for the code-made mouth overlay (Path A2). Two jobs:
  //   1. Initialize window.__rl80Mouth so field edits from the console never
  //      hit "undefined".
  //   2. Key nudging so the flat disc can be placed AND aimed by eye. Toggle
  //      with Shift+M (distinct from a plain 'm' mute); when ON:
  //        ← → ↑ ↓  move x / y        [ ]  depth toward/away snout
  //        q a      rotate pitch (X)  w s  rotate yaw (Y)   e d  rotate roll (Z)
  //        - =      width             9 0  open amount (maxH)
  //        Shift = larger step. Each change logs the full config to copy back.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__rl80Mouth = window.__rl80Mouth || {
      ...RL80_MOUTH_DEFAULTS,
      offset: [...RL80_MOUTH_DEFAULTS.offset], // clone so key/console nudging
      rot: [...RL80_MOUTH_DEFAULTS.rot],       // never mutates the shared const
    };
    if (!Array.isArray(window.__rl80Mouth.offset)) window.__rl80Mouth.offset = [...RL80_MOUTH_DEFAULTS.offset];
    if (!Array.isArray(window.__rl80Mouth.rot)) {
      const r0 = typeof window.__rl80Mouth.roll === 'number' ? window.__rl80Mouth.roll : 0;
      window.__rl80Mouth.rot = [0, 0, r0];
    }
    console.log('[rl80Mouth] tuner ready — press Shift+M to toggle key nudging');

    const onKey = (e) => {
      // Toggle FIRST, before the input-focus guard, so Shift+M always works.
      // Match on physical key code (robust across layouts / shift state).
      if (e.code === 'KeyM' && e.shiftKey) {
        window.__rl80MouthTune = !window.__rl80MouthTune;
        console.log('[rl80Mouth] tuning', window.__rl80MouthTune
          ? 'ON — arrows move · [ ] depth · q/a w/s e/d rotate X/Y/Z · - = width · 9 0 open · Shift=bigger'
          : 'OFF');
        e.preventDefault();
        return;
      }
      if (!window.__rl80MouthTune) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const c = window.__rl80Mouth;
      if (!Array.isArray(c.rot)) c.rot = [0, 0, 0];
      const s = e.shiftKey ? 0.02 : 0.005;
      const rs = e.shiftKey ? 15 : 5;
      let handled = true;
      switch (e.key) {
        case 'ArrowRight': c.offset[0] += s; break;
        case 'ArrowLeft':  c.offset[0] -= s; break;
        case 'ArrowUp':    c.offset[1] += s; break;
        case 'ArrowDown':  c.offset[1] -= s; break;
        case ']':          c.offset[2] += s; break;
        case '[':          c.offset[2] -= s; break;
        case 'q':          c.rot[0] += rs; break;   // pitch
        case 'a':          c.rot[0] -= rs; break;
        case 'w':          c.rot[1] += rs; break;   // yaw
        case 's':          c.rot[1] -= rs; break;
        case 'e':          c.rot[2] += rs; break;   // roll
        case 'd':          c.rot[2] -= rs; break;
        case '=':          c.width = Math.max(0.001, (c.width ?? 0.03) + s); break;
        case '-':          c.width = Math.max(0.001, (c.width ?? 0.03) - s); break;
        case '0':          c.maxH = Math.max(0.001, (c.maxH ?? 0.015) + s); break;
        case '9':          c.maxH = Math.max(0.001, (c.maxH ?? 0.015) - s); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        const r = (n) => Math.round(n * 1000) / 1000;
        console.log('[rl80Mouth]', JSON.stringify({
          offset: c.offset.map(r), rot: c.rot.map(r), width: r(c.width ?? 0.03),
          maxH: r(c.maxH ?? 0.015), color: c.color,
        }));
      }
    };
    // Capture phase so we run even if the game/canvas stops key propagation.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Cross-fade a character into either their idle or typing animation.
  // Game-mode focus toggles between these two modes:
  //   • mode='idle'   — character looks at the camera, attentive. Used while
  //                     audio is actively playing (speaking to the player).
  //   • mode='typing' — character looks down at their station, "looking up"
  //                     info. Used between speech beats so they don't just
  //                     stare. Default state on focus before audio starts.
  // Virgil has no idle/typing distinction — his clips just get paused.
  //
  // The Demon's full in-scene focus sequence (idle → pointing → typing) is
  // intentionally NOT replicated for game-mode focus — the user wants every
  // character on idle while speaking; pointing/typing-during-speech is the
  // wrong read.
  // Reaction animation map for the verdict-reveal curtain call. Outcome is
  // the player's result against ground truth: aligned / missed / abstained,
  // plus 'council' — the paid live-argument lineup, shown BEFORE any outcome,
  // so it uses each character's neutral standing pose (no spoiler reaction).
  //
  // EVERY entry must resolve to a full-body STANDING clip: the reveal hides
  // StageProps (desks/chairs), so any seated gameplay clip (*_idle / *_typing,
  // and Detective's seated *_greeting) leaves the character sitting on air.
  // Curtain-call standing clips: cheering / clapping / shrug / disappointed /
  // defeat / standPray.
  //
  // IMPORTANT: every character has ONLY 3 standing clips (Monk only 2 —
  // standPray + cheering), all consumed by aligned/missed/abstained. Their
  // *_pointing/_victory/_fistPump/_greeting/_hail/_beckon/_idle/_typing clips
  // are all SEATED (authored for the desk gameplay — verified by hip height),
  // so they can't be used in the standing lineup.
  //
  // Blender clips this map depends on (authored 2026-07-19+):
  //   • detective_stand / unicorn_stand — neutral STANDING clips (the *_idle
  //     clips are seated gameplay poses). unicorn_stand omits idle/typing/wave
  //     in its name so it won't hijack the gameplay default (line ~2567) or hit
  //     the /wav/i arm-only strip, and won't match restoreCharacterIdle's
  //     /unicorn_idle/i (unicorn drops back to the seated idle after the reveal).
  //   • *_argue — one STANDING "engaged / arguing" clip per character, used
  //     ONLY for 'council' (the pre-outcome paid live-argument lineup) so it
  //     reads distinct from the resigned 'abstained' set. Names omit
  //     idle/typing/wave/stand for the same collision reasons above.
  //   • Any unicorn clip bakes its own hips yaw — author unicorn_stand AND
  //     unicorn_argue facing like unicorn_disappointed/clapping (correct with
  //     Unicorn_Empty at 180°), or the unicorn faces the wrong way.
  // A value may be a single regex or an ORDERED array of fallbacks — the first
  // regex that matches an available clip wins. 'council' lists the (pending)
  // *_argue clip first, then the abstained standing clip, so council gracefully
  // uses the neutral standing pose until the argue clips ship — never falling
  // through to a seated gameplay clip.
  const REACTION_PATTERNS = {
    Monk:      { aligned: /monk_cheering/i,    missed: /monk_standPray/i,      abstained: /monk_standPray/i,   council: [/monk_argue/i, /monk_standPray/i] },
    Demon:     { aligned: /demon_clapping/i,   missed: /demon_disappointed/i,  abstained: /demon_shrug/i,      council: [/demon_phone/i, /demon_shrug/i] },
    Detective: { aligned: /detective_clap/i,   missed: /detective_defeat/i,    abstained: /detective_stand/i,  council: [/detective_argue/i, /detective_stand/i] },
    RL80:      { aligned: /unicorn_clapping/i, missed: /unicorn_disappointed/i, abstained: /unicorn_stand/i,    council: [/unicorn_argue/i, /unicorn_stand/i] },
    // Virgil sits up out of his loaf for the curtain call — same clip for every
    // outcome; the cat has no opinion on the verdict.
    Virgil:    { aligned: /^cat_sitting_idle$/i, missed: /^cat_sitting_idle$/i, abstained: /^cat_sitting_idle$/i, council: /^cat_sitting_idle$/i },
  };

  // Two-clip alternation for the curtain call / council lineups. A single
  // short reaction clip reads as repetitive once it has looped a few times,
  // so the affected outcomes cycle
  //   A (aLoops×) → B (bLoops×) → A (aLoops×) → …
  // Both clips loop continuously; a chained setTimeout crossfades between them
  // after the right number of loops (timing off each clip's duration), so the
  // fades overlap cleanly. Returns false when either clip is missing from the
  // model — callers fall back to a plain looped reaction.
  //
  // TUNING: loop counts are the dwell knob, and they are the RATIO that decides
  // how much of the cycle each clip owns — so they only work as "1× / 2×" when
  // the two clips are comparable lengths. They may be FRACTIONAL: use whole
  // loops for a reaction (cutting a shrug mid-motion looks broken) and a
  // fraction for a long neutral idle (cyclical and low-amplitude, so the
  // crossfade hides the cut). To give a reaction more presence, SHORTEN THE
  // NEUTRAL rather than repeating the reaction — replaying it back-to-back
  // reads as an unnatural double-take. e.g. demon_shrug 2.6s ×1 vs
  // demon_stand_idle 8.37s ×0.5 → 2.0s reaction / 3.6s neutral. The same pair
  // at the inherited ×1 / ×2 gives 2.0s / 16.1s — reaction barely visible.
  const SEQ_XFADE = 0.6; // crossfade seconds
  const stopAlternateSequence = (seqRef) => {
    const seq = seqRef?.current;
    if (!seq) return;
    if (seq.timer) clearTimeout(seq.timer);
    seq.timer = null;
    seq.active = false;
  };
  // Generalised to N steps: each step is {pattern, loops} and the cycle runs
  // step0 -> step1 -> ... -> wrap. Two steps is the common case (Monk council,
  // Demon reveal); the cat uses three.
  const startClipCycle = ({ actions, state, seqRef, steps }) => {
    if (!actions || !state || !seqRef?.current || !steps?.length) return false;

    // Resolve every step up front — if ANY clip is missing, bail entirely so
    // the caller can plain-loop rather than run a half-broken cycle.
    const resolved = [];
    for (const st of steps) {
      const key = Object.keys(actions).find((k) => st.pattern.test(k));
      if (!key) return false;
      resolved.push({ key, action: actions[key], loops: st.loops ?? 1 });
    }
    // Fewer than two DISTINCT clips means there is nothing to cycle between.
    if (new Set(resolved.map((r) => r.key)).size < 2) return false;

    stopAlternateSequence(seqRef);
    const seq = seqRef.current;
    const XF = SEQ_XFADE;

    const play = (action, fadeFrom) => {
      if (fadeFrom && fadeFrom !== action && fadeFrom.isRunning && fadeFrom.isRunning()) {
        fadeFrom.fadeOut(XF);
      }
      action.reset();
      // Skip the bind-pose first frame so the crossfade can't flash a T-pose
      // (same 5% inset applyCharacterReaction uses for single-clip reactions).
      action.time = bindSkipTime(action);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.fadeIn(XF);
      action.play();
    };

    seq.active = true;
    // Hold step i for its loop count, then chain to the next. The crossfade
    // starts XF early so it completes exactly as the loop count is reached.
    const runStep = (i, prevAction) => {
      const cur = resolved[i];
      play(cur.action, prevAction);
      state.currentAnimation = cur.key;
      // Floor at fade-in + a beat at full weight. A 200ms floor let a clip
      // shorter than ~0.8s start fading OUT before its fade-IN had finished,
      // so it never reached weight 1 and barely registered.
      const holdMs = Math.max(
        XF * 1000 + 250,
        (cur.action.getClip().duration * cur.loops - XF) * 1000,
      );
      seq.timer = setTimeout(() => {
        if (!seq.active) return;
        runStep((i + 1) % resolved.length, cur.action);
      }, holdMs);
    };

    // Fade out anything on this character that is not part of the cycle.
    const inCycle = new Set(resolved.map((r) => r.action));
    Object.values(actions).forEach((x) => {
      if (!inCycle.has(x) && x.isRunning && x.isRunning()) x.fadeOut(XF);
    });

    runStep(0, null);
    state.isPlayingSpecial = true;
    state.nextSwitchDelay = 999999;
    state.lastSwitchTime = Date.now();
    return true;
  };

  // Back-compat two-clip wrapper — most callers only alternate A/B.
  const startAlternateSequence = ({
    actions, state, seqRef, aPattern, bPattern, aLoops = 1, bLoops = 2,
  }) => startClipCycle({
    actions, state, seqRef,
    steps: [{ pattern: aPattern, loops: aLoops }, { pattern: bPattern, loops: bLoops }],
  });

  // ── Authored typing↔idle bridges ────────────────────────────────────────
  // Each desk rig ships a 1.03s *_to_idle clip. Crossfading typing→idle
  // directly drags the hands THROUGH the desk mesh; the bridge carries them
  // clear. Authored in the typing→idle direction, so idle→typing plays the
  // same clip time-reversed (timeScale -1, starting at its end).
  //
  // NAMING HAZARD: these names contain BOTH "typing" and "idle", so they match
  // every loop pool and typing/idle lookup in this file — unguarded, a bridge
  // gets randomly picked AS a loop clip and the character twitches on a 1.03s
  // cycle forever. `detective_typing_to_idle` matches the Detective's typing
  // AND idle patterns. Everything that classifies a clip by typing/idle must
  // exclude TRANSITION_RE. The bind-pose-skip pass in useFrame must skip them
  // too — it rewrites action.time every frame, which would pin the one-shot
  // and the bridge would never land.
  // Deliberately NOT a general /_to_\w+$/ — that would swallow the cat's
  // cat_loaf_to_stand / cat_sitting_to_stand / cat_stand_to_sleep, which ARE
  // legitimate members of his behaviour pool.
  const TRANSITION_RE = /_to_(idle|typing)$/i;
  const BRIDGE_PATTERNS = {
    Monk:      /^typing_monk_to_idle$/i,
    Demon:     /^demon_typing_to_idle$/i,
    Detective: /^detective_typing_to_idle$/i,
    RL80:      /^unicorn_typing_to_idle$/i,
  };
  const BRIDGE_XFADE = 0.25;

  // A PERCENTAGE OF DURATION IS THE WRONG UNIT FOR A BIND-POSE SKIP.
  // The 5% inset was written for short Mixamo loops. These clips are 1.4s-16.5s
  // — demon_typing is 16.50s, so 5% seeks 0.825s IN, and measured off the GLB
  // his arms sit 14.9° lower there (79.5° summed over the arm chain). That is
  // the "hands land too low after the transition": the bridge lands exactly on
  // demon_typing frame 0 (verified 0.0°), and then this yanked it forward into
  // a different pose. 0.06s (~2 frames) still clears the bind frame — 0.6°.
  const BIND_SKIP_S = 0.06;
  const bindSkipTime = (action, frac = 0.05) => {
    if (!action || !action.getClip) return 0;
    return Math.min(action.getClip().duration * frac, BIND_SKIP_S);
  };

  // HOW MUCH IS THIS ACTION ACTUALLY CONTRIBUTING TO THE POSE?
  //
  // NOT getEffectiveWeight() on its own — that returns the action's INITIAL
  // weight (1) for a clip that has never been played, so "is anything else
  // holding weight?" answered yes for all ten of the Demon's clips even when
  // exactly one was playing. Only actions the mixer has registered contribute;
  // ask the mixer. (_isActiveAction is private, hence the guarded fallback.)
  const liveWeight = (mixer, a) => {
    if (!a) return 0;
    const active = mixer && typeof mixer._isActiveAction === 'function'
      ? mixer._isActiveAction(a)
      : !!(a.isRunning && a.isRunning());
    if (!active) return 0;
    return typeof a.getEffectiveWeight === 'function' ? a.getEffectiveWeight() : 0;
  };

  // A FINISHED ONE-SHOT IS NOT "RUNNING", BUT IT STILL WEIGHS 1.
  //
  // LoopOnce + clampWhenFinished is how the one-shots hold their final pose:
  // three.js PAUSES the action and leaves its weight alone. isRunning() is
  // false for it, so every `if (isRunning()) fadeOut()` loop in this file walks
  // straight past it and it keeps blending — at full weight, forever. That is
  // how demon_pointing ended up averaged into demon_typing (hands low, and low
  // for the whole focus), and how a stale reaction can lift a seated character.
  // The weight ramp advances while paused, so fadeOut lands without un-pausing.
  const fadeOutOthers = (actions, keep, fade, mixer) => {
    Object.values(actions || {}).forEach((a) => {
      if (!a || a === keep) return;
      if (liveWeight(mixer, a) > 0.001 || (a.isRunning && a.isRunning())) a.fadeOut(fade);
    });
  };

  // FADING IN AGAINST AN EMPTY STACK IS THE T-POSE FLASH. three.js fills any
  // weight it is missing with the BIND pose, and for these rigs that pose is
  // standing, out of the chair, facing off-axis — the "armature rotates 90° out
  // of the seat" flash. If nothing else is holding weight there is nothing to
  // cross-fade against, so snap to full weight instead of ramping from zero.
  // Coverage is measured with liveWeight, NOT getEffectiveWeight: the naive
  // check reported every unplayed clip as weight 1, so "covered" was always
  // true and this never actually snapped — the flash survived the fix.
  const fadeInOrSnap = (action, actions, fade, mixer) => {
    let covered = 0;
    Object.values(actions || {}).forEach((a) => {
      if (a && a !== action) covered += liveWeight(mixer, a);
    });
    // fadeIn always ramps from ZERO, so any shortfall in cover is a gap the
    // bind pose fills. Fully covered → cross-fade normally; otherwise snap to
    // full weight. Over-weighting is invisible (three.js normalises by
    // cumulative weight); under-weighting is the T-pose.
    if (covered >= 0.999) action.fadeIn(fade);
    else action.setEffectiveWeight(1);
  };
  const isTypingClip = (n) => /typ/i.test(n) && !TRANSITION_RE.test(n);
  const isIdleClip = (n) => /idle/i.test(n) && !TRANSITION_RE.test(n);
  // A desk swap is exactly typing→idle or idle→typing; anything else (specials,
  // reactions, the standing curtain-call clips) gets the plain crossfade.
  const isDeskSwap = (fromKey, toKey) =>
    !!fromKey && !!toKey &&
    ((isTypingClip(fromKey) && isIdleClip(toKey)) ||
     (isIdleClip(fromKey) && isTypingClip(toKey)));

  // AUTHORED TRANSITIONS, BY NAMING CONVENTION: `<from>_to_<last segment of
  // destination>`. Nothing is hard-coded per move — export a clip that follows
  // the convention and every swap between those two clips picks it up:
  //   demon_typing   → demon_idle    ⇒ demon_typing_to_idle
  //   demon_pointing → demon_typing  ⇒ demon_pointing_to_typing
  // Both are in the model (v00, 56 clips). Anything that doesn't resolve stays
  // a plain crossfade, so a future export drops in without code changes.
  // Case-insensitive because the unicorn's clips are Unicorn_Typing /
  // Unicorn_Idle but the bridge is Unicorn_typing_to_idle. The Monk's inverted
  // naming (typing_monk → idle_monk) can't resolve — he falls through to
  // BRIDGE_PATTERNS, same clip and direction as before.
  const authoredTransitionFor = (actions, fromKey, toKey) => {
    if (!actions || !fromKey || !toKey) return null;
    const tail = String(toKey).split('_').pop();
    if (!tail) return null;
    const want = `${fromKey}_to_${tail}`.toLowerCase();
    return Object.keys(actions).find((k) => k.toLowerCase() === want) || null;
  };

  const stopBridge = (agentId) => {
    const rec = bridgeTimersRef.current[agentId];
    if (rec && rec.timer) clearTimeout(rec.timer);
    bridgeTimersRef.current[agentId] = null;
  };

  // Gate + play. Bridges ONLY when the move is a real desk swap or has an
  // authored clip for it; everything else falls through to the caller's plain
  // crossfade. Every path that poses a character should go through this rather
  // than repeating the gating — the paths that didn't are why the transitions
  // never played on click.
  const tryDeskBridge = ({ agentId, actions, state, toKey, onSettled }) => {
    if (!actions || !state || !toKey) return false;
    const fromKey = state.currentAnimation;
    const useKey = authoredTransitionFor(actions, fromKey, toKey);
    if (!useKey && !isDeskSwap(fromKey, toKey)) return false;
    return playTypingIdleBridge({ agentId, actions, state, toKey, useKey, onSettled });
  };

  // Play the bridge once, then hand off to the destination loop. Returns true
  // when it took over (caller must NOT also run its own crossfade); false to
  // fall back to the direct swap (clip missing, etc.).
  const playTypingIdleBridge = ({ agentId, actions, state, toKey, onSettled, useKey }) => {
    if (!actions || !state) return false;

    // ADOPT A BRIDGE ALREADY HEADED WHERE WE'RE GOING. A `*_to_*` clip is
    // neither a typing nor an idle clip, so a caller a beat later can't tell by
    // name that one is mid-flight — it used to cross-fade straight over a
    // bridge that had just started. Same destination = let it finish, but take
    // this caller's settle so the focus latch it wanted still happens.
    const inFlight = bridgeTimersRef.current[agentId];
    if (inFlight && inFlight.timer && inFlight.toKey === toKey) {
      if (onSettled) inFlight.onSettled = onSettled;
      return true;
    }

    // An explicitly requested clip that isn't in the model is a caller error,
    // not a reason to substitute the generic connector — the generic one is
    // only correct coming FROM idle, so silently swapping it in is how you get
    // a plausible-but-wrong move.
    let bridgeKey;
    let forward;
    if (useKey) {
      if (!actions[useKey]) return false;
      bridgeKey = useKey;
      forward = true; // authored in the direction we're asking for
    } else {
      const pattern = BRIDGE_PATTERNS[agentId];
      if (!pattern) return false;
      bridgeKey = Object.keys(actions).find((k) => pattern.test(k));
      forward = isIdleClip(toKey); // authored typing→idle; reversed for idle→typing
    }
    const bridge = bridgeKey && actions[bridgeKey];
    const target = actions[toKey];
    if (!bridge || !target || bridge === target) return false;

    const XF = BRIDGE_XFADE;
    const dur = bridge.getClip().duration;

    // FADE OUT ANYTHING STILL HOLDING WEIGHT — running or not.
    //
    // isRunning() is FALSE for a finished LoopOnce+clampWhenFinished one-shot:
    // three.js pauses it and keeps its weight at 1 so the clamped final pose
    // holds. demon_pointing is exactly that. Filtering on isRunning() left it
    // blending at full weight forever, so the bridge and then demon_typing were
    // averaged against an outstretched arm — the hands land low and STAY low
    // for the rest of the focus. The weight ramp still advances while paused
    // (only the clip's own time is frozen), so fadeOut works without
    // un-pausing it.
    const bridgeMixer = mixersRef.current?.[agentId];
    fadeOutOthers(actions, bridge, XF, bridgeMixer);

    bridge.reset();                       // reset() does NOT touch timeScale
    bridge.setLoop(THREE.LoopOnce, 1);
    bridge.clampWhenFinished = true;
    bridge.setEffectiveTimeScale(forward ? 1 : -1);
    bridge.time = forward ? 0 : dur;      // reversed starts at the clip's end
    bridge.setEffectiveWeight(1);
    fadeInOrSnap(bridge, actions, XF, bridgeMixer);
    bridge.play();

    // Park the alternation while the bridge runs, so its own timer can't fire
    // a second switch mid-bridge.
    state.currentAnimation = bridgeKey;
    state.isPlayingSpecial = true;
    state.nextSwitchDelay = 999999;
    state.lastSwitchTime = Date.now();

    stopBridge(agentId);
    // HAND-OFF TIMING IS THE WHOLE BALLGAME FOR AN AUTHORED CLIP. The generic
    // connector hands off at dur-XF so the overlap hides the seam. An authored
    // transition must play to COMPLETION: demon_pointing_to_typing lands on
    // demon_typing's frame 0 exactly, but ~97° of arm travel is still left at
    // dur-XF — cutting there cross-fades a mid-descent arm against the
    // destination, and a weighted blend of two different arm poses is not a
    // valid pose (hands sink through the keyboard).
    const rec = { toKey, onSettled };
    rec.timer = setTimeout(() => {
      bridgeTimersRef.current[agentId] = null;
      target.reset();
      target.setLoop(THREE.LoopRepeat);
      target.setEffectiveWeight(1);
      fadeInOrSnap(target, actions, XF, bridgeMixer);
      target.play();
      bridge.fadeOut(XF);
      state.currentAnimation = toKey;
      state.isPlayingSpecial = false;
      state.lastSwitchTime = Date.now();
      if (rec.onSettled) rec.onSettled();
    }, Math.max(100, (dur - (useKey ? 0 : XF)) * 1000));
    bridgeTimersRef.current[agentId] = rec;

    return true;
  };

  // Close-up pose. Focusing the cat used to PAUSE every clip ("eliminates
  // loop-seam glitch" — a workaround from when he was set dressing with a
  // single sit_idle). He's a guide character now: a frozen body with a
  // camera-tracking head reads as broken, so sit him up and let him breathe.
  // cat_sitting_idle is also in CAT_HEAD_FREE_RE, so head tracking is allowed.
  // Walk the posture graph to `target`, then run `done`. Clicking the cat used
  // to hard-cut to cat_sitting_idle from whatever posture he was in — measured
  // 14–25° between posture groups, which reads as a twitch. Guarded against
  // re-entry because BOTH focus paths fire (the in-scene click sets focus
  // locally, and the parent's externalFocusAgent round-trip fires it again a
  // frame later); without the guard the second call restarts the transition.
  const catTransitionTo = (target, done) => {
    const b = catBehaviourRef.current;
    if (b.goal === target) return; // already on the way
    b.goal = target;
    if (b.timer) clearTimeout(b.timer);
    b.timer = null;
    const later = (ms, fn) => { b.timer = setTimeout(fn, Math.max(60, ms)); };
    const land = () => { b.goal = null; b.state = target; if (done) done(); };
    if (b.state === target) return land();
    const exit = b.state === 'standing' ? null : CAT_EXIT[b.state];
    const enter = target === 'standing' ? null : CAT_ENTER[target];
    const doEnter = () => {
      if (!enter) return land();
      const ms = playCatClip(enter.re, { rev: enter.rev });
      if (!ms) return land();
      later(ms - CAT_XFADE * 1000, land);
    };
    if (!exit) return doEnter();
    const ms = playCatClip(exit.re, { rev: exit.rev });
    if (!ms) return doEnter();
    later(ms - CAT_XFADE * 1000, doEnter);
  };

  // The player clicked the cat. Do NOT interrupt whatever he's doing — the
  // head-track does the noticing, and he carries on with his life. Two clips
  // can't express noticing, so those are the only ones that get interrupted:
  //   • cat_cleaning_face — a paw is over his face; it also OWNS the head
  //     (CAT_HEAD_OWNED_RE), so he physically cannot look up. Swap to
  //     cat_sitting_idle: same posture group, 0° apart, so it crossfades with
  //     no pop.
  //   • sleeping — he's asleep. Wake him through the authored graph.
  // Everything else (loaf, sitting, standing, lying, walking, stretching,
  // mid-transition) is left completely alone.
  const catNoticeUser = () => {
    const actions = actionsRef.current['Virgil'];
    if (!actions) return;
    Object.values(actions).forEach((a) => { a.paused = false; });
    const b = catBehaviourRef.current;
    const cur = virgilAnimStateRef.current?.currentAnimation || '';

    if (/^cat_cleaning_face$/i.test(cur)) {
      playCatClip(CAT_STATES.sitting.idle, { loop: true });
      return;
    }
    if (b.state === 'sleeping') {
      stopCatBehaviour();
      catTransitionTo('sitting', () => {
        playCatClip(CAT_STATES.sitting.idle, { loop: true });
        if (!revealModeRef.current) startCatBehaviour('sitting');
      });
    }
    // else: no animation change at all.
  };

  // ── Virgil's desk-gameplay behaviour driver ───────────────────────────
  // Walks the posture graph above: hold a posture (looping its idle, with an
  // occasional one-shot groom/stretch), then move to another posture via the
  // authored transitions, routing through STANDING because that's the only hub
  // the clips connect through. Runs ONLY during normal gameplay — the curtain
  // call and the focus close-up each own the cat while they're active.
  const catActionKey = (re) => {
    const actions = actionsRef.current['Virgil'];
    if (!actions) return null;
    return Object.keys(actions).find((k) => re.test(k)) || null;
  };

  // Play one cat clip. `rev` runs it backwards (for the unauthored return
  // legs). Returns its duration in ms, or 0 if the clip is missing.
  const playCatClip = (re, { rev = false, loop = false } = {}) => {
    const actions = actionsRef.current['Virgil'];
    const key = catActionKey(re);
    if (!actions || !key) return 0;
    const action = actions[key];
    const dur = action.getClip().duration;
    // Already looping this exact clip — re-playing it would reset() and hitch.
    if (loop && virgilAnimStateRef.current?.currentAnimation === key
        && action.isRunning && action.isRunning() && !action.paused) {
      return dur * 1000;
    }
    // Virgil is the character MOST exposed to the clamped-one-shot trap: his
    // whole behaviour is a graph of one-shot transitions (loaf_to_stand,
    // sitting_down, stand_to_sleep…) each followed by a looping idle, and every
    // one of them is LoopOnce + clampWhenFinished below. A finished one is
    // PAUSED but still weighs 1, so an isRunning()-only fade left it averaging
    // 50/50 with the idle that followed — the cat half-lying, half-sitting, and
    // only "sometimes" because it needs a transition to have just run.
    const catMixer = mixersRef.current?.['Virgil'];
    fadeOutOthers(actions, action, CAT_XFADE, catMixer);
    action.reset();
    action.paused = false;
    if (loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.time = bindSkipTime(action); // skip the bind-pose frame
      action.setEffectiveTimeScale(1);
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.setEffectiveTimeScale(rev ? -1 : 1);
      action.time = rev ? dur : 0;
    }
    action.setEffectiveWeight(1);
    fadeInOrSnap(action, actions, CAT_XFADE, catMixer);
    action.play();
    if (virgilAnimStateRef.current) virgilAnimStateRef.current.currentAnimation = key;
    return dur * 1000;
  };

  const stopCatBehaviour = () => {
    const b = catBehaviourRef.current;
    if (b.timer) clearTimeout(b.timer);
    b.timer = null;
    b.active = false;
    b.goal = null;
  };

  const startCatBehaviour = (fromState = 'loaf') => {
    const b = catBehaviourRef.current;
    stopCatBehaviour();
    if (!actionsRef.current['Virgil']) return;
    b.active = true;
    b.state = fromState;
    b.goal = null;

    const later = (ms, fn) => {
      b.timer = setTimeout(() => { if (b.active) fn(); }, Math.max(60, ms));
    };

    const pickNextState = () => {
      const pool = Object.entries(CAT_STATE_WEIGHTS).filter(([k]) => k !== b.state);
      const total = pool.reduce((n, [, w]) => n + w, 0);
      let r = Math.random() * total;
      for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
      return pool[0][0];
    };

    // Hold the current posture: loop its idle, maybe insert one action clip,
    // then transition somewhere else.
    const dwell = () => {
      const st = CAT_STATES[b.state];
      if (!st) { b.state = 'standing'; return dwell(); }
      playCatClip(st.idle, { loop: true });
      const hold = CAT_DWELL_MS[0] + Math.random() * (CAT_DWELL_MS[1] - CAT_DWELL_MS[0]);
      const act = st.actions[Math.floor(Math.random() * st.actions.length)];
      if (act && Math.random() < CAT_ACTION_CHANCE) {
        // Idle for a beat, run the action once, settle back to idle, then move.
        later(hold * 0.45, () => {
          const ms = playCatClip(act) || 0;
          later(ms, () => {
            playCatClip(st.idle, { loop: true });
            later(hold * 0.45, transition);
          });
        });
      } else {
        later(hold, transition);
      }
    };

    // Route to a new posture through STANDING (the only hub the clips connect
    // through), skipping legs that aren't needed.
    const transition = () => {
      const next = pickNextState();
      const exit = b.state === 'standing' ? null : CAT_EXIT[b.state];
      const enter = next === 'standing' ? null : CAT_ENTER[next];
      const land = () => { b.state = next; dwell(); };
      const doEnter = () => {
        if (!enter) return land();
        const ms = playCatClip(enter.re, { rev: enter.rev });
        if (!ms) return land();
        later(ms - CAT_XFADE * 1000, land);
      };
      if (!exit) return doEnter();
      const ms = playCatClip(exit.re, { rev: exit.rev });
      if (!ms) return doEnter();
      later(ms - CAT_XFADE * 1000, doEnter);
    };

    dwell();
  };

  // Move Virgil to one of the four desks. Pass an index, or omit for a random
  // desk other than the one he's on (he should visibly relocate, not re-pick
  // the same spot). Safe to call before the model loads — it no-ops.
  const applyCatPerch = (index) => {
    const cat = catEmptyRef.current;
    if (!cat) return;
    let k = index;
    if (k === undefined) {
      // Random OTHER desk: pick from the 3 remaining so he always moves.
      const others = CAT_PERCHES.map((_, i) => i).filter((i) => i !== catPerchRef.current);
      k = others[Math.floor(Math.random() * others.length)];
    }
    const perch = CAT_PERCHES[k];
    if (!perch) return;
    cat.position.set(...perch.position);
    cat.rotation.y = perch.rotationY;
    catPerchRef.current = k;
  };

  // Camera framing for a cat close-up, computed from where he actually IS.
  // Used by both focus paths (in-scene click and externalFocusAgent) so the
  // parent can introduce him without knowing which desk he wandered to.
  const getCatFocusSettings = () => {
    const cat = catEmptyRef.current;
    if (!cat) return null;
    cat.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    cat.getWorldPosition(pos);
    cat.getWorldQuaternion(quat);
    // His face is local +Z (same axis the reveal lineup leaves at yaw 0).
    // Flatten to horizontal so the camera doesn't pitch with any rig tilt.
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    return {
      cameraPos: pos.clone().addScaledVector(fwd, CAT_FOCUS.dist).setY(pos.y + CAT_FOCUS.camY),
      lookAtPos: pos.clone().setY(pos.y + CAT_FOCUS.lookY),
      orbitCenter: null,
    };
  };

  // Monk council alternation: monk_argue (1×) → monk_standPray (2×) → …
  const stopMonkArgueSequence = () => stopAlternateSequence(monkCouncilSeqRef);
  const startMonkArgueSequence = () => startAlternateSequence({
    actions: actionsRef.current['Monk'],
    state: monkAnimStateRef.current,
    seqRef: monkCouncilSeqRef,
    aPattern: /monk_argue/i,
    bPattern: /monk_standPray/i,
    aLoops: 1,
    bLoops: 2,
  });

  // Demon curtain-call alternation. demon_disappointed / demon_shrug are short
  // and read as repetitive looping on their own, so 'missed' and 'abstained'
  // cycle  reaction (1×) → demon_stand_idle (2×) → reaction (1×) → …
  // giving him a beat of stillness between reactions.
  //
  // The neutral clip is matched as /demon_stand/i so it resolves whether it
  // exports as demon_stand_idle or demon_stand. It is NOT in the model as of
  // RL80_4anims_v92 — until it is, startAlternateSequence returns false and
  // applyCharacterReaction falls through to the existing plain single-clip
  // loop, so this is a no-op rather than a break.
  //
  // NAMING: an "idle" in the name collides with the seated gameplay rotation
  // (the loop pool filters on /typing|idle/i), so the pool explicitly excludes
  // /stand/i — see the Demon alternation block in useFrame.
  const DEMON_STAND_IDLE_RE = /demon_stand/i;
  const DEMON_SEQ_PATTERNS = {
    missed:    /demon_disappointed/i,
    abstained: /demon_shrug/i,
  };

  // Virgil's curtain-call loop: he sits, washes his face, has a scratch, and
  // goes back to sitting. Same cycle for every outcome — the cat has no
  // opinion on the verdict. Durations are 11.67 / 5.70 / 2.90s, so one pass of
  // each is a ~20s cycle that's ~58% sitting; grooming reads as punctuation
  // rather than a busy animal. Falls back to a plain cat_sitting_idle loop if
  // any clip is missing.
  const CAT_REVEAL_CYCLE = [
    { pattern: /^cat_sitting_idle$/i,   loops: 1 },
    { pattern: /^cat_cleaning_face$/i,  loops: 1 },
    { pattern: /^cat_sitting_idle$/i,   loops: 1 },
    { pattern: /^cat_scratching_self$/i, loops: 1 },
  ];

  const applyCharacterReaction = (agentId, outcome) => {
    // console.log('[reaction-debug] entered', { agentId, outcome });
    const pattern = REACTION_PATTERNS[agentId]?.[outcome];
    // No pattern for this outcome (e.g. the neutral 'council' lineup) — line the
    // character up with no reaction anim rather than crashing on .test() below.
    if (!pattern) return;
    const actions = actionsRef.current[agentId];
    const state = (
      agentId === 'Monk'      ? monkAnimStateRef.current      :
      agentId === 'Demon'     ? demonAnimStateRef.current     :
      agentId === 'Detective' ? detectiveAnimStateRef.current :
      agentId === 'RL80'      ? rl80AnimStateRef.current      :
      agentId === 'Virgil'    ? virgilAnimStateRef.current    :
      agentId === 'PitchBot'  ? pitchBotAnimStateRef.current  : null
    );
    if (!actions || !state) {
      // console.log('[reaction-debug] missing actions or state', { agentId, hasActions: !!actions, hasState: !!state });
      return;
    }
    // pattern is a single regex or an ordered array of fallbacks — first match wins.
    const patternList = Array.isArray(pattern) ? pattern : [pattern];
    let targetKey;
    for (const re of patternList) {
      targetKey = Object.keys(actions).find((a) => re.test(a));
      if (targetKey) break;
    }
    if (!targetKey) {
      console.log('[reaction-debug] pattern not matched for', agentId, outcome, 'available:', Object.keys(actions));
      return;
    }
    // Demon's SmartPhone prop only appears while he's actually holding it up.
    // demon_phone is a long looping clip (30fps) where the phone is raised only
    // for frames 35–1076; outside that window (and during every other Demon
    // clip) it's hidden. Arm a per-frame visibility gate (driven in useFrame);
    // any non-phone clip clears it.
    if (agentId === 'Demon' && smartPhoneRef.current) {
      if (/demon_phone/i.test(targetKey)) {
        const tt = actions[targetKey].getClip().tracks[0]?.times;
        const fps = (tt && tt.length > 1) ? 1 / (tt[1] - tt[0]) : 30;
        smartPhoneGateRef.current = {
          action: actions[targetKey],
          showTime: 35 / fps,
          hideTime: 1076 / fps,
        };
      } else {
        smartPhoneGateRef.current = null;
      }
      // useFrame drives the actual visibility; hide now to avoid a 1-frame flash.
      smartPhoneRef.current.visible = false;
    }
    // console.log('[reaction-debug] resolved', {
    //   agentId, outcome, targetKey,
    //   prevKey: state.currentAnimation,
    //   availableKeys: Object.keys(actions),
    //   runningBefore: Object.entries(actions).filter(([, a]) => a.isRunning && a.isRunning()).map(([k]) => k),
    // });

    // Shut down any character-specific attention-getting cycle so the reaction
    // isn't immediately overwritten. In particular the Monk's hail/beckon/idle
    // loop schedules setTimeouts that explicitly play idle_monk and reset
    // isPlayingSpecial=false; those timeouts already check hasBeenFocused and
    // early-return, so latching it here neutralizes them.
    if (agentId === 'Monk' && monkWaveStateRef.current) {
      monkWaveStateRef.current.hasBeenFocused = true;
      monkWaveStateRef.current.attentionActive = false;
    }
    if (agentId === 'RL80' && unicornWaveStateRef.current) {
      if (unicornWaveStateRef.current.timeoutId) {
        clearTimeout(unicornWaveStateRef.current.timeoutId);
        unicornWaveStateRef.current.timeoutId = null;
      }
    }
    // Demon's focus sequence (idle → pointing → typing) schedules setTimeouts
    // and a mixer 'finished' listener that settle it back into demon_typing.
    // If the verdict was committed while Demon was focused, those fire during
    // the reveal and clobber the reaction. Cancel them so the reaction sticks.
    if (agentId === 'Demon' && demonAnimStateRef.current) {
      const ds = demonAnimStateRef.current;
      if (Array.isArray(ds.focusSequenceTimers)) {
        ds.focusSequenceTimers.forEach((t) => clearTimeout(t));
        ds.focusSequenceTimers = [];
      }
      if (ds.focusSequenceListener && mixersRef.current['Demon']) {
        mixersRef.current['Demon'].removeEventListener('finished', ds.focusSequenceListener);
        ds.focusSequenceListener = null;
      }
    }

    // Focusing the cat pauses every one of his actions (see
    // applyCharacterFocusAnimation) — a paused action still blends its frozen
    // pose but never advances, so the reaction would sit dead. Un-pause first.
    if (agentId === 'Virgil') {
      Object.values(actions).forEach((a) => { a.paused = false; });
    }

    // A typing↔idle bridge may still be mid-flight with a pending hand-off
    // timer; it would fire during the curtain call and overwrite the reaction.
    stopBridge(agentId);

    // Monk in council, and the Demon on missed/abstained, get a two-clip
    // alternation instead of a plain loop. If it can't run (missing a clip),
    // tear down any stale sequence and fall through to the normal single-clip
    // play below.
    if (agentId === 'Monk') {
      if (outcome === 'council' && startMonkArgueSequence()) return;
      stopMonkArgueSequence();
    }
    if (agentId === 'Virgil') {
      stopCatBehaviour(); // curtain call owns the cat while it runs
      if (startClipCycle({
        actions,
        state,
        seqRef: catRevealSeqRef,
        steps: CAT_REVEAL_CYCLE,
      })) return;
      stopAlternateSequence(catRevealSeqRef);
    }
    if (agentId === 'Demon') {
      const seqPattern = DEMON_SEQ_PATTERNS[outcome];
      if (seqPattern && startAlternateSequence({
        actions,
        state,
        seqRef: demonRevealSeqRef,
        aPattern: seqPattern,
        bPattern: DEMON_STAND_IDLE_RE,
        // demon_shrug / demon_disappointed are 2.6s; demon_stand_idle is 8.37s.
        // ONE full reaction (2.0s) against half an idle (3.6s) — a 5.6s cycle,
        // reaction ~36% of it. 2× reaction read as an unnatural double-take,
        // and the inherited 1×/2× buried it under 16s of idle. Shortening the
        // NEUTRAL is the knob here, not repeating the reaction — see the
        // TUNING note on startAlternateSequence.
        aLoops: 1,
        bLoops: 0.5,
      })) return;
      stopAlternateSequence(demonRevealSeqRef);
    }

    const targetAction = actions[targetKey];
    // Fade out every running action on this character, not just the one
    // tracked in state.currentAnimation. Other cycles' setTimeouts can leave
    // actions running that aren't reflected in state, and those would blend
    // on top of the reaction and dominate (idle's explicit leg rotations
    // beat the cheering animation's near-identity ones).
    fadeOutOthers(actions, targetAction, 0.5, mixersRef.current?.[agentId]);
    targetAction.reset();
    targetAction.time = bindSkipTime(targetAction);
    targetAction.setLoop(THREE.LoopRepeat);
    targetAction.setEffectiveWeight(1);
    fadeInOrSnap(targetAction, actions, 0.5, mixersRef.current?.[agentId]);
    targetAction.play();
    state.currentAnimation = targetKey;
    state.isPlayingSpecial = true;
    state.nextSwitchDelay = 999999;
    state.lastSwitchTime = Date.now();

    // Sanity check 250ms and 1500ms after play(). At 250ms we should see the
    // crossfade in progress; at 1500ms (after the 0.5s fade completes plus a
    // buffer for any pending setTimeouts to fire) only the reaction should be
    // running at weight 1. Anything else running at 1500ms is a competitor.
    const dumpRunning = (label, delay) => setTimeout(() => {
      const running = Object.entries(actions)
        .filter(([, a]) => a.isRunning && a.isRunning())
        .map(([k, a]) => `${k}=w${a.getEffectiveWeight().toFixed(2)}@t${a.time.toFixed(2)}`)
        .join(' | ');
      // console.log(`[reaction-debug] ${label} ${agentId}/${targetKey} →`, running);
    }, delay);
    dumpRunning('250ms', 250);
    dumpRunning('1500ms', 1500);
  };

  // Restore a character to their default idle loop after the curtain call.
  // Reverses the latching done by applyCharacterReaction so the regular
  // animation alternation picks back up once revealMode clears — without
  // this, BACK TO SERVICES leaves each character stuck on their reaction
  // (state.isPlayingSpecial stays true, nextSwitchDelay = 999999).
  const IDLE_PATTERNS = {
    Monk:      /idle_monk/i,
    Demon:     /demon_idle/i,
    Detective: /detective_idle/i,
    RL80:      /unicorn_idle/i,
    Virgil:    /^cat_loaf$/i,
  };
  const restoreCharacterIdle = (agentId) => {
    stopBridge(agentId); // no stale bridge hand-off after the curtain call
    // Cat sit/groom cycle chains setTimeouts — kill it or it keeps flipping
    // clips after the reveal and overwrites the restored cat_loaf.
    if (agentId === 'Virgil') stopAlternateSequence(catRevealSeqRef);
    // Leaving the reveal — always stow the Demon's phone (it only shows during
    // demon_phone). Done before the guards so it hides even if idle can't resolve.
    if (agentId === 'Demon') {
      // Also tear down the missed/abstained reaction↔stand-idle alternation —
      // its chained setTimeout would otherwise keep flipping clips after the
      // reveal, clobbering the idle restored below.
      stopAlternateSequence(demonRevealSeqRef);
      smartPhoneGateRef.current = null;
      if (smartPhoneRef.current) smartPhoneRef.current.visible = false;
    }
    // Tear down the Monk's council argue↔standPray alternation (its mixer
    // 'finished' listener would otherwise keep flipping clips after the reveal).
    if (agentId === 'Monk') stopMonkArgueSequence();
    const pattern = IDLE_PATTERNS[agentId];
    const actions = actionsRef.current[agentId];
    const state = (
      agentId === 'Monk'      ? monkAnimStateRef.current      :
      agentId === 'Demon'     ? demonAnimStateRef.current     :
      agentId === 'Detective' ? detectiveAnimStateRef.current :
      agentId === 'RL80'      ? rl80AnimStateRef.current      :
      agentId === 'Virgil'    ? virgilAnimStateRef.current    :
      agentId === 'PitchBot'  ? pitchBotAnimStateRef.current  : null
    );
    if (!pattern || !actions || !state) return;
    const idleKey = Object.keys(actions).find((a) => pattern.test(a));
    if (!idleKey) return;
    const idleAction = actions[idleKey];
    fadeOutOthers(actions, idleAction, 0.4, mixersRef.current?.[agentId]);
    idleAction.reset();
    idleAction.setLoop(THREE.LoopRepeat);
    idleAction.setEffectiveWeight(1);
    fadeInOrSnap(idleAction, actions, 0.4, mixersRef.current?.[agentId]);
    idleAction.play();
    state.currentAnimation = idleKey;
    state.isPlayingSpecial = false;
    state.nextSwitchDelay = 0;
    state.lastSwitchTime = Date.now();
    // Hand the cat back to his roaming behaviour once the curtain call has
    // put him back in the loaf.
    if (agentId === 'Virgil' && !virgilFocusedRef.current) startCatBehaviour('loaf');
  };

  // `releaseAfter` — hand the character back to the random alternation once the
  // swap has SETTLED instead of pinning them. It has to be an option rather
  // than something the caller does afterwards: when a bridge takes the swap,
  // "afterwards" is ~1s early, and the bridge parks nextSwitchDelay at 999999
  // without restoring it — un-pinning synchronously freezes the character on
  // one clip for 16 minutes.
  /* ── THE ROOM WATCHES THE PITCH ──────────────────────────────────────────
   *
   * While a pitch is running, the four analysts turn from the camera to the
   * pitcher. Everything needed already existed: each character's head is aimed
   * by ONE shared formulation (dummy.lookAt -> local delta -> YXZ clamp -> zero
   * roll; see the note on the Detective's block, which records that her bespoke
   * version was the bug), and every one of those call sites hard-coded
   * `camera.position` as the target. This swaps the target, and nothing else.
   *
   * AIMED AT THE BOT'S HEAD, NOT ITS ORIGIN. The rig's origin sits at its feet
   * — that is what lets `fitHeight` scale it about the floor — so aiming at the
   * object would have four characters staring at the projector plate.
   *
   * THE HEAD BONE IS FOUND ONCE AND CACHED, by name, tolerating both naming
   * conventions in the roster: v1 calls it `head`, the Mixamo rigs call it
   * `mixamorigHead`. `/head$/i` catches both and misses `mixamorigHeadTop_End`.
   *
   * FALLS BACK TO THE CAMERA whenever there is no pitch, no bot, or the bot is
   * hidden — so the lobby behaviour is byte-for-byte what it was.
   */
  const _attentionTarget = useRef(new THREE.Vector3());
  /** Debug force: true = always watch, false = never, null = follow the pitch. */
  const attentionOverrideRef = useRef(null);
  const resolveAttentionTarget = useCallback((camera, isFocused = false) => {
    // A SELECTED SEAT IS BEING ADDRESSED, not listening — they were sent to look
    // something up and are reporting back, so they face the player. Passed in per
    // call site rather than read here, because "focused" is a different ref for
    // each character and the Demon's is a head-tracking flag rather than a focus one.
    if (isFocused) return camera.position;
    const on = attentionOverrideRef.current === true
      || (attentionOverrideRef.current === null && pitchStartedRef.current && speechActiveRef.current);
    const bot = pitchBotRef.current;
    if (!on || !bot || !bot.visible) return camera.position;

    let head = bot.userData.__attnHead;
    if (head === undefined) {
      head = null;
      bot.traverse((o) => { if (!head && /head$/i.test(o.name)) head = o; });
      bot.userData.__attnHead = head;
    }
    if (!head) return camera.position;

    head.getWorldPosition(_attentionTarget.current);
    return _attentionTarget.current;
  }, []);

  const applyCharacterFocusAnimation = (agentId, mode = 'idle', { releaseAfter = false } = {}) => {
    const settle = (state) => {
      if (releaseAfter) {
        // Back to the per-character alternation blocks in useFrame.
        state.isPlayingSpecial = false;
        state.nextSwitchDelay = Math.random() * 8000 + 8000;
      } else {
        // Pause the random-rotation alternation while focused so the chosen
        // clip stays in place (no surprise disbelief/fistpump interruptions).
        state.isPlayingSpecial = true;
        state.nextSwitchDelay = 999999;
      }
      state.lastSwitchTime = Date.now();
    };

    const crossfadeTo = (actions, state, pattern) => {
      if (!actions || !state) return;
      // Never resolve a focus pose to a one-shot bridge (their names contain
      // both "typing" and "idle", so they match several of these patterns).
      const targetKey = Object.keys(actions).find((a) => pattern.test(a) && !TRANSITION_RE.test(a));
      if (!targetKey) {
        console.warn('[focus anim] pattern not matched for', agentId, mode, 'available:', Object.keys(actions));
        return;
      }
      const targetAction = actions[targetKey];
      const prevAction = actions[state.currentAnimation];
      const alreadyOn =
        state.currentAnimation === targetKey &&
        targetAction.isRunning && targetAction.isRunning();
      if (!alreadyOn) {
        // THE FOCUSED LOBBY STATE GOES THROUGH HERE. Clicking a character to
        // hear their intro, and that line ending, both land in this function —
        // which is why the transitions "played sometimes but never after I
        // click": the bridges only ran from the idle alternation blocks, and
        // every focus-driven swap took the plain crossfade below, dragging the
        // hands through the desk.
        const bridged = tryDeskBridge({
          agentId,
          actions,
          state,
          toKey: targetKey,
          onSettled: () => settle(state),
        });
        if (bridged) return; // the bridge owns this swap, settle included
        // Not just prevAction: anything still weighted has to go, or a
        // finished one-shot keeps averaging into the pose (see fadeOutOthers).
        fadeOutOthers(actions, targetAction, 0.5, mixersRef.current?.[agentId]);
        targetAction.reset();
        // Skip bind-pose first frame so the cross-fade doesn't flash T-pose.
        targetAction.time = bindSkipTime(targetAction);
        targetAction.setLoop(THREE.LoopRepeat);
        targetAction.setEffectiveWeight(1);
        fadeInOrSnap(targetAction, actions, 0.5, mixersRef.current?.[agentId]);
        targetAction.play();
        state.currentAnimation = targetKey;
      }
      settle(state);
    };

    if (agentId === 'Monk') {
      const pattern = mode === 'idle' ? /idle_monk/i : /typing_monk/i;
      crossfadeTo(actionsRef.current['Monk'], monkAnimStateRef.current, pattern);
    } else if (agentId === 'Demon') {
      // /demon_idle/ not /demon.*idle/ — the latter also matches the standing
      // curtain-call neutral (demon_stand_idle), which would seat him wrong.
      const pattern = mode === 'idle' ? /demon_idle/i : /demon.*typ/i;
      crossfadeTo(actionsRef.current['Demon'], demonAnimStateRef.current, pattern);
    } else if (agentId === 'Detective') {
      const pattern = mode === 'idle' ? /detective.*idle/i : /detective.*typ/i;
      crossfadeTo(actionsRef.current['Detective'], detectiveAnimStateRef.current, pattern);
    } else if (agentId === 'RL80') {
      // RL80 falls back to the other mode's pattern if her preferred clip
      // isn't authored (some rigs only ship idle, not typing or vice versa).
      const rl80Actions = actionsRef.current['RL80'];
      if (rl80Actions) {
        const animKeys = Object.keys(rl80Actions);
        const idlePat = /(?:^|_)idle/i;
        const typingPat = /(?:^|_)typing/i;
        const wantIdle = mode === 'idle';
        const hasIdle = animKeys.some((a) => idlePat.test(a));
        const hasTyping = animKeys.some((a) => typingPat.test(a));
        const pattern = wantIdle
          ? (hasIdle ? idlePat : typingPat)
          : (hasTyping ? typingPat : idlePat);
        crossfadeTo(rl80Actions, rl80AnimStateRef.current, pattern);
      }
    } else if (agentId === 'Virgil') {
      // Virgil has no idle/typing distinction — pause all clips so the cat
      // sits still during the close-up (eliminates loop-seam glitch).
      catNoticeUser(); // head-track does the noticing; his behaviour continues
    }
  };

  // Release the focus latch once a lobby intro line has finished. Reverses
  // the pinning applied by applyCharacterFocusAnimation (isPlayingSpecial +
  // nextSwitchDelay 999999): cross-fade back to the working clip, then hand
  // control to the random typing↔idle alternation so the character goes back
  // to their station instead of holding an attentive idle at the camera for
  // as long as they stay focused. The head-track release is separate — see
  // shouldTrackHeadRef, which reads the same lobbyIntroDone flag.
  const releaseCharacterFocusAnimation = (agentId) => {
    focusAnimReleasedRef.current = true;
    if (agentId === 'Virgil') {
      // Virgil is frozen (not cross-faded) while focused — just let the cat
      // move again; there's no alternation state to restore.
      const virgilActions = actionsRef.current['Virgil'];
      if (virgilActions) {
        Object.values(virgilActions).forEach((action) => { action.paused = false; });
      }
      return;
    }
    // releaseAfter un-latches inside the settle, so when the idle→typing
    // bridge takes this swap the character isn't handed back to the
    // alternation until they've actually reached the keys. Undoing the latch
    // out here (as this used to) fired ~1s early, while the bridge still had
    // nextSwitchDelay parked at 999999 — and the bridge's own hand-off then
    // wrote that stale value back, freezing them on one clip for 16 minutes.
    applyCharacterFocusAnimation(agentId, 'typing', { releaseAfter: true });

    // SAFETY NET. settle() is what un-pins now, and it doesn't run if the swap
    // never happened (actions not loaded yet, pattern unmatched) — which would
    // leave the character pinned with nextSwitchDelay 999999. Skipped while a
    // bridge is in flight: its hand-off owns the release and firing here would
    // un-pin ~1s early, exactly the bug this option exists to avoid.
    if (bridgeTimersRef.current[agentId]) return;
    const state = (
      agentId === 'Monk'      ? monkAnimStateRef.current      :
      agentId === 'Demon'     ? demonAnimStateRef.current     :
      agentId === 'Detective' ? detectiveAnimStateRef.current :
      agentId === 'RL80'      ? rl80AnimStateRef.current      : null
    );
    if (!state || !state.isPlayingSpecial) return;
    state.isPlayingSpecial = false;
    state.nextSwitchDelay = Math.random() * 8000 + 8000;
    state.lastSwitchTime = Date.now();
  };

  // Demon's focus sequence: hold idle while the camera flies in (~2s),
  // play demon_pointing once, then settle into demon_typing. Triggered
  // from the externalFocusAgent effect so both the desktop click path
  // (which goes through handleClick → onAgentClick → parent → effect) and
  // the touch path (handleTouchStart → onAgentClick → parent → effect)
  // run the same sequence. Previously this lived inline in handleClick,
  // which meant touch users never saw the pointing animation.
  //
  // expectedCameraPos: the authored focus pose. If the user has manually
  // orbited away from it before pointing fires, the pointing animation
  // (authored to address the camera directly) would gesture into empty
  // space — skip pointing in that case and let head-tracking take over.
  const startDemonFocusSequence = (expectedCameraPos) => {
    const demonActions = actionsRef.current['Demon'];
    const demonMixer = mixersRef.current['Demon'];
    if (!demonActions || !demonMixer) return;

    // TRANSITION_RE guards are load-bearing: /demon.*pointing/ also matches
    // demon_pointing_to_typing and /demon.*typ/ matches BOTH that and
    // demon_typing_to_idle. Today .find() happens to hit the real clips first
    // because that's the order they sit in the GLB — a re-export that reorders
    // them would otherwise make him point with a 1s transition clip.
    const idleKey = Object.keys(demonActions).find(a => /demon_idle/i.test(a));
    const pointingKey = Object.keys(demonActions).find(a => /demon.*pointing/i.test(a) && !TRANSITION_RE.test(a));
    const typingKey = Object.keys(demonActions).find(a => /demon.*typ/i.test(a) && !TRANSITION_RE.test(a));
    const demonState = demonAnimStateRef.current;

    if (!idleKey) {
      console.warn('[Demon] demon_idle animation not found. Available:', Object.keys(demonActions));
      return;
    }

    // Re-entrancy guard: if a sequence is already in flight for this focus
    // (isPlayingSpecial is cleared in restoreDemonFromFocus on unfocus),
    // don't restart it. Prevents double-fire if anything ever invokes this
    // twice in the same focus session.
    if (demonState.isPlayingSpecial) return;

    const crossfadeTo = (key, { loop = THREE.LoopRepeat, fade = 0.3 } = {}) => {
      if (!key || !demonActions[key]) return null;
      const action = demonActions[key];
      // No-op if we're already on this clip and it's running — otherwise
      // reset()+fadeIn would briefly pull its weight to 0 with no other
      // action fading in to fill the gap, and three.js blends the missing
      // weight against the bind pose (T-pose flash). Just refresh
      // loop/clamp settings.
      const alreadyOn =
        demonState.currentAnimation === key &&
        action.isRunning && action.isRunning();
      if (alreadyOn) {
        action.setLoop(loop);
        if (loop === THREE.LoopOnce) action.clampWhenFinished = true;
        return action;
      }
      // Same as above — demon_pointing is a clamped one-shot and would keep
      // its weight through everything that follows if we only faded `prev`.
      fadeOutOthers(demonActions, action, fade, demonMixer);
      action.reset();
      // Skip the bind-pose first frame — Mixamo clips anchor a T-pose at
      // time=0, which flashes through the cross-fade.
      action.time = bindSkipTime(action);
      action.setLoop(loop);
      if (loop === THREE.LoopOnce) action.clampWhenFinished = true;
      action.setEffectiveWeight(1);
      fadeInOrSnap(action, demonActions, fade, demonMixer);
      action.play();
      demonState.currentAnimation = key;
      return action;
    };

    // The demon's stage 1 and stage 3 are desk swaps like any other, but they
    // happen HERE rather than in applyCharacterFocusAnimation (which runs a
    // beat later and finds him already moved). Without this, clicking him
    // while he's typing yanked his hands up through the desk on the way to
    // idle, and the settle out of the point was a plain crossfade.
    const bridgeOrCrossfade = (toKey, opts) => {
      if (!toKey || !demonActions[toKey]) return null;
      const bridged = tryDeskBridge({
        agentId: 'Demon',
        actions: demonActions,
        state: demonState,
        toKey,
        // Re-pin: the bridge's hand-off clears isPlayingSpecial, but he's
        // still focused and the rest of this sequence depends on the latch.
        onSettled: () => {
          if (!demonFocusedRef.current) return;
          demonState.isPlayingSpecial = true;
          demonState.nextSwitchDelay = 999999;
          demonState.lastSwitchTime = Date.now();
        },
      });
      if (bridged) return demonActions[toKey];
      return crossfadeTo(toKey, opts);
    };

    demonState.isPlayingSpecial = true;
    demonState.nextSwitchDelay = 999999;
    demonState.lastSwitchTime = Date.now();
    demonState.focusSequenceTimers = demonState.focusSequenceTimers || [];

    // Stage 1: fade to idle while camera flies in.
    bridgeOrCrossfade(idleKey, { fade: 0.5 });

    if (!pointingKey) return;

    // Stage 2: after camera settles (~2s), play pointing once unless the
    // user orbited away from the authored focus pose.
    const t1 = setTimeout(() => {
      if (!demonFocusedRef.current) return;

      if (expectedCameraPos) {
        const tolerance = 0.5; // meters
        const distSq = camera.position.distanceToSquared(expectedCameraPos);
        if (distSq > tolerance * tolerance) {
          // Camera drifted — keep idle, head-look override takes over.
          demonHeadTrackingRef.current = true;
          return;
        }
      }

      const pointingAction = crossfadeTo(pointingKey, { loop: THREE.LoopOnce, fade: 0.3 });
      if (!pointingAction) return;

      const onFinished = (e) => {
        if (e.action !== pointingAction) return;
        demonMixer.removeEventListener('finished', onFinished);
        demonState.focusSequenceListener = null;
        if (!demonFocusedRef.current) return;
        // Stage 3: settle into demon_typing for the rest of focus (or
        // idle if typing isn't authored). demon_pointing_to_typing carries
        // this move — his arm is out over the desk when the point ends, so a
        // crossfade takes it back through the mesh.
        bridgeOrCrossfade(typingKey || idleKey, { fade: 0.3 });
      };
      demonMixer.addEventListener('finished', onFinished);
      demonState.focusSequenceListener = onFinished;
    }, 2000);
    demonState.focusSequenceTimers.push(t1);
  };

  // External focus sync — when the parent passes a new `externalFocusAgent`
  // (e.g. the player tapped a railway portrait in /trade), fly the camera to
  // that character using the same AGENT_CAMERA_SETTINGS the in-scene click
  // path uses. No-op when the requested agent is already focused, so this
  // doesn't loop with the internal onClick → onAgentClick → focusedAgent
  // → externalFocusAgent round-trip.
  //
  // We also mirror the per-character setup the in-scene click does:
  //   • set the matching `*FocusedRef.current = true` so the head-tracks-
  //     camera code path enables for that character
  //   • call `activateSitePalProjection(agentId)` for voiced characters so
  //     the right SitePal scene loads (face overlay paints the right face);
  //     gameStarted branching inside that helper still suppresses the lobby
  //     "meet" line during game mode
  //   • latch `monkWaveStateRef.hasBeenFocused = true` on Monk focus so the
  //     hail/beckon attention loop stops permanently for the session
  useEffect(() => {
    if (externalFocusAgent === undefined) return;
    if (externalFocusAgent === null) {
      // Don't clobber an in-flight Reset transition. The internal unfocus
      // paths (toggle-click, Escape, screenGoBack) synchronously do
      // onAgentClick(null) + setFocusTarget({Reset}) in the same batch.
      // Without this guard, this effect re-runs after the batch and nulls
      // out the Reset before useFrame can dispatch the fly-back, so the
      // camera never returns to sceneDefaultPose. Reset's own setTimeout
      // clears focusTarget after the ~1s transition completes.
      setFocusTarget((prev) => {
        if (!prev) return prev;
        if (prev.agentName === 'Reset') return prev;
        return null;
      });
      return;
    }

    // 'Reset' — PULL BACK TO THE ROOM. Not an agent; a request for the scene's
    // default pose, and the only way a PARENT can ask for one.
    //
    // `null` is not that, and the difference cost a beat. Passing null only
    // clears focusTarget (see the guard above), which leaves the camera exactly
    // where the last focus parked it — the internal unfocus paths get their
    // fly-back from a Reset target they set THEMSELVES, in the same batch.
    // Nothing outside this file could set one. So the VC game's post-deal panel
    // opened with the camera still jammed against whoever was pressed last: the
    // pitch bot's legs, cropped, with the room out of frame (author, 2026-08-02).
    //
    // Same shape as the Escape handler at the bottom of this file, MINUS its
    // restoreAllFromFocus() — that helper and the five restore*FromFocus it calls
    // are locals inside the keydown effect, so they are not in scope here, and
    // lifting them out to share would move a large amount of character-animation
    // state for a camera move. They are also not what this needs: they return the
    // cast to their lobby loops, and the beat this serves ends with LEAVE THE
    // DESK unmounting the session anyway. If a caller ever needs the full
    // restore, hoist them then — don't re-implement them here.
    if (externalFocusAgent === 'Reset') {
      setFocusTarget({
        position: sceneDefaultPose.position.clone(),
        lookAt: sceneDefaultPose.target.clone(),
        agentId: null,
        agentName: 'Reset',
      });
      // Clearing after the transition hands the camera back to the user; leaving
      // the target set would pin it and kill orbit.
      const t = setTimeout(() => setFocusTarget(null), 1000);
      return () => clearTimeout(t);
    }

    switch (externalFocusAgent) {
      // THE VC PITCH SUPPRESSES EVERY LOBBY BEHAVIOUR ON THESE THREE SEATS.
      //
      // Each of them owns a published SitePal scene, and those scenes AUTO-PLAY a
      // bound greeting when projected — page.js has had stray-auto-greeting
      // suppression for exactly that. During a pitch the press floor is already
      // speaking them through ElevenLabs, so projecting SitePal put TWO streams of
      // the same character on top of each other: Barron's lobby "Welcome to the
      // Liminal Terminal…" over his in-game answer (author, 2026-07-29).
      //
      // gameStartedRef CANNOT carry this. It is held until START in GameOverlay,
      // a flow the VC game never shows, so every "lobby only" guard in this file
      // silently leaks into the pitch. That has now caused three separate bugs;
      // pitchStartedRef is the signal that actually knows.
      case 'Monk':
        monkFocusedRef.current = true;
        if (monkWaveStateRef.current) {
          monkWaveStateRef.current.hasBeenFocused = true;
          monkWaveStateRef.current.attentionActive = false;
        }
        if (!pitchStartedRef.current) activateSitePalProjection('Monk');
        break;
      case 'Demon': {
        demonFocusedRef.current = true;
        if (!pitchStartedRef.current) activateSitePalProjection('Demon');
        // Kick off the idle → pointing → typing sequence. This path is the
        // single source of truth for both desktop click and touch tap;
        // handleClick no longer runs it inline. Pass the authored cameraPos
        // so the sequence skips pointing if the user orbited the camera away.
        //
        // LOBBY ONLY. The sequence fires demon_pointing on a 2s timer, while
        // the parent's speakLine starts the spoken line at ~900ms — so in game
        // mode the point landed squarely in the middle of him talking. It only
        // showed up "sometimes" because stage 2 skips pointing when the player
        // has orbited off the authored focus pose, so it fired on the visits
        // where the camera happened to still be parked there. This restores the
        // behaviour already documented for applyCharacterFocusAnimation: every
        // character stays on idle while speaking in game mode.
        //
        // Read through gameStartedRef, not the `gameStarted` prop — this effect
        // doesn't list it in its deps, so the closed-over value goes stale.
        // ...and the pointing sequence is lobby-only for the same reason: during a
        // pitch he is a specialist reporting a finding, not a host greeting you.
        if (!gameStartedRef.current && !pitchStartedRef.current) {
          const demonResolved = resolveAgentSettings('Demon', isMobile || detectedMobile);
          startDemonFocusSequence(demonResolved?.cameraPos || null);
        }
        break;
      }
      case 'Detective':
        detectiveFocusedRef.current = true;
        if (!pitchStartedRef.current) activateSitePalProjection('Detective');
        break;
      case 'RL80':
        rl80FocusedRef.current = true;
        break;
      case 'Virgil':
        virgilFocusedRef.current = true;
        break;
      default:
        break;
    }
    // Note: the actual idle/typing cross-fade is driven by the separate
    // `applyCharacterFocusAnimation` effect below, which watches both
    // externalFocusAgent and speechActive — so the character lands in the
    // right mode based on whether audio is currently playing.

    setFocusTarget((prev) => {
      const isOnMobile = isMobile || detectedMobile;
      /* TWO CHARACTERS HAVE A LIVE POSE, and it can be null. The cat and the pitch
       * bot both MOVE, so their shots are read off the object rather than authored;
       * both getters return null until their model has landed. Everyone else is
       * authored, and for them the authored pose IS the source of truth. */
      const live = externalFocusAgent === 'Virgil' ? getCatFocusSettings()
        : externalFocusAgent === 'PitchBot' ? getPitchBotFocusSettings()
          : null;
      const wantsLive = externalFocusAgent === 'Virgil' || externalFocusAgent === 'PitchBot';
      /* RE-FIRE ONCE THE REAL POSE EXISTS, which is the bug this guard used to have.
       * It read `prev.agentId === externalFocusAgent` alone, so a focus that fired
       * before the model landed flew to the AGENT_CAMERA_SETTINGS bootstrap and was
       * then latched there for the whole session — the bootstrap is a wide shot from
       * 1.6 out, so the pitch played to a camera parked in the wrong place with no
       * way back. Now a bootstrapped target is upgraded the moment the getter can
       * answer (this effect lists pitchBotReady, which is that moment).
       *
       * STILL BAILS on the two cases that matter: an already-derived target, and a
       * getter that is still null. Neither re-flies the camera, so re-running this
       * effect stays free. */
      if (prev && prev.agentId === externalFocusAgent && (prev.derivedPose || !live)) return prev;
      const resolved = live || resolveAgentSettings(externalFocusAgent, isOnMobile);
      if (!resolved) return prev;
      return {
        position: resolved.cameraPos,
        lookAt: resolved.lookAtPos,
        orbitCenter: resolved.orbitCenter,
        fov: isOnMobile ? 75 : undefined,
        agentId: externalFocusAgent,
        agentName: externalFocusAgent,
        /* "This is the pose we actually wanted", not "this came from a getter" —
         * an authored character is derived by definition, so it never re-fires. */
        derivedPose: wantsLive ? !!live : true,
      };
    });
  }, [externalFocusAgent, isMobile, detectedMobile, pitchBotReady]);

  // Lobby intro lifecycle. Clicking a character in the lobby flies the camera
  // in, holds them in an attentive idle and turns their head to the player
  // while their meet-line plays. `lobbyIntroDone` marks the moment that line
  // ends: from then on (until the player picks someone else) they drop back to
  // their normal working loop and stop tracking the camera.
  //
  // The flip is deliberately edge-triggered on a false→true→false round trip
  // of speechActive rather than just "speechActive is false": before the line
  // starts — camera fly-in, SitePal scene load, the parent's ~900ms delay —
  // speechActive is still false, and a character whose audio never reports at
  // all should keep the old hold-on-camera behaviour rather than snapping away
  // the moment the camera arrives.
  //
  // Requiring the rising edge (not just `speechActive === true`) also filters
  // out the previous character's line: clicking B while A is still talking
  // carries speechActive=true into B's focus, and its subsequent drop to false
  // is A's audio being cut, not B finishing.
  const [lobbyIntroDone, setLobbyIntroDone] = useState(false);
  const lobbySpeechSeenRef = useRef(false);
  const prevSpeechActiveRef = useRef(false);
  // True while a character is still focused but has been handed back to the
  // idle alternation. Only consulted by gates that key off *FocusedRef.
  const focusAnimReleasedRef = useRef(false);

  useEffect(() => {
    // New focus (or crossing into game mode) arms a fresh intro.
    lobbySpeechSeenRef.current = false;
    focusAnimReleasedRef.current = false;
    setLobbyIntroDone(false);
  }, [externalFocusAgent, gameStarted]);

  useEffect(() => {
    const rising = speechActive && !prevSpeechActiveRef.current;
    prevSpeechActiveRef.current = speechActive;
    if (gameStarted || !externalFocusAgent) return;
    if (speechActive) {
      // A line is under way. Re-engage if we'd already released — covers a
      // second lobby line for the same character (e.g. re-clicking them).
      if (rising) {
        lobbySpeechSeenRef.current = true;
        setLobbyIntroDone(false);
      }
      return;
    }
    if (lobbySpeechSeenRef.current) setLobbyIntroDone(true);
  }, [gameStarted, externalFocusAgent, speechActive]);

  // Second, independent end-detector: SitePal's own audio callbacks.
  //
  // `speechActive` only tracks speech the PARENT drives (it flips inside the
  // parent's `__onSitePalAudioStarted` hook). The lobby meet-lines aren't that
  // — they're played by the SitePal pipeline itself, and the pipeline's
  // `vh_audioStarted` bails at `if (!active) return` before ever reaching that
  // hook when the request wasn't one the parent made. So `speechActive` can
  // stay false for an entire lobby intro, leaving the round-trip above with no
  // edge to fire on: she talks, finishes, and stays locked on the camera.
  //
  // These end callbacks are wrapped rather than replaced, and every previously
  // installed handler still runs. The parent installs its own wrappers in a
  // mount-time effect; as a child our effects run first, so the parent's
  // wrapper ends up outermost and chains down into ours either way.
  useEffect(() => {
    if (gameStarted || !externalFocusAgent || typeof window === 'undefined') return;
    const armedAt = Date.now();
    // Ignore end events in the first moment after focus: those are the
    // OUTGOING character's audio being cut short by the swap, not this intro
    // finishing. If one slips through anyway, the speechActive rising edge
    // above un-latches us when the real line starts.
    const SETTLE_MS = 1500;
    let released = false;
    const onEnd = () => {
      if (released || Date.now() - armedAt < SETTLE_MS) return;
      released = true;
      setLobbyIntroDone(true);
    };
    const NAMES = ['vh_audioStopped', 'vh_speechEnded', 'vh_audioEnded'];
    const prev = {};
    NAMES.forEach((name) => {
      prev[name] = window[name];
      window[name] = function (...args) {
        try { onEnd(); } catch (e) {}
        if (typeof prev[name] === 'function') return prev[name].apply(this, args);
      };
    });
    // Backstop: if no end event ever arrives (audio blocked by autoplay
    // policy, callback never wired), don't leave her staring forever.
    const timer = setTimeout(onEnd, 30000);
    return () => {
      clearTimeout(timer);
      NAMES.forEach((name) => { window[name] = prev[name]; });
    };
  }, [gameStarted, externalFocusAgent]);

  // Animation mode driver — runs whenever the focused agent OR the speech
  // state changes. Cross-fades the focused character into idle (while
  // speaking) or typing (between speech beats). Without this, characters
  // just stare at the player the whole time instead of appearing to look
  // up information between exchanges.
  //
  // In lobby (pre-game) the focused character holds idle regardless of
  // speechActive — the player is reviewing character info cards, so they
  // should be looking up at the camera, not heads-down typing — until their
  // intro line finishes, at which point they're released back to their own
  // animation loop.
  useEffect(() => {
    if (!externalFocusAgent) return;
    // Set `window.__lobbyAnimDebug = true` to trace the lobby idle→typing
    // handoff (which agent, whether speech is live, whether the intro latched).
    if (typeof window !== 'undefined' && window.__lobbyAnimDebug) {
      console.log('[lobby-anim]', { agent: externalFocusAgent, gameStarted, speechActive, lobbyIntroDone });
    }
    if (!gameStarted && lobbyIntroDone) {
      releaseCharacterFocusAnimation(externalFocusAgent);
      return;
    }
    const mode = !gameStarted || speechActive ? 'idle' : 'typing';
    applyCharacterFocusAnimation(externalFocusAgent, mode);
    // applyCharacterFocusAnimation is defined inside the component and reads
    // refs (which are stable), so it doesn't need to be in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFocusAgent, speechActive, gameStarted, lobbyIntroDone]);

  // Demon periodic head-glance — while the demon is the focused agent and
  // speech is active, occasionally turn his head to look at the viewer for
  // a beat, then release. Drives demonGlanceActiveRef; the per-frame head
  // look-at-camera override picks it up alongside demonHeadTrackingRef.
  // Hold-then-glance cycle: idle for HOLD_MS, glance for GLANCE_MS, repeat,
  // each window randomized so it doesn't feel metronomic.
  useEffect(() => {
    // Lobby-mode intros also flip speechActive when the player taps a
    // character card, but glancing during that framing looks wrong (the
    // lobby camera angle isn't set up for a head turn). Restrict the
    // scheduler to in-game speech only.
    if (!gameStarted || externalFocusAgent !== 'Demon' || !speechActive) {
      demonGlanceActiveRef.current = false;
      return;
    }
    let timer = null;
    let cancelled = false;
    const HOLD_MIN = 4000, HOLD_MAX = 7000;
    const GLANCE_MIN = 1500, GLANCE_MAX = 2500;
    const rand = (min, max) => min + Math.random() * (max - min);
    const scheduleHold = () => {
      if (cancelled) return;
      demonGlanceActiveRef.current = false;
      timer = setTimeout(scheduleGlance, rand(HOLD_MIN, HOLD_MAX));
    };
    const scheduleGlance = () => {
      if (cancelled) return;
      demonGlanceActiveRef.current = true;
      timer = setTimeout(scheduleHold, rand(GLANCE_MIN, GLANCE_MAX));
    };
    // Start on a hold so the demon doesn't immediately snap his head over
    // the moment audio begins — gives the pointing/typing animation a beat
    // to read before the first glance.
    scheduleHold();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      demonGlanceActiveRef.current = false;
    };
  }, [gameStarted, externalFocusAgent, speechActive]);

  // Cache the Demon's SmartPhone prop and hide it by default. It's parented to
  // his right hand (Hand_R_1) and always exported visible; we only want it in
  // frame while he's on the phone (demon_phone, the council reaction), so
  // applyCharacterReaction/restoreCharacterIdle toggle smartPhoneRef.current.
  useEffect(() => {
    if (!loadedModel) return;
    const phone = loadedModel.getObjectByName('SmartPhone');
    if (phone) {
      smartPhoneRef.current = phone;
      phone.visible = false;
    }
  }, [loadedModel]);

  // Guard the picking raycasters (handlePointerMove / handleClick both call
  // intersectObjects on this whole subtree). Some GLB export nodes ship a
  // geometry with no `position` attribute (empty/degenerate mesh, or a stray
  // Points/Line); THREE's raycast then reads `.count` on the missing attribute
  // and throws "Cannot read properties of undefined (reading 'count')" on hover.
  // Those nodes aren't pickable anyway, so disable their raycast once at load.
  useEffect(() => {
    if (!loadedModel) return;
    loadedModel.traverse((o) => {
      if (o.geometry && !o.geometry.attributes?.position) {
        o.raycast = () => {};
      }
    });
  }, [loadedModel]);

  // Verdict-reveal curtain call. When the parent flips revealMode to an
  // outcome, play each character's reaction animation in place. The scene
  // stays as-is (props visible, default camera framing) — the parent gates
  // externalFocusAgent off during reveal so the camera returns to the wide
  // default that frames all four characters.
  // Stage-lineup positions for the curtain call. Tuned by eye — adjust
  // x/y/z to taste. Rotation is in radians; 0 means the character keeps
  // their authored facing, π flips them around. The empties' world
  // transforms get overridden during reveal and restored after.
  // Y that rests Virgil on the stage floor (authored desk-partition y is 0.70).
  // Tuned by eye against ?reveal=aligned. Do NOT try to derive it from the mesh
  // bounding box — the cat is skinned and its bind-pose bbox sits ~0.65 ABOVE
  // the node origin, which yields a wildly-too-low value (-0.32 put him under
  // the floor). Bone-to-bone measurement against the Monk's lowest bone got
  // close (0.10); the rest was eyeballed.
  const CAT_FLOOR_Y = 0.23;

  const STAGE_LINEUP = useMemo(() => ({
    Monk_empty:      { position: [-0.75, 0.18, 0], rotation: [0, 0, 0] },
    Demon_Empty:     { position: [-0.25, 0.18, 0], rotation: [0, 0, 0] },
    Detective_Empty: { position: [ 0.25, 0.18, 0], rotation: [0, 0, 0] },
    RL80_Empty:      { position: [ 0.75, 0.3,  0], rotation: [0, Math.PI, 0] },
    Unicorn_Empty:   { position: [ 0.75, 0.3,  0], rotation: [0, Math.PI, 0] },
    // Virgil sits on the desk partition during gameplay (authored y 0.70);
    // StageProps are hidden for the reveal, so without this he floats in
    // mid-air at the right edge. Only y changes — his authored x/z already
    // put him at the carpet's right edge, beside the unicorn.
    Cat_Empty:       { position: [ 1.33, CAT_FLOOR_Y, 0.30], rotation: [0, 0, 0] },
  }), []);

  // Council (pre-outcome live-argument) uses a semi-circle instead of the flat
  // outcome lineup: a shallow arc opening toward the camera, each character
  // angled inward toward a focal point (~[0, 1.0] downstage) so they read as a
  // group in discussion rather than a firing-squad line. Ends (Monk/Unicorn)
  // sit downstage (z≈0) turned ~40° inward; the middle two sit upstage
  // (z≈-0.27) turned ~13°. Humanoids face +Z at yaw 0; the unicorn's authored
  // facing is reversed, so its yaw carries an extra π.
  const COUNCIL_LINEUP = useMemo(() => ({
    Monk_empty:      { position: [-0.84, 0.18,  0.00], rotation: [0,  0.70, 0] },
    Demon_Empty:     { position: [-0.29, 0.18, -0.27], rotation: [0,  0.23, 0] },
    Detective_Empty: { position: [ 0.29, 0.18, -0.27], rotation: [0, -0.23, 0] },
    RL80_Empty:      { position: [ 0.84, 0.30,  0.00], rotation: [0, Math.PI - 0.70, 0] },
    Unicorn_Empty:   { position: [ 0.84, 0.30,  0.00], rotation: [0, Math.PI - 0.70, 0] },
    Cat_Empty:       { position: [ 1.33, CAT_FLOOR_Y, 0.30], rotation: [0, 0, 0] },
  }), []);

  useEffect(() => {
    if (!loadedModel) return;
    const stageProps = loadedModel.getObjectByName('StageProps');
    if (stageProps) {
      stageProps.visible = !revealMode;
      // Defensive: also flip every direct child, in case anything walks
      // the props subtree and reads child.visible independently.
      stageProps.children.forEach((c) => { c.visible = !revealMode; });
    }
    // The neon sign comes from its own GLB, so it's parented to templeScene
    // rather than StageProps and won't be caught by the flip above. Hide it on
    // the same terms — it hangs at scene center, right where the characters
    // line up for the curtain call.
    //
    // AND WHILE A GAME IS IN PLAY (2026-07-29). The sign floats at scene centre,
    // which is exactly where the pitch bot now stands, so during a pitch the two
    // occupy the same air — the sign hangs over the bot's head and reads as part
    // of it. Same reasoning as the curtain call: this is decor, and decor yields
    // when something is actually happening at centre stage.
    //
    // OWNED BY ITS OWN EFFECT NOW — see NEON VISIBILITY below. It cannot live
    // here: this effect's deps are [revealMode, loadedModel, ...] with no
    // gameStarted, so gating on gameStarted from inside it would read a stale
    // closure and never fire. That is a trap this file already documents
    // elsewhere ("Read through gameStartedRef, not the `gameStarted` prop").
    if (!revealMode) return;

    // Council gets the semi-circle; every outcome reveal gets the flat lineup.
    const lineup = revealMode === 'council' ? COUNCIL_LINEUP : STAGE_LINEUP;

    // Snapshot then override each character's transform to the stage
    // lineup. Saved values live on a Map so cleanup restores them
    // verbatim regardless of any other transform writes during reveal.
    const transformSnapshot = new Map();
    Object.entries(lineup).forEach(([name, target]) => {
      const obj = loadedModel.getObjectByName(name);
      if (!obj) return;
      transformSnapshot.set(obj, {
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
      });
      obj.position.set(...target.position);
      obj.rotation.set(...target.rotation);
    });

    ['Monk', 'Demon', 'Detective', 'RL80', 'Virgil'].forEach((agentId) => {
      applyCharacterReaction(agentId, revealMode);
    });


    return () => {
      transformSnapshot.forEach((orig, obj) => {
        obj.position.copy(orig.position);
        obj.rotation.copy(orig.rotation);
      });
      // Wind down each character's reaction so the regular animation
      // alternation can resume. Without this, BACK TO SERVICES leaves
      // every character looping their curtain-call clip forever.
      ['Monk', 'Demon', 'Detective', 'RL80', 'Virgil'].forEach((agentId) => {
        restoreCharacterIdle(agentId);
      });
      // Allow the Monk hail/beckon attract loop to re-engage on the next
      // game (gated on attractMonk in the parent + hasBeenFocused here).
      // For the lobby return after a verdict the parent passes
      // attractMonk=false anyway, but resetting this avoids leaving a
      // stale latch that would survive into a fresh session.
      if (monkWaveStateRef.current) {
        monkWaveStateRef.current.hasBeenFocused = false;
        monkWaveStateRef.current.attentionActive = false;
        monkWaveStateRef.current.everInitialized = false;
        monkWaveStateRef.current.nextFireTime = 0;
      }
      // Virgil relocates between rounds — cats move when you aren't looking.
      // MUST run after the transformSnapshot restore above, which puts him
      // back on his pre-reveal desk; re-rolling before it would be undone.
      applyCatPerch();
    };
    // applyCharacterReaction / restoreCharacterIdle read stable refs and
    // aren't worth re-creating; exclude them from deps to avoid spurious
    // re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealMode, loadedModel, STAGE_LINEUP, COUNCIL_LINEUP]);

  // The holo registry holds shader uniforms for as long as the bot's materials
  // exist. Clear it on unmount or a remount ticks stale uniforms forever.
  useEffect(() => () => { disposePitchBotHolo(); disposePitchBotBillboard(); }, []);

  /* THE PITCHER IS ONLY IN THE ROOM WHILE THERE IS A PITCH.
   *
   * It loaded visible and stood in the beam on the lobby screen with no game
   * running (author, 2026-07-29) — a closer waiting in an empty office. This is
   * the mirror of the neon rule below: the sign owns centre stage when nothing is
   * happening, the pitcher owns it when something is.
   *
   * GATED ON THE FLOOR, not on the game being selected: on the broader signal the
   * agent materialised over the briefing screen, before the player had agreed to
   * hear anything. It arrives when they click HEAR THE PITCH ▸ (author,
   * 2026-07-29), which is the beat the arrival choreography is built around.
   *
   * Hidden for the curtain call too. The reveal choreographs FOUR characters
   * into a lineup at centre; a hologram floating over them is not in that plan.
   */
  /* AND IT IS CAST, NOT SWITCHED ON.
   *
   * This was `visible = true` — the figure simply existed, mid-air, on the frame
   * the floor began, while a projector beam it had no relationship to burned
   * underneath it. §1 has said since the easel was cut that "the projector casts
   * the bot, its beam is the only staging the pitcher gets"; the beam was staging
   * nothing. Now the shaft strikes and the figure assembles up it, base to crown.
   *
   * THE ORDER IS THE POINT: beam first, then the body climbing out of it. See
   * tickPitchBotCast for why cause-then-effect needs its own lead time, and
   * pitchBotHolo's CAST block for why the wipe rides the bind pose.
   *
   * SHOWING IT IS NOT CONDITIONAL ON THE EFFECT WORKING. startPitchBotCast returns
   * false if it cannot measure the geometry, and then the bot is simply visible —
   * a projector flourish that fails must not take the pitch with it, which is the
   * same rule mountPitchBot applies to a failed load. */
  useEffect(() => {
    const bot = pitchBotRef.current;
    if (!bot) return;
    const show = !!pitchStarted && !revealMode;
    bot.visible = show;
    if (!show) {
      // Snap to fully formed while hidden, so anything that reveals the bot by
      // another route (the curtain call ending, a future debug handle) never finds
      // it half-assembled.
      cancelPitchBotCast();
      beamBoostRef.current = 1;
      return;
    }
    // Reduced motion is handled inside startPitchBotCast, which returns false and
    // leaves the bot plainly visible — same path as an unmeasurable rig.
    startPitchBotCast(bot);
  }, [pitchStarted, revealMode, pitchBotReady]);

  /**
   * THE PITCH BOT'S FOCUS POSE, DERIVED AT FOCUS TIME.
   *
   * Authored coordinates kept going stale on this one character, because unlike
   * the four analysts it MOVES: it has been rescaled twice, raised once and had
   * its payload cut, and every one of those left the hand-written pose aiming at
   * the floor where the bot used to be. The last version pointed a full unit
   * below it.
   *
   * So read the bot instead. THE DATUM IS THE RIG ROOT — its world position, which
   * is the FEET, because every staged rig has its local origin there.
   *
   * IT WAS THE FACE PLATE until 2026-08-04, and that is the bug this replaced.
   * Two things move that plate and neither of them moves the root:
   *
   *   THE CAST. startPitchBotCast drives `root.scale.y` from ~0 up over its
   *   0.7s launch after a 1.05s delay, squashing the rig about its feet. Focus
   *   fires inside that window, so a head-mounted plate was read anywhere between
   *   the feet and the head depending on which frame won the race.
   *
   *   THE POSE. The plate hangs off a bone, so the idle clip moves it too.
   *
   * v2 and v3 hid this for a year because their Mixamo plates hang off Head at
   * -152 local and land near the FEET either way — squashed or standing, the
   * anchor barely moved. v1's plate sits AT its head, so the same code framed it
   * correctly on some loads and a figure-height too high on others, and during the
   * cast it aimed under the floor. Scaling about the feet is precisely what makes
   * the root immune: the origin is the fixed point of that transform.
   *
   * SO THE NUMBERS BELOW ARE FEET-RELATIVE and mean the same thing on every rig,
   * which is what lets all three share one framing block again.
   *
   * Approaching straight down +Z is safe rather than arbitrary: the bot is
   * BILLBOARDED, so it turns to face wherever the camera ends up. There is no
   * "front" to respect.
   *
   * Returns null before the model lands, and the caller falls back to the
   * authored pose in AGENT_CAMERA_SETTINGS — which is now only a bootstrap.
   */
  const getPitchBotFocusSettings = useCallback(() => {
    const bot = pitchBotRef.current;
    if (!bot) return null;
    bot.updateWorldMatrix(true, true);
    /* THE ROOT'S WORLD POSITION — the projector plate the rig stands on.
     *
     * NO TRAVERSAL, and that is a second bug gone with it. The old plate search
     * had to dodge two traps: `/Face/i` also matches "Beta_Surface" (sur-FACE, the
     * body shell), and the holo depth-prepass twins are invisible geometry that is
     * nonetheless face-named — appending either after the bones silently moved the
     * aim point to the whole body. A datum that is one object reference cannot be
     * matched by the wrong mesh.
     *
     * SCALE-PROOF, which is the point. The cast animates `root.scale.y` about this
     * exact origin, so it is the one point on the rig the launch cannot move. Bone
     * animation cannot move it either — the root is not in the skeleton.
     *
     * NOT SCALE-AWARE, and it does not need to be: all three rigs are fitted to the
     * same staged height (see fitHeight), so a fixed offset from the feet lands on
     * the same part of every figure. If a future rig is staged at a different
     * height, give it a per-variant `framing` rather than reaching back for a
     * body-relative datum. */
    const at = new THREE.Vector3();
    bot.getWorldPosition(at);
    // Framing numbers come from a REF, not the closure, so __pitchBotFrame can
    // change them without this callback being rebuilt (and without the focus
    // effect that captured it going stale).
    const f = framingRef.current;
    const dy = (isMobile || detectedMobile) ? (MOBILE_CAMERA_OFFSET.y || 0) : 0;
    return {
      cameraPos: new THREE.Vector3(at.x, at.y + f.camLift + dy, at.z + f.dist),
      lookAtPos: new THREE.Vector3(at.x, at.y - f.aimDrop + dy, at.z),
      orbitCenter: null,
    };
  }, [isMobile, detectedMobile]);

  // Tuning handles. __pitchBotFrame RE-FIRES THE FOCUS, which is the part that
  // matters: changing the numbers alone does nothing visible, because the camera
  // only reads them when a focus transition starts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const readback = () => {
      const r = getPitchBotFocusSettings();
      return {
        ...framingRef.current,
        cameraPos: r ? r.cameraPos.toArray().map((v) => +v.toFixed(3)) : null,
        lookAtPos: r ? r.lookAtPos.toArray().map((v) => +v.toFixed(3)) : null,
      };
    };
    window.__pitchBotFocus = readback;
    /* PASTE WHAT YOU LAND ON INTO THE ACTIVE VARIANT'S `framing`, not the shared
     * default — the readback reports which rig is staged so there is no guessing.
     * Copying a tuned number into PITCH_BOT_FRAMING_DEFAULT retunes every rig that
     * has no override of its own, which today is none of them and tomorrow is
     * whichever one someone adds. */
    window.__pitchBotFrame = (patch = {}) => {
      /* `lift` MOVES THE WHOLE SHOT VERTICALLY WITHOUT TILTING IT.
       *
       * The camera sits at `anchor + camLift` and the target at `anchor - aimDrop`,
       * so raising the shot means camLift += d AND aimDrop -= d. Nudging camLift
       * alone lifts the camera and leaves the target behind, which steepens the
       * pitch — a different shot that happens to be higher. That distinction cost
       * most of an afternoon on 2026-08-02, so it is a knob rather than a thing to
       * remember.
       *
       *     __pitchBotFrame({ lift: 0.05 })    // whole shot up 0.05, same angle
       *     __pitchBotFrame({ lift: -0.03 })   // and down
       *
       * Composes with the raw three: `{ lift, dist }` is a common pair.
       */
      const { lift, ...rest } = patch;
      framingRef.current = { ...framingRef.current, ...rest };
      if (lift) {
        framingRef.current = {
          ...framingRef.current,
          camLift: +(framingRef.current.camLift + lift).toFixed(4),
          aimDrop: +(framingRef.current.aimDrop - lift).toFixed(4),
        };
      }
      const r = getPitchBotFocusSettings();
      if (r) {
        // A fresh object every time, so the fly-to actually re-runs — the focus
        // effect bails when the agentId is unchanged, and this deliberately does
        // not.
        setFocusTarget({
          position: r.cameraPos,
          lookAt: r.lookAtPos,
          orbitCenter: null,
          fov: (isMobile || detectedMobile) ? 75 : undefined,
          agentId: 'PitchBot',
          agentName: 'PitchBot',
          // Derived by construction — this handle only runs with a live bot. Says so
          // explicitly so the focus effect never "upgrades" a hand-tuned shot.
          derivedPose: true,
        });
      }
      return readback();
    };
    return () => { delete window.__pitchBotFocus; delete window.__pitchBotFrame; };
  }, [getPitchBotFocusSettings, isMobile, detectedMobile]);

  /* TALKING WHILE IT TALKS, IDLE OTHERWISE.
   *
   * Two clips, so there is nothing to schedule — `speechActive` picks one.
   * /trade feeds that from PressSession's real audio state (page.js:3953,
   * `pressMode ? pressSpeaking : speechActive`), which is why PressSession had to
   * stop pinning it true for the whole floor: on the old signal this would have
   * run `talking` for four unbroken minutes.
   *
   * ITS OWN EFFECT, not the shared applyCharacterFocusAnimation path. That one
   * matches clips through per-character regex tables built around this room's
   * typing/idle vocabulary (`typing_monk`, `detective_idle`, `cat_sitting_idle`);
   * the bot's clips are plainly `idle` and `talking` and would match none of them.
   * Twelve explicit lines beat a sixth entry in a table that means something else.
   *
   * `idle` AND `talking` ARE NOW ALIASES, not clip names. The v2 rig calls its
   * clips `Stand_Idle` / `Talking`, so pitchBotScene registers every variant's
   * clips under those two canonical keys as well as their own — which is what
   * keeps this effect correct for both rigs without knowing either one's
   * vocabulary. Read the actions bag, not the glb, if you are ever unsure what
   * these resolve to: `__pitchBotPlay()` lists them.
   *
   * Crossfaded rather than swapped: an utterance ends every few seconds, and a
   * hard cut on each one reads as a stutter.
   */
  useEffect(() => {
    const actions = actionsRef.current?.PitchBot;
    if (!actions) return;
    const wantTalking = !!speechActive;
    const to = wantTalking ? actions.talking : actions.idle;
    const from = wantTalking ? actions.idle : actions.talking;
    if (!to) return;
    const FADE = 0.28;
    to.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(FADE).play();
    if (from && from !== to) from.fadeOut(FADE);
    if (pitchBotAnimStateRef.current) {
      pitchBotAnimStateRef.current.currentAnimation = wantTalking ? "talking" : "idle";
    }
  }, [speechActive, pitchBotReady]);

  /* THE DESK LISTENS, THEN GOES BACK TO WORK.
   *
   * Follows the bot's SPEECH rather than the pitch as a whole: idle (attentive)
   * while he is talking, typing (working) the moment he stops. The first version
   * settled them once when the pitch opened and left them there, which held four
   * people motionless through every silence — technically attentive, and dead.
   *
   * `speechActive` is the same signal that picks the bot's own talking clip, so
   * the desk turns to him on the frame his mouth starts and returns to work on
   * the frame it stops. Heads and posture move together because both read it.
   *
   * THE FOCUSED SEAT IS SKIPPED. If the player has sent someone to look something
   * up, that character is mid-report and owns their own animation — overwriting it
   * here would cut them off to make them "pay attention" to a bot they are
   * currently answering.
   *
   * `releaseAfter: true` so they rejoin the normal alternation rather than
   * freezing in the pose; see the mode's own note. No cleanup: the desk's resting
   * behaviour IS that alternation, so a pitch ending needs no counter-effect.
   */
  const attentionTimersRef = useRef({});
  useEffect(() => {
    if (!pitchStarted || !loadedModel) return;
    const focusedRefs = {
      Monk: monkFocusedRef,
      Demon: demonHeadTrackingRef,
      Detective: detectiveFocusedRef,
      RL80: rl80FocusedRef,
    };
    const timers = attentionTimersRef.current;
    const apply = (agentId, mode) => {
      // Re-checked at FIRE time, not schedule time: over a 2.75s delay the player
      // can easily have selected that seat, and cutting off a character who is
      // now mid-report to send them back to typing is the exact interruption the
      // focus exclusion exists to prevent.
      if (focusedRefs[agentId]?.current) return;
      /* PIN WHILE LISTENING, RELEASE WHEN BACK AT WORK.
       *
       * `releaseAfter: true` hands the character straight back to the random
       * alternation in useFrame, whose next switch lands 8-16s out. On any
       * utterance longer than that the alternation would fire mid-listen and start
       * a typing clip while attention still had the head on the bot — Marisol
       * typing at her station while watching him speak. Holding the pose for the
       * duration of the utterance is what "listening" means.
       *
       * The old worry that pinning freezes them for four minutes does not apply
       * any more: posture now follows speech, so they are released on every gap
       * between beats rather than once at the end of the pitch.
       */
      applyCharacterFocusAnimation(agentId, mode, { releaseAfter: mode !== 'idle' });
    };

    for (const agentId of ['Monk', 'Demon', 'Detective', 'RL80']) {
      clearTimeout(timers[agentId]);
      if (speechActive) {
        // ATTENTION ARRIVES TOGETHER, on the beat the line starts — a staggered
        // turn TOWARD a speaker reads as a delayed reaction rather than as four
        // people with their own attention spans. Only the release is spread.
        apply(agentId, 'idle');
      } else {
        // Same table the heads use, so a character's posture and gaze give up at
        // the same moment instead of at two different ones.
        timers[agentId] = setTimeout(() => apply(agentId, 'typing'),
          ATTENTION_RELEASE_MS[agentId] || 0);
      }
    }
    return () => { for (const t of Object.values(timers)) clearTimeout(t); };
  }, [pitchStarted, speechActive, loadedModel]);

  /* WATCH IT WITHOUT PLAYING A PITCH.
   *
   *     __pitchBotAttention(true)    // heads turn now, bot shown if it wasn't
   *     __pitchBotAttention(false)   // force back to the camera
   *     __pitchBotAttention(null)    // follow pitchStarted again
   *
   * REPORTS THE CLAMPS, because they are the thing most likely to be wrong. The
   * four sit at desks facing different ways and the bot is at scene centre, so a
   * character needing more yaw than their cap gets will turn as far as it can and
   * stare PAST the pitcher — which reads worse than not turning at all. The caps
   * are per-character and two of them are live-tunable (__detClamp, __detPitchClamp).
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__pitchBotAttention = (on) => {
      if (on !== undefined) {
        attentionOverrideRef.current = on;
        if (on && pitchBotRef.current) pitchBotRef.current.visible = true;
        if (on) {
          for (const agentId of ['Monk', 'Demon', 'Detective', 'RL80']) {
            applyCharacterFocusAnimation(agentId, 'idle', { releaseAfter: true });
          }
        }
      }
      const bot = pitchBotRef.current;
      const out = {
        override: attentionOverrideRef.current,
        pitchStarted: pitchStartedRef.current,
        botVisible: !!bot?.visible,
        aimingAtHead: bot?.userData?.__attnHead?.name ?? null,
        yawClampsDeg: {
          Detective: +((Number.isFinite(window.__detClamp) ? window.__detClamp : 1.57) * 180 / Math.PI).toFixed(0),
          Demon: 66,
          note: 'Monk/RL80 clamps are inline in their useFrame blocks',
        },
      };
      const el = document.getElementById('__pitchBotCastProbe');
      if (el) el.textContent = JSON.stringify(out);
      return out;
    };
    return () => { delete window.__pitchBotAttention; };
  }, [loadedModel]);

  /* NEON VISIBILITY — decor yields to whatever is at centre stage.
   *
   * The sign hangs at scene centre from its own GLB (parented to templeScene, so
   * the StageProps flip never caught it). Two things now occupy that same air:
   * the curtain-call lineup, and — since 2026-07-29 — the pitch bot, which
   * stands at centre for the whole pitch with the sign floating over its head.
   *
   * Its own effect with its own deps, because the reveal effect lists neither of
   * these and would read a stale closure.
   *
   * DRIVEN BY THE SAME SIGNAL AS THE PITCH BOT, on purpose. The sign going dark
   * and the agent arriving are ONE handover of centre stage, so they read as a
   * single event rather than two fades that can drift apart. On the broader
   * signal the sign cleared at the BRIEFING and left the beam empty for a screen
   * or two before anyone appeared (author, 2026-07-29).
   *
   * NOT gameStarted: that is held until START in GameOverlay, which the VC game
   * never shows, so it is false for the entire pitch and gating on it was a
   * silent no-op.
   *
   * TO FLIP THE POLARITY (neon only DURING a pitch rather than only outside one)
   * invert the pitchStarted term — deliberately kept to one clause.
   */
  useEffect(() => {
    if (!neonSignRef.current) return;
    neonSignRef.current.visible = !revealMode && !pitchStarted;
  }, [revealMode, pitchStarted, loadedModel]);

  // Hover state for coins
  const [hoveredCoin, setHoveredCoin] = useState(null);
  const coin1OriginalScale = useRef(null);
  const coin1OriginalEmissive = useRef(null);
  const coin2OriginalScale = useRef(null);
  const coin2OriginalEmissive = useRef(null);
  const coin3OriginalScale = useRef(null);
  const coin3OriginalEmissive = useRef(null);
  const coin4OriginalScale = useRef(null);
  const coin4OriginalEmissive = useRef(null);
  
  // Refs for CoinFace avatar meshes — kept for future repurposing (e.g. leaderboard)
  const coinFaceRefs = useRef([null, null, null, null]) // CoinFace1-4
  const topSupporterBannerRefs = useRef([]) // TopText and x_logo meshes

  // Screens (Screen1-4, ScreenA-D), the 4 main characters (Demon, Monk,
  // RL80, Detective), and Angel require a double-click to focus, so
  // accidental clicks don't zoom the camera. Track the first click here;
  // the second click within 400ms proceeds. suppressNextDblClickRef stops
  // the native dblclick handler (which unfocuses) from immediately undoing
  // the focus we just triggered on the second click.
  const pendingScreenClickRef = useRef(null);
  const suppressNextDblClickRef = useRef(false);
  // Touch focus: when handleTouchStart focuses a character directly (bypassing
  // the dblclick gate that desktop uses), the browser may still fire a
  // synthesized click event from the same touch. handleClick consumes one
  // click whenever this flag is true so the click doesn't re-enter the focus
  // pipeline and accidentally toggle-unfocus the character we just focused.
  const suppressNextSynthesizedClickRef = useRef(false);
  // Mouse-down position for tap-vs-drag detection. Browsers fire `click`
  // even after a drag (OrbitControls' rotate gesture), so the
  // tap-anywhere-to-unfocus path measures pointer movement itself and only
  // dismisses focus when movement is below a small threshold.
  // Pixels of pointer travel above which a mouse `click` is treated as a
  // camera drag (orbit) and ignored by the picking handler.
  const CLICK_DRAG_SLOP = 6;
  const mouseDownPosRef = useRef(null);

  // Click animation state for coins
  const [clickedCoin, setClickedCoin] = useState(null);
  const coinAnimationState = useRef({
    Coin1: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin2: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin3: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin4: { isAnimating: false, startTime: 0, flutterIntensity: 0 }
  });
  
  // Eye mesh refs for blinking animation
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const blinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 3000 + 2000, // Random delay between 2-5 seconds
    isBlinking: false,
    blinkProgress: 0
  });

  // Head bone refs for look-at-camera override
  const demonHeadBoneRef = useRef();
  // Set true when the user has moved the camera away from the demon's
  // authored focus pose, so we skip the demon_pointing clip and instead
  // play idle with the head-look-at-camera override (mirrors Monk/RL80
  // tracking). Cleared on un-focus.
  const demonHeadTrackingRef = useRef(false);
  // Periodic-glance flag, independent of demonHeadTrackingRef so the
  // permanent camera-drift track and the glance scheduler don't clobber
  // each other. The per-frame look-at-camera override fires when EITHER
  // ref is true.
  const demonGlanceActiveRef = useRef(false);
  const demonFocusedRef = useRef(false); // true when camera is zoomed in on Demon
  const monkHeadBoneRef = useRef();
  const monkFocusedRef = useRef(false); // true when camera is zoomed in on Monk
  const rl80HeadBoneRef = useRef();
  const rl80JawBoneRef = useRef(); // Eugene's Jaw bone — amplitude lip-sync (Path A; inert until a jaw bone is added in Blender)
  const rl80MouthMeshRef = useRef(); // Code-made oval "mouth" anchored at her snout, scaled by amplitude (Path A2, no Blender)
  // The mouth overlay is added to the scene ROOT (scene.add), not this
  // component's <group>, so React won't reclaim it on unmount — it would
  // orphan into whatever mounts next (e.g. the TALK SHOW swap) as a stray
  // floating quad. Remove + dispose it explicitly when the scene tears down.
  useEffect(() => {
    return () => {
      const mouth = rl80MouthMeshRef.current;
      if (!mouth) return;
      mouth.removeFromParent();
      mouth.geometry?.dispose?.();
      mouth.material?.map?.dispose?.();
      mouth.material?.dispose?.();
      rl80MouthMeshRef.current = null;
    };
  }, []);
  const rl80FocusedRef = useRef(false); // true when camera is zoomed in on RL80
  const virgilHeadBoneRef = useRef();
  const detectiveHeadBoneRef = useRef();
  // Hint marker group refs (positioned each frame from the head bones)
  const rl80HintRef = useRef();
  const demonHintRef = useRef();
  const monkHintRef = useRef();
  const virgilHintRef = useRef();
  const detectiveHintRef = useRef();
  const virgilFocusedRef = useRef(false); // true when camera is zoomed in on Virgil
  const detectiveFocusedRef = useRef(false); // true when camera is zoomed in on Detective

  // SitePal-on-Demon overlay refs. Face1 is the regular face; Face2 is
  // the SitePal target (separate mesh with its own UVs tuned for the
  // avatar crop). Both meshes are captured at GLB load. The SitePal
  // material is built lazily and assigned to Face2; visibility is
  // toggled per-frame based on `useSitePalForDemon` so SitePal can stay
  // mounted (its global state breaks under script re-injection).
  const demonFace1MeshRef = useRef(null);
  const demonFace2MeshRef = useRef(null);
  // Brow / eyebrow meshes that aren't actually joined into Face1 yet
  // (or are intentionally a separate object). Hidden whenever Face2
  // is showing the SitePal avatar so they don't draw over its face.
  const demonBrowMeshesRef = useRef([]);

  // Monk SitePal refs (Face1/Face2/Eyes + per-character crop canvas). Eyes are
  // collected as an ARRAY — the mesh was split into MonkEyeR / MonkEyeL (two
  // objects sharing the MonkEyes geometry), so both must be hidden.
  const monkFace1MeshRef = useRef(null);
  const monkFace2MeshRef = useRef(null);
  const monkEyesMeshesRef = useRef([]);
  const monkSitePalRef = useRef({
    cropCanvas: null,
    cropCtx: null,
    texture: null,
    material: null,
    materialApplied: false,
  });

  // Detective SitePal refs (Face1/Face2 + per-character crop canvas).
  // The SitePal source element itself is SHARED with the Demon (single
  // host portal, scene-swapped via loadSceneByID), so detectiveSitePalRef
  // doesn't track its own sourceEl — it pulls from demonSitePalRef.sourceEl.
  const detectiveFace1MeshRef = useRef(null);
  const detectiveFace2MeshRef = useRef(null);
  const detectiveSitePalRef = useRef({
    cropCanvas: null,
    cropCtx: null,
    texture: null,
    material: null,
    materialApplied: false,
  });
  const demonSitePalRef = useRef({
    cropCanvas: null,
    cropCtx: null,
    texture: null,
    material: null,
    sourceEl: null,
    materialApplied: false,
  });

  // Demon eye mesh ref and blink state
  const demonEyesRef = useRef();
  // New-demon blink set: 'Eyes' mesh + 'Pupil_L'/'Pupil_R' (or shared
  // 'Pupil'). Opacity-faded together each blink. Stays empty if the rig
  // doesn't include those meshes — the per-frame blink block then no-ops.
  const demonBlinkMeshesRef = useRef([]);
  const demonBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000, // Random delay between 3-7 seconds
    isBlinking: false,
    blinkProgress: 0
  });

  // Detective eye mesh refs and blink state. Mesh-swap blink: Eyes is the
  // open mesh, Closedeyes is a narrower closed shape that takes over for the
  // blink frames. Reads cleaner than fading opacity (no momentary hole).
  // Refs stay null when the rig has no matching meshes — the per-frame
  // blink block is then a no-op.
  const detectiveEyesRef = useRef();
  const detectiveClosedEyesRef = useRef();
  const detectiveBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000,
    isBlinking: false,
  });

  // Unicorn eye mesh refs (L_EYE, R_EYE parented to head bone) — opacity blink
  const unicornEyesRef = useRef([]);
  // Unicorn glow target — cloned material(s) whose emissive pulses while the
  // Unicorn speaks (driven by playUnicornBeat via the unicornGlow bridge).
  const unicornGlowMatsRef = useRef([]);
  const unicornBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000,
    isBlinking: false,
    blinkProgress: 0
  });

  // One-shot Unicorn_waving greeting. Fired by the page (via the unicornWave
  // bridge) when Eugene speaks a "hello" greeting line — so the wave stays tied
  // to the words, not to every focus click. `timeoutId` tracks the pending
  // post-wave fade-back so un-focus (or a rapid re-greet) can cancel it.
  const unicornWaveStateRef = useRef({ timeoutId: null });

  // Play Eugene's one-shot greeting wave. The clip is additive (see the RL80
  // branch of the clip-loading section), so it layers on top of the running
  // idle/typing action — the body stays seated while the arm waves. No-op
  // unless Eugene is focused and his mixer is loaded.
  const playUnicornWave = useCallback(() => {
    if (!rl80FocusedRef.current) return;
    const rl80Actions = actionsRef.current['RL80'];
    if (!rl80Actions) return;
    const waveKey = Object.keys(rl80Actions).find(a => /wav/i.test(a));
    if (!waveKey) return;
    const wave = rl80Actions[waveKey];
    const timeScale = 0.75;
    const clipDurMs = wave.getClip().duration * 1000;
    const playedDurMs = clipDurMs / timeScale;
    const fadeInMs = Math.min(200, clipDurMs * 0.25);
    const fadeOutMs = 500;
    const fadeInS = fadeInMs / 1000;
    const fadeOutS = fadeOutMs / 1000;

    // Cancel a still-pending fade-back from a prior wave so rapid re-greets
    // don't leave the arm stuck mid-wave.
    if (unicornWaveStateRef.current.timeoutId) {
      clearTimeout(unicornWaveStateRef.current.timeoutId);
      unicornWaveStateRef.current.timeoutId = null;
    }

    wave.reset();
    wave.setLoop(THREE.LoopOnce, 1);
    wave.clampWhenFinished = true;
    wave.setEffectiveTimeScale(timeScale);
    wave.setEffectiveWeight(10);
    wave.fadeIn(fadeInS);
    wave.play();

    unicornWaveStateRef.current.timeoutId = setTimeout(() => {
      unicornWaveStateRef.current.timeoutId = null;
      if (!rl80FocusedRef.current) return;
      wave.fadeOut(fadeOutS);
    }, Math.max(50, playedDurMs - fadeOutMs));
  }, []);

  // Chained setTimeouts in the cat driver / sequences would outlive the
  // component and poke stale refs. Tear them down on unmount.
  useEffect(() => () => {
    stopCatBehaviour();
    stopAlternateSequence(catRevealSeqRef);
    stopAlternateSequence(monkCouncilSeqRef);
    stopAlternateSequence(demonRevealSeqRef);
    Object.keys(bridgeTimersRef.current || {}).forEach(stopBridge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register the wave player so the page can fire it in sync with a greeting.
  useEffect(() => registerUnicornWave(playUnicornWave), [playUnicornWave]);
  
  // Flame shader material refs (multiple flames in scene)
  const flameMaterialsRef = useRef([]);

  // Demon animation state (uses Root.001|* prefixed animations)
  const demonAnimStateRef = useRef({
    currentAnimation: 'Root.001|Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 8000,
  });

  // Cat (Virgil) animation state. He has no random alternation — this exists
  // so applyCharacterReaction / restoreCharacterIdle can track him like the
  // other characters during the curtain call.
  const virgilAnimStateRef = useRef({
    currentAnimation: 'cat_loaf',
    lastSwitchTime: 0,
    nextSwitchDelay: 999999,
    isPlayingSpecial: false,
  });

  // RL80 animation state
  const rl80AnimStateRef = useRef({
    currentAnimation: 'Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 8000 + 12000,
    recentAnimations: [],
    isPlayingSpecial: false,
  });

  // Monk animation state (uses *_monk suffixed animations)
  const monkAnimStateRef = useRef({
    currentAnimation: 'typing_monk',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 15000,
  });

  // Detective animation state — alternates detective_typing (loop) and
  // detective_idle (loop) when idle, holds detective_idle while focused.
  const detectiveAnimStateRef = useRef({
    currentAnimation: 'detective_typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 8000 + 8000,
    isPlayingSpecial: false,
  });

  // THE PITCH BOT. Two clips only — `idle` (8.37s) and `talking` (14.17s) — so
  // there is no rotation to schedule; `speechActive` picks one. Neither clip
  // touches the face plate, so a pressure-band texture swap can never fight the
  // mixer.
  const pitchBotRef = useRef(null);
  const pitchBotAnimStateRef = useRef({
    currentAnimation: 'idle',
    lastSwitchTime: 0,
    nextSwitchDelay: 999999,
    isPlayingSpecial: false,
  });

  // Monk attention-getting one-shot (clip name "Pointing_Monk"). Plays
  // every few seconds before the user has clicked the monk for focus — used
  // to attract the user into starting the game flow. Once focused, firing
  // stops permanently for that session.
  const monkWaveStateRef = useRef({
    nextFireTime: 0,           // ms epoch when the next wave should fire
    hasBeenFocused: false,     // becomes true on first focus → no more waves
    everInitialized: false,    // becomes true after the first delay schedule
    hailsUntilBeckon: 4 + Math.floor(Math.random() * 2), // beckon fires every 4–5 hails
    attentionActive: false,    // true while the hail/idle/beckon cycle is running — gates head tracking
  });

  // Price tracking for buy-triggered animations (H80Z FistPump on buys)
  const lastPriceRef = useRef(null);
  const priceCheckIntervalRef = useRef(null);

  // Refs for PalmTree meshes - store multiple instances
  const palmTreeRefs = useRef([]);
  
  
  /* WIDTH ONLY — the UA sniff was removed 2026-08-02, and it was causing a real bug.
   *
   * `detectedMobile` feeds exactly two things (MOBILE_CAMERA_OFFSET.y and the
   * focus FOV), and that offset exists to compensate for the workstation model's
   * MOBILE-LAYOUT vertical shift. The layout is chosen by VIEWPORT WIDTH — that is
   * what page.js's `isMobileView` uses — so keying the compensation off a device
   * string could and did disagree with the thing it compensates for.
   *
   * THE SYMPTOM was a 0.7 discrepancy nobody could place: the camera tuning panel
   * previews with the offset explicitly off and looked correct, while clicking the
   * same character in the scene landed 0.7 units high. `isOnMobile` is
   * `isMobile || detectedMobile`, so the UA arm flipped it true at ANY window size
   * — and the regex matched `ipad`, which this repo already knows reports a
   * DESKTOP user agent (see the /trade perf-tier work, which switched to pointer
   * type for the same reason).
   *
   * If a real touch-device case needs this back, use `(pointer: coarse)` rather
   * than a UA string, and gate it on width as well so a wide window never gets a
   * layout compensation it has no layout for.
   */
  useEffect(() => {
    const checkMobile = () => {
      setDetectedMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mirror the `gameStarted` prop into a ref so `activateSitePalProjection`
  // (called from a useEffect-captured click handler) always reads the latest
  // value. Without this, the click handler closes over a stale `gameStarted`
  // and the "meet" lines could fire mid-game (or vice versa).
  const gameStartedRef = useRef(gameStarted);
  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  // Gates per-character head-tracks-camera override in the useFrame blocks
  // below. We want the head to follow the camera ONLY while the character
  // is actively speaking (idle anim) — during the typing anim between
  // speech beats, we let the animation drive the head naturally so the
  // character appears to look down at their station, not at the player.
  // Lobby clicks (gameStarted=false) track from the moment of focus through
  // the end of the character's intro line; once `lobbyIntroDone` latches they
  // release along with their animation and go back to looking at their work.
  //
  // In the lobby this keys ONLY off `lobbyIntroDone` — deliberately not
  // `|| speechActive`. The lobby meet-lines are played by the SitePal pipeline
  // rather than the parent, so `speechActive` is unreliable on that path and
  // can sit stuck true after the line ends; OR-ing it in pinned the gaze open
  // forever even though the animation had already been handed back to typing
  // (the exact split symptom: she resumes typing but keeps staring).
  const shouldTrackHeadRef = useRef(true);
  useEffect(() => {
    shouldTrackHeadRef.current = gameStarted ? speechActive : !lobbyIntroDone;
  }, [gameStarted, speechActive, lobbyIntroDone]);

  // Mirrors revealMode into a ref so per-frame head-tracking gates can flip
  // every character into camera-follow during the curtain call without
  // needing the focus refs to be set.
  const revealModeRef = useRef(null);
  useEffect(() => {
    revealModeRef.current = revealMode;
  }, [revealMode]);

  const activateSitePalProjection = (characterId) => {
    const config = SITEPAL_PROJECTION_CONFIG[characterId];
    if (!config || typeof window === 'undefined') return;
    try {
      if (typeof window.saySilent === 'function') window.saySilent(0);
      if (window.__sitePalSpeechRetryTimer) {
        clearTimeout(window.__sitePalSpeechRetryTimer);
        window.__sitePalSpeechRetryTimer = null;
      }
      window.__sitePalActiveSpeech = null;
      if (typeof window.stopSpeech === 'function') {
        try { window.stopSpeech(); } catch (e) {}
      }
      if (window.__sitePalPreloading) {
        window.__sitePalPreloading = false;
        window.__sitePalPreloadQueue = null;
      }

      // Game mode: skip the random "meet" line — the parent's speakLine
      // path drives all in-game speech (intro / return / answer / reaction /
      // vindication). We still need to load the right SitePal scene so the
      // face overlay animates the right character.
      //
      // Volume stays at the normal 7 so sayText/sayAudio works downstream.
      // To prevent vh_sceneLoaded from auto-playing the scene's default
      // meet-line audio, we set pending speech to a `type:'audio'` request
      // with a null audioName — runSpeechRequest's `type === 'audio' &&
      // audioName` guard then fails through every branch, the request
      // result is null, the retry timer fires a few silent attempts and
      // gives up. Meanwhile the parent's speakLine fires its real game
      // speech ~900ms after focus, which overwrites the no-op via token
      // semantics so the retries bail out on their next tick.
      const inGame = gameStartedRef.current;
      if (inGame) {
        window.__sitePalDesiredVolume = 7;
        window.__sitePalPendingSpeech = {
          characterId,
          sceneId: config.sceneId,
          speech: { type: 'audio', audioName: null },
        };
        const targetSceneId = config.sceneId;
        const sameScene = window.__sitePalCurrentSceneId === targetSceneId;
        if (sameScene && window.__sitePalSceneLoaded === true) {
          // Same scene already up — nothing to do; the parent's speakLine
          // will fire the game audio shortly.
        } else if (window.__sitePalSceneLoaded === true && typeof window.loadSceneByID === 'function') {
          window.__sitePalSceneLoaded = false;
          window.loadSceneByID(targetSceneId);
        }
        return;
      }

      // Lobby mode — pick a random meet-line and play it on scene load.
      window.__sitePalDesiredVolume = 7;
      const dynamicSpeech = window.__sitePalSpeechOverrides?.[characterId];
      let resolvedSpeech = dynamicSpeech || config.speech || { type: 'scene' };
      // If the character has an audioNames array, pick one (avoiding the
      // last index used for this character) so repeated clicks vary the
      // line. audioName takes precedence if explicitly set on speech.
      if (!resolvedSpeech.audioName && Array.isArray(config.audioNames) && config.audioNames.length > 0) {
        const names = config.audioNames;
        const lastIdxMap = (window.__sitePalLastAudioIdx ||= {});
        const last = lastIdxMap[characterId];
        let idx = Math.floor(Math.random() * names.length);
        if (names.length > 1 && idx === last) idx = (idx + 1) % names.length;
        lastIdxMap[characterId] = idx;
        resolvedSpeech = { ...resolvedSpeech, type: 'audio', audioName: names[idx] };
      }
      window.__sitePalPendingSpeech = {
        characterId,
        sceneId: config.sceneId,
        speech: resolvedSpeech,
      };
      const targetSceneId = config.sceneId;
      const sameScene = window.__sitePalCurrentSceneId === targetSceneId;
      // console.log(`[${characterId} click] sceneLoaded=`, window.__sitePalSceneLoaded,
      //   'currentSceneId=', window.__sitePalCurrentSceneId,
      //   'targetSceneId=', targetSceneId, 'sameScene=', sameScene);
      if (sameScene && window.__sitePalSceneLoaded === true) {
        try { if (typeof window.setPlayerVolume === 'function') window.setPlayerVolume(7); } catch (e) { console.warn(`[${characterId}] setPlayerVolume err`, e); }
        try { if (typeof window.__sitePalSpeakPending === 'function') window.__sitePalSpeakPending(window.__sitePalCurrentAudioName || null); } catch (e) { console.warn(`[${characterId}] speak err`, e); }
      } else if (window.__sitePalSceneLoaded === true && typeof window.loadSceneByID === 'function') {
        window.__sitePalSceneLoaded = false;
        // console.log(`[${characterId} click] loadSceneByID`, targetSceneId);
        window.loadSceneByID(targetSceneId);
      }
    } catch (e) {
      // console.warn(`[${characterId} click err]`, e);
    }
  };

  // Poll rl80 price to detect buys — trigger H80Z (Demon) FistPump on price increase
  useEffect(() => {
    const triggerH80ZFistPump = () => {
      const demonActions = actionsRef.current['Demon'];
      if (!demonActions) return;

      // Find the FistPump animation (Demon uses Root.001|* prefix)
      const fistPumpKey = Object.keys(demonActions).find(a => /fistpump/i.test(a));
      if (!fistPumpKey) return;

      const demonState = demonAnimStateRef.current;
      // Don't interrupt if already playing a special animation
      if (demonState.isPlayingSpecial) return;

      // Fade out current animation
      if (demonActions[demonState.currentAnimation]) {
        demonActions[demonState.currentAnimation].fadeOut(0.5);
      }

      const fistPump = demonActions[fistPumpKey];
      fistPump.reset();
      fistPump.fadeIn(0.5);
      fistPump.setLoop(THREE.LoopOnce, 1);
      fistPump.clampWhenFinished = true;
      fistPump.play();

      demonState.currentAnimation = fistPumpKey;
      demonState.isPlayingSpecial = true;
      demonState.nextSwitchDelay = 999999;
      demonState.lastSwitchTime = Date.now();

      const animDuration = fistPump.getClip().duration * 1000;
      setTimeout(() => {
        const loopAnims = Object.keys(demonActions).filter(a =>
          /typing|idle/i.test(a) && !/sit_idle|stand/i.test(a) && !TRANSITION_RE.test(a));
        const returnAnim = loopAnims.length > 0
          ? loopAnims[Math.floor(Math.random() * loopAnims.length)]
          : Object.keys(demonActions)[0];
        if (demonActions[returnAnim]) {
          fistPump.fadeOut(0.5);
          demonActions[returnAnim].stop();
          demonActions[returnAnim].reset();
          demonActions[returnAnim].setLoop(THREE.LoopRepeat);
          demonActions[returnAnim].setEffectiveWeight(1);
          demonActions[returnAnim].play();
        }
        demonState.currentAnimation = returnAnim;
        demonState.isPlayingSpecial = false;
        demonState.nextSwitchDelay = Math.random() * 8000 + 6000;
        demonState.lastSwitchTime = Date.now();
      }, Math.max(100, animDuration - 500));
    };

    const checkPrice = async () => {
      try {
        const res = await fetch('/api/rl80-price');
        if (!res.ok) return;
        const data = await res.json();
        if (data.price == null) return;

        const currentPrice = parseFloat(data.price);
        const prevPrice = lastPriceRef.current;
        lastPriceRef.current = currentPrice;

        // If we have a previous price and new price is higher → buy detected.
        // Skipped when FistPump is reserved for slot-machine jackpots only.
        if (prevPrice !== null && currentPrice > prevPrice && !jackpotOnlyFistPump) {
          triggerH80ZFistPump();
        }
      } catch {
        // Silently ignore fetch errors
      }
    };

    // Initial fetch to seed the price (no animation on first load)
    checkPrice();
    // Poll every 15 seconds
    priceCheckIntervalRef.current = setInterval(checkPrice, 15000);

    // Slot machine 3-of-a-kind on /trade also triggers the same fist pump —
    // SlotMachineScreen dispatches this window event on a win.
    const onJackpot = () => triggerH80ZFistPump();
    window.addEventListener('slotMachineJackpot', onJackpot);

    return () => {
      if (priceCheckIntervalRef.current) {
        clearInterval(priceCheckIntervalRef.current);
      }
      window.removeEventListener('slotMachineJackpot', onJackpot);
    };
  }, []);

  // Use prop or detected mobile state
  const isOnMobile = isMobile || detectedMobile;

// Expose the loaded model and camera control functions through ref
  /* useImperativeHandle(ref, () => ({
    current: loadedModel,
    focusOnAgent: (agentId) => {
      // Focus on a specific agent programmatically
      let targetRef = null;
      
      if (agentId === 'RL80' && ourLadyRef.current) {
        targetRef = ourLadyRef.current;
      } else if (agentId === 'Mike' && cube010MeshRef.current) {
        targetRef = cube010MeshRef.current;
      }
      
      if (targetRef) {
        const objectWorldPos = new THREE.Vector3();
        targetRef.getWorldPosition(objectWorldPos);
        
        // Calculate camera position relative to the object
        const cameraOffset = new THREE.Vector3(2, 0.5, 3);
        const cameraPosition = objectWorldPos.clone().add(cameraOffset);
        
        setFocusTarget({
          position: cameraPosition,
          lookAt: objectWorldPos,
          agentId: agentId,
          agentName: agentId
        });
      }
    },
    resetCamera: () => {
      // Reset camera to original position
      setFocusTarget(null);
      if (originalCameraPosition.current) {
        camera.position.copy(originalCameraPosition.current);
        camera.lookAt(0, 0, 0);
      }
    }
  }), [loadedModel, camera]); */

  // Define annotation points - adjust positions based on your temple scene
  

  useEffect(() => {
    if (hasLoadedRef.current) return;

    // What we actually attached the temple to, held in the effect's own scope.
    // The cleanup below CANNOT read groupRef.current: React detaches refs
    // before running effect cleanups, so it was always null there and the
    // entire disposal block was silently skipped. Every LT TV round trip
    // stranded a whole temple's worth of GPU memory as a result — measured at
    // +66 textures and +96 geometries per trip, on top of a JS heap that grew
    // with it.
    let attachedTemple = null;

    // Stall-watchdog state, at effect scope so the cleanup can reach it. A
    // truncated CDN cache entry stalls the GLB download mid-body with the
    // connection still open: fetch neither resolves nor rejects, so the
    // error-path retries below never run and the loader spins forever (this
    // took /trade down on 2026-08-01). The watchdog tracks byte progress and,
    // when it stops, abandons the attempt and retries with a cache-busting
    // query — which bypasses the poisoned edge entry.
    let attemptId = 0;
    let loadSettled = false;
    let lastProgressAt = 0;
    let stallRetries = 0;
    const maxStallRetries = 3;
    let stallWatchdog = null;

    // Small delay to ensure the ref is attached after first render
    const timer = setTimeout(async () => {
      if (!groupRef.current) {
        console.error('[CyborgTempleScene] groupRef.current is still null after mount');
        return;
      }

      hasLoadedRef.current = true;
      const currentGroupRef = groupRef.current; // Capture the ref value

    // Temporarily suppress THREE.js warnings during model loading
    const originalWarn = console.warn;
    const suppressAnimationWarnings = (message) => {
      if (typeof message === 'string' && 
          message.includes('THREE.PropertyBinding') && 
          message.includes('No target node found')) {
        return; // Suppress animation binding warnings
      }
      return originalWarn.apply(console, arguments);
    };

    const gltfLoader = new GLTFLoader();
    
    // Always use DRACO loader since both models may have compression
    const dracoLoader = new DRACOLoader();
    // Use full URL for Draco decoder in production to avoid path issues
    const dracoPath = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `${window.location.origin}/draco/`
      : "/draco/";
   
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);
    // Required for the optimized V2 model — gltf-transform re-encodes its
    // meshes with EXT_meshopt_compression instead of Draco. Await
    // MeshoptDecoder.ready so the WASM module is fully initialized before
    // load() runs; on Android Chrome the load can otherwise race the WASM
    // init and silently fail (no callback fires, model never appears).
    // Bound the await with a 5s timeout so a hung WASM init doesn't hang
    // the entire page — the un-opt fallback model doesn't need Meshopt.
    try {
      await Promise.race([
        MeshoptDecoder.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('MeshoptDecoder.ready timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      console.warn('[CyborgTempleScene] MeshoptDecoder init failed/timed out:', e?.message || e);
    }
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // V2 model further optimized via gltf-transform (Meshopt + WebP textures
    // + dedup/weld) — ~3 MB instead of ~5 MB so mobile cellular completes the
    // download before iOS Safari times out. Falls back to the un-optimized
    // V2 if the opt build is missing on the deploy.
    // V3 "lite" — same v98 geometry/rig/animations as the _opt build (verified
    // identical: 64,203 verts, 19 skins, 55 animations, 9,267 anim channels),
    // with the flat/low-detail maps downscaled. GPU texture memory is driven by
    // DIMENSIONS, not file size: several of the _opt build's 1024² maps were
    // 2-8KB on disk (near-flat) yet cost ~5.3MB each in VRAM with mipmaps. The
    // lite build is ~38MB of decoded textures instead of ~80MB — the difference
    // between fitting and not fitting on an iPad. Rebuild:
    //   gltf-transform resize in.glb a.glb --width 256 --height 256 \
    //     --pattern "@(Image_5|Image_9|Image_13|Image_11|Polygon_Mask_Texture|eyeYellow_512)"
    //   gltf-transform resize a.glb b.glb --width 512 --height 512 \
    //     --pattern "@(Image_0|Image_3|PolygonCyberCity_02_C_Emissive|DiffuseColor_Texture_17_002_recover)"
    //   gltf-transform meshopt b.glb out.glb --level medium
    let modelPath = TEMPLE_MODEL_URL;
    const fallbackModelPath = TEMPLE_MODEL_FALLBACK_URL;
    let usingFallback = false;
    const startTime = performance.now();
    
    // Log detailed information about the loading attempt
    
    // First, verify the model file is accessible
    fetch(modelPath, { 
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-cache' // Bypass cache to ensure we get fresh response
    })
      .then(response => {
        // console.log(`[CyborgTempleScene] HEAD request response:`, {
        //   ok: response.ok,
        //   status: response.status,
        //   statusText: response.statusText,
        //   headers: Object.fromEntries(response.headers.entries())
        // });
        if (!response.ok) {
          throw new Error(`Model file not accessible: ${response.status} ${response.statusText}`);
        }
      })
      .catch(error => {
        console.error(`[CyborgTempleScene] Failed to verify model file:`, error);
        console.error(`[CyborgTempleScene] This may indicate a server configuration issue in production.`);
      });
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const loadModel = (attemptFullUrl = false, cacheBust = false) => {
      // In production, sometimes relative paths fail, so we try with full URL as fallback
      let urlToLoad = attemptFullUrl && typeof window !== 'undefined'
        ? `${window.location.origin}${modelPath}`
        : modelPath;
      if (cacheBust) {
        urlToLoad += `${urlToLoad.includes('?') ? '&' : '?'}r=${Date.now()}`;
      }

      // Arm the stall watchdog for this attempt. Callbacks from a superseded
      // attempt (the hung request lingers — it can't be aborted through
      // GLTFLoader) are ignored via the attemptId token.
      const thisAttempt = ++attemptId;
      lastProgressAt = performance.now();
      if (stallWatchdog) clearInterval(stallWatchdog);
      stallWatchdog = setInterval(() => {
        if (loadSettled || thisAttempt !== attemptId) { clearInterval(stallWatchdog); return; }
        if (performance.now() - lastProgressAt < 15000) return;
        clearInterval(stallWatchdog);
        if (stallRetries >= maxStallRetries) {
          console.error('[CyborgTempleScene] Model download stalled and cache-busted retries are exhausted.');
          return;
        }
        stallRetries++;
        console.warn(`[CyborgTempleScene] Model download stalled (no bytes for 15s) — retrying with cache-busting URL (${stallRetries}/${maxStallRetries})...`);
        loadModel(false, true);
      }, 5000);

      gltfLoader.load(
      urlToLoad,
      (gltf) => {
        if (loadSettled || thisAttempt !== attemptId) return; // superseded by a stall retry
        loadSettled = true;
        clearInterval(stallWatchdog);
        const loadTime = performance.now() - startTime;
        
        // Log successful load
        if (usingFallback) {
          console.warn(`[CyborgTempleScene] Successfully loaded fallback desktop model on mobile device`);
        } else {
          // console.log(`[CyborgTempleScene] Successfully loaded ${isOnMobile ? 'mobile' : 'desktop'} model in ${loadTime.toFixed(0)}ms`);
        }
        
        const templeScene = gltf.scene;

      // ── TEMP smoke test for v43 import (reveal flow) ──
      // Remove once StageProps + reaction clips are verified.
      const _stageProps = templeScene.getObjectByName('StageProps');
      // console.log('[reveal-smoke] StageProps node:', _stageProps);
      // console.log('[reveal-smoke] StageProps child count:', _stageProps ? _stageProps.children.length : 'NOT FOUND');
      // console.log('[reveal-smoke] animation clips:', gltf.animations.map(a => a.name));

      
      const _expected = [
        'monk_standPray', 'monk_cheering',
        'demon_clapping', 'demon_disappointed', 'demon_shrug',
        'detective_clap', 'detective_defeat',
        'unicorn_dancing', 'unicorn_disappointed',
      ];

      const _cheer = gltf.animations.find(a => a.name === 'monk_cheering');
const _stand = gltf.animations.find(a => a.name === 'monk_standPray');
// console.log('[reveal-smoke] monk_cheering tracks:', _cheer?.tracks.length, _cheer?.tracks.map(t => t.name));
// console.log('[reveal-smoke] monk_standPray tracks:', _stand?.tracks.length, _stand?.tracks.map(t => t.name));
      const _present = new Set(gltf.animations.map(a => a.name.toLowerCase()));
      const _missing = _expected.filter(n => ![..._present].some(p => p.includes(n.toLowerCase())));
      // console.log('[reveal-smoke] missing reaction clips:', _missing.length ? _missing : 'none — all present');
      if (typeof window !== 'undefined') {
        window.__templeScene = templeScene;
        window.__gltf = gltf;
        window.__debugMonkBones = () => {
          const clip = window.__gltf.animations.find(a => a.name === 'idle_monk');
          const trackBones = [...new Set(clip.tracks.map(t => t.name.split('.')[0]))].slice(0, 15);

          const monk = window.__gltf.scene.getObjectByName('Monk_empty')
                    || window.__gltf.scene.getObjectByName('Armature_001')
                    || window.__gltf.scene.getObjectByName('Armature.001');
          const monkBones = [];
          monk?.traverse(n => { if (n.isBone) monkBones.push(n.name); });

          const missing = trackBones.filter(b => !monkBones.includes(b));
          return {
            monkRootName: monk?.name,
            trackBones,
            monkBonesSample: monkBones.slice(0, 15),
            monkBoneCount: monkBones.length,
            trackBonesNotFoundInMonk: missing,
          };
        };
      }

      // Store the loaded model in state for external access
      setLoadedModel(templeScene);
      
      // Create an anchor group for positioning — same desktop model on both
      // mobile and desktop for now. Named so companions that live in the scene
      // but aren't parented to the temple (TickerDisplay3's ring) can check
      // whether a temple is actually on screen before drawing themselves.
      const anchorGroup = new THREE.Group();
      anchorGroup.name = TEMPLE_ANCHOR_NAME;
      anchorGroup.position.set(0, 0.3, 0);
      anchorGroup.rotation.set(0, 0, 0);
      anchorGroup.scale.set(1, 1, 1);
      
      // Add the temple scene to the anchor group
      anchorGroup.add(templeScene);
      
      // First, identify all animated characters and create mixers for each
      const animatedCharacters = {};

      // Capture each character's REST head pose at load. The head-tracking
      // override math relies on a stable rest reference for the rotation
      // clamp; without this, refs would re-capture mid-animation when their
      // gate first fires (e.g. when the curtain call enables tracking on
      // characters that were never focused), producing a near-zero clamp
      // that visibly stalls the look-at.
      const captureHeadRestPose = (boneRef) => {
        const bone = boneRef?.current;
        if (!bone) return;
        boneRef._baseQuat = bone.quaternion.clone();
        bone.updateWorldMatrix(true, false);
        boneRef._baseWorldQuat = new THREE.Quaternion();
        bone.getWorldQuaternion(boneRef._baseWorldQuat);
      };

      // Find all animated objects in the scene
      templeScene.traverse((child) => {
        if (child.name === 'RL80_Empty' || child.name === 'Unicorn_Empty') {
          animatedCharacters['RL80'] = child;
          // Gather head-bone candidates, then prefer exact "head" → non-leaf
          // → first match. Naive first-/head/i would grab unskinned leaves
          // like Head_end / HeadTip and silently no-op the look-at.
          const rl80HeadCandidates = [];
          child.traverse((bone) => {
            if (bone.isBone && /head/i.test(bone.name)) rl80HeadCandidates.push(bone);
          });
          // V2 model fallback: the unicorn's Mixamo armature (Root_1 with
          // mixamorig* bones) is a SIBLING of Unicorn_Empty in the scene
          // root, not a descendant. The traversal above only walks
          // RL80_Empty/Unicorn_Empty children, so on the V2 build it finds
          // zero candidates and rl80HeadBoneRef ends up null — which
          // silently breaks anything that depends on her head position
          // (the head-tracks-camera look-at, the lobby chat-bubble
          // anchor). Mirror the armature lookup used below for the
          // 90°-rotation fix-up and harvest head bones from there too.
          if (rl80HeadCandidates.length === 0) {
            const unicornArmature =
              templeScene.getObjectByName('Root_1') ||
              templeScene.getObjectByName('Root_1.001') ||
              templeScene.getObjectByName('Armature_Unicorn');
            if (unicornArmature) {
              unicornArmature.traverse((bone) => {
                if (bone.isBone && /head/i.test(bone.name)) rl80HeadCandidates.push(bone);
              });
            }
          }
          rl80HeadBoneRef.current =
            rl80HeadCandidates.find(b => /^head$/i.test(b.name)) ||
            rl80HeadCandidates.find(b => /mixamorig.*head/i.test(b.name) && !/(_?end|_?tip|_?nub)$/i.test(b.name)) ||
            rl80HeadCandidates.find(b => !/(_?end|_?tip|_?nub)$/i.test(b.name)) ||
            rl80HeadCandidates[0] ||
            null;
          if (!rl80HeadBoneRef.current) {
            console.warn('[CyborgTempleScene] RL80 head bone not found — head-anchored UI will park off-screen');
          }
          captureHeadRestPose(rl80HeadBoneRef);

          // Jaw bone for amplitude lip-sync (Path A). IMPORTANT: the base GLB's
          // `Jaw`/`Jaw_2` bones belong to the DETECTIVE and MONK rigs, NOT the
          // unicorn — her own rig (under Unicorn_Empty) is a plain Mixamo
          // skeleton with mixamorig:Head and NO jaw. So this search (scoped to
          // her subtree) currently finds nothing and the lip-sync no-ops. It's a
          // ready harness: add a jaw bone named `Jaw*` parented under the
          // unicorn head in Blender, re-export, and it activates automatically.
          // We prefer a jaw parented to her resolved head bone to be safe.
          const rl80JawCandidates = [];
          child.traverse((bone) => {
            if (bone.isBone && /^jaw/i.test(bone.name)) rl80JawCandidates.push(bone);
          });
          if (rl80JawCandidates.length === 0) {
            const unicornArmature =
              templeScene.getObjectByName('Root_1') ||
              templeScene.getObjectByName('Root_1.001') ||
              templeScene.getObjectByName('Armature_Unicorn');
            if (unicornArmature) {
              unicornArmature.traverse((bone) => {
                if (bone.isBone && /^jaw/i.test(bone.name)) rl80JawCandidates.push(bone);
              });
            }
          }
          rl80JawBoneRef.current =
            rl80JawCandidates.find(b => b.parent === rl80HeadBoneRef.current) ||
            rl80JawCandidates[0] ||
            null;
          // Capture the jaw's REST (closed-mouth) local quaternion; the useFrame
          // lip-sync opens from this each frame. captureHeadRestPose stores it
          // as `_baseQuat` — reuse it.
          captureHeadRestPose(rl80JawBoneRef);
          if (!rl80JawBoneRef.current) {
            console.warn('[CyborgTempleScene] RL80 jaw bone not found (expected — unicorn has no jaw bone); using the code-made oval mouth instead');
          }

          // Code-made "mouth" (Path A2, no Blender): a FLAT dark disc anchored at
          // her snout that scales open with speech amplitude. She has no jaw
          // bone/morphs, so we overlay a simple primitive and drive its vertical
          // scale from unicornMouth.value. A flat CircleGeometry (not a sphere)
          // so it can never read as a chunky round blob — closed it's a thin
          // line, open it's an ellipse. Its +Z normal is aimed at the muzzle via
          // the tunable rotation below. Created once, added to the R3F scene
          // root, positioned/scaled/oriented each frame in useFrame from the
          // head bone. Guard against re-creation on re-runs.
          if (!rl80MouthMeshRef.current) {
            // A flat quad whose texture is a CANVAS we redraw each frame: a dark
            // maw + a few blocky upper teeth. Drawing the openness on the canvas
            // (rather than scaling the mesh in Y) keeps the teeth a fixed shape
            // instead of stretching. The mesh stays a fixed size; drawUnicornMouth
            // animates the interior. PlaneGeometry(2,2) matches the old disc's
            // extent so the tuned width/maxH still read about the same.
            const mouthCanvas = document.createElement('canvas');
            mouthCanvas.width = 160;
            mouthCanvas.height = 160;
            const mouthTex = new THREE.CanvasTexture(mouthCanvas);
            mouthTex.colorSpace = THREE.SRGBColorSpace;
            const mouthGeo = new THREE.PlaneGeometry(2, 2); // faces +Z; canvas mapped on
            const mouthMat = new THREE.MeshBasicMaterial({
              map: mouthTex,
              transparent: true,
              depthWrite: false,          // an overlay on the snout, don't fight its depth
              side: THREE.DoubleSide,     // visible whichever way it ends up facing
            });
            const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
            mouthMesh.name = 'RL80_MouthOverlay';
            mouthMesh.renderOrder = 6;
            mouthMesh.frustumCulled = false;
            mouthMesh.visible = false;    // shown once positioned in useFrame
            mouthMesh._canvas = mouthCanvas;
            mouthMesh._ctx = mouthCanvas.getContext('2d');
            mouthMesh._tex = mouthTex;
            mouthMesh._lastDraw = -1;     // last openness drawn (redraw throttle)
            scene.add(mouthMesh);
            rl80MouthMeshRef.current = mouthMesh;
          }
          // V2 model: the unicorn's mesh sits under Unicorn_Empty but its
          // Mixamo armature (Root_1, with mixamorig* bones) is a SIBLING in
          // the scene root — so we wire its descendant meshes to the click
          // pipeline as RL80 here, and the mixer is anchored at the scene
          // root below so it can reach the bones.
          if (child.name === 'Unicorn_Empty') {
            child.traverse((obj) => {
              if (obj.isMesh) {
                obj.userData.clickable = true;
                obj.userData.agentId = 'RL80';
                obj.userData.agentName = 'RL80';
                if (!ourLadyRef.current) ourLadyRef.current = obj;
              }
            });
            // Author-fix: unicorn ships facing 90° off. Rotate the
            // *armature* (Root_1 sibling) — the mesh is skinned to those
            // bones, so rotating Unicorn_Empty has no visible effect.
            // +Math.PI/2 = 90° CCW viewed from above (Y-up, right-handed).
            const unicornArmature =
              templeScene.getObjectByName('Root_1') ||
              templeScene.getObjectByName('Root_1.001') ||
              templeScene.getObjectByName('Armature_Unicorn');
            if (unicornArmature) {
              unicornArmature.rotation.y += Math.PI / 2;
            } else {
              console.warn('[CyborgTempleScene] Unicorn armature (Root_1) not found — rotation skipped');
            }
          }
        }
        else if (child.name === 'Demon_Empty' || child.name === 'Devil_empty' || child.name === 'Devil_Empty') {
          animatedCharacters['Demon'] = child;
          // Find head bone in the Demon skeleton — used by the
          // AnnotationSystem to anchor hint markers above the demon's head.
          const headCandidates = [];
          child.traverse((obj) => {
            if (obj.isBone) {
              if (/head/i.test(obj.name)) headCandidates.push(obj);
              return;
            }
            // Capture Face1 + Face2 for the SitePal overlay. Face1 is
            // the regular face (visible by default). Face2 receives the
            // SitePal canvas texture and is hidden until activation.
            // Loose matcher tolerates Blender-suffixed names like
            // 'Face1.001' / 'Face2_1' that some glTF exports produce
            // when a mesh shares its data block with another node.
            // Face1 capture: match any Object3D (Mesh OR Group). When
            // Face1 has multiple materials, GLTFLoader exports it as
            // a Group named "Face1" with one child Mesh per material,
            // so a `obj.isMesh` check would miss it entirely. Setting
            // the Group's `visible = false` hides all descendants —
            // the renderer skips any object whose ancestor is hidden.
            if ((obj.isMesh || obj.isGroup) &&
                /^face1([._]\w+)?$/i.test(obj.name || '') &&
                !demonFace1MeshRef.current) {
              demonFace1MeshRef.current = obj;
            }
            if (obj.isMesh && /^face2([._]\w+)?$/i.test(obj.name || '') && !demonFace2MeshRef.current) {
              demonFace2MeshRef.current = obj;
              obj.visible = false; // hidden until SitePal activates
            }
            // Catch any brow / eyebrow mesh that wasn't actually joined
            // into Face1 (the GLB sometimes exports them as a separate
            // mesh even after a Blender Join, especially when they
            // shared a different armature parent).
            if (obj.isMesh && /brow/i.test(obj.name || '')) {
              demonBrowMeshesRef.current.push(obj);
            }
            // Eyes + pupils get cloned materials and pushed to the blink
            // set. Cloning so opacity tweaks don't propagate to any other
            // mesh that happens to share the original material instance.
            // Loose matcher: any mesh whose name contains "eye" or "pupil"
            // (handles Blender suffixes like Eyes.001 / Eyes_1 / EyeBalls).
            if (obj.isMesh && /eye|pupil/i.test(obj.name || '')) {
              if (obj.material) {
                obj.material = Array.isArray(obj.material)
                  ? obj.material.map((m) => {
                      const c = m.clone();
                      c.transparent = true;
                      c.needsUpdate = true;
                      return c;
                    })
                  : (() => {
                      const c = obj.material.clone();
                      c.transparent = true;
                      c.needsUpdate = true;
                      return c;
                    })();
              }
              demonBlinkMeshesRef.current.push(obj);
            }
          });
          // Prefer exact "head", then anything that isn't an end/tip leaf
          // (Head_end / HeadTip / HeadNub bones don't get rotation tracks
          // in animations and cause jitter when picked as the look-at
          // target). Fall back to whatever we found.
          demonHeadBoneRef.current =
            headCandidates.find(b => /^head$/i.test(b.name)) ||
            headCandidates.find(b => !/(_?end|_?tip|_?nub)$/i.test(b.name)) ||
            headCandidates[0] ||
            null;
          captureHeadRestPose(demonHeadBoneRef);

          // One-shot inventory: dumps every named Mesh / Group under
          // Demon_Empty so we can see exactly what's there (helpful
          // when GLTFLoader splits a multi-material mesh into a
          // Group + child Meshes after a Blender Join). Format:
          // "name (kind) [matCount]" — kind is M for Mesh, G for Group.
          const meshInventory = [];
          child.traverse((o) => {
            if (o === child) return;
            if (o.isMesh) {
              const matCount = Array.isArray(o.material) ? o.material.length : 1;
              meshInventory.push(`${o.name || '<unnamed>'} (M) [${matCount}]`);
            } else if (o.isGroup && o.name) {
              meshInventory.push(`${o.name} (G)`);
            }
          });
          // console.log('[Demon meshes]', meshInventory.join(', '));
        }
        else if (child.name === 'Monk_empty') {
          animatedCharacters['Monk'] = child;
          // Find head bone in Monk skeleton for look-at-camera. Smart
          // selection (exact "head" → non-leaf → first match) avoids
          // grabbing unskinned leaves that wouldn't visibly rotate.
          const monkHeadCandidates = [];
          child.traverse((bone) => {
            if (bone.isBone && /head/i.test(bone.name)) monkHeadCandidates.push(bone);
            if ((bone.isMesh || bone.isGroup) &&
                /^monk_face1([._]\w+)?$/i.test(bone.name || '') &&
                !monkFace1MeshRef.current) {
              monkFace1MeshRef.current = bone;
            }
            if (bone.isMesh &&
                /^monk_face2([._]\w+)?$/i.test(bone.name || '') &&
                !monkFace2MeshRef.current) {
              monkFace2MeshRef.current = bone;
              bone.visible = false;
            }
            if (bone.isMesh &&
                // Match MonkEyes / MonkEyeR / MonkEyeL (no underscore — unlike
                // Monk_Face1/2) plus suffix variants, and collect ALL of them so
                // the split L/R eye meshes both hide behind the SitePal projection.
                /^monk_?eye(s|r|l)?([._]\w+)?$/i.test(bone.name || '') &&
                !monkEyesMeshesRef.current.includes(bone)) {
              monkEyesMeshesRef.current.push(bone);
            }
          });
          monkHeadBoneRef.current =
            monkHeadCandidates.find(b => /^head$/i.test(b.name)) ||
            monkHeadCandidates.find(b => !/(_?end|_?tip|_?nub)$/i.test(b.name)) ||
            monkHeadCandidates[0] ||
            null;
          captureHeadRestPose(monkHeadBoneRef);
        }
        // The cat's root empty was 'Virgil_Empty' in older exports and is
        // 'Cat_Empty' (containing 'Virgil') from v95 on — accept either. Either
        // one lands in the 'Virgil' character slot, which the focus/click/
        // head-track plumbing keys off throughout this file.
        //
        // THE SLOT WAS 'Fluffy' UNTIL 2026-08-03, from before the cat had a role
        // or a name in the game. Renamed when the VC game's press floor started
        // cutting the camera to him to speak (PressSession's CAT_AGENT): a
        // surface passing the character's actual name and getting no camera move
        // — resolveAgentSettings answers null for an unknown id and the focus
        // simply doesn't happen — is a silent failure nobody would think to look
        // for here. Contained to this file; nothing else referenced it.
        // NOT renamed: the legacy '*_fluffy' CLIP suffix below, which is a name
        // inside the glb rather than one of ours.
        else if (child.name === 'Cat_Empty' || child.name === 'Virgil_Empty') {
          animatedCharacters['Virgil'] = child;
          // Head bone for look-at-camera. GLTFLoader suffixes duplicate node
          // names, so the cat's 'head' may load as head_1/head_2 depending on
          // which skeleton was traversed first — match the base name plus any
          // numeric suffix rather than hard-coding 'head_1'.
          child.traverse((obj) => {
            if (obj.isBone && /^head(_\d+)?$/i.test(obj.name) && !virgilHeadBoneRef.current) {
              virgilHeadBoneRef.current = obj;
            }
          });
          captureHeadRestPose(virgilHeadBoneRef);
          catEmptyRef.current = child;
          // Start him on a random desk so he isn't always on Eugene's.
          applyCatPerch(Math.floor(Math.random() * CAT_PERCHES.length));
          // Start the roaming idle behaviour once his actions exist. Deferred a
          // tick because actionsRef for 'Virgil' is populated later in this
          // same load pass. The curtain call / focus paths stop it if either is
          // already active.
          setTimeout(() => {
            if (!revealModeRef.current && !virgilFocusedRef.current) startCatBehaviour('loaf');
          }, 0);
        }
        else if (child.name === 'Detective_Empty') {
          animatedCharacters['Detective'] = child;
          // Find head bone (for orbit-center derivation) plus the open/closed
          // eye meshes. Two-pass to be deterministic regardless of traversal
          // order: gather all meshes first, then resolve refs from the list.
          const meshes = [];
          const detectiveHeadCandidates = [];
          child.traverse((obj) => {
            if (obj.isBone && /head/i.test(obj.name)) detectiveHeadCandidates.push(obj);
            if (obj.isMesh) meshes.push(obj);
            // Detective_Face1 / Detective_Face2 capture (Mesh OR Group;
            // a multi-material Face1 becomes a Group after GLTFLoader
            // splits it). Hiding the Group hides all descendants.
            if ((obj.isMesh || obj.isGroup) &&
                /^detective_face1([._]\w+)?$/i.test(obj.name || '') &&
                !detectiveFace1MeshRef.current) {
              detectiveFace1MeshRef.current = obj;
            }
            if (obj.isMesh &&
                /^detective_face2([._]\w+)?$/i.test(obj.name || '') &&
                !detectiveFace2MeshRef.current) {
              detectiveFace2MeshRef.current = obj;
              obj.visible = false;
            }
          });
          // Open eyes: prefer exact "Eyes", fall back to anything matching
          // "eyes" but not "closed" (handles names like "Eyes_2").
          let openEyes = meshes.find((m) => /^eyes$/i.test(m.name || ''));
          if (!openEyes) {
            openEyes = meshes.find((m) =>
              /eye/i.test(m.name || '') && !/closed/i.test(m.name || '')
            );
          }
          // Closed eyes: prefer exact "Closedeyes", fall back to anything
          // with "closed" in the name, then to a different eye-ish mesh
          // (handles "Eyes.001" naming when mesh-data names leak through).
          let closedEyes = meshes.find((m) => /^closedeyes(\.\d+)?$/i.test(m.name || ''));
          if (!closedEyes) {
            closedEyes = meshes.find((m) => /closed/i.test(m.name || ''));
          }
          if (!closedEyes && openEyes) {
            closedEyes = meshes.find((m) =>
              m !== openEyes && /eye/i.test(m.name || '')
            );
          }
          if (openEyes) detectiveEyesRef.current = openEyes;
          if (closedEyes) {
            detectiveClosedEyesRef.current = closedEyes;
            closedEyes.visible = false;
          }
          detectiveHeadBoneRef.current =
            detectiveHeadCandidates.find(b => /^head$/i.test(b.name)) ||
            detectiveHeadCandidates.find(b => !/(_?end|_?tip|_?nub)$/i.test(b.name)) ||
            detectiveHeadCandidates[0] ||
            null;
          captureHeadRestPose(detectiveHeadBoneRef);
        }
        // Point.003 sits near the angel — tinted to match the altar
        // spotlight color so the angel surface picks up a green cast.
        else if (child.isLight && child.name === 'Point003') {
          child.color.setHex(0xF5EDFF);
          child.intensity = 0.3;
        }
        // Point.006 was meant to be red in Blender but the GLB exports it as
        // white (color [1,1,1]) — override on the JS side.
        else if (child.isLight && child.name === 'Point006') {
          child.color.setHex(0xff0000);
          child.intensity = 0.3;
        }
                else if (child.isLight && child.name === 'Point00') {
          child.color.setHex(0x17FFF7);
          child.intensity = 0.3;
        }
      });
      
      // Create separate mixers for each character. For the V2 unicorn rig the
      // bones (mixamorigHips and friends) live under a sibling Armature
      // (Root_1) — not under Unicorn_Empty — so anchor that mixer at the
      // scene root to keep PropertyBinding's name lookup working.
      Object.entries(animatedCharacters).forEach(([charName, charObject]) => {
        const mixerRoot = (charObject.name === 'Unicorn_Empty') ? templeScene : charObject;
        const mixer = new THREE.AnimationMixer(mixerRoot);
        mixersRef.current[charName] = mixer;
        actionsRef.current[charName] = {};
      });

      // Geometric "sacred geometry" beacon (baked into the scene GLB) — its
      // "Take 001" clip rotates the four colored emissive shapes (the spin +
      // color-shift that presides over the floor in lieu of a figure). It's not
      // a character, so give it its own mixer rooted at the scene; the per-frame
      // loop ticks every mixer registered in mixersRef.
      {
        const geoClip = gltf.animations.find((a) => a.name === 'Take 001');
        if (geoClip) {
          const geoMixer = new THREE.AnimationMixer(templeScene);
          const geoAction = geoMixer.clipAction(geoClip);
          geoAction.setLoop(THREE.LoopRepeat, Infinity);
          geoAction.play();
          mixersRef.current['GeometricShape'] = geoMixer;
        }
      }

      // THE PITCH BOT — the VC game's pitcher. Everything about it lives in
      // lib/trade/pitchBotScene: the load, the transform, the holographic
      // treatment, the mixer/action registration and the __pitchBotTune handle.
      //
      // This is the ONLY VC-game edit to this file's load path. It borrows the
      // loader above because that one already has the DRACOLoader attached —
      // BOTH rigs list Draco as extensionsRequired (v1 also requires
      // EXT_texture_webp), so a bare loader silently fails on either.
      //
      // NO `variant` PASSED, on purpose. The module resolves it itself, in this
      // order: `?pitchbot=` > PITCH_BOT_PIN > the per-deal roll from
      // PITCH_BOT_ROSTER. So the cast is decided in one place instead of being
      // half-stated here, and comparing rigs is a reload rather than an edit to
      // this file. To force one rig while building, set PITCH_BOT_PIN — passing
      // `variant` here would silently outrank both the query and the pin.
      mountPitchBot({
        gltfLoader,
        parent: templeScene,
        mixersRef,
        actionsRef,
        onReady: (bot) => { pitchBotRef.current = bot; setPitchBotReady(true); },
      });

      // Helper function to clean animation tracks - only remove truly problematic tracks
      const cleanAnimationTracks = (animation, targetObject) => {
        // Get all bone names in the target object, including nested paths
        const availableBones = new Set();
        const collectBoneNames = (obj, path = '') => {
          if (obj.name) {
            availableBones.add(obj.name);
            // Also add the full path for nested bones
            if (path) {
              availableBones.add(`${path}/${obj.name}`);
            }
          }
          if (obj.children) {
            obj.children.forEach(child => {
              collectBoneNames(child, path ? `${path}/${obj.name}` : obj.name);
            });
          }
        };
        collectBoneNames(targetObject);
        
        // Known problematic bones that cause warnings (including _1 and _2 variants)
        // Only include bones that are genuinely missing, not leg bones that exist
        const problematicBones = new Set([
          // These bones don't exist in the model and should be filtered
          'Armature001', 'Armature002', 'Armature003'
          // Removed leg bones as they DO exist and are needed for proper animation
        ]);
        
        // Filter out only the truly problematic tracks
        const validTracks = animation.tracks.filter(track => {
          const boneName = track.name.split('.')[0];
          // Only remove if it's in our known problematic list AND not available
          if (problematicBones.has(boneName) && !availableBones.has(boneName)) {
            return false; // Remove this track
          }
          return true; // Keep all other tracks
        });
        
        // Only create a new clip if we removed any tracks
        if (validTracks.length < animation.tracks.length) {
          const cleanedAnimation = new THREE.AnimationClip(
            animation.name,
            animation.duration,
            validTracks
          );
          return cleanedAnimation;
        }
        
        return animation;
      };

      // Play specific animations based on character
      if (gltf.animations.length > 0) {
        // Suppress warnings during animation setup
        console.warn = suppressAnimationWarnings;
        
        // Analyze animations to understand their structure
        gltf.animations.forEach((animation) => {
          
          // Track names follow pattern: BoneName.property (e.g., Root.position)
          // This helps identify which bone hierarchy each animation targets
        });
        
        // Assign animations based on bone structure:
        // - Pelvis-based → Demon
        // - Root_2-based → Monk
        // - Root-based → RL80

        // Monk council foot-lock: monk_argue and monk_standPray share a static
        // root but pose the legs/feet differently, so crossfading between them
        // slides the feet. Capture monk_standPray's frame-0 lower body (hips +
        // legs + feet) and freeze BOTH clips' lower body to that constant pose,
        // so the crossfade only moves the upper body and the feet stay planted.
        const MONK_LOWER_RE = /^(Hips|UpperLeg|LowerLeg|Ankle|Ball|Toes)/i;
        let monkLowerBodyPose = null;
        const monkStandPrayClip = gltf.animations.find((a) => /monk_standPray/i.test(a.name));
        if (monkStandPrayClip) {
          monkLowerBodyPose = {};
          monkStandPrayClip.tracks.forEach((t) => {
            if (MONK_LOWER_RE.test(t.name)) {
              const stride = t.values.length / t.times.length;
              monkLowerBodyPose[t.name] = {
                Ctor: t.constructor,
                values: Array.from(t.values.slice(0, stride)),
              };
            }
          });
        }

        gltf.animations.forEach((animation) => {
          const animName = animation.name;
          const firstTrackBone = animation.tracks[0]?.name.split('.')[0] || '';

          let targetCharacters = [];

          // Detective animations — match "detective" anywhere in the clip
          // name or first-track bone name. Checked before bone-based rules
          // in case Detective shares a Pelvis/Root skeleton with another
          // character. Blender often exports as
          // `Armature.NNN|detective_typing` when there are multiple
          // armatures, so we substring-match instead of anchoring.
          if (/detective/i.test(animName) || /detective/i.test(firstTrackBone)) {
            targetCharacters = ['Detective'];
          }
          // Demon animations — match "demon" anywhere in the clip name or
          // first-track bone, since newer exports renamed clips to
          // demon_typing / demon_idle / demon_fistPump / demon_pointing
          // and may use a different skeleton root than the original Pelvis.
          else if (/demon/i.test(animName) || /demon/i.test(firstTrackBone)) {
            targetCharacters = ['Demon'];
          }
          // Demon animations (legacy Pelvis-based skeleton)
          else if (firstTrackBone === 'Pelvis') {
            targetCharacters = ['Demon'];
          }
          // Monk animations (Root_2-based skeleton, *_monk / *_Monk suffix,
          // or monk_* prefix).
          else if (firstTrackBone === 'Root_2' || /_monk$|^monk_/i.test(animName)) {
            targetCharacters = ['Monk'];
          }
          // Standard Root-based animations for RL80 only
          // (Demon uses Root.001|* / Pelvis animations, Monk uses *_monk animations)
          // Cat (Virgil) animations. v95 ships a 16-clip cat_* set rooted at
          // bone 'spine'; older exports used sit_idle / *_fluffy. Without this
          // the cat_* clips matched no rule at all and the cat sat in bind pose.
          else if (/^cat[_ ]/i.test(animName) || animName === 'sit_idle' || animName.endsWith('_fluffy')) {
            targetCharacters = ['Virgil'];
          }
          // V2 model: unicorn rig clips (Typing_Unicorn, Unicorn_Idle, etc.)
          // → RL80 slot. Accept "unicorn" anywhere in the clip name or first
          // track bone, regardless of naming order.
          else if (/unicorn/i.test(animName) || /unicorn/i.test(firstTrackBone)) {
            targetCharacters = ['RL80'];
          }
          else if (firstTrackBone === 'Root' ||
                   animName === 'Typing' || animName === 'Idle' ||
                   animName === 'Disbelief' || animName === 'FistPump' ||
                   animName === 'Clap' || animName === 'Victory' || animName === 'Cheer') {
            targetCharacters = ['RL80'];
          }


          
          // Apply animation to target characters with track cleaning
          targetCharacters.forEach(charName => {
            if (animatedCharacters[charName] && mixersRef.current[charName]) {
              const mixer = mixersRef.current[charName];

              // For unicorn (mixer rooted at the scene), check the scene's
              // bone universe so legitimate Mixamo tracks aren't stripped.
              const cleanRoot = (animatedCharacters[charName].name === 'Unicorn_Empty')
                ? templeScene
                : animatedCharacters[charName];
              // Clean animation tracks to remove references to non-existent bones
              let cleanedAnimation = cleanAnimationTracks(animation, cleanRoot);

              // Strip any tracks targeting Face1/Face2 on characters
              // that use the SitePal overlay swap, so GLB animations
              // can't override our visibility/material toggle.
              if (charName === 'Demon') {
                cleanedAnimation.tracks = cleanedAnimation.tracks.filter(
                  (t) => !t.name.startsWith('Face1.') && !t.name.startsWith('Face2.')
                );
              } else if (charName === 'Detective') {
                cleanedAnimation.tracks = cleanedAnimation.tracks.filter(
                  (t) =>
                    !t.name.startsWith('Detective_Face1.') &&
                    !t.name.startsWith('Detective_Face2.')
                );
              }

              // demon_pointing / demon_victory / demon_phone ship without
              // Root.position and Root.quaternion tracks (the Root bone sits
              // between Demon_Empty and Pelvis). With nothing driving Root,
              // three.js' PropertyMixer falls back to the GLB bind pose. For
              // the seated clips that's a small (~1.6°) twist, but for the
              // standing demon_phone the bind Root lays him HORIZONTAL on the
              // floor (looks fine in Blender, breaks on import). Borrow the
              // missing Root tracks from demon_idle so Root stays put.
              // GLTFLoader renames duplicate node names by appending _N, so
              // the bone may load as 'Root' or 'Root_1' depending on which
              // skeleton was traversed first (Demon shares Root/Hand_L/Hand_R
              // names with Detective).
              if (charName === 'Demon' && /demon_(pointing|victory|phone)/i.test(animName)) {
                const rootRe = /^Root(_\d+)?\.(position|quaternion)$/;
                const haveRoot = cleanedAnimation.tracks.some((t) => rootRe.test(t.name));
                if (!haveRoot) {
                  // Match the donor to the clip's STANCE. demon_idle's Root sits
                  // at Y≈-0.37 (seated height) — right for the seated pointing/
                  // victory clips, but it sinks the STANDING demon_phone ~0.37
                  // into the floor. Borrow demon_phone's Root from a standing
                  // clip (demon_shrug, Root Y≈0) instead.
                  const donorRe = /demon_phone/i.test(animName) ? /demon_shrug/i : /demon_idle/i;
                  const donorClip = gltf.animations.find((a) => donorRe.test(a.name));
                  if (donorClip) {
                    const rootTracks = donorClip.tracks
                      .filter((t) => rootRe.test(t.name))
                      .map((t) => t.clone());
                    if (rootTracks.length) {
                      cleanedAnimation = new THREE.AnimationClip(
                        cleanedAnimation.name,
                        cleanedAnimation.duration,
                        [...cleanedAnimation.tracks, ...rootTracks]
                      );
                    }
                  }
                }
              }

              // Unicorn_waving: keep only arm-bone quaternion tracks (drop
              // any position/scale and any non-arm rotation tracks left over
              // from earlier exports). Stays in regular blend mode — the
              // wave plays alongside the still-running idle, dominating arm
              // bones via a high effective weight set in the trigger.
              if (charName === 'RL80' && /wav/i.test(animName)) {
                const armBoneRe = /mixamorig(Left|Right)(Shoulder|Arm|ForeArm|Hand)/i;
                cleanedAnimation.tracks = cleanedAnimation.tracks.filter(t => {
                  return /\.quaternion$/i.test(t.name) && armBoneRe.test(t.name);
                });
              }

              // Monk council foot-lock: replace the lower-body tracks of
              // monk_argue AND monk_standPray with a single shared constant pose
              // (monk_standPray frame 0), so crossfading between them during
              // 'council' can't slide the feet. Upper body still animates.
              if (charName === 'Monk' && monkLowerBodyPose &&
                  /monk_(argue|standPray)/i.test(animName)) {
                cleanedAnimation = new THREE.AnimationClip(
                  cleanedAnimation.name,
                  cleanedAnimation.duration,
                  cleanedAnimation.tracks.map((t) => {
                    const frozen = monkLowerBodyPose[t.name];
                    return frozen ? new frozen.Ctor(t.name, [0], frozen.values) : t;
                  })
                );
              }

              const action = mixer.clipAction(cleanedAnimation);
              
              if (!actionsRef.current[charName]) {
                actionsRef.current[charName] = {};
              }
              
              actionsRef.current[charName][animName] = action;
            }
          });
        });



        // Play initial animations for each character
        Object.entries(actionsRef.current).forEach(([charName, charActions]) => {
          const availableAnims = Object.keys(charActions);

          if (availableAnims.length === 0) {
            console.error(`[Play] ERROR: ${charName} has no animations! Character will be in T-pose.`);
            return;
          }
          
          // Find a suitable default animation for each character
          let defaultAnimName = null;
          let defaultAnim = null;
          
          if (charName === 'RL80') {
            // Prefer any unicorn typing/idle (V2 rig — handles both
            // Typing_Unicorn and Unicorn_Typing naming), then the original
            // Typing/Idle clips, then anything available.
            const unicornTyping = availableAnims.find(a => /unicorn/i.test(a) && /typing/i.test(a) && !TRANSITION_RE.test(a));
            const unicornIdle = availableAnims.find(a => /unicorn/i.test(a) && /idle/i.test(a) && !TRANSITION_RE.test(a));
            if (unicornTyping) {
              defaultAnimName = unicornTyping;
            } else if (unicornIdle) {
              defaultAnimName = unicornIdle;
            } else if (charActions['Typing']) {
              defaultAnimName = 'Typing';
            } else if (charActions['Idle']) {
              defaultAnimName = 'Idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Demon') {
            // Newer export uses demon_typing / demon_idle naming; tolerate
            // the legacy Root.001|* names for older models still in use.
            const demonTyping = availableAnims.find(a => /demon.*typ/i.test(a) && !TRANSITION_RE.test(a));
            const demonIdle = availableAnims.find(a => /demon_idle/i.test(a));
            if (demonTyping) {
              defaultAnimName = demonTyping;
            } else if (demonIdle) {
              defaultAnimName = demonIdle;
            } else if (charActions['Root.001|Typing']) {
              defaultAnimName = 'Root.001|Typing';
            } else if (charActions['Root.001|Disbelief']) {
              defaultAnimName = 'Root.001|Disbelief';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Monk') {
            if (charActions['typing_monk']) {
              defaultAnimName = 'typing_monk';
            } else if (charActions['idle_monk']) {
              defaultAnimName = 'idle_monk';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Virgil') {
            // Virgil sits in the 'loaf' pose by default.
            const loafKey = availableAnims.find(a => /^cat_loaf$/i.test(a));
            if (loafKey) {
              defaultAnimName = loafKey;
            } else if (charActions['sit_idle']) {
              defaultAnimName = 'sit_idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Detective') {
            // Tolerate armature-prefixed names from Blender exports.
            const typingKey = availableAnims.find(a => /detective.*typ/i.test(a) && !TRANSITION_RE.test(a));
            defaultAnimName = typingKey || availableAnims[0];
          }
          
          if (defaultAnimName && charActions[defaultAnimName]) {
            defaultAnim = charActions[defaultAnimName];
            
            // Add some timing variation for visual interest
            if (charName === 'Monk' || charName === 'Demon' || charName === 'Virgil' || charName === 'Detective') {
              defaultAnim.time = Math.random() * defaultAnim.getClip().duration * 0.5;
            }
            defaultAnim.setLoop(THREE.LoopRepeat);
            defaultAnim.play();

            // Update the current animation state
            if (charName === 'RL80') {
              rl80AnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Demon') {
              demonAnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Monk') {
              monkAnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Detective') {
              detectiveAnimStateRef.current.currentAnimation = defaultAnimName;
            }
          } else {
            console.error(`[Play] ERROR: Could not find a default animation for ${charName}`);
          }
        });
        
        // Restore original console.warn after animation setup
        console.warn = originalWarn;
      }
      
      // Create grid ground — square grid lines clipped to a circular boundary
      // so the floor reads as a disc rather than a square plane. Same look as
      // the previous GridHelper, just bounded.
      const gridRadius = 25;
      const gridDivisions = 50;
      const gridStep = (2 * gridRadius) / gridDivisions;
      const gridPositions = [];
      // Lines parallel to Z (constant X): clip to circle x² + z² = r²
      for (let i = 0; i <= gridDivisions; i++) {
        const x = -gridRadius + i * gridStep;
        const dz2 = gridRadius * gridRadius - x * x;
        if (dz2 <= 0) continue;
        const z = Math.sqrt(dz2);
        gridPositions.push(x, 0, -z, x, 0, z);
      }
      // Lines parallel to X (constant Z)
      for (let i = 0; i <= gridDivisions; i++) {
        const z = -gridRadius + i * gridStep;
        const dx2 = gridRadius * gridRadius - z * z;
        if (dx2 <= 0) continue;
        const x = Math.sqrt(dx2);
        gridPositions.push(-x, 0, z, x, 0, z);
      }
      // Boundary circle outline
      const circleSegments = 96;
      for (let i = 0; i < circleSegments; i++) {
        const a0 = (i / circleSegments) * Math.PI * 2;
        const a1 = ((i + 1) / circleSegments) * Math.PI * 2;
        gridPositions.push(
          gridRadius * Math.cos(a0), 0, gridRadius * Math.sin(a0),
          gridRadius * Math.cos(a1), 0, gridRadius * Math.sin(a1),
        );
      }
      const gridGeometry = new THREE.BufferGeometry();
      gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
      // Teal phosphor grid that dissolves into the void with distance (radial
      // fade in the shader) instead of the old hard acid-green Tron grid — joins
      // the cyan beam/screen palette and reads as "decoded space" rather than a
      // synthwave starter grid.
      const gridMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color(0x35e8ff) },
          uOpacity: { value: 0.6 },
          uRadius: { value: gridRadius },
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uRadius;
          void main() {
            // Radial distance must be computed PER FRAGMENT: the grid chords
            // have both endpoints on the rim, so a vertex-stage distance would
            // interpolate to a constant (rim) along the whole line. Deriving it
            // from the interpolated position fixes that.
            float d = length(vPos.xz) / uRadius;
            float fade = 1.0 - smoothstep(0.65, 1.0, d);
            if (fade <= 0.001) discard;
            gl_FragColor = vec4(uColor, uOpacity * fade);
          }
        `,
      });
      const gridHelper = new THREE.LineSegments(gridGeometry, gridMaterial);
      gridHelper.position.y = -0.06;
      anchorGroup.add(gridHelper);
      
      // Add the anchor group to our captured group ref
      // Using the captured ref to avoid closure issues
      if (currentGroupRef) {
        currentGroupRef.add(anchorGroup);
        // Ensure everything is visible
        anchorGroup.visible = true;
        templeScene.visible = true;

        // Force update
        anchorGroup.updateMatrix();
        anchorGroup.updateMatrixWorld(true);
      } else {
        // This shouldn't happen but as a fallback, add to scene
        console.error('[CyborgTempleScene] currentGroupRef is null, falling back to scene');
        scene.add(anchorGroup);
      }
      // Whichever parent took it, this is what cleanup has to dispose.
      attachedTemple = anchorGroup;

      // ── Neon sign ──────────────────────────────────────────────────────
      // Loaded from its own GLB so only the picked variant is downloaded.
      // Deliberately kicked off AFTER the temple is mounted: on mobile
      // cellular a parallel fetch competes with the main model's ~3.7 MB and
      // delays the whole scene appearing for a decorative prop. Reuses the
      // gltfLoader above, which already has both DRACO (the sign) and Meshopt
      // (the temple) decoders wired — a fresh loader would re-fetch the WASM.
      const loadNeonSign = () => {
        if (!NEON_SIGNS.length) return;

        // Pick client-side only. Choosing at module scope would run during SSR
        // and mismatch on hydration.
        const params = new URLSearchParams(window.location.search);
        const forced = params.get('sign');
        let pick = NEON_SIGNS.find((s) => s.id === forced);

        // First load of this tab gets the flagship sign; later loads randomize.
        // setItem runs before `pick` is assigned so that if storage is
        // unavailable (private mode) the throw drops us into the random path
        // rather than pinning the flagship on every single load.
        if (!pick && NEON_SIGN_FIRST && forced !== 'random') {
          try {
            if (!window.sessionStorage.getItem('neonSignSeen')) {
              window.sessionStorage.setItem('neonSignSeen', '1');
              pick = NEON_SIGNS.find((s) => s.id === NEON_SIGN_FIRST);
            }
          } catch (e) {
            // storage disabled — fall through and roll
          }
        }

        if (!pick) {
          const roll = () => NEON_SIGNS[Math.floor(Math.random() * NEON_SIGNS.length)];
          let id = null;
          if (NEON_SIGN_STICKY && forced !== 'random') {
            try {
              id = window.sessionStorage.getItem('neonSignId');
              if (!NEON_SIGNS.some((s) => s.id === id)) id = null; // stale after a rename
              if (!id) window.sessionStorage.setItem('neonSignId', (id = roll().id));
            } catch (e) {
              id = null; // private mode / storage disabled
            }
          }
          // roll() must be called ONCE, not inside a find() predicate — a
          // predicate re-rolls per element and can match nothing at all.
          pick = NEON_SIGNS.find((s) => s.id === id) || roll();
        }
        // Debug handle — check which sign this load rolled without adding
        // console noise: `__neonSign` in the console.
        window.__neonSign = pick.id;

        gltfLoader.load(
          pick.url,
          (signGltf) => {
            const sign = signGltf.scene;
            const anchor = neonAnchorRef.current;

            // Signs are exported from their placed position in the main model,
            // so the transform in each file is already correct — that's the
            // normal path. An anchor empty, if one is ever added, overrides
            // POSITION only: the sign's own rotation and scale carry the FBX
            // axis correction the billboard composes with, and zeroing them
            // would leave the sign lying flat.
            templeScene.add(sign);
            if (anchor) {
              anchor.updateWorldMatrix(true, false);
              const anchorPos = new THREE.Vector3();
              anchor.getWorldPosition(anchorPos);
              sign.position.copy(templeScene.worldToLocal(anchorPos));
            }

            const cfg = NEON_SIGN_CONFIG;
            sign.position.x += cfg.xOffset + (pick.xOffset || 0);
            sign.position.y += cfg.yOffset + (pick.yOffset || 0);
            sign.position.z += cfg.zOffset + (pick.zOffset || 0);
            if (pick.scale && pick.scale !== 1) sign.scale.multiplyScalar(pick.scale);
            if (pick.yaw) sign.rotateY(pick.yaw);

            // Emissive tubes must not be dimmed by tone mapping, same treatment
            // the coin rings get above — otherwise the neon reads as grey.
            sign.traverse((child) => {
              if (!child.isMesh || !child.material) return;
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                if (m.emissive && m.emissive.getHex() !== 0x000000) m.toneMapped = false;
              });
            });

            // Hand it to the billboard. _restQuat is the sign's rest rotation
            // (the FBX axis conversion), which the per-frame math composes with
            // so the sign's face — not its local -Z — ends up toward the camera.
            sign.userData._restQuat = sign.quaternion.clone();

            // A reveal can already be running by the time this async load
            // lands — e.g. opening /trade?reveal=aligned directly. The effect
            // that hides StageProps ran before the sign existed, so seed the
            // sign's visibility from the current reveal state here; the effect
            // takes over from the next revealMode change onward.
            sign.visible = !revealModeRef.current;

            neonSignRef.current = sign;
          },
          undefined,
          (err) => {
            // Non-fatal: the temple renders fine without the sign.
            console.warn(`[CyborgTempleScene] neon sign "${pick.id}" failed to load:`, err);
          },
        );
      };

      // Find the specific meshes and add click handlers
      templeScene.traverse((child) => {

        // Target all cylinder meshes (the glowing rings around coins)
        if (child.name && child.name.startsWith('Cylinder') && child.isMesh) {
          // Enhance the emissive glow for cylinder rings
          if (child.material) {
            child.material.emissiveIntensity = 4.5; // Increase from 1.4 to 4.5
            child.material.toneMapped = false; // CRITICAL - prevents tone mapping from dimming
            child.material.needsUpdate = true;

            // If emissive color isn't set, give it a cyan glow
            if (!child.material.emissive || child.material.emissive.getHex() === 0x000000) {
              child.material.emissive = new THREE.Color(0x00ffff);
            }
          }
        }

        if (child.name === 'Cylinder043_0') {
          cylinderMeshRef.current = child;
        }
        if (child.name === 'Object_5') {
          object7MeshRef.current = child;
        }
        
        // Find PalmTree meshes - they have names like PalmTree001, PalmTree002, etc
        if (child.name && child.name.startsWith('PalmTree')) {
          palmTreeRefs.current.push(child);
          // Set initial visibility based on is80sMode
          child.visible = is80sMode;
        }
        
        // Find eye meshes for blinking animation
        if (child.name === 'L_eye' || child.name === 'L_Eye' || child.name === 'LeftEye' || child.name === 'left_eye') {
          leftEyeRef.current = child;
        }
        if (child.name === 'R_eye' || child.name === 'R_Eye' || child.name === 'RightEye' || child.name === 'right_eye') {
          rightEyeRef.current = child;
        }

        // Find demon eyes mesh for blinking (opacity-based)
        if (child.name === 'demon_eyes') {
          demonEyesRef.current = child;
          if (child.material) {
            child.material.transparent = true;
            child.material.needsUpdate = true;
          }
        }

        // Glasses lenses — Blender's alpha doesn't survive the GLB export,
        // so force semi-transparency on the JS side. Match by material name.
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          let touchedLens = false;
          mats.forEach((m) => {
            if (!m || !/lens/i.test(m.name || '')) return;
            m.transparent = true;
            m.opacity = 0.25;
            m.depthWrite = false;
            m.side = THREE.DoubleSide;
            m.needsUpdate = true;
            touchedLens = true;
          });
          // Render lenses after the head/eyes so transparent fragments blend
          // correctly against what's behind them.
          if (touchedLens) child.renderOrder = 3;
        }

        // Unicorn eye meshes. In the GLB the node names are Unicorn_L_EYE /
        // Unicorn_R_EYE (the geometry names L_EYE/R_EYE are not what the
        // resulting Three.js Mesh.name takes — the node name wins).
        // Opacity-based blink mirroring the Demon, synchronized across both.
        // The eyes share material index 39 with the body mesh, so clone the
        // material per eye — otherwise opacity mutations fade the whole unicorn.
        if (child.isMesh && (child.name === 'Unicorn_L_EYE' || child.name === 'Unicorn_R_EYE')) {
          if (child.material) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.side = THREE.DoubleSide;
            child.material.polygonOffset = true;
            child.material.polygonOffsetFactor = -1;
            child.material.polygonOffsetUnits = -1;
            child.material.needsUpdate = true;
          }
          child.renderOrder = 1;
          // The eyes are parented to the head bone, but three.js's frustum
          // culling uses the rest-pose bounding sphere — when the head moves
          // the actual eye position can fall outside that rest sphere, and
          // the renderer skips drawing the mesh from angles where the rest
          // sphere isn't in view. Disable frustum culling so they always draw.
          child.frustumCulled = false;
          unicornEyesRef.current.push(child);
        }

        // Apply flickering flame shader to Flame mesh
        if (child.isMesh && (child.name === 'Flame' || child.name.startsWith('Flame'))) {
          const flameMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
              uniform float uTime;
              varying float vHeight;
              void main() {
                vec3 pos = position;
                vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);
                float flameTime = uTime * 3.0;
                pos.x += sin(flameTime * 1.5) * 0.06 * vHeight * vHeight + sin(flameTime * 2.3) * 0.03 * vHeight;
                pos.y += sin(flameTime * 2.0) * 0.04 * vHeight + sin(flameTime * 3.7) * 0.02 * vHeight * vHeight;
                pos.z += cos(flameTime * 1.8) * 0.04 * vHeight * vHeight;
                float taper = 1.0 - vHeight * 0.5;
                pos.x *= taper;
                pos.z *= taper;
                pos.y *= 1.0 + sin(flameTime * 2.5) * 0.1 * vHeight;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
              }
            `,
            fragmentShader: `
              uniform float uTime;
              varying float vHeight;
              void main() {
                float time = uTime * 3.0;
                vec3 innerColor = vec3(1.0, 0.95, 0.8);
                vec3 midColor = vec3(1.0, 0.5, 0.0);
                vec3 outerColor = vec3(1.0, 0.2, 0.0);
                vec3 color;
                if (vHeight < 0.3) {
                  color = mix(innerColor, midColor, vHeight / 0.3);
                } else if (vHeight < 0.7) {
                  color = mix(midColor, outerColor, (vHeight - 0.3) / 0.4);
                } else {
                  color = mix(outerColor, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
                }
                float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
                float intensity = 3.5 * flicker;
                float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);
                gl_FragColor = vec4(color * intensity, alpha);
              }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          child.material = flameMat;
          flameMaterialsRef.current.push(flameMat);
        }

        // Find OurLady (RL80) and make it clickable
        if (child.name === 'OurLady' || child.name === 'Object_7' || child.name === 'RL80') {
          

          
          ourLadyRef.current = child;
          
          // Set clickable data on this object and all its children
          const setClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = 'RL80';
            obj.userData.agentName = 'RL80';
            obj.userData.targetObject = child; // Store reference to the actual object
            
            // Also apply to all children if it's a group
            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setClickableData);
            }
          };
          
          setClickableData(child);

          // Unicorn horn/aura glow target. The Unicorn has no SitePal face, so
          // while it speaks its emissive pulses with the audio amplitude
          // (playUnicornBeat → unicornGlow bridge) — that pulse is its "lip-sync".
          // Prefer a dedicated horn mesh; fall back to the body. Clone materials
          // so we never tint shared slots (eyes/flame excluded).
          if (!unicornGlowMatsRef.current.length) {
            const all = [];
            child.traverse((o) => { if (o.isMesh && o.material && !/eye|flame/i.test(o.name || '')) all.push(o); });
            const horn = all.filter((m) => /horn/i.test(m.name || ''));
            const targets = horn.length ? horn : all;
            const collected = [];
            targets.forEach((mesh) => {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              const cloned = mats.map((m) => {
                if (!m) return m;
                const c = m.clone();
                if (!c.emissive || c.emissive.getHex() === 0x000000) c.emissive = new THREE.Color(0x39e6ff);
                c.toneMapped = false;
                c.needsUpdate = true;
                collected.push({ mat: c, base: c.emissiveIntensity || 0 });
                return c;
              });
              mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
            });
            unicornGlowMatsRef.current = collected;
            console.log(`[CyborgTempleScene] unicorn glow → ${horn.length ? 'horn' : 'body'} (${collected.length} mat):`, targets.map((m) => m.name));
          }
        }

        // Make the council characters clickable
        if (child.name === 'Demon' || child.name === 'Demon_empty' || child.name === 'Demon_Empty' ||
            child.name === 'Devil_empty' || child.name === 'Devil_Empty' ||
            child.name === 'Monk_empty' || child.name === 'SK_Chr_Monk_01' ||
            child.name === 'Virgil_Empty' || child.name === 'Cat_Empty' ||
            child.name === 'Detective_Empty') {

          // Normalize agentId to consistent names
          let agentId = child.name;
          if (child.name === 'Demon' || child.name === 'Demon_empty' || child.name === 'Demon_Empty' ||
              child.name === 'Devil_empty' || child.name === 'Devil_Empty') agentId = 'Demon';
          else if (child.name === 'Monk_empty' || child.name === 'SK_Chr_Monk_01') agentId = 'Monk';
          // Cat root is 'Cat_Empty' from v95 on; 'Virgil_Empty' is the legacy
          // pre-v94 name. Both map to the 'Virgil' character slot.
          else if (child.name === 'Virgil_Empty' || child.name === 'Cat_Empty') agentId = 'Virgil';
          else if (child.name === 'Detective_Empty') agentId = 'Detective';

          const setMechClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = agentId;
            obj.userData.agentName = agentId;
            obj.userData.targetObject = child;

            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setMechClickableData);
            }
          };

          setMechClickableData(child);
        }
        
        // Make the screens clickable. Screen1-4 are the primary monitors
        // (each character's main feed). ScreenA-D are the secondary monitors
        // (the council group-chat displays). They are *separate* meshes —
        // each gets its own agentId so clicking either zooms to that
        // specific screen.
        const isPrimaryScreen = child.name === 'Screen1' || child.name === 'Screen2' || child.name === 'Screen3' || child.name === 'Screen4';
        const isSecondaryScreen = child.name === 'ScreenA' || child.name === 'ScreenB' || child.name === 'ScreenC' || child.name === 'ScreenD';
        if (isPrimaryScreen || isSecondaryScreen) {
          const setScreenClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = child.name;
            obj.userData.agentName = child.name;
            obj.userData.targetObject = child;

            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setScreenClickableData);
            }
          };

          setScreenClickableData(child);
        }
        
        // Collect and make XCandle objects clickable (skip click wiring when
        // candle interaction is disabled — e.g. on /trade)
        if (child.name && child.name.startsWith('XCandle01')) {
          // Large candles (XCandle01.009–013) have scale ~0.078 vs ~0.070 for small ones
          const isLarge = child.scale && child.scale.x > 0.075;
          // Store in collection array (will sort after traversal)
          xCandleNodesRef.current.push(child);
          if (!disableCandleInteraction) {
            const setCandleClickable = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'XCandle';
              obj.userData.agentName = 'XCandle';
              obj.userData.isLargeCandle = isLarge;
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCandleClickable);
              }
            };
            setCandleClickable(child);
          }
          // On the main shrine, candles start hidden and the templeCandles
          // useEffect lights up claimed ones. When candle interaction is
          // disabled (e.g. /trade) there's no claim/light pipeline at all, so
          // just show every candle.
          child.visible = disableCandleInteraction;
        }

        // Capture Angel_Empty on every device so we can billboard it toward
        // the camera regardless of the mobile/desktop split below.
        if (child.name === 'Angel_Empty') {
          angelEmptyRef.current = child;
          child.position.x += ANGEL_POSITION_OFFSET.x;
          child.position.z += ANGEL_POSITION_OFFSET.z;
        }

        // Capture the neon sign's anchor empty, if the main GLB ships one. The
        // sign model itself is loaded separately (loadNeonSign below) and gets
        // parented here, so its placement stays authorable in Blender. Matched
        // loosely because the empty has been called both Neon_Empty and
        // Open24Hrs across exports.
        if (!neonAnchorRef.current && /^(neon_empty|open24hrs)$/i.test(child.name || '')) {
          neonAnchorRef.current = child;
        }

        // Capture the geometric beacon (the spinning "sacred geometry" shapes
        // baked into the GLB) so the broadcast beam can aim at its real world
        // position. The four Shape* meshes are concentric → first one ≈ center.
        if (child.isMesh && child.name.startsWith('Shape') && !beaconRef.current) {
          beaconRef.current = child;
        }

        // Capture the hologram-projector base (the "_hologram_basewire" mesh at
        // the center of the desks). The broadcast beam emanates from here and
        // rises up so the beacon shape floats within the projected cone.
        if (child.isMesh && !projectorRef.current) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          // Match by node name OR material name. The v84 model exports the
          // projector as node "Object_2.001" (mesh "Object_0") carrying a
          // "_hologram_basewire" material; matching all three keeps this robust
          // across re-exports and renames.
          if (/hologram_basewire/i.test(child.name) ||
              child.name === 'Object_2.001' ||
              mats.some((m) => m && /basewire/i.test(m.name || ''))) {
            projectorRef.current = child;
          }
        }

        // Capture the geometric beacon container (the "Empty" parent of the four
        // Shape* meshes) and its baked transform, so GEOMETRIC_SHAPE_NUDGE can
        // offset the whole cluster from code without re-exporting the GLB.
        if (!beaconContainerRef.current && child.children &&
            child.children.filter((c) => c.name && c.name.startsWith('Shape')).length >= 2) {
          beaconContainerRef.current = child;
          beaconBaked.current = {
            pos: child.position.clone(),
            rot: child.rotation.clone(),
            scl: child.scale.clone(),
          };
          // Hide the legacy knot when the hologram card is active. Transforms
          // still update while invisible, so beam aim + card anchoring hold.
          child.visible = SHOW_LEGACY_BEACON;
        }

        // Give the flat grey desks corner definition. They're MeshStandard but
        // the uniform grey + dim lighting hides their edges, so derive edge
        // lines from each desk's geometry and add them as a child (effectively a
        // clone of the geometry with a different material). Subtle cyan reads as
        // a rim/corner highlight, on-palette with the grid and beam.
        if (child.isMesh && child.name.startsWith('Desk') || child.name.startsWith('Central') && !child.userData.__edged) {
          child.userData.__edged = true;
          const deskEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(child.geometry, 30),
            new THREE.LineBasicMaterial({
              color: 0x8fd6e6,
              transparent: true,
              opacity: 0.4,
              depthWrite: false,
            })
          );
          child.add(deskEdges);
        }

        // Desk laptops (LaptopScreen1-4) start as blank cyan screens — give them
        // the Liminal Terminal CRT treatment: a shared animated code-feed texture
        // (unlit so the screen glows), echoing the mobile hero's terminal.
        if (child.isMesh && /^LaptopScreen/.test(child.name)) {
          if (!laptopCrtRef.current) laptopCrtRef.current = createLaptopCrtScreen({ w: 512, h: 320 });
          child.material = new THREE.MeshBasicMaterial({
            map: laptopCrtRef.current.texture,
            toneMapped: false,
            side: THREE.DoubleSide,
          });
          // The screen quad's baked UVs only cover a sub-rect of a texture atlas
          // (u 0→~0.66), so the full CRT canvas wouldn't fill it. Normalize the
          // quad's UVs to a clean 0–1 rect so the texture maps edge-to-edge — no
          // GLB re-export needed.
          const uv = child.geometry.attributes.uv;
          if (uv) {
            let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
            for (let i = 0; i < uv.count; i++) {
              const u = uv.getX(i), v = uv.getY(i);
              minU = Math.min(minU, u); maxU = Math.max(maxU, u);
              minV = Math.min(minV, v); maxV = Math.max(maxV, v);
            }
            const du = (maxU - minU) || 1, dv = (maxV - minV) || 1;
            for (let i = 0; i < uv.count; i++) {
              uv.setXY(i, (uv.getX(i) - minU) / du, (uv.getY(i) - minV) / dv);
            }
            uv.needsUpdate = true;
          }
        }

        // Capture the angel mesh on every device — the desktop and mobile
        // GLBs both ship with a visible angel and we want focus to work in
        // both contexts.
        if (child.name === 'angel' || child.name === 'Angel') {
          angelRef.current = child;
          // Redesign: the holographic Our Lady now presides over the desktop
          // scene, so hide the marble cherub there. Mobile keeps it (the
          // TradeLaptop hero covers this scene on phones anyway).
          if (!isOnMobile) child.visible = false;
          // Swap unlit MeshBasicMaterial for MeshStandardMaterial so the
          // altar spotlight actually illuminates the angel surface.
          child.traverse((obj) => {
            if (obj.isMesh && obj.material && obj.material.isMeshBasicMaterial) {
              const oldMat = obj.material;
              const baseColor = oldMat.color ? oldMat.color.clone() : new THREE.Color(0xffffff);
              obj.material = new THREE.MeshStandardMaterial({
                map: oldMat.map || null,
                color: baseColor,
                transparent: oldMat.transparent,
                opacity: oldMat.opacity,
                roughness: 0.6,
                metalness: 0.1,
                emissive: new THREE.Color(0x0bcd2e),
                emissiveMap: oldMat.map || null,
                emissiveIntensity: 0.25,
              });
              oldMat.dispose?.();
            }
          });
        }

        // Find coin objects for MOBILE.glb animations
        if (isOnMobile) {
          if (child.name === 'CoinSpoke') {
            coinSpokeRef.current = child;
          }

          // Coins only exist in MOBILE.glb, so only set them up on mobile
          if (child.name === 'Coin1') {
            coin1Ref.current = child;
            
            // Make Coin1 clickable - maps to Demon
            const setCoin1ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Demon';
              obj.userData.agentName = 'Demon';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true; // Mark as coin for special handling
              
              // Also apply to all children if it's a group
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin1ClickableData);
              }
            };
            
            setCoin1ClickableData(child);
          }
          if (child.name === 'Coin2') {
            coin2Ref.current = child;
          }
          if (child.name === 'Coin3') {
            coin3Ref.current = child;
            
            // Make Coin3 clickable - maps to Monk
            const setCoin3ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Monk';
              obj.userData.agentName = 'Monk';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin3ClickableData);
              }
            };
            
            setCoin3ClickableData(child);
          }
          if (child.name === 'Coin4') {
            coin4Ref.current = child;
            
            // Make Coin4 clickable - maps to RL80
            const setCoin4ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'RL80';
              obj.userData.agentName = 'RL80';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin4ClickableData);
              }
            };
            
            setCoin4ClickableData(child);
          }
        }

        // Hide TopText and x_logo banner until Angel is clicked
        if (child.name === 'TopText' || child.name === 'x_logo') {
          child.visible = false;
          topSupporterBannerRefs.current.push(child);
        }

        // Find CoinFace avatar meshes
        if (child.name === 'CoinFace1') coinFaceRefs.current[0] = child;
        if (child.name === 'CoinFace2') coinFaceRefs.current[1] = child;
        if (child.name === 'CoinFace3') coinFaceRefs.current[2] = child;
        if (child.name === 'CoinFace4') coinFaceRefs.current[3] = child;

        // Make Angel and CoinFace meshes clickable for zoom. Match any mesh
        // whose name contains "angel" (case-insensitive) so the desktop and
        // mobile GLBs both wire up regardless of exact naming variations.
        if (child.name && /angel/i.test(child.name)) {
          const setAngelClickable = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = 'Angel';
            obj.userData.agentName = 'Angel';
            obj.userData.targetObject = child;
            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setAngelClickable);
            }
          };
          setAngelClickable(child);
        }
        if (child.name && child.name.startsWith('CoinFace')) {
          child.userData.clickable = true;
          child.userData.agentId = 'Angel';
          child.userData.agentName = 'Angel';
          child.userData.targetObject = child;
        }
      });

      // Kick off the sign fetch now that the traverse above has had a chance to
      // capture neonAnchorRef (the sign parents to it when the main GLB ships
      // an anchor empty).
      loadNeonSign();

      // On mobile, hide the Coin meshes behind CoinFaces (CoinFaces are the visible avatars there)
      if (isOnMobile) {
        const coinMeshRefs = [coin1Ref, coin2Ref, coin3Ref, coin4Ref]
        coinMeshRefs.forEach(ref => {
          if (ref.current) ref.current.visible = false
        })
      }

      // Sort collected XCandle nodes by name for consistent indexing
      xCandleNodesRef.current.sort((a, b) => a.name.localeCompare(b.name));
      // Store candleIndex on each node's userData for click handler
      xCandleNodesRef.current.forEach((node, idx) => {
        const setIndex = (obj) => {
          obj.userData.candleIndex = idx;
          if (obj.children) obj.children.forEach(setIndex);
        };
        setIndex(node);
      });

      // Call onLoad callback if provided
      if (onLoad) {
        setTimeout(() => {
          onLoad();
        }, 100);
      }
    },
    // Progress callback — feeds the stall watchdog
    () => {
      if (thisAttempt === attemptId) lastProgressAt = performance.now();
    },
    // Error callback
    (error) => {
      if (loadSettled || thisAttempt !== attemptId) return; // superseded by a stall retry
      clearInterval(stallWatchdog);
      console.error(`[CyborgTempleScene] Error loading model ${urlToLoad}:`, error);
      console.error(`[CyborgTempleScene] Error details:`, {
        message: error.message,
        stack: error.stack,
        modelPath: modelPath,
        urlUsed: urlToLoad,
        isOnMobile: isOnMobile,
        userAgent: navigator.userAgent,
        windowWidth: window.innerWidth,
        attemptNumber: retryCount + 1
      });
      
      // Check if it's a 404 error
      if (error.message && error.message.includes('404')) {
        console.error(`[CyborgTempleScene] Model file not found at path: ${modelPath}`);
        console.error('[CyborgTempleScene] Please ensure the file exists at: public' + modelPath);
      }
      
      // Any error on the optimized model — 404, decode failure, WASM
      // init race, etc. — falls back to the un-optimized GLB immediately.
      // Decode errors are the typical Android Chrome failure mode for
      // Meshopt/WebP-compressed models, so we don't want to burn retries
      // hitting the same broken file.
      if (!usingFallback && modelPath !== fallbackModelPath) {
        console.warn('[CyborgTempleScene] Opt model failed — falling back to un-optimized model immediately. Error:', error?.message || error);
        modelPath = fallbackModelPath;
        usingFallback = true;
        retryCount = 0;
        setTimeout(() => loadModel(false), 50);
        return;
      }

      // Retry logic with full URL fallback for non-404 errors
      if (retryCount < maxRetries) {
        retryCount++;
        const useFullUrl = retryCount >= 2; // Try full URL on second retry

        // On last retry, fall back to un-optimized GLB. Applies to both
        // desktop and mobile (no longer mobile-gated since we now use the
        // same source GLB everywhere — mobile just gets the smaller opt build).
        if (retryCount === maxRetries && !usingFallback && modelPath !== fallbackModelPath) {
          console.warn(`[CyborgTempleScene] Optimized model failed, attempting fallback to un-optimized model...`);
          modelPath = fallbackModelPath;
          usingFallback = true;
          retryCount = maxRetries - 1; // Give one more chance with fallback
        }

        console.warn(`[CyborgTempleScene] Retrying model load (attempt ${retryCount}/${maxRetries})${useFullUrl ? ' with full URL' : ''}${usingFallback ? ' using fallback model' : ''}...`);
        setTimeout(() => {
          loadModel(useFullUrl);
        }, 1000 * retryCount); // Exponential backoff
      } else {
        console.error(`[CyborgTempleScene] Failed to load model after ${maxRetries} attempts`);
        console.error('[CyborgTempleScene] Model loading is REQUIRED. Page will not proceed.');
        
        // Don't call onLoad when model fails - this prevents the page from loading
        // Instead, show an error message to the user
        if (typeof window !== 'undefined') {
          // Create an error overlay
          const errorDiv = document.createElement('div');
          errorDiv.style.position = 'fixed';
          errorDiv.style.top = '50%';
          errorDiv.style.left = '50%';
          errorDiv.style.transform = 'translate(-50%, -50%)';
          errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
          errorDiv.style.color = 'white';
          errorDiv.style.padding = '20px';
          errorDiv.style.borderRadius = '10px';
          errorDiv.style.zIndex = '100000';
          errorDiv.style.textAlign = 'center';
          errorDiv.style.maxWidth = '80%';
          errorDiv.innerHTML = `
            <h2>Failed to Load 3D Model</h2>
            <p>Unable to load the required 3D model (${modelPath}).</p>
            <p>Please refresh the page or try again later.</p>
            <button onclick="window.location.reload()" style="
              margin-top: 10px;
              padding: 10px 20px;
              background: white;
              color: black;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            ">Refresh Page</button>
          `;
          document.body.appendChild(errorDiv);
        }
      }
    });
    };
    
    // Start loading the model
    loadModel();

    }, 100); // 100ms delay to ensure ref is attached
    
    // Cleanup function
    return () => {
      clearTimeout(timer);
      // Stop the stall watchdog and mark the load settled so callbacks from a
      // request that outlives the unmount can't spawn retries into nothing.
      loadSettled = true;
      if (stallWatchdog) clearInterval(stallWatchdog);
      if (attachedTemple) {
        // Detach from whichever parent took it.
        attachedTemple.parent?.remove(attachedTemple);

        // Dispose of materials, geometries AND the textures the materials
        // reference. Material.dispose() does not free its maps, and this GLB
        // carries ~25 of them — mostly 1024², ~80MB decoded with mipmaps.
        // That was invisible while the temple mounted once per page; the
        // talk-show swap unmounts it, so without this every LT TV round-trip
        // strands the whole set on the GPU. Textures are shared between
        // materials, so dedupe before disposing.
        const seenMaterials = new Set();
        const seenTextures = new Set();
        attachedTemple.traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (!child.material) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (!material || seenMaterials.has(material)) return;
            seenMaterials.add(material);
            // Every texture slot, whatever the material type — walking the
            // material's own values catches map/normalMap/emissiveMap/etc.
            // without having to keep a list in sync with three's material set.
            Object.values(material).forEach((value) => {
              if (value && value.isTexture && !seenTextures.has(value)) {
                seenTextures.add(value);
                try { value.dispose(); } catch (e) {}
              }
            });
            material.dispose();
          });
        });
      }

      // Dispose SitePal projection textures. Each character ref holds a
      // 512x512 CanvasTexture (~1MB GPU) and a backing HTMLCanvasElement
      // (~1MB CPU). Material.dispose() does NOT dispose its `map`, and
      // the per-effect cleanups for these refs don't release them either,
      // so without this they leak per CyborgTempleScene unmount.
      [monkSitePalRef, detectiveSitePalRef, demonSitePalRef].forEach((ref) => {
        const s = ref.current;
        if (!s) return;
        if (s.texture) { try { s.texture.dispose(); } catch (e) {} }
        if (s.material) { try { s.material.dispose(); } catch (e) {} }
        s.texture = null;
        s.material = null;
        s.cropCanvas = null;
        s.cropCtx = null;
        s.sourceEl = null;
        s.materialApplied = false;
      });
    };
  }, []); // Empty dependency array - only run once on mount

  // Store initial camera position only once
  useEffect(() => {
    if (!originalCameraPosition.current && camera) {
      originalCameraPosition.current = camera.position.clone();
    }
  }, [camera]);

  // Resting orbit pivot — sits near the workstation/character cluster so
  // OrbitControls rotates around the visible center of the model rather than
  // world origin. Mirrors the model's position offset between mobile/desktop.
  const restingOrbitCenter = useMemo(
    () => new THREE.Vector3(0, isMobile ? 0.0 : -0.5, 0),
    [isMobile]
  );
  // Canonical un-focus pose — front-facing zoomed-in overview of the
  // platform. All de-focus paths fly the camera here regardless of where
  // the auto-orbit happened to be when the user clicked, so users don't
  // get dropped back into a "weird" angle. Numbers approximate where the
  // /trade rig's slow zoom-in settles (seed [0, 3.5, 5.5] / [0, 4.5, 7]
  // pulled to distance 4.8 / 6.5 along the seed's direction).
  const sceneDefaultPose = useMemo(
    () => ({
      position: isMobile
        ? new THREE.Vector3(0, 3.3, 5.3)
        : new THREE.Vector3(0, 0.3, 5.2),
      target: new THREE.Vector3(0, isMobile ? 0.0 : -0.5, 0),
    }),
    [isMobile]
  );
  const orbitTargetInitedRef = useRef(false);

  
  // Update PalmTree visibility when is80sMode changes
  useEffect(() => {
    if (palmTreeRefs.current && palmTreeRefs.current.length > 0) {
      palmTreeRefs.current.forEach(palmTree => {
        if (palmTree) {
          palmTree.visible = is80sMode;
        }
      });
    }
  }, [is80sMode]);

  // Apply claimed candle data: brighten node + swap senora texture with user image
  useEffect(() => {
    if (!xCandleNodesRef.current.length || !templeCandles.length) return;
    const textureLoader = new THREE.TextureLoader();
    templeCandles.forEach((candle) => {
      const node = xCandleNodesRef.current[candle.candleIndex];
      if (!node) return;
      // Show the claimed candle
      node.visible = true;
      // Swap senora mesh texture with user image
      if (candle.userImageUrl) {
        node.traverse((descendant) => {
          if (!descendant.isMesh) return;
          const isSenora = descendant.name === 'senora' || descendant.name === 'Senora' ||
            (descendant.material && (
              descendant.material.name === 'senora' || descendant.material.name === 'senora.001' ||
              descendant.material.name === 'Senora' || descendant.material.name === 'Material.001'
            )) ||
            (descendant.parent && descendant.parent.name === 'senora');
          if (!isSenora) return;
          textureLoader.load(candle.userImageUrl, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            if (!descendant.material.userData?.cloned) {
              descendant.material = descendant.material.clone();
              descendant.material.userData = { cloned: true };
            }
            descendant.material.map = texture;
            descendant.material.transparent = true;
            descendant.material.opacity = 1;
            descendant.material.alphaTest = 0.1;
            descendant.material.needsUpdate = true;
          });
        });
      }
    });
  }, [templeCandles]);

  // Add raycaster for click detection and keyboard shortcuts
  useEffect(() => {
    if (!groupRef.current || !gl) return;
    
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Helper: restore demon to normal animation rotation when leaving focus
    const restoreDemonFromFocus = () => {
      if (!demonFocusedRef.current) return;
      demonFocusedRef.current = false;
      demonHeadTrackingRef.current = false;
      const demonActions = actionsRef.current['Demon'];
      const demonMixer = mixersRef.current['Demon'];
      const demonState = demonAnimStateRef.current;
      // Cancel any in-flight focus sequence (the 2s idle→pointing handoff
      // and the 'finished' listener that swaps back to idle).
      if (demonState.focusSequenceTimers) {
        demonState.focusSequenceTimers.forEach(clearTimeout);
        demonState.focusSequenceTimers = [];
      }
      if (demonState.focusSequenceListener && demonMixer) {
        demonMixer.removeEventListener('finished', demonState.focusSequenceListener);
        demonState.focusSequenceListener = null;
      }
      if (!demonActions) return;
      const loopAnims = Object.keys(demonActions).filter(a => /typing|idle/i.test(a) && !/sit_idle|stand/i.test(a) && !TRANSITION_RE.test(a));
      const returnAnim = loopAnims.length > 0 ? loopAnims[0] : Object.keys(demonActions)[0];
      const prevAction = demonActions[demonState.currentAnimation];
      const returnAction = demonActions[returnAnim];
      // No-op if we'd cross-fade to the same clip — reset()+fadeIn on the
      // currently-running action briefly snaps it to time=0 (T-pose frame).
      if (returnAction && returnAction !== prevAction) {
        if (prevAction) prevAction.fadeOut(0.5);
        returnAction.reset();
        // Skip bind-pose first frame so the cross-fade doesn't flash T-pose.
        returnAction.time = bindSkipTime(returnAction);
        returnAction.setLoop(THREE.LoopRepeat);
        returnAction.setEffectiveWeight(1);
        returnAction.fadeIn(0.5);
        returnAction.play();
        demonState.currentAnimation = returnAnim;
      }
      demonState.isPlayingSpecial = false;
      demonState.nextSwitchDelay = Math.random() * 8000 + 6000;
      demonState.lastSwitchTime = Date.now();
    };

    // Helper: restore monk to normal animation rotation when leaving focus
    const restoreMonkFromFocus = () => {
      if (!monkFocusedRef.current) return;
      monkFocusedRef.current = false;
      const monkActions = actionsRef.current['Monk'];
      if (!monkActions) return;
      const monkState = monkAnimStateRef.current;
      const loopAnims = Object.keys(monkActions).filter(a => /typing|idle|laughing/i.test(a) && !/idle_monk/i.test(a));
      const returnAnim = loopAnims.length > 0 ? loopAnims[0] : Object.keys(monkActions)[0];
      const prevAction = monkActions[monkState.currentAnimation];
      const returnAction = monkActions[returnAnim];
      if (returnAction && returnAction !== prevAction) {
        if (prevAction) prevAction.fadeOut(0.5);
        returnAction.reset();
        // Skip bind-pose first frame so the cross-fade doesn't flash T-pose.
        returnAction.time = bindSkipTime(returnAction);
        returnAction.setLoop(THREE.LoopRepeat);
        returnAction.setEffectiveWeight(1);
        returnAction.fadeIn(0.5);
        returnAction.play();
        monkState.currentAnimation = returnAnim;
      }
      monkState.isPlayingSpecial = false;
      monkState.nextSwitchDelay = Math.random() * 8000 + 6000;
      monkState.lastSwitchTime = Date.now();
    };

    // Helper: restore RL80 to normal animation rotation when leaving focus
    const restoreRL80FromFocus = () => {
      if (!rl80FocusedRef.current) return;
      rl80FocusedRef.current = false;
      // Cancel any pending post-wave fade-back from the greeting wave.
      if (unicornWaveStateRef.current.timeoutId) {
        clearTimeout(unicornWaveStateRef.current.timeoutId);
        unicornWaveStateRef.current.timeoutId = null;
      }
      const rl80Actions = actionsRef.current['RL80'];
      if (!rl80Actions) return;
      // Fade out the additive wave action if still running — it's not tracked
      // via rl80State.currentAnimation, so the loop-anim restore below
      // wouldn't otherwise touch it.
      const waveKey = Object.keys(rl80Actions).find(a => /wav/i.test(a));
      if (waveKey && rl80Actions[waveKey].isRunning && rl80Actions[waveKey].isRunning()) {
        rl80Actions[waveKey].fadeOut(0.4);
      }
      const rl80State = rl80AnimStateRef.current;
      const loopAnims = Object.keys(rl80Actions).filter(a => /typing|idle/i.test(a) && a !== 'sit_idle');
      const returnAnim = loopAnims.length > 0 ? loopAnims[0] : Object.keys(rl80Actions)[0];
      const prevAction = rl80Actions[rl80State.currentAnimation];
      const returnAction = rl80Actions[returnAnim];

      // No-op if already on the target clip — avoids a bind-pose flash.
      if (returnAction && returnAction !== prevAction) {
        if (prevAction) prevAction.fadeOut(0.5);
        // Skip the bind-pose first frame so the cross-fade doesn't pop the
        // unicorn through neutral on un-zoom.
        returnAction.reset();
        returnAction.time = bindSkipTime(returnAction, 0.1);
        returnAction.setLoop(THREE.LoopRepeat);
        returnAction.fadeIn(0.5);
        returnAction.play();
        rl80State.currentAnimation = returnAnim;
      }
      rl80State.isPlayingSpecial = false;
      rl80State.nextSwitchDelay = Math.random() * 8000 + 6000;
      rl80State.lastSwitchTime = Date.now();
    };

    // Helper: restore Virgil to normal when leaving focus
    const restoreVirgilFromFocus = () => {
      if (!virgilFocusedRef.current) return;
      virgilFocusedRef.current = false;
      // Nothing to resume — the close-up never stopped his behaviour. Only
      // restart if something else (a wake-up, the curtain call) parked it.
      if (!revealModeRef.current && !catBehaviourRef.current.active) {
        startCatBehaviour(catBehaviourRef.current.state || 'loaf');
      }
    };

    // Helper: restore Detective to normal when leaving focus. Cross-fades
    // whatever's playing back to detective_typing and rearms the
    // typing↔idle alternation timer.
    const restoreDetectiveFromFocus = () => {
      if (!detectiveFocusedRef.current) return;
      detectiveFocusedRef.current = false;
      const detectiveActions = actionsRef.current['Detective'];
      const detectiveState = detectiveAnimStateRef.current;
      if (detectiveActions) {
        const typingKey = Object.keys(detectiveActions).find(a => /detective.*typ/i.test(a));
        const prevAction = detectiveActions[detectiveState.currentAnimation];
        const typingAction = typingKey ? detectiveActions[typingKey] : null;
        // Fade out other running clips, but leave the target clip alone if
        // it's already running — reset()+fadeIn would flash a T-pose frame.
        Object.values(detectiveActions).forEach((action) => {
          if (action && action !== typingAction) {
            const w = typeof action.getEffectiveWeight === 'function' ? action.getEffectiveWeight() : 0;
            if ((action.isRunning && action.isRunning()) || w > 0.001) action.fadeOut(0.5);
          }
        });
        if (typingAction && typingAction !== prevAction) {
          typingAction.reset();
          // Skip bind-pose first frame so the cross-fade doesn't flash T-pose.
          typingAction.time = bindSkipTime(typingAction);
          typingAction.setLoop(THREE.LoopRepeat);
          typingAction.setEffectiveWeight(1);
          typingAction.fadeIn(0.5);
          typingAction.play();
          detectiveState.currentAnimation = typingKey;
        }
      }
      detectiveState.isPlayingSpecial = false;
      detectiveState.nextSwitchDelay = Math.random() * 8000 + 8000;
      detectiveState.lastSwitchTime = Date.now();
    };

    // Helper: restore all characters from focus
    const restoreAllFromFocus = () => {
      restoreDemonFromFocus();
      restoreMonkFromFocus();
      restoreRL80FromFocus();
      restoreVirgilFromFocus();
      restoreDetectiveFromFocus();
    };

    // Handle escape key to reset camera
    const handleKeyDown = (event) => {
      // Debug: Press 'P' to log all character positions
      if (event.key === 'p' || event.key === 'P') {
        
        // Find and log each character's position
        if (groupRef.current) {
          groupRef.current.traverse((child) => {
            // Check various possible names
            if (child.name === 'OurLady' || child.name === 'Object_7' || child.name === 'RL80') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            if (child.name === 'Demon' || child.name === 'Monk_empty' || child.name === 'Virgil_Empty') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            if (child.name === 'Mike' || child.name === 'Cube010') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            // Log screen positions
            if (child.name === 'Screen1' || child.name === 'Screen2' || 
                child.name === 'Screen3' || child.name === 'Screen4') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
          });
        }
      }
      
      
      if (event.key === 'Escape' && focusTarget && !focusLockedRef.current) {
        restoreAllFromFocus();

        // Notify parent that focus is cleared
        if (onAgentClick) {
          onAgentClick(null);
        }
        
        setFocusTarget({
          position: sceneDefaultPose.position.clone(),
          lookAt: sceneDefaultPose.target.clone(),
          agentId: null,
          agentName: 'Reset'
        });
        setTimeout(() => {
          setFocusTarget(null);
        }, 1000);
      }
    };

    // Touch events for mobile and tablets
    const handleTouchStart = (event) => {
      if (focusLockedRef.current) return;   // see focusLocked
      // Don't prevent default for better touch compatibility
      // event.preventDefault();

      // Safety check for groupRef
      if (!groupRef.current) return;

      // For touchend events, use changedTouches instead of touches
      const touch = event.touches ? event.touches[0] : event.changedTouches[0];
      if (!touch) return; // Safety check

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);

      let touchedSomething = false;

      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;

        if (object.userData.isCoin) {
          touchedSomething = true;
          // Prevent default only when we're actually interacting with a coin and it's cancelable
          if (event.cancelable) {
            event.preventDefault();
          }

          // Trigger coin animation
          const coinName = object.userData.agentId;
          triggerCoinAnimation(coinName);

          // Also trigger the card display
          if (onAgentClick) {
            onAgentClick(coinName);
          }
          break;
        }

        // Handle CoinFace touch on mobile — fire callback
        if (isOnMobile && object.name && object.name.startsWith('CoinFace')) {
          touchedSomething = true;
          if (event.cancelable) {
            event.preventDefault();
          }
          if (onCoinFaceTap) {
            const coinIndex = parseInt(object.name.replace('CoinFace', '')) - 1;
            onCoinFaceTap(coinIndex);
          }
          break;
        }
      }

      // Toggle-unfocus on touch. Native `click` / `dblclick` paths in
      // handleClick / handleDblClick aren't reliable on touch — OrbitControls'
      // tap-vs-pan heuristic frequently swallows them — so we reproduce the
      // unfocus dance from handleClick (line ~3490) directly here.
      //
      // Rule: when focused, ANY tap unfocuses, UNLESS the tap clearly hits
      // a DIFFERENT character's mesh (in which case the player is trying
      // to switch consultant — defer to handleClick's dblclick-to-focus
      // gate). Screens, walls, the back wall, empty space, and the focused
      // character's own mesh all count as "unfocus me" taps.
      //
      // This is broader than the desktop click toggle (which requires
      // hitting the focused character's mesh specifically). The reason:
      // some focus-camera framings (notably Monk's, whose lookAt sits
      // past his body so the back wall fills the screen center) make the
      // character's mesh hard to hit precisely with a tap. On desktop the
      // user can aim with a mouse; on touch the natural gesture is "tap
      // anywhere to dismiss."
      //
      // Skipped when `touchedSomething` is true (a coin or CoinFace was
      // handled above) so coin taps stay coin taps.
      //
      // Idempotent on the touchstart + touchend pair: the first call sets
      // focusTarget.agentId to null (Reset transition), so the second
      // call's outer gate fails and it no-ops.
      // console.log('[touch] event', {
      //   type: event.type,
      //   focusTargetAgent: focusTarget?.agentId,
      //   touchedSomething,
      //   intersectsCount: intersects.length,
      // });

      const CHARACTER_AGENT_IDS = new Set([
        'Monk',
        'Demon',
        'Detective',
        'RL80',
        'Virgil',
      ]);

      // Focus-on-touch: bypass the dblclick gate that handleClick uses for
      // desktop. On iOS Safari, the second synthesized click of a double-tap
      // is frequently swallowed by the browser's tap-to-zoom heuristic, so
      // the dblclick gate's `pending` check never reconciles and focus never
      // fires. Tap directly = focus directly. We forward the agentId via
      // onAgentClick; the parent's mustStartWithMonk gate still applies.
      //
      // Fires only on touchstart (skipped on touchend) so a single physical
      // tap doesn't double-focus. Skipped when a coin/CoinFace was already
      // handled (touchedSomething) or when we're already focused on something
      // (the unfocus block below handles that case instead).
      if (
        event.type === 'touchstart' &&
        !focusTarget &&
        !touchedSomething
      ) {
        for (let i = 0; i < intersects.length; i++) {
          let object = intersects[i].object;
          if (!object.userData.clickable) {
            let walker = object.parent;
            while (walker && walker !== groupRef.current) {
              if (walker.userData?.clickable) {
                object = walker;
                break;
              }
              walker = walker.parent;
            }
          }
          if (!object.userData.clickable) continue;
          const aid = object.userData.agentId;
          if (CHARACTER_AGENT_IDS.has(aid)) {
            // console.log('[touch] focus', { aid });
            if (event.cancelable) event.preventDefault();
            if (onAgentClick) onAgentClick(aid);
            // Suppress the synthesized click that fires shortly after this
            // touchstart — without this, handleClick re-enters the
            // toggle-unfocus path (because focusTarget will be set by then)
            // and immediately reverses the focus we just established.
            suppressNextSynthesizedClickRef.current = true;
            return;
          }
          break;
        }
      }

      if (focusTarget && focusTarget.agentId && !touchedSomething) {
        let hitDifferentCharacter = false;
        for (let i = 0; i < intersects.length; i++) {
          let object = intersects[i].object;
          const hitName = object.name;
          const hitAgentBefore = object.userData.agentId;
          const hitClickableBefore = object.userData.clickable;
          if (!object.userData.clickable) {
            let walker = object.parent;
            while (walker && walker !== groupRef.current) {
              if (walker.userData?.clickable) {
                object = walker;
                break;
              }
              walker = walker.parent;
            }
          }
          // console.log('[touch] intersect', i, {
          //   hitName,
          //   hitAgentBefore,
          //   hitClickableBefore,
          //   resolvedAgent: object.userData.agentId,
          //   resolvedClickable: object.userData.clickable,
          // });
          if (!object.userData.clickable) continue;
          const aid = object.userData.agentId;
          if (
            CHARACTER_AGENT_IDS.has(aid) &&
            aid !== focusTarget.agentId
          ) {
            hitDifferentCharacter = true;
            break;
          }
          // Same character, screen, angel, xcandle, etc. — none of these
          // should block the unfocus.
          break;
        }
        // console.log('[touch] unfocus decision', { hitDifferentCharacter });
        // Tap-anywhere-to-dismiss is a FINGER affordance — it exists because
        // some focus framings make a character's mesh hard to hit precisely
        // with a thumb. On anything with a mouse or trackpad it is far too
        // loose: Chrome fires touch events on touchscreen laptops, so this ran
        // on ordinary clicks and dropped focus instantly, including mid-orbit.
        //
        // Gate on the actual POINTER, not on a device guess. `isOnMobile` is
        // `userAgent match || innerWidth <= 768`, which says nothing about
        // whether a mouse is present — it was true on the author's desktop.
        // Phones have no `pointer: fine`, so they keep tap-anywhere; anything
        // with a cursor falls through to the mouse rules (click the focused
        // object / double-click / Escape).
        const hasFinePointer =
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(pointer: fine)').matches;
        if (!hitDifferentCharacter && !hasFinePointer) {
          if (event.cancelable) {
            event.preventDefault();
          }
          restoreAllFromFocus();
          if (onAgentClick) onAgentClick(null);
          setFocusTarget({
            position: sceneDefaultPose.position.clone(),
            lookAt: sceneDefaultPose.target.clone(),
            fov: isMobile ? 55 : 50,
            agentId: null,
            agentName: 'Reset',
          });
          setTimeout(() => {
            setFocusTarget(null);
          }, 1000);
        }
      }
    };

    // Function to trigger coin click animation
    const triggerCoinAnimation = (coinName) => {
      const animState = coinAnimationState.current[coinName];
      if (animState) {
        animState.isAnimating = true;
        animState.startTime = Date.now();
        animState.flutterIntensity = 1.0;
        setClickedCoin(coinName);
        
        // Reset after animation completes
        setTimeout(() => {
          animState.isAnimating = false;
          animState.flutterIntensity = 0;
          setClickedCoin(null);
        }, 1500); // 1.5 second animation
      }
    };
    
    // Also set up hover detection for visual feedback
    const handlePointerMove = (event) => {
      // Safety check for groupRef
      if (!groupRef.current) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      
      // Change cursor if hovering over clickable object and handle coin hover
      let foundClickable = false;
      let foundCoin = null;
      
      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        if (object.userData.clickable) {
          foundClickable = true;
          
          // Check if it's a coin
          if (object.userData.isCoin) {
            foundCoin = object.userData.agentId;
          }
          break;
        }
      }
      
      // Handle coin hover effects
      if (foundCoin && hoveredCoin !== foundCoin) {
        // Start hovering on a coin
        setHoveredCoin(foundCoin);
        
        // Get the appropriate coin ref and scale/emissive refs
        let coinRef, scaleRef, emissiveRef;
        switch(foundCoin) {
          case 'Coin1':
            coinRef = coin1Ref;
            scaleRef = coin1OriginalScale;
            emissiveRef = coin1OriginalEmissive;
            break;
          case 'Coin2':
            coinRef = coin2Ref;
            scaleRef = coin2OriginalScale;
            emissiveRef = coin2OriginalEmissive;
            break;
          case 'Coin3':
            coinRef = coin3Ref;
            scaleRef = coin3OriginalScale;
            emissiveRef = coin3OriginalEmissive;
            break;
          case 'Coin4':
            coinRef = coin4Ref;
            scaleRef = coin4OriginalScale;
            emissiveRef = coin4OriginalEmissive;
            break;
        }
        
        if (coinRef && coinRef.current) {
          // Store original values if not already stored
          if (!scaleRef.current) {
            scaleRef.current = coinRef.current.scale.clone();
          }
          
          // Find the mesh material and store original emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material) {
              if (!emissiveRef.current) {
                emissiveRef.current = {
                  color: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000),
                  intensity: child.material.emissiveIntensity || 0
                };
              }
              // Set hover emissive with different colors for each coin
              if (child.material.emissive) {
                const colors = {
                  'Coin1': 0x00ff00, // Green
                  'Coin2': 0x00ffff, // Cyan
                  'Coin3': 0xff00ff, // Magenta
                  'Coin4': 0xffdd00  // Gold
                };
                child.material.emissive = new THREE.Color(colors[foundCoin] || 0xffdd00);
              }
              child.material.emissiveIntensity = 3; // Increased emission for better visibility
            }
          });
          
          // Scale up more noticeably
          coinRef.current.scale.multiplyScalar(1.2);
        }
      } else if (!foundCoin && hoveredCoin) {
        // Stop hovering on any coin
        
        // Get the appropriate coin ref and scale/emissive refs
        let coinRef, scaleRef, emissiveRef;
        switch(hoveredCoin) {
          case 'Coin1':
            coinRef = coin1Ref;
            scaleRef = coin1OriginalScale;
            emissiveRef = coin1OriginalEmissive;
            break;
          case 'Coin2':
            coinRef = coin2Ref;
            scaleRef = coin2OriginalScale;
            emissiveRef = coin2OriginalEmissive;
            break;
          case 'Coin3':
            coinRef = coin3Ref;
            scaleRef = coin3OriginalScale;
            emissiveRef = coin3OriginalEmissive;
            break;
          case 'Coin4':
            coinRef = coin4Ref;
            scaleRef = coin4OriginalScale;
            emissiveRef = coin4OriginalEmissive;
            break;
        }
        
        if (coinRef && coinRef.current) {
          // Restore original scale
          if (scaleRef.current) {
            coinRef.current.scale.copy(scaleRef.current);
          }
          
          // Restore original emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material && emissiveRef.current) {
              child.material.emissive = emissiveRef.current.color;
              child.material.emissiveIntensity = emissiveRef.current.intensity;
            }
          });
        }
        
        setHoveredCoin(null);
      }
      
      gl.domElement.style.cursor = foundClickable ? 'pointer' : 'default';
    };
    
    const handleClick = (event) => {
      // Prevent default to avoid any interference
      event.preventDefault();
      event.stopPropagation();

      // THE PARENT IS DRIVING — see focusLocked. Bail before the raycast so no
      // focus, unfocus or screen gesture can fire.
      if (focusLockedRef.current) return;

      // Safety check for groupRef
      if (!groupRef.current) return;

      // Touch focus already handled this gesture — consume the synthesized
      // click so the desktop-only dblclick gate and toggle-unfocus paths
      // don't re-enter the pipeline and undo what handleTouchStart just did.
      if (suppressNextSynthesizedClickRef.current) {
        suppressNextSynthesizedClickRef.current = false;
        return;
      }

      // Orbiting is a DRAG, but the browser still fires `click` on release.
      // If that release happens to land on the object you're focused on, the
      // toggle-unfocus below fires and you're thrown back to the overview
      // mid-orbit — which is exactly what "any click de-focuses me" was.
      // Anything that moved more than a few px is a camera drag, not a click,
      // so bail before the raycast. This gate belongs to the WHOLE handler;
      // it used to guard only the (now removed) empty-space unfocus branch,
      // which is why removing that branch didn't fix the orbit case.
      {
        const down = mouseDownPosRef.current;
        mouseDownPosRef.current = null;
        if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= CLICK_DRAG_SLOP) {
          return;
        }
      }

      // Calculate mouse position in normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;


      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);

      // Calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      
      let clickedOnAgent = false;

      for (let i = 0; i < intersects.length; i++) {
        let object = intersects[i].object;

        // Walk up the parent chain to find a clickable ancestor. Mesh
        // descendants don't always inherit userData from the original
        // setAngelClickable / agent-tag passes (e.g. nested groups added by
        // the GLB exporter), so a hit on a deep child mesh would otherwise
        // register as "not clickable" and fall through to the next intersect.
        if (!object.userData.clickable) {
          let walker = object.parent;
          // Cap traversal at the model group to avoid escaping into the
          // scene root.
          while (walker && walker !== groupRef.current) {
            if (walker.userData?.clickable) {
              object = walker;
              break;
            }
            walker = walker.parent;
          }
        }

        if (object.userData.clickable) {
          clickedOnAgent = true;

          // Screens, the 4 main characters, and Angel require a
          // double-click to focus the camera. A single click is too easy
          // to fire accidentally while orbiting. Skip the gate when
          // already focused on the same target so single-click
          // toggle-unfocus still works.
          {
            const dblClickAgentId = object.userData.agentId;
            const isDblClickTarget =
              dblClickAgentId &&
              (/^Screen[1-4A-D]$/.test(dblClickAgentId) ||
                dblClickAgentId === 'Demon' ||
                dblClickAgentId === 'Monk' ||
                dblClickAgentId === 'RL80' ||
                dblClickAgentId === 'Detective' ||
                dblClickAgentId === 'Virgil' ||
                dblClickAgentId === 'Angel');
            const alreadyFocusedOnThis = focusTarget && focusTarget.agentId === dblClickAgentId;
            if (isDblClickTarget && !alreadyFocusedOnThis) {
              const now = Date.now();
              const pending = pendingScreenClickRef.current;
              if (pending && pending.agentId === dblClickAgentId && now - pending.time < 400) {
                pendingScreenClickRef.current = null;
                // The browser will dispatch a `dblclick` after this second
                // click — the existing handler unfocuses on dblclick, so we
                // mark it to be consumed once.
                suppressNextDblClickRef.current = true;
              } else {
                pendingScreenClickRef.current = { agentId: dblClickAgentId, time: now };
                return;
              }
            }
          }

          // Special handling for coins - trigger animation and show FocusedAgentCard
          if (object.userData.isCoin) {

            // Trigger the coin animation
            triggerCoinAnimation(object.userData.agentId);

            // Call the parent callback to show FocusedAgentCard
            if (onAgentClick) {
              onAgentClick(object.userData.agentId); // This will trigger the FocusedAgentCard to show
            }
            break; // Exit early for coins
          }

          // On mobile, CoinFace tap fires callback for parent to handle
          if (isOnMobile && object.name && object.name.startsWith('CoinFace')) {
            if (onCoinFaceTap) {
              const coinIndex = parseInt(object.name.replace('CoinFace', '')) - 1;
              onCoinFaceTap(coinIndex);
            }
            break;
          }

          // Show TopText/x_logo banner when clicking Angel area
          if (object.userData.agentId === 'Angel') {
            topSupporterBannerRefs.current.forEach(mesh => {
              if (mesh) mesh.visible = true;
            });

            // Compute Angel focus pose from the live bounding box rather
            // than the static AGENT_CAMERA_SETTINGS values. The model is
            // offset differently per device ([0,-1.9,0] desktop /
            // [0,-1.2,0] mobile) and Angel_Empty has hover + billboard
            // motion, so a fixed world-space cameraPos/lookAtPos can land
            // above/below the actual mesh. Skipped when already focused
            // so the toggle-unfocus block below handles the second click.
            const alreadyFocused = focusTarget && focusTarget.agentId === 'Angel';
            const targetMesh = angelRef.current || angelEmptyRef.current;
            if (!alreadyFocused && targetMesh) {
              const box = new THREE.Box3().setFromObject(targetMesh);
              if (!box.isEmpty()) {
                const size = new THREE.Vector3();
                box.getSize(size);
                const center = new THREE.Vector3();
                box.getCenter(center);

                // Distance such that the mesh fits the vertical viewport
                // with breathing room. Padded by ~30% so the angel doesn't
                // touch the top/bottom edges.
                const fovDeg = isMobile ? 75 : 50;
                const fovRad = (fovDeg * Math.PI) / 180;
                const fitDistance = Math.max(1.2, (size.y * 0.65) / Math.tan(fovRad / 2));

                // Approach from +Z relative to the bbox center. Angel_Empty
                // billboards on its Y axis to face the camera anyway, so
                // the approach direction doesn't matter — only the
                // bbox-relative framing does.
                const cameraPos = new THREE.Vector3(
                  center.x,
                  center.y,
                  center.z + fitDistance,
                );

                setFocusTarget({
                  position: cameraPos,
                  lookAt: center.clone(),
                  fov: isMobile ? 75 : undefined,
                  agentId: 'Angel',
                  agentName: 'Angel',
                });
                break;
              }
            }
          }

          // XCandle click — first click zooms in, second click opens inspector
          if (object.userData.agentId === 'XCandle') {
            const candleIndex = object.userData.candleIndex ?? -1;
            const isAlreadyFocused = focusTarget && focusTarget.agentId === 'XCandle' && focusTarget.candleIndex === candleIndex;

            if (isAlreadyFocused) {
              // Second click — show info overlay (stay zoomed)
              window.dispatchEvent(new CustomEvent('xCandleClicked', {
                detail: {
                  candleIndex,
                  isLargeCandle: object.userData.isLargeCandle ?? false,
                }
              }));
            } else {
              // First click — zoom camera to candle. Don't overwrite
              // originalCameraPosition here; it was captured once at mount and
              // represents the page-load camera position the user expects to
              // return to on un-focus.
              const targetObj = object.userData.targetObject || object;
              const candleWorldPos = new THREE.Vector3();
              targetObj.getWorldPosition(candleWorldPos);
              // Position camera slightly in front and above the candle
              const cameraOffset = new THREE.Vector3(0, 0.3, 1.2);
              const cameraPos = candleWorldPos.clone().add(cameraOffset);
              setFocusTarget({
                position: cameraPos,
                lookAt: candleWorldPos,
                agentId: 'XCandle',
                agentName: 'XCandle',
                candleIndex,
              });
            }
            break;
          }

          // Hologram card — single click flies the camera in to frame it.
          // A second click (or clicking empty space / Escape) returns via the
          // generic toggle-unfocus just below. The card billboards to face the
          // camera, so approach along the current view direction to keep it square.
          if (object.userData.agentId === 'HologramCard') {
            const alreadyFocused = focusTarget && focusTarget.agentId === 'HologramCard';
            if (!alreadyFocused) {
              const box = new THREE.Box3().setFromObject(object);
              if (!box.isEmpty()) {
                const size = new THREE.Vector3();
                box.getSize(size);
                const center = new THREE.Vector3();
                box.getCenter(center);
                // Dolly in along the current view so the billboarded card stays
                // square; distance fits the card to ~viewport height with padding.
                const fovRad = (camera.fov * Math.PI) / 180;
                const fitDistance = Math.max(0.35, (size.y * 0.5) / Math.tan(fovRad / 2));
                const dir = new THREE.Vector3()
                  .subVectors(camera.position, center)
                  .normalize();
                const cameraPos = center.clone().add(dir.multiplyScalar(fitDistance));
                setFocusTarget({
                  position: cameraPos,
                  lookAt: center.clone(),
                  agentId: 'HologramCard',
                  agentName: 'HologramCard',
                });
                break;
              }
            }
            // Already focused → fall through to the generic toggle-unfocus below.
          }

          // If already focused on this screen, unfocus (toggle behavior)
          if (focusTarget && focusTarget.agentId === object.userData.agentId) {
            restoreAllFromFocus();
            if (onAgentClick) onAgentClick(null);
            setFocusTarget({
              position: sceneDefaultPose.position.clone(),
              lookAt: sceneDefaultPose.target.clone(),
              // Restore the default FOV on un-focus (mobile widens during
              // focus; this lerps it back).
              fov: isMobile ? 55 : 50,
              agentId: null,
              agentName: 'Reset'
            });
            setTimeout(() => {
              setFocusTarget(null);
            }, 1000);
            break;
          }

          // originalCameraPosition was captured once at mount (line ~1535)
          // and stays pinned to the page-load camera position. Don't refresh
          // it here — that would mean the user returns to wherever they were
          // mid-orbit before clicking, instead of the original overview.

          // Get the target object's world position
          const targetObject = object.userData.targetObject || object;
          const objectWorldPos = new THREE.Vector3();
          targetObject.getWorldPosition(objectWorldPos);
          
          // The cat moves between desks, so his framing is computed live rather
          // than read from the static preset table (see getCatFocusSettings).
          const settings = object.userData.agentId === 'Virgil'
            ? (getCatFocusSettings() || resolveAgentSettings('Virgil', isOnMobile))
            : resolveAgentSettings(object.userData.agentId, isOnMobile);

          if (!settings) {
            // Fallback: calculate a reasonable position based on object location
            const cameraPosition = new THREE.Vector3(
              objectWorldPos.x + 2,
              objectWorldPos.y + 0.5,
              objectWorldPos.z + 3
            );
            const lookAtTarget = objectWorldPos.clone();
            lookAtTarget.y += 0.5;

            setFocusTarget({
              position: cameraPosition,
              lookAt: lookAtTarget,
              agentId: object.userData.agentId,
              agentName: object.userData.agentName
            });
          } else {
            // Use absolute positions for known agents. resolveAgentSettings()
            // already merged any mobile overrides on top of the desktop values.
            // On mobile we additionally widen the FOV during focus so the
            // subject reads smaller in the portrait viewport without changing
            // camera position.
            setFocusTarget({
              position: settings.cameraPos,
              lookAt: settings.lookAtPos,
              // Optional override: where OrbitControls revolves around after
              // the fly-in arrives. Defaults to lookAt when not provided.
              orbitCenter: settings.orbitCenter,
              fov: isMobile ? 75 : undefined,
              agentId: object.userData.agentId,
              agentName: object.userData.agentName
            });
          }
          
          // Demon: activate SitePal here so the audio unmute happens
          // synchronously within the user click gesture (iOS Safari needs
          // this — calls from the externalFocusAgent effect run after
          // render commit, outside the gesture context).
          //
          // The idle → pointing → typing animation sequence is NOT run
          // inline anymore — it's driven by the externalFocusAgent effect
          // via startDemonFocusSequence(), so the touch path
          // (handleTouchStart, which bypasses handleClick) sees pointing
          // too. The round-trip is: onAgentClick('Demon') → parent
          // setFocusedAgent → externalFocusAgent prop change → effect →
          // startDemonFocusSequence().
          if (object.userData.agentId === 'Demon') {
            demonFocusedRef.current = true;
            activateSitePalProjection('Demon');
          } else if (object.userData.agentId === 'Monk') {
            monkFocusedRef.current = true;
            activateSitePalProjection('Monk');
            // Stop the attention-getting waving_over loop forever — user has
            // engaged with the monk; the game flow takes over from here.
            monkWaveStateRef.current.hasBeenFocused = true;
            monkWaveStateRef.current.attentionActive = false;
            const monkActions = actionsRef.current['Monk'];
            if (monkActions) {
              const idleKey = Object.keys(monkActions).find(a => /idle_monk/i.test(a));
              if (idleKey) {
                const monkState = monkAnimStateRef.current;
                const idleAction = monkActions[idleKey];
                const prevAction = monkActions[monkState.currentAnimation];
                const alreadyOn =
                  monkState.currentAnimation === idleKey &&
                  idleAction.isRunning && idleAction.isRunning();
                // Skip the swap when already on this clip — fading the same
                // action would briefly drop its weight to 0 and blend the
                // bind pose into the bones (T-pose flash).
                if (!alreadyOn) {
                  if (prevAction && prevAction !== idleAction) {
                    prevAction.fadeOut(0.5);
                  }
                  idleAction.reset();
                  // Skip bind-pose frame so the cross-fade doesn't flash T-pose.
                  idleAction.time = bindSkipTime(idleAction);
                  idleAction.setLoop(THREE.LoopRepeat);
                  idleAction.setEffectiveWeight(1);
                  fadeInOrSnap(idleAction, monkActions, 0.5, mixersRef.current?.['Monk']);
                  idleAction.play();
                  monkState.currentAnimation = idleKey;
                }
                monkState.isPlayingSpecial = true;
                monkState.nextSwitchDelay = 999999;
                monkState.lastSwitchTime = Date.now();
              } else {
                console.warn('[Monk] idle_monk animation not found. Available:', Object.keys(monkActions));
              }
            }
          } else if (object.userData.agentId === 'RL80') {
            rl80FocusedRef.current = true;
            const rl80Actions = actionsRef.current['RL80'];
            if (rl80Actions) {
              const rl80State = rl80AnimStateRef.current;
              const animKeys = Object.keys(rl80Actions);
              // Prefer an Idle animation; fall back to Typing. Match the
              // keyword at start or after an underscore so both Typing_Unicorn
              // and Unicorn_Typing-style names resolve.
              const idleKey = animKeys.find(a => /(?:^|_)idle/i.test(a) && !TRANSITION_RE.test(a))
                || animKeys.find(a => /(?:^|_)typing/i.test(a) && !TRANSITION_RE.test(a));
              const prevAction = rl80Actions[rl80State.currentAnimation];
              const idleAction = idleKey ? rl80Actions[idleKey] : null;

              // This click handler poses Eugene ITSELF, before the
              // externalFocusAgent round-trip reaches
              // applyCharacterFocusAnimation — so the bridge has to run here
              // too, or the hands are already through the desk by the time
              // that path sees him and finds him "already on idle".
              const bridgedRL80 = tryDeskBridge({
                agentId: 'RL80',
                actions: rl80Actions,
                state: rl80State,
                toKey: idleKey,
                onSettled: () => {
                  if (!rl80FocusedRef.current) return;
                  rl80State.isPlayingSpecial = true;
                  rl80State.nextSwitchDelay = 999999;
                  rl80State.lastSwitchTime = Date.now();
                },
              });

              // No-op if we'd be transitioning to the same clip (avoids a
              // bind-pose flash from reset()).
              if (!bridgedRL80 && idleAction && idleAction !== prevAction) {
                if (prevAction) prevAction.fadeOut(0.5);
                // Skip the bind-pose first frame so the cross-fade doesn't
                // jump the unicorn through neutral.
                idleAction.reset();
                idleAction.time = bindSkipTime(idleAction, 0.1);
                idleAction.setLoop(THREE.LoopRepeat);
                fadeInOrSnap(idleAction, rl80Actions, 0.5, mixersRef.current?.['RL80']);
                idleAction.play();
                rl80State.currentAnimation = idleKey;
              }
              rl80State.isPlayingSpecial = true;
              rl80State.nextSwitchDelay = 999999;
              rl80State.lastSwitchTime = Date.now();
              if (!idleAction) {
                console.warn('[RL80] Idle animation not found. Available:', animKeys);
              }
            }
            // The greeting wave is fired by the page (unicornWave bridge) when
            // Eugene speaks a "hello" line — not on the focus click itself.
          } else if (object.userData.agentId === 'Virgil') {
            virgilFocusedRef.current = true;
            // Pause the animation so the cat sits still — eliminates loop seam glitch
            catNoticeUser(); // head-track does the noticing; behaviour continues
          } else if (object.userData.agentId === 'Detective') {
            detectiveFocusedRef.current = true;
            activateSitePalProjection('Detective');
            const detectiveState = detectiveAnimStateRef.current;
            // Cross-fade whatever's playing → detective_idle while focused
            // so the close-up reads as attentive instead of mid-keystroke.
            const detectiveActions = actionsRef.current['Detective'];
            if (detectiveActions) {
              const idleKey = Object.keys(detectiveActions).find(a => /detective.*idle/i.test(a) && !TRANSITION_RE.test(a));
              if (idleKey) {
                const idleAction = detectiveActions[idleKey];
                const alreadyOn =
                  detectiveState.currentAnimation === idleKey &&
                  idleAction.isRunning && idleAction.isRunning();
                // Same as Eugene above: this handler poses Marisol inline, so
                // detective_typing_to_idle has to run from here rather than
                // waiting for applyCharacterFocusAnimation.
                const bridgedDetective = tryDeskBridge({
                  agentId: 'Detective',
                  actions: detectiveActions,
                  state: detectiveState,
                  toKey: idleKey,
                  onSettled: () => {
                    if (!detectiveFocusedRef.current) return;
                    detectiveState.isPlayingSpecial = true;
                    detectiveState.nextSwitchDelay = 999999;
                    detectiveState.lastSwitchTime = Date.now();
                  },
                });
                // NO early return in here — onAgentClick fires below this
                // block and IS the focus. Bailing out would pose her and then
                // never focus her.
                if (!bridgedDetective) {
                  // Fade out ALL currently-running clips except the target —
                  // fading the target while no replacement fades in pulls its
                  // weight to 0 and the bind pose blends in (T-pose flash).
                  Object.values(detectiveActions).forEach((action) => {
                    if (action && action !== idleAction) {
                      const w = typeof action.getEffectiveWeight === 'function' ? action.getEffectiveWeight() : 0;
                      if ((action.isRunning && action.isRunning()) || w > 0.001) action.fadeOut(0.5);
                    }
                  });
                  if (!alreadyOn) {
                    idleAction.reset();
                    // Skip bind-pose frame so the cross-fade doesn't flash T-pose.
                    idleAction.time = bindSkipTime(idleAction);
                    idleAction.setLoop(THREE.LoopRepeat);
                    idleAction.setEffectiveWeight(1);
                    fadeInOrSnap(idleAction, detectiveActions, 0.5, mixersRef.current?.['Detective']);
                    idleAction.play();
                    detectiveState.currentAnimation = idleKey;
                  }
                  detectiveState.isPlayingSpecial = true;
                  detectiveState.nextSwitchDelay = 999999;
                  detectiveState.lastSwitchTime = Date.now();
                }
              }
            }
          }

          // Call the parent callback if provided
          if (onAgentClick) {
            onAgentClick(object.userData.agentId);
          }

          // Dispatch custom event for screens to handle video toggle
          if (object.userData.agentId && object.userData.agentId.startsWith('Screen')) {
            window.dispatchEvent(new CustomEvent('screenClicked', {
              detail: { screenName: object.userData.agentId }
            }));

            // For Screen3, also dispatch UV coordinates for button clicks
            if (object.userData.agentId === 'Screen3' && intersects[i].uv) {
              window.dispatchEvent(new CustomEvent('screen3Click', {
                detail: { uv: intersects[i].uv }
              }));
            }
          }
          
          break; // Stop after first clickable object
        }
      }
      
      // Tap-anywhere-to-unfocus: when focused, a click on empty space (or
      // any non-clickable hit) returns to overview. Skipped during reveal
      // mode (camera locked to Stage) and when the pointer moved more than
      // ~6px between pointerdown and click, so OrbitControls' rotate
      // gesture doesn't double as a dismiss.
      // A single click on empty space used to unfocus. That made focus far too
      // easy to lose — any stray click while orbiting or reading dropped you
      // back to the overview. Desktop now needs a deliberate gesture, matching
      // the double-click required to focus IN:
      //   • double-click anywhere        → handleDblClick
      //   • click the focused object     → the toggle-unfocus below
      //   • Escape                       → handleKeyDown
      // Touch is unaffected: handleTouchStart has its own broader
      // tap-anywhere-to-dismiss rule (deliberately looser, because some focus
      // framings make the character's mesh hard to hit with a finger), and its
      // synthesized clicks are consumed before they reach this handler.
    };
    
    // Listen for screenGoBack event (from on-screen buttons)
    const handleScreenGoBack = () => {
      if (focusTarget) {
        topSupporterBannerRefs.current.forEach(mesh => {
          if (mesh) mesh.visible = false;
        });
        if (onAgentClick) onAgentClick(null);
        setFocusTarget({
          position: sceneDefaultPose.position.clone(),
          lookAt: sceneDefaultPose.target.clone(),
          agentId: null,
          agentName: 'Reset'
        });
        setTimeout(() => {
          setFocusTarget(null);
        }, 1000);
      }
    };
    window.addEventListener('screenGoBack', handleScreenGoBack);

    gl.domElement.addEventListener('click', handleClick);
    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('touchstart', handleTouchStart);
    
    // Also add touchend as a backup
    gl.domElement.addEventListener('touchend', (event) => {
      handleTouchStart(event);
    });
    
    // Add pointer events for better tablet support
    const handlePointerDown = (event) => {
      // Safety check for groupRef
      if (!groupRef.current) return;

      // Record mouse position for tap-vs-drag detection used by the
      // tap-anywhere-to-unfocus path in handleClick.
      if (event.pointerType === 'mouse') {
        mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
      }

      // Only handle if it's a touch/pen input (not mouse)
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        const rect = gl.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);

        let touchedSomething = false;

        for (let i = 0; i < intersects.length; i++) {
          const object = intersects[i].object;

          if (object.userData.isCoin) {
            touchedSomething = true;
            event.preventDefault();
            const coinName = object.userData.agentId;
            triggerCoinAnimation(coinName);

            if (onAgentClick) {
              onAgentClick(coinName);
            }
            break;
          }

        }

      }
    };

    // Double-click to unfocus and return to default view
    const handleDblClick = () => {
      if (focusLockedRef.current) return;   // see focusLocked
      // The Screen double-click-to-focus gesture in handleClick fires a
      // native dblclick event right after; consume it once so we don't
      // immediately unfocus what was just focused.
      if (suppressNextDblClickRef.current) {
        suppressNextDblClickRef.current = false;
        return;
      }
      if (!focusTarget) return;
      restoreDemonFromFocus();

      // Hide banner
      topSupporterBannerRefs.current.forEach(mesh => {
        if (mesh) mesh.visible = false;
      });

      if (onAgentClick) onAgentClick(null);

      setFocusTarget({
        position: sceneDefaultPose.position.clone(),
        lookAt: sceneDefaultPose.target.clone(),
        agentId: null,
        agentName: 'Reset'
      });
      setTimeout(() => {
        setFocusTarget(null);
      }, 1000);
    };

    gl.domElement.addEventListener('pointerdown', handlePointerDown);
    gl.domElement.addEventListener('dblclick', handleDblClick);

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      gl.domElement.removeEventListener('click', handleClick);
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('touchstart', handleTouchStart);
      gl.domElement.removeEventListener('touchend', handleTouchStart);
      gl.domElement.removeEventListener('pointerdown', handlePointerDown);
      gl.domElement.removeEventListener('dblclick', handleDblClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('screenGoBack', handleScreenGoBack);
      gl.domElement.style.cursor = 'default';
    };
  }, [gl, camera, onAgentClick, loadedModel, focusTarget, originalCameraPosition, hoveredCoin,
      coin1OriginalScale, coin1OriginalEmissive, coin2OriginalScale, coin2OriginalEmissive,
      coin3OriginalScale, coin3OriginalEmissive, coin4OriginalScale, coin4OriginalEmissive,
      isOnMobile, clickedCoin, onCoinFaceTap, revealMode]); // Added dependencies

  

  // SitePal-on-Demon setup. The embed is mounted once by the trade
  // page (re-injecting its script breaks vhssHTML_scenes globals), so
  // this effect only needs to find the SitePal canvas and build the
  // texture/material once. Visibility + audio are toggled per-frame
  // and in a separate effect respectively.
  useEffect(() => {
    if (!loadedModel) return;
    const state = demonSitePalRef.current;
    let cancelled = false;
    let pollTimer = null;

    const ensureMaterial = () => {
      if (!state.cropCanvas) {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 512;
        cropCanvas.height = 512;
        state.cropCanvas = cropCanvas;
        state.cropCtx = cropCanvas.getContext('2d');
      }
      if (!state.texture) {
        const tex = new THREE.CanvasTexture(state.cropCanvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        state.texture = tex;
      }
      if (!state.material) {
        state.material = new THREE.MeshBasicMaterial({
          map: state.texture,
          toneMapped: false,
          side: THREE.DoubleSide,
        });
      }
      if (!state.materialApplied && demonFace2MeshRef.current) {
        demonFace2MeshRef.current.material = state.material;
        state.materialApplied = true;
      }
    };

    // Poll for the SitePal source element. SitePal usually paints into
    // the LAST <canvas> in the container once it's done bootstrapping
    // (initial canvases are bootstrap stubs). Fall back to a <video>
    // or in-iframe canvas if the embed picked a different render path
    // for this scene/account. After a long timeout, accept whatever is
    // there so we don't get stuck waiting forever.
    const startedAt = Date.now();
    const pollForSource = () => {
      if (cancelled) return;
      const container = document.getElementById(DEMON_SITEPAL_CONTAINER_ID);
      if (container) {
        const canvases = container.querySelectorAll('canvas');
        // Fast path: once SitePal's vh_sceneLoaded callback has fired,
        // the embed is fully bootstrapped — whatever canvas is present
        // IS the right one to crop. Saves the multi-second wait when
        // the scene only renders a single canvas (which was making
        // Face2 take 20+ seconds to swap in even though audio was
        // already playing).
        const sceneLoaded = typeof window !== 'undefined' && window.__sitePalSceneLoaded;
        if (sceneLoaded && canvases.length >= 1) {
          state.sourceEl = canvases[canvases.length - 1];
          ensureMaterial();
          return;
        }
        if (canvases.length >= 2) {
          state.sourceEl = canvases[canvases.length - 1];
          ensureMaterial();
          return;
        }
        const video = container.querySelector('video');
        if (video) {
          state.sourceEl = video;
          ensureMaterial();
          return;
        }
        const iframe = container.querySelector('iframe');
        if (iframe) {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const ifc = doc.querySelectorAll('canvas');
            if (ifc.length >= 1) {
              state.sourceEl = ifc[ifc.length - 1];
              ensureMaterial();
              return;
            }
            const ifv = doc.querySelector('video');
            if (ifv) {
              state.sourceEl = ifv;
              ensureMaterial();
              return;
            }
          } catch (e) {
            // cross-origin iframe — can't read into it
          }
        }
        // Last-ditch: after 3s, take whatever single canvas exists.
        // (Was 15s — too conservative. Most SitePal scenes have a
        // canvas painted within ~1s; the vh_sceneLoaded fast path
        // above handles the common case.)
        if (Date.now() - startedAt > 3000 && canvases.length >= 1) {
          state.sourceEl = canvases[canvases.length - 1];
          ensureMaterial();
          return;
        }
      }
      pollTimer = setTimeout(pollForSource, 200);
    };

    ensureMaterial();
    pollForSource();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [loadedModel]);

  const ensureProjectionMaterial = (state, face2Object) => {
    if (!state.cropCanvas) {
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = 512;
      cropCanvas.height = 512;
      state.cropCanvas = cropCanvas;
      state.cropCtx = cropCanvas.getContext('2d');
    }
    if (!state.texture) {
      const tex = new THREE.CanvasTexture(state.cropCanvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      state.texture = tex;
    }
    if (!state.material) {
      state.material = new THREE.MeshBasicMaterial({
        map: state.texture,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
    }
    if (!state.materialApplied && face2Object) {
      face2Object.material = state.material;
      state.materialApplied = true;
    }
  };

  // Per-character crop canvas + material setup. The host portal/source
  // canvas is shared, while each projected character owns a crop canvas
  // and Face2 material.
  useEffect(() => {
    if (!loadedModel) return;
    ensureProjectionMaterial(detectiveSitePalRef.current, detectiveFace2MeshRef.current);
    ensureProjectionMaterial(monkSitePalRef.current, monkFace2MeshRef.current);
  }, [loadedModel]);

  // Drive SitePal audio with focus state. The SitePal API
  // (setPlayerVolume / sayAudio / stopSpeech) is exposed on `window`
  // once vh_sceneLoaded fires, but may not be ready on the first
  // focus — so we poll briefly. On focus: unmute and sayAudio() the
  // configured track by name. On un-focus: mute and stopSpeech to
  // interrupt any in-progress audio.
  useEffect(() => {
    let cancelled = false;
    let stopTimer = null;
    const anySitePalActive = useSitePalForDemon || useSitePalForDetective || useSitePalForMonk;
    const target = anySitePalActive ? 7 : 0;

    const apply = () => {
      if (cancelled) return true;
      if (typeof window === 'undefined') return false;
      window.__sitePalDesiredVolume = target;
      if (typeof window.setPlayerVolume !== 'function') return false;
      try { window.setPlayerVolume(target); } catch (e) {}
      if (!anySitePalActive && typeof window.stopSpeech === 'function') {
        try { window.stopSpeech(); } catch (e) { /* swallow */ }
      }
      return true;
    };

    if (!apply()) {
      const poll = setInterval(() => {
        if (apply()) clearInterval(poll);
      }, 300);
      stopTimer = setTimeout(() => clearInterval(poll), 8000);
    }
    return () => {
      cancelled = true;
      if (stopTimer) clearTimeout(stopTimer);
    };
  }, [useSitePalForDemon, useSitePalForDetective, useSitePalForMonk]);

  // Animation loop
  useFrame((state, delta) => {
    // Update flame shader time for all flame meshes
    flameMaterialsRef.current.forEach(mat => {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    });

    // Unicorn horn/aura glow — pulse emissive with the speaking Unicorn's audio
    // amplitude. unicornGlow.value (0..1) is written by playUnicornBeat's
    // analyser; it's 0 when idle, so emissive returns to its base each frame.
    {
      const g = unicornGlow.value || 0;
      const glowMats = unicornGlowMatsRef.current;
      for (let i = 0; i < glowMats.length; i++) {
        glowMats[i].mat.emissiveIntensity = glowMats[i].base + g * 2.4; // gain — tune
      }
    }

    // SitePal projections. One shared host portal provides the active
    // source canvas; each character owns a crop canvas + Face2 target.
    // Add new characters by extending SITEPAL_PROJECTION_CONFIG and
    // adding a projection entry below.
    const sp = demonSitePalRef.current;
    if (typeof window !== 'undefined') {
      const v = window.__sitePalSceneVersion || 0;
      if (sp.lastSceneVersion !== v) {
        const container = document.getElementById(DEMON_SITEPAL_CONTAINER_ID);
        if (container) {
          const canvases = container.querySelectorAll('canvas');
          if (canvases.length >= 1) {
            sp.sourceEl = canvases[canvases.length - 1];
          }
        }
        sp.lastSceneVersion = v;
      }
    }
    const sharedSource = sp.sourceEl;

    const sitePalVisibility = { Demon: false, Detective: false, Monk: false };

    const paintProjection = ({ id, enabled, state: projectionState, face1Ref, face2Ref, hideRefs = [], hideMeshes = [], allowInitialScene = false }) => {
      const config = SITEPAL_PROJECTION_CONFIG[id];
      if (!config) return false;
      const onScene =
        typeof window !== 'undefined' &&
        (
          window.__sitePalCurrentSceneId === config.sceneId ||
          (allowInitialScene && window.__sitePalCurrentSceneId === undefined)
        ) &&
        (
          window.__sitePalSceneLoaded === true ||
          (allowInitialScene && window.__sitePalCurrentSceneId === undefined)
        );
      const ready = !!(sharedSource && projectionState.cropCtx && onScene);
      const show = enabled && ready;

      if (face1Ref?.current) face1Ref.current.visible = !show;
      if (face2Ref?.current) face2Ref.current.visible = show;
      hideRefs.forEach((ref) => {
        if (ref?.current) ref.current.visible = !show;
      });
      hideMeshes.forEach((mesh) => {
        if (mesh) mesh.visible = !show;
      });

      if (!show) return false;
      const ctx = projectionState.cropCtx;
      const canvas = projectionState.cropCanvas;
      const { cropX, cropY, cropW, cropH, rotateZ, rotateX } = config.crop;
      const f = config.filter;
      ctx.fillStyle = '#9F7854';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        ctx.save();
        ctx.filter = `saturate(${f.saturate}%) contrast(${f.contrast}%) brightness(${f.brightness}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%)`;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotateZ * Math.PI) / 180);
        const xScale = Math.cos((rotateX * Math.PI) / 180);
        ctx.scale(1, xScale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        ctx.drawImage(sharedSource, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.filter = 'none';
      } catch (e) {
        // Source canvas not yet renderable (preserveDrawingBuffer race).
      }
      if (projectionState.texture) projectionState.texture.needsUpdate = true;
      return true;
    };

    sitePalVisibility.Demon = paintProjection({
      id: 'Demon',
      enabled: useSitePalForDemon,
      state: sp,
      face1Ref: demonFace1MeshRef,
      face2Ref: demonFace2MeshRef,
      hideMeshes: [...demonBlinkMeshesRef.current, ...demonBrowMeshesRef.current],
      allowInitialScene: true,
    });
    sitePalVisibility.Detective = paintProjection({
      id: 'Detective',
      enabled: useSitePalForDetective,
      state: detectiveSitePalRef.current,
      face1Ref: detectiveFace1MeshRef,
      face2Ref: detectiveFace2MeshRef,
    });
    if (sitePalVisibility.Detective) {
      if (detectiveEyesRef.current) detectiveEyesRef.current.visible = false;
      if (detectiveClosedEyesRef.current) detectiveClosedEyesRef.current.visible = false;
    }
    sitePalVisibility.Monk = paintProjection({
      id: 'Monk',
      enabled: useSitePalForMonk,
      state: monkSitePalRef.current,
      face1Ref: monkFace1MeshRef,
      face2Ref: monkFace2MeshRef,
      hideMeshes: [...monkEyesMeshesRef.current],
    });

    // One-shot: establish camera-controls' internal spherical state at
    // load. setTarget alone doesn't always re-derive azimuth/polar from
    // the camera position, which left auto-orbit doing nothing until a
    // setLookAt happened (e.g. first focus → return). Calling setLookAt
    // here with the camera's current position + the resting pivot fully
    // initializes the controls so auto-rotation works immediately.
    if (!orbitTargetInitedRef.current && state.controls && state.controls.setLookAt) {
      state.controls.setLookAt(
        camera.position.x, camera.position.y, camera.position.z,
        restingOrbitCenter.x, restingOrbitCenter.y, restingOrbitCenter.z,
        false,
      );
      orbitTargetInitedRef.current = true;
    }

    // Skip the bind-pose region of looping unicorn (RL80) clips before
    // the mixer evaluates them. Mixamo-style clips anchor a bind pose at
    // frame 0 and the last frame; on loop wrap the mixer briefly hits
    // those, causing a one-frame T-pose flash. Pre-empting the wrap
    // (and forcing a minimum time at clip start) avoids it without
    // mutating the clip data, so position tracks stay intact.
    // Capped in SECONDS, not as a fraction — see BIND_SKIP_S. This pass rewrites
    // action.time EVERY FRAME, so an over-large inset doesn't just affect the
    // seek at swap time: it continuously pins the clip past its opening pose,
    // which is what dropped the hands after a transition landed.
    const safeFrac = 0.05; // 5% inset on both ends, capped at BIND_SKIP_S
    ['RL80', 'Demon', 'Monk', 'Detective'].forEach((charName) => {
      const charActions = actionsRef.current?.[charName];
      if (!charActions) return;
      Object.keys(charActions).forEach((name) => {
        // TRANSITION_RE clips are one-shot bridges — rewriting their time here
        // every frame would pin them and they'd never reach their end.
        if (!/typ|idle|clap/i.test(name) || /wav/i.test(name) || TRANSITION_RE.test(name)) return;
        const action = charActions[name];
        if (!action.isRunning() || action.paused) return;
        const dur = action.getClip().duration;
        const safe = Math.min(dur * safeFrac, BIND_SKIP_S);
        const advance = delta * (action.getEffectiveTimeScale?.() ?? action.timeScale ?? 1);
        if (action.time < safe) {
          action.time = safe;
        } else if (action.time + advance >= dur - safe) {
          // Pre-empt the loop wrap so the trailing bind frame is skipped
          // AND the next frame lands safely past the leading bind frame.
          action.time = safe;
        }
      });
    });

    // The pitch bot's holographic scanlines. Its uniforms live in
    // lib/trade/pitchBotHolo's registry, which is empty until the bot loads, so
    // this is a no-op on every other /trade mode.
    tickPitchBotHolo(state.clock.elapsedTime);
    // THE CAST rides this same clock rather than gsap's — one clock for the wipe
    // and the beam flare, so they cannot drift, and no lagSmoothing to stretch a
    // stalled frame into a crawl. Returns 1 while idle, so this is unconditional.
    const cast = tickPitchBotCast(delta);
    beamBoostRef.current = cast.opacity;
    beamHeightRef.current = cast.height;
    // NO FACE UNTIL THERE IS A BODY. The LED plates are excluded from the
    // holographic wash and so never get its alpha ramp — without this they hang
    // in an empty beam a beat before the figure. Driven from here rather than
    // inside either module because this is the one place that already ticks both.
    setPitchBotFaceHidden(!cast.bodyDense);
    // Face the camera, yaw only. No-op until the bot loads.
    tickPitchBotBillboard(state.camera);
    // THE LED FACE FOLLOWS THE CLIP — v2's rig only. It reads which action
    // currently carries the most weight and swaps the visible face mesh to match,
    // which is why the speech effect below needed no edit: anything that drives
    // `actions.talking` / `actions.idle` moves the face for free. No-op on v1
    // (no face meshes) and while an expression is pinned via __pitchBotFace.
    tickPitchBotFace();

    // Update all character mixers independently
    if (mixersRef.current) {
      Object.values(mixersRef.current).forEach(mixer => {
        if (mixer) {
          mixer.update(delta);
        }
      });
    }

    // Time-gate the Demon's SmartPhone within the looping demon_phone clip —
    // it's only in-hand for frames 35–1076 (see applyCharacterReaction, which
    // arms smartPhoneGateRef with the show/hide times). Read after mixer.update
    // so action.time is current for this frame.
    if (smartPhoneRef.current && smartPhoneGateRef.current) {
      const { action, showTime, hideTime } = smartPhoneGateRef.current;
      const t = action.time;
      smartPhoneRef.current.visible =
        !!(action.isRunning && action.isRunning()) && t >= showTime && t <= hideTime;
    }

    // Aim the broadcast beam at the geometric beacon's live world position
    // (replaces the old fixed angel-spot target — the primitive's position prop
    // is now just a pre-load fallback). worldToLocal puts it into the beam
    // target's parent space so the SpotLight points exactly at the beacon.
    if (beaconRef.current && beamTarget.parent) {
      beaconRef.current.getWorldPosition(beamTmp.current);
      beamTarget.parent.worldToLocal(beamTmp.current);
      beamTarget.position.copy(beamTmp.current);
    }

    // Apply GEOMETRIC_SHAPE_NUDGE on top of the beacon container's baked
    // transform (lets the shape be nudged from code without re-exporting).
    if (beaconContainerRef.current && beaconBaked.current) {
      const c = beaconContainerRef.current;
      const b = beaconBaked.current;
      const n = GEOMETRIC_SHAPE_NUDGE;
      c.position.set(b.pos.x + n.position[0], b.pos.y + n.position[1], b.pos.z + n.position[2]);
      c.rotation.set(b.rot.x + n.rotation[0], b.rot.y + n.rotation[1], b.rot.z + n.rotation[2]);
      c.scale.set(b.scl.x * n.scale, b.scl.y * n.scale, b.scl.z * n.scale);
    }
    
    // Handle Demon animation alternation — mostly typing/idle, occasional
    // one-shot fistpump/laughing.
    if (!isOnMobile && actionsRef.current['Demon']) {
      const currentTime = Date.now();
      const demonState = demonAnimStateRef.current;

      if (demonState.lastSwitchTime === 0) {
        demonState.lastSwitchTime = currentTime;
      }

      if (!demonState.isPlayingSpecial && currentTime - demonState.lastSwitchTime > demonState.nextSwitchDelay) {
        const demonActions = actionsRef.current['Demon'];
        const availableAnimations = Object.keys(demonActions);

        // Loop pool = typing/idle; specials = fistpump/laughing (one-shot).
        // When `jackpotOnlyFistPump` is on, FistPump is reserved for
        // slot-machine jackpots and excluded from the random rotation —
        // leaving laughing as the only random special.
        // /stand/ is excluded so the STANDING curtain-call neutral
        // (demon_stand_idle) can't be drawn into the seated desk rotation
        // just because its name contains "idle".
        const loopAnimations = availableAnimations.filter(a =>
          /typing|idle/i.test(a) && !/sit_idle|stand/i.test(a) && !TRANSITION_RE.test(a));
        const specialPattern = jackpotOnlyFistPump
          ? /laughing/i
          : /fistpump|laughing/i;
        const specialAnimations = availableAnimations.filter(a =>
          specialPattern.test(a));

        if (availableAnimations.length === 0) return;

        let nextAnimation;

        if (loopAnimations.includes(demonState.currentAnimation)) {
          if (specialAnimations.length > 0 && Math.random() < 0.3) {
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          } else if (loopAnimations.length > 1) {
            const others = loopAnimations.filter(a => a !== demonState.currentAnimation);
            nextAnimation = others[Math.floor(Math.random() * others.length)];
          } else {
            nextAnimation = loopAnimations[0];
          }
        } else {
          nextAnimation = loopAnimations.length > 0
            ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
            : availableAnimations[0];
        }

        const currentAction = demonActions[demonState.currentAnimation];
        const nextAction = demonActions[nextAnimation];

        // typing↔idle goes through the authored bridge so the hands clear the
        // desk; every other switch (specials) keeps the plain crossFadeTo.
        // NB: must not `return` here — this runs inside useFrame, and bailing
        // would skip the other three characters plus all head-tracking.
        const demonBridged =
          isDeskSwap(demonState.currentAnimation, nextAnimation) &&
          playTypingIdleBridge({
            agentId: 'Demon',
            actions: demonActions,
            state: demonState,
            toKey: nextAnimation,
            onSettled: () => {
              demonState.nextSwitchDelay = /idle/i.test(nextAnimation)
                ? Math.random() * 3000 + 4000
                : Math.random() * 10000 + 8000;
            },
          });

        if (!demonBridged && nextAction) {
          nextAction.reset();
          if (specialAnimations.includes(nextAnimation)) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true;
            demonState.isPlayingSpecial = true;
          } else {
            nextAction.setLoop(THREE.LoopRepeat);
          }
          nextAction.setEffectiveWeight(1);
          nextAction.play();

          // Use crossFadeTo so the fade-out and fade-in are scheduled
          // against the same mixer time — prevents the brief T-pose
          // flash from per-frame weight desync between separate
          // fadeOut/fadeIn calls.
          if (currentAction && currentAction !== nextAction) {
            currentAction.crossFadeTo(nextAction, 0.5, false);
          } else {
            nextAction.fadeIn(0.5);
          }

          if (specialAnimations.includes(nextAnimation)) {
            const animDuration = nextAction.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations.length > 0
                ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
                : availableAnimations[0];
              const returnAction = demonActions[returnAnim];
              if (returnAction) {
                returnAction.reset();
                returnAction.setLoop(THREE.LoopRepeat);
                returnAction.setEffectiveWeight(1);
                returnAction.play();
                nextAction.crossFadeTo(returnAction, 0.5, false);
                demonState.currentAnimation = returnAnim;
                demonState.isPlayingSpecial = false;
                demonState.nextSwitchDelay = Math.random() * 8000 + 6000;
                demonState.lastSwitchTime = Date.now();
              } else {
                demonState.isPlayingSpecial = false;
              }
            }, Math.max(100, animDuration - 500));
          }
        }

        // Skipped while bridging — playTypingIdleBridge parks these itself and
        // its hand-off restores them when the bridge lands.
        if (!demonBridged) {
          demonState.currentAnimation = nextAnimation;

          if (loopAnimations.includes(nextAnimation)) {
            demonState.nextSwitchDelay = /idle/i.test(nextAnimation)
              ? Math.random() * 3000 + 4000
              : Math.random() * 10000 + 8000;
          } else {
            demonState.nextSwitchDelay = 999999;
          }

          demonState.lastSwitchTime = currentTime;
        }
      }
    }

    // Handle Detective animation alternation — swap detective_typing and
    // detective_idle (both looping) on a randomized interval. Paused
    // entirely during focus so the held idle isn't bumped off by the
    // alternation timer — except once her lobby intro has finished and
    // releaseCharacterFocusAnimation has handed her back, where she keeps
    // alternating even though the camera is still on her.
    if ((!detectiveFocusedRef.current || focusAnimReleasedRef.current) && actionsRef.current['Detective']) {
      const currentTime = Date.now();
      const detectiveState = detectiveAnimStateRef.current;

      if (detectiveState.lastSwitchTime === 0) {
        detectiveState.lastSwitchTime = currentTime;
      }

      if (
        !detectiveState.isPlayingSpecial &&
        currentTime - detectiveState.lastSwitchTime > detectiveState.nextSwitchDelay
      ) {
        const detectiveActions = actionsRef.current['Detective'];
        // Tolerate Blender's armature-prefixed names (e.g.
        // "Armature.001|detective_typing") by matching on substring.
        const typingKey = Object.keys(detectiveActions).find(k => /detective.*typ/i.test(k) && !TRANSITION_RE.test(k));
        const idleKey = Object.keys(detectiveActions).find(k => /detective.*idle/i.test(k) && !TRANSITION_RE.test(k));
        const typing = typingKey && detectiveActions[typingKey];
        const idle = idleKey && detectiveActions[idleKey];

        if (typing && idle) {
          // Pick whichever clip isn't currently playing.
          const currentKey = detectiveState.currentAnimation;
          const isOnTyping = currentKey === typingKey;
          const fromAction = isOnTyping ? typing : idle;
          const toAction = isOnTyping ? idle : typing;
          const toKey = isOnTyping ? idleKey : typingKey;

          // Route through the authored bridge so the hands clear the desk.
          const bridged = playTypingIdleBridge({
            agentId: 'Detective',
            actions: detectiveActions,
            state: detectiveState,
            toKey,
            onSettled: () => {
              detectiveState.nextSwitchDelay = Math.random() * 8000 + 8000;
            },
          });

          if (!bridged) {
            fromAction.fadeOut(0.5);
            toAction.reset();
            toAction.setLoop(THREE.LoopRepeat);
            toAction.setEffectiveWeight(1);
            toAction.fadeIn(0.5);
            toAction.play();

            detectiveState.currentAnimation = toKey;
            detectiveState.nextSwitchDelay = Math.random() * 8000 + 8000;
            detectiveState.lastSwitchTime = currentTime;
          }
        } else {
          // Either clip is missing — back off so we don't busy-loop.
          detectiveState.nextSwitchDelay = 30000;
          detectiveState.lastSwitchTime = currentTime;
        }
      }
    }

    // Handle RL80 animation alternation
    if (!isOnMobile && actionsRef.current['RL80']) {
      const currentTime = Date.now();
      const rl80State = rl80AnimStateRef.current;
      
      // Initialize lastSwitchTime if it's 0
      if (rl80State.lastSwitchTime === 0) {
        rl80State.lastSwitchTime = currentTime;
      }
      
      if (!rl80State.isPlayingSpecial && currentTime - rl80State.lastSwitchTime > rl80State.nextSwitchDelay) {
        const rl80Actions = actionsRef.current['RL80'];

        // Get available animations for RL80
        const availableAnimations = Object.keys(rl80Actions);

        // Filter animations based on what's actually available.
        // Original RL80 rig: Idle, Typing, Clap, Disbelief, FistPump.
        // Unicorn rig (V2): supports both Typing_Unicorn and Unicorn_Typing
        // naming styles. Match the keyword at the start or after an
        // underscore so all conventions resolve correctly.
        const isLoopAnim = (anim) => /(?:^|_)(typing|idle|clap)/i.test(anim) && !TRANSITION_RE.test(anim);
        const isSpecialAnim = (anim) => /(?:^|_)(disbelief|fistpump)/i.test(anim);
        const loopAnimations = availableAnimations.filter(isLoopAnim);
        const specialAnimations = availableAnimations.filter(isSpecialAnim);

        // If we don't have any animations, skip
        if (availableAnimations.length === 0) {
          console.warn('[RL80] No animations available, skipping switch');
          return;
        }

        // Nothing to alternate to (e.g. unicorn rig only ships Typing_Unicorn).
        // Fading the same clip out and in causes a momentary T-pose between
        // weight=0 and the fade-in — bail before that happens.
        if (loopAnimations.length <= 1 && specialAnimations.length === 0) {
          rl80State.lastSwitchTime = currentTime;
          rl80State.nextSwitchDelay = 60000;
          return;
        }
        
        let nextAnimation;
        
        // If we're on a loop animation, pick next animation
        if (loopAnimations.includes(rl80State.currentAnimation)) {
          // Initialize recentAnimations if it doesn't exist
          if (!rl80State.recentAnimations) {
            rl80State.recentAnimations = [];
          }
          
          // 70% chance to stay with loop animations, 30% for special
          if (Math.random() < 0.7 && loopAnimations.length > 0) {
            // If we have multiple loop animations, switch between them
            if (loopAnimations.length > 1) {
              const otherLoops = loopAnimations.filter(anim => anim !== rl80State.currentAnimation);
              nextAnimation = otherLoops[0];
            } else {
              // Only one loop animation (Typing), keep using it
              nextAnimation = loopAnimations[0];
            }
          } else if (specialAnimations.length > 0) {
            // Pick a special animation
            let availableSpecials = specialAnimations.filter(anim => 
              !rl80State.recentAnimations.includes(anim)
            );
            
            if (availableSpecials.length === 0) {
              availableSpecials = specialAnimations;
              rl80State.recentAnimations = [];
            }
            
            nextAnimation = availableSpecials[Math.floor(Math.random() * availableSpecials.length)];
            rl80State.recentAnimations.push(nextAnimation);
            
            if (rl80State.recentAnimations.length > 1) {
              rl80State.recentAnimations.shift();
            }
          } else {
            // No special animations available, keep current or use first available
            nextAnimation = rl80State.currentAnimation;
          }
        } else {
          // Return from special animation to a loop animation
          nextAnimation = loopAnimations.length > 0 ? 
            loopAnimations[Math.floor(Math.random() * loopAnimations.length)] : 
            availableAnimations[0];
        }
        
        
        const prevAction = rl80Actions[rl80State.currentAnimation];
        const action = rl80Actions[nextAnimation];

        // Skip the swap entirely if we'd be transitioning to the same clip —
        // a fadeOut+fadeIn on one action drops weight to zero in between.
        if (prevAction && action === prevAction) {
          rl80State.currentAnimation = nextAnimation;
          rl80State.lastSwitchTime = currentTime;
          return;
        }

        // typing↔idle routes through the authored bridge (hands clear the desk).
        // No early `return` — this is inside useFrame.
        const rl80Bridged =
          isDeskSwap(rl80State.currentAnimation, nextAnimation) &&
          playTypingIdleBridge({
            agentId: 'RL80',
            actions: rl80Actions,
            state: rl80State,
            toKey: nextAnimation,
            onSettled: () => {
              rl80State.nextSwitchDelay = /(?:^|_)typing/i.test(nextAnimation)
                ? Math.random() * 8000 + 12000
                : Math.random() * 5000 + 5000;
            },
          });

        // Play the next animation
        if (!rl80Bridged && action) {
          const isSpecialAnimation = isSpecialAnim(nextAnimation);

          // Fade the outgoing clip — both branches do this.
          if (prevAction) prevAction.fadeOut(0.5);

          if (isSpecialAnimation) {
            action.reset();
            action.fadeIn(0.5);
          } else {
            // Loop → loop crossfade. Skip the first ~10% of the incoming clip
            // because Mixamo clips frequently start at near-bind-pose, which
            // would briefly leak through during the 0.5s blend.
            action.reset();
            action.time = bindSkipTime(action, 0.1);
            action.setLoop(THREE.LoopRepeat);
            action.fadeIn(0.5);
            action.play();
          }

          if (isSpecialAnimation) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();

            // Calculate when to start transitioning back
            const animDuration = action.getClip().duration * 1000;
            const transitionStartTime = Math.max(100, animDuration - 500);

            // Start transition back to a loop animation — same crossFadeTo
            // approach so we don't pop into bind pose on the way back.
            setTimeout(() => {
              const availableLoops = Object.keys(rl80Actions).filter(isLoopAnim);
              const returnAnimation = availableLoops.length > 0
                ? availableLoops[Math.floor(Math.random() * availableLoops.length)]
                : Object.keys(rl80Actions)[0];
              const loopAction = rl80Actions[returnAnimation];
              if (loopAction) {
                action.fadeOut(0.5);
                loopAction.reset();
                loopAction.time = bindSkipTime(loopAction, 0.1);
                loopAction.setLoop(THREE.LoopRepeat);
                loopAction.fadeIn(0.5);
                loopAction.play();
              }

              rl80State.currentAnimation = returnAnimation;
              rl80State.nextSwitchDelay = Math.random() * 8000 + 12000;
              rl80State.lastSwitchTime = Date.now();
            }, transitionStartTime);
          }
        }
        
        // Skipped while bridging — the bridge parks these and its hand-off
        // restores them when it lands.
        if (!rl80Bridged) {
          rl80State.currentAnimation = nextAnimation;

          // Set appropriate delay based on animation type
          if (/(?:^|_)typing/i.test(nextAnimation)) {
            rl80State.nextSwitchDelay = Math.random() * 8000 + 12000; // 12-20 seconds for typing
          } else if (/(?:^|_)(idle|clap)/i.test(nextAnimation)) {
            // For other loop animations, set reasonable delays
            rl80State.nextSwitchDelay = Math.random() * 5000 + 5000; // 5-10 seconds
          } else {
            // For special animations (Disbelief, FistPump), wait for them to finish
            rl80State.nextSwitchDelay = 999999; // Large number to prevent switching during animation
          }

          rl80State.lastSwitchTime = currentTime;
        }
      }
    }
    
    // Monk attention-getting wave (waving_over) — fires every 5–9s on a
    // one-shot, returns to the monk's regular loop. Stops once the user has
    // focused on the monk (game flow takes over from there). Held off until
    // the user clicks START in GameOverlay (gameStarted prop).
    if (attractMonk && actionsRef.current['Monk'] && !monkWaveStateRef.current.hasBeenFocused && !monkFocusedRef.current) {
      const monkActions = actionsRef.current['Monk'];
      // Attention-getter cycle: hail → idle (head still tracks camera) → hail
      // → idle → … → beckon (every 4–5 hails) → idle → repeat. Loops until
      // the user clicks the monk (hasBeenFocused).
      const hailKey = Object.keys(monkActions).find(a => /monk_hail/i.test(a));
      const beckonKey = Object.keys(monkActions).find(a => /monk_beckon/i.test(a));
      const idleKey = Object.keys(monkActions).find(a => /idle_monk/i.test(a));
      if (hailKey) {
        const wState = monkWaveStateRef.current;
        const now = Date.now();
        if (!wState.everInitialized) {
          // Initial delay before first sequence so the page settles in first.
          wState.nextFireTime = now + 3000;
          wState.everInitialized = true;
        }
        const monkState = monkAnimStateRef.current;
        if (now >= wState.nextFireTime && !monkState.isPlayingSpecial) {
          const hail = monkActions[hailKey];
          const prev = monkActions[monkState.currentAnimation];
          const isRetrigger = prev === hail;
          if (prev && !isRetrigger) prev.fadeOut(0.5);
          hail.reset();
          hail.setLoop(THREE.LoopOnce, 1);
          hail.clampWhenFinished = true;
          // On retrigger, skip fadeIn — it would drop weight to 0 momentarily
          // and (with no other action playing) the mixer would fall back to
          // bind pose, causing a T-pose flash between hail loops. Keep weight
          // at 1 by jumping straight to play.
          if (!isRetrigger) hail.fadeIn(0.5);
          else hail.setEffectiveWeight(1);
          hail.play();
          monkState.currentAnimation = hailKey;
          monkState.isPlayingSpecial = true;
          wState.attentionActive = true;
          wState.hailsUntilBeckon -= 1;
          const hailDurMs = hail.getClip().duration * 1000;

          // Helper: cross-fade into idle_monk for one playthrough, then
          // re-arm so the outer block retriggers hail on the next frame.
          // Falls back to immediate retrigger if idle_monk isn't available.
          const playIdleInterlude = (fromAction) => {
            if (monkWaveStateRef.current.hasBeenFocused) return;
            if (!idleKey) {
              monkState.isPlayingSpecial = false;
              monkWaveStateRef.current.nextFireTime = Date.now();
              return;
            }
            const idle = monkActions[idleKey];
            if (fromAction && fromAction !== idle) fromAction.fadeOut(0.5);
            idle.reset();
            idle.setLoop(THREE.LoopOnce, 1);
            idle.clampWhenFinished = true;
            idle.fadeIn(0.5);
            idle.play();
            monkState.currentAnimation = idleKey;
            const idleDurMs = idle.getClip().duration * 1000;
            setTimeout(() => {
              if (monkWaveStateRef.current.hasBeenFocused) return;
              monkState.isPlayingSpecial = false;
              monkWaveStateRef.current.nextFireTime = Date.now();
            }, Math.max(100, idleDurMs - 500));
          };

          // Step 2: just before hail ends, either cross-fade into monk_beckon
          // (every 4–5 hails) or play an idle interlude before the next hail.
          setTimeout(() => {
            if (monkWaveStateRef.current.hasBeenFocused) return;
            const wState2 = monkWaveStateRef.current;
            const shouldBeckon = beckonKey && wState2.hailsUntilBeckon <= 0;
            if (!shouldBeckon) {
              playIdleInterlude(hail);
              return;
            }
            // Reset the counter for the next beckon (4–5 hails away).
            wState2.hailsUntilBeckon = 4 + Math.floor(Math.random() * 2);
            const beckon = monkActions[beckonKey];
            hail.fadeOut(0.5);
            beckon.reset();
            beckon.setLoop(THREE.LoopOnce, 1);
            beckon.clampWhenFinished = true;
            beckon.fadeIn(0.5);
            beckon.play();
            monkState.currentAnimation = beckonKey;
            const beckonDurMs = beckon.getClip().duration * 1000;

            // Step 3: just before beckon ends, play an idle interlude before
            // the next hail cycle.
            setTimeout(() => {
              playIdleInterlude(beckon);
            }, Math.max(100, beckonDurMs - 500));
          }, Math.max(100, hailDurMs - 500));
        }
      }
    }

    // Handle Monk animation alternation — mostly typing/idle, occasional disbelief/fistpump
    if (!isOnMobile && actionsRef.current['Monk']) {
      const currentTime = Date.now();
      const monkState = monkAnimStateRef.current;

      if (monkState.lastSwitchTime === 0) {
        monkState.lastSwitchTime = currentTime;
      }

      if (!monkState.isPlayingSpecial && currentTime - monkState.lastSwitchTime > monkState.nextSwitchDelay) {
        const monkActions = actionsRef.current['Monk'];
        const availableAnimations = Object.keys(monkActions);

        // Monk animations use *_monk suffix — classify by name
        // Exclude disapproval from rotation for now
        const filteredAnimations = availableAnimations.filter(a =>
          !/disapproval/i.test(a));
        const loopAnimations = filteredAnimations.filter(a =>
          /typing|idle|laughing/i.test(a) && !TRANSITION_RE.test(a));
        const specialAnimations = filteredAnimations.filter(a =>
          /disbelief|clap|fistpump/i.test(a));

        if (availableAnimations.length === 0) return;

        let nextAnimation;

        if (loopAnimations.includes(monkState.currentAnimation)) {
          if (specialAnimations.length > 0 && Math.random() < 0.25) {
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          } else if (loopAnimations.length > 1) {
            const others = loopAnimations.filter(a => a !== monkState.currentAnimation);
            nextAnimation = others[Math.floor(Math.random() * others.length)];
          } else {
            nextAnimation = loopAnimations[0];
          }
        } else {
          nextAnimation = loopAnimations.length > 0
            ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
            : availableAnimations[0];
        }

        // typing↔idle routes through the authored bridge (hands clear the desk).
        // No early `return` — this is inside useFrame.
        const monkBridged =
          isDeskSwap(monkState.currentAnimation, nextAnimation) &&
          playTypingIdleBridge({
            agentId: 'Monk',
            actions: monkActions,
            state: monkState,
            toKey: nextAnimation,
            onSettled: () => {
              monkState.nextSwitchDelay = Math.random() * 10000 + 10000;
            },
          });

        if (!monkBridged && monkActions[monkState.currentAnimation]) {
          monkActions[monkState.currentAnimation].fadeOut(0.5);
        }

        if (!monkBridged && monkActions[nextAnimation]) {
          const nextAction = monkActions[nextAnimation];
          nextAction.reset();
          nextAction.fadeIn(0.5);

          if (specialAnimations.includes(nextAnimation)) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true;
            monkState.isPlayingSpecial = true;

            const animDuration = nextAction.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations.length > 0
                ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
                : availableAnimations[0];
              if (monkActions[returnAnim]) {
                const returnAction = monkActions[returnAnim];
                returnAction.stop();
                returnAction.reset();
                returnAction.setLoop(THREE.LoopRepeat);
                returnAction.setEffectiveWeight(1);
                returnAction.fadeIn(0.5);
                returnAction.play();
                nextAction.fadeOut(0.5);
                monkState.currentAnimation = returnAnim;
                monkState.isPlayingSpecial = false;
                monkState.nextSwitchDelay = Math.random() * 10000 + 10000;
                monkState.lastSwitchTime = Date.now();
              } else {
                monkState.isPlayingSpecial = false;
              }
            }, Math.max(100, animDuration - 500));
          } else {
            nextAction.setLoop(THREE.LoopRepeat);
          }

          nextAction.play();
        }

        // Skipped while bridging — the bridge parks these and its hand-off
        // restores them when it lands.
        if (!monkBridged) {
          monkState.currentAnimation = nextAnimation;

          if (loopAnimations.includes(nextAnimation)) {
            monkState.nextSwitchDelay = /idle/i.test(nextAnimation)
              ? Math.random() * 3000 + 5000
              : Math.random() * 10000 + 12000;
          } else {
            monkState.nextSwitchDelay = 999999;
          }

          monkState.lastSwitchTime = currentTime;
        }
      }
    }
    
    // Blinking animation for RL80's eyes

    if (leftEyeRef.current && rightEyeRef.current) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const blinkState = blinkStateRef.current;

      // Store original positions if not already stored
      if (!leftEyeRef.current.userData.originalPosition) {
        leftEyeRef.current.userData.originalPosition = leftEyeRef.current.position.clone();
        leftEyeRef.current.userData.originalScale = leftEyeRef.current.scale.clone();
      }
      if (!rightEyeRef.current.userData.originalPosition) {
        rightEyeRef.current.userData.originalPosition = rightEyeRef.current.position.clone();
        rightEyeRef.current.userData.originalScale = rightEyeRef.current.scale.clone();
      }

      // Check if it's time to blink
      if (!blinkState.isBlinking && currentTime - blinkState.lastBlinkTime > blinkState.nextBlinkDelay) {
        blinkState.isBlinking = true;
        blinkState.blinkProgress = 0;
        blinkState.lastBlinkTime = currentTime;
        blinkState.nextBlinkDelay = Math.random() * 3000 + 2000;
      }

      // Animate the blink (close 100ms, hold 80ms, open 120ms)
      if (blinkState.isBlinking) {
        const closeTime = 100;
        const holdTime = 80;
        const openTime = 120;
        const totalDuration = closeTime + holdTime + openTime;
        const timeSinceBlinkStart = currentTime - blinkState.lastBlinkTime;

        if (timeSinceBlinkStart < totalDuration) {
          let progress;

          if (timeSinceBlinkStart < closeTime) {
            // Closing
            progress = timeSinceBlinkStart / closeTime;
          } else if (timeSinceBlinkStart < closeTime + holdTime) {
            // Holding closed
            progress = 1;
          } else {
            // Opening
            progress = 1 - ((timeSinceBlinkStart - closeTime - holdTime) / openTime);
          }

          const eyeScale = 1 - (progress * 0.95);

          leftEyeRef.current.scale.set(
            leftEyeRef.current.userData.originalScale.x,
            leftEyeRef.current.userData.originalScale.y * eyeScale,
            leftEyeRef.current.userData.originalScale.z
          );
          rightEyeRef.current.scale.set(
            rightEyeRef.current.userData.originalScale.x,
            rightEyeRef.current.userData.originalScale.y * eyeScale,
            rightEyeRef.current.userData.originalScale.z
          );

        } else {
          blinkState.isBlinking = false;
          leftEyeRef.current.scale.copy(leftEyeRef.current.userData.originalScale);
          rightEyeRef.current.scale.copy(rightEyeRef.current.userData.originalScale);
        }
      }
    }

    // Blinking animation for Demon's eyes (opacity-based fade across
    // Eyes + Pupil_L + Pupil_R, all faded together each blink). Uses the
    // multi-mesh demonBlinkMeshesRef when populated; falls back to the
    // single-mesh demonEyesRef for the legacy 'demon_eyes' rig.
    const demonBlinkTargets = sitePalVisibility.Demon
      ? []
      : demonBlinkMeshesRef.current.length > 0
      ? demonBlinkMeshesRef.current
      : (demonEyesRef.current ? [demonEyesRef.current] : []);
    if (demonBlinkTargets.length > 0) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const demonBlink = demonBlinkStateRef.current;
      const setBlinkOpacity = (opacity) => {
        for (const m of demonBlinkTargets) {
          if (!m || !m.material) continue;
          if (Array.isArray(m.material)) {
            for (const mat of m.material) if (mat) mat.opacity = opacity;
          } else {
            m.material.opacity = opacity;
          }
        }
      };

      // Normal blinking (no special-anim coupling — laughing/fistPump
      // don't close the eyes on this rig).
      if (!demonBlink.isBlinking && currentTime - demonBlink.lastBlinkTime > demonBlink.nextBlinkDelay) {
        demonBlink.isBlinking = true;
        demonBlink.lastBlinkTime = currentTime;
        demonBlink.nextBlinkDelay = Math.random() * 4000 + 3000;
      }

      // Animate the blink (fade out 100ms, hold 120ms, fade in 140ms)
      if (demonBlink.isBlinking) {
        const closeTime = 100;
        const holdTime = 120;
        const openTime = 140;
        const totalDuration = closeTime + holdTime + openTime;
        const timeSinceBlinkStart = currentTime - demonBlink.lastBlinkTime;

        if (timeSinceBlinkStart < totalDuration) {
          let opacity;

          if (timeSinceBlinkStart < closeTime) {
            opacity = 1 - (timeSinceBlinkStart / closeTime);
          } else if (timeSinceBlinkStart < closeTime + holdTime) {
            opacity = 0;
          } else {
            opacity = (timeSinceBlinkStart - closeTime - holdTime) / openTime;
          }

          setBlinkOpacity(opacity);
        } else {
          demonBlink.isBlinking = false;
          setBlinkOpacity(1);
        }
      }
    }

    // Detective eye blink (mesh-swap: Eyes ↔ Closedeyes). No-op when the
    // rig has no matching meshes — refs stay null in that case.
    if (detectiveEyesRef.current && !sitePalVisibility.Detective) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const blink = detectiveBlinkStateRef.current;
      const closed = detectiveClosedEyesRef.current;

      if (!blink.isBlinking && currentTime - blink.lastBlinkTime > blink.nextBlinkDelay) {
        blink.isBlinking = true;
        blink.lastBlinkTime = currentTime;
        blink.nextBlinkDelay = Math.random() * 4000 + 3000;
        detectiveEyesRef.current.visible = false;
        if (closed) closed.visible = true;
      } else if (blink.isBlinking) {
        const blinkDuration = 150;
        if (currentTime - blink.lastBlinkTime > blinkDuration) {
          blink.isBlinking = false;
          detectiveEyesRef.current.visible = true;
          if (closed) closed.visible = false;
        }
      }
    }

    // Unicorn eye blink (opacity-based, synchronized across L_EYE + R_EYE)
    if (unicornEyesRef.current.length > 0) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const blink = unicornBlinkStateRef.current;

      if (!blink.isBlinking && currentTime - blink.lastBlinkTime > blink.nextBlinkDelay) {
        blink.isBlinking = true;
        blink.lastBlinkTime = currentTime;
        blink.nextBlinkDelay = Math.random() * 4000 + 3000;
      }

      if (blink.isBlinking) {
        const closeTime = 100;
        const holdTime = 120;
        const openTime = 140;
        const totalDuration = closeTime + holdTime + openTime;
        const t = currentTime - blink.lastBlinkTime;

        let opacity;
        if (t < totalDuration) {
          if (t < closeTime) {
            opacity = 1 - (t / closeTime);
          } else if (t < closeTime + holdTime) {
            opacity = 0;
          } else {
            opacity = (t - closeTime - holdTime) / openTime;
          }
        } else {
          blink.isBlinking = false;
          opacity = 1;
        }

        for (const eye of unicornEyesRef.current) {
          if (eye.material) eye.material.opacity = opacity;
        }
      }
    }

    // (Demon head/spine overrides removed — demon_pointing is now authored
    // to address the camera directly, so per-frame bone overrides aren't
    // needed for the focus sequence.)

    // Monk head look-at-camera override — active when focused on the Monk
    // OR while the attention-getter cycle is running, so the monk appears
    // to address the user across hail → idle → hail → beckon transitions.
    // The attention loop bypasses `shouldTrackHeadRef` (which goes false
    // once gameStarted flips true) — without that bypass, GR80 would hail
    // and beckon while staring straight ahead instead of at the player.
    const monkIsPointing = monkWaveStateRef.current.attentionActive;
    // Outcome-reveal camera-follow: during 'aligned'/'missed' the lineup faces
    // the player, so heads track the camera for the "they're looking at YOU"
    // beat. NOT 'abstained' or 'council'. Drives the demon + detective gates
    // below (which otherwise turn off during any reveal); the monk has its own
    // gate that already tracks these (and abstained). The unicorn is
    // intentionally excluded — its head-track reads twitchy on the wide shot.
    const revealFollowCam =
      revealModeRef.current === 'aligned' || revealModeRef.current === 'missed';
    /* THE DESK WATCHES THE PITCH — the second half of resolveAttentionTarget.
     *
     * Retargeting the four head-aims was necessary and not sufficient: every one
     * of those blocks is gated on that character being FOCUSED, and during a pitch
     * nobody is (the pitcher is). So the retarget never ran and four heads stayed
     * pointed at their monitors.
     *
     * This is deliberately the SAME SHAPE as revealFollowCam above, which exists
     * for the same reason — the curtain call also needs everyone looking somewhere
     * without anyone being focused. Added as an extra OR term to each gate rather
     * than by loosening the focus checks, so the lobby's behaviour is untouched.
     *
     * Gated on the bot being VISIBLE, not merely on the pitch running: pressMode
     * goes true at the briefing, before the beam has cast anything, and four
     * analysts solemnly regarding an empty projector plate is worse than four
     * analysts working.
     *
     * AND ON HIM ACTUALLY TALKING. Attention that persists through every silence
     * is a room full of mannequins staring at a hologram; attention that arrives
     * when he speaks and lapses when he stops is a room full of people. Same
     * signal that drives his talking clip, so the heads turn on exactly the beat
     * the mouth starts. The debug override forces it on regardless, because
     * inspecting the pose is easier without having to catch a line. */
    const _attnOverride = attentionOverrideRef.current;
    const _attnOpen = !!pitchBotRef.current?.visible
      && (_attnOverride === true || (_attnOverride === null && pitchStartedRef.current));
    const _sinceSpeech = performance.now() - speechEndedAtRef.current;
    /* Per-seat, because each holds attention for its own beat — see
     * ATTENTION_RELEASE_MS. Forced on by the debug override regardless.
     *
     * THIS DOES NOT EXCLUDE THE FOCUSED SEAT, and that was a bug worth recording.
     * The first version turned the gate OFF for whoever the player had selected,
     * on the reasoning that they should be addressing the player rather than the
     * pitcher. But these blocks are the only thing writing the head quaternion —
     * switch one off and the head does not return to rest, it FREEZES on whatever
     * it was last aimed at. A selected analyst stayed locked on the bot for the
     * whole of her own answer.
     *
     * The selection is handled where it belongs instead: the block keeps running
     * and resolveAttentionTarget hands back the CAMERA for a focused seat, so she
     * turns to the player and tracks them properly. Gate decides WHETHER the head
     * is driven; the resolver decides WHERE. */
    const attentionFor = (key) => _attnOpen && (
      _attnOverride === true
      || speechActiveRef.current
      || _sinceSpeech < (ATTENTION_RELEASE_MS[key] || 0)
    );
    // Track the camera during the outcome reveals (he addresses the player),
    // but NOT during 'council' — there the argue animation should drive his
    // head so he faces the group in the semi-circle, not the camera. The other
    // three characters already gate on !revealModeRef.current, so they don't
    // track during council either.
    const monkHeadGate =
      monkIsPointing
      || attentionFor('Monk')
      || (revealModeRef.current && revealModeRef.current !== 'council')
      || (monkFocusedRef.current && shouldTrackHeadRef.current);
    if (monkHeadGate && monkHeadBoneRef.current) {
      const head = monkHeadBoneRef.current;

      if (!monkHeadBoneRef._baseQuat) {
        monkHeadBoneRef._baseQuat = head.quaternion.clone();
        head.updateWorldMatrix(true, false);
        monkHeadBoneRef._baseWorldQuat = new THREE.Quaternion();
        head.getWorldQuaternion(monkHeadBoneRef._baseWorldQuat);
      }

      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      if (!monkHeadBoneRef._dummy) {
        monkHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = monkHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(resolveAttentionTarget(camera, monkFocusedRef.current));
      // Correction rotation — tuned for Monk skeleton orientation
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 0.5);
      dummy.quaternion.multiply(flip);

      // ~110° max turn so the monk can track the camera further around to
      // the right (was 1.2 rad ≈ 69°).
      const maxHeadAngle = 1.42;
      const angleBetween = monkHeadBoneRef._baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.9) : 0;
      const blendedWorldQuat = monkHeadBoneRef._baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      if (!monkHeadBoneRef._smoothedQuat) {
        monkHeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      monkHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.08);

      head.quaternion.copy(monkHeadBoneRef._smoothedQuat);
    } else if (monkHeadBoneRef._smoothedQuat && monkHeadBoneRef.current) {
      // Symmetric release — slerp the smoothedQuat toward whatever the
      // animation wants right now at the same 0.08-per-frame rate the
      // engagement used, so the head rotates back as naturally as it
      // engaged instead of snapping. head.quaternion at this point is the
      // animation's intended pose since the mixer has already run.
      const head = monkHeadBoneRef.current;
      const animQuat = head.quaternion.clone();
      monkHeadBoneRef._smoothedQuat.slerp(animQuat, 0.08);
      head.quaternion.copy(monkHeadBoneRef._smoothedQuat);
      // Once close enough to the anim pose, stop overriding.
      if (monkHeadBoneRef._smoothedQuat.angleTo(animQuat) < 0.01) {
        monkHeadBoneRef._smoothedQuat = null;
        monkHeadBoneRef._dummy = null;
      }
    }

    // RL80 head look-at-camera override (only when focused on RL80)
    if (rl80HeadBoneRef.current && (attentionFor('RL80') || (rl80FocusedRef.current && shouldTrackHeadRef.current && !revealModeRef.current))) {
      const head = rl80HeadBoneRef.current;

      // Snapshot the head's CURRENT animation pose — what the mixer just
      // wrote this frame. The look-at override below caps deviation from
      // THIS pose, not from a load-time bind, so the head follows the
      // body's animation (neck/spine rotation) with only a small
      // camera-tracking nudge layered on top.
      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);
      const animWorldQuat = new THREE.Quaternion();
      head.getWorldQuaternion(animWorldQuat);

      if (!rl80HeadBoneRef._dummy) {
        rl80HeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = rl80HeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(resolveAttentionTarget(camera, rl80FocusedRef.current));

      // Rig forward-axis correction — unicorn's snout is along the head
      // bone's local +Z, not the Three.js default -Z, so flip 180° around
      // Y to point +Z at the camera.
      const RL80_FORWARD_FIX = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        Math.PI,
      );
      dummy.quaternion.multiply(RL80_FORWARD_FIX);

      // Symmetric yaw/pitch clamp relative to the CURRENT pose. Decompose
      // (lookAt − currentPose) in current-pose's frame, clamp each axis
      // around zero, recompose, apply.
      const maxYaw   = 0.95; // ~54° left/right
      const maxPitch = 0.6;  // ~34° up/down
      const maxRoll  = 0.0;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

      const animFrameOffset = animWorldQuat
        .clone()
        .invert()
        .multiply(dummy.quaternion);
      const e = new THREE.Euler().setFromQuaternion(animFrameOffset, 'YXZ');
      // Rest-frame Y was inverted relative to visual left/right (diagnosed
      // earlier with the Math.PI flip), so negate yaw before clamping.
      e.y = clamp(-e.y, -maxYaw,   maxYaw);
      e.x = clamp(e.x,  -maxPitch, maxPitch);
      e.z = clamp(e.z,  -maxRoll,  maxRoll);
      const clampedOffset = new THREE.Quaternion().setFromEuler(e);
      const targetWorldQuat = animWorldQuat.clone().multiply(clampedOffset);

      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetLocal = parentWorldQuat.clone().invert().multiply(targetWorldQuat);

      // Smoothing: slerp from current local toward the clamped target so
      // the camera-tracking nudge eases in across frames instead of
      // snapping. Smoothed state is reset on gate close (below).
      if (!rl80HeadBoneRef._smoothedQuat) {
        rl80HeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      rl80HeadBoneRef._smoothedQuat.slerp(targetLocal, 0.15);
      head.quaternion.copy(rl80HeadBoneRef._smoothedQuat);
    } else if (rl80HeadBoneRef._smoothedQuat && rl80HeadBoneRef.current) {
      // Ease the nudge back out rather than dropping it in one frame — the
      // gate now closes while the camera is still on him (end of his lobby
      // greeting), where a snap would read as a flinch.
      const head = rl80HeadBoneRef.current;
      const animQuat = head.quaternion.clone();
      rl80HeadBoneRef._smoothedQuat.slerp(animQuat, 0.15);
      head.quaternion.copy(rl80HeadBoneRef._smoothedQuat);
      if (rl80HeadBoneRef._smoothedQuat.angleTo(animQuat) < 0.01) {
        rl80HeadBoneRef._smoothedQuat = null;
        rl80HeadBoneRef._dummy = null;
      }
    }

    // RL80 jaw lip-sync (Path A) — open the Jaw bone proportionally to speech
    // amplitude (unicornMouth.value, written by playUnicornBeat's RMS analyser).
    // Applied after mixer.update so it layers on the body animation, like the
    // head override above. Each frame we reset to the captured closed pose then
    // rotate open, so it never accumulates even though no clip animates the jaw.
    // Axis/sign/gain are rig-specific — tune live in the console via
    //   window.__rl80Jaw = { axis:'x'|'y'|'z', sign:1|-1, maxAngle:<radians> }
    // until the mouth opens naturally downward, then bake the values below.
    if (rl80JawBoneRef.current && rl80JawBoneRef._baseQuat) {
      const jaw = rl80JawBoneRef.current;
      const cfg = (typeof window !== 'undefined' && window.__rl80Jaw) || null;
      const axis = (cfg && cfg.axis) || 'x';
      const sign = (cfg && cfg.sign) || 1;
      const maxAngle = cfg && typeof cfg.maxAngle === 'number' ? cfg.maxAngle : 0.5;
      // Smooth the raw amplitude so the jaw eases rather than buzzing per-sample.
      const prev = rl80JawBoneRef._open || 0;
      rl80JawBoneRef._open = prev + (unicornMouth.value - prev) * 0.4;
      const a = sign * maxAngle * rl80JawBoneRef._open;
      if (!rl80JawBoneRef._axisVec) rl80JawBoneRef._axisVec = new THREE.Vector3();
      if (!rl80JawBoneRef._openQuat) rl80JawBoneRef._openQuat = new THREE.Quaternion();
      rl80JawBoneRef._axisVec.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
      rl80JawBoneRef._openQuat.setFromAxisAngle(rl80JawBoneRef._axisVec, a);
      jaw.quaternion.copy(rl80JawBoneRef._baseQuat).multiply(rl80JawBoneRef._openQuat);
      if (!rl80JawBoneRef._loggedHint) {
        rl80JawBoneRef._loggedHint = true;
        console.log('[CyborgTempleScene] RL80 jaw lip-sync active on bone', jaw.name,
          '— if the mouth opens wrong, tune window.__rl80Jaw = { axis:"x", sign:1, maxAngle:0.5 }');
      }
    }

    // RL80 code-made mouth overlay (Path A2) — a flat quad anchored at his snout
    // (head-bone-local offset, so it tracks his head) whose +Z normal is aimed at
    // the muzzle by `rot` [pitchX, yawY, rollZ] degrees. The quad is a FIXED size;
    // its texture is a canvas we redraw from the smoothed speech amplitude — a
    // dark maw + blocky upper teeth (see drawUnicornMouth). Live-tunable via
    //   window.__rl80Mouth = { offset:[x,y,z], rot:[x,y,z], width, maxH,
    //                          color:0xrrggbb (maw), teeth, toothColor:0xrrggbb,
    //                          gain, hideWhenQuiet:true }
    // offset is HEAD-LOCAL (+Z toward the muzzle tip); `roll` aliases rot[2].
    if (rl80MouthMeshRef.current && rl80HeadBoneRef.current) {
      const mouth = rl80MouthMeshRef.current;
      const head = rl80HeadBoneRef.current;
      const cfg = (typeof window !== 'undefined' && window.__rl80Mouth) || null;
      // Fallbacks all read RL80_MOUTH_DEFAULTS — single source of truth. In
      // practice cfg is always set (the tuner init seeds window.__rl80Mouth).
      const MD = RL80_MOUTH_DEFAULTS;
      const offset = (cfg && cfg.offset) || MD.offset;
      const rot    = (cfg && Array.isArray(cfg.rot)) ? cfg.rot
                   : [0, 0, (cfg && typeof cfg.roll === 'number') ? cfg.roll : MD.rot[2]];
      const width  = cfg && typeof cfg.width === 'number' ? cfg.width : MD.width;
      const maxH   = cfg && typeof cfg.maxH  === 'number' ? cfg.maxH  : MD.maxH;
      const gain   = cfg && typeof cfg.gain  === 'number' ? cfg.gain  : MD.gain;
      const interior   = cfg && typeof cfg.color === 'number' ? cfg.color : MD.color;
      const teeth      = cfg && typeof cfg.teeth === 'number' ? cfg.teeth : MD.teeth;
      const toothColor = cfg && typeof cfg.toothColor === 'number' ? cfg.toothColor : MD.toothColor;

      head.updateWorldMatrix(true, false);
      if (!mouth._hp) {
        mouth._hp = new THREE.Vector3(); mouth._hq = new THREE.Quaternion();
        mouth._off = new THREE.Vector3(); mouth._rotQ = new THREE.Quaternion();
        mouth._rotE = new THREE.Euler();
      }
      head.getWorldPosition(mouth._hp);
      head.getWorldQuaternion(mouth._hq);
      mouth._off.set(offset[0], offset[1], offset[2]).applyQuaternion(mouth._hq);
      mouth.position.copy(mouth._hp).add(mouth._off);
      // Orient: head frame, then the tunable local Euler to aim the quad.
      const D = Math.PI / 180;
      mouth._rotE.set(rot[0] * D, rot[1] * D, rot[2] * D, 'XYZ');
      mouth._rotQ.setFromEuler(mouth._rotE);
      mouth.quaternion.copy(mouth._hq).multiply(mouth._rotQ);
      mouth.scale.set(width, maxH, 1); // fixed footprint — openness is drawn on the canvas

      // Smooth the amplitude so the mouth eases rather than buzzing per-sample.
      const target = Math.min(1, unicornMouth.value * gain);
      mouth._open = (mouth._open || 0) + (target - (mouth._open || 0)) * 0.4;
      mouth.visible = cfg && cfg.hideWhenQuiet ? mouth._open > 0.02 : true;

      // Redraw the maw+teeth only when openness (or a tuned color/teeth count)
      // changes, so we don't upload a texture every frame while idle.
      const drawKey = Math.round(mouth._open * 200) / 200;
      if (mouth._ctx && (drawKey !== mouth._lastDraw || interior !== mouth._lastInterior ||
          toothColor !== mouth._lastTooth || teeth !== mouth._lastTeeth)) {
        drawUnicornMouth(mouth._ctx, mouth._canvas.width, mouth._canvas.height,
          mouth._open, _rl80hex(interior), _rl80hex(toothColor), teeth);
        mouth._tex.needsUpdate = true;
        mouth._lastDraw = drawKey;
        mouth._lastInterior = interior;
        mouth._lastTooth = toothColor;
        mouth._lastTeeth = teeth;
      }

      if (!mouth._loggedHint) {
        mouth._loggedHint = true;
        console.log('[CyborgTempleScene] RL80 mouth overlay active — Shift+M then arrows/[ ] move, ' +
          'q/a w/s e/d rotate; defaults:', JSON.stringify(RL80_MOUTH_DEFAULTS));
      }
    }

    // Detective head look-at-camera override — mirrors the RL80 setup.
    // The flip-axis correction below is rig-specific; tune the divisor in
    // `Math.PI / N` (or change the axis) until the head reads as facing
    // the camera.
    //
    // Rest-pose cache key. The curtain call overwrites Detective_Empty's
    // rotation (STAGE_LINEUP / COUNCIL_LINEUP), and her authored desk yaw is
    // -87° while the lineup forces 0° — so her body swings ~87° the moment a
    // reveal starts. The gate below does NOT close across that transition
    // (revealFollowCam picks up exactly where the focus clause drops out), so
    // without this the cached rest + face axis stay measured in her desk
    // orientation. The aim still lands (face and base are derived from each
    // other and cancel), but the max-neck-angle clamp is measured from that
    // stale rest, sliding her whole reachable window ~87° to one side: during
    // the reveal she could turn right to nearly 180° and not left at all.
    // Re-key on the frame of reference so the pose is re-measured once the
    // lineup transform has landed.
    const detHeadCtx = revealModeRef.current || 'desk';
    if (detectiveHeadBoneRef._baseCtx !== detHeadCtx) {
      detectiveHeadBoneRef._baseCtx = detHeadCtx;
      detectiveHeadBoneRef._baseQuat = null;
      detectiveHeadBoneRef._baseWorldQuat = null;
      detectiveHeadBoneRef._dummy = null;
      // Drop the in-flight smoothing too — it's in the old body frame. The
      // next tracking frame re-seeds it from the live animation pose, so the
      // turn eases in from wherever the reaction clip has her.
      detectiveHeadBoneRef._smoothedQuat = null;
    }
    if (detectiveHeadBoneRef.current && (attentionFor('Detective') || revealFollowCam || (detectiveFocusedRef.current && shouldTrackHeadRef.current && !revealModeRef.current))) {
      const head = detectiveHeadBoneRef.current;

      if (!detectiveHeadBoneRef._baseQuat) {
        detectiveHeadBoneRef._baseQuat = head.quaternion.clone();
        head.updateWorldMatrix(true, false);
        detectiveHeadBoneRef._baseWorldQuat = new THREE.Quaternion();
        head.getWorldQuaternion(detectiveHeadBoneRef._baseWorldQuat);
      }

      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      // Identical formulation to the Demon's block below — she used to be the
      // one character with a bespoke aim (a cached world-space "face axis",
      // world yaw/pitch built by hand, clamped as scalars). That version kept
      // producing a lopsided range in the curtain call no matter how the clamp
      // was expressed, while the Demon — same scene, same camera, same gate —
      // was always fine. So she now runs his math rather than her own.
      //
      // Aim a dummy at the camera, express that as a delta FROM the rest pose
      // in the bone's OWN frame, decompose to yaw(Y)/pitch(X)/roll(Z), clamp
      // yaw and pitch, and hard-zero roll so no ear-to-shoulder tilt leaks in.
      if (!detectiveHeadBoneRef._dummy) {
        detectiveHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = detectiveHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(resolveAttentionTarget(camera, detectiveFocusedRef.current));

      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const desiredLocal = parentWorldQuat.clone().invert().multiply(dummy.quaternion);

      const baseLocal = detectiveHeadBoneRef._baseQuat;
      const delta = baseLocal.clone().invert().multiply(desiredLocal);

      const euler = new THREE.Euler().setFromQuaternion(delta, 'YXZ');
      // Her limits, not the Demon's: 90° each way as asked, same pitch cap.
      const MAX_YAW = (typeof window !== 'undefined' && Number.isFinite(window.__detClamp))
        ? window.__detClamp : 1.57;
      const MAX_PITCH = (typeof window !== 'undefined' && Number.isFinite(window.__detPitchClamp))
        ? window.__detPitchClamp : 0.5;
      euler.y = THREE.MathUtils.clamp(euler.y, -MAX_YAW, MAX_YAW);
      euler.x = THREE.MathUtils.clamp(euler.x, -MAX_PITCH, MAX_PITCH);
      euler.z = 0;
      const clampedDelta = new THREE.Quaternion().setFromEuler(euler);

      const targetQuat = baseLocal.clone().multiply(clampedDelta);

      if (!detectiveHeadBoneRef._smoothedQuat) {
        detectiveHeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      // Blend rate toward the aim. 0 freezes her head at the pose it held the
      // frame tracking engaged (she speaks without ever turning) — keep this
      // non-zero. Tunable at runtime via window.__detTrackLerp.
      const detTrackLerp = (typeof window !== 'undefined' && Number.isFinite(window.__detTrackLerp))
        ? window.__detTrackLerp : 0.08;
      detectiveHeadBoneRef._smoothedQuat.slerp(targetQuat, detTrackLerp);

      head.quaternion.copy(detectiveHeadBoneRef._smoothedQuat);
    } else if (detectiveHeadBoneRef._smoothedQuat && detectiveHeadBoneRef.current) {
      // Symmetric release (same as the demon's) — ease back toward whatever
      // the animation wants now, then drop the override. Matters now that the
      // gate closes mid-shot when her lobby intro ends: clearing the override
      // outright snapped her head back to the typing pose in one frame.
      const head = detectiveHeadBoneRef.current;
      const animQuat = head.quaternion.clone();
      detectiveHeadBoneRef._smoothedQuat.slerp(animQuat, 0.08);
      head.quaternion.copy(detectiveHeadBoneRef._smoothedQuat);
      if (detectiveHeadBoneRef._smoothedQuat.angleTo(animQuat) < 0.01) {
        detectiveHeadBoneRef._smoothedQuat = null;
        detectiveHeadBoneRef._dummy = null;
        // Re-capture the rest pose fresh on the next engagement.
        detectiveHeadBoneRef._baseQuat = null;
        detectiveHeadBoneRef._baseWorldQuat = null;
      }
    }

    // Virgil (cat) head look-at-camera override.
    //
    // This block used to assume "animation is paused, so we can just replace
    // the head pose" — true when the cat only ever appeared paused-on-focus,
    // FALSE during the curtain call where he runs a sit/groom cycle. The aim
    // is now blended over the clip's own head track by a ramped weight:
    // 1 on neutral clips (pure look-at, the old behaviour), 0 while a grooming
    // clip owns the head. See CAT_HEAD_OWNED_RE.
    const catClipNow = virgilAnimStateRef.current?.currentAnimation || '';
    const catHeadFree = !CAT_HEAD_OWNED_RE.test(catClipNow);
    // Base pose for the aim is only ever sampled from a neutral clip — sampling
    // it mid-groom would anchor the look-at to a head-down pose. Until one has
    // been captured, skip the override entirely and let the clip drive.
    const catBaseReady = !!virgilHeadBoneRef._baseQuat || catHeadFree;
    if (virgilHeadBoneRef.current && catBaseReady &&
        // NOT gated on shouldTrackHeadRef: that resolves to `speechActive` once
        // the game has started, and the cat doesn't speak — he'd never make eye
        // contact. He's a guide the player clicks to look at, so he tracks for
        // the whole close-up.
        (revealModeRef.current || virgilFocusedRef.current)) {
      const head = virgilHeadBoneRef.current;

      // mixer.update ran earlier this frame, so this IS the clip's authored
      // head pose for this frame — keep it to blend against at the end.
      const animQuat = head.quaternion.clone();

      if (!virgilHeadBoneRef._baseQuat) {
        virgilHeadBoneRef._baseQuat = animQuat.clone(); // guarded by catBaseReady
      }

      if (virgilHeadBoneRef._followW === undefined) {
        virgilHeadBoneRef._followW = catHeadFree ? 1 : 0;
      }
      virgilHeadBoneRef._followW +=
        ((catHeadFree ? 1 : 0) - virgilHeadBoneRef._followW) * CAT_HEAD_FOLLOW_RAMP;

      // Restore base quat before computing world matrices to avoid feedback loop
      head.quaternion.copy(virgilHeadBoneRef._baseQuat);
      head.updateWorldMatrix(true, false);

      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);
      const baseWorldQuat = new THREE.Quaternion();
      head.getWorldQuaternion(baseWorldQuat);

      // Compute desired world quaternion facing camera
      if (!virgilHeadBoneRef._dummy) {
        virgilHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = virgilHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(camera.position);
      // Cat face forward correction — X-axis rotation to tilt from "up" to "forward"
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2.5);
      dummy.quaternion.multiply(flip);

      // Clamp rotation range
      const maxHeadAngle = 2.0;
      const angleBetween = baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.95) : 0;
      const blendedWorldQuat = baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      // Convert to bone-local space
      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      // Smooth transition
      if (!virgilHeadBoneRef._smoothedQuat) {
        virgilHeadBoneRef._smoothedQuat = targetQuat.clone();
      }
      virgilHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.1);

      // Blend the aim OVER the clip rather than replacing it.
      head.quaternion.copy(animQuat).slerp(
        virgilHeadBoneRef._smoothedQuat,
        virgilHeadBoneRef._followW,
      );
    } else if (virgilHeadBoneRef._smoothedQuat) {
      virgilHeadBoneRef._smoothedQuat = null;
      virgilHeadBoneRef._dummy = null;
      virgilHeadBoneRef._followW = undefined;
    }

    // Demon head look-at-camera override — fires when EITHER the camera
    // has drifted off the authored pose (demonHeadTrackingRef, set in the
    // focus sequence) OR the speech-glance scheduler is currently in a
    // glance window (demonGlanceActiveRef). Mirrors the Monk/RL80 pattern.
    // Same stale-rest problem as the detective above, mirrored: Demon_Empty's
    // authored desk yaw is +90° and the lineup forces 0°, so his clamped
    // yaw window slides ~90° the other way during a reveal (he can turn left
    // but not right). Monk (-4.8°) and the unicorn (173° vs the lineup's 180°)
    // are within a few degrees of their lineup facing, so they don't show it.
    const demonHeadCtx = revealModeRef.current || 'desk';
    if (demonHeadBoneRef._baseCtx !== demonHeadCtx) {
      demonHeadBoneRef._baseCtx = demonHeadCtx;
      demonHeadBoneRef._baseQuat = null;
      demonHeadBoneRef._baseWorldQuat = null;
      demonHeadBoneRef._smoothedQuat = null;
    }
    if (demonHeadBoneRef.current && (attentionFor('Demon') || revealFollowCam || ((demonHeadTrackingRef.current || demonGlanceActiveRef.current) && shouldTrackHeadRef.current && !revealModeRef.current))) {
      const head = demonHeadBoneRef.current;

      if (!demonHeadBoneRef._baseQuat) {
        demonHeadBoneRef._baseQuat = head.quaternion.clone();
        head.updateWorldMatrix(true, false);
        demonHeadBoneRef._baseWorldQuat = new THREE.Quaternion();
        head.getWorldQuaternion(demonHeadBoneRef._baseWorldQuat);
      }

      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      if (!demonHeadBoneRef._dummy) {
        demonHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = demonHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      // Aim a dummy at the camera (bone forward is local -Z, so a plain
      // lookAt orients toward the camera with no correction flip).
      /* demonFocusedRef, NOT demonHeadTrackingRef. The other three have a single
       * focus flag; the Demon has two, and the one named like head tracking is the
       * wrong one — it is a narrower override that only turns on ~2s into his focus
       * sequence (or early, if the camera drifted off the authored pose). Passing it
       * here meant that while he was actually speaking it was still false, so the
       * resolver kept handing back the pitcher and he answered a claim without ever
       * looking away from it — then broke to the player once the sequence finally
       * flipped the flag, a beat after he had finished.
       *
       * It stays in the GATE above, which is what it is for: whether his head is
       * driven at all. This argument answers a different question — where. */
      dummy.lookAt(resolveAttentionTarget(camera, demonFocusedRef.current));

      // The earlier approach — slerp the head's world quaternion toward this
      // look-at and cap the total angle — couldn't separate roll from
      // yaw/pitch, so a roll component leaked in and cocked the head ("ear
      // on shoulder"). Instead, express the look-at as a delta FROM the rest
      // pose in the bone's own frame, decompose it into yaw(Y)/pitch(X)/
      // roll(Z), clamp yaw and pitch to anatomical limits, and force roll to
      // zero. Recompose and that's the target — no roll can ever leak in.
      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const desiredLocal = parentWorldQuat.clone().invert().multiply(dummy.quaternion);

      const baseLocal = demonHeadBoneRef._baseQuat;
      const delta = baseLocal.clone().invert().multiply(desiredLocal);

      const euler = new THREE.Euler().setFromQuaternion(delta, 'YXZ');
      const MAX_YAW = 1.15;   // ~66° left/right
      const MAX_PITCH = 0.5;  // ~29° up/down
      euler.y = THREE.MathUtils.clamp(euler.y, -MAX_YAW, MAX_YAW);
      euler.x = THREE.MathUtils.clamp(euler.x, -MAX_PITCH, MAX_PITCH);
      euler.z = 0; // hard-zero roll — kills the ear-to-shoulder tilt
      const clampedDelta = new THREE.Quaternion().setFromEuler(euler);

      const targetQuat = baseLocal.clone().multiply(clampedDelta);

      if (!demonHeadBoneRef._smoothedQuat) {
        demonHeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      demonHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.08);
      // Blend the camera aim OVER the animation rather than replacing it.
      // head.quaternion is still the clip's authored value at this point
      // (mixer.update ran earlier in this useFrame), so a weight below 1 lets
      // the clip's own head motion survive the follow — see REVEAL_HEAD_FOLLOW.
      const headFollowW = REVEAL_HEAD_FOLLOW[revealModeRef.current] ?? 1;
      if (headFollowW >= 1) {
        head.quaternion.copy(demonHeadBoneRef._smoothedQuat);
      } else {
        head.quaternion.slerp(demonHeadBoneRef._smoothedQuat, headFollowW);
      }
    } else if (demonHeadBoneRef._smoothedQuat && demonHeadBoneRef.current) {
      // Symmetric release — slerp back toward whatever the animation
      // wants now, then drop the override once close enough.
      const head = demonHeadBoneRef.current;
      const animQuat = head.quaternion.clone();
      demonHeadBoneRef._smoothedQuat.slerp(animQuat, 0.08);
      head.quaternion.copy(demonHeadBoneRef._smoothedQuat);
      if (demonHeadBoneRef._smoothedQuat.angleTo(animQuat) < 0.01) {
        demonHeadBoneRef._smoothedQuat = null;
        demonHeadBoneRef._dummy = null;
      }
    }

    // Camera focus animation. camera-controls handles the position+target
    // transition as a single critically-damped motion, so we just dispatch
    // setLookAt once per focus change and let the library drive the rest.
    if (focusTarget) {
      // FOV is independent of camera-controls — keep the manual lerp.
      if (typeof focusTarget.fov === 'number' && Math.abs(camera.fov - focusTarget.fov) > 0.05) {
        camera.fov += (focusTarget.fov - camera.fov) * 0.08;
        camera.updateProjectionMatrix();
      }

      const controls = state.controls;
      if (controls && controls.setLookAt && !focusTarget._dispatched) {
        focusTarget._dispatched = true;

        // Derive the orbit center NOW (not on arrival) so the fly-in aims
        // directly at the final pivot in one continuous motion. The old
        // flow flew to `lookAt`, then shifted target to `orbitCenter` after
        // arrival — two distinct camera motions. Aiming straight at the
        // orbit center collapses them into one.
        if (
          !focusTarget.orbitCenter &&
          focusTarget.agentId !== 'XCandle' &&
          focusTarget.agentName !== 'Reset'
        ) {
          const headBoneByAgent = {
            RL80: rl80HeadBoneRef,
            Demon: demonHeadBoneRef,
            Monk: monkHeadBoneRef,
            Virgil: virgilHeadBoneRef,
            Detective: detectiveHeadBoneRef,
          };
          const boneRef = headBoneByAgent[focusTarget.agentId];
          if (boneRef && boneRef.current) {
            const pivot = new THREE.Vector3();
            boneRef.current.getWorldPosition(pivot);
            // Drop pivot toward chest height so the orbit feels balanced
            // around the body rather than spinning around the head.
            pivot.y -= 0.25;
            focusTarget.orbitCenter = pivot;
          }
        }

        // Aim at the orbit center when we have one (single continuous
        // motion); otherwise fall back to the authored lookAt point.
        const finalLookAt = focusTarget.orbitCenter || focusTarget.lookAt;

        const promise = controls.setLookAt(
          focusTarget.position.x, focusTarget.position.y, focusTarget.position.z,
          finalLookAt.x, finalLookAt.y, finalLookAt.z,
          true,
        );

        // setLookAt's promise rejects if a newer transition supersedes this
        // one (e.g. the user clicks another character mid-fly-in) — swallow it.
        // (Eugene's greeting wave used to fire here on arrival; it's now driven
        // by the page in sync with his spoken "hello" line — see unicornWave.)
        if (promise && typeof promise.then === 'function') promise.catch(() => {});
      }
    }
    
    // Y-axis billboard: rotate Angel_Empty so its forward axis always points
    // at the camera horizontally (keeps the angel upright; coins/children
    // ride along since they're descendants of Angel_Empty).
    if (angelEmptyRef.current) {
      const angelEmpty = angelEmptyRef.current;
      const angelWorldPos = new THREE.Vector3();
      angelEmpty.getWorldPosition(angelWorldPos);

      // Project camera onto the angel's horizontal plane so only the Y axis rotates.
      const targetWorld = new THREE.Vector3(camera.position.x, angelWorldPos.y, camera.position.z);

      // Compute the desired world quaternion via a dummy lookAt, then convert
      // to local space so it composes correctly with parent transforms.
      if (!angelEmpty.userData._billboardDummy) {
        angelEmpty.userData._billboardDummy = new THREE.Object3D();
      }
      const dummy = angelEmpty.userData._billboardDummy;
      dummy.position.copy(angelWorldPos);
      dummy.lookAt(targetWorld);
      // Correction: model's forward axis isn't -Z. Rotate around world up so
      // the front of the angel faces the camera. Flip the sign if it ends up
      // showing the back instead.
      const billboardYOffset = Math.PI / 2;
      dummy.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), billboardYOffset)
      );

      const parentWorldQuat = new THREE.Quaternion();
      if (angelEmpty.parent) {
        angelEmpty.parent.getWorldQuaternion(parentWorldQuat);
        angelEmpty.quaternion.copy(parentWorldQuat.invert().multiply(dummy.quaternion));
      } else {
        angelEmpty.quaternion.copy(dummy.quaternion);
      }
    }

    // Y-axis billboard for the neon sign at scene center. Same approach as the
    // angel above: aim a dummy at the camera projected onto the sign's
    // horizontal plane (so it stays upright and never pitches), then convert
    // the result into the sign's local space.
    //
    // Axis correction: the sign's geometry sits inside its root rotated +90°
    // about X (the FBX import conversion), i.e. geomInNode = restQuat⁻¹. A
    // dummy lookAt puts +Z on the camera and the sign's face is its geometry
    // +Z, so the root needs worldQuat = dummyQuat * restQuat.
    if (neonSignRef.current) {
      const sign = neonSignRef.current;
      const signWorldPos = new THREE.Vector3();
      sign.getWorldPosition(signWorldPos);

      // Horizontal-only target keeps the sign vertical as the camera rises/dips.
      const targetWorld = new THREE.Vector3(camera.position.x, signWorldPos.y, camera.position.z);

      if (!sign.userData._billboardDummy) {
        sign.userData._billboardDummy = new THREE.Object3D();
      }
      const dummy = sign.userData._billboardDummy;
      dummy.position.copy(signWorldPos);
      dummy.lookAt(targetWorld);
      if (sign.userData._restQuat) dummy.quaternion.multiply(sign.userData._restQuat);

      if (sign.parent) {
        const parentWorldQuat = new THREE.Quaternion();
        sign.parent.getWorldQuaternion(parentWorldQuat);
        sign.quaternion.copy(parentWorldQuat.invert().multiply(dummy.quaternion));
      } else {
        sign.quaternion.copy(dummy.quaternion);
      }
    }

    // Add subtle animations for mobile objects
    if (isOnMobile) {
      // Angel_Empty hover animation - subtle up and down motion for the entire group
      if (angelEmptyRef.current) {
        const time = state.clock.getElapsedTime();
        // Store original Y position if not already stored
        if (angelEmptyRef.current.userData.originalY === undefined) {
          angelEmptyRef.current.userData.originalY = angelEmptyRef.current.position.y;
        }
        // Apply hover animation relative to original position
        angelEmptyRef.current.position.y = angelEmptyRef.current.userData.originalY + Math.sin(time * 0.8) * 0.01; // Gentle hover with 0.05 units amplitude
      }
      

    }

    // Pin character hint markers above each agent's head bone (world space)
    // if (showCharacterHints) {
    //   const hintPairs = [
    //     [rl80HeadBoneRef.current, rl80HintRef.current],
    //     [demonHeadBoneRef.current, demonHintRef.current],
    //     [monkHeadBoneRef.current, monkHintRef.current],
    //     [virgilHeadBoneRef.current, virgilHintRef.current],
    //   ];
    //   for (const [bone, marker] of hintPairs) {
    //     if (bone && marker) {
    //       bone.getWorldPosition(marker.position);
    //       marker.position.y += 0.18;
    //     }
    //   }
    // }

  });

  // Always return the group that contains the model
  return (
    <>
      <group ref={groupRef} visible={true} position={position} scale={scale} rotation={rotation}>
        {/* The 3D model is added dynamically in useEffect */}
        {(() => {
          const cfg = isOnMobile ? HOLO_STATUE_MOBILE : HOLO_STATUE_DESKTOP;
          return (
            <>
              {/* HolographicStatue3 disabled — the presiding element is now the
                  baked-in geometric "sacred geometry" beacon (Take 001 clip) that
                  ships inside the scene GLB (v76), not a statue. Avoids reusing the
                  landing page's holographic Our Lady. Kept here for reference. */}
              {/* <HolographicStatue3
                position={cfg.position}
                scale={cfg.scale}
                rotation={cfg.rotation}
                hover={false}
                rotate={true}
              /> */}
              {/* Angel spotlight — hidden during the curtain call since the
                  angel itself is part of StageProps (which is invisible while
                  revealMode is set). Without this gate the cone keeps shining
                  upward into empty air. */}
              {!revealMode && (
                <>
                  <primitive
                    object={beamTarget}
                    position={[cfg.position[0], cfg.position[1] + 2, cfg.position[2]]}
                  />
                  <SpotLight
                    position={[0, 1.52, 0.05]}
                    target={beamTarget}
                    angle={Math.PI / 6}
                    castShadow
                    intensity={0}
                    penumbra={0.2}
                    color={'#ffffff'}
                    distance={2.0}
                    opacity={0}
                    // attenuation={4}
                    // anglePower={6}
                  />
                  {/* Visible beam mesh — the SpotLight volumetric above is too
                      faint to read, so this shaft is the actual beam. It emanates
                      from the hologram-projector base (projectorRef) at the center
                      of the desks and rises up, projecting the beacon shape within
                      it. Tune via props; drop the SpotLight's opacity to 0 if you
                      only want this. */}
                  <BeaconBeam
                    anchorRef={projectorRef}
                    color={beam.color}
                    height={beam.height}
                    topRadius={beam.topRadius}
                    bottomRadius={beam.bottomRadius}
                    opacity={beam.opacity}
                    opacityBoostRef={beamBoostRef}
                    heightScaleRef={beamHeightRef}
                  />
                </>
              )}
              {/* The card in play — replaces the legacy geometric beacon.
                  Back face sways in the beam while the table works the case.
                  Hidden during the reveal / curtain-call states (gated on
                  !revealMode, same as the beam above) so it doesn't hang in the
                  air behind the staged characters — only the standard
                  deliberation scene shows the projected card. */}
              {SHOW_HOLOGRAM_CARD && !SHOW_LEGACY_BEACON && !revealMode && (
                <HologramCard
                  // v84 dropped the Shape* geometric beacon, so anchor to the
                  // hologram-projector base (same mesh the beam rides). yOffset
                  // in HOLOGRAM_CARD_CONFIG lifts the card up into the beam.
                  anchorRef={projectorRef}
                  mode="delib"
                  // Tag the card meshes so the Temple raycaster picks clicks on
                  // it (single-click → camera flies in; see handleClick).
                  userData={{ clickable: true, agentId: 'HologramCard' }}
                />
              )}
              {/* Curtain-call spotlights — one per character, color keyed to
                  the outcome: green for aligned, red for missed, soft white
                  for abstained. Each light's target is a primitive Object3D
                  parked at the character's chest height. Only mounted while
                  revealMode is set so they cost nothing during gameplay. */}
              {revealMode && curtainSpotTargets.map((t) => {
                const color = revealMode === 'aligned' ? t.color
                  : revealMode === 'missed' ? t.missColor
                  : t.neutralColor;
                return (
                  <group key={t.name}>
                    <primitive
                      object={t.ref}
                      position={[t.x, 1.1, 0]}
                    />
                    <SpotLight
                      position={[t.x, 3.4, 1.0]}
                      target={t.ref}
                      /* Author's tuning, restored verbatim after the
                         2026-07-26 white-orb hunt (see the reveal-debug
                         memory note: from head-on camera angles the four
                         volumetric cones overlap and can stack bright —
                         judge any brightness work from the ?reveal debug
                         trigger at multiple angles, not just the settled
                         Stage pose). */
                      angle={CURTAIN_SPOT.angle}
                      penumbra={CURTAIN_SPOT.penumbra}
                      intensity={CURTAIN_SPOT.intensity}
                      distance={CURTAIN_SPOT.distance}
                      color={color}
                      opacity={CURTAIN_SPOT.opacity}
                      attenuation={CURTAIN_SPOT.attenuation}
                      anglePower={CURTAIN_SPOT.anglePower}
                    />
                  </group>
                );
              })}
            </>
          );
        })()}
      </group>
      {showCharacterHints && [
        { id: 'RL80', ref: rl80HintRef },
        { id: 'Demon', ref: demonHintRef },
        { id: 'Monk', ref: monkHintRef },
        { id: 'Virgil', ref: virgilHintRef },
        { id: 'Detective', ref: detectiveHintRef },
      ].map(({ id, ref }) => (
        <group key={id} ref={ref} position={[0, 9999, 0]}>
          <Html center occlude zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
            <button
              onPointerDown={(e) => { e.stopPropagation(); onAgentClick && onAgentClick(id); }}
              aria-label={`Tap to meet ${id}`}
              style={{
                background: 'transparent',
                border: 'none',
                position: 'relative',
                top: '-1rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                cursor: 'pointer',
                pointerEvents: 'auto',
                fontSize: '2rem',
                lineHeight: 1,
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.6))',
                animation: 'characterHintIconPulse 2.4s ease-in-out infinite',
              }}
            >
              <span role="img" aria-hidden="true">💬</span>
            </button>
          </Html>
        </group>
      ))}
    </>
  );
};

CyborgTempleScene.displayName = 'CyborgTempleScene';

export default CyborgTempleScene;
              

