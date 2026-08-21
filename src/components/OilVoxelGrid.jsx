"use client";

import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, Html, useGLTF, useTexture, useEnvironment } from "@react-three/drei";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { generateArtifactDistribution3D } from "@/lib/artifactDistribution";
import { PUMP_ZONES, MATERIAL_PRESETS, ADDON_CATALOG, ADDON_SLOTS, FENCE_CATALOG, SIGN_CATALOG } from "@/components/PimpMyPumpPanel";
import RogueCharacter from "@/components/RogueCharacter";
import CommercialStrip from "@/components/CommercialStrip";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Configure Draco decoder for compressed GLB models (e.g. t-rex)
useGLTF.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
// ── Dispose helper for cloned scenes ─────────────────────────────────────────
// NOTE: Does NOT dispose textures (map, normalMap, etc.) because scene.clone(true)
// shares texture references across clones. Disposing a shared texture would corrupt
// all other instances still using it. Only geometries and materials are disposed.
function disposeScene(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

// Perf diagnostic: ?noanim=1 freezes all rig/addon animation (skips every
// AnimationMixer.update) so we can isolate the CPU cost of 100 mixers from the
// draw-call/geometry cost. Read once at module load — reload to toggle.
const NO_ANIM = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("noanim") === "1";

// Perf SPIKE: ?merge=1 replaces the 100 individual Pumpjack components with ONE
// Merged idle rigs (1 draw call each) + instanced static decorations are the
// DEFAULT. `?legacy=1` falls back to the old all-full-Pumpjacks path for
// comparison/debugging. Reload to toggle.
const LEGACY_RIGS = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("legacy") === "1";
const MERGE_RIGS = !LEGACY_RIGS;

// Animated field: EVERY merged idle rig runs its full pumpjack linkage in the vertex
// shader (no skeletal animation, no extra draw calls). Moving parts are tagged per
// vertex (aPart) during the merge; the crank is the single driver and the beam angle
// is solved from the four-bar linkage. Per-rig phase derived from the rig's world
// position desyncs the field. The whole field reads as "alive" on wide aerial views
// where full Pumpjacks would blow the draw-call budget. ON by default — `?animfield=0`
// falls back to the static merged field (A/B + escape hatch).
const ANIM_FIELD = typeof window === "undefined"
  || new URLSearchParams(window.location.search).get("animfield") !== "0";
// Tunables. The crank (Wheel_Back) is the single driver: it spins at FIELD_PUMP_SPEED
// and the beam angle is SOLVED from the four-bar linkage (crank → pitman → beam), so
// the beam amplitude is physical and the pitman length is conserved (no deform).
const FIELD_PUMP_SPEED = 1.7;       // crank angular speed (rad/s)
const FIELD_CRANK_DIR = -1;          // crank spin direction (+1 / -1) — flip if backwards
const FIELD_PUMP_PIVOT_FRAC = 0.1; // saddle height = center→top fraction of beam bbox
// LEGACY fine-tune for Cube's crank attach, about the axle: SCALE (radial) + ANGLE
// (tangential). Normally untouched — the attach is taken from the CrankPin_Mesh geometry
// centroid, so it seats automatically. Left here only as an escape hatch if a future
// model lacks the pin geometry. NOTE: changing SCALE also changes the throw (beam rock).
const FIELD_CRANK_PIN_SCALE = 1.0;
const FIELD_CRANK_PIN_ANGLE = 0.0;
// Debug: ?pinmark=1 renders a small sphere at each linkage joint the shader uses —
// red = crank pin (pitmanA), green = axle (crankPivot), blue = beam end (pitmanB) — so
// the seating can be checked against the actual rig geometry. Drawn on every rig.
const PIN_MARK = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("pinmark") === "1";

// Strike-tier visual: the dedicated ballistic-droplet "fountain" shader (a weak
// well spitting droplets), vs. the fallback of scaling the geyser column down
// into a sputtering bubble. Fountain ON by default — `?sputtershader=0` falls
// back to the scaled column for an A/B compare. SPUTTER_PARTICLES is the per-pixel
// droplet budget — kept conservative for the mobile GPU ceiling (tune upward only
// after checking phone FPS with several strikes live).
const STRIKE_FOUNTAIN = typeof window === "undefined"
  || new URLSearchParams(window.location.search).get("sputtershader") !== "0";
const SPUTTER_PARTICLES = 28;

// Atmospheric distance fog — hazes the far rows of the field for depth and softens
// the horizon seam. OFF by default (it can read as dirty air over the clean field);
// opt in with ?fog=1 to revisit/A-B. Linear so the foreground stays crisp.
const FIELD_FOG = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("fog") === "1";
const FOG_NEAR = 6;   // within this distance: no haze (keeps the selected plot clear)
const FOG_FAR = 24;   // full haze by here (back of the grid recedes)
// Horizon-haze color per environment — distant rigs fade toward this, so it should
// read like that preset's sky/atmosphere. Tune freely.
function fogColorFor(envPreset, parabolum) {
  if (parabolum) return "#3a2c58";          // iridescent violet murk
  if (envPreset === "solstice") return "#c9a86a"; // golden dust
  if (envPreset === "night") return "#444c6e";    // cool blue dark
  if (envPreset === "hell") return "#3a160c";      // low red smog
  return "#bcb091";                          // warm dusty haze (day)
}
function FieldFog({ envPreset, parabolum, enabled }) {
  const { scene } = useThree();
  useEffect(() => {
    if (!enabled) { scene.fog = null; return; }
    const prev = scene.fog;
    scene.fog = new THREE.Fog(fogColorFor(envPreset, parabolum), FOG_NEAR, FOG_FAR);
    return () => { scene.fog = prev; };
  }, [scene, envPreset, parabolum, enabled]);
  return null;
}

// ── Shared CCTV state (module-level, Pumpjack writes → CctvRenderer reads) ──
const _cctvState = {
  active: false,
  worldPos: new THREE.Vector3(),
  worldQuat: new THREE.Quaternion(),
  worldMatrix: new THREE.Matrix4(),
};

// ── CCTV Renderer — renders scene from security cam POV to low-res FBO ──────
const CCTV_W = 320;
const CCTV_H = 240;

export function CctvRenderer({ canvasRef }) {
  const { gl, scene } = useThree();
  const cctvCam = useMemo(() => new THREE.PerspectiveCamera(90, CCTV_W / CCTV_H, 0.01, 500), []);
  const fbo = useMemo(() => new THREE.WebGLRenderTarget(CCTV_W, CCTV_H, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
  }), []);

  useEffect(() => () => fbo.dispose(), [fbo]);

  const pixelBuf = useMemo(() => new Uint8Array(CCTV_W * CCTV_H * 4), []);
  const imgDataRef = useRef(null);
  const _localFwd = useRef(new THREE.Vector3());
  const _normalMat = useRef(new THREE.Matrix3());
  const _target = useRef(new THREE.Vector3());
  const cctvFrameSkip = useRef(0);

  // CCTV camera tuning constants
  const CCTV_OFFSET_X = 0.01;
  const CCTV_OFFSET_Y = 0.00;
  const CCTV_OFFSET_Z = -0.03;
  const CCTV_TILT = 3.0;
  const CCTV_FORWARD_CLEAR = 0.06; // push render origin ahead of the housing so the camera body never pans into frame
  const CCTV_FOV = 90;

  useFrame(() => {
    if (!_cctvState.active) return;

    // Throttle CCTV to every other frame — halves the GPU cost of the second render pass + readback
    cctvFrameSkip.current = (cctvFrameSkip.current + 1) % 2;
    if (cctvFrameSkip.current !== 0) return;

    const cvs = canvasRef?.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    cctvCam.fov = CCTV_FOV;
    cctvCam.updateProjectionMatrix();

    // Forward direction in the security camera's local space (reuse refs)
    const localFwd = _localFwd.current.set(1, 0, 0);
    const normalMatrix = _normalMat.current.getNormalMatrix(_cctvState.worldMatrix);
    localFwd.applyMatrix3(normalMatrix).normalize();

    // Position at the camera + fixed offset + a forward clearance along the lens, so
    // the housing stays behind the render origin and never enters frame at sweep ends.
    cctvCam.position.set(
      _cctvState.worldPos.x + CCTV_OFFSET_X + localFwd.x * CCTV_FORWARD_CLEAR,
      _cctvState.worldPos.y + CCTV_OFFSET_Y + localFwd.y * CCTV_FORWARD_CLEAR,
      _cctvState.worldPos.z + CCTV_OFFSET_Z + localFwd.z * CCTV_FORWARD_CLEAR,
    );

    const target = _target.current.copy(cctvCam.position).add(localFwd.multiplyScalar(5));
    target.y -= CCTV_TILT;
    cctvCam.lookAt(target);
    cctvCam.updateMatrixWorld(true);

    // Render to FBO
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(fbo);
    gl.autoClear = true;
    gl.render(scene, cctvCam);
    gl.readRenderTargetPixels(fbo, 0, 0, CCTV_W, CCTV_H, pixelBuf);
    gl.setRenderTarget(prevTarget);

    // Write to the HTML canvas (flip vertically — WebGL reads bottom-up)
    if (!imgDataRef.current) {
      imgDataRef.current = ctx.createImageData(CCTV_W, CCTV_H);
    }
    const imgData = imgDataRef.current;
    for (let y = 0; y < CCTV_H; y++) {
      const srcOff = (CCTV_H - 1 - y) * CCTV_W * 4;
      const dstOff = y * CCTV_W * 4;
      for (let x = 0; x < CCTV_W * 4; x++) {
        imgData.data[dstOff + x] = pixelBuf[srcOff + x];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  });

  return null;
}

// ── Vertex shader (unchanged) ───────────────────────────────────────────────

// ── Paraboleum iridescence ──────────────────────────────────────────────────
// One palette drives EVERY Paraboleum surface (gusher, oil-spill, underground
// voxel deposits, and the per-rig tank + tower liquids). The procedural shaders
// share an Inigo-Quilez cosine palette  a + b*cos(2π(c·t + d))  for the moving
// oil-slick sheen; the two physical-material liquids use real thin-film
// iridescence (hex tints below). Swap ACTIVE_IRID to retune the whole substance
// at once — opal / aurora / mercury / nebula.
const _v3 = (c) => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`;
const IRID_PRESETS = {
  // True oil-slick opal: NEUTRAL near-black base so the full petrol rainbow reads
  // (magenta→cyan→gold→green). Strong sheen, cyan bloom — distinct from aurora.
  opal: {
    a: [0.50, 0.50, 0.50], b: [0.50, 0.50, 0.50], c: [1.0, 1.0, 1.0], d: [0.00, 0.18, 0.42],
    base: [0.010, 0.018, 0.028], baseHi: [0.10, 0.13, 0.17], glow: [0.25, 0.95, 0.90],
    sheen: 1.9, hex: { base: 0x06070b, emis: 0x18d0c0 },
  },
  // The current alien-glow green, elevated: green-DOMINANT with a soft teal→
  // chartreuse→cyan shimmer. Subtle sheen so it stays unmistakably green.
  aurora: {
    a: [0.20, 0.55, 0.35], b: [0.20, 0.40, 0.30], c: [1.0, 1.0, 1.0], d: [0.30, 0.05, 0.55],
    base: [0.02, 0.10, 0.05], baseHi: [0.10, 0.55, 0.22], glow: [0.20, 1.40, 0.55],
    sheen: 0.7, hex: { base: 0x0d3a16, emis: 0x2dd64a },
  },
  // Silvery living metal with a faint rainbow thin-film skin.
  mercury: {
    a: [0.60, 0.60, 0.62], b: [0.32, 0.32, 0.34], c: [1.0, 1.0, 1.0], d: [0.00, 0.10, 0.22],
    base: [0.10, 0.11, 0.13], baseHi: [0.58, 0.61, 0.66], glow: [0.50, 0.55, 0.66],
    sheen: 0.9, hex: { base: 0x1a1d22, emis: 0x9aabbd },
  },
  // Liquid galaxy — green suppressed, strong blue floor → swings indigo→violet→
  // magenta (purple, not pink). Violet base, blue-biased bloom.
  nebula: {
    a: [0.40, 0.14, 0.62], b: [0.34, 0.14, 0.38], c: [1.0, 1.0, 1.0], d: [0.52, 0.20, 0.02],
    base: [0.05, 0.015, 0.13], baseHi: [0.30, 0.10, 0.60], glow: [0.55, 0.22, 1.25],
    sheen: 1.2, hex: { base: 0x160830, emis: 0x6a2cd8 },
  },
};
const ACTIVE_IRID = IRID_PRESETS.opal;

// ── Default rig identity (Lyquid80) ──────────────────────────────────────────
// Brand-tints the DEFAULT (un-customized) rig toward the opal/petrol palette so
// the resting plot already reads "Lyquid80" instead of stock yellow/blue. Keyed
// by PUMP_ZONES id → hex; a zone absent here keeps the model's baked atlas color.
// Only the moving/hero parts are tinted (beam, horse head, counterweights, crank)
// so the pad/tank/pipes/valve keep their grounding detail. A player's saved color
// always overrides these — this is just the new "stock" look. Tune freely.
const DEFAULT_RIG_TINT = {
  beam:          "#26343d", // walking beam — dark petrol steel (the part players track)
  horseHead:     "#3a7d76", // horse head — teal accent so the bob reads
  counterweight: "#19222a", // counterweights — darkest petrol
  crankWheel:    "#2b8f88", // crank — muted cyan accent
  foundation:    "#2c4a6e", // base plate (Bottom_Box) — refined deep blue accent
  // NB: Under_Pump moved to the motorBox zone (untinted) so it keeps its baked dark
  // and matches Wheel_Box (both share material Palet.004 / #1b1b1b).
};

// Wellhead position in a rig's local (cell) space — where the drill pipe meets
// the ground and the gusher erupts. Used to anchor the idle WellGlow. This is a
// fallback; buildBaseRig derives the TRUE position from the Straw mesh and writes
// it into _rigWellhead (and base.wellhead) so the glow sits in the actual hole.
const WELLHEAD_OFFSET = [0, 0.006, 0.2];
let _rigWellhead = [...WELLHEAD_OFFSET];
// Opal-cyan glow color for the wellhead (the substance's signature bloom).
const WELLHEAD_GLOW = ACTIVE_IRID.hex.emis; // 0x18d0c0

// Backlit sign — emissive strength of the player's image. Moderate so it glows
// without blowing out / desaturating the image under tone-mapping.
const SIGN_EMISSIVE_INTENSITY = 0.7;
// Glow is sunk just below the pad (DROP) so the pad masks any overhang to the hole
// opening (depth-test); SIZE can exceed the hole since the rim trims it. No point
// light — light spills onto the pad and can't be clipped by geometry.
const WELLHEAD_GLOW_DROP = -0.018;
const WELLHEAD_GLOW_SIZE = 0.12;

// ── Control-box live readout (MachinePanel) ──────────────────────────────────
// The MachinePanel box has baked, static digits. On the close-up (selected) rig
// we overlay a live LED readout (depth, last find, MAX) anchored to the panel's
// real world transform. These tunables dial the LED onto the screen face — like
// the wellhead, expect to nudge them against the model. ROT corrects facing if
// the text comes out sideways; the backing plane masks the baked digits.
// Offset is in world-aligned axes (the rig group isn't rotated): +Y lifts onto the
// screen, +X/−Z push out of the box face. ROT is a world Euler — the panel's own
// local frame is twisted (local +Z points straight down), so we orient cleanly in
// world space instead. Default faces world +X (the box's outward side).
// Anchored at the control-box housing (PressurePanel). Offset is world-aligned:
// +X = proud of the face, −Y = down from the LOW screen, +Z = toward the open
// side (away from the red button on −Z). W spans Z (horizontal), H spans Y.
const PANEL_READOUT_OFFSET = [0.012, -0.02, 0.02];
const PANEL_READOUT_ROT = [0, Math.PI / 2, 0]; // stand vertical, face world +X
const PANEL_READOUT_SIZE = 0.038;          // LED glyph height (world units)
const PANEL_SCREEN_W = 0.075;              // backing width  (along Z)
const PANEL_SCREEN_H = 0.05;               // backing height (along Y)
// Mesh-driven path (PressurePanel2 is the screen): orientation + size come from the
// quad. The exported quad is horizontal (face points down), so MESH_ROT stands the
// digits up and faces them out (+X). If you re-orient the quad vertical/facing-out
// in Blender, set MESH_ROT back to [0,0,0] so the digits stay coplanar with it.
// LIFT pushes the digits off the quad face (flip sign if they render behind it);
// GLYPH_FRAC = digit height as a fraction of the quad's shorter side.
const PANEL_TEXT_LIFT = 0.003;
const PANEL_MESH_ROT = [-Math.PI / 2, 0, 0];
const PANEL_GLYPH_FRAC = 0.6;

// GLSL palette fn shared by the procedural shaders. `t` in [0,1) → sheen color.
const IRID_GLSL = `
vec3 iridPalette(float t) {
  return ${_v3(ACTIVE_IRID.a)} + ${_v3(ACTIVE_IRID.b)} * cos(6.28318530718 * (${_v3(ACTIVE_IRID.c)} * t + ${_v3(ACTIVE_IRID.d)}));
}
`;

// ── EXPERIMENT: "Abyss Teal" palette for the eruption ────────────────────────
// Recolors the erupting gusher (geyser shader) AND its ground spill/splatter to a
// teal/green/blue variant of the opal substance: full thin-film iridescence +
// bloom + glitter (the "wow"), but the spectrum is held green/blue-dominant (red
// kept low) so pink is structurally impossible. Scoped to the eruption: the 5
// voxel surfaces, side panels, rig tint, and wellhead idle glow stay on stock
// opal. To revert, delete GUSHER_IRID + gusherPalette and swap the geyser+spill
// shaders' gusherPalette/GUSHER_IRID refs back to iridPalette/ACTIVE_IRID.
const GUSHER_IRID = {
  // ABYSS TEAL: cycles emerald GREEN → TEAL → deep BLUE → CYAN. Red is held LOW
  // across the whole cycle (a.r=0.10) so green/blue always dominate — pink is
  // structurally impossible (it needs high red). Green & blue swing out of phase
  // to roll through the teal→blue→cyan band. Dark ocean-teal base; bright cyan
  // bloom + high sheen keep the opal wow.
  // Green & blue held ANTI-PHASE (dG=0, dB=0.5) so the column swings the full
  // distance spring-GREEN → TEAL → deep BLUE → TEAL for visible banding, not one
  // flat cyan. A little red rides the green end for a warm spring-green (blue stays
  // low there → no pink).
  a: [0.12, 0.55, 0.58], b: [0.12, 0.42, 0.42], c: [1.0, 1.0, 1.0], d: [0.00, 0.00, 0.50],
  base:   [0.02, 0.07, 0.13],  // dark ocean-teal (the dark body reads deep teal)
  baseHi: [0.08, 0.30, 0.34],  // teal mid
  glow:   [0.14, 0.68, 0.90],  // electric cyan bloom, eased so the banding shows
  sheen: 1.9,
};
const GUSHER_GLSL = `
vec3 gusherPalette(float t) {
  return ${_v3(GUSHER_IRID.a)} + ${_v3(GUSHER_IRID.b)} * cos(6.28318530718 * (${_v3(GUSHER_IRID.c)} * t + ${_v3(GUSHER_IRID.d)}));
}
`;

const volumeVert = /* glsl */ `
  varying vec3 vOrigin;
  varying vec3 vDirection;

  void main() {
    // Work in object (local) space so parent group transforms don't affect
    // the baked deposit positions / bounds
    mat4 invModel = inverse(modelMatrix);
    vOrigin = (invModel * vec4(cameraPosition, 1.0)).xyz;
    vDirection = position - vOrigin; // position is already in object space
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── Build fragment shader with deposits baked in ────────────────────────────

function buildFragShader({ deposits, gridX, gridY, depthZ, cellSize, depthCellSize, worldW, worldH, worldD }) {
  const depthScale = (cellSize / depthCellSize).toFixed(4);

  // Object-space bounds: box geometry centered at origin
  const halfW = worldW / 2;
  const halfH = worldH / 2;
  const halfD = worldD / 2;

  // Bake deposit positions in OBJECT SPACE (mesh-local, box centered at origin)
  // Surface is at y=+halfH, deepest at y=-halfH
  const depositLines = deposits.slice(0, 16).map((d, i) => {
    const ox = ((d.cx / (gridX - 1)) - 0.5) * worldW;
    const oy = halfH - (d.cz / (depthZ - 1)) * worldH;  // surface=+halfH, bottom=-halfH
    const oz = (0.5 - d.cy / (gridY - 1)) * worldD;
    const or = d.radius * cellSize;
    return `  deposits[${i}] = vec4(${ox.toFixed(6)}, ${oy.toFixed(6)}, ${oz.toFixed(6)}, ${or.toFixed(6)});
  richness[${i}] = ${d.richness.toFixed(6)};`;
  }).join("\n");

  const numDeposits = Math.min(deposits.length, 16);

  return /* glsl */ `
  precision highp float;

  uniform float uReveal;
  uniform float uParabolum;

  varying vec3 vOrigin;
  varying vec3 vDirection;
${IRID_GLSL}
  const vec3 BOUNDS_MIN = vec3(${(-halfW).toFixed(4)}, ${(-halfH).toFixed(4)}, ${(-halfD).toFixed(4)});
  const vec3 BOUNDS_MAX = vec3(${halfW.toFixed(4)}, ${halfH.toFixed(4)}, ${halfD.toFixed(4)});
  const float DEPTH_SCALE = ${depthScale};
  const int NUM_DEPOSITS = ${numDeposits};

  vec2 intersectBox(vec3 orig, vec3 dir, vec3 bmin, vec3 bmax) {
    vec3 invDir = 1.0 / dir;
    vec3 t0 = (bmin - orig) * invDir;
    vec3 t1 = (bmax - orig) * invDir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    float tNear = max(max(tmin.x, tmin.y), tmin.z);
    float tFar  = min(min(tmax.x, tmax.y), tmax.z);
    return vec2(tNear, tFar);
  }

  float density(vec3 p, vec4 deposits[${numDeposits}], float richness[${numDeposits}]) {
    float d = 0.0;
    for (int i = 0; i < NUM_DEPOSITS; i++) {
      vec3 center = deposits[i].xyz;
      float radius = deposits[i].w;

      vec3 diff = p - center;
      diff.y *= DEPTH_SCALE;
      float dist = length(diff);

      if (dist < radius) {
        float falloff = 1.0 - dist / radius;
        d += falloff * falloff * richness[i];
      }
    }
    return d;
  }

  void main() {
    vec3 rayDir = normalize(vDirection);

    vec2 tHit = intersectBox(vOrigin, rayDir, BOUNDS_MIN, BOUNDS_MAX);
    if (tHit.x > tHit.y) discard;
    tHit.x = max(tHit.x, 0.0);

    // Init baked deposit data
    vec4 deposits[${numDeposits}];
    float richness[${numDeposits}];
${depositLines}

    float stepSize = length(BOUNDS_MAX - BOUNDS_MIN) / 80.0;
    vec3 color = vec3(0.0);
    float alpha = 0.0;

    // Crude (amber) → Paraboleum (neon-green phosphorescence), mixed by uParabolum
    vec3 colLow  = mix(vec3(0.15, 0.08, 0.02), vec3(0.03, 0.14, 0.05), uParabolum);
    vec3 colMid  = mix(vec3(0.35, 0.18, 0.05), vec3(0.09, 0.52, 0.16), uParabolum);
    vec3 colHigh = mix(vec3(0.85, 0.55, 0.15), vec3(0.34, 1.30, 0.46), uParabolum);

    for (float t = tHit.x; t < tHit.y; t += stepSize) {
      vec3 worldPos = vOrigin + rayDir * t;
      float d = density(worldPos, deposits, richness) * uReveal;

      if (d > 0.05) {
        float intensity = clamp(d / 2.0, 0.0, 1.0);
        vec3 oilColor;
        if (intensity < 0.5) {
          oilColor = mix(colLow, colMid, intensity * 2.0);
        } else {
          oilColor = mix(colMid, colHigh, (intensity - 0.5) * 2.0);
        }

        float glow = 1.0 + intensity * (2.0 + uParabolum * 2.4);
        oilColor *= glow;

        // Iridescent opal veins: hue slides with depth + position so the buried
        // Paraboleum reads as a shimmering mineral rather than flat green. Static
        // (no time uniform here) but the color shift still moves as you orbit.
        float irT = fract(worldPos.y * 0.16 + worldPos.x * 0.06 + worldPos.z * 0.04 + intensity);
        oilColor += iridPalette(irT) * uParabolum * intensity * intensity * 0.5 * ${ACTIVE_IRID.sheen.toFixed(3)};

        float sampleAlpha = clamp(d * 0.35, 0.0, 1.0);
        color += (1.0 - alpha) * sampleAlpha * oilColor;
        alpha += (1.0 - alpha) * sampleAlpha;

        if (alpha > 0.95) break;
      }
    }

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * 0.9);
  }
`;
}

// ── Oil droplet texture (round soft circle) ─────────────────────────────────
const _oilDropletTex = (() => {
  if (typeof document === "undefined") return null;
  const size = 32;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(30,16,8,1)");
  g.addColorStop(0.5, "rgba(30,16,8,0.8)");
  g.addColorStop(1, "rgba(30,16,8,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
})();

// ── Oil Geyser Shader (GPU-driven upward gusher) ────────────────────────────
const _geyserVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const _geyserFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
uniform float uNightMode;
uniform float uParabolum;
uniform float uHell;
uniform float uTint;     // motherlode: push the column toward molten gold (0 otherwise)
uniform vec2 uResolution;

// Hash and noise
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i), f),
                 dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                 dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}
${GUSHER_GLSL}
void main() {
  float x = vUv.x - 0.5;
  // When viewing the back face, flip x so the flow pattern stays consistent
  if (!gl_FrontFacing) x = -x;
  float y = vUv.y;

  float T = uTime;

  // ── Fast scrolling noise layers that rush UPWARD ──
  // Key: subtract time from y so the pattern moves up. Hell roars ~1.7x faster so
  // it reads as superheated gas/flame rather than flowing liquid.
  float tScale = mix(1.0, 1.7, uHell);
  float scroll1 = fbm(vec2(x * 8.0, y * 5.0 - T * 4.0 * tScale));
  float scroll2 = fbm(vec2(x * 10.0 + 3.7, y * 6.0 - T * 5.0 * tScale + 1.3));
  float scroll3 = fbm(vec2(x * 14.0 - 1.1, y * 8.0 - T * 6.0 * tScale + 5.7));

  // Combine into turbulent displacement
  float turb = scroll1 * 0.55 + scroll2 * 0.3 + scroll3 * 0.15;

  // Extra-fast flicker layer for hell — drives flame-tongue sway and brightness
  // flicker. Roughly -0.5..0.5; we offset to taste below.
  float flameFlick = fbm(vec2(x * 9.0 + 1.7, y * 11.0 - T * 12.0));

  // ── Column shape (oil): narrow jet at base, cresting cap that curls back down ──
  float baseWidth = 0.06;
  float spread = 0.35 * y * y; // quadratic spread up the jet
  float wobble = scroll1 * 0.1 * y;

  // Cap zone: oil mushrooms outward starting at y ~0.55
  float capZone = smoothstep(0.55, 0.78, y);
  float capBulge = capZone * 0.28;
  // Lobes push outward from center
  float capLobe = capZone * sign(x + 0.001) * (fbm(vec2(abs(x) * 6.0 - T * 1.5, y * 4.0 + T * 2.0)) * 0.12);

  float oilWidth = baseWidth + spread + capBulge + abs(capLobe);
  float oilXOff = x + wobble + capLobe;
  // Soft inner edge: in the cap, the boundary becomes a wide gentle gradient
  float oilInner = mix(oilWidth * 0.3, oilWidth * 0.0, capZone);

  // ── Furnace-blast shape (hell): a torch-flame teardrop — narrow nozzle at the
  //    wellmouth, billowing belly, tapering to flickering tongues. No liquid cap. ──
  float fl = flameFlick - 0.5; // ~ -1..0; magnitude drives raggedness
  float belly = 0.26 * smoothstep(0.02, 0.30, y) * (1.0 - smoothstep(0.32, 0.96, y));
  float ragged = abs(fl) * 0.10 * (0.4 + y);                  // turbulent flickering edge
  float tongues = smoothstep(0.55, 1.0, y) * abs(fl) * 0.16;  // flame tips lick upward
  // Scaled in a touch so the flame base stays within the pad instead of
  // spilling its shader edge onto the ground past the wellhead.
  float hellWidth = (baseWidth + belly + ragged + tongues) * 0.78;
  float hellXOff = x + wobble * 1.4 + fl * 0.16 * y;          // flames sway, not a tidy column
  float hellInner = hellWidth * 0.05;                         // soft, gaseous — no hard liquid wall

  float columnWidth = mix(oilWidth, hellWidth, uHell);
  float xOff = mix(oilXOff, hellXOff, uHell);
  float innerEdge = mix(oilInner, hellInner, uHell);
  float shape = smoothstep(columnWidth, innerEdge, abs(xOff));

  // ── Vertical profile ──
  float coreDensity = smoothstep(0.0, 0.08, y);

  // Oil stays solid (no smoke dissipation); hell stays fairly dense in the belly
  // but breaks up into flickering flame toward the tips.
  float wispiness = mix(mix(0.85, 0.4, y), mix(0.92, 0.78, y), uHell);
  float density = mix(turb * 0.5 + 0.5, 1.0, wispiness) * coreDensity;

  // Chaotic blobs rushing upward
  float blobs = noise(vec2(x * 10.0, y * 8.0 - T * 5.0 * tScale));
  blobs = smoothstep(0.1, 0.5, blobs) * (1.0 - y * 0.3);
  density = max(density, blobs * 0.8);

  // Oil: dense mushroom cap fill. Hell skips the cap entirely (no liquid crest).
  float capDensity = capZone * (fbm(vec2(sign(x + 0.001) * abs(x) * 2.0 - sign(x + 0.001) * T * 2.0, y * 5.0 - T * 0.8)) * 0.4 + 0.6);
  density = mix(mix(density, max(density, capDensity), capZone), density, uHell);

  // Hell: flicker the brightness and taper density toward the tips so the flame
  // licks and dies out up top instead of standing as a solid wall.
  float flameDensity = (0.62 + 0.55 * flameFlick) * (1.0 - smoothstep(0.35, 1.0, y) * 0.72);
  density *= mix(1.0, flameDensity, uHell);
  density = max(density, 0.0);

  // ── Color: very dark oil with occasional slick highlights ──
  vec3 darkOil = vec3(0.03, 0.015, 0.008);
  vec3 midOil = vec3(0.08, 0.04, 0.02);
  vec3 highlight = vec3(0.15, 0.10, 0.06);

  // Night mode: shift palette toward emissive blue
  vec3 darkOilNight = vec3(0.01, 0.02, 0.08);
  vec3 midOilNight = vec3(0.03, 0.06, 0.18);
  vec3 highlightNight = vec3(0.08, 0.15, 0.4);
  darkOil = mix(darkOil, darkOilNight, uNightMode);
  midOil = mix(midOil, midOilNight, uNightMode);
  highlight = mix(highlight, highlightNight, uNightMode);

  // Paraboleum: iridescent opal gusher (overrides night when active). Dark teal
  // base; the rainbow sheen is layered on after compositing below.
  darkOil = mix(darkOil, ${_v3(GUSHER_IRID.base)}, uParabolum);
  midOil = mix(midOil, ${_v3(GUSHER_IRID.baseHi)} * 0.6, uParabolum);
  highlight = mix(highlight, ${_v3(GUSHER_IRID.baseHi)}, uParabolum);

  // Hell: a fiery eruption — charred-red base, molten-orange body, red-orange crests
  darkOil = mix(darkOil, vec3(0.26, 0.02, 0.0), uHell);
  midOil = mix(midOil, vec3(0.95, 0.16, 0.01), uHell);
  highlight = mix(highlight, vec3(1.8, 0.55, 0.06), uHell);

  float colorNoise = scroll2 * 0.5 + 0.5;
  vec3 col = mix(darkOil, midOil, colorNoise);
  col = mix(col, highlight, pow(max(density, 0.0), 4.0) * 0.6);

  // Iridescent oil-slick sheen: bands of petrol-rainbow that flow up the column
  // and drift over time. abs(x) fakes a grazing/fresnel term so the sheen
  // intensifies toward the rounded edges of the gusher, like light off a film.
  float irFres = pow(clamp(abs(x) * 2.0, 0.0, 1.0), 1.3);
  // Higher vertical frequency = more rainbow bands stacked up the column; the 0.5
  // floor spreads the sheen across the full width (not just the edges) so the
  // whole gusher cycles through the spectrum instead of glowing a single hue.
  float irPhase = fract(y * 1.7 - T * 0.14 + fbm(vec2(x * 3.5, y * 2.2 - T * 0.1)) * 0.4 + abs(x) * 0.6);
  // Chromatic dispersion: per-channel phase split. A base split applies across the
  // whole width so the rainbow reads everywhere, and fans out further at the grazing
  // silhouette (irFres) for a strong prismatic edge fringe — light splitting through
  // an oil film.
  float disp = 0.05 + 0.12 * irFres;
  vec3 irSheen = vec3(
    gusherPalette(irPhase + disp).r,
    gusherPalette(irPhase).g,
    gusherPalette(irPhase - disp).b
  );
  // Sheen carried up the FULL column (looser density gate) and stronger overall.
  float irAmt = uParabolum * (0.38 + 0.5 * irFres) * smoothstep(0.02, 0.2, density) * ${GUSHER_IRID.sheen.toFixed(3)};
  col = mix(col, irSheen, irAmt * 0.7) + irSheen * irAmt * 0.5;

  // ── Glitter motes: bright iridescent flecks streaming up the FULL height of the
  //    column, twinkling as they rise (sparser/dimmer toward the top, like rising
  //    embers). Two noise octaves give a mix of fine + coarse sparkles. They boost
  //    BOTH color and alpha (see compositing below) so they twinkle against the sky
  //    rather than vanishing where the jet thins out. Parabolum-only. ──
  float moteN  = noise(vec2(x * 50.0, y * 36.0 - T * 9.0)) * 0.5 + 0.5;
  float moteN2 = noise(vec2(x * 84.0 + 19.0, y * 60.0 - T * 14.0)) * 0.5 + 0.5;
  float moteTwinkle = 0.55 + 0.45 * sin(T * 16.0 + x * 47.0 + y * 31.0);
  float moteHeight = mix(1.0, 0.5, y); // thin out gently up top
  float motes = (smoothstep(0.66, 0.9, moteN) + smoothstep(0.78, 0.95, moteN2))
              * moteTwinkle * moteHeight * uParabolum * shape;
  // Cool cyan-white glitter biased toward the palette — sparkle for the opal wow
  // without washing the column white. Tinted by the teal spectrum, dimmed a touch.
  vec3 moteCol = mix(vec3(0.70, 0.92, 0.95), gusherPalette(fract(irPhase + 0.5)), 0.55);
  col += moteCol * motes * 1.6;

  // Hell: white-hot furnace mouth at the base, cooling to red-orange up the flame.
  // Confined to the bottom ~45% so the body stays red-orange, not yellow.
  float heat = (1.0 - smoothstep(0.0, 0.45, y)) * uHell * coreDensity;
  col = mix(col, vec3(2.1, 1.05, 0.4), heat * 0.5);

  // Emissive glow — blue at night, neon-green for Paraboleum, molten-orange for hell
  float emissive = max(max(uNightMode, uParabolum), uHell) * (0.3 + 0.45 * pow(max(density, 0.0), 2.0));
  // Extra bloom for the cosmic-opal gusher (parabolum only — night/hell unchanged).
  emissive *= mix(1.0, 1.2, uParabolum);
  vec3 glowCol = mix(vec3(0.05, 0.1, 1.35), ${_v3(GUSHER_IRID.glow)}, uParabolum);
  glowCol = mix(glowCol, vec3(2.4, 0.5, 0.04), uHell);
  col += glowCol * emissive;

  // White guard: the dense core stacks body + sheen + bloom + motes additively and
  // clips to white. Where luminance runs hot, pull it back toward a cyan-teal hue
  // (scaled by that luminance so it stays bright, just cyan instead of white).
  // Parabolum-only so night/hell keep their own hot cores.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(0.18, 0.82, 0.92) * lum, smoothstep(0.9, 1.5, lum) * uParabolum * 0.5);

  // ── Alpha compositing ──
  float alpha = shape * density * uOpacity;
  // Solid core boost
  float coreBoost = smoothstep(columnWidth * 0.5, 0.0, abs(xOff)) * coreDensity * 0.5;
  alpha = min(alpha + coreBoost * uOpacity, 1.0);
  // Glitter motes carry their OWN alpha so they sparkle against the sky up the whole
  // column, even where the jet has thinned to near-transparent. Clamped via the
  // dome/edge fade below so they still respect the silhouette.
  alpha = max(alpha, clamp(motes, 0.0, 1.0) * uOpacity * 0.9);

  // Top fade. Oil rounds into a dome; hell tapers into ragged, flickering flame
  // tips that dissipate higher up the plane.
  float domeCenter = 0.65; // y-center of the dome
  float dx = x * 1.8; // stretch x so dome is taller than wide
  float dy = max(y - domeCenter, 0.0); // only fade above dome center
  float domeDist = sqrt(dx * dx + dy * dy);
  float domeFade = smoothstep(0.4, 0.05, domeDist);
  // Flame-tip fade: 1 through the body, falling to 0 at a flickering, noise-jittered
  // top edge so the tongues lick and break up instead of ending in a clean dome.
  float hellTop = smoothstep(1.0, 0.74 + flameFlick * 0.16, y);
  float topFade = mix(domeFade, hellTop, uHell);

  // Edge fade — sides and bottom
  float edgeFade = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x)
                 * smoothstep(0.0, 0.02, y) * topFade;
  alpha *= edgeFade;

  // Motherlode tint — nudge the iridescent column toward a hot molten gold so the
  // richest strikes read as richer, not merely taller. Disabled for the hell fire
  // path (it owns its own fiery palette) and 0 for strike/gusher tiers.
  col = mix(col, col * vec3(1.5, 1.18, 0.55) + vec3(0.14, 0.07, 0.0), uTint * (1.0 - uHell));

  gl_FragColor = vec4(col, alpha);
}
`;

// ── Strike "sputter" fountain ────────────────────────────────────────────────
// A weak well doesn't sustain a jet — it spits discrete droplets that arc up and
// fall back. This is a separate primitive from the geyser column (which is a
// continuous turbulent beam): individual ballistic particles, evaluated per pixel.
// Adapted from a classic Shadertoy particle fountain, ported to our conventions —
// transparent output (alpha = droplet coverage, no opaque background), Lyquid80
// cyan instead of the original fire palette, and the particle budget cut hard
// (single loop, SPUTTER_PARTICLES droplets) for the mobile GPU ceiling. Runs
// continuously while the strike event is live, so it reads as an ongoing weak
// well rather than a one-shot you have to be watching for. vUv: (0.5, 0) = the
// wellhead nozzle; droplets launch from there.
const _sputterVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const _sputterFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
uniform float uNightMode;

float hashf(float v) { return fract(sin(v * 27179.18917)); }

// Ballistic arc: launch up with velocity yv under unit gravity; recycle each
// particle over one full arc (CYCLE seconds). x drifts linearly from the nozzle.
const float CYCLE = 1.94152;
float py(float t, float yv) { return -0.01 + yv * t - 0.5 * t * t; }
float px(float t, float xv) { return 0.5 + xv * t; }
vec2 particle(float t, float xv, float yv) {
  t = mod(t, CYCLE);
  return vec2(px(t, xv) - 0.2 * xv, py(t, yv));
}

void main() {
  vec2 uv = vUv;
  float v = 0.0;
  for (float i = 0.0; i < ${SPUTTER_PARTICLES}.0; i++) {
    // Desync each droplet in time + give it a slightly different launch.
    float tt = uTime + i + hashf(i) * 0.7;
    float xv = sin(i) * 0.22;                 // horizontal drift (±)
    float yv = 0.92 + 0.05 * cos(i * 5.1);    // launch speed → arc height
    vec2 p = particle(tt, xv, yv);
    // Varied droplet size — a few fat blobs among a finer spray (0.4..1.5×).
    float sz = 0.1 + 0.4 * hashf(i * 1.7 + 2.3);
    float ri = 0.011 * sz;                    // droplet radius (small)
    // Dims over its arc life ("evaporates" near the top); smaller drops read
    // fainter, like mist, so the spray has depth instead of uniform blobs.
    float life = 1.0 - mod(tt, CYCLE) / CYCLE;
    float bright = (0.4 + 0.6 * life) * (0.5 + 0.5 * sz / 1.5);
    v += (1.0 - smoothstep(ri, ri + ri * 0.7, length(p - uv))) * bright;
  }
  v = clamp(v, 0.0, 1.0);
  // Lyquid80 cyan: deep teal body to a hot near-white core where droplets stack.
  // (Rock/debris is handled by the real dust particle system, not faked here —
  // soft shader discs read as mud.)
  vec3 col = mix(vec3(0.10, 0.42, 0.60), vec3(0.55, 0.95, 1.0), v);
  // Night mode pulls the core a touch cooler/brighter so it still pops on dark.
  col = mix(col, col * vec3(0.9, 1.05, 1.1), uNightMode * 0.5);
  gl_FragColor = vec4(col, v * uOpacity);
}
`;

