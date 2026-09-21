// Tests for taking an episode off the guide, or deleting it, with:
//
//   node scripts/lt-tv-remove.test.mjs
//
// The failure being guarded is a build error. The guide is a module that
// IMPORTS each record by path, so deleting the record without taking its
// import out does not degrade — the next build stops. Everything here is
// about those two halves staying together, and about the weaker strength
// really being weaker: "take it off the guide" must leave the script and the
// recording exactly where they were, because the reason to press it is that
// you are about to record the episode again.

import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { planRemove, applyRemove, partsOf, ROOMS_DIR } from "./lt-tv-remove.mjs";
import { SLATE_DIR, SLATE_INDEX, registerEpisode, unregisterEpisode } from "./lt-tv-slate-record.mjs";
import { STAGING_DIR, AUDIO_DIR, PLANS_DIR } from "./lt-tv-rename.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const INDEX = `import showsFile from "./shows.json";
import news01 from "./episodes/news-01.json";
import morality01 from "./episodes/morality-01.json";

const EPISODE_RECORDS = [
  news01,
  morality01,
];
`;

/** A repo with one episode in every place an episode can be. */
async function fixture({ id = "morality-01", onGuide = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), "lt-remove-"));
  for (const dir of [SLATE_DIR, STAGING_DIR, PLANS_DIR, ROOMS_DIR, join(AUDIO_DIR, id)]) {
    await mkdir(join(root, dir), { recursive: true });
  }
  if (onGuide) await writeFile(join(root, SLATE_DIR, `${id}.json`), '{"id":"morality-01"}');
  await writeFile(join(root, SLATE_INDEX), INDEX);
  await writeFile(join(root, STAGING_DIR, `${id}.json`), '{"id":"morality-01"}');
  await writeFile(join(root, STAGING_DIR, `${id}.txt`), "0  CONNOR  hello\n");
  await writeFile(join(root, PLANS_DIR, `${id}.json`), '{"question":"?"}');
  await writeFile(join(root, PLANS_DIR, `${id}.txt`), "PITCH\n");
  await writeFile(join(root, ROOMS_DIR, `${id}.json`), "[]");
  await writeFile(join(root, AUDIO_DIR, id, "master-dialogue.wav"), "RIFF");
  return root;
}

const here = (root, path) => existsSync(join(root, path));

console.log("\nWhat an episode is made of:");
{
  const parts = partsOf("morality-01");
  check("one file the guide reads", parts.guide.length, 1);
  ok("the working record and the screenplay", parts.staging.some((p) => p.path.endsWith("episodes/morality-01.txt")));
  ok("the recording", parts.staging.some((p) => p.path === `${AUDIO_DIR}/morality-01`));
  ok("the pitch, both halves", parts.staging.filter((p) => p.path.includes("plans/")).length === 2);
  ok("and the conversation about it", parts.staging.some((p) => p.path.includes("rooms/")));
}

console.log("\nOff the guide, keeping the files:");
{
  const root = await fixture();
  const plan = await planRemove("morality-01", { scope: "from-guide", root });
  check("nothing is refused", plan.problems, []);
  check("one file goes", plan.removes.map((p) => p.path), [`${SLATE_DIR}/morality-01.json`]);
  ok("and the import comes out", plan.unregister);
  ok("it says the change is one git tracks", plan.tracked.length === 1);

  await applyRemove("morality-01", plan, { root });
  ok("the guide's record is gone", !here(root, `${SLATE_DIR}/morality-01.json`));
  const index = await readFile(join(root, SLATE_INDEX), "utf8");
  ok("the index no longer imports it", !index.includes("morality-01.json"));
  ok("nor lists it", !/^\s*morality01,$/m.test(index));
  ok("and still has the other episode", index.includes("news-01.json") && /^\s*news01,$/m.test(index));

  // The whole point of the weaker strength: this is what you press when you
  // are about to record it again, so the script has to survive it.
  ok("the screenplay stays", here(root, `${STAGING_DIR}/morality-01.txt`));
  ok("the working record stays", here(root, `${STAGING_DIR}/morality-01.json`));
  ok("the recording stays", here(root, `${AUDIO_DIR}/morality-01/master-dialogue.wav`));
  ok("and so does the pitch", here(root, `${PLANS_DIR}/morality-01.json`));
}

console.log("\nEverything:");
{
  const root = await fixture();
  const plan = await planRemove("morality-01", { scope: "everything", root });
  check("nothing is refused", plan.problems, []);
  await applyRemove("morality-01", plan, { root });

  for (const [what, path] of [
    ["the guide's record", `${SLATE_DIR}/morality-01.json`],
    ["the working record", `${STAGING_DIR}/morality-01.json`],
    ["the screenplay", `${STAGING_DIR}/morality-01.txt`],
    ["the recording", `${AUDIO_DIR}/morality-01`],
    ["the pitch", `${PLANS_DIR}/morality-01.json`],
    ["the outline", `${PLANS_DIR}/morality-01.txt`],
    ["the conversation", `${ROOMS_DIR}/morality-01.json`],
  ]) {
    ok(`${what} is gone`, !here(root, path));
  }
  ok("the other episode is untouched", (await readFile(join(root, SLATE_INDEX), "utf8")).includes("news-01.json"));
}

console.log("\nAn episode that was never on the guide:");
{
  const root = await fixture({ id: "morality-01", onGuide: false });
  // The record is not there but the index still imports it, which is the
  // broken state this has to be able to repair rather than refuse.
  const plan = await planRemove("morality-01", { scope: "from-guide", root });
  check("nothing is refused", plan.problems, []);
  check("there is no file to delete", plan.removes, []);
  ok("but the import still comes out", plan.unregister);
  await applyRemove("morality-01", plan, { root });
  ok("and it does", !(await readFile(join(root, SLATE_INDEX), "utf8")).includes("morality-01.json"));
}

console.log("\nWhat it refuses:");
{
  const root = await fixture();
  const bad = await planRemove("../../etc/passwd", { scope: "everything", root });
  ok("an id that is a path", bad.problems.some((p) => p.includes("not an episode id")));
  check("and takes nothing with it", bad.removes, []);

  const nothing = await planRemove("news-09", { scope: "everything", root });
  ok("an episode that is not here", nothing.problems.some((p) => p.includes("nothing here")));

  const strength = await planRemove("morality-01", { scope: "sort-of", root });
  ok("a strength it does not have", strength.problems.some((p) => p.includes("not a strength")));
}

console.log("\nThe index edit, on its own:");
{
  ok("registering and unregistering are inverses", unregisterEpisode(registerEpisode(INDEX, "morality-02"), "morality-02") === INDEX);
  check("an episode that was never there changes nothing", unregisterEpisode(INDEX, "news-09"), INDEX);
  // A file it cannot read confidently is a file it must not edit: the guide is
  // checked-in code, and a half-right edit to it is a build that fails.
  check("a file it does not recognise is left alone", unregisterEpisode('import x from "./episodes/morality-01.json";', "morality-01"), null);
}

console.log(failures ? `\n${failures} failure(s)\n` : "\nAll good.\n");
process.exit(failures ? 1 : 0);
