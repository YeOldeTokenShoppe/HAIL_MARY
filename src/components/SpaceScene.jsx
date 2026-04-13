import React, { Suspense, useRef, useState, useCallback, useEffect, createContext, useContext } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useGLTF,
  useAnimations,
  PerspectiveCamera,
  OrbitControls,
  Stars,
  Stats,
} from "@react-three/drei";
import HoloProjector from "./HoloProjector";
import HologooR3F from "./HologooR3F";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import "../app/space/space.css";

/* ── Zoom context shared between Model and CameraController ── */
const ZoomContext = createContext();

/* ── Smooth camera zoom controller ── */
const ZOOM_IN_WORLD_UP = new THREE.Vector3(0, 1, 0);
const ZOOM_IN_DURATION = 3.3; // seconds — total length of the arc-path zoom
function CameraController({ controlsRef }) {
  const { camera } = useThree();
  const { zoomed, targetPos, targetLookAt, defaultPos, defaultLookAt, onArrivedRef, flyToRef, orbitTableRef, captainFadeRef, sequenceRunningRef, breakOutRef, inSpaceshipRef } = useContext(ZoomContext);
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
  const flySpeed = useRef(0.1);
  // For the arc-path zoom-in (slerp direction, lerp radius)
  const zoomProgress = useRef(0);
  const zoomStartDir = useRef(new THREE.Vector3());
  const zoomEndDir = useRef(new THREE.Vector3());
  const zoomStartRadius = useRef(0);
  const zoomEndRadius = useRef(0);
  const zoomStartLookAt = useRef(new THREE.Vector3());
  // For the orbit-around-table phase (camera sweeps the hologram horizontally).
  // Radius and height are interpolated from the camera's starting values to
  // the request's target values across the full orbit, so the camera can
  // nudge back and up throughout the sweep instead of snapping at entry.
  const orbitProgress = useRef(0);
  const orbitDuration = useRef(12);
  const orbitPivot = useRef(new THREE.Vector3());
  const orbitStartRadius = useRef(0);
  const orbitEndRadius = useRef(0);
  const orbitStartHeight = useRef(0);
  const orbitEndHeight = useRef(0);
  const orbitStartAngle = useRef(0);
  const orbitTotalAngle = useRef(0);
  // Constant offset added to the orbit's radius for the whole sweep
  // (not just the end), so the camera stays farther from the pivot
  // throughout. Ramped in over the first ~10% of the orbit to avoid
  // a visible step-out at entry.
  const orbitRadiusPadding = useRef(0);
  // Snapshot of the camera's lookAt at orbit entry. The orbit update lerps
  // `currentLookAt` from this to `orbitPivot` over the first fraction of
  // the sweep so the camera's rotation is continuous with the preceding
  // phase (otherwise the lookAt snaps from e.g. gr80LookAt to the pivot
  // in a single frame — visible as a "blink").
  const orbitStartLookAt = useRef(new THREE.Vector3());
  // Scratch objects reused every frame to avoid per-frame allocations
  const tmpQuatStart = useRef(new THREE.Quaternion());
  const tmpQuatEnd = useRef(new THREE.Quaternion());
  const tmpQuat = useRef(new THREE.Quaternion());
  const tmpDir = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-lerpSpeed * delta);

    // Break-out: once the camera has made its first stop at the captain,
    // `sequenceRunningRef` is true. Any click on the scene sets
    // `breakOutRef`; here we cancel any pending/in-flight animation phases
    // and hand control to OrbitControls at the camera's current pose so
    // the user can explore from wherever the camera happened to be.
    if (breakOutRef.current) {
      const isAnimating = sequenceRunningRef.current
        || phase.current === "zooming-in";
      if (isAnimating) {
        flyToRef.current = null;
        orbitTableRef.current = null;
        onArrivedRef.current = null;
        captainFadeRef.current.target = 1;
        sequenceRunningRef.current = false;
        phase.current = "zoomed";
        // Place the camera just past the first character along -Z, inside
        // the capsule, looking toward the scene center.
        const breakOutY = targetLookAt.y - 0.1;
        camera.position.set(targetLookAt.x, breakOutY, targetLookAt.z - 0.3);
        // Look toward the scene center at the camera's height
        // so we face straight ahead rather than down at the floor.
        const breakOutTarget = new THREE.Vector3(defaultLookAt.x, breakOutY, defaultLookAt.z);
        currentLookAt.current.copy(breakOutTarget);
        camera.lookAt(currentLookAt.current);
        if (controlsRef.current) {
          controlsRef.current.target.copy(breakOutTarget);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = false;
          controlsRef.current.update();
        }
      }
      breakOutRef.current = false;
    }

    if (zoomed && phase.current === "idle") {
      phase.current = "zooming-in";
      activePos.current.copy(targetPos);
      activeLookAt.current.copy(targetLookAt);

      // Snapshot the arc-path parameters. zoom-in slerps the camera's
      // direction-from-head from its current angle to the target angle
      // while lerping the radius inward, so the motion arcs around the
      // model instead of cutting a straight line through it.
      const startVec = new THREE.Vector3().subVectors(camera.position, targetLookAt);
      const endVec = new THREE.Vector3().subVectors(targetPos, targetLookAt);
      zoomStartRadius.current = Math.max(startVec.length(), 1e-4);
      zoomEndRadius.current = Math.max(endVec.length(), 1e-4);
      zoomStartDir.current.copy(startVec).normalize();
      zoomEndDir.current.copy(endVec).normalize();
      zoomStartLookAt.current.copy(currentLookAt.current);
      zoomProgress.current = 0;

      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.autoRotate = false;
      }
    }

    // Check for a queued flyTo target (ref-based, no React render needed)
    if (phase.current === "zoomed" && flyToRef.current) {
      activePos.current.copy(flyToRef.current.pos);
      activeLookAt.current.copy(flyToRef.current.lookAt);
      flySpeed.current = flyToRef.current.speed || 0.1;
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

    // Check for a queued orbit-table request. Sweeps the camera in a
    // horizontal circle around a pivot (the hologram table) for a given
    // number of laps, then hands control back to OrbitControls.
    if (phase.current === "zoomed" && orbitTableRef && orbitTableRef.current) {
      const req = orbitTableRef.current;
      orbitPivot.current.copy(req.pivot);

      // Snapshot the camera's current radius/height relative to the pivot
      // as the orbit START values. The END values come from the request;
      // if omitted they default to the start values (no nudge). We lerp
      // between start and end across the full orbit each frame so the
      // camera smoothly pulls back and/or rises throughout the sweep.
      const dx = camera.position.x - req.pivot.x;
      const dz = camera.position.z - req.pivot.z;
      const startR = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
      const startH = camera.position.y - req.pivot.y;
      orbitStartRadius.current = startR;
      orbitStartHeight.current = startH;
      orbitEndRadius.current = (req.radius != null) ? req.radius : startR;
      orbitEndHeight.current = (req.heightOffset != null) ? req.heightOffset : startH;

      orbitStartAngle.current = Math.atan2(dz, dx);
      // Total sweep = (laps * 2π) + endAngleOffset. Integer laps land the
      // endpoint at the same direction from pivot as the start; endAngleOffset
      // rotates the endpoint by an extra angle past that.
      const lapsAngle = (req.laps != null ? req.laps : 1.5) * Math.PI * 2;
      const endOffset = (req.endAngleOffset != null) ? req.endAngleOffset : 0;
      orbitTotalAngle.current = lapsAngle + endOffset;
      // Direction: positive = counter-clockwise (viewed from above).
      if (req.direction != null) orbitTotalAngle.current *= Math.sign(req.direction);
      orbitDuration.current = (req.duration != null) ? req.duration : 12;
      orbitRadiusPadding.current = (req.radiusPadding != null) ? req.radiusPadding : 0;
      orbitProgress.current = 0;
      // Capture whatever the camera was previously looking at so we can
      // smoothly rotate toward the orbit pivot (otherwise the lookAt snaps
      // in a single frame — visible as a "blink").
      orbitStartLookAt.current.copy(currentLookAt.current);
      orbitTableRef.current = null;
      phase.current = "orbiting-table";
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.autoRotate = false;
      }
    }

    // Orbit-around-table phase. Horizontal sweep around the pivot with
    // radius, height, and lookAt interpolated.
    //   Angle / radius: quadratic EASE-OUT across the whole orbit. Starts
    //     at max velocity (2) so it picks up seamlessly from the fly-to's
    //     quadratic ease-in (which ends at velocity 2), and decelerates
    //     smoothly to a stop.
    //   Height: cubic ease-in — stays near the starting height for most of
    //     the sweep and only pulls up in the last stretch, so the camera
    //     lifts "at the very end" rather than throughout.
    //   LookAt: smoothstep over the first LOOKAT_BLEND_FRACTION of the
    //     orbit, so the camera rotates continuously from the previous
    //     phase's target to the pivot instead of snapping in one frame.
    if (phase.current === "orbiting-table") {
      orbitProgress.current += delta / orbitDuration.current;
      const p = Math.min(orbitProgress.current, 1);
      const inv = 1 - p;
      const eased = 1 - inv * inv;   // quadratic ease-out (v=2 at p=0, v=0 at p=1)
      const heightEased = p * p * p; // cubic ease-in (back-loaded)

      const angle = orbitStartAngle.current + orbitTotalAngle.current * eased;
      const baseRadius = orbitStartRadius.current * (1 - eased) + orbitEndRadius.current * eased;
      // Constant radius padding ramped in over the first 10% of the orbit
      // (smoothstep) so the camera smoothly bumps out from its starting
      // position instead of teleporting on frame 1.
      const PADDING_RAMP_FRACTION = 0.1;
      const rawPaddingRamp = Math.min(orbitProgress.current / PADDING_RAMP_FRACTION, 1);
      const paddingRamp = rawPaddingRamp * rawPaddingRamp * (3 - 2 * rawPaddingRamp);
      const radius = baseRadius + orbitRadiusPadding.current * paddingRamp;
      const height = orbitStartHeight.current * (1 - heightEased) + orbitEndHeight.current * heightEased;
      camera.position.set(
        orbitPivot.current.x + radius * Math.cos(angle),
        orbitPivot.current.y + height,
        orbitPivot.current.z + radius * Math.sin(angle),
      );

      // LookAt blend — rotate from the incoming lookAt (e.g. gr80LookAt
      // after the fly-to) to the pivot over the first 30% of the orbit.
      // After that, currentLookAt stays pinned to the pivot.
      const LOOKAT_BLEND_FRACTION = 0.3;
      const rawLookAtBlend = Math.min(p / LOOKAT_BLEND_FRACTION, 1);
      const lookAtEased = rawLookAtBlend * rawLookAtBlend * (3 - 2 * rawLookAtBlend);
      currentLookAt.current.lerpVectors(orbitStartLookAt.current, orbitPivot.current, lookAtEased);
      camera.lookAt(currentLookAt.current);

      if (p >= 1) {
        phase.current = "zoomed";
        sequenceRunningRef.current = false;
        if (controlsRef.current) {
          controlsRef.current.target.copy(orbitPivot.current);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = false;
          controlsRef.current.update();
        }
        if (onArrivedRef?.current) {
          onArrivedRef.current();
          onArrivedRef.current = null;
        }
      }
    }

    // Fly-through to second target.
    // Uses quadratic EASE-IN (starts slow from rest after the captain pause,
    // ends at max velocity 2). Paired with the orbit phase's quadratic
    // ease-out (which starts at velocity 2), so velocity is continuous across
    // the handoff and the camera doesn't visibly pause at GR80 before the
    // orbit begins.
    if (phase.current === "flying-to") {
      flyProgress.current += delta * flySpeed.current;
      const p = Math.min(flyProgress.current, 1);
      const eased = p * p; // quadratic ease-in

      camera.position.lerpVectors(flyStartPos.current, activePos.current, eased);
      currentLookAt.current.lerpVectors(flyStartLookAt.current, activeLookAt.current, eased);
      camera.lookAt(currentLookAt.current);

      // Restore captain visibility once the camera has actually moved past
      // the captain's position. Check against `eased` (the real visual
      // progress) rather than raw `p` — under quadratic ease-in, `p > 0.5`
      // only corresponds to 25% of the visual distance, so we were fading
      // the captain back in while the camera was still near it. Using
      // `eased` makes this correct regardless of which easing curve the
      // fly-to uses.
      if (eased > 0.5 && captainFadeRef.current.target === 0) {
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
        // Notify arrival (used for chaining fly-to stages)
        if (onArrivedRef?.current) {
          onArrivedRef.current();
          onArrivedRef.current = null;
        }
      }
    }

    if (phase.current === "zooming-in") {
      // Arc-path: slerp the direction-from-head from the start angle to the
      // front-of-face angle, while lerping the radius from the user's
      // current distance down to the close-up distance. This means the
      // camera always ends up facing the character from the front, and
      // never cuts through the head geometry en route (which is what the
      // straight-line lerp did when the user clicked from behind).
      zoomProgress.current += delta / ZOOM_IN_DURATION;
      const p = Math.min(zoomProgress.current, 1);
      // Cubic ease-out — starts fast and decelerates all the way to a stop.
      // Previous smoothstep (ease-in-out) felt like a snap because it still
      // had a chunk of velocity near the end; cubic ease-out's derivative
      // drops smoothly from 3 at p=0 to 0 at p=1.
      const eased = 1 - Math.pow(1 - p, 3);

      // Slerp direction using quaternions (handles any start/end angle).
      tmpQuatStart.current.setFromUnitVectors(ZOOM_IN_WORLD_UP, zoomStartDir.current);
      tmpQuatEnd.current.setFromUnitVectors(ZOOM_IN_WORLD_UP, zoomEndDir.current);
      tmpQuat.current.copy(tmpQuatStart.current).slerp(tmpQuatEnd.current, eased);
      tmpDir.current.copy(ZOOM_IN_WORLD_UP).applyQuaternion(tmpQuat.current);

      // Lerp radius.
      const radius = zoomStartRadius.current * (1 - eased) + zoomEndRadius.current * eased;

      camera.position.copy(activeLookAt.current).add(tmpDir.current.multiplyScalar(radius));
      currentLookAt.current.lerpVectors(zoomStartLookAt.current, activeLookAt.current, eased);
      camera.lookAt(currentLookAt.current);

      if (p >= 1) {
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
        inSpaceshipRef.current = false;
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
      intensity={10}
      decay={2}
      distance={10}
      angle={0.35}
      penumbra={0.4}
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
      spotRef.current.target.position.set(-0.4, 1.2, -0.35);
      scene.add(spotRef.current.target);
      return () => scene.remove(spotRef.current.target);
    }
  }, [scene]);

  return (
    <spotLight
      ref={spotRef}
      castShadow
      intensity={1}
      decay={2}
      distance={8}
      angle={0.29}
      penumbra={1}
      position={[-0.02, 1.6, -0.28]}
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0001}
    />
  );
}

