"use client";

// DemonArena — the hell-hit fight, canonical on every device (decided
// 2026-09-02). The cowboy holds the bottom centre of the frame; the demon
// rises at range and works its way in on a choreography seeded by the bounty
// id, so every hunter sees the same beats. Drag to aim, tap to fire. The RULES
// are the field's (HellDemon): the demon is only hittable in its 2.6 s pause,
// a hit needs DEMON_HARD_HITS in the hard phase and one in the easy phase, a
// shot at it outside the window draws a counter and a 3.5 s lockout, and a
// shot in the back is a banish in the easy phase and worth two hits in the
// hard one. Missing costs nothing but the beat; losing costs nothing but time
// (the race stays fair, as the field's design says).
//
// This is a scene FRAGMENT: the page mounts it inside its Canvas in place of
// the field / rig scene (one canvas at a time) and draws the HUD in DOM.
// Aim/fire arrive on the window bus — "hm-arena-aim" / "hm-arena-fire" with
// {nx, ny} in NDC — and every beat goes back through onState / onResult.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MesaTile } from "@/components/RigScene";
import { playSfx, preloadSfx } from "@/lib/uiSfx";
import { VFXParticles, VFXEmitter, AppearanceMode, RenderMode } from "@/components/vfx/WawaVfx";

const COWBOY_GLB = "/models/Player_Cowboy.glb?v=3";
const GUN_GLB = "/models/SM_Wep_Revolver_01.glb?v=1";
const DEMON_GLB = "/models/imp_devil.glb";

// The field's numbers (OilVoxelGrid HellDemon) — keep them in step.
const COWBOY_SCALE = 0.05;
const DEMON_SCALE = 0.07;
const PAUSE_DUR = 2.6;          // the vulnerable window
const TAKE_DAMAGE_DUR = 0.73;
const COUNTER_DUR = 0.9;
const HIT_COOLDOWN = 3.5;       // lockout after a mistimed shot / a mauling
const BACKSTAB_DOT = -0.34;
const SPAWN_DUR = 1.8;
const FLEE_DUR = 0.7;
const MENACE_WINDUP = 0.4;
const LOOK_AWAY_DUR = 1.0;      // first beat of some pauses: its back is turned

// Arena geometry, in world units of the field (the cowboy is ≈0.16 tall).
const SPAWN_Z = 1.05;
const NEAR_Z = 0.32;            // close enough to claw
const LANE_X = 0.42;
const WALK_SPEED = 0.16;        // units/s
const FLEE_Z = 0.98;
const FLANK_Z = 0.6;            // nearer than this it keeps to one side …
const FLANK_X = 0.2;            // … at least this far off the centre line
const HIT_RADIUS = 0.11;        // forgiving touch target around the demon

// Over-the-shoulder: the cowboy (≈0.19 tall) fills the lower half of the
// frame, centred, feet just above the bottom edge; the demon works the middle
// ground at z 0.3–1.0 around the centre line.
// ── Arsenal (2026-09-03) ─────────────────────────────────────────────────────
// Three answers to three situations, all resolved against the same window rules
// (the fireball was cut 2026-09-03 — "the gun, lightning, ice, and holy water
// should be plenty"):
//   revolver  — precision: exact hit, fast, the baseline.
//   lightning — the chain (matters once there are waves): double damage on a
//               clean hit, and ANY miss draws the counter + lockout.
//   ice       — control: freezes the demon mid-approach for FREEZE_DUR; frozen it
//               is hittable, but the first hit shatters the ice and it flees —
//               time and one clean shot, no kill. Missing with ice costs nothing.
// Holy water (the ticket consumable) comes later and forces the pause.
export const WEAPONS = {
  revolver:  { label: "REVOLVER",  glyph: "◉", cooldown: 0.35 },
  lightning: { label: "LIGHTNING", glyph: "⚡", cooldown: 1.2 },
  ice:       { label: "ICE",       glyph: "❄", cooldown: 4.0 },
};
const FREEZE_DUR = 2.0;
const PROJECTILE_DUR = 0.22;    // ice bolt flight time
// HOLY WATER (bought from the snake oil salesman, src/lib/oilVendor.js): a
// lobbed vial that always finds the demon. It reels, turns its back, and holds
// a LONGER pause — the backstab window on demand — and the splash steadies the
// hunter's hand (clears a lockout). One vial ≈ two of the three pips.
const VIAL_FLIGHT = 0.5;
const FORCED_PAUSE_DUR = 2.6 + 1.0;   // PAUSE_DUR + 1
const FORCED_LOOK_AWAY = 2.2;         // back turned for most of it

export const ARENA_CAMERA = { position: [0, 0.26, -0.55], target: [0, 0.12, 0.6] };

const SFX = {
  gun: "/audio/demon/laser.mp3",
  dodge: "/audio/demon/cackle-short.mp3",
  strike: "/audio/fireworks/crackle-sm-1.mp3",
  hit: "/audio/fireworks/burst-sm-1.mp3",
  banish: "/audio/churchBell.mp3",
  roar: "/audio/demon/roar.mp3",
};
// Weapon sound slots (2026-09-03). Michelle is sourcing the files; until one
// lands at its path the slot plays its fallback, so no weapon goes silent.
// Landed: both lightning files and Wawa's fire/buildup/blast (mapped onto ice
// below). Still to come:
//   revolver.mp3     gunshot on the draw (~0.4 s)                → laser
//   thaw.mp3         drip/crackle as it shakes the ice off       → (silent)
// Usage follows the Fable game's SFX banks: `urls` are round-robin variations
// of ONE cue (its two lightning files are the same strike, not bolt + hit),
// every play gets light pitch/volume jitter so repeats never sound identical,
// (its fire "flying" loop / explosion files stay in the folder, unused since
// the fireball was cut).
const WEAPON_SFX = {
  revolver:      { urls: ["/audio/demon/revolver.mp3"],                    fallback: SFX.gun, volume: 0.5 },
  lightning:     { urls: ["/audio/demon/spell-lightning-explosion-1.mp3", "/audio/demon/spell-lightning-explosion-2.mp3"], fallback: SFX.gun, volume: 0.9 },
  // Wawa's spell set, dropped in 2026-09-03: fire.mp3 is the generic cast whoosh
  // (the Ice spell uses it too), buildup rises as the shell forms, blast is the finale.
  iceCast:       { urls: ["/audio/demon/fire.mp3"],                        fallback: SFX.gun, volume: 0.5 },
  iceFreeze:     { urls: ["/audio/demon/buildup.mp3"],                     fallback: "/audio/sparkle.mp3", volume: 0.5 },
  iceShatter:    { urls: ["/audio/demon/blast.mp3"],                       fallback: SFX.hit, volume: 0.55 },
  thaw:          { urls: ["/audio/demon/thaw.mp3"],                        fallback: null, volume: 0.45 },
  // holy water: the throw whoosh, the glass + splash, the choir stinger (choir1 exists)
  vialThrow:     { urls: ["/audio/demon/vial-throw.mp3"],                  fallback: "/audio/demon/fire.mp3", volume: 0.35 },
  vialSplash:    { urls: ["/audio/demon/vial-splash.mp3"],                 fallback: "/audio/sparkle.mp3", volume: 0.6 },
  vialChoir:     { urls: ["/audio/choir1.mp3"],                            fallback: "/audio/churchBell.mp3", volume: 0.5 },
};
const _bankIndex = {};
// One-shot from a bank: next variation, ±rateJitter pitch, up to volJitter quieter.
const playWeaponSfx = (key, volumeScale = 1) => {
  const w = WEAPON_SFX[key]; if (!w) return;
  const i = (_bankIndex[key] = ((_bankIndex[key] ?? Math.floor(Math.random() * w.urls.length)) + 1) % w.urls.length);
  const rateJitter = w.rateJitter ?? 0.08, volJitter = w.volJitter ?? 0.18;
  playSfx(w.urls[i], { volume: w.volume * volumeScale * (1 - Math.random() * volJitter), rate: 1 + (Math.random() * 2 - 1) * rateJitter, fallback: w.fallback });
};
const CAST_SFX = { revolver: "revolver", lightning: "lightning", ice: "iceCast" };