// ── Underground feeder jet ───────────────────────────────────────────────────
// A narrow iridescent column running from the struck deposit cell UP to the
// wellhead, so the gusher visibly originates from the cell that holds the oil
// instead of from just below the surface. The above-ground geyser plane is left
// untouched (its crest stays at a fixed height); this segment only fills the
// underground span, and its length grows with drill depth. Because players can see
// a little way below ground, the beam now reads as one continuous eruption rising
// out of the deposit. vUv.y: 0 = deposit (bottom) → 1 = surface (top).
const _feederVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const _feederFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
uniform float uHell;

vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
${GUSHER_GLSL}
void main() {
  float x = vUv.x - 0.5;
  if (!gl_FrontFacing) x = -x;
  float y = vUv.y;                          // 0 deposit → 1 surface
  float T = uTime;
  // Narrow column, widening a touch toward the surface so it meets the base of the
  // above-ground jet.
  float width = 0.12 + 0.07 * y;
  float shape = smoothstep(width, width * 0.12, abs(x));
  // Vertically-streaked turbulence rushing UPWARD (low vertical frequency → long
  // streaks that read as fast laminar flow at any column length).
  float n = noise(vec2(x * 8.0, y * 4.0 - T * 5.0));
  float density = (0.55 + 0.45 * n) * shape;
  // Emerge from the deposit at the bottom; stay solid up to the surface.
  density *= smoothstep(0.0, 0.14, y);
  density = max(density, 0.0);
  // Iridescent opal (normal) / molten (hell) palette scrolling up the column.
  float irPhase = fract(y * 1.6 - T * 0.5 + n * 0.3);
  vec3 opal = gusherPalette(irPhase);
  vec3 fire = mix(vec3(0.5, 0.05, 0.0), vec3(2.0, 0.6, 0.1), 0.5 + 0.5 * n);
  vec3 col = mix(opal, fire, uHell);
  // Self-emissive so it glows in the dark underground.
  col += col * (0.4 + 0.6 * pow(density, 2.0));
  float alpha = density * uOpacity;
  // Side edge fade.
  alpha *= smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
  gl_FragColor = vec4(col, alpha);
}
`;

// ── Oil spill / splatter decal ───────────────────────────────────────────────
// A flat ground quad that pools a central puddle plus scattered satellite splats
// around the wellhead while the gusher erupts. uGrow (0..1) spreads the spill as it
// builds; uOpacity fades it in/out with the gusher. Dark oil, parabolum→neon green.
const _spillVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const _spillFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uOpacity;
uniform float uGrow;
uniform float uNightMode;
uniform float uParabolum;
uniform float uHell;
uniform vec2 uClipCenter;
uniform vec2 uFieldHalf;
uniform float uPlaneHalf;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i), f),
                 dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                 dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

// Coverage of an irregular oil blob centered at c, base radius r, with a noisy edge.
float splat(vec2 p, vec2 c, float r, float seed) {
  vec2 d = p - c;
  float ang = atan(d.y, d.x);
  float edge = r * (1.0 + 0.4 * fbm(vec2(cos(ang), sin(ang)) * 2.5 + seed));
  return smoothstep(edge, edge * 0.55, length(d));
}
${GUSHER_GLSL}
void main() {
  vec2 p = (vUv - 0.5) * 2.0; // -1..1
  float g = mix(0.45, 1.0, clamp(uGrow, 0.0, 1.0)); // spread factor as the spill builds

  // Central puddle + scattered satellite splats around the wellhead.
  float cov = splat(p, vec2(0.0, 0.0), 0.5 * g, 0.0);
  cov = max(cov, splat(p, vec2(0.55, 0.20), 0.16 * g, 11.0));
  cov = max(cov, splat(p, vec2(-0.50, 0.35), 0.13 * g, 23.0));
  cov = max(cov, splat(p, vec2(0.30, -0.60), 0.18 * g, 37.0));
  cov = max(cov, splat(p, vec2(-0.45, -0.50), 0.12 * g, 51.0));
  cov = max(cov, splat(p, vec2(0.72, -0.28), 0.09 * g, 67.0));
  cov = max(cov, splat(p, vec2(-0.78, -0.06), 0.08 * g, 83.0));

  // Fine droplet specks in an outer ring (only once the spill has spread).
  float dist = length(p);
  float ring = smoothstep(0.5, 0.58, dist) * (1.0 - smoothstep(0.9, 1.0, dist));
  float speck = smoothstep(0.74, 0.82, noise(p * 11.0 + 5.0)) * ring * smoothstep(0.5, 0.9, uGrow);
  cov = max(cov, speck);

  // Clip to the playfield top so perimeter-rig puddles pool to the mesa edge
  // and stop, instead of flinging splats off into the air. Map plane-local p
  // (-1..1) to grid XZ (rotation [-π/2,0,0] sends local +Y to world -Z), then
  // fade out just past the field boundary.
  vec2 gridXZ = uClipCenter + vec2(p.x, -p.y) * uPlaneHalf;
  vec2 edgeDist = uFieldHalf - abs(gridXZ); // >0 inside, <0 past the edge
  float fieldMask = smoothstep(0.0, 0.05, min(edgeDist.x, edgeDist.y));
  cov *= fieldMask;

  if (cov < 0.02) discard;

  // Dark oil, tinted earthy plum for parabolum, molten-red for hell.
  vec3 oil = mix(vec3(0.02, 0.015, 0.008), ${_v3(GUSHER_IRID.base)}, uParabolum);
  oil = mix(oil, vec3(0.14, 0.02, 0.0), uHell);
  float sheen = pow(cov, 3.0);
  vec3 hi = mix(vec3(0.18, 0.14, 0.08), ${_v3(GUSHER_IRID.baseHi)}, uParabolum);
  hi = mix(hi, vec3(1.5, 0.55, 0.06), uHell);
  vec3 col = mix(oil, hi, sheen * 0.5);

  // Teal oil-slick sheen on the puddle — oscillates deep TEAL ↔ electric CYAN
  // (both green/blue-dominant) so it matches the column and stays in the teal
  // family. Strongest at the thin edge.
  float irT = fract(dist * 1.4 + fbm(p * 4.0) * 0.5 + uGrow * 0.2);
  vec3 slick = mix(vec3(0.05, 0.28, 0.34), vec3(0.10, 0.85, 0.95), 0.5 + 0.5 * cos(6.28318530718 * irT));
  float irEdge = smoothstep(0.15, 0.6, dist) * (1.0 - smoothstep(0.85, 1.05, dist));
  col = mix(col, col + slick, uParabolum * cov * (0.28 + 0.5 * irEdge) * ${(GUSHER_IRID.sheen * 0.6).toFixed(3)});

  // Emissive glow so the slick still reads at night / under parabolum / in hell.
  float emis = max(max(uNightMode, uParabolum), uHell) * 0.4 * cov;
  vec3 emisCol = mix(vec3(0.04, 0.08, 0.5), ${_v3(GUSHER_IRID.glow)} * 0.6, uParabolum);
  emisCol = mix(emisCol, vec3(1.6, 0.38, 0.02), uHell);
  col += emisCol * emis;

  // White guard (matches the gusher): pull the brighter sheen pixels back toward
  // a cyan-teal hue so the splash reads as the same substance as the column and
  // never clips to white. Parabolum-only.
  float teal_lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(0.18, 0.82, 0.92) * teal_lum, smoothstep(0.42, 1.0, teal_lum) * uParabolum * 0.7);

  // Violet iridescence on the splash — applied AFTER the teal guard (which would
  // otherwise pull it back to cyan). Driven across the WHOLE puddle by the slick
  // phase (no irEdge gate — that only fires at the rim where coverage is already
  // dropping, which made this invisible). vBand is a broad cosine so the purple
  // rolls in as iridescent bands. Blue-dominant violet (R<B) so it stays purple.
  float vBand = 0.5 + 0.5 * cos(6.28318530718 * irT + 2.1);
  col = mix(col, vec3(0.40, 0.16, 0.66), uParabolum * cov * vBand * 0.9);

  gl_FragColor = vec4(col, cov * uOpacity * 0.92);
}
`;

// ── Tank liquid fill (animated, flat-topped) ────────────────────────────────

const PUMPJACK_SCALE = 0.1;

// Yaw correction (degrees about world-up) applied to the auto-derived MachinePanel
// front direction. The front is inferred from the gauge children, then this rotates
// it to square up. If the camera frames a SIDE, set 90 or -90; if it frames the BACK,
// set 180; if it's already perfect, set 0.
const PANEL_FRONT_YAW_OFFSET_DEG = 0;
const _PANEL_UP = /* @__PURE__ */ new THREE.Vector3(0, 1, 0);

// Pressure-gauge needle: sweeps about its LOCAL X axis (matching Blender), 0 at empty
// tank → 120° at full (Blender quaternion W=0.5, X=0.866). Flip the sign if it sweeps
// toward LOW instead of HIGH.
const NEEDLE_FULL_SWEEP = /* @__PURE__ */ (120 * Math.PI / 180);
const _NEEDLE_AXIS = /* @__PURE__ */ new THREE.Vector3(1, 0, 0);
const _needleQuat = /* @__PURE__ */ new THREE.Quaternion();

// Gusher "blowback": while the geyser erupts, pitch the body/Samson post (Body_Pump)
// back on its local X axis so the rig looks shoved back by the blast. Head_Pump lives
// in a SEPARATE armature, so for the gusher we reparent it under Body_Pump (see the
// .attach() in the start handler) — that way the horsehead rides the same rotation as
// one rigid unit instead of swinging on its own (different local frame) and detaching.
// Eases in with the gusher and settles as it fades.
// Flip the sign if the rig tilts the wrong way; bump the magnitude for more drama.
const GUSHER_BLOWBACK_BODY = -0.30; // radians of X tilt on Body_Pump (negative = pitch back)
const GUSHER_BLOWBACK_SPEED = 15;   // lerp rate toward the target tilt
// Extra back-pitch on the horsehead alone, on TOP of riding the body. Applied about
// the body's X axis (the head's parent frame during the gusher), not the head's own
// tilted local axis. ~164°; positive pitches the head back away from the body — the
// negative direction curled it under and clipped through Body_Pump.
const GUSHER_HEAD_EXTRA = Math.PI / 1.1;
const _GUSHER_X_AXIS = /* @__PURE__ */ new THREE.Vector3(1, 0, 0);
const _gusherHeadQuat = /* @__PURE__ */ new THREE.Quaternion();
// One-shot gusher length (seconds). A sustained gusher (tank overflow, or the demon
// being loose) holds at full intensity and only runs this final 1s as a settle.
const GUSHER_DURATION = 3.0;
// After a broadcast gusher event clears, keep its rig mounted this long so the
// geyser plays its final 1s fade + the pump settles before handing the cell back
// to the merged static field (covers the ~1s fade with a little margin).
const GUSHER_FADE_LINGER_MS = 1200;
// Underground feeder jet — the column from the struck deposit cell up to the
// wellhead (see _feederFragmentShader). Its length = drill depth in world units
// (drillDay · depthCellSize), clamped to a minimum so a shallow strike still shows
// a stub. The above-ground crest height is unaffected.
const GUSHER_FEEDER_WIDTH = 0.42;     // world width of the feeder plane
const GUSHER_FEEDER_MIN_DEPTH = 0.5;  // shortest feeder (world units), for shallow strikes
const GUSHER_FEEDER_DEPTH_SCALE = 1.0; // multiplier on drill depth → tune how deep the origin sits

// Step 2 — tiered strike feedback. The 3D oil response scales with the strike
// tier written on each gusherEvent (oil-strike-tick `tierFor`): a small "strike"
// reads as a low seep bubble, "gusher" is the baseline beam, "motherlode" is
// taller + wider + a hotter tint and the only tier that shoves the rig hard. The
// rock/dust kick-up is the constant across all three (scaled, not gated). Tune
// the feel here; thresholds that pick the tier live in oil-strike-tick `runTick`.
const GUSHER_TIER_VIS = {
  //            geyser column         duration            ground   rig       dust    color    behaviour
  //            height  width         (seconds)           spill    blowback  kick    tint     sputter (one-shot coughs)
  strike:     { height: 0.7,  width: 0.55, duration: 2.6,                   spill: 0.4,  blowback: 0.3, dust: 0.8, tint: 0.0, sputter: true },
  gusher:     { height: 1.0,  width: 1.0,  duration: GUSHER_DURATION,        spill: 1.0,  blowback: 1.0,  dust: 1.5, tint: 0.0, sputter: false },
  motherlode: { height: 1.45, width: 1.18, duration: GUSHER_DURATION + 1.5,  spill: 1.4,  blowback: 1.2,  dust: 2.1, tint: 1.0, sputter: false },
};
const tierVis = (t) => GUSHER_TIER_VIS[t] || GUSHER_TIER_VIS.gusher;
// Sputter envelope (strike tier) — a weak well doesn't sustain a jet; it coughs a
// short burst of decaying spurts, idles, then coughs again, repeating for as long
// as the strike's event is live (until banked). Recurring so the player catches it
// whenever they glance over, not just in the first couple seconds. A faint floor
// keeps a small dribble between coughs so the cell reads as "struck" at a glance.
const STRIKE_SPUTTER_HZ = 1.6;      // spurts/sec within a cough burst
const STRIKE_SPUTTER_FLOOR = 0.1;   // residual dribble between coughs (0..1 of tier height)
const STRIKE_SPUTTER_CYCLE = 6.0;   // seconds between cough bursts
const STRIKE_SPUTTER_WINDOW = 2.0;  // length of each cough burst within the cycle

/**
 * Build an ExtrudeGeometry representing liquid in a horizontal cylinder.
 * The cross-section is a circular segment (arc below water line + chord on top).
 * Extruded along the tank's length axis (Z in local space).
 *
 * @param {number} fill - 0→1 fill fraction
 * @param {number} radius - cylinder radius
 * @param {number} length - extrusion length (tank length)
 * @param {number} segments - arc smoothness
 */
function buildFillGeometry(fill, radius, length, segments = 48) {
  if (fill <= 0) return null;
  const clampFill = Math.min(fill, 1);

  // Water line Y in circle centered at origin: bottom = -R, top = +R
  // waterY = -R + fill * 2R = R*(2*fill - 1)
  const waterY = radius * (2 * clampFill - 1);

  // Chord endpoints: where y = waterY intersects circle x²+y²=R²
  // x = ±sqrt(R² - waterY²)
  const halfChord = Math.sqrt(Math.max(0, radius * radius - waterY * waterY));

  const shape = new THREE.Shape();

  // If nearly full, just use a full circle
  if (clampFill > 0.995) {
    shape.absarc(0, 0, radius * 0.98, 0, Math.PI * 2, false);
  } else {
    // Right chord endpoint
    const cx0 = halfChord;
    const cy0 = waterY;
    shape.moveTo(cx0, cy0);

    // Arc from right chord endpoint, around the BOTTOM, to left chord endpoint
    // Right endpoint angle: atan2(waterY, halfChord)
    // Left endpoint angle: atan2(waterY, -halfChord)
    const angleRight = Math.atan2(waterY, halfChord);
    const angleLeft = Math.atan2(waterY, -halfChord);

    // Trace clockwise from right endpoint through the bottom to left endpoint
    const arcSpan = angleRight >= angleLeft
      ? (angleRight - angleLeft)
      : (angleRight - angleLeft + 2 * Math.PI);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const angle = angleRight - t * arcSpan;
      shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
    }

    // Close with chord (flat liquid surface)
    shape.lineTo(cx0, cy0);
  }

  const extrudeSettings = {
    steps: 1,
    depth: length,
    bevelEnabled: false,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center the extrusion so it spans -length/2 to +length/2
  geo.translate(0, 0, -length / 2);
  return geo;
}

function TankLiquid({ tankBounds, tankFill, envPreset, parabolum = false }) {
  const meshRef = useRef();
  const displayFill = useRef(0);
  const lastQuantizedFill = useRef(-1);
  const isNight = envPreset === "night";
  const isSolstice = envPreset === "solstice";

  const oilMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    // Paraboleum overrides time-of-day: an iridescent phosphorescent fluid. Real
    // thin-film iridescence makes the surface shift hue as the camera orbits;
    // clearcoat adds the wet glossy skin, emissive keeps it glowing in the dark.
    color: ACTIVE_IRID.hex.base,
    roughness: 0.12,
    metalness: 0.0,
    transparent: true,
    opacity: 0.96,
    emissive: ACTIVE_IRID.hex.emis,
    emissiveIntensity: 0.6,
    iridescence: 1.0,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [120, 560],
    clearcoat: 1.0,
    clearcoatRoughness: 0.18,
  }), [isNight, isSolstice, parabolum]);

  // Tank geometry params — the tank is a horizontal cylinder
  // sizeX is the tank's cross-section width (diameter), sizeZ is the length
  const config = useMemo(() => {
    const tb = tankBounds;
    const S = PUMPJACK_SCALE;
    // Radius = half the smaller of sizeX and sizeY (the circular cross-section)
    const radius = Math.min(tb.sizeX, tb.sizeY) / 2 * 0.85;
    // Length along the tank's long axis
    const tankLength = tb.sizeZ * 1.4;
    return {
      radius, tankLength,
      cx: tb.cx, cy: tb.cy, cz: tb.cz,
      minY: tb.minY, sizeY: tb.sizeY,
      S,
    };
  }, [tankBounds]);

  const targetFill = useRef(tankFill);
  targetFill.current = tankFill;

  useFrame((_, delta) => {
    const target = Math.min(targetFill.current, 1);
    const prev = displayFill.current;
    if (Math.abs(target - prev) < 0.001) {
      displayFill.current = target;
    } else {
      displayFill.current += (target - prev) * Math.min(delta * 0.8 / Math.max(Math.abs(target - prev), 0.01), 1);
    }

    const fill = displayFill.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    if (fill < 0.001) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    // Quantize fill to reduce geometry rebuilds (every ~2%)
    const quantized = Math.round(fill * 50) / 50;
    if (quantized !== lastQuantizedFill.current && quantized > 0) {
      lastQuantizedFill.current = quantized;
      const { radius, tankLength } = config;
      const newGeo = buildFillGeometry(quantized, radius, tankLength);
      if (newGeo) {
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = newGeo;
      }
    }

    // Position: center of tank, rotated so extrusion runs along tank's Z axis
    const { cx, cy, cz, S } = config;
    mesh.position.set(cx * S, cy * S, cz * S);
    mesh.rotation.y = Math.PI / 2;
    mesh.scale.setScalar(S);
  });

  return (
    <group>
      <mesh ref={meshRef} material={oilMat} visible={false} renderOrder={-1}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
      </mesh>
    </group>
  );
}

// ── Pumpjack instances ──────────────────────────────────────────────────────

// Build a mesh-name → zone-id lookup for fast traversal
const MESH_TO_ZONE = {};
PUMP_ZONES.forEach((zone) => {
  zone.meshes.forEach((meshName) => { MESH_TO_ZONE[meshName] = zone.id; });
});

function applyPumpConfig(clonedScene, pumpConfig, originalMats, envMap) {
  clonedScene.traverse((child) => {
    if (!child.isMesh) return;
    let zoneId = MESH_TO_ZONE[child.name];
    if (!zoneId && child.name.startsWith("SignFrame")) zoneId = "signFrame";
    if (!zoneId) return;

    // Cache original material properties on first encounter
    if (!originalMats[child.name]) {
      const m = child.material;
      originalMats[child.name] = {
        color: m.color.clone(),
        roughness: m.roughness,
        metalness: m.metalness,
        emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0),
        emissiveIntensity: m.emissiveIntensity || 0,
        envMapIntensity: m.envMapIntensity ?? 0,
        map: m.map || null,
        normalMap: m.normalMap || null,
        roughnessMap: m.roughnessMap || null,
        metalnessMap: m.metalnessMap || null,
        aoMap: m.aoMap || null,
        alphaMap: m.alphaMap || null,
        emissiveMap: m.emissiveMap || null,
        bumpMap: m.bumpMap || null,
      };
    }

    const orig = originalMats[child.name];

    // Clone material so each instance stays independent
    if (!child.userData._pmpCloned) {
      child.material = child.material.clone();
      child.userData._pmpCloned = true;
    }

    // If no config (deselected), restore originals
    const zoneConf = pumpConfig ? pumpConfig[zoneId] : null;
    if (!zoneConf || (!zoneConf.color && zoneConf.preset === "stock")) {
      // Swap to MeshStandardMaterial for proper lighting/depth
      if (!child.userData._swappedStandard) {
        if (!child.userData._originalMat) {
          child.userData._originalMat = child.material;
        }
        child.material = new THREE.MeshStandardMaterial({
          color: orig.color.clone(),
          map: orig.map || null,
          normalMap: orig.normalMap || null,
          roughnessMap: orig.roughnessMap || null,
          metalnessMap: orig.metalnessMap || null,
          aoMap: orig.aoMap || null,
          alphaMap: orig.alphaMap || null,
          emissiveMap: orig.emissiveMap || null,
          bumpMap: orig.bumpMap || null,
          roughness: 0.35,
          metalness: 0.4,
          emissive: orig.emissive ? orig.emissive.clone() : new THREE.Color(0),
          emissiveIntensity: orig.emissiveIntensity || 0,
          envMap: envMap || null,
          envMapIntensity: 1.0,
        });
        child.userData._swappedStandard = true;
        child.userData._pmpCloned = true;
      } else {
        const m = child.material;
        m.color.copy(orig.color);
        m.map = orig.map;
        m.normalMap = orig.normalMap;
        m.roughnessMap = orig.roughnessMap;
        m.metalnessMap = orig.metalnessMap;
        m.aoMap = orig.aoMap;
        m.alphaMap = orig.alphaMap;
        m.emissiveMap = orig.emissiveMap;
        m.bumpMap = orig.bumpMap;
        m.roughness = 0.35;
        m.metalness = 0.4;
        m.emissive.copy(orig.emissive || new THREE.Color(0));
        m.emissiveIntensity = orig.emissiveIntensity || 0;
        m.envMapIntensity = 1.0;
        m.needsUpdate = true;
      }
      // Lyquid80 brand default: flat-tint the hero zones even when "stock" so the
      // close-up rig matches the merged field. This branch only runs when there's
      // no custom color, so overriding here never stomps a player's choice.
      const brandTint = DEFAULT_RIG_TINT[zoneId];
      if (brandTint) {
        child.material.color.set(brandTint);
        child.material.map = null;
        child.material.needsUpdate = true;
      }
      return;
    }

    const preset = MATERIAL_PRESETS[zoneConf.preset] || MATERIAL_PRESETS.stock;

    // Swap to MeshStandardMaterial if preset requests it (for proper env map reflections)
    if (preset.useStandard && !child.userData._swappedStandard) {
      if (!child.userData._originalMat) {
        child.userData._originalMat = child.material;
      }
      child.material = new THREE.MeshStandardMaterial({
        roughness: preset.roughness,
        metalness: preset.metalness,
        envMap: envMap || null,
        envMapIntensity: preset.envMapIntensity ?? 1,
      });
      child.userData._swappedStandard = true;
      child.userData._pmpCloned = true;
    } else if (!preset.useStandard && child.userData._swappedStandard) {
      // Swap back from Standard to original type
      child.material = child.userData._originalMat.clone();
      child.userData._swappedStandard = false;
      child.userData._pmpCloned = true;
    }

    const mat = child.material;

    // Apply color — detach texture map so flat color shows through. Falls back to
    // the Lyquid80 brand default for the zone, then the model's original color, so
    // the selected/close-up rig matches the merged field (see DEFAULT_RIG_TINT).
    const paintColor = zoneConf.color || DEFAULT_RIG_TINT[zoneId];
    if (paintColor) {
      mat.color.set(paintColor);
      if (mat.map) mat.map = null;
    } else {
      mat.color.copy(orig.color);
      mat.map = orig.map;
    }

    // Apply preset material properties
    if (preset.roughness !== null) {
      mat.roughness = preset.roughness;
      mat.metalness = preset.metalness;
      mat.envMapIntensity = preset.envMapIntensity ?? 0;
      if (envMap && preset.envMapIntensity > 0) mat.envMap = envMap;
      const ei = preset.emissiveIntensity ?? 0;
      if (preset.emissive === "auto" || preset.emissive === "subtle") {
        mat.emissive = mat.color.clone();
        mat.emissiveIntensity = ei;
      } else if (preset.emissive) {
        mat.emissive.set(preset.emissive);
        mat.emissiveIntensity = 0;
      }
    } else {
      mat.roughness = orig.roughness;
      mat.metalness = orig.metalness;
      mat.emissive.copy(orig.emissive);
      mat.emissiveIntensity = orig.emissiveIntensity;
      mat.envMapIntensity = orig.envMapIntensity;
    }

    mat.needsUpdate = true;
  });
}

// ── Plot add-on meshes (GLB models or placeholder geometry) ─────────────────

function AddonGLB({ item, slotPos, rotation = 0 }) {
  const { scene } = useGLTF(item.model);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => () => disposeScene(cloned), [cloned]);
  const rotY = rotation * Math.PI / 2;

  return (
    <group position={[slotPos.x, slotPos.y, slotPos.z]} rotation={[0, rotY, 0]}>
      <primitive object={cloned} scale={PUMPJACK_SCALE} />
    </group>
  );
}

function AddonAnimatedGLB({ item, slotPos, rotation = 0 }) {
  const { scene, animations } = useGLTF(item.model);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  useEffect(() => () => disposeScene(cloned), [cloned]);
  const mixerRef = useRef();
  const idleActionRef = useRef();
  const extrasRef = useRef([]); // non-idle, non-walk actions
  const walkActionRef = useRef();
  const nextTriggerTime = useRef(0);
  const groupRef = useRef();

  // Pacing state
  const paceRef = useRef({
    active: false,
    phase: "out",  // "out" = walking away, "turn" = rotating, "back" = walking home
    progress: 0,
    turnProgress: 0,
    distance: 0.16, // how far to pace from origin
    speed: 0.06,    // units per second
  });

  useEffect(() => {
    if (!animations || animations.length === 0) return;
    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;

    const idleClip = animations.find((c) => c.name === "Idle")
      || animations.find((c) => /^idle$/i.test(c.name))
      || animations[0];
    const walkClip = animations.find((c) => /^walk$/i.test(c.name));

    const idleAction = mixer.clipAction(idleClip);
    idleAction.play();
    idleActionRef.current = idleAction;

    // Walk gets its own ref for pacing behavior
    if (walkClip) {
      const walkAction = mixer.clipAction(walkClip);
      walkAction.loop = THREE.LoopRepeat; // loops while pacing
      walkActionRef.current = walkAction;
    }

    // Everything else (not idle, not walk) are one-shot extras
    const extras = animations
      .filter((c) => c !== idleClip && c !== walkClip)
      .map((clip) => {
        const action = mixer.clipAction(clip);
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = false;
        return action;
      });
    extrasRef.current = extras;

    // When a one-shot extra finishes, snap back to idle
    // (extra is already done so nothing to crossfade from — just restore idle)
    mixer.addEventListener("finished", (e) => {
      if (extras.includes(e.action)) {
        e.action.stop();
        idleAction.enabled = true;
        idleAction.setEffectiveWeight(1);
        idleAction.play();
      }
    });

    nextTriggerTime.current = performance.now() + 3000 + Math.random() * 3000;
    return () => mixer.stopAllAction();
  }, [cloned, animations]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    if (NO_ANIM) return;
    mixer.update(delta);

    const idle = idleActionRef.current;
    const walk = walkActionRef.current;
    const extras = extrasRef.current;
    const pace = paceRef.current;
    const group = groupRef.current;

    // Handle active pacing
    if (pace.active && group) {
      const step = pace.speed * delta;
      if (pace.phase === "out") {
        pace.progress += step;
        group.position.z = pace.progress;
        if (pace.progress >= pace.distance) {
          pace.phase = "turn";
          pace.turnProgress = 0;
        }
      } else if (pace.phase === "turn") {
        // Quick 180° turn
        pace.turnProgress += delta * 4; // ~0.25s turn
        group.rotation.y = Math.min(pace.turnProgress, 1) * Math.PI;
        if (pace.turnProgress >= 1) {
          group.rotation.y = Math.PI;
          pace.phase = "back";
        }
      } else if (pace.phase === "back") {
        pace.progress -= step;
        group.position.z = pace.progress;
        if (pace.progress <= 0) {
          // Done pacing — turn back to original facing and fade to idle
          pace.active = false;
          group.position.z = 0;
          group.rotation.y = 0;
          if (walk) {
            walk.fadeOut(0.5);
            idle.enabled = true;
            idle.setEffectiveWeight(1);
            idle.play();
          }
          // Schedule next trigger
          nextTriggerTime.current = performance.now() + 4000 + Math.random() * 5000;
        }
      }
      return;
    }

    // Trigger random action
    if (idle && performance.now() > nextTriggerTime.current) {
      // Build pool: walk (if available) + extras
      const pool = [];
      if (walk) pool.push("walk");
      extras.forEach((_, i) => pool.push(i));

      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick === "walk" && walk) {
          // Start pacing
          idle.stop();
          walk.reset();
          walk.setEffectiveWeight(1);
          walk.play();
          pace.active = true;
          pace.phase = "out";
          pace.progress = 0;
          pace.turnProgress = 0;
        } else {
          // One-shot extra
          const action = extras[pick];
          idle.stop();
          action.reset();
          action.setEffectiveWeight(1);
          action.play();
          nextTriggerTime.current = performance.now() + 4000 + Math.random() * 5000;
        }
      }
    }
  });

  const rotY = rotation * Math.PI / 2;
  return (
    <group position={[slotPos.x, slotPos.y, slotPos.z]} rotation={[0, rotY, 0]}>
      <group ref={groupRef}>
        <primitive object={cloned} scale={PUMPJACK_SCALE} />
      </group>
    </group>
  );
}

function AddonTubeMan({ item, slotPos, rotation = 0 }) {
  const { scene } = useGLTF(item.model);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => () => disposeScene(cloned), [cloned]);

  const bodyRef = useRef();      // "Tubeman" mesh — rotates from waist origin
  const streamersRef = useRef();  // "Streamers" mesh — vertex flutter
  const streamersData = useRef(null);
  const timeRef = useRef(0);

  // Find meshes by name and prepare streamers for vertex animation
  useMemo(() => {
    cloned.traverse((child) => {
      const n = child.name?.toLowerCase();
      if (n === "tubeman") {
        bodyRef.current = child;
      }
      if (n === "streamers" || n?.startsWith("streamers")) {
        // Could be the Object3D wrapper or the Mesh itself — find the actual mesh
        const mesh = child.isMesh ? child : child.children?.find((c) => c.isMesh);
        if (mesh && mesh.geometry) {
          streamersRef.current = mesh;
          mesh.geometry = mesh.geometry.clone();
          const pos = mesh.geometry.attributes.position;
          streamersData.current = new Float32Array(pos.array);
        }
      }
    });
  }, [cloned]);

  useFrame((_, delta) => {
    if (NO_ANIM) return;
    timeRef.current += delta;
    const t = timeRef.current;

    // === Body: snappy whip rotation from waist ===
    if (bodyRef.current) {
      // Smooth, organic sway — layered sines at irrational ratios for non-repeating feel
      const swayX = Math.sin(t * 1.1) * 0.15
                   + Math.sin(t * 0.7 + 1.3) * 0.08
                   + Math.sin(t * 1.9 + 0.7) * 0.05;
      const swayZ = Math.sin(t * 0.9 + 2.1) * 0.12
                   + Math.sin(t * 1.4 + 0.5) * 0.06
                   + Math.cos(t * 0.5 + 1.8) * 0.04;

      bodyRef.current.rotation.x = swayX;
      bodyRef.current.rotation.z = swayZ;
    }

    // === Streamers: per-vertex chaotic flutter ===
    if (streamersData.current && streamersRef.current) {
      const pos = streamersRef.current.geometry.attributes.position;
      const arr = pos.array;
      const orig = streamersData.current;

      for (let i = 0; i < arr.length; i += 3) {
        const ox = orig[i], oy = orig[i + 1], oz = orig[i + 2];
        // Each vertex gets unique phase from its position
        const phase = ox * 7.0 + oy * 5.0 + oz * 3.0;
        // Frenetic flutter — big amplitudes, fast frequencies, 3 layers each
        arr[i]     = ox + Math.sin(t * 18.0 + phase) * 0.8
                        + Math.sin(t * 11.0 + phase * 1.3) * 0.5
                        + Math.cos(t * 25.0 + phase * 2.1) * 0.3;
        arr[i + 1] = oy + Math.cos(t * 20.0 + phase * 0.8) * 0.7
                        + Math.sin(t * 13.0 + phase * 1.7) * 0.4
                        + Math.sin(t * 28.0 + phase * 0.5) * 0.25;
        arr[i + 2] = oz + Math.sin(t * 15.0 + phase * 1.1) * 0.6
                        + Math.cos(t * 22.0 + phase * 0.6) * 0.4
                        + Math.sin(t * 30.0 + phase * 1.9) * 0.2;
      }
      pos.needsUpdate = true;
    }
  });

  const rotY = rotation * Math.PI / 2;
  return (
    <group position={[slotPos.x, slotPos.y, slotPos.z]} rotation={[0, rotY, 0]}>
      <primitive object={cloned} scale={PUMPJACK_SCALE} />
    </group>
  );
}

