"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text, useGLTF, useAnimations } from "@react-three/drei";
import {
  VENDOR_SITEPAL_CONFIG,
  getVendorSitePalSource,
  activateVendorSitePal,
  deactivateVendorSitePal,
} from "@/lib/vendorSitePal";

// ── Commercial strip — a boardwalk apron hung off the −Z edge of the mesa
// (the side clear of the X/Y axis labels), outside the drillable grid so it
// never touches the blockHash-seeded deposit layout. Placeholder stall
// geometry for now; swap each stall body for a GLB later and the
// layout/click wiring stays the same.

export const VENDOR_CATALOG = [
  { id: "insurance", label: "INSURANCE", awning: "#3e6b64", accent: "#7fd6c8" },
  { id: "fortunes",  label: "FORTUNES",  awning: "#5a4a78", accent: "#c79bff",
    model: "/models/Vendor_FortuneTeller.glb", modelScale: 0.1, modelRotY: -Math.PI / 2, idleClip: "sit_idle",
    // She sits −90° from stall-forward; faceYaw swings the fly-in (and the
    // head-tracking rest direction) to meet her face across the table, and
    // faceDist stops the camera inside the wagon, close up.
    // Seated character: keep the approach nearly level — big camDrop values
    // put the camera under her table
    faceYaw: Math.PI / 2, faceDist: 0.25, faceLift: 0, camDrop: -0.05,
    // Crystal ball mood: cloned-material emissive glow + a small violet
    // point light pooled inside the wagon, gently pulsing.
    // Crystal ball: faint emissive sheen + a small violet light. (Set
    // moodDim: true here to also dim the world lights while she's focused —
    // the theatrical night-séance look; currently off, daylight stays.)
    glowMesh: "SM_Prop_Crystal_Ball_01", glowColor: "#8a63e8",
    // Key into VENDOR_SITEPAL_CONFIG: on focus her SitePal avatar is cropped
    // onto Face1 (Face2, the painted face, hides) and she speaks a greeting.
    sitepal: "fortunes" },
  { id: "souvenirs", label: "SOUVENIRS", awning: "#8a6d2f", accent: "#ffd700" },
  { id: "tonics",    label: "TONICS",    awning: "#7a3524", accent: "#ff8c5a",
    model: "/models/Vendor_Salesman1.glb", modelScale: 0.1, modelRotY: Math.PI / 2, idleClip: "idle",
    // His head is ~0.045 world units tall — a true close-up needs to be this near
    faceDist: 0.18, faceLift: -0.03, camDrop: -0.35 },
];

// Preload vendor GLBs (same idiom as ADDON_CATALOG in OilVoxelGrid)
VENDOR_CATALOG.forEach((v) => { if (v.model) useGLTF.preload(v.model); });

// Rest-pose face direction in world space: stalls face the field (+Z);
// vendor.faceYaw (radians about +Y) offsets it for characters whose model
// doesn't face straight out of the stall.
function faceDirWorld(vendor, out) {
  const yaw = vendor.faceYaw ?? 0;
  return out.set(Math.sin(yaw), 0, Math.cos(yaw));
}

// Scratch objects for the per-frame head tracking (no per-frame allocation)
const _headPos = /* @__PURE__ */ new THREE.Vector3();
const _toCam = /* @__PURE__ */ new THREE.Vector3();
const _face = /* @__PURE__ */ new THREE.Vector3();
const _right = /* @__PURE__ */ new THREE.Vector3();
const _UP = /* @__PURE__ */ new THREE.Vector3(0, 1, 0);
const _parentQ = /* @__PURE__ */ new THREE.Quaternion();
const _worldQ = /* @__PURE__ */ new THREE.Quaternion();
const _yawQ = /* @__PURE__ */ new THREE.Quaternion();
const _pitchQ = /* @__PURE__ */ new THREE.Quaternion();
const _deltaQ = /* @__PURE__ */ new THREE.Quaternion();

const HEAD_YAW_LIMIT = 1.1;    // rad (~63°) — how far the head will turn to follow
const HEAD_PITCH_UP = 0.7;     // rad (~40°) — looking up at a tall camera
const HEAD_PITCH_DOWN = 0.55;  // rad (~32°) — looking down

