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

// Shotgun mesh names for Duck Hunt
const SHOTGUN_MESHES = new Set(["Shotgun1", "Shotgun2"]);
// Target mesh names at the center of each duck (12 ducks)
const TARGET_MESHES = new Set([
  "Target1", "Target2", "Target3", "Target4",
  "Target5", "Target6", "Target7", "Target8",
  "Target9", "Target10", "Target11", "Target12",
]);
// Duck mesh names (hittable directly)
const DUCK_MESHES = new Set([
  "Duck1", "Duck2", "Duck3", "Duck4",
  "Duck5", "Duck6", "Duck7", "Duck8",
  "Duck9", "Duck10", "Duck11", "Duck12",
]);
// Map target/duck → DuckPivot name (the object we rotate)
const TO_PIVOT = {};
for (let i = 1; i <= 12; i++) {
  TO_PIVOT[`Target${i}`] = `DuckPivot${i}`;
  TO_PIVOT[`Duck${i}`] = `DuckPivot${i}`;
}

// Handles click detection on arcade cabinet and camera fly-into-screen animation
function ScreenZoomPortal({ scene, onEnterScreen, onZoomReady, confirmAction }) {
  const { camera, controls, gl, raycaster } = useThree();
  const isZooming = useRef(false);
  const isPaused = useRef(false);
  const isZoomingBack = useRef(false);
  const hasFired = useRef(false);
  const hasNotifiedReady = useRef(false);
  const zoomProgress = useRef(0);
  const zoomBackProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const startFov = useRef(50);
  const screenCenter = useRef(new THREE.Vector3());
  const frontPos = useRef(new THREE.Vector3());
  // Snapshot of paused camera state for zoom-back
  const pausedPos = useRef(new THREE.Vector3());
  const pausedTarget = useRef(new THREE.Vector3());
  const pausedFov = useRef(15);

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

  // React to confirmAction prop changes
  useEffect(() => {
    if (confirmAction === "enter" && isPaused.current) {
      // Resume zoom into screen
      isPaused.current = false;
      isZooming.current = true;
    } else if (confirmAction === "back" && isPaused.current) {
      // Zoom back out
      isPaused.current = false;
      isZooming.current = false;
      isZoomingBack.current = true;
      zoomBackProgress.current = 0;
      pausedPos.current.copy(camera.position);
      pausedTarget.current.copy(controls ? controls.target : screenCenter.current);
      pausedFov.current = camera.fov;
    }
  }, [confirmAction, camera, controls]);

  // Click handler
  useEffect(() => {
    const handleClick = (event) => {
      if (isZooming.current || isPaused.current || isZoomingBack.current) return;

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
        isPaused.current = false;
        hasFired.current = false;
        hasNotifiedReady.current = false;
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
    // Zoom-back animation
    if (isZoomingBack.current) {
      zoomBackProgress.current += delta * 1.2;
      const t = Math.min(zoomBackProgress.current, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad

      camera.position.lerpVectors(pausedPos.current, startPos.current, eased);
      camera.fov = THREE.MathUtils.lerp(pausedFov.current, startFov.current, eased);
      camera.updateProjectionMatrix();

      if (controls) {
        controls.target.lerpVectors(pausedTarget.current, startTarget.current, eased);
        controls.update();
      }

      if (t >= 1) {
        isZoomingBack.current = false;
        if (controls) controls.enabled = true;
      }
      return;
    }

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

    // Pause at 85% and show confirm popup
    if (eased > 0.85 && !hasNotifiedReady.current) {
      hasNotifiedReady.current = true;
      isZooming.current = false;
      isPaused.current = true;
      if (onZoomReady) onZoomReady();
      return;
    }

    // Fire transition after confirm resumes zoom past 95%
    if (eased > 0.95 && !hasFired.current && onEnterScreen) {
      hasFired.current = true;
      onEnterScreen();
    }
  });

  return null;
}

// ─── Duck Hunt Shooting Gallery ───────────────────────────────────────────────
function DuckHuntGame({ scene }) {
  const { camera, controls, gl, raycaster, scene: rootScene } = useThree();
  const [aimMode, setAimMode] = useState(false);
  const isZoomingToGun = useRef(false);
  const zoomProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const startFov = useRef(70);
  const aimPos = useRef(new THREE.Vector3());
  const aimTarget = useRef(new THREE.Vector3());
  const crosshairRef = useRef(null);
  const savedControls = useRef(null);
  const aimYaw = useRef(0);   // horizontal aim offset (radians)
  const aimPitch = useRef(0); // vertical aim offset (radians)

  // Active gun/swivel state
  const activeSwivel = useRef(null);        // the Swivel object (pivot parent of shotgun)
  const activeShotgunObj = useRef(null);    // the Shotgun mesh (child of swivel)
  const swivelOriginalEuler = useRef(null); // original Euler to restore on exit
  const gunPivotPos = useRef(new THREE.Vector3()); // swivel's initial world position
  const baseBarrelDir = useRef(new THREE.Vector3()); // barrel direction at rest
  const activeShotgunName = useRef(null);   // "Shotgun1" or "Shotgun2"
  // Camera offset from barrel direction (non-parented approach)
  const camOffsetBehind = 0.016;
  const camOffsetUp = 0.2;
  const CAM_OFFSET_RIGHT = {
    Shotgun1: -0.005,
    Shotgun2: 0.0,
  };
  // Crosshair position per gun (CSS top%, left%)
  const CROSSHAIR_POS = {
    Shotgun1: { top: 62, left: 51 },
    Shotgun2: { top: 67, left: 42 },
  };

  // Swivel Y-axis rotation limits (degrees → radians)
  const SWIVEL_LIMITS = {
    Shotgun1: { yMin: THREE.MathUtils.degToRad(-15), yMax: THREE.MathUtils.degToRad(35) },
    Shotgun2: { yMin: THREE.MathUtils.degToRad(-35), yMax: THREE.MathUtils.degToRad(15) },
  };
  // Pitch (up/down) limits — same for both guns
  const PITCH_MIN = THREE.MathUtils.degToRad(-22);
  const PITCH_MAX = THREE.MathUtils.degToRad(15);

  // Duck knock-down animation state
  const duckAnimations = useRef({}); // { Duck1: { mesh, startRot, progress, active } }

  // Tracer + muzzle flash state
  const tracers = useRef([]); // [{ line, opacity, age }]
  const muzzleFlashes = useRef([]); // [{ light, age }]
  const tracerGroup = useRef(null); // group added to scene for tracers

  // Tuned initial camera positions for the zoom-in
  const AIM_TRANSFORMS = useMemo(() => ({
    Shotgun1: {
      position: new THREE.Vector3(-3.046, -0.640, 2.184),
      target: new THREE.Vector3(-1.548, -0.387, 0.883),
    },
    Shotgun2: {
      position: new THREE.Vector3(-4.063, -0.652, 1.351),
      target: new THREE.Vector3(-1.930, -0.340, 0.300),
    },
  }), []);

  const getAimTransform = useCallback((shotgunName) => {
    return AIM_TRANSFORMS[shotgunName] || null;
  }, [AIM_TRANSFORMS]);

  // Click handler: detect shotgun clicks for zoom, target clicks for shooting
  useEffect(() => {
    const handleClick = (event) => {
      if (isZoomingToGun.current) return;

      if (aimMode) {
        // In aim mode — shoot from crosshair position (converted from CSS % to NDC)
        const chPos = CROSSHAIR_POS[activeShotgunName.current] || { top: 50, left: 50 };
        const ndcX = (chPos.left / 50) - 1;   // 50% → 0, 0% → -1, 100% → 1
        const ndcY = 1 - (chPos.top / 50);     // 50% → 0, 0% → 1, 100% → -1
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
      } else {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera({ x, y }, camera);
      }

      if (!aimMode) {
        // Check if a shotgun was clicked (collect parent objects, intersect recursively)
        const shotgunRoots = [];
        scene.traverse((child) => {
          if (SHOTGUN_MESHES.has(child.name)) {
            shotgunRoots.push(child);
          }
        });
        const hits = raycaster.intersectObjects(shotgunRoots, true);
        if (hits.length > 0) {
          // Walk up from hit mesh to find the Shotgun root
          let shotgunName = null;
          let obj = hits[0].object;
          while (obj) {
            if (SHOTGUN_MESHES.has(obj.name)) { shotgunName = obj.name; break; }
            obj = obj.parent;
          }
          if (!shotgunName) shotgunName = hits[0].object.name;
          const transform = getAimTransform(shotgunName);
          if (!transform) return;

          // Find the Swivel parent (Shotgun1→Swivel1, Shotgun2→Swivel2)
          const swivelName = shotgunName.replace("Shotgun", "Swivel");
          activeShotgunName.current = shotgunName;
          scene.traverse((child) => {
            if (child.name === swivelName) {
              activeSwivel.current = child;
              child.updateWorldMatrix(true, false);
              swivelOriginalEuler.current = new THREE.Euler().copy(child.rotation);
              gunPivotPos.current.setFromMatrixPosition(child.matrixWorld);
            }
            if (child.name === shotgunName) {
              activeShotgunObj.current = child;
            }
          });
          // Base barrel direction = from swivel pivot toward the aim target (gallery)
          baseBarrelDir.current.subVectors(transform.target, gunPivotPos.current).normalize();

          // Start zoom to aiming position
          isZoomingToGun.current = true;
          zoomProgress.current = 0;
          startPos.current.copy(camera.position);
          startFov.current = camera.fov;
          aimPos.current.copy(transform.position);
          aimTarget.current.copy(transform.target);
          if (controls) {
            startTarget.current.copy(controls.target);
            controls.enabled = false;
          }
        }
      } else {
        // In aim mode — shoot from crosshair position
        const chPos2 = CROSSHAIR_POS[activeShotgunName.current] || { top: 50, left: 50 };
        const ndcX2 = (chPos2.left / 50) - 1;
        const ndcY2 = 1 - (chPos2.top / 50);
        raycaster.setFromCamera({ x: ndcX2, y: ndcY2 }, camera);

        // Compute barrel tip for tracer origin
        const pivotWorld = gunPivotPos.current;
        const clampedYaw = aimYaw.current;
        const clampedPitch = aimPitch.current;
        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), clampedYaw);
        const barrelAfterYaw = baseBarrelDir.current.clone().applyQuaternion(yawQ);
        const rAxis = new THREE.Vector3().crossVectors(barrelAfterYaw, new THREE.Vector3(0, 1, 0)).normalize();
        const pitchQ = new THREE.Quaternion().setFromAxisAngle(rAxis, clampedPitch);
        const aimDir = baseBarrelDir.current.clone().applyQuaternion(yawQ).applyQuaternion(pitchQ);
        const barrelTip = pivotWorld.clone().add(aimDir.clone().multiplyScalar(0.5));

        // Collect target meshes and ensure they're double-sided for raycasting
        const targets = [];
        scene.traverse((child) => {
          if (TARGET_MESHES.has(child.name)) {
            child.updateWorldMatrix(true, false);
            if (child.isMesh && child.material) {
              child.material.side = THREE.DoubleSide;
            }
            targets.push(child);
          }
        });

        // Use bounding-sphere proximity test for flat target planes
        // (flat meshes are nearly impossible to hit with a ray)
        const ray = raycaster.ray;
        const HIT_RADIUS = 0.15; // world-space radius around target center that counts as a hit
        let closestTarget = null;
        let closestDist = Infinity;
        const _wp = new THREE.Vector3();
        const _proj = new THREE.Vector3();
        for (const t of targets) {
          t.getWorldPosition(_wp);
          // Find closest point on ray to target center
          _proj.copy(_wp).sub(ray.origin);
          const along = _proj.dot(ray.direction);
          if (along < 0) continue; // behind the gun
          const pointOnRay = ray.origin.clone().add(ray.direction.clone().multiplyScalar(along));
          const dist = pointOnRay.distanceTo(_wp);
          if (dist < HIT_RADIUS && dist < closestDist) {
            closestDist = dist;
            closestTarget = t;
          }
        }

        // Get the actual world position of the closest target (not _wp which is the last iterated)
        const closestPoint = new THREE.Vector3();
        if (closestTarget) closestTarget.getWorldPosition(closestPoint);
        const hits = closestTarget ? [{ object: closestTarget, point: closestPoint }] : [];
        // --- Projectile ball (flies along raycaster ray) ---
        const rayOrigin = raycaster.ray.origin.clone();
        const rayDir = raycaster.ray.direction.clone();
        const ballStart = rayOrigin.clone().add(rayDir.clone().multiplyScalar(0.3));
        const ballEnd = hits.length > 0
          ? hits[0].point.clone()
          : rayOrigin.clone().add(rayDir.clone().multiplyScalar(10));
        const flightDist = ballStart.distanceTo(ballEnd);
        const BALL_SPEED = 14;
        const ballGeo = new THREE.SphereGeometry(0.06, 10, 10);
        const ballMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 2 });
        const ballMesh = new THREE.Mesh(ballGeo, ballMat);
        ballMesh.position.copy(ballStart);
        rootScene.add(ballMesh);
        // Resolve pending hit (triggered when ball arrives)
        let pendingPivot = null;
        if (hits.length > 0) {
          const hitObj = hits[0].object;
          pendingPivot = TO_PIVOT[hitObj.name] || null;
          if (!pendingPivot) {
            let p = hitObj.parent;
            while (p) {
              if (TO_PIVOT[p.name]) { pendingPivot = TO_PIVOT[p.name]; break; }
              p = p.parent;
            }
          }
        }

        tracers.current.push({
          line: ballMesh,
          start: ballStart,
          end: ballEnd,
          totalTime: flightDist / BALL_SPEED,
          age: 0,
          pendingPivot, // knock down duck when ball arrives
        });

        // --- Muzzle flash (bright point light + small glowing sphere) ---
        const flash = new THREE.PointLight(0xffaa33, 8, 3, 2);
        flash.position.copy(barrelTip);
        rootScene.add(flash);
        const flashGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
        const flashMesh = new THREE.Mesh(flashGeo, flashMat);
        flashMesh.position.copy(barrelTip);
        rootScene.add(flashMesh);
        muzzleFlashes.current.push({ light: flash, mesh: flashMesh, age: 0 });

      }
    };

    const exitAimMode = () => {
      setAimMode(false);
      // Restore swivel rotation
      if (activeSwivel.current && swivelOriginalEuler.current) {
        activeSwivel.current.rotation.copy(swivelOriginalEuler.current);
        activeSwivel.current = null;
        activeShotgunName.current = null;
      }
      // Restore orbit controls and FOV
      camera.fov = 50;
      camera.updateProjectionMatrix();
      if (controls && savedControls.current) {
        Object.assign(controls, savedControls.current);
        controls.enabled = true;
        controls.update();
      }
    };

    // ESC to exit aim mode
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && aimMode) {
        exitAimMode();
      }
    };

    // Right-click to exit aim mode
    const handleContextMenu = (event) => {
      if (aimMode) {
        event.preventDefault();
        exitAimMode();
      }
    };

    gl.domElement.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    gl.domElement.addEventListener("contextmenu", handleContextMenu);
    return () => {
      gl.domElement.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      gl.domElement.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [scene, camera, controls, gl, raycaster, aimMode, getAimTransform]);

  // Animate zoom to gun + duck knockdowns
  useFrame((_, delta) => {
    // Zoom to gun animation
    if (isZoomingToGun.current) {
      zoomProgress.current += delta * 1.5;
      const t = Math.min(zoomProgress.current, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      camera.position.lerpVectors(startPos.current, aimPos.current, eased);

      if (controls) {
        controls.target.lerpVectors(startTarget.current, aimTarget.current, eased);
        controls.update();
      } else {
        camera.lookAt(aimTarget.current);
      }

      camera.fov = THREE.MathUtils.lerp(startFov.current, 70, eased);
      camera.updateProjectionMatrix();

      if (t >= 1) {
        isZoomingToGun.current = false;
        if (controls) {
          savedControls.current = {
            minDistance: controls.minDistance,
            maxDistance: controls.maxDistance,
            minPolarAngle: controls.minPolarAngle,
            maxPolarAngle: controls.maxPolarAngle,
            enablePan: controls.enablePan,
            enableZoom: controls.enableZoom,
          };
          controls.enabled = false;
        }

        setAimMode(true);
      }
    }

    // Swivel-rotation aiming: rotate the swivel, position camera along barrel
    if (aimMode && !isZoomingToGun.current && activeSwivel.current) {
      const swivel = activeSwivel.current;
      const limits = SWIVEL_LIMITS[activeShotgunName.current];

      // Clamp yaw/pitch to swivel limits
      const clampedYaw = THREE.MathUtils.clamp(aimYaw.current, limits.yMin, limits.yMax);
      const clampedPitch = THREE.MathUtils.clamp(aimPitch.current, PITCH_MIN, PITCH_MAX);
      aimYaw.current = clampedYaw;
      aimPitch.current = clampedPitch;

      // Build rotation: yaw around world Y, then pitch around the yaw-rotated barrel's local right axis
      // This keeps the gun upright regardless of the 3/4 model angle
      const origQuat = new THREE.Quaternion().setFromEuler(swivelOriginalEuler.current);
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), clampedYaw);

      // Get the barrel's right axis after yaw (perpendicular to barrel, in horizontal plane)
      const barrelAfterYaw = baseBarrelDir.current.clone().applyQuaternion(yawQuat);
      const rightAxis = new THREE.Vector3().crossVectors(barrelAfterYaw, new THREE.Vector3(0, 1, 0)).normalize();
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(rightAxis, clampedPitch);

      // Combine: original * yaw * pitch
      swivel.quaternion.copy(origQuat).premultiply(yawQuat).premultiply(pitchQuat);
      swivel.updateWorldMatrix(true, true);

      // Camera forward = base barrel dir rotated by same yaw + pitch
      const pivotWorld = gunPivotPos.current;
      const gunForward = baseBarrelDir.current.clone()
        .applyQuaternion(yawQuat)
        .applyQuaternion(pitchQuat);

      const gunUp = new THREE.Vector3(0, 1, 0);
      const gunRight = new THREE.Vector3().crossVectors(gunForward, gunUp).normalize();

      camera.position.copy(pivotWorld)
        .add(gunForward.clone().multiplyScalar(-camOffsetBehind))
        .add(gunUp.clone().multiplyScalar(camOffsetUp))
        .add(gunRight.clone().multiplyScalar(CAM_OFFSET_RIGHT[activeShotgunName.current] || 0));

      const lookTarget = pivotWorld.clone().add(gunForward.clone().multiplyScalar(5));
      camera.lookAt(lookTarget);

      // Crosshair stays at screen center — raycast fires from camera center
    }

    // Duck knock-down animations (quaternion slerp for correct local-axis rotation)
    for (const [, anim] of Object.entries(duckAnimations.current)) {
      if (!anim.active) continue;
      anim.progress += delta * 3;
      const t = Math.min(anim.progress, 1);
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      anim.obj.quaternion.slerpQuaternions(anim.startQuat, anim.targetQuat, eased);

      if (t >= 1) {
        anim.active = false;
      }
    }

    // Projectile ball animation
    for (let i = tracers.current.length - 1; i >= 0; i--) {
      const tr = tracers.current[i];
      tr.age += delta;
      const t = Math.min(tr.age / tr.totalTime, 1);
      tr.line.position.lerpVectors(tr.start, tr.end, t);
      // Trigger duck knockdown slightly before ball arrives
      if (t >= .99 && tr.pendingPivot && !duckAnimations.current[tr.pendingPivot]?.active) {
        const sfx = new Audio("/duckHunt.mp3");
        sfx.volume = 0.6;
        sfx.play().catch(() => {});
        scene.traverse((child) => {
          if (child.name === tr.pendingPivot) {
            const angleRad = THREE.MathUtils.degToRad(38);
            const tipAxis = new THREE.Vector3(
              Math.sin(angleRad), 0, Math.cos(angleRad)
            ).normalize();
            const startQuat = child.quaternion.clone();
            const knockQuat = new THREE.Quaternion().setFromAxisAngle(tipAxis, -Math.PI / 2);
            const targetQuat = knockQuat.clone().multiply(startQuat);
            duckAnimations.current[tr.pendingPivot] = {
              obj: child, startQuat, targetQuat, progress: 0, active: true,
            };
          }
        });
      }
      // Remove ball when it arrives
      if (t >= 1) {
        rootScene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        tracers.current.splice(i, 1);
      }
    }

    // Muzzle flash fade-out (0.12s lifetime)
    for (let i = muzzleFlashes.current.length - 1; i >= 0; i--) {
      const fl = muzzleFlashes.current[i];
      fl.age += delta;
      const fade = Math.max(0, 1 - fl.age / 0.12);
      fl.light.intensity = 8 * fade;
      if (fl.mesh) fl.mesh.scale.setScalar(fade);
      if (fl.age > 0.12) {
        rootScene.remove(fl.light);
        fl.light.dispose();
        if (fl.mesh) {
          rootScene.remove(fl.mesh);
          fl.mesh.geometry.dispose();
          fl.mesh.material.dispose();
        }
        muzzleFlashes.current.splice(i, 1);
      }
    }
  });

  // Crosshair overlay when in aim mode
  // Crosshair at center + mouse movement rotates camera (FPS-style aiming)
  useEffect(() => {
    if (aimMode) {
      // Reset aim offsets
      aimYaw.current = 0;
      aimPitch.current = 0;

      const pos = CROSSHAIR_POS[activeShotgunName.current] || { top: 50, left: 50 };
      const crosshair = document.createElement("div");
      crosshair.id = "duck-hunt-crosshair";
      crosshair.style.cssText = `
        position: fixed; top: ${pos.top}%; left: ${pos.left}%;
        width: 40px; height: 40px; pointer-events: none; z-index: 9999;
        transform: translate(-50%, -50%);
      `;
      crosshair.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="15" fill="none" stroke="red" stroke-width="1.5" opacity="0.8"/>
          <line x1="20" y1="2" x2="20" y2="12" stroke="red" stroke-width="1.5" opacity="0.8"/>
          <line x1="20" y1="28" x2="20" y2="38" stroke="red" stroke-width="1.5" opacity="0.8"/>
          <line x1="2" y1="20" x2="12" y2="20" stroke="red" stroke-width="1.5" opacity="0.8"/>
          <line x1="28" y1="20" x2="38" y2="20" stroke="red" stroke-width="1.5" opacity="0.8"/>
          <circle cx="20" cy="20" r="2" fill="red" opacity="0.8"/>
        </svg>
      `;
      document.body.appendChild(crosshair);
      crosshairRef.current = crosshair;

      const hint = document.createElement("div");
      hint.id = "duck-hunt-hint";
      hint.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        color: white; font-family: monospace; font-size: 14px;
        background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 6px;
        pointer-events: none; z-index: 9999;
      `;
      hint.textContent = "Move mouse to aim — Click to shoot — ESC to exit";
      document.body.appendChild(hint);

      // Mouse movement controls aim direction (clamping done in useFrame by SWIVEL_LIMITS)
      const sensitivity = 0.002;
      const handleMouseMove = (event) => {
        aimYaw.current -= event.movementX * sensitivity;
        aimPitch.current -= event.movementY * sensitivity;
      };

      // Request pointer lock for smooth FPS-style mouse control
      const canvas = gl.domElement;
      canvas.requestPointerLock();
      document.addEventListener("mousemove", handleMouseMove);

      return () => {
        crosshair.remove();
        hint.remove();
        document.removeEventListener("mousemove", handleMouseMove);
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
        gl.domElement.style.cursor = "";
        crosshairRef.current = null;
      };
    }
  }, [aimMode, gl]);

  return null;
}