function AddonPlaceholder({ item, slotPos, rotation = 0 }) {
  const scale = 0.08;
  const y = slotPos.y + scale / 2;
  const color = item.color;
  const emissive = item.emissive ? item.color : "#000000";
  const emissiveIntensity = item.emissive ? 0.6 : 0;
  const rotY = rotation * Math.PI / 2;

  const mat = <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.6} metalness={0.1} />;

  switch (item.shape) {
    case "cone":
      return (
        <mesh position={[slotPos.x, y, slotPos.z]} rotation={[0, rotY, 0]}>
          <coneGeometry args={[scale * 0.5, scale, 6]} />
          {mat}
        </mesh>
      );
    case "cylinder":
      return (
        <mesh position={[slotPos.x, y, slotPos.z]} rotation={[0, rotY, 0]}>
          <cylinderGeometry args={[scale * 0.35, scale * 0.35, scale, 8]} />
          {mat}
        </mesh>
      );
    case "sphere":
      return (
        <mesh position={[slotPos.x, y, slotPos.z]} rotation={[0, rotY, 0]}>
          <sphereGeometry args={[scale * 0.5, 8, 6]} />
          {mat}
        </mesh>
      );
    case "cross":
      return (
        <group position={[slotPos.x, y, slotPos.z]} rotation={[0, rotY, 0]}>
          <mesh>
            <boxGeometry args={[scale * 0.15, scale, scale * 0.15]} />
            {mat}
          </mesh>
          <mesh position={[0, scale * 0.25, 0]}>
            <boxGeometry args={[scale * 0.6, scale * 0.15, scale * 0.15]} />
            {mat}
          </mesh>
        </group>
      );
    default: // "box"
      return (
        <mesh position={[slotPos.x, y, slotPos.z]} rotation={[0, rotY, 0]}>
          <boxGeometry args={[scale, scale * 0.6, scale]} />
          {mat}
        </mesh>
      );
  }
}

function PlotAddons({ addons }) {
  if (!addons || Object.keys(addons).length === 0) return null;

  return (
    <group>
      {Object.entries(addons).map(([slotKey, value]) => {
        const slotIdx = parseInt(slotKey, 10);
        const slot = ADDON_SLOTS[slotIdx];
        // Support both old string format and new { id, rot } format
        const itemId = typeof value === "string" ? value : value?.id;
        const rot = typeof value === "string" ? 0 : (value?.rot || 0);
        const item = ADDON_CATALOG.find((c) => c.id === itemId);
        if (!slot || !item) return null;
        if (item.animated === "tubeMan") {
          return <AddonTubeMan key={slotKey} item={item} slotPos={slot} rotation={rot} />;
        }
        if (item.animated && item.model) {
          return <AddonAnimatedGLB key={slotKey} item={item} slotPos={slot} rotation={rot} />;
        }
        if (item.model) {
          return <AddonGLB key={slotKey} item={item} slotPos={slot} rotation={rot} />;
        }
        return <AddonPlaceholder key={slotKey} item={item} slotPos={slot} rotation={rot} />;
      })}
    </group>
  );
}

// Preload addon GLBs
ADDON_CATALOG.forEach((item) => { if (item.model) useGLTF.preload(item.model); });

// Preload fence GLBs
FENCE_CATALOG.forEach((f) => { useGLTF.preload(f.model); });

// Preload poop GLB
useGLTF.preload("/models/poop.glb");

function PlotFence({ fenceType }) {
  const catalog = FENCE_CATALOG.find((f) => f.id === fenceType);
  const { scene } = useGLTF(catalog?.model || FENCE_CATALOG[0].model);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => () => disposeScene(cloned), [cloned]);
  if (!catalog) return null;
  return (
    <group scale={catalog.scale}>
      <primitive object={cloned} />
    </group>
  );
}

