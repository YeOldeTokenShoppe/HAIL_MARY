"use client";
// ── Phone MIDWAY (the boomtown strip at the field's edge; "boardwalk" stays as the
// internal key and the deck object): one live stall inside a portal card ────
// The phone never loads the whole strip GLB. Browsing is a row of POSTCARDS
// (stills rendered from the desktop strip by scripts/render-postcards.mjs);
// picking one mounts that STALL alone — its props extracted from the strip by
// scripts/extract-stalls.mjs (public/models/stalls/stall_<id>.glb, original
// transforms, the deck included) plus the vendor character, composed in the
// strip's own frame exactly as CommercialStrip does — inside a
// MeshPortalMaterial card (Wawa Sensei's "stage" idiom), with the stall's
// BACKPLATE (the same still with this stall's dressing hidden) behind it so
// the neighbours and sky show through. STEP UP blends the portal to full
// screen — the same face-zoom + SitePal pitch the desktop gives when you walk
// up — and the vendor's panel (the salesman's cart) sits under the scene in
// DOM. One portal is ever live, so one extra render pass and one stall's
// textures (1k) in memory.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshPortalMaterial, RoundedBox, Text, useTexture, useGLTF, useAnimations } from "@react-three/drei";
import { VendorModel, VENDOR_CATALOG, pinVendorPoseModel, getChosenPoseModel, applyStallEmissiveBoost } from "@/components/CommercialStrip";
import { activateVendorSitePal, deactivateVendorSitePal, warmVendorSitePal, onVendorTalk } from "@/lib/vendorSitePal";
import { goodsForVendor } from "@/lib/oilVendor";

export const BOARDWALK_NAMES = {
  tonics: "REMEDIES", fortunes: "FORTUNES", hotdogs: "HOT DOGS", tacos: "TACOS", promos: "PROMOS",
  rugs: "RUGS", tattoos: "TATTOOS", carny: "THRILL RIDE", souvenirs: "SOUVENIRS", chapel: "CHAPEL",
};
// Row order on the phone: the salesman first (he sells the holy water). The
// souvenir tent is off the row: its prop is not in the current strip export.
// tacos retired 2026-09-04 — the chapel took its stretch of deck (docs/midway-chapel.md)
export const BOARDWALK_ORDER = ["tonics", "fortunes", "hotdogs", "chapel", "promos", "rugs", "tattoos", "carny"];
export const postcardUrl = (id) => `/boardwalk/${id}.webp`;
export const plateUrl = (id) => `/boardwalk/${id}-plate.webp`;
// a vendor with its own `stallModel` (the chapel) loads that exact, versioned URL
export const stallUrl = (id) => VENDOR_CATALOG.find((v) => v.id === id)?.stallModel || `/models/stalls/stall_${id}.glb`;

// Step up to a stall: MUST run inside the user's tap. activateVendorSitePal
// unlocks browser audio and (on touch) boots the lazily embedded player from
// that gesture — the desktop walk-up calls it from the stall click for the
// same reason. Called from the STEP UP button and the card tap; the stage's
// effect only handles the mute on the way out.
export function stepUpVendor(vendorId) {
  const v = VENDOR_CATALOG.find((x) => x.id === vendorId);
  if (v?.sitepal) activateVendorSitePal(v.sitepal);
}
export function stepBackVendor() { deactivateVendorSitePal(); }
export function warmBoardwalk(reason = "boardwalk") { warmVendorSitePal(reason); }

// ?spdebug=1 — SitePal state on screen, for phone testing (Web Inspector optional).
function SitePalReadout() {
  const [txt, setTxt] = useState("");
  useEffect(() => {
    if (typeof window === "undefined" || !/[?&]spdebug=1\b/.test(window.location.search)) return;
    const t = setInterval(() => {
      const w = window;
      setTxt(`sitepal · embedded ${!!w.__vendorSitePalEmbedded} · wanted ${!!w.__vendorSitePalWanted} · scene ${w.__vendorSitePalCurrentSceneId ?? "-"} loaded ${w.__vendorSitePalSceneLoaded ?? "-"} · vol ${w.__vendorSitePalDesiredVolume ?? "-"} · say ${typeof w.sayText === "function" ? "ready" : "no"} · silent ${typeof w.saySilent === "function" ? "ok" : "no"}`);
    }, 500);
    return () => clearInterval(t);
  }, []);
  if (!txt) return null;
  return <div style={{ ...mono, position: "absolute", left: 8, right: 8, top: 96, fontSize: 8, lineHeight: 1.4, padding: "4px 6px", background: "rgba(0,0,0,0.7)", color: "#9fe0a8", borderRadius: 4, pointerEvents: "none", wordBreak: "break-word" }}>{txt}</div>;
}