// Animate flame meshes via transforms (position sway, scale pulse) — preserves original texture
function FlameAnimation({ scene }) {
  const initialized = useRef(false);
  const flameData = useRef(new Map());

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Find flame meshes on first frame
    if (!initialized.current) {
      scene.traverse((child) => {
        if (child.isMesh && child.name.toLowerCase().startsWith("flame")) {
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const box = child.geometry.boundingBox;
          const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
          // Use world position as seed so nearby flames get distinct phases
          const wp = new THREE.Vector3();
          child.getWorldPosition(wp);
          const phase = (wp.x * 73.13 + wp.y * 119.71 + wp.z * 37.47) % (Math.PI * 2);
          // Vary speed per flame so they don't pulse in sync
          const speedMult = 0.8 + ((wp.x * 31.1 + wp.z * 17.3) % 0.4);
          flameData.current.set(child.uuid, {
            mesh: child,
            origPos: child.position.clone(),
            origScale: child.scale.clone(),
            phase,
            speedMult,
            size,
          });
        }
      });
      initialized.current = true;
    }

    for (const [, entry] of flameData.current) {
      const { mesh, origPos, origScale, phase, speedMult, size } = entry;
      const ft = t * 3.0 * speedMult + phase;
      const s = size * 0.004;

      mesh.position.x = origPos.x + Math.sin(ft * 1.5) * s;
      mesh.position.y = origPos.y + Math.sin(ft * 2.0) * s * 0.7;
      mesh.position.z = origPos.z + Math.cos(ft * 1.8) * s * 0.7;

      const scaleFlicker = 1.0 + Math.sin(ft * 2.5) * 0.008;
      const widthFlicker = 1.0 + Math.sin(ft * 1.9) * 0.004;
      mesh.scale.set(
        origScale.x * widthFlicker,
        origScale.y * scaleFlicker,
        origScale.z * widthFlicker
      );
    }
  });

  return null;
}