function PlotPoop() {
  const { scene } = useGLTF("/models/poop.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => () => disposeScene(cloned), [cloned]);
  return (
    <group position={[0.35, 0.01, 0.15]} scale={[0.1, 0.1, 0.1]}>
      <primitive object={cloned} />
    </group>
  );
}

function Pumpjack({ position, scene, animations, drillDay, maxDrillDay, depthCellSize, depositLayer = -1, highlighted, pumpConfig, envMap, oilStrike, drillEvent = 0, drillProximity = 0, tankFill, onClick, onDoubleClick, onTankDrain, envPreset, parabolum = false, forceStrikeGusher = false, gusherTrigger = 0, gusherActive = false, gusherLingering = false, gusherTier = "gusher", hasMessages = false, onEnvelopeClick, hellActive = false, worldW = 10, worldD = 10, cameraViewable = true, onFocusObject }) {
  const panelZoomedRef = useRef(false); // true once the panel has been zoomed in on
  const machinePanelRef = useRef();     // MachinePanel container node (for click-to-zoom)
  const lastClickTime = useRef(0);
  const groupRef = useRef();   // primitive (clonedScene)
  const shakeGroupRef = useRef(); // outer group for shake offset
  const strawRef = useRef();
  const strawBaseScaleZ = useRef(null);
  const strawBasePos = useRef(null);
  const strawLengthZ = useRef(null);
  const originalMatsRef = useRef({});

  // Wheel — click to spin on y-axis
  const wheelRef = useRef();
  const wheelTargetRotY = useRef(0);

  // Gauge needle + pressure labels
  const gaugeNeedleRef = useRef();
  const needleRestQuat = useRef(null); // needle's rest local quaternion (rotate from here)
  const needleAngle = useRef(0);       // current lerped sweep angle (radians, about local X)
  const textHighRef = useRef();
  const textMedRef = useRef();
  const textLowRef = useRef();
  const clonedScene = useMemo(() => {
    const s = scene.clone(true);
    // Swap all meshes to MeshStandardMaterial for proper lighting/depth
    s.traverse((child) => {
      if (child.isMesh && child.material) {
        const old = child.material;
        const std = new THREE.MeshStandardMaterial({
          color: old.color ? old.color.clone() : new THREE.Color(0xffffff),
          map: old.map || null,
          normalMap: old.normalMap || null,
          roughnessMap: old.roughnessMap || null,
          metalnessMap: old.metalnessMap || null,
          aoMap: old.aoMap || null,
          alphaMap: old.alphaMap || null,
          emissiveMap: old.emissiveMap || null,
          bumpMap: old.bumpMap || null,
          roughness: 0.35,
          metalness: 0.4,
          emissive: old.emissive ? old.emissive.clone() : new THREE.Color(0),
          emissiveIntensity: old.emissiveIntensity || 0,
          envMapIntensity: 1.0,
          side: old.side,
          transparent: old.transparent,
          opacity: old.opacity,
        });
        child.material = std;
        child.userData._pmpCloned = true;
      }
    });
    return s;
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);

  useEffect(() => () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(clonedScene);
    disposeScene(clonedScene);
  }, [clonedScene, mixer]);

  // Gusher spawn position — model origin (center of rig)
  const gusherOriginRef = useRef(new THREE.Vector3(0, 0.05, 0.2));

  // LED readout anchor. Prefer the dedicated PressurePanel2 screen mesh; fall back
  // to PressurePanel (the housing) if the model hasn't been re-exported yet.
  const controlBoxRef = useRef(null); // PressurePanel — now the pressure LED screen
  const panel2Ref = useRef(null);     // PressurePanel2 — the depth LED screen
  const [panelXform, setPanelXform] = useState(null);       // depth screen transform
  const [pressureXform, setPressureXform] = useState(null); // pressure screen transform
  const [pressure, setPressure] = useState({ label: "LOW", hex: "#33dd66" });
  const pressureLevelRef = useRef("LOW"); // debounces the level setState in useFrame

  // Find the Straw mesh, GaugeNeedle, and pressure text meshes
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.name === "Straw") {
        strawRef.current = child;
        if (strawBaseScaleZ.current === null) {
          strawBaseScaleZ.current = child.scale.z;
          strawBasePos.current = child.position.clone();
          child.geometry.computeBoundingBox();
          const bb = child.geometry.boundingBox;
          strawLengthZ.current = (bb.max.z - bb.min.z) * child.scale.z;
        }
      }
      // Head_Pump mesh — flip during gusher
      if (child.name === "Head_Pump") {
        headPumpRef.current = child;
      }
      // Body_Pump mesh — tilts back during gusher blowback
      if (child.name === "Body_Pump") {
        bodyPumpRef.current = child;
      }
      if (child.name.startsWith("Cylinder_Pump")) {
        if (!cylPumpRefs.current.includes(child)) {
          cylPumpRefs.current.push(child);
        }
      }
      // Wheel
      if (child.name === "Wheel") {
        wheelRef.current = child;
      }
      // Pressure-gauge needle. GaugeNeedle is the needle physically mounted on the
      // visible BoostGauge_01 face (they're co-located); BoostGauge_Needle is a stray
      // off to the side, so it's NOT the one to drive.
      if (child.name === "GaugeNeedle") {
        gaugeNeedleRef.current = child;
        needleRestQuat.current = child.quaternion.clone();
        // Red emissive glow. Clone the material first — the base is shared across the
        // rig atlas, so editing it in place would tint the whole pumpjack.
        if (child.material && !child.userData._needleGlow) {
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color("#ff2a1a");
          child.material.emissiveIntensity = 0.5;
          child.userData._needleGlow = true;
        }
      }
      // Dedicated LED screen mesh (preferred anchor for the live readout)
      if (child.name === "PressurePanel2") {
        panel2Ref.current = child;
        // Darken the screen so the amber LED reads. Clone first — the base material
        // is shared across the rig atlas, so editing it in place would tint the
        // whole pumpjack. applyPumpConfig skips this mesh (no zone), so it persists.
        if (child.material && !child.userData._screenDarkened) {
          const dm = child.material.clone();
          dm.map = null;
          dm.color.set("#06080c");
          dm.roughness = 1.0;
          dm.metalness = 0.0;
          if (dm.emissive) { dm.emissive.set("#06080c"); dm.emissiveIntensity = 0.15; }
          child.material = dm;
          child.userData._screenDarkened = true;
        }
      }
      // Pressure panel text meshes — find children of PressurePanel
      // Log names in dev to identify the correct mapping
      if (child.name === "PressurePanel") {
        controlBoxRef.current = child; // housing anchor for the live LED readout
        child.traverse((sub) => {
          if (sub === child) return;
          if (process.env.NODE_ENV === "development") {
          }
          if (sub.name === "Text_HIGH") { textHighRef.current = sub; sub.visible = false; }
          else if (sub.name === "Text_MED") { textMedRef.current = sub; sub.visible = false; }
          else if (sub.name === "Text_LOW") { textLowRef.current = sub; sub.visible = false; }
          // Fallback: if names are generic (Text, Text.001, Text.002), map by order
          // Text = LOW (bottom), Text.001 = MED (middle), Text.002 = HIGH (top)
          else if (sub.name === "Text" && sub.isMesh && !textLowRef.current) { textLowRef.current = sub; sub.visible = false; }
          else if (sub.name === "Text.002" && sub.isMesh && !textMedRef.current) { textMedRef.current = sub; sub.visible = false; }
          else if (sub.name === "Text.001" && sub.isMesh && !textHighRef.current) { textHighRef.current = sub; sub.visible = false; }
        });
      }
    });
    const group = shakeGroupRef.current;

    // Resolve a flat screen quad's transform into the rig group's local space:
    // position + orientation + size, so a drei <Text> lies exactly on it.
    const screenXform = (mesh) => {
      if (!mesh || !group) return null;
      group.updateWorldMatrix(true, false);
      mesh.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3();
      mesh.getWorldPosition(pos);
      group.worldToLocal(pos); // group is unscaled → local units match the overlay
      const wq = new THREE.Quaternion();
      mesh.getWorldQuaternion(wq);
      const gq = new THREE.Quaternion();
      group.getWorldQuaternion(gq);
      wq.premultiply(gq.invert()); // → group-local rotation
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      const ws = new THREE.Vector3();
      mesh.getWorldScale(ws);
      const dims = [
        (bb.max.x - bb.min.x) * ws.x,
        (bb.max.y - bb.min.y) * ws.y,
        (bb.max.z - bb.min.z) * ws.z,
      ].sort((a, b) => b - a); // [width, height, ~0]
      return {
        pos: [pos.x, pos.y, pos.z],
        quat: [wq.x, wq.y, wq.z, wq.w],
        w: dims[0], h: dims[1], fromMesh: true,
      };
    };

    // Depth screen: PressurePanel2 if exported, else the world-docked fallback.
    if (panel2Ref.current) {
      setPanelXform(screenXform(panel2Ref.current));
    } else if (controlBoxRef.current && group) {
      const pos = new THREE.Vector3();
      controlBoxRef.current.getWorldPosition(pos);
      group.worldToLocal(pos);
      setPanelXform({ pos: [pos.x, pos.y, pos.z], fromMesh: false });
    }
    // Pressure screen: the PressurePanel quad (now a code-rendered LED).
    if (controlBoxRef.current) setPressureXform(screenXform(controlBoxRef.current));

    // Darken both screens to the LED look (clone first — the base material is shared
    // across the rig atlas, so an in-place edit would tint the whole pumpjack).
    const darkenScreen = (mesh) => {
      if (!mesh?.material || mesh.userData._screenDark) return;
      const m = mesh.material.clone();
      m.map = null;
      m.color.set("#06080c");
      if (m.emissive) { m.emissive.set("#06080c"); m.emissiveIntensity = 0.15; }
      m.roughness = 1; m.metalness = 0;
      mesh.material = m;
      mesh.userData._screenDark = true;
    };
    darkenScreen(controlBoxRef.current); // PressurePanel screen
    // The baked LOW/MED/HIGH letter meshes are replaced by drei text — hide them.
    [textLowRef, textMedRef, textHighRef].forEach((r) => { if (r.current) r.current.visible = false; });
  }, [clonedScene]);

  useEffect(() => {
    const pumpActions = [];
    animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play();
      // Track the two armature animations that drive the pump head
      if (clip.name === "Armature|spin.001" || clip.name === "Armature.001|spin.001") {
        pumpActions.push(action);
      }
    });
    pumpActionsRef.current = pumpActions;
    return () => mixer.stopAllAction();
  }, [mixer, animations]);

  // Apply pump customization (paint colors). Runs for EVERY full rig, including
  // those that mount on-demand with no config (gusher/lingering cells never
  // selected): applyPumpConfig caches each part's original material on first
  // encounter, so it's safe to call with an empty originalMats — it captures, then
  // lays the Lyquid80 brand tint over the GLB's baked colors. The old guard skipped
  // this when originalMats was empty, leaving such rigs showing the import (yellow/
  // blue) materials. No re-call guard needed — _pmpCloned/_swappedStandard make it
  // idempotent.
  useEffect(() => {
    applyPumpConfig(clonedScene, pumpConfig || null, originalMatsRef.current, envMap);
  }, [clonedScene, pumpConfig, envMap]);

  // Embedded sign + camera retired — signs render from the SIGN_CATALOG (PlotSignField),
  // so force the rig's baked Sign/SignFrame/Security_Camera meshes hidden. (Harmless
  // no-op once the sign-less rig GLB is in place, where these meshes don't exist.)
  useEffect(() => {
    secCamPartsRef.current.forEach((part) => { part.visible = false; });
    signFramePartsRef.current.forEach((part) => { part.visible = false; });
    if (signRef.current) signRef.current.visible = false;
    if (signBackRef.current) signBackRef.current.visible = false;
  }, [pumpConfig?.showCamera, pumpConfig?.showSign]);

  // Fence visibility — hide the old embedded fence parts (now separate models)
  useEffect(() => {
    fencePartsRef.current.forEach((part) => { part.visible = false; });
  }, []);

  // Apply custom image to Sign mesh when URL changes
  // Uses onBeforeCompile to flip UVs on back face so text is legible from both sides
  // Gated on signMeshReady so the texture is (re)applied once the clonedScene
  // traversal has populated signRef — otherwise, when this rig mounts with the
  // URL already present (e.g. selecting an existing plot), this effect would run
  // before the traversal sets signRef, bail on the early return, and never re-run.
  const signImageUrl = pumpConfig?.signImageUrl || null;
  const [signMeshReady, setSignMeshReady] = useState(false);
  useEffect(() => {
    const sign = signRef.current;
    if (!sign) return;

    // Dispose previous materials before replacing
    const prevFront = sign.material;
    const prevBack = signBackRef.current?.material;

    if (signImageUrl) {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";
      loader.load(signImageUrl, (tex) => {
        if (signRef.current !== sign) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1;
        tex.offset.x = 1;

        // Apply to front sign
        const mat = sign.material.clone();
        mat.map = tex;
        mat.color = new THREE.Color(0xffffff);
        mat.emissive = new THREE.Color(0xffffff);
        mat.emissiveMap = tex;
        mat.emissiveIntensity = SIGN_EMISSIVE_INTENSITY;
        mat.transparent = false;
        mat.alphaTest = 0.5;
        mat.needsUpdate = true;
        if (prevFront && prevFront !== signOrigMat.current) prevFront.dispose();
        sign.material = mat;
        signTexMatRef.current = mat;

        // Apply to back sign
        const back = signBackRef.current;
        if (back) {
          if (prevBack && prevBack !== signBackOrigMat.current) prevBack.dispose();
          back.material = mat.clone();
          back.material.needsUpdate = true;
          signTexMatBackRef.current = back.material;
        }
      });
    } else if (signOrigMat.current) {
      // No custom image — stop the watchdog from forcing a texture back on.
      signTexMatRef.current = null;
      signTexMatBackRef.current = null;
      if (prevFront && prevFront !== signOrigMat.current) prevFront.dispose();
      sign.material = signOrigMat.current.clone();
      sign.material.needsUpdate = true;
      const back = signBackRef.current;
      if (back && signBackOrigMat.current) {
        if (prevBack && prevBack !== signBackOrigMat.current) prevBack.dispose();
        back.material = signBackOrigMat.current.clone();
        back.material.needsUpdate = true;
      }
    }
  }, [signImageUrl, signMeshReady]);

  // ── Fuel Tank liquid fill ──────────────────────────────────────────────────
  // Find the tank mesh and compute its group-local bounding box (after all GLB
  // hierarchy transforms but before the PUMPJACK_SCALE). We store this once and
  // render a cylinder in JSX that grows from the bottom up.
  const [tankBounds, setTankBounds] = useState(null);

  useEffect(() => {
    let tankMesh = null;
    clonedScene.traverse((child) => {
      if (child.name === "Fuel_Tank" && child.isMesh) tankMesh = child;
    });
    if (!tankMesh) return;

    // Render both sides so the tank stays visible at all camera angles, and make
    // the shell a translucent glass so the oil level inside is clearly visible
    // (it was near-opaque, washing out the fill — you could only tell oil was in
    // there as it drained).
    tankMesh.material.side = THREE.DoubleSide;
    tankMesh.material.transparent = true;
    tankMesh.material.opacity = 0.78;
    tankMesh.material.depthWrite = true;
    tankMesh.material.needsUpdate = true;

    // Compute bounding box in the clonedScene's local coordinate system
    // (accounts for all intermediate parent transforms in the GLB hierarchy)
    tankMesh.geometry.computeBoundingBox();
    const bb = tankMesh.geometry.boundingBox;
    const corners = [
      new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
      new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
      new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
      new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
      new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
      new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
      new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
      new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
    ];

    // Transform corners from mesh-local to clonedScene-local
    // (clonedScene is the root that <primitive> renders at PUMPJACK_SCALE)
    const meshToRoot = new THREE.Matrix4();
    let node = tankMesh;
    const chain = [];
    while (node && node !== clonedScene) {
      chain.push(node);
      node = node.parent;
    }
    // Build matrix from root → mesh (multiply in reverse)
    for (let i = chain.length - 1; i >= 0; i--) {
      const n = chain[i];
      const local = new THREE.Matrix4().compose(n.position, n.quaternion, n.scale);
      meshToRoot.multiply(local);
    }

    const worldMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const worldMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    corners.forEach((c) => {
      c.applyMatrix4(meshToRoot);
      worldMin.min(c);
      worldMax.max(c);
    });

    // Store bounds in clonedScene-local space (before PUMPJACK_SCALE)
    const sizeX = worldMax.x - worldMin.x;
    const sizeY = worldMax.y - worldMin.y;
    const sizeZ = worldMax.z - worldMin.z;

    // Determine which axis is the tank's long axis (the fill direction)
    // The tank lies on its side — the longest dimension is the fill axis
    let longAxis = "y";
    if (sizeZ > sizeY && sizeZ > sizeX) longAxis = "z";
    else if (sizeX > sizeY && sizeX > sizeZ) longAxis = "x";

    setTankBounds({
      cx: (worldMin.x + worldMax.x) / 2,
      cy: (worldMin.y + worldMax.y) / 2,
      cz: (worldMin.z + worldMax.z) / 2,
      minX: worldMin.x, maxX: worldMax.x,
      minY: worldMin.y, maxY: worldMax.y,
      minZ: worldMin.z, maxZ: worldMax.z,
      sizeX, sizeY, sizeZ,
      longAxis,
    });

  }, [clonedScene]);

  // Alert light ref for oil strike strobe
  const alertLightRef = useRef();
  const alertLightOrigColor = useRef(null);
  const panelLightRef = useRef();
  const panelLightOrigColor = useRef(null);
  const strikeTimerRef = useRef(0);
  const strikingRef = useRef(false);   // true during gusher overflow
  const strikeFlashRef = useRef(false); // true during timed oil-strike flash
  const strikeFlashTimer = useRef(0);
  const STRIKE_FLASH_DURATION = 4.0;
  const strikeLightRef = useRef(); // dynamic point light

  // Ground shake on oil strike
  const shakeRef = useRef(false);
  const shakeTimerRef = useRef(0);
  const SHAKE_DURATION = 4.0;

  // ── Staged drill reveal — delay oil strike visuals for suspense ────────────
  const STRIKE_REVEAL_DELAY = 10.0;
  const pendingStrikeRef = useRef(false);
  const pendingStrikeTimer = useRef(0);
  const drillMasterTimer = useRef(0);
  const drillActiveRef = useRef(false);
  const DRILL_TOTAL_DURATION = 18.0;

  // ── Drill effects (every drill, not just oil strikes) ──────────────────────
  // Drill rumble — lighter shake, separate from oil-strike shake
  const drillShakeRef = useRef(false);
  const drillShakeTimerRef = useRef(0);
  const DRILL_SHAKE_DURATION = 16.0;
  const DRILL_SHAKE_MAG = 0.002;

  // Dust burst particles
  const DUST_COUNT = 80;
  const dustActiveRef = useRef(false);
  const dustTimerRef = useRef(0);
  const dustPosRef = useRef(new Float32Array(DUST_COUNT * 3));
  const dustVelRef = useRef(new Float32Array(DUST_COUNT * 3));
  const dustLifeRef = useRef(new Float32Array(DUST_COUNT));
  const dustGeoRef = useRef();
  const dustMatRef = useRef();
  const DUST_DURATION = 14.0;

  // Gauge needle twitch on dry drill
  const drillGaugeTwitchRef = useRef(false);
  const drillGaugeTwitchTimer = useRef(0);
  const DRILL_GAUGE_TWITCH_DURATION = 16.0;

  // Near-miss amber proximity pulse
  const proximityFlashRef = useRef(false);
  const proximityTimerRef = useRef(0);
  const PROXIMITY_FLASH_DURATION = 14.0;
  const drillProximityRef = useRef(0);
  drillProximityRef.current = drillProximity;

  // RedButton drain — local fill override while draining/drained
  const drainingRef = useRef(false);  // actively animating down
  const drainedRef = useRef(false);   // finished draining, stay at 0
  const drainFillRef = useRef(0);
  const redButtonRef = useRef();
  const redButtonOrigColor = useRef(null); // original material, restored when the alarm clears
  const [tankDraining, setTankDraining] = useState(false);
  const onTankDrainRef = useRef(onTankDrain);
  onTankDrainRef.current = onTankDrain;

  // Gate slide
  const gateRef = useRef();
  const gateBasePos = useRef(null);
  const gateOpenRef = useRef(false);
  const gateTargetZ = useRef(0);

  // Sign mesh — custom image texture
  const signRef = useRef();
  const signBackRef = useRef();
  const signOrigMat = useRef(null);
  const signBackOrigMat = useRef(null);
  // Cached textured materials (front/back) once the custom image loads. The per-frame
  // watchdog reapplies these if some other material swap knocks them off the Sign mesh.
  const signTexMatRef = useRef(null);
  const signTexMatBackRef = useRef(null);
  const signFramePartsRef = useRef([]);
  const fencePartsRef = useRef([]);

  // Security camera sweep
  const secCamRef = useRef();
  const secCamPartsRef = useRef([]);
  const secCamBaseRotY = useRef(null);
  const envelopeRef = useRef();

  useEffect(() => {
    clonedScene.traverse((child) => {
      // RedButton — click to drain the tank; also pulses red when an alarm fires.
      if (child.name === "RedButton" && child.isMesh) {
        redButtonRef.current = child;
        if (!redButtonOrigColor.current && child.material) {
          redButtonOrigColor.current = {
            color: child.material.color.clone(),
            emissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0),
            emissiveIntensity: child.material.emissiveIntensity || 0,
          };
        }
        // Clone so the alarm strobe doesn't leak across the merged-rig instances.
        if (child.material && !child.userData._redButtonCloned) {
          child.material = child.material.clone();
          child.userData._redButtonCloned = true;
        }
      }
      // MachinePanel container (pre-order traverse visits the parent before its
      // children, so the first match is the top-level box, not a child gauge).
      if (!machinePanelRef.current && typeof child.name === "string" && child.name.startsWith("MachinePanel")) {
        machinePanelRef.current = child;
      }
      // Security camera — sweeping pivot + all camera parts
      if (child.name === "Security_Camera") {
        secCamRef.current = child;
        if (secCamBaseRotY.current === null) {
          secCamBaseRotY.current = child.rotation.y;
        }
      }
      if (child.name.startsWith("Security_Camera")) {
        if (!secCamPartsRef.current.includes(child)) {
          secCamPartsRef.current.push(child);
        }
        child.visible = false; // embedded camera retired — catalog renders it
      }
      // Sign — custom image texture (front + back)
      if (child.name === "Sign" && child.isMesh) {
        child.visible = false; // embedded sign retired — catalog renders it
        signRef.current = child;
        if (!signOrigMat.current) {
          signOrigMat.current = child.material.clone();
        }
        if (!child.userData._signCloned) {
          child.material = child.material.clone();
          child.userData._signCloned = true;
        }
      }
      if (child.name === "Sign_Back" && child.isMesh) {
        child.visible = false; // embedded sign retired — catalog renders it
        signBackRef.current = child;
        if (!signBackOrigMat.current) {
          signBackOrigMat.current = child.material.clone();
        }
        if (!child.userData._signCloned) {
          child.material = child.material.clone();
          child.userData._signCloned = true;
        }
      }
      // SignFrame and all children — hidden by default, double-sided
      if (child.name.startsWith("SignFrame")) {
        if (!signFramePartsRef.current.includes(child)) {
          signFramePartsRef.current.push(child);
        }
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.side = THREE.DoubleSide;
        }
        child.visible = false; // embedded sign frame retired — catalog renders it
      }
      // Fence_Package and all children — hidden by default
      if (child.name.startsWith("Fence_Package")) {
        if (!fencePartsRef.current.includes(child)) {
          fencePartsRef.current.push(child);
        }
        child.visible = false;
      }
      // Gate — click to slide open/closed (may be a Mesh or Group)
      if (child.name === "Gate") {
        gateRef.current = child;
        if (gateBasePos.current === null) {
          gateBasePos.current = child.position.clone();
          gateTargetZ.current = child.position.z;
        }
      }
      if (child.name === "Alert_Light_RED" && child.isMesh) {
        alertLightRef.current = child;
        if (!alertLightOrigColor.current) {
          alertLightOrigColor.current = {
            color: child.material.color.clone(),
            emissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0),
            emissiveIntensity: child.material.emissiveIntensity || 0,
          };
        }
        // Ensure material is cloned so we can modify it independently
        if (!child.userData._alertCloned) {
          child.material = child.material.clone();
          child.userData._alertCloned = true;
        }
      }
      if (child.name === "Panel_Light" && child.isMesh) {
        panelLightRef.current = child;
        if (!panelLightOrigColor.current) {
          panelLightOrigColor.current = {
            color: child.material.color.clone(),
            emissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0),
            emissiveIntensity: child.material.emissiveIntensity || 0,
          };
        }
        if (!child.userData._panelLightCloned) {
          child.material = child.material.clone();
          child.userData._panelLightCloned = true;
        }
      }
      // Envelope mesh — removed from the scene (messages handled in the panel)
      if (child.name === "Envelope") {
        child.visible = false;
      }
    });
    // Signal that signRef/signBackRef are now populated so the sign-image effect
    // (re)runs and applies the custom texture, even if the URL was already set at mount.
    setSignMeshReady(true);
  }, [clonedScene]);

  // Steam vent particles — triggered by wheel click
  const STEAM_COUNT = 200;
  const steamActiveRef = useRef(false);
  const steamTimerRef = useRef(0);
  const steamPosRef = useRef(new Float32Array(STEAM_COUNT * 3));
  const steamVelRef = useRef(new Float32Array(STEAM_COUNT * 3));
  const steamLifeRef = useRef(new Float32Array(STEAM_COUNT));
  const steamGeoRef = useRef();
  const steamMatRef = useRef();
  const steamOriginRef = useRef(new THREE.Vector3(0, 0, 0));
  const gaugePressureOffset = useRef(0); // subtracted from fill for gauge display

  const initSteam = useCallback(() => {
    // Get chimney top in group-local coords by subtracting group world pos from wheel world pos
    if (wheelRef.current && shakeGroupRef.current) {
      const wheelWorld = new THREE.Vector3();
      const groupWorld = new THREE.Vector3();
      wheelRef.current.getWorldPosition(wheelWorld);
      shakeGroupRef.current.getWorldPosition(groupWorld);
      // Local-to-group position of wheel, then offset up for chimney top
      const local = wheelWorld.sub(groupWorld);
      steamOriginRef.current.set(local.x, local.y + 0.01, local.z);
    }
    const pos = steamPosRef.current;
    const vel = steamVelRef.current;
    const life = steamLifeRef.current;
    const wp = steamOriginRef.current;
    for (let i = 0; i < STEAM_COUNT; i++) {
      const i3 = i * 3;
      pos[i3]     = wp.x + (Math.random() - 0.5) * 0.02;
      pos[i3 + 1] = wp.y;
      pos[i3 + 2] = wp.z + (Math.random() - 0.5) * 0.02;
      // Upward with slight drift
      vel[i3]     = (Math.random() - 0.5) * 0.3;
      vel[i3 + 1] = 0.8 + Math.random() * 1.2;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.3;
      life[i] = -(i / STEAM_COUNT) * 0.3; // stagger spawns
    }
    steamActiveRef.current = true;
    steamTimerRef.current = 0;
    if (steamGeoRef.current) {
      steamGeoRef.current.attributes.position.needsUpdate = true;
    }
  }, []);

  // Pump head pause during gusher — tilt the horsehead up and out of the blast
  const pumpActionsRef = useRef([]);  // animation actions for the pump armatures
  const pumpPausedRef = useRef(false);
  const headPumpRef = useRef(null);       // Head_Pump mesh
  const headOrigParentRef = useRef(null); // Head_Pump's real armature parent (restored after gusher)
  const headRestQuatRef = useRef(null);   // head's local quaternion right after attach (extra pitch builds from here)
  const headPumpOrigMat = useRef(null);  // original material before oil stain
  const cylPumpRefs = useRef([]);        // Cylinder_Pump meshes
  const bodyPumpRef = useRef(null);       // Body_Pump mesh (Samson post / body)
  const bodyPumpBaseRotX = useRef(null);
  const blowbackRef = useRef(0);          // 0..1 eased gusher blowback amount
  const oilStainedParts = useRef([]);    // all parts to stain/restore

  // Oil geyser shader — only active on highlighted rig
  const gusherActiveRef = useRef(false);
  const gusherTimerRef = useRef(0);
  // Step 2 — the visual tier (strike|gusher|motherlode) of the current eruption.
  // Captured at initGusher time so the per-frame geyser/spill/blowback scaling
  // reads a stable value for the whole run. Mirror the prop for the broadcast path.
  const gusherTierPropRef = useRef(gusherTier);
  gusherTierPropRef.current = gusherTier;
  const gusherTierRef = useRef("gusher");
  const geyserMeshRef = useRef();
  const geyserMatRef = useRef();
  const _camPos = useRef(new THREE.Vector3());
  const _meshPos = useRef(new THREE.Vector3());
  const geyserUniforms = useRef({
    uTime: { value: 0 },
    uOpacity: { value: 1.0 },
    uNightMode: { value: 0.0 },
    uParabolum: { value: 0.0 },
    uHell: { value: 0.0 },
    uTint: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(256, 512) },
  });

  // Strike "sputter" fountain — the ballistic-droplet primitive used for the
  // strike tier instead of the geyser column (see _sputterFragmentShader). A
  // separate billboard plane; only one of {geyser column, sputter fountain} is
  // visible per eruption, chosen by tier.
  const sputterMeshRef = useRef();
  const sputterMatRef = useRef();
  const sputterUniforms = useRef({
    uTime: { value: 0 },
    uOpacity: { value: 1.0 },
    uNightMode: { value: 0.0 },
  });
  // The fountain runs continuously, so re-kick the real dust/rock particles on a
  // cycle (they fire once otherwise) — keeps the weak well spitting actual rock
  // chips at the base alongside the liquid spray. Counts down in the gusher loop.
  const sputterDustTimerRef = useRef(0);

  // Underground feeder jet — narrow column from the struck deposit up to the
  // wellhead, so the gusher originates from the cell that holds the oil.
  const feederMeshRef = useRef();
  const feederMatRef = useRef();
  const feederUniforms = useRef({
    uTime: { value: 0 },
    uOpacity: { value: 1.0 },
    uHell: { value: 0.0 },
  });

  // Oil spill / splatter decal on the ground around the wellhead
  const spillMeshRef = useRef();
  const spillMatRef = useRef();
  const spillUniforms = useRef({
    uOpacity: { value: 0.0 },
    uGrow: { value: 0.0 },
    uNightMode: { value: 0.0 },
    uParabolum: { value: 0.0 },
    uHell: { value: 0.0 },
    // Playfield clip so perimeter-rig puddles don't spill off the mesa edge.
    uClipCenter: { value: new THREE.Vector2(0, 0) }, // plane center in grid space (x,z)
    uFieldHalf: { value: new THREE.Vector2(5, 5) },  // playfield half-extents (x,z)
    uPlaneHalf: { value: 0.9 },                      // half the spill plane size (1.8/2)
  });

  // True while the active gusher is a hell eruption (demon unleash) rather than a
  // normal oil/parabolum overflow — drives the fiery shader tint + fireball burst.
  const gusherHellRef = useRef(false);
  const hellBurstRef = useRef();
  const hellBurstMatRef = useRef();
  const hellBurstLightRef = useRef();
  const hellBurstTimerRef = useRef(0);

  // Per-run gusher length. Defaults to GUSHER_DURATION; the admin Test Gusher passes
  // a longer value so it stays on screen long enough to grab a screenshot.
  const gusherDurationRef = useRef(GUSHER_DURATION);

  const initGusher = useCallback((hell = false, tier = null, durationOverride = null) => {
    // Resolve the visual tier: explicit arg wins (hell/admin), else the broadcast
    // prop (gusherEvents.tier for this cell), else baseline. Hell eruptions read as
    // a big fire column, so they ride the motherlode size.
    const t = hell ? "motherlode" : (tier || gusherTierPropRef.current || "gusher");
    gusherTierRef.current = t;
    const vis = tierVis(t);
    // Strike tier renders as the droplet fountain (separate mesh) unless the A/B
    // toggle forces the scaled-column fallback. Only one primitive shows.
    const fountain = vis.sputter && STRIKE_FOUNTAIN;
    gusherActiveRef.current = true;
    gusherTimerRef.current = 0;
    gusherDurationRef.current = durationOverride ?? vis.duration;
    gusherHellRef.current = hell;
    hellBurstTimerRef.current = 0;
    // Rock/dust kick-up fires on EVERY eruption (not just the highlighted rig's
    // drill), scaled by tier — this is what makes admin FORCE-STRIKE and remote
    // gushers show the ground kick too. initDust is defined below; the closure
    // reads its stable ref at call time.
    initDust(vis.dust);
    // Fountain re-kicks dust on a ~5.5s cycle. Stagger the first interval per rig
    // (hashed from world position) so simultaneous strikes don't throw rock in
    // lockstep — the period is shared, so a one-time offset keeps them desynced.
    const dph = Math.sin(position[0] * 45.233 + position[2] * 91.187) * 24634.6345;
    sputterDustTimerRef.current = 3.0 + (dph - Math.floor(dph)) * 2.5; // 3.0..5.5s
    // Seed the geyser column + spill scale immediately so the first frame already
    // reflects the tier (the per-frame loop keeps them in sync afterward).
    if (geyserMeshRef.current) {
      geyserMeshRef.current.scale.set(vis.width, vis.height, 1);
      geyserMeshRef.current.position.y = gusherOriginRef.current.y - 0.5 + 1.5 * vis.height;
    }
    if (spillMeshRef.current) spillMeshRef.current.scale.set(vis.spill, vis.spill, 1);
    if (geyserMatRef.current) {
      geyserMatRef.current.uniforms.uTime.value = 0;
      geyserMatRef.current.uniforms.uOpacity.value = 1.0;
    }
    // The geyser column + underground feeder drive sustained gushers (and the
    // column-fallback sputter); the droplet fountain drives the strike tier.
    if (geyserMeshRef.current) geyserMeshRef.current.visible = !fountain;
    if (feederMatRef.current) {
      feederMatRef.current.uniforms.uTime.value = 0;
      feederMatRef.current.uniforms.uOpacity.value = 1.0;
    }
    if (feederMeshRef.current) feederMeshRef.current.visible = !fountain;
    if (sputterMatRef.current) {
      // Per-rig phase offset so simultaneous strikes don't sputter in lockstep:
      // seed the fountain's time so each well starts at a different point in its
      // droplet cycle (CYCLE = 1.94152 in _sputterFragmentShader). Stable per rig
      // (hashed from world position), so it's the same offset every eruption.
      const ph = Math.sin(position[0] * 12.9898 + position[2] * 78.233) * 43758.5453;
      sputterMatRef.current.uniforms.uTime.value = (ph - Math.floor(ph)) * 1.94152;
      sputterMatRef.current.uniforms.uOpacity.value = 1.0;
    }
    if (sputterMeshRef.current) sputterMeshRef.current.visible = fountain;
    // Hell eruption (demon unleash) is pure fire — no oil puddle on the ground.
    if (spillMeshRef.current) {
      spillMeshRef.current.visible = !hell;
    }
    if (spillMatRef.current) {
      spillMatRef.current.uniforms.uOpacity.value = 0.0;
      spillMatRef.current.uniforms.uGrow.value = 0.0;
    }
    // Pause pump animation and tilt horsehead up out of the gusher blast — but
    // ONLY for sustained gushers. A small strike (sputter) keeps the pump working
    // normally; its weak spurts play over the running rig, no dramatic tilt/stain.
    if (!vis.sputter && !pumpPausedRef.current) {
      // Seek all actions to frame 103/110 (pump head at highest) and pause
      pumpActionsRef.current.forEach((action) => {
        const clip = action.getClip();
        action.time = clip.duration * (103 / 110);
        action.paused = true;
      });
      // Force one mixer update to apply the seek position
      mixer.update(0);
      // Capture Body_Pump rest rotation; the per-frame blowback drives it from here.
      if (bodyPumpRef.current && bodyPumpBaseRotX.current === null) {
        bodyPumpBaseRotX.current = bodyPumpRef.current.rotation.x;
      }
      // Head_Pump is in a separate armature, so it won't follow the body on its own.
      // Reparent it under Body_Pump (.attach preserves world transform) for the gusher
      // so the horsehead rides the blowback as one rigid unit; reparented back on end.
      if (headPumpRef.current && bodyPumpRef.current && !headOrigParentRef.current) {
        headOrigParentRef.current = headPumpRef.current.parent;
        bodyPumpRef.current.attach(headPumpRef.current);
        // Local pose under the body at rest — the per-frame extra pitch builds from here.
        headRestQuatRef.current = headPumpRef.current.quaternion.clone();
      }
      blowbackRef.current = 0;
      // Save original colors for restore (head is intentionally excluded — it stays clean)
      oilStainedParts.current = [strawRef.current, ...cylPumpRefs.current].filter(Boolean);
      oilStainedParts.current.forEach((m) => {
        if (m.material && !m.userData._origColor) {
          m.userData._origColor = m.material.color.clone();
        }
        // Hide Straw + Cylinder_Pump for the duration of the eruption — the gusher
        // column occupies the wellhead, so the pump straw/cylinders read as clutter.
        m.visible = false;
      });
      pumpPausedRef.current = true;
    }
  }, []);

  // Buffer oil strike visuals — delay reveal for suspense during drill sequence.
  // Edge-triggered on a NEW strike value so selecting/zooming to a rig (or a fresh
  // mount carrying a stale value) doesn't replay the geyser.
  const prevStrike = useRef(oilStrike);
  useEffect(() => {
    if (oilStrike > 0 && oilStrike !== prevStrike.current && highlighted) {
      pendingStrikeRef.current = true;
      pendingStrikeTimer.current = 0;
    }
    prevStrike.current = oilStrike;
  }, [oilStrike, highlighted]);

  // Mirror forceStrikeGusher into a ref so the empty-dep callbacks below read the
  // latest value without being recreated every render.
  const forceStrikeGusherRef = useRef(forceStrikeGusher);
  forceStrikeGusherRef.current = forceStrikeGusher;

  // Reveal the buffered oil strike after the suspense delay
  const revealStrike = useCallback(() => {
    strikeFlashRef.current = true;
    strikeFlashTimer.current = 0;
    shakeRef.current = true;
    shakeTimerRef.current = 0;
    drainedRef.current = false;
    drainingRef.current = false;
    setTankDraining(false);
    pendingStrikeRef.current = false;
    // Demo/preview modes (admin/report/test): also fire the full geyser on every
    // strike so the 3D oil-release effect is visible. Live play reserves the
    // geyser for tank overflow, so this stays gated behind forceStrikeGusher.
    if (forceStrikeGusherRef.current) {
      initGusher();
    }
  }, [initGusher]);

  // Admin "TEST GUSHER" button — fire the full geyser directly on the highlighted
  // rig whenever the trigger counter increments. Bypasses the strike/buffer chain
  // so it works regardless of drill depth or oil data. Baseline to the incoming
  // value (refs persist across the merge-mode remount) so we only fire on a real
  // increment, never on mount.
  const prevGusherTrigger = useRef(gusherTrigger);
  useEffect(() => {
    if (gusherTrigger > 0 && gusherTrigger !== prevGusherTrigger.current && highlighted) {
      revealStrike();
      // Admin Test Gusher: run 3s longer than a normal strike so it's easy to screenshot.
      initGusher(false, "gusher", GUSHER_DURATION + 3);
    }
    prevGusherTrigger.current = gusherTrigger;
  }, [gusherTrigger, highlighted, revealStrike, initGusher]);

  // Trigger gusher particles only when tank overflows (fill >= 1.0)
  const wasOverflowing = useRef(false);
  useEffect(() => {
    if (tankFill >= 1.0 && highlighted && !wasOverflowing.current) {
      wasOverflowing.current = true;
      strikingRef.current = true;
      strikeTimerRef.current = 0;
      initGusher();
    } else if (tankFill < 1.0) {
      wasOverflowing.current = false;
    }
  }, [tankFill, highlighted, initGusher]);

  // Hell unleash — when the demon erupts from this rig's well, blow the rig parts
  // back and fire a fiery gusher + fireball burst. Edge-triggered on hellActive
  // false→true. Initialized to the current value so a mid-event remount (or a
  // returning player loading with the demon already loose) doesn't replay it.
  const prevHellActive = useRef(hellActive);
  useEffect(() => {
    if (hellActive && !prevHellActive.current) {
      initGusher(true);            // fiery tint + blowback + fireball
      strikingRef.current = true;  // continuous red alert-light strobe
      strikeTimerRef.current = 0;
    } else if (!hellActive && prevHellActive.current) {
      // Demon banished — release the held gusher into its final 1s fade so the rig
      // settles back smoothly instead of snapping (the timer was pinned while held).
      // Relative to the run's own duration (hell rides the longer motherlode length).
      if (gusherActiveRef.current && gusherHellRef.current) {
        gusherTimerRef.current = gusherDurationRef.current - 1.0;
      }
    }
    prevHellActive.current = hellActive;
  }, [hellActive, initGusher]);

  // Broadcast gusher — an active gusherEvents doc for THIS rig's cell (a real
  // strike, another player's, or a test gusher). Drives the same coupled geyser
  // as the owner's own strike (pump pause + blowback) so every viewer sees a live
  // erupting rig, not a detached column. Sustained until the event clears (the
  // owner drains their tank); released into the final 1s fade like the hell path.
  const gusherActivePropRef = useRef(false);
  // Starts false (not `gusherActive`) so a rig that mounts with a gusher already
  // live — it only mounts because its cell is gushing — erupts on first render.
  const prevGusherActive = useRef(false);
  useEffect(() => {
    gusherActivePropRef.current = gusherActive;
    if (gusherActive && !prevGusherActive.current) {
      if (!gusherActiveRef.current) initGusher();
    } else if (!gusherActive && prevGusherActive.current) {
      // Event cleared (banked / shut off) → release into the final 1s fade.
      // Relative to this run's duration; a sputtering strike loops past its
      // duration while live, so reset the timer into the taper window to end it.
      if (gusherActiveRef.current && !gusherHellRef.current) {
        gusherTimerRef.current = gusherDurationRef.current - 1.0;
      }
    }
    prevGusherActive.current = gusherActive;
  }, [gusherActive, initGusher]);

  // Trigger drill effects on every drill event (highlighted rig only)
  const initDust = useCallback((intensity = 1) => {
    const pos = dustPosRef.current;
    const vel = dustVelRef.current;
    const life = dustLifeRef.current;
    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3;
      // Spawn from rig base
      pos[i3]     = (Math.random() - 0.5) * 0.1;
      pos[i3 + 1] = 0.02;
      pos[i3 + 2] = (Math.random() - 0.5) * 0.1;
      // Burst outward + upward with random velocity. Tier intensity scales the
      // kick so a seep barely puffs while a motherlode throws rock harder; the
      // particle count (buffer size) stays fixed for a stable mobile GPU budget.
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.22 + Math.random() * 0.5) * intensity;
      vel[i3]     = Math.cos(angle) * speed;
      vel[i3 + 1] = (0.4 + Math.random() * 0.8) * intensity;
      vel[i3 + 2] = Math.sin(angle) * speed;
      life[i] = -(i / DUST_COUNT) * 0.15; // stagger spawns
    }
    dustActiveRef.current = true;
    dustTimerRef.current = 0;
    if (dustGeoRef.current) {
      dustGeoRef.current.attributes.position.needsUpdate = true;
    }
  }, []);

  // Baseline to the current drillEvent: in merge mode the selected rig mounts
  // fresh on every selection, so starting at 0 would replay the drill burst when
  // the prop is already > 0. We only want a burst on a genuine NEW drill.
  const prevDrillEvent = useRef(drillEvent);
  const dustWaveCount = useRef(0);
  useEffect(() => {
    if (drillEvent > 0 && drillEvent !== prevDrillEvent.current && highlighted) {
      prevDrillEvent.current = drillEvent;
      // Start master drill timer
      drillActiveRef.current = true;
      drillMasterTimer.current = 0;
      dustWaveCount.current = 0;
      // 1. Drill rumble — reserve the shudder for something momentous: on, or one
      //    cell away from, a deposit (oilStrike / drillProximity), or while a demon
      //    is loose. Plain barren drilling still spits dust (drillActiveRef below)
      //    but doesn't shake.
      if (oilStrike > 0 || drillProximity > 0 || hellActive) {
        drillShakeRef.current = true;
        drillShakeTimerRef.current = 0;
      }
      // 2. Initial dust burst
      initDust();
      // 3. Gauge twitch (every drill now — builds suspense)
      drillGaugeTwitchRef.current = true;
      drillGaugeTwitchTimer.current = 0;
      // 4. Amber proximity pulse (near-miss)
      if (drillProximity > 0 && oilStrike === 0) {
        proximityFlashRef.current = true;
        proximityTimerRef.current = 0;
      }
    }
  }, [drillEvent, highlighted, oilStrike, drillProximity, hellActive, initDust]);

  // Store drillDay and tankFill in refs so useFrame always has the latest values
  const drillDayRef = useRef(drillDay);
  drillDayRef.current = drillDay;
  const depthCellRef = useRef(depthCellSize);
  depthCellRef.current = depthCellSize;
  const depositLayerRef = useRef(depositLayer);
  depositLayerRef.current = depositLayer;
  const tankFillRef = useRef(tankFill);
  tankFillRef.current = tankFill;
  const pumpConfigRef = useRef(pumpConfig);
  pumpConfigRef.current = pumpConfig;
  const hellActiveRef = useRef(hellActive);
  hellActiveRef.current = hellActive;
  const highlightedRef = useRef(highlighted);
  highlightedRef.current = highlighted;
  const hasMessagesRef = useRef(hasMessages);
  hasMessagesRef.current = hasMessages;
  const frameSkip = useRef(Math.floor(Math.random() * 3)); // stagger so not all idle rigs spike on same frame
  useFrame(({ clock }, delta) => {
    // Sign-image self-heal: if a custom image is loaded but some other material swap
    // (paint config, env/theme change, gusher staining, remount) has knocked it off the
    // Sign mesh, put the cached textured material back. Cheap ref compares; no-op normally.
    if (signTexMatRef.current && signRef.current && signRef.current.material !== signTexMatRef.current) {
      signRef.current.material = signTexMatRef.current;
      if (signBackRef.current && signTexMatBackRef.current && signBackRef.current.material !== signTexMatBackRef.current) {
        signBackRef.current.material = signTexMatBackRef.current;
      }
    }

    // Non-highlighted pumpjacks: throttle animation to every 3rd frame, skip all
    // interactive logic. EXCEPTION: the rig the demon erupts from (hellActive) runs
    // the full path so its blowback + fiery gusher play for every viewer, not just
    // whoever happens to have it selected. Also keep running while ANY gusher is
    // still active so the settle/restore completes after hellActive flips off (else
    // a non-highlighted rig would freeze mid-blowback and never restore the pump).
    if (!highlightedRef.current && !hellActiveRef.current && !gusherActiveRef.current) {
      frameSkip.current = (frameSkip.current + 1) % 3;
      if (!NO_ANIM && frameSkip.current === 0) mixer.update(delta * 3);
      return;
    }
    if (!pumpPausedRef.current && !NO_ANIM) {
      mixer.update(delta);
    }

    // Wheel — lerp toward target rotation on y-axis
    const wheel = wheelRef.current;
    if (wheel) {
      const diff = wheelTargetRotY.current - wheel.rotation.y;
      if (Math.abs(diff) > 0.001) {
        wheel.rotation.y += diff * Math.min(delta * 5, 1);
      } else {
        wheel.rotation.y = wheelTargetRotY.current;
      }
    }

    // Drain logic — when draining, decrease local fill and stop gusher
    if (drainingRef.current) {
      drainFillRef.current = Math.max(0, drainFillRef.current - delta * 0.25);
      if (drainFillRef.current <= 0) {
        drainingRef.current = false;
        drainedRef.current = true;  // lock at 0, keep tankDraining true
        onTankDrainRef.current?.();
      }
    }

    // Gauge needle rotation — 0→225° based on tankFill, capped at 225°
    const needle = gaugeNeedleRef.current;
    const currentFill = (drainingRef.current || drainedRef.current) ? drainFillRef.current : tankFillRef.current;

    const straw = strawRef.current;
    if (straw && strawBaseScaleZ.current !== null) {
      const day = drillDayRef.current;
      const L0 = strawLengthZ.current;
      const baseScale = strawBaseScaleZ.current;

      // Pin straw position every frame so bone animation can't drift it
      straw.position.copy(strawBasePos.current);

      if (day > 0) {
        const worldDepthPerDay = depthCellRef.current;
        const modelDepthPerDay = worldDepthPerDay / PUMPJACK_SCALE;
        const s = 1 + (day * modelDepthPerDay) / L0;
        straw.scale.z = baseScale * s;
      } else {
        straw.scale.z = baseScale;
      }
    }
    if (needle && needleRestQuat.current) {
      const hellOverride = hellActiveRef.current;
      const fill = hellOverride ? 1.0 : Math.max(0, Math.min(currentFill, 1.0) - gaugePressureOffset.current);
      // Sweep the needle about its LOCAL X axis from its rest pose, exactly like the
      // Blender setup (full tank → 120° about local X). Applied as a quaternion in the
      // needle's local frame — the rest pose isn't identity in three.js (it counteracts
      // the rotated MachinePanel parent), so a plain Euler set would skew/foreshorten.
      const targetAngle = fill * NEEDLE_FULL_SWEEP;
      const lerpSpeed = hellOverride ? 8 : 3;
      needleAngle.current += (targetAngle - needleAngle.current) * Math.min(delta * lerpSpeed, 1);
      // Shudder: a fast jitter that grows with pressure (still at empty, trembling at
      // full). A smooth high-freq wobble plus a touch of per-frame randomness. Added
      // only to the displayed angle, not needleAngle, so the HIGH/MED/LOW label is stable.
      const pressure = Math.max(0, needleAngle.current / NEEDLE_FULL_SWEEP);
      const shudder = pressure * (0.05 * Math.sin(performance.now() * 0.05) + 0.3 * (Math.random() - 0.5));
      _needleQuat.setFromAxisAngle(_NEEDLE_AXIS, needleAngle.current + shudder);
      needle.quaternion.copy(needleRestQuat.current).multiply(_needleQuat);
      // Red glow brightens with pressure (caps at 1.4).
      if (needle.material) needle.material.emissiveIntensity = 0.4 + pressure * 1.0;

      // Pressure level — based on the needle's lerped angle (not raw fill). Drives the
      // code-rendered LED label; setState only when the level actually changes.
      const displayAngleDeg = Math.abs(needleAngle.current) * (180 / Math.PI);
      const level = hellOverride || displayAngleDeg >= 110 ? "HIGH"
        : displayAngleDeg >= 45 ? "MED" : "LOW";
      if (level !== pressureLevelRef.current) {
        pressureLevelRef.current = level;
        const hex = level === "HIGH" ? "#ff3a2a" : level === "MED" ? "#ffae00" : "#33dd66";
        setPressure({ label: level, hex });
      }
    }

    // Alert light strobe — two modes:
    // 1. Timed flash on oil strike (strikeFlashRef, decays over STRIKE_FLASH_DURATION)
    // 2. Continuous flash during gusher overflow (strikingRef, tied to gusherActiveRef)
    const light = alertLightRef.current;
    const flashActive = strikeFlashRef.current || strikingRef.current;

    if (light && flashActive) {
      let intensity = 0;

      // Timed oil-strike flash
      if (strikeFlashRef.current) {
        strikeFlashTimer.current += delta;
        const t = strikeFlashTimer.current;
        if (t < STRIKE_FLASH_DURATION) {
          const pulse = Math.sin(t * 25) > 0 ? 1 : 0;
          const decay = 1 - t / STRIKE_FLASH_DURATION;
          intensity = Math.max(intensity, pulse * decay);
        } else {
          strikeFlashRef.current = false;
        }
      }

      // Continuous gusher overflow flash
      if (strikingRef.current) {
        strikeTimerRef.current += delta;
        if (gusherActiveRef.current) {
          const pulse = Math.sin(strikeTimerRef.current * 25) > 0 ? 1 : 0;
          intensity = Math.max(intensity, pulse);
        } else {
          strikingRef.current = false;
        }
      }

      // Apply to light material (color/emissive are uniforms — no needsUpdate required)
      if (strikeFlashRef.current || strikingRef.current) {
        light.material.emissive.set(0xff0000);
        light.material.emissiveIntensity = intensity * 5.0;
        light.material.color.set(intensity > 0.1 ? 0xff2200 : 0x331111);
        if (strikeLightRef.current) {
          strikeLightRef.current.intensity = intensity * 4.0;
        }
        // Panel_Light — same red strobe
        const pl = panelLightRef.current;
        if (pl) {
          pl.material.emissive.set(0xff0000);
          pl.material.emissiveIntensity = intensity * 5.0;
          pl.material.color.set(intensity > 0.1 ? 0xff2200 : 0x331111);
        }
        // RedButton — pulse emissive red in time with the alarm beacon.
        const rb = redButtonRef.current;
        if (rb?.material?.emissive) {
          rb.material.emissive.set(0xff0000);
          rb.material.emissiveIntensity = intensity * 4.0;
        }
      } else {
        // Both modes done — restore original
        const orig = alertLightOrigColor.current;
        if (orig) {
          light.material.color.copy(orig.color);
          light.material.emissive.copy(orig.emissive);
          light.material.emissiveIntensity = orig.emissiveIntensity;
        }
        if (strikeLightRef.current) {
          strikeLightRef.current.intensity = 0;
        }
        // Panel_Light — restore original
        const plOrig = panelLightOrigColor.current;
        const pl = panelLightRef.current;
        if (pl && plOrig) {
          pl.material.color.copy(plOrig.color);
          pl.material.emissive.copy(plOrig.emissive);
          pl.material.emissiveIntensity = plOrig.emissiveIntensity;
        }
        // RedButton — restore original
        const rb = redButtonRef.current;
        const rbOrig = redButtonOrigColor.current;
        if (rb?.material?.emissive && rbOrig) {
          rb.material.color.copy(rbOrig.color);
          rb.material.emissive.copy(rbOrig.emissive);
          rb.material.emissiveIntensity = rbOrig.emissiveIntensity;
        }
      }
    }

    // Hell: wash the control-box screens red so the whole panel reads as alarm —
    // the readout text strobes (PanelReadout), the screens glow a steadier red
    // beneath it. Restores to the dark LED look when the event clears.
    const hellNow = hellActiveRef.current;
    [controlBoxRef.current, panel2Ref.current].forEach((scr) => {
      const m = scr?.material;
      if (!m?.emissive || !scr.userData._screenDark) return;
      if (hellNow) {
        const g = 0.45 + 0.35 * Math.sin(performance.now() * 0.012); // slow red pulse
        m.emissive.setRGB(g, 0.03, 0.0);
        m.emissiveIntensity = 1.0;
        m.color.set("#1a0402");
        scr.userData._screenHell = true;
      } else if (scr.userData._screenHell) {
        m.emissive.set("#06080c");
        m.emissiveIntensity = 0.15;
        m.color.set("#06080c");
        scr.userData._screenHell = false;
      }
    });

    // Ground shake on oil strike — offset the outer group
    const shakeGroup = shakeGroupRef.current;
    if (shakeGroup && shakeRef.current) {
      shakeTimerRef.current += delta;
      const t = shakeTimerRef.current;
      if (t < SHAKE_DURATION) {
        const decay = 1 - t / SHAKE_DURATION;
        const magnitude = decay * 0.004;
        shakeGroup.position.x = position[0] + (Math.random() - 0.5) * 2 * magnitude;
        shakeGroup.position.y = position[1] + (Math.random() - 0.5) * 2 * magnitude;
        shakeGroup.position.z = position[2] + (Math.random() - 0.5) * 2 * magnitude;
      } else {
        shakeGroup.position.set(position[0], position[1], position[2]);
        shakeRef.current = false;
      }
    }

    // ── Staged drill master timer — controls phases and delayed reveal ──
    if (drillActiveRef.current) {
      drillMasterTimer.current += delta;
      const mt = drillMasterTimer.current;

      // Spawn additional dust waves during boring phase (every ~3 seconds)
      const waveInterval = 3.0;
      const expectedWaves = Math.floor(mt / waveInterval);
      if (expectedWaves > dustWaveCount.current && mt < STRIKE_REVEAL_DELAY) {
        dustWaveCount.current = expectedWaves;
        initDust();
      }

      // Reveal buffered oil strike after delay. Demo/preview modes use a short
      // delay so the geyser actually fires during the fast admin drill sequence
      // (the 10s live-play suspense would never complete between 1s/step plays).
      if (pendingStrikeRef.current) {
        pendingStrikeTimer.current += delta;
        const revealDelay = forceStrikeGusherRef.current ? 0.4 : STRIKE_REVEAL_DELAY;
        if (pendingStrikeTimer.current >= revealDelay) {
          revealStrike();
        }
      }

      // End master timer
      if (mt >= DRILL_TOTAL_DURATION) {
        drillActiveRef.current = false;
      }
    }

    // ── Drill rumble — lighter shake, coexists with oil-strike shake ──
    if (shakeGroup && drillShakeRef.current) {
      drillShakeTimerRef.current += delta;
      const dt = drillShakeTimerRef.current;
      if (dt < DRILL_SHAKE_DURATION) {
        // Phased intensity: ramp up during boring, peak near reveal, decay after
        const revealT = STRIKE_REVEAL_DELAY;
        let intensity;
        if (dt < revealT * 0.3) {
          intensity = 0.3 + 0.7 * (dt / (revealT * 0.3));
        } else if (dt < revealT) {
          intensity = 1.0 + 0.5 * ((dt - revealT * 0.3) / (revealT * 0.7));
        } else {
          intensity = 1.5 * Math.max(0, 1 - (dt - revealT) / (DRILL_SHAKE_DURATION - revealT));
        }
        const mag = intensity * DRILL_SHAKE_MAG;
        if (!shakeRef.current) {
          shakeGroup.position.x = position[0] + (Math.random() - 0.5) * 2 * mag;
          shakeGroup.position.y = position[1] + (Math.random() - 0.5) * 2 * mag;
          shakeGroup.position.z = position[2] + (Math.random() - 0.5) * 2 * mag;
        }
      } else {
        drillShakeRef.current = false;
        if (!shakeRef.current) {
          shakeGroup.position.set(position[0], position[1], position[2]);
        }
      }
    }

    // ── Dust burst particles ──
    if (dustActiveRef.current) {
      dustTimerRef.current += delta;
      const pos = dustPosRef.current;
      const vel = dustVelRef.current;
      const life = dustLifeRef.current;
      const DUST_GRAVITY = -2.0;
      // Keep debris on the playfield: clamp world XZ to the field half-extents so
      // perimeter rigs don't throw rock into the void beyond the mesa (mirrors the
      // spill puddle's uFieldHalf clip). Dust is in the rig's local frame, so the
      // local bound is the field edge minus the rig's own offset from center.
      // Inset a touch so rock settles fully on the mesa rather than straddling the rim.
      const DUST_EDGE_INSET = 0.05;
      const dustHalfW = worldW / 2 - DUST_EDGE_INSET;
      const dustHalfD = worldD / 2 - DUST_EDGE_INSET;
      const dustMinX = -dustHalfW - position[0];
      const dustMaxX =  dustHalfW - position[0];
      const dustMinZ = -dustHalfD - position[2];
      const dustMaxZ =  dustHalfD - position[2];
      let allDone = true;

      for (let i = 0; i < DUST_COUNT; i++) {
        life[i] += delta;
        if (life[i] < 0) { allDone = false; continue; }
        const i3 = i * 3;
        if (life[i] > DUST_DURATION) continue;
        allDone = false;
        vel[i3 + 1] += DUST_GRAVITY * delta; // gravity
        pos[i3]     += vel[i3] * delta;
        pos[i3 + 1] += vel[i3 + 1] * delta;
        pos[i3 + 2] += vel[i3 + 2] * delta;
        // Clamp to ground
        if (pos[i3 + 1] < 0) { pos[i3 + 1] = 0; vel[i3 + 1] = 0; vel[i3] *= 0.9; vel[i3 + 2] *= 0.9; }
        // Clamp to playfield edge — rock that would fly off stops at the mesa rim
        if (pos[i3] < dustMinX)      { pos[i3] = dustMinX;     vel[i3] = 0; }
        else if (pos[i3] > dustMaxX) { pos[i3] = dustMaxX;     vel[i3] = 0; }
        if (pos[i3 + 2] < dustMinZ)      { pos[i3 + 2] = dustMinZ; vel[i3 + 2] = 0; }
        else if (pos[i3 + 2] > dustMaxZ) { pos[i3 + 2] = dustMaxZ; vel[i3 + 2] = 0; }
      }

      if (dustGeoRef.current) {
        dustGeoRef.current.attributes.position.needsUpdate = true;
      }
      if (dustMatRef.current) {
        const dt = dustTimerRef.current;
        const fade = dt > DUST_DURATION - 1.0
          ? Math.max(0, (DUST_DURATION - dt) / 1.0)
          : Math.min(1, dt * 4);
        dustMatRef.current.opacity = fade * 0.7;
      }
      if (allDone || dustTimerRef.current > DUST_DURATION) {
        dustActiveRef.current = false;
        if (dustMatRef.current) dustMatRef.current.opacity = 0;
      }
    }

    // ── Gauge needle — phased behavior during drill sequence ──
    if (drillGaugeTwitchRef.current) {
      drillGaugeTwitchTimer.current += delta;
      const gt = drillGaugeTwitchTimer.current;
      if (gt < DRILL_GAUGE_TWITCH_DURATION) {
        const revealT = STRIKE_REVEAL_DELAY;
        const hasPendingStrike = pendingStrikeRef.current;
        let amplitude, freq, decay;
        if (gt < revealT * 0.5) {
          // Phase 1: initial seismograph twitch
          amplitude = 0.2;
          freq = 6;
          decay = Math.exp(-gt * 0.3);
        } else if (gt < revealT) {
          // Phase 2: building intensity — instruments detecting something
          const ramp = (gt - revealT * 0.5) / (revealT * 0.5);
          amplitude = hasPendingStrike ? 0.2 + ramp * 0.4 : 0.15;
          freq = hasPendingStrike ? 6 + ramp * 8 : 5;
          decay = 1;
        } else {
          // Phase 3: post-reveal settling
          const postT = gt - revealT;
          amplitude = hasPendingStrike ? 0.5 : 0.2;
          freq = 4;
          decay = Math.exp(-postT * 1.5);
        }
        gaugePressureOffset.current = amplitude * decay * Math.sin(gt * freq);
      } else {
        drillGaugeTwitchRef.current = false;
        gaugePressureOffset.current = 0;
      }
    }

    // ── Near-miss amber proximity pulse ──
    if (proximityFlashRef.current) {
      proximityTimerRef.current += delta;
      const pt = proximityTimerRef.current;
      if (pt < PROXIMITY_FLASH_DURATION) {
        const light = alertLightRef.current;
        if (light && !strikeFlashRef.current && !strikingRef.current) {
          const fadeOut = pt > PROXIMITY_FLASH_DURATION - 2.0
            ? Math.max(0, (PROXIMITY_FLASH_DURATION - pt) / 2.0)
            : 1.0;
          const proxStrength = Math.min(drillProximityRef.current / 50, 1.0);
          const pulse = (Math.sin(pt * 3) * 0.5 + 0.5) * fadeOut * proxStrength;
          light.material.emissive.setHex(0xffaa00);
          light.material.emissiveIntensity = pulse * 3.0;
          light.material.color.setHex(pulse > 0.1 ? 0xffaa00 : 0x332200);
          if (strikeLightRef.current) {
            strikeLightRef.current.color.setHex(0xffaa00);
            strikeLightRef.current.intensity = pulse * 2.0;
          }
          // Panel light amber
          const pl = panelLightRef.current;
          if (pl) {
            pl.material.emissive.setHex(0xffaa00);
            pl.material.emissiveIntensity = pulse * 3.0;
            pl.material.color.setHex(pulse > 0.1 ? 0xffaa00 : 0x332200);
          }
        }
      } else {
        proximityFlashRef.current = false;
        // Restore original colors
        const light = alertLightRef.current;
        const orig = alertLightOrigColor.current;
        if (light && orig && !strikeFlashRef.current && !strikingRef.current) {
          light.material.color.copy(orig.color);
          light.material.emissive.copy(orig.emissive);
          light.material.emissiveIntensity = orig.emissiveIntensity;
        }
        if (strikeLightRef.current) {
          strikeLightRef.current.color.setHex(0xff0000);
          strikeLightRef.current.intensity = 0;
        }
        const plOrig = panelLightOrigColor.current;
        const pl = panelLightRef.current;
        if (pl && plOrig) {
          pl.material.color.copy(plOrig.color);
          pl.material.emissive.copy(plOrig.emissive);
          pl.material.emissiveIntensity = plOrig.emissiveIntensity;
        }
      }
    }

    // Gate slide animation
    const gate = gateRef.current;
    if (gate && gateBasePos.current) {
      const target = gateTargetZ.current;
      const diff = target - gate.position.z;
      if (Math.abs(diff) > 0.01) {
        gate.position.z += diff * Math.min(delta * 4, 1);
      } else {
        gate.position.z = target;
      }
    }

    // Security camera sweep — slow loop from 0° to 155° CCW and back
    const secCam = secCamRef.current;
    // Live feed only for the owner (or admin/test/report). Non-owners still see the
    // camera housing sweep, but it never feeds the CCTV renderer.
    const camVisible = highlighted && !!pumpConfig?.showCamera && cameraViewable;
    if (secCam && secCamBaseRotY.current !== null) {
      if (camVisible && !(highlighted && _cctvState.pauseSweep)) {
        const sweep = 90 * (Math.PI / 180);
        const baseOffset = 45 * (Math.PI / 180); // rotate base leftward to face the rig
        const period = 12; // seconds for a full back-and-forth cycle
        const t = (Math.sin(performance.now() * 0.001 * (2 * Math.PI / period)) + 1) / 2; // 0→1→0
        secCam.rotation.y = secCamBaseRotY.current + baseOffset + t * sweep;
      }

      // Feed world transform to CCTV renderer when this rig is highlighted and camera enabled
      if (camVisible) {
        secCam.updateWorldMatrix(true, false);
        secCam.getWorldPosition(_cctvState.worldPos);
        secCam.getWorldQuaternion(_cctvState.worldQuat);
        _cctvState.worldMatrix.copy(secCam.matrixWorld);
        _cctvState.active = true;
        _cctvState.ownerId = secCam.uuid;
      } else if (_cctvState.active && _cctvState.ownerId === secCam.uuid) {
        // Only the rig that activated CCTV can deactivate it
        _cctvState.active = false;
        _cctvState.ownerId = null;
      }
    }

    // Oil geyser shader update
    if (gusherActiveRef.current) {
      const vis = tierVis(gusherTierRef.current);
      // Strike tier draws the droplet fountain; everything else draws the geyser
      // column. Keep exactly one of the two primitives visible (refs may not have
      // been ready when initGusher fired, so reconcile here every frame).
      const fountain = vis.sputter && STRIKE_FOUNTAIN;
      if (sputterMeshRef.current) sputterMeshRef.current.visible = fountain;
      if (geyserMeshRef.current) geyserMeshRef.current.visible = !fountain;
      if (spillMeshRef.current) spillMeshRef.current.scale.set(vis.spill, vis.spill, 1);
      // Keep pump parts stained while a sustained gusher is active — green oil
      // normally, a charred scorch for hell. Skipped for a strike (sputter): the
      // pump never pauses and a weak well doesn't drench the rig.
      const hell = gusherHellRef.current;
      if (!vis.sputter) {
        const stainColor = hell ? 0x2a0a05 : 0x0d2a14;
        if (strawRef.current?.material) strawRef.current.material.color.set(stainColor);
        cylPumpRefs.current.forEach((m) => { if (m.material) m.material.color.set(stainColor); });
      }
      gusherTimerRef.current += delta;

      // Fireball burst — a fast expanding flash at the wellhead the instant the
      // demon is unleashed (first ~0.8s of the hell gusher), then it fades out.
      if (hell && hellBurstRef.current) {
        hellBurstTimerRef.current += delta;
        const bt = hellBurstTimerRef.current;
        const BURST_DUR = 0.85;
        if (bt < BURST_DUR) {
          const bf = bt / BURST_DUR;
          hellBurstRef.current.visible = true;
          hellBurstRef.current.scale.setScalar(0.3 + bf * 2.8);
          hellBurstRef.current.rotation.y += delta * 1.5;
          if (hellBurstMatRef.current) hellBurstMatRef.current.opacity = (1 - bf) * 0.95;
          if (hellBurstLightRef.current) hellBurstLightRef.current.intensity = (1 - bf) * 12;
        } else if (hellBurstRef.current.visible) {
          hellBurstRef.current.visible = false;
          if (hellBurstLightRef.current) hellBurstLightRef.current.intensity = 0;
        }
      }

      const effectiveFill = (drainingRef.current || drainedRef.current) ? drainFillRef.current : tankFillRef.current;
      // Sustain the gusher (and the blowback that rides it) at full intensity while
      // the tank overflows OR while the demon is loose (hell). Both hold the rig
      // pitched back indefinitely; the final 1s settle only runs once this is false.
      // A strike (sputter) stays "live" while its broadcast event is active so it
      // keeps coughing on a cycle — it just modulates intensity instead of holding
      // a steady jet. A sustained gusher is held by overflow / hell / a live doc.
      const gusherDur = gusherDurationRef.current;
      const overflowing = vis.sputter
        ? gusherActivePropRef.current
        : ((effectiveFill >= 1.0 && highlighted) || (gusherHellRef.current && hellActiveRef.current) || gusherActivePropRef.current);

      // Fade out near end of one-shot gusher (also drives the blowback below)
      const fade = overflowing ? 1.0
        : gusherTimerRef.current > gusherDur - 1.0
          ? Math.max(0, gusherDur - gusherTimerRef.current)
          : 1.0;

      // Column-fallback cough envelope — ONLY when the strike tier is drawn as a
      // scaled geyser column (fountain disabled via ?sputtershader=0). Each
      // STRIKE_SPUTTER_CYCLE a short burst of decaying coughs, then an idle gap at
      // the floor. 1.0 (no-op) for sustained tiers and for the droplet fountain
      // (the fountain shader owns its own discrete-droplet motion).
      let sputterEnv = 1.0;
      if (vis.sputter && !fountain) {
        const tc = gusherTimerRef.current % STRIKE_SPUTTER_CYCLE;
        let spurt = 0;
        if (tc < STRIKE_SPUTTER_WINDOW) {
          const pulse = Math.max(0, Math.sin(tc * STRIKE_SPUTTER_HZ * Math.PI * 2));
          spurt = pulse * (1 - tc / STRIKE_SPUTTER_WINDOW); // coughs weaken across the burst
        }
        sputterEnv = STRIKE_SPUTTER_FLOOR + (1 - STRIKE_SPUTTER_FLOOR) * spurt;
      }

      if (fountain) {
        // Strike droplet fountain — runs continuously while the strike is live so
        // the weak well keeps spitting. The shader owns the per-droplet ballistics;
        // we only advance time and ride the overall fade in/out.
        if (sputterMatRef.current) {
          sputterMatRef.current.uniforms.uNightMode.value = envPreset === "night" ? 1.0 : 0.0;
          sputterMatRef.current.uniforms.uTime.value += delta;
          sputterMatRef.current.uniforms.uOpacity.value = fade;
        }
        // Re-kick the real dust/rock particles every ~5.5s (they're a one-shot
        // burst otherwise) so the well throws an occasional batch of actual chips
        // at the base while it sputters. Reuses the 80-point buffer — no new geometry.
        sputterDustTimerRef.current -= delta;
        if (sputterDustTimerRef.current <= 0) {
          // Per-rig period (≈4.6–6.4s, hashed from position) so strikes never drift
          // back into a synchronized re-kick over a long session.
          const rk = Math.sin(position[0] * 73.91 + position[2] * 18.27) * 11251.73;
          sputterDustTimerRef.current = 4.6 + (rk - Math.floor(rk)) * 1.8;
          initDust(0.8);
        }
      } else {
        // Geyser column — sustained gushers + the (rare) sputter column-fallback.
        // Apply the tier height (× cough envelope), anchoring the base at the
        // wellhead so it grows upward. Width is steady per tier.
        if (geyserMeshRef.current) {
          const colH = vis.height * sputterEnv;
          geyserMeshRef.current.scale.set(vis.width, colH, 1);
          geyserMeshRef.current.position.y = gusherOriginRef.current.y - 0.5 + 1.5 * colH;
        }
        if (geyserMatRef.current) {
          geyserMatRef.current.uniforms.uNightMode.value = envPreset === "night" ? 1.0 : 0.0;
          geyserMatRef.current.uniforms.uParabolum.value = hell ? 0.0 : 1.0;
          geyserMatRef.current.uniforms.uHell.value = hell ? 1.0 : 0.0;
          geyserMatRef.current.uniforms.uTint.value = vis.tint;
          geyserMatRef.current.uniforms.uTime.value += delta;
          geyserMatRef.current.uniforms.uOpacity.value = fade * sputterEnv;
        }
        // Underground feeder jet — anchor its bottom at the cell's deposit depth and
        // its top at the wellhead, so the gusher rises out of the cell that holds the
        // oil. Depth = the deposit layer (richest layer) in world units, falling back
        // to the drill head for a dry cell.
        if (feederMeshRef.current) {
          const sourceLayer = depositLayerRef.current >= 0
            ? depositLayerRef.current
            : drillDayRef.current;
          const depth = Math.max(
            GUSHER_FEEDER_MIN_DEPTH,
            sourceLayer * depthCellRef.current * GUSHER_FEEDER_DEPTH_SCALE
          );
          if (!feederMeshRef.current.visible) feederMeshRef.current.visible = true;
          feederMeshRef.current.scale.y = depth;
          feederMeshRef.current.position.set(
            gusherOriginRef.current.x,
            gusherOriginRef.current.y - depth / 2,
            gusherOriginRef.current.z
          );
          if (feederMatRef.current) {
            feederMatRef.current.uniforms.uHell.value = hell ? 1.0 : 0.0;
            feederMatRef.current.uniforms.uTime.value += delta;
            feederMatRef.current.uniforms.uOpacity.value = fade * sputterEnv;
          }
        }
      }

      // Oil spill decal — spreads as the gusher builds (uGrow rides the eased blowback)
      // and fades with the gusher (uOpacity = fade). Self-resets, no lingering state.
      // For a strike the rig never blows back, so the small puddle rides the sputter
      // envelope instead — a modest patch that pulses with the coughs and persists
      // (at the floor) as the at-a-glance "struck here" marker until banked.
      // Skip the ground puddle entirely for the hell eruption — fire only.
      if (spillMeshRef.current && spillMeshRef.current.visible === hell) {
        spillMeshRef.current.visible = !hell;
      }
      if (spillMatRef.current && !hell) {
        spillMatRef.current.uniforms.uNightMode.value = envPreset === "night" ? 1.0 : 0.0;
        spillMatRef.current.uniforms.uParabolum.value = hell ? 0.0 : 1.0;
        spillMatRef.current.uniforms.uHell.value = hell ? 1.0 : 0.0;
        spillMatRef.current.uniforms.uGrow.value = vis.sputter ? (fountain ? 0.6 : sputterEnv) : blowbackRef.current;
        spillMatRef.current.uniforms.uOpacity.value = fade;
        // Clip the puddle to the playfield: plane center (grid space) = cell pos +
        // wellhead offset; field is centered at origin with these half-extents.
        spillMatRef.current.uniforms.uClipCenter.value.set(
          position[0] + gusherOriginRef.current.x,
          position[2] + gusherOriginRef.current.z
        );
        spillMatRef.current.uniforms.uFieldHalf.value.set(worldW / 2, worldD / 2);
      }

      // Blowback: ease the body back from the blast, riding the gusher's intensity
      // (fade) so the rig shoves back as it erupts and settles as it dies. Head_Pump
      // is parented under Body_Pump for the gusher, so it follows along automatically.
      blowbackRef.current += (fade - blowbackRef.current) * Math.min(delta * GUSHER_BLOWBACK_SPEED, 1);
      // Tier scales how hard the rig is shoved — a seep barely nudges it, a
      // motherlode throws it back. A strike (sputter) never blows back: its pump
      // keeps running, so force the rig tilt to zero regardless of any stale base.
      const blow = vis.sputter ? 0 : blowbackRef.current * vis.blowback;
      if (!vis.sputter && bodyPumpRef.current && bodyPumpBaseRotX.current !== null) {
        bodyPumpRef.current.rotation.x = bodyPumpBaseRotX.current + blow * GUSHER_BLOWBACK_BODY;
      }
      // Extra horsehead pitch, eased with the gusher, about the body's X axis. Premultiply
      // so it rotates in the parent (body) frame on top of the captured rest pose.
      if (headPumpRef.current && headRestQuatRef.current) {
        _gusherHeadQuat.setFromAxisAngle(_GUSHER_X_AXIS, blow * GUSHER_HEAD_EXTRA);
        headPumpRef.current.quaternion.copy(headRestQuatRef.current).premultiply(_gusherHeadQuat);
      }

      if (gusherTimerRef.current > gusherDur && !overflowing) {
        gusherActiveRef.current = false;
        gusherHellRef.current = false;
        if (hellBurstRef.current) hellBurstRef.current.visible = false;
        if (hellBurstLightRef.current) hellBurstLightRef.current.intensity = 0;
        if (geyserMeshRef.current) geyserMeshRef.current.visible = false;
        if (sputterMeshRef.current) sputterMeshRef.current.visible = false;
        if (feederMeshRef.current) feederMeshRef.current.visible = false;
        if (spillMeshRef.current) spillMeshRef.current.visible = false;
        if (spillMatRef.current) { spillMatRef.current.uniforms.uOpacity.value = 0; spillMatRef.current.uniforms.uGrow.value = 0; }
        // Resume pump animation, restore Head_Pump rotation and all stained colors
        if (pumpPausedRef.current) {
          if (bodyPumpRef.current && bodyPumpBaseRotX.current !== null) {
            bodyPumpRef.current.rotation.x = bodyPumpBaseRotX.current;
          }
          // Clear the extra pitch, then (body already at rest) the head's world transform
          // matches its original — reparent it back under its own armature bone.
          if (headPumpRef.current && headRestQuatRef.current) {
            headPumpRef.current.quaternion.copy(headRestQuatRef.current);
          }
          if (headPumpRef.current && headOrigParentRef.current) {
            headOrigParentRef.current.attach(headPumpRef.current);
            headOrigParentRef.current = null;
            headRestQuatRef.current = null;
          }
          blowbackRef.current = 0;
          oilStainedParts.current.forEach((m) => {
            if (m.material && m.userData._origColor) {
              m.material.color.copy(m.userData._origColor);
              delete m.userData._origColor;
            }
            m.visible = true; // restore Straw + Cylinder_Pump after the gusher
          });
          pumpActionsRef.current.forEach((action) => { action.paused = false; });
          pumpPausedRef.current = false;
        }
      }
    }

    // Steam vent particle update
    // Decay gauge pressure offset back toward 0
    if (gaugePressureOffset.current > 0) {
      gaugePressureOffset.current = Math.max(0, gaugePressureOffset.current - delta * 0.15);
    }

    if (steamActiveRef.current) {
      steamTimerRef.current += delta;
      const STEAM_DURATION = 2.5;
      const pos = steamPosRef.current;
      const vel = steamVelRef.current;
      const life = steamLifeRef.current;
      const STEAM_GRAVITY = -0.3; // very light — steam floats
      let allDone = true;
      const wp = steamOriginRef.current;

      for (let i = 0; i < STEAM_COUNT; i++) {
        life[i] += delta;
        if (life[i] < 0) { allDone = false; continue; }

        const i3 = i * 3;
        if (life[i] > STEAM_DURATION) continue;

        allDone = false;
        vel[i3 + 1] += STEAM_GRAVITY * delta;
        // Wind drift
        vel[i3] += (Math.random() - 0.5) * 0.1 * delta;
        vel[i3 + 2] += (Math.random() - 0.5) * 0.1 * delta;
        pos[i3]     += vel[i3] * delta;
        pos[i3 + 1] += vel[i3 + 1] * delta;
        pos[i3 + 2] += vel[i3 + 2] * delta;
      }

      if (steamGeoRef.current) {
        steamGeoRef.current.attributes.position.needsUpdate = true;
      }
      if (steamMatRef.current) {
        const t = steamTimerRef.current;
        const fade = t > STEAM_DURATION - 0.8
          ? Math.max(0, (STEAM_DURATION - t) / 0.8)
          : Math.min(1, t * 3); // quick fade in
        steamMatRef.current.opacity = fade * 0.6;
      }

      if (allDone || steamTimerRef.current > STEAM_DURATION) {
        steamActiveRef.current = false;
        if (steamMatRef.current) steamMatRef.current.opacity = 0;
      }
    }
  });

  // Zoom the camera to a canonical head-on view of the MachinePanel's front face.
  // Used by a direct panel/gauge click and by the first RedButton click.
  const focusMachinePanel = useCallback((panelNode) => {
    if (!panelNode || !onFocusObject) return;
    panelNode.updateWorldMatrix(true, false);
    const bbox = new THREE.Box3().setFromObject(panelNode);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    // Snap the front/back heading to the panel's thinner horizontal axis (its depth);
    // the gauge face spans the wider axis. Gauge children pick which way is the front.
    const axis = size.x < size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const avg = new THREE.Vector3();
    let n = 0;
    panelNode.traverse((c) => {
      if (c !== panelNode && c.isMesh) { avg.add(c.getWorldPosition(new THREE.Vector3())); n++; }
    });
    let sign = 1;
    if (n > 0) {
      avg.divideScalar(n).sub(center);
      const d = avg.dot(axis);
      if (Math.abs(d) > 1e-5) sign = Math.sign(d);
    }
    const front = axis.multiplyScalar(sign);
    front.applyAxisAngle(_PANEL_UP, PANEL_FRONT_YAW_OFFSET_DEG * Math.PI / 180);
    front.y = 0;
    front.normalize();
    onFocusObject(center, front);
    panelZoomedRef.current = true; // now a RedButton click drains instead of zooming
  }, [onFocusObject]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();

    // Wheel click — spin 360° on y-axis
    let isWheelClick = false;
    let obj = e.object;
    while (obj) {
      if (obj.name === "Wheel") { isWheelClick = true; break; }
      obj = obj.parent;
    }
    if (isWheelClick) {
      wheelTargetRotY.current += Math.PI * 2;
      // Trigger steam vent from chimney + drop gauge pressure
      if (!steamActiveRef.current) {
        initSteam();
        gaugePressureOffset.current = Math.min(gaugePressureOffset.current + 0.3, 0.8);
      }
      return;
    }

    // Gate click — toggle slide open/closed
    // Check the full ancestor chain since the clicked object may be a child of Gate
    let isGateClick = false;
    obj = e.object;
    while (obj) {
      if (obj.name === "Gate") { isGateClick = true; break; }
      obj = obj.parent;
    }
    if (isGateClick && gateBasePos.current) {
      gateOpenRef.current = !gateOpenRef.current;
      gateTargetZ.current = gateOpenRef.current
        ? gateBasePos.current.z + 2.5
        : gateBasePos.current.z;
      return;
    }

    // Panel buttons. AlarmButton_01 and RedButton both bring the user close-up (zoom).
    // Once zoomed in, RedButton (only) drains the tank. Walk up parents and tolerate
    // GLTF "_N" suffixes so a click on a child mesh of a button still counts.
    let clickedButton = null; // "red" | "alarm" | null
    for (let b = e.object; b; b = b.parent) {
      if (typeof b.name !== "string") continue;
      if (b.name.startsWith("RedButton")) { clickedButton = "red"; break; }
      if (b.name.startsWith("AlarmButton")) { clickedButton = "alarm"; break; }
    }
    if (clickedButton && highlighted) {
      // First click on either button zooms in so the user can see/aim at the button.
      if (!panelZoomedRef.current) {
        if (onFocusObject && machinePanelRef.current) focusMachinePanel(machinePanelRef.current);
        return;
      }
      // Already zoomed in: only RedButton drains the tank.
      if (clickedButton === "red" && !drainingRef.current && tankFillRef.current > 0) {
        drainingRef.current = true;
        drainFillRef.current = Math.min(tankFillRef.current, 1.0);
        setTankDraining(true);

        // Kill geyser immediately
        gusherActiveRef.current = false;
        strikingRef.current = false;
        strikeFlashRef.current = false;
        if (geyserMeshRef.current) geyserMeshRef.current.visible = false;
        if (feederMeshRef.current) feederMeshRef.current.visible = false;
        if (geyserMatRef.current) geyserMatRef.current.uniforms.uOpacity.value = 0;
        if (spillMeshRef.current) spillMeshRef.current.visible = false;
        if (spillMatRef.current) { spillMatRef.current.uniforms.uOpacity.value = 0; spillMatRef.current.uniforms.uGrow.value = 0; }
        // Resume pump animation, restore Head_Pump rotation and all stained colors
        if (pumpPausedRef.current) {
          if (bodyPumpRef.current && bodyPumpBaseRotX.current !== null) {
            bodyPumpRef.current.rotation.x = bodyPumpBaseRotX.current;
          }
          // Clear the extra pitch, then (body already at rest) the head's world transform
          // matches its original — reparent it back under its own armature bone.
          if (headPumpRef.current && headRestQuatRef.current) {
            headPumpRef.current.quaternion.copy(headRestQuatRef.current);
          }
          if (headPumpRef.current && headOrigParentRef.current) {
            headOrigParentRef.current.attach(headPumpRef.current);
            headOrigParentRef.current = null;
            headRestQuatRef.current = null;
          }
          blowbackRef.current = 0;
          oilStainedParts.current.forEach((m) => {
            if (m.material && m.userData._origColor) {
              m.material.color.copy(m.userData._origColor);
              delete m.userData._origColor;
            }
            m.visible = true; // restore Straw + Cylinder_Pump after the gusher
          });
          pumpActionsRef.current.forEach((action) => { action.paused = false; });
          pumpPausedRef.current = false;
        }
      }
      return;
    }

    // MachinePanel click — zoom to a canonical head-on view of the panel's FRONT,
    // no matter which face of the box (or which child gauge/button) was clicked. The
    // parent walk catches child meshes (gauges) since they live under the panel node.
    let panelNode = null;
    for (let p = e.object; p; p = p.parent) {
      if (typeof p.name === "string" && p.name.startsWith("MachinePanel")) { panelNode = p; break; }
    }
    if (panelNode && highlighted && onFocusObject) {
      focusMachinePanel(panelNode);
      return;
    }

    // Messaging is handled entirely in the UI panel (OilPlotChat), not via a
    // 3D click. The Envelope mesh is intentionally NOT intercepted here — a
    // click on it falls through to the normal rig select/fly below. (The mesh
    // is also hidden in the clonedScene effect, but invisible meshes are still
    // raycastable, so we simply don't special-case it.)

    // Always allow flyTo — interactive elements (wheel, gate, button) return early above
    const now = Date.now();
    if (now - lastClickTime.current < 400) {
      onDoubleClick?.();
    } else {
      onClick?.();
    }
    lastClickTime.current = now;
  }, [onClick, onDoubleClick, highlighted, initSteam, onEnvelopeClick, onFocusObject, focusMachinePanel]);

  // Reset the panel-zoom flag when this rig is deselected, so re-selecting it starts
  // the zoom-then-drain sequence fresh.
  useEffect(() => {
    if (!highlighted) panelZoomedRef.current = false;
  }, [highlighted]);

  return (
    <group ref={shakeGroupRef} position={position}>
      <primitive
        ref={groupRef}
        object={clonedScene}
        scale={PUMPJACK_SCALE}
        onClick={handleClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      />
      {/* Fuel tank liquid — animated fill inside the transparent tank */}
      {tankBounds && <TankLiquid tankBounds={tankBounds} tankFill={tankDraining ? 0 : tankFill} envPreset={envPreset} parabolum={parabolum} />}
      {/* Lyquid80 wellhead glow — idle bloom, flares on a strike, red during hell */}
      <WellGlow strike={oilStrike} hell={hellActive} />
      {/* Live control-box LEDs (close-up rig only): depth readout + pressure gauge */}
      {highlighted && panelXform && (
        <PanelReadout
          pos={panelXform.pos}
          quat={panelXform.quat}
          w={panelXform.w}
          h={panelXform.h}
          fromMesh={panelXform.fromMesh}
          label="DEPTH"
          token={hellActive ? "!!" : (drillDay >= maxDrillDay ? "MAX" : String(drillDay).padStart(2, "0"))}
          idleHex={drillDay >= maxDrillDay ? "#ff3a2a" : "#ffae00"}
          flareKey={oilStrike}
          alarm={hellActive}
        />
      )}
      {highlighted && pressureXform && (
        <PanelReadout
          pos={pressureXform.pos}
          quat={pressureXform.quat}
          w={pressureXform.w}
          h={pressureXform.h}
          fromMesh={pressureXform.fromMesh}
          token={pressure.label}
          idleHex={pressure.hex}
          alarm={hellActive}
        />
      )}
      {/* Red alert point light + gusher VFX — on the selected rig, the rig the demon
          erupts from (hellActive), or any rig with a live gusher event (gusherActive).
          gusherLingering keeps it mounted through the 1s fade after the event clears
          so the column eases out instead of vanishing. */}
      {(highlighted || hellActive || gusherActive || gusherLingering) && (
        <>
          <pointLight
            ref={strikeLightRef}
            position={[0, 0.5, 0]}
            color={0xff0000}
            intensity={0}
            distance={5}
            decay={1.5}
          />
          {/* Hell fireball burst — additive flash at the wellhead on demon unleash */}
          <group
            position={[gusherOriginRef.current.x, gusherOriginRef.current.y + 0.35, gusherOriginRef.current.z]}
          >
            <mesh ref={hellBurstRef} visible={false} renderOrder={11}>
              <icosahedronGeometry args={[0.35, 2]} />
              <meshBasicMaterial
                ref={hellBurstMatRef}
                color="#ff3c0a"
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <pointLight ref={hellBurstLightRef} color="#ff3a00" intensity={0} distance={6} decay={2} />
          </group>
          {/* Underground feeder jet — origin of the gusher in the deposit cell. A
              unit-height plane scaled per-frame to the drill depth; position/scale
              are driven in the gusher update loop. Billboards like the geyser. */}
          <mesh
            ref={feederMeshRef}
            visible={false}
            renderOrder={8}
            position={[gusherOriginRef.current.x, gusherOriginRef.current.y - 1.0, gusherOriginRef.current.z]}
            onBeforeRender={(renderer, scene, camera) => {
              const mesh = feederMeshRef.current;
              if (!mesh) return;
              const camPos = camera.getWorldPosition(_camPos.current);
              const meshPos = mesh.getWorldPosition(_meshPos.current);
              mesh.lookAt(camPos.x, meshPos.y, camPos.z);
            }}
          >
            <planeGeometry args={[GUSHER_FEEDER_WIDTH, 1]} />
            <shaderMaterial
              ref={feederMatRef}
              vertexShader={_feederVertexShader}
              fragmentShader={_feederFragmentShader}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              uniforms={feederUniforms.current}
            />
          </mesh>
          {/* Oil geyser shader plane */}
          <mesh
            ref={geyserMeshRef}
            visible={false}
            renderOrder={10}
            position={[
              gusherOriginRef.current.x,
              gusherOriginRef.current.y + 1.0,
              gusherOriginRef.current.z
            ]}
            onBeforeRender={(renderer, scene, camera) => {
              // Y-axis locked billboard: face camera horizontally only (reuse refs)
              const mesh = geyserMeshRef.current;
              if (!mesh) return;
              const camPos = camera.getWorldPosition(_camPos.current);
              const meshPos = mesh.getWorldPosition(_meshPos.current);
              mesh.lookAt(camPos.x, meshPos.y, camPos.z);
            }}
          >
            <planeGeometry args={[0.9, 3.0]} />
            <shaderMaterial
              ref={geyserMatRef}
              vertexShader={_geyserVertexShader}
              fragmentShader={_geyserFragmentShader}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              uniforms={geyserUniforms.current}
            />
          </mesh>
          {/* Strike "sputter" fountain plane — droplets launch from the nozzle at
              uv (0.5, 0). Shorter/squarer than the geyser column: a low weak spit,
              not a tower. Mutually exclusive with the geyser plane (one per tier). */}
          <mesh
            ref={sputterMeshRef}
            visible={false}
            renderOrder={10}
            position={[
              gusherOriginRef.current.x,
              gusherOriginRef.current.y + 0.6,
              gusherOriginRef.current.z
            ]}
            onBeforeRender={(renderer, scene, camera) => {
              const mesh = sputterMeshRef.current;
              if (!mesh) return;
              const camPos = camera.getWorldPosition(_camPos.current);
              const meshPos = mesh.getWorldPosition(_meshPos.current);
              mesh.lookAt(camPos.x, meshPos.y, camPos.z);
            }}
          >
            <planeGeometry args={[0.9, 1.2]} />
            <shaderMaterial
              ref={sputterMatRef}
              vertexShader={_sputterVertexShader}
              fragmentShader={_sputterFragmentShader}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              uniforms={sputterUniforms.current}
            />
          </mesh>
          {/* Oil spill / splatter decal — flat on the ground around the wellhead */}
          <mesh
            ref={spillMeshRef}
            visible={false}
            renderOrder={9}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[gusherOriginRef.current.x, 0.012, gusherOriginRef.current.z]}
          >
            <planeGeometry args={[1.8, 1.8]} />
            <shaderMaterial
              ref={spillMatRef}
              vertexShader={_spillVertexShader}
              fragmentShader={_spillFragmentShader}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              uniforms={spillUniforms.current}
            />
          </mesh>
          {/* Steam vent particles */}
          <points>
            <bufferGeometry ref={steamGeoRef}>
              <bufferAttribute
                attach="attributes-position"
                args={[steamPosRef.current, 3]}
                count={STEAM_COUNT}
              />
            </bufferGeometry>
            <pointsMaterial
              ref={steamMatRef}
              color={0xdddddd}
              size={0.06}
              transparent
              opacity={0}
              depthWrite={false}
              sizeAttenuation
            />
          </points>
          {/* Dust burst particles — triggered by every drill */}
          <points>
            <bufferGeometry ref={dustGeoRef}>
              <bufferAttribute
                attach="attributes-position"
                args={[dustPosRef.current, 3]}
                count={DUST_COUNT}
              />
            </bufferGeometry>
            <pointsMaterial
              ref={dustMatRef}
              color={drillDay <= 5 ? "#c4a56e" : drillDay <= 12 ? "#888888" : "#4a3728"}
              size={0.04}
              transparent
              opacity={0}
              depthWrite={false}
              sizeAttenuation
            />
          </points>
        </>
      )}
      {/* Plot add-ons — placeholder meshes at slot positions */}
      {pumpConfig?.addons && (
        <PlotAddons addons={pumpConfig.addons} />
      )}
      {/* Fence — separate GLB model */}
      {pumpConfig?.fenceType && (
        <PlotFence fenceType={pumpConfig.fenceType} />
      )}
      {/* Poop — left by Crudingo rogue */}
      {pumpConfig?.poop && <PlotPoop />}
    </group>
  );
}

