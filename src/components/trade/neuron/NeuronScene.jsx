"use client";
// The Neural Cathedral scene — R3F port of Techartist's "Bioelectric
// consciousness engine" (MIT; see LICENSE-neuron.txt and neuronShaders.js).
//
// Mounts inside a host Canvas (no Canvas of its own), like TalkShowScene.
//
// WHAT CHANGED FROM THE PEN, AND WHY. The shaders are verbatim; every change is
// on the JS side, and the first three are the mobile fixes:
//
//  1. SOMA TESSELLATION. IcosahedronGeometry(r, 32) is 21,780 triangles — 37%
//     of the original frame's geometry — for one glowing blob that is noise
//     displaced and additively blended. detail 8 is 1,620 and looks the same.
//  2. NO DoubleSide ON THE SOMA. It's a closed sphere drawn with additive
//     blending, so DoubleSide shaded every pixel of it twice for a back face
//     that only ever added a uniform haze. Mobile GPUs are tile-based and
//     transparent overdraw is their worst case.
//  3. HALF-RES BLOOM, FEWER MIPS — applied by the host (MobileNeuron), since
//     the composer lives there.
//  4. SEEDED GEOMETRY. The pen calls Math.random() while building, so the
//     neuron was a different shape on every load and every remount. A seeded
//     PRNG makes the Cathedral a place rather than a new growth each visit.
//  5. NO WINDOW GLOBALS. The pen sized to window.innerWidth, appended to
//     document.body, and bound `pointerdown` ON WINDOW — which inside a panel
//     would fire on every tap in the app, including the tuner's own controls.
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import {
  somaVertex,
  somaFragment,
  branchVertex,
  branchFragment,
  synapseVertex,
  synapseFragment,
} from "./neuronShaders";

export const NEURON_CONFIG = {
  somaRadius: 4.0,
  dendriteTrees: 14,
  axonTrees: 4,
  maxDistDendrite: 35.0,
  maxDistAxon: 50.0,
  // Fix 1: 32 -> 8. See the header note.
  somaDetail: 8,
  coreDetail: 6,
  dustCount: 800,
  colors: {
    cyan: "#00e5ff",
    blue: "#0033aa",
    gold: "#ffaa00",
    orange: "#ff4400",
    magenta: "#ff0066",
    violet: "#6600ff",
  },
};

// Phase timings from the pen's animate(): 1 dendrite inflow, 2 soma merge,
// 3 axon outflow, 4 refractory. 0 = resting.
const PHASE_SPEED = { 1: 0.8, 2: 2.5, 3: 0.95, 4: 0.5 };