/* ── Interior lighting ──
   Fades ambient/exposure down and warm + cool interior fills up whenever
   the camera is "inside" the spaceship (inSpaceshipRef, set true when the
   camera first arrives at the captain and false when the user zooms back
   out). Everything lerps per frame, so transitions are smooth and there
   are no React re-renders. Exterior preset matches the pre-existing
   ambient (0.8) and toneMappingExposure (0.6) so the asteroid scene is
   visually unchanged.

   Tuning:
     - PRESETS.interior.ambient — raise if the interior reads too dark
     - PRESETS.interior.exposure — global multiplier, mostly affects
       non-emissive surfaces
     - warmFill / coolRim position + color — adjust to match the actual
       ship interior geometry. Current positions assume the captain / table
       is roughly at world origin. */
function InteriorLighting() {
  const { inSpaceshipRef } = useContext(ZoomContext);
  const ambientRef = useRef();
  const warmFillRef = useRef();
  const coolRimRef = useRef();
  const { gl } = useThree();

  const PRESETS = {
    exterior: { ambient: 0.8,  warm: 0,  cool: 0,   exposure: 0.6  },
    interior: { ambient: 0.96, warm: 10, cool: 0.9, exposure: 0.37 },
  };
  const LERP_SPEED = 2.5;

  useFrame((_, delta) => {
    const target = inSpaceshipRef.current ? PRESETS.interior : PRESETS.exterior;
    const k = Math.min(1, delta * LERP_SPEED);
    if (ambientRef.current) {
      ambientRef.current.intensity +=
        (target.ambient - ambientRef.current.intensity) * k;
    }
    if (warmFillRef.current) {
      warmFillRef.current.intensity +=
        (target.warm - warmFillRef.current.intensity) * k;
    }
    if (coolRimRef.current) {
      coolRimRef.current.intensity +=
        (target.cool - coolRimRef.current.intensity) * k;
    }
    gl.toneMappingExposure += (target.exposure - gl.toneMappingExposure) * k;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.8} />
      <pointLight
        ref={warmFillRef}
        color="#a2947b"
        intensity={0}
        distance={22.5}
        decay={2}
        position={[0.05, 2.35, 0.8]}
      />
      <pointLight
        ref={coolRimRef}
        color="#6aa7ff"
        intensity={0}
        distance={10}
        decay={2}
        position={[-2.5, 1.2, -2.5]}
      />
    </>
  );
}

