"use client";

import { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrbitControls, Cloud, Clouds, useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CleanCanvas from "@/components/canvas/CleanCanvas";
import { Perf } from "r3f-webgpu-perf";
import OilVoxelGrid, { CctvRenderer } from "@/components/OilVoxelGrid";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { REFERRAL_BONUS } from "@/lib/oilBonusMath";
import { couponValid, couponDaysLeft } from "@/lib/oilTicket";
import OilAnchorEvent from "@/components/OilAnchorEvent";
import OilAwayRecap from "@/components/OilAwayRecap";
import usePushAlerts from "@/hooks/usePushAlerts";
import PimpMyPumpPanel, { getDefaultPumpConfig } from "@/components/PimpMyPumpPanel";
import { panelChrome, PanelSection, PanelTitle, PANEL_ICONS } from "@/components/HailMaryPanel";
import DailyTicketPanel from "@/components/DailyTicketPanel";
import OilWelcomeModal from "@/components/OilWelcomeModal";
import VendorSitePalHost from "@/components/VendorSitePalHost";
import { setVendorGreetingContext } from "@/lib/vendorSitePal";
import OilOverlayModal from "@/components/OilOverlayModal";
import { useUser, useClerk } from "@clerk/nextjs";
import { useWalletAuth } from "@/components/WalletAuthProvider";
import { useMusic } from "@/components/MusicContext";
import NavControlsHome from "@/components/NavControlsHome";
import MobileBottomNav from "@/components/MobileBottomNav";
import BuyModal from "@/components/BuyModal";
import CyberNav from "@/components/CyberNav";
import PolaroidSnapshot from "@/components/PolaroidSnapshot";
import StarField from "@/components/StarField";
import ConstellationModel from '@/components/ConstellationModel';
import Fireworks from "@/components/Fireworks";
import { db, storage, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, ref, uploadBytes, getDownloadURL, onSnapshot, collection, query, where, orderBy, limit, addDoc, runTransaction, arrayUnion, getDocs, deleteDoc } from "@/lib/firebaseClient";
import RogueAdminPanel from "@/components/RogueAdminPanel";
import useCctvRecorder from "@/hooks/useCctvRecorder";
import PumpPurchaseModal from "@/components/PumpPurchaseModal";
import { UnifiedAccountModal } from "@/components/UnifiedAccountModal";

// ── Milestone caption pools ──────────────────────────────────────────────────
// Randomized per capture so the feed doesn't read the same with only 2 event
// types. The chosen caption is set once into the polaroid meta and flows through
// to the saved/published feed entry. (Admins can still hand-edit before publish.)
const GUSHER_CAPTIONS = [
  "BETROLEUM STRIKE! 💸",
  "PAYDIRT! 💸",
  "THAR SHE BLOWS! 🛢️",
  "GUSHER! 💦",
  "RICH STRIKE — DRINKS ON ME! 🥂",
  "FROM ZERO TO BETROLEUM BARON 📈",
  "DIVERSIFYING THE PORTFOLIO 💸",
];
const HELL_CAPTIONS = [
  "JUST TRYING TO MAKE A BUCK — DIDN'T MEAN TO UNLEASH HELL 🔥👹",
  "WHO SUMMONED THIS THING 👹",
  "MY INVESTMENT WENT STRAIGHT TO HELL 🔥",
  "BREACHED A HELL POCKET 😈",
  "OOPS. THAT'S A DEMON. 🔥👹",
  "DRILLED TOO GREEDY, TOO DEEP 👹",
];
const pickCaption = (eventType) => {
  const pool = eventType === "hell" ? HELL_CAPTIONS : GUSHER_CAPTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
};

// ── Environment presets ──────────────────────────────────────────────────────
// Which scene a visitor with no saved preference opens on, from their LOCAL
// clock. There is no dawn preset, so early morning borrows dusk — the sky reads
// the same either side of the sun. Boundaries are deliberately generous at the
// edges: nobody should open on a blazing noon sky at 7pm.
//   20:00-05:59  night
//   06:00-07:59  dusk (dawn)
//   08:00-17:59  day
//   18:00-19:59  dusk
function presetForHour(h) {
  if (h >= 20 || h < 6) return "night";
  if (h < 8 || h >= 18) return "dusk";
  return "day";
}

const ENV_PRESETS = {
  day:   { sky: "#7da4c9", skyBottom: null, ambient: 0.6, dirA: 4.0, dirB: 3.0, point: "#4488ff", cloudOpacity: 0.2, fog: null, hemi: null },
  solstice: { sky: "#36aee2", skyBottom: "#aee6c0", ambient: 0.82, dirA: 5.2, dirB: 2.4, dirAColor: "#fff2b8", dirBColor: "#7fd8ff", point: "#ffd45a", cloudOpacity: 0.34, fog: "#d8c86a", hemi: { sky: "#80ddff", ground: "#e6b758", intensity: 0.72 } },
  dusk:  { sky: "#8b7faa", skyBottom: "#d4b8a0", ambient: 0.7, dirA: 4.0,  dirB: 2.0,  point: "#cc9966", cloudOpacity: 0.25, fog: "#c4a88e", hemi: { sky: "#9088aa", ground: "#d4b8a0", intensity: 0.5 } },
  night: { sky: "#0a0e1a", skyBottom: null, ambient: 0.38, dirA: 1.1, dirB: 0.6, dirAColor: "#aac4ff", dirBColor: "#6a80c0", point: "#2244aa", cloudOpacity: 0.08, fog: "#0a0e1a", hemi: { sky: "#2e3650", ground: "#161824", intensity: 0.4 } },
  hell:  { sky: "#1a0808", skyBottom: "#6b1a05", ambient: 0.2, dirA: 0.8, dirB: 0.4, point: "#ff2200", cloudOpacity: 0.4, fog: "#1a0505", hemi: { sky: "#3a0800", ground: "#150000", intensity: 0.35 } },
  // Self-contained scene for Parabolum — an arcane violet twilight. Brighter
  // ambient than night (which left the ground near-black) so the field reads,
  // with violet key/fill/point lights to match the Parabolum console.
  parabolumEnv: { sky: "#1a0f2e", skyBottom: "#3a1f5c", ambient: 0.55, dirA: 2.4, dirB: 1.2, dirAColor: "#e8d0ff", dirBColor: "#9a7ad6", point: "#a45cff", cloudOpacity: 0.2, fog: "#1f1438", hemi: { sky: "#4a2d7a", ground: "#2a1f3a", intensity: 0.55 } },
};

// ── Theme color maps (UI only — 3D canvas unaffected) ────────────────────────
const THEMES = {
  light: {
    bg: "#f5efe6", text: "#44392c", textStrong: "#2e2010", accent: "#5a4010",
    muted: "#6e6050", border: "#d4c8b4", borderLight: "#c8bfb0",
    panelBg: "rgba(245,239,230,0.95)", headerBg: "rgba(245,239,230,0.97)",
    inputBg: "#f0e8dc", barBg: "#e8e0d4", tintBg: "rgba(180,160,130,0.08)",
    green: "#3a7a20", greenBg: "rgba(90,138,58,0.06)",
    warn: "#903820", red: "#b03030",
    gold: "#d4a854", goldBorder: "#b8922e",
    scanline: "rgba(0,0,0,0.02)",
    statusText: "#4a6a30", seedLabel: "#5e5040", seedValue: "#5e5040",
    rankClaim: "#504030", rankOil: "#44392c", rankBarBg: "#e0d8cc",
    inspectorKey: "#5e5040", depthUndrilled: "#7e7560",
    btnText: "#504030", btnBg: "rgba(180,160,130,0.1)",
    cornerBorder: "rgba(139,105,20,0.3)",
  },
  dark: {
    bg: "#12161c", text: "#b0bcc8", textStrong: "#d4dce4", accent: "#d4a854",
    muted: "#6a7888", border: "#242c38", borderLight: "#1e2630",
    panelBg: "rgba(18,22,28,0.95)", headerBg: "rgba(18,22,28,0.97)",
    inputBg: "#1a2028", barBg: "#1e2630", tintBg: "rgba(80,120,160,0.06)",
    green: "#6aaa6a", greenBg: "rgba(90,138,90,0.1)",
    warn: "#cc7755", red: "#e06060",
    gold: "#d4a854", goldBorder: "#b8922e",
    scanline: "rgba(255,255,255,0.02)",
    statusText: "#7aaa7a", seedLabel: "#6a7888", seedValue: "#7a8898",
    rankClaim: "#8a98a8", rankOil: "#b0bcc8", rankBarBg: "#242c38",
    inspectorKey: "#7a8898", depthUndrilled: "#404a58",
    btnText: "#b0bcc8", btnBg: "rgba(80,120,160,0.12)",
    cornerBorder: "rgba(212,168,84,0.2)",
  },
  solsticeLight: {
    bg: "#f6edce", text: "#4c422e", textStrong: "#241b0c", accent: "#0c7786",
    muted: "#756c55", border: "rgba(156,132,72,0.42)", borderLight: "rgba(78,177,190,0.28)",
    panelBg: "rgba(255,248,222,0.91)", headerBg: "rgba(255,246,215,0.95)",
    inputBg: "rgba(255,253,236,0.82)", barBg: "rgba(210,190,128,0.24)", tintBg: "rgba(47,168,188,0.075)",
    green: "#2f8f55", greenBg: "rgba(47,143,85,0.1)",
    warn: "#b46618", red: "#b64230",
    gold: "#e0ad3c", goldBorder: "#b98218",
    scanline: "rgba(17,109,126,0.025)",
    statusText: "#2f8f55", seedLabel: "#7b693d", seedValue: "#0c7786",
    rankClaim: "#776843", rankOil: "#4c422e", rankBarBg: "rgba(217,196,128,0.32)",
    inspectorKey: "#7b693d", depthUndrilled: "#9e9066",
    btnText: "#315b5f", btnBg: "rgba(47,168,188,0.1)",
    cornerBorder: "rgba(12,119,134,0.35)",
    panelWash: "linear-gradient(135deg, rgba(255,255,245,0.72) 0%, rgba(255,244,199,0.88) 48%, rgba(219,246,231,0.68) 100%)",
    panelLine: "linear-gradient(90deg, rgba(12,119,134,0.02), rgba(12,119,134,0.18), rgba(224,173,60,0.18), rgba(12,119,134,0.02))",
    statWash: "linear-gradient(135deg, rgba(255,255,241,0.72), rgba(255,232,162,0.2) 55%, rgba(83,188,198,0.12))",
    softShadow: "inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 28px rgba(151,116,29,0.08)",
    // Surface-map / cross-section backgrounds — light cyan to match the teal
    // accent font (instead of the default cream). mapBg = container, mapEmpty =
    // undrilled/empty cells. Other themes leave these unset → cream fallback.
    mapBg: "#cfe9eb", mapEmpty: "#e3f4f4",
  },
  // Parabolum (dark) — arcane violet reskin. The "extracted material" stops
  // reading as crude oil and becomes a mysterious glowing fluid; the prospecting
  // UI shifts to a deep-indigo console lit by violet/lilac glow. Independent of
  // the day/dusk/night/hell env presets (toggled separately from time-of-day).
  parabolumDark: {
    bg: "#0c0717", text: "#b9a3d6", textStrong: "#e6d4ff", accent: "#b07bff",
    muted: "#7a6a9c", border: "#2a1d44", borderLight: "#221836",
    panelBg: "rgba(14,8,26,0.95)", headerBg: "rgba(14,8,26,0.97)",
    inputBg: "#1a1030", barBg: "#1e1436", tintBg: "rgba(123,45,214,0.1)",
    green: "#5ad6b0", greenBg: "rgba(90,214,176,0.12)",
    warn: "#e0913c", red: "#ff5c93",
    gold: "#c79bff", goldBorder: "#7b2dd6",
    scanline: "rgba(199,123,255,0.035)",
    statusText: "#8ad6c0", seedLabel: "#8a7aae", seedValue: "#a892c8",
    rankClaim: "#a892c8", rankOil: "#c9b3e6", rankBarBg: "#241836",
    inspectorKey: "#8a7aae", depthUndrilled: "#4a3a66",
    btnText: "#c9b3e6", btnBg: "rgba(123,45,214,0.16)",
    cornerBorder: "rgba(164,92,255,0.3)",
  },
};

// ── Sky dome gradient ────────────────────────────────────────────────────────
const skyGradientShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition).y;
      float t = smoothstep(-0.1, 0.6, h);
      gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
    }
  `,
};

const SkyDome = memo(function SkyDome({ skyColor = "#7da4c9", skyBottom = null, cloudOpacity = 0.2, hell = false }) {
  const topCol = useMemo(() => new THREE.Color(skyColor), [skyColor]);
  const bottomCol = useMemo(() => skyBottom ? new THREE.Color(skyBottom) : null, [skyBottom]);
  const uniforms = useMemo(() => ({
    topColor: { value: topCol },
    bottomColor: { value: bottomCol ?? topCol },
  }), []); // stable ref — update values below

  useEffect(() => {
    uniforms.topColor.value = topCol;
    uniforms.bottomColor.value = bottomCol ?? topCol;
  }, [topCol, bottomCol, uniforms]);

  const cloudColor = hell ? "#3a0000" : undefined;

  return (
    <group>
      <mesh>
        <sphereGeometry args={[300, 24, 24]} />
        {bottomCol ? (
          <shaderMaterial
            side={THREE.BackSide}
            depthWrite={false}
            vertexShader={skyGradientShader.vertexShader}
            fragmentShader={skyGradientShader.fragmentShader}
            uniforms={uniforms}
          />
        ) : (
          <meshBasicMaterial color={skyColor} side={THREE.BackSide} depthWrite={false} />
        )}
      </mesh>
      {hell && <hemisphereLight args={["#ff2200", "#330000", 2.5]} position={[0, 5, 0]} />}
      {/* Internal cloud glow — lights embedded in the cloud volumes */}
      {hell && <>
        <pointLight position={[-5, 8, -6]}  color="#ff3300" intensity={4} distance={20} decay={1.5} />
        <pointLight position={[8, 7, -3]}   color="#cc2200" intensity={3} distance={18} decay={1.5} />
        <pointLight position={[0, 9, 8]}    color="#ff4400" intensity={3.5} distance={18} decay={1.5} />
        <pointLight position={[-10, 7, 5]}  color="#cc3300" intensity={3} distance={16} decay={1.5} />
        <pointLight position={[12, 8, 7]}   color="#ff2200" intensity={3} distance={18} decay={1.5} />
      </>}
      {hell ? (
        <Clouds material={THREE.MeshLambertMaterial} texture="/cloud.png">
          {/* Low canopy layer */}
          <Cloud position={[-5, 8, -6]}   speed={0.45} opacity={0.7}  color="#bbbbbb" width={12} depth={2.5} segments={12} />
          <Cloud position={[8, 7, -3]}     speed={0.48} opacity={0.65} color="#aaaaaa" width={14} depth={3}   segments={14} />
          <Cloud position={[0, 9, 8]}      speed={0.42} opacity={0.7}  color="#cccccc" width={10} depth={2}   segments={10} />
          <Cloud position={[-10, 7, 5]}    speed={0.2}  opacity={0.6}  color="#b0b0b0" width={13} depth={3}   segments={12} />
          <Cloud position={[12, 8, 7]}     speed={0.45} opacity={0.65} color="#bbbbbb" width={11} depth={2.5} segments={10} />
          {/* Upper towers */}
          <Cloud position={[-3, 14, -12]}  speed={0.41}  opacity={0.55} color="#999999" width={16} depth={4}   segments={14} />
          <Cloud position={[6, 12, -10]}   speed={0.46} opacity={0.6}  color="#cccccc" width={13} depth={3}   segments={12} />
          <Cloud position={[-8, 13, 10]}   speed={0.44} opacity={0.55} color="#b0b0b0" width={14} depth={3.5} segments={12} />
          <Cloud position={[10, 15, 4]}    speed={0.4}  opacity={0.5}  color="#999999" width={15} depth={3}   segments={14} />
        </Clouds>
      ) : (
        <Clouds material={THREE.MeshBasicMaterial} texture="/cloud.png">
          <Cloud position={[-8, 10, -12]} speed={0.02} opacity={cloudOpacity * 1.25} width={1.2} depth={0.15} segments={4} />
          <Cloud position={[14, 12, -6]} speed={0.03} opacity={cloudOpacity} width={1.5} depth={0.12} segments={4} />
          <Cloud position={[3, 11, 16]} speed={0.015} opacity={cloudOpacity * 1.1} width={1} depth={0.1} segments={3} />
          <Cloud position={[-12, 13, 8]} speed={0.025} opacity={cloudOpacity * 0.9} width={1.8} depth={0.15} segments={4} />
          <Cloud position={[18, 9, 14]} speed={0.02} opacity={cloudOpacity} width={0.8} depth={0.1} segments={3} />
          <Cloud position={[-4, 14, -18]} speed={0.01} opacity={cloudOpacity * 0.75} width={1.3} depth={0.12} segments={3} />
          <Cloud position={[10, 12, -16]} speed={0.02} opacity={cloudOpacity * 0.9} width={1} depth={0.1} segments={3} />
        </Clouds>
      )}
    </group>
  );
});

// ── Hell sky effects — embers, pulsing lights, ground glow ──────────────────
const EMBER_COUNT = 300;
const _emberPositions = new Float32Array(EMBER_COUNT * 3);
const _emberVelocities = new Float32Array(EMBER_COUNT * 3);
const _emberLifetimes = new Float32Array(EMBER_COUNT);
const _emberSizes = new Float32Array(EMBER_COUNT);
for (let i = 0; i < EMBER_COUNT; i++) {
  _emberPositions[i * 3] = (Math.random() - 0.5) * 40;
  _emberPositions[i * 3 + 1] = Math.random() * 20;
  _emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
  _emberVelocities[i * 3] = (Math.random() - 0.5) * 0.6;
  _emberVelocities[i * 3 + 1] = 0.8 + Math.random() * 2.5;
  _emberVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
  _emberLifetimes[i] = Math.random();
  _emberSizes[i] = 0.04 + Math.random() * 0.1;
}

function HellLightning() {
  const lightARef = useRef();
  const lightBRef = useRef();
  const stateRef = useRef({
    nextStrike: 1 + Math.random() * 3,
    timer: 0,
    active: -1,       // which light is flashing (-1 = none)
    flashTimer: 0,
    flashes: 0,
    flashCount: 0,
  });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = stateRef.current;
    const lights = [lightARef.current, lightBRef.current];

    // Zero both when idle
    lights.forEach(l => { if (l) l.intensity = 0; });

    if (s.active === -1) {
      s.timer += dt;
      if (s.timer >= s.nextStrike) {
        s.active = Math.random() > 0.5 ? 1 : 0;
        s.flashTimer = 0;
        s.flashCount = 0;
        s.flashes = 1 + Math.floor(Math.random() * 3);
      }
      return;
    }

    const light = lights[s.active];
    if (!light) { s.active = -1; return; }

    s.flashTimer += dt;
    const onDur = 0.05;
    const offDur = 0.1;
    const cycle = onDur + offDur;
    const pos = s.flashTimer % cycle;

    if (pos < onDur) {
      const t = pos / onDur;
      light.intensity = 80 * (1 - t);
      light.color.lerpColors(
        new THREE.Color("#ffffff"),
        new THREE.Color("#ff4400"),
        t,
      );
    }

    if (pos >= onDur && s.flashTimer > (s.flashCount + 1) * cycle - offDur * 0.5) {
      s.flashCount++;
    }

    if (s.flashCount >= s.flashes) {
      s.active = -1;
      s.timer = 0;
      s.nextStrike = 2 + Math.random() * 5;
    }
  });

  return (
    <group>
      <pointLight ref={lightARef} position={[-10, 12, -10]} color="#ffffff" intensity={0} distance={200} decay={0.5} />
      <pointLight ref={lightBRef} position={[12, 11, 8]} color="#ffffff" intensity={0} distance={200} decay={0.5} />
    </group>
  );
}

const HellSkyEffects = memo(function HellSkyEffects() {
  const pointsRef = useRef();
  const pulseRef = useRef();
  const pulse2Ref = useRef();

  const positions = useMemo(() => new Float32Array(_emberPositions), []);
  const velocities = useMemo(() => new Float32Array(_emberVelocities), []);
  const lifetimes = useMemo(() => new Float32Array(_emberLifetimes), []);
  const sizes = useMemo(() => new Float32Array(_emberSizes), []);

  const emberGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geom;
  }, [positions, sizes]);

  const emberMat = useMemo(() => new THREE.PointsMaterial({
    size: 0.12,
    sizeAttenuation: true,
    color: new THREE.Color("#ff4400"),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const posArr = positions;
    for (let i = 0; i < EMBER_COUNT; i++) {
      lifetimes[i] += dt * (0.15 + sizes[i] * 2);
      if (lifetimes[i] > 1) {
        lifetimes[i] = 0;
        posArr[i * 3] = (Math.random() - 0.5) * 30;
        posArr[i * 3 + 1] = -1 + Math.random() * 2;
        posArr[i * 3 + 2] = (Math.random() - 0.5) * 30;
        velocities[i * 3] = (Math.random() - 0.5) * 0.3;
        velocities[i * 3 + 1] = 0.5 + Math.random() * 1.5;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      }
      posArr[i * 3] += velocities[i * 3] * dt;
      posArr[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      posArr[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      posArr[i * 3] += Math.sin(lifetimes[i] * 8 + i) * 0.02;
    }
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }

    const t = performance.now() * 0.001;
    emberMat.opacity = 0.5 + 0.3 * Math.sin(t * 2.1);

    if (pulseRef.current) {
      pulseRef.current.intensity = 3 + 2 * Math.sin(t * 1.3);
      pulseRef.current.color.setHSL(0.02 + 0.01 * Math.sin(t * 0.7), 1, 0.5);
    }
    if (pulse2Ref.current) {
      pulse2Ref.current.intensity = 2 + 1.5 * Math.sin(t * 1.8 + 1.5);
    }
  });

  return (
    <group>
      <points ref={pointsRef} geometry={emberGeom} material={emberMat} />
      <pointLight ref={pulseRef} position={[0, 3, 0]} color="#ff2200" intensity={3} distance={40} decay={2} />
      <pointLight ref={pulse2Ref} position={[-6, 1, 8]} color="#ff6600" intensity={2} distance={25} decay={2} />
      <pointLight position={[8, 2, -5]} color="#880000" intensity={1.5} distance={20} decay={2} />
      <HellLightning />
    </group>
  );
});

function SolsticeSkyEffects() {
  const sunRef = useRef();

  // Soft radiant sun: a single camera-facing sprite with a hot white-gold core
  // that fades smoothly into a warm corona — reads as glowing light blooming
  // outward, not a flat disc + hard ring (the old "target/moon" look).
  const sunTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const s = 256;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0.0, "rgba(255,252,238,1)");   // hot core
    g.addColorStop(0.18, "rgba(255,244,200,1)");  // disc body
    g.addColorStop(0.32, "rgba(255,212,120,0.72)"); // warm edge
    g.addColorStop(0.55, "rgba(255,184,92,0.26)");  // corona
    g.addColorStop(1.0, "rgba(255,170,80,0)");    // fade out
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (sunRef.current) {
      // Gentle "breathing" so it feels alive without pulsing distractingly.
      const s = 40 * (1 + Math.sin(t * 0.5) * 0.012);
      sunRef.current.scale.set(s, s, 1);
      sunRef.current.material.opacity = 0.95 + Math.sin(t * 0.5) * 0.05;
    }
  });

  return (
    <group>
      <sprite ref={sunRef} position={[-18, 28, -45]} scale={[40, 40, 1]}>
        <spriteMaterial map={sunTexture} transparent opacity={1} depthWrite={false} fog={false} />
      </sprite>
      <pointLight position={[-13, 18, -28]} color="#ffd66b" intensity={2.2} distance={90} decay={1.1} />
    </group>
  );
}

// Moon for the Parabolum sky — a textured sphere lit by the scene's violet
// directional lights (so it shows a soft terminator), with a faint emissive so
// the shadow side never goes fully black. Texture loaded imperatively to avoid
// a Suspense boundary.
function ParabolumMoon() {
  const ref = useRef();
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let active = true;
    new THREE.TextureLoader().load("/lunar_color.jpg", (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (active) setTex(t);
    });
    return () => { active = false; };
  }, []);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02; // slow drift
  });
  if (!tex) return null;
  return (
    <group position={[-16, 26, -46]}>
      <mesh ref={ref} rotation={[0.2, 0.5, 0.08]}>
        <sphereGeometry args={[5, 48, 48]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#8a82c8"
          emissiveIntensity={1.95}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

const OilSurfaceMap = dynamic(() => import("@/components/OilSurfaceMap"), { ssr: false });
const OilCrossSection = dynamic(() => import("@/components/OilCrossSection"), { ssr: false });
const OilVerifyPanel = dynamic(() => import("@/components/OilVerifyPanel"), { ssr: false });
const OilAdminGuide = dynamic(() => import("@/components/OilAdminGuide"), { ssr: false });
const OilClaimCertificate = dynamic(() => import("@/components/OilClaimCertificate"), { ssr: false });
const OilPlotChat = dynamic(() => import("@/components/OilPlotChat"), { ssr: false });
const CoreSamplePanel = dynamic(() => import("@/components/CoreSamplePanel"), { ssr: false });
const MuseumPanel = dynamic(() => import("@/components/MuseumPanel"), { ssr: false });
const ConcretionModal = dynamic(() => import("@/components/ConcretionModal"), { ssr: false });
const DrillGeode = dynamic(() => import("@/components/DrillGeode"), { ssr: false });
const OilChatModal = dynamic(() => import("@/components/OilChatModal"), { ssr: false });
const OilQualify = dynamic(() => import("@/components/OilQualify"), { ssr: false });
// OilPlotDraft removed — plot picking now merged into OilQualify

const DEFAULT_BLOCK_HASH =
  "0x8a3f7b2c91d4e6f5a0b3c8d7e2f1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0";

const DEPTH_Z = 20;
const CELL_SIZE = 1;
// "Bank soon" meter threshold, in field oil units (~0.5% of OIL_FIELD_UNITS) — the
// tank holds oil (the score), paid out at a fixed rate. Scales with OIL_FIELD_UNITS:
// every cell's oil is proportional to the field total, so this must track it
// (500K field → 2.5K) to keep the gusher-fill cadence constant.
const TANK_CAPACITY = 2500;
const PASSIVE_DRILLS = 10;
const MAX_BONUS_DRILLS = 10;
const MAX_DEPTH = 20;
const FREE_CLAIM_JUMPS = 2;
// A loose demon stays active until dispatched; this is only the orphan-cleanup
// backstop for a bugged/abandoned bounty (must match BOUNTY_TTL_MS in the API).
const DEMON_BOUNTY_TTL_MS = 24 * 60 * 60 * 1000; // 24h orphan backstop

// Continuous orbit exactly like the Three.js horse example. Stops when user interacts.
function CameraFlyIn({ onComplete, mobile = false, grid = 10 }) {
  const { camera, gl } = useThree();
  const elapsed = useRef(0);
  const done = useRef(false);
  // The intro's current look point, reported to onComplete at interruption so
  // OrbitControls can adopt it as their starting target — without it the
  // controls snap the view to their fixed default pivot mid-motion.
  const lastLook = useRef(new THREE.Vector3(0, mobile ? 1.5 : 5, 0));
  // Glide-out: interruption decays the intro clock's advance rate instead of
  // freezing it — the camera decelerates along its own path (orbit, bob and
  // gaze slow together) and hands off to OrbitControls at rest.
  const stopping = useRef(false);
  const speed = useRef(1);
  // Hold the intro clock until the initial asset load finishes — otherwise a
  // cold load runs the vendor fly-by behind a black screen and the viewer
  // joins mid-tour. Once started, later lazy loads must NOT pause the flight.
  const started = useRef(false);
  const { active: loadingActive } = useProgress();

  // Stop on any user interaction
  useEffect(() => {
    const canvas = gl.domElement;
    const stop = () => {
      // Begin the glide-out; useFrame completes the intro once at rest.
      // (Clicks that navigate — plots, stalls — still end the intro
      // instantly via setIntroComplete in their own handlers.)
      stopping.current = true;
    };
    canvas.addEventListener("pointerdown", stop);
    canvas.addEventListener("wheel", stop);
    return () => {
      canvas.removeEventListener("pointerdown", stop);
      canvas.removeEventListener("wheel", stop);
    };
  }, [gl, onComplete]);

  useFrame((_, delta) => {
    if (done.current) return;
    if (!started.current) {
      if (loadingActive) return; // assets still streaming — hold at t=0
      started.current = true;
    }

    if (stopping.current) {
      // Exponential deceleration (~halves every 0.15s); done in ~0.8s.
      speed.current *= Math.exp(-delta * 4.5);
      if (speed.current < 0.02) {
        done.current = true;
        onComplete([lastLook.current.x, lastLook.current.y, lastLook.current.z]);
        return;
      }
    }

    elapsed.current += delta * speed.current;
    const time = elapsed.current;

    // Corkscrew-in: the orbit RADIUS (and base height) eases inward over `dur`
    // seconds, opening on a wide shot that frames the whole field + the oil tower
    // then spiralling in to the resting radius. The key to making it read as a
    // DECREASING ORBIT (not a straight dolly-in) is to drive the orbit ANGLE off
    // the same eased descent progress, so the camera completes a fixed number of
    // full revolutions WHILE the radius shrinks — independent of frame rate. A
    // small constant term keeps a gentle orbit going after it settles.
    //
    // Vendor-aware tuning vs the original: the orbit is WIDER (it settles
    // just OUTSIDE the commercial strip's stall line on the −Z edge, so every
    // lap includes a close fly-past of the boardwalk), SLOWER, and the
    // look-at is less tower-centric — aimed low and biased toward the vendor
    // half of the field, with only a modest lift toward the tower at the
    // breathing crests.
    const easeInOutCubic = (p) =>
      p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const TWO_PI = Math.PI * 2;

    // The orbit was tuned for a 10×10 field; the grid renders at a world footprint
    // of gridSize×CELL_SIZE, so a smaller grid (e.g. 6×6) is physically smaller and
    // the fixed-radius orbit ends up circling way out past empty ground. Scale the
    // orbit radius, horizontal drift, height-ABOVE-surface, and bob by gridSize/10
    // so smaller fields get the same framing (camera flies more directly over the
    // field) while the look-at stays pinned to the surface center. f=1 at gridSize 10
    // reproduces the original tuning exactly.
    const f = grid / 10;

    if (mobile) {
      // Mobile: wide field-and-tower shot → wide orbit passing the vendors.
      // Slower than the original (dur 10 → 13, fewer revolutions/sec) and
      // settling at r≈3.0 rather than 1.6 so the strip side stays in play.
      const dur = 13;
      const k = easeInOutCubic(Math.min(time / dur, 1)); // eased radius/height settle
      const SURFACE = 1.5; // mobile rig surface / look-at height
      // Vertical motion is a cosine SHAPED to dwell low: raw is a symmetric 0..1
      // cosine; squaring it biases toward 0, so the camera spends most of each
      // cycle down among the rigs and only briefly springs up to peek at the
      // tower. Everything (height, radius, look-at) is driven off this shaped up.
      const raw = (Math.cos(time / 8) + 1) * 0.5;  // 0..1, symmetric (slow period)
      const up = raw * raw;                        // biased toward 0 → ground dwell
      const r = (9 + (3.0 - 9) * k) * f * (1 + 0.12 * up);
      const baseY = SURFACE + (3.5 + (0.2 - 3.5) * k) * f;
      const angle = (TWO_PI * 0.26 / dur) * time;
      camera.position.set(
        Math.sin(angle) * r,
        baseY + 1.4 * f * up,
        Math.cos(angle) * r,
      );
      // Less tower-centric: look low, biased toward the vendor half (−Z);
      // the crest lift toward the tower is kept but reduced.
      lastLook.current.set(0, SURFACE + 0.35 + 1.4 * up, -1.2 * f);
      camera.lookAt(lastLook.current);
    } else {
      // Desktop: wide field-and-tower shot → wide orbit skimming the strip.
      // Slower than the original (dur 13 → 17, ~2/3 the angular speed) and
      // settling at r≈6.4 — just OUTSIDE the stall line (z −5.6 at grid 10) —
      // so each lap flies close past the boardwalk instead of orbiting the
      // tower inside the field.
      const dur = 17;
      const k = easeInOutCubic(Math.min(time / dur, 1)); // eased radius/height settle
      // The desktop rig surface sits at world y≈5 (grid group offset). Keep the
      // settled height + bob ABOVE that so the orbit never dips into the
      // substance volume.
      const SURFACE = 5;
      // Vertical motion is a cosine SHAPED to dwell low: raw is a symmetric 0..1
      // cosine; squaring it biases toward 0, so the camera spends most of each
      // cycle down among the rigs and only briefly springs up to peek at the
      // tower. Everything (height, radius, look-at) is driven off this shaped up.
      const raw = (Math.cos(time / 8) + 1) * 0.5;  // 0..1, symmetric (slow period)
      const up = raw * raw;                        // biased toward 0 → ground dwell
      const r = (20 + (6.4 - 20) * k) * f * (1 + 0.12 * up);
      // baseY settles at SURFACE+1.5 — above the stall roofs (~SURFACE+0.7),
      // so the close pass clears the awnings.
      const baseY = SURFACE + (5 + (1.5 - 5) * k) * f;
      const angle = (TWO_PI * 0.42 / dur) * time;
      camera.position.set(
        Math.sin(angle) * r,
        baseY + 2.2 * f * up,
        Math.cos(angle) * r,
      );
      // Less tower-centric: look low, biased toward the vendor half (−Z);
      // the crest lift toward the tower is kept but reduced.
      lastLook.current.set(0, SURFACE + 0.4 + 1.6 * up, -1.8 * f);
      camera.lookAt(lastLook.current);
    }
  });

  return null;
}

// Head-on focus (MachinePanel click) downward tilt. 0 = dead-level/straight-on,
// higher = camera sits more above the panel and looks down. ~0.15 is a gentle tilt.
const FOCUS_TILT = 0.15;

// Smoothly animate camera to a target position
function CameraFlyTo({ target, controlsRef }) {
  const { camera } = useThree();
  const flyingRef = useRef(false);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const progressRef = useRef(0);
  const lastId = useRef(null);
  const savedMinDist = useRef(null);
  // Camera pose captured right before the fireworks sky-view fly, so toggling
  // fireworks off can return to where the user was looking.
  const preFirePos = useRef(new THREE.Vector3());
  const preFireTarget = useRef(new THREE.Vector3());
  const hasPreFire = useRef(false);

  useFrame((_, delta) => {
    if (target && target.id !== lastId.current) {
      const controls = controlsRef?.current;
      // Only consume this target once controls are actually mounted — otherwise a
      // fly requested on the same render this component mounts (e.g. first surface
      // click ending the intro) would be marked seen and silently dropped. Retry
      // next frame until the ref is populated.
      if (controls) {
        lastId.current = target.id;
        // Save and temporarily lower minDistance. A focus flight may override
        // the floor even lower: the photo booth's cabin is ~0.18 world units
        // deep, so a camera parked inside needs a smaller radius than the 0.3
        // default or OrbitControls shoves it back out through the wall.
        if (savedMinDist.current === null) savedMinDist.current = controls.minDistance;
        controls.minDistance = target.minDist ?? 0.3;

        startPos.current.copy(camera.position);
        startTarget.current.copy(controls.target);

        if (target.skyView) {
          // Remember where the user was looking so we can return on toggle-off
          preFirePos.current.copy(camera.position);
          preFireTarget.current.copy(controls.target);
          hasPreFire.current = true;
          // Pull back and tilt the camera up to frame fireworks in the sky
          if (target.mobile) {
            endTarget.current.set(0, 7, 0);
            endPos.current.set(0, 8, 9.5);
          } else {
            endTarget.current.set(0, 7, 0);
            endPos.current.set(0, 8.5, 12);
          }
        } else if (target.restoreView) {
          // Return to the pre-fireworks pose, or a sensible default overview
          if (hasPreFire.current) {
            endTarget.current.copy(preFireTarget.current);
            endPos.current.copy(preFirePos.current);
            hasPreFire.current = false;
          } else {
            endTarget.current.set(0, target.mobile ? 2 : 5, 0);
            endPos.current.set(0, target.mobile ? 3.5 : 8, target.mobile ? 4 : 8);
          }
        } else if (target.hellView) {
          // Two-phase camera pull-back while the demon is loose (mobile). Phase
          // "near": capture the pre-hell pose and dolly straight back a little
          // along the current view so the demon's elaborate entrance fits in
          // frame without a jarring jump. Phase "far": pull all the way out to
          // the field overview once it starts roaming, so the roaming/tappable
          // demon stays visible. restoreView returns to the captured pose on banish.
          if (target.phase === "near") {
            preFirePos.current.copy(camera.position);
            preFireTarget.current.copy(controls.target);
            hasPreFire.current = true;
            // Frame the summoner's rig (where the demon erupts), pulled well back
            // and aimed a little low so the whole show fits: the demon bursting
            // up out of the ground AND the higher flying-idle hover. The look-at
            // sits near the ground/wellhead; the camera is far enough back (~1.5
            // world units) to keep the risen demon in frame at fov 50.
            endTarget.current.set(target.x, target.y - 0.10, target.z + 0.05);
            endPos.current.set(target.x + 0.65, target.y + 0.12, target.z + 0.75);
          } else {
            // Phase 2: rise to an elevated, oblique helicopter vantage that frames
            // the field. The slow flySpeed makes this a cinematic pull-back; once
            // it settles, OrbitControls autoRotate (driven by the hellOrbit prop)
            // circles the camera around this look-at for the helicopter sweep.
            endTarget.current.set(0, target.mobile ? 1.4 : 5, 0);
            endPos.current.set(0, target.mobile ? 6 : 9, target.mobile ? 7 : 11);
          }
        } else if (target.overview) {
          // Zoom out to overview
          endTarget.current.set(0, target.mobile ? 2 : 5, 0);
          endPos.current.set(target.x, target.y, target.z);
        } else if (target.focus) {
          // Zoom in on the clicked point. If a face normal was supplied, swing the
          // camera around to view the face head-on; otherwise just dolly in along
          // the current view direction.
          endTarget.current.set(target.x, target.y, target.z);
          let dir;
          if (target.nx !== undefined && target.nx !== null) {
            // Approach along the panel's fixed front axis = canonical head-on view.
            // No flip-toward-camera: we want it to swing around to the front even if
            // the user is currently looking at the back/side.
            dir = new THREE.Vector3(target.nx, target.ny, target.nz);
            dir.y += FOCUS_TILT; // small lift so it looks slightly down, not dead-flat
          } else {
            dir = startPos.current.clone().sub(endTarget.current);
            if (dir.lengthSq() < 1e-6) dir.set(0.6, 0.3, 0.6); // degenerate fallback
          }
          dir.normalize();
          // Per-target distance (big objects like the tower window need more room);
          // falls back to the close panel distance.
          const focusDist = target.focusDist ?? (target.mobile ? 0.2 : 0.25);
          endPos.current.copy(endTarget.current).addScaledVector(dir, focusDist);
        } else if (target.rigIntro) {
          // CURRENTLY UNREACHABLE. This was the plot-owner page-open pose; owners
          // now get the same aerial intro as everyone else and nothing sets
          // rigIntro. Kept because it is the one framing tuned to clear the high
          // desktop surface — reach for it if you ever want a "fly to my rig"
          // shot that handleFlyTo's near-level close-up can't give you.
          // Desktop page-open focus on the player's own rig: an elevated, pulled-
          // back 3/4 view. The camera sits well above the surface and looks down
          // ~30°, so the open never dives to near-ground level into the grid.
          // Override the look-at START too: OrbitControls' resting target sits
          // below the (high) desktop surface, so without this the opening frame
          // would aim into the underground voxels before lerping up to the rig.
          startTarget.current.set(0, target.y, 0); // field-surface center, above ground
          endTarget.current.set(target.x, target.y - 0.1, target.z);
          endPos.current.set(target.x + 2.4, target.y + 2.6, target.z + 2.4);
        } else if (target.mobile) {
          // Mobile: close, fairly head-on view of the rig with a gentle downward tilt.
          // (A level pose — camera y == target y — grazes the ground plane and washes
          // the rig in haze, so keep the camera a touch above the look-at.) The smaller
          // +x offset keeps the rig centered rather than thrown to one side.
          endTarget.current.set(target.x, target.y - 0.13, target.z + 0.05);
          endPos.current.set(target.x + 0.44, target.y + 0.06, target.z + 0.51);
        } else {
          // Desktop: elevated close-up (pulled back slightly for more headroom)
          endTarget.current.set(target.x + 0.1, target.y - 0.05, target.z + 0.1);
          endPos.current.set(target.x + 0.63, target.y + 0.01, target.z + 0.47);
        }

        progressRef.current = 0;
        flyingRef.current = true;
      }
    }

    if (!flyingRef.current) return;
    const controls = controlsRef?.current;
    if (!controls) return;

    progressRef.current = Math.min(1, progressRef.current + delta * (target?.flySpeed ?? 1.2));
    const t = 1 - Math.pow(1 - progressRef.current, 3);

    camera.position.lerpVectors(startPos.current, endPos.current, t);
    controls.target.lerpVectors(startTarget.current, endTarget.current, t);
    controls.update();

    if (progressRef.current >= 1) {
      flyingRef.current = false;
      // Restore minDistance after zoom-out
      if ((target?.overview || target?.skyView || target?.restoreView || (target?.hellView && target?.phase !== "near")) && savedMinDist.current !== null) {
        controls.minDistance = savedMinDist.current;
        savedMinDist.current = null;
      }
    }
  });

  return null;
}

// Shake the camera when oil is struck — reads from a ref to avoid re-renders
function CameraShake({ shakeRef }) {
  const { camera } = useThree();
  const basePos = useRef(null);
  const elapsed = useRef(0);
  const active = useRef(false);

  useFrame((_, delta) => {
    // Detect new shake trigger
    if (shakeRef.current > 0 && !active.current) {
      basePos.current = camera.position.clone();
      elapsed.current = 0;
      active.current = true;
      shakeRef.current = 0; // consume the trigger
    }
    if (!active.current || !basePos.current) return;

    elapsed.current += delta;
    const RUMBLE_DURATION = 5.0;
    const t = elapsed.current / RUMBLE_DURATION;
    const envelope = t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.95);
    const amp = 0.02 * envelope;
    // Smooth perlin-like rumble using layered sin waves
    const e = elapsed.current;
    const ox = Math.sin(e * 7.3) * 0.6 + Math.sin(e * 13.1) * 0.4;
    const oy = Math.sin(e * 9.7) * 0.5 + Math.sin(e * 11.3) * 0.5;
    const oz = Math.sin(e * 8.1) * 0.6 + Math.sin(e * 14.7) * 0.4;
    camera.position.x = basePos.current.x + ox * amp;
    camera.position.y = basePos.current.y + oy * amp;
    camera.position.z = basePos.current.z + oz * amp;
    if (t >= 1) {
      camera.position.copy(basePos.current);
      basePos.current = null;
      active.current = false;
    }
  });

  return null;
}

const EMPTY_CLAIM_STATS = {
  grid3D: [], claimTotals: [], sorted: [], deposits: [],
  maxOil: 0, totalOil: 0, dryClaims: 0, maxClaimTotal: 0,
  hellPockets: [], hellMap: {},
};

// `enabled` gates the seed computation. Normal players run with enabled=false so
// the client NEVER computes the field from the seed (the exploit fix); they
// render from server-revealed data instead. Only admin / report / test compute.
function useClaimStats(blockHash, numberOfDeposits, totalOilBudget, gridX, gridY, enabled = true, numberOfHellPockets = null) {
  return useMemo(() => {
    if (!enabled) return EMPTY_CLAIM_STATS;
    const { grid, deposits, maxOil, hellPockets } = generateOilDistribution3D({
      blockHash,
      gridX,
      gridY,
      depthZ: DEPTH_Z,
      totalOilBudget: OIL_FIELD_UNITS, // field resolution, decoupled from the $ prize
      numberOfDeposits,
      numberOfHellPockets,
    });

    const claimTotals = [];
    let totalOil = 0;
    let maxClaimTotal = 0;
    for (let y = gridY - 1; y >= 0; y--) {
      for (let x = 0; x < gridX; x++) {
        let sum = 0;
        for (let z = 0; z < DEPTH_Z; z++) {
          sum += grid[x][y][z];
        }
        claimTotals.push({ x, y, index: y * gridX + x, claim: y * gridX + x + 1, oil: sum, total: sum });
        totalOil += sum;
        if (sum > maxClaimTotal) maxClaimTotal = sum;
      }
    }

    const sorted = [...claimTotals].sort((a, b) => b.oil - a.oil);
    const dryClaims = claimTotals.filter((c) => c.oil === 0).length;

    // Build a fast lookup for hell pockets: "x_y_z" → true
    const hellMap = {};
    for (const hp of hellPockets) {
      hellMap[`${hp.x}_${hp.y}_${hp.z}`] = true;
    }

    return { grid3D: grid, claimTotals, sorted, deposits, maxOil, totalOil, dryClaims, maxClaimTotal, hellPockets, hellMap };
  }, [blockHash, numberOfDeposits, totalOilBudget, gridX, gridY, enabled, numberOfHellPockets]);
}

// Animated number counter
function AnimNum({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef();

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + diff * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

// Isolated countdown so the 1-second timer doesn't re-render the entire page
const DrillCountdown = memo(function DrillCountdown({ style }) {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = tomorrow - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const mn = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setCountdown(`${h}:${mn}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <div style={style}>NEXT DRILL IN {countdown}</div>;
});

// Isolated pre-season countdown ("SEASON STARTS IN 2d 14h 03m") — its own
// 30s timer so the tick never re-renders the page. Falls back to "SOON" when
// no start date is set or the date has already passed (admin hasn't flipped
// the phase yet).
const SeasonCountdown = memo(function SeasonCountdown({ gameStartDate, style }) {
  const [label, setLabel] = useState("SOON");
  useEffect(() => {
    if (!gameStartDate) { setLabel("SOON"); return; }
    const target = new Date(gameStartDate + "T00:00:00Z").getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setLabel("SOON"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const mn = Math.floor((diff % 3600000) / 60000);
      setLabel(d > 0 ? `IN ${d}d ${h}h` : h > 0 ? `IN ${h}h ${String(mn).padStart(2, "0")}m` : `IN ${mn}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [gameStartDate]);
  return <span style={style}>SEASON STARTS {label}</span>;
});

// Desktop UI scale. The panel columns, header and canvas trays are authored in
// px for a ~1440-wide viewport; on a wider screen (or a zoomed-out page) they
// would stay 620px of chrome beside an ever-larger scene, with 10px type nobody
// can read. Scale them with the viewport instead. CSS zoom (not transform)
// reflows fonts, widths and SVGs together, so the grid columns are multiplied
// by the same factor below to keep the panels' own layout width unchanged.
function useUiScale(base = 1440, max = 2.5) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(max, Math.max(1, window.innerWidth / base)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [base, max]);
  return scale;
}

// Mobile: the panel stack is authored for the 280px desktop column. A phone
// gives it ~375px, so the same px type reads small and the 26px buttons miss
// fingers; zoom the non-canvas content (same mechanism as the desktop UI
// scale). 1.2 keeps the 252px gauge row inside the 312px layout width.
const MOBILE_PANEL_ZOOM = 1.2;
// Height of the pinned scene while the rig editor is open on mobile: 45% of
// the viewport (≈365px on a 812px phone), so the rig is a proper viewer and the
// editor still has ~300px below it. Clamped for very short / very tall phones.
const editorSceneHeight = (viewportH) => Math.min(440, Math.max(260, Math.round(viewportH * 0.45)));

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

// ── Floating scene/theme toolbar (top-right over the 3D canvas) ──────────────
// Fixed bright-on-dark styling so the icons stay readable against ANY sky,
// independent of the active UI theme (whose accent is dark in light modes).
const TOOLBAR_TRAY = {
  display: "flex", alignItems: "center", gap: 3,
  padding: 4, borderRadius: 8,
  background: "rgba(14,16,24,0.55)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
};
const TOOLBAR_DIVIDER = { width: 1, height: 18, background: "rgba(255,255,255,0.2)", margin: "0 3px", flexShrink: 0 };
const TOOLBAR_PILL = {
  padding: "0 12px", height: 28, borderRadius: 8,
  background: "rgba(14,16,24,0.55)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
  color: "rgba(245,232,200,0.85)", fontFamily: "'Share Tech Mono', monospace",
  fontSize: 11, letterSpacing: "0.1em", cursor: "pointer",
  display: "flex", alignItems: "center", gap: 5,
};
// active = highlighted; variant tints the active state (gold/violet/cyan).
function toolbarBtn(active, size = 28, variant = "gold") {
  const V = {
    gold:   { bg: "rgba(255,210,120,0.26)", border: "rgba(255,210,120,0.65)", color: "#ffe08a", glow: null },
    violet: { bg: "rgba(123,45,214,0.30)",  border: "#7b2dd6", color: "#d8b8ff", glow: "rgba(123,45,214,0.7)" },
    cyan:   { bg: "rgba(107,199,209,0.26)", border: "#6bc7d1", color: "#6bc7d1", glow: "rgba(107,199,209,0.6)" },
  }[variant];
  return {
    width: size, height: size,
    background: active ? V.bg : "transparent",
    border: `1px solid ${active ? V.border : "rgba(255,255,255,0.12)"}`,
    borderRadius: 3,
    color: active ? V.color : "rgba(245,232,200,0.8)",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: size >= 28 ? 14 : 13,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
    boxShadow: active && V.glow ? `0 0 8px ${V.glow}` : "none",
    textShadow: active && V.glow ? `0 0 6px ${V.color}` : "none",
  };
}

// Time-of-day glyphs, shared between the tray buttons and the collapsed trigger.
const ICON_DAY = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
);
const ICON_DUSK = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>
);
const ICON_NIGHT = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
);
const TIME_OF_DAY = [["day", ICON_DAY], ["dusk", ICON_DUSK], ["night", ICON_NIGHT]];

// Collapsible scene/theme toolbar (top-right over the 3D canvas). Defaults to a
// single trigger button that mirrors the ACTIVE theme's glyph so current state
// stays readable at a glance; clicking expands the full tray. Click-away or Esc
// collapses it again. Themes are a set-once preference, so they don't earn
// permanent screen space over the hero shot of the field.
function SceneThemeToolbar({
  envPreset, setEnvPreset, darkMode, setDarkMode,
  parabolum, setParabolum,
  autoTheme, enableAutoTheme,
  setFireworksOn, size = 28,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Glyph + tint shown on the collapsed trigger, reflecting the active theme.
  let triggerGlyph, triggerVariant = "gold";
  if (parabolum) { triggerGlyph = "◈"; triggerVariant = "violet"; }
  else if (envPreset === "solstice") triggerGlyph = "✺";
  // Reads envPreset ONLY, deliberately. This used to be `darkMode || envPreset
  // === "night"`, which let the tray show the night glyph while the 3D scene was
  // still in day — the two are separate states and the time-of-day buttons only
  // move envPreset. That cost real debugging time (spotlight beams and string
  // lights are gated on envPreset, so they were correctly off while every UI
  // affordance insisted it was night). The glyph now cannot disagree with the
  // scene it is controlling.
  else if (envPreset === "night") triggerGlyph = ICON_NIGHT;
  else if (envPreset === "dusk") triggerGlyph = ICON_DUSK;
  else triggerGlyph = ICON_DAY;

  return (
    <div ref={ref} style={TOOLBAR_TRAY}>
      {open && (
        <>
          {/* Auto — follow the wall clock. Highlighted while no explicit pick is
              stored; choosing any preset below turns it off. Sits first so the
              row reads "auto, or pin one of these". */}
          <button
            title={autoTheme ? "Auto — follows time of day (active)" : "Auto — follow time of day"}
            onClick={() => { enableAutoTheme?.(); setFireworksOn(false); }}
            style={toolbarBtn(autoTheme, size)}
          >⏱</button>
          {TIME_OF_DAY.map(([key, icon]) => (
            <button
              key={key}
              title={key[0].toUpperCase() + key.slice(1)}
              onClick={() => { setEnvPreset(key); if (key !== "night") setFireworksOn(false); }}
              style={toolbarBtn(!autoTheme && envPreset === key, size)}
            >{icon}</button>
          ))}
          <div style={TOOLBAR_DIVIDER} />
          <button
            title="Solstice theme"
            onClick={() => { setEnvPreset("solstice"); setParabolum(false); setDarkMode(false); setFireworksOn(false); }}
            style={toolbarBtn(!autoTheme && envPreset === "solstice" && !parabolum, size)}
          >✺</button>
          <button
            title={darkMode ? "Dark theme (active)" : "Dark theme"}
            onClick={() => { setDarkMode((d) => !d); setEnvPreset(darkMode ? "day" : "night"); if (darkMode) setFireworksOn(false); }}
            style={toolbarBtn(darkMode, size)}
          >{darkMode ? "●" : "◐"}</button>
          <button
            title="Lyquid80 theme"
            onClick={() => setParabolum((p) => !p)}
            style={toolbarBtn(parabolum, size, "violet")}
          >◈</button>
          <div style={TOOLBAR_DIVIDER} />
        </>
      )}
      <button
        title={open ? "Hide scene & theme controls" : "Scene & theme"}
        onClick={() => setOpen((o) => !o)}
        style={toolbarBtn(!open, size, triggerVariant)}
      >{open ? "✕" : triggerGlyph}</button>
    </div>
  );
}

export default function OilPage() {
  const isMobile = useIsMobile();
  const uiScale = useUiScale();
  // Published as a CSS variable on <html> so overlays — including the ones that
  // portal to document.body (polaroid, purchase modal, certificate lightbox) —
  // can zoom their cards to match the panels. Mobile stays at 1.
  useEffect(() => {
    document.documentElement.style.setProperty("--hm-ui-scale", String(isMobile ? 1 : uiScale));
    return () => document.documentElement.style.removeProperty("--hm-ui-scale");
  }, [uiScale, isMobile]);

  // Read mode from URL search params (avoids useSearchParams / Suspense issues)
  const [mode, setMode] = useState("active");
  const [previewMode, setPreviewMode] = useState(false);
  const [lobbyForce, setLobbyForce] = useState(false);
  // Ref mirror of previewMode so write-handler gates aren't fooled by a
  // stale useCallback closure (handlers don't need previewMode in their deps).
  const previewModeRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get("mode") || "active");
    const preview = params.get("preview") === "1";
    // Dev-only: ?lobby=1 renders the registration lobby regardless of phase so
    // the first-run path can be reviewed without flipping the game settings.
    setLobbyForce(process.env.NODE_ENV === "development" && params.get("lobby") === "1");
    setPreviewMode(preview);
    previewModeRef.current = preview;
    // Capture referral code from URL and store in localStorage
    const refCode = params.get("ref");
    if (refCode) {
      localStorage.setItem("oil_ref", refCode);
    }
  }, []);
  const isAdmin = mode === "admin";
  const isReport = mode === "report";

  const [envPreset, setEnvPreset] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("oil_envPreset");
      // "hell" is a transient event state, never a restorable user choice.
      if (saved && saved !== "hell" && ENV_PRESETS[saved]) return saved;
      // Nothing chosen yet → match the real world. An explicit pick always wins
      // over this, and only an explicit pick is ever written to storage (see the
      // persist effect below), so "never chose a theme" keeps tracking the clock
      // instead of freezing on whatever the first visit happened to land on.
      return presetForHour(new Date().getHours());
    }
    // SSR has no clock worth trusting and no storage; the client initializer
    // re-runs on hydration and corrects this. Same shape the saved-preset read
    // already relied on.
    return "day";
  });
  // Is the scene currently following the clock? True whenever no deliberate pick
  // is stored — which is exactly the condition the initializer above used to
  // fall through to presetForHour. Kept as state (not recomputed) so the tray
  // can show the mode and the persist effect can tell "auto" from "chosen".
  const [autoTheme, setAutoTheme] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("oil_envPreset");
    return !(saved && saved !== "hell" && ENV_PRESETS[saved]);
  });
  // Derived from envPreset on load, NOT read back from oil_darkMode. The two are
  // persisted under separate keys and can drift apart within a session (the
  // time-of-day buttons move envPreset without touching darkMode), and reading
  // both back independently is what let a contradictory pair — dark UI chrome
  // with a day scene — survive every reload. envPreset wins because it is the
  // richer state and the one the 3D scene actually reads.
  //
  // oil_darkMode is still WRITTEN (below), so an in-session choice persists; it
  // just no longer gets to contradict the scene at startup.
  const [darkMode, setDarkMode] = useState(() => envPreset === "night");
  // Parabolum material theme — independent of the day/dusk/night env presets.
  // When on, the UI shifts to the arcane violet console AND the extracted fluid
  // glows violet in the 3D scene (threaded into OilVoxelGrid below).
  const [parabolum, setParabolum] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("oil_parabolum") === "true";
    }
    return false;
  });
  // Handed to the tray IN PLACE OF setEnvPreset, so a click there counts as a
  // deliberate pick and ends auto mode. The page keeps using the raw setter for
  // its own programmatic changes (fireworks, hell), which must NOT.
  const chooseEnvPreset = useCallback((next) => {
    setAutoTheme(false);
    setEnvPreset(next);
  }, []);
  // Back to following the clock: drop the stored pick and re-derive now, so the
  // scene changes immediately rather than at the next reload. darkMode is synced
  // the same way the load-time derivation does it.
  const enableAutoTheme = useCallback(() => {
    try { localStorage.removeItem("oil_envPreset"); } catch (e) {}
    const next = presetForHour(new Date().getHours());
    setAutoTheme(true);
    setEnvPreset(next);
    setDarkMode(next === "night");
  }, []);

  // Active scene lighting: Parabolum forces its own violet-lit scene (a
  // self-contained themed look, independent of the day/dusk/night presets);
  // otherwise the user's selected time-of-day.
  const env = ENV_PRESETS[parabolum ? "parabolumEnv" : envPreset];
  // Reflections-only env map for the rigs' metal (NOT the sky). Warm "sunset"
  // reflections flatter the warm brass/copper on the bright day/dusk scenes;
  // "warehouse" (cooler, contrasty) suits the night/dark scenes and the Lyquid80
  // substance theme (Parabolum). Drei caches each HDR, so toggling is
  // instant after first load.
  const envMapPreset = useMemo(() => {
    if (parabolum) return "warehouse";                           // Lyquid80 theme
    if (envPreset === "night" || envPreset === "hell") return "warehouse";
    return "sunset";                                             // day, solstice, dusk
  }, [parabolum, envPreset]);
  // Don't persist the transient "hell" preset — otherwise a reload during a
  // demon event restores hell forever. Keep the last real preset saved instead.
  //
  // Nothing is written while autoTheme is on. That covers the mount pass (whose
  // value is the CLOCK pick — saving it would instantly turn an auto theme into
  // a "preference" and pin the page to it at any hour) and it also means the
  // programmatic preset changes, fireworks forcing night and the hell event,
  // can't quietly end auto mode either. Storage only ever holds a deliberate
  // choice made in the tray.
  useEffect(() => {
    if (autoTheme) return;
    if (envPreset !== "hell") localStorage.setItem("oil_envPreset", envPreset);
  }, [envPreset, autoTheme]);
  useEffect(() => { localStorage.setItem("oil_darkMode", String(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem("oil_parabolum", String(parabolum)); }, [parabolum]);
  // Parabolum overrides light/dark for the UI chrome when active, but still
  // Parabolum is a self-contained dark violet look (its own violet scene), so it
  // always uses the dark console — there's no Parabolum "day" variant.
  const themeKey = parabolum
    ? "parabolumDark"
      : envPreset === "solstice"
        ? "solsticeLight"
        : (darkMode ? "dark" : "light");
  const theme = THEMES[themeKey];
  // Effective dark flag for the child overlay panels (CoreSamplePanel, How-To,
  // inspector, etc.). Parabolum and dark mode are both dark aesthetics, so their
  // panels render dark even when the day/night toggle is on "day".
  const uiDark = darkMode || parabolum;
  const styles = useMemo(() => getStyles(theme), [theme]);
  const m = useMemo(() => getMobileStyles(theme), [theme]);
  const drillBtnStyles = useMemo(() => getDrillStyles(theme), [theme]);
  const isTest = mode === "test";
  const [testDay, setTestDay] = useState(0);
  const { user, isLoaded: userLoaded } = useUser();
  const clerk = useClerk();

  // Authenticated fetch for oil mutation endpoints — attaches the Clerk session
  // token so the server verifies identity from the session, never a body userId.
  const oilApiFetch = useCallback(async (url, opts = {}) => {
    let token = null;
    try { token = await clerk.session?.getToken(); } catch {}
    return fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
  }, [clerk]);
  const { walletAddress, tokenBalance, isWalletConnected } = useWalletAuth();
  const { play, pause, isPlaying: contextIsPlaying, nextTrack } = useMusic();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [helpFairness, setHelpFairness] = useState(false); // open the help modal on the fairness explainer
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardSectionOpen, setLeaderboardSectionOpen] = useState(true);

  // First-visit onboarding: auto-open the welcome/rules modal once per device.
  useEffect(() => {
    try {
      if (!localStorage.getItem("oilWelcomeSeen")) setShowWelcome(true);
    } catch {}
  }, []);

  const closeWelcome = useCallback(() => {
    setShowWelcome(false);
    setHelpFairness(false);
    try { localStorage.setItem("oilWelcomeSeen", "1"); } catch {}
  }, []);

  // Premium purchases
  const [unlockedItems, setUnlockedItems] = useState(new Set());
  const [purchaseModalItem, setPurchaseModalItem] = useState(null);

  // Auto-close the account modal once a wallet is connected mid-purchase,
  // so the user returns to PumpPurchaseModal (which sits underneath) to see
  // the GET USDC / PAY NOW button instead of being stuck on the wallet view.
  useEffect(() => {
    if (walletAddress && purchaseModalItem && showAccountModal) {
      setShowAccountModal(false);
    }
  }, [walletAddress, purchaseModalItem, showAccountModal]);

  // Game state
  const [gamePhase, setGamePhase] = useState("ticket_sale");
  const [gameEnded, setGameEnded] = useState(false);
  const [testingEnabled, setTestingEnabled] = useState(false);
  // gameDay is derived from the season clock (see the useMemo below), not stored
  // or admin-set — it's a truthful "DAY N" display, can't desync.
  const [gameStartDate, setGameStartDate] = useState(null);
  const [seasonLengthDays, setSeasonLengthDays] = useState(10);
  // Provable-fairness anchor (public fields from oilGame/settings) — drives
  // the anchor-as-event countdown in the lobby + pre-season panel.
  const [anchorBlock, setAnchorBlock] = useState(null);
  const [anchorBlockHash, setAnchorBlockHash] = useState(null);
  // Pre-season lobby toggle: during ticket_sale a player WITH a plot lands on
  // the 3D field (pre-season mode) instead of OilQualify. lobbyView=true pins
  // the registration page open — set on mount for plot-less users (so claiming
  // a plot doesn't yank them off the certificate mid-ceremony) and by the
  // "VIEW REGISTRATION LOBBY" link in the pre-season panel (the certificate
  // itself is now a thumb right in the panel — OilClaimCertificate).
  const [lobbyView, setLobbyView] = useState(null);
  // Whether this player has linked the Telegram alert bot (oilTelegram/{userId})
  const [telegramLinked, setTelegramLinked] = useState(false);

  // Admin password gate
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (isAdmin && localStorage.getItem("oil_admin_auth") === "true") {
      setAdminAuthed(true);
      const savedPw = localStorage.getItem("oil_admin_pw") || sessionStorage.getItem("oil_admin_pw");
      if (savedPw) setAdminPassword(savedPw);
    }
  }, [isAdmin]);

  const handleAdminLogin = useCallback(async () => {
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setAdminAuthed(true);
        localStorage.setItem("oil_admin_auth", "true");
        localStorage.setItem("oil_admin_pw", adminPassword);
        sessionStorage.setItem("oil_admin_pw", adminPassword);
      } else {
        alert("Incorrect password");
      }
    } catch {
      alert("Failed to verify password");
    }
  }, [adminPassword]);

  const [revealProgress, setRevealProgress] = useState(0);
  const [animateReveal, setAnimateReveal] = useState(false);
  const [blockHash, setBlockHash] = useState(DEFAULT_BLOCK_HASH);
  // Public commitment to the seed (SHA-256). Shown during play; the raw seed is
  // only published (and used) at game end. Players never receive the raw seed.
  const [seedCommitment, setSeedCommitment] = useState(null);
  // Admin testing: when on, render the reveal-only PLAYER view (hide seed data)
  // even in admin/report/test, so you can watch reveal-on-drill without a 2nd tab.
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [numberOfDeposits, setNumberOfDeposits] = useState(5);
  const [numberOfHellPockets, setNumberOfHellPockets] = useState(null); // null ⇒ auto (~3% of grid)
  const [totalOilBudget, setTotalOilBudget] = useState(500);
  const [gridSize, setGridSize] = useState(10);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showMainTankInfo, setShowMainTankInfo] = useState(false);
  // Tester access code: redeem box (players) + admin set-code input.
  const [testerCode, setTesterCode] = useState("");
  const [showTesterCode, setShowTesterCode] = useState(false); // tester-code input collapsed behind a link
  const [testerMsg, setTesterMsg] = useState(null);
  const [adminTesterCode, setAdminTesterCode] = useState("");
  // Next-season waitlist (overflow demand: grid full / registration closed).
  const [waitlistInfo, setWaitlistInfo] = useState(null); // { waitlisted, position, total }
  const [waitlistCount, setWaitlistCount] = useState(0);   // admin sponsor metric

  // ── Firestore game settings sync ──
  // Subscribe to oilGame/settings — all modes get live updates
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "oilGame", "settings"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        // The raw seed is never in the public doc during play — only its
        // commitment, plus the post-game reveal (which is safe to compute from).
        // Unconditional (null on absence) so a board reset that wipes the
        // fairness fields clears the lobby countdown in already-open tabs.
        setSeedCommitment(d.seedCommitment || null);
        // The revealed seed is only safe to expose to clients AFTER the game has
        // actually ended — otherwise a stale/leftover seedReveal (e.g. from a
        // prior test cycle) would hand every player the live map. Gate on
        // gameEnded/phase, not merely the field's presence.
        const endedNow = d.gameEnded === true || d.gamePhase === "ended";
        if (endedNow && d.seedReveal) setBlockHash(d.seedReveal);
        // Legacy/pre-migration games may still carry a public blockHash. Gate
        // adoption on the PASSWORD-VERIFIED admin flag (not the URL `mode`,
        // which any visitor can set to admin/report/test) so a stray legacy
        // seed can never be computed client-side by a non-admin.
        else if (d.blockHash && adminAuthed) setBlockHash(d.blockHash);
        if (d.numberOfDeposits) setNumberOfDeposits(d.numberOfDeposits);
        if (typeof d.numberOfHellPockets === "number") setNumberOfHellPockets(d.numberOfHellPockets);
        if (d.totalOilBudget) setTotalOilBudget(d.totalOilBudget);
        if (typeof d.gameEnded === "boolean") setGameEnded(d.gameEnded);
        if (typeof d.gridSize === "number") setGridSize(d.gridSize);
        if (d.gamePhase) setGamePhase(d.gamePhase);
        if (d.gameStartDate) setGameStartDate(d.gameStartDate);
        if (typeof d.seasonLengthDays === "number" && d.seasonLengthDays > 0) setSeasonLengthDays(d.seasonLengthDays);
        if (typeof d.testingEnabled === "boolean") setTestingEnabled(d.testingEnabled);
        // Anchor-as-event: the public commit/anchor fields drive the "map does
        // not exist yet" countdown (OilAnchorEvent). Both are public by design.
        setAnchorBlock(typeof d.anchorBlock === "number" ? d.anchorBlock : null);
        setAnchorBlockHash(d.anchorBlockHash || null);
      }
      setSettingsLoaded(true);
    });
    return () => unsub();
  }, []);

  // Redirect report mode to active if game hasn't ended. Wait for settings to
  // load first — gameEnded defaults to false on mount, so without the
  // settingsLoaded gate this fires before Firestore arrives and bounces every
  // report view back to /hailmary (looked like the link just refreshing).
  useEffect(() => {
    if (isReport && settingsLoaded && !gameEnded) {
      window.location.replace("/hailmary");
    }
  }, [isReport, settingsLoaded, gameEnded]);

  // Admin: pull the raw seed from the server (password-gated) so the inspector
  // can compute the full field during a live game. Players have no such path —
  // for them the seed stays server-side until the post-game reveal.
  useEffect(() => {
    if (!isAdmin || !adminAuthed || !adminPassword) return;
    let cancelled = false;
    fetch(`/api/oil-settings?adminPassword=${encodeURIComponent(adminPassword)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.seed) setBlockHash(d.seed); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin, adminAuthed, adminPassword]);

  // Community oil storage — tracks total oil sent by all players
  const [communityOil, setCommunityOil] = useState(0);
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "oilGame", "communityStorage"), (snap) => {
      if (snap.exists()) {
        setCommunityOil(snap.data().totalOil || 0);
      }
    });
    return () => unsub();
  }, []);

  // ── Leaderboard data — live listener on all oilDrills docs ──
  // Uses docChanges() for incremental updates instead of rebuilding the full array on every change
  const [allDrillers, setAllDrillers] = useState([]);
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "oilDrills"), (snap) => {
      setAllDrillers((prev) => {
        // First snapshot or empty — build from scratch
        if (prev.length === 0) {
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        // Incremental update — only process changed docs
        const changes = snap.docChanges();
        if (changes.length === 0) return prev;
        const next = [...prev];
        const idxMap = new Map(next.map((d, i) => [d.id, i]));
        for (const change of changes) {
          const entry = { id: change.doc.id, ...change.doc.data() };
          if (change.type === "added" && !idxMap.has(entry.id)) {
            next.push(entry);
            idxMap.set(entry.id, next.length - 1);
          } else if (change.type === "modified") {
            const idx = idxMap.get(entry.id);
            if (idx !== undefined) next[idx] = entry;
          } else if (change.type === "removed") {
            const idx = idxMap.get(entry.id);
            if (idx !== undefined) {
              next.splice(idx, 1);
            }
          }
        }
        return next;
      });
    });
    return () => unsub();
  }, []);

  // Set of tester userIds (code-qualified, no wallet) — used to badge them on
  // the leaderboard and to hide them while testers are disabled.
  const [testerIds, setTesterIds] = useState(() => new Set());
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "oilQualified"), (snap) => {
      const ids = new Set();
      let waiting = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (data.isTester === true) ids.add(d.id);
        if (data.waitlisted === true) waiting++;
      });
      setTesterIds(ids);
      setWaitlistCount(waiting);
    });
    return () => unsub();
  }, []);

  // FIELD ACTIVITY feed — live who/what/when timeline (latest 30, newest first).
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoaded, setTimelineLoaded] = useState(false); // first snapshot arrived (away-recap gate)
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "oilTimeline"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      setTimelineEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimelineLoaded(true);
    });
    return () => unsub();
  }, []);

  const leaderboardData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    // DRILLERS counts rigs actually staked on the board (col != null) — drill
    // docs persist across board resets (they carry referrals/bonuses), so the
    // raw doc count would show ghost rigs from past seasons.
    const placed = allDrillers.filter((d) => d.col != null);
    const totalDrillers = placed.length;
    const drilledTodayCount = placed.filter((d) => d.lastDrillDate === today).length;
    // Zero-score rigs are noise, not collectors — but DON'T require placement:
    // a released rig's banked score is still real money owed to that player.
    const topCollectors = allDrillers
      .filter((d) => (d.totalCollected || 0) > 0)
      .sort((a, b) => (b.totalCollected || 0) - (a.totalCollected || 0))
      .slice(0, 10);
    const topToday = placed
      .filter((d) => d.lastDrillDate === today)
      .sort((a, b) => (b.totalCollected || 0) - (a.totalCollected || 0))
      .slice(0, 10);
    return { totalDrillers, drilledTodayCount, topCollectors, topToday };
  }, [allDrillers]);

  // ── Username ──
  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);

  // Rogue events — live listener for active rogue characters
  const [rogueEvents, setRogueEvents] = useState([]);
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "rogueEvents"), where("status", "==", "active"));
    const unsub = onSnapshot(q, (snap) => {
      setRogueEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Demon bounty — live listener for active demon events
  const [demonBounty, setDemonBounty] = useState(null);
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "demonBounty"),
      where("status", "in", ["active", "flying", "waiting"]),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setDemonBounty(null);
        return;
      }
      const d = snap.docs[0];
      const data = d.data();
      // Self-heal: a demon is a transient event. If this one is older than the
      // TTL it's stale/orphaned (e.g. left active by an unclaimable test demon),
      // so ignore it (no hell) and fire-and-forget an expiry so it stops
      // re-lighting hell on every refresh.
      const createdMs = data.createdAt?.toMillis?.() ?? 0;
      if (createdMs && Date.now() - createdMs > DEMON_BOUNTY_TTL_MS) {
        setDemonBounty(null);
        fetch("/api/oil-demon-bounty", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bountyId: d.id }),
        }).catch(() => {});
        return;
      }
      setDemonBounty({ id: d.id, ...data });
    });
    return () => unsub();
  }, []);

  // Demon blockade — global flag that blocks all drilling
  const [demonBlockade, setDemonBlockade] = useState(null);
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "oilGame", "demonBlockade"), (snap) => {
      if (snap.exists()) {
        setDemonBlockade(snap.data());
      } else {
        setDemonBlockade(null);
      }
    });
    return () => unsub();
  }, []);

  // Is the current user the summoner of the active blockade?
  const isBlockadeSummoner = !!(
    demonBlockade?.active && user?.id && demonBlockade.summonerId === user.id
  );
  // Stun countdown. A plain useMemo over Date.now() never recomputes when
  // wall-clock time passes, so it would leave the summoner "INCAPACITATED"
  // forever once the timer hit zero. Drive it from a 1s interval instead so the
  // stun actually releases and the demon becomes dismissable.
  const [stunRemaining, setStunRemaining] = useState(0);
  const [stunActive, setStunActive] = useState(false);
  useEffect(() => {
    const stunEnd =
      demonBlockade?.stunEndsAt?.toMillis?.() ??
      (demonBlockade?.stunEndsAt?.seconds ? demonBlockade.stunEndsAt.seconds * 1000 : 0);
    if (!isBlockadeSummoner || !stunEnd) {
      setStunRemaining(0);
      setStunActive(false);
      return;
    }
    const tick = () => {
      const leftMs = stunEnd - Date.now();
      setStunRemaining(Math.max(0, Math.ceil(leftMs / 1000)));
      setStunActive(leftMs > 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isBlockadeSummoner, demonBlockade?.stunEndsAt]);
  const isSummonerStunned = isBlockadeSummoner && stunActive;

  const isBlockadeActive = demonBlockade?.active === true;

  // Gusher events — live listener for active oil gushers across all players
  const [gusherEvents, setGusherEvents] = useState([]);
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "gusherEvents"), where("status", "==", "active"));
    const unsub = onSnapshot(q, (snap) => {
      setGusherEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // All pump configs — live listener so every player's customizations show in broad view
  // Stores { config, userId } per cell for rendering + ownership lookup
  const [allPumpConfigs, setAllPumpConfigs] = useState({});
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "pumpConfigs"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.col != null && data.row != null && data.config) {
          map[`${data.col}_${data.row}`] = { config: data.config, userId: data.userId || null };
        }
      });
      setAllPumpConfigs(map);
    });
    return () => unsub();
  }, []);

  // ── oilPlots subscription — per-cell ownership/state ──
  const [allPlotsMap, setAllPlotsMap] = useState({});
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "oilPlots"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
      setAllPlotsMap(map);
    });
    return () => unsub();
  }, []);

  // ── plotsWithMessages — tracks which plots have unread DMs for the current user ──
  const [plotsWithMessages, setPlotsWithMessages] = useState({});
  const dismissedPlotsRef = useRef({}); // plotKey → latest dismissed timestamp (seconds)
  useEffect(() => {
    if (!db || !user?.id) { setPlotsWithMessages({}); return; }
    const q = query(
      collection(db, "oilPlotMessages"),
      where("threadUserId", "==", user.id),
      orderBy("timestamp", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      const dismissed = dismissedPlotsRef.current;
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.fromUserId !== user.id) {
          const msgTime = data.timestamp?.seconds || 0;
          const dismissedTime = dismissed[data.plotKey] || 0;
          if (msgTime > dismissedTime) {
            map[data.plotKey] = true;
          }
        }
      });
      setPlotsWithMessages(map);
    });
    return () => unsub();
  }, [user?.id]);

  // User's active plot state (from oilPlots, not oilDrills)
  const userPlotState = useMemo(() => {
    if (!user?.id) return null;
    return Object.values(allPlotsMap).find((p) => p.currentOwnerId === user.id) || null;
  }, [user?.id, allPlotsMap]);

  // Claim jump state
  const [claimJumpMode, setClaimJumpMode] = useState(false);
  const [claimToast, setClaimToast] = useState(null);
  const claimToastTimer = useRef(null);
  const [chatModalPlotKey, setChatModalPlotKey] = useState(null);

  // Admin: save settings via /api/oil-settings (Admin SDK, password-gated).
  // Direct client writes to oilGame/* are blocked by Firestore rules — prize
  // money is on the line, so settings can only be mutated server-side.
  // Uses a ref for current values so the callback identity is stable.
  const gameSettingsRef = useRef({ blockHash, numberOfDeposits, totalOilBudget, gridSize, gamePhase, gameEnded, gameStartDate });
  gameSettingsRef.current = { blockHash, numberOfDeposits, totalOilBudget, gridSize, gamePhase, gameEnded, gameStartDate };
  const saveGameSettings = useCallback(async (overrides = {}) => {
    if (!isAdmin || !adminAuthed || !adminPassword) return;
    try {
      const res = await fetch("/api/oil-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword,
          settings: { ...gameSettingsRef.current, ...overrides },
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to save game settings:", err);
    }
  }, [isAdmin, adminAuthed, adminPassword]);

  // Mobile tab view
  const [mobileTab, setMobileTab] = useState("3d"); // "3d" | "surface" | "xsec"
  // Rig editor (Pimp My Pump) open on the phone — pins the scene as a compact live view.
  const [pimpOpenMobile, setPimpOpenMobile] = useState(false);

  // 2D interaction state lifted up
  const [selectedX, setSelectedX] = useState(null);
  const [sliceY, setSliceY] = useState(0);
  const [drillDepth, setDrillDepth] = useState(0);
  const [isDrilling, setIsDrilling] = useState(false);

  // Snapshot trigger for PolaroidSnapshot
  const [snapshotTrigger, setSnapshotTrigger] = useState(false);
  const [fireworksOn, setFireworksOn] = useState(false);
  const [fireworksSound, setFireworksSound] = useState(true);
  // Remember the env preset active before fireworks switched the scene to night,
  // so toggling fireworks off restores the user's original lighting.
  const fireworksPrevPresetRef = useRef(null);
  const toggleFireworks = useCallback(() => {
    setFireworksOn((on) => {
      if (!on) {
        // Turning on: remember current preset, then switch to night if needed
        fireworksPrevPresetRef.current = envPreset;
        if (envPreset !== "night") setEnvPreset("night");
        // Pull the camera back and tilt up for a better view of the sky
        flyIdRef.current++;
        setFlyTarget({ id: flyIdRef.current, mobile: isMobile, skyView: true });
      } else {
        // Turning off: restore the preset we had before launching fireworks
        if (fireworksPrevPresetRef.current && fireworksPrevPresetRef.current !== "night") {
          setEnvPreset(fireworksPrevPresetRef.current);
        }
        fireworksPrevPresetRef.current = null;
        // Fly the camera back to the pre-fireworks view
        flyIdRef.current++;
        setFlyTarget({ id: flyIdRef.current, mobile: isMobile, restoreView: true });
      }
      return !on;
    });
  }, [envPreset, isMobile]);
  // A jackpot on the DAILY TICKET fires the fireworks for a fixed run, then
  // puts the scene back — unless the player has already stopped them by hand.
  const fireworksOnRef = useRef(false);
  useEffect(() => { fireworksOnRef.current = fireworksOn; }, [fireworksOn]);
  const jackpotFireworksTimer = useRef(null);
  const fireJackpotFireworks = useCallback((ms = 10000) => {
    if (!fireworksOnRef.current) toggleFireworks();
    clearTimeout(jackpotFireworksTimer.current);
    jackpotFireworksTimer.current = setTimeout(() => { if (fireworksOnRef.current) toggleFireworks(); }, ms);
  }, [toggleFireworks]);
  useEffect(() => () => clearTimeout(jackpotFireworksTimer.current), []);

  // Reset snapshot trigger after timeout (fallback if user dismisses without onComplete)
  useEffect(() => {
    if (snapshotTrigger) {
      const t = setTimeout(() => setSnapshotTrigger(false), 5000);
      return () => clearTimeout(t);
    }
  }, [snapshotTrigger]);

  // Review day scrub (player mode only): null = live, number = reviewing history
  const [reviewDay, setReviewDay] = useState(null);
  const [depthProfileOpen, setDepthProfileOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Demo drill day
  const [demoDay, setDemoDay] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  // Admin: manual gusher test — increments to fire the full 3D oil-release effect
  // on the selected rig on demand (independent of drill depth / oil data).
  const [gusherTest, setGusherTest] = useState(0);

  // ── Daily Drill (player mode) ──
  const [userDrill, setUserDrill] = useState(null); // { col, row, drillDay, lastDrillDate }
  // True once the player's drill doc (or signed-out status) has actually
  // resolved — gates decisions that must not run on the loading-race null.
  const [drillLoaded, setDrillLoaded] = useState(false);
  // drillCountdown state removed — now handled by isolated DrillCountdown component

  // Load user drill state from Firestore
  useEffect(() => {
    if (!userLoaded || !db) return;
    if (!user?.id) { setDrillLoaded(true); return; } // signed out — no drill doc to wait for
    const unsub = onSnapshot(doc(db, "oilDrills", user.id), (snap) => {
      setDrillLoaded(true);
      if (snap.exists()) {
        const d = snap.data();
        setUserDrill({ col: d.col, row: d.row, drillDay: d.drillDay, lastDrillDate: d.lastDrillDate, totalCollected: d.totalCollected || 0, tankDrains: d.tankDrains || 0, lastDrainExtracted: d.lastDrainExtracted || 0, bonusDrills: d.bonusDrills || 0, referralCode: d.referralCode || null, confirmedReferrals: d.confirmedReferrals || 0, claimJumpsUsed: d.claimJumpsUsed || 0, tankOil: d.tankOil, lastStrikeAt: d.lastStrikeAt || null, lastStrikeOil: d.lastStrikeOil ?? null, lastStrikeDepth: d.lastStrikeDepth ?? null, lastStrikeHell: d.lastStrikeHell || false, armed: d.armed, rigDepleted: d.rigDepleted || false, bonusFromShares: d.bonusFromShares || 0, bonusFromHolding: d.bonusFromHolding || 0, artifacts: d.artifacts || {}, artifactFinds: d.artifactFinds || 0, lastStrikeArtifact: d.lastStrikeArtifact || null, supplies: d.supplies || {}, coupon: d.coupon || null, bonusClaimJumps: d.bonusClaimJumps || 0, bonusFromTickets: d.bonusFromTickets || 0, ticketStreak: d.ticketStreak || 0 });
        if (d.username) setUsername(d.username);
      } else {
        setUserDrill(null);
      }
    });
    return () => unsub();
  }, [user?.id, userLoaded]);

  // Web-push alerts (FCM) — the lowest-friction strike-alert channel; pairs
  // with the Telegram link below in the "GET STRIKE ALERTS" ask.
  const pushAlerts = usePushAlerts({ active: !!user?.id });

  // Telegram alert-bot link status (oilTelegram/{userId} is written by the
  // bot's /start handler) — drives the "GET STRIKE ALERTS" pre-season ask.
  useEffect(() => {
    if (!user?.id || !db) return;
    const unsub = onSnapshot(doc(db, "oilTelegram", user.id), (snap) => {
      setTelegramLinked(snap.exists() && !!snap.data()?.chatId);
    });
    return () => unsub();
  }, [user?.id]);

  // Pin the registration lobby open for plot-less users during ticket_sale so
  // claiming a plot doesn't instantly swap them to the field — they stay on
  // the certificate (share moment), then choose "ENTER THE FIELD" themselves.
  // Waits for drillLoaded so a plot-holder's loading-race null doesn't pin
  // them into the lobby; they land straight on the field (lobbyView stays null).
  useEffect(() => {
    if (gamePhase === "ticket_sale" && settingsLoaded && drillLoaded && userDrill?.col == null && lobbyView === null) {
      setLobbyView(true);
    }
  }, [gamePhase, settingsLoaded, drillLoaded, userDrill?.col, lobbyView]);

  // Listen to premium purchases
  useEffect(() => {
    if (!user?.id || !db) return;
    const unsub = onSnapshot(doc(db, "oilPurchases", user.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const items = new Set(Object.keys(data.unlocked || {}));
        setUnlockedItems(items);
      } else {
        setUnlockedItems(new Set());
      }
    });
    return () => unsub();
  }, [user?.id]);

  const handlePurchaseRequest = useCallback((items) => {
    if (previewModeRef.current) return;
    // Accept single item or array
    setPurchaseModalItem(Array.isArray(items) ? items : [items]);
  }, []);

  const handlePurchaseComplete = useCallback(() => {
    setPurchaseModalItem(null);
  }, []);

  // The player's own plot, sourced from the SAME data the surface map uses for its
  // persistent "isMine" highlight (oilPlots ownership) — so auto-select and the
  // cross-section agree with the surface even when oilDrills.col is stale/null.
  const myPlot = useMemo(() => {
    if (!user?.id) return null;
    for (const key in allPlotsMap) {
      if (allPlotsMap[key]?.currentOwnerId === user.id) {
        const [c, r] = key.split("_").map(Number);
        return { col: c, row: r };
      }
    }
    return null;
  }, [allPlotsMap, user?.id]);

  // Auto-select the user's claim on load
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current) return;
    const col = userDrill?.col ?? myPlot?.col;
    const row = userDrill?.row ?? myPlot?.row;
    if (col != null) {
      didAutoSelect.current = true;
      setSelectedX(col);
      setSliceY(row ?? 0);
    }
  }, [userDrill, myPlot]);

  const handleSaveUsername = useCallback(async () => {
    if (previewModeRef.current) return;
    if (!user?.id || !username.trim() || !userDrill) return;
    setUsernameSaving(true);
    try {
      const res = await oilApiFetch("/api/oil-profile", {
        method: "POST",
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsernameSaved(true);
    } catch (err) {
      console.error("Failed to save username:", err);
    } finally {
      setUsernameSaving(false);
    }
  }, [user?.id, username, userDrill, oilApiFetch]);

  // Reset the "SAVED" confirmation once the name is edited again.
  useEffect(() => { setUsernameSaved(false); }, [username]);

  // Countdown timer to next 00:00 UTC
  // Countdown timer moved to isolated DrillCountdown component to avoid full-page re-renders

  const todayUTC = new Date().toISOString().slice(0, 10);

  // ── Passive depth computation (time-based, no clicking) ──
  // Base-depth ceiling reached so far, paced by the season clock (not a flat
  // 1/day). The rig fills its full depthCap = PASSIVE_DRILLS + bonus across the
  // whole season; actual depth is server-driven (oilPlots.drillDay) — this is the
  // display/ceiling estimate. See docs/oil-game.md → "TIMING FRAMEWORK".
  const passiveDepth = useMemo(() => {
    if (!gameStartDate) return 0;
    const start = new Date(gameStartDate + "T00:00:00Z").getTime();
    const lenMs = (seasonLengthDays > 0 ? seasonLengthDays : 10) * 86400000;
    const progress = Math.min(Math.max((Date.now() - start) / lenMs, 0), 1);
    return Math.min(Math.round(progress * PASSIVE_DRILLS), PASSIVE_DRILLS);
  }, [gameStartDate, seasonLengthDays, todayUTC]);

  // Current season day, derived from the clock — "DAY N" of seasonLengthDays.
  // Clamped to [1, seasonLengthDays] so it never reads e.g. "Day 15 / 10".
  const gameDay = useMemo(() => {
    if (!gameStartDate) return 1;
    const start = new Date(gameStartDate + "T00:00:00Z").getTime();
    const len = seasonLengthDays > 0 ? seasonLengthDays : 10;
    const day = Math.floor((Date.now() - start) / 86400000) + 1;
    return Math.min(Math.max(day, 1), len);
  }, [gameStartDate, seasonLengthDays, todayUTC]);

  // Test mode: DAILY TICKET prizes land here (a bonus drill is a bonus drill)
  // and in the FIELD ACTIVITY feed; the real version writes the drill doc.
  const [testBonusDrills, setTestBonusDrills] = useState(0);
  const [testTimelineEvents, setTestTimelineEvents] = useState([]);
  const bonusDrills = (userDrill?.bonusDrills ?? 0) + (isTest ? testBonusDrills : 0);
  const playerDepth = Math.min(passiveDepth + bonusDrills, MAX_DEPTH);
  const onTicketSettle = useCallback((r) => {
    if (!isTest || !r?.win) return; // wins only — a loss stays on the ticket
    if (r.tier === "jackpot") setTestBonusDrills((n) => n + 3);
    else if (r.sym === "pickaxe") setTestBonusDrills((n) => n + 1);
    setTestTimelineEvents((prev) => [{
      id: `test-ticket-${r.ticketNo}-${prev.length}`,
      type: r.tier === "jackpot" ? "ticket_jackpot" : "ticket",
      username: "YOU (TEST)",
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      detail: `ticket ${r.ticketNo} · three ${r.symName.toLowerCase()}s · ${r.prize.toLowerCase()}`,
    }, ...prev].slice(0, 10));
  }, [isTest]);

  // In test mode, synthesize a userDrill from the selected cell
  const activeUserDrill = isTest && selectedX !== null
    ? { col: selectedX, row: sliceY, drillDay: testDay, lastDrillDate: null, lastDrainExtracted: 0, totalCollected: 0, tankDrains: 0, tankOil: null }
    : userDrill;

  // Cell depth from oilPlots (persists across owners) — or computed playerDepth for active players
  const cellDepth = userPlotState?.drillDay ?? userDrill?.drillDay ?? 0;

  // Reset reviewDay when drill depth advances
  useEffect(() => { setReviewDay(null); }, [cellDepth]);

  // Effective drill day: active mode uses actual cell depth (click-drilled), admin/report uses demoDay, test uses testDay
  const effectiveDrillDay = (isAdmin || isReport) ? demoDay
    : isTest ? testDay
    : (reviewDay !== null ? reviewDay : cellDepth);

  // Feed live game data into the vendors' greeting context: lines with
  // {tokens} only enter a vendor's pool once their datum exists here, so
  // adding a token to this object is all it takes to unlock new lines.
  useEffect(() => {
    // day: null before the season starts (day 0) — keeps "Day {day}" lines
    // out of the pools rather than speaking "Day 0".
    setVendorGreetingContext({ day: effectiveDrillDay > 0 ? effectiveDrillDay : null });
  }, [effectiveDrillDay]);

  // Drill status — click-to-drill, but ceiling is time-gated (passiveDepth + bonusDrills)
  const drillStatus = useMemo(() => {
    if (!user && !isTest) return "sign-in";
    if (isSummonerStunned) return "stunned";
    if (isBlockadeActive) return "blockade";
    if (gamePhase === "ticket_sale") return "pre-game";
    // A real player with no plot (e.g. just released) has no rig — prompt a claim
    // instead of treating the null col as plot (0,0) and rendering a phantom rig.
    if (!isAdmin && !isTest && !isReport && userDrill?.col == null) return "no-claim";
    if (selectedX === null && userDrill?.col != null) return "wrong-claim";
    if (selectedX === null) return "no-claim";
    // Only "wrong-claim" if the rig is actually on a DIFFERENT plot — a null col
    // (no plot) must not read as plot (0,0).
    if (userDrill?.col != null && (userDrill.col !== selectedX || userDrill.row !== sliceY)) return "wrong-claim";
    const currentDepth = userPlotState?.drillDay ?? userDrill?.drillDay ?? 0;
    if (currentDepth >= MAX_DEPTH) return "max-depth";
    // Continuous-pump model: real players don't click to drill — the rig strikes
    // once a day on its own. Admin/test keep manual drilling for verification.
    if (!isAdmin && !isTest && !isReport) {
      return userDrill?.rigDepleted ? "max-depth" : "auto-pumping";
    }
    if (currentDepth >= playerDepth) return "depth-ceiling";
    return "ready";
  }, [user, gamePhase, selectedX, sliceY, userDrill, userPlotState, playerDepth, isSummonerStunned, isBlockadeActive, isAdmin, isTest, isReport]);

  // ── WHILE YOU WERE AWAY recap ──────────────────────────────────────────────
  // The landing payoff for a returning player: diff the current rig state
  // against a localStorage baseline from the last visit (depth via the
  // server-authoritative oilPlots.revealed map — exact per-layer oil, no new
  // server work) + field events from the timeline + unread plot messages.
  // Shows once per absence (≥30 min away, something notable), then re-baselines.
  // Preview hooks: ?recap=1 forces it with real data over a synthetic 26h
  // window; ?recap=demo renders a fully synthetic showcase.
  const [awayRecap, setAwayRecap] = useState(null);

  // ── The Concretion: artifact reveal modal (docs/artifact-expansion.md) ──────
  // Keyed off lastStrikeArtifact + lastStrikeAt so it fires ONLY for finds
  // credited to THIS player — claim-jumping onto a pre-dug plot never pops
  // someone else's finds. localStorage remembers the last-opened strike time
  // (same pattern as the away-recap baseline); multiple finds while away show
  // only the latest here — the recap covers the batch.
  const [pendingConcretion, setPendingConcretion] = useState(null);
  useEffect(() => {
    const a = userDrill?.lastStrikeArtifact;
    const at = userDrill?.lastStrikeAt?.toMillis?.() ?? null;
    if (!a || !at || previewMode) return;
    let last = 0;
    try { last = Number(localStorage.getItem("hmpc_concretion_opened") || 0); } catch {}
    if (at > last) setPendingConcretion({ ...a, at });
  }, [userDrill?.lastStrikeAt, userDrill?.lastStrikeArtifact, previewMode]);
  const dismissConcretion = () => {
    try { if (pendingConcretion?.at) localStorage.setItem("hmpc_concretion_opened", String(pendingConcretion.at)); } catch {}
    setPendingConcretion(null);
  };
  const awayRecapRanRef = useRef(false);
  useEffect(() => {
    if (awayRecapRanRef.current || typeof window === "undefined") return;
    if (!settingsLoaded || !drillLoaded || !timelineLoaded) return;
    const force = new URLSearchParams(window.location.search).get("recap");

    if (force === "demo") {
      awayRecapRanRef.current = true;
      setAwayRecap({
        demo: true,
        awayMs: 26.5 * 3600 * 1000,
        fromDepth: 9, toDepth: 12,
        strikes: [{ layer: 10, oil: 1840 }, { layer: 9, oil: 320 }],
        oilGained: 2160, hellHit: false,
        tank: 2840, tankDelta: 2160, bankedDelta: 0,
        fieldEvents: [
          { type: "gusher", username: "DustyDan" },
          { type: "contain", username: "R80Hunter" },
          { type: "claim", username: "NewProspector" },
        ],
        fieldEventCount: 7, unreadCount: 2,
      });
      return;
    }

    if (gamePhase !== "active") { awayRecapRanRef.current = true; return; }
    if (!force && (isAdmin || isTest || isReport || previewMode)) { awayRecapRanRef.current = true; return; }
    if (!user?.id || userDrill?.col == null) return; // needs a real rig
    if (!userPlotState) return;                      // wait for the plot doc
    awayRecapRanRef.current = true;

    const KEY = "oil_away_v1";
    const now = Date.now();
    const cur = {
      at: now, col: userDrill.col, row: userDrill.row,
      depth: userPlotState.drillDay || 0,
      tank: userDrill.tankOil ?? 0,
      banked: userDrill.totalCollected || 0,
    };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* private mode */ } };
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* corrupt baseline */ }
    if (force === "1") {
      prev = { at: now - 26 * 3600 * 1000, col: cur.col, row: cur.row, depth: Math.max(0, cur.depth - 3), tank: 0, banked: cur.banked };
    }

    // First visit on this rig (or claim-jumped since) — just set the baseline.
    if (!prev || prev.col !== cur.col || prev.row !== cur.row) { save(); return; }
    const awayMs = now - prev.at;
    if (!force && awayMs < 30 * 60 * 1000) { save(); return; } // they just saw it

    const revealed = userPlotState.revealed || {};
    const hells = userPlotState.hellLayers || {};
    const arts = userPlotState.revealedArtifacts || {};
    const strikes = [];
    const artifactsFound = [];
    let oilGained = 0, hellHit = false;
    for (let L = prev.depth; L < cur.depth; L++) {
      const oil = Number(revealed[L] ?? revealed[String(L)] ?? 0);
      if (oil > 0) strikes.push({ layer: L, oil });
      oilGained += oil;
      if (hells[L] || hells[String(L)]) hellHit = true;
      const art = arts[L] ?? arts[String(L)];
      if (art) artifactsFound.push({ layer: L, ...art });
    }
    const fieldEvents = timelineEvents.filter((ev) => {
      const t = ev.createdAt?.toMillis?.() ?? (ev.createdAt?.seconds ? ev.createdAt.seconds * 1000 : 0);
      return t > prev.at && ev.userId !== user.id;
    });
    const unreadCount = Object.keys(plotsWithMessages).length;
    const bankedDelta = Math.max(0, cur.banked - prev.banked);
    const notable = strikes.length > 0 || artifactsFound.length > 0 || cur.depth > prev.depth || bankedDelta > 0 || fieldEvents.length > 0 || unreadCount > 0;

    if (force === "1" || notable) {
      setAwayRecap({
        awayMs, fromDepth: prev.depth, toDepth: cur.depth, strikes, oilGained, hellHit,
        artifactsFound,
        tank: cur.tank, tankDelta: cur.tank - prev.tank, bankedDelta,
        fieldEvents: fieldEvents.slice(0, 4).map(({ type, username, detail }) => ({ type, username, detail })),
        fieldEventCount: fieldEvents.length, unreadCount,
      });
    }
    if (!force) save();
  }, [settingsLoaded, drillLoaded, timelineLoaded, gamePhase, user?.id, userDrill, userPlotState, timelineEvents, plotsWithMessages, isAdmin, isTest, isReport, previewMode]);

  // ── Season-end FINAL HAUL share card ────────────────────────────────────────
  // The payout receipt moment: when the season ends, a player's result becomes
  // a shareable artifact ("I got paid by a pumpjack") — the best acquisition
  // creative the game produces. Card → PNG → clipboard → X compose w/ ref link.
  const finalHaulRef = useRef(null);
  const [haulShareNote, setHaulShareNote] = useState(null);
  const shareFinalHaul = useCallback(async (score, usdValue, refCode) => {
    try {
      setHaulShareNote("Capturing…");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(finalHaulRef.current, { scale: 2, backgroundColor: "#140b1c", useCORS: true });
      const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      let copied = false;
      if (pngBlob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
          copied = true;
        } catch { /* clipboard blocked — text share still works */ }
      }
      setHaulShareNote(copied ? "Card copied! Paste it into your post (Cmd+V)" : null);
      if (copied) await new Promise((r) => setTimeout(r, 1200));
      const text = `Final haul: ${score.toLocaleString()} Lyquid80 (≈ $${usdValue.toFixed(2)} USDC, paid to my wallet) ⛏ Hail Mary Prospecting Co.\n\nNext season: rl80.com/hailmary${refCode ? `?ref=${refCode}` : ""}`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=550,height=420");
      setTimeout(() => setHaulShareNote(null), 4000);
    } catch (err) {
      console.error("final haul share failed:", err);
      setHaulShareNote(null);
    }
  }, []);

  // Panel collapse for full 3D view
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);

  // Pimp My Pump customization
  const [pumpConfig, setPumpConfig] = useState(() => getDefaultPumpConfig());
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const cctvCanvasRef = useRef(null);
  const [cctvOpen, setCctvOpen] = useState(true);
  // Use the cell owner's ID for recording attribution (admin records on behalf of camera owner)
  const cellOwnerId = selectedX !== null ? (allPumpConfigs[`${selectedX}_${sliceY}`]?.userId || user?.id) : user?.id;
  const { isRecording, recordings, playbackUrl, setPlaybackUrl, startRecording, stopRecording } = useCctvRecorder(cctvCanvasRef, selectedX, sliceY, cellOwnerId);

  // CCTV privacy: only the plot's owner sees the live camera feed. Admin/test/report
  // retain access for moderation + record-on-behalf. Visitors still see the camera
  // model on the rig, just no feed.
  const cameraViewable = isAdmin || isTest || isReport ||
    (selectedX !== null && !!user?.id &&
      allPumpConfigs[`${selectedX}_${sliceY}`]?.userId === user.id);

  // CCTV auto-record: triggered by rogue arrival callback + gusher effect
  const recordedEventsRef = useRef(new Set());

  // Rogue recording — fires when the rogue character actually arrives at the target cell
  const handleRogueArrive = useCallback((ev) => {
    // Check camera from allPumpConfigs (already loaded) — pumpConfig may still be loading
    const cellKey = `${ev.targetCol}_${ev.targetRow}`;
    const cellCfg = allPumpConfigs[cellKey]?.config;
    if (!cellCfg?.showCamera) return;
    if (recordedEventsRef.current.has(ev.id)) return;
    recordedEventsRef.current.add(ev.id);
    startRecording({ eventId: ev.id, eventType: "rogue", col: ev.targetCol, row: ev.targetRow });
  }, [allPumpConfigs, startRecording]);

  // Gusher recording — gushers appear instantly, so effect-based trigger is fine
  useEffect(() => {
    if (!pumpConfig.showCamera || gusherEvents.length === 0) return;
    for (const ev of gusherEvents) {
      if (recordedEventsRef.current.has(ev.id)) continue;
      if (ev.col === selectedX && ev.row === sliceY) {
        // Step 2 — a small "strike" (seep) isn't worth a CCTV clip; mark it seen
        // so we don't reconsider it, and reserve recordings for gusher+.
        if (ev.tier === "strike") { recordedEventsRef.current.add(ev.id); continue; }
        recordedEventsRef.current.add(ev.id);
        startRecording({ eventId: ev.id, eventType: "gusher", col: ev.col, row: ev.row });
        break;
      }
    }
  }, [gusherEvents, selectedX, sliceY, pumpConfig.showCamera, startRecording]);

  // Rogue consequence — apply addon deletion / graffiti / poop when rogue reaches target
  const consequenceAppliedRef = useRef(new Set());
  const handleRogueConsequence = useCallback((ev) => {
    if (previewModeRef.current) return;
    if (!ev.consequence || consequenceAppliedRef.current.has(ev.id)) return;
    consequenceAppliedRef.current.add(ev.id);
    const { type, plotDocId, addonSlot } = ev.consequence;
    if (!plotDocId || !db) return;

    // Delay so the attack animation plays before the item vanishes
    setTimeout(async () => {
    try {
      if (type === "delete_addon" && addonSlot) {
        const { deleteField } = await import("firebase/firestore");
        await updateDoc(doc(db, "pumpConfigs", plotDocId), {
          [`config.addons.${addonSlot}`]: deleteField(),
          updatedAt: serverTimestamp(),
        });
      } else if (type === "graffiti") {
        await updateDoc(doc(db, "pumpConfigs", plotDocId), {
          "config.graffiti": true,
          updatedAt: serverTimestamp(),
        });
      } else if (type === "poop") {
        await updateDoc(doc(db, "pumpConfigs", plotDocId), {
          "config.poop": true,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Failed to apply rogue consequence:", err);
    }
    }, 2000);
  }, []);

  // Track unsaved changes
  const handleConfigChange = useCallback((newConfig) => {
    setPumpConfig(newConfig);
    setConfigDirty(true);
  }, []);

  // Build Firestore doc ID from user + rig cell
  const getConfigDocId = useCallback((col, row) => {
    if (!user?.id) return null;
    return `${user.id}_${col}_${row}`;
  }, [user?.id]);

  // Load pump config for the selected cell (any player's config, not just yours)
  const [configOwnerId, setConfigOwnerId] = useState(null);
  useEffect(() => {
    if (!db || selectedX === null || sliceY === null) return;

    const q = query(
      collection(db, "pumpConfigs"),
      where("col", "==", selectedX),
      where("row", "==", sliceY)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setPumpConfig({ ...getDefaultPumpConfig(), ...data.config });
        setConfigOwnerId(data.userId || null);
      } else {
        setPumpConfig(getDefaultPumpConfig());
        setConfigOwnerId(null);
      }
      setConfigDirty(false);
    }, (err) => {
      console.error("Failed to load pump config:", err);
    });

    return unsub;
  }, [selectedX, sliceY]);

  // Can the current user edit this cell's config? Check oilPlots ownership first, fallback to pumpConfigs
  const plotOwnerForCell = selectedX !== null ? allPlotsMap[`${selectedX}_${sliceY}`]?.currentOwnerId : null;
  const isConfigOwner = !!user?.id && (plotOwnerForCell === user.id || (plotOwnerForCell == null && (configOwnerId === user.id || configOwnerId === null)));

  // Save pump config (called from SAVE button)
  const handleConfigSave = useCallback(async () => {
    if (previewModeRef.current) return;
    if (!user?.id || !db || selectedX === null || sliceY === null || !isConfigOwner) return;
    const docId = getConfigDocId(selectedX, sliceY);
    if (!docId) return;

    setConfigSaving(true);
    try {
      let configToSave = { ...pumpConfig };

      // If there's a sign image blob, upload to Storage first
      if (configToSave.signImageUrl?.startsWith("blob:")) {
        const resp = await fetch(configToSave.signImageUrl);
        const blob = await resp.blob();
        const ext = blob.type.split("/")[1] || "png";
        const path = `signImages/${user.id}/${selectedX}_${sliceY}.${ext}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        configToSave.signImageUrl = await getDownloadURL(storageRef);
        // Update local state with the permanent URL
        setPumpConfig(configToSave);
      }

      await setDoc(doc(db, "pumpConfigs", docId), {
        userId: user.id,
        col: selectedX,
        row: sliceY,
        config: configToSave,
        updatedAt: serverTimestamp(),
      });
      setConfigDirty(false);
    } catch (err) {
      console.error("Failed to save pump config:", err);
    } finally {
      setConfigSaving(false);
    }
  }, [user?.id, selectedX, sliceY, pumpConfig, getConfigDocId, isConfigOwner]);

  // Admin/test bypass: claim the selected plot for the logged-in user (skips the
  // RL80 qualification flow) so you can edit/test your own rig — e.g. sign uploads.
  const handleAdminClaim = useCallback(async () => {
    if (selectedX === null || sliceY === null || !user?.id) return;
    try {
      const resp = await fetch("/api/oil-admin-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: adminPassword,
          userId: user.id,
          username: user?.username || user?.firstName || "admin",
          col: selectedX,
          row: sliceY,
        }),
      });
      const data = await resp.json();
      if (!data.ok) alert(`Claim failed: ${data.error || resp.status}`);
      // Firestore listeners pick up the new ownership → panel becomes editable.
    } catch (e) {
      alert(`Claim error: ${e.message}`);
    }
  }, [selectedX, sliceY, user?.id, user?.username, user?.firstName, adminPassword]);

  // Camera fly-to
  const [flyTarget, setFlyTarget] = useState(null);
  // Phase-2 helicopter auto-orbit while the demon is loose (mobile). Driven as a
  // React prop on OrbitControls so frequent re-renders can't silently reset it.
  const [hellOrbit, setHellOrbit] = useState(false);
  const controlsRef = useRef();
  const controlsRefMobile = useRef();

  // Only admin / report / test may compute the field from the seed. Normal
  // players run disabled and render purely from server-revealed data, so the
  // seed never has to reach (or be computed on) their client.
  const seedVisible = (isAdmin || isReport || isTest) && !previewAsPlayer;
  const stats = useClaimStats(blockHash, numberOfDeposits, totalOilBudget, gridSize, gridSize, seedVisible, numberOfHellPockets);

  // In active game mode, hide oil data from 2D views. `previewAsPlayer` lets an
  // admin force the reveal-only player view to test reveal-on-drill in place.
  const showOilData = (isAdmin || isReport) && !previewAsPlayer;

  // Community-visible grid: reveals oil data at every plot up to its drilled depth
  // ── Server-authoritative reveal (Slice 2) ─────────────────────────────────
  // For normal players the field is assembled from what the SERVER has revealed
  // into oilPlots (`revealed`/`hellLayers`), never recomputed from the seed.
  // Admin/report (showOilData) still see the full seed-computed truth.

  // Seed-free cell skeleton in the exact (y desc, x asc) order the surface map
  // renders by array position — structure only, no oil values. Mirrors the
  // ordering useClaimStats uses so the grid never scrambles when stats is gone.
  const claimOrder = useMemo(() => {
    const list = [];
    for (let y = gridSize - 1; y >= 0; y--)
      for (let x = 0; x < gridSize; x++)
        list.push({ x, y, index: y * gridSize + x, claim: y * gridSize + x + 1 });
    return list;
  }, [gridSize]);

  // 3D oil grid assembled from the server's per-cell reveals (seed-free).
  const revealedGrid3D = useMemo(() => {
    const g = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => new Array(DEPTH_Z).fill(0)));
    for (const key in allPlotsMap) {
      const rev = allPlotsMap[key]?.revealed;
      if (!rev) continue;
      const us = key.indexOf("_");
      const cx = Number(key.slice(0, us)), cy = Number(key.slice(us + 1));
      if (!g[cx]?.[cy]) continue;
      for (const zStr in rev) {
        const z = Number(zStr);
        if (z >= 0 && z < DEPTH_Z) g[cx][cy][z] = rev[zStr] ?? 0;
      }
    }
    return g;
  }, [allPlotsMap, gridSize]);

  // Hell layers revealed by the server: "x_y_z" → true (seed-free).
  const revealedHellMap = useMemo(() => {
    const m = {};
    for (const key in allPlotsMap) {
      const hl = allPlotsMap[key]?.hellLayers;
      if (!hl) continue;
      const us = key.indexOf("_");
      const cx = Number(key.slice(0, us)), cy = Number(key.slice(us + 1));
      for (const zStr in hl) if (hl[zStr]) m[`${cx}_${cy}_${Number(zStr)}`] = true;
    }
    return m;
  }, [allPlotsMap]);

  // Artifacts revealed by the server (docs/artifact-expansion.md): "x_y" →
  // [{ z, type, ... }] sorted by depth. Seed-free, like the hell map — the
  // client only ever sees what the strike-tick has written into oilPlots.
  const revealedArtifactsByPlot = useMemo(() => {
    const m = {};
    for (const key in allPlotsMap) {
      const ra = allPlotsMap[key]?.revealedArtifacts;
      if (!ra) continue;
      const marks = [];
      for (const zStr in ra) marks.push({ z: Number(zStr), ...ra[zStr] });
      marks.sort((a, b) => a.z - b.z);
      m[key] = marks;
    }
    return m;
  }, [allPlotsMap]);

  // Single source switch for every player-facing oil read: seed-visible modes
  // (admin / report / test sandbox) see the full seed-computed field; real
  // players see only what the server has revealed into oilPlots.
  const displayGrid3D = seedVisible ? stats.grid3D : revealedGrid3D;
  const displayHellMap = seedVisible ? stats.hellMap : revealedHellMap;

  const communityGrid3D = displayGrid3D;

  const communityClaimTotals = useMemo(() => {
    if (seedVisible) return stats.claimTotals;
    return claimOrder.map((c) => {
      let sum = 0;
      for (let z = 0; z < DEPTH_Z; z++) sum += revealedGrid3D[c.x]?.[c.y]?.[z] ?? 0;
      return { ...c, oil: sum, total: sum };
    });
  }, [seedVisible, stats.claimTotals, claimOrder, revealedGrid3D]);

  // Max claim total for surface-map heatmap normalization. Equals
  // stats.maxClaimTotal in seed-visible modes; for players it's the richest
  // revealed claim so the discovered heatmap still scales correctly.
  const communityMaxClaimTotal = useMemo(
    () => communityClaimTotals.reduce((m, c) => (c.total > m ? c.total : m), 0),
    [communityClaimTotals],
  );

  const communityMaxOil = useMemo(() => {
    let max = 0;
    for (let x = 0; x < gridSize; x++)
      for (let y = 0; y < gridSize; y++)
        for (let z = 0; z < DEPTH_Z; z++)
          if (communityGrid3D[x]?.[y]?.[z] > max) max = communityGrid3D[x][y][z];
    return max;
  }, [communityGrid3D, gridSize]);

  // Max cell value + hell pockets for the player-facing display (revealed) vs
  // admin/report (full seed truth).
  const displayMaxOil = seedVisible ? stats.maxOil : communityMaxOil;
  const displayHellPockets = useMemo(() => {
    if (seedVisible) return stats.hellPockets;
    const arr = [];
    for (const k in revealedHellMap) {
      const p = k.split("_");
      arr.push({ x: Number(p[0]), y: Number(p[1]), z: Number(p[2]) });
    }
    return arr;
  }, [seedVisible, stats.hellPockets, revealedHellMap]);

  // Player extracted oil total
  const playerExtracted = useMemo(() => {
    if (!activeUserDrill || effectiveDrillDay === 0) return 0;
    let total = 0;
    for (let z = 0; z < Math.min(effectiveDrillDay, DEPTH_Z); z++) {
      total += displayGrid3D[activeUserDrill.col]?.[activeUserDrill.row]?.[z] ?? 0;
    }
    return total;
  }, [activeUserDrill, effectiveDrillDay, displayGrid3D]);

  // Community hit rate: of the cells drilled so far, the % that struck oil.
  // Computed from revealed data (not the seed) so it leaks nothing about the
  // undrilled field. Admin/report keep the whole-field figure.
  const hitRate = useMemo(() => {
    if (seedVisible) {
      return stats.claimTotals.length > 0
        ? Math.round(((gridSize * gridSize - stats.dryClaims) / (gridSize * gridSize)) * 100)
        : 0;
    }
    let drilled = 0, hit = 0;
    for (const key in allPlotsMap) {
      if ((allPlotsMap[key]?.drillDay ?? 0) <= 0) continue;
      drilled++;
      const rev = allPlotsMap[key].revealed || {};
      if (Object.values(rev).some((v) => v > 0)) hit++;
    }
    return drilled > 0 ? Math.round((hit / drilled) * 100) : 0;
  }, [seedVisible, stats.claimTotals, stats.dryClaims, allPlotsMap, gridSize]);

  const selectedClaimIndex = selectedX !== null ? sliceY * gridSize + selectedX : null;
  // Cross-section highlight column: the active selection, or fall back to the
  // player's own claim column so it always marks the same column the surface map
  // emphasizes (the isMine plot) even when nothing is actively selected.
  const xsecCol = selectedX !== null ? selectedX : (userDrill?.col ?? myPlot?.col ?? null);

  // Session-local drain tracking (declared early — used by hell pocket detection)
  const [tankDrained, setTankDrained] = useState(false);
  const [lastDrainSnapshot, setLastDrainSnapshot] = useState(0);
  // Admin Test Gusher: force the local tank to full so the full-tank UI + overflow
  // gusher can be previewed/screenshotted. Set when the Test Gusher fires and
  // self-clears a few seconds later (see the gusherTest effect below).
  const [testTankFull, setTestTankFull] = useState(false);

  // ── Hell pocket state ──
  // Local visual state is driven by either:
  // 1. The Firestore demonBounty listener (multiplayer — all clients see it)
  // 2. Local detection for admin/test mode (single-player preview)
  const [hellActive, setHellActive] = useState(false);
  const [hellCol, setHellCol] = useState(null);
  const [hellRow, setHellRow] = useState(null);
  const hellTimeoutRef = useRef(null);
  const prevEnvPresetRef = useRef(null);

  // Sync hell visuals from Firestore demonBounty (multiplayer)
  useEffect(() => {
    if (demonBounty && ["active", "flying", "waiting"].includes(demonBounty.status)) {
      if (!hellActive) prevEnvPresetRef.current = envPreset;
      setEnvPreset("hell");
      setHellActive(true);
      setHellCol(demonBounty.summonerCol);
      setHellRow(demonBounty.summonerRow);
    } else if (!demonBounty && hellActive && !hellTimeoutRef.current) {
      setHellActive(false);
      setHellCol(null);
      setHellRow(null);
      setEnvPreset(prevEnvPresetRef.current || "day");
    }
  }, [demonBounty]);

  // Reactive hell pocket detection — admin/test get an immediate local preview;
  // for real players the server strike-tick is authoritative (the demon is
  // summoned server-side and visuals come from the demonBounty listener).
  const lastHellCheckRef = useRef(null);
  useEffect(() => {
    // Which cell + depth represents the player drilling into a hell pocket?
    // Real players: their OWN plot at their OWN drill depth — so merely
    // inspecting/selecting other cells around the grid never summons a demon.
    // Test/admin: the selected cell, so it can be triggered on demand.
    const useSelection = isTest || isAdmin;
    const col = useSelection ? selectedX : userDrill?.col;
    const row = useSelection ? sliceY : userDrill?.row;
    const depth = useSelection ? effectiveDrillDay : (userDrill?.drillDay ?? 0);
    if (col == null || row == null || depth === 0) return;
    const checkKey = `${col}_${row}_${depth}`;
    if (checkKey === lastHellCheckRef.current) return;
    lastHellCheckRef.current = checkKey;
    // Only the just-drilled (deepest) layer counts as "drilling into" the
    // pocket. Scanning every layer would re-summon a demon on every drill that
    // goes deeper than a pocket you already passed.
    {
      const z = depth - 1;
      const hellKey = `${col}_${row}_${z}`;
      if (displayHellMap[hellKey] && !hellActive) {
        // Real players: the SERVER strike-tick summons the demon when a rig
        // strikes a hell layer (server-authoritative), and the demonBounty
        // listener above drives the visuals — no client call. Only admin/test
        // get an immediate local-only preview here.
        if (isAdmin || isTest) {
          prevEnvPresetRef.current = envPreset;
          setEnvPreset("hell");
          setHellActive(true);
          setHellCol(col);
          setHellRow(row);
          if (hellTimeoutRef.current) clearTimeout(hellTimeoutRef.current);
          // Long safety net only — in test/admin mode the demon should normally
          // be cleared by catching it (handleClaimBounty), not by this timeout.
          hellTimeoutRef.current = setTimeout(() => {
            setHellActive(false);
            setHellCol(null);
            setHellRow(null);
            setEnvPreset(prevEnvPresetRef.current || "day");
            hellTimeoutRef.current = null;
          }, 90000);
        }
      }
    }
  }, [selectedX, sliceY, effectiveDrillDay, userDrill, displayHellMap, hellActive, envPreset, isAdmin, isTest]);

  // Admin/test: fire (or clear) the hell-portal effect at the selected cell on
  // demand — a local preview, no claim/strike/demon required. Mirrors the
  // reactive local-preview block above; sets hellTimeoutRef so the demonBounty
  // sync effect doesn't immediately clear it.
  const handleTestHell = useCallback(() => {
    if (hellActive) {
      if (hellTimeoutRef.current) { clearTimeout(hellTimeoutRef.current); hellTimeoutRef.current = null; }
      setHellActive(false);
      setHellCol(null);
      setHellRow(null);
      setEnvPreset(prevEnvPresetRef.current || "day");
      return;
    }
    if (selectedX === null) return;
    prevEnvPresetRef.current = envPreset;
    setEnvPreset("hell");
    setHellActive(true);
    setHellCol(selectedX);
    setHellRow(sliceY);
    if (hellTimeoutRef.current) clearTimeout(hellTimeoutRef.current);
    hellTimeoutRef.current = setTimeout(() => {
      setHellActive(false);
      setHellCol(null);
      setHellRow(null);
      setEnvPreset(prevEnvPresetRef.current || "day");
      hellTimeoutRef.current = null;
    }, 90000);
  }, [hellActive, selectedX, sliceY, envPreset]);

  // Mobile: two-phase camera pull-back while the demon is loose. The close
  // focused-rig view leaves the erupting demon too high in frame and loses it as
  // it roams, so phase 1 dollies back a little for the demon's elaborate entrance
  // (~5s), then phase 2 pulls all the way out to the field overview once it starts
  // roaming. The prior view is captured and restored when the demon is banished.
  const hellPhase2Timer = useRef(null);
  const hellOrbitTimer = useRef(null);
  const prevHellForCamRef = useRef(false);
  useEffect(() => {
    if (!isMobile) {
      prevHellForCamRef.current = hellActive;
      return;
    }
    if (hellActive && !prevHellForCamRef.current) {
      // Phase 1 — frame the summoner's rig (where the demon erupts) using the
      // same grid→world math as handleFlyTo.
      const col = hellCol ?? userDrill?.col ?? myPlot?.col ?? 0;
      const row = hellRow ?? userDrill?.row ?? myPlot?.row ?? 0;
      const worldW = gridSize * CELL_SIZE;
      const worldD = gridSize * CELL_SIZE;
      const x = -worldW / 2 + col * CELL_SIZE + CELL_SIZE / 2;
      const z = worldD / 2 - row * CELL_SIZE - CELL_SIZE / 2;
      flyIdRef.current++;
      setFlyTarget({ x, y: 1.3, z, id: flyIdRef.current, mobile: true, hellView: true, phase: "near" });
      if (hellPhase2Timer.current) clearTimeout(hellPhase2Timer.current);
      if (hellOrbitTimer.current) clearTimeout(hellOrbitTimer.current);
      hellPhase2Timer.current = setTimeout(() => {
        // Phase 2 — slow, cinematic pull-back to the helicopter vantage...
        flyIdRef.current++;
        setFlyTarget({ id: flyIdRef.current, mobile: true, hellView: true, phase: "far", flySpeed: 0.2 });
        hellPhase2Timer.current = null;
        // ...then, once the pull-back has settled, start the auto-orbit (driven
        // via the OrbitControls autoRotate prop so React re-renders don't reset it).
        hellOrbitTimer.current = setTimeout(() => {
          setHellOrbit(true);
          hellOrbitTimer.current = null;
        }, 3200);
      }, 7000);
    } else if (!hellActive && prevHellForCamRef.current) {
      if (hellPhase2Timer.current) { clearTimeout(hellPhase2Timer.current); hellPhase2Timer.current = null; }
      if (hellOrbitTimer.current) { clearTimeout(hellOrbitTimer.current); hellOrbitTimer.current = null; }
      setHellOrbit(false);
      flyIdRef.current++;
      setFlyTarget({ id: flyIdRef.current, mobile: true, restoreView: true });
    }
    prevHellForCamRef.current = hellActive;
  }, [hellActive, isMobile, hellCol, hellRow, gridSize, userDrill, myPlot]);

  // Reset drained state when cell or drill depth changes
  useEffect(() => {
    setTankDrained(false);
  }, [selectedX, sliceY, effectiveDrillDay]);

  // Initialize drain snapshot from Firestore on load (only for real player mode)
  useEffect(() => {
    if (!isTest && userDrill?.lastDrainExtracted) {
      setLastDrainSnapshot(userDrill.lastDrainExtracted);
    }
  }, [isTest, userDrill?.lastDrainExtracted]);

  // Reset drain snapshot when switching cells
  useEffect(() => {
    if (isTest) setLastDrainSnapshot(0);
  }, [isTest, selectedX, sliceY]);

  // Oil currently in tank. The strike loop writes an explicit `tankOil` accumulator
  // (only the layers THIS rig struck — correct across claim-jumps to pre-drilled
  // cells). Fall back to the legacy derived model for data predating the loop.
  const oilInTank = useMemo(() => {
    // Admin Test Gusher override — show a full tank for the preview/screenshot.
    // Display-only: the drain API is server-authoritative, so this never persists.
    if (testTankFull) return TANK_CAPACITY;
    // The strike loop's authoritative tankOil wins whenever it exists — for real
    // players AND for an admin/test rig that's actually been struck (so the tank
    // reflects FORCE STRIKE). Fall back to the legacy demo-derived value only
    // when there's no server tank (pure demoDay/testDay simulation).
    if (userDrill?.tankOil != null) {
      return Math.max(0, userDrill.tankOil);
    }
    if (playerExtracted === 0) return 0;
    return Math.max(0, playerExtracted - lastDrainSnapshot);
  }, [userDrill?.tankOil, playerExtracted, lastDrainSnapshot, testTankFull]);

  // Oil you've found = banked (totalCollected) + un-banked tank. This is what you
  // get paid for at the fixed rate below.
  const playerScore = useMemo(
    () => (activeUserDrill?.totalCollected || 0) + oilInTank,
    [activeUserDrill?.totalCollected, oilInTank],
  );
  // Fixed conversion: every oil unit is worth pot ÷ field (e.g. $500 ÷ 500K =
  // $0.001/unit → 1,000 oil = $1). The field is finite and deterministic, so total
  // liability is capped at the pot (only reached at 100% extraction); unfound oil is
  // never paid out (operator keeps it). Value depends ONLY on your own oil — no share
  // dilution, so referrals never shrink your take (docs/oil-game.md).
  const oilUsdRate = useMemo(
    () => (OIL_FIELD_UNITS > 0 ? totalOilBudget / OIL_FIELD_UNITS : 0),
    [totalOilBudget],
  );
  const oilValue = useMemo(() => playerScore * oilUsdRate, [playerScore, oilUsdRate]);
  // "≈ $X.XX" tag for any oil readout — the fixed rate makes every oil number
  // translatable to money, which is what makes the stakes feel real. Returns
  // null for zero/unknown so callers can simply skip the tag.
  const fmtOilUsd = (oil) => {
    if (!oilUsdRate || !(oil > 0)) return null;
    const v = oil * oilUsdRate;
    return `≈ $${v >= 0.01 ? v.toFixed(2) : v.toFixed(4)}`;
  };

  // Tank fill: fraction of oil in tank relative to capacity (100K tokens)
  // Can exceed 1.0 — gusher fires when it first crosses 1.0
  const tankFill = useMemo(() => oilInTank / TANK_CAPACITY, [oilInTank]);


  // Is the owner's own rig currently erupting? A live gusher event keeps the rig
  // gushing + the alert light strobing until shut off. The gusherEvents listener
  // already filters to status === "active", so a userId match is enough. Drives an
  // always-reachable shut-off so the gusher can be cleared even when the tank is
  // empty (the drain banks oil; clearing the gusher must not depend on having any).
  const myGusherActive = useMemo(
    () => !!user?.id && gusherEvents.some((ev) => ev.userId === user.id),
    [gusherEvents, user?.id]
  );

  // Active gusher event(s) on the currently selected cell, regardless of owner.
  // Backs an admin/test/report shut-off so a stuck gusher can be cleared in-app
  // (the normal player path is gated behind their own claim's tank panel).
  const selectedCellGushers = useMemo(
    () => gusherEvents.filter((ev) => ev.col === selectedX && ev.row === sliceY),
    [gusherEvents, selectedX, sliceY]
  );
  const handleShutOffGusher = useCallback(async () => {
    if (!db || selectedCellGushers.length === 0) return;
    try {
      await Promise.all(selectedCellGushers.map((ev) =>
        updateDoc(doc(db, "gusherEvents", ev.id), { status: "done" })
      ));
    } catch (e) {
      console.error("Failed to shut off gusher:", e);
    }
  }, [selectedCellGushers]);

  // ── Field Dispatch feed (admin-approved published polaroids) ────────────────
  // Read via /api/oil-feed (admin SDK) so it works regardless of whether the
  // firestore rules have been deployed, and refreshes after an admin publishes.
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedDispatchOpen, setFeedDispatchOpen] = useState(true);
  const [lightboxItem, setLightboxItem] = useState(null); // feed item shown enlarged
  useEffect(() => {
    if (!lightboxItem) return;
    const onKey = (e) => { if (e.key === "Escape") setLightboxItem(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxItem]);
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await fetch("/api/oil-feed");
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) setFeedItems(data.items);
    } catch (e) {
      console.error("[oil] feed load failed:", e);
    } finally {
      setFeedLoading(false);
    }
  }, []);
  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Admin moderation: the pending (approved:false) dispatch backlog. Loaded on
  // demand (password-gated) when the admin opens the panel.
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [moderatingId, setModeratingId] = useState(null);
  const loadPending = useCallback(async () => {
    if (!adminPassword) return;
    setPendingLoading(true);
    try {
      const res = await fetch("/api/oil-feed-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, action: "list" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) setPendingItems(data.items);
    } catch (e) {
      console.error("[oil] pending feed load failed:", e);
    } finally {
      setPendingLoading(false);
    }
  }, [adminPassword]);
  useEffect(() => { if (pendingOpen && adminPassword) loadPending(); }, [pendingOpen, adminPassword, loadPending]);
  const moderateDispatch = useCallback(async (id, action) => {
    if (!adminPassword || !id) return;
    setModeratingId(id);
    try {
      const res = await fetch("/api/oil-feed-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, action, id }),
      });
      if (res.ok) {
        setPendingItems((prev) => prev.filter((it) => it.id !== id));
        if (action === "approve") loadFeed(); // surface it in the public feed
      }
    } catch (e) {
      console.error("[oil] moderate failed:", e);
    } finally {
      setModeratingId(null);
    }
  }, [adminPassword, loadFeed]);
  const approveAllPending = useCallback(async () => {
    if (!adminPassword || pendingItems.length === 0) return;
    if (typeof window !== "undefined" && !window.confirm(`Approve all ${pendingItems.length} pending dispatch(es)? They'll go live in Field Dispatch.`)) return;
    setModeratingId("__all__");
    try {
      const res = await fetch("/api/oil-feed-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, action: "approve_all" }),
      });
      if (res.ok) { setPendingItems([]); loadFeed(); }
    } catch (e) {
      console.error("[oil] approve-all failed:", e);
    } finally {
      setModeratingId(null);
    }
  }, [adminPassword, pendingItems.length, loadFeed]);

  // ── Auto Polaroid captures on milestone events ──────────────────────────────
  // When a player's own rig strikes a gusher or unleashes Hell, automatically
  // pop the shareable Polaroid AND persist it to the public feed — so the moment
  // is saved even for players who never tap Share (and attributed to the rig's
  // display name when there's no logged-in account). The overlay is the same one
  // the manual Snapshot button uses; `captureMeta` carries the event-specific
  // caption + the metadata we POST to /api/upload-polaroid.
  const [captureMeta, setCaptureMeta] = useState(null);
  const captureMetaRef = useRef(null);
  const capturedGusherRef = useRef(null); // last gusher event id auto-captured
  const capturedHellRef = useRef(null);   // last demon bounty id auto-captured
  // Admin toggle: also pop the Polaroid when the Test Gusher / Test Hell buttons
  // fire their local-only visual (those don't create real gusher/demon docs, so
  // the live auto-capture effects below never see them).
  const [captureOnTest, setCaptureOnTest] = useState(false);
  // Don't auto-capture events that were already live at page load (e.g. a refresh
  // mid-gusher) — only ones that fire after this short settle window.
  const autoCaptureReadyRef = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => { autoCaptureReadyRef.current = true; }, 2500);
    return () => clearTimeout(id);
  }, []);

  const snapshotLabel = captureMeta?.label ?? "Diversifying my investment portfolio!";

  // PHOTOMATIC booth print, handed up when it finishes developing on the booth
  // screen. While set, PolaroidSnapshot uses it as the photo instead of
  // capturing the WebGL canvas — every other trigger source clears it, so a
  // later manual screenshot can never accidentally reuse the booth photo.
  const [boothPhoto, setBoothPhoto] = useState(null);
  const handleBoothPhoto = useCallback((dataUrl, format) => {
    captureMetaRef.current = null; // never feed-persisted
    setCaptureMeta({ label: "Greetings from the boardwalk!" });
    // format "strip" = the composed 4-frame booth strip; PolaroidSnapshot
    // renders it tall instead of square-cropping it to death.
    setBoothPhoto({ url: dataUrl, format: format === "strip" ? "strip" : "square" });
    setSnapshotTrigger(true);
  }, []);

  // Manual Snapshot button: a plain capture, never persisted to the feed.
  const handleManualSnapshot = useCallback(() => {
    captureMetaRef.current = null;
    setCaptureMeta(null);
    setBoothPhoto(null);
    setSnapshotTrigger(true);
  }, []);

  // Fire an event capture: show the Polaroid with an event caption and flag it
  // for feed persistence (read back in onComplete via the ref).
  const fireEventCapture = useCallback((meta) => {
    captureMetaRef.current = meta;
    setCaptureMeta(meta);
    setBoothPhoto(null);
    setSnapshotTrigger(true);
  }, []);

  // Admin "Capture on Test": preview the themed Polaroid for the test visual.
  // persist:false → it pops the shareable overlay (Download/Share work) but does
  // NOT write to the public feed, so test presses don't pollute it.
  const fireTestCapture = useCallback((eventType) => {
    if (selectedX === null) return;
    const col = selectedX, row = sliceY;
    const meta = eventType === "hell"
      ? { eventType: "hell", label: pickCaption("hell"), col, row, persist: false }
      : { eventType: "gusher", label: pickCaption("gusher"), col, row, persist: false };
    // Let the eruption / hell portal reach a photogenic frame before grabbing it.
    // Hell waits an extra 2s on top: the demon emerges 2s after the effects begin
    // (DEMON_APPEAR_DELAY in OilVoxelGrid), so capture once it's out of the ground.
    const t = setTimeout(() => fireEventCapture(meta), eventType === "hell" ? 3500 : 1200);
    return () => clearTimeout(t);
  }, [selectedX, sliceY, fireEventCapture]);

  // Push a finished Polaroid (the composited webp data URL) to the public feed.
  // Best-effort + fire-and-forget — a failed upload must never disrupt play.
  const persistFeedSnapshot = useCallback(async (dataUrl, meta) => {
    if (!meta?.persist || typeof dataUrl !== "string") return;
    try {
      await fetch("/api/upload-polaroid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: dataUrl,
          metadata: {
            eventType: meta.eventType,
            userId: user?.id ?? null,
            username: username?.trim() || user?.firstName || "A Prospector",
            col: meta.col ?? null,
            row: meta.row ?? null,
            oilAmount: meta.oilAmount ?? null,
            caption: meta.label ?? null,
            referralCode: userDrill?.referralCode ?? null,
          },
        }),
      });
    } catch (e) {
      console.error("[oil] feed snapshot upload failed:", e);
    }
  }, [user?.id, username, userDrill?.referralCode]);

  // Shared onComplete for both layouts' Polaroid instances.
  const handleSnapshotComplete = useCallback((dataUrl) => {
    const meta = captureMetaRef.current;
    if (meta?.persist) persistFeedSnapshot(dataUrl, meta);
    setTimeout(() => {
      setSnapshotTrigger(false);
      setCaptureMeta(null);
      // Keep captureMetaRef holding this capture's context (eventType/col/row) so a
      // later admin "Publish to Feed" can attribute it — it's overwritten on the
      // next capture and cleared by handleManualSnapshot.
    }, 100);
  }, [persistFeedSnapshot]);

  // Admin "Publish to Feed": write the on-screen polaroid to oilFeed as an
  // approved (publicly visible) entry. Password-gated server-side, so this is the
  // only path that makes a capture public — a deliberate verify-then-publish step.
  const publishPolaroidToFeed = useCallback(async ({ dataUrl, caption } = {}) => {
    if (!dataUrl) return { ok: false, error: "no image" };
    const meta = captureMetaRef.current;
    try {
      const res = await fetch("/api/upload-polaroid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: dataUrl,
          password: adminPassword,
          metadata: {
            approved: true,
            // Manual Snapshot captures have no event meta → tag them "showcase"
            // so composition-variety shots read intentionally in the feed.
            eventType: meta?.eventType ?? "showcase",
            userId: user?.id ?? null,
            username: username?.trim() || user?.firstName || "A Prospector",
            col: meta?.col ?? selectedX ?? null,
            row: meta?.row ?? sliceY ?? null,
            caption: caption ?? meta?.label ?? null,
            referralCode: userDrill?.referralCode ?? null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
      loadFeed(); // surface the new entry in the Field Dispatch panel
      return { ok: true, url: data.storageUrl };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [adminPassword, user?.id, username, userDrill?.referralCode, selectedX, sliceY, loadFeed]);

  // Rising edge: the player's own rig erupts → celebratory gusher Polaroid.
  // Skipped in preview/test/admin so the feed isn't polluted with rehearsals.
  useEffect(() => {
    if (previewModeRef.current || isTest || isAdmin || !user?.id) return;
    const mine = gusherEvents.filter((ev) => ev.userId === user.id);
    const newest = mine.length
      ? mine.reduce((a, b) => ((b.createdAt?.seconds ?? 0) > (a.createdAt?.seconds ?? 0) ? b : a))
      : null;
    if (!autoCaptureReadyRef.current) {
      // Absorb whatever was already gushing at mount without firing a capture.
      if (newest) capturedGusherRef.current = newest.id;
      return;
    }
    if (!newest || capturedGusherRef.current === newest.id) return;
    capturedGusherRef.current = newest.id;
    // Step 2 — reserve the celebratory auto-Polaroid for the dramatic tiers. A
    // small "strike" (low seep) gets only the in-world seep + tank tick, no
    // capture; gusher and motherlode are photo-worthy.
    if (newest.tier === "strike") return;
    // Let the 3D eruption climb to a photogenic frame before grabbing it.
    const t = setTimeout(() => {
      fireEventCapture({
        eventType: "gusher",
        label: pickCaption("gusher"),
        oilAmount: newest.oilAmount ?? null,
        col: newest.col, row: newest.row,
        persist: true,
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [gusherEvents, user?.id, isTest, isAdmin, fireEventCapture]);

  // Rising edge: the player breaches a Hell pocket and summons the demon.
  useEffect(() => {
    if (previewModeRef.current || isTest || isAdmin || !user?.id) return;
    if (!demonBounty || demonBounty.summonerId !== user.id) return;
    if (!autoCaptureReadyRef.current) {
      capturedHellRef.current = demonBounty.id; // already loose at mount — skip
      return;
    }
    if (capturedHellRef.current === demonBounty.id) return;
    capturedHellRef.current = demonBounty.id;
    // The scene swaps to the hell preset + portal — give it a beat to ignite.
    const t = setTimeout(() => {
      fireEventCapture({
        eventType: "hell",
        label: pickCaption("hell"),
        col: demonBounty.summonerCol ?? null,
        row: demonBounty.summonerRow ?? null,
        persist: true,
      });
    }, 1700);
    return () => clearTimeout(t);
  }, [demonBounty, user?.id, isTest, isAdmin, fireEventCapture]);

  const selectedDepthData = useMemo(() => {
    if (selectedX === null || sliceY == null || !displayGrid3D[selectedX]?.[sliceY]) return null;
    const col = [];
    for (let z = 0; z < DEPTH_Z; z++) col.push(displayGrid3D[selectedX][sliceY][z]);
    return col;
  }, [displayGrid3D, selectedX, sliceY]);

  const selectedData = useMemo(() => {
    if (selectedDepthData === null) return null;
    const total = selectedDepthData.reduce((a, b) => a + b, 0);
    return {
      total,
      extracted: selectedDepthData.slice(0, drillDepth).reduce((a, b) => a + b, 0),
      missed: selectedDepthData.slice(drillDepth).reduce((a, b) => a + b, 0),
      depthData: selectedDepthData,
      richestDepth: selectedDepthData.indexOf(Math.max(...selectedDepthData)),
    };
  }, [selectedDepthData, drillDepth]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect oil strike: keyed by effectiveDrillDay so each layer triggers independently
  const oilStrikeDay = useRef(-1);
  const oilStrikeCell = useRef(null);
  const oilStrike = useMemo(() => {
    if (selectedX === null || effectiveDrillDay === 0) return 0;
    const cell = `${selectedX}_${sliceY}`;
    const depthIndex = effectiveDrillDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    // Selecting / zooming to a different rig changes effectiveDrillDay but is NOT
    // a strike — reset the baseline for the new cell and stay quiet.
    if (cell !== oilStrikeCell.current) {
      oilStrikeCell.current = cell;
      oilStrikeDay.current = effectiveDrillDay;
      return 0;
    }
    const oilAtDepth = displayGrid3D[selectedX]?.[sliceY]?.[depthIndex] ?? 0;
    if (oilAtDepth > 0 && effectiveDrillDay !== oilStrikeDay.current) {
      oilStrikeDay.current = effectiveDrillDay;
      return effectiveDrillDay; // unique trigger value per strike
    }
    return 0;
  }, [selectedX, sliceY, effectiveDrillDay, displayGrid3D]);

  const drilledOilValue = useMemo(() => {
    if (selectedX === null || effectiveDrillDay === 0) return 0;
    const depthIndex = effectiveDrillDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    return displayGrid3D[selectedX]?.[sliceY]?.[depthIndex] ?? 0;
  }, [selectedX, sliceY, effectiveDrillDay, displayGrid3D]);

  // Tank overflow gusher — fires once when tankFill first crosses 1.0
  const tankOverflowed = useRef(false);
  const [tankGusher, setTankGusher] = useState(0);

  useEffect(() => {
    if (tankFill >= 1.0 && !tankOverflowed.current) {
      tankOverflowed.current = true;
      setTankGusher((g) => g + 1);
    }
    if (tankFill < 1.0) {
      tankOverflowed.current = false;
    }
  }, [tankFill]);

  // Admin Test Gusher: each press fills the local tank to full (overflow UI +
  // sustained gusher) then self-clears ~7s later so the preview cleans itself up.
  // Keyed on the gusherTest counter so every press restarts the window; guards 0 so
  // it never fires on mount.
  useEffect(() => {
    if (gusherTest === 0) return;
    setTankDrained(false); // un-mask the bar if a prior drain zeroed it
    setTestTankFull(true);
    const id = setTimeout(() => setTestTankFull(false), 7000);
    return () => clearTimeout(id);
  }, [gusherTest]);

  // Combine oilStrike and tankGusher into a single trigger for gusher effects
  const combinedStrike = oilStrike || tankGusher;

  // Drill event counter — increments on every drill (oil or dry), triggers visual effects
  const [drillEvent, setDrillEvent] = useState(0);
  const prevDrillDay = useRef(effectiveDrillDay);
  const prevDrillCell = useRef(null);
  useEffect(() => {
    const cell = selectedX === null ? null : `${selectedX}_${sliceY}`;
    // Switching / zooming to a different rig changes effectiveDrillDay but is NOT a
    // drill — reset the baseline silently so navigation doesn't replay the burst.
    if (cell !== prevDrillCell.current) {
      prevDrillCell.current = cell;
      prevDrillDay.current = effectiveDrillDay;
      return;
    }
    if (effectiveDrillDay > prevDrillDay.current && effectiveDrillDay > 0) {
      setDrillEvent((prev) => prev + 1);
    }
    prevDrillDay.current = effectiveDrillDay;
  }, [effectiveDrillDay, selectedX, sliceY]);

  // Drill proximity — max oil value in the 26 neighboring cells (3x3x3 cube minus self)
  const drillProximity = useMemo(() => {
    if (selectedX === null || sliceY === null || effectiveDrillDay === 0) return 0;
    const depthIndex = effectiveDrillDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    const grid = displayGrid3D;
    let maxNeighbor = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const nx = selectedX + dx;
          const ny = sliceY + dy;
          const nz = depthIndex + dz;
          if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize || nz < 0 || nz >= DEPTH_Z) continue;
          const val = grid[nx]?.[ny]?.[nz] ?? 0;
          if (val > maxNeighbor) maxNeighbor = val;
        }
      }
    }
    return maxNeighbor;
  }, [selectedX, sliceY, effectiveDrillDay, displayGrid3D, gridSize]);

  // Hell proximity — is a hell pocket lurking in the 3x3x3 neighborhood? Returns a
  // 0..1 "heat" intensity that feeds the area-scan thermal/sulfurous hint. Closer
  // (face-adjacent) reads hotter than a corner, but it intentionally does NOT encode
  // WHICH direction the pocket is — so the scan warns "something's near" without
  // handing the player the exact cell.
  const hellProximity = useMemo(() => {
    if (selectedX === null || sliceY === null || effectiveDrillDay === 0) return 0;
    const depthIndex = effectiveDrillDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    const hm = displayHellMap;
    let intensity = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const nx = selectedX + dx;
          const ny = sliceY + dy;
          const nz = depthIndex + dz;
          if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize || nz < 0 || nz >= DEPTH_Z) continue;
          if (!hm[`${nx}_${ny}_${nz}`]) continue;
          const steps = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
          const w = steps === 1 ? 0.85 : steps === 2 ? 0.6 : 0.45;
          if (w > intensity) intensity = w;
        }
      }
    }
    return intensity;
  }, [selectedX, sliceY, effectiveDrillDay, displayHellMap, gridSize]);

  // Camera shake — ref-driven, no state re-renders
  const shakeRef = useRef(0);

  const strikeShakeTimeout = useRef(null);
  useEffect(() => {
    if (oilStrike > 0) {
      if (strikeShakeTimeout.current) clearTimeout(strikeShakeTimeout.current);
      strikeShakeTimeout.current = setTimeout(() => {
        shakeRef.current = 1;
      }, 10000);
    }
    return () => { if (strikeShakeTimeout.current) clearTimeout(strikeShakeTimeout.current); };
  }, [oilStrike]);

  useEffect(() => {
    if (tankGusher > 0) {
      shakeRef.current = 1;
    }
  }, [tankGusher]);

  // Demo auto-play: advance one day per second
  const demoDayRef = useRef(demoDay);
  demoDayRef.current = demoDay;

  useEffect(() => {
    if (!demoPlaying) return;
    const interval = setInterval(() => {
      if (demoDayRef.current >= DEPTH_Z) {
        setDemoPlaying(false);
        return;
      }
      setDemoDay((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [demoPlaying]);

  const handleReveal = useCallback(() => {
    setAnimateReveal(true);
    setIsRevealed(true);
  }, []);

  const handleReset = useCallback(() => {
    setAnimateReveal(false);
    setRevealProgress(0);
    setIsRevealed(false);
    setDrillDepth(0);
  }, []);

  const handleRandomize = useCallback(() => {
    const hex = "0123456789abcdef";
    let hash = "0x";
    for (let i = 0; i < 64; i++) {
      hash += hex[Math.floor(Math.random() * 16)];
    }
    setBlockHash(hash);
    setAnimateReveal(false);
    setRevealProgress(0);
    setIsRevealed(false);
    setSelectedX(null);
    setDrillDepth(0);
    saveGameSettings({ blockHash: hash });
  }, [saveGameSettings]);

  // ── Admin test tools — button equivalents of the seed / backfill / strike /
  // scout dev endpoints, so testing the reveal pipeline doesn't need curl/URLs.
  const [toolStatus, setToolStatus] = useState("");
  const [toolBusy, setToolBusy] = useState(false);
  const [intelTab, setIntelTab] = useState("claims"); // FIELD INTEL panel tab
  const [toolDeep, setToolDeep] = useState(3);
  const runTool = useCallback(async (label, fn) => {
    if (!adminPassword) { setToolStatus("✗ no admin password"); return; }
    setToolBusy(true);
    setToolStatus(`${label}…`);
    try {
      setToolStatus(await fn());
    } catch (e) {
      setToolStatus(`✗ ${e?.message || "failed"}`);
    } finally {
      setToolBusy(false);
    }
  }, [adminPassword]);

  const handleSelectX = useCallback((x) => {
    setSelectedX(x);
    setDrillDepth(0);
  }, []);

  const handleSliceY = useCallback((y) => {
    setSliceY(y);
    setDrillDepth(0);
  }, []);

  const flyIdRef = useRef(0);
  // Vendor "mood dim": while a moodDim vendor (the fortune teller) is
  // focused, CommercialStrip dispatches vendor-mood events and the global
  // lights drop to a fraction — her crystal-ball glow then carries the wagon
  // interior (the walls don't occlude light, so darkness must be global).
  const [vendorMood, setVendorMood] = useState(false);
  useEffect(() => {
    const onMood = (e) => setVendorMood(!!e.detail?.active);
    window.addEventListener("vendor-mood", onMood);
    return () => window.removeEventListener("vendor-mood", onMood);
  }, []);
  const moodScale = vendorMood ? 0.12 : 1;

  // Photo booth camera failure → a readable instruction card. The booth's own
  // NO SIGNAL screen names the cause diegetically but in small canvas text;
  // this repeats it large, with actual steps, and clears itself when the
  // camera comes up or the player leaves the booth.
  const [boothCamError, setBoothCamError] = useState(null);
  useEffect(() => {
    const onErr = (e) => setBoothCamError(e.detail?.code || null);
    window.addEventListener("booth-camera-error", onErr);
    return () => window.removeEventListener("booth-camera-error", onErr);
  }, []);

  // Where the intro camera was looking when the user interrupted it — adopted
  // as OrbitControls' initial target so the handoff doesn't snap the view to
  // the fixed default pivot. null = intro not interrupted (skipped/rig open).
  const [introExitTarget, setIntroExitTarget] = useState(null);
  const handleIntroComplete = useCallback((look) => {
    if (look) setIntroExitTarget(look);
    setIntroComplete(true);
  }, []);

  const handleFlyTo = useCallback((col, row) => {
    const worldW = gridSize * CELL_SIZE;
    const worldD = gridSize * CELL_SIZE;
    const x = -worldW / 2 + col * CELL_SIZE + CELL_SIZE / 2;
    const z = worldD / 2 - row * CELL_SIZE - CELL_SIZE / 2;
    flyIdRef.current++;
    // Any explicit fly target is a navigation intent — end the intro orbit so the
    // OrbitControls + CameraFlyTo rig mounts and actually moves the camera. Without
    // this, a surface-map / claim click before the user has touched the 3D canvas
    // sets flyTarget but nothing is mounted to act on it.
    setIntroComplete(true);
    setFlyTarget({ x, y: isMobile ? 1.3 : 5.3, z, id: flyIdRef.current, mobile: isMobile });
    setSelectedX(col);
    setSliceY(row);
    setDrillDepth(0);
  }, [isMobile, gridSize]);

  const handleZoomOut = useCallback(() => {
    flyIdRef.current++;
    setFlyTarget({ x: 0, y: isMobile ? 3.5 : 8, z: isMobile ? 4 : 8, id: flyIdRef.current, mobile: isMobile, overview: true });
    setSelectedX(null);
    setDrillDepth(0);
  }, [isMobile]);

  // Click-to-zoom on a scene object (e.g. MachinePanel). worldPoint is the THREE
  // intersection point; CameraFlyTo's `focus` branch dollies the camera in toward it.
  const handleFocusObject = useCallback((worldPoint, normal, dist, minDist) => {
    if (!worldPoint) return;
    flyIdRef.current++;
    // Focus clicks are navigation intent too — end the intro orbit so the
    // OrbitControls + CameraFlyTo rig mounts and acts on this target (same
    // reason handleFlyTo does it; without this, pre-intro clicks no-op).
    setIntroComplete(true);
    setFlyTarget({
      x: worldPoint.x, y: worldPoint.y, z: worldPoint.z,
      nx: normal?.x, ny: normal?.y, nz: normal?.z,
      focusDist: dist,
      // Optional OrbitControls floor for targets tighter than the 0.3 default
      // (the photo booth interior). Undefined for every other caller.
      minDist,
      id: flyIdRef.current, mobile: isMobile, focus: true,
    });
  }, [isMobile]);

  // The player's own rig cell, if they hold a claimed plot. When set, the page
  // SKIPS the aerial intro orbit and opens focused on that rig instead (both
  // desktop and mobile). null = logged-out / no plot → the cinematic orbit plays.
  // Sources the plot the same way auto-select does (userDrill.col is often
  // stale/null; oilPlots ownership via myPlot is the reliable fallback).
  const introRig = useMemo(() => {
    const col = userDrill?.col ?? myPlot?.col;
    const row = userDrill?.row ?? myPlot?.row;
    if (col == null) return null;
    return { col, row: row ?? 0 };
  }, [userDrill?.col, userDrill?.row, myPlot?.col, myPlot?.row]);

  // Plot owners used to skip the aerial intro entirely — the JSX below read
  // `introRig ? null : <CameraFlyIn/>`, so the opening tour everyone else gets
  // was the one thing an owner never saw; the camera simply appeared parked on
  // their rig.
  //
  // Owners now get the IDENTICAL intro to a claimless visitor — same start, same
  // corkscrew, same endless gentle orbit — and the only difference is that their
  // plot is selected from the first frame, so its marching amber outline marks
  // the claim while the camera drifts past it. Nothing steers the camera toward
  // the rig: an earlier version flew there when a timer expired, which snapped
  // the view mid-orbit and then left the camera parked and motionless. The
  // outline is what points the claim out; the player goes to it when they want,
  // by clicking it or via "GO TO YOUR CLAIM".
  const didRigSelect = useRef(false);
  useEffect(() => {
    if (didRigSelect.current || !introRig) return;
    didRigSelect.current = true;
    setSelectedX(introRig.col);
    setSliceY(introRig.row);
    setDrillDepth(0);
  }, [introRig]);


  // Auto-select and fly to the target cell when a rogue event appears
  useEffect(() => {
    if (rogueEvents.length === 0) return;
    const latest = rogueEvents[rogueEvents.length - 1];
    if (latest.targetCol != null && latest.targetRow != null) {
      handleFlyTo(latest.targetCol, latest.targetRow);
    }
  }, [rogueEvents, handleFlyTo]);

  const handleSelectClaim = useCallback((claim) => {
    const x = Math.max(0, Math.min(claim.x, gridSize - 1));
    const y = Math.max(0, Math.min(claim.y, gridSize - 1));
    setSelectedX(x);
    setSliceY(y);
    setDrillDepth(0);
    handleFlyTo(x, y);
  }, [handleFlyTo, gridSize]);

  // ── Click-to-drill handler — one layer per click, capped by playerDepth (time + bonus) ──
  const handleDailyDrill = useCallback(async () => {
    if (previewModeRef.current) return;
    if (!user?.id || !db || selectedX === null || drillStatus !== "ready") return;
    const col = userDrill?.col ?? selectedX;
    const row = userDrill?.row ?? sliceY;
    const plotKey = `${col}_${row}`;
    const currentCellDepth = userPlotState?.drillDay ?? 0;
    const nextCellDepth = currentCellDepth + 1;
    // Optimistic local update. Mirror the strike loop: a drill accumulates the
    // drilled layer's oil into tankOil (the authoritative un-banked balance).
    const layerIndex = nextCellDepth - 1;
    const oilAtDepth = stats.grid3D[col]?.[row]?.[layerIndex] ?? 0;
    const isHellLayer = !!stats.hellMap?.[`${col}_${row}_${layerIndex}`];
    setUserDrill((prev) => prev ? { ...prev, drillDay: nextCellDepth, tankOil: (prev.tankOil || 0) + oilAtDepth, lastStrikeOil: oilAtDepth, lastStrikeDepth: nextCellDepth } : prev);
    try {
      // Admin/test manual DRILL is a LOCAL preview only — it no longer persists
      // to oilPlots/oilDrills (those are server-authoritative; use FORCE STRIKE in
      // TEST TOOLS for a real, persisted strike). The gusher event still fires so
      // the visual is exercised.
      if (oilAtDepth > 0) {
        try {
          await addDoc(collection(db, "gusherEvents"), {
            col,
            row,
            userId: user.id,
            username: username.trim() || "Anonymous",
            oilAmount: oilAtDepth,
            createdAt: serverTimestamp(),
            status: "active",
          });
        } catch (e) {
          console.error("Failed to write gusher event:", e);
        }
      }
      // Hell pocket detection is handled by the reactive useEffect
    } catch (err) {
      console.error("Failed to save drill:", err);
    }
  }, [user?.id, selectedX, sliceY, userDrill, userPlotState, drillStatus, username, stats.grid3D, stats.hellMap, envPreset]);

  // ── Claim Jump handler ──
  const handleClaimJump = useCallback(async (newCol, newRow) => {
    if (previewModeRef.current) return;
    if (!user?.id || !userDrill) return;
    // Quick client guard (the server re-checks authoritatively inside the txn).
    if (allPlotsMap[`${newCol}_${newRow}`]?.currentOwnerId != null) return;
    try {
      const res = await oilApiFetch("/api/oil-claim-jump", {
        method: "POST",
        body: JSON.stringify({ newCol, newRow }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { console.error("Claim jump failed:", data.error); return; }
      // Server moved the plot, charged the jump, inherited depth, re-armed, and
      // carried the pump config. Just confirm + fly there.
      setClaimToast({ col: newCol, row: newRow });
      if (claimToastTimer.current) clearTimeout(claimToastTimer.current);
      claimToastTimer.current = setTimeout(() => setClaimToast(null), 5000);
      setClaimJumpMode(false);
      handleFlyTo(newCol, newRow);
    } catch (err) {
      console.error("Claim jump failed:", err);
    }
  }, [user?.id, userDrill, allPlotsMap, handleFlyTo, oilApiFetch]);

  // Offer shown in the plot-message panel when the selected plot is unclaimed:
  // a one-tap claim jump onto it. Mirrors the CLAIM JUMP toggle gating (active
  // phase, not test, player already holds a plot) so we never surface a dead
  // button. Returns null when no jump is possible; the chat panel then just
  // shows the "unclaimed — no owner to message" line.
  const buildClaimJumpOption = useCallback((plotKey) => {
    if (!plotKey || gamePhase !== "active" || isTest) return null;
    if (!user?.id || !userDrill || userDrill.col == null) return null;
    if (allPlotsMap[plotKey]?.currentOwnerId != null) return null; // already claimed
    const [col, row] = plotKey.split("_").map(Number);
    if (col === userDrill.col && row === userDrill.row) return null; // already standing here
    const used = userDrill.claimJumpsUsed ?? 0;
    const freeAllowance = FREE_CLAIM_JUMPS + (userDrill.bonusClaimJumps ?? 0); // season allowance + DAILY TICKET jackpots
    const costsBonus = used >= freeAllowance;
    const bonus = userDrill.bonusDrills ?? 0;
    const blocked = costsBonus && bonus <= 0;
    const free = Math.max(0, freeAllowance - used);
    return {
      label: "CLAIM JUMP HERE",
      note: blocked
        ? "No free jumps left — need a bonus drill"
        : costsBonus
          ? "Costs 1 bonus drill"
          : `${free} free jump${free === 1 ? "" : "s"} left`,
      disabled: blocked,
      onClaim: () => handleClaimJump(col, row),
    };
  }, [gamePhase, isTest, user?.id, userDrill, allPlotsMap, handleClaimJump]);

  // Mid-season join: a qualified, plot-less player claims an unclaimed cell in
  // active phase (registration-window claiming happens via OilQualify instead).
  // Score/counters are preserved server-side for returning players.
  const handleClaimActivePlot = useCallback(async () => {
    if (!user?.id || selectedX === null) return;
    if (allPlotsMap[`${selectedX}_${sliceY}`]?.currentOwnerId != null) return;
    // Carry the referral code so a mid-season joiner arriving via a ?ref= link
    // still credits the referrer (same as the registration claim path).
    const refCode = typeof window !== "undefined" ? localStorage.getItem("oil_ref") : null;
    try {
      const res = await oilApiFetch("/api/oil-claim", {
        method: "POST",
        body: JSON.stringify({ col: selectedX, row: sliceY, username: username?.trim() || user?.firstName || "", referredByCode: refCode || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Claim failed"); return; }
      if (refCode && typeof window !== "undefined") localStorage.removeItem("oil_ref");
      handleFlyTo(selectedX, sliceY);
    } catch (err) {
      alert(err.message || "Claim failed");
    }
  }, [user?.id, selectedX, sliceY, allPlotsMap, username, oilApiFetch, handleFlyTo]);

  // Redeem a tester access code → server flips this user's oilQualified to
  // qualified:true (no wallet / no $20 gate), so they can claim a rig like a
  // normal player. The code is validated server-side against the locked oilSecret.
  const handleRedeemCode = useCallback(async () => {
    const code = testerCode.trim();
    if (!code) return;
    setTesterMsg("…");
    try {
      const res = await oilApiFetch("/api/oil-redeem-code", {
        method: "POST",
        body: JSON.stringify({ code, clerkName: username?.trim() || user?.firstName || "Tester" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setTesterMsg(data.error || "Invalid code"); return; }
      setTesterMsg("✓ Qualified! Select an open plot, then CLAIM THIS PLOT.");
      setTesterCode("");
    } catch (err) {
      setTesterMsg(err.message || "failed");
    }
  }, [testerCode, oilApiFetch, username, user?.firstName]);

  // Join the next-season waitlist (overflow: grid full / registration closed).
  const handleJoinWaitlist = useCallback(async () => {
    try {
      const res = await oilApiFetch("/api/oil-waitlist", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setWaitlistInfo({ error: data.error || "failed" }); return; }
      setWaitlistInfo({ waitlisted: true, position: data.position, total: data.total });
    } catch (err) {
      setWaitlistInfo({ error: err.message || "failed" });
    }
  }, [oilApiFetch]);

  // ── Transfer Plot handler ──
  const handleTransferPlot = useCallback(async (recipientUsername, transferUpgrades) => {
    if (previewModeRef.current) return { error: "Preview mode — sign up to play" };
    if (!user?.id || !userDrill || userDrill.col == null) {
      return { error: "You don't own a plot to transfer" };
    }
    const trimmed = recipientUsername?.trim();
    if (!trimmed) return { error: "Enter a username" };
    try {
      // Server validates ownership + recipient qualification and does the atomic
      // move (incl. optional premium-upgrade transfer).
      const res = await oilApiFetch("/api/oil-transfer", {
        method: "POST",
        body: JSON.stringify({ recipientUsername: trimmed, transferUpgrades: !!transferUpgrades }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error || "Transfer failed" };
      return { success: true };
    } catch (err) {
      console.error("Transfer failed:", err);
      return { error: err.message || "Transfer failed" };
    }
  }, [user?.id, userDrill, oilApiFetch]);

  // Tank drain handler — updates UI optimistically, persists via /api/oil-tank-drain.
  // Server is the only writer to oilGame/communityStorage (rules locked).
  const handleTankDrain = useCallback(async () => {
    if (previewModeRef.current) return;
    // Bank whatever is currently in the tank (tankOil when present, else legacy).
    const delta = oilInTank;
    // Nothing to bank AND no gusher to shut off → no-op. Otherwise proceed: the API
    // banks any oil AND marks the user's gusher events done (which turns off the
    // gusher + alert light), so an empty tank can still shut a stuck gusher off.
    if (delta <= 0 && !myGusherActive) return;
    if (delta > 0) {
      setTankDrained(true);
      setLastDrainSnapshot(playerExtracted); // keep legacy marker aligned
      setCommunityOil(prev => prev + delta);
      if (userDrill) {
        const newTotal = (userDrill.totalCollected || 0) + delta;
        const newDrains = (userDrill.tankDrains || 0) + 1;
        setUserDrill(prev => prev ? { ...prev, totalCollected: newTotal, tankDrains: newDrains, tankOil: 0, lastDrainExtracted: playerExtracted } : prev);
      }
    }
    if (user?.id) {
      try {
        const res = await oilApiFetch("/api/oil-tank-drain", {
          method: "POST",
          body: JSON.stringify({ username: username?.trim() || undefined }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}));
          throw new Error(error || `HTTP ${res.status}`);
        }
      } catch (err) {
        console.error("Failed to save tank drain:", err);
      }
    }
  }, [user?.id, userDrill, oilInTank, playerExtracted, username, myGusherActive, oilApiFetch]);

  // Bounty claimed toast
  const [bountyToast, setBountyToast] = useState(null);
  const bountyToastTimer = useRef(null);

  // Stun countdown — ticks every second while summoner is stunned

  // Watch for bounty claim by anyone (Firestore status goes to "claimed")
  const prevBountyStatusRef = useRef(null);
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "demonBounty"),
      where("status", "==", "claimed"),
      orderBy("claimedAt", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const d = snap.docs[0];
      const data = d.data();
      if (prevBountyStatusRef.current === d.id) return;
      prevBountyStatusRef.current = d.id;
      setBountyToast({
        hunterUsername: data.hunterUsername || "Anonymous",
        bountyAmount: data.bountyAmount || 0,
        isYou: data.hunterId === user?.id,
      });
      if (bountyToastTimer.current) clearTimeout(bountyToastTimer.current);
      bountyToastTimer.current = setTimeout(() => setBountyToast(null), 8000);
    });
    return () => unsub();
  }, [user?.id]);

  // Claim the demon bounty — player clicks the demon in 3D
  const handleClaimBounty = useCallback(async () => {
    // Always turn off the local hell visuals immediately on banish — regardless
    // of mode, signed-in state, or whether the server PATCH below succeeds. The
    // PATCH (for a real bounty) still awards it and clears the blockade for the
    // other clients via the Firestore listener.
    setHellActive(false);
    setHellCol(null);
    setHellRow(null);
    setEnvPreset(prevEnvPresetRef.current || "day");
    if (hellTimeoutRef.current) { clearTimeout(hellTimeoutRef.current); hellTimeoutRef.current = null; }

    // Test/admin mode (no server bounty) — just the local dismiss toast.
    if (!demonBounty?.id) {
      setBountyToast({ dismissed: true, bountyAmount: 0, isYou: false });
      if (bountyToastTimer.current) clearTimeout(bountyToastTimer.current);
      bountyToastTimer.current = setTimeout(() => setBountyToast(null), 8000);
      return;
    }
    if (!user?.id) return;
    try {
      const res = await oilApiFetch("/api/oil-demon-bounty", {
        method: "PATCH",
        body: JSON.stringify({
          bountyId: demonBounty.id,
          hunterUsername: username?.trim() || user?.firstName || "Anonymous",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[HELL] Bounty claim failed:", data.error);
        return;
      }
      if (data.dismissed) {
        setBountyToast({
          hunterUsername: null,
          bountyAmount: 0,
          isYou: false,
          dismissed: true,
        });
        if (bountyToastTimer.current) clearTimeout(bountyToastTimer.current);
        bountyToastTimer.current = setTimeout(() => setBountyToast(null), 8000);
      }
      // Non-dismissed claims are handled by the Firestore listener
    } catch (err) {
      console.error("[HELL] Bounty claim error:", err);
    }
  }, [demonBounty?.id, user?.id, username, oilApiFetch]);

  // Deterministic victim plot for the local/test demon (the multiplayer path
  // gets its target from the Firestore bounty instead).
  const localDemonTarget = useMemo(() => {
    if (hellCol == null || hellRow == null) return null;
    const g = gridSize;
    const tc = (hellCol + 3 + (hellRow % 4)) % g;
    let tr = (hellRow + 4 + (hellCol % 3)) % g;
    if (tc === hellCol && tr === hellRow) tr = (tr + 1) % g;
    return { col: tc, row: tr };
  }, [hellCol, hellRow, gridSize]);

  // A stunned summoner can't catch their own demon (the server would reject it
  // anyway — blocking client-side avoids a banish that Firestore then refuses).
  const demonCapturable = !isSummonerStunned;

  // Two-phase demon difficulty. For the first stretch of its life the demon must
  // be fought down (get close + land DEMON_HARD_HITS timed hits while dodging);
  // after that an easy one-click banish appears so the global blockade always has
  // a clean exit. Anchored to the bounty's createdAt so all clients flip together
  // (late joiners who load past the cutoff get the easy phase immediately). Admin/
  // test uses a short hard phase so both phases are quick to exercise.
  const DEMON_HARD_HITS = 3;
  const demonHardPhaseMs = (isAdmin || isTest) ? 25_000 : 5 * 60 * 1000;
  const [demonEasyPhase, setDemonEasyPhase] = useState(false);
  const demonStartMsRef = useRef(null);
  useEffect(() => {
    if (!hellActive) { setDemonEasyPhase(false); demonStartMsRef.current = null; return; }
    const startMs = demonBounty?.createdAt?.toMillis?.() ?? demonStartMsRef.current ?? Date.now();
    demonStartMsRef.current = startMs;
    const remaining = demonHardPhaseMs - (Date.now() - startMs);
    if (remaining <= 0) { setDemonEasyPhase(true); return; }
    setDemonEasyPhase(false);
    const id = setTimeout(() => setDemonEasyPhase(true), remaining);
    return () => clearTimeout(id);
  }, [hellActive, demonBounty?.id, demonHardPhaseMs]);
  const demonRequiredHits = demonEasyPhase ? 1 : DEMON_HARD_HITS;

  // Mistimed click on the roaming demon → it counterattacks and locks this
  // player out for a few seconds. demonStunRemaining drives the HUD countdown.
  const [demonStunRemaining, setDemonStunRemaining] = useState(0);
  const demonStunTimer = useRef(null);
  const handleDemonMiss = useCallback((cooldownSecs = 3.5) => {
    if (demonStunTimer.current) clearInterval(demonStunTimer.current);
    const endAt = Date.now() + cooldownSecs * 1000;
    setDemonStunRemaining(Math.ceil(cooldownSecs));
    demonStunTimer.current = setInterval(() => {
      const rem = Math.max(0, endAt - Date.now());
      setDemonStunRemaining(Math.ceil(rem / 1000));
      if (rem <= 0) { clearInterval(demonStunTimer.current); demonStunTimer.current = null; }
    }, 200);
  }, []);
  useEffect(() => () => { if (demonStunTimer.current) clearInterval(demonStunTimer.current); }, []);

  // The demon's retaliation lands (after its Take Damage flinch). Impact feedback
  // = camera shake. The lockout itself is the penalty (handled per-client in
  // HellDemon); no economic damage by design, to keep the bounty race fair.
  const handleDemonAttack = useCallback(() => {
    shakeRef.current = 1;
  }, []);

  // Legacy demo drill (admin inspector)
  const handleDrill = useCallback(() => {
    if (selectedX === null || isDrilling) return;
    setIsDrilling(true);
    setDrillDepth(0);
    let depth = 0;
    const interval = setInterval(() => {
      depth++;
      setDrillDepth(depth);
      if (depth >= DEPTH_Z) {
        clearInterval(interval);
        setIsDrilling(false);
      }
    }, 200);
  }, [selectedX, isDrilling]);

  // ── Shared panel content (used in both layouts) ──
  const parametersPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>PARAMETERS</h3>
      <div style={styles.paramRow}>
        <span style={styles.paramLabel}>DEPOSITS</span>
        <div style={styles.paramButtons}>
          {[1, 2, 3, 4, 5, 8, 12, 16].map((n) => (
            <button
              key={n}
              onClick={() => { setNumberOfDeposits(n); handleReset(); saveGameSettings({ numberOfDeposits: n }); }}
              style={{
                ...styles.paramBtn,
                ...(numberOfDeposits === n ? styles.paramBtnActive : {}),
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.paramRow}>
        <span style={styles.paramLabel}>HELL POCKETS</span>
        <div style={styles.paramButtons}>
          {/* AUTO = derive ~3% of grid (just 1 on a 6×6); pick a number to override. */}
          {[{ label: "AUTO", val: null }, { label: "1", val: 1 }, { label: "2", val: 2 }, { label: "3", val: 3 }, { label: "4", val: 4 }, { label: "5", val: 5 }, { label: "8", val: 8 }].map(({ label, val }) => (
            <button
              key={label}
              onClick={() => { setNumberOfHellPockets(val); handleReset(); saveGameSettings({ numberOfHellPockets: val }); }}
              style={{
                ...styles.paramBtn,
                ...(numberOfHellPockets === val ? styles.paramBtnActive : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.paramRow}>
        <span style={styles.paramLabel}>PRIZE POOL</span>
        {/* Open field — the prize pool is just the $ value of the field; it only
            scales the fixed per-unit rate (pot / OIL_FIELD_UNITS), not the oil
            distribution, so no board reset is needed when it changes. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min={0}
            step={50}
            value={totalOilBudget}
            onChange={(e) => {
              const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
              setTotalOilBudget(n);
              saveGameSettings({ totalOilBudget: n });
            }}
            style={{
              padding: "2px 6px", width: 80, background: theme.inputBg, border: `1px solid ${theme.border}`,
              borderRadius: 2, color: theme.textStrong, fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10, outline: "none",
            }}
          />
          <span style={{ fontSize: 9, color: theme.muted }}>USDC</span>
        </div>
      </div>
      <div style={styles.paramRow}>
        <span style={styles.paramLabel}>GRID SIZE</span>
        <div style={styles.paramButtons}>
          {[6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              onClick={() => { setGridSize(n); handleReset(); saveGameSettings({ gridSize: n }); }}
              style={{
                ...styles.paramBtn,
                ...(gridSize === n ? styles.paramBtnActive : {}),
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...styles.paramRow, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.border}` }}>
        <span style={styles.paramLabel}>HIT RATE</span>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: hitRate > 60 ? theme.green : hitRate > 30 ? theme.accent : theme.warn,
        }}>
          {hitRate}%
        </span>
      </div>
      <div style={{ ...styles.paramRow, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.border}` }}>
        <span style={styles.paramLabel}>START DATE</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            value={gameStartDate || ""}
            onChange={(e) => { setGameStartDate(e.target.value); saveGameSettings({ gameStartDate: e.target.value }); }}
            style={{
              padding: "2px 6px", background: theme.inputBg, border: `1px solid ${theme.border}`,
              borderRadius: 2, color: theme.textStrong, fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10, outline: "none",
            }}
          />
          <button
            onClick={() => { const today = new Date().toISOString().slice(0, 10); setGameStartDate(today); saveGameSettings({ gameStartDate: today }); }}
            style={{ ...styles.paramBtn, padding: "2px 8px", fontSize: 9 }}
          >
            TODAY
          </button>
        </div>
      </div>
      {gameStartDate && (
        <div style={{ ...styles.paramRow, marginTop: 2, fontSize: 10, color: theme.muted }}>
          <span>PASSIVE DEPTH NOW: {passiveDepth}/{PASSIVE_DRILLS}</span>
        </div>
      )}
      <div style={{ ...styles.paramRow, marginTop: 6 }}>
        <span style={styles.paramLabel}>SEASON LENGTH</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min={1}
            max={120}
            value={seasonLengthDays}
            onChange={(e) => {
              const n = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1));
              setSeasonLengthDays(n);
              saveGameSettings({ seasonLengthDays: n });
            }}
            style={{
              padding: "2px 6px", width: 56, background: theme.inputBg, border: `1px solid ${theme.border}`,
              borderRadius: 2, color: theme.textStrong, fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10, outline: "none",
            }}
          />
          <span style={{ fontSize: 9, color: theme.muted }}>days</span>
        </div>
      </div>
      {gameStartDate && (
        <div style={{ ...styles.paramRow, marginTop: 2, fontSize: 10, color: theme.muted }}>
          <span>
            ENDS {new Date(new Date(gameStartDate + "T00:00:00Z").getTime() + seasonLengthDays * 86400000).toISOString().slice(0, 10)}
            {" · "}STRIKE ~{(seasonLengthDays / PASSIVE_DRILLS).toFixed(1)}d (base) → {(seasonLengthDays / MAX_DEPTH).toFixed(1)}d (max depth)
          </span>
        </div>
      )}
      <div style={{ ...styles.paramRow, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.border}` }}>
        <span style={styles.paramLabel}>GAME DAY</span>
        {/* Read-only — derived from the season clock (gameStartDate + seasonLengthDays).
            Adjust pacing via START DATE / SEASON LENGTH above, not here. */}
        <span style={{
          fontFamily: "'Orbitron', monospace", fontSize: 13, fontWeight: 700,
          color: gameStartDate ? theme.accent : theme.muted, minWidth: 30, textAlign: "right",
        }}>
          {gameStartDate ? `${gameDay} / ${seasonLengthDays}` : "—"}
        </span>
      </div>
    </div>
  );

  const testToolsPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>TEST TOOLS</h3>
      <button
        onClick={() => setPreviewAsPlayer((v) => !v)}
        style={{ ...styles.btn, marginBottom: 8, ...(previewAsPlayer ? { background: theme.accent, color: theme.bg } : {}) }}
        title="Toggle the reveal-only player view (hides seed data) so you can watch reveal-on-drill"
      >
        {previewAsPlayer ? "VIEW AS PLAYER: ON" : "VIEW AS PLAYER: OFF"}
      </button>
      {/* Concretion previews — pure client-side (no writes): pops the reveal
          modal with a synthetic artifact to test each encasement skin. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {[
          ["🟠 AMBER", { type: "amber", specimenId: "raptor", fragmentIndex: 3, at: 0 }],
          ["🗿 RELIC", { type: "relic", relicId: "idol", cursed: false, at: 0 }],
          ["⚰ CURSED", { type: "relic", relicId: "bell", cursed: true, at: 0 }],
          ["🗺 MAP", { type: "map", pieceIndex: 2, at: 0 }],
          ["💰 CACHE", { type: "cache", at: 0 }],
        ].map(([label, art]) => (
          <button key={label} style={styles.btn} onClick={() => setPendingConcretion(art)}
            title="Preview the concretion reveal modal (client-only, nothing is written)">
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Scouting artifacts", async () => {
          const pw = encodeURIComponent(adminPassword);
          const r = await fetch(`/api/oil-strike-tick?password=${pw}&scout=1`).then((x) => x.json());
          if (!r?.ok) throw new Error(r?.error || "scout failed");
          const s = r.artifactSummary || {};
          const cursed = (r.artifacts || []).filter((a) => a.cursed);
          const cache = (r.artifacts || []).find((a) => a.type === "cache");
          console.log("[artifact scout]", r.artifacts);
          return `✓ ${s.total} artifacts · ${s.amber} amber · ${s.relics} relics (${s.cursedRelics} cursed${cursed[0] ? ` — first at ${cursed[0].label} L${cursed[0].layer}` : ""}) · cache at ${cache ? `${cache.label} L${cache.layer}` : "?"} · full list in console`;
        })}>ARTIFACT SCOUT</button>
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Seeding + revealing", async () => {
          const pw = encodeURIComponent(adminPassword);
          const r1 = await fetch("/api/oil-seed-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminPassword, count: 30 }) }).then(r => r.json());
          if (!r1?.ok) throw new Error(r1?.error || "seed failed");
          const r2 = await fetch(`/api/oil-backfill-revealed?password=${pw}`).then(r => r.json());
          if (!r2?.ok) throw new Error(r2?.error || "backfill failed");
          return `✓ seeded ${r1.seeded} rigs · revealed ${r2.layers} layers / ${r2.backfilled} cells`;
        })}>SEED + REVEAL FIELD</button>
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Clearing seeded", async () => {
          // clear:"only" wipes fake_* docs WITHOUT re-seeding (a truthy non-"only"
          // value clears then falls through and re-seeds).
          const r = await fetch("/api/oil-seed-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminPassword, clear: "only" }) }).then(r => r.json());
          if (!r?.ok) throw new Error(r?.error || "failed");
          return `✓ removed ${r.cleared} test bots`;
        })}>REMOVE TEST BOTS</button>
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Clearing demon", async () => {
          const bId = demonBlockade?.bountyId || demonBounty?.id;
          if (!bId) return "no active demon";
          const res = await fetch("/api/oil-demon-bounty", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bountyId: bId, password: adminPassword }) });
          const r = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(r?.error || `HTTP ${res.status}`);
          return "✓ demon cleared + blockade lifted";
        })}>CLEAR DEMON</button>
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Resetting board", async () => {
          const res = await fetch(`/api/oil-admin-reset?password=${encodeURIComponent(adminPassword)}`);
          const r = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(r?.error || `HTTP ${res.status}`);
          loadFeed(); // dispatch feed was wiped server-side — refresh the accordion
          return `✓ released ${r.plotsCleared} plot(s) · cleared ${r.rigsCleared} rig(s) · ${r.feedCleared ?? 0} dispatch(es) · fairness wiped — run COMMIT before the next season`;
        })}>RESET BOARD</button>
        <button disabled={toolBusy} style={{ ...styles.btn, borderColor: theme.red, color: theme.red }} onClick={() => runTool("Zeroing scores", async () => {
          // Deliberately separate from RESET BOARD (which preserves banked
          // score so a mid-season glitch wipe can't erase earned money) —
          // this is the explicit "new season starts from zero" step.
          if (!window.confirm("Zero the BANKED score (totalCollected) on EVERY rig? This permanently erases all earned/test winnings.")) return "cancelled";
          const res = await fetch(`/api/oil-admin-zero-scores?password=${encodeURIComponent(adminPassword)}`);
          const r = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(r?.error || `HTTP ${res.status}`);
          return `✓ zeroed ${r.rigsZeroed} rig(s) — ${(r.oilZeroed || 0).toLocaleString()} banked Betroleum erased`;
        })}>ZERO SCORES</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button disabled={toolBusy || selectedX === null} style={styles.btn} onClick={() => runTool("Claiming plot", async () => {
          if (selectedX === null) throw new Error("select a plot on the survey map first");
          // Claim for YOUR account when signed in (so a FORCE STRIKE fills the tank
          // your meter reads); otherwise fall back to a synthetic "admin_test" rig so
          // admin can test gushers/effects without signing in. Reset clears it like
          // any other rig. The field-wide 3D gusher fires regardless of owner.
          const claimUserId = user?.id || "admin_test";
          const claimUsername = username?.trim() || user?.firstName || "ADMIN";
          const r = await fetch("/api/oil-admin-claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminPassword, userId: claimUserId, username: claimUsername, col: selectedX, row: sliceY }) }).then(r => r.json());
          if (!r?.ok) throw new Error(r?.error || "failed");
          return `✓ claimed (${selectedX + 1}, ${sliceY + 1}) ${user?.id ? "for you" : "as admin_test"} — now FORCE STRIKE to drill it`;
        })}>CLAIM SELECTED</button>
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Forcing strike", async () => {
          let url = `/api/oil-strike-tick?password=${encodeURIComponent(adminPassword)}&force=1&deep=${toolDeep}`;
          let scope = " (all rigs)";
          // If a cell is selected, drill JUST that rig (matches the intuitive
          // "selected rig → strike it" model). Auto-claim it first if unowned;
          // if already owned, leave it so repeat strikes drill deeper (claiming
          // would reset depth to 0). No selection → global tick (all rigs).
          if (selectedX !== null) {
            const owned = allPlotsMap[`${selectedX}_${sliceY}`]?.currentOwnerId != null;
            if (!owned) {
              const claimUserId = user?.id || "admin_test";
              const claimUsername = username?.trim() || user?.firstName || "ADMIN";
              const c = await fetch("/api/oil-admin-claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminPassword, userId: claimUserId, username: claimUsername, col: selectedX, row: sliceY }) }).then(r => r.json());
              if (!c?.ok) throw new Error(c?.error || "auto-claim failed");
            }
            url += `&col=${selectedX}&row=${sliceY}`;
            scope = ` @(${selectedX + 1}, ${sliceY + 1})`;
          }
          const r = await fetch(url).then(r => r.json());
          if (!r?.ok) throw new Error(r?.error || "failed");
          // Break skipped down by reason (no_plot is the usual one right after a
          // board reset). Targeted strikes auto-claim, so you shouldn't see it.
          const reasons = r.skipReasons && Object.keys(r.skipReasons).length
            ? ` (${Object.entries(r.skipReasons).map(([k, v]) => `${k}:${v}`).join(", ")})`
            : "";
          return `✓ struck ${r.struck}${scope} · skipped ${r.skipped}${reasons}${r.depleted ? ` · depleted ${r.depleted}` : ""}${r.demonsSummoned ? ` · demons ${r.demonsSummoned}` : ""}`;
        })}>FORCE STRIKE</button>
        <button disabled={toolBusy || selectedX === null} style={styles.btn} onClick={() => runTool("Banking tank", async () => {
          // Bank the selected rig's un-banked tankOil into the community tank
          // (mirrors the player BANK OIL flow; password-gated, targeted by cell).
          if (selectedX === null) throw new Error("select the rig's plot first");
          const r = await fetch("/api/oil-admin-bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminPassword, col: selectedX, row: sliceY }) }).then(r => r.json());
          if (!r?.ok) throw new Error(r?.error || "failed");
          return r.delta > 0
            ? `✓ banked ${r.delta.toLocaleString()} → community · rig total ${r.newTotal.toLocaleString()}`
            : `nothing to bank (tank empty) @(${selectedX + 1}, ${sliceY + 1})`;
        })}>BANK TANK</button>
        <span style={{ fontSize: 10, color: theme.muted }}>depth</span>
        {[1, 3, 5, 10, 11, 20].map((n) => (
          <button key={n} onClick={() => setToolDeep(n)} style={{ ...styles.paramBtn, ...(toolDeep === n ? styles.paramBtnActive : {}) }}>{n}</button>
        ))}
      </div>
      {/* Tester access code — set/clear the code testers redeem to qualify
          without a wallet. Stored server-side in locked oilSecret. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <input
          value={adminTesterCode}
          onChange={(e) => setAdminTesterCode(e.target.value)}
          placeholder="tester access code"
          style={{ flex: "1 1 140px", minWidth: 0, padding: "6px 8px", fontSize: 12, fontFamily: "'Share Tech Mono', monospace", background: theme.panelBg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 3 }}
        />
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Setting tester code", async () => {
          const r = await fetch("/api/oil-tester-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminPassword, code: adminTesterCode.trim() }) }).then(r => r.json());
          if (!r?.ok) throw new Error(r?.error || "failed");
          return r.hasCode ? `✓ tester code set: "${r.code}" — share it with testers` : "✓ tester code cleared";
        })}>SET CODE</button>
        <button disabled={toolBusy} style={styles.btn} onClick={() => runTool("Loading tester code", async () => {
          const r = await fetch(`/api/oil-tester-code?password=${encodeURIComponent(adminPassword)}`).then(r => r.json());
          if (!r?.ok) throw new Error(r?.error || "failed");
          setAdminTesterCode(r.code || "");
          return r.hasCode ? `current code: "${r.code}"` : "no tester code set";
        })}>SHOW</button>
        <button disabled={toolBusy} style={{ ...styles.btn, ...(testingEnabled ? { borderColor: theme.gold, color: theme.gold } : {}) }} onClick={() => runTool("Toggling testing", async () => {
          // Safe-by-default kill-switch for the tester code. While OFF (live play)
          // the code is inert — nobody can redeem it and no tester can claim, even
          // if the code leaks. Turn ON only while actively testing. Real $20-RL80
          // players are never affected either way.
          const next = !testingEnabled;
          await saveGameSettings({ testingEnabled: next });
          return next ? "✓ TESTING ON — tester code active" : "✓ TESTING OFF — code locked for live play";
        })}>{testingEnabled ? "TESTING: ON" : "TESTING: OFF"}</button>
      </div>
      {toolStatus && (
        <div style={{ marginTop: 8, fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: theme.accent, wordBreak: "break-word", lineHeight: 1.4 }}>
          {toolStatus}
        </div>
      )}
    </div>
  );

  const demoDrillPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>DRILL DEMO</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => {
            if (demoDay >= DEPTH_Z) setDemoDay(0);
            setDemoPlaying((p) => !p);
          }}
          style={{
            ...styles.paramBtn,
            ...styles.paramBtnActive,
            padding: "4px 10px",
            fontSize: 10,
            minWidth: 50,
          }}
        >
          {demoPlaying ? "PAUSE" : "PLAY"}
        </button>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 11,
          fontWeight: 700,
          color: theme.accent,
          minWidth: 80,
        }}>
          DAY {demoDay} / {DEPTH_Z}
        </span>
        <button
          onClick={() => { setDemoDay(0); setDemoPlaying(false); }}
          style={{ ...styles.paramBtn, padding: "4px 8px", fontSize: 10 }}
        >
          RESET
        </button>
      </div>
      <button
        onClick={() => setCaptureOnTest((v) => !v)}
        title="When on, Test Gusher / Test Hell also pop the shareable Polaroid (preview only — not saved to the feed)"
        style={{
          ...styles.paramBtn,
          ...(captureOnTest ? styles.paramBtnActive : {}),
          width: "100%",
          padding: "6px 8px",
          fontSize: 11,
          marginBottom: 8,
        }}
      >
        📸 CAPTURE ON TEST: {captureOnTest ? "ON" : "OFF"}
      </button>
      <button
        onClick={() => { setGusherTest((g) => g + 1); if (captureOnTest) fireTestCapture("gusher"); }}
        disabled={selectedX === null}
        style={{
          ...styles.paramBtn,
          ...styles.paramBtnActive,
          width: "100%",
          padding: "6px 8px",
          fontSize: 11,
          marginBottom: 8,
          opacity: selectedX === null ? 0.4 : 1,
          cursor: selectedX === null ? "not-allowed" : "pointer",
        }}
      >
        💥 TEST GUSHER {selectedX === null ? "(select a rig)" : `(${selectedX + 1},${sliceY + 1})`}
      </button>
      <button
        onClick={() => { const wasActive = hellActive; handleTestHell(); if (captureOnTest && !wasActive) fireTestCapture("hell"); }}
        disabled={selectedX === null && !hellActive}
        style={{
          ...styles.paramBtn,
          ...styles.paramBtnActive,
          width: "100%",
          padding: "6px 8px",
          fontSize: 11,
          marginBottom: 8,
          opacity: (selectedX === null && !hellActive) ? 0.4 : 1,
          cursor: (selectedX === null && !hellActive) ? "not-allowed" : "pointer",
        }}
      >
        🔥 {hellActive ? "CLEAR HELL" : `TEST HELL ${selectedX === null ? "(select a rig)" : `(${selectedX + 1},${sliceY + 1})`}`}
      </button>
      <input
        type="range"
        min={0}
        max={DEPTH_Z}
        value={demoDay}
        onChange={(e) => {
          setDemoDay(Number(e.target.value));
          setDemoPlaying(false);
        }}
        style={{
          width: "100%",
          accentColor: theme.goldBorder,
          cursor: "pointer",
        }}
      />
      {selectedX !== null && (
        <div style={{ fontSize: 11, color: theme.accent, marginTop: 6 }}>
          SELECTED: ({selectedX}, {sliceY}) — click map to change
        </div>
      )}
    </div>
  );

  // Players see the commitment (the seed itself is secret until the post-game
  // reveal); admin/report see the real seed.
  const seedReadout = (showOilData || isReport) ? blockHash : seedCommitment;
  const seedReadoutLabel = (showOilData || isReport) ? "SEED HASH" : "SEED COMMITMENT";
  const statsPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      {/* Field-wide only — the player's own depth / haul / value live in the
          YOUR RIG card, so nothing here changes with who is looking. */}
      <PanelTitle
        theme={theme} isMobile={isMobile} icon={PANEL_ICONS.survey}
        right={<span style={{ fontSize: 9, color: theme.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{gridSize}&times;{gridSize} &middot; {DEPTH_Z} LAYERS</span>}
      >
        GEOLOGICAL SURVEY
      </PanelTitle>
      <div style={isMobile ? { ...m.statGrid, gridTemplateColumns: "1fr 1fr" } : styles.statGrid}>
        <StatBlock s={styles} accentColor={theme.accent} label="PRIZE POOL" value={<AnimNum value={totalOilBudget} />} unit="USDC" accent />
        <StatBlock s={styles} accentColor={theme.accent} label="DEPOSITS" value={numberOfDeposits} />
        <StatBlock s={styles} accentColor={theme.accent} label="OPEN PLOTS" value={`${(gridSize * gridSize) - Object.values(allPlotsMap).filter((p) => p?.currentOwnerId != null).length}/${gridSize * gridSize}`} />
        <StatBlock s={styles} accentColor={theme.green} label="HIT RATE" value={`${hitRate}%`} accent={hitRate > 60} />
        {(isAdmin || isReport) && (
          <>
            <StatBlock s={styles} accentColor={theme.accent} label="PEAK PLOT" value={<AnimNum value={stats.maxClaimTotal} />} unit="BTR" />
            <StatBlock s={styles} accentColor={theme.accent} label="DRY PLOTS" value={stats.dryClaims} />
            <StatBlock s={styles} accentColor={theme.accent} label="FIELD TOTAL" value={OIL_FIELD_UNITS.toLocaleString()} unit="BTR" />
            <StatBlock s={styles} accentColor={theme.accent} label="FIELD TAPPED" value={OIL_FIELD_UNITS > 0 ? `${(communityOil / OIL_FIELD_UNITS * 100).toFixed(2)}%` : "0%"} accent={communityOil > 0} />
          </>
        )}
      </div>
      {(isAdmin || isReport) && (() => {
        // Single-line game status: claim-board occupancy and community-tank fill are
        // independent stores (oilPlots ownership vs oilGame/communityStorage.totalOil),
        // so surface both together — a full tank on a fresh board means the community
        // tank wasn't zeroed (reset now clears it; legacy data may still read >100%).
        const totalCells = gridSize * gridSize;
        const claimed = Object.values(allPlotsMap).filter((p) => p?.currentOwnerId != null).length;
        const tappedPct = OIL_FIELD_UNITS > 0 ? (communityOil / OIL_FIELD_UNITS) * 100 : 0;
        const tankOverfull = tappedPct >= 100;
        return (
          <div style={{
            marginTop: 6, padding: "5px 8px",
            background: uiDark ? "rgba(180,160,130,0.06)" : "rgba(180,160,130,0.08)",
            border: `1px solid ${tankOverfull ? theme.red : (uiDark ? "#444" : "#d4c8b4")}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.06em",
            color: uiDark ? "#8a8070" : "#8b7d6b",
          }}>
            <span>PHASE <b style={{ color: theme.accent }}>{gameEnded ? "ended" : gamePhase}</b></span>
            <span>CLAIMED <b style={{ color: theme.accent }}>{claimed}/{totalCells}</b></span>
            {waitlistCount > 0 && <span>WAITLIST <b style={{ color: theme.gold }}>{waitlistCount}</b></span>}
            <span>TANK <b style={{ color: tankOverfull ? theme.red : theme.green }}>{communityOil.toLocaleString()}/{OIL_FIELD_UNITS.toLocaleString()}</b> ({tappedPct.toFixed(1)}%){tankOverfull ? <span style={{ color: theme.red }}> ⚠ over capacity — run admin reset to clear</span> : ""}</span>
          </div>
        );
      })()}
      {/* Only the PLAYER commitment is shown here — for admin/report the raw
          SEED HASH already lives in the top-left BLOCK HASH SEED bar, so showing
          it again here would be redundant. Players have no top bar, so this is
          their only provable-fairness commitment readout. */}
      {seedReadout && !(showOilData || isReport) && (
        <div style={{
          marginTop: 6, padding: "5px 8px",
          background: uiDark ? "rgba(180,160,130,0.06)" : "rgba(180,160,130,0.08)",
          border: `1px solid ${uiDark ? "#444" : "#d4c8b4"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
        }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
            color: uiDark ? "#8a8070" : "#8b7d6b", letterSpacing: "0.12em",
          }}>
            {seedReadoutLabel}
          </span>
          <span
            title={`${seedReadout} — open "Is this game fair?"`}
            style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
              color: uiDark ? "#8a8070" : "#8b7d6b",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "65%", textAlign: "right", cursor: "pointer",
            }}
            onClick={() => { setHelpFairness(true); setShowWelcome(true); }}
          >
            {seedReadout.slice(0, 10)}...{seedReadout.slice(-8)}
          </span>
        </div>
      )}
    </div>
  );

  const truncId = (id) => id.length > 10 ? `${id.slice(0, 5)}...${id.slice(-3)}` : id;

  // Relative timestamp for the activity feed ("2m ago", "3h ago", "just now").
  const relTime = (ts) => {
    const ms = ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : null);
    if (!ms) return "";
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 45) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  // Event-type → icon, color, and phrasing for the FIELD ACTIVITY feed.
  const TIMELINE_META = {
    strike:  { icon: "⛏", color: theme.muted, fill: false, verb: "struck Betroleum" },
    gusher:  { icon: "💎", color: theme.gold, fill: false, verb: "hit a gusher!" },
    motherlode: { icon: "🌋", color: theme.gold, fill: true, verb: "hit the MOTHERLODE!" },
    hell:    { icon: "☠", color: theme.red, fill: false, verb: "breached a hell pocket" },
    contain: { icon: "🛡", color: "#6bc7d1", fill: false, verb: "contained the demon" },
    rogue:   { icon: "⚠", color: theme.warn, fill: false, verb: "spotted a rogue prospector" },
    claim:   { icon: "⚑", color: theme.muted, fill: false, verb: "claimed a plot" },
    system:  { icon: "◆", color: theme.accent, fill: true,  verb: "" },
    // Buried-artifact layer (docs/artifact-expansion.md)
    artifact_find: { icon: "🏺", color: "#c79bff", fill: false, verb: "unearthed an artifact" },
    curse:   { icon: "⚰", color: theme.red, fill: true, verb: "disturbed a cursed burial ground" },
    cache_found: { icon: "💰", color: theme.gold, fill: true, verb: "found the OUTLAW CACHE!" },
    // DAILY TICKET (wins only; a loss stays on the ticket)
    ticket: { icon: "🎟", color: theme.gold, fill: false, verb: "matched three on the daily ticket" },
    ticket_jackpot: { icon: "🎟", color: theme.gold, fill: true, verb: "hit the DAILY TICKET JACKPOT!" },
    tonic: { icon: "🧪", color: theme.green, fill: false, verb: "downed a tonic" },
  };

  const testerBadgeStyle = {
    fontSize: 9, letterSpacing: "0.1em", fontFamily: "'Share Tech Mono', monospace",
    color: theme.gold, border: `1px solid ${theme.gold}55`, borderRadius: 2,
    padding: "0 3px", lineHeight: "12px", flexShrink: 0,
  };

  const topCollectorsFor = (compact) => compact ? leaderboardData.topCollectors.slice(0, 3) : leaderboardData.topCollectors;
  const renderLeaderboard = (compact) => (
    <>
      {/* Summary stats row */}
      <div style={{
        display: "flex", justifyContent: "space-between", padding: "8px 0", marginBottom: 8,
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: theme.muted, marginBottom: 2 }}>DRILLERS</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Orbitron', monospace", color: theme.accent }}>{leaderboardData.totalDrillers}</div>
        </div>
        <div style={{ width: 1, background: theme.border }} />
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: theme.muted, marginBottom: 2 }}>TODAY</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Orbitron', monospace", color: theme.accent }}>{leaderboardData.drilledTodayCount}</div>
        </div>
        <div style={{ width: 1, background: theme.border }} />
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: theme.muted, marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, position: "relative" }}>
            MAIN TANK
            <span
              onClick={() => setShowMainTankInfo(p => !p)}
              onMouseEnter={() => setShowMainTankInfo(true)}
              onMouseLeave={() => setShowMainTankInfo(false)}
              style={{ cursor: "pointer", fontSize: 11, color: theme.accent, lineHeight: 1, userSelect: "none" }}
            >&#9432;</span>
            {showMainTankInfo && (
              <div style={{
                position: "absolute", top: "100%", right: 0,
                marginTop: 4, padding: "5px 10px", background: theme.panelBg,
                border: `1px solid ${theme.border}`, borderRadius: 3,
                fontSize: 9, color: theme.text, width: 180, textAlign: "left", zIndex: 10,
                fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.04em",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}>
                Amt collected by users and sent to main holding tank
              </div>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Orbitron', monospace", color: theme.green }}>{communityOil.toLocaleString()}</div>
        </div>
      </div>

      {/* Top Collectors */}
      {leaderboardData.topCollectors.length > 0 && (
        <>
          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: theme.accent, marginBottom: 6 }}>TOP COLLECTORS</div>
          {topCollectorsFor(compact).map((d, i) => (
            <div key={d.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "3px 0", borderBottom: i < topCollectorsFor(compact).length - 1 ? `1px solid ${theme.barBg}` : "none",
              opacity: d.id === user?.id ? 1 : 0.8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: i < 3 ? theme.gold : theme.muted,
                  fontFamily: "'Orbitron', monospace", minWidth: 18, textAlign: "right",
                }}>{i + 1}.</span>
                <span style={{
                  fontSize: 11, color: d.id === user?.id ? theme.accent : theme.text,
                  fontFamily: "'Share Tech Mono', monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: d.id === user?.id ? 700 : 400,
                }}>
                  {d.username || truncId(d.id)}
                </span>
                {testerIds.has(d.id) && <span style={testerBadgeStyle}>TESTER</span>}
              </div>
              <span style={{ whiteSpace: "nowrap", marginLeft: 8, textAlign: "right" }}>
                <span style={{ fontSize: 11, color: theme.accent, fontFamily: "'Share Tech Mono', monospace", display: "block" }}>
                  {(d.totalCollected || 0).toLocaleString()} BTR
                </span>
                {fmtOilUsd(d.totalCollected) && (
                  <span style={{ fontSize: 9, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", display: "block" }}>
                    {fmtOilUsd(d.totalCollected)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Today's Top — full view only */}
      {!compact && leaderboardData.topToday.length > 0 && (
        <>
          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: theme.accent, marginTop: 10, marginBottom: 6 }}>TODAY&apos;S TOP</div>
          {leaderboardData.topToday.map((d, i) => (
            <div key={d.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "3px 0", borderBottom: i < leaderboardData.topToday.length - 1 ? `1px solid ${theme.barBg}` : "none",
              opacity: d.id === user?.id ? 1 : 0.8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: i < 3 ? theme.gold : theme.muted,
                  fontFamily: "'Orbitron', monospace", minWidth: 18, textAlign: "right",
                }}>{i + 1}.</span>
                <span style={{
                  fontSize: 11, color: d.id === user?.id ? theme.accent : theme.text,
                  fontFamily: "'Share Tech Mono', monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: d.id === user?.id ? 700 : 400,
                }}>
                  {d.username || truncId(d.id)}
                </span>
                {testerIds.has(d.id) && <span style={testerBadgeStyle}>TESTER</span>}
              </div>
              <span style={{ whiteSpace: "nowrap", marginLeft: 8, textAlign: "right" }}>
                <span style={{ fontSize: 11, color: theme.accent, fontFamily: "'Share Tech Mono', monospace", display: "block" }}>
                  {(d.totalCollected || 0).toLocaleString()} BTR
                </span>
                {fmtOilUsd(d.totalCollected) && (
                  <span style={{ fontSize: 9, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", display: "block" }}>
                    {fmtOilUsd(d.totalCollected)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </>
      )}

      {leaderboardData.topCollectors.length === 0 && (
        <div style={{ fontSize: 11, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", textAlign: "center", padding: "10px 0" }}>
          No drillers yet — be the first!
        </div>
      )}
    </>
  );

  const leaderboardBody = renderLeaderboard(false);

  // Full panel (with title) — used inside the header trophy overlay.
  const leaderboardPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <PanelTitle theme={theme} isMobile={isMobile} icon={PANEL_ICONS.leaderboard}>LEADERBOARD</PanelTitle>
      {leaderboardBody}
    </div>
  );

  // Collapsible inline section — lives at the bottom of the side panel.
  const leaderboardSection = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <PanelTitle theme={theme} isMobile={isMobile} icon={PANEL_ICONS.leaderboard} onToggle={() => setLeaderboardSectionOpen((o) => !o)} open={leaderboardSectionOpen}>
        LEADERBOARD
      </PanelTitle>
      {leaderboardSectionOpen && (
        <>
          {renderLeaderboard(true)}
          <button
            onClick={() => setShowLeaderboard(true)}
            style={{ width: "100%", marginTop: 4, padding: "8px 0 2px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: theme.muted, textAlign: "right" }}
          >FULL LEADERBOARD &#9656;</button>
        </>
      )}
    </div>
  );

  // Dispatch category tag (label + color), shared by the grid + lightbox.
  const dispatchTag = (eventType) => {
    if (eventType === "hell") return { label: "🔥 HELL", color: theme.red };
    if (eventType === "gusher") return { label: "💥 GUSHER", color: theme.accent };
    if (eventType === "showcase") return { label: "📸 SHOWCASE", color: theme.muted };
    return null;
  };

  // Field Dispatch — gallery of admin-published milestone polaroids (public).
  const fieldDispatchBody = (
    <>
      {feedLoading && feedItems.length === 0 ? (
        <div style={{ fontSize: 11, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", textAlign: "center", padding: "10px 0" }}>
          Loading…
        </div>
      ) : feedItems.length === 0 ? (
        <div style={{ fontSize: 11, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", textAlign: "center", padding: "10px 0" }}>
          No dispatches yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxHeight: 360, overflowY: "auto", overflowX: "hidden", padding: "6px 6px 2px" }}>
          {feedItems.map((it) => {
            // Each saved polaroid has a baked-in -5deg tilt. Counter it (+5deg) then
            // add a STABLE pseudo-random lean + vertical nudge (hashed from the id, so
            // it's varied but doesn't reshuffle on every render) for a scattered look.
            let h = 0;
            for (let i = 0; i < it.id.length; i++) h = (h * 31 + it.id.charCodeAt(i)) | 0;
            const imgRotate = 5 + (((h % 1000) / 1000) * 12 - 6); // net ±6deg
            const imgDy = ((Math.abs(h >> 3) % 100) / 100) * 6 - 3; // ±3px
            return (
              <div
                key={it.id}
                role="button"
                tabIndex={0}
                onClick={() => setLightboxItem(it)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLightboxItem(it); } }}
                title={it.caption || it.eventType || "dispatch"}
                style={{ width: 138, cursor: "zoom-in", display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <img
                  src={it.storageUrl}
                  alt={it.caption || "dispatch"}
                  loading="lazy"
                  style={{
                    width: "100%", height: "auto", display: "block",
                    transform: `translateY(${imgDy}px) rotate(${imgRotate}deg)`,
                    filter: "drop-shadow(0 4px 9px rgba(0,0,0,0.4))",
                  }}
                />
                <div style={{ padding: "5px 4px 0", textAlign: "center", maxWidth: "100%" }}>
                  {dispatchTag(it.eventType) && (
                    <div style={{ fontSize: 9, letterSpacing: "0.1em", color: dispatchTag(it.eventType).color, textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace", marginBottom: 1 }}>
                      {dispatchTag(it.eventType).label}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: theme.text, fontFamily: "'Share Tech Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                    {it.username || "A Prospector"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // FIELD ACTIVITY — single-rail live timeline feed (who / what / when only).
  const feedEvents = isTest && testTimelineEvents.length ? [...testTimelineEvents, ...timelineEvents] : timelineEvents;
  const timelineSection = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <PanelTitle
        theme={theme} isMobile={isMobile} icon={PANEL_ICONS.activity}
        right={(
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, letterSpacing: "0.14em", color: theme.green, textTransform: "uppercase" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.green, boxShadow: `0 0 6px ${theme.green}`, animation: "tankPulse 1.6s ease-in-out infinite" }} />
            LIVE
          </span>
        )}
      >
        FIELD ACTIVITY
      </PanelTitle>
      {feedEvents.length === 0 ? (
        <div style={{ fontSize: 10, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", padding: "4px 0" }}>
          No activity yet — the field is quiet.
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 2, maxHeight: 280, overflowY: "auto" }}>
          {/* vertical spine */}
          <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 2, background: theme.border }} />
          {(timelineOpen ? feedEvents : feedEvents.slice(0, 4)).map((ev) => {
            const meta = TIMELINE_META[ev.type] || TIMELINE_META.strike;
            const who = ev.username || (ev.userId ? truncId(ev.userId) : null);
            return (
              <div key={ev.id} style={{ position: "relative", paddingLeft: 26, paddingBottom: 12 }}>
                <span style={{
                  position: "absolute", left: 1, top: 1, width: 15, height: 15, borderRadius: "50%",
                  background: meta.fill ? meta.color : theme.panelBg,
                  border: `2px solid ${meta.color}`,
                  boxShadow: (ev.type === "hell" || ev.type === "gusher" || ev.type === "motherlode") ? `0 0 8px ${meta.color}99` : "none",
                }} />
                <div style={{ fontSize: 11, lineHeight: 1.4, color: theme.text, fontFamily: "'Share Tech Mono', monospace" }}>
                  <span style={{ marginRight: 5, color: meta.color }}>{meta.icon}</span>
                  {ev.type === "system" ? (
                    <span style={{ color: theme.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10 }}>{ev.detail || "season event"}</span>
                  ) : (
                    <>
                      {who && <span style={{ color: theme.textStrong, fontWeight: 700 }}>{who}</span>} {meta.verb}
                    </>
                  )}
                </div>
                <div style={{ marginTop: 2, fontSize: 9, color: theme.muted, letterSpacing: "0.06em" }}>
                  {relTime(ev.createdAt)}
                  {ev.detail && ev.type !== "system" ? <span style={{ fontStyle: "italic" }}> — {ev.detail}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {feedEvents.length > 4 && (
        <button
          onClick={() => setTimelineOpen((o) => !o)}
          style={{ width: "100%", marginTop: 2, padding: "8px 0 2px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: theme.muted, textAlign: "right" }}
        >
          {timelineOpen ? "SHOW LESS \u25B4" : `SHOW ALL ${feedEvents.length} \u25BE`}
        </button>
      )}
    </div>
  );

  const fieldDispatchSection = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <PanelTitle
        theme={theme} isMobile={isMobile} icon={PANEL_ICONS.dispatch}
        onToggle={() => setFeedDispatchOpen((o) => !o)} open={feedDispatchOpen}
        right={(
          <>
            <a
              href="/hailmary/feed"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open the public gallery"
              style={{ fontSize: 9, letterSpacing: "0.08em", color: theme.muted, textDecoration: "underline", textTransform: "uppercase" }}
            >VIEW ALL</a>
            <span
              onClick={(e) => { e.stopPropagation(); loadFeed(); }}
              title="Refresh"
              style={{ fontSize: 12, color: theme.muted, cursor: "pointer", lineHeight: 1 }}
            >⟳</span>
          </>
        )}
      >
        FIELD DISPATCH{feedItems.length > 0 ? ` · ${feedItems.length}` : ""}
      </PanelTitle>
      {feedDispatchOpen && fieldDispatchBody}
    </div>
  );

  // Admin-only: moderate the pending (approved:false) backlog → Approve publishes
  // it to Field Dispatch; Reject deletes the doc + its storage blob.
  const pendingFeedPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3
        style={{ ...(isMobile ? m.sectionTitle : styles.panelTitle), display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
        onClick={() => setPendingOpen((o) => !o)}
      >
        <span>PENDING DISPATCHES{pendingItems.length > 0 ? ` · ${pendingItems.length}` : ""}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            onClick={(e) => { e.stopPropagation(); loadPending(); }}
            title="Refresh"
            style={{ fontSize: 12, color: theme.muted, cursor: "pointer", lineHeight: 1 }}
          >⟳</span>
          <span style={{ fontSize: 10, color: theme.muted }}>{pendingOpen ? "▴" : "▾"}</span>
        </span>
      </h3>
      {pendingOpen && (
        pendingLoading && pendingItems.length === 0 ? (
          <div style={{ fontSize: 11, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", textAlign: "center", padding: "10px 0" }}>Loading…</div>
        ) : pendingItems.length === 0 ? (
          <div style={{ fontSize: 11, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", textAlign: "center", padding: "10px 0" }}>Nothing waiting — auto-captures from live play land here.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto", overflowX: "hidden", padding: "4px 2px" }}>
            <button
              disabled={moderatingId === "__all__"}
              onClick={approveAllPending}
              style={{ ...styles.btn, padding: "5px 10px", fontSize: 10, color: theme.green, borderColor: theme.green, justifyContent: "center", opacity: moderatingId === "__all__" ? 0.5 : 1 }}
            >
              {moderatingId === "__all__" ? "APPROVING…" : `✓ APPROVE ALL (${pendingItems.length})`}
            </button>
            {pendingItems.map((it) => {
              const tag = dispatchTag(it.eventType);
              const busy = moderatingId === it.id;
              return (
                <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "center", opacity: busy ? 0.5 : 1, borderBottom: `1px solid ${theme.barBg}`, paddingBottom: 8 }}>
                  <img
                    src={it.storageUrl}
                    alt={it.caption || "pending"}
                    loading="lazy"
                    onClick={() => setLightboxItem(it)}
                    title="Click to enlarge"
                    style={{ width: 72, height: "auto", display: "block", cursor: "zoom-in", flexShrink: 0, filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.4))" }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {tag && <div style={{ fontSize: 9, letterSpacing: "0.1em", color: tag.color, fontFamily: "'Share Tech Mono', monospace", marginBottom: 2 }}>{tag.label}</div>}
                    <div style={{ fontSize: 10, color: theme.text, fontFamily: "'Share Tech Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.username || "A Prospector"}</div>
                    {it.caption && <div style={{ fontSize: 9, color: theme.muted, fontFamily: "'Share Tech Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.caption}</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                      <button disabled={busy} onClick={() => moderateDispatch(it.id, "approve")} style={{ ...styles.btn, padding: "3px 10px", fontSize: 10, color: theme.green, borderColor: theme.green }}>APPROVE</button>
                      <button disabled={busy} onClick={() => moderateDispatch(it.id, "reject")} style={{ ...styles.btn, padding: "3px 10px", fontSize: 10, color: theme.red, borderColor: theme.red }}>REJECT</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );

  // Lightbox — the clicked dispatch enlarged over a blurred, dimmed page.
  // The polaroid webp is transparent, so it floats over the blur instead of
  // sitting on the browser's default white.
  const feedLightbox = lightboxItem && (
    <div
      onClick={() => setLightboxItem(null)}
      style={{
        position: "fixed", inset: 0, zIndex: 100000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 14, padding: 24,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        cursor: "zoom-out",
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setLightboxItem(null); }}
        aria-label="Close"
        title="Close"
        style={{
          position: "absolute", top: 18, right: 18,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(0,0,0,0.5)", color: "#fff",
          border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer",
          fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >✕</button>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, zoom: "var(--hm-ui-scale, 1)" }}>
      <img
        src={lightboxItem.storageUrl}
        alt={lightboxItem.caption || "dispatch"}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "min(calc(92vw / var(--hm-ui-scale, 1)), 560px)", maxHeight: "calc(82vh / var(--hm-ui-scale, 1))", objectFit: "contain",
          cursor: "default", filter: "drop-shadow(0 24px 70px rgba(0,0,0,0.65))",
        }}
      />
      {(lightboxItem.username || lightboxItem.eventType) && (
        <div style={{ textAlign: "center", fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.85)" }}>
          {lightboxItem.eventType && (
            <span style={{ fontSize: 11, letterSpacing: "0.12em", color: lightboxItem.eventType === "hell" ? "#ff7a5c" : lightboxItem.eventType === "showcase" ? "rgba(255,255,255,0.7)" : "#ffd479", marginRight: 8, textTransform: "uppercase" }}>
              {lightboxItem.eventType === "hell" ? "🔥 HELL" : lightboxItem.eventType === "showcase" ? "📸 SHOWCASE" : "💥 GUSHER"}
            </span>
          )}
          <span style={{ fontSize: 12 }}>{lightboxItem.username || "A Prospector"}</span>
        </div>
      )}
      </div>
    </div>
  );

  const inspectorPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3
        style={{ ...(isMobile ? m.sectionTitle : styles.panelTitle), cursor: selectedX === null && userDrill?.col != null ? 'pointer' : undefined }}
        onClick={() => {
          if (selectedX === null && userDrill?.col != null) {
            handleSelectClaim({ x: userDrill.col, y: userDrill.row });
          }
        }}
      >
        {selectedX !== null
          ? `PLOT (${selectedX + 1}, ${sliceY + 1}) INSPECTOR`
          : userDrill?.col != null
            ? `YOUR CLAIM (${userDrill.col + 1}, ${userDrill.row + 1}) — TAP TO VIEW`
            : "SELECT A PLOT"}
      </h3>

      {selectedData ? (
        <>
          <div style={styles.inspectorStats}>
            <div style={styles.inspectorRow}>
              <span style={styles.inspectorKey}>Position:</span>
              <span style={styles.inspectorVal}>X{selectedX}, Y{sliceY}</span>
            </div>
            <div style={styles.inspectorRow}>
              <span style={styles.inspectorKey}>Total Betroleum:</span>
              <span style={styles.inspectorVal}>{selectedData.total.toLocaleString()} BTR</span>
            </div>
            <div style={styles.inspectorRow}>
              <span style={styles.inspectorKey}>Richest Depth:</span>
              <span style={styles.inspectorVal}>Level {selectedData.richestDepth + 1}</span>
            </div>
            <div style={styles.inspectorRow}>
              <span style={styles.inspectorKey}>Rank:</span>
              <span style={styles.inspectorVal}>
                #{stats.sorted.findIndex(r => r.index === selectedClaimIndex) + 1} of {gridSize * gridSize}
              </span>
            </div>
          </div>

          <button
            onClick={handleDrill}
            disabled={isDrilling}
            style={{
              ...styles.drillBtn,
              ...(isDrilling ? styles.drillBtnDisabled : {}),
            }}
          >
            {isDrilling ? `DRILLING... DEPTH ${drillDepth}` : drillDepth > 0 ? "DRILL AGAIN" : "START DRILLING"}
          </button>

          {drillDepth > 0 && (
            <div style={styles.drillResults}>
              <div style={styles.inspectorRow}>
                <span style={styles.inspectorKey}>Drilled to:</span>
                <span style={styles.inspectorVal}>Depth {drillDepth}</span>
              </div>
              <div style={styles.inspectorRow}>
                <span style={{ ...styles.inspectorKey, color: theme.green }}>Extracted:</span>
                <span style={{ ...styles.inspectorVal, color: theme.green }}>
                  {selectedData.extracted.toLocaleString()} BTR
                </span>
              </div>
              {drillDepth < DEPTH_Z && selectedData.missed > 0 && (
                <div style={styles.inspectorRow}>
                  <span style={{ ...styles.inspectorKey, color: theme.warn }}>Underground:</span>
                  <span style={{ ...styles.inspectorVal, color: theme.warn }}>
                    {selectedData.missed.toLocaleString()} BTR
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Depth Chart */}
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: theme.accent, marginTop: 10, marginBottom: 6 }}>DEPTH PROFILE</div>
          <div style={styles.depthChart}>
            {selectedData.depthData.map((oil, d) => {
              const barWidth = stats.maxOil > 0 ? (oil / stats.maxOil) * 100 : 0;
              const drilled = d < drillDepth;
              return (
                <div key={d} style={styles.depthRow}>
                  <span style={{
                    ...styles.depthRowLabel,
                    color: drilled ? theme.accent : theme.muted,
                  }}>
                    D{d + 1}
                  </span>
                  <div style={styles.depthBarWrap}>
                    <div style={{
                      width: `${barWidth}%`,
                      height: "100%",
                      background: drilled
                        ? `linear-gradient(90deg, ${theme.gold}, ${theme.goldBorder})`
                        : `linear-gradient(90deg, ${theme.borderLight}, ${theme.depthUndrilled})`,
                      transition: "all 0.3s",
                    }} />
                  </div>
                  <span style={{
                    ...styles.depthRowVal,
                    color: drilled ? theme.accent : theme.muted,
                  }}>
                    {oil > 0 ? oil.toLocaleString() : "\u2014"}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={styles.emptyState}>
          Click any plot on the survey map or cross-section to inspect
        </div>
      )}
    </div>
  );


  const dryZonesPanel = isRevealed ? (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>
        <span style={{ ...styles.rankIcon, transform: "rotate(180deg)", display: "inline-block" }}>&#9650;</span> DRY ZONES
      </h3>
      <div style={styles.rankList}>
        {stats.sorted.slice(-3).reverse().map((c) => (
          <div
            key={c.claim}
            onClick={() => handleSelectClaim(c)}
            style={{ ...styles.rankRow, cursor: "pointer" }}
          >
            <span style={{ ...styles.rankClaim, color: theme.muted }}>CLAIM {c.claim}</span>
            <span style={{ ...styles.rankOil, color: theme.muted }}>{c.oil.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Combined "field intel" section — MAX CLAIM (peak + top-5 richest cells) and
  // DEPOSIT LOCATIONS (blob centers) as two tabs in one panel, to declutter.
  const fieldIntelPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {[["claims", "MAX CLAIM"], ["deposits", "DEPOSIT LOCATIONS"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setIntelTab(key)}
            style={{
              flex: 1, padding: "5px 6px", borderRadius: 3, cursor: "pointer",
              fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: `1px solid ${intelTab === key ? theme.accent : theme.border}`,
              background: intelTab === key ? `${theme.accent}22` : "transparent",
              color: intelTab === key ? theme.accent : theme.muted,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {intelTab === "claims" ? (
        <>
          <div style={styles.paramRow}>
            <span style={styles.paramLabel}>RICHEST PLOT</span>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 13, fontWeight: 700, color: theme.accent }}>
              {stats.maxClaimTotal} BTR
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 9, color: theme.muted, lineHeight: 1.6 }}>
            {stats.sorted.slice(0, 5).map((c, i) => (
              <div
                key={c.claim ?? i}
                onClick={() => handleSelectClaim(c)}
                title="Fly to this plot"
                style={{
                  display: "flex", justifyContent: "space-between", cursor: "pointer",
                  padding: "1px 3px", borderRadius: 2,
                  background: c.index === selectedClaimIndex ? "rgba(212,168,84,0.15)" : "transparent",
                }}
              >
                <span>#{i + 1} ({c.x + 1},{c.y + 1})</span>
                <span style={{ color: c.oil > 0 ? theme.textStrong : theme.muted }}>{c.oil} BTR</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={isMobile ? m.depositGrid : styles.depositList}>
          {/* Blob centers are continuous (cx/cy in grid units, cz = depth layer).
              Map each to its discrete CELL + depth so it lines up with the grid and
              you can click to fly/select, then FORCE STRIKE it (drill to ~z to hit). */}
          {stats.deposits.map((d, i) => {
            const col = Math.max(0, Math.min(Math.round(d.cx), gridSize - 1));
            const row = Math.max(0, Math.min(Math.round(d.cy), gridSize - 1));
            const depth = Math.round(d.cz);
            return (
              <div
                key={i}
                onClick={() => handleSelectClaim({ x: col, y: row })}
                title={`blob center (${d.cx.toFixed(1)}, ${d.cy.toFixed(1)}, ${d.cz.toFixed(1)}) · r${d.radius.toFixed(1)} — click to fly + select`}
                style={{ ...styles.depositRow, cursor: "pointer" }}
              >
                <span style={styles.depositIndex}>{String(i + 1).padStart(2, "0")}</span>
                <span style={styles.depositCoord}>
                  cell ({col + 1},{row + 1}) · z{depth}
                </span>
                <span style={styles.depositRadius}>r{d.radius.toFixed(1)}</span>
                {!isRevealed && <span style={styles.depositHidden}>HIDDEN</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const hellPocketsPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={{
        ...(isMobile ? m.sectionTitle : styles.panelTitle),
        color: "#cc3333",
      }}>HELL POCKETS ({stats.hellPockets.length})</h3>
      <div style={isMobile ? m.depositGrid : styles.depositList}>
        {stats.hellPockets.map((hp, i) => (
          <div key={i} style={{ ...styles.depositRow, borderColor: "rgba(204,51,51,0.2)" }}>
            <span style={{ ...styles.depositIndex, color: "#cc3333" }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={styles.depositCoord}>
              plot ({hp.x + 1}, {hp.y + 1}) depth {hp.z + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const controlButtons = (
    <>
      <button
        onClick={handleReveal}
        disabled={isRevealed}
        title="Show where the Betroleum is buried for the current field (visualization only — does not change anything)"
        style={{
          ...styles.btn,
          ...styles.btnPrimary,
          ...(isRevealed ? styles.btnDisabled : {}),
          ...(isMobile ? { padding: "8px 14px", fontSize: 10 } : {}),
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="7" cy="7" r="2" fill="currentColor" />
        </svg>
        {isMobile ? "REVEAL" : "REVEAL DEPOSITS"}
      </button>
      <button
        onClick={handleReset}
        title="Hide the reveal and rewind the depth preview. Keeps the same field — nothing is re-rolled."
        style={{ ...styles.btn, ...(isMobile ? { padding: "8px 14px", fontSize: 10 } : {}) }}
      >
        CLEAR VIEW
      </button>
      <button
        onClick={handleRandomize}
        title="Roll a brand-new field — every deposit moves. Destructive: regenerates the whole map. Use between seasons, not mid-game."
        style={{ ...styles.btn, ...(isMobile ? { padding: "8px 14px", fontSize: 10 } : {}) }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
          <path d="M2 5h8l-2-2M12 9H4l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        NEW SEED
      </button>
    </>
  );

  const cssAnimations = (
    <style>{`
      @keyframes scanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100vh); }
      }
      @keyframes grainAnim {
        0%, 100% { transform: translate(0, 0); }
        10% { transform: translate(-5%, -10%); }
        20% { transform: translate(-15%, 5%); }
        30% { transform: translate(7%, -25%); }
        40% { transform: translate(-5%, 25%); }
        50% { transform: translate(-15%, 10%); }
        60% { transform: translate(15%, 0%); }
        70% { transform: translate(0%, 15%); }
        80% { transform: translate(3%, 35%); }
        90% { transform: translate(-10%, 10%); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes tankPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes demonBannerPulse {
        0%, 100% { box-shadow: 0 4px 30px rgba(255,34,0,0.3); }
        50% { box-shadow: 0 4px 50px rgba(255,34,0,0.6); }
      }
      @keyframes opalSheen {
        0% { background-position: 0% center; }
        100% { background-position: 200% center; }
      }
    `}</style>
  );

  // Track viewed recordings — badge shows unwatched count
  const [viewedRecIds, setViewedRecIds] = useState(new Set());
  const unwatchedCount = recordings.filter((r) => !viewedRecIds.has(r.id)).length;

  // CCTV overlay — collapsible widget, top-left of canvas
  const cctvOverlay = selectedX !== null && flyTarget && pumpConfig.showCamera && cameraViewable && (
    <div style={{ ...cctvStyles.wrap, zoom: "var(--hm-ui-scale, 1)" }}>
      <div
        style={cctvStyles.header}
        onClick={() => setCctvOpen((o) => !o)}
      >
        <span style={isRecording ? cctvStyles.rec : cctvStyles.recInactive}>
          &#9679; {isRecording ? "REC" : "CAM"}
        </span>
        <span style={cctvStyles.camLabel}>CAM-{selectedX},{sliceY}</span>
        {unwatchedCount > 0 && (
          <span style={cctvStyles.recCount}>{unwatchedCount}</span>
        )}
        <span style={cctvStyles.toggle}>{cctvOpen ? "\u25B2" : "\u25BC"}</span>
      </div>
      {cctvOpen && (
        <>
          {playbackUrl ? (
            <div style={{ position: "relative" }}>
              <video
                src={playbackUrl}
                autoPlay
                controls
                style={cctvStyles.canvas}
                onEnded={() => setPlaybackUrl(null)}
              />
              <div style={cctvStyles.playbackControls}>
                <button
                  style={cctvStyles.backToLive}
                  onClick={() => setPlaybackUrl(null)}
                >
                  &#9654; LIVE
                </button>
                <a
                  href={playbackUrl}
                  download={`cctv_${selectedX}_${sliceY}.webm`}
                  style={cctvStyles.clipAction}
                  title="Download clip"
                  onClick={(e) => e.stopPropagation()}
                >
                  &#8681;
                </a>
                <button
                  style={cctvStyles.clipAction}
                  title="Share clip"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (navigator.share) {
                      navigator.share({
                        title: `Security Cam ${selectedX},${sliceY}`,
                        text: "Caught on camera! Prospector security footage",
                        url: playbackUrl,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(playbackUrl).then(() => {
                        alert("Link copied!");
                      }).catch(() => {});
                    }
                  }}
                >
                  &#8599;
                </button>
              </div>
            </div>
          ) : (
            <canvas
              ref={cctvCanvasRef}
              width={320}
              height={240}
              style={cctvStyles.canvas}
            />
          )}
          <div style={cctvStyles.scanlines} />
          <div style={cctvStyles.footer}>
            <span style={cctvStyles.timestamp}>
              {new Date().toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
          {recordings.length > 0 && (
            <div style={cctvStyles.recList}>
              {recordings.slice(0, 5).map((r) => (
                <div key={r.id} style={cctvStyles.recRow}>
                  <button
                    style={{
                      ...cctvStyles.recBtn,
                      ...(viewedRecIds.has(r.id) ? {} : { color: "#ff6655", border: "1px solid #ff4433" }),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaybackUrl(r.downloadUrl);
                      setViewedRecIds((prev) => new Set(prev).add(r.id));
                    }}
                    title={`${r.eventType} @ ${r.col},${r.row}`}
                  >
                    {r.eventType === "rogue" ? "R" : "G"} {new Date(r.createdAt).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </button>
                  <a
                    href={r.downloadUrl}
                    download={`cctv_${r.eventType}_${r.col}_${r.row}.webm`}
                    style={cctvStyles.recIcon}
                    title="Download"
                    onClick={(e) => e.stopPropagation()}
                  >&#8681;</a>
                  <button
                    style={cctvStyles.recIcon}
                    title="Share"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (navigator.share) {
                        navigator.share({
                          title: "Prospector Security Cam",
                          text: "Caught on camera!",
                          url: r.downloadUrl,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(r.downloadUrl).then(() => {
                          alert("Link copied!");
                        }).catch(() => {});
                      }
                    }}
                  >&#8599;</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // ADMIN PASSWORD GATE
  // ═══════════════════════════════════════════════════════════
  if (isAdmin && !adminAuthed) {
    return (
      <div style={{
        width: "100vw",
        height: "100vh",
        background: theme.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        <div style={{
          background: theme.panelBg,
          border: `1px solid ${theme.goldBorder}`,
          borderRadius: 6,
          padding: 32,
          maxWidth: 360,
          width: "90%",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: theme.muted, marginBottom: 8 }}>LYQUID80 QUEST</div>
          <h2 style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 16,
            color: theme.accent,
            letterSpacing: "0.15em",
            margin: "0 0 20px",
          }}>ADMIN ACCESS</h2>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
            placeholder="Enter password"
            style={{
              width: "100%",
              padding: "10px 12px",
              background: theme.inputBg,
              border: `1px solid ${theme.borderLight}`,
              borderRadius: 3,
              color: theme.text,
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.08em",
              marginBottom: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleAdminLogin}
            style={{
              width: "100%",
              padding: "10px 20px",
              background: "linear-gradient(180deg, #d4a854, #b8922e)",
              border: `1px solid ${theme.goldBorder}`,
              borderRadius: 3,
              color: "#fff",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            AUTHENTICATE
          </button>
        </div>
      </div>
    );
  }

  // ── Pre-game phase gates ──
  // Hold render until Firestore settings arrive so the default "ticket_sale"
  // state doesn't briefly render OilQualify on top of an in-progress game.
  if ((!settingsLoaded || (gamePhase === "ticket_sale" && !drillLoaded)) && !previewMode) {
    // Also hold during ticket_sale until the drill doc resolves, so a
    // plot-holder doesn't flash the registration lobby before landing on the
    // field in pre-season mode.
    return <div style={{ width: "100vw", height: "100vh", background: theme.bg }} />;
  }
  const userHasPlot = userDrill?.col != null;
  // Pre-season split: lobbyView=true pins the registration lobby open;
  // lobbyView=false sends the user to the 3D field — plot-holders get
  // pre-season mode, qualified plot-less users get the ON-FIELD PLOT PICK
  // (the only claiming path: lobby CTA → field → click a cell → stake).
  // null (undecided) falls back on plot ownership.
  if ((gamePhase === "ticket_sale" || lobbyForce) && !previewMode && (lobbyView ?? !userHasPlot)) {
    return (
      // The lobby sits outside the main layout, so it gets the UI-scale zoom
      // here (desktop only — mobile is authored for the phone). Its fixed
      // noise background counter-zooms itself to stay full-bleed and crisp.
      <div style={{ zoom: isMobile ? 1 : uiScale }}>
        <OilQualify
          theme={theme}
          darkMode={uiDark}
          isMobile={isMobile}
          user={user}
          isAdmin={isAdmin && adminAuthed}
          adminPassword={adminPassword}
          saveGameSettings={saveGameSettings}
          walletAddress={walletAddress}
          tokenBalance={tokenBalance}
          isWalletConnected={isWalletConnected}
          storedRef={typeof window !== "undefined" ? localStorage.getItem("oil_ref") : null}
          gridSize={gridSize}
          prizePool={totalOilBudget}
          numberOfDeposits={numberOfDeposits}
          gameStartDate={gameStartDate}
          onEnterField={() => setLobbyView(false)}
          seedCommitment={seedCommitment}
          anchorBlock={anchorBlock}
          anchorBlockHash={anchorBlockHash}
        />
      </div>
    );
  }

  // Phase override buttons (admin only, visible in active/ended phases)
  const phaseOverrideButtons = isAdmin && (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 9, letterSpacing: "0.1em", color: theme.muted }}>PHASE:</span>
      {["ticket_sale", "active", "ended"].map((p) => (
        <button
          key={p}
          // Phase selector is authoritative over gameEnded — keep the two settings
          // fields in lockstep so you can't land on ACTIVE while the GAME ENDED
          // banner lingers (only "ended" implies the game is over).
          onClick={() => { const ended = p === "ended"; setGameEnded(ended); saveGameSettings({ gamePhase: p, gameEnded: ended }); }}
          style={{
            padding: "3px 8px",
            border: `1px solid ${gamePhase === p ? theme.gold : theme.border}`,
            borderRadius: 3,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9,
            cursor: "pointer",
            background: gamePhase === p ? `${theme.gold}22` : "transparent",
            color: gamePhase === p ? theme.gold : theme.muted,
          }}
        >
          {/* `ticket_sale` is the legacy stored value for the pre-game
              registration/qualification lobby (OilQualify) — relabel for
              display only; the stored phase value is unchanged. */}
          {({ ticket_sale: "REGISTRATION", active: "ACTIVE", ended: "ENDED" }[p] || p.toUpperCase())}
        </button>
      ))}
      {/* During registration an admin with a claimed plot lands on the field
          (pre-season mode) — this is their way back into the lobby, since the
          player-facing VIEW REGISTRATION LOBBY link lives in the (non-admin)
          pre-season panel. */}
      {gamePhase === "ticket_sale" && (
        <button
          onClick={() => setLobbyView(true)}
          style={{
            padding: "3px 8px",
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9,
            cursor: "pointer",
            background: "transparent",
            color: theme.muted,
          }}
        >
          OPEN LOBBY
        </button>
      )}
    </div>
  );

  // End Game button (admin only)
  const endGameButton = isAdmin && !gameEnded && (
    <button
      onClick={() => { setGameEnded(true); setGamePhase("ended"); saveGameSettings({ gameEnded: true, gamePhase: "ended" }); }}
      style={{
        padding: "10px 20px",
        background: `linear-gradient(180deg, ${theme.red}, #a03030)`,
        border: `1px solid ${theme.red}`,
        borderRadius: 3,
        color: "#fff",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.12em",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      END GAME
    </button>
  );

  // Admin/test: claim the selected plot as the logged-in user (bypasses qualification)
  const claimPlotButton = isAdmin && selectedX !== null && !!user?.id && (
    <button
      onClick={handleAdminClaim}
      title="Assign the selected plot to your account so you can edit it (test bypass)"
      style={{
        padding: "10px 20px",
        background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
        border: `1px solid ${theme.goldBorder}`,
        borderRadius: 3,
        color: "#1a1408",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.12em",
        cursor: "pointer",
      }}
    >
      CLAIM PLOT AS ME ({selectedX + 1},{sliceY + 1})
    </button>
  );

  const previewBanner = previewMode && (
    <div style={{
      width: "100%",
      zoom: "var(--hm-ui-scale, 1)",
      padding: "8px 16px",
      background: "linear-gradient(90deg, rgba(212,168,84,0.95), rgba(184,146,46,0.95))",
      borderBottom: "1px solid #8b6914",
      color: "#1a1408",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 11,
      letterSpacing: "0.12em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      flexWrap: "wrap",
      boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
      position: "relative",
      zIndex: 100,
    }}>
      <span style={{ fontWeight: 700 }}>PREVIEW MODE</span>
      <span style={{ opacity: 0.8 }}>Sign up to actually play and claim a plot</span>
      <a
        href="/hailmary"
        style={{
          padding: "3px 10px",
          background: "#1a1408",
          color: "#d4a854",
          borderRadius: 2,
          textDecoration: "none",
          fontWeight: 700,
          letterSpacing: "0.15em",
        }}
      >
        GO TO SIGN-UP &rarr;
      </a>
    </div>
  );

  const gameEndedBanner = isAdmin && gameEnded && (
    <div style={{
      padding: "6px 16px",
      background: "rgba(160,48,48,0.1)",
      border: "1px solid rgba(160,48,48,0.3)",
      borderRadius: 3,
      color: theme.red,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 11,
      letterSpacing: "0.1em",
    }}>
      GAME ENDED
      {/* No VIEW REPORT link: this banner is admin-only, and for an admin
          report mode shows strictly less than admin mode. Report mode itself
          still works via /hailmary?mode=report for public/player sharing. */}
    </div>
  );

  // Mode badge for header
  // ── Demon Bounty Notification Banner ──
  const testBlockade = (isTest || isAdmin) && hellActive && !demonBlockade ? {
    active: true,
    summonerUsername: "TEST PLAYER",
    bountyAmount: 42,
    targetCol: hellCol ?? 0,
    targetRow: hellRow ?? 0,
  } : null;
  const activeDemonBlockade = demonBlockade?.active ? demonBlockade : testBlockade;

  const demonBanner = (isBlockadeActive || hellActive) && activeDemonBlockade && (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      zoom: "var(--hm-ui-scale, 1)",
      padding: "10px 16px",
      background: "linear-gradient(180deg, rgba(140,10,0,0.95), rgba(80,5,0,0.9))",
      borderBottom: "2px solid rgba(255,34,0,0.6)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      textAlign: "center",
      fontFamily: "'Share Tech Mono', monospace",
      animation: "demonBannerPulse 2s ease-in-out infinite",
    }}>
      <div style={{
        fontSize: isMobile ? 12 : 14,
        fontWeight: 700,
        letterSpacing: "0.2em",
        color: "#ff4422",
        textShadow: "0 0 10px rgba(255,34,0,0.6)",
        marginBottom: 4,
      }}>
        {isSummonerStunned
          ? "YOU UNLEASHED HELL"
          : `${activeDemonBlockade.summonerUsername?.toUpperCase() || "SOMEONE"} UNLEASHED HELL`}
      </div>
      <div style={{
        fontSize: isMobile ? 10 : 12,
        letterSpacing: "0.15em",
        color: "#ffccaa",
        display: "flex",
        justifyContent: "center",
        gap: isMobile ? 12 : 24,
        flexWrap: "wrap",
      }}>
        <span>BOUNTY: {activeDemonBlockade.bountyAmount || 0} USDC + 3 BONUS DRILLS</span>
        <span>TARGET: ({(activeDemonBlockade.targetCol ?? 0) + 1}, {(activeDemonBlockade.targetRow ?? 0) + 1})</span>
      </div>
      {isSummonerStunned && (
        <div style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "#ff6644",
          marginTop: 4,
        }}>
          INCAPACITATED — {stunRemaining > 0
            ? `${Math.floor(stunRemaining / 60)}:${String(stunRemaining % 60).padStart(2, "0")} REMAINING`
            : "RECOVERING..."}
        </div>
      )}
      {!isSummonerStunned && activeDemonBlockade?.summonerId === user?.id && (
        <div style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "#ffaa88",
          marginTop: 4,
        }}>
          CATCH THE DEMON WHEN IT STOPS TO DISMISS IT — BOUNTY RETURNS TO COMMUNITY POOL
        </div>
      )}
      {!isSummonerStunned && activeDemonBlockade?.summonerId !== user?.id && (
        <div style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "#ffaa88",
          marginTop: 4,
        }}>
          ALL DRILLING HALTED — CATCH THE DEMON WHEN IT STOPS TO CLAIM THE BOUNTY
        </div>
      )}
    </div>
  );

  // Banishing now happens by catching the roaming demon during its vulnerable
  // pause window (the 3D BANISH ring / demon body), not via an always-on button.
  // This element is the "it dodged!" taunt shown after a mistimed click.
  const claimBountyButton = demonStunRemaining > 0 && (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? 80 : 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
        zoom: "var(--hm-ui-scale, 1)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "12px 24px" : "14px 30px",
        background: "linear-gradient(180deg, rgba(90,5,0,0.95), rgba(50,3,0,0.92))",
        border: "2px solid rgba(255,68,34,0.7)",
        borderRadius: 6,
        color: "#ffb499",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: isMobile ? 12 : 14,
        fontWeight: 700,
        letterSpacing: "0.2em",
        boxShadow: "0 0 30px rgba(255,34,0,0.45)",
        textTransform: "uppercase",
        pointerEvents: "none",
        animation: "demonBannerPulse 0.9s ease-in-out infinite",
      }}
    >
      <span>⚡ STUNNED — {demonStunRemaining}s</span>
    </div>
  );

  const bountyClaimedBanner = bountyToast && (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      zoom: "var(--hm-ui-scale, 1)",
      padding: "12px 16px",
      background: "linear-gradient(180deg, rgba(20,100,20,0.95), rgba(10,60,10,0.9))",
      borderBottom: "2px solid rgba(80,200,80,0.5)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      textAlign: "center",
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <div style={{
        fontSize: isMobile ? 12 : 14,
        fontWeight: 700,
        letterSpacing: "0.2em",
        color: "#44dd44",
        textShadow: "0 0 10px rgba(68,221,68,0.5)",
        marginBottom: 4,
      }}>
        {bountyToast.dismissed
          ? "DEMON DISMISSED — BOUNTY RETURNED TO POOL"
          : bountyToast.isYou
            ? "YOU BANISHED THE DEMON!"
            : `DEMON BANISHED BY ${bountyToast.hunterUsername?.toUpperCase()}`}
      </div>
      {!bountyToast.dismissed && (
        <div style={{
          fontSize: isMobile ? 10 : 12,
          letterSpacing: "0.15em",
          color: "#aaddaa",
        }}>
          BOUNTY CLAIMED: {bountyToast.bountyAmount} USDC + 3 BONUS DRILLS
          {bountyToast.isYou && " — DRILLING RESUMED"}
        </div>
      )}
    </div>
  );

  const claimToastBanner = claimToast && (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      zoom: "var(--hm-ui-scale, 1)",
      padding: "12px 16px",
      background: "linear-gradient(180deg, rgba(120,90,20,0.95), rgba(70,50,10,0.9))",
      borderBottom: "2px solid rgba(212,168,84,0.6)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      textAlign: "center",
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <div style={{
        fontSize: isMobile ? 12 : 14,
        fontWeight: 700,
        letterSpacing: "0.2em",
        color: "#e8c878",
        textShadow: "0 0 10px rgba(212,168,84,0.5)",
      }}>
        CLAIM JUMPED — PLOT ({claimToast.col + 1}, {claimToast.row + 1})
      </div>
    </div>
  );

  // Step-by-step help for a photo booth camera failure, keyed by the cause the
  // booth reported. Platform-aware where it matters (the OS-level block).
  const boothCamHelpSteps = {
    insecure: { title: "CAMERA NEEDS A SECURE CONNECTION", steps: [
      "Browsers disable the camera on plain http — open this site via https:// (or localhost).",
    ] },
    NotAllowedError: { title: "CAMERA BLOCKED FOR THIS SITE", steps: [
      "Click the camera icon at the right end of your browser's address bar.",
      "Set camera access to Allow, then click the photo booth again.",
    ] },
    SystemDenied: { title: "YOUR SYSTEM IS BLOCKING THE CAMERA", steps: [
      typeof navigator !== "undefined" && /Mac/.test(navigator.platform || "")
        ? "System Settings → Privacy & Security → Camera → enable your browser."
        : "In your OS privacy settings, allow camera access for your browser.",
      "Fully quit and reopen the browser, then click the booth again.",
    ] },
    NotFoundError: { title: "NO CAMERA DETECTED", steps: ["Connect a camera, then click the booth again."] },
    NotReadableError: { title: "CAMERA IS IN USE", steps: ["Another app is holding the camera (video call, Photo Booth…). Quit it, then click the booth again."] },
    unknown: { title: "CAMERA UNAVAILABLE", steps: ["Check your browser's camera permissions, then click the booth again."] },
  };
  const boothCamInfo = boothCamError ? (boothCamHelpSteps[boothCamError] || boothCamHelpSteps.unknown) : null;
  const boothCamBanner = boothCamInfo && (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      zoom: "var(--hm-ui-scale, 1)",
      padding: "12px 40px 12px 16px",
      background: "linear-gradient(180deg, rgba(120,90,20,0.95), rgba(70,50,10,0.9))",
      borderBottom: "2px solid rgba(212,168,84,0.6)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      textAlign: "center",
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <div style={{
        fontSize: isMobile ? 12 : 14,
        fontWeight: 700,
        letterSpacing: "0.2em",
        color: "#e8c878",
        textShadow: "0 0 10px rgba(212,168,84,0.5)",
      }}>
        {boothCamInfo.title}
      </div>
      {boothCamInfo.steps.map((s, i) => (
        <div key={i} style={{ fontSize: isMobile ? 11 : 12, color: "#d8c9a8", marginTop: 4 }}>
          {s}
        </div>
      ))}
      <button
        onClick={() => setBoothCamError(null)}
        style={{ position: "absolute", top: 8, right: 12, background: "none", border: "none", color: "#e8c878", fontSize: 16, cursor: "pointer", fontFamily: "inherit" }}
        aria-label="Dismiss camera help"
      >
        ✕
      </button>
    </div>
  );

  const modeBadge = (isAdmin || isReport) && (
    <span style={{
      padding: "2px 8px",
      background: isAdmin ? "rgba(160,48,48,0.15)" : "rgba(90,138,58,0.15)",
      border: `1px solid ${isAdmin ? "rgba(160,48,48,0.3)" : "rgba(90,138,58,0.3)"}`,
      borderRadius: 3,
      fontSize: 10,
      letterSpacing: "0.15em",
      color: isAdmin ? theme.red : theme.green,
      marginLeft: 8,
    }}>
      {isAdmin ? "ADMIN" : "REPORT"}
    </span>
  );

  // ── Passive Depth Indicator (active mode only, not test mode) ──
  // Admin test surface for the alert channels — the player-facing enrollment
  // UI (pre-season checklist / auto-pump nudge) lives inside drillButton,
  // which admin/test modes never render, so without this an admin has no way
  // to enroll a device or fire a test push.
  const adminAlertsPanel = isAdmin && (
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", color: theme.muted, marginBottom: 6, fontFamily: "'Share Tech Mono', monospace" }}>
        STRIKE ALERTS (THIS DEVICE)
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontFamily: "'Share Tech Mono', monospace" }}>
        <span style={{ fontSize: 9, color: pushAlerts.enabled ? theme.green : theme.muted }}>
          PUSH {pushAlerts.enabled ? "ON" : "OFF"}
        </span>
        <span style={{ fontSize: 9, color: telegramLinked ? theme.green : theme.muted }}>
          · TELEGRAM {telegramLinked ? "LINKED" : "—"}
        </span>
        {!pushAlerts.enabled && pushAlerts.supported && (
          <button
            onClick={pushAlerts.enable}
            disabled={pushAlerts.busy}
            style={{ padding: "3px 10px", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", background: `${theme.gold}22`, color: theme.gold, border: `1px solid ${theme.gold}`, borderRadius: 3 }}
          >{pushAlerts.busy ? "…" : "ENABLE PUSH"}</button>
        )}
        {pushAlerts.enabled && (
          <button
            onClick={pushAlerts.sendTest}
            disabled={pushAlerts.testState === "sending"}
            style={{ padding: "3px 10px", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", background: "transparent", color: pushAlerts.testState === "sent" ? theme.green : pushAlerts.testState === "failed" ? theme.red : theme.muted, border: `1px solid ${theme.border}`, borderRadius: 3 }}
          >
            {pushAlerts.testState === "sending" ? "…" : pushAlerts.testState === "sent" ? `SENT ✓${pushAlerts.testDetail ? ` (${pushAlerts.testDetail})` : ""}` : pushAlerts.testState === "failed" ? `FAILED${pushAlerts.testDetail ? `: ${pushAlerts.testDetail}` : ""} — RETRY` : "SEND TEST PING"}
          </button>
        )}
        {pushAlerts.enabled && (
          <button
            onClick={pushAlerts.disable}
            disabled={pushAlerts.busy}
            style={{ padding: "3px 10px", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", background: "transparent", color: theme.muted, border: `1px solid ${theme.border}`, borderRadius: 3 }}
          >{pushAlerts.busy ? "…" : "DISABLE"}</button>
        )}
      </div>
      {pushAlerts.needsInstall && (
        <div style={{ fontSize: 9, color: theme.muted, marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>
          iPhone: Add to Home Screen first, then enable from the installed app
        </div>
      )}
      {pushAlerts.error && (
        <div style={{ fontSize: 9, color: theme.red, marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>{pushAlerts.error}</div>
      )}
    </div>
  );

  // Season-end FINAL HAUL — the player-facing result + payout receipt share.
  // Fixed dark palette (not theme tokens) so the captured PNG always looks
  // right regardless of the player's UI theme.
  const finalHaulCard = gameEnded && !isAdmin && !isReport && !isTest && user && playerScore > 0 && (
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border}`, background: theme.tintBg }}>
      <div
        ref={finalHaulRef}
        style={{
          padding: "16px 18px",
          border: "1px solid rgba(212,168,84,0.5)",
          borderRadius: 8,
          background: "linear-gradient(180deg, #1c1024, #140b1c)",
          textAlign: "center",
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#b8a890" }}>HAIL MARY PROSPECTING CO.</div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: "#d4a854", marginTop: 6 }}>
          🏁 SEASON ENDED — FINAL HAUL
        </div>
        <div style={{ fontSize: 38, fontWeight: 700, color: "#d4a854", lineHeight: 1.1, marginTop: 10, textShadow: "0 0 16px rgba(212,168,84,0.3)" }}>
          {playerScore.toLocaleString()}
        </div>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#e8dcc8", marginTop: 4 }}>
          BTR · ≈ ${oilValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
        </div>
        <div style={{ fontSize: 9, letterSpacing: "0.08em", color: "#b8a890", marginTop: 8 }}>
          real USDC, paid to your wallet on Base · rl80.com/hailmary
        </div>
      </div>
      <button
        onClick={() => shareFinalHaul(playerScore, oilValue, userDrill?.referralCode || null)}
        disabled={!!haulShareNote}
        style={{
          width: "100%", marginTop: 8, padding: "9px 12px",
          background: `${theme.gold}22`, border: `1px solid ${theme.gold}`,
          borderRadius: 3, color: theme.gold, fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer",
        }}
      >
        {haulShareNote || "📸 SHARE YOUR HAUL"}
      </button>
    </div>
  );

  // Rig state block — CTA + status copy for the player's rig, one branch per
  // drillStatus. Rendered inside the YOUR RIG card (no section chrome here).
  const drillButton = !isAdmin && !isReport && !isTest && (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginBottom: 8,
    }}>
      {drillStatus === "pre-game" && (
        <div style={drillBtnStyles.wrap}>
          {userHasPlot ? (() => {
            // Pre-season checklist — the three things worth doing before the
            // drill starts: alerts (retention), referrals (depth), rig (investment).
            const askRow = { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: `1px solid ${theme.border}`, borderRadius: 3, background: theme.panelBg };
            const askNum = (done) => ({ fontSize: 11, fontWeight: 700, minWidth: 14, textAlign: "center", color: done ? theme.green : theme.gold });
            const askText = { flex: 1, textAlign: "left", minWidth: 0 };
            const askTitle = { fontSize: 10, letterSpacing: "0.08em", color: theme.text };
            const askSub = { fontSize: 9, letterSpacing: "0.05em", color: theme.muted, marginTop: 1 };
            const askBtn = { padding: "4px 10px", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", background: `${theme.gold}22`, color: theme.gold, border: `1px solid ${theme.gold}`, borderRadius: 3, whiteSpace: "nowrap" };
            return (
              <>
                <button disabled style={{ ...drillBtnStyles.active, cursor: "default" }}>
                  ⛏ RIG STAKED AT ({Math.min(userDrill.col, gridSize - 1) + 1}, {Math.min(userDrill.row, gridSize - 1) + 1})
                </button>
                <SeasonCountdown
                  gameStartDate={gameStartDate}
                  style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: theme.gold }}
                />
                <div style={{ fontSize: 9, color: theme.muted, letterSpacing: "0.06em", textAlign: "center", maxWidth: 240 }}>
                  Once it does, your rig pumps on its own — day and night. Get ready:
                </div>
                <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {(() => {
                    // Alerts ask — push-first (one tap, this device), Telegram
                    // as the secondary channel (it can deliver CCTV video).
                    const alertsOn = telegramLinked || pushAlerts.enabled;
                    const tgUrl = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "OilRogueBot"}?start=${user.id}`;
                    return (
                      <div style={{ ...askRow, flexWrap: "wrap" }}>
                        <span style={askNum(alertsOn)}>{alertsOn ? "✓" : "1"}</span>
                        <span style={askText}>
                          <div style={askTitle}>{alertsOn ? "STRIKE ALERTS ON" : "GET STRIKE ALERTS"}</div>
                          <div style={askSub}>
                            {pushAlerts.needsInstall && !alertsOn
                              ? "iPhone: Share → Add to Home Screen, then enable here"
                              : alertsOn
                                ? (pushAlerts.enabled ? "push enabled on this device" : "telegram linked")
                                : "know the moment your rig hits"}
                          </div>
                          {pushAlerts.error && <div style={{ ...askSub, color: theme.red }}>{pushAlerts.error}</div>}
                        </span>
                        {!pushAlerts.enabled && pushAlerts.supported ? (
                          <button style={askBtn} onClick={pushAlerts.enable} disabled={pushAlerts.busy}>
                            {pushAlerts.busy ? "…" : "ENABLE ALERTS"}
                          </button>
                        ) : !telegramLinked ? (
                          <button style={askBtn} onClick={() => window.open(tgUrl, "_blank")}>LINK TELEGRAM</button>
                        ) : null}
                        {/* Secondary channel link */}
                        {!telegramLinked && pushAlerts.supported && !pushAlerts.enabled && (
                          <button
                            onClick={() => window.open(tgUrl, "_blank")}
                            style={{ width: "100%", padding: 0, marginTop: 2, background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: theme.muted, textDecoration: "underline", textAlign: "right" }}
                          >or link Telegram →</button>
                        )}
                        {/* Pipeline self-test + opt-out once push is on */}
                        {pushAlerts.enabled && (
                          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                            <button
                              onClick={pushAlerts.disable}
                              disabled={pushAlerts.busy}
                              style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: theme.muted, textDecoration: "underline" }}
                            >{pushAlerts.busy ? "…" : "turn off this device"}</button>
                            <button
                              onClick={pushAlerts.sendTest}
                              disabled={pushAlerts.testState === "sending"}
                              style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: pushAlerts.testState === "sent" ? theme.green : pushAlerts.testState === "failed" ? theme.red : theme.muted, textDecoration: "underline", textAlign: "right" }}
                            >
                              {pushAlerts.testState === "sending" ? "sending…" : pushAlerts.testState === "sent" ? "test sent ✓" : pushAlerts.testState === "failed" ? "test failed — retry?" : "send a test ping →"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {userDrill?.referralCode && (
                    <div style={askRow}>
                      <span style={askNum((userDrill.confirmedReferrals || 0) > 0)}>{(userDrill.confirmedReferrals || 0) > 0 ? "✓" : "2"}</span>
                      <span style={askText}>
                        <div style={askTitle}>RECRUIT YOUR CREW</div>
                        <div style={askSub}>+{REFERRAL_BONUS} layers deeper per referral, all season</div>
                      </span>
                      <button
                        style={askBtn}
                        onClick={() => navigator.clipboard.writeText(`https://rl80.com/hailmary?ref=${userDrill.referralCode}`)}
                      >COPY LINK</button>
                    </div>
                  )}
                  <div style={askRow}>
                    <span style={askNum(false)}>3</span>
                    <span style={askText}>
                      <div style={askTitle}>PIMP YOUR RIG</div>
                      <div style={askSub}>make the claim yours — themes, fences, add-ons</div>
                    </span>
                    <button
                      style={askBtn}
                      onClick={() => handleSelectClaim({ x: userDrill.col, y: userDrill.row })}
                    >GO TO RIG</button>
                  </div>
                </div>
                <OilAnchorEvent compact theme={theme} seedCommitment={seedCommitment} anchorBlock={anchorBlock} anchorBlockHash={anchorBlockHash} />
                {/* Claim-certificate thumb — tap for the Polaroid-style
                    lightbox with the share buttons. Claim date comes from the
                    plot's ownerHistory (the drill doc has no claim stamp). */}
                <OilClaimCertificate
                  variant="thumb"
                  user={user}
                  walletAddress={walletAddress}
                  plotCol={userDrill.col}
                  plotRow={userDrill.row}
                  pickedAt={(allPlotsMap[`${userDrill.col}_${userDrill.row}`]?.ownerHistory || []).filter((h) => h.userId === user?.id).slice(-1)[0]?.claimedAt || null}
                  referralCode={userDrill?.referralCode || null}
                  theme={theme}
                  isMobile={isMobile}
                />
                <button
                  onClick={() => setLobbyView(true)}
                  style={{ marginTop: 2, padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: theme.muted, textDecoration: "underline" }}
                >VIEW REGISTRATION LOBBY</button>
              </>
            );
          })() : (() => {
            // ON-FIELD PLOT PICK (registration) — the only claiming path. A
            // qualified, plot-less player arrives via the lobby's "PICK YOUR
            // PLOT ON THE FIELD" CTA, clicks an open cell on the 3D field or
            // surface map, and stakes it. Same oil-claim route as everywhere
            // (carries the ?ref= code; server enforces qualification + the
            // registration/pre-anchor window).
            const selPlot = selectedX !== null ? allPlotsMap[`${selectedX}_${sliceY}`] : null;
            const selUnclaimed = selectedX !== null && selPlot?.currentOwnerId == null;
            return (
              <>
                {selUnclaimed ? (
                  <button onClick={handleClaimActivePlot} style={drillBtnStyles.active}>
                    ⛏ STAKE YOUR CLAIM ({selectedX + 1}, {sliceY + 1})
                  </button>
                ) : (
                  <button disabled style={drillBtnStyles.disabled}>SELECT AN OPEN PLOT</button>
                )}
                <div style={drillBtnStyles.hint}>
                  Click any open plot on the field or the survey map — that ground is yours for the season.
                </div>
                <SeasonCountdown
                  gameStartDate={gameStartDate}
                  style={{ fontSize: 10, letterSpacing: "0.1em", color: theme.muted }}
                />
                <OilAnchorEvent compact theme={theme} seedCommitment={seedCommitment} anchorBlock={anchorBlock} anchorBlockHash={anchorBlockHash} />
                {!previewMode && (
                  <button
                    onClick={() => setLobbyView(true)}
                    style={{ marginTop: 4, padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: theme.muted, textDecoration: "underline" }}
                  >← BACK TO REGISTRATION</button>
                )}
              </>
            );
          })()}
        </div>
      )}
      {drillStatus === "sign-in" && (
        <div style={drillBtnStyles.wrap}>
          <button onClick={() => clerk.openSignIn()} style={drillBtnStyles.active}>SIGN IN TO PLAY</button>
        </div>
      )}
      {drillStatus === "stunned" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={{ ...drillBtnStyles.disabled, border: "1px solid #ff2200", color: "#ff2200" }}>
            INCAPACITATED {stunRemaining > 0 ? `${Math.floor(stunRemaining / 60)}:${String(stunRemaining % 60).padStart(2, "0")}` : ""}
          </button>
          <div style={{ ...drillBtnStyles.depth, color: "#ff2200" }}>
            YOU UNLEASHED HELL
          </div>
        </div>
      )}
      {drillStatus === "blockade" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={{ ...drillBtnStyles.disabled, border: "1px solid #ff2200", color: "#ff2200" }}>
            BETROLEUM BLOCKADE
          </button>
          <div style={{ ...drillBtnStyles.depth, color: "#ff2200" }}>
            DEMON LOOSE — CLICK IT TO CLAIM BOUNTY
          </div>
        </div>
      )}
      {drillStatus === "no-claim" && (() => {
        // Server truth (oil-claim): real players may claim ONLY during
        // registration (pre-anchor); testers only while testingEnabled. The
        // claim CTA therefore renders only when a claim can actually succeed —
        // otherwise the waitlist is the primary affordance, so the panel never
        // shows a dead CLAIM button above a "claims are closed" notice.
        const activeClaimsOpen = gamePhase === "active" && testingEnabled;
        return (
        <div style={drillBtnStyles.wrap}>
          {userDrill?.col != null ? (
            <button
              onClick={() => handleSelectClaim({ x: userDrill.col, y: userDrill.row })}
              style={drillBtnStyles.active}
            >
              GO TO YOUR CLAIM ({Math.min(userDrill.col, gridSize - 1) + 1}, {Math.min(userDrill.row, gridSize - 1) + 1})
            </button>
          ) : activeClaimsOpen ? (
            (selectedX !== null && allPlotsMap[`${selectedX}_${sliceY}`]?.currentOwnerId == null) ? (
              <button onClick={handleClaimActivePlot} style={drillBtnStyles.active}>
                CLAIM THIS PLOT ({selectedX + 1}, {sliceY + 1})
              </button>
            ) : (
              <button disabled style={drillBtnStyles.disabled}>SELECT AN OPEN PLOT</button>
            )
          ) : (
            /* Claims closed (mid-season / ended) — next-season waitlist is the
               primary CTA for qualified-but-unplaced players. */
            <div style={{ width: "100%", maxWidth: 260 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.08em", color: theme.muted, marginBottom: 6, textAlign: "center" }}>
                CLAIMS ARE CLOSED FOR THIS SEASON
              </div>
              {waitlistInfo?.waitlisted ? (
                <div style={{ fontSize: 10, color: theme.green, lineHeight: 1.5 }}>
                  ✓ You&apos;re #{waitlistInfo.position} of {waitlistInfo.total} on the waitlist — you&apos;ll get first dibs next season.
                </div>
              ) : (
                <>
                  <button
                    onClick={handleJoinWaitlist}
                    style={{
                      width: "100%", padding: "7px 10px", fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
                      fontFamily: "'Share Tech Mono', monospace", fontWeight: 700,
                      background: `${theme.gold}22`, color: theme.gold,
                      border: `1px solid ${theme.gold}`, borderRadius: 3,
                    }}
                  >JOIN NEXT-SEASON WAITLIST</button>
                  {waitlistInfo?.error && <div style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>{waitlistInfo.error}</div>}
                </>
              )}
            </div>
          )}
          {/* Tester access code — non-crypto testers redeem a code to qualify
              without the wallet/$20 gate. Collapsed behind a link so it never
              reads as a step real players are missing. */}
          {userDrill?.col == null && (
            <div style={{ marginTop: 10, width: "100%", maxWidth: 260 }}>
              {!showTesterCode ? (
                <button
                  onClick={() => setShowTesterCode(true)}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.08em",
                    color: theme.muted, textDecoration: "underline",
                  }}
                >HAVE A TESTER CODE?</button>
              ) : (
                <>
                  <div style={{ fontSize: 10, letterSpacing: "0.08em", color: theme.muted, marginBottom: 4 }}>TESTER CODE</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={testerCode}
                      onChange={(e) => setTesterCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRedeemCode(); }}
                      placeholder="access code"
                      style={{
                        flex: 1, minWidth: 0, padding: "6px 8px", fontSize: 12,
                        fontFamily: "'Share Tech Mono', monospace",
                        background: theme.panelBg, color: theme.text,
                        border: `1px solid ${theme.border}`, borderRadius: 3,
                      }}
                    />
                    <button onClick={handleRedeemCode} disabled={!testerCode.trim()} style={{
                      padding: "6px 12px", fontSize: 11, letterSpacing: "0.08em", cursor: testerCode.trim() ? "pointer" : "default",
                      fontFamily: "'Share Tech Mono', monospace",
                      background: testerCode.trim() ? `${theme.gold}22` : "transparent",
                      color: testerCode.trim() ? theme.gold : theme.muted,
                      border: `1px solid ${testerCode.trim() ? theme.gold : theme.border}`, borderRadius: 3,
                    }}>REDEEM</button>
                  </div>
                  {testerMsg && <div style={{ fontSize: 10, color: testerMsg.startsWith("✓") ? theme.green : theme.muted, marginTop: 4 }}>{testerMsg}</div>}
                </>
              )}
            </div>
          )}
        </div>
        );
      })()}
      {drillStatus === "wrong-claim" && (
        <div style={drillBtnStyles.wrap}>
          <button
            onClick={() => handleSelectClaim({ x: userDrill.col, y: userDrill.row })}
            style={drillBtnStyles.active}
          >
            GO TO YOUR CLAIM ({Math.min(userDrill?.col ?? 0, gridSize - 1) + 1}, {Math.min(userDrill?.row ?? 0, gridSize - 1) + 1})
          </button>
        </div>
      )}
      {drillStatus === "max-depth" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={drillBtnStyles.disabled}>MAX DEPTH REACHED</button>
          <div style={drillBtnStyles.depth}>DEPTH {MAX_DEPTH}/{MAX_DEPTH}</div>
        </div>
      )}
      {drillStatus === "depth-ceiling" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={drillBtnStyles.disabled}>CAUGHT UP</button>
          <div style={drillBtnStyles.depth}>DEPTH {cellDepth}/{playerDepth} (ceiling)</div>
          {/* Depth progress bar */}
          <div style={{ width: "100%", maxWidth: 220, height: 10, background: theme.barBg, borderRadius: 4, overflow: "hidden", border: `1px solid ${theme.border}`, position: "relative" }}>
            <div style={{
              width: `${(passiveDepth / MAX_DEPTH) * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${theme.green}, #7ab44a)`,
              position: "absolute", left: 0, top: 0,
            }} />
            {bonusDrills > 0 && (
              <div style={{
                width: `${(bonusDrills / MAX_DEPTH) * 100}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${theme.gold}, ${theme.goldBorder})`,
                position: "absolute", left: `${(passiveDepth / MAX_DEPTH) * 100}%`, top: 0,
              }} />
            )}
          </div>
          <div style={drillBtnStyles.hint}>
            {passiveDepth} passive{bonusDrills > 0 ? ` + ${bonusDrills} bonus` : ""} — next layer unlocks tomorrow
          </div>
        </div>
      )}
      {drillStatus === "auto-pumping" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={{ ...drillBtnStyles.active, cursor: "default" }}>
            ⛏ RIG PUMPING
          </button>
          {/* Depth progress bar removed — the horizontal drill core (Core Sample)
              now serves as the live depth/progress meter. */}
          {userDrill?.lastStrikeDepth != null ? (
            <div style={drillBtnStyles.hint}>
              Last strike: depth {userDrill.lastStrikeDepth}{userDrill.lastStrikeOil > 0 ? ` — struck ${userDrill.lastStrikeOil.toLocaleString()}${fmtOilUsd(userDrill.lastStrikeOil) ? ` (${fmtOilUsd(userDrill.lastStrikeOil)})` : ""}` : " — dry layer"}
            </div>
          ) : (
            <div style={drillBtnStyles.hint}>Your rig drills on its own — no clicking needed.</div>
          )}
          <div style={{ fontSize: 9, color: theme.muted, letterSpacing: "0.06em", fontStyle: "italic", textAlign: "center", maxWidth: 220 }}>
            It can strike at any moment — there&apos;s no telling when. Keep an eye on it.
          </div>
          {/* Alert nudge for players who skipped the pre-season ask — the
              strike ping is the retention engine, so keep offering it. */}
          {!telegramLinked && !pushAlerts.enabled && (pushAlerts.supported || pushAlerts.needsInstall) && (
            <>
              <button
                onClick={pushAlerts.supported ? pushAlerts.enable : () => window.open(`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "OilRogueBot"}?start=${user?.id}`, "_blank")}
                disabled={pushAlerts.busy}
                style={{
                  marginTop: 6, padding: "6px 14px", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer",
                  fontFamily: "'Share Tech Mono', monospace",
                  background: `${theme.gold}22`, color: theme.gold,
                  border: `1px solid ${theme.gold}`, borderRadius: 3,
                }}
              >
                🔔 {pushAlerts.busy ? "…" : "GET STRIKE ALERTS"}
              </button>
              {pushAlerts.needsInstall && (
                <div style={{ fontSize: 9, color: theme.muted, letterSpacing: "0.06em", textAlign: "center", maxWidth: 220 }}>
                  iPhone: Share → Add to Home Screen, then enable — or tap to link Telegram
                </div>
              )}
              {pushAlerts.error && (
                <div style={{ fontSize: 9, color: theme.red, letterSpacing: "0.06em", textAlign: "center", maxWidth: 220 }}>{pushAlerts.error}</div>
              )}
            </>
          )}
        </div>
      )}
      {drillStatus === "ready" && (
        <div style={drillBtnStyles.wrap}>
          <button onClick={handleDailyDrill} style={drillBtnStyles.active}>
            DRILL
          </button>
          <div style={drillBtnStyles.depth}>DEPTH {cellDepth}/{playerDepth}</div>
          {/* Depth progress bar */}
          <div style={{ width: "100%", maxWidth: 220, height: 10, background: theme.barBg, borderRadius: 4, overflow: "hidden", border: `1px solid ${theme.border}`, position: "relative" }}>
            <div style={{
              width: `${(passiveDepth / MAX_DEPTH) * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${theme.green}, #7ab44a)`,
              position: "absolute", left: 0, top: 0,
            }} />
            {bonusDrills > 0 && (
              <div style={{
                width: `${(bonusDrills / MAX_DEPTH) * 100}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${theme.gold}, ${theme.goldBorder})`,
                position: "absolute", left: `${(passiveDepth / MAX_DEPTH) * 100}%`, top: 0,
              }} />
            )}
          </div>
          <div style={drillBtnStyles.hint}>
            {passiveDepth} passive{bonusDrills > 0 ? ` + ${bonusDrills} bonus` : ""} — {playerDepth - cellDepth} drill{playerDepth - cellDepth !== 1 ? "s" : ""} available
          </div>
          <div style={{ fontSize: 9, color: theme.muted, letterSpacing: "0.06em", fontStyle: "italic", textAlign: "center", maxWidth: 220 }}>
            Geological surveys suggest denser deposits at greater depth
          </div>
        </div>
      )}
    </div>
  );

  // ── Test Mode Stepper ──
  const testStepper = isTest && (
    <div style={{
      padding: "10px 14px",
      borderBottom: `1px solid ${theme.border}`,
      background: "rgba(90,138,58,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{
          fontSize: 11, letterSpacing: "0.15em", color: theme.green,
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          TEST MODE
        </span>
        <span style={{
          fontSize: 11, color: theme.accent,
          fontFamily: "'Share Tech Mono', monospace", fontWeight: 700,
        }}>
          LAYER {testDay}/{DEPTH_Z}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => setTestDay(d => Math.max(0, d - 1))}
          disabled={testDay === 0}
          style={{
            ...drillBtnStyles.active,
            padding: "4px 10px",
            fontSize: 12,
            opacity: testDay === 0 ? 0.4 : 1,
          }}
        >
          −
        </button>
        <input
          type="range"
          min={0}
          max={DEPTH_Z}
          value={testDay}
          onChange={(e) => setTestDay(Number(e.target.value))}
          style={{ flex: 1, accentColor: theme.green, cursor: "pointer" }}
        />
        <button
          onClick={() => setTestDay(d => Math.min(DEPTH_Z, d + 1))}
          disabled={testDay === DEPTH_Z}
          style={{
            ...drillBtnStyles.active,
            padding: "4px 10px",
            fontSize: 12,
            opacity: testDay === DEPTH_Z ? 0.4 : 1,
          }}
        >
          +
        </button>
      </div>
      {selectedX === null && (
        <div style={{ fontSize: 11, color: theme.accent, marginTop: 6, fontFamily: "'Share Tech Mono', monospace" }}>
          Click a plot on the map to start testing
        </div>
      )}
    </div>
  );

  // ── Admin/test/report gusher shut-off — an in-app escape hatch to clear a stuck
  //    gusher on the selected cell when the normal player tank panel is hidden. ──
  const gusherShutoffPanel = (isAdmin || isReport || isTest) && selectedCellGushers.length > 0 && (
    <div style={isMobile ? m.section : styles.panelSection}>
      <button
        onClick={handleShutOffGusher}
        style={{
          width: "100%", padding: "8px 12px",
          border: `1px solid ${theme.red}`, borderRadius: 3, cursor: "pointer",
          background: `${theme.red}22`, color: theme.red,
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11, letterSpacing: "0.12em", fontWeight: 700,
          animation: "tankPulse 1.2s ease-in-out infinite",
        }}
      >
        SHUT OFF GUSHER ({selectedX + 1}, {sliceY + 1})
      </button>
    </div>
  );

  const drillingActive = drillStatus === "auto-pumping"
    || ((isAdmin || isReport || isTest) && effectiveDrillDay > 0 && effectiveDrillDay < DEPTH_Z);
  // Gauges earn their space only while something is happening under the bit:
  // pumping, a reveal in flight, or a hell/blockade event. A signed-out or
  // claimless visitor never sees a row of 0.0s.
  const showGauges = drillingActive || drillEvent > 0 || hellActive || !!demonBlockade?.active;

  // ── Payout so far. BANKED is the real number — safe, counted — and the tank
  //    is at risk until it is banked, so the two are shown together with the
  //    BANK button. Pre-season shows the countdown (in drillButton) instead. ──
  const showPayout = gamePhase !== "ticket_sale";
  const bankedOil = activeUserDrill?.totalCollected || 0;
  const tankShownOil = tankDrained ? 0 : oilInTank;
  const tankHeavy = tankFill >= 1.0 && !tankDrained;
  const fmtUsd = (oil) => {
    const v = (oil || 0) * (oilUsdRate || 0);
    return `$${v === 0 || v >= 0.01 ? v.toFixed(2) : v.toFixed(4)}`;
  };
  const payoutHeadline = showPayout && (
    <div style={{
      marginBottom: 10, padding: "10px 12px",
      border: `1px solid ${tankHeavy ? theme.red : theme.border}`, borderRadius: 4,
      background: theme.panelBg,
      animation: tankHeavy ? "tankPulse 1.2s ease-in-out infinite" : "none",
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.18em", color: theme.muted }}>BANKED · PAYOUT SO FAR</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "'Orbitron', monospace", fontSize: 26, fontWeight: 700, lineHeight: 1.1,
          color: theme.gold, fontVariantNumeric: "tabular-nums",
          textShadow: uiDark ? "0 0 14px rgba(212,168,84,0.25)" : "none",
        }}>
          {fmtUsd(bankedOil)}
        </span>
        <span style={{ fontSize: 10, letterSpacing: "0.08em", color: theme.muted }}>
          {bankedOil.toLocaleString()} BTR · locked in
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.14em", color: tankHeavy ? theme.red : theme.accent }}>IN TANK · AT RISK</span>
        <span style={{ fontSize: 11, letterSpacing: "0.06em", color: tankHeavy ? theme.red : theme.textStrong }}>
          {fmtUsd(tankShownOil)}
          {/* real space (not just margin) so the line reads as two values to screen readers */}
          <span style={{ fontSize: 9, color: theme.muted, marginLeft: 6 }}> {tankShownOil.toLocaleString()} BTR</span>
        </span>
      </div>
      <div style={{
        width: "100%", height: 8, background: theme.barBg, borderRadius: 2, overflow: "hidden",
        border: `1px solid ${tankHeavy ? theme.red : theme.border}`,
      }}>
        <div style={{
          width: tankDrained ? "0%" : `${Math.min((oilInTank / TANK_CAPACITY) * 100, 100)}%`,
          height: "100%",
          background: tankHeavy
            ? `linear-gradient(90deg, ${theme.gold}, ${theme.red})`
            : `linear-gradient(90deg, ${theme.green}, #7ab44a)`,
          borderRadius: 2,
          transition: "width 0.4s ease",
        }} />
      </div>
      {((oilInTank > 0 && !tankDrained) || myGusherActive) && (
        <button
          onClick={handleTankDrain}
          style={{
            width: "100%", marginTop: 6, padding: "7px 12px",
            border: `1px solid ${tankHeavy ? theme.red : theme.gold}`,
            borderRadius: 3, cursor: "pointer",
            background: tankHeavy ? `${theme.red}22` : `${theme.gold}22`,
            color: tankHeavy ? theme.red : theme.gold,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 10, letterSpacing: "0.12em", fontWeight: 700,
            animation: tankHeavy ? "tankPulse 1.2s ease-in-out infinite" : "none",
          }}
        >
          {oilInTank <= 0 && myGusherActive
            ? "SHUT OFF GUSHER"
            : tankHeavy ? "TANK HEAVY — BANK NOW" : "BANK BETROLEUM"}
        </button>
      )}
      {tankDrained && (
        <div style={{ fontSize: 10, letterSpacing: "0.15em", color: theme.green, marginTop: 4, textAlign: "right" }}>
          SENT TO MAIN TANK
        </div>
      )}
    </div>
  );

  // ── Rig details (active players): payout, extraction, referrals, depth
  //    profile. Body of the YOUR RIG card — the card title carries the
  //    coordinates, so there is no heading here. ──
  const rigDetails = !isAdmin && !isReport && activeUserDrill?.col != null && (
    <div>
      {payoutHeadline}
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 20))}
            placeholder="Set username..."
            maxLength={20}
            style={{
              flex: 1,
              padding: "4px 8px",
              background: theme.inputBg,
              border: `1px solid ${theme.border}`,
              borderRadius: 2,
              color: theme.textStrong,
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.05em",
              outline: "none",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); }}
          />
          <button
            onClick={handleSaveUsername}
            disabled={usernameSaving || !username.trim()}
            style={{
              padding: "4px 10px",
              background: username.trim() ? "rgba(212,168,84,0.2)" : "transparent",
              border: `1px solid ${theme.border}`,
              borderRadius: 2,
              color: username.trim() ? theme.accent : theme.muted,
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: username.trim() ? "pointer" : "default",
              opacity: usernameSaving ? 0.5 : 1,
            }}
          >
            {usernameSaving ? "..." : usernameSaved ? "SAVED ✓" : "SAVE"}
          </button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", color: theme.green }}>
          EXTRACTED: {playerExtracted.toLocaleString()} BTR
        </span>
        {/* The DEPTH dial carries this while the gauges are up */}
        {!showGauges && (
          <span style={{ fontSize: 11, letterSpacing: "0.1em", color: theme.accent }}>
            DEPTH {effectiveDrillDay}/{DEPTH_Z}
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.1em", color: theme.muted }}>
          {passiveDepth} PASSIVE + {bonusDrills} BONUS
        </span>
        <span style={{ fontSize: 10, letterSpacing: "0.1em", color: theme.muted }}>
          JUMPS {userDrill?.claimJumpsUsed ?? 0} ({Math.max(0, FREE_CLAIM_JUMPS + (userDrill?.bonusClaimJumps ?? 0) - (userDrill?.claimJumpsUsed ?? 0))} free)
        </span>
      </div>
      {/* Referral stats */}
      {userDrill?.referralCode && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", color: theme.gold }}>
            REFERRALS: {userDrill.confirmedReferrals || 0} confirmed
          </span>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", color: theme.gold }}>
            +{bonusDrills} bonus drills
          </span>
        </div>
      )}
      {/* Bonus-source breakdown. shares/holding are tracked precisely; the
          remainder (referrals + demon hunts) shares one counter, so it's lumped. */}
      {userDrill?.referralCode && bonusDrills > 0 && (
        <div style={{ fontSize: 9, color: theme.muted, marginBottom: 6, letterSpacing: "0.05em" }}>
          {(() => {
            const shares = userDrill.bonusFromShares || 0;
            const holding = userDrill.bonusFromHolding || 0;
            const tickets = userDrill.bonusFromTickets || 0;
            const refs = Math.max(0, bonusDrills - shares - holding - tickets);
            const parts = [];
            if (refs > 0) parts.push(`+${refs} referrals/hunts`);
            if (shares > 0) parts.push(`+${shares} shares`);
            if (holding > 0) parts.push(`+${holding} holding`);
            if (tickets > 0) parts.push(`+${tickets} tickets`);
            return parts.join("  ·  ");
          })()}
        </div>
      )}
      {/* SUPPLIES — DAILY TICKET prizes that are held, not spent yet: tonics
          (the next strike drills two layers) and the stall coupon. */}
      {((userDrill?.supplies?.tonic ?? 0) > 0 || couponValid(userDrill?.coupon)) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6, fontSize: 10, letterSpacing: "0.1em", flexWrap: "wrap" }}>
          <span style={{ color: theme.muted }}>SUPPLIES</span>
          <span style={{ color: theme.green, textAlign: "right" }}>
            {(userDrill?.supplies?.tonic ?? 0) > 0 && <span title="Your next strike drills two layers">🧪 TONIC ×{userDrill.supplies.tonic}</span>}
            {(userDrill?.supplies?.tonic ?? 0) > 0 && couponValid(userDrill?.coupon) && "  ·  "}
            {couponValid(userDrill?.coupon) && <span title="Applied automatically at the Pimp My Pump checkout">🎟 COUPON {userDrill.coupon.pct}% OFF · {couponDaysLeft(userDrill.coupon)}d left</span>}
          </span>
        </div>
      )}
      {/* Copyable referral link */}
      {userDrill?.referralCode && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
          padding: "4px 8px", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 2,
        }}>
          <span style={{ fontSize: 10, color: theme.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            rl80.com/hailmary?ref={userDrill.referralCode}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`https://rl80.com/hailmary?ref=${userDrill.referralCode}`);
            }}
            style={{
              padding: "2px 8px", border: `1px solid ${theme.border}`, borderRadius: 2,
              background: "transparent", color: theme.accent, fontFamily: "'Share Tech Mono', monospace",
              fontSize: 9, letterSpacing: "0.1em", cursor: "pointer",
            }}
          >
            COPY
          </button>
        </div>
      )}
      {/* Claim Jump toggle */}
      {gamePhase === "active" && !isTest && userDrill && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setClaimJumpMode((m) => !m)}
            style={{
              width: "100%",
              padding: "6px 12px",
              border: `1px solid ${claimJumpMode ? theme.gold : theme.border}`,
              borderRadius: 3,
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: "pointer",
              background: claimJumpMode ? `${theme.gold}22` : "transparent",
              color: claimJumpMode ? theme.gold : theme.muted,
            }}
          >
            {claimJumpMode ? "CANCEL CLAIM JUMP" : "CLAIM JUMP"}
          </button>
          {claimJumpMode && (
            <div style={{ fontSize: 10, color: theme.gold, marginTop: 4, textAlign: "center" }}>
              Click an open plot on the map to jump
              {(userDrill?.claimJumpsUsed ?? 0) >= FREE_CLAIM_JUMPS + (userDrill?.bonusClaimJumps ?? 0) && " (costs 1 bonus drill)"}
            </div>
          )}
        </div>
      )}
      {/* Time scrub slider (player review) */}
      {!isTest && userDrill?.drillDay > 1 && (
        <div style={{ marginBottom: 8, padding: "6px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{
              fontSize: 10, letterSpacing: "0.15em", fontFamily: "'Share Tech Mono', monospace",
              color: reviewDay !== null ? theme.gold : theme.muted,
            }}>
              {reviewDay !== null ? `REVIEWING DAY ${reviewDay}` : "LIVE"}
            </span>
            {reviewDay !== null && (
              <button
                onClick={() => setReviewDay(null)}
                style={{
                  background: theme.accent, color: "#000", border: "none", borderRadius: 2,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", padding: "2px 8px",
                  cursor: "pointer", fontFamily: "'Share Tech Mono', monospace",
                }}
              >
                LIVE
              </button>
            )}
          </div>
          <input
            type="range"
            min={0}
            max={userDrill.drillDay}
            value={reviewDay ?? userDrill.drillDay}
            onChange={(e) => {
              const v = Number(e.target.value);
              setReviewDay(v === userDrill.drillDay ? null : v);
            }}
            style={{
              width: "100%", height: 4, cursor: "pointer",
              accentColor: reviewDay !== null ? theme.gold : theme.accent,
            }}
          />
        </div>
      )}
      {/* Per-layer oil — collapsed by default; the Core Sample bar is the
          at-a-glance version of the same data. */}
      <div
        onClick={() => setDepthProfileOpen((o) => !o)}
        style={{ fontSize: 11, letterSpacing: "0.15em", color: theme.accent, marginBottom: 6, display: "flex", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <span>DEPTH PROFILE</span>
        <span style={{ fontSize: 10, color: theme.muted }}>{depthProfileOpen ? "\u25B4" : "\u25BE"}</span>
      </div>
      {depthProfileOpen && (
      <div style={styles.depthChart}>
        {Array.from({ length: DEPTH_Z }, (_, d) => {
          const drilled = d < effectiveDrillDay;
          const oil = drilled ? (displayGrid3D[activeUserDrill.col]?.[activeUserDrill.row]?.[d] ?? 0) : 0;
          const barWidth = drilled && communityMaxOil > 0 ? (oil / communityMaxOil) * 100 : 0;
          return (
            <div key={d} style={styles.depthRow}>
              <span style={{
                ...styles.depthRowLabel,
                color: drilled ? theme.accent : theme.depthUndrilled,
              }}>
                D{d + 1}
              </span>
              <div style={styles.depthBarWrap}>
                {drilled ? (
                  <div style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${theme.gold}, ${theme.goldBorder})`,
                    transition: "all 0.3s",
                  }} />
                ) : (
                  <div style={{
                    width: "100%",
                    height: "100%",
                    background: `repeating-linear-gradient(90deg, ${theme.barBg} 0px, ${theme.barBg} 3px, transparent 3px, transparent 6px)`,
                  }} />
                )}
              </div>
              <span style={{
                ...styles.depthRowVal,
                color: drilled ? theme.accent : theme.depthUndrilled,
              }}>
                {drilled ? (oil > 0 ? oil.toLocaleString() : "0") : "\u2014"}
              </span>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );

  // ── YOUR RIG — the player's one card: state/CTA, live gauges, tank + bank ──
  const rigStatus = (() => {
    // A live breach outranks whatever the drill state machine says (in test
    // mode the stun isn't synthesized, so the pill would keep reading CAUGHT UP).
    if (hellActive) return { label: "BREACH", color: theme.red };
    switch (drillStatus) {
      case "sign-in": return { label: "SIGNED OUT", color: theme.muted };
      case "stunned": return { label: "INCAPACITATED", color: theme.red };
      case "blockade": return { label: "BLOCKADE", color: theme.red };
      case "pre-game": return { label: "PRE-SEASON", color: theme.gold };
      case "no-claim": return { label: "NO CLAIM", color: theme.muted };
      case "max-depth": return { label: "MAX DEPTH", color: theme.muted };
      case "depth-ceiling": return { label: "CAUGHT UP", color: theme.gold };
      case "ready": return { label: "READY", color: theme.gold };
      case "auto-pumping": return { label: "PUMPING", color: theme.green };
      // Looking at another plot: report the rig's own state, not the selection's.
      case "wrong-claim": return (isAdmin || isReport || isTest)
        ? { label: "SELECT A PLOT", color: theme.muted }
        : userDrill?.rigDepleted ? { label: "MAX DEPTH", color: theme.muted } : { label: "PUMPING", color: theme.green };
      default: return { label: String(drillStatus).toUpperCase(), color: theme.muted };
    }
  })();
  const gaugesPanel = showGauges && (
    <DrillGeode
      embedded
      drillEvent={drillEvent}
      depthLevel={effectiveDrillDay}
      maxDepth={DEPTH_Z}
      oilStrike={oilStrike}
      oilValue={drilledOilValue}
      maxOil={displayMaxOil}
      drillProximity={drillProximity}
      hellProximity={hellProximity}
      darkMode={uiDark}
      parabolum={parabolum}
      hellActive={hellActive}
      demonBlockade={demonBlockade}
      drillingActive={drillingActive}
    />
  );
  const yourRigCard = (drillButton || gaugesPanel || rigDetails) && (
    <PanelSection theme={theme} isMobile={isMobile} tint id="your-rig">
      <PanelTitle
        theme={theme} isMobile={isMobile} icon={PANEL_ICONS.rig}
        right={(
          <span style={{
            fontSize: 9, letterSpacing: "0.14em", padding: "2px 7px", borderRadius: 2,
            border: `1px solid ${rigStatus.color}`, color: rigStatus.color,
            fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.5, whiteSpace: "nowrap", textTransform: "uppercase",
          }}>
            {rigStatus.label}
          </span>
        )}
      >
        YOUR RIG
        {activeUserDrill?.col != null && (
          <span style={{ color: theme.muted, letterSpacing: "0.08em", fontWeight: 400 }}>
            ({activeUserDrill.col + 1}, {activeUserDrill.row + 1})
          </span>
        )}
      </PanelTitle>
      {drillButton}
      {gaugesPanel}
      {rigDetails}
    </PanelSection>
  );

  // ── Rig editor on the phone: opening it switches to the 3D tab, selects your
  //    claim if nothing is selected (the camera flies there), and scrolls the
  //    editor up under the pinned scene strip. ──
  const editorOpen = isMobile && pimpOpenMobile && mobileTab === "3d";
  const editorSceneH = editorSceneHeight(typeof window !== "undefined" ? window.innerHeight : 812);
  const handlePimpExpanded = (open) => {
    setPimpOpenMobile(open);
    if (!open || !isMobile) return;
    setMobileTab("3d");
    if (selectedX === null && userDrill?.col != null) handleSelectClaim({ x: userDrill.col, y: userDrill.row });
    // The canvas remounts when the tab switches; re-issue the fly so the viewer
    // lands on the rig regardless of which tab the editor was opened from.
    else if (selectedX !== null) setTimeout(() => handleFlyTo(selectedX, sliceY), 150);
    setTimeout(() => document.getElementById("pimp-my-pump")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  // ── Mobile bottom-nav primary button — the one action that matters in the
  //    player's current state, instead of a fixed BUY. PLAY → sign in; CLAIM →
  //    the survey map to pick a plot (or the waitlist once claims close);
  //    BANK while Betroleum sits un-banked; MY RIG otherwise. ──
  const scrollToRig = () => {
    setTimeout(() => document.getElementById("your-rig")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const mobilePrimary = (() => {
    if (!user) return { label: "PLAY", sub: "SIGN IN", title: "Sign in to play", onClick: () => clerk.openSignIn() };
    if (userDrill?.col == null) {
      const claimsOpen = gamePhase === "ticket_sale" || (gamePhase === "active" && testingEnabled);
      return {
        label: "CLAIM", sub: claimsOpen ? "PICK A PLOT" : "WAITLIST", title: claimsOpen ? "Pick a plot to claim" : "Join the waitlist",
        onClick: () => {
          if (claimsOpen) { setMobileTab("surface"); document.getElementById("oil-scroll")?.scrollTo({ top: 0, behavior: "smooth" }); }
          else scrollToRig();
        },
      };
    }
    if (showPayout && oilInTank > 0 && !tankDrained) {
      return { label: "BANK", sub: fmtUsd(tankShownOil), title: "Bank your Betroleum", onClick: handleTankDrain };
    }
    return {
      label: "MY RIG", sub: showPayout ? fmtUsd(bankedOil) : "PRE-SEASON", title: "Go to your rig",
      onClick: () => { setMobileTab("3d"); handleSelectClaim({ x: userDrill.col, y: userDrill.row }); scrollToRig(); },
    };
  })();

  // ═══════════════════════════════════════════════════════════
  // MOBILE LAYOUT — tabbed views + scrollable panel below
  // ═══════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={m.root}>
        {previewBanner}
        <div style={styles.scanlines} />
        <div style={styles.grain} />
        <style>{`.nav-mobile-home { background: transparent !important; border: none !important; box-shadow: none !important; }`}</style>

        {/* Header */}
        <header style={m.header}>
          <div style={styles.headerLeft}>
            <Link
              href="/"
              title="Return to shrine"
              style={{ ...styles.logoMark, cursor: "pointer", textDecoration: "none" }}
            >
              <img src="/brand-mark-cyan.svg" alt="Home" style={{ width: 24, height: 24, objectFit: "contain", display: "block" }} />
            </Link>
            <div>
              <h1 style={{ ...styles.title, fontSize: 12, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span>HAIL MARY</span>
                <span>PROSPECTING CO.{modeBadge}</span>
              </h1>
              <p style={{ ...styles.subtitle, fontSize: 11 }}>LYQUID80 QUEST</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <button
              onClick={() => setShowLeaderboard(true)}
              title="Leaderboard"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(212, 175, 55, 0.05)",
                border: "1.5px solid rgba(212, 175, 55, 0.2)",
                color: theme.accent, cursor: "pointer", padding: 0,
                flexShrink: 0, fontFamily: "inherit",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </button>
            <button
              onClick={() => setShowWelcome(true)}
              title="How to play"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(212, 175, 55, 0.05)",
                border: "1.5px solid rgba(212, 175, 55, 0.2)",
                color: theme.accent, cursor: "pointer", padding: 0,
                flexShrink: 0, fontSize: 18, fontWeight: "bold", fontFamily: "inherit",
              }}
            >
              ?
            </button>
          </div>
        </header>

        {/* Tab bar */}
        <div style={m.tabBar}>
          {[
            { key: "3d", label: "3D" },
            { key: "surface", label: "SURFACE" },
            { key: "xsec", label: "X-SECTION" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              style={{
                ...m.tab,
                ...(mobileTab === tab.key ? m.tabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable: active view + panels below */}
        <div id="oil-scroll" style={m.scroll}>
          {/* 3D Voxel */}
          {mobileTab === "3d" && (
            <div id="oil-canvas" style={{ ...m.canvasWrap, ...(editorOpen ? { ...m.canvasCompact, height: editorSceneH, minHeight: editorSceneH, maxHeight: editorSceneH } : {}) }}>
              <CleanCanvas
                camera={{ position: [0, 3.5, 4], fov: 50 }}
                dpr={[1, 1.5]}
                style={{ width: "100%", height: "100%" }}
                gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
              >
                <SkyDome skyColor={env.sky} skyBottom={env.skyBottom} cloudOpacity={env.cloudOpacity} hell={envPreset === "hell"} />
                {envPreset === "hell" && <HellSkyEffects />}
                {!parabolum && envPreset === "solstice" && <SolsticeSkyEffects />}
                {parabolum && <ParabolumMoon />}
                {envPreset === "night" && <StarField radius={150} count1={500} count2={300} />}
                {envPreset === "night" && <ConstellationModel groupScale={[15, 15, 15]} groupPosition={[0, 8, -60]} isVisible={true} />}
                {fireworksOn && <Fireworks quality={1} shellSize={1} finale sound={fireworksSound} />}
                {env.fog && <fog attach="fog" args={[env.fog, 20, 200]} />}
                <ambientLight intensity={env.ambient * moodScale} />
                {env.hemi && <hemisphereLight args={[env.hemi.sky, env.hemi.ground, env.hemi.intensity * moodScale]} />}
                <directionalLight position={[10, 15, 10]} intensity={env.dirA * moodScale} color={env.dirAColor || "#ffffff"} />
                <directionalLight position={[-5, 10, -5]} intensity={env.dirB * moodScale} color={env.dirBColor || "#ffffff"} />
                <pointLight position={[-8, 5, -8]} intensity={1.5 * moodScale} color={env.point} />
                <group position={[0, 1, 0]}>
                  <OilVoxelGrid
                    blockHash={blockHash}
                    numberOfDeposits={numberOfDeposits}
                    numberOfHellPockets={numberOfHellPockets}
                    totalOilBudget={totalOilBudget}
                    gridX={gridSize}
                    gridY={gridSize}
                    revealProgress={revealProgress}
                    animateReveal={animateReveal}
                    revealDuration={2}
                    drillDay={effectiveDrillDay}
                    selectedCol={selectedX}
                    selectedRow={selectedX !== null ? sliceY : null}
                    onSelectCell={(col, row) => { setSelectedX(col); setSliceY(row); setDrillDepth(0); }}
                    onEnvelopeClick={(col, row) => setChatModalPlotKey(`${col}_${row}`)}
                    onFlyTo={handleFlyTo}
                    onZoomOut={handleZoomOut}
                    pumpConfig={pumpConfig}
                    allPumpConfigs={allPumpConfigs}
                    oilStrike={combinedStrike}
                    forceStrikeGusher={isAdmin || isReport || isTest}
                    gusherTrigger={gusherTest}
                    drillEvent={drillEvent}
                    drillProximity={drillProximity}
                    tankFill={tankFill}
                    onTankDrain={handleTankDrain}
                    communityOil={communityOil}
                    rogueEvents={rogueEvents}
                    gusherEvents={gusherEvents}
                    onRogueArrive={handleRogueArrive}
                    onRogueConsequence={handleRogueConsequence}
                    envPreset={envPreset}
                    envMapPreset={envMapPreset}
                    parabolum={parabolum}
                    plotsWithMessages={plotsWithMessages}
                    hellActive={hellActive}
                    hellCol={hellCol}
                    hellRow={hellRow}
                    demonBounty={demonBounty}
                    demonTargetCol={localDemonTarget?.col}
                    demonTargetRow={localDemonTarget?.row}
                    demonCapturable={demonCapturable}
                    demonRequiredHits={demonRequiredHits}
                    onClaimBounty={handleClaimBounty}
                    onDemonMiss={handleDemonMiss}
                    onDemonAttack={handleDemonAttack}
                    cameraViewable={cameraViewable}
                    onFocusObject={handleFocusObject}
                    onBoothPhoto={handleBoothPhoto}
                  />
                </group>
                <CctvRenderer canvasRef={cctvCanvasRef} />
                {introComplete ? (
                  <>
                    <OrbitControls
                      ref={controlsRefMobile}
                      enableDamping
                      dampingFactor={0.1}
                      enablePan
                      minDistance={1.5}
                      maxDistance={45}
                      maxPolarAngle={Math.PI}
                      minPolarAngle={0}
                      zoomToCursor
                      autoRotate={hellOrbit}
                      autoRotateSpeed={0.6}
                      onStart={() => { if (hellOrbit) setHellOrbit(false); }}
                      target={introExitTarget || [1.5, 1.5, 1.5]}
                    />
                    <CameraFlyTo target={flyTarget} controlsRef={controlsRefMobile} />
                  </>
                ) : (
                  <CameraFlyIn onComplete={handleIntroComplete} mobile grid={gridSize} />
                )}
                <CameraShake shakeRef={shakeRef} />
                {/* Dev-only perf HUD (plain canvas here — no CRT
                    wrapper, so no bleed compensation needed). */}
                {/* {process.env.NODE_ENV === "development" && (
                  <Perf position="top-left" zIndex={10001} />
                )} */}
              </CleanCanvas>
              {/* The game's fixed overlays sit at z-index 10000; the
                  perf panel bakes 9999 into its own stylesheet and
                  ignores inline style on the fixed container, so
                  out-rank it with !important (the package applies neither className nor style props to that container). */}
              {process.env.NODE_ENV === "development" && (
                <style>{`
                .perf-panel { z-index: 10001 !important; }
                /* The mobile app-shell owns the top ~90px (48px header
                   + section tabs); start the HUD below it. */
                @media (max-width: 768px) {
                  .perf-panel.top-left { top: 100px !important; }
                }
              `}</style>
              )}
              {cctvOverlay}
              {/* DrillGeode renders once in the control block below the canvas
                  (matches desktop). It used to also render here, inside the
                  canvas wrap, which showed the gauges twice on the 3D tab and
                  crowded/overlapped the drill control. */}
              <div style={{ ...styles.cornerBracket, top: 6, left: 6 }} />
              <div style={{ ...styles.cornerBracket, top: 6, right: 6, transform: "scaleX(-1)" }} />
              <div style={{ ...styles.cornerBracket, bottom: 6, left: 6, transform: "scaleY(-1)" }} />
              <div style={{ ...styles.cornerBracket, bottom: 6, right: 6, transform: "scale(-1)" }} />
              <div style={styles.gridLabel}>
                {gridSize}&times;{gridSize}&times;{DEPTH_Z} 
              </div>
              {selectedX !== null && (() => {
                const mineCol = userDrill?.col ?? myPlot?.col;
                const mineRow = userDrill?.row ?? myPlot?.row;
                const isMine = mineCol === selectedX && mineRow === (sliceY ?? 0);
                return (
                  <div style={styles.cellCoordBadge}>
                    <span style={{ color: isMine ? theme.gold : "#aebccb" }}>
                      {isMine ? "YOUR CLAIM" : "RIG"}
                    </span>
                    <span style={{ color: "#ffe0a0" }}>
                      ({selectedX + 1}, {(sliceY ?? 0) + 1})
                    </span>
                  </div>
                );
              })()}
              {!editorOpen && (<>
              <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 10, ...TOOLBAR_TRAY }}>
                <button
                  onClick={toggleFireworks}
                  title={fireworksOn ? "Stop fireworks" : "Launch fireworks"}
                  style={toolbarBtn(fireworksOn, 32)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 L14 8 L12 6 L10 8 Z" />
                    <path d="M12 6 L12 12" />
                    <path d="M8 14 L5 11" /><path d="M16 14 L19 11" />
                    <path d="M6 18 L3 17" /><path d="M18 18 L21 17" />
                    <path d="M9 20 L7 22" /><path d="M15 20 L17 22" />
                    <circle cx="12" cy="16" r="3" fill={fireworksOn ? "currentColor" : "none"} opacity={fireworksOn ? 0.3 : 1} />
                  </svg>
                </button>
                {fireworksOn && (
                  <button
                    onClick={() => setFireworksSound((s) => !s)}
                    title={fireworksSound ? "Mute fireworks sound" : "Unmute fireworks sound"}
                    style={toolbarBtn(fireworksSound, 32)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5 6 9H2v6h4l5 4z" />
                      {fireworksSound ? (
                        <><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>
                      ) : (
                        <><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                      )}
                    </svg>
                  </button>
                )}
                <button
                  title="Snapshot"
                  onClick={handleManualSnapshot}
                  style={toolbarBtn(false, 32)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              </div>
              <div style={{ position: "absolute", top: 6, right: 6, zIndex: 10 }}>
                <SceneThemeToolbar
                  size={32}
                  envPreset={envPreset} setEnvPreset={chooseEnvPreset}
                  autoTheme={autoTheme} enableAutoTheme={enableAutoTheme}
                  darkMode={darkMode} setDarkMode={setDarkMode}
                  parabolum={parabolum} setParabolum={setParabolum}
                  setFireworksOn={setFireworksOn}
                />
              </div>
              </>)}
            </div>
          )}

          <div style={{ zoom: MOBILE_PANEL_ZOOM }}>
          {/* Scroll handle — only on the 3D tab, where the canvas captures touch.
              Gives a non-canvas grab area so the page can be scrolled, and taps
              nudge the panels below the scene into view. */}
          {mobileTab === "3d" && !editorOpen && (
            <button
              type="button"
              style={m.scrollHandle}
              aria-label="Scroll down to your rig"
              onClick={() => {
                document.getElementById("oil-scroll")?.scrollBy({
                  top: Math.round(window.innerHeight * 0.5),
                  behavior: "smooth",
                });
              }}
            >
              <span style={m.scrollHandleGrip} />
              <span>Scroll for your rig ↓</span>
            </button>
          )}

          {/* Controls — admin only (moved below the scroll handle) */}
          {isAdmin && (
            <div style={m.inlineControls}>
              {controlButtons}
            </div>
          )}

          {/* Surface Map */}
          {mobileTab === "surface" && (
            <div style={m.section}>
              <OilSurfaceMap
                claimTotals={showOilData ? stats.claimTotals : communityClaimTotals}
                maxClaimTotal={communityMaxClaimTotal}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
                sliceY={sliceY}
                theme={theme}
                parabolum={parabolum}
                gridX={gridSize}
                gridY={gridSize}
                allPlotsMap={allPlotsMap}
                claimJumpMode={claimJumpMode}
                onClaimJump={handleClaimJump}
                currentUserId={user?.id}
              />
            </div>
          )}

          {/* Cross Section */}
          {mobileTab === "xsec" && (
            <div style={m.section}>
              <OilCrossSection
                grid3D={showOilData ? stats.grid3D : communityGrid3D}
                maxCellValue={showOilData ? stats.maxOil : communityMaxOil}
                sliceY={sliceY}
                selectedX={xsecCol}
                drillDepth={showOilData ? drillDepth : effectiveDrillDay}
                onSelectX={handleSelectX}
                theme={theme}
                parabolum={parabolum}
                gridX={gridSize}
                gridY={gridSize}
              />
            </div>
          )}

          {/* Panels below active view */}
          {testStepper}
          {finalHaulCard}
          {/* Live first: the rig, its core, its finds, then the field. */}
          {yourRigCard}
          {gusherShutoffPanel}
          <CoreSamplePanel
            theme={theme}
            grid3D={displayGrid3D}
            maxOil={displayMaxOil}
            darkMode={uiDark}
            parabolum={parabolum}
            isMobile
            gridX={gridSize}
            gridY={gridSize}
            selectedX={selectedX}
            selectedY={sliceY}
            drillDepth={effectiveDrillDay}
            hellPockets={displayHellPockets}
            artifactMarks={revealedArtifactsByPlot[`${selectedX}_${sliceY}`] || []}
          />
          <MuseumPanel
            theme={theme}
            inventory={userDrill?.artifacts || {}}
            artifactFinds={userDrill?.artifactFinds || 0}
            darkMode={uiDark}
            isMobile
          />
          {/* DAILY TICKET — one free scratch ticket a day (server-minted for players with a claim; local + dev controls in test mode), after the rig's own cards. */}
          {(isTest || (user && userDrill)) && (
            <DailyTicketPanel theme={theme} isMobile={isMobile} darkMode={uiDark} selectedX={selectedX} selectedY={sliceY} devControls={isTest} live={!isTest} apiFetch={oilApiFetch} mintKey={seedCommitment} soundOn={fireworksSound} onJackpot={fireJackpotFireworks} onSettle={onTicketSettle} />
          )}
          {timelineSection}
          {leaderboardSection}
          {isAdmin && parametersPanel}
          {isAdmin && testToolsPanel}
          {isAdmin && <RogueAdminPanel rogueEvents={rogueEvents} gridSize={gridSize} darkMode={uiDark} adminPassword={adminPassword} />}
          {(isAdmin || isReport) && demoDrillPanel}
          {statsPanel}
          <OilPlotChat theme={theme} plotKey={selectedX !== null ? `${selectedX}_${sliceY}` : null} plotOwnerId={plotOwnerForCell} currentUserId={user?.id} username={user?.username || user?.firstName || "anon"} darkMode={uiDark} isMobile hasMessages={selectedX !== null && !!plotsWithMessages[`${selectedX}_${sliceY}`]} onRead={(pk) => { dismissedPlotsRef.current[pk] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[pk]; return next; }); }} onTransferPlot={handleTransferPlot} unlockedItems={unlockedItems} claimJumpOption={buildClaimJumpOption(selectedX !== null ? `${selectedX}_${sliceY}` : null)} isPlayer={!!userDrill} />
          {(isAdmin || isReport) && inspectorPanel}
          {(isAdmin || isReport) && dryZonesPanel}
          {(isAdmin || isReport) && fieldIntelPanel}
          {(isAdmin || isReport) && hellPocketsPanel}
          {/* Seed bar — admin/report only */}
          {(isAdmin || isReport) && (
            <div style={m.seedBar}>
              <span style={styles.seedLabel}>SEED</span>
              <span style={styles.seedValue}>{blockHash}</span>
            </div>
          )}
          <div id="pimp-my-pump" style={{ scrollMarginTop: Math.round(editorSceneH / MOBILE_PANEL_ZOOM) }}>
          <PimpMyPumpPanel theme={theme} config={pumpConfig} onChange={handleConfigChange} onExpandedChange={handlePimpExpanded} hasSelection={selectedX !== null} isMobile darkMode={uiDark} onSave={handleConfigSave} saving={configSaving} dirty={configDirty} isSignedIn={!!user} defaultExpanded={false} userId={user?.id} readOnly={user?.id ? !isConfigOwner : plotOwnerForCell != null} unlockedItems={unlockedItems} onPurchaseRequest={handlePurchaseRequest} />
          </div>
          {fieldDispatchSection}
          {isAdmin && pendingFeedPanel}
          {(isAdmin || isReport) && (
            <OilVerifyPanel adminPassword={adminPassword} userId={user?.id || null} />
          )}
          {isAdmin && <OilAdminGuide />}
          {adminAlertsPanel}
          {claimPlotButton && (
            <div style={{ ...m.section, display: "flex", justifyContent: "center" }}>
              {claimPlotButton}
            </div>
          )}
          {endGameButton && (
            <div style={{ ...m.section, display: "flex", justifyContent: "center" }}>
              {endGameButton}
            </div>
          )}
          {phaseOverrideButtons && (
            <div style={{ ...m.section, display: "flex", justifyContent: "center" }}>
              {phaseOverrideButtons}
            </div>
          )}
          {gameEndedBanner && (
            <div style={{ ...m.section, display: "flex", justifyContent: "center" }}>
              {gameEndedBanner}
            </div>
          )}
          </div>
        </div>

        {/* Bottom Mobile Nav */}
        <MobileBottomNav
          isPlaying={contextIsPlaying}
          onPlayMusic={() => play()}
          onStopMusic={() => pause()}
          onSkipTrack={() => nextTrack()}
          hideMenu
          hideMusicOnMobile
          hideWallet
          onUserClick={() => {}}
          isUserSignedIn={!!user}
          userImage={user?.imageUrl}
          onBuyClick={mobilePrimary.onClick}
          centerLabel={mobilePrimary.label}
          centerSubLabel={mobilePrimary.sub}
          centerTitle={mobilePrimary.title}
          centerSize={72}
          isMobile
          show80sButton={false}
          darkMode={uiDark}
          accountModalInitialTab="referrals"
          accountModalTheme="industrial"
          accountModalUnlockedItems={unlockedItems}
          extraLeft={[{
            key: "home",
            label: "Home",
            title: "Return to home",
            onClick: () => router.push("/"),
            icon: <img src="/brand-mark-cyan.svg" alt="" width="24" height="24" style={{ display: "block" }} />,
          }]}
        />

        {/* Buy Modal */}
        <BuyModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
        />

        <OilWelcomeModal apiFetch={oilApiFetch} signedIn={!!user} isOpen={showWelcome} onClose={closeWelcome} darkMode={uiDark} fairnessOpen={helpFairness} numberOfDeposits={numberOfDeposits} totalOilBudget={totalOilBudget} gridX={gridSize} gridY={gridSize} />

        {/* SitePal host for the commercial-strip vendors (mobile branch —
            the desktop branch mounts its own; the embed itself is guarded
            once-per-page, so both mounting is safe). */}
        <VendorSitePalHost />

        {/* Concretion reveal waits until the away-recap is dismissed. */}
        {!awayRecap && pendingConcretion && (
          <ConcretionModal artifact={pendingConcretion} onDone={dismissConcretion} darkMode={uiDark} />
        )}

        <OilAwayRecap
          recap={awayRecap}
          referralCode={userDrill?.referralCode || null}
          theme={theme}
          isMobile={isMobile}
          usdRate={totalOilBudget / OIL_FIELD_UNITS}
          tankHeavy={(awayRecap?.tank ?? 0) >= TANK_CAPACITY}
          onBank={handleTankDrain}
          onClose={() => setAwayRecap(null)}
        />

        <OilOverlayModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} darkMode={uiDark}>
          {leaderboardPanel}
        </OilOverlayModal>

        {purchaseModalItem && (
          <PumpPurchaseModal
            items={purchaseModalItem}
            activeAccount={walletAddress}
            userId={user?.id}
            coupon={userDrill?.coupon || null}
            onComplete={handlePurchaseComplete}
            onClose={() => setPurchaseModalItem(null)}
            onConnectWallet={() => setShowAccountModal(true)}
            onGetUsdc={() => setShowBuyModal(true)}
          />
        )}

        <UnifiedAccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          theme="industrial"
          unlockedItems={unlockedItems}
        />

        {/* CyberNav Menu Panel */}
        {/* <CyberNav
          position="fixed"
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          showButton={false}
        /> */}

        {cssAnimations}
        {demonBanner}
        {bountyClaimedBanner}
        {claimToastBanner}
        {boothCamBanner}
        {claimBountyButton}

        <PolaroidSnapshot
          trigger={snapshotTrigger}
          captureElementId="oil-canvas"
          imageSource={boothPhoto?.url || null}
          format={boothPhoto?.format || "square"}
          label={snapshotLabel}
          referralOverlay={userDrill?.referralCode ? { code: userDrill.referralCode } : { link: "rl80.com/hailmary" }}
          onComplete={handleSnapshotComplete}
          onPublish={isAdmin ? publishPolaroidToFeed : null}
        />
        {feedLightbox}

        {chatModalPlotKey && (
          <OilChatModal
            plotKey={chatModalPlotKey}
            plotOwnerId={allPlotsMap[chatModalPlotKey]?.currentOwnerId}
            currentUserId={user?.id}
            username={user?.username || user?.firstName || "anon"}
            onClose={() => { dismissedPlotsRef.current[chatModalPlotKey] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[chatModalPlotKey]; return next; }); setChatModalPlotKey(null); }}
            claimJumpOption={buildClaimJumpOption(chatModalPlotKey)}
            isPlayer={!!userDrill}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DESKTOP LAYOUT — 3-column CSS grid
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={styles.root}>
      {previewBanner}
      <div style={styles.scanlines} />
      <div style={styles.grain} />
      <style>{`.nav-mobile-home { background: transparent !important; border: none !important; box-shadow: none !important; }`}</style>

      <header style={{ ...styles.header, zoom: uiScale }}>
        <div style={styles.headerLeft}>
          <Link
            href="/"
            title="Return to shrine"
            style={{ ...styles.logoMark, cursor: "pointer", textDecoration: "none" }}
          >
            <img src="/brand-mark-cyan.svg" alt="Home" style={{ width: 24, height: 24, objectFit: "contain", display: "block" }} />
          </Link>
          <div>
            <h1 style={{ ...styles.title, display: "flex", alignItems: "center", gap: 8 }}>
              <span>HAIL MARY PROSPECTING CO.{modeBadge}</span>
            </h1>
            <p style={{ ...styles.subtitle, fontSize: 18 }}>LYQUID80 QUEST</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 14,
            fontWeight: 700,
            color: theme.accent,
            letterSpacing: "0.1em",
          }}>
            {gamePhase === "ticket_sale"
              ? <SeasonCountdown gameStartDate={gameStartDate} />
              : `DAY ${gameDay} / ${seasonLengthDays}`}
          </span>
          <div style={{ ...styles.statusDot, ...(gameEnded ? { background: theme.red, boxShadow: "0 0 6px rgba(160,48,48,0.4)" } : {}) }} />
          <span style={styles.statusText}>
            {gameEnded ? "GAME ENDED" : gamePhase === "ticket_sale" ? "PRE-SEASON" : "SURVEY ACTIVE"}
          </span>
          <button
            onClick={() => setShowLeaderboard(true)}
            title="Leaderboard"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(212, 175, 55, 0.05)",
              border: "1.5px solid rgba(212, 175, 55, 0.2)",
              color: theme.accent, cursor: "pointer", padding: 0,
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </button>
          <NavControlsHome
            isPlaying={contextIsPlaying}
            onPlayMusic={() => play()}
            onStopMusic={() => pause()}
            onSkipTrack={() => nextTrack()}
            onHelpClick={() => setShowWelcome(true)}
            accentColor={theme.accent}
            framedAvatar
            hideMenu
            onUserClick={() => {}}
            isUserSignedIn={!!user}
            userImage={user?.imageUrl}
            show80sButton={false}
            hideMusicOnMobile
            accountModalInitialTab="referrals"
            accountModalTheme="industrial"
            accountModalUnlockedItems={unlockedItems}
          />
        </div>
      </header>

      {(isAdmin || isReport) && (
        <div style={{ ...styles.seedBar, zoom: uiScale }}>
          <span style={styles.seedLabel}>BLOCK HASH SEED</span>
          <span style={styles.seedValue}>{blockHash}</span>
          <div style={styles.seedVerified}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-6" stroke="#5a8a3a" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            DETERMINISTIC
          </div>
        </div>
      )}

      <div style={{
        ...styles.dashboard,
        gridTemplateColumns: panelsCollapsed ? "1fr" : `1fr ${Math.round(340 * uiScale)}px ${Math.round(280 * uiScale)}px`,
      }}>
        {/* 3D Voxel View */}
        <div id="oil-canvas" style={{
          ...styles.canvasWrap,
          borderRight: panelsCollapsed ? "none" : `1px solid ${theme.border}`,
        }}>
          <CleanCanvas
            camera={{ position: [0, 8, 8], fov: 50 }}
            dpr={[1, 1.5]}
            style={{ width: "100%", height: "100%" }}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
          >
            <SkyDome skyColor={env.sky} skyBottom={env.skyBottom} cloudOpacity={env.cloudOpacity} hell={envPreset === "hell"} />
            {envPreset === "hell" && <HellSkyEffects />}
            {!parabolum && envPreset === "solstice" && <SolsticeSkyEffects />}
            {parabolum && <ParabolumMoon />}
            {envPreset === "night" && <StarField radius={150} count1={500} count2={300} />}
            {envPreset === "night" && <ConstellationModel groupScale={[15, 15, 15]} groupPosition={[0, 8, -60]} isVisible={true} />}
            {fireworksOn && <Fireworks quality={2} shellSize={2} finale sound={fireworksSound} />}
            {env.fog && <fog attach="fog" args={[env.fog, 20, 200]} />}
            <ambientLight intensity={env.ambient * moodScale} />
            {env.hemi && <hemisphereLight args={[env.hemi.sky, env.hemi.ground, env.hemi.intensity * moodScale]} />}
            <directionalLight position={[10, 15, 10]} intensity={env.dirA * moodScale} color={env.dirAColor || "#ffffff"} />
            <directionalLight position={[-5, 10, -5]} intensity={env.dirB * moodScale} color={env.dirBColor || "#ffffff"} />
            <pointLight position={[-8, 5, -8]} intensity={1.5 * moodScale} color={env.point} />
            <group position={[0, 5, 0]}>
              <OilVoxelGrid
                blockHash={blockHash}
                numberOfDeposits={numberOfDeposits}
                numberOfHellPockets={numberOfHellPockets}
                totalOilBudget={totalOilBudget}
                gridX={gridSize}
                gridY={gridSize}
                revealProgress={revealProgress}
                animateReveal={animateReveal}
                revealDuration={2}
                drillDay={effectiveDrillDay}
                selectedCol={selectedX}
                selectedRow={selectedX !== null ? sliceY : null}
                onSelectCell={(col, row) => { setSelectedX(col); setSliceY(row); setDrillDepth(0); }}
                    onEnvelopeClick={(col, row) => setChatModalPlotKey(`${col}_${row}`)}
                onFlyTo={handleFlyTo}
                onZoomOut={handleZoomOut}
                pumpConfig={pumpConfig}
                allPumpConfigs={allPumpConfigs}
                oilStrike={combinedStrike}
                forceStrikeGusher={isAdmin || isReport || isTest}
                gusherTrigger={gusherTest}
                drillEvent={drillEvent}
                drillProximity={drillProximity}
                tankFill={tankFill}
                onTankDrain={handleTankDrain}
                communityOil={communityOil}
                rogueEvents={rogueEvents}
                gusherEvents={gusherEvents}
                onRogueArrive={handleRogueArrive}
                onRogueConsequence={handleRogueConsequence}
                envPreset={envPreset}
                envMapPreset={envMapPreset}
                parabolum={parabolum}
                plotsWithMessages={plotsWithMessages}
                hellActive={hellActive}
                hellCol={hellCol}
                hellRow={hellRow}
                demonBounty={demonBounty}
                demonTargetCol={localDemonTarget?.col}
                demonTargetRow={localDemonTarget?.row}
                demonCapturable={demonCapturable}
                demonRequiredHits={demonRequiredHits}
                onClaimBounty={handleClaimBounty}
                onDemonMiss={handleDemonMiss}
                onDemonAttack={handleDemonAttack}
                cameraViewable={cameraViewable}
                onFocusObject={handleFocusObject}
                onBoothPhoto={handleBoothPhoto}
              />
            </group>
            <CctvRenderer canvasRef={cctvCanvasRef} />
            {introComplete ? (
              <>
                <OrbitControls
                  ref={controlsRef}
                  enableDamping
                  dampingFactor={0.08}
                  enablePan
                  panSpeed={2}
                  minDistance={1.5}
                  maxDistance={45}
                  maxPolarAngle={Math.PI}
                  minPolarAngle={0}
                  target={introExitTarget || [3, 5, 3]}
                  zoomToCursor
                />
                <CameraFlyTo target={flyTarget} controlsRef={controlsRef} />
              </>
            ) : (
              <CameraFlyIn onComplete={handleIntroComplete} grid={gridSize} />
            )}
            <CameraShake shakeRef={shakeRef} />
            {/* Dev-only perf HUD (plain canvas here — no CRT wrapper,
                so no bleed compensation needed). */}
            {/* {process.env.NODE_ENV === "development" && (
              <Perf position="top-left" style={{zIndex: 10001}}/>
            )} */}
          </CleanCanvas>
          {/* Same z-index hook as the mobile canvas above. */}
          {process.env.NODE_ENV === "development" && (
            <style>{`
                .perf-panel { z-index: 10001 !important; }
                /* The mobile app-shell owns the top ~90px (48px header
                   + section tabs); start the HUD below it. */
                @media (max-width: 768px) {
                  .perf-panel.top-left { top: 100px !important; }
                }
              `}</style>
          )}
          {cctvOverlay}
          <div style={{ ...styles.cornerBracket, top: 8, left: 8 }} />
          <div style={{ ...styles.cornerBracket, top: 8, right: 8, transform: "scaleX(-1)" }} />
          <div style={{ ...styles.cornerBracket, bottom: 8, left: 8, transform: "scaleY(-1)" }} />
          <div style={{ ...styles.cornerBracket, bottom: 8, right: 8, transform: "scale(-1)" }} />
          <div style={{ ...styles.gridLabel, zoom: uiScale }}>
            {gridSize}&times;{gridSize}&times;{DEPTH_Z}
          </div>
          {/* With the panels hidden the payout has no home, so it rides the
              scene as a pill; it goes away the moment the panels return. */}
          {panelsCollapsed && showPayout && !isAdmin && !isReport && activeUserDrill?.col != null && (
            <div style={{ position: "absolute", bottom: 34, left: 16, zIndex: 10, zoom: uiScale, ...TOOLBAR_PILL, cursor: "default", gap: 7 }}>
              <span style={{ fontFamily: "'Orbitron', monospace", fontWeight: 700, color: "#ffe08a" }}>{fmtUsd(bankedOil)}</span>
              <span style={{ fontSize: 9, letterSpacing: "0.14em", opacity: 0.7 }}>BANKED</span>
              <span style={{ opacity: 0.35 }}>|</span>
              <span style={{ color: tankHeavy ? "#ff7a5c" : "rgba(245,232,200,0.9)" }}>{fmtUsd(tankShownOil)}</span>
              <span style={{ fontSize: 9, letterSpacing: "0.14em", opacity: 0.7 }}>TANK</span>
            </div>
          )}
          <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10, zoom: uiScale, ...TOOLBAR_TRAY }}>
            <button
              onClick={toggleFireworks}
              title={fireworksOn ? "Stop fireworks" : "Launch fireworks"}
              style={toolbarBtn(fireworksOn, 28)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L14 8 L12 6 L10 8 Z" />
                <path d="M12 6 L12 12" />
                <path d="M8 14 L5 11" /><path d="M16 14 L19 11" />
                <path d="M6 18 L3 17" /><path d="M18 18 L21 17" />
                <path d="M9 20 L7 22" /><path d="M15 20 L17 22" />
                <circle cx="12" cy="16" r="3" fill={fireworksOn ? "currentColor" : "none"} opacity={fireworksOn ? 0.3 : 1} />
              </svg>
            </button>
            {fireworksOn && (
              <button
                onClick={() => setFireworksSound((s) => !s)}
                title={fireworksSound ? "Mute fireworks sound" : "Unmute fireworks sound"}
                style={toolbarBtn(fireworksSound, 28)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  {fireworksSound ? (
                    <><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>
                  ) : (
                    <><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                  )}
                </svg>
              </button>
            )}
            <button
              title="Snapshot"
              onClick={handleManualSnapshot}
              style={toolbarBtn(false, 28)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>
          <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, zoom: uiScale, display: "flex", alignItems: "center", gap: 8 }}>
            <SceneThemeToolbar
              size={28}
              envPreset={envPreset} setEnvPreset={chooseEnvPreset}
              autoTheme={autoTheme} enableAutoTheme={enableAutoTheme}
              darkMode={darkMode} setDarkMode={setDarkMode}
              parabolum={parabolum} setParabolum={setParabolum}
              setFireworksOn={setFireworksOn}
            />
            <button
              title={panelsCollapsed ? "Show the map and side panels" : "Hide the map and side panels"}
              onClick={() => setPanelsCollapsed((p) => !p)}
              style={TOOLBAR_PILL}
            >
              {panelsCollapsed ? "◂ SHOW PANELS" : "HIDE PANELS ▸"}
            </button>
          </div>
        </div>

        {/* Middle column */}
        {!panelsCollapsed && (
          <div style={{ ...styles.midColumn, zoom: uiScale }}>
            <div style={styles.midPanel}>
              <OilSurfaceMap
                claimTotals={showOilData ? stats.claimTotals : communityClaimTotals}
                maxClaimTotal={communityMaxClaimTotal}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
                sliceY={sliceY}
                theme={theme}
                parabolum={parabolum}
                gridX={gridSize}
                gridY={gridSize}
                allPlotsMap={allPlotsMap}
                claimJumpMode={claimJumpMode}
                onClaimJump={handleClaimJump}
                currentUserId={user?.id}
              />
            </div>
            <div style={{ ...styles.midPanel, flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              <OilCrossSection
                grid3D={showOilData ? stats.grid3D : communityGrid3D}
                maxCellValue={showOilData ? stats.maxOil : communityMaxOil}
                sliceY={sliceY}
                selectedX={xsecCol}
                drillDepth={showOilData ? drillDepth : effectiveDrillDay}
                onSelectX={handleSelectX}
                theme={theme}
                parabolum={parabolum}
                gridX={gridSize}
                gridY={gridSize}
                fillHeight
              />
            </div>
          </div>
        )}

        {/* Right side panel */}
        {!panelsCollapsed && (
          <aside style={{
            ...styles.sidePanel,
            zoom: uiScale,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateX(0)" : "translateX(20px)",
          }}>
            {testStepper}
            {finalHaulCard}
            {/* Live first: the rig, its core, its finds, then the field. */}
            {yourRigCard}
            {gusherShutoffPanel}
            <CoreSamplePanel
              theme={theme}
              grid3D={displayGrid3D}
              maxOil={displayMaxOil}
              darkMode={uiDark}
              parabolum={parabolum}
              gridX={gridSize}
              gridY={gridSize}
              selectedX={selectedX}
              selectedY={sliceY}
              drillDepth={effectiveDrillDay}
              hellPockets={displayHellPockets}
              artifactMarks={revealedArtifactsByPlot[`${selectedX}_${sliceY}`] || []}
            />
            <MuseumPanel
              theme={theme}
              inventory={userDrill?.artifacts || {}}
              artifactFinds={userDrill?.artifactFinds || 0}
              darkMode={uiDark}
            />
            {/* DAILY TICKET — one free scratch ticket a day (server-minted for players with a claim; local + dev controls in test mode), after the rig's own cards. */}
            {(isTest || (user && userDrill)) && (
              <DailyTicketPanel theme={theme} isMobile={isMobile} darkMode={uiDark} selectedX={selectedX} selectedY={sliceY} devControls={isTest} live={!isTest} apiFetch={oilApiFetch} mintKey={seedCommitment} soundOn={fireworksSound} onJackpot={fireJackpotFireworks} onSettle={onTicketSettle} />
            )}
            {timelineSection}
            {leaderboardSection}
            {isAdmin && parametersPanel}
            {isAdmin && testToolsPanel}
            {isAdmin && <RogueAdminPanel rogueEvents={rogueEvents} gridSize={gridSize} darkMode={uiDark} adminPassword={adminPassword} />}
            {(isAdmin || isReport) && demoDrillPanel}
            {statsPanel}
            <OilPlotChat theme={theme} plotKey={selectedX !== null ? `${selectedX}_${sliceY}` : null} plotOwnerId={plotOwnerForCell} currentUserId={user?.id} username={user?.username || user?.firstName || "anon"} darkMode={uiDark} hasMessages={selectedX !== null && !!plotsWithMessages[`${selectedX}_${sliceY}`]} onRead={(pk) => { dismissedPlotsRef.current[pk] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[pk]; return next; }); }} onTransferPlot={handleTransferPlot} unlockedItems={unlockedItems} claimJumpOption={buildClaimJumpOption(selectedX !== null ? `${selectedX}_${sliceY}` : null)} isPlayer={!!userDrill} />
            {(isAdmin || isReport) && inspectorPanel}
            {(isAdmin || isReport) && dryZonesPanel}
            {(isAdmin || isReport) && fieldIntelPanel}
            {(isAdmin || isReport) && hellPocketsPanel}
            <PimpMyPumpPanel theme={theme} config={pumpConfig} onChange={handleConfigChange} hasSelection={selectedX !== null} darkMode={uiDark} onSave={handleConfigSave} saving={configSaving} dirty={configDirty} isSignedIn={!!user} defaultExpanded={false} userId={user?.id} readOnly={user?.id ? !isConfigOwner : plotOwnerForCell != null} unlockedItems={unlockedItems} onPurchaseRequest={handlePurchaseRequest} />
            {fieldDispatchSection}
            {isAdmin && pendingFeedPanel}
            {(isAdmin || isReport) && (
              <OilVerifyPanel adminPassword={adminPassword} userId={user?.id || null} />
            )}
            {isAdmin && <OilAdminGuide />}
            {adminAlertsPanel}
            {claimPlotButton && (
              <div style={{ ...styles.panelSection, display: "flex", justifyContent: "center" }}>
                {claimPlotButton}
              </div>
            )}
            {endGameButton && (
              <div style={{ ...styles.panelSection, display: "flex", justifyContent: "center" }}>
                {endGameButton}
              </div>
            )}
            {phaseOverrideButtons && (
              <div style={{ ...styles.panelSection, display: "flex", justifyContent: "center" }}>
                {phaseOverrideButtons}
              </div>
            )}
            {gameEndedBanner && (
              <div style={{ ...styles.panelSection, display: "flex", justifyContent: "center" }}>
                {gameEndedBanner}
              </div>
            )}
          </aside>
        )}
      </div>

      {isAdmin && (
        <div style={{ ...styles.controlBar, zoom: uiScale }}>
          {controlButtons}
        </div>
      )}

      {/* CyberNav Menu Panel */}
      <CyberNav
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />

      {cssAnimations}
      {demonBanner}
      {bountyClaimedBanner}
      {claimToastBanner}
      {boothCamBanner}
      {claimBountyButton}

      <PolaroidSnapshot
        trigger={snapshotTrigger}
        captureElementId="oil-canvas"
        imageSource={boothPhoto?.url || null}
        format={boothPhoto?.format || "square"}
        label={snapshotLabel}
        referralOverlay={userDrill?.referralCode ? { code: userDrill.referralCode } : { link: "rl80.com/hailmary" }}
        onComplete={handleSnapshotComplete}
        onPublish={isAdmin ? publishPolaroidToFeed : null}
      />
      {feedLightbox}

      {chatModalPlotKey && (
        <OilChatModal
          plotKey={chatModalPlotKey}
          plotOwnerId={allPlotsMap[chatModalPlotKey]?.currentOwnerId}
          currentUserId={user?.id}
          username={user?.username || user?.firstName || "anon"}
          onClose={() => { dismissedPlotsRef.current[chatModalPlotKey] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[chatModalPlotKey]; return next; }); setChatModalPlotKey(null); }}
          claimJumpOption={buildClaimJumpOption(chatModalPlotKey)}
          isPlayer={!!userDrill}
        />
      )}

      {purchaseModalItem && (
        <PumpPurchaseModal
          items={purchaseModalItem}
          activeAccount={walletAddress}
          userId={user?.id}
          coupon={userDrill?.coupon || null}
          onComplete={handlePurchaseComplete}
          onClose={() => setPurchaseModalItem(null)}
          onConnectWallet={() => setShowAccountModal(true)}
          onGetUsdc={() => setShowBuyModal(true)}
        />
      )}

      <BuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      <OilWelcomeModal apiFetch={oilApiFetch} signedIn={!!user} isOpen={showWelcome} onClose={closeWelcome} darkMode={uiDark} fairnessOpen={helpFairness} numberOfDeposits={numberOfDeposits} totalOilBudget={totalOilBudget} gridX={gridSize} gridY={gridSize} />

      {/* SitePal host for the commercial-strip vendors. Mounted on mobile
          too: only one vendor speaks at a time, and without the host mobile
          has no sayText at all. The stall tap is the audio-unlock gesture
          (activateVendorSitePal primes audio inside it). */}
      <VendorSitePalHost />

      {/* Concretion reveal waits until the away-recap is dismissed. */}
      {!awayRecap && pendingConcretion && (
        <ConcretionModal artifact={pendingConcretion} onDone={dismissConcretion} darkMode={uiDark} />
      )}

      <OilAwayRecap
        recap={awayRecap}
        referralCode={userDrill?.referralCode || null}
        theme={theme}
        isMobile={isMobile}
        usdRate={totalOilBudget / OIL_FIELD_UNITS}
        tankHeavy={(awayRecap?.tank ?? 0) >= TANK_CAPACITY}
        onBank={handleTankDrain}
        onClose={() => setAwayRecap(null)}
      />

      <OilOverlayModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} darkMode={uiDark}>
        {leaderboardPanel}
      </OilOverlayModal>

      <UnifiedAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        theme="industrial"
        initialTab="wallet"
        unlockedItems={unlockedItems}
      />
    </div>
  );
}

function StatBlock({ label, value, unit, accent, s, accentColor }) {
  return (
    <div style={s.statBlock}>
      <div style={s.statLabel}>{label}</div>
      <div style={{
        ...s.statValue,
        ...(accent ? { color: accentColor } : {}),
      }}>
        {value}
        {unit && <span style={s.statUnit}>{unit}</span>}
      </div>
    </div>
  );
}

function getDrillStyles(t) { return {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  active: {
    padding: "10px 32px",
    background: `linear-gradient(180deg, ${t.gold}, ${t.goldBorder})`,
    border: `2px solid ${t.goldBorder}`,
    borderRadius: 4,
    color: "#fff",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: "0.2em",
    cursor: "pointer",
    boxShadow: "0 2px 12px rgba(180,140,40,0.35)",
    transition: "all 0.2s",
  },
  disabled: {
    padding: "10px 24px",
    background: t.btnBg,
    border: `1px solid ${t.borderLight}`,
    borderRadius: 4,
    color: t.muted,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    cursor: "not-allowed",
  },
  depth: {
    fontSize: 11,
    fontFamily: "'Orbitron', monospace",
    color: t.accent,
    letterSpacing: "0.15em",
  },
  countdown: {
    fontSize: 11,
    fontFamily: "'Share Tech Mono', monospace",
    color: t.muted,
    letterSpacing: "0.08em",
  },
  hint: {
    fontSize: 10,
    color: t.muted,
    letterSpacing: "0.08em",
  },
}; }

const cctvStyles = {
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 220,
    background: "#0a0a0a",
    border: "1px solid #444",
    borderRadius: 4,
    overflow: "hidden",
    zIndex: 100,
    fontFamily: "'Share Tech Mono', monospace",
    boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 8px",
    background: "#111",
    cursor: "pointer",
    userSelect: "none",
    gap: 8,
  },
  rec: {
    fontSize: 9,
    color: "#ff3333",
    letterSpacing: "0.1em",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  recInactive: {
    fontSize: 9,
    color: "#666",
    letterSpacing: "0.1em",
  },
  recCount: {
    fontSize: 9,
    color: "#111",
    background: "#ff3333",
    borderRadius: 6,
    padding: "0 4px",
    minWidth: 14,
    textAlign: "center",
    lineHeight: "14px",
  },
  camLabel: {
    fontSize: 9,
    color: "#888",
    letterSpacing: "0.12em",
    flex: 1,
    textAlign: "center",
  },
  toggle: {
    fontSize: 9,
    color: "#666",
  },
  canvas: {
    width: "100%",
    height: "auto",
    display: "block",
    imageRendering: "pixelated",
    filter: "contrast(1.1) brightness(0.9) saturate(0.6)",
  },
  scanlines: {
    position: "absolute",
    top: 22,
    left: 0,
    right: 0,
    bottom: 0,
    background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
    pointerEvents: "none",
    zIndex: 1,
  },
  footer: {
    padding: "3px 8px",
    background: "#111",
    textAlign: "right",
  },
  timestamp: {
    fontSize: 9,
    color: "#888",
    letterSpacing: "0.08em",
  },
  playbackControls: {
    position: "absolute",
    top: 4,
    right: 4,
    display: "flex",
    gap: 3,
    zIndex: 2,
  },
  backToLive: {
    fontSize: 9,
    color: "#fff",
    background: "rgba(255,50,50,0.8)",
    border: "none",
    borderRadius: 3,
    padding: "2px 6px",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    letterSpacing: "0.08em",
  },
  clipAction: {
    fontSize: 10,
    color: "#fff",
    background: "rgba(0,0,0,0.6)",
    border: "1px solid #555",
    borderRadius: 3,
    padding: "1px 5px",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    textDecoration: "none",
    lineHeight: "14px",
  },
  recList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "4px 6px",
    background: "#0e0e0e",
    borderTop: "1px solid #333",
  },
  recRow: {
    display: "flex",
    gap: 3,
    alignItems: "center",
  },
  recIcon: {
    fontSize: 9,
    color: "#888",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    fontFamily: "'Share Tech Mono', monospace",
    textDecoration: "none",
  },
  recBtn: {
    fontSize: 8,
    color: "#aaa",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 3,
    padding: "2px 5px",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
};

function getStyles(t) { return {
  root: {
    width: "100vw",
    height: "100vh",
    background: t.panelWash ? `${t.panelWash}, ${t.bg}` : t.bg,
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Share Tech Mono', 'Orbitron', monospace",
    color: t.text,
    display: "flex",
    flexDirection: "column",
  },

  scanlines: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 100,
    background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${t.scanline} 2px, ${t.scanline} 4px)`,
    mixBlendMode: "multiply",
  },

  grain: {
    position: "fixed",
    inset: "-50%",
    width: "200%",
    height: "200%",
    pointerEvents: "none",
    zIndex: 99,
    opacity: 0.015,
    background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    animation: "grainAnim 8s steps(10) infinite",
  },

  header: {
    height: 56,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    zIndex: 20,
    borderBottom: `1px solid ${t.border}`,
    background: t.panelWash ? `${t.panelLine}, linear-gradient(180deg, ${t.headerBg} 0%, ${t.headerBg} 100%)` : `linear-gradient(180deg, ${t.headerBg} 0%, ${t.headerBg} 100%)`,
    backdropFilter: "blur(12px)",
    boxShadow: t.softShadow || "none",
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  logoMark: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${t.goldBorder}`,
    borderRadius: 4,
    overflow: "hidden",
  },

  title: {
    margin: 0,
    fontSize: 14,
    fontFamily: "'Orbitron', monospace",
    fontWeight: 800,
    color: t.accent,
    letterSpacing: "0.15em",
    lineHeight: 1.1,
  },

  subtitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    // Opal gusher sheen: petrol-slick rainbow (cyan→violet→magenta→gold→green)
    // that slowly drifts, with a cyan bloom matching the substance emis (#18d0c0).
    backgroundImage:
      "linear-gradient(100deg, #18d0c0 0%, #7b9cff 18%, #c77bff 34%, #ff5ea8 50%, #ffcf6b 66%, #5effc4 82%, #18d0c0 100%)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    animation: "opalSheen 8s linear infinite",
    filter: "drop-shadow(0 0 6px rgba(24,208,192,0.35))",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: t.green,
    boxShadow: `0 0 6px rgba(90,138,58,0.4)`,
    animation: "pulse 2s ease-in-out infinite",
  },

  statusText: {
    fontSize: 10,
    color: t.statusText,
    letterSpacing: "0.12em",
  },

  seedBar: {
    height: 28,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px",
    background: t.panelWash ? `${t.panelLine}, ${t.tintBg}` : t.tintBg,
    borderBottom: `1px solid ${t.border}`,
    zIndex: 15,
  },

  seedLabel: {
    fontSize: 11,
    color: t.seedLabel,
    letterSpacing: "0.12em",
    flexShrink: 0,
  },

  seedValue: {
    fontSize: 10,
    color: t.seedValue,
    fontFamily: "'Share Tech Mono', monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },

  seedVerified: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: t.green,
    letterSpacing: "0.08em",
    flexShrink: 0,
    opacity: 0.8,
  },

  // Dashboard: 3-column CSS grid
  dashboard: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 340px 280px",
    gap: 0,
    minHeight: 0,
    overflow: "hidden",
  },

  canvasWrap: {
    position: "relative",
    borderRight: `1px solid ${t.border}`,
    overflow: "hidden",
  },

  cornerBracket: {
    position: "absolute",
    width: 20,
    height: 20,
    borderLeft: `1px solid ${t.cornerBorder}`,
    borderTop: `1px solid ${t.cornerBorder}`,
    pointerEvents: "none",
    zIndex: 5,
  },

  gridLabel: {
    position: "absolute",
    bottom: 12,
    left: 16,
    fontSize: 10,
    color: t.muted,
    letterSpacing: "0.15em",
    zIndex: 5,
  },

  // Focused-cell coordinate readout — top-left of the mobile 3D canvas. Shows
  // the currently selected rig/cell so the player always knows what they're
  // looking at (their own claim, or another rig they've tapped into).
  cellCoordBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    padding: "4px 9px",
    // Solid dark chip + blur so the readout stays legible over the bright 3D
    // scene. Text colors below are fixed light tones (not theme-derived) so they
    // never go dark-on-dark in the light themes.
    background: "rgba(10,13,18,0.82)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 4,
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
    zIndex: 6,
    pointerEvents: "none",
  },

  // Middle column
  midColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    overflow: "hidden",
    borderRight: `1px solid ${t.border}`,
    background: t.panelWash || "transparent",
  },

  midPanel: {
    padding: "10px 12px",
    borderBottom: `1px solid ${t.border}`,
    background: t.panelWash || "transparent",
  },

  // Right side panel
  sidePanel: {
    overflowY: "auto",
    overflowX: "hidden",
    background: t.panelWash ? `${t.panelWash}, ${t.panelBg}` : t.panelBg,
    backdropFilter: "blur(16px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
    boxShadow: t.softShadow || "none",
  },

  // One definition for every section in the column — see HailMaryPanel.jsx.
  panelSection: panelChrome(t).section,
  panelTitle: panelChrome(t).title,

  rankIcon: {
    fontSize: 10,
    color: t.titleCool || t.accent,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },

  statBlock: {
    padding: "6px 8px",
    background: t.statWash || t.tintBg,
    border: `1px solid ${t.border}`,
    borderRadius: 3,
    boxShadow: t.softShadow || "none",
  },

  statLabel: {
    fontSize: 10,
    color: t.muted,
    letterSpacing: "0.15em",
    marginBottom: 3,
  },

  statValue: {
    fontSize: 14,
    fontFamily: "'Orbitron', monospace",
    fontWeight: 700,
    color: t.textStrong,
    lineHeight: 1,
  },

  statUnit: {
    fontSize: 10,
    color: t.muted,
    marginLeft: 3,
    fontWeight: 400,
  },

  // Inspector
  inspectorStats: {
    marginBottom: 10,
  },

  inspectorRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    marginBottom: 3,
  },

  inspectorKey: {
    color: t.inspectorKey,
  },

  inspectorVal: {
    color: t.accent,
    fontFamily: "'Orbitron', monospace",
    fontSize: 11,
  },

  drillBtn: {
    width: "100%",
    padding: 8,
    background: `linear-gradient(180deg, ${t.gold}, ${t.goldBorder})`,
    color: "#fff",
    border: `1px solid ${t.goldBorder}`,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: "0.12em",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    marginBottom: 8,
    transition: "all 0.2s",
  },

  drillBtnDisabled: {
    background: t.barBg,
    color: t.muted,
    cursor: "not-allowed",
    border: `1px solid ${t.borderLight}`,
  },

  drillResults: {
    background: t.tintBg,
    padding: 8,
    border: `1px solid ${t.border}`,
    marginBottom: 8,
  },

  depthChart: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },

  depthRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    height: 16,
  },

  depthRowLabel: {
    width: 26,
    fontSize: 11,
    textAlign: "right",
  },

  depthBarWrap: {
    flex: 1,
    height: 8,
    background: t.barBg,
    position: "relative",
    overflow: "hidden",
  },

  depthRowVal: {
    width: 40,
    fontSize: 11,
    textAlign: "right",
  },

  emptyState: {
    fontSize: 11,
    color: t.muted,
    textAlign: "center",
    padding: "16px 0",
  },

  rankList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  rankRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    padding: "3px 0",
  },

  rankNumber: {
    fontFamily: "'Orbitron', monospace",
    fontWeight: 700,
    fontSize: 11,
  },

  rankClaim: {
    color: t.rankClaim,
    fontSize: 11,
    letterSpacing: "0.06em",
  },

  rankOil: {
    color: t.rankOil,
    fontFamily: "'Orbitron', monospace",
    fontSize: 11,
    textAlign: "right",
  },

  rankBarWrap: {
    gridColumn: "1 / -1",
    height: 2,
    background: t.rankBarBg,
    borderRadius: 1,
    overflow: "hidden",
  },

  rankBarFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${t.goldBorder}, ${t.gold})`,
    borderRadius: 1,
    transition: "width 0.8s ease",
  },

  depositList: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  depositRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    padding: "2px 0",
  },

  depositIndex: {
    color: t.accent,
    fontFamily: "'Orbitron', monospace",
    fontSize: 10,
    opacity: 0.85,
    width: 14,
  },

  depositCoord: {
    color: t.rankClaim,
    fontFamily: "'Share Tech Mono', monospace",
    flex: 1,
  },

  depositRadius: {
    color: t.muted,
    fontSize: 10,
  },

  depositHidden: {
    fontSize: 10,
    color: t.warn,
    letterSpacing: "0.1em",
    background: "rgba(160,80,48,0.1)",
    padding: "1px 4px",
    borderRadius: 2,
  },

  controlBar: {
    height: 70,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderTop: `1px solid ${t.border}`,
    background: `linear-gradient(0deg, ${t.headerBg} 0%, ${t.headerBg} 100%)`,
    backdropFilter: "blur(12px)",
    zIndex: 20,
  },

  btn: {
    padding: "10px 20px",
    background: t.btnBg,
    border: `1px solid ${t.borderLight}`,
    borderRadius: 3,
    color: t.btnText,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "all 0.2s ease",
  },

  btnPrimary: {
    background: t.gold,
    border: `1px solid ${t.goldBorder}`,
    color: "#fff",
    boxShadow: "0 1px 4px rgba(180,140,40,0.2)",
  },

  btnDisabled: {
    opacity: 0.3,
    cursor: "default",
    pointerEvents: "none",
  },

  paramRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  paramLabel: {
    fontSize: 10,
    color: t.muted,
    letterSpacing: "0.15em",
    flexShrink: 0,
    minWidth: 60,
  },

  paramButtons: {
    display: "flex",
    gap: 2,
  },

  paramBtn: {
    padding: "2px 6px",
    background: t.inputBg,
    border: `1px solid ${t.borderLight}`,
    borderRadius: 2,
    color: t.btnText,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    cursor: "pointer",
    transition: "all 0.15s",
  },

  paramBtnActive: {
    background: t.gold,
    border: `1px solid ${t.goldBorder}`,
    color: t.textStrong,
  },
}; }

// ── Mobile-specific styles ──────────────────────────────────
function getMobileStyles(t) { return {
  root: {
    width: "100vw",
    height: "100dvh",
    background: t.panelWash ? `${t.panelWash}, ${t.bg}` : t.bg,
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Share Tech Mono', 'Orbitron', monospace",
    color: t.text,
    display: "flex",
    flexDirection: "column",
  },

  header: {
    height: 48,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    zIndex: 20,
    borderBottom: `1px solid ${t.border}`,
    background: t.panelWash ? `${t.panelLine}, linear-gradient(180deg, ${t.headerBg} 0%, ${t.headerBg} 100%)` : `linear-gradient(180deg, ${t.headerBg} 0%, ${t.headerBg} 100%)`,
    backdropFilter: "blur(12px)",
    boxShadow: t.softShadow || "none",
  },

  scroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))",
    background: t.panelWash || "transparent",
  },

  seedBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    background: t.panelWash ? `${t.panelLine}, ${t.tintBg}` : t.tintBg,
    borderBottom: `1px solid ${t.border}`,
  },

  canvasWrap: {
    position: "relative",
    // Shrunk from 75vh so a non-canvas strip (scroll handle + panel peek) stays
    // visible below the scene on small phones. The 3D canvas captures all touch
    // (OrbitControls), so without a touchable band below it the page can't be
    // scrolled on an iPhone 13. See scrollHandle below.
    height: "56vh",
    minHeight: 240,
    maxHeight: 420,
    borderBottom: `1px solid ${t.border}`,
    transition: "height 0.3s ease, min-height 0.3s ease, max-height 0.3s ease",
  },

  // While the rig editor is open, the scene pins to the top of the scroll as a
  // compact live view, so every customization shows without scrolling back up
  // (and the rig can still be orbited in the strip).
  // (height is set inline from editorSceneHeight())
  canvasCompact: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
  },

  scrollHandle: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 44,
    width: "100%",
    padding: "6px 0",
    border: "none",
    cursor: "pointer",
    background: t.panelWash ? `${t.panelLine}, ${t.tintBg}` : t.tintBg,
    borderBottom: `1px solid ${t.border}`,
    color: t.muted,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    // The canvas eats touch; this strip does not — it's the grab area for scrolling.
    touchAction: "auto",
  },

  scrollHandleGrip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: t.accent || t.muted,
    opacity: 0.5,
  },

  section: panelChrome(t, true).section,
  sectionTitle: panelChrome(t, true).title,

  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
  },

  depositGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
  },

  inlineControls: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: `1px solid ${t.border}`,
    background: t.panelWash ? `${t.panelLine}, ${t.tintBg}` : t.tintBg,
  },

  tabBar: {
    flexShrink: 0,
    display: "flex",
    borderBottom: `1px solid ${t.border}`,
    background: t.panelWash ? `${t.panelLine}, ${t.headerBg}` : t.headerBg,
  },

  tab: {
    flex: 1,
    padding: "11px 0",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: t.muted,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    letterSpacing: "0.12em",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  tabActive: {
    color: t.titleCool || t.accent,
    borderBottom: `2px solid ${t.titleCoolBorder || t.goldBorder}`,
    background: t.btnBg,
  },
}; }
