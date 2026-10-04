# Author the claw machine's demo cycle (NLA track "Claw_Demo") in the claw machine .blend.
# Run inside the open Blender session: Scripting workspace > Text > Open > this file > Run Script
# (or via Blender MCP execute_blender_code), or in background:
#   /Applications/Blender.app/Contents/MacOS/Blender -b ClawMachine.blend --python scripts/animate-claw.py
# (background: add bpy.ops.wm.save_mainfile() at the end yourself; nothing is saved here).
#
# What it builds, all from the object transforms as they stand at run time (that is the home pose,
# so sit on frame 1 with the lever centred and the claw parked before running):
#   Lever          tilts forward, then right, then nudges back (rotation_euler, local X/Y)
#   Claw_Mechanism travels along its local X/Y at CLAW_SPEED while the lever is tilted, as a real
#                  machine does (lever = velocity, not position), clamped to the travel limits; after
#                  the grab it auto-returns home over the chute, lever centred
#   drop parts     the claw head (whatever hangs under Claw_Mechanism, found via the fingers or by
#                  name) descends DROP_DEPTH and comes back up; a cable whose origin sits at its top
#                  is stretched instead of moved
#   fingers        open on the way down, close at the bottom, open again over the chute
# Everything is keyed per frame and pushed to one NLA track named "Claw_Demo" on every object it
# touches, so a glTF export in "NLA Tracks" mode (see scripts/export-rig.py) yields a single clip
# "Claw_Demo" that useAnimations() can play. Re-running replaces the previous Claw_Demo and nothing
# else. Fingers / drop parts / travel limits are auto-detected; override them in CONFIG if the
# report (printed as CLAW_ANIM {...}) picks the wrong objects.
import bpy, math, re, json
from mathutils import Vector, Matrix

# ---------------- CONFIG ----------------
LEVER_NAME = "Lever"
CLAW_NAME = "Claw_Mechanism"
FINGER_NAMES = None          # e.g. ["Finger_1", "Finger_2", "Finger_3"]; None = auto-detect under Claw_Mechanism
DROP_PART_NAMES = None       # e.g. ["Claw_Head", "Cable"]; None = auto-detect (fingers' ancestor + head/cable names)
BOUNDS_OBJECT = None         # e.g. "Play_Area": travel limits = its XY bounding box minus BOUNDS_MARGIN; None = X_TRAVEL/Y_TRAVEL
BOUNDS_MARGIN = 0.05         # metres kept clear of the bounds object's walls
X_TRAVEL, Y_TRAVEL = 0.35, 0.25   # metres of travel each way from home along Claw_Mechanism's local X / Y
CLAW_SPEED = 0.25            # metres per second at full lever tilt
LEVER_TILT = math.radians(25)     # full lever tilt
LEVER_RAMP = 0.25            # seconds for the lever to reach full tilt / return to centre
DROP_DEPTH = 0.45            # metres the head descends (clamped to the cable length if a cable is found)
FINGER_OPEN = math.radians(35)    # how far each finger swings outward
TRACK = "Claw_Demo"
# ----------------------------------------

d = bpy.data; scn = bpy.context.scene; fps = scn.render.fps / scn.render.fps_base
out = {"fps": fps, "warnings": []}
lever = d.objects.get(LEVER_NAME); claw = d.objects.get(CLAW_NAME)
if lever is None or claw is None:
    raise RuntimeError(f"need objects {LEVER_NAME!r} and {CLAW_NAME!r}; have " + ", ".join(sorted(o.name for o in d.objects)[:40]))

def descendants(o):
    for c in o.children:
        yield c; yield from descendants(c)
def top_child(o):
    """The child of Claw_Mechanism that o hangs from (o itself if directly under it)."""
    while o.parent is not None and o.parent != claw: o = o.parent
    return o if o.parent == claw else None
def world_bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box] if o.type == 'MESH' else [o.matrix_world.translation]
    return Vector(map(min, zip(*pts))), Vector(map(max, zip(*pts)))

# ---------------- find the parts ----------------
desc = list(descendants(claw))
FINGER_RE = re.compile(r"finger|prong|tine|jaw|talon|pincer|grip|arm|claw[_ .-]?(l|r|f|b|\d)", re.I)
NOT_FINGER_RE = re.compile(r"gantry|rail|trolley|carriage|motor|bracket|mount|housing|cable|string|rope|wire|chain", re.I)
HEAD_RE = re.compile(r"head|grabber|hook|cable|string|rope|wire|chain", re.I)
CABLE_RE = re.compile(r"cable|string|rope|wire|chain", re.I)
if FINGER_NAMES is not None:
    fingers = [d.objects[n] for n in FINGER_NAMES]
