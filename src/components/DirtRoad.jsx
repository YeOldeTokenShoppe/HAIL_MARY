"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { roadControlPoints, roadHalfWidth } from "@/lib/desertKeepOut";

// A dirt access road (2026-10-06): a flat ribbon laid on the horizon ground
// from the boardwalk's +X end out toward the hills on −Z. No asset — the dirt,
// the two wheel ruts and the feathered edges are painted once into a small
// canvas texture that repeats along the ribbon. Colour derives from the ground
// palette so it follows the environment presets. MeshStandardMaterial so the
// scene fog (FieldFog) hazes it like everything else. The centreline lives in
// lib/desertKeepOut.js, shared with the cactus scatter so nothing grows on it.
// Dev: ?road=0 hides it.

const SEGMENTS = 220;          // ribbon slices along the curve
const RUT_REPEAT_UNITS = 3;    // world units per texture repeat along the road
const LIFT = 0.012;            // above the ground plane (ground has polygonOffset +2)

const ENABLED = typeof window === "undefined"
  || new URLSearchParams(window.location.search).get("road") !== "0";

// 128×256 dirt tile: u across the road, v along it. Alpha feathers the edges.
function paintRoadTile(tint) {
  const W = 128, H = 256;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(W, H);
  // The canvas is tagged sRGB, so write sRGB bytes. Going through THREE.Color
  // here would hand back LINEAR components (ColorManagement decodes the hex),
  // and writing those as sRGB quartered the brightness — the road came out as
  // dark mud whatever the tint said (2026-10-06). Parse the hex directly.
  const base = { r: parseInt(tint.slice(1, 3), 16) / 255, g: parseInt(tint.slice(3, 5), 16) / 255, b: parseInt(tint.slice(5, 7), 16) / 255 };
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H;
      // Ruts: two soft dark troughs; a slightly lighter, drier crown between.
      const rut = Math.exp(-((u - 0.3) ** 2) / 0.0035) + Math.exp(-((u - 0.7) ** 2) / 0.0035);
      const crown = Math.exp(-((u - 0.5) ** 2) / 0.012);
      // Grit: two octaves of hash noise, stretched along v (dragged by tyres).
      const g1 = hash(Math.floor(x / 2), Math.floor(y / 6));
      const g2 = hash(Math.floor(x / 5), Math.floor(y / 14) + 97);
      const grit = (g1 * 0.6 + g2 * 0.4 - 0.5) * 0.16;
      let shade = 1 - rut * 0.22 + crown * 0.06 + grit;
      // Edge feather, roughened so the road does not read as a cut strip.
      const edgeNoise = (hash(Math.floor(y / 9), u > 0.5 ? 3 : 5) - 0.5) * 0.08;
      const e = Math.abs(u - 0.5) + edgeNoise;
      const alpha = THREE.MathUtils.smoothstep(0.5 - e, 0.0, 0.14);
      const i = (y * W + x) * 4;
      img.data[i] = Math.round(THREE.MathUtils.clamp(base.r * shade, 0, 1) * 255);
      img.data[i + 1] = Math.round(THREE.MathUtils.clamp(base.g * shade, 0, 1) * 255);
      img.data[i + 2] = Math.round(THREE.MathUtils.clamp(base.b * shade, 0, 1) * 255);
      img.data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export default function DirtRoad({ worldW = 10, worldD = 10, cellSize = 1, palette }) {
  // Dirt = the sand, a little LIGHTER and dustier (sun-bleached, packed track);
  // the ruts then read as the darker element. The first cut went darker and
  // browner and read as a mud strip (2026-10-06).
  const tint = useMemo(() => {
    const col = new THREE.Color(palette?.top || "#ddd5cc");
    const hsl = {}; col.getHSL(hsl);
    col.setHSL(hsl.h, hsl.s * 0.85, Math.min(0.95, hsl.l * 1.12));
    return "#" + col.getHexString();
  }, [palette]);

  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const t = new THREE.CanvasTexture(paintRoadTile(tint));
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [tint]);
  useEffect(() => () => texture?.dispose(), [texture]);

  const geometry = useMemo(() => {
    const ctrl = roadControlPoints(worldW, worldD, cellSize).map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal", 0.5);
    const lengths = curve.getLengths(SEGMENTS);
    const total = lengths[lengths.length - 1];
    const pos = [], uv = [], idx = [];
    const p = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= SEGMENTS; i++) {
      // Sample by arc length so the near, tightly-curved part is not starved
      // of slices while the long straight run to the hills hogs them.
      const u = i / SEGMENTS;
      const t = curve.getUtoTmapping(u);
      curve.getPoint(t, p);
      curve.getTangent(t, tan);
      side.crossVectors(up, tan).normalize();
      const hw = roadHalfWidth(u);
      pos.push(p.x - side.x * hw, LIFT, p.z - side.z * hw, p.x + side.x * hw, LIFT, p.z + side.z * hw);
      const v = (u * total) / RUT_REPEAT_UNITS;
      uv.push(0, v, 1, v);
      if (i < SEGMENTS) {
        // Counter-clockwise seen from ABOVE (+Y): left, next-left, right …
        // The other order faced the normals at the dirt and the whole road was
        // back-face culled from every camera angle that matters (2026-10-06).
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [worldW, worldD, cellSize]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    map: texture, transparent: true, alphaTest: 0.02, depthWrite: false,
    roughness: 1, metalness: 0, side: THREE.DoubleSide,
    // The ground sits at +2; this must win the depth fight without lifting.
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }), [texture]);
  useEffect(() => () => material.dispose(), [material]);

  if (!ENABLED || !texture) return null;
  return <mesh geometry={geometry} material={material} raycast={() => {}} receiveShadow={false} castShadow={false} renderOrder={1} />;
}
