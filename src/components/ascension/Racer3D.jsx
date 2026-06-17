"use client";
// Real-character racer: loads the GLB, drives an AnimationMixer, and crossfades
// to the clip mapped from the engine's `racer.state`. Position lerps toward the
// racer's step on the flat track. Character + clip names come from
// RACER_VISUALS, so swapping in the themed cast later is a config edit.
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { stepWorld, RACER_VISUALS, DRACO_PATH } from "@/game/ascension/config";

// States whose clip should play once and hold on the last frame.
const ONE_SHOT = new Set(["falling", "rising", "celebrating"]);
const FADE = 0.25;

export default function Racer3D({ racer }) {
  const vis = RACER_VISUALS[racer.id] || {};
  const group = useRef(null);
  const { scene, animations } = useGLTF(vis.model, DRACO_PATH);
  const { actions } = useAnimations(animations, group);
  const init = useRef(stepWorld(racer.step, racer.lane));

  // Crossfade to the clip for the current state.
  useEffect(() => {
    if (!actions) return;
    const clips = vis.clips || {};
    const name = clips[racer.state] || clips.idle;
    const next = name ? actions[name] : null;
    if (!next) return;
    Object.values(actions).forEach((a) => {
      if (a && a !== next) a.fadeOut(FADE);
    });
    const once = ONE_SHOT.has(racer.state);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat);
    next.clampWhenFinished = once;
    next.fadeIn(FADE).play();
  }, [racer.state, actions, vis]);

  // Lerp forward to the racer's step (flat track: only X/Z move).
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const [tx, , tz] = stepWorld(racer.step, racer.lane);
    const k = 1 - Math.pow(0.0015, dt);
    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;
  });

  return (
    <group
      ref={group}
      position={[init.current[0], vis.yOffset ?? 0, init.current[2]]}
      rotation={[0, vis.facing ?? 0, 0]}
      scale={vis.scale ?? 1}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(RACER_VISUALS.monk.model, DRACO_PATH);
useGLTF.preload(RACER_VISUALS.demon.model, DRACO_PATH);
