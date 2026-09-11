# Author the crew goblin's handwheel turn (NLA track "crew_valve") in HMPC_Crew_Goblin.blend.
# Run inside the open crew session (Blender MCP execute_blender_code) or in background:
#   /Applications/Blender.app/Contents/MacOS/Blender -b HMPC_Crew_Goblin.blend --python scripts/author-crew-valve.py
# (background: add bpy.ops.wm.save_mainfile() at the end yourself; nothing is saved here).
# Both hands are IK targets driven along the rim of the linked rig's handwheel over a static base
# pose (crew_idle frame 1) with a scripted torso lean and head-down, then baked to FK; the IK
# constraints are left muted. See docs/rig-export.md "The handwheel". If the wheel or Crew_Valve
# moves in the rig blend, update the GEOMETRY block, re-run, re-export (scripts/export-crew.sh).
import bpy, math, json
from mathutils import Vector, Matrix, Quaternion
d = bpy.data; scn = bpy.context.scene; out = {}
arm = d.objects["Armature"]; E = d.objects["Crew2_Empty"]; adt = arm.animation_data

# ---------------- GEOMETRY (world, Blender axes; rig v25) ----------------
S = Vector((-1.05, -2.44, 0.0)); YAW = math.pi / 2                       # Crew_Valve station (feet frame, +X local = facing = world +Y); rig v26
H = Vector((-1.054, -2.190, 0.549)); R_GRIP = 0.20; Y_GRIP = -2.27       # wheel hub, rim-tube centre radius, grip plane (1.5 cm in front of the rim face so the palms wrap it)
A_L, A_R, DELTA = -135.0, 135.0, 35.0                                     # grips at 8:30 / 3:30 (chest height); a pull = 35° clockwise as the goblin sees it (left hand rises)
LIFT = 0.06                                                               # hands come off the rim by this much on the way back
N = 196; CYC = [19 + 48 * k for k in range(3)]                            # 30 fps: reach 1-18, cycles of 6 settle + 24 pull + 18 return, release 163-196
def grip_pt(a_deg, y=Y_GRIP):
    a = math.radians(a_deg); return Vector((H.x + R_GRIP * math.sin(a), y, H.z + R_GRIP * math.cos(a)))
def ease(u): u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)
def phase(f):
    if f < CYC[0]: return ("reach", (f - 1) / (CYC[0] - 1), None)
    for k, F in enumerate(CYC):
        if F <= f < F + 48:
            i = f - F
            if i < 6: return ("settle", i / 6, k)
            if i < 30: return ("pull", (i - 6) / 24, k)
            return ("return", (i - 30) / 18, k)
    return ("release", (f - (CYC[-1] + 48)) / (N - (CYC[-1] + 48)), None)
def hand_targets(f, idle_l, idle_r):
    kind, u, k = phase(f); gl, gr = grip_pt(A_L), grip_pt(A_R)
    if kind == "reach": e = ease(u); return idle_l.lerp(gl, e), idle_r.lerp(gr, e)
    if kind == "settle": return gl, gr
    if kind == "pull": e = ease(u); return grip_pt(A_L + DELTA * e), grip_pt(A_R + DELTA * e)
    if kind == "return":
        e = ease(u); lift = math.sin(math.pi * u) * LIFT
        pl = grip_pt(A_L + DELTA).lerp(gl, e); pr = grip_pt(A_R + DELTA).lerp(gr, e)
        pl.y -= lift; pr.y -= lift; return pl, pr
    e = ease(u); return gl.lerp(idle_l, e), gr.lerp(idle_r, e)
def torso(f):
    """(lean_pitch_deg, roll_deg, head_pitch_deg)"""
    g0, g1 = CYC[0], CYC[-1] + 48
    w = ease((f - (g0 - 9)) / 9) if f < g0 else (1 - ease((f - g1) / 9) if f >= g1 else 1.0)
    bump = 0.0
    for F in CYC:
        if F + 6 <= f < F + 30: bump = math.sin(math.pi * (f - F - 6) / 24) ** 2
    return (2.0 * w + 2.0 * bump, 3.0 * bump, 10.0 * w)

