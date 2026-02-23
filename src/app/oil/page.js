"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { OrbitControls, Cloud, Clouds } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CleanCanvas from "@/components/canvas/CleanCanvas";
import OilVoxelGrid from "@/components/OilVoxelGrid";
import { generateOilDistribution3D } from "@/lib/oilDistribution";
import PimpMyPumpPanel, { getDefaultPumpConfig } from "@/components/PimpMyPumpPanel";

// ── Sky dome gradient ────────────────────────────────────────────────────────
function SkyDome() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[80, 24, 24]} />
        <meshBasicMaterial color="#7da4c9" side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <Clouds material={THREE.MeshBasicMaterial}>
        <Cloud position={[-8, 10, -12]} speed={0.02} opacity={0.25} width={1.2} depth={0.15} segments={4} />
        <Cloud position={[14, 12, -6]} speed={0.03} opacity={0.2} width={1.5} depth={0.12} segments={4} />
        <Cloud position={[3, 11, 16]} speed={0.015} opacity={0.22} width={1} depth={0.1} segments={3} />
        <Cloud position={[-12, 13, 8]} speed={0.025} opacity={0.18} width={1.8} depth={0.15} segments={4} />
        <Cloud position={[18, 9, 14]} speed={0.02} opacity={0.2} width={0.8} depth={0.1} segments={3} />
        <Cloud position={[-4, 14, -18]} speed={0.01} opacity={0.15} width={1.3} depth={0.12} segments={3} />
        <Cloud position={[10, 12, -16]} speed={0.02} opacity={0.18} width={1} depth={0.1} segments={3} />
      </Clouds>
    </group>
  );
}

const OilSurfaceMap = dynamic(() => import("@/components/OilSurfaceMap"), { ssr: false });
const OilCrossSection = dynamic(() => import("@/components/OilCrossSection"), { ssr: false });
const OilVerifyPanel = dynamic(() => import("@/components/OilVerifyPanel"), { ssr: false });

const DEFAULT_BLOCK_HASH =
  "0x8a3f7b2c91d4e6f5a0b3c8d7e2f1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0";

const GRID_X = 10;
const GRID_Y = 10;
const DEPTH_Z = 20;
const CELL_SIZE = 1;
const TANK_CAPACITY = 100_000;