// Same seeded generator the field uses, so a bounty id yields one choreography.
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Fixed over-the-shoulder camera; the page's OrbitControls are not mounted here.
// Camera kick (Fable's `shake`): set arenaKick.v, it decays over ~0.3 s.
const arenaKick = { v: 0 };
function ArenaCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...ARENA_CAMERA.position);
    camera.lookAt(...ARENA_CAMERA.target);
    camera.updateProjectionMatrix();
  }, [camera]);
  useFrame((_, dt) => {
    if (arenaKick.v <= 0) return;
    const a = arenaKick.v * 0.012;
    camera.position.set(ARENA_CAMERA.position[0] + (Math.random() - 0.5) * a, ARENA_CAMERA.position[1] + (Math.random() - 0.5) * a, ARENA_CAMERA.position[2] + (Math.random() - 0.5) * a * 0.5);
    arenaKick.v = Math.max(0, arenaKick.v - dt * 3);
    if (arenaKick.v === 0) camera.position.set(...ARENA_CAMERA.position);
  });
  return null;
}

// The cowboy: idle, a draw-and-fire on every shot, a flinch when clawed.
function ArenaCowboy({ fireTick, hurtTick }) {
  const group = useRef();
  const inner = useRef();
  const { scene, animations } = useGLTF(COWBOY_GLB);
  const { scene: gunScene } = useGLTF(GUN_GLB);
  // SkeletonUtils.clone, not Object3D.clone: a plain clone of a skinned mesh
  // keeps pointing at the ORIGINAL skeleton, so the animated bones never move
  // the copy and it sits in its bind pose (the "two legs" of the first run).
  const model = useMemo(() => skeletonClone(scene), [scene]);
  const { actions, mixer } = useAnimations(animations, inner);

  // Feet on the ground, body centred. Box3 on a skinned mesh measures the bind
  // geometry, not the posed bones, so (as PlayerWalker does) measure the posed
  // BONES on the first animated frame: the lowest bone is a foot, the mean of
  // the bones is the body. Offsets are applied to the inner group, which lives
  // inside the ×COWBOY_SCALE parent, so convert world → local.
  const groundedRef = useRef(false);
  useFrame(() => {
    if (groundedRef.current) return;
    const off = inner.current; if (!off || !actions?.["Cowboy_Idle"]?.isRunning()) return;
    off.updateMatrixWorld(true);
    const v = new THREE.Vector3(); let minY = Infinity, sx = 0, sz = 0, n = 0;
    off.traverse((o) => { if (o.isBone) { o.getWorldPosition(v); minY = Math.min(minY, v.y); sx += v.x; sz += v.z; n++; } });
    if (!n || !isFinite(minY)) return;
    const cx = sx / n, cz = sz / n;
    off.position.x -= cx / COWBOY_SCALE;
    off.position.z -= cz / COWBOY_SCALE;
    off.position.y -= (minY - 0.004) / COWBOY_SCALE;
    off.updateMatrixWorld(true);
    groundedRef.current = true;
    if (typeof window !== "undefined") {
      window.__hmArenaDebug = { ...(window.__hmArenaDebug || {}), cowboyBox: () => { const bb = new THREE.Box3().setFromObject(off); return { min: bb.min.toArray().map((q) => +q.toFixed(3)), max: bb.max.toArray().map((q) => +q.toFixed(3)) }; }, cowboyBones: () => { let lo = Infinity, hi = -Infinity; const w = new THREE.Vector3(); off.traverse((o) => { if (o.isBone) { o.getWorldPosition(w); lo = Math.min(lo, w.y); hi = Math.max(hi, w.y); } }); return { lowestBoneY: +lo.toFixed(3), highestBoneY: +hi.toFixed(3) }; } };
    }
  });

  const play = useCallback((name, once = false) => {
    const a = actions?.[name]; if (!a) return;
    Object.values(actions).forEach((o) => { if (o !== a && o.isRunning()) o.fadeOut(0.15); });
    a.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once; a.fadeIn(0.12).play();
  }, [actions]);
  useEffect(() => { play("Cowboy_Idle"); }, [play]);
  useEffect(() => {
    if (!mixer) return;
    const back = () => play("Cowboy_Idle");
    mixer.addEventListener("finished", back);
    return () => mixer.removeEventListener("finished", back);
  }, [mixer, play]);
  useEffect(() => { if (fireTick) play("Cowboy_Shoot", true); }, [fireTick, play]);
  useEffect(() => { if (hurtTick) play("Cowboy_ReceiveHit", true); }, [hurtTick, play]);

  // Revolver on the forearm bone — this rig has no hand bone (see PlayerWalker).
  useEffect(() => {
    const off = inner.current; if (!off || !gunScene) return;
    let bone = null;
    off.traverse((o) => { if (!bone && o.isBone && /lower.?arm.?r/i.test(o.name)) bone = o; });
    if (!bone) return;
    const gun = gunScene.clone(true);
    gun.position.set(0, 0.24, 0.02); gun.rotation.set(Math.PI / 2, 0, 0); gun.scale.setScalar(0.6);
    gun.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); if (o.material.emissive) { o.material.emissive.set("#ff6a3a"); o.material.emissiveIntensity = 0.25; } } });
    bone.add(gun);
    return () => { bone.remove(gun); };
  }, [gunScene, model]);

  return (
    <group ref={group} position={[0, 0, 0]} scale={COWBOY_SCALE}>
      <group ref={inner}><primitive object={model} /></group>
    </group>
  );
}

/**
 * The demon. `seed` makes the choreography deterministic per bounty; `required`
 * is the hits to banish (1 easy / 3 hard). `api` receives an object the arena
 * uses to resolve shots; `onState` reports phase changes for the HUD.
 */
