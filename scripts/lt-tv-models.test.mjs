// Tests for the model export contract, run with:
//
//   node scripts/lt-tv-models.test.mjs
//
// The checker's job is to catch a bad Blender export before anyone watches an
// episode, so the thing worth testing is that it says YES to a good one — a
// checker that only ever reports problems is indistinguishable from one that is
// broken. Every positive check below runs against the real committed exports
// rather than a fixture written to pass.
//
// It also pins the two facts that actually cost a broken set this week: that
// nothing but the contract names a clip, and that a character's own file is NOT
// a reliable statement about where they sit.

import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  readGlb,
  nodeNames,
  clipNames,
  leftoverCopies,
  LEFTOVER_NAME,
  nodeByName,
  hasRig,
  seatDrift,
  clipDuration,
  clipTargets,
  loopGap,
  resolveSet,
  collisions,
} from "./lt-tv-models.mjs";
import {
  SET_MODEL,
  CHARACTERS,
  requiredClips,
  optionalClips,
  reactionClips,
  reactionDurations,
  modelUrl,
  MODEL_VERSION,
} from "../src/lib/ltTv/modelContract.mjs";
import { REACTIONS, CAST, ACTORS } from "./lt-tv-format.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

// ── Resolving which file is the set ────────────────────────────────────────
//
// The checker has to give a straight answer on both sides of the split, so it
// finds the set by what it CONTAINS. Getting that wrong in the "before"
// direction is worse than useless: it reports a set full of holes that has
// simply not arrived yet.
console.log("The set is found by what it contains, not by what it is called:");
const resolved = resolveSet();
ok("a set file is found among the candidates", resolved.gltf !== null);
check("and it is the one the scene loads", resolved.file, SET_MODEL.file);
const set = resolved.gltf;
ok("it carries every required prop", SET_MODEL.requires.every((n) => nodeNames(set).has(n)));
check("the characters are out of it", SET_MODEL.forbids.filter((n) => nodeNames(set).has(n)), []);
check("and so are their animations", clipNames(set), []);
// newsDesk.glb is the old props-only export, is still in the repo, and the set
// was briefly given that name before being renamed — so prove the content
// check rejects it even though it is not offered as a candidate.
ok("the props-only newsDesk.glb would be rejected as the set",
  !resolveSet(["public/models/newsDesk.glb"]).seen.find((c) => c.file.endsWith("newsDesk.glb"))?.isSet);
check("and it is not in the candidate list",
  SET_MODEL.candidates.filter((f) => f.endsWith("newsDesk.glb")), []);
check("a candidate list with nothing in it resolves to no set",
  resolveSet(["public/models/NoSuchSet.glb"]).gltf, null);
// The pre-split file is still a valid set, so a check run against an older
// commit reports on that rather than claiming the set is missing.
ok("the pre-split combined file still reads as a set",
  resolveSet([SET_MODEL.candidates[1]]).gltf !== null);

// A SKIPPED CANDIDATE MUST LEAVE EVIDENCE. The fallback above is the same
// mechanism that hid a misplaced re-export from Michelle on 2026-09-22: both
// "the new set is not there" and "the new set is short a prop" fall through to
// the pre-split file, and the scene loads SET_MODEL.file either way. So `seen`
// has to say which of the two it was, since the header alone cannot.
const preSplitFile = SET_MODEL.candidates[1];
const absent = resolveSet(["public/models/NoSuchSet.glb", preSplitFile]);
check("a missing newest candidate still resolves to the pre-split set", absent.file, preSplitFile);
check("and is recorded as absent rather than as a broken set",
  [absent.seen[0].present, absent.seen[0].isSet], [false, false]);
const rejected = resolveSet(["public/models/newsDesk.glb", preSplitFile]);
check("a present-but-incomplete newest candidate also falls through", rejected.file, preSplitFile);
check("and is recorded as present, so the report can name what it lacks",
  [rejected.seen[0].present, rejected.seen[0].isSet], [true, false]);
ok("the props-only file's own missing props are discoverable from seen",
  SET_MODEL.requires.filter((n) => !nodeNames(rejected.seen[0].gltf).has(n)).length > 0);
