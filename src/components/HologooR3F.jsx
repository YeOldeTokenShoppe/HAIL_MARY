import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import * as Tone from "tone";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";

// Note pool used for the pluck chime that fires on blob merges
// (matches Hologoo.jsx:5).
const NOTES = ["C3","D3","E3","G3","A3","C4","D4","E4","G4","A4","C5","D5"];

// Quasi-periodic "goopy" oscillators. Pure sin() gives each blob a
// pendulum feel at high viscosity — you can see the position hit a peak,
// pause at zero velocity, and bounce back. That's what reads as
// "springy." Summing two sines at an incommensurate frequency ratio
// (0.53 is not a rational fraction of 1) produces a composite that's
// quasi-periodic: it never exactly repeats and doesn't dwell visibly at
// any predictable reversal point, so the motion reads as organic drift
// instead of a spring. Total amplitude is clamped to [-1, 1] by
// construction (0.65 + 0.35 = 1.0).
const goopySin = (t, f, p) =>
  Math.sin(t * f + p) * 0.65 +
  Math.sin(t * f * 0.53 + p * 1.9 + 1.7) * 0.35;
const goopyCos = (t, f, p) =>
  Math.cos(t * f + p) * 0.65 +
  Math.cos(t * f * 0.53 + p * 1.9 + 1.7) * 0.35;

/* ────────────────────────────────────────────────────────────
   HologooR3F — in-scene port of the standalone <Hologoo /> DOM
   component. Hologoo.jsx is a self-contained Three.js app that
   spins up its own WebGLRenderer + OrthographicCamera and
   raymarches a fullscreen shader plane; it can't be mounted
   inside an R3F Canvas directly.

   This component re-uses Hologoo's SDF metaball math but runs
   inside SpaceScene's Canvas as an R3F mesh billboarded above
   the Table. Additive blending + a radial soft-edge fade give
   it a "hologram" look (empty pixels pass through to the 3D
   scene behind). No HUD, audio, or mouse interaction — those
   are the DOM-component parts and don't make sense here.
   ──────────────────────────────────────────────────────────── */

// Plane local dimensions. These drive both the planeGeometry args AND
// the shader's uv range (via the uPlaneHalf uniform) so the shader's
// virtual camera FOV scales with the plane's physical size in BOTH axes
// — not just horizontally like the old uAspect-only setup did. Bigger
// values = bigger hologram surface AND more of the raymarched scene
// visible on it, which is what gives the blobs more room to roam
// without changing their shader-world radii.
const PLANE_WIDTH = 3.8;
const PLANE_HEIGHT = 5.4;
const PLANE_HALF_WIDTH = PLANE_WIDTH * 0.5;
const PLANE_HALF_HEIGHT = PLANE_HEIGHT * 0.5;

/* Vertex shader — standard R3F transform + pass-through UV. */
const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* Fragment shader — Hologoo's raymarched metaball field, but
   rewritten to sample via vUv (not gl_FragCoord) and to output
   additive-friendly color (zero = pass-through). */
