#!/usr/bin/env node
// STEP 4 — SPLIT THE MASTER INTO THE CLIPS SITEPAL PLAYS.
//
//   node scripts/lt-tv-split.mjs roundtable-02
//
// Recording produces ONE file with both voices on it. This turns it into the
// clips the set actually plays, and there are two reasons there is more than
// one.
//
// PER CHARACTER. SitePal plays one clip per avatar, so the master becomes two
// tracks, each the full length of the episode, carrying that character's lines
// and silence everywhere else. That is what keeps them in sync: they are the
// same timeline twice, not two halves to be lined up. That work is
// `elevenlabs-dialogue-test/process_dialogue.py`, which already existed and is
// already proven, and is the one step here that needs ffmpeg.
//
// PER SECTION. SitePal will not play a clip longer than 90 seconds, so each of
// those tracks is then cut into sections at the same instants, in the pauses
// between lines rather than inside them. See lt-tv-sections.mjs for how a cut
// point is chosen and why it is chosen rather than computed. An episode short
// enough to be one clip is cut into one section and comes out exactly as it did
// before any of this existed.
//
// This step also reports what each cut had to land in, because a join is heard
// and a file list is not, and it honours `# cut` marks from the screenplay:
// the person who listened to the episode outranks the reported line times.
//
// Each section is written under the NAME IT WILL HAVE IN SITEPAL, so uploading
// is a matter of dragging files in and not of reading a table.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";

import {
  planSections,
  sectionProblems,
  forcedJoins,
  silenceCommand,
  parseSilences,
  silenceSummary,
  MIN_JOIN_SILENCE,
  SILENCE_DB,
  TARGET_SECTION_SECONDS,
} from "./lt-tv-sections.mjs";
import { sitepalClipName } from "./lt-tv-format.mjs";
import { readCutMarks } from "./lt-tv-edit.mjs";

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
 * The record knows both halves of this: `processorKey` is what the processor
 * names its output after, and the clip name is generated from the show and
 * episode number rather than invented, so what the record asks SitePal for and
 * what was uploaded cannot drift. An upload under any other name plays
 * nothing, and the failure is silent, so the pairing is printed rather than
 * remembered.
 *
 * @param sections  from planSections; one entry means no `_s` suffix anywhere
 */
export function uploadPlan(episode, id, sections = [{ startsAt: 0 }]) {
  return Object.entries(episode.cast ?? {}).flatMap(([actor, member]) =>
    sections.map((section, i) => {
      const clip = sitepalClipName(episode.show, episode.number, actor, i + 1);
      return {
        who: member.displayName,
        actor,
        section: i + 1,
        startsAt: section.startsAt,
        source: join(AUDIO_DIR, id, `${member.processorKey}-sitepal-balanced.wav`),
        file: join(AUDIO_DIR, id, `${clip}.wav`),
        clip,
      };
    }),
  );
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * One line of the cutting report, as it is printed.
 *
 * What each cut had to land in, because that is what a join sounds like: a
 * boundary in a real pause is heard as a breath, one in 0.02s of nothing is
 * heard as a fault, and the two look identical in a list of files. Exported so
 * the thing she actually reads is checked rather than assumed.
 */
export function sectionLine(section, index) {
  const length = section.endsAt - section.startsAt;
  const cut =
    section.silenceAfter === null
      ? ""
      : section.forcedJoin
        ? `  cut with only ${section.silenceAfter.toFixed(2)}s of silence`
        : `  cut in ${section.silenceAfter.toFixed(2)}s of silence`;
  return (
    `  section ${index + 1}  ${fmt(section.startsAt)} – ${fmt(section.endsAt)}  ` +
    `(${length.toFixed(0)}s, lines ${section.firstLine}–${section.lastLine})${cut}` +
    `${section.manual ? " (your cut)" : ""}`
  );
}

/**
 * What the pauses in this episode actually are, in one line.
 *
 * These are measured from the master rather than read off the line times,
 * which tile and so report no pauses at all. It is the measurement that says
 * whether cutting anywhere can work: if the episode really does run without
 * pauses, no choice of boundary is a good one and the answer is in how the
 * lines were written.
 */
export function pauseLine(silences) {
  if (!silences) {
    return (
      `  No pauses measured — ffmpeg found nothing quieter than ${SILENCE_DB}dB.\n` +
      "  Cuts fall back to the reported line times, which are not where the\n" +
      "  pauses are, so expect the joins to be heard."
    );
  }
  return (
    `  Pauses in the audio: ${silences.count} found, median ${silences.median.toFixed(2)}s, ` +
    `shortest ${silences.smallest.toFixed(2)}s, longest ${silences.largest.toFixed(2)}s. ` +
    `${silences.usable} are wide enough to cut in (${MIN_JOIN_SILENCE}s or more).`
  );
}

/**
 * How to move a join, or which moves were honoured.
 *
 * The line numbers in the report are the screenplay's own, so a join can be
 * moved by hand without anyone working out which line 2:40 falls in.
 */
export function cutHint(cuts) {
  return cuts.length
    ? `  Honoured ${cuts.length} cut mark(s) from the screenplay: ${cuts.join(", ")}.`
    : "  To put a join somewhere else, write `# cut` on its own line in the\n" +
        "  screenplay where you want it and split again.";
}

/**
 * Run a command and resolve what it wrote to stderr.
 *
 * silencedetect reports there rather than on stdout, and ffmpeg's exit code
 * says nothing about whether it found anything, so this resolves the text and
 * leaves reading it to the caller. A missing ffmpeg resolves empty, and the
 * cutting falls back to the reported line times.
 */
function capture(command, args) {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let text = "";
    child.stderr.on("data", (chunk) => {
      text += chunk;
    });
    child.on("close", () => done(text));
    child.on("error", () => done(""));
  });
}