ok("both cases are distinguishable from a clean run, which resolves to the scene's own file",
  absent.file !== SET_MODEL.file && rejected.file !== SET_MODEL.file && resolved.file === SET_MODEL.file);

// WORKING COPIES LEFT IN THE SET. `requires` only asks whether a prop is
// there, so extra geometry sails through it — Michelle's 2026-09-22 re-export
// carried NewsDesk_original_backup, NeonTop_original_backup and
// Paper_original_backup, all with meshes, all of which would have been drawn.
check("the set on air carries no working copies", leftoverCopies(set), []);
const fakeSet = {
  nodes: [
    { name: "NewsDesk", mesh: 0 },
    { name: "NewsDesk.002", mesh: 1 },
    { name: "NewsDesk_original_backup", mesh: 2 },
    { name: "Paper_original_backup", mesh: 3 },
    { name: "Spare_backup_Empty" },
  ],
};
check("a working copy with geometry is named", leftoverCopies(fakeSet),
  ["NewsDesk_original_backup", "Paper_original_backup"]);
ok("a numbered duplicate is NOT a working copy - the desk-hiding regex forgives .002",
  !LEFTOVER_NAME.test("NewsDesk.002"));
ok("and an empty by a leftover name is ignored, since it draws nothing",
  !leftoverCopies(fakeSet).includes("Spare_backup_Empty"));
// Names on the set today that must NOT be mistaken for leftovers.
for (const name of ["Photocall", "Palm_Leaf19_Color_1_0", "Base4.001", "Content_Screen", "DeskChair.001"]) {
  ok(`"${name}" reads as a real prop`, !LEFTOVER_NAME.test(name));
}

// ── Each character's own export ───────────────────────────────────────────
console.log("\nEvery character file carries what the set asks of it:");
const files = {};
for (const [actor, character] of Object.entries(CHARACTERS)) {
  const gltf = readGlb(resolve(character.file));
  files[actor] = gltf;
  ok(`${actor}: ${character.file} is committed`, gltf !== null);
  if (!gltf) continue;

  const names = nodeNames(gltf);
  const clips = clipNames(gltf);

  ok(`${actor}: the empty ${character.empty} is found`, names.has(character.empty));
  ok(`${actor}: an armature is found under it`, hasRig(gltf, character.empty).found);
  check(`${actor}: no required clip is missing`,
    requiredClips(character).filter((n) => !clips.includes(n)), []);
  // A character with no `faces` has no SitePal face yet (Kip, as first
  // exported): seated and animated, but not castable until they get one.
  if (character.faces) {
    ok(`${actor}: the face to hide (${character.faces.face1}) is there`, names.has(character.faces.face1));
    ok(`${actor}: the face to paint (${character.faces.face2}) is there`, names.has(character.faces.face2));
    for (const hide of character.faces.hide) ok(`${actor}: ${hide} is there`, names.has(hide));
  }

  // It should be their file and nobody else's: a stray second empty means the
  // export took the neighbouring character along and they would be drawn twice.
  const strangers = Object.values(CHARACTERS)
    .filter((c) => c !== character)
    .map((c) => c.empty)
    .filter((n) => names.has(n));
  check(`${actor}: nobody else came along`, strangers, []);
}

// ── A CHARACTER'S FILE DOES NOT SAY WHERE THEY SIT ────────────────────────
//
// This is the fact the contract exists for, and it is worth a test rather than
// a comment. Both hosts sit on two sets; a character exported on their own
// comes out at wherever they happened to be standing on whichever set was open
// in Blender. GR80 was exported from the roundtable and Connor from the news
// desk, so the SAME export convention puts one of them 55cm out of his chair.
// Pinning both seats in the contract is what makes that not matter.
console.log("\nAn export's own transform is not a seat:");
for (const [actor, character] of Object.entries(CHARACTERS)) {
  const node = nodeByName(files[actor], character.empty);
  const seats = Object.entries(character.seat).map(([name, seat]) => [name, seatDrift(node, seat)]);
  // Whatever else is true, the transform must not have been applied: at the
  // origin a character sinks through the floor at the middle of the set.
  ok(`${actor}: not exported at the origin`, !seats[0][1].atOrigin);
  const matching = seats.filter(([, d]) => d.distance < 0.05).map(([name]) => name);
  console.log(`      (${actor} sits at the ${matching.join(" and ") || "neither"} seat in his own file)`);
  ok(`${actor}: matches at most one of the two pinned seats`, matching.length <= 1);
}
const connorLounge = seatDrift(nodeByName(files.Connor, CHARACTERS.Connor.empty), CHARACTERS.Connor.seat.lounge);
ok("Connor's file is half a metre from his lounge chair, which is why it is pinned",
  connorLounge.distance > 0.4);
