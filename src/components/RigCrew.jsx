"use client";

/**
 * RigCrew — the rig's crew: a couple of workers "found doing" random things at
 * named spots on the rig, who also defend it, celebrate with it, chat with each
 * other, and brief the player.
 *
 * Spots are `Crew_*` empties exported inside the rig GLB (feet frame: origin between
 * the feet at sole level, local +X = facing), read by name from the rig scene. Until
 * the shipped rig carries them, STATIONS holds the documented transforms
 * (docs/rig-export.md, "Crew stations"). Activities are the tables below: what a
 * worker does at each spot, which prop to show, where the head looks, and the gates
 * (night, hell, a stalled pump) that reweight them.
 *
 * "Found doing": the character has no walk clip, so a worker never travels on
 * screen. Spots are chosen per sighting — seeded by plot and a 10-minute bucket so
 * every viewer sees the same crew and re-renders are stable — and only change while
 * the crew is unmounted (rig not highlighted, tab hidden). Within a spot, clips chain
 * on random timers. The ladder is the one scripted move.
 *
 * Modes (highest priority first) sit above the activity menu and take over at the
 * worker's current spot:
 *   cower     — a demon attack nearby or a hell breach: crew_cower once, held, then
 *               played back to stand up
 *   defend    — window.__hmDemonState within CREW_ALERT_RANGE: face it, crew_ninjaStance
 *               as the guard loop, crew_throw every few seconds with a fireball (flavor; set
 *               CREW_THROWS_COUNT to make throws land as walker shots via "hm-shoot")
 *   alert     — hellActive with no demon in range: crew_nervous
 *   celebrate — gusherActive: crew_clap loop with the odd crew_victory1/2
 *   brief     — a tap on a worker: the operator waves at the boss, then briefs with a text bubble
 *               of window.__hmBriefing.lines (page.js), answering each line with crew_no /
 *               crew_yes / crew_thoughtful by that line's tone; the other listens (nod/shrug).
 *               crew_talking is reserved for crew-to-crew chat.
 *   chat      — a paired sighting: two workers at facing spots, taking turns talking
 *   music     — window.__hmMusicOn (page.js, the music player): crew_musicListening
 *
 * Events: `hm:decide` {detail:{action}} → the operator, if at the panel, sidesteps to
 * that button's station and plays crew_push. `hm-demon-attack` → cower.
 * Dev hook: window.__hmCrew — state(), go(role, spot), brief(), reroll("chat"),
 * force = { celebrate, hell, music, demon:{x,y,z}, timeScale }.
 *
 * Mount as a sibling of the rig primitive, with the rig's scale, inside the rig group.
 */

import { useRef, useMemo, useEffect, useState, useCallback, Suspense } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export const CREW_GLB = "/models/crew_goblin.glb?v=11";
useGLTF.preload(CREW_GLB);

const BUCKET_MS = 10 * 60 * 1000;
const CLIMB_RISE_FALLBACK = 0.154;  // crew_climb is in place; world rise per cycle (rig-GLB units) unless the
                                    // Crew_Ladder_Base empty carries hm_climb_rise_m (glTF extras → userData)
const STEP_S = 0.8;                 // (legacy) step onto / off the platform at the ladder head
// crew_topOfLadder (4 s, Mixamo): climbing pose → standing on the landing. Its root was pinned in
// place in Blender; this is the root's travel (station frame: forward along the facing, up),
// sampled every 0.05 of the clip, which the page applies to the group while the clip plays.
const TOP_CLIP = "crew_topOfLadder";
const TOP_PATH = [[0,0],[0.004,0.026],[0.034,0.021],[-0.039,0.08],[-0.014,0.13],[-0.053,0.182],[-0.064,0.217],[-0.074,0.247],[-0.135,0.323],[-0.121,0.363],[-0.142,0.395],[-0.115,0.465],[-0.008,0.503],[0.131,0.512],[0.223,0.481],[0.286,0.474],[0.315,0.477],[0.322,0.476],[0.33,0.474],[0.333,0.474],[0.334,0.474]];
const TOP_FWD_END = 0.334, TOP_ROOT_RISE = 0.474, LANDING_RISE = 0.479;   // soles end 0.479 above the clip's start floor
const topPathAt = (u) => {
  const n = TOP_PATH.length; const x = Math.max(0, Math.min(1, u)) * (n - 1); const i = Math.min(n - 2, Math.floor(x)); const f = x - i;
  const a = TOP_PATH[i], b = TOP_PATH[i + 1];
  return [a[0] + (b[0] - a[0]) * f, (a[1] + (b[1] - a[1]) * f) * (LANDING_RISE / TOP_ROOT_RISE)];
};
const SLIDE_S = 0.35;               // sidestep between the PASS and EXTRACT stations
const ASIDE_S = 0.5;                // step beside the cabinet when the player opens the panel view
const FADE = 0.25;
const HEAD_YAW = 1.0, HEAD_PITCH_UP = 0.55, HEAD_PITCH_DOWN = 0.45, HEAD_EASE = 5;
const BODY_TURN_EASE = 4;           // easing when a worker turns to face a demon
const SEAT_BACK_OFFSET = 0.244;   // seat markers mark the worker's BACK (at the rail): the spot's origin sits this far forward along +X; crew_dozing and crew_getUp share one floor-sit pose on it, so the sleeper's back ends up 5 cm in front of the marker and the stand-up lands on the origin
const CREW_ALERT_RANGE = 3.0;       // world units (cells): demon this close → defend
const CREW_THROW_RANGE = 2.5;
const CREW_THROWS_COUNT = false;    // true → each throw also fires "hm-shoot" from the worker's position
const THROW_RELEASE_S = 0.83;       // frame 25 of crew_throw: the right hand lets go
const FIREBALL_FLIGHT_S = 0.45;
const COWER_HOLD_MS = 4500;         // how long a cower is held after its trigger
const HELL_COWER_MS = 6000;
const CHAT_TURN = [8, 12];          // seconds each talker holds the floor
const WALK_SPEED = 0.518;           // rig units/s: crew_walk is in place; this is the stance foot's slide speed measured in Blender (32 f at 30 fps)
const WALK_MIN = 0.12;              // moves shorter than this stay a glide (a shuffle, not a walk)
const BRIEF_LINE_S = 3.2;
const BRIEF_GREET_S = 2.2;          // the operator waves at the boss this long before the first line
const DOZE_CAUGHT = [3, 6];          // seconds the boss gets to catch a dozer before they scramble up to work
const _UP = new THREE.Vector3(0, 1, 0);

