"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { playClick } from "@/lib/uiSfx";

// ── Prize wheel on the boardwalk ── click to spin it; the ticker clacks over
// the pegs on the way round. The wheel is Synty's SM_Prop_Prize_Wheel_01, baked
// into the strip GLB under the EMPTY `Prize_Wheel` (the promos vendor's prop):
//   Prize_Wheel
//   ├─ SM_Prop_Prize_Wheel_01_Wheel_01      the wheel, 20 pegs round the rim
//   ├─ SM_Prop_Prize_Wheel_01_Wheel_01.001  the hub cap (rides along)
//   ├─ SM_Prop_Prize_Wheel_01_Ticker_01     the flapper, pivot at its origin
//   └─ (stand)
// The axle is the wheel node's LOCAL +Y (world −X on the deck); the ticker's
// local +Y is parallel to it, so both turn with a rotation about Y. Nothing
// about the geometry is hardcoded: the peg count and phase are read off the
// rim vertices on mount, the ticker's angle round the wheel from its pivot,
// and the sign of the flap from the cross products — a re-export that moves or
// re-pegs the wheel keeps working. Falls back to 20 evenly spaced pegs.
//
// Interaction follows the gachapon's shape: CommercialStrip's deck click
// handler calls interactionRef.current.handleClick(e) first; a hit anywhere
// under Prize_Wheel is ours. From afar the first click flies in AND spins, so
// the camera arrives on a turning wheel; once close, each click re-spins a
// stopped wheel. hm-vendor-exit (a deck click elsewhere, the back action, the
// ‹ › nav) releases the focus like every other stall.

// The strip names the empty Prize_Wheel (since CommercialStrip4); the phone
// card's stall_promos.glb is an older cut that still has it as SM_Prop_Prize_Wheel_01.
const NODE_NAMES = ["Prize_Wheel", "SM_Prop_Prize_Wheel_01"];
const WHEEL = "SM_Prop_Prize_Wheel_01_Wheel_01";
const HUB = "SM_Prop_Prize_Wheel_01_Wheel_01.001";
const TICKER = "SM_Prop_Prize_Wheel_01_Ticker_01";
const FOCUS_ID = "prizewheel";

const SPIN_MIN = 14, SPIN_MAX = 22;   // rad/s at launch (≈2¼–3½ turns a second)
const SPIN_DECEL = 3.2;               // rad/s² steady friction
const PEG_DRAG = 0.992;               // each peg the ticker rides over costs a little
const SPIN_STOP = 0.25;               // below this the wheel is "stopped"
const SPIN_AGAIN_BELOW = 1.0;         // a click re-spins only once it has nearly stopped
const TICK_KICK = 0.5;                // rad the flapper is knocked back per peg
const TICK_SPRING = 420, TICK_DAMP = 22;
const TICK_SFX_GAP = 0.03;            // s — at speed pegs pass faster than frames; one click per frame
const FIT = 1.25;                     // camera distance = wheel diameter × FIT
const TILT = 0.08;                    // approach ray lifted a touch above the axle

const under = (object, ancestor) => { for (let o = object; o; o = o.parent) if (o === ancestor) return true; return false; };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3(), _axis = new THREE.Vector3();

// Peg layout from the rim: vertices in the outer band of the wheel's radius,
// as angles round the axle. The pegs are an evenly spaced comb, so the comb
// count is the harmonic N with the largest angular Fourier magnitude
// |Σ e^{iNθ}| and its argument is the comb's phase. The rim ring itself is
// uniform (contributes nothing at any N) and the 12 spoke ends only show at
// N = 12, so neither needs filtering; the 2N harmonic scores lower than N, and
// is rejected explicitly in case a re-export's pegs come out narrower.
// Measured on Commercial_Strip8: N = 20, phase 0°, |F| 0.86 against 0.71 at 40.
export function readPegs(wheel) {
  const angles = [];
  const pts = [];
  wheel.updateWorldMatrix(true, true);
  wheel.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); wheel.worldToLocal(_v); pts.push([_v.x, _v.z]); }
  });
  let R = 0; for (const [x, z] of pts) R = Math.max(R, Math.hypot(x, z));
  for (const [x, z] of pts) { const r = Math.hypot(x, z); if (r > R * 0.86 && r < R * 0.985) angles.push(Math.atan2(z, x)); }
  if (angles.length < 50) return null;
  const F = new Map();
  for (let N = 6; N <= 40; N++) {
    let re = 0, im = 0; for (const t of angles) { re += Math.cos(N * t); im += Math.sin(N * t); }
    F.set(N, { mag: Math.hypot(re, im) / angles.length, arg: Math.atan2(im, re) });
  }
  let n = 0, best = 0; for (const [N, f] of F) if (f.mag > best) { best = f.mag; n = N; }
  if (best < 0.3) return null;
  if (n % 2 === 0 && F.get(n / 2) && F.get(n / 2).mag >= best * 0.75) n /= 2;   // harmonic: take the fundamental
  const step = (2 * Math.PI) / n;
  const phase = ((F.get(n).arg / n) % step + step) % step;
  return { n, step, phase, R };
}

