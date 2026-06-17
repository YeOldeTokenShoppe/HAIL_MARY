"use client";
// Vaporwave set-dressing: rows of palms flanking the runway, reusing the
// project's own palm2 model (no sourced track asset). Instanced via drei <Clone>
// so one load serves every palm. SCALE/yOffset are first-guess values — tune
// against a screenshot (GLB node transforms make exact size hard to predict).
import { useGLTF, Clone } from "@react-three/drei";
import {
  TRACK_LENGTH,
  STEP_RUN,
  LANE_COUNT,
  LANE_GAP,
  DRACO_PATH,
} from "@/game/ascension/config";

const PALM = { model: "/models/palm2.glb", scale: 0.22, yOffset: 0, count: 4 };

export default function Palms() {
  const { scene } = useGLTF(PALM.model, DRACO_PATH);
  const len = TRACK_LENGTH * STEP_RUN;
  const edgeZ = (LANE_COUNT * LANE_GAP) / 2 + 2.4; // pushed well clear of the lanes

  const palms = [];
  for (let i = 0; i < PALM.count; i++) {
    const x = (i / (PALM.count - 1)) * len;
    for (const z of [edgeZ, -edgeZ]) {
      palms.push(
        <Clone
          key={`${i}-${z}`}
          object={scene}
          position={[x, PALM.yOffset, z]}
          scale={PALM.scale}
        />,
      );
    }
  }
  return <group>{palms}</group>;
}

useGLTF.preload(PALM.model, DRACO_PATH);
