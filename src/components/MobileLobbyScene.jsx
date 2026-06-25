"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

// ── Mobile /trade lobby — "council of coins" lite-scene ──────────────────────
// A small angel+coins GLB animated in R3F (the only live WebGL on mobile),
// with a portrait textured onto each coin face. The GLB's motion supplies the
// liveliness, so the coin faces can be cheap static images. Tapping a coin
// opens a square intro overlay. START / service card (in the bottom nav) still
// launches a service.
//
// SWAP IN YOUR ASSETS:
//   • GLB        → public/models/mobile_angel_coins.glb  (path below)
//   • portraits  → set each consultant's `img` to e.g. "/images/consultants/gr80.webp"
//   • coin names → meshes whose name matches COIN_NAME_RE, sorted by name,
//                  map to CONSULTANTS in order. Name them Coin1..Coin4 (or
//                  Coin_GR80, etc.) to control the mapping.
const GLB_PATH = "/models/mobile_angel_coins.glb";
const COIN_NAME_RE = /coin/i;

// `img` = coin-face portrait + intro poster. `introVideo` = the per-character
// intro clip shown in the tap-to-meet square (set the path when clips exist;
// null falls back to the still portrait). `tagline` is an optional caption.
const CONSULTANTS = [
  { id: "gr80",    name: "GR80",    lens: "ETHOS",  accent: "#4dffaa", img: "/thumbnail_gr80.png",       introVideo: null, tagline: null },
  { id: "demon",   name: "Barron",  lens: "PATHOS", accent: "#ff5db1", img: "/thumbnail_johnBarron.png", introVideo: null, tagline: null },
  { id: "marisol", name: "Marisol", lens: "LOGOS",  accent: "#38e0d0", img: "/thumbnail_marisol.png",    introVideo: null, tagline: null },
  { id: "eugene",  name: "Eugene",  lens: "MYTHOS", accent: "#c49ff0", img: "/thumbnail_eugene.png",      introVideo: null, tagline: null },
];

