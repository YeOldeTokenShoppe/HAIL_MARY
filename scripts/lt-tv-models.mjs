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
const CHUNK_BIN = 0x004e4942;

/** The glTF manifest out of a .glb, or null when the file isn't there. */
export function readGlb(path) {
  if (!fs.existsSync(path)) return null;
  const buf = fs.readFileSync(path);
  if (buf.length < 12 || buf.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error(`${path} is not a .glb (bad magic) — was it saved as .gltf?`);
  }
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const chunk = buf.slice(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) json = JSON.parse(chunk.toString("utf8"));
    if (type === CHUNK_BIN) bin = chunk;
    offset += 8 + length;
  }
  if (!json) throw new Error(`${path} has no JSON chunk`);
  // The manifest answers almost everything, but keyframe VALUES live in the
  // binary chunk, and `loopGap` needs them. Hung off the manifest rather than
  // returned beside it so every existing caller keeps working, and
  // non-enumerable so it never turns up in a dump of the manifest.
  Object.defineProperty(json, "bin", { value: bin, enumerable: false });
  return json;
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

/**
 * WHICH BONES A CLIP ACTUALLY ANIMATES.
 *
 * A clip's name and its duration both look fine on a clip that animates
 * nothing. The news co-anchor's first export shipped a `hologirl_sitting` that
 * carried three channels — her empty's own translation, rotation and scale —
 * and not one bone, where her gesture clips carry 168 each. As a base idle that
 * plays as her rest pose for the whole episode: the exact silent bind-pose
 * failure this file exists to catch, arrived at from the other direction.
 *
 * Worse than useless, in fact: the mixer is rooted at the ARMATURE, and the
 * empty is the armature's parent rather than its descendant, so those three
 * tracks cannot even resolve. Nothing plays and nothing is logged.
 */
export function clipTargets(gltf, name) {
  const animation = (gltf.animations || []).find((a) => a.name === name);
  if (!animation) return null;
  const joints = new Set((gltf.skins || []).flatMap((s) => s.joints || []));
  const nodes = new Set();
  let bones = 0;
  for (const channel of animation.channels || []) {
    const index = channel.target?.node;
    if (index === undefined) continue;
    if (!nodes.has(index) && joints.has(index)) bones += 1;
    nodes.add(index);
  }
  return {
    channels: (animation.channels || []).length,
    nodes: nodes.size,
    bones,
    names: [...nodes].map((i) => (gltf.nodes || [])[i]?.name).filter(Boolean),
  };
}

/**
 * HOW FAR A CLIP MOVES BETWEEN ITS LAST FRAME AND ITS FIRST.
 *
 * Two clips per character play on LOOP — the base idle, which runs for the
 * whole episode, and the news intermission. THREE wraps a `LoopRepeat` action
 * hard: at the end of the cycle it jumps back to time zero. So any gap between
 * the last keyframe and the first is a snap the viewer sees, once per cycle,
 * forever.
 *
 * Reported as the real ANGLE between the two orientations. A quaternion
 * component delta is not a rotation and reads far smaller than the thing it
 * describes — the co-anchor's idle showed 0.05 on one component, which is
 * 7.24° at her shoulder.
 *
 * Returns null when the clip is absent or the file carries no binary chunk.
 */
const NUMBER_READER = { 5126: ["getFloat32", 4], 5123: ["getUint16", 2], 5125: ["getUint32", 4] };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function accessorRows(gltf, index) {
  const accessor = (gltf.accessors || [])[index];
  const view = (gltf.bufferViews || [])[accessor?.bufferView];
  const reader = NUMBER_READER[accessor?.componentType];
  const width = COMPONENTS[accessor?.type];
  if (!accessor || !view || !reader || !width || !gltf.bin) return null;
  const [fn, size] = reader;
  const dv = new DataView(
    gltf.bin.buffer,
    gltf.bin.byteOffset + (view.byteOffset || 0) + (accessor.byteOffset || 0),
  );
  const rows = [];
  for (let i = 0; i < accessor.count; i += 1) {
    const row = [];
    for (let c = 0; c < width; c += 1) row.push(dv[fn](i * width * size + c * size, true));
    rows.push(row);
  }
  return rows;
}

