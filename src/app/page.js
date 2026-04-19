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

// useGLTF.preload("/models/JustCandle.glb");

const StarfieldStatueScene = dynamic(
  () => import("@/components/StarfieldStatueScene"),
  { ssr: false }
);

// Melt window — 1 minute for testing; flip back to `24 * 60 * 60 * 1000` for prod.
const MELT_DURATION_MS = 24 * 60 * 60 * 1000;

// Compact remaining-time label for the CANDLE FAB countdown. HH:MM:SS
// always so the ticking seconds confirm the clock is live.
function formatRemaining(litAtMs) {
  const remaining = Math.max(0, MELT_DURATION_MS - (Date.now() - litAtMs));
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
const WAX_BASELINE_CACHE = new WeakMap();

// Personalized altar overlay — camera-anchored so it stays in a fixed screen
// position while the crane shot orbits. Single Canvas, no extra WebGL context.
// Base intensity of the warm candle fill light — flicker and ignition
// pulse are computed relative to this.
const WARM_BASE_INTENSITY = 0.2;

function HeroAltarObject({ candleLit = false, litAt = null, onBurnedOut, debugRef }) {
  const { scene } = useGLTF("/models/JustCandle.glb");
  const groupRef = useRef();
  const isMobileRef = useRef(false);
  // Wax mesh + its baseline scale.y — flame/wick are parented to it, so
  // shrinking the wax shrinks the whole candle column together.
  const waxRef = useRef(null);
  const baseWaxScaleYRef = useRef(1);
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
      if (obj.name && obj.name.toUpperCase() === "WAX") {
        waxRef.current = obj;
        if (!WAX_BASELINE_CACHE.has(obj)) {
          WAX_BASELINE_CACHE.set(obj, obj.scale.y);
        }
        const base = WAX_BASELINE_CACHE.get(obj);
        baseWaxScaleYRef.current = base;
        obj.scale.set(base, base, base);
        obj.matrixAutoUpdate = true;
      }
    });
  }, [scene]);

  // The GLB ships with FLAME hidden; toggle it + all descendants based on
  // whether the user has lit the candle.
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj.name && obj.name.toUpperCase().includes("FLAME")) {
        obj.visible = candleLit;
        obj.traverse((child) => {
          child.visible = candleLit;
        });
      }
    });
  }, [scene, candleLit]);

  // When the candle is extinguished, reset the wax to its full baseline.
  // Use set() to trigger the matrix-dirty onChange hook.
  useEffect(() => {
    if (!candleLit && waxRef.current) {
      const base = baseWaxScaleYRef.current;
      waxRef.current.scale.set(base, base, base);
    }
  }, [candleLit]);

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

    // Melt the wax over the lit window. Flame + wick are parented to Wax,
    // so they follow automatically. The floor is 1% of baseline so the
    // candle leaves a sliver at full burn. Use scale.set() rather than
    // scale.y = X — direct property assignment bypasses the onChange hook
    // that flags the matrix dirty, so the visible mesh wouldn't update.
    // NOTE: melting along the Z axis because the Wax mesh appears to be
    // oriented with its height along local Z (Blender rotation).
    if (candleLit && litAt && waxRef.current) {
      const base = baseWaxScaleYRef.current;
      const elapsed = Date.now() - litAt;
      const progress = Math.min(elapsed / MELT_DURATION_MS, 1.0);
      const shrink = Math.max(base * 0.01, base * (1 - progress));
      waxRef.current.scale.set(base, base, shrink);

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
        const base = baseWaxScaleYRef.current;
        const elapsed = candleLit && litAt ? Date.now() - litAt : 0;
        const progress = Math.min(elapsed / MELT_DURATION_MS, 1.0);
        const scaleY = waxRef.current?.scale.y ?? base;
        debugRef.current.textContent =
          `lit: ${candleLit} | elapsed: ${(elapsed / 1000).toFixed(1)}s ` +
          `| progress: ${progress.toFixed(3)} ` +
          `| base: ${base.toFixed(5)} | scale.y: ${scaleY.toFixed(6)}`;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Backlight glow plane removed — the CanvasTexture + depthTest:false
          + additive-blended plane combo produced blocky render artifacts
          around the statue area on iOS Safari. Candle is readable without
          it thanks to the flame's own emissive materials. */}
      <primitive object={scene} scale={1.2} />
      {/* Warm candle-side fill — drives ignition flash + ongoing flicker. */}
      <pointLight
        ref={warmLightRef}
        position={[0, 0.15, 0.35]}
        intensity={WARM_BASE_INTENSITY}
        color="#ffb36b"
        distance={2}
      />
      {/* Subtle cool accent for the neon frame. */}
      <pointLight
        position={[0, 0.5, 0.1]}
        intensity={0.5}
        color="#2ad6ee"
        distance={1.5}
      />
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
  const { openSignIn } = useClerk();
  const userId = user?.id ?? null;
  const [showBuyModal, setShowBuyModal] = useState(false);
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
          Date.now() - local.litAtMs < MELT_DURATION_MS
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

      const remoteLive =
        remote?.litAtMs && Date.now() - remote.litAtMs < MELT_DURATION_MS;
      const localLive =
        local?.litAtMs && Date.now() - local.litAtMs < MELT_DURATION_MS;

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

  const toggleCandle = () => {
    if (candleLit) {
      doExtinguish();
      return;
    }
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
      const p = Math.min((Date.now() - litAt) / MELT_DURATION_MS, 1);
      setMeltProgress(p);
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [candleLit, litAt]);

  return (
    <main className="shrine-page neon" style={{ background: "#000" }}>
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
            onBurnedOut={doExtinguish}
            debugRef={debugRef}
          />
          <Stats className="r3f-stats" />
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
A refuge for the rekt, a liturgy for the ledger, a confessional for your worst trades. RL80 is the token of her order. The faithful are known by their bags. </p>
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
          <p className="flame-nudge-text">
            Your flame is burning. Sign in to save it to the shrine ledger.
          </p>
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

      <MobileBottomNav
        /* Reduced to 3 slots: LOGIN (account) | CANDLE (center FAB) | BUY
           (menu slot). Music and Wallet slots are suppressed. */
        hideWallet
        accountOnLeft
        /* Repurpose the center FAB as the candle light toggle. */
        onBuyClick={toggleCandle}
        centerLabel={
          candleLit ? (
            "LIT"
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
                {formatRemaining(litAt)}
              </span>
            </span>
          ) : (
            "CANDLE"
          )
        }
        centerTitle={candleLit ? "Extinguish candle" : "Light candle"}
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
      />

      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />

      {/* <div ref={debugRef} className="candle-debug" /> */}
    </main>
  );
}
