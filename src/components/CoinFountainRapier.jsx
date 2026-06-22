// CoinFountainRapier.jsx
// @react-three/rapier coin fountain tuned to stop coins from intermeshing.
//
// The core ideas (see notes at bottom):
//   1. contactSkin       -> invisible margin so thin colliders never interpenetrate
//   2. collider slightly TALLER than the visible coin -> hides the skin gap
//   3. ccd               -> stops fast-falling coins tunneling through each other / floor
//   4. high solver iters -> stable stacks instead of compounding sink error
//   5. friction high, restitution ~0 -> coins settle instead of sliding/bouncing apart
//
// deps: three, @react-three/fiber, @react-three/rapier
//   npm i three @react-three/fiber @react-three/rapier

import { Canvas } from "@react-three/fiber";
import { Physics, RigidBody, CylinderCollider } from "@react-three/rapier";
import { useEffect, useRef, useState } from "react";

// --- Coin geometry constants -------------------------------------------------
const COIN_RADIUS = 0.5;
const COIN_VISUAL_HEIGHT = 0.08; // how thick the coin LOOKS
const COIN_COLLIDER_HALF_HEIGHT = 0.06; // half-height of the collider; a touch
//   taller than the visual so the contactSkin gap sits inside the rendered coin
const CONTACT_SKIN = 0.02; // the magic number for thin objects

function Coin({ position }) {
  return (
    <RigidBody
      position={position}
      colliders={false}        // we supply a hand-tuned collider instead of auto
      ccd                       // continuous collision detection: no tunneling
      friction={0.9}            // coins grab each other and settle
      restitution={0.05}        // almost no bounce
      linearDamping={0.2}
      angularDamping={0.4}
      density={5}
    >
      {/* Collider is a cylinder slightly taller than the mesh; contactSkin keeps
          a small gap that lives *inside* the visible coin so stacks look clean. */}
      <CylinderCollider
        args={[COIN_COLLIDER_HALF_HEIGHT, COIN_RADIUS]}
        contactSkin={CONTACT_SKIN}
      />
      <mesh castShadow receiveShadow>
        {/* cylinder is laid flat like a coin (Rapier cylinder axis = Y, matches) */}
        <cylinderGeometry
          args={[COIN_RADIUS, COIN_RADIUS, COIN_VISUAL_HEIGHT, 48]}
        />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.25} />
      </mesh>
    </RigidBody>
  );
}

// Spawns a new coin every `intervalMs` with a little outward/upward velocity.
function CoinSpawner({ intervalMs = 350, max = 80 }) {
  const [coins, setCoins] = useState([]);
  const id = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCoins((prev) => {
        const next = prev.length >= max ? prev.slice(1) : prev; // recycle oldest
        const jitter = () => (Math.random() - 0.5) * 0.4;
        return [
          ...next,
          { key: id.current++, position: [jitter(), 6, jitter()] },
        ];
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, max]);

  return coins.map((c) => <Coin key={c.key} position={c.position} />);
}

function Floor() {
  return (
    <RigidBody type="fixed" friction={1} restitution={0}>
      <CylinderCollider args={[0.25, 3]} position={[0, 0, 0]} />
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[3, 3, 0.5, 64]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </RigidBody>
  );
}

export default function CoinFountainRapier() {
  return (
    <Canvas shadows camera={{ position: [6, 6, 6], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />

      {/* numSolverIterations: the other half of the stability story.
          Default is ~4; bumping it makes tall coin stacks hold together. */}
      <Physics
        gravity={[0, -9.81, 0]}
        numSolverIterations={12}
        numAdditionalFrictionIterations={6}
      >
        <Floor />
        <CoinSpawner intervalMs={350} max={80} />
      </Physics>
    </Canvas>
  );
}

/* ---------------------------------------------------------------------------
TUNING NOTES

If coins still mesh:           raise CONTACT_SKIN (try 0.03–0.05) and/or
                               numSolverIterations (try 16).
If you see a visible gap:      lower CONTACT_SKIN, or make the visual cylinder
                               a hair taller than 2 * COIN_COLLIDER_HALF_HEIGHT.
If coins jitter at rest:       increase friction + linear/angularDamping.
If coins tunnel at high speed: keep `ccd`; reduce spawn velocity/height.
Performance:                   contactSkin is cheap; high solver iters + ccd are
                               the costly bits — cap the live coin count (`max`).
--------------------------------------------------------------------------- */
