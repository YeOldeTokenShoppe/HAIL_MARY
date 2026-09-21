#!/usr/bin/env node
// MOVE A STAGED EPISODE TO A NEW ID.
//
//   npm run lt:rename -- roundtable-02 morality-01
//   npm run lt:rename -- roundtable-02 morality-01 --dry-run
//
// WHY THIS EXISTS. An episode's id is `<show>-<NN>`, and it is not a label —
// it is the path. The staging record is `content/lt-tv/episodes/<id>.json`,
// its screenplay is `<id>.txt`, and every WAV the audio build writes lands in
// `content/lt-tv/audio/<id>/`. So moving an episode to another show, or
// renumbering it, means moving four things at once and rewriting three fields
// inside the record. Miss one and nothing errors: the next Record or Split
// writes a SECOND episode under the old id, beside the one you meant to move.
//
// That is exactly what happened to The Wealth Effect. It was recorded as
// roundtable-02, then moved to Markets & Morality as morality-01 — but only
// the committed slate record moved, because everything under content/ is
// gitignored and lives on one machine. This script is the other half.
//
// WHAT IT DOES NOT TOUCH: the SitePal clip names inside the record. A record
// names whichever clips EXIST in the account library, and those were uploaded
// under the old id. Renaming them here would point the set at clips that are
// not there. The naming convention is for a NEW upload; an episode that has
// already aired keeps the names it aired under. See docs/lt-tv.md.
//
// It also does not touch src/content/lt-tv/ — the committed slate. That is a
// git operation on tracked files, and it is done in a commit, not by a script
// that runs on one laptop.
import { readFile, writeFile, rename, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const STAGING_DIR = "content/lt-tv/episodes";
export const AUDIO_DIR = "content/lt-tv/audio";
export const PLANS_DIR = "content/lt-tv/plans";

/** An id is `<show>-<NN>`; anything else would not name a file the tools look for. */
export function parseId(id) {
  const m = /^([a-z][a-z0-9-]*?)-(\d{2})$/.exec(String(id || ""));
  if (!m) return null;
  return { show: m[1], number: m[2] };
}

/**
 * What moving `from` to `to` would do, without doing any of it.
 *
 * Separated from the doing so the plan can be printed, tested, and refused as
 * a whole: a half-applied rename is worse than none, because the record and
 * its audio would then disagree about which episode they belong to.
 *
 * @returns {{ moves: {from: string, to: string, what: string}[],
 *             fields: Record<string, string>,
 *             problems: string[] }}
 */
export async function planRename(fromId, toId, { root = process.cwd() } = {}) {
  const problems = [];
  const moves = [];

  const parsed = parseId(toId);
  if (!parseId(fromId)) problems.push(`"${fromId}" is not an episode id — expected <show>-<NN>, like roundtable-02.`);
  if (!parsed) problems.push(`"${toId}" is not an episode id — expected <show>-<NN>, like morality-01.`);
  if (fromId === toId) problems.push("the two ids are the same, so there is nothing to move.");
  if (problems.length) return { moves, fields: {}, problems };

  const at = (...parts) => join(root, ...parts);
  const record = at(STAGING_DIR, `${fromId}.json`);
  if (!existsSync(record)) {
    problems.push(
      `there is no staged record at ${STAGING_DIR}/${fromId}.json.\n` +
        `  Staged right now: ${(await staged(root)).join(", ") || "(nothing)"}`,
    );
    return { moves, fields: {}, problems };
  }

  // Refuse rather than merge. Two records under one id is the failure this
  // script exists to prevent, so it must not be able to cause one.
  for (const [path, what] of [
    [at(STAGING_DIR, `${toId}.json`), "a record"],
    [at(STAGING_DIR, `${toId}.txt`), "a screenplay"],
    [at(AUDIO_DIR, toId), "an audio folder"],
    [at(PLANS_DIR, `${toId}.json`), "a plan"],
  ]) {
    if (existsSync(path)) problems.push(`${toId} already has ${what} at ${path.slice(root.length + 1)} — move or delete it first.`);
  }
  if (problems.length) return { moves, fields: {}, problems };

  moves.push({ from: `${STAGING_DIR}/${fromId}.json`, to: `${STAGING_DIR}/${toId}.json`, what: "the working record" });
  if (existsSync(at(STAGING_DIR, `${fromId}.txt`)))
    moves.push({ from: `${STAGING_DIR}/${fromId}.txt`, to: `${STAGING_DIR}/${toId}.txt`, what: "the screenplay" });
  if (existsSync(at(AUDIO_DIR, fromId)))
    moves.push({ from: `${AUDIO_DIR}/${fromId}`, to: `${AUDIO_DIR}/${toId}`, what: "the recorded audio" });
  // Nothing reads a plan — it is what `--plan-only` leaves behind to look at.
  // It moves anyway, so the staging area has no file named for an episode
  // that is not there any more.
  if (existsSync(at(PLANS_DIR, `${fromId}.json`)))
    moves.push({ from: `${PLANS_DIR}/${fromId}.json`, to: `${PLANS_DIR}/${toId}.json`, what: "the argument plan" });

  // The three fields that make the id, and nothing else. `slateId()` is
  // `${show}-${number}`, so these three are what the next Split or Slate run
  // reads to decide which file it writes.
  return {
    moves,
    fields: { id: toId, show: parsed.show, number: parsed.number },
    problems,
  };
}

async function staged(root) {
  try {
    return (await readdir(join(root, STAGING_DIR))).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

/** Apply a plan from `planRename`. Moves first, then the fields, so a failed move leaves the record self-consistent. */
export async function applyRename(plan, { root = process.cwd() } = {}) {
  for (const move of plan.moves) await rename(join(root, move.from), join(root, move.to));

  const recordPath = join(root, plan.moves[0].to);
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  for (const [key, value] of Object.entries(plan.fields)) record[key] = value;
  await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
  return recordPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [fromId, toId] = args.filter((a) => !a.startsWith("--"));

  if (!fromId || !toId) {
    console.error("Usage: npm run lt:rename -- <from id> <to id> [--dry-run]");
    console.error("  e.g. npm run lt:rename -- roundtable-02 morality-01");
    process.exit(2);
  }

  const plan = await planRename(fromId, toId);
  if (plan.problems.length) {
    console.error(`\nCannot rename ${fromId} to ${toId}:`);
    for (const p of plan.problems) console.error(`  ✗ ${p}`);
    console.error("");
    process.exit(1);
  }

  console.log(`\n${fromId} → ${toId}\n`);
  for (const move of plan.moves) console.log(`  ${move.to.padEnd(46)}${move.what}`);
  console.log(`\n  and in the record: ${Object.entries(plan.fields).map(([k, v]) => `${k} = "${v}"`).join(", ")}`);

  if (dryRun) {
    console.log("\n--dry-run, so nothing was moved.\n");
    process.exit(0);
  }

  const path = await applyRename(plan);
  console.log(`\nDone. ${path.replace(`${process.cwd()}/`, "")} is now ${toId}.`);
  console.log("The SitePal clip names are unchanged, which is correct — they were uploaded under the old id.\n");
}
