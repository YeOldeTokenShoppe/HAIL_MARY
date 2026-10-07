# Consolidate and shrink the images in the open .blend before a glTF export.
# Run inside the open Blender session: Scripting workspace > Text > Open > this file > Run Script
# (or via Blender MCP execute_blender_code), or in background:
#   /Applications/Blender.app/Contents/MacOS/Blender -b Scene.blend --python scripts/consolidate-images.py
# (background: add bpy.ops.wm.save_mainfile() at the end yourself; nothing is saved here).
#
# What it does, in order (every step reports what it touched; set DRY_RUN = True to only report):
#   1. duplicates   images whose bytes (packed data or the file on disk) match, then images whose
#                   decoded pixels match, are merged onto one keeper: every material/node that used
#                   a duplicate is remapped to the keeper and the duplicate is deleted. The keeper is
#                   the packed one, else the one without a ".001"-style suffix, else the shortest name.
#   2. flat         images whose pixels are (nearly) one colour are scaled to FLAT_SIZE square. On
#                   disk these compress to nothing; on the GPU a 1024² map still costs ~5.3MB once
#                   decoded with mipmaps (see scripts/build-lite-model.mjs). FLAT_STD is the per-channel
#                   standard deviation (0..1) below which an image counts as flat.
#   3. oversize     images with a side longer than MAX_DIM are halved until they fit, aspect kept.
#   4. materials    materials whose node trees are the same (same node types, links, image names,
#                   unlinked input values, blend settings) are merged onto one keeper. Set
#                   MERGE_MATERIALS = False to skip.
#   5. unused       images and materials with no users are deleted, then orphans are purged.
#   6. pack         every remaining file image is packed into the .blend, so the scaled pixels
#                   persist and the export no longer depends on paths on this machine.
# Missing files (unpacked image whose file is gone) are reported, never touched: they would export
# blank, so find or relink them before exporting. Image sequences, movies, UDIM tiles, render
# results and viewer images are left alone. Nothing is saved: check the report (printed as
# IMG_CONSOLIDATE {...}) and the viewport, then Ctrl+S.
#
# After exporting, the usual post-export pass still applies (gltf-transform dedup/weld/Draco and
# scripts/optimize-lowrider.py or build-lite-model.mjs, whichever the model uses).
import bpy, os, re, json, hashlib

try:
    import numpy as np
except ImportError:  # Blender always ships numpy, but keep the failure readable
    raise SystemExit("numpy is required (it ships with Blender's python)")

# ---------------- CONFIG ----------------
DRY_RUN = False          # True: report only, change nothing
MERGE_MATERIALS = True   # merge materials with identical node trees
MAX_DIM = 2048           # longest allowed side; larger images are halved until they fit (0 = no limit)
FLAT_SIZE = 16           # flat (single-colour) images are scaled to this square
FLAT_STD = 0.004         # max per-channel std-dev (0..1) for an image to count as flat
PIXEL_HASH_MAX = 4096 * 4096  # don't decode images bigger than this just to hash their pixels
PACK = True              # pack remaining file images into the .blend
KEEP_NAMES = ()          # image names never merged away, scaled or deleted, e.g. ("Logo.png",)
# ----------------------------------------

SKIP_SOURCES = {"SEQUENCE", "MOVIE", "TILED", "VIEWER"}
SUFFIX = re.compile(r"\.\d{3}$")
report = {"before": {}, "after": {}, "duplicates": [], "pixel_duplicates": [], "flat": [], "oversize": [],
          "materials_merged": [], "unused_images": [], "unused_materials": [], "missing_files": [],
          "packed": [], "skipped": [], "dry_run": DRY_RUN}


def vram_mb(images):
    # decoded RGBA8 with a full mip chain, the number that matters on an iPad
    return round(sum(i.size[0] * i.size[1] * 4 * 1.333 for i in images if i.has_data or i.size[0]) / 1e6, 1)