else:
    fingers = [o for o in desc if FINGER_RE.search(o.name) and not NOT_FINGER_RE.search(o.name)]
    if len(fingers) < 2: fingers = []
if DROP_PART_NAMES is not None:
    drop_parts = [d.objects[n] for n in DROP_PART_NAMES]
else:
    drop_parts = []
    for o in fingers:
        t = top_child(o)
        if t is not None and t not in drop_parts: drop_parts.append(t)
    for o in claw.children:
        if HEAD_RE.search(o.name) and o not in drop_parts: drop_parts.append(o)
cables = []  # (object, rest length) for drop parts whose origin sits at their top: these stretch instead of moving
for o in list(drop_parts):
    if o.type == 'MESH' and CABLE_RE.search(o.name):
        lo, hi = world_bbox(o); length = hi.z - lo.z
        if length > 1e-6 and abs(o.matrix_world.translation.z - hi.z) < 0.05 * length:
            cables.append((o, length)); drop_parts.remove(o)
        else:
            out["warnings"].append(f"{o.name}: cable origin is not at its top; moving it with the head instead of stretching it")
if cables: DROP_DEPTH = min([DROP_DEPTH] + [L * 3.0 for _, L in cables])  # never stretch a cable past 4x
out["fingers"] = [o.name for o in fingers]; out["drop_parts"] = [o.name for o in drop_parts]; out["cables"] = [o.name for o, _ in cables]
if not fingers: out["warnings"].append("no fingers found under Claw_Mechanism (set FINGER_NAMES); skipping the grab")
if not drop_parts and not cables: out["warnings"].append("nothing to drop under Claw_Mechanism (set DROP_PART_NAMES); skipping the descent")

# ---------------- travel limits (claw local space, relative to home) ----------------
home = claw.location.copy(); claw_mw = claw.matrix_world.copy()
if BOUNDS_OBJECT:
    b = d.objects[BOUNDS_OBJECT]; to_claw = claw_mw.inverted() @ b.matrix_world
    corners = [to_claw @ Vector(c) for c in b.bound_box]          # the bed's own corners in claw local space
    xmin, xmax = min(c.x for c in corners), max(c.x for c in corners); ymin, ymax = min(c.y for c in corners), max(c.y for c in corners)
    xmin += BOUNDS_MARGIN; xmax -= BOUNDS_MARGIN; ymin += BOUNDS_MARGIN; ymax -= BOUNDS_MARGIN
    if not (xmin < 0 < xmax and ymin < 0 < ymax): raise RuntimeError(f"home pose is outside {BOUNDS_OBJECT}'s bounds: x {xmin:.2f}..{xmax:.2f} y {ymin:.2f}..{ymax:.2f}")
else:
    xmin, xmax, ymin, ymax = -X_TRAVEL, X_TRAVEL, -Y_TRAVEL, Y_TRAVEL
out["travel"] = {"x": [round(xmin, 3), round(xmax, 3)], "y": [round(ymin, 3), round(ymax, 3)], "drop": round(DROP_DEPTH, 3)}

# ---------------- the cycle (seconds) ----------------
def ease(u): u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)
def pulse(t, t0, t1):
    """0 -> 1 over LEVER_RAMP from t0, hold, 1 -> 0 over LEVER_RAMP ending at t1."""
    if t < t0 or t > t1: return 0.0
    return min(ease((t - t0) / LEVER_RAMP), ease((t1 - t) / LEVER_RAMP))
