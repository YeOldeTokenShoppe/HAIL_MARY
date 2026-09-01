"use client";

// VigilRail — guest votive candles along the bottom edge of the viewport.
// Renders 3 (mobile) or 4 (desktop) camera-anchored clones of the SAME
// tinyVotiveOnly2.glb the visitor's own candle uses (stand included), each
// wearing another user's saint decal + wax tint, melted according to when
// their candle was lit. Guests cycle one at a time on a slow cadence: the
// wax rises with a settle-overshoot, the flame catches a beat later; on
// exit the flame gutters, the candle sinks, and a wisp of smoke marks the
// spot. The whole rail rides the same scroll depth as HeroAltarObject, so
// scrolling pulls every candle down with the visitor's — guests re-enter
// only after the viewport has rested at the top again.
//
// Mounts as a child of StarfieldStatueScene (inside its <Canvas>), beside
// HeroAltarObject. Gated behind ?mockrail=1 (mock pool) / ?mockrail=live
// (real subscribeLitCandles feed joined with shrineCandlePrefs) until the
// rail is approved for production.
//
// Timing constants below are the values approved in the "Vigil Rail" mock
// artifact (2026-09-01) — change them there first, then here.

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MOCK_POOL, useLivePool } from "@/lib/vigilRailPool";

const MODEL_PATH = "/models/tinyVotiveOnly2.glb";
// Draco decoder ships self-hosted (see PanelVotive.jsx for the full story).
useGLTF.setDecoderPath("/draco/");
useGLTF.preload(MODEL_PATH);

// Votive mesh/material hooks — copied from CANDLE_VARIANTS.votive in
// src/app/page.js so this component stays self-contained.
const VOTIVE = {
  meltMeshName: "XBASE",
  meltAxis: "y",
  meltSecondaryRate: 0.15,
  flameMeltShrinkRate: 0.6,
  wickMaterialName: "Mat15.001",
  imageMeshName: "senora",
  tintMeshName: "XBase",
  waxMaterialName: "Mat9.001",
};

// ---- choreography constants (approved in the Vigil Rail mock) --------------
const SWAP_CADENCE_MS = 12000; // one guest swapped per interval, never two
const ENTER_MS = 720; // rise with settle-overshoot
const ENTER_STAGGER_MS = 260; // between guests when the rack fills
const IGNITE_DELAY_MS = 1150; // flame catches a beat after the wax settles
const GUTTER_MS = 900; // flame collapse before the sink
const SINK_MS = 550; // drop below the viewport edge
const SMOKE_MS = 1900; // wisp lifetime after the flame dies
const REST_ARM_MS = 400; // viewport must rest at top this long before guests rise
const AWAY_SWAP_MS = 6000; // linger below the fold → one guest silently swapped
// Scroll depth past which parked guests reset to "below the edge" so the
// return to top gets the staggered re-rise instead of candles riding back up.
const PARK_DEPTH = 0.6;

