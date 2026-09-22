// Tests for the model export contract, run with:
//
//   node scripts/lt-tv-models.test.mjs
//
// The checker's job is to catch a bad Blender export before anyone watches an
// episode, so the thing worth testing is that it says YES to a good one — a
// checker that only ever reports problems is indistinguishable from one that is
// broken.
//
// There is no committed character file to test against yet, but there is
// something better: the set file still contains both characters, complete with
// their empties, armatures, clips and face meshes, at their authored seats. So
// every positive check runs against real exported geometry rather than a
// fixture someone wrote to pass.

import { resolve } from "node:path";
import {
  readGlb,
  nodeNames,
  clipNames,
  nodeByName,
  hasRig,
  seatDrift,
  resolveSet,
} from "./lt-tv-models.mjs";
import {
  SET_MODEL,
  CHARACTERS,
  requiredClips,
  optionalClips,
} from "../src/lib/ltTv/modelContract.mjs";
import { readFile } from "node:fs/promises";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const resolved = resolveSet();
const set = resolved.gltf;
ok("a set file is found among the candidates", set !== null);
console.log(`      (resolved to ${resolved.file})`);

// ── Resolving which file is the set ────────────────────────────────────────
//
// The split lands in one push, so the checker has to answer correctly on both
// sides of it. Getting this wrong in the "before" direction is worse than
// useless: it reports a set full of holes that has simply not arrived yet.
console.log("\nThe set is found by what it contains, not by its name:");
ok("the resolved set carries every required prop",
  SET_MODEL.requires.every((name) => nodeNames(set).has(name)));
// The repo's newsDesk.glb is the OLD props-only export until Michelle pushes
// hers, and it must not be mistaken for the set on the strength of its name.
const propsOnly = resolved.seen.find((c) => c.file.endsWith("newsDesk.glb"));
if (propsOnly?.present) {
  ok("a props-only newsDesk.glb is not accepted as the set", !propsOnly.isSet);
}
check("a candidate list with nothing in it resolves to no set",
  resolveSet(["public/models/NoSuchSet.glb"]).gltf, null);

// ── The positive path, against the characters still inside the set ─────────
//
// Whatever Michelle's separate exports turn out to contain, this is what a
// correct one looks like, because it IS the geometry that has been on air.
console.log("\nA correct export passes every check (using the set's own characters):");
for (const [actor, character] of Object.entries(CHARACTERS)) {
  const names = nodeNames(set);
  const clips = clipNames(set);

  ok(`${actor}: the empty ${character.empty} is found`, names.has(character.empty));

  const rig = hasRig(set, character.empty);
  ok(`${actor}: an armature is found under it`, rig.found);

  const missing = requiredClips(character).filter((name) => !clips.includes(name));
  check(`${actor}: no required clip is missing`, missing, []);

  ok(`${actor}: the face to hide (${character.faces.face1}) is there`, names.has(character.faces.face1));
  ok(`${actor}: the face to paint (${character.faces.face2}) is there`, names.has(character.faces.face2));
  for (const hide of character.faces.hide) {
    ok(`${actor}: ${hide} is there`, names.has(hide));
  }

  // The lounge seat in the contract was read off this file, so it must agree —
  // this is what tells us a future export has been moved or flattened.
  const drift = seatDrift(nodeByName(set, character.empty), character.seat.lounge);
  ok(`${actor}: sits at its recorded lounge seat (off by ${drift.distance.toFixed(4)})`, drift.distance < 0.02);
  ok(`${actor}: and is not at the origin`, !drift.atOrigin);
}

// ── The armature name genuinely does not matter ────────────────────────────
//
// GR80's armature is "Armature.001" in the file and the contract asks for
// "Armature001" (what GLTFLoader renames it to at load). The checker must still
// find it, because that mismatch is exactly the shape of the trap that cost a
// silent bind-pose character.
console.log("\nThe armature is found by shape, not by name:");
const monkRig = hasRig(set, CHARACTERS.Monk.empty);
check("GR80's armature is found", monkRig.found, true);
ok("and it is not named what the contract asks for", monkRig.name !== CHARACTERS.Monk.rig);
console.log(`      (file says "${monkRig.name}", contract says "${CHARACTERS.Monk.rig}")`);

// ── Failures are actually detected ─────────────────────────────────────────
console.log("\nA bad export is caught:");
check("a missing empty reports no rig", hasRig(set, "NoSuchCharacter_Empty"), { found: false, name: null });
ok("a node with no bones under it is not mistaken for a rig", !hasRig(set, "NewsDesk").found);
check(
  "a character exported at the origin is flagged",
  seatDrift({ translation: [0, 0, 0] }, CHARACTERS.Connor.seat.lounge).atOrigin,
  true,
);
ok(
  "a character exported somewhere else reads as drift, not as the origin",
  seatDrift({ translation: [2, 0, 0] }, CHARACTERS.Connor.seat.lounge).distance > 0.02,
);
let threw = null;
try {
  readGlb(resolve("package.json"));
} catch (err) {
  threw = err.message;
}
ok("a file that is not a GLB is refused by name", threw && threw.includes("not a .glb"));
check("a file that is not there is null, not an error", readGlb(resolve("public/models/NoSuchFile.glb")), null);

// ── The contract must not drift from the scene ─────────────────────────────
//
// The clip names live in two places by necessity: the contract (which a node
// script can read) and TalkShowScene.jsx (which actually plays them). Two
// copies of a fact is how this project has been bitten before, so the drift is
// pinned here rather than trusted.
console.log("\nThe contract and the scene name the same clips:");
const sceneSource = await readFile(resolve("src/components/trade/TalkShowScene.jsx"), "utf8");
for (const [actor, character] of Object.entries(CHARACTERS)) {
  const declared = requiredClips(character);
  const absent = declared.filter((name) => !sceneSource.includes(`"${name}"`));
  check(`${actor}: every contract clip is in the scene`, absent, []);
}
// And the other way: a clip the scene plays that the contract does not know
// about would never be checked for in an export.
const sceneClips = [...sceneSource.matchAll(/"((?:barron|monk|connor)_[a-z0-9_]+)"/g)].map((m) => m[1]);
const known = new Set(
  Object.values(CHARACTERS).flatMap((c) => [...requiredClips(c), ...optionalClips(c)]),
);
const unknown = [...new Set(sceneClips)].filter((name) => !known.has(name));
check("every clip the scene plays is in the contract", unknown, []);
ok("and the scene really does name some clips (the regex still matches)", sceneClips.length > 0);

// ── The new intermission clip ─────────────────────────────────────────────
console.log("\nConnor's news intermission is declared as optional:");
check("it is listed as an optional clip", optionalClips(CHARACTERS.Connor), ["connor_news_intermission"]);
ok("it is not required, so an older export still passes", !requiredClips(CHARACTERS.Connor).includes("connor_news_intermission"));
ok(
  "and it is genuinely not in the set file, which is why it needs the new export",
  !clipNames(set).includes("connor_news_intermission"),
);
ok("GR80 has no outro, so nothing optional is expected of him", optionalClips(CHARACTERS.Monk).length === 0);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
