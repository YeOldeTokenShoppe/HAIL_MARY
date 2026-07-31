"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { EffectComposer, SelectiveBloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { createAsciiDecryptScreen } from "./asciiDecryptScreen";

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
const GLB_PATH = "/models/mobile_angel_coins3.glb";
const COIN_NAME_RE = /coin/i;

// The monitor "Screen" mesh (GLTFLoader may suffix duplicates → Screen_1).
// It's driven by the "ASCII decrypt" reveal ported from ascii-animation.html
// (see ./asciiDecryptScreen).
const SCREEN_NAME_RE = /^Screen(_\d+)?$/i;

// `img` = coin-face portrait + intro poster. `introVideo` = the per-character
// intro clip shown in the tap-to-meet square (set the path when clips exist;
// null falls back to the still portrait). `tagline` is an optional caption.
const CONSULTANTS = [
  { id: "gr80",    name: "GR80",    lens: "ETHOS",  accent: "#4dffaa", img: "/thumbnail_gr80.png",       introVideo: null, tagline: null },
  { id: "demon",   name: "Connor",  lens: "PATHOS", accent: "#ff5db1", img: "/thumbnail_johnBarron.png", introVideo: null, tagline: null },
  { id: "marisol", name: "Marisol", lens: "LOGOS",  accent: "#38e0d0", img: "/thumbnail_marisol.png",    introVideo: null, tagline: null },
  { id: "eugene",  name: "Eugene",  lens: "MYTHOS", accent: "#c49ff0", img: "/thumbnail_eugene.png",      introVideo: null, tagline: null },
];

