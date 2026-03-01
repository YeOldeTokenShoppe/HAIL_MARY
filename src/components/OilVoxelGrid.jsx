"use client";

import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, useGLTF, useTexture, useEnvironment } from "@react-three/drei";
import { generateOilDistribution3D } from "@/lib/oilDistribution";
import { PUMP_ZONES, MATERIAL_PRESETS, ADDON_CATALOG, ADDON_SLOTS, FENCE_CATALOG } from "@/components/PimpMyPumpPanel";
import RogueCharacter from "@/components/RogueCharacter";
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
  const cctvCam = useMemo(() => new THREE.PerspectiveCamera(90, CCTV_W / CCTV_H, 0.01, 100), []);
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

    // Position camera at the security camera + offsets
    cctvCam.position.set(
      _cctvState.worldPos.x + CCTV_OFFSET_X,
      _cctvState.worldPos.y + CCTV_OFFSET_Y,
      _cctvState.worldPos.z + CCTV_OFFSET_Z,
    );

    // Forward direction in the security camera's local space (reuse refs)
    const localFwd = _localFwd.current.set(1, 0, 0);
    const normalMatrix = _normalMat.current.getNormalMatrix(_cctvState.worldMatrix);
    localFwd.applyMatrix3(normalMatrix).normalize();

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

  varying vec3 vOrigin;
  varying vec3 vDirection;

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

    vec3 colLow  = vec3(0.15, 0.08, 0.02);
    vec3 colMid  = vec3(0.35, 0.18, 0.05);
    vec3 colHigh = vec3(0.85, 0.55, 0.15);

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

        float glow = 1.0 + intensity * 2.0;
        oilColor *= glow;

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