function ArenaDemon({ seed, required, api, onState, onBanish, onAttack, onLockout }) {
  const group = useRef();
  const light = useRef();
  const ring = useRef();
  const { scene, animations } = useGLTF(DEMON_GLB);
  const model = useMemo(() => skeletonClone(scene), [scene]); // see ArenaCowboy — the "boulder" was the bind pose
  const { actions } = useAnimations(animations, group);
  const rng = useMemo(() => mulberry32(hashSeed(String(seed))()), [seed]);

  const { camera } = useThree();
  const st = useRef({ phase: "spawn", t: 0, from: new THREE.Vector3(0, 0, SPAWN_Z), to: new THREE.Vector3(0, 0, SPAWN_Z), dur: 1, vulnerable: false, lookAway: false, hits: 0, done: false, faceYaw: Math.PI, frozenFrom: null });
  const shell = useRef();
  const [, force] = useState(0);
  const report = useCallback(() => { const s = st.current; onState?.({ phase: s.phase, vulnerable: s.vulnerable, backstabOpen: s.vulnerable && s.lookAway, frozen: s.phase === "frozen", hits: s.hits, required }); }, [onState, required]);

  const playAnim = useCallback((re, loop = true) => {
    const name = Object.keys(actions || {}).find((n) => re.test(n)); if (!name) return;
    const a = actions[name];
    Object.values(actions).forEach((o) => { if (o !== a && o.isRunning()) o.fadeOut(0.15); });
    a.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop; a.fadeIn(0.12).play();
  }, [actions]);

  const setPhase = useCallback((phase) => {
    const s = st.current; s.phase = phase; s.t = 0;
    s.vulnerable = phase === "pause";
    if (phase !== "pause") { s.lookAway = false; s.forced = false; }
    report(); force((n) => n + 1);
  }, [report]);

  // Face the cowboy (at the origin) or away from him.
  const faceCowboy = (g, away = false) => {
    const yaw = Math.atan2(0 - g.position.x, 0 - g.position.z) + (away ? Math.PI : 0);
    g.rotation.y = yaw; st.current.faceYaw = yaw;
  };

  const beginApproach = useCallback((g) => {
    const s = st.current;
    s.from.copy(g.position);
    const nz = Math.max(NEAR_Z, g.position.z - (0.18 + rng() * 0.22));
    let nx = THREE.MathUtils.clamp(g.position.x + (rng() * 2 - 1) * 0.3, -LANE_X, LANE_X);
    // Close in, the demon must flank: dead centre it would stand behind the
    // cowboy's head from this camera and the player could not see the window.
    if (nz < FLANK_Z && Math.abs(nx) < FLANK_X) nx = (nx < 0 || (nx === 0 && rng() < 0.5) ? -1 : 1) * (FLANK_X + rng() * 0.1);
    s.to.set(nx, 0, nz);
    s.dur = Math.max(0.5, s.from.distanceTo(s.to) / WALK_SPEED);
    g.rotation.y = Math.atan2(s.to.x - g.position.x, s.to.z - g.position.z);
    playAnim(/^Walk Forward/i);
    setPhase("approach");
  }, [rng, playAnim, setPhase]);

  const beginPause = useCallback((g, forced = false) => {
    const s = st.current;
    s.lookAway = forced ? true : rng() < 0.4; // sometimes it turns its back first — the backstab beat
    faceCowboy(g, s.lookAway);
    playAnim(/^Idle$/i);
    setPhase("pause");
    s.forced = forced;
  }, [rng, playAnim, setPhase]);

  const beginFlee = useCallback((g) => {
    const s = st.current;
    s.from.copy(g.position); s.to.set(THREE.MathUtils.clamp((rng() * 2 - 1) * LANE_X, -LANE_X, LANE_X), 0, FLEE_Z); s.dur = FLEE_DUR;
    g.rotation.y = Math.atan2(s.to.x - g.position.x, s.to.z - g.position.z);
    playAnim(/^Run Forward/i);
    setPhase("flee");
  }, [rng, playAnim, setPhase]);

  const beginMenace = useCallback((g) => {
    faceCowboy(g);
    playAnim(rng() < 0.5 ? /^Slash Attack/i : /^Projectile Attack/i, false);
    playSfx(SFX.roar, { volume: 0.4 });
    setPhase("menace");
  }, [rng, playAnim, setPhase]);

  const beginBanish = useCallback((g) => {
    faceCowboy(g);
    playAnim(/^Take Damage/i, false);
    playSfx(SFX.banish, { volume: 0.6 });
    st.current.done = true;
    setPhase("banish");
  }, [playAnim, setPhase]);

  // Ice: stop it where it stands. Its clip pauses, the shell grows; FREEZE_DUR
  // later it thaws and carries on. A hit while frozen shatters the ice instead.
  const beginFreeze = useCallback((g) => {
    const s = st.current;
    s.frozenFrom = s.phase; s.vulnerable = false;
    Object.values(actions || {}).forEach((a) => { if (a.isRunning()) a.paused = true; });
    setPhase("frozen");
  }, [actions, setPhase]);
  const thaw = useCallback((g, shattered) => {
    Object.values(actions || {}).forEach((a) => { a.paused = false; });
    if (!shattered) playWeaponSfx("thaw");
    if (shattered) beginFlee(g); else beginApproach(g);
  }, [actions, beginFlee, beginApproach]);

  // Shot resolution — the field's rules, from the arena's fixed vantage, with
  // the weapon deciding what a hit is worth and what a miss costs.
  useEffect(() => {
    const damageAndReport = (g, s, dmg, backstab, quiet = false) => {
      if (required <= 1) { beginBanish(g); return { result: "banish", backstab, hits: required, required }; }
      s.hits += dmg;
      if (!quiet) playSfx(SFX.hit, { volume: 0.5 });
      if (s.hits >= required) { beginBanish(g); return { result: "banish", backstab, hits: s.hits, required }; }
      faceCowboy(g); playAnim(/^Take Damage/i, false); setPhase("hitstun");
      return { result: "hit", backstab, hits: s.hits, required };
    };
    const counter = (g, s) => {
      faceCowboy(g); playAnim(/^Take Damage/i, false); playSfx(SFX.dodge, { volume: 0.5 });
      setPhase("counter"); onLockout?.(HIT_COOLDOWN);
      return { result: "dodge", hits: s.hits, required };
    };
    api.current = {
      resolve: (hit, weapon = "revolver") => {
        const s = st.current; const g = group.current;
        if (!g || s.done) return { result: "done" };
        if (["banish", "counter", "hitstun", "menace", "spawn"].includes(s.phase)) return { result: "blocked" };
        // Frozen: any weapon's hit shatters the ice for one plain hit; a miss just misses.
        if (s.phase === "frozen") {
          if (!hit) return { result: "miss" };
          Object.values(actions || {}).forEach((a) => { a.paused = false; });
          playWeaponSfx("iceShatter");
          const r = damageAndReport(g, s, 1, false, true);
          return { ...r, shattered: true };
        }
        if (weapon === "ice") {
          if (!hit) return { result: "miss" };
          beginFreeze(g);
          return { result: "frozen", hits: s.hits, required };
        }
        if (!hit) return weapon === "lightning" ? counter(g, s) : { result: "miss" };
        if (s.vulnerable) {
          // Rear arc: the cowboy is at the origin; is the demon's facing pointing away from him?
          const dx = 0 - g.position.x, dz = 0 - g.position.z; const dist = Math.hypot(dx, dz) || 1;
          const backstab = (Math.sin(g.rotation.y) * dx + Math.cos(g.rotation.y) * dz) / dist < BACKSTAB_DOT;
          const dmg = weapon === "lightning" ? 2 : (backstab ? 2 : 1);
          // lightning carries its own strike sound; the plain burst is the revolver's
          return damageAndReport(g, s, dmg, backstab, weapon === "lightning");
        }
        // Shot at it outside the window: it flinches, then counters, and this player is locked out.
        return counter(g, s);
      },
      state: () => ({ ...st.current }),
      // Holy water. "gone" = nothing to soak, "frozen" = wasted on ice.
      vialCheck: () => {
        const s = st.current; const g = group.current;
        if (!g || s.done || ["spawn", "banish"].includes(s.phase)) return "gone";
        if (s.phase === "frozen") return "frozen";
        return "ok";
      },
      vialLand: () => {
        const s = st.current; const g = group.current;
        if (!g || s.done || ["spawn", "banish"].includes(s.phase)) return { result: "vial_gone" };
        Object.values(actions || {}).forEach((a) => { a.paused = false; });
        s.vulnerable = false; s.struck = false;
        faceCowboy(g, true); playAnim(/^Take Damage/i, false); setPhase("vialstun");
        return { result: "vial", hits: s.hits, required };
      },
    };
  }, [api, required, beginBanish, beginFreeze, playAnim, setPhase, onLockout, actions]);

  // Spawn: rise out of the ground at range.
  useEffect(() => {
    const g = group.current; if (!g) return;
    if (typeof window !== "undefined") {
      window.__hmArenaDebug = { ...(window.__hmArenaDebug || {}), demon: () => { const meshes = []; g.traverse((o) => { if (o.isMesh) meshes.push(o.name + (o.visible ? "" : "(hidden)")); }); const bb = new THREE.Box3().setFromObject(g); return { phase: st.current.phase, vulnerable: st.current.vulnerable, hits: st.current.hits, pos: g.position.toArray().map((v) => +v.toFixed(3)), meshes, box: { min: bb.min.toArray().map((v) => +v.toFixed(3)), max: bb.max.toArray().map((v) => +v.toFixed(3)) } }; },
        // Screen-space aim at the hit sphere (NDC) — for headless/on-device rehearsal.
        demonNdc: () => {
          const t = g.getObjectByName("arena-demon-hit"); if (!t) return null;
          const c = t.getWorldPosition(new THREE.Vector3()); const v = c.clone().project(camera);
          // projected x-extent of each sphere (camera-right offset), for aiming between them
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const ext = (r) => Math.abs(c.clone().addScaledVector(right, r).project(camera).x - v.x);
          return { nx: +v.x.toFixed(4), ny: +v.y.toFixed(4), rHit: +ext(HIT_RADIUS).toFixed(4) };
        } };
    }
    g.position.set(0, -0.3, SPAWN_Z); faceCowboy(g);
    playAnim(/^Spawn$/i, false);
    setPhase("spawn");
  }, [playAnim, setPhase]);

  useFrame((state, dt) => {
    const g = group.current; const s = st.current; if (!g) return;
    s.t += dt;
    const t = state.clock.elapsedTime;
    if (light.current) {
      const base = s.vulnerable ? 3.2 : 1.4, amp = s.vulnerable ? 0.9 : 0.25;
      light.current.intensity = base + Math.sin(t * 6) * amp;
      light.current.position.set(g.position.x, 0.28, g.position.z);
    }
    if (shell.current) {
      const frozen = s.phase === "frozen";
      shell.current.visible = frozen;
      if (frozen) {
        shell.current.position.set(g.position.x, 0.16, g.position.z);
        const k = Math.min(1, s.t / 0.25); shell.current.scale.setScalar(0.2 + 0.8 * k);
        shell.current.material.opacity = 0.55 * Math.min(1, (FREEZE_DUR - s.t) / 0.4 + 0.2);
      }
    }
    if (ring.current) {
      ring.current.visible = s.vulnerable;
      ring.current.position.set(g.position.x, 0.004, g.position.z);
      const k = 1 + Math.sin(t * 5) * 0.08; ring.current.scale.set(k, k, 1);
      ring.current.material.opacity = s.lookAway ? 0.95 : 0.6;
    }
    switch (s.phase) {
      case "spawn": {
        const k = Math.min(1, s.t / SPAWN_DUR);
        g.position.y = -0.3 + 0.3 * (1 - Math.pow(1 - k, 3));
        if (k >= 1) { g.position.y = 0; beginApproach(g); }
        break;
      }
      case "approach": {
        const k = Math.min(1, s.t / s.dur);
        g.position.lerpVectors(s.from, s.to, k);
        if (k >= 1) { if (g.position.z <= NEAR_Z + 0.02) beginMenace(g); else beginPause(g); }
        break;
      }
      case "pause": {
        if (s.lookAway && s.t >= (s.forced ? FORCED_LOOK_AWAY : LOOK_AWAY_DUR)) { s.lookAway = false; faceCowboy(g); report(); }
        if (s.t >= (s.forced ? FORCED_PAUSE_DUR : PAUSE_DUR)) { s.vulnerable = false; if (rng() < 0.25) beginFlee(g); else beginApproach(g); }
        break;
      }
      case "vialstun": {
        // the splash: it reels (Take Damage), then the forced, back-turned window
        if (s.t >= TAKE_DAMAGE_DUR) beginPause(g, true);
        break;
      }
      case "menace": {
        if (s.t >= MENACE_WINDUP && !s.struck) { s.struck = true; playSfx(SFX.strike, { volume: 0.5 }); onAttack?.(); onLockout?.(HIT_COOLDOWN); }
        if (s.t >= COUNTER_DUR + MENACE_WINDUP) { s.struck = false; beginFlee(g); }
        break;
      }
      case "flee": {
        const k = Math.min(1, s.t / s.dur);
        g.position.lerpVectors(s.from, s.to, 1 - Math.pow(1 - k, 2));
        if (k >= 1) beginApproach(g);
        break;
      }
      case "hitstun": {
        if (s.t >= TAKE_DAMAGE_DUR) beginFlee(g);
        break;
      }
      case "frozen": {
        if (s.t >= FREEZE_DUR) thaw(g, false);
        break;
      }
      case "counter": {
        if (s.t >= TAKE_DAMAGE_DUR && !s.struck) { s.struck = true; playAnim(rng() < 0.5 ? /^Slash Attack/i : /^Projectile Attack/i, false); playSfx(SFX.strike, { volume: 0.5 }); onAttack?.(); }
        if (s.t >= TAKE_DAMAGE_DUR + COUNTER_DUR) { s.struck = false; beginApproach(g); }
        break;
      }
      case "banish": {
        const k = Math.min(1, s.t / 0.9);
        g.scale.setScalar(DEMON_SCALE * (1 - k));
        g.position.y = k * 0.25;
        if (k >= 1 && !s.reported) { s.reported = true; onBanish?.(); }
        break;
      }
      default: break;
    }
  });

  return (
    <>
      <group ref={group} scale={DEMON_SCALE}>
        <primitive object={model} rotation={[Math.PI, 0, 0]} />
        {/* forgiving invisible hit sphere around the body — the raycast target */}
        <mesh name="arena-demon-hit" position={[0, 2.6, 0]}>
          <sphereGeometry args={[HIT_RADIUS / DEMON_SCALE, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

      </group>
      <pointLight ref={light} color="#ff3a1a" intensity={1.5} distance={1.6} decay={1.5} />
      {/* ice shell — grows around the frozen demon */}
      <mesh ref={shell} visible={false}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#9fe6ff" emissive="#4fc3ff" emissiveIntensity={0.6} transparent opacity={0.55} roughness={0.15} metalness={0.1} flatShading depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.1, 0.13, 40]} />
        <meshBasicMaterial color="#ff5a2a" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </>
  );
}

// ── Weapon effects — wawa-vfx pools + emitters (2026-09-03) ────────────────
// Ported from Wawa Sensei's Ice/Fire spell recipes at arena scale (~0.1× the
// wizard scene's units; the cowboy stands at the origin, the demon works
// between z 0.32 and 1.05). Four pools are allocated once per arena mount:
// sparks (billboard), spheres (mesh), icicles (cone mesh — no Icicle.glb here)
// and writings (a circle with a procedurally drawn magic-circle alpha map).
// Bursts are persistent emitters fired with emitAtPos(); the projectile trails
// are time-mode emitters parented to the flying projectile.
const LOW = () => (typeof window !== "undefined" && !!window.__hmLowGfx);

function magicCircleTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.clearRect(0, 0, 256, 256); g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineCap = "round";
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); };
  ring(118, 5); ring(104, 2); ring(62, 3);
  g.lineWidth = 2;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r0 = i % 2 ? 108 : 104, r1 = 116; g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); g.stroke(); }
  const star = (n, r, rot) => { g.beginPath(); for (let i = 0; i <= n; i++) { const a = rot + (i * 2 * Math.PI * 2) / n; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  g.lineWidth = 3; star(5, 60, -Math.PI / 2); star(5, 60, Math.PI / 2);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.beginPath(); g.arc(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84, 4, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

const B = (over) => ({ spawnMode: "burst", loop: false, delay: 0, duration: 1, startRotationMin: [0, 0, 0], startRotationMax: [0, 0, 0], rotationSpeedMin: [0, 0, 0], rotationSpeedMax: [0, 0, 0], ...over });
const FX_RECIPES = (low) => ({
  iceCast: B({ nbParticles: low ? 40 : 70, particlesLifetime: [0.2, 0.5], speed: [0.05, 0.4], size: [0.002, 0.008],
    startPositionMin: [-0.01, -0.01, -0.01], startPositionMax: [0.01, 0.01, 0.01], directionMin: [-1, 0.5, -1], directionMax: [1, 1.5, 1],
    colorStart: ["white", "skyblue"], colorEnd: ["white", "skyblue"] }),
  iceRing: B({ nbParticles: 1, particlesLifetime: [1.3, 1.3], speed: [0, 0], size: [0.24, 0.24],
    startPositionMin: [0, 0, 0], startPositionMax: [0, 0, 0], startRotationMin: [-Math.PI / 2, 0, 0], startRotationMax: [-Math.PI / 2, 0, 0],
    rotationSpeedMin: [0, 0, 0.8], rotationSpeedMax: [0, 0, 0.8], colorStart: ["skyblue"], colorEnd: ["skyblue"] }),
  iceSpires: B({ nbParticles: low ? 5 : 7, particlesLifetime: [1.7, 2.0], speed: [0, 0], size: [0.07, 0.13],
    startPositionMin: [-0.07, 0.01, -0.07], startPositionMax: [0.07, 0.02, 0.07], startRotationMin: [-0.35, 0, -0.5], startRotationMax: [0.35, Math.PI * 2, 0.5],
    colorStart: ["skyblue", "white"], colorEnd: ["skyblue", "white"] }),
  iceBurst: B({ nbParticles: low ? 60 : 110, particlesLifetime: [0.1, 1.4], speed: [0.05, 0.2], size: [0.002, 0.01],
    startPositionMin: [-0.05, 0, -0.05], startPositionMax: [0.05, 0.1, 0.05], directionMin: [-1, 0, -1], directionMax: [1, 1, 1],
    colorStart: ["white", "skyblue"], colorEnd: ["white", "skyblue"] }),
  iceShards: B({ nbParticles: 6, particlesLifetime: [0.4, 0.8], speed: [0.3, 0.8], size: [0.03, 0.06],
    startPositionMin: [-0.03, 0.05, -0.03], startPositionMax: [0.03, 0.15, 0.03], startRotationMin: [0, 0, 0], startRotationMax: [Math.PI, Math.PI, Math.PI],
    rotationSpeedMin: [-4, -4, -4], rotationSpeedMax: [4, 4, 4], directionMin: [-1, 0.2, -1], directionMax: [1, 1, 1],
    colorStart: ["skyblue", "white"], colorEnd: ["white"] }),
  strike: B({ nbParticles: low ? 100 : 200, particlesLifetime: [0.1, 0.5], speed: [0.2, 0.6], size: [0.002, 0.01],
    startPositionMin: [-0.02, -0.02, -0.02], startPositionMax: [0.02, 0.06, 0.02], directionMin: [-1, -0.3, -1], directionMax: [1, 1, 1],
    colorStart: ["white", "#9fd8ff"], colorEnd: ["#9fd8ff"] }),
  strikeFlash: B({ nbParticles: 1, particlesLifetime: [0.12, 0.12], speed: [0, 0], size: [0.035, 0.035],
    startPositionMin: [0, 0, 0], startPositionMax: [0, 0, 0], colorStart: ["white"], colorEnd: ["#9fd8ff"] }),
  // holy water: droplets (own pool, gravity), steam, glass
  drops: B({ nbParticles: low ? 70 : 140, particlesLifetime: [0.35, 0.9], speed: [0.15, 0.55], size: [0.004, 0.012],
    startPositionMin: [-0.02, -0.02, -0.02], startPositionMax: [0.02, 0.04, 0.02], directionMin: [-1, 0.4, -1], directionMax: [1, 1.6, 1],
    colorStart: ["#cfeeff", "white"], colorEnd: ["#9fd8ff"] }),
  steam: B({ nbParticles: low ? 40 : 70, particlesLifetime: [0.8, 1.7], speed: [0.03, 0.12], size: [0.005, 0.016],
    startPositionMin: [-0.05, -0.05, -0.05], startPositionMax: [0.05, 0.08, 0.05], directionMin: [-0.3, 1, -0.3], directionMax: [0.3, 1.6, 0.3],
    colorStart: ["white"], colorEnd: ["#e6f4ff"] }),
  glass: B({ nbParticles: 5, particlesLifetime: [0.3, 0.6], speed: [0.3, 0.7], size: [0.012, 0.024],
    startPositionMin: [-0.01, 0, -0.01], startPositionMax: [0.01, 0.02, 0.01], startRotationMin: [0, 0, 0], startRotationMax: [Math.PI, Math.PI, Math.PI],
    rotationSpeedMin: [-5, -5, -5], rotationSpeedMax: [5, 5, 5], directionMin: [-1, 0.3, -1], directionMax: [1, 1, 1],
    colorStart: ["white", "#cfeeff"], colorEnd: ["white"] }),
  banish: B({ nbParticles: low ? 150 : 300, particlesLifetime: [0.5, 1.4], speed: [0.1, 0.4], size: [0.003, 0.012],
    startPositionMin: [-0.05, 0, -0.05], startPositionMax: [0.05, 0.2, 0.05], directionMin: [-0.6, 0.5, -0.6], directionMax: [0.6, 1.5, 0.6],
    colorStart: ["#ffd27a", "white"], colorEnd: ["#ffb060", "white"] }),
});
const T = (over) => ({ spawnMode: "time", loop: false, delay: 0, duration: 0.25, startRotationMin: [0, 0, 0], startRotationMax: [0, 0, 0], rotationSpeedMin: [0, 0, 0], rotationSpeedMax: [0, 0, 0], ...over });
const TRAILS = (low) => ({
  iceCore: T({ nbParticles: low ? 14 : 24, particlesLifetime: [0.08, 0.14], speed: [0, 0.05], size: [0.008, 0.02],
    startPositionMin: [-0.004, -0.004, -0.004], startPositionMax: [0.004, 0.004, 0.004], directionMin: [0, 0, 0], directionMax: [0, 0, 0],
    colorStart: ["white", "skyblue"], colorEnd: ["white"] }),
  iceSparks: T({ nbParticles: low ? 40 : 80, particlesLifetime: [0.2, 0.5], speed: [0.02, 0.3], size: [0.001, 0.006],
    startPositionMin: [-0.01, 0, -0.01], startPositionMax: [0.01, 0, 0.01], directionMin: [-1, 0.5, -1], directionMax: [1, 1, 1],
    colorStart: ["white", "skyblue"], colorEnd: ["white", "skyblue"] }),
});

function radialTexture(draw) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 128); draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
// Fable's impact shockwave + scorch decal, on plain materials: an additive ring
// that expands and fades, and a dark blotch that lingers then dissolves.
function GroundFx({ fxApi }) {
  const ringTex = useMemo(() => radialTexture((g) => { const grd = g.createRadialGradient(64, 64, 40, 64, 64, 64); grd.addColorStop(0, "rgba(255,255,255,0)"); grd.addColorStop(0.55, "rgba(255,255,255,1)"); grd.addColorStop(0.8, "rgba(255,255,255,0.35)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }), []);
  const scorchTex = useMemo(() => radialTexture((g) => { const grd = g.createRadialGradient(64, 64, 6, 64, 64, 64); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.5, "rgba(255,255,255,0.75)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = "destination-out"; for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 38; g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 5 + Math.random() * 9, 0, Math.PI * 2); g.fill(); } }), []);
  const geo = useMemo(() => new THREE.CircleGeometry(1, 32), []);
  const shaftGeo = useMemo(() => new THREE.CylinderGeometry(0.08, 0.14, 1.6, 24, 1, true), []);
  // The beam fades toward the ground so it reads as light from above, not a pillar.
  const shaftAlpha = useMemo(() => radialTexture((g) => { const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.55, "rgba(255,255,255,0.55)"); grd.addColorStop(1, "rgba(255,255,255,0.12)"); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }), []);
  const shaftMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffe2a0, alphaMap: shaftAlpha, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), [shaftAlpha]);
  const shaft = useRef(); const shaftState = useRef({ active: false, age: 0, life: 3.6 });
  const rings = useRef([]); const scorches = useRef([]);
  const ringMats = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ map: ringTex, color: 0xffbb66, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })), [ringTex]);
  const scorchMats = useMemo(() => [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ map: scorchTex, color: 0x14100c, transparent: true, opacity: 0, depthWrite: false, fog: false })), [scorchTex]);
  const slots = useRef({ ring: ringMats.map(() => ({ active: false, age: 0, life: 0.5, size: 0.3 })), scorch: scorchMats.map(() => ({ active: false, age: 0, life: 6, size: 0.1 })) });
  useEffect(() => {
    const take = (arr) => arr.find((i) => !i.active) ?? arr.reduce((a, b) => (a.age > b.age ? a : b));
    Object.assign(fxApi.current ||= {}, {
      ring: (p, hex = 0xffbb66, size = 0.3, life = 0.45) => { const arr = slots.current.ring; const i = arr.indexOf(take(arr)); const m = rings.current[i]; if (!m) return; Object.assign(arr[i], { active: true, age: 0, life, size }); ringMats[i].color.setHex(hex); m.position.set(p.x, 0.008, p.z); m.visible = true; },
      // a soft gold light from above — holds for the forced window
      shaft: (p, life = 3.6) => { const m = shaft.current; if (!m) return; Object.assign(shaftState.current, { active: true, age: 0, life }); m.position.set(p.x, 0.8, p.z); m.visible = true; },
      scorch: (p, size = 0.1, hex = 0x14100c) => { const arr = slots.current.scorch; const i = arr.indexOf(take(arr)); const m = scorches.current[i]; if (!m) return; Object.assign(arr[i], { active: true, age: 0, life: 6, size }); scorchMats[i].color.setHex(hex); m.position.set(p.x, 0.005, p.z); m.rotation.z = Math.random() * Math.PI * 2; m.scale.setScalar(size); m.visible = true; },
    });
  }, [fxApi, ringMats, scorchMats]);
  useFrame((_, dt) => {
    slots.current.ring.forEach((r, i) => { const m = rings.current[i]; if (!r.active || !m) return; r.age += dt; const k = Math.min(1, r.age / r.life); m.scale.setScalar(0.03 + k * r.size); ringMats[i].opacity = Math.pow(1 - k, 1.3) * 0.95; if (r.age >= r.life) { r.active = false; m.visible = false; } });
    { const st = shaftState.current, m = shaft.current; if (st.active && m) { st.age += dt; const k = st.age / st.life; shaftMat.opacity = 0.2 * (k < 0.1 ? k / 0.1 : Math.max(0, 1 - (k - 0.1) / 0.9)); if (st.age >= st.life) { st.active = false; m.visible = false; } } }
    slots.current.scorch.forEach((r, i) => { const m = scorches.current[i]; if (!r.active || !m) return; r.age += dt; const t = r.age / r.life; scorchMats[i].opacity = 0.8 * (t < 0.35 ? 1 : Math.max(0, 1 - (t - 0.35) / 0.65)); if (r.age >= r.life) { r.active = false; m.visible = false; } });
  });
  return (
    <group name="arena-ground-fx">
      {ringMats.map((mat, i) => <mesh key={`r${i}`} ref={(el) => { rings.current[i] = el; }} geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2} frustumCulled={false} />)}
      <mesh ref={shaft} geometry={shaftGeo} material={shaftMat} visible={false} frustumCulled={false} renderOrder={2} />
      {scorchMats.map((mat, i) => <mesh key={`s${i}`} ref={(el) => { scorches.current[i] = el; }} geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={1} frustumCulled={false} />)}
    </group>
  );
}

