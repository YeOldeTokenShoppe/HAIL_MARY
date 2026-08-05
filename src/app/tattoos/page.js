"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import CleanCanvas from "@/components/canvas/CleanCanvas";

useGLTF.setDecoderPath("/draco/");

const MODEL = "/models/tattoos.glb";
const FPS = 24; // matches the Blender scene the GLB came out of

/*
 * The glTF exporter can't express Synty's skin/hair tint (a mask texture multiplied into
 * the atlas), so it wrote the *hair mask* into baseColorTexture for every material that
 * carried the tint chain. Each character therefore gets a pre-tinted atlas baked from the
 * same masks + colours, re-bound to its materials on load. See /public/textures/.
 */
const CAST = [
  {
    id: "surfer",
    name: "Surfer",
    accent: "#d9b26a",
    texture: "/textures/palmcity_surfer.webp",
    materials: ["MAT_01A.006", "MAT_01A.008"],
    x: -1.41,
    start: "skate",
    poses: [{ clip: "skate", label: "Skate", frac: 0 }],
  },
  {
    id: "biker",
    name: "Biker",
    accent: "#c2695f",
    texture: "/textures/palmcity_biker.webp",
    materials: ["MAT_01A", "MAT_01A.001", "MAT_01A.003"],
    x: 0,
    start: "sit_pose",
    poses: [
      { clip: "stand1", label: "Stand I" },
      { clip: "stand2", label: "Stand II" },
      { clip: "sit_pose", label: "Sit" },
      { clip: "taunt", label: "Taunt", frac: 0.25 },
    ],
  },
  {
    id: "girl",
    name: "Girl",
    accent: "#6f9ec4",
    texture: "/textures/palmcity_girl.webp",
    materials: ["MAT_01A.004", "MAT_01A.005"],
    x: 1.37,
    start: "femaleStand1",
    poses: [
      { clip: "femaleStand1", label: "Stand" },
      { clip: "kettlebell", label: "Kettlebell", frac: 0.3 },
    ],
  },
];

const SIGN_MATERIAL = "pasted___Polygon41";

/* ─── Cast ───────────────────────────────────────────────────────────── */
function Cast({ poses, showSign, onClips }) {
  const { scene, animations } = useGLTF(MODEL);
  const textures = useTexture(CAST.map((c) => c.texture));

  const root = useMemo(() => skeletonClone(scene), [scene]);

  // Re-bind the baked atlases and drop the exporter's blanket emissive.
  useMemo(() => {
    const byMaterial = {};
    CAST.forEach((c, i) => {
      const tex = textures[i];
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      c.materials.forEach((name) => (byMaterial[name] = tex));
    });

    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const wasArray = Array.isArray(o.material);
      const next = (wasArray ? o.material : [o.material]).map((m) => {
        const mat = m.clone();
        const tex = byMaterial[m.name];
        if (tex) mat.map = tex;
        if (m.name !== SIGN_MATERIAL) {
          mat.emissive = new THREE.Color(0, 0, 0);
          mat.emissiveMap = null;
        }
        mat.needsUpdate = true;
        return mat;
      });
      o.material = wasArray ? next : next[0];
    });
  }, [root, textures]);

  const clips = useMemo(() => {
    const map = {};
    animations.forEach((a) => (map[a.name] = a));
    return map;
  }, [animations]);

  useEffect(() => {
    onClips?.(clips);
  }, [clips, onClips]);

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  const actions = useRef({});

  // Every clip drives exactly one character's bones, so all three can hold their own
  // paused pose off a single mixer.
  useEffect(() => {
    CAST.forEach((c) => {
      const sel = poses[c.id];
      const clip = clips[c.poses[sel.index].clip];
      if (!clip) return;

      const prev = actions.current[c.id];
      if (prev && prev.getClip() !== clip) prev.stop();

      const action = mixer.clipAction(clip);
      action.reset();
      action.play();
      action.paused = true;
      action.time = THREE.MathUtils.clamp(sel.frac * clip.duration, 0, Math.max(clip.duration - 1e-4, 0));
      actions.current[c.id] = action;
    });
    mixer.update(0);
  }, [poses, clips, mixer]);

  useEffect(() => () => mixer.stopAllAction(), [mixer]);

  useEffect(() => {
    const sign = root.getObjectByName("SM_Prop_Sign_Tattoos_01");
    if (sign) sign.visible = showSign;
  }, [root, showSign]);

  return <primitive object={root} />;
}

/* ─── Camera ─────────────────────────────────────────────────────────── */
const CLOSE_VIEWS = {};
CAST.forEach((c) => {
  CLOSE_VIEWS[c.id] = { position: [c.x + 0.55, 1.35, 2.5], target: [c.x, 0.95, 0] };
});

