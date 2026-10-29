"""Create the cameraman's on_air NLA loop in this scene (Blender 5.1).
The existing idle, clapping and talking actions are retained. The arm solve uses
joint heads rather than the oversized display tails in this imported rig.
Run in the Blender Text Editor. No file is overwritten by this script.
"""
import bpy, json, math
from mathutils import Vector, Matrix, Quaternion
arm=bpy.data.objects['Root.002']; ad=arm.animation_data
if 'on_air_original_state' not in arm:
    arm['on_air_original_state']=json.dumps({'action':ad.action.name if ad.action else None,'use_nla':ad.use_nla,'frame':bpy.context.scene.frame_current,'tracks':{t.name:{'mute':t.mute,'solo':t.is_solo} for t in ad.nla_tracks},'base':{p.name:[list(r) for r in p.matrix_basis] for p in arm.pose.bones}})
state=json.loads(arm['on_air_original_state'])
ad.action=None;ad.use_nla=False
for p in arm.pose.bones:p.matrix_basis=Matrix(state['base'][p.name])
bpy.context.view_layer.update()
W=arm.matrix_world.copy(); WI=W.inverted()
def point(n):return W@arm.pose.bones[n].head
def wm(n):return W@arm.pose.bones[n].matrix
def set_world(n,m):
    arm.pose.bones[n].matrix=WI@m
    bpy.context.view_layer.update()
def rotate(n,q):
    m=wm(n); pos=m.translation.copy()
    m=q.to_matrix().to_4x4()@m;m.translation=pos;set_world(n,m)
def rotate_deg(n,axis,deg):rotate(n,Quaternion(Vector(axis),math.radians(deg)))
def aim_child(n,child,target):
    p=point(n); v=point(child)-p;d=Vector(target)-p
    rotate(n,v.rotation_difference(d))
def solve_arm(side,wrist,pole):
    upper='UpperArm_'+side.upper(); fore='lowerarm_'+side; hand='Hand_'+side.upper()
    a=point(upper);b=point(fore);c=point(hand); l1=(b-a).length;l2=(c-b).length
    d=Vector(wrist)-a;length=min(d.length,l1+l2-0.0001); direction=d.normalized()
    along=(l1*l1-l2*l2+length*length)/(2*length)
    height=math.sqrt(max(0,l1*l1-along*along))
    bend=Vector(pole)-a;bend-=direction*bend.dot(direction);bend.normalize()
    elbow=a+direction*along+bend*height
    aim_child(upper,fore,elbow);aim_child(fore,hand,wrist)
    return {'elbow':list(point(fore)),'wrist':list(point(hand)),'error':(point(hand)-Vector(wrist)).length}
# A planted stance, leaning toward the rear of the camera.
rotate_deg('spine_01',(0,0,1),-12)
rotate_deg('spine_01',(1,0,0),-12)
rotate_deg('spine_01',(0,1,0),10)
rotate_deg('spine_02',(1,0,0),-7)
rotate_deg('spine_02',(0,1,0),5)
# Grip midpoint lies on the thick rubber portion of the tripod pan handle.
grip=Vector((0.0436,-2.989,1.165))
axis=Vector((0.0052,0.1466,0.0745)).normalized()
# The rig's finger direction is -X, palm normal -Y, thumb edge -Z.
# Put the finger rows across the grip and the thumb along the handle.
z=-axis
x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized()
y=z.cross(x).normalized()
R=Matrix((x,y,z)).transposed()
# The fingers will curl underneath the handle; palm sits just above it.
index_local=wm('Hand_R').inverted()@point('indexFinger_01_r')
finger_local=wm('Hand_R').inverted()@point('finger_01_r')
scale=wm('Hand_R').to_scale()
palm_local=(index_local+finger_local)*0.5
palm_offset=Vector((palm_local.x*scale.x,palm_local.y*scale.y,palm_local.z*scale.z))*0.68
wrist=grip+y*0.027-R@palm_offset
arm_result=solve_arm('r',wrist,(0.24,-3.25,1.06))
m=R.to_4x4()@Matrix.Diagonal((*scale,1));m.translation=Vector(wrist);set_world('Hand_R',m)
# Aim the head along the optical/viewfinder direction.
viewfinder=Vector((-0.095,-2.64,1.54))
for _ in range(8):
    eye=point('eyes');forward=(viewfinder-eye).normalized()
    up=Vector((0,0,1));hx=up.cross(forward).normalized();hy=forward.cross(hx).normalized()
    old=wm('head');hs=old.to_scale();m=Matrix((hx,hy,forward)).transposed().to_4x4()@Matrix.Diagonal((*hs,1));m.translation=old.translation
    set_world('head',m)
# Curl the grouped finger chains about their anatomical hinge axes.
for prefix in ['indexFinger','finger']:
    for k,deg in [(1,45),(2,55),(3,35),(4,0)]:
        pb=arm.pose.bones[f'{prefix}_{k:02d}_r']
        pb.matrix_basis=Matrix(state['base'][pb.name])
        pb.rotation_quaternion=pb.rotation_quaternion@Quaternion((0,0,1),math.radians(deg))
bpy.context.view_layer.update()
# Oppose the thumb from the near side, across the front of the handle.
tp=point('thumb_01_r');tc=grip+axis*(tp-grip).dot(axis)
aim_child('thumb_01_r','thumb_02_r',tc+x*0.027-y*0.004+axis*0.012)
aim_child('thumb_02_r','thumb_03_r',tc-x*0.005-y*0.027+axis*0.012)
# Save the solved pose as the neutral frame of the loop.
neutral={p.name:p.matrix_basis.copy() for p in arm.pose.bones}
hand_world=wm('Hand_R').copy()