// Looking a touch below the card's centre lifts the whole staged view so the
// card sits centred in the space ABOVE the postcard band, not the canvas.
export const STAGE_CAMERA = { position: [0, -0.06, 1.45], target: [0, -0.06, 0] };
// Stepped up: the desktop's hero close-up — under the eyeline, looking up a touch.
const FACE_CAMERA = { position: [0, 0.08, 0.4], target: [0, 0.12, 0] };
// A playing card (2.5 × 3.5), held small enough that its sides show as it spins;
// double-tapping blends the portal to full screen, so the card's size only
// governs the staged view.
const CARD = { w: 0.56, h: 0.784, depth: 0.045, radius: 0.032 };
const CARD_FONT = "/fonts/BowlbyOneSC-Regular.ttf";   // the "Dragon" lettering of the portal-card demo, from our own fonts
const SPIN = { drag: 0.011, friction: 3.2, settle: 7, tapPx: 8, tapMs: 450, doubleMs: 320 };
// Idle sway is OFF (2026-09-04): the portal's world moves with the card, so a
// tilt read as the wagon interior rocking like a boat. The machinery stays for
// a possible label-only or rim-only hint later; both amplitudes are zero.
const IDLE = { yaw: 0, pitch: 0, yawHz: 0.22, pitchHz: 0.15, fade: 5 };
const CHAR_H = 0.515;          // character height inside the card
const FLOOR_Y = -0.325;        // his feet (card spans y −0.352 … 0.432)
// A stall that extends TOWARD the camera (the fortune teller's wagon is long
// along the deck and she sits deep inside it) would swallow the camera; the
// whole stall slides back until its front is at STALL_FRONT_Z, so the card
// looks in through the doorway at her instead of at a wall.
const STALL_FRONT_Z = 1.05;
// Per-stall staging. The fortune teller sits deep inside a wagon that is long
// along the deck, behind an interior partition; the card's camera has to be
// INSIDE that partition to see her at her table with the crystal ball, so at
// rest her stall comes forward (restShift z) and up in scale (restScale), the
// pivot being her. Stepping in eases both back to the plain fit for the
// close-up. rest/openYaw let a stall turn between the two states.
const STAGE_TUNE = {
  // keepPropsOnBack: the flipped card keeps the wagon (interior + props) instead
  // of the bare deck; the forward shift follows the card's facing (cos of its
  // yaw), so from the back the camera is again inside the wagon, behind her.
  // backShiftZ: extra forward shift as the card turns to its back, so the camera
  // ends up inside the wagon behind her rather than outside its rear wall.
  // (her door sits 0.4 behind her back: the back view needs the camera INSIDE it,
  // so the stall comes 1.28 toward the camera and 0.1 down — an over-the-shoulder
  // look at the table and the customer's stools)
  // hideOnBack: her rear door is a hand's width behind her back, so no camera
  // fits between them; the flipped card hides that one door and looks in
  // through the open doorway — her back, the table, the ball, the customer's stools.
  fortunes: { restYaw: 0, openYaw: 0, restShift: [0.02, -0.03, -0.04], restScale: 1.55, noSlide: true, keepPropsOnBack: true, hideOnBack: ["SM_Veh_Wagon_01_Door_02"], backShiftZ: 0.5, backShiftY: 0.14 },
  // The tattoo tent is 1.45 × 1.28 at the plain fit against a 0.56 × 0.78
  // window, so only fragments showed (and seated, she is INSIDE it, its front
  // between her and the camera). At rest the whole stall scales to 0.6 about
  // her, the floor nudged back down to the card's bottom, so tent, sign, the
  // client's chair and both poses fit; stepping in returns to the plain fit.
  // back: the tent's rear canvas is one mesh, so the flipped card brings the stall
  // forward until the camera is inside the tent (her seated pose puts the rear
  // wall 0.49 behind her at this scale, standing 0.85) — a medium look at her back
  // back: the tent (one closed canvas mesh) steps aside, the chair, stool and sign
  // stay, and the stall comes a little forward — a medium look at her back, not tight
  tattoos: { pose: "tattooing", restScale: 0.6, restShift: [-0.08, -0.13, 0], noSlide: true, keepPropsOnBack: true, hideOnBack: ["SM_Prop_Tent_01"], backShiftZ: 0.45, backShiftY: 0.05 },
  // the rug seller sits behind his card table: the flipped card keeps the whole
  // stall (chair, folding tables, card decks, boxes, laptops, the sign) — he's
  // seen from behind with the merch laid out in front of him
  rugs: { keepPropsOnBack: true, backShiftY: 0.04 },   // a hair higher; more would pull the awning into the frame
  // the chapel (Tent_Revival.glb): the flipped card drops the big tent and its
  // four wall panels (all SM_Bld_Tent_01*) and looks over the preacher's
  // shoulder at the podium, the chairs and the candle rack
  chapel: { keepPropsOnBack: true, hideOnBack: ["SM_Bld_Tent_01"], backShiftZ: 0.12, backShiftY: 0.02 },
};
// Tuning overrides (dev): ?stallfront=<z> and ?stallyaw=<deg> — the front limit and an absolute stall yaw.
const TUNE = (() => { if (typeof window === "undefined") return {}; const q = new URLSearchParams(window.location.search); const f = parseFloat(q.get("stallfront")), y = parseFloat(q.get("stallyaw")), bz = parseFloat(q.get("stallback")), by = parseFloat(q.get("stallbacky")), bp = parseFloat(q.get("stallpitch")); return { front: Number.isFinite(f) ? f : null, yaw: Number.isFinite(y) ? (y * Math.PI) / 180 : null, back: Number.isFinite(bz) ? bz : null, backY: Number.isFinite(by) ? by : null, backPitch: Number.isFinite(bp) ? (bp * Math.PI) / 180 : null }; })();
const STRIP_ROT_Y = Math.PI / 2;          // the strip's frame turn
const VENDOR_LOCAL_FACE_YAW = -Math.PI / 2; // the strip's default facing (CommercialStrip)

