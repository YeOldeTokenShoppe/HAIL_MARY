"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { HandsModel } from "./HandsGLTFScene";
import {
  setChamberFocus,
  clearChamberFocus,
} from "@/utils/chamberFocus";
import {
  getPhoneScroll,
  setPhoneScrollExternalDrive,
  requestPhoneScrollFlick,
} from "@/utils/phoneScrollSync";

// "The Vestry" — Our Lady's private chamber, parked at the bottom of the
// hero canvas's crane descent (the camera rides ~9 world units down as
// the page scrolls; this fills the basement it lands in). Salvaged from
// the original /illumin80 shrine: the hands_MOBILE.glb vignette (hands +
// phone + painted-Mary backdrop + halo, ~340KB all-in) with its live
// phone-screen feed.
//
// Rotation is CHOREOGRAPHED BY SCROLL, not auto-spun and not dragged:
// through the descent the visitor sees the back of a figure's hands
// holding a glowing phone — and over the final stretch of the page the
// model swings around to reveal who's scrolling: it's her. The scrollbar
// is the dolly; backing up literally rewinds the reveal.
//
// Mounting is scroll-gated: nothing loads until the visitor has scrolled
// CHAMBER_ARM_DEPTH of the page, so the hero's first paint pays zero for
// the chamber. Once armed it stays mounted — no churn on scroll-ups,
// and frustum culling skips the draws whenever the camera is upstairs.

// Staging replicates the ORIGINAL /illumin80 framing so the viewer
// lands *inside* the scene — phone at arm's length, painted Mary
// monumental behind it — rather than looking at a diorama from outside.
// Original recipe (UnifiedShrine): fov 45, camera [0,0,5], vignette
// group scale 1.8 at [0,-1,-6] → ~11 units camera→phone. Angular
// composition is invariant under uniform scaling, so we rebuild the
// same sandwich at s = 0.25 of original size:
//   scale    = 1.8 × s                        = 0.45
//   distance = 11 × s × 0.888 (fov 45→50 fix) ≈ 2.44 along the gaze ray
// The crane camera ends at (0,-9.3,2.2) gazing at (0,-8.8,0) — i.e.
// direction ≈ (0, 0.222, -0.975), tilted ~13° up. Position = camera +
// 2.44·gaze, dropped 1×s below the axis exactly like the original's
// group sat 1 unit below its camera. The X tilt squares her to the
// gaze so the framing matches the original's level camera.
const CHAMBER_POSITION = [0, -8.8, -0.24];
const CHAMBER_SCALE = 0.45;
const CHAMBER_TILT_X = 0.224;
// Page-scroll fraction that triggers the GLB + feed load. 0.45 leaves
// plenty of runway for the 340KB model to arrive before the camera does.
const CHAMBER_ARM_DEPTH = 0.45;

// The reveal: yaw eases from START (back of the hands toward the
// viewer; her backdrop near edge-on) to 0 (the full frontal sandwich we
// staged above), completing exactly at the page bottom.
//
// Anchored in SCREEN-HEIGHTS FROM THE BOTTOM, not page fractions: the
// chamber is only on stage for the final screen of scroll (the vestry
// viewport), so a page-fraction mapping plays most of the turn while
// she's still off-camera — the visitor arrives to a reveal that already
// happened. Spanning the last 1.25 viewport-heights keeps the entire
// turn inside the time she's actually visible, and adding page sections
// later won't dilute the choreography.
//
// The choreography is KEYFRAMED, not a single eased sweep, and it is
// timed against the PARKED camera: StarfieldStatueScene receives
// cameraParkScreens={2}, so the crane completes its descent two
// viewport-heights before the page bottom and holds a static shot for
// the entire performance (the tall .vestry-viewport supplies that
// scroll runway). Beats:
//   beat 1  swing in during the final approach, arriving frontal right
//           around the moment the camera parks
//   beat 2  HOLD — over a full screen of parked scrolling with the
//           phone facing the visitor; the feed gets read, and the
//           click-to-zoom is armed
//   beat 3  the slow ceremonial sweep to her — phone exits, Mary takes
//           the final frame
// Each [t, yaw] pair is smoothstepped to its neighbor; t is the 0→1
// progress across the final REVEAL_SPAN_SCREENS of scroll. The camera
// parks at t ≈ 1 − 2/2.4 ≈ 0.17 — just before the frontal keyframe.
// Beat budget (of the 3.4-screen span, camera parked for the last 3):
// hold ≈ 1.6 screens of parked scrolling, sweep ≈ 1.1 screens so the
// turn to her glides rather than snaps, then a FLAT TAIL — the reveal
// lands at t=0.94 and holds, so the final pose is reached even if the
// scroll stops a few pixels shy of absolute bottom (mobile URL bars,
// fast flicks mid-chase). Keep the hold's end key around ~0.6: pushing
// it later steals the sweep's runway back and re-creates the snap.
const REVEAL_SPAN_SCREENS = 3.4;
const REVEAL_KEYFRAMES = [
  [0.0, Math.PI * 0.12],   // drift in nearly frontal — just hands + phone
  [0.15, 0],               // camera parks; screen faces the visitor
  [0.62, -Math.PI * 0.04], // HOLD — ~1.6 screens of reading time
  [0.94, -Math.PI * 0.8],  // the slow sweep — she takes the frame
  [1.0, -Math.PI * 0.8],   // flat tail — reveal complete before the bottom
];

