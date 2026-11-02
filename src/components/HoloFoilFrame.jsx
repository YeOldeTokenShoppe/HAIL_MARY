"use client";

// A live holographic foil frame, computed rather than printed.
//
// The border is a field of diffraction gratings — a cracked-ice mosaic of
// cells, each with its own groove direction and period, plus a mirror strip
// hugging every window. Every colour is evaluated per wavelength from the
// grating equation against a fixed set of room lights, so the rainbow is
// *where the lights land*, and it moves with the card's tilt the way a real
// foil does, instead of a gradient sliding under a mask.
//
// It replaces the frame <img> at the same z (12) and is cut out over the same
// three slots the printed frames leave open (art window, meta line, bottom
// box), so the card's content layout does not change under it.
//
// ONE shared WebGL renderer draws every instance into its own 2D canvas
// (drawImage from the GL canvas). Browsers cap live WebGL contexts at ~16 per
// page, and a collection grid holds more cards than that; a 2D canvas per
// card has no such cap, and the copy is GPU-side in Chrome/Safari.
//
// Extracted from "A Hologram of Somewhere Else" (holo-foil-frame.html); the
// portal, planet and whale are gone, the foil is verbatim.

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

// ---------- defaults (overridable per frame via data.frameHolo) ----------
// Geometry is in card units: height 1, origin at the centre, y up. The card
// box is 744 x 1038 CSS px, so width = 0.7168 and a 32px radius = 0.0308.
export const HOLO_DEFAULTS = {
  // Windows as fractions of the card box, DOM convention (y down from top).
  // Measured off frame_rainbow.webp's alpha so the slots match the set.
  windows: [
    { x0: 0.046, y0: 0.030, x1: 0.954, y1: 0.853, r: 0.012 }, // art + content
    { x0: 0.060, y0: 0.861, x1: 0.940, y1: 0.891, r: 0.006 }, // meta line slot
    { x0: 0.060, y0: 0.899, x1: 0.940, y1: 0.970, r: 0.006 }, // bottom box
  ],
  cornerRadius: 32 / 1038,
  outerBand: false,     // rainbow contour band + dark groove at the card edge
  edge: 0.028,          // contour band width (only when outerBand)
  groove: 0.033,        // where the groove ends (only when outerBand)
  chrome: 0.006,        // mirror strip around each window
  cell: 0.0165,         // mosaic cell size
  // The CSS tilt is ±7–9°, too shallow to sweep a grating through its
  // colours. The lighting sees the tilt multiplied by this instead.
  // 2.5 keeps the far-left extreme (key light reflected away) from going dark.
  tiltGain: 2.5,
  exposure: 1.0,
  // Reflectance of the metal under the gratings, linear RGB. Silver foil is
  // [1,1,1]; gold absorbs blue, so everything the foil returns — mirror,
  // diffraction orders, room reflection — comes back warm.
  tint: [1, 1, 1],
  // How much of the light comes back as rainbow (the diffraction orders)
  // versus plain mirror reflection. Silver holo is all rainbow; gold leaf
  // with a light holographic emboss is mostly mirror.
  spectral: 1.0,
  mirror: 1.0,
  // Mirror-lobe width multiplier. 1 is a polished foil (tight, cell-by-cell
  // sparkle); brushed leaf wants ~6 so the highlight spreads over the whole band.
  roughness: 1.0,
  // Even metal floor, linear, before tone mapping — what the leaf shows where
  // no light lands. 0 for holo (the dark cells are the sparkle).
  base: 0.0,
  // Pixel budget for the biggest instance. The foil loop is lights x
  // wavelengths per border pixel; windows are discarded early.
  maxPixels: 1.6e6,
};

const FOIL = {
  contour: { d: 1.30, eta1: 1.8, eta2: 0.6, sPar: 0.022, sPerp: 0.55 },
  mosaic:  { dMin: 0.85, dMax: 1.60, eta1: 3.2, eta2: 1.0, sPar: 0.02, sPerp: 0.15 },
  mirror: 0.55,
};

