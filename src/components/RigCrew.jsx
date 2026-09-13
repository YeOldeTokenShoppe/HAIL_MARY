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
 * screen. Spots are chosen per sighting — a fresh roll each time (see assignments) so
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
import { VENDOR_SITEPAL_CONFIG, activateVendorSitePal, deactivateVendorSitePal, speakVendorText, onVendorTalk, getVendorSitePalSource } from "@/lib/vendorSitePal";
import { createProjectionState, disposeProjectionState, updateProjection } from "@/lib/sitepalFace";

export const CREW_GLB = "/models/crew_goblin.glb?v=16";
useGLTF.preload(CREW_GLB);

const CLIMB_RISE_FALLBACK = 0.219;  // crew_climb is in place; world rise per cycle (rig-GLB units) unless the
const CLIMB_RUNG0_FALLBACK = 0.262; // first rung centre above the base walkway (rig extras hm_climb_rung0_m override)
const CLIMB_PLANT_UP = 0.12;        // the left foot's peak above the group origin in crew_climb (frame 15 of 24), where it plants on a rung
const CLIMB_PLANT_FRAC = 15 / 24;   // …and where in the cycle that happens
const CLIMB_PLANT_BIAS = -0.04;     // aim the plant this far below the rung centre: the planted foot then rides up through the rung during its stance (the clip's stance drop is half the rung pitch), so it reads as ON the rung mid-stance rather than floating above it
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
const SEAT_BACK_OFFSET = 0.20;    // seat markers mark the worker's BACK (put them at the rail): the spot's origin sits this far forward along +X, which puts the floor-sit's back (0.19 behind the origin) a centimetre in front of the marker; crew_getUp stands up onto the origin
const TUNE_SPOT = "panel_pass";      // ?tune=vendor CREW tab parks the briefer here, facing the camera (the page flies in on hm:crew-face)
const CREW_ALERT_RANGE = 3.0;       // world units (cells): demon this close → defend
const CREW_THROW_RANGE = 2.5;
const CREW_THROWS_COUNT = true;     // a throw lands as a walker shot ("hm-shoot") — only inside the demon's open window (see modeTick), so the crew never triggers its counter
const CREW_HIT_RANGE = 2.0;         // world units: the field demon's own walker hit range (DEMON_WALKER_HIT_RANGE in OilVoxelGrid.jsx)
const THROW_RELEASE_S = 0.83;       // frame 25 of crew_throw: the right hand lets go
const FIREBALL_FLIGHT_S = 0.45;
const COWER_HOLD_MS = 4500;         // how long a cower is held after its trigger
const HELL_COWER_MS = 6000;
const CELEBRATE_LINGER_S = 3.5;         // the crew keeps celebrating this long after a gusher/motherlode column drops
const CELEBRATE_LINGER_STRIKE_S = 1.5;  // …and after a small strike
const CHAT_TURN = [8, 12];          // seconds each talker holds the floor
const WALK_SPEED = 0.518;           // rig units/s: crew_walk is in place; this is the stance foot's slide speed measured in Blender (32 f at 30 fps)
const WALK_MIN = 0.12;              // moves shorter than this stay a glide (a shuffle, not a walk)
const BRIEF_LINE_S = 3.2;
const BRIEF_GREET_S = 2.2;          // the operator waves at the boss this long before the first line (or until the opener is spoken)
// How long a phrase may take to START playing before the briefing gives up on the voice and
// paces by timer alone (2026-09-12). ElevenLabs through SitePal can take 3–6 s to synthesize a
// line it has not cached; the old rule moved on after BRIEF_LINE_S and the next sayText cancelled
// the phrase still loading — "the first or second phrase can't be heard" (Michelle).
const SPEECH_START_S = 8;
// What the briefer says around the report (spoken through SitePal in the goblin voice, shown in
// the bubble either way). Short and boss-facing; SitePal caches TTS by text, so re-word rather
// than re-voice. Openers go with the wave, closers get a nod.
const CREW_OPENERS = ["Hey, boss.", "Boss! Didn't see you there.", "There you are, boss.", "Boss. Got the numbers right here.", "Boss, good timing.", "Morning, boss. Well — whatever it is out here."];
const CREW_CLOSERS = ["That's the lot, boss.", "That's all I've got. Back to it.", "Nothing else to report, boss.", "Rig's yours, boss."];
// Strangers (signed out, or at somebody else's claim) get the brush-off instead: one opener,
// one line, one closer, no wave — the boss treatment is for the claim owner at their own rig.
const CREW_BRUSHOFF = {
  openers: ["Who're you?", "You lost, pal?", "This ain't your rig.", "Boss ain't here. And you ain't the boss."],
  lines: ["Company business. Move along.", "Nothing to see here. Go on.", "Tour's over, friend.", "We don't take questions from tourists.", "Sign the book at the office if you want numbers."],
  closers: ["Get off my platform.", "Don't touch nothin'.", "Go on, git.", "Mind the pump on your way out."],
};
let lastRude = [-1, -1, -1];
let lastRudeGesture = "yell";
let lastOpener = -1, lastCloser = -1;
const pickLine = (pool, last) => { let i = Math.floor(Math.random() * pool.length); if (pool.length > 1 && i === last) i = (i + 1) % pool.length; return i; };
const DOZE_CAUGHT = [3, 6];          // seconds the boss gets to catch a dozer before they scramble up to work
const _UP = new THREE.Vector3(0, 1, 0);

