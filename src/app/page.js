"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useGLTF, Stats } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUser, useClerk } from "@clerk/nextjs";
import ChartShrine, { TIMEFRAME_OPTIONS } from "@/components/ChartShrine";
import MobileBottomNav from "@/components/MobileBottomNav";
import BuyModal from "@/components/BuyModal";
import TestimonialToasts from "@/components/TestimonialToasts";
import InscribeModal from "@/components/InscribeModal";
import { useCandles } from "@/hooks/useCandles";
import {
  readCandle,
  lightCandle,
  extinguishCandle,
} from "@/lib/candleRitual";
import {
  readLocalCandle,
  writeLocalCandle,
  clearLocalCandle,
} from "@/lib/localCandle";
import "./chart-shrine/chart-shrine.css";

// Preload only the anon-default pillar candle. The votive GLB is
// lazy-loaded on first mount of a signed-in user's HeroAltarObject so
// anonymous visitors don't pay the download for an asset they won't see.
useGLTF.preload("/models/JustCandle.glb");

// Per-user candle variant preference persists across reloads but is
// scoped to the device — kept in localStorage rather than Firestore to
// avoid touching the ritual schema for a cosmetic choice. Keyed by
// userId so each signed-in user on a shared device gets their own pick.
const CANDLE_VARIANT_STORAGE_PREFIX = "rl80:candleVariant:";
function readCandleVariant(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CANDLE_VARIANT_STORAGE_PREFIX + userId);
  } catch {
    return null;
  }
}
function writeCandleVariant(userId, variant) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CANDLE_VARIANT_STORAGE_PREFIX + userId,
      variant,
    );
  } catch {}
}

// One-shot "sign in to save your flame" nudge. Shown on the first anon
// light only; relights skip it so the nudge doesn't become noise. Keyed
// globally rather than per-user because anon visitors have no userId.
const SIGN_IN_NUDGE_SHOWN_KEY = "rl80:signInNudgeShown";
function readSignInNudgeShown() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIGN_IN_NUDGE_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}
function markSignInNudgeShown() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIGN_IN_NUDGE_SHOWN_KEY, "1");
  } catch {}
}

// Candle variant registry. Each entry fully describes a model's melt
// behavior so HeroAltarObject stays variant-agnostic — adding a new
// saint or color means appending a config entry, not forking logic.
// - meltMeshName: name (case-insensitive) of the mesh that shrinks
// - meltAxis: which local scale axis shortens as the candle burns
// - dripMeshName: optional secondary mesh that oozes out; null to skip
// - scale: render-scale on the outer <primitive>
const CANDLE_VARIANTS = {
  pillar: {
    modelPath: "/models/JustCandle.glb",
    meltMeshName: "WAX",
    meltAxis: "z",
    dripMeshName: "DRIPWAX",
    scale: 1.2,
  },
  votive: {
    modelPath: "/models/tinyVotiveOnly.glb",
    meltMeshName: "XBASE",
    meltAxis: "z",
    dripMeshName: null,
    scale: 1.2,
    // Wick material — lives on XBase as a second material slot. Given
    // a small emissive boost so it stays visible when the candle is
    // unlit (no flame light = dark material vanishes against the black
    // page background). Matched case-insensitively with dots/underscores
    // stripped so "Mat15.001", "Mat15_001", and "Mat15001" all hit.
    wickMaterialName: "Mat15.001",
  },
};

const StarfieldStatueScene = dynamic(
  () => import("@/components/StarfieldStatueScene"),
  { ssr: false }
);

// Melt windows — anonymous visitors get a 1-minute preview to sample the
// ritual; signed-in faithful get 8 hours so the flame lasts across a
// session or work day. The duration is selected at render time based on
// auth state and threaded through the melt timer + countdown UI.
const MELT_DURATION_ANON_MS = 60 * 1000;
const MELT_DURATION_SIGNED_IN_MS = 8 * 60 * 60 * 1000;

// Reconstitution sequence — after a candle fully burns out, hold the
// empty pedestal briefly, then swirl particles inward and re-form the
// wax. Without this the wax mesh snap-resets to baseline the instant
// `candleLit` flips false, which reads as a jarring pop.
const RECONSTITUTE_EMPTY_BEAT_MS = 1000;
const RECONSTITUTE_REFORM_MS = 1900;
const RECONSTITUTE_PARTICLE_COUNT = 160;

