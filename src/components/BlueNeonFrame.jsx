"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

const MODEL_PATH = "/models/neonFrame.glb";
const DRACO_PATH = "/draco/gltf/";
const FRAME_GOLD = "#d4af37";

function FrameModel() {
  const { scene } = useGLTF(MODEL_PATH, DRACO_PATH);
  const framedScene = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((object) => {
      if (!object.isMesh || !object.material) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const isLegacyGlass =
        object.name.startsWith("Glass_Glass1_0") ||
        materials.some((material) => material.name.startsWith("Glass1"));
      const isBackdrop = object.name === "Oval";
      const isNeon =
        object.name.startsWith("Emissive_Emissive_Yellow_0") ||
        materials.some((material) => material.name.startsWith("Emissive_Yellow"));

      // The reimported Oval is the fitted backdrop. Retire the frame's older,
      // smaller glass pane so the two transparent surfaces do not stack.
      if (isLegacyGlass) {
        object.visible = false;
        return;
      }

      if (!isBackdrop && !isNeon) return;
      object.renderOrder = isBackdrop ? 0 : 2;

      const neonMaterial = (source) => {
        const material = source.clone();
        material.color?.set(FRAME_GOLD);
        material.emissive?.set(FRAME_GOLD);
        material.emissiveIntensity = 1.35;
        // Keep the tubing in the transparent queue with the oval so its
        // explicit renderOrder wins and the smoke can never tint it.
        material.transparent = true;
        material.opacity = 1;
        material.depthWrite = false;
        material.roughness = 0.42;
        material.needsUpdate = true;
        return material;
      };

      const hazeMaterial = (source) => {
        const material = source.clone();
        material.color?.set("#02050d");
        material.emissive?.set("#000000");
        material.emissiveIntensity = 0;
        material.transparent = true;
        material.opacity = 0.82;
        material.roughness = 0.88;
        material.metalness = 0;
        if ("transmission" in material) material.transmission = 0;
        material.depthWrite = false;
        material.needsUpdate = false;
        return material;
      };

      const styleMaterial = isBackdrop ? hazeMaterial : neonMaterial;
      object.material = Array.isArray(object.material)
        ? materials.map(styleMaterial)
        : styleMaterial(object.material);
    });

    return clone;
  }, [scene]);

  return (
    <Bounds fit clip observe margin={1.08}>
      <primitive object={framedScene} dispose={null} />
    </Bounds>
  );
}

export default function BlueNeonFrame({ active = true }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 721px)");
    const sync = () => setEnabled(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  if (!enabled || !active) return null;

  return (
    <div className="p2080-neon-frame" aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 10], fov: 34 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 4, 6]} intensity={0.8} color="#ffe7a3" />
        <Suspense fallback={null}>
          <FrameModel />
        </Suspense>
        <EffectComposer
          multisampling={0}
          enableNormalPass={false}
          stencilBuffer={false}
        >
          <Bloom
            intensity={0.85}
            luminanceThreshold={0.48}
            luminanceSmoothing={0.7}
            mipmapBlur
            levels={4}
            radius={0.85}
            resolutionScale={0.5}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
