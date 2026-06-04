"use client";

import { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrbitControls, Cloud, Clouds } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CleanCanvas from "@/components/canvas/CleanCanvas";
import OilVoxelGrid, { CctvRenderer } from "@/components/OilVoxelGrid";
import { generateOilDistribution3D } from "@/lib/oilDistribution";
import PimpMyPumpPanel, { getDefaultPumpConfig } from "@/components/PimpMyPumpPanel";
import HowToPlayPanel from "@/components/HowToPlayPanel";
import OilWelcomeModal from "@/components/OilWelcomeModal";
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

// ── Environment presets ──────────────────────────────────────────────────────
const ENV_PRESETS = {
  day:   { sky: "#7da4c9", skyBottom: null, ambient: 0.6, dirA: 4.0, dirB: 3.0, point: "#4488ff", cloudOpacity: 0.2, fog: null, hemi: null },
  solstice: { sky: "#36aee2", skyBottom: "#aee6c0", ambient: 0.82, dirA: 5.2, dirB: 2.4, dirAColor: "#fff2b8", dirBColor: "#7fd8ff", point: "#ffd45a", cloudOpacity: 0.34, fog: "#d8c86a", hemi: { sky: "#80ddff", ground: "#e6b758", intensity: 0.72 } },
  dusk:  { sky: "#8b7faa", skyBottom: "#d4b8a0", ambient: 0.7, dirA: 4.0,  dirB: 2.0,  point: "#cc9966", cloudOpacity: 0.25, fog: "#c4a88e", hemi: { sky: "#9088aa", ground: "#d4b8a0", intensity: 0.5 } },
  night: { sky: "#0a0e1a", skyBottom: null, ambient: 0.38, dirA: 1.1, dirB: 0.6, dirAColor: "#aac4ff", dirBColor: "#6a80c0", point: "#2244aa", cloudOpacity: 0.08, fog: "#0a0e1a", hemi: { sky: "#2e3650", ground: "#161824", intensity: 0.4 } },
  hell:  { sky: "#1a0808", skyBottom: "#6b1a05", ambient: 0.2, dirA: 0.8, dirB: 0.4, point: "#ff2200", cloudOpacity: 0.4, fog: "#1a0505", hemi: { sky: "#3a0800", ground: "#150000", intensity: 0.35 } },
  // Backdrop for Geode mode — a colorful sunset: deep indigo-blue overhead melting
  // into a warm rose/amber horizon. Lighter than night so the field stays alive,
  // but saturated and dusky enough that the cool frosted-glass Geode panels read as
  // glowing glass rather than muddy brown. Warm key light + cool fill.
  GeodeDusk: { sky: "#1613d7", skyBottom: "#8519d3", ambient: 0.56, dirA: 2.8, dirB: 1.4, dirAColor: "#ffc890", dirBColor: "#88b0e0", point: "#e09060", cloudOpacity: 0.22, fog: "#4a3f55", hemi: { sky: "#5a5a88", ground: "#3a2e3a", intensity: 0.5 } },
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
  // Geode — mirrors the SpaceScene prospecting-Geode palette (the `Geode` constant in
  // SpaceScene.jsx): gold/cyan/orange accents floating on a translucent
  // indigo-black panel. A standalone reskin of the overlay chrome, toggled
  // independently of the day/dark/parabolum controls. Cyan rides on the `green`
  // token (status + positive readouts); orange rides on `warn`.
  Geode: {
    bg: "#0f141c", text: "#aebccb", textStrong: "#e8d9b8", accent: "#d4a854",
    muted: "#7e94a6", border: "rgba(107,199,209,0.24)", borderLight: "rgba(107,199,209,0.14)",
    panelBg: "rgba(15,22,30,0.08)", headerBg: "rgba(13,19,27,0.66)",
    inputBg: "rgba(22,32,42,0.5)", barBg: "rgba(107,199,209,0.12)", tintBg: "rgba(107,199,209,0.06)",
    green: "#6bc7d1", greenBg: "rgba(107,199,209,0.12)",
    warn: "#e87a2b", red: "#e0563c",
    gold: "#d4a854", goldBorder: "#b8922e",
    scanline: "rgba(107,199,209,0.04)",
    statusText: "#6bc7d1", seedLabel: "#7e94a6", seedValue: "#9fc4cf",
    rankClaim: "#8aa0b0", rankOil: "#cbd9e2", rankBarBg: "rgba(107,199,209,0.14)",
    inspectorKey: "#7e94a6", depthUndrilled: "#3a4754",
    btnText: "#bfe0e6", btnBg: "rgba(107,199,209,0.1)",
    cornerBorder: "rgba(107,199,209,0.32)",
    // Cool frosted-glass panel — a cyan-led wash with a gold counterpoint, a
    // cyan/gold accent line, and a cream top-highlight. The low panel opacity
    // lets the sunset bleed through as colored glass, not an opaque brown slab.
    titleCool: "#6bc7d1", titleCoolBorder: "rgba(107,199,209,0.7)",
    panelWash: "linear-gradient(160deg, rgba(107,199,209,0.10) 0%, rgba(170,210,220,0.03) 50%, rgba(212,168,84,0.06) 100%)",
    panelLine: "linear-gradient(90deg, rgba(107,199,209,0.05), rgba(107,199,209,0.40), rgba(212,168,84,0.34), rgba(107,199,209,0.05))",
    statWash: "linear-gradient(150deg, rgba(107,199,209,0.08), rgba(15,22,30,0.16) 55%, rgba(212,168,84,0.05))",
    softShadow: "inset 0 1px 0 rgba(190,224,230,0.10), 0 10px 30px rgba(0,0,0,0.4)",
    // Selection highlight FILL — arcane violet (the cyan border stays via t.green).
    // Used by the surface map + cross-section selected column.
    selectFill: "rgba(176,123,255,0.5)",
    selectOverlay: "rgba(176,123,255,0.22)",
    selectHatch: "rgba(176,123,255,0.45)",
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

// Colored glow hovering just beneath the floating oil-field cube. The cube's
// bottom face sits at local y = -worldH (≈ -10 for the default 20-level grid),
// so this sits a touch below it. Placeholder color for now — placement first.
function FieldUnderglow({ y = -8, color = "#e88409", size = 40, drop = 3, haloSize = 30, haloDrop = 5, haloOpacity = 0.6 }) {
  // Soft radial-gradient sprite (camera-facing) so the glow has feathered edges
  // instead of a hard sphere silhouette. Keeps default depthTest so the cube
  // occludes the upper half and the glow spills out from beneath the field.
  // The light stays just under the field (casting the dusky surface color), but
  // the sprite's bright core is dropped into open space below the cube so the
  // glow reads as light from *below* rather than from within the field; its
  // faint outer falloff still bleeds up to keep the surface dusk.
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const s = 128;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }, []);
  // Bottom-weighted variant for the camera-facing halo: the same radial glow,
  // but its UPPER half is faded to transparent so the halo can be large/bright
  // enough to hold the horizon glow at any orbit angle without its top reaching
  // up to light the grid surface. Decouples horizon brightness from grid reach,
  // which size/drop alone can't. (Canvas top = sprite top.)
  const haloTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const s = 128;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // Cut the top: keep the lower half, ramp the upper half down to nothing.
    ctx.globalCompositeOperation = "destination-in";
    const v = ctx.createLinearGradient(0, 0, 0, s);
    v.addColorStop(0, "rgba(0,0,0,0)");      // top edge — fully removed
    v.addColorStop(0.5, "rgba(0,0,0,0.12)"); // around the core — mostly removed
    v.addColorStop(1, "rgba(0,0,0,1)");      // bottom — kept
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <group position={[0, y, 0]}>
      {/* Horizontal ground-glow disc (lies flat in the XZ plane) rather than a
          camera-facing vertical sprite. A vertical quad's plane cuts up through
          the cube, and depthTest clips it into a hard occlusion seam that slides
          across the cube as you orbit (the "shadow"). A flat disc sits just
          under the cube: the cube cleanly occludes the part directly beneath it
          and the rim spills out around the base as the horizon glow — no seam.
          Stays depthTest'd, so it also avoids the iOS additive-CanvasTexture
          blocky-rectangle artifact. */}
      <mesh position={[0, -drop, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[size / 2, 48]} />
        <meshBasicMaterial
          map={texture}
          color={color}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Camera-facing halo: keeps the horizon glow alive at low orbit angles,
          where the flat disc projects edge-on and nearly vanishes. Kept small
          and dropped LOW so its top edge tucks under the cube's bottom — it
          spills out and down into the sky as the horizon rim but never rises in
          front of the grid surface, so it doesn't re-introduce the extra-light
          bleed onto the grid that the vertical sprite alone caused. Tune:
          smaller haloSize / larger haloDrop = less grid reach; larger haloSize /
          haloOpacity = more horizon glow. */}
      <sprite position={[0, -haloDrop, 0]} scale={[haloSize, haloSize, 1]}>
        <spriteMaterial
          map={texture}
          color={color}
          transparent
          opacity={haloOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {/* No pointLight: an omni light here under-lit the tall water tower and
          threw an uneven hotspot on the grid ground at certain angles. The
          additive disc + halo are unlit and carry the glow without shading any
          geometry. */}
    </group>
  );
}

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
        <Clouds material={THREE.MeshLambertMaterial}>
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
        <Clouds material={THREE.MeshBasicMaterial}>
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
const OilVerifyExplainer = dynamic(() => import("@/components/OilVerifyExplainer"), { ssr: false });
const OilPlotChat = dynamic(() => import("@/components/OilPlotChat"), { ssr: false });
const CoreSamplePanel = dynamic(() => import("@/components/CoreSamplePanel"), { ssr: false });
const DrillGeode = dynamic(() => import("@/components/DrillGeode"), { ssr: false });
const OilChatModal = dynamic(() => import("@/components/OilChatModal"), { ssr: false });
const OilQualify = dynamic(() => import("@/components/OilQualify"), { ssr: false });
// OilPlotDraft removed — plot picking now merged into OilQualify

const DEFAULT_BLOCK_HASH =
  "0x8a3f7b2c91d4e6f5a0b3c8d7e2f1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0";