// Compact remaining-time label for the CANDLE FAB countdown. HH:MM:SS
// always so the ticking seconds confirm the clock is live.
function formatRemaining(litAtMs, meltDuration) {
  const remaining = Math.max(0, meltDuration - (Date.now() - litAtMs));
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hours}:${mm}:${ss}`;
}

// Hash-based 1D value noise for flame flicker. Sines give rhythmically
// repeating motion that reads as "dancing"; interpolated random samples
// give genuine aperiodic variation. Offset the input per channel (scale /
// stretch / rotX / rotZ) so the four streams don't correlate.
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
  const sf = f * f * (3 - 2 * f); // smoothstep between integer samples
  return flameHash1D(i) * (1 - sf) + flameHash1D(i + 1) * sf;
}
// Two-octave fBm — base variation plus fast jitter, feels like a real flame.
function flameFbm1D(t) {
  return flameNoise1D(t) * 0.65 + flameNoise1D(t * 2.3 + 17.1) * 0.35;
}

// useGLTF caches the scene across mounts, so we cache the ORIGINAL
// export-time scale the first time we see each Wax mesh. Otherwise a
// subsequent mount would read back our previously-melted scale and treat
// it as baseline, leaving the candle stuck in a burned state.
const MELT_BASELINE_CACHE = new WeakMap();
const DRIP_BASELINE_CACHE = new WeakMap();
const FLAME_LIGHT_BASELINE_CACHE = new WeakMap();

// Personalized altar overlay — camera-anchored so it stays in a fixed screen
// position while the crane shot orbits. Single Canvas, no extra WebGL context.
// Base intensity of the warm candle fill light — flicker and ignition
// pulse are computed relative to this.
const WARM_BASE_INTENSITY = 0.2;

function HeroAltarObject({
  candleLit = false,
  litAt = null,
  meltDuration,
  variant = "pillar",
  onBurnedOut,
  debugRef,
}) {
  const variantConfig = CANDLE_VARIANTS[variant] ?? CANDLE_VARIANTS.pillar;
  const { scene } = useGLTF(variantConfig.modelPath);
  const groupRef = useRef();
  const isMobileRef = useRef(false);
  // The melt mesh (WAX on the pillar, XBASE on the votive) + its
  // baseline scale vector — flame/wick are parented to it, so shrinking
  // one axis shrinks the whole candle column together.
  const meltMeshRef = useRef(null);
  const baseMeltScaleRef = useRef({ x: 1, y: 1, z: 1 });
  // Drip wax: hidden at lit-start, grows down (local Z, same axis as wax
  // melt) and fades in as the candle burns toward fully-melted.
  const dripWaxRef = useRef(null);
  const baseDripScaleRef = useRef({ x: 1, y: 1, z: 1 });
  // Flame-parented pointLight authored inside the GLB. Dimmed over the
  // melt window so the cast light fades with the shrinking candle.
  const flameLightRef = useRef(null);
  const baseFlameLightIntensityRef = useRef(1);
  // Flame mesh node — captured so we can animate it (flicker/sway) while
  // the candle is lit. Baseline scale + rotation are cached so flicker
  // composes on top of the authored GLB transform rather than replacing it.
  const flameNodeRef = useRef(null);
  const flameBaseScaleRef = useRef({ x: 1, y: 1, z: 1 });
  const flameBaseRotationRef = useRef({ x: 0, y: 0, z: 0 });
  // Amber radial glow sprite — additive, billboarded, breathes with the
  // flame's noise-driven flicker. Makes the flame feel volumetric rather
  // than a flat authored mesh.
  const flameGlowOuterRef = useRef(null);
  // Scratch vector for flame→group-local position conversion in useFrame.
  const flameGlowTmpVec = useMemo(() => new THREE.Vector3(), []);
  // Guard so we only fire onBurnedOut once per lit cycle.
  const burnedOutFiredRef = useRef(false);
  // Throttle the debug readout updates.
  const lastDebugUpdateRef = useRef(0);
  // Ignition VFX: flicker/pulse on the warm light, expanding halo sphere.
  const warmLightRef = useRef(null);
  const haloRef = useRef(null);
  const glowRef = useRef(null);
  const ignitionTimeRef = useRef(null);
  const prevLitRef = useRef(candleLit);
  // Reconstitution VFX: phase timeline + particle swirl that coalesces
  // back into a fresh candle after burnout. Kept in refs so animation
  // reads every frame without triggering re-renders.
  const reconstPhaseRef = useRef("idle"); // 'idle' | 'empty' | 'reforming'
  const reconstStartRef = useRef(0);
  const reconstParticlesRef = useRef(null);
  const reconstParticleDataRef = useRef([]);
  const reconstWarnedRef = useRef(false);
  // Wick landing target in group-local coords — recomputed on each spawn
  // from the current melt mesh's world position. Shared between spawn
  // (for start positions) and update (for landing interpolation).
  const reconstWickCenterRef = useRef(new THREE.Vector3(0, 0.15, 0));
  // Memoize the particle buffers so they persist across re-renders.
  // Passing `array={new Float32Array(...)}` inline would allocate a fresh
  // zero-filled array on every render, which R3F would push to the GPU and
  // wipe any in-flight animation writes. We use only standard attribute
  // names (`position`, `color`) so Three.js's pointsMaterial binds them
  // automatically — custom attributes weren't linking in this canvas.
  const reconstBuffers = useMemo(() => ({
    position: new Float32Array(RECONSTITUTE_PARTICLE_COUNT * 3),
    color: new Float32Array(RECONSTITUTE_PARTICLE_COUNT * 3),
  }), []);

  // Soft radial-gradient texture used as the `map` on pointsMaterial.
  // Opaque black-to-white — with additive blending the black edges add
  // zero to the framebuffer, yielding a soft circular sparkle without
  // relying on the canvas's alpha channel (which was breaking rendering
  // in this particular canvas/postprocessing pipeline).
  const reconstParticleTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgb(255,255,255)");
    grad.addColorStop(0.5, "rgb(80,80,80)");
    grad.addColorStop(1, "rgb(0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Reconstitution particle helpers. Particles spawn on a sphere around
  // the wick and migrate inward with a light orbital swirl, fading + shrinking
  // as they land. Kept as plain functions so refs stay stable and avoid
  // re-allocating Float32Arrays every frame.
  const spawnReconstituteParticles = () => {
    const data = [];
    // Query the wax mesh's actual position (in group-local space) rather
    // than hardcoding a wick offset — the scene's internal transforms
    // + scale=1.2 put the visible candle higher than the group origin.
    const wickCenter = new THREE.Vector3(0, 0.15, 0);
    if (meltMeshRef.current && groupRef.current) {
      const worldPos = new THREE.Vector3();
      meltMeshRef.current.getWorldPosition(worldPos);
      groupRef.current.worldToLocal(worldPos);
      wickCenter.copy(worldPos);
      wickCenter.y += 0.2; // nudge up from mesh base toward the candle body
    }
    reconstWickCenterRef.current.copy(wickCenter);
    for (let i = 0; i < RECONSTITUTE_PARTICLE_COUNT; i++) {
      // Reverse-emission pattern: each particle starts on a small shell
      // around the wick and accelerates inward (cubic ease-in) like it's
      // being sucked into a black hole. Continuous respawn via modulo on
      // `life` keeps the stream dense throughout the reform window.
      // Two color families mirror the reference image (warm gold + cool
      // violet) for harmonic contrast as they accumulate at the core.
      const colorRoll = Math.random();
      let baseR, baseG, baseB;
      if (colorRoll < 0.55) {
        // Warm gold — HDR values (>1.0) for bloom pickup.
        baseR = 2.4; baseG = 1.9; baseB = 0.8;
      } else {
        // Cool violet — HDR values (>1.0) for bloom pickup.
        baseR = 1.5; baseG = 1.1; baseB = 2.6;
      }
      // Uniformly distributed direction on a sphere (rejection-free form).
      const u = Math.random() * 2 - 1;   // cos(phi) ∈ [-1, 1]
      const ang = Math.random() * Math.PI * 2;
      const sxyLen = Math.sqrt(1 - u * u);
      data.push({
        dirX: Math.cos(ang) * sxyLen,
        dirY: u * 0.8,                    // squash vertical spread a little
        dirZ: Math.sin(ang) * sxyLen,
        startR: 0.22 + Math.random() * 0.22,
        birthOffset: Math.random() * 0.45, // seconds of stagger
        life: 0.45 + Math.random() * 0.5,  // seconds per inward trip
        swirl: (Math.random() - 0.5) * 3.0, // tangential drift while falling in
        baseR, baseG, baseB,
      });
    }
    reconstParticleDataRef.current = data;
  };

  const hideReconstituteParticles = () => {
    const pts = reconstParticlesRef.current;
    if (!pts) return;
    const colors = pts.geometry.attributes.color;
    for (let i = 0; i < RECONSTITUTE_PARTICLE_COUNT; i++) {
      colors.setXYZ(i, 0, 0, 0); // zero color → zero additive contribution
    }
    colors.needsUpdate = true;
  };

  const updateReconstituteParticles = (t) => {
    const pts = reconstParticlesRef.current;
    const data = reconstParticleDataRef.current;
    if (!pts || data.length === 0) {
      // Log once per reform cycle if we can't update — helps diagnose
      // ref-not-attached or spawn-never-called cases.
      if (!reconstWarnedRef.current) {
        reconstWarnedRef.current = true;
        console.warn("[reconstitute] cannot update particles", {
          hasPts: !!pts,
          dataLen: data.length,
        });
      }
      return;
    }
    reconstWarnedRef.current = false;
    const positions = pts.geometry.attributes.position;
    const colors = pts.geometry.attributes.color;
    const wick = reconstWickCenterRef.current;
    const elapsedSec = (performance.now() - reconstStartRef.current) / 1000;
    // Global ramp: fade in quickly at start, hold, fade out at the end so
    // the effect doesn't pop on/off with the reform window edges.
    const rampIn = Math.min(1, t * 4);
    const rampOut = t > 0.88 ? Math.max(0, 1 - (t - 0.88) / 0.12) : 1;
    const globalFade = rampIn * rampOut;
    for (let i = 0; i < RECONSTITUTE_PARTICLE_COUNT; i++) {
      const d = data[i];
      if (!d) {
        positions.setXYZ(i, 0, -1000, 0);
        colors.setXYZ(i, 0, 0, 0);
        continue;
      }
      const localTime = elapsedSec - d.birthOffset;
      if (localTime < 0) {
        // Not yet born — park off-screen and invisible.
        positions.setXYZ(i, 0, -1000, 0);
        colors.setXYZ(i, 0, 0, 0);
        continue;
      }
      // Cycle through lifetimes so the shell is continuously seeded.
      const cycleTime = localTime % d.life;
      const p = cycleTime / d.life; // 0..1 within one inward trip
      // Cubic ease-in on the radius → slow drift outward at first, then
      // a sharp acceleration inward. That's the "black hole" feel.
      const eased = Math.pow(p, 2.8);
      const r = (1 - eased) * d.startR;
      // Tangential swirl so particles spiral in rather than heading
      // straight — adds motion interest without changing the silhouette.
      const swirlAng = d.swirl * p;
      const cx = Math.cos(swirlAng);
      const sx = Math.sin(swirlAng);
      const rotDirX = d.dirX * cx - d.dirZ * sx;
      const rotDirZ = d.dirX * sx + d.dirZ * cx;
      const x = wick.x + rotDirX * r;
      const y = wick.y + d.dirY * r;
      const z = wick.z + rotDirZ * r;
      positions.setXYZ(i, x, y, z);
      // Brightness ramps up as the particle falls toward the core and
      // FLARES near it (the `coreBoost` cranks output >3× in the final
      // stretch, which with toneMapped=false feeds the scene's bloom).
      // Snuff in the last 8% hides the respawn-teleport at cycle wrap.
      const ramp = Math.pow(p, 0.55);
      const coreBoost = 1 + Math.pow(p, 4) * 2.8;
      const snuff = p < 0.92 ? 1 : 1 - (p - 0.92) / 0.08;
      const intensity = ramp * coreBoost * snuff;
      const fade = intensity * globalFade;
      colors.setXYZ(i, d.baseR * fade, d.baseG * fade, d.baseB * fade);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  };

  // Radial-gradient texture for the persistent backlight glow. Generated
  // once on the client so we don't need to ship an asset.
  const glowTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 210, 140, 0.9)");
    gradient.addColorStop(0.35, "rgba(255, 170, 90, 0.35)");
    gradient.addColorStop(0.6, "rgba(180, 100, 220, 0.08)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Locate the "Wax" mesh once after the GLB loads, cache the original
  // baseline scale, and reset the mesh to that baseline so any leftover
  // melt state from the previous mount doesn't leak through. Also force
  // every candle mesh into the transparent-render bucket with a high
  // renderOrder so it draws AFTER the statue's additive heart shaders
  // (renderOrder 150) — candle pixels paint over heart glow on overlap.
  // Three.js always renders opaque before transparent, so without
  // `transparent:true` on the candle, hearts (which are transparent)
  // would always draw last regardless of renderOrder.
  useEffect(() => {
    // Reset capture state so variant swaps (pillar ↔ votive) pick up the
    // new scene's flame rather than keeping a stale ref to the old one.
    flameNodeRef.current = null;
    // Shared upgrade helper used on the wax + drip meshes. Swaps the flat
    // authored material for a lit MeshStandardMaterial so it responds to
    // scene lights. Preserves the authored color / base-color map / normal
    // map / vertex colors so textures stay intact, and nudges color +0.2×
    // above authored so the green reads a touch more vividly.
    const upgradeWaxMaterial = (oldMat) => {
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
      mat.userData.isWaxUpgraded = true;
      return mat;
    };
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.renderOrder = 200;
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            m.transparent = true;
            m.depthWrite = true;
          });
        }
      }
      if (
        obj.name &&
        obj.name.toUpperCase() === variantConfig.meltMeshName.toUpperCase()
      ) {
        meltMeshRef.current = obj;
        if (!MELT_BASELINE_CACHE.has(obj)) {
          MELT_BASELINE_CACHE.set(obj, {
            x: obj.scale.x,
            y: obj.scale.y,
            z: obj.scale.z,
          });
        }
        const base = MELT_BASELINE_CACHE.get(obj);
        baseMeltScaleRef.current = base;
        obj.scale.set(base.x, base.y, base.z);
        obj.matrixAutoUpdate = true;

        // Upgrade the authored wax material so it actually responds to
        // scene lights — the GLB ships with a flat-looking material that
        // reads as plastic. MeshStandardMaterial picks up the warm flame
        // light, ambient fill, and the statue's directional light, giving
        // proper shading, highlights, and depth. Color is preserved from
        // the authored material. Skips the wick material slot so the
        // votive's wick tweaks downstream still apply to the original.
        const wickMatName = variantConfig.wickMaterialName;
        const wickTarget = wickMatName
          ? wickMatName.replace(/[._]/g, "").toLowerCase()
          : null;
        const isWickMat = (m) => {
          if (!wickTarget || !m?.name) return false;
          return m.name.replace(/[._]/g, "").toLowerCase() === wickTarget;
        };
        // Flame + wick are parented to the melt mesh (so they shrink
        // with it), which means `obj.traverse` walks into the flame
        // subtree too. Skip anything in a FLAME* ancestor — the flame
        // uses its own authored emissive/additive material and shouldn't
        // be replaced with a lit Standard material.
        const isInFlameSubtree = (node) => {
          let cur = node;
          while (cur && cur !== obj) {
            const upper = cur.name?.toUpperCase() ?? "";
            if (upper.startsWith("FLAME") && !upper.includes("WICK")) return true;
            cur = cur.parent;
          }
          return false;
        };
        obj.traverse((descendant) => {
          if (!descendant.isMesh || !descendant.material) return;
          if (isInFlameSubtree(descendant)) return;
          if (Array.isArray(descendant.material)) {
            descendant.material = descendant.material.map((m) =>
              isWickMat(m) ? m : upgradeWaxMaterial(m),
            );
          } else if (!isWickMat(descendant.material)) {
            descendant.material = upgradeWaxMaterial(descendant.material);
          }
        });

        // Wick handling on the melt mesh. Two problems stack on the
        // votive specifically:
        //   1. Dark material goes invisible against the black page
        //      background when unlit (no flame light), so give it a
        //      small warm emissive so it reads without direct light.
        //   2. The wick sits INSIDE the glass cylinder. Because my
        //      universal mesh loop marks every candle material
        //      transparent + depthWrite:true, the glass writes depth
        //      and the wick's pixels (behind it in z) fail the depth
        //      test and get culled — which is why the wick only
        //      showed when the flame was visible (the additive flame
        //      sort order happened to let the wick slip through).
        //      Fix: disable depthTest on the wick material and bump
        //      the owning mesh's renderOrder above the 200 baseline
        //      so it paints over the glass.
        // obj.traverse handles both GLTF layouts — single Mesh with a
        // material array, or a Group with child Meshes per primitive.
        if (variantConfig.wickMaterialName) {
          const target = variantConfig.wickMaterialName
            .replace(/[._]/g, "")
            .toLowerCase();
          obj.traverse((desc) => {
            const mats = Array.isArray(desc.material)
              ? desc.material
              : desc.material
                ? [desc.material]
                : [];
            mats.forEach((m) => {
              if (!m || !m.name || !m.emissive) return;
              const matName = m.name.replace(/[._]/g, "").toLowerCase();
              if (matName === target) {
                m.emissive.setHex(0x8a5a3a);
                m.emissiveIntensity = 0.9;
                // On the votive the wick sits INSIDE the glass
                // cylinder. My universal mesh loop marks every candle
                // material transparent + depthWrite:true, so the glass
                // writes depth and pixels behind it (the wick) get
                // culled. Disabling depthTest on the wick material +
                // bumping the mesh's renderOrder above the baseline
                // 200 lets the wick paint on top of the glass in both
                // lit and unlit states.
                m.depthTest = false;
                desc.renderOrder = 220;
              }
            });
          });
        }
      }
      if (
        variantConfig.dripMeshName &&
        obj.name &&
        obj.name.toUpperCase() === variantConfig.dripMeshName.toUpperCase()
      ) {
        dripWaxRef.current = obj;
        if (!DRIP_BASELINE_CACHE.has(obj)) {
          DRIP_BASELINE_CACHE.set(obj, {
            x: obj.scale.x,
            y: obj.scale.y,
            z: obj.scale.z,
          });
        }
        const base = DRIP_BASELINE_CACHE.get(obj);
        baseDripScaleRef.current = base;
        obj.scale.set(base.x * 0.35, base.y * 0.35, base.z * 0.35);
        obj.matrixAutoUpdate = true;
        // Apply the same lit material upgrade to the drip so it matches
        // the wax's shading and brightened color tone.
        obj.traverse((descendant) => {
          if (!descendant.isMesh || !descendant.material) return;
          if (Array.isArray(descendant.material)) {
            descendant.material = descendant.material.map((m) =>
              upgradeWaxMaterial(m),
            );
          } else {
            descendant.material = upgradeWaxMaterial(descendant.material);
          }
        });
      }
      // First light found in the GLB is the authored candle-flame
      // pointLight. We don't require a FLAME ancestor because variants
      // place the light differently: the pillar parents it under Flame,
      // the votive makes it a sibling of Flame (both children of XBase).
      // Visibility is handled explicitly below — here we just capture
      // the ref + cache the export-time intensity so the melt fade
      // always starts from the original authored value even after
      // useGLTF returns a scene that's already been dimmed.
      if (obj.isLight && !flameLightRef.current) {
        flameLightRef.current = obj;
        if (!FLAME_LIGHT_BASELINE_CACHE.has(obj)) {
          FLAME_LIGHT_BASELINE_CACHE.set(obj, obj.intensity);
        }
        baseFlameLightIntensityRef.current =
          FLAME_LIGHT_BASELINE_CACHE.get(obj);
        obj.intensity = baseFlameLightIntensityRef.current;
      }
      // Capture the flame parent node (starts with "FLAME", excludes WICK
      // so we don't latch onto a sub-mesh like "Flame_Wick"). First match
      // wins so sub-children don't overwrite.
      if (obj.name && !flameNodeRef.current) {
        const upperName = obj.name.toUpperCase();
        if (upperName.startsWith("FLAME") && !upperName.includes("WICK")) {
          flameNodeRef.current = obj;
          flameBaseScaleRef.current = {
            x: obj.scale.x,
            y: obj.scale.y,
            z: obj.scale.z,
          };
          flameBaseRotationRef.current = {
            x: obj.rotation.x,
            y: obj.rotation.y,
            z: obj.rotation.z,
          };
        }
      }
    });
  }, [scene]);

  // The GLB ships with FLAME hidden; toggle the Flame node + all of its
  // descendants based on whether the user has lit the candle. We match
  // names that START with "FLAME" (so Blender-auto-renamed variants like
  // "Flame.001" or "Flame_0" still match) but EXCLUDE anything
  // containing "WICK" — GLTFLoader may split a multi-material primitive
  // into sub-meshes named "Flame_Wick" that we don't want to hide with
  // the flame. The inner traverse covers every child of Flame (pillar
  // layout); for the votive, where the pointLight is a sibling of Flame,
  // we toggle the captured flameLightRef explicitly below.
  useEffect(() => {
    scene.traverse((obj) => {
      const upper = obj.name?.toUpperCase() ?? "";
      if (upper.startsWith("FLAME") && !upper.includes("WICK")) {
        obj.visible = candleLit;
        obj.traverse((child) => {
          child.visible = candleLit;
        });
      }
    });
    if (flameLightRef.current) {
      flameLightRef.current.visible = candleLit;
    }
  }, [scene, candleLit]);

  // Reset the model to its authored baselines on every lit/unlit
  // transition AND on every fresh light cycle (new litAt). The litAt
  // dep catches a race where rapid burnout → relight gets batched by
  // React into a single candleLit=true render: the candleLit value
  // doesn't change, but litAt does, so this dep still fires and resets
  // the melted state from the previous cycle. useFrame re-applies the
  // correct shrunk scale on the next frame for the lit case.
  useEffect(() => {
    if (meltMeshRef.current) {
      const base = baseMeltScaleRef.current;
      meltMeshRef.current.scale.set(base.x, base.y, base.z);
    }
    if (dripWaxRef.current) {
      const base = baseDripScaleRef.current;
      dripWaxRef.current.scale.set(base.x * 0.0, base.y * 0.0, base.z * 0.0);
    }
    if (flameLightRef.current) {
      flameLightRef.current.intensity = baseFlameLightIntensityRef.current;
    }
  }, [candleLit, litAt]);

  // Reset the burn-out guard whenever a fresh lit timestamp starts.
  useEffect(() => {
    burnedOutFiredRef.current = false;
  }, [litAt]);

  // Detect an ignition (unlit → lit) and stamp the time so useFrame can
  // drive the flash/halo animation.
  useEffect(() => {
    if (candleLit && !prevLitRef.current) {
      ignitionTimeRef.current = performance.now();
    }
    prevLitRef.current = candleLit;
  }, [candleLit]);

  // Track mobile breakpoint in a ref so useFrame can read it without
  // triggering re-renders.
  useEffect(() => {
    const update = () => {
      isMobileRef.current = window.matchMedia("(max-width: 700px)").matches;
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Dev hook: `window.__triggerReconstitute()` forces the reconstitution
  // sequence without waiting for a real burnout. Handy while tuning the
  // animation since the natural trigger takes 60s (anon) or 8h (signed in).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__triggerReconstitute = () => {
      burnedOutFiredRef.current = true;
      reconstPhaseRef.current = "empty";
      reconstStartRef.current = performance.now();
      spawnReconstituteParticles();
      console.log("[reconstitute] triggered", {
        particlesRef: !!reconstParticlesRef.current,
        dataCount: reconstParticleDataRef.current.length,
        variant,
      });
    };
    return () => {
      delete window.__triggerReconstitute;
    };
  }, [variant]);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.translateX(isMobileRef.current ? -0.04 : 0.15);
    groupRef.current.translateY(-1.0);
    groupRef.current.translateZ(-1.1);

    // Melt the candle over the lit window. Flame + wick are parented to
    // the melt mesh, so they follow automatically. The floor is 10% of
    // baseline so a visible stub remains at full burn — the reconstitution
    // sequence then rebuilds the candle from that stub back to 100%. Use
    // scale.set() rather than scale.y = X — direct property assignment
    // bypasses the onChange hook that flags the matrix dirty, so the
    // visible mesh wouldn't update. The melt axis is per-variant: the
    // authored Blender rotation dictates which local axis is vertical.
    if (candleLit && litAt && meltMeshRef.current) {
      const base = baseMeltScaleRef.current;
      const axis = variantConfig.meltAxis;
      const axisBase = base[axis];
      const elapsed = Date.now() - litAt;
      const progress = Math.min(elapsed / meltDuration, 1.0);
      const shrink = Math.max(axisBase * 0.10, axisBase * (1 - progress));
      meltMeshRef.current.scale.set(base.x, base.y, base.z);
      meltMeshRef.current.scale[axis] = shrink;

      // Drips ooze out from the top origin — uniform scale from ~0 to
      // authored baseline as the candle melts.
      if (dripWaxRef.current) {
        const dripBase = baseDripScaleRef.current;
        dripWaxRef.current.visible = true;
        const k = Math.max(0.35, progress);
        dripWaxRef.current.scale.set(dripBase.x * k, dripBase.y * k, dripBase.z * k);
      }

      // Dim the GLB flame pointLight linearly with melt progress. Floor
      // at 10% so the cast light doesn't fully vanish before burnout;
      // visibility toggles off when the candle is extinguished.
      if (flameLightRef.current) {
        const baseI = baseFlameLightIntensityRef.current;
        flameLightRef.current.intensity = baseI * Math.max(0.0, Math.pow(1 -
   progress, 2));
      }

      // Fully melted — burn out once, let parent clear state. Kick off
      // the local reconstitution timeline on the same tick so the empty
      // beat + reform animation take over as `candleLit` flips false.
      if (progress >= 1 && !burnedOutFiredRef.current) {
        burnedOutFiredRef.current = true;
        reconstPhaseRef.current = "empty";
        reconstStartRef.current = performance.now();
        spawnReconstituteParticles();
        onBurnedOut?.();
      }
    }

    // --- Flame flicker + sway ---
    // Composed on top of the authored GLB transform. Each channel reads
    // a different offset into the 1D noise so flicker, stretch, and the
    // two sway axes decorrelate — no rhythmic "dancing" the way sines
    // produce. Only animates while lit; when unlit the flame is hidden.
    if (candleLit && flameNodeRef.current) {
      const baseScale = flameBaseScaleRef.current;
      const baseRot = flameBaseRotationRef.current;
      const ft = performance.now() / 1000;
      const flicker = 1 + flameFbm1D(ft * 3.5) * 0.09;
      const stretch = 1 + flameFbm1D(ft * 3.0 + 100) * 0.06;
      flameNodeRef.current.scale.set(
        baseScale.x * flicker,
        baseScale.y * flicker * stretch,
        baseScale.z * flicker,
      );
      flameNodeRef.current.rotation.x =
        baseRot.x + flameFbm1D(ft * 1.9 + 200) * 0.03;
      flameNodeRef.current.rotation.z =
        baseRot.z + flameFbm1D(ft * 2.2 + 300) * 0.045;
      // Drive the radial glow off the same flicker so outer and inner
      // halos breathe in sync with the flame. Reuse the scale flicker
      // value and sample a second noise stream for opacity variation.
      const glowBreath = flicker; // already 1 ± 0.09
      const glowAlphaNoise = flameFbm1D(ft * 2.8 + 400) * 0.1;
      // Position the glow at the flame's actual world location, converted
      // into groupRef-local space so the sprites (children of groupRef)
      // track wherever the flame is — the hardcoded [0, 0.15, 0.35] spot
      // sits below the visible candle in this scene's transform chain.
      if (groupRef.current) {
        flameNodeRef.current.getWorldPosition(flameGlowTmpVec);
        groupRef.current.worldToLocal(flameGlowTmpVec);
      }
      // Melt factor — glow shrinks and dims as the candle burns down so
      // a short flame doesn't cast a disproportionately large halo.
      const meltP = litAt
        ? Math.min((Date.now() - litAt) / meltDuration, 1.0)
        : 0;
      const meltFactor = 1 - meltP; // 1 when fresh, 0 at burnout
      if (flameGlowOuterRef.current) {
        flameGlowOuterRef.current.visible = true;
        flameGlowOuterRef.current.position.copy(flameGlowTmpVec);
        const glowScale = 0.7 * glowBreath * meltFactor;
        flameGlowOuterRef.current.scale.set(glowScale, glowScale, 1);
        flameGlowOuterRef.current.material.opacity =
          (0.05 + glowAlphaNoise) * meltFactor;
      }
    } else {
      // Hide the glow sprite when the candle is unlit.
      if (flameGlowOuterRef.current) flameGlowOuterRef.current.visible = false;
    }

    // --- Reconstitution: empty pedestal beat → particle swirl → wax re-forms ---
    // Runs after the lit block so that mid-burn reignite (candleLit true)
    // takes priority and the reset useEffect snaps state cleanly.
    if (reconstPhaseRef.current !== "idle" && meltMeshRef.current) {
      const base = baseMeltScaleRef.current;
      const axis = variantConfig.meltAxis;
      const axisBase = base[axis];
      const nowMs = performance.now();
      const elapsedMs = nowMs - reconstStartRef.current;

      // If the user re-lit during the sequence, abort and let the normal
      // reset/melt path take over — don't fight the lit state.
      // NOTE: on the trigger tick candleLit is still true (React hasn't
      // processed the parent's setCandleLit(false) yet), but
      // burnedOutFiredRef is also true on that same tick. It only resets
      // to false on the litAt→null effect flush. So "candleLit true AND
      // burnedOutFiredRef false" uniquely identifies a real re-light.
      if (candleLit && !burnedOutFiredRef.current) {
        reconstPhaseRef.current = "idle";
        hideReconstituteParticles();
      } else if (reconstPhaseRef.current === "empty") {
        // Hold the burned-down silhouette: full baseline on the other
        // two axes, 10% on the melt axis (matches the natural burn floor).
        meltMeshRef.current.scale.set(base.x, base.y, base.z);
        meltMeshRef.current.scale[axis] = axisBase * 0.10;
        if (dripWaxRef.current) {
          const dripBase = baseDripScaleRef.current;
          dripWaxRef.current.visible = true;
          dripWaxRef.current.scale.set(dripBase.x, dripBase.y, dripBase.z);
        }
        hideReconstituteParticles();
        if (elapsedMs >= RECONSTITUTE_EMPTY_BEAT_MS) {
          reconstPhaseRef.current = "reforming";
          reconstStartRef.current = nowMs;
        }
      } else if (reconstPhaseRef.current === "reforming") {
        const t = Math.min(elapsedMs / RECONSTITUTE_REFORM_MS, 1);
        // Wax grows 10% → 100%, slightly back-loaded so particles converge
        // before the pillar shoots up. Starting floor matches the empty-
        // beat hold and the natural 10% burn floor.
        const waxT = Math.max(0, (t - 0.35) / 0.65);
        const waxEased = 1 - Math.pow(1 - waxT, 3); // easeOutCubic
        meltMeshRef.current.scale.set(base.x, base.y, base.z);
        meltMeshRef.current.scale[axis] = axisBase * (0.10 + waxEased * 0.90);
        if (dripWaxRef.current) {
          const dripBase = baseDripScaleRef.current;
          const dk = Math.max(0, 1 - t);
          dripWaxRef.current.scale.set(dripBase.x * dk, dripBase.y * dk, dripBase.z * dk);
        }
        updateReconstituteParticles(t);
        if (t >= 1) {
          reconstPhaseRef.current = "idle";
          meltMeshRef.current.scale.set(base.x, base.y, base.z);
          if (dripWaxRef.current) dripWaxRef.current.scale.set(0, 0, 0);
          hideReconstituteParticles();
        }
      }
    }

    // --- Ignition flash + ongoing flicker on the warm pointLight ---
    if (warmLightRef.current) {
      if (candleLit) {
        const now = performance.now();
        const t = now / 1000;
        // Three overlapping sines → pseudo-random candle flicker.
        const flicker =
          1 +
          0.15 *
            Math.sin(t * 6.3) *
            Math.sin(t * 10.7) *
            Math.sin(t * 3.8);
        // Exponential decay boost on ignition — punchier ramp.
        const ignitionElapsed = ignitionTimeRef.current
          ? now - ignitionTimeRef.current
          : Infinity;
        const boost =
          ignitionElapsed < 1000
            ? 5.5 * Math.exp(-ignitionElapsed / 110)
            : 0;
        warmLightRef.current.intensity =
          WARM_BASE_INTENSITY * flicker + boost;
      } else {
        warmLightRef.current.intensity = 0;
      }
    }

    // --- Persistent backlight glow — tight, subtle outline when unlit;
    //     warmer bloom when lit. ---
    if (glowRef.current) {
      const t = performance.now() / 1000;
      const pulse = 1 + 0.04 * Math.sin(t * 1.8);
      const baseOpacity = candleLit ? 0.35 : 0.18;
      const baseScale = candleLit ? 1.8 : 1.4;
      glowRef.current.material.opacity = baseOpacity * pulse;
      glowRef.current.scale.setScalar(baseScale * pulse);
    }

    // --- Expanding halo sphere on ignition — bigger, faster, brighter ---
    if (haloRef.current) {
      const live =
        candleLit &&
        ignitionTimeRef.current &&
        performance.now() - ignitionTimeRef.current < 700;
      if (live) {
        const elapsed = performance.now() - ignitionTimeRef.current;
        haloRef.current.visible = true;
        // Scale grows from ~0.8 to ~12 with fast ease.
        const s = 0.8 + 11 * (1 - Math.exp(-elapsed / 100));
        haloRef.current.scale.setScalar(s);
        // Opacity punches to 1 then fades in ~180ms.
        haloRef.current.material.opacity = Math.min(
          1,
          1.4 * Math.exp(-elapsed / 160),
        );
      } else if (haloRef.current.visible) {
        haloRef.current.visible = false;
      }
    }

    // Debug readout — update at ~4Hz via direct DOM write so we don't
    // trigger React re-renders.
    if (debugRef?.current) {
      const nowPerf = performance.now();
      if (nowPerf - lastDebugUpdateRef.current > 250) {
        lastDebugUpdateRef.current = nowPerf;
        const axis = variantConfig.meltAxis;
        const axisBase = baseMeltScaleRef.current[axis];
        const elapsed = candleLit && litAt ? Date.now() - litAt : 0;
        const progress = Math.min(elapsed / meltDuration, 1.0);
        const scaleOnAxis = meltMeshRef.current?.scale[axis] ?? axisBase;
        debugRef.current.textContent =
          `variant: ${variant} | lit: ${candleLit} ` +
          `| elapsed: ${(elapsed / 1000).toFixed(1)}s ` +
          `| progress: ${progress.toFixed(3)} ` +
          `| base.${axis}: ${axisBase.toFixed(5)} ` +
          `| scale.${axis}: ${scaleOnAxis.toFixed(6)}`;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Backlight glow plane removed — the CanvasTexture + depthTest:false
          + additive-blended plane combo produced blocky render artifacts
          around the statue area on iOS Safari. Candle is readable without
          it thanks to the flame's own emissive materials. */}
      <primitive object={scene} scale={variantConfig.scale} />
      {/* Low ambient so dark materials (e.g. the votive's wick) stay
          readable when the candle is unlit — without this, the only
          lights are warmLight (intensity 0 when unlit) and the GLB
          pointLight (hidden when unlit), and black-material geometry
          disappears against the black page background. */}
      <ambientLight intensity={0.25} color="#ffffff" />
      {/* Warm candle-side fill — drives ignition flash + ongoing flicker. */}
      {/* <pointLight
        ref={warmLightRef}
        position={[0, 0.15, 0.35]}
        intensity={WARM_BASE_INTENSITY}
        color="#ffb36b"
        distance={2}
      /> */}
      {/* Subtle cool accent for the neon frame. */}
      {/* <pointLight
        position={[0, 0.5, 0.1]}
        intensity={0.5}
        color="#2ad6ee"
        distance={1.5}
      /> */}
      {/* Radial glow around the flame — two additive sprites (billboarded
          to always face the camera) layered for depth. Outer is soft amber,
          inner is a bright warm-white core. Scale + opacity are driven by
          the flame flicker noise so they breathe with the flame. Reuses
          the particle radial-gradient texture. */}
      <sprite
        ref={flameGlowOuterRef}
        position={[0, 0.15, 0.35]}
        scale={[0.7, 0.7, 1]}
        visible={false}
        renderOrder={240}
      >
        <spriteMaterial
          map={reconstParticleTexture}
          color="#ffaa55"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {/* Ignition halo — additive sphere that expands + fades on light-up. */}
      <mesh
        ref={haloRef}
        position={[0, 0.15, 0.35]}
        visible={false}
        renderOrder={10}
      >
        <sphereGeometry args={[0.03, 20, 20]} />
        <meshBasicMaterial
          color="#fff3c2"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Reconstitution particles — swirl inward after burnout. Hidden by
          default (opacity attribute=0); the reform phase drives them.
          renderOrder sits above the candle meshes (which are bumped to 200
          in the mesh traversal above) so additive particles paint on top. */}
      <points
        ref={reconstParticlesRef}
        renderOrder={260}
        frustumCulled={false}
        position={[0, 0, 0]}
      >
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={RECONSTITUTE_PARTICLE_COUNT}
            array={reconstBuffers.position}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={RECONSTITUTE_PARTICLE_COUNT}
            array={reconstBuffers.color}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={16}
          sizeAttenuation={false}
          map={reconstParticleTexture}
          vertexColors={true}
          transparent={true}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

const UNISWAP_URL =
  "https://app.uniswap.org/explore/tokens/base/0x30d01555d88c76500a82754a1d53cac082a6cb75?inputCurrency=NATIVE";
const GECKO_URL =
  "https://www.geckoterminal.com/base/pools/0x40d827acdbefd8ef46953e2b1ac87b8697b82203";

export default function HomePage() {
  const [timeframeKey, setTimeframeKey] = useState("30m");
  const tfOpt =
    TIMEFRAME_OPTIONS.find((o) => o.key === timeframeKey) ||
    TIMEFRAME_OPTIONS[0];
  const data = useCandles({
    count: 12,
    days: tfOpt.days,
    aggregate: tfOpt.aggregate,
  });
  const { user, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();
  const userId = user?.id ?? null;
  // Signed-in "faithful" get the full 8-hour vigil; anonymous visitors
  // get a 1-minute preview that nudges them to sign in to extend it.
  // Keyed off userId (not isSignedIn) to match the hydrate branching and
  // avoid a flicker on Clerk's initial load.
  const meltDuration = userId ? MELT_DURATION_SIGNED_IN_MS : MELT_DURATION_ANON_MS;
  // Candle variant — everyone starts on the pillar. Signed-in users
  // can discover the votive (and future variants) through the picker;
  // their choice persists in localStorage. Starting on the pillar makes
  // the upgrade feel earned rather than auto-granted.
  const [candleVariantChoice, setCandleVariantChoice] = useState("pillar");
  const [showCandlePicker, setShowCandlePicker] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const saved = readCandleVariant(userId);
    if (saved && CANDLE_VARIANTS[saved]) {
      setCandleVariantChoice(saved);
    } else {
      setCandleVariantChoice("pillar");
    }
  }, [userId]);
  const candleVariant = userId ? candleVariantChoice : "pillar";
  const router = useRouter();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showInscribeModal, setShowInscribeModal] = useState(false);
  const [candleLit, setCandleLit] = useState(false);
  const [litAt, setLitAt] = useState(null);
  // Post-ignition nudge shown only to anonymous visitors who just lit a
  // candle — frames sign-in as "save your flame" rather than a gate.
  const [showSignInNudge, setShowSignInNudge] = useState(false);
  const debugRef = useRef(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileDevice(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // On mobile the social stack sits over the chart once the user scrolls
  // into the hero-band. Fade it out past a short threshold so it doesn't
  // cover the candles. iOS Safari sometimes scrolls the body/html rather
  // than the window, so capture events at the document level and read
  // from whichever source actually has the offset.
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setIsScrolled(y > 80);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);
  const hideSocials = isMobileDevice && isScrolled;

  // Hydrate lit state. Signed-in users come from Firestore; anonymous
  // visitors come from localStorage. If an anon user signs in while their
  // local candle is still burning, promote it into Firestore so the flame
  // persists across devices.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!userId) {
        const local = readLocalCandle();
        if (
          local?.litAtMs &&
          Date.now() - local.litAtMs < MELT_DURATION_ANON_MS
        ) {
          setLitAt(local.litAtMs);
          setCandleLit(true);
        } else {
          if (local?.litAtMs) clearLocalCandle();
          setLitAt(null);
          setCandleLit(false);
        }
        return;
      }

      const [remote, local] = [await readCandle(userId), readLocalCandle()];
      if (cancelled) return;

      // Signed-in branch: evaluate both candles against the 8-hour
      // window. If the user lit anonymously (1 min) and then signed in,
      // their local candle gets promoted on the longer timer — "sign in
      // to extend your flame" rather than having it expire mid-ritual.
      const remoteLive =
        remote?.litAtMs &&
        Date.now() - remote.litAtMs < MELT_DURATION_SIGNED_IN_MS;
      const localLive =
        local?.litAtMs &&
        Date.now() - local.litAtMs < MELT_DURATION_SIGNED_IN_MS;

      if (remoteLive) {
        setLitAt(remote.litAtMs);
        setCandleLit(true);
        if (local) clearLocalCandle();
      } else if (localLive) {
        // Promote the anonymous candle to the signed-in ledger so it
        // survives device changes and can join social surfaces later.
        // Pass the original litAtMs so the melt timer doesn't reset.
        lightCandle(userId, {
          displayName:
            user?.fullName || user?.username || user?.firstName || null,
          avatarUrl: user?.imageUrl ?? null,
          litAtMs: local.litAtMs,
        });
        setLitAt(local.litAtMs);
        setCandleLit(true);
        clearLocalCandle();
      } else {
        if (remote?.litAtMs) extinguishCandle(userId);
        if (local?.litAtMs) clearLocalCandle();
        setLitAt(null);
        setCandleLit(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId, user]);

  const doExtinguish = () => {
    if (userId) extinguishCandle(userId);
    else clearLocalCandle();
    setCandleLit(false);
    setLitAt(null);
    setShowSignInNudge(false);
  };

  const doLight = () => {
    const now = Date.now();
    if (userId) {
      lightCandle(userId, {
        displayName:
          user?.fullName || user?.username || user?.firstName || null,
        avatarUrl: user?.imageUrl ?? null,
      });
    } else {
      writeLocalCandle(now);
      if (!readSignInNudgeShown()) {
        setShowSignInNudge(true);
        markSignInNudgeShown();
      }
    }
    setLitAt(now);
    setCandleLit(true);
  };

  // FAB click routing:
  // - Unlit: light the candle (any auth state).
  // - Lit + anon: extinguish (anon users have nothing else to do with
  //   a lit candle).
  // - Lit + signed-in: open the picker so they can change variant.
  //   Extinguish is demoted to a secondary action inside the picker —
  //   it's rarely used since candles burn out naturally over 8 hours.
  const toggleCandle = () => {
    if (candleLit) {
      if (userId) {
        setShowCandlePicker(true);
        return;
      }
      doExtinguish();
      return;
    }
    doLight();
  };

  const handlePickVariant = (variant) => {
    if (!CANDLE_VARIANTS[variant]) return;
    writeCandleVariant(userId, variant);
    setCandleVariantChoice(variant);
    setShowCandlePicker(false);
    // Only auto-light when the user was unlit at pick-time — tapping
    // the picker mid-burn should swap the model without resetting the
    // litAt timer. The model swap happens automatically when the
    // variant prop changes on HeroAltarObject.
    if (!candleLit) doLight();
  };

  // Auto-dismiss the nudge after 12s so it doesn't linger, and close it as
  // soon as the user signs in (migration happens in the hydrate effect).
  useEffect(() => {
    if (!showSignInNudge) return;
    const timer = setTimeout(() => setShowSignInNudge(false), 12000);
    return () => clearTimeout(timer);
  }, [showSignInNudge]);

  useEffect(() => {
    if (userId && showSignInNudge) setShowSignInNudge(false);
  }, [userId, showSignInNudge]);

  // Tick the melt-timer ring + countdown on the CANDLE FAB. 1Hz so the
  // MM:SS readout in the final hour reads as a live clock; the ring's
  // CSS transition smooths the arc between ticks.
  const [meltProgress, setMeltProgress] = useState(0);
  useEffect(() => {
    if (!candleLit || !litAt) {
      setMeltProgress(0);
      return;
    }
    const compute = () => {
      const p = Math.min((Date.now() - litAt) / meltDuration, 1);
      setMeltProgress(p);
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [candleLit, litAt, meltDuration]);

  return (
    <main
      className={`shrine-page neon${
        showSignInNudge || showCandlePicker ? " has-overlay" : ""
      }`}
      style={{ background: "#000" }}
    >
      <div className="scene-background">
        <StarfieldStatueScene
          style={{
            borderRadius: 0,
            border: "none",
            boxShadow: "none",
            transform: "none",
          }}
          statueProps={{ scale: [3, 3, 3] }}
          cameraRadius={2.2}
        >
          <HeroAltarObject
            candleLit={candleLit}
            litAt={litAt}
            meltDuration={meltDuration}
            variant={candleVariant}
            onBurnedOut={doExtinguish}
            debugRef={debugRef}
          />
          {/* <Stats className="r3f-stats" /> */}
        </StarfieldStatueScene>
      </div>

      <div className="hero-header">
        <h1 className="our-lady-title">
          <span className="title-line">Our Lady</span>
          <span className="title-line">
            <span className="title-of">of </span>Perpetual
          </span>
          <span className="title-line title-line-profit">Profit</span>
        </h1>
      </div>

      <div className="hero-band">
        <div className="hero-copy">
          <blockquote
            className="hero-pullquote"
            title="Our Lady of Perpetual Profit, pray for us."
          >
            <p className="hero-pullquote-latin">
              Domina nostra perpetui lucri, ora pro nobis.
            </p>
            <cite className="hero-pullquote-source">
              Missale Degenorum
            </cite>
            <span className="hero-pullquote-gloss" aria-hidden="true">
              Our Lady of Perpetual Profit, pray for us.
            </span>
          </blockquote>
          <p className="hero-intro">
A refuge for the rekt, a liturgy for the ledger, a confessional for your worst trades. RL80 is the token of her order. Mater ex machina. </p>
        </div>

        <div className="shrine-column">
          <div className="shrine-stage">
            <ChartShrine
              {...data}
              palette="chrome"
              timeframeKey={timeframeKey}
              onTimeframeChange={setTimeframeKey}
            />
          </div>

          {/* <div className="shrine-actions">
            <a
              className="shrine-btn"
              href={UNISWAP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Swap on Uniswap
            </a>
            <a
              className="shrine-btn"
              href={GECKO_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Live chart on GeckoTerminal
            </a>
          </div> */}
        </div>
      </div>

      {/* <div className="offering-strip">
        <h2 className="offering-title">Light a Candle</h2>
        <p className="offering-text">
          Add your flame to the ledger — your prayer joins the shrine.
        </p>
        <button type="button" className="shrine-btn offering-cta" disabled>
          Coming soon
        </button>
      </div> */}

      {showSignInNudge && (
        <div className="flame-nudge" role="status" aria-live="polite">
          <p className="flame-nudge-title">Your flame is burning.</p>
          <p className="flame-nudge-sub">Sign in and your votive:</p>
          <ul className="flame-nudge-benefits">
            <li>Burns 8 hours, not 1 minute</li>
            <li>Follows you across every device</li>
            <li>Unlocks more candle options</li>
          </ul>
          <div className="flame-nudge-actions">
            <button
              type="button"
              className="shrine-btn primary flame-nudge-cta"
              onClick={() => openSignIn()}
            >
              Save my flame
            </button>
            <button
              type="button"
              className="flame-nudge-dismiss"
              onClick={() => setShowSignInNudge(false)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showCandlePicker && (
        <div
          className="flame-nudge candle-picker-popup"
          role="dialog"
          aria-label="Choose your candle"
        >
          <p className="flame-nudge-title">Choose your candle</p>
          <div className="candle-picker-tiles">
            <button
              type="button"
              className={`candle-picker-tile${
                candleVariantChoice === "pillar" ? " is-active" : ""
              }`}
              onClick={() => handlePickVariant("pillar")}
            >
              <span className="candle-picker-tile-label">Pillar</span>
              <span className="candle-picker-tile-desc">
                Plain green taper
              </span>
            </button>
            <button
              type="button"
              className={`candle-picker-tile${
                candleVariantChoice === "votive" ? " is-active" : ""
              }`}
              onClick={() => handlePickVariant("votive")}
            >
              <span className="candle-picker-tile-label">Votive</span>
              <span className="candle-picker-tile-desc">
                Our Lady of Guadalupe
              </span>
            </button>
          </div>
          {candleLit && (
            <button
              type="button"
              className="candle-picker-secondary"
              onClick={() => {
                setShowCandlePicker(false);
                doExtinguish();
              }}
            >
              Extinguish candle
            </button>
          )}
          <button
            type="button"
            className="candle-picker-secondary"
            onClick={() => {
              setShowCandlePicker(false);
              signOut();
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            className="flame-nudge-dismiss"
            onClick={() => setShowCandlePicker(false)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <MobileBottomNav
        /* Reduced to 3 slots: LOGIN (account) | CANDLE (center FAB) | BUY
           (menu slot). Music and Wallet slots are suppressed. */
        hideWallet
        accountOnLeft
        /* Repurpose the center FAB as the candle light toggle. */
        onBuyClick={toggleCandle}
        centerLabel={
          candleLit ? (
            userId ? (
              /* Signed-in + lit: the FAB's job pivots from "extinguish"
                 (rare) to "change your candle" (the more valuable
                 action for the faithful). Lucide settings-2 glyph —
                 two sliders — reads as "adjust". Extinguish lives
                 inside the picker as a secondary action. */
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  width: 28,
                  height: 28,
                  display: "block",
                  color: "#f1d77a",
                }}
                aria-hidden="true"
              >
                <path d="M14 17H5" />
                <path d="M19 7h-9" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
            ) : (
              "LIT"
            )
          ) : (
            <img
              src="/images/flame.svg"
              alt="Light"
              style={{ width: 34, height: 34, display: "block" }}
            />
          )
        }
        centerSubLabel={
          candleLit && litAt ? (
            <span
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span>CANDLE</span>
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: "1.2px",
                  color: "#f1d77a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatRemaining(litAt, meltDuration)}
              </span>
            </span>
          ) : (
            "LIGHT CANDLE"
          )
        }
        centerTitle={
          candleLit
            ? userId
              ? "Change candle"
              : "Extinguish candle"
            : "Light candle"
        }
        /* Filling gold arc around the FAB — 0 when just lit, 1 at
           burnout. Only rendered while a candle is actually lit. */
        centerProgress={candleLit ? meltProgress : null}
        /* Repurpose the menu slot as the Buy button. */
        onMenuClick={() => setShowBuyModal(true)}
        menuIcon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: "#d4a854" }}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
        menuLabel="BUY"
        isUserSignedIn={isSignedIn}
        userImage={user?.imageUrl}
        show80sButton={false}
        isMobile
        neonMode
        /* Replace LOGIN slot with BOOK — sign-in/out is surfaced in the
           candle inscribe modal instead. The icon is a scroll glyph and
           routes to the dedicated /exlibris scene rather than opening
           the inline overlay. */
        onBookClick={() => router.push('/exlibris')}
        bookLabel="EX LIBRIS"
        bookIcon={
          <svg
            className="btm-book-icon-svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 12h-5" />
            <path d="M15 8h-5" />
            <path d="M19 17V5a2 2 0 0 0-2-2H4" />
            <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
          </svg>
        }
        extraLeft={[
          {
            key: 'tcg',
            label: 'TCG',
            iconSrc: '/tcg.svg',
            comingSoon: true,
          },
        ]}
        extraRight={[
          {
            key: 'lode',
            label: 'LODE',
            title: 'Mother Lode — coming soon',
            comingSoon: true,
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2ad6ee"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 24, height: 24, display: 'block' }}
                aria-hidden="true"
              >
                <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
                <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
                <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
                <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
              </svg>
            ),
          },
        ]}
      />

      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />

      <TestimonialToasts onInscribeClick={() => setShowInscribeModal(true)} />

      <InscribeModal
        isOpen={showInscribeModal}
        onClose={() => setShowInscribeModal(false)}
        candleLit={candleLit}
      />

      {/* <div ref={debugRef} className="candle-debug" /> */}

      {/* Social Links - Bottom Right */}
      <div
        style={{
          position: "fixed",
          bottom: "5rem",
          right: "2rem",
          left: "auto",
          transform: isMobileDevice ? "translateY(-50%)" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          zIndex: 1001,
          pointerEvents: hideSocials ? "none" : "auto",
          opacity: hideSocials ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <a
          href="https://x.com/rl80token"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X (Twitter)"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(0, 0, 0, 0.5)",
            transition: "all 0.3s ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.3)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <img src="/x_logo_white.webp" alt="X (Twitter)" style={{ width: "18px", height: "18px" }} />
        </a>

        <a
          href="https://t.me/rl80token"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(0, 0, 0, 0.5)",
            transition: "all 0.3s ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.3)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <img src="/telegram_logo_white.webp" alt="Telegram" style={{ width: "20px", height: "20px" }} />
        </a>

        <a
          href="https://farcaster.xyz/rl80"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Farcaster"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(0, 0, 0, 0.5)",
            transition: "all 0.3s ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.3)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <img src="/farcaster_logo.webp" alt="Farcaster" style={{ width: "20px", height: "20px" }} />
        </a>
      </div>
    </main>
  );
}