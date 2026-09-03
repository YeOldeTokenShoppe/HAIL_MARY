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

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useGLTF, OrbitControls } from "@react-three/drei";
import useEnvMapSafe from "@/hooks/useEnvMapSafe";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { Pumpjack, PlotSign, HellDemon, useGroundLook, buildPeakDepthMap } from "@/components/OilVoxelGrid";

const RIG_GLB = "/models/oilJack_fancy_allProps2.glb";
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
function MesaTile({ cellSize, depthZ, envPreset, parabolum }) {
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
  parabolum = false,
  forceStrikeGusher = false,
  gusherTrigger = 0,
  gusherEvents = [],
  hasMessages = false,
  onEnvelopeClick,
  hellActive = false,
  demon = null,
  cameraViewable = true,
}) {
  const { scene, animations } = useGLTF(RIG_GLB);
  const envMap = useEnvMapSafe(envMapPreset);

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
      {/* Same +1 lift as the field's group, so the camera numbers match. */}
      <group position={[0, 1, 0]}>
        <MesaTile cellSize={cellSize} depthZ={depthZ} envPreset={envPreset} parabolum={parabolum} />
        <Pumpjack
          position={[0, 0, 0]}
          scene={scene}
          animations={animations}
          drillDay={drillDay}
          maxDrillDay={depthZ}
          depthCellSize={cellSize * 0.5}
          depositLayer={depositLayer}
          highlighted={false}
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
          />
        )}
      </group>
      {/* Spin around the rig; no pan, no flying off into the void. */}
      <OrbitControls
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