const monkLounge = seatDrift(nodeByName(files.Monk, CHARACTERS.Monk.empty), CHARACTERS.Monk.seat.lounge);
ok("GR80's file happens to agree with his, which is why it must not be relied on",
  monkLounge.distance < 0.001);

// ── TWO FILES, ONE SET OF BONE NAMES ──────────────────────────────────────
//
// Blender only disambiguates names that collide INSIDE one file, so two
// characters exported on their own come out with identical rigs: the same
// "mixamorig:*" bones, and very likely the same "Armature". Once both trees are
// attached to the set, a scene-wide lookup for a bone or an armature returns
// whichever is traversed first — a mixer bound to the wrong character's
// skeleton, which looks deliberate rather than broken.
//
// findRig in TalkShowScene.jsx therefore scopes every lookup to the character's
// own empty. This pins the data fact that makes that necessary, so nobody
// "simplifies" the scoping back out after a re-export happens to make the
// names unique again.
console.log("\nThe two character files really do collide on names:");
const connorNames = nodeNames(files.Connor);
const monkNames = nodeNames(files.Monk);
const sharedBones = [...connorNames].filter((n) => monkNames.has(n) && n.startsWith("mixamorig:"));
ok(`the rigs share bone names (${sharedBones.length} of them, e.g. ${sharedBones[0]})`,
  sharedBones.length > 10);
ok("each character's armature is nonetheless under their own empty",
  hasRig(files.Connor, CHARACTERS.Connor.empty).found && hasRig(files.Monk, CHARACTERS.Monk.empty).found);
// Neither file may contain the other's empty, which is what makes scoping work.
check("and the empties themselves do not collide",
  [CHARACTERS.Connor.empty, CHARACTERS.Monk.empty].filter((n) => connorNames.has(n) && monkNames.has(n)), []);

// The checker has to SAY so, and has to distinguish the survivable collision
// from the fatal one. A third character arriving with GR80's `Face1` is fine;
// one arriving with the set's `Camera`, or with GR80's `Monk_Empty`, is not.
console.log("\nThe checker tells the survivable collision from the fatal one:");
const entries = Object.entries(CHARACTERS);
const real = collisions(set, entries);
check("today nobody shares a name with the set", real.withSet, []);
check("and no two characters share an empty", real.sharedEmpties, []);
ok("the shared bones are reported as expected rather than as a problem",
  real.betweenCharacters.some((r) => r.bones > 10 && r.looked.length === 0));

// Against a set that DOES collide — the character files are real, the set is
// the pre-split one, which still contains both characters and therefore every
// name they have.
const preSplit = resolveSet([SET_MODEL.candidates[1]]).gltf;
const clashing = collisions(preSplit, entries);
// Connor and GR80 are INSIDE that file, so they collide on everything they
// have — empty, armature, faces, every bone.
for (const actor of ["Connor", "Monk"]) {
  const hit = clashing.withSet.find((c) => c.actor === actor);
  ok(`${actor} is caught against a set that contains him`, hit && hit.names.length > 30);
  ok(`and the report names the nodes, ${CHARACTERS[actor].empty} among them`,
    hit?.names.includes(CHARACTERS[actor].empty));
}
// The co-anchor is not in that file, and still collides on two names — because
// the names she shares are GR80's Face1/Face2, and his copy is in there. Which
// is the point: a name is dangerous because of where it ends up, not whose it is.
const holly = clashing.withSet.find((c) => c.actor === "Holly");
check("and a character not in the set is still caught on the names she shares",
  holly?.names.sort(), ["Face1", "Face2"]);

