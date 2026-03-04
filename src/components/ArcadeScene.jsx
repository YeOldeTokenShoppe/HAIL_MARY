"use client";

import { useRef, Suspense, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls, Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import AnnotationSystem from "./AnnotationSystem";

// Configure DRACO loader for compressed GLB files
useGLTF.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");

// Clickable mesh names that trigger the screen zoom
const CLICKABLE_MESHES = new Set(["Screen1", "Joystick1", "Joystick2"]);

// Handles click detection on arcade cabinet and camera fly-into-screen animation
function ScreenZoomPortal({ scene, onEnterScreen }) {
  const { camera, controls, gl, raycaster } = useThree();
  const isZooming = useRef(false);
  const hasFired = useRef(false);
  const zoomProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const startFov = useRef(50);
  const screenCenter = useRef(new THREE.Vector3());
  const frontPos = useRef(new THREE.Vector3());

  // Compute Screen1 world center once
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.name === "Screen1") {
        child.updateWorldMatrix(true, false);
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        child.geometry.boundingBox.getCenter(center);
        center.applyMatrix4(child.matrixWorld);
        screenCenter.current.copy(center);
      }
    });
  }, [scene]);

  // Click handler
  useEffect(() => {
    const handleClick = (event) => {
      if (isZooming.current) return;

      const clickables = [];
      scene.traverse((child) => {
        if (child.isMesh && CLICKABLE_MESHES.has(child.name)) {
          clickables.push(child);
        }
      });
      if (clickables.length === 0) return;

      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera({ x, y }, camera);

      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length > 0) {
        isZooming.current = true;
        hasFired.current = false;
        zoomProgress.current = 0;
        startPos.current.copy(camera.position);
        startFov.current = camera.fov;
        if (controls) {
          startTarget.current.copy(controls.target);
          controls.enabled = false;
        }

        // Compute "in front of screen" from camera's current direction
        // Use the vector from screen center toward camera, keep it level with screen
        const dir = new THREE.Vector3()
          .subVectors(camera.position, screenCenter.current);
        dir.y = 0; // keep level
        dir.normalize();
        // Park 0.8 units in front of the screen center
        frontPos.current.copy(screenCenter.current).add(dir.multiplyScalar(0.8));
        frontPos.current.y = screenCenter.current.y; // stay level with screen
      }
    };

    gl.domElement.addEventListener("click", handleClick);
    return () => gl.domElement.removeEventListener("click", handleClick);
  }, [scene, camera, controls, gl, raycaster]);

  useFrame((_, delta) => {
    if (!isZooming.current) return;

    zoomProgress.current += delta * 0.9;
    const t = Math.min(zoomProgress.current, 1);
    const eased = t * t;

    // Fly from start to directly in front of screen
    camera.position.lerpVectors(startPos.current, frontPos.current, eased);

    // Look at screen center
    if (controls) {
      controls.target.lerpVectors(
        startTarget.current,
        screenCenter.current,
        Math.min(eased * 2, 1)
      );
      controls.update();
    } else {
      camera.lookAt(screenCenter.current);
    }

    // Narrow FOV for zoom-in tunnel effect
    camera.fov = THREE.MathUtils.lerp(startFov.current, 15, eased);
    camera.updateProjectionMatrix();

    // Fire transition at 85% — screen fills the viewport, before camera clips through
    if (eased > 0.85 && !hasFired.current && onEnterScreen) {
      hasFired.current = true;
      onEnterScreen();
    }
  });

  return null;
}

