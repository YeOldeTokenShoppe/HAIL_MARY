"use client";
// The R3F canvas for The Ascension: a flat track with runners, and a big
// upright price-chart panel projected behind it. Pure presentation — all game
// logic lives in the engine.
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import RaceTrack3D from "./RaceTrack3D";
import Racer3D from "./Racer3D";
import Palms from "./Palms";
import ChartPanel from "./ChartPanel";
import { TRACK_LENGTH, STEP_RUN } from "@/game/ascension/config";

export default function AscensionStage({ race }) {
  const racers = Object.values(race.racers);
  const len = TRACK_LENGTH * STEP_RUN;
  const midX = len / 2;

  return (
    <Canvas
      shadows
      camera={{ position: [midX - 6.5, 5, 12], fov: 42 }}
      style={{ position: "absolute", inset: 0, background: "#04060a" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 14, 9]} intensity={1.1} castShadow />

      {/* big upright chart panel, standing behind the runners */}
      <ChartPanel race={race} position={[midX, 3.6, -3]} width={13} height={6.2} />

      <RaceTrack3D />
      <Suspense fallback={null}>
        <Palms />
        {racers.map((r) => (
          <Racer3D key={r.id} racer={r} />
        ))}
      </Suspense>

      <OrbitControls target={[midX, 2, -1]} maxPolarAngle={Math.PI * 0.52} />
    </Canvas>
  );
}