// Placeholder shown for the beat before the portrait image loads: a blank
// gold coin with the SAME rim as the struck coin (makeCoinTexture), so the
// swap is seamless — no character-name text to flash. Center is neutral with
// a faint accent ring to hint the consultant.
function makePlaceholderTexture(consultant) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const cx = size / 2, cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter - 30;
  const g = ctx.createLinearGradient(0, cy - rOuter, 0, cy + rOuter);
  g.addColorStop(0, "#ffeaa6"); g.addColorStop(0.5, "#d8a93e"); g.addColorStop(1, "#7e5a12");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0a0e14";
  ctx.beginPath(); ctx.arc(cx, cy, rInner, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = consultant.accent;
  ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.arc(cx, cy, rInner - 6, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
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

function AngelCoins({ onCoinTap, onHalo }) {
  const { scene, animations } = useGLTF(GLB_PATH);
  const { actions } = useAnimations(animations, scene);
  const { camera, size } = useThree();

  // Play whatever animation clips the GLB ships with (angel hover, coin drift).
  useEffect(() => {
    Object.values(actions || {}).forEach((a) => a && a.reset().play());
  }, [actions]);

  // Find the coin meshes (gold-rim portraits) and Our Lady's halo (emissive,
  // lifted out for selective bloom).
  const { coins, halo, screen } = useMemo(() => {
    const found = [];
    let halo = null;
    let screenMesh = null;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (COIN_NAME_RE.test(o.name)) { found.push(o); return; }
      if (SCREEN_NAME_RE.test(o.name)) { screenMesh = o; return; }
      if (o.name === "Halo") {
        // Emissive green halo (from the archived selective-bloom setup).
        // toneMapped:false lets it exceed 1.0 so the bloom pass reads it hot.
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0xaaff88);
        o.material.emissiveIntensity = 1.5;
        o.material.transparent = true;
        o.material.opacity = 0.95;
        o.material.toneMapped = false;
        o.material.needsUpdate = true;
        halo = o;
      }
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
      // camera. Idempotent: capture the authored orientation once, then reset
      // to it before flipping, so a double-invoked useMemo (StrictMode / HMR)
      // on the cached GLTF can't accumulate rotations and land it upside-down.
      // (If the face ends up upside-down rather than front-facing, switch
      // rotateX → rotateY.)
      if (!mesh.userData._baseQuat) mesh.userData._baseQuat = mesh.quaternion.clone();
      mesh.quaternion.copy(mesh.userData._baseQuat);
      mesh.rotateX(Math.PI);
    });
    // Build the ascii-decrypt screen controller once per mesh (guard against a
    // double-invoked useMemo on the cached GLTF leaking a second texture).
    let screen = null;
    if (screenMesh) {
      if (!screenMesh.userData._ascii) screenMesh.userData._ascii = createAsciiDecryptScreen(screenMesh);
      screen = screenMesh.userData._ascii;
    }
    return { coins: found, halo, screen };
  }, [scene]);

  // Lift the halo mesh to the parent so the EffectComposer can bloom just it.
  useEffect(() => { if (onHalo) onHalo(halo); }, [halo, onHalo]);

  // Dispose the screen's canvas texture when this scene unmounts.
  useEffect(() => () => { if (screen) screen.dispose(); }, [screen]);

  // Throttle the ascii-decrypt redraw to ~20fps (the scramble shimmer reads fine
  // there, and it self-stops once settled). Pass real elapsed time so the
  // decrypt timeline stays accurate despite the throttle.
  const screenAccum = useRef(0);

  // Responsive framing: fit + center the content into the band ABOVE the bottom
  // nav (not the full viewport), so the bottom coins never tuck behind the nav
  // on short screens — yet it still fills nicely on tall ones. Self-calibrating
  // from the GLB bounds; recomputes on resize. Tune:
  //   MARGIN  — breathing room within the band (1.0 = edge-to-edge)
  //   NAV_PX  — bottom space to reserve (nav + safe area)
  //   TOP_PX  — top breathing room (under the title)
  // NOTE: raising the model in Blender won't move it — the camera re-centers on
  // the model bounds. These screen-space reserves are the lever instead.
  const MARGIN = 0.88;
  const NAV_PX = 7;
  const TOP_PX = 226;
  useEffect(() => {
    if (!scene || !size.width || !size.height) return;
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());
    const aspect = size.width / size.height;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const tan = Math.tan(vFov / 2);
    // Fit dim.y into the usable band (height minus nav/top), not the full height.
    const usableFrac = Math.max(0.4, (size.height - NAV_PX - TOP_PX) / size.height);
    const fitH = dim.y / (2 * tan * usableFrac);
    const fitW = dim.x / (2 * tan * aspect);
    const dist = MARGIN * Math.max(fitH, fitW);
    // Raise the content so it's centered in that band (reserve more at bottom).
    const worldH = 2 * dist * tan;
    const shift = ((NAV_PX - TOP_PX) / size.height) * (worldH / 2);
    camera.up.set(0, 1, 0);
    camera.position.set(center.x, center.y - shift, center.z + dist);
    camera.lookAt(center.x, center.y - shift, center.z);
    camera.updateProjectionMatrix();
  }, [scene, size.width, size.height, camera]);

  // Gentle idle float — the GLB ships no animation clips, so the liveliness
  // is added here: each coin bobs around its modeled Y, slightly out of phase.
  // Tune amplitude (0.05) / speed (0.8) to taste once we see it in scene.
  // BILLBOARD is an off-by-default option; the coins carry their own facing
  // from the GLB. lookAt can flip a flat disc edge-on, so only enable it if a
  // coin's face turns away.
  const BILLBOARD = false;
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    coins.forEach((m, i) => {
      if (m.userData.baseY === undefined) m.userData.baseY = m.position.y;
      m.position.y = m.userData.baseY + Math.sin(t * 0.8 + i * 1.3) * 0.05;
      if (BILLBOARD) m.lookAt(camera.position);
    });
    if (screen) {
      screenAccum.current += delta;
      if (screenAccum.current >= 0.05) {
        const elapsed = screenAccum.current;
        screenAccum.current = 0;
        screen.update(elapsed);
      }
    }
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
  const [halo, setHalo] = useState(null);   // Our Lady's halo mesh, for bloom

  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;

  return (
    <div className="mls-root">
      <style>{STYLES}</style>

      {/* Backdrop. Defaults to a CSS daytime blue sky (gradient + drifting
          clouds) so the live GLB angel isn't doubled by a baked one. Pass
          backdropSrc to use an image set instead (use one WITHOUT the angel/coins). */}
      {backdropSrc
        ? <img className="mls-bg" src={backdropSrc} alt="" aria-hidden="true" />
        : <><div className="mls-sky" aria-hidden="true" /><div className="mls-clouds" aria-hidden="true" /></>}

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
            <AngelCoins onCoinTap={setIntro} onHalo={setHalo} />
          </SceneBoundary>
        </Suspense>
        {/* Selective bloom — only Our Lady's halo glows (luminanceThreshold 0
            blooms the whole selection regardless of the rest of the scene). */}
        {halo && (
          <EffectComposer disableNormalPass>
            <SelectiveBloom
              selection={[halo]}
              intensity={2.0}
              luminanceThreshold={0}
              luminanceSmoothing={0.3}
              radius={0.6}
              mipmapBlur
            />
          </EffectComposer>
        )}
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
.mls-root { position: absolute; inset: 0; overflow: hidden; background: #bfe0f5; z-index: 2; }
.mls-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.mls-canvas { touch-action: manipulation; }

/* Daytime blue sky: deep azure at the zenith fading to pale haze at the horizon,
   with a soft sun glow in the upper area. */
.mls-sky {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(120% 70% at 78% 8%, rgba(255,252,235,0.55), transparent 42%),
    linear-gradient(to bottom, #3f86cf 0%, #6fb0e6 38%, #a9d6f2 72%, #e3f2fb 100%);
}
/* Drifting soft clouds — fluffy white radial blobs that slowly pan across. */
.mls-clouds {
  position: absolute; top: 0; left: -20%; right: -20%; height: 70%; pointer-events: none;
  background-image:
    radial-gradient(70px 28px at 18% 30%, rgba(255,255,255,0.95), transparent 70%),
    radial-gradient(90px 34px at 26% 38%, rgba(255,255,255,0.9), transparent 72%),
    radial-gradient(60px 24px at 33% 28%, rgba(255,255,255,0.85), transparent 70%),
    radial-gradient(80px 30px at 64% 18%, rgba(255,255,255,0.92), transparent 72%),
    radial-gradient(100px 36px at 73% 26%, rgba(255,255,255,0.88), transparent 72%),
    radial-gradient(64px 26px at 88% 44%, rgba(255,255,255,0.8), transparent 70%);
  background-repeat: no-repeat;
  animation: mls-drift 60s linear infinite;
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

@keyframes mls-drift { from { transform: translateX(0); } to { transform: translateX(6%); } }
@media (prefers-reduced-motion: reduce) { .mls-clouds { animation: none; } }
`;