function ArcadeModel({ is80sMode, onLoaded, onEnterScreen }) {
  const { scene, animations } = useGLTF("/models/medievalArcade.glb", true);
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);
  const videoRef = useRef(null);
  const textureRef = useRef(null);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  // Play the 'Scene' animation
  useEffect(() => {
    if (actions?.Scene) {
      actions.Scene.reset().play();
      actions.Scene.setLoop(THREE.LoopRepeat);
    }
  }, [actions]);

  // Apply video texture to Screen1 mesh
  useEffect(() => {
    const video = document.createElement("video");
    video.src = "/videos/videoGame.mp4";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    videoRef.current = video;

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = texture;

    scene.traverse((child) => {
      if (child.isMesh && child.name === "Screen1") {
        child.material = new THREE.MeshBasicMaterial({
          map: texture,
          toneMapped: false,
        });
      }
    });

    video.play().catch(() => {});

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      texture.dispose();
      videoRef.current = null;
      textureRef.current = null;
    };
  }, [scene]);

  useEffect(() => {
    if (scene && onLoaded) {
      onLoaded();
    }
  }, [scene, onLoaded]);


  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1} position={[0, -1.5, 0]} />
      <ScreenZoomPortal scene={scene} onEnterScreen={onEnterScreen} />
    </group>
  );
}

