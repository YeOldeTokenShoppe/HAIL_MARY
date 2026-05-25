"use client";

import React, { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

function Planet() {
  const groupRef = useRef();
  const { scene, animations } = useGLTF("/models/Planet.glb");
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    const flagAnim = actions["KeyAction"];
    if (flagAnim) {
      flagAnim.reset().fadeIn(0.5).play();
      flagAnim.setLoop(THREE.LoopRepeat, Infinity);
    }
  }, [actions]);

  // useFrame((_, delta) => {
  //   if (groupRef.current) {
  //     groupRef.current.rotation.y += delta * 0.15;
  //   }
  // });

  return (
    <group ref={groupRef} scale={3.5}>
      <primitive object={scene} />
    </group>
  );
}

export default function PlanetViewer({ className }) {
  return (
    <div className={className} style={{ width: "100%", aspectRatio: "1" }}>
      <Canvas
        shadows
        camera={{ position: [0, 4, 6], fov: 65 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <spotLight
          castShadow
          intensity={2.25 * Math.PI}
          decay={0}
          angle={0.2}
          penumbra={1}
          position={[-25, 20, -15]}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />
        <ambientLight intensity={0.3} />
        <Planet />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate={true}
        />
      </Canvas>
    </div>
  );
}