// Station fallbacks — rig-GLB units, three.js axes, yaw = rotation.y (local +X = facing).
const STATIONS = {
  panel_pass:       { node: "Crew_Panel_Pass",       pos: [0.655, 0.245, 0.863],  yaw: 3.036 },
  panel_extract:    { node: "Crew_Panel_Extract",    pos: [0.655, 0.245, 1.035],  yaw: 3.036 },
  panel_aside:      { node: "Crew_Panel_Aside",      pos: [0.655, 0.245, 0.38],   yaw: 3.036 }, // beside the key-switch face, clear of the panel camera
  ladder_base:      { node: "Crew_Ladder_Base",      pos: [-0.697, 0.236, 0.755], yaw: -0.054 },
  ladder_top:       { node: "Crew_Ladder_Top",       pos: [-0.45, 1.725, 0.76],   yaw: -0.054 },
  motor:            { node: "Crew_Motor",            pos: [0.40, 0.236, -0.70],   yaw: Math.PI },
  rail_doze:        { node: "Crew_Rail_Doze",        pos: [0.45, 0.236, -2.14],   yaw: -Math.PI / 2, seatBack: true }, // marker at the north walkway rail
  rail_doze_top:    { node: "Crew_Rail_Doze_Top",    pos: [0.25, 1.725, 0.42],    yaw: -Math.PI / 2, seatBack: true }, // marker at the platform's north rail
  platform_lookout: { node: "Crew_Lookout",          pos: [0.363, 1.725, 0.776],  yaw: -Math.PI / 2 },
  valve:            { node: "Crew_Valve",            pos: [-1.05, 0, 2.44],       yaw: Math.PI / 2 },   // south of the riser handwheel (hub 0.55 up, rim 0.19 ahead), facing it
  wellhead:         { node: "Crew_Wellhead",         pos: [0.556, 0, 2.092],      yaw: Math.PI },     // east of the well curb, on the ground
  chat_a:           { node: "Crew_Chat_A",           pos: [0.155, 0.236, -1.821], yaw: Math.PI },      // two workers facing each other on the north walkway, 0.5 apart
  chat_b:           { node: "Crew_Chat_B",           pos: [-0.345, 0.236, -1.821], yaw: 0 },
};

// Activities: clip, how long a worker keeps at it (s), props to show, whether the head
// may look around (reading, dozing and listening to music keep the head where the clip puts it).
const ACTS = {
  idle:        { clip: "crew_idle",           dwell: [6, 14],  look: true },
  tablet:      { clip: "crew_tablet",         dwell: [10, 26], props: ["Prop_Tablet"] },
  wave:        { clip: "crew_wave",           once: true,      look: true },
  doze:        { clip: "crew_dozing",         once: true, holdBetween: [2, 4], forever: true }, // nod off, hold, nod off again; only ever a sighting
  push:        { clip: "crew_push",           once: true },
  climb:       { clip: "crew_climb" },
  walk:        { clip: "crew_walk",           forever: true },   // in place; slideTo moves the group at WALK_SPEED
  topOfLadder: { clip: "crew_topOfLadder", once: true },
  ninja:       { clip: "crew_ninjaStance",    dwell: [9, 18] },
  nervous:     { clip: "crew_nervous",        dwell: [6, 12],  look: true },
  talking:     { clip: "crew_talking",        dwell: [10, 20], look: true },
  acknowledge: { clip: "crew_acknowledge",    once: true,      look: true },
  no:          { clip: "crew_no",             once: true,      look: true },   // briefing replies: nothing to report…
  yes:         { clip: "crew_yes",            once: true,      look: true },   // …good news…
  thoughtful:  { clip: "crew_thoughtful",     once: true,      look: true },   // …something to think about
  shrug:       { clip: "crew_shrug",          once: true,      look: true },
  clap:        { clip: "crew_clap",           dwell: [5, 9],   look: true },
  cheer:       { clip: "crew_cheer",          dwell: [4, 8],   look: true },
  victory1:    { clip: "crew_victory1",       once: true,      look: true },
  victory2:    { clip: "crew_victory2",       once: true },
  cower:       { clip: "crew_cower",          once: true },
  uncower:     { clip: "crew_cower",          once: true, reverse: true },   // fallback stand-up if crew_getUp is missing
  getUp:       { clip: "crew_getUp",          once: true },                  // floor sit → standing (6.1 s); follows doze, ends on the spot's origin
  throw:       { clip: "crew_throw",          once: true },
  music:       { clip: "crew_musicListening", dwell: [9, 18] },
  valve:       { clip: "crew_valve",          once: true },   // three pulls on the riser handwheel (6.5 s); the wheel itself turns in useFrame
};

// crew_valve turns the rig's handwheel with the hands: three pulls of 35°, clockwise as the worker
// sees it (left hand rises), each a 0.8 s smoothstep. Windows are the clip's frame plan (frames
// 25-48, 73-96, 121-144 at 30 fps) — re-derive if scripts/author-crew-valve.py changes.
const VALVE_PULLS = [[0.8, 1.6], [2.4, 3.2], [4.0, 4.8]];
const VALVE_STEP = (35 * Math.PI) / 180;
const VALVE_SIGN = -1;              // the wheel node's local +Y points back at the worker, so clockwise-as-seen is negative (checked on the v25 rig)
const valveAngleAt = (t) => VALVE_PULLS.reduce((a, [t0, t1]) => { const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))); return a + VALVE_STEP * u * u * (3 - 2 * u); }, 0);

// What a worker does at each spot ([act, weight]) and what it looks at between clips.
const MENU = {
  panel_pass:       { acts: [["idle", 3], ["tablet", 2], ["wave", 1]], look: "camera" },
  panel_extract:    { acts: [["idle", 3], ["tablet", 2]],              look: "camera" },
  panel_aside:      { acts: [["idle", 3], ["tablet", 1]],              look: "camera" },
  motor:            { acts: [["idle", 2], ["tablet", 2]],              look: "head_pump" },
  rail_doze:        { acts: [["doze", 1]], awake: [["idle", 2], ["tablet", 2]] },   // caught sleeping on the job; after the scramble, back to work here
  rail_doze_top:    { acts: [["doze", 1]], awake: [["idle", 2], ["tablet", 2]] },
  platform_lookout: { acts: [["idle", 2], ["tablet", 2], ["wave", 1]], look: "head_pump" },
  ladder_base:      { acts: [["idle", 1]],                             look: "camera",    climbTo: "ladder_top" },
  ladder_top:       { acts: [["idle", 2], ["tablet", 1]],              look: "head_pump", descendTo: "ladder_base" },
  valve:            { acts: [["valve", 4], ["idle", 2], ["wave", 1]], look: "camera" },
  wellhead:         { acts: [["idle", 2], ["tablet", 1]],              look: "head_pump" },
  chat_a:           { acts: [["idle", 1]],                             look: "partner" },
  chat_b:           { acts: [["idle", 1]],                             look: "partner" },
};

