"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { fieldKeepOutRects, pointInRect, seededRandom, roadControlPoints, roadHalfWidth, distanceToPolyline } from "@/lib/desertKeepOut";

// Sparse cacti in the open desert around the claims (2026-10-06). One
// InstancedMesh per cactus model — three draw calls for the whole lot. The
// layout is seeded, so it is the same desert on every load and for every
// player; bump SEED to reroll it. Placement is rejection-sampled on an annulus
// outside the keep-out rects (claims + strip + refinery, lib/desertKeepOut.js)
// with a minimum spacing so nothing clumps. Dev: ?cacti=0 hides them.

const SEED = 80;
const TYPES = [
  // targetH: world height the model is normalised to (a claim is 1 unit; a rig
  // stands well under one). Types are dealt round-robin within each band.
  { url: "/models/Cactus1.glb", targetH: 0.52 },
  { url: "/models/Cactus2.glb", targetH: 0.42 },
  { url: "/models/Cactus3.glb", targetH: 0.38 },
];
const RING_PAD = 0.6;        // first band's inner radius = field half-diagonal + this
// Distance bands out to the horizon hills (HORIZON_REACH is 282; the ridge
// reads from ~150 on). Counts thin out with distance while the per-instance
// scale grows a little, so the far ones still make a silhouette against the
// hills instead of vanishing. Everything is instanced: three draw calls total.
const BANDS = [
  { outer: 17,  count: 6,   spacing: 1.8, scale: [0.8, 1.3] },
  { outer: 45,  count: 7,  spacing: 3.6, scale: [0.9, 1.5] },
  { outer: 100, count: 10,  spacing: 6.5, scale: [1.1, 1.9] },
  { outer: 170, count: 9,  spacing: 12,  scale: [1.4, 2.4] },
];
const TILT_MAX = 0.05;       // radians — barely-there lean
const ROAD_CLEARANCE = 0.6;  // sand kept bare either side of the dirt road

const ENABLED = typeof window === "undefined"
  || new URLSearchParams(window.location.search).get("cacti") !== "0";

function firstMesh(scene) {
  let m = null;
  scene.traverse((o) => { if (!m && o.isMesh) m = o; });
  return m;
}

function CactusInstances({ scene, targetH, count, points }) {
  const { geometry, material, baseScale } = useMemo(() => {
    const mesh = firstMesh(scene);
    scene.updateMatrixWorld(true);
    // Bake the mesh node's own transform into the vertices: Synty exports carry
    // the Z-up fix as a −90° X rotation (plus the 0.01 scale) on the node, and
    // an instance matrix built from yaw alone would lay the cactus on its side
    // (which is exactly what happened on 2026-10-06).
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const h = Math.max(geometry.boundingBox.max.y - geometry.boundingBox.min.y, 1e-6);
    return { geometry, material: mesh.material, baseScale: targetH / h };
  }, [scene, targetH]);

  const matrices = useMemo(() => {
    const out = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const pt of points) {
      e.set(pt.tiltX, pt.yaw, pt.tiltZ, "YXZ");
      q.setFromEuler(e);
      s.setScalar(baseScale * pt.scale);
      p.set(pt.x, 0, pt.z);
      out.push(m.compose(p, q, s).clone());
    }
    return out;
  }, [points, baseScale]);

  const ref = (inst) => {
    if (!inst) return;
    matrices.forEach((mat, i) => inst.setMatrixAt(i, mat));
    inst.count = matrices.length;
    inst.instanceMatrix.needsUpdate = true;
  };

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      raycast={() => {}}
    />
  );
}

export default function DesertScatter({ worldW = 10, worldD = 10, cellSize = 1 }) {
  const scenes = useGLTF(TYPES.map((t) => t.url));
  const placements = useMemo(() => {
    const rects = fieldKeepOutRects(worldW, worldD, cellSize);
    // Nothing grows on the road: densify its centreline so the point test
    // follows the curve, and clear the widest it gets plus a margin.
    const road = (() => {
      const pts = roadControlPoints(worldW, worldD, cellSize).map(([x, z]) => new THREE.Vector3(x, 0, z));
      return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5).getSpacedPoints(120).map((p) => [p.x, p.z]);
    })();
    const roadClear = roadHalfWidth(1) + ROAD_CLEARANCE;
    const rnd = seededRandom(SEED);
    const placed = [];
    const perType = TYPES.map(() => []);
    let inner = Math.hypot(worldW, worldD) / 2 + RING_PAD;
    for (const band of BANDS) {
      const outer = band.outer;
      // Deal types round-robin so each is spread across the band, not clumped.
      for (let n = 0; n < band.count; n++) {
        const typeIdx = n % TYPES.length;
        let pt = null;
        for (let attempt = 0; attempt < 60 && !pt; attempt++) {
          // Uniform by area over the band's annulus.
          const r = Math.sqrt(rnd() * (outer * outer - inner * inner) + inner * inner);
          const a = rnd() * Math.PI * 2;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          if (rects.some((rc) => pointInRect(x, z, rc))) continue;
          if (distanceToPolyline(x, z, road) < roadClear) continue;
          if (placed.some((o) => Math.hypot(o.x - x, o.z - z) < band.spacing)) continue;
          pt = {
            x, z,
            yaw: rnd() * Math.PI * 2,
            scale: band.scale[0] + rnd() * (band.scale[1] - band.scale[0]),
            tiltX: (rnd() * 2 - 1) * TILT_MAX,
            tiltZ: (rnd() * 2 - 1) * TILT_MAX,
          };
        }
        if (pt) { placed.push(pt); perType[typeIdx].push(pt); }
      }
      inner = outer;
    }
    return perType;
  }, [worldW, worldD, cellSize]);

  if (!ENABLED) return null;
  return (
    <group>
      {TYPES.map((t, i) => (
        <CactusInstances key={t.url} scene={scenes[i].scene} targetH={t.targetH} count={placements[i].length} points={placements[i]} />
      ))}
    </group>
  );
}

useGLTF.preload(TYPES.map((t) => t.url));