// Tuned for full daylight: a subtle magic presence on the ball with a soft
// violet pool right around it — the sun stays in charge of the interior.
const GLOW_EMISSIVE_BASE = 0.12;   // resting glow on the non-glass prop parts
const GLOW_EMISSIVE_AMP = 0.08;    // extra glow at the top of the flicker
const GLOW_LIGHT_INTENSITY = 0.08; // point light strength — it sits nearly on
                                   // the table, so inverse-square makes even
                                   // small values read strongly up close
const GLOW_LIGHT_DISTANCE = 0.3;   // world units — a pool around the ball only
const SWIRL_BASE_OPACITY = 0.5;    // resting density of the swirl glass

// ── Crystal-ball swirl shader ──────────────────────────────────────────────
// Replaces the glass mesh's material (the prop's "crystal" primitive is its
// own mesh). Angular interference bands, twisted harder toward the core and
// drifting with time, plus a fresnel rim — bright regions push past the base
// color, which reads as bloom without a postprocessing pass.
const SWIRL_VERT = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vLocal = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SWIRL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform vec3 uCenter;
  uniform float uRadius;
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 p = (vLocal - uCenter) / uRadius;
    float ang = atan(p.z, p.x);
    float r = length(p.xz);
    float tw = ang + uTime * 0.45 + (1.0 - r) * 2.8;
    float bands =
      sin(tw * 3.0 + p.y * 6.0 + uTime * 0.9) * 0.5 +
      sin(tw * 5.0 - p.y * 4.0 - uTime * 1.4) * 0.35 +
      sin(p.y * 9.0 + uTime * 0.65) * 0.15;
    bands = bands * 0.5 + 0.5;
    float fresnel = pow(1.0 - abs(dot(normalize(vViewDir), normalize(vWorldNormal))), 2.0);
    vec3 col = mix(uColorA, uColorB, bands);
    col += uColorB * fresnel * 0.7;
    float alpha = clamp(uOpacity + bands * 0.22 + fresnel * 0.35, 0.0, 1.0);
    gl_FragColor = vec4(col * (0.55 + bands * 0.9 + fresnel * 0.6), alpha);
  }
