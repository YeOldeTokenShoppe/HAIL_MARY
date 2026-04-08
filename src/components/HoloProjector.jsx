import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

/* ────────────────────────────────────────────────────────────
   HoloProjector — particle hologram that cycles through phases:
     1-4  Sacred geometry attractors (the monk's divination)
     5    Terrain scan (extraction site topography)
     6    Our Lady of Perpetual Profit (HolographicStatue3-style mesh)
   ──────────────────────────────────────────────────────────── */

const PARTICLE_COUNT = 32000;
const HOLD_TIME = 7.0;       // seconds on each shape
const TRANSITION_TIME = 2.5; // seconds to morph between shapes
const HOLO_RADIUS = 0.65;    // display radius above the table
const HOLO_HEIGHT = 0.9;     // how tall the projection is
const LADY_PHASE = 5;        // index of the Our Lady phase
const TOTAL_PARTICLE_PHASES = 5; // 0-4 are particle phases (attractors + terrain)

/* ── Attractor generators ── */

function generateAethericCrown(count) {
  const positions = [];
  let x = 0.1, y = 0.1, z = 0.1;
  const a = 1.2, b = 2.1, c = 1.4, d = 1.5;
  for (let i = 0; i < count; i++) {
    const nx = Math.cos(a * y) + Math.sin(b * z) - Math.cos(c * x);
    const ny = Math.cos(d * z) + Math.sin(a * x) - Math.cos(b * y);
    const nz = Math.cos(c * x) + Math.sin(d * y) - Math.cos(a * z);
    x = nx; y = ny; z = nz;
    positions.push(x, y, z);
  }
  return normalizePositions(positions, count);
}

function generateThomasLabyrinth(count) {
  const positions = [];
  let x = 1.0, y = 0.0, z = 0.0;
  const b = 0.19, dt = 0.05;
  for (let i = 0; i < count; i++) {
    const dx = Math.sin(y) - b * x;
    const dy = Math.sin(z) - b * y;
    const dz = Math.sin(x) - b * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (isNaN(x) || Math.abs(x) > 1000) { x = 1; y = 0; z = 0; }
    positions.push(x, y, z);
  }
  return normalizePositions(positions, count);
}

function generateNoseHooverBraid(count) {
  const positions = [];
  let x = 1.0, y = 0.0, z = 0.0;
  const a = 0.2, dt = 0.01;
  for (let i = 0; i < count; i++) {
    const dx = y;
    const dy = -x + y * z;
    const dz = a - y * y;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (isNaN(x) || Math.abs(x) > 1000) { x = 1.0; y = 0.0; z = 0.0; }
    positions.push(x, y, z);
  }
  return normalizePositions(positions, count);
}

function generateFourWingButterfly(count) {
  const positions = [];
  let x = 1.0, y = 1.0, z = 1.0;
  const a = 0.2, b = 0.01, c = -0.4, dt = 0.05;
  for (let i = 0; i < count; i++) {
    const dx = a * x + y * z;
    const dy = b * x + c * y - x * z;
    const dz = -z - x * y;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (isNaN(x) || Math.abs(x) > 1000) { x = 1.0; y = 1.0; z = 1.0; }
    positions.push(x, y, z);
  }
  return normalizePositions(positions, count);
}

/* ── Terrain scan generator ── */
function generateTerrainScan(count) {
  const positions = [];
  const gridSize = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const col = i % gridSize;
    const row = Math.floor(i / gridSize);
    const nx = (col / gridSize) * 2 - 1;
    const nz = (row / gridSize) * 2 - 1;
    const dist = Math.sqrt(nx * nx + nz * nz);
    if (dist > 1.0) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 0.2;
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r;
      const py = fbmNoise(px * 2.5, pz * 2.5) * 0.4 - 0.3;
      positions.push(px, py, pz);
    } else {
      const height = fbmNoise(nx * 2.5, nz * 2.5) * 0.5 - 0.25;
      positions.push(nx, height, nz);
    }
  }
  const TERRAIN_SCALE = 2.0;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = positions[i * 3] * HOLO_RADIUS * TERRAIN_SCALE;
    arr[i * 3 + 1] = positions[i * 3 + 1] * HOLO_HEIGHT * TERRAIN_SCALE;
    arr[i * 3 + 2] = positions[i * 3 + 2] * HOLO_RADIUS * TERRAIN_SCALE;
  }
  return arr;
}

