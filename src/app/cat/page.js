"use client";

import React, { Suspense, useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CleanCanvas from "@/components/CleanCanvas";

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

function AnimatedCat({ scale = 1, position = [0, -3, 0] }) {
  const groupRef = useRef();
  const gltf = useGLTF('/models/FR80Cat.glb');
  const { scene, animations } = gltf;
  const { actions } = useAnimations(animations, groupRef);
  const phaseRef = useRef('walk1');
  // Phases: walk1 (Image_9) -> turning -> walk2 (Image_4) -> turning_back -> run
  const turnProgressRef = useRef(0);
  const baseRotationY = Math.PI / 2;

  // Find all face meshes (Object_10 through Object_16) and their parents
  const faceMeshesRef = useRef([]);



  // Animation cycle:
  // Walk + Image_9 (2s) -> turn 45deg (0.5s) -> swap to Image_4 -> turn back (0.5s) -> Walk + Image_4 (2s) -> Run!
  useEffect(() => {
    const walk = actions['Walk'] || actions['walk'];
    const run = actions['Run!'] || actions['Run'] || actions['run'] || actions['run!'];

    if (!walk && !run) {
      return;
    }

    const timers = [];

    function startCycle() {
      Object.values(actions).forEach((a) => a?.stop());

      // Phase 1: Walk with Image_9 for 2s
      phaseRef.current = 'walk1';
      turnProgressRef.current = 0;
      if (walk) {
        walk.timeScale = 1;
        walk.reset().fadeIn(0.2).play();
        walk.setLoop(THREE.LoopRepeat);
      }

      timers.push(setTimeout(() => {
        // Phase 2: Turn away (0.5s)
        phaseRef.current = 'turning';
        turnProgressRef.current = 0;

        timers.push(setTimeout(() => {
          // Phase 2.5: Hold the look-back for 1s
          phaseRef.current = 'looking_back';

          timers.push(setTimeout(() => {
            // Phase 3: Swap face to Image_4, turn back (0.5s)
            phaseRef.current = 'turning_back';
            turnProgressRef.current = 0;

          timers.push(setTimeout(() => {
            // Phase 4: Walk with Image_4 for 2s
            phaseRef.current = 'walk2';

            timers.push(setTimeout(() => {
              // Phase 5: Run!
              phaseRef.current = 'run';
              if (walk) walk.fadeOut(0.2);
              if (run) {
                run.timeScale = 1;
                run.reset().fadeIn(0.2).play();
                run.setLoop(THREE.LoopRepeat);
              }

              timers.push(setTimeout(() => {
                startCycle();
              }, 3000));
            }, 2000));
          }, 500));
          }, 1000));
        }, 500));
      }, 2000));
    }

    startCycle();

    return () => {
      timers.forEach(clearTimeout);
      Object.values(actions).forEach((action) => action?.stop());
    };
  }, [actions]);

  // Hover bob, Y-axis turn, and face visibility
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Gentle bob
    groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.8) * 0.05;

    const phase = phaseRef.current;

    // Handle Y rotation for turn phases
    if (phase === 'turning') {
      turnProgressRef.current = Math.min(turnProgressRef.current + delta / 0.5, 1);
      const t = turnProgressRef.current;
      groupRef.current.rotation.y = baseRotationY + (Math.PI / -2) * t;
    } else if (phase === 'looking_back') {
      // Hold the turned position
      groupRef.current.rotation.y = baseRotationY + (Math.PI / -2);
    } else if (phase === 'turning_back') {
      // Smoothly turn back from 45 to 0
      turnProgressRef.current = Math.min(turnProgressRef.current + delta / 0.5, 1);
      const t = turnProgressRef.current;
      groupRef.current.rotation.y = baseRotationY + (Math.PI / -2) * (1 - t);
    } else {
      groupRef.current.rotation.y = baseRotationY;
    }

   


  });

  return (
    <group ref={groupRef} position={position} scale={scale} rotation={[0, 0, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export default function CatPage() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* GIF Background */}
     

      {/* 3D Canvas */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}>
        <CleanCanvas
          camera={{ position: [-9, 1, 5], fov: 50 }}
          gl={{ alpha: true }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <directionalLight position={[-3, 3, -3]} intensity={0.4} />
          <Suspense fallback={null}>
            <AnimatedCat />
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={2}
            maxDistance={10}
            target={[0, 0, 0]}
          />
        </CleanCanvas>
      </div>
    </div>
  );
}

useGLTF.preload('/models/FR80Cat.glb');