void main() {
  float x = vUv.x - 0.5;
  // When viewing the back face, flip x so the flow pattern stays consistent
  if (!gl_FrontFacing) x = -x;
  float y = vUv.y;

  float T = uTime;

  // ── Fast scrolling noise layers that rush UPWARD ──
  // Key: subtract time from y so the pattern moves up
  float scroll1 = fbm(vec2(x * 8.0, y * 5.0 - T * 4.0));
  float scroll2 = fbm(vec2(x * 10.0 + 3.7, y * 6.0 - T * 5.0 + 1.3));
  float scroll3 = fbm(vec2(x * 14.0 - 1.1, y * 8.0 - T * 6.0 + 5.7));

  // Combine into turbulent displacement
  float turb = scroll1 * 0.55 + scroll2 * 0.3 + scroll3 * 0.15;

  // ── Column shape: narrow jet at base, cresting cap that curls back down ──
  float baseWidth = 0.06;
  float spread = 0.35 * y * y; // quadratic spread up the jet
  float wobble = scroll1 * 0.1 * y;

  // Cap zone: oil mushrooms outward starting at y ~0.55
  float capZone = smoothstep(0.55, 0.78, y);
  float capBulge = capZone * 0.28;
  // Lobes push outward from center
  float capLobe = capZone * sign(x + 0.001) * (fbm(vec2(abs(x) * 6.0 - T * 1.5, y * 4.0 + T * 2.0)) * 0.12);

  float columnWidth = baseWidth + spread + capBulge + abs(capLobe);
  float xOff = x + wobble + capLobe;
  // Soft inner edge: in the cap, the boundary becomes a wide gentle gradient
  float innerEdge = mix(columnWidth * 0.3, columnWidth * 0.0, capZone);
  float shape = smoothstep(columnWidth, innerEdge, abs(xOff));

  // ── Vertical profile ──
  float coreDensity = smoothstep(0.0, 0.08, y);

  // Stay solid throughout — no smoke dissipation
  float wispiness = mix(0.85, 0.4, y); // less wispy overall, stays denser
  float density = mix(turb * 0.5 + 0.5, 1.0, wispiness) * coreDensity;

  // Chaotic blobs rushing upward
  float blobs = noise(vec2(x * 10.0, y * 8.0 - T * 5.0));
  blobs = smoothstep(0.1, 0.5, blobs) * (1.0 - y * 0.3);
  density = max(density, blobs * 0.8);

  // Dense cap fill — stays opaque, not smoky
  float capDensity = capZone * (fbm(vec2(sign(x + 0.001) * abs(x) * 2.0 - sign(x + 0.001) * T * 2.0, y * 5.0 - T * 0.8)) * 0.4 + 0.6);
  density = mix(density, max(density, capDensity), capZone);

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

  float colorNoise = scroll2 * 0.5 + 0.5;
  vec3 col = mix(darkOil, midOil, colorNoise);
  col = mix(col, highlight, pow(max(density, 0.0), 4.0) * 0.6);

  // Night emissive glow — adds a blue luminance boost along edges and core
  float emissive = uNightMode * (0.3 + 0.4 * pow(max(density, 0.0), 2.0));
  col += vec3(0.05, 0.1, 1.35) * emissive;

  // ── Alpha compositing ──
  float alpha = shape * density * uOpacity;
  // Solid core boost
  float coreBoost = smoothstep(columnWidth * 0.5, 0.0, abs(xOff)) * coreDensity * 0.5;
  alpha = min(alpha + coreBoost * uOpacity, 1.0);

  // Dome fade: radial distance from a point at top-center of the gusher
  // This naturally rounds the top into a dome shape
  float domeCenter = 0.65; // y-center of the dome
  float dx = x * 1.8; // stretch x so dome is taller than wide
  float dy = max(y - domeCenter, 0.0); // only fade above dome center
  float domeDist = sqrt(dx * dx + dy * dy);
  float domeFade = smoothstep(0.4, 0.05, domeDist);

  // Edge fade — sides and bottom
  float edgeFade = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x)
                 * smoothstep(0.0, 0.02, y) * domeFade;
  alpha *= edgeFade;

  gl_FragColor = vec4(col, alpha);
}
`;

// ── Tank liquid fill (animated, flat-topped) ────────────────────────────────

const PUMPJACK_SCALE = 0.1;

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

function TankLiquid({ tankBounds, tankFill }) {
  const meshRef = useRef();
  const displayFill = useRef(0);
  const lastQuantizedFill = useRef(-1);

  const oilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x1a0e05,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.97,
  }), []);

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
    const zoneId = MESH_TO_ZONE[child.name];
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

    // Apply color — detach texture map so flat color shows through
    if (zoneConf.color) {
      mat.color.set(zoneConf.color);
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

function AddonTubeMan({ item, slotPos, rotation = 0 }) {
  const { scene } = useGLTF(item.model);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // Deep-clone bottom geometry for vertex sway
    c.traverse((child) => {
      if (child.name === "BottomTubeMan" && child.isMesh && child.geometry) {
        child.geometry = child.geometry.clone();
      }
    });
    return c;
  }, [scene]);
  useEffect(() => () => disposeScene(cloned), [cloned]);
  const topRef = useRef();
  const timeRef = useRef(0);

  // Find TopTubeMan + BottomTubeMan and store bottom's original verts
  const bottomData = useRef(null);
  const topOrigPos = useRef(null);
  useMemo(() => {
    cloned.traverse((child) => {
      if (child.name === "TopTubeMan") {
        topRef.current = child;
        topOrigPos.current = child.position.clone();
      }
      if (child.name === "BottomTubeMan" && child.isMesh && child.geometry) {
        const pos = child.geometry.attributes.position;
        if (pos) {
          child.geometry.computeBoundingBox();
          const bb = child.geometry.boundingBox;
          bottomData.current = {
            mesh: child,
            origPos: new Float32Array(pos.array),
            minZ: bb.min.z,
            maxZ: bb.max.z,
            height: (bb.max.z - bb.min.z) || 1,
          };
        }
      }
    });
  }, [cloned]);

  useFrame((_, delta) => {
    if (!topRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;

    // Snappy whip motion — sharp fold, snap back
    const snapX = Math.sin(t * 2.2);
    const snapZ = Math.cos(t * 1.7);
    // Cubic root sharpening — spends time at extremes, snaps through center
    const sharpX = Math.sign(snapX) * Math.pow(Math.abs(snapX), 0.3);
    const sharpZ = Math.sign(snapZ) * Math.pow(Math.abs(snapZ), 0.3);

    // Rotate the top half — full bend forward/back/sides (~120°)
    topRef.current.rotation.x = sharpX * 2.0;
    topRef.current.rotation.y = sharpZ * 1.5;

    // Bottom half: delayed, dampened vertex sway — anchored at ground (maxZ)
    if (bottomData.current) {
      const bd = bottomData.current;
      const pos = bd.mesh.geometry.attributes.position;
      const arr = pos.array;
      const orig = bd.origPos;
      // Delayed version of top's motion (phase offset) — chain reaction feel
      const delaySnapX = Math.sin((t - 0.3) * 2.2);
      const delaySnapZ = Math.cos((t - 0.3) * 1.7);
      const delayX = Math.sign(delaySnapX) * Math.pow(Math.abs(delaySnapX), 0.3) * 0.25;
      const delayZ = Math.sign(delaySnapZ) * Math.pow(Math.abs(delaySnapZ), 0.3) * 0.18;
      // Joint offset at heightFrac=1 (top of bottom mesh)
      const jointOffX = delayX * bd.height;
      const jointOffY = delayZ * bd.height;
      for (let i = 0; i < arr.length; i += 3) {
        const oz = orig[i + 2];
        // heightFrac: 0 at ground (maxZ), 1 at joint (minZ)
        const heightFrac = Math.max(0, Math.min(1, (bd.maxZ - oz) / bd.height));
        // Quadratic ramp — ground stays put, joint sways most
        const sway = heightFrac * heightFrac;
        arr[i]     = orig[i]     + delayX * sway * bd.height;
        arr[i + 1] = orig[i + 1] + delayZ * sway * bd.height;
      }
      pos.needsUpdate = true;

      // Move top's position to follow the bottom's joint
      // Vertex space is ~100x larger than object position space
      if (topOrigPos.current && topRef.current) {
        const scale = 0.01;
        topRef.current.position.x = topOrigPos.current.x + jointOffX * scale;
        topRef.current.position.z = topOrigPos.current.z + jointOffY * scale;
      }
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

function Pumpjack({ position, scene, animations, drillDay, maxDrillDay, depthCellSize, highlighted, pumpConfig, envMap, oilStrike, drillEvent = 0, drillProximity = 0, tankFill, onClick, onDoubleClick, onTankDrain, envPreset, hasMessages = false, onEnvelopeClick }) {
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
  const gaugeBaseRotX = useRef(0);
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
      if (child.name.startsWith("Cylinder_Pump")) {
        if (!cylPumpRefs.current.includes(child)) {
          cylPumpRefs.current.push(child);
        }
      }
      // Wheel
      if (child.name === "Wheel") {
        wheelRef.current = child;
      }
      // Gauge needle
      if (child.name === "GaugeNeedle") {
        gaugeNeedleRef.current = child;
        gaugeBaseRotX.current = child.rotation.x;
      }
      // Pressure panel text meshes — find children of PressurePanel
      // Log names in dev to identify the correct mapping
      if (child.name === "PressurePanel") {
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

  // Apply pump customization (paint colors) — show for any cell with a config
  useEffect(() => {
    if (pumpConfig) {
      applyPumpConfig(clonedScene, pumpConfig, originalMatsRef.current, envMap);
    } else if (originalMatsRef.current && Object.keys(originalMatsRef.current).length > 0) {
      applyPumpConfig(clonedScene, null, originalMatsRef.current, envMap);
    }
  }, [clonedScene, pumpConfig, envMap]);

  // Security camera visibility — requires sign to be visible
  useEffect(() => {
    const show = !!pumpConfig?.showCamera && !!pumpConfig?.showSign;
    secCamPartsRef.current.forEach((part) => { part.visible = show; });
  }, [pumpConfig?.showCamera, pumpConfig?.showSign]);

  // Sign frame visibility
  useEffect(() => {
    const show = !!pumpConfig?.showSign;
    signFramePartsRef.current.forEach((part) => { part.visible = show; });
  }, [pumpConfig?.showSign]);

  // Fence visibility — hide the old embedded fence parts (now separate models)
  useEffect(() => {
    fencePartsRef.current.forEach((part) => { part.visible = false; });
  }, []);

  // Apply custom image to Sign mesh when URL changes
  // Uses onBeforeCompile to flip UVs on back face so text is legible from both sides
  const signImageUrl = pumpConfig?.signImageUrl || null;
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
        mat.emissiveIntensity = 0.8;
        mat.transparent = false;
        mat.alphaTest = 0.5;
        mat.needsUpdate = true;
        if (prevFront && prevFront !== signOrigMat.current) prevFront.dispose();
        sign.material = mat;

        // Apply to back sign
        const back = signBackRef.current;
        if (back) {
          if (prevBack && prevBack !== signBackOrigMat.current) prevBack.dispose();
          back.material = mat.clone();
          back.material.needsUpdate = true;
        }
      });
    } else if (signOrigMat.current) {
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
  }, [signImageUrl]);

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

    // Render both sides so the tank stays visible at all camera angles
    tankMesh.material.side = THREE.DoubleSide;

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
  const STRIKE_FLASH_DURATION = 3.0;
  const strikeLightRef = useRef(); // dynamic point light

  // Ground shake on oil strike
  const shakeRef = useRef(false);
  const shakeTimerRef = useRef(0);
  const SHAKE_DURATION = 2.5;

  // ── Drill effects (every drill, not just oil strikes) ──────────────────────
  // Drill rumble — lighter shake, separate from oil-strike shake
  const drillShakeRef = useRef(false);
  const drillShakeTimerRef = useRef(0);
  const DRILL_SHAKE_DURATION = 7.0;
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
  const DUST_DURATION = 5.0;

  // Gauge needle twitch on dry drill
  const drillGaugeTwitchRef = useRef(false);
  const drillGaugeTwitchTimer = useRef(0);
  const DRILL_GAUGE_TWITCH_DURATION = 5.0;

  // Near-miss amber proximity pulse
  const proximityFlashRef = useRef(false);
  const proximityTimerRef = useRef(0);
  const PROXIMITY_FLASH_DURATION = 8.0;
  const drillProximityRef = useRef(0);
  drillProximityRef.current = drillProximity;

  // RedButton drain — local fill override while draining/drained
  const drainingRef = useRef(false);  // actively animating down
  const drainedRef = useRef(false);   // finished draining, stay at 0
  const drainFillRef = useRef(0);
  const redButtonRef = useRef();
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
  const signFramePartsRef = useRef([]);
  const fencePartsRef = useRef([]);

  // Security camera sweep
  const secCamRef = useRef();
  const secCamPartsRef = useRef([]);
  const secCamBaseRotY = useRef(null);
  const envelopeRef = useRef();

  useEffect(() => {
    clonedScene.traverse((child) => {
      // RedButton — click to drain the tank
      if (child.name === "RedButton" && child.isMesh) {
        redButtonRef.current = child;
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
        child.visible = !!pumpConfigRef.current?.showCamera && !!pumpConfigRef.current?.showSign;
      }
      // Sign — custom image texture (front + back)
      if (child.name === "Sign" && child.isMesh) {
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
        child.visible = !!pumpConfigRef.current?.showSign;
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
      // Envelope mesh — message indicator
      if (child.name === "Envelope") {
        envelopeRef.current = child;
        child.visible = false;
        if (!child.userData._envelopeCloned) {
          child.material = child.material.clone();
          child.userData._envelopeCloned = true;
        }
      }
    });
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
  const headPumpBaseRotX = useRef(null);
  const headPumpOrigMat = useRef(null);  // original material before oil stain
  const cylPumpRefs = useRef([]);        // Cylinder_Pump meshes
  const oilStainedParts = useRef([]);    // all parts to stain/restore

  // Oil geyser shader — only active on highlighted rig
  const gusherActiveRef = useRef(false);
  const gusherTimerRef = useRef(0);
  const geyserMeshRef = useRef();
  const geyserMatRef = useRef();
  const _camPos = useRef(new THREE.Vector3());
  const _meshPos = useRef(new THREE.Vector3());
  const geyserUniforms = useRef({
    uTime: { value: 0 },
    uOpacity: { value: 1.0 },
    uNightMode: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(256, 512) },
  });

  const initGusher = useCallback(() => {
    gusherActiveRef.current = true;
    gusherTimerRef.current = 0;
    if (geyserMatRef.current) {
      geyserMatRef.current.uniforms.uTime.value = 0;
      geyserMatRef.current.uniforms.uOpacity.value = 1.0;
    }
    if (geyserMeshRef.current) {
      geyserMeshRef.current.visible = true;
    }
    // Pause pump animation and tilt horsehead up out of the gusher blast
    if (!pumpPausedRef.current) {
      // Seek all actions to frame 103/110 (pump head at highest) and pause
      pumpActionsRef.current.forEach((action) => {
        const clip = action.getClip();
        action.time = clip.duration * (103 / 110);
        action.paused = true;
      });
      // Force one mixer update to apply the seek position
      mixer.update(0);
      // Flip Head_Pump upward and save original colors for all stained parts
      if (headPumpRef.current) {
        headPumpBaseRotX.current = headPumpRef.current.rotation.x;
        headPumpRef.current.rotation.x -= Math.PI;
      }
      // Save original colors for restore
      oilStainedParts.current = [headPumpRef.current, strawRef.current, ...cylPumpRefs.current].filter(Boolean);
      oilStainedParts.current.forEach((m) => {
        if (m.material && !m.userData._origColor) {
          m.userData._origColor = m.material.color.clone();
        }
      });
      pumpPausedRef.current = true;
    }
  }, []);

  // Trigger timed strobe + shake when oilStrike fires on the highlighted rig
  useEffect(() => {
    if (oilStrike > 0 && highlighted) {
      strikeFlashRef.current = true;
      strikeFlashTimer.current = 0;
      shakeRef.current = true;
      shakeTimerRef.current = 0;
      // Reset drained state so new oil cycle can fill normally
      drainedRef.current = false;
      drainingRef.current = false;
      setTankDraining(false);
    }
  }, [oilStrike, highlighted]);

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

  // Trigger drill effects on every drill event (highlighted rig only)
  const initDust = useCallback(() => {
    const pos = dustPosRef.current;
    const vel = dustVelRef.current;
    const life = dustLifeRef.current;
    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3;
      // Spawn from rig base
      pos[i3]     = (Math.random() - 0.5) * 0.1;
      pos[i3 + 1] = 0.02;
      pos[i3 + 2] = (Math.random() - 0.5) * 0.1;
      // Burst outward + upward with random velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.7;
      vel[i3]     = Math.cos(angle) * speed;
      vel[i3 + 1] = 0.5 + Math.random() * 1.0;
      vel[i3 + 2] = Math.sin(angle) * speed;
      life[i] = -(i / DUST_COUNT) * 0.15; // stagger spawns
    }
    dustActiveRef.current = true;
    dustTimerRef.current = 0;
    if (dustGeoRef.current) {
      dustGeoRef.current.attributes.position.needsUpdate = true;
    }
  }, []);

  const prevDrillEvent = useRef(0);
  useEffect(() => {
    if (drillEvent > 0 && drillEvent !== prevDrillEvent.current && highlighted) {
      prevDrillEvent.current = drillEvent;
      // 1. Drill rumble (every drill)
      drillShakeRef.current = true;
      drillShakeTimerRef.current = 0;
      // 2. Dust burst (every drill)
      initDust();
      // 3. Gauge twitch (dry drills only — oilStrike === 0)
      if (oilStrike === 0) {
        drillGaugeTwitchRef.current = true;
        drillGaugeTwitchTimer.current = 0;
      }
      // 4. Amber proximity pulse (near-miss)
      if (drillProximity > 0 && oilStrike === 0) {
        proximityFlashRef.current = true;
        proximityTimerRef.current = 0;
      }
    }
  }, [drillEvent, highlighted, oilStrike, drillProximity, initDust]);

  // Store drillDay and tankFill in refs so useFrame always has the latest values
  const drillDayRef = useRef(drillDay);
  drillDayRef.current = drillDay;
  const depthCellRef = useRef(depthCellSize);
  depthCellRef.current = depthCellSize;
  const tankFillRef = useRef(tankFill);
  tankFillRef.current = tankFill;
  const pumpConfigRef = useRef(pumpConfig);
  pumpConfigRef.current = pumpConfig;
  const highlightedRef = useRef(highlighted);
  highlightedRef.current = highlighted;
  const hasMessagesRef = useRef(hasMessages);
  hasMessagesRef.current = hasMessages;
  const frameSkip = useRef(Math.floor(Math.random() * 3)); // stagger so not all idle rigs spike on same frame
  useFrame(({ clock }, delta) => {
    // Envelope message indicator — gentle green pulse (runs for all pumpjacks)
    const env = envelopeRef.current;
    if (env) {
      env.visible = hasMessagesRef.current;
      if (hasMessagesRef.current) {
        const pulse = (Math.sin(clock.elapsedTime * 3) + 1) / 2;
        env.material.emissive.setHex(0x00ff44);
        env.material.emissiveIntensity = 0.5 + pulse * 2.5;
        env.material.color.setHex(0x22cc44);
      }
    }

    // Non-highlighted pumpjacks: throttle animation to every 3rd frame, skip all interactive logic
    if (!highlightedRef.current) {
      frameSkip.current = (frameSkip.current + 1) % 3;
      if (frameSkip.current === 0) mixer.update(delta * 3);
      return;
    }
    if (!pumpPausedRef.current) {
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
    if (needle) {
      const fill = Math.max(0, Math.min(currentFill, 1.0) - gaugePressureOffset.current);
      const targetAngle = gaugeBaseRotX.current - fill * 225 * (Math.PI / 180);
      needle.rotation.x += (targetAngle - needle.rotation.x) * Math.min(delta * 3, 1);

      // Pressure label visibility — based on needle's actual lerped position, not raw fill
      const displayAngleDeg = Math.abs(needle.rotation.x - gaugeBaseRotX.current) * (180 / Math.PI);
      if (textLowRef.current) textLowRef.current.visible = displayAngleDeg < 85;
      if (textMedRef.current) textMedRef.current.visible = displayAngleDeg >= 85 && displayAngleDeg < 210;
      if (textHighRef.current) {
        const highOn = displayAngleDeg >= 210;
        // Flash when tank >= 90% capacity (angle >= 202.5°)
        const flashing = displayAngleDeg >= 202.5;
        textHighRef.current.visible = highOn && (!flashing || Math.sin(performance.now() * 0.012) > 0);
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
      }
    }

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

    // ── Drill rumble — lighter shake, coexists with oil-strike shake ──
    if (shakeGroup && drillShakeRef.current) {
      drillShakeTimerRef.current += delta;
      const dt = drillShakeTimerRef.current;
      if (dt < DRILL_SHAKE_DURATION) {
        const decay = 1 - dt / DRILL_SHAKE_DURATION;
        const mag = decay * DRILL_SHAKE_MAG;
        // Only apply if oil-strike shake isn't active (it's stronger)
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

    // ── Gauge needle twitch on dry drill ──
    if (drillGaugeTwitchRef.current) {
      drillGaugeTwitchTimer.current += delta;
      const gt = drillGaugeTwitchTimer.current;
      if (gt < DRILL_GAUGE_TWITCH_DURATION) {
        // Damped sine wave — seismograph-like twitch
        const amplitude = 0.35; // ~30° worth of fill offset
        gaugePressureOffset.current = amplitude * Math.exp(-gt * 1.5) * Math.sin(gt * 8);
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
    const camVisible = highlighted && !!pumpConfig?.showCamera;
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
      // Ensure mesh is visible (ref may not have been ready when initGusher fired)
      if (geyserMeshRef.current && !geyserMeshRef.current.visible) {
        geyserMeshRef.current.visible = true;
      }
      // Keep pump head parts oil-stained while gusher is active
      const stainColor = 0x1a0e05;
      if (headPumpRef.current?.material) headPumpRef.current.material.color.set(stainColor);
      if (strawRef.current?.material) strawRef.current.material.color.set(stainColor);
      cylPumpRefs.current.forEach((m) => { if (m.material) m.material.color.set(stainColor); });
      gusherTimerRef.current += delta;
      const GUSHER_DURATION = 3.0;

      const effectiveFill = (drainingRef.current || drainedRef.current) ? drainFillRef.current : tankFillRef.current;
      const overflowing = effectiveFill >= 1.0 && highlighted;

      if (geyserMatRef.current) {
        geyserMatRef.current.uniforms.uNightMode.value = envPreset === "night" ? 1.0 : 0.0;
        geyserMatRef.current.uniforms.uTime.value += delta;
        // Fade out near end of one-shot gusher
        const fade = overflowing ? 1.0
          : gusherTimerRef.current > GUSHER_DURATION - 1.0
            ? Math.max(0, GUSHER_DURATION - gusherTimerRef.current)
            : 1.0;
        geyserMatRef.current.uniforms.uOpacity.value = fade;
      }

      if (gusherTimerRef.current > GUSHER_DURATION && !overflowing) {
        gusherActiveRef.current = false;
        if (geyserMeshRef.current) geyserMeshRef.current.visible = false;
        // Resume pump animation, restore Head_Pump rotation and all stained colors
        if (pumpPausedRef.current) {
          if (headPumpRef.current && headPumpBaseRotX.current !== null) {
            headPumpRef.current.rotation.x = headPumpBaseRotX.current;
          }
          oilStainedParts.current.forEach((m) => {
            if (m.material && m.userData._origColor) {
              m.material.color.copy(m.userData._origColor);
              delete m.userData._origColor;
            }
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

    // RedButton click — drain tank, stop gusher, reset gauge
    if (e.object && e.object.name === "RedButton" && highlighted) {
      if (!drainingRef.current && tankFillRef.current > 0) {
        drainingRef.current = true;
        drainFillRef.current = Math.min(tankFillRef.current, 1.0);
        setTankDraining(true);

        // Kill geyser immediately
        gusherActiveRef.current = false;
        strikingRef.current = false;
        strikeFlashRef.current = false;
        if (geyserMeshRef.current) geyserMeshRef.current.visible = false;
        if (geyserMatRef.current) geyserMatRef.current.uniforms.uOpacity.value = 0;
        // Resume pump animation, restore Head_Pump rotation and all stained colors
        if (pumpPausedRef.current) {
          if (headPumpRef.current && headPumpBaseRotX.current !== null) {
            headPumpRef.current.rotation.x = headPumpBaseRotX.current;
          }
          oilStainedParts.current.forEach((m) => {
            if (m.material && m.userData._origColor) {
              m.material.color.copy(m.userData._origColor);
              delete m.userData._origColor;
            }
          });
          pumpActionsRef.current.forEach((action) => { action.paused = false; });
          pumpPausedRef.current = false;
        }
      }
      return;
    }

    // Envelope click — open chat modal
    let isEnvelopeClick = false;
    obj = e.object;
    while (obj) {
      if (obj.name === "Envelope") { isEnvelopeClick = true; break; }
      obj = obj.parent;
    }
    if (isEnvelopeClick) {
      onEnvelopeClick?.();
      return;
    }

    // Always allow flyTo — interactive elements (wheel, gate, button) return early above
    const now = Date.now();
    if (now - lastClickTime.current < 400) {
      onDoubleClick?.();
    } else {
      onClick?.();
    }
    lastClickTime.current = now;
  }, [onClick, onDoubleClick, highlighted, initSteam, onEnvelopeClick]);

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
      {tankBounds && <TankLiquid tankBounds={tankBounds} tankFill={tankDraining ? 0 : tankFill} />}
      {/* Red alert point light — only on selected rig, intensity driven by useFrame */}
      {highlighted && (
        <>
          <pointLight
            ref={strikeLightRef}
            position={[0, 0.5, 0]}
            color={0xff0000}
            intensity={0}
            distance={5}
            decay={1.5}
          />
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

  const oilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x1a0e05,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  }), []);

  useFrame((_, delta) => {
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
    // Radius slightly smaller than tank to avoid clipping through walls
    const r = tb.radius * 0.78;
    // Minimum visible fill height so even tiny amounts show a visible layer
    const minH = tb.height * 0.03;
    const h = Math.max(minH, tb.height * f);

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

function OilTower({ position, communityOil = 0, totalOilBudget = 500 }) {
  const { scene } = useGLTF("/models/OilTower.glb");
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => () => disposeScene(clonedScene), [clonedScene]);

  // Find the tower tank mesh and compute bounds
  const towerBounds = useMemo(() => {
    let tankMesh = null;
    clonedScene.traverse((child) => {
      if (child.name === "OilTower" && child.isMesh) {
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
      <primitive object={clonedScene} position={position} scale={0.1} />
      {towerBounds && (
        <TowerLiquid
          towerBounds={towerBounds}
          position={position}
          fill={totalOilBudget > 0 ? communityOil / totalOilBudget : 0}
          scale={0.1}
        />
      )}
    </group>
  );
}

useGLTF.preload("/models/OilTower.glb");

function PumpjackInstances({ gridX, gridY, cellSize, worldW, worldD, drillDay, maxDrillDay, depthCellSize, selectedCol, selectedRow, onSelectCell, onFlyTo, onZoomOut, pumpConfig, allPumpConfigs = {}, oilStrike, drillEvent = 0, drillProximity = 0, tankFill, onTankDrain, communityOil = 0, totalOilBudget = 500, envPreset, plotsWithMessages = {}, onEnvelopeClick }) {
  const { scene, animations } = useGLTF("/models/oilJack_fancy_allProps.glb");
  const envMap = useEnvironment({ preset: "studio" });

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
    return [x, 0.01, z]; // slightly above surface to avoid z-fighting
  }, [selectedCol, selectedRow, cellSize, worldW, worldD, gridX, gridY]);

  return (
    <>
      {/* Oil Tower in the center 4 cells */}
      <OilTower position={towerPos} communityOil={communityOil} totalOilBudget={totalOilBudget} />
      {/* Highlight on the selected grid square */}
      {selectedPos && (
        <group position={selectedPos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[cellSize, cellSize]} />
            <meshBasicMaterial color={0xb99230} transparent opacity={0.45} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
          </mesh>
          <lineLoop>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={new Float32Array([
                  -cellSize / 2, 0, -cellSize / 2,
                   cellSize / 2, 0, -cellSize / 2,
                   cellSize / 2, 0,  cellSize / 2,
                  -cellSize / 2, 0,  cellSize / 2,
                ])}
                count={4}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={0xd4a854} />
          </lineLoop>
        </group>
      )}
      {items.map(({ key, position, col, row }) => {
        // Drill all if no selection, otherwise only the selected cell
        const active = selectedCol === null || (col === selectedCol && row === selectedRow);
        const isSelected = selectedCol !== null && col === selectedCol && row === selectedRow;
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
            highlighted={isSelected}
            pumpConfig={cellConfig}
            envMap={envMap}
            oilStrike={oilStrike}
            drillEvent={isSelected ? drillEvent : 0}
            drillProximity={isSelected ? drillProximity : 0}
            tankFill={isSelected ? tankFill : 0}
            onTankDrain={isSelected ? onTankDrain : undefined}
            envPreset={envPreset}
            hasMessages={!!plotsWithMessages[`${col}_${row}`]}
            onEnvelopeClick={() => onEnvelopeClick?.(col, row)}
            onClick={() => { onSelectCell?.(col, row); onFlyTo?.(col, row); }}
            onDoubleClick={() => isSelected ? onZoomOut?.() : onFlyTo?.(col, row)}
          />
        );
      })}
    </>
  );
}

useGLTF.preload("/models/oilJack_fancy_allProps.glb");

// ── Remote Gusher (broadcast oil strikes) ────────────────────────────────────

const REMOTE_PARTICLE_COUNT = 2000;

function RemoteGusher({ position }) {
  const posArr = useRef(new Float32Array(REMOTE_PARTICLE_COUNT * 3));
  const velArr = useRef(new Float32Array(REMOTE_PARTICLE_COUNT * 3));
  const lifeArr = useRef(new Float32Array(REMOTE_PARTICLE_COUNT));
  const geoRef = useRef();
  const matRef = useRef();
  const lightRef = useRef();
  const elapsed = useRef(0);

  // Initialize particles — stagger across full lifetime for continuous flow
  useEffect(() => {
    const pos = posArr.current;
    const vel = velArr.current;
    const life = lifeArr.current;
    for (let i = 0; i < REMOTE_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Stagger across full life so particles are evenly distributed at all times
      const t = (i / REMOTE_PARTICLE_COUNT) * 1.2;
      const angle = Math.random() * Math.PI * 2;
      const spread = 0.05 + Math.random() * 0.12;
      const vy = 3.0 + Math.random() * 2.5;
      const vx = Math.cos(angle) * spread;
      const vz = Math.sin(angle) * spread;
      // Pre-simulate to starting position
      pos[i3] = vx * t;
      pos[i3 + 1] = 0.3 + vy * t - 3.0 * t * t; // half-gravity pre-sim
      pos[i3 + 2] = vz * t;
      vel[i3] = vx;
      vel[i3 + 1] = vy - 6.0 * t;
      vel[i3 + 2] = vz;
      life[i] = t;
    }
  }, []);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const pos = posArr.current;
    const vel = velArr.current;
    const life = lifeArr.current;

    for (let i = 0; i < REMOTE_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      life[i] += delta;
      if (life[i] > 1.2) {
        // respawn with tight spread for columnar stream
        pos[i3] = 0;
        pos[i3 + 1] = 0.3;
        pos[i3 + 2] = 0;
        const angle = Math.random() * Math.PI * 2;
        const spread = 0.05 + Math.random() * 0.12;
        vel[i3] = Math.cos(angle) * spread;
        vel[i3 + 1] = 3.0 + Math.random() * 2.5;
        vel[i3 + 2] = Math.sin(angle) * spread;
        life[i] = 0;
      }
      vel[i3 + 1] -= 6.0 * delta; // gravity
      pos[i3] += vel[i3] * delta;
      pos[i3 + 1] += vel[i3 + 1] * delta;
      pos[i3 + 2] += vel[i3 + 2] * delta;
    }

    if (geoRef.current) {
      geoRef.current.attributes.position.needsUpdate = true;
    }
    if (matRef.current) {
      matRef.current.opacity = 0.5;
    }
    // Flash point light on initial burst, then steady glow
    if (lightRef.current) {
      const flash = Math.max(0, 1 - elapsed.current * 2) * 3;
      lightRef.current.intensity = flash + 0.5;
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        position={[0, 0.5, 0]}
        color={0xff2200}
        intensity={0}
        distance={4}
        decay={2}
      />
      <points renderOrder={10}>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[posArr.current, 3]}
            count={REMOTE_PARTICLE_COUNT}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          color={0x1a0e05}
          size={0.02}
          map={_oilDropletTex}
          transparent
          opacity={0.5}
          depthWrite={false}
          depthTest={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// ── Neutral soft-circle texture (white RGB, alpha-only falloff) ──────────────
const _neutralDropletTex = (() => {
  if (typeof document === "undefined") return null;
  const size = 32;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.8)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
})();

// ── Shader Gusher (test gushers use the GPU geyser shader) ──────────────────

const SHADER_GUSHER_PARTICLES = 300;

function ShaderGusher({ position, envPreset }) {
  const meshRef = useRef();
  const shaderMatRef = useRef();
  const camPosRef = useRef(new THREE.Vector3());
  const meshPosRef = useRef(new THREE.Vector3());
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uOpacity: { value: 1.0 },
    uNightMode: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(256, 512) },
  });

  const posArr = useRef(new Float32Array(SHADER_GUSHER_PARTICLES * 3));
  const velArr = useRef(new Float32Array(SHADER_GUSHER_PARTICLES * 3));
  const lifeArr = useRef(new Float32Array(SHADER_GUSHER_PARTICLES));
  const geoRef = useRef();
  const ptMatRef = useRef();
  const lightRef = useRef();
  const elapsed = useRef(0);

  const { camera } = useThree();

  useEffect(() => {
    const pos = posArr.current;
    const vel = velArr.current;
    const life = lifeArr.current;
    for (let i = 0; i < SHADER_GUSHER_PARTICLES; i++) {
      const i3 = i * 3;
      const t = (i / SHADER_GUSHER_PARTICLES) * 1.2;
      const angle = Math.random() * Math.PI * 2;
      const spread = 0.05 + Math.random() * 0.12;
      const vy = 3.0 + Math.random() * 2.5;
      const vx = Math.cos(angle) * spread;
      const vz = Math.sin(angle) * spread;
      pos[i3] = vx * t;
      pos[i3 + 1] = 0.3 + vy * t - 3.0 * t * t;
      pos[i3 + 2] = vz * t;
      vel[i3] = vx;
      vel[i3 + 1] = vy - 6.0 * t;
      vel[i3 + 2] = vz;
      life[i] = t;
    }
  }, []);

  useFrame((_, delta) => {
    if (shaderMatRef.current) {
      shaderMatRef.current.uniforms.uTime.value += delta;
      shaderMatRef.current.uniforms.uNightMode.value = envPreset === "night" ? 1.0 : 0.0;
    }
    const mesh = meshRef.current;
    if (mesh) {
      const camPos = camera.getWorldPosition(camPosRef.current);
      const meshPos = mesh.getWorldPosition(meshPosRef.current);
      mesh.lookAt(camPos.x, meshPos.y, camPos.z);
    }

    elapsed.current += delta;
    const pos = posArr.current;
    const vel = velArr.current;
    const life = lifeArr.current;
    for (let i = 0; i < SHADER_GUSHER_PARTICLES; i++) {
      const i3 = i * 3;
      life[i] += delta;
      if (life[i] > 1.2) {
        pos[i3] = 0;
        pos[i3 + 1] = 0.3;
        pos[i3 + 2] = 0;
        const angle = Math.random() * Math.PI * 2;
        const spread = 0.05 + Math.random() * 0.12;
        vel[i3] = Math.cos(angle) * spread;
        vel[i3 + 1] = 3.0 + Math.random() * 2.5;
        vel[i3 + 2] = Math.sin(angle) * spread;
        life[i] = 0;
      }
      vel[i3 + 1] -= 6.0 * delta;
      pos[i3] += vel[i3] * delta;
      pos[i3 + 1] += vel[i3 + 1] * delta;
      pos[i3 + 2] += vel[i3 + 2] * delta;
    }
    if (geoRef.current) geoRef.current.attributes.position.needsUpdate = true;
    if (ptMatRef.current) {
      ptMatRef.current.opacity = 0.5;
      if (envPreset === "night") {
        ptMatRef.current.color.setRGB(0.08, 0.15, 0.45);
      } else {
        ptMatRef.current.color.setRGB(0.1, 0.055, 0.02);
      }
    }
    if (lightRef.current) {
      const flash = Math.max(0, 1 - elapsed.current * 2) * 3;
      lightRef.current.intensity = flash + 0.5;
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        position={[0, 0.5, 0]}
        color={0xff2200}
        intensity={1.5}
        distance={4}
        decay={2}
      />
      <mesh
        ref={meshRef}
        renderOrder={10}
        position={[0, 1.0, 0]}
      >
        <planeGeometry args={[0.9, 3.0]} />
        <shaderMaterial
          ref={shaderMatRef}
          vertexShader={_geyserVertexShader}
          fragmentShader={_geyserFragmentShader}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          uniforms={uniformsRef.current}
        />
      </mesh>
      <points renderOrder={11}>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[posArr.current, 3]}
            count={SHADER_GUSHER_PARTICLES}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={ptMatRef}
          color={0x1a0e05}
          size={0.02}
          map={_neutralDropletTex}
          transparent
          opacity={0.5}
          depthWrite={false}
          depthTest
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function OilVoxelGrid({
  blockHash = "0x8a3f7b2c91d4e6f5a0b3c8d7e2f1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
  gridX = 10,
  gridY = 10,
  depthZ = 20,
  cellSize = 1,
  numberOfDeposits = 8,
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
  currentUserId,
  onRogueArrive,
  onRogueConsequence,
  envPreset,
  plotsWithMessages = {},
  onEnvelopeClick,
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

  // 6 materials for box faces: +x, -x, +y (top), -y (bottom), +z, -z
  const groundMaterials = useMemo(() => {
    const revealed = revealProgress > 0;
    const op = revealed ? 0.15 : 1;
    const shared = { transparent: true, depthWrite: !revealed, depthTest: !revealed, opacity: op };
    const topMat = new THREE.MeshStandardMaterial({ map: topoTex, color: "#8b7355", roughness: 0.9, metalness: 0.05, ...shared });
    const bottomMat = new THREE.MeshStandardMaterial({ color: "#5a4030", roughness: 0.95, metalness: 0.02, ...shared });
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.85, metalness: 0.05, ...shared });
    const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
    groundMatsRef.current = mats;
    return mats;
  }, [sideTex, topoTex, revealProgress]);

  const depthCellSize = cellSize * 0.5;
  const worldW = gridX * cellSize;
  const worldH = depthZ * depthCellSize;
  const worldD = gridY * cellSize;

  const deposits = useMemo(() => {
    const { deposits } = generateOilDistribution3D({
      blockHash, gridX, gridY, depthZ, totalOilBudget, numberOfDeposits, depthBias: 0.35,
    });
    return deposits;
  }, [blockHash, gridX, gridY, depthZ, numberOfDeposits, totalOilBudget]);

  // Build fragment shader with deposit data baked in as constants
  const fragmentShader = useMemo(() => {
    return buildFragShader({
      deposits, gridX, gridY, depthZ, cellSize, depthCellSize,
      worldW, worldH, worldD,
    });
  }, [deposits, gridX, gridY, depthZ, cellSize, depthCellSize, worldW, worldH, worldD]);

  const shaderUniforms = useMemo(() => ({
    uReveal: { value: revealProgress },
  }), [revealProgress]);

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
          <lineBasicMaterial color={0x8b7355} transparent opacity={0.5} />
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
            plotsWithMessages={plotsWithMessages}
            onEnvelopeClick={onEnvelopeClick}
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
          {gusherEvents
            .filter((ev) => ev.userId !== currentUserId)
            .map((ev) => (
              <ShaderGusher
                key={ev.id}
                position={[
                  -worldW / 2 + ev.col * cellSize + cellSize / 2,
                  0,
                  worldD / 2 - ev.row * cellSize - cellSize / 2,
                ]}
                envPreset={envPreset}
              />
            ))}
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
            {`X${i}`}
          </Text>
        );
      })}

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
            {`Y${i}`}
          </Text>
        );
      })}
    </group>
  );
}
