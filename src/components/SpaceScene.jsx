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
  const { zoomed, targetPos, targetLookAt, defaultPos, defaultLookAt, onArrivedRef, flyToRef, captainFadeRef } = useContext(ZoomContext);
  const lerpSpeed = 1.2; // slower for cinematic feel
  const phase = useRef("idle");
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  // Active targets the camera is lerping toward (may differ from state during flyTo)
  const activePos = useRef(new THREE.Vector3());
  const activeLookAt = useRef(new THREE.Vector3());
  // For ease-in-out fly-through
  const flyStartPos = useRef(new THREE.Vector3());
  const flyStartLookAt = useRef(new THREE.Vector3());
  const flyTotalDist = useRef(1);
  const flyProgress = useRef(0);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-lerpSpeed * delta);

    if (zoomed && phase.current === "idle") {
      phase.current = "zooming-in";
      activePos.current.copy(targetPos);
      activeLookAt.current.copy(targetLookAt);
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.autoRotate = false;
      }
    }

    // Check for a queued flyTo target (ref-based, no React render needed)
    if (phase.current === "zoomed" && flyToRef.current) {
      activePos.current.copy(flyToRef.current.pos);
      activeLookAt.current.copy(flyToRef.current.lookAt);
      flyToRef.current = null;
      phase.current = "flying-to";
      flyStartPos.current.copy(camera.position);
      flyStartLookAt.current.copy(currentLookAt.current);
      flyTotalDist.current = camera.position.distanceTo(activePos.current);
      flyProgress.current = 0;
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
    }

    // Ease-in-out fly-through to second target
    if (phase.current === "flying-to") {
      flyProgress.current += delta * 0.1; // controls overall speed (~2.5s travel)
      const p = Math.min(flyProgress.current, 1);
      // Smoothstep ease-in-out
      const eased = p * p * (3 - 2 * p);

      camera.position.lerpVectors(flyStartPos.current, activePos.current, eased);
      currentLookAt.current.lerpVectors(flyStartLookAt.current, activeLookAt.current, eased);
      camera.lookAt(currentLookAt.current);

      // Restore captain visibility once camera has moved past
      if (p > 0.5 && captainFadeRef.current.target === 0) {
        captainFadeRef.current.target = 1;
      }

      if (p >= 1) {
        phase.current = "zoomed";
        if (controlsRef.current) {
          controlsRef.current.target.copy(activeLookAt.current);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = false;
          controlsRef.current.update();
        }
      }
    }

    if (phase.current === "zooming-in") {
      camera.position.lerp(activePos.current, t);
      currentLookAt.current.lerp(activeLookAt.current, t);
      camera.lookAt(currentLookAt.current);

      const dist = camera.position.distanceTo(activePos.current);
      if (dist < 0.025) {
        phase.current = "zoomed";
        if (controlsRef.current) {
          controlsRef.current.target.copy(activeLookAt.current);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = false;
          controlsRef.current.update();
        }
        // Notify that camera has arrived at target
        if (onArrivedRef?.current) {
          onArrivedRef.current();
          onArrivedRef.current = null;
        }
      }
    }

    if (!zoomed && (phase.current === "zoomed" || phase.current === "zooming-in" || phase.current === "flying-to")) {
      phase.current = "zooming-out";
      if (controlsRef.current) controlsRef.current.enabled = false;
    }

    if (phase.current === "zooming-out") {
      camera.position.lerp(defaultPos, t);
      currentLookAt.current.lerp(defaultLookAt, t);
      camera.lookAt(currentLookAt.current);

      const dist = camera.position.distanceTo(defaultPos);
      if (dist < 0.05) {
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

/* ── Captain spotlight with proper target ── */
const SPOT_DEFAULT_POS = new THREE.Vector3(0, -3.2, 3.9);
const SPOT_DEFAULT_TARGET = new THREE.Vector3(
  0,
  -3.2 - Math.sin(50 * Math.PI / 180),
  3.9 - Math.cos(50 * Math.PI / 180)
);

function CaptainSpotlight() {
  const spotRef = useRef();
  const { scene } = useThree();
  const { zoomed, spotTargetRef } = useContext(ZoomContext);

  useEffect(() => {
    if (spotRef.current) {
      spotRef.current.target.position.copy(SPOT_DEFAULT_TARGET);
      scene.add(spotRef.current.target);
      return () => scene.remove(spotRef.current.target);
    }
  }, [scene]);

  useFrame((_, delta) => {
    const spot = spotRef.current;
    if (!spot) return;
    const t = 1 - Math.exp(-1.0 * delta);

    if (spotTargetRef.current) {
      spot.position.lerp(spotTargetRef.current.pos, t);
      spot.target.position.lerp(spotTargetRef.current.lookAt, t);
      spot.target.updateMatrixWorld();
    }

    if (!zoomed) {
      // Lerp back to default
      spot.position.lerp(SPOT_DEFAULT_POS, t);
      spot.target.position.lerp(SPOT_DEFAULT_TARGET, t);
      spot.target.updateMatrixWorld();
      spotTargetRef.current = null;
    }
  });

  return (
    <spotLight
      ref={spotRef}
      castShadow
      intensity={5}
      decay={2}
      distance={10}
      angle={0.3}
      penumbra={1}
      position={[0, -3.2, 3.9]}
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0001}
    />
  );
}

/* ── H80Z spotlight ── */
function H80ZSpotlight() {
  const spotRef = useRef();
  const { scene } = useThree();

  useEffect(() => {
    if (spotRef.current) {
      spotRef.current.target.position.set(-0.40, 1.20, -0.35);
      scene.add(spotRef.current.target);
      return () => scene.remove(spotRef.current.target);
    }
  }, [scene]);

  return (
    <spotLight
      ref={spotRef}
      castShadow
      intensity={1.7}
      decay={2}
      distance={8}
      angle={0.29}
      penumbra={1}
      position={[-0.02, 1.60, -0.28]}
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0001}
    />
  );
}