function ArcadeModel({ is80sMode, onLoaded, onEnterScreen, onZoomReady, confirmAction }) {
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

  // Play the 'Scene' animation — strip flame tracks so FlameAnimation can control them
  useEffect(() => {
    if (actions?.Scene) {
      const clip = actions.Scene.getClip();
      clip.tracks = clip.tracks.filter(
        (track) => !track.name.toLowerCase().includes("flame")
      );
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
      <FlameAnimation scene={scene} />
      <ScreenZoomPortal scene={scene} onEnterScreen={onEnterScreen} onZoomReady={onZoomReady} confirmAction={confirmAction} />
      <DuckHuntGame scene={scene} />
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
    position: [3.8, 1.8, 1.7],
    text: "Gachapon NFT Machine",
        textOffset: [-0.1, -0.7, 0],
    customCamera: {
      position: [3.3, 1.4, 2.3],
      lookAt: [5.0, 1.2, -0.1],
      distance: 3,
    },
  },
  {
  position: [0.9, 1.7, -1.8],
    text: "Doorway to the Tavern",
    textOffset: [0.0, 0.1, 0],
    customCamera: {
      position: [2.0, 1.8, 0.5],
      lookAt: [1.7, 1.8, 0.3],
      distance: 1.0,
    },
  },
  {
    position: [-3.3, -0.6, 2.0],
    text: "Click a gun to aim - click again to shoot",
    textOffset: [-0.4, 0.1, 0],
    customCamera: {
      position: [-2.5, -0.2, 0.9],
      lookAt: [-2.0, -0.2, 0.5],
      distance: 3.5,
    },
  },
  {
    position: [-1.3, 2.0, 0.3],
    text: "The Regulars",
        textOffset: [0.0, -0.2, 0],
    customCamera: {
      position: [-1.9, 2.2, 0.7],
      lookAt: [-0.9, 1.9, -1.3],
      distance: 2.5,
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

function ArcadeSceneInner({ is80sMode, onLoaded, onEnterScreen, onZoomReady, confirmAction }) {
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

      <ArcadeModel is80sMode={is80sMode} onLoaded={onLoaded} onEnterScreen={onEnterScreen} onZoomReady={onZoomReady} confirmAction={confirmAction} />

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
        zoomToCursor
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

export default function ArcadeScene({ is80sMode = false, onLoaded, onEnterScreen, onZoomReady, confirmAction }) {
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
          <ArcadeSceneInner is80sMode={is80sMode} onLoaded={onLoaded} onEnterScreen={onEnterScreen} onZoomReady={onZoomReady} confirmAction={confirmAction} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/medievalArcade.glb", true);