// HER APPARITION — the opening shows no sign of who holds the phone:
// the backdrop (her face) and halo sit at opacity 0 through the arrival
// and the whole phone-hold, leaving only anonymous hands and a glowing
// screen in the dark. As the sweep begins she fades into existence
// WHILE the model turns toward her — a materialization, not a camera
// trick. Fractions of the same t the yaw keyframes use: the fade starts
// with the sweep and completes well before the final pose.
const FIGURE_FADE_START = 0.6;
const FIGURE_FADE_END = 0.82;

function yawAt(t, kf = REVEAL_KEYFRAMES) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i][0]) {
      const [t0, y0] = kf[i - 1];
      const [t1, y1] = kf[i];
      const u = (t - t0) / (t1 - t0);
      const eased = u * u * (3 - 2 * u);
      return y0 + (y1 - y0) * eased;
    }
  }
  return kf[kf.length - 1][1];
}
// Chase rate for the smoothed yaw — high enough to feel attached to the
// scrollbar, low enough to glide over scroll-wheel steps.
const REVEAL_CHASE = 6;

// Phone focus framing (ported from /illumin80's click-to-zoom): a
// straight-on dolly toward the screen, available during the HOLD beat
// when the phone faces the visitor. Tap again to pull back; the zoom
// also releases itself if the visitor scrolls on and the model sweeps
// away, or scrolls back out of the chamber entirely.
const FOCUS_CAMERA_POS = [0, -9.02, 0.85];
const FOCUS_CAMERA_TARGET = [0, -8.95, -0.24];
// The zoom arms while yaw is within this many radians of FRONTAL (the
// hold beat) — dollying toward a screen that isn't facing you is never
// the right shot.
const FOCUS_YAW_TOLERANCE = 0.35;

// MOBILE STAGING — the vignette used to render ~31% smaller on phones
// than every CHAMBER_* number above assumes: HandsModel carries its own
// isMobileLocal staging from its /illumin80 days (primitive scale 0.45
// vs 0.65, offset −0.4 vs −0.3). The chamber now PINS the desktop
// recipe via stagingScale/stagingOffsetY below, so the sandwich math is
// the single authority on every viewport and mobile naturally renders
// at full desktop size — that pin IS the mobile scale-up.
// CHAMBER_MOBILE_SCALE_FACTOR remains the knob for boosting mobile
// BEYOND desktop size (1 = desktop parity; the phone already spans
// ~94% of a 390px viewport's width, so there's little headroom). The
// boost is ANCHORED AT THE PHONE SCREEN (the tuned focus target), not
// the group origin: the screen stays exactly where the desktop framing
// put it while the hands and Mary grow around it.
// 768px matches the page's isMobileDevice breakpoint.
const CHAMBER_MOBILE_SCALE_FACTOR = 1.0;
const MOBILE_VIEWPORT_QUERY = "(max-width: 768px)";
// HandsModel's desktop staging values, pinned across viewports — the
// originals the whole CHAMBER_* recipe was tuned against.
const CHAMBER_MODEL_SCALE = 0.65;
const CHAMBER_MODEL_OFFSET_Y = -0.3;
// A touch of world-space lift so the phone clears the page's bottom
// toolbar during the hold beat. Applied to the focus dolly too so the
// click-to-zoom stays centered on the lifted screen.
const CHAMBER_MOBILE_LIFT_Y = 0.05;
const CHAMBER_SCALE_MOBILE = CHAMBER_SCALE * CHAMBER_MOBILE_SCALE_FACTOR;
// Anchored scaling: new origin = anchor − f·(anchor − origin).
const CHAMBER_POSITION_MOBILE = CHAMBER_POSITION.map(
  (p, i) =>
    FOCUS_CAMERA_TARGET[i] -
    CHAMBER_MOBILE_SCALE_FACTOR * (FOCUS_CAMERA_TARGET[i] - p) +
    (i === 1 ? CHAMBER_MOBILE_LIFT_Y : 0),
);
// The zoom dolly pulls back from the target by the scale factor (so a
// boosted model fills the focus frame exactly like desktop) times an
// extra mobile allowance: the fov is VERTICAL, so the desktop-tuned
// dolly distance overflows a portrait frame horizontally — the feed's
// left and right edges crop. 1.7 brings the full screen width inside
// a 390px viewport (the screen then nearly fills it top to bottom:
// phone aspect ≈ portrait-viewport aspect).
const FOCUS_MOBILE_PULLBACK = 1.7;
const FOCUS_CAMERA_TARGET_MOBILE = FOCUS_CAMERA_TARGET.map(
  (p, i) => p + (i === 1 ? CHAMBER_MOBILE_LIFT_Y : 0),
);
const FOCUS_CAMERA_POS_MOBILE = FOCUS_CAMERA_POS.map(
  (p, i) =>
    FOCUS_CAMERA_TARGET[i] +
    CHAMBER_MOBILE_SCALE_FACTOR *
      FOCUS_MOBILE_PULLBACK *
      (p - FOCUS_CAMERA_TARGET[i]) +
    (i === 1 ? CHAMBER_MOBILE_LIFT_Y : 0),
);
// The final pose is a two-element horizontal composition — Mary on the
// left, the raised hand on the right — which a portrait viewport can't
// hold: at the final yaw her face crops off the left edge (it did even
// before the mobile scale-up). Spinning further is no fix: the phone
// sits ON the spin axis, so it rotates in place at frame center and at
// −π its back squarely occludes her. Mary is the off-axis element that
// orbits — so on mobile the whole chamber SLIDES right across the
// sweep beat, recentering her landing spot in the narrow frame while
// the hand and phone exit right: phone exits, Mary takes the frame.
// World units; the slide eases over the same keyframe window as the
// sweep itself and rides the same chase as the yaw.
const REVEAL_FINAL_YAW_MOBILE = -Math.PI * 0.8;
// Same beats, same timing — only the sweep's destination (the last two
// keyframes: arrival + flat tail) can differ on mobile.
const REVEAL_KEYFRAMES_MOBILE = REVEAL_KEYFRAMES.map(([t, y], i, kf) =>
  i >= kf.length - 2 ? [t, REVEAL_FINAL_YAW_MOBILE] : [t, y],
);
const MOBILE_REVEAL_SHIFT_X = 0.5;
// The sweep window — keyframes [2]→[3] (hold's end → reveal's arrival).
const SWEEP_START_T = REVEAL_KEYFRAMES[2][0];
const SWEEP_END_T = REVEAL_KEYFRAMES[3][0];
// The GLB holds the phone right of the model's origin, so at x=0 the
// whole vignette reads off-center through the approach and hold (on
// every viewport). The hold shift centers the phone — and squares it
// to the focus dolly, which sits on x=0 — then eases out across the
// same sweep window, back to 0 on desktop (the authored reveal frame)
// or onward to MOBILE_REVEAL_SHIFT_X on mobile.
// The shift is SELF-CALIBRATING, and against the VISIBLE WINDOW, not
// the canvas: the hero canvas is oversized and shifted (the CRT
// scaleX(1.2) wrapper in StarfieldStatueScene makes R3F measure a
// transformed rect, leaving the canvas center ~12% right of the
// window center), so "centered at world x=0" reads off-center on the
// page. The frame loop projects the screen mesh and steers this shift
// until the phone sits on the window's center line, reading the live
// canvas rect — if the canvas layout bug is ever fixed at the source,
// the correction self-reduces to zero. This constant is only the
// fallback until the mesh has been measured.
const CHAMBER_HOLD_SHIFT_X = -0.15;

