"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { OrbitControls, useGLTF, Environment, ContactShadows, Stage } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import CleanCanvas from "@/components/canvas/CleanCanvas";

/* ─── Model ──────────────────────────────────────────────────────────── */
function OilModel({ animation, showSunglasses = true, paused = false, scrubTime = null, mixerRef }) {
  const gltf = useGLTF("/models/RL80_oil.glb");
  const mixer = useRef(null);
  const activeAction = useRef(null);
  const groupRef = useRef();
  const clonedScene = useRef(null);

  // Clone the scene once so we own the instance (SkeletonUtils preserves bone bindings)
  useEffect(() => {
    clonedScene.current = skeletonClone(gltf.scene);

    // Auto-center: compute bounding box and offset
    const box = new THREE.Box3().setFromObject(clonedScene.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    console.log("[PhotoStudio] Model bounds:", "center:", center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2), "size:", size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2), "min:", box.min.x.toFixed(2), box.min.y.toFixed(2), box.min.z.toFixed(2), "max:", box.max.x.toFixed(2), box.max.y.toFixed(2), box.max.z.toFixed(2));

    // Shift so the model sits on y=0 and is centered on x/z
    clonedScene.current.position.set(-center.x, -box.min.y, -center.z);

    if (groupRef.current) {
      groupRef.current.clear();
      groupRef.current.add(clonedScene.current);
    }
  }, [gltf.scene]);

  useEffect(() => {
    if (gltf.animations?.length && clonedScene.current) {
      mixer.current = new THREE.AnimationMixer(clonedScene.current);
      if (mixerRef) mixerRef.current = { mixer: mixer.current, animations: gltf.animations };
      const idx = Math.min(animation, gltf.animations.length - 1);
      const action = mixer.current.clipAction(gltf.animations[idx]);
      activeAction.current = action;
      action.play();
      return () => { mixer.current?.stopAllAction(); mixer.current = null; activeAction.current = null; };
    }
  }, [gltf.animations, animation, mixerRef]);

  // Handle pause/play
  useEffect(() => {
    if (activeAction.current) {
      activeAction.current.paused = paused;
    }
  }, [paused]);

  // Handle scrub
  useEffect(() => {
    if (scrubTime !== null && activeAction.current && mixer.current) {
      activeAction.current.paused = true;
      activeAction.current.time = scrubTime;
      mixer.current.update(0);
    }
  }, [scrubTime]);

  // Toggle sunglasses visibility
  useEffect(() => {
    if (!clonedScene.current) return;
    clonedScene.current.traverse((child) => {
      if (child.name === "Sunglasses" || child.name === "sunglasses") {
        child.visible = showSunglasses;
      }
    });
  }, [showSunglasses]);

  useFrame((_, delta) => {
    if (!paused && scrubTime === null) mixer.current?.update(delta);
  });

  return <group ref={groupRef} />;
}

/* ─── Lighting Rig ───────────────────────────────────────────────────── */
function LightingRig({ preset }) {
  const configs = {
    studio: { ambientIntensity: 0.4, dirIntensity: 2.5, dirPos: [5, 8, 5], fillIntensity: 0.8, fillPos: [-5, 3, -3], rimIntensity: 1.2, rimPos: [0, 5, -8] },
    dramatic: { ambientIntensity: 0.1, dirIntensity: 4, dirPos: [3, 10, 2], fillIntensity: 0.2, fillPos: [-6, 2, -2], rimIntensity: 2, rimPos: [-2, 6, -6] },
    soft: { ambientIntensity: 0.8, dirIntensity: 1.2, dirPos: [4, 6, 6], fillIntensity: 1.0, fillPos: [-4, 4, 4], rimIntensity: 0.4, rimPos: [0, 3, -5] },
    golden: { ambientIntensity: 0.3, dirIntensity: 3, dirPos: [8, 4, 2], fillIntensity: 0.5, fillPos: [-3, 6, 4], rimIntensity: 1.5, rimPos: [-4, 2, -6] },
    neon: { ambientIntensity: 0.5, dirIntensity: 0.5, dirPos: [2, 8, 3], fillIntensity: 2.5, fillPos: [-5, 2, 3], rimIntensity: 3, rimPos: [0, 4, -5] },
  };
  const c = configs[preset] || configs.studio;

  const fillColor = preset === "neon" ? "#1b51cdff" : preset === "golden" ? "#ffcc66" : "#8899bb";
  const rimColor = preset === "neon" ? "#ff006e" : preset === "golden" ? "#ff8833" : "#aabbdd";

  return (
    <>
      <ambientLight intensity={c.ambientIntensity} />
      <directionalLight position={c.dirPos} intensity={c.dirIntensity} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={c.fillPos} intensity={c.fillIntensity} color={fillColor} />
      <pointLight position={c.rimPos} intensity={c.rimIntensity} color={rimColor} distance={20} />
    </>
  );
}

