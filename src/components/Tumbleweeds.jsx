"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { fieldKeepOutRects, segmentHitsRect } from "@/lib/desertKeepOut";

// A few tumbleweeds that, now and then, roll across the open desert around the
// field (2026-10-06). Purely dressing: no clicks, no state, no network.
//
// Each weed keeps its own schedule — a random wait, then one crossing along a
// straight wind line, then another wait. Crossings are sampled on a ring
// outside the claims and REJECTED if the line would cut through the exclusion
// rectangle (field + boardwalk strip on −Z + the refinery corner on +Z), so
// they stay out in the sand where the camera cap (orbit maxDistance 16) still
// shows them. The roll is real: angular speed = linear speed / radius about the
// axis perpendicular to travel, plus a slow wobble and small hops.
//
// Dev: ?tumbleweeds=0 disables; window.__hmTumble() launches one immediately.

const TUMBLEWEED_URL = "/models/tumbleweed.glb";
// The GLB is ~0.6 world units across at its authored scale. A claim is one
// unit, so a weed wants to be a small fraction of that.
const BASE_SCALE = 0.36;
const SCALE_JITTER = 0.1;
const MODEL_RADIUS = 0.3;           // half the authored diameter (pre-scale)
const WIND_HEADING = 0.35;          // radians from +X toward +Z: the prevailing wind
const WIND_JITTER = 0.45;           // per-crossing heading spread (±)
const SPEED_MIN = 1.1, SPEED_MAX = 2.4;   // units/s
const WAIT_MIN = 10, WAIT_MAX = 38;       // seconds between crossings, per weed
const FIRST_WAIT_MAX = 22;                // stagger the first appearances
// Crossings start on a ring hugging the keep-out zone, so they pass close by
// the claims and the strip where the camera can see them (2026-10-06: they
// first ran 6.5 cells out and read as specks).
const RING_PAD = 0.8;               // ring inner radius = field half-diagonal + this
const RING_WIDTH = 4;               // ring outer radius = inner + this

const ENABLED = typeof window === "undefined"
  || new URLSearchParams(window.location.search).get("tumbleweeds") !== "0";

function planCrossing(rects, ringInner, ringOuter) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const heading = WIND_HEADING + (Math.random() * 2 - 1) * WIND_JITTER;
    const dx = Math.cos(heading), dz = Math.sin(heading);
    // Start on the upwind half of the ring.
    const ang = Math.random() * Math.PI * 2;
    const r = ringInner + Math.random() * (ringOuter - ringInner);
    const px = Math.cos(ang) * r, pz = Math.sin(ang) * r;
    if (px * dx + pz * dz > 0) continue;            // downwind side — would roll away unseen
    const L = 2 * ringOuter + 2;
    if (rects.some((r) => segmentHitsRect(px, pz, dx, dz, L, r))) continue;
    return { px, pz, dx, dz, L };
  }
  // Fallback lane: straight across the front (+Z side), clear of everything.
  const pz = rects[0].maxZ + 1.5 + Math.random() * 3;
  return { px: -ringOuter, pz, dx: 1, dz: 0, L: 2 * ringOuter };
}

function Tumbleweed({ template, rects, ringInner, ringOuter, index }) {
  const group = useRef();
  const object = useMemo(() => {
    const o = template.clone(true);
    o.traverse((c) => { if (c.isMesh) { c.castShadow = false; c.receiveShadow = false; c.raycast = () => {}; } });
    return o;
  }, [template]);
  const st = useRef({
    active: false,
    waitUntil: 0,
    t: 0, speed: 1.5, path: null,
    scale: 1, radius: 0.1,
    angle: 0, axis: new THREE.Vector3(1, 0, 0),
    wobblePhase: Math.random() * Math.PI * 2,
    hopPhase: Math.random() * Math.PI * 2,
    hopRate: 0, gustPhase: Math.random() * Math.PI * 2,
    clock: 0,
    qRoll: new THREE.Quaternion(), qWob: new THREE.Quaternion(),
    wobAxis: new THREE.Vector3(),
  });
  // Stagger the first appearances so the desert is not suddenly busy.
  useEffect(() => { st.current.waitUntil = 3 + Math.random() * FIRST_WAIT_MAX; }, []);

  const launch = (s) => {
    s.path = planCrossing(rects, ringInner, ringOuter);
    s.scale = BASE_SCALE + (Math.random() * 2 - 1) * SCALE_JITTER;
    s.radius = MODEL_RADIUS * s.scale;
    s.speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    s.t = 0;
    s.angle = Math.random() * Math.PI * 2;
    // Roll axis ⟂ travel, in the ground plane: up × dir.
    s.axis.set(0, 1, 0).cross(new THREE.Vector3(s.path.dx, 0, s.path.dz)).normalize();
    s.wobAxis.set(s.path.dx, 0, s.path.dz);
    s.hopRate = 2.2 + Math.random() * 1.6;
    s.active = true;
  };

  useEffect(() => {
    if (typeof window === "undefined" || index !== 0) return;
    // Dev trigger: launch this weed now (and ignore its wait).
    window.__hmTumble = () => { launch(st.current); };
    return () => { if (window.__hmTumble) delete window.__hmTumble; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useFrame((_, dtRaw) => {
    const s = st.current, g = group.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.1);
    s.clock += dt;
    if (!s.active) {
      g.visible = false;
      if (s.clock >= s.waitUntil) launch(s);
      return;
    }
    // Gusty speed: the base plus a slow swell, never below a crawl.
    const gust = 1 + 0.3 * Math.sin(s.clock * 1.1 + s.gustPhase) + 0.12 * Math.sin(s.clock * 3.7 + s.gustPhase * 2);
    const v = s.speed * Math.max(0.35, gust);
    s.t += v * dt;
    const p = s.path;
    if (s.t >= p.L) {
      s.active = false;
      s.waitUntil = s.clock + WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
      g.visible = false;
      return;
    }
    // Small hops: a rectified sine so it skips along rather than floats.
    const hop = Math.max(0, Math.sin(s.clock * s.hopRate + s.hopPhase)) ** 2 * s.radius * 0.9;
    g.visible = true;
    g.position.set(p.px + p.dx * s.t, s.radius + hop, p.pz + p.dz * s.t);
    s.angle += (v * dt) / s.radius;
    s.qRoll.setFromAxisAngle(s.axis, s.angle);
    s.qWob.setFromAxisAngle(s.wobAxis, Math.sin(s.clock * 0.9 + s.wobblePhase) * 0.35);
    g.quaternion.copy(s.qWob).multiply(s.qRoll);
    g.scale.setScalar(s.scale);
  });

  return (
    <group ref={group} visible={false}>
      <primitive object={object} />
    </group>
  );
}

export default function Tumbleweeds({ worldW = 10, worldD = 10, cellSize = 1, count = 3 }) {
  const { scene } = useGLTF(TUMBLEWEED_URL);
  // Keep-out rects (claims + strip, refinery corner) — shared with the cactus
  // scatter in lib/desertKeepOut.js. Margins are tight on purpose: the weeds
  // should skirt the field, not orbit it.
  const rects = useMemo(() => fieldKeepOutRects(worldW, worldD, cellSize), [worldW, worldD, cellSize]);
  const ringInner = Math.hypot(worldW, worldD) / 2 + RING_PAD;
  const ringOuter = ringInner + RING_WIDTH;
  if (!ENABLED) return null;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Tumbleweed key={i} index={i} template={scene} rects={rects} ringInner={ringInner} ringOuter={ringOuter} />
      ))}
    </group>
  );
}

useGLTF.preload(TUMBLEWEED_URL);
