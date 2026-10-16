#!/usr/bin/env node
// build-strip.mjs — turn a Blender export of the boardwalk strip into the two
// runtime files CommercialStrip.jsx loads (docs/strip-export.md, steps 2 + 3):
//
//   node scripts/build-strip.mjs public/models/Commercial_Strip8.glb
//     → public/models/Commercial_Strip8_opt.glb        (webp, the ?strip=webp fallback)
//     → public/models/Commercial_Strip8_opt_ktx2.glb   (Basis/ETC1S, THE FILE THE SITE LOADS)
//
// Then bump STRIP_MODEL_V in CommercialStrip.jsx and point STRIP_MODEL_* at the
// new names. Nothing is copied into public/models unless both builds pass the
// checks at the bottom (named nodes, bulbs, Basis coverage, clip names). A claw
// prize exported outside Toy_Claw_Empty is reparented with its world pose kept.
//
// Why a script and not the six shell lines in the doc: the 2026-10-10 export
// (Commercial_Strip8) was saved with Blender's animation mode set to "Scene"
// instead of "NLA Tracks". That bakes EVERY object into one clip called
// "Animation" — 1665 channels, 507 targets, 35 of them actually moving — and
// the claw controller, which looks a clip named Claw_Demo up by name, finds
// nothing. Worse, the strip autoplays every clip it carries, so the constant
// tracks on the prize wheel, wagon doors, etc. would pin those nodes every
// frame and freeze the runtime spins. normalizeClips() below repairs that
// shape: constant channels go, the claw's channels become Claw_Demo, each
// skinned character's joints become "<Rig>_Sit" (Robot_Sit / Biker_Sit, the
// names the old stall GLB used). A properly exported file (a Claw_Demo clip
// already present) is left exactly as authored.
//
// gltf-transform is not a project dependency: the API is loaded from the npx
// cache (same trick as scripts/extract-stalls.mjs) and the CLI stages run
// through `npx @gltf-transform/cli`. The ktx encoder is ~/.local/ktx (v4.4.2).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CLI_VERSION = "4.5.1";
const CLI = `@gltf-transform/cli@${CLI_VERSION}`;
const KTX_HOME = path.join(os.homedir(), ".local/ktx");

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error("usage: node scripts/build-strip.mjs public/models/Commercial_StripN.glb"); process.exit(2); }
const stem = path.basename(src).replace(/(_Lossless)?\.glb$/i, "");
const outDir = path.dirname(src);
const OUT_WEBP = path.join(outDir, `${stem}_opt.glb`);
const OUT_KTX2 = path.join(outDir, `${stem}_opt_ktx2.glb`);

// ---------------------------------------------------------------- gltf-transform API
const require = createRequire(import.meta.url);
const GT_ROOT = process.env.GLTF_TRANSFORM_PATH || (() => {
  const base = path.join(os.homedir(), ".npm/_npx");
  let best = null;
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const nm = path.join(base, d, "node_modules");
    const cli = path.join(nm, "@gltf-transform/cli/package.json");
    if (!fs.existsSync(cli) || !fs.existsSync(path.join(nm, "draco3dgltf"))) continue;
    const v = JSON.parse(fs.readFileSync(cli, "utf8")).version;
    if (v === CLI_VERSION) return nm;
    best = best || nm;
  }
  if (best) return best;
  throw new Error(`no @gltf-transform install in ${base}; run "npx --yes ${CLI} --help" once to fetch it`);
})();
const { NodeIO } = require(path.join(GT_ROOT, "@gltf-transform/core"));
const { ALL_EXTENSIONS } = require(path.join(GT_ROOT, "@gltf-transform/extensions"));
const { prune } = require(path.join(GT_ROOT, "@gltf-transform/functions"));
const draco3d = require(path.join(GT_ROOT, "draco3dgltf"));
const { MeshoptDecoder, MeshoptEncoder } = await import("meshoptimizer");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});

const log = (...a) => console.log(`[build-strip]`, ...a);
const S = fs.mkdtempSync(path.join(os.tmpdir(), "strip-build-"));
log("scratch", S);

// ---------------------------------------------------------------- 1. read + repair clips
log(`reading ${src} (${(fs.statSync(src).size / 1048576).toFixed(1)} MB)`);
const doc = await io.read(src);
const root = doc.getRoot();