// Two entries pointed at the same file is the shared-empty case, and the one
// that would leave the scoped lookups with nothing to scope by.
const sameEmpty = collisions(set, [
  ["A", CHARACTERS.Connor],
  ["B", CHARACTERS.Connor],
]);
check("two characters on one empty are caught", sameEmpty.sharedEmpties, [["A", "B", CHARACTERS.Connor.empty]]);

// ── The armature name genuinely does not matter ────────────────────────────
//
// GR80's armature is "Armature.001" in the file and the contract asks for
// "Armature001" (what GLTFLoader renames it to at load). The checker must still
// find it, because that mismatch is exactly the shape of the trap that costs a
// silent bind-pose character.
console.log("\nThe armature is found by shape, not by name:");
const monkRig = hasRig(files.Monk, CHARACTERS.Monk.empty);
check("GR80's armature is found", monkRig.found, true);
ok("and it is not named what the contract asks for", monkRig.name !== CHARACTERS.Monk.rig);
console.log(`      (file says "${monkRig.name}", contract says "${CHARACTERS.Monk.rig}")`);

// ── Failures are actually detected ─────────────────────────────────────────
console.log("\nA bad export is caught:");
check("a missing empty reports no rig", hasRig(set, "NoSuchCharacter_Empty"), { found: false, name: null });
ok("a node with no bones under it is not mistaken for a rig", !hasRig(set, "NewsDesk").found);
check("a character exported at the origin is flagged",
  seatDrift({ translation: [0, 0, 0] }, CHARACTERS.Connor.seat.lounge).atOrigin, true);
ok("a character exported somewhere else reads as drift, not as the origin",
  seatDrift({ translation: [2, 0, 0] }, CHARACTERS.Connor.seat.lounge).distance > 0.02);
let threw = null;
try {
  readGlb(resolve("package.json"));
} catch (err) {
  threw = err.message;
}
ok("a file that is not a GLB is refused by name", threw && threw.includes("not a .glb"));
check("a file that is not there is null, not an error", readGlb(resolve("public/models/NoSuchFile.glb")), null);

