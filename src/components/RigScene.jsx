"use client";

// The phone's 3D: one plot instead of the field (decided 2026-09-02 — the
// phone is a field report; the SURVEY tab is "the field" there). Your rig with
// its add-ons, fence and sign on a mesa tile that matches the field's ground,
// under the page's sky and lights. Nothing else mounts: no merged rigs, tower,
// voxels, strip, walker, rogue or fog — which is what keeps an iPhone under
// its memory ceiling. Desktop keeps OilVoxelGrid's unified field.
//
// Every piece is the field's own (Pumpjack, PlotSign, HellDemon, the ground
// look), imported from OilVoxelGrid so the two scenes cannot drift apart.

import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import useEnvMapSafe from "@/hooks/useEnvMapSafe";
import useSkyEnvMap from "@/hooks/useSkyEnvMap";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { Pumpjack, PlotSign, HellDemon, useGroundLook, buildPeakDepthMap, PUMPJACK_SCALE } from "@/components/OilVoxelGrid";

// The phone's rig is Michelle's COMPACT export (2026-09-04): same clips, materials
// and named parts as the field's allProps2, plus a pipe run and a tank scaffold,
// at ~57% of the bytes. The desktop field keeps allProps2 (OilVoxelGrid).
// Dev switch while she decides (2026-09-05): ?rig=2 loads the previous rig, ?rig=3 (default) the compact one.
const RIG_GLB = (() => {
  const v = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("rig") : null;
  // ?v= busts caches: bump after `node scripts/optimize-rig.mjs …` writes a new allProps3
  return v === "2" ? "/models/oilJack_fancy_allProps2.glb" : "/models/oilJack_fancy_allProps3.glb?v=3";
})();
// The work light (2026-09-05): a floodlight on a tripod, authored in the RIG's
// frame so it seats at the same scale and origin as the pump jack. Phone scene
// only — a hundred tripods on the desktop field would be clutter (Michelle).
// ?v= busts caches on re-export.
const RIG_LIGHT_GLB = "/models/RigLight.glb?v=1";
const LENS_RE = /^LightSurface/;            // her two lens meshes
const LENS_COLOR = "#fff1c4";               // warm floodlight
const LENS_EMISSIVE = 3.2;                  // past white under tone mapping — reads as lit
const SPOT_INTENSITY = 2.4;                 // physically-correct spot, ~0.5 world units from the rig
// Where the tripod stands, in the RIG's frame (metres, rig origin = pad centre),
// overriding the export's own placement: Michelle placed it for a Blender view,
// but the phone's rig camera is a narrow portrait shot from the front-right
// (RIG_CAMERA), and there it fell off the left edge (2026-09-05). Behind the
// rig on the right, tall enough that the head clears the tank, turned to face
// the pump so the lit lenses look at the camera. `scale` multiplies her 1.55.
const RIG_LIGHT_PLACE = { at: [-1.4, 0, -5.6], scale: 1.2 };
// Lamp-on factor from the hour: comes on over dusk (17.75→18.5), off over dawn
// (5.5→6.25). Without a live hour (pinned presets) it follows the night preset.
export function lampFactor(skyEnv, envPreset) {
  const h = skyEnv?.sunHour;
  if (h == null || Number.isNaN(h)) return envPreset === "night" ? 1 : 0;
  const ramp = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  return h >= 12 ? ramp(17.75, 18.5, h) : 1 - ramp(5.5, 6.25, h);
}
function RigLight({ skyEnv, envPreset }) {
  const { scene } = useGLTF(RIG_LIGHT_GLB);
  const on = lampFactor(skyEnv, envPreset);
  // Where the heads are, in the GLB's (rig) frame — read from her lens meshes so
  // a re-export that moves the tripod moves the spotlight with it.
  const head = useMemo(() => {
    const root = scene.children[0];
    if (root && RIG_LIGHT_PLACE) {
      const [x, y, z] = RIG_LIGHT_PLACE.at;
      root.position.set(x, y, z);
      root.rotation.set(0, Math.atan2(-x, -z), 0);          // her export faces -Z from +Z; face the pad from wherever it stands
      root.scale.setScalar(1.552 * (RIG_LIGHT_PLACE.scale || 1));
    }
    scene.updateMatrixWorld(true);
    const acc = new THREE.Vector3(); let n = 0; const v = new THREE.Vector3();
    scene.traverse((o) => { if (o.isMesh && LENS_RE.test(o.name)) { o.getWorldPosition(v); acc.add(v); n++; } });
    if (n) acc.divideScalar(n); else acc.set(-0.6, 3.5, 4.6);
    return acc.multiplyScalar(PUMPJACK_SCALE).toArray();
  }, [scene]);
  // The export's emissive map is black (a Synty atlas with almost no lit texels),
  // so the lenses glow from code: drop the map, warm colour, intensity by the hour.
  // The whole tripod rides the lamp factor (Michelle, 2026-09-06: hide it when
  // not in use): fully there at night, dissolved by day, fading over the dusk
  // and dawn ramps so it never pops. Materials are cloned once so the fade
  // doesn't leak into any shared atlas material.
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      if (!o.userData._lampMat) { o.material = o.material.clone(); o.userData._lampMat = true; }
      const m = o.material; if (!m) return;
      m.transparent = true; m.opacity = on; m.depthWrite = on > 0.5;
      if (!LENS_RE.test(o.name)) return;
      if (m.emissiveMap) { m.emissiveMap = null; m.needsUpdate = true; }
      m.emissive.set(LENS_COLOR); m.emissiveIntensity = on * LENS_EMISSIVE;
    });
    scene.visible = on > 0.01;
  }, [scene, on]);
  const target = useMemo(() => { const t = new THREE.Object3D(); t.position.set(0, 0.12, 0); return t; }, []);
  const spot = useRef(null);
  useEffect(() => { if (spot.current) spot.current.target = target; }, [target]);
  // dev readout: where the lamp head lands on screen (NDC) and the lamp factor
  const { camera } = useThree();
  const { scene: world } = useThree();
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    // dev: screen position (NDC) of a named rig part — "PressurePanel", "Fuel_Tank", "Wheel"…
    window.__hmRigPart = (name) => { const o = world.getObjectByName(name); if (!o) return null; const p = new THREE.Vector3(); o.getWorldPosition(p); const w = p.clone(); p.project(camera); return { world: w.toArray().map((v) => +v.toFixed(2)), ndc: [+p.x.toFixed(2), +p.y.toFixed(2)] }; };
    window.__hmRigLight = () => { const p = new THREE.Vector3(head[0], head[1] + 1, head[2]).project(camera); return { head, ndc: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], on }; };
    return () => { delete window.__hmRigLight; delete window.__hmRigPart; };
  }, [camera, head, on, world]);
  return (
    <>
      <group scale={PUMPJACK_SCALE}><primitive object={scene} /></group>
      <primitive object={target} />
      <spotLight ref={spot} position={head} intensity={on * SPOT_INTENSITY} color={LENS_COLOR} angle={0.62} penumbra={0.55} distance={4} decay={2} />
    </>
  );
}
// 3×3 cells so strike puddles and thrown rock have the same room they get in
// the field (Pumpjack clips them to worldW/worldD); the rig sits on the centre.
const TILE_CELLS = 3;
const TILE_MID = 1;