// Generated placeholder coin face (accent ring + initials) so the scaffold
// renders before real portraits exist. Replaced by the real image when a
// consultant's `img` is set.
function makePlaceholderTexture(consultant) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0a0e14";
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = consultant.accent;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = consultant.accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 88px 'IBM Plex Mono', monospace";
  ctx.fillText(consultant.name.slice(0, 2).toUpperCase(), size / 2, size / 2 - 8);
  ctx.font = "bold 26px 'IBM Plex Mono', monospace";
  ctx.fillText(consultant.lens, size / 2, size / 2 + 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Composite a portrait into a gold-rimmed circular coin face. Keeps the coin
// as a single material while giving it a struck-metal rim that reads as a coin.
function makeCoinTexture(image, accent) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const cx = size / 2, cy = size / 2;
  const rOuter = size / 2 - 4;
  const rim = 30;
  const rInner = rOuter - rim;

  // Gold rim disc (light top → deep bottom for a struck-metal feel).
  const g = ctx.createLinearGradient(0, cy - rOuter, 0, cy + rOuter);
  g.addColorStop(0, "#ffeaa6");
  g.addColorStop(0.5, "#d8a93e");
  g.addColorStop(1, "#7e5a12");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.fill();

  // Portrait, cover-fit, clipped to the inner circle.
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rInner, 0, Math.PI * 2); ctx.clip();
  const s = Math.max((rInner * 2) / image.width, (rInner * 2) / image.height);
  const dw = image.width * s, dh = image.height * s;
  ctx.drawImage(image, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();

  // Crisp inner highlight + a faint accent ring at the portrait edge.
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,236,170,0.95)";
  ctx.beginPath(); ctx.arc(cx, cy, rInner, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.arc(cx, cy, rInner - 6, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function AngelCoins({ onCoinTap }) {
  const { scene, animations } = useGLTF(GLB_PATH);
  const { actions } = useAnimations(animations, scene);
  const { camera } = useThree();

  // Play whatever animation clips the GLB ships with (angel hover, coin drift).
  useEffect(() => {
    Object.values(actions || {}).forEach((a) => a && a.reset().play());
  }, [actions]);

  // Find coin meshes, assign a consultant + portrait to each.
  const coins = useMemo(() => {
    const found = [];
    scene.traverse((o) => {
      if (o.isMesh && COIN_NAME_RE.test(o.name)) found.push(o);
    });
    found.sort((a, b) => a.name.localeCompare(b.name));
    found.forEach((mesh, i) => {
      const consultant = CONSULTANTS[i % CONSULTANTS.length];
      // Replace the original coin material outright (it's metallic → renders
      // black without an env map). Unlit MeshBasicMaterial always shows the
      // texture. Start with a placeholder; when a portrait exists, composite it
      // into a gold-rimmed coin face and swap it in once the image loads.
      const mat = new THREE.MeshBasicMaterial({
        map: makePlaceholderTexture(consultant),
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
      });
      mesh.material = mat;
      if (consultant.img) {
        const img = new Image();
        img.onload = () => {
          mat.map = makeCoinTexture(img, consultant.accent);
          mat.needsUpdate = true;
        };
        img.src = consultant.img;
      }
      mesh.visible = true;
      mesh.frustumCulled = false;
      mesh.userData.consultant = consultant;
      // Coins import facing away — flip 180° so the portrait face points at the
      // camera. If the face ends up upside-down instead of front-facing, switch
      // rotateX → rotateY.
      mesh.rotateX(Math.PI);
    });
    return found;
  }, [scene]);

  // Gentle idle float — the GLB ships no animation clips, so the liveliness
  // is added here: each coin bobs around its modeled Y, slightly out of phase.
  // Tune amplitude (0.05) / speed (0.8) to taste once we see it in scene.
  // BILLBOARD is an off-by-default option; the coins carry their own facing
  // from the GLB. lookAt can flip a flat disc edge-on, so only enable it if a
  // coin's face turns away.
  const BILLBOARD = false;
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    coins.forEach((m, i) => {
      if (m.userData.baseY === undefined) m.userData.baseY = m.position.y;
      m.position.y = m.userData.baseY + Math.sin(t * 0.8 + i * 1.3) * 0.05;
      if (BILLBOARD) m.lookAt(camera.position);
    });
  });

  return (
    <primitive
      object={scene}
      onPointerDown={(e) => {
        const consultant = e.object && e.object.userData && e.object.userData.consultant;
        if (consultant) {
          e.stopPropagation();
          onCoinTap && onCoinTap(consultant);
        }
      }}
    />
  );
}

