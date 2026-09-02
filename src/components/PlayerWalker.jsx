"use client";

// ── PlayerWalker — v1 ground mode (decided 2026-08-27) ───────────────────────
// Third-person cowboy on the field surface. TANK CONTROLS (v3 of the scheme,
// after playtesting): A/D turn the cowboy, W/S walk forward/back, and the
// camera follows BEHIND the heading. Stable by construction — input never
// derives from the camera, so there is no orbit feedback loop (v1's
// camera-relative + follow-behind spun the world; v2's fixed yaw didn't stay
// behind the cowboy). OrbitControls/CameraFlyTo are UNMOUNTED by the page
// while walking — drei's damping update() fights any external camera writes
// even when enabled={false}.
//
// One embodied verb: stand on a FRONTIER-board cell, press E → the same
// /api/oil-wildcat route as the card button. ESC or EXIT returns to the sky.
// Desktop-only v1: no mobile stick, no collision (flat tabletop, clamped rim).
//
// Mounts INSIDE the same offset <group> as OilVoxelGrid (field-local coords,
// surface = local y 0); the follow camera works in world space.

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { playSfx, preloadSfx } from "@/lib/uiSfx";

// Dev builds cache-bust automatically (fresh GLB fetch every page reload);
// prod pins a version — bump it on release re-exports.
const MODEL = "/models/Player_Cowboy.glb?v=" +
  (process.env.NODE_ENV === "development" ? Date.now() : "3");
// Clip roster (all in-place, rotation-only — verified on export 2026-08-27):
//   Idle/Walk/Run drive locomotion · PickUp is the STAKE verb (bending to the
//   ground = planting the stake) · Cheer/Shrug are the strike/dry reactions ·
//   Receive_Hit fires on waking a demon · Magic1 on a tonic capping hell ·
//   Shoot is the demon-encounter revolver shot (E near a loose demon).
// Names follow the native Quaternius action set (NLA track names in the GLB).
const CLIP = {
  idle: "Cowboy_Idle",
  walk: "Cowboy_Walk",
  run: "Cowboy_Run",
  stake: "Cowboy_PickUp",
  cheer: "Cowboy_Celebrate",
  shrug: "Cowboy_Defeat",
  hit: "Cowboy_ReceiveHit",
  magic: "Cowboy_Slash",
  ride: "Cowboy_Sit",
  fall: "Cowboy_Fall",   // plays once on the throw; last frame = fallen, clamped
  getup: "Cowboy_GetUp", // after GETUP_DELAY in the dirt, he picks himself up
  jump: "Cowboy_Jump",   // SPACE on foot — hop (stairs, flair)
  shoot: "Cowboy_Shoot", // the demon encounter — draw + fire
  fx: "Cowboy_SlashMagic", // reserved for the Gauntlet-style bolt powers
};
const FADE = 0.18;
const HEIGHT = 0.22;        // approx world height, used only for camera look-at
// THE size knob. NOTE: three.js skinned meshes IGNORE a parent empty's scale
// (vertices follow the bones), so the GLB's Cowboy_Empty 0.29 does nothing —
// scale must be applied here (scales bones + mesh together, can't desync) or
// applied INTO the armature in Blender (safe for this rig: the clip has zero
// translation keys). displayed height = 1.02 (bind height) × WALKER_SCALE.
const WALKER_SCALE = 0.05;
// Export-facing correction: the rig's rest pose doesn't face glTF +Z, so the
// body reads 90° off the walk direction. Rule: holding W you should see his
// BACK. If you see his other side → -Math.PI/2; if he faces you → Math.PI;
// if his back → this stays. (Or re-export facing -Y in Blender and set to 0.)
const MODEL_YAW = 0; // his face pointed frame-left at π/2 → back it off 90°. If he now faces the camera, use Math.PI.
const SPEED = 0.5;          // cells/second forward
const RUN_SPEED = 1.1;      // hold Shift
const BACK_SPEED = 0.3;     // reverse is a shuffle
// FULL STOP-AND-PIVOT (Michelle, 2026-08-27): turning cancels travel — A/D
// pivot in place, W/S only move when no turn is held, so there is no walking
// arc at all. With arcs gone, the pivot rate can be brisk again (the earlier
// slow rate was compensating for wide arcs).
const TURN_RATE = 2.2;      // rad/s pivot
const CAM_BACK = 0.4, CAM_UP = 0.35; // camera is hard-locked — no lerp; scroll wheel dollies live

// ── EL DIABLO — the mechanical bull (props inside the CommercialStrip GLB:
// the saddle pivots on the bull body, so the whole ride is procedural saddle
// rotation — no skeleton needed). Daily-seeded buck script: same bull for
// everyone today, which keeps an eventual leaderboard fair.
const BULL_SADDLE = "SM_Prop_Mechanical_Bull_01_Saddle_01";
// Mesh-accurate collision (raycast vs the props' actual triangles — honors
// the entry gap; no physics engine needed). Walking slides along the wall; a
// thrown rider BOUNCES off the padding. Two-pass cast catches BACKFACES too —
// Synty walls are single-sided facing outward, so a one-pass ray walked clean
// through the ring from the inside. Ring_01 is listed for when it's exported
// (not in the current strip GLB — remember it has no cache-buster either).
const COLLIDE_NODES = [
  "SM_Prop_Mechanical_Bull_Pit_01",
  "SM_Prop_Mechanical_Bull_Ring_01",
  "SM_Prop_Mechanical_Bull_01",
];
const WALKER_RADIUS = 0.05; // collision radius at the waist
// Field-boundary clamp margin. Was 0.3 — but edge-row rigs' collision
// cylinders reach to 0.26 from the edge, so the old margin left a 0.04-wide
// rim lane: the perimeter read as walled off (2026-09-01 playtest). 0.1
// gives a real outer lane while still keeping his boots off the mesa lip.
const EDGE_MARGIN = 0.1;
const RIG_RADIUS = 0.24;    // analytic pumpjack footprint — one rig stands on
                            // every interior cell centre, so field collision
                            // is a single nearest-cell cylinder check
const WALL_THICK = 0.08;    // assumed ring-wall thickness for the unstick resolver
const RAY_H = 0.45;         // collision ray height as a fraction of HEIGHT — at
                            // his tiny scale a fixed +0.1 was above his head
// ANALYTIC ring collider — the opt2k export MERGES meshes, so the ring wall's
// triangles live inside some combined mesh no name lookup can find (why the
// raycast versions never held). The pit is a circle: model it as one, centered
// on the bull, with a doorway. TUNING: walk to the wall / stand in the gap —
// the console logs your dist & az from the bull whenever the RIDE prompt
// appears; copy those numbers into RING_RADIUS / RING_GAP_AZ.
const RING_RADIUS = 0.30;   // inner wall radius — measured from the opt2k GLB:
                            // pit outer radius 2.65 file units × 0.135 fit = 0.358,
                            // minus the padded wall's thickness
const RING_BAND = 0.07;     // wall thickness
const RING_GAP_AZ = 0;      // world azimuth of the entry gap's center
const RING_GAP_HALF = 0.5;  // half-angle of the doorway (radians)
const PIT_FLOOR_Y = 0.06;   // the padded pit pad sits above the deck — stand/land on it, not under it
const RIDE_GOAL = 8;        // rodeo standard, seconds — now the QUALIFIED RIDE
                            // flavor beat; the ride itself is endurance (the
                            // buck escalates until everyone comes off)
const RAMP_CREEP = 0.045;   // post-6s difficulty growth per second
const RAMP_MAX = 1.55;      // escalation ceiling — keeps the buck inside what
                            // the seat pose and camera were tuned for
const BEST_KEY = "eldiablo_best"; // localStorage: personal best, seconds
const LULL_AT = 0.62;       // rhythm threshold (pulse is 0.45..1): below = lull —
                            // grip refills there when the rider is near balance
// ── Balance game (the 1+3 combo): A/D counter-leans the bull's roll, SPACE
// is a timed BRACE tap on telegraphed kicks, and the rider's body wears the
// state (input lean + a grip-loss hang) instead of a fat HUD meter. ──
const LEAN_SIGN = 1;        // flips A/D polarity if playtest says it's inverted
const DEMAND_SAT = 0.35;    // seat roll (rad-ish) that asks for a FULL lean
const LEAN_VIS = 0.3;       // rad of visible rider lean at full A/D input
const HANG_MAX = 0.55;      // rad of helpless hang toward the losing side at zero grip
const LEAN_RECOVER = 0.3;   // grip/s refill when balanced (scaled down outside lulls)
const LEAN_BASE_DRAIN = 0.05; // grip/s·violence bled even in perfect balance
const LEAN_ERR_DRAIN = 0.4; // grip/s·violence per unit of lean error
const KICK_TELE = 0.5;      // seconds of coil (nose-down wind-up) before a kick
const KICK_LEN = 0.35;      // seconds the kick burst lasts (also the tap window)
const KICK_AMP = 1.9;       // buck amplitude multiplier during the kick
const KICK_EARLY = 0.15;    // tap grace before the kick lands
const KICK_COST = 0.2;      // grip lost to an unbraced kick
const KICK_REWARD = 0.05;   // grip refunded for a clean brace
const TAP_WHIFF = 0.03;     // mash discouragement — whiffed taps sting, never throw
const BULL_NEAR = 0.55;     // world units to mount
const VENDOR_NEAR = 0.6;    // world units to strike up a vendor conversation.
                            // Anchors sit at the vendor CHARACTER (behind the
                            // counter, inside the trailer), so the radius has
                            // to reach across counter-service stalls — nearest
                            // vendor wins when two are in range
const VENDOR_EYE_Y = 0.5;   // vendor eye height above the deck — where the
                            // cowboy-cam looks when facing a stall
const JUMP_V = 0.5;         // hop launch speed — apex ≈ v²/2g ≈ half his height
const JUMP_GRAV = 2.2;      // on-foot hop gravity (≈0.45s airtime)
const STEP_H = 0.05;        // auto step-up height: prop tops within this rise
                            // are stairs (walk up); anything taller is a wall
                            // until a jump carries him over it
const FOOT_LIFT = 0.012;    // boots extend below the lowest BONE (the recentre's
                            // reference) — lift the whole rig this much so the
                            // soles kiss the ground instead of sinking
// Seat correction: the Synty bull node carries an axis-remap quaternion, so
// copying the saddle's world rotation raw lays the rider flat. Tune like
// MODEL_YAW: if he's still wrong, try +Math.PI/2, or add SEAT_YAW turns.
const SEAT_PITCH = -Math.PI / 2;
const SEAT_YAW = 0;
const SEAT_UP = 0.035;      // lift the rider onto the saddle top — tune to taste
                            // (re-raised after the bone-based recentre planted him
                            // ~2 body-heights lower than the old mesh-box measure)
const SEAT_BACK = 0.0;      // fore/aft trim in the RIDER's frame (+ = back toward the cantle, − = forward)
const SEAT_LAG = 0.10;      // seconds of rotation lag behind the saddle — the
                            // low-pass both delays and clips the buck peaks
                            // (bigger = looser rider but more leg/saddle clip;
                            // 0 = the old rigid weld — the sit clip's upper-body
                            // sway supplies most of the looseness now)
