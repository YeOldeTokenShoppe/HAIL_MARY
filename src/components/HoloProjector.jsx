import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import NeuralNetworkR3F from "./NeuralNetworkR3F";

/* ────────────────────────────────────────────────────────────
   HoloProjector — hologram table display cycling 4 phases:
     0  Tesseract    (4D hypercube wireframe mesh)
     1  Penrose Triangle (impossible triangle + spinning ring + vortex)
     2  Terrain      (particle noise topography)
     3  Our Lady     (HolographicStatue3-style mesh)
   ──────────────────────────────────────────────────────────── */

const HOLD_TIME = 7.0;
const TRANSITION_TIME = 2.5;
const HOLO_RADIUS = 0.65;
const HOLO_HEIGHT = 0.9;

const TESSERACT_PHASE = 0;
const PENROSE_PHASE = 1;
const SINGULARITY_PHASE = 2;
const NEURAL_PHASE = 3;
const GEOMETRY_PHASE = 4;
const LADY_PHASE = 5; // kept for code refs but not in rotation
const TOTAL_PHASES = 5;
const VORTEX_COUNT = 350;

/* ══════════════════════════════════════════════════════════════
   TESSERACT — 4D hypercube
   ══════════════════════════════════════════════════════════════ */

// 16 vertices of a 4D hypercube (each component is ±1)
const VERTICES_4D = [];
for (let i = 0; i < 16; i++) {
  VERTICES_4D.push(new THREE.Vector4(
    (i & 1) ? 1 : -1,
    (i & 2) ? 1 : -1,
    (i & 4) ? 1 : -1,
    (i & 8) ? 1 : -1
  ));
}

// 32 edges — connect vertices that differ in exactly one bit
const EDGES_INNER = [];     // both vertices w = -1
const EDGES_OUTER = [];     // both vertices w = +1
const EDGES_CONNECTOR = []; // one w=-1, one w=+1
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    const diff = i ^ j;
    if ((diff & (diff - 1)) !== 0) continue; // not exactly 1 bit
    const iW = (i & 8) !== 0, jW = (j & 8) !== 0;
    if (!iW && !jW) EDGES_INNER.push([i, j]);
    else if (iW && jW) EDGES_OUTER.push([i, j]);
    else EDGES_CONNECTOR.push([i, j]);
  }
}
const ALL_EDGES = [...EDGES_INNER, ...EDGES_OUTER, ...EDGES_CONNECTOR];

// 4D rotation in the XW plane
function rotXW(v, t) {
  const c = Math.cos(t), s = Math.sin(t);
  return new THREE.Vector4(v.x * c - v.w * s, v.y, v.z, v.x * s + v.w * c);
}

// 4D rotation in the ZW plane
function rotZW(v, t) {
  const c = Math.cos(t), s = Math.sin(t);
  return new THREE.Vector4(v.x, v.y, v.z * c - v.w * s, v.z * s + v.w * c);
}

// Perspective projection from 4D → 3D, scaled to fit hologram
function project4(v4, size) {
  const w = 1 / (3.0 - v4.w);
  return new THREE.Vector3(v4.x * w * size, v4.y * w * size, v4.z * w * size);
}

/* ══════════════════════════════════════════════════════════════
   SHADERS
   ══════════════════════════════════════════════════════════════ */

/* ── Tesseract tube glow shader (for the halo layer) ── */
const tessGlowVert = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const tessGlowFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    // Edge glow — strongest at edges of the tube (fresnel)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 1.2);

    // Scan lines
    float scan = sin((vWorldPos.y - uTime * 0.15) * 45.0) * 0.5 + 0.5;
    scan = pow(scan, 3.0) * 0.2 + 0.8;

    float alpha = fresnel * scan * uFade * 0.6;
    gl_FragColor = vec4(uColor * 1.5, alpha);
  }
`;

/* ── GLB shell glow shader (vertex-displaced fresnel aura) ── */
const glbShellVert = /* glsl */ `
  uniform float uPush;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 displaced = position + normal * uPush;
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const glbShellFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 1.6);
    float alpha = fresnel * uOpacity * 0.75;
    gl_FragColor = vec4(uColor * 1.8, alpha);
  }
`;

/* ── Our Lady holographic shader ── */
const holoStatueVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vPosition;
  varying vec3 vNormal;

  vec2 random2D(vec2 st) {
    st = vec2(dot(st, vec2(127.1, 311.7)),
             dot(st, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
  }

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    float glitchTime = uTime - modelPosition.y;
    float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) + sin(glitchTime * 8.76) * 1.1;
    glitchStrength /= 3.0;
    glitchStrength = smoothstep(0.3, 1.0, glitchStrength);
    glitchStrength *= 0.03;
    modelPosition.x += (random2D(modelPosition.xz + uTime).x - 0.5) * glitchStrength;
    modelPosition.z += (random2D(modelPosition.zx + uTime).x - 0.5) * glitchStrength;

    gl_Position = projectionMatrix * viewMatrix * modelPosition;
    vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
    vPosition = modelPosition.xyz;
    vNormal = modelNormal.xyz;
  }
`;

const holoStatueFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFade;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal *= -1.0;

    float stripes = mod((vPosition.y - uTime * 0.02) * 14.0, 1.0);
    stripes = pow(stripes, 3.0);

    vec3 viewDirection = normalize(vPosition - cameraPosition);
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 1.6);

    float falloff = smoothstep(0.8, 0.2, fresnel);
    float holographic = stripes * fresnel;
    holographic += fresnel * 2.25;
    holographic *= falloff;

    gl_FragColor = vec4(uColor, holographic * uFade);
  }
