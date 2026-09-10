// The rig GLB, served: Michelle's raw Blender export (models-src/, animations
// on, textures as authored — the kitbash UI atlases alone are 15 MB of PNG)
// → public/models/<name>.glb with textures as ≤1k WebP, unused data pruned.
//   node scripts/optimize-rig.mjs models-src/oilJack_liquids_raw.glb public/models/oilJack_fancy_allProps3.glb
// gltf-transform is not a project dependency: GLTF_TRANSFORM_PATH or the npx cache.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const GT = process.env.GLTF_TRANSFORM_PATH || (() => {
  const base = path.join(process.env.HOME, ".npm/_npx");
  for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/@gltf-transform"); if (fs.existsSync(path.join(p, "core"))) return p; }
  throw new Error("gltf-transform not found; set GLTF_TRANSFORM_PATH");
})();
const { NodeIO, VertexLayout } = require(path.join(GT, "core"));
const { ALL_EXTENSIONS } = require(path.join(GT, "extensions"));
const { prune, dedup, textureCompress, draco, resample } = require(path.join(GT, "functions"));
// Draco in and out (the kitbash exports use it; the project has draco3d): decode on
// read, and RIG_DRACO=1 re-encodes on write for the big complexes.
const draco3d = require("draco3d");
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: node scripts/optimize-rig.mjs <raw.glb> <out.glb>"); process.exit(1); }
const SIZE = Number(process.env.RIG_TEX_SIZE || 1024);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});
const doc = await io.read(src);
const before = fs.statSync(src).size;
// Nodes that must not ship: Blender exports objects hidden in the viewport unless
// told otherwise, and Pipe_01 (the old rig's pipe, hidden in her scene) floated
// through the new silo (2026-09-06).
const EXCLUDE = (process.env.RIG_EXCLUDE || "Pipe_01").split(",").map((s) => s.trim()).filter(Boolean);
for (const node of doc.getRoot().listNodes()) if (EXCLUDE.includes(node.getName())) { const all = []; node.traverse((n) => all.push(n)); all.reverse().forEach((n) => n.dispose()); }
// Normal maps get half the size of the colour atlases (RIG_NORMAL_SIZE), or go
// entirely with RIG_DROP_NORMALS=1 — flat-shaded kitbash pieces barely use them.
const NSIZE = Number(process.env.RIG_NORMAL_SIZE || Math.max(256, SIZE / 2));
if (process.env.RIG_DROP_NORMALS === "1") for (const m of doc.getRoot().listMaterials()) m.setNormalTexture(null);
// keepLeaves: the rig carries marker EMPTIES (CrankPin_*, BeamPin_*, CrankAxle, RodRef)
// that the field shader reads for the pitman four-bar; default prune() deletes empty leaves.
// Blender writes a lone-triangle mesh without indices and Draco skips those, so they are
// written raw. Keep raw vertex data SEPARATE (not interleaved): three's GLTFLoader turns
// interleaved data into InterleavedBufferAttributes, which the field merge
// (mergeGeometries) refuses to combine with Draco-decoded attributes. (weld() would index
// them, but its internal prune drops the marker empties — do not add it.)
io.setVertexLayout(VertexLayout.SEPARATE);
await doc.transform(prune({ keepLeaves: true }), dedup(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [SIZE, SIZE], quality: 82, slots: /^(?!normal)/ }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [NSIZE, NSIZE], quality: 82, slots: /normal/ }),
  // RIG_RESAMPLE=1: drop redundant animation keyframes (the crew character's 30 fps mocap;
  // lossless within 1e-4). Off for the rig: its 13 object channels are already tiny.
  ...(process.env.RIG_RESAMPLE === "1" ? [resample({ tolerance: 1e-4 })] : []),
  ...(process.env.RIG_DRACO === "1" ? [draco()] : []));
await io.write(out, doc);
const root = doc.getRoot();
console.log(`${path.basename(src)} ${(before / 1048576).toFixed(1)} MB → ${path.basename(out)} ${(fs.statSync(out).size / 1024).toFixed(0)} KB · textures ${root.listTextures().length} · clips ${root.listAnimations().map((a) => a.getName()).join(", ") || "none"} · nodes ${root.listNodes().length}`);