function TowerLiquid({ towerBounds, position, fill, scale }) {
  const meshRef = useRef();
  const displayFill = useRef(0);
  const targetFill = useRef(fill);
  targetFill.current = fill;
  const lastQ = useRef(-1);

  // Paraboleum — animated procedural fluid. The per-rig tanks use a physical
  // thin-film material, but the big community tank is viewed dead-on through a
  // frosted window, where physical iridescence collapses to a flat slab. This
  // custom shader reuses the gusher palette (gusherPalette/GUSHER_IRID) so it reads
  // as the SAME substance as the gushers, but with motion + depth: deep→luminous vertical
  // gradient, drifting caustics, rising shimmer streaks, a pulsing surface
  // meniscus, and a fresnel rim glow.
  const oilMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.97 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: GUSHER_GLSL + `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uOpacity;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      void main() {
        float h = clamp(vUv.y, 0.0, 1.0);   // 0 = bottom, 1 = surface
        float ang = vUv.x;                    // 0..1 around the tank

        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - abs(dot(normalize(vNormalW), V)), 2.5);

        // deep murk at the bottom -> luminous near the surface
        vec3 base = mix(${_v3(GUSHER_IRID.base)}, ${_v3(GUSHER_IRID.baseHi)}, smoothstep(0.0, 1.0, h));

        // slow swirling caustics drifting through the body
        float s1 = fbm(vec2(ang * 6.0 + uTime * 0.05, h * 4.0 - uTime * 0.12));
        float s2 = fbm(vec2(ang * 10.0 - uTime * 0.08, h * 7.0 + uTime * 0.06));
        float caustic = smoothstep(0.45, 0.95, s1 * 0.6 + s2 * 0.5);

        // drifting thin-film iridescence (angle + depth + flow + time)
        float irT = fract(fres * 1.2 + h * 0.7 + s1 * 0.5 + uTime * 0.04);
        vec3 irid = gusherPalette(irT);
        float iridAmt = (0.25 + 0.75 * fres) * (0.5 + 0.5 * caustic) * ${GUSHER_IRID.sheen.toFixed(3)};

        // luminosity floor so the body glows as a filled column instead of
        // collapsing to a see-through near-black navy
        vec3 col = base + ${_v3(GUSHER_IRID.glow)} * 0.22;
        col += irid * iridAmt;
        col += ${_v3(GUSHER_IRID.glow)} * caustic * 0.42;

        // rising shimmer streaks
        float streak = smoothstep(0.6, 1.0, fbm(vec2(ang * 22.0, h * 3.0 - uTime * 0.5)));
        col += ${_v3(GUSHER_IRID.glow)} * streak * 0.15;

        // glowing surface meniscus with a gentle pulse traveling around the rim
        float surf = smoothstep(0.93, 1.0, h);
        float surfPulse = 0.7 + 0.3 * sin(uTime * 1.5 + ang * 12.566);
        col += ${_v3(GUSHER_IRID.glow)} * surf * surfPulse * 1.25;

        // Violet shimmer — echoes the gusher splashes. ADDITIVE (a low-percentage
        // mix just gets swamped by the bright teal body), banded by the iridescence
        // phase so flecks drift through. Blue-dominant (R<B) so it stays violet.
        float vBand = smoothstep(0.45, 0.85, 0.5 + 0.5 * cos(6.28318530718 * irT + 2.1));
        col += vec3(0.45, 0.10, 0.78) * vBand * 0.6;

        // fresnel rim glow + slow overall breathing (brightening, not dimming)
        col += ${_v3(GUSHER_IRID.glow)} * fres * 0.45;
        col *= 1.0 + 0.1 * sin(uTime * 0.6);

        // lift saturation so the broadband opal sheen doesn't read dingy/gray
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, 1.4);

        // mostly opaque body so you can't see through to the tank floor; rim +
        // surface push to fully solid
        float alpha = uOpacity * (0.88 + 0.12 * fres) + surf * 0.15;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `,
  }), []);
  useEffect(() => () => oilMat.dispose(), [oilMat]);

  useFrame((_, delta) => {
    oilMat.uniforms.uTime.value += delta;

    const target = Math.min(targetFill.current, 1);
    const prev = displayFill.current;
    if (Math.abs(target - prev) < 0.0001) {
      displayFill.current = target;
    } else {
      displayFill.current += (target - prev) * Math.min(delta * 0.5, 0.05);
    }

    const mesh = meshRef.current;
    if (!mesh) return;
    const f = displayFill.current;

    if (f <= 0) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const tb = towerBounds;
    const S = scale;
    // Fluid radius as a fraction of the tank's inner radius (knob above).
    const r = tb.radius * TOWER_FLUID_RADIUS_FRAC;
    // Gauge range: the markings don't start at the very bottom of the mesh.
    // gaugeBottom = fraction of total height where the "0" mark sits
    // gaugeTop   = fraction of total height where the "500" mark sits
    const gaugeBottom = 0.2;
    const gaugeTop = 0.82;
    const gaugeSpan = gaugeTop - gaugeBottom;
    // Map fill (0-1) into the gauge range of the tank height
    const minH = tb.height * 0.02;
    const h = Math.max(minH, tb.height * (gaugeBottom + gaugeSpan * f));

    // Rebuild geometry only when fill changes meaningfully (~2%)
    const quantized = Math.round(f * 50) / 50;
    if (lastQ.current !== quantized) {
      lastQ.current = quantized;
      if (mesh.geometry) mesh.geometry.dispose();
      mesh.geometry = new THREE.CylinderGeometry(r, r, h, 32);
    }

    // Position: bottom of tank + half the liquid height
    // All coordinates in model space, then scaled by S
    mesh.position.set(
      position[0] + tb.cx * S,
      position[1] + (tb.minY + h / 2) * S,
      position[2] + tb.cz * S,
    );
    mesh.scale.set(S, S, S);
  });

  return (
    <mesh ref={meshRef} material={oilMat} visible={false} renderOrder={1} />
  );
}

// OilTower click-to-zoom: the GasTowerWindow sits on the tower's -X side and faces
// outward (world -X), so the camera approaches from there. The window is large, so it
// needs more dolly distance than the close-up MachinePanel.
const TOWER_WINDOW_FRONT = /* @__PURE__ */ new THREE.Vector3(-1, 0, 0);
const TOWER_FOCUS_DIST = 1.3;

// ── Community tank sizing ────────────────────────────────────────────────────
// TOWER_SCALE is the overall tower size. TOWER_FLUID_RADIUS_FRAC is how much of
// the tank's inner radius the FLUID fills (the tank model is unchanged): 1.0 = the
// fluid touches the walls, lower leaves a gap. Bump toward ~0.95 to fit the tank
// better; back off if the column clips through the glass.
const TOWER_SCALE = 0.1;
const TOWER_FLUID_RADIUS_FRAC = 0.89;

function OilTower({ position, communityOil = 0, totalOilBudget = 500, onFocusObject, onZoomOut }) {
  const { scene } = useGLTF("/models/OilTower.glb");
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => () => disposeScene(clonedScene), [clonedScene]);

  // Capture the GasTowerWindow on the big GasTower for click-to-zoom.
  const windowRef = useRef(null);
  const towerZoomedRef = useRef(false);
  useEffect(() => {
    clonedScene.traverse((c) => { if (c.name === "GasTowerWindow") windowRef.current = c; });
  }, [clonedScene]);

  // Clicking any GasTower* mesh zooms to a head-on view of the window; clicking again
  // pulls back out to the overview.
  const handleTowerClick = useCallback((e) => {
    let isTower = false;
    for (let o = e.object; o; o = o.parent) {
      if (typeof o.name === "string" && o.name.startsWith("GasTower")) { isTower = true; break; }
    }
    if (!isTower) return;
    e.stopPropagation();
    if (towerZoomedRef.current) {
      towerZoomedRef.current = false;
      onZoomOut?.();
      return;
    }
    if (!onFocusObject || !windowRef.current) return;
    windowRef.current.updateWorldMatrix(true, false);
    const center = new THREE.Box3().setFromObject(windowRef.current).getCenter(new THREE.Vector3());
    onFocusObject(center, TOWER_WINDOW_FRONT.clone(), TOWER_FOCUS_DIST);
    towerZoomedRef.current = true;
  }, [onFocusObject, onZoomOut]);

  // Find the tower tank mesh and compute bounds
  const towerBounds = useMemo(() => {
    let tankMesh = null;
    clonedScene.traverse((child) => {
      if (child.name === "GasTower" && child.isMesh) {
        tankMesh = child;
      }
    });
    if (!tankMesh) return null;
    tankMesh.geometry.computeBoundingBox();
    const bb = tankMesh.geometry.boundingBox;
    // Use geometry bounding box directly (model space)
    // From GLB inspection: roughly X(-12.4 to 2), Y(-0.1 to 35.4), Z(-11.9 to 2.5)
    const min = bb.min;
    const max = bb.max;
    return {
      cx: (min.x + max.x) / 2,
      cy: (min.y + max.y) / 2,
      cz: (min.z + max.z) / 2,
      minY: min.y,
      maxY: max.y,
      radius: Math.max(max.x - min.x, max.z - min.z) / 2,
      height: max.y - min.y,
    };
  }, [clonedScene]);

  return (
    <group>
      <primitive
        object={clonedScene}
        position={position}
        scale={TOWER_SCALE}
        onClick={handleTowerClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      />
      {towerBounds && (
        <TowerLiquid
          towerBounds={towerBounds}
          position={position}
          /* Community tank fills relative to the whole field (OIL_FIELD_UNITS),
             not the $ prize pool — communityOil is in field units. */
          fill={Math.min(communityOil / OIL_FIELD_UNITS, 1)}
          scale={TOWER_SCALE}
        />
      )}
    </group>
  );
}

useGLTF.preload("/models/OilTower.glb");

// ── Animated amber border highlight for selected plot ───────────────────────
const _borderVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const _borderFrag = `
  uniform float uTime;
  uniform float uBorderWidth;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    float bw = uBorderWidth;
    float inside = step(bw, uv.x) * step(bw, uv.y) * step(bw, 1.0 - uv.x) * step(bw, 1.0 - uv.y);
    if (inside > 0.5) discard;

    // figure out which edge we're on and get a 0-1 coordinate along it
    float dL = uv.x;
    float dR = 1.0 - uv.x;
    float dB = uv.y;
    float dT = 1.0 - uv.y;
    float minD = min(min(dL, dR), min(dB, dT));

    float edge;
    if (minD == dB)      edge = uv.x;
    else if (minD == dR) edge = 1.0 + uv.y;
    else if (minD == dT) edge = 2.0 + (1.0 - uv.x);
    else                 edge = 3.0 + (1.0 - uv.y);

    // rectangular dashes — hard edges, marching around perimeter
    float dashes = 6.0;
    float duty = 0.6;
    float f = fract(edge * dashes - uTime * 0.8);
    float pattern = step(1.0 - duty, f);

    if (pattern < 0.5) discard;

    // warm amber
    vec3 amber = vec3(0.85, 0.65, 0.25);
    vec3 bright = vec3(1.0, 0.88, 0.5);
    float breath = 0.75 + 0.25 * sin(uTime * 1.5);
    vec3 col = mix(amber, bright, 0.4);
    float alpha = breath * 0.9;
    gl_FragColor = vec4(col, alpha);
  }
`;

function PlotBorderHighlight({ position, cellSize }) {
  const matRef = useRef();
  const shaderArgs = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uBorderWidth: { value: 0.035 },
    },
    vertexShader: _borderVert,
    fragmentShader: _borderFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -10,
    polygonOffsetUnits: -10,
  }), []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[cellSize, cellSize]} />
      <shaderMaterial ref={matRef} args={[shaderArgs]} />
    </mesh>
  );
}

// ── Idle-rig merge: collapse each idle plot's rig into ONE draw call ─────────
// Build the merged base rig geometry ONCE (per-vertex zone id + sampled base
// color tracked), then per plot clone it and compute just the color attribute
// from that plot's pumpConfig zone colors. ~1 draw call per idle rig.
const _MERGE_GRAY = new THREE.Color(0x8a8a8a);

