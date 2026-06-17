"use client";
// Flat multi-lane neon runway, fully procedural (no asset risk): glowing lane
// edges, start/finish gates, per-step markers, side pylons, and the moon at the
// finish. Volatility lives in the chart panel, not the ground. Palms and other
// GLB set-dressing are layered separately (Palms.jsx).
import {
  TRACK_LENGTH,
  STEP_RUN,
  LANE_COUNT,
  LANE_GAP,
} from "@/game/ascension/config";

const LEN = TRACK_LENGTH * STEP_RUN;
const MIDX = LEN / 2;
const DEPTH = LANE_COUNT * LANE_GAP + 0.8;
const HALF = DEPTH / 2;

function NeonBox({ position, args, color, intensity = 1.1 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        toneMapped={false}
      />
    </mesh>
  );
}

function Gate({ x, color }) {
  const h = 3;
  const gz = HALF + 0.2;
  return (
    <group position={[x, 0, 0]}>
      <NeonBox position={[0, h / 2, gz]} args={[0.14, h, 0.14]} color={color} intensity={1.3} />
      <NeonBox position={[0, h / 2, -gz]} args={[0.14, h, 0.14]} color={color} intensity={1.3} />
      <NeonBox position={[0, h + 0.05, 0]} args={[0.14, 0.14, gz * 2 + 0.14]} color={color} intensity={1.3} />
    </group>
  );
}

export default function RaceTrack3D() {
  // lane dividers (glowing)
  const dividers = [];
  for (let i = 0; i <= LANE_COUNT; i++) {
    const z = (i - LANE_COUNT / 2) * LANE_GAP;
    const outer = i === 0 || i === LANE_COUNT;
    dividers.push(
      <mesh key={`d${i}`} position={[MIDX, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LEN + 1.5, outer ? 0.06 : 0.035]} />
        <meshBasicMaterial color="#2bd47f" transparent opacity={outer ? 0.8 : 0.4} />
      </mesh>,
    );
  }

  // per-step transverse markers
  const markers = [];
  for (let i = 1; i < TRACK_LENGTH; i++) {
    markers.push(
      <mesh key={`m${i}`} position={[i * STEP_RUN, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.05, DEPTH]} />
        <meshBasicMaterial color="#8ee9ff" transparent opacity={0.4} />
      </mesh>,
    );
  }

  // side pylons (synthwave road posts)
  const pylons = [];
  let n = 0;
  for (let x = 0.8; x < LEN; x += 1.5) {
    for (const z of [HALF + 0.35, -(HALF + 0.35)]) {
      const color = n % 2 ? "#8ee9ff" : "#ff7ac4";
      pylons.push(
        <NeonBox key={`p${x}-${z}`} position={[x, 0.35, z]} args={[0.1, 0.7, 0.1]} color={color} intensity={1} />,
      );
      n++;
    }
  }

  return (
    <group>
      <gridHelper args={[60, 60, "#2bd47f", "#0c3a25"]} position={[MIDX, 0, 0]} />

      {/* track surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[MIDX, 0.01, 0]} receiveShadow>
        <planeGeometry args={[LEN + 1.5, DEPTH]} />
        <meshStandardMaterial color="#0a1016" emissive="#0c2a1d" emissiveIntensity={0.18} />
      </mesh>

      {dividers}
      {markers}
      {pylons}

      <Gate x={0} color="#ff7ac4" />
      <Gate x={LEN} color="#ffe28a" />

      {/* finish line */}
      <mesh position={[LEN, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.14, DEPTH]} />
        <meshBasicMaterial color="#ffe28a" />
      </mesh>

      {/* THE MOON beacon above the finish */}
      <mesh position={[LEN, 3.6, 0]}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color="#dff3ff" emissive="#bfe6ff" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <pointLight position={[LEN, 3.6, 1.5]} intensity={6} distance={18} color="#bfe6ff" />
    </group>
  );
}