function hasAncestor(node, name) {
  for (let p = node.getParentNode(); p; p = p.getParentNode()) if (p.getName() === name) return true;
  return false;
}
function isVarying(accessor) {
  const a = accessor.getArray(); const n = accessor.getElementSize(); const count = accessor.getCount();
  if (count < 2) return false;
  for (let c = 0; c < n; c++) {
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < count; k++) { const v = a[k * n + c]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx - mn > 1e-5) return true;
  }
  return false;
}
// A constant channel is dead weight ONLY if it repeats the node's own rest
// transform. Scene mode writes a bone's REST pose into the node and its POSED
// value into the track, so a character whose action never moves (Strip8's
// robot: 165 constant channels, 38 of them the seated pose) would spring back
// to bind pose if those tracks were dropped. Static props all matched rest.
function isRedundant(channel) {
  const s = channel.getSampler(); const out = s?.getOutput(); const node = channel.getTargetNode();
  if (!out || !node) return true;
  if (isVarying(out)) return false;
  const path = channel.getTargetPath(); const n = out.getElementSize(); const first = Array.from(out.getArray().slice(0, n));
  let rest;
  if (path === "translation") rest = node.getTranslation();
  else if (path === "rotation") rest = node.getRotation();
  else if (path === "scale") rest = node.getScale();
  else if (path === "weights") rest = node.getWeights()?.length ? node.getWeights() : node.getMesh()?.getWeights() || [];
  else return false;
  if (rest.length !== first.length) return false;
  const diff = (sign) => Math.max(...first.map((v, i) => Math.abs(v - sign * rest[i])));
  return Math.min(diff(1), path === "rotation" ? diff(-1) : Infinity) < 1e-4;
}
function clipDuration(anim) {
  let t = 0;
  for (const s of anim.listSamplers()) { const inp = s.getInput(); if (inp) t = Math.max(t, inp.getMax([0])[0]); }
  return t;
}
function describeClips(label) {
  log(`${label}:`, root.listAnimations().map((a) => `${a.getName()} (${a.listChannels().length} ch, ${clipDuration(a).toFixed(2)} s)`).join(" | ") || "(none)");
}

function normalizeClips() {
  const anims = root.listAnimations();
  if (anims.some((a) => a.getName() === "Claw_Demo")) { log("clips carry Claw_Demo — export used NLA Tracks, leaving animations as authored"); return; }
  if (!anims.length) { log("no animations in export"); return; }
  log(`!! no Claw_Demo clip — the export was saved in Blender's "Scene" animation mode. Repairing (set Animation Mode to "NLA Tracks" next export).`);
  const jointOwner = new Map();   // Node → "<Rig>_Sit"
  for (const skin of root.listSkins()) {
    const clip = skin.getName().replace(/_?Rig$/i, "").replace(/^$/, "Character") + "_Sit";
    for (const j of skin.listJoints()) jointOwner.set(j, clip);
  }
  const buckets = new Map();      // clip name → { channels, samplers }
  const bucket = (name) => { if (!buckets.has(name)) buckets.set(name, { channels: [], samplers: new Set() }); return buckets.get(name); };
  let dropped = 0;
  for (const anim of anims) {
    for (const ch of anim.listChannels()) {
      const s = ch.getSampler(); const node = ch.getTargetNode();
      if (isRedundant(ch)) { dropped++; anim.removeChannel(ch); ch.dispose(); continue; }
      let name;
      if (node.getName().startsWith("Claw") || hasAncestor(node, "Toy_Claw_Empty")) name = "Claw_Demo";
      else if (jointOwner.has(node)) name = jointOwner.get(node);
      else name = anim.getName() || "Animation";
      const b = bucket(name); b.channels.push(ch); b.samplers.add(s);
      anim.removeChannel(ch);
    }
    for (const s of anim.listSamplers()) anim.removeSampler(s);
  }
  // samplers whose channel was dropped are now orphans: dispose them
  const live = new Set([...buckets.values()].flatMap((b) => [...b.samplers]));
  for (const anim of anims) anim.dispose();
  for (const [name, b] of buckets) {
    const a = doc.createAnimation(name);
    for (const ch of b.channels) a.addChannel(ch);
    for (const s of b.samplers) a.addSampler(s);
  }
  log(`dropped ${dropped} channels that only repeated a node's rest transform; rebuilt ${buckets.size} clips`);
  void live;
}
describeClips("clips in export");
normalizeClips();
describeClips("clips after repair");