def snapshot(key):
    imgs = [i for i in bpy.data.images if i.source not in SKIP_SOURCES and i.type == "IMAGE"]
    report[key] = {"images": len(imgs), "packed": sum(1 for i in imgs if i.packed_file),
                   "materials": len(bpy.data.materials), "texture_vram_mb": vram_mb(imgs),
                   "sizes": {i.name: list(i.size) for i in imgs}}


def abspath(img):
    try:
        return bpy.path.abspath(img.filepath, library=img.library)
    except Exception:
        return ""


def candidates():
    out = []
    for img in bpy.data.images:
        if img.type != "IMAGE" or img.source in SKIP_SOURCES or img.library:
            report["skipped"].append({"image": img.name, "why": f"source {img.source}" if not img.library else "linked"})
            continue
        if img.source == "FILE" and not img.packed_file and not os.path.exists(abspath(img)):
            report["missing_files"].append({"image": img.name, "filepath": img.filepath, "users": img.users})
            continue
        out.append(img)
    return out


def bytes_hash(img):
    if img.packed_file:
        return "p:" + hashlib.sha1(img.packed_file.data).hexdigest()
    if img.source == "FILE":
        p = abspath(img)
        with open(p, "rb") as f:
            return "f:" + hashlib.sha1(f.read()).hexdigest()
    return None  # generated: pixel hash only


def pixels(img):
    w, h = img.size
    if w * h == 0 or w * h > PIXEL_HASH_MAX:
        return None
    arr = np.empty(w * h * img.channels, dtype=np.float32)
    img.pixels.foreach_get(arr)
    return arr.reshape(-1, img.channels)


def pixel_hash(img):
    arr = pixels(img)
    if arr is None:
        return None
    return "x:" + hashlib.sha1(np.round(arr * 255).astype(np.uint8).tobytes()).hexdigest() + f":{img.size[0]}x{img.size[1]}"


def rank(img):
    # lower is better keeper: packed first, then names without .001 suffix, then shortest
    return (0 if img.packed_file else 1, 1 if SUFFIX.search(img.name) else 0, len(img.name), img.name)


def merge_images(groups, key):
    for h, imgs in groups.items():
        if len(imgs) < 2:
            continue
        imgs.sort(key=rank)
        keeper = next((i for i in imgs if i.name in KEEP_NAMES), imgs[0])
        dups = [i for i in imgs if i is not keeper and i.name not in KEEP_NAMES]
        if not dups:
            continue
        report[key].append({"keeper": keeper.name, "removed": [d.name for d in dups], "users": sum(d.users for d in dups)})
        if DRY_RUN:
            continue
        for d in dups:
            d.user_remap(keeper)
            bpy.data.images.remove(d)


def scale_to(img, w, h, why, key):
    report[key].append({"image": img.name, "from": list(img.size), "to": [w, h], "why": why})
    if DRY_RUN:
        return
    img.scale(w, h)
    # the scaled pixels only live in memory until packed; pack() writes the buffer as PNG
    img.pack()


def material_signature(mat):
    if not mat.use_nodes or not mat.node_tree:
        return None
    nodes, links = [], []
    for n in mat.node_tree.nodes:
        entry = [n.bl_idname]
        if n.bl_idname == "ShaderNodeTexImage":
            entry += [n.image.name if n.image else None, n.interpolation, n.projection, n.extension]
            if n.image and n.image.colorspace_settings:
                entry.append(n.image.colorspace_settings.name)
        for s in n.inputs:
            if s.is_linked or not hasattr(s, "default_value"):
                continue
            v = s.default_value
            try:
                v = [round(x, 4) for x in v]
            except TypeError:
                v = round(v, 4) if isinstance(v, float) else v
            entry.append((s.identifier, v))
        for prop in ("blend_type", "operation", "uv_map", "attribute_name", "data_type", "mode"):
            if hasattr(n, prop):
                entry.append((prop, str(getattr(n, prop))))
        if n.bl_idname == "ShaderNodeValToRGB":
            entry.append(tuple((round(e.position, 4), tuple(round(c, 4) for c in e.color)) for e in n.color_ramp.elements))
        nodes.append(json.dumps(entry, default=str))
    order = list(mat.node_tree.nodes)
    for l in mat.node_tree.links:
        links.append((l.from_socket.identifier, l.to_socket.identifier, nodes[order.index(l.from_node)], nodes[order.index(l.to_node)]))
    settings = (mat.blend_method if hasattr(mat, "blend_method") else None, getattr(mat, "surface_render_method", None),
                mat.use_backface_culling, round(mat.alpha_threshold, 4) if hasattr(mat, "alpha_threshold") else None,
                tuple(round(c, 4) for c in mat.diffuse_color))
    return json.dumps([sorted(nodes), sorted(links), settings], default=str)