E_saved = E.matrix_world.copy(); frame_saved = scn.frame_current; use_nla_saved = adt.use_nla
E.matrix_world = Matrix.Translation(S) @ Matrix.Rotation(YAW, 4, 'Z'); bpy.context.view_layer.update()
M_feet = E.matrix_world.inverted() @ arm.matrix_world; R_feet = M_feet.to_3x3().normalized()

# local axes for the torso offsets, from child-head displacement (FBX tails do not point at children)
def axis_for(bn, tip_rest, want):
    b = arm.data.bones[bn]; ml = b.matrix_local; loc = ml.inverted() @ tip_rest; best = None
    for ax in "XYZ":
        for sg in (1, -1):
            dv = R_feet @ ((ml @ Matrix.Rotation(math.radians(10 * sg), 4, ax) @ loc) - tip_rest)
            sc = dv.dot(want)
            if best is None or sc > best[0]: best = (round(sc, 3), ax, sg)
    return best
AX = {"spine_01": {"pitch": axis_for("spine_01", arm.data.bones["spine_02"].head_local, Vector((1, 0, 0))), "roll": axis_for("spine_01", arm.data.bones["spine_02"].head_local, Vector((0, 1, 0)))},
      "spine_02": {"pitch": axis_for("spine_02", arm.data.bones["spine_03"].head_local, Vector((1, 0, 0))), "roll": axis_for("spine_02", arm.data.bones["spine_03"].head_local, Vector((0, 1, 0)))},
      "head":     {"pitch": axis_for("head", arm.data.bones["eyes"].head_local, Vector((0, 0, -1)))}}
def q_off(spec, deg):
    _, ax, sg = spec; v = Vector((1, 0, 0)) if ax == "X" else Vector((0, 1, 0)) if ax == "Y" else Vector((0, 0, 1))
    return Quaternion(v, math.radians(deg * sg))

# base pose: crew_idle frame 1 (the troll_idle action behind the crew_idle track)
idle = adt.nla_tracks["crew_idle"].strips[0].action; icb = idle.layers[0].strips[0].channelbag(idle.slots[0])
base = {}
for fc in icb.fcurves:
    bn = fc.data_path.split('"')[1]; prop = fc.data_path.rsplit('.', 1)[1]
    base.setdefault((bn, prop), [0.0] * (4 if prop == "rotation_quaternion" else 3))[fc.array_index] = fc.evaluate(1)

old = d.actions.get("crew_valve")
if old: d.actions.remove(old)
act = idle.copy(); act.name = "crew_valve"; slot = act.slots[0]
cb = act.layers[0].strips[0].channelbag(slot)
vals = {k: [list(v) for _ in range(N)] for k, v in base.items()}
for f in range(1, N + 1):
    pitch, roll, hp = torso(f)
    for bn in ("spine_01", "spine_02"):
        vals[(bn, "rotation_quaternion")][f - 1] = list(Quaternion(base[(bn, "rotation_quaternion")]) @ q_off(AX[bn]["pitch"], pitch) @ q_off(AX[bn]["roll"], roll))
    vals[("head", "rotation_quaternion")][f - 1] = list(Quaternion(base[("head", "rotation_quaternion")]) @ q_off(AX["head"]["pitch"], hp))
def write_all():
    for fc in list(cb.fcurves): cb.fcurves.remove(fc)
    for (bn, prop), rows in vals.items():
        for i in range(len(rows[0])):
            fc = cb.fcurves.new(f'pose.bones["{bn}"].{prop}', index=i); fc.keyframe_points.add(N)
            for j, kp in enumerate(fc.keyframe_points): kp.co = (j + 1, rows[j][i]); kp.interpolation = 'LINEAR'
            fc.update()
write_all()
adt.use_nla = False; adt.action = act; adt.action_slot = slot

# IK targets + constraints (the push IK stays muted)
coll = d.collections["glTF_not_exported"]
def target(name):
    o = d.objects.get(name)
    if not o: o = d.objects.new(name, None); o.empty_display_size = 0.02; coll.objects.link(o)
    return o