# leg lengths so the claw reaches ~80% of each limit (velocity ramps make the effective time t - LEVER_RAMP)
fwd = 0.8 * ymax / CLAW_SPEED + LEVER_RAMP; right = 0.8 * xmax / CLAW_SPEED + LEVER_RAMP; nudge = 0.25 * ymax / CLAW_SPEED + LEVER_RAMP
T_FWD = (0.5, 0.5 + fwd); T_RIGHT = (T_FWD[1] + 0.5, T_FWD[1] + 0.5 + right); T_NUDGE = (T_RIGHT[1] + 0.4, T_RIGHT[1] + 0.4 + nudge)
T_DROP = (T_NUDGE[1] + 0.4, T_NUDGE[1] + 1.4)         # head goes down
T_OPEN1 = (T_DROP[0], T_DROP[0] + 0.5)               # fingers open on the way down
T_CLOSE = (T_DROP[1], T_DROP[1] + 0.5)               # grab at the bottom
T_RAISE = (T_CLOSE[1], T_CLOSE[1] + 1.0)             # head comes up
T_HOME = (T_RAISE[1] + 0.2, T_RAISE[1] + 2.2)        # auto-return to the chute (lever centred)
T_OPEN2 = (T_HOME[1] + 0.2, T_HOME[1] + 0.7)         # release over the chute
T_CLOSE2 = (T_OPEN2[1] + 0.5, T_OPEN2[1] + 1.0)      # fingers settle shut
T_END = T_CLOSE2[1] + 0.5
def lever_tilt(t):
    """(rot_x, rot_y) of the lever: forward = -X (top of the lever goes +Y), right = +Y (top goes +X)."""
    rx = -LEVER_TILT * pulse(t, *T_FWD) + 0.5 * LEVER_TILT * pulse(t, *T_NUDGE)
    ry = LEVER_TILT * pulse(t, *T_RIGHT)
    return rx, ry
def drop_amount(t):
    if t < T_DROP[0]: return 0.0
    if t < T_DROP[1]: return ease((t - T_DROP[0]) / (T_DROP[1] - T_DROP[0]))
    if t < T_RAISE[0]: return 1.0
    if t < T_RAISE[1]: return 1.0 - ease((t - T_RAISE[0]) / (T_RAISE[1] - T_RAISE[0]))
    return 0.0
def finger_open(t):
    for (o0, o1), (c0, c1) in ((T_OPEN1, T_CLOSE), (T_OPEN2, T_CLOSE2)):
        if o0 <= t < o1: return ease((t - o0) / (o1 - o0))
        if o1 <= t < c0: return 1.0
        if c0 <= t < c1: return 1.0 - ease((t - c0) / (c1 - c0))
    return 0.0

# ---------------- clear the previous run ----------------
targets = [lever, claw] + drop_parts + [o for o, _ in cables] + fingers
seen = set(); targets = [o for o in targets if not (o.name in seen or seen.add(o.name))]
for o in targets:
    if o is claw: o.driver_remove("location")
    adt = o.animation_data
    if adt is None: continue
    for tr in [t for t in adt.nla_tracks if t.name == TRACK]:
        old = [s.action for s in tr.strips if s.action and s.action.name.startswith(TRACK)]
        adt.nla_tracks.remove(tr)
        for a in old: d.actions.remove(a)
    if adt.action is not None:
        if adt.action.name.startswith(TRACK): act = adt.action; adt.action = None; d.actions.remove(act)
        else: out["warnings"].append(f"{o.name}: had action {adt.action.name!r} assigned; left in the file but unassigned"); adt.action = None

# ---------------- rest data ----------------
lever_rot0 = lever.rotation_euler.copy(); lever_mode = lever.rotation_mode
if lever_mode not in ('XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'):
    lever.rotation_mode = 'XYZ'; lever_rot0 = lever.rotation_euler.copy(); out["warnings"].append(f"{LEVER_NAME}: rotation mode switched to XYZ")
drop_loc0 = {o.name: o.location.copy() for o in drop_parts}
# world -Z expressed in each drop part's parent space, from the rest pose (the bake never updates the depsgraph)
drop_down = {o.name: ((o.parent.matrix_world @ o.matrix_parent_inverse).to_3x3().inverted() @ Vector((0, 0, -1.0))) if o.parent else Vector((0, 0, -1.0)) for o in drop_parts}
cable_scale0 = {o.name: (o.scale.copy(), L) for o, L in cables}
finger_rest = {}
centre = Vector((0, 0, 0))
if fingers:
    centre = sum((o.matrix_world.translation for o in fingers), Vector()) / len(fingers)
