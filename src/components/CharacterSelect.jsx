"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ORACLE_VOICE, pickGreeting } from "@/lib/oracleSpeech";
import * as THREE from "three";

/* ── Image-based lighting for the portrait — metals are dead without an
      environment to reflect. RoomEnvironment is generated locally (no fetch). ── */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/* ── Neon frame model ── */

// Frame glow tuning. Each character sets its own hue (CHARACTERS[i].frameHue);
// the neon core is that hue, brightness-NORMALIZED then boosted to HDR so it
// drives bloom equally for dark and light hues; the glass shell is the hue
// lightened toward white. (Emission was previously kept low to avoid over-
// blooming a retired model's halo — that constraint is gone, so it's back up.)
const FRAME_DEFAULT_HUE = "#c300ff";
const FRAME_CORE_INTENSITY = 2.6;
const FRAME_GLASS_LIGHTEN = 0.4;

function NeonFrame({ hue = FRAME_DEFAULT_HUE, onLoaded }) {
  const groupRef = useRef();
  const coreMatsRef = useRef([]);
  const glassMatsRef = useRef([]);
  const hueRef = useRef(hue);
  hueRef.current = hue;

  const applyHue = (h) => {
    // Normalize the hue to a consistent brightness before the HDR boost, so a
    // dark saint's hue (e.g. Guadalupe's deep green) blooms as brightly as a
    // light one — a dark base color otherwise barely crosses the bloom
    // threshold and reads as a flat, unlit outline.
    const core = new THREE.Color(h);
    const maxCh = Math.max(core.r, core.g, core.b) || 1;
    core.multiplyScalar(FRAME_CORE_INTENSITY / maxCh);
    const glass = new THREE.Color(h).lerp(new THREE.Color("#ffffff"), FRAME_GLASS_LIGHTEN);
    coreMatsRef.current.forEach((m) => m.color.copy(core));
    glassMatsRef.current.forEach((m) => m.color.copy(glass));
  };

  // Re-tint when the active character changes
  useEffect(() => {
    applyHue(hue);
  }, [hue]);

  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load("/models/neonFrame.glb", (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          // Render the whole frame unlit so it looks identical for every
          // character regardless of the portrait's lighting rig. Neon cores
          // and the glass shell are collected for per-character tinting;
          // structure keeps its flat diffuse color.
          const m = child.material;
          const isEmissive = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01;
          const basic = new THREE.MeshBasicMaterial({
            color: m.color?.clone() || new THREE.Color("#222222"),
            transparent: m.transparent || false,
            opacity: m.opacity ?? 1,
          });
          // Frame paints over the mirror-swirl veil (renderOrder sandwich:
          // bust < swirl(10) < frame(20)) so the ring clips the fluid edge
          child.renderOrder = 20;
          if (isEmissive) {
            coreMatsRef.current.push(basic);
          } else if (m.transparent) {
            glassMatsRef.current.push(basic);
          }
          child.material = basic;
          m.dispose();
        }
      });
      applyHue(hueRef.current);
      if (groupRef.current) {
        groupRef.current.add(model);
      }
      // Frame is in the scene — the canvas may now reveal as one composed
      // unit (frame + swirl together) instead of the tubes popping in late.
      onLoaded?.();
    }, undefined, () => {
      // Load failure: reveal anyway (swirl + portrait still work frameless)
      onLoaded?.();
    });

    return () => {
      coreMatsRef.current = [];
      glassMatsRef.current = [];
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          const child = groupRef.current.children[0];
          groupRef.current.remove(child);
          child.traverse((node) => {
            if (node.isMesh) {
              node.geometry?.dispose();
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach((m) => m?.dispose());
            }
          });
        }
      }
      dracoLoader.dispose();
    };
  }, []);

  return <group ref={groupRef} position={[0, -2, 0]} scale={[2, 2, 2]} />;
}

/* ── Swirling magic-mirror veil over the frame's oval interior ── */

// Timing: full swirl after mount, then a noise-eaten dissolve reveals her.
const SWIRL_MS = 2000;
const SWIRL_DISSOLVE_MS = 1600;
// Ellipse fitted to the neon frame's inner opening (world units; camera view
// is ~1.66 units tall). Tune live: window.__mirrorSwirl = {x, y, rx, ry, z}.
// The veil ignores the depth buffer — layering is by renderOrder (bust <
// swirl < frame), so the neon ring paints over the fluid for a crisp edge.
const SWIRL_OVAL = { x: 0, y: -0.032, rx: 0.32, ry: 0.44, z: 0.1 };