// Lights in the room. size: angular radius (radians). col: tint.
const LIGHTS = [
  { pos: [-2.0, 2.3, 2.8], I: 1.15, size: 0.025, col: [1.00, 0.96, 0.90] }, // key, above left
  { pos: [2.6, 0.2, 2.2],  I: 0.32, size: 0.14,  col: [0.82, 0.90, 1.00] }, // fill, right
  { pos: [0.2, 3.2, 1.1],  I: 0.16, size: 0.18,  col: [0.95, 0.95, 1.00] }, // soft top
  { pos: [0.8, 2.2, -2.6], I: 0.85, size: 0.10,  col: [0.70, 0.84, 1.00] }, // rim, behind
];
const CAM_DIST = 2.85;
const MAX_WINDOWS = 4;

// ---------- CIE 1931 2° colour matching (Wyman, Sloan, Shirley 2013) ----------
function cieLobe(l, mu, s1, s2) { const s = l < mu ? s1 : s2, t = (l - mu) / s; return Math.exp(-0.5 * t * t); }
function cieXYZ(l) {
  return [
    1.056 * cieLobe(l, 599.8, 37.9, 31.0) + 0.362 * cieLobe(l, 442.0, 16.0, 26.7) - 0.065 * cieLobe(l, 501.1, 20.4, 26.2),
    0.821 * cieLobe(l, 568.8, 46.9, 40.5) + 0.286 * cieLobe(l, 530.9, 16.3, 31.1),
    1.217 * cieLobe(l, 437.0, 11.8, 36.0) + 0.681 * cieLobe(l, 459.0, 26.0, 13.8),
  ];
}
const xyzToLinear = ([X, Y, Z]) => [
  3.2406 * X - 1.5372 * Y - 0.4986 * Z,
  -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
  0.0557 * X - 0.2040 * Y + 1.0570 * Z,
];
function spectralBasis(n) {
  const lam = [], rgb = [], sum = [0, 0, 0];
  for (let j = 0; j < n; j++) {
    const l = 400 + ((j + 0.5) * 300) / n, c = xyzToLinear(cieXYZ(l));
    lam.push(l); rgb.push(c);
    for (let k = 0; k < 3; k++) sum[k] += c[k];
  }
  for (const c of rgb) for (let k = 0; k < 3; k++) c[k] /= sum[k];
  return { lam, rgb };
}

// ---------- GLSL ----------
const glf = (x) => (+x).toFixed(6);

const VS = /* glsl */ `
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentSource = (ns) => /* glsl */ `
precision highp float;
precision highp int;
#define PI 3.14159265
#define NS ${ns}
#define N_LIGHTS ${LIGHTS.length}
#define MAX_WIN ${MAX_WINDOWS}
#define C_D ${glf(FOIL.contour.d)}
#define C_E1 ${glf(FOIL.contour.eta1)}
#define C_E2 ${glf(FOIL.contour.eta2)}
#define C_SP ${glf(FOIL.contour.sPar)}
#define C_SQ ${glf(FOIL.contour.sPerp)}
#define M_DMIN ${glf(FOIL.mosaic.dMin)}
#define M_DMAX ${glf(FOIL.mosaic.dMax)}
#define M_E1 ${glf(FOIL.mosaic.eta1)}
#define M_E2 ${glf(FOIL.mosaic.eta2)}
#define M_SP ${glf(FOIL.mosaic.sPar)}
#define M_SQ ${glf(FOIL.mosaic.sPerp)}
#define MIRROR ${glf(FOIL.mirror)}

