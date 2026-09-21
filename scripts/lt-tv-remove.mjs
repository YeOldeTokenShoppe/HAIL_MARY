#!/usr/bin/env node
// TAKE AN EPISODE OFF THE GUIDE, OR DELETE IT ALTOGETHER.
//
//   npm run lt:remove -- morality-01 --from-guide      # unlist it, keep the files
//   npm run lt:remove -- morality-01 --everything      # unlist it and delete them
//   npm run lt:remove -- morality-01 --everything --dry-run
//
// WHY THIS EXISTS. Adding an episode is a button; removing one was a hunt.
// An episode is spread over six paths and one import list, and deleting the
// obvious file leaves the others behind: the record goes, and the guide still
// imports it (a build error), or the guide entry goes and the working copy
// stays, so the next Record writes a second episode nobody asked for. Michelle
// asked for the button on 2026-09-21: "i also will need a delete button for if
// i want to remove a show from the line-up or re-record it."
//
// THE TWO STRENGTHS ARE DIFFERENT DECISIONS, which is why they are two flags
// and not a prompt.
//
//   --from-guide   The episode stops being listed and stops being playable.
//                  Everything it is made of stays on disk, so putting it back
//                  is "Put it on the guide" again. This is the one to use to
//                  pull an episode while you re-record it.
//
//   --everything   The above, and then the script, the recording, the pitch
//                  and the conversation about it. Nothing in here is in git —
//                  content/ is ignored — so this cannot be undone by a
//                  checkout. It is the one that needs the confirm.
//
// WHAT IT DOES NOT DO. It does not touch SitePal: the clips stay in the Audio
// Manager, which is outside the repo, and an episode deleted here is still
// uploaded there. It does not touch shows.json either — removing a CHANNEL is
// a different act from removing an episode, and the channel list is four lines
// anyone can read.

import { readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { SLATE_DIR, SLATE_INDEX, unregisterEpisode } from "./lt-tv-slate-record.mjs";
import { parseId, STAGING_DIR, AUDIO_DIR, PLANS_DIR } from "./lt-tv-rename.mjs";

export const ROOMS_DIR = "content/lt-tv/rooms";

/** Everything an episode is made of, in the order a person would list them. */
export function partsOf(id) {
  return {
    guide: [
      { path: join(SLATE_DIR, `${id}.json`), what: "the record the guide reads" },
    ],
    staging: [
      { path: join(STAGING_DIR, `${id}.json`), what: "the working record" },
      { path: join(STAGING_DIR, `${id}.txt`), what: "the screenplay" },
      { path: join(AUDIO_DIR, id), what: "the recorded audio" },
      { path: join(PLANS_DIR, `${id}.json`), what: "the pitch" },
      { path: join(PLANS_DIR, `${id}.txt`), what: "the pitch, as an outline" },
      { path: join(ROOMS_DIR, `${id}.json`), what: "the writers'-room conversation" },
    ],
  };
}

/**
 * What removing this episode would do, without doing any of it.
 *
 * Built as a whole first, the same as `planRename`, so that `--dry-run` prints
 * exactly what will happen and a refusal refuses everything rather than
 * leaving the guide importing a record that is no longer there.
 *
 * @returns {{ removes: {path: string, what: string}[],
 *             unregister: boolean,
 *             tracked: string[],
 *             problems: string[] }}
 */
export async function planRemove(id, { scope = "from-guide", root = process.cwd() } = {}) {
  const problems = [];
  if (!parseId(id)) problems.push(`"${id}" is not an episode id — expected <show>-<NN>, like morality-01.`);
  if (!["from-guide", "everything"].includes(scope)) {
    problems.push(`"${scope}" is not a strength — expected --from-guide or --everything.`);
  }
  if (problems.length) return { removes: [], unregister: false, tracked: [], problems };

  const parts = partsOf(id);
  const wanted = scope === "everything" ? [...parts.guide, ...parts.staging] : parts.guide;
  const removes = wanted.filter((p) => existsSync(join(root, p.path)));

  // The index imports the record by path, so it has to lose the line whether
  // or not the record was there to delete — an index that imports a missing
  // file is a build error, and that is the one failure this must not leave.
  const indexPath = join(root, SLATE_INDEX);
  let unregister = false;
  if (existsSync(indexPath)) {
    const source = await readFile(indexPath, "utf8");
    unregister = source.includes(`./episodes/${id}.json`);
    if (unregister && unregisterEpisode(source, id) === null) {
      problems.push(
        `${SLATE_INDEX} does not look the way this expects, so the import for ${id} has to come out by hand.`,
      );
    }
  }

  if (!removes.length && !unregister) {
    problems.push(`there is nothing here called ${id} — nothing to remove.`);
  }

  return {
    removes,
    unregister,
    // Everything under src/ is in git, and she works on one machine and pulls.
    // Saying which files those are is the difference between "it worked" and a
    // checkout that quietly disagrees with main.
    tracked: removes.filter((p) => p.path.startsWith("src/")).map((p) => p.path),
    problems,
  };
}

/** Apply a plan from `planRemove`. The index first, so the guide is never left importing a deleted record. */
export async function applyRemove(id, plan, { root = process.cwd() } = {}) {
  if (plan.unregister) {
    const indexPath = join(root, SLATE_INDEX);
    const next = unregisterEpisode(await readFile(indexPath, "utf8"), id);
    if (next) await writeFile(indexPath, next);
  }
  for (const part of plan.removes) await rm(join(root, part.path), { recursive: true, force: true });
  return plan.removes.length + (plan.unregister ? 1 : 0);
}

// ── running it ────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const scope = args.includes("--everything") ? "everything" : "from-guide";
  const [id] = args.filter((a) => !a.startsWith("--"));

  if (!id || (!args.includes("--everything") && !args.includes("--from-guide"))) {
    console.error("Usage: npm run lt:remove -- <episode id> (--from-guide | --everything) [--dry-run]");
    console.error("  --from-guide   unlist it, keep the script and the recording");
    console.error("  --everything   unlist it and delete everything it is made of");
    process.exit(2);
  }

  const plan = await planRemove(id, { scope });
  if (plan.problems.length) {
    console.error(`\nCannot remove ${id}:`);
    for (const p of plan.problems) console.error(`  ✗ ${p}`);
    console.error("");
    process.exit(1);
  }

  console.log(`\n${id} — ${scope === "everything" ? "deleting everything it is made of" : "off the guide, files kept"}\n`);
  if (plan.unregister) console.log(`  ${SLATE_INDEX.padEnd(46)}its import comes out`);
  for (const part of plan.removes) console.log(`  ${part.path.padEnd(46)}${part.what}`);

  if (dryRun) {
    console.log("\n--dry-run, so nothing was removed.\n");
    process.exit(0);
  }

  await applyRemove(id, plan);
  console.log(`\nDone. ${id} is no longer on the guide.`);
  if (scope === "from-guide") {
    console.log("Its script and recording are still here, so it can go back on with Put it on the guide.");
  }
  if (plan.tracked.length) {
    console.log("\nThese are files git tracks, so this checkout now differs from main:");
    for (const path of plan.tracked) console.log(`  ${path}`);
    console.log(`  ${SLATE_INDEX}`);
    console.log("Say so in the project and the same removal gets made on main, so your next pull is clean.");
  }
  console.log("\nThe clips are still in SitePal's Audio Manager — nothing here can reach them.\n");
}
