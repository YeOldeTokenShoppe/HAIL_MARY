import React, { Suspense, useRef, useState, useCallback, useEffect, createContext, useContext } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Loader,
  useGLTF,
  useAnimations,
  PerspectiveCamera,
  OrbitControls,
  Stars,
} from "@react-three/drei";
import "../app/space/space.css";

/* ── Zoom context shared between Model and CameraController ── */
const ZoomContext = createContext();

/* ── Smooth camera zoom controller ── */
function CameraController({ controlsRef }) {
  const { camera } = useThree();
  const { zoomed, targetPos, targetLookAt, defaultPos, defaultLookAt } = useContext(ZoomContext);
  const lerpSpeed = 1.2; // slower for cinematic feel
  const phase = useRef("idle");
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-lerpSpeed * delta);

    if (zoomed && phase.current === "idle") {
      phase.current = "zooming-in";
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.autoRotate = false;
      }
    }

    if (phase.current === "zooming-in") {
      camera.position.lerp(targetPos, t);
      currentLookAt.current.lerp(targetLookAt, t);
      camera.lookAt(currentLookAt.current);

      const dist = camera.position.distanceTo(targetPos);
      if (dist < 0.05) {
        phase.current = "zoomed";
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetLookAt);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = false;
          controlsRef.current.update();
        }
      }
    }

    if (!zoomed && (phase.current === "zoomed" || phase.current === "zooming-in")) {
      phase.current = "zooming-out";
      if (controlsRef.current) controlsRef.current.enabled = false;
    }

    if (phase.current === "zooming-out") {
      camera.position.lerp(defaultPos, t);
      currentLookAt.current.lerp(defaultLookAt, t);
      camera.lookAt(currentLookAt.current);

      const dist = camera.position.distanceTo(defaultPos);
      if (dist < 0.1) {
        phase.current = "idle";
        camera.position.copy(defaultPos);
        currentLookAt.current.copy(defaultLookAt);
        if (controlsRef.current) {
          controlsRef.current.target.copy(defaultLookAt);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = true;
          controlsRef.current.update();
        }
      }
    }
  });

  return null;
}

/* ── 3D Model ── */
function Model({ url }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);
  const { setZoomed, setTargetPos, setTargetLookAt } = useContext(ZoomContext);
  const lookingTimer = useRef(null);

  // Eye blink refs
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const blinkState = useRef({
    isBlinking: false,
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 3000 + 2000,
  });

  // Find eye meshes and the Eyes bone
  const eyesBoneRef = useRef();
  useEffect(() => {
    const eyeL = scene.getObjectByName("Eye_L");
    const eyeR = scene.getObjectByName("Eye_R");
    const eyesBone = scene.getObjectByName("Eyes");
    if (eyeL) {
      leftEyeRef.current = eyeL;
      eyeL.userData.originalScale = eyeL.scale.clone();
    }
    if (eyeR) {
      rightEyeRef.current = eyeR;
      eyeR.userData.originalScale = eyeR.scale.clone();
    }
    if (eyesBone) {
      eyesBoneRef.current = eyesBone;
      eyesBone.userData.originalScale = eyesBone.scale.clone();
    }
  }, [scene]);

  // Blink animation loop — scale the Eyes bone so skeleton doesn't override
  useFrame((state) => {
    const bone = eyesBoneRef.current;
    if (!bone) return;
    const currentTime = state.clock.getElapsedTime() * 1000;
    const bs = blinkState.current;
    const orig = bone.userData.originalScale;

    // Trigger blink
    if (!bs.isBlinking && currentTime - bs.lastBlinkTime > bs.nextBlinkDelay) {
      bs.isBlinking = true;
      bs.lastBlinkTime = currentTime;
      bs.nextBlinkDelay = Math.random() * 3000 + 2000;
    }

    // Animate blink (close 100ms, hold 80ms, open 120ms)
    if (bs.isBlinking) {
      const closeTime = 100;
      const holdTime = 80;
      const openTime = 120;
      const totalDuration = closeTime + holdTime + openTime;
      const elapsed = currentTime - bs.lastBlinkTime;

      if (elapsed < totalDuration) {
        let progress;
        if (elapsed < closeTime) {
          progress = elapsed / closeTime;
        } else if (elapsed < closeTime + holdTime) {
          progress = 1;
        } else {
          progress = 1 - ((elapsed - closeTime - holdTime) / openTime);
        }
        const eyeScale = 1 - progress * 0.95;
        bone.scale.set(orig.x, orig.y * eyeScale, orig.z);

        // Hide pupils when eyelid is mostly closed
        const pupilsVisible = progress < 0.5;
        if (leftEyeRef.current) leftEyeRef.current.visible = pupilsVisible;
        if (rightEyeRef.current) rightEyeRef.current.visible = pupilsVisible;
      } else {
        bs.isBlinking = false;
        bone.scale.copy(orig);
        if (leftEyeRef.current) leftEyeRef.current.visible = true;
        if (rightEyeRef.current) rightEyeRef.current.visible = true;
      }
    }
  });

  useEffect(() => {
    const standing = actions["standing"];
    const looking = actions["looking"];
    if (!standing) return;

    // Play standing on infinite loop
    standing.reset().fadeIn(0.5).play();
    standing.setLoop(THREE.LoopRepeat, Infinity);

    if (looking) {
      looking.setLoop(THREE.LoopOnce, 1);
      looking.clampWhenFinished = true;

      const scheduleLooking = () => {
        // Random interval between 5–12 seconds
        const delay = 5000 + Math.random() * 7000;
        lookingTimer.current = setTimeout(() => {
          // Crossfade from standing to looking
          looking.reset().fadeIn(0.4).play();
          standing.fadeOut(0.4);

          // When looking finishes, crossfade back to standing
          const onFinished = (e) => {
            if (e.action === looking) {
              looking.getMixer().removeEventListener("finished", onFinished);
              standing.reset().fadeIn(0.4).play();
              looking.fadeOut(0.4);
              scheduleLooking();
            }
          };
          looking.getMixer().addEventListener("finished", onFinished);
        }, delay);
      };

      scheduleLooking();
    }

    return () => {
      clearTimeout(lookingTimer.current);
      standing.stop();
      looking?.stop();
    };
  }, [actions]);

  // Find the Window2 object once the scene is loaded
  const windowRef = useRef(null);
  useEffect(() => {
    const window2 = scene.getObjectByName("Window2");
    if (window2) {
      windowRef.current = window2;
    }
  }, [scene]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    const target = windowRef.current;
    if (!target) return;

    // Target the Head bone for face-level framing
    const headBone = scene.getObjectByName("Head");
    const lookAt = new THREE.Vector3();
    if (headBone) {
      headBone.getWorldPosition(lookAt);
    } else {
      const box = new THREE.Box3().setFromObject(target);
      box.getCenter(lookAt);
    }

    // Camera at same height as lookAt, offset forward on Z
    const zoomPos = lookAt.clone().add(new THREE.Vector3(0, 0, 0.5));

    setTargetLookAt(lookAt);
    setTargetPos(zoomPos);
    setZoomed(true);
  }, [scene, setZoomed, setTargetPos, setTargetLookAt]);

  return <primitive ref={group} object={scene} onClick={handleClick} />;
}

