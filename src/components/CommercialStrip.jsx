"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text, useGLTF, useAnimations, useEnvironment } from "@react-three/drei";
import {
  VENDOR_SITEPAL_CONFIG,
  getVendorSitePalSource,
  activateVendorSitePal,
  deactivateVendorSitePal,
  onVendorTalk,
} from "@/lib/vendorSitePal";

// ── Commercial strip — a boardwalk apron hung off the −Z edge of the mesa
// (the side clear of the X/Y axis labels), outside the drillable grid so it
// never touches the blockHash-seeded deposit layout.
//
// Geometry comes from CommercialStrip.glb (one 4K atlas, 4 materials). The
// three voiced vendors are separate GLBs exported IN POSITION in the strip's
// own coordinate space — so the strip and every character share one transform
// group and no per-stall placement exists any more. Re-exporting any of them
// from Blender just works: the group auto-fits from the strip's bounding box.

const STRIP_MODEL = "/models/CommercialStrip.glb";

// Strip-local yaw that means "facing the customer side of the boardwalk".
// Props sit on local +X, so the field-facing direction is local −X; the group's
// own Y-rotation is added on top in faceDirWorld to get world space.
const VENDOR_LOCAL_FACE_YAW = -Math.PI / 2;

export const VENDOR_CATALOG = [
  { id: "insurance", label: "", awning: "#3e6b64", accent: "#7fd6c8",
    // No character of its own — the strip GLB supplies the tent, and `prop`
    // anchors an invisible click volume over it.
    prop: "SM_Prop_Tent_02 (23)" },
  { id: "fortunes",  label: "",  awning: "#5a4a78", accent: "#c79bff",
    model: "/models/Vendor_FortuneTeller_Character.glb", idleClip: "sit_idle",
    prop: "FortuneTeller_Wagon_Empty",
    // She sits square to the boardwalk rather than facing off it, so her
    // strip-local face yaw is 0 (90° off the VENDOR_LOCAL_FACE_YAW default).
    // faceYaw swings the fly-in (and the head-tracking rest direction) to meet
    // her face across the table; faceDist stops the camera inside the wagon.
    // Seated character: keep the approach nearly level — big camDrop values
    // put the camera under her table.
    faceYaw: 0, faceDist: 0.25, faceLift: 0, camDrop: -0.05,
    // Crystal ball mood: cloned-material emissive glow + a small violet
    // point light pooled inside the wagon, gently pulsing.
    // Crystal ball: faint emissive sheen + a small violet light. (Set
    // moodDim: true here to also dim the world lights while she's focused —
    // the theatrical night-séance look; currently off, daylight stays.)
    glowMesh: "SM_Prop_Crystal_Ball_01", glowColor: "#8a63e8",
    // Key into VENDOR_SITEPAL_CONFIG: on focus her SitePal avatar is cropped
    // onto Face1 (Face2, the painted face, hides) and she speaks a greeting.
    sitepal: "fortunes" },
  { id: "souvenirs", label: "", awning: "#8a6d2f", accent: "#ffd700",
    prop: "SM_Prop_Tent_02 (24)" },
  { id: "hotdogs",   label: "",  awning: "#a33b2a", accent: "#ffd24d",
    model: "/models/Vendor_HotDog_Character.glb", idleClip: "idle",
    prop: "SM_Prop_HotdogStand_01",
    // Standing cart vendor — same framing as the salesman.
    faceDist: 0.18, faceLift: -0.03, camDrop: -0.35,
    talkClip: "talking",
    sitepal: "hotdogs" },
  { id: "tonics",    label: "",    awning: "#7a3524", accent: "#ff8c5a",
    model: "/models/Vendor_SnakeOilSalesman_Character.glb", idleClip: "idle",
    prop: "SM_Veh_Wagon_Shop_01",
    // His head is ~0.045 world units tall — a true close-up needs to be this near
    faceDist: 0.18, faceLift: -0.03, camDrop: -0.35,
    // His idle carries the head slightly low and left of center; lift the
    // tracked gaze ~7° and turn it ~4.5° toward the viewer's right
    gazeLift: 0.12, gazeTurn: -0.2,
    talkClip: "hard_sell",
    sitepal: "tonics" },
];

