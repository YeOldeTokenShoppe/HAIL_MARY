#!/usr/bin/env node
// CHECK A BLENDER EXPORT AGAINST WHAT THE SET ACTUALLY NEEDS.
//
//   npm run lt:models
//
// The characters and the set ship as separate GLBs, and the code finds
// everything inside them by name. Nothing verifies that at load time: a renamed
// armature, a face mesh that did not come across, or an action left behind in
// the set produces a character who loads, stands in its bind pose and never
// moves — no error, nothing in the console, and it only shows up when you watch
// an episode. This turns that into an answer you can read before uploading a
// single clip.
//
// It reads the GLB container directly (the JSON chunk is the whole manifest),
// so it needs no THREE, no browser and no network. src/lib/ltTv/modelContract.mjs
// is what it checks against.

import fs from "node:fs";
import { resolve } from "node:path";
import {
  SET_MODEL,
  CHARACTERS,
  requiredClips,
  optionalClips,
} from "../src/lib/ltTv/modelContract.mjs";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;

/** The glTF manifest out of a .glb, or null when the file isn't there. */
export function readGlb(path) {
  if (!fs.existsSync(path)) return null;
  const buf = fs.readFileSync(path);
  if (buf.length < 12 || buf.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error(`${path} is not a .glb (bad magic) — was it saved as .gltf?`);
  }
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    if (type === CHUNK_JSON) {
      return JSON.parse(buf.slice(offset + 8, offset + 8 + length).toString("utf8"));
    }
    offset += 8 + length;
  }
  throw new Error(`${path} has no JSON chunk`);
}

export const nodeNames = (gltf) => new Set((gltf.nodes || []).map((n) => n.name).filter(Boolean));
export const clipNames = (gltf) => (gltf.animations || []).map((a) => a.name).filter(Boolean);

/** The node by name, or null. */
export const nodeByName = (gltf, name) => (gltf.nodes || []).find((n) => n.name === name) || null;

/**
 * Is there an armature under this node? Name-agnostic, matching findRig: the
 * armature is the node whose own children are bones, and glTF marks a bone by
 * its membership in a skin's joint list.
 */
export function hasRig(gltf, emptyName) {
  const nodes = gltf.nodes || [];
  const joints = new Set((gltf.skins || []).flatMap((s) => s.joints || []));
  const start = nodes.findIndex((n) => n.name === emptyName);
  if (start < 0) return { found: false, name: null };
  let result = { found: false, name: null };
  const walk = (index) => {
    if (result.found) return;
    const node = nodes[index];
    if (!node) return;
    if ((node.children || []).some((child) => joints.has(child))) {
      result = { found: true, name: node.name || "(unnamed)" };
      return;
    }
    (node.children || []).forEach(walk);
  };
  walk(start);
  return result;
}

/**
 * A clip's length in seconds, read off its time inputs.
 *
 * Reported because a new clip's duration is a fact the code needs and nobody
 * can see from the outside: the reaction director plays only part of a clip and
 * needs to know how long the whole thing is, and "is this a 4-second gesture or
 * a 20-second hold" decides how a clip is used at all.
 */
export function clipDuration(gltf, name) {
  const animation = (gltf.animations || []).find((a) => a.name === name);
  if (!animation) return null;
  let end = 0;
  for (const sampler of animation.samplers || []) {
    const accessor = (gltf.accessors || [])[sampler.input];
    const max = accessor?.max?.[0];
    if (typeof max === "number") end = Math.max(end, max);
  }
  return end || null;
}

/** Distance between an exported position and where the seat was authored. */
export function seatDrift(node, seat) {
  const at = node.translation || [0, 0, 0];
  const want = seat?.position;
  if (!want) return null;
  const d = Math.hypot(at[0] - want[0], at[1] - want[1], at[2] - want[2]);
  return { at, want, distance: d, atOrigin: Math.hypot(...at) < 1e-6 };
}

const problems = [];
const warnings = [];
const say = (line = "") => console.log(line);

