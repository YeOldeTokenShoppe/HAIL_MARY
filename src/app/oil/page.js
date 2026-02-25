"use client";

import { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import dynamic from "next/dynamic";
import { OrbitControls, Cloud, Clouds } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CleanCanvas from "@/components/canvas/CleanCanvas";
import OilVoxelGrid, { CctvRenderer } from "@/components/OilVoxelGrid";
import { generateOilDistribution3D } from "@/lib/oilDistribution";
import PimpMyPumpPanel, { getDefaultPumpConfig } from "@/components/PimpMyPumpPanel";
import HowToPlayPanel from "@/components/HowToPlayPanel";
import { useUser } from "@clerk/nextjs";
import { useMusic } from "@/components/MusicContext";
import NavControlsHome from "@/components/NavControlsHome";
import MobileBottomNav from "@/components/MobileBottomNav";
import ThirdwebBuyModal from "@/components/ThirdwebBuyModal";
import CyberNav from "@/components/CyberNav";
import PolaroidSnapshot from "@/components/PolaroidSnapshot";
import Fireworks from "@/components/Fireworks";
import { db, storage, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, ref, uploadBytes, getDownloadURL, onSnapshot } from "@/lib/firebaseClient";

// ── Environment presets ──────────────────────────────────────────────────────
const ENV_PRESETS = {
  day:   { sky: "#7da4c9", skyBottom: null, ambient: 1.2, dirA: 15.5, dirB: 15.6, point: "#4488ff", cloudOpacity: 0.2, fog: null, hemi: null },
  dusk:  { sky: "#8b7faa", skyBottom: "#d4b8a0", ambient: 0.7, dirA: 4.0,  dirB: 2.0,  point: "#cc9966", cloudOpacity: 0.25, fog: "#c4a88e", hemi: { sky: "#9088aa", ground: "#d4b8a0", intensity: 0.5 } },
  night: { sky: "#0a0e1a", skyBottom: null, ambient: 0.15, dirA: 0.3, dirB: 0.2, point: "#2244aa", cloudOpacity: 0.08, fog: "#0a0e1a", hemi: null },
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

const SkyDome = memo(function SkyDome({ skyColor = "#7da4c9", skyBottom = null, cloudOpacity = 0.2 }) {
  const topCol = useMemo(() => new THREE.Color(skyColor), [skyColor]);
  const bottomCol = useMemo(() => skyBottom ? new THREE.Color(skyBottom) : null, [skyBottom]);
  const uniforms = useMemo(() => ({
    topColor: { value: topCol },
    bottomColor: { value: bottomCol ?? topCol },
  }), []); // stable ref — update values below

  // Update uniform values without recreating the object
  useEffect(() => {
    uniforms.topColor.value = topCol;
    uniforms.bottomColor.value = bottomCol ?? topCol;
  }, [topCol, bottomCol, uniforms]);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[80, 24, 24]} />
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
      <Clouds material={THREE.MeshBasicMaterial}>
        <Cloud position={[-8, 10, -12]} speed={0.02} opacity={cloudOpacity * 1.25} width={1.2} depth={0.15} segments={4} />
        <Cloud position={[14, 12, -6]} speed={0.03} opacity={cloudOpacity} width={1.5} depth={0.12} segments={4} />
        <Cloud position={[3, 11, 16]} speed={0.015} opacity={cloudOpacity * 1.1} width={1} depth={0.1} segments={3} />
        <Cloud position={[-12, 13, 8]} speed={0.025} opacity={cloudOpacity * 0.9} width={1.8} depth={0.15} segments={4} />
        <Cloud position={[18, 9, 14]} speed={0.02} opacity={cloudOpacity} width={0.8} depth={0.1} segments={3} />
        <Cloud position={[-4, 14, -18]} speed={0.01} opacity={cloudOpacity * 0.75} width={1.3} depth={0.12} segments={3} />
        <Cloud position={[10, 12, -16]} speed={0.02} opacity={cloudOpacity * 0.9} width={1} depth={0.1} segments={3} />
      </Clouds>
    </group>
  );
});

const OilSurfaceMap = dynamic(() => import("@/components/OilSurfaceMap"), { ssr: false });
const OilCrossSection = dynamic(() => import("@/components/OilCrossSection"), { ssr: false });
const OilVerifyPanel = dynamic(() => import("@/components/OilVerifyPanel"), { ssr: false });
const OilTicketSale = dynamic(() => import("@/components/OilTicketSale"), { ssr: false });
const OilPlotDraft = dynamic(() => import("@/components/OilPlotDraft"), { ssr: false });

const DEFAULT_BLOCK_HASH =
  "0x8a3f7b2c91d4e6f5a0b3c8d7e2f1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0";