/* ── Scrolling LED screen for VendingMachine_Screen1 ── */
function VendingMachineLED({ scene }) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const meshRef = useRef(null);
  const scrollRef = useRef(0);
  const LED_TEXT = "  RL80 TOKEN  ***  REFRESHING  ***  TO THE MOON  ***  ";
  const PIXEL_SIZE = 3;
  const CANVAS_W = 256;
  const CANVAS_H = 32;
  const SCROLL_SPEED = 40; // pixels per second

  // 5x7 dot-matrix font for uppercase + digits + symbols
  const FONT_MAP = {
    A: [0x1f,0x24,0x44,0x24,0x1f], B: [0x7f,0x49,0x49,0x49,0x36],
    C: [0x3e,0x41,0x41,0x41,0x22], D: [0x7f,0x41,0x41,0x22,0x1c],
    E: [0x7f,0x49,0x49,0x49,0x41], F: [0x7f,0x48,0x48,0x48,0x40],
    G: [0x3e,0x41,0x49,0x49,0x2e], H: [0x7f,0x08,0x08,0x08,0x7f],
    I: [0x41,0x41,0x7f,0x41,0x41], J: [0x02,0x01,0x41,0x7e,0x40],
    K: [0x7f,0x08,0x14,0x22,0x41], L: [0x7f,0x01,0x01,0x01,0x01],
    M: [0x7f,0x20,0x10,0x20,0x7f], N: [0x7f,0x10,0x08,0x04,0x7f],
    O: [0x3e,0x41,0x41,0x41,0x3e], P: [0x7f,0x48,0x48,0x48,0x30],
    Q: [0x3e,0x41,0x45,0x42,0x3d], R: [0x7f,0x48,0x4c,0x4a,0x31],
    S: [0x32,0x49,0x49,0x49,0x26], T: [0x40,0x40,0x7f,0x40,0x40],
    U: [0x7e,0x01,0x01,0x01,0x7e], V: [0x7c,0x02,0x01,0x02,0x7c],
    W: [0x7f,0x02,0x04,0x02,0x7f], X: [0x63,0x14,0x08,0x14,0x63],
    Y: [0x60,0x10,0x0f,0x10,0x60], Z: [0x43,0x45,0x49,0x51,0x61],
    "0": [0x3e,0x45,0x49,0x51,0x3e], "1": [0x00,0x21,0x7f,0x01,0x00],
    "2": [0x23,0x45,0x49,0x49,0x31], "3": [0x22,0x41,0x49,0x49,0x36],
    "4": [0x0c,0x14,0x24,0x7f,0x04], "5": [0x72,0x51,0x51,0x51,0x4e],
    "6": [0x1e,0x29,0x49,0x49,0x06], "7": [0x40,0x47,0x48,0x50,0x60],
    "8": [0x36,0x49,0x49,0x49,0x36], "9": [0x30,0x49,0x49,0x4a,0x3c],
    "*": [0x14,0x08,0x3e,0x08,0x14], " ": [0x00,0x00,0x00,0x00,0x00],
  };

  useEffect(() => {
    const mesh = scene.getObjectByName("VendMachine_Screen1");
    if (!mesh) return;
    meshRef.current = mesh;

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvasRef.current = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    textureRef.current = tex;

    mesh.material = new THREE.MeshBasicMaterial({ map: tex });
  }, [scene]);

  useFrame((_, delta) => {
    const canvas = canvasRef.current;
    const tex = textureRef.current;
    if (!canvas || !tex) return;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    scrollRef.current += SCROLL_SPEED * delta;

    // Render each character as dot-matrix
    const charWidth = 6 * PIXEL_SIZE; // 5 cols + 1 gap
    const totalWidth = LED_TEXT.length * charWidth;
    if (scrollRef.current >= totalWidth) scrollRef.current -= totalWidth;

    for (let ci = 0; ci < LED_TEXT.length; ci++) {
      const ch = LED_TEXT[ci].toUpperCase();
      const cols = FONT_MAP[ch];
      if (!cols) continue;
      const xBase = ci * charWidth - scrollRef.current;
      // Wrap for seamless scrolling
      const drawX = ((xBase % totalWidth) + totalWidth) % totalWidth;
      // Also draw a second copy for seamless wrap
      for (const offsetX of [drawX, drawX - totalWidth]) {
        if (offsetX > CANVAS_W || offsetX + charWidth < 0) continue;
        for (let col = 0; col < 5; col++) {
          for (let row = 0; row < 7; row++) {
            if (cols[col] & (1 << row)) {
              // Green LED glow with slight brightness variation
              const brightness = 180 + Math.random() * 75;
              ctx.fillStyle = `rgb(0, ${brightness}, ${Math.floor(brightness * 0.3)})`;
              ctx.fillRect(
                offsetX + col * PIXEL_SIZE,
                1 + row * PIXEL_SIZE,
                PIXEL_SIZE - 1,
                PIXEL_SIZE - 1
              );
            }
          }
        }
      }
    }

    tex.needsUpdate = true;
  });

  return null;
}

