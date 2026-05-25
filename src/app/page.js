"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useGLTF, Stats } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAccount, useDisconnect, useReadContract } from "wagmi";
import { useInView } from "framer-motion";
import { erc20Abi } from "viem";
import { RL80_ADDRESS } from "@/lib/contracts";
import { UnifiedAccountModal } from "@/components/UnifiedAccountModal";
import ChartShrine, { TIMEFRAME_OPTIONS } from "@/components/ChartShrine";
import MobileBottomNav from "@/components/MobileBottomNav";
import BuyModal from "@/components/BuyModal";
import { useBuyModal } from "@/lib/useBuyModal";
import ReliquaryRail from "@/components/ReliquaryRail";
import HolyTrinSection from "@/components/HolyTrinSection";
import MaterExMachinaSection from "@/components/MaterExMachinaSection";
import BusinessSection from "@/components/BusinessSection";
import DropInTitle from "../components/DropInTitle";
import { useCandles } from "@/hooks/useCandles";
import {
  readCandle,
  lightCandle,
  extinguishCandle,
  readCandlePrefs,
  writeCandlePrefs,
  PREFS_IMAGE_MAX_BYTES,
} from "@/lib/candleRitual";
import {
  readLocalCandle,
  writeLocalCandle,
  clearLocalCandle,
} from "@/lib/localCandle";
import { fireCandleIgnitionPulse } from "@/utils/candleIgnitionPulse";
import "./chart-shrine/chart-shrine.css";

// Preload only the anon-default pillar candle. The votive GLB is
// lazy-loaded on first mount of a signed-in user's HeroAltarObject so
// anonymous visitors don't pay the download for an asset they won't see.
useGLTF.preload("/models/JustCandle.glb");

// Per-user candle customization. localStorage gives an instant paint on
// reload (and is the only store for anonymous users); Firestore carries
// the same fields across devices once a user signs in. On sign-in we
// hydrate local first, then reconcile with Firestore when it returns.
// Keyed by userId so each signed-in user on a shared device gets their
// own prefs.
const CANDLE_VARIANT_STORAGE_PREFIX = "rl80:candleVariant:";
const VOTIVE_IMAGE_STORAGE_PREFIX = "rl80:votiveImage:";
const VOTIVE_TINT_STORAGE_PREFIX = "rl80:votiveTint:";
// Preset list for the votive image picker. `src: null` means "restore the
// baked-in texture that ships with the GLB". Anything else is a URL that
// the TextureLoader can resolve, including data: URLs from uploads.
const VOTIVE_IMAGE_PRESETS = [
  // `src: null` restores the GLB's baked-in decal; `thumbnail` is used
  // only for the picker tile so we can show a preview that matches the
  // baked texture without having to load the full-resolution version
  // as the actual decal.
  {
    key: "default",
    src: null,
    thumbnail: "/images/nuestraSenora.webp",
    label: "Guadalupe",
  },
  { key: "queenOfHearts", src: "/queenOfHearts1.jpg", label: "Queen of Hearts" },
  { key: "heart", src: "/images/sacreCoeur.webp", thumbnail: "/images/sacreCoeur.webp", label: "Heart" },
];
// A small curated palette for the wax tint, plus a "default" entry that
// restores the baked color. Users can also enter any hex via the color
// input. Values are multiplied, not replaced, so the wax keeps its
// authored shading; picking white = no visible tint.
const VOTIVE_TINT_PRESETS = [
  { key: "default", hex: null, label: "Natural" },
  { key: "crimson", hex: "#b83b3b", label: "Crimson" },
  { key: "amber", hex: "#d49f3a", label: "Amber" },
  { key: "rose", hex: "#e57aa7", label: "Rose" },
  { key: "violet", hex: "#8b5fbf", label: "Violet" },
  { key: "jade", hex: "#4aa876", label: "Jade" },
];
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

function readVotiveImage(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOTIVE_IMAGE_STORAGE_PREFIX + userId);
  } catch {
    return null;
  }
}
function writeVotiveImage(userId, src) {
  if (!userId || typeof window === "undefined") return;
  try {
    // setItem throws QuotaExceeded when a large data: URL overflows the
    // 5MB bucket; swallow and let the picker UI surface the failure.
    // Null clears the preference (restores the baked-in texture).
    if (src == null) {
      window.localStorage.removeItem(VOTIVE_IMAGE_STORAGE_PREFIX + userId);
    } else {
      window.localStorage.setItem(VOTIVE_IMAGE_STORAGE_PREFIX + userId, src);
    }
  } catch {}
}