const FRAG = `
precision highp float;

uniform float uTime;
uniform vec2 uPlaneHalf;
uniform vec3 uB0, uB1, uB2, uB3, uB4, uB5;
uniform float uR0, uR1, uR2, uR3, uR4, uR5;
uniform float uSmooth;
uniform float uGlow;
uniform float uHue;

varying vec2 vUv;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float mapBlobs(vec3 p) {
  float d = length(p - uB0) - uR0;
  d = smin(d, length(p - uB1) - uR1, uSmooth);
  d = smin(d, length(p - uB2) - uR2, uSmooth);
  d = smin(d, length(p - uB3) - uR3, uSmooth);
  d = smin(d, length(p - uB4) - uR4, uSmooth);
  d = smin(d, length(p - uB5) - uR5, uSmooth);
  return d;
}

// No ring geometry — the scene field is just the smoothed union of blobs.
float map(vec3 p) {
  return mapBlobs(p);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.012, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

const float HOFF0 = 0.0;
const float HOFF1 = 0.11;
const float HOFF2 = -0.09;
const float HOFF3 = 0.14;
const float HOFF4 = -0.06;
const float HOFF5 = 0.19;

vec3 blobColor(vec3 p) {
  float d0 = length(p - uB0) - uR0;
  float d1 = length(p - uB1) - uR1;
  float d2 = length(p - uB2) - uR2;
  float d3 = length(p - uB3) - uR3;
  float d4 = length(p - uB4) - uR4;
  float d5 = length(p - uB5) - uR5;
  float k = 5.0;
  float w0 = exp(-d0 * k);
  float w1 = exp(-d1 * k);
  float w2 = exp(-d2 * k);
  float w3 = exp(-d3 * k);
  float w4 = exp(-d4 * k);
  float w5 = exp(-d5 * k);
  float total = w0 + w1 + w2 + w3 + w4 + w5 + 0.001;
  vec3 c0 = hsl2rgb(uHue + HOFF0, 0.85, 0.6);
  vec3 c1 = hsl2rgb(uHue + HOFF1, 0.88, 0.58);
  vec3 c2 = hsl2rgb(uHue + HOFF2, 0.82, 0.55);
  vec3 c3 = hsl2rgb(uHue + HOFF3, 0.86, 0.6);
  vec3 c4 = hsl2rgb(uHue + HOFF4, 0.80, 0.57);
  vec3 c5 = hsl2rgb(uHue + HOFF5, 0.84, 0.62);
  return (c0*w0 + c1*w1 + c2*w2 + c3*w3 + c4*w4 + c5*w5) / total;
}

vec3 blobHighlight(vec3 p) {
  float d0 = length(p - uB0) - uR0;
  float d1 = length(p - uB1) - uR1;
  float d2 = length(p - uB2) - uR2;
  float d3 = length(p - uB3) - uR3;
  float d4 = length(p - uB4) - uR4;
  float d5 = length(p - uB5) - uR5;
  float k = 5.0;
  float w0=exp(-d0*k), w1=exp(-d1*k), w2=exp(-d2*k);
  float w3=exp(-d3*k), w4=exp(-d4*k), w5=exp(-d5*k);
  float total = w0+w1+w2+w3+w4+w5+0.001;
  vec3 c0 = hsl2rgb(uHue + HOFF0, 0.45, 0.85);
  vec3 c1 = hsl2rgb(uHue + HOFF1, 0.48, 0.83);
  vec3 c2 = hsl2rgb(uHue + HOFF2, 0.42, 0.82);
  vec3 c3 = hsl2rgb(uHue + HOFF3, 0.46, 0.85);
  vec3 c4 = hsl2rgb(uHue + HOFF4, 0.40, 0.84);
  vec3 c5 = hsl2rgb(uHue + HOFF5, 0.44, 0.86);
  return (c0*w0 + c1*w1 + c2*w2 + c3*w3 + c4*w4 + c5*w5) / total;
}

void main() {
  // Sample in local plane coordinates centered at 0. uv ranges
  // [-uPlaneHalf.x, uPlaneHalf.x] × [-uPlaneHalf.y, uPlaneHalf.y] —
  // i.e. matches the plane's actual local dimensions. This means the
  // shader's virtual camera FOV scales directly with the plane's size
  // on BOTH axes, so making the plane bigger genuinely shows more of
  // the raymarched scene (not just stretches the same image).
  vec2 uv = (vUv - 0.5) * 2.0 * uPlaneHalf;

  // Fixed virtual camera — the shader does its own raymarch from this
  // viewpoint regardless of where the R3F camera is. The plane is
  // billboarded so the viewer always sees this framing.
  vec3 ro = vec3(0.0, 3.5, 5.0);
  vec3 target = vec3(0.0, 0.2, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * fwd);

  // Raymarch
  float t = 0.0;
  float d = 0.0;
  for (int i = 0; i < 56; i++) {
    d = map(ro + rd * t);
    if (d < 0.008 || t > 28.0) break;
    t += d;
  }

  // Start fully additive-neutral (0,0,0). Anything we write *adds* onto
  // the scene behind; anything we don't write leaves the scene untouched.
  vec3 col = vec3(0.0);

  // Projector ambient glow — tinted by hue
  vec2 center = uv - vec2(0.0, -0.15);
  vec3 glowCol = hsl2rgb(uHue, 0.6, 0.3);
  col += glowCol * 0.12 * exp(-length(center) * 2.0);

  // Volumetric outer glow halo — sample the blob field along the ray
  {
    float gt = 0.0;
    for (int i = 0; i < 20; i++) {
      vec3 gp = ro + rd * gt;
      float gd = mapBlobs(gp);
      if (gd < 2.0 && gd > 0.01) {
        vec3 gCol = blobColor(gp);
        float gIntensity = exp(-gd * 1.8) * 0.018;
        gIntensity *= smoothstep(-1.0, 0.2, gp.y);
        col += gCol * gIntensity;
      }
      gt += max(0.15, gd * 0.5);
      if (gt > 20.0) break;
    }
  }

  // Surface hit shading — rings are gone, so every hit is a blob.
  if (d < 0.008) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    vec3 baseCol = blobColor(p);
    vec3 highlight = blobHighlight(p);
    float edge = max(dot(-rd, n), 0.0);
    float edgeFade = 0.45 + 0.55 * pow(edge, 0.6);
    float coreBright = pow(edge, 0.3) * 0.2;
    col = baseCol * edgeFade + highlight * coreBright;
    col += baseCol * uGlow * 0.4;
    float baseFade = smoothstep(-1.0, 0.0, p.y);
    col *= baseFade;

    float fog = 1.0 - smoothstep(4.0, 22.0, t);
    col *= fog;
  }

  // Projector beam
  float beamR = length(center.x);
  float beam = smoothstep(1.0, 0.0, beamR) * 0.018;
  float beamY = smoothstep(-0.5, 0.6, uv.y);
  beam *= (1.0 - beamY * 0.7);
  vec3 beamCol = hsl2rgb(uHue, 0.5, 0.3);
  col += beamCol * beam;

  // Bloom (linear HDR) — stronger to sell the glow
  float brightness = dot(col, vec3(0.299, 0.587, 0.114));
  col += col * smoothstep(0.35, 0.9, brightness) * 0.25;

  // Gamma correction to display space BEFORE applying the edge mask.
  // This order matters: if we masked in linear HDR and then applied
  // gamma, the gamma curve (pow(x, 0.4545)) would lift the faint masked
  // residue near the edge back into visible territory — which is what
  // was leaving a semi-opaque outline of the plane's shape. Gamma-first
  // means the mask scales already-display-space values, so a mask of 0
  // truly reads as black on screen.
  col = pow(col, vec3(0.4545));

  // Oblong (elliptical) edge mask with vertical emphasis. Semi-axes are
  // expressed as fractions of the plane's local half-dimensions so the
  // mask automatically scales with PLANE_WIDTH/PLANE_HEIGHT:
  //   0.80 × halfWidth  → horizontal extent stays inside the plane's edges
  //   0.92 × halfHeight → vertical extent stops just shy of top/bottom
  // Because PLANE_HEIGHT > PLANE_WIDTH the result is an ellipse that's
  // physically taller than wide in world space — the oblong vertical
  // shape you asked for. Squared for sharper falloff.
  float aX = uPlaneHalf.x * 0.80;
  float aY = uPlaneHalf.y * 0.92;
  vec2 eUv = vec2(uv.x / aX, uv.y / aY);
  float eR = length(eUv);
  float edgeMask = smoothstep(1.0, 0.2, eR);
  edgeMask *= edgeMask;
  col *= edgeMask;

  // Discard fragments outside the visible disc entirely — this removes
  // them from the pipeline (no blend, no AA contribution, no framebuffer
  // write), which is the only way to fully eliminate the rectangular
  // plane outline that the smoothstep fade was leaving behind. The alpha
  // = edgeMask output handles the transition zone (0.01–0.2) where we
  // do want the fragment to exist but at reduced intensity.
  if (edgeMask < 0.01) discard;
  gl_FragColor = vec4(col, edgeMask);
}
`;