// The pools + the burst emitters. `fxApi.current` gets the imperative surface.
function ArenaVfx({ fxApi }) {
  const low = LOW();
  // One geometry PER POOL: a VFXParticles core writes its instanced attributes
  // onto the geometry it is given, so two pools sharing one object corrupt each
  // other (the droplets once rendered as a screen-filling sphere).
  const geos = useMemo(() => ({
    sphere: new THREE.SphereGeometry(1, 10, 8),
    drop: new THREE.SphereGeometry(1, 8, 6),
    cone: new THREE.ConeGeometry(0.28, 1, 6),
    circle: new THREE.CircleGeometry(1, 32),
  }), []);
  const circleMap = useMemo(() => magicCircleTexture(), []);
  const pools = useMemo(() => ({
    sparks: { nbParticles: low ? 1500 : 4000, renderMode: RenderMode.Billboard, intensity: 3, fadeSize: [0.1, 0.1], appearance: AppearanceMode.Circular },
    spheres: { nbParticles: low ? 120 : 300, renderMode: RenderMode.Mesh, intensity: 5, fadeSize: [0.7, 0.9], fadeAlpha: [0, 1] },
    icicle: { nbParticles: low ? 30 : 60, renderMode: RenderMode.Mesh, intensity: 1.6, fadeAlpha: [0, 1], fadeSize: [0.2, 0.8] },
    writings: { nbParticles: 8, renderMode: RenderMode.Mesh, intensity: 3, fadeAlpha: [0.9, 1], fadeSize: [0.3, 0.9] },
    drops: { nbParticles: low ? 200 : 400, renderMode: RenderMode.Mesh, intensity: 2.2, fadeAlpha: [0, 0.6], fadeSize: [0.1, 0.5], gravity: [0, -1.6, 0] },
  }), [low]);
  const R = useMemo(() => FX_RECIPES(low), [low]);
  const refs = useRef({});
  const set = (k) => (el) => { refs.current[k] = el; };
  const { scene, clock } = useThree();
  useEffect(() => {
    const at = (k, pos) => refs.current[k]?.emitAtPos(pos, true);
    if (typeof window !== "undefined") window.__hmArenaDebug = { ...(window.__hmArenaDebug || {}),
      vfxPools: () => { const out = []; scene.traverse((o) => { if (o.name?.startsWith("vfx-pool-")) out.push(`${o.name}:${o.count}`); }); return out; },
      vfxAlive: (pool, now) => { let m = null; scene.traverse((o) => { if (o.name === `vfx-pool-${pool}`) m = o; }); if (!m) return null; const names = Object.keys(m.geometry.attributes); const lt = m.geometry.attributes.instanceLifetime; if (!lt) return { names }; let alive = 0; for (let i = 0; i < lt.count; i++) { const t0 = lt.array[i * 2], d = lt.array[i * 2 + 1]; if (d > 0 && now >= t0 && now < t0 + d) alive++; } return { alive, count: lt.count, names }; },
      fx: () => fxApi.current,
      fxAt: (name, [x, y, z]) => fxApi.current?.[name]?.(new THREE.Vector3(x, y, z)),
      clockNow: () => clock.getElapsedTime() };
    fxApi.current = Object.assign(fxApi.current || {}, {
      iceCast: (p) => at("iceCast", p),
      muzzle: (p) => at("iceCast", p),
      iceFreeze: (p) => { const g = p.clone(); g.y = 0.004; at("iceRing", g); at("iceSpires", g); at("iceBurst", g); },
      iceShatter: (p) => { at("iceBurst", p); at("iceShards", p); },
      strike: (p) => { at("strike", p); at("strikeFlash", p); },
      banish: (p) => at("banish", p),
      holySplash: (p) => { at("drops", p); at("steam", p); at("glass", p); },
    });
    return () => { fxApi.current = null; };
  }, [fxApi]);
  return (
    <group name="arena-vfx">
      <VFXParticles name="arena-sparks" settings={pools.sparks} />
      <VFXParticles name="arena-spheres" settings={pools.spheres} geometry={geos.sphere} />
      <VFXParticles name="arena-icicle" settings={pools.icicle} geometry={geos.cone} />
      <VFXParticles name="arena-writings" settings={pools.writings} geometry={geos.circle} alphaMap={circleMap} />
      <VFXParticles name="arena-drops" settings={pools.drops} geometry={geos.drop} />
      <VFXEmitter ref={set("iceCast")} emitter="arena-sparks" settings={R.iceCast} autoStart={false} />
      <VFXEmitter ref={set("iceRing")} emitter="arena-writings" settings={R.iceRing} autoStart={false} />
      <VFXEmitter ref={set("iceSpires")} emitter="arena-icicle" settings={R.iceSpires} autoStart={false} />
      <VFXEmitter ref={set("iceBurst")} emitter="arena-sparks" settings={R.iceBurst} autoStart={false} />
      <VFXEmitter ref={set("iceShards")} emitter="arena-icicle" settings={R.iceShards} autoStart={false} />
      <VFXEmitter ref={set("strike")} emitter="arena-sparks" settings={R.strike} autoStart={false} />
      <VFXEmitter ref={set("strikeFlash")} emitter="arena-spheres" settings={R.strikeFlash} autoStart={false} />
      <VFXEmitter ref={set("banish")} emitter="arena-sparks" settings={R.banish} autoStart={false} />
      <VFXEmitter ref={set("drops")} emitter="arena-drops" settings={R.drops} autoStart={false} />
      <VFXEmitter ref={set("steam")} emitter="arena-sparks" settings={R.steam} autoStart={false} />
      <VFXEmitter ref={set("glass")} emitter="arena-icicle" settings={R.glass} autoStart={false} />
    </group>
  );
}