function readVotiveTint(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOTIVE_TINT_STORAGE_PREFIX + userId);
  } catch {
    return null;
  }
}
function writeVotiveTint(userId, hex) {
  if (!userId || typeof window === "undefined") return;
  try {
    if (hex == null) {
      window.localStorage.removeItem(VOTIVE_TINT_STORAGE_PREFIX + userId);
    } else {
      window.localStorage.setItem(VOTIVE_TINT_STORAGE_PREFIX + userId, hex);
    }
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
    // Partial flame counter-scale on the melt axis so the flame
    // doesn't collapse to a pinprick long before the candle burns
    // out. See `flameMeltShrinkRate` on the votive for the full
    // explanation — same value keeps the two variants consistent.
    flameMeltShrinkRate: 0.4,
  },
  votive: {
    modelPath: "/models/tinyVotiveOnly2.glb",
    meltMeshName: "XBASE",
    // Blender export quirk: the votive GLB was exported with the
    // default Y-up conversion (no pre-rotation baked in), so its local
    // vertical is Y — unlike the pillar, which was authored to keep Z
    // as vertical after export. Using the wrong axis made the "melt"
    // shrink the depth (invisible from the front camera) instead of
    // the height.
    meltAxis: "y",
    // Votive wax is tapered (wider at the bottom), so pure vertical
    // shrink looks off — the remaining stub keeps its full original
    // girth and the wider base pokes through the glass cylinder.
    // Shrink the two non-melt axes at a fraction of the melt rate so
    // the column also slims as it burns. 0 = disabled (matches pillar
    // behavior); 1 = same rate as the melt axis.
    meltSecondaryRate: 0.15,
    // How much of the parent candle's vertical shrink the flame
    // inherits. 0 = flame stays at authored height for the whole
    // burn; 1 = flame shrinks 1:1 with the candle (prior behavior).
    // 0.6 lands the flame at ~40% base at full burn and ~70% at
    // half burn — reads as a flame gently lowering rather than
    // collapsing to a pinprick over the glass rim.
    flameMeltShrinkRate: 0.6,
    dripMeshName: null,
    scale: 1.2,
    // Wick material — lives on XBase as a second material slot. Given
    // a small emissive boost so it stays visible when the candle is
    // unlit (no flame light = dark material vanishes against the black
    // page background). Matched case-insensitively with dots/underscores
    // stripped so "Mat15.001", "Mat15_001", and "Mat15001" all hit.
    wickMaterialName: "Mat15.001",
    // User-customizable mesh hooks. `imageMeshName` wears the saint decal
    // (child of `glass`, which is a child of `XCandle01`); swapping its
    // texture lets the faithful personalize who they're lighting for.
    // `tintMeshName` is the wax column — we scope the hue change to the
    // named `waxMaterialName` slot on that mesh so the other material on
    // the same primitive (the wick) isn't also recolored.
    imageMeshName: "senora",
    tintMeshName: "XBase",
    waxMaterialName: "Mat9.001",
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
// const MELT_DURATION_SIGNED_IN_MS = 60 * 1000;

// Reconstitution sequence — after a candle fully burns out, hold the
// empty pedestal briefly, then swirl particles inward and re-form the
// wax. Without this the wax mesh snap-resets to baseline the instant
// `candleLit` flips false, which reads as a jarring pop.
const RECONSTITUTE_EMPTY_BEAT_MS = 1000;
const RECONSTITUTE_REFORM_MS = 1900;
const RECONSTITUTE_PARTICLE_COUNT = 160;

// Ignition spark burst — outward radial puff from the wick when the
// flame catches. Window is sized to outlast the longest individual
// spark (life up to 0.80s + birth stagger up to 0.12s); after that the
// per-frame updater short-circuits and zeroes the buffer once.
const IGNITION_SPARK_COUNT = 80;
const IGNITION_SPARK_WINDOW_MS = 1000;

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

function rootScrollDepth() {
  if (typeof window === "undefined") return 0;

  const viewportHeight = Math.max(window.innerHeight || 1, 1);
  const progress = window.scrollY / (viewportHeight * 0.72);
  return Math.min(Math.max(progress, 0), 1);
}

function smoothRootScrollDepth(value) {
  return value * value * (3 - 2 * value);
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
  votiveImage = null,
  votiveTint = null,
  onHoverChange = null,
}) {
  const variantConfig = CANDLE_VARIANTS[variant] ?? CANDLE_VARIANTS.pillar;
  const { scene } = useGLTF(variantConfig.modelPath);
  const groupRef = useRef();
  // Inner group wrapping the candle primitive — user drags spin this
  // around Y so they can see the flame from angles the saint decal
  // would otherwise occlude. Kept separate from `groupRef` so the
  // outer camera-follow transform stays clean.
  const candleSpinRef = useRef(null);
  const spinStateRef = useRef({ active: false, lastX: 0, yaw: 0, pointerId: null });
  // Saint-decal materials. Collected once per scene load so useFrame
  // can animate a warm emissive bleed through the label as the flame
  // drops behind it. Baseline emissive color/intensity are stashed on
  // each material's userData the first time we touch it.
  const senoraMaterialsRef = useRef([]);
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
  // Which of the FLAME node's local axes (x|y|z) actually points along
  // the wax's melt-axis direction in world space. Detected at load time
  // because Blender export-orientation quirks can rotate the FLAME node
  // independently of its WAX parent — e.g., the pillar's wax was authored
  // Z-up but the FLAME inside it can have a different baked rotation, so
  // scaling flame.scale.z late in the burn stretched it horizontally
  // instead of vertically. Picking the axis from the actual world matrices
  // self-corrects for any GLB without per-variant config.
  const flameMeltAxisRef = useRef(null);
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
  // Smoothed scroll depth used by the camera-anchored placement below.
  // Without this, scroll micro-jitter (trackpad momentum, scroll-snap) feeds
  // straight into the candle's translateY and the visible-toggle threshold,
  // making the candle vibrate as it approaches the fade-out boundary.
  const smoothedDepthRef = useRef(0)
  // Hysteresis state for the visibility toggle — once hidden, stays hidden
  // until depth drops well below the threshold, so noise at the boundary
  // can't flip it on/off.
  const visibilityRef = useRef(true)
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

  // Ignition sparks — outward puff fired in the existing ignition useEffect
  // and animated below in useFrame off `ignitionTimeRef`. Refs/data parallel
  // the reconstitution ones; reuses the same radial-gradient texture and the
  // additive HDR color treatment so both bursts share visual language.
  const ignitionSparksRef = useRef(null);
  const ignitionSparkDataRef = useRef([]);
  const ignitionSparkOriginRef = useRef(new THREE.Vector3(0, 0.15, 0.35));
  const ignitionBuffers = useMemo(() => ({
    position: new Float32Array(IGNITION_SPARK_COUNT * 3),
    color: new Float32Array(IGNITION_SPARK_COUNT * 3),
  }), []);

  // Ignition audio — short choir hit fired alongside the spark burst.
  // Preloaded on mount so first-light has zero latency (the file is ~48KB
  // and lighting is the page's whole purpose, so preloading is cheap).
  // Audio plays gated by the user click on the FAB, satisfying autoplay
  // policy; the .catch swallow handles edge cases (tab backgrounded,
  // permissions changed mid-session) without throwing.
  const ignitionAudioRef = useRef(null);

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

  // Ignition sparks spawn — anchor the burst origin to the FLAME's current
  // world position (group-local) so sparks emit from the visible wick rather
  // than the group origin. Falls back to the wax mesh if the flame node
  // hasn't been captured yet on first ignition.
  const spawnIgnitionSparks = () => {
    const data = [];
    const origin = new THREE.Vector3(0, 0.15, 0.35);
    if (groupRef.current) {
      const worldPos = new THREE.Vector3();
      if (flameNodeRef.current) {
        flameNodeRef.current.getWorldPosition(worldPos);
        groupRef.current.worldToLocal(worldPos);
        origin.copy(worldPos);
      } else if (meltMeshRef.current) {
        meltMeshRef.current.getWorldPosition(worldPos);
        groupRef.current.worldToLocal(worldPos);
        origin.copy(worldPos);
        origin.y += 0.2;
      }
    }
    ignitionSparkOriginRef.current.copy(origin);
    for (let i = 0; i < IGNITION_SPARK_COUNT; i++) {
      // Hemispherical-up burst: random azimuth + biased upward Y component
      // so the sparks rise like heat shedding rather than spraying in every
      // direction. upBias∈[0.3,1.0] with sxyLen = sqrt(1 - upBias²) keeps
      // the speed magnitude consistent across the cone.
      const ang = Math.random() * Math.PI * 2;
      const upBias = 0.3 + Math.random() * 0.7;
      const sxyLen = Math.sqrt(Math.max(0, 1 - upBias * upBias));
      const speed = 0.9 + Math.random() * 1.3;
      // Two color families mirror the reconstitution palette so both bursts
      // feel like they belong to the same world. Heavier weighting on warm
      // gold reads as fire, with violet accents for visual interest.
      const colorRoll = Math.random();
      let baseR, baseG, baseB;
      if (colorRoll < 0.7) {
        baseR = 2.6; baseG = 1.6; baseB = 0.5;
      } else {
        baseR = 1.7; baseG = 1.0; baseB = 2.4;
      }
      data.push({
        vx: Math.cos(ang) * sxyLen * speed,
        vy: upBias * speed,
        vz: Math.sin(ang) * sxyLen * speed,
        birthOffset: Math.random() * 0.12,
        life: 0.45 + Math.random() * 0.35,
        baseR, baseG, baseB,
      });
    }
    ignitionSparkDataRef.current = data;
  };

  const hideIgnitionSparks = () => {
    const pts = ignitionSparksRef.current;
    if (!pts) return;
    const colors = pts.geometry.attributes.color;
    for (let i = 0; i < IGNITION_SPARK_COUNT; i++) {
      colors.setXYZ(i, 0, 0, 0);
    }
    colors.needsUpdate = true;
  };

  const updateIgnitionSparks = (ignitionElapsedMs) => {
    const pts = ignitionSparksRef.current;
    const data = ignitionSparkDataRef.current;
    if (!pts || data.length === 0) return;
    const positions = pts.geometry.attributes.position;
    const colors = pts.geometry.attributes.color;
    const origin = ignitionSparkOriginRef.current;
    const elapsedSec = ignitionElapsedMs / 1000;
    // Weak gravity so the burst arcs back down rather than scattering
    // forever. Tuned soft (~-1.5) — most sparks die before re-entry, but
    // the top few visibly fall, which sells the ballistic feel.
    const g = -1.5;
    for (let i = 0; i < IGNITION_SPARK_COUNT; i++) {
      const d = data[i];
      if (!d) {
        positions.setXYZ(i, 0, -1000, 0);
        colors.setXYZ(i, 0, 0, 0);
        continue;
      }
      const localT = elapsedSec - d.birthOffset;
      if (localT < 0 || localT > d.life) {
        positions.setXYZ(i, 0, -1000, 0);
        colors.setXYZ(i, 0, 0, 0);
        continue;
      }
      const x = origin.x + d.vx * localT;
      const y = origin.y + d.vy * localT + 0.5 * g * localT * localT;
      const z = origin.z + d.vz * localT;
      positions.setXYZ(i, x, y, z);
      // Cubic-ish fade so sparks die clean rather than lingering as dim dots.
      const lifeFrac = localT / d.life;
      const intensity = Math.pow(1 - lifeFrac, 1.8);
      colors.setXYZ(i, d.baseR * intensity, d.baseG * intensity, d.baseB * intensity);
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
    flameMeltAxisRef.current = null;
    senoraMaterialsRef.current = [];
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
      // Carry the authored name forward so downstream effects (e.g. the
      // votive wax-tint apply) can still target this slot by name.
      if (oldMat.name) mat.name = oldMat.name;
      mat.userData.isWaxUpgraded = true;
      return mat;
    };
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.renderOrder = 200;
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          // The votive's glass cylinder is transparent — writing depth
          // makes it occlude everything behind it (wick, flame, etc.)
          // regardless of alpha. Skip depthWrite on glass so contents
          // of the container render through. The opaque saint decal
          // (`senora`) is a separate mesh and still writes depth, so
          // it correctly occludes the flame when it drops behind.
          const isGlass = obj.name?.toLowerCase() === "glass";
          mats.forEach((m) => {
            m.transparent = true;
            m.depthWrite = !isGlass;
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
      // wins so sub-children don't overwrite. Authored duplicates (e.g.
      // tinyVotiveOnly.glb ships both FLAME and a slightly larger
      // FLAME.001 sharing geometry) are kept permanently hidden by the
      // lit/unlit flame-visibility effect further below.
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
          // Flame materials: additive blending so the near-black alpha
          // texels of the cross-billboard quads add ~0 to the
          // framebuffer (invisible), while the bright flame pixels blaze
          // through. Eliminates the ghost rectangles that alphaMode:
          // BLEND leaves behind. depthWrite:false so additive/emissive
          // fragments don't self-occlude. depthTest stays ON so the
          // opaque saint decal still occludes the flame when it drops
          // behind the label. renderOrder 240 keeps flame painting
          // after the glass (200) and wick (220).
          obj.traverse((desc) => {
            if (!desc.isMesh || !desc.material) return;
            const mats = Array.isArray(desc.material) ? desc.material : [desc.material];
            mats.forEach((m) => {
              if (!m) return;
              m.blending = THREE.AdditiveBlending;
              m.depthWrite = false;
              m.transparent = true;
            });
            desc.renderOrder = 240;
          });
        }
      }
      // Saint-decal (senora) — collect materials so useFrame can boost
      // their emissive to warm as the flame burns below the label, so
      // the occluded flame reads as a warmth bleed-through rather than
      // just disappearing. Baseline emissive color + intensity are
      // stashed on userData so we can always restore cleanly on
      // extinguish.
      const imageMeshName = variantConfig.imageMeshName?.toLowerCase();
      if (imageMeshName && obj.name?.toLowerCase() === imageMeshName) {
        obj.traverse((desc) => {
          if (!desc.isMesh || !desc.material) return;
          const mats = Array.isArray(desc.material) ? desc.material : [desc.material];
          mats.forEach((m) => {
            if (!m || !m.emissive) return;
            if (m.userData.baseEmissiveIntensity == null) {
              m.userData.baseEmissiveIntensity = m.emissiveIntensity ?? 1;
              m.userData.baseEmissiveR = m.emissive.r;
              m.userData.baseEmissiveG = m.emissive.g;
              m.userData.baseEmissiveB = m.emissive.b;
            }
            // The decal PNG has transparent regions around the heart
            // artwork. The global mesh setup above sets transparent:true +
            // depthWrite:true, which makes those transparent texels still
            // write depth — so the flame behind the label was getting
            // occluded by the empty PNG corners. alphaTest discards low-
            // alpha fragments before depth is written, so only the
            // actually-painted pixels of the heart occlude the flame.
            m.alphaTest = 0.5;
            m.needsUpdate = true;
            senoraMaterialsRef.current.push(m);
          });
        });
      }
    });

    // Determine which flame-local axis aligns with the wax's melt axis
    // in world space. We scale flame.scale[axis] to counter the wax's
    // shrink, but the flame's local frame can be rotated relative to
    // the wax's by the GLB authoring/export, so naming the axis from
    // the wax config alone isn't reliable — late in the burn this
    // misalignment stretched the flame sideways into a flat line.
    if (meltMeshRef.current && flameNodeRef.current) {
      meltMeshRef.current.updateMatrixWorld(true);
      flameNodeRef.current.updateMatrixWorld(true);
      const waxQuat = new THREE.Quaternion();
      meltMeshRef.current.getWorldQuaternion(waxQuat);
      const flameQuat = new THREE.Quaternion();
      flameNodeRef.current.getWorldQuaternion(flameQuat);
      // Wax's melt axis as a world-space direction.
      const waxDir = new THREE.Vector3(
        variantConfig.meltAxis === "x" ? 1 : 0,
        variantConfig.meltAxis === "y" ? 1 : 0,
        variantConfig.meltAxis === "z" ? 1 : 0,
      ).applyQuaternion(waxQuat).normalize();
      // Each flame-local axis as a world-space direction; pick whichever
      // is most parallel to waxDir (largest |dot|).
      const candidates = ["x", "y", "z"];
      let bestAxis = variantConfig.meltAxis;
      let bestDot = -Infinity;
      const tmp = new THREE.Vector3();
      for (const ax of candidates) {
        tmp.set(ax === "x" ? 1 : 0, ax === "y" ? 1 : 0, ax === "z" ? 1 : 0)
          .applyQuaternion(flameQuat)
          .normalize();
        const d = Math.abs(tmp.dot(waxDir));
        if (d > bestDot) {
          bestDot = d;
          bestAxis = ax;
        }
      }
      flameMeltAxisRef.current = bestAxis;
    }
  }, [scene]);

  // Drag-to-spin for the hero candle. Attaches at the window level so
  // one continuous drag = one continuous rotation — we don't rely on
  // R3F's raycast-limited pointer events, which stop firing on a mesh
  // the moment the cursor leaves its silhouette. Scoped to pointerdowns
  // that start on the scene-background so clicks on UI buttons/links
  // elsewhere on the page aren't hijacked.
  // Drag-to-spin only on variants whose flat the user wants to peek
  // around — the votive's saint decal occludes the flame, so spinning
  // is the relief valve. The pillar has nothing on its sides worth
  // hiding, so we don't enable drag (and the grab cursor is also
  // suppressed via the .is-rotatable class below).
  useEffect(() => {
    if (variant !== "votive") return;
    const onDown = (e) => {
      const bg = e.target?.closest?.(".scene-background");
      if (!bg) return;
      if (e.button != null && e.button !== 0) return; // left-mouse / touch only
      bg.classList.add("is-grabbing");
      const startX = e.clientX;
      const startYaw = spinStateRef.current.yaw;
      const SENSITIVITY = 0.015; // rad/px
      const onMove = (me) => {
        const dx = me.clientX - startX;
        spinStateRef.current.yaw = startYaw + dx * SENSITIVITY;
        if (candleSpinRef.current) {
          candleSpinRef.current.rotation.y = spinStateRef.current.yaw;
        }
      };
      const onEnd = () => {
        bg.classList.remove("is-grabbing");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [variant]);

  // Toggle .is-rotatable on the scene-background so the grab cursor
  // only shows for variants that are actually draggable. Cleared on
  // unmount and on variant swap so the pillar never inherits a stale
  // grab cursor from a prior votive session.
  useEffect(() => {
    const bg = typeof document !== "undefined"
      ? document.querySelector(".scene-background")
      : null;
    if (!bg) return;
    if (variant === "votive") bg.classList.add("is-rotatable");
    else bg.classList.remove("is-rotatable");
    return () => bg.classList.remove("is-rotatable");
  }, [variant]);

  // PillarProp visibility — some unified GLBs (e.g. tinyVotiveOnly2.glb)
  // ship both the votive geometry and a pillar-candle prop named
  // "PillarProp" in the same file. Only show it when the pillar variant
  // is active. No-op if the node isn't in the current scene, so this
  // stays safe for GLBs that don't carry the prop.
  useEffect(() => {
    if (!scene) return;
    scene.traverse((obj) => {
      if (obj.name === "PillarProp") {
        obj.visible = variant === "pillar";
      }
    });
  }, [scene, variant]);

  // User-customizable votive surfaces. Swaps the Senora decal texture and
  // tints the wax color. Runs separately from the heavy material-upgrade
  // traverse so we don't re-upgrade materials every time the user picks
  // a new color. Variants other than votive skip the whole effect.
  useEffect(() => {
    if (!scene) return;
    if (variant !== "votive") return;
    const imageMeshName = variantConfig.imageMeshName?.toLowerCase();
    const tintMeshName = variantConfig.tintMeshName?.toLowerCase();
    // The XBase primitive has two material slots (wax + wick). Match the
    // wax slot by name so the tint doesn't bleed onto the wick. Case and
    // separator-tolerant so "Mat9.001", "Mat9_001", and "Mat9001" all hit
    // — GLTFLoader has been observed to mangle these subtly.
    const waxTarget = variantConfig.waxMaterialName
      ? variantConfig.waxMaterialName.replace(/[._]/g, "").toLowerCase()
      : null;
    const isWaxMat = (m) => {
      if (!waxTarget || !m?.name) return false;
      return m.name.replace(/[._]/g, "").toLowerCase() === waxTarget;
    };

    let disposedTex = null;

    // XBase and senora may be authored as Groups (XCandle01 > glass >
    // senora is clearly nested), so we can't filter by `obj.isMesh` at
    // the outer traverse. Instead, when the named node matches, walk
    // *its* subtree and apply the mutation to any mesh-with-material
    // descendants. This mirrors the melt-mesh traverse pattern above.
    const applyToDescendantMats = (root, fn) => {
      root.traverse((descendant) => {
        if (!descendant.isMesh || !descendant.material) return;
        const mats = Array.isArray(descendant.material)
          ? descendant.material
          : [descendant.material];
        mats.forEach((m) => m && fn(m, descendant));
      });
    };

    scene.traverse((obj) => {
      const nameLower = obj.name?.toLowerCase() ?? "";
      if (!nameLower) return;

      // Senora decal — swap the material's base-color map. Cache the
      // baked-in map on userData the first time we touch this mesh so we
      // can restore it when the user picks "Guadalupe (default)".
      if (imageMeshName && nameLower === imageMeshName) {
        applyToDescendantMats(obj, (m) => {
          // Cache the baked-in texture from both slots the senora
          // material uses in Blender: base color (.map) AND emissive
          // (.emissiveMap), which is how the decal glows from within.
          // Swapping only .map leaves the old image visible as an
          // emissive ghost on top of the new one, so we have to swap
          // both slots in lockstep.
          if (!("bakedMap" in m.userData)) {
            m.userData.bakedMap = m.map ?? null;
          }
          if (!("bakedEmissiveMap" in m.userData)) {
            m.userData.bakedEmissiveMap = m.emissiveMap ?? null;
          }
          const assignUserTexture = (tex) => {
            // Drop previously-applied user textures so fast successive
            // picks don't leak GPU memory. Never dispose the baked
            // textures — the GLB owns those.
            if (m.map && m.map !== m.userData.bakedMap) {
              m.map.dispose();
            }
            if (
              m.emissiveMap &&
              m.emissiveMap !== m.userData.bakedEmissiveMap &&
              m.emissiveMap !== m.map
            ) {
              m.emissiveMap.dispose();
            }
            m.map = tex;
            // Only assign to emissiveMap if the material originally used
            // one — otherwise we'd accidentally turn a non-glowing
            // material into a glowing one.
            if (m.userData.bakedEmissiveMap) {
              m.emissiveMap = tex;
            }
            m.needsUpdate = true;
          };
          const restoreBaked = () => {
            if (m.map && m.map !== m.userData.bakedMap) {
              m.map.dispose();
            }
            if (
              m.emissiveMap &&
              m.emissiveMap !== m.userData.bakedEmissiveMap &&
              m.emissiveMap !== m.map
            ) {
              m.emissiveMap.dispose();
            }
            m.map = m.userData.bakedMap;
            m.emissiveMap = m.userData.bakedEmissiveMap;
            m.needsUpdate = true;
          };
          if (votiveImage) {
            const loader = new THREE.TextureLoader();
            loader.load(
              votiveImage,
              (tex) => {
                // Match GLTFLoader conventions so UV orientation and
                // color space line up with the baked texture this
                // replaces.
                tex.flipY = false;
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                // Anisotropic filtering dramatically sharpens the decal
                // at the grazing angles that the curved votive glass
                // presents — without it the image softens along the
                // sides of the cylinder even when the source texture is
                // high-resolution. 16 is typical max; Three clamps to
                // whatever the GPU supports.
                tex.anisotropy = 16;
                tex.generateMipmaps = true;
                tex.minFilter = THREE.LinearMipmapLinearFilter;
                tex.magFilter = THREE.LinearFilter;
                assignUserTexture(tex);
              },
              undefined,
              () => {
                // Load failure: fall back to the baked maps instead of
                // leaving the decal stuck on the previous (possibly
                // also-broken) URL.
                restoreBaked();
              },
            );
          } else {
            restoreBaked();
          }
        });
      }

      // XBase wax tint. Multiplicative: captures the authored/upgraded
      // color once, then applies `authored * userTint`. Picking null or
      // pure white restores the authored color exactly. Skips the wick
      // material so the warm wick glow isn't recolored along with the wax.
      // XBase in the GLB is a Group, not a mesh — walk descendants so we
      // reach the actual wax submesh(es).
      if (tintMeshName && nameLower === tintMeshName) {
        applyToDescendantMats(obj, (m) => {
          if (!m.color) return;
          if (!isWaxMat(m)) return;
          // Cache the authored diffuse *and* emissive so a reset (null
          // tint) restores both exactly.
          if (!m.userData.authoredColor) {
            m.userData.authoredColor = m.color.clone();
          }
          if (m.emissive && !m.userData.authoredEmissive) {
            m.userData.authoredEmissive = m.emissive.clone();
          }
          const baseColor = m.userData.authoredColor;
          const baseEmissive = m.userData.authoredEmissive;
          if (votiveTint) {
            // Replace, don't multiply. The authored wax is a saturated
            // green with a matching emissive; multiplicative tinting
            // (authored * tint) muddies anything off-green into near-
            // black. Replacing yields the hue the user actually picked.
            // Emissive is derived from the tint at the same proportional
            // intensity the authored emissive had vs. its diffuse, so
            // the inner glow follows the surface color naturally.
            const tint = new THREE.Color(votiveTint);
            m.color.copy(tint);
            if (m.emissive) {
              m.emissive.copy(tint).multiplyScalar(0.18);
            }
          } else {
            m.color.copy(baseColor);
            if (baseEmissive && m.emissive) {
              m.emissive.copy(baseEmissive);
            }
          }
          m.needsUpdate = true;
        });
      }
    });

    return () => {
      // Nothing cleanup-sensitive here; load callbacks race with unmount
      // but set properties on materials that persist in the cached GLTF
      // scene, which is fine — next mount will re-apply the latest state.
      if (disposedTex) disposedTex.dispose();
    };
  }, [scene, variant, variantConfig, votiveImage, votiveTint]);

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

  // Preload the ignition sparkle via Web Audio API rather than
  // HTMLAudioElement. On iOS, an <audio> element claims the "playback"
  // audio session, which pauses anything else the user has playing
  // (Spotify, YouTube, a podcast). AudioContext defaults to the
  // "ambient" session, which mixes with other audio instead — so a
  // listener can light a candle without their music cutting out.
  //
  // The context is created up-front but stays suspended until the
  // first ignition resumes it inside the user-gesture handler, which
  // is what iOS Safari requires.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // very old browser — skip the sparkle silently
    let cancelled = false;
    const ctx = new Ctx();
    let buffer = null;
    (async () => {
      try {
        const res = await fetch("/audio/sparkle.mp3");
        const arrayBuf = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuf);
        if (cancelled) return;
        ignitionAudioRef.current = { ctx, buffer };
      } catch {
        // Decode/fetch failed — drop the sparkle rather than blocking
        // ignition. The visual flash + spark burst still play.
      }
    })();
    return () => {
      cancelled = true;
      ignitionAudioRef.current = null;
      ctx.close().catch(() => {});
    };
  }, []);

  // Detect an ignition (unlit → lit) and stamp the time so useFrame can
  // drive the flash/halo animation. Also seed the outward spark burst,
  // fire the choir hit, and broadcast the pulse to the holographic statue
  // so its rim shell + halo glow flash in sync with the candle's halo.
  useEffect(() => {
    if (candleLit && !prevLitRef.current) {
      ignitionTimeRef.current = performance.now();
      spawnIgnitionSparks();
      fireCandleIgnitionPulse();
      const sparkle = ignitionAudioRef.current;
      if (sparkle?.ctx && sparkle?.buffer) {
        const { ctx, buffer } = sparkle;
        // iOS keeps the AudioContext suspended until a user gesture
        // resumes it. Ignition is itself a user gesture (FAB tap), so
        // resuming here is allowed. Subsequent relights find the ctx
        // already running — the resume call is a cheap no-op.
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.6;
        src.connect(gain).connect(ctx.destination);
        // Each ignition gets a fresh source node — no need to reset a
        // playhead since BufferSourceNodes are single-use; they GC
        // themselves once playback finishes.
        try { src.start(0); } catch {}
      }
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

  useFrame(({ camera }, delta) => {
    if (!groupRef.current) return;
    const targetDepth = smoothRootScrollDepth(rootScrollDepth());
    // Exponential smoothing — same approach as CraneShotCamera, so the
    // candle and camera move on matched timescales. dt-based smoothing
    // stays frame-rate independent.
    const smoothing = 1 - Math.exp(-delta * 8);
    smoothedDepthRef.current += (targetDepth - smoothedDepthRef.current) * smoothing;
    const depth = smoothedDepthRef.current;

    // Hysteresis: hide at 0.97, show again only when depth drops below 0.93.
    if (visibilityRef.current && depth >= 0.97) visibilityRef.current = false;
    else if (!visibilityRef.current && depth < 0.93) visibilityRef.current = true;
    groupRef.current.visible = visibilityRef.current;

    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.translateX(isMobileRef.current ? -0.04 : 0.15);
    groupRef.current.translateY(-1.0 - depth * 1.4);
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
      // Non-melt (radial) axes shrink at a reduced rate for tapered
      // shapes like the votive — 0 leaves them at baseline (pillar).
      const secondaryRate = variantConfig.meltSecondaryRate ?? 0;
      const sideFactor = secondaryRate > 0
        ? Math.max(0.10, 1 - progress * secondaryRate)
        : 1;
      meltMeshRef.current.scale.set(
        base.x * sideFactor,
        base.y * sideFactor,
        base.z * sideFactor,
      );
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

    // Saint-decal warm bleed-through. When the flame drops behind the
    // opaque label (~1/3 burn onward) it's fully occluded, which reads
    // as "the candle just turned off" unless something else signals
    // warmth. Push emissive toward warm orange on the decal materials
    // so the label glows with the flame's heat through the paper/paint.
    // Intensity ramps from 0 at 30% burn to full at 100%, gated on the
    // lit state so an unlit candle's decal stays authored-neutral.
    if (senoraMaterialsRef.current.length > 0) {
      let bleed = 0;
      if (candleLit && litAt) {
        const elapsed = Date.now() - litAt;
        const progress = Math.min(elapsed / meltDuration, 1.0);
        // Hold silent until the flame has dropped to the top of the
        // label, then ramp up. Subtle flicker so the glow feels alive
        // rather than a flat DC offset.
        const ramp = Math.max(0, (progress - 0.3) / 0.7);
        const flicker = 1 + flameFbm1D(performance.now() / 1000 * 3.0 + 500) * 0.15;
        bleed = ramp * flicker;
      }
      senoraMaterialsRef.current.forEach((m) => {
        if (m.userData.baseEmissiveIntensity == null) return;
        m.emissiveIntensity = m.userData.baseEmissiveIntensity + bleed * 1.2;
        // Warm orange tint (roughly 0xff7a33 split), additive on top of
        // the authored emissive color so colored decals aren't washed
        // out — the tint pushes toward candlelight without replacing it.
        m.emissive.setRGB(
          m.userData.baseEmissiveR + bleed * 0.55,
          m.userData.baseEmissiveG + bleed * 0.22,
          m.userData.baseEmissiveB + bleed * 0.04,
        );
      });
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
      // Catch-and-settle: first ~280ms after ignition the flame surges to
      // ~1.5× authored size then eases back to baseline (quadratic decay),
      // with extra flicker amplitude during the settle. Reads as the wick
      // catching rather than blinking on at full size.
      let catchScale = 1;
      let catchFlickerBoost = 0;
      if (ignitionTimeRef.current != null) {
        const ie = performance.now() - ignitionTimeRef.current;
        if (ie < 280) {
          const decay = 1 - ie / 280;
          catchScale = 1 + decay * decay * 0.5;
          catchFlickerBoost = decay * 0.18;
        }
      }
      const flicker = 1 + flameFbm1D(ft * 3.5) * (0.09 + catchFlickerBoost);
      const stretch = 1 + flameFbm1D(ft * 3.0 + 100) * (0.06 + catchFlickerBoost * 0.5);
      // Counter-scale against the parent wax mesh:
      //   - non-melt axes: undo the radial squeeze from meltSecondaryRate
      //     so the flame keeps its authored girth
      //   - melt axis: partially undo the vertical shrink so the flame
      //     doesn't collapse too early. flameMeltShrinkRate is 0..1:
      //     0 keeps the flame at full authored height for the whole
      //     burn; 1 lets it shrink 1:1 with the candle (pre-existing
      //     behavior). Default is 1 for backward compat — opt in per
      //     variant.
      let compX = 1, compY = 1, compZ = 1;
      if (litAt) {
        const elapsed = Date.now() - litAt;
        const progress = Math.min(elapsed / meltDuration, 1.0);
        // Use the flame-local axis that was detected to align with the
        // wax's melt direction in world space. Falls back to the wax
        // config if detection hasn't run yet (first frame on load).
        const flameAxis = flameMeltAxisRef.current ?? variantConfig.meltAxis;

        const secondaryRate = variantConfig.meltSecondaryRate ?? 0;
        const sideFactor = secondaryRate > 0
          ? Math.max(0.10, 1 - progress * secondaryRate)
          : 1;
        const sideComp = 1 / sideFactor;

        const meltShrinkRate = variantConfig.flameMeltShrinkRate ?? 1;
        const parentMeltScale = Math.max(0.10, 1 - progress);
        const flameTargetMelt = Math.max(0.10, 1 - progress * meltShrinkRate);
        const meltComp = flameTargetMelt / parentMeltScale;

        compX = flameAxis === "x" ? meltComp : sideComp;
        compY = flameAxis === "y" ? meltComp : sideComp;
        compZ = flameAxis === "z" ? meltComp : sideComp;
      }
      flameNodeRef.current.scale.set(
        baseScale.x * flicker * compX * catchScale,
        baseScale.y * flicker * stretch * compY * catchScale,
        baseScale.z * flicker * compZ * catchScale,
      );
      flameNodeRef.current.rotation.x =
        baseRot.x + flameFbm1D(ft * 1.9 + 200) * (0.03 + catchFlickerBoost * 0.5);
      flameNodeRef.current.rotation.z =
        baseRot.z + flameFbm1D(ft * 2.2 + 300) * (0.045 + catchFlickerBoost * 0.5);
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
        // Hold the burned-down silhouette: radial axes match the squeezed
        // state from end-of-burn (sideFactor at progress=1) so we don't
        // pop from squeezed-girth back to full-girth the instant burnout
        // fires. 10% on the melt axis matches the natural burn floor.
        const secondaryRate = variantConfig.meltSecondaryRate ?? 0;
        const burnEndSideFactor = secondaryRate > 0
          ? Math.max(0.10, 1 - secondaryRate)
          : 1;
        meltMeshRef.current.scale.set(
          base.x * burnEndSideFactor,
          base.y * burnEndSideFactor,
          base.z * burnEndSideFactor,
        );
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
        // beat hold and the natural 10% burn floor. Radial axes grow back
        // from their burn-end squeeze to full baseline on the same eased
        // curve so the column thickens in lockstep with the vertical
        // re-grow rather than popping wider than the glass at t=0.
        const waxT = Math.max(0, (t - 0.35) / 0.65);
        const waxEased = 1 - Math.pow(1 - waxT, 3); // easeOutCubic
        const secondaryRate = variantConfig.meltSecondaryRate ?? 0;
        const burnEndSideFactor = secondaryRate > 0
          ? Math.max(0.10, 1 - secondaryRate)
          : 1;
        const sideFactor = burnEndSideFactor + (1 - burnEndSideFactor) * waxEased;
        meltMeshRef.current.scale.set(
          base.x * sideFactor,
          base.y * sideFactor,
          base.z * sideFactor,
        );
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

    // --- Ignition sparks — outward burst from the wick on light-up ---
    // Window is sized to outlast every spark's lifetime; once it closes we
    // zero the buffer ONCE rather than every frame, so the rest of the
    // candle's life pays no cost for this effect.
    if (ignitionSparksRef.current && ignitionTimeRef.current != null) {
      const elapsed = performance.now() - ignitionTimeRef.current;
      if (elapsed < IGNITION_SPARK_WINDOW_MS) {
        updateIgnitionSparks(elapsed);
      } else if (ignitionSparkDataRef.current.length > 0) {
        hideIgnitionSparks();
        ignitionSparkDataRef.current = [];
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
      {/* Drag-to-spin: the opaque saint decal occludes the flame once
          the wax drops behind it (~1/3 burn), which kills the vibe. The
          inner group lets users rotate the candle around Y to peek at
          the flame from the sides. X rotation is intentionally ignored
          so the candle can't be tilted off vertical. */}
      <group
        ref={candleSpinRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (onHoverChange) onHoverChange(true);
          if (typeof document !== "undefined") {
            const bg = document.querySelector(".scene-background");
            if (bg) bg.classList.add("candle-hover");
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          if (onHoverChange) onHoverChange(false);
          if (typeof document !== "undefined") {
            const bg = document.querySelector(".scene-background");
            if (bg) bg.classList.remove("candle-hover");
          }
        }}
      >
        <primitive object={scene} scale={variantConfig.scale} />
      </group>
      {/* Ambient + hemi fill so the candle has a strong omnidirectional
          base illumination. The parent StarfieldStatueScene has a fixed
          directional light that makes wax/wick look lit-from-one-side
          as the user drag-spins the candle; a healthy ambient floor
          flattens the rotation-dependent variance. Hemi adds a gentle
          warm-from-above / cool-from-below gradient so it doesn't read
          as a flat-lit plastic. */}
      <ambientLight intensity={0.6} color="#ffffff" />
      <hemisphereLight intensity={0.35} color="#ffd8b0" groundColor="#18202c" />
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
      {/* Ignition sparks — outward radial puff fired in the unlit→lit
          useEffect; the per-frame updater drives positions/colors off the
          ignition timestamp. Slightly higher renderOrder than the
          reconstitution swirl since ignition can fire while the reform
          tail is still painting (rapid relight after burnout). */}
      <points
        ref={ignitionSparksRef}
        renderOrder={262}
        frustumCulled={false}
        position={[0, 0, 0]}
      >
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={IGNITION_SPARK_COUNT}
            array={ignitionBuffers.position}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={IGNITION_SPARK_COUNT}
            array={ignitionBuffers.color}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={14}
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
const HERO_PULLQUOTE_INTERVAL_MS = 6800;
const HERO_PULLQUOTES = [
  {
    text: "Domina nostra perpetui lucri, ora pro nobis.",
    source: "Missale Degenorum",
    gloss: "Our Lady of Perpetual Profit, pray for us.",
    tone: "latin",
  },
  {
    text: "I've compared the markets to a church with a casino attached.",
    source: "Warren Buffett",
    tone: "modern",
  },
  {
    text: "Any sufficiently advanced technology is indistinguishable from magic.",
    source: "Arthur C. Clarke",
    tone: "modern",
  },
  {
    text: "The future is already here, it's just not evenly distributed.",
    source: "William Gibson",
    tone: "modern",
  },
    {
    text: "Every trade is a Hail Mary.",
    source: "",
    tone: "modern",
  },
];

function MobileSectionDropInTitle() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.01, margin: "200px 0px" });
  return (
    <div ref={ref} className="section-title-wrap">
      <DropInTitle
        lines={["PROSPER80", "FOR ALL", "HUMAN80!"]}
        colors={["#00ff00", "#f4e4c1", "#ffd700"]}
        fontSize={{ mobile: "3rem", desktop: "3.4rem" }}
        isMobile
        triggerAnimation={inView}
      />
    </div>
  );
}

export default function HomePage() {
  const [timeframeKey, setTimeframeKey] = useState("30m");
  const [heroPullquoteIndex, setHeroPullquoteIndex] = useState(0);
  const tfOpt =
    TIMEFRAME_OPTIONS.find((o) => o.key === timeframeKey) ||
    TIMEFRAME_OPTIONS[0];
  const data = useCandles({
    count: 12,
    days: tfOpt.days,
    aggregate: tfOpt.aggregate,
  });
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const userId = isConnected && address ? address.toLowerCase() : null;
  const [showAccountModal, setShowAccountModal] = useState(false);
  // RL80 holding gates the customization picker. Connected wallets with
  // zero balance still load+save their existing prefs (so a user who
  // sold their RL80 doesn't lose a previously-customized candle), but
  // the picker UI greys out until they hold RL80 again.
  const { data: rl80BalanceRaw } = useReadContract({
    address: RL80_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const hasRL80 = typeof rl80BalanceRaw === "bigint" && rl80BalanceRaw > 0n;
  const canCustomize = !!userId && hasRL80;
  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;
  // Signed-in "faithful" get the full 8-hour vigil; anonymous visitors
  // get a 1-minute preview that nudges them to sign in to extend it.
  // Keyed off userId (not isConnected directly) so the value is null
  // until both isConnected and address resolve — avoids a one-frame
  // flicker between wagmi state hydration and address availability.
  const meltDuration = userId ? MELT_DURATION_SIGNED_IN_MS : MELT_DURATION_ANON_MS;
  // Candle variant — everyone starts on the pillar. Signed-in users
  // can discover the votive (and future variants) through the picker;
  // their choice persists in localStorage. Starting on the pillar makes
  // the upgrade feel earned rather than auto-granted.
  const [candleVariantChoice, setCandleVariantChoice] = useState("pillar");
  const [showCandlePicker, setShowCandlePicker] = useState(false);
  // Per-user votive customization. `null` on both = use the baked-in
  // texture and authored wax color. Anon visitors never see the picker
  // so these stay null for them.
  const [votiveImage, setVotiveImage] = useState(null);
  const [votiveTint, setVotiveTint] = useState(null);
  // Quota error surface for the upload flow — "your image is too large
  // to save on this device" reads better than a silent no-op.
  const [votiveUploadError, setVotiveUploadError] = useState(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // 1) Local-first paint — reads are synchronous and keyed by userId,
    //    so a returning user sees their prior candle without waiting on
    //    the Firestore round-trip.
    const localVariant = readCandleVariant(userId);
    const localImage = readVotiveImage(userId);
    const localTint = readVotiveTint(userId);
    if (localVariant && CANDLE_VARIANTS[localVariant]) {
      setCandleVariantChoice(localVariant);
    } else {
      setCandleVariantChoice("pillar");
    }
    setVotiveImage(localImage);
    setVotiveTint(localTint);

    // 2) Remote reconciliation. Remote wins per-field when present;
    //    local-only fields (e.g. prefs picked pre-sign-in on this device)
    //    get mirrored up so other devices inherit them. A field set to
    //    `null` remotely is treated as "not set", not as an explicit
    //    clear — callers that want to reset always write the preset key
    //    (e.g. null image, null tint) explicitly.
    (async () => {
      const remote = await readCandlePrefs(userId);
      if (cancelled) return;
      const upstreamPatch = {};

      if (remote?.candleVariant && CANDLE_VARIANTS[remote.candleVariant]) {
        setCandleVariantChoice(remote.candleVariant);
      } else if (localVariant && CANDLE_VARIANTS[localVariant]) {
        upstreamPatch.candleVariant = localVariant;
      }

      if (typeof remote?.votiveImage !== "undefined") {
        setVotiveImage(remote.votiveImage);
        // Mirror remote down into local so subsequent reloads stay fast.
        writeVotiveImage(userId, remote.votiveImage);
      } else if (localImage) {
        upstreamPatch.votiveImage = localImage;
      }

      if (typeof remote?.votiveTint !== "undefined") {
        setVotiveTint(remote.votiveTint);
        writeVotiveTint(userId, remote.votiveTint);
      } else if (localTint) {
        upstreamPatch.votiveTint = localTint;
      }

      // Push any local-only prefs up to Firestore so this device's state
      // is the seed for future devices. Fire-and-forget — if the image
      // is oversize, writeCandlePrefs returns { ok: false }, which just
      // means Firestore won't carry the image; local continues working.
      if (Object.keys(upstreamPatch).length > 0) {
        writeCandlePrefs(userId, upstreamPatch);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
  const candleVariant = userId ? candleVariantChoice : "pillar";
  const router = useRouter();
  const [showBuyModal, setShowBuyModal] = useBuyModal();
  const [chartHovered, setChartHovered] = useState(false);
  const [candleObjectHovered, setCandleObjectHovered] = useState(false);
  const [candleLit, setCandleLit] = useState(false);
  const [litAt, setLitAt] = useState(null);
  // Post-ignition nudge shown only to anonymous visitors who just lit a
  // candle — frames sign-in as "save your flame" rather than a gate.
  const [showSignInNudge, setShowSignInNudge] = useState(false);
  const debugRef = useRef(null);
  // Holds the pending sign-in nudge timer so we can cancel it if the
  // user extinguishes before the delay elapses, or unmounts the page.
  // Without this the nudge could pop on a candle that's no longer lit.
  const nudgeTimerRef = useRef(null);
  useEffect(() => () => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
  }, []);
  useEffect(() => {
    if (HERO_PULLQUOTES.length < 2) return undefined;
    const id = setInterval(() => {
      setHeroPullquoteIndex(
        (current) => (current + 1) % HERO_PULLQUOTES.length,
      );
    }, HERO_PULLQUOTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  const heroPullquote =
    HERO_PULLQUOTES[heroPullquoteIndex] || HERO_PULLQUOTES[0];
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
          displayName: shortAddress,
          avatarUrl: null,
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
  }, [userId, shortAddress]);

  const doExtinguish = () => {
    if (userId) extinguishCandle(userId);
    else clearLocalCandle();
    setCandleLit(false);
    setLitAt(null);
    setShowSignInNudge(false);
    // Cancel a pending nudge so it doesn't fire on a now-dark candle.
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  };

  const doLight = () => {
    const now = Date.now();
    if (userId) {
      lightCandle(userId, {
        displayName: shortAddress,
        avatarUrl: null,
      });
    } else {
      writeLocalCandle(now);
      // Fire the nudge on every anon light. The once-per-device gate
      // we used to have here stranded users who dismissed it: with no
      // visible "connect wallet" surface elsewhere on the page, lighting
      // the candle again is their natural retry path. The 12s auto-dismiss
      // (plus the × button) keeps repeated lights from being noisy.
      //
      // Delay so the candle ignition FX have room to play uninterrupted
      // on small screens — without this the nudge slides in over the
      // flame burst and obscures the moment the user just triggered.
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = setTimeout(() => {
        setShowSignInNudge(true);
        nudgeTimerRef.current = null;
      }, 3500);
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
    if (!canCustomize) return;
    writeCandleVariant(userId, variant);
    setCandleVariantChoice(variant);
    writeCandlePrefs(userId, { candleVariant: variant });
    setShowCandlePicker(false);
    // Only auto-light when the user was unlit at pick-time — tapping
    // the picker mid-burn should swap the model without resetting the
    // litAt timer. The model swap happens automatically when the
    // variant prop changes on HeroAltarObject.
    if (!candleLit) doLight();
  };

  // Commit a votive image choice. `src == null` clears the preference
  // (restores the baked-in Guadalupe texture). Picker stays open so the
  // user can tweak tint + image together without re-opening.
  const handlePickVotiveImage = (src) => {
    if (!canCustomize) return;
    setVotiveUploadError(null);
    setVotiveImage(src ?? null);
    writeVotiveImage(userId, src ?? null);
    // Preset images are plain URLs well under the size cap — fire-and-
    // forget. A `null` src clears both local and remote.
    writeCandlePrefs(userId, { votiveImage: src ?? null });
  };

  // Upload a user-supplied image. Three transforms applied before it
  // hits localStorage:
  //   1. Center-crop to the senora decal's ~2:3 portrait aspect so a
  //      square selfie doesn't get UV-squished onto the candle.
  //   2. Downscale to max 1024px on the long edge — enough resolution
  //      to read cleanly on the curved glass even when the user zooms
  //      in via OrbitControls. Typical 1024px JPEG @ 0.88 is ~200-500KB,
  //      which sits safely under the Firestore doc cap (900KB).
  //   3. Re-encode as JPEG at 0.88 with high-quality smoothing so the
  //      downsample doesn't introduce the soft blur that lower
  //      quality / default canvas smoothing produced before.
  const handleUploadVotiveImage = async (file) => {
    if (!file) return;
    if (!canCustomize) return;
    setVotiveUploadError(null);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image decode failed"));
        el.src = dataUrl;
      });
      // Center-crop source rect to target aspect. If the image is wider
      // than the target ratio we trim width; if taller, we trim height.
      const TARGET_ASPECT = 2 / 3; // width / height — portrait
      const imgAspect = img.width / img.height;
      let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
      if (imgAspect > TARGET_ASPECT) {
        srcW = Math.round(img.height * TARGET_ASPECT);
        srcX = Math.round((img.width - srcW) / 2);
      } else if (imgAspect < TARGET_ASPECT) {
        srcH = Math.round(img.width / TARGET_ASPECT);
        srcY = Math.round((img.height - srcH) / 2);
      }
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      // Without these, Chrome/Safari use a cheap box filter that softens
      // edges noticeably on portrait crops. High-quality smoothing is a
      // single-pass lanczos-ish resample — worth the minor CPU cost for
      // a one-shot upload.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.88);
      // Round-trip through writeVotiveImage so QuotaExceeded surfaces here.
      try {
        window.localStorage.setItem(
          VOTIVE_IMAGE_STORAGE_PREFIX + userId,
          compressed,
        );
      } catch {
        setVotiveUploadError(
          "Image too large to save on this device — try a smaller one.",
        );
        return;
      }
      setVotiveImage(compressed);
      // Sync to Firestore so the upload follows the user across devices.
      // writeCandlePrefs guards oversize payloads and returns a reason
      // when it can't write them; in that case the image still lives on
      // this device but we warn so the expectation matches reality.
      const result = await writeCandlePrefs(userId, {
        votiveImage: compressed,
      });
      if (result && !result.ok && result.reason === "image-too-large") {
        setVotiveUploadError(
          "Image saved on this device, but it's too large to sync to your other devices.",
        );
      }
    } catch {
      setVotiveUploadError("Couldn't read that image.");
    }
  };

  // Commit a wax tint. `hex == null` clears the preference.
  const handlePickVotiveTint = (hex) => {
    if (!canCustomize) return;
    setVotiveTint(hex ?? null);
    writeVotiveTint(userId, hex ?? null);
    writeCandlePrefs(userId, { votiveTint: hex ?? null });
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
          scrollDepth
        >
          <HeroAltarObject
            candleLit={candleLit}
            litAt={litAt}
            meltDuration={meltDuration}
            variant={candleVariant}
            onBurnedOut={doExtinguish}
            debugRef={debugRef}
            votiveImage={votiveImage}
            votiveTint={votiveTint}
            onHoverChange={setCandleObjectHovered}
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

      <div className="below-fold-chamber">
        <div className="hero-intro-chart">
          <div
            className="shrine-stage"
            onMouseEnter={() => setChartHovered(true)}
            onMouseLeave={() => setChartHovered(false)}
          >
            <ChartShrine
              {...data}
              palette="chrome"
              timeframeKey={timeframeKey}
              onTimeframeChange={setTimeframeKey}
            />
          </div>
        </div>

        <MobileSectionDropInTitle />
        <div className="hero-copy hero-copy--below-fold">
          <blockquote
            className="hero-pullquote"
            title={heroPullquote.gloss || undefined}
          >
            <p
              key={heroPullquoteIndex}
              className={`hero-pullquote-latin${
                heroPullquote.tone === "modern" ? " hero-pullquote-modern" : ""
              }`}
              aria-live="polite"
            >
              {heroPullquote.tone === "modern"
                ? `"${heroPullquote.text}"`
                : heroPullquote.text}
            </p>
            <cite className="hero-pullquote-source">
              {heroPullquote.source}
            </cite>
            {heroPullquote.gloss ? (
              <span className="hero-pullquote-gloss" aria-hidden="true">
                {heroPullquote.gloss}
              </span>
            ) : null}
          </blockquote>
          <p className="hero-intro">
Stake RL80 for rewards, or stake a claim with The Hail Mary Prospecting Co. Sharpen your discernment against scams in the Liminal Terminal, or scan any token for multidimensional review — spiritual verdict included. RL80 is the utility token of her order.
</p>
        </div>

        <div className="section-divider" role="separator" aria-hidden="true">
          <span className="section-divider-line section-divider-line--left" />
          <span className="section-divider-icon">&#x2020;</span>
          <span className="section-divider-line section-divider-line--right" />
        </div>

        <MaterExMachinaSection />

        <div className="section-divider" role="separator" aria-hidden="true">
          <span className="section-divider-line section-divider-line--left" />
          <span className="section-divider-icon">&#x2020;</span>
          <span className="section-divider-line section-divider-line--right" />
        </div>

        <HolyTrinSection />

        <div className="section-divider" role="separator" aria-hidden="true">
          <span className="section-divider-line section-divider-line--left" />
          <span className="section-divider-icon">&#x2021;</span>
          <span className="section-divider-line section-divider-line--right" />
        </div>

        {/* <BusinessSection /> */}

        {/* Trading Card Game section parked for now — keep the imports
            and component file intact so we can re-enable when ready.
        <div className="section-divider" role="separator" aria-hidden="true">
          <span className="section-divider-line section-divider-line--left" />
          <span className="section-divider-icon">∞</span>
          <span className="section-divider-line section-divider-line--right" />
        </div>

        <ReliquaryRail />
        */}
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
          <p className="flame-nudge-sub">Connect a wallet and your votive:</p>
          <ul className="flame-nudge-benefits">
            <li>Burns 8 hours, not 1 minute</li>
            <li>Follows you across every device</li>
            <li>Unlocks the votive — customize image &amp; wax color</li>
          </ul>
          <div className="flame-nudge-actions">
            <button
              type="button"
              className="shrine-btn primary flame-nudge-cta"
              onClick={() => {
                setShowSignInNudge(false);
                setShowAccountModal(true);
              }}
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
          className={`flame-nudge candle-picker-popup${
            canCustomize ? "" : " is-locked"
          }`}
          role="dialog"
          aria-label="Choose your candle"
        >
          <p className="flame-nudge-title">Choose your candle</p>
          {!canCustomize && (
            <div className="candle-picker-lock">
              <p className="candle-picker-lock-text">
                Hold any RL80 to customize your candle.
              </p>
              <button
                type="button"
                className="shrine-btn primary candle-picker-lock-cta"
                onClick={() => {
                  setShowCandlePicker(false);
                  setShowBuyModal(true);
                }}
              >
                Buy RL80
              </button>
            </div>
          )}
          <div className="candle-picker-tiles">
            <button
              type="button"
              disabled={!canCustomize}
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
              disabled={!canCustomize}
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

          {/* Votive-only personalization. Only reached when the user has
              picked (or is currently on) the votive variant; otherwise the
              pillar-only flow skips this block entirely. */}
          {candleVariantChoice === "votive" && (
            <div className="votive-customize">
              <p className="votive-customize-heading">Image</p>
              <div className="votive-image-presets">
                {VOTIVE_IMAGE_PRESETS.map((preset) => {
                  const isActive =
                    (preset.src == null && !votiveImage) ||
                    (preset.src != null && votiveImage === preset.src);
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className={`votive-image-tile${isActive ? " is-active" : ""}`}
                      onClick={() => handlePickVotiveImage(preset.src)}
                      title={preset.label}
                      aria-label={preset.label}
                    >
                      {preset.thumbnail || preset.src ? (
                        <img src={preset.thumbnail ?? preset.src} alt="" />
                      ) : (
                        <span className="votive-image-tile-default">✨</span>
                      )}
                      <span className="votive-image-tile-label">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
                {(() => {
                  const hasCustomUpload =
                    votiveImage &&
                    !VOTIVE_IMAGE_PRESETS.some((p) => p.src === votiveImage);
                  return (
                    <label
                      className={`votive-image-tile votive-image-upload${
                        hasCustomUpload ? " is-active" : ""
                      }`}
                      title="Upload your own"
                    >
                      {hasCustomUpload ? (
                        <img src={votiveImage} alt="" />
                      ) : (
                        <span className="votive-image-tile-default">+</span>
                      )}
                      <span className="votive-image-tile-label">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadVotiveImage(file);
                          // Reset so re-selecting the same file fires change again.
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                      {hasCustomUpload && (
                        /* Clear the custom upload without triggering the
                           file picker. stopPropagation + preventDefault
                           keep the wrapping <label> from forwarding the
                           click to its hidden <input>. */
                        <button
                          type="button"
                          className="votive-image-clear"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePickVotiveImage(null);
                          }}
                          aria-label="Clear uploaded image"
                          title="Clear uploaded image"
                        >
                          ×
                        </button>
                      )}
                    </label>
                  );
                })()}
              </div>
              <p className="votive-upload-hint">
                Portrait images (~2:3) look best. Uploads are resized and
                saved only on this device.
              </p>
              {votiveUploadError && (
                <p className="votive-upload-error">{votiveUploadError}</p>
              )}

              <p className="votive-customize-heading">Wax color</p>
              <div className="votive-tint-swatches">
                {VOTIVE_TINT_PRESETS.map((preset) => {
                  const isActive =
                    (preset.hex == null && !votiveTint) ||
                    (preset.hex != null &&
                      votiveTint?.toLowerCase() === preset.hex.toLowerCase());
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className={`votive-tint-swatch${
                        preset.hex == null ? " votive-tint-swatch--natural" : ""
                      }${isActive ? " is-active" : ""}`}
                      onClick={() => handlePickVotiveTint(preset.hex)}
                      title={preset.label}
                      aria-label={preset.label}
                      style={
                        preset.hex
                          ? { background: preset.hex }
                          : undefined
                      }
                    >
                      {preset.hex == null && (
                        /* Flame glyph — reads as "the candle's own color"
                           so the reset swatch looks native to the shrine
                           rather than a "no-access" slash. */
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          style={{ width: 14, height: 14 }}
                        >
                          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </svg>
                      )}
                    </button>
                  );
                })}
                {/* Free-form hex picker. Syncs back to votiveTint so the
                    active-swatch highlight updates if the user happens to
                    land on a preset value. */}
                <label
                  className="votive-tint-swatch votive-tint-custom"
                  title="Custom color"
                >
                  <input
                    type="color"
                    value={votiveTint ?? "#ffffff"}
                    onChange={(e) => handlePickVotiveTint(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

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
              disconnect();
              // Re-open the wallet modal so the user can reconnect a
              // different wallet right away — common path when someone
              // disconnects to switch to one that holds RL80. Without
              // this they'd be stranded with no visible re-connect surface.
              setShowAccountModal(true);
            }}
          >
            Disconnect wallet
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
        centerHighlight={candleObjectHovered}
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
        /* Menu slot routes to /exlibris. */
        onMenuClick={() => router.push('/exlibris')}
        menuIcon={
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
        menuLabel="EX LIBRIS"
        isUserSignedIn={isConnected}
        show80sButton={false}
        isMobile
        is80sMode
        /* Book slot (left of center) is the BUY button — placed nearer
           to the chart so buying intent and action sit in the same zone.
           Pulses while the chart is hovered to tie intent to action. */
        onBookClick={() => setShowBuyModal(true)}
        bookHighlight={chartHovered}
        bookLabel="BUY"
        bookIcon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: "#d4a854" }}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
        extraLeft={[
          {
            key: 'terminal',
            label: 'Terminal',
            title: 'The Liminal Terminal',
            onClick: () => { window.location.href = '/trade'; },
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#39ff14"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  width: 24,
                  height: 24,
                  display: 'block',
                  filter: 'drop-shadow(0 0 4px rgba(57, 255, 20, 0.7))',
                }}
                aria-hidden="true"
              >
    
<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
 
              </svg>
            ),
          },
        ]}
        extraRight={[
          {
            key: 'lode',
            label: 'Hail Mary PC',
            title: 'Hail Mary Prospecting Co — coming soon',
              onClick: () => { window.location.href = '/oil'; },
            comingSoon: false,
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

      <UnifiedAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        initialTab="wallet"
      />

      {/* <div ref={debugRef} className="candle-debug" /> */}

      {/* Social Links - Bottom Right */}
      {/* The `social-stack` class opts this container out of the
         `.shrine-page.neon > *:not(...)` rule in chart-shrine.css that
         force-sets `position: relative` on direct children of <main>.
         Without it, our inline `position: fixed` was being overridden
         on mobile, causing the icons to render mid-page (where the user
         scrolled to) instead of pinned to the viewport — and taps on
         the right side opened x.com / t.me / farcaster.xyz tabs. */}
      <div
        className="social-stack"
        style={{
          position: "fixed",
          bottom: isMobileDevice ? "10rem" : "5rem",
          right: "2rem",
          left: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          zIndex: 1001,
          pointerEvents: hideSocials ? "none" : "auto",
          opacity: hideSocials ? 0 : 1,
          /* visibility is inherited and disables hit-testing on
             descendants — pointer-events:none on this container alone
             didn't, because each <a> child has its own implicit
             pointer-events:auto. Delaying the visibility change until
             the opacity fade completes preserves the smooth hide. */
          visibility: hideSocials ? "hidden" : "visible",
          transition: hideSocials
            ? "opacity 0.3s ease, visibility 0s linear 0.3s"
            : "opacity 0.3s ease, visibility 0s linear 0s",
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