// Firefly particles for atmosphere
function Fireflies({ count = 30, is80sMode }) {
  const meshRef = useRef();
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = Math.random() * 5 - 1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return pos;
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const posAttr = meshRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      posAttr.array[i3] += Math.sin(time * 0.5 + i * 1.3) * 0.002;
      posAttr.array[i3 + 1] += Math.cos(time * 0.4 + i * 0.7) * 0.001;
      posAttr.array[i3 + 2] += Math.sin(time * 0.3 + i * 2.1) * 0.002;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={is80sMode ? 0.06 : 0.04}
        color={is80sMode ? "#ff00ff" : "#d4af37"}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// Annotation points of interest — adjust positions to match model landmarks
const ARCADE_ANNOTATIONS = [
  {
    position: [2.2, 2.2, 1.5],
    text: "RL80 Arcade — Stained Glass",
    customCamera: {
      position: [3.5, 1.8, 2.5],
      lookAt: [2.2, 1.2, -0.5],
      distance: 3,
    },
  },
  {
    position: [1.0, -0.8, 1.2],
    text: "Arcade Cabinet",
    customCamera: {
      position: [2.5, -0.2, 3.0],
      lookAt: [1.0, -0.8, 1.2],
      distance: 2.5,
    },
  },
  {
    position: [-1.5, 0.5, 0.5],
    text: "Ye Olde Tavern Bar",
    customCamera: {
      position: [-0.5, 1.2, 3.5],
      lookAt: [-1.5, 0.5, 0.5],
      distance: 3,
    },
  },
  {
    position: [-1.3, 2.0, 0.3],
    text: "The Regulars",
    customCamera: {
      position: [1.5, 1.5, 3.0],
      lookAt: [-0.3, 1.4, 0.3],
      distance: 3.5,
    },
  },
];

// Dramatic crane shot intro — high/far → side angle → arc to resting position
const INTRO_DURATION = 7.0; // seconds
const INTRO_WAYPOINTS = [
  { pos: [0, 8, 14], target: [0, 0, 0] },       // Start: high crane, looking down at scene
  { pos: [5, 3, 6],  target: [0, 0.5, 0] },      // Mid: side angle, descending
  { pos: [-2, 0.5, 9], target: [0, 0, 0] },       // End: resting position
];

function CinematicIntro({ onComplete }) {
  const { camera, controls } = useThree();
  const progress = useRef(0);
  const done = useRef(false);

  // Disable controls during intro
  useEffect(() => {
    if (controls) controls.enabled = false;
    // Set camera to start position immediately
    camera.position.set(...INTRO_WAYPOINTS[0].pos);
    camera.lookAt(...INTRO_WAYPOINTS[0].target);
  }, [camera, controls]);

  useFrame((_, delta) => {
    if (done.current) return;

    progress.current += delta;
    const t = Math.min(progress.current / INTRO_DURATION, 1);

    // Smooth ease-in-out
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Interpolate through waypoints using quadratic Bezier
    const wp = INTRO_WAYPOINTS;
    const p0 = new THREE.Vector3(...wp[0].pos);
    const p1 = new THREE.Vector3(...wp[1].pos);
    const p2 = new THREE.Vector3(...wp[2].pos);

    // Quadratic bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
    const invT = 1 - eased;
    const camPos = new THREE.Vector3()
      .addScaledVector(p0, invT * invT)
      .addScaledVector(p1, 2 * invT * eased)
      .addScaledVector(p2, eased * eased);

    camera.position.copy(camPos);

    // Interpolate look-at target the same way
    const t0 = new THREE.Vector3(...wp[0].target);
    const t1 = new THREE.Vector3(...wp[1].target);
    const t2 = new THREE.Vector3(...wp[2].target);

    const lookTarget = new THREE.Vector3()
      .addScaledVector(t0, invT * invT)
      .addScaledVector(t1, 2 * invT * eased)
      .addScaledVector(t2, eased * eased);

    if (controls) {
      controls.target.copy(lookTarget);
      controls.update();
    } else {
      camera.lookAt(lookTarget);
    }

    if (t >= 1) {
      done.current = true;
      // Hand off to OrbitControls
      if (controls) {
        controls.target.copy(lookTarget);
        controls.enabled = true;
        controls.update();
      }
      if (onComplete) onComplete();
    }
  });

  return null;
}

function ArcadeSceneInner({ is80sMode, onLoaded, onEnterScreen }) {
  const controlsRef = useRef();

  return (
    <>
      {/* Warm ambient fill */}

      <ambientLight intensity={is80sMode ? 0.3 : 0.4} color={is80sMode ? "#6a0dad" : "#ffcc88"} />

      {/* Main key light — warm overhead like tavern chandelier */}
      <directionalLight
        position={[3, 6, 4]}
        intensity={is80sMode ? 1.2 : 1.5}
        color={is80sMode ? "#c937ff" : "#ffe4b5"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill light from the left */}
      <pointLight
        position={[-4, 3, 2]}
        intensity={is80sMode ? 0.8 : 0.6}
        color={is80sMode ? "#00ffff" : "#ff9944"}
        distance={12}
        decay={2}
      />

      {/* Backlight for rim separation */}
      <pointLight
        position={[0, 2, -5]}
        intensity={is80sMode ? 1.0 : 0.4}
        color={is80sMode ? "#ff00ff" : "#8888ff"}
        distance={10}
        decay={2}
      />

      {/* Ground bounce light */}
      <pointLight
        position={[0, -1, 3]}
        intensity={0.3}
        color={is80sMode ? "#00ff41" : "#d4af37"}
        distance={8}
        decay={2}
      />

      {/* Stained glass glow from the right wall */}
      <spotLight
        position={[5, 3, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={is80sMode ? 2.0 : 1.0}
        color={is80sMode ? "#ff00ff" : "#4488ff"}
        distance={15}
        decay={2}
        target-position={[0, 0, 0]}
      />

      <Environment preset="sunset" background={false} environmentIntensity={is80sMode ? 0.3 : 0.6} />

      <ArcadeModel is80sMode={is80sMode} onLoaded={onLoaded} onEnterScreen={onEnterScreen} />

      <Fireflies count={is80sMode ? 50 : 25} is80sMode={is80sMode} />

      <AnnotationSystem
        annotations={ARCADE_ANNOTATIONS}
        is80sMode={is80sMode}
        scale={0.6}
      />

      <CinematicIntro />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableZoom={true}
        minDistance={2}
        maxDistance={12}
        minPolarAngle={Math.PI * 0.05}
        maxPolarAngle={Math.PI * 0.85}
        enableDamping={false}
      />

      <EffectComposer>
        <Bloom
          intensity={is80sMode ? 0.8 : 0.3}
          luminanceThreshold={is80sMode ? 0.6 : 0.85}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export default function ArcadeScene({ is80sMode = false, onLoaded, onEnterScreen }) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        camera={{
          fov: 50,
          position: [0, 8, 14],
          near: 0.1,
          far: 100,
        }}
        shadows
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
        }}
      >
        <Suspense fallback={null}>
          <ArcadeSceneInner is80sMode={is80sMode} onLoaded={onLoaded} onEnterScreen={onEnterScreen} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/medievalArcade.glb", true);