function StageCamera({ open }) {
  const { camera } = useThree();
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), cur: new THREE.Vector3(...STAGE_CAMERA.target) }), []);
  useEffect(() => {
    camera.position.set(...STAGE_CAMERA.position);
    camera.lookAt(...STAGE_CAMERA.target);
    camera.updateProjectionMatrix();
  }, [camera]);
  useFrame((_, dt) => {
    const want = open ? FACE_CAMERA : STAGE_CAMERA;
    tmp.p.set(...want.position); tmp.t.set(...want.target);
    const k = 1 - Math.exp(-dt * 3.5);
    camera.position.lerp(tmp.p, k); tmp.cur.lerp(tmp.t, k); camera.lookAt(tmp.cur);
  });
  return null;
}

// The portal's own sky: a gradient sphere in the page's palette, so a turned
// card (or the full-screen view) never shows black past the backplate.
function PortalSky({ top = "#54aee8", bottom = "#c9e7f7" }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 2; c.height = 128; const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, top); grd.addColorStop(0.55, bottom); grd.addColorStop(1, bottom);
    g.fillStyle = grd; g.fillRect(0, 0, 2, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  }, [top, bottom]);
  return (
    <mesh>
      <sphereGeometry args={[8, 24, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function Backdrop({ id }) {
  const tex = useTexture(plateUrl(id));
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; }, [tex]);
  // Big enough to fill the card's view AND the full-screen view (see the frustum note in the file header).
  return (
    <mesh position={[0, 0.02, -0.62]}>
      <planeGeometry args={[1.6, 2.13]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// The stall's props (extracted from the strip, original transforms) and the
// character at the catalog offset, in the strip's own frame — one group turned
// so the vendor faces the camera (the strip's yaw maths, so VendorModel's head
// tracking agrees) and FITTED from the vendor's POSED bones a few frames in:
// scaled so he stands CHAR_H tall, moved so his feet meet FLOOR_Y at the card's
// centre. The props ride along, so his place in his stall is the desktop's.
// (Box3 on a skinned mesh only measures the bind pose — a seated vendor would
// float; bones don't lie.)
// `frontRef.current` false = the card is showing its back: the stall's props
// step aside (the wagon would otherwise fill the window with its rear wall)
// and only the deck stays under the vendor, seen from behind against the sky.
function StallProps({ id, frontRef, keepOnBack = false, hideOnBack = null, showOnBack = null, onScene }) {
  const { scene, animations } = useGLTF(stallUrl(id));
  useEffect(() => { scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } }); applyStallEmissiveBoost(scene, id); }, [scene, id]);
  // A stall may carry its own extras — the chapel's seated congregation (a
  // robot and a biker, each with a looping *_Sit clip). Every clip the stall
  // GLB holds plays, looping, from mount; a prop-only stall has none.
  const holder = useRef(null);
  const { actions } = useAnimations(animations, holder);
  useEffect(() => { const list = Object.values(actions || {}).filter(Boolean); list.forEach((a) => a.reset().setLoop(THREE.LoopRepeat, Infinity).play()); return () => list.forEach((a) => a.stop()); }, [actions]);
  const base = (n) => (n || "").replace(/\.\d{3}$/, "");
  // Hand the stall scene up: VendorModel's glow effect looks for the vendor's
  // glowMesh (the fortune teller's crystal ball) in the "strip" scene — here
  // that is the extracted stall — and dresses it in the swirl shader.
  useEffect(() => { onScene?.(scene); return () => onScene?.(null); }, [scene, onScene]);
  useEffect(() => { if (typeof window !== "undefined") window.__hmStallMats = () => { const out = []; scene.traverse((o) => { if (o.isMesh && /crystal/i.test(o.name || o.parent?.name || "")) out.push(`${o.parent?.name}/${o.name || "mesh"}: ${o.material?.type}${o.material?.uniforms?.uTime ? " (swirl)" : ""}`); }); return out; }; }, [scene]);
  const hideList = useMemo(() => { if (!hideOnBack?.length) return []; const out = []; scene.traverse((o) => { if (hideOnBack.includes(base(o.name))) out.push(o); }); return out; }, [scene, hideOnBack]);
  useFrame(() => {
    const showingBack = frontRef ? frontRef.current === false : false;
    const front = keepOnBack || !showingBack;
    // on the back, props step aside except the deck and any `showOnBack` nodes (a seated vendor's chair)
    for (const child of scene.children) { const keep = child.name === "Boardwalk" || front || (showingBack && !!showOnBack?.includes(base(child.name))); if (child.visible !== keep) child.visible = keep; }
    for (const o of hideList) { const keep = !showingBack; if (o.visible !== keep) o.visible = keep; }
    if (typeof window !== "undefined") window.__hmStallHide = (re, on = false) => { const rx = new RegExp(re, "i"); let n = 0; scene.traverse((o) => { if (o.isMesh && rx.test(`${o.parent?.name}/${o.name}`)) { o.visible = on; n++; } }); return n; };
    if (typeof window !== "undefined") window.__hmStallBox = (deep = false) => { const out = {}; scene.updateMatrixWorld(true); const list = []; if (deep) scene.traverse((o) => { if (o.isMesh) list.push(o); }); else list.push(...scene.children); for (const child of list) { const b = new THREE.Box3().setFromObject(child); if (!b.isEmpty()) out[child.name || (child.parent?.name + "/mesh")] = [b.min.toArray().map((v) => +v.toFixed(2)), b.max.toArray().map((v) => +v.toFixed(2))]; } return out; };
  });
  return <group ref={holder}><primitive object={scene} /></group>;
}
function StageStall({ vendor, focusedRef, frontRef, cardYawRef, open = false }) {
  // Two levels: the OUTER group turns and slides in world space, the INNER group
  // carries the fit (scale + the offset that puts the vendor's bones at the
  // origin). Rotating the outer therefore pivots the whole stall around the
  // vendor — a tuned stall (the fortune teller's wagon) turns to present her.
  const outer = useRef();
  const inner = useRef();
  const headRef = useRef(null);
  const frames = useRef(0);
  const fitted = useRef(false);
  const tune = STAGE_TUNE[vendor.id];
  // a pinned pose (the tattoo artist seated, working) — set before VendorModel reads the draw
  const chosenPose = useMemo(() => (tune?.pose ? pinVendorPoseModel(vendor.id, tune.pose) : getChosenPoseModel(vendor.id)), [vendor.id, tune?.pose]);
  // The pose's overrides (facing, gaze lift, head roll, pause-on-focus…) folded
  // over the vendor, as VendorStall does — VendorModel's HEAD TRACKING needs
  // them to turn her toward the viewer correctly once stepped in.
  const vendorEff = useMemo(() => { const over = chosenPose ? vendor.poseOverrides?.[chosenPose] : null; return over ? { ...vendor, ...over } : vendor; }, [vendor, chosenPose]);
  // the STALL's orientation stays on the catalog facing (the pose override may face elsewhere within it)
  const faceYaw = STRIP_ROT_Y + (VENDOR_LOCAL_FACE_YAW - (vendor.faceYaw ?? VENDOR_LOCAL_FACE_YAW));
  const rotY = TUNE.yaw ?? (tune ? (open ? (tune.openYaw ?? faceYaw) : (tune.restYaw ?? faceYaw)) : faceYaw);
  const hasCharacter = !!(vendor.model || vendor.poseModels?.length);
  const slide = useRef(0);
  const rest = useRef(open ? 0 : 1);
  const [stallScene, setStallScene] = useState(null);
  // debug: the head's world forward (z toward the camera = facing the viewer)
  useEffect(() => { if (typeof window === "undefined") return; window.__hmHeadFwd = () => { const h = headRef.current; if (!h) return null; const q = h.getWorldQuaternion(new THREE.Quaternion()); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); const u = new THREE.Vector3(0, 1, 0).applyQuaternion(q); return { f: f.toArray().map((v) => +v.toFixed(2)), up: u.toArray().map((v) => +v.toFixed(2)) }; }; }, []);
  useFrame((_, dt) => {
    const o = outer.current, g = inner.current; if (!o || !g) return;
    if (fitted.current) {
      if (tune && TUNE.yaw == null) {
        o.rotation.y = THREE.MathUtils.damp(o.rotation.y, rotY, 4, dt);
        // k: 1 at rest → 0 when stepped in; the rest nudge and rest scale ease with it
        rest.current = THREE.MathUtils.damp(rest.current, open ? 0 : 1, 4, dt);
        const k = rest.current;
        const sh = tune.restShift || [0, 0, 0];
        // turning to the back: ease the stall toward the camera by backShiftZ so the flipped card is looked into
        // from behind. The world rotates WITH the card, so "toward the camera" in this frame flips sign with its yaw.
        const yaw = cardYawRef ? (cardYawRef.current || 0) : 0;
        const back = (1 - Math.cos(yaw)) / 2, toward = Math.cos(yaw);
        // the sideways nudge centres the STALL at rest; on the back the vendor is the subject, so it fades out
        o.position.set(sh[0] * k * (1 - back), (sh[1] - (TUNE.backY ?? tune.backShiftY ?? 0) * back) * k, slide.current + (sh[2] + (TUNE.back ?? tune.backShiftZ ?? 0) * back) * toward * k);
        // backPitch: the level card camera "looks down" over her shoulder by pitching the interior up toward it
        o.rotation.x = (TUNE.backPitch ?? tune.backPitch ?? 0) * back * k;
        o.scale.setScalar(1 + ((tune.restScale || 1) - 1) * k);
      }
      return;
    }
    if (++frames.current < 4) return;
    const w = new THREE.Vector3(); let lo = Infinity, hi = -Infinity, cx = 0, cz = 0, n = 0;
    g.scale.setScalar(1); g.position.set(0, 0, 0); o.rotation.set(0, rotY, 0); o.position.set(0, 0, 0); o.updateMatrixWorld(true);
    // bones in the INNER frame (pre-rotation), so the offset is a local one
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    g.traverse((obj) => { if (obj.isBone) { obj.getWorldPosition(w); w.applyMatrix4(inv); lo = Math.min(lo, w.y); hi = Math.max(hi, w.y); cx += w.x; cz += w.z; n++; } });
    if (!n || !(hi - lo > 1e-4)) { if (frames.current > 90) fitted.current = true; return; }
    const h = (hi - lo) * 1.12;              // bones stop at the crown; allow for hair/hat
    const sc = CHAR_H / h;
    g.scale.setScalar(sc);
    g.position.set(-(cx / n) * sc, FLOOR_Y - lo * sc, -(cz / n) * sc);
    o.updateMatrixWorld(true);
    // props reaching toward the camera (world z): slide the whole stall back
    let maxZ = -Infinity;
    g.traverse((obj) => { if (obj.isMesh && !obj.isSkinnedMesh && obj.name !== "Boardwalk" && !/Boardwalk/.test(obj.parent?.name || "")) { const b = new THREE.Box3().setFromObject(obj); if (!b.isEmpty()) maxZ = Math.max(maxZ, b.max.z); } });
    const frontZ = TUNE.front ?? STALL_FRONT_Z;
    // a tuned stall places itself; the generic slide-back would push the close-up outside the partition
    slide.current = (!tune?.noSlide && maxZ > frontZ) ? -(maxZ - frontZ) : 0;
    const k0 = open ? 0 : 1; const sh = tune?.restShift || [0, 0, 0];
    o.position.set(sh[0] * k0, sh[1] * k0, slide.current + sh[2] * k0);
    o.scale.setScalar(1 + ((tune?.restScale || 1) - 1) * k0);
    if (typeof window !== "undefined") window.__hmStallFit = { s: +sc.toFixed(3), inner: g.position.toArray().map((v) => +v.toFixed(3)), outer: o.position.toArray().map((v) => +v.toFixed(3)), maxZ: +maxZ.toFixed(3), rotY: +rotY.toFixed(3) };
    fitted.current = true;
  });
  return (
    <group ref={outer} rotation={[0, rotY, 0]}>
      <group ref={inner}>
        <Suspense fallback={null}><StallProps id={vendor.id} frontRef={frontRef} keepOnBack={!!tune?.keepPropsOnBack} hideOnBack={tune?.hideOnBack || null} showOnBack={tune?.showOnBack || null} onScene={setStallScene} /></Suspense>
        {hasCharacter && (
          <group position={vendor.offset || [0, 0, 0]}>
            <VendorModel vendor={vendorEff} focusedRef={focusedRef} headRef={headRef} stripScene={stallScene} stripRotY={rotY} />
          </group>
        )}
      </group>
    </group>
  );
}