const GRACE_IN = 1.5;       // seconds of gentle bull before the script bites
const RING_DIST = 0.45;     // ringside camera: just outside the pit wall…
const RING_UP = 0.2;        // …low, under the tent canopy, looking slightly up
// The throw is the show: floaty gravity + slow spin ≈ 1.2s of airtime, then a
// linger on the crash site while Receive_Hit plays, before control returns.
const THROW_GRAV = 6.4;
const THROW_SPIN = 5;       // rad/s tumble
const GETUP_DELAY = 1.2;    // seconds lying in the dirt before Cowboy_GetUp plays
const GETUP_FADE = 0.6;     // long crossfade from GetUp's last frame into idle
const LAND_LINGER = 5.1;    // fallback linger when no GetUp clip is present

// ── DEMON ENCOUNTER (on foot) ── E fires the revolver at a loose hell demon.
// The fight keeps the demon's CLICK rules (only its vulnerable pause window
// counts; a mistimed shot draws the counter + lockout) — the shot is just an
// embodied input path into HellDemon, carried over the hm-* window-event bus:
//   writes → "hm-shoot" {x,y,z}  (our world position; the demon resolves it)
//   reads  ← "hm-shot-result"    (banish|hit|far|dodge → the HUD line)
//   reads  ← "hm-demon-attack"   (its retaliation landed — flinch if close)
//   reads  ← window.__hmDemonState (per-frame demon position/window state)
const DEMON_ENGAGE = 2.4;      // world units: the SHOOT prompt appears
const DEMON_ATTACK_NEAR = 1.0; // its counter reaches the cowboy inside this
const TRACER_DUR = 0.12;       // seconds the shot streak + muzzle flash live
// The revolver (Synty SM_Wep_Revolver_01, converted with the atlas relink +
// metallic-zero fixes) rides the forearm bone — this rig has NO hand bone,
// the hand is skinned to LowerArm.R. Visible only while a demon is loose.
// Tune like MODEL_YAW: the mount log prints the bone it found; adjust POS
// (bone-local, +Y runs down the bone toward the hand) / ROT / SCALE to fit.
const GUN_MODEL = "/models/SM_Wep_Revolver_01.glb?v=" +
  (process.env.NODE_ENV === "development" ? Date.now() : "1");
const GUN_BONE = /lower.?arm.?r/i;
const GUN_POS = [0, 0.24, 0.02];
const GUN_ROT = [Math.PI / 2, 0, 0];
const GUN_SCALE = 0.6;
// Laser zap — drop a raygun "pew" at this path and it goes live (playSfx is
// silent on a missing file, so the slot ships empty).
const GUN_SFX = "/audio/demon/laser.mp3";
// ── LASER SIGHT ── the pistol is a laser now (Michelle, 2026-09-01): a
// continuous aiming beam runs from the muzzle to the demon whenever it's in
// engage range, and its color IS the rules readout — the demon publishes
// `walkerShotLands` (same gates as the shot resolver, single source of
// truth), so the beam burns HOT exactly when pressing E would land: stare
// window open, or you're inside its blind rear arc within range. Dim cyan =
// it sees you coming and will dodge. The fire pulse reuses the tracer.
const BEAM_DIM = "#4fd8cf";
const BEAM_HOT = "#eafffb";
const BEAM_DIM_OPACITY = 0.22;
const BEAM_HOT_OPACITY = 0.85;
const BEAM_RADIUS = 0.0018;
const LASER_PULSE = "#d8fff8";   // the shot itself (tracer flash)
const LASER_FLASH = "#7dffee";   // muzzle light

const UP_AXIS = new THREE.Vector3(0, 1, 0); // never mutated — tracer alignment

function buckParams() {
  const s = new Date().toISOString().slice(0, 10); // UTC day
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  const r = (n) => { h = (h * 1103515245 + 12345) | 0; return (((h >>> 16) % 1000) / 1000) * n; };
  return { p1: r(6.28), p2: r(6.28), p3: r(6.28), f1: 2.6 + r(1.4), f2: 4.2 + r(1.8), f3: 0.9 + r(0.7) };
}

useGLTF.preload(MODEL);
useGLTF.preload(GUN_MODEL);