// Cache a texture's full pixel data once (the model uses Synty-style color-swatch
// ATLASES, so we must sample at each part's UV, not average the whole atlas).
const _texDataCache = new WeakMap();
function getTexData(tex) {
  const img = tex?.image;
  if (!img || !img.width) return null;
  if (_texDataCache.has(tex)) return _texDataCache.get(tex);
  let entry = null;
  try {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    entry = { data: ctx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
  } catch { entry = null; }
  _texDataCache.set(tex, entry);
  return entry;
}
// Sample the atlas at a UV (glTF: flipY=false, UV origin top-left → canvas origin).
function sampleTexData(td, u, v, out) {
  u -= Math.floor(u); v -= Math.floor(v); // wrap into [0,1)
  const x = Math.min(td.w - 1, Math.max(0, (u * td.w) | 0));
  const y = Math.min(td.h - 1, Math.max(0, (v * td.h) | 0));
  const i = (y * td.w + x) * 4;
  return out.setRGB(td.data[i] / 255, td.data[i + 1] / 255, td.data[i + 2] / 255);
}

function buildBaseRig(scene) {
  scene.updateMatrixWorld(true);
  const geoms = [];
  const colorChunks = []; // Float32Array(count*3) per mesh, in merge order
  const metalChunks = []; // Float32Array(count) per mesh
  const roughChunks = []; // Float32Array(count) per mesh
  const rockChunks = [];  // Float32Array(count) per mesh — 1 = beam/horsehead (bobs)
  const zoneChunks = [];   // { zoneId, count } per mesh
  let bodyBox = null;      // Body_Pump (walking beam) bbox → saddle pivot estimate
  let wheelBox = null;     // Wheel_Back (crank) bbox → spin axle center
  let strawBox = null;     // Straw (polished rod) bbox → fallback travel reference
  let headBox = null;      // Head_Pump bbox → beam-tip attach the head+rod ride
  let pitBox = null;       // Cube (pitman / connecting rod) bbox → coupler endpoints
  let crankPinCentroid = null; // CrankPin_Mesh geometry centroid → exact pin attach
  const tmp = new THREE.Color();
  // Sign + frame are pulled OUT of the merge so they only appear on plots with
  // showSign (rendered per-plot by IdleSign). signGeo keeps UV for the image.
  let signGeo = null;
  const frameGeoms = [];
  const camGeoms = [];
  let strawXZ = null; // Straw (drill pipe) world XZ → the true wellhead center
  // Optional Blender markers (Empty or mesh) naming the EXACT pitman pivots — when
  // present they override the bbox estimates for a precise linkage. Read once here;
  // mesh-typed markers are also skipped in the traverse so they never render.
  const markerPos = (name) => {
    const o = scene.getObjectByName(name);
    if (!o) return null;
    const wp = new THREE.Vector3(); o.getWorldPosition(wp);
    return [wp.x, wp.y, wp.z];
  };
  // A single `<base>` marker (Empty), or the average of `<base>_Left` + `<base>_Right`
  // (handy when it's easier to snap one to each of Cube's two bars; they project to the
  // same in-plane point, so one centered marker is equivalent). Exact names only — a
  // geometry mesh like "CrankPin_Mesh" is NOT treated as a marker and renders normally.
  const markerAvg = (base) => {
    const single = markerPos(base);
    if (single) return single;
    const l = markerPos(`${base}_Left`), r = markerPos(`${base}_Right`);
    if (l && r) return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2];
    return l || r || null;
  };
  const crankPinMarker = markerAvg("CrankPin");   // crank throw point on Wheel_Back
  const beamPinMarker = markerAvg("BeamPin");      // equalizer attach point on the beam
  const crankAxleMarker = markerAvg("CrankAxle");  // crank rotation center (optional)
  scene.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (/^(CrankPin|BeamPin|CrankAxle)(_Left|_Right)?$/.test(child.name)) return; // hide only mesh markers, not "_Mesh" geometry
    if (child.name === "Envelope") return; // removed from scene
    if (child.name === "Straw") {
      const wp = new THREE.Vector3();
      child.getWorldPosition(wp);
      strawXZ = [wp.x, wp.z]; // scene space; scaled to cell-local on return
    }
    // Security camera — only on plots with showCamera (rendered by IdleSign)
    if (child.name.startsWith("Security_Camera")) {
      let cg = child.geometry.clone();
      cg.applyMatrix4(child.matrixWorld);
      if (cg.index) cg = cg.toNonIndexed();
      if (!cg.attributes.normal) cg.computeVertexNormals();
      const cn = cg.attributes.position.count;
      const ccol = new Float32Array(cn * 3);
      const cc = child.material?.color || _MERGE_GRAY;
      for (let i = 0; i < cn; i++) { ccol[i * 3] = cc.r; ccol[i * 3 + 1] = cc.g; ccol[i * 3 + 2] = cc.b; }
      cg.setAttribute("color", new THREE.BufferAttribute(ccol, 3));
      Object.keys(cg.attributes).forEach((a) => {
        if (a !== "position" && a !== "normal" && a !== "color") cg.deleteAttribute(a);
      });
      camGeoms.push(cg);
      return;
    }
    if (child.name === "Sign") {
      const sg = child.geometry.clone();
      sg.applyMatrix4(child.matrixWorld);
      Object.keys(sg.attributes).forEach((a) => {
        if (a !== "position" && a !== "normal" && a !== "uv") sg.deleteAttribute(a);
      });
      signGeo = sg;
      return;
    }
    if (child.name === "Sign_Back") return; // sign quad is double-sided
    if (child.name.startsWith("SignFrame")) {
      let fg = child.geometry.clone();
      fg.applyMatrix4(child.matrixWorld);
      if (fg.index) fg = fg.toNonIndexed();
      if (!fg.attributes.normal) fg.computeVertexNormals();
      const fn = fg.attributes.position.count;
      const fcol = new Float32Array(fn * 3);
      const fc = child.material?.color || _MERGE_GRAY;
      for (let i = 0; i < fn; i++) { fcol[i * 3] = fc.r; fcol[i * 3 + 1] = fc.g; fcol[i * 3 + 2] = fc.b; }
      fg.setAttribute("color", new THREE.BufferAttribute(fcol, 3));
      Object.keys(fg.attributes).forEach((a) => {
        if (a !== "position" && a !== "normal" && a !== "color") fg.deleteAttribute(a);
      });
      frameGeoms.push(fg);
      return;
    }
    let g = child.geometry.clone();
    g.applyMatrix4(child.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    const uv = g.attributes.uv;

    // Exact crank-pin attach: centroid of the VISIBLE pin geometry (world space). Cube's
    // bottom pins here so it rides the real pin, not a marker that may sit ahead of it.
    if (child.name === "CrankPin_Mesh") {
      const pp = g.attributes.position; let sx = 0, sy = 0, sz = 0;
      for (let i = 0; i < n; i++) { sx += pp.getX(i); sy += pp.getY(i); sz += pp.getZ(i); }
      crankPinCentroid = [sx / n, sy / n, sz / n];
    }

    // Moving parts, tagged per-vertex (aPart) for the shared merged material's
    // shader (see ANIM_FIELD injection):
    //   1 = walking beam (Body_Pump) + the equalizer bar (Cylinder), rocking about the
    //       saddle.
    //   2 = crank — Wheel_Back (crankshaft + wheels) + CrankPin_Mesh (the pin geometry),
    //       continuous spin about the axle (the pin orbits to stay under Cube's bottom).
    //   3 = head assembly — horsehead (Head_Pump) + polished rod (Straw) + the bridle/
    //       carrier pieces (Cylinder_Pump, Cylinder_Pump.001), all on the SAME bone
    //       (Armature.001). Ride the beam tip via pure translation, keeping their rest
    //       (upright) orientation so the head stays vertical and the rod stays plumb.
    //       NB: the head intentionally does NOT rock with the beam. Rocking it seals the
    //       beam/head joint but then the tilting head separates from the plumb rod — a
    //       worse artifact, since the rod is locked to a fixed wellhead and can't follow.
    //       A perfect fit needs a modeled flexible bridle (cable rolling over the head
    //       curve), which this rigid-part shader can't express. Keep the head upright.
    //   4 = pitman / connecting rod (Cube) — bottom pinned to the crank throw (orbits),
    //       top pinned to the equalizer; rigid coupler solved by the four-bar so it
    //       stays welded at both ends without deforming.
    const ROCK_MESHES = ["Body_Pump", "Cylinder"];
    const SPIN_MESHES = ["Wheel_Back", "CrankPin_Mesh"];
    const STROKE_MESHES = ["Straw", "Head_Pump", "Cylinder_Pump", "Cylinder_Pump.001"];
    const isRock = ROCK_MESHES.includes(child.name);
    const isSpin = SPIN_MESHES.includes(child.name);
    const isStroke = STROKE_MESHES.includes(child.name);
    const isPitman = child.name === "Cube";
    if (child.name === "Body_Pump") {
      g.computeBoundingBox();
      bodyBox = g.boundingBox.clone(); // merged-space; saddle sits at its top-center
    }
    if (child.name === "Wheel_Back") {
      g.computeBoundingBox();
      wheelBox = g.boundingBox.clone(); // crank axle ≈ wheel bbox center
    }
    if (child.name === "Straw") {
      g.computeBoundingBox();
      strawBox = g.boundingBox.clone(); // rod bbox (fallback travel reference)
    }
    if (child.name === "Head_Pump") {
      g.computeBoundingBox();
      headBox = g.boundingBox.clone(); // head top ≈ beam tip → the attach point it rides
    }
    if (isPitman) {
      g.computeBoundingBox();
      pitBox = g.boundingBox.clone(); // bottom = crank-pin end, top = beam end
    }
    const rockArr = new Float32Array(n);
    if (isRock) rockArr.fill(1);
    else if (isSpin) rockArr.fill(2);
    else if (isStroke) rockArr.fill(3);
    else if (isPitman) rockArr.fill(4);

    let zoneId = MESH_TO_ZONE[child.name];
    if (!zoneId && child.name?.startsWith("SignFrame")) zoneId = "signFrame";

    // Per-vertex base color: sample the atlas swatch at each vertex's UV; for
    // untextured (flat-material) parts use the material color. This reproduces
    // the textured look (copper pipes etc.) on the merged rig in one draw call.
    const hasMap = !!child.material?.map;
    const td = hasMap ? getTexData(child.material.map) : null;
    const cols = new Float32Array(n * 3);
    if (td && uv) {
      for (let i = 0; i < n; i++) {
        sampleTexData(td, uv.getX(i), uv.getY(i), tmp);
        cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
      }
    } else {
      const c = child.material?.color || _MERGE_GRAY;
      for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    }

    // Per-vertex finish: textured "detail/metal" parts read reflective; flat
    // painted parts stay more matte. Drives the material via onBeforeCompile.
    const metalVal = hasMap ? 0.8 : 0.3;
    const roughVal = hasMap ? 0.4 : 0.5;
    const mArr = new Float32Array(n); mArr.fill(metalVal);
    const rArr = new Float32Array(n); rArr.fill(roughVal);

    Object.keys(g.attributes).forEach((a) => {
      if (a !== "position" && a !== "normal") g.deleteAttribute(a);
    });
    geoms.push(g);
    colorChunks.push(cols);
    metalChunks.push(mArr);
    roughChunks.push(rArr);
    rockChunks.push(rockArr);
    zoneChunks.push({ zoneId: zoneId || null, count: n });
  });
  const geometry = mergeGeometries(geoms, false);
  geometry.computeBoundingSphere();
  geoms.forEach((g) => g.dispose());

  // Per-vertex zone id + base color, aligned to the merged vertex order.
  // Metalness/roughness are config-independent → bake straight onto the base
  // geometry as attributes (clone() copies them to every plot).
  const total = geometry.attributes.position.count;
  const vZone = new Array(total);
  const vBase = new Float32Array(total * 3);
  const aMetal = new Float32Array(total);
  const aRough = new Float32Array(total);
  const aPart = new Float32Array(total);
  let o = 0, co = 0;
  for (let k = 0; k < colorChunks.length; k++) {
    const cols = colorChunks[k];
    const z = zoneChunks[k];
    vBase.set(cols, co); co += cols.length;
    aMetal.set(metalChunks[k], o);
    aRough.set(roughChunks[k], o);
    aPart.set(rockChunks[k], o);
    for (let i = 0; i < z.count; i++) vZone[o + i] = z.zoneId;
    o += z.count;
  }
  geometry.setAttribute("aMetalness", new THREE.BufferAttribute(aMetal, 1));
  geometry.setAttribute("aRoughness", new THREE.BufferAttribute(aRough, 1));
  geometry.setAttribute("aPart", new THREE.BufferAttribute(aPart, 1));

  // Pivots/axis for the shader-driven motion (ANIM_FIELD). The beam rocks about
  // the saddle (top-center of Body_Pump) around the horizontal axis perpendicular
  // to its long span; the crank spins about its own axle (Wheel_Back center), same
  // axis orientation (it turns in the beam's vertical plane).
  let rock = null;
  if (bodyBox) {
    const c = new THREE.Vector3(); bodyBox.getCenter(c);
    const size = new THREE.Vector3(); bodyBox.getSize(size);
    const pivotY = c.y + (bodyBox.max.y - c.y) * FIELD_PUMP_PIVOT_FRAC;
    // Longer horizontal extent = beam length → rock about the perpendicular axis.
    const axis = size.x >= size.z ? [0, 0, 1] : [1, 0, 0];
    let crankPivot = [c.x, c.y, c.z];
    if (wheelBox) { const wc = new THREE.Vector3(); wheelBox.getCenter(wc); crankPivot = [wc.x, wc.y, wc.z]; }
    if (crankAxleMarker) crankPivot = crankAxleMarker; // exact rotation center (optional)
    // Travel reference for the head+rod group: the head's attach to the beam (its top ≈
    // the beam tip). Rotating THIS point about the saddle gives the beam-tip arc, applied
    // as pure translation — so the head rides the tip (stays attached) and stays upright,
    // and the rod rides with it. (Straw top is a fallback if the head isn't present.)
    let strawRef = [c.x, c.y, c.z];
    if (headBox) { const hc = new THREE.Vector3(); headBox.getCenter(hc); strawRef = [hc.x, headBox.max.y, hc.z]; }
    else if (strawBox) { const sc = new THREE.Vector3(); strawBox.getCenter(sc); strawRef = [sc.x, strawBox.max.y, sc.z]; }
    // Pitman endpoints. Cube is TWO parallel bars, so its bbox is widest along the
    // axle (the gap between them) — useless for finding the rod's ends. Collapse the
    // axle direction and work in the rocking plane (u = in-plane horizontal, v = Y):
    // the rod's two ends are diagonal bbox corners. Crank end = corner nearest the
    // wheel center (sits on the throw); beam end = the diagonally-opposite corner.
    let pitmanA = crankPivot, pitmanB = [c.x, c.y, c.z];
    if (pitBox) {
      const pc = new THREE.Vector3(); pitBox.getCenter(pc);
      const axleIsZ = axis[2] === 1;
      const axleC = axleIsZ ? pc.z : pc.x;                 // centre the bars on the axle
      const uLo = axleIsZ ? pitBox.min.x : pitBox.min.z;
      const uHi = axleIsZ ? pitBox.max.x : pitBox.max.z;
      const yLo = pitBox.min.y, yHi = pitBox.max.y;
      const mk = (u, y) => (axleIsZ ? [u, y, axleC] : [axleC, y, u]);
      const corners = [mk(uLo, yLo), mk(uLo, yHi), mk(uHi, yLo), mk(uHi, yHi)];
      const oppo    = [mk(uHi, yHi), mk(uHi, yLo), mk(uLo, yHi), mk(uLo, yLo)]; // diagonal
      const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      let bi = 0;
      for (let i = 1; i < 4; i++) if (d2(corners[i], crankPivot) < d2(corners[bi], crankPivot)) bi = i;
      pitmanA = corners[bi]; pitmanB = oppo[bi];
    }
    // Exact Blender markers win over the bbox estimates.
    if (crankPinMarker) pitmanA = crankPinMarker;
    if (beamPinMarker) pitmanB = beamPinMarker;
    // The VISIBLE pin geometry centroid wins over the marker — it's the ground truth for
    // "where Cube touches the wheel," so they can't disagree.
    if (crankPinCentroid) pitmanA = crankPinCentroid;
    // Seat Cube's crank attach onto the visible pin: rotate it around the axle by
    // FIELD_CRANK_PIN_ANGLE (tangential), then scale its radius by FIELD_CRANK_PIN_SCALE
    // (radial). Applies to marker OR estimate, so it's dial-able either way.
    if (FIELD_CRANK_PIN_ANGLE !== 0 || FIELD_CRANK_PIN_SCALE !== 1) {
      const vx = pitmanA[0] - crankPivot[0], vy = pitmanA[1] - crankPivot[1], vz = pitmanA[2] - crankPivot[2];
      const a = FIELD_CRANK_PIN_ANGLE, c = Math.cos(a), s = Math.sin(a), k = FIELD_CRANK_PIN_SCALE;
      const dot = axis[0] * vx + axis[1] * vy + axis[2] * vz;
      const crx = axis[1] * vz - axis[2] * vy, cry = axis[2] * vx - axis[0] * vz, crz = axis[0] * vy - axis[1] * vx;
      pitmanA = [
        crankPivot[0] + (vx * c + crx * s + axis[0] * dot * (1 - c)) * k,
        crankPivot[1] + (vy * c + cry * s + axis[1] * dot * (1 - c)) * k,
        crankPivot[2] + (vz * c + crz * s + axis[2] * dot * (1 - c)) * k,
      ];
    }
    rock = { pivot: [c.x, pivotY, c.z], axis, crankPivot, strawRef, pitmanA, pitmanB };
  }

  let signFrameGeo = null;
  if (frameGeoms.length) {
    signFrameGeo = mergeGeometries(frameGeoms, false);
    signFrameGeo.computeBoundingSphere();
    frameGeoms.forEach((g) => g.dispose());
  }
  let signCamGeo = null;
  if (camGeoms.length) {
    signCamGeo = mergeGeometries(camGeoms, false);
    signCamGeo.computeBoundingSphere();
    camGeoms.forEach((g) => g.dispose());
  }
  // Wellhead in cell-local space: Straw world XZ × render scale, just above the
  // pad. Cache module-level so the close-up WellGlow uses the same point.
  const wellhead = strawXZ
    ? [strawXZ[0] * PUMPJACK_SCALE, WELLHEAD_OFFSET[1], strawXZ[1] * PUMPJACK_SCALE]
    : [...WELLHEAD_OFFSET];
  _rigWellhead = wellhead;
  return { geometry, vZone, vBase, total, signGeo, signFrameGeo, signCamGeo, wellhead, rock };
}

function rigColorAttribute(base, config) {
  const { vZone, vBase, total } = base;
  const colors = new Float32Array(total * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < total; i++) {
    const zid = vZone[i];
    // Per-player color wins; otherwise the Lyquid80 brand default for the zone;
    // otherwise the model's baked atlas color (vBase).
    const paint = (zid && config?.[zid]?.color) || (zid && DEFAULT_RIG_TINT[zid]);
    if (paint) {
      tmp.set(paint);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    } else {
      colors[i * 3] = vBase[i * 3]; colors[i * 3 + 1] = vBase[i * 3 + 1]; colors[i * 3 + 2] = vBase[i * 3 + 2];
    }
  }
  return new THREE.BufferAttribute(colors, 3);
}

// Distance-gated wrapper for the EXPENSIVE animated add-ons (per-frame mixers).
// Mounts within `threshold` and scales in over ~0.25s so they ease in instead
// of popping; stays mounted through a brief scale-out before unmounting.
function FadeInGroup({ position, threshold, children }) {
  const [mounted, setMounted] = useState(false);
  const grpRef = useRef();
  const appear = useRef(0);
  const target = useRef(0);
  const skip = useRef(0);
  const _v = useMemo(() => new THREE.Vector3(position[0], position[1], position[2]), [position]);
  useFrame(({ camera }, delta) => {
    skip.current = (skip.current + 1) % 5;
    if (skip.current === 0) {
      const d = camera.position.distanceTo(_v);
      const want = target.current > 0.5 ? d < threshold * 1.3 : d < threshold;
      target.current = want ? 1 : 0;
      if (want && !mounted) setMounted(true);
    }
    if (!mounted || !grpRef.current) return;
    appear.current += (target.current - appear.current) * Math.min(delta * 4, 1);
    grpRef.current.scale.setScalar(Math.max(appear.current, 0.0001));
    if (target.current === 0 && appear.current < 0.02) setMounted(false);
  });
  if (!mounted) return null;
  return <group ref={grpRef} position={position} scale={0.0001}>{children}</group>;
}

// Animated add-ons only (per-frame mixers — can't be instanced). Distance-gated
// via FadeInGroup. Static add-ons/fences/signs are instanced in StaticDecoField.
function IdleDecorations({ position, config, threshold }) {
  const animAddons = useMemo(() => {
    const a = {};
    Object.entries(config.addons || {}).forEach(([slot, val]) => {
      const id = typeof val === "string" ? val : val?.id;
      const item = ADDON_CATALOG.find((c) => c.id === id);
      if (item?.animated) a[slot] = val;
    });
    return a;
  }, [config.addons]);
  if (Object.keys(animAddons).length === 0) return null;
  return (
    <FadeInGroup position={position} threshold={threshold}>
      <PlotAddons addons={animAddons} />
    </FadeInGroup>
  );
}

// ── Instanced static decorations — one draw call per type across the field ───
// Instance every sub-mesh of a GLB model across all its placements.
function InstancedGLB({ model, placements, scale }) {
  const { scene } = useGLTF(model);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out = [];
    scene.traverse((c) => {
      if (c.isMesh && c.geometry) {
        const g = c.geometry.clone();
        g.applyMatrix4(c.matrixWorld);
        out.push({ geometry: g, material: c.material });
      }
    });
    return out;
  }, [scene]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const refs = useRef([]);
  useEffect(() => {
    const dummy = new THREE.Object3D();
    parts.forEach((_, mi) => {
      const inst = refs.current[mi];
      if (!inst) return;
      placements.forEach((p, i) => {
        const sx = p.slot ? p.slot.x : 0, sy = p.slot ? p.slot.y : 0, sz = p.slot ? p.slot.z : 0;
        dummy.position.set(p.pos[0] + sx, p.pos[1] + sy, p.pos[2] + sz);
        dummy.rotation.set(0, p.rotY || 0, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
    });
  }, [parts, placements, scale]);
  if (!placements.length) return null;
  return parts.map((p, mi) => (
    <instancedMesh key={mi} ref={(el) => { refs.current[mi] = el; }} args={[p.geometry, p.material, placements.length]} />
  ));
}

// Instance a single (already rig-local) geometry across plot positions.
function InstancedGeo({ geometry, material, positions, scale }) {
  const ref = useRef();
  useEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    positions.forEach((pos, i) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [geometry, positions, scale]);
  if (!geometry || !positions.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, positions.length]} />;
}

// ── Wellhead glow (Lyquid80 signature bloom) ─────────────────────────────────
// Close-up version for the full Pumpjack: a pulsing additive disc + faint point
// light at the wellhead, brightening briefly on a strike. Self-contained so it
// can't desync the rig's own animation state.
function WellGlow({ position, strike = 0, hell = false }) {
  const matRef = useRef();
  const t = useRef(0);
  // `strike` is a persistent value (the struck amount), not a flag — so flare on
  // a *change* of it, then decay, instead of glowing constantly while it's > 0.
  const prevStrike = useRef(strike);
  const boost = useRef(0);
  const _cyan = useMemo(() => new THREE.Color(WELLHEAD_GLOW), []);
  const _hellRed = useMemo(() => new THREE.Color("#ff2a10"), []);
  useFrame((_, delta) => {
    t.current += delta;
    if (strike !== prevStrike.current) {
      if (strike > 0) boost.current = 1;
      prevStrike.current = strike;
    }
    boost.current = Math.max(0, boost.current - delta * 0.7); // ~1.4s flare decay
    if (!matRef.current) return;
    if (hell) {
      // The well the demon erupts from glows a hot, fast-pulsing red.
      matRef.current.color.copy(_hellRed);
      matRef.current.opacity = 0.55 + 0.4 * Math.abs(Math.sin(t.current * 6));
    } else {
      matRef.current.color.copy(_cyan);
      matRef.current.opacity = 0.34 + 0.12 * Math.sin(t.current * 2.2) + boost.current * 0.7;
    }
  });
  return (
    <group position={position || _rigWellhead}>
      {/* Sunk into the hole; depthTest (default on) lets the pad rim mask the
          overhang, so the bloom stays inside the hole instead of washing the pad. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WELLHEAD_GLOW_DROP, 0]} renderOrder={8}>
        <planeGeometry args={[WELLHEAD_GLOW_SIZE, WELLHEAD_GLOW_SIZE]} />
        <meshBasicMaterial
          ref={matRef}
          color={WELLHEAD_GLOW}
          transparent
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Field version: ONE instanced additive disc across every plot's wellhead, plus a
// single shared throttled pulse — so the idle field glow costs ~1 draw call and
// 1 useFrame, preserving the merged field's perf win.
function WellGlowField({ positions }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.09, 0.09); // square — matches the well hole
    g.rotateX(-Math.PI / 2); // lie flat on the ground (InstancedGeo can't rotate)
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: WELLHEAD_GLOW, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere?.();
  }, [positions]);
  const t = useRef(0);
  const skip = useRef(0);
  useFrame((_, delta) => {
    skip.current = (skip.current + 1) % 3; // throttle — it's a distant idle glow
    if (skip.current) return;
    t.current += delta * 3;
    mat.opacity = 0.18 + 0.07 * Math.sin(t.current);
  });
  if (!positions.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, positions.length]} />;
}

// Presentational LED readout for a screen (close-up rig only). Renders `token` in
// `idleHex` with a gentle "alive" pulse; flares toward white whenever `flareKey`
// changes to a positive value (depth uses oilStrike; pressure passes 0). When `alarm`
// (a hell event) it overrides to a hard red strobe matching the alert beacon (~4 Hz).
// Anchored to a screen's transform { pos, quat, w, h } when fromMesh, else docked.
function PanelReadout({ pos, quat, w, h, fromMesh = false, token = "", label = "", idleHex = "#ffae00", flareKey = 0, alarm = false }) {
  const matRef = useRef();
  const t = useRef(0);
  const prevFlare = useRef(flareKey);
  const boost = useRef(0);
  const _base = useMemo(() => new THREE.Color(), []);
  const _white = useMemo(() => new THREE.Color("#fff2c8"), []);
  const _red = useMemo(() => new THREE.Color("#ff2a14"), []);
  useFrame((_, dt) => {
    t.current += dt;
    if (flareKey !== prevFlare.current) {
      if (flareKey > 0) boost.current = 1;
      prevFlare.current = flareKey;
    }
    boost.current = Math.max(0, boost.current - dt * 0.6); // ~1.6s flare
    if (!matRef.current) return;
    if (alarm) {
      // Hell strobe — same 4 Hz square as the alert beacon (Math.sin(t*25) > 0)
      const on = Math.sin(t.current * 25) > 0;
      _base.copy(_red).multiplyScalar(on ? 1 : 0.25);
      matRef.current.color.copy(_base);
      matRef.current.opacity = on ? 1 : 0.12;
    } else {
      const pulse = 0.72 + 0.18 * Math.sin(t.current * 3); // gentle "alive" flicker
      _base.set(idleHex).multiplyScalar(pulse);
      _base.lerp(_white, Math.min(boost.current, 1) * 0.85);
      matRef.current.color.copy(_base);
      matRef.current.opacity = 1;
    }
  });
  const digits = (
    <Text
      fontSize={fromMesh ? (h || 0.05) * PANEL_GLYPH_FRAC : PANEL_READOUT_SIZE}
      maxWidth={fromMesh ? (w || 0.1) * 0.94 : undefined}
      anchorX="center"
      anchorY="middle"
      letterSpacing={0.05}
      color={idleHex}
      font={undefined}
      renderOrder={999}
    >
      {token}
      <meshBasicMaterial ref={matRef} attach="material" color={idleHex} toneMapped={false} transparent depthWrite={false} side={THREE.DoubleSide} />
    </Text>
  );
  // Small dim caption above the digits (e.g. "DEPTH"). sh = screen height so it
  // scales with the readout. Sits near the top; digits nudge down to make room.
  const caption = (sh) => label ? (
    <Text
      position={[0, sh * 0.34, 0]}
      fontSize={sh * 0.19}
      anchorX="center"
      anchorY="middle"
      letterSpacing={0.12}
      color={idleHex}
      font={undefined}
      renderOrder={999}
    >
      {label}
      <meshBasicMaterial attach="material" color={idleHex} toneMapped={false} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
    </Text>
  ) : null;

  // Mesh-driven: the digits lie directly on the PressurePanel2 quad (the mesh is the
  // screen, so no generated backing). Orientation comes from the quad's quaternion.
  if (fromMesh) {
    const sh = h || 0.05;
    return (
      <group position={pos} quaternion={quat}>
        <group rotation={PANEL_MESH_ROT}>
          {/* lift inside the rotated frame so it pushes along the face normal */}
          <group position={[0, 0, PANEL_TEXT_LIFT]}>
            {caption(sh)}
            <group position={[0, label ? -sh * 0.1 : 0, 0]}>{digits}</group>
          </group>
        </group>
      </group>
    );
  }
  // Fallback (pre-export): world-oriented docked LED with its own dark backing.
  return (
    <group position={pos}>
      <group rotation={PANEL_READOUT_ROT} position={PANEL_READOUT_OFFSET}>
        <mesh position={[0, 0, -0.002]} renderOrder={998}>
          <planeGeometry args={[PANEL_SCREEN_W, PANEL_SCREEN_H]} />
          <meshBasicMaterial color="#070a08" transparent opacity={0.92} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {caption(PANEL_SCREEN_H)}
        <group position={[0, label ? -PANEL_SCREEN_H * 0.1 : 0, 0]}>{digits}</group>
      </group>
    </group>
  );
}

// Sign image quads sharing one texture → one instanced draw call per image URL.
function InstancedSign({ geometry, url, positions }) {
  const ref = useRef();
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(url, (t) => {
      if (!alive) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.x = -1; t.offset.x = 1;
      setTex(t);
    });
    return () => { alive = false; };
  }, [url]);
  useEffect(() => () => tex?.dispose(), [tex]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffffff, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.0,
  }), []);
  useEffect(() => {
    if (!tex) return;
    mat.map = tex; mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = tex; mat.emissiveIntensity = SIGN_EMISSIVE_INTENSITY; mat.needsUpdate = true;
  }, [tex, mat]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    positions.forEach((pos, i) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.scale.setScalar(PUMPJACK_SCALE);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [positions, tex]);
  if (!geometry || !positions.length || !tex) return null;
  return <instancedMesh ref={ref} args={[geometry, mat, positions.length]} />;
}

// ── Catalog signs (separate GLBs, per-plot image) ────────────────────────────
// A sign is its own model now (not baked into the rig). For each plot with showSign
// we load the chosen SIGN_CATALOG entry, paint the player's image (emissive backlit)
// onto its Sign/Sign2 faces, and mount the matching camera GLB when showCamera.
// Rendered per-plot (signs are opt-in, so counts are low); group by image URL later
// if they get common. All meshes ride one group at the plot origin — the model bakes
// the offset-to-the-side and the camera GLB is pre-registered to the same space.
// Measure a sign face's display aspect (width / height) from its geometry. Signs stand
// upright, so the vertical extent is height (Y) and the larger horizontal extent is the
// width; the smallest extent is the panel thickness. The parent group only applies
// uniform scale + translation, which don't change the ratio, so local bounds suffice.
function signFaceAspect(geometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  const width = Math.max(sx, sz);
  const height = sy;
  return (width > 1e-6 && height > 1e-6) ? width / height : 1;
}

function tuneSignTexture(tex, gl) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // match the model's glTF UVs (loaders default to true → upside down)
  tex.anisotropy = gl.capabilities.getMaxAnisotropy(); // sharpest at grazing angles
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Map an uploaded image onto a sign face under one of three fit modes:
//   fill    — cover the face, crop overflow, no distortion (default)
//   fit     — show the whole image, letterboxed with black bars
//   stretch — fill the face edge-to-edge (legacy; may distort)
function buildSignTexture(image, faceAspect, mode, gl) {
  const imgAspect = (image.width || 1) / (image.height || 1);
  if (mode === "fit") {
    // Letterbox onto a face-aspect canvas with black bars. Black reads as "unlit" on the
    // emissive panel, so the bars look intentional rather than smearing the edge pixels.
    const longEdge = Math.min(2048, Math.max(image.width, image.height) || 1024);
    let cw, ch;
    if (faceAspect >= 1) { cw = longEdge; ch = Math.max(1, Math.round(longEdge / faceAspect)); }
    else { ch = longEdge; cw = Math.max(1, Math.round(longEdge * faceAspect)); }
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    let dw, dh;
    if (imgAspect > faceAspect) { dw = cw; dh = cw / imgAspect; }
    else { dh = ch; dw = ch * imgAspect; }
    ctx.drawImage(image, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    return tuneSignTexture(new THREE.CanvasTexture(canvas), gl);
  }
  const tex = tuneSignTexture(new THREE.Texture(image), gl);
  if (mode === "fill") {
    // Cover: sample the largest centered sub-rect whose aspect matches the face.
    const ratio = faceAspect / imgAspect;
    let rx = 1, ry = 1;
    if (ratio < 1) rx = ratio;   // image wider than face → crop the sides
    else ry = 1 / ratio;         // image taller than face → crop top/bottom
    tex.repeat.set(rx, ry);
    tex.offset.set((1 - rx) / 2, (1 - ry) / 2);
  }
  // mode === "stretch": leave repeat (1,1) / offset (0,0) — fills exactly, may distort.
  return tex;
}

function SignModel({ model, signImageUrl, signFit = "fill" }) {
  const { scene } = useGLTF(model);
  const { gl } = useThree();
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // Clone the image-face materials so a per-plot texture can't leak to other signs.
    // Stash the pristine (no-image) material state so Clear can restore the blank panel.
    c.traverse((ch) => {
      if (ch.isMesh && (ch.name === "Sign" || ch.name === "Sign2")) {
        ch.material = ch.material.clone();
        const m = ch.material;
        ch.userData._origMat = {
          map: m.map, emissiveMap: m.emissiveMap,
          emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity,
          color: m.color.clone(), roughness: m.roughness, metalness: m.metalness,
          normalMap: m.normalMap, roughnessMap: m.roughnessMap,
          metalnessMap: m.metalnessMap, aoMap: m.aoMap,
        };
      }
    });
    return c;
  }, [scene]);
  useEffect(() => () => {
    // Only dispose the cloned materials — the maps are either shared with the cached GLTF
    // (must not dispose) or our per-face textures (disposed by the texture effect below).
    cloned.traverse((ch) => {
      if (ch.isMesh && (ch.name === "Sign" || ch.name === "Sign2")) ch.material.dispose();
    });
  }, [cloned]);
  useEffect(() => {
    let alive = true;
    const created = []; // per-mesh textures we build this run, disposed on change/unmount
    // No image → restore each face to its pristine blank state (this is what makes Clear work).
    if (!signImageUrl) {
      cloned.traverse((ch) => {
        const o = ch.userData?._origMat;
        if (ch.isMesh && (ch.name === "Sign" || ch.name === "Sign2") && o) {
          const m = ch.material;
          m.map = o.map; m.emissiveMap = o.emissiveMap;
          m.emissive.copy(o.emissive); m.emissiveIntensity = o.emissiveIntensity;
          m.color.copy(o.color); m.roughness = o.roughness; m.metalness = o.metalness;
          m.normalMap = o.normalMap; m.roughnessMap = o.roughnessMap;
          m.metalnessMap = o.metalnessMap; m.aoMap = o.aoMap;
          m.needsUpdate = true;
        }
      });
      return () => { alive = false; };
    }
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(signImageUrl, (loaded) => {
      if (!alive) { loaded.dispose(); return; }
      const image = loaded.image;
      cloned.traverse((ch) => {
        if (ch.isMesh && (ch.name === "Sign" || ch.name === "Sign2")) {
          // Build a texture per face so fill-crop (repeat/offset) and letterbox sizing
          // can follow each face's own aspect ratio (front/back can differ).
          const tex = buildSignTexture(image, signFaceAspect(ch.geometry), signFit, gl);
          created.push(tex);
          const m = ch.material;
          m.map = tex;
          m.color = new THREE.Color(0xffffff);
          m.metalness = 0;
          m.roughness = 0.6;
          // Clear any inherited maps that would muddy/desaturate the image.
          m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null; m.aoMap = null;
          m.emissive = new THREE.Color(0xffffff);
          m.emissiveMap = tex;
          m.emissiveIntensity = SIGN_EMISSIVE_INTENSITY;
          m.needsUpdate = true;
        }
      });
      loaded.dispose(); // per-mesh textures hold their own copy of the image
    });
    return () => { alive = false; created.forEach((t) => t.dispose()); };
  }, [cloned, signImageUrl, signFit, gl]);
  return <primitive object={cloned} />;
}

// Catalog camera. When `active` (this plot is focused + showCamera), it sweeps its
// Security_Camera mesh and feeds the world transform to the shared CCTV renderer —
// the same protocol the embedded camera used, just sourced from the sign model.
function SignCameraModel({ model, active }) {
  const { scene } = useGLTF(model);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const camRef = useRef(null);
  const baseRotY = useRef(null);
  useEffect(() => {
    cloned.traverse((c) => { if (c.name === "Security_Camera") camRef.current = c; });
    if (camRef.current && baseRotY.current === null) baseRotY.current = camRef.current.rotation.y;
  }, [cloned]);
  useEffect(() => () => {
    if (camRef.current && _cctvState.ownerId === camRef.current.uuid) {
      _cctvState.active = false; _cctvState.ownerId = null;
    }
  }, []);
  useFrame(() => {
    const cam = camRef.current;
    if (!cam || baseRotY.current === null) return;
    if (active) {
      if (!_cctvState.pauseSweep) {
        const sweep = 90 * (Math.PI / 180);
        const baseOffset = 45 * (Math.PI / 180);
        const period = 12; // seconds for a full back-and-forth
        const t = (Math.sin(performance.now() * 0.001 * (2 * Math.PI / period)) + 1) / 2;
        cam.rotation.y = baseRotY.current + baseOffset + t * sweep;
      }
      cam.updateWorldMatrix(true, false);
      cam.getWorldPosition(_cctvState.worldPos);
      cam.getWorldQuaternion(_cctvState.worldQuat);
      _cctvState.worldMatrix.copy(cam.matrixWorld);
      _cctvState.active = true;
      _cctvState.ownerId = cam.uuid;
    } else if (_cctvState.active && _cctvState.ownerId === cam.uuid) {
      _cctvState.active = false; _cctvState.ownerId = null;
    }
  });
  return <primitive object={cloned} />;
}

function PlotSign({ position, signImageUrl, signStyle, signFit = "fill", showCamera, isSelected, cameraViewable = true }) {
  const entry = SIGN_CATALOG.find((s) => s.id === signStyle) || SIGN_CATALOG[0];
  if (!entry) return null;
  return (
    <group position={position} scale={PUMPJACK_SCALE}>
      <SignModel model={entry.model} signImageUrl={signImageUrl} signFit={signFit} />
      {/* Camera model still renders for everyone; the live feed (active) only for the owner. */}
      {showCamera && entry.cameraModel && <SignCameraModel model={entry.cameraModel} active={!!isSelected && cameraViewable} />}
    </group>
  );
}