export default function VendorStage({ vendorId = "tonics", open = false, onToggle, lowTier = false, sky = null }) {
  const vendor = useMemo(() => VENDOR_CATALOG.find((v) => v.id === vendorId) || VENDOR_CATALOG[0], [vendorId]);
  const portal = useRef();
  // Head tracking (VendorModel's focusedRef): the vendor looks up at the viewer
  // when stepped in and whenever SitePal is speaking, then goes back to work
  // (the tattoo artist to her client) a couple of seconds after the last line.
  // Without a voice the greeting window alone covers the first FOCUS_GRACE seconds.
  const FOCUS_GRACE = 7, FOCUS_LINGER = 2.5;
  const focusedRef = useRef(open);
  const talk = useRef({ talking: false, endedAt: 0, openedAt: 0 });
  useEffect(() => { talk.current.openedAt = open ? performance.now() : 0; if (!open) focusedRef.current = false; }, [open]);
  useEffect(() => {
    const off = onVendorTalk((_vendorId, t) => { const st = talk.current; if (st.talking && !t) st.endedAt = performance.now(); st.talking = !!t; });
    return () => { if (typeof off === "function") off(); };
  }, []);
  useFrame((_, dt) => {
    const m = portal.current; if (!m) return;
    m.blend = THREE.MathUtils.damp(m.blend, open ? 1 : 0, 4.5, dt);
  });
  // The greeting starts in the tap (stepUpVendor) and the mute on the way out
  // is imperative too (stepBackVendor, from the page's toggle/select/tab
  // switch) — the desktop's enter/exit are imperative for the same reason.
  // Only the unmount mutes from here.
  useEffect(() => () => { deactivateVendorSitePal(); }, []);
  // ── The card as a trading card (wass08/r3f-mesh-portal-material) ────────────
  // The portal is double-sided, so the card is a window: ONE TAP flips it
  // (the stall shows through its back — the vendor from behind), a DOUBLE TAP
  // steps in, a drag spins it and a flick settles on whichever face is nearer.
  // Stepping in turns the card to its front first, so the blend never opens on
  // the vendor's back. The name sits on the front face in the stall's accent.
  const card = useRef();
  const label = useRef();
  const spin = useRef({ y: 0, vy: 0, tilt: 0, down: false, lastX: 0, lastT: 0, downX: 0, downT: 0, moved: 0, target: null, tapTimer: null, lastTapT: 0, idle: 0, t: 0 });
  const frontRef = useRef(true);
  const cardYawRef = useRef(0);
  useEffect(() => () => { if (spin.current.tapTimer) clearTimeout(spin.current.tapTimer); }, []);
  useFrame((_, dt) => {
    const sp = spin.current; const g = card.current; if (!g) return;
    if (open) { sp.vy = 0; sp.target = null; sp.y = THREE.MathUtils.damp(sp.y, 0, 8, dt); }
    else if (!sp.down) {
      sp.vy *= Math.exp(-dt * SPIN.friction);
      sp.y += sp.vy * dt;
      if (sp.target != null || Math.abs(sp.vy) < 0.7) {
        const target = sp.target ?? Math.round(sp.y / Math.PI) * Math.PI;
        sp.y = THREE.MathUtils.damp(sp.y, target, sp.target != null ? 5 : SPIN.settle, dt);
        if (Math.abs(sp.y - target) < 1e-3) { sp.y = target; sp.target = null; }
      }
    }
    sp.tilt = THREE.MathUtils.damp(sp.tilt, sp.down ? THREE.MathUtils.clamp(-sp.vy * 0.02, -0.12, 0.12) : 0, 6, dt);
    // the idle sway, eased in when nothing else is moving the card and out the moment something is
    sp.t += dt;
    const resting = !open && !sp.down && sp.target == null && Math.abs(sp.vy) < 0.05;
    sp.idle = THREE.MathUtils.damp(sp.idle, resting ? 1 : 0, IDLE.fade, dt);
    const swayY = Math.sin(sp.t * IDLE.yawHz * 2 * Math.PI) * IDLE.yaw * sp.idle;
    const swayX = Math.sin(sp.t * IDLE.pitchHz * 2 * Math.PI + 1.3) * IDLE.pitch * sp.idle;
    g.rotation.set(sp.tilt + swayX, sp.y + swayY, 0);
    frontRef.current = Math.cos(sp.y) > -0.2;   // past ~100° the back is the view
    cardYawRef.current = sp.y + swayY;
    if (typeof window !== "undefined") { window.__hmCardSpin = sp.y; window.__hmCardRot = [g.rotation.x, g.rotation.y]; }
    // the name fades as the portal opens (it would float over the full-screen view)
    if (label.current) label.current.fillOpacity = 1 - (portal.current?.blend || 0);
    // focus = stepped in AND (speaking | just opened | just finished speaking)
    { const st = talk.current, now = performance.now();
      focusedRef.current = open && (st.talking || now - st.openedAt < FOCUS_GRACE * 1000 || (st.endedAt > 0 && now - st.endedAt < FOCUS_LINGER * 1000)); }
  });
  const onDown = (e) => { e.stopPropagation(); const sp = spin.current; sp.down = true; sp.vy = 0; sp.lastX = sp.downX = e.clientX; sp.lastT = sp.downT = performance.now(); sp.moved = 0; try { e.target.setPointerCapture(e.pointerId); } catch {} };
  const onMove = (e) => { const sp = spin.current; if (!sp.down) return; const now = performance.now(); const dx = e.clientX - sp.lastX; const dtMs = Math.max(1, now - sp.lastT); sp.moved += Math.abs(dx); sp.y += dx * SPIN.drag; sp.vy = (dx * SPIN.drag) / (dtMs / 1000); sp.lastX = e.clientX; sp.lastT = now; };
  const onUp = (e) => {
    const sp = spin.current; if (!sp.down) return; sp.down = false;
    try { e.target.releasePointerCapture(e.pointerId); } catch {}
    const now = performance.now();
    const tap = sp.moved < SPIN.tapPx && now - sp.downT < SPIN.tapMs;
    if (!tap) { sp.vy = THREE.MathUtils.clamp(sp.vy, -14, 14); return; }
    e.stopPropagation();
    if (open) { stepBackVendor(); onToggle?.(); return; }          // inside: a tap steps back
    if (sp.tapTimer && now - sp.lastTapT < SPIN.doubleMs) {         // double tap: step in
      clearTimeout(sp.tapTimer); sp.tapTimer = null; sp.lastTapT = 0;
      sp.target = null; stepUpVendor(vendor.id); onToggle?.();
      return;
    }
    sp.lastTapT = now;                                              // single tap: flip after the double-tap window
    sp.tapTimer = setTimeout(() => {
      sp.tapTimer = null;
      const base = sp.target ?? Math.round(sp.y / Math.PI) * Math.PI;
      sp.target = base + Math.PI; sp.vy = 0;
    }, SPIN.doubleMs);
  };
  const name = BOARDWALK_NAMES[vendor.id] || vendor.id.toUpperCase();
  return (
    <group name="vendor-stage">
      <StageCamera open={open} />
      <group ref={card} position={[0, 0.04, 0]}>
      {/* rim in the stall's accent: a border THINNER than the card, centred on it,
          so both portal faces stand proud of it — the back of the card is a
          window too, not a coloured slab */}
      <RoundedBox args={[CARD.w + 0.03, CARD.h + 0.03, CARD.depth - 0.012]} radius={CARD.radius} position={[0, 0, 0]}>
        <meshBasicMaterial color={vendor.accent || "#ffd27a"} toneMapped={false} />
      </RoundedBox>
      {/* the name, on the front face */}
      <Text ref={label} font={CARD_FONT} fontSize={0.064} anchorX="center" anchorY="bottom" position={[0, -CARD.h / 2 + 0.05, CARD.depth / 2 + 0.003]} color={vendor.accent || "#ffd27a"} outlineWidth={0.004} outlineColor="#1a0c08" outlineOpacity={0.6}>
        {name}
        <meshBasicMaterial toneMapped={false} transparent />
      </Text>
      <RoundedBox name="vendor-card" args={[CARD.w, CARD.h, CARD.depth]} radius={CARD.radius} position={[0, 0, 0]}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
        <MeshPortalMaterial ref={portal} blend={0} side={THREE.DoubleSide} resolution={lowTier ? 512 : 1024} events={false}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[0.6, 1.2, 1.4]} intensity={1.6} />
          <directionalLight position={[-0.8, 0.6, 0.4]} intensity={0.5} color="#ffd9b0" />
          {/* The lights ride inside the portal, so they turn with the card: on the
              flipped card the key sits BEHIND whatever faces the camera — the
              chapel's congregation looked unlit while the preacher's back shone.
              A fill from the card's back side lights that view (and rims the
              front view a little). */}
          <directionalLight position={[-0.3, 0.9, -1.4]} intensity={1.5} />
          <PortalSky top={sky?.top} bottom={sky?.bottom} />
          <Suspense fallback={null}>
            <Backdrop id={vendor.id} />
            <StageStall key={vendor.id} vendor={vendor} focusedRef={focusedRef} frontRef={frontRef} cardYawRef={cardYawRef} open={open} />
          </Suspense>
        </MeshPortalMaterial>
      </RoundedBox>
      </group>
    </group>
  );
}