/* ── 3D Model ── */
function Model({ url }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);
  const { camera } = useThree();

  const { actions } = useAnimations(animations, group);

  // Pin Hips bones to prevent foot sliding during crossfades
  const hipsPinRef = useRef([]); // array of { bone, pos } to pin
  const { zoomed, setZoomed, setTargetPos, setTargetLookAt, onArrivedRef, flyToRef, spotTargetRef, captainFadeRef } = useContext(ZoomContext);
  const lookingTimer = useRef(null);
  const gr80Timer = useRef(null);
  const gr80HeadRef = useRef(null);
  const lookingPlayRef = useRef(null);
  const captainMeshRef = useRef(null);
  const zoomedRef = useRef(false);
  useEffect(() => { zoomedRef.current = zoomed; }, [zoomed]);

  // Fade captain back in when zooming out
  useEffect(() => {
    if (!zoomed) captainFadeRef.current.target = 1;
  }, [zoomed]);

  useFrame((_, delta) => {
    const fade = captainFadeRef.current;
    if (Math.abs(fade.current - fade.target) < 0.001) return;
    fade.current += (fade.target - fade.current) * Math.min(1, delta * 3);
    const captain = captainMeshRef.current;
    if (!captain) return;
    captain.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = true;
        child.material.opacity = fade.current;
      }
    });
  });

  // Eye blink refs (Captain)
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const blinkState = useRef({
    isBlinking: false,
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 3000 + 2000,
  });

  // Eye blink refs (H80Z) — opacity-based for demon_eyes flat image plane
  const h80zEyesRef = useRef();
  const h80zBlinkState = useRef({
    isBlinking: false,
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000,
  });

  // Find and pin Hips bones to prevent crossfade sliding
  // Also find GR80's Head bone for camera flythrough
  useEffect(() => {
    const pins = [];
    scene.traverse((node) => {
      if (node.isBone && node.name === "Hips") {
        pins.push({ bone: node, pos: node.position.clone() });
      }
    });
    hipsPinRef.current = pins;

    // Find captain's parent mesh for hiding during fly-through
    const captainEmpty = scene.getObjectByName("Empty_Character");
    if (captainEmpty) captainMeshRef.current = captainEmpty;

    const gr80Empty = scene.getObjectByName("EMPTY_GR80");
    if (gr80Empty) {
      gr80Empty.traverse((node) => {
        if (node.name === "Head" && !gr80HeadRef.current) {
          gr80HeadRef.current = node;
        }
      });
    }

    // Find H80Z demon_eyes mesh for opacity-based blinking
    const h80zEmpty = scene.getObjectByName("Empty_H80Z");
    if (h80zEmpty) {
      h80zEmpty.traverse((child) => {
        if (child.name === 'demon_eyes') {
          h80zEyesRef.current = child;
          if (child.material) {
            child.material.transparent = true;
            child.material.needsUpdate = true;
          }
        }
      });
      console.log("H80Z demon_eyes found:", !!h80zEyesRef.current);
    }
  }, [scene]);

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

  // H80Z blink animation — opacity-based for demon_eyes flat image plane
  useFrame((state) => {
    const eyes = h80zEyesRef.current;
    if (!eyes || !eyes.material) return;

    const currentTime = state.clock.getElapsedTime() * 1000;
    const bs = h80zBlinkState.current;

    if (!bs.isBlinking && currentTime - bs.lastBlinkTime > bs.nextBlinkDelay) {
      bs.isBlinking = true;
      bs.lastBlinkTime = currentTime;
      bs.nextBlinkDelay = Math.random() * 4000 + 3000;
    }

    if (bs.isBlinking) {
      const closeTime = 100;
      const holdTime = 120;
      const openTime = 140;
      const totalDuration = closeTime + holdTime + openTime;
      const elapsed = currentTime - bs.lastBlinkTime;

      if (elapsed < totalDuration) {
        let opacity;
        if (elapsed < closeTime) {
          opacity = 1 - (elapsed / closeTime);
        } else if (elapsed < closeTime + holdTime) {
          opacity = 0;
        } else {
          opacity = (elapsed - closeTime - holdTime) / openTime;
        }
        eyes.material.opacity = opacity;
      } else {
        bs.isBlinking = false;
        eyes.material.opacity = 1;
      }
    }
  });

  // After animation mixer updates, re-pin Hips X/Z to prevent sliding
  useFrame(() => {
    for (const pin of hipsPinRef.current) {
      pin.bone.position.x = pin.pos.x;
      pin.bone.position.z = pin.pos.z;
    }
  });

  useEffect(() => {
    const standing = actions["standing"];
    const looking = actions["looking"];
    const idle = actions["idle"];
    if (!standing) return;

    // GR80: alternate between idle and button_pushing
    const buttonPushing = actions["neckTilt"];
    if (idle) {
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.reset().fadeIn(0.5).play();

      if (buttonPushing) {
        buttonPushing.setLoop(THREE.LoopOnce, 1);
        buttonPushing.clampWhenFinished = true;

        const scheduleButtonPush = () => {
          const delay = 5000 + Math.random() * 10000;
          gr80Timer.current = setTimeout(() => {
            buttonPushing.reset().fadeIn(0.4).play();
            idle.fadeOut(0.4);

            const onFinished = (e) => {
              if (e.action === buttonPushing) {
                buttonPushing.getMixer().removeEventListener("finished", onFinished);
                idle.reset().fadeIn(0.4).play();
                buttonPushing.fadeOut(0.4);
                scheduleButtonPush();
              }
            };
            buttonPushing.getMixer().addEventListener("finished", onFinished);
          }, delay);
        };

        scheduleButtonPush();
      }
    }

    // H80Z: play sit_pose animation
    const sitPose = actions["sit_pose"];
    if (sitPose) {
      sitPose.reset().fadeIn(0.5).play();
      sitPose.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Log H80Z positioning info for camera/spotlight setup
    const h80zEmpty = scene.getObjectByName("Empty_H80Z");
    if (h80zEmpty) {
      scene.updateMatrixWorld(true);
      const h80zWorld = new THREE.Vector3();
      h80zEmpty.getWorldPosition(h80zWorld);
      console.log("H80Z Empty world pos:", h80zWorld.toArray());

      let h80zHips = null;
      h80zEmpty.traverse((n) => {
        if (n.name === "Hips" && !h80zHips) h80zHips = n;
      });
      if (h80zHips) {
        const hipsWorld = new THREE.Vector3();
        h80zHips.getWorldPosition(hipsWorld);
        console.log("H80Z Hips world pos:", hipsWorld.toArray());
      }

      let h80zHead = null;
      h80zEmpty.traverse((n) => {
        if (n.name === "Head" && !h80zHead) h80zHead = n;
      });
      if (h80zHead) {
        const headWorld = new THREE.Vector3();
        h80zHead.getWorldPosition(headWorld);
        console.log("H80Z Head world pos:", headWorld.toArray());
      }
    }

    // Drone: play Take 001 animation
    const droneAnim = actions["Take 001"];
    if (droneAnim) {
      droneAnim.reset().fadeIn(0.5).play();
      droneAnim.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Log Drone positioning info for camera/spotlight setup
    const droneEmpty = scene.getObjectByName("Drone_Empty");
    if (droneEmpty) {
      scene.updateMatrixWorld(true);
      const droneWorld = new THREE.Vector3();
      droneEmpty.getWorldPosition(droneWorld);
      console.log("Drone_Empty world pos:", droneWorld.toArray());
    }

    // Play standing on infinite loop
    standing.reset().fadeIn(0.5).play();
    standing.setLoop(THREE.LoopRepeat, Infinity);

    if (looking) {
      looking.setLoop(THREE.LoopOnce, 1);
      looking.clampWhenFinished = true;

      const playLooking = () => {
        looking.reset().fadeIn(0.4).play();
        standing.fadeOut(0.4);

        const onFinished = (e) => {
          if (e.action === looking) {
            looking.getMixer().removeEventListener("finished", onFinished);
            standing.reset().fadeIn(0.4).play();
            looking.fadeOut(0.4);

            // If zoomed in, pause then fly camera to GR80 character
            if (zoomedRef.current) {
              setTimeout(() => {
              // Fade out captain slightly after camera starts moving
              setTimeout(() => { captainFadeRef.current.target = 0; }, 500);
              console.log("GR80 head ref:", gr80HeadRef.current);
              if (gr80HeadRef.current) {
                const gr80LookAt = new THREE.Vector3();
                gr80HeadRef.current.getWorldPosition(gr80LookAt);
                console.log("Flying to GR80 at:", gr80LookAt.toArray());
                const gr80Pos = gr80LookAt.clone().add(new THREE.Vector3(0, 0, 0.5));
                flyToRef.current = { pos: gr80Pos, lookAt: gr80LookAt };
              } else {
                // Fallback: fly to EMPTY_GR80 position directly
                const gr80Empty = scene.getObjectByName("EMPTY_GR80");
                console.log("EMPTY_GR80 node:", gr80Empty);
                if (gr80Empty) {
                  scene.updateMatrixWorld(true);
                  const gr80World = new THREE.Vector3();
                  gr80Empty.getWorldPosition(gr80World);
                  // Look at chest/face height
                  const gr80LookAt = gr80World.clone();
                  gr80LookAt.y += 0.15;
                  // Camera in front of GR80 (positive Z = toward viewer)
                  const gr80Pos = new THREE.Vector3(gr80World.x, gr80World.y + 0.21, gr80World.z + 0.4);
                  flyToRef.current = { pos: gr80Pos, lookAt: gr80LookAt };
                  // Move spotlight to GR80
                  spotTargetRef.current = { pos: gr80World.clone().add(new THREE.Vector3(0, 2, 0.5)), lookAt: gr80World.clone() };
                }
              }
              }, 2000);
            } else {
              scheduleLooking();
            }
          }
        };
        looking.getMixer().addEventListener("finished", onFinished);
      };

      // Random schedule for when not zoomed
      const scheduleLooking = () => {
        const delay = 7000 + Math.random() * 12000;
        lookingTimer.current = setTimeout(playLooking, delay);
      };

      // Expose so handleClick can trigger it immediately
      lookingPlayRef.current = playLooking;

      scheduleLooking();
    }

    return () => {
      clearTimeout(lookingTimer.current);
      clearTimeout(gr80Timer.current);
      standing.stop();
      looking?.stop();
      idle?.stop();
      buttonPushing?.stop();
      sitPose?.stop();
      droneAnim?.stop();
    };
  }, [actions]);

  // Find the Window2 object once the scene is loaded
  const windowRef = useRef(null);
  useEffect(() => {
    const window2 = scene.getObjectByName("Window1");
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
    const zoomPos = lookAt.clone().add(new THREE.Vector3(0, 0, 0.15));

    setTargetLookAt(lookAt);
    setTargetPos(zoomPos);
    setZoomed(true);

    // When camera arrives, trigger looking animation → then fly to GR80
    clearTimeout(lookingTimer.current);
    onArrivedRef.current = () => {
      if (lookingPlayRef.current) {
        lookingPlayRef.current();
      }
    };
  }, [scene, setZoomed, setTargetPos, setTargetLookAt, onArrivedRef]);

  return <primitive ref={group} object={scene} onClick={handleClick} />;
}

export default function SpaceScene() {
  const [zoomed, setZoomed] = useState(false);
  const [targetPos, setTargetPos] = useState(() => new THREE.Vector3(0, 0, 6));
  const [targetLookAt, setTargetLookAt] = useState(() => new THREE.Vector3(0, 0, 0));
  const onArrivedRef = useRef(null);
  const flyToRef = useRef(null);
  const spotTargetRef = useRef(null); // { pos, lookAt } for spotlight to lerp toward
  const captainFadeRef = useRef({ target: 1, current: 1 });

  const defaultPos = React.useMemo(() => new THREE.Vector3(0, 0, 16), []);
  const defaultLookAt = React.useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const controlsRef = useRef(null);

  const zoomCtx = React.useMemo(() => ({
    zoomed, setZoomed,
    targetPos, setTargetPos,
    targetLookAt, setTargetLookAt,
    defaultPos, defaultLookAt,
    onArrivedRef,
    flyToRef,
    spotTargetRef,
    captainFadeRef,
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
          <CaptainSpotlight />
          <H80ZSpotlight />
          <Suspense fallback={null}>
            <Model url="/models/Scene3.glb" />
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

useGLTF.preload("/models/Scene3.glb");