function checkCharacter(actor, character) {
  say(`\n${actor} — ${character.file}`);
  const gltf = readGlb(resolve(character.file));
  if (!gltf) {
    problems.push(`${actor}: ${character.file} is not in the repo`);
    say(`  ✗ not in the repo. Exported but not committed, or a different name.`);
    return;
  }

  const names = nodeNames(gltf);
  const clips = clipNames(gltf);

  if (names.has(character.empty)) {
    say(`  ✓ ${character.empty}`);
  } else {
    problems.push(`${actor}: no node named "${character.empty}"`);
    say(`  ✗ no "${character.empty}" — the code places and animates the character through it`);
  }

  const rig = hasRig(gltf, character.empty);
  if (rig.found) {
    const note = rig.name === character.rig ? "" : ` (named "${rig.name}", not "${character.rig}" — fine, findRig falls back)`;
    say(`  ✓ armature under the empty${note}`);
  } else if (names.has(character.empty)) {
    problems.push(`${actor}: no armature under ${character.empty}`);
    say(`  ✗ no armature under ${character.empty} — nothing to animate`);
  }

  const required = requiredClips(character);
  const missing = required.filter((name) => !clips.includes(name));
  if (missing.length === 0) {
    say(`  ✓ all ${required.length} required clips`);
  } else {
    problems.push(`${actor}: missing ${missing.length} clip(s): ${missing.join(", ")}`);
    say(`  ✗ missing ${missing.length} of ${required.length} clips: ${missing.join(", ")}`);
    say(`      a missing base clip is a character who never moves; a missing`);
    say(`      reaction no-ops the cues that name it`);
  }

  const secs = (name) => {
    const d = clipDuration(gltf, name);
    return d ? ` — ${d.toFixed(2)}s` : "";
  };

  for (const name of optionalClips(character)) {
    say(
      clips.includes(name)
        ? `  ✓ ${name} (optional)${secs(name)}`
        : `  · ${name} not in this export — optional, nothing breaks`,
    );
  }

  const extra = clips.filter((name) => !required.includes(name) && !optionalClips(character).includes(name));
  if (extra.length) {
    say(`  · also carries ${extra.length} clip(s) the code does not use yet:`);
    extra.forEach((name) => say(`      ${name}${secs(name)}`));
  }

  const faces = character.faces || {};
  for (const [label, name] of [["face1", faces.face1], ["face2", faces.face2]]) {
    if (!name) continue;
    if (names.has(name)) say(`  ✓ ${name}`);
    else {
      problems.push(`${actor}: no "${name}" mesh (${label})`);
      say(`  ✗ no "${name}" — the SitePal face has nothing to paint onto`);
    }
  }
  for (const name of faces.hide || []) {
    if (names.has(name)) say(`  ✓ ${name}`);
    else warnings.push(`${actor}: no "${name}" to hide behind the projected face`);
  }

  const node = nodeByName(gltf, character.empty);
  if (node) {
    for (const [set, seat] of Object.entries(character.seat || {})) {
      const drift = seatDrift(node, seat);
      if (!drift) continue;
      if (drift.atOrigin) {
        warnings.push(
          `${actor}: exported at the origin — its transform was probably applied. ` +
            `The ${set} seat then has to be pinned in SEAT_POSES.`,
        );
        say(`  ! at the origin, so the authored ${set} seat is gone (pin it in SEAT_POSES)`);
        break;
      }
      const near = drift.distance < 0.02;
      say(
        `  ${near ? "✓" : "·"} ${set} seat ${near ? "matches" : "differs by"} ` +
          `${near ? "" : `${drift.distance.toFixed(3)} `}` +
          `(at ${drift.at.map((v) => v.toFixed(3)).join(", ")})`,
      );
    }
  }
}

/**
 * Which candidate file is actually the set: the first one that carries the
 * props. Before the split that is the old combined file; after it, the new
 * export. Returns what it looked at either way, so a missing set is reported
 * as a missing set rather than as a set full of holes.
 */
export function resolveSet(candidates = SET_MODEL.candidates) {
  const seen = [];
  for (const file of candidates) {
    const gltf = readGlb(resolve(file));
    if (!gltf) {
      seen.push({ file, present: false, isSet: false });
      continue;
    }
    const names = nodeNames(gltf);
    const isSet = SET_MODEL.requires.every((name) => names.has(name));
    seen.push({ file, present: true, isSet, gltf });
    if (isSet) return { file, gltf, seen };
  }
  const present = seen.find((c) => c.present);
  return { file: present?.file ?? candidates[0], gltf: present?.gltf ?? null, seen };
}

function checkSet() {
  const resolved = resolveSet();
  say(`\nThe set — ${resolved.file}`);
  const gltf = resolved.gltf;
  if (!gltf) {
    problems.push(`no set file found (looked for ${SET_MODEL.candidates.join(", ")})`);
    say(`  ✗ none of the candidates is in the repo: ${SET_MODEL.candidates.join(", ")}`);
    return;
  }
  const others = resolved.seen.filter((c) => c.isSet && c.file !== resolved.file);
  if (others.length) {
    warnings.push(
      `more than one file looks like the set (${[resolved.file, ...others.map((o) => o.file)].join(", ")}) — ` +
        "the code loads one, so retire the other",
    );
  }
  const names = nodeNames(gltf);
  const clips = clipNames(gltf);

  const missing = SET_MODEL.requires.filter((name) => !names.has(name));
  if (missing.length === 0) say(`  ✓ all ${SET_MODEL.requires.length} required props`);
  else {
    problems.push(`the set is missing: ${missing.join(", ")}`);
    say(`  ✗ missing: ${missing.join(", ")}`);
  }

  const stowaways = SET_MODEL.forbids.filter((name) => names.has(name));
  say(`  · ${clips.length === 0 && stowaways.length === 0 ? "post-split set" : "pre-split set"}`);
  if (stowaways.length === 0) {
    say(`  ✓ no characters in the set`);
  } else {
    // Not a hard failure while the characters still ship inside the set — it
    // is how the set works TODAY. It becomes one the moment their own files
    // exist, because then they are in two places at once.
    const shipped = Object.values(CHARACTERS).filter((c) => fs.existsSync(resolve(c.file)));
    const line = `the set still contains ${stowaways.join(", ")}`;
    if (shipped.length) {
      problems.push(`${line} — and their own files exist, so they load twice`);
      say(`  ✗ ${line}, and their own files exist: they would be drawn twice`);
    } else {
      say(`  · ${line} — expected until the character files land`);
    }
  }

  if (SET_MODEL.expectsNoAnimations) {
    if (clips.length === 0) say(`  ✓ no animations left in the set`);
    else say(`  · still carries ${clips.length} clip(s) — they belong with the characters`);
  }
}

// Imported by the test for its helpers; only reports when run as a command.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("lt-tv-models.mjs");
if (!invokedDirectly) {
  // Nothing to do on import.
} else {
  run();
}

function run() {
say("LT TV models — checking each export against what the code needs");
checkSet();
for (const [actor, character] of Object.entries(CHARACTERS)) checkCharacter(actor, character);

if (warnings.length) {
  say(`\nWorth a look:`);
  warnings.forEach((w) => say(`  ! ${w}`));
}

if (problems.length) {
  say(`\n${problems.length} problem(s) that would show up on air:`);
  problems.forEach((p) => say(`  ✗ ${p}`));
  say("");
  process.exit(1);
}

say(`\nModels OK — every export carries what the set asks for.\n`);
}