// ZOOM AFFORDANCE — a small pill floating just above the phone,
// telling the visitor the screen is tappable. It fades in once the
// camera is parked and the phone is frontal (the same window in which
// the zoom is armed), fades out when the sweep begins, and is
// dismissed for good after the first zoom — the visitor has learned
// the trick. Position is chamber-local: y floats it just clear of the
// phone's top bezel; x is only a pre-measurement fallback — the frame
// loop re-anchors it to the screen mesh's measured center so the pill
// stays centered over the phone on every viewport.
const HINT_POSITION = [0.15, 0.84, 0.15];
// Reveal progress at which the hint may appear — just after the
// frontal-arrival keyframe, so it never shows during the swing-in.
const HINT_SHOW_T = 0.18;

// The phone's aura glow — the blue light in the chamber. These are the
// chamber's own values (passed as props to HandsModel); /illumin80
// keeps its original cyan via the prop defaults. For crypt-warm staging
// try color "#ffc478" with opacity ~0.3; size is in model-local units.
const PHONE_AURA_COLOR = "#ffc478";
const PHONE_AURA_INTENSITY = 0.1;
const PHONE_AURA_SIZE = 3;
const PHONE_AURA_OPACITY = 0.1;

// SCREEN GLOW: the current hands_MOBILE.glb export carries NO embedded
// light (KHR_lights_punctual isn't in its extensions — an older export
// had one, which is what the "blue light" lore refers to). The glow is
// therefore OUR SpotLight, created in the corrective traverse below
// and parented to the PhoneScreen mesh so it rides the reveal spin,
// then removed on unmount because useGLTF caches the scene graph and
// /illumin80's mount must not inherit it. A SPOT, not a point: aimed
// straight out of the glass with a wide feathered cone, so the wash
// lands on fingers and face while the phone's backside gets nothing
// (nothing here casts shadows, so a point light leaked a halo onto the
// back of the case).
// Cyan = the site's signature tint (wax preset / Lyquid80). INTENSITY
// is physical candela and the light sits ~a finger-width from her
// skin, so small numbers carry: 0.5 is a subtle wash, 2 is moody-club,
// 0 switches it off. DISTANCE (world units) caps how far the cast
// reaches. LIFT (world units) floats it off the glass along the
// rendered face's normal — positive is out the side the feed shows,
// negative flips everything to the far side if the export's normals
// ever turn out inverted. SPREAD is the cone half-angle in radians
// (max ~1.57).
const SCREEN_GLOW_COLOR = "#14f7ff";
const SCREEN_GLOW_INTENSITY = 0.5;
const SCREEN_GLOW_DISTANCE = 3.5;
const SCREEN_GLOW_LIFT = 0.0;
const SCREEN_GLOW_SPREAD = 1.3;

// Local-space normal of the screen's rendered face. The feed material
// is FrontSide and visibly renders, so the geometry normal is ground
// truth for which way "out of the glass" points — the export's local
// axes don't map to it predictably (two axis guesses both missed).
function screenFaceNormal(mesh) {
  const n = new THREE.Vector3(0, 0, 1);
  const attr = mesh?.geometry?.attributes?.normal;
  if (attr) {
    n.fromBufferAttribute(attr, 0);
    // Draco-quantized exports can hold degenerate normals; fall back
    // to +Z rather than normalizing a near-zero vector into NaN.
    if (n.lengthSq() > 0.25) n.normalize();
    else n.set(0, 0, 1);
  }
  return n;
}

