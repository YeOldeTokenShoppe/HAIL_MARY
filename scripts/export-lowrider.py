"""Blender side of scripts/export-lowrider.sh: export the /old_landing lowrider from a saved .blend.

Mirrors the Codex pipeline behind the current model and runs headless; the .blend is never saved.
Usage (via the shell script): Blender -b scene.blend --python scripts/export-lowrider.py -- out.glb
"""
import math
import sys
from pathlib import Path

import bpy

OUT = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
TAP = 'Hologirl_Seated_Sway_RestingForearm_Tap'
SLOW_TAP = 'Hologirl_Seated_Sway_RestingForearm_SlowTap'
FRAMES = 250


def rebuild_slow_tap(scene, rig):
    """Copy the girl's tap action with Hand_R at half speed (60 BPM at 30 fps); every other curve is untouched."""
    hand = rig.pose.bones['Hand_R']
    orientations = []
    for f in range(1, FRAMES + 1):
        source = 1 + (f - 1) * 0.5
        scene.frame_set(int(source), subframe=source - int(source))
        orientations.append(hand.matrix.to_quaternion().copy())

    action = rig.animation_data.action.copy()
    action.name = SLOW_TAP
    rig.animation_data.action = action
    slot = rig.animation_data.action_slot.handle
    bag = next(cb for layer in action.layers for strip in layer.strips for cb in strip.channelbags if cb.slot_handle == slot)

    basis = []
    for f, orientation in enumerate(orientations, 1):
        scene.frame_set(f)
        matrix = orientation.to_matrix().to_4x4()
        matrix.translation = hand.head
        hand.matrix = matrix
        bpy.context.view_layer.update()
        basis.append(hand.matrix_basis.to_quaternion().copy())

    path = 'pose.bones["Hand_R"].rotation_quaternion'
    for i in range(4):
        fcurve = bag.fcurves.find(path, index=i)
        fcurve.lock = fcurve.mute = False
        fcurve.keyframe_points.clear()
        fcurve.keyframe_points.add(FRAMES)
        for k, q in enumerate(basis):
            fcurve.keyframe_points[k].co = (k + 1, q[i])
            fcurve.keyframe_points[k].interpolation = 'LINEAR'
        fcurve.update()

    angles = []
    for f in range(1, 62):
        scene.frame_set(f)
        angles.append(orientations[0].rotation_difference(hand.matrix.to_quaternion()).angle)
    return [i + 1 for i in range(1, 60)
            if angles[i] > angles[i - 1] and angles[i] >= angles[i + 1] and angles[i] > math.radians(20)]


scene = bpy.context.scene
rig = bpy.data.objects.get('Root.001')
if rig and rig.animation_data and rig.animation_data.action and rig.animation_data.action.name == TAP:
    peaks = rebuild_slow_tap(scene, rig)
    note = '' if len(peaks) == 2 and peaks[1] - peaks[0] == 30 else ' — WARNING: expected two taps 30 frames apart'
    print(f'LOWRIDER_EXPORT slow wrist tap rebuilt, tap peaks at frames {peaks}{note}')

# The page's clip timings and the 60 BPM tap were authored at 30 fps; the working file may be at 24.
scene.render.fps = 30
scene.render.fps_base = 1.0
scene.frame_set(1)


def skin_bone_children():
    """Re-rig bone-parented meshes (the Shiba's eyes) as meshes skinned fully to that bone.

    The glTF exporter misplaces bone-parented objects on this rig (the eyes landed ~1.6 m off the head),
    while skinned meshes export correctly. Placement is taken in rest pose, where the armature modifier
    leaves vertices where they are, so the eyes sit exactly where they did under the bone.
    """
    children = [o for o in scene.objects if o.type == 'MESH' and o.parent_type == 'BONE' and o.parent and o.parent_bone]
    for obj in children:
        rig, bone = obj.parent, obj.parent_bone
        rig.data.pose_position = 'REST'
        bpy.context.view_layer.update()
        rest_world = obj.matrix_world.copy()
        obj.parent_type = 'OBJECT'
        obj.parent_bone = ''
        obj.matrix_world = rest_world
        group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
        group.add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
        obj.modifiers.new('Armature', 'ARMATURE').object = rig
        rig.data.pose_position = 'POSE'
        bpy.context.view_layer.update()
        print(f'LOWRIDER_EXPORT skinned {obj.name} to {rig.name}:{bone}')


skin_bone_children()

# Visible, render-enabled meshes plus the rigs that deform them and all their parents.
keep = set()
for obj in scene.objects:
    if obj.type == 'MESH' and not obj.hide_render and obj.visible_get():
        keep.add(obj)
        keep.update(m.object for m in obj.modifiers if m.type == 'ARMATURE' and m.object)
for obj in list(keep):
    parent = obj.parent
    while parent:
        keep.add(parent)
        parent = parent.parent
for obj in scene.objects:
    obj.select_set(False)
for obj in keep:
    obj.hide_set(False)
    obj.select_set(True)

OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT), export_format='GLB', use_selection=True, export_cameras=False, export_lights=False,
    export_animations=True, export_animation_mode='ACTIONS', export_merge_animation='ACTION',
    export_anim_single_armature=False, export_force_sampling=True, export_frame_range=False,
    export_anim_slide_to_zero=True, export_negative_frame='SLIDE', export_optimize_animation_size=True,
    export_optimize_animation_keep_anim_armature=True, export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
    export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_image_format='AUTO',
    export_apply=True, export_current_frame=True)
print(f'LOWRIDER_EXPORT {len(keep)} objects -> {OUT}')