uniform vec2 uRes;            // viewport in pixels
uniform vec2 uCardHalf;       // half width, half height in card units (height = 1)
uniform float uCardR;         // corner radius
uniform vec2 uTilt;           // yaw, pitch (radians) the lighting sees
uniform vec4 uWinBox[MAX_WIN];// centre xy, half xy
uniform float uWinR[MAX_WIN];
uniform int uWinN;
uniform vec4 uBands;          // edge, groove, chrome, cell
uniform float uExposure;
uniform vec3 uTint;
uniform vec4 uFoilMix;   // spectral, mirror, roughness, base
uniform float uLam[NS];
uniform vec3 uSpec[NS];
uniform vec3 uLPos[N_LIGHTS];
uniform vec3 uLCol[N_LIGHTS];
uniform vec2 uLPar[N_LIGHTS];
out vec4 fragColor;

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
vec3 nrm(vec3 v) { float l = dot(v, v); return l > 1e-24 ? v * inversesqrt(l) : vec3(0.0, 0.0, 1.0); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
uint hashU(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float h01u(uint x) { return float(hashU(x) >> 8u) / 16777216.0; }
uint cellIdU(ivec2 c) { return (uint(c.x) * 73856093u) ^ (uint(c.y) * 19349663u) ^ 0x9e3779b9u; }
float vnoise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sdRoundRect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r; }
vec2 gradRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  vec2 g = (q.x > 0.0 && q.y > 0.0) ? q / max(length(q), 1e-6) : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return g * vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
}