// Lightning — ported from the Fable game's SpellManager.castLightning /
// buildBolt at arena scale (~0.065× its units): a sky-to-target polyline of
// open cylinders (white core inside an additive blue glow) with two branches,
// rebuilt every 50 ms for the first 75% of a 0.38 s life while a blue light
// flickers; plus a shock ring, a bluish scorch, a screen flash and a camera
// kick at the strike. Their TSL node materials become plain additive ones.
const BOLT = { life: 0.38, rebuild: 0.05, top: 1.3, jitter: 0.14, coreR: 0.004, glowR: 0.014, branchR: 0.0025, mainSegs: 14, branchSegs: 6, branches: 2 };
const BOLT_CAP = { core: BOLT.mainSegs + BOLT.branches * BOLT.branchSegs, glow: BOLT.mainSegs };
const rand = (a, b) => a + Math.random() * (b - a);
function boltPoints(from, to, segments, jitter) {
  const pts = [from.clone()];
  for (let i = 1; i < segments; i++) { const t = i / segments; const p = from.clone().lerp(to, t); const amp = jitter * Math.sin(t * Math.PI); p.x += rand(-amp, amp); p.z += rand(-amp, amp); pts.push(p); }
  pts.push(to.clone()); return pts;
}

// The ice bolt with its particle trail, the lightning bolt, and the impact
// flash light. `fxRef.current` = { type, t, from, to }.
function WeaponFx({ fxRef, fxApi }) {
  const low = LOW();
  const TR = useMemo(() => TRAILS(low), [low]);
  const boltCore = useRef(); const boltGlow = useRef();
  const boltGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), []);
  const boltCoreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), []);
  const boltGlowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3(), d: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const setSeg = (mesh, i, a, b, r) => { const { m, q, p, sc, d, up } = tmp; d.subVectors(b, a); const len = d.length() || 1e-4; sc.set(r, len, r); p.copy(a).addScaledVector(d, 0.5); q.setFromUnitVectors(up, d.normalize()); m.compose(p, q, sc); mesh.setMatrixAt(i, m); };
  const buildBolt = (fx) => {
    const core = boltCore.current, glow = boltGlow.current; if (!core || !glow) return;
    let ci = 0, gi = 0;
    const main = boltPoints(fx.top, fx.to, BOLT.mainSegs, BOLT.jitter);
    for (let i = 0; i < main.length - 1; i++) { setSeg(core, ci++, main[i], main[i + 1], BOLT.coreR); setSeg(glow, gi++, main[i], main[i + 1], BOLT.glowR); }
    for (let b = 0; b < BOLT.branches; b++) {
      const start = main[3 + Math.floor(Math.random() * (main.length - 6))];
      const end = start.clone().add(new THREE.Vector3(rand(-0.26, 0.26), -rand(0.13, Math.max(0.065, (start.y - fx.to.y) * 0.6)), rand(-0.26, 0.26)));
      end.y = Math.max(end.y, fx.to.y);
      const br = boltPoints(start, end, BOLT.branchSegs, 0.065);
      for (let i = 0; i < br.length - 1 && ci < BOLT_CAP.core; i++) setSeg(core, ci++, br[i], br[i + 1], BOLT.branchR);
    }
    core.count = ci; glow.count = gi; core.instanceMatrix.needsUpdate = true; glow.instanceMatrix.needsUpdate = true;
  };
  const proj = useRef(); const flash = useRef();
  const vialRef = useRef();
  const trail = useRef({});
  const setTrail = (k) => (el) => { trail.current[k] = el; };
  const started = useRef(null); // which fx object has had its trail started / landed
  useFrame((_, dt) => {
    const fx = fxRef.current; const pm = proj.current, fl = flash.current; const bc = boltCore.current, bg = boltGlow.current;
    if (!fx) { if (pm) pm.visible = false; if (bc) bc.visible = false; if (bg) bg.visible = false; if (fl) fl.intensity = 0; if (vialRef.current) vialRef.current.visible = false; started.current = null; return; }
    fx.t += dt;
    if (fx.type === "vial") {
      const v = vialRef.current; if (!v) return;
      const k = Math.min(1, fx.t / VIAL_FLIGHT);
      if (started.current !== fx) { started.current = fx; fx.landed = false; v.visible = true; }
      if (k < 1) {
        v.position.lerpVectors(fx.from, fx.to, k); v.position.y += Math.sin(k * Math.PI) * 0.22;
        v.rotation.x += dt * 9; v.rotation.z += dt * 4;
        fl.color.set("#ffe2a0"); fl.position.copy(v.position); fl.intensity = 0.5;
      } else {
        if (!fx.landed) {
          fx.landed = true; v.visible = false;
          fxApi.current?.holySplash(fx.to);
          fxApi.current?.ring(fx.to, 0x9fd8ff, 0.24, 1.1);
          fxApi.current?.shaft(fx.to, FORCED_PAUSE_DUR + 0.7);
          arenaKick.v = 0.25;
        }
        const b = Math.min(1, (fx.t - VIAL_FLIGHT) / 0.6);
        fl.position.copy(fx.to); fl.position.y += 0.1; fl.intensity = 1.6 * (1 - b);
        if (b >= 1) fxRef.current = null;
      }
      if (pm) pm.visible = false;
      return;
    }
    if (fx.type === "ice") {
      const k = Math.min(1, fx.t / PROJECTILE_DUR);
      if (started.current !== fx) {
        started.current = fx; fx.landed = false;
        pm.position.copy(fx.from);
        trail.current.iceCore?.start(true); trail.current.iceSparks?.start(true);
        fxApi.current?.iceCast(fx.from);
      }
      if (k < 1) {
        pm.visible = true; pm.position.lerpVectors(fx.from, fx.to, k); pm.position.y += Math.sin(k * Math.PI) * 0.05;
        fl.color.set("#7fdcff"); fl.position.copy(pm.position); fl.intensity = 1.2;
      } else {
        pm.visible = false;
        if (!fx.landed) { fx.landed = true; Object.values(trail.current).forEach((e) => e?.stop()); }
        const b = Math.min(1, (fx.t - PROJECTILE_DUR) / 0.35);
        fl.position.copy(fx.to); fl.intensity = 1.2 * (1 - b);
        if (b >= 1) fxRef.current = null;
      }
    } else if (fx.type === "lightning") {
      if (started.current !== fx) {
        started.current = fx;
        fx.top = fx.to.clone().add(new THREE.Vector3(rand(-0.2, 0.2), BOLT.top, rand(-0.2, 0.2)));
        fx.rebuild = 0; buildBolt(fx);
        bc.visible = true; bg.visible = true;
        fxApi.current?.ring(fx.to, 0x86b4ff, 0.3, 0.4);
        fxApi.current?.scorch(fx.to, 0.085, 0x10141c);
        fxApi.current?.muzzle(fx.from);
        arenaKick.v = 0.65;
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("hm-arena-flash", { detail: { strength: 0.3 } }));
      }
      fx.rebuild -= dt;
      if (fx.rebuild <= 0 && fx.t < BOLT.life * 0.75) { fx.rebuild = BOLT.rebuild; buildBolt(fx); }
      const k = Math.max(0, 1 - fx.t / BOLT.life);
      const pulse = Math.sin(fx.t * 60) * 0.25 + 0.75;
      boltCoreMat.color.setRGB(0.75 + 0.25 * pulse, 0.85 + 0.15 * pulse, 1);
      boltGlowMat.opacity = 0.3 * k;
      fl.color.set("#a8c8ff"); fl.position.copy(fx.to); fl.position.y += 0.12; fl.intensity = k * (3 + Math.random() * 3);
      if (fx.t >= BOLT.life) { bc.visible = false; bg.visible = false; fxRef.current = null; }
    }
  });
  return (
    <group>
      <mesh ref={proj} visible={false}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial color="#bfefff" emissive="#5fd4ff" emissiveIntensity={1.4} />
        {/* the trail rides the bolt */}
        <VFXEmitter ref={setTrail("iceCore")} emitter="arena-spheres" settings={TR.iceCore} autoStart={false} />
        <VFXEmitter ref={setTrail("iceSparks")} emitter="arena-sparks" settings={TR.iceSparks} autoStart={false} />
      </mesh>
      {/* the vial: a stoppered glass tube, lobbed */}
      <group ref={vialRef} visible={false}>
        <mesh><cylinderGeometry args={[0.011, 0.011, 0.034, 10]} /><meshStandardMaterial color="#d8f2ff" emissive="#7fc8ff" emissiveIntensity={0.5} transparent opacity={0.75} roughness={0.15} /></mesh>
        <mesh position={[0, 0.021, 0]}><cylinderGeometry args={[0.006, 0.006, 0.009, 8]} /><meshStandardMaterial color="#8b5a2b" roughness={0.9} /></mesh>
      </group>
      <instancedMesh ref={boltCore} args={[boltGeo, boltCoreMat, BOLT_CAP.core]} visible={false} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={boltGlow} args={[boltGeo, boltGlowMat, BOLT_CAP.glow]} visible={false} frustumCulled={false} renderOrder={3} />
      <pointLight ref={flash} color="#ff7a2a" intensity={0} distance={1.4} decay={1.5} />
    </group>
  );
}

