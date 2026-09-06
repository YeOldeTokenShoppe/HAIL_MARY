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
const { NodeIO } = require(path.join(GT, "core"));
const { ALL_EXTENSIONS } = require(path.join(GT, "extensions"));
const { prune, dedup, textureCompress } = require(path.join(GT, "functions"));
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: node scripts/optimize-rig.mjs <raw.glb> <out.glb>"); process.exit(1); }
const SIZE = Number(process.env.RIG_TEX_SIZE || 1024);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const before = fs.statSync(src).size;
// Nodes that must not ship: Blender exports objects hidden in the viewport unless
// told otherwise, and Pipe_01 (the old rig's pipe, hidden in her scene) floated
// through the new silo (2026-09-06).
const EXCLUDE = (process.env.RIG_EXCLUDE || "Pipe_01").split(",").map((s) => s.trim()).filter(Boolean);
for (const node of doc.getRoot().listNodes()) if (EXCLUDE.includes(node.getName())) { const all = []; node.traverse((n) => all.push(n)); all.reverse().forEach((n) => n.dispose()); }
await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: "webp", resize: [SIZE, SIZE], quality: 82 }));
await io.write(out, doc);
const root = doc.getRoot();
console.log(`${path.basename(src)} ${(before / 1048576).toFixed(1)} MB → ${path.basename(out)} ${(fs.statSync(out).size / 1024).toFixed(0)} KB · textures ${root.listTextures().length} · clips ${root.listAnimations().map((a) => a.getName()).join(", ") || "none"} · nodes ${root.listNodes().length}`);