// The crew roster: which spots each role is found at ([spot, weight]). The operator briefs.
const ROLES = [
  { id: "operator",  spots: [["panel_pass", 4], ["panel_extract", 1], ["motor", 1], ["wellhead", 1]], briefs: true, chatSpot: "chat_a" },
  { id: "inspector", spots: [["ladder_base", 3], ["platform_lookout", 2], ["rail_doze", 2], ["rail_doze_top", 1], ["valve", 1], ["motor", 1]], chatSpot: "chat_b" },
];
const CHAT_CHANCE = 0.25;           // share of sightings where the two are found chatting
// two workers never share the panel, nor the platform's east strip (the seat and the lookout overlap)
const zoneOf = (spot) => (spot.startsWith("panel_") ? "panel" : spot === "rail_doze_top" || spot === "platform_lookout" ? "platform_east" : spot);
const PANEL_BUTTONS = new Set(["panel_pass", "panel_extract"]);

// Gates: reweight spots/acts by the rig's state. night → dozing; hell → nobody dozes.
function spotWeight(spot, w, g) {
  if (spot === "rail_doze" || spot === "rail_doze_top") return g.hell ? 0 : w * (g.night ? 3 : g.stalled ? 2 : 0.6);
  return w;
}
function actWeight(act, w, g) {
  if (act === "doze") return g.hell ? 0 : w * (g.night ? 3 : g.stalled ? 2 : 1);
  return w;
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickWeighted(rng, items) {
  const total = items.reduce((s, it) => s + it[1], 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [v, w] of items) { r -= w; if (r <= 0 && w > 0) return v; }
  return items[items.length - 1][0];
}
const rand = (a, b) => a + Math.random() * (b - a);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A station's transform in the rig root's frame — from the Crew_* empty if the rig
// GLB has it, else the documented fallback.
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _ax = new THREE.Vector3();
function resolveStation(rigScene, id) {
  const def = STATIONS[id];
  const node = rigScene?.getObjectByName?.(def.node);
  let out;
  if (!node) out = { pos: new THREE.Vector3(...def.pos), yaw: def.yaw, fromRig: false, extras: {} };
  else {
    _m.copy(node.matrix);
    let p = node.parent;
    while (p && p !== rigScene) { _m.premultiply(p.matrix); p = p.parent; }
    _m.decompose(_p, _q, _s);
    _ax.set(1, 0, 0).applyQuaternion(_q);
    out = { pos: _p.clone(), yaw: Math.atan2(-_ax.z, _ax.x), fromRig: true, extras: node.userData || {} };
  }
  // Seat markers sit where the worker's BACK goes (at the rail); the seated pose reaches 0.45 behind
  // its origin, so the body is placed forward along the facing. yaw → local +X = (cos, 0, -sin).
  if (def.seatBack || out.extras?.hm_seat_back) out.pos.add(new THREE.Vector3(Math.cos(out.yaw), 0, -Math.sin(out.yaw)).multiplyScalar(SEAT_BACK_OFFSET));
  return out;
}

// Which reply a briefing line gets. page.js sends a tone per line ("no" | "yes" | "thoughtful");
// without one, read the line: nothing-to-report shakes the head, gains nod, the rest ponders.
const briefGesture = (tone, line = "") => {
  if (tone === "no" || tone === "yes" || tone === "thoughtful") return tone;
  if (/nothing new|no claim|signed out|pre-season|0% full/i.test(line)) return "no";
  if (/strike|drilled|BTR|unread|full/i.test(line)) return "yes";
  return "thoughtful";
};
const devHook = () => (typeof window === "undefined" ? null : (window.__hmCrew ||= { workers: {}, spots: Object.keys(STATIONS), force: {},
  go: (r, sp) => window.__hmCrew.workers[r]?.go(sp),
  act: (r, a) => window.__hmCrew.workers[r]?.act(a),
  walk: (r, sp) => window.__hmCrew.workers[r]?.walk(sp),
  state: () => Object.fromEntries(Object.entries(window.__hmCrew.workers).map(([k, w]) => [k, w.state()])) }));

export default function RigCrew({ rigScene, scale = 1, enabled = true, plotKey = "rig", envPreset = null, hellActive = false, gusherActive = false, pausedRef = null, panelOpen = false, panelOpenRef = null, workers = 2, wheelSpinRef = null, onValveTurn = null }) {
  // A new "sighting" whenever the tab comes back: the crew may have moved.
  const [sighting, setSighting] = useState(0);
  const forceScene = useRef(null);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") setSighting((s) => s + 1); };
    document.addEventListener("visibilitychange", onVis);
    const hook = devHook();
    if (hook) hook.reroll = (scene = null) => { forceScene.current = scene; setSighting((s) => s + 1); };
    return () => { document.removeEventListener("visibilitychange", onVis); if (hook) delete hook.reroll; };
  }, []);
  // Panel view open (phone: view prop; desktop: the pumpjack's zoom ref) → the operator steps aside.
  const panelRef = useRef({ open: false, ref: null });
  panelRef.current.open = !!panelOpen; panelRef.current.ref = panelOpenRef;
  if (!enabled || !rigScene) return null;
  return (
    <Suspense fallback={null}>
      <CrewInner key={sighting} sighting={sighting} forceScene={forceScene} rigScene={rigScene} scale={scale} plotKey={plotKey} envPreset={envPreset} wheelSpinRef={wheelSpinRef} onValveTurn={onValveTurn}
        hellActive={hellActive} gusherActive={gusherActive} pausedRef={pausedRef} panelRef={panelRef} workers={workers} />
    </Suspense>
  );
}