export default function SpaceScene() {
  const [zoomed, setZoomed] = useState(false);
  const [targetPos, setTargetPos] = useState(() => new THREE.Vector3(0, 0, 6));
  const [targetLookAt, setTargetLookAt] = useState(() => new THREE.Vector3(0, 0, 0));

  const defaultPos = React.useMemo(() => new THREE.Vector3(0, 0, 16), []);
  const defaultLookAt = React.useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const controlsRef = useRef(null);

  const zoomCtx = React.useMemo(() => ({
    zoomed, setZoomed,
    targetPos, setTargetPos,
    targetLookAt, setTargetLookAt,
    defaultPos, defaultLookAt,
  }), [zoomed, targetPos, targetLookAt, defaultPos, defaultLookAt]);

  return (
    <div className="space-page">
      <div className="bg" />

      <h1
        className="custom-title"
        style={{
          position: "absolute",
          top: "2rem",
          left: "2rem",
          zIndex: 290,
          color: "#f6f5f1ff",
          fontFamily: "UnifrakturCook, serif",
          textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7)",
          fontSize: "2.5rem",
          fontWeight: 900,
          lineHeight: 0.85,
          transform: "rotate(-8deg) skew(-15deg)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          margin: 0,
        }}
      >
        <span className="title-line" style={{ display: "block" }}>Our Lady</span>
        <span className="title-line" style={{ display: "block" }}>
          <span style={{ fontSize: "1rem" }}>    of    </span>
          Perpetual
        </span>
        <span className="title-line" style={{ display: "block", marginLeft: "2.7rem" }}>Profit</span>
      </h1>

      <Canvas
        onPointerMissed={() => { if (zoomed) setZoomed(false); }}
        dpr={[1.5, 2]}
        linear
        shadows
        camera={{ position: [0, 0, 16], fov: 75 }}
      >
        <ZoomContext.Provider value={zoomCtx}>
          <fog attach="fog" args={["#272730", 16, 30]} />
          <ambientLight intensity={0.5 * Math.PI} />
          <PerspectiveCamera makeDefault position={[0, 0, 16]} fov={75}>
            <spotLight
              castShadow
              intensity={1.25 * Math.PI}
              decay={0}
              angle={0.2}
              penumbra={1}
              position={[-25, 20, -15]}
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.0001}
            />
          </PerspectiveCamera>
          <CameraController controlsRef={controlsRef} />
          <Suspense fallback={null}>
            <Model url="/models/Scene2.glb" />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            autoRotate
            autoRotateSpeed={0.5}
            enablePan={false}
            enableZoom={zoomed}
            maxPolarAngle={zoomed ? Math.PI : Math.PI / 2}
            minPolarAngle={zoomed ? 0 : Math.PI / 2}
          />
          <Stars radius={500} depth={50} count={1000} factor={10} />
        </ZoomContext.Provider>
      </Canvas>

      <div className="layer" />
      <Loader />
    </div>
  );
}

useGLTF.preload("/models/Scene2.glb");
