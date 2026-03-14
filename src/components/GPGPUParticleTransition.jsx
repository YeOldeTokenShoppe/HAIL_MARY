"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEX_SIZE = 256; // 256x256 = 65536 particles
const PARTICLE_COUNT = TEX_SIZE * TEX_SIZE;
const CONVERGENCE_TIME = 1.8; // seconds before calling onTransitionComplete

// ---------------------------------------------------------------------------
// GLSL — Simplex noise (Ashima/Stefan Gustavson)
// ---------------------------------------------------------------------------

const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 snoise3(vec3 v) {
  return vec3(
    snoise(v),
    snoise(v + vec3(31.416, -47.853, 12.793)),
    snoise(v + vec3(-22.157, 63.921, -38.512))
  );
}
`;

// ---------------------------------------------------------------------------
// Simulation shader — reads position FBO (ping), writes new positions (pong)
// ---------------------------------------------------------------------------

const simVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const simFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uPositions;  // current position.xyz + age in w
uniform sampler2D uTargets;    // target position.xyz
uniform sampler2D uSeeds;      // per-particle random seeds
uniform float uDelta;          // delta time
uniform float uTime;           // elapsed time

varying vec2 vUv;

${SIMPLEX_NOISE_GLSL}

void main() {
  vec4 posAge = texture2D(uPositions, vUv);
  vec3 target = texture2D(uTargets, vUv).xyz;
  vec4 seeds  = texture2D(uSeeds, vUv);

  vec3 pos      = posAge.xyz;
  float age     = posAge.w;
  float lifetime = seeds.z * 2.0 + 0.5;    // 0.5 to 2.5 seconds (shorter)
  float speed   = seeds.x * 0.15 + 0.05;  // 0.05 to 0.20 (much faster chase)

  // Chase target
  vec3 toTarget = target - pos;
  float dist = length(toTarget);
  if (dist > 0.001) {
    pos += normalize(toTarget) * min(speed, dist);
  }

  // Fractal noise offset (subtle drift, not overpowering)
  float offsetSpeed = seeds.y * 0.15 + 0.05;
  float noiseScale = 0.8;
  vec3 noiseInput = pos * noiseScale + age * 0.5 + seeds.xyz * 10.0;
  vec3 offset = snoise3(noiseInput) * offsetSpeed * uDelta;
  pos += offset;

  // Age
  age += uDelta;
  if (age > lifetime) {
    age = 0.0;
    // Snap closer to target on reset to prevent permanent drift
    pos = mix(pos, target, 0.5);
  }

  gl_FragColor = vec4(pos, age);
}
`;

// ---------------------------------------------------------------------------
// Render shaders — draws point sprites from FBO data
// ---------------------------------------------------------------------------