const SWIRL_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SWIRL_FRAGMENT = `
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uHue;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return v;
  }
  // Rotate a color around the gray axis (cheap hue shift)
  vec3 hueShift(vec3 color, float shift) {
    const vec3 k = vec3(0.57735);
    float c = cos(shift);
    return color * c + cross(k, color) * sin(shift) + k * dot(k, color) * (1.0 - c);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard; // plane is scaled to the ellipse — this carves the oval

    // Fluid-dynamics marbling: iterated domain warp (fake advection) with
    // differential rotation — inner liquid spins faster than the rim, and a
    // counter-rotating undercurrent shears against it for visible churn
    float t = uTime * 0.3;
    float ang = uTime * 0.4 + (1.0 - r) * 2.6;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 sp = rot * p;
    float ang2 = -uTime * 0.25 - r * 1.4;
    mat2 rot2 = mat2(cos(ang2), -sin(ang2), sin(ang2), cos(ang2));
    vec2 cp = rot2 * p;
    vec2 q = vec2(
      fbm(sp * 1.6 + vec2(0.0, t)),
      fbm(sp * 1.6 + vec2(5.2, -t * 1.3))
    );
    vec2 w = vec2(
      fbm(cp * 1.6 + 2.4 * q + vec2(1.7, 9.2 + t * 0.7)),
      fbm(cp * 1.6 + 2.4 * q + vec2(8.3 - t, 2.8))
    );
    float f = fbm(sp * 1.6 + 2.8 * w);

    // Iridescent liquid palette derived from the character's frame hue:
    // the hue itself plus two hue-rotated companions, lifted toward pastel —
    // each character gets a distinct fluid
    vec3 pearl = vec3(0.93, 0.92, 0.90);
    vec3 tintA = mix(clamp(hueShift(uHue, 1.9), 0.0, 1.0), vec3(1.0), 0.30);
    vec3 tintB = mix(uHue, vec3(1.0), 0.20);
    vec3 tintC = mix(clamp(hueShift(uHue, -1.9), 0.0, 1.0), vec3(1.0), 0.35);

    vec3 col = mix(pearl, tintA, smoothstep(0.25, 0.62, length(q)));
    col = mix(col, tintB, smoothstep(0.30, 0.75, length(w) * 0.7));
    col = mix(col, tintC, smoothstep(0.55, 0.95, f) * 0.55);
    col += vec3(0.22) * smoothstep(0.68, 0.85, f);      // glossy sheen
    col *= mix(1.0, 0.82, smoothstep(0.6, 1.0, r));     // inner shadow at rim

    // Near-hard edge — the fluid runs under the frame ring, which clips it
    float edge = smoothstep(1.0, 0.97, r);
    // Noise-eaten dissolve — the liquid parts in patches as she appears
    float dissolve = smoothstep(uReveal - 0.18, uReveal + 0.18, fbm(p * 2.5) * 0.85 + r * 0.15);
    gl_FragColor = vec4(col, edge * dissolve);
  }
`;

function MirrorSwirl({ hue = FRAME_DEFAULT_HUE, active = true }) {
  const meshRef = useRef();
  const startRef = useRef(null);
  const [done, setDone] = useState(false);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uHue: { value: new THREE.Color(hue) },
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    uniforms.uHue.value.set(hue);
  }, [hue, uniforms]);

  useFrame((state) => {
    if (done || !meshRef.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    // Live oval fitting
    const o = (typeof window !== "undefined" && window.__mirrorSwirl) || SWIRL_OVAL;
    meshRef.current.position.set(o.x ?? 0, o.y ?? 0, o.z ?? SWIRL_OVAL.z);
    meshRef.current.scale.set(o.rx ?? SWIRL_OVAL.rx, o.ry ?? SWIRL_OVAL.ry, 1);
    // Hold the full swirl until `active` goes true — on /main the page keeps
    // it false (via pageLoading) until SitePal's face is actually loaded &
    // displayed, so the reveal countdown starts only once she's really there.
    if (!active) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const tMs = (state.clock.elapsedTime - startRef.current) * 1000;
    const reveal = Math.min(1, Math.max(0, (tMs - SWIRL_MS) / SWIRL_DISSOLVE_MS));
    uniforms.uReveal.value = reveal;
    if (reveal >= 1) setDone(true);
  });

  if (done) return null;
  return (
    <mesh
      ref={meshRef}
      position={[SWIRL_OVAL.x, SWIRL_OVAL.y, SWIRL_OVAL.z]}
      scale={[SWIRL_OVAL.rx, SWIRL_OVAL.ry, 1]}
      renderOrder={10}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={SWIRL_VERTEX}
        fragmentShader={SWIRL_FRAGMENT}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

/* ── Framed 3D portrait with live SitePal face projection ── */

// Crop rectangle into the SitePal canvas (600x450 internal) — tune live in
// the console via window.__portraitCrop = { x, y, w, h }, then bake here.
const DEFAULT_PORTRAIT_CROP = { x: 175, y: 60, w: 190, h: 285 };

// How strongly the rigid head group follows the tracked SitePal head drift,
// in radians per source-pixel. Tune live via
// window.__portraitHeadGain = { yaw, pitch } — negative flips direction, 0 disables.
const DEFAULT_HEAD_GAIN = { yaw: 0.006, pitch: -0.006 };

// Tracker smoothing per frame (0–1). Too low and the face visibly slides
// under the scarf before the lock catches up; too high and it jitters.
// Tune live via window.__portraitTrackLerp.
const DEFAULT_TRACK_LERP = 0.01;

// Deep desaturated Marian blue for the headwear. The Blender material's
// node-driven base color doesn't export (glTF can't evaluate node graphs),
// so the shift is applied here.
const FABRIC_BLUE = "#2e4468";
// How far the exported fabric colors are pulled toward FABRIC_BLUE (keeps
// the two-tone difference between the hood materials), then darkened.
const FABRIC_BLUE_MIX = 0.7;
const FABRIC_DARKEN = 0.8;
// Fabric side-shadow gradient (fake AO): floor = brightness when fully
// side-on, range = how quickly it reaches full brightness facing the viewer.
// Tune live via window.__portraitShade = { floor, range }.
const SHADE_DEFAULT = { floor: 0.25, range: 0.85 };

// Bust size (world units of the ~1.66-unit-tall camera view) and vertical
// placement inside the shared neon frame's oval opening. The loader
// auto-normalizes the GLB (centers + rescales it), so Blender-side position/
// scale changes are cancelled — placement is tuned HERE, or live via
// window.__portraitFit / window.__portraitYOffset, then baked into these.
const PORTRAIT_FIT = 0.95;
const PORTRAIT_Y_OFFSET = -0.08;
// Depth seat: negative pushes the bust back into the frame, away from the
// camera. Live: window.__portraitZOffset.
const PORTRAIT_Z_OFFSET = -0.2;

// Procedural drape bump: long vertical creases + fabric micro-noise. The
// Blender wave+noise bump nodes don't survive glTF export, so an equivalent
// is generated here as a canvas bump map.
function makeDrapeBumpTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Long vertical creases with a slow horizontal wobble down the drape
      const wave =
        Math.sin((x + Math.sin(y * 0.02) * 6) * 0.18) * 0.5 +
        Math.sin(x * 0.31 + y * 0.01) * 0.25;
      const noise = (Math.random() - 0.5) * 0.5; // micro-surface
      const v = Math.max(0, Math.min(255, 128 + wave * 48 + noise * 40));
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

// Find SitePal's render canvas: older player creates 2+ (animated one last),
// current player renders a single canvas — accept a lone one after a grace period.
// containerId selects WHICH embed to mirror — pages that mount more than one
// portal (see /main) give each its own container; the default is the single
// hidden embed every other page uses.
function waitForSitePalCanvas(timeout = 30000, containerId = "sitepal-container") {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let firstCanvasAt = 0;
    const check = () => {
      const container = document.getElementById(containerId);
      // A container may hold the embed directly (single-portal pages) or an
      // iframe carrying one isolated character (/main's multi-character
      // triptych). The frame is same-origin, so its canvas reads normally.
      const frame = container?.querySelector("iframe");
      const scope = frame ? frame.contentDocument : container;
      const canvases = scope ? scope.querySelectorAll("canvas") : [];
      if (canvases.length >= 2) return resolve(canvases[canvases.length - 1]);
      if (canvases.length === 1) {
        if (!firstCanvasAt) firstCanvasAt = Date.now();
        if (Date.now() - firstCanvasAt > 1500) return resolve(canvases[0]);
      }
      if (Date.now() - start > timeout) {
        if (canvases.length > 0) return resolve(canvases[canvases.length - 1]);
        return reject(new Error("SitePal canvas not found"));
      }
      setTimeout(check, 250);
    };
    check();
  });
}