# Bake an eight-second repeating performance, with the wrist planted at the grip.
scene=bpy.context.scene
fps=scene.render.fps/scene.render.fps_base
N=round(8*fps)+1
existing=bpy.data.actions.get('on_air')
if existing and not existing.get('on_air_authored'):
    raise RuntimeError('An unrelated action named on_air already exists; rename it first.')
act=existing or bpy.data.actions.new('on_air')
act['on_air_authored']=True
act.use_fake_user=True
if not act.slots:
    slot=act.slots.new(id_type='OBJECT',name=arm.name)
else:slot=act.slots[0]
if not act.layers:
    layer=act.layers.new('On air performance')
    action_strip=layer.strips.new(type='KEYFRAME')
else:action_strip=act.layers[0].strips[0]
cb=action_strip.channelbag(slot,ensure=True)
for fc in list(cb.fcurves):cb.fcurves.remove(fc)
rows={p.name:[] for p in arm.pose.bones}
previous={}
for frame in range(1,N+1):
    phase=2*math.pi*(frame-1)/(N-1)
    for pb in arm.pose.bones:pb.matrix_basis=neutral[pb.name]
    bpy.context.view_layer.update()
    # Two soft breaths and one small posture adjustment per eight seconds.
    breath=math.sin(2*phase)
    sway=math.sin(phase)
    rotate_deg('spine_01',(1,0,0),0.55*breath)
    rotate_deg('spine_02',(1,0,0),0.35*breath)
    rotate_deg('spine_02',(0,1,0),0.35*sway)
    rotate_deg('spine_03',(0,0,1),0.30*math.sin(phase+0.4)-0.30*math.sin(0.4))
    solve_arm('r',hand_world.translation,(0.24,-3.25,1.06))
    set_world('Hand_R',hand_world)
    gaze=viewfinder+Vector((0.004*sway,0,0.003*math.sin(phase)))
    for _ in range(6):
        fwd=(gaze-point('eyes')).normalized();up=Vector((0,0,1))
        hx=up.cross(fwd).normalized();hy=fwd.cross(hx).normalized()
        old=wm('head');m=Matrix((hx,hy,fwd)).transposed().to_4x4()@Matrix.Diagonal((*old.to_scale(),1));m.translation=old.translation
        set_world('head',m)
    for pb in arm.pose.bones:
        loc,q,scale=pb.matrix_basis.decompose()
        if pb.name in previous and q.dot(previous[pb.name])<0:q=-q
        previous[pb.name]=q.copy()
        rows[pb.name].append((list(loc),list(q),list(scale)))
# Exact matching boundary pose eliminates any seam when repeated in NLA.
for n in rows:rows[n][-1]=rows[n][0]
for pb in arm.pose.bones:
    pb.rotation_mode='QUATERNION'
    for prop,j in [('location',0),('rotation_quaternion',1),('scale',2)]:
        for component in range(len(rows[pb.name][0][j])):
            fc=cb.fcurves.new(pb.path_from_id(prop),index=component)
            fc.keyframe_points.add(N)
            for i,kp in enumerate(fc.keyframe_points):
                kp.co=(i+1,rows[pb.name][i][j][component]);kp.interpolation='LINEAR'
            fc.update()
act['description']='Eight-second looping cameraman performance: planted right-hand grip, soft breathing, viewfinder gaze.'
act['grip_object']='SM_Prop_Tripod_Head_01_Tilt'
act['grip_local']=list(bpy.data.objects[act['grip_object']].matrix_world.inverted()@grip)
act['duration_seconds']=8.0
ad.action=None;ad.use_nla=True
for track in ad.nla_tracks:track.is_solo=False;track.mute=True
track=ad.nla_tracks.get('on_air') or ad.nla_tracks.new();track.name='on_air'
for strip in list(track.strips):track.strips.remove(strip)
strip=track.strips.new('on_air',1,act);strip.action_slot=slot
strip.blend_type='REPLACE';strip.extrapolation='HOLD';strip.action_frame_start=1;strip.action_frame_end=N
track.mute=False
scene.frame_preview_start=1;scene.frame_preview_end=N-1;scene.use_preview_range=True
scene.frame_set(1);bpy.context.view_layer.update()
arm['on_air_draft_pose']=json.dumps({n:[list(r) for r in m] for n,m in neutral.items()})
# Verification includes halfway samples to catch drift between baked keys.
errors=[];foot_errors=[];first_feet={n:point(n).copy() for n in ['Foot_L','Foot_R']}
for frame in range(1,N):
    for subframe in (0.0,0.5):
        scene.frame_set(frame,subframe=subframe);bpy.context.view_layer.update()
        errors.append((point('Hand_R')-hand_world.translation).length)
        foot_errors.extend((point(n)-p).length for n,p in first_feet.items())
scene.frame_set(1);bpy.context.view_layer.update()
result={'action':act.name,'track':track.name,'strip':strip.name,'frames':[1,N],'duration_seconds':8.0,'fps':fps,'max_wrist_drift_m':max(errors),'max_foot_drift_m':max(foot_errors),'retained_clips':[t.name for t in ad.nla_tracks if t!=track]}
act['validation']=json.dumps(result)
print(json.dumps(result))