// One sign per plot with showSign (the image is optional — a blank panel shows until
// one is set). The selected plot uses the LIVE pumpConfig so toggles show instantly;
// other plots read the saved allPumpConfigs map.
function PlotSignField({ items, allPumpConfigs, pumpConfig, selectedCol, selectedRow, cameraViewable = true }) {
  const signs = useMemo(() => {
    const out = [];
    items.forEach((it) => {
      const isSel = it.col === selectedCol && it.row === selectedRow;
      const cfg = (isSel && pumpConfig) ? pumpConfig : allPumpConfigs[`${it.col}_${it.row}`]?.config;
      if (cfg?.showSign) {
        out.push({ key: it.key, position: it.position, signImageUrl: cfg.signImageUrl || null, signStyle: cfg.signStyle, signFit: cfg.signFit || "fill", showCamera: cfg.showCamera, isSelected: isSel });
      }
    });
    return out;
  }, [items, allPumpConfigs, pumpConfig, selectedCol, selectedRow]);
  return signs.map((s) => (
    <PlotSign key={s.key} position={s.position} signImageUrl={s.signImageUrl} signStyle={s.signStyle} signFit={s.signFit} showCamera={s.showCamera} isSelected={s.isSelected} cameraViewable={cameraViewable} />
  ));
}
SIGN_CATALOG.forEach((s) => { useGLTF.preload(s.model); if (s.cameraModel) useGLTF.preload(s.cameraModel); });

// Gather all idle-plot static decorations and render them as instanced batches.
function StaticDecoField({ items, allPumpConfigs, selectedCol, selectedRow, fullRigCells, base, frameMat }) {
  const groups = useMemo(() => {
    const addonGroups = {};   // model -> [{pos, slot, rotY}]
    const fenceGroups = {};   // model -> { scale, list:[{pos}] }
    const framePositions = []; // showSign plots
    const camPositions = [];   // showCamera plots
    const signGroups = {};     // imageUrl -> [pos]
    items.forEach((it) => {
      if (it.col === selectedCol && it.row === selectedRow) return;
      // Skip cells served by a full animated rig (selected or live gusher) — that
      // rig draws its own signs/frames/cameras/add-ons.
      if (fullRigCells?.has(`${it.col}_${it.row}`)) return;
      const cfg = allPumpConfigs[`${it.col}_${it.row}`]?.config;
      if (!cfg) return;
      Object.entries(cfg.addons || {}).forEach(([slotKey, val]) => {
        const id = typeof val === "string" ? val : val?.id;
        const rot = typeof val === "string" ? 0 : (val?.rot || 0);
        const item = ADDON_CATALOG.find((c) => c.id === id);
        if (!item || item.animated || !item.model) return; // animated handled per-plot
        const slot = ADDON_SLOTS[parseInt(slotKey, 10)];
        if (!slot) return;
        (addonGroups[item.model] ||= []).push({ pos: it.position, slot, rotY: rot * Math.PI / 2 });
      });
      if (cfg.fenceType) {
        const f = FENCE_CATALOG.find((c) => c.id === cfg.fenceType);
        if (f) { (fenceGroups[f.model] ||= { scale: f.scale, list: [] }).list.push({ pos: it.position }); }
      }
      if (cfg.showSign) {
        framePositions.push(it.position);
        if (cfg.showCamera) camPositions.push(it.position);
        if (cfg.signImageUrl) (signGroups[cfg.signImageUrl] ||= []).push(it.position);
      }
    });
    return { addonGroups, fenceGroups, framePositions, camPositions, signGroups };
  }, [items, allPumpConfigs, selectedCol, selectedRow, fullRigCells]);

  return (
    <>
      {Object.entries(groups.addonGroups).map(([model, placements]) => (
        <InstancedGLB key={`a-${model}`} model={model} placements={placements} scale={PUMPJACK_SCALE} />
      ))}
      {Object.entries(groups.fenceGroups).map(([model, { scale, list }]) => (
        <InstancedGLB key={`f-${model}`} model={model} placements={list} scale={scale} />
      ))}
      {/* Signs/frames/cameras are no longer baked into the rig — they render from the
          SIGN_CATALOG via PlotSignField (see MergedRigField). */}
    </>
  );
}

// ── Debug joint spheres (?pinmark=1) ─────────────────────────────────────────
// One instanced sphere per rig at a given rig-local linkage point, so it's cheap
// (1 draw call per joint) and visible on the whole field. depthTest off so the dot
// is always locatable; eyeball its position against the wheel/equalizer geometry.
function PinInstanced({ rigs, point, color }) {
  const ref = useRef();
  const geo = useMemo(() => new THREE.SphereGeometry(0.02, 10, 10), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }), [color]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useEffect(() => {
    const inst = ref.current; if (!inst || !point) return;
    const d = new THREE.Object3D();
    rigs.forEach((r, i) => {
      d.position.set(
        r.position[0] + point[0] * PUMPJACK_SCALE,
        r.position[1] + point[1] * PUMPJACK_SCALE,
        r.position[2] + point[2] * PUMPJACK_SCALE,
      );
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [rigs, point, geo]);
  if (!point || !rigs.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, rigs.length]} renderOrder={9999} frustumCulled={false} />;
}
function PinMarkers({ rigs, rock }) {
  if (!rock) return null;
  return (
    <>
      <PinInstanced rigs={rigs} point={rock.pitmanA} color={0xff3030} />{/* crank pin */}
      <PinInstanced rigs={rigs} point={rock.crankPivot} color={0x30ff30} />{/* axle */}
      <PinInstanced rigs={rigs} point={rock.pitmanB} color={0x3060ff} />{/* beam end */}
    </>
  );
}

function MergedRigField({ scene, items, allPumpConfigs, pumpConfig, envMap, cellSize, selectedCol, selectedRow, fullRigCells, onSelectCell, onFlyTo, onZoomOut, cameraViewable = true }) {
  const base = useMemo(() => buildBaseRig(scene), [scene]);
  // Captured uniforms of the shared merged material's compiled shader — so the
  // per-frame loop can advance the beam-bob clock (ANIM_FIELD only).
  const fieldUniforms = useRef(null);
  // Per-vertex metalness/roughness (from aMetalness/aRoughness attributes) so
  // textured metal parts catch studio-env reflections while painted parts stay
  // matte — recovering the close-up rig's metallic sheen at ~1 draw call.
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      // `color` multiplies the baked vertex colors — knocks back the bright white
      // plastic (counterweight/base) so the rigs don't blow out against the dark
      // dusk ground. Lower envMapIntensity also tames the shiny metal hotspots.
      color: new THREE.Color(0xaaaaaa),
      vertexColors: true, roughness: 1.0, metalness: 1.0,
      envMap: envMap || null, envMapIntensity: 0.9,
    });
    // Shader-driven rig motion across the whole field (no skeletal anim, no extra draw
    // calls). The crank (Wheel_Back) is the single driver; the beam angle is SOLVED
    // from the four-bar linkage so the pitman stays rigid. aPart: 1 = walking beam
    // rocks about the saddle, 2 = crank spins about its axle, 3 = rod strokes with the
    // horsehead tip, 4 = pitman (rigid, spans crank pin → beam). Per-rig phase from the
    // model-matrix translation desyncs neighbours so the field doesn't pump in unison.
    const rock = ANIM_FIELD && base.rock;
    const fnum = (x) => Number(x).toFixed(6);
    const v3 = (a) => `vec3(${fnum(a[0])}, ${fnum(a[1])}, ${fnum(a[2])})`;
    // Four-bar constants reduced to the 2D rocking plane (v = world Y, u = the in-plane
    // horizontal). Ground = saddle S ↔ crank center C; crank throw rC, rocker radius rB
    // (beam), coupler length Lp (pitman); a0/b0 = rest angles.
    let link = null;
    if (rock) {
      const ax = rock.axis;
      const uIdx = ax[2] === 1 ? 0 : 2;
      const uSwiz = ax[2] === 1 ? "x" : "z";
      const planeSign = ax[2] === 1 ? 1 : -1;     // (u,v) CCW angle → Rodrigues about axis
      const U = (p) => p[uIdx];
      const S2 = [U(rock.pivot), rock.pivot[1]];
      const C2 = [U(rock.crankPivot), rock.crankPivot[1]];
      const A2 = [U(rock.pitmanA), rock.pitmanA[1]];   // crank-pin rest
      const B2 = [U(rock.pitmanB), rock.pitmanB[1]];   // beam-attach rest
      const D = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
      link = {
        uSwiz, planeSign, S2, C2,
        rC: D(A2, C2), a0: Math.atan2(A2[1] - C2[1], A2[0] - C2[0]),
        rB: D(B2, S2), b0: Math.atan2(B2[1] - S2[1], B2[0] - S2[0]),
        Lp: D(B2, A2),
      };
    }
    const rockCommon = rock ? `
      attribute float aPart;
      uniform float uTime;
      vec3 _axis = ${v3(rock.axis)};
      vec3 _saddle = ${v3(rock.pivot)};
      vec3 _crank = ${v3(rock.crankPivot)};
      vec3 _strawRef = ${v3(rock.strawRef)};
      vec3 _pitA = ${v3(rock.pitmanA)};
      vec3 _pitB = ${v3(rock.pitmanB)};
      const float _S2u = ${fnum(link.S2[0])}, _S2v = ${fnum(link.S2[1])};
      const float _C2u = ${fnum(link.C2[0])}, _C2v = ${fnum(link.C2[1])};
      const float _rC = ${fnum(link.rC)}, _a0 = ${fnum(link.a0)};
      const float _rB = ${fnum(link.rB)}, _b0 = ${fnum(link.b0)};
      const float _Lp = ${fnum(link.Lp)};
      const float _planeSign = ${fnum(link.planeSign)};
      float _phase() { ${PIN_MARK ? "return 0.0;" : "vec3 rw = modelMatrix[3].xyz; return rw.x * 1.7 + rw.z * 2.3;"} }
      float _wrap(float x) { return atan(sin(x), cos(x)); }            // → [-PI, PI]
      float _planeAng(vec3 w) { return atan(w.y, w.${link.uSwiz}); }
      float _thetaUV() { return (uTime * ${fnum(FIELD_PUMP_SPEED)} * ${fnum(FIELD_CRANK_DIR)}) + _phase(); }
      float _crankAngle() { return _thetaUV() * _planeSign; }          // Rodrigues about axis
      // Four-bar solve: spin the crank, intersect circle(S,rB) with circle(pin,Lp),
      // pick the branch nearest rest → the beam angle that conserves the pitman length.
      float _beamAngle() {
        vec2 S2 = vec2(_S2u, _S2v);
        float al = _a0 + _thetaUV();
        vec2 P = vec2(_C2u, _C2v) + _rC * vec2(cos(al), sin(al));      // live crank pin
        float d = max(distance(P, S2), 1e-4);
        float ca = (d * d + _rB * _rB - _Lp * _Lp) / (2.0 * d);
        float h = sqrt(max(_rB * _rB - ca * ca, 0.0));
        vec2 dir = (P - S2) / d, prp = vec2(-dir.y, dir.x);
        vec2 M = S2 + ca * dir;
        vec2 Q1 = M + h * prp, Q2 = M - h * prp;
        float b1 = atan(Q1.y - _S2v, Q1.x - _S2u);
        float b2 = atan(Q2.y - _S2v, Q2.x - _S2u);
        float beta = abs(_wrap(b1 - _b0)) < abs(_wrap(b2 - _b0)) ? b1 : b2;
        return _wrap(beta - _b0) * _planeSign;                         // Rodrigues about axis
      }
      vec3 _rotDir(vec3 v, float a) {
        float c = cos(a), s = sin(a);
        return v * c + cross(_axis, v) * s + _axis * dot(_axis, v) * (1.0 - c);
      }
      vec3 _rotAbout(vec3 v, vec3 piv, float a) { return _rotDir(v - piv, a) + piv; }
      vec3 _rodMove() { return _rotAbout(_strawRef, _saddle, _beamAngle()) - _strawRef; }
      // Pitman: the four-bar conserves Lp, so the rod is RIGID — rotate it to point
      // from the live crank pin (A') to the live beam attach (B').
      float _pitmanRot() {
        vec3 Ap = _rotAbout(_pitA, _crank, _crankAngle());
        vec3 Bp = _rotAbout(_pitB, _saddle, _beamAngle());
        return _wrap(_planeAng(Bp - Ap) - _planeAng(_pitB - _pitA)) * _planeSign;
      }
      vec3 _pitmanXform(vec3 p) {
        return _rotAbout(_pitA, _crank, _crankAngle()) + _rotDir(p - _pitA, _pitmanRot());
      }` : "";
    const beginNormalRock = rock ? `
      if (aPart > 3.5) objectNormal = _rotDir(objectNormal, _pitmanRot());
      else if (aPart > 2.5) {}                                         // rod: translation only
      else if (aPart > 1.5) objectNormal = _rotDir(objectNormal, _crankAngle());
      else if (aPart > 0.5) objectNormal = _rotDir(objectNormal, _beamAngle());` : "";
    const beginVertexRock = rock ? `
      if (aPart > 3.5) transformed = _pitmanXform(transformed);
      else if (aPart > 2.5) transformed += _rodMove();
      else if (aPart > 1.5) transformed = _rotAbout(transformed, _crank, _crankAngle());
      else if (aPart > 0.5) transformed = _rotAbout(transformed, _saddle, _beamAngle());` : "";
    m.onBeforeCompile = (shader) => {
      if (rock) shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aMetalness;\nattribute float aRoughness;\nvarying float vMetalnessV;\nvarying float vRoughnessV;" + rockCommon)
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>" + beginNormalRock)
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMetalnessV = aMetalness;\nvRoughnessV = aRoughness;" + beginVertexRock);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vMetalnessV;\nvarying float vRoughnessV;")
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = vRoughnessV;")
        .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vMetalnessV;");
      fieldUniforms.current = shader.uniforms;
    };
    return m;
  }, [envMap, base]);

  // Advance the crank clock. Cheap no-op unless ANIM_FIELD compiled uTime in.
  useFrame((_, delta) => {
    if (!ANIM_FIELD || NO_ANIM || PIN_MARK) return; // PIN_MARK freezes at rest for seating checks
    const u = fieldUniforms.current;
    if (u && u.uTime) u.uTime.value += delta;
  });
  // Build all rigs once (not keyed on selection) — selection only toggles
  // visibility, so clicking a plot doesn't rebuild 100 geometries.
  const rigs = useMemo(() => items.map((it) => {
    const config = allPumpConfigs[`${it.col}_${it.row}`]?.config || null;
    const geo = base.geometry.clone(); // own position/normal + boundingSphere
    geo.setAttribute("color", rigColorAttribute(base, config));
    return { key: it.key, position: it.position, col: it.col, row: it.row, geo };
  }), [base, items, allPumpConfigs]);

  // Wellhead world positions for the instanced idle glow (stable — not keyed on
  // selection, so focusing a plot doesn't rebuild the instance buffer).
  const wellPositions = useMemo(() => {
    const wh = base.wellhead || WELLHEAD_OFFSET;
    return rigs.map((r) => [
      r.position[0] + wh[0],
      r.position[1] + wh[1],
      r.position[2] + wh[2],
    ]);
  }, [rigs, base]);

  useEffect(() => () => rigs.forEach((r) => r.geo.dispose()), [rigs]);
  useEffect(() => () => {
    base.geometry.dispose();
    base.signGeo?.dispose();
    base.signFrameGeo?.dispose();
    base.signCamGeo?.dispose();
  }, [base]);
  useEffect(() => () => mat.dispose(), [mat]);

  // Shared material for instanced sign frames + cameras (vertex-colored metal).
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.5, metalness: 0.5,
    envMap: envMap || null, envMapIntensity: 1.0, side: THREE.DoubleSide,
  }), [envMap]);
  useEffect(() => () => frameMat.dispose(), [frameMat]);

  const decoThreshold = (cellSize || 0.5) * 6;

  return (
    <>
      {rigs.map((r) => {
        const isSelected = r.col === selectedCol && r.row === selectedRow;
        // Hidden when a full animated rig stands in for this cell — the selected
        // plot OR a cell with a live gusher (which renders its own erupting rig).
        const isFull = isSelected || !!fullRigCells?.has(`${r.col}_${r.row}`);
        const cfg = allPumpConfigs[`${r.col}_${r.row}`]?.config || null;
        return (
          <group key={r.key}>
            <mesh
              geometry={r.geo}
              material={mat}
              position={r.position}
              scale={PUMPJACK_SCALE}
              visible={!isFull}
              onClick={(e) => { e.stopPropagation(); onSelectCell?.(r.col, r.row); onFlyTo?.(r.col, r.row); }}
              onDoubleClick={(e) => { e.stopPropagation(); if (isSelected) onZoomOut?.(); else onFlyTo?.(r.col, r.row); }}
            />
            {!isFull && cfg?.addons && (
              <IdleDecorations position={r.position} config={cfg} threshold={decoThreshold} />
            )}
          </group>
        );
      })}
      {/* Lyquid80 wellhead glow across every plot — one instanced draw call. */}
      <WellGlowField positions={wellPositions} />
      {PIN_MARK && <PinMarkers rigs={rigs} rock={base.rock} />}
      {/* Static decorations (signs, frames, cameras, fences, non-animated add-ons)
          instanced by type — one draw call each across the whole field. */}
      <StaticDecoField
        items={items}
        allPumpConfigs={allPumpConfigs}
        selectedCol={selectedCol}
        selectedRow={selectedRow}
        fullRigCells={fullRigCells}
        base={base}
        frameMat={frameMat}
      />
      {/* Catalog signs (+ cameras) — one per plot with showSign, all plots incl. the
          selected one, since signs are no longer part of the rig. */}
      <PlotSignField items={items} allPumpConfigs={allPumpConfigs} pumpConfig={pumpConfig} selectedCol={selectedCol} selectedRow={selectedRow} cameraViewable={cameraViewable} />
    </>
  );
}

function PumpjackInstances({ gridX, gridY, cellSize, worldW, worldD, drillDay, maxDrillDay, depthCellSize, peakDepthMap = {}, selectedCol, selectedRow, onSelectCell, onFlyTo, onZoomOut, pumpConfig, allPumpConfigs = {}, oilStrike, drillEvent = 0, drillProximity = 0, tankFill, onTankDrain, communityOil = 0, totalOilBudget = 500, envPreset, envMapPreset = "warehouse", parabolum = false, forceStrikeGusher = false, gusherTrigger = 0, gusherEvents = [], plotsWithMessages = {}, onEnvelopeClick, hellActive = false, hellCol = null, hellRow = null, cameraViewable = true, onFocusObject }) {
  // Cells with a live gusher event. Each renders a full animated rig (instead of
  // merged static geometry) so the pump pauses + the rig pitches back as it erupts
  // — visible to every player, not just the gusher's owner.
  const gusherCellSet = useMemo(() => {
    const s = new Set();
    gusherEvents.forEach((ev) => {
      if (ev.col != null && ev.row != null) s.add(`${ev.col}_${ev.row}`);
    });
    return s;
  }, [gusherEvents]);

  // Step 2 — cell → strike tier (strike|gusher|motherlode) so each erupting rig
  // scales its 3D response. If two events share a cell, the last one wins (newest
  // write); a missing entry defaults to "gusher" downstream.
  const gusherTierByCell = useMemo(() => {
    const m = new Map();
    gusherEvents.forEach((ev) => {
      if (ev.col != null && ev.row != null) m.set(`${ev.col}_${ev.row}`, ev.tier || "gusher");
    });
    return m;
  }, [gusherEvents]);

  // Linger set — cells whose gusher event JUST cleared. They keep a full rig (with
  // gusherActive=false, which kicks off the fade) for a short window so the geyser
  // eases out + the pump settles before the cell reverts to the merged static field.
  const [lingerSet, setLingerSet] = useState(() => new Set());
  const prevGusherCells = useRef(new Set());
  const lingerTimers = useRef(new Map());
  useEffect(() => {
    const curr = gusherCellSet;
    // Cells that just ended → start (or restart) a linger timer.
    prevGusherCells.current.forEach((key) => {
      if (!curr.has(key)) {
        setLingerSet((s) => (s.has(key) ? s : new Set(s).add(key)));
        const existing = lingerTimers.current.get(key);
        if (existing) clearTimeout(existing);
        const id = setTimeout(() => {
          lingerTimers.current.delete(key);
          setLingerSet((s) => { if (!s.has(key)) return s; const n = new Set(s); n.delete(key); return n; });
        }, GUSHER_FADE_LINGER_MS);
        lingerTimers.current.set(key, id);
      }
    });
    // Cells that (re)activated → cancel any pending linger so they don't unmount.
    curr.forEach((key) => {
      const existing = lingerTimers.current.get(key);
      if (existing) { clearTimeout(existing); lingerTimers.current.delete(key); }
      setLingerSet((s) => { if (!s.has(key)) return s; const n = new Set(s); n.delete(key); return n; });
    });
    prevGusherCells.current = new Set(curr);
  }, [gusherCellSet]);
  useEffect(() => () => { lingerTimers.current.forEach((id) => clearTimeout(id)); }, []);

  // Cells that render a full animated rig on account of a gusher — actively erupting
  // or fading out. (The selected cell is handled separately via isSelected.)
  const fullRigCells = useMemo(
    () => new Set([...gusherCellSet, ...lingerSet]),
    [gusherCellSet, lingerSet]
  );

  const { scene, animations } = useGLTF("/models/oilJack_fancy_allProps2.glb");
  // Reflections-only env map (not the scene background), chosen per theme by the
  // page: warm "sunset" for the bright day/dusk scenes, "warehouse" (cooler,
  // contrasty) for night/dark + the Lyquid80 substance themes. Both read as shaped
  // metal without raising envMapIntensity (which would blow out the white plastic
  // against the dark ground). Drei caches each HDR, so switching themes is instant
  // after first load.
  const envMap = useEnvironment({ preset: envMapPreset });

  // OilTower position — centered on the 4 middle cells
  const towerPos = useMemo(() => {
    const midCol = Math.floor(gridX / 2);
    const midRow = Math.floor(gridY / 2);
    const x = -worldW / 2 + (midCol - 0.5) * cellSize + cellSize / 2;
    const z = worldD / 2 - (midRow - 0.5) * cellSize - cellSize / 2;
    return [x, 0, z];
  }, [gridX, gridY, cellSize, worldW, worldD]);

  const items = useMemo(() => {
    const list = [];
    for (let row = 0; row < gridY; row++) {
      for (let col = 0; col < gridX; col++) {
        const x = -worldW / 2 + col * cellSize + cellSize / 2;
        const z = worldD / 2 - row * cellSize - cellSize / 2;
        list.push({ key: `pj-${row}-${col}`, position: [x, 0, z], col, row });
      }
    }
    return list;
  }, [gridX, gridY, cellSize, worldW, worldD]);

  // Compute selected cell world position for the highlight plane
  const selectedPos = useMemo(() => {
    if (selectedCol === null || selectedRow === null) return null;
    if (selectedCol < 0 || selectedCol >= gridX || selectedRow < 0 || selectedRow >= gridY) return null;
    const x = -worldW / 2 + selectedCol * cellSize + cellSize / 2;
    const z = worldD / 2 - selectedRow * cellSize - cellSize / 2;
    return [x, 0.02, z];
  }, [selectedCol, selectedRow, cellSize, worldW, worldD, gridX, gridY]);

  return (
    <>
      {/* Oil Tower in the center 4 cells */}
      <OilTower position={towerPos} communityOil={communityOil} totalOilBudget={totalOilBudget} onFocusObject={onFocusObject} onZoomOut={onZoomOut} />
      {/* Animated border outline on the selected grid square */}
      {selectedPos && (
        <PlotBorderHighlight position={selectedPos} cellSize={cellSize} />
      )}
      {MERGE_RIGS && (
        <MergedRigField
          scene={scene}
          items={items}
          allPumpConfigs={allPumpConfigs}
          pumpConfig={pumpConfig}
          envMap={envMap}
          cellSize={cellSize}
          selectedCol={selectedCol}
          selectedRow={selectedRow}
          fullRigCells={fullRigCells}
          onSelectCell={onSelectCell}
          onFlyTo={onFlyTo}
          onZoomOut={onZoomOut}
          cameraViewable={cameraViewable}
        />
      )}
      {items.map(({ key, position, col, row }) => {
        // Drill all if no selection, otherwise only the selected cell
        const active = selectedCol === null || (col === selectedCol && row === selectedRow);
        const isSelected = selectedCol !== null && col === selectedCol && row === selectedRow;
        const cellKey = `${col}_${row}`;
        const hasGusher = gusherCellSet.has(cellKey);   // actively erupting
        const isLingering = lingerSet.has(cellKey);     // fading out post-event
        // In merge mode only the selected plot — and any cell with a live or fading
        // gusher — renders a full animated rig; the rest come from MergedRigField (1
        // draw call each). Gusher cells need the real rig so the pump can pause + tilt.
        if (MERGE_RIGS && !isSelected && !hasGusher && !isLingering) return null;
        const cellEntry = allPumpConfigs[`${col}_${row}`];
        const cellConfig = isSelected ? pumpConfig : cellEntry?.config || null;
        return (
          <Pumpjack
            key={key}
            position={position}
            scene={scene}
            animations={animations}
            drillDay={active ? drillDay : 0}
            maxDrillDay={maxDrillDay}
            depthCellSize={depthCellSize}
            depositLayer={peakDepthMap[cellKey] ?? -1}
            highlighted={isSelected}
            pumpConfig={cellConfig}
            envMap={envMap}
            oilStrike={oilStrike}
            drillEvent={isSelected ? drillEvent : 0}
            drillProximity={isSelected ? drillProximity : 0}
            tankFill={isSelected ? tankFill : 0}
            onTankDrain={isSelected ? onTankDrain : undefined}
            envPreset={envPreset}
            parabolum={parabolum}
            forceStrikeGusher={forceStrikeGusher}
            gusherTrigger={isSelected ? gusherTrigger : 0}
            gusherActive={hasGusher}
            gusherLingering={isLingering}
            gusherTier={gusherTierByCell.get(cellKey) || "gusher"}
            hasMessages={!!plotsWithMessages[`${col}_${row}`]}
            onEnvelopeClick={() => onEnvelopeClick?.(col, row)}
            hellActive={hellActive && col === hellCol && row === hellRow}
            worldW={worldW}
            worldD={worldD}
            cameraViewable={cameraViewable}
            onFocusObject={onFocusObject}
            onClick={() => { onSelectCell?.(col, row); onFlyTo?.(col, row); }}
            onDoubleClick={() => isSelected ? onZoomOut?.() : onFlyTo?.(col, row)}
          />
        );
      })}
    </>
  );
}

useGLTF.preload("/models/oilJack_fancy_allProps2.glb");

// ── Hell Demon — spawns from below, flies to a victim plot, roams the field
//    making mischief, and must be caught during a vulnerable pause window ─────
useGLTF.preload("/models/imp_devil.glb");

// Deterministic PRNG so every client animates the same wander path from a
// shared seed (the bountyId). Frame timing still drifts between clients, but
// the authoritative sync point is the Firestore "claimed"/"dismissed" status.
function demonHashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function demonMulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const demonClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Phase timing (seconds) / movement tuning
const DEMON_SPAWN_DUR = 1.8;
const DEMON_GROUND_Y = 0;        // raise if the model sits sunk into the plot
const DEMON_TRANSIT_SPEED = 0.15;  // cross-grid ground-walk speed (units/sec)
const DEMON_WALK_SPEED = 0.125;    // short wander-hop walk speed
const DEMON_TURN_DUR = 0.4;
const DEMON_PAUSE_DUR = 2.6;   // the vulnerable / catchable window
const DEMON_MISCHIEF_DUR = 1.6;
const DEMON_FLEE_DUR = 0.7;
const DEMON_TAKE_DAMAGE_DUR = 0.73;  // "Take Damage" clip length (flinch on a mistimed hit)
const DEMON_COUNTER_ATTACK_DUR = 0.9; // "Slash/Projectile Attack" clip length (retaliation)
// Per-player lockout after a mistimed click: this client can't click the demon
// (or banish during a vulnerable window) until it elapses. Client-side only, so
// it never blocks OTHER hunters — it just costs the impatient player the race.
const DEMON_HIT_COOLDOWN = 3.5;
// Hard-phase combat: you must get the camera within this range (world units) of
// the demon for a click to land as a hit, and land this many hits to banish it.
const DEMON_HIT_RANGE = 4.0;
const DEMON_HARD_HITS = 3;
const DEMON_BANISH_DUR = 1.0;
const DEMON_WANDER_RADIUS = 2; // cells around the victim plot
const DEMON_YAW_OFFSET = 0;    // tweak if the model faces the wrong way
const DEMON_SPAWN_OFFSET_Z = 0.2; // nudge the spawn toward the wellhead (world +z)
const DEMON_APPEAR_DELAY = 2.0;   // seconds the hell effects play before the demon erupts
// Flying intro sequence (after the Spawn-To-Fly-Idle emergence): hover, cast a
// spell, then fly to the victim plot and land into the ground wander loop.
const DEMON_FLY_Y = 0.2;       // hover height (world units) during the fly intro
const DEMON_SPAWN_PEAK_Y = 0.2; // burst-out apex during spawn; settles to hover after
const DEMON_FLY_SPEED = 0.5;    // flying travel speed (units/sec)
const FLY_IDLE2_DUR = 2.0;      // Fly Idle after the cast, before flying off
const FLY_IDLE3_DUR = 2.0;      // Fly Idle at the destination, before landing
const FLY_TURN_DUR = 0.5;       // Fly Turn to face the destination
const FLY_LAND_DUR = 0.6;       // descend from fly height to the ground

