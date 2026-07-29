// PRE-FLIGHT FOR RE-EXPORTING THE TEMPLE MODEL.
//
// Run: node scripts/verify-temple-names.mjs [path/to/model.glb]
//
// WHY THIS EXISTS. CyborgTempleScene binds a large amount of behaviour to EXACT
// NODE NAMES — the four monitor canvases, the SitePal face projection targets,
// the character armatures, the stage props. glTF has no notion of these being
// load-bearing, and GLTFLoader silently suffixes duplicate names (`Root_1` ->
// `Root_1.001`). So a re-export that introduces a node called `Armature` or
// `Root` can RENAME THE EXISTING ONE and every lookup that depended on it
// returns undefined — with no error, at runtime, on one character.
//
// The scene already carries the scars: line ~2454 tries `Armature_001` OR
// `Armature.001`, and ~2524 tries `Root_1` OR `Root_1.001` OR
// `Armature_Unicorn`. Those fallback chains are what this check exists to stop
// you needing more of.
//
// Adding Virgil (fluffyCat) to the desk is exactly the operation that can
// trigger it: a cat rig arrives with its own armature and root.
// Rename his to something unique — Virgil_Armature, Virgil_Root — before export.

import fs from "node:fs";
import path from "node:path";

const MODEL = process.argv[2] || "public/models/RL80_4anims_v94_opt.glb";

// Every name the scene looks up by string. A nested array means the scene
// accepts ANY ONE of them — those OR-chains in CyborgTempleScene are the scar
// tissue from previous re-exports, so the check has to model them faithfully or
// it cries wolf. (RL80_Empty is genuinely absent today; Unicorn_Empty covers it.)
const REQUIRED = {
  "monitor canvases (VideoScreens + the evidence boards)": [
    "Screen1", "Screen2", "Screen3", "Screen4",
  ],
  "SitePal face projection targets": ["Face1", "Face2"],
  "stage + props": ["StageProps", "SmartPhone"],
  "character mounts": [
    "Monk_empty",
    ["RL80_Empty", "Unicorn_Empty"],
    ["Armature_001", "Armature.001"],
  ],
};

// Nodes that are not load-bearing but whose ABSENCE would be a silent failure:
// you export, the mesh didn't come through or got renamed, and the only symptom
// is a cat that isn't there. Reported, never fatal.
const EXPECTED_SOON = {
  "Virgil (the desk cat)": ["Virgil"],
};

// Names used only by FALLBACK paths. Their absence is not a failure — the
// primary lookup covers it today (verified: no "head bone not found" warning in
// the console). But a dormant safety net is worth reporting, because if the
// primary path ever regresses this is what was supposed to catch it and won't.
const FALLBACK_ONLY = {
  "unicorn armature (only consulted if head-bone harvest finds nothing)":
    [["Root_1", "Root_1.001", "Armature_Unicorn"]],
};

// If any of these appear, a name collision already happened on export.
const COLLISION_MARKERS = /(\.\d{3}|_\d{3})$/;

function readNodeNames(file) {
  const buf = fs.readFileSync(file);
  if (buf.slice(0, 4).toString() !== "glTF") {
    throw new Error(`${file} is not a binary glTF`);
  }
  // GLB: 12-byte header, then chunks. Chunk 0 is the JSON scene description.
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  return (json.nodes || []).map((n) => n.name).filter(Boolean);
}

if (!fs.existsSync(MODEL)) {
  console.error(`\n  model not found: ${MODEL}\n`);
  process.exit(2);
}

const names = readNodeNames(MODEL);
const seen = new Map();
for (const n of names) seen.set(n, (seen.get(n) || 0) + 1);

console.log(`\n  ${path.basename(MODEL)} — ${names.length} nodes\n`);

let fail = 0;
for (const [group, list] of Object.entries(REQUIRED)) {
  console.log(`  ${group}`);
  for (const want of list) {
    if (Array.isArray(want)) {
      const hit = want.find((w) => (seen.get(w) || 0) >= 1);
      if (hit) console.log(`    ok    ${hit}   (any of: ${want.join(" | ")})`);
      else { fail++; console.log(`    GONE  none of ${want.join(" | ")}   <-- the whole OR-chain misses`); }
      continue;
    }
    const n = seen.get(want) || 0;
    if (n === 1) console.log(`    ok    ${want}`);
    else if (n === 0) { fail++; console.log(`    GONE  ${want}   <-- a lookup will return undefined`); }
    else { fail++; console.log(`    DUPE  ${want} x${n}   <-- loader will suffix one of them`); }
  }
  console.log("");
}

for (const [group, list] of Object.entries(EXPECTED_SOON)) {
  for (const want of list) {
    const n = seen.get(want) || 0;
    console.log(n >= 1
      ? `  ok    ${group} — "${want}" is in the model\n`
      : `  note  ${group} — no node named "${want}" yet\n`);
  }
}

for (const [group, list] of Object.entries(FALLBACK_ONLY)) {
  for (const want of list) {
    const hit = want.find((w) => (seen.get(w) || 0) >= 1);
    if (!hit) {
      console.log(`  note  ${group}`);
      console.log(`        none of ${want.join(" | ")} is present — the fallback is dormant,`);
      console.log(`        which is fine while the primary path works, and silent if it stops.\n`);
    }
  }
}

const suffixed = names.filter((n) => COLLISION_MARKERS.test(n));
if (suffixed.length) {
  console.log(`  ${suffixed.length} node(s) carry a collision suffix.`);
  console.log(`  BASELINE BEFORE ADDING VIRGIL: 58. If this number GREW, the export`);
  console.log(`  renamed something — diff the list against the previous run.`);
  for (const n of suffixed.slice(0, 20)) console.log(`    ${n}`);
  if (suffixed.length > 20) console.log(`    …and ${suffixed.length - 20} more`);
  console.log("  (not automatically a bug — but if one of these is a name the");
  console.log("   scene looks up, that lookup is already silently failing.)\n");
}

console.log(fail === 0
  ? "  PASS — every name the scene binds to is present exactly once.\n"
  : `  FAIL — ${fail} name(s) the scene depends on are missing or duplicated.\n`);
process.exit(fail === 0 ? 0 : 1);