// Preload the strip and vendor GLBs (same idiom as ADDON_CATALOG in OilVoxelGrid)
useGLTF.preload(STRIP_MODEL);
VENDOR_CATALOG.forEach((v) => { if (v.model) useGLTF.preload(v.model); });

// Blender appends .001/.002 to names that collide across a session, and which
// file gets the suffix changes between exports — the fortune teller ships
// "Face3.001" and the salesman "Face3.002" for what the SitePal config calls
// "Face3". Match the exact name first, then any name that is it plus a numeric
// suffix, so a re-export can't silently break the face projection.
function findByBaseName(root, name) {
  if (!root || !name) return null;
  const exact = root.getObjectByName(name);
  if (exact) return exact;
  let hit = null;
  const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d{3}$`);
  root.traverse((o) => { if (!hit && re.test(o.name)) hit = o; });
  return hit;
}

// Rest-pose face direction in world space. vendor.faceYaw is expressed in the
// STRIP's local frame (default VENDOR_LOCAL_FACE_YAW = facing off the deck);
// stripRotY is the shared group's Y-rotation, which carries it to world space.
function faceDirWorld(vendor, out, stripRotY = 0) {
  const yaw = (vendor.faceYaw ?? VENDOR_LOCAL_FACE_YAW) + stripRotY;
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

function VendorModel({ vendor, focusedRef, headRef, stripScene, stripRotY = 0 }) {
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

  // Environment-map fill: the strip sits on the −Z edge where one scene
  // directional grazes and the other lights the vendors' BACKS, so their
  // field-facing sides read near-silhouette on ambient alone. The rigs stay
  // legible via IBL from the same preset — give the vendor materials the
  // identical treatment (no extra dynamic lights, mobile-safe).
  const envMap = useEnvironment({ preset: "warehouse" });
  useEffect(() => {
    if (!envMap) return;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m || !m.isMeshStandardMaterial) return;
        if (m.envMap !== envMap) { m.envMap = envMap; m.needsUpdate = true; }
        m.envMapIntensity = 0.45;
      });
    });
  }, [scene, envMap]);

  // Talk-clip swap: crossfade idle → vendor.talkClip while the greeting audio
  // actually plays (SitePal's talk callbacks via the vendorSitePal bridge),
  // and back when it ends or is cut off. Vendors without a talkClip (the
  // seated fortune teller) simply never swap. Crossfades run between two
  // playing actions, so bind pose is never touched.
  const talkModeRef = useRef(false);
  useEffect(() => {
    if (!vendor.sitepal || !vendor.talkClip) return;
    const off = onVendorTalk((vendorId, talking) => {
      if (vendorId !== vendor.sitepal) return;
      if (talking === talkModeRef.current) return;
      const idle = (vendor.idleClip && actions?.[vendor.idleClip]) || Object.values(actions || {})[0];
      const talk = actions?.[vendor.talkClip];
      if (!idle || !talk) return;
      talkModeRef.current = talking;
      if (talking) {
        talk.reset().crossFadeFrom(idle, 0.25, false).play();
      } else {
        idle.reset().crossFadeFrom(talk, 0.35, false).play();
      }
    });
    return () => { off(); talkModeRef.current = false; };
  }, [actions, vendor.sitepal, vendor.talkClip, vendor.idleClip]);

  // All three character exports carry a stray unskinned "Icosphere" (42 verts,
  // ~2 units across) sitting at the character's origin — the debris the source
  // .blend keeps in its `glTF_not_exported` collection, which the character
  // exports didn't exclude. Left in, it renders as a grey ball at each
  // vendor's feet. Narrow rule: unskinned, mesh, named Icosphere*.
  useEffect(() => {
    const junk = [];
    scene.traverse((o) => {
      if (o.isMesh && !o.isSkinnedMesh && /^Icosphere(\.\d+)?$/.test(o.name)) junk.push(o);
    });
    junk.forEach((o) => { o.visible = false; o.raycast = () => {}; });
    return () => { junk.forEach((o) => { o.visible = true; }); };
  }, [scene]);

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
    // The glow prop (the crystal ball) lives in the STRIP GLB now, not in the
    // character file, so search the strip first and fall back to the character.
    const root = findByBaseName(stripScene, vendor.glowMesh)
      || findByBaseName(scene, vendor.glowMesh);
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
  }, [scene, stripScene, vendor.glowMesh, vendor.glowColor]);

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
    st.proj = findByBaseName(scene, sp.projFace) || null;
    st.regulars = (sp.regularFaces || [])
      .map((name) => findByBaseName(scene, name))
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
      faceDirWorld(vendor, _face, stripRotY);
      const flat = Math.hypot(_toCam.x, _toCam.z);
      // gazeLift (rad) corrects a rest pose that carries the head high or
      // low — positive lifts the gaze above the pure camera angle.
      targetPitch = THREE.MathUtils.clamp(
        Math.atan2(_toCam.y, flat) + (vendor.gazeLift ?? 0),
        -HEAD_PITCH_DOWN, HEAD_PITCH_UP
      );
      // gazeTurn (rad) corrects a sideways rest-pose bias — positive shifts
      // the gaze toward the viewer's right.
      let dYaw = Math.atan2(_toCam.x, _toCam.z) - Math.atan2(_face.x, _face.z) + (vendor.gazeTurn ?? 0);
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
      faceDirWorld(vendor, _face, stripRotY);
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

  // No local transform: the character GLBs are exported in position in the
  // strip's own coordinate space, so the shared group above places them.
  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

const DECK_DEPTH = 1.2;   // boardwalk depth (cellSize units), off the mesa edge
const DECK_MARGIN = 0.2;  // deck overhang past the mesa's side walls
const WOOD_POST = "#4e3b26";

// The strip GLB is authored running along its own local Z; +90° about Y lays
// that onto the mesa's X edge, and maps local (x,y,z) → world (z, y, −x).
const STRIP_ROT_Y = Math.PI / 2;

// The per-vendor face-framing numbers (faceDist/faceLift) were tuned when the
// characters rendered at this scale. framingUnit rescales them to whatever the
// strip auto-fits to, so the tuned close-ups survive a re-export.
const LEGACY_MODEL_SCALE = 0.1;

// `framingUnit` replaces the old `cellSize` multiplier on the face-framing
// numbers. Those values were tuned against characters rendered at modelScale
// 0.1; scaling them by (stripScale / 0.1) preserves the exact same framing now
// that the characters are sized by the strip's auto-fit instead.
// Click volume over a paired prop, in strip-local units (the Synty tents are
// roughly this size in the strip's own space).
const PROXY_LOCAL_SIZE = 5;

function VendorStall({ vendor, stripScene, stripRotY, framingUnit, propObj, onVendorClick, onFocusObject, onZoomOut, onFocusChange }) {
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
      onFocusChange?.(null);
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
    const normal = faceDirWorld(vendor, new THREE.Vector3(), stripRotY);
    if (headRef.current) {
      const headPos = new THREE.Vector3();
      headRef.current.getWorldPosition(headPos);
      // faceLift moves the look-at point (frame center) up/down the body.
      headPos.y += (vendor.faceLift ?? 0) * framingUnit;
      // camDrop tilts the approach ray: negative puts the camera BELOW the
      // target looking up (hero shot), positive above looking down. This is
      // what changes the composition — faceLift alone shifts camera and
      // target together, leaving the framing identical.
      normal.y += vendor.camDrop ?? 0;
      normal.normalize();
      onFocusObject(headPos, normal, (vendor.faceDist ?? 0.65) * framingUnit);
    } else if (propObj) {
      // Character-less vendor: frame its paired prop from the prop's own WORLD
      // bounds (setFromObject walks world matrices), so the shot fits the tent
      // at whatever scale the strip auto-fitted to.
      const box = new THREE.Box3().setFromObject(propObj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      onFocusObject(center, normal, Math.max(size.x, size.y, size.z) * 1.6);
    } else {
      const center = new THREE.Vector3();
      rootRef.current.getWorldPosition(center);
      center.y += 0.45 * framingUnit;
      onFocusObject(center, normal, 1.8 * framingUnit);
    }
    zoomedRef.current = true;
    // Hand the spotlight something to aim at: the head bone when the vendor is
    // rigged, else the paired prop so tent-only vendors still get lit.
    onFocusChange?.({ id: vendor.id, object: headRef.current || propObj || rootRef.current });
  };
  // Identity transform: this group is a child of the shared strip group, and
  // both the strip GLB and the character GLBs are authored in that same frame.
  // The click volume over the paired prop is what makes the tent itself
  // clickable — for character-less vendors it is the ONLY click target.
  const p = propObj?.position;
  const labelSize = 0.75 / (framingUnit || 1);
  return (
    <group
      ref={rootRef}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {vendor.model && (
        <VendorModel
          vendor={vendor}
          focusedRef={zoomedRef}
          headRef={headRef}
          stripScene={stripScene}
          stripRotY={stripRotY}
        />
      )}
      {p && (
        <mesh position={[p.x, p.y + PROXY_LOCAL_SIZE / 2, p.z]}>
          <boxGeometry args={[PROXY_LOCAL_SIZE, PROXY_LOCAL_SIZE, PROXY_LOCAL_SIZE]} />
          {/* transparent, not `visible={false}` — invisible objects are skipped
              by the raycaster and would take no clicks at all */}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {p && vendor.label ? (
        <Text
          position={[p.x, p.y + PROXY_LOCAL_SIZE, p.z]}
          fontSize={labelSize}
          color={vendor.accent}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {vendor.label}
        </Text>
      ) : null}
    </group>
  );
}

// ── Spotlight rig ───────────────────────────────────────────────────────────
// 7 poles × 2 bulbs sit at strip-local y=8, x≈3.98 — one pair per pole. Two
// jobs, deliberately split, because they have very different costs:
//   1. Bulbs READ as lit from any distance  → emissive material + additive
//      halo. Zero lights.
//   2. The FOCUSED vendor gets a real beam  → exactly one SpotLight, moved to
//      whichever bulb is nearest and aimed at them, alive only while zoomed.
// Fourteen real spotlights would be ~14 extra shadow passes a frame; the strip
// already avoids extra dynamic lights on purpose (see the envMap fill above).
// Export layout: 14 units named Spotlight.001–.014, each with two children —
// Spotlight_Housing.NNN (the ~1300-vert fixture) and Spotlight_Bulb.NNN (the
// 8-vert lamp). Only the lamp should ever glow; emissive on the housing is what
// turned the whole apparatus white before it was split out.
//
// The lamp ships its own material carrying emissiveFactor [1,1,1], so the glow
// is authored in Blender. This component defers to that and only applies its
// own emissive when the asset ships an unlit bulb — Blender stays the single
// source of truth for the look, and re-exports can't fight the code.
const BULB_RE = /^Spotlight_Bulb(\.\d+)?$/;

const BULB_EMISSIVE = "#ffdca8";   // warm filament
const BULB_EMISSIVE_INTENSITY = 1.6;
const HALO_COLOR = "#ffe6b8";
const HALO_PX = 11;                // constant SCREEN size — a bulb mesh goes
                                   // sub-pixel from aerial and vanishes; a
                                   // fixed-px sprite is how distant practicals
                                   // actually read.
const HALO_NEAR = 2.5;             // world units: fully faded out this close…
const HALO_FAR = 9.0;              // …and fully on by here (aerial)

// Throw is short: bulbs sit at local y=8 → ~1.08 world units up at the 0.135
// auto-fit, and a character is ~0.26 world tall, so the beam travels ~0.84.
// At the old 0.5 rad the pool was ~0.46 wide — 9× the character, i.e. a wash
// with no readable edge. Tight angle + low penumbra is what makes it a SPOT.
// three r0.185 is physically-correct: intensity is candela and falls off 1/d²,
// so at 0.84 units the surface sees intensity/0.71. It still competes with
// dirA 4.0 + dirB 3.0 + ambient 0.6 of daylight, and ACES rolls off highlights
// — see the moodDim note below if you want it to really bite.
const SPOT_COLOR = "#fff2d0";
const SPOT_INTENSITY = 9.0;
const SPOT_DISTANCE = 2.6;         // WORLD units — NOT scaled by the strip
                                   // group, so this light is mounted outside it
const SPOT_ANGLE = 0.22;
const SPOT_PENUMBRA = 0.35;
const SPOT_EASE = 4.5;             // 1/s fade in/out

// A SpotLight is invisible in air — three.js has no volumetric scattering, so a
// light alone can never look like it "emanates". The visible shaft has to be
// geometry: an additive cone from bulb to target, apex at the bulb. It lights
// nothing; it is purely the beam you can see. The two are complements, not
// alternatives — the cone can't brighten the vendor, the light can't be seen.
const BEAM_COLOR = "#ffeec4";
const BEAM_OPACITY = 0.16;         // additive, so this reads brighter than it looks
const BEAM_SPREAD = 1.35;          // beam radius vs. the light cone, slightly wider
                                   // so the visible shaft frames the lit pool

function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,230,184,0.85)");
  g.addColorStop(1.0, "rgba(255,210,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Emissive bulbs + one additive Points cloud. Rendered INSIDE the strip group
// using strip-local positions; sizeAttenuation:false keeps the halo a constant
// pixel size, so the group's ~0.135 scale can't shrink it away.
const _haloAt = /* @__PURE__ */ new THREE.Vector3();

function BulbRig({ stripScene }) {
  const matRef = useRef(null);
  const [localPts, setLocalPts] = useState(null);
  const pointsMat = useRef(null);

  useEffect(() => {
    const bulbs = [];
    stripScene.traverse((o) => { if (o.isMesh && BULB_RE.test(o.name)) bulbs.push(o); });
    if (!bulbs.length) return;

    // Defer to the asset when Blender already authored the glow. Only light the
    // bulbs ourselves if they arrive unlit — and clone before touching, since
    // all 14 share one material.
    const first = bulbs[0].material;
    const e = first?.emissive;
    const authored = !!e && (e.r + e.g + e.b) > 0.01;
    let restore = null;
    if (!authored) {
      const lit = first.clone();
      lit.emissive = new THREE.Color(BULB_EMISSIVE);
      lit.emissiveIntensity = BULB_EMISSIVE_INTENSITY;
      lit.toneMapped = false;
      matRef.current = lit;
      bulbs.forEach((b) => { b.material = lit; });
      restore = () => {
        bulbs.forEach((b) => { b.material = first; });
        try { lit.dispose(); } catch (err) {}
        matRef.current = null;
      };
    }

    // Positions relative to stripScene (identity inside the group), so they are
    // correct no matter what the auto-fit resolved to. Uses world positions, so
    // the parent Spotlight.NNN transform is already folded in.
    stripScene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(stripScene.matrixWorld).invert();
    const arr = new Float32Array(bulbs.length * 3);
    bulbs.forEach((b, i) => {
      const v = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      arr.set([v.x, v.y, v.z], i * 3);
    });
    setLocalPts(arr);

    return () => { restore?.(); };
  }, [stripScene]);

  const tex = useMemo(() => (typeof document === "undefined" ? null : haloTexture()), []);
  useEffect(() => () => { try { tex?.dispose(); } catch (e) {} }, [tex]);

  // Fade the halo in with camera distance so it carries the aerial read without
  // blowing out a face close-up, where the emissive mesh already does the work.
  // Measured to the STRIP, not the world origin — the mesa origin sits ~5.6
  // units off the boardwalk, which would leave the halo half-lit up close.
  const ptsRef = useRef();
  useFrame((state) => {
    const m = pointsMat.current, o = ptsRef.current;
    if (!m || !o) return;
    o.getWorldPosition(_haloAt);
    const d = state.camera.position.distanceTo(_haloAt);
    m.opacity = THREE.MathUtils.clamp((d - HALO_NEAR) / (HALO_FAR - HALO_NEAR), 0, 1);
    m.visible = m.opacity > 0.01;
  });

  if (!localPts || !tex) return null;
  return (
    <points ref={ptsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[localPts, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={pointsMat}
        map={tex}
        color={HALO_COLOR}
        size={HALO_PX}
        sizeAttenuation={false}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

const _spotAt = /* @__PURE__ */ new THREE.Vector3();
const _beamDir = /* @__PURE__ */ new THREE.Vector3();
const _bulbAt = /* @__PURE__ */ new THREE.Vector3();

// One SpotLight for the whole strip, mounted OUTSIDE the scaled group: distance
// and decay are world-space and do NOT inherit the group's scale, while
// position would — mixing the two is the trap behind GLOW_LIGHT_DISTANCE.
function VendorSpotlight({ focus, stripScene }) {
  const lightRef = useRef();
  const targetRef = useRef();
  const beamRef = useRef();
  const beamMat = useRef();
  const level = useRef(0);

  const bulbs = useMemo(() => {
    const out = [];
    stripScene.traverse((o) => { if (o.isMesh && BULB_RE.test(o.name)) out.push(o); });
    return out;
  }, [stripScene]);

  useEffect(() => {
    if (lightRef.current && targetRef.current) lightRef.current.target = targetRef.current;
  }, []);

  useFrame((state, delta) => {
    const l = lightRef.current, t = targetRef.current;
    if (!l || !t) return;
    const want = focus?.object ? 1 : 0;
    level.current += (want - level.current) * (1 - Math.exp(-SPOT_EASE * delta));
    l.intensity = level.current * SPOT_INTENSITY;
    l.visible = level.current > 0.004;
    if (beamRef.current) beamRef.current.visible = l.visible;
    if (!l.visible || !focus?.object) return;

    focus.object.getWorldPosition(_spotAt);
    t.position.copy(_spotAt);
    t.updateMatrixWorld();

    // nearest bulb along the boardwalk (horizontal distance only — every bulb
    // is at the same height, so vertical distance carries no information)
    let best = null, bestD = Infinity;
    for (const b of bulbs) {
      b.getWorldPosition(_bulbAt);
      const d = (_bulbAt.x - _spotAt.x) ** 2 + (_bulbAt.z - _spotAt.z) ** 2;
      if (d < bestD) { bestD = d; best = _bulbAt.clone(); }
    }
    if (!best) return;
    l.position.copy(best);

    // Visible shaft: a cone spanning bulb → target. coneGeometry runs along +Y
    // with the apex at +h/2, so pointing +Y at the bulb puts the apex on the
    // lamp and flares the base out over the vendor.
    const beam = beamRef.current, bm = beamMat.current;
    if (!beam || !bm) return;
    const h = best.distanceTo(_spotAt);
    if (h < 1e-4) return;
    const r = Math.tan(SPOT_ANGLE) * h * BEAM_SPREAD;
    beam.position.copy(best).add(_spotAt).multiplyScalar(0.5);
    _beamDir.copy(best).sub(_spotAt).normalize();
    beam.quaternion.setFromUnitVectors(_UP, _beamDir);
    beam.scale.set(r, h, r);                 // unit cone: r=1, h=1
    bm.opacity = level.current * BEAM_OPACITY;
  });

  return (
    <>
      <object3D ref={targetRef} />
      <spotLight
        ref={lightRef}
        color={SPOT_COLOR}
        intensity={0}
        distance={SPOT_DISTANCE}
        angle={SPOT_ANGLE}
        penumbra={SPOT_PENUMBRA}
        decay={2}
        castShadow={false}
      />
      <mesh ref={beamRef} frustumCulled={false} renderOrder={2}>
        <coneGeometry args={[1, 1, 20, 1, true]} />
        <meshBasicMaterial
          ref={beamMat}
          color={BEAM_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

export default function CommercialStrip({ worldW, worldD, cellSize = 1, vendors = VENDOR_CATALOG, onVendorClick, onFocusObject, onZoomOut }) {
  const { scene: stripScene } = useGLTF(STRIP_MODEL);
  // Which vendor is zoomed, and what the beam should point at. Lifted here so
  // one shared SpotLight can serve every vendor.
  const [focus, setFocus] = useState(null);

  const deckW = worldW + DECK_MARGIN * 2 * cellSize;
  const deckD = DECK_DEPTH * cellSize;
  const deckZ = -(worldD / 2 + deckD / 2); // flush against the −Z edge

  // Auto-fit from the GLB's own bounds rather than hand-tuned numbers, so a
  // re-export at a different size — or a different grid — still lands right.
  // With STRIP_ROT_Y = +90°, local (x,y,z) → world (z, y, −x): the strip's long
  // local Z becomes the mesa's X edge, and its local X becomes deck depth.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(stripScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = deckW / (size.z || 1);
    return {
      scale,
      position: [
        -center.z * scale,        // long axis centred on the mesa edge
        -box.min.y * scale,       // deck surface flush with the field (y = 0)
        deckZ + center.x * scale, // depth centred on the deck line
      ],
    };
  }, [stripScene, deckW, deckZ]);

  return (
    <>
      {/* diagonal knee braces: lower end embedded in the mesa wall, upper end
          meeting the deck's underside near its outer edge. These tie the strip
          to the mesa and are not part of the Synty set, so they stay procedural
          and in world units — outside the auto-fitted group below. */}
      {Array.from({ length: 4 }, (_, i) => {
        const x = -deckW / 2 + (i + 0.5) * (deckW / 4);
        return (
          <mesh key={`strut-${i}`} position={[x, -0.55 * cellSize, -(worldD / 2 + 0.4 * cellSize)]} rotation={[-Math.PI / 4, 0, 0]}>
            <boxGeometry args={[0.06 * cellSize, 1.3 * cellSize, 0.06 * cellSize]} />
            <meshStandardMaterial color={WOOD_POST} roughness={0.85} metalness={0.05} />
          </mesh>
        );
      })}
      {/* One shared transform for the strip AND every character: the character
          GLBs are exported in the strip's coordinate space, so they must ride
          the identical scale/rotation or they drift off their props. */}
      {/* Outside the scaled group on purpose: SpotLight distance/decay are
          world-space and would not inherit fit.scale, while position would. */}
      <VendorSpotlight focus={focus} stripScene={stripScene} />
      <group position={fit.position} rotation={[0, STRIP_ROT_Y, 0]} scale={fit.scale}>
        <primitive object={stripScene} />
        {/* Inside the group: halo positions are strip-local, and the constant
            pixel size is immune to the scale. */}
        <BulbRig stripScene={stripScene} />
        {vendors.map((v) => (
          <VendorStall
            key={v.id}
            vendor={v}
            stripScene={stripScene}
            stripRotY={STRIP_ROT_Y}
            framingUnit={fit.scale / LEGACY_MODEL_SCALE}
            propObj={v.prop ? findByBaseName(stripScene, v.prop) : null}
            onVendorClick={onVendorClick}
            onFocusObject={onFocusObject}
            onZoomOut={onZoomOut}
            onFocusChange={setFocus}
          />
        ))}
      </group>
    </>
  );
}
