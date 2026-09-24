// Tests for reshaping a clip on load (src/lib/ltTv/clipShaping.mjs), run with:
//
//   node scripts/lt-tv-clip-shaping.test.mjs
//
// Run against the real committed exports, because the thing that goes wrong
// with a turn is the rig's own axes: on Kip's Unreal-style spine a yaw in
// bone-local space tilts him sideways, and only his actual skeleton shows it.

import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readGlb } from "./lt-tv-models.mjs";
import { shapeClip, turnAmount, closeLoop } from "../src/lib/ltTv/clipShaping.mjs";
import { CHARACTERS, clipShape, matchesAuthoredName } from "../src/lib/ltTv/modelContract.mjs";
import { FACES } from "../src/lib/ltTv/faces.mjs";

// GLTFLoader warns about things a browser would do (textures, extensions)
// that a node run has no use for; the checks below print their own lines.
console.warn = () => {};

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

/**
 * A character file's rig and clips, loaded in node. The meshes are Draco
 * compressed and the textures need a browser, and none of it matters to a
 * skeleton, so they are stripped from the manifest before GLTFLoader sees it.
 */
function loadRig(path) {
  const gltf = readGlb(path);
  const json = JSON.parse(JSON.stringify(gltf));
  for (const key of ["meshes", "materials", "textures", "images", "samplers", "extensionsUsed", "extensionsRequired"]) {
    delete json[key];
  }
  for (const node of json.nodes) {
    delete node.mesh;
    delete node.skin;
  }
  const pad = (buf, fill) => {
    const extra = (4 - (buf.length % 4)) % 4;
    return extra ? Buffer.concat([buf, Buffer.alloc(extra, fill)]) : buf;
  };
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(gltf.bin, 0);
  const out = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonChunk.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(out, 20);
  const at = 20 + jsonChunk.length;
  out.writeUInt32LE(binChunk.length, at);
  out.writeUInt32LE(0x004e4942, at + 4);
  binChunk.copy(out, at + 8);
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
}

/** Pose a copy of `root` with `clip` at `seconds`, clamped (never wrapped). */
function poser(root, rigName, clip) {
  const copy = root.clone(true);
  const rig = copy.getObjectByName(rigName);
  const mixer = new THREE.AnimationMixer(rig);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return (seconds) => {
    // Clamping pauses the action at the end, and a paused action ignores setTime.
    action.paused = false;
    mixer.setTime(seconds);
    copy.updateMatrixWorld(true);
    return copy;
  };
}

/** The largest angle, in degrees, any bone is from where the clip started. */
function loopGapDegrees(pose, duration, firstKey) {
  const start = {};
  pose(firstKey).traverse((o) => { if (o.isBone) start[o.name] = o.quaternion.clone(); });
  let worst = 0;
  pose(duration).traverse((o) => {
    if (o.isBone && start[o.name]) worst = Math.max(worst, THREE.MathUtils.radToDeg(start[o.name].angleTo(o.quaternion)));
  });
  return worst;
}

/** The world rotation `after` adds to `before` for one bone: its angle, and how vertical its axis is. */
function addedRotation(before, after, name) {
  const qa = before.getObjectByName(name).getWorldQuaternion(new THREE.Quaternion());
  const qb = after.getObjectByName(name).getWorldQuaternion(new THREE.Quaternion());
  const d = qb.multiply(qa.invert());
  if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
  const degrees = THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, d.w)));
  const axis = new THREE.Vector3(d.x, d.y, d.z);
  return { degrees, up: axis.length() > 1e-6 ? axis.normalize().y : 1 };
}

console.log("Blender's duplicate suffix is the same name, and nothing else is:");
check("Face1.001 as exported", matchesAuthoredName("Face1", "Face1.001"), true);
check("Face1001 once GLTFLoader drops the dot", matchesAuthoredName("Face1", "Face1001"), true);
check("the exact name", matchesAuthoredName("Face1", "Face1"), true);
check("Face10 is a different mesh", matchesAuthoredName("Face1", "Face10"), false);
check("a working copy is not the face", matchesAuthoredName("Face1", "Face1_backup"), false);
check("Face2.001 is not Face1", matchesAuthoredName("Face1", "Face2.001"), false);

console.log("\nThe turn is eased between its keys and holds past the ends:");
const keys = [[1, 0], [41, 1], [100, 1], [120, 0]];
check("before the first key", turnAmount(keys, 0), 0);
check("half way up", turnAmount(keys, 21), 0.5);
check("held", turnAmount(keys, 70), 1);
check("after the last key", turnAmount(keys, 500), 0);

