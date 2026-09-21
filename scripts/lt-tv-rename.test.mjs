// Tests for moving a staged episode to a new id, with:
//
//   node scripts/lt-tv-rename.test.mjs
//
// The thing being guarded is the half-applied rename. If the record moves and
// the audio folder does not, nothing errors — the next Record run simply
// writes into a folder that no longer matches the record, and the episode is
// quietly in two places. So every case here is about the plan being all or
// nothing, and about refusing rather than merging.

import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { planRename, applyRename, parseId, STAGING_DIR, AUDIO_DIR, PLANS_DIR } from "./lt-tv-rename.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

/** A staging area with one episode in it, shaped like the real one. */
async function fixture({ id = "roundtable-02", script = true, audio = true, plan = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), "lt-rename-"));
  await mkdir(join(root, STAGING_DIR), { recursive: true });
  await writeFile(
    join(root, STAGING_DIR, `${id}.json`),
    JSON.stringify({
      id,
      show: id.split("-")[0],
      number: id.split("-")[1],
      title: "The Wealth Effect",
      // The clip names are the point of the "does not touch" test below.
      audio: { Connor: "lttv_rt_ep02_connor", Monk: "lttv_rt_ep02_gr80" },
      segments: [{ id: "the-question", lines: [{ n: 0, actor: "Connor", text: "hello" }] }],
    }, null, 2),
  );
  if (script) await writeFile(join(root, STAGING_DIR, `${id}.txt`), "0  CONNOR  hello\n");
  if (audio) {
    await mkdir(join(root, AUDIO_DIR, id), { recursive: true });
    await writeFile(join(root, AUDIO_DIR, id, "master-dialogue.wav"), "RIFF");
  }
  if (plan) {
    await mkdir(join(root, PLANS_DIR), { recursive: true });
    await writeFile(join(root, PLANS_DIR, `${id}.json`), '{"question":"?"}');
  }
  return root;
}

console.log("\nAn id is a path, so it has to look like one:");
check("a real id parses into its two halves", parseId("morality-01"), { show: "morality", number: "01" });
ok("a single-digit number is not an id", !parseId("morality-1"));
ok("nor is a bare show name", !parseId("morality"));
ok("nor a path pretending to be one", !parseId("../../etc/passwd"));
ok("nor an empty string", !parseId(""));

console.log("\nThe whole episode moves, not just the record:");
{
  const root = await fixture();
  const plan = await planRename("roundtable-02", "morality-01", { root });
  check("nothing is wrong with it", plan.problems, []);
  check("every piece of the episode is in the plan", plan.moves.map((m) => m.what),
    ["the working record", "the screenplay", "the recorded audio", "the argument plan"]);
  check("and the three fields that make the id", plan.fields,
    { id: "morality-01", show: "morality", number: "01" });

  await applyRename(plan, { root });
  ok("the record is at its new name", existsSync(join(root, STAGING_DIR, "morality-01.json")));
  ok("the screenplay too", existsSync(join(root, STAGING_DIR, "morality-01.txt")));
  ok("and the recorded audio came with it",
    existsSync(join(root, AUDIO_DIR, "morality-01", "master-dialogue.wav")));
  ok("nothing is left behind under the old id",
    !existsSync(join(root, STAGING_DIR, "roundtable-02.json"))
      && !existsSync(join(root, AUDIO_DIR, "roundtable-02"))
      && !existsSync(join(root, PLANS_DIR, "roundtable-02.json")));

  const moved = JSON.parse(await readFile(join(root, STAGING_DIR, "morality-01.json"), "utf8"));
  check("the record calls itself by the new id", [moved.id, moved.show, moved.number], ["morality-01", "morality", "01"]);
  check("its title is untouched", moved.title, "The Wealth Effect");
  // The reason this script does not "finish the rename": the clips are in
  // SitePal under the names they were uploaded with, and the record names
  // whichever clips exist. Rewriting these would point the set at nothing.
  check("and the SitePal clip names are deliberately left alone",
    moved.audio, { Connor: "lttv_rt_ep02_connor", Monk: "lttv_rt_ep02_gr80" });
}

console.log("\nAn episode that was never recorded moves just the same:");
{
  const root = await fixture({ script: false, audio: false, plan: false });
  const plan = await planRename("roundtable-02", "morality-01", { root });
  check("only the record is there to move", plan.moves.map((m) => m.what), ["the working record"]);
  await applyRename(plan, { root });
  ok("and it moved", existsSync(join(root, STAGING_DIR, "morality-01.json")));
}

console.log("\nIt refuses rather than merging, which is the whole point:");
{
  const root = await fixture();
  await writeFile(join(root, STAGING_DIR, "morality-01.json"), "{}");
  const plan = await planRename("roundtable-02", "morality-01", { root });
  ok("a record already under the new id stops it", plan.problems.length === 1);
  ok("and says which file is in the way", plan.problems[0].includes("morality-01.json"));
  check("with nothing planned", plan.moves, []);
  const before = JSON.parse(await readFile(join(root, STAGING_DIR, "roundtable-02.json"), "utf8"));
  check("the episode is untouched", before.id, "roundtable-02");
}
{
  // The nastier version: the record is free but the audio folder is not, so a
  // naive rename would tip six WAVs into a folder that belongs to another
  // episode and the loss would not show up until playback.
  const root = await fixture();
  await mkdir(join(root, AUDIO_DIR, "morality-01"), { recursive: true });
  const plan = await planRename("roundtable-02", "morality-01", { root });
  ok("an audio folder already under the new id stops it too", plan.problems.length === 1);
  ok("naming the folder", plan.problems[0].includes("audio/morality-01"));
}
{
  const root = await fixture();
  const plan = await planRename("roundtable-09", "morality-01", { root });
  ok("an episode that is not staged stops it", plan.problems.length === 1);
  ok("and the message lists what IS staged", plan.problems[0].includes("roundtable-02"));
}
{
  const root = await fixture();
  ok("renaming an episode to itself is refused",
    (await planRename("roundtable-02", "roundtable-02", { root })).problems.length === 1);
  ok("and so is a target that is not an id",
    (await planRename("roundtable-02", "morality", { root })).problems.length === 1);
  // Nothing here should be able to reach outside the staging directory.
  const escape = await planRename("roundtable-02", "../../../tmp/x-01", { root });
  ok("a target that climbs out of the staging area is not an id", escape.problems.length === 1);
  check("so it plans nothing", escape.moves, []);
  check("and the staging area is as it was",
    (await readdir(join(root, STAGING_DIR))).sort(), ["roundtable-02.json", "roundtable-02.txt"]);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