function CrewInner({ sighting, forceScene, rigScene, scale, plotKey, envPreset, hellActive, gusherActive, pausedRef, panelRef, workers, wheelSpinRef, onValveTurn }) {
  const { scene, animations } = useGLTF(CREW_GLB);
  const rootRef = useRef();
  const gates = useMemo(() => ({ night: envPreset === "night", hell: !!hellActive, stalled: !!pausedRef?.current }), [envPreset, hellActive, pausedRef]);
  // Shared crew state: worker registry (head positions for "partner" looks), the chat and
  // briefing scenes, the cower timer, the rig's world position, and the fireball pool.
  const crew = useRef({ workers: {}, chat: null, brief: null, cowerUntil: 0, rigPos: new THREE.Vector3(), gusher: false, fire: null }).current;
  crew.gusher = !!gusherActive;
  // Spots per worker for this sighting: same plot + same 10-minute bucket → same crew for everyone.
  const assignments = useMemo(() => {
    const bucket = Math.floor(Date.now() / BUCKET_MS);
    const rng = mulberry32(hash32(`${plotKey}|${bucket}|${sighting}`));
    const roles = ROLES.slice(0, workers);
    const forced = forceScene.current; forceScene.current = null;
    const chat = roles.length >= 2 && (forced === "chat" || (forced == null && rng() < CHAT_CHANCE));
    const taken = new Set();
    return roles.map((role) => {
      if (chat) return { role, spot: role.chatSpot, scene: "chat" };
      const items = role.spots.map(([s, w]) => [s, taken.has(zoneOf(s)) ? 0 : spotWeight(s, w, gates)]);
      const spot = pickWeighted(rng, items) || role.spots[0][0];
      taken.add(zoneOf(spot));
      return { role, spot, scene: null };
    });
  }, [plotKey, sighting, workers, gates, forceScene]);

  // Triggers shared by the crew: a demon attack nearby, a hell breach.
  useEffect(() => {
    const onAttack = () => {
      const D = window.__hmDemonState;
      if (D && !D.done && Math.hypot(D.x - crew.rigPos.x, D.z - crew.rigPos.z) < CREW_ALERT_RANGE) crew.cowerUntil = Date.now() + COWER_HOLD_MS;
    };
    window.addEventListener("hm-demon-attack", onAttack);
    return () => window.removeEventListener("hm-demon-attack", onAttack);
  }, [crew]);
  const hellWas = useRef(!!hellActive);
  useEffect(() => { if (hellActive && !hellWas.current) crew.cowerUntil = Date.now() + HELL_COWER_MS; hellWas.current = !!hellActive; }, [hellActive, crew]);
  // Briefing: a tap on any worker starts (or stops) the operator's briefing.
  const toggleBrief = useCallback(() => {
    if (crew.brief) { crew.brief = null; return; }
    const lines = (window.__hmBriefing?.lines || ["Rig's holding.", "Nothing new since your last visit."]).slice(0, 6);
    const tones = (window.__hmBriefing?.tones || []).slice(0, 6);
    const talker = (assignments.find((a) => a.role.briefs) || assignments[0]).role.id;
    crew.brief = { talker, lines, tones, i: 0, nextLineAt: 0, until: 0 };
  }, [crew, assignments]);
  useEffect(() => { const hook = devHook(); if (hook) hook.brief = toggleBrief; return () => { if (hook) delete hook.brief; }; }, [toggleBrief]);
  useFrame(() => { if (rootRef.current) rootRef.current.getWorldPosition(crew.rigPos); });
  return (
    <group ref={rootRef} scale={scale}>
      {assignments.map(({ role, spot, scene: sc }) => (
        <Worker key={role.id} role={role} spot={spot} scene={sc} sceneObj={scene} animations={animations} rigScene={rigScene} gates={gates} panelRef={panelRef} crew={crew} onTap={toggleBrief} wheelSpinRef={wheelSpinRef} onValveTurn={onValveTurn} />
      ))}
      <Fireballs crew={crew} rootRef={rootRef} />
    </group>
  );
}

// ── Fireballs: a small pool flown in world space from a hand to the demon, then a burst.
function Fireballs({ crew, rootRef }) {
  const N = 4;
  const meshes = useRef([]);
  const pool = useRef(Array.from({ length: N }, () => ({ active: false, t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), burst: 0 })));
  const geo = useMemo(() => new THREE.SphereGeometry(0.2, 10, 8), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  useEffect(() => { crew.fire = (from, to) => { const b = pool.current.find((x) => !x.active) || pool.current[0]; b.active = true; b.t = 0; b.burst = 0; b.from.copy(from); b.to.copy(to); }; return () => { crew.fire = null; }; }, [crew]);
  const _w = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const root = rootRef.current; if (!root) return;
    pool.current.forEach((b, i) => {
      const m = meshes.current[i]; if (!m) return;
      if (!b.active) { m.visible = false; return; }
      m.visible = true;
      if (b.burst > 0) {
        b.burst += delta; const u = Math.min(1, b.burst / 0.25);
        m.scale.setScalar(1 + 2.5 * u); m.material.opacity = 0.95 * (1 - u);
        if (u >= 1) { b.active = false; m.material.opacity = 0.95; m.scale.setScalar(1); }
        return;
      }
      b.t += delta; const u = Math.min(1, b.t / FIREBALL_FLIGHT_S);
      _w.lerpVectors(b.from, b.to, u); _w.y += Math.sin(u * Math.PI) * 0.12; // a little lob (world units)
      root.worldToLocal(m.position.copy(_w));
      m.scale.setScalar(1 + 0.3 * Math.sin(b.t * 40));
      if (u >= 1) b.burst = 1e-6;
    });
  });
  return <>{Array.from({ length: N }, (_, i) => <mesh key={i} ref={(el) => { meshes.current[i] = el; }} geometry={geo} material={mat.clone()} visible={false} frustumCulled={false} />)}</>;
}

const _headPos = new THREE.Vector3(), _to = new THREE.Vector3(), _face = new THREE.Vector3(), _right = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _parentQ = new THREE.Quaternion(), _worldQ = new THREE.Quaternion(), _yawQ = new THREE.Quaternion(), _pitchQ = new THREE.Quaternion(), _groupQ = new THREE.Quaternion();