// The cast spans ~2.8m of x, so "frame all" has to solve for the viewport's aspect —
// a portrait window otherwise crops straight through the outer two characters.
function frameAll(camera, size) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (size.width / size.height));
  const dist = Math.max(2.55 / Math.tan(hFov / 2), 1.5 / Math.tan(vFov / 2)) + 0.45;
  return { position: [0, 1.2, dist], target: [0, 1.0, 0] };
}

function CameraRig({ view, controlsRef }) {
  const { camera, size } = useThree();
  const from = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const to = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const t = useRef(1);

  useEffect(() => {
    const v = CLOSE_VIEWS[view.id] || frameAll(camera, size);
    from.current.pos.copy(camera.position);
    from.current.target.copy(controlsRef.current?.target ?? new THREE.Vector3());
    to.current.pos.set(...v.position);
    to.current.target.set(...v.target);
    t.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, camera, controlsRef]);

  useFrame((_, delta) => {
    if (t.current >= 1) return;
    t.current = Math.min(t.current + delta * 2.4, 1);
    const e = 1 - Math.pow(1 - t.current, 3);
    camera.position.lerpVectors(from.current.pos, to.current.pos, e);
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(from.current.target, to.current.target, e);
      controlsRef.current.update();
    }
  });

  return null;
}

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function TattoosPage() {
  const controlsRef = useRef();
  const [poses, setPoses] = useState(() => {
    const init = {};
    CAST.forEach((c) => {
      const index = Math.max(c.poses.findIndex((p) => p.clip === c.start), 0);
      init[c.id] = { index, frac: c.poses[index].frac ?? 0 };
    });
    return init;
  });
  const [showUI, setShowUI] = useState(false);
  const [clips, setClips] = useState({});
  const [view, setView] = useState({ id: "all", n: 0 });
  const [showSign, setShowSign] = useState(true);
  const [showShadow, setShowShadow] = useState(true);

  // n forces a re-frame even when the id is unchanged, so "Frame all" re-solves for the
  // current window size after a resize or an orbit.
  const goTo = (id) => setView((v) => ({ id, n: v.n + 1 }));

  const selectPose = (id, index) => {
    const c = CAST.find((x) => x.id === id);
    setPoses((p) => ({ ...p, [id]: { index, frac: c.poses[index].frac ?? 0 } }));
  };

  const scrub = (id, frac) => setPoses((p) => ({ ...p, [id]: { ...p[id], frac } }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "h" || e.key === "H") setShowUI((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="tattoos-page">
      <style>{`
        .tattoos-page {
          position: fixed; inset: 0; overflow: hidden;
          background: radial-gradient(ellipse at 50% 40%, #1b1b22 0%, #0a0a0f 70%);
          font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
          color: #e7e4dd;
        }
        .rail {
          position: absolute; z-index: 2; top: 0; left: 0; bottom: 0;
          width: 268px; padding: 22px 18px; overflow-y: auto;
          display: flex; flex-direction: column; gap: 14px;
          background: linear-gradient(90deg, rgba(8,8,12,.92) 0%, rgba(8,8,12,.72) 70%, transparent 100%);
        }
        .eyebrow { font-size: 10px; letter-spacing: .28em; color: #6d6a63; text-transform: uppercase; }
        .title { font-size: 19px; letter-spacing: .12em; margin: 2px 0 10px; }
        .card {
          border: 1px solid #26262e; border-radius: 3px; padding: 11px 12px 12px;
          background: rgba(18,18,24,.66); cursor: pointer; transition: border-color .18s, background .18s;
        }
        .card:hover { border-color: #3a3a46; }
        .card.active { background: rgba(26,26,34,.9); }
        .card-name { display: flex; align-items: center; gap: 7px; font-size: 13px; letter-spacing: .14em; }
        .dot { width: 6px; height: 6px; border-radius: 50%; }
        .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
        .chip {
          font: inherit; font-size: 10px; letter-spacing: .07em; padding: 4px 8px;
          border: 1px solid #303039; background: transparent; color: #8d8a83;
          border-radius: 2px; cursor: pointer; transition: all .15s;
        }
        .chip:hover { color: #d8d4cc; border-color: #4a4a57; }
        .chip.on { background: #e7e4dd; border-color: #e7e4dd; color: #0f0f14; }
        .frame-row { display: flex; justify-content: space-between; font-size: 9.5px; color: #6d6a63; margin-top: 10px; letter-spacing: .1em; }
        .rail input[type=range] { width: 100%; margin-top: 5px; accent-color: #cfcabf; height: 2px; }
        .toggles { display: flex; gap: 6px; margin-top: auto; padding-top: 16px; flex-wrap: wrap; }
        .hint { position: absolute; right: 20px; bottom: 16px; z-index: 2; font-size: 9.5px; letter-spacing: .16em; color: #55535c; }
        .rail.hidden { opacity: 0; pointer-events: none; transform: translateX(-14px); }
        .rail { transition: opacity .28s ease, transform .28s ease; }
        .peek {
          position: absolute; z-index: 3; left: 14px; top: 14px; width: 22px; height: 22px;
          border: 1px solid #2b2b34; border-radius: 2px; background: rgba(12,12,17,.6);
          cursor: pointer; padding: 0; opacity: .5; transition: opacity .2s, border-color .2s;
        }
        .peek::after { content: ''; position: absolute; inset: 6px; border-left: 1px solid #8d8a83; border-top: 1px solid #8d8a83; }
        .peek:hover { opacity: 1; border-color: #4a4a57; }
        .peek.away { opacity: 0; pointer-events: none; }
        @media (max-width: 720px) {
          .rail { top: auto; right: 0; width: auto; max-height: 52%;
                  background: linear-gradient(0deg, rgba(8,8,12,.95) 0%, rgba(8,8,12,.8) 80%, transparent 100%); }
          .hint { display: none; }
        }
      `}</style>

      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <CleanCanvas
          shadows
          camera={{ position: [0, 1.2, 6], fov: 42 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
          <ambientLight intensity={0.55} />
          {/* near/far and the two biases matter here: the default 0.5–500 shadow frustum
              has nowhere near enough depth precision for a 3m-wide scene, and the low-poly
              faces self-shadow into a diagonal moiré without a normal bias. */}
          <directionalLight
            position={[4, 7, 5]}
            intensity={2.4}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-2}
            shadow-camera-near={2}
            shadow-camera-far={20}
            shadow-normalBias={0.035}
            shadow-bias={-0.0004}
          />
          <directionalLight position={[-5, 3, 2]} intensity={0.7} color="#8f9fc0" />
          <pointLight position={[0, 2.5, -4]} intensity={2.2} color="#c98a6a" distance={14} />

          <Suspense fallback={null}>
            <Cast poses={poses} showSign={showSign} onClips={setClips} />
          </Suspense>

          {showShadow && (
            <ContactShadows position={[0, 0.001, 0]} scale={9} opacity={0.55} blur={2.4} far={4} resolution={1024} />
          )}

          <CameraRig view={view} controlsRef={controlsRef} />
          <OrbitControls
            ref={controlsRef}
            target={[0, 1, 0]}
            enablePan
            minDistance={0.9}
            maxDistance={12}
            maxPolarAngle={Math.PI / 2 + 0.08}
          />
        </CleanCanvas>
      </div>

      <div className={`rail${showUI ? "" : " hidden"}`}>
        <div>
          <div className="eyebrow">Palm City · cast sheet</div>
          <div className="title">TATTOOS</div>
        </div>

        {CAST.map((c) => {
          const sel = poses[c.id];
          const pose = c.poses[sel.index];
          const clip = clips[pose.clip];
          const duration = clip?.duration ?? 0;
          const total = Math.max(Math.round(duration * FPS) + 1, 1);
          const frame = Math.round(sel.frac * duration * FPS) + 1;
          const scrubbable = total > 2;

          return (
            <div
              key={c.id}
              className={`card${view.id === c.id ? " active" : ""}`}
              onClick={() => goTo(view.id === c.id ? "all" : c.id)}
            >
              <div className="card-name">
                <span className="dot" style={{ background: c.accent }} />
                {c.name.toUpperCase()}
              </div>

              <div className="chips" onClick={(e) => e.stopPropagation()}>
                {c.poses.map((p, i) => (
                  <button
                    key={p.clip}
                    className={`chip${i === sel.index ? " on" : ""}`}
                    onClick={() => selectPose(c.id, i)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="frame-row">
                <span>{pose.clip}</span>
                <span>{scrubbable ? `FRAME ${frame} / ${total}` : "SINGLE FRAME"}</span>
              </div>

              {scrubbable && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={1 / Math.max(total - 1, 1)}
                  value={sel.frac}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => scrub(c.id, parseFloat(e.target.value))}
                />
              )}
            </div>
          );
        })}

        <div className="toggles">
          <button className={`chip${view.id === "all" ? " on" : ""}`} onClick={() => goTo("all")}>
            Frame all
          </button>
          <button className={`chip${showSign ? " on" : ""}`} onClick={() => setShowSign((v) => !v)}>
            Sign
          </button>
          <button className={`chip${showShadow ? " on" : ""}`} onClick={() => setShowShadow((v) => !v)}>
            Shadow
          </button>
          <button className="chip" onClick={() => setShowUI(false)}>
            Hide
          </button>
        </div>
      </div>

      {showUI && <div className="hint">DRAG ORBIT · SCROLL ZOOM · CLICK A CARD TO PUSH IN</div>}

      <button
        className={`peek${showUI ? " away" : ""}`}
        onClick={() => setShowUI(true)}
        aria-label="Show controls"
        title="Show controls (H)"
      />
    </div>
  );
}

useGLTF.preload(MODEL);