export default function PlayerWalker({
  worldW, worldD, cellSize = 1,
  spawnCol = 0, spawnRow = 0,
  frontier = [],            // page's frontierTargets: [{ col, row, layer }]
  onWildcat,                // async ({ col, row, layer }) => result
  onExit,
  controlsRef,              // page's OrbitControls — only used in ORBIT cam mode
  onCam,                    // (mode) => void — page mounts orbit only for "orbit"
  onVendorMode,             // (bool) => void — face-to-face borrows the sky camera rig
}) {
  const group = useRef();
  const inner = useRef(); // recentre wrapper — see the fitting effect
  const hudAnchor = useRef(); // Html anchor, kept in front of the camera —
                              // drei hides Html whose anchor falls behind it,
                              // which free orbit/cowboy angles made possible
  const { scene, animations } = useGLTF(MODEL);
  const { scene: gunScene } = useGLTF(GUN_MODEL);
  const { actions, mixer } = useAnimations(animations, group);
  const { camera, scene: world, gl } = useThree();
  const keys = useRef({});
  useEffect(() => { preloadSfx(GUN_SFX); }, []); // warm the shot before the first draw
  useEffect(() => () => { delete window.__hmWalkerPos; }, []); // gaze target gone once he leaves
  const heading = useRef(Math.PI);
  const [prompt, setPrompt] = useState(null);
  const promptKeyRef = useRef(null);
  const [note, setNote] = useState("");
  const busyRef = useRef(false);
  const currentRef = useRef(null);   // the active locomotion/one-shot action
  const oneShotRef = useRef(null);   // clip name while a one-shot owns the body
  // Bull ride state — mode machine: walk | ride | thrown.
  const modeRef = useRef("walk");
  const saddleRef = useRef(null);    // strip GLB node, found lazily (loads async)
  const rideRef = useRef(null);      // { t, grip, p, savedPos, savedHeading, acc }
  const thrownRef = useRef(null);    // { vel, t }
  const nearBullRef = useRef(false);
  const camScaleRef = useRef(1); // live dolly via scroll wheel (0.45×–3×)
  const camLookWRef = useRef(0); // smoothed demon-framing gaze weight (0..~0.65)
  const [nearBull, setNearBull] = useState(false);
  const nearVendorRef = useRef(null);
  const [nearVendor, setNearVendor] = useState(null);
  const [talkingTo, setTalkingTo] = useState(null); // vendor mode — HUD + mode machine
  // Demon encounter state — mirrors of window.__hmDemonState, promoted to
  // React state only on change so the HUD re-renders without frame spam.
  const nearDemonRef = useRef(false);
  const [nearDemon, setNearDemon] = useState(false);
  const demonLooseRef = useRef(false); // a roaming demon exists, near or far
  const demonVulnRef = useRef(false);
  const [demonVuln, setDemonVuln] = useState(false);
  const demonCdRef = useRef(0);
  const [demonCd, setDemonCd] = useState(0); // whole seconds, HUD countdown
  const gunRef = useRef(null);      // the pistol Object3D riding the arm bone
  const shotFxRef = useRef(null);   // { t, from, to } while a fire pulse is alive
  const tracerRef = useRef(null);   // stretched additive pulse mesh
  const flashRef = useRef(null);    // muzzle-flash point light
  const aimBeamRef = useRef(null);  // continuous laser sight beam
  const aimDotRef = useRef(null);   // beam endpoint glow on the demon
  const jumpRef = useRef(null);       // { vy } while airborne on foot (jump OR edge-fall)
  const jumpSpacePrev = useRef(false); // SPACE edge detect for the hop
  const stairSpotRef = useRef(null);  // fortune-wagon stair-top trigger volume
  const stairFiredRef = useRef(false); // re-arms when he leaves the stairs
  const stairVisitRef = useRef(false); // this vendor visit came via the stairs
  const [riding, setRiding] = useState(false);
  const [grip, setGrip] = useState(1);
  const [rideT, setRideT] = useState(0);
  const [bestT, setBestT] = useState(0);
  const [brace, setBrace] = useState(0); // 0 riding · 1 coiling · 2 kick window — HUD cue
  // WALK starts in placement: the cowboy is hidden until the player clicks a
  // spot on the field to drop him there.
  const [placed, setPlaced] = useState(false);
  const placedRef = useRef(false);
  // Camera mode, cycled with C: follow (locked chase) → orbit (free, target
  // glued to the cowboy) → cowboy (his hat — first person on foot, bull-cam
  // in the saddle). Persists across rides within a walk session.
  const camModeRef = useRef("follow");
  const [camMode, setCamMode] = useState("follow");
  useEffect(() => {
    try { setBestT(parseFloat(localStorage.getItem(BEST_KEY) || "0")); } catch {}
  }, []);
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const camGoal = useMemo(() => new THREE.Vector3(), []);
  const camDemonPt = useMemo(() => new THREE.Vector3(), []); // last demon look point
                                                             // (survives despawn while the gaze decays)
  const lookGoal = useMemo(() => new THREE.Vector3(), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpQ2 = useMemo(() => new THREE.Quaternion(), []);
  const tmpQ3 = useMemo(() => new THREE.Quaternion(), []);
  const seatEuler = useMemo(() => new THREE.Euler(SEAT_PITCH, SEAT_YAW, 0), []);
  const pitMeshesRef = useRef(null); // collidable meshes, found lazily
  const stripBoxesRef = useRef(null); // boardwalk prop AABBs, harvested lazily
  const curtainBoxRef = useRef(null); // Photo_booth_Curtain — walk-through exit
                                      // portal back to the sky, not an obstacle
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const castO = useMemo(() => new THREE.Vector3(), []);
  const castD = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  // Click-to-place: a clean click (no drag) on open walkable ground moves the
  // cowboy there. Clicks over prop boxes are refused so vendor/booth click
  // handlers keep their meaning; rigs and the pit resolve via normal
  // collision on the next frame.
  useEffect(() => {
    const dom = gl.domElement;
    let downX = 0, downY = 0;
    const down = (e) => { downX = e.clientX; downY = e.clientY; };
    const up = (e) => {
      if (e.target !== dom) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // drag, not a click
      if (modeRef.current !== "walk") return;
      const g = group.current;
      if (!g) return;
      const rect = dom.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      // The walkable world is one horizontal plane (mesa top and deck are
      // flush) — intersect it at the field's world height.
      g.getWorldPosition(worldPos);
      const groundY = worldPos.y - g.position.y;
      const t = (groundY - raycaster.ray.origin.y) / raycaster.ray.direction.y;
      if (!(t > 0)) return;
      const hx = raycaster.ray.origin.x + raycaster.ray.direction.x * t;
      const hz = raycaster.ray.origin.z + raycaster.ray.direction.z * t;
      if (!Number.isFinite(hx) || !Number.isFinite(hz)) return; // NaN passes bounds tests
      const m = EDGE_MARGIN, ext = 1.0; // same walkable bounds as on foot
      if (hx < -worldW / 2 + m || hx > worldW / 2 - m) return;
      if (hz < -worldD / 2 - ext || hz > worldD / 2 - m) return;
      const SB = stripBoxesRef.current;
      if (SB) for (const b of SB) if (hx > b.minX && hx < b.maxX && hz > b.minZ && hz < b.maxZ) return;
      g.position.x = hx;
      g.position.z = hz;
      if (!placedRef.current) { placedRef.current = true; setPlaced(true); }
    };
    dom.addEventListener("pointerdown", down);
    dom.addEventListener("pointerup", up);
    return () => {
      dom.removeEventListener("pointerdown", down);
      dom.removeEventListener("pointerup", up);
    };
  }, [gl, camera, raycaster, ndc, worldPos, worldW, worldD]);

  // The camera is the PLAYER'S now — orbit stays live and the walker only
  // steers its target onto the character (lerped so mode changes glide
  // instead of snapping). Direct camera writes are cowboy-cam-only.
  const followTarget = useCallback((x, y, z) => {
    const c = controlsRef?.current;
    if (c) c.target.lerp(lookGoal.set(x, y, z), 0.35);
  }, [controlsRef, lookGoal]);

  // Cast against the collidable meshes, catching backfaces via a reverse pass
  // (single-sided walls: fronts face outward, so leaving the pit needs it).
  // Returns { distance, normal } with normal opposing `dir`, or null.
  const castWall = useCallback((origin, dir, far) => {
    const meshes = pitMeshesRef.current;
    if (!meshes) return null;
    raycaster.set(origin, dir);
    raycaster.far = far;
    let hits = raycaster.intersectObjects(meshes, false);
    if (hits.length && hits[0].face) {
      lookGoal.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld);
      return { distance: hits[0].distance, normal: lookGoal };
    }
    castO.copy(origin).addScaledVector(dir, far);
    castD.copy(dir).negate();
    raycaster.set(castO, castD);
    raycaster.far = far;
    hits = raycaster.intersectObjects(meshes, false);
    if (hits.length && hits[0].face) {
      lookGoal.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld).negate();
      return { distance: Math.max(0, far - hits[0].distance), normal: lookGoal };
    }
    return null;
  }, [raycaster, lookGoal, castO, castD]);

  // The circle-with-a-doorway constraint: if a position falls inside the
  // ring wall's band (outside the gap), snap to the nearest free side; with
  // a velocity, also reflect its radial component into the padding.
  const constrainRing = useCallback((g, vel) => {
    const s = saddleRef.current;
    if (!s) return null;
    s.getWorldPosition(castO);
    g.getWorldPosition(worldPos);
    const dx = worldPos.x - castO.x, dz = worldPos.z - castO.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) return dist;
    let dAz = Math.atan2(dx, dz) - RING_GAP_AZ;
    while (dAz > Math.PI) dAz -= 2 * Math.PI;
    while (dAz < -Math.PI) dAz += 2 * Math.PI;
    if (Math.abs(dAz) < RING_GAP_HALF) return dist; // the doorway
    const innerL = RING_RADIUS - WALKER_RADIUS;
    const outerL = RING_RADIUS + RING_BAND + WALKER_RADIUS;
    if (dist <= innerL || dist >= outerL) return dist;
    const target = (dist - innerL < outerL - dist) ? innerL : outerL;
    const nx = dx / dist, nz = dz / dist;
    g.position.x += nx * (target - dist);
    g.position.z += nz * (target - dist);
    if (vel) {
      const vr = vel.x * nx + vel.z * nz;
      vel.x = (vel.x - 2 * vr * nx) * 0.4;
      vel.z = (vel.z - 2 * vr * nz) * 0.4;
    }
    return target;
  }, []);

  // Slide-or-block a horizontal step against the walls. `dir` is a unit
  // vector (mutated to the slide direction); returns the allowed step length.
  const collideStep = useCallback((origin, dir, step) => {
    let hit = castWall(origin, dir, step + WALKER_RADIUS);
    if (!hit) return step;
    hit.normal.y = 0;
    if (hit.normal.lengthSq() < 1e-6) return Math.max(0, hit.distance - WALKER_RADIUS);
    hit.normal.normalize();
    const d = dir.dot(hit.normal);
    if (d < 0) dir.addScaledVector(hit.normal, -d);
    if (dir.lengthSq() < 1e-4) return 0;
    dir.normalize();
    hit = castWall(origin, dir, step + WALKER_RADIUS);
    if (hit) return Math.max(0, hit.distance - WALKER_RADIUS);
    return step;
  }, [castWall]);

  const cellX = useCallback((c) => -worldW / 2 + c * cellSize + cellSize / 2, [worldW, cellSize]);
  const cellZ = useCallback((r) => worldD / 2 - r * cellSize - cellSize / 2, [worldD, cellSize]);

  // One tiny state machine: crossfade between loops, or fire a one-shot that
  // owns the body until it finishes (or movement interrupts it).
  const playClip = useCallback((name, { once = false, timeScale = 1, fade = FADE } = {}) => {
    const next = actions?.[name];
    if (!next) return;
    if (currentRef.current === next && !once) { next.timeScale = timeScale; return; }
    const prev = currentRef.current;
    next.reset();
    next.timeScale = timeScale;
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      oneShotRef.current = name;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (prev && prev !== next) next.crossFadeFrom(prev, fade, false);
    next.play();
    currentRef.current = next;
  }, [actions]);

  // Bind + recentre. IMPORTANT: the model must already be mounted when play()
  // runs — actions bind their tracks to the group's subtree at that moment (a
  // T-pose that still moves = tracks bound to nothing). THEN recentre: the
  // export's mesh sits off its own origin, so pivoting swung the body in an
  // arc around the group origin. Measure the POSED model and put the
  // feet-center exactly at the group origin.
  useEffect(() => {
    const g = group.current, off = inner.current;
    if (!actions?.[CLIP.idle] || !g || !off) return;
    // Cowboy_GetUp's bake carries root translation that teleports the armature
    // horizontally at clip start. Lock every translation track's X/Z to its
    // frame-0 value — Y (the rise) is preserved, constant bind-offset tracks
    // are untouched by construction, and the in-place mutation feeds the
    // already-built action (interpolants read these arrays live).
    // FULL position freeze (all axes → frame-0) for BOTH throw clips. This
    // bake carries root translation on every clip; Fall's displaced the
    // visible body away from the logical group (the mid-air "disappearance",
    // the lying-on-the-rim), and GetUp's yanked it back ("moved to the
    // left"). Rotations alone perform both moves; the group owns position.
    // (The clean authoring fix remains: delete root location F-curves on
    // these two actions in Blender.)
    // No runtime position freeze. It existed to tame Mixamo-retargeted clips
    // (baked translation on every bone slid the armature); the native
    // Quaternius set carries legit translation, and its Fall/GetUp were
    // authored travel-free in Blender. Authoring is the source of truth now.
    playClip(CLIP.idle);
    mixer?.update(0);
    // Measure the posed BONES, not the mesh box: Box3.setFromObject on a
    // SkinnedMesh reads a cached bind/pose-dependent box (the useGLTF scene is
    // shared, so it can be stale from another mount) — that's what floated the
    // body two heights over the saddle. Bones always carry the live pose.
    // Measure from a zeroed offset so nothing leaks into the correction.
    off.position.set(0, 0, 0);
    g.updateWorldMatrix(true, true);
    const pts = [];
    off.traverse((o) => { if (o.isBone) pts.push(o.getWorldPosition(new THREE.Vector3())); });
    if (pts.length) {
      let minY = Infinity, maxY = -Infinity, cx = 0, cz = 0;
      for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); cx += p.x; cz += p.z; }
      cx /= pts.length; cz /= pts.length;
      const feetLocal = g.worldToLocal(new THREE.Vector3(cx, minY, cz));
      off.position.set(-feetLocal.x, -feetLocal.y + FOOT_LIFT, -feetLocal.z);
      console.log(`[PlayerWalker] posed bone span ${(maxY - minY).toFixed(2)} world units (cells are 1.0) · recentre offset`,
        feetLocal.toArray().map((v) => v.toFixed(2)));
    }
    // One-shots hand the body back when they finish.
    const onFinished = () => { oneShotRef.current = null; };
    mixer?.addEventListener("finished", onFinished);
    return () => {
      mixer?.removeEventListener("finished", onFinished);
      mixer?.stopAllAction();
      // Leaving mid-ride (EXIT button) must not strand the saddle mid-buck.
      const s = saddleRef.current;
      if (s?.userData.baseRot) s.rotation.copy(s.userData.baseRot);
    };
  }, [actions, mixer, playClip]);

  // Mount the revolver on the forearm bone (this rig has no hand bone). The
  // GLTFLoader sanitizes node names ("LowerArm.R" may arrive as "LowerArmR"),
  // so the bone is found by fuzzy match. Hidden until a demon is loose — the
  // draw IS the encounter telegraph; a permanently-armed cowboy reads wrong
  // at the vendor stalls.
  useEffect(() => {
    const off = inner.current;
    if (!off || !gunScene || !actions?.[CLIP.idle]) return;
    let bone = null;
    off.traverse((o) => { if (!bone && o.isBone && GUN_BONE.test(o.name)) bone = o; });
    if (!bone) {
      console.warn("[PlayerWalker] revolver: no bone matching", GUN_BONE);
      return;
    }
    const gun = gunScene.clone(true); // the useGLTF scene is a shared cache
    gun.position.set(...GUN_POS);
    gun.rotation.set(...GUN_ROT);
    gun.scale.setScalar(GUN_SCALE);
    gun.visible = false;
    // Neon rim: the six-shooter reads as a laser-modified sidearm. An
    // inverted-hull shell (backfaces, additive, slightly inflated) rims the
    // silhouette in the laser's color, plus a subtle emissive lift on the
    // metal itself. Collect meshes BEFORE adding shells — traverse walks
    // live children, so adding during the walk would shell the shells.
    const shellMat = new THREE.MeshBasicMaterial({
      color: LASER_FLASH, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
    });
    const gunMeshes = [];
    gun.traverse((o) => { if (o.isMesh) gunMeshes.push(o); });
    gunMeshes.forEach((o) => {
      o.material = o.material.clone(); // the GLB cache shares materials
      if (o.material.emissive) {
        o.material.emissive.set(LASER_FLASH);
        o.material.emissiveIntensity = 0.3;
      }
      const shell = new THREE.Mesh(o.geometry, shellMat);
      shell.scale.setScalar(1.06);
      o.add(shell);
    });
    bone.add(gun);
    gunRef.current = gun;
    console.log(`[PlayerWalker] revolver mounted on bone "${bone.name}"`);
    return () => { bone.remove(gun); gunRef.current = null; };
  }, [gunScene, actions]);

  // Fallback position beside the rig — invisible until the player clicks the
  // field to place him (the pointer handler below), so the camera stays in
  // the sky while they aim. The follow cam takes over the moment he lands.
  useEffect(() => {
    if (group.current) group.current.position.set(cellX(spawnCol) + 0.45, 0, cellZ(spawnRow) + 0.25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dig = useCallback(async () => {
    const target = promptKeyRef.current && frontier.find(
      (f) => `${f.col}_${f.row}` === promptKeyRef.current);
    if (!target || busyRef.current || !onWildcat) return;
    busyRef.current = true;
    playClip(CLIP.stake, { once: true }); // bend down, plant the stake
    setNote("⛏ well staked — the rig drills…");
    try {
      const r = await onWildcat(target);
      if (r?.hell) {
        playClip(r.tonicCapped ? CLIP.magic : CLIP.hit, { once: true });
        setNote(r.tonicCapped ? "☠ the bit hit HELL — tonic capped it" : "☠ WOKE A DEMON");
      } else if (r?.oil > 0 || r?.inclusion) {
        playClip(CLIP.cheer, { once: true });
        setNote(r?.oil > 0
          ? `✔ STRUCK — ${Math.round(r.oil).toLocaleString()} BTR banked${r.inclusion ? " · the bit brought up an inclusion → ARTIFACTS" : ""}`
          : "✔ dry… but the bit brought up an inclusion");
      } else {
        playClip(CLIP.shrug, { once: true });
        setNote("✗ dry hole");
      }
    } catch (e) {
      playClip(CLIP.shrug, { once: true });
      setNote(`✗ ${e.message || "failed"}`);
    } finally {
      busyRef.current = false;
    }
  }, [frontier, onWildcat, playClip]);

  // ── Demon encounter: the revolver shot ─────────────────────────────────────
  // Fires instantly on E (responsiveness beats animation sync in a timing
  // game): square up to the demon, play the draw, flash + tracer, and hand the
  // resolution to HellDemon over the bus — ITS rules decide hit/dodge/banish.
  const shoot = useCallback(() => {
    const g = group.current, D = window.__hmDemonState;
    if (!g || !D || D.done) return;
    if (demonCdRef.current > 0) {
      setNote(`✗ still shaken from its counter — ${Math.ceil(demonCdRef.current)}s`);
      return;
    }
    g.getWorldPosition(worldPos);
    // Square up: snap the heading onto the demon before the draw.
    heading.current = Math.atan2(D.x - worldPos.x, D.z - worldPos.z);
    g.rotation.y = heading.current;
    oneShotRef.current = null;
    playClip(CLIP.shoot, { once: true });
    playSfx(GUN_SFX, { volume: 0.6 });
    // Tracer runs muzzle → demon center; endpoints are stored in WORLD space
    // and converted to the FX meshes' parent space each frame (the field
    // group is offset from the world origin).
    const from = new THREE.Vector3();
    if (gunRef.current) gunRef.current.getWorldPosition(from);
    else from.copy(worldPos).add(tmpV.set(0, HEIGHT * 0.7, 0));
    const to = new THREE.Vector3(D.x, D.y + 0.22, D.z);
    shotFxRef.current = { t: 0, from, to };
    window.dispatchEvent(new CustomEvent("hm-shoot", {
      detail: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
    }));
  }, [playClip, worldPos, tmpV]);

  // The demon reports how each shot resolved — the HUD line tells the story.
  useEffect(() => {
    const onResult = (e) => {
      const d = e.detail || {};
      if (d.result === "banish")
        setNote(d.backstab ? "🔥 SHOT IN THE BACK — BANISHED, the bounty is claimed"
          : "🔥 BANISHED — the bounty is claimed");
      else if (d.result === "hit")
        setNote(`◆ ${d.backstab ? "GOT THE DROP ON IT" : "CLEAN HIT"} — ${"◆".repeat(d.hits)}${"◇".repeat(Math.max(0, d.required - d.hits))}`);
      else if (d.result === "far") setNote("✗ out of range — close in before its pause ends");
      else if (d.result === "dodge") setNote("☠ THE DEMON DODGES — brace for its counter");
    };
    window.addEventListener("hm-shot-result", onResult);
    return () => window.removeEventListener("hm-shot-result", onResult);
  }, []);

  // Its counter lands (after the flinch beat): flinch too if we're inside its
  // reach. The page's camera shake fires regardless; no economic damage — the
  // lockout is the penalty, same as the click fight.
  useEffect(() => {
    const onAtk = (e) => {
      const g = group.current, d = e.detail || {};
      if (!g || modeRef.current !== "walk" || !placedRef.current || d.x == null) return;
      g.getWorldPosition(worldPos);
      if (Math.hypot(d.x - worldPos.x, d.z - worldPos.z) > DEMON_ATTACK_NEAR) return;
      oneShotRef.current = null;
      playClip(CLIP.hit, { once: true });
      setNote("🔥 its claws rake you — it doesn't like you this close");
    };
    window.addEventListener("hm-demon-attack", onAtk);
    return () => window.removeEventListener("hm-demon-attack", onAtk);
  }, [playClip, worldPos]);

  // ── Bull ride ──────────────────────────────────────────────────────────────
  // Bail out (ESC/EXIT) — an abandoned ride, not a scored one. Getting
  // thrown is the only way a ride ends on its own now: endurance mode.
  const endRide = useCallback(() => {
    const R = rideRef.current, s = saddleRef.current, g = group.current;
    if (s?.userData.baseRot) s.rotation.copy(s.userData.baseRot);
    modeRef.current = "walk";
    setRiding(false);
    if (g && R) {
      g.position.copy(R.savedPos);
      g.quaternion.set(0, 0, 0, 1);
      heading.current = R.savedHeading;
      g.rotation.y = heading.current;
    }
    rideRef.current = null;
  }, []);

  // Leaving a vendor face-to-face, by ESC here or by the strip's own exit
  // (clicking the vendor again) — the strip broadcasts "hm-vendor-left".
  const leaveVendor = useCallback((notifiedByStrip) => {
    if (modeRef.current !== "vendor") return;
    modeRef.current = "walk";
    setTalkingTo(null);
    onVendorMode?.(false);
    if (!notifiedByStrip) window.dispatchEvent(new CustomEvent("hm-vendor-exit"));
    // A stair-triggered visit ends back at the FOOT of the stairs, facing the
    // boardwalk — reads as walking out, and re-arms the stair trigger.
    const S = stairSpotRef.current, g = group.current;
    if (stairVisitRef.current && S && g) {
      g.position.set((S.frame.sMinX + S.frame.sMaxX) / 2, 0, S.frame.sMaxZ + 0.08);
      heading.current = 0;
      g.quaternion.set(0, 0, 0, 1);
      g.rotation.y = 0;
      jumpRef.current = null;
    }
    stairVisitRef.current = false;
  }, [onVendorMode]);
  useEffect(() => {
    const onLeft = () => leaveVendor(true);
    window.addEventListener("hm-vendor-left", onLeft);
    return () => window.removeEventListener("hm-vendor-left", onLeft);
  }, [leaveVendor]);

  const startRide = useCallback(() => {
    const g = group.current, s = saddleRef.current;
    if (!g || !s || modeRef.current !== "walk") return;
    // Ringside camera stands where the rider walked up from.
    s.getWorldPosition(tmpV);
    g.getWorldPosition(worldPos);
    const camAz = Math.atan2(worldPos.x - tmpV.x, worldPos.z - tmpV.z);
    const p = buckParams();
    rideRef.current = {
      t: 0, grip: 1, acc: 0, p, camAz,
      savedPos: g.position.clone(), savedHeading: heading.current,
      // balance-game state
      lean: 0, spacePrev: false, kickAbsorbed: false,
      seatQ: g.quaternion.clone(), // seat spring state — see the ride branch
      // first kick = first rhythm peak after the grace-in
      kickK: Math.max(1, Math.ceil((2 * p.f3 + p.p3 - Math.PI / 2) / Math.PI)),
    };
    modeRef.current = "ride";
    setRiding(true); setGrip(1); setRideT(0);
    playClip(CLIP.ride); // the straddle — regulation rodeo form
    setNote("🐂 EL DIABLO — A/D lean into the throw · when he coils, tap SPACE on the kick");
  }, [playClip]);

  useEffect(() => {
    const dn = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      if (e.code === "Space") e.preventDefault(); // grip key — don't scroll the page
      keys.current[e.code] = true;
      if (e.code === "Escape") {
        if (modeRef.current === "ride") endRide();
        else if (modeRef.current === "vendor") leaveVendor(false);
        else onExit?.();
      }
      if (e.code === "KeyE") {
        // A loose demon outranks every other verb — it's the event.
        if (modeRef.current === "walk" && nearDemonRef.current) shoot();
        else if (modeRef.current === "walk" && nearBullRef.current) startRide();
        else if (modeRef.current === "walk" && nearVendorRef.current) {
          const v = nearVendorRef.current;
          modeRef.current = "vendor";
          setTalkingTo(v);
          onVendorMode?.(true);
          playClip(CLIP.idle); // stand politely for the scene
          window.dispatchEvent(new CustomEvent("hm-vendor-enter", { detail: { id: v.id } }));
        } else if (modeRef.current === "walk" && demonLooseRef.current) {
          // Out of range of a loose demon: say so instead of silently
          // falling through to dig — drilling is blockaded during the hunt
          // anyway, and a dead E-press reads as a broken gun.
          setNote("✗ too far — close in on the demon to shoot");
        } else if (modeRef.current === "walk") dig();
      }
      if (e.code === "KeyC") {
        const order = ["follow", "orbit", "cowboy"];
        const next = order[(order.indexOf(camModeRef.current) + 1) % order.length];
        camModeRef.current = next;
        setCamMode(next);
        onCam?.(next); // page mounts/unmounts OrbitControls accordingly
      }
      // Laptop-friendly zoom: − / = step the camera dolly (key repeat makes
      // holding them smooth); same clamp as the wheel.
      if (e.code === "Minus") {
        camScaleRef.current = THREE.MathUtils.clamp(camScaleRef.current * 1.12, 0.45, 3);
      }
      if (e.code === "Equal") {
        camScaleRef.current = THREE.MathUtils.clamp(camScaleRef.current / 1.12, 0.45, 3);
      }
    };
    const up = (e) => { keys.current[e.code] = false; };
    const wheel = (e) => {
      camScaleRef.current = THREE.MathUtils.clamp(
        camScaleRef.current * (e.deltaY > 0 ? 1.08 : 1 / 1.08), 0.45, 3);
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
      window.removeEventListener("wheel", wheel);
    };
  }, [dig, shoot, onExit, startRide, endRide, onCam, onVendorMode, leaveVendor]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Keep the HUD's anchor in front of the camera in every mode (ride and
    // thrown return early below, so this must run first).
    const ha = hudAnchor.current;
    if (ha) {
      camera.getWorldDirection(castD);
      ha.position.copy(camera.position).addScaledVector(castD, 0.6);
      ha.parent.worldToLocal(ha.position);
    }
    // Laser sight defaults to hidden every frame — the walk-mode demon block
    // below re-shows it, so mode changes/early returns can't strand a beam.
    if (aimBeamRef.current) aimBeamRef.current.visible = false;
    if (aimDotRef.current) aimDotRef.current.visible = false;
    // Shot FX: one pulse + muzzle flash, alive for TRACER_DUR. Runs in every
    // mode so a shot's pulse finishes even if its outcome changes the mode.
    const FX = shotFxRef.current;
    if (FX) {
      FX.t += dt;
      const k = 1 - FX.t / TRACER_DUR;
      const tr = tracerRef.current, fl = flashRef.current;
      if (k <= 0) {
        if (tr) tr.visible = false;
        if (fl) fl.intensity = 0;
        shotFxRef.current = null;
      } else {
        if (tr) {
          tr.visible = true;
          tmpV.copy(FX.from); tr.parent.worldToLocal(tmpV);
          lookGoal.copy(FX.to); tr.parent.worldToLocal(lookGoal);
          tr.position.copy(tmpV).add(lookGoal).multiplyScalar(0.5);
          castD.copy(lookGoal).sub(tmpV);
          const len = castD.length();
          tr.scale.set(0.005, Math.max(0.01, len), 0.005);
          if (len > 1e-4) tr.quaternion.setFromUnitVectors(UP_AXIS, castD.divideScalar(len));
          tr.material.opacity = 0.9 * k;
        }
        if (fl) {
          fl.position.copy(FX.from);
          fl.parent.worldToLocal(fl.position);
          fl.intensity = 3 * k;
        }
      }
    }
    // Publish his world position for the vendors' head tracking — a nearby
    // cowboy outranks the camera as something to look at.
    if (placedRef.current) {
      g.getWorldPosition(worldPos);
      const wpub = (window.__hmWalkerPos = window.__hmWalkerPos || { x: 0, y: 0, z: 0 });
      wpub.x = worldPos.x; wpub.y = worldPos.y; wpub.z = worldPos.z;
    }
    // Lazily find the bull saddle + pit ring in the strip GLB (loads async).
    if (!saddleRef.current) {
      const s = world.getObjectByName(BULL_SADDLE);
      if (s) { saddleRef.current = s; s.userData.baseRot = s.rotation.clone(); }
    }
    if (!pitMeshesRef.current) {
      const meshes = [];
      for (const name of COLLIDE_NODES) {
        const node = world.getObjectByName(name);
        if (node) node.traverse((o) => { if (o.isMesh) meshes.push(o); });
      }
      if (meshes.length) pitMeshesRef.current = meshes;
    }
    // Harvest boardwalk obstacles ONCE from the loaded strip: every named prop
    // kept its node through the merge, so their world AABBs are free. Filters:
    // no deck/bull (handled elsewhere), nothing structural-huge, nothing
    // trinket-tiny, nothing hanging above hat height (string lights, canopy),
    // nothing wholly under the deck. Boxes are pre-inflated by the walker
    // radius so the resolve below is a plain point-in-box test.
    if (!stripBoxesRef.current) {
      const deck = world.getObjectByName("Boardwalk");
      if (deck && deck.geometry) {
        deck.updateWorldMatrix(true, false);
        deck.geometry.computeBoundingBox();
        const deckBox = deck.geometry.boundingBox.clone().applyMatrix4(deck.matrixWorld);
        const deckTop = deckBox.max.y;
        const boxes = [];
        const b = new THREE.Box3();
        deck.parent.updateWorldMatrix(true, true);
        deck.parent.traverse((o) => {
          if (!o.isMesh || o === deck || !o.geometry) return;
          // The fortune wagon body (SM_Veh_Wagon_01, no suffix): its rotated
          // AABB blankets its own staircase and doorway — fully excluded. The
          // .001 sibling wagon stays solid.
          if (/Mechanical_Bull|Boardwalk|^SM_Veh_Wagon_01$/.test(o.name)) return;
          // Stair pieces are FLOOR-ONLY: the frame's box top is the landing,
          // and the treads must never wall (Step2's inflated box overhangs
          // Step1's tread, which forced a jump to start the climb).
          const floorOnly = /^Steps$|^Step\d+$/.test(o.name);
          o.geometry.computeBoundingBox();
          b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          // The booth curtain is a DOORWAY: step through it to leave the
          // field for the sky. Trigger volume, not a wall.
          if (/photo.?booth.?curtain/i.test(o.name)) {
            curtainBoxRef.current = {
              minX: b.min.x - WALKER_RADIUS, maxX: b.max.x + WALKER_RADIUS,
              minZ: b.min.z - WALKER_RADIUS, maxZ: b.max.z + WALKER_RADIUS,
            };
            return;
          }
          const hx = (b.max.x - b.min.x) / 2, hz = (b.max.z - b.min.z) / 2;
          if (hx > 1.2 || hz > 1.2) return;        // structural — skip
          if (hx < 0.015 && hz < 0.015) return;    // trinket — skip
          if (b.min.y > deckTop + 0.12) return;    // overhead — skip
          if (b.max.y < deckTop + 0.02) return;    // under-deck — skip
          g.getWorldPosition(worldPos);
          boxes.push({
            name: o.name,
            floorOnly,
            // Inflated footprint: WALLS push one walker-radius early so his
            // body never clips the mesh.
            minX: b.min.x - WALKER_RADIUS, maxX: b.max.x + WALKER_RADIUS,
            minZ: b.min.z - WALKER_RADIUS, maxZ: b.max.z + WALKER_RADIUS,
            // Tight footprint: FLOORS only support him over actual geometry —
            // the inflated bounds made him hover beside crates.
            sMinX: b.min.x, sMaxX: b.max.x, sMinZ: b.min.z, sMaxZ: b.max.z,
            // Standable top in WALKER-LOCAL height (world minus the mesa lift)
            top: b.max.y - (worldPos.y - g.position.y),
          });
        });
        stripBoxesRef.current = boxes;
        console.log(`[PlayerWalker] boardwalk colliders: ${boxes.length} prop boxes`);
      }
    }

    // Placement phase: stay hidden in the sky until the drop-in click lands.
    if (!placedRef.current) return;

    // Face-to-face with a vendor: the sky rig owns the camera; he stands and
    // idles right where he is until ESC walks away.
    if (modeRef.current === "vendor") return;

    // ── RIDE: the daily buck script drives the saddle; the cowboy is seated
    // on it; SPACE is grip. Violent phases drain grip, lulls restore it. ──
    if (modeRef.current === "ride") {
      const R = rideRef.current, s = saddleRef.current;
      if (!R || !s) { modeRef.current = "walk"; setRiding(false); return; }
      R.t += dt;
      const { p1, p2, p3, f1, f2, f3 } = R.p;
      const grace = Math.min(1, R.t / GRACE_IN); // let the rider find the rhythm
      // Endurance curve: the old ramp to 1.0 by ~6s, then El Diablo keeps
      // escalating — nobody rides him forever. The cap keeps the buck inside
      // what the seat/legs were posed for.
      const ramp = R.t < 6 ? 0.25 + R.t / RIDE_GOAL
        : Math.min(RAMP_MAX, 1 + (R.t - 6) * RAMP_CREEP);
      // `pulse` is the bull's RHYTHM (0.45..1, same shape at every difficulty);
      // `violence` scales it by the escalation.
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(R.t * f3 + p3));
      const violence = grace * ramp * pulse;
      // KICK CLOCK — the rhythm's peaks are choreographed kicks. Each one
      // telegraphs first: the bull coils nose-down for KICK_TELE seconds,
      // then bursts. Deterministic from the daily seed, so today's bull has
      // moves a rider can learn.
      const tKick = (Math.PI / 2 + R.kickK * Math.PI - p3) / f3;
      const winding = R.t > tKick - KICK_TELE && R.t < tKick;
      const kicking = R.t >= tKick && R.t < tKick + KICK_LEN;
      const amp = 0.38 * violence * (kicking ? KICK_AMP : 1);
      const coil = winding ? -0.13 * ((R.t - (tKick - KICK_TELE)) / KICK_TELE) : 0;
      s.rotation.set(
        s.userData.baseRot.x + Math.sin(R.t * f1 + p1) * amp + coil,
        s.userData.baseRot.y + Math.sin(R.t * f2 + p2) * amp * 0.8,
        s.userData.baseRot.z + Math.sin(R.t * (f1 * 0.63) + p2) * amp * 0.6);
      // The rodeo standard is a flavor beat now, not the finish line.
      if (!R.qualified && R.t >= RIDE_GOAL) {
        R.qualified = true;
        setNote(`⏱ ${RIDE_GOAL} SECONDS — a QUALIFIED RIDE · El Diablo is just warming up`);
      }
      // Seat the cowboy on the saddle (world → parent-local).
      s.getWorldPosition(tmpV);
      s.getWorldQuaternion(tmpQ);
      g.position.copy(tmpV);
      g.parent.worldToLocal(g.position);
      g.position.y += SEAT_UP; // perch on the saddle top, not inside it
      g.parent.getWorldQuaternion(tmpQ2).invert();
      tmpQ2.multiply(tmpQ);
      // Undo the prop's axis remap so the rider sits upright.
      tmpQ2.multiply(tmpQ3.setFromEuler(seatEuler));
      // ── BALANCE: how hard is the seat trying to spill him sideways?
      // (lookGoal is scratch: world-up seen from the seat frame — its x is
      // the roll the rider must counter with A/D.)
      lookGoal.set(0, 1, 0).applyQuaternion(tmpQ.copy(tmpQ2).invert());
      const demand = LEAN_SIGN * THREE.MathUtils.clamp(-lookGoal.x / DEMAND_SAT, -1, 1);
      const leanIn = (keys.current.KeyD || keys.current.ArrowRight ? 1 : 0)
        - (keys.current.KeyA || keys.current.ArrowLeft ? 1 : 0);
      R.lean += (leanIn - R.lean) * Math.min(1, dt * 8);
      const error = Math.abs(R.lean - demand); // 0 = countered · 2 = fighting it
      // Leaning with the demand nearly stops the bleed; ignoring it drains
      // fast. Rhythm troughs refill grip while he's near balance.
      const lull = pulse < LULL_AT;
      R.grip = THREE.MathUtils.clamp(R.grip
        + dt * LEAN_RECOVER * Math.max(0, 1 - error * 1.5) * (lull ? 1 : 0.25)
        - dt * violence * (LEAN_BASE_DRAIN + LEAN_ERR_DRAIN * error), 0, 1);
      // SPACE is a timed BRACE now, not a hold: tap inside the kick window.
      const spaceNow = !!keys.current.Space;
      const tapped = spaceNow && !R.spacePrev;
      R.spacePrev = spaceNow;
      if (tapped) {
        if (R.t > tKick - KICK_EARLY && R.t < tKick + KICK_LEN) R.kickAbsorbed = true;
        else R.grip = Math.max(0.01, R.grip - TAP_WHIFF); // whiffs sting, never throw
      }
      if (R.t >= tKick + KICK_LEN) { // kick resolved — settle up, arm the next
        R.grip = THREE.MathUtils.clamp(
          R.grip + (R.kickAbsorbed ? KICK_REWARD : -KICK_COST), 0, 1);
        R.kickAbsorbed = false;
        R.kickK += 1;
      }
      R.acc += dt;
      if (R.acc > 0.1) {
        R.acc = 0; setGrip(R.grip); setRideT(R.t);
        setBrace(winding ? 1 : kicking ? 2 : 0);
      }
      // Lagged follow, not a weld — the spring state lives in R.seatQ so the
      // display-only body english below can't feed back into it.
      R.seatQ.slerp(tmpQ2, 1 - Math.exp(-dt / SEAT_LAG));
      // Display = spring + body english: the input lean, plus a grip-loss
      // hang toward whichever side the bull is currently winning on.
      g.quaternion.copy(R.seatQ).multiply(tmpQ3.setFromAxisAngle(
        lookGoal.set(0, 0, 1),
        R.lean * LEAN_VIS - demand * (1 - R.grip) * HANG_MAX));
      // Fore/aft trim in the rider's own frame, so it tracks the buck.
      // (camGoal is free in ride mode — reused as a scratch vector.)
      camGoal.set(0, 0, -SEAT_BACK).applyQuaternion(g.quaternion);
      g.position.add(camGoal);
      if (camModeRef.current === "cowboy") {
        // Cowboy-cam: at his hat, looking wherever the bull points him.
        g.getWorldPosition(worldPos);
        camera.position.set(worldPos.x, worldPos.y + 0.15, worldPos.z);
        lookGoal.set(0, 0, 1).applyQuaternion(g.quaternion);
        lookGoal.y *= 0.3; // keep the horizon mostly level enough to read
        if (lookGoal.lengthSq() < 0.01) lookGoal.set(Math.sin(R.camAz + Math.PI), 0, Math.cos(R.camAz + Math.PI));
        camera.lookAt(worldPos.x + lookGoal.x, worldPos.y + 0.15 + lookGoal.y, worldPos.z + lookGoal.z);
      } else if (camModeRef.current === "orbit") {
        // Free orbit — the player frames the ride; the target stays glued.
        g.getWorldPosition(camGoal);
        followTarget(camGoal.x, camGoal.y + HEIGHT * 0.5, camGoal.z);
      } else {
        // FOLLOW: the classic ringside shot — on the side the rider mounted
        // from, framing the RIDER (bucks carried the saddle out of frame).
        // +/− and the wheel dolly it live.
        const rcs = camScaleRef.current;
        camera.position.set(
          tmpV.x + Math.sin(R.camAz) * RING_DIST * rcs,
          tmpV.y + RING_UP * rcs,
          tmpV.z + Math.cos(R.camAz) * RING_DIST * rcs);
        g.getWorldPosition(camGoal);
        camera.lookAt(camGoal.x, camGoal.y + HEIGHT * 0.5, camGoal.z);
      }
      if (R.grip <= 0) {
        modeRef.current = "thrown";
        setRiding(false);
        // Launch UPRIGHT: keep only the yaw of the ride orientation, so the
        // tumble, the lying pose, and the get-up all start from level —
        // residual seat roll used to survive the landing as a lean.
        lookGoal.set(0, 0, 1).applyQuaternion(g.quaternion);
        g.quaternion.set(0, 0, 0, 1);
        g.rotation.y = Math.atan2(lookGoal.x, lookGoal.z);
        // A tossing, not a moonshot — he should land in or beside the pit.
        thrownRef.current = { t: 0, landed: false, landT: 0, vel: new THREE.Vector3(Math.sin(R.t * 7) * 0.45, 1.5, Math.cos(R.t * 5) * 0.45) };
        s.rotation.copy(s.userData.baseRot);
        // Endurance scoring: the throw time IS the score. Local best only —
        // any BTR/leaderboard wiring is a design decision, not assumed here.
        let bestNote = "El Diablo remains undefeated";
        try {
          const prev = parseFloat(localStorage.getItem(BEST_KEY) || "0");
          if (R.t > prev) {
            localStorage.setItem(BEST_KEY, R.t.toFixed(1));
            setBestT(R.t);
            bestNote = prev > 0 ? `NEW BEST (was ${prev.toFixed(1)}s)` : "a time to beat";
          } else {
            bestNote = `best ${prev.toFixed(1)}s`;
          }
        } catch {}
        setNote(`🐂 THROWN at ${R.t.toFixed(1)}s — ${bestNote}`);
        // Cowboy_Fall plays ONCE, timed to FIT THE AIRTIME: its duration is
        // longer than the ballistic arc, which made the collapse portion keep
        // performing after touchdown (the "double fall"). Predict the flight
        // from the launch height/velocity and speed the clip to match, so the
        // lying frame arrives AT the landing.
        if (actions?.[CLIP.fall]) {
          const fa = actions[CLIP.fall];
          playClip(CLIP.fall, { once: true });
          const v0 = 1.5; // matches the launch vel.y above
          const h = Math.max(0.01, g.position.y - PIT_FLOOR_Y);
          const tFlight = (v0 + Math.sqrt(v0 * v0 + 2 * THROW_GRAV * h)) / THROW_GRAV;
          const dur = fa.getClip().duration;
          if (dur > 0.01) fa.timeScale = dur / Math.max(0.25, tFlight);
        }
      }
      return;
    }

    // ── THROWN: floaty cartoon arc (the show), land with Receive_Hit, then
    // linger on the crash site before handing control back. ──
    if (modeRef.current === "thrown") {
      const T = thrownRef.current;
      if (!T) { modeRef.current = "walk"; return; }
      if (!T.landed) {
        T.t += dt;
        T.vel.y -= THROW_GRAV * dt;
        // Padded ring: a thrown rider BOUNCES off the pit wall (castWall
        // catches the inside faces too).
        if (pitMeshesRef.current) {
          tmpV.set(T.vel.x, 0, T.vel.z);
          const hSpeed = tmpV.length();
          if (hSpeed > 1e-4) {
            tmpV.normalize();
            g.getWorldPosition(worldPos);
            worldPos.y += HEIGHT * RAY_H;
            const hit = castWall(worldPos, tmpV, hSpeed * dt + WALKER_RADIUS);
            if (hit) {
              hit.normal.y = 0;
              if (hit.normal.lengthSq() > 1e-6) {
                hit.normal.normalize();
                const d = T.vel.dot(hit.normal);
                if (d < 0) {
                  T.vel.addScaledVector(hit.normal, -2 * d); // reflect…
                  T.vel.x *= 0.4; T.vel.z *= 0.4;            // …into padding
                }
              }
            }
          }
        }
        g.position.addScaledVector(T.vel, dt);
        // Never launched off the map — same walkable bounds as on foot.
        g.position.x = THREE.MathUtils.clamp(g.position.x, -worldW / 2 + EDGE_MARGIN, worldW / 2 - EDGE_MARGIN);
        g.position.z = THREE.MathUtils.clamp(g.position.z, -worldD / 2 - 1.0, worldD / 2 - EDGE_MARGIN);
        const distB = constrainRing(g, T.vel); // the padded ring, analytically
        const groundY = distB != null && distB < RING_RADIUS ? PIT_FLOOR_Y : 0;
        g.rotation.x += THROW_SPIN * dt;
        g.getWorldPosition(worldPos);
        if (camModeRef.current === "orbit") followTarget(worldPos.x, worldPos.y, worldPos.z);
        else camera.lookAt(worldPos); // spectate the arc from where you stand
        if (g.position.y <= groundY || T.t > 4) {
          T.landed = true;
          g.position.y = groundY;
          g.rotation.x = 0;
          // With Cowboy_Fall, the clamped final frame IS the landing pose —
          // snap straight to it at touchdown so no falling ever performs on
          // the ground, and restore normal speed for the clamped hold. Hit is
          // only the fallback when the fall clip is absent (playing it here
          // stood him back up mid-linger — the "pops to idle" bug).
          const fa = actions?.[CLIP.fall];
          if (fa) {
            fa.timeScale = 1;
            const dur = fa.getClip().duration;
            if (fa.time < dur - 0.03) fa.time = dur - 0.03;
          } else {
            playClip(CLIP.hit, { once: true });
          }
        }
      } else {
        T.landT += dt;
        g.getWorldPosition(worldPos);
        if (camModeRef.current === "orbit") followTarget(worldPos.x, worldPos.y, worldPos.z);
        else camera.lookAt(worldPos);
        // Lie in the dirt, then pick himself up. Control returns when the
        // GetUp one-shot finishes (oneShotRef clears via the mixer's
        // 'finished' event — nothing else can clear it in thrown mode).
        const hasGetUp = !!actions?.[CLIP.getup];
        if (hasGetUp && !T.gettingUp && T.landT >= GETUP_DELAY) {
          T.gettingUp = true;
          playClip(CLIP.getup, { once: true });
        }
        const done = hasGetUp
          ? (T.gettingUp && oneShotRef.current === null)
          : T.landT >= LAND_LINGER;
        if (done) {
          // Stand up FACING THE BULL from wherever he landed — restoring the
          // mount-time heading pointed him somewhere arbitrary (often away
          // from both the ring and the camera).
          const sb = saddleRef.current;
          if (sb) {
            sb.getWorldPosition(tmpV);
            g.getWorldPosition(worldPos);
            heading.current = Math.atan2(tmpV.x - worldPos.x, tmpV.z - worldPos.z);
          }
          g.quaternion.set(0, 0, 0, 1);
          g.rotation.y = heading.current;
          // A long blend out of GetUp's clamped last frame — the default
          // 0.18s fade read as a pop back to idle.
          playClip(CLIP.idle, { fade: GETUP_FADE });
          modeRef.current = "walk";
          rideRef.current = null;
          thrownRef.current = null;
        }
      }
      return;
    }

    // Unstick: a landing can drop him INSIDE the wall volume, where
    // single-sided faces blind every ray. Cast outward from the bull along
    // the radial to find the wall; if he's embedded in its thickness, snap
    // him to the nearest free side. (The entry gap has no wall on its radial,
    // so it never triggers there.)
    if (pitMeshesRef.current && saddleRef.current) {
      saddleRef.current.getWorldPosition(tmpV);
      g.getWorldPosition(worldPos);
      castD.set(worldPos.x - tmpV.x, 0, worldPos.z - tmpV.z);
      const distC = castD.length();
      if (distC > 1e-4) {
        castD.divideScalar(distC);
        castO.set(tmpV.x, worldPos.y + HEIGHT * RAY_H, tmpV.z);
        raycaster.set(castO, castD);
        raycaster.far = distC + WALKER_RADIUS + WALL_THICK;
        const hits = raycaster.intersectObjects(pitMeshesRef.current, false);
        if (hits.length) {
          const dWall = hits[0].distance;
          const innerLimit = dWall - WALKER_RADIUS;
          const outerLimit = dWall + WALL_THICK + WALKER_RADIUS;
          if (distC > innerLimit && distC < outerLimit) {
            const target = (distC - innerLimit < outerLimit - distC) ? innerLimit : outerLimit;
            g.position.x += castD.x * (target - distC);
            g.position.z += castD.z * (target - distC);
          }
        }
      }
    }
    // The analytic ring holds even where the merged meshes can't be found —
    // and inside it, feet stand on the padded pit pad, not under it.
    // ── Ground, platforms & vertical physics ──────────────────────────────
    // Support = the highest walkable surface under him: field/pit base, or a
    // prop-box top within step reach (grounded) / at-or-below the feet
    // (airborne, so a descending arc lands ON crates and stairs).
    const distBull = constrainRing(g);
    const baseY = distBull != null && distBull < RING_RADIUS ? PIT_FLOOR_Y : 0;
    let support = baseY;
    {
      const SBg = stripBoxesRef.current;
      if (SBg) {
        const reach = jumpRef.current ? 0.005 : STEP_H;
        // Edge forgiveness, but only once he's UP on something: at deck level
        // footprints are tight (no hovering beside crates); on platforms a
        // small margin bridges seams like the wagon-door threshold, where the
        // geometry underfoot belongs to an excluded mesh.
        const sm = g.position.y > baseY + 0.01 ? 0.035 : 0;
        for (let i = 0; i < SBg.length; i++) {
          const b = SBg[i];
          if (b.top > support && b.top <= g.position.y + reach
              && g.position.x > b.sMinX - sm && g.position.x < b.sMaxX + sm
              && g.position.z > b.sMinZ - sm && g.position.z < b.sMaxZ + sm) {
            support = b.top;
          }
        }
      }
    }
    const A = jumpRef.current;
    if (A) {
      A.vy -= JUMP_GRAV * dt;
      g.position.y += A.vy * dt;
      if (g.position.y <= support) { g.position.y = support; jumpRef.current = null; }
    } else if (g.position.y > support + 0.005) {
      jumpRef.current = { vy: 0 }; // walked off an edge — fall
    } else {
      g.position.y = support; // stick to ground / auto step-up
    }
    // Pumpjack collision: a rig stands on every interior cell centre, so the
    // whole forest is one nearest-cell cylinder check — slide off its rim and
    // keep to the lanes.
    {
      const cc = Math.round((g.position.x + worldW / 2 - cellSize / 2) / cellSize);
      const rr = Math.round((worldD / 2 - g.position.z - cellSize / 2) / cellSize);
      const cols = Math.round(worldW / cellSize), rows = Math.round(worldD / cellSize);
      if (cc >= 0 && cc < cols && rr >= 0 && rr < rows) {
        const dx = g.position.x - cellX(cc), dz = g.position.z - cellZ(rr);
        const dctr = Math.hypot(dx, dz);
        const minD = RIG_RADIUS + WALKER_RADIUS;
        if (dctr < minD) {
          if (dctr > 1e-4) {
            g.position.x = cellX(cc) + (dx / dctr) * minD;
            g.position.z = cellZ(rr) + (dz / dctr) * minD;
          } else {
            g.position.x = cellX(cc) + minD;
          }
        }
      }
    }
    // Boardwalk props: slide out of any harvested AABB along its shallowest
    // face (boxes are pre-inflated by the walker radius).
    const SB = stripBoxesRef.current;
    if (SB) {
      const p = g.position;
      for (let i = 0; i < SB.length; i++) {
        const b = SB[i];
        // Only a WALL relative to his feet — tops within step reach (or
        // already underfoot) are floors, handled by the support pass above.
        // floorOnly boxes (the stair frame) never wall.
        if (!b.floorOnly && b.top > p.y + STEP_H
            && p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ) {
          const dxl = p.x - b.minX, dxr = b.maxX - p.x;
          const dzl = p.z - b.minZ, dzr = b.maxZ - p.z;
          const m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl) p.x = b.minX;
          else if (m === dxr) p.x = b.maxX;
          else if (m === dzl) p.z = b.minZ;
          else p.z = b.maxZ;
        }
      }
    }
    // Cresting the wagon stairs walks INTO the fortune teller's parlor: cut
    // to her face-to-face (the same flow as E at a stall). Fires once per
    // ascent — re-arms when he leaves the staircase.
    {
      const SBt = stripBoxesRef.current;
      if (SBt && !stairSpotRef.current) {
        const frame = SBt.find((b) => b.name === "Steps");
        const s3 = SBt.find((b) => b.name === "Step3");
        if (frame && s3) stairSpotRef.current = { frame, minY: s3.top - 0.005 };
      }
      const S = stairSpotRef.current;
      if (S) {
        const inside = g.position.y >= S.minY
          && g.position.x > S.frame.sMinX && g.position.x < S.frame.sMaxX
          && g.position.z > S.frame.sMinZ && g.position.z < S.frame.sMaxZ;
        if (inside && !stairFiredRef.current) {
          stairFiredRef.current = true;
          stairVisitRef.current = true;
          const v = (window.__hmVendorSpots || {}).fortunes || { id: "fortunes", label: "fortunes" };
          modeRef.current = "vendor";
          setTalkingTo(v);
          onVendorMode?.(true);
          playClip(CLIP.idle); // no treadmill during the scene
          window.dispatchEvent(new CustomEvent("hm-vendor-enter", { detail: { id: v.id } }));
          return;
        }
        if (!inside) stairFiredRef.current = false;
      }
    }
    // Stepping through the booth curtain walks INTO the photo booth: hand the
    // camera back to the page, then fire the booth's own entry flow (fly
    // inside, boot the cam) via its window event.
    const CB = curtainBoxRef.current;
    if (CB && g.position.x > CB.minX && g.position.x < CB.maxX
        && g.position.z > CB.minZ && g.position.z < CB.maxZ) {
      onExit?.();
      window.dispatchEvent(new CustomEvent("hm-booth-enter"));
      return;
    }

    const k = keys.current;
    // Stop-and-pivot tank controls: A/D pivot in place; W/S walk the heading,
    // but a held turn cancels travel entirely (no arcs).
    const turn = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
    const walkInput = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const walk = turn !== 0 ? 0 : walkInput;
    const running = walk > 0 && (k.ShiftLeft || k.ShiftRight);
    heading.current += turn * TURN_RATE * dt;
    if (walk !== 0) {
      const speed = walk > 0 ? (running ? RUN_SPEED : SPEED) : BACK_SPEED;
      // Collide with the pit ring: raycast the step at waist height, slide
      // along the padding, and never step through it.
      tmpV.set(Math.sin(heading.current) * walk, 0, Math.cos(heading.current) * walk);
      g.getWorldPosition(worldPos);
      worldPos.y += HEIGHT * RAY_H;
      const step = collideStep(worldPos, tmpV, speed * dt);
      g.position.x += tmpV.x * step;
      g.position.z += tmpV.z * step;
      const m = EDGE_MARGIN;
      // The boardwalk deck hangs off the −Z edge, top flush with the field —
      // walkable, minus a rail margin. Widened 2026-09-01: the deck's outer
      // edge was pushed +3 local units (~1.05 → ~1.45 world-cell depth) for
      // more room to work; STRIP_EXTEND tracks the new outer edge (world depth
      // ≈ 1.45, minus a hair so he can't step off the last plank).
      const STRIP_EXTEND = 1.4;
      g.position.x = THREE.MathUtils.clamp(g.position.x, -worldW / 2 + m, worldW / 2 - m);
      g.position.z = THREE.MathUtils.clamp(g.position.z, -worldD / 2 - STRIP_EXTEND, worldD / 2 - m);
    }
    g.rotation.y = heading.current;
    // Locomotion state: movement interrupts any one-shot; pivot = half-speed
    // walk shuffle (a statue rotating reads wrong); still = idle — unless a
    // one-shot (stake/cheer/shrug/hit/magic) currently owns the body.
    // Jump (SPACE on foot): a hop with full air control — walking carries
    // through the air, and the jump clip owns the body until touchdown.
    const spaceNow = !!keys.current.Space;
    if (spaceNow && !jumpSpacePrev.current && !jumpRef.current) {
      jumpRef.current = { vy: JUMP_V };
      oneShotRef.current = null;
      playClip(CLIP.jump, { once: true });
    }
    jumpSpacePrev.current = spaceNow;
    if (jumpRef.current) {
      // airborne — the jump one-shot keeps the body
    } else if (walk !== 0) {
      oneShotRef.current = null;
      playClip(running ? CLIP.run : CLIP.walk);
    } else if (turn !== 0) {
      oneShotRef.current = null;
      playClip(CLIP.walk, { timeScale: 0.5 });
    } else if (!oneShotRef.current) {
      playClip(CLIP.idle);
    }

    // Camera per mode. Tank controls stay stable by construction in all
    // three: input never derives from the camera.
    g.getWorldPosition(worldPos);
    // Demon-aware framing ("my character is so short i can't look up"): pull
    // the camera's gaze toward a loose demon so airborne flights and nearby
    // fights stay in frame. Airborne registers from far (the flight is a
    // show); grounded only once engage-close. The weight is smoothed so
    // spawn/banish never pop the camera — and tank controls make any amount
    // of auto-tilt safe, since input never derives from the camera.
    {
      const D = window.__hmDemonState;
      let wT = 0;
      if (D && !D.done) {
        camDemonPt.set(D.x, D.y + 0.1, D.z);
        const dd = Math.hypot(D.x - worldPos.x, D.z - worldPos.z);
        const airborne = D.y - worldPos.y > 0.15;
        const range = airborne ? 7 : DEMON_ENGAGE + 0.8;
        if (dd < range) wT = (airborne ? 0.2 : 0) + (airborne ? 0.6 : 0.4) * (1 - dd / range);
      }
      camLookWRef.current += (Math.min(0.65, wT) - camLookWRef.current) * Math.min(1, dt * 3);
    }
    if (camModeRef.current === "orbit") {
      // The player frames the shot; the target stays on the cowboy.
      followTarget(worldPos.x, worldPos.y + HEIGHT * 0.7, worldPos.z);
    } else if (camModeRef.current === "cowboy") {
      // Hat-cam on foot. Facing a vendor: meet their eyes — the fixed ground
      // tilt aimed at belt buckles. Otherwise: tipped down just enough to
      // read the ground (frontier cells, the pit rim).
      camera.position.set(worldPos.x, worldPos.y + 0.15, worldPos.z);
      const nv2 = nearVendorRef.current;
      if (nv2) {
        const deckWorldY = worldPos.y - g.position.y;
        // Per-vendor eye height when the head bone registered; generic
        // counter height otherwise.
        camera.lookAt(nv2.x, nv2.eyeY != null ? nv2.eyeY : deckWorldY + VENDOR_EYE_Y, nv2.z);
      } else {
        // Default ground-tilt look, lifted toward a loose demon (stronger
        // pull than the follow cam — first person turns its head).
        lookGoal.set(
          worldPos.x + Math.sin(heading.current),
          worldPos.y + 0.15 - 0.2,
          worldPos.z + Math.cos(heading.current));
        if (camLookWRef.current > 0.01) {
          lookGoal.lerp(camDemonPt, Math.min(0.85, camLookWRef.current * 1.4));
        }
        camera.lookAt(lookGoal);
      }
    } else {
      // FOLLOW: hard-locked behind the heading — no lerp (smoothing made
      // pivots sweep a lagging arc and was the last source of shake).
      const cs = camScaleRef.current; // scroll-wheel dolly
      camGoal.set(
        worldPos.x - Math.sin(heading.current) * CAM_BACK * cs,
        worldPos.y + CAM_UP * cs,
        worldPos.z - Math.cos(heading.current) * CAM_BACK * cs);
      camera.position.copy(camGoal);
      lookGoal.set(worldPos.x, worldPos.y + HEIGHT * 0.7, worldPos.z);
      // Soft lock-on: tilt up/over to keep the demon in frame with the cowboy.
      if (camLookWRef.current > 0.01) lookGoal.lerp(camDemonPt, camLookWRef.current);
      camera.lookAt(lookGoal);
    }

    // Frontier prompt: which cell am I standing on?
    const c = Math.round((g.position.x + worldW / 2 - cellSize / 2) / cellSize);
    const r = Math.round((worldD / 2 - g.position.z - cellSize / 2) / cellSize);
    const key = `${c}_${r}`;
    const hit = frontier.find((f) => `${f.col}_${f.row}` === key) || null;
    const hitKey = hit ? key : null;
    if (hitKey !== promptKeyRef.current) {
      promptKeyRef.current = hitKey;
      setPrompt(hit ? { ...hit } : null);
    }

    // Demon proximity — arm/holster the revolver and drive the SHOOT prompt.
    // The demon publishes its state every frame (world coords); it outranks
    // the bull and vendors on E while it's loose and roaming.
    {
      const D = window.__hmDemonState;
      const loose = !!(D && !D.done);
      // `capturable` is false for a stunned summoner — they can't fight their
      // own demon. Treat the whole encounter as inert for them: gun holstered,
      // no prompt, no beam, E falls through to bull/vendor/dig. (Older demon
      // states without the field default to capturable so nothing regresses.)
      const engageable = loose && D.roaming && (D.capturable !== false);
      if (gunRef.current && gunRef.current.visible !== engageable) {
        gunRef.current.visible = engageable;
      }
      demonLooseRef.current = engageable;
      let nd = false;
      if (engageable) {
        g.getWorldPosition(worldPos);
        nd = Math.hypot(D.x - worldPos.x, D.z - worldPos.z) < DEMON_ENGAGE;
      }
      if (nd !== nearDemonRef.current) { nearDemonRef.current = nd; setNearDemon(nd); }
      const dv = !!(loose && D.vulnerable);
      if (dv !== demonVulnRef.current) { demonVulnRef.current = dv; setDemonVuln(dv); }
      demonCdRef.current = loose ? (D.cooldown || 0) : 0;
      const cd = Math.ceil(demonCdRef.current);
      if (cd !== demonCd) setDemonCd(cd);
      // Laser sight: muzzle → demon while it's engageable. The color is the
      // live rules readout (walkerShotLands, published by the demon): hot =
      // pressing E lands right now; dim = it sees you coming and will dodge;
      // near-off = you're in the post-dodge lockout.
      const beam = aimBeamRef.current, bdot = aimDotRef.current;
      if (beam && nd && gunRef.current && gunRef.current.visible) {
        const hot = !!D.walkerShotLands;
        const locked = demonCdRef.current > 0;
        beam.visible = true;
        gunRef.current.getWorldPosition(tmpV);
        lookGoal.set(D.x, D.y + 0.22, D.z);
        beam.parent.worldToLocal(tmpV);
        beam.parent.worldToLocal(lookGoal);
        beam.position.copy(tmpV).add(lookGoal).multiplyScalar(0.5);
        castD.copy(lookGoal).sub(tmpV);
        const blen = castD.length();
        const br = BEAM_RADIUS * (hot ? 2.2 : 1);
        beam.scale.set(br, Math.max(0.01, blen), br);
        if (blen > 1e-4) beam.quaternion.setFromUnitVectors(UP_AXIS, castD.divideScalar(blen));
        beam.material.color.set(hot ? BEAM_HOT : BEAM_DIM);
        beam.material.opacity = locked ? 0.07 : hot ? BEAM_HOT_OPACITY : BEAM_DIM_OPACITY;
        if (bdot) {
          bdot.visible = !locked;
          bdot.position.copy(lookGoal);
          bdot.material.color.set(hot ? BEAM_HOT : BEAM_DIM);
          bdot.material.opacity = hot ? 0.95 : 0.4;
          bdot.scale.setScalar(hot ? 1.6 + Math.sin(performance.now() * 0.02) * 0.35 : 1);
        }
      }
    }
    // Bull proximity (E rides instead of staking when close).
    let nb = false;
    if (saddleRef.current) {
      saddleRef.current.getWorldPosition(tmpV);
      g.getWorldPosition(worldPos);
      nb = tmpV.distanceTo(worldPos) < BULL_NEAR;
    }
    // Vendor proximity (E strikes up the conversation; the bull wins ties).
    let nv = null;
    const reg = window.__hmVendorSpots;
    if (reg && !nb) {
      let bd = VENDOR_NEAR;
      for (const id in reg) {
        const s = reg[id];
        const d = Math.hypot(s.x - g.position.x, s.z - g.position.z);
        if (d < bd) { bd = d; nv = s; }
      }
    }
    if ((nv?.id || null) !== (nearVendorRef.current?.id || null)) {
      nearVendorRef.current = nv;
      setNearVendor(nv);
    }
    if (nb !== nearBullRef.current) {
      nearBullRef.current = nb;
      setNearBull(nb);
      if (nb) {
        // Ring-tuning aid: stand AT the wall → dist ≈ RING_RADIUS; stand IN
        // the gap → az ≈ RING_GAP_AZ. Copy the numbers into the constants.
        const ddx = worldPos.x - tmpV.x, ddz = worldPos.z - tmpV.z;
        console.log(`[ring-tune] dist ${Math.hypot(ddx, ddz).toFixed(2)} · az ${Math.atan2(ddx, ddz).toFixed(2)}`);
      }
    }
  });

  return (
    <group>
      <group ref={group} visible={placed}>
        <group ref={inner}>
          <primitive object={scene} scale={WALKER_SCALE} rotation={[0, MODEL_YAW, 0]} />
        </group>
      </group>
      {/* Laser FX — all driven per-frame in useFrame (world endpoints
          converted into this group's space); invisible between uses.
          Fire pulse + muzzle light, then the continuous aiming beam whose
          color reads out the rules (hot = a shot lands right now). */}
      <mesh ref={tracerRef} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5, 1, true]} />
        <meshBasicMaterial
          color={LASER_PULSE}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight ref={flashRef} color={LASER_FLASH} intensity={0} distance={0.9} decay={2} />
      <mesh ref={aimBeamRef} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5, 1, true]} />
        <meshBasicMaterial
          color={BEAM_DIM}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={aimDotRef} visible={false} frustumCulled={false}>
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshBasicMaterial
          color={BEAM_DIM}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={hudAnchor}>
      <Html calculatePosition={(el, cam, size) => [size.width / 2 - 170, size.height - 92]}
        style={{ pointerEvents: "none" }} zIndexRange={[40, 30]}>
        <div style={{
          font: "10px/1.7 'Share Tech Mono', monospace", color: "#e8e0c8",
          background: "rgba(20,18,12,0.82)", border: "1px solid rgba(232,224,200,0.35)",
          borderRadius: 4, padding: "6px 10px", width: 340, letterSpacing: "0.05em",
        }}>
          {!placed ? (
            <span style={{ color: "#ffd75e" }}>
              ⛏ CLICK ANYWHERE ON THE FIELD to drop your prospector · ESC to sky
            </span>
          ) : talkingTo ? (
            <span style={{ color: "#ffd75e" }}>
              🤝 {(talkingTo.label || "").toUpperCase()}
            </span>
          ) : riding ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, color: "#ffd75e" }}>
                {rideT.toFixed(1)}s{rideT >= RIDE_GOAL ? " ★" : ""}
                {bestT > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>
                    &nbsp;· best {bestT.toFixed(1)}s
                  </span>
                )}
              </div>
              {/* The rider's body wears the state now — this is just a thin
                  peripheral strip, not something to stare at. */}
              <div style={{ margin: "5px 0 4px", height: 4, background: "rgba(232,224,200,0.15)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.round(grip * 100)}%`,
                  background: grip > 0.35 ? "#8dffb8" : "#ff6f5f",
                  transition: "width 0.1s linear",
                }} />
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700, letterSpacing: "0.1em",
                color: brace === 2 ? "#ff6f5f" : brace === 1 ? "#ffd75e" : "rgba(232,224,200,0.55)",
              }}>
                {brace === 2 ? "KICK — SPACE!" : brace === 1 ? "⚡ HE'S COILING…" : "A/D lean into the throw"}
              </div>
              <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>cam: {camMode.toUpperCase()} (C) · ESC bail</div>
            </div>
          ) : (<>
            <span style={{ opacity: 0.75 }}>W/S walk · A/D turn · Shift run · SPACE jump · cam: {camMode.toUpperCase()} (C) · </span>
            {nearDemon
              ? demonCd > 0
                ? <span style={{ color: "#ff6f5f" }}>☠ DODGED — shaken for {demonCd}s</span>
                : demonVuln
                ? <span style={{ color: "#ff6f5f", fontWeight: 700 }}>🔫 IT STARES YOU DOWN — press E to SHOOT</span>
                : <span style={{ color: "#ffd75e" }}>🔫 THE DEMON — E lands when the beam burns hot (its stare, or its back)</span>
              : nearBull
              ? <span style={{ color: "#ffd75e" }}>🐂 EL DIABLO — press E to RIDE</span>
              : nearVendor
              ? <span style={{ color: "#ffd75e" }}>🤝 {(nearVendor.label || "").toUpperCase()} — press E to VISIT</span>
              : prompt
                ? <span style={{ color: "#ffd75e" }}>⛏ FRONTIER ({prompt.col + 1},{prompt.row + 1}) L{prompt.layer + 1} — press E to STAKE A WELL −1⚡</span>
                : <span style={{ opacity: 0.75 }}>walk onto a frontier cell to stake a well · ESC to sky</span>}
          </>)}
          {note && <span style={{ display: "block", color: "#8dffb8" }}>{note}</span>}
          {/* One escape button whose label, key, and action always agree with
              the current mode — two competing ESC hints read as a riddle. */}
          <button
            onClick={() => {
              if (talkingTo) leaveVendor(false);
              else if (riding) endRide();
              else onExit?.();
            }}
            style={{
              pointerEvents: "auto", marginTop: 3, font: "inherit", color: "#e8e0c8",
              background: "rgba(232,224,200,0.12)", border: "1px solid rgba(232,224,200,0.4)",
              borderRadius: 3, padding: "1px 7px", cursor: "pointer",
            }}>
            {talkingTo ? "⏏ WALK AWAY (ESC)" : riding ? "⏏ LET GO (ESC)" : "⏏ BACK TO SKY (ESC)"}
          </button>
        </div>
      </Html>
      </group>
    </group>
  );
}