export default function HologooR3F({
  enabled = true,
  hue = 180,
  // Scales the auto-computed size (based on the Table's footprint). At 1.0
  // the plane spans ~2x the table radius horizontally and ~1.25x vertically
  // before the radial soft-edge fade; tweak up/down from here to match the
  // scene. Good starting range: 0.6–1.4.
  sizeScale = 0.2,
  // Y offset above the detected table top, measured in table-radii. The
  // plane is billboarded, so its center lands at tableTop + tableRadius *
  // heightOffset. 0.55 puts it roughly where HoloProjector's shapes live.
  heightOffset = 0.35,
  // Multiplier on the blobs' autonomous motion amplitudes AND on the
  // hover-driven blob 0's reach. 1.0 matches Hologoo.jsx's original
  // range; higher values give blobs more room to roam inside the
  // hologram without changing their visual size (radii are unchanged).
  motionScale = 2.5,
  // "Goopiness" knob — higher = thicker / slower / more sluggish fluid
  // feel. Scales three things together: (a) slows the blobs' sinusoidal
  // motion (time divided by viscosity), (b) moderately bumps uSmooth so
  // neighbors connect a bit more without fully melting, (c) slows blob
  // 0's hover chase so it lags behind the cursor like it's being
  // dragged through honey. 1.0 = Hologoo.jsx original feel.
  viscosity = 2.5,
}) {
  const { scene } = useThree();
  const groupRef = useRef();
  const matRef = useRef();
  const tableFoundRef = useRef(false);

  // Blob state — mirrors Hologoo's animate() logic. Persist across
  // renders via a single ref so random init only runs once. The Y-axis
  // (base + amp) has been widened vs. Hologoo.jsx to give blobs more
  // vertical travel — pairs with the oblong edge mask which now leaves
  // more vertical room than horizontal.
  const blobsRef = useRef(null);
  if (!blobsRef.current) {
    blobsRef.current = Array.from({ length: 6 }, () => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        Math.random() * 1.8,
        (Math.random() - 0.5) * 2.5
      ),
      baseX: (Math.random() - 0.5) * 0.8,
      baseY: 0.2 + Math.random() * 1.1,         // was 0.3 + 0.8 * r
      baseZ: (Math.random() - 0.5) * 0.8,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
      speedX: 0.1 + Math.random() * 0.2,
      speedY: 0.08 + Math.random() * 0.15,
      speedZ: 0.09 + Math.random() * 0.18,
      ampX: 0.6 + Math.random() * 0.9,
      ampY: 0.5 + Math.random() * 0.8,          // was 0.3 + 0.5 * r
      ampZ: 0.6 + Math.random() * 0.9,
    }));
  }

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPlaneHalf: { value: new THREE.Vector2(PLANE_HALF_WIDTH, PLANE_HALF_HEIGHT) },
      uB0: { value: new THREE.Vector3() },
      uB1: { value: new THREE.Vector3() },
      uB2: { value: new THREE.Vector3() },
      uB3: { value: new THREE.Vector3() },
      uB4: { value: new THREE.Vector3() },
      uB5: { value: new THREE.Vector3() },
      uR0: { value: 0.65 },
      uR1: { value: 0.55 },
      uR2: { value: 0.58 },
      uR3: { value: 0.48 },
      uR4: { value: 0.60 },
      uR5: { value: 0.45 },
      uSmooth: { value: 0.9 },
      uGlow: { value: 0 },
      uHue: { value: hue / 360 },
    }),
    // Only create the uniforms object once; hue updates go through useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Find Table and auto-position (mirrors HoloProjector's approach) ──
  useEffect(() => {
    if (tableFoundRef.current) return;
    const findTable = () => {
      const table = scene.getObjectByName("Table");
      if (!table || !groupRef.current) return false;
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(table);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const tableTop = box.max.y;
      const tableRadius = Math.max(size.x, size.z) * 0.5;
      // Center the billboard above the table top by `heightOffset` * radius
      // so it floats at roughly the same altitude as HoloProjector's shapes.
      groupRef.current.position.set(
        center.x,
        tableTop + tableRadius * heightOffset,
        center.z
      );
      // Scale the plane to ~sizeScale * table diameter.
      groupRef.current.scale.setScalar(tableRadius * 2 * sizeScale);
      tableFoundRef.current = true;
      return true;
    };
    if (!findTable()) {
      const interval = setInterval(() => {
        if (findTable()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [scene, sizeScale, heightOffset]);

  const glowRef = useRef(0);
  const uKeys = useMemo(() => ["uB0", "uB1", "uB2", "uB3", "uB4", "uB5"], []);
  const radii = useMemo(() => [0.65, 0.55, 0.58, 0.48, 0.60, 0.45], []);

  // ── Hover interaction ──
  // Mirrors Hologoo.jsx's interactive blob 0: while the pointer is hovering
  // over the plane, blob 0 eases toward the hover position, so the user can
  // "push" it into the others and trigger the merge glow. OrbitControls
  // only captures dragging — R3F's object-level onPointerMove still fires
  // during hover, so these two systems coexist cleanly.
  const mouseActiveRef = useRef(false);
  const mouseWorldRef = useRef({ x: 0, y: 0 });
  const handlePointerMove = (e) => {
    // `e.uv` is populated by R3F for meshes that have UVs (planeGeometry
    // does). Range [0, 1] across the plane — convert to the shader's
    // internal "world" coordinates. Scale by the plane's local half-dims
    // so the hover target range grows automatically when PLANE_WIDTH /
    // PLANE_HEIGHT change. motionScale widens reach further on top.
    if (!e.uv) return;
    const nx = e.uv.x * 2 - 1;        // -1..1 across plane width
    const ny = e.uv.y * 2 - 1;        // -1..1 across plane height
    mouseWorldRef.current.x = nx * PLANE_HALF_WIDTH * 2.2 * motionScale;
    mouseWorldRef.current.y = ny * PLANE_HALF_HEIGHT * 1.4 * motionScale + 0.5;
    mouseActiveRef.current = true;
  };
  const handlePointerOut = () => {
    mouseActiveRef.current = false;
  };

  // ── Audio ──
  // Ported from Hologoo.jsx's Tone.js setup (pad + pluck + reverb + delay
  // + LFO-modulated filter). Can't be initialized eagerly because Web
  // Audio APIs require a user gesture before AudioContext starts — so we
  // lazy-init on the first click on the plane.
  //
  // `audioRef` holds the whole chain once initialized. `mergesRef` tracks
  // which blob pairs are currently overlapping so we fire the chime on
  // the transition from "not merging" → "merging" (not every frame).
  const audioRef = useRef(null);
  const mergesRef = useRef(new Set());

  const initAudio = async () => {
    if (audioRef.current) return;
    try {
      await Tone.start();
      const reverb = new Tone.Freeverb({ roomSize: 0.9, dampening: 1000 });
      reverb.wet.value = 0.7;
      const delay = new Tone.PingPongDelay("8n", 0.5);
      delay.wet.value = 0.35;
      const filter = new Tone.Filter(2000, "lowpass");
      const lfo = new Tone.LFO(0.06, 200, 2600);
      lfo.connect(filter.frequency);
      lfo.start();

      const pad = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 6,
        oscillator: { type: "sine" },
        envelope: { attack: 0.3, decay: 0.5, sustain: 0.6, release: 3 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.2, decay: 0.4, sustain: 0.7, release: 0.8 },
      });
      pad.chain(filter, delay, reverb, Tone.Destination);
      pad.volume.value = -16;

      const pluck = new Tone.PolySynth(Tone.MembraneSynth, {
        pitchDecay: 0.07,
        octaves: 3.5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.003, decay: 0.7, sustain: 0.01, release: 3 },
      });
      pluck.chain(filter, reverb, Tone.Destination);
      pluck.volume.value = -6;

      pad.triggerAttack(["A2", "E3", "G3"], Tone.now(), 0.06);
      Tone.Transport.start();
      audioRef.current = { pad, pluck, filter, reverb, delay, lfo };
    } catch (err) {
      console.error("[HologooR3F] audio init failed:", err);
    }
  };

  const triggerMerge = (depth) => {
    const audio = audioRef.current;
    if (!audio) return;
    const i1 = Math.floor(Math.random() * NOTES.length);
    const i2 = Math.min(NOTES.length - 1, i1 + 1 + Math.floor(Math.random() * 3));
    try {
      audio.pluck.triggerAttackRelease(
        [NOTES[i1], NOTES[i2]],
        "8n",
        "+0",
        Math.max(0.05, Math.min(0.45, depth * 0.8))
      );
    } catch (e) {}
  };

  const updateMergeAudio = (totalDepth) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.reverb.wet.value = Math.min(0.95, 0.55 + totalDepth * 0.4);
    audio.delay.wet.value = Math.min(0.65, 0.25 + totalDepth * 0.35);
    audio.pad.set({ harmonicity: Math.min(6, 3 + totalDepth * 2) });
  };

  // Start audio on the first click anywhere in the scene (not just on the
  // hologram mesh). Web Audio requires a user gesture, so we attach a
  // one-shot listener on the canvas DOM element.
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handler = () => {
      initAudio();
      canvas.removeEventListener("click", handler);
    };
    canvas.addEventListener("click", handler);
    return () => canvas.removeEventListener("click", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // Dispose the audio chain when the component unmounts so we don't leak
  // Tone nodes between navigations.
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        audio.pad.releaseAll();
        audio.pad.dispose();
        audio.pluck.dispose();
        audio.filter.dispose();
        audio.reverb.dispose();
        audio.delay.dispose();
        audio.lfo.dispose();
      } catch (e) {}
      audioRef.current = null;
    };
  }, []);

  useFrame((state) => {
    if (!enabled || !matRef.current) return;
    const t = state.clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uHue.value = hue / 360;

    const blobs = blobsRef.current;
    const mw = mouseWorldRef.current;
    // motionScale widens each blob's sinusoidal travel without touching
    // the uR* radii — i.e. more space to maneuver without making them
    // visually larger.
    const ms = motionScale;
    // Goopy / viscous feel: run the motion sinusoids on a slowed-down
    // virtual clock (effT) and slow blob 0's hover chase by the same
    // factor, so everything feels like it's moving through a thick fluid.
    const effT = t / viscosity;
    const hoverEase = 0.06 / viscosity;
    const hoverEaseZ = 0.08 / viscosity;
    for (let i = 0; i < 6; i++) {
      const b = blobs[i];
      if (i === 0 && mouseActiveRef.current) {
        // Interactive blob: ease toward the hover position. At viscosity
        // = 1.8 this ease is ~0.033, which gives a noticeable lag — blob
        // 0 feels like it's being dragged through honey.
        b.pos.x += (mw.x - b.pos.x) * hoverEase;
        b.pos.y += (Math.max(-0.5, mw.y) - b.pos.y) * hoverEase;
        b.pos.z += (0 - b.pos.z) * hoverEaseZ;
      } else if (i === 0) {
        // Blob 0 idle drift — ease toward the goopy path rather than
        // snapping, so it returns smoothly after the pointer leaves.
        b.pos.x += (b.baseX + goopySin(effT, b.speedX, b.phaseX) * b.ampX * ms - b.pos.x) * 0.015;
        b.pos.y += (b.baseY + goopyCos(effT, b.speedY, b.phaseY) * b.ampY * ms - b.pos.y) * 0.015;
        b.pos.z += (b.baseZ + goopySin(effT, b.speedZ, b.phaseZ) * b.ampZ * ms - b.pos.z) * 0.015;
      } else {
        b.pos.x = b.baseX + goopySin(effT, b.speedX, b.phaseX) * b.ampX * ms;
        b.pos.y = b.baseY + goopyCos(effT, b.speedY, b.phaseY) * b.ampY * ms;
        b.pos.z = b.baseZ + goopySin(effT, b.speedZ, b.phaseZ) * b.ampZ * ms;
      }
      uniforms[uKeys[i]].value.copy(b.pos);
    }

    // Merge detection → drives the uGlow "combined heat" effect AND the
    // audio chime (when a pair transitions from apart → merging). Mirrors
    // Hologoo.jsx:456-471.
    let mergeCount = 0;
    let totalDepth = 0;
    const merges = mergesRef.current;
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const dist = blobs[i].pos.distanceTo(blobs[j].pos);
        const thresh = radii[i] + radii[j] + uniforms.uSmooth.value * 0.6;
        const key = `${i}-${j}`;
        if (dist < thresh) {
          const depth = 1 - dist / thresh;
          mergeCount++;
          totalDepth += depth;
          if (!merges.has(key)) {
            merges.add(key);
            triggerMerge(depth);
          }
        } else {
          merges.delete(key);
        }
      }
    }
    glowRef.current += (Math.min(1, mergeCount * 0.2) - glowRef.current) * 0.05;
    uniforms.uGlow.value = glowRef.current;
    updateMergeAudio(Math.min(1, totalDepth));
    // uSmooth — the smin smoothing factor. Base is modestly bumped by
    // viscosity (linear, moderate coefficient) so neighbors melt into
    // each other a little more at higher goopiness, but not enough to
    // lose individual blob identity. At viscosity=1.0 this exactly
    // matches Hologoo.jsx's original oscillation.
    const uSmoothMult = 1 + (viscosity - 1) * 0.3;
    uniforms.uSmooth.value = (0.9 + Math.sin(t * 0.2) * 0.15) * uSmoothMult;
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef}>
      <Billboard>
        <mesh
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={(e) => {
            // Stop propagation so clicking the hologram doesn't also
            // hit the Model's handleClick and trigger a break-out / zoom.
            e.stopPropagation();
          }}
        >
          <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
          <shaderMaterial
            ref={matRef}
            vertexShader={VERT}
            fragmentShader={FRAG}
            uniforms={uniforms}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={true}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
    </group>
  );
}