`;

/* ── Beam cone shader ── */
const beamVert = /* glsl */ `
  varying vec2 vUv;
  varying float vY;
  void main() {
    vUv = uv;
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beamFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uBeamOpacity;
  varying vec2 vUv;
  varying float vY;

  void main() {
    float heightFade = 1.0 - smoothstep(0.0, 0.9, vUv.y);
    heightFade = pow(heightFade, 1.5);
    float scan = sin((vY - uTime * 0.4) * 60.0) * 0.5 + 0.5;
    scan = pow(scan, 4.0) * 0.3 + 0.7;
    float edgeFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
    edgeFade = pow(edgeFade, 0.5);
    float alpha = heightFade * scan * edgeFade * uBeamOpacity;
    gl_FragColor = vec4(uColor, alpha * 0.35);
  }
`;

/* ── Penrose triangle shaders ── */
const penroseVert = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vColor = aColor;
    vNormal = normalMatrix * normal;
    vPosition = position;
    vec3 pos = position;
    // Subtle breathing pulse
    pos *= 1.0 + sin(uTime * 1.5 + length(position) * 8.0) * 0.02;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const penroseFrag = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // Edge glow based on face normal
    float edge = 1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
    float edgeGlow = pow(edge, 1.5) * 0.6;

    // Shimmer traveling along the shape
    float shimmer = sin(uTime * 3.0 + vPosition.x * 12.0 + vPosition.y * 8.0) * 0.15 + 0.85;

    vec3 color = vColor * shimmer * (1.0 + edgeGlow);
    gl_FragColor = vec4(color, uFade);
  }
`;

/* ── Spinning orbital ring shader ── */
const penroseRingVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const penroseRingFrag = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    // Gradient from cyan to peach around the ring
    float angle = atan(vPosition.z, vPosition.x) / 6.2832 + 0.5;
    vec3 cyan = vec3(0.68, 0.91, 0.98);
    vec3 peach = vec3(0.99, 0.78, 0.63);
    vec3 color = mix(cyan, peach, angle);

    // Pulse
    float pulse = sin(uTime * 4.0 + angle * 12.0) * 0.3 + 0.7;
    color *= pulse;

    // Thin ring edge fade
    float tubeFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float alpha = tubeFade * 0.7 * uFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

/* ── Singularity (black hole + accretion disk) shaders ── */
const singularityVert = /* glsl */ `
  varying vec3 vLocalPos;
  void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const singularityFrag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uLocalCamera;
  uniform float uSphereRadius;
  varying vec3 vLocalPos;

  #define PI 3.14159265359

  // All distances in Schwarzschild-radius units
  const float EH = 1.0;            // event horizon
  const float DISK_INNER = 3.0;    // ISCO for non-rotating BH
  const float DISK_OUTER = 11.0;
  const float ESCAPE = 24.0;

  // Tilted disk plane (~25° from horizontal — for the iconic 3/4 view)
  const vec3 DISK_NORMAL = vec3(0.0, 0.9063, 0.4226);
  const vec3 DISK_U = vec3(1.0, 0.0, 0.0);
  const vec3 DISK_V = vec3(0.0, -0.4226, 0.9063);

  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash21(i+vec2(0,0)), hash21(i+vec2(1,0)), u.x),
               mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.55;
    for(int i = 0; i < 4; i++){
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  vec3 diskColor(vec3 cp, vec3 rd){
    // Project hit point onto disc plane (raw u, v in disc coordinates)
    float u0 = dot(cp, DISK_U);
    float v0 = dot(cp, DISK_V);
    float r = sqrt(u0*u0 + v0*v0);

    // Bulk disc rotation around its own normal axis — visible spinning
    float discRot = uTime * 0.55;
    float cR = cos(discRot), sR = sin(discRot);
    float u = u0 * cR - v0 * sR;
    float v = u0 * sR + v0 * cR;
    float ang = atan(v, u);

    // Truchet palette gradient (outer blue → mid pink → inner purple)
    float tNorm = 1.0 - smoothstep(DISK_INNER, DISK_OUTER, r);
    tNorm = pow(tNorm, 1.4);

    vec3 cool = vec3(0.36, 0.66, 0.95);   // outer blue
    vec3 mid  = vec3(0.95, 0.36, 0.87);   // mid pink
    vec3 hot  = vec3(0.62, 0.36, 0.95);   // inner purple
    vec3 col = mix(cool, mid, smoothstep(0.0, 0.5, tNorm));
    col = mix(col, hot, smoothstep(0.5, 1.0, tNorm));

    // Keplerian differential rotation on top of bulk spin (inner faster)
    float omega = 3.2 / pow(max(r, 0.5), 1.2);
    float spiral = ang - uTime * omega + r * 0.35;

    // Turbulent banding pattern
    float n = fbm(vec2(spiral * 2.5, r * 1.4));
    float bands = sin(spiral * 6.0 + n * 4.0) * 0.5 + 0.5;
    float pattern = mix(n, n * bands, 0.6);
    col *= 0.6 + pattern * 1.8;

    // Doppler beaming (orbital direction follows the rotated frame)
    vec2 orbital2D = vec2(-v, u) / max(r, 0.01);
    vec3 orbital3D = orbital2D.x * DISK_U + orbital2D.y * DISK_V;
    float orbitalSpeed = 0.55 / sqrt(max(r, 1.0));
    float doppler = 1.0 + dot(orbital3D, -rd) * orbitalSpeed;
    col *= pow(clamp(doppler, 0.25, 4.0), 2.5);

    // Inner edge bloom — extra-bright near ISCO
    float innerBoost = smoothstep(DISK_INNER * 2.2, DISK_INNER, r);
    col += vec3(0.9, 0.75, 1.0) * innerBoost * 1.4;

    return col * 2.1;
  }

  void main() {
    // Local-space ray (starts at camera, points through this fragment)
    vec3 rd_local = normalize(vLocalPos - uLocalCamera);

    // Map to shader units: bounding sphere → ~22 Schwarzschild radii
    float SCALE = 22.0 / uSphereRadius;
    vec3 ro = uLocalCamera * SCALE;   // camera in shader space
    vec3 rd = rd_local;                // direction unchanged by uniform scale

    // Find entry into the bounding sphere (radius 22 in shader units, centered at origin).
    // If the camera is already inside, entry is at the camera itself (tEntry = 0).
    const float BS_R = 22.0;
    float bDot = dot(ro, rd);
    float cDot = dot(ro, ro) - BS_R * BS_R;
    if (cDot > 0.0) {
      // Camera outside the bounding sphere — march forward to the front intersection
      float disc = bDot * bDot - cDot;
      if (disc < 0.0) discard;          // ray misses sphere entirely (shouldn't happen on a sphere fragment)
      float tEntry = -bDot - sqrt(disc);
      ro += rd * max(tEntry, 0.0);
    }

    // Raymarching
    vec3 pos = ro;
    vec3 vel = rd;
    vec3 prevPos = pos;
    vec3 accum = vec3(0.0);
    float diskAlpha = 0.0;
    bool hitEH = false;
    float minR = 1e10;

    for (int i = 0; i < 180; i++) {
      float r2 = dot(pos, pos);
      float r = sqrt(r2);
      minR = min(minR, r);

      if (r < EH) { hitEH = true; break; }
      if (r > ESCAPE && i > 6) break;

      // Variable step: tighter near the hole
      float ds = 0.22 + r * 0.075;

      // Gravitational deflection (visual approximation of geodesic bending)
      vel -= 1.6 * pos / (r2 * r) * ds;
      vel = normalize(vel);

      prevPos = pos;
      pos += vel * ds;

      // Disk crossing — find where the ray crosses the disk plane
      float prevH = dot(prevPos, DISK_NORMAL);
      float currH = dot(pos, DISK_NORMAL);
      if (sign(prevH) != sign(currH)) {
        float frac = abs(prevH) / (abs(prevH) + abs(currH) + 1e-6);
        vec3 cp = mix(prevPos, pos, frac);
        float u = dot(cp, DISK_U);
        float v = dot(cp, DISK_V);
        float diskR = sqrt(u*u + v*v);
        if (diskR >= DISK_INNER && diskR <= DISK_OUTER) {
          vec3 dc = diskColor(cp, vel);
          // Front-to-back compositing — earlier hits have more weight
          accum += dc * (1.0 - diskAlpha) * 0.55;
          diskAlpha = min(1.0, diskAlpha + 0.45);
        }
      }
    }

    vec3 outColor;
    float outAlpha;

    if (hitEH) {
      outColor = vec3(0.0);
      outAlpha = 1.0;
    } else {
      outColor = accum;
      outAlpha = diskAlpha;
    }

    // Photon ring — bright contribution if the ray's closest approach was near 1.5 Rs
    float photonRing = exp(-pow((minR - 1.55) * 4.0, 2.0));
    outColor += vec3(0.9, 0.65, 1.05) * photonRing * 1.2;
    outAlpha = max(outAlpha, photonRing * 0.9);

    gl_FragColor = vec4(outColor, outAlpha * uFade);
  }
`;

const torusVortexVert = /* glsl */ `
  attribute vec3 customColor;
  attribute float aSize;
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = customColor;
    vAlpha = (1.0 - length(position) / 1.5) * uFade;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (120.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const torusVortexFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    // Source shimmer + glow
    float shimmer = sin(uTime * 8.0 + dist * 15.0) * 0.3 + 0.7;
    float glow = exp(-dist * 5.0);
    gl_FragColor = vec4(vColor * shimmer, glow * max(vAlpha, 0.0) * 0.65);
  }
`;

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function HoloProjector({ enabled = true }) {
  // Refs
  const groupRef = useRef();
  const tessGroupRef = useRef();
  const tessEdgesRef = useRef();
  const torusGroupRef = useRef();
  const torusDataRef = useRef(null);
  const singularityGroupRef = useRef();
  const singularityDataRef = useRef(null);
  const neuralGroupRef = useRef();
  const geometryGroupRef = useRef();
  const geometryDataRef = useRef(null);
  const ladyGroupRef = useRef();
  const phaseRef = useRef(TESSERACT_PHASE);
  const timerRef = useRef(0);
  const transitioning = useRef(false);
  const tableFoundRef = useRef(false);
  const tableScaleRef = useRef(1);

  // Fade state for each mesh phase: { current, target }
  const tessFadeRef = useRef({ current: 1, target: 1 });
  const torusFadeRef = useRef({ current: 0, target: 0 });
  const singularityFadeRef = useRef({ current: 0, target: 0 });
  const neuralFadeRef = useRef({ current: 0, target: 0 });
  const geometryFadeRef = useRef({ current: 0, target: 0 });
  const ladyFadeRef = useRef({ current: 0, target: 0 });

  // Tesseract rotation angles
  const tessAngleRef = useRef({ xw: 0, zw: 0 });

  const { scene: r3fScene } = useThree();
  const { scene: maryScene } = useGLTF("/models/CyberpunkMaryHeartRed2.glb");
  const { scene: geometryScene, animations: geometryAnimations } = useGLTF("/models/geometry1.glb");

  /* ── Materials ── */

  // Shared fade uniform for all tesseract materials
  const tessFadeUniform = useMemo(() => ({ value: 1 }), []);
  const tessTimeUniform = useMemo(() => ({ value: 0 }), []);

  // Solid tube core — bright emissive
  const tessInnerCoreMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(0x4dffa0),
    emissiveIntensity: 3.0,
    roughness: 0.3,
    metalness: 0.85,
    transparent: true,
    opacity: 1,
  }), []);

  const tessOuterCoreMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(0x4db8ff),
    emissiveIntensity: 2.5,
    roughness: 0.3,
    metalness: 0.85,
    transparent: true,
    opacity: 1,
  }), []);

  const tessConnectorCoreMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(0x9090ff),
    emissiveIntensity: 13.5,
    roughness: 0.3,
    metalness: 0.85,
    transparent: true,
    opacity: 1,
  }), []);

  // Glow halo layer — larger transparent tube around each edge
  const tessInnerGlowMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x4dffa0) },
      uFade: tessFadeUniform,
      uTime: tessTimeUniform,
    },
    vertexShader: tessGlowVert,
    fragmentShader: tessGlowFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [tessFadeUniform, tessTimeUniform]);

  const tessOuterGlowMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x4db8ff) },
      uFade: tessFadeUniform,
      uTime: tessTimeUniform,
    },
    vertexShader: tessGlowVert,
    fragmentShader: tessGlowFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [tessFadeUniform, tessTimeUniform]);

  const tessConnectorGlowMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x9090ff) },
      uFade: tessFadeUniform,
      uTime: tessTimeUniform,
    },
    vertexShader: tessGlowVert,
    fragmentShader: tessGlowFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [tessFadeUniform, tessTimeUniform]);

  // Torus portal materials — shared fade uniform
  const torusFadeUniform = useMemo(() => ({ value: 0 }), []);

  const penroseMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: torusFadeUniform,
    },
    vertexShader: penroseVert,
    fragmentShader: penroseFrag,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  }), [torusFadeUniform]);

  const penroseRingMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: torusFadeUniform,
    },
    vertexShader: penroseRingVert,
    fragmentShader: penroseRingFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [torusFadeUniform]);

  const torusVortexMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: torusFadeUniform,
    },
    vertexShader: torusVortexVert,
    fragmentShader: torusVortexFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [torusFadeUniform]);

  // Singularity (raymarched black hole) material
  const singularityFadeUniform = useMemo(() => ({ value: 0 }), []);
  const singularityMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: singularityFadeUniform,
      uLocalCamera: { value: new THREE.Vector3() },
      uSphereRadius: { value: HOLO_RADIUS * 1.55 },
    },
    vertexShader: singularityVert,
    fragmentShader: singularityFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  }), [singularityFadeUniform]);

  const holoStatueMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00ffff) },
      uFade: { value: 0 },
    },
    vertexShader: holoStatueVert,
    fragmentShader: holoStatueFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  }), []);

  const beamMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x4db8ff) },
      uBeamOpacity: { value: 1.0 },
    },
    vertexShader: beamVert,
    fragmentShader: beamFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  /* ── Find Table and auto-position ── */
  useEffect(() => {
    if (tableFoundRef.current) return;
    const findTable = () => {
      const table = r3fScene.getObjectByName("Table");
      if (!table || !groupRef.current) return false;
      r3fScene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(table);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const tableTop = box.max.y;
      const tableRadius = Math.max(size.x, size.z) * 0.5;
      console.log("Table found:", { center: center.toArray(), size: size.toArray(), tableTop, tableRadius });
      groupRef.current.position.set(center.x, tableTop + 0.05, center.z);
      const scaleFactor = (tableRadius * 0.4) / HOLO_RADIUS;
      groupRef.current.scale.setScalar(scaleFactor);
      tableScaleRef.current = scaleFactor;
      tableFoundRef.current = true;
      return true;
    };
    if (!findTable()) {
      const interval = setInterval(() => { if (findTable()) clearInterval(interval); }, 500);
      return () => clearInterval(interval);
    }
  }, [r3fScene]);

  // Shared cylinder geometry — pivot at one end, oriented along +Z
  const cylGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 10);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);

  /* ── Build tesseract geometry — tube meshes + glass sphere ── */
  useEffect(() => {
    if (!tessGroupRef.current) return;
    const TUBE_THICKNESS = 0.012;
    const GLOW_THICKNESS = 0.045;

    const edgeMeshes = [];
    const allObjects = [];

    // Helper: create a tube core + glow halo for one edge
    const makeEdgePair = (coreMat, glowMat) => {
      const core = new THREE.Mesh(cylGeo, coreMat);
      const glow = new THREE.Mesh(cylGeo, glowMat);
      tessGroupRef.current.add(core);
      tessGroupRef.current.add(glow);
      allObjects.push(core, glow);
      return { core, glow };
    };

    // Create 32 edge pairs (core + glow)
    const edgePairs = [];
    EDGES_INNER.forEach(() => edgePairs.push(makeEdgePair(tessInnerCoreMat, tessInnerGlowMat)));
    EDGES_OUTER.forEach(() => edgePairs.push(makeEdgePair(tessOuterCoreMat, tessOuterGlowMat)));
    EDGES_CONNECTOR.forEach(() => edgePairs.push(makeEdgePair(tessConnectorCoreMat, tessConnectorGlowMat)));

    // Glass sphere at center
    const sphereGeo = new THREE.IcosahedronGeometry(HOLO_RADIUS * 0.22, 12);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0,
      transmission: 0.95,
      thickness: 1.5,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 0.5,
    });
    const sphere = new THREE.Mesh(sphereGeo, glassMat);
    tessGroupRef.current.add(sphere);
    allObjects.push(sphere);

    tessEdgesRef.current = { edgePairs, sphere, glassMat, TUBE_THICKNESS, GLOW_THICKNESS };

    return () => {
      allObjects.forEach(obj => {
        tessGroupRef.current?.remove(obj);
        if (obj.geometry && obj.geometry !== cylGeo) obj.geometry.dispose();
      });
      sphereGeo.dispose();
      glassMat.dispose();
    };
  }, [cylGeo, tessInnerCoreMat, tessOuterCoreMat, tessConnectorCoreMat,
      tessInnerGlowMat, tessOuterGlowMat, tessConnectorGlowMat]);

  /* ── Build Penrose triangle portal ── */
  useEffect(() => {
    if (!torusGroupRef.current) return;
    const allObjects = [];
    const disposables = [];

    // ── Penrose triangle geometry from SVG paths ──
    // SVG viewBox 502×480, centered ~(251, 224). Scale to fit HOLO_RADIUS.
    const S = HOLO_RADIUS * 0.85; // overall scale
    const svgCx = 251, svgCy = 240, svgScale = S / 220;
    const sv = (x, y) => [(x - svgCx) * svgScale, -(y - svgCy) * svgScale]; // SVG→3D (flip Y)
    const depth = S * 0.12; // extrusion depth

    // Three colored arms of the Penrose triangle (from SVG grad-1, grad-2, grad-3)
    // Each arm is defined by its 2D polygon vertices
    const arms = [
      { // Left arm (cyan → blue)
        pts: [[364.9,338.95],[385,373.95],[40,373.95],[232,40],[270,40],[271,41.75],[100.15,338.95],[137.15,338.95]],
        color1: [0.247, 0.965, 0.941], // #3ff6f0
        color2: [0.224, 0.725, 0.965], // #39b9f6
      },
      { // Bottom arm (dark purple)
        pts: [[364.9,338.95],[251,140.9],[269.5,108.75],[445,408.95],[57,408.95],[40,373.95],[385,373.95]],
        color1: [0.329, 0.220, 0.392], // #543864
        color2: [0.184, 0.122, 0.220], // #2f1f38
      },
      { // Right arm (pink → magenta)
        pts: [[137.15,338.95],[100.15,338.95],[271,41.75],[462,373.95],[445,408.95],[269.5,108.75],[251,140.9]],
        color1: [0.957, 0.314, 0.667], // #f450aa
        color2: [0.639, 0.184, 0.502], // #a32f80
      },
    ];

    const penroseGroup = new THREE.Group();

    arms.forEach(({ pts, color1, color2 }) => {
      const shape = new THREE.Shape();
      const converted = pts.map(([x, y]) => sv(x, y));
      shape.moveTo(converted[0][0], converted[0][1]);
      for (let i = 1; i < converted.length; i++) {
        shape.lineTo(converted[i][0], converted[i][1]);
      }
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: depth,
        bevelEnabled: true,
        bevelThickness: depth * 0.15,
        bevelSize: depth * 0.1,
        bevelSegments: 2,
      });

      // Per-vertex colors: gradient from color1 to color2 based on Y position
      const posAttr = geo.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const rangeY = maxY - minY || 1;
      for (let i = 0; i < posAttr.count; i++) {
        const t = (posAttr.getY(i) - minY) / rangeY;
        colors[i * 3]     = color1[0] + (color2[0] - color1[0]) * t;
        colors[i * 3 + 1] = color1[1] + (color2[1] - color1[1]) * t;
        colors[i * 3 + 2] = color1[2] + (color2[2] - color1[2]) * t;
      }
      geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

      const mesh = new THREE.Mesh(geo, penroseMaterial);
      // Center the extrusion in Z
      mesh.position.z = -depth / 2;
      penroseGroup.add(mesh);
      allObjects.push(mesh);
      disposables.push(geo);
    });

    // Overlay detail paths (the 3D illusion overlapping pieces)
    const overlays = [
      { // Bottom bar overlay (dark purple)
        pts: [[40,373.95],[251,373.95],[251,408.95],[57,408.95]],
        color1: [0.329, 0.220, 0.392], color2: [0.184, 0.122, 0.220],
      },
      { // Left bar overlay (cyan)
        pts: [[40,373.95],[60.15,338.95],[251,338.95],[251,373.95]],
        color1: [0.247, 0.965, 0.941], color2: [0.224, 0.725, 0.965],
      },
      { // Right upper overlay (pink)
        pts: [[163.1,229.45],[270,43.55],[269.5,108.75],[190.9,245.45]],
        color1: [0.957, 0.314, 0.667], color2: [0.639, 0.184, 0.502],
      },
      { // Left upper overlay (cyan)
        pts: [[163.1,229.45],[133.05,212.1],[232,40],[270,40],[271,41.75],[270,43.55]],
        color1: [0.247, 0.965, 0.941], color2: [0.224, 0.725, 0.965],
      },
      { // Right lower overlay (pink)
        pts: [[342.5,235.15],[370.25,214.35],[462,373.95],[445,408.95]],
        color1: [0.957, 0.314, 0.667], color2: [0.639, 0.184, 0.502],
      },
      { // Right lower inner (dark purple)
        pts: [[343.1,234.65],[316.35,254.55],[385,373.95],[445,408.95]],
        color1: [0.329, 0.220, 0.392], color2: [0.184, 0.122, 0.220],
      },
    ];

    overlays.forEach(({ pts, color1, color2 }) => {
      const shape = new THREE.Shape();
      const converted = pts.map(([x, y]) => sv(x, y));
      shape.moveTo(converted[0][0], converted[0][1]);
      for (let i = 1; i < converted.length; i++) shape.lineTo(converted[i][0], converted[i][1]);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: depth * 0.3,
        bevelEnabled: false,
      });
      const posAttr = geo.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const rangeY = maxY - minY || 1;
      for (let i = 0; i < posAttr.count; i++) {
        const t = (posAttr.getY(i) - minY) / rangeY;
        colors[i * 3]     = color1[0] + (color2[0] - color1[0]) * t;
        colors[i * 3 + 1] = color1[1] + (color2[1] - color1[1]) * t;
        colors[i * 3 + 2] = color1[2] + (color2[2] - color1[2]) * t;
      }
      geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(geo, penroseMaterial);
      mesh.position.z = depth * 0.2; // sit slightly in front
      penroseGroup.add(mesh);
      allObjects.push(mesh);
      disposables.push(geo);
    });

    torusGroupRef.current.add(penroseGroup);
    allObjects.push(penroseGroup);

    // ── Spinning orbital ring (SVG circle-spinner) ──
    const ringRadius = S * 0.65;
    const ringTube = S * 0.02;
    const ringGeo = new THREE.TorusGeometry(ringRadius, ringTube, 16, 64);
    const ringMesh = new THREE.Mesh(ringGeo, penroseRingMaterial);
    torusGroupRef.current.add(ringMesh);
    allObjects.push(ringMesh);
    disposables.push(ringGeo);

    // ── Vortex particles ──
    const vortexGeo = new THREE.BufferGeometry();
    const vortexPos = new Float32Array(VORTEX_COUNT * 3);
    const vortexColors = new Float32Array(VORTEX_COUNT * 3);
    const vortexSizes = new Float32Array(VORTEX_COUNT);
    const _c = new THREE.Color();
    // Colors biased to the Penrose palette: cyan, pink, purple
    const penroseHues = [0.5, 0.52, 0.55, 0.83, 0.85, 0.88, 0.75, 0.78];
    for (let i = 0; i < VORTEX_COUNT; i++) {
      const hue = penroseHues[Math.floor(Math.random() * penroseHues.length)] + (Math.random() - 0.5) * 0.05;
      _c.setHSL(hue, 0.7, 0.6);
      vortexColors[i * 3] = _c.r;
      vortexColors[i * 3 + 1] = _c.g;
      vortexColors[i * 3 + 2] = _c.b;
      vortexSizes[i] = 0.12 + Math.random() * 0.08;
    }
    vortexGeo.setAttribute("position", new THREE.BufferAttribute(vortexPos, 3));
    vortexGeo.setAttribute("customColor", new THREE.BufferAttribute(vortexColors, 3));
    vortexGeo.setAttribute("aSize", new THREE.BufferAttribute(vortexSizes, 1));
    const vortexPoints = new THREE.Points(vortexGeo, torusVortexMaterial);
    torusGroupRef.current.add(vortexPoints);
    allObjects.push(vortexPoints);
    disposables.push(vortexGeo);

    const vortexState = Array(VORTEX_COUNT).fill(null).map(() => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.06 + Math.random() * 0.04,
      distance: 0,
      maxDistance: S * (1.2 + Math.random() * 0.6),
      twist: 0.4 + Math.random() * 0.3,
    }));

    torusDataRef.current = { penroseGroup, ringMesh, vortexPoints, vortexState };
    torusGroupRef.current.visible = false;

    return () => {
      allObjects.forEach(obj => torusGroupRef.current?.remove(obj));
      disposables.forEach(d => d.dispose());
      penroseRingMaterial.dispose && 0; // shared material, don't dispose
    };
  }, [penroseMaterial, penroseRingMaterial, torusVortexMaterial]);

  /* ── Build Singularity bounding sphere ── */
  useEffect(() => {
    if (!singularityGroupRef.current) return;
    const radius = HOLO_RADIUS * 1.55;
    const sphereGeo = new THREE.SphereGeometry(radius, 48, 48);
    const sphereMesh = new THREE.Mesh(sphereGeo, singularityMaterial);
    singularityGroupRef.current.add(sphereMesh);
    singularityGroupRef.current.visible = false;
    singularityDataRef.current = { sphereMesh, radius };

    return () => {
      singularityGroupRef.current?.remove(sphereMesh);
      sphereGeo.dispose();
    };
  }, [singularityMaterial]);

  /* ── Build animated geometry GLB ── */
  useEffect(() => {
    if (!geometryScene || !geometryGroupRef.current) return;
    const clone = geometryScene.clone(true);
    clone.updateMatrixWorld(true);

    // Auto-fit to HOLO_RADIUS
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = (HOLO_RADIUS * 0.6) / maxDim;
    clone.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);
    clone.scale.setScalar(fitScale);

    // Clone materials so we can drive opacity per-instance without mutating the cached GLB.
    // Recolor with the tesseract palette + boost emissive so each mesh glows like a hologram.
    const tessPalette = [
      new THREE.Color(0x4dffa0), // inner mint green
      new THREE.Color(0x4db8ff), // outer cyan blue
      new THREE.Color(0x9090ff), // connector light purple
    ];
    // Collect mesh nodes first (don't mutate during traversal)
    const meshList = [];
    clone.traverse((child) => {
      if (child.isMesh && child.material) meshList.push(child);
    });

    const clonedMats = [];
    const shellMats = [];
    let matIdx = 0;
    meshList.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const newMats = mats.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.depthWrite = false;
        // Cycle palette colors per material for visual variety
        const palette = tessPalette[matIdx % tessPalette.length];
        // Pure black base — emissive carries 100% of the visible color (matches tesseract core mats)
        if (c.color) c.color.setHex(0x000000);
        if (c.emissive) {
          c.emissive.copy(palette);
          c.emissiveIntensity = 4.0;
        }
        if ('metalness' in c) c.metalness = 0.0;
        if ('roughness' in c) c.roughness = 1.0; // fully matte — no spec highlights to wash out the neon
        clonedMats.push(c);
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];

      // Additive-blended shell — same geometry, vertex-displaced outward, fresnel aura
      const palette = tessPalette[matIdx % tessPalette.length];
      const shellMat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: palette.clone() },
          uOpacity: { value: 1.0 },
          uPush: { value: 0.04 }, // outward displacement along normals (in mesh local units)
        },
        vertexShader: glbShellVert,
        fragmentShader: glbShellFrag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      const shell = new THREE.Mesh(mesh.geometry, shellMat);
      shell.frustumCulled = false; // animations may move it outside its initial bbox
      mesh.add(shell); // child of the animated mesh — inherits all transforms
      shellMats.push(shellMat);

      matIdx++;
    });

    geometryGroupRef.current.add(clone);
    geometryGroupRef.current.visible = false;

    // Animation mixer — bind to the cloned scene and play all clips
    const mixer = new THREE.AnimationMixer(clone);
    const actions = (geometryAnimations || []).map((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      return action;
    });

    geometryDataRef.current = { clone, mixer, actions, clonedMats, shellMats };

    return () => {
      actions.forEach((a) => a.stop());
      mixer.stopAllAction();
      mixer.uncacheRoot(clone);
      shellMats.forEach((m) => m.dispose());
      geometryGroupRef.current?.remove(clone);
      clonedMats.forEach((m) => m.dispose());
    };
  }, [geometryScene, geometryAnimations]);

  /* ── Build Our Lady mesh ── */
  useEffect(() => {
    if (!maryScene || !ladyGroupRef.current) return;
    const ladyClone = maryScene.clone(true);
    ladyClone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ladyClone);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const ladyScale = (HOLO_RADIUS * 1.8) / (maxDim || 1);
    ladyClone.position.set(-center.x * ladyScale, -box.min.y * ladyScale, -center.z * ladyScale);
    ladyClone.scale.setScalar(ladyScale);

    ladyClone.traverse((child) => {
      if (child.isMesh) {
        const mat = holoStatueMaterial.clone();
        mat.uniforms.uTime = holoStatueMaterial.uniforms.uTime;
        mat.uniforms.uFade = holoStatueMaterial.uniforms.uFade;
        child.material = mat;
      }
    });

    ladyGroupRef.current.add(ladyClone);
    ladyGroupRef.current.visible = false;

    return () => {
      ladyGroupRef.current?.remove(ladyClone);
      ladyClone.traverse((child) => {
        if (child.isMesh) { child.geometry?.dispose(); child.material?.dispose(); }
      });
    };
  }, [maryScene, holoStatueMaterial]);

  /* ── Animation loop ── */
  const _singularityTmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    if (!enabled) return;

    beamMaterial.uniforms.uTime.value += delta;
    const time = beamMaterial.uniforms.uTime.value;
    tessTimeUniform.value = time;
    holoStatueMaterial.uniforms.uTime.value -= delta;

    timerRef.current += delta;
    const currentPhase = phaseRef.current;

    /* ── Update tesseract 4D rotation and projection ── */
    if (tessEdgesRef.current) {
      const angles = tessAngleRef.current;
      angles.xw += delta * 0.5;
      angles.zw += delta * 0.2;

      const tessSize = HOLO_RADIUS * 0.8;
      const projected = VERTICES_4D.map(v => project4(rotZW(rotXW(v, angles.xw), angles.zw), tessSize));

      const { edgePairs, sphere, TUBE_THICKNESS, GLOW_THICKNESS } = tessEdgesRef.current;
      const _dir = new THREE.Vector3();
      const _zAxis = new THREE.Vector3(0, 0, 1);
      const _quat = new THREE.Quaternion();

      // Update each tube pair — local-space rotation (lookAt breaks under parent transforms)
      let edgeIdx = 0;
      const updateEdges = (edgeList) => {
        edgeList.forEach(([a, b]) => {
          const p1 = projected[a];
          const p2 = projected[b];
          _dir.subVectors(p2, p1);
          const dist = _dir.length();
          _dir.normalize();
          _quat.setFromUnitVectors(_zAxis, _dir);

          const { core, glow } = edgePairs[edgeIdx];

          core.position.copy(p1);
          core.quaternion.copy(_quat);
          core.scale.set(TUBE_THICKNESS, TUBE_THICKNESS, dist);

          glow.position.copy(p1);
          glow.quaternion.copy(_quat);
          glow.scale.set(GLOW_THICKNESS, GLOW_THICKNESS, dist);

          edgeIdx++;
        });
      };
      updateEdges(EDGES_INNER);
      updateEdges(EDGES_OUTER);
      updateEdges(EDGES_CONNECTOR);

      // Animate glass sphere
      if (sphere) {
        sphere.rotation.y = time * 0.18;
        sphere.rotation.z = time * 0.09;
        sphere.scale.setScalar(1 + Math.sin(time * 1.8) * 0.04);
      }

    }

    /* ── Update Penrose triangle portal ── */
    if (torusDataRef.current) {
      const { penroseGroup, ringMesh, vortexPoints, vortexState } = torusDataRef.current;

      // Update shader times
      penroseMaterial.uniforms.uTime.value = time;
      penroseRingMaterial.uniforms.uTime.value = time;
      torusVortexMaterial.uniforms.uTime.value = time;

      // Slow Y rotation for the Penrose triangle
      penroseGroup.rotation.y += delta * 0.25;

      // Spinning orbital ring — fast continuous rotation (like SVG circle-spinner)
      ringMesh.rotation.z += delta * (Math.PI * 2 / 1.5); // 1.5s per revolution, matching SVG
      // Slight wobble on x for depth
      ringMesh.rotation.x = Math.sin(time * 0.5) * 0.15;

      // Pulsing glow on penrose (SVG penrose-bg opacity animation)
      const bgPulse = 0.25 + 0.75 * (Math.sin(time * (Math.PI / 3.5)) * 0.5 + 0.5);
      penroseGroup.children.forEach(child => {
        if (child.material === penroseMaterial) {
          // modulate emissive brightness
        }
      });

      // Vortex spiral
      const posArr = vortexPoints.geometry.attributes.position.array;
      for (let i = 0; i < VORTEX_COUNT; i++) {
        const d = vortexState[i];
        d.distance += d.speed * delta;
        const angle = d.angle + time * d.twist;
        posArr[i * 3] = Math.cos(angle) * d.distance * (1.0 + d.twist);
        posArr[i * 3 + 1] = Math.sin(angle) * d.distance * 0.6;
        posArr[i * 3 + 2] = Math.sin(angle + d.twist) * d.distance;
        if (d.distance > d.maxDistance) d.distance = 0;
      }
      vortexPoints.geometry.attributes.position.needsUpdate = true;
    }

    /* ── Update animated geometry GLB ── */
    if (geometryDataRef.current?.mixer) {
      geometryDataRef.current.mixer.update(delta);
    }

    /* ── Update Singularity ── */
    if (singularityDataRef.current) {
      const { sphereMesh } = singularityDataRef.current;
      singularityMaterial.uniforms.uTime.value = time;
      // World camera → bounding sphere local space
      _singularityTmp.copy(state.camera.position);
      sphereMesh.worldToLocal(_singularityTmp);
      singularityMaterial.uniforms.uLocalCamera.value.copy(_singularityTmp);
    }

    /* ── Fade logic ── */
    const lerpFade = (ref, mat, key, speed = 3) => {
      const f = ref.current;
      if (Math.abs(f.current - f.target) > 0.001) {
        f.current += (f.target - f.current) * Math.min(1, delta * speed);
        mat.uniforms[key].value = f.current;
      }
    };

    // Tesseract fade — update shared uniform + core material opacities
    {
      const tf = tessFadeRef.current;
      if (Math.abs(tf.current - tf.target) > 0.001) {
        tf.current += (tf.target - tf.current) * Math.min(1, delta * 3);
        tessFadeUniform.value = tf.current;
        tessInnerCoreMat.opacity = tf.current;
        tessOuterCoreMat.opacity = tf.current;
        tessConnectorCoreMat.opacity = tf.current;
        if (tessEdgesRef.current?.glassMat) {
          tessEdgesRef.current.glassMat.opacity = tf.current;
        }
      }
    }
    // Torus fade
    {
      const tf = torusFadeRef.current;
      if (Math.abs(tf.current - tf.target) > 0.001) {
        tf.current += (tf.target - tf.current) * Math.min(1, delta * 3);
        torusFadeUniform.value = tf.current;
      }
    }
    // Singularity fade
    {
      const sf = singularityFadeRef.current;
      if (Math.abs(sf.current - sf.target) > 0.001) {
        sf.current += (sf.target - sf.current) * Math.min(1, delta * 3);
        singularityFadeUniform.value = sf.current;
      }
    }
    // Neural network fade — drive group scale (no shader uFade in NeuralNetworkR3F)
    {
      const nf = neuralFadeRef.current;
      if (Math.abs(nf.current - nf.target) > 0.001) {
        nf.current += (nf.target - nf.current) * Math.min(1, delta * 3);
      }
    }
    // Geometry GLB fade — drive cloned material opacities + shell uniforms
    {
      const gf = geometryFadeRef.current;
      if (Math.abs(gf.current - gf.target) > 0.001) {
        gf.current += (gf.target - gf.current) * Math.min(1, delta * 3);
        if (geometryDataRef.current?.clonedMats) {
          geometryDataRef.current.clonedMats.forEach((m) => { m.opacity = gf.current; });
        }
        if (geometryDataRef.current?.shellMats) {
          geometryDataRef.current.shellMats.forEach((m) => { m.uniforms.uOpacity.value = gf.current; });
        }
      }
    }
    lerpFade(ladyFadeRef, holoStatueMaterial, "uFade");

    // Visibility
    if (tessGroupRef.current) tessGroupRef.current.visible = tessFadeRef.current.current > 0.01;
    if (torusGroupRef.current) torusGroupRef.current.visible = torusFadeRef.current.current > 0.01;
    if (singularityGroupRef.current) singularityGroupRef.current.visible = singularityFadeRef.current.current > 0.01;
    if (neuralGroupRef.current) {
      const nf = neuralFadeRef.current.current;
      neuralGroupRef.current.visible = nf > 0.01;
      // Eased scale-in/out — soft cubic for less popping
      const eased = nf * nf * (3 - 2 * nf);
      neuralGroupRef.current.scale.setScalar(eased);
    }
    if (geometryGroupRef.current) {
      const gf = geometryFadeRef.current.current;
      geometryGroupRef.current.visible = gf > 0.01;
      if (gf > 0.01) geometryGroupRef.current.rotation.y += delta * 0.2;
    }
    if (ladyGroupRef.current) {
      ladyGroupRef.current.visible = ladyFadeRef.current.current > 0.01;
      if (ladyGroupRef.current.visible) ladyGroupRef.current.rotation.y += delta * 0.15;
    }

    /* ── Phase transitions ── */
    if (!transitioning.current) {
      if (timerRef.current >= HOLD_TIME) {
        transitioning.current = true;
        timerRef.current = 0;
        const nextPhase = (currentPhase + 1) % TOTAL_PHASES;

        // Fade out current
        if (currentPhase === TESSERACT_PHASE) tessFadeRef.current.target = 0;
        else if (currentPhase === PENROSE_PHASE) torusFadeRef.current.target = 0;
        else if (currentPhase === SINGULARITY_PHASE) singularityFadeRef.current.target = 0;
        else if (currentPhase === NEURAL_PHASE) neuralFadeRef.current.target = 0;
        else if (currentPhase === GEOMETRY_PHASE) geometryFadeRef.current.target = 0;
        else if (currentPhase === LADY_PHASE) ladyFadeRef.current.target = 0;

        // Fade in next
        if (nextPhase === TESSERACT_PHASE) tessFadeRef.current.target = 1;
        else if (nextPhase === PENROSE_PHASE) torusFadeRef.current.target = 1;
        else if (nextPhase === SINGULARITY_PHASE) singularityFadeRef.current.target = 1;
        else if (nextPhase === NEURAL_PHASE) neuralFadeRef.current.target = 1;
        else if (nextPhase === GEOMETRY_PHASE) geometryFadeRef.current.target = 1;
        else if (nextPhase === LADY_PHASE) ladyFadeRef.current.target = 1;
      }
    } else {
      if (timerRef.current >= TRANSITION_TIME) {
        transitioning.current = false;
        timerRef.current = 0;
        phaseRef.current = (currentPhase + 1) % TOTAL_PHASES;
      }
    }
  });

  /* ── Tuning knobs ── */
  const CONE_Y = HOLO_HEIGHT * -0.4;
  const CONE_SCALE = 0.45;
  const SHAPES_Y = HOLO_HEIGHT * 0.3;
  const LADY_Y = -HOLO_HEIGHT * 0.5;

  return (
    <group ref={groupRef}>
      {/* Hologram beam cone */}
      <mesh
        position={[0, CONE_Y, 0]}
        rotation={[Math.PI, 0, 0]}
        scale={[CONE_SCALE, CONE_SCALE, CONE_SCALE]}
      >
        <coneGeometry args={[HOLO_RADIUS * 0.9, HOLO_HEIGHT * 1.2, 32, 1, true]} />
        <primitive object={beamMaterial} attach="material" />
      </mesh>

      {/* Base glow disc */}
      {/* <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HOLO_RADIUS * 0.7, 32]} />
        <meshBasicMaterial
          color={0x4dffa0}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh> */}

      {/* Shapes group — raised independently from cone */}
      {/* <group position={[0, SHAPES_Y, 0]}> */}
        {/* Tesseract wireframe */}
        {/* <group ref={tessGroupRef} /> */}

        {/* Penrose portal */}
        {/* <group ref={torusGroupRef} /> */}

        {/* Singularity (black hole + accretion disk) */}
        {/* <group ref={singularityGroupRef} /> */}

        {/* Neural network crystalline sphere */}
        {/* <group ref={neuralGroupRef}>
          <NeuralNetworkR3F
            theme={2}
            formation={0}
            density={40}
            scale={0.02}
            enableInteraction={false}
            nodeSize={0.03}
            opacity={0.45}
            autoFire={true}
            autoFireMinInterval={1.8}
            autoFireMaxInterval={3.5}
          />
        </group> */}

        {/* Animated geometry GLB */}
        {/* <group ref={geometryGroupRef} /> */}

        {/* Our Lady holographic statue */}
        {/* <group ref={ladyGroupRef} position={[0, LADY_Y, 0]} /> */}
      {/* </group> */}
    </group>
  );
}

useGLTF.preload("/models/CyberpunkMaryHeartRed2.glb");
useGLTF.preload("/models/geometry1.glb");