// HER SCROLLING THUMB — the node named 'hand' (mesh Mesh_47) bobs on
// its local Y in flick gestures, synchronized with the feed's REAL
// auto-scroll state (published by WatchlistPhoneTexture): while the
// content glides she flicks; when the feed runs back to the top she
// does one slow pull-down; while it pauses, her hand rests. Amplitude
// is in the GLB's raw local units (node translations there are O(100),
// so ~12 reads as a natural thumb stroke).
const HAND_FLICK_AMPLITUDE = 180;
// Discrete gestures, not continuous bobbing: while the feed scrolls, a
// single flick (DURATION of pull-and-glide) fires once per INTERVAL,
// with the hand at rest in between.
const HAND_FLICK_INTERVAL_S = 2.5;
const HAND_FLICK_DURATION_S = 0.9;
// Feed-pixels of content each flick pushes (the screen canvas is
// 1280px tall with ~995px of visible feed, so ~380 ≈ a third-screen
// swipe). The feed's smooth-lerp turns the jump into a momentum coast.
const HAND_FLICK_SCROLL_PX = 380;
// Flick shape: quick pull (first quarter), slow glide back while the
// content coasts — the rhythm of a real thumb.
function flickCurve(p) {
  if (p < 0.25) {
    const u = p / 0.25;
    return u * u * (3 - 2 * u);
  }
  const u = (p - 0.25) / 0.75;
  return 1 - u * u * (3 - 2 * u);
}

const NOOP = () => {};

// Scratch for the per-frame screen-offset measurement.
const _screenWorld = new THREE.Vector3();
const _viewPos = new THREE.Vector3();

// HALO FX — the GLB's halo ('Circle') is a flat painted disc; this
// dresses it with a procedural corona: a bright rim hugging the disc's
// edge, a soft additive bloom falling off beyond it, and slow-turning
// rays, all breathing gently. Pure shader, NO textures — CanvasTexture
// with additive blending is an iOS Safari landmine — and no
// postprocessing: a real bloom pass would tax the whole canvas on
// mobile GPUs for one mesh's worth of glow. The FX plane is a child of
// the Circle mesh (rides the reveal spin), its uOpacity is driven by
// the same apparition fade as the painted planes, and it's removed on
// unmount because useGLTF shares the scene graph with /illumin80.
// Plane half-size in disc radii. Sized so the radial window in the
// fragment shader (fades 0.72→1.0 of the plane) lands the visible
// corona around ~2.3 disc radii with a soft tail, instead of clipping
// at the geometry. Keep `edge` in HALO_FX_FRAG at 1/HALO_FX_REACH.
const HALO_FX_REACH = 2.7;
const HALO_FX_VERT = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HALO_FX_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vP;
  void main() {
    float r = length(vP);
    float ang = atan(vP.y, vP.x);
    // The painted disc's edge sits at 1.0 / HALO_FX_REACH of the plane.
    float edge = 0.370;
    // Bright rim hugging the disc edge.
    float rim = exp(-pow((r - edge) * 14.0, 2.0));
    // Soft corona blooming outward from the rim.
    float corona = exp(-max(r - edge, 0.0) * 4.0) * smoothstep(0.0, edge, r);
    // Slow-turning soft rays (11 lobes), none inside the disc.
    float rays = pow(abs(sin(ang * 5.5 + uTime * 0.12)), 8.0)
               * exp(-max(r - edge, 0.0) * 3.0)
               * smoothstep(edge * 0.85, edge * 1.15, r);
    // Gentle breath.
    float breathe = 0.9 + 0.1 * sin(uTime * 0.7);
    // Radial window — the plane is finite, and the corona is still
    // ~10% bright where the geometry ends, which prints a hard square
    // edge over the dark chamber. Take every term to zero well before
    // the boundary.
    float window = smoothstep(1.0, 0.72, r);
    vec3 warm  = vec3(1.0, 0.84, 0.52);
    vec3 white = vec3(1.0, 0.97, 0.88);
    vec3 col = white * rim * 0.85 + warm * corona * 0.5 + warm * rays * 0.45;
    gl_FragColor = vec4(col * breathe * uOpacity * window, 1.0);
  }
