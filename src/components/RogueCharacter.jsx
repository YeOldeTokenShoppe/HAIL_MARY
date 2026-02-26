"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { ADDON_SLOTS } from "@/components/PimpMyPumpPanel";

// ── Rogue Catalog ─────────────────────────────────────────────────────────────
export const ROGUE_CATALOG = [
  // {
  //   id: "dinosaur",
  //   label: "DINOSAUR",
  //   model: "/models/t-rex.glb",
  //   consequence: "delete_addon",
  //   description: "Eats a random add-on",
  //   scale: 0.15,
  // },
  {
    id: "blueDemon",
    label: "BLUE DEMON",
    model: "/models/blueDemon.glb",
    consequence: "delete_addon",
    description: "Devours a random add-on",
    scale: 0.05,
    animation: "CharacterArmature|Walk",
  },
  {
    id: "crudingo",
    label: "CRUDINGO",
    model: "/models/Crudingo.glb",
    consequence: "poop",
    description: "Leaves poop in your yard",
    scale: 0.12,
    movement: "fly",
    flyHeight: 1.2,
  },
];

// ── Auto-mark event as done via API ──────────────────────────────────────────
function markEventDone(eventId) {
  const pw = typeof localStorage !== "undefined"
    ? (localStorage.getItem("oil_admin_pw") || sessionStorage.getItem("oil_admin_pw"))
    : null;
  if (!pw || !eventId) return;
  fetch("/api/oil-rogue", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pw, eventId }),
  }).catch((err) => console.error("[Rogue] auto-done failed:", err));
}

// Walk speed in world units per second
const WALK_SPEED = 0.5;
// Pause phases at target (seconds)
const PAUSE_IDLE = 2;
const PAUSE_WEAPON = 3;
const PAUSE_TOTAL = PAUSE_IDLE + PAUSE_WEAPON;

// ── Falling poop drop ────────────────────────────────────────────────────────
function PoopDrop({ position, flyHeight }) {
  const groupRef = useRef();
  const { scene } = useGLTF("/models/poop.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const tRef = useRef(0);
  const fallDuration = 0.5;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    tRef.current = Math.min(tRef.current + delta, fallDuration);
    const f = tRef.current / fallDuration;
    // Ease-in (gravity-like)
    const ease = f * f;
    const y = flyHeight * (1 - ease);
    groupRef.current.position.set(position.x, y, position.z);
  });

  return (
    <group ref={groupRef} scale={[0.15, 0.15, 0.15]}>
      <primitive object={cloned} />
    </group>
  );
}

// ── Flying rogue (Crudingo) ──────────────────────────────────────────────────
const FLY_SPEED = 1.5;
const CIRCLE_DURATION = 1.5;
const HOVER_DURATION = 1.0;
const CIRCLE_RADIUS = 0.8;

