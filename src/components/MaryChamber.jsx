"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFrame } from "@react-three/fiber";
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
const CHAMBER_POSITION = [0, -9.0, -0.24];
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

function yawAt(t) {
  const kf = REVEAL_KEYFRAMES;
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

// The phone's aura glow — the blue light in the chamber. These are the
// chamber's own values (passed as props to HandsModel); /illumin80
// keeps its original cyan via the prop defaults. For crypt-warm staging
// try color "#ffc478" with opacity ~0.3; size is in model-local units.
const PHONE_AURA_COLOR = "#ffc478";
const PHONE_AURA_INTENSITY = 0.1;
const PHONE_AURA_SIZE = 3;
const PHONE_AURA_OPACITY = 0.1;

// THE BLUE LIGHT: hands_MOBILE.glb carries an EMBEDDED point light
// (KHR_lights_punctual, node "Point") just in front of the screen — the
// authored "phone glow on the fingers". Blender values: color
// (0, 0.63, 1.0) azure, intensity ~10.9. These chamber overrides
// re-tint/dim it; the authored values are restored on unmount because
// useGLTF caches the scene graph and the light object is shared with
// /illumin80's mount. Set intensity 0 to switch it off entirely.
const SCREEN_GLOW_COLOR = "#9fc8ff";
const SCREEN_GLOW_INTENSITY = 5;

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

function pageScrollProgress() {
  if (typeof window === "undefined") return 0;
  const max = Math.max(
    document.documentElement.scrollHeight - window.innerHeight,
    1,
  );
  return Math.min(Math.max(window.scrollY / max, 0), 1);
}

function ChamberInner() {
  const spinRef = useRef();
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
      setChamberFocus(FOCUS_CAMERA_POS, FOCUS_CAMERA_TARGET);
      focusedRef.current = true;
    }
  }, []);

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
    if (light?.userData?.authoredGlowColor) {
      light.color.copy(light.userData.authoredGlowColor);
      light.intensity = light.userData.authoredGlowIntensity;
    }
    // Same cache-leak guard for the hand: park it back at its authored
    // rest position so /illumin80's mount doesn't inherit a mid-flick.
    const hand = handRef.current;
    if (hand?.userData?.baseHandY != null) {
      hand.position.y = hand.userData.baseHandY;
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
      // The GLB's embedded screen-glow light: stash the authored values
      // once (for the unmount restore), then apply the chamber tint.
      if (child.isPointLight) {
        if (child.userData.authoredGlowColor == null) {
          child.userData.authoredGlowColor = child.color.clone();
          child.userData.authoredGlowIntensity = child.intensity;
        }
        child.color.set(SCREEN_GLOW_COLOR);
        child.intensity = SCREEN_GLOW_INTENSITY;
        screenGlowLightRef.current = child;
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
      }
    });
    figureMatsRef.current = mats;
  });

  // Scroll → yaw target. Computed in a scroll listener (not per frame)
  // so the rAF loop never touches scrollHeight, which can force reflow.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const remaining = maxScroll - window.scrollY;
      const span = window.innerHeight * REVEAL_SPAN_SCREENS;
      // 0 while more than `span` of scroll remains; 1 at the very bottom.
      const t = Math.min(Math.max(1 - remaining / span, 0), 1);
      tProgressRef.current = t;
      yawTargetRef.current = yawAt(t);
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
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Exponential chase toward the scroll-mapped yaw — glides over the
  // discrete steps of wheel/trackpad scrolling — plus the apparition
  // fade on the backdrop/halo materials.
  useFrame((_, delta) => {
    if (!spinRef.current) return;
    const k = 1 - Math.exp(-delta * REVEAL_CHASE);
    spinRef.current.rotation.y +=
      (yawTargetRef.current - spinRef.current.rotation.y) * k;

    let fade =
      (tProgressRef.current - FIGURE_FADE_START) /
      (FIGURE_FADE_END - FIGURE_FADE_START);
    fade = Math.min(Math.max(fade, 0), 1);
    fade = fade * fade * (3 - 2 * fade);
    for (const m of figureMatsRef.current) {
      if (m.opacity !== fade) m.opacity = fade;
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
    <group position={CHAMBER_POSITION}>
      {/* Warm candle-and-phone glow — crypt staging, not pit staging.
          Outside the scaled group so the falloff distance stays in
          world units. */}
      <pointLight
        position={[0.3, 0.7, 1.2]}
        intensity={1.1}
        color="#ffc478"
        distance={4}
        decay={2}
      />
      <group ref={spinRef} scale={CHAMBER_SCALE}>
        <HandsModel
          offerings={[]}
          justLitOffering={null}
          onJustLitComplete={NOOP}
          onPhoneClick={handlePhoneClick}
          userRotation={0}
          user={null}
          phoneAuraColor={PHONE_AURA_COLOR}
          phoneAuraIntensity={PHONE_AURA_INTENSITY}
          phoneAuraSize={PHONE_AURA_SIZE}
          phoneAuraOpacity={PHONE_AURA_OPACITY}
        />
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
