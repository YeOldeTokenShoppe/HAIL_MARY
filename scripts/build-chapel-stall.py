# Placeholder tent-revival chapel (run: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-chapel-stall.py) for the Midway's taco slot — assembled from
# packs on disk into a NEW scene (no strip .blend touched), in the strip's frame:
# Blender X = deck depth (front toward -X), Blender -Y = strip Z along the deck,
# Z up. Pieces keep the FBX import convention (rot X 90°, scale 0.01) the strip
# stalls are authored with. Exported to public/models/stalls/stall_chapel.glb.
import bpy, math, json, os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
OUT = os.environ.get("CHAPEL_OUT", "/Users/michellepaulson/HAIL_MARY/public/models/stalls/stall_chapel.glb")
S = "/private/tmp/claude-501/-Users-michellepaulson/92f1d00a-1313-40d8-bc5a-cd3d81a7bc96/scratchpad/chapel"
H = "/Users/michellepaulson"
PACK = {
  "west":     (f"{H}/frontier/Assets/Synty/PolygonWesternFrontier/Models", f"{H}/frontier/Assets/Synty/PolygonWesternFrontier/Textures/PolygonWesternFrontier_01_A.png"),
  "darkfan":  (f"{H}/Dark Fantasy/Assets/PolygonDarkFantasy/Models", f"{H}/Dark Fantasy/Assets/PolygonDarkFantasy/Textures/Alts/PolygonDarkFantasy_Texture_01_A.png"),
  "kingdom":  (f"{H}/Fantasy Kingdom/Assets/PolygonFantasyKingdom/Models", f"{H}/Fantasy Kingdom/Assets/PolygonFantasyKingdom/Textures/PolygonFantasyKingdom_Texture_01_A.png"),
  "fortress": (f"{H}/DarkFORTRESS/Assets/Synty/PolygonDarkFortress/Models", f"{H}/DarkFORTRESS/Assets/Synty/PolygonDarkFortress/Textures/Alts/PolygonDarkFortress_Texture_01_A.png"),
}
D = math.pi / 2
TENT_S = 1.35
# (pack, fbx, location, yaw about Z, uniform scale multiplier)
PIECES = [
  ("west",     "SM_Bld_Tent_02",             (2.1, -3.0, 0.0),  -D,   TENT_S),  # the tent opens at ONE end (local -Y): yaw -90° puts that end toward the player (-X)
  ("fortress", "SM_Prop_Altar_01",           (4.1, -3.0, 0.0),   D,   1.0),     # carved bone face (local +Y) toward the congregation (-X)
  ("kingdom",  "SM_Prop_Church_Lectern_01",  (2.85, -3.0, 0.0),  D,   1.0),     # reading slope toward +X — he stands behind it, facing out
  ("darkfan",  "SM_Prop_Pew_01",             (1.1, -4.2, 0.0),   D,   1.0),     # seats face +X (the altar); the pew's origin is its END, so it spans y −4.2…−2.2
  ("darkfan",  "SM_Prop_Pew_01",             (1.95, -4.2, 0.0),  D,   1.0),
  ("darkfan",  "SM_Prop_Candle_Rack_01",     (1.6, -1.72, 0.0),  0.0, 1.0),     # votive rack inside, along the left wall
  ("kingdom",  "SM_Prop_Bell_Small_01",      (-0.9, -5.55, 1.41), 0.0, 1.0),    # bell post at the front corner between tent and wagon
  ("west",     "SM_Veh_Wagon_Jail_01",       (2.6, -6.75, 0.0),  D,   0.9),     # the confessional: caged door end toward the player, hitch to the back
]
imported = []
for pack, name, loc, yaw, mul in PIECES:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=f"{PACK[pack][0]}/{name}.fbx")
    new = [o for o in bpy.data.objects if o not in before]
    root = next(o for o in new if o.parent is None)
    root.location = loc
    root.rotation_euler = (D, 0.0, yaw)
    root.scale = (0.01 * mul, 0.01 * mul, 0.01 * mul)
    for o in new: o["pack"] = pack
    imported += new