/* ─── Background Plane ───────────────────────────────────────────────── */
function BackgroundPlane({ showBg }) {
  const { viewport } = useThree();
  const texture = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/oilBG8.webp", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      texture.current = tex;
      setLoaded(true);
    });
  }, []);

  if (!showBg || !loaded) return null;

  const scale = Math.max(viewport.width, viewport.height) * 1.5;
  return (
    <mesh position={[0, 1.2, -3]} renderOrder={-1}>
      <planeGeometry args={[scale * 1.6, scale]} />
      <meshBasicMaterial map={texture.current} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/* ─── Camera Presets ─────────────────────────────────────────────────── */
const CAMERA_PRESETS = {
  front:     { position: [0, 1.5, 5],    target: [0, 1, 0] },
  threeQ:    { position: [3, 2, 4],      target: [0, 1, 0] },
  side:      { position: [5, 1.5, 0],    target: [0, 1, 0] },
  low:       { position: [2, 0.3, 4],    target: [0, 1.2, 0] },
  top:       { position: [0, 6, 2],      target: [0, 0, 0] },
  closeup:   { position: [0, 1.8, 2.2],  target: [0, 1.6, 0] },
  hero:      { position: [-3, 1.5, 4.5], target: [0, 0.8, 0] },
  cinematic: { position: [4, 3, 5],      target: [0, 0.5, 0] },
};

function CameraController({ preset, controlsRef }) {
  const { camera } = useThree();
  const targetRef = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3() });
  const animating = useRef(false);
  const t = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    const p = CAMERA_PRESETS[preset];
    if (!p) return;
    startPos.current.copy(camera.position);
    if (controlsRef.current) startTarget.current.copy(controlsRef.current.target);
    targetRef.current.pos.set(...p.position);
    targetRef.current.look.set(...p.target);
    t.current = 0;
    animating.current = true;
  }, [preset, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    t.current = Math.min(t.current + delta * 2.2, 1);
    const ease = 1 - Math.pow(1 - t.current, 3);
    camera.position.lerpVectors(startPos.current, targetRef.current.pos, ease);
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTarget.current, targetRef.current.look, ease);
      controlsRef.current.update();
    }
    if (t.current >= 1) animating.current = false;
  });

  return null;
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function PhotoStudioPage() {
  const canvasRef = useRef();
  const controlsRef = useRef();
  const [lightPreset, setLightPreset] = useState("studio");
  const [cameraPreset, setCameraPreset] = useState("front");
  const [showBg, setShowBg] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [animIdx, setAnimIdx] = useState(0);
  const [captures, setCaptures] = useState([]);
  const [flash, setFlash] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [autoRotate, setAutoRotate] = useState(false);
  const [showSunglasses, setShowSunglasses] = useState(true);
  const [animPaused, setAnimPaused] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const [scrubbing, setScrubbing] = useState(false);
  const mixerInfoRef = useRef(null);

  const getClipDuration = useCallback(() => {
    if (!mixerInfoRef.current?.animations?.length) return 1;
    const idx = Math.min(animIdx, mixerInfoRef.current.animations.length - 1);
    return mixerInfoRef.current.animations[idx]?.duration || 1;
  }, [animIdx]);

  const takePhoto = useCallback(() => {
    const canvas = document.querySelector("#photo-studio-canvas canvas");
    if (!canvas) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          setCaptures((prev) => [{ url: dataUrl, timestamp: Date.now(), light: lightPreset, camera: cameraPreset }, ...prev]);
        } catch (e) {
          console.error("Capture failed:", e);
        }
      });
    });
  }, [lightPreset, cameraPreset]);

  const downloadPhoto = useCallback((url, index) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `RL80_photo_${index + 1}.png`;
    a.click();
  }, []);

  const downloadAll = useCallback(() => {
    captures.forEach((c, i) => {
      setTimeout(() => downloadPhoto(c.url, i), i * 300);
    });
  }, [captures, downloadPhoto]);

  useEffect(() => {
    const handler = (e) => {
      if (e.code === "Space") { e.preventDefault(); takePhoto(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [takePhoto]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0f", overflow: "hidden", fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>

      {/* ── Flash overlay ─────────────────────────────────── */}
      {flash && (
        <div style={{ position: "absolute", inset: 0, background: "white", zIndex: 999, opacity: 0.9, pointerEvents: "none", animation: "flashFade 200ms ease-out forwards" }} />
      )}

      {/* ── 3D Canvas ─────────────────────────────────────── */}
      <div id="photo-studio-canvas" style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <CleanCanvas
          ref={canvasRef}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
          shadows
          camera={{ position: [0, 1.5, 5], fov: 45 }}
          style={{ background: showBg ? "transparent" : bgColor }}
        >
          <Suspense fallback={null}>
            <BackgroundPlane showBg={showBg} />
            <LightingRig preset={lightPreset} />
            <OilModel animation={animIdx} showSunglasses={showSunglasses} paused={animPaused || scrubbing} scrubTime={scrubbing ? scrubTime : null} mixerRef={mixerInfoRef} />
            {showShadows && (
              <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={12} blur={2.5} far={4} />
            )}
            <CameraController preset={cameraPreset} controlsRef={controlsRef} />
            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.08}
              minDistance={1}
              maxDistance={20}
              autoRotate={autoRotate}
              autoRotateSpeed={1.5}
              target={[0, 1, 0]}
            />
          </Suspense>
        </CleanCanvas>
      </div>

      {/* ── Top Bar ───────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff3b30", boxShadow: "0 0 8px #ff3b30" }} />
          <span style={{ color: "#e8e8e8", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>Photo Studio</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ color: "#666", fontSize: 11 }}>SPACE to capture</span>
          {captures.length > 0 && (
            <button onClick={() => setShowGallery(!showGallery)} style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#ccc", fontSize: 11, padding: "4px 12px", borderRadius: 4, cursor: "pointer",
              letterSpacing: "0.08em",
            }}>
              {showGallery ? "CLOSE" : `GALLERY (${captures.length})`}
            </button>
          )}
        </div>
      </div>

      {/* ── Left Controls Panel ───────────────────────────── */}
      <div style={{
        position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 10,
        display: "flex", flexDirection: "column", gap: 12, width: 200,
      }}>
        {/* Lighting */}
        <ControlGroup label="LIGHTING">
          {["studio", "dramatic", "soft", "golden", "neon"].map((p) => (
            <PillBtn key={p} active={lightPreset === p} onClick={() => setLightPreset(p)}>{p}</PillBtn>
          ))}
        </ControlGroup>

        {/* Camera Angles */}
        <ControlGroup label="ANGLE">
          {Object.keys(CAMERA_PRESETS).map((p) => (
            <PillBtn key={p} active={cameraPreset === p} onClick={() => setCameraPreset(p)}>{p}</PillBtn>
          ))}
        </ControlGroup>

        {/* Options */}
        <ControlGroup label="OPTIONS">
          <ToggleRow label="Background" active={showBg} onToggle={() => setShowBg(!showBg)} />
          <ToggleRow label="Shadows" active={showShadows} onToggle={() => setShowShadows(!showShadows)} />
          <ToggleRow label="Auto-Rotate" active={autoRotate} onToggle={() => setAutoRotate(!autoRotate)} />
          <ToggleRow label="Sunglasses" active={showSunglasses} onToggle={() => setShowSunglasses(!showSunglasses)} />
          {!showBg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
              <span style={{ color: "#888", fontSize: 10 }}>Color</span>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{ width: 28, height: 18, border: "none", background: "none", cursor: "pointer", padding: 0 }}
              />
            </div>
          )}
        </ControlGroup>

        {/* Animation */}
        <ControlGroup label="ANIMATION">
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2, 3].map((i) => (
              <PillBtn key={i} active={animIdx === i} onClick={() => { setAnimIdx(i); setScrubbing(false); setScrubTime(null); setAnimPaused(false); }} style={{ flex: 1, justifyContent: "center" }}>
                {i + 1}
              </PillBtn>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <button
              onClick={() => { if (scrubbing) { setScrubbing(false); setScrubTime(null); } setAnimPaused(!animPaused); }}
              style={{
                background: animPaused ? "rgba(0,245,212,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${animPaused ? "rgba(0,245,212,0.3)" : "rgba(255,255,255,0.08)"}`,
                color: animPaused ? "#00f5d4" : "#888",
                fontSize: 10, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                letterSpacing: "0.05em", transition: "all 0.15s", flex: "0 0 auto",
              }}
            >
              {animPaused ? "PLAY" : "PAUSE"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={scrubbing ? (scrubTime / getClipDuration() * 100) : 0}
              onChange={(e) => {
                const pct = parseFloat(e.target.value) / 100;
                const dur = getClipDuration();
                setScrubbing(true);
                setScrubTime(pct * dur);
              }}
              onMouseUp={() => {
                if (!animPaused) {
                  setScrubbing(false);
                  setScrubTime(null);
                }
              }}
              style={{ flex: 1, accentColor: "#00f5d4", height: 4, cursor: "pointer" }}
            />
          </div>
        </ControlGroup>
      </div>

      {/* ── Capture Button (bottom center) ────────────────── */}
      <div style={{
        position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 10,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      }}>
        <button
          onClick={takePhoto}
          style={{
            width: 68, height: 68, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #fff, #ddd)",
            border: "4px solid rgba(255,255,255,0.3)",
            cursor: "pointer", position: "relative",
            boxShadow: "0 0 20px rgba(255,255,255,0.15), inset 0 2px 4px rgba(0,0,0,0.1)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => { e.target.style.transform = "scale(1.08)"; e.target.style.boxShadow = "0 0 30px rgba(255,255,255,0.3), inset 0 2px 4px rgba(0,0,0,0.1)"; }}
          onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 0 20px rgba(255,255,255,0.15), inset 0 2px 4px rgba(0,0,0,0.1)"; }}
        >
          <div style={{
            position: "absolute", inset: 6, borderRadius: "50%",
            border: "2px solid rgba(0,0,0,0.08)",
          }} />
        </button>
        <span style={{ color: "#555", fontSize: 10, letterSpacing: "0.15em" }}>CAPTURE</span>
      </div>

      {/* ── Gallery Panel ─────────────────────────────────── */}
      {showGallery && captures.length > 0 && (
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 280, zIndex: 20,
          background: "rgba(10,10,15,0.95)", borderLeft: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)", display: "flex", flexDirection: "column",
          animation: "slideIn 250ms ease-out",
        }}>
          <div style={{
            padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ color: "#aaa", fontSize: 11, letterSpacing: "0.12em" }}>
              {captures.length} PHOTO{captures.length !== 1 ? "S" : ""}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <SmallBtn onClick={downloadAll}>SAVE ALL</SmallBtn>
              <SmallBtn onClick={() => setCaptures([])} danger>CLEAR</SmallBtn>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {captures.map((c, i) => (
              <div key={c.timestamp} style={{
                borderRadius: 6, overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
              }}>
                <img
                  src={c.url}
                  alt={`Capture ${i + 1}`}
                  style={{ width: "100%", display: "block", cursor: "pointer" }}
                  onClick={() => downloadPhoto(c.url, i)}
                />
                <div style={{ padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: 9 }}>
                    {c.light} / {c.camera}
                  </span>
                  <button
                    onClick={() => downloadPhoto(c.url, i)}
                    style={{
                      background: "none", border: "none", color: "#888", fontSize: 9,
                      cursor: "pointer", letterSpacing: "0.08em", padding: "2px 6px",
                    }}
                  >
                    SAVE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inline Styles ─────────────────────────────────── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');

        @keyframes flashFade {
          from { opacity: 0.9; }
          to { opacity: 0; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        #photo-studio-canvas canvas {
          cursor: grab;
        }
        #photo-studio-canvas canvas:active {
          cursor: grabbing;
        }

        /* scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function ControlGroup({ label, children }) {
  return (
    <div style={{
      background: "rgba(10,10,15,0.85)", backdropFilter: "blur(16px)",
      borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
      padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <span style={{ color: "#555", fontSize: 9, letterSpacing: "0.16em", marginBottom: 2 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function PillBtn({ active, onClick, children, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
        border: active ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
        color: active ? "#e0e0e0" : "#666",
        fontSize: 10, padding: "4px 10px", borderRadius: 4,
        cursor: "pointer", letterSpacing: "0.05em",
        transition: "all 0.15s",
        textTransform: "capitalize",
        display: "flex", alignItems: "center",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, active, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "2px 0" }}
    >
      <span style={{ color: "#888", fontSize: 10 }}>{label}</span>
      <div style={{
        width: 28, height: 14, borderRadius: 7, position: "relative",
        background: active ? "rgba(0,245,212,0.3)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${active ? "rgba(0,245,212,0.4)" : "rgba(255,255,255,0.1)"}`,
        transition: "all 0.2s",
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", position: "absolute", top: 1,
          left: active ? 15 : 1,
          background: active ? "#00f5d4" : "#555",
          transition: "all 0.2s",
        }} />
      </div>
    </div>
  );
}

function SmallBtn({ onClick, children, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: danger ? "rgba(255,59,48,0.1)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${danger ? "rgba(255,59,48,0.2)" : "rgba(255,255,255,0.1)"}`,
        color: danger ? "#ff3b30" : "#999",
        fontSize: 9, padding: "3px 8px", borderRadius: 3,
        cursor: "pointer", letterSpacing: "0.08em",
      }}
    >
      {children}
    </button>
  );
}