console.log("\nClosing a loop ends every channel on its own first frame:");
{
  const times = [0, 1, 2, 3];
  const track = new THREE.VectorKeyframeTrack("x.position", times, [0, 0, 0, 1, 1, 1, 2, 2, 2, 5, 5, 5]);
  const [closed] = closeLoop([track], 1.5);
  check("last key is the first", Array.from(closed.values.slice(9)), [0, 0, 0]);
  check("keys before the window are untouched", Array.from(closed.values.slice(0, 6)), [0, 0, 0, 1, 1, 1]);
  check("the loaded track is not changed", Array.from(track.values.slice(9)), [5, 5, 5]);
}

console.log("\nEvery declared shape reaches something real:");
for (const [actor, character] of Object.entries(CHARACTERS)) {
  const shapes = character.shapes || {};
  if (!Object.keys(shapes).length) continue;
  const gltf = await loadRig(character.file);
  for (const [clipName, shape] of Object.entries(shapes)) {
    // A shape keyed by a clip the file lacks does nothing and says nothing.
    ok(`${actor}: "${clipName}" is in ${character.file}`, gltf.animations.some((a) => a.name === clipName));
    const empty = gltf.scene.getObjectByName(character.empty);
    const bones = Object.keys(shape.turn?.degrees || {});
    const missing = bones.filter((b) => !empty.getObjectByName(b));
    check(`${actor}: every bone the turn names is in the rig`, missing, []);
  }
}

console.log("\nKip's intermission turns him to Holly and comes home (Michelle, 2026-09-24):");
{
  const kip = CHARACTERS.Kip;
  const gltf = await loadRig(kip.file);
  const empty = gltf.scene.getObjectByName(kip.empty);
  const rig = empty.getObjectByName(kip.rig);
  const clip = gltf.animations.find((a) => a.name === kip.outro);
  const shape = clipShape(kip, kip.outro);
  const { clip: shaped } = shapeClip(clip, rig, shape, kip.seat.news);
  const fps = shape.fps;
  const before = poser(empty, rig.name, clip);
  const after = poser(empty, rig.name, shaped);
  const added = (frame, bone) => {
    const b = before(frame / fps);
    const a = after(frame / fps);
    return addedRotation(b, a, bone);
  };
  const [body, glances] = shape.turns;
  const bodyTotal = Object.values(body.degrees).reduce((s, d) => s + d, 0);
  const glanceTotal = Object.values(glances.degrees).reduce((s, d) => s + d, 0);
  const on = (layer, frame) => turnAmount(layer.keys, frame);
  // Frames picked off the keys, not hard-coded, so retiming the glances
  // cannot leave these testing nothing.
  const held = (layer, f, v) => [0, 5, 10].every((back) => on(layer, f - back) === v);
  const glancing = [...Array(820).keys()].find((f) => f > 200 && held(glances, f, 1) && held(body, f, 1));
  const between = [...Array(820).keys()].find((f) => f > 200 && held(glances, f, 0) && held(body, f, 1));

  const chest = added(glancing, "spine_03");
  const head = added(glancing, "head");
  ok(`turned, the chest carries the body's ${bodyTotal}° (${chest.degrees.toFixed(2)}°)`, Math.abs(chest.degrees - bodyTotal) < 0.1);
  ok(`mid-glance the head adds ${glanceTotal}° more (${head.degrees.toFixed(2)}°)`, Math.abs(head.degrees - bodyTotal - glanceTotal) < 0.1);
  // About WORLD UP, and toward +X, where Holly sits: a turn, not a lean.
  ok(`about world up, not tilted (axis y ${head.up.toFixed(4)})`, head.up > 0.9999);
  ok("toward Holly, who is at +X of him", CHARACTERS.Holly.seat.news.position[0] > kip.seat.news.position[0]);

  // "A little creepy" was a head glued on her: between glances it goes with
  // the body instead of holding her.
  ok(`between glances the head only goes where the body does (${added(between, "head").degrees.toFixed(2)}°)`,
    Math.abs(added(between, "head").degrees - bodyTotal) < 0.1);
  const glanceCount = glances.keys.filter(([, v], i, k) => v === 1 && (i === 0 || k[i - 1][1] === 0)).length;
  ok(`he glances more than once (${glanceCount})`, glanceCount >= 3);

  // "Machine-like" was every bone arriving together: the head starts first,
  // and the turn travels down the spine.
  const start = Math.round((body.keys[1][0] + body.keys[2][0]) / 2);
  ok(`the head is on its way before the body (frame ${body.keys[1][0]})`, added(body.keys[1][0], "head").degrees > 5);
  const upper = added(start, "spine_03").degrees - added(start, "spine_02").degrees;
  const lower = added(start, "spine_01").degrees;
  ok(`mid-turn the upper spine leads the lower (${upper.toFixed(2)}° vs ${lower.toFixed(2)}° at the base)`, upper > lower);

  const [b900, a900] = [before(900 / fps), after(900 / fps)];
  ok("typing at the laptop (frame 900) is not turned", addedRotation(b900, a900, "head").degrees < 0.1);
  const tipsY = (e) => Math.min(...shape.rest[0].tips.map((n) => e.getObjectByName(n).getWorldPosition(new THREE.Vector3()).y));

  // Her second note: typing, the hands were too high over the keys. The
  // lowest a fingertip gets while typing is judged across the whole stretch
  // of held typing, so it is the bottom of the keystrokes.
  for (const rest of shape.rest.slice(1)) {
    const heldFrom = rest.keys.find(([, v]) => v === 1)[0];
    const heldTo = rest.keys.filter(([, v]) => v === 1).pop()[0];
    const low = (pose) => {
      let y = Infinity;
      for (let f = heldFrom; f <= heldTo; f += 1) {
        const e = pose(f / fps);
        for (const n of rest.tips) y = Math.min(y, e.getObjectByName(n).getWorldPosition(new THREE.Vector3()).y);
      }
      return y - rest.surface;
    };
    const was = low(before);
    const now = low(after);
    ok(`${rest.hand} typed ${(was * 100).toFixed(1)}cm over the keys, or this proves nothing`, was > 0.02);
    ok(`and now reaches them (${(now * 100).toFixed(1)}cm)`, Math.abs(now) < 0.01);
  }

  // The hand Michelle saw hovering (screen left, his right): 3-5cm over the
  // desk as animated, on it once rested.
  const surface = shape.rest[0].surface;
  const hover = tipsY(before(200 / fps)) - surface;
  const rested = tipsY(after(200 / fps)) - surface;
  ok(`his right hand hovered (${(hover * 100).toFixed(1)}cm over the desk), or this proves nothing`, hover > 0.02);
  ok(`and now rests on it (${(rested * 100).toFixed(1)}cm)`, Math.abs(rested) < 0.01);

  const first = shaped.tracks[0].times[0];
  const gapBefore = loopGapDegrees(before, clip.duration, first);
  const gapAfter = loopGapDegrees(after, shaped.duration, first);
  ok(`the file's own loop gap is real (${gapBefore.toFixed(2)}°), or this proves nothing`, gapBefore > 5);
  ok(`the loop comes home to frame 1 (${gapAfter.toFixed(3)}°)`, gapAfter < 0.1);
}

