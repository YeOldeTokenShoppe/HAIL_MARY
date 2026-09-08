// Swap the pump jack inside the shipped plot GLB (2026-09-07).
//
// The liquids plot (kiosk, silo, outlets, pad …) ships as ONE GLB with the pump as a
// sub-tree under `Scene_Empty`. Michelle's Synty pumpjack is exported from Blender on
// its own (Bottom_Box hierarchy, NLA track "pump" → one clip). This script drops the
// old pump out of a copy of the plot and seats the Synty one where it stood:
//
//   node scripts/swap-rig-pump.mjs \
//     public/models/oilJack_fancy_allProps3.glb models-src/oilJack_synty_pump_raw.glb \
//     public/models/oilJack_synty.glb
//
// Placement (glTF space, Y-up): the old base plate's centre was x 0.98, z 0.09. The
// Synty rig spans z −8.86…5.63 in its own frame at 0.35 scale to match the old rig's
// 2.8 m height, so the root lands at z 0.655 to centre it on that spot. Override with
// RIG_POS="x,y,z" / RIG_SCALE=0.35. Textures: the Synty atlas is flat colour blocks, so
// RIG_TEX_SIZE (default 512) is plenty. gltf-transform comes from the npx cache like
// optimize-rig.mjs.
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
const { prune, dedup, textureCompress, draco, mergeDocuments, unpartition } = require(path.join(GT, "functions"));
const draco3d = require("draco3d");

const [plotPath, pumpPath, outPath] = process.argv.slice(2);
if (!plotPath || !pumpPath || !outPath) { console.error("usage: node scripts/swap-rig-pump.mjs <plot.glb> <pump_raw.glb> <out.glb>"); process.exit(1); }
const OLD_ROOT = process.env.RIG_OLD_ROOT || "Scene_Empty";
const NEW_ROOT = process.env.RIG_NEW_ROOT || "Bottom_Box";
const POS = (process.env.RIG_POS || "0.98,0,0.655").split(",").map(Number);
const SCALE = Number(process.env.RIG_SCALE || 0.35);
const SIZE = Number(process.env.RIG_TEX_SIZE || 512);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});
const plot = await io.read(plotPath);
const pump = await io.read(pumpPath);

// 1) The pump on its own: shrink the atlas, drop anything unreferenced.
await pump.transform(prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [SIZE, SIZE], quality: 82 }));

// 2) Old pump out of the plot: its node sub-tree and the clips that drove it.
const plotRoot = plot.getRoot();
const oldRoot = plotRoot.listNodes().find((n) => n.getName() === OLD_ROOT);
if (!oldRoot) throw new Error(`plot has no node named ${OLD_ROOT}`);
const doomed = []; oldRoot.traverse((n) => doomed.push(n));
const doomedSet = new Set(doomed);
for (const anim of plotRoot.listAnimations()) {
  const targets = anim.listChannels().map((c) => c.getTargetNode()).filter(Boolean);
  if (targets.length && targets.every((n) => doomedSet.has(n))) anim.dispose();
}
doomed.reverse().forEach((n) => n.dispose());

// 3) Pump in: merge the documents, move its scene roots under the plot's scene.
mergeDocuments(plot, pump);
const scenes = plotRoot.listScenes();
const plotScene = scenes[0];
for (const extra of scenes.slice(1)) {
  for (const node of extra.listChildren()) plotScene.addChild(node);
  extra.dispose();
}
const newRoot = plotRoot.listNodes().find((n) => n.getName() === NEW_ROOT);
if (!newRoot) throw new Error(`pump has no node named ${NEW_ROOT}`);
newRoot.setTranslation(POS).setRotation([0, 0, 0, 1]).setScale([SCALE, SCALE, SCALE]);

// 4) Tidy and write (one buffer — a GLB allows no more). The Blender export is Draco
// and that extension rides along on merge, which would re-encode EVERY primitive on
// write; the shipped plot is uncompressed, so drop it unless RIG_DRACO=1 asks for it.
if (process.env.RIG_DRACO !== "1") for (const ext of plotRoot.listExtensionsUsed()) if (ext.extensionName === "KHR_draco_mesh_compression") ext.dispose();
await plot.transform(prune(), dedup(), unpartition(), ...(process.env.RIG_DRACO === "1" ? [draco()] : []));
await io.write(outPath, plot);
const names = new Set(plotRoot.listNodes().map((n) => n.getName()));
console.log(`${path.basename(outPath)} ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB · clips ${plotRoot.listAnimations().map((a) => a.getName()).join(", ") || "none"} · nodes ${names.size} · textures ${plotRoot.listTextures().length}`);
console.log(`pump root ${NEW_ROOT} @ [${POS.join(", ")}] ×${SCALE}; old ${OLD_ROOT} removed (${doomed.length} nodes)`);
for (const n of ["Body_Pump", "Head_Pump", "Counterweight", "Wheel_Back", "Straw", "Samson_Post", "Under_Pump", "Pipe_01", "Wheel", "MachinePanel", "Kiosk_Base", "ground"]) if (!names.has(n)) console.warn(`warning: expected node missing: ${n}`);
