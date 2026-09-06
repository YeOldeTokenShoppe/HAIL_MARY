// The chapel from Michelle's Tent_Revival.glb (2026-09-05): one Blender export
// holding the whole revival — church stage, tent + four wall panels, chairs,
// podium, candle rack — AND the preacher (skinned, one "preaching" clip),
// authored at the origin facing +Z. The vendor pipeline wants them apart:
//   public/models/stalls/stall_chapel.glb          the props (phone stall + desktop mount)
//   public/models/Vendor_Chaplain_Character.glb    the preacher + his clip
// both re-seated into the strip frame (vendors face -X; the taco window is
// strip z 0.6…8, deck depth x 0…4.7): yaw -90° about Y, then translate.
// Re-run after she re-exports Tent_Revival.glb:
//   node scripts/split-tent-revival.mjs
// gltf-transform is not a project dependency: GLTF_TRANSFORM_PATH or the npx cache.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const GT = process.env.GLTF_TRANSFORM_PATH || (() => {
  const base = path.join(process.env.HOME, ".npm/_npx");
  for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/@gltf-transform"); if (fs.existsSync(p)) return p; }
  throw new Error("gltf-transform not found; set GLTF_TRANSFORM_PATH");
})();
const { NodeIO } = require(path.join(GT, "core"));
const { ALL_EXTENSIONS } = require(path.join(GT, "extensions"));
const { prune, dedup } = require(path.join(GT, "functions"));

const SRC = "public/models/Tent_Revival.glb";
const OUT_STALL = "public/models/stalls/stall_chapel.glb";
const OUT_CHAR = "public/models/Vendor_Chaplain_Character.glb";
const CHARACTER_CLIP = "preaching";      // his clip; every other clip (Robot_Sit, Biker_Sit…) belongs to the sitters in the stall
// The preacher's root is whatever the `preaching` clip drives (it was "Empty",
// then "Empty_Preacher" — found from the clip so renames in Blender don't matter).
function characterRoot(doc) {
  const anim = doc.getRoot().listAnimations().find((a) => a.getName() === CHARACTER_CLIP);
  if (!anim) throw new Error(`no "${CHARACTER_CLIP}" clip in ${SRC}`);
  let n = anim.listChannels()[0].getTargetNode();
  while (n.getParentNode()) n = n.getParentNode();
  return n.getName();
}
const STRAY_ROOTS = ["Root.002"];        // an armature with no mesh in the 2026-09-05 export — renders nothing, drop it
const YAW = -Math.PI / 2;                // +Z (her forward) → -X (the strip's facing)
const SHIFT = [1.7, 0, 3.2];             // scene origin → strip (x depth, y, z along the deck)

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const qYaw = [0, Math.sin(YAW / 2), 0, Math.cos(YAW / 2)];
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const rotY = ([x, y, z]) => [x * Math.cos(YAW) + z * Math.sin(YAW), y, -x * Math.sin(YAW) + z * Math.cos(YAW)];

function reseat(doc) {
  const scene = doc.getRoot().listScenes()[0];
  for (const n of scene.listChildren()) {
    const t = rotY(n.getTranslation()); n.setTranslation([t[0] + SHIFT[0], t[1] + SHIFT[1], t[2] + SHIFT[2]]);
    n.setRotation(qmul(qYaw, n.getRotation()));
  }
  return scene;
}
function disposeSubtree(node) { const all = []; node.traverse((n) => all.push(n)); all.reverse().forEach((n) => n.dispose()); }

// ── the stall: everything but the preacher, plus the deck slab the other stalls carry ──
{
  const doc = await io.read(SRC);
  const scene = reseat(doc); const CHARACTER_ROOT = characterRoot(doc);
  // The congregation (the seated robot and biker, 2026-09-05) stays in the stall
  // WITH its clips — StallProps / StallModelMount play every clip a stall carries.
  for (const n of scene.listChildren()) if (n.getName() === CHARACTER_ROOT || STRAY_ROOTS.includes(n.getName())) disposeSubtree(n);
  doc.getRoot().listAnimations().forEach((a) => { if (a.getName() === CHARACTER_CLIP) a.dispose(); });
  doc.getRoot().listSkins().forEach((sk) => { if (sk.listJoints().length === 0) sk.dispose(); });
  const buffer = doc.getRoot().listBuffers()[0] || doc.createBuffer();
  const P = [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5, -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5];
  const I = [0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 2,3,7, 2,7,6, 1,2,6, 1,6,5, 0,4,7, 0,7,3];
  const pos = doc.createAccessor("deck-pos").setType("VEC3").setArray(new Float32Array(P)).setBuffer(buffer);
  const idx = doc.createAccessor("deck-idx").setType("SCALAR").setArray(new Uint16Array(I)).setBuffer(buffer);
  const mat = doc.createMaterial("Deck").setBaseColorFactor([0.36, 0.24, 0.14, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
  const mesh = doc.createMesh("Boardwalk").addPrimitive(doc.createPrimitive().setAttribute("POSITION", pos).setIndices(idx).setMaterial(mat));
  scene.addChild(doc.createNode("Boardwalk").setMesh(mesh).setTranslation([0.2, -0.07, 0]).setScale([10.8, 0.14, 77.2]));
  await doc.transform(prune(), dedup());
  await io.write(OUT_STALL, doc);
  console.log("stall:", OUT_STALL, (fs.statSync(OUT_STALL).size / 1024).toFixed(0), "KB · roots:", scene.listChildren().map((n) => n.getName()).join(", "), "· clips:", doc.getRoot().listAnimations().map((a) => a.getName()).join(", ") || "none", "· skins:", doc.getRoot().listSkins().length);
}
// ── the preacher: his root only, clip and skin kept ──
{
  const doc = await io.read(SRC);
  const scene = reseat(doc); const CHARACTER_ROOT = characterRoot(doc);
  for (const n of scene.listChildren()) if (n.getName() !== CHARACTER_ROOT) disposeSubtree(n);
  doc.getRoot().listAnimations().forEach((a) => { if (a.getName() !== CHARACTER_CLIP) a.dispose(); });
  doc.getRoot().listSkins().forEach((sk) => { if (sk.listJoints().length === 0) sk.dispose(); });
  await doc.transform(prune(), dedup());
  await io.write(OUT_CHAR, doc);
  const root = scene.listChildren()[0];
  console.log("character:", OUT_CHAR, (fs.statSync(OUT_CHAR).size / 1024).toFixed(0), "KB · root", root.getName(), "at", root.getTranslation().map((v) => +v.toFixed(2)), "· clips:", doc.getRoot().listAnimations().map((a) => a.getName()).join(", "));
}
console.log("→ now bump CHAPEL_ASSET_V in src/components/CommercialStrip.jsx so browsers and the CDN fetch the new files.");