// Muzzle tracer: a brief line from the gun to the aim point.
function Tracer({ shotRef }) {
  const line = useRef();
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)); return g; }, []);
  useFrame((_, dt) => {
    const s = shotRef.current; const l = line.current; if (!l) return;
    if (!s) { l.visible = false; return; }
    s.t += dt;
    const p = geo.attributes.position.array;
    p[0] = s.from.x; p[1] = s.from.y; p[2] = s.from.z; p[3] = s.to.x; p[4] = s.to.y; p[5] = s.to.z;
    geo.attributes.position.needsUpdate = true;
    l.visible = true; l.material.opacity = Math.max(0, 1 - s.t / 0.14);
    if (s.t > 0.14) { shotRef.current = null; l.visible = false; }
  });
  return (
    <line ref={line} geometry={geo} visible={false}>
      <lineBasicMaterial color="#ffd27a" transparent opacity={1} depthWrite={false} />
    </line>
  );
}

export default function DemonArena({ seed = "arena", required = 3, locked = false, envPreset = "hell", parabolum = false, weapon = "revolver", onCooldown, onState, onResult, onBanish, onAttack, onLockout, onSteady }) {
  const api = useRef({ resolve: () => ({ result: "done" }) });
  const [fireTick, setFireTick] = useState(0);
  const [hurtTick, setHurtTick] = useState(0);
  const shotRef = useRef(null);
  const fxRef = useRef(null);
  const fxApi = useRef(null);
  const weaponRef = useRef(weapon); weaponRef.current = weapon;
  useEffect(() => { Object.values(WEAPON_SFX).forEach((w) => { w.urls.forEach(preloadSfx); if (w.fallback) preloadSfx(w.fallback); }); }, []);
  // Per-weapon reload clocks (seconds remaining), reported to the HUD ~10×/s.
  const cdRef = useRef({ revolver: 0, lightning: 0, ice: 0 });
  const cdReportRef = useRef(0);
  useFrame((_, dt) => {
    const cd = cdRef.current; let any = false;
    for (const k in cd) { if (cd[k] > 0) { cd[k] = Math.max(0, cd[k] - dt); any = true; } }
    cdReportRef.current += dt;
    if (cdReportRef.current >= 0.1) { cdReportRef.current = 0; onCooldown?.({ ...cd }); }
  });
  const { camera, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const lockedRef = useRef(locked); lockedRef.current = locked;

  const handleAttack = useCallback(() => { setHurtTick((n) => n + 1); onAttack?.(); }, [onAttack]);

  // Aim + fire arrive on the window bus from the DOM HUD.
  useEffect(() => {
    const fire = (e) => {
      const { nx = 0, ny = 0 } = e.detail || {};
      const w = weaponRef.current in WEAPONS ? weaponRef.current : "revolver";
      if (cdRef.current[w] > 0) { onResult?.({ result: "cooldown", weapon: w }); return; }
      raycaster.setFromCamera({ x: nx, y: ny }, camera);
      const target = scene.getObjectByName("arena-demon-hit");
      const hitExact = target ? raycaster.intersectObject(target, false).length > 0 : false;
      // The shot happens regardless — the draw is the beat you asked for.
      setFireTick((n) => n + 1);
      cdRef.current[w] = WEAPONS[w].cooldown;
      if (CAST_SFX[w]) playWeaponSfx(CAST_SFX[w]);
      const muzzle = new THREE.Vector3(0.04, 0.12, 0.03);
      // Where the effect lands: the demon's body when the shot connects, else along the ray.
      const demonBody = hitExact && target ? target.getWorldPosition(new THREE.Vector3()) : null;
      const aimPoint = demonBody || raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(1.2));
      // Lightning comes down from the sky: on a miss it strikes the ground under the aim.
      const groundPoint = (() => { const o = raycaster.ray.origin, d = raycaster.ray.direction; if (d.y >= -1e-4) return null; const t = -o.y / d.y; return t > 0 && t < 3 ? o.clone().addScaledVector(d, t) : null; })();
      const lightningTo = demonBody || groundPoint || aimPoint;
      if (w === "revolver") shotRef.current = { t: 0, from: muzzle, to: aimPoint };
      else fxRef.current = { type: w, t: 0, from: muzzle, to: w === "lightning" ? lightningTo : aimPoint };
      if (lockedRef.current) { onResult?.({ result: "locked" }); return; }
      // The ice bolt lands after its flight; lightning and the revolver are instant.
      const settle = () => {
        const r = api.current.resolve(hitExact, w);
        const body = demonBody || aimPoint;
        if (r.result === "frozen") { playWeaponSfx("iceFreeze"); fxApi.current?.iceFreeze(body); }
        if (r.shattered) fxApi.current?.iceShatter(body);
        if (w === "lightning" && (r.result === "hit" || r.result === "banish")) fxApi.current?.strike(body);
        if (r.result === "banish") fxApi.current?.banish(body);
        onResult?.({ ...r, weapon: w });
      };
      if (w === "ice") setTimeout(settle, PROJECTILE_DUR * 1000); else settle();
    };
    // Holy water: a lob that always finds the demon; lands after VIAL_FLIGHT.
    const vial = () => {
      const check = api.current.vialCheck?.() || "gone";
      if (check !== "ok") { onResult?.({ result: check === "frozen" ? "vial_frozen" : "vial_gone" }); return; }
      if (fxRef.current?.type === "vial") { onResult?.({ result: "vial_inflight" }); return; }
      const target = scene.getObjectByName("arena-demon-hit");
      const to = target ? target.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.16, 0.6);
      const from = new THREE.Vector3(0.04, 0.12, 0.03);
      setFireTick((n) => n + 1);
      playWeaponSfx("vialThrow");
      fxRef.current = { type: "vial", t: 0, from, to };
      onResult?.({ result: "vial_thrown" });
      setTimeout(() => {
        const r = api.current.vialLand?.() || { result: "vial_gone" };
        if (r.result === "vial") { onSteady?.(); playWeaponSfx("vialSplash"); playWeaponSfx("vialChoir"); }
        onResult?.(r);
      }, VIAL_FLIGHT * 1000);
    };
    window.addEventListener("hm-arena-vial", vial);
    window.addEventListener("hm-arena-fire", fire);
    return () => { window.removeEventListener("hm-arena-fire", fire); window.removeEventListener("hm-arena-vial", vial); };
  }, [camera, scene, raycaster, onResult]);

  return (
    <>
      <ArenaCamera />
      <MesaTile cellSize={1} depthZ={20} envPreset={envPreset} parabolum={parabolum} />
      <ArenaCowboy fireTick={fireTick} hurtTick={hurtTick} />
      <ArenaDemon seed={seed} required={required} api={api} onState={onState} onBanish={onBanish} onAttack={handleAttack} onLockout={onLockout} />
      <Tracer shotRef={shotRef} />
      <ArenaVfx fxApi={fxApi} />
      <GroundFx fxApi={fxApi} />
      <WeaponFx fxRef={fxRef} fxApi={fxApi} />
    </>
  );
}