// ---------------------------------------------------------------- 1b. stray claw prizes
// clawMachine.mjs finds every claw part BY NAME UNDER Toy_Claw_Empty. Two exports
// in a row (Strip8_101226 on 2026-10-12, Strip8 on 2026-10-16) shipped Bear_01 at
// the scene root — Blender's Clear Parent + Keep Transform leaves the world pose
// identical but the test dies with "Claw part missing: Bear_01". Copying the old
// build's local TRS is WRONG (the mesh is 20× bigger than it used to be and a
// 3-unit bear fills the machine); keep the world pose instead:
//   local = inv(clawWorld) × prizeWorld
// Permanent fix is in Commercial_Strip7.blend: select the prize, then
// Toy_Claw_Empty, Ctrl+P → Object (Keep Transform). Until then this repairs it.
function reparentClawPrizes() {
  const THREE = require("three");
  const byName = (n) => root.listNodes().find((x) => x.getName() === n);
  const claw = byName("Toy_Claw_Empty");
  if (!claw) { log("!! no Toy_Claw_Empty node"); return; }
  const invClaw = new THREE.Matrix4().fromArray(claw.getWorldMatrix()).invert();
  for (const name of ["Unicorn_01", "Bear_01"]) {
    const prize = byName(name);
    if (!prize) { log(`!! claw prize ${name} missing from export`); continue; }
    if (hasAncestor(prize, "Toy_Claw_Empty")) continue;
    const local = new THREE.Matrix4().fromArray(prize.getWorldMatrix()).premultiply(invClaw);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    local.decompose(p, q, sc);
    prize.getParentNode()?.removeChild(prize);
    for (const scene of root.listScenes()) scene.removeChild(prize);
    claw.addChild(prize);
    prize.setTranslation(p.toArray()).setRotation(q.toArray()).setScale(sc.toArray());
    log(`!! ${name} was exported OUTSIDE Toy_Claw_Empty — reparented with its world pose kept (local t ${p.toArray().map((v) => v.toFixed(3)).join(",")} s ${sc.x.toFixed(4)}). Fix the parent in Blender.`);
  }
}
reparentClawPrizes();

// The optimize stages re-compress with meshopt; a Draco export must be written
// out plain first or every CLI stage would re-encode Draco on the way through.
for (const ext of root.listExtensionsUsed()) if (ext.extensionName === "KHR_draco_mesh_compression") { ext.dispose(); log("dropped Draco (optimize re-compresses with meshopt)"); }
await doc.transform(prune({ keepLeaves: true, keepAttributes: true, keepIndices: true, keepSolidTextures: true }));
const BASE = path.join(S, "base.glb");
await io.write(BASE, doc);
log(`plain base written (${(fs.statSync(BASE).size / 1048576).toFixed(1)} MB)`);

// ---------------------------------------------------------------- 2 + 3. CLI stages (docs/strip-export.md)
const NO_COLLAPSE = ["--instance", "false", "--simplify", "false", "--flatten", "false", "--join", "false",
  "--palette", "false", "--prune-solid-textures", "false", "--prune-attributes", "false"];
function cli(label, args, env = {}) {
  const t0 = Date.now();
  log(`${label}: gltf-transform ${args.slice(0, 1).join(" ")} …`);
  try {
    const out = execFileSync("npx", ["--yes", CLI, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env }, maxBuffer: 64 << 20 });
    const tail = out.trim().split("\n").filter((l) => /\b(MB|KB|textures?|nodes?|meshes?|warn|error)\b/i.test(l)).slice(-2).join(" / ");
    log(`${label}: done in ${((Date.now() - t0) / 1000).toFixed(0)} s${tail ? " — " + tail.replace(/\s+/g, " ").slice(0, 160) : ""}`);
  } catch (e) {
    console.error(`[build-strip] ${label} FAILED\n${(e.stderr || e.stdout || e.message).toString().slice(-3000)}`);
    process.exit(1);
  }
}
const W = path.join(S, "webp.glb"), K = path.join(S, "ktx2.glb");
cli("webp optimize", ["optimize", BASE, W, ...NO_COLLAPSE, "--texture-compress", "webp", "--texture-size", "2048"]);
cli("ktx2 a (geometry)", ["optimize", BASE, `${S}/a.glb`, ...NO_COLLAPSE, "--compress", "false", "--texture-compress", "false", "--texture-size", "2048"]);
cli("ktx2 b (png)", ["png", `${S}/a.glb`, `${S}/b.glb`, "--formats", "*"]);
cli("ktx2 c (atlas 2k)", ["resize", `${S}/b.glb`, `${S}/c.glb`, "--pattern", "BOARDWALK_ATLAS*", "--width", "2048", "--height", "2048"]);
cli("ktx2 d (etc1s)", ["etc1s", `${S}/c.glb`, `${S}/d.glb`], { PATH: `${KTX_HOME}/bin:${process.env.PATH}`, DYLD_LIBRARY_PATH: `${KTX_HOME}/lib` });
cli("ktx2 e (webp leftovers)", ["webp", `${S}/d.glb`, `${S}/e.glb`]);
cli("ktx2 f (meshopt)", ["meshopt", `${S}/e.glb`, K]);

