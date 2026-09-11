# Export the Synty pumpjack rig from HMPC_Rig_Discovery_Pass_chiralL.blend (run via scripts/export-rig.sh).
# Recipe from docs/rig-export.md: frame 1, the exact node list + every Crew_* station empty,
# NLA tracks as clips, force sampling, no frame range, no modifier apply, Draco on, skins off,
# extras on. The panel instruments are parented to MachinePanel_Body_Door, which is not exported,
# so the export temporarily mirrors the live GLB's parenting (Toggle_X -> Toggle_X_Base, KeySwitch ->
# Key_Housing, PassButton_Cover -> PassButton_Housing, Gauge_* / GaugeNeedle -> Gauge) and restores it.
# Nothing is saved.
import bpy, os, json
from mathutils import Matrix
repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(repo, "models-src", "oilJack_allProps4_raw.glb")
scn = bpy.context.scene; out = {}
live_parent = {"Toggle_N": "Toggle_N_Base", "Toggle_E": "Toggle_E_Base", "Toggle_S": "Toggle_S_Base", "Toggle_W": "Toggle_W_Base", "KeySwitch": "Key_Housing",
               "PassButton_Cover": "PassButton_Housing", "Gauge_Marks": "Gauge", "Gauge_Orange": "Gauge", "Gauge_Red": "Gauge", "Gauge_Yellow": "Gauge", "GaugeNeedle": "Gauge"}
names = ["Alert_Light_RED","BeamPin_Left","BeamPin_Right","Belt","Belt_Clip_01","Belt_Clip_02","Belt_Clip_03","Head_Pump","Body_Pump","Counterweight","CrankAxle","CrankPin_Left","CrankPin_Right","Motor_Pulley","Pipe_01","Pitman","RodRef","Safety_Rails","Samson_Post","Service_Platform","Straw","Under_Pump","Under_Pump_Pipe_Panel","Under_Pump_Pipes","Wheel_Back","Wheel_BOP","Bottom_Box","MachinePanel_Body","FlareTip","Pipe_03","Well","WellFrame","Wheel","PressurePanel","PressurePanelFrame","Toggle_N","Toggle_N_Base","Lamp_N_Border","Lamp_N","Toggle_E","Toggle_E_Base","Lamp_E_Border","Lamp_E","Toggle_S","Toggle_S_Base","Lamp_S_Border","Lamp_S","Toggle_W","Toggle_W_Base","Lamp_W_Border","Lamp_W","KeySwitch","Key_Housing","PassButton_Cover","PassButton_Housing","PassButton","RedButton_Housing","RedButton","Gauge_Marks","Gauge_Orange","Gauge_Red","Gauge_Yellow","GaugeNeedle","Gauge","RedButtonBorder","Text_Extract","Text_Pass","RedButton_Plate","DANGER_LABEL","PassButton_Housing.001"]
crew = sorted(o.name for o in bpy.data.objects if o.name.startswith("Crew_"))
missing = [n for n in names if n not in bpy.data.objects]
door = bpy.data.objects.get("MachinePanel_Body_Door"); saved = {}
try:
    if door:
        for o in list(door.children): saved[o.name] = (o.parent, o.parent_type, o.matrix_parent_inverse.copy(), o.matrix_world.copy())
        for o in list(door.children):
            mw = saved[o.name][3]; np_ = bpy.data.objects.get(live_parent.get(o.name)) if o.name in live_parent else None
            o.parent = np_; o.matrix_parent_inverse = np_.matrix_world.inverted() if np_ else Matrix.Identity(4); o.matrix_world = mw
        bpy.context.view_layer.update()
    scn.frame_set(1)
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for n in names + crew:
        o = bpy.data.objects.get(n)
        if o: o.hide_viewport = False; o.hide_set(False)
    bpy.context.view_layer.update()
    for n in names + crew:
        o = bpy.data.objects.get(n)
        if o: o.select_set(True)
    out["selected"] = len(bpy.context.selected_objects); out["could_not_select"] = [n for n in names + crew if n in bpy.data.objects and not bpy.data.objects[n].select_get()]
    bpy.context.view_layer.objects.active = bpy.data.objects["Bottom_Box"]
    res = bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
        export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_range=False,
        export_optimize_animation_size=True, export_skins=False, export_morph=False, export_lights=False, export_cameras=False,
        export_extras=True, export_draco_mesh_compression_enable=True)
    out["export"] = list(res); out["bytes"] = os.path.getsize(path)
finally:
    if door:
        for n, (par, ptype, pinv, mw) in saved.items():
            o = bpy.data.objects[n]; o.parent = par; o.parent_type = ptype; o.matrix_parent_inverse = pinv; o.matrix_world = mw
out["fps"] = scn.render.fps; out["missing_from_blend"] = missing; out["crew_empties"] = crew
print("RIG_EXPORT " + json.dumps(out))
