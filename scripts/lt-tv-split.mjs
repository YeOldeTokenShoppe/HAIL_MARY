#!/usr/bin/env node
// STEP 4 — SPLIT THE MASTER INTO THE TWO TRACKS SITEPAL PLAYS.
//
//   node scripts/lt-tv-split.mjs roundtable-02
//
// Recording produces ONE file with both voices on it. SitePal plays one clip
// per character, so the master has to become two: each one the full length of
// the episode, carrying that character's lines and silence everywhere else.
// That is what makes the two play in sync — they are the same timeline twice,
// not two halves to be lined up.
//
// The work itself is `elevenlabs-dialogue-test/process_dialogue.py`, which
// already existed, is already proven, and is the one step here that needs
// ffmpeg. This wrapper exists so that the terminal and the studio button run
// the same thing: it turns an episode id into the three paths that script
// wants, and then says what to upload and under which name, which is the
// question the run leaves you with.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";

const AUDIO_DIR = "content/lt-tv/audio";
const EPISODE_DIR = "content/lt-tv/episodes";
const PROCESSOR = "elevenlabs-dialogue-test/process_dialogue.py";

/** The command, built from an id alone, so the button and the terminal agree. */
export function splitCommand(id) {
  const dir = join(AUDIO_DIR, id);
  return [
    "python3",
    [
      PROCESSOR,
      "--master", join(dir, "master-dialogue.wav"),
      "--segments", join(dir, "voice-segments.json"),
      "--show", id.startsWith("news") ? "news" : "roundtable",
      "--episode-id", id,
      dir,
    ],
  ];
}

/**
 * Which file goes to which character, under which SitePal clip name.
 *
 * The record already knows both halves of this: `processorKey` is what the
 * processor names its output after, and `sitepalAudio` is the name the runtime
 * will ask SitePal for. An upload under any other name plays nothing, and the
 * failure is silent, so the pairing is printed rather than remembered.
 */
export function uploadPlan(episode, id) {
  return Object.values(episode.cast ?? {}).map((member) => ({
    who: member.displayName,
    file: join(AUDIO_DIR, id, `${member.processorKey}-sitepal-balanced.wav`),
    clip: member.sitepalAudio,
  }));
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: node scripts/lt-tv-split.mjs <episode id>");
    process.exit(2);
  }

  const recordPath = resolve(EPISODE_DIR, `${id}.json`);
  if (!existsSync(recordPath)) {
    console.error(`No working copy of ${id} here. Record it first, or re-run the script step.`);
    process.exit(1);
  }
  const master = resolve(AUDIO_DIR, id, "master-dialogue.wav");
  if (!existsSync(master)) {
    console.error(`${id} has no master yet — record it first.`);
    console.error(`  Looked for ${master}`);
    process.exit(1);
  }

  const [command, args] = splitCommand(id);
  const code = await new Promise((done) => {
    spawn(command, args, { stdio: "inherit" }).on("close", done).on("error", (err) => {
      console.error(
        err.code === "ENOENT"
          ? `${command} is not installed. This step needs python3 and ffmpeg.`
          : err.message,
      );
      done(1);
    });
  });
  if (code !== 0) process.exit(code);

  const episode = JSON.parse(await readFile(recordPath, "utf8"));
  const plan = uploadPlan(episode, id);
  if (!plan.length) return;

  console.log("\nUpload these two to the SitePal Audio Manager, named exactly:\n");
  for (const row of plan) {
    console.log(`  ${row.who}`);
    console.log(`    file  ${row.file}`);
    console.log(`    name  ${row.clip}\n`);
  }
  console.log("Both are the full length of the episode; that is what keeps them in sync.");
  console.log("The name has to match — the runtime asks SitePal for a clip by name, and a");
  console.log("wrong one plays nothing rather than failing.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