TL, TR = target("Crew2_ValveTarget_L"), target("Crew2_ValveTarget_R"); cons = {}
for side, tgt in (("l", TL), ("r", TR)):
    pb = arm.pose.bones[f"hand_{side}"]; pb.lock_ik_x = pb.lock_ik_y = pb.lock_ik_z = True
    c = pb.constraints.get(f"IK_Valve{side.upper()}") or pb.constraints.new('IK'); c.name = f"IK_Valve{side.upper()}"
    c.target = tgt; c.chain_count = 3; c.use_tail = True; c.use_stretch = False; c.iterations = 500; c.mute = True; c.influence = 1.0; cons[side] = c
push = arm.pose.bones["hand_r"].constraints.get("IK_PushTarget")
if push: push.mute = True; push.influence = 0.0
scn.frame_set(1); bpy.context.view_layer.update(); AW = arm.matrix_world
idle_l = AW @ arm.pose.bones["hand_l"].tail; idle_r = AW @ arm.pose.bones["hand_r"].tail
sh_l = AW @ arm.pose.bones["upperarm_l"].head; sh_r = AW @ arm.pose.bones["upperarm_r"].head
out["max_reach_from_shoulder"] = {k: round(max((hand_targets(f, idle_l, idle_r)[i] - sh).length for f in range(1, N + 1)), 3) for k, i, sh in (("l", 0, sh_l), ("r", 1, sh_r))}
for c in cons.values(): c.mute = False

# drive + bake (IK → FK), quaternion sign continuity
ARM_BONES = [f"{b}_{s}" for s in "lr" for b in ("upperarm", "lowerarm", "hand")]
baked = {bn: [] for bn in ARM_BONES}; prev = {bn: None for bn in ARM_BONES}; err = []
for f in range(1, N + 1):
    tl, tr = hand_targets(f, idle_l, idle_r); TL.location = tl; TR.location = tr
    scn.frame_set(f); bpy.context.view_layer.update()
    for bn in ARM_BONES:
        pb = arm.pose.bones[bn]
        loc, q, sc = arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space='POSE', to_space='LOCAL').decompose()
        if prev[bn] is not None and q.dot(prev[bn]) < 0: q = -q
        prev[bn] = q; baked[bn].append((list(loc), list(q), list(sc)))
    err.append(max((AW @ arm.pose.bones["hand_l"].tail - tl).length, (AW @ arm.pose.bones["hand_r"].tail - tr).length))
out["ik_err_max_m"] = round(max(err), 4)
for bn in ARM_BONES:
    for f in range(N):
        loc, q, sc = baked[bn][f]; vals[(bn, "location")][f] = loc; vals[(bn, "rotation_quaternion")][f] = q; vals[(bn, "scale")][f] = sc
write_all()
for c in cons.values(): c.mute = True; c.influence = 0.0
chk = []
for f in (1, CYC[0] + 3, CYC[1] + 29, N):
    tl, tr = hand_targets(f, idle_l, idle_r); scn.frame_set(f); bpy.context.view_layer.update()
    chk.append((f, round((AW @ arm.pose.bones["hand_l"].tail - tl).length, 4), round((AW @ arm.pose.bones["hand_r"].tail - tr).length, 4)))
out["fk_check_frame_errL_errR"] = chk

# NLA strip
adt.action = None; adt.use_nla = use_nla_saved
tr = adt.nla_tracks.get("crew_valve") or adt.nla_tracks.new(); tr.name = "crew_valve"
for s_ in list(tr.strips): tr.strips.remove(s_)
strip = tr.strips.new("crew_valve", 1, act); strip.blend_type = 'REPLACE'; strip.extrapolation = 'HOLD'
E.matrix_world = E_saved; scn.frame_set(frame_saved); bpy.context.view_layer.update()
out["wheel_profile_s"] = {"pulls": [[round((F + 6 - 1) / 30, 3), round((F + 30 - 1) / 30, 3)] for F in CYC], "step_deg": -DELTA, "duration_s": round(N / 30, 3)}
print("CREW_VALVE " + json.dumps(out))
result = out