const renderVertexShader = /* glsl */ `
uniform sampler2D uPositions;
uniform sampler2D uSeeds;
uniform float uTime;
uniform float uOpacity;

attribute vec2 aRef;  // UV lookup into FBO

varying float vLifeProgress;
varying float vSeed;

${SIMPLEX_NOISE_GLSL}

void main() {
  vec4 posAge = texture2D(uPositions, aRef);
  vec4 seeds  = texture2D(uSeeds, aRef);

  vec3 pos      = posAge.xyz;
  float age     = posAge.w;
  float lifetime = seeds.z * 2.0 + 0.5;
  float lifeProgress = clamp(age / lifetime, 0.0, 1.0);

  vLifeProgress = lifeProgress;
  vSeed = seeds.w;

  // Scale shrinks as particle ages
  float scale = 1.0 - smoothstep(0.7, 1.0, lifeProgress);
  scale *= 0.9 + 0.1 * sin(uTime * 1.5 + seeds.w * 6.28);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  float baseSize = 0.4 + seeds.w * 0.6;  // much smaller: 0.4 to 1.0
  gl_PointSize = max(1.0, baseSize * scale * (80.0 / -mvPosition.z) * uOpacity);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const renderFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uStartColor;
uniform vec3 uEndColor;
uniform float uOpacity;

varying float vLifeProgress;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);

  // Sharp circular point, minimal glow
  float circle = smoothstep(0.5, 0.35, d);
  float alpha = circle * 0.25 * uOpacity;  // low alpha — additive blending builds density

  if (alpha < 0.005) discard;

  // Color interpolation from startColor to endColor based on lifetime
  vec3 color = mix(uStartColor, uEndColor, vLifeProgress);

  // Slight core brighten
  float core = smoothstep(0.15, 0.0, d);
  color = mix(color, vec3(1.0, 0.98, 0.95), core * 0.3);

  gl_FragColor = vec4(color, alpha);
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPositions(group, targetCount) {
  const allPositions = [];
  group.updateMatrixWorld(true);

  group.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    // Skip hidden meshes (eyes, face2, phone, etc.)
    if (!child.visible) return;
    const posAttr = child.geometry.attributes.position;
    if (!posAttr) return;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      child.localToWorld(vertex);
      allPositions.push(vertex.x, vertex.y, vertex.z);
    }
  });

  const vertexCount = allPositions.length / 3;
  if (vertexCount === 0) return new Float32Array(targetCount * 3);

  // Randomly sample vertices so particles distribute evenly
  const result = new Float32Array(targetCount * 3);
  for (let i = 0; i < targetCount; i++) {
    const src = Math.floor(Math.random() * vertexCount) * 3;
    result[i * 3] = allPositions[src];
    result[i * 3 + 1] = allPositions[src + 1];
    result[i * 3 + 2] = allPositions[src + 2];
  }
  return result;
}

// Extract positions from a freshly loaded GLB (not in scene).
// Computes a bounding box and scales/positions to match a reference bounding box.
function extractAndMatchPositions(group, targetCount, refBBox) {
  const allPositions = [];
  group.updateMatrixWorld(true);

  group.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const posAttr = child.geometry.attributes.position;
    if (!posAttr) return;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      child.localToWorld(vertex);
      allPositions.push(vertex.x, vertex.y, vertex.z);
    }
  });

  const vertexCount = allPositions.length / 3;
  if (vertexCount === 0) return new Float32Array(targetCount * 3);

  // Compute bounding box of target
  const tMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const tMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < vertexCount; i++) {
    const x = allPositions[i * 3], y = allPositions[i * 3 + 1], z = allPositions[i * 3 + 2];
    if (x < tMin.x) tMin.x = x; if (y < tMin.y) tMin.y = y; if (z < tMin.z) tMin.z = z;
    if (x > tMax.x) tMax.x = x; if (y > tMax.y) tMax.y = y; if (z > tMax.z) tMax.z = z;
  }

  const tCenter = new THREE.Vector3().addVectors(tMin, tMax).multiplyScalar(0.5);
  const tSize = new THREE.Vector3().subVectors(tMax, tMin);
  const refCenter = new THREE.Vector3().addVectors(refBBox.min, refBBox.max).multiplyScalar(0.5);
  const refSize = new THREE.Vector3().subVectors(refBBox.max, refBBox.min);

  // Scale to match reference height (Y), keep proportions
  const tMaxDim = Math.max(tSize.x, tSize.y, tSize.z) || 1;
  const refMaxDim = Math.max(refSize.x, refSize.y, refSize.z) || 1;
  const scale = refMaxDim / tMaxDim;

  // Transform: center, scale, then reposition to match reference
  for (let i = 0; i < vertexCount; i++) {
    allPositions[i * 3]     = (allPositions[i * 3] - tCenter.x) * scale + refCenter.x;
    allPositions[i * 3 + 1] = (allPositions[i * 3 + 1] - tMin.y) * scale + refBBox.min.y;
    allPositions[i * 3 + 2] = (allPositions[i * 3 + 2] - tCenter.z) * scale + refCenter.z;
  }

  const result = new Float32Array(targetCount * 3);
  for (let i = 0; i < targetCount; i++) {
    const src = Math.floor(Math.random() * vertexCount) * 3;
    result[i * 3] = allPositions[src];
    result[i * 3 + 1] = allPositions[src + 1];
    result[i * 3 + 2] = allPositions[src + 2];
  }
  return result;
}

// Compute bounding box from position data
function computeBBox(arr, count) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < count; i++) {
    const x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
    if (x < min.x) min.x = x; if (y < min.y) min.y = y; if (z < min.z) min.z = z;
    if (x > max.x) max.x = x; if (y > max.y) max.y = y; if (z > max.z) max.z = z;
  }
  return { min, max };
}

let _gltfLoader = null;
function getGLTFLoader() {
  if (_gltfLoader) return _gltfLoader;
  const dracoPath =
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? `${window.location.origin}/draco/`
      : "/draco/";
  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoPath);
  _gltfLoader = new GLTFLoader();
  _gltfLoader.setDRACOLoader(draco);
  return _gltfLoader;
}

function createRenderTarget() {
  return new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

function createDataTexture(data) {
  const tex = new THREE.DataTexture(
    data,
    TEX_SIZE,
    TEX_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GPGPUParticleTransition({
  sourceModel,
  targetModelUrl,
  isTransitioning,
  onTransitionComplete,
  duration = CONVERGENCE_TIME,
}) {
  const { gl } = useThree();
  const pointsRef = useRef();

  const stateRef = useRef({
    phase: "idle", // idle | active | converging | done
    elapsed: 0,
    disposed: false,
  });

  // -----------------------------------------------------------------------
  // Create all GPU resources once
  // -----------------------------------------------------------------------
  const gpgpu = useMemo(() => {
    // --- Seeds DataTexture (static, per-particle random values) ---
    const seedData = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seedData[i * 4] = Math.random();     // speed seed
      seedData[i * 4 + 1] = Math.random(); // offset speed seed
      seedData[i * 4 + 2] = Math.random(); // lifetime seed
      seedData[i * 4 + 3] = Math.random(); // misc seed
    }
    const seedsTexture = createDataTexture(seedData);

    // --- Target positions DataTexture (updated on model change) ---
    const targetData = new Float32Array(PARTICLE_COUNT * 4); // xyz + unused w
    const targetsTexture = createDataTexture(targetData);

    // --- Position FBO ping/pong ---
    const posFBO = [createRenderTarget(), createRenderTarget()];

    // --- Simulation material (fullscreen quad) ---
    const simMaterial = new THREE.ShaderMaterial({
      vertexShader: simVertexShader,
      fragmentShader: simFragmentShader,
      uniforms: {
        uPositions: { value: null },
        uTargets: { value: targetsTexture },
        uSeeds: { value: seedsTexture },
        uDelta: { value: 0 },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    // --- Fullscreen quad for simulation ---
    const simScene = new THREE.Scene();
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(quadGeo, simMaterial);
    simScene.add(quadMesh);

    // --- Render geometry (point cloud) ---
    const renderGeo = new THREE.BufferGeometry();
    const refs = new Float32Array(PARTICLE_COUNT * 2);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const u = (i % TEX_SIZE) / TEX_SIZE + 0.5 / TEX_SIZE;
      const v = Math.floor(i / TEX_SIZE) / TEX_SIZE + 0.5 / TEX_SIZE;
      refs[i * 2] = u;
      refs[i * 2 + 1] = v;
    }
    renderGeo.setAttribute("aRef", new THREE.BufferAttribute(refs, 2));
    // Dummy position attribute (required by Three.js)
    renderGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3),
    );

    // --- Render material ---
    const startColor = new THREE.Color(0x00cfff);
    const endColor = new THREE.Color(0xffd36b);

    const renderMaterial = new THREE.ShaderMaterial({
      vertexShader: renderVertexShader,
      fragmentShader: renderFragmentShader,
      uniforms: {
        uPositions: { value: null },
        uSeeds: { value: seedsTexture },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uStartColor: { value: startColor },
        uEndColor: { value: endColor },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      posFBO,
      pingPong: 0,
      simMaterial,
      simScene,
      simCamera,
      quadGeo,
      quadMesh,
      seedsTexture,
      targetsTexture,
      targetData,
      renderGeo,
      renderMaterial,
      initialized: false,
    };
  }, []);

  // -----------------------------------------------------------------------
  // Initialize position FBO with data (fill both ping and pong)
  // -----------------------------------------------------------------------
  const initializePositionFBO = useCallback(
    (positionData) => {
      // positionData is Float32Array of xyz*PARTICLE_COUNT
      // Pack into RGBA: xyz + age=0
      const data = new Float32Array(PARTICLE_COUNT * 4);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        data[i * 4] = positionData[i * 3];
        data[i * 4 + 1] = positionData[i * 3 + 1];
        data[i * 4 + 2] = positionData[i * 3 + 2];
        data[i * 4 + 3] = Math.random() * 3.0; // randomize initial age so particles don't all reset at once
      }
      const initTex = createDataTexture(data);

      // Render initTex into both FBOs using a simple copy pass
      const copyMat = new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform sampler2D uTex;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(uTex, vUv);
          }
        `,
        uniforms: { uTex: { value: initTex } },
        depthTest: false,
        depthWrite: false,
      });

      const copyScene = new THREE.Scene();
      const copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const copyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
      copyScene.add(copyQuad);

      const currentRT = gl.getRenderTarget();
      for (let i = 0; i < 2; i++) {
        gl.setRenderTarget(gpgpu.posFBO[i]);
        gl.render(copyScene, copyCamera);
      }
      gl.setRenderTarget(currentRT);

      copyMat.dispose();
      copyQuad.geometry.dispose();
      initTex.dispose();

      gpgpu.initialized = true;
    },
    [gl, gpgpu],
  );

  // -----------------------------------------------------------------------
  // Update target texture with new vertex positions
  // -----------------------------------------------------------------------
  const updateTargets = useCallback(
    (positionData) => {
      const td = gpgpu.targetData;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        td[i * 4] = positionData[i * 3];
        td[i * 4 + 1] = positionData[i * 3 + 1];
        td[i * 4 + 2] = positionData[i * 3 + 2];
        td[i * 4 + 3] = 0;
      }
      gpgpu.targetsTexture.needsUpdate = true;
    },
    [gpgpu],
  );

  // -----------------------------------------------------------------------
  // Kick off transition when isTransitioning becomes true
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isTransitioning) return;
    const s = stateRef.current;
    if (s.phase !== "idle") return;

    const group = sourceModel?.current;
    if (!group) return;

    // Extract source model vertices
    const sourceData = extractPositions(group, PARTICLE_COUNT);
    const sourceBBox = computeBBox(sourceData, PARTICLE_COUNT);

    // Initialize position FBO with source positions
    initializePositionFBO(sourceData);

    // Set targets to source initially (particles stay put)
    updateTargets(sourceData);

    // Hide solid model, show particles
    group.visible = false;
    if (pointsRef.current) pointsRef.current.visible = true;

    s.phase = "active";
    s.elapsed = 0;

    // Load target GLB
    const loader = getGLTFLoader();
    loader.load(targetModelUrl, (gltf) => {
      if (s.disposed) return;

      // Extract target positions, scaled/positioned to match source model's bounding box
      const targetPositions = extractAndMatchPositions(gltf.scene, PARTICLE_COUNT, sourceBBox);

      // Update target texture — particles will organically chase new targets
      updateTargets(targetPositions);

      // Cleanup loaded GLTF
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material))
            child.material.forEach((m) => m.dispose());
          else child.material?.dispose();
        }
      });
    });
  }, [
    isTransitioning,
    sourceModel,
    targetModelUrl,
    initializePositionFBO,
    updateTargets,
  ]);

  // -----------------------------------------------------------------------
  // Per-frame: run simulation + render particles
  // -----------------------------------------------------------------------
  useFrame((state, delta) => {
    const s = stateRef.current;
    const dt = Math.min(delta, 0.05); // clamp delta

    if (s.phase === "idle" || !gpgpu.initialized) return;

    const elapsed = state.clock.elapsedTime;

    // --- Run simulation pass (ping → pong) ---
    const readIdx = gpgpu.pingPong;
    const writeIdx = 1 - readIdx;

    gpgpu.simMaterial.uniforms.uPositions.value =
      gpgpu.posFBO[readIdx].texture;
    gpgpu.simMaterial.uniforms.uDelta.value = dt;
    gpgpu.simMaterial.uniforms.uTime.value = elapsed;

    const currentRT = gl.getRenderTarget();
    gl.setRenderTarget(gpgpu.posFBO[writeIdx]);
    gl.render(gpgpu.simScene, gpgpu.simCamera);
    gl.setRenderTarget(currentRT);

    gpgpu.pingPong = writeIdx;

    // --- Update render material uniforms ---
    gpgpu.renderMaterial.uniforms.uPositions.value =
      gpgpu.posFBO[writeIdx].texture;
    gpgpu.renderMaterial.uniforms.uTime.value = elapsed;

    // --- Opacity fade in/out ---
    if (s.phase === "active") {
      s.elapsed += dt;
      // Fade in over first 0.5s
      const fadeIn = Math.min(1, s.elapsed / 0.5);
      gpgpu.renderMaterial.uniforms.uOpacity.value = fadeIn;

      // After convergence time, start fading out
      if (s.elapsed >= duration) {
        s.phase = "converging";
        s.elapsed = 0;
      }
    }

    if (s.phase === "converging") {
      s.elapsed += dt;
      // Fade out over 0.5s
      const fadeOut = Math.max(0, 1 - s.elapsed / 0.5);
      gpgpu.renderMaterial.uniforms.uOpacity.value = fadeOut;

      if (s.elapsed >= 0.5) {
        s.phase = "idle";
        gpgpu.initialized = false;
        if (pointsRef.current) pointsRef.current.visible = false;

        // Re-show source model
        const group = sourceModel?.current;
        if (group) group.visible = true;

        onTransitionComplete?.();
      }
    }
  });

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------
  useEffect(() => {
    const s = stateRef.current;
    return () => {
      s.disposed = true;
      gpgpu.posFBO[0].dispose();
      gpgpu.posFBO[1].dispose();
      gpgpu.simMaterial.dispose();
      gpgpu.quadGeo.dispose();
      gpgpu.seedsTexture.dispose();
      gpgpu.targetsTexture.dispose();
      gpgpu.renderGeo.dispose();
      gpgpu.renderMaterial.dispose();
    };
  }, [gpgpu]);

  return (
    <points
      ref={pointsRef}
      visible={false}
      geometry={gpgpu.renderGeo}
      material={gpgpu.renderMaterial}
      frustumCulled={false}
    />
  );
}