// ---------------------------------------------------------------- verify, then publish
const rd = (p) => { const b = fs.readFileSync(p); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString()); };
const a = rd(W), k = rd(K);
const names = (g) => g.nodes.map((x) => x.name || "");
const CRIT = ["Boardwalk", "Steps", "Step1", "SM_Prop_Mechanical_Bull_01_Saddle_01", "Photo_booth_Curtain", "FortuneTeller_Wagon_Empty", "Bull_Tent", "Toy_Claw_Empty"];
const problems = [];
for (const [label, g] of [["webp", a], ["ktx2", k]]) {
  const n = names(g);
  for (const c of CRIT) if (!n.includes(c)) problems.push(`${label}: missing node ${c}`);
  const bulbs = n.filter((x) => /^Spotlight_Bulb/.test(x)).length;
  if (bulbs !== 14) problems.push(`${label}: ${bulbs} Spotlight_Bulb nodes (want 14)`);
  const clips = (g.animations || []).map((x) => x.name);
  if (!clips.includes("Claw_Demo")) problems.push(`${label}: no Claw_Demo clip (${clips.join(",") || "none"})`);
  for (const sk of (g.skins || [])) if (!sk.inverseBindMatrices && sk.inverseBindMatrices !== 0) problems.push(`${label}: skin ${sk.name} lost its inverseBindMatrices`);
}
// Not fatal, but loud: Boolean cutter objects export as visible grey solids
// (Strip8's photo-board cutter sat in its own hole). CommercialStrip hides
// anything named *Cutter; the fix is hiding the object in Blender.
const cutters = names(a).filter((x) => /cutter$/i.test(x));
if (cutters.length) log(`!! export contains Boolean cutter objects (hidden at runtime, hide them in Blender): ${cutters.join(", ")}`);
const named = (g) => names(g).filter(Boolean).sort().join("|");
if (named(a) !== named(k)) problems.push("named node lists differ between webp and ktx2 builds");
const basis = k.textures.filter((t) => t.extensions?.KHR_texture_basisu).length;
if (basis !== k.textures.length) problems.push(`ktx2: ${basis}/${k.textures.length} textures are Basis (want all)`);
log(`webp  ${(fs.statSync(W).size / 1048576).toFixed(2)} MB — nodes ${a.nodes.length}, meshes ${a.meshes.length}, textures ${a.textures.length}, clips ${(a.animations || []).map((x) => x.name).join(",")}`);
log(`ktx2  ${(fs.statSync(K).size / 1048576).toFixed(2)} MB — nodes ${k.nodes.length}, meshes ${k.meshes.length}, textures ${k.textures.length} (basis ${basis}), skins ${(k.skins || []).length}`);
if (problems.length) { console.error("[build-strip] NOT publishing — checks failed:\n  " + problems.join("\n  ") + `\n  intermediates kept in ${S}`); process.exit(1); }
fs.copyFileSync(W, OUT_WEBP); fs.copyFileSync(K, OUT_KTX2);
log(`wrote ${OUT_WEBP}`); log(`wrote ${OUT_KTX2}`);
log(`next: bump STRIP_MODEL_V in src/components/CommercialStrip.jsx and point STRIP_MODEL_WEBP/KTX2 at ${stem}; then node scripts/test-claw-machine.mjs`);
fs.rmSync(S, { recursive: true, force: true });