// ---- layout ----------------------------------------------------------------
// Slot positions as WORLD offsets (camera-space x, same depth) from the
// visitor's candle — NOT screen fractions. The hero's screen position
// drifts with window aspect (fixed world translateX under a fov-50
// camera), so screen-fraction slots eventually land on top of it; world
// offsets relative to the hero make the aspect drop out entirely.
// Composition: three guests stepping in from the LEFT toward the statue,
// one flanking the visitor's right. The hero and the statue both anchor
// right-of-center, so the guest weight goes left to balance the frame —
// a right-leaning offset set left the whole rack listing starboard.
// SPACING FLOOR: everyone shares one camera depth and the candle is
// ~0.30 world units wide at this scale, so adjacent offsets (and the gap
// to the hero at 0) must differ by ≥ 0.34 or the meshes interpenetrate —
// fused glasses, doubled decals.
const HERO_X_DESKTOP = 0.15; // HeroAltarObject's translateX values
const HERO_X_MOBILE = -0.04;
const SLOT_OFFSETS_DESKTOP = [-1.02, -0.68, -0.34, 0.44];
// Portrait screens fit barely more than the hero at this depth/scale, so
// mobile keeps just two flanking guests.
const SLOT_OFFSETS_MOBILE = [-0.44, 0.44];
// How far each guest turns toward the camera. 1 = face it dead-on, which
// reads great on the decal but twists the stand visibly at outer slots
// (the "leaning candle" illusion); 0.5 keeps decals legible (~4% worst-case
// foreshortening at these slots) while the pedestals sit square with the rack.
const FACING_RATE = 0.5;
// Guests sit at the hero's exact depth and scale — Michelle wants the rack
// at the same apparent height as the visitor's candle, so melt state is the
// only height variation. (A depth/scale stagger was tried and rejected:
// it scattered the baseline and shrank the labels.) Per-slot z stays a
// knob in case a subtle stagger ever comes back.
const SLOT_Z = [-1.1, -1.1, -1.1, -1.1];
const GUEST_SCALE = 1.2; // matches the hero's render scale
// Hero-candle anchor, from HeroAltarObject's useFrame in page.js: group at
// camera-space y -1.0 / z -1.1, model scale 1.2, scroll drop 1.4·depth.
// Guests align their BASE (not their group origin) to the hero's base line:
// the GLB's local min-Y is measured once per clone and the projection is
// solved per slot, because the origin→base offset projects differently at
// each depth/scale — aligning origins alone leaves the bases scattered.
const HERO_Y = -1.0;
const HERO_Z = 1.1;
const HERO_SCALE = 1.2;
const HERO_SCROLL_DROP = 1.4;
const ENTER_DROP_RATIO = 1.36; // parked candles wait this far below (screen ratio)
const SMOKE_RISE_RATIO = 0.27; // wisp spawn height above the rail line (tune by eye)
// Model-space min-Y, cached from the first measured clone so SmokePuff can
// anchor to the same base line without owning a model.
let MODEL_MIN_Y = 0;

// ---- shared helpers (copied from PanelVotive.jsx / page.js) ----------------
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
    // Opaque, unlike the PanelVotive original: translucent wax in a crowd
    // lets the decal's back-side copy (and neighboring candles) bleed
    // through — the "merged meshes" artifact when votives stand close.
    transparent: false,
    depthWrite: true,
  });
  if (oldMat.name) mat.name = oldMat.name;
  mat.userData.isWaxUpgraded = true;
  return mat;
}

const norm = (s) => (s ? s.replace(/[._]/g, "").toLowerCase() : null);

// Same scroll depth the hero candle rides (page.js rootScrollDepth) —
// duplicated because page.js doesn't export it.
function railScrollDepth() {
  if (typeof window === "undefined") return 0;
  const vh = Math.max(window.innerHeight || 1, 1);
  return Math.min(Math.max(window.scrollY / (vh * 0.72), 0), 1);
}
const smoothstep01 = (v) => v * v * (3 - 2 * v);

// Easings matched to the mock's CSS curves.
function easeOutBack(t) {
  const c1 = 1.30; // ~8% overshoot, same feel as cubic-bezier(.3,1.42,.55,1)
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}
const easeInCubic = (t) => t * t * t;