`;

function pageScrollProgress() {
  if (typeof window === "undefined") return 0;
  const max = Math.max(
    document.documentElement.scrollHeight - window.innerHeight,
    1,
  );
  return Math.min(Math.max(window.scrollY / max, 0), 1);
}

// Lazy initializer is correct-by-construction here: the chamber only
// mounts after a client-side scroll arms it, so there's no SSR pass to
// mismatch — and it spares the model a one-frame pop from desktop to
// mobile scale on first paint.
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function ChamberInner() {
  const isMobile = useIsMobileViewport();
  const spinRef = useRef();
  // Outer position group — the frame loop drives its X for the
  // hold-beat centering shift and the mobile reveal slide.
  const slideRef = useRef();
  const shiftRef = useRef(CHAMBER_HOLD_SHIFT_X);
  // Visible-window centering state: the screen mesh's local-space
  // center (bounding-box, computed once), its latest measured world x,
  // the steered hold-shift target, the hint pill's anchor group, and
  // the latest R3F state for the click handler's dolly math.
  const screenCenterRef = useRef(null);
  const screenWorldXRef = useRef(null);
  const holdXRef = useRef(CHAMBER_HOLD_SHIFT_X);
  const hintAnchorRef = useRef();
  const stateRef = useRef(null);
  // The halo's procedural corona plane (see HALO_FX_FRAG).
  const haloFXRef = useRef(null);

  // NDC x (in canvas space) of the visible window's center line — the
  // canvas is wider than the window and left-shifted (see
  // CHAMBER_HOLD_SHIFT_X), so this is nonzero until that layout quirk
  // is fixed at the source.
  const { gl } = useThree();
  const desiredNdcXRef = useRef(0);
  useEffect(() => {
    const update = () => {
      const rect = gl.domElement.getBoundingClientRect();
      desiredNdcXRef.current = rect.width
        ? ((window.innerWidth / 2 - rect.left) / rect.width) * 2 - 1
        : 0;
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [gl]);
  const yawTargetRef = useRef(yawAt(0));
  const tProgressRef = useRef(0);
  // Backdrop + halo materials, re-collected by the corrective traverse
  // below; the frame loop drives their opacity for the apparition fade.
  const figureMatsRef = useRef([]);
  // The GLB's embedded screen-glow point light (see SCREEN_GLOW_*).
  const screenGlowLightRef = useRef(null);
  // The scrolling hand (node 'hand' / mesh Mesh_47) + gesture state.
  const handRef = useRef(null);
  const flickPhaseRef = useRef(0);
  const handOffsetRef = useRef(0);
  const focusedRef = useRef(false);
  // Zoom-affordance pill: shown during the armed hold window, gone
  // for good once the visitor has zoomed.
  const [hintOn, setHintOn] = useState(false);
  const hintOnRef = useRef(false);
  const hasZoomedOnceRef = useRef(false);
  const setHint = useCallback((v) => {
    if (hintOnRef.current !== v) {
      hintOnRef.current = v;
      setHintOn(v);
    }
  }, []);

  // Tap the phone → dolly in; tap again → pull back. HandsModel wires
  // this to both the screen mesh and its clickable overlay box.
  // useCallback is LOAD-BEARING, not style: HandsModel's setup effect
  // depends on onPhoneClick, and every re-run of that effect re-clones
  // the backdrop/halo materials with the /illumin80 always-on-top
  // compositing — undoing the depth fix below. A stable identity keeps
  // that effect from ever re-firing.
  const handlePhoneClick = useCallback(() => {
    if (!spinRef.current) return;
    const yawFromFront = Math.abs(spinRef.current.rotation.y);
    if (!focusedRef.current && yawFromFront > FOCUS_YAW_TOLERANCE) return;
    if (focusedRef.current) {
      clearChamberFocus();
      focusedRef.current = false;
    } else {
      // Media query read directly (not the isMobile state) so this
      // callback keeps its load-bearing stable identity.
      const mobile = window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
      const pos = [...(mobile ? FOCUS_CAMERA_POS_MOBILE : FOCUS_CAMERA_POS)];
      const target = [
        ...(mobile ? FOCUS_CAMERA_TARGET_MOBILE : FOCUS_CAMERA_TARGET),
      ];
      // Same visible-window correction as the hold shift. Camera and
      // target share an x (the dolly stays parallel — lookAt at the
      // phone itself would recenter it in the CANVAS), chosen so the
      // phone's actual x (the hold shift moved it) projects onto the
      // window's center line, not the wider, left-shifted canvas's.
      const s = stateRef.current;
      if (s && screenWorldXRef.current != null) {
        const d = Math.hypot(
          pos[0] - target[0],
          pos[1] - target[1],
          pos[2] - target[2],
        );
        const halfW =
          Math.tan((s.camera.fov * Math.PI) / 360) * s.camera.aspect * d;
        const x =
          screenWorldXRef.current - desiredNdcXRef.current * halfW;
        pos[0] = x;
        target[0] = x;
      }
      setChamberFocus(pos, target);
      focusedRef.current = true;
      // The trick is learned — retire the affordance.
      hasZoomedOnceRef.current = true;
      setHint(false);
    }
  }, [setHint]);

  // Unmount cleanup: release a held camera focus, and restore the GLB's
  // embedded screen-glow light to its authored values — useGLTF caches
  // the scene graph, so without this our re-tint would ride along into
  // /illumin80's mount of the same model.
  // While the chamber is mounted, HER flicks drive the feed (the
  // continuous auto-glide is suspended). Switched off on unmount so
  // /illumin80's mount of the same feed keeps its original behavior.
  useEffect(() => {
    setPhoneScrollExternalDrive(true);
    return () => setPhoneScrollExternalDrive(false);
  }, []);

  useEffect(() => () => {
    clearChamberFocus();
    const light = screenGlowLightRef.current;
    if (light?.userData?.chamberScreenGlow) {
      // Our injected glow — pull it (and its spot aim target) OUT of
      // the cached scene graph (useGLTF shares it with /illumin80) and
      // clear the ref so a remount injects a fresh one.
      light.target?.removeFromParent?.();
      light.removeFromParent();
      screenGlowLightRef.current = null;
    } else if (light?.userData?.authoredGlowColor) {
      light.color.copy(light.userData.authoredGlowColor);
      light.intensity = light.userData.authoredGlowIntensity;
    }
    // Same cache-leak guard for the hand: park it back at its authored
    // rest position so /illumin80's mount doesn't inherit a mid-flick.
    const hand = handRef.current;
    if (hand?.userData?.baseHandY != null) {
      hand.position.y = hand.userData.baseHandY;
    }
    // And for the halo corona — pull it out of the cached scene graph
    // and free its GPU resources.
    const haloFX = haloFXRef.current;
    if (haloFX) {
      haloFX.removeFromParent();
      haloFX.geometry.dispose();
      haloFX.material.dispose();
      haloFXRef.current = null;
    }
  }, []);

  // Face the camera's up-tilted gaze once; the reveal then turns the
  // tilted local Y (XYZ euler order), i.e. her own up-axis.
  useEffect(() => {
    if (spinRef.current) {
      spinRef.current.rotation.x = CHAMBER_TILT_X;
      spinRef.current.rotation.y = yawAt(0);
    }
  }, []);

  // The original /illumin80 compositing forces Mary's backdrop + halo to
  // render on top of EVERYTHING (renderOrder 999/998, depthTest off) so
  // she'd overlay its candle cloud. Mid-reveal that hack inverts
  // reality — the hands emerge from BEHIND her face. Restore honest
  // depth: both planes stay transparent but depth-test against the
  // hands/phone, halo drawn before face.
  //
  // Deliberately NO dependency array: HandsModel re-applies its
  // compositing whenever its own setup effect re-runs, so this
  // corrective pass re-asserts after EVERY render (child effects fire
  // first, so it always lands on top). It's a cheap traverse of a few
  // dozen nodes, and the depth flags are idempotent. /illumin80 keeps
  // its compositing untouched — only this instance's clones are edited.
  useEffect(() => {
    const root = spinRef.current;
    if (!root) return;
    const mats = [];
    root.traverse((child) => {
      // Screen-glow light: re-apply the chamber constants on every
      // corrective pass so tuning them takes effect live. (Covers our
      // own injected light below — and, if a future GLB export ever
      // ships an embedded light again, that one too: stash its authored
      // values once so unmount can restore the shared cached scene.)
      if (child.isPointLight || child.isSpotLight) {
        if (child.userData.authoredGlowColor == null) {
          child.userData.authoredGlowColor = child.color.clone();
          child.userData.authoredGlowIntensity = child.intensity;
        }
        child.color.set(SCREEN_GLOW_COLOR);
        child.intensity = SCREEN_GLOW_INTENSITY;
        // Our injected spot also re-applies reach, spread, and lift
        // here, so every SCREEN_GLOW_* knob tunes live without a
        // remount.
        if (child.userData.chamberScreenGlow && child.parent) {
          child.distance = SCREEN_GLOW_DISTANCE;
          child.angle = SCREEN_GLOW_SPREAD;
          const ws = child.parent.getWorldScale(new THREE.Vector3());
          const n = screenFaceNormal(child.parent);
          const lz = SCREEN_GLOW_LIFT / (ws.z || 1);
          const dir = SCREEN_GLOW_LIFT < 0 ? -1 : 1;
          child.position.copy(n).multiplyScalar(lz);
          child.target.position
            .copy(n)
            .multiplyScalar(lz + dir / (ws.z || 1));
        }
        screenGlowLightRef.current = child;
        return;
      }
      // The current GLB has no embedded light, so cast the screen glow
      // ourselves: a wide soft spotlight parented to the PhoneScreen
      // mesh (it rides the reveal spin that way), floated off the glass
      // by LIFT world-units and aimed straight out of the screen — both
      // converted to the screen's local units via its world scale. The
      // aim target is parented to the screen too, so the beam tracks
      // every rotation.
      if (child.name === "PhoneScreen" && screenGlowLightRef.current == null) {
        const glow = new THREE.SpotLight(
          SCREEN_GLOW_COLOR,
          SCREEN_GLOW_INTENSITY,
          SCREEN_GLOW_DISTANCE,
          SCREEN_GLOW_SPREAD,
          1, // penumbra — fully feathered cone edge
          2, // physical inverse-square decay
        );
        const ws = child.getWorldScale(new THREE.Vector3());
        const n = screenFaceNormal(child);
        const lz = SCREEN_GLOW_LIFT / (ws.z || 1);
        const dir = SCREEN_GLOW_LIFT < 0 ? -1 : 1;
        glow.position.copy(n).multiplyScalar(lz);
        glow.target.position.copy(n).multiplyScalar(lz + dir / (ws.z || 1));
        glow.userData.chamberScreenGlow = true;
        child.add(glow);
        child.add(glow.target);
        screenGlowLightRef.current = glow;
        return;
      }
      // The scrolling hand — stash its authored rest Y once; the frame
      // loop animates around it. glTF note: Mesh_47 carries TWO material
      // primitives (hands + nails), which GLTFLoader splits into sibling
      // Meshes (Mesh_47, Mesh_47_1) under a Group named 'hand'. Animate
      // the GROUP so skin and nails move together — and first-match-wins,
      // because the pre-order traverse visits the Group before its
      // children and a later child match would otherwise overwrite the
      // ref and leave the nails parked.
      if (child.name === "hand" || /^mesh_?47/i.test(child.name)) {
        if (handRef.current == null) {
          if (child.userData.baseHandY == null) {
            child.userData.baseHandY = child.position.y;
          }
          handRef.current = child;
        } else if (
          child !== handRef.current &&
          child.userData.baseHandY != null
        ) {
          // A previous build animated this family member directly (the
          // useGLTF cache survives HMR); park it back at rest so it
          // doesn't sit frozen mid-flick under the Group's animation.
          child.position.y = child.userData.baseHandY;
        }
      }
      if (!child.isMesh || !child.material) return;
      const name = child.name.toLowerCase();
      if (name.includes("backdrop") || name.includes("circle")) {
        child.material.depthTest = true;
        child.material.needsUpdate = true;
        child.renderOrder = name.includes("backdrop") ? 1 : 0;
        mats.push(child.material);
        // Dress the halo disc with its corona plane (once — the
        // traverse re-runs every render). Drawn at the halo's own
        // renderOrder so the face (renderOrder 1) still paints over
        // the center, exactly like the disc itself.
        if (name.includes("circle") && !name.includes("halofx")) {
          let fx = child.children.find((c) => c.userData.chamberHaloFX);
          if (!fx) {
            child.geometry.computeBoundingSphere();
            const sphere = child.geometry.boundingSphere;
            const discR = sphere?.radius || 1;
            const half = discR * HALO_FX_REACH;
            fx = new THREE.Mesh(
              new THREE.PlaneGeometry(half * 2, half * 2),
              new THREE.ShaderMaterial({
                uniforms: {
                  uTime: { value: 0 },
                  uOpacity: { value: 0 },
                },
                vertexShader: HALO_FX_VERT,
                fragmentShader: HALO_FX_FRAG,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
              }),
            );
            fx.name = "ChamberHaloFX";
            fx.userData.chamberHaloFX = true;
            if (sphere) {
              fx.position.set(
                sphere.center.x,
                sphere.center.y,
                sphere.center.z + discR * 0.01,
              );
            }
            child.add(fx);
          }
          fx.renderOrder = child.renderOrder;
          haloFXRef.current = fx;
        }
      }
    });
    figureMatsRef.current = mats;
  });

  // Scroll → yaw target. Computed in a scroll listener (not per frame)
  // so the rAF loop never touches scrollHeight, which can force reflow.
  // Re-subscribed on a viewport-class flip so the closure picks up the
  // matching keyframe set.
  useEffect(() => {
    const keyframes = isMobile ? REVEAL_KEYFRAMES_MOBILE : REVEAL_KEYFRAMES;
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const remaining = maxScroll - window.scrollY;
      const span = window.innerHeight * REVEAL_SPAN_SCREENS;
      // 0 while more than `span` of scroll remains; 1 at the very bottom.
      const t = Math.min(Math.max(1 - remaining / span, 0), 1);
      tProgressRef.current = t;
      yawTargetRef.current = yawAt(t, keyframes);
      // Release the phone close-up when the visitor scrolls onward (the
      // model sweeps out of the hold beat) or back out of the chamber —
      // never leave the camera dollied into a screen that's turning away.
      if (
        focusedRef.current &&
        (t < 0.02 || Math.abs(yawTargetRef.current) > FOCUS_YAW_TOLERANCE)
      ) {
        clearChamberFocus();
        focusedRef.current = false;
      }
      // The zoom affordance lives in the armed hold window only.
      setHint(
        !hasZoomedOnceRef.current &&
          !focusedRef.current &&
          t > HINT_SHOW_T &&
          t < SWEEP_START_T &&
          Math.abs(yawTargetRef.current) <= FOCUS_YAW_TOLERANCE,
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  // Exponential chase toward the scroll-mapped yaw — glides over the
  // discrete steps of wheel/trackpad scrolling — plus the apparition
  // fade on the backdrop/halo materials.
  useFrame((state, delta) => {
    if (!spinRef.current) return;
    stateRef.current = state;
    const k = 1 - Math.exp(-delta * REVEAL_CHASE);
    spinRef.current.rotation.y +=
      (yawTargetRef.current - spinRef.current.rotation.y) * k;

    // Visible-window centering: glue the hint anchor to the screen
    // mesh, and steer the hold shift until the screen's world x
    // projects onto the WINDOW's center line (see CHAMBER_HOLD_SHIFT_X
    // — canvas center ≠ window center here). Frozen while the focus
    // dolly drives the camera. matrixWorld is a frame stale, but the
    // hold pose is static so the steering converges exactly.
    const screenMesh = screenGlowLightRef.current?.parent;
    if (screenMesh && slideRef.current) {
      if (!screenCenterRef.current) {
        screenMesh.geometry.computeBoundingBox();
        screenCenterRef.current = screenMesh.geometry.boundingBox.getCenter(
          new THREE.Vector3(),
        );
      }
      _screenWorld.copy(screenCenterRef.current);
      screenMesh.localToWorld(_screenWorld);
      screenWorldXRef.current = _screenWorld.x;
      if (hintAnchorRef.current) {
        hintAnchorRef.current.position.x =
          _screenWorld.x - slideRef.current.position.x;
      }
      if (!focusedRef.current) {
        // The crane camera only ever pitches (rotation x), so world x
        // maps to NDC by similar triangles at the screen's view depth.
        const cam = state.camera;
        _viewPos.copy(_screenWorld).applyMatrix4(cam.matrixWorldInverse);
        const dView = -_viewPos.z;
        if (dView > 0.001) {
          const halfW =
            Math.tan((cam.fov * Math.PI) / 360) * cam.aspect * dView;
          holdXRef.current =
            shiftRef.current +
            (cam.position.x +
              desiredNdcXRef.current * halfW -
              _screenWorld.x);
        }
      }
    }

    // The X slide — phone-centering shift through approach + hold,
    // easing across the sweep to the reveal frame (back to the
    // authored x on desktop, onward to recenter Mary in the narrow
    // frame on mobile — see CHAMBER_HOLD_SHIFT_X /
    // MOBILE_REVEAL_SHIFT_X). Rides the same chase as the yaw so
    // wheel steps glide.
    if (slideRef.current) {
      let u =
        (tProgressRef.current - SWEEP_START_T) / (SWEEP_END_T - SWEEP_START_T);
      u = Math.min(Math.max(u, 0), 1);
      u = u * u * (3 - 2 * u);
      const holdX = holdXRef.current;
      const revealX = isMobile ? MOBILE_REVEAL_SHIFT_X : 0;
      const shiftTarget = holdX + (revealX - holdX) * u;
      shiftRef.current += (shiftTarget - shiftRef.current) * k;
      slideRef.current.position.x =
        (isMobile ? CHAMBER_POSITION_MOBILE[0] : CHAMBER_POSITION[0]) +
        shiftRef.current;
    }

    let fade =
      (tProgressRef.current - FIGURE_FADE_START) /
      (FIGURE_FADE_END - FIGURE_FADE_START);
    fade = Math.min(Math.max(fade, 0), 1);
    fade = fade * fade * (3 - 2 * fade);
    for (const m of figureMatsRef.current) {
      if (m.opacity !== fade) m.opacity = fade;
    }
    // The halo corona materializes with her, and lives on the clock.
    // Hidden outright until the fade starts — an opacity-0 additive
    // plane still rasterizes all its fragments, which is free fill
    // rate reclaimed for the whole phone-hold beat on mobile.
    const haloFX = haloFXRef.current;
    if (haloFX) {
      haloFX.visible = fade > 0.001;
      if (haloFX.visible) {
        haloFX.material.uniforms.uTime.value = state.clock.elapsedTime;
        haloFX.material.uniforms.uOpacity.value = fade;
      }
    }

    // Her scrolling thumb — gestures keyed to the feed's actual phase.
    const hand = handRef.current;
    if (hand) {
      const { phase } = getPhoneScroll();
      let target = 0;
      if (phase === "scrolling") {
        // flickPhaseRef accumulates seconds across the scrolling phase;
        // each interval opens with a gesture (the first DURATION), then
        // the hand rests. At each gesture's start, push a scroll
        // impulse to the feed — her flick is what moves the content.
        const prevT = flickPhaseRef.current;
        flickPhaseRef.current = prevT + delta;
        const prevIdx = Math.floor(prevT / HAND_FLICK_INTERVAL_S);
        const idx = Math.floor(flickPhaseRef.current / HAND_FLICK_INTERVAL_S);
        if (prevT === 0 || idx !== prevIdx) {
          requestPhoneScrollFlick(HAND_FLICK_SCROLL_PX);
        }
        const g =
          (flickPhaseRef.current % HAND_FLICK_INTERVAL_S) /
          HAND_FLICK_DURATION_S;
        target = g < 1 ? HAND_FLICK_AMPLITUDE * flickCurve(g) : 0;
      } else if (phase === "scrolling_up") {
        // The feed gliding back to the top reads as one long pull-down.
        target = -0.6 * HAND_FLICK_AMPLITUDE;
      } else {
        flickPhaseRef.current = 0;
      }
      // Chase smooths both the flick cycle and the mode transitions so
      // the hand never pops between gestures.
      const hk = 1 - Math.exp(-delta * 10);
      handOffsetRef.current += (target - handOffsetRef.current) * hk;
      hand.position.y = hand.userData.baseHandY + handOffsetRef.current;
    }
  });

  return (
    <group
      ref={slideRef}
      position={isMobile ? CHAMBER_POSITION_MOBILE : CHAMBER_POSITION}
    >
      {/* Warm candle-and-phone glow — crypt staging, not pit staging.
          Outside the scaled group so the falloff distance stays in
          world units. */}
      <pointLight
        position={[0.3, 0.7, 1.2]}
        intensity={0.8}
        color="#ffc478"
        distance={4}
        decay={2}
      />
      <group
        ref={spinRef}
        scale={isMobile ? CHAMBER_SCALE_MOBILE : CHAMBER_SCALE}
      >
        <HandsModel
          offerings={[]}
          justLitOffering={null}
          onJustLitComplete={NOOP}
          onPhoneClick={handlePhoneClick}
          userRotation={0}
          user={null}
          stagingScale={CHAMBER_MODEL_SCALE}
          stagingOffsetY={CHAMBER_MODEL_OFFSET_Y}
          phoneAuraColor={PHONE_AURA_COLOR}
          phoneAuraIntensity={PHONE_AURA_INTENSITY}
          phoneAuraSize={PHONE_AURA_SIZE}
          phoneAuraOpacity={PHONE_AURA_OPACITY}
        />
      </group>
      {/* Zoom affordance pill (see HINT_POSITION). Kept mounted so the
          fade-out can play; pointer-events none so taps fall through
          to the phone. Outside the spin group — it should hold its
          place over the frontal phone, not ride the reveal turn. */}
      <group ref={hintAnchorRef} position={HINT_POSITION}>
      <Html
        center
        distanceFactor={2.6}
        zIndexRange={[40, 30]}
        style={{ pointerEvents: "none" }}
      >
        <div className={`chamber-zoom-hint${hintOn ? " is-on" : ""}`}>
          <style>{`
            .chamber-zoom-hint {
              display: flex; align-items: center; gap: 8px;
              padding: 6px 14px; border-radius: 999px;
              border: 1px solid rgba(255, 196, 120, 0.4);
              background: rgba(12, 7, 2, 0.62);
              color: #ffc478;
              font-size: 12px; letter-spacing: 0.16em;
              text-transform: uppercase; white-space: nowrap;
              text-shadow: 0 0 8px rgba(255, 196, 120, 0.5);
              opacity: 0; transform: translateY(4px);
              transition: opacity 0.5s ease, transform 0.5s ease;
            }
            .chamber-zoom-hint.is-on { opacity: 1; transform: translateY(0); }
            .chamber-zoom-hint__dot {
              width: 7px; height: 7px; border-radius: 50%;
              background: #ffc478; box-shadow: 0 0 10px #ffc478;
              animation: chamber-hint-pulse 1.6s ease-in-out infinite;
            }
            @keyframes chamber-hint-pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.45); opacity: 0.55; }
            }
          `}</style>
          <span className="chamber-zoom-hint__dot" />
          {/* Short copy on mobile — the full sentence overflows a
              390px viewport at this scale, and the pill floats right
              above the phone so the referent is obvious. */}
          {isMobile ? "tap to look closer" : "click the phone to look closer"}
        </div>
      </Html>
      </group>
    </group>
  );
}

export default function MaryChamber() {
  // One-way latch: arm on first deep scroll, never disarm.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (armed) return undefined;
    const check = () => {
      if (pageScrollProgress() > CHAMBER_ARM_DEPTH) setArmed(true);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [armed]);

  if (!armed) return null;
  return (
    <Suspense fallback={null}>
      <ChamberInner />
    </Suspense>
  );
}