/* ── Rover data on TableScreen1–4 ── */
// Each screen gets its own data set with a staggered typing effect.
// The screens are small in-world meshes attached to the table, so we
// use a compact layout with a CRT-green palette.

const TABLE_SCREEN_DATA = [
  {
    title: "GEO SURVEY",
    lines: [
      "Density  3.41 g/cm³",
      "Depth    42.7 km",
      "Silicate 68%",
      "Fe-Oxide 19%",
      "Unknown  13%",
      "",
      "SEISMIC: MODERATE",
      "P-Wave   6.12 km/s",
    ],
  },
  {
    title: "CORE DATA",
    lines: [
      "Temp     5,430 K",
      "Pressure 364 GPa",
      "State    SOLID",
      "",
      "OUTER CORE",
      "Flow     0.04 cm/s",
      "Dynamo   ACTIVE",
    ],
  },
  {
    title: "MINERALS",
    lines: [
      "Olivine  34.2%",
      "Pyroxene 28.7%",
      "Plagio   18.1%",
      "Ilmenite  6.4%",
      "",
      "Ir 8.3ppb Os 4.1ppb",
      "!! ANOMALY !!",
    ],
  },
  {
    title: "DRILL LOG",
    lines: [
      "Depth    18.4 m",
      "Bit Temp 412°C",
      "Torque   87% MAX",
      "",
      "RPM      1,240",
      "Coolant  OK",
      "STATUS: NOMINAL",
    ],
  },
];

const TS_CANVAS_W = 256;
const TS_CANVAS_H = 256;
const TS_CHARS_PER_SEC = 22;
const TS_PAUSE_SEC = 5;
const TS_FONT = 18;
const TS_LINE_H = 24;
const TS_HEADER_FONT = 20;
const TS_MARGIN = 12;
const TS_TOP = 34;
// Stagger: each screen starts typing this many seconds after the previous
const TS_STAGGER = 1.5;

function TableScreens({ scene }) {
  const screensRef = useRef([]);

  useEffect(() => {
    const screens = [];
    for (let i = 0; i < 4; i++) {
      const mesh = scene.getObjectByName(`TableScreen${i + 1}`);
      if (!mesh) continue;

      const canvas = document.createElement("canvas");
      canvas.width = TS_CANVAS_W;
      canvas.height = TS_CANVAS_H;
      const ctx = canvas.getContext("2d");
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      // Flip texture vertically — GLB UVs are often inverted relative to
      // canvas 2D's top-left origin.
      tex.flipY = false;
      mesh.material = new THREE.MeshBasicMaterial({ map: tex });

      const data = TABLE_SCREEN_DATA[i];
      const totalChars = data.lines.reduce((s, l) => s + l.length, 0);

      screens.push({
        mesh, canvas, ctx, tex, data, totalChars,
        charCount: 0,
        pauseUntil: 0,
        scanIndex: 0,
        // Each screen starts after a stagger delay
        startAt: TS_STAGGER * i,
        started: false,
      });
    }
    screensRef.current = screens;

  }, [scene]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const dt = delta;

    for (const scr of screensRef.current) {
      // Stagger start
      if (!scr.started) {
        if (t < scr.startAt) continue;
        scr.started = true;
      }

      // Pause between cycles
      if (scr.pauseUntil > 0) {
        // Keep redrawing during pause so the cursor blinks off
        drawScreen(scr, t);
        if (t < scr.pauseUntil) continue;
        // Cycle to the next data set
        scr.scanIndex = (scr.scanIndex + 1) % TABLE_SCREEN_DATA.length;
        scr.data = TABLE_SCREEN_DATA[scr.scanIndex];
        scr.totalChars = scr.data.lines.reduce((s, l) => s + l.length, 0);
        scr.charCount = 0;
        scr.pauseUntil = 0;
      }

      // Advance typing
      scr.charCount = Math.min(scr.totalChars, scr.charCount + TS_CHARS_PER_SEC * dt);

      // Check if done
      if (scr.charCount >= scr.totalChars && scr.pauseUntil === 0) {
        scr.pauseUntil = t + TS_PAUSE_SEC;
      }

      drawScreen(scr, t);
    }
  });

  return null;
}

function drawScreen(scr, t) {
  const { ctx, tex, data } = scr;
  const w = TS_CANVAS_W;
  const h = TS_CANVAS_H;

  // Background
  ctx.fillStyle = "#010a06";
  ctx.fillRect(0, 0, w, h);

  // Scanlines
  ctx.strokeStyle = "rgba(0, 255, 80, 0.03)";
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Title
  ctx.font = `bold ${TS_HEADER_FONT}px "Courier New", monospace`;
  ctx.fillStyle = "#00ff55";
  ctx.shadowColor = "#00ff55";
  ctx.shadowBlur = 6;
  ctx.fillText(data.title, TS_MARGIN, TS_TOP);
  ctx.shadowBlur = 0;

  // Divider
  ctx.strokeStyle = "#00aa33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TS_MARGIN, TS_TOP + 8);
  ctx.lineTo(w - TS_MARGIN, TS_TOP + 8);
  ctx.stroke();

  // Data lines with typing
  ctx.font = `${TS_FONT}px "Courier New", monospace`;
  let charsLeft = Math.floor(scr.charCount);
  let y = TS_TOP + 14 + TS_LINE_H;

  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i];
    if (charsLeft <= 0) break;

    const visible = line.slice(0, charsLeft);
    charsLeft -= line.length;

    if (line.includes("!!") || line.startsWith("STATUS")) {
      ctx.fillStyle = "#ffcc00";
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = 4;
    } else {
      ctx.fillStyle = "#00dd44";
      ctx.shadowBlur = 0;
    }

    ctx.fillText(visible, TS_MARGIN, y);
    ctx.shadowBlur = 0;

    // Blinking cursor
    if (charsLeft <= 0 && scr.charCount < scr.totalChars) {
      const cx = TS_MARGIN + ctx.measureText(visible).width + 2;
      if (Math.floor(t * 3) % 2 === 0) {
        ctx.fillStyle = "#00ff55";
        ctx.fillRect(cx, y - TS_FONT + 3, 10, TS_FONT);
      }
    }

    y += TS_LINE_H;
  }

  tex.needsUpdate = true;
}