// Soft radial sprite texture for the smoke wisp — built once, lazily, so
// SSR never touches document.
let smokeTexture = null;
function getSmokeTexture() {
  if (smokeTexture || typeof document === "undefined") return smokeTexture;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(215,215,225,0.55)");
  g.addColorStop(0.55, "rgba(200,200,212,0.22)");
  g.addColorStop(1, "rgba(200,200,212,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  smokeTexture = new THREE.CanvasTexture(cv);
  return smokeTexture;
}

// Camera-anchor a group the same way HeroAltarObject does: copy the camera
// transform, then translate in its local frame so the object holds a fixed
// screen position while the crane shot orbits.
function anchorToCamera(group, camera, xOffset, yOffset, z) {
  group.position.copy(camera.position);
  group.quaternion.copy(camera.quaternion);
  group.translateX(xOffset);
  group.translateY(yOffset);
  group.translateZ(z);
}

// ---- one guest votive ------------------------------------------------------
// Owns its clone of the GLB (stand included), its materials, its melt pose,
// and its enter/settle/gutter/sink timeline. The parent orchestrates via
// `leaving` + `wave` (re-rise trigger) and the shared scroll-depth ref.
function GuestVotive({
  entry,
  xOffset, // world offset from screen center: heroX + slot offset
  z,
  enterDelay,
  wave,
  leaving,
  parkedRef,
  depthRef,
  reduced,
  onGone,
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef();
  const flameNodeRef = useRef(null);
  const flameBaseRef = useRef({ sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0 });
  // phase: pre → entering → settled → guttering → sinking → gone
  const phaseRef = useRef({ name: "pre", t0: 0, litAtMs: 0 });
  const goneRef = useRef(false);
  // Decal textures loaded for this guest — disposed on unmount so a long
  // session of 12s swaps doesn't accumulate GPU textures.
  const loadedTexturesRef = useRef([]);
  useEffect(() => () => {
    loadedTexturesRef.current.forEach((t) => t.dispose());
    loadedTexturesRef.current = [];
  }, []);
  // Whisper of per-guest yaw so the rack doesn't read as clones on a
  // conveyor — small enough that no decal reads as turned away.
  const yaw = useMemo(() => flameHash1D(entry.id.length * 97 + xOffset * 1000) * 0.05, [entry.id, xOffset]);

  // Clone the cached GLTF scene + materials (never mutate the shared cache —
  // HeroAltarObject renders the same cache directly). Stand stays: guests
  // use the same stand object and candle as the visitor's votive.
  const votive = useMemo(() => {
    const clone = scene.clone(true);
    // HeroAltarObject customizes the SHARED useGLTF cache in place: it swaps
    // the visitor's decal texture into `map` and their tint into `color`,
    // stashing the authored originals in userData (bakedMap/authoredColor).
    // A naive material clone therefore inherits the VISITOR's decal + tint —
    // which is exactly how three guests once showed up wearing the user's
    // I-80 label. Restore the authored state from the SOURCE material's
    // stash (real Texture/Color objects there — Material.clone() JSON-mangles
    // them into dead plain objects), then scrub the mangled cache keys so
    // this clone's own decal/tint effects re-derive their baselines cleanly.
    const cloneMat = (src) => {
      const m = src.clone();
      const stash = src.userData ?? {};
      if ("bakedMap" in stash) m.map = stash.bakedMap;
      if ("bakedEmissiveMap" in stash) m.emissiveMap = stash.bakedEmissiveMap;
      if (stash.authoredColor?.isColor && m.color) m.color.copy(stash.authoredColor);
      if (stash.authoredEmissive?.isColor && m.emissive) m.emissive.copy(stash.authoredEmissive);
      delete m.userData.bakedMap;
      delete m.userData.bakedEmissiveMap;
      delete m.userData.authoredColor;
      delete m.userData.authoredEmissive;
      return m;
    };
    clone.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = Array.isArray(obj.material)
          ? obj.material.map(cloneMat)
          : cloneMat(obj.material);
      }
    });
    return clone;
  }, [scene]);

  // The GLB's base (stand bottom) in model space — needed to put every
  // guest's base on the hero's base line regardless of slot depth/scale.
  const baseMinY = useMemo(() => {
    votive.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(votive);
    MODEL_MIN_Y = box.min.y;
    return box.min.y;
  }, [votive]);

  // Material setup — lit wax, warm wick, additive self-lit flame, decal
  // alphaTest. Same pass as PanelVotive, minus its Canvas-specific bits.
  useEffect(() => {
    const wickTarget = norm(VOTIVE.wickMaterialName);
    const isWickMat = (m) => wickTarget && m?.name && norm(m.name) === wickTarget;
    const imageMeshName = VOTIVE.imageMeshName.toLowerCase();

    votive.traverse((obj) => {
      // Only the glass goes transparent (skipping depthWrite so its
      // contents render through). PanelVotive forces EVERY material
      // transparent for its side-panel compositing — in the main scene
      // that breaks depth resolution between neighboring votives, so
      // everything else stays opaque here.
      if (obj.isMesh && obj.material && obj.name?.toLowerCase() === "glass") {
        obj.renderOrder = 210;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          m.transparent = true;
          m.depthWrite = false;
        });
      }

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
        obj.traverse((d) => {
          const mats = Array.isArray(d.material) ? d.material : d.material ? [d.material] : [];
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

      if (obj.name && !flameNodeRef.current) {
        const u = obj.name.toUpperCase();
        if (u.startsWith("FLAME") && !u.includes("WICK")) {
          flameNodeRef.current = obj;
          obj.visible = false; // ignition happens on the choreography clock
          obj.traverse((d) => {
            if (!d.isMesh || !d.material) return;
            const mats = Array.isArray(d.material) ? d.material : [d.material];
            mats.forEach((m) => {
              if (!m) return;
              m.blending = THREE.AdditiveBlending;
              m.depthWrite = false;
              m.transparent = true;
              if (m.emissive) {
                m.emissive.setRGB(1.0, 0.82, 0.5);
                if (m.map && !m.emissiveMap) m.emissiveMap = m.map;
                if ("emissiveIntensity" in m) m.emissiveIntensity = 3.4;
              }
              m.toneMapped = false;
              m.needsUpdate = true;
            });
            d.renderOrder = 240;
          });
        }
      }

      // The GLB's authored flame pointLight stays OFF for guests — three or
      // four extra dynamic lights is real mobile cost, and the additive
      // emissive flame reads fine without cast light (verified in the mock).
      if (obj.isLight) obj.visible = false;

      if (obj.name?.toLowerCase() === imageMeshName) {
        obj.traverse((d) => {
          if (!d.isMesh || !d.material) return;
          const mats = Array.isArray(d.material) ? d.material : [d.material];
          mats.forEach((m) => {
            if (!m) return;
            m.alphaTest = 0.5;
            // Front faces only — the decal renders both sides, and on a
            // yawed guest the back-side copy peeks out as a doubled image.
            m.side = THREE.FrontSide;
            m.needsUpdate = true;
          });
        });
      }
    });
  }, [votive]);

  // Decal + tint — same replace-not-multiply semantics as PanelVotive.
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
          if (entry.votiveImage) {
            new THREE.TextureLoader().load(
              entry.votiveImage,
              (tex) => {
                tex.flipY = false;
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.anisotropy = 16;
                if (m.map && m.map !== m.userData.bakedMap) m.map.dispose();
                m.map = tex;
                if (m.userData.bakedEmissiveMap) m.emissiveMap = tex;
                m.needsUpdate = true;
                loadedTexturesRef.current.push(tex);
              },
              undefined,
              restore, // load failure → fall back to the baked decal
            );
          } else {
            restore();
          }
        });
      }

      if (name === tintMeshName) {
        applyToMats(obj, (m) => {
          if (!m.color || !isWaxMat(m)) return;
          if (!m.userData.authoredColor) m.userData.authoredColor = m.color.clone();
          if (m.emissive && !m.userData.authoredEmissive) {
            m.userData.authoredEmissive = m.emissive.clone();
          }
          if (entry.votiveTint) {
            const tint = new THREE.Color(entry.votiveTint);
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
  }, [votive, entry.votiveImage, entry.votiveTint]);

  // Melt pose — static per guest (their burn is history, not a live timer).
  // Same math as HeroAltarObject's per-frame melt, applied once: vertical
  // shrink with a 10% stub floor, radial squeeze at meltSecondaryRate, and
  // a partial counter-scale on the flame so it lowers instead of collapsing.
  useEffect(() => {
    // Case-insensitive lookup — the node is authored "XBase", the variant
    // config says "XBASE", and getObjectByName is case-sensitive.
    let meltMesh = null;
    votive.traverse((o) => {
      if (!meltMesh && o.name && o.name.toUpperCase() === VOTIVE.meltMeshName.toUpperCase()) {
        meltMesh = o;
      }
    });
    const p = Math.min(Math.max(entry.meltProgress ?? 0, 0), 1);
    if (meltMesh) {
      const base = meltMesh.scale.clone();
      const shrink = Math.max(0.1, 1 - p);
      const side = Math.max(0.1, 1 - p * VOTIVE.meltSecondaryRate);
      meltMesh.scale.set(base.x * side, base.y * side, base.z * side);
      meltMesh.scale[VOTIVE.meltAxis] = base[VOTIVE.meltAxis] * shrink;
    }
    const fn = flameNodeRef.current;
    if (fn) {
      const shrink = Math.max(0.1, 1 - p);
      const side = Math.max(0.1, 1 - p * VOTIVE.meltSecondaryRate);
      // Parent wax scaled the flame down with it; counter-scale so the flame
      // follows only flameMeltShrinkRate of the vertical shrink and none of
      // the radial squeeze.
      const compV = Math.pow(shrink, VOTIVE.flameMeltShrinkRate) / shrink;
      const compR = 1 / side;
      flameBaseRef.current = {
        sx: fn.scale.x * compR,
        sy: fn.scale.y * (VOTIVE.meltAxis === "y" ? compV : compR),
        sz: fn.scale.z * compR,
        rx: fn.rotation.x,
        ry: fn.rotation.y,
        rz: fn.rotation.z,
      };
      fn.scale.set(flameBaseRef.current.sx, flameBaseRef.current.sy, flameBaseRef.current.sz);
    }
  }, [votive, entry.meltProgress]);

  // (Re)start the entrance whenever a new wave fires (initial fill, or the
  // re-rise after the viewport comes back to rest at the top).
  useEffect(() => {
    phaseRef.current = { name: "pre", t0: performance.now() + enterDelay, litAtMs: 0 };
    if (flameNodeRef.current) {
      flameNodeRef.current.visible = false;
      flameNodeRef.current.traverse((d) => { d.visible = false; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave, enterDelay]);

  // Parent asked this guest to leave — gutter, then sink, then report gone.
  useEffect(() => {
    if (!leaving) return;
    const ph = phaseRef.current;
    if (ph.name === "guttering" || ph.name === "sinking") return;
    phaseRef.current = {
      name: entry.burning && ph.name === "settled" && !reduced ? "guttering" : "sinking",
      t0: performance.now(),
      litAtMs: ph.litAtMs,
    };
  }, [leaving, entry.burning, reduced]);

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;
    const now = performance.now();
    const ph = phaseRef.current;
    const depth = depthRef.current;
    const fn = flameNodeRef.current;

    // While parked past the fold, hold below the edge so the return to top
    // re-runs the staggered rise (the parent bumps `wave` when it re-arms).
    if (parkedRef.current && (ph.name === "entering" || ph.name === "settled")) {
      phaseRef.current = { name: "pre", t0: Infinity, litAtMs: 0 };
      if (fn) { fn.visible = false; fn.traverse((d) => { d.visible = false; }); }
    }

    let yOffset = -ENTER_DROP_RATIO;
    switch (ph.name) {
      case "pre": {
        if (now >= ph.t0) {
          phaseRef.current = { name: "entering", t0: now, litAtMs: now + IGNITE_DELAY_MS };
        }
        break;
      }
      case "entering": {
        const t = Math.min((now - ph.t0) / ENTER_MS, 1);
        yOffset = reduced ? 0 : -ENTER_DROP_RATIO * (1 - easeOutBack(t));
        if (t >= 1) phaseRef.current = { ...ph, name: "settled" };
        break;
      }
      case "settled": {
        yOffset = 0;
        // Ignition — flame appears with a catch-and-settle surge.
        if (entry.burning && fn && !fn.visible && now >= ph.litAtMs) {
          fn.visible = true;
          fn.traverse((d) => { d.visible = true; });
        }
        break;
      }
      case "guttering": {
        yOffset = 0;
        const t = Math.min((now - ph.t0) / GUTTER_MS, 1);
        if (fn && fn.visible) {
          // Violent flicker shrinking to nothing — the mock's gutter curve.
          const b = flameBaseRef.current;
          const die = 1 - t;
          const panic = 1 + flameFbm1D(now / 1000 * 14) * 0.45 * t;
          fn.scale.set(b.sx * die * panic, b.sy * (die * die) * panic, b.sz * die * panic);
          if (t >= 1) { fn.visible = false; fn.traverse((d) => { d.visible = false; }); }
        }
        if (t >= 1) phaseRef.current = { name: "sinking", t0: now, litAtMs: 0 };
        break;
      }
      case "sinking": {
        const t = Math.min((now - ph.t0) / SINK_MS, 1);
        yOffset = reduced ? -ENTER_DROP_RATIO : -ENTER_DROP_RATIO * easeInCubic(t);
        if (t >= 1 && !goneRef.current) {
          goneRef.current = true;
          onGone?.(entry);
        }
        break;
      }
      default:
        break;
    }

    // Flame flicker + ignition catch (same noise streams as the hero flame).
    if (fn && fn.visible && ph.name === "settled") {
      const b = flameBaseRef.current;
      const ft = now / 1000;
      let catchScale = 1;
      let catchBoost = 0;
      const sinceIgnite = now - ph.litAtMs;
      if (sinceIgnite < 280) {
        const decay = 1 - sinceIgnite / 280;
        catchScale = 1 + decay * decay * 0.5;
        catchBoost = decay * 0.18;
      }
      const flicker = 1 + flameFbm1D(ft * 3.5 + xOffset * 40) * (0.09 + catchBoost);
      const stretch = 1 + flameFbm1D(ft * 3.0 + 100 + xOffset * 40) * (0.06 + catchBoost * 0.5);
      fn.scale.set(
        b.sx * flicker * catchScale,
        b.sy * flicker * stretch * catchScale,
        b.sz * flicker * catchScale,
      );
      fn.rotation.x = b.rx + flameFbm1D(ft * 1.9 + 200 + xOffset * 40) * 0.03;
      fn.rotation.z = b.rz + flameFbm1D(ft * 2.2 + 300 + xOffset * 40) * 0.045;
    }

    // Solve the anchor so this guest's BASE projects onto the hero's base
    // line at this scroll depth: hero base ratio = (heroY + heroScale·minY
    // − scrollDrop)/heroZ, then back out our own scale·minY at our depth.
    // Enter/sink travel stays in ratio space so the rise covers the same
    // screen distance at every slot depth.
    const dz = Math.abs(z);
    const heroBaseRatio =
      (HERO_Y + HERO_SCALE * baseMinY - depth * HERO_SCROLL_DROP) / HERO_Z;
    anchorToCamera(
      group,
      camera,
      xOffset,
      heroBaseRatio * dz - GUEST_SCALE * baseMinY + yOffset * dz,
      z,
    );
    // Turn each guest toward the camera — at FACING_RATE, not fully, so the
    // decal reads straight-on without the stand twisting into a lean.
    group.rotateY(Math.atan2(-xOffset, dz) * FACING_RATE + yaw);
  });

  return (
    <group ref={groupRef}>
      <primitive object={votive} scale={GUEST_SCALE} />
    </group>
  );
}

// ---- smoke wisp ------------------------------------------------------------
// One-shot puff where a guttered flame stood. Three soft sprites rising,
// swaying, and fading over SMOKE_MS; the parent unmounts it afterwards.
function SmokePuff({ xOffset, z, bornAt, depthRef }) {
  const groupRef = useRef();
  const sprites = useMemo(
    () =>
      [0, 1, 2].map((i) => ({
        seed: i * 37.7 + xOffset * 100,
        x0: (flameHash1D(i * 13 + 1) * 0.5) * 0.04,
        drift: 0.05 + flameHash1D(i * 29 + 7) * 0.02,
        scale0: 0.055 + i * 0.02,
      })),
    [xOffset],
  );
  const tex = getSmokeTexture();

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group || !tex) return;
    const t = Math.min((performance.now() - bornAt) / SMOKE_MS, 1);
    // Opacity bell: quick to appear, long fade.
    const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    group.children.forEach((sprite, i) => {
      const s = sprites[i];
      sprite.position.set(
        s.x0 + Math.sin(t * 5 + s.seed) * 0.012 + s.drift * t * 0.4,
        t * 0.22 + i * 0.015,
        0,
      );
      const grow = s.scale0 * (1 + t * 1.6);
      sprite.scale.set(grow, grow * (1 + t * 0.5), 1);
      if (sprite.material) sprite.material.opacity = 0.5 * fade * (1 - i * 0.2);
    });
    const dz = Math.abs(z);
    const heroBaseRatio =
      (HERO_Y + HERO_SCALE * MODEL_MIN_Y - depthRef.current * HERO_SCROLL_DROP) / HERO_Z;
    anchorToCamera(
      group,
      camera,
      xOffset,
      heroBaseRatio * dz - GUEST_SCALE * MODEL_MIN_Y + SMOKE_RISE_RATIO * dz,
      z,
    );
  });

  if (!tex) return null;
  return (
    <group ref={groupRef}>
      {sprites.map((s, i) => (
        <sprite key={i} renderOrder={245}>
          <spriteMaterial
            map={tex}
            transparent
            depthWrite={false}
            depthTest={false}
            opacity={0}
          />
        </sprite>
      ))}
    </group>
  );
}

