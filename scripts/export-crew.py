# Export the crew character from HMPC_Crew_Goblin.blend (run via scripts/export-crew.sh).
# Selects Crew2_Empty and everything under it (armature, skinned meshes, bone-parented
# props such as Prop_Tablet), exports NLA tracks as clips with the root at the identity,
# then puts the root back where it was. Nothing is saved.
import bpy, os, json, sys
from mathutils import Matrix
repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(repo, "models-src", "crew_goblin_raw.glb")
E = bpy.data.objects["Crew2_Empty"]
family = [E]
def walk(o):
    for c in o.children:
        family.append(c); walk(c)
walk(E)
loose = [o.name for o in bpy.data.objects if not o.library and o not in family and o.type == 'MESH']
S = E.matrix_world.copy(); E.matrix_world = Matrix.Identity(4); bpy.context.view_layer.update()
for o in bpy.context.view_layer.objects: o.select_set(False)
for o in family: o.select_set(True)
bpy.context.view_layer.objects.active = E
try:
    res = bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
        export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_range=False,
        export_optimize_animation_size=True, export_skins=True, export_def_bones=False, export_rest_position_armature=True,
        export_morph=False, export_lights=False, export_cameras=False, export_extras=True,
        export_draco_mesh_compression_enable=False, export_anim_single_armature=True, export_reset_pose_bones=True)
finally:
    E.matrix_world = S
arm = next(o for o in family if o.type == 'ARMATURE')
print("CREW_EXPORT " + json.dumps({"result": list(res), "file": path, "bytes": os.path.getsize(path),
    "exported": [f"{o.name}({o.type}{', bone ' + o.parent_bone if o.parent_bone else ''})" for o in family],
    "clips": [t.name for t in arm.animation_data.nla_tracks],
    "meshes_not_under_crew_root": loose}))