function fbmNoise(x, y) {
  let value = 0, amplitude = 0.5, frequency = 1.0;
  for (let o = 0; o < 4; o++) {
    value += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2d(ix, iy), n10 = hash2d(ix + 1, iy);
  const n01 = hash2d(ix, iy + 1), n11 = hash2d(ix + 1, iy + 1);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

function hash2d(x, y) {
  let h = x * 374761393 + y * 668265263 + 1274126177;
  h = (h ^ (h >> 13)) * 1103515245;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

/* ── Normalize attractor output to fit hologram volume ── */
function normalizePositions(rawPositions, count) {
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < count; i++) {
    cx += rawPositions[i * 3];
    cy += rawPositions[i * 3 + 1];
    cz += rawPositions[i * 3 + 2];
  }
  cx /= count; cy /= count; cz /= count;

  let maxDist = 0;
  for (let i = 0; i < count; i++) {
    const dx = rawPositions[i * 3] - cx;
    const dy = rawPositions[i * 3 + 1] - cy;
    const dz = rawPositions[i * 3 + 2] - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > maxDist) maxDist = d;
  }

  const scale = HOLO_RADIUS / (maxDist || 1);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (rawPositions[i * 3] - cx) * scale;
    arr[i * 3 + 1] = (rawPositions[i * 3 + 1] - cy) * scale;
    arr[i * 3 + 2] = (rawPositions[i * 3 + 2] - cz) * scale;
  }
  return arr;
}

/* ── Particle shader ── */
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uTransition;
  uniform float uPhaseIndex;
  attribute vec3 targetPosition;
  varying float vDist;
  varying float vLifeT;
  varying vec3 vWorldPos;

  void main() {
    vec3 pos = mix(position, targetPosition, uTransition);

    float drift = sin(uTime * 0.8 + pos.y * 4.0 + pos.x * 3.0) * 0.008;
    pos.x += drift;
    pos.z += cos(uTime * 0.6 + pos.z * 5.0) * 0.006;
    pos.y += sin(uTime * 0.3 + float(gl_VertexID) * 0.001) * 0.005;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = (2.8 / -mvPos.z) * (1.0 + sin(float(gl_VertexID) * 0.37) * 0.3);

    vDist = length(pos);
    vLifeT = float(gl_VertexID) / ${PARTICLE_COUNT.toFixed(1)};
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uTransition;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uOpacity;

  varying float vDist;
  varying float vLifeT;
  varying vec3 vWorldPos;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float d = length(center);
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.15, d);
    float scanLine = sin((vWorldPos.y - uTime * 0.15) * 45.0) * 0.5 + 0.5;
    scanLine = pow(scanLine, 3.0) * 0.35 + 0.65;

    float colorT = smoothstep(0.0, 0.6, vDist) * 0.7 + vLifeT * 0.3;
    vec3 color = mix(uColor1, uColor2, colorT);

    float flicker = 0.92 + 0.08 * sin(uTime * 12.0 + vLifeT * 6.0);
    float transitionGlow = 1.0 + uTransition * (1.0 - uTransition) * 2.0;

    alpha *= scanLine * flicker * uOpacity * transitionGlow;

    float core = smoothstep(0.3, 0.0, d) * 0.4;
    color += core;

    gl_FragColor = vec4(color, alpha);
  }
`;

/* ── Holographic shader for Our Lady (from HolographicStatue3) ── */
const holoStatueVertexShader = /* glsl */ `
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

const holoStatueFragmentShader = /* glsl */ `
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

/* ── Hologram beam cone shader — tapers and fades ── */
const beamVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vY;
  void main() {
    vUv = uv;
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beamFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uBeamOpacity;
  varying vec2 vUv;
  varying float vY;

  void main() {
    // Fade from bottom (bright) to top (transparent)
    float heightFade = 1.0 - smoothstep(0.0, 0.9, vUv.y);
    heightFade = pow(heightFade, 1.5);

    // Scan lines moving upward
    float scan = sin((vY - uTime * 0.4) * 60.0) * 0.5 + 0.5;
    scan = pow(scan, 4.0) * 0.3 + 0.7;

    // Edge fade (thinner at edges of the cone)
    float edgeFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
    edgeFade = pow(edgeFade, 0.5);

    float alpha = heightFade * scan * edgeFade * uBeamOpacity;

    gl_FragColor = vec4(uColor, alpha * 0.35);
  }
`;