// ── DOM: the postcard row + the step-up control, overlaid on the phone canvas ──
const mono = { fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" };
const panel = { background: "rgba(14,10,12,0.78)", border: "1px solid rgba(255,140,90,0.45)", borderRadius: 6, color: "#ffd9c9", backdropFilter: "blur(4px)" };
export function BoardwalkStrip({ vendorId, onSelect, open, onToggleOpen, children }) {
  const name = BOARDWALK_NAMES[vendorId] || vendorId.toUpperCase();
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
      {/* At rest the card and the postcards are the whole scene — a tap on the
          card steps in. The title, STEP BACK and the vendor's panel only show
          once the player is inside the portal. */}
      {open && (
        <div style={{ position: "absolute", top: "calc(8px + env(safe-area-inset-top, 0px))", left: "calc(8px + env(safe-area-inset-left, 0px))", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <div style={{ ...panel, ...mono, padding: "7px 10px", fontSize: 10 }}>
            <div style={{ color: "#ff8c5a", fontSize: 9 }}>THE MIDWAY</div>
            <div>{name}</div>
          </div>
          <button type="button" onClick={onToggleOpen}
            style={{ ...panel, ...mono, padding: "9px 12px", fontSize: 10, cursor: "pointer", pointerEvents: "auto", color: "#ffd9c9" }}>
            ◂ STEP BACK
          </button>
        </div>
      )}
      <SitePalReadout />
      {/* the vendor's own panel (cart, booth…) — sits at the bottom once inside, the postcards are gone */}
      {open && children && <div style={{ position: "absolute", left: "calc(8px + env(safe-area-inset-left, 0px))", bottom: "calc(10px + env(safe-area-inset-bottom, 0px))", pointerEvents: "auto" }}>{children}</div>}
      {/* the deck under the postcards — Wood_FloorBoards turned 90° so the planks
          run away from the viewer (public/boardwalk/deck.webp), tiled along the row */}
      {!open && <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110, backgroundImage: "linear-gradient(to bottom, rgba(10,6,8,0.45), rgba(0,0,0,0) 18%), url(/boardwalk/deck.webp)", backgroundRepeat: "no-repeat, repeat-x", backgroundSize: "100% 100%, auto 260%", backgroundPosition: "0 0, 0 35%", filter: "brightness(1.35) saturate(1.1)", boxShadow: "inset 0 8px 12px -8px rgba(0,0,0,0.8)" }} />}
      {/* postcards — the boardwalk at rest; hidden while stepped into a stall */}
      {!open && <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", gap: 8, overflowX: "auto", padding: "0 8px", pointerEvents: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {BOARDWALK_ORDER.map((id) => {
          const on = id === vendorId;
          return (
            <button key={id} type="button" aria-label={BOARDWALK_NAMES[id] || id} aria-pressed={on} onClick={() => { warmBoardwalk("postcard:" + id); onSelect?.(id); }}
              style={{ flex: "0 0 auto", width: 64, height: 86, padding: 0, borderRadius: 6, overflow: "hidden", cursor: "pointer", background: "#1a1214",
                border: on ? "2px solid #ffd27a" : "1px solid rgba(255,140,90,0.45)", boxShadow: on ? "0 0 10px rgba(255,210,122,0.45)" : "none", position: "relative" }}>
              <img src={postcardUrl(id)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: on ? 1 : 0.8 }} />
              <span style={{ ...mono, position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 7, padding: "3px 2px", background: "rgba(0,0,0,0.55)", color: on ? "#ffd27a" : "#ffd9c9", textAlign: "center" }}>{BOARDWALK_NAMES[id]}</span>
            </button>
          );
        })}
      </div>}
    </div>
  );
}