export function loopGap(gltf, name) {
  const animation = (gltf.animations || []).find((a) => a.name === name);
  if (!animation || !gltf.bin) return null;
  let worst = { degrees: 0, node: null };
  let metres = 0;
  for (const channel of animation.channels || []) {
    const sampler = (animation.samplers || [])[channel.sampler];
    const rows = sampler ? accessorRows(gltf, sampler.output) : null;
    if (!rows || rows.length < 2) continue;
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (channel.target?.path === "rotation") {
      const dot = Math.abs(first.reduce((sum, x, i) => sum + x * last[i], 0));
      const degrees = (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
      if (degrees > worst.degrees) {
        worst = { degrees, node: (gltf.nodes || [])[channel.target.node]?.name || null };
      }
    } else if (channel.target?.path === "translation") {
      metres = Math.max(metres, Math.hypot(...first.map((x, i) => x - last[i])));
    }
  }
  return { ...worst, metres };
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

  /* A CLIP THAT PLAYS ON LOOP MUST END WHERE IT STARTS.
   *
   * THREE wraps a repeating action hard — at the end of the cycle it jumps to
   * time zero — so a gap between the last frame and the first is a snap the
   * viewer sees every cycle. A warning rather than a failure: the character
   * plays, and whether a few degrees reads on screen depends on the shot and
   * on what the desk hides, which is a judgement for the person watching.
   *
   * The threshold is set from the clips already on air. Connor's idle closes
   * to 0.06° and GR80's to 0.05°, so anything past 1° is a deliberate gap
   * rather than export noise. The co-anchor's first good idle came in at
   * 7.24° on her shoulder, which is what this exists to have caught.
   */
  const checkLoop = (name, why) => {
    const gap = loopGap(gltf, name);
    if (!gap || gap.degrees <= 1) return;
    warnings.push(
      `${actor}: "${name}" ends ${gap.degrees.toFixed(2)}° away from where it starts ` +
        `(${gap.node}), and ${why}. THREE jumps straight back to the first frame, so that ` +
        `is a visible snap once per cycle. Fix in Blender by copying the first frame's keys ` +
        `onto the last.`,
    );
    say(`  ! it ends ${gap.degrees.toFixed(2)}° from where it starts (${gap.node}) — snaps on loop`);
  };

  // The base idle is the one clip that plays for the whole episode, so a base
  // that animates no bones is a character who never moves at all.
  const baseTargets = clipTargets(gltf, character.base);
  if (baseTargets) {
    if (baseTargets.bones === 0) {
      problems.push(
        `${actor}: "${character.base}" animates NO BONES (${baseTargets.channels} channels on ` +
          `${baseTargets.names.join(", ")}). As the base idle that plays as the rig's rest pose ` +
          `for the whole episode. Re-export the action off the armature.`,
      );
      say(`  ✗ "${character.base}" animates no bones — only ${baseTargets.names.join(", ")}`);
      say(`      It is the base idle, so this is the character standing in their`);
      say(`      rest pose for the whole episode. Re-export it off the ARMATURE.`);
    } else {
      say(`  ✓ "${character.base}" animates ${baseTargets.bones} bones${secs(character.base)}`);
      // A base of one or two keyframes holds a pose rather than breathing.
      const d = clipDuration(gltf, character.base);
      if (d !== null && d < 1) {
        warnings.push(
          `${actor}: "${character.base}" is only ${d.toFixed(2)}s, so it holds a pose rather ` +
            `than breathing. The others' idles are ~5.4s loops, and a still character beside ` +
            `moving ones reads as a fault.`,
        );
        say(`  ! and only ${d.toFixed(2)}s, so it holds a pose rather than breathing`);
      }
      checkLoop(character.base, "the base idle, so this repeats all episode");
    }
  }

  for (const name of optionalClips(character)) {
    if (!clips.includes(name)) {
      say(`  · ${name} not in this export — optional, nothing breaks`);
      continue;
    }
    say(`  ✓ ${name} (optional)${secs(name)}`);
    checkLoop(name, "it loops as the news set's resting state");
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

/**
 * NAME COLLISIONS BETWEEN FILES.
 *
 * Blender only disambiguates names that collide inside ONE file, so two
 * characters exported on their own can both arrive carrying "Armature",
 * "Face1" and the same 33 mixamorig bones. The scene attaches every character
 * into the set, which means one namespace at runtime.
 *
 * Per-character lookups are scoped to that character's empty, so a collision
 * BETWEEN CHARACTERS is survivable — that is what the scoping is for, and it
 * is reported rather than failed. Two things are not survivable:
 *
 *  - a character sharing a name with the SET, because the set's own lookups
 *    (props, the screen, the lamp heads) are scene-wide and would find the
 *    character's node instead;
 *  - two characters sharing an EMPTY name, because the empty is what every
 *    scoped lookup starts from, so there would be nothing to scope by.
 */
export function collisions(setGltf, characters) {
  const loaded = characters
    .map(([actor, c]) => ({ actor, c, gltf: readGlb(resolve(c.file)) }))
    .filter((x) => x.gltf);
  const setNames = setGltf ? nodeNames(setGltf) : new Set();
  const out = { withSet: [], betweenCharacters: [], sharedEmpties: [] };

  for (const { actor, gltf } of loaded) {
    const shared = [...nodeNames(gltf)].filter((n) => setNames.has(n));
    if (shared.length) out.withSet.push({ actor, names: shared });
  }
  for (let i = 0; i < loaded.length; i++) {
    for (let j = i + 1; j < loaded.length; j++) {
      const a = loaded[i];
      const b = loaded[j];
      const bNames = nodeNames(b.gltf);
      const shared = [...nodeNames(a.gltf)].filter((n) => bNames.has(n));
      if (!shared.length) continue;
      // The bones are expected to match and say nothing interesting.
      const looked = shared.filter((n) => !n.startsWith("mixamorig:"));
      out.betweenCharacters.push({ pair: [a.actor, b.actor], bones: shared.length - looked.length, looked });
      if (a.c.empty === b.c.empty) out.sharedEmpties.push([a.actor, b.actor, a.c.empty]);
    }
  }
  return out;
}

function checkCollisions() {
  const setGltf = resolveSet().gltf;
  const entries = Object.entries(CHARACTERS);
  const c = collisions(setGltf, entries);
  say(`\nNames across the files (they all share one namespace at runtime)`);

  if (c.withSet.length === 0) {
    say(`  ✓ no character shares a name with the set`);
  } else {
    for (const { actor, names } of c.withSet) {
      problems.push(
        `${actor} shares ${names.length} name(s) with the set: ${names.slice(0, 6).join(", ")}` +
          `${names.length > 6 ? ", …" : ""}. The set resolves its own props scene-wide, so it would find the character's node.`,
      );
      say(`  ✗ ${actor} shares a name with the set: ${names.slice(0, 6).join(", ")}`);
    }
  }

  for (const { pair, bones, looked } of c.betweenCharacters) {
    if (looked.length) {
      say(`  · ${pair.join(" and ")} share ${looked.join(", ")} — fine, per-character lookups are scoped to the empty`);
    }
    if (bones) say(`  · ${pair.join(" and ")} share ${bones} bone names — expected, same rig`);
  }

  for (const [a, b, empty] of c.sharedEmpties) {
    problems.push(`${a} and ${b} both use the empty "${empty}" — there is nothing left to tell them apart`);
    say(`  ✗ ${a} and ${b} both use "${empty}"`);
  }
}

/**
 * INSPECT A FILE THAT IS NOT IN THE CONTRACT YET.
 *
 *   npm run lt:models -- public/models/LTTV_Whoever.glb
 *
 * A new character's contract entry is a set of names that have to match the
 * file exactly, and guessing one costs a silent bind-pose character. This
 * prints what the file actually contains, in the shape the entry wants, so
 * filling it in is copying rather than guessing.
 */
function inspect(file) {
  const path = resolve(file.startsWith("public/") ? file : `public/models/${file.replace(/^\/?(models\/)?/, "")}`);
  say(`Inspecting ${path.replace(`${process.cwd()}/`, "")}\n`);
  const gltf = readGlb(path);
  if (!gltf) {
    say(`  Not there. Exported but not committed, or a different name.`);
    // public/models holds hundreds of files from the rest of the site, so
    // listing it whole buries the answer. Show the LT TV ones and anything
    // whose name is close to what was asked for, which is what a typo or a
    // rename looks like.
    const want = path.split("/").pop().replace(/\.glb$/i, "").toLowerCase();
    const all = fs.readdirSync(resolve("public/models")).filter((f) => f.endsWith(".glb"));
    const near = all.filter(
      (f) => /^LTTV_/i.test(f) || f.toLowerCase().includes(want.slice(0, 5)) || want.includes(f.replace(/\.glb$/i, "").toLowerCase()),
    );
    say(`  The LT TV files that ARE here${near.length ? ":" : ", of which there are none:"}`);
    near.forEach((f) => say(`    ${f}`));
    say(`  (${all.length} .glb files in public/models in total)`);
    process.exit(1);
  }

  const nodes = gltf.nodes || [];
  const roots = (gltf.scenes?.[0]?.nodes || []).map((i) => nodes[i]);
  say(`Scene roots (a character should have exactly one, their empty):`);
  roots.forEach((n) => {
    const t = n.translation || [0, 0, 0];
    const q = n.rotation || [0, 0, 0, 1];
    const sc = n.scale || [1, 1, 1];
    say(`  "${n.name}"`);
    say(`      position: [${t.map((v) => +v.toFixed(5)).join(", ")}]`);
    say(`      quaternion: [${q.map((v) => +v.toFixed(5)).join(", ")}]`);
    say(`      scale: ${+sc[0].toFixed(5)}`);
  });
  if (roots.length !== 1) {
    say(`  ! ${roots.length} roots. The scene attaches the whole file, so extra`);
    say(`    roots come along too — usually a prop that wants its own file.`);
  }

  const rig = roots[0] ? hasRig(gltf, roots[0].name) : { found: false };
  say(`\nArmature: ${rig.found ? `"${rig.name}"` : "NONE FOUND — nothing to animate"}`);
  if (rig.found && rig.name.includes(".")) {
    say(`  (GLTFLoader will call it "${rig.name.replace(/\./g, "")}" at load — use that in the contract)`);
  }

  const clips = clipNames(gltf);
  say(`\nAnimations (${clips.length}):`);
  clips.forEach((n) => {
    const d = clipDuration(gltf, n);
    say(`  ${n}${d ? ` — ${d.toFixed(2)}s` : ""}`);
  });

  const faces = [...nodeNames(gltf)].filter((n) => /face|brow|eye|hair/i.test(n));
  say(`\nMeshes that look like faces (which is face1/face2/hide is yours to say):`);
  faces.forEach((n) => say(`  ${n}`));

  const setGltf = resolveSet().gltf;
  const setNames = setGltf ? nodeNames(setGltf) : new Set();
  const clash = [...nodeNames(gltf)].filter((n) => setNames.has(n));
  say(`\nAgainst the set: ${clash.length ? `✗ shares ${clash.join(", ")}` : "✓ no shared names"}`);
  for (const [actor, c] of Object.entries(CHARACTERS)) {
    if (resolve(c.file) === path) continue; // inspecting a registered file
    const other = readGlb(resolve(c.file));
    if (!other) continue;
    const otherNames = nodeNames(other);
    const shared = [...nodeNames(gltf)].filter((n) => otherNames.has(n) && !n.startsWith("mixamorig:"));
    say(`Against ${actor}: ${shared.length ? `shares ${shared.join(", ")} — fine, lookups are scoped` : "no shared names"}`);
  }
  say("");
}

// Imported by the test for its helpers; only reports when run as a command.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("lt-tv-models.mjs");
if (!invokedDirectly) {
  // Nothing to do on import.
} else {
  run();
}

function run() {
const target = process.argv[2];
if (target) return inspect(target);

say("LT TV models — checking each export against what the code needs");
checkSet();
for (const [actor, character] of Object.entries(CHARACTERS)) checkCharacter(actor, character);
checkCollisions();

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