function FlyingRogueCharacter({ event, cellSize = 1, worldW, worldD, catalog }) {
  const groupRef = useRef();
  const phaseRef = useRef("fly_in");
  const tRef = useRef(0);
  const [done, setDone] = useState(false);
  const [poopDropped, setPoopDropped] = useState(false);

  const { scene, animations } = useGLTF(catalog.model);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clonedScene);

  const flyHeight = catalog.flyHeight || 2.0;

  // Target cell center
  const targetPos = useMemo(() => {
    const x = -worldW / 2 + event.targetCol * cellSize + cellSize / 2;
    const z = worldD / 2 - event.targetRow * cellSize - cellSize / 2;
    return new THREE.Vector3(x, 0, z);
  }, [event.targetCol, event.targetRow, cellSize, worldW, worldD]);

  // Spawn and exit positions
  const spawnPos = useMemo(() => {
    return new THREE.Vector3(-worldW / 2 - cellSize * 2, flyHeight, targetPos.z + 1);
  }, [worldW, cellSize, flyHeight, targetPos]);

  const exitPos = useMemo(() => {
    return new THREE.Vector3(worldW / 2 + cellSize * 2, flyHeight + 1, targetPos.z - 1);
  }, [worldW, cellSize, flyHeight, targetPos]);

  const hoverPos = useMemo(() => {
    return new THREE.Vector3(targetPos.x, flyHeight, targetPos.z);
  }, [targetPos, flyHeight]);

  // Start first animation
  useEffect(() => {
    const first = Object.values(actions)[0];
    if (first) first.reset().fadeIn(0.2).play();
  }, [actions]);

  // Phase distances / durations
  const flyInDist = useMemo(() => spawnPos.distanceTo(hoverPos), [spawnPos, hoverPos]);
  const flyOutDist = useMemo(() => hoverPos.distanceTo(exitPos), [hoverPos, exitPos]);
  const flyInTime = flyInDist / FLY_SPEED;
  const flyOutTime = flyOutDist / FLY_SPEED;

  useFrame((_, delta) => {
    if (done || !groupRef.current) return;
    const g = groupRef.current;
    g.scale.setScalar(catalog.scale);
    tRef.current += delta;
    const t = tRef.current;

    const phase = phaseRef.current;

    if (phase === "fly_in") {
      const f = Math.min(1, t / flyInTime);
      g.position.lerpVectors(spawnPos, hoverPos, f);
      // Face movement direction
      const dir = hoverPos.clone().sub(spawnPos);
      g.rotation.y = Math.atan2(dir.x, dir.z);
      if (f >= 1) {
        phaseRef.current = "circle";
        tRef.current = 0;
      }
    } else if (phase === "circle") {
      const f = Math.min(1, t / CIRCLE_DURATION);
      const angle = f * Math.PI * 2;
      g.position.set(
        hoverPos.x + Math.sin(angle) * CIRCLE_RADIUS,
        hoverPos.y + Math.sin(f * Math.PI) * 0.3,
        hoverPos.z + Math.cos(angle) * CIRCLE_RADIUS
      );
      // Face tangent direction
      g.rotation.y = angle + Math.PI / 2;
      if (f >= 1) {
        phaseRef.current = "hover";
        tRef.current = 0;
      }
    } else if (phase === "hover") {
      // Descend to drop altitude over the hover duration
      const dropAlt = flyHeight * 0.4;
      const f = Math.min(1, t / HOVER_DURATION);
      g.position.set(hoverPos.x, flyHeight - (flyHeight - dropAlt) * f, hoverPos.z);
      g.position.y += Math.sin(t * 4) * 0.03;
      g.rotation.y = Math.PI;
      if (f >= 1) {
        phaseRef.current = "drop";
        tRef.current = 0;
        setPoopDropped(true);
      }
    } else if (phase === "drop") {
      // Stay at low altitude while poop falls
      const dropAlt = flyHeight * 0.4;
      g.position.set(hoverPos.x, dropAlt, hoverPos.z);
      g.position.y += Math.sin(t * 4) * 0.03;
      if (t >= 0.6) {
        phaseRef.current = "fly_out";
        tRef.current = 0;
      }
    } else if (phase === "fly_out") {
      const f = Math.min(1, t / flyOutTime);
      g.position.lerpVectors(hoverPos, exitPos, f);
      const dir = exitPos.clone().sub(hoverPos);
      g.rotation.y = Math.atan2(dir.x, dir.z);
      if (f >= 1) {
        setDone(true);
        markEventDone(event.id);
      }
    }
  });

  if (done) return null;

  return (
    <>
      <group ref={groupRef} scale={[catalog.scale, catalog.scale, catalog.scale]}>
        <primitive object={clonedScene} />
      </group>
      {poopDropped && <PoopDrop position={targetPos} flyHeight={flyHeight * 0.4} />}
    </>
  );
}