// Station fallbacks — rig-GLB units, three.js axes, yaw = rotation.y (local +X = facing).
const STATIONS = {
  panel_pass:       { node: "Crew_Panel_Pass",       pos: [0.655, 0.245, 0.863],  yaw: 3.036 },
  panel_extract:    { node: "Crew_Panel_Extract",    pos: [0.655, 0.245, 1.035],  yaw: 3.036 },
  panel_aside:      { node: "Crew_Panel_Aside",      pos: [0.655, 0.245, 0.38],   yaw: 3.036 }, // beside the key-switch face, clear of the panel camera
  ladder_base:      { node: "Crew_Ladder_Base",      pos: [-0.697, 0.236, 0.755], yaw: -0.054 },
  ladder_top:       { node: "Crew_Ladder_Top",       pos: [-0.45, 1.725, 0.76],   yaw: -0.054 },
  motor:            { node: "Crew_Motor",            pos: [0.516, 0.236, -0.70],  yaw: Math.PI },
  rail_doze:        { node: "Crew_Rail_Doze",        pos: [0.45, 0.236, -2.157],  yaw: -Math.PI / 2, seatBack: true }, // marker at the north walkway rail
  rail_doze_top:    { node: "Crew_Rail_Doze_Top",    pos: [0.35, 1.725, 0.369],   yaw: -Math.PI / 2, seatBack: true }, // marker on the platform's north rail (x 0.35 keeps the helmet out of the beam when standing up)
  rail_doze2:       { node: "Crew_Rail_Doze2",       pos: [-1.0, 0.236, -2.041],  yaw: 0.067,        seatBack: true }, // north-west corner, back to the west rail
  rail_doze3:       { node: "Crew_Rail_Doze3",       pos: [-0.131, 0.236, 0.122], yaw: -Math.PI / 2, seatBack: true }, // under the walking beam
  platform_lookout: { node: "Crew_Lookout",          pos: [0.363, 1.725, 0.653],  yaw: -Math.PI / 2 },
  valve:            { node: "Crew_Valve",            pos: [-1.05, 0, 2.44],       yaw: Math.PI / 2 },   // south of the riser handwheel (hub 0.55 up, rim 0.19 ahead), facing it
  wellhead:         { node: "Crew_Wellhead",         pos: [0.556, 0, 2.092],      yaw: Math.PI },     // east of the well curb, on the ground
  chat_a:           { node: "Crew_Chat_A",           pos: [0.155, 0.236, -1.821], yaw: Math.PI },      // two workers facing each other on the north walkway, 0.5 apart
  chat_b:           { node: "Crew_Chat_B",           pos: [-0.345, 0.236, -1.821], yaw: 0 },
  chat_c:           { node: "Crew_Chat_C",           pos: [-0.751, 0.236, -1.799], yaw: -Math.PI / 2 }, // second pair on the west walkway, facing each other
  chat_d:           { node: "Crew_Chat_D",           pos: [-0.754, 0.236, -1.299], yaw: Math.PI / 2 },
};
const CHAT_PAIRS = [["chat_a", "chat_b"], ["chat_c", "chat_d"]];   // [operator's spot, inspector's spot]; a chat sighting picks one pair

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
  neutralIdle: { clip: "crew_neutralIdle",    dwell: [6, 14],  look: true, fallback: "idle" },   // the briefer between lines (her 2026-09-11 clip); idle if absent
  no:          { clip: "crew_no",             once: true,      look: true },   // briefing replies: nothing to report…
  yes:         { clip: "crew_yes",            once: true,      look: true },   // …good news…
  thoughtful:  { clip: "crew_thoughtful",     once: true,      look: true },   // …something to think about
  shrug:       { clip: "crew_shrug",          once: true,      look: true },
  scold:       { clip: "crew_scold",          once: true,      look: true, fallback: "no" },      // 2026-09-12: the brush-off, and outbursts in crew chat
  yell:        { clip: "crew_yell",           once: true,      look: true, fallback: "shrug" },   // 7.7 s — the next line's gesture cuts it
  clap:        { clip: "crew_clap",           dwell: [5, 9],   look: true },
  cheer:       { clip: "crew_cheer",          dwell: [4, 8],   look: true },   // unused: the take headbangs (head ±35° at ~4 nods/s)
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
  motor:            { acts: [["idle", 2], ["tablet", 2], ["thoughtful", 1]], look: "head_pump" },
  rail_doze:        { acts: [["doze", 1]], awake: [["idle", 2], ["tablet", 2]] },   // caught sleeping on the job; after the scramble, back to work here
  rail_doze_top:    { acts: [["doze", 1]], awake: [["idle", 2], ["tablet", 2]] },
  rail_doze2:       { acts: [["doze", 1]], awake: [["idle", 2], ["tablet", 2]] },
  rail_doze3:       { acts: [["doze", 1]], awake: [["idle", 2], ["tablet", 1]] },
  platform_lookout: { acts: [["idle", 2], ["tablet", 2], ["wave", 1], ["thoughtful", 1]], look: "head_pump" },
  ladder_base:      { acts: [["idle", 1]],                             look: "camera",    climbTo: "ladder_top" },
  ladder_top:       { acts: [["idle", 2], ["tablet", 1]],              look: "head_pump", descendTo: "ladder_base" },
  valve:            { acts: [["valve", 4], ["idle", 2], ["wave", 1]], look: "camera" },
  wellhead:         { acts: [["idle", 2], ["tablet", 1], ["thoughtful", 1]], look: "head_pump" },
  chat_a:           { acts: [["idle", 1]],                             look: "partner" },
  chat_b:           { acts: [["idle", 1]],                             look: "partner" },
  chat_c:           { acts: [["idle", 1]],                             look: "partner" },
  chat_d:           { acts: [["idle", 1]],                             look: "partner" },
};
// crew_neutralIdle (her 2026-09-11 clip): wherever a menu offers "idle" it now offers the square-
// stance idle at the same weight — the Mixamo idles all shift their weight onto one leg.
Object.values(MENU).forEach((m) => ["acts", "awake"].forEach((k) => {
  const list = m[k]; if (!list) return;
  const idle = list.find(([a]) => a === "idle");
  if (idle && !list.some(([a]) => a === "neutralIdle")) list.push(["neutralIdle", idle[1]]);
}));

// The crew roster: which spots each role is found at ([spot, weight]). The operator briefs.
const ROLES = [
  { id: "operator",  spots: [["panel_pass", 3], ["panel_extract", 1], ["motor", 1], ["wellhead", 1], ["valve", 1], ["platform_lookout", 1]], briefs: true },
  { id: "inspector", spots: [["ladder_base", 3], ["platform_lookout", 2], ["valve", 1], ["motor", 1], ["rail_doze", 1], ["rail_doze_top", 1], ["rail_doze2", 1], ["rail_doze3", 1]] },
  // The four doze spots together weigh 4 × 0.5 (spotWeight) against 7 of work by day: about one sighting in five finds the inspector asleep, spread over four places.
];
const CHAT_CHANCE = 0.25;           // share of sightings where the two are found chatting
// two workers never share the panel, nor the platform's east strip (the seat and the lookout overlap)
const zoneOf = (spot) => (spot.startsWith("panel_") ? "panel" : spot === "rail_doze_top" || spot === "platform_lookout" ? "platform_east" : spot);
const PANEL_BUTTONS = new Set(["panel_pass", "panel_extract"]);

