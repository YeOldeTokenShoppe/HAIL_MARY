"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { ADDON_SLOTS } from "@/components/PimpMyPumpPanel";

// ── Rogue Catalog ─────────────────────────────────────────────────────────────
export const ROGUE_CATALOG = [
  {
    id: "ufo",
    label: "FLYING SAUCER",
    model: "/models/ufo.glb",
    consequence: "delete_addon",
    description: "Siphons off some oil from the user's tank",
    scale: 0.15,
    movement: "ufo",
    flyHeight: 0.6,
  },
  {
    id: "blueDemon",
    label: "BLUE DEMON",
    model: "/models/blueDemon.glb",
    consequence: "delete_addon",
    description: "Devours a random add-on",
    scale: 0.05,
    animation: "CharacterArmature|Walk",
    walkSpeed: 0.25,
  },
  {
    id: "dinosaur",
    label: "T-REX",
    model: "/models/addons/t-rex.glb",
    consequence: "delete_addon",
    description: "Stomps in and devours a random add-on",
    scale: 0.15,
    // Ground rogue (no `movement` field → walks the corridors). The T-Rex GLB
    // only ships Idle/Walk/Attack clips, so remap the ground rogue's default
    // Run/Weapon keywords onto what this model actually has.
    animation: "Walk",
    walkSpeed: 0.3,
    anims: { idle: "Idle", run: "Walk", weapon: "Attack" },
  },
  {
    id: "crudingo",
    label: "CRUDINGO",
    model: "/models/Crudingo.glb",
    consequence: "poop",
    description: "Leaves poop in your yard",
    scale: 0.05,
    movement: "fly",
    flyHeight: 0.5,
  },
];

// ── Auto-mark event as done via API ──────────────────────────────────────────
function markEventDone(eventId) {
  const pw = typeof localStorage !== "undefined"
    ? (localStorage.getItem("oil_admin_pw") || sessionStorage.getItem("oil_admin_pw"))
    : null;
  if (!pw || !eventId) return;
  fetch("/api/oil-rogue", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pw, eventId }),
  }).catch((err) => console.error("[Rogue] auto-done failed:", err));
}

// Walk speed in world units per second
const WALK_SPEED = 0.5;
// Pause phases at target (seconds)
const PAUSE_IDLE = 2;
const PAUSE_WEAPON = 3;
const PAUSE_TOTAL = PAUSE_IDLE + PAUSE_WEAPON;

// ── Falling poop drop ────────────────────────────────────────────────────────
// Poop landing offset — must match PlotPoop position in OilVoxelGrid
const POOP_OFFSET = { x: 0.35, z: 0.15 };

function PoopDrop({ position, flyHeight }) {
  const groupRef = useRef();
  const { scene } = useGLTF("/models/poop.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const tRef = useRef(0);
  const fallDuration = 0.5;
  const landX = position.x + POOP_OFFSET.x;
  const landZ = position.z + POOP_OFFSET.z;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    tRef.current = Math.min(tRef.current + delta, fallDuration);
    const f = tRef.current / fallDuration;
    const ease = f * f;
    const y = flyHeight * (1 - ease) + 0.05;
    groupRef.current.position.set(landX, y, landZ);
  });

  return (
    <group ref={groupRef} scale={[0.05, 0.05, 0.05]}>
      <primitive object={cloned} />
    </group>
  );
}