function HellDemon({
  summonerCol = 0,
  summonerRow = 0,
  targetCol = 0,
  targetRow = 0,
  cellSize = 1,
  worldW = 10,
  worldD = 10,
  gridX = 10,
  gridY = 10,
  seed = "demon",
  clickable = false,
  onBanish,
  onMiss,
  onAttack,
  onHit,
  requiredHits = 1,   // 1 = easy one-click banish; >1 = hard combat phase
  hitRange = DEMON_HIT_RANGE,
}) {
  const { scene, animations } = useGLTF("/models/imp_devil.glb");
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  useEffect(() => () => disposeScene(cloned), [cloned]);

  // Drive a manual AnimationMixer (mixer.update is called in our useFrame).
  // NOTE: every clip in imp_devil.glb animates per-bone *translation* (not just
  // rotation) — the limb motion lives in the .position tracks, so we use the
  // raw clips unmodified. The locomotion clips ("Walk Forward In Place",
  // "Turn Left/Right") have no root forward motion, so the group translate
  // (below) is what carries the demon across the grid with no sliding.
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;
    const map = {};
    (animations || []).forEach((clip) => {
      map[clip.name] = mixer.clipAction(clip);
    });
    actionsRef.current = map;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(cloned);
      mixerRef.current = null;
      actionsRef.current = {};
    };
  }, [cloned, animations]);

  const groupRef = useRef();
  const lightRef = useRef();
  const sparkRef = useRef();
  const [vulnerable, setVulnerable] = useState(false);
  const [done, setDone] = useState(false);
  // Local post-mistimed-click lockout (this player only).
  const [onCooldown, setOnCooldown] = useState(false);
  const cooldownRef = useRef(0);
  // Hard-phase combat: accumulated hits, in-range telegraph, and prop mirrors so
  // the useFrame/click closures always read the latest values.
  const hitsRef = useRef(0);
  const [hits, setHits] = useState(0); // for the progress pips
  const [inRange, setInRange] = useState(false);
  const inRangeRef = useRef(false);
  const requiredHitsRef = useRef(requiredHits);
  requiredHitsRef.current = requiredHits;
  const hitRangeRef = useRef(hitRange);
  hitRangeRef.current = hitRange;

  // Hold the demon hidden underground for a beat after the hell effects begin
  // (this component mounts exactly when they do), then run the spawn. `appeared`
  // drives the group's visible prop; appearedRef gates the useFrame machine.
  const [appeared, setAppeared] = useState(false);
  const appearedRef = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => {
      appearedRef.current = true;
      setAppeared(true);
    }, DEMON_APPEAR_DELAY * 1000);
    return () => clearTimeout(id);
  }, []);

  // Cell-center → world position (cell centers are where the rigs sit)
  const cellToWorld = useCallback(
    (c, r) =>
      new THREE.Vector3(
        -worldW / 2 + c * cellSize + cellSize / 2,
        0,
        worldD / 2 - r * cellSize - cellSize / 2,
      ),
    [worldW, worldD, cellSize],
  );

  // Grid-line intersection (i,j) → world position. Every cell has a pumpjack at
  // its CENTER, so the demon travels along these "streets" between pads and only
  // ever moves one axis at a time, never cutting diagonally through a rig.
  const nodeToWorld = useCallback(
    (i, j) =>
      new THREE.Vector3(
        -worldW / 2 + i * cellSize,
        0,
        worldD / 2 - j * cellSize,
      ),
    [worldW, worldD, cellSize],
  );

  // Seeded RNG — stable per demon
  const rng = useMemo(() => demonMulberry32(demonHashSeed(String(seed))), [seed]);

  // Animation crossfade helper (fuzzy match against the imp_devil clip names).
  // Pass a single matcher, or an ARRAY of matchers to blend several clips at
  // once (e.g. [/walk/, /look.?around/] = walk while glancing around — both at
  // full weight, the same way the glTF viewer plays them together).
  const curSetRef = useRef("");
  const playAnim = (kw, loop = true) => {
    const actions = actionsRef.current;
    const kws = Array.isArray(kw) ? kw : [kw];
    // Always case-insensitive — clip names are capitalized ("Walk Forward In
    // Place", "Spawn", "Turn Left"), so a bare /walk/ would never match.
    const keys = kws
      .map((k) => {
        const re = k instanceof RegExp
          ? (k.flags.includes("i") ? k : new RegExp(k.source, k.flags + "i"))
          : new RegExp(k, "i");
        return Object.keys(actions).find((name) => re.test(name));
      })
      .filter(Boolean);
    if (!keys.length) return;
    const setId = keys.join("|") + (loop ? "L" : "O");
    if (curSetRef.current === setId) return;
    curSetRef.current = setId;
    const keep = new Set(keys);
    Object.entries(actions).forEach(([name, act]) => {
      if (!keep.has(name)) act.fadeOut(0.25);
    });
    keys.forEach((name) => {
      const a = actions[name];
      a.reset();
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      a.clampWhenFinished = !loop;
      a.fadeIn(0.25).play();
    });
  };

  // Phase machine state (refs so the useFrame closure never goes stale)
  const phaseRef = useRef("spawn");
  const tRef = useRef(0);
  const phaseInitRef = useRef(false);
  const fromRef = useRef(new THREE.Vector3());
  const toRef = useRef(new THREE.Vector3());
  const segDurRef = useRef(1);
  const flyRiseFromRef = useRef(DEMON_FLY_Y); // spawn-apex height the hover settles down from
  const headingRef = useRef(0);
  const turnFromRef = useRef(0);
  const turnDeltaRef = useRef(0);
  // Movement is in intersection-node space {i,j}. Home node = the NW corner of
  // the victim cell (a street point right beside the rig).
  const homeNodeRef = useRef({ i: targetCol, j: targetRow });
  const wanderNodeRef = useRef({ i: targetCol, j: targetRow });
  const curSegNodeRef = useRef({ i: targetCol, j: targetRow });
  const pathRef = useRef([]);            // remaining {i,j} waypoints
  const onPathDoneRef = useRef(null);    // called when the path empties
  const walkSpeedRef = useRef(DEMON_WALK_SPEED);
  const vulnerableRef = useRef(false);
  const roamingRef = useRef(false); // false during the spawn→victim intro trek
  const counterStepRef = useRef(0); // 0 = flinch (Take Damage), 1 = retaliate (attack)

  const setPhase = (p) => {
    phaseRef.current = p;
    tRef.current = 0;
    phaseInitRef.current = false;
  };
  const setVuln = (v) => {
    vulnerableRef.current = v;
    setVulnerable(v);
  };

  // Pick a street node within DEMON_WANDER_RADIUS of the victim plot that shares
  // ONE axis with where we are now — so the walk segment runs straight along a
  // grid line (a street between pads) and never diagonals across a rig.
  const pickWanderNode = () => {
    const home = homeNodeRef.current;
    const cur = wanderNodeRef.current;
    for (let n = 0; n < 6; n++) {
      let i = cur.i;
      let j = cur.j;
      if (rng() < 0.5) {
        i = demonClamp(home.i + Math.round((rng() * 2 - 1) * DEMON_WANDER_RADIUS), 0, gridX);
      } else {
        j = demonClamp(home.j + Math.round((rng() * 2 - 1) * DEMON_WANDER_RADIUS), 0, gridY);
      }
      if (i !== cur.i || j !== cur.j) return { i, j };
    }
    return { i: cur.i, j: cur.j };
  };

  // Walk the demon through a queue of street nodes, one straight segment at a
  // time (turn to face → walk). Calls onDone when the queue empties.
  const nextSegment = (g) => {
    const path = pathRef.current;
    if (!path.length) { onPathDoneRef.current?.(g); return; }
    const node = path.shift();
    curSegNodeRef.current = node;
    const toW = nodeToWorld(node.i, node.j);
    fromRef.current.copy(g.position);
    fromRef.current.y = DEMON_GROUND_Y;
    toRef.current.set(toW.x, DEMON_GROUND_Y, toW.z);
    const d = fromRef.current.distanceTo(toRef.current);
    segDurRef.current = Math.max(0.3, d / walkSpeedRef.current);
    const dir = toRef.current.clone().sub(fromRef.current);
    const targetHeading = dir.lengthSq() > 1e-4 ? Math.atan2(dir.x, dir.z) : headingRef.current;
    turnFromRef.current = headingRef.current;
    let dh = targetHeading - headingRef.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    turnDeltaRef.current = dh;
    setVuln(false);
    setPhase("walk_turn");
    playAnim(dh >= 0 ? /turn.?left/ : /turn.?right/);
  };
  const beginPath = (g, nodes, speed, onDone) => {
    pathRef.current = nodes.slice();
    walkSpeedRef.current = speed;
    onPathDoneRef.current = onDone;
    nextSegment(g);
  };

  // After arriving at a wander node: glance/pause or stop to make mischief.
  const afterWander = (g) => {
    wanderNodeRef.current = curSegNodeRef.current;
    if (rng() < 0.6) setPhase("wander_pause");
    else startMischief(g);
  };
  // Single wander hop to a nearby street node.
  const startWalk = (g) => {
    beginPath(g, [pickWanderNode()], DEMON_WALK_SPEED, afterWander);
  };

  // Cross-grid trek from the summoner plot to the victim plot, routed as an
  // L along the streets (horizontal run, then vertical) so it stays off rigs.
  const startTransit = (g) => {
    const s = { i: summonerCol, j: summonerRow };
    const h = { i: targetCol, j: targetRow };
    homeNodeRef.current = h;
    // First step off the well/pad onto the street (the demon spawns at the cell
    // center), then L-route along the streets to the victim plot.
    const nodes = [s];
    const corner = { i: h.i, j: s.j };
    if (corner.i !== s.i || corner.j !== s.j) nodes.push(corner);
    if (h.i !== corner.i || h.j !== corner.j) nodes.push(h);
    beginPath(g, nodes, DEMON_TRANSIT_SPEED, () => {
      wanderNodeRef.current = homeNodeRef.current;
      roamingRef.current = true; // now catchable
      setPhase("wander_pause");
    });
  };

  // Flying intro (replaces the ground trek): hover → cast → fly to the victim
  // plot → land, then hand off to the normal ground wander loop. Not catchable
  // until it lands (roamingRef stays false through the intro).
  const startFlyIntro = (g) => {
    homeNodeRef.current = { i: targetCol, j: targetRow };
    roamingRef.current = false;
    headingRef.current = g.rotation.y - DEMON_YAW_OFFSET; // keep heading continuous
    flyRiseFromRef.current = g.position.y; // settle the hover down from the spawn apex
    setPhase("fly_idle_2"); // the cast is blended into the spawn; hover, then fly off
  };
  // Turn to face the victim plot's home node (the same street point the wander
  // loop uses, so the post-landing hand-off lines up), then fly there.
  const startFlyTurn = (g) => {
    const toW = nodeToWorld(homeNodeRef.current.i, homeNodeRef.current.j);
    fromRef.current.set(g.position.x, DEMON_FLY_Y, g.position.z);
    toRef.current.set(toW.x, DEMON_FLY_Y, toW.z);
    const dir = toRef.current.clone().sub(fromRef.current);
    const targetHeading =
      dir.lengthSq() > 1e-4 ? Math.atan2(dir.x, dir.z) : headingRef.current;
    turnFromRef.current = headingRef.current;
    let dh = targetHeading - headingRef.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    turnDeltaRef.current = dh;
    const d = fromRef.current.distanceTo(toRef.current);
    segDurRef.current = Math.max(0.6, d / DEMON_FLY_SPEED);
    playAnim(dh >= 0 ? /fly turn left/ : /fly turn right/);
    setPhase("fly_turn");
  };

  // Face a nearby cell (the rig!) and play an attack — stays in place.
  const startMischief = (g) => {
    const home = homeNodeRef.current;
    const fc = demonClamp(home.i + (rng() < 0.5 ? -1 : 0), 0, gridX - 1);
    const fr = demonClamp(home.j + (rng() < 0.5 ? -1 : 0), 0, gridY - 1);
    const fW = cellToWorld(fc, fr);
    const dir = new THREE.Vector3(fW.x - g.position.x, 0, fW.z - g.position.z);
    if (dir.lengthSq() > 1e-4) headingRef.current = Math.atan2(dir.x, dir.z);
    g.rotation.y = headingRef.current + DEMON_YAW_OFFSET;
    setVuln(false);
    setPhase("wander_mischief");
    playAnim(rng() < 0.5 ? /slash/ : /projectile/, false);
  };

  // Mistimed click → dash to a nearby street node with a taunt.
  const beginFlee = () => {
    const g = groupRef.current;
    if (!g) return;
    const node = pickWanderNode();
    curSegNodeRef.current = node;
    const toW = nodeToWorld(node.i, node.j);
    fromRef.current.copy(g.position);
    fromRef.current.y = DEMON_GROUND_Y;
    toRef.current.set(toW.x, DEMON_GROUND_Y, toW.z);
    const dir = toRef.current.clone().sub(fromRef.current);
    if (dir.lengthSq() > 1e-4) headingRef.current = Math.atan2(dir.x, dir.z);
    setVuln(false);
    setPhase("flee");
    playAnim(/walk/);
  };

  const beginBanish = () => {
    if (phaseRef.current === "banish") return;
    setVuln(false);
    setPhase("banish");
    playAnim(/slash/, false);
  };

  // Mistimed click (outside the catchable window) → the demon flinches with a
  // Take Damage reaction, then retaliates with a Slash/Projectile attack before
  // resuming its wander. Anchored regexes (^) pick the grounded clips, not the
  // "Fly ..." variants. The retaliation fires onAttack as it lands.
  const beginCounter = () => {
    const g = groupRef.current;
    if (!g) return;
    setVuln(false);
    counterStepRef.current = 0;
    cooldownRef.current = DEMON_HIT_COOLDOWN; // lock this player out of the race
    setOnCooldown(true);
    setPhase("counter");
    playAnim(/^take damage/, false);
  };

  // A clean, in-range hit during the catchable window: the demon flinches (Take
  // Damage) with NO retaliation/lockout — the reward for good timing. One hit per
  // window; it resumes wandering after, until the required hits land (then banish).
  const beginHit = () => {
    setVuln(false);
    setPhase("hitstun");
    playAnim(/^take damage/, false);
  };

  // Register one clean hit; banish on the final one.
  const landHit = () => {
    const required = requiredHitsRef.current;
    hitsRef.current += 1;
    setHits(hitsRef.current);
    onHit?.(hitsRef.current, required);
    if (hitsRef.current >= required) beginBanish();
    else beginHit();
  };

  const WANDER_PHASES = ["walk_turn", "walk_move", "wander_mischief", "wander_pause"];
  const handleClick = (e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (!clickable || done) return;
    const ph = phaseRef.current;
    if (ph === "banish" || ph === "counter" || ph === "hitstun") return;
    if (cooldownRef.current > 0) return; // locked out after a mistimed hit
    if (!roamingRef.current) return; // can't be caught during the intro trek

    const inWindow = vulnerableRef.current && ph === "wander_pause";
    const required = requiredHitsRef.current;

    // Easy phase (required <= 1): a timed click banishes outright, no proximity.
    if (required <= 1) {
      if (inWindow) beginBanish();
      else if (WANDER_PHASES.includes(ph)) { beginCounter(); onMiss?.(DEMON_HIT_COOLDOWN); }
      return;
    }

    // Hard phase: a clean hit needs the catchable window AND proximity. A
    // mistimed click (outside the window) is punished with the retaliation +
    // lockout; an in-window-but-too-far tap is just a no-op (the GET CLOSER
    // telegraph guides them in), so distance alone never costs you the race.
    if (inWindow) {
      if (inRangeRef.current) landHit();
    } else if (WANDER_PHASES.includes(ph)) {
      beginCounter();
      onMiss?.(DEMON_HIT_COOLDOWN);
    }
  };

  useFrame((state, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
    if (cooldownRef.current > 0) {
      cooldownRef.current = Math.max(0, cooldownRef.current - delta);
      if (cooldownRef.current === 0) setOnCooldown(false);
    }
    const g = groupRef.current;
    if (!g || done) return;
    // Proximity telegraph for the hard combat phase: is the camera close enough
    // for a click to count as a hit? (Only meaningful when requiredHits > 1.)
    {
      const near = state.camera.position.distanceTo(g.position) <= hitRangeRef.current;
      if (near !== inRangeRef.current) {
        inRangeRef.current = near;
        setInRange(near);
      }
    }
    if (!appearedRef.current) {
      // Park at the underground spawn point (hidden via visible={appeared}) so the
      // first visible frame is already the borehole emergence, not a flash at origin.
      const s = cellToWorld(summonerCol, summonerRow);
      g.position.set(s.x, DEMON_GROUND_Y - 0.5, s.z + DEMON_SPAWN_OFFSET_Z);
      return;
    }
    tRef.current += delta;
    const t = tRef.current;
    const phase = phaseRef.current;
    const init = !phaseInitRef.current;
    if (init) phaseInitRef.current = true;

    // Turn the demon to face the camera (yaw only) and keep headingRef in sync so
    // the following fly-turn starts from this heading with no pop. Used through
    // the spawn + hover intro so the demon always presents its front to the
    // viewer regardless of how they've orbited.
    const faceCamera = () => {
      const yaw = Math.atan2(
        state.camera.position.x - g.position.x,
        state.camera.position.z - g.position.z,
      );
      headingRef.current = yaw;
      g.rotation.y = yaw + DEMON_YAW_OFFSET;
    };

    // Spawn point = the summoner's drill well (cell CENTER, under the rig), so
    // the demon erupts from the borehole rather than off at a plot corner.
    // Nudged along +z to land in the wellhead area of the pad.
    const sWorld = cellToWorld(summonerCol, summonerRow);
    sWorld.z += DEMON_SPAWN_OFFSET_Z;

    // Hellish light pulse — brighter while vulnerable to telegraph the window
    if (lightRef.current && phase !== "banish") {
      const base = phase === "wander_pause" ? 12 : 6;
      const amp = phase === "wander_pause" ? 2 : 0.6;
      lightRef.current.intensity = base + Math.sin(t * 6) * amp;
    }

    switch (phase) {
      case "spawn": {
        if (init) {
          g.position.set(sWorld.x, DEMON_GROUND_Y - 0.5, sWorld.z);
          g.scale.setScalar(1);
          // Blend the emergence and the spell together so the demon bursts out
          // of the ground already casting — both play once and clamp.
          playAnim([/spawn to fly idle/, /fly cast spell/], false);
        }
        const f = demonClamp(t / DEMON_SPAWN_DUR, 0, 1);
        const ease = 1 - Math.pow(1 - f, 3);
        // Burst up out of the ground past the hover height for a launch feel; the
        // clip adds its own lift on top, and fly_idle_1 settles back to hover.
        g.position.y = DEMON_GROUND_Y - 0.5 + ease * (DEMON_SPAWN_PEAK_Y + 0.5);
        faceCamera();
        if (f >= 1) startFlyIntro(g);
        break;
      }
      case "fly_idle_2": {
        if (init) playAnim(/fly idle/);
        // Settle from the spawn apex down to hover height as the cast finishes.
        const settle = demonClamp(t / 0.4, 0, 1);
        const se = 1 - Math.pow(1 - settle, 2);
        const from = flyRiseFromRef.current;
        g.position.y = from + (DEMON_FLY_Y - from) * se + Math.sin(t * 1.6) * 0.04 * se;
        faceCamera();
        if (t >= FLY_IDLE2_DUR) startFlyTurn(g);
        break;
      }
      case "fly_turn": {
        const f = demonClamp(t / FLY_TURN_DUR, 0, 1);
        const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        g.rotation.y = turnFromRef.current + turnDeltaRef.current * ease + DEMON_YAW_OFFSET;
        g.position.y = DEMON_FLY_Y;
        if (f >= 1) {
          headingRef.current = turnFromRef.current + turnDeltaRef.current;
          setPhase("fly_move");
        }
        break;
      }
      case "fly_move": {
        if (init) playAnim(/fly forward in place/);
        const f = demonClamp(t / segDurRef.current, 0, 1);
        g.position.lerpVectors(fromRef.current, toRef.current, f);
        g.position.y = DEMON_FLY_Y;
        g.rotation.y = headingRef.current + DEMON_YAW_OFFSET;
        if (f >= 1) setPhase("fly_idle_3");
        break;
      }
      case "fly_idle_3": {
        if (init) playAnim(/fly idle/);
        g.position.y = DEMON_FLY_Y + Math.sin(t * 1.6) * 0.04;
        if (t >= FLY_IDLE3_DUR) setPhase("fly_land");
        break;
      }
      case "fly_land": {
        if (init) playAnim(/walk forward in place/);
        const f = demonClamp(t / FLY_LAND_DUR, 0, 1);
        const ease = 1 - Math.pow(1 - f, 3);
        g.position.y = DEMON_FLY_Y + (DEMON_GROUND_Y - DEMON_FLY_Y) * ease;
        g.rotation.y = headingRef.current + DEMON_YAW_OFFSET;
        if (f >= 1) {
          g.position.y = DEMON_GROUND_Y;
          wanderNodeRef.current = homeNodeRef.current;
          roamingRef.current = true; // now catchable — resume grid wandering
          setPhase("wander_pause");
        }
        break;
      }
      case "walk_turn": {
        const f = demonClamp(t / DEMON_TURN_DUR, 0, 1);
        const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        g.rotation.y = turnFromRef.current + turnDeltaRef.current * ease + DEMON_YAW_OFFSET;
        if (f >= 1) {
          headingRef.current = turnFromRef.current + turnDeltaRef.current;
          setPhase("walk_move");
        }
        break;
      }
      case "walk_move": {
        if (init) playAnim(/walk/);
        const f = demonClamp(t / segDurRef.current, 0, 1);
        g.position.lerpVectors(fromRef.current, toRef.current, f);
        g.position.y = DEMON_GROUND_Y;
        g.rotation.y = headingRef.current + DEMON_YAW_OFFSET;
        if (f >= 1) nextSegment(g); // next waypoint, or fire the path's onDone
        break;
      }
      case "wander_pause": {
        if (init) {
          playAnim(/idle/);
          setVuln(true);
        }
        if (t >= DEMON_PAUSE_DUR) {
          setVuln(false);
          if (rng() < 0.45) startMischief(g);
          else startWalk(g);
        }
        break;
      }
      case "wander_mischief": {
        const f = demonClamp(t / DEMON_MISCHIEF_DUR, 0, 1);
        if (sparkRef.current) {
          const sf = Math.sin(f * Math.PI);
          sparkRef.current.visible = true;
          sparkRef.current.material.opacity = sf * 0.9;
          sparkRef.current.scale.setScalar(0.6 + sf * 0.9);
        }
        if (t >= DEMON_MISCHIEF_DUR) {
          if (sparkRef.current) {
            sparkRef.current.visible = false;
            sparkRef.current.material.opacity = 0;
          }
          startWalk(g);
        }
        break;
      }
      case "flee": {
        const f = demonClamp(t / DEMON_FLEE_DUR, 0, 1);
        const ease = 1 - Math.pow(1 - f, 2);
        g.position.lerpVectors(fromRef.current, toRef.current, ease);
        g.position.y = DEMON_GROUND_Y + Math.sin(f * Math.PI) * 0.25;
        g.rotation.y = headingRef.current + DEMON_YAW_OFFSET;
        if (f >= 1) {
          wanderNodeRef.current = curSegNodeRef.current;
          setPhase("wander_pause");
        }
        break;
      }
      case "hitstun": {
        // Clean hit: flinch facing the player, then resume wandering (the click
        // handler already banished if this was the final hit).
        faceCamera();
        g.position.y = DEMON_GROUND_Y;
        if (t >= DEMON_TAKE_DAMAGE_DUR) startWalk(g);
        break;
      }
      case "counter": {
        // Stand ground, facing the player, through the two-beat reaction:
        // flinch (Take Damage) → retaliate (Slash/Projectile) → resume wander.
        faceCamera();
        g.position.y = DEMON_GROUND_Y;
        if (counterStepRef.current === 0) {
          if (t >= DEMON_TAKE_DAMAGE_DUR) {
            counterStepRef.current = 1;
            tRef.current = 0; // restart the per-phase clock for the attack beat
            playAnim(rng() < 0.5 ? /^slash attack/ : /^projectile attack/, false);
            onAttack?.(DEMON_HIT_COOLDOWN); // damage hook — the retaliation lands here
          }
        } else {
          // Attack-flash spark for impact, reusing the mischief spark mesh.
          if (sparkRef.current) {
            const sf = Math.sin(demonClamp(t / DEMON_COUNTER_ATTACK_DUR, 0, 1) * Math.PI);
            sparkRef.current.visible = true;
            sparkRef.current.material.opacity = sf * 0.9;
            sparkRef.current.scale.setScalar(0.6 + sf * 0.9);
          }
          if (t >= DEMON_COUNTER_ATTACK_DUR) {
            if (sparkRef.current) {
              sparkRef.current.visible = false;
              sparkRef.current.material.opacity = 0;
            }
            startWalk(g);
          }
        }
        break;
      }
      case "banish": {
        const f = demonClamp(t / DEMON_BANISH_DUR, 0, 1);
        g.scale.setScalar(1 - f);
        g.position.y = DEMON_GROUND_Y - f * 0.6;
        g.rotation.y += delta * 8;
        if (lightRef.current) lightRef.current.intensity = 14 * (1 - f);
        if (sparkRef.current) {
          sparkRef.current.visible = true;
          sparkRef.current.material.opacity = Math.sin(f * Math.PI);
          sparkRef.current.scale.setScalar(0.5 + f * 3);
        }
        if (f >= 1) {
          setDone(true);
          onBanish?.();
        }
        break;
      }
      default:
        break;
    }
  });

  if (done) return null;

  return (
    <group ref={groupRef} visible={appeared} onPointerDown={handleClick}>
      {/* imp_devil.glb is authored upside-down vs three.js Y-up — flip it
          upright here on the inner primitive so the group keeps owning heading
          yaw (rotation.y) and ground height. */}
      <primitive object={cloned} scale={0.07} rotation={[Math.PI, 0, 0]} />
      <pointLight ref={lightRef} color="#ff2200" intensity={6} distance={3} decay={2} position={[0, 0.3, 0]} />
      {/* Mischief / banish spark — additive, untextured (safe on iOS) */}
      <mesh ref={sparkRef} position={[0, 0.25, 0.18]} visible={false}>
        <icosahedronGeometry args={[0.12, 1]} />
        <meshBasicMaterial
          color="#ff6633"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Catchable-window UI — hidden while this player is on their
          post-mistimed-click lockout. Easy phase = one-click BANISH; hard phase
          = a HIT button (in range) with progress pips, or a GET CLOSER prompt. */}
      {clickable && vulnerable && !onCooldown && (
        <Html
          center
          position={[0, 0.6, 0]}
          zIndexRange={[9999, 9999]}
          style={{ pointerEvents: "none" }}
        >
          {requiredHits <= 1 ? (
            <button
              onClick={(e) => { e.stopPropagation(); beginBanish(); }}
              onPointerDown={(e) => e.stopPropagation()}
              style={ringBtnStyle("BANISH")}
            >
              BANISH
            </button>
          ) : inRange ? (
            <button
              onClick={(e) => { e.stopPropagation(); landHit(); }}
              onPointerDown={(e) => e.stopPropagation()}
              style={ringBtnStyle("HIT")}
            >
              <span style={{ fontSize: 11 }}>HIT</span>
              <span style={{ fontSize: 13, letterSpacing: "0.18em", marginTop: 2 }}>
                {"◆".repeat(hits)}{"◇".repeat(Math.max(0, requiredHits - hits))}
              </span>
            </button>
          ) : (
            <div style={getCloserStyle}>GET CLOSER</div>
          )}
        </Html>
      )}
    </group>
  );
}

// Shared circular button style for the demon catch UI.
function ringBtnStyle() {
  return {
    pointerEvents: "auto",
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "rgba(255,34,0,0.2)",
    border: "3px solid rgba(255,68,34,0.85)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    color: "#ff6644",
    letterSpacing: "0.12em",
    fontWeight: 700,
    boxShadow: "0 0 24px rgba(255,34,0,0.6), 0 0 48px rgba(255,34,0,0.3)",
    textShadow: "0 0 8px rgba(255,34,0,0.7)",
    animation: "demonBannerPulse 0.9s ease-in-out infinite",
  };
}

const getCloserStyle = {
  pointerEvents: "none",
  padding: "7px 14px",
  borderRadius: 6,
  background: "rgba(20,2,0,0.8)",
  border: "1px solid rgba(255,68,34,0.5)",
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  color: "#ffb499",
  textShadow: "0 0 8px rgba(255,34,0,0.6)",
  whiteSpace: "nowrap",
};

// ── Component ───────────────────────────────────────────────────────────────

export default function OilVoxelGrid({
  blockHash = "0x8a3f7b2c91d4e6f5a0b3c8d7e2f1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
  gridX = 10,
  gridY = 10,
  depthZ = 20,
  cellSize = 1,
  numberOfDeposits = 5,
  numberOfHellPockets = null,
  totalOilBudget = 500,
  revealProgress = 0,
  animateReveal = false,
  revealDuration = 2,
  drillDay = 0,
  selectedCol = null,
  selectedRow = null,
  onSelectCell,
  onFlyTo,
  onZoomOut,
  pumpConfig,
  allPumpConfigs = {},
  oilStrike,
  drillEvent = 0,
  drillProximity = 0,
  tankFill = 0,
  onTankDrain,
  communityOil = 0,
  rogueEvents = [],
  gusherEvents = [],
  onRogueArrive,
  onRogueConsequence,
  envPreset,
  envMapPreset = "warehouse",
  parabolum = false,
  forceStrikeGusher = false,
  gusherTrigger = 0,
  plotsWithMessages = {},
  onEnvelopeClick,
  hellActive = false,
  hellCol = null,
  hellRow = null,
  demonBounty = null,
  demonTargetCol = null,
  demonTargetRow = null,
  demonSeed = null,
  demonCapturable = true,
  demonRequiredHits = 1,
  onClaimBounty,
  onDemonMiss,
  onDemonAttack,
  // Gate the live CCTV feed: only the plot owner (or admin/test/report) sees it.
  // Visitors clicking a camera-enabled plot get the rig + camera model, no feed.
  cameraViewable = true,
  // Click-to-zoom on scene objects (e.g. MachinePanel): called with the THREE
  // world intersection point so the page can dolly the camera in.
  onFocusObject,
  // Vendor stall clicked on the back-edge commercial strip; called with the
  // vendor id ("insurance" | "fortunes" | "souvenirs" | "tonics").
  onVendorClick,
}) {
  const matRef = useRef();
  const groundMatsRef = useRef([]);
  const revealRef = useRef(revealProgress);
  const animatingRef = useRef(animateReveal);

  // Load side texture for ground block
  const sideTex = useTexture("/LandGradient2.webp");
  sideTex.wrapS = sideTex.wrapT = THREE.ClampToEdgeWrapping;

  // Load topography texture for top surface
  const topoTex = useTexture("/topography1.webp");
  topoTex.wrapS = topoTex.wrapT = THREE.RepeatWrapping;

  const groundPalette = useMemo(() => {
    if (parabolum) {
      return {
        top: "#5a4a78",
        bottom: "#2a1d44",
        side: "#4a3a66",
        wire: 0xa45cff,
      };
    }
    if (envPreset === "solstice") {
      return {
        top: "#b99557",
        bottom: "#6b4a26",
        side: "#a8793a",
        wire: 0xd6b351,
      };
    }
    if (envPreset === "night") {
      return {
        top: "#6a7090",
        bottom: "#2c2a40",
        side: "#5e6478",
        wire: 0x8290c0,
      };
    }
    if (envPreset === "hell") {
      return {
        top: "#553018",
        bottom: "#1c0c08",
        side: "#4b2413",
        wire: 0xaa3c20,
      };
    }
    return {
      top: "#8b7355",
      bottom: "#5a4030",
      side: "#ffffff",
      wire: 0x8b7355,
    };
  }, [envPreset, parabolum]);

  // 6 materials for box faces: +x, -x, +y (top), -y (bottom), +z, -z
  const groundMaterials = useMemo(() => {
    const revealed = revealProgress > 0;
    const op = revealed ? 0.15 : 1;
    const shared = { transparent: true, depthWrite: !revealed, depthTest: !revealed, opacity: op };
    const topMat = new THREE.MeshStandardMaterial({ map: topoTex, color: groundPalette.top, roughness: 0.9, metalness: 0.05, ...shared });
    const bottomMat = new THREE.MeshStandardMaterial({ color: groundPalette.bottom, roughness: 0.95, metalness: 0.02, ...shared });
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, color: groundPalette.side, roughness: 0.85, metalness: 0.05, ...shared });
    const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
    groundMatsRef.current = mats;
    return mats;
  }, [sideTex, topoTex, revealProgress, groundPalette]);

  const depthCellSize = cellSize * 0.5;
  const worldW = gridX * cellSize;
  const worldH = depthZ * depthCellSize;
  const worldD = gridY * cellSize;

  const { deposits, hellPockets: generatedHellPockets, artifactCells, peakDepthMap } = useMemo(() => {
    const result = generateOilDistribution3D({
      blockHash, gridX, gridY, depthZ, totalOilBudget: OIL_FIELD_UNITS, numberOfDeposits,
      numberOfHellPockets, // match the server/admin count — else the 3D derives a different one
    });
    // Buried artifacts, derived from the same seed (default knobs — must match
    // the server's artifactPerColumn etc. if those are ever tuned per-season).
    // Only rendered behind the same reveal gate as hell pockets (admin/report).
    const artifacts = generateArtifactDistribution3D({
      blockHash, gridX, gridY, depthZ,
      oilGrid: result.grid, hellPockets: result.hellPockets,
    });
    // Per-column deposit depth: the layer (z) holding the most oil in that column.
    // The gusher feeder emanates from here so the beam rises out of the deposit the
    // cell actually holds, not from the current (often shallow) drill head.
    const peak = {};
    const g = result.grid;
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        let bestZ = -1, bestV = 0;
        for (let z = 0; z < depthZ; z++) {
          const v = g[x][y][z];
          if (v > bestV) { bestV = v; bestZ = z; }
        }
        if (bestZ >= 0) peak[`${x}_${y}`] = bestZ;
      }
    }
    return { deposits: result.deposits, hellPockets: result.hellPockets, artifactCells: artifacts.cells, peakDepthMap: peak };
  }, [blockHash, gridX, gridY, depthZ, numberOfDeposits, numberOfHellPockets, totalOilBudget]);

  // Build fragment shader with deposit data baked in as constants
  const fragmentShader = useMemo(() => {
    return buildFragShader({
      deposits, gridX, gridY, depthZ, cellSize, depthCellSize,
      worldW, worldH, worldD,
    });
  }, [deposits, gridX, gridY, depthZ, cellSize, depthCellSize, worldW, worldH, worldD]);

  const shaderUniforms = useMemo(() => ({
    uReveal: { value: revealProgress },
    uParabolum: { value: 1 }, // Paraboleum is the default substance — always green
  }), [revealProgress, parabolum]);

  // Sync Parabolum flag into the live volume material
  useEffect(() => {
    if (matRef.current) matRef.current.uniforms.uParabolum.value = 1;
  }, [parabolum]);

  // Sync reveal
  useEffect(() => {
    revealRef.current = revealProgress;
    if (matRef.current) matRef.current.uniforms.uReveal.value = revealProgress;
    const gop = 1 - revealProgress * 0.85;
    groundMatsRef.current.forEach(m => { m.opacity = gop; m.depthWrite = revealProgress < 0.01; m.depthTest = revealProgress < 0.01; });
  }, [revealProgress]);

  useEffect(() => {
    animatingRef.current = animateReveal;
    if (animateReveal) revealRef.current = 0;
  }, [animateReveal]);

  useFrame((_, delta) => {
    if (!animatingRef.current) return;
    revealRef.current = Math.min(1, revealRef.current + delta / revealDuration);
    if (matRef.current) matRef.current.uniforms.uReveal.value = revealRef.current;
    const r = revealRef.current;
    const op = 1 - r * 0.85;
    groundMatsRef.current.forEach(m => { m.opacity = op; m.depthWrite = r < 0.01; m.depthTest = r < 0.01; });
    if (revealRef.current >= 1) animatingRef.current = false;
  });

  return (
    <group>
      {/* Atmospheric distance fog (per-environment) — depth + softer horizon */}
      <FieldFog envPreset={envPreset} parabolum={parabolum} enabled={FIELD_FOG} />
      {/* Volumetric oil deposits — only rendered after reveal */}
      {(animateReveal || revealProgress > 0) && (
        <mesh position={[0, -worldH / 2, 0]} renderOrder={0}>
          <boxGeometry args={[worldW, worldH, worldD]} />
          <shaderMaterial
            ref={matRef}
            key={fragmentShader}
            vertexShader={volumeVert}
            fragmentShader={fragmentShader}
            uniforms={shaderUniforms}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Hell pocket markers — red glowing spheres in the underground */}
      {(animateReveal || revealProgress > 0) && generatedHellPockets.map((hp, i) => {
        const hx = -worldW / 2 + hp.x * cellSize + cellSize / 2;
        const hy = -hp.z * depthCellSize;
        const hz = worldD / 2 - hp.y * cellSize - cellSize / 2;
        return (
          <group key={`hell-${i}`} position={[hx, hy, hz]}>
            <mesh>
              <sphereGeometry args={[cellSize * 0.2, 12, 8]} />
              <meshStandardMaterial
                color="#ff1100"
                emissive="#ff2200"
                emissiveIntensity={2}
                transparent
                opacity={0.85}
              />
            </mesh>
            <pointLight color="#ff2200" intensity={3} distance={cellSize * 1.5} decay={2} />
          </group>
        );
      })}

      {/* Buried artifacts (docs/artifact-expansion.md) — same reveal gate as hell
          pockets. Octahedra colored per vein; cursed relics pulse-lit red. */}
      {(animateReveal || revealProgress > 0) && artifactCells.map((a, i) => {
        const ax = -worldW / 2 + a.x * cellSize + cellSize / 2;
        const ay = -a.z * depthCellSize;
        const az = worldD / 2 - a.y * cellSize - cellSize / 2;
        const col = a.type === "amber" ? "#ffb84d" : a.type === "map" ? "#ffe9a8"
          : a.type === "cache" ? "#ffd700" : a.cursed ? "#ff3b1f" : "#c79bff";
        return (
          <group key={`art-${i}`} position={[ax, ay, az]}>
            <mesh>
              <octahedronGeometry args={[cellSize * (a.type === "cache" ? 0.22 : 0.13), 0]} />
              <meshStandardMaterial color={col} emissive={col}
                emissiveIntensity={a.type === "cache" ? 2 : 1.2} transparent opacity={0.9} />
            </mesh>
            {(a.type === "cache" || a.cursed) && (
              <pointLight color={col} intensity={2} distance={cellSize * 1.2} decay={2} />
            )}
          </group>
        );
      })}

      {/* Opaque ground block — hidden once reveal starts */}
      {!animateReveal && revealProgress === 0 && (
        <mesh position={[0, -worldH / 2, 0]} material={groundMaterials}>
          <boxGeometry args={[worldW, worldH, worldD]} />
        </mesh>
      )}

      {/* Wireframe grid */}
      <group position={[0, -worldH / 2, 0]}>
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(worldW, worldH, worldD)]} />
          <lineBasicMaterial color={groundPalette.wire} transparent opacity={envPreset === "solstice" ? 0.62 : 0.5} />
        </lineSegments>

        <group position={[0, worldH / 2, 0]}>
          <PumpjackInstances
            gridX={gridX}
            gridY={gridY}
            cellSize={cellSize}
            worldW={worldW}
            worldD={worldD}
            drillDay={drillDay}
            maxDrillDay={depthZ}
            depthCellSize={depthCellSize}
            peakDepthMap={peakDepthMap}
            selectedCol={selectedCol}
            selectedRow={selectedRow}
            onSelectCell={onSelectCell}
            onFlyTo={onFlyTo}
            onZoomOut={onZoomOut}
            pumpConfig={pumpConfig}
            allPumpConfigs={allPumpConfigs}
            oilStrike={oilStrike}
            drillEvent={drillEvent}
            drillProximity={drillProximity}
            tankFill={tankFill}
            onTankDrain={onTankDrain}
            communityOil={communityOil}
            totalOilBudget={totalOilBudget}
            envPreset={envPreset}
            envMapPreset={envMapPreset}
            parabolum={parabolum}
            forceStrikeGusher={forceStrikeGusher}
            gusherTrigger={gusherTrigger}
            gusherEvents={gusherEvents}
            plotsWithMessages={plotsWithMessages}
            onEnvelopeClick={onEnvelopeClick}
            hellActive={hellActive}
            hellCol={hellCol}
            hellRow={hellRow}
            cameraViewable={cameraViewable}
            onFocusObject={onFocusObject}
          />
          {rogueEvents.map((ev) => (
            <RogueCharacter
              key={ev.id}
              event={ev}
              cellSize={cellSize}
              worldW={worldW}
              worldD={worldD}
              gridX={gridX}
              gridY={gridY}
              onArrive={onRogueArrive}
              onConsequence={onRogueConsequence}
            />
          ))}
          {hellActive && hellCol != null && hellRow != null && !demonBounty && (
            <HellDemon
              summonerCol={hellCol}
              summonerRow={hellRow}
              targetCol={demonTargetCol ?? hellCol}
              targetRow={demonTargetRow ?? hellRow}
              cellSize={cellSize}
              worldW={worldW}
              worldD={worldD}
              gridX={gridX}
              gridY={gridY}
              seed={demonSeed || `local_${hellCol}_${hellRow}`}
              clickable={demonCapturable}
              requiredHits={demonRequiredHits}
              onBanish={onClaimBounty}
              onMiss={onDemonMiss}
              onAttack={onDemonAttack}
            />
          )}
          {demonBounty && ["active", "flying", "waiting"].includes(demonBounty.status) && (
            <HellDemon
              summonerCol={demonBounty.summonerCol}
              summonerRow={demonBounty.summonerRow}
              targetCol={demonBounty.targetCol ?? demonBounty.summonerCol}
              targetRow={demonBounty.targetRow ?? demonBounty.summonerRow}
              cellSize={cellSize}
              worldW={worldW}
              worldD={worldD}
              gridX={gridX}
              gridY={gridY}
              seed={demonBounty.id}
              clickable={demonCapturable}
              requiredHits={demonRequiredHits}
              onBanish={onClaimBounty}
              onMiss={onDemonMiss}
              onAttack={onDemonAttack}
            />
          )}
          {/* Gusher events render as full animated rigs inside PumpjackInstances
              (pump pause + blowback + wellhead geyser), one per gushing cell. */}
          {Array.from({ length: gridX + 1 }, (_, i) => {
            const x = -worldW / 2 + i * cellSize;
            const points = [
              new THREE.Vector3(x, 0, -worldD / 2),
              new THREE.Vector3(x, 0, worldD / 2),
            ];
            return (
              <line key={`gx${i}`}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={0x9e8e78} transparent opacity={0.25} />
              </line>
            );
          })}
          {Array.from({ length: gridY + 1 }, (_, i) => {
            const z = -worldD / 2 + i * cellSize;
            const points = [
              new THREE.Vector3(-worldW / 2, 0, z),
              new THREE.Vector3(worldW / 2, 0, z),
            ];
            return (
              <line key={`gz${i}`}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={0x9e8e78} transparent opacity={0.25} />
              </line>
            );
          })}
        </group>

        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], ci) => (
          <group key={ci} position={[sx * worldW / 2, 0, sz * worldD / 2]}>
            {Array.from({ length: 5 }, (_, i) => {
              const y = worldH / 2 - (i * worldH) / 4;
              return (
                <line key={i}>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      args={[new Float32Array([0, y, 0, -sx * 0.3, y, -sz * 0.3]), 3]}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial color={0x8b7355} transparent opacity={0.3} />
                </line>
              );
            })}
          </group>
        ))}
      </group>

      {/* X axis labels (along front edge of top surface) */}
      {Array.from({ length: gridX }, (_, i) => {
        const x = -worldW / 2 + i * cellSize + cellSize / 2;
        return (
          <Text
            key={`xl${i}`}
            position={[x, 0.3, worldD / 2 + 0.8]}
            fontSize={0.35}
            color="#6b5b47"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {`X${i + 1}`}
          </Text>
        );
      })}

      {/* Commercial strip on the back (−Z) edge — same visibility gate as the
          opaque ground box, so it vanishes with the mesa during X-ray reveal. */}
      {!animateReveal && revealProgress === 0 && (
        <CommercialStrip
          worldW={worldW}
          worldD={worldD}
          cellSize={cellSize}
          envPreset={envPreset}
          onVendorClick={onVendorClick}
          onFocusObject={onFocusObject}
          onZoomOut={onZoomOut}
        />
      )}

      {/* Y axis labels (along left edge of top surface) */}
      {Array.from({ length: gridY }, (_, i) => {
        const z = worldD / 2 - i * cellSize - cellSize / 2;
        return (
          <Text
            key={`yl${i}`}
            position={[-worldW / 2 - 0.8, 0.3, z]}
            fontSize={0.35}
            color="#6b5b47"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {`Y${i + 1}`}
          </Text>
        );
      })}
    </group>
  );
}