// Mulberry32 — tiny, seeded, good enough for scattering branches.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build every tube + synapse position once, deterministically.
function buildNetwork(seed) {
  const rng = makeRng(seed);
  const branches = [];
  const synapses = [];
  const { somaRadius, dendriteTrees, axonTrees } = NEURON_CONFIG;

  const buildBranch = (startPt, dir, length, radius, level, maxLevels, isAxon) => {
    const segments = 12;
    const points = [startPt.clone()];
    const cur = startPt.clone();
    const cDir = dir.clone();

    for (let i = 0; i < segments; i++) {
      const curl = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5)
        .multiplyScalar(isAxon ? 0.3 : 0.8);
      cDir.add(curl).normalize();
      cur.add(cDir.clone().multiplyScalar(length / segments));
      points.push(cur.clone());
    }

    const curve = new THREE.CatmullRomCurve3(points);
    branches.push({
      geometry: new THREE.TubeGeometry(curve, segments * 2, radius, 6, false),
      isAxon,
    });

    if (level < maxLevels) {
      const childCount = isAxon ? (rng() > 0.3 ? 1 : 2) : (rng() > 0.2 ? 2 : 3);
      for (let j = 0; j < childCount; j++) {
        const splitDir = cDir.clone()
          .add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.8))
          .normalize();
        buildBranch(
          cur.clone(), splitDir,
          length * (0.6 + rng() * 0.3),
          radius * 0.65,
          level + 1, maxLevels, isAxon,
        );
      }
    } else {
      synapses.push(cur.x, cur.y, cur.z);
    }
  };

  for (let i = 0; i < dendriteTrees; i++) {
    const dir = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    if (dir.z > 0.3) dir.z -= 0.8;
    dir.normalize();
    buildBranch(dir.clone().multiplyScalar(somaRadius - 0.5), dir, 12 + rng() * 5, 0.4, 0, 2, false);
  }
  for (let i = 0; i < axonTrees; i++) {
    const dir = new THREE.Vector3((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, 1.0).normalize();
    buildBranch(dir.clone().multiplyScalar(somaRadius - 0.5), dir, 25 + rng() * 10, 0.6, 0, 2, true);
  }

  const synSizes = new Float32Array(synapses.length / 3);
  for (let i = 0; i < synSizes.length; i++) synSizes[i] = rng();

  const dust = new Float32Array(NEURON_CONFIG.dustCount * 3);
  for (let i = 0; i < dust.length; i++) dust[i] = (rng() - 0.5) * 150;

  // MERGE. The pen drew every tube as its own mesh — ~100-130 draw calls that
  // all shared one of two materials. Dendrites and axons differ only by which
  // material they take, so each set collapses to a single geometry and the
  // whole tree becomes 2 draws.
  //
  // Safe for these shaders specifically: the branch fragment shader keys off
  // vWorldPos and vUv. Merging bakes each tube's vertices into the shared
  // buffer at the same coordinates it already occupied (the meshes carried no
  // transform of their own), and TubeGeometry's per-tube UVs survive the merge
  // — so the distance-driven pulse and the axial flow both read identically.
  const collect = (isAxon) => {
    const parts = branches.filter((b) => b.isAxon === isAxon).map((b) => b.geometry);
    if (!parts.length) return null;
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    return merged;
  };

  return {
    dendriteGeo: collect(false),
    axonGeo: collect(true),
    branchCount: branches.length,
    synapses: new Float32Array(synapses),
    synSizes,
    dust,
  };
}

/**
 * `onState` is called each frame with the live readout the HUD renders. It's a
 * callback rather than React state on purpose — this updates every frame, and
 * re-rendering the tree 60x/second to move a text label would cost more than
 * the scene does.
 *
 * `fireRef` is the imperative trigger: the host sets `fireRef.current = true`
 * on tap and this consumes it. Same reasoning — a tap must not re-render the
 * scene tree.
 */