`;

function makeSwirlMaterial(glassMesh, colorHex) {
  const geo = glassMesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const bs = geo.boundingSphere;
  return new THREE.ShaderMaterial({
    vertexShader: SWIRL_VERT,
    fragmentShader: SWIRL_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorHex).multiplyScalar(0.55) },
      uColorB: { value: new THREE.Color(colorHex).lerp(new THREE.Color("#ffffff"), 0.45) },
      uOpacity: { value: SWIRL_BASE_OPACITY },
      uCenter: { value: bs.center.clone() },
      uRadius: { value: bs.radius },
    },
    transparent: true,
    depthWrite: false,
  });
}

// Lazily builds the 512² crop canvas + CanvasTexture + unlit material and
// assigns it to the projection face mesh. flipY=false matches glTF UVs;
// toneMapped=false so the tuned filter values are what actually shows.
function ensureVendorProjectionMaterial(st) {
  if (!st.cropCanvas) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    st.cropCanvas = c;
    st.cropCtx = c.getContext("2d");
  }
  if (!st.texture) {
    const tex = new THREE.CanvasTexture(st.cropCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    st.texture = tex;
  }
  if (!st.material) {
    st.material = new THREE.MeshBasicMaterial({
      map: st.texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
  }
  if (!st.materialApplied && st.proj) {
    st.proj.material = st.material;
    st.materialApplied = true;
  }
}
const HEAD_EASE = 8;           // 1/s — smoothing rate toward the target angles

function VendorModel({ vendor, focusedRef, headRef }) {
  const group = useRef();
  const { scene, animations } = useGLTF(vendor.model);
  const { actions, mixer } = useAnimations(animations, group);

  // Cap per-frame animation advance: on a main-thread hitch the mixer would
  // otherwise skip the clip forward by the whole stalled interval, which reads
  // as a split-second pose pop in a face close-up. Capping converts the skip
  // into an imperceptible micro-slowdown.
  useEffect(() => {
    const orig = mixer.update.bind(mixer);
    mixer.update = (d) => orig(Math.min(d, 1 / 30));
    return () => { mixer.update = orig; };
  }, [mixer]);
  useEffect(() => {
    const action = (vendor.idleClip && actions?.[vendor.idleClip]) || Object.values(actions || {})[0];
    // No fadeIn: on (re)mount the bindings sit at bind pose, and a weight fade
    // would visibly blend from T-pose. Playing at full weight snaps straight
    // into the idle on the first mixer update instead.
    action?.reset().play();
    return () => action?.stop();
  }, [actions, vendor.idleClip]);

  // Locate the head bone once (Synty-style rigs name it "Head"/"head")
  useEffect(() => {
    const want = (vendor.headBone || "head").toLowerCase();
    let head = null;
    scene.traverse((o) => { if (!head && o.isBone && o.name.toLowerCase() === want) head = o; });
    if (headRef) headRef.current = head;
    return () => { if (headRef) headRef.current = null; };
  }, [scene, vendor.headBone, headRef]);

  // Glow mesh (e.g. the crystal ball): clone its material(s) before setting
  // emissive — Synty props share one atlas material, so mutating in place
  // would set the whole wagon glowing. Originals are restored on cleanup
  // because the useGLTF scene is cached and shared across mounts.
  const glowRef = useRef({ mats: [], targets: [], light: null, swirl: null });
  useEffect(() => {
    if (!vendor.glowMesh) return;
    const g = glowRef.current;
    // Multi-material glTF exports arrive as a Group named for the prop with
    // one child Mesh per material — traverse rather than assuming a Mesh.
    const root = scene.getObjectByName(vendor.glowMesh);
    if (!root) return;
    const color = new THREE.Color(vendor.glowColor || "#c79bff");
    g.mats = [];
    g.targets = [];
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      g.targets.push({ mesh: o, original: o.material });
      // The glass primitive ("crystal" material) gets the animated swirl;
      // the stand and any other parts get the plain emissive clone.
      if (mats.some((m) => /crystal|glass/i.test(m?.name || ""))) {
        const swirl = makeSwirlMaterial(o, vendor.glowColor || "#c79bff");
        g.swirl = swirl;
        g.mats.push(swirl);
        o.material = swirl;
        return;
      }
      const clones = mats.map((m) => {
        const clone = m.clone();
        clone.emissive = color.clone();
        clone.emissiveIntensity = GLOW_EMISSIVE_BASE;
        g.mats.push(clone);
        return clone;
      });
      o.material = Array.isArray(o.material) ? clones : clones[0];
    });
    if (!g.targets.length) return;
    const light = new THREE.PointLight(color, GLOW_LIGHT_INTENSITY, GLOW_LIGHT_DISTANCE, 2);
    root.add(light);
    g.light = light;
    return () => {
      root.remove(light);
      g.targets.forEach(({ mesh, original }) => { mesh.material = original; });
      g.mats.forEach((m) => { try { m.dispose(); } catch (e) {} });
      g.mats = []; g.targets = []; g.light = null; g.swirl = null;
    };
  }, [scene, vendor.glowMesh, vendor.glowColor]);

  // SitePal projection state: proj face (receives the avatar crop) + regular
  // face (hidden while projecting). Texture/material are built lazily on
  // first show and disposed on unmount (material.dispose does NOT free map).
  const projRef = useRef({
    proj: null, regulars: [],
    cropCanvas: null, cropCtx: null,
    texture: null, material: null, materialApplied: false,
  });
  useEffect(() => {
    const sp = vendor.sitepal ? VENDOR_SITEPAL_CONFIG[vendor.sitepal] : null;
    if (!sp) return;
    const st = projRef.current;
    st.proj = scene.getObjectByName(sp.projFace) || null;
    st.regulars = (sp.regularFaces || [])
      .map((name) => scene.getObjectByName(name))
      .filter(Boolean);
    if (st.proj) st.proj.visible = false; // hidden until the projection is live
    return () => {
      if (st.texture) { try { st.texture.dispose(); } catch (e) {} }
      if (st.material) { try { st.material.dispose(); } catch (e) {} }
      st.texture = null; st.material = null;
      st.cropCanvas = null; st.cropCtx = null;
      st.materialApplied = false;
      st.regulars.forEach((m) => { m.visible = true; });
      if (st.proj) st.proj.visible = false;
    };
  }, [scene, vendor.sitepal]);

  // Head-follows-camera while the stall is in focus. Registered after
  // useAnimations so it runs after the mixer writes the animated pose each
  // frame; the delta is applied in world space, which stays axis-correct
  // regardless of the rig's bone orientation convention.
  const trackRef = useRef({ yaw: 0, pitch: 0 });
  useFrame((state, delta) => {
    // Crystal-ball life: advance the swirl shader, and drive the light +
    // stand emissive with a quasi-periodic flicker (two incommensurate
    // sines — organic drift, never a metronome).
    const g = glowRef.current;
    if (g.mats.length) {
      const tNow = state.clock.elapsedTime;
      if (g.swirl) g.swirl.uniforms.uTime.value = tNow;
      const flicker = 0.75 + 0.17 * Math.sin(tNow * 1.7) + 0.08 * Math.sin(tNow * 2.93 + 1.3);
      g.mats.forEach((m) => {
        if (!m.isShaderMaterial) m.emissiveIntensity = (GLOW_EMISSIVE_BASE + GLOW_EMISSIVE_AMP) * flicker;
      });
      if (g.light) g.light.intensity = GLOW_LIGHT_INTENSITY * 1.3 * flicker;
    }
    // SitePal face projection: while focused (and the right scene is live in
    // the host), crop the avatar frame onto the proj face and hide the
    // regular one. Same math as the temple/talk-show compositors.
    const sp = vendor.sitepal ? VENDOR_SITEPAL_CONFIG[vendor.sitepal] : null;
    if (sp) {
      const st = projRef.current;
      const focusedNow = !!focusedRef?.current;
      const source = focusedNow ? getVendorSitePalSource() : null;
      const onScene =
        typeof window !== "undefined" &&
        window.__vendorSitePalSceneLoaded === true &&
        window.__vendorSitePalCurrentSceneId === sp.sceneId;
      const show = !!(focusedNow && source && onScene && st.proj);
      if (show) {
        ensureVendorProjectionMaterial(st);
        const ctx = st.cropCtx;
        const canvas = st.cropCanvas;
        const { cropX, cropY, cropW, cropH, rotateZ, rotateX } = sp.crop;
        const f = sp.filter;
        ctx.fillStyle = "#9F7854"; // skin-tone backfill for letterboxing
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        try {
          ctx.save();
          ctx.filter = `saturate(${f.saturate}%) contrast(${f.contrast}%) brightness(${f.brightness}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%)`;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rotateZ * Math.PI) / 180);
          ctx.scale(1, Math.cos((rotateX * Math.PI) / 180));
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
          ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          ctx.filter = "none";
        } catch (e) {
          // Source canvas not yet renderable (preserveDrawingBuffer race).
        }
        if (st.texture) st.texture.needsUpdate = true;
      }
      if (st.proj) st.proj.visible = show;
      st.regulars.forEach((m) => { m.visible = !show; });
    }
    const head = headRef?.current;
    if (!head) return;
    const t = trackRef.current;
    let targetYaw = 0, targetPitch = 0;
    if (focusedRef?.current) {
      head.getWorldPosition(_headPos);
      _toCam.copy(state.camera.position).sub(_headPos);
      faceDirWorld(vendor, _face);
      const flat = Math.hypot(_toCam.x, _toCam.z);
      targetPitch = THREE.MathUtils.clamp(Math.atan2(_toCam.y, flat), -HEAD_PITCH_DOWN, HEAD_PITCH_UP);
      let dYaw = Math.atan2(_toCam.x, _toCam.z) - Math.atan2(_face.x, _face.z);
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      targetYaw = THREE.MathUtils.clamp(dYaw, -HEAD_YAW_LIMIT, HEAD_YAW_LIMIT);
    }
    const k = 1 - Math.exp(-HEAD_EASE * delta);
    t.yaw += (targetYaw - t.yaw) * k;
    t.pitch += (targetPitch - t.pitch) * k;
    if (Math.abs(t.yaw) >= 1e-4 || Math.abs(t.pitch) >= 1e-4) {
      // The mixer does not necessarily rewrite the bone every frame (e.g. the
      // first frames after a loop wrap). If the bone still holds the value WE
      // wrote last frame, restore the clean animated pose first — otherwise
      // the delta compounds on its own output (the recurring head-snap bug).
      if (!t.lastOut) { t.lastOut = new THREE.Quaternion(); t.lastClean = new THREE.Quaternion(); t.hasLast = false; }
      if (t.hasLast && head.quaternion.equals(t.lastOut)) {
        head.quaternion.copy(t.lastClean);
      }
      t.lastClean.copy(head.quaternion);
      head.parent.getWorldQuaternion(_parentQ);
      _worldQ.copy(_parentQ).multiply(head.quaternion);
      _yawQ.setFromAxisAngle(_UP, t.yaw);
      faceDirWorld(vendor, _face);
      _right.crossVectors(_UP, _face).normalize();
      // negative: _right is the face-left axis, so positive pitch (camera
      // above) needs a negative rotation about it to tilt the face upward
      _pitchQ.setFromAxisAngle(_right, -t.pitch);
      _deltaQ.copy(_yawQ).multiply(_pitchQ);
      _worldQ.premultiply(_deltaQ);
      head.quaternion.copy(_parentQ.invert().multiply(_worldQ));
      t.lastOut.copy(head.quaternion);
      t.hasLast = true;
    }
  });

  return (
    <group ref={group}>
      <primitive
        object={scene}
        scale={vendor.modelScale ?? 0.1}
        rotation={[0, vendor.modelRotY ?? 0, 0]}
      />
    </group>
  );
}

const DECK_DEPTH = 1.2;   // boardwalk depth (cellSize units), off the mesa edge
const DECK_THICK = 0.12;
const DECK_MARGIN = 0.2;  // deck overhang past the mesa's side walls
const WOOD_DECK = "#6e5638";
const WOOD_TRIM = "#57432c";
const WOOD_POST = "#4e3b26";

function VendorStall({ vendor, position, cellSize, onVendorClick, onFocusObject, onZoomOut }) {
  const rootRef = useRef();
  const zoomedRef = useRef(false);
  const headRef = useRef(null);
  // Same click-to-zoom idiom as OilTower: first click dollies in — to the
  // character's face when the model has a head bone, else head-on to the
  // stall — second click pulls back to the overview.
  const handleClick = (e) => {
    e.stopPropagation();
    if (zoomedRef.current) {
      zoomedRef.current = false;
      if (vendor.sitepal) deactivateVendorSitePal();
      if (vendor.moodDim) window.dispatchEvent(new CustomEvent("vendor-mood", { detail: { active: false } }));
      onZoomOut?.();
      return;
    }
    onVendorClick?.(vendor.id);
    // Voiced vendors greet on approach: swap the host to their SitePal scene
    // and speak an ElevenLabs line (engine 14) with real lipsync. The click
    // itself is the audio-unlock gesture.
    if (vendor.sitepal) activateVendorSitePal(vendor.sitepal);
    if (vendor.moodDim) window.dispatchEvent(new CustomEvent("vendor-mood", { detail: { active: true } }));
    if (!onFocusObject || !rootRef.current) return;
    const normal = faceDirWorld(vendor, new THREE.Vector3());
    if (headRef.current) {
      const headPos = new THREE.Vector3();
      headRef.current.getWorldPosition(headPos);
      // faceLift moves the look-at point (frame center) up/down the body.
      headPos.y += (vendor.faceLift ?? 0) * cellSize;
      // camDrop tilts the approach ray: negative puts the camera BELOW the
      // target looking up (hero shot), positive above looking down. This is
      // what changes the composition — faceLift alone shifts camera and
      // target together, leaving the framing identical.
      normal.y += vendor.camDrop ?? 0;
      normal.normalize();
      onFocusObject(headPos, normal, (vendor.faceDist ?? 0.65) * cellSize);
    } else {
      const center = new THREE.Vector3();
      rootRef.current.getWorldPosition(center);
      center.y += 0.45 * cellSize;
      onFocusObject(center, normal, 1.8 * cellSize);
    }
    zoomedRef.current = true;
  };
  return (
    <group
      ref={rootRef}
      position={position}
      scale={cellSize}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {vendor.model ? (
        <>
          <VendorModel vendor={vendor} focusedRef={zoomedRef} headRef={headRef} />
          <Text
            position={[0, 0.95, 0.32]}
            fontSize={0.075}
            color={vendor.accent}
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {vendor.label}
          </Text>
        </>
      ) : (
        <PlaceholderStall vendor={vendor} />
      )}
    </group>
  );
}

function PlaceholderStall({ vendor }) {
  return (
    <>
      {/* counter */}
      <mesh position={[0, 0.15, 0.08]}>
        <boxGeometry args={[0.44, 0.3, 0.34]} />
        <meshStandardMaterial color={WOOD_POST} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.32, 0.08]}>
        <boxGeometry args={[0.5, 0.04, 0.4]} />
        <meshStandardMaterial color={WOOD_TRIM} roughness={0.8} metalness={0.05} />
      </mesh>
      {/* goods on the counter */}
      <mesh position={[-0.12, 0.38, 0.12]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color={vendor.accent} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0.1, 0.39, 0.06]}>
        <cylinderGeometry args={[0.035, 0.035, 0.1, 8]} />
        <meshStandardMaterial color={vendor.accent} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* back posts */}
      {[-0.21, 0.21].map((px) => (
        <mesh key={px} position={[px, 0.31, -0.12]}>
          <boxGeometry args={[0.05, 0.62, 0.05]} />
          <meshStandardMaterial color={WOOD_POST} roughness={0.85} metalness={0.05} />
        </mesh>
      ))}
      {/* awning, sloped down toward the field */}
      <mesh position={[0, 0.66, 0.04]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[0.56, 0.03, 0.5]} />
        <meshStandardMaterial color={vendor.awning} roughness={0.7} metalness={0.05} />
      </mesh>
      {/* emissive trim bar so the stall reads at night/hell presets */}
      <mesh position={[0, 0.605, 0.28]}>
        <boxGeometry args={[0.56, 0.025, 0.025]} />
        <meshStandardMaterial color={vendor.accent} emissive={vendor.accent} emissiveIntensity={0.8} roughness={0.5} />
      </mesh>
      <Text
        position={[0, 0.52, 0.29]}
        fontSize={0.075}
        color={vendor.accent}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {vendor.label}
      </Text>
    </>
  );
}

export default function CommercialStrip({ worldW, worldD, cellSize = 1, vendors = VENDOR_CATALOG, onVendorClick, onFocusObject, onZoomOut }) {
  const deckW = worldW + DECK_MARGIN * 2 * cellSize;
  const deckD = DECK_DEPTH * cellSize;
  const deckZ = -(worldD / 2 + deckD / 2); // flush against the −Z edge
  const slotW = worldW / vendors.length;

  return (
    <group>
      {/* boardwalk deck, top flush with the field surface (y = 0) */}
      <mesh position={[0, -DECK_THICK * cellSize / 2, deckZ]}>
        <boxGeometry args={[deckW, DECK_THICK * cellSize, deckD]} />
        <meshStandardMaterial color={WOOD_DECK} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* outer-edge trim */}
      <mesh position={[0, -0.02 * cellSize, deckZ - deckD / 2 + 0.03 * cellSize]}>
        <boxGeometry args={[deckW, 0.16 * cellSize, 0.06 * cellSize]} />
        <meshStandardMaterial color={WOOD_TRIM} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* diagonal knee braces: lower end embedded in the mesa wall, upper end
          meeting the deck's underside near its outer edge */}
      {Array.from({ length: 4 }, (_, i) => {
        const x = -deckW / 2 + (i + 0.5) * (deckW / 4);
        return (
          <mesh key={`strut-${i}`} position={[x, -0.55 * cellSize, -(worldD / 2 + 0.4 * cellSize)]} rotation={[-Math.PI / 4, 0, 0]}>
            <boxGeometry args={[0.06 * cellSize, 1.3 * cellSize, 0.06 * cellSize]} />
            <meshStandardMaterial color={WOOD_POST} roughness={0.85} metalness={0.05} />
          </mesh>
        );
      })}
      {vendors.map((v, i) => (
        <VendorStall
          key={v.id}
          vendor={v}
          position={[-worldW / 2 + (i + 0.5) * slotW, 0, deckZ - deckD * 0.1]}
          cellSize={cellSize}
          onVendorClick={onVendorClick}
          onFocusObject={onFocusObject}
          onZoomOut={onZoomOut}
        />
      ))}
    </group>
  );
}