// The same close-up the field's fly-to lands on for a phone (CameraFlyTo,
// `target.mobile`): look at (x, y−0.10, z+0.05) from (x+0.65, y+0.12, z+0.75)
// with the plot at y = 1.3 — i.e. the field group's +1 lift plus 0.3. The
// scene keeps that +1 group so the numbers carry over unchanged.
// Tightened 2026-09-02 at Michelle's ask: same bearing, ~20% closer, and the
// look-at raised to the rig's mid-height so it fills the portrait frame
// instead of floating under a slab of sky.
export const RIG_CAMERA = {
  position: [0.5, 1.3, 0.6],
  target: [0, 1.1, 0.05],
};

// Ground tile with the field's textures and palette. Full field depth so it
// reads as a cut-out of the mesa (the X-SECTION metaphor), one box either way.
export function MesaTile({ cellSize, depthZ, envPreset, parabolum }) {
  const { sideTex, topoTex, palette } = useGroundLook(envPreset, parabolum);
  const size = TILE_CELLS * cellSize;
  const height = depthZ * cellSize * 0.5;
  const materials = useMemo(() => {
    const top = new THREE.MeshStandardMaterial({ map: topoTex, color: palette.top, roughness: 0.9, metalness: 0.05 });
    const bottom = new THREE.MeshStandardMaterial({ color: palette.bottom, roughness: 0.95, metalness: 0.02 });
    const side = new THREE.MeshStandardMaterial({ map: sideTex, color: palette.side, roughness: 0.85, metalness: 0.05 });
    return [side, side, top, bottom, side, side];
  }, [sideTex, topoTex, palette]);
  useEffect(() => () => { materials.forEach((m) => m.dispose()); }, [materials]);
  return (
    <mesh position={[0, -height / 2, 0]} material={materials}>
      <boxGeometry args={[size, height, size]} />
    </mesh>
  );
}