// ── Tractor beam (cone + spotlight for UFO) ─────────────────────────────────
// offsetX/offsetZ shift the beam toward the holding tank
function TractorBeam({ height, opacity }) {
  const beamRef = useRef();
  const lightRef = useRef();

  useFrame((_, delta) => {
    if (!beamRef.current) return;
    // Gentle pulsing
    const t = performance.now() * 0.003;
    const pulse = 0.6 + 0.4 * Math.sin(t);
    beamRef.current.material.opacity = opacity * pulse * 0.45;
    if (lightRef.current) lightRef.current.intensity = opacity * pulse * 4;
  });

  return (
    <group position={[0, 0.75, 0]}>
      {/* Cone beam */}
      <mesh ref={beamRef} position={[0, -height / 2, 0]}>
        <coneGeometry args={[0.9, height, 16, 1, true]} />
        <meshBasicMaterial
          color="#88ffcc"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Ground glow disc */}
      <mesh position={[0, -height + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial
          color="#66ffaa"
          transparent
          opacity={opacity * 0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Spotlight shining down */}
      <spotLight
        ref={lightRef}
        position={[0, 0, 0]}
        target-position={[0, -height, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={3}
        color="#88ffcc"
        distance={height + 1}
        decay={1.5}
      />
    </group>
  );
}

// ── Alien drop (step-sequence patrol) ─────────────────────────────────────────
const ALIEN_SCALE = 0.08;
const ALIEN_BEAM_UP_TIME = 1.2;
const TURN_DURATION = 0.4;
// Walk speed — tune to match visual stride of StartWalk/Walk2 animations
const ALIEN_WALK_SPEED = 0.025
// Initial heading so the alien faces the sign's security camera while it taunts.
// 90° clockwise (negative = clockwise about Y when viewed from above).
const ALIEN_FACE_HEADING = -Math.PI / 2;
// Beam-travel timing: the alien descends from the ship, then later ascends back.
// It materializes (fades in) on the way down and dissolves (fades out) on the way
// up, glowing the beam's energy color as it forms in / dissolves out.
const ALIEN_DESCEND_TIME = 1.1;
const ALIEN_MATERIALIZE_TIME = 0.9;
const ALIEN_DISSOLVE_COLOR = new THREE.Color("#88ffcc");
function buildAlienSequence() {
  return [
    // ── Descend from the ship along the beam ──
    { type: "descend" },
    // ── Intro anims ──

         { type: "anim", anim: "Idle", loops: 1 },
    // LookAround merges/cross-fades into ShakeFist — both loop and their weights
    // blend through a 50/50 middle (smoothstep) instead of playing as two beats.
    { type: "blend", from: "LookAround", to: "ShakeFist", loops: 2 },
                  // { type: "anim", anim: "taunt", loops: 1 },
                          // { type: "anim", anim: "Insult", loops: 1 },
    // { type: "anim", anim: "Booty", loops: 1 },
      // { type: "anim", anim: "Idle", loops: 0.2 },
        // { type: "anim", anim: "Waving", loops: 4 },
                        // { type: "anim", anim: "Idle", loops: 1 },
    // ── Outbound patrol ──
    // { type: "walk", anim: "StartWalk", loops: 1 },
    // { type: "walk", anim: "Walk2", loops: 1 },
    //    { type: "walk", anim: "Walk2", loops: 1 },
    //       { type: "walk", anim: "Walk2", loops: 1 },
    
    // { type: "turn", angle: -Math.PI / 2 },
    // // { type: "walk", anim: "StartWalk", loops: 1 },
    // { type: "walk", anim: "Walk2", loops: 1 },
    // { type: "turn", angle: -Math.PI / 2 },
    // // { type: "walk", anim: "StartWalk", loops: 1 },
    // { type: "walk", anim: "Walk2", loops: 1 },
    // { type: "turn", angle: Math.PI / 2 },
    // // ── Pause + Wave ──
    // { type: "anim", anim: "Idle", loops: 0.5 },
    // { type: "anim", anim: "Waving", loops: 3 },
    //   { type: "anim", anim: "Idle", loops: 0.5 },
    // // ── Return patrol (reverse) ──
    // { type: "turn", angle: Math.PI / 2 },
    // { type: "walk", anim: "StartWalk", loops: 1 },
    // { type: "walk", anim: "Walk2", loops: 1 },
    // { type: "turn", angle: Math.PI / 2 },
    // // { type: "walk", anim: "StartWalk", loops: 1 },
    // { type: "walk", anim: "Walk2", loops: 1 },
    // { type: "turn", angle: Math.PI / 2 },
    // // { type: "walk", anim: "StartWalk", loops: 1 },
    // { type: "walk", anim: "Walk2", loops: 1 },
    // ── Signal ready for beam-up (alien idles until UFO activates beam) ──
    { type: "ready" },
  ];
}

function AlienDrop({ landPos, ufoPos, beamUp, onReady, onGone }) {
  const groupRef = useRef();
  const stepIdxRef = useRef(0);
  const tRef = useRef(0);
  const stepInitRef = useRef(false);
  const [done, setDone] = useState(false);
  const readyFiredRef = useRef(false);
  const beamUpStartedRef = useRef(false);
  const appearRef = useRef(0);       // materialize-in accumulator (seconds)
  const beamProgressRef = useRef(0); // dissolve-out progress 0→1 during beam-up

  const headingRef = useRef(ALIEN_FACE_HEADING);
  const turnStartRef = useRef(0);
  const beamUpOriginRef = useRef(new THREE.Vector3());
  const beamUpRef = useRef(false);
  beamUpRef.current = beamUp; // mirror the latest prop for the frame loop to read

  const { scene, animations } = useGLTF("/models/alien2.glb");
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  // Clone the materials so we can fade opacity + add a beam glow per-instance
  // without mutating the shared cached GLTF. Drives the materialize/dissolve fx.
  const dissolveMats = useMemo(() => {
    const list = [];
    const prep = (m) => {
      const c = m.clone();
      c.transparent = true;
      const baseOpacity = c.opacity ?? 1;
      c.opacity = 0; // start fully dissolved; useFrame fades it in during descent
      list.push({
        mat: c,
        baseOpacity,
        baseEmissive: c.emissive ? c.emissive.clone() : null,
        baseEmissiveIntensity: c.emissiveIntensity ?? 1,
      });
      return c;
    };
    clonedScene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      o.material = Array.isArray(o.material) ? o.material.map(prep) : prep(o.material);
    });
    return list;
  }, [clonedScene]);

  // Strip position tracks from animation clips to prevent root motion sliding.
  // Keep position tracks for animations that need them (e.g. Samba hip movement).
  const KEEP_POSITION = ["Twerk", "Idle", "LookAround", "taunt", "Insult", "Booty", "Waving", "ShakeFist"];
  const cleanedAnims = useMemo(() => {
    return animations.map((clip) => {
      if (KEEP_POSITION.includes(clip.name)) return clip;
      const filtered = clip.tracks.filter(
        (track) => !track.name.endsWith(".position")
      );
      return new THREE.AnimationClip(clip.name, clip.duration, filtered);
    });
  }, [animations]);

  const { actions } = useAnimations(cleanedAnims, clonedScene);

  const sequence = useMemo(() => buildAlienSequence(), []);

  const clipDuration = (name) => {
    const a = actions[name];
    return a ? a.getClip().duration : 2.0;
  };

  const playAnim = (name, repeats = 1) => {
    const a = actions[name];
    if (!a) return;
    Object.values(actions).forEach((act) => act.fadeOut(0.3));
    if (repeats <= 1) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    } else {
      a.setLoop(THREE.LoopRepeat, Math.ceil(repeats));
      a.clampWhenFinished = false;
    }
    a.reset().fadeIn(0.3).play();
  };

  // Play two clips at once (looping), with their weights driven per-frame for a
  // merged cross-fade. Fades out every other action so only the pair blends.
  const playBlend = (fromName, toName) => {
    const a = actions[fromName];
    const b = actions[toName];
    Object.values(actions).forEach((act) => { if (act !== a && act !== b) act.fadeOut(0.3); });
    [a, b].forEach((act, i) => {
      if (!act) return;
      act.reset();
      act.setLoop(THREE.LoopRepeat, Infinity);
      act.clampWhenFinished = false;
      act.enabled = true;
      act.setEffectiveWeight(i === 0 ? 1 : 0); // start on `from`
      act.play();
    });
  };

  // Apply materialize/dissolve: opacity fade + beam-colored emissive glow.
  // vis: 1 = fully solid, 0 = fully dissolved into the beam.
  const applyVisibility = (vis) => {
    const diss = 1 - vis;
    for (const d of dissolveMats) {
      d.mat.opacity = d.baseOpacity * vis;
      if (d.baseEmissive) {
        d.mat.emissive.copy(d.baseEmissive).lerp(ALIEN_DISSOLVE_COLOR, diss);
        d.mat.emissiveIntensity = d.baseEmissiveIntensity + diss * 2.0;
      }
    }
  };

  useEffect(() => {
    if (actions["Idle"]) actions["Idle"].reset().fadeIn(0.2).play();
  }, [actions]);

  useFrame((_, delta) => {
    if (done || !groupRef.current) return;
    const g = groupRef.current;
    const idx = stepIdxRef.current;

    if (idx >= sequence.length) {
      // Shouldn't happen — sequence ends with "ready" which parks here
      return;
    }

    const step = sequence[idx];

    // Initialize step on first frame
    if (!stepInitRef.current) {
      stepInitRef.current = true;
      tRef.current = 0;

      if (step.type === "anim" || step.type === "walk") {
        playAnim(step.anim, step.loops || 1);
      } else if (step.type === "descend") {
        playAnim("Idle", 1);
      } else if (step.type === "blend") {
        playBlend(step.from, step.to);
      } else if (step.type === "turn") {
        turnStartRef.current = headingRef.current;
      } else if (step.type === "ready") {
        // Signal UFO that alien is ready for beam-up
        if (!readyFiredRef.current) {
          readyFiredRef.current = true;
          onReady?.();
        }
        playAnim("Idle", 1);
      }
    }

    tRef.current += delta;
    const t = tRef.current;

    const advanceStep = () => {
      stepIdxRef.current += 1;
      stepInitRef.current = false;
    };

    if (step.type === "descend") {
      // Float down the beam from the ship to the ground (ease-out = quick exit
      // from the saucer, gentle landing). Materializes in via applyVisibility.
      const f = Math.min(1, t / ALIEN_DESCEND_TIME);
      const ease = 1 - Math.pow(1 - f, 2);
      g.position.set(landPos.x, ufoPos.y + (0.02 - ufoPos.y) * ease, landPos.z);
      g.scale.setScalar(ALIEN_SCALE);
      if (f >= 1) {
        g.position.set(landPos.x, 0.02, landPos.z);
        advanceStep();
      }

    } else if (step.type === "anim") {
      const dur = clipDuration(step.anim) * (step.loops || 1);
      g.scale.setScalar(ALIEN_SCALE);
      if (t >= dur) advanceStep();

    } else if (step.type === "blend") {
      // Merge LookAround → ShakeFist: both loop, weights cross-fade through a
      // 50/50 blended middle (smoothstep) so the gestures combine, then hand off.
      const a = actions[step.from];
      const b = actions[step.to];
      const dur = Math.max(clipDuration(step.from), clipDuration(step.to)) * (step.loops || 2);
      const f = Math.min(1, t / dur);
      const w = f * f * (3 - 2 * f); // smoothstep
      if (a) a.setEffectiveWeight(1 - w);
      if (b) b.setEffectiveWeight(w);
      g.scale.setScalar(ALIEN_SCALE);
      if (t >= dur) advanceStep();

    } else if (step.type === "walk") {
      // Play walk animation + move group forward at constant speed
      const dur = clipDuration(step.anim) * (step.loops || 1);
      const dx = Math.sin(headingRef.current) * ALIEN_WALK_SPEED * delta;
      const dz = Math.cos(headingRef.current) * ALIEN_WALK_SPEED * delta;
      g.position.x += dx;
      g.position.z += dz;
      g.rotation.y = headingRef.current;
      g.scale.setScalar(ALIEN_SCALE);
      if (t >= dur) advanceStep();

    } else if (step.type === "turn") {
      const f = Math.min(1, t / TURN_DURATION);
      const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      g.rotation.y = turnStartRef.current + step.angle * ease;
      g.scale.setScalar(ALIEN_SCALE);
      if (f >= 1) {
        headingRef.current = turnStartRef.current + step.angle;
        g.rotation.y = headingRef.current;
        advanceStep();
      }

    } else if (step.type === "ready") {
      // Idle on the ground until the UFO beam activates
      g.scale.setScalar(ALIEN_SCALE);
      if (beamUpRef.current && !beamUpStartedRef.current) {
        beamUpStartedRef.current = true;
        g.getWorldPosition(beamUpOriginRef.current);
        tRef.current = 0;
      }
      if (beamUpStartedRef.current) {
        const f = Math.min(1, tRef.current / ALIEN_BEAM_UP_TIME);
        const ox = beamUpOriginRef.current.x;
        const oy = beamUpOriginRef.current.y;
        const oz = beamUpOriginRef.current.z;
        // Steady (linear) rise so the climb up the beam reads clearly...
        g.position.set(
          ox + (ufoPos.x - ox) * f,
          oy + (ufoPos.y - oy) * f,
          oz + (ufoPos.z - oz) * f
        );
        // ...then dissolve only across the top portion, so it dematerializes
        // into the ship instead of fading out near the ground.
        const diss = Math.max(0, (f - 0.55) / 0.45);
        g.scale.setScalar(ALIEN_SCALE * (1 - 0.45 * diss));
        g.rotation.y += delta * 4;
        beamProgressRef.current = diss;
        if (f >= 1) {
          setDone(true);
          onGone?.();
        }
      }
    }

    // ── Materialize-in, then dissolve-out: drive opacity + beam glow ──
    appearRef.current = Math.min(appearRef.current + delta, ALIEN_MATERIALIZE_TIME);
    const visIn = appearRef.current / ALIEN_MATERIALIZE_TIME;
    applyVisibility(Math.max(0, Math.min(1, visIn * (1 - beamProgressRef.current))));
  });

  if (done) return null;

  return (
    <group ref={groupRef} position={[landPos.x, ufoPos.y, landPos.z]} rotation={[0, ALIEN_FACE_HEADING, 0]} scale={[ALIEN_SCALE, ALIEN_SCALE, ALIEN_SCALE]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// ── UFO rogue (fly in → hover → beam → fly out) ─────────────────────────────
const UFO_FLY_SPEED = 1.2;
const UFO_HOVER_DURATION = 10.0;
const UFO_BEAM_FADEIN = 0.8;
const UFO_BEAM_HOLD = 7.5;
const UFO_BEAM_FADEOUT = 0.7;
const UFO_BEAM_TOTAL = UFO_BEAM_FADEIN + UFO_BEAM_HOLD + UFO_BEAM_FADEOUT;

function UfoRogueCharacter({ event, cellSize = 1, worldW, worldD, catalog, onArrive, onConsequence }) {
  const groupRef = useRef();
  const phaseRef = useRef("fly_in");
  const consequenceFiredRef = useRef(false);
  const arrivedRef = useRef(false);
  const tRef = useRef(0);
  const [done, setDone] = useState(false);
  const [beamOpacity, setBeamOpacity] = useState(0);
  const [alienDropped, setAlienDropped] = useState(false);
  const [alienReady, setAlienReady] = useState(false);
  const [alienGone, setAlienGone] = useState(false);
  const [beamingUp, setBeamingUp] = useState(false);

  const { scene, animations } = useGLTF(catalog.model);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clonedScene);

  const flyHeight = catalog.flyHeight || 1.8;

  // Target cell center
  const targetPos = useMemo(() => {
    const x = -worldW / 2 + event.targetCol * cellSize + cellSize / 2;
    const z = worldD / 2 - event.targetRow * cellSize - cellSize / 2;
    return new THREE.Vector3(x, 0, z);
  }, [event.targetCol, event.targetRow, cellSize, worldW, worldD]);

  // Spawn from far off-screen right, high up
  const spawnPos = useMemo(() => {
    return new THREE.Vector3(worldW / 2 + cellSize * 4, flyHeight + 2, targetPos.z - 2);
  }, [worldW, cellSize, flyHeight, targetPos]);

  // Hover directly above the holding tank (offset from cell center)
  const TANK_OFFSET_X = 0.25;
  const TANK_OFFSET_Z = 0.05;
  const hoverPos = useMemo(() => {
    return new THREE.Vector3(targetPos.x + TANK_OFFSET_X, flyHeight, targetPos.z + TANK_OFFSET_Z);
  }, [targetPos, flyHeight]);

  // Exit off-screen left
  const exitPos = useMemo(() => {
    return new THREE.Vector3(-worldW / 2 - cellSize * 4, flyHeight + 3, targetPos.z + 2);
  }, [worldW, cellSize, flyHeight, targetPos]);

  // Start any animations in the GLB
  useEffect(() => {
    const first = Object.values(actions)[0];
    if (first) first.reset().fadeIn(0.2).play();
  }, [actions]);

  const flyInDist = useMemo(() => spawnPos.distanceTo(hoverPos), [spawnPos, hoverPos]);
  const flyOutDist = useMemo(() => hoverPos.distanceTo(exitPos), [hoverPos, exitPos]);
  const flyInTime = flyInDist / UFO_FLY_SPEED;
  const flyOutTime = flyOutDist / UFO_FLY_SPEED;

  const spinRef = useRef(0);

  useFrame((_, delta) => {
    if (done || !groupRef.current) return;
    const g = groupRef.current;
    g.scale.setScalar(catalog.scale);
    tRef.current += delta;
    spinRef.current += delta * 1.8;
    const t = tRef.current;
    const phase = phaseRef.current;

    // Continuous y-axis spin in all phases
    g.rotation.y = spinRef.current;

    if (phase === "fly_in") {
      const f = Math.min(1, t / flyInTime);
      // Ease-out for a decelerating arrival
      const ease = 1 - Math.pow(1 - f, 2);
      g.position.lerpVectors(spawnPos, hoverPos, ease);
      if (f >= 1) {
        phaseRef.current = "hover";
        tRef.current = 0;
        if (!arrivedRef.current) { arrivedRef.current = true; onArrive?.(event); }
      }
    } else if (phase === "hover") {
      // Gentle hovering bob
      g.position.set(
        hoverPos.x + Math.sin(t * 0.8) * 0.03,
        hoverPos.y + Math.sin(t * 2) * 0.04,
        hoverPos.z + Math.cos(t * 0.8) * 0.03
      );
      if (t >= UFO_HOVER_DURATION * 0.3) {
        phaseRef.current = "beam_down";
        tRef.current = 0;
      }
    } else if (phase === "beam_down") {
      // Beam down — drop the alien
      g.position.set(
        hoverPos.x + Math.sin(t * 0.8) * 0.02,
        hoverPos.y + Math.sin(t * 2.5) * 0.03,
        hoverPos.z + Math.cos(t * 0.8) * 0.02
      );
      let bOpacity = 0;
      if (t < UFO_BEAM_FADEIN) {
        bOpacity = t / UFO_BEAM_FADEIN;
      } else if (t < UFO_BEAM_FADEIN + UFO_BEAM_HOLD) {
        bOpacity = 1;
        // Spawn alien partway through beam
        if (t > UFO_BEAM_FADEIN + 0.5 && !alienDropped) {
          setAlienDropped(true);
        }
        if (!consequenceFiredRef.current) {
          consequenceFiredRef.current = true;
          onConsequence?.(event);
        }
      } else if (t < UFO_BEAM_TOTAL) {
        bOpacity = 1 - (t - UFO_BEAM_FADEIN - UFO_BEAM_HOLD) / UFO_BEAM_FADEOUT;
      } else {
        bOpacity = 0;
        phaseRef.current = "wait_for_alien";
        tRef.current = 0;
      }
      setBeamOpacity(Math.max(0, Math.min(1, bOpacity)));
    } else if (phase === "wait_for_alien") {
      // Hover in place while alien does its thing
      g.position.set(
        hoverPos.x + Math.sin(t * 0.6) * 0.02,
        hoverPos.y + Math.sin(t * 2) * 0.03,
        hoverPos.z + Math.cos(t * 0.6) * 0.02
      );
      if (alienReady) {
        phaseRef.current = "beam_up";
        tRef.current = 0;
        setBeamingUp(true); // state-driven → the alien reliably receives beamUp=true
      }
    } else if (phase === "beam_up") {
      // Second beam to pull alien back up, then fly away
      g.position.set(
        hoverPos.x + Math.sin(t * 0.8) * 0.02,
        hoverPos.y + Math.sin(t * 2.5) * 0.03,
        hoverPos.z + Math.cos(t * 0.8) * 0.02
      );
      const beamUpDur = 1.5;
      let bOpacity = 0;
      if (t < 0.4) {
        bOpacity = t / 0.4;
      } else if (t < beamUpDur - 0.4) {
        bOpacity = 1;
      } else if (t < beamUpDur) {
        bOpacity = 1 - (t - (beamUpDur - 0.4)) / 0.4;
      } else {
        bOpacity = 0;
        phaseRef.current = "fly_out";
        tRef.current = 0;
      }
      setBeamOpacity(Math.max(0, Math.min(1, bOpacity)));
    } else if (phase === "fly_out") {
      const f = Math.min(1, t / flyOutTime);
      // Ease-in for accelerating departure
      const ease = f * f;
      g.position.lerpVectors(hoverPos, exitPos, ease);
      setBeamOpacity(0);
      if (f >= 1) {
        setDone(true);
        markEventDone(event.id);
      }
    }
  });

  // Alien lands at the hover position (under the UFO)
  const alienLandPos = useMemo(() => ({ x: hoverPos.x, z: hoverPos.z }), [hoverPos]);

  if (done) return null;

  return (
    <>
      <group ref={groupRef} scale={[catalog.scale, catalog.scale, catalog.scale]}>
        <primitive object={clonedScene} />
        {beamOpacity > 0 && <TractorBeam height={flyHeight * 8} opacity={beamOpacity} />}
      </group>
      {alienDropped && !alienGone && (
        <AlienDrop
          landPos={alienLandPos}
          ufoPos={hoverPos}
          beamUp={beamingUp}
          onReady={() => setAlienReady(true)}
          onGone={() => setAlienGone(true)}
        />
      )}
    </>
  );
}

// ── Flying rogue (Crudingo) ──────────────────────────────────────────────────
const FLY_SPEED = 1.5;
const SWOOP_DURATION = 1.2;
const CIRCLE_DURATION = 2.0;
const HOVER_DURATION = 2.0;
const CIRCLE_RADIUS = 0.6;

function FlyingRogueCharacter({ event, cellSize = 1, worldW, worldD, catalog, onArrive, onConsequence }) {
  const groupRef = useRef();
  const phaseRef = useRef("fly_in");
  const consequenceFiredRef = useRef(false);
  const tRef = useRef(0);
  const arrivedRef = useRef(false);
  const [done, setDone] = useState(false);
  const [poopDropped, setPoopDropped] = useState(false);

  const { scene, animations } = useGLTF(catalog.model);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clonedScene);

  const flyHeight = catalog.flyHeight || 2.0;

  // Target cell center
  const targetPos = useMemo(() => {
    const x = -worldW / 2 + event.targetCol * cellSize + cellSize / 2;
    const z = worldD / 2 - event.targetRow * cellSize - cellSize / 2;
    return new THREE.Vector3(x, 0, z);
  }, [event.targetCol, event.targetRow, cellSize, worldW, worldD]);

  // Spawn and exit positions
  const spawnPos = useMemo(() => {
    return new THREE.Vector3(-worldW / 2 - cellSize * 2, flyHeight, targetPos.z + 1);
  }, [worldW, cellSize, flyHeight, targetPos]);

  const exitPos = useMemo(() => {
    return new THREE.Vector3(worldW / 2 + cellSize * 2, flyHeight + 1, targetPos.z - 1);
  }, [worldW, cellSize, flyHeight, targetPos]);

  const hoverPos = useMemo(() => {
    return new THREE.Vector3(targetPos.x, flyHeight, targetPos.z);
  }, [targetPos, flyHeight]);

  // Start first animation
  useEffect(() => {
    const first = Object.values(actions)[0];
    if (first) first.reset().fadeIn(0.2).play();
  }, [actions]);

  // Phase distances / durations
  const flyInDist = useMemo(() => spawnPos.distanceTo(hoverPos), [spawnPos, hoverPos]);
  const flyOutDist = useMemo(() => hoverPos.distanceTo(exitPos), [hoverPos, exitPos]);
  const flyInTime = flyInDist / FLY_SPEED;
  const flyOutTime = flyOutDist / FLY_SPEED;

  useFrame((_, delta) => {
    if (done || !groupRef.current) return;
    const g = groupRef.current;
    g.scale.setScalar(catalog.scale);
    tRef.current += delta;
    const t = tRef.current;

    const phase = phaseRef.current;

    // Swoop altitude — low enough to be visible on CCTV
    const swoopAlt = flyHeight * 0.35;
    const dropAlt = flyHeight * 0.25;

    if (phase === "fly_in") {
      const f = Math.min(1, t / flyInTime);
      g.position.lerpVectors(spawnPos, hoverPos, f);
      const dir = hoverPos.clone().sub(spawnPos);
      g.rotation.y = Math.atan2(dir.x, dir.z);
      if (f >= 1) {
        phaseRef.current = "swoop";
        tRef.current = 0;
        if (!arrivedRef.current) { arrivedRef.current = true; onArrive?.(event); }
      }
    } else if (phase === "swoop") {
      // Swoop down from flyHeight to swoopAlt with easing
      const f = Math.min(1, t / SWOOP_DURATION);
      const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      g.position.set(hoverPos.x, flyHeight - (flyHeight - swoopAlt) * ease, hoverPos.z);
      g.rotation.y = Math.PI;
      if (f >= 1) {
        phaseRef.current = "circle";
        tRef.current = 0;
      }
    } else if (phase === "circle") {
      // Circle at low altitude
      const f = Math.min(1, t / CIRCLE_DURATION);
      const angle = f * Math.PI * 2;
      g.position.set(
        hoverPos.x + Math.sin(angle) * CIRCLE_RADIUS,
        swoopAlt + Math.sin(f * Math.PI) * 0.08,
        hoverPos.z + Math.cos(angle) * CIRCLE_RADIUS
      );
      g.rotation.y = angle + Math.PI / 2;
      if (f >= 1) {
        phaseRef.current = "hover";
        tRef.current = 0;
      }
    } else if (phase === "hover") {
      // Hover in place at low altitude, gentle bob
      const f = Math.min(1, t / HOVER_DURATION);
      g.position.set(hoverPos.x, swoopAlt + Math.sin(t * 3) * 0.02, hoverPos.z);
      g.rotation.y = Math.PI;
      if (f >= 1) {
        phaseRef.current = "drop";
        tRef.current = 0;
        setPoopDropped(true);
        if (!consequenceFiredRef.current) { consequenceFiredRef.current = true; onConsequence?.(event); }
      }
    } else if (phase === "drop") {
      // Quick dip to drop altitude then hold
      const f = Math.min(1, t / 0.3);
      g.position.set(hoverPos.x, swoopAlt - (swoopAlt - dropAlt) * f, hoverPos.z);
      g.position.y += Math.sin(t * 4) * 0.02;
      if (t >= 0.8) {
        phaseRef.current = "fly_out";
        tRef.current = 0;
      }
    } else if (phase === "fly_out") {
      const f = Math.min(1, t / flyOutTime);
      g.position.lerpVectors(hoverPos, exitPos, f);
      const dir = exitPos.clone().sub(hoverPos);
      g.rotation.y = Math.atan2(dir.x, dir.z);
      if (f >= 1) {
        setDone(true);
        markEventDone(event.id);
      }
    }
  });

  if (done) return null;

  return (
    <>
      <group ref={groupRef} scale={[catalog.scale, catalog.scale, catalog.scale]}>
        <primitive object={clonedScene} />
      </group>
      {poopDropped && <PoopDrop position={targetPos} flyHeight={flyHeight * 0.25} />}
    </>
  );
}

// ── Ground-walking rogue (default) ───────────────────────────────────────────
function GroundRogueCharacter({ event, cellSize = 1, worldW, worldD, onArrive, onConsequence }) {
  const groupRef = useRef();
  const timeRef = useRef(0);
  const startedRef = useRef(false);
  const arrivedRef = useRef(false);
  const consequenceFiredRef = useRef(false);
  const phaseRef = useRef("walk_in");
  const [done, setDone] = useState(false);

  const catalog = useMemo(
    () => ROGUE_CATALOG.find((c) => c.id === event.characterType) || ROGUE_CATALOG[0],
    [event.characterType]
  );

  const { scene, animations } = useGLTF(catalog.model);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clonedScene);

  const rootBone = useMemo(() => {
    let bone = null;
    clonedScene.traverse((child) => {
      if (!bone && child.type === "Bone" && child.name === "Root") bone = child;
    });
    return bone;
  }, [clonedScene]);

  // Convert intersection (ix, iy) to world position
  // Intersection (0,0) = top-left corner of cell (0,0)
  // = (-worldW/2, 0, worldD/2)
  const intersectionToWorld = (ix, iy) => {
    const x = -worldW / 2 + ix * cellSize;
    const z = worldD / 2 - iy * cellSize;
    return new THREE.Vector3(x, 0, z);
  };

  // Convert cell (col, row) to world position (cell center)
  const cellToWorld = (col, row) => {
    const x = -worldW / 2 + col * cellSize + cellSize / 2;
    const z = worldD / 2 - row * cellSize - cellSize / 2;
    return new THREE.Vector3(x, 0, z);
  };

  // Build world-space waypoints from the path
  const routeData = useMemo(() => {
    const path = event.path;

    // Fallback for legacy events without path
    if (!path || path.length === 0) {
      const target = cellToWorld(event.targetCol, event.targetRow);
      const spawnX = -worldW / 2 - cellSize;
      const exitX = worldW / 2 + cellSize;
      return {
        waypoints: [
          new THREE.Vector3(spawnX, 0, target.z),
          target,
          new THREE.Vector3(exitX, 0, target.z),
        ],
        targetWpIdx: 1,
        addonOffset: new THREE.Vector3(0, 0, 0),
      };
    }

    // Convert path nodes to world positions
    // The "cell" node is skipped as a waypoint — the rogue pauses at the
    // arrival corner (the intersection before the cell) and steps into the
    // cell only during the weapon phase. This avoids clipping through the rig.
    const wps = [];
    let targetWpIdx = -1;

    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      if (node.type === "cell") {
        // Don't add a waypoint for the cell center — the rogue pauses at
        // the previous intersection (arrival corner) and steps toward the
        // addon from there during the weapon phase.
        // Mark the PREVIOUS waypoint as the target (arrival corner).
        targetWpIdx = wps.length - 1;
      } else if (node.type === "intersection") {
        wps.push(intersectionToWorld(node.ix, node.iy));
      } else {
        wps.push(cellToWorld(node.c ?? 0, node.r ?? 0));
      }
    }

    if (targetWpIdx === -1) {
      console.warn("[Rogue] No cell node found in path, using midpoint fallback");
      targetWpIdx = Math.floor(wps.length / 2);
    }

    // Add entry point: extend off-grid from the first waypoint
    // First waypoint is a border intersection — find which border and push outward
    const firstNode = path[0];
    const firstWp = wps[0];
    const entryPt = firstWp.clone();
    const gridNodes = worldW / cellSize + 1;

    if (firstNode.type === "intersection") {
      const ix = firstNode.ix;
      const iy = firstNode.iy;
      if (ix === 0) entryPt.x -= cellSize * 1.2;
      else if (ix === gridNodes - 1) entryPt.x += cellSize * 1.2;
      else if (iy === 0) entryPt.z += cellSize * 1.2;
      else if (iy === gridNodes - 1) entryPt.z -= cellSize * 1.2;
      else entryPt.x -= cellSize * 1.2; // fallback
    } else {
      entryPt.x -= cellSize * 1.2;
    }

    // Add exit point: extend off-grid from the last waypoint
    const lastNode = path[path.length - 1];
    const lastWp = wps[wps.length - 1];
    const exitPt = lastWp.clone();

    if (lastNode.type === "intersection") {
      const ix = lastNode.ix;
      const iy = lastNode.iy;
      if (ix === 0) exitPt.x -= cellSize * 1.2;
      else if (ix === gridNodes - 1) exitPt.x += cellSize * 1.2;
      else if (iy === 0) exitPt.z += cellSize * 1.2;
      else if (iy === gridNodes - 1) exitPt.z -= cellSize * 1.2;
      else exitPt.x += cellSize * 1.2;
    } else {
      exitPt.x += cellSize * 1.2;
    }

    const allWps = [entryPt, ...wps, exitPt];
    const adjustedTarget = targetWpIdx + 1; // +1 for prepended entry

    // Compute the addon world position for the weapon step-forward
    let addonOffset = new THREE.Vector3(0, 0, 0);
    const slotRaw = event.addonSlot;
    if (slotRaw != null) {
      const slotNum = parseInt(String(slotRaw).replace("slot", ""), 10);
      if (!isNaN(slotNum) && ADDON_SLOTS[slotNum]) {
        const s = ADDON_SLOTS[slotNum];
        addonOffset = new THREE.Vector3(s.x, 0, s.z);
      }
    }
    const cellCenter = cellToWorld(event.targetCol, event.targetRow);
    const addonWorldPos = cellCenter.clone().add(addonOffset);

    return { waypoints: allWps, targetWpIdx: adjustedTarget, addonWorldPos };
  }, [event.path, event.targetCol, event.targetRow, event.addonSlot, cellSize, worldW, worldD]);

  const { waypoints, targetWpIdx, addonWorldPos } = routeData;

  // Precompute segment times with pause baked in after arrival at target
  // Use per-character walkSpeed for approach, default WALK_SPEED for walk-out
  const approachSpeed = catalog.walkSpeed || WALK_SPEED;
  const { segTimes, cumTime, totalTime } = useMemo(() => {
    const sTimes = [];
    const cTime = [];
    let acc = 0;
    let pastTarget = false;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const dist = waypoints[i + 1].distanceTo(waypoints[i]);
      const speed = pastTarget ? WALK_SPEED : approachSpeed;
      const t = dist / speed;
      sTimes.push(t);
      acc += t;
      // Insert pause after arriving at target waypoint
      if (i + 1 === targetWpIdx) {
        acc += PAUSE_TOTAL;
        pastTarget = true;
      }
      cTime.push(acc);
    }

    return { segTimes: sTimes, cumTime: cTime, totalTime: acc };
  }, [waypoints, targetWpIdx, approachSpeed]);

  // Helper: find an animation by keyword (fuzzy match on clip name)
  const findAnim = (keyword) => {
    // Exact match first
    if (actions[keyword]) return actions[keyword];
    // Case-insensitive partial match
    const lc = keyword.toLowerCase();
    const key = Object.keys(actions).find((k) => k.toLowerCase().includes(lc));
    return key ? actions[key] : null;
  };

  // Helper: crossfade to an animation by keyword
  const playAnim = (keyword) => {
    const a = findAnim(keyword);
    if (!a) {
      console.warn(`[Rogue] Animation "${keyword}" not found. Available:`, Object.keys(actions));
      return;
    }
    Object.values(actions).forEach((act) => act.fadeOut(0.3));
    a.reset().fadeIn(0.3).play();
  };

  useFrame((_, delta) => {
    if (done || !groupRef.current) return;
    const g = groupRef.current;

    if (!startedRef.current) {
      startedRef.current = true;
      timeRef.current = 0;
      phaseRef.current = "walk_in";
      const clipName = catalog.animation;
      let action = clipName ? actions[clipName] : null;
      if (!action && clipName) {
        const key = Object.keys(actions).find((k) =>
          k.toLowerCase().endsWith(clipName.toLowerCase())
        );
        action = key ? actions[key] : null;
      }
      if (!action) action = Object.values(actions)[0];
      if (action) action.reset().fadeIn(0.2).play();
    }

    timeRef.current += delta;
    const t = timeRef.current;

    g.scale.setScalar(catalog.scale);
    if (rootBone) rootBone.position.set(0, 0, 0);

    if (t >= totalTime) {
      setDone(true);
      markEventDone(event.id);
      return;
    }

    // Find which segment we're in
    let segIdx = 0;
    for (let i = 0; i < cumTime.length; i++) {
      if (t < cumTime[i]) { segIdx = i; break; }
      if (i === cumTime.length - 1) segIdx = i;
    }

    const segStart = segIdx > 0 ? cumTime[segIdx - 1] : 0;
    const localT = t - segStart;
    const walkTime = segTimes[segIdx];
    const isTargetArrivalSeg = (segIdx + 1 === targetWpIdx);

    // Check if we're in the pause window
    if (isTargetArrivalSeg && localT >= walkTime) {
      const pauseT = localT - walkTime;
      const standoffPos = waypoints[targetWpIdx]; // near the addon, not cell center

      // Face the addon from standoff
      const toAddon = addonWorldPos.clone().sub(standoffPos);
      if (toAddon.lengthSq() > 0.001) {
        g.rotation.y = Math.atan2(toAddon.x, toAddon.z);
      }

      if (pauseT < PAUSE_IDLE) {
        // Idle phase: stand at standoff, considering the target
        if (phaseRef.current !== "idle") {
          phaseRef.current = "idle";
          playAnim(catalog.anims?.idle || "Idle");
          if (!arrivedRef.current) { arrivedRef.current = true; onArrive?.(event); }
        }
        g.position.copy(standoffPos);
      } else {
        // Weapon phase: step forward to the addon and attack
        if (phaseRef.current !== "weapon") {
          phaseRef.current = "weapon";
          playAnim(catalog.anims?.weapon || "Weapon");
          if (!consequenceFiredRef.current) { consequenceFiredRef.current = true; onConsequence?.(event); }
        }
        // Lerp from standoff toward addon (stop at 80% to not overshoot)
        const weaponT = pauseT - PAUSE_IDLE;
        const stepF = Math.min(0.8, (weaponT / 0.8) * 0.8);
        g.position.lerpVectors(standoffPos, addonWorldPos, stepF);
      }
      return;
    }

    // Normal walking
    if (segIdx + 1 > targetWpIdx && phaseRef.current !== "walk_out") {
      phaseRef.current = "walk_out";
      playAnim(catalog.anims?.run || "Run");
    }

    const f = Math.min(1, localT / walkTime);
    const from = waypoints[segIdx];
    const to = waypoints[segIdx + 1];
    g.position.lerpVectors(from, to, f);

    const dir = to.clone().sub(from);
    if (dir.lengthSq() > 0.001) {
      g.rotation.y = Math.atan2(dir.x, dir.z);
    }
  });

  if (done) return null;

  return (
    <group ref={groupRef} scale={[catalog.scale, catalog.scale, catalog.scale]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Max rogue lifecycle ~30s (walk in + pause + walk out). Skip stale events.
const ROGUE_MAX_AGE_MS = 45000;

// ── Router: pick flying vs ground rogue ──────────────────────────────────────
function RogueCharacter(props) {
  const catalog = useMemo(
    () => ROGUE_CATALOG.find((c) => c.id === props.event.characterType) || ROGUE_CATALOG[0],
    [props.event.characterType]
  );

  // Skip events that were already stale when this rogue first mounted — but
  // decide ONCE. Re-checking every render would unmount an actively-playing
  // rogue mid-animation (e.g. right as the alien beams back up).
  const staleRef = useRef(undefined);
  if (staleRef.current === undefined) {
    const createdAt = props.event.createdAt?.toMillis?.() ?? props.event.createdAt?.seconds * 1000;
    staleRef.current = !!(createdAt && Date.now() - createdAt > ROGUE_MAX_AGE_MS);
  }
  if (staleRef.current) return null;

  if (catalog.movement === "ufo") {
    return <UfoRogueCharacter {...props} catalog={catalog} onArrive={props.onArrive} onConsequence={props.onConsequence} />;
  }
  if (catalog.movement === "fly") {
    return <FlyingRogueCharacter {...props} catalog={catalog} onArrive={props.onArrive} onConsequence={props.onConsequence} />;
  }
  return <GroundRogueCharacter {...props} onArrive={props.onArrive} onConsequence={props.onConsequence} />;
}

export default RogueCharacter;