// ---- the rail --------------------------------------------------------------
export default function VigilRail({
  mock = true,
  candles = null,
  excludeUserId = null,
  isMobile = false,
}) {
  const livePool = useLivePool(mock ? null : candles, excludeUserId);
  const pool = mock ? MOCK_POOL : livePool;
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const slotOffsets = isMobile ? SLOT_OFFSETS_MOBILE : SLOT_OFFSETS_DESKTOP;
  const heroX = isMobile ? HERO_X_MOBILE : HERO_X_DESKTOP;
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    [],
  );

  // Rendered guests: [{ slotIdx, entry, key, enterDelay, leaving }]
  const [guests, setGuests] = useState([]);
  const [smokes, setSmokes] = useState([]);
  const [wave, setWave] = useState(1);
  const guestsRef = useRef(guests);
  guestsRef.current = guests;
  const keySeq = useRef(0);

  // Scroll gate — shared depth ref for every child, armed/parked flags.
  const depthRef = useRef(0);
  const parkedRef = useRef(false);
  const armedRef = useRef(false);
  const armTimerRef = useRef(null);
  const leftTopAtRef = useRef(0);

  // Deterministic home slot per keeper, same hash as the mock.
  const homeSlot = (id) => {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % slotOffsets.length;
  };

  const pickNext = () => {
    const staged = new Set(guestsRef.current.map((g) => g.entry.id));
    const offstage = poolRef.current.filter((p) => !staged.has(p.id));
    if (!offstage.length) return null;
    // Fresh burning candles appear most; melted stubs make rare cameos.
    const weights = offstage.map((p) =>
      p.burning ? 1 / Math.sqrt((p.ageDays ?? p.meltProgress * 140) + 0.5) : 0.07,
    );
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < offstage.length; i++) {
      r -= weights[i];
      if (r <= 0) return offstage[i];
    }
    return offstage[offstage.length - 1];
  };

  const fillStage = (staggerFrom = 0) => {
    setGuests((prev) => {
      const next = [...prev];
      let delay = staggerFrom;
      let guard = slotOffsets.length * 3;
      while (guard--) {
        const used = new Set(next.map((g) => g.slotIdx));
        const empties = [];
        for (let i = 0; i < slotOffsets.length; i++) if (!used.has(i)) empties.push(i);
        if (!empties.length) break;
        const staged = new Set(next.map((g) => g.entry.id));
        const offstage = poolRef.current.filter((p) => !staged.has(p.id));
        if (!offstage.length) break;
        // Same freshness weighting as swaps: burning candles headline,
        // melted stubs make cameos.
        const weights = offstage.map((p) =>
          p.burning ? 1 / Math.sqrt((p.ageDays ?? p.meltProgress * 140) + 0.5) : 0.07,
        );
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        let entry = offstage[offstage.length - 1];
        for (let i = 0; i < offstage.length; i++) {
          r -= weights[i];
          if (r <= 0) { entry = offstage[i]; break; }
        }
        const home = homeSlot(entry.id);
        const slotIdx = empties.includes(home) ? home : empties[0];
        next.push({
          slotIdx,
          entry,
          key: `g${keySeq.current++}`,
          enterDelay: delay,
          leaving: false,
        });
        delay += reduced ? 80 : ENTER_STAGGER_MS;
      }
      return next;
    });
  };

  const swapOne = () => {
    const settled = guestsRef.current.filter((g) => !g.leaving);
    if (!armedRef.current || !settled.length) return;
    const victim = settled[Math.floor(Math.random() * settled.length)];
    setGuests((prev) =>
      prev.map((g) => (g.key === victim.key ? { ...g, leaving: true } : g)),
    );
    if (victim.entry.burning && !reduced) {
      // Smoke where the flame stood, timed to the end of the gutter.
      const xOffset = heroX + slotOffsets[victim.slotIdx];
      const z = SLOT_Z[victim.slotIdx % SLOT_Z.length];
      setTimeout(() => {
        const key = `s${keySeq.current++}`;
        setSmokes((prev) => [...prev, { key, xOffset, z, bornAt: performance.now() }]);
        setTimeout(
          () => setSmokes((prev) => prev.filter((s) => s.key !== key)),
          SMOKE_MS + 200,
        );
      }, GUTTER_MS);
    }
  };

  const handleGone = (goneGuest) => {
    setGuests((prev) => prev.filter((g) => g.key !== goneGuest.key));
    // Replacement rises after a beat, at its own home slot if free.
    setTimeout(() => {
      if (!armedRef.current) return;
      const entry = pickNext();
      if (!entry) return;
      setGuests((prev) => {
        if (prev.some((g) => g.entry.id === entry.id)) return prev;
        const used = new Set(prev.map((g) => g.slotIdx));
        const home = homeSlot(entry.id);
        let slotIdx = !used.has(home) ? home : -1;
        if (slotIdx === -1) {
          for (let i = 0; i < slotOffsets.length; i++) if (!used.has(i)) { slotIdx = i; break; }
        }
        if (slotIdx === -1) return prev;
        return [
          ...prev,
          { slotIdx, entry, key: `g${keySeq.current++}`, enterDelay: 0, leaving: false },
        ];
      });
    }, 260);
  };

  // Scroll gate. The depth math matches HeroAltarObject so the rail and the
  // visitor's candle move as one body; guests additionally park below the
  // edge once the rail is fully offscreen, and re-rise (staggered, possibly
  // changed) only after REST_ARM_MS of stillness at the top.
  useFrame((_, delta) => {
    const target = smoothstep01(railScrollDepth());
    const smoothing = 1 - Math.exp(-delta * 8);
    depthRef.current += (target - depthRef.current) * smoothing;

    const raw = railScrollDepth();
    if (raw > 0.03) {
      if (armedRef.current || !leftTopAtRef.current) leftTopAtRef.current = performance.now();
      armedRef.current = false;
      if (armTimerRef.current) {
        clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
      }
      if (raw > PARK_DEPTH) parkedRef.current = true;
    } else if (!armedRef.current && !armTimerRef.current) {
      armTimerRef.current = setTimeout(() => {
        armTimerRef.current = null;
        armedRef.current = true;
        const away = performance.now() - leftTopAtRef.current;
        if (parkedRef.current) {
          parkedRef.current = false;
          // The shrine changed while they were away: swap one guest silently.
          if (away > AWAY_SWAP_MS && guestsRef.current.length) {
            const gone = guestsRef.current[
              Math.floor(Math.random() * guestsRef.current.length)
            ];
            const entry = pickNext();
            setGuests((prev) => {
              const without = prev.filter((g) => g.key !== gone.key);
              if (!entry || without.some((g) => g.entry.id === entry.id)) return without;
              return [
                ...without,
                {
                  slotIdx: gone.slotIdx,
                  entry,
                  key: `g${keySeq.current++}`,
                  enterDelay: 0,
                  leaving: false,
                },
              ];
            });
          }
          setWave((w) => w + 1); // staggered re-rise for everyone parked
        }
        fillStage();
      }, REST_ARM_MS);
    }
  });

  // Initial fill once the pool has anything to show, if resting at top.
  useEffect(() => {
    if (!pool.length || guestsRef.current.length) return;
    if (railScrollDepth() > 0.03) return;
    const t = setTimeout(() => {
      armedRef.current = true;
      fillStage();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length]);

  // Rotation cadence — one swap per tick, only while armed and visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (armedRef.current && !document.hidden) swapOne();
    }, SWAP_CADENCE_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotOffsets.length, reduced]);

  useEffect(() => () => {
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
  }, []);

  return (
    <Suspense fallback={null}>
      {guests.map((g) => (
        <GuestVotive
          key={g.key}
          entry={g.entry}
          xOffset={heroX + slotOffsets[g.slotIdx]}
          z={SLOT_Z[g.slotIdx % SLOT_Z.length]}
          enterDelay={g.enterDelay}
          wave={wave}
          leaving={g.leaving}
          parkedRef={parkedRef}
          depthRef={depthRef}
          reduced={reduced}
          onGone={() => handleGone(g)}
        />
      ))}
      {smokes.map((s) => (
        <SmokePuff key={s.key} xOffset={s.xOffset} z={s.z} bornAt={s.bornAt} depthRef={depthRef} />
      ))}
    </Suspense>
  );
}
