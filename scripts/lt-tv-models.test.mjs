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
  nodeByName,
  hasRig,
  seatDrift,
  clipDuration,
  resolveSet,
  collisions,
} from "./lt-tv-models.mjs";
import {
  SET_MODEL,
  CHARACTERS,
  requiredClips,
  optionalClips,
  modelUrl,
  MODEL_VERSION,
} from "../src/lib/ltTv/modelContract.mjs";

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
  ok(`${actor}: the face to hide (${character.faces.face1}) is there`, names.has(character.faces.face1));
  ok(`${actor}: the face to paint (${character.faces.face2}) is there`, names.has(character.faces.face2));
  for (const hide of character.faces.hide) ok(`${actor}: ${hide} is there`, names.has(hide));

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
ok("a character whose names are also in the set is caught", clashing.withSet.length === 2);
ok("and the report names the nodes, not just the count",
  clashing.withSet[0].names.includes(CHARACTERS[clashing.withSet[0].actor].empty));

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

// ── The play-out clip ─────────────────────────────────────────────────────
console.log("\nConnor's news intermission is optional and really is there:");
check("it is listed as an optional clip", optionalClips(CHARACTERS.Connor), ["connor_news_intermission_head_turn"]);
ok("it is not required, so an export without it still passes",
  !requiredClips(CHARACTERS.Connor).includes(CHARACTERS.Connor.outro));
ok("it is in his file", clipNames(files.Connor).includes(CHARACTERS.Connor.outro));
const outroLength = clipDuration(files.Connor, CHARACTERS.Connor.outro);
ok(`it is long enough to be a play-out rather than a reaction (${outroLength?.toFixed(2)}s)`, outroLength > 20);
ok("GR80 has no play-out, so nothing optional is expected of him", optionalClips(CHARACTERS.Monk).length === 0);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