console.log("\nHolly's coffee break comes home too:");
{
  const holly = CHARACTERS.Holly;
  const gltf = await loadRig(holly.file);
  const empty = gltf.scene.getObjectByName(holly.empty);
  const rig = empty.getObjectByName(holly.rig) || empty.children[0];
  const clip = gltf.animations.find((a) => a.name === holly.outro);
  const { clip: shaped } = shapeClip(clip, rig, clipShape(holly, holly.outro));
  const gap = loopGapDegrees(poser(empty, rig.name, shaped), shaped.duration, shaped.tracks[0].times[0]);
  ok(`${holly.outro} ends on its first frame (${gap.toFixed(3)}°)`, gap < 0.1);
}

console.log("\nThe intermission's silent conversation names things that exist:");
for (const [actor, character] of Object.entries(CHARACTERS)) {
  const talk = character.intermissionTalk;
  if (!talk) continue;
  ok(`${actor}: it runs on their intermission clip (${talk.clip})`, talk.clip === character.outro);
  const gltf = await loadRig(character.file);
  const clip = gltf.animations.find((a) => a.name === talk.clip);
  const lastFrame = clip ? clip.duration * talk.fps : 0;
  const bad = talk.beats.filter(
    (b) =>
      !CHARACTERS[b.actor] ||
      !(b.frame > 0 && b.frame < lastFrame) ||
      (b.face !== undefined && !FACES[b.face]) ||
      (b.say !== undefined && !(Number.isInteger(b.say) && b.say > 0)) ||
      (b.say === undefined && b.face === undefined),
  );
  check(`${actor}: every beat is a real actor, inside the clip, a known face or whole seconds of talk`, bad, []);
  // saySilent from two portals at once would be two people talking over each other.
  const talking = talk.beats.filter((b) => b.say).sort((a, b) => a.frame - b.frame);
  const overlaps = talking.filter((b, i) => i && b.actor !== talking[i - 1].actor && b.frame < talking[i - 1].frame + talking[i - 1].say * talk.fps);
  check(`${actor}: nobody talks over anybody`, overlaps, []);
}

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll clip-shaping tests pass.");