/* ── Main component ── */
export default function HoloProjector({
  enabled = true,
}) {
  const pointsRef = useRef();
  const groupRef = useRef();
  const ladyGroupRef = useRef();
  const phaseRef = useRef(0);
  const timerRef = useRef(0);
  const transitioning = useRef(false);
  const targetsRef = useRef([]);
  const tableFoundRef = useRef(false);
  const ladyMaterialsRef = useRef([]);
  const ladyFadeRef = useRef({ current: 0, target: 0 });
  const tableScaleRef = useRef(1);

  const { scene: r3fScene } = useThree();

  // Load the Mary statue model
  const { scene: maryScene } = useGLTF("/models/CyberpunkMaryHeartRed2.glb");

  // Holographic material for Our Lady (same shader as HolographicStatue3)
  const holoStatueMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0x00ffff) },
          uFade: { value: 0 },
        },
        vertexShader: holoStatueVertexShader,
        fragmentShader: holoStatueFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Beam cone material
  const beamMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0x2299dd) },
          uBeamOpacity: { value: 1.0 },
        },
        vertexShader: beamVertexShader,
        fragmentShader: beamFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Find the Table mesh and position/scale the hologram above it
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

      const holoScale = tableRadius * 0.4;
      const scaleFactor = holoScale / HOLO_RADIUS;
      groupRef.current.scale.setScalar(scaleFactor);
      tableScaleRef.current = scaleFactor;

      tableFoundRef.current = true;
      return true;
    };

    if (!findTable()) {
      const interval = setInterval(() => {
        if (findTable()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [r3fScene]);

  // Set up the Our Lady statue mesh inside the hologram group
  useEffect(() => {
    if (!maryScene || !ladyGroupRef.current) return;

    // Clone the scene so we don't mutate the cached GLTF
    const ladyClone = maryScene.clone(true);

    // Center and scale to fit hologram volume
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

    // Apply holographic material to all meshes — uniform cyan
    const materials = [];
    ladyClone.traverse((child) => {
      if (child.isMesh) {
        const mat = holoStatueMaterial.clone();
        mat.uniforms.uTime = holoStatueMaterial.uniforms.uTime;
        mat.uniforms.uFade = holoStatueMaterial.uniforms.uFade;
        child.material = mat;
        materials.push(mat);
      }
    });
    ladyMaterialsRef.current = materials;

    ladyGroupRef.current.add(ladyClone);
    ladyGroupRef.current.visible = false;

    return () => {
      ladyGroupRef.current?.remove(ladyClone);
      ladyClone.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          child.material?.dispose();
        }
      });
    };
  }, [maryScene, holoStatueMaterial]);

  // Generate particle morph targets (no Lady phase — she's a mesh now)
  useEffect(() => {
    const targets = [
      generateAethericCrown(PARTICLE_COUNT),
      generateThomasLabyrinth(PARTICLE_COUNT),
      generateNoseHooverBraid(PARTICLE_COUNT),
      generateFourWingButterfly(PARTICLE_COUNT),
      generateTerrainScan(PARTICLE_COUNT),
    ];

    targetsRef.current = targets;

    if (pointsRef.current) {
      const geo = pointsRef.current.geometry;
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(targets[0]), 3));
      geo.setAttribute("targetPosition", new THREE.BufferAttribute(new Float32Array(targets[0]), 3));
    }
  }, []);

  // Particle shader material
  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uTransition: { value: 0 },
          uPhaseIndex: { value: 0 },
          uColor1: { value: new THREE.Color(0x00ffcc) },
          uColor2: { value: new THREE.Color(0x4488ff) },
          uOpacity: { value: 0.85 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    []
  );

  // Initial geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("targetPosition", new THREE.BufferAttribute(new Float32Array(pos), 3));
    return geo;
  }, []);

  // Animation loop
  useFrame((_, delta) => {
    if (!enabled || targetsRef.current.length === 0) return;
    const mat = shaderMaterial;
    const geo = pointsRef.current?.geometry;
    if (!geo) return;

    const time = (mat.uniforms.uTime.value += delta);
    timerRef.current += delta;

    // Shared time for beam and statue shaders
    beamMaterial.uniforms.uTime.value = time;
    holoStatueMaterial.uniforms.uTime.value -= delta;

    // Total phases = particle phases + lady phase
    const totalPhases = TOTAL_PARTICLE_PHASES + 1;
    const currentPhase = phaseRef.current;
    const isLadyPhase = currentPhase === LADY_PHASE;

    // Fade Our Lady in/out
    const fade = ladyFadeRef.current;
    if (Math.abs(fade.current - fade.target) > 0.001) {
      fade.current += (fade.target - fade.current) * Math.min(1, delta * 3);
      holoStatueMaterial.uniforms.uFade.value = fade.current;
      // Inverse: fade particles out when Lady is in
      mat.uniforms.uOpacity.value = 0.85 * (1 - fade.current);
    }
    if (ladyGroupRef.current) {
      ladyGroupRef.current.visible = fade.current > 0.01;
      ladyGroupRef.current.rotation.y += delta * 0.15;
    }

    if (!transitioning.current) {
      if (timerRef.current >= HOLD_TIME) {
        transitioning.current = true;
        timerRef.current = 0;
        const nextPhase = (currentPhase + 1) % totalPhases;

        if (nextPhase === LADY_PHASE) {
          // Transition TO Our Lady: fade in statue, fade out particles
          fade.target = 1;
        } else if (isLadyPhase) {
          // Transition FROM Our Lady: fade out statue, fade in particles
          fade.target = 0;
          // Set next particle target
          const targetAttr = geo.getAttribute("targetPosition");
          targetAttr.array.set(targetsRef.current[nextPhase]);
          targetAttr.needsUpdate = true;
        } else {
          // Normal particle-to-particle transition
          const targetAttr = geo.getAttribute("targetPosition");
          targetAttr.array.set(targetsRef.current[nextPhase]);
          targetAttr.needsUpdate = true;
        }

        mat.uniforms.uPhaseIndex.value = nextPhase;
      }
    } else {
      const t = Math.min(timerRef.current / TRANSITION_TIME, 1.0);
      const eased = t * t * (3 - 2 * t);

      if (currentPhase !== LADY_PHASE && (currentPhase + 1) % totalPhases !== LADY_PHASE) {
        // Normal particle morph
        mat.uniforms.uTransition.value = eased;
      }

      if (t >= 1.0) {
        // Transition complete
        if ((currentPhase + 1) % totalPhases !== LADY_PHASE && currentPhase !== LADY_PHASE) {
          const posAttr = geo.getAttribute("position");
          const targetAttr = geo.getAttribute("targetPosition");
          posAttr.array.set(targetAttr.array);
          posAttr.needsUpdate = true;
        } else if (currentPhase === LADY_PHASE) {
          // Coming back from Lady — snap particles to next shape
          const nextPhase = (currentPhase + 1) % totalPhases;
          const posAttr = geo.getAttribute("position");
          posAttr.array.set(targetsRef.current[nextPhase]);
          posAttr.needsUpdate = true;
        }

        mat.uniforms.uTransition.value = 0;
        transitioning.current = false;
        timerRef.current = 0;
        phaseRef.current = (currentPhase + 1) % totalPhases;
      }
    }

    // Slow rotation for particles
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.15;
    }
  });

  /* ── Tuning knobs ──
     CONE_Y:        vertical offset for cone (lower = closer to table)
     CONE_SCALE:    shrink/grow the cone
     SHAPES_Y:      vertical offset for all holo shapes (raise them up)
  */
  const CONE_Y = HOLO_HEIGHT * -0.4;
  const CONE_SCALE = 0.6;
  const SHAPES_Y = HOLO_HEIGHT * 0.3;
  const LADY_Y = -HOLO_HEIGHT * 0.3; // lower the statue relative to shapes group

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
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HOLO_RADIUS * 0.7, 32]} />
        <meshBasicMaterial
          color={0x00ffcc}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Shapes group — raised independently from cone */}
      <group position={[0, SHAPES_Y, 0]}>
        {/* The particle hologram */}
        <points ref={pointsRef} geometry={geometry} material={shaderMaterial} />

        {/* Our Lady holographic statue — LADY_Y adjusts height independently */}
        <group ref={ladyGroupRef} position={[0, LADY_Y, 0]} />
      </group>
    </group>
  );
}

useGLTF.preload("/models/CyberpunkMaryHeartRed2.glb");
