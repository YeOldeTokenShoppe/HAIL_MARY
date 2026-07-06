"use client";

// PanelVotive — the user's lit "votive candle" as a small always-lit 3D
// object for a /main side panel (DESKTOP + iPad only). Ported from the
// landing page's HeroAltarObject minus all scroll/melt/ignition VFX.
// Self-contained — does NOT import from src/app/page.js.

import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/tinyVotiveOnly2.glb";

// The votive GLB is Draco-compressed (KHR_draco_mesh_compression). Point drei's
// loader at the app's self-hosted decoder (public/draco/) instead of its default
// gstatic CDN — otherwise useGLTF suspends forever and the canvas stays blank.
useGLTF.setDecoderPath("/draco/");

// Votive config, copied from CANDLE_VARIANTS.votive in src/app/page.js.
const VOTIVE = {
  meltMeshName: "XBASE", // the wax column group
  wickMaterialName: "Mat15.001", // second material slot on XBase
  imageMeshName: "senora", // the saint decal mesh (child of glass)
  tintMeshName: "XBase", // wax column group (same node as meltMesh)
  waxMaterialName: "Mat9.001", // wax slot on the tint mesh
};

// --- Flame flicker noise (copied from page.js) ------------------------------
// Hash-based 1D value noise; interpolated random samples give genuine
// aperiodic variation rather than the rhythmic "dancing" that sines produce.
function flameHash1D(n) {
  n = (n * 2654435761) | 0;
  n = ((n >>> 16) ^ n) * 0x45d9f3b;
  n = ((n >>> 16) ^ n) * 0x45d9f3b;
  n = (n >>> 16) ^ n;
  return ((n >>> 0) / 4294967295) * 2 - 1;
}
function flameNoise1D(t) {
  const i = Math.floor(t);
  const f = t - i;
  const sf = f * f * (3 - 2 * f);
  return flameHash1D(i) * (1 - sf) + flameHash1D(i + 1) * sf;
}
function flameFbm1D(t) {
  return flameNoise1D(t) * 0.65 + flameNoise1D(t * 2.3 + 17.1) * 0.35;
}

// Swap a flat authored material for a lit MeshStandardMaterial so the wax
// responds to scene lights. Preserves authored color/maps and nudges color
// +0.2x so the tone reads a touch more vividly. (Copied from page.js.)
function upgradeWaxMaterial(oldMat) {
  if (!oldMat) return oldMat;
  if (oldMat.userData?.isWaxUpgraded) return oldMat;
  const color = oldMat.color?.clone() ?? new THREE.Color("#ffffff");
  color.multiplyScalar(1.2);
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: oldMat.map ?? null,
    normalMap: oldMat.normalMap ?? null,
    roughnessMap: oldMat.roughnessMap ?? null,
    metalnessMap: oldMat.metalnessMap ?? null,
    aoMap: oldMat.aoMap ?? null,
    emissiveMap: oldMat.emissiveMap ?? null,
    alphaMap: oldMat.alphaMap ?? null,
    vertexColors: oldMat.vertexColors ?? false,
    side: oldMat.side ?? THREE.FrontSide,
    roughness: 0.5,
    metalness: 0.0,
    emissive: color.clone().multiplyScalar(0.15),
    emissiveIntensity: 1.0,
    transparent: true,
    depthWrite: true,
  });
  // Carry the authored name forward so the tint apply can still target it.
  if (oldMat.name) mat.name = oldMat.name;
  mat.userData.isWaxUpgraded = true;
  return mat;
}

const norm = (s) => (s ? s.replace(/[._]/g, "").toLowerCase() : null);