// Reflection from a grating with period d (micrometres) and grating vector g
// in the surface: (L + V) . g = m lambda / d across the grooves, (L + V) . t = 0
// along them, each with a Gaussian tolerance (foil roughness + light size).
vec3 diffract(vec3 P, vec3 N, vec3 V, vec3 g, float d, float eta1, float eta2, float sPar, float sPerp) {
  vec3 t = cross(N, g);
  vec3 sum = vec3(0.0);
  float inv = 1.0 / d;
  for (int k = 0; k < N_LIGHTS; k++) {
    vec3 L = nrm(uLPos[k] - P);
    float nl = dot(N, L);
    if (nl <= 0.0) continue;
    vec3 H = L + V;
    float u = abs(dot(H, g)), w = dot(H, t);
    float sz = uLPar[k].y;
    float sp2 = sPar * sPar + sz * sz, sq2 = sPerp * sPerp + sz * sz;
    float perp = exp(-0.5 * w * w / sq2) * uLPar[k].x * nl;
    if (perp < 1e-4) continue;
    vec3 acc = vec3(0.0);
    for (int j = 0; j < NS; j++) {
      float l = uLam[j] * 0.001;
      float a1 = u - l * inv, a2 = u - 2.0 * l * inv;
      acc += uSpec[j] * (eta1 * exp(-0.5 * a1 * a1 / sp2) + eta2 * exp(-0.5 * a2 * a2 / sp2));
    }
    sum += acc * perp * uLCol[k];
  }
  return sum;
}
vec3 mirrorLobe(vec3 P, vec3 N, vec3 V, float rough) {
  vec3 sum = vec3(0.0);
  for (int k = 0; k < N_LIGHTS; k++) {
    vec3 L = nrm(uLPos[k] - P);
    float nl = dot(N, L);
    if (nl <= 0.0) continue;
    vec3 H = L + V;
    vec3 Ht = H - N * dot(H, N);
    float sz = uLPar[k].y, s2 = rough * rough + sz * sz;
    sum += uLCol[k] * (uLPar[k].x * nl * exp(-0.5 * dot(Ht, Ht) / s2));
  }
  return sum;
}
vec3 envMetal(vec3 N, vec3 V) {
  vec3 R = reflect(-V, N);
  float sky = sat(0.5 + 0.5 * R.y);
  vec3 c = mix(vec3(0.004, 0.005, 0.009), vec3(0.022, 0.024, 0.032), sky * sky);
  float panel = exp(-7.0 * (1.0 - max(dot(R, nrm(vec3(-0.5, 0.62, 0.6))), 0.0)));
  return c + vec3(0.045, 0.043, 0.041) * panel;
}
vec3 gamutFix(vec3 c) {
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float m = min(c.r, min(c.g, c.b));
  if (m >= 0.0) return c;
  if (L <= 1e-6) return vec3(0.0);
  return max(c + (-m / (L - m)) * (vec3(L) - c), vec3(0.0));
}
vec3 aces(vec3 x) { return sat3((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uCardHalf.x * 2.0, 1.0);
  float px = fwidth(p.y);

  // the card as the lighting sees it: tilted by the (amplified) CSS tilt
  float cy = cos(uTilt.x), sy = sin(uTilt.x), cx = cos(uTilt.y), sx = sin(uTilt.y);
  mat3 Rx = mat3(1.0, 0.0, 0.0,  0.0, cx, sx,  0.0, -sx, cx);
  mat3 Ry = mat3(cy, 0.0, -sy,  0.0, 1.0, 0.0,  sy, 0.0, cy);
  mat3 R = Ry * Rx;
  vec3 T = R[0], B = R[1], N0 = R[2];
  vec3 P = R * vec3(p, 0.0);
  vec3 V = nrm(vec3(0.0, 0.0, ${glf(CAM_DIST)}) - P);

  // outer silhouette and the nearest window
  float e = -sdRoundRect(p, uCardHalf, uCardR);
  float dWin = 1e9; vec2 gWin = vec2(0.0, 1.0);
  for (int i = 0; i < MAX_WIN; i++) {
    if (i >= uWinN) break;
    float d = sdRoundRect(p - uWinBox[i].xy, uWinBox[i].zw, uWinR[i]);
    if (d < dWin) { dWin = d; gWin = gradRoundRect(p - uWinBox[i].xy, uWinBox[i].zw, uWinR[i]); }
  }
  float alpha = smoothstep(-px, px, dWin) * smoothstep(-px, px, e);
  if (alpha <= 0.0) discard;

  float BAND_EDGE = uBands.x, BAND_GROOVE = uBands.y, BAND_CHROME = uBands.z, CELL = uBands.w;
  float aa = px;
  float wC = BAND_EDGE > 0.0 ? 1.0 - smoothstep(BAND_EDGE - aa, BAND_EDGE + aa, e) : 0.0;
  float wG = BAND_GROOVE > 0.0 ? smoothstep(BAND_EDGE - aa, BAND_EDGE + aa, e) * (1.0 - smoothstep(BAND_GROOVE - aa, BAND_GROOVE + aa, e)) : 0.0;
  float wR = 1.0 - smoothstep(BAND_CHROME - aa, BAND_CHROME + aa, dWin);
  float wM = max(1.0 - wC - wG - wR, 0.0);

  // slow waviness: the foil is not perfectly flat
  vec2 wav = vec2(vnoise2(p * 26.0), vnoise2(p * 26.0 + 17.3)) - 0.5;
  vec3 N = nrm(N0 + (T * wav.x + B * wav.y) * 0.022);
  vec3 c = vec3(0.0);

  if (wC > 0.0) {
    vec2 gl = gradRoundRect(p, uCardHalf, uCardR);
    float d = C_D * (1.0 + 0.035 * sin(e * 900.0));
    vec3 g = nrm(T * gl.x + B * gl.y);
    c += wC * (uFoilMix.x * diffract(P, N, V, g, d, C_E1, C_E2, C_SP, C_SQ) + uFoilMix.y * MIRROR * mirrorLobe(P, N, V, 0.05 * uFoilMix.z) + envMetal(N, V));
  }
  if (wM > 0.0) {
    // cracked ice: Voronoi cells, each its own grating (direction, period, facet tilt)
    vec2 q = p / CELL;
    ivec2 c0 = ivec2(floor(q));
    float f1 = 1e9, f2 = 1e9;
    ivec2 best = c0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 cc = c0 + ivec2(i, j);
      uint id = cellIdU(cc);
      vec2 fp = vec2(cc) + 0.1 + 0.8 * vec2(h01u(id), h01u(id ^ 0x68bc21ebu));
      float dd = length(q - fp);
      if (dd < f1) { f2 = f1; f1 = dd; best = cc; } else if (dd < f2) { f2 = dd; }
    }
    uint id = cellIdU(best);
    float ang = PI * h01u(id ^ 0x2545f491u);
    float d = M_DMIN + (M_DMAX - M_DMIN) * h01u(id ^ 0x1b873593u);
    vec2 tl = (vec2(h01u(id ^ 0x3c6ef372u), h01u(id ^ 0x5bd1e995u)) - 0.5) * 0.06;
    vec3 Nf = nrm(N0 + T * tl.x + B * tl.y);
    vec3 g = nrm(T * cos(ang) + B * sin(ang));
    float crackW = max(0.04, px / CELL);
    float crack = smoothstep(0.0, crackW, f2 - f1);
    vec3 m = uFoilMix.x * diffract(P, Nf, V, g, d, M_E1, M_E2, M_SP, M_SQ) + uFoilMix.y * MIRROR * mirrorLobe(P, Nf, V, 0.04 * uFoilMix.z) + 0.45 * envMetal(Nf, V);
    c += wM * (m + vec3(uFoilMix.w)) * (0.35 + 0.65 * crack);
  }
  if (wG > 0.0) c += wG * (vec3(0.004) + 0.15 * envMetal(N, V));
  if (wR > 0.0) {
    // rounded chrome lip around the window
    float x = sat(dWin / BAND_CHROME) * 2.0 - 1.0;
    vec3 Nr = nrm(N0 + (T * gWin.x + B * gWin.y) * x * 0.55);
    c += wR * (1.1 * mirrorLobe(P, Nr, V, 0.03) + 1.4 * envMetal(Nr, V));
  }

  c = aces(max(gamutFix(c) * uTint * uExposure, vec3(0.0)));
  c = pow(c, vec3(1.0 / 2.2));
  c += (hash12(gl_FragCoord.xy) - 0.5) * (2.0 / 255.0);
  fragColor = vec4(sat3(c) * alpha, alpha);   // premultiplied
}
`;

// ---------- the shared renderer ----------
let shared = null;
function getShared() {
  if (shared) return shared;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, premultipliedAlpha: true, antialias: false,
      powerPreference: "high-performance", preserveDrawingBuffer: false,
    });
  } catch (err) {
    shared = { failed: true };
    return shared;
  }
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const ns = mobile ? 12 : 20;
  const basis = spectralBasis(ns);
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uCardHalf: { value: new THREE.Vector2(0.3584, 0.5) },
    uCardR: { value: 0.0308 },
    uTilt: { value: new THREE.Vector2(0, 0) },
    uWinBox: { value: Array.from({ length: MAX_WINDOWS }, () => new THREE.Vector4()) },
    uWinR: { value: new Float32Array(MAX_WINDOWS) },
    uWinN: { value: 0 },
    uBands: { value: new THREE.Vector4() },
    uExposure: { value: 1 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uFoilMix: { value: new THREE.Vector4(1, 1, 1, 0) },
    uLam: { value: new Float32Array(basis.lam) },
    uSpec: { value: basis.rgb.map((c) => new THREE.Vector3(...c)) },
    uLPos: { value: LIGHTS.map((l) => new THREE.Vector3(...l.pos)) },
    uLCol: { value: LIGHTS.map((l) => new THREE.Vector3(...l.col)) },
    uLPar: { value: LIGHTS.map((l) => new THREE.Vector2(l.I, l.size)) },
  };
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: fragmentSource(ns), uniforms,
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  shared = { canvas, renderer, uniforms, scene, camera, w: 1, h: 1, mobile };
  return shared;
}

// Render one frame at w x h pixels into the bottom-left of the shared canvas
// and copy it into `ctx`.
function renderInto(ctx, w, h, params) {
  const S = getShared();
  if (!S || S.failed) return false;
  const { renderer, uniforms: U } = S;
  if (w > S.w || h > S.h) {
    S.w = Math.max(S.w, w); S.h = Math.max(S.h, h);
    renderer.setSize(S.w, S.h, false);
  }
  const { windows, cardHalf, cornerRadius, bands, tilt, exposure, tint, spectral, mirror, roughness, base } = params;
  U.uRes.value.set(w, h);
  U.uCardHalf.value.set(cardHalf[0], cardHalf[1]);
  U.uCardR.value = cornerRadius;
  U.uTilt.value.set(tilt[0], tilt[1]);
  U.uWinN.value = windows.length;
  windows.forEach((b, i) => { U.uWinBox.value[i].set(b[0], b[1], b[2], b[3]); U.uWinR.value[i] = b[4]; });
  U.uBands.value.set(bands[0], bands[1], bands[2], bands[3]);
  U.uExposure.value = exposure;
  U.uTint.value.set(tint[0], tint[1], tint[2]);
  U.uFoilMix.value.set(spectral, mirror, roughness, base);

  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.setScissorTest(true);
  renderer.clear(true, false, false);
  renderer.render(S.scene, S.camera);
  renderer.setScissorTest(false);

  ctx.clearRect(0, 0, w, h);
  // GL's origin is bottom-left; drawImage's is top-left.
  ctx.drawImage(S.canvas, 0, S.h - h, w, h, 0, 0, w, h);
  return true;
}

// Turn the DOM-fraction windows (y down) into card-unit boxes (y up).
function windowBoxes(windows, cardW) {
  return windows.slice(0, MAX_WINDOWS).map((wn) => {
    const cx = ((wn.x0 + wn.x1) / 2 - 0.5) * cardW;
    const cy = 0.5 - (wn.y0 + wn.y1) / 2;
    return [cx, cy, ((wn.x1 - wn.x0) / 2) * cardW, (wn.y1 - wn.y0) / 2, wn.r ?? 0.01];
  });
}

/**
 * <HoloFoilFrame tilt={{rx, ry}} scale={scale} options={data.frameHolo} />
 *
 * Sits where the frame <img> would: absolute, inset 0, z 12. `tilt` is the
 * card's own rx/ry in degrees; `scale` is the card's render scale so the
 * canvas is sized to on-screen pixels, not the 744px layout box.
 */
export default function HoloFoilFrame({ tilt, scale = 1, options, className = "", style }) {
  const canvasRef = useRef(null);
  const opts = { ...HOLO_DEFAULTS, ...(options || {}) };
  const tiltKey = `${(tilt?.rx ?? 0).toFixed(2)}|${(tilt?.ry ?? 0).toFixed(2)}`;
  const optsKey = JSON.stringify(opts);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.clientWidth || 744, ch = canvas.clientHeight || 1038;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.round(cw * scale * dpr)), h = Math.max(2, Math.round(ch * scale * dpr));
    if (w * h > opts.maxPixels) { const k = Math.sqrt(opts.maxPixels / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    const cardW = cw / ch;
    const gain = opts.tiltGain;
    // CSS rotateY(+) sends the right edge away, as does three's; CSS
    // rotateX(+) sends the TOP away in a y-down space, which is -pitch here.
    const yaw = ((tilt?.ry ?? 0) * gain * Math.PI) / 180;
    const pitch = (-(tilt?.rx ?? 0) * gain * Math.PI) / 180;
    renderInto(ctx, w, h, {
      windows: windowBoxes(opts.windows, cardW),
      cardHalf: [cardW / 2, 0.5],
      cornerRadius: opts.cornerRadius,
      bands: [opts.outerBand ? opts.edge : 0, opts.outerBand ? opts.groove : 0, opts.chrome, opts.cell],
      tilt: [yaw, pitch],
      exposure: opts.exposure,
      tint: opts.tint,
      spectral: opts.spectral,
      mirror: opts.mirror,
      roughness: opts.roughness,
      base: opts.base,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiltKey, optsKey, scale]);

  return (
    <canvas
      ref={canvasRef}
      className={`tc-cardframe tc-cardframe--holo ${className}`}
      aria-hidden="true"
      style={style}
    />
  );
}