/** Run a command, inheriting its output, and resolve its exit code. */
function run(command, args, { quiet = false } = {}) {
  return new Promise((done) => {
    spawn(command, args, { stdio: quiet ? "ignore" : "inherit" })
      .on("close", done)
      .on("error", (err) => {
        console.error(
          err.code === "ENOENT"
            ? `${command} is not installed. This step needs python3 and ffmpeg.`
            : err.message,
        );
        done(1);
      });
  });
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

  const episode = JSON.parse(await readFile(recordPath, "utf8"));
  const timing = episode.timing ?? {};
  if (!Array.isArray(timing.lineStarts) || !timing.lineStarts.length) {
    console.error(`${id} has a master but no timing. Record it again.`);
    process.exit(1);
  }

  const [command, args] = splitCommand(id);
  const code = await run(command, args);
  if (code !== 0) process.exit(code);

  // ── into sections ────────────────────────────────────────────────────────
  // The screenplay gets the last word on where a join goes. Read here rather
  // than from the record because a mark is not an edit: it changes nothing
  // about the words, so applying it would be refused on a recorded episode.
  const scriptPath = resolve(EPISODE_DIR, `${id}.txt`);
  const cuts = existsSync(scriptPath) ? readCutMarks(await readFile(scriptPath, "utf8")) : [];

  // WHERE IT IS ACTUALLY QUIET. The reported line times tile — one line's end
  // is the next one's start — so they say nothing about where the pauses are.
  // Silence in the MASTER means neither voice is speaking, which is the
  // condition a join needs, so that is what the cut points are chosen from.
  const [silenceCmd, silenceArgs] = silenceCommand(master);
  const silences = parseSilences(await capture(silenceCmd, silenceArgs));

  const sections = planSections(
    timing.lineStarts,
    timing.lineEnds,
    timing.durationSeconds,
    TARGET_SECTION_SECONDS,
    { cuts, silences },
  );
  const problems = sectionProblems(sections);
  if (problems.length) {
    console.error("\nThis episode cannot be cut to fit SitePal:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  const plan = uploadPlan(episode, id, sections);
  const length = (s) => s.endsAt - s.startsAt;

  console.log(
    sections.length === 1
      ? `\nOne clip per character — ${length(sections[0]).toFixed(0)}s, inside SitePal's limit.\n`
      : `\nCutting into ${sections.length} sections, because SitePal will not play a clip ` +
          `over 90 seconds:\n`,
  );
  if (sections.length > 1) {
    for (const [i, s] of sections.entries()) console.log(sectionLine(s, i));
    console.log("");

    const pauses = pauseLine(silenceSummary(silences));
    console.log(`${pauses}\n`);

    const rough = forcedJoins(sections);
    if (rough.length) {
      console.error("These joins had no pause to land in:");
      for (const line of rough) console.error(`  ${line}`);
      console.error(
        "\nThe episode still plays and no audio is missing, but those joins will be\n" +
          "heard. If most pauses above are near zero it is the recording, not the cut:\n" +
          "the lines were written to run straight into each other.\n",
      );
    }

    console.log(`${cutHint(cuts)}\n`);
  }

  for (const row of plan) {
    const section = sections[row.section - 1];
    const cut = await run("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", row.source,
      "-ss", String(section.startsAt),
      "-to", String(section.endsAt),
      "-c:a", "pcm_s16le",
      row.file,
    ]);
    if (cut !== 0) {
      console.error(`Could not cut ${row.file}.`);
      process.exit(cut);
    }
  }

  // The record learns the cut points, so the set knows when to move on. Written
  // here rather than guessed there: the boundaries are a property of the audio
  // that exists, not something to recompute from the words.
  episode.timing = { ...timing, sections: sections.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })) };
  await writeFile(recordPath, JSON.stringify(episode, null, 2) + "\n");

  console.log("Upload these to the SitePal Audio Manager. Each file is named for the clip");
  console.log("it becomes, so the name to type is the filename without .wav:\n");
  for (const row of plan) {
    console.log(`  ${row.clip}`);
    console.log(`    ${row.file}\n`);
  }
  if (sections.length > 1) {
    console.log("Upload all of them. The set plays each character's sections in order, and a");
    console.log("missing one stops the episode where it should have carried on.\n");
  }
  // The end of the chain, so it hands over the last step. Re-running the script
  // step, which this used to say, rebuilds the episode from scratch and throws
  // away both the edits and the timing — including the section cuts just
  // written above.
  console.log("Then put the episode on the guide:");
  console.log(`  npm run lt:slate -- ${id}`);
  console.log("Not the generator — that would rebuild the episode and discard your edits,");
  console.log("the recorded timing, and the section boundaries above.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