// ── ONE PLACE NAMES THE CLIPS ─────────────────────────────────────────────
//
// The clip names used to live twice: here, and again in TalkShowScene.jsx. That
// is what put Connor in a T-pose — his actions were renamed barron_* to connor_*
// in Blender and the scene was still asking for barron_*. The scene now derives
// every name from this contract, so the test is no longer "do the two copies
// agree" but "is there still only one copy".
console.log("\nNothing but the contract names a clip:");
const sceneSource = await readFile(resolve("src/components/trade/TalkShowScene.jsx"), "utf8");
const literals = [...sceneSource.matchAll(/"((?:barron|connor|monk)_[a-z0-9_]+)"/g)].map((m) => m[1]);
check("the scene holds no clip-name literals", [...new Set(literals)], []);
ok("the scene reads the contract instead", sceneSource.includes('from "@/lib/ltTv/modelContract.mjs"'));
// Same for the model paths: a URL typed into the scene is a file the checker
// would never look at.
const modelLiterals = [...sceneSource.matchAll(/"\/models\/[^"]+"/g)].map((m) => m[0]);
check("and no model URL is typed into it either", modelLiterals, []);

// ── The served URL ────────────────────────────────────────────────────────
console.log("\nThe repo path and the served path are the same file:");
check("the set", modelUrl(SET_MODEL.file), `/models/LTTV_Set.glb?v=${MODEL_VERSION}`);
for (const [actor, character] of Object.entries(CHARACTERS)) {
  ok(`${actor}'s URL drops "public" and keeps the filename`,
    modelUrl(character.file).startsWith(character.file.replace(/^public/, "").split("?")[0]));
}
ok("the URL is versioned, so a re-export is never served from cache",
  modelUrl(SET_MODEL.file).includes("?v="));

// ── A BASE CLIP THAT ANIMATES NOTHING ─────────────────────────────────────
//
// A clip's name and its duration both look fine on a clip that animates
// nothing. The co-anchor's first export shipped a `hologirl_sitting` carrying
// three channels on her empty and not one bone, where her gesture clips carry
// 168 each — as a base idle, the whole episode in her rest pose. Same silent
// bind-pose failure as a missing clip, reached from the other direction, so
// the checker has to see it.
console.log("\nA base clip is checked for actually animating something:");
for (const [actor, character] of Object.entries(CHARACTERS)) {
  const t = clipTargets(files[actor], character.base);
  ok(`${actor}: the base clip is found`, t !== null);
  console.log(`      (${actor}'s "${character.base}": ${t.channels} channels, ${t.bones} bones)`);
}
// WHAT IS ASSERTED HERE IS THE CHECKER, NOT THE STATE OF ANYONE'S EXPORT.
// Michelle is re-exporting the co-anchor's base clip, so a test pinning it as
// broken would fail the moment she fixes it, which is backwards. The live data
// is `npm run lt:models`, which exits non-zero while a base clip animates
// nothing; this proves that it would notice.
const boneless = {
  nodes: [{ name: "Someone_Empty" }, { name: "Root" }, { name: "head" }],
  skins: [{ joints: [2] }],
  animations: [
    { name: "empty_only", channels: [
      { target: { node: 0, path: "translation" } },
      { target: { node: 0, path: "rotation" } },
    ], samplers: [] },
    { name: "real_idle", channels: [{ target: { node: 2, path: "rotation" } }], samplers: [] },
  ],
};
check("a clip that only moves the empty reports no bones", clipTargets(boneless, "empty_only").bones, 0);
check("and names what it does move", clipTargets(boneless, "empty_only").names, ["Someone_Empty"]);
check("a clip that moves a bone reports one", clipTargets(boneless, "real_idle").bones, 1);
check("two channels on one node count as one node", clipTargets(boneless, "empty_only").nodes, 1);

// Against her real file, the part that stays true after the re-export: the
// gesture clips animate the rig, so the difference between a clip that poses
// her and one that does not is visible in the data.
const hollyGesture = clipTargets(files.Holly, reactionClips(CHARACTERS.Holly).headnod);
const hollyJoints = new Set((files.Holly.skins || []).flatMap((sk) => sk.joints || [])).size;
ok(`her gesture clip animates most of her rig (${hollyGesture.bones} of ${hollyJoints})`,
  hollyGesture.bones / hollyJoints > 0.5);
// EVERY base clip must pose its rig, which is the invariant the co-anchor's
// first export broke: hers animated three channels on her empty and not one
// bone, so she played her rest pose for a whole episode. She was re-exported
// off the armature on 2026-09-22 (`4ae5a2ff`) and now sits with the others,
// which is why this is one loop over all three rather than a carve-out for
// her. Measured as a SHARE of each rig, because the rigs are different sizes —
// Connor's has 41 joints and GR80's 33, so any fixed number is either wrong
// for one of them or too weak to mean anything.
for (const actor of ["Connor", "Monk", "Holly"]) {
  const t = clipTargets(files[actor], CHARACTERS[actor].base);
  const joints = new Set((files[actor].skins || []).flatMap((sk) => sk.joints || [])).size;
  ok(`${actor}'s base clip animates most of their rig (${t.bones} of ${joints})`,
    t.bones / joints > 0.5);
}
check("a clip that is not there reports nothing rather than zero",
  clipTargets(files.Holly, "no_such_clip"), null);

// ── A LOOPING CLIP MUST END WHERE IT STARTS ───────────────────────────────
//
// The base idle and the news intermission both play on LoopRepeat, and THREE
// wraps them hard: at the end of the cycle it jumps to time zero. A gap
// between the last keyframe and the first is therefore a snap the viewer sees
// once per cycle, for as long as the clip is up. It was found by hand on the
// co-anchor's first good idle (7.24° at her shoulder, every 19 seconds) and
// this is that measurement moved into the checker.
//
// Built rather than measured, because the point is that the checker reports a
// gap it is GIVEN — a quaternion 10° off its start, which reads as only 0.087
// on one component and is exactly the reason this is reported as an angle.
const quaternionGap = (degrees) => {
  const half = (degrees / 2) * (Math.PI / 180);
  return [0, 0, 0, 1, 0, Math.sin(half), 0, Math.cos(half)];
};
const looping = (values) => {
  const bin = Buffer.from(new Float32Array(values).buffer);
  const gltf = {
    nodes: [{ name: "Shoulder" }],
    accessors: [{ bufferView: 0, componentType: 5126, type: "VEC4", count: values.length / 4 }],
    bufferViews: [{ byteOffset: 0 }],
    animations: [{
      name: "spin",
      channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
      samplers: [{ input: 0, output: 0 }],
    }],
  };
  Object.defineProperty(gltf, "bin", { value: bin, enumerable: false });
  return gltf;
};
const tenDegrees = loopGap(looping(quaternionGap(10)), "spin");
ok(`a clip ending 10° from its start reports ${tenDegrees.degrees.toFixed(2)}°`,
  Math.abs(tenDegrees.degrees - 10) < 0.01);
check("and names the bone that moved", tenDegrees.node, "Shoulder");
check("a clip that closes its own loop reports 0°", loopGap(looping(quaternionGap(0)), "spin").degrees, 0);
check("a clip that is not there reports nothing", loopGap(files.Holly, "no_such_clip"), null);

// The two already on air close cleanly, which is what makes the threshold
// meaningful — 1° is well above export noise and well below a real gap.
for (const [actor, clip] of [
  ["Connor", CHARACTERS.Connor.base],
  ["Monk", CHARACTERS.Monk.base],
  ["Connor", CHARACTERS.Connor.outro],
]) {
  const gap = loopGap(files[actor], clip);
  ok(`${clip} closes its own loop (${gap.degrees.toFixed(2)}°)`, gap.degrees < 1);
}

// ── ONE COPY OF THE REACTION TABLE ────────────────────────────────────────
//
// This lived three times — TalkShowScene.jsx, lt-tv-format.mjs and
// lt-tv-check.mjs — each asking the next person to keep it in step by hand.
// The writers are OFFERED these names, so a list that disagrees with the rig
// is a cue that does nothing on screen.
console.log("\nThe writers are offered exactly what each rig can perform:");
for (const [actor, character] of Object.entries(CHARACTERS)) {
  check(`${actor}: the same keys as the contract`,
    Object.keys(REACTIONS[actor]).sort(), Object.keys(character.reactions).sort());
  const clips = clipNames(files[actor]);
  const absent = Object.values(reactionClips(character)).filter((n) => !clips.includes(n));
  check(`${actor}: and every one of them is really in his or her file`, absent, []);
}
// The durations that were in those copies, pinned so the consolidation cannot
// have quietly changed what the writers plan against.
check("Connor's durations are unchanged", reactionDurations(CHARACTERS.Connor), {
  headnod: 4.33, headnodSubtle: 4.33, headshakeDisappointment: 4.33,
  lookAround: 7.6, shrug: 4.33, mockCrying: 4.83,
});
check("GR80's durations are unchanged", reactionDurations(CHARACTERS.Monk), {
  headnod: 4.33, headnodSubtle: 4.33, headshake: 4.33, headshakeDisappointment: 4.33,
  lookAround: 7.6, shrug: 4.33, prayCrosschest: 3.87,
});
ok("the co-anchor is offered only the two gestures she has",
  Object.keys(REACTIONS.Holly).length === 2);

// ── A SEAT PER SET, AND THE CAST SPLIT IT EXPRESSES ───────────────────────
console.log("\nWho has a chair on which set is the cast split:");
const seatedOn = (set) =>
  Object.entries(CHARACTERS).filter(([, c]) => c.seat[set]).map(([a]) => a).sort();
check("the lounge seats Connor and GR80", seatedOn("lounge"), ["Connor", "Monk"]);
// Kip took the news desk 2026-09-23; Connor keeps a news seat only for the
// news episodes already recorded with him.
check("the news desk seats Connor, GR80, the co-anchor and Kip", seatedOn("news"), ["Connor", "Holly", "Kip", "Monk"]);
ok("Kip has no lounge seat: Connor stays on Markets & Morality", !CHARACTERS.Kip.seat.lounge);
ok("she has no lounge seat, which is what keeps her out of the roundtable",
  !CHARACTERS.Holly.seat.lounge);
// GR80 keeps a news seat on purpose: news-01 is on air and casts him. It is
// the episode's cast, not the seat, that takes a character off a set.
ok("GR80 still has a news seat, because the episode on air casts him",
  Boolean(CHARACTERS.Monk.seat.news));
// Every seat must be complete, or the scene would read undefined off it.
for (const [actor, character] of Object.entries(CHARACTERS)) {
  for (const [set, seat] of Object.entries(character.seat)) {
    ok(`${actor}/${set}: a position, a quaternion and a scale`,
      seat.position?.length === 3 && seat.quaternion?.length === 4 && typeof seat.scale === "number");
  }
}

// ── Every character the writers know has a model ──────────────────────────
console.log("\nThe roster and the models agree:");
check("the writers' roster is the contract's", ACTORS.sort(), Object.keys(CHARACTERS).sort());
for (const actor of ACTORS) {
  ok(`${actor} has a voice id`, /^[A-Za-z0-9]{16,}$/.test(CAST[actor].voiceId));
  ok(`${actor}'s voice id is his or her own`,
    ACTORS.filter((a) => CAST[a].voiceId === CAST[actor].voiceId).length === 1);
  // A SCREENPLAY IS PARSED BY THE SPEAKER CUE, which is the display name
  // uppercased (lt-tv-edit.mjs, lt-tv-room.mjs). Two characters sharing one
  // would collapse into whichever the Map saw last, silently reassigning
  // somebody's lines — so the cue has to be unique, and has to survive being
  // uppercased and matched.
  const cue = CAST[actor].displayName.toUpperCase();
  ok(`${actor}'s speaker cue "${cue}" is unique`,
    ACTORS.filter((a) => CAST[a].displayName.toUpperCase() === cue).length === 1);
  // An apostrophe is allowed (KIP O'BRIEN); the parser reads a curly one as
  // the same cue.
  ok(`and it is a cue a screenplay can carry`, /^[A-Z0-9][A-Z0-9 ']*$/.test(cue));
  // Nor may one cue be a prefix of another, which is what would make
  // "HOLLY" and "HOLLY JONES" ambiguous to read.
  ok(`and no other cue starts with it`,
    !ACTORS.some((a) => a !== actor && CAST[a].displayName.toUpperCase().startsWith(`${cue} `)));
}
// Her name, since it is the thing that was a placeholder for an hour.
check("the co-anchor is Holly Jones", CAST.Holly.displayName, "Holly Jones");
check("and her clips will be named for her", CAST.Holly.clipKey, "holly");

// ── The play-out clip ─────────────────────────────────────────────────────
console.log("\nConnor's news intermission is optional and really is there:");
check("it is listed as an optional clip", optionalClips(CHARACTERS.Connor), ["connor_news_intermission_head_turn"]);
ok("it is not required, so an export without it still passes",
  !requiredClips(CHARACTERS.Connor).includes(CHARACTERS.Connor.outro));
ok("it is in his file", clipNames(files.Connor).includes(CHARACTERS.Connor.outro));
const outroLength = clipDuration(files.Connor, CHARACTERS.Connor.outro);
ok(`it is long enough to be a play-out rather than a reaction (${outroLength?.toFixed(2)}s)`, outroLength > 20);
ok("GR80 has no play-out, so nothing optional is expected of him", optionalClips(CHARACTERS.Monk).length === 0);
// She has one too, and hers is nearly a clean loop where Connor's is exact.
console.log("\nThe co-anchor's play-out:");
check("it is declared", optionalClips(CHARACTERS.Holly), ["hologirl_news_intermission"]);
ok("it is in her file", clipNames(files.Holly).includes(CHARACTERS.Holly.outro));
const hollyOutro = clipDuration(files.Holly, CHARACTERS.Holly.outro);
ok(`it is a play-out rather than a gesture (${hollyOutro?.toFixed(2)}s)`, hollyOutro > 20);
ok("and it animates her rig, unlike her base clip",
  clipTargets(files.Holly, CHARACTERS.Holly.outro).bones > 40);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