const DEPTH_Z = 20;
const CELL_SIZE = 1;
const TANK_CAPACITY = 5;
const PASSIVE_DRILLS = 10;
const MAX_BONUS_DRILLS = 10;
const MAX_DEPTH = 20;
const FREE_CLAIM_JUMPS = 2;
// A loose demon is transient — bounties older than this are stale/orphaned and
// get auto-expired client-side (must match BOUNTY_TTL_MS in the API route).
const DEMON_BOUNTY_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Continuous orbit exactly like the Three.js horse example. Stops when user interacts.
function CameraFlyIn({ onComplete, mobile = false }) {
  const { camera, gl } = useThree();
  const elapsed = useRef(0);
  const done = useRef(false);

  // Stop on any user interaction
  useEffect(() => {
    const canvas = gl.domElement;
    const stop = () => {
      if (!done.current) {
        done.current = true;
        onComplete();
      }
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

    elapsed.current += delta;
    const time = elapsed.current;

    if (mobile) {
      // Mobile: closer orbit among the rigs, like the Three.js horse example
      const r = 4;
      camera.position.set(
        Math.sin(time / 10) * r,
        3 + 0.8 * Math.cos(time / 5),
        Math.cos(time / 10) * r,
      );
      camera.lookAt(0, 2, 0);
    } else {
      // Desktop: wider establishing shot
      const r = 8;
      camera.position.set(
        Math.sin(time / 10) * r,
        7 + 1.5 * Math.cos(time / 5),
        Math.cos(time / 10) * r,
      );
      camera.lookAt(0, 5, 0);
    }
  });

  return null;
}

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
        // Save and temporarily lower minDistance
        if (savedMinDist.current === null) savedMinDist.current = controls.minDistance;
        controls.minDistance = 0.3;

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
        } else if (target.overview) {
          // Zoom out to overview
          endTarget.current.set(0, target.mobile ? 2 : 5, 0);
          endPos.current.set(target.x, target.y, target.z);
        } else if (target.mobile) {
          // Mobile: close view of the rig, lifted to look DOWN at it (~30°).
          // A level pose (camera y == target y) grazes the ground plane and
          // washes the rig in a warm haze (and blows out the metal's env
          // reflection); the downward tilt breaks that grazing angle.
          endTarget.current.set(target.x, target.y - 0.15, target.z + 0.1);
          endPos.current.set(target.x + 0.5, target.y + 0.22, target.z + 0.41);
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

    progressRef.current = Math.min(1, progressRef.current + delta * 1.2);
    const t = 1 - Math.pow(1 - progressRef.current, 3);

    camera.position.lerpVectors(startPos.current, endPos.current, t);
    controls.target.lerpVectors(startTarget.current, endTarget.current, t);
    controls.update();

    if (progressRef.current >= 1) {
      flyingRef.current = false;
      // Restore minDistance after zoom-out
      if ((target?.overview || target?.skyView || target?.restoreView) && savedMinDist.current !== null) {
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

function useClaimStats(blockHash, numberOfDeposits, totalOilBudget, gridX, gridY) {
  return useMemo(() => {
    const { grid, deposits, maxOil, hellPockets } = generateOilDistribution3D({
      blockHash,
      gridX,
      gridY,
      depthZ: DEPTH_Z,
      totalOilBudget,
      numberOfDeposits,
      depthBias: 0.35,
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
  }, [blockHash, numberOfDeposits, totalOilBudget, gridX, gridY]);
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

export default function OilPage() {
  const isMobile = useIsMobile();

  // Read mode from URL search params (avoids useSearchParams / Suspense issues)
  const [mode, setMode] = useState("active");
  const [previewMode, setPreviewMode] = useState(false);
  // Ref mirror of previewMode so write-handler gates aren't fooled by a
  // stale useCallback closure (handlers don't need previewMode in their deps).
  const previewModeRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get("mode") || "active");
    const preview = params.get("preview") === "1";
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
    }
    return "day";
  });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("oil_darkMode") === "true";
    }
    return false;
  });
  // Parabolum material theme — independent of the day/dusk/night env presets.
  // When on, the UI shifts to the arcane violet console AND the extracted fluid
  // glows violet in the 3D scene (threaded into OilVoxelGrid below).
  const [parabolum, setParabolum] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("oil_parabolum") === "true";
    }
    return false;
  });
  // Geode overlay reskin — gold/cyan/orange-on-dark prospecting console (mirrors
  // the SpaceScene Geode). The translucent panels need a dark backdrop to read as
  // glowing glass, so Geode mode also swaps the 3D scene to a deep, cool dusk
  // (not full night — that's too dark). Toggling Geode off restores the user's
  // chosen scene. Mutually exclusive with parabolum (the toggles clear each other).
  const [GeodeMode, setGeodeMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("oil_GeodeMode") === "true";
    }
    return false;
  });
  // Active scene lighting: Geode forces the dusk backdrop and Parabolum forces its
  // own violet-lit scene (both are self-contained themed looks, independent of
  // the day/dusk/night presets); otherwise the user's selected time-of-day.
  const env = ENV_PRESETS[GeodeMode ? "GeodeDusk" : parabolum ? "parabolumEnv" : envPreset];
  // Don't persist the transient "hell" preset — otherwise a reload during a
  // demon event restores hell forever. Keep the last real preset saved instead.
  useEffect(() => {
    if (envPreset !== "hell") localStorage.setItem("oil_envPreset", envPreset);
  }, [envPreset]);
  useEffect(() => { localStorage.setItem("oil_darkMode", String(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem("oil_parabolum", String(parabolum)); }, [parabolum]);
  useEffect(() => { localStorage.setItem("oil_GeodeMode", String(GeodeMode)); }, [GeodeMode]);
  // Parabolum overrides light/dark for the UI chrome when active, but still
  // Parabolum is a self-contained dark violet look (its own violet scene), so it
  // always uses the dark console — there's no Parabolum "day" variant.
  const themeKey = GeodeMode
    ? "Geode"
    : parabolum
      ? "parabolumDark"
      : envPreset === "solstice"
        ? "solsticeLight"
        : (darkMode ? "dark" : "light");
  const theme = THEMES[themeKey];
  // Effective dark flag for the child overlay panels (CoreSamplePanel, How-To,
  // inspector, etc.). Geode, Parabolum, and dark mode are all dark aesthetics, so
  // their panels render dark even when the day/night toggle is on "day".
  const uiDark = darkMode || GeodeMode || parabolum;
  const styles = useMemo(() => getStyles(theme), [theme]);
  const m = useMemo(() => getMobileStyles(theme), [theme]);
  const drillBtnStyles = useMemo(() => getDrillStyles(theme), [theme]);
  const isTest = mode === "test";
  const [testDay, setTestDay] = useState(0);
  const { user } = useUser();
  const clerk = useClerk();
  const { walletAddress, tokenBalance, isWalletConnected } = useWalletAuth();
  const { play, pause, isPlaying: contextIsPlaying, nextTrack } = useMusic();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
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
  const [gameDay, setGameDay] = useState(1);
  const [gameStartDate, setGameStartDate] = useState(null);

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

  // Redirect report mode to active if game hasn't ended
  useEffect(() => {
    if (isReport && !gameEnded) {
      window.location.replace("/oil");
    }
  }, [isReport, gameEnded]);

  const [revealProgress, setRevealProgress] = useState(0);
  const [animateReveal, setAnimateReveal] = useState(false);
  const [blockHash, setBlockHash] = useState(DEFAULT_BLOCK_HASH);
  const [isRevealed, setIsRevealed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [numberOfDeposits, setNumberOfDeposits] = useState(5);
  const [totalOilBudget, setTotalOilBudget] = useState(500);
  const [gridSize, setGridSize] = useState(10);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showMainTankInfo, setShowMainTankInfo] = useState(false);

  // ── Firestore game settings sync ──
  // Subscribe to oilGame/settings — all modes get live updates
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "oilGame", "settings"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.blockHash) setBlockHash(d.blockHash);
        if (d.numberOfDeposits) setNumberOfDeposits(d.numberOfDeposits);
        if (d.totalOilBudget) setTotalOilBudget(d.totalOilBudget);
        if (typeof d.gameEnded === "boolean") setGameEnded(d.gameEnded);
        if (typeof d.gameDay === "number") setGameDay(d.gameDay);
        if (typeof d.gridSize === "number") setGridSize(d.gridSize);
        if (d.gamePhase) setGamePhase(d.gamePhase);
        if (d.gameStartDate) setGameStartDate(d.gameStartDate);
      }
      setSettingsLoaded(true);
    });
    return () => unsub();
  }, []);

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

  const leaderboardData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const totalDrillers = allDrillers.length;
    const drilledTodayCount = allDrillers.filter((d) => d.lastDrillDate === today).length;
    const topCollectors = [...allDrillers]
      .sort((a, b) => (b.totalCollected || 0) - (a.totalCollected || 0))
      .slice(0, 10);
    const topToday = allDrillers
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
  const gameSettingsRef = useRef({ blockHash, numberOfDeposits, totalOilBudget, gridSize, gamePhase, gameEnded, gameDay, gameStartDate });
  gameSettingsRef.current = { blockHash, numberOfDeposits, totalOilBudget, gridSize, gamePhase, gameEnded, gameDay, gameStartDate };
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

  // Reset snapshot trigger after timeout (fallback if user dismisses without onComplete)
  useEffect(() => {
    if (snapshotTrigger) {
      const t = setTimeout(() => setSnapshotTrigger(false), 5000);
      return () => clearTimeout(t);
    }
  }, [snapshotTrigger]);

  // Review day scrub (player mode only): null = live, number = reviewing history
  const [reviewDay, setReviewDay] = useState(null);

  // Demo drill day
  const [demoDay, setDemoDay] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  // Admin: manual gusher test — increments to fire the full 3D oil-release effect
  // on the selected rig on demand (independent of drill depth / oil data).
  const [gusherTest, setGusherTest] = useState(0);

  // ── Daily Drill (player mode) ──
  const [userDrill, setUserDrill] = useState(null); // { col, row, drillDay, lastDrillDate }
  // drillCountdown state removed — now handled by isolated DrillCountdown component

  // Load user drill state from Firestore
  useEffect(() => {
    if (!user?.id || !db) return;
    const unsub = onSnapshot(doc(db, "oilDrills", user.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setUserDrill({ col: d.col, row: d.row, drillDay: d.drillDay, lastDrillDate: d.lastDrillDate, totalCollected: d.totalCollected || 0, tankDrains: d.tankDrains || 0, lastDrainExtracted: d.lastDrainExtracted || 0, bonusDrills: d.bonusDrills || 0, referralCode: d.referralCode || null, confirmedReferrals: d.confirmedReferrals || 0, claimJumpsUsed: d.claimJumpsUsed || 0, tankOil: d.tankOil, lastStrikeAt: d.lastStrikeAt || null, lastStrikeOil: d.lastStrikeOil ?? null, lastStrikeDepth: d.lastStrikeDepth ?? null, lastStrikeHell: d.lastStrikeHell || false, armed: d.armed, rigDepleted: d.rigDepleted || false });
        if (d.username) setUsername(d.username);
      } else {
        setUserDrill(null);
      }
    });
    return () => unsub();
  }, [user?.id]);

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
    if (!user?.id || !db || !username.trim() || !userDrill) return;
    setUsernameSaving(true);
    try {
      await setDoc(doc(db, "oilDrills", user.id), { username: username.trim(), updatedAt: serverTimestamp() }, { merge: true });
      setUsernameSaved(true);
    } catch (err) {
      console.error("Failed to save username:", err);
    } finally {
      setUsernameSaving(false);
    }
  }, [user?.id, username, userDrill]);

  // Reset the "SAVED" confirmation once the name is edited again.
  useEffect(() => { setUsernameSaved(false); }, [username]);

  // Countdown timer to next 00:00 UTC
  // Countdown timer moved to isolated DrillCountdown component to avoid full-page re-renders

  const todayUTC = new Date().toISOString().slice(0, 10);

  // ── Passive depth computation (time-based, no clicking) ──
  const passiveDepth = useMemo(() => {
    if (!gameStartDate) return 0;
    const start = new Date(gameStartDate + "T00:00:00Z");
    const now = new Date();
    const days = Math.floor((now - start) / 86400000);
    return Math.min(Math.max(days, 0), PASSIVE_DRILLS);
  }, [gameStartDate, todayUTC]);

  const bonusDrills = userDrill?.bonusDrills ?? 0;
  const playerDepth = Math.min(passiveDepth + bonusDrills, MAX_DEPTH);

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

  // Drill status — click-to-drill, but ceiling is time-gated (passiveDepth + bonusDrills)
  const drillStatus = useMemo(() => {
    if (!user && !isTest) return "sign-in";
    if (isSummonerStunned) return "stunned";
    if (isBlockadeActive) return "blockade";
    if (gamePhase === "ticket_sale") return "pre-game";
    if (selectedX === null && userDrill?.col != null) return "wrong-claim";
    if (selectedX === null) return "no-claim";
    if (userDrill && (userDrill.col !== selectedX || userDrill.row !== sliceY)) return "wrong-claim";
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
  const controlsRef = useRef();
  const controlsRefMobile = useRef();

  const stats = useClaimStats(blockHash, numberOfDeposits, totalOilBudget, gridSize, gridSize);

  // In active game mode, hide oil data from 2D views
  const showOilData = isAdmin || isReport;

  // Community-visible grid: reveals oil data at every plot up to its drilled depth
  const communityGrid3D = useMemo(() => {
    if (showOilData) return stats.grid3D;
    const g = [];
    for (let x = 0; x < gridSize; x++) {
      g[x] = [];
      for (let y = 0; y < gridSize; y++) {
        const plotKey = `${x}_${y}`;
        const plotDepth = allPlotsMap[plotKey]?.drillDay ?? 0;
        const row = new Array(DEPTH_Z).fill(0);
        for (let z = 0; z < Math.min(plotDepth, DEPTH_Z); z++) {
          row[z] = stats.grid3D[x]?.[y]?.[z] ?? 0;
        }
        g[x][y] = row;
      }
    }
    return g;
  }, [showOilData, stats.grid3D, allPlotsMap, gridSize]);

  const communityClaimTotals = useMemo(() => {
    if (showOilData) return stats.claimTotals;
    return stats.claimTotals.map((c) => {
      const plotKey = `${c.x}_${c.y}`;
      const plotDepth = allPlotsMap[plotKey]?.drillDay ?? 0;
      let sum = 0;
      for (let z = 0; z < Math.min(plotDepth, DEPTH_Z); z++) {
        sum += stats.grid3D[c.x]?.[c.y]?.[z] ?? 0;
      }
      return { ...c, oil: sum, total: sum };
    });
  }, [showOilData, stats.claimTotals, stats.grid3D, allPlotsMap]);

  const communityMaxOil = useMemo(() => {
    let max = 0;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < DEPTH_Z; z++) {
          if (communityGrid3D[x]?.[y]?.[z] > max) max = communityGrid3D[x][y][z];
        }
      }
    }
    return max;
  }, [communityGrid3D, gridSize]);

  // Player extracted oil total
  const playerExtracted = useMemo(() => {
    if (!activeUserDrill || effectiveDrillDay === 0) return 0;
    let total = 0;
    for (let z = 0; z < Math.min(effectiveDrillDay, DEPTH_Z); z++) {
      total += stats.grid3D[activeUserDrill.col]?.[activeUserDrill.row]?.[z] ?? 0;
    }
    return total;
  }, [activeUserDrill, effectiveDrillDay, stats.grid3D]);

  const hitRate = stats.claimTotals.length > 0
    ? Math.round(((gridSize * gridSize - stats.dryClaims) / (gridSize * gridSize)) * 100)
    : 0;

  const selectedClaimIndex = selectedX !== null ? sliceY * gridSize + selectedX : null;
  // Cross-section highlight column: the active selection, or fall back to the
  // player's own claim column so it always marks the same column the surface map
  // emphasizes (the isMine plot) even when nothing is actively selected.
  const xsecCol = selectedX !== null ? selectedX : (userDrill?.col ?? myPlot?.col ?? null);

  // Session-local drain tracking (declared early — used by hell pocket detection)
  const [tankDrained, setTankDrained] = useState(false);
  const [lastDrainSnapshot, setLastDrainSnapshot] = useState(0);

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

  // Reactive hell pocket detection — fires the API for real players, or local-only for admin/test
  const lastHellCheckRef = useRef(null);
  const hellApiCalledRef = useRef(false);
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
      if (stats.hellMap[hellKey] && !hellActive) {
        if (user?.id && !isAdmin && !isTest && !hellApiCalledRef.current) {
          // Real player — call the API to create a demon bounty event
          hellApiCalledRef.current = true;
          const unbankedOil = userDrill?.tankOil != null
            ? Math.max(0, userDrill.tankOil)
            : Math.max(0, playerExtracted - (lastDrainSnapshot || 0));
          fetch("/api/oil-demon-bounty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              username: username?.trim() || user?.firstName || "Anonymous",
              col,
              row,
              unbankedOil,
            }),
          }).then(r => r.json()).then(data => {
            if (data.ok) {
              // Visuals will be driven by the Firestore listener
              console.log("[HELL] Demon bounty created:", data.bountyId);
            }
            hellApiCalledRef.current = false;
          }).catch(err => {
            console.error("[HELL] API call failed:", err);
            hellApiCalledRef.current = false;
          });
        } else {
          // Admin/test mode — local-only visual effects
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
  }, [selectedX, sliceY, effectiveDrillDay, userDrill, stats.hellMap, hellActive, envPreset, user?.id, isAdmin, isTest, playerExtracted, lastDrainSnapshot, username]);

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
    // Real players use the strike loop's authoritative tankOil. Admin/test/report
    // run on demoDay/testDay-driven extraction (no live loop), so derive there.
    if (!isAdmin && !isTest && !isReport && userDrill?.tankOil != null) {
      return Math.max(0, userDrill.tankOil);
    }
    if (playerExtracted === 0) return 0;
    return Math.max(0, playerExtracted - lastDrainSnapshot);
  }, [isAdmin, isTest, isReport, userDrill?.tankOil, playerExtracted, lastDrainSnapshot]);

  // Tank fill: fraction of oil in tank relative to capacity (100K tokens)
  // Can exceed 1.0 — gusher fires when it first crosses 1.0
  const tankFill = useMemo(() => {
    if (selectedX === null || effectiveDrillDay === 0) return 0;
    return oilInTank / TANK_CAPACITY;
  }, [selectedX, effectiveDrillDay, oilInTank]);

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

  const selectedDepthData = useMemo(() => {
    if (selectedX === null || sliceY == null || !stats.grid3D[selectedX]?.[sliceY]) return null;
    const col = [];
    for (let z = 0; z < DEPTH_Z; z++) col.push(stats.grid3D[selectedX][sliceY][z]);
    return col;
  }, [stats.grid3D, selectedX, sliceY]);

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
    const oilAtDepth = stats.grid3D[selectedX]?.[sliceY]?.[depthIndex] ?? 0;
    if (oilAtDepth > 0 && effectiveDrillDay !== oilStrikeDay.current) {
      oilStrikeDay.current = effectiveDrillDay;
      return effectiveDrillDay; // unique trigger value per strike
    }
    return 0;
  }, [selectedX, sliceY, effectiveDrillDay, stats.grid3D]);

  const drilledOilValue = useMemo(() => {
    if (selectedX === null || effectiveDrillDay === 0) return 0;
    const depthIndex = effectiveDrillDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    return stats.grid3D[selectedX]?.[sliceY]?.[depthIndex] ?? 0;
  }, [selectedX, sliceY, effectiveDrillDay, stats.grid3D]);

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
    const grid = stats.grid3D;
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
  }, [selectedX, sliceY, effectiveDrillDay, stats.grid3D, gridSize]);

  // Hell proximity — is a hell pocket lurking in the 3x3x3 neighborhood? Returns a
  // 0..1 "heat" intensity that feeds the area-scan thermal/sulfurous hint. Closer
  // (face-adjacent) reads hotter than a corner, but it intentionally does NOT encode
  // WHICH direction the pocket is — so the scan warns "something's near" without
  // handing the player the exact cell.
  const hellProximity = useMemo(() => {
    if (selectedX === null || sliceY === null || effectiveDrillDay === 0) return 0;
    const depthIndex = effectiveDrillDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    const hm = stats.hellMap;
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
  }, [selectedX, sliceY, effectiveDrillDay, stats.hellMap, gridSize]);

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

  const handleApplyHash = useCallback((hash) => {
    setBlockHash(hash);
    setAnimateReveal(false);
    setRevealProgress(0);
    setIsRevealed(false);
    setSelectedX(null);
    setDrillDepth(0);
    saveGameSettings({ blockHash: hash });
  }, [saveGameSettings]);

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

  const handleSelectX = useCallback((x) => {
    setSelectedX(x);
    setDrillDepth(0);
  }, []);

  const handleSliceY = useCallback((y) => {
    setSliceY(y);
    setDrillDepth(0);
  }, []);

  const flyIdRef = useRef(0);
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

  // On mobile, open the page focused on the player's own rig (if they hold a
  // claimed plot) instead of the aerial intro orbit. Fires once, only before
  // the player has interacted — later navigation / zoom-out is left untouched.
  // Sources the plot the same way the auto-select does (userDrill.col is often
  // stale/null; oilPlots ownership via myPlot is the reliable fallback).
  const didMobileRigFocus = useRef(false);
  useEffect(() => {
    if (didMobileRigFocus.current) return;
    if (!isMobile || introComplete) return;
    const col = userDrill?.col ?? myPlot?.col;
    const row = userDrill?.row ?? myPlot?.row;
    if (col == null) return;
    didMobileRigFocus.current = true;
    handleFlyTo(col, row ?? 0);
    setIntroComplete(true);
  }, [isMobile, introComplete, userDrill, myPlot, handleFlyTo]);

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
    const oilAtDepth = stats.grid3D[col]?.[row]?.[nextCellDepth - 1] ?? 0;
    setUserDrill((prev) => prev ? { ...prev, drillDay: nextCellDepth, tankOil: (prev.tankOil || 0) + oilAtDepth, lastStrikeOil: oilAtDepth, lastStrikeDepth: nextCellDepth } : prev);
    try {
      // Update oilPlots (cell depth)
      await setDoc(doc(db, "oilPlots", plotKey), {
        drillDay: nextCellDepth,
      }, { merge: true });
      // Update oilDrills
      await setDoc(doc(db, "oilDrills", user.id), {
        userId: user.id,
        col,
        row,
        ...(username.trim() ? { username: username.trim() } : {}),
        tankOil: increment(oilAtDepth),
        lastStrikeOil: oilAtDepth,
        lastStrikeDepth: nextCellDepth,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Broadcast gusher event if oil exists at this depth
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
    if (!user?.id || !db || !userDrill) return;
    const targetKey = `${newCol}_${newRow}`;
    const targetPlot = allPlotsMap[targetKey];
    // Target must be unclaimed
    if (targetPlot?.currentOwnerId != null) return;
    const jumpsUsed = userDrill.claimJumpsUsed ?? 0;
    const currentBonusDrills = userDrill.bonusDrills ?? 0;
    const isFree = jumpsUsed < FREE_CLAIM_JUMPS;
    // If not free, must have bonus drills available
    if (!isFree && currentBonusDrills <= 0) return;
    const oldCol = userDrill.col;
    const oldRow = userDrill.row;
    const oldKey = `${oldCol}_${oldRow}`;
    try {
      await runTransaction(db, async (transaction) => {
        // Re-check target is still unclaimed
        const targetRef = doc(db, "oilPlots", targetKey);
        const targetSnap = await transaction.get(targetRef);
        if (targetSnap.exists() && targetSnap.data().currentOwnerId != null) {
          throw new Error("Plot already claimed");
        }
        // Release old plot
        const oldRef = doc(db, "oilPlots", oldKey);
        transaction.update(oldRef, {
          currentOwnerId: null,
          ownerHistory: arrayUnion({ userId: user.id, releasedAt: new Date().toISOString(), reason: "claim_jump" }),
        });
        // Claim new plot
        transaction.set(targetRef, {
          col: newCol,
          row: newRow,
          drillDay: targetSnap.exists() ? (targetSnap.data().drillDay ?? 0) : 0,
          currentOwnerId: user.id,
          ownerHistory: arrayUnion({ userId: user.id, claimedAt: new Date().toISOString() }),
          disqualified: false,
          lastDrillDate: targetSnap.exists() ? (targetSnap.data().lastDrillDate ?? null) : null,
        }, { merge: true });
        // Update oilDrills
        const newJumps = jumpsUsed + 1;
        const newBonus = isFree ? currentBonusDrills : Math.max(0, currentBonusDrills - 1);
        const drillRef = doc(db, "oilDrills", user.id);
        transaction.update(drillRef, {
          col: newCol,
          row: newRow,
          claimJumpsUsed: newJumps,
          bonusDrills: newBonus,
          // Re-arm the rig at the fresh cell — otherwise a rig that bottomed out
          // at its old plot would stay depleted and the strike loop would skip it.
          armed: true,
          rigDepleted: false,
          updatedAt: serverTimestamp(),
        });
        // Update oilQualified
        const qualRef = doc(db, "oilQualified", user.id);
        transaction.update(qualRef, {
          plotCol: newCol,
          plotRow: newRow,
        });
      });
      // Carry the player's pump customization to the new cell. Configs are stored
      // per-cell (pumpConfigs/{userId}_{col}_{row}) while unlocks are account-level —
      // so without this a jump lands on a default pump even though you own everything.
      try {
        const oldCfgRef = doc(db, "pumpConfigs", `${user.id}_${oldCol}_${oldRow}`);
        const oldCfgSnap = await getDoc(oldCfgRef);
        if (oldCfgSnap.exists() && oldCfgSnap.data().config) {
          await setDoc(doc(db, "pumpConfigs", `${user.id}_${newCol}_${newRow}`), {
            userId: user.id,
            col: newCol,
            row: newRow,
            config: oldCfgSnap.data().config,
            updatedAt: serverTimestamp(),
          });
          // Strip the released plot back to a default pump so leftover add-ons
          // don't make it look owned/unavailable to other players.
          await deleteDoc(oldCfgRef);
        }
      } catch (e) {
        console.error("Failed to carry pump config on claim jump:", e);
      }
      // Explicit confirmation that the jump landed (coords shown as the on-screen label).
      setClaimToast({ col: newCol, row: newRow });
      if (claimToastTimer.current) clearTimeout(claimToastTimer.current);
      claimToastTimer.current = setTimeout(() => setClaimToast(null), 5000);
      setClaimJumpMode(false);
      handleFlyTo(newCol, newRow);
    } catch (err) {
      console.error("Claim jump failed:", err);
    }
  }, [user?.id, userDrill, allPlotsMap, handleFlyTo]);

  // ── Transfer Plot handler ──
  const handleTransferPlot = useCallback(async (recipientUsername, transferUpgrades) => {
    if (previewModeRef.current) return { error: "Preview mode — sign up to play" };
    if (!user?.id || !db || !userDrill || userDrill.col == null) {
      return { error: "You don't own a plot to transfer" };
    }
    const trimmed = recipientUsername?.trim();
    if (!trimmed) return { error: "Enter a username" };

    // Find recipient by username in oilDrills
    const drillsQ = query(collection(db, "oilDrills"), where("username", "==", trimmed));
    const drillsSnap = await getDocs(drillsQ);
    if (drillsSnap.empty) return { error: "User not found" };

    const recipientDrillDoc = drillsSnap.docs[0];
    const recipientId = recipientDrillDoc.data().userId || recipientDrillDoc.id;

    if (recipientId === user.id) return { error: "Cannot transfer to yourself" };

    // Check qualification
    const qualSnap = await getDoc(doc(db, "oilQualified", recipientId));
    if (!qualSnap.exists() || !qualSnap.data().qualified) {
      return { error: "User not qualified" };
    }

    const senderCol = userDrill.col;
    const senderRow = userDrill.row;
    const senderKey = `${senderCol}_${senderRow}`;

    try {
      await runTransaction(db, async (transaction) => {
        // Re-verify qualification inside transaction
        const qualRef = doc(db, "oilQualified", recipientId);
        const qualCheck = await transaction.get(qualRef);
        if (!qualCheck.exists() || !qualCheck.data().qualified) {
          throw new Error("User not qualified");
        }

        // Check if recipient already has a plot
        const recipientDrillRef = doc(db, "oilDrills", recipientId);
        const recipientDrill = await transaction.get(recipientDrillRef);
        const recipientData = recipientDrill.exists() ? recipientDrill.data() : null;

        // If recipient owns a different plot, release it
        if (recipientData?.col != null && recipientData?.row != null) {
          const recipientOldKey = `${recipientData.col}_${recipientData.row}`;
          if (recipientOldKey !== senderKey) {
            const recipientOldPlotRef = doc(db, "oilPlots", recipientOldKey);
            transaction.update(recipientOldPlotRef, {
              currentOwnerId: null,
              ownerHistory: arrayUnion({ userId: recipientId, releasedAt: new Date().toISOString(), reason: "transfer_received_new" }),
            });
          }
        }

        // Release sender's plot ownership
        const senderPlotRef = doc(db, "oilPlots", senderKey);
        transaction.update(senderPlotRef, {
          currentOwnerId: null,
          ownerHistory: arrayUnion({ userId: user.id, releasedAt: new Date().toISOString(), reason: "transfer_out" }),
        });

        // Assign plot to recipient
        transaction.set(senderPlotRef, {
          col: senderCol,
          row: senderRow,
          currentOwnerId: recipientId,
          ownerHistory: arrayUnion({ userId: recipientId, claimedAt: new Date().toISOString(), reason: "transfer_in" }),
          disqualified: false,
        }, { merge: true });

        // Update recipient's oilDrills
        transaction.update(recipientDrillRef, {
          col: senderCol,
          row: senderRow,
          updatedAt: serverTimestamp(),
        });

        // Update recipient's oilQualified
        transaction.update(qualRef, {
          plotCol: senderCol,
          plotRow: senderRow,
        });

        // Transfer premium upgrades if opted in
        if (transferUpgrades) {
          const senderPurchRef = doc(db, "oilPurchases", user.id);
          const recipientPurchRef = doc(db, "oilPurchases", recipientId);
          const senderPurchSnap = await transaction.get(senderPurchRef);
          const recipientPurchSnap = await transaction.get(recipientPurchRef);

          const senderUnlocked = senderPurchSnap.exists() ? (senderPurchSnap.data().unlocked || {}) : {};
          const recipientUnlocked = recipientPurchSnap.exists() ? (recipientPurchSnap.data().unlocked || {}) : {};

          if (Object.keys(senderUnlocked).length > 0) {
            const mergedUnlocked = { ...recipientUnlocked, ...senderUnlocked };
            transaction.set(recipientPurchRef, { unlocked: mergedUnlocked }, { merge: true });
            // Clear all unlocked keys from sender
            const clearedUnlocked = {};
            const { deleteField } = await import("firebase/firestore");
            for (const key of Object.keys(senderUnlocked)) clearedUnlocked[`unlocked.${key}`] = deleteField();
            transaction.update(senderPurchRef, clearedUnlocked);
          }
        }

        // Clear sender's oilDrills
        const senderDrillRef = doc(db, "oilDrills", user.id);
        transaction.update(senderDrillRef, {
          col: null,
          row: null,
          updatedAt: serverTimestamp(),
        });

        // Clear sender's oilQualified
        const senderQualRef = doc(db, "oilQualified", user.id);
        transaction.update(senderQualRef, {
          plotCol: null,
          plotRow: null,
        });
      });

      return { success: true };
    } catch (err) {
      console.error("Transfer failed:", err);
      return { error: err.message || "Transfer failed" };
    }
  }, [user?.id, userDrill]);

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
        const res = await fetch("/api/oil-tank-drain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            playerExtracted,
            username: username?.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}));
          throw new Error(error || `HTTP ${res.status}`);
        }
      } catch (err) {
        console.error("Failed to save tank drain:", err);
      }
    }
  }, [user?.id, userDrill, oilInTank, playerExtracted, username, myGusherActive]);

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
      const res = await fetch("/api/oil-demon-bounty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: demonBounty.id,
          hunterId: user.id,
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
  }, [demonBounty?.id, user?.id, username]);

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

  // Mistimed click on the roaming demon → it dodges away; flash a taunt.
  const [demonTaunt, setDemonTaunt] = useState(false);
  const demonTauntTimer = useRef(null);
  const handleDemonMiss = useCallback(() => {
    setDemonTaunt(true);
    if (demonTauntTimer.current) clearTimeout(demonTauntTimer.current);
    demonTauntTimer.current = setTimeout(() => setDemonTaunt(false), 1500);
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
          {[1, 2, 3, 5, 8, 12, 16].map((n) => (
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
        <span style={styles.paramLabel}>OIL BUDGET</span>
        <div style={styles.paramButtons}>
          {[100, 250, 500, 1000].map((n) => (
            <button
              key={n}
              onClick={() => { setTotalOilBudget(n); handleReset(); saveGameSettings({ totalOilBudget: n }); }}
              style={{
                ...styles.paramBtn,
                ...(totalOilBudget === n ? styles.paramBtnActive : {}),
              }}
            >
              {`${n / 1_000_000}M`}
            </button>
          ))}
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
        <span style={styles.paramLabel}>MAX CLAIM</span>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: theme.accent,
        }}>
          {stats.maxClaimTotal} USDC
        </span>
      </div>
      <div style={{ marginTop: 4, fontSize: 9, color: theme.muted, lineHeight: 1.6 }}>
        {stats.sorted.slice(0, 5).map((c, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>#{i + 1} ({c.x},{c.y})</span>
            <span style={{ color: c.oil > 0 ? theme.textStrong : theme.muted }}>{c.oil} USDC</span>
          </div>
        ))}
      </div>
      <div style={{ ...styles.paramRow, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.border}` }}>
        <span style={{ ...styles.paramLabel, color: "#cc3333" }}>HELL POCKETS</span>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: "#cc3333",
        }}>
          {stats.hellPockets.length}
        </span>
      </div>
      <div style={{ marginTop: 2, fontSize: 9, color: "#cc3333", lineHeight: 1.6 }}>
        {stats.hellPockets.map((hp, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>#{i + 1} plot ({hp.x + 1},{hp.y + 1})</span>
            <span>depth {hp.z + 1}</span>
          </div>
        ))}
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
      <div style={{ ...styles.paramRow, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.border}` }}>
        <span style={styles.paramLabel}>GAME DAY</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => { const d = Math.max(1, gameDay - 1); setGameDay(d); saveGameSettings({ gameDay: d }); }}
            style={{ ...styles.paramBtn, padding: "2px 8px" }}
          >
            &minus;
          </button>
          <span style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 13,
            fontWeight: 700,
            color: theme.accent,
            minWidth: 30,
            textAlign: "center",
          }}>
            {gameDay}
          </span>
          <button
            onClick={() => { const d = gameDay + 1; setGameDay(d); saveGameSettings({ gameDay: d }); }}
            style={{ ...styles.paramBtn, padding: "2px 8px" }}
          >
            +
          </button>
        </div>
      </div>
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
        onClick={() => setGusherTest((g) => g + 1)}
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
        💥 TEST GUSHER {selectedX === null ? "(select a rig)" : `(${selectedX},${sliceY})`}
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

  const statsPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>GEOLOGICAL SURVEY</h3>
      <div style={isMobile ? m.statGrid : styles.statGrid}>
        <StatBlock s={styles} accentColor={theme.accent} label="TOTAL VALUE" value={<AnimNum value={stats.totalOil} />} unit="USDC" accent />
        <StatBlock s={styles} accentColor={theme.accent} label="DEPOSITS" value={stats.deposits.length} />
        <StatBlock s={styles} accentColor={theme.accent} label="AVAILABLE CLAIMS" value={`${(gridSize * gridSize) - Object.values(allPlotsMap).filter((p) => p?.currentOwnerId != null).length}/${gridSize * gridSize}`} />
        <StatBlock s={styles} accentColor={theme.accent} label="% COLLECTED" value={stats.totalOil > 0 ? `${(playerExtracted / stats.totalOil * 100).toFixed(2)}%` : "0%"} accent={playerExtracted > 0} />
        <StatBlock s={styles} accentColor={theme.accent} label="HIT RATE" value={`${hitRate}%`} accent={hitRate > 60} />
        <StatBlock s={styles} accentColor={theme.accent} label="MAX DEPTH" value={DEPTH_Z} unit="LVL" />
        {!isAdmin && !isReport && effectiveDrillDay > 0 && (
          <>
            <StatBlock s={styles} accentColor={theme.accent} label="YOUR DEPTH" value={`${effectiveDrillDay}/${DEPTH_Z}`} unit="LVL" accent />
            <StatBlock s={styles} accentColor={theme.accent} label="EXTRACTED" value={<AnimNum value={playerExtracted} />} unit="USDC" accent />
          </>
        )}
        {(isAdmin || isReport) && (
          <>
            <StatBlock s={styles} accentColor={theme.accent} label="PEAK CELL" value={<AnimNum value={stats.maxClaimTotal} />} unit="USDC" />
            <StatBlock s={styles} accentColor={theme.accent} label="DRY CLAIMS" value={stats.dryClaims} />
          </>
        )}
      </div>
      {blockHash && (
        <div style={{
          marginTop: 6, padding: "5px 8px",
          background: uiDark ? "rgba(180,160,130,0.06)" : "rgba(180,160,130,0.08)",
          border: `1px solid ${uiDark ? "#444" : "#d4c8b4"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
        }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: 8,
            color: uiDark ? "#8a8070" : "#8b7d6b", letterSpacing: "0.12em",
          }}>
            SEED HASH
          </span>
          <span
            title={blockHash}
            style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 8,
              color: uiDark ? "#8a8070" : "#8b7d6b",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "65%", textAlign: "right", cursor: "pointer",
            }}
            onClick={() => navigator.clipboard?.writeText(blockHash)}
          >
            {blockHash.slice(0, 10)}...{blockHash.slice(-8)}
          </span>
        </div>
      )}
    </div>
  );

  const truncId = (id) => id.length > 10 ? `${id.slice(0, 5)}...${id.slice(-3)}` : id;

  const leaderboardBody = (
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
          {leaderboardData.topCollectors.map((d, i) => (
            <div key={d.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "3px 0", borderBottom: i < leaderboardData.topCollectors.length - 1 ? `1px solid ${theme.barBg}` : "none",
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
              </div>
              <span style={{
                fontSize: 11, color: theme.accent, fontFamily: "'Share Tech Mono', monospace",
                whiteSpace: "nowrap", marginLeft: 8,
              }}>
                {(d.totalCollected || 0).toLocaleString()} USDC
              </span>
            </div>
          ))}
        </>
      )}

      {/* Today's Top */}
      {leaderboardData.topToday.length > 0 && (
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
              </div>
              <span style={{
                fontSize: 11, color: theme.accent, fontFamily: "'Share Tech Mono', monospace",
                whiteSpace: "nowrap", marginLeft: 8,
              }}>
                {(d.totalCollected || 0).toLocaleString()} USDC
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

  // Full panel (with title) — used inside the header trophy overlay.
  const leaderboardPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>LEADERBOARD</h3>
      {leaderboardBody}
    </div>
  );

  // Collapsible inline section — lives at the bottom of the side panel.
  const leaderboardSection = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3
        style={{ ...(isMobile ? m.sectionTitle : styles.panelTitle), display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
        onClick={() => setLeaderboardSectionOpen((o) => !o)}
      >
        LEADERBOARD
        <span style={{ fontSize: 10, color: theme.muted }}>{leaderboardSectionOpen ? "▴" : "▾"}</span>
      </h3>
      {leaderboardSectionOpen && leaderboardBody}
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
          ? `CLAIM (${selectedX + 1}, ${sliceY + 1}) INSPECTOR`
          : userDrill?.col != null
            ? `YOUR CLAIM (${userDrill.col + 1}, ${userDrill.row + 1}) — TAP TO VIEW`
            : "SELECT A CLAIM"}
      </h3>

      {selectedData ? (
        <>
          <div style={styles.inspectorStats}>
            <div style={styles.inspectorRow}>
              <span style={styles.inspectorKey}>Position:</span>
              <span style={styles.inspectorVal}>X{selectedX}, Y{sliceY}</span>
            </div>
            <div style={styles.inspectorRow}>
              <span style={styles.inspectorKey}>Total Oil:</span>
              <span style={styles.inspectorVal}>{selectedData.total.toLocaleString()} USDC</span>
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
                  {selectedData.extracted.toLocaleString()} USDC
                </span>
              </div>
              {drillDepth < DEPTH_Z && selectedData.missed > 0 && (
                <div style={styles.inspectorRow}>
                  <span style={{ ...styles.inspectorKey, color: theme.warn }}>Underground:</span>
                  <span style={{ ...styles.inspectorVal, color: theme.warn }}>
                    {selectedData.missed.toLocaleString()} USDC
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
          Click any claim on the surface map or cross-section to inspect
        </div>
      )}
    </div>
  );

  const topClaimsPanel = isRevealed ? (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>
        <span style={styles.rankIcon}>&#9650;</span> TOP CLAIMS
      </h3>
      <div style={styles.rankList}>
        {stats.sorted.slice(0, 5).map((c, i) => (
          <div
            key={c.claim}
            onClick={() => handleSelectClaim(c)}
            style={{
              ...styles.rankRow,
              cursor: "pointer",
              background: c.index === selectedClaimIndex ? "rgba(212,168,84,0.15)" : "transparent",
            }}
          >
            <span style={{
              ...styles.rankNumber,
              color: i === 0 ? theme.accent : i === 1 ? theme.inspectorKey : i === 2 ? theme.accent : theme.muted,
            }}>
              #{i + 1}
            </span>
            <span style={styles.rankClaim}>CLAIM {c.claim}</span>
            <span style={styles.rankOil}>{c.oil.toLocaleString()}</span>
            <div style={styles.rankBarWrap}>
              <div
                style={{
                  ...styles.rankBarFill,
                  width: `${(c.oil / stats.sorted[0].oil) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

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

  const depositsPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>DEPOSIT LOCATIONS</h3>
      <div style={isMobile ? m.depositGrid : styles.depositList}>
        {stats.deposits.map((d, i) => (
          <div key={i} style={styles.depositRow}>
            <span style={styles.depositIndex}>{String(i + 1).padStart(2, "0")}</span>
            <span style={styles.depositCoord}>
              ({d.cx.toFixed(1)}, {d.cy.toFixed(1)}, {d.cz.toFixed(1)})
            </span>
            <span style={styles.depositRadius}>r{d.radius.toFixed(1)}</span>
            {!isRevealed && <span style={styles.depositHidden}>HIDDEN</span>}
          </div>
        ))}
      </div>
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
      <button onClick={handleReset} style={{ ...styles.btn, ...(isMobile ? { padding: "8px 14px", fontSize: 10 } : {}) }}>
        RESET
      </button>
      <button onClick={handleRandomize} style={{ ...styles.btn, ...(isMobile ? { padding: "8px 14px", fontSize: 10 } : {}) }}>
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
    `}</style>
  );

  // Track viewed recordings — badge shows unwatched count
  const [viewedRecIds, setViewedRecIds] = useState(new Set());
  const unwatchedCount = recordings.filter((r) => !viewedRecIds.has(r.id)).length;

  // CCTV overlay — collapsible widget, top-left of canvas
  const cctvOverlay = selectedX !== null && flyTarget && pumpConfig.showCamera && (
    <div style={cctvStyles.wrap}>
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

  // Test gusher toggle — spawns 1-3 fake gusher events, stays until stopped
  const testGushersActive = gusherEvents.some((e) => e.userId?.startsWith("test-gusher-"));
  const handleToggleTestGushers = useCallback(async () => {
    if (!db) return;
    if (testGushersActive) {
      // Stop: mark all test gushers as done
      try {
        const { getDocs: gd } = await import("firebase/firestore");
        const snap = await gd(query(collection(db, "gusherEvents"), where("status", "==", "active")));
        await Promise.all(snap.docs.filter((d) => d.data().userId?.startsWith("test-gusher-")).map((d) =>
          updateDoc(doc(db, "gusherEvents", d.id), { status: "done" })
        ));
      } catch (e) {
        console.error("Failed to stop test gushers:", e);
      }
    } else {
      // Start: spawn 1-3 test gushers
      const count = Math.min(3, Math.floor(Math.random() * 3) + 1);
      for (let i = 0; i < count; i++) {
        const col = Math.floor(Math.random() * gridSize);
        const row = Math.floor(Math.random() * gridSize);
        try {
          await addDoc(collection(db, "gusherEvents"), {
            col,
            row,
            userId: `test-gusher-${Date.now()}-${i}`,
            username: "ADMIN TEST",
            oilAmount: 999,
            createdAt: serverTimestamp(),
            status: "active",
          });
        } catch (e) {
          console.error("Failed to write test gusher:", e);
        }
      }
    }
  }, [gridSize, testGushersActive]);

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
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: theme.muted, marginBottom: 8 }}>PARABOLEUM PROSPECTOR</div>
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
  if (!settingsLoaded && !previewMode) {
    return <div style={{ width: "100vw", height: "100vh", background: theme.bg }} />;
  }
  const userHasPlot = userDrill?.col != null;
  if (gamePhase === "ticket_sale" && !previewMode) {
    return (
      <OilQualify
        theme={theme}
        darkMode={uiDark}
        isMobile={isMobile}
        user={user}
        isAdmin={isAdmin && adminAuthed}
        saveGameSettings={saveGameSettings}
        walletAddress={walletAddress}
        tokenBalance={tokenBalance}
        isWalletConnected={isWalletConnected}
        storedRef={typeof window !== "undefined" ? localStorage.getItem("oil_ref") : null}
      />
    );
  }

  // Phase override buttons (admin only, visible in active/ended phases)
  const phaseOverrideButtons = isAdmin && (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 9, letterSpacing: "0.1em", color: theme.muted }}>PHASE:</span>
      {["ticket_sale", "active", "ended"].map((p) => (
        <button
          key={p}
          onClick={() => saveGameSettings({ gamePhase: p })}
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
          {p.toUpperCase().replace("_", " ")}
        </button>
      ))}
    </div>
  );

  // End Game button (admin only)
  const endGameButton = isAdmin && !gameEnded && (
    <button
      onClick={() => { setGameEnded(true); saveGameSettings({ gameEnded: true }); }}
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
      CLAIM PLOT AS ME ({selectedX},{sliceY})
    </button>
  );

  const previewBanner = previewMode && (
    <div style={{
      width: "100%",
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
        href="/oil"
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
      GAME ENDED — <a href="/oil?mode=report" style={{ color: theme.accent, textDecoration: "underline" }}>VIEW REPORT</a>
    </div>
  );

  const testGusherButton = isAdmin && adminAuthed && (
    <button
      onClick={handleToggleTestGushers}
      style={{
        padding: "10px 20px",
        background: testGushersActive ? "linear-gradient(180deg, #5a2010, #8a3020)" : "linear-gradient(180deg, #1a0e05, #3a2010)",
        border: `1px solid ${testGushersActive ? "#b04030" : "#5a4020"}`,
        borderRadius: 3,
        color: testGushersActive ? "#ff9966" : "#d4a854",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.12em",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {testGushersActive ? "STOP GUSHERS" : "TEST GUSHERS (1-3)"}
    </button>
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
  const claimBountyButton = demonTaunt && (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? 80 : 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
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
      }}
    >
      THE DEMON DODGES — WAIT FOR IT TO STOP
    </div>
  );

  const bountyClaimedBanner = bountyToast && (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
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
  const drillButton = !isAdmin && !isReport && !isTest && (
    <div style={{
      padding: "10px 14px",
      borderBottom: `1px solid ${theme.border}`,
      background: theme.tintBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    }}>
      {drillStatus === "pre-game" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={drillBtnStyles.disabled}>GAME STARTS SOON</button>
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
            OIL BLOCKADE
          </button>
          <div style={{ ...drillBtnStyles.depth, color: "#ff2200" }}>
            DEMON LOOSE — CLICK IT TO CLAIM BOUNTY
          </div>
        </div>
      )}
      {drillStatus === "no-claim" && (
        <div style={drillBtnStyles.wrap}>
          {userDrill?.col != null ? (
            <button
              onClick={() => handleSelectClaim({ x: userDrill.col, y: userDrill.row })}
              style={drillBtnStyles.active}
            >
              GO TO YOUR CLAIM ({Math.min(userDrill.col, gridSize - 1) + 1}, {Math.min(userDrill.row, gridSize - 1) + 1})
            </button>
          ) : (
            <button disabled style={drillBtnStyles.disabled}>SELECT A CLAIM</button>
          )}
        </div>
      )}
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
          <div style={drillBtnStyles.depth}>DEPTH {cellDepth}/{MAX_DEPTH}</div>
          {/* Depth progress bar — fills as the rig auto-strikes deeper */}
          <div style={{ width: "100%", maxWidth: 220, height: 10, background: theme.barBg, borderRadius: 4, overflow: "hidden", border: `1px solid ${theme.border}`, position: "relative" }}>
            <div style={{
              width: `${(cellDepth / MAX_DEPTH) * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${theme.green}, #7ab44a)`,
              position: "absolute", left: 0, top: 0,
            }} />
          </div>
          {userDrill?.lastStrikeDepth != null ? (
            <div style={drillBtnStyles.hint}>
              Last strike: depth {userDrill.lastStrikeDepth}{userDrill.lastStrikeOil > 0 ? ` — struck ${userDrill.lastStrikeOil.toLocaleString()}` : " — dry layer"}
            </div>
          ) : (
            <div style={drillBtnStyles.hint}>Your rig drills on its own — no clicking needed.</div>
          )}
          <div style={{ fontSize: 9, color: theme.muted, letterSpacing: "0.06em", fontStyle: "italic", textAlign: "center", maxWidth: 220 }}>
            It can strike at any moment — there&apos;s no telling when. Keep an eye on it.
          </div>
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
          DAY {testDay}/{DEPTH_Z}
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
          Click a cell on the map to start testing
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

  // ── Player Drill Panel (depth profile for active players) ──
  const playerDrillPanel = !isAdmin && !isReport && activeUserDrill && (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>
        YOUR CLAIM ({activeUserDrill.col + 1}, {activeUserDrill.row + 1})
      </h3>
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
          EXTRACTED: {playerExtracted.toLocaleString()} USDC
        </span>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", color: theme.accent }}>
          DEPTH {effectiveDrillDay}/{DEPTH_Z}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.1em", color: theme.muted }}>
          {passiveDepth} PASSIVE + {bonusDrills} BONUS
        </span>
        <span style={{ fontSize: 10, letterSpacing: "0.1em", color: theme.muted }}>
          JUMPS {userDrill?.claimJumpsUsed ?? 0} ({Math.max(0, FREE_CLAIM_JUMPS - (userDrill?.claimJumpsUsed ?? 0))} free)
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
      {/* Copyable referral link */}
      {userDrill?.referralCode && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
          padding: "4px 8px", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 2,
        }}>
          <span style={{ fontSize: 10, color: theme.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            rl80.xyz/oil?ref={userDrill.referralCode}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`https://rl80.xyz/oil?ref=${userDrill.referralCode}`);
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
              Click an unclaimed cell on the map to jump
              {(userDrill?.claimJumpsUsed ?? 0) >= FREE_CLAIM_JUMPS && " (costs 1 bonus drill)"}
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
      {/* Tank fill bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3,
        }}>
          <span style={{ fontSize: 11, letterSpacing: "0.12em", color: theme.accent }}>TANK · UNBANKED</span>
          <span style={{ fontSize: 11, letterSpacing: "0.08em", color: tankFill >= 1.0 && !tankDrained ? theme.red : theme.muted }}>
            {tankDrained ? 0 : oilInTank.toLocaleString()} USDC
          </span>
        </div>
        <div style={{
          width: "100%", height: 8, background: theme.barBg, borderRadius: 2, overflow: "hidden",
          border: `1px solid ${tankFill >= 1.0 && !tankDrained ? theme.red : theme.border}`,
          animation: tankFill >= 1.0 && !tankDrained ? "tankPulse 1.2s ease-in-out infinite" : "none",
        }}>
          <div style={{
            width: tankDrained ? "0%" : `${Math.min((oilInTank / TANK_CAPACITY) * 100, 100)}%`,
            height: "100%",
            background: tankFill >= 1.0 && !tankDrained
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
              width: "100%", marginTop: 6, padding: "6px 12px",
              border: `1px solid ${tankFill >= 1.0 ? theme.red : theme.border}`,
              borderRadius: 3, cursor: "pointer",
              background: tankFill >= 1.0 ? `${theme.red}22` : "transparent",
              color: tankFill >= 1.0 ? theme.red : theme.accent,
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10, letterSpacing: "0.12em", fontWeight: tankFill >= 1.0 ? 700 : 400,
              animation: tankFill >= 1.0 ? "tankPulse 1.2s ease-in-out infinite" : "none",
            }}
          >
            {oilInTank <= 0 && myGusherActive
              ? "SHUT OFF GUSHER"
              : tankFill >= 1.0 ? "TANK HEAVY — BANK SOON" : "BANK OIL TO STORAGE"}
          </button>
        )}
        {tankDrained && (
          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: theme.green, marginTop: 2, textAlign: "right" }}>
            SENT TO MAIN TANK
          </div>
        )}
      </div>
      {/* Community storage accounting */}
      {(activeUserDrill?.totalCollected > 0 || activeUserDrill?.tankDrains > 0) && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          padding: "6px 0", marginBottom: 6, borderTop: `1px solid ${theme.barBg}`,
        }}>
          <span style={{ fontSize: 11, letterSpacing: "0.1em", color: theme.accent }}>
            SENT TO STORAGE
          </span>
          <span style={{ fontSize: 11, letterSpacing: "0.08em", color: theme.green, fontWeight: 700 }}>
            {(activeUserDrill.totalCollected || 0).toLocaleString()} USDC
          </span>
        </div>
      )}
      <div style={{ fontSize: 11, letterSpacing: "0.15em", color: theme.accent, marginBottom: 6 }}>DEPTH PROFILE</div>
      <div style={styles.depthChart}>
        {Array.from({ length: DEPTH_Z }, (_, d) => {
          const drilled = d < effectiveDrillDay;
          const oil = drilled ? (stats.grid3D[activeUserDrill.col]?.[activeUserDrill.row]?.[d] ?? 0) : 0;
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
    </div>
  );

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
              <img src="/brand-mark-mono.svg" alt="Home" style={{ width: 24, height: 24, objectFit: "contain", display: "block" }} />
            </Link>
            <div>
              <h1 style={{ ...styles.title, fontSize: 12, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span>HAIL MARY</span>
                <span>PROSPECTING CO.{modeBadge}</span>
              </h1>
              <p style={styles.subtitle}>PARABOLEUM PROSPECTOR</p>
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
            <button
              onClick={() => { contextIsPlaying ? pause() : play(); }}
              title={contextIsPlaying ? "Pause music" : "Play music"}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(212, 175, 55, 0.05)",
                border: "1.5px solid rgba(212, 175, 55, 0.2)",
                color: theme.accent, cursor: "pointer", padding: 0,
                flexShrink: 0, fontSize: 20, fontFamily: "inherit",
              }}
            >
              {contextIsPlaying ? "⏸" : "♫"}
            </button>
          </div>
        </header>

        {/* Seed bar — admin/report only */}
        {(isAdmin || isReport) && (
          <div style={m.seedBar}>
            <span style={styles.seedLabel}>SEED</span>
            <span style={styles.seedValue}>{blockHash}</span>
          </div>
        )}

        {/* Controls — admin only */}
        {isAdmin && (
          <div style={m.inlineControls}>
            {controlButtons}
          </div>
        )}

        {/* Tab bar */}
        <div style={m.tabBar}>
          {[
            { key: "3d", label: "3D VOXEL" },
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
        <div style={m.scroll}>
          {/* 3D Voxel */}
          {mobileTab === "3d" && (
            <div id="oil-canvas" style={m.canvasWrap}>
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
                <ambientLight intensity={env.ambient} />
                {env.hemi && <hemisphereLight args={[env.hemi.sky, env.hemi.ground, env.hemi.intensity]} />}
                <directionalLight position={[10, 15, 10]} intensity={env.dirA} color={env.dirAColor || "#ffffff"} />
                <directionalLight position={[-5, 10, -5]} intensity={env.dirB} color={env.dirBColor || "#ffffff"} />
                <pointLight position={[-8, 5, -8]} intensity={1.5} color={env.point} />
                <group position={[0, 1, 0]}>
                  {GeodeMode && <FieldUnderglow />}
                  <OilVoxelGrid
                    blockHash={blockHash}
                    numberOfDeposits={numberOfDeposits}
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
                    parabolum={parabolum}
                    plotsWithMessages={plotsWithMessages}
                    hellActive={hellActive}
                    hellCol={hellCol}
                    hellRow={hellRow}
                    demonBounty={demonBounty}
                    demonTargetCol={localDemonTarget?.col}
                    demonTargetRow={localDemonTarget?.row}
                    demonCapturable={demonCapturable}
                    onClaimBounty={handleClaimBounty}
                    onDemonMiss={handleDemonMiss}
                  />
                </group>
                <CctvRenderer canvasRef={cctvCanvasRef} />
                {introComplete ? (
                  <>
                    <OrbitControls
                      ref={controlsRefMobile}
                      enableDamping
                      dampingFactor={0.2}
                      enablePan
                      minDistance={0.1}
                      maxDistance={15}
                      maxPolarAngle={Math.PI}
                      minPolarAngle={0}
                      zoomToCursor
                      target={[0, 1, 0]}
                    />
                    <CameraFlyTo target={flyTarget} controlsRef={controlsRefMobile} />
                  </>
                ) : (
                  <CameraFlyIn onComplete={() => setIntroComplete(true)} mobile />
                )}
                <CameraShake shakeRef={shakeRef} />
              </CleanCanvas>
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
                {gridSize}&times;{gridSize}&times;{DEPTH_Z} VOXEL
              </div>
              {selectedX !== null && (() => {
                const mineCol = userDrill?.col ?? myPlot?.col;
                const mineRow = userDrill?.row ?? myPlot?.row;
                const isMine = mineCol === selectedX && mineRow === (sliceY ?? 0);
                return (
                  <div style={styles.cellCoordBadge}>
                    <span style={{ color: isMine ? theme.gold : theme.muted }}>
                      {isMine ? "YOUR CLAIM" : "RIG"}
                    </span>
                    <span style={{ color: theme.accent }}>
                      ({selectedX + 1}, {(sliceY ?? 0) + 1})
                    </span>
                  </div>
                );
              })()}
              <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 10, display: "flex", gap: 4 }}>
                <button
                  onClick={toggleFireworks}
                  title={fireworksOn ? "Stop fireworks" : "Launch fireworks"}
                  style={{
                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    background: fireworksOn ? "rgba(212,168,84,0.35)" : "rgba(212,168,84,0.15)",
                    border: `1px solid ${fireworksOn ? theme.goldBorder : theme.cornerBorder}`,
                    borderRadius: 3, cursor: "pointer", color: theme.accent, padding: 0,
                  }}
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
                    style={{
                      width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                      background: fireworksSound ? "rgba(212,168,84,0.35)" : "rgba(212,168,84,0.15)",
                      border: `1px solid ${fireworksSound ? theme.goldBorder : theme.cornerBorder}`,
                      borderRadius: 3, cursor: "pointer", color: theme.accent, padding: 0,
                    }}
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
              onClick={() => setSnapshotTrigger(true)}
                  style={{
                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(212,168,84,0.15)", border: `1px solid ${theme.cornerBorder}`,
                    borderRadius: 3, cursor: "pointer", color: theme.accent, padding: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              </div>
              <div style={{ position: "absolute", top: 6, right: 6, zIndex: 10 }}>
                <div style={TOOLBAR_TRAY}>
                {[["day", <svg key="day-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>], ["dusk", <svg key="dusk-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>], ["night", <svg key="night-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>]].map(([key, icon]) => (
                  <button
                    key={key}
                    title={key[0].toUpperCase() + key.slice(1)}
                    onClick={() => { setEnvPreset(key); if (key !== "night") setFireworksOn(false); }}
                    style={toolbarBtn(envPreset === key, 26)}
                  >{icon}</button>
                ))}
                <div style={TOOLBAR_DIVIDER} />
                <button
                  title="Solstice theme"
                  onClick={() => { setEnvPreset("solstice"); setParabolum(false); setGeodeMode(false); setDarkMode(false); setFireworksOn(false); }}
                  style={toolbarBtn(envPreset === "solstice" && !parabolum && !GeodeMode, 26)}
                >✺</button>
                <button
                  title={darkMode ? "Dark theme (active)" : "Dark theme"}
                  onClick={() => { setDarkMode((d) => !d); setEnvPreset(darkMode ? "day" : "night"); if (darkMode) setFireworksOn(false); }}
                  style={toolbarBtn(darkMode, 26)}
                >{darkMode ? "●" : "◐"}</button>
                <button
                  title="Paraboleum theme"
                  onClick={() => { setParabolum((p) => !p); setGeodeMode(false); }}
                  style={toolbarBtn(parabolum, 26, "violet")}
                >◈</button>
                <button
                  title="Geode theme"
                  onClick={() => { setGeodeMode((h) => !h); setParabolum(false); }}
                  style={toolbarBtn(GeodeMode, 26, "cyan")}
                >⊞</button>
                </div>
              </div>
            </div>
          )}

          {/* Surface Map */}
          {mobileTab === "surface" && (
            <div style={m.section}>
              <OilSurfaceMap
                claimTotals={showOilData ? stats.claimTotals : communityClaimTotals}
                maxClaimTotal={showOilData ? stats.maxClaimTotal : 0}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
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
                onSliceY={handleSliceY}
                theme={theme}
                parabolum={parabolum}
                gridX={gridSize}
                gridY={gridSize}
              />
            </div>
          )}

          {/* Panels below active view */}
          {testStepper}
          {drillButton}
          <DrillGeode
            drillEvent={drillEvent}
            depthLevel={effectiveDrillDay}
            maxDepth={DEPTH_Z}
            oilStrike={oilStrike}
            oilValue={drilledOilValue}
            maxOil={stats.maxOil}
            drillProximity={drillProximity}
            hellProximity={hellProximity}
            darkMode={uiDark}
            parabolum={parabolum}
            Geode={GeodeMode}
            hellActive={hellActive}
            demonBlockade={demonBlockade}
          />
          {gusherShutoffPanel}
          {playerDrillPanel}
          {isAdmin && parametersPanel}
          {isAdmin && <RogueAdminPanel rogueEvents={rogueEvents} gridSize={gridSize} darkMode={uiDark} adminPassword={adminPassword} />}
          {testGusherButton && (
            <div style={{ ...m.section, display: "flex", justifyContent: "center" }}>
              {testGusherButton}
            </div>
          )}
          {(isAdmin || isReport) && demoDrillPanel}
          {(isAdmin || isReport) && inspectorPanel}
          {statsPanel}
          <CoreSamplePanel
            grid3D={stats.grid3D}
            maxOil={stats.maxOil}
            darkMode={uiDark}
            parabolum={parabolum}
            Geode={GeodeMode}
            isMobile
            gridX={gridSize}
            gridY={gridSize}
            selectedX={selectedX}
            selectedY={sliceY}
            drillDepth={effectiveDrillDay}
            hellPockets={stats.hellPockets}
          />
          <OilPlotChat plotKey={selectedX !== null ? `${selectedX}_${sliceY}` : null} plotOwnerId={plotOwnerForCell} currentUserId={user?.id} username={user?.username || user?.firstName || "anon"} darkMode={uiDark} isMobile hasMessages={selectedX !== null && !!plotsWithMessages[`${selectedX}_${sliceY}`]} onRead={(pk) => { dismissedPlotsRef.current[pk] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[pk]; return next; }); }} onTransferPlot={handleTransferPlot} unlockedItems={unlockedItems} />
          {(isAdmin || isReport) && topClaimsPanel}
          {(isAdmin || isReport) && dryZonesPanel}
          {(isAdmin || isReport) && depositsPanel}
          {(isAdmin || isReport) && hellPocketsPanel}
          <HowToPlayPanel isMobile darkMode={uiDark} onLaunch={() => setShowWelcome(true)} />
          <OilVerifyExplainer isMobile darkMode={uiDark} numberOfDeposits={numberOfDeposits} totalOilBudget={totalOilBudget} gridX={gridSize} gridY={gridSize} depthBias={0.35} />
          <PimpMyPumpPanel config={pumpConfig} onChange={handleConfigChange} hasSelection={selectedX !== null} isMobile darkMode={uiDark} onSave={handleConfigSave} saving={configSaving} dirty={configDirty} isSignedIn={!!user} defaultExpanded={false} userId={user?.id} readOnly={user?.id ? !isConfigOwner : plotOwnerForCell != null} unlockedItems={unlockedItems} onPurchaseRequest={handlePurchaseRequest} />
          {leaderboardSection}
          {(isAdmin || isReport) && (
            <OilVerifyPanel
              numberOfDeposits={numberOfDeposits}
              totalOilBudget={totalOilBudget}
              onApplyHash={handleApplyHash}
            />
          )}
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
          onBuyClick={() => setShowBuyModal(true)}
          isMobile
          show80sButton={false}
          darkMode={uiDark}
          accountModalInitialTab="referrals"
          accountModalTheme="industrial"
          accountModalUnlockedItems={unlockedItems}
          extraLeft={[{
            key: "home",
            label: "HOME",
            title: "Return to shrine",
            onClick: () => router.push("/"),
            icon: <img src="/brand-mark-mono.svg" alt="" width="24" height="24" style={{ display: "block" }} />,
          }]}
        />

        {/* Buy Modal */}
        <BuyModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
        />

        <OilWelcomeModal isOpen={showWelcome} onClose={closeWelcome} darkMode={uiDark} />

        <OilOverlayModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} darkMode={uiDark}>
          {leaderboardPanel}
        </OilOverlayModal>

        {purchaseModalItem && (
          <PumpPurchaseModal
            items={purchaseModalItem}
            activeAccount={walletAddress}
            userId={user?.id}
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
        {claimBountyButton}

        <PolaroidSnapshot
          trigger={snapshotTrigger}
          captureElementId="oil-canvas"
          label="Diversifying my investment portfolio!"
          referralOverlay={userDrill?.referralCode ? { code: userDrill.referralCode } : null}
          onComplete={() => {
            setTimeout(() => setSnapshotTrigger(false), 100);
          }}
        />

        {chatModalPlotKey && (
          <OilChatModal
            plotKey={chatModalPlotKey}
            plotOwnerId={allPlotsMap[chatModalPlotKey]?.currentOwnerId}
            currentUserId={user?.id}
            username={user?.username || user?.firstName || "anon"}
            onClose={() => { dismissedPlotsRef.current[chatModalPlotKey] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[chatModalPlotKey]; return next; }); setChatModalPlotKey(null); }}
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

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Link
            href="/"
            title="Return to shrine"
            style={{ ...styles.logoMark, cursor: "pointer", textDecoration: "none" }}
          >
            <img src="/brand-mark-mono.svg" alt="Home" style={{ width: 24, height: 24, objectFit: "contain", display: "block" }} />
          </Link>
          <div>
            <h1 style={{ ...styles.title, display: "flex", alignItems: "center", gap: 8 }}>
              <span>HAIL MARY PROSPECTING CO.{modeBadge}</span>
            </h1>
            <p style={styles.subtitle}>PARABOLEUM PROSPECTOR</p>
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
            DAY {gameDay}
          </span>
          <div style={{ ...styles.statusDot, ...(gameEnded ? { background: theme.red, boxShadow: "0 0 6px rgba(160,48,48,0.4)" } : {}) }} />
          <span style={styles.statusText}>
            {gameEnded ? "GAME ENDED" : "SURVEY ACTIVE"}
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
        <div style={styles.seedBar}>
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
        gridTemplateColumns: panelsCollapsed ? "1fr" : "1fr 340px 280px",
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
            <ambientLight intensity={env.ambient} />
            {env.hemi && <hemisphereLight args={[env.hemi.sky, env.hemi.ground, env.hemi.intensity]} />}
            <directionalLight position={[10, 15, 10]} intensity={env.dirA} color={env.dirAColor || "#ffffff"} />
            <directionalLight position={[-5, 10, -5]} intensity={env.dirB} color={env.dirBColor || "#ffffff"} />
            <pointLight position={[-8, 5, -8]} intensity={1.5} color={env.point} />
            <group position={[0, 5, 0]}>
              {GeodeMode && <FieldUnderglow />}
              <OilVoxelGrid
                blockHash={blockHash}
                numberOfDeposits={numberOfDeposits}
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
                parabolum={parabolum}
                plotsWithMessages={plotsWithMessages}
                hellActive={hellActive}
                hellCol={hellCol}
                hellRow={hellRow}
                demonBounty={demonBounty}
                demonTargetCol={localDemonTarget?.col}
                demonTargetRow={localDemonTarget?.row}
                demonCapturable={demonCapturable}
                onClaimBounty={handleClaimBounty}
                onDemonMiss={handleDemonMiss}
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
                  minDistance={5}
                  maxDistance={45}
                  maxPolarAngle={Math.PI}
                  minPolarAngle={0}
                  target={[0, 3, 0]}
                  zoomToCursor
                />
                <CameraFlyTo target={flyTarget} controlsRef={controlsRef} />
              </>
            ) : (
              <CameraFlyIn onComplete={() => setIntroComplete(true)} duration={5} />
            )}
            <CameraShake shakeRef={shakeRef} />
          </CleanCanvas>
          {cctvOverlay}
          <div style={{ ...styles.cornerBracket, top: 8, left: 8 }} />
          <div style={{ ...styles.cornerBracket, top: 8, right: 8, transform: "scaleX(-1)" }} />
          <div style={{ ...styles.cornerBracket, bottom: 8, left: 8, transform: "scaleY(-1)" }} />
          <div style={{ ...styles.cornerBracket, bottom: 8, right: 8, transform: "scale(-1)" }} />
          <div style={styles.gridLabel}>
            {gridSize}&times;{gridSize}&times;{DEPTH_Z} VOXEL GRID
          </div>
          <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10, display: "flex", gap: 4 }}>
            <button
              onClick={toggleFireworks}
              title={fireworksOn ? "Stop fireworks" : "Launch fireworks"}
              style={{
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                background: fireworksOn ? "rgba(212,168,84,0.35)" : "rgba(212,168,84,0.15)",
                border: `1px solid ${fireworksOn ? theme.goldBorder : theme.cornerBorder}`,
                borderRadius: 3, cursor: "pointer", color: theme.accent, padding: 0,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                style={{
                  width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                  background: fireworksSound ? "rgba(212,168,84,0.35)" : "rgba(212,168,84,0.15)",
                  border: `1px solid ${fireworksSound ? theme.goldBorder : theme.cornerBorder}`,
                  borderRadius: 3, cursor: "pointer", color: theme.accent, padding: 0,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              onClick={() => setSnapshotTrigger(true)}
              style={{
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(212,168,84,0.15)", border: `1px solid ${theme.cornerBorder}`,
                borderRadius: 3, cursor: "pointer", color: theme.accent, padding: 0,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>
          <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={TOOLBAR_TRAY}>
            {[["day", <svg key="day-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>], ["dusk", <svg key="dusk-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>], ["night", <svg key="night-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>]].map(([key, icon]) => (
              <button
                key={key}
                title={key[0].toUpperCase() + key.slice(1)}
                onClick={() => { setEnvPreset(key); if (key !== "night") setFireworksOn(false); }}
                style={toolbarBtn(envPreset === key, 28)}
              >{icon}</button>
            ))}
            <div style={TOOLBAR_DIVIDER} />
            <button
              title="Solstice theme"
              onClick={() => { setEnvPreset("solstice"); setParabolum(false); setGeodeMode(false); setDarkMode(false); setFireworksOn(false); }}
              style={toolbarBtn(envPreset === "solstice" && !parabolum && !GeodeMode, 28)}
            >✺</button>
            <button
              title={darkMode ? "Dark theme (active)" : "Dark theme"}
              onClick={() => { setDarkMode((d) => !d); setEnvPreset(darkMode ? "day" : "night"); if (darkMode) setFireworksOn(false); }}
              style={toolbarBtn(darkMode, 28)}
            >{darkMode ? "●" : "◐"}</button>
            <button
              title="Parabolum theme"
              onClick={() => { setParabolum((p) => !p); setGeodeMode(false); }}
              style={toolbarBtn(parabolum, 28, "violet")}
            >◈</button>
            <button
              title="Geode theme"
              onClick={() => { setGeodeMode((h) => !h); setParabolum(false); }}
              style={toolbarBtn(GeodeMode, 28, "cyan")}
            >⊞</button>
            </div>
            <button
              title={panelsCollapsed ? "Show side panel" : "Hide side panel"}
              onClick={() => setPanelsCollapsed((p) => !p)}
              style={TOOLBAR_PILL}
            >
              {panelsCollapsed ? "◂ SHOW PANEL" : "HIDE PANEL ▸"}
            </button>
          </div>
        </div>

        {/* Middle column */}
        {!panelsCollapsed && (
          <div style={styles.midColumn}>
            <div style={styles.midPanel}>
              <OilSurfaceMap
                claimTotals={showOilData ? stats.claimTotals : communityClaimTotals}
                maxClaimTotal={showOilData ? stats.maxClaimTotal : 0}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
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
            <div style={{ ...styles.midPanel, flex: 1, minHeight: 0 }}>
              <OilCrossSection
                grid3D={showOilData ? stats.grid3D : communityGrid3D}
                maxCellValue={showOilData ? stats.maxOil : communityMaxOil}
                sliceY={sliceY}
                selectedX={xsecCol}
                drillDepth={showOilData ? drillDepth : effectiveDrillDay}
                onSelectX={handleSelectX}
                onSliceY={handleSliceY}
                theme={theme}
                parabolum={parabolum}
                gridX={gridSize}
                gridY={gridSize}
              />
            </div>
          </div>
        )}

        {/* Right side panel */}
        {!panelsCollapsed && (
          <aside style={{
            ...styles.sidePanel,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateX(0)" : "translateX(20px)",
          }}>
            {testStepper}
            {drillButton}
            <DrillGeode
              drillEvent={drillEvent}
              depthLevel={effectiveDrillDay}
              maxDepth={DEPTH_Z}
              oilStrike={oilStrike}
              oilValue={drilledOilValue}
              maxOil={stats.maxOil}
              drillProximity={drillProximity}
              hellProximity={hellProximity}
              darkMode={uiDark}
              parabolum={parabolum}
              Geode={GeodeMode}
              hellActive={hellActive}
            />
            {gusherShutoffPanel}
            {playerDrillPanel}
            {isAdmin && parametersPanel}
            {isAdmin && <RogueAdminPanel rogueEvents={rogueEvents} gridSize={gridSize} darkMode={uiDark} adminPassword={adminPassword} />}
            {(isAdmin || isReport) && demoDrillPanel}
            {statsPanel}
            <CoreSamplePanel
              grid3D={stats.grid3D}
              maxOil={stats.maxOil}
              darkMode={uiDark}
              parabolum={parabolum}
              Geode={GeodeMode}
              gridX={gridSize}
              gridY={gridSize}
              selectedX={selectedX}
              selectedY={sliceY}
              drillDepth={effectiveDrillDay}
              hellPockets={stats.hellPockets}
            />
            <OilPlotChat plotKey={selectedX !== null ? `${selectedX}_${sliceY}` : null} plotOwnerId={plotOwnerForCell} currentUserId={user?.id} username={user?.username || user?.firstName || "anon"} darkMode={uiDark} hasMessages={selectedX !== null && !!plotsWithMessages[`${selectedX}_${sliceY}`]} onRead={(pk) => { dismissedPlotsRef.current[pk] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[pk]; return next; }); }} onTransferPlot={handleTransferPlot} unlockedItems={unlockedItems} />
            {(isAdmin || isReport) && inspectorPanel}
            {(isAdmin || isReport) && topClaimsPanel}
            {(isAdmin || isReport) && dryZonesPanel}
            {(isAdmin || isReport) && depositsPanel}
          {(isAdmin || isReport) && hellPocketsPanel}
            <HowToPlayPanel darkMode={uiDark} onLaunch={() => setShowWelcome(true)} />
            <OilVerifyExplainer darkMode={uiDark} numberOfDeposits={numberOfDeposits} totalOilBudget={totalOilBudget} gridX={gridSize} gridY={gridSize} depthBias={0.35} />
            <PimpMyPumpPanel config={pumpConfig} onChange={handleConfigChange} hasSelection={selectedX !== null} darkMode={uiDark} onSave={handleConfigSave} saving={configSaving} dirty={configDirty} isSignedIn={!!user} defaultExpanded={false} userId={user?.id} readOnly={user?.id ? !isConfigOwner : plotOwnerForCell != null} unlockedItems={unlockedItems} onPurchaseRequest={handlePurchaseRequest} />
            {leaderboardSection}
            {(isAdmin || isReport) && (
              <OilVerifyPanel
                numberOfDeposits={numberOfDeposits}
                totalOilBudget={totalOilBudget}
                onApplyHash={handleApplyHash}
                gridX={gridSize}
                gridY={gridSize}
              />
            )}
            {testGusherButton && (
              <div style={{ ...styles.panelSection, display: "flex", justifyContent: "center" }}>
                {testGusherButton}
              </div>
            )}
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
        <div style={styles.controlBar}>
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
      {claimBountyButton}

      <PolaroidSnapshot
        trigger={snapshotTrigger}
        captureElementId="oil-canvas"
        label="Diversifying my investment portfolio!"
        referralOverlay={userDrill?.referralCode ? { code: userDrill.referralCode } : null}
        onComplete={() => {
          setTimeout(() => setSnapshotTrigger(false), 100);
        }}
      />

      {chatModalPlotKey && (
        <OilChatModal
          plotKey={chatModalPlotKey}
          plotOwnerId={allPlotsMap[chatModalPlotKey]?.currentOwnerId}
          currentUserId={user?.id}
          username={user?.username || user?.firstName || "anon"}
          onClose={() => { dismissedPlotsRef.current[chatModalPlotKey] = Math.floor(Date.now() / 1000); setPlotsWithMessages((prev) => { const next = { ...prev }; delete next[chatModalPlotKey]; return next; }); setChatModalPlotKey(null); }}
        />
      )}

      {purchaseModalItem && (
        <PumpPurchaseModal
          items={purchaseModalItem}
          activeAccount={walletAddress}
          userId={user?.id}
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

      <OilWelcomeModal isOpen={showWelcome} onClose={closeWelcome} darkMode={uiDark} />

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
    fontSize: 8,
    color: "#111",
    background: "#ff3333",
    borderRadius: 6,
    padding: "0 4px",
    minWidth: 14,
    textAlign: "center",
    lineHeight: "14px",
  },
  camLabel: {
    fontSize: 8,
    color: "#888",
    letterSpacing: "0.12em",
    flex: 1,
    textAlign: "center",
  },
  toggle: {
    fontSize: 8,
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
    fontSize: 8,
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
    fontSize: 8,
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
    fontSize: 7,
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
    color: t.muted,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
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
    fontSize: 10,
    letterSpacing: "0.12em",
    padding: "3px 8px",
    background: "rgba(0,0,0,0.4)",
    border: `1px solid ${t.cornerBorder || t.border}`,
    borderRadius: 3,
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

  panelSection: {
    padding: "12px 14px",
    borderBottom: `1px solid ${t.border}`,
    background: t.panelLine ? `${t.panelLine} left bottom / 100% 1px no-repeat` : "transparent",
  },

  panelTitle: {
    margin: "0 0 10px",
    fontSize: 11,
    fontWeight: 600,
    color: t.titleCool || t.accent,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

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
    height: "75vh",
    minHeight: 280,
    maxHeight: 500,
    borderBottom: `1px solid ${t.border}`,
  },

  section: {
    padding: "12px 12px",
    borderBottom: `1px solid ${t.border}`,
    background: t.panelLine ? `${t.panelLine} left bottom / 100% 1px no-repeat` : "transparent",
  },

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 11,
    fontWeight: 600,
    color: t.titleCool || t.accent,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

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
    padding: "8px 0",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: t.muted,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
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
