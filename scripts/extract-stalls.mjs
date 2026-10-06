// Boardwalk stalls for the phone portal — one GLB per vendor, EXTRACTED from
// the desktop strip so the strip stays the single source of truth:
//   node scripts/extract-stalls.mjs           (re-run after a strip re-export)
//   STALL_ONLY=carny,claw node scripts/extract-stalls.mjs   (just those; the rest keep their files)
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

// CommercialStrip4 (2026-10-05): the hot air balloon and the taco trailer left
// the export, the prize wheel was renamed, and the claw machine and gachapon
// arrived. Only carny / claw / gachapon have been re-extracted from it so far —
// the other stall files on disk are still the CommercialStrip3 cut, whose
// staging (VendorStage's STAGE_TUNE) was tuned against them. Re-cut those one
// at a time with STALL_ONLY and check the card before keeping the result.
const SRC = "public/models/CommercialStrip4_opt.glb";
const OUT = "public/models/stalls";
// Z windows along the deck (strip-local), read off the node list; the anchor
// is the catalog's `prop`. Everything top-level whose bounds centre falls in
// the window (and is not strip-wide dressing) comes along.
const STALLS = {
  // The barker has no prop of his own any more: the anchor is the RIDES sign he
  // stands by, and the window takes in the barricades and fold-out signs.
  carny:     { anchor: "SM_Prop_Sign_Rides_01",          z: [-38.6, -30.25] },
  promos:    { anchor: "Prize_Wheel",                    z: [-30.2, -23.4] },
  fortunes:  { anchor: "FortuneTeller_Wagon_Empty",      z: [-15.6, -5.0] },
  // The two machines: each is one top-level EMPTY holding every part its
  // controller looks up by name, so the anchor alone is the whole stall. The
  // claw's Claw_Demo clip targets only nodes under Toy_Claw_Empty and survives
  // the prune with it.
  claw:      { anchor: "Toy_Claw_Empty",                 z: [-4.6, -2.8] },
  gachapon:  { anchor: "Gachapon",                       z: [-2.4, -1.3] },
  hotdogs:   { anchor: "SM_Veh_Hotdog_Cart_01",          z: [7.6, 12.6] },
  rugs:      { anchor: "SM_Prop_Market_Stall_05",        z: [12.9, 18.6] },
  tonics:    { anchor: "SM_Veh_Wagon_Shop_01",           z: [18.9, 26.2] },
  tattoos:   { anchor: "SM_Prop_Tent_01",                z: [25.6, 33.0] },
  // souvenirs: the catalog's "SM_Prop_Tent_02 (24)" is not in the strip — no stall to extract (off the phone row for now).
};
const ONLY = (process.env.STALL_ONLY || "").split(",").map((x) => x.trim()).filter(Boolean);
const EXCLUDE = /^(Boardwalk$|SM_Prop_Bunting_Pole|SM_Prop_Light_0|Spotlight|SC_CincoDeMayo|Photo_booth|Booth_|Text|Point|Wire|StringLight|SM_Prop_Mechanical_Bull|Bull_Tent|Claw_Machine|Toy_Claw_Empty|Gachapon$|Vending_Machine|ATM$)/;
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
  if (ONLY.length && !ONLY.includes(id)) continue;
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
  // dispose the whole subtree: disposing just the top node orphans its children, and
  // an orphan with a mesh survives the prune (the file carried the entire strip's geometry)
  for (const n of top) if (!keep.has(n)) { const sub = []; n.traverse((c) => sub.push(c)); sub.reverse().forEach((c) => c.dispose()); }
  // Animations: a channel aimed at a node that just left the scene keeps that
  // node — and its meshes and textures — alive through the prune (the claw's
  // parts rode along in every stall). Drop those channels, and any clip left empty.
  const alive = new Set(); for (const n of keep) n.traverse((c) => alive.add(c));
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) if (!alive.has(ch.getTargetNode())) { const sm = ch.getSampler(); ch.dispose(); if (sm && !anim.listChannels().some((c) => c.getSampler() === sm)) sm.dispose(); }
    if (!anim.listChannels().length) anim.dispose();
  }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: "webp", resize: [SIZE, SIZE], quality: 82 }));
  const out = path.join(OUT, `stall_${id}.glb`);
  await io.write(out, doc);
  const kb = Math.round(fs.statSync(out).size / 1024);
  const names = [...keep].map((n) => n.getName()).filter((n) => n !== DECK);
  console.log(`✓ ${id.padEnd(9)} ${String(kb).padStart(5)} KB  z[${z0.toFixed(1)}, ${z1.toFixed(1)}]  ${names.length} props: ${names.slice(0, 7).join(", ")}${names.length > 7 ? ` … +${names.length - 7}` : ""}`);
}
