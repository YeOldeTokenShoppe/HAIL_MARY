// Boardwalk stalls for the phone portal — one GLB per vendor, EXTRACTED from
// the desktop strip so the strip stays the single source of truth:
//   node scripts/extract-stalls.mjs           (re-run after a strip re-export)
// Each stall keeps its anchor prop and the dressing that sits in its stretch of
// deck (a Z window along the boardwalk), plus the Boardwalk deck itself (one
// box — costs nothing and reads as the real deck), at their ORIGINAL strip
// transforms. The character GLBs are authored in that same frame, so
// VendorStage composes prop + character exactly as CommercialStrip does.
// Textures are pruned to what the stall uses and resized to 1k.
// gltf-transform is not a project dependency: point GLTF_TRANSFORM_PATH at an
// install (defaults to the npx cache), it is loaded through require().
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const GT = process.env.GLTF_TRANSFORM_PATH || (() => {
  const base = path.join(process.env.HOME, ".npm/_npx");
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) { const p = path.join(base, d, "node_modules/@gltf-transform"); if (fs.existsSync(path.join(p, "core"))) return p; }
  return "@gltf-transform";
})();
const { NodeIO, getBounds } = require(path.join(GT, "core"));
const { ALL_EXTENSIONS } = require(path.join(GT, "extensions"));
const { prune, textureCompress, dedup } = require(path.join(GT, "functions"));
// The strip is meshopt-compressed: decode with three's copy, re-encode with the
// project's meshoptimizer so the stalls stay small (useGLTF already decodes it).
const { MeshoptDecoder } = await import("/Users/michellepaulson/HAIL_MARY/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js");
const { MeshoptEncoder } = await import("meshoptimizer");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);

const SRC = "public/models/CommercialStrip3_opt2k.glb";
const OUT = "public/models/stalls";
// Z windows along the deck (strip-local), read off the node list; the anchor
// is the catalog's `prop`. Everything top-level whose bounds centre falls in
// the window (and is not strip-wide dressing) comes along.
const STALLS = {
  carny:     { anchor: "SM_Prop_Hot_Air_Balloon_01.002", z: [-40.7, -29.9] },
  promos:    { anchor: "SM_Prop_Prize_Wheel_01",         z: [-30.2, -23.4] },
  fortunes:  { anchor: "FortuneTeller_Wagon_Empty",      z: [-15.6, -5.0] },
  tacos:     { anchor: "SM_Veh_Food_Trailer_02",         z: [0.6, 8.0] },
  hotdogs:   { anchor: "SM_Veh_Hotdog_Cart_01",          z: [7.6, 12.6] },
  rugs:      { anchor: "SM_Prop_Market_Stall_05",        z: [12.9, 18.6] },
  tonics:    { anchor: "SM_Veh_Wagon_Shop_01",           z: [18.9, 26.2] },
  tattoos:   { anchor: "SM_Prop_Tent_01",                z: [25.6, 33.0] },
  // souvenirs: the catalog's "SM_Prop_Tent_02 (24)" is not in CommercialStrip3 — no stall to extract (off the phone row for now).
};
const EXCLUDE = /^(Boardwalk$|SM_Prop_Bunting_Pole|SM_Prop_Light_0|Spotlight|SC_CincoDeMayo|Photo_booth|Booth_|Text|Point|Wire|StringLight|SM_Prop_Mechanical_Bull|Bull_Tent|Claw_Machine|Vending_Machine|ATM$)/;
const DECK = "Boardwalk";
const MAX_X = 4.7;   // beyond the deck edge = the strip's back-of-house dressing
const SIZE = Number(process.env.STALL_TEX || 1024);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
// Shared with scripts/render-postcards.mjs (the backplates hide the same windows).
fs.writeFileSync("scripts/stall-windows.json", JSON.stringify({ windows: Object.fromEntries(Object.entries(STALLS).map(([k, v]) => [k, v.z])), maxX: MAX_X, exclude: EXCLUDE.source }, null, 2));
fs.mkdirSync(OUT, { recursive: true });
const centre = (n) => { const b = getBounds(n); return b.min.map((v, i) => (v + b.max[i]) / 2); };
const hasMesh = (n) => { let h = false; n.traverse((c) => { if (c.getMesh()) h = true; }); return h; };

for (const [id, spec] of Object.entries(STALLS)) {
  const doc = await io.read(SRC);                       // fresh copy per stall
  const scene = doc.getRoot().listScenes()[0];
  const top = scene.listChildren();
  // Anchor by base name (Blender's ".001" suffixes don't count), anywhere in the tree —
  // a nested anchor keeps its whole top-level ancestor.
  const base = (n) => n.replace(/\.\d{3}$/, "");
  let anchor = null;
  for (const n of doc.getRoot().listNodes()) if (n.getName() === spec.anchor || base(n.getName()) === spec.anchor) { anchor = n; break; }
  if (!anchor) { console.log(`✗ ${id}: anchor "${spec.anchor}" not found; names with "Tent": ${doc.getRoot().listNodes().map((n) => n.getName()).filter((n) => /tent/i.test(n)).join(", ")}`); continue; }
  while (anchor.getParentNode && anchor.getParentNode()) anchor = anchor.getParentNode();
  if (!top.includes(anchor)) { console.log(`✗ ${id}: anchor is not under the scene root`); continue; }
  let [z0, z1] = spec.z || (() => { const b = getBounds(anchor); return [b.min[2] - 1.4, b.max[2] + 1.4]; })();
  const keep = new Set([anchor]);
  const deck = top.find((n) => n.getName() === DECK); if (deck) keep.add(deck);
  for (const n of top) {
    if (keep.has(n) || !hasMesh(n) || EXCLUDE.test(n.getName())) continue;
    const c = centre(n);
    if (c[2] >= z0 && c[2] <= z1 && c[0] <= MAX_X) keep.add(n);
  }
  for (const n of top) if (!keep.has(n)) n.dispose();
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: "webp", resize: [SIZE, SIZE], quality: 82 }));
  const out = path.join(OUT, `stall_${id}.glb`);
  await io.write(out, doc);
  const kb = Math.round(fs.statSync(out).size / 1024);
  const names = [...keep].map((n) => n.getName()).filter((n) => n !== DECK);
  console.log(`✓ ${id.padEnd(9)} ${String(kb).padStart(5)} KB  z[${z0.toFixed(1)}, ${z1.toFixed(1)}]  ${names.length} props: ${names.slice(0, 7).join(", ")}${names.length > 7 ? ` … +${names.length - 7}` : ""}`);
}