// Gates: reweight spots/acts by the rig's state. night → dozing; hell → nobody dozes.
function spotWeight(spot, w, g) {
  if (spot.startsWith("rail_doze")) return g.hell ? 0 : w * (g.night ? 1.0 : g.stalled ? 1.5 : 0.5);   // night used to triple this — every night sighting was the same sleeper
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
const _wellHead = new THREE.Vector3();

// Step-turns (her 2026-09-12 clips, both RIGHT turns): a body-yaw change of TURN_MIN or more while
// standing plays crew_quarterTurn (< HALF_TURN_MIN) or crew_halfTurn instead of the feet-planted
// ease. The clips carry the turn in the root bone (Mixamo-style, plus ~15 cm of drift); at load
// the root's tracks are flattened to their first key (in place, no root yaw) and the ORIGINAL root
// yaw curve is kept as a normalized profile, so the page rotates the group along the clip's own
// timing and to whatever angle is actually needed. A left turn is the clip played backwards.
const TURN_MIN = 1.05;        // ≥ 60° turns step; less eases as before
const HALF_TURN_MIN = 2.1;    // ≥ 120° uses the half turn
const TURN_CLIPS = { quarter: "crew_quarterTurn", half: "crew_halfTurn" };
const TURN_ACTS = new Set(["idle", "neutralIdle", "talking", "music", "nervous", "clap"]);   // standing loops a turn may interrupt
const TURN_PROFILES = {};     // clip name → { total (rad, signed), p: Float32Array (yaw/total sampled 0..1) }
const _tq = new THREE.Quaternion(), _tq0 = new THREE.Quaternion(), _tv = new THREE.Vector3(), _tv0 = new THREE.Vector3(), _tup = new THREE.Vector3(0, 1, 0);
function patchTurnClips(animations, scene) {
  if (!animations || !scene) return;
  scene.updateMatrixWorld(true);
  const rootBone = scene.getObjectByName("root");
  const parentQ = new THREE.Quaternion(); if (rootBone?.parent) rootBone.parent.getWorldQuaternion(parentQ);
  Object.values(TURN_CLIPS).forEach((name) => {
    const clip = animations.find((c) => c.name === name); if (!clip || clip.userData?.hmTurnPatched) return;
    const qt = clip.tracks.find((t) => t.name === "root.quaternion"), pt = clip.tracks.find((t) => t.name === "root.position");
    if (!qt) return;
    // yaw of each key: signed angle, about world +Y, of the root's most horizontal axis vs key 0
    const n = qt.times.length, yaw = new Float32Array(n);
    _tq0.fromArray(qt.values, 0).premultiply(parentQ);
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)];
    const axis = axes.reduce((best, a) => { const h = a.clone().applyQuaternion(_tq0); h.y = 0; return h.length() > best.len ? { a, len: h.length() } : best; }, { a: axes[0], len: -1 }).a;
    _tv0.copy(axis).applyQuaternion(_tq0); _tv0.y = 0; _tv0.normalize();
    let acc = 0, prev = 0;
    for (let k = 0; k < n; k++) {
      _tq.fromArray(qt.values, k * 4).premultiply(parentQ);
      _tv.copy(axis).applyQuaternion(_tq); _tv.y = 0; _tv.normalize();
      const ang = Math.atan2(_tv0.clone().cross(_tv).dot(_tup), _tv0.dot(_tv));
      acc += wrapAngle(ang - prev); prev = ang; yaw[k] = acc;   // unwrapped: a half turn passes ±π
    }
    const total = yaw[n - 1], N = 32, prof = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * clip.duration; let k = 0; while (k < n - 2 && qt.times[k + 1] < t) k++;
      const t0 = qt.times[k], t1 = qt.times[k + 1] ?? t0, f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
      const y = yaw[k] + (yaw[Math.min(n - 1, k + 1)] - yaw[k]) * f;
      prof[i] = Math.abs(total) > 0.1 ? y / total : i / N;
    }
    TURN_PROFILES[name] = { total, p: prof };
    // flatten the root: hold key 0 for rotation AND position (the page owns yaw and place)
    for (let k = 1; k < n; k++) for (let j = 0; j < 4; j++) qt.values[k * 4 + j] = qt.values[j];
    if (pt) for (let k = 1; k < pt.times.length; k++) for (let j = 0; j < 3; j++) pt.values[k * 3 + j] = pt.values[j];
    clip.userData = { ...(clip.userData || {}), hmTurnPatched: true, hmTurnTotalDeg: +(total * 180 / Math.PI).toFixed(1) };
  });
}
// Normalized progress of the body yaw at playback progress u (0..1); a reversed clip runs the
// curve backwards from its end.
const turnProfile = (name, u, reverse) => {
  const P = TURN_PROFILES[name]; if (!P) return u;
  const f = (x) => { const i = Math.min(P.p.length - 1, Math.max(0, x * (P.p.length - 1))); const k = Math.floor(i), r = i - k; return P.p[k] + ((P.p[Math.min(P.p.length - 1, k + 1)] || P.p[k]) - P.p[k]) * r; };
  return reverse ? 1 - f(1 - u) : f(u);
};

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
  if (tone === "rude") { lastRudeGesture = lastRudeGesture === "scold" ? "yell" : "scold"; return lastRudeGesture; }   // alternate her scold / yell
  if (tone === "no" || tone === "yes" || tone === "thoughtful") return tone;
  if (/nothing new|no claim|signed out|pre-season|0% full/i.test(line)) return "no";
  if (/strike|drilled|BTR|unread|full/i.test(line)) return "yes";
  return "thoughtful";
};
const devHook = () => (typeof window === "undefined" ? null : (window.__hmCrew ||= { workers: {}, spots: Object.keys(STATIONS), force: {},
  go: (r, sp) => window.__hmCrew.workers[r]?.go(sp),
  act: (r, a) => window.__hmCrew.workers[r]?.act(a),
  walk: (r, sp) => window.__hmCrew.workers[r]?.walk(sp),
  climb: (r) => window.__hmCrew.workers[r]?.climb(),
  state: () => Object.fromEntries(Object.entries(window.__hmCrew.workers).map(([k, w]) => [k, w.state()])) }));

export default function RigCrew({ rigScene, scale = 1, enabled = true, plotKey = "rig", plotId = null, envPreset = null, hellActive = false, gusherActive = false, pausedRef = null, panelOpen = false, panelOpenRef = null, workers = 2, wheelSpinRef = null, onValveTurn = null, eruption = null }) {
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
      <CrewInner key={sighting} sighting={sighting} forceScene={forceScene} rigScene={rigScene} scale={scale} plotKey={plotKey} plotId={plotId} envPreset={envPreset} wheelSpinRef={wheelSpinRef} onValveTurn={onValveTurn} eruption={eruption}
        hellActive={hellActive} gusherActive={gusherActive} pausedRef={pausedRef} panelRef={panelRef} workers={workers} />
    </Suspense>
  );
}