function Worker({ role, spot, scene, sceneObj, animations, rigScene, gates, panelRef, crew, onTap, wheelSpinRef, onValveTurn }) {
  const groupRef = useRef();
  const onValveTurnRef = useRef(onValveTurn); onValveTurnRef.current = onValveTurn;   // read in useFrame without a stale closure
  const [bubble, setBubble] = useState(null);
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(sceneObj);
    c.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; }); // skinned bounds are stale
    return c;
  }, [sceneObj]);
  const props = useMemo(() => { const m = {}; clone.traverse((o) => { if (o.name && o.name.startsWith("Prop_")) m[o.name] = o; }); return m; }, [clone]);
  const headBone = useMemo(() => clone.getObjectByName("head") || null, [clone]);
  const handR = useMemo(() => clone.getObjectByName("hand_r") || null, [clone]);

  // Manual mixer (same pattern as the field demon); geometry/materials are shared with
  // the cached GLB, so cleanup only detaches the mixer.
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clone);
    const map = {};
    (animations || []).forEach((clip) => { map[clip.name] = mixer.clipAction(clip); });
    mixerRef.current = mixer; actionsRef.current = map;
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(clone); mixerRef.current = null; actionsRef.current = {}; };
  }, [clone, animations]);

  // Per-frame state lives in a ref: spot, pose, current act, phase of a scripted move, mode.
  const st = useRef(null);
  if (st.current === null) {
    const s = resolveStation(rigScene, spot);
    st.current = { spot, pos: s.pos.clone(), yaw: s.yaw, yawCur: s.yaw, yawAim: null, act: null, actEnds: 0, phase: "act", t: 0, decide: null, mode: null,
      topStay: 0, nextThrowAt: 0, throwAt: 0, nextGesture: 0, head: new THREE.Vector3(), frames: 0,
      look: { yaw: 0, pitch: 0, lastOut: null, lastClean: null, hasLast: false } };
  }
  useEffect(() => { crew.workers[role.id] = st.current; return () => { delete crew.workers[role.id]; }; }, [crew, role.id]);

  // Dev hook: window.__hmCrew.go("inspector", "ladder_base") drops a worker on a spot;
  // window.__hmCrew.state() lists where everyone is. Same spirit as window.__hmLamps.
  useEffect(() => {
    const reg = devHook(); if (!reg) return;
    reg.workers[role.id] = {
      go: (sp) => { if (!STATIONS[sp]) return false; const stn = resolveStation(rigScene, sp); const s = st.current; s.spot = sp; s.pos.copy(stn.pos); s.yaw = s.yawCur = stn.yaw; s.phase = "act"; s.act = null; s.topStay = 0; return true; },
      act: (a) => { if (!ACTS[a]) return false; startAct(a, st.current.now || 0); return true; },   // force an activity (e.g. "tablet")
      walk: (sp) => { if (!STATIONS[sp]) return false; slideTo(sp, SLIDE_S, "idle"); return true; },   // walk to a spot in a straight line (preview only: no pathing round the rig)
      state: () => { const s = st.current; const g = groupRef.current; const gw = new THREE.Vector3(); if (g) g.getWorldPosition(gw); const sc = g ? g.getWorldScale(new THREE.Vector3()).y : 1;
        return { spot: s.spot, act: s.act, mode: s.mode, phase: s.phase, scene: scene || null, yaw: +s.yawCur.toFixed(2), yawAim: s.yawAim == null ? null : +s.yawAim.toFixed(2), headUp: +((s.head.y - gw.y) / (sc || 1)).toFixed(3),
        props: Object.fromEntries(Object.entries(props).map(([n, o]) => { const w = new THREE.Vector3(); o.getWorldPosition(w); return [n, { visible: o.visible, verts: o.geometry?.attributes?.position?.count || 0, world: w.toArray().map((v) => +v.toFixed(3)) }]; })), chat: crew.chat ? { talker: crew.chat.talker, swapAt: +crew.chat.swapAt.toFixed(2) } : null, t: +s.t.toFixed(3), pos: s.pos.toArray().map((v) => +v.toFixed(3)), frames: s.frames, now: +(s.now || 0).toFixed(2), nextThrowAt: +(s.nextThrowAt || 0).toFixed(2), throws: s.throws || 0, fired: s.fired || 0, dist: s.dbgDist == null ? null : +s.dbgDist.toFixed(2), running: !!(s.action && s.action.isRunning()), fromRig: resolveStation(rigScene, s.spot).fromRig, trace: s.trace || [], head: s.head.toArray().map((v) => +v.toFixed(3)), valveVents: s.valveVents || 0,
        wheel: (() => { const w = rigScene.getObjectByName("Wheel"); if (!w) return null; const q = w.getWorldQuaternion(new THREE.Quaternion()); const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q); return { rotY: +w.rotation.y.toFixed(3), localYWorld: ax.toArray().map((v) => +v.toFixed(3)), actTime: s.act === "valve" && s.action ? +s.action.time.toFixed(2) : null }; })() }; },
    };
    return () => { delete reg.workers[role.id]; };
  }, [role.id, rigScene, scene, crew]);

  // The operator answers the player's decision when it is at the panel.
  useEffect(() => {
    if (role.id !== "operator") return;
    const on = (e) => { st.current.decide = e?.detail?.action === "extract" ? "panel_extract" : "panel_pass"; };
    window.addEventListener("hm:decide", on);
    return () => window.removeEventListener("hm:decide", on);
  }, [role.id]);

  const play = (name, { once = false, timeScale = 1, fromEnd = false } = {}) => {
    const actions = actionsRef.current; const a = actions[name];
    if (!a) return null;
    // Retire every other clip that still carries weight — a finished one-shot is paused at its
    // last frame (clampWhenFinished) and is NOT "running", yet keeps full weight; left alone it
    // blends 50/50 with the next clip (the half-crouch after the doze scramble).
    const live = (o) => o !== a && o.enabled && (o.isRunning() || o.getEffectiveWeight() > 0);
    Object.values(actions).forEach((o) => { if (live(o)) o.fadeOut(FADE); });
    const others = Object.values(actions).some(live);
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once; a.timeScale = timeScale; a.enabled = true;
    if (fromEnd) a.time = a.getClip().duration;
    if (others) a.fadeIn(FADE); else a.setEffectiveWeight(1);   // nothing to blend from → no fade (a weight fade blends from the bind pose)
    a.play();
    return a;
  };
  const showProps = (act) => { const want = ACTS[act]?.props || []; Object.entries(props).forEach(([name, node]) => { node.visible = want.includes(name); }); };
  const startAct = (act, now, dwell) => {
    const s = st.current; const def = ACTS[act] || ACTS.idle;
    s.act = act; s.phase = "act"; s.replayAt = 0; s.wheelBase = null; s.action = play(def.clip, { once: !!def.once, timeScale: def.reverse ? -1 : 1, fromEnd: !!def.reverse });
    s.actEnds = def.once || def.forever ? Infinity : now + (dwell ?? rand(def.dwell[0], def.dwell[1]));
    showProps(act);
  };
  const menuAct = (now) => {
    const s = st.current; const menu = MENU[s.spot];
    const acts = s.awake && menu.awake ? menu.awake : menu.acts;                       // a caught dozer never dozes again this sighting
    const items = acts.map(([a, w]) => [a, actWeight(a, w, gates) * (a === s.act && acts.length > 1 ? 0.35 : 1)]);
    const pick = pickWeighted(Math.random, items) || "idle";
    startAct(pick, now);
    if (pick === "doze") s.dozeUntil = now + rand(...DOZE_CAUGHT);
  };
  // The boss showed up: scramble up from the seat (crew_cower played backwards) and get to work.
  // The boss showed up. crew_getUp starts from the doze's END pose, so a wake-up that lands mid-nod
  // is queued until the current pass finishes (≤ 1.9 s); from the held last frame the switch is exact.
  const wakeUp = (now, then = null) => {
    const s = st.current;
    if (s.act === "doze" && s.action?.isRunning()) { s.wakeQueued = { then }; return; }
    s.wakeQueued = null; s.awake = true; s.wakeTo = then; startAct(actionsRef.current["crew_getUp"] ? "getUp" : "uncower", now);
  };
  const nextAct = (now) => {
    const s = st.current; const menu = MENU[s.spot];
    if (menu.climbTo && s.act) { beginClimb(now); return; }           // ladder: one dwell at the base, then climb
    if (menu.descendTo && now >= s.topStay) { beginDescend(now); return; }
    menuAct(now);
  };
  // Move to another spot: walk there (crew_walk, facing the way, at the clip's stride speed) when it
  // is far enough to take a step; tiny moves (the panel buttons, the ladder landing) stay a glide.
  const slideTo = (spotId, seconds, afterSlide) => {
    const s = st.current; const stn = resolveStation(rigScene, spotId);
    s.t = 0; s.from = s.pos.clone(); s.to = stn.pos.clone(); s.target = stn; s.nextSpot = spotId; s.afterSlide = afterSlide;
    const dist = Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z);
    if (dist >= WALK_MIN && actionsRef.current["crew_walk"]) {
      s.phase = "walk"; s.slideS = dist / WALK_SPEED; s.yaw = Math.atan2(-(s.to.z - s.from.z), s.to.x - s.from.x);
      s.act = "walk"; s.action = play("crew_walk"); showProps("walk");
    } else { s.phase = "slide"; s.slideS = seconds; s.action = play("crew_idle"); showProps("idle"); }
  };
  const climbRate = () => {
    const base = resolveStation(rigScene, "ladder_base");
    const rise = Number(base.extras?.hm_climb_rise_m) || CLIMB_RISE_FALLBACK;
    const clip = actionsRef.current["crew_climb"]?.getClip(); return rise / (clip?.duration || 0.8);
  };
  const beginClimb = () => { const s = st.current; const top = resolveStation(rigScene, MENU[s.spot].climbTo); s.phase = "climbUp"; s.target = top; s.act = "climb"; s.action = play("crew_climb"); showProps("climb"); };
  const landingOf = (base) => new THREE.Vector3(base.pos.x + Math.cos(base.yaw) * TOP_FWD_END, base.pos.y + (resolveStation(rigScene, "ladder_top").pos.y - base.pos.y), base.pos.z - Math.sin(base.yaw) * TOP_FWD_END);
  const beginDescend = () => {
    const s = st.current; const base = resolveStation(rigScene, MENU[s.spot].descendTo);
    s.phase = "stepOut"; s.t = 0; s.from = s.pos.clone(); s.target = base;
    s.to = landingOf(base); s.act = "idle"; s.action = play("crew_idle"); showProps("idle");
  };
  const topMove = (u) => {                                   // group along the top-of-ladder path, u = clip progress 0..1
    const s = st.current; const [f, up] = topPathAt(u);
    s.pos.set(s.from.x + Math.cos(s.yaw) * f, s.from.y + up, s.from.z - Math.sin(s.yaw) * f);
  };

  // ── modes ────────────────────────────────────────────────────────────────────────
  const demonNear = () => {
    const f = devHook()?.force || {};
    const D = f.demon || window.__hmDemonState;
    if (!D || D.done) return null;
    const dist = Math.hypot(D.x - crew.rigPos.x, D.z - crew.rigPos.z);
    return dist < CREW_ALERT_RANGE ? { x: D.x, y: D.y ?? crew.rigPos.y, z: D.z, dist } : null;
  };
  const wantMode = (now) => {
    const f = devHook()?.force || {};
    if (crew.cowerUntil > Date.now() || f.hell) return "cower";
    if (demonNear()) return "defend";
    if (gates.hell) return "alert";
    if (crew.gusher || f.celebrate) return "celebrate";
    if (crew.brief) return crew.brief.talker === role.id ? "brief" : "listen";
    if (scene === "chat" && crew.chat) return crew.chat.talker === role.id ? "chat" : "chatListen";
    if (scene === "chat") return "chatListen";
    if (window.__hmMusicOn || f.music) return "music";
    return null;
  };
  const enterMode = (mode, now) => {
    const s = st.current; const old = s.mode; s.mode = mode; s.yawAim = null;
    if (old === "brief") setBubble(null);
    if (old === "cower" && mode !== "cower") { startAct("uncower", now); return; }   // stand back up first
    if (s.act === "doze" && mode !== "cower") { wakeUp(now, mode); return; }         // caught napping: scramble, then do the thing
    if (mode === "cower") { startAct("cower", now); s.actEnds = Infinity; }
    else if (mode === "defend") { startAct("ninja", now, 999); s.nextThrowAt = now + rand(0.5, 2); }   // guard stance between throws
    else if (mode === "alert") startAct("nervous", now, 999);
    else if (mode === "celebrate") startAct("clap", now);
    else if (mode === "brief") { startAct("wave", now); setBubble("Hey, boss."); crew.brief.i = 0; crew.brief.nextLineAt = now + BRIEF_GREET_S; }   // greet, then each line brings its own gesture (modeTick)
    else if (mode === "listen" || mode === "chatListen") { startAct("idle", now, 999); s.nextGesture = now + rand(2, 5); }
    else if (mode === "chat") startAct("talking", now, 999);
    else if (mode === "music") startAct("music", now, 999);
    else if (mode === null) menuAct(now);
  };
  const modeNext = (mode, now) => {                                     // an act ended inside a mode
    const s = st.current;
    if (mode === "cower") { s.actEnds = Infinity; return; }             // hold the curl
    if (mode === "defend") startAct("ninja", now, 999);
    else if (mode === "alert") startAct("nervous", now, 999);
    else if (mode === "celebrate") startAct(s.act === "clap" ? (Math.random() < 0.5 ? "victory1" : "victory2") : "clap", now);
    else if (mode === "brief") startAct("idle", now, 999);                 // a reply gesture ended: hold until the next line
    else if (mode === "chat") startAct("talking", now, 999);
    else if (mode === "listen" || mode === "chatListen") { startAct("idle", now, 999); s.nextGesture = now + rand(2.5, 6); }
    else if (mode === "music") startAct("music", now, 999);
    else nextAct(now);
  };
  const faceWorld = (x, y, z) => {
    const s = st.current; const parent = groupRef.current?.parent; if (!parent) return;
    _tmp.set(x, y, z); parent.worldToLocal(_tmp); s.yawAim = Math.atan2(-(_tmp.z - s.pos.z), _tmp.x - s.pos.x);
  };
  const partner = () => { const o = Object.entries(crew.workers).find(([k]) => k !== role.id); return o ? o[1] : null; };
  const modeTick = (mode, now, dt, state) => {
    const s = st.current;
    if (mode === "defend") {
      const D = demonNear(); if (!D) return;
      faceWorld(D.x, D.y, D.z);
      s.dbgDist = D.dist;
      if (s.act !== "throw" && D.dist < CREW_THROW_RANGE && now >= s.nextThrowAt) { startAct("throw", now); s.throws = (s.throws || 0) + 1; s.throwAt = now + THROW_RELEASE_S; s.nextThrowAt = now + rand(3, 5); }
      if (s.act === "throw" && s.throwAt && now >= s.throwAt) {
        s.throwAt = 0;
        if (handR && crew.fire) { handR.getWorldPosition(_tmp); crew.fire(_tmp, new THREE.Vector3(D.x, D.y + 0.08, D.z)); s.fired = (s.fired || 0) + 1; }
        if (CREW_THROWS_COUNT && groupRef.current) { groupRef.current.getWorldPosition(_tmp); window.dispatchEvent(new CustomEvent("hm-shoot", { detail: { x: _tmp.x, y: _tmp.y, z: _tmp.z, source: "crew" } })); }
      }
    } else if (mode === "brief") {
      const c = state.camera.position; faceWorld(c.x, c.y, c.z);          // turn to the player
      const b = crew.brief; if (!b) return;
      if (now >= b.nextLineAt) {
        if (b.i >= b.lines.length) { crew.brief = null; return; }
        setBubble(b.lines[b.i]); startAct(briefGesture(b.tones?.[b.i], b.lines[b.i]), now); b.i += 1; b.nextLineAt = now + BRIEF_LINE_S;
      }
    } else if (mode === "listen" || mode === "chatListen") {
      if (mode === "listen") { const t = partner(); if (t) faceWorld(t.head.x, t.head.y, t.head.z); }   // turn to the one briefing
      if (mode === "chatListen" && !crew.chat) crew.chat = { talker: role.id, swapAt: now + rand(...CHAT_TURN) };   // first to notice opens the conversation
      if (s.act === "idle" && now >= s.nextGesture) startAct(Math.random() < 0.65 ? "acknowledge" : "shrug", now);
    } else if (mode === "chat") {
      if (!crew.chat || now >= crew.chat.swapAt) { const other = Object.keys(crew.workers).find((k) => k !== role.id) || role.id; crew.chat = { talker: other, swapAt: now + rand(...CHAT_TURN) }; }
    }
  };

  useFrame((state, delta) => {
    const mixer = mixerRef.current; const s = st.current; const g = groupRef.current;
    if (!mixer || !g) return;
    // Own sim clock: frame deltas (capped), times a dev fast-forward (window.__hmCrew.force.timeScale).
    // Timers below compare against it, so a hidden tab or a stalled loop never skips a beat.
    const dt = Math.min(delta, 1 / 30) * (devHook()?.force?.timeScale || 1);
    s.now = (s.now || 0) + dt; const now = s.now;
    s.frames += 1;
    if (s.phase !== s.tracePhase) {                            // dev: phase transitions, read via window.__hmCrew.state().<role>.trace
      s.tracePhase = s.phase; (s.trace ||= []).push({ now: +now.toFixed(2), phase: s.phase, act: s.act, pos: s.pos.toArray().map((v) => +v.toFixed(3)) });
      if (s.trace.length > 40) s.trace.shift();
    }
    mixer.update(dt);
    if (headBone) headBone.getWorldPosition(s.head);
    if (s.act === "valve" && s.action) {                       // the handwheel turns with the hands; same node + axis as the click-to-spin
      if (s.wheelBase == null) {                                 // cleared by startAct: each valve act carries on from where the wheel is
        s.wheel = rigScene.getObjectByName("Wheel") || null;     // looked up per act — the rig scene can be re-cloned under us
        s.wheelBase = wheelSpinRef?.current ?? s.wheel?.rotation.y ?? 0; s.valvePulls = 0;
      }
      const pulled = VALVE_PULLS.filter(([t0]) => s.action.time >= t0).length;   // each pull vents the chimney, like a click on the wheel
      if (pulled > s.valvePulls) { s.valvePulls = pulled; s.valveVents = (s.valveVents || 0) + 1; onValveTurnRef.current?.(); }
      if (s.wheel) {
        s.wheel.rotation.y = s.wheelBase + VALVE_SIGN * valveAngleAt(s.action.time);
        if (wheelSpinRef) wheelSpinRef.current = s.wheel.rotation.y;   // so the click-to-spin lerp agrees instead of fighting
      }
    }
    if (s.act === null) menuAct(now);

    const panelOpen = !!(panelRef?.current?.open || panelRef?.current?.ref?.current);
    if (s.phase === "act") {
      const finished = s.action && ACTS[s.act]?.once && !s.action.isRunning();
      // mode changes only between scripted moves; a finished stand-up (uncower) clears the way
      const want = wantMode(now);
      if (want !== s.mode && s.act !== "push" && !((s.act === "uncower" || s.act === "getUp") && !finished)) enterMode(want, now);
      else if (s.decide && zoneOf(s.spot) === "panel" && s.act !== "push" && s.mode === null) {
        const tgt = s.decide; s.decide = null;
        if (tgt === s.spot) startAct("push", now); else slideTo(tgt, SLIDE_S, "push");
      } else if (s.decide) { s.decide = null; }
      else if (s.mode === null && panelOpen && PANEL_BUTTONS.has(s.spot) && s.act !== "push") { s.returnSpot = s.spot; slideTo("panel_aside", ASIDE_S, "idle"); }   // out of the player's way
      else if (s.mode === null && !panelOpen && s.spot === "panel_aside" && s.act !== "push") { slideTo(s.returnSpot || "panel_pass", ASIDE_S, "idle"); }
      else {
        modeTick(s.mode, now, dt, state);
        const def = ACTS[s.act];
        if (def?.holdBetween) {                                             // one pass, hold the last frame, another pass
          if (s.act === "doze" && s.wakeQueued && !s.action?.isRunning()) { const q = s.wakeQueued; wakeUp(now, q.then); }
          else if (s.act === "doze" && s.dozeUntil && now >= s.dozeUntil) wakeUp(now);
          else if (finished && !s.replayAt) s.replayAt = now + rand(...def.holdBetween);
          else if (s.replayAt && now >= s.replayAt) { s.replayAt = 0; s.action.reset(); s.action.play(); }
        } else if (finished || now >= s.actEnds) {
          if (s.act === "uncower" || s.act === "getUp") { const to = s.wakeTo; s.wakeTo = null; if (to) { s.mode = null; enterMode(to, now); } else { s.mode = null; menuAct(now); } }
          else modeNext(s.mode, now);
        }
      }
    } else if (s.phase === "slide") {
      s.t += dt; const u = Math.min(1, s.t / (s.slideS || SLIDE_S)); const e = u * u * (3 - 2 * u);
      s.pos.lerpVectors(s.from, s.to, e); s.yaw = s.target.yaw;
      if (u >= 1) { s.spot = s.nextSpot; startAct(s.afterSlide || "idle", now); }
    } else if (s.phase === "walk") {                              // constant speed so the planted foot stays planted; turn to the spot's facing on arrival
      s.t += dt; const u = Math.min(1, s.t / s.slideS);
      s.pos.lerpVectors(s.from, s.to, u);
      if (u >= 1) { s.spot = s.nextSpot; s.yaw = s.target.yaw; startAct(s.afterSlide || "idle", now); }
    } else if (s.phase === "climbUp") {
      const stopY = s.target.pos.y - LANDING_RISE;             // the top clip climbs the last 0.48 itself
      s.pos.y = Math.min(stopY, s.pos.y + climbRate() * dt);
      if (s.pos.y >= stopY - 1e-4) { s.phase = "topIn"; s.from = s.pos.clone(); s.act = "topOfLadder"; s.action = play(TOP_CLIP, { once: true }); showProps("climb"); }
    } else if (s.phase === "topIn") {                            // climbing pose → standing on the landing, group riding the clip's root path
      const dur = s.action?.getClip().duration || 4; const u = Math.min(1, (s.action?.time || 0) / dur); topMove(u);
      if (u >= 1 || !s.action?.isRunning()) { topMove(1); const top = MENU[s.spot].climbTo; s.topStay = now + rand(40, 90); slideTo(top, 0.35, "idle"); }
    } else if (s.phase === "stepOut") {                          // top station → the landing point (a short walk-less slide)
      s.t += dt; const u = Math.min(1, s.t / 0.35); const e = u * u * (3 - 2 * u);
      s.pos.lerpVectors(s.from, s.to, e); s.yaw = s.target.yaw;
      if (u >= 1) { s.phase = "topOut"; s.from = s.to.clone().sub(new THREE.Vector3(Math.cos(s.yaw) * TOP_FWD_END, LANDING_RISE, -Math.sin(s.yaw) * TOP_FWD_END)); s.act = "topOfLadder"; s.action = play(TOP_CLIP, { once: true, timeScale: -1, fromEnd: true }); showProps("climb"); }
    } else if (s.phase === "topOut") {                           // the same clip backwards: standing → hanging on the ladder
      const dur = s.action?.getClip().duration || 4; const u = Math.max(0, (s.action?.time ?? 0) / dur); topMove(u);
      if (u <= 0 || !s.action?.isRunning()) { topMove(0); s.phase = "climbDown"; s.act = "climb"; s.action = play("crew_climb", { timeScale: -1 }); showProps("climb"); }
    } else if (s.phase === "climbDown") {
      s.pos.y = Math.max(s.target.pos.y, s.pos.y - climbRate() * dt);
      if (s.pos.y <= s.target.pos.y + 1e-4) {
        s.spot = MENU[s.spot].descendTo; s.pos.copy(s.target.pos); s.yaw = s.target.yaw;
        startAct("idle", now); s.actEnds = now + rand(20, 40); // rest at the base before the next climb
      }
    }
    // body yaw: the station's facing, or eased toward a demon while defending
    const yawT = s.yawAim ?? s.yaw;
    s.yawCur += wrapAngle(yawT - s.yawCur) * (1 - Math.exp(-BODY_TURN_EASE * dt));
    g.position.copy(s.pos); g.rotation.y = s.yawCur;

    // head: look at the point of interest (mode first, then the spot's), eased and clamped
    if (!headBone || window.__hmLowGfx) return;
    const t = s.look;
    let targetYaw = 0, targetPitch = 0;
    let lookAt = null;
    if (s.mode === "defend") lookAt = "demon";
    else if (s.mode === "celebrate") lookAt = "head_pump";
    else if (s.mode === "brief") lookAt = "camera";
    else if (s.mode === "listen" || s.mode === "chat" || s.mode === "chatListen") lookAt = "partner";
    else if (s.mode === null && ACTS[s.act]?.look) lookAt = MENU[s.spot]?.look || null;
    if (lookAt) {
      headBone.getWorldPosition(_headPos);
      let ok = false;
      if (lookAt === "camera") { _to.copy(state.camera.position).sub(_headPos); ok = true; }
      else if (lookAt === "head_pump") { const hp = rigScene.getObjectByName("Head_Pump"); if (hp) { hp.getWorldPosition(_to); _to.sub(_headPos); ok = true; } }
      else if (lookAt === "demon") { const D = demonNear(); if (D) { _to.set(D.x, D.y + 0.1, D.z).sub(_headPos); ok = true; } }
      else if (lookAt === "partner") { const o = Object.entries(crew.workers).find(([k]) => k !== role.id); if (o) { _to.copy(o[1].head).sub(_headPos); ok = true; } }
      if (ok) {
        g.getWorldQuaternion(_groupQ); _face.set(1, 0, 0).applyQuaternion(_groupQ); _face.y = 0; _face.normalize();
        const flat = Math.hypot(_to.x, _to.z);
        targetPitch = THREE.MathUtils.clamp(Math.atan2(_to.y, flat), -HEAD_PITCH_DOWN, HEAD_PITCH_UP);
        targetYaw = THREE.MathUtils.clamp(wrapAngle(Math.atan2(_to.x, _to.z) - Math.atan2(_face.x, _face.z)), -HEAD_YAW, HEAD_YAW);
      }
    }
    const k = 1 - Math.exp(-HEAD_EASE * dt);
    t.yaw += (targetYaw - t.yaw) * k; t.pitch += (targetPitch - t.pitch) * k;
    if (Math.abs(t.yaw) >= 1e-4 || Math.abs(t.pitch) >= 1e-4) {
      // If the bone still holds what we wrote last frame, restore the clean animated pose first
      // (the mixer does not rewrite every bone every frame) — else the delta compounds.
      if (!t.lastOut) { t.lastOut = new THREE.Quaternion(); t.lastClean = new THREE.Quaternion(); }
      if (t.hasLast && headBone.quaternion.equals(t.lastOut)) headBone.quaternion.copy(t.lastClean);
      t.lastClean.copy(headBone.quaternion);
      headBone.parent.getWorldQuaternion(_parentQ);
      _worldQ.copy(_parentQ).multiply(headBone.quaternion);
      g.getWorldQuaternion(_groupQ); _face.set(1, 0, 0).applyQuaternion(_groupQ); _face.y = 0; _face.normalize();
      _right.crossVectors(_UP, _face).normalize();
      _yawQ.setFromAxisAngle(_UP, t.yaw);
      _pitchQ.setFromAxisAngle(_right, -t.pitch);
      _worldQ.premultiply(_pitchQ).premultiply(_yawQ);
      headBone.quaternion.copy(_parentQ.invert().multiply(_worldQ));
      t.lastOut.copy(headBone.quaternion); t.hasLast = true;
    }
  });

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onTap?.(); }}>
      <primitive object={clone} />
      {bubble && (
        <Html center position={[0, 0.98, 0]} zIndexRange={[9999, 9999]} style={{ pointerEvents: "none" }}>
          <div style={bubbleStyle}>{bubble}</div>
        </Html>
      )}
    </group>
  );
}

const bubbleStyle = {
  fontFamily: "'Share Tech Mono', monospace", fontSize: 12, letterSpacing: "0.04em", lineHeight: 1.25,
  color: "#f3e7c3", background: "rgba(20, 14, 10, 0.86)", border: "1px solid rgba(243, 231, 195, 0.35)",
  padding: "6px 9px", borderRadius: 4, whiteSpace: "nowrap", maxWidth: 260, textAlign: "center",
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
};