def merge_materials():
    groups = {}
    for m in bpy.data.materials:
        if m.library or m.is_grease_pencil:
            continue
        sig = material_signature(m)
        if sig:
            groups.setdefault(sig, []).append(m)
    for mats in groups.values():
        if len(mats) < 2:
            continue
        mats.sort(key=lambda m: (1 if SUFFIX.search(m.name) else 0, len(m.name), m.name))
        keeper, dups = mats[0], mats[1:]
        report["materials_merged"].append({"keeper": keeper.name, "removed": [d.name for d in dups]})
        if DRY_RUN:
            continue
        for d in dups:
            d.user_remap(keeper)
            bpy.data.materials.remove(d)


# ---------------- run ----------------
snapshot("before")
imgs = candidates()

# 1. duplicates by bytes, then by decoded pixels
by_bytes = {}
for img in imgs:
    h = bytes_hash(img)
    if h:
        by_bytes.setdefault(h, []).append(img)
merge_images(by_bytes, "duplicates")
imgs = [i for i in candidates()]
by_pixels = {}
for img in imgs:
    h = pixel_hash(img)
    if h:
        by_pixels.setdefault(h, []).append(img)
merge_images(by_pixels, "pixel_duplicates")
imgs = candidates()

# 2. flat, 3. oversize
for img in imgs:
    if img.name in KEEP_NAMES or img.users == 0:
        continue
    w, h = img.size
    arr = pixels(img)
    if arr is not None and max(w, h) > FLAT_SIZE and float(arr.std(axis=0).max()) < FLAT_STD:
        scale_to(img, FLAT_SIZE, FLAT_SIZE, f"flat, std {float(arr.std(axis=0).max()):.4f}", "flat")
        continue
    if MAX_DIM and max(w, h) > MAX_DIM:
        nw, nh = w, h
        while max(nw, nh) > MAX_DIM:
            nw, nh = max(1, nw // 2), max(1, nh // 2)
        scale_to(img, nw, nh, f"longest side {max(w, h)} > {MAX_DIM}", "oversize")

# 4. materials
if MERGE_MATERIALS:
    merge_materials()

# 5. unused
for img in candidates():
    if img.users == 0 and img.name not in KEEP_NAMES:
        report["unused_images"].append(img.name)
        if not DRY_RUN:
            bpy.data.images.remove(img)
for m in list(bpy.data.materials):
    if m.users == 0 and not m.library:
        report["unused_materials"].append(m.name)
        if not DRY_RUN:
            bpy.data.materials.remove(m)
if not DRY_RUN:
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=False, do_recursive=True)

# 6. pack
if PACK:
    for img in candidates():
        if img.source == "FILE" and not img.packed_file:
            report["packed"].append(img.name)
            if not DRY_RUN:
                img.pack()

snapshot("after")
b, a = report["before"], report["after"]
print("IMG_CONSOLIDATE", json.dumps(report, indent=1, default=str))
print(f"\nimages {b['images']} -> {a['images']}   materials {b['materials']} -> {a['materials']}   "
      f"texture VRAM ~{b['texture_vram_mb']}MB -> ~{a['texture_vram_mb']}MB"
      + ("   (DRY RUN, nothing changed)" if DRY_RUN else "   (not saved: check the viewport, then save)"))
if report["missing_files"]:
    print(f"WARNING {len(report['missing_files'])} image(s) point at files that do not exist; relink them before exporting:")
    for m in report["missing_files"]:
        print("   ", m["image"], "->", m["filepath"])