// Keeps a missing/broken GLB from crashing the page — falls back to the
// backdrop-only lobby until the asset lands.
class SceneBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { if (typeof console !== "undefined") console.warn("[MobileLobbyScene] GLB load failed:", err && err.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function MobileLobbyScene({ backdropSrc = null }) {
  const [intro, setIntro] = useState(null); // tapped consultant, or null

  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;

  return (
    <div className="mls-root">
      <style>{STYLES}</style>

      {/* Backdrop. Defaults to a CSS synthwave grid + starfield so the live
          GLB angel isn't doubled by a baked one. Pass backdropSrc to use an
          image set instead (use one WITHOUT the angel/coins). */}
      {backdropSrc
        ? <img className="mls-bg" src={backdropSrc} alt="" aria-hidden="true" />
        : <><div className="mls-stars" aria-hidden="true" /><div className="mls-grid" aria-hidden="true" /></>}

      <Canvas
        className="mls-canvas"
        camera={{ position: [0, 0.0, 6], fov: 40 }}
        dpr={dpr}
        gl={{ antialias: false, alpha: true, powerPreference: "default", stencil: false, depth: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ position: "absolute", inset: 0, zIndex: 3 }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 5]} intensity={1.1} />
        <Suspense fallback={null}>
          <SceneBoundary>
            <AngelCoins onCoinTap={setIntro} />
          </SceneBoundary>
        </Suspense>
      </Canvas>

      {/* Square intro overlay — placeholder. Drop the per-character intro
          <video> (+ voice/caption) into .mls-intro-media later. */}
      {intro && (
        <div className="mls-intro-backdrop" onClick={() => setIntro(null)}>
          <div className="mls-intro" onClick={(e) => e.stopPropagation()} style={{ borderColor: intro.accent }}>
            <button className="mls-intro-close" onClick={() => setIntro(null)} aria-label="Close">×</button>
            <div className="mls-intro-media" style={{ borderColor: intro.accent }}>
              {intro.introVideo ? (
                <video
                  key={intro.id}
                  src={intro.introVideo}
                  poster={intro.img || undefined}
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              ) : intro.img ? (
                <img src={intro.img} alt={intro.name} />
              ) : (
                <span style={{ color: intro.accent }}>{intro.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="mls-intro-name">{intro.name}</div>
            <div className="mls-intro-lens" style={{ color: intro.accent }}>{intro.lens}</div>
            <div className="mls-intro-caption">
              {intro.introVideo ? (intro.tagline || '') : 'Intro clip coming soon.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STYLES = `
.mls-root { position: absolute; inset: 0; overflow: hidden; background: #000; z-index: 2; }
.mls-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.mls-canvas { touch-action: manipulation; }

.mls-stars {
  position: absolute; top: 0; left: 0; right: 0; height: 60%; pointer-events: none;
  background-image:
    radial-gradient(1.2px 1.2px at 14% 24%, rgba(255,255,255,0.9), transparent),
    radial-gradient(1px 1px at 32% 12%, rgba(255,255,255,0.7), transparent),
    radial-gradient(1.3px 1.3px at 67% 20%, rgba(255,255,255,0.85), transparent),
    radial-gradient(1px 1px at 84% 14%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1.1px 1.1px at 90% 32%, rgba(255,255,255,0.75), transparent);
  animation: mls-twinkle 4.2s ease-in-out infinite;
}
.mls-grid {
  position: absolute; left: 50%; bottom: 0; width: 320%; height: 52%;
  transform: translateX(-50%) perspective(340px) rotateX(70deg);
  transform-origin: bottom center; pointer-events: none;
  background-image:
    linear-gradient(rgba(77,255,140,0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(77,255,140,0.32) 1px, transparent 1px);
  background-size: 46px 46px;
  -webkit-mask-image: linear-gradient(to top, #000 26%, transparent 88%);
          mask-image: linear-gradient(to top, #000 26%, transparent 88%);
}

.mls-intro-backdrop {
  position: fixed; inset: 0; z-index: 10040; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: rgba(2,4,8,0.72); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.mls-intro {
  position: relative; width: min(86vw, 360px); aspect-ratio: 1 / 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 18px; border: 1px solid; border-radius: 16px;
  background: linear-gradient(180deg, rgba(8,11,16,0.96), rgba(3,5,9,0.96));
  box-shadow: 0 0 30px rgba(0,0,0,0.6); font-family: 'IBM Plex Mono','SF Mono',Menlo,monospace; color: #e6f0f4;
}
.mls-intro-close {
  position: absolute; top: 8px; right: 10px; width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid rgba(180,190,210,0.25); background: rgba(8,10,16,0.6); color: #cdd8de;
  font-size: 18px; line-height: 1; cursor: pointer;
}
.mls-intro-media {
  position: relative; width: 56%; aspect-ratio: 1 / 1; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid; font-size: 40px; font-weight: 800; letter-spacing: 0.04em; margin-bottom: 6px;
  background: #0a0e14;
}
.mls-intro-media video, .mls-intro-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mls-intro-name { font-size: 18px; letter-spacing: 0.04em; }
.mls-intro-lens { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; }
.mls-intro-caption { margin-top: 4px; font-size: 11px; color: rgba(200,210,222,0.6); }

@keyframes mls-twinkle { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mls-stars { animation: none; } }
`;