function FramedPortraitModel({ url }) {
  const groupRef = useRef();
  const faceTexRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const sourceRef = useRef(null);
  const headGroupRef = useRef(null);
  const shadeUniformRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let drapeBumpTex = null; // generated stand-in until textures are baked
    if (!shadeUniformRef.current) {
      shadeUniformRef.current = { value: new THREE.Vector2(SHADE_DEFAULT.floor, SHADE_DEFAULT.range) };
    }
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(url, (gltf) => {
      if (cancelled) return;
      const model = gltf.scene;

      // Keep only the bust — the shared neonFrame.glb provides the frame now.
      // Stray meshes in the export (old frame pieces, hidden reference
      // models) would render and skew the auto-fit otherwise.
      const allowed = /^(face|head|bust|neck|Halo|fabric5_4)/;
      const strays = [];
      model.traverse((child) => {
        if (child.isMesh && !allowed.test(child.name)) strays.push(child);
      });
      strays.forEach((m) => {
        m.removeFromParent();
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mm) => mm?.dispose());
      });

      // Normalize: center on origin and fit inside the neon frame's oval
      const box = new THREE.Box3().setFromObject(model);
      const sizeV = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z) || 1;
      const s = PORTRAIT_FIT / maxDim;
      model.scale.setScalar(s);
      model.position.copy(center).multiplyScalar(-s);
      model.position.y += PORTRAIT_Y_OFFSET;
      model.position.z += PORTRAIT_Z_OFFSET;

      model.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (child.name === "face") {
          // Live SitePal projection target
          const cropCanvas = document.createElement("canvas");
          cropCanvas.width = 512;
          cropCanvas.height = 512;
          // Pre-fill with skin tone, then a static snapshot of her face while
          // SitePal boots — the live feed overwrites it seamlessly (same face,
          // same crop) once it arrives. Regenerate the snapshot if the scene
          // avatar or DEFAULT_PORTRAIT_CROP changes materially.
          const preCtx = cropCanvas.getContext("2d");
          preCtx.fillStyle = "#9F7854";
          preCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
          const placeholder = new Image();
          placeholder.onload = () => {
            // Skip if the live projection has already started
            if (sourceRef.current || cancelled) return;
            preCtx.drawImage(placeholder, 0, 0, cropCanvas.width, cropCanvas.height);
            if (faceTexRef.current) faceTexRef.current.needsUpdate = true;
          };
          placeholder.src = "/images/portraitFacePlaceholder.webp";
          const tex = new THREE.CanvasTexture(cropCanvas);
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = false;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          child.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
          cropCanvasRef.current = cropCanvas;
          faceTexRef.current = tex;
        } else if (
          child.name === "headscarf" ||
          /^headwear(?!_trim)/.test(child.name) ||
          /^headwear(?!_trim)/.test(child.parent?.name || "")
        ) {
          // Marian-blue fabric. (Multi-material meshes arrive from GLTFLoader
          // as sibling meshes under a "headwear" group — hence the parent
          // check.) Keeps the exported materials and applies script-side:
          //  1. darken + desaturate toward deep Marian blue (two-tone kept)
          //  2. cloth sheen for the grazing-angle edge highlight
          //  3. drape-crease bump (stand-in until textures are baked)
          //  4. view-facing shade gradient so the sides fall into shadow
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (!mat.map) {
              mat.color.lerp(new THREE.Color(FABRIC_BLUE), FABRIC_BLUE_MIX).multiplyScalar(FABRIC_DARKEN);
            }
            if (mat.sheen !== undefined) {
              if (!mat.sheen) {
                mat.sheen = 0.5;
                mat.sheenColor.set("#7f96d6");
                mat.sheenRoughness = 0.45;
              } else if (mat.sheenColor.r > 0.95 && mat.sheenColor.g > 0.95 && mat.sheenColor.b > 0.95) {
                // A full-white authored sheen silvers the hood under IBL — tint it
                mat.sheenColor.set("#7f96d6");
              }
            }
            if (!mat.normalMap && !mat.bumpMap) {
              if (!drapeBumpTex) drapeBumpTex = makeDrapeBumpTexture();
              mat.bumpMap = drapeBumpTex;
              mat.bumpScale = 0.6;
            }
            mat.polygonOffset = true;
            mat.polygonOffsetFactor = -2;
            mat.polygonOffsetUnits = -2;
            // Fake AO: darken the fabric as the surface turns away from the
            // viewer, like the Blender normal-based shadow gradient
            mat.onBeforeCompile = (shader) => {
              shader.uniforms.uShade = shadeUniformRef.current;
              shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", "#include <common>\nuniform vec2 uShade;")
                .replace(
                  "#include <color_fragment>",
                  `#include <color_fragment>
                  {
                    float facing = clamp(normalize(vNormal).z, 0.0, 1.0);
                    diffuseColor.rgb *= mix(uShade.x, 1.0, smoothstep(0.0, uShade.y, facing));
                  }`
                );
            };
            mat.customProgramCacheKey = () => "portraitFabricShade";
            mat.needsUpdate = true;
          });
          child.renderOrder = 2;
        } else if (child.name === "collar") {
          // White fabric — soft linen sheen. Knocked well below pure white:
          // a near-white material under IBL + key + point light overexposes
          // into a featureless glow otherwise.
          const old = child.material;
          const collarColor = (old.color?.clone() || new THREE.Color("#f2f7f3")).multiplyScalar(0.68);
          child.material = new THREE.MeshPhysicalMaterial({
            color: collarColor,
            roughness: 0.92,
            metalness: 0,
            sheen: 0.6,
            sheenColor: new THREE.Color("#ffffff"),
            sheenRoughness: 0.65,
            envMapIntensity: 0.35,
            polygonOffset: true,
            polygonOffsetFactor: 2,
            polygonOffsetUnits: 2,
          });
          child.renderOrder = 1;
          old.dispose();
        } else if (child.name === "neck") {
          // Polished silvery metal
          const old = child.material;
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#c3cad6"),
            metalness: 1,
            roughness: 0.28,
          });
          old.dispose();
        } else if (child.material.emissive && (child.material.emissive.r + child.material.emissive.g + child.material.emissive.b) > 0) {
          // Emissive frame/halo glow through Bloom — keep intensity modest so
          // the filigree detail isn't swallowed by the glow
          child.material.toneMapped = false;
          child.material.emissiveIntensity = Math.max(child.material.emissiveIntensity || 1, 1.0);
        }
      });

      if (groupRef.current) groupRef.current.add(model);

      // Re-parent the face plate + veil + hair + halo into one rigid "head"
      // group pivoted at the chin line, so the whole headdress can rotate
      // together following the SitePal head. attach() preserves world
      // transforms, so nothing visually moves during re-parenting.
      if (groupRef.current) {
        groupRef.current.updateMatrixWorld(true);
        const collected = [];
        let faceMesh = null;
        model.traverse((child) => {
          if (!child.isMesh) return;
          if (child.name === "face") faceMesh = child;
          if (
            child.name === "face" ||
            child.name === "head" ||
            child.name === "headscarf" ||
            /^headwear/.test(child.name) ||
            /^fabric5_4/.test(child.name) ||
            /Hair/i.test(child.name) ||
            /^Halo/.test(child.name)
          ) {
            collected.push(child);
          }
        });
        // Only attach hierarchy roots — children of collected parts (e.g.
        // headscarf under face) already ride along with their parent
        const set = new Set(collected);
        const headParts = collected.filter((p) => {
          let a = p.parent;
          while (a) {
            if (set.has(a)) return false;
            a = a.parent;
          }
          return true;
        });
        if (faceMesh && headParts.length) {
          const faceBox = new THREE.Box3().setFromObject(faceMesh);
          const pivot = faceBox.getCenter(new THREE.Vector3());
          pivot.y = faceBox.min.y; // neck-level pivot at the chin line
          const headGroup = new THREE.Group();
          headGroup.position.copy(pivot);
          groupRef.current.add(headGroup);
          headGroup.updateMatrixWorld(true);
          headParts.forEach((p) => headGroup.attach(p));
          headGroupRef.current = headGroup;
        }
      }
    });

    waitForSitePalCanvas()
      .then((el) => { if (!cancelled) sourceRef.current = el; })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (faceTexRef.current) { faceTexRef.current.dispose(); faceTexRef.current = null; }
      if (drapeBumpTex) { drapeBumpTex.dispose(); drapeBumpTex = null; }
      cropCanvasRef.current = null;
      sourceRef.current = null;
      headGroupRef.current = null;
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          const child = groupRef.current.children[0];
          groupRef.current.remove(child);
          child.traverse((node) => {
            if (node.isMesh) {
              node.geometry?.dispose();
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach((m) => m?.dispose());
            }
          });
        }
      }
      dracoLoader.dispose();
    };
  }, [url]);

  // Eye-tracker state: SitePal idles with small head movements, so a static
  // crop lets the face drift around the plate. Her glowing green eyes are the
  // only saturated green in the player canvas — find their centroid each
  // frame and anchor the crop to it, preserving the configured framing.
  // Disable via window.__portraitTrack = false for a static crop.
  const trackRef = useRef({ canvas: null, ctx: null, calKey: null, offX: 0, offY: 0, curX: 0, curY: 0, hasFix: false });

  // Copy the cropped SitePal face into the texture each frame
  useFrame(() => {
    // Live-tune bust placement: window.__portraitFit / window.__portraitYOffset.
    // Applied to the outer group (ratio vs the baked constants) so it works
    // after the head-group re-parenting too.
    if (
      groupRef.current &&
      typeof window !== "undefined" &&
      (window.__portraitFit || window.__portraitYOffset !== undefined || window.__portraitZOffset !== undefined)
    ) {
      groupRef.current.scale.setScalar((window.__portraitFit || PORTRAIT_FIT) / PORTRAIT_FIT);
      groupRef.current.position.y = (window.__portraitYOffset ?? PORTRAIT_Y_OFFSET) - PORTRAIT_Y_OFFSET;
      groupRef.current.position.z = (window.__portraitZOffset ?? PORTRAIT_Z_OFFSET) - PORTRAIT_Z_OFFSET;
    }

    // Live-tune the fabric side-shadow: window.__portraitShade = { floor, range }
    if (shadeUniformRef.current && typeof window !== "undefined" && window.__portraitShade) {
      const s = window.__portraitShade;
      shadeUniformRef.current.value.set(
        s.floor ?? SHADE_DEFAULT.floor,
        s.range ?? SHADE_DEFAULT.range
      );
    }

    const canvas = cropCanvasRef.current;
    const src = sourceRef.current;
    const tex = faceTexRef.current;
    if (!canvas || !src || !tex) return;
    const crop = (typeof window !== "undefined" && window.__portraitCrop) || DEFAULT_PORTRAIT_CROP;

    let cropX = crop.x;
    let cropY = crop.y;

    if (typeof window === "undefined" || window.__portraitTrack !== false) {
      const t = trackRef.current;
      if (!t.canvas) {
        t.canvas = document.createElement("canvas");
        t.canvas.width = 150;
        t.canvas.height = 112;
        t.ctx = t.canvas.getContext("2d", { willReadFrequently: true });
      }
      try {
        const tw = t.canvas.width;
        const th = t.canvas.height;
        t.ctx.drawImage(src, 0, 0, tw, th);
        const data = t.ctx.getImageData(0, 0, tw, th).data;
        let sx = 0, sy = 0, n = 0;
        for (let p = 0, i = 0; p < tw * th; p++, i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (g > 90 && g > r * 1.5 && g > b * 1.5) {
            sx += p % tw;
            sy += (p / tw) | 0;
            n++;
          }
        }
        if (n >= 3) {
          // Eye centroid in source-canvas coordinates
          const ex = (sx / n) * ((src.width || 600) / tw);
          const ey = (sy / n) * ((src.height || 450) / th);
          // (Re)calibrate whenever the configured crop changes: keep the
          // tuned framing, then track only the head's drift from that moment
          const key = crop.x + "," + crop.y + "," + crop.w + "," + crop.h;
          if (t.calKey !== key) {
            t.calKey = key;
            t.offX = crop.x - ex;
            t.offY = crop.y - ey;
            t.curX = crop.x;
            t.curY = crop.y;
            t.hasFix = true;
          }
          const lerp = (typeof window !== "undefined" && window.__portraitTrackLerp) || DEFAULT_TRACK_LERP;
          t.curX += (ex + t.offX - t.curX) * lerp;
          t.curY += (ey + t.offY - t.curY) * lerp;
        }
        // No green found (mid-blink): hold the last smoothed position
        if (t.hasFix) {
          cropX = t.curX;
          cropY = t.curY;
        }
      } catch (e) {
        // source not ready yet
      }

      // Rotate the rigid head group with the tracked drift so the hood and
      // face turn together instead of the face sliding under the headwear
      if (headGroupRef.current && t.hasFix) {
        const g = (typeof window !== "undefined" && window.__portraitHeadGain) || DEFAULT_HEAD_GAIN;
        const dx = t.curX - crop.x;
        const dy = t.curY - crop.y;
        headGroupRef.current.rotation.y = -dx * (g.yaw ?? DEFAULT_HEAD_GAIN.yaw);
        headGroupRef.current.rotation.x = dy * (g.pitch ?? DEFAULT_HEAD_GAIN.pitch);
      }
    }

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#9F7854";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      ctx.drawImage(src, cropX, cropY, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      // source not ready yet
    }
    tex.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}