function VotiveModel({ votiveImage, votiveTint, draggable = true }) {
  const { scene } = useGLTF(MODEL_PATH);
  const spinRef = useRef(null);
  const flameNodeRef = useRef(null);
  const flameLightRef = useRef(null);
  const flameBaseScaleRef = useRef({ x: 1, y: 1, z: 1 });
  const flameBaseRotationRef = useRef({ x: 0, y: 0, z: 0 });
  const flameBaseIntensityRef = useRef(1);
  const dragRef = useRef({ active: false, lastX: 0 });

  // Clone the cached GLTF scene (and its materials) so multiple instances /
  // re-renders never mutate the shared cache. scene.clone(true) shares
  // materials by reference, so we clone those too — otherwise a tint on one
  // panel would bleed into every other votive on the page.
  const votive = useMemo(() => {
    const clone = scene.clone(true);
    // Drop the candlestick/stand props so the panel shows JUST the votive
    // candle (glass + wax + flame + saint image), not a tall holder. Removing
    // (not just hiding) also keeps them out of the auto-fit bounds below, so
    // the votive itself fills the frame.
    ["SM_Prop_Candle_Stand_02", "PillarProp"].forEach((name) => {
      const node = clone.getObjectByName(name);
      if (node && node.parent) node.parent.remove(node);
    });
    clone.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = Array.isArray(obj.material)
          ? obj.material.map((m) => m.clone())
          : obj.material.clone();
      }
    });
    return clone;
  }, [scene]);

  // Auto-fit: center the votive at the origin and scale it to a stable size
  // so the fixed camera frames it nicely regardless of the GLB's authored
  // units. Computed on the clone (its local transforms are intact).
  const fit = useMemo(() => {
    // Ensure world matrices are current before measuring — the clone isn't in
    // a scene yet, so its matrixWorld would otherwise be stale and the box
    // (hence scale/center) wrong, which can push the model off-camera.
    votive.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(votive);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return { scale: 1.7 / maxDim, center };
  }, [votive]);

  // Material setup: lit wax, see-through glass, visible wick + flame.
  useEffect(() => {
    const wickTarget = norm(VOTIVE.wickMaterialName);
    const isWickMat = (m) => wickTarget && m?.name && norm(m.name) === wickTarget;
    const imageMeshName = VOTIVE.imageMeshName.toLowerCase();

    votive.traverse((obj) => {
      // Global mesh pass: transparent so the candle sorts after the panel's
      // background; glass skips depthWrite so its contents render through.
      if (obj.isMesh && obj.material) {
        obj.renderOrder = 200;
        const isGlass = obj.name?.toLowerCase() === "glass";
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          m.transparent = true;
          m.depthWrite = !isGlass;
        });
      }

      // Wax column (XBASE): upgrade every non-wick, non-flame material to a
      // lit MeshStandardMaterial. Flame/wick are parented here, so skip them.
      if (obj.name && obj.name.toUpperCase() === VOTIVE.meltMeshName.toUpperCase()) {
        const inFlame = (node) => {
          let cur = node;
          while (cur && cur !== obj) {
            const u = cur.name?.toUpperCase() ?? "";
            if (u.startsWith("FLAME") && !u.includes("WICK")) return true;
            cur = cur.parent;
          }
          return false;
        };
        obj.traverse((d) => {
          if (!d.isMesh || !d.material || inFlame(d)) return;
          if (Array.isArray(d.material)) {
            d.material = d.material.map((m) => (isWickMat(m) ? m : upgradeWaxMaterial(m)));
          } else if (!isWickMat(d.material)) {
            d.material = upgradeWaxMaterial(d.material);
          }
        });
        // Wick: warm emissive so it reads when unlit, and depthTest:false +
        // renderOrder bump so the glass cylinder doesn't cull it.
        obj.traverse((d) => {
          const mats = Array.isArray(d.material)
            ? d.material
            : d.material
              ? [d.material]
              : [];
          mats.forEach((m) => {
            if (!m || !m.name || !m.emissive) return;
            if (norm(m.name) === wickTarget) {
              m.emissive.setHex(0x8a5a3a);
              m.emissiveIntensity = 0.9;
              m.depthTest = false;
              d.renderOrder = 220;
            }
          });
        });
      }

      // Flame node (starts with "FLAME", excludes "WICK"). Additive blending
      // + depthWrite:false so the billboard quads don't leave ghost
      // rectangles. Always visible here (the GLB ships it hidden). First
      // match wins so we don't latch onto a sub-mesh.
      if (obj.name && !flameNodeRef.current) {
        const u = obj.name.toUpperCase();
        if (u.startsWith("FLAME") && !u.includes("WICK")) {
          flameNodeRef.current = obj;
          flameBaseScaleRef.current = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
          flameBaseRotationRef.current = {
            x: obj.rotation.x,
            y: obj.rotation.y,
            z: obj.rotation.z,
          };
          obj.visible = true;
          obj.traverse((d) => {
            d.visible = true;
            if (!d.isMesh || !d.material) return;
            const mats = Array.isArray(d.material) ? d.material : [d.material];
            mats.forEach((m) => {
              if (!m) return;
              m.blending = THREE.AdditiveBlending;
              m.depthWrite = false;
              m.transparent = true;
            });
            d.renderOrder = 240;
          });
        }
      }

      // Authored candle-flame pointLight — capture it, cache its intensity,
      // and switch it on (the GLB ships it off).
      if (obj.isLight && !flameLightRef.current) {
        flameLightRef.current = obj;
        flameBaseIntensityRef.current = obj.intensity;
        obj.visible = true;
      }

      // Saint decal (senora): alphaTest so the PNG's transparent corners
      // don't write depth and occlude the flame behind the label.
      if (obj.name?.toLowerCase() === imageMeshName) {
        obj.traverse((d) => {
          if (!d.isMesh || !d.material) return;
          const mats = Array.isArray(d.material) ? d.material : [d.material];
          mats.forEach((m) => {
            if (!m) return;
            m.alphaTest = 0.5;
            m.needsUpdate = true;
          });
        });
      }
    });
  }, [votive]);

  // User-customizable surfaces: swap the saint decal texture and tint the
  // wax. Keyed on the props so a new color/image re-applies without redoing
  // the heavy material upgrade above.
  useEffect(() => {
    const imageMeshName = VOTIVE.imageMeshName.toLowerCase();
    const tintMeshName = VOTIVE.tintMeshName.toLowerCase();
    const waxTarget = norm(VOTIVE.waxMaterialName);
    const isWaxMat = (m) => waxTarget && m?.name && norm(m.name) === waxTarget;

    const applyToMats = (root, fn) => {
      root.traverse((d) => {
        if (!d.isMesh || !d.material) return;
        const mats = Array.isArray(d.material) ? d.material : [d.material];
        mats.forEach((m) => m && fn(m));
      });
    };

    votive.traverse((obj) => {
      const name = obj.name?.toLowerCase() ?? "";
      if (!name) return;

      // Decal — swap base-color map (and emissiveMap, so the old image
      // doesn't linger as an emissive ghost). Cache the baked maps once.
      if (name === imageMeshName) {
        applyToMats(obj, (m) => {
          if (!("bakedMap" in m.userData)) m.userData.bakedMap = m.map ?? null;
          if (!("bakedEmissiveMap" in m.userData)) {
            m.userData.bakedEmissiveMap = m.emissiveMap ?? null;
          }
          const restore = () => {
            if (m.map && m.map !== m.userData.bakedMap) m.map.dispose();
            m.map = m.userData.bakedMap;
            m.emissiveMap = m.userData.bakedEmissiveMap;
            m.needsUpdate = true;
          };
          if (votiveImage) {
            // THREE.TextureLoader resolves preset paths AND data: URLs.
            new THREE.TextureLoader().load(
              votiveImage,
              (tex) => {
                // Match GLTFLoader conventions so UVs / color space line up
                // with the baked texture this replaces.
                tex.flipY = false;
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.anisotropy = 16;
                if (m.map && m.map !== m.userData.bakedMap) m.map.dispose();
                m.map = tex;
                if (m.userData.bakedEmissiveMap) m.emissiveMap = tex;
                m.needsUpdate = true;
              },
              undefined,
              restore, // load failure → fall back to the baked decal
            );
          } else {
            restore();
          }
        });
      }

      // Wax tint — replace (not multiply) the wax diffuse + emissive so the
      // user's picked hue reads true. null restores the authored color.
      if (name === tintMeshName) {
        applyToMats(obj, (m) => {
          if (!m.color || !isWaxMat(m)) return;
          if (!m.userData.authoredColor) m.userData.authoredColor = m.color.clone();
          if (m.emissive && !m.userData.authoredEmissive) {
            m.userData.authoredEmissive = m.emissive.clone();
          }
          if (votiveTint) {
            const tint = new THREE.Color(votiveTint);
            m.color.copy(tint);
            if (m.emissive) m.emissive.copy(tint).multiplyScalar(0.18);
          } else {
            m.color.copy(m.userData.authoredColor);
            if (m.emissive && m.userData.authoredEmissive) {
              m.emissive.copy(m.userData.authoredEmissive);
            }
          }
          m.needsUpdate = true;
        });
      }
    });
  }, [votive, votiveImage, votiveTint]);

  // Drag-to-spin (optional). Window-level listeners so one drag = one
  // continuous rotation even when the cursor leaves the mesh silhouette.
  const beginDrag = (e) => {
    if (typeof window === "undefined") return;
    e.stopPropagation();
    dragRef.current.active = true;
    dragRef.current.lastX = e.clientX;
    const move = (me) => {
      if (!dragRef.current.active || !spinRef.current) return;
      spinRef.current.rotation.y += (me.clientX - dragRef.current.lastX) * 0.01;
      dragRef.current.lastX = me.clientX;
    };
    const end = () => {
      dragRef.current.active = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  useFrame((state) => {
    // No auto-rotate — the votive holds still; the user drags to turn it
    // (drag enabled only on the close-up instance). Flame keeps flickering.
    const ft = state.clock.elapsedTime;
    // Flame flicker — subtle scale + sway noise so it looks alive.
    const fn = flameNodeRef.current;
    if (fn) {
      const bs = flameBaseScaleRef.current;
      const br = flameBaseRotationRef.current;
      const flicker = 1 + flameFbm1D(ft * 3.5) * 0.09;
      const stretch = 1 + flameFbm1D(ft * 3.0 + 100) * 0.06;
      fn.scale.set(bs.x * flicker, bs.y * flicker * stretch, bs.z * flicker);
      fn.rotation.x = br.x + flameFbm1D(ft * 1.9 + 200) * 0.03;
      fn.rotation.z = br.z + flameFbm1D(ft * 2.2 + 300) * 0.045;
    }
    // Flicker the authored flame light in sympathy.
    if (flameLightRef.current) {
      flameLightRef.current.intensity =
        flameBaseIntensityRef.current * (1 + flameFbm1D(ft * 4.0 + 500) * 0.15);
    }
  });

  return (
    <group ref={spinRef} scale={fit.scale} onPointerDown={draggable ? beginDrag : undefined}>
      <primitive
        object={votive}
        position={[-fit.center.x, -fit.center.y, -fit.center.z]}
      />
    </group>
  );
}

export default function PanelVotive({
  votiveImage = null, // preset path like "/goldGuadalupe.svg" OR a data: URL; null = baked decal
  votiveTint = null, // hex string for wax color; null = authored color
  height = 260, // px number OR CSS length (e.g. "100%") for the canvas box
  draggable = false, // drag-to-rotate; off in the small panel, on in the close-up
  className = "",
}) {
  return (
    <div className={className} style={{ width: "100%", height }}>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.1, 3.4], fov: 32, near: 0.1, far: 100 }}
      >
        {/* Soft omnidirectional base so the wax reads with shading. */}
        <ambientLight intensity={0.6} color="#ffffff" />
        <hemisphereLight intensity={0.35} color="#ffd8b0" groundColor="#18202c" />
        {/* Warm fill near the flame so the wax picks up candle-light. */}
        <pointLight position={[0.3, 0.9, 0.6]} intensity={1.3} color="#ffd9a0" distance={8} />
        <Suspense fallback={null}>
          <VotiveModel votiveImage={votiveImage} votiveTint={votiveTint} draggable={draggable} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