for o in fingers:
    mw = o.matrix_world.copy(); p = mw.translation.copy()
    r = Vector((p.x - centre.x, p.y - centre.y, 0.0))
    if r.length < 1e-6:  # finger sits on the axis: fall back to its own local -Y as outward
        r = (mw.to_3x3() @ Vector((0, -1, 0))); r.z = 0
    r.normalize(); axis = r.cross(Vector((0, 0, 1)))  # rotating the hanging finger about this swings its tip outward
    to_basis = (o.parent.matrix_world @ o.matrix_parent_inverse).inverted() if o.parent else Matrix.Identity(4)
    finger_rest[o.name] = (mw, p, axis, to_basis)
    if o.rotation_mode not in ('XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX', 'QUATERNION'):
        o.rotation_mode = 'XYZ'; out["warnings"].append(f"{o.name}: rotation mode switched to XYZ")
def rot_path(o): return 'rotation_quaternion' if o.rotation_mode == 'QUATERNION' else 'rotation_euler'
def set_finger(o, u):
    mw, p, axis, to_basis = finger_rest[o.name]
    R = Matrix.Rotation(FINGER_OPEN * u, 4, axis)
    o.matrix_basis = to_basis @ Matrix.Translation(p) @ R @ Matrix.Translation(-p) @ mw

# ---------------- bake ----------------
f0 = scn.frame_start if scn.frame_start >= 1 else 1
n_frames = int(math.ceil(T_END * fps)) + 1
pos = Vector((0.0, 0.0)); grab_at = None; home_start = None
for i in range(n_frames):
    f = f0 + i; t = i / fps
    rx, ry = lever_tilt(t)
    lever.rotation_euler = (lever_rot0.x + rx, lever_rot0.y + ry, lever_rot0.z)
    lever.keyframe_insert("rotation_euler", frame=f)
    # lever = velocity; the claw moves in its own local X/Y and stops at the limits
    vx = max(-1.0, min(1.0, ry / LEVER_TILT)); vy = max(-1.0, min(1.0, -rx / LEVER_TILT))
    if t < T_HOME[0]:
        pos.x = max(xmin, min(xmax, pos.x + vx * CLAW_SPEED / fps)); pos.y = max(ymin, min(ymax, pos.y + vy * CLAW_SPEED / fps))
        if t >= T_RAISE[1] and home_start is None: home_start = pos.copy()
    elif t < T_HOME[1]:
        if home_start is None: home_start = pos.copy()
        e = ease((t - T_HOME[0]) / (T_HOME[1] - T_HOME[0])); pos = home_start * (1 - e)
    else:
        pos = Vector((0.0, 0.0))
    claw.location = (home.x + pos.x, home.y + pos.y, home.z)
    claw.keyframe_insert("location", frame=f)
    if t >= T_DROP[1] and grab_at is None: grab_at = (round(pos.x, 3), round(pos.y, 3))
    dz = DROP_DEPTH * drop_amount(t)
    for o in drop_parts:
        o.location = drop_loc0[o.name] + drop_down[o.name] * dz; o.keyframe_insert("location", frame=f)
    for o, L in cables:
        s0, _ = cable_scale0[o.name]; o.scale = (s0.x, s0.y, s0.z * (L + dz) / L); o.keyframe_insert("scale", frame=f)
    u = finger_open(t)
    for o in fingers:
        set_finger(o, u); o.keyframe_insert(rot_path(o), frame=f)
scn.frame_set(f0)
if scn.frame_end < f0 + n_frames - 1: scn.frame_end = f0 + n_frames - 1
out["frames"] = [f0, f0 + n_frames - 1]; out["grab_at_local_xy"] = grab_at
out["timeline_s"] = {"forward": T_FWD, "right": T_RIGHT, "nudge_back": T_NUDGE, "drop": T_DROP, "grab": T_CLOSE, "raise": T_RAISE, "auto_return": T_HOME, "release": T_OPEN2, "end": T_END}

# ---------------- push every action onto an NLA track named TRACK ----------------
for o in targets:
    adt = o.animation_data
    if adt is None or adt.action is None: continue
    act = adt.action; act.name = f"{TRACK}_{o.name}"
    tr = adt.nla_tracks.new(); tr.name = TRACK
    strip = tr.strips.new(TRACK, f0, act)
    if hasattr(strip, "action_slot") and hasattr(adt, "action_slot") and adt.action_slot is not None:
        strip.action_slot = adt.action_slot  # Blender 4.4+ slotted actions
    adt.action = None
out["animated"] = [o.name for o in targets if o.animation_data and any(t.name == TRACK for t in o.animation_data.nla_tracks)]
print("CLAW_ANIM " + json.dumps(out))