// Continuous orbit exactly like the Three.js horse example. Stops when user interacts.
function CameraFlyIn({ onComplete }) {
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

    // Exactly like the Three.js example, scaled to this scene:
    // Scene is a 10x10 grid centered at origin, surface at y≈5
    const r = 8;
    camera.position.set(
      Math.sin(time / 10) * r,
      7 + 1.5 * Math.cos(time / 5),
      Math.cos(time / 10) * r,
    );
    camera.lookAt(0, 5, 0);
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

        // Look-at point: pumpjack center, slightly above ground
        endTarget.current.set(target.x, target.y - 0.05, target.z);

        // Camera: standing next to the pump, ground-level
        endPos.current.set(target.x + 0.5, target.y + 0.0, target.z + 0.5);

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

function useClaimStats(blockHash, numberOfDeposits, totalOilBudget) {
  return useMemo(() => {
    const { grid, deposits, maxOil } = generateOilDistribution3D({
      blockHash,
      gridX: GRID_X,
      gridY: GRID_Y,
      depthZ: DEPTH_Z,
      totalOilBudget,
      numberOfDeposits,
      depthBias: 0.35,
    });

    const claimTotals = [];
    let totalOil = 0;
    let maxClaimTotal = 0;
    for (let y = 0; y < GRID_Y; y++) {
      for (let x = 0; x < GRID_X; x++) {
        let sum = 0;
        for (let z = 0; z < DEPTH_Z; z++) {
          sum += grid[x][y][z];
        }
        claimTotals.push({ x, y, index: y * GRID_X + x, claim: y * GRID_X + x + 1, oil: sum, total: sum });
        totalOil += sum;
        if (sum > maxClaimTotal) maxClaimTotal = sum;
      }
    }

    const sorted = [...claimTotals].sort((a, b) => b.oil - a.oil);
    const dryClaims = claimTotals.filter((c) => c.oil === 0).length;

    return { grid3D: grid, claimTotals, sorted, deposits, maxOil, totalOil, dryClaims, maxClaimTotal };
  }, [blockHash, numberOfDeposits, totalOilBudget]);
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
  const [revealProgress, setRevealProgress] = useState(0);
  const [animateReveal, setAnimateReveal] = useState(false);
  const [blockHash, setBlockHash] = useState(DEFAULT_BLOCK_HASH);
  const [isRevealed, setIsRevealed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [numberOfDeposits, setNumberOfDeposits] = useState(8);
  const [totalOilBudget, setTotalOilBudget] = useState(100_000_000);

  // Mobile tab view
  const [mobileTab, setMobileTab] = useState("3d"); // "3d" | "surface" | "xsec"

  // 2D interaction state lifted up
  const [selectedX, setSelectedX] = useState(null);
  const [sliceY, setSliceY] = useState(0);
  const [drillDepth, setDrillDepth] = useState(0);
  const [isDrilling, setIsDrilling] = useState(false);

  // Demo drill day
  const [demoDay, setDemoDay] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);

  // Panel collapse for full 3D view
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);

  // Pimp My Pump customization
  const [pumpConfig, setPumpConfig] = useState(() => getDefaultPumpConfig());

  // Camera fly-to
  const [flyTarget, setFlyTarget] = useState(null);
  const controlsRef = useRef();
  const controlsRefMobile = useRef();

  const stats = useClaimStats(blockHash, numberOfDeposits, totalOilBudget);

  const hitRate = stats.claimTotals.length > 0
    ? Math.round(((GRID_X * GRID_Y - stats.dryClaims) / (GRID_X * GRID_Y)) * 100)
    : 0;

  const selectedClaimIndex = selectedX !== null ? sliceY * GRID_X + selectedX : null;

  // Tank fill: fraction of oil extracted relative to fixed tank capacity (100K tokens)
  // Can exceed 1.0 — gusher fires when it first crosses 1.0
  const tankFill = useMemo(() => {
    if (selectedX === null || demoDay === 0) return 0;
    let extracted = 0;
    for (let z = 0; z < Math.min(demoDay, DEPTH_Z); z++) {
      extracted += stats.grid3D[selectedX]?.[sliceY]?.[z] ?? 0;
    }
    return extracted / TANK_CAPACITY;
  }, [selectedX, sliceY, demoDay, stats]);

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

  // Detect oil strike: keyed by demoDay so each layer triggers independently
  const oilStrikeDay = useRef(-1);
  const oilStrike = useMemo(() => {
    if (selectedX === null || demoDay === 0) return 0;
    const depthIndex = demoDay - 1;
    if (depthIndex < 0 || depthIndex >= DEPTH_Z) return 0;
    const oilAtDepth = stats.grid3D[selectedX]?.[sliceY]?.[depthIndex] ?? 0;
    if (oilAtDepth > 0 && demoDay !== oilStrikeDay.current) {
      oilStrikeDay.current = demoDay;
      return demoDay; // unique trigger value per strike
    }
    return 0;
  }, [selectedX, sliceY, demoDay, stats.grid3D]);

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
  }, []);

  const handleSelectX = useCallback((x) => {
    setSelectedX(x);
    setDrillDepth(0);
  }, []);

  const handleSliceY = useCallback((y) => {
    setSliceY(y);
    setDrillDepth(0);
  }, []);

  const handleSelectClaim = useCallback((claim) => {
    setSelectedX(claim.x);
    setSliceY(claim.y);
    setDrillDepth(0);
  }, []);

  const flyIdRef = useRef(0);
  const handleFlyTo = useCallback((col, row) => {
    const worldW = GRID_X * CELL_SIZE;
    const worldD = GRID_Y * CELL_SIZE;
    const x = -worldW / 2 + col * CELL_SIZE + CELL_SIZE / 2;
    const z = worldD / 2 - row * CELL_SIZE - CELL_SIZE / 2;
    flyIdRef.current++;
    setFlyTarget({ x, y: 5.3, z, id: flyIdRef.current });
    setSelectedX(col);
    setSliceY(row);
    setDrillDepth(0);
  }, []);

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
          {[3, 5, 8, 12, 16].map((n) => (
            <button
              key={n}
              onClick={() => { setNumberOfDeposits(n); handleReset(); }}
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
              onClick={() => { setTotalOilBudget(n); handleReset(); }}
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
      <div style={{ ...styles.paramRow, marginTop: 6, paddingTop: 6, borderTop: "1px solid #d4c8b4" }}>
        <span style={styles.paramLabel}>HIT RATE</span>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: hitRate > 60 ? "#5a8a3a" : hitRate > 30 ? "#7a5a1a" : "#a05030",
        }}>
          {hitRate}%
        </span>
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
            fontSize: 9,
            minWidth: 50,
          }}
        >
          {demoPlaying ? "PAUSE" : "PLAY"}
        </button>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 11,
          fontWeight: 700,
          color: "#7a5a1a",
          minWidth: 80,
        }}>
          DAY {demoDay} / {DEPTH_Z}
        </span>
        <button
          onClick={() => { setDemoDay(0); setDemoPlaying(false); }}
          style={{ ...styles.paramBtn, padding: "4px 8px", fontSize: 8 }}
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
          accentColor: "#b8922e",
          cursor: "pointer",
        }}
      />
      {selectedX !== null && (
        <div style={{ fontSize: 9, color: "#7a5a1a", marginTop: 6 }}>
          SELECTED: ({selectedX}, {sliceY}) — click map to change
        </div>
      )}
    </div>
  );

  const statsPanel = (
    <div style={isMobile ? m.section : styles.panelSection}>
      <h3 style={isMobile ? m.sectionTitle : styles.panelTitle}>GEOLOGICAL SURVEY</h3>
      <div style={isMobile ? m.statGrid : styles.statGrid}>
        <StatBlock label="TOTAL OIL" value={<AnimNum value={stats.totalOil} />} unit="RL80" accent />
        <StatBlock label="DEPOSITS" value={stats.deposits.length} />
        <StatBlock label="CLAIMS" value={GRID_X * GRID_Y} />
        <StatBlock label="DEPTH" value={DEPTH_Z} unit="LVL" />
        <StatBlock label="PEAK CELL" value={<AnimNum value={stats.maxOil} />} unit="RL80" />
        <StatBlock label="DRY CLAIMS" value={stats.dryClaims} />
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
                #{stats.sorted.findIndex(r => r.index === selectedClaimIndex) + 1} of {GRID_X * GRID_Y}
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
                <span style={{ ...styles.inspectorKey, color: "#5a8a3a" }}>Extracted:</span>
                <span style={{ ...styles.inspectorVal, color: "#5a8a3a" }}>
                  {selectedData.extracted.toLocaleString()} RL80
                </span>
              </div>
              {drillDepth < DEPTH_Z && selectedData.missed > 0 && (
                <div style={styles.inspectorRow}>
                  <span style={{ ...styles.inspectorKey, color: "#a05030" }}>Underground:</span>
                  <span style={{ ...styles.inspectorVal, color: "#a05030" }}>
                    {selectedData.missed.toLocaleString()} RL80
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Depth Chart */}
          <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "#7a5a1a", marginTop: 10, marginBottom: 6 }}>DEPTH PROFILE</div>
          <div style={styles.depthChart}>
            {selectedData.depthData.map((oil, d) => {
              const barWidth = stats.maxOil > 0 ? (oil / stats.maxOil) * 100 : 0;
              const drilled = d < drillDepth;
              return (
                <div key={d} style={styles.depthRow}>
                  <span style={{
                    ...styles.depthRowLabel,
                    color: drilled ? "#7a5a1a" : "#9e8e78",
                  }}>
                    D{d + 1}
                  </span>
                  <div style={styles.depthBarWrap}>
                    <div style={{
                      width: `${barWidth}%`,
                      height: "100%",
                      background: drilled
                        ? "linear-gradient(90deg, #d4a854, #b8922e)"
                        : "linear-gradient(90deg, #c8bfb0, #b0a890)",
                      transition: "all 0.3s",
                    }} />
                  </div>
                  <span style={{
                    ...styles.depthRowVal,
                    color: drilled ? "#7a5a1a" : "#9e8e78",
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
              color: i === 0 ? "#7a5a1a" : i === 1 ? "#8b7d6b" : i === 2 ? "#9e8a60" : "#9e8e78",
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
            <span style={{ ...styles.rankClaim, color: "#a08070" }}>CLAIM {c.claim}</span>
            <span style={{ ...styles.rankOil, color: "#a08070" }}>{c.oil.toLocaleString()}</span>
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
    `}</style>
  );

  // ═══════════════════════════════════════════════════════════
  // MOBILE LAYOUT — tabbed views + scrollable panel below
  // ═══════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={m.root}>
        <div style={styles.scanlines} />
        <div style={styles.grain} />

        {/* Header */}
        <header style={m.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoMark}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L3 7v6l7 5 7-5V7l-7-5z" stroke="#b8922e" strokeWidth="1.5" fill="none" />
                <circle cx="10" cy="10" r="2.5" fill="#b8922e" />
              </svg>
            </div>
            <div>
              <h1 style={{ ...styles.title, fontSize: 12 }}>GET RICH QUICK</h1>
              <p style={styles.subtitle}>OIL PROSPECTOR</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.statusDot} />
            <span style={styles.statusText}>
              {isRevealed ? "REVEALED" : "ACTIVE"}
            </span>
          </div>
        </header>

        {/* Seed bar */}
        <div style={m.seedBar}>
          <span style={styles.seedLabel}>SEED</span>
          <span style={styles.seedValue}>{blockHash}</span>
        </div>

        {/* Controls */}
        <div style={m.inlineControls}>
          {controlButtons}
        </div>

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
            <div style={m.canvasWrap}>
              <CleanCanvas
                camera={{ position: [0, 8, 8], fov: 50 }}
                style={{ width: "100%", height: "100%" }}
                gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
              >
                <SkyDome />
                <ambientLight intensity={2.2} />
                <directionalLight position={[10, 15, 10]} intensity={15.5} />
                <directionalLight position={[-5, 10, -5]} intensity={15.6} />
                <pointLight position={[-8, 5, -8]} intensity={1.5} color="#4488ff" />
                <group position={[0, 1, 0]}>
                  <OilVoxelGrid
                    blockHash={blockHash}
                    numberOfDeposits={numberOfDeposits}
                    totalOilBudget={totalOilBudget}
                    revealProgress={revealProgress}
                    animateReveal={animateReveal}
                    revealDuration={2}
                    drillDay={demoDay}
                    selectedCol={selectedX}
                    selectedRow={selectedX !== null ? sliceY : null}
                    onSelectCell={(col, row) => { setSelectedX(col); setSliceY(row); setDrillDepth(0); }}
                    onFlyTo={handleFlyTo}
                    pumpConfig={pumpConfig}
                    oilStrike={combinedStrike}
                    tankFill={tankFill}
                  />
                </group>
                {introComplete ? (
                  <>
                    <OrbitControls
                      ref={controlsRefMobile}
                      enableDamping
                      dampingFactor={0.2}
                      minDistance={0.1}
                      maxDistance={15}
                      maxPolarAngle={Math.PI * 0.48}
                      zoomToCursor={true}
                      target={[0, 1, 0]}
                    />
                    <CameraFlyTo target={flyTarget} controlsRef={controlsRefMobile} />
                  </>
                ) : (
                  <CameraFlyIn onComplete={() => setIntroComplete(true)} duration={5} />
                )}
                <CameraShake shakeRef={shakeRef} />
              </CleanCanvas>
              <div style={{ ...styles.cornerBracket, top: 6, left: 6 }} />
              <div style={{ ...styles.cornerBracket, top: 6, right: 6, transform: "scaleX(-1)" }} />
              <div style={{ ...styles.cornerBracket, bottom: 6, left: 6, transform: "scaleY(-1)" }} />
              <div style={{ ...styles.cornerBracket, bottom: 6, right: 6, transform: "scale(-1)" }} />
              <div style={styles.gridLabel}>
                {GRID_X}&times;{GRID_Y}&times;{DEPTH_Z} VOXEL
              </div>
            </div>
          )}

          {/* Surface Map */}
          {mobileTab === "surface" && (
            <div style={m.section}>
              <OilSurfaceMap
                claimTotals={stats.claimTotals}
                maxClaimTotal={stats.maxClaimTotal}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
              />
            </div>
          )}

          {/* Cross Section */}
          {mobileTab === "xsec" && (
            <div style={m.section}>
              <OilCrossSection
                grid3D={stats.grid3D}
                maxCellValue={stats.maxOil}
                sliceY={sliceY}
                selectedX={selectedX}
                drillDepth={drillDepth}
                onSelectX={handleSelectX}
                onSliceY={handleSliceY}
              />
            </div>
          )}

          {/* Panels below active view — inspector+drill first */}
          {inspectorPanel}
          {statsPanel}
          {parametersPanel}
          {demoDrillPanel}
          {topClaimsPanel}
          {dryZonesPanel}
          {depositsPanel}
          <PimpMyPumpPanel config={pumpConfig} onChange={setPumpConfig} hasSelection={selectedX !== null} isMobile />
          <OilVerifyPanel
            numberOfDeposits={numberOfDeposits}
            totalOilBudget={totalOilBudget}
            onApplyHash={handleApplyHash}
          />
        </div>

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

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L3 7v6l7 5 7-5V7l-7-5z" stroke="#b8922e" strokeWidth="1.5" fill="none" />
              <circle cx="10" cy="10" r="2.5" fill="#b8922e" />
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>GET RICH QUICK</h1>
            <p style={styles.subtitle}>OIL PROSPECTOR</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.statusDot} />
          <span style={styles.statusText}>
            {isRevealed ? "DEPOSITS REVEALED" : "SURVEY ACTIVE"}
          </span>
        </div>
      </header>

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

      <div style={{
        ...styles.dashboard,
        gridTemplateColumns: panelsCollapsed ? "1fr" : "1fr 340px 280px",
      }}>
        {/* 3D Voxel View */}
        <div style={{
          ...styles.canvasWrap,
          borderRight: panelsCollapsed ? "none" : "1px solid #d4c8b4",
        }}>
          <CleanCanvas
            camera={{ position: [0, 8, 8], fov: 50 }}
            style={{ width: "100%", height: "100%" }}
            gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
          >
            <SkyDome />
            <ambientLight intensity={2.2} />
            <directionalLight position={[10, 15, 10]} intensity={15.5} />
            <directionalLight position={[-5, 10, -5]} intensity={15.6} />
            <pointLight position={[-8, 5, -8]} intensity={1.5} color="#4488ff" />
            <group position={[0, 5, 0]}>
              <OilVoxelGrid
                blockHash={blockHash}
                numberOfDeposits={numberOfDeposits}
                totalOilBudget={totalOilBudget}
                revealProgress={revealProgress}
                animateReveal={animateReveal}
                revealDuration={2}
                drillDay={demoDay}
                selectedCol={selectedX}
                selectedRow={selectedX !== null ? sliceY : null}
                onSelectCell={(col, row) => { setSelectedX(col); setSliceY(row); setDrillDepth(0); }}
                onFlyTo={handleFlyTo}
                pumpConfig={pumpConfig}
                oilStrike={combinedStrike}
                tankFill={tankFill}
              />
            </group>
            {introComplete ? (
              <>
                <OrbitControls
                  ref={controlsRef}
                  enableDamping
                  dampingFactor={0.08}
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
          <div style={{ ...styles.cornerBracket, top: 8, left: 8 }} />
          <div style={{ ...styles.cornerBracket, top: 8, right: 8, transform: "scaleX(-1)" }} />
          <div style={{ ...styles.cornerBracket, bottom: 8, left: 8, transform: "scaleY(-1)" }} />
          <div style={{ ...styles.cornerBracket, bottom: 8, right: 8, transform: "scale(-1)" }} />
          <div style={styles.gridLabel}>
            {GRID_X}&times;{GRID_Y}&times;{DEPTH_Z} VOXEL GRID
          </div>
          <button
            onClick={() => setPanelsCollapsed((p) => !p)}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 10,
              padding: "5px 10px",
              background: "rgba(212,168,84,0.15)",
              border: "1px solid #c8b080",
              borderRadius: 3,
              color: "#7a5a1a",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.1em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {panelsCollapsed ? "◂ PANELS" : "EXPAND ▸"}
          </button>
        </div>

        {/* Middle column */}
        {!panelsCollapsed && (
          <div style={styles.midColumn}>
            <div style={styles.midPanel}>
              <OilSurfaceMap
                claimTotals={stats.claimTotals}
                maxClaimTotal={stats.maxClaimTotal}
                selectedClaimIndex={selectedClaimIndex}
                onSelectClaim={handleSelectClaim}
              />
            </div>
            <div style={{ ...styles.midPanel, flex: 1, minHeight: 0 }}>
              <OilCrossSection
                grid3D={stats.grid3D}
                maxCellValue={stats.maxOil}
                sliceY={sliceY}
                selectedX={selectedX}
                drillDepth={drillDepth}
                onSelectX={handleSelectX}
                onSliceY={handleSliceY}
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
            {parametersPanel}
            {demoDrillPanel}
            {statsPanel}
            {inspectorPanel}
            {topClaimsPanel}
            {dryZonesPanel}
            {depositsPanel}
            <PimpMyPumpPanel config={pumpConfig} onChange={setPumpConfig} hasSelection={selectedX !== null} />
            <OilVerifyPanel
              numberOfDeposits={numberOfDeposits}
              totalOilBudget={totalOilBudget}
              onApplyHash={handleApplyHash}
            />
          </aside>
        )}
      </div>

      <div style={styles.controlBar}>
        {controlButtons}
        <div style={{ width: 1, height: 28, background: "#d4c8b4", margin: "0 4px" }} />
        <button
          onClick={() => {
            if (demoDay >= DEPTH_Z) setDemoDay(0);
            setDemoPlaying((p) => !p);
          }}
          style={{
            ...styles.btn,
            ...styles.btnPrimary,
            padding: "10px 16px",
          }}
        >
          {demoPlaying ? "PAUSE" : "▶ DRILL"}
        </button>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 11,
          fontWeight: 700,
          color: "#7a5a1a",
          minWidth: 70,
          textAlign: "center",
        }}>
          DAY {demoDay}/{DEPTH_Z}
        </span>
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
            width: 120,
            accentColor: "#b8922e",
            cursor: "pointer",
          }}
        />
        <button
          onClick={() => { setDemoDay(0); setDemoPlaying(false); }}
          style={styles.btn}
        >
          ↺ DAY 0
        </button>
        {selectedX !== null && (
          <button
            onClick={() => { setSelectedX(null); setDrillDepth(0); }}
            style={styles.btn}
          >
            ✕ DESELECT
          </button>
        )}
      </div>

      {cssAnimations}
    </div>
  );
}

function StatBlock({ label, value, unit, accent }) {
  return (
    <div style={styles.statBlock}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{
        ...styles.statValue,
        ...(accent ? { color: "#7a5a1a" } : {}),
      }}>
        {value}
        {unit && <span style={styles.statUnit}>{unit}</span>}
      </div>
    </div>
  );
}

const styles = {
  root: {
    width: "100vw",
    height: "100vh",
    background: "#f5efe6",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Share Tech Mono', 'Orbitron', monospace",
    color: "#5a4e3e",
    display: "flex",
    flexDirection: "column",
  },

  scanlines: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 100,
    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)",
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
    borderBottom: "1px solid #d4c8b4",
    background: "linear-gradient(180deg, rgba(245,239,230,0.97) 0%, rgba(245,239,230,0.9) 100%)",
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
    border: "1px solid #b8922e",
    borderRadius: 4,
  },

  title: {
    margin: 0,
    fontSize: 14,
    fontFamily: "'Orbitron', monospace",
    fontWeight: 800,
    color: "#7a5a1a",
    letterSpacing: "0.15em",
    lineHeight: 1.1,
  },

  subtitle: {
    margin: 0,
    fontSize: 9,
    fontWeight: 400,
    color: "#9e8e78",
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
    background: "#5a8a3a",
    boxShadow: "0 0 6px rgba(90,138,58,0.4)",
    animation: "pulse 2s ease-in-out infinite",
  },

  statusText: {
    fontSize: 10,
    color: "#7a8a6a",
    letterSpacing: "0.12em",
  },

  seedBar: {
    height: 28,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px",
    background: "rgba(180,160,130,0.1)",
    borderBottom: "1px solid #d4c8b4",
    zIndex: 15,
  },

  seedLabel: {
    fontSize: 9,
    color: "#8b7355",
    letterSpacing: "0.12em",
    flexShrink: 0,
  },

  seedValue: {
    fontSize: 10,
    color: "#8b7d6b",
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
    fontSize: 9,
    color: "#5a8a3a",
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
    borderRight: "1px solid #d4c8b4",
    overflow: "hidden",
  },

  cornerBracket: {
    position: "absolute",
    width: 20,
    height: 20,
    borderLeft: "1px solid rgba(139,105,20,0.3)",
    borderTop: "1px solid rgba(139,105,20,0.3)",
    pointerEvents: "none",
    zIndex: 5,
  },

  gridLabel: {
    position: "absolute",
    bottom: 12,
    left: 16,
    fontSize: 10,
    color: "#9e8e78",
    letterSpacing: "0.15em",
    zIndex: 5,
  },

  // Middle column
  midColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    overflow: "hidden",
    borderRight: "1px solid #d4c8b4",
  },

  midPanel: {
    padding: "10px 12px",
    borderBottom: "1px solid #d4c8b4",
  },

  // Right side panel
  sidePanel: {
    overflowY: "auto",
    overflowX: "hidden",
    background: "rgba(245,239,230,0.95)",
    backdropFilter: "blur(16px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  },

  panelSection: {
    padding: "12px 14px",
    borderBottom: "1px solid #d4c8b4",
  },

  panelTitle: {
    margin: "0 0 10px",
    fontSize: 9,
    fontWeight: 400,
    color: "#7a5a1a",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  rankIcon: {
    fontSize: 8,
    color: "#7a5a1a",
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },

  statBlock: {
    padding: "6px 8px",
    background: "rgba(180,160,130,0.08)",
    border: "1px solid #d4c8b4",
    borderRadius: 3,
  },

  statLabel: {
    fontSize: 7,
    color: "#9e8e78",
    letterSpacing: "0.15em",
    marginBottom: 3,
  },

  statValue: {
    fontSize: 14,
    fontFamily: "'Orbitron', monospace",
    fontWeight: 700,
    color: "#3e2e10",
    lineHeight: 1,
  },

  statUnit: {
    fontSize: 8,
    color: "#9e8e78",
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
    fontSize: 10,
    marginBottom: 3,
  },

  inspectorKey: {
    color: "#8b7d6b",
  },

  inspectorVal: {
    color: "#7a5a1a",
    fontFamily: "'Orbitron', monospace",
    fontSize: 10,
  },

  drillBtn: {
    width: "100%",
    padding: 8,
    background: "linear-gradient(180deg, #d4a854, #b8922e)",
    color: "#fff",
    border: "1px solid #b8922e",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: "0.12em",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    marginBottom: 8,
    transition: "all 0.2s",
  },

  drillBtnDisabled: {
    background: "#d4c8b4",
    color: "#9e8e78",
    cursor: "not-allowed",
    border: "1px solid #c8bfb0",
  },

  drillResults: {
    background: "rgba(180,160,130,0.08)",
    padding: 8,
    border: "1px solid #d4c8b4",
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
    gap: 3,
    height: 11,
  },

  depthRowLabel: {
    width: 20,
    fontSize: 7,
    textAlign: "right",
  },

  depthBarWrap: {
    flex: 1,
    height: 6,
    background: "#e8e0d4",
    position: "relative",
    overflow: "hidden",
  },

  depthRowVal: {
    width: 34,
    fontSize: 7,
    textAlign: "right",
  },

  emptyState: {
    fontSize: 10,
    color: "#9e8e78",
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
    fontSize: 10,
    padding: "3px 0",
  },

  rankNumber: {
    fontFamily: "'Orbitron', monospace",
    fontWeight: 700,
    fontSize: 9,
  },

  rankClaim: {
    color: "#6b5b47",
    fontSize: 9,
    letterSpacing: "0.06em",
  },

  rankOil: {
    color: "#5a4e3e",
    fontFamily: "'Orbitron', monospace",
    fontSize: 9,
    textAlign: "right",
  },

  rankBarWrap: {
    gridColumn: "1 / -1",
    height: 2,
    background: "#e0d8cc",
    borderRadius: 1,
    overflow: "hidden",
  },

  rankBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #b8922e, #d4a854)",
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
    fontSize: 9,
    padding: "2px 0",
  },

  depositIndex: {
    color: "#7a5a1a",
    fontFamily: "'Orbitron', monospace",
    fontSize: 8,
    opacity: 0.7,
    width: 14,
  },

  depositCoord: {
    color: "#6b5b47",
    fontFamily: "'Share Tech Mono', monospace",
    flex: 1,
  },

  depositRadius: {
    color: "#9e8e78",
    fontSize: 8,
  },

  depositHidden: {
    fontSize: 7,
    color: "#a05030",
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
    borderTop: "1px solid #d4c8b4",
    background: "linear-gradient(0deg, rgba(245,239,230,0.98) 0%, rgba(245,239,230,0.92) 100%)",
    backdropFilter: "blur(12px)",
    zIndex: 20,
  },

  btn: {
    padding: "10px 20px",
    background: "rgba(180,160,130,0.1)",
    border: "1px solid #c8bfb0",
    borderRadius: 3,
    color: "#6b5b47",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "all 0.2s ease",
  },

  btnPrimary: {
    background: "#d4a854",
    border: "1px solid #b8922e",
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
    fontSize: 7,
    color: "#9e8e78",
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
    background: "#f0e8dc",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#6b5b47",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 8,
    cursor: "pointer",
    transition: "all 0.15s",
  },

  paramBtnActive: {
    background: "#d4a854",
    border: "1px solid #b8922e",
    color: "#3e2e10",
  },
};

// ── Mobile-specific styles ──────────────────────────────────
const m = {
  root: {
    width: "100vw",
    height: "100dvh",
    background: "#f5efe6",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Share Tech Mono', 'Orbitron', monospace",
    color: "#5a4e3e",
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
    borderBottom: "1px solid #d4c8b4",
    background: "linear-gradient(180deg, rgba(245,239,230,0.97) 0%, rgba(245,239,230,0.9) 100%)",
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
    background: "rgba(180,160,130,0.1)",
    borderBottom: "1px solid #d4c8b4",
  },

  canvasWrap: {
    position: "relative",
    height: "55vw",
    minHeight: 220,
    maxHeight: 360,
    borderBottom: "1px solid #d4c8b4",
  },

  section: {
    padding: "12px 12px",
    borderBottom: "1px solid #d4c8b4",
  },

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 9,
    fontWeight: 400,
    color: "#7a5a1a",
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
    borderBottom: "1px solid #d4c8b4",
    background: "rgba(180,160,130,0.06)",
  },

  tabBar: {
    flexShrink: 0,
    display: "flex",
    borderBottom: "1px solid #d4c8b4",
    background: "rgba(245,239,230,0.97)",
  },

  tab: {
    flex: 1,
    padding: "8px 0",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#9e8e78",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.12em",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  tabActive: {
    color: "#7a5a1a",
    borderBottomColor: "#b8922e",
    background: "rgba(212,168,84,0.1)",
  },
};
