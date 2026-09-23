#!/usr/bin/env node
// Check the LT TV slate before it reaches the set.
//
// Reads every episode record in src/content/lt-tv/episodes, validates it the
// way TalkShowScene will, and prints the performance each one resolves to —
// the camera shots, the listener turns and the reaction beats that the record
// implies. Run it after adding an episode, so a bad line start or a cue
// pointing at a line that doesn't exist surfaces here rather than as a set
// that plays the wrong thing:
//
//   node scripts/lt-tv-check.mjs
//   node scripts/lt-tv-check.mjs morality-01     # one episode, in detail
//
// Exits non-zero if any record has a problem, so it can gate a deploy.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildEpisodeTimeline,
  episodeIsPlayable,
  formatRuntime,
  validateEpisode,
} from "../src/lib/ltTv/episodeTimeline.mjs";
import { CHARACTERS } from "../src/lib/ltTv/modelContract.mjs";
import { FACE_NAMES } from "../src/lib/ltTv/faces.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "src/content/lt-tv");
const EPISODES_DIR = path.join(CONTENT, "episodes");

// WHICH CUES EACH RIG CAN PERFORM — the one thing the set knows and a record
// doesn't. From the model contract, which is the only place it is written:
// this was a third hand-maintained copy asking to be kept in step with
// TalkShowScene.jsx, and a cue this list wrongly allows is a cue that does
// nothing on screen.
//
// Plus the face beats, which every character has because every character is a
// SitePal face (src/lib/ltTv/faces.mjs).
const REACTIONS = Object.fromEntries(
  Object.entries(CHARACTERS).map(([actor, c]) => [actor, [...Object.keys(c.reactions || {}), ...FACE_NAMES]]),
);

const only = process.argv[2];
const files = fs
  .readdirSync(EPISODES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();
const indexSource = fs.readFileSync(path.join(CONTENT, "index.js"), "utf8");
const shows = JSON.parse(fs.readFileSync(path.join(CONTENT, "shows.json"), "utf8")).shows;
const showIds = new Set(shows.map((s) => s.id));

let failed = 0;
const report = (id, problem) => {
  failed += 1;
  console.log(`  ✗ ${problem}`);
};

for (const file of files) {
  const record = JSON.parse(fs.readFileSync(path.join(EPISODES_DIR, file), "utf8"));
  if (only && record.id !== only) continue;

  const playable = episodeIsPlayable(record);
  const timeline = buildEpisodeTimeline(record, { reactionDurations: {} });
  console.log(
    `\n${file}  ${record.title || "(untitled)"}  ` +
      `[${playable ? formatRuntime(timeline.dialogueEnd) : "not recorded yet"}]`,
  );

  if (!record.id) report(file, "no id");
  if (record.id && `${record.id}.json` !== file) {
    report(record.id, `id "${record.id}" doesn't match the filename`);
  }
  if (!showIds.has(record.showId)) {
    report(record.id, `showId "${record.showId}" isn't in shows.json`);
  }
  // A record nobody imports is a record the site never shows.
  if (!indexSource.includes(`./episodes/${file}`)) {
    report(record.id, `not imported in index.js — add it to EPISODE_RECORDS`);
  }
  validateEpisode(record).forEach((problem) => report(record.id, problem));

  if (!playable) {
    console.log("  · slate entry only (no audio yet)");
    continue;
  }

  // Reactions have to exist on the rig, or the beat silently does nothing.
  (record.cues || []).forEach((cue, i) => {
    const known = REACTIONS[cue.actor];
    if (!known) report(record.id, `cues[${i}] names actor "${cue.actor}", who isn't on this set`);
    else if (!known.includes(cue.reaction)) {
      report(record.id, `cues[${i}]: ${cue.actor} has no "${cue.reaction}" clip or face`);
    }
    const line = record.lineStarts[cue.line];
    const next = record.lineStarts[cue.line + 1] ?? record.dialogueEnd;
    if (line !== undefined && line + cue.offset >= next) {
      report(record.id, `cues[${i}] starts after line ${cue.line} is over`);
    }
  });
  Object.entries(record.audio).forEach(([actor, clip]) => {
    if (!clip?.trim()) report(record.id, `${actor} has an empty clip name`);
  });

  const wides = timeline.shots.filter((s) => !s.subject).length;
  console.log(
    `  · ${record.lineStarts.length} lines, ${timeline.cues.length} reaction cues, ` +
      `${timeline.gazes.length} listener turns`,
  );
  console.log(
    `  · ${timeline.shots.length} camera shots (${wides} wide), lead-in ${timeline.leadIn}s`,
  );
  console.log(
    `  · SitePal clips: ${Object.entries(record.audio)
      .map(([actor, clip]) => `${actor} → "${clip}"`)
      .join(", ")}`,
  );
  if (only) {
    console.log("\n  line  start   speaker  shot      cues");
    record.lineStarts.forEach((start, line) => {
      const shot = [...timeline.shots].reverse().find((s) => s.at <= start + 0.3);
      const cues = timeline.cues
        .filter((c) => c.line === line)
        .map((c) => `${c.actor} ${c.reaction}`)
        .join(", ");
      console.log(
        `  ${String(line).padStart(4)}  ${String(start).padStart(6)}  ` +
          `${(record.speakers[line] || "—").padEnd(8)} ` +
          `${(shot?.subject || "wide").padEnd(9)} ${cues}`,
      );
    });
  }
}

console.log(
  failed === 0
    ? "\nSlate OK — every record is consistent with the set."
    : `\n${failed} problem(s) to fix before these go to air.`,
);
process.exit(failed === 0 ? 0 : 1);