// ── The salesman's cart (DOM) — goods paid from the tank ─────────────────────
// `tank` is the live un-banked balance from the drill doc, `owned` the current
// count; `onBuy(item)` posts to /api/oil-vendor-buy and resolves { ok, error }.
export function VendorCart({ vendorId, tank = 0, owned = {}, signedIn = false, onBuy, compact = false }) {
  const goods = goodsForVendor(vendorId);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState("");
  if (!goods.length) return null;
  const buy = async (g) => {
    if (busy) return;
    setBusy(g.id); setNote("");
    try {
      const r = await onBuy?.(g.id);
      if (r?.ok) setNote(`◆ BOUGHT · ${g.label} ×${r.count ?? ""}`.trim());
      else if (r?.error === "not_enough_oil") setNote("✗ NOT ENOUGH IN THE TANK");
      else if (r?.error === "unauthorized") setNote("✗ SIGN IN TO BUY");
      else setNote("✗ THE SALE FELL THROUGH");
    } finally { setBusy(null); }
  };
  // A compact goods card, not a bar: the bottle on the left, title / blurb /
  // price on the right, BUY underneath. Sized to its content (≤ 300px).
  return (
    <div style={{ ...panel, ...mono, padding: 10, fontSize: 10, display: "grid", gap: 8, width: 300, maxWidth: "calc(100vw - 24px)", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#ff8c5a", fontSize: 9 }}>
        <span>THE CART</span><span title="Oil in your tank, un-banked">TANK {Math.floor(tank).toLocaleString()} BTR</span>
      </div>
      {goods.map((g) => {
        const have = owned?.[g.supply] || 0; const canPay = tank >= g.price; const ok = canPay && signedIn;
        return (
          <div key={g.id} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, alignItems: "start" }}>
            <div style={{ width: 72, height: 72, borderRadius: 6, background: "radial-gradient(circle at 50% 40%, rgba(159,216,255,0.35), rgba(159,216,255,0.04) 70%)", display: "grid", placeItems: "center" }}>
              {g.image ? <img src={g.image} alt="" draggable={false} style={{ width: 64, height: 64, objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(159,216,255,0.6))" }} /> : <span style={{ fontSize: 28 }}>💧</span>}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ color: "#ffd27a", fontSize: 11 }}>{g.label}{have > 0 && <span style={{ marginLeft: 8, color: "#9fe0a8", fontSize: 9 }}>×{have} held</span>}</div>
              <div style={{ opacity: 0.8, fontSize: 9, lineHeight: 1.45, letterSpacing: "0.04em" }}>{g.blurb}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                <span style={{ color: "#dff2ff", fontSize: 11 }}>{g.price.toLocaleString()} {g.currency || "BTR"}<span style={{ opacity: 0.6, fontSize: 9 }}> · {g.unit}</span></span>
                <button type="button" disabled={!!busy || !ok} onClick={() => buy(g)}
                  style={{ ...mono, padding: "7px 10px", fontSize: 10, borderRadius: 4, cursor: busy || !ok ? "default" : "pointer",
                    background: ok ? "rgba(255,210,122,0.16)" : "transparent", color: ok ? "#ffd27a" : "rgba(255,217,201,0.45)", border: `1px solid ${ok ? "#ffd27a" : "rgba(255,217,201,0.25)"}` }}>
                  {busy === g.id ? "…" : !signedIn ? "SIGN IN" : "BUY"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {note && <div style={{ color: note.startsWith("◆") ? "#9fe0a8" : "#ff8c5a" }}>{note}</div>}
    </div>
  );
}