export default function NeuronScene({ seed = 20260801, onState, fireRef, onBloom }) {
  const net = useMemo(() => buildNetwork(seed), [seed]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uProgress: { value: 0 },
    uColCyan: { value: new THREE.Color(NEURON_CONFIG.colors.cyan) },
    uColBlue: { value: new THREE.Color(NEURON_CONFIG.colors.blue) },
    uColGold: { value: new THREE.Color(NEURON_CONFIG.colors.gold) },
    uColOrange: { value: new THREE.Color(NEURON_CONFIG.colors.orange) },
    uColMagenta: { value: new THREE.Color(NEURON_CONFIG.colors.magenta) },
    uColViolet: { value: new THREE.Color(NEURON_CONFIG.colors.violet) },
    uSomaRadius: { value: NEURON_CONFIG.somaRadius },
    uMaxDistDendrite: { value: NEURON_CONFIG.maxDistDendrite },
    uMaxDistAxon: { value: NEURON_CONFIG.maxDistAxon },
  }), []);

  const somaMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // Fix 2: was THREE.DoubleSide. See the header note.
    side: THREE.FrontSide,
    vertexShader: somaVertex,
    fragmentShader: somaFragment,
  }), [uniforms]);

  // Dendrites and axons differ only by uIsAxon, but they need SEPARATE uniform
  // objects for that flag while sharing every other uniform by reference — the
  // pen did this with a clone plus a re-assign loop.
  const [dendriteMaterial, axonMaterial] = useMemo(() => {
    const make = (isAxon) => new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uIsAxon: { value: isAxon } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: branchVertex,
      fragmentShader: branchFragment,
    });
    return [make(0), make(1)];
  }, [uniforms]);

  const synapseMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: synapseVertex,
    fragmentShader: synapseFragment,
  }), [uniforms]);

  const dustMaterial = useMemo(() => new THREE.PointsMaterial({
    color: new THREE.Color(NEURON_CONFIG.colors.cyan),
    size: 0.2,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const somaGeo = useMemo(
    () => new THREE.IcosahedronGeometry(NEURON_CONFIG.somaRadius, NEURON_CONFIG.somaDetail),
    [],
  );
  const coreGeo = useMemo(
    () => new THREE.IcosahedronGeometry(NEURON_CONFIG.somaRadius * 0.8, NEURON_CONFIG.coreDetail),
    [],
  );

  // R3F disposes what it renders, but these were built outside the tree.
  useEffect(() => () => {
    net.dendriteGeo?.dispose();
    net.axonGeo?.dispose();
    [somaMaterial, dendriteMaterial, axonMaterial, synapseMaterial, dustMaterial]
      .forEach((m) => m.dispose());
    somaGeo.dispose();
    coreGeo.dispose();
  }, [net, somaMaterial, dendriteMaterial, axonMaterial, synapseMaterial, dustMaterial, somaGeo, coreGeo]);

  const dustRef = useRef(null);
  const state = useRef({ phase: 0, progress: 0, membraneV: -70, axonLoad: 2, sync: 24, firing: false });

  useFrame((_, rawDelta) => {
    // A backgrounded tab hands back one enormous delta on return; clamping
    // stops that from teleporting the firing sequence through three phases.
    const delta = Math.min(rawDelta, 0.1);
    const s = state.current;
    uniforms.uTime.value += delta;

    if (fireRef?.current) {
      fireRef.current = false;
      if (!s.firing) { s.firing = true; s.phase = 1; s.progress = 0; }
    }

    if (dustRef.current) {
      dustRef.current.rotation.y = uniforms.uTime.value * 0.02;
      dustRef.current.rotation.x = Math.sin(uniforms.uTime.value * 0.01) * 0.05;
    }

    if (s.firing) {
      s.progress += delta * (PHASE_SPEED[s.phase] ?? 1);
      if (s.progress >= 1) {
        s.progress = 0;
        s.phase += 1;
        // The pen spiked bloom on the soma merge; the host owns the composer
        // now, so report it instead of reaching into the pass.
        if (s.phase === 2) onBloom?.(true);
        if (s.phase > 4) { s.phase = 0; s.firing = false; }
      }
    } else if (s.phase === 0) {
      onBloom?.(false);
    }

    uniforms.uPhase.value = s.phase;
    uniforms.uProgress.value = s.progress;

    // Readout easing, lifted from the pen's updateUI().
    const targets = {
      0: { mv: -70, axon: 2, sync: 24 + Math.sin(uniforms.uTime.value * 2) * 5, label: "RESTING", den: "CALM" },
      1: { mv: -55, axon: 2, sync: 45, label: "INCOMING STIMULUS", den: "ACTIVE LOAD" },
      2: { mv: 40, axon: 2, sync: 85, label: "SOMA MERGE", den: "CONVERGED" },
      3: { mv: 20, axon: 98, sync: 99, label: "AXON OUTFLOW", den: "CALM" },
      4: { mv: -80, axon: 15, sync: 15, label: "REFRACTORY PERIOD", den: "CALM" },
    }[s.phase];

    s.membraneV += (targets.mv - s.membraneV) * 0.15;
    s.axonLoad += (targets.axon - s.axonLoad) * 0.15;
    s.sync += (targets.sync - s.sync) * 0.15;

    onState?.({
      membraneV: s.membraneV,
      axonLoad: s.axonLoad,
      sync: s.sync,
      label: targets.label,
      dendrites: targets.den,
      phase: s.phase,
      firing: s.firing,
    });
  });

  return (
    <group>
      <mesh geometry={somaGeo} material={somaMaterial} />
      <mesh geometry={coreGeo}>
        <meshBasicMaterial
          color={NEURON_CONFIG.colors.cyan}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          wireframe
        />
      </mesh>

      {net.dendriteGeo && <mesh geometry={net.dendriteGeo} material={dendriteMaterial} />}
      {net.axonGeo && <mesh geometry={net.axonGeo} material={axonMaterial} />}

      <points material={synapseMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[net.synapses, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[net.synSizes, 1]} />
        </bufferGeometry>
      </points>

      <points ref={dustRef} material={dustMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[net.dust, 3]} />
        </bufferGeometry>
      </points>
    </group>
  );
}