const DEPTH_Z = 20;
const CELL_SIZE = 1;
const TANK_CAPACITY = 100_000;

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

  useFrame((_, delta) => {
    if (target && target.id !== lastId.current) {
      lastId.current = target.id;
      const controls = controlsRef?.current;
      if (controls) {
        // Save and temporarily lower minDistance
        if (savedMinDist.current === null) savedMinDist.current = controls.minDistance;
        controls.minDistance = 0.3;

        startPos.current.copy(camera.position);
        startTarget.current.copy(controls.target);

        if (target.mobile) {
          // Mobile: close ground-level view of the rig
          endTarget.current.set(target.x, target.y - 0.1, target.z);
          endPos.current.set(target.x + 0.35, target.y - 0.05, target.z + 0.35);
        } else {
          // Desktop: elevated close-up
          endTarget.current.set(target.x, target.y - 0.05, target.z);
          endPos.current.set(target.x + 0.5, target.y + 0.0, target.z + 0.5);
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
    const RUMBLE_DURATION = 3.0;
    // Gentle fade in then slow fade out
    const t = elapsed.current / RUMBLE_DURATION;
    const envelope = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 0.9);
    const amp = 0.015 * envelope;
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
    const { grid, deposits, maxOil } = generateOilDistribution3D({
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
    for (let y = 0; y < gridY; y++) {
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

    return { grid3D: grid, claimTotals, sorted, deposits, maxOil, totalOil, dryClaims, maxClaimTotal };
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

export default function OilPage() {
  const isMobile = useIsMobile();

  // Read mode from URL search params (avoids useSearchParams / Suspense issues)
  const [mode, setMode] = useState("active");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get("mode") || "active");
  }, []);
  const isAdmin = mode === "admin";
  const isReport = mode === "report";

  const [envPreset, setEnvPreset] = useState("day");
  const env = ENV_PRESETS[envPreset];
  const [darkMode, setDarkMode] = useState(false);
  const theme = THEMES[darkMode ? "dark" : "light"];
  const styles = useMemo(() => getStyles(theme), [theme]);
  const m = useMemo(() => getMobileStyles(theme), [theme]);
  const drillBtnStyles = useMemo(() => getDrillStyles(theme), [theme]);
  const isTest = mode === "test";
  const [testDay, setTestDay] = useState(0);
  const { user } = useUser();
  const { play, pause, isPlaying: contextIsPlaying, nextTrack } = useMusic();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Game state
  const [gamePhase, setGamePhase] = useState("active");
  const [gameEnded, setGameEnded] = useState(false);
  const [gameDay, setGameDay] = useState(1);

  // Admin password gate
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (isAdmin && localStorage.getItem("oil_admin_auth") === "true") {
      setAdminAuthed(true);
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
  const [numberOfDeposits, setNumberOfDeposits] = useState(8);
  const [totalOilBudget, setTotalOilBudget] = useState(100_000_000);
  const [gridSize, setGridSize] = useState(10);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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

  // Admin: save settings to Firestore when they change
  const saveGameSettings = useCallback(async (overrides = {}) => {
    if (!db || !isAdmin || !adminAuthed) return;
    try {
      await setDoc(doc(db, "oilGame", "settings"), {
        blockHash,
        numberOfDeposits,
        totalOilBudget,
        gridSize,
        gamePhase,
        gameEnded,
        gameDay,
        updatedAt: serverTimestamp(),
        ...overrides,
      }, { merge: true });
    } catch (err) {
      console.error("Failed to save game settings:", err);
    }
  }, [isAdmin, adminAuthed, blockHash, numberOfDeposits, totalOilBudget, gridSize, gamePhase, gameEnded, gameDay]);

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

  // ── Daily Drill (player mode) ──
  const [userDrill, setUserDrill] = useState(null); // { col, row, drillDay, lastDrillDate }
  const [drillCountdown, setDrillCountdown] = useState("");

  // Load user drill state from Firestore
  useEffect(() => {
    if (!user?.id || !db) return;
    const unsub = onSnapshot(doc(db, "oilDrills", user.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setUserDrill({ col: d.col, row: d.row, drillDay: d.drillDay, lastDrillDate: d.lastDrillDate, totalCollected: d.totalCollected || 0, tankDrains: d.tankDrains || 0, lastDrainExtracted: d.lastDrainExtracted || 0 });
      } else {
        setUserDrill(null);
      }
    });
    return () => unsub();
  }, [user?.id]);

  // Countdown timer to next 00:00 UTC
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = tomorrow - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const mn = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setDrillCountdown(`${h}:${mn}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const todayUTC = new Date().toISOString().slice(0, 10);

  // In test mode, synthesize a userDrill from the selected cell
  const activeUserDrill = isTest && selectedX !== null
    ? { col: selectedX, row: sliceY, drillDay: testDay, lastDrillDate: null, lastDrainExtracted: 0, totalCollected: 0, tankDrains: 0 }
    : userDrill;

  // Reset reviewDay when drill day advances (e.g. after a new drill)
  useEffect(() => { setReviewDay(null); }, [userDrill?.drillDay]);

  // Effective drill day: active mode uses userDrill, admin/report uses demoDay, test uses testDay
  const effectiveDrillDay = (isAdmin || isReport) ? demoDay
    : isTest ? testDay
    : (reviewDay !== null ? reviewDay : (userDrill?.drillDay || 0));

  // Can the player drill right now?
  const drillStatus = useMemo(() => {
    if (!user && !isTest) return "sign-in";
    if (selectedX === null) return "no-claim";
    if (userDrill && (userDrill.col !== selectedX || userDrill.row !== sliceY)) return "wrong-claim";
    const currentDepth = userDrill?.drillDay || 0;
    if (currentDepth >= DEPTH_Z) return "max-depth";
    if (userDrill?.lastDrillDate === todayUTC) return "drilled-today";
    return "ready";
  }, [user, selectedX, sliceY, userDrill, todayUTC]);

  // Panel collapse for full 3D view
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);

  // Pimp My Pump customization
  const [pumpConfig, setPumpConfig] = useState(() => getDefaultPumpConfig());
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const cctvCanvasRef = useRef(null);
  const [cctvOpen, setCctvOpen] = useState(true);

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

  // Load pump config when a rig is selected
  useEffect(() => {
    if (!user?.id || !db || selectedX === null || sliceY === null) return;
    const docId = getConfigDocId(selectedX, sliceY);
    if (!docId) return;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "pumpConfigs", docId));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setPumpConfig({ ...getDefaultPumpConfig(), ...data.config });
        } else {
          setPumpConfig(getDefaultPumpConfig());
        }
        setConfigDirty(false);
      } catch (err) {
        console.error("Failed to load pump config:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, selectedX, sliceY, getConfigDocId]);

  // Save pump config (called from SAVE button)
  const handleConfigSave = useCallback(async () => {
    if (!user?.id || !db || selectedX === null || sliceY === null) return;
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
  }, [user?.id, selectedX, sliceY, pumpConfig, getConfigDocId]);

  // Camera fly-to
  const [flyTarget, setFlyTarget] = useState(null);
  const controlsRef = useRef();
  const controlsRefMobile = useRef();

  const stats = useClaimStats(blockHash, numberOfDeposits, totalOilBudget, gridSize, gridSize);

  // In active game mode, hide oil data from 2D views
  const showOilData = isAdmin || isReport;

  const blankClaimTotals = useMemo(() =>
    stats.claimTotals.map((c) => ({ ...c, oil: 0, total: 0 })),
    [stats.claimTotals]
  );

  const blankGrid3D = useMemo(() => {
    const g = [];
    for (let x = 0; x < gridSize; x++) {
      g[x] = [];
      for (let y = 0; y < gridSize; y++) {
        g[x][y] = new Array(DEPTH_Z).fill(0);
      }
    }
    return g;
  }, [gridSize]);

  // Depth-limited grid: only reveals the player's drilled column up to effectiveDrillDay
  const playerGrid3D = useMemo(() => {
    if (showOilData || selectedX === null || !activeUserDrill) return blankGrid3D;
    const g = blankGrid3D.map(col => col.map(row => [...row]));
    const col = activeUserDrill.col;
    const row = activeUserDrill.row;
    for (let z = 0; z < Math.min(effectiveDrillDay, DEPTH_Z); z++) {
      g[col][row][z] = stats.grid3D[col]?.[row]?.[z] ?? 0;
    }
    return g;
  }, [showOilData, selectedX, activeUserDrill, effectiveDrillDay, stats.grid3D, blankGrid3D]);

  const playerMaxOil = useMemo(() => {
    if (showOilData || selectedX === null || !activeUserDrill) return 0;
    let max = 0;
    const col = activeUserDrill.col;
    const row = activeUserDrill.row;
    for (let z = 0; z < Math.min(effectiveDrillDay, DEPTH_Z); z++) {
      const v = stats.grid3D[col]?.[row]?.[z] ?? 0;
      if (v > max) max = v;
    }
    return max;
  }, [showOilData, selectedX, activeUserDrill, effectiveDrillDay, stats.grid3D]);

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

  // Session-local drain tracking
  const [tankDrained, setTankDrained] = useState(false);
  const [lastDrainSnapshot, setLastDrainSnapshot] = useState(0);

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

  // Oil currently in tank = total extracted minus snapshot at last drain
  const oilInTank = useMemo(() => {
    if (playerExtracted === 0) return 0;
    return Math.max(0, playerExtracted - lastDrainSnapshot);
  }, [playerExtracted, lastDrainSnapshot]);

  // Tank fill: fraction of oil in tank relative to capacity (100K tokens)
  // Can exceed 1.0 — gusher fires when it first crosses 1.0
  const tankFill = useMemo(() => {
    if (selectedX === null || effectiveDrillDay === 0) return 0;
    return oilInTank / TANK_CAPACITY;
  }, [selectedX, effectiveDrillDay, oilInTank]);

  const selectedDepthData = useMemo(() => {
    if (selectedX === null) return null;
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
  const oilStrike = useMemo(() => {
    if (selectedX === null || effectiveDrillDay === 0) return 0;
    const depthIndex = effectiveDrillDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    const oilAtDepth = stats.grid3D[selectedX]?.[sliceY]?.[depthIndex] ?? 0;
    if (oilAtDepth > 0 && effectiveDrillDay !== oilStrikeDay.current) {
      oilStrikeDay.current = effectiveDrillDay;
      return effectiveDrillDay; // unique trigger value per strike
    }
    return 0;
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

  // Camera shake — ref-driven, no state re-renders
  const shakeRef = useRef(0);

  useEffect(() => {
    if (oilStrike > 0) {
      shakeRef.current = 1;
    }
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
    setFlyTarget({ x, y: isMobile ? 1.3 : 5.3, z, id: flyIdRef.current, mobile: isMobile });
    setSelectedX(col);
    setSliceY(row);
    setDrillDepth(0);
  }, [isMobile, gridSize]);



  const handleSelectClaim = useCallback((claim) => {
    setSelectedX(claim.x);
    setSliceY(claim.y);
    setDrillDepth(0);
    handleFlyTo(claim.x, claim.y);
  }, [handleFlyTo]);

  // Daily drill handler (player mode)
  const handleDailyDrill = useCallback(async () => {
    if (!user?.id || !db || selectedX === null || drillStatus !== "ready") return;
    const nextDay = (userDrill?.drillDay || 0) + 1;
    const col = userDrill?.col ?? selectedX;
    const row = userDrill?.row ?? sliceY;
    // Optimistic local update
    setUserDrill({ col, row, drillDay: nextDay, lastDrillDate: todayUTC });
    try {
      await setDoc(doc(db, "oilDrills", user.id), {
        userId: user.id,
        col,
        row,
        drillDay: nextDay,
        lastDrillDate: todayUTC,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to save drill:", err);
    }
  }, [user?.id, selectedX, sliceY, userDrill, drillStatus, todayUTC]);

  // Tank drain handler — always updates UI, persists to Firestore when possible
  const handleTankDrain = useCallback(async () => {
    if (playerExtracted === 0) return;
    // Always update UI locally
    const delta = Math.max(0, playerExtracted - lastDrainSnapshot);
    if (delta === 0) return;
    setTankDrained(true);
    setLastDrainSnapshot(playerExtracted);
    setCommunityOil(prev => prev + delta);
    // Persist to Firestore if signed in
    if (user?.id && db) {
      try {
        // Increment community storage atomically
        await setDoc(doc(db, "oilGame", "communityStorage"), {
          totalOil: increment(delta),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        // Update user drill record
        if (userDrill) {
          const newTotal = (userDrill.totalCollected || 0) + delta;
          const newDrains = (userDrill.tankDrains || 0) + 1;
          setUserDrill(prev => prev ? { ...prev, totalCollected: newTotal, tankDrains: newDrains, lastDrainExtracted: playerExtracted } : prev);
          await setDoc(doc(db, "oilDrills", user.id), {
            userId: user.id,
            col: userDrill.col,
            row: userDrill.row,
            drillDay: userDrill.drillDay,
            lastDrillDate: userDrill.lastDrillDate,
            totalCollected: newTotal,
            tankDrains: newDrains,
            lastDrainExtracted: playerExtracted,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error("Failed to save tank drain:", err);
      }
    }
  }, [user?.id, userDrill, playerExtracted, lastDrainSnapshot]);

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
          {[10_000_000, 50_000_000, 100_000_000, 500_000_000].map((n) => (
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
        <StatBlock s={styles} accentColor={theme.accent} label="TOTAL OIL" value={<AnimNum value={stats.totalOil} />} unit="RL80" accent />
        <StatBlock s={styles} accentColor={theme.accent} label="DEPOSITS" value={stats.deposits.length} />
        <StatBlock s={styles} accentColor={theme.accent} label="CLAIMS" value={gridSize * gridSize} />
        <StatBlock s={styles} accentColor={theme.accent} label="% COLLECTED" value={stats.totalOil > 0 ? `${(playerExtracted / stats.totalOil * 100).toFixed(2)}%` : "0%"} accent={playerExtracted > 0} />
        {!isAdmin && !isReport && effectiveDrillDay > 0 && (
          <>
            <StatBlock s={styles} accentColor={theme.accent} label="YOUR DEPTH" value={`${effectiveDrillDay}/${DEPTH_Z}`} unit="LVL" accent />
            <StatBlock s={styles} accentColor={theme.accent} label="EXTRACTED" value={<AnimNum value={playerExtracted} />} unit="RL80" accent />
          </>
        )}
        {(isAdmin || isReport) && (
          <>
            <StatBlock s={styles} accentColor={theme.accent} label="PEAK CELL" value={<AnimNum value={stats.maxClaimTotal} />} unit="RL80" />
            <StatBlock s={styles} accentColor={theme.accent} label="DRY CLAIMS" value={stats.dryClaims} />
            <StatBlock s={styles} accentColor={theme.accent} label="HIT RATE" value={`${hitRate}%`} accent={hitRate > 60} />
          </>
        )}
      </div>
    </div>
  );

  const inspectorPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>
        {selectedX !== null
          ? `CLAIM (${selectedX}, ${sliceY}) INSPECTOR`
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
              <span style={styles.inspectorVal}>{selectedData.total.toLocaleString()} RL80</span>
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
                  {selectedData.extracted.toLocaleString()} RL80
                </span>
              </div>
              {drillDepth < DEPTH_Z && selectedData.missed > 0 && (
                <div style={styles.inspectorRow}>
                  <span style={{ ...styles.inspectorKey, color: theme.warn }}>Underground:</span>
                  <span style={{ ...styles.inspectorVal, color: theme.warn }}>
                    {selectedData.missed.toLocaleString()} RL80
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
    `}</style>
  );

  // CCTV overlay — collapsible widget, top-left of canvas
  const cctvOverlay = selectedX !== null && pumpConfig.showCamera && (
    <div style={cctvStyles.wrap}>
      <div
        style={cctvStyles.header}
        onClick={() => setCctvOpen((o) => !o)}
      >
        <span style={cctvStyles.rec}>&#9679; REC</span>
        <span style={cctvStyles.camLabel}>CAM-{selectedX},{sliceY}</span>
        <span style={cctvStyles.toggle}>{cctvOpen ? "\u25B2" : "\u25BC"}</span>
      </div>
      {cctvOpen && (
        <>
          <canvas
            ref={cctvCanvasRef}
            width={320}
            height={240}
            style={cctvStyles.canvas}
          />
          <div style={cctvStyles.scanlines} />
          <div style={cctvStyles.footer}>
            <span style={cctvStyles.timestamp}>
              {new Date().toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
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
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: theme.muted, marginBottom: 8 }}>OIL PROSPECTOR</div>
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
  if (gamePhase === "ticket_sale") {
    return (
      <OilTicketSale
        theme={theme}
        darkMode={darkMode}
        isMobile={isMobile}
        user={user}
        isAdmin={isAdmin && adminAuthed}
        gridSize={gridSize}
        saveGameSettings={saveGameSettings}
        setGridSize={setGridSize}
      />
    );
  }

  if (gamePhase === "grid_locked") {
    return (
      <OilPlotDraft
        theme={theme}
        darkMode={darkMode}
        isMobile={isMobile}
        user={user}
        isAdmin={isAdmin && adminAuthed}
        gridSize={gridSize}
        saveGameSettings={saveGameSettings}
      />
    );
  }

  // Phase override buttons (admin only, visible in active/ended phases)
  const phaseOverrideButtons = isAdmin && (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 9, letterSpacing: "0.1em", color: theme.muted }}>PHASE:</span>
      {["ticket_sale", "grid_locked", "active", "ended"].map((p) => (
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

  // Mode badge for header
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

  // ── Daily Drill Button (active mode only, not test mode) ──
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
      {drillStatus === "sign-in" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={drillBtnStyles.disabled}>SIGN IN TO DRILL</button>
          <div style={drillBtnStyles.countdown}>NEXT DRILL IN {drillCountdown}</div>
        </div>
      )}
      {drillStatus === "no-claim" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={drillBtnStyles.disabled}>SELECT A CLAIM</button>
          <div style={drillBtnStyles.countdown}>NEXT DRILL IN {drillCountdown}</div>
        </div>
      )}
      {drillStatus === "wrong-claim" && (
        <div style={drillBtnStyles.wrap}>
          <button
            onClick={() => handleSelectClaim({ x: userDrill.col, y: userDrill.row })}
            style={drillBtnStyles.active}
          >
            GO TO YOUR CLAIM ({userDrill?.col}, {userDrill?.row})
          </button>
          <div style={drillBtnStyles.countdown}>NEXT DRILL IN {drillCountdown}</div>
        </div>
      )}
      {drillStatus === "max-depth" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={drillBtnStyles.disabled}>MAX DEPTH REACHED</button>
          <div style={drillBtnStyles.depth}>DEPTH {DEPTH_Z}/{DEPTH_Z}</div>
        </div>
      )}
      {drillStatus === "drilled-today" && (
        <div style={drillBtnStyles.wrap}>
          <button disabled style={drillBtnStyles.disabled}>DRILLED TODAY</button>
          <div style={drillBtnStyles.countdown}>NEXT DRILL IN {drillCountdown}</div>
          <div style={drillBtnStyles.depth}>DEPTH {userDrill?.drillDay || 0}/{DEPTH_Z}</div>
        </div>
      )}
      {drillStatus === "ready" && (
        <div style={drillBtnStyles.wrap}>
          <button onClick={handleDailyDrill} style={drillBtnStyles.active}>
            DRILL
          </button>
          <div style={drillBtnStyles.depth}>DEPTH {userDrill?.drillDay || 0}/{DEPTH_Z}</div>
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

  // ── Player Drill Panel (depth profile for active players) ──
  const playerDrillPanel = !isAdmin && !isReport && effectiveDrillDay > 0 && activeUserDrill && (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>
        YOUR CLAIM ({activeUserDrill.col}, {activeUserDrill.row})
      </h3>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", color: theme.green }}>
          EXTRACTED: {playerExtracted.toLocaleString()} RL80
        </span>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", color: theme.accent }}>
          DEPTH {effectiveDrillDay}/{DEPTH_Z}
        </span>
      </div>
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
          <span style={{ fontSize: 11, letterSpacing: "0.12em", color: theme.accent }}>TANK</span>
          <span style={{ fontSize: 11, letterSpacing: "0.08em", color: tankFill >= 1.0 && !tankDrained ? theme.red : theme.muted }}>
            {tankDrained ? 0 : oilInTank.toLocaleString()} / {TANK_CAPACITY.toLocaleString()}
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
        {tankFill >= 1.0 && !tankDrained && (
          <div style={{
            fontSize: 10, letterSpacing: "0.12em", color: theme.red, marginTop: 4, textAlign: "center",
            animation: "tankPulse 1.2s ease-in-out infinite",
            fontWeight: 700,
          }}>
            TANK FULL — HIT THE RED BUTTON ON YOUR PUMP!
          </div>
        )}
        {tankDrained && (
          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: theme.green, marginTop: 2, textAlign: "right" }}>
            SENT TO COMMUNITY STORAGE
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
            {(activeUserDrill.totalCollected || 0).toLocaleString()} RL80
          </span>
        </div>
      )}
      <div style={{ fontSize: 11, letterSpacing: "0.15em", color: theme.accent, marginBottom: 6 }}>DEPTH PROFILE</div>
      <div style={styles.depthChart}>
        {Array.from({ length: DEPTH_Z }, (_, d) => {
          const drilled = d < effectiveDrillDay;
          const oil = drilled ? (stats.grid3D[activeUserDrill.col]?.[activeUserDrill.row]?.[d] ?? 0) : 0;
          const barWidth = drilled && playerMaxOil > 0 ? (oil / playerMaxOil) * 100 : 0;
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
        <div style={styles.scanlines} />
        <div style={styles.grain} />
        <style>{`.nav-mobile-home { background: transparent !important; border: none !important; box-shadow: none !important; }`}</style>

        {/* Header */}
        <header style={m.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoMark}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8922e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999"/>
                <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"/>
                <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/>
                <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/>
              </svg>
            </div>
            <div>
              <h1 style={{ ...styles.title, fontSize: 12 }}>HAIL MARY <br/>PROSPECTING CO.{modeBadge}</h1>
              <p style={styles.subtitle}>OIL PROSPECTOR</p>
            </div>
          </div>
          <div style={styles.headerRight} />
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
            <div id="oil-canvas" style={{ ...m.canvasWrap, marginBottom: -60 }}>
              <CleanCanvas
                camera={{ position: [0, 3.5, 4], fov: 50 }}
                style={{ width: "100%", height: "100%" }}
                gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
              >
                <SkyDome skyColor={env.sky} skyBottom={env.skyBottom} cloudOpacity={env.cloudOpacity} />
                {fireworksOn && <Fireworks quality={1} shellSize={1} />}
                {env.fog && <fog attach="fog" args={[env.fog, 20, 80]} />}
                <ambientLight intensity={env.ambient} />
                {env.hemi && <hemisphereLight args={[env.hemi.sky, env.hemi.ground, env.hemi.intensity]} />}
                <directionalLight position={[10, 15, 10]} intensity={env.dirA} />
                <directionalLight position={[-5, 10, -5]} intensity={env.dirB} />
                <pointLight position={[-8, 5, -8]} intensity={1.5} color={env.point} />
                <group position={[0, 1, 0]}>
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
                    onFlyTo={handleFlyTo}
                    pumpConfig={pumpConfig}
                    oilStrike={combinedStrike}
                    tankFill={tankFill}
                    onTankDrain={handleTankDrain}
                    communityOil={communityOil}
             
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
                      maxPolarAngle={Math.PI * 0.48}
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
              <div style={{ ...styles.cornerBracket, top: 6, left: 6 }} />
              <div style={{ ...styles.cornerBracket, top: 6, right: 6, transform: "scaleX(-1)" }} />
              <div style={{ ...styles.cornerBracket, bottom: 6, left: 6, transform: "scaleY(-1)" }} />
              <div style={{ ...styles.cornerBracket, bottom: 6, right: 6, transform: "scale(-1)" }} />
              <div style={styles.gridLabel}>
                {gridSize}&times;{gridSize}&times;{DEPTH_Z} VOXEL
              </div>
              <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 10, display: "flex", gap: 4 }}>
                <button
                  onClick={() => { if (!fireworksOn && envPreset !== "night") setEnvPreset("night"); setFireworksOn(f => !f); }}
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
                <button
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
              <div style={{ position: "absolute", top: 6, right: 6, zIndex: 10, display: "flex", gap: 3 }}>
                {[["day", <svg key="day-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>], ["dusk", <svg key="dusk-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>], ["night", <svg key="night-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>]].map(([key, icon]) => (
                  <button
                    key={key}
                    onClick={() => setEnvPreset(key)}
                    style={{
                      width: 26, height: 26,
                      background: envPreset === key ? "rgba(212,168,84,0.3)" : "rgba(212,168,84,0.1)",
                      border: envPreset === key ? `1px solid ${theme.goldBorder}` : `1px solid ${theme.cornerBorder}`,
                      borderRadius: 3,
                      color: theme.accent,
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >{icon}</button>
                ))}
                <button
                  onClick={() => { setDarkMode((d) => !d); setEnvPreset(darkMode ? "day" : "night"); }}
                  style={{
                    width: 26, height: 26,
                    background: darkMode ? "rgba(212,168,84,0.3)" : "rgba(212,168,84,0.1)",
                    border: `1px solid ${darkMode ? theme.goldBorder : theme.cornerBorder}`,
                    borderRadius: 3,
                    color: theme.accent,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >{darkMode ? "●" : "◐"}</button>
              </div>
            </div>
          )}

          {/* Surface Map */}
          {mobileTab === "surface" && (
            <div style={m.section}>
              <OilSurfaceMap
                claimTotals={showOilData ? stats.claimTotals : blankClaimTotals}
                maxClaimTotal={showOilData ? stats.maxClaimTotal : 0}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
                theme={theme}
                gridX={gridSize}
                gridY={gridSize}
              />
            </div>
          )}

          {/* Cross Section */}
          {mobileTab === "xsec" && (
            <div style={m.section}>
              <OilCrossSection
                grid3D={showOilData ? stats.grid3D : playerGrid3D}
                maxCellValue={showOilData ? stats.maxOil : playerMaxOil}
                sliceY={sliceY}
                selectedX={selectedX}
                drillDepth={showOilData ? drillDepth : effectiveDrillDay}
                onSelectX={handleSelectX}
                onSliceY={handleSliceY}
                theme={theme}
                gridX={gridSize}
                gridY={gridSize}
              />
            </div>
          )}

          {/* Panels below active view */}
          {testStepper}
          {drillButton}
          {playerDrillPanel}
          {isAdmin && parametersPanel}
          {(isAdmin || isReport) && demoDrillPanel}
          {(isAdmin || isReport) && inspectorPanel}
          {statsPanel}
          {(isAdmin || isReport) && topClaimsPanel}
          {(isAdmin || isReport) && dryZonesPanel}
          {(isAdmin || isReport) && depositsPanel}
          <HowToPlayPanel isMobile darkMode={darkMode} />
          <PimpMyPumpPanel config={pumpConfig} onChange={handleConfigChange} hasSelection={selectedX !== null} isMobile darkMode={darkMode} onSave={handleConfigSave} saving={configSaving} dirty={configDirty} isSignedIn={!!user} defaultExpanded={false} />
          {(isAdmin || isReport) && (
            <OilVerifyPanel
              numberOfDeposits={numberOfDeposits}
              totalOilBudget={totalOilBudget}
              onApplyHash={handleApplyHash}
            />
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
          onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
          onUserClick={() => {}}
          isUserSignedIn={!!user}
          isMenuOpen={isMenuOpen}
          userImage={user?.imageUrl}
          onBuyClick={() => setShowBuyModal(true)}
          isMobile
          show80sButton={false}
          darkMode={darkMode}
        />

        {/* Buy Modal */}
        <ThirdwebBuyModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
        />

        {/* CyberNav Menu Panel */}
        <CyberNav
          position="fixed"
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          showButton={false}
        />

        {cssAnimations}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DESKTOP LAYOUT — 3-column CSS grid
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={styles.root}>
      <div style={styles.scanlines} />
      <div style={styles.grain} />
      <style>{`.nav-mobile-home { background: transparent !important; border: none !important; box-shadow: none !important; }`}</style>

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8922e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999"/>
              <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"/>
              <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/>
              <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/>
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>HAIL MARY PROSPECTING CO.{modeBadge}</h1>
            <p style={styles.subtitle}>OIL PROSPECTOR</p>
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
          <NavControlsHome
            isPlaying={contextIsPlaying}
            onPlayMusic={() => play()}
            onStopMusic={() => pause()}
            onSkipTrack={() => nextTrack()}
            onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
            onUserClick={() => {}}
            isUserSignedIn={!!user}
            isMenuOpen={isMenuOpen}
            userImage={user?.imageUrl}
            show80sButton={false}
            hideMusicOnMobile
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
            style={{ width: "100%", height: "100%" }}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
          >
            <SkyDome skyColor={env.sky} skyBottom={env.skyBottom} cloudOpacity={env.cloudOpacity} />
            {fireworksOn && <Fireworks quality={2} shellSize={2} />}
            {env.fog && <fog attach="fog" args={[env.fog, 20, 80]} />}
            <ambientLight intensity={env.ambient} />
            {env.hemi && <hemisphereLight args={[env.hemi.sky, env.hemi.ground, env.hemi.intensity]} />}
            <directionalLight position={[10, 15, 10]} intensity={env.dirA} />
            <directionalLight position={[-5, 10, -5]} intensity={env.dirB} />
            <pointLight position={[-8, 5, -8]} intensity={1.5} color={env.point} />
            <group position={[0, 5, 0]}>
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
                onFlyTo={handleFlyTo}
                pumpConfig={pumpConfig}
                oilStrike={combinedStrike}
                tankFill={tankFill}
                onTankDrain={handleTankDrain}
                communityOil={communityOil}
   
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
                  minDistance={5}
                  maxDistance={45}
                  maxPolarAngle={Math.PI * 0.48}
                  target={[0, 3, 0]}
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
              onClick={() => { if (!fireworksOn && envPreset !== "night") setEnvPreset("night"); setFireworksOn(f => !f); }}
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
            <button
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
          <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: "flex", alignItems: "center", gap: 3 }}>
            {[["day", <svg key="day-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>], ["dusk", <svg key="dusk-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>], ["night", <svg key="night-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>]].map(([key, icon]) => (
              <button
                key={key}
                onClick={() => setEnvPreset(key)}
                style={{
                  width: 28, height: 28,
                  background: envPreset === key ? "rgba(212,168,84,0.3)" : "rgba(212,168,84,0.1)",
                  border: envPreset === key ? `1px solid ${theme.goldBorder}` : `1px solid ${theme.cornerBorder}`,
                  borderRadius: 3,
                  color: theme.accent,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >{icon}</button>
            ))}
            <button
              onClick={() => { setDarkMode((d) => !d); setEnvPreset(darkMode ? "day" : "night"); }}
              style={{
                width: 28, height: 28,
                background: darkMode ? "rgba(212,168,84,0.3)" : "rgba(212,168,84,0.1)",
                border: `1px solid ${darkMode ? theme.goldBorder : theme.cornerBorder}`,
                borderRadius: 3,
                color: theme.accent,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >{darkMode ? "●" : "◐"}</button>
            <button
              onClick={() => setPanelsCollapsed((p) => !p)}
              style={{
                padding: "5px 10px",
                background: "rgba(212,168,84,0.15)",
                border: `1px solid ${theme.goldBorder}`,
                borderRadius: 3,
                color: theme.accent,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.1em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {panelsCollapsed ? "◂ PANELS" : "RETRACT ▸"}
            </button>
          </div>
        </div>

        {/* Middle column */}
        {!panelsCollapsed && (
          <div style={styles.midColumn}>
            <div style={styles.midPanel}>
              <OilSurfaceMap
                claimTotals={showOilData ? stats.claimTotals : blankClaimTotals}
                maxClaimTotal={showOilData ? stats.maxClaimTotal : 0}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
                theme={theme}
                gridX={gridSize}
                gridY={gridSize}
              />
            </div>
            <div style={{ ...styles.midPanel, flex: 1, minHeight: 0 }}>
              <OilCrossSection
                grid3D={showOilData ? stats.grid3D : playerGrid3D}
                maxCellValue={showOilData ? stats.maxOil : playerMaxOil}
                sliceY={sliceY}
                selectedX={selectedX}
                drillDepth={showOilData ? drillDepth : effectiveDrillDay}
                onSelectX={handleSelectX}
                onSliceY={handleSliceY}
                theme={theme}
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
            {playerDrillPanel}
            {isAdmin && parametersPanel}
            {(isAdmin || isReport) && demoDrillPanel}
            {statsPanel}
            {(isAdmin || isReport) && inspectorPanel}
            {(isAdmin || isReport) && topClaimsPanel}
            {(isAdmin || isReport) && dryZonesPanel}
            {(isAdmin || isReport) && depositsPanel}
            <HowToPlayPanel darkMode={darkMode} />
            <PimpMyPumpPanel config={pumpConfig} onChange={handleConfigChange} hasSelection={selectedX !== null} darkMode={darkMode} onSave={handleConfigSave} saving={configSaving} dirty={configDirty} isSignedIn={!!user} defaultExpanded={false} />
            {(isAdmin || isReport) && (
              <OilVerifyPanel
                numberOfDeposits={numberOfDeposits}
                totalOilBudget={totalOilBudget}
                onApplyHash={handleApplyHash}
                gridX={gridSize}
                gridY={gridSize}
              />
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

      <PolaroidSnapshot
        trigger={snapshotTrigger}
        captureElementId="oil-canvas"
        label="Just added this oil claim to my portfolio!"
        backgroundImage="/LandGradient3.webp"
        onComplete={() => {
          setTimeout(() => setSnapshotTrigger(false), 100);
        }}
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
};

function getStyles(t) { return {
  root: {
    width: "100vw",
    height: "100vh",
    background: t.bg,
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
    background: `linear-gradient(180deg, ${t.headerBg} 0%, ${t.headerBg} 100%)`,
    backdropFilter: "blur(12px)",
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
    background: t.tintBg,
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

  // Middle column
  midColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    overflow: "hidden",
    borderRight: `1px solid ${t.border}`,
  },

  midPanel: {
    padding: "10px 12px",
    borderBottom: `1px solid ${t.border}`,
  },

  // Right side panel
  sidePanel: {
    overflowY: "auto",
    overflowX: "hidden",
    background: t.panelBg,
    backdropFilter: "blur(16px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  },

  panelSection: {
    padding: "12px 14px",
    borderBottom: `1px solid ${t.border}`,
  },

  panelTitle: {
    margin: "0 0 10px",
    fontSize: 11,
    fontWeight: 600,
    color: t.accent,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  rankIcon: {
    fontSize: 10,
    color: t.accent,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },

  statBlock: {
    padding: "6px 8px",
    background: t.tintBg,
    border: `1px solid ${t.border}`,
    borderRadius: 3,
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
    background: t.bg,
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
    background: `linear-gradient(180deg, ${t.headerBg} 0%, ${t.headerBg} 100%)`,
    backdropFilter: "blur(12px)",
  },

  scroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
  },

  seedBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    background: t.tintBg,
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
  },

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 11,
    fontWeight: 600,
    color: t.accent,
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
    background: t.tintBg,
  },

  tabBar: {
    flexShrink: 0,
    display: "flex",
    borderBottom: `1px solid ${t.border}`,
    background: t.headerBg,
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
    color: t.accent,
    borderBottom: `2px solid ${t.goldBorder}`,
    background: "rgba(212,168,84,0.1)",
  },
}; }
