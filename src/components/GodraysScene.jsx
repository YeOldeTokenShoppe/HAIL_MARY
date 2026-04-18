"use client";

import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Stats } from "@react-three/drei";
import {
  EffectComposer as PMEffectComposer,
  RenderPass,
} from "postprocessing";
import { GodraysPass } from "three-good-godrays";

/* ── Backdrop box (walls + ceiling) ── */
function Backdrop() {
  const d = 200;
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: 0x200808, side: THREE.DoubleSide }),
    []
  );
  const geo = useMemo(() => new THREE.PlaneGeometry(400, 200), []);

  return (
    <group>
      {/* left */}
      <mesh
        geometry={geo}
        material={mat}
        position={[-d, 100, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      {/* right */}
      <mesh
        geometry={geo}
        material={mat}
        position={[d, 100, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      {/* front */}
      <mesh geometry={geo} material={mat} position={[0, 100, -d]} />
      {/* back */}
      <mesh geometry={geo} material={mat} position={[0, 100, d]} />
      {/* top */}
      <mesh
        geometry={geo}
        material={mat}
        position={[0, 200, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[3, 6, 1]}
      />
    </group>
  );
}

/* ── GLTF model with shadow-casting materials ── */
function Model() {
  const { scene } = useGLTF("/models/godrays_demo.glb");

  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });

    const pillars = scene.getObjectByName("concrete");
    if (pillars) {
      pillars.material = new THREE.MeshStandardMaterial({ color: 0x333333 });
    }

    const base = scene.getObjectByName("base");
    if (base) {
      base.material = new THREE.MeshStandardMaterial({
        color: 0x333333,
        side: THREE.DoubleSide,
      });
    }
  }, [scene]);

  return <primitive object={scene} />;
}

/* ── Godrays post-processing (imperative — bypasses R3F EffectComposer) ── */
function GodraysEffect() {
  const { gl, scene, camera } = useThree();
  const composerRef = useRef(null);
  const lightRef = useRef(null);

  useEffect(() => {
    // Create the point light imperatively so we have a direct ref for GodraysPass
    const pointLight = new THREE.PointLight(0xf6287d, 10000);
    pointLight.castShadow = true;
    pointLight.shadow.bias = -0.001;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.position.set(0, 50, 0);
    scene.add(pointLight);
    lightRef.current = pointLight;

    // Small visible sphere at light position
    const lightSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    lightSphere.position.set(0, 50, 0);
    lightSphere.castShadow = false;
    lightSphere.receiveShadow = false;
    scene.add(lightSphere);

    // Composer
    const composer = new PMEffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
    });
    composer.addPass(new RenderPass(scene, camera));

    const godraysPass = new GodraysPass(pointLight, camera, {
      density: 1 / 128,
      maxDensity: 0.5,
      edgeStrength: 2,
      edgeRadius: 2,
      distanceAttenuation: 2,
      color: new THREE.Color(0xf6287d),
      raymarchSteps: 60,
      blur: true,
      gammaCorrection: true,
    });
    godraysPass.renderToScreen = true;
    composer.addPass(godraysPass);

    composerRef.current = composer;

    return () => {
      scene.remove(pointLight);
      scene.remove(lightSphere);
      pointLight.dispose();
      lightSphere.geometry.dispose();
      lightSphere.material.dispose();
      composer.dispose();
    };
  }, [gl, scene, camera]);

  // Handle resize
  useEffect(() => {
    const onResize = () => {
      if (composerRef.current) {
        composerRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Take over rendering
  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
  }, 1);

  return null;
}

/* ── Main exported scene ── */
export default function GodraysScene() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas
        shadows
        gl={{
          powerPreference: "high-performance",
          antialias: false,
        }}
        camera={{ fov: 60, near: 0.1, far: 1000, position: [-175, 50, 0] }}
        // Disable R3F's default render loop — GodraysEffect handles it
        frameloop="always"
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.4} color={0xcccccc} />

        <Model />
        <Backdrop />
        <GodraysEffect />

        <OrbitControls
          target={[0, 0.5, 0]}
          enableDamping
          maxDistance={800}
        />
        <Stats />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/godrays_demo.glb");