/**
 * Props mirror what OilVoxelGrid feeds the selected plot's Pumpjack, minus the
 * field. `plot` is the player's { col, row } (null = showcase rig, no live
 * state). `demon` is the stopgap for the hell-hit encounter until the arena
 * ships: when a bounty targets THIS plot the demon rises here, on the tile,
 * so a phone player can still tap it and claim the bounty.
 */
// The phone camera. Rests on the rig shot (RIG_CAMERA); `view="panel"` glides
// it to a head-on view of the MachinePanel (the report's MACHINE PANEL chip,
// 2026-09-05 — the panel sits at the frame edge on every rig model, so a thumb
// can't reach it in the 3D view; the chip does the reaching). The panel's front
// is derived the way Pumpjack's focusMachinePanel does it on the desktop: the
// thinner horizontal axis is the depth, the gauge children pick the side. Also
// puts the camera back on the rig whenever the scene mounts — the arena (which
// swaps in for this scene) parks the camera somewhere else entirely.
const PANEL_VIEW = { distMul: 2.6, minDist: 0.16, lift: 0.3, ease: 6 };
function findMachinePanel(root) {
  let found = null;
  root.traverse((o) => { if (!found && typeof o.name === "string" && o.name.startsWith("MachinePanel")) found = o; });
  return found;
}
function RigCamera({ view = "rig", controlsRef }) {
  const { camera, scene } = useThree();
  const goalPos = useRef(new THREE.Vector3(...RIG_CAMERA.position));
  const goalTgt = useRef(new THREE.Vector3(...RIG_CAMERA.target));
  const curTgt = useRef(new THREE.Vector3(...RIG_CAMERA.target));
  const panelRef = useRef(null);
  // The glide DRIVES the camera only while a view change is in flight; once it
  // has arrived it hands the camera back to the orbit controls (Michelle,
  // 2026-09-06: "the model won't let me rotate it" — the first version drove
  // it every frame and ate every drag).
  const driving = useRef(true);
  useEffect(() => {
    camera.position.set(...RIG_CAMERA.position);
    camera.lookAt(...RIG_CAMERA.target);
    curTgt.current.set(...RIG_CAMERA.target);
    camera.updateProjectionMatrix();
    if (typeof window !== "undefined") window.__hmRigCam = () => ({ pos: camera.position.toArray().map((v) => +v.toFixed(3)), rot: camera.rotation.toArray().slice(0, 3).map((v) => +v.toFixed(3)), view, driving: driving.current });
  }, [camera, view]);
  useEffect(() => { driving.current = true; }, [view]);
  useFrame((_, dt) => {
    const controls = controlsRef?.current;
    if (!driving.current) { if (controls && !controls.enabled) controls.enabled = true; return; }
    if (controls && controls.enabled) controls.enabled = false;   // no tug-of-war mid-glide
    if (view === "panel") {
      // the pump mounts after the camera and the panel node is inside its clone — resolve lazily
      if (!panelRef.current || !panelRef.current.parent) panelRef.current = findMachinePanel(scene);
      const panel = panelRef.current;
      if (panel) {
        panel.updateWorldMatrix(true, false);
        const bbox = new THREE.Box3().setFromObject(panel);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const axis = size.x < size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        const avg = new THREE.Vector3(); let n = 0; const tmp = new THREE.Vector3();
        panel.traverse((c) => { if (c !== panel && c.isMesh) { avg.add(c.getWorldPosition(tmp)); n++; } });
        let sign = 1;
        if (n > 0) { avg.divideScalar(n).sub(center); const d = avg.dot(axis); if (Math.abs(d) > 1e-5) sign = Math.sign(d); }
        const front = axis.multiplyScalar(sign); front.y = 0; front.normalize();
        const dist = Math.max(PANEL_VIEW.minDist, Math.max(size.x, size.y, size.z) * PANEL_VIEW.distMul);
        goalPos.current.copy(center).addScaledVector(front, dist); goalPos.current.y += dist * PANEL_VIEW.lift;
        goalTgt.current.copy(center);
      }
    } else {
      goalPos.current.set(...RIG_CAMERA.position); goalTgt.current.set(...RIG_CAMERA.target);
    }
    const k = 1 - Math.exp(-(dt || 0.016) * PANEL_VIEW.ease);
    camera.position.lerp(goalPos.current, k);
    curTgt.current.lerp(goalTgt.current, k);
    camera.lookAt(curTgt.current);
    // arrived: hand the camera (and its look-at) to the orbit controls, which
    // then spin about whatever we glided to — the rig or the panel
    if (camera.position.distanceTo(goalPos.current) < 0.004 && curTgt.current.distanceTo(goalTgt.current) < 0.004) {
      camera.position.copy(goalPos.current); curTgt.current.copy(goalTgt.current); camera.lookAt(curTgt.current);
      if (controls) { controls.target.copy(curTgt.current); controls.update?.(); controls.enabled = true; }
      driving.current = false;
    }
  });
  return null;
}

