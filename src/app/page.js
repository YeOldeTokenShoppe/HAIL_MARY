"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGLTF, Stats } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUser, useClerk } from "@clerk/nextjs";
import ChartShrine, { TIMEFRAME_OPTIONS } from "@/components/ChartShrine";
import MobileBottomNav from "@/components/MobileBottomNav";
import BuyModal from "@/components/BuyModal";
import TestimonialToasts from "@/components/TestimonialToasts";
import InscribeModal from "@/components/InscribeModal";
import LittleBookOverlay from "@/components/LittleBookOverlay";
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

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.translateX(isMobileRef.current ? -0.04 : 0.15);
    groupRef.current.translateY(-1.0);
    groupRef.current.translateZ(-1.1);

    // Melt the candle over the lit window. Flame + wick are parented to
    // the melt mesh, so they follow automatically. The floor is 1% of
    // baseline so the candle leaves a sliver at full burn. Use
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
      const shrink = Math.max(axisBase * 0.01, axisBase * (1 - progress));
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

      // Fully melted — burn out once, let parent clear state.
      if (progress >= 1 && !burnedOutFiredRef.current) {
        burnedOutFiredRef.current = true;
        onBurnedOut?.();
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
      <pointLight
        ref={warmLightRef}
        position={[0, 0.15, 0.35]}
        intensity={WARM_BASE_INTENSITY}
        color="#ffb36b"
        distance={2}
      />
      {/* Subtle cool accent for the neon frame. */}
      {/* <pointLight
        position={[0, 0.5, 0.1]}
        intensity={0.5}
        color="#2ad6ee"
        distance={1.5}
      /> */}
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
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showInscribeModal, setShowInscribeModal] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const [candleLit, setCandleLit] = useState(false);
  const [litAt, setLitAt] = useState(null);
  // Post-ignition nudge shown only to anonymous visitors who just lit a
  // candle — frames sign-in as "save your flame" rather than a gate.
  const [showSignInNudge, setShowSignInNudge] = useState(false);
  const debugRef = useRef(null);

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
      setShowSignInNudge(true);
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
            "GET LIT"
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
           candle inscribe modal instead. */
        onBookClick={() => setShowBook(true)}
        bookLabel="BOOK OF RL80"
      />

      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />

      <LittleBookOverlay
        isOpen={showBook}
        onClose={() => setShowBook(false)}
      />

      <TestimonialToasts onInscribeClick={() => setShowInscribeModal(true)} />

      <InscribeModal
        isOpen={showInscribeModal}
        onClose={() => setShowInscribeModal(false)}
        candleLit={candleLit}
      />

      {/* <div ref={debugRef} className="candle-debug" /> */}
    </main>
  );
}