function CrewInner({ sighting, forceScene, rigScene, scale, plotKey, plotId, envPreset, hellActive, gusherActive, pausedRef, panelRef, workers, wheelSpinRef, onValveTurn, eruption }) {
  const { scene, animations } = useGLTF(CREW_GLB);
  useMemo(() => { patchTurnClips(animations, scene); return animations; }, [animations, scene]);   // in-place step-turns + their yaw profiles
  const rootRef = useRef();
  const gates = useMemo(() => ({ night: envPreset === "night", hell: !!hellActive, stalled: !!pausedRef?.current }), [envPreset, hellActive, pausedRef]);
  // Shared crew state: worker registry (head positions for "partner" looks), the chat and
  // briefing scenes, the cower timer, the rig's world position, and the fireball pool.
  const crew = useRef({ workers: {}, chat: null, brief: null, cowerUntil: 0, rigPos: new THREE.Vector3(), gusher: false, gusherTier: null, wellPos: new THREE.Vector3(), hasWell: false, fire: null }).current;
  // crew.gusher / gusherTier are written every frame below from the rig's LIVE eruption, not at
  // render: a render landing mid-gusher must not blink the flag and restart everyone's reaction.
  const wellNodes = useMemo(() => ({ straw: rigScene?.getObjectByName("Straw") || null, head: rigScene?.getObjectByName("Head_Pump") || null }), [rigScene]);
  // Spots per worker for this sighting. Every sighting rolls fresh (a page load, the tab coming
  // back, a reroll): the old plot + 10-minute bucket seed made every reload for ten minutes show
  // the same crew, which read as "the same guy asleep again" (her note, 2026-09-11).
  const assignments = useMemo(() => {
    const rng = mulberry32(hash32(`${plotKey}|${sighting}|${Date.now()}|${Math.random()}`));
    const roles = ROLES.slice(0, workers);
    const forced = forceScene.current; forceScene.current = null;
    const chat = roles.length >= 2 && (forced === "chat" || (forced == null && rng() < CHAT_CHANCE));
    const pair = CHAT_PAIRS[Math.floor(rng() * CHAT_PAIRS.length)];
    const taken = new Set();
    return roles.map((role, k) => {
      if (chat) return { role, spot: pair[Math.min(k, pair.length - 1)], scene: "chat" };
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
    if (crew.brief) { crew.brief = null; deactivateVendorSitePal(); return; }
    const info = window.__hmBriefing;
    // The boss treatment is for the claim owner at their own rig (page.js publishes who is
    // signed in and where their claim is; plotId is the plot this rig stands on). Everyone
    // else — signed out, or poking at somebody else's claim — gets the brush-off.
    const boss = !!(info?.signedIn && info?.ownerPlot && plotId && info.ownerPlot === plotId);
    const talker = (assignments.find((a) => a.role.briefs) || assignments[0]).role.id;
    let lines, tones, opener;
    if (boss) {
      lines = (info?.lines || ["Rig's holding.", "Nothing new since your last visit."]).slice(0, 6);
      tones = (info?.tones || []).slice(0, 6);
      lastOpener = pickLine(CREW_OPENERS, lastOpener); lastCloser = pickLine(CREW_CLOSERS, lastCloser);
      lines.push(CREW_CLOSERS[lastCloser]); tones[lines.length - 1] = "yes";
      opener = CREW_OPENERS[lastOpener];
    } else {
      const R = CREW_BRUSHOFF;
      lastRude = [pickLine(R.openers, lastRude[0]), pickLine(R.lines, lastRude[1]), pickLine(R.closers, lastRude[2])];
      opener = R.openers[lastRude[0]]; lines = [R.lines[lastRude[1]], R.closers[lastRude[2]]]; tones = ["rude", "rude"];
    }
    crew.brief = { talker, lines, tones, opener, rude: !boss, i: 0, nextLineAt: 0, until: 0, speaking: false, talkSeen: false, now: 0 };
    // The briefer talks through SitePal (scene "crew" in the vendor registry, projected onto its
    // Face2). This runs inside the tap — the one user gesture we get for audio unlock + embed.
    if (VENDOR_SITEPAL_CONFIG.crew) activateVendorSitePal("crew");   // the phone counts as low-gfx yet is where the vendors already talk; the host embeds lazily there
  }, [crew, assignments]);
  useEffect(() => { const hook = devHook(); if (hook) { hook.brief = toggleBrief; hook.plotId = plotId; } return () => { if (hook) { delete hook.brief; delete hook.plotId; } }; }, [toggleBrief, plotId]);
  // SitePal's talk callbacks pace the briefing: a line's gesture and bubble go up when speech
  // starts, the next line follows when it ends. Without callbacks the BRIEF_LINE_S timer runs.
  useEffect(() => onVendorTalk((vendorId, talking) => {
    const b = crew.brief; if (!b || vendorId !== "crew") return;
    if (talking) { b.talkSeen = true; b.nextLineAt = b.now + 20; }                 // cap: a line that never ends still moves on
    else if (b.talkSeen) { b.talkSeen = false; b.speaking = false; b.nextLineAt = b.now + 0.35; }
  }), [crew]);
  useFrame(() => {
    if (rootRef.current) rootRef.current.getWorldPosition(crew.rigPos);
    // React to what the rig is actually doing (2026-09-12): the eruption refs cover every source —
    // strike overflow, tank overflow, the admin test, a broadcast gusher event, a hell breach — where
    // the old gusherActive prop only saw the broadcast event. Hell eruptions belong to alert/cower.
    const live = !!eruption?.activeRef?.current, hellErupt = live && !!eruption?.hellRef?.current;
    const nowS = performance.now() / 1000;
    if (live && !hellErupt) { crew.gusherTier = eruption?.tierRef?.current || "gusher"; crew.gusherSeenAt = nowS; }
    else if (gusherActive) { crew.gusherTier ||= "gusher"; crew.gusherSeenAt = nowS; }
    else if (crew.gusher && Object.values(crew.workers).some((w) => w.wakeTo === "celebrate")) crew.gusherSeenAt = nowS;   // a dozer is still getting up (6 s): hold the party until it can join
    // Keep celebrating a moment after the column drops: a local gusher lasts 3 s, which ended the
    // party mid-clap. A seep gets a shorter afterglow. The length is pinned while the tier is known —
    // measuring against the tier after clearing it restarted a finished strike party as a gusher one.
    if (crew.gusherTier) crew.gusherLinger = crew.gusherTier === "strike" ? CELEBRATE_LINGER_STRIKE_S : CELEBRATE_LINGER_S;
    crew.gusher = crew.gusherSeenAt != null && nowS - crew.gusherSeenAt < (crew.gusherLinger || CELEBRATE_LINGER_S);
    if (!crew.gusher) { crew.gusherTier = null; crew.gusherSeenAt = null; }
    // The eruption point for faces and looks: over the polished rod, at the horsehead's height.
    if (wellNodes.straw && wellNodes.head) { wellNodes.straw.getWorldPosition(crew.wellPos); wellNodes.head.getWorldPosition(_wellHead); crew.wellPos.y = _wellHead.y; crew.hasWell = true; }
  });
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
  // Hats (2026-09-11): on the rig it is hard hats only — the Helmet stays on for every act here
  // (Michelle, after seeing a cowboy hat at the wellhead during music). CowboyHat / Ballcap
  // (bone-parented to the head, hidden in her blend, plain nodes in the GLB) are for time off the
  // rig — the CommercialStrip visit, when that exists: flag an act `offDuty: true` and showHat()
  // swaps in the hat the worker drew once.
  const hats = useMemo(() => { const m = {}; clone.traverse((o) => { if (o.name === "Helmet" || o.name === "CowboyHat" || o.name === "Ballcap") m[o.name] = o; }); return m; }, [clone]);
  useEffect(() => { Object.entries(hats).forEach(([n, o]) => { o.visible = n === "Helmet"; }); }, [hats]);
  const headBone = useMemo(() => clone.getObjectByName("head") || null, [clone]);
  const handR = useMemo(() => clone.getObjectByName("hand_r") || null, [clone]);
  const ballL = useMemo(() => clone.getObjectByName("ball_l") || null, [clone]);   // dev: rung contact check
  // SitePal face projection (the briefer only): Face2 wears the cropped avatar frame while this
  // worker is briefing and the host has the crew scene up; Face1/Face3 hide behind it.
  const projRef = useRef(null);
  useEffect(() => {
    const cfg = VENDOR_SITEPAL_CONFIG.crew;
    projRef.current = cfg ? createProjectionState(clone, cfg) : null;
    return () => { disposeProjectionState(projRef.current); projRef.current = null; };
  }, [clone]);

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
      climb: () => { if (!MENU[st.current.spot]?.climbTo) return false; beginClimb(st.current.now || 0); return true; },   // start the ladder from its base now
      state: () => { const s = st.current; const g = groupRef.current; const gw = new THREE.Vector3(); if (g) g.getWorldPosition(gw); const sc = g ? g.getWorldScale(new THREE.Vector3()).y : 1;
        return { spot: s.spot, act: s.act, erupt: crew.gusher ? crew.gusherTier : null, lookPitch: +(s.look?.pitch || 0).toFixed(3), wellY: crew.hasWell ? +crew.wellPos.y.toFixed(4) : null, hat: s.hat || null, look: s.lookAtName || null, flinched: s.flinched || 0, headYaw: +(s.look?.yaw || 0).toFixed(2), turn: s.turn ? { clip: s.turn.clip, reverse: s.turn.reverse, deg: +(s.turn.delta * 180 / Math.PI).toFixed(0) } : null, turns: Object.fromEntries(Object.entries(TURN_PROFILES).map(([k, v]) => [k, +(v.total * 180 / Math.PI).toFixed(1)])), mode: s.mode, phase: s.phase, scene: scene || null, yaw: +s.yawCur.toFixed(2), yawAim: s.yawAim == null ? null : +s.yawAim.toFixed(2), headUp: +((s.head.y - gw.y) / (sc || 1)).toFixed(3),
        props: Object.fromEntries(Object.entries(props).map(([n, o]) => { const w = new THREE.Vector3(); o.getWorldPosition(w); return [n, { visible: o.visible, verts: o.geometry?.attributes?.position?.count || 0, world: w.toArray().map((v) => +v.toFixed(3)) }]; })), chat: crew.chat ? { talker: crew.chat.talker, swapAt: +crew.chat.swapAt.toFixed(2) } : null, t: +s.t.toFixed(3), pos: s.pos.toArray().map((v) => +v.toFixed(3)), frames: s.frames, now: +(s.now || 0).toFixed(2), nextThrowAt: +(s.nextThrowAt || 0).toFixed(2), throws: s.throws || 0, fired: s.fired || 0, counted: s.counted || 0, dist: s.dbgDist == null ? null : +s.dbgDist.toFixed(2), running: !!(s.action && s.action.isRunning()), fromRig: resolveStation(rigScene, s.spot).fromRig, trace: s.trace || [], head: s.head.toArray().map((v) => +v.toFixed(3)), valveVents: s.valveVents || 0, projFade: +(s.projFade || 0).toFixed(2), faces: projRef.current ? { proj: !!projRef.current.proj, regulars: projRef.current.regulars.length } : null,
        projMat: (() => { const st = projRef.current; const m = st?.material; if (!m) return null; let px = null; try { const d = st.cropCtx.getImageData(256, 256, 1, 1).data; px = [d[0], d[1], d[2]]; } catch (e) {} const pm = st.regulars[0]?.material; return { color: "#" + m.color.getHexString(), mapCS: m.map?.colorSpace, mapIsTex: m.map === st.material.map, opacity: m.opacity, toneMapped: m.toneMapped, emissive: "#" + (m.emissive?.getHexString?.() || "000000"), emissiveIntensity: m.emissiveIntensity, type: m.type, paintedType: pm?.type, paintedMapCS: pm?.map?.colorSpace, paintedColor: pm ? "#" + pm.color.getHexString() : null, cropCentrePx: px, cropGrid: (() => { try { const g = []; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const d = st.cropCtx.getImageData(64 + i * 192, 64 + j * 192, 1, 1).data; g.push([d[0], d[1], d[2]]); } return g; } catch (e) { return null; } })(), colorRaw: [m.color.r, m.color.g, m.color.b].map((v) => +v.toFixed(3)), uv: (() => { const a = st.proj.geometry?.attributes?.uv; if (!a) return null; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { count: a.count, min: [+x0.toFixed(3), +y0.toFixed(3)], max: [+x1.toFixed(3), +y1.toFixed(3)] }; })(), projMatType: st.proj.material?.type, projVisible: st.proj.visible }; })(),
        weightSum: +Object.values(actionsRef.current).reduce((acc, o) => acc + (o.isScheduled() && o.enabled ? o.getEffectiveWeight() : 0), 0).toFixed(3), visible: !!g?.visible,
        ballL: ballL ? +((ballL.getWorldPosition(new THREE.Vector3()).y - gw.y) / (sc || 1) + s.pos.y).toFixed(3) : null,   // left ball joint height in rig units (group-relative + group y)
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
    // Only clips the mixer is actually running count (isScheduled): a clip that has never been
    // played still reports enabled + weight 1, and counting those made every first clip after a
    // mount fade in from the bind pose — a quarter second of T-pose at each new sighting.
    const live = (o) => o !== a && o.isScheduled() && o.enabled && (o.isRunning() || o.getEffectiveWeight() > 0);
    Object.values(actions).forEach((o) => { if (live(o)) o.fadeOut(FADE); });
    const others = Object.values(actions).some(live);
    const w0 = a.isScheduled() && a.enabled ? a.getEffectiveWeight() : 0;   // the clip may itself be mid-fade (restarted while still blending)
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once; a.timeScale = timeScale; a.enabled = true;
    if (fromEnd) a.time = a.getClip().duration;
    // Weights must keep summing to 1: whatever falls below that is filled with the BIND POSE, which
    // is the T-pose flash. So blend in from the clip's current weight, never from zero, and skip
    // the fade altogether when there is nothing to blend from.
    if (!others) a.setEffectiveWeight(1);
    else if (w0 > 0 && typeof a._scheduleFading === "function") a._scheduleFading(FADE, w0, 1);
    else a.fadeIn(FADE);
    a.play();
    return a;
  };
  const showProps = (act) => { const want = ACTS[act]?.props || []; Object.entries(props).forEach(([name, node]) => { node.visible = want.includes(name); }); };
  const showHat = (offDuty) => {
    const s = st.current; s.offHat ||= Math.random() < 0.5 ? "CowboyHat" : "Ballcap";
    const on = offDuty && hats[s.offHat] ? s.offHat : "Helmet";
    Object.entries(hats).forEach(([n, o]) => { o.visible = n === on; }); s.hat = on;
  };
  const startAct = (act, now, dwell) => {
    while (ACTS[act] && !actionsRef.current[ACTS[act].clip] && ACTS[act].fallback) act = ACTS[act].fallback;   // stale GLB: never stand in the bind pose
    const s = st.current; const def = ACTS[act] || ACTS.idle; s.turn = null;   // a new act cancels a step-turn in progress
    s.act = act; s.phase = "act"; s.replayAt = 0; s.wheelBase = null; s.action = play(def.clip, { once: !!def.once, timeScale: def.reverse ? -1 : 1, fromEnd: !!def.reverse });
    s.actEnds = def.once || def.forever ? Infinity : now + (dwell ?? rand(def.dwell[0], def.dwell[1]));
    showProps(act); showHat(!!def.offDuty);
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
      s.act = "walk"; s.action = play("crew_walk"); showProps("walk"); showHat(false);
    } else { s.phase = "slide"; s.slideS = seconds; s.action = play("crew_idle"); showProps("idle"); showHat(false); }
  };
  const climbRate = () => {
    const base = resolveStation(rigScene, "ladder_base");
    const rise = Number(base.extras?.hm_climb_rise_m) || CLIMB_RISE_FALLBACK;
    const clip = actionsRef.current["crew_climb"]?.getClip(); return rise / (clip?.duration || 0.8);
  };
  // Where to start crew_climb so the left foot's plants (CLIMB_PLANT_FRAC into each cycle, CLIMB_PLANT_UP
  // above the origin) land on rungs: the group rises one rung pitch per cycle, so it is only a phase.
  const climbPhase = (z0, up) => {
    const base = resolveStation(rigScene, "ladder_base"); const T = actionsRef.current["crew_climb"]?.getClip().duration || 0.8;
    const R = Number(base.extras?.hm_climb_rise_m) || CLIMB_RISE_FALLBACK; const rung0 = base.pos.y + (Number(base.extras?.hm_climb_rung0_m) || CLIMB_RUNG0_FALLBACK);
    const foot0 = z0 + CLIMB_PLANT_UP - CLIMB_PLANT_BIAS;
    const k = up ? Math.ceil((foot0 - rung0) / R - 1e-6) : Math.floor((foot0 - rung0) / R + 1e-6);   // the first rung the foot meets in the travel direction
    const t = Math.abs(rung0 + k * R - foot0) / R * T;                                               // travel time until then
    const plant = CLIMB_PLANT_FRAC * T;
    return (((up ? plant - t : plant + t) % T) + T) % T;                                             // descent runs the clip backwards
  };
  const beginClimb = () => { const s = st.current; const top = resolveStation(rigScene, MENU[s.spot].climbTo); s.phase = "climbUp"; s.target = top; s.act = "climb"; s.action = play("crew_climb"); s.action.time = climbPhase(s.pos.y, true); showProps("climb"); };
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
    else if (mode === "celebrate") {
      // A seep ("strike") gets a quick cheer; a real gusher or a motherlode blasts first, so the
      // crew flinches for a beat (nervous) before the cheering starts (modeNext).
      s.celebrateTier = crew.gusherTier || "gusher"; s.celebrateSeq = 0;
      if (s.celebrateTier === "strike" || s.act === "getUp" || s.act === "uncower") celebrateNext(now);   // a seep, or a worker who already scrambled up: no flinch
      else startAct("nervous", now, rand(0.6, 1.1));
    }
    else if (mode === "brief") {                                            // greet (the opener is spoken with the wave), then each line brings its own gesture (modeTick)
      const b = crew.brief; startAct(b.rude ? "scold" : "wave", now); setBubble(b.opener || "Hey, boss."); b.i = 0; b.nextLineAt = now + BRIEF_GREET_S;   // a stranger gets a scolding, not a wave
      b.talkSeen = false; b.noVoice = false; b.speaking = speakVendorText("crew", b.opener || "Hey, boss."); b.speakDeadline = now + SPEECH_START_S + 1.5;   // +1.5: the opener also waits out the activation's greeting delay
    }
    else if (mode === "listen") { startAct(Math.random() < 0.5 && actionsRef.current["crew_neutralIdle"] ? "neutralIdle" : "idle", now, 999); s.nextGesture = Infinity; s.yawAim = null; s.noticeAt = now + rand(0.5, 1.4); }   // the other worker just notices the boss: no body turn, no gestures, head only (Michelle, 2026-09-12)
    else if (mode === "chatListen") { startAct("idle", now, 999); s.nextGesture = now + rand(2, 5); }
    else if (mode === "chat") startAct("talking", now, 999);
    else if (mode === "music") startAct("music", now, 999);
    else if (mode === null) menuAct(now);
  };
  // Celebration clips, chosen against what the partner is playing (Michelle, 2026-09-12: not both
  // clapping at once). A worker never starts the clip its partner is in, so one claps while the
  // other dances; a clapper hands over to a victory dance when its clap ends, and a dancer takes the
  // clapping when it is free. No crew_cheer: that take nods the head ~35° four times a second.
  // A small strike: one claps, the other acknowledges once and then just watches the well.
  const celebrateNext = (now) => {
    const s = st.current; const p = partner();
    const pAct = p && p.mode === "celebrate" ? p.act : null;
    const tier = s.celebrateTier, other = (v) => (v === "victory1" ? "victory2" : "victory1");
    const prev = s.celebrateSeq ? s.act : null;   // only a clip from THIS party counts (a chat nod before the strike does not)
    let prefs;
    if (tier === "strike") prefs = pAct === "clap" ? (prev === "acknowledge" ? [] : ["acknowledge"]) : ["clap", "acknowledge"];
    else if (prev === "clap") { const v = other(s.lastVictory); prefs = [v, other(v)]; }                  // hand the clapping over (either dance)
    else if (prev === "victory1" || prev === "victory2") prefs = ["clap", other(prev), prev];
    else prefs = tier === "motherlode" ? ["victory1", "victory2", "clap"] : ["clap", "victory1", "victory2"];   // after the flinch, or up from a nap
    const act = prefs.find((a) => a && a !== pAct && actionsRef.current[ACTS[a]?.clip]) || null;
    s.celebrateSeq = (s.celebrateSeq || 0) + 1;
    if (!act) { startAct("neutralIdle", now, tier === "strike" ? 999 : rand(1, 2)); return; }   // nothing that differs from the partner: watch the well (a strike), or for a beat
    if (act === "victory1" || act === "victory2") s.lastVictory = act;
    startAct(act, now);
  };
  const modeNext = (mode, now) => {                                     // an act ended inside a mode
    const s = st.current;
    if (mode === "cower") { s.actEnds = Infinity; return; }             // hold the curl
    if (mode === "defend") startAct("ninja", now, 999);
    else if (mode === "alert") startAct("nervous", now, 999);
    else if (mode === "celebrate") celebrateNext(now);   // the flinch or a clip ended: pick the next one against the partner
    else if (mode === "brief") startAct(actionsRef.current["crew_neutralIdle"] ? "neutralIdle" : "idle", now, 999);   // a reply gesture ended: hold until the next line
    else if (mode === "chat") startAct("talking", now, 999);
    else if (mode === "listen") { startAct("idle", now, 999); s.nextGesture = Infinity; }
    else if (mode === "chatListen") { startAct("idle", now, 999); s.nextGesture = now + rand(2.5, 6); }
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
    // A stand-up (getUp from a doze, uncower from a curl) plays out untouched: no turning to face
    // the eruption, no throw or gesture cutting it short. The scheduler starts the mode after it.
    if (s.act === "uncower" || s.act === "getUp" || s.act === "doze") return;
    if ((mode === "celebrate" || mode === "alert") && crew.hasWell) {
      // Turn to the eruption — after the flinch for a gusher, straight away for a hell breach.
      if (!(mode === "celebrate" && s.act === "nervous")) faceWorld(crew.wellPos.x, crew.wellPos.y, crew.wellPos.z);
    }
    if (mode === "defend") {
      const D = demonNear(); if (!D) return;
      faceWorld(D.x, D.y, D.z);
      s.dbgDist = D.dist;
      if (s.act !== "throw" && D.dist < CREW_THROW_RANGE && now >= s.nextThrowAt) { startAct("throw", now); s.throws = (s.throws || 0) + 1; s.throwAt = now + THROW_RELEASE_S; s.nextThrowAt = now + rand(3, 5); }
      if (s.act === "throw" && s.throwAt && now >= s.throwAt) {
        s.throwAt = 0;
        if (handR && crew.fire) { handR.getWorldPosition(_tmp); crew.fire(_tmp, new THREE.Vector3(D.x, D.y + 0.08, D.z)); s.fired = (s.fired || 0) + 1; }
        // Counted only while the demon is in its vulnerable window, this client may catch it, no
        // cooldown is running, and the thrower is inside the demon's hit range — a shot outside the
        // window would make the demon counter and lock the player's revolver out (the miss rule).
        const S = window.__hmDemonState;
        if (CREW_THROWS_COUNT && groupRef.current && S && S.vulnerable && S.capturable !== false && !(S.cooldown > 0)) {
          groupRef.current.getWorldPosition(_tmp);
          if (Math.hypot(S.x - _tmp.x, S.z - _tmp.z) <= CREW_HIT_RANGE) { s.counted = (s.counted || 0) + 1; window.dispatchEvent(new CustomEvent("hm-shoot", { detail: { x: _tmp.x, y: _tmp.y, z: _tmp.z, source: "crew" } })); }
        }
      }
    } else if (mode === "brief") {
      const c = state.camera.position; faceWorld(c.x, c.y, c.z);          // turn to the player
      const b = crew.brief; if (!b) return;
      b.now = now;
      if (b.speaking && !b.talkSeen && now >= b.speakDeadline) { b.speaking = false; b.noVoice = true; }   // no host, no audio, or SitePal never started this phrase: the timer paces from here on
      if (now >= b.nextLineAt && !b.speaking) {
        if (b.i >= b.lines.length) { crew.brief = null; deactivateVendorSitePal(); return; }
        const line = b.lines[b.i];
        setBubble(line); startAct(briefGesture(b.tones?.[b.i], line), now); b.i += 1; b.nextLineAt = now + BRIEF_LINE_S;
        b.talkSeen = false; b.speaking = !b.noVoice && speakVendorText("crew", line); b.speakDeadline = now + SPEECH_START_S;
      }
    } else if (mode === "listen") {
      // watching the briefing: body stays put, no gestures — the head turns to the camera (below)
    } else if (mode === "chatListen") {
      if (!crew.chat) crew.chat = { talker: role.id, swapAt: now + rand(...CHAT_TURN) };   // first to notice opens the conversation
      // React to the talker's outbursts (2026-09-12): a yell makes the listener fidget nervously
      // (after a short reaction beat) until it stops; a scold is taken quietly, no nods or shrugs.
      const pAct = partner()?.act;
      if (pAct === "yell") {
        if (!s.flinchAt) s.flinchAt = now + rand(0.15, 0.4);
        if (now >= s.flinchAt && s.act !== "nervous") { startAct("nervous", now, 999); s.flinched = (s.flinched || 0) + 1; }
      } else {
        s.flinchAt = 0;
        if (s.act === "nervous") { startAct("idle", now, 999); s.nextGesture = now + rand(1.5, 3); }   // the yelling stopped: settle
        else if (pAct === "scold") s.nextGesture = Math.max(s.nextGesture, now + rand(1.5, 3));
        else if (s.act === "idle" && now >= s.nextGesture) startAct(Math.random() < 0.65 ? "acknowledge" : "shrug", now);
      }
    } else if (mode === "chat") {
      if (!crew.chat || now >= crew.chat.swapAt) { const other = Object.keys(crew.workers).find((k) => k !== role.id) || role.id; crew.chat = { talker: other, swapAt: now + rand(...CHAT_TURN) }; }
      else {
        // One chance per talking turn at an outburst (her 2026-09-12 clips): a scolding now and
        // then, the odd yell; crew_talking resumes when it ends (modeNext).
        if (s.chatTurnAt !== crew.chat.swapAt) { s.chatTurnAt = crew.chat.swapAt; s.outburstAt = now + rand(2.5, 7); }
        if (s.act === "talking" && s.outburstAt && now >= s.outburstAt) {
          s.outburstAt = 0; const r = Math.random();
          if (r < 0.3 && actionsRef.current["crew_scold"]) startAct("scold", now);
          else if (r < 0.42 && actionsRef.current["crew_yell"]) startAct("yell", now);
        }
      }
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
    if (!g.visible && s.act) g.visible = true;                   // first posed frame: only now let the worker be seen
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
    if (projRef.current?.proj) {
      const cfg = VENDOR_SITEPAL_CONFIG.crew;
      const tuning = role.briefs && typeof window !== "undefined" && window.__vendorSitePalTuneId === "crew";   // ?tune=vendor, CREW tab
      const briefing = tuning || (s.mode === "brief" && !!crew.brief && crew.brief.talker === role.id);
      if (tuning) { const c = state.camera.position; faceWorld(c.x, c.y, c.z); s.tuneFacing = true; }   // hold the face toward the camera while it is being tuned
      else if (s.tuneFacing) { s.tuneFacing = false; s.yawAim = null; s.tuneFocused = false; s.tuneMoving = false; if (s.actEnds === Infinity && !ACTS[s.act]?.once && !ACTS[s.act]?.forever) s.actEnds = now + rand(2, 5); }   // tab left: let the schedule resume
      const source = briefing ? getVendorSitePalSource() : null;
      const onScene = typeof window !== "undefined" && window.__vendorSitePalSceneLoaded === true && window.__vendorSitePalCurrentSceneId === cfg.sceneId;
      s.projFade = updateProjection(projRef.current, cfg, { source, onScene, show: briefing, delta, id: "crew" });
    }

    const panelOpen = !!(panelRef?.current?.open || panelRef?.current?.ref?.current);
    const tuneHold = role.briefs && typeof window !== "undefined" && window.__vendorSitePalTuneId === "crew";
    if (s.phase === "act" && tuneHold) {
      // ?tune=vendor CREW tab: park the briefer at TUNE_SPOT looping neutralIdle — no mode
      // changes, no dwell expiry, no chores — so the face stays put under the sliders. Once it
      // is standing there, report the head (world) once; the highlighted rig flies the camera
      // in (hm:crew-face → onFocusObject), the same move as the panel zoom.
      if (s.spot !== TUNE_SPOT) { if (s.act !== "push" && !s.tuneMoving) { s.mode = null; s.tuneMoving = true; slideTo(TUNE_SPOT, SLIDE_S, actionsRef.current["crew_neutralIdle"] ? "neutralIdle" : "idle"); } }
      else {
        s.tuneMoving = false;
        if (s.mode !== null) s.mode = null;
        const calm = actionsRef.current["crew_neutralIdle"] ? "neutralIdle" : "idle";
        if (s.act !== calm) startAct(calm, now, 999);
        s.actEnds = Infinity;
        if (!s.tuneFocused && s.frames > 2 && headBone) {
          s.tuneFocused = true;
          const f = _tmp.copy(state.camera.position).sub(s.head); f.y = 0; if (f.lengthSq() < 1e-6) f.set(1, 0, 0); f.normalize();
          try { window.dispatchEvent(new CustomEvent("hm:crew-face", { detail: { center: s.head.toArray(), front: f.toArray() } })); } catch (e) {}
        }
      }
    } else if (s.phase === "act") {
      const finished = s.action && ACTS[s.act]?.once && !s.action.isRunning();
      // mode changes only between scripted moves; a finished stand-up (uncower) clears the way
      const want = wantMode(now);
      if (want !== s.mode && s.act !== "push" && !((s.act === "uncower" || s.act === "getUp") && !finished)) enterMode(want, now);
      else if (s.decide && zoneOf(s.spot) === "panel" && s.act !== "push" && s.mode === null) {
        const tgt = s.decide; s.decide = null;
        if (tgt === s.spot) startAct("push", now); else slideTo(tgt, SLIDE_S, "push");
      } else if (s.decide) { s.decide = null; }
      else if (s.mode === null && panelOpen && PANEL_BUTTONS.has(s.spot) && s.act !== "push" && window.__vendorSitePalTuneId !== "crew") { s.returnSpot = s.spot; slideTo("panel_aside", ASIDE_S, "idle"); }   // out of the player's way (not while being tuned: the panel view is how you get close to the face)
      else if (s.mode === null && !panelOpen && s.spot === "panel_aside" && s.act !== "push") { slideTo(s.returnSpot || "panel_pass", ASIDE_S, "idle"); }
      else {
        modeTick(s.mode, now, dt, state);
        const def = ACTS[s.act];
        if (def?.holdBetween) {                                             // one pass, hold the last frame, another pass
          if (s.act === "doze" && s.wakeQueued && !s.action?.isRunning()) { const q = s.wakeQueued; wakeUp(now, q.then); }
          else if (s.act === "doze" && s.dozeUntil && now >= s.dozeUntil) wakeUp(now);
          else if (finished && !s.replayAt) s.replayAt = now + rand(...def.holdBetween);
          else if (s.replayAt && now >= s.replayAt) { s.replayAt = 0; s.action.reset(); s.action.play(); }
        } else if (!s.turn && (finished || now >= s.actEnds)) {
          if (s.act === "uncower" || s.act === "getUp") { const to = s.wakeTo; s.wakeTo = null; if (to && wantMode(now) === to) { s.mode = null; enterMode(to, now); } else { s.mode = null; menuAct(now); } }   // the reason it woke may be over by now
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
      if (u <= 0 || !s.action?.isRunning()) { topMove(0); s.phase = "climbDown"; s.act = "climb"; s.action = play("crew_climb", { timeScale: -1 }); s.action.time = climbPhase(s.pos.y, false); showProps("climb"); }
    } else if (s.phase === "climbDown") {
      s.pos.y = Math.max(s.target.pos.y, s.pos.y - climbRate() * dt);
      if (s.pos.y <= s.target.pos.y + 1e-4) {
        s.spot = MENU[s.spot].descendTo; s.pos.copy(s.target.pos); s.yaw = s.target.yaw;
        startAct("idle", now); s.actEnds = now + rand(20, 40); // rest at the base before the next climb
      }
    }
    // body yaw: the station's facing, or eased toward a demon while defending. A big change while
    // standing steps through a turn clip; the group follows the clip's own yaw curve (see TURN_*).
    const yawT = s.yawAim ?? s.yaw;
    const dY = wrapAngle(yawT - s.yawCur);
    if (s.turn) {
      const T = s.turn, a = s.action, dur = a?.getClip().duration || 1;
      const u = a ? Math.min(1, Math.max(0, (T.reverse ? dur - a.time : a.time) / dur)) : 1;
      s.yawCur = T.start + T.delta * turnProfile(T.clip, u, T.reverse);
      if (!a || !a.isRunning()) { s.yawCur = T.start + T.delta; const { act, actEnds } = T; s.turn = null; startAct(act, now); s.actEnds = actEnds; }
    } else if (Math.abs(dY) >= TURN_MIN && s.phase === "act" && TURN_ACTS.has(s.act) && s.mode !== "defend" && !tuneHold && TURN_PROFILES[TURN_CLIPS.quarter]) {
      const clip = Math.abs(dY) >= HALF_TURN_MIN && TURN_PROFILES[TURN_CLIPS.half] ? TURN_CLIPS.half : TURN_CLIPS.quarter;
      const reverse = Math.sign(dY) !== Math.sign(TURN_PROFILES[clip].total);   // both clips turn right; a left turn plays backwards
      const T = { clip, start: s.yawCur, delta: dY, reverse, act: s.act, actEnds: s.actEnds };
      const a = play(clip, { once: true, timeScale: reverse ? -1 : 1, fromEnd: reverse });
      if (a) { s.turn = T; s.action = a; s.actEnds = Infinity; }
      else s.yawCur += dY * (1 - Math.exp(-BODY_TURN_EASE * dt));
    } else s.yawCur += dY * (1 - Math.exp(-BODY_TURN_EASE * dt));
    g.position.copy(s.pos); g.rotation.y = s.yawCur;

    // head: look at the point of interest (mode first, then the spot's), eased and clamped
    // Every tier (2026-09-12): the low-graphics gate left phone heads frozen, and the briefing watcher
    // is head-only. Two workers, a little math on one bone each: nothing next to drawing the scene.
    if (!headBone || devHook()?.force?.noHead) return;   // dev: __hmCrew.force.noHead = true shows the clip without the look-at
    const t = s.look;
    let targetYaw = 0, targetPitch = 0;
    let lookAt = null;
    if (tuneHold) lookAt = "camera";
    else if (s.mode === "defend") lookAt = "demon";
    else if (s.mode === "celebrate" || s.mode === "alert") lookAt = crew.hasWell ? "well" : "head_pump";   // watch the column (or the hellhole)
    else if (s.mode === "brief") lookAt = "camera";
    else if (s.mode === "listen") lookAt = s.now >= (s.noticeAt || 0) ? "camera" : null;   // a beat, then it notices the boss
    else if (s.mode === "chat" || s.mode === "chatListen") lookAt = "partner";
    else if (s.mode === null && ACTS[s.act]?.look) lookAt = MENU[s.spot]?.look || null;
    s.lookAtName = lookAt;   // dev state
    if (lookAt) {
      headBone.getWorldPosition(_headPos);
      let ok = false;
      if (lookAt === "camera") { _to.copy(state.camera.position).sub(_headPos); ok = true; }
      else if (lookAt === "well") { _to.copy(crew.wellPos).sub(_headPos); ok = true; }
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
    <group ref={groupRef} visible={false} onClick={(e) => { e.stopPropagation(); onTap?.(); }}>   {/* shown once the mixer has posed it (useFrame) — a fresh clone renders in the bind pose */}
      <primitive object={clone} />
      {bubble && (
        // Anchored just above the hat and lifted by its own height so the box never sits on the
        // face (Michelle's phone screenshot, 2026-09-12); a small tail points back at the talker.
        <Html center position={[0, 1.0, 0]} zIndexRange={[9999, 9999]} style={{ pointerEvents: "none" }}>
          <div style={bubbleWrapStyle}>
            <div style={bubbleStyle}>{bubble}</div>
            <div style={bubbleTailStyle} />
          </div>
        </Html>
      )}
    </group>
  );
}

// The wrapper is centred on the anchor by drei; translating it up by its full height puts the
// tail's tip on the anchor, so the whole bubble floats above the head whatever its size.
const bubbleWrapStyle = { display: "flex", flexDirection: "column", alignItems: "center", transform: "translateY(calc(-50% - 4px))" };
const bubbleStyle = {
  fontFamily: "'Share Tech Mono', monospace", fontSize: 12, letterSpacing: "0.04em", lineHeight: 1.25,
  color: "#f3e7c3", background: "rgba(20, 14, 10, 0.86)", border: "1px solid rgba(243, 231, 195, 0.35)",
  padding: "6px 9px", borderRadius: 4, textAlign: "center",
  // wrap long lines inside the box instead of running past it (2026-09-12)
  whiteSpace: "normal", width: "max-content", maxWidth: 220, overflowWrap: "break-word",
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
};
const bubbleTailStyle = {
  width: 8, height: 8, marginTop: -5, transform: "rotate(45deg)",
  background: "rgba(20, 14, 10, 0.86)", borderRight: "1px solid rgba(243, 231, 195, 0.35)", borderBottom: "1px solid rgba(243, 231, 195, 0.35)",
};