/* ── 3D Model ── */
function Model({ url }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);

  const { actions } = useAnimations(animations, group);

  const gr80HipsRef = useRef(null); // GR80's Hips bone for rotation pinning
  const gr80HipsRotRef = useRef(null); // stored quaternion
  const { zoomed, setZoomed, setTargetPos, setTargetLookAt, onArrivedRef, flyToRef, orbitTableRef, spotTargetRef, captainFadeRef, sequenceRunningRef, breakOutRef, inSpaceshipRef } = useContext(ZoomContext);
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

  // Drone_Empty ref — the parent of all drone parts. Rotated every frame to
  // face the viewer once the camera has entered the ship (see the drone
  // tracking useFrame below).
  const droneEmptyRef = useRef(null);

  // Control panel button refs — Button01..Button20 blink independently so the
  // shared panel mesh feels alive. Materials are cloned per-button in the
  // setup effect below so emissiveIntensity can vary per mesh.
  const buttonsRef = useRef([]);

  // Find and pin Hips bones to prevent crossfade sliding
  // Also find GR80's Head bone for camera flythrough
  useEffect(() => {


    // Find captain's parent mesh for hiding during fly-through
    const captainEmpty = scene.getObjectByName("Empty_Captain");
    if (captainEmpty) {
      captainMeshRef.current = captainEmpty;
      // One-time diagnostic: log every mesh + material under Captain
      captainEmpty.traverse((child) => {
        if (child.isMesh && child.material) {
          const m = child.material;
   
        }
      });
    }

    const gr80Empty = scene.getObjectByName("EMPTY_GR80");
    if (gr80Empty) {
      gr80Empty.traverse((node) => {
        if (node.name === "Head" && !gr80HeadRef.current) {
          gr80HeadRef.current = node;
        }
        if (node.isBone && node.name === "Hips" && !gr80HipsRef.current) {
          gr80HipsRef.current = node;
          gr80HipsRotRef.current = node.quaternion.clone();
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

    }

    // Find Button01..Button20, clone their materials so emissiveIntensity is
    // independent per button, and assign a random blink style + phase so they
    // never sync. baseEmissive captures whatever intensity was baked in the GLB.
    const buttons = [];
    const styles = ['pulse', 'blink', 'steady', 'flicker'];
    for (let i = 1; i <= 20; i++) {
      const name = `Button${String(i).padStart(2, '0')}`;
      const mesh = scene.getObjectByName(name);
      if (!mesh || !mesh.material) continue;
      mesh.material = mesh.material.clone();
      const base = mesh.material.emissiveIntensity ?? 1;
      mesh.userData.baseEmissive = base;
      mesh.userData.blinkStyle = styles[Math.floor(Math.random() * styles.length)];
      mesh.userData.blinkFreq = 0.5 + Math.random() * 3.5;
      mesh.userData.blinkPhase = Math.random() * Math.PI * 2;
      mesh.userData.nextFlickerAt = 0;
      mesh.userData.flickerUntil = 0;
      buttons.push(mesh);
    }
    buttonsRef.current = buttons;


    // Windows — swap each porthole (outer + inner glass) to MeshBasicMaterial
    // so it's fully unlit. The interior lighting preset drops ambient to
    // ~0.12 to make the button blinks pop, which would otherwise turn the
    // glass black since it has nothing to reflect. MeshBasicMaterial
    // bypasses lighting entirely and just draws the texture as-is, so the
    // starfield / skybox baked into the window texture stays bright
    // regardless of what the rest of the scene is doing.
    let windowsFound = 0;
    for (let i = 1; i <= 5; i++) {
      for (const suffix of ['', '_Inner']) {
        const name = `Window${i}${suffix}`;
        const mesh = scene.getObjectByName(name);
        if (!mesh || !mesh.material) continue;
        const old = mesh.material;
        mesh.material = new THREE.MeshBasicMaterial({
          map: old.map,
          color: old.color,
          transparent: old.transparent,
          opacity: old.opacity,
          side: old.side,
          alphaMap: old.alphaMap,
          alphaTest: old.alphaTest,
          toneMapped: false, // don't let toneMappingExposure dim it either
        });
        windowsFound++;
      }
    }
 

    // Halo — boost emissive + fake bloom sprite
    const halo = scene.getObjectByName("Halo");
    if (halo) {
      halo.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color("#dccb30ff");
          child.material.emissiveIntensity = 3.0;
          child.material.toneMapped = true;
          child.material.needsUpdate = true;
        }
      });

      // Fake bloom disc — a flat plane with a radial glow texture, oriented
      // to match the halo's ring. Uses a PlaneGeometry rotated to lie in the
      // XZ plane (like the halo) instead of a Sprite (which billboards and
      // looks spherical). One extra quad, zero postprocessing.
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
      );
      grad.addColorStop(0, "rgba(255, 235, 80, 0.8)");
      grad.addColorStop(0.2, "rgba(255, 225, 60, 0.45)");
      grad.addColorStop(0.5, "rgba(255, 210, 50, 0.12)");
      grad.addColorStop(0.75, "rgba(255, 200, 40, 0.03)");
      grad.addColorStop(1, "rgba(255, 200, 40, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const glowTex = new THREE.CanvasTexture(canvas);

      const haloBox = new THREE.Box3().setFromObject(halo);
      const haloSize = new THREE.Vector3();
      haloBox.getSize(haloSize);
      const haloCenter = new THREE.Vector3();
      haloBox.getCenter(haloCenter);
      const discScale = Math.max(haloSize.x, haloSize.z) * 6.8;

      const glowGeo = new THREE.PlaneGeometry(1, 1);
      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      // Compute orientation from halo geometry vertices in LOCAL space
      // (since we'll parent glowMesh to halo, everything is relative to
      // the halo's own coordinate system).
      let haloMesh = null;
      halo.traverse((child) => {
        if (!haloMesh && child.isMesh) haloMesh = child;
      });
      if (haloMesh) {
        const pos = haloMesh.geometry.attributes.position;
        const a = new THREE.Vector3().fromBufferAttribute(pos, 0);
        const iB = Math.floor(pos.count / 3);
        const iC = Math.floor((pos.count * 2) / 3);
        const b = new THREE.Vector3().fromBufferAttribute(pos, iB);
        const c = new THREE.Vector3().fromBufferAttribute(pos, iC);
        const localNormal = new THREE.Vector3()
          .crossVectors(
            new THREE.Vector3().subVectors(b, a),
            new THREE.Vector3().subVectors(c, a)
          ).normalize();
        // PlaneGeometry faces +Z by default — rotate so +Z aligns with the
        // halo geometry's local face normal
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1), localNormal
        );
        glowMesh.quaternion.copy(q);
      }
      // Position at halo's local-space center and scale to match
      const localCenter = new THREE.Vector3();
      const localBox = new THREE.Box3();
      if (haloMesh) {
        haloMesh.geometry.computeBoundingBox();
        haloMesh.geometry.boundingBox.getCenter(localCenter);
      }
      glowMesh.position.copy(localCenter);
      glowMesh.scale.set(discScale, discScale, 1);
      halo.add(glowMesh);
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

  // Control panel button blink loop — modulates emissiveIntensity per-button
  // based on the style picked in the setup effect. All buttons share the same
  // diffuse + emission textures; only the intensity scalar varies.
  useFrame(({ clock }) => {
    const buttons = buttonsRef.current;
    if (!buttons.length) return;
    const t = clock.getElapsedTime();

    for (const mesh of buttons) {
      const mat = mesh.material;
      if (!mat) continue;
      const base = mesh.userData.baseEmissive;
      const freq = mesh.userData.blinkFreq;
      const phase = mesh.userData.blinkPhase;

      switch (mesh.userData.blinkStyle) {
        case 'pulse': {
          // Soft sine pulse between 0.3× and 1.7× base
          const k = 0.5 + 0.5 * Math.sin(t * freq + phase);
          mat.emissiveIntensity = base * (0.3 + k * 1.4);
          break;
        }
        case 'blink': {
          // Hard on/off square wave
          const on = ((t * freq + phase) % (Math.PI * 2)) < Math.PI;
          mat.emissiveIntensity = base * (on ? 2.0 : 0.15);
          break;
        }
        case 'flicker': {
          // Mostly steady, occasional brief dropout
          if (t > mesh.userData.nextFlickerAt) {
            mesh.userData.flickerUntil = t + 0.05 + Math.random() * 0.12;
            mesh.userData.nextFlickerAt = t + 1 + Math.random() * 4;
          }
          const flickering = t < mesh.userData.flickerUntil;
          mat.emissiveIntensity = base * (flickering ? 0.2 : 1.3);
          break;
        }
        case 'steady':
        default:
          mat.emissiveIntensity = base;
          break;
      }
    }
  });

  // ── Drone tracker ──
  // Once the camera has entered the ship (i.e. stopped at the captain at
  // least once), rotate Drone_Empty every frame so it "looks at" the camera.
  //
  // Axis note: the drone's authored forward — i.e. the local axis that should
  // point *at* the viewer — matches the captain's forward, which faces world
  // +Z. Three's Object3D.lookAt(target) orients the object's local −Z toward
  // `target`, so calling it with `camera.position` directly would make the
  // drone face *away* from the viewer. To get local +Z pointing at the
  // camera we aim lookAt at the camera position mirrored through the drone
  // (`2 * dronePos - cameraPos`), which makes local −Z point away from the
  // camera and therefore local +Z point at it.
  //
  // If the drone ever ends up tilted or backward after swapping models, the
  // simplest fix is to change the single axis assumption here — either call
  // `drone.lookAt(camera.position)` directly (if the new model's forward is
  // −Z) or build a small quaternion correction for whichever local axis is
  // forward.
  const droneTmpDronePos = useRef(new THREE.Vector3());
  const droneTmpAim = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    if (!inSpaceshipRef.current) return;
    const drone = droneEmptyRef.current;
    if (!drone) return;

    drone.getWorldPosition(droneTmpDronePos.current);
    droneTmpAim.current
      .copy(droneTmpDronePos.current)
      .multiplyScalar(2)
      .sub(camera.position);
    drone.lookAt(droneTmpAim.current);
  });

  useEffect(() => {
    const standing = actions["standing"];
    const looking = actions["looking"];
    const idle = actions["idle"];
    if (!standing) return;

    // GR80: alternate between idle and button_pushing
    const neckTilt = actions["neckTilt"];
    if (idle) {
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.reset().fadeIn(0.3).play();

      if (neckTilt) {
        neckTilt.setLoop(THREE.LoopOnce, 1);
        neckTilt.clampWhenFinished = true;

        const scheduleButtonPush = () => {
          const delay = 5000 + Math.random() * 10000;
          gr80Timer.current = setTimeout(() => {
            neckTilt.reset().fadeIn(0.3).play();
            idle.fadeOut(0.3);

            const onFinished = (e) => {
              if (e.action === neckTilt) {
                neckTilt.getMixer().removeEventListener("finished", onFinished);
                idle.reset().fadeIn(0.5).play();
                neckTilt.fadeOut(0.5);
                scheduleButtonPush();
              }
            };
            neckTilt.getMixer().addEventListener("finished", onFinished);
          }, delay);
        };

        scheduleButtonPush();
      }
    }

    // H80Z: play sit_pose animation
    const sitPose = actions["sit_pose"];
    if (sitPose) {
      sitPose.reset().fadeIn(0.1).play();
      sitPose.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Log H80Z positioning info for camera/spotlight setup
    const h80zEmpty = scene.getObjectByName("Empty_H80Z");
    if (h80zEmpty) {
      scene.updateMatrixWorld(true);
      const h80zWorld = new THREE.Vector3();
      h80zEmpty.getWorldPosition(h80zWorld);


      let h80zHips = null;
      h80zEmpty.traverse((n) => {
        if (n.name === "Hips" && !h80zHips) h80zHips = n;
      });
      if (h80zHips) {
        const hipsWorld = new THREE.Vector3();
        h80zHips.getWorldPosition(hipsWorld);
   
      }

      let h80zHead = null;
      h80zEmpty.traverse((n) => {
        if (n.name === "Head" && !h80zHead) h80zHead = n;
      });
      if (h80zHead) {
        const headWorld = new THREE.Vector3();
        h80zHead.getWorldPosition(headWorld);

      }
    }

    // Drone: play Take 001 animation
    const droneAnim = actions["Take 001"];
    if (droneAnim) {
      droneAnim.reset().fadeIn(0.5).play();
      droneAnim.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Flag: play KeyAction animation on loop
    const flagAnim = actions["KeyAction"];
    if (flagAnim) {
      flagAnim.reset().fadeIn(0.5).play();
      flagAnim.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Log Drone positioning info for camera/spotlight setup + stash the
    // node so the drone-tracking useFrame can rotate it each frame.
    const droneEmpty = scene.getObjectByName("Drone_Empty");
    if (droneEmpty) {
      droneEmptyRef.current = droneEmpty;
      scene.updateMatrixWorld(true);
      const droneWorld = new THREE.Vector3();
      droneEmpty.getWorldPosition(droneWorld);

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
              // Bail out if the user clicked during the 2s pause to break
              // out of the sequence — we no longer want to fly to GR80.
              if (!sequenceRunningRef.current) return;
              // Fade out captain slightly after camera starts moving
              setTimeout(() => {
                if (!sequenceRunningRef.current) return;
                captainFadeRef.current.target = 0;
              }, 2300);
          

              // Helper: build the orbit-table request that triggers the
              // CameraController's "orbiting-table" phase. Used by both
              // the primary (gr80HeadRef) and fallback (EMPTY_GR80)
              // paths so the orbit always runs regardless of which path
              // the GR80 fly-to took. If the GLTF doesn't contain a
              // "Table" mesh, falls back to a manual pivot near GR80 so
              // the orbit still happens — just around the character
              // instead of around the hologram.
              const buildOrbitRequest = (fallbackPivot) => {
                // ── Orbit tunables — adjust these to tweak the motion ──
                // Radius is interpolated smoothly (smoothstep) from the
                // camera's current distance to ORBIT_END_RADIUS across the
                // whole orbit, so the camera gradually pulls back the
                // entire time.
                // Height uses a cubic ease-in, so it stays near the starting
                // height for most of the sweep and only lifts to
                // ORBIT_END_HEIGHT in the final stretch (per your note:
                // "the camera can pull up just at the very end").
                // End-angle = laps * 360° + ORBIT_END_ANGLE_DEG. Integer
                // `laps` lands at the starting direction from the pivot;
                // the degree offset rotates it past that to the framing
                // you want to land on.
                const ORBIT_END_RADIUS     = 0.55;   // final horizontal distance from pivot
                const ORBIT_END_HEIGHT     = 0.0;   // final Y above pivot (hit only at the very end)
                const ORBIT_END_ANGLE_DEG  = -110;  // degrees past n laps — tune to land the framing
                const ORBIT_LAPS           = 1.0;   // full rotations
                const ORBIT_DURATION_SEC   = 25;    // total sweep time (seconds)
                const ORBIT_DIRECTION      = 1;     // +1 CCW from above, -1 CW
                // Constant added to the orbit's radius throughout the
                // sweep, so the camera stays farther from the pivot for
                // the whole orbit (not just at the end). Ramped in over
                // the first ~10% of the orbit to avoid a visible "step
                // out" at the start.
                const ORBIT_RADIUS_PADDING = 0.03;

                const table = scene.getObjectByName("Table");
                const pivot = new THREE.Vector3();
                if (table) {
                  scene.updateMatrixWorld(true);
                  const tableBox = new THREE.Box3().setFromObject(table);
                  tableBox.getCenter(pivot);
                  pivot.y = tableBox.max.y + 0.12;
          
                } else {
                  console.warn("[orbit-table] 'Table' mesh not found — falling back to pivot near GR80");
                  pivot.copy(fallbackPivot);
                }
                return {
                  pivot,
                  radius: ORBIT_END_RADIUS,
                  heightOffset: ORBIT_END_HEIGHT,
                  endAngleOffset: THREE.MathUtils.degToRad(ORBIT_END_ANGLE_DEG),
                  laps: ORBIT_LAPS,
                  duration: ORBIT_DURATION_SEC,
                  direction: ORBIT_DIRECTION,
                  radiusPadding: ORBIT_RADIUS_PADDING,
                };
              };

              if (gr80HeadRef.current) {
                const gr80LookAt = new THREE.Vector3();
                gr80HeadRef.current.getWorldPosition(gr80LookAt);
        
                // Backed up from 0.5 → 0.8 to keep the camera clear of GR80's mesh.
                const gr80Pos = gr80LookAt.clone().add(new THREE.Vector3(0, 0, 0.8));
                flyToRef.current = { pos: gr80Pos, lookAt: gr80LookAt };

                // After arriving at GR80, enter the orbit-table phase
                // instead of snapping to a fixed lookAt. The camera will
                // sweep horizontally around the hologram for ~1.5 laps,
                // then hand control back to OrbitControls. See the
                // "orbiting-table" phase in CameraController.
                onArrivedRef.current = () => {

                  orbitTableRef.current = buildOrbitRequest(gr80LookAt);
                };
              } else {
                // Fallback: fly to EMPTY_GR80 position directly
                const gr80Empty = scene.getObjectByName("EMPTY_GR80");
      
                if (gr80Empty) {
                  scene.updateMatrixWorld(true);
                  const gr80World = new THREE.Vector3();
                  gr80Empty.getWorldPosition(gr80World);
                  // Look at chest/face height
                  const gr80LookAtFallback = gr80World.clone();
                  gr80LookAtFallback.y += 0.15;
                  // Camera in front of GR80 (positive Z = toward viewer).
                  // Backed up from 0.4 → 0.7 to keep clear of the mesh.
                  const gr80Pos = new THREE.Vector3(gr80World.x, gr80World.y + 0.21, gr80World.z + 0.7);
                  flyToRef.current = { pos: gr80Pos, lookAt: gr80LookAtFallback };
                  // Move spotlight to GR80
                  spotTargetRef.current = { pos: gr80World.clone().add(new THREE.Vector3(0, 2, 0.5)), lookAt: gr80World.clone() };

                  // After arriving at GR80, enter the orbit-table phase
                  // (same as primary path). If Table mesh is missing, the
                  // helper falls back to orbiting around gr80LookAtFallback.
                  onArrivedRef.current = () => {
               
                    orbitTableRef.current = buildOrbitRequest(gr80LookAtFallback);
                  };
                }
              }
              }, 1000);
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
      neckTilt?.stop();
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

    // If the intro sequence is running (i.e. we've already stopped at the
    // captain once and the scripted fly-to / orbit-table is playing), any
    // click on the model breaks out of the animation instead of
    // restarting it. The break is processed by CameraController next frame.
    if (sequenceRunningRef.current) {
      breakOutRef.current = true;
      return;
    }
    // TableScreen click — if the user clicked one of the 4 table screens,
    // fly the camera to frame it regardless of zoom state.
    if (e.object && e.object.name && e.object.name.startsWith("TableScreen")) {
      scene.updateMatrixWorld(true);
      const screenCenter = new THREE.Vector3();
      const box = new THREE.Box3().setFromObject(e.object);
      box.getCenter(screenCenter);
      // Direction from the table center outward through the screen —
      // reliable regardless of how the mesh's local axes are oriented.
      const table = scene.getObjectByName("Table");
      const tableCenter = new THREE.Vector3();
      if (table) {
        const tBox = new THREE.Box3().setFromObject(table);
        tBox.getCenter(tableCenter);
      }
      const outward = new THREE.Vector3()
        .subVectors(screenCenter, tableCenter);
      outward.y = 0; // keep it horizontal
      outward.normalize();
      // Position the camera just in front of the screen (a short hop
      // outward from the surface) so clicking pulls the camera *toward*
      // the screen rather than backing away.
      const camPos = screenCenter.clone().add(outward.multiplyScalar(0.05));
      camPos.y = screenCenter.y + 0.1;

      if (zoomedRef.current) {
        flyToRef.current = { pos: camPos, lookAt: screenCenter, speed: 0.5 };
      } else {
        setTargetLookAt(screenCenter);
        setTargetPos(camPos);
        setZoomed(true);
      }
      return;
    }

    // Already zoomed — if we're mid zoom-in, treat as a break-out;
    // otherwise we're in the post-break-out steady state, just ignore.
    if (zoomedRef.current) {
      if (!sequenceRunningRef.current) {
        breakOutRef.current = true;
      }
      return;
    }

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

    // Fixed front-of-face destination — the character faces world +Z.
    // CameraController arcs the camera around to this position via slerp
    // (see its zooming-in phase) instead of lerping in a straight line,
    // so starting the zoom from behind the model won't clip through the
    // head geometry.
    const zoomPos = lookAt.clone().add(new THREE.Vector3(0, 0, 0.22));

    setTargetLookAt(lookAt);
    setTargetPos(zoomPos);
    setZoomed(true);

    // When camera arrives at the captain (the "first stop"), mark the
    // scripted sequence as running. From this point on, any click on the
    // scene breaks out of the remaining animation (see CameraController's
    // break-out handler and Model/handleClick + Canvas/onPointerMissed).
    clearTimeout(lookingTimer.current);
    onArrivedRef.current = () => {
      sequenceRunningRef.current = true;
      // "Entered the spaceship" — from here until the camera fully zooms
      // back out, the drone will actively track the viewer.
      inSpaceshipRef.current = true;
      if (lookingPlayRef.current) {
        lookingPlayRef.current();
      }
    };
  }, [scene, setZoomed, setTargetPos, setTargetLookAt, onArrivedRef]);

  return (
    <>
      <primitive ref={group} object={scene} onClick={handleClick} />
      <VendingMachineLED scene={scene} />
      <TableScreens scene={scene} />
    </>
  );
}

/* ── Project Antenna world position to screen coords for beam overlay ── */
function AntennaProjector({ antennaScreenRef }) {
  const { scene } = useGLTF("/models/Scene3.glb");
  const antennaRef = useRef(null);
  const tmpVec = useRef(new THREE.Vector3());

  useEffect(() => {
    const antenna = scene.getObjectByName("Antenna");
    if (antenna) antennaRef.current = antenna;
  }, [scene]);

  useFrame(({ camera, gl }) => {
    if (!antennaRef.current) return;
    antennaRef.current.getWorldPosition(tmpVec.current);
    tmpVec.current.y += 0.35; // offset to antenna tip
    tmpVec.current.project(camera);
    const canvas = gl.domElement;
    antennaScreenRef.current.x = (tmpVec.current.x * 0.5 + 0.5) * canvas.clientWidth;
    antennaScreenRef.current.y = (-tmpVec.current.y * 0.5 + 0.5) * canvas.clientHeight;
  });

  return null;
}

export default function SpaceScene({ onZoomChange, antennaScreenRef } = {}) {
  const [zoomed, setZoomed] = useState(false);
  const [targetPos, setTargetPos] = useState(() => new THREE.Vector3(0, 0, 6));
  const [targetLookAt, setTargetLookAt] = useState(() => new THREE.Vector3(0, 0, 0));
  const onArrivedRef = useRef(null);
  const flyToRef = useRef(null);
  const orbitTableRef = useRef(null); // { pivot, radius?, heightOffset?, laps?, duration?, direction? }
  const spotTargetRef = useRef(null); // { pos, lookAt } for spotlight to lerp toward
  const captainFadeRef = useRef({ target: 1, current: 1 });
  // True from the moment the camera first arrives at the captain through
  // the end of the orbit-table sweep. During this window any click on the
  // scene cancels the remaining animation and hands control to OrbitControls.
  const sequenceRunningRef = useRef(false);
  // Set to true by a click during the scripted sequence; consumed by
  // CameraController on the next frame to perform the break-out.
  const breakOutRef = useRef(false);
  // True once the camera has "entered the spaceship" — i.e. reached the
  // captain for the first time — and stays true until the camera fully
  // zooms back out to the default starfield. Used by the drone to decide
  // whether to actively track (lookAt) the viewer. Lives longer than
  // `sequenceRunningRef` (which ends at orbit-table completion / break-out)
  // so the drone keeps tracking after the scripted sequence ends.
  const inSpaceshipRef = useRef(false);

  // Notify the parent when the zoom state flips so it can fade HUD overlays.
  useEffect(() => {
    onZoomChange?.(zoomed);
  }, [zoomed, onZoomChange]);

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
    orbitTableRef,
    spotTargetRef,
    captainFadeRef,
    sequenceRunningRef,
    breakOutRef,
    inSpaceshipRef,
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
        onPointerMissed={() => {
          // Clicks on empty space break out of any in-progress animation
          // (scripted sequence or initial zoom-in); otherwise zoom out.
          if (sequenceRunningRef.current) {
            breakOutRef.current = true;
          } else if (zoomed) {
            breakOutRef.current = true;
          }
        }}
        dpr={[1.5, 2]}
        shadows
        gl={{ toneMappingExposure: 0.6 }}
        camera={{ position: [0, 0, 16], fov: 75 }}
      >
        <ZoomContext.Provider value={zoomCtx}>
          {/* Perf monitor — drei's <Stats> wraps stats.js. Position is
              overridden to top-right via the `.stats-top-right` rule in
              space.css (stats.js defaults to top-left). */}
          <Stats className="stats-top-right" />
          <PerspectiveCamera makeDefault position={[0, 0, 16]} fov={75} />
          <CameraController controlsRef={controlsRef} />
          {/* <CaptainSpotlight /> */}
          {/* <H80ZSpotlight /> */}
          <InteriorLighting />
          <Suspense fallback={null}>
            <fog attach="fog" args={['#272730', 16, 30]} />
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
            <Model url="/models/Scene3.glb" />
            {/* HoloProjector: existing 3D hologram (tesseract / penrose / etc.) */}
            {/* <HoloProjector /> */}
            {/* HologooR3F: in-scene port of the Hologoo metaball shader,
                billboarded above the Table. Additive blending — delete the
                HoloProjector line above if you want this to replace it
                rather than sit alongside. */}
            <HologooR3F />
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
          {antennaScreenRef && <AntennaProjector antennaScreenRef={antennaScreenRef} />}
          {/* <EffectComposer>
            <Bloom
              luminanceThreshold={1.0}
              luminanceSmoothing={0.3}
              intensity={0.5}
              mipmapBlur
            />
          </EffectComposer> */}
        </ZoomContext.Provider>
      </Canvas>

      <div className="layer" />
    </div>
  );
}

useGLTF.preload("/models/Scene3.glb");