// ── Ground-walking rogue (default) ───────────────────────────────────────────
function GroundRogueCharacter({ event, cellSize = 1, worldW, worldD }) {
  const groupRef = useRef();
  const timeRef = useRef(0);
  const startedRef = useRef(false);
  const phaseRef = useRef("walk_in");
  const [done, setDone] = useState(false);

  const catalog = useMemo(
    () => ROGUE_CATALOG.find((c) => c.id === event.characterType) || ROGUE_CATALOG[0],
    [event.characterType]
  );

  const { scene, animations } = useGLTF(catalog.model);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clonedScene);

  const rootBone = useMemo(() => {
    let bone = null;
    clonedScene.traverse((child) => {
      if (!bone && child.type === "Bone" && child.name === "Root") bone = child;
    });
    return bone;
  }, [clonedScene]);

  // Convert intersection (ix, iy) to world position
  // Intersection (0,0) = top-left corner of cell (0,0)
  // = (-worldW/2, 0, worldD/2)
  const intersectionToWorld = (ix, iy) => {
    const x = -worldW / 2 + ix * cellSize;
    const z = worldD / 2 - iy * cellSize;
    return new THREE.Vector3(x, 0, z);
  };

  // Convert cell (col, row) to world position (cell center)
  const cellToWorld = (col, row) => {
    const x = -worldW / 2 + col * cellSize + cellSize / 2;
    const z = worldD / 2 - row * cellSize - cellSize / 2;
    return new THREE.Vector3(x, 0, z);
  };

  // Build world-space waypoints from the path
  const routeData = useMemo(() => {
    const path = event.path;

    // Fallback for legacy events without path
    if (!path || path.length === 0) {
      const target = cellToWorld(event.targetCol, event.targetRow);
      const spawnX = -worldW / 2 - cellSize;
      const exitX = worldW / 2 + cellSize;
      return {
        waypoints: [
          new THREE.Vector3(spawnX, 0, target.z),
          target,
          new THREE.Vector3(exitX, 0, target.z),
        ],
        targetWpIdx: 1,
        addonOffset: new THREE.Vector3(0, 0, 0),
      };
    }

    // Convert path nodes to world positions
    // The "cell" node is skipped as a waypoint — the rogue pauses at the
    // arrival corner (the intersection before the cell) and steps into the
    // cell only during the weapon phase. This avoids clipping through the rig.
    const wps = [];
    let targetWpIdx = -1;

    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      if (node.type === "cell") {
        // Don't add a waypoint for the cell center — the rogue pauses at
        // the previous intersection (arrival corner) and steps toward the
        // addon from there during the weapon phase.
        // Mark the PREVIOUS waypoint as the target (arrival corner).
        targetWpIdx = wps.length - 1;
      } else if (node.type === "intersection") {
        wps.push(intersectionToWorld(node.ix, node.iy));
      } else {
        wps.push(cellToWorld(node.c ?? 0, node.r ?? 0));
      }
    }

    if (targetWpIdx === -1) {
      console.warn("[Rogue] No cell node found in path, using midpoint fallback");
      targetWpIdx = Math.floor(wps.length / 2);
    }

    // Add entry point: extend off-grid from the first waypoint
    // First waypoint is a border intersection — find which border and push outward
    const firstNode = path[0];
    const firstWp = wps[0];
    const entryPt = firstWp.clone();
    const gridNodes = worldW / cellSize + 1;

    if (firstNode.type === "intersection") {
      const ix = firstNode.ix;
      const iy = firstNode.iy;
      if (ix === 0) entryPt.x -= cellSize * 1.2;
      else if (ix === gridNodes - 1) entryPt.x += cellSize * 1.2;
      else if (iy === 0) entryPt.z += cellSize * 1.2;
      else if (iy === gridNodes - 1) entryPt.z -= cellSize * 1.2;
      else entryPt.x -= cellSize * 1.2; // fallback
    } else {
      entryPt.x -= cellSize * 1.2;
    }

    // Add exit point: extend off-grid from the last waypoint
    const lastNode = path[path.length - 1];
    const lastWp = wps[wps.length - 1];
    const exitPt = lastWp.clone();

    if (lastNode.type === "intersection") {
      const ix = lastNode.ix;
      const iy = lastNode.iy;
      if (ix === 0) exitPt.x -= cellSize * 1.2;
      else if (ix === gridNodes - 1) exitPt.x += cellSize * 1.2;
      else if (iy === 0) exitPt.z += cellSize * 1.2;
      else if (iy === gridNodes - 1) exitPt.z -= cellSize * 1.2;
      else exitPt.x += cellSize * 1.2;
    } else {
      exitPt.x += cellSize * 1.2;
    }

    const allWps = [entryPt, ...wps, exitPt];
    const adjustedTarget = targetWpIdx + 1; // +1 for prepended entry

    // Compute the addon world position for the weapon step-forward
    let addonOffset = new THREE.Vector3(0, 0, 0);
    const slotRaw = event.addonSlot;
    if (slotRaw != null) {
      const slotNum = parseInt(String(slotRaw).replace("slot", ""), 10);
      if (!isNaN(slotNum) && ADDON_SLOTS[slotNum]) {
        const s = ADDON_SLOTS[slotNum];
        addonOffset = new THREE.Vector3(s.x, 0, s.z);
      }
    }
    const cellCenter = cellToWorld(event.targetCol, event.targetRow);
    const addonWorldPos = cellCenter.clone().add(addonOffset);

    return { waypoints: allWps, targetWpIdx: adjustedTarget, addonWorldPos };
  }, [event.path, event.targetCol, event.targetRow, event.addonSlot, cellSize, worldW, worldD]);

  const { waypoints, targetWpIdx, addonWorldPos } = routeData;

  // Precompute segment times with pause baked in after arrival at target
  const { segTimes, cumTime, totalTime } = useMemo(() => {
    const secPerUnit = 1 / WALK_SPEED;
    const sTimes = [];
    const cTime = [];
    let acc = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const dist = waypoints[i + 1].distanceTo(waypoints[i]);
      const t = dist * secPerUnit;
      sTimes.push(t);
      acc += t;
      // Insert pause after arriving at target waypoint
      if (i + 1 === targetWpIdx) {
        acc += PAUSE_TOTAL;
      }
      cTime.push(acc);
    }

    return { segTimes: sTimes, cumTime: cTime, totalTime: acc };
  }, [waypoints, targetWpIdx]);

  // Helper: find an animation by keyword (fuzzy match on clip name)
  const findAnim = (keyword) => {
    // Exact match first
    if (actions[keyword]) return actions[keyword];
    // Case-insensitive partial match
    const lc = keyword.toLowerCase();
    const key = Object.keys(actions).find((k) => k.toLowerCase().includes(lc));
    return key ? actions[key] : null;
  };

  // Helper: crossfade to an animation by keyword
  const playAnim = (keyword) => {
    const a = findAnim(keyword);
    if (!a) {
      console.warn(`[Rogue] Animation "${keyword}" not found. Available:`, Object.keys(actions));
      return;
    }
    Object.values(actions).forEach((act) => act.fadeOut(0.3));
    a.reset().fadeIn(0.3).play();
  };

  useFrame((_, delta) => {
    if (done || !groupRef.current) return;
    const g = groupRef.current;

    if (!startedRef.current) {
      startedRef.current = true;
      timeRef.current = 0;
      phaseRef.current = "walk_in";
      const clipName = catalog.animation;
      let action = clipName ? actions[clipName] : null;
      if (!action && clipName) {
        const key = Object.keys(actions).find((k) =>
          k.toLowerCase().endsWith(clipName.toLowerCase())
        );
        action = key ? actions[key] : null;
      }
      if (!action) action = Object.values(actions)[0];
      if (action) action.reset().fadeIn(0.2).play();
    }

    timeRef.current += delta;
    const t = timeRef.current;

    g.scale.setScalar(catalog.scale);
    if (rootBone) rootBone.position.set(0, 0, 0);

    if (t >= totalTime) {
      setDone(true);
      markEventDone(event.id);
      return;
    }

    // Find which segment we're in
    let segIdx = 0;
    for (let i = 0; i < cumTime.length; i++) {
      if (t < cumTime[i]) { segIdx = i; break; }
      if (i === cumTime.length - 1) segIdx = i;
    }

    const segStart = segIdx > 0 ? cumTime[segIdx - 1] : 0;
    const localT = t - segStart;
    const walkTime = segTimes[segIdx];
    const isTargetArrivalSeg = (segIdx + 1 === targetWpIdx);

    // Check if we're in the pause window
    if (isTargetArrivalSeg && localT >= walkTime) {
      const pauseT = localT - walkTime;
      const standoffPos = waypoints[targetWpIdx]; // near the addon, not cell center

      // Face the addon from standoff
      const toAddon = addonWorldPos.clone().sub(standoffPos);
      if (toAddon.lengthSq() > 0.001) {
        g.rotation.y = Math.atan2(toAddon.x, toAddon.z);
      }

      if (pauseT < PAUSE_IDLE) {
        // Idle phase: stand at standoff, considering the target
        if (phaseRef.current !== "idle") {
          phaseRef.current = "idle";
          playAnim("Idle");
        }
        g.position.copy(standoffPos);
      } else {
        // Weapon phase: step forward to the addon and attack
        if (phaseRef.current !== "weapon") {
          phaseRef.current = "weapon";
          playAnim("Weapon");
        }
        // Lerp from standoff toward addon (stop at 80% to not overshoot)
        const weaponT = pauseT - PAUSE_IDLE;
        const stepF = Math.min(0.8, (weaponT / 0.8) * 0.8);
        g.position.lerpVectors(standoffPos, addonWorldPos, stepF);
      }
      return;
    }

    // Normal walking
    if (segIdx + 1 > targetWpIdx && phaseRef.current !== "walk_out") {
      phaseRef.current = "walk_out";
      playAnim("Run");
    }

    const f = Math.min(1, localT / walkTime);
    const from = waypoints[segIdx];
    const to = waypoints[segIdx + 1];
    g.position.lerpVectors(from, to, f);

    const dir = to.clone().sub(from);
    if (dir.lengthSq() > 0.001) {
      g.rotation.y = Math.atan2(dir.x, dir.z);
    }
  });

  if (done) return null;

  return (
    <group ref={groupRef} scale={[catalog.scale, catalog.scale, catalog.scale]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// ── Router: pick flying vs ground rogue ──────────────────────────────────────
function RogueCharacter(props) {
  const catalog = useMemo(
    () => ROGUE_CATALOG.find((c) => c.id === props.event.characterType) || ROGUE_CATALOG[0],
    [props.event.characterType]
  );

  if (catalog.movement === "fly") {
    return <FlyingRogueCharacter {...props} catalog={catalog} />;
  }
  return <GroundRogueCharacter {...props} />;
}

export default RogueCharacter;