// fly: whether the first click flies the camera in and takes the focus (the
// desktop strip). The phone card already frames the stall, so it passes false
// and a tap only spins.
export default function PrizeWheelController({ stripScene, interactionRef, focus, onFocusChange, onFocusObject, approach, fly = true }) {
  const parts = useRef(null);
  const state = useRef({ omega: 0, turned: 0, tickAng: 0, tickVel: 0, sign: -1, lastSfx: 0, active: false });
  const callbacks = useRef({}); callbacks.current = { onFocusChange, onFocusObject, approach };

  useEffect(() => {
    let root = null; for (const n of NODE_NAMES) { root = stripScene.getObjectByName(n); if (root) break; }
    const wheel = root?.getObjectByName(WHEEL);
    const ticker = root?.getObjectByName(TICKER);
    if (!root || !wheel) { parts.current = null; return; }
    const hub = root.getObjectByName(HUB) || null;
    const pegs = readPegs(wheel) || { n: 20, step: (2 * Math.PI) / 20, phase: 0 };
    // Where the ticker sits round the wheel, in the wheel's rest frame, and
    // which way it must flap: rotating the wheel by +ω about its Y moves the
    // peg under the pointer along a × (tip − centre); rotating the ticker by
    // +δ about ITS Y moves the tip along a × (tip − pivot). Same axis, the
    // pivot is on the far side of the tip from the centre, so the two are
    // opposite — but measured rather than assumed.
    let tickerAngle = -Math.PI / 2, sign = -1;
    if (ticker) {
      wheel.updateWorldMatrix(true, false); ticker.updateWorldMatrix(true, false);
      ticker.getWorldPosition(_w); wheel.worldToLocal(_v.copy(_w)); tickerAngle = Math.atan2(_v.z, _v.x);
      wheel.getWorldPosition(_c); _axis.set(0, 1, 0).transformDirection(wheel.matrixWorld);
      const tickerAxis = new THREE.Vector3(0, 1, 0).transformDirection(ticker.matrixWorld);
      const tip = _w.clone().lerp(_c, 0.12);                       // the pointer reaches a little way in from the pivot
      const pegMove = new THREE.Vector3().crossVectors(_axis, tip.clone().sub(_c));
      const tipMove = new THREE.Vector3().crossVectors(tickerAxis, tip.clone().sub(_w));
      sign = pegMove.dot(tipMove) >= 0 ? 1 : -1;
    }
    parts.current = { root, wheel, hub, ticker, pegs, tickerAngle, restQ: wheel.quaternion.clone(), hubRestQ: hub?.quaternion.clone(), tickRestQ: ticker?.quaternion.clone() };
    const s = state.current; s.omega = 0; s.turned = 0; s.tickAng = 0; s.tickVel = 0; s.sign = sign;
    return () => {
      wheel.quaternion.copy(parts.current?.restQ || wheel.quaternion);
      if (hub && parts.current?.hubRestQ) hub.quaternion.copy(parts.current.hubRestQ);
      if (ticker && parts.current?.tickRestQ) ticker.quaternion.copy(parts.current.tickRestQ);
      parts.current = null;
    };
  }, [stripScene]);

  const spin = () => {
    const s = state.current;
    s.omega = SPIN_MIN + Math.random() * (SPIN_MAX - SPIN_MIN);
  };
  const flyIn = () => {
    const p = parts.current; if (!p) return;
    const box = new THREE.Box3().setFromObject(p.wheel); if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
    const normal = (callbacks.current.approach || new THREE.Vector3(0, 0, 1)).clone(); normal.y += TILT; normal.normalize();
    const dist = Math.max(size.x, size.y, size.z) * FIT;
    callbacks.current.onFocusObject?.(centre, normal, dist, Math.min(0.1, dist * 0.5));
    callbacks.current.onFocusChange?.({ id: FOCUS_ID, object: p.wheel });
    state.current.active = true;
  };
  const release = () => {
    if (!state.current.active) return;
    state.current.active = false;
    callbacks.current.onFocusChange?.((current) => (current?.id === FOCUS_ID ? null : current));
  };
  const handlers = useRef({}); handlers.current = { spin, flyIn, release };

  useEffect(() => {
    interactionRef.current = {
      close: () => handlers.current.release(),
      handleClick(e) {
        const p = parts.current; if (!p || !under(e.object, p.root)) return false;
        e.stopPropagation();
        const s = state.current;
        if (fly && !s.active) handlers.current.flyIn();
        if (Math.abs(s.omega) < SPIN_AGAIN_BELOW) handlers.current.spin();
        return true;
      },
    };
    const onExit = () => handlers.current.release();
    window.addEventListener("hm-vendor-exit", onExit);
    return () => { interactionRef.current = null; window.removeEventListener("hm-vendor-exit", onExit); };
  }, [interactionRef, stripScene, fly]);

  // Another stall took the camera.
  useEffect(() => { if (state.current.active && focus?.id !== FOCUS_ID) state.current.active = false; }, [focus]);

  useFrame((_, dt) => {
    const p = parts.current; if (!p) return;
    const s = state.current; const step = Math.min(dt, 0.05);
    if (Math.abs(s.omega) > 0) {
      // friction, then stop dead below the threshold (no snapping to a slot)
      const dw = SPIN_DECEL * step;
      s.omega = Math.abs(s.omega) <= dw || Math.abs(s.omega) < SPIN_STOP ? 0 : s.omega - Math.sign(s.omega) * dw;
      const before = s.turned; s.turned += s.omega * step;
      p.wheel.quaternion.copy(p.restQ).multiply(new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.turned));
      if (p.hub) p.hub.quaternion.copy(p.hubRestQ).multiply(new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.turned));
      // Pegs crossing the ticker. A peg at rest angle θ sits at θ − turned in
      // the stand's frame (rotation about +Y lowers atan2(z, x)); it meets the
      // ticker when turned ≡ θ − tickerAngle, so count the multiples of the peg
      // step between the previous and the current turn.
      const off = p.pegs.phase - p.tickerAngle;
      const crossed = Math.abs(Math.floor((s.turned - off) / p.pegs.step) - Math.floor((before - off) / p.pegs.step));
      if (crossed) {
        for (let i = 0; i < crossed; i++) s.omega *= PEG_DRAG;
        s.tickAng = s.sign * Math.sign(s.omega) * TICK_KICK; s.tickVel = 0;
        const now = performance.now() / 1000;
        if (now - s.lastSfx >= TICK_SFX_GAP) {
          s.lastSfx = now;
          // louder and brighter the faster it goes, like a real flapper
          const speed = Math.min(1, Math.abs(s.omega) / SPIN_MAX);
          playClick({ volume: 0.12 + 0.2 * speed, pitch: 900 + 500 * speed });
        }
      }
    }
    // the flapper springs back to centre
    if (p.ticker && (Math.abs(s.tickAng) > 1e-4 || Math.abs(s.tickVel) > 1e-4)) {
      s.tickVel += (-TICK_SPRING * s.tickAng - TICK_DAMP * s.tickVel) * step;
      s.tickAng += s.tickVel * step;
      if (Math.abs(s.tickAng) < 1e-4 && Math.abs(s.tickVel) < 1e-3) { s.tickAng = 0; s.tickVel = 0; }
      p.ticker.quaternion.copy(p.tickRestQ).multiply(new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.tickAng));
    }
  });

  return null;
}