# The tent's front centre pole stood exactly on the phone card's axis and hid
# the chaplain — cut it out (faces whose every vertex sits in a thin column at
# the front opening, below the apex so the canvas ridge stays whole).
import bmesh
tent = bpy.data.objects["SM_Bld_Tent_02"]; bpy.context.view_layer.update()
mw = tent.matrix_world; bm = bmesh.new(); bm.from_mesh(tent.data)
def in_pole(v):
    # the FRONT pole only (x < 0.5): every vertex on the tent's centre line at
    # the opening, feet below the deck included — the ridge bar and the rear
    # pole keep their off-front vertices and survive
    w = mw @ v.co
    return (w.x < 0.5) and (abs(w.y + 3.0) < 0.12) and (w.z > -0.7)
cols = sorted(set(round((mw @ v.co).x, 1) for v in bm.verts if in_pole(v)))
print("pole-column x positions:", cols)
doomed = [f for f in bm.faces if all(in_pole(v) for v in f.verts)]
bmesh.ops.delete(bm, geom=doomed, context='FACES'); bm.to_mesh(tent.data); bm.free()
print("pole faces removed:", len(doomed))
# the deck slab, as the extracted stalls carry it (kept visible by StallProps, excluded from the fit box)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.2, 0.0, -0.07)); deck = bpy.context.object
deck.name = "Boardwalk"; deck.scale = (10.8, 77.2, 0.14)
dm = bpy.data.materials.new("Deck"); dm.use_nodes = True
dm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.36, 0.24, 0.14, 1); dm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
deck.data.materials.append(dm)
# materials: one atlas per pack, rebuilt from scratch (Synty FBX arrive metallic 1 and unlinked)
atlas = {}
for pack, (_, tex) in PACK.items():
    img = bpy.data.images.load(tex); img.scale(1024, 1024); atlas[pack] = img
mats = {}
for o in imported:
    if o.type != 'MESH': continue
    pack = o["pack"]
    if pack not in mats:
        m = bpy.data.materials.new(f"Chapel_{pack}"); m.use_nodes = True
        nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
        bsdf.inputs["Metallic"].default_value = 0.0; bsdf.inputs["Roughness"].default_value = 0.85
        ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = atlas[pack]; ti.interpolation = 'Closest'
        nt.links.new(ti.outputs["Color"], bsdf.inputs["Base Color"])
        mats[pack] = m
    o.data.materials.clear(); o.data.materials.append(mats[pack])
# report bounds
bpy.context.view_layer.update()
def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    return [round(min(p[i] for p in pts), 2) for i in range(3)], [round(max(p[i] for p in pts), 2) for i in range(3)]
rep = {"pieces": {}}
for o in imported:
    if o.parent is None: rep["pieces"][o.name] = bounds([o] + [c for c in o.children_recursive])
rep["all"] = bounds(imported)
rep["tris"] = sum(len(o.data.polygons) for o in imported if o.type == 'MESH')
# preview renders
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'; scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
scene.render.resolution_x = 1000; scene.render.resolution_y = 700; scene.render.image_settings.file_format = 'PNG'
cam_data = bpy.data.cameras.new("cam"); cam_data.lens = 30; cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
def shoot(loc, target, path):
    cam.location = loc; d = Vector(target) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)
shoot((-9.0, -3.9, 3.6), (2.2, -3.9, 1.0), f"{S}/chapel_front.png")
shoot((-4.5, -3.2, 1.6), (3.0, -3.2, 1.0), f"{S}/chapel_in.png")
shoot((2.2, -4.2, 16), (2.2, -4.2, 0), f"{S}/chapel_top.png")
shoot((9.5, -3.4, 3.5), (2.2, -3.4, 1.0), f"{S}/chapel_back.png")
cam.select_set(True); bpy.data.objects.remove(cam)
# export
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=False, export_yup=True, export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=82, export_animations=False, export_lights=False, export_cameras=False, use_selection=False)
rep["glb_bytes"] = os.path.getsize(OUT)
print("REPORT " + json.dumps(rep))
