"""WebP pass and page checks for scripts/export-lowrider.sh.

Usage: python3 scripts/optimize-lowrider.py raw.glb out.glb [currently-installed.glb]
Re-encodes color textures (base color / emissive, never data maps) as WebP when that is smaller; every
other bufferView stays byte-identical. Exits without writing if a clip the page loops is missing or a
primitive lost Draco compression. Needs Pillow with WebP support.
"""
import io
import json
import re
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def read_glb(path):
    data = Path(path).read_bytes()
    json_length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + json_length])
    binary = data[28 + json_length:]
    return doc, [binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in doc['bufferViews']]


def write_glb(path, doc, views):
    blob = bytearray()
    for view, payload in zip(doc['bufferViews'], views):
        blob.extend(b'\0' * (-len(blob) % 4))
        view['byteOffset'] = len(blob)
        view['byteLength'] = len(payload)
        blob.extend(payload)
    doc['buffers'][0]['byteLength'] = len(blob)
    blob.extend(b'\0' * (-len(blob) % 4))
    meta = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    meta += b' ' * (-len(meta) % 4)
    Path(path).write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(meta) + len(blob))
                           + struct.pack('<II', len(meta), 0x4E4F534A) + meta
                           + struct.pack('<II', len(blob), 0x004E4942) + blob)


def texture_source(texture):
    return texture.get('extensions', {}).get('EXT_texture_webp', {}).get('source', texture.get('source'))


def clip_seconds(doc):
    accessors = doc['accessors']
    return {a['name']: round(max(accessors[s['input']]['max'][0] for s in a['samplers']), 2) for a in doc.get('animations', [])}


raw_path, out_path = sys.argv[1], sys.argv[2]
installed_path = sys.argv[3] if len(sys.argv) > 3 else None
doc, views = read_glb(raw_path)
original = json.loads(json.dumps(doc))
untouched = list(views)

color, data_maps = set(), set()
for material in doc.get('materials', []):
    pbr = material.get('pbrMetallicRoughness', {})
    for ref in (pbr.get('baseColorTexture'), material.get('emissiveTexture')):
        if ref:
            color.add(texture_source(doc['textures'][ref['index']]))
    for ref in (pbr.get('metallicRoughnessTexture'), material.get('normalTexture'), material.get('occlusionTexture')):
        if ref:
            data_maps.add(texture_source(doc['textures'][ref['index']]))

converted = set()
for index, image in enumerate(doc.get('images', [])):
    if index not in color or index in data_maps:
        continue
    view = image['bufferView']
    decoded = Image.open(io.BytesIO(views[view]))
    decoded.load()
    encoded = io.BytesIO()
    decoded.save(encoded, format='WEBP', quality=85, method=6, exact=True)
    if len(encoded.getvalue()) >= len(views[view]):
        continue
    views[view] = encoded.getvalue()
    converted.add(view)
    image['mimeType'] = 'image/webp'
    for texture in doc['textures']:
        if texture_source(texture) == index:
            texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': index}
            texture.pop('source', None)
for key in ('extensionsUsed', 'extensionsRequired'):
    if 'EXT_texture_webp' not in doc.setdefault(key, []):
        doc[key].append('EXT_texture_webp')

for key in ('animations', 'meshes', 'nodes'):
    assert doc.get(key) == original.get(key), f'{key} changed during the WebP pass'

looping = re.search(r'LOOPING_CLIPS = new Set\(\[(.*?)\]\)', (ROOT / 'src/lib/palmTreeDriveCar.mjs').read_text(), re.S)
wanted = set(re.findall(r"'([^']+)'", looping.group(1)))
problems = [f'missing clip {name!r} (the page loops it)' for name in sorted(wanted - set(clip_seconds(doc)))]
primitives = [p for mesh in doc['meshes'] for p in mesh['primitives']]
uncompressed = sum('KHR_draco_mesh_compression' not in p.get('extensions', {}) for p in primitives)
if uncompressed:
    problems.append(f'{uncompressed} of {len(primitives)} primitives are not Draco-compressed')
if problems:
    sys.exit('not installed: ' + '; '.join(problems))

write_glb(out_path, doc, views)
_, written = read_glb(out_path)
assert all(written[i] == untouched[i] for i in range(len(untouched)) if i not in converted), 'bufferView bytes changed'

print(f'optimized {Path(raw_path).stat().st_size / 1e6:.2f} MB -> {Path(out_path).stat().st_size / 1e6:.2f} MB '
      f'({len(converted)} textures to WebP)')
print('clips (s):', clip_seconds(doc))
if installed_path and Path(installed_path).exists():
    installed, _ = read_glb(installed_path)
    before, after = {n.get('name') for n in installed['nodes']}, {n.get('name') for n in doc['nodes']}
    print('objects added:', sorted(after - before) or 'none', '| removed:', sorted(before - after) or 'none')
    old_clips, new_clips = clip_seconds(installed), clip_seconds(doc)
    changed = {k: (old_clips[k], new_clips[k]) for k in old_clips.keys() & new_clips.keys() if abs(old_clips[k] - new_clips[k]) > 0.05}
    if changed:
        print('WARNING clip lengths changed (old s, new s):', changed)