/* ── Live 2D SitePal portrait — mirrors the raw SitePal canvas into the
      frame's oval slot each frame. No 3D bust, no face projection: the
      comparison version. The page's single portal must have this character's
      scene loaded (page-level loadSceneByID swap). ── */
// Halftone = "not yet awake". A dormant character reads as a printed
// devotional card — desaturated, high-contrast, screened with a dot grid —
// and drops the treatment the moment they speak, so waking up is visible
// rather than merely audible. Cosmetic only: the player underneath is live
// either way, so there's no load pause on the transition.
// Dimmed reads as "not their turn" far better than heavy contrast does; the
// dot screen is a whisper on top, not the whole effect. (Cranked too hard it
// turns the face into noise — especially over the summoning swirl, which is
// what's underneath before a portal reports ready.)
const HALFTONE_FILTER = "grayscale(1) contrast(1.05) brightness(0.62)";

function SitePalLivePortrait({
  visible = true,
  sourceContainerId = "sitepal-container",
  stillSrc = "/images/mary.png",
  halftone = false,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let raf = null;
    let src = null;
    let still = null;
    // Still fallback shown until the live feed arrives (also covers the
    // scene-swap gap after switching characters)
    const stillImg = new Image();
    stillImg.onload = () => { still = stillImg; };
    stillImg.src = stillSrc;
    waitForSitePalCanvas(30000, sourceContainerId)
      .then((el) => { if (!cancelled) src = el; })
      .catch(() => {});

    // Show the full bust: take the central column of the source (the live
    // SitePal canvas is 600×450 landscape with the bust centered) and
    // CONTAIN-fit it below a small top pad so the head clears the frame ring.
    // Slice of the SitePal canvas to show. Wider w (with x re-centered:
    // x = (1 - w) / 2) = camera pushed back, more of the character visible.
    const LIVE_RECT = { x: 0.14, y: -0.03, w: 0.67, h: 1.00 };
    const STILL_RECT = { x: 0.12, y: 0.0, w: 0.72, h: 1.00 }; // bust region of mary.png
    const TOP_PAD = 0.09; // slot-space padding above the head
    const drawCover = (ctx, c, source, sw, sh, rect) => {
      const sx = sw * rect.x;
      const sy = sh * rect.y;
      const sww = sw * rect.w;
      const shh = sh * rect.h;
      const availH = c.height * (1 - TOP_PAD);
      const scale = Math.min(c.width / sww, availH / shh);
      const dw = sww * scale;
      const dh = shh * scale;
      ctx.drawImage(source, sx, sy, sww, shh, (c.width - dw) / 2, c.height * TOP_PAD, dw, dh);
    };

    const tick = () => {
      if (cancelled) return;
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#0a0a12";
        ctx.fillRect(0, 0, c.width, c.height);
        let drewLive = false;
        if (src) {
          try {
            drawCover(ctx, c, src, src.width || 600, src.height || 450, LIVE_RECT);
            drewLive = true;
          } catch (e) {
            // live source not ready yet
          }
        }
        if (!drewLive && still) {
          drawCover(ctx, c, still, still.naturalWidth, still.naturalHeight, STILL_RECT);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Shared box for the portrait and its halftone screen, so the dots sit
  // exactly over the face.
  const box = {
    position: "absolute",
    left: "23%",
    top: "22.5%",
    width: "54%",
    height: "56%",
    borderRadius: "50%",
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={512}
        height={600}
        style={{
          ...box,
          objectFit: "cover",
          zIndex: 1,
          // Held with the frame canvas (same reveal signal) — the swirl that
          // veils her lives in that canvas, so showing the portrait earlier
          // means a beat of frameless, unveiled face.
          opacity: visible ? 1 : 0,
          // NOTE: the grey/dim filter lives on the CharacterSelect root so the
          // neon frame greys with the face — applying it here too would dim the
          // portrait twice as hard as its own frame.
          transition: "opacity 0.35s ease",
        }}
      />
      {/* Dot screen — the printed look. Fades out as the character wakes. */}
      <div
        aria-hidden="true"
        style={{
          ...box,
          zIndex: 2,
          pointerEvents: "none",
          opacity: halftone && visible ? 0.55 : 0,
          transition: "opacity 0.5s ease",
          backgroundImage:
            "radial-gradient(circle at center, rgba(0,0,0,0.42) 0.5px, transparent 0.9px)",
          backgroundSize: "2.5px 2.5px",
          mixBlendMode: "multiply",
        }}
      />
    </>
  );
}

/* ── First-frames signal ── fires onReady once the canvas has actually
      PRESENTED a couple of frames. onCreated is not enough: the renderer
      exists before the first frame (Bloom shader compile can stall it for
      seconds), and Chrome composites a visible-but-frameless WebGL layer as
      solid white on some GPUs. Only a presented frame is proof of pixels. ── */
function FirstFramesSignal({ onReady }) {
  const count = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    count.current += 1;
    if (count.current >= 2) {
      done.current = true;
      onReady?.();
    }
  });
  return null;
}

/* ── Character portrait inside the frame ── */
function CharacterPortrait({ image, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        inset: "23%",
        borderRadius: "60%",
        overflow: "hidden",
        cursor: "pointer",
        zIndex: 1,
      }}
    >
      {image ? (
        <img
          src={image}
          alt="character"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "radial-gradient(ellipse, rgba(0,255,255,0.08) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}

/**
 * CharacterSelect — ornate neon frame with character portrait + nav arrows.
 *
 * Props:
 *  - characters: [{ name, image }]  — roster of selectable characters
 *  - activeIndex: currently selected index
 *  - onSelect: (index) => void
 *  - size: pixel size of the widget (default 200)
 */
export default function CharacterSelect({
  characters = [],
  activeIndex = 0,
  onSelect,
  size = 200,
  pageLoading = false,
  greeting = "",
  onReady, // fires once the frame canvas has PRESENTED frames with the GLB mounted
  // Which SitePal embed this portrait mirrors. Pages with a single hidden
  // embed leave this alone; /main mounts one portal per panel and points
  // each panel at its own container.
  sourceContainerId = "sitepal-container",
  // Dormant treatment — see SitePalLivePortrait. /main halftones the advisers
  // until it's their turn to argue.
  halftone = false,
  // False when this panel shows a STILL rather than mirroring a live player,
  // which skips the summoning swirl (there is nothing to summon). Every
  // single-embed page leaves this true and is unaffected.
  hasLiveSource = true,
}) {
  const [index, setIndex] = useState(activeIndex);
  // True once the 3D canvas has PRESENTED real frames (FirstFramesSignal).
  // Until then an opaque dark cover div hides the whole frame/portrait box:
  // a visible WebGL layer with no committed frame composites as solid WHITE
  // on some GPUs (canvas-side opacity/transition can't prevent it — the
  // compositor animates the unready layer anyway; only software-painted
  // opaque content above it reliably occludes).
  const [canvasPainted, setCanvasPainted] = useState(false);
  // ...and until the neon frame GLB is actually in the scene, so the frame
  // and swirl arrive as ONE composition instead of the tubes popping in a
  // beat after the reveal. Safety timer covers a stalled fetch.
  const [frameLoaded, setFrameLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFrameLoaded(true), 6000);
    return () => clearTimeout(t);
  }, []);

  // Tell the page the composition is provably on screen (frames presented +
  // frame GLB in the scene) — /main holds its opaque CoinLoader on this, the
  // one overlay that can't white-flash (solid-color layers need no raster).
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    if (canvasPainted && frameLoaded) onReadyRef.current?.();
  }, [canvasPainted, frameLoaded]);

  // Sync internal index when parent changes it (e.g. auto-advance)
  useEffect(() => {
    setIndex(activeIndex);
  }, [activeIndex]);

  const current = characters[index] || { name: "Unknown", image: null };

  // Tap the framed portrait → she greets through the SitePal embed with a
  // random line, in the CURRENT apparition's voice + language (not always the
  // classic English one).
  // Tap the framed portrait → she speaks the SAME greeting the Confessional is
  // already showing (so the audio matches the on-screen transcript), in the
  // current apparition's voice. Guarded like the oracle path: stop any prior
  // speech and re-prime the audio pipeline with saySilent first, or SitePal can
  // throw "setAudioElementMode of null" (cutting off after a syllable) when the
  // player is still settling from a scene swap.
  // Which window owns this panel's SitePal player. When the panel mirrors an
  // iframe portal (/main), that frame has its OWN player and its own sayText,
  // so speech is aimed by calling INTO the frame — no selectPortal, nothing to
  // disambiguate. Single-embed pages fall through to the page itself.
  const portalWindow = () => {
    const frame = document.getElementById(sourceContainerId)?.querySelector("iframe");
    return frame?.contentWindow || window;
  };

  const speakPortrait = () => {
    const w = portalWindow();
    if (!greeting || typeof w.sayText !== "function") return;
    try {
      w.stopSpeech?.();
      w.saySilent?.(0);
      w.setPlayerVolume?.(7);
      const voice = current.voice || ORACLE_VOICE;
      w.sayText(greeting, voice.id, voice.lang, voice.engine);
    } catch (e) {
      console.warn("[CharacterSelect] speakPortrait failed:", e);
    }
  };

  const prev = () => {
    const next = (index - 1 + characters.length) % characters.length;
    setIndex(next);
    if (onSelect) onSelect(next);
  };

  const next = () => {
    const n = (index + 1) % characters.length;
    setIndex(n);
    if (onSelect) onSelect(n);
  };

  return (
    <div
      style={{
        fontFamily: "'Cyber', 'Geo', sans-serif",
        // Dormant = the WHOLE widget greys, neon frame included. Filtering here
        // rather than on the portrait alone is the point: the frame lives in the
        // R3F canvas, so a portrait-only filter left a full-colour neon ring
        // around a grey face. Everything inside — frame, face, name — dims as
        // one object and comes back together when the character speaks.
        filter: halftone ? HALFTONE_FILTER : "none",
        transition: "filter 0.5s ease",
      }}
    >
      {/* Frame + portrait area */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size * 1.3,
          margin: "0 auto",
        }}
      >
        {/* 3D frame canvas. resize.offsetSize measures LAYOUT size instead of
            getBoundingClientRect — the ancestor chat-open scale() transform
            otherwise feeds back into R3F's resize handling and ratchets the
            canvas smaller on every re-measure (frame displaced from portrait). */}
        <Canvas
          resize={{ offsetSize: true }}
          camera={{ position: [0, 0, 2], fov: 45 }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          onCreated={({ gl }) => {
            // Insurance: initialize the buffer dark before the first frame
            gl.setClearColor(0x000000, 0);
            gl.clear();
          }}
        >
          <FirstFramesSignal onReady={() => setCanvasPainted(true)} />
          <ambientLight intensity={current.portraitModel ? 0.35 : 0.3} />
          <pointLight position={[0, 2, 3]} intensity={1} color="#ffd36b" />
          {/* All characters share the neon frame; each brings its own hue */}
          <NeonFrame hue={current.frameHue} onLoaded={() => setFrameLoaded(true)} />
          {/* Magic-mirror summoning veil — the key forces a remount on switch,
              so each arrival re-plays the summoning.
              Only for a character who is actually BEING SUMMONED. The swirl
              exists to cover the wait while a live SitePal face loads; a panel
              showing a still (a dormant /main adviser, mirroring no portal)
              has nothing to wait for, so veiling it just hides the portrait for
              no reason. */}
          {hasLiveSource && (
            <MirrorSwirl key={index} hue={current.frameHue} active={!pageLoading} />
          )}
          {current.portraitModel && (
            <>
              <StudioEnvironment />
              {/* Soft key light upper-left for portrait form */}
              <directionalLight position={[-2, 3, 4]} intensity={1.1} color="#fff2e0" />
              <FramedPortraitModel url={current.portraitModel} />
            </>
          )}
          {/* One uniform bloom for ALL characters — the frame's materials are
              flattened/unlit, so identical pixels + identical bloom = a frame
              that glows the same no matter who's in it. The HDR emissive core
              (~2.7× orange) is what lights up; tone-mapped content stays under
              the threshold. */}
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.9}
              luminanceSmoothing={0.3}
              radius={0.4}
              intensity={1.2}
              mipmapBlur
            />
          </EffectComposer>
        </Canvas>

        {/* Portrait behind the frame: live 2D SitePal mirror, 3D-projection
            portrait (rendered in the canvas above), or static cameo image.
            Speaking characters get the click-to-speak overlay. */}
        {current.sitePalScene && (
          <SitePalLivePortrait
            key={`live-${index}-${sourceContainerId}`}
            visible={canvasPainted && frameLoaded}
            sourceContainerId={sourceContainerId}
            stillSrc={current.image || "/images/mary.png"}
            halftone={halftone}
          />
        )}
        {current.portraitModel || current.sitePalScene ? (
          <div
            onClick={speakPortrait}
            title={`Speak to ${current.title || current.name || "Our Lady"}`}
            style={{
              position: "absolute",
              inset: "10%",
              cursor: "pointer",
              zIndex: 3,
            }}
          />
        ) : (
          <CharacterPortrait image={current.image} onClick={next} />
        )}

        {/* Opaque dark cover — occludes the canvas + portrait stack until
            real frames exist AND the frame GLB is in the scene, so the
            composition arrives whole (never a white layer, never a
            frameless face). Software-painted, so it can't flash. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            background: "#0a0a0f",
            opacity: canvasPainted && frameLoaded ? 0 : 1,
            transition: "opacity 0.4s ease",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Character nav — arrows flank a medallion per apparition, so all the
          faces are advertised at all times (arrows alone hid the roster: a
          first-time visitor had no cue that other faces exist). Name below. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginTop: 8,
        }}
      >
        {characters.length > 1 && (
          <button
            onClick={prev}
            aria-label="Previous character"
            style={{
              background: "none",
              border: "1px solid rgba(0,255,255,0.3)",
              color: "hsl(183 38% 57%)",
              fontSize: "0.8rem",
              cursor: "pointer",
              width: 24,
              height: 24,
              display: "grid",
              placeItems: "center",
              clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          >
            ‹
          </button>
        )}
        {characters.length > 1 &&
          characters.map((c, i) => {
            const hue = c.frameHue || "#22ccff";
            const active = i === index;
            return (
              <button
                key={c.key || c.name || i}
                onClick={() => {
                  if (i === index) return;
                  setIndex(i);
                  if (onSelect) onSelect(i);
                }}
                aria-label={`Select ${c.name}`}
                aria-current={active}
                title={c.title || c.name}
                style={{
                  width: active ? 38 : 30,
                  height: active ? 38 : 30,
                  padding: 0,
                  borderRadius: "50%",
                  cursor: active ? "default" : "pointer",
                  border: `2px solid ${hue}`,
                  // Cameo over a hue glow — the glow doubles as the fallback
                  // when a cameo asset is missing (the url() layer 404s and
                  // the gradient beneath shows through).
                  backgroundImage: `url(${c.image}), radial-gradient(circle at 50% 38%, ${hue}66 0%, #0d0d15 80%)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  opacity: active ? 1 : 0.5,
                  filter: active ? "none" : "saturate(0.6)",
                  boxShadow: active ? `0 0 10px ${hue}, 0 0 22px ${hue}66` : "none",
                  transition: "all 0.25s ease",
                }}
              />
            );
          })}
        {characters.length > 1 && (
          <button
            onClick={next}
            aria-label="Next character"
            style={{
              background: "none",
              border: "1px solid rgba(0,255,255,0.3)",
              color: "hsl(183 38% 57%)",
              fontSize: "0.8rem",
              cursor: "pointer",
              width: 24,
              height: 24,
              display: "grid",
              placeItems: "center",
              clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          >
            ›
          </button>
        )}
      </div>
      <div
        style={{
          textAlign: "center",
          marginTop: 6,
          fontSize: "0.9rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "hsl(183 38% 57%)",
          textShadow: "0 0 8px rgba(0,255,255,0.4)",
        }}
      >
        {current.name}
      </div>
    </div>
  );
}