export default function RigScene({
  config,
  plot = null,
  gridSize = 10,
  depthZ = 20,
  cellSize = 1,
  blockHash,
  numberOfDeposits,
  numberOfHellPockets,
  drillDay = 0,
  oilStrike,
  drillEvent = 0,
  drillProximity = 0,
  tankFill = 0,
  onTankDrain,
  envPreset,
  envMapPreset = "warehouse",
  skyEnv = null,                 // { sky, skyBottom, ground, sunHour, preset } → reflections = the scene's own sky
  parabolum = false,
  forceStrikeGusher = false,
  gusherTrigger = 0,
  gusherEvents = [],
  hasMessages = false,
  onEnvelopeClick,
  hellActive = false,
  demon = null,
  cameraViewable = true,
  view = "rig",                  // "rig" | "panel" — the report's MACHINE PANEL chip glides the camera
}) {
  const { scene, animations } = useGLTF(RIG_GLB);
  const controlsRef = useRef(null);
  const skyMap = useSkyEnvMap(skyEnv);
  const hdrMap = useEnvMapSafe(skyEnv ? null : envMapPreset);
  const envMap = skyMap || hdrMap;

  // The deposit under the player's real column — same seeded distribution the
  // field uses, so the gusher rises from the right layer. Showcase: none.
  const depositLayer = useMemo(() => {
    if (!plot || !blockHash) return -1;
    const result = generateOilDistribution3D({
      blockHash, gridX: gridSize, gridY: gridSize, depthZ, totalOilBudget: OIL_FIELD_UNITS, numberOfDeposits, numberOfHellPockets,
    });
    const peak = buildPeakDepthMap(result.grid, gridSize, gridSize, depthZ);
    return peak[`${plot.col}_${plot.row}`] ?? -1;
  }, [plot, blockHash, gridSize, depthZ, numberOfDeposits, numberOfHellPockets]);

  const plotKey = plot ? `${plot.col}_${plot.row}` : null;
  const gusher = useMemo(() => {
    if (!plotKey) return { active: false, tier: "gusher" };
    const ev = gusherEvents.find((e) => e.col != null && `${e.col}_${e.row}` === plotKey);
    return { active: !!ev, tier: ev?.tier || "gusher" };
  }, [gusherEvents, plotKey]);

  const worldW = TILE_CELLS * cellSize;
  const demonHere = !!(demon && demon.active);

  return (
    <>
      <RigCamera view={view} controlsRef={controlsRef} />
      {/* Same +1 lift as the field's group, so the camera numbers match. */}
      <group position={[0, 1, 0]}>
        <MesaTile cellSize={cellSize} depthZ={depthZ} envPreset={envPreset} parabolum={parabolum} />
        <RigLight skyEnv={skyEnv} envPreset={envPreset} />
        <Pumpjack
          position={[0, 0, 0]}
          scene={scene}
          animations={animations}
          drillDay={drillDay}
          maxDrillDay={depthZ}
          depthCellSize={cellSize * 0.5}
          depositLayer={depositLayer}
          highlighted={false}
          panelZoomed={view === "panel"}   // the chip's view makes the panel buttons live
          pumpConfig={config}
          envMap={envMap}
          oilStrike={oilStrike}
          drillEvent={drillEvent}
          drillProximity={drillProximity}
          tankFill={tankFill}
          onTankDrain={onTankDrain}
          envPreset={envPreset}
          parabolum={parabolum}
          forceStrikeGusher={forceStrikeGusher}
          gusherTrigger={gusherTrigger}
          gusherActive={gusher.active}
          gusherLingering={false}
          gusherTier={gusher.tier}
          hasMessages={hasMessages}
          onEnvelopeClick={onEnvelopeClick}
          hellActive={hellActive}
          worldW={worldW}
          worldD={worldW}
          cameraViewable={cameraViewable}
        />
        {config?.showSign && (
          <PlotSign
            position={[0, 0, 0]}
            signImageUrl={config.signImageUrl || null}
            signStyle={config.signStyle}
            signFit={config.signFit || "fill"}
            showCamera={config.showCamera}
            isSelected
            cameraViewable={cameraViewable}
          />
        )}
        {demonHere && (
          <HellDemon
            summonerCol={TILE_MID}
            summonerRow={TILE_MID}
            targetCol={TILE_MID}
            targetRow={TILE_MID}
            cellSize={cellSize}
            worldW={worldW}
            worldD={worldW}
            gridX={TILE_CELLS}
            gridY={TILE_CELLS}
            seed={demon.seed || "demon"}
            clickable={demon.capturable !== false}
            requiredHits={demon.requiredHits || 1}
            onBanish={demon.onBanish}
            onMiss={demon.onMiss}
            onAttack={demon.onAttack}
            onSelect={demon.onSelect}
          />
        )}
      </group>
      {/* Spin around the rig; no pan, no flying off into the void. */}
      <OrbitControls
        ref={controlsRef}
        target={RIG_CAMERA.target}
        enablePan={false}
        enableDamping
        dampingFactor={0.1}
        minDistance={0.55}
        maxDistance={2.6}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI * 0.55}
      />
    </>
  );
}
