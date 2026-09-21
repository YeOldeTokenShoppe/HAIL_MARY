#!/usr/bin/env node
// STEP 4 — CUT THE TRACKS INTO THE CLIPS SITEPAL PLAYS.
//
//   node scripts/lt-tv-split.mjs morality-02
//
// PER CHARACTER. SitePal plays one clip per avatar, each the full length of
// the episode, carrying that character's lines and silence everywhere else.
// That is what keeps them in sync: they are the same timeline twice, not two
// halves to be lined up. Since 2026-09-21 the recording step writes those two
// tracks itself — every line is rendered alone, in its own voice, and laid out
// by bytes — so there is nothing here to cut apart, and this step reads
// `render.json` to know that. A master recorded the older way, with both
// voices in one file, is still split by `elevenlabs-dialogue-test/
// process_dialogue.py`, which needs ffmpeg; that path exists for archived
// recordings and is not how new episodes are made.
//
// PER SECTION. SitePal will not play a clip longer than 90 seconds, so each
// track is cut into sections at the same instants, in the pauses between
// lines rather than inside them. See lt-tv-sections.mjs for how a cut point is
// chosen. For a per-line render every pause is one the recording step placed,
// so the cutter is handed those rather than measuring anything, and the cut
// itself is byte arithmetic on the WAV. An episode short enough to be one clip
// is cut into one section and comes out exactly as it did before any of this
// existed.
//
// This step also reports what each cut had to land in, because a join is heard
// and a file list is not, and it honours `# cut` marks from the screenplay:
// the person who listened to the episode outranks the timings.
//
// Each section is written under the NAME IT WILL HAVE IN SITEPAL, so uploading
// is a matter of dragging files in and not of reading a table.

import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, join, basename } from "node:path";

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
import { sitepalClipName, SHOW_CLIP_SLUGS } from "./lt-tv-format.mjs";
import { readCutMarks } from "./lt-tv-edit.mjs";

const AUDIO_DIR = "content/lt-tv/audio";
const EPISODE_DIR = "content/lt-tv/episodes";
const PROCESSOR = "elevenlabs-dialogue-test/process_dialogue.py";
// Written by lt-tv-audio.mjs beside the tracks it rendered line by line. Its
// name is spelled here rather than imported, because that file imports this
// one and a cycle is a worse smell than a repeated string.
const RENDER_FILE = "render.json";

/**
 * What a folder's render.json says about how its tracks were made, or null.
 *
 * `mode: "lines"` means each track already holds one voice and the gaps
 * between lines are listed, so nothing is split apart and nothing measured.
 * Anything else — or no file — is a two-voice master for the older path.
 */
export function perLineRender(parsed) {
  if (!parsed || parsed.mode !== "lines") return null;
  if (!Array.isArray(parsed.lines) || !Array.isArray(parsed.silences)) return null;
  return parsed;
}

/**
 * The header of a WAV this pipeline wrote, read back.
 *
 * Only what the cut needs: where the samples start, how many bytes they run
 * for, and how many bytes a second is. A file that is not the plain PCM WAV
 * `wavHeader` writes is refused rather than sliced at a guess.
 */
export function wavInfo(buffer) {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file.");
  }
  let at = 12;
  let fmt = null;
  while (at + 8 <= buffer.length) {
    const id = buffer.toString("ascii", at, at + 4);
    const size = buffer.readUInt32LE(at + 4);
    if (id === "fmt ") {
      fmt = {
        format: buffer.readUInt16LE(at + 8),
        channels: buffer.readUInt16LE(at + 10),
        sampleRate: buffer.readUInt32LE(at + 12),
        byteRate: buffer.readUInt32LE(at + 16),
        blockAlign: buffer.readUInt16LE(at + 20),
        bitsPerSample: buffer.readUInt16LE(at + 22),
      };
    } else if (id === "data") {
      if (!fmt) throw new Error("WAV data before its format chunk.");
      if (fmt.format !== 1) throw new Error("Not a PCM WAV.");
      return { ...fmt, dataOffset: at + 8, dataBytes: Math.min(size, buffer.length - at - 8) };
    }
    at += 8 + size + (size % 2);
  }
  throw new Error("WAV file has no data chunk.");
}

/**
 * The samples between two instants of a WAV, as a new WAV.
 *
 * Whole frames, so a cut can never land between the bytes of one sample, and
 * the SAME arithmetic for every character, so the two tracks are cut at the
 * identical sample — which is what keeps them together across a join.
 */
export function sliceWav(buffer, startsAt, endsAt) {
  const info = wavInfo(buffer);
  const frame = info.blockAlign;
  const from = Math.min(info.dataBytes, Math.round(startsAt * info.sampleRate) * frame);
  const to = Math.min(info.dataBytes, Math.round(endsAt * info.sampleRate) * frame);
  if (to <= from) throw new Error(`A section from ${startsAt}s to ${endsAt}s holds no audio.`);
  const data = buffer.subarray(info.dataOffset + from, info.dataOffset + to);
  const header = Buffer.from(buffer.subarray(0, 44));
  header.writeUInt32LE(36 + data.length, 4);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** One row per line of the layout report, as printed by --report. */
export function layoutLine(line, index) {
  const gap = index === 0 ? "" : `  ${line.pauseBefore.toFixed(2)}s before it`;
  return (
    `  ${String(line.n).padStart(3)}  ${line.actor.padEnd(7)} ` +
    `${line.start.toFixed(2).padStart(7)}s – ${line.end.toFixed(2).padStart(7)}s${gap}`
  );
}

/**
 * The command that splits a two-voice MASTER, built from an id alone.
 *
 * Only run for a folder with no per-line render.json — an archived recording
 * made the older way. It does NOT pass --spans: ElevenLabs' per-character
 * alignment puts every line boundary at the same instant it reports, by
 * construction, so the measurement is the only path that file has.
 */
const showOf = (id) => {
  const prefix = String(id).replace(/-.*$/, "");
  return SHOW_CLIP_SLUGS[prefix] ? prefix : "roundtable";
};

export function splitCommand(id, { report = false } = {}) {
  const dir = join(AUDIO_DIR, id);
  return [
    "python3",
    [
      PROCESSOR,
      ...(report ? ["--report"] : []),
      "--master", join(dir, "master-dialogue.wav"),
      "--segments", join(dir, "voice-segments.json"),
      // The show is the id's own prefix (news-01, roundtable-03, morality-01);
      // it decides the clip prefix the processor writes into the record, so a
      // hardcoded "roundtable" would name a Markets & Morality upload lttv_rt_.
      "--show", showOf(id),
      "--episode-id", id,
      dir,
    ],
  ];
}

/**
 * Was this master recorded in a voice the show has since changed?
 *
 * The processor matches speakers by voice id, so a master made before a voice
 * change cannot be split by a cast that has moved on. It fails with "No
 * dialogue segments were found for voice ...", which reads like the recording
 * is corrupt — and its advice, to name the old voice with `--voice`, is right
 * for an ARCHIVED response and wrong here: the fix for THIS episode is to
 * record it again in the voice it is supposed to have.
 *
 * Michelle hit this on 2026-09-21 between changing the Monk's voice and
 * splitting The Wealth Effect.
 *
 * @param recorded the voice ids in the master's own voice-segments.json
 */
export function staleVoices(episode, recorded) {
  const sung = new Set(recorded);
  if (!sung.size) return [];
  return Object.entries(episode.cast ?? {})
    .filter(([, who]) => who.voiceId && !sung.has(who.voiceId))
    .map(([actor, who]) => ({ actor, name: who.displayName, expected: who.voiceId }));
}

/** What to say about it, in terms of the button rather than the flag. */
export function staleVoiceRefusal(stale, id) {
  if (!stale.length) return null;
  const who = stale.map((v) => v.name).join(" and ");
  return (
    `${id} was recorded before ${who} changed ${stale.length === 1 ? "voice" : "voices"}, so the\n` +
    "master cannot be split by the cast it has now.\n\n" +
    'Press "Record it again", then split. From a terminal:\n' +
    `  npm run lt:audio -- content/lt-tv/episodes/${id}.json\n\n` +
    "Nothing is wrong with the recording itself — it is simply in the old\n" +
    `${stale.length === 1 ? "voice" : "voices"}.`
  );
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
/**
 * Which clips this split actually changed, against the files it overwrote.
 *
 * After `# take 2` on one line Michelle asked which of twelve clips to upload
 * again (2026-09-21). The answer is knowable: every clip is cut from the same
 * bytes by the same arithmetic, so a clip whose bytes match the file already
 * in the folder is the clip already in SitePal — PROVIDED the last split was
 * uploaded, which only she knows, so the report says "if".
 */
export function clipChanges(clips, before, after) {
  const changed = [];
  const same = [];
  const fresh = [];
  for (const clip of clips) {
    const was = before.get(clip);
    const now = after.get(clip);
    if (!was) fresh.push(clip);
    else if (now && was.equals(now)) same.push(clip);
    else changed.push(clip);
  }
  return { changed, same, fresh };
}

/** What to say about it, or nothing when there was nothing to compare. */
export function clipChangesReport({ changed, same, fresh }) {
  if (!same.length && !changed.length) return null;
  const lines = [];
  if (changed.length) {
    lines.push(`Changed since the last split, so upload again: ${changed.join(", ")}.`);
  }
  if (same.length) {
    lines.push(
      `Byte-identical to the last split: ${same.join(", ")}.` +
        " If those were uploaded after that split, SitePal already has them.",
    );
  }
  if (fresh.length) lines.push(`New this time: ${fresh.join(", ")}.`);
  return lines.join("\n");
}

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
 * Clip files in the episode's folder that this cut does not want.
 *
 * ffmpeg overwrites the files it writes, so the danger is the ones it does
 * NOT: a run that produces fewer sections than the last leaves a stale `_s5`
 * in the folder, looking exactly like the others, waiting to be uploaded
 * beside them. This deletes files, so it is deliberately narrow — only names
 * that this pipeline generates, never the master, the balanced tracks, the
 * timings, or anything a person put there.
 */
export function staleClips(existing, plan) {
  const keep = new Set(plan.map((row) => `${row.clip}.wav`));
  return existing.filter((name) => /^lttv_[a-z0-9_]+\.wav$/.test(name) && !keep.has(name));
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
    console.error(`${id} has no recording yet — record it first.`);
    console.error(`  Looked for ${master}`);
    process.exit(1);
  }
  const renderPath = resolve(AUDIO_DIR, id, RENDER_FILE);
  const render = existsSync(renderPath)
    ? perLineRender(JSON.parse(await readFile(renderPath, "utf8")))
    : null;

  const episode = JSON.parse(await readFile(recordPath, "utf8"));
  const timing = episode.timing ?? {};
  if (!Array.isArray(timing.lineStarts) || !timing.lineStarts.length) {
    console.error(`${id} has a master but no timing. Record it again.`);
    process.exit(1);
  }

  // Checked BEFORE the processor runs, so a voice change is reported as a
  // voice change rather than as a file that appears to contain nothing.
  const segmentsPath = join(AUDIO_DIR, id, "voice-segments.json");
  if (existsSync(segmentsPath)) {
    const recorded = JSON.parse(await readFile(segmentsPath, "utf8")).map((seg) => seg.voice_id);
    const refusal = staleVoiceRefusal(staleVoices(episode, recorded), id);
    if (refusal) {
      console.error(refusal);
      process.exit(2);
    }
  }

  const report = process.argv.includes("--report");
  let silences;
  if (render) {
    // Each track already holds one voice: the recording step rendered every
    // line alone and laid the tracks out by bytes. Nothing to cut apart, and
    // every pause between lines is one it placed, so those are the silences.
    if (render.lines.length !== timing.lineStarts.length) {
      console.error(
        `${id}'s tracks hold ${render.lines.length} lines but the record has ` +
          `${timing.lineStarts.length}. They are not the same recording. Record it again.`,
      );
      process.exit(2);
    }
    console.log(
      `Each track already holds one voice — every line was rendered on its own —\n` +
        `so there is nothing to cut apart. ${render.lines.length} lines, ` +
        `${render.silences.length} pauses placed by the recording.`,
    );
    if (report) {
      console.log("\nline  speaker  where it sits:");
      for (const [i, line] of render.lines.entries()) console.log(layoutLine(line, i));
    }
    silences = render.silences;
  } else {
    // A two-voice master from the older recording path. Split it with the
    // processor, which needs ffmpeg, then measure where it is quiet.
    console.log(
      "This is a two-voice master (no render.json), so it is being split apart by\n" +
        "voice first. That is the older path and needs ffmpeg.\n",
    );
    const [command, args] = splitCommand(id, { report });
    const code = await run(command, args);
    if (code !== 0) process.exit(code);
    const [silenceCmd, silenceArgs] = silenceCommand(master);
    silences = parseSilences(await capture(silenceCmd, silenceArgs));
  }

  // ── into sections ────────────────────────────────────────────────────────
  // The screenplay gets the last word on where a join goes. Read here rather
  // than from the record because a mark is not an edit: it changes nothing
  // about the words, so applying it would be refused on a recorded episode.
  const scriptPath = resolve(EPISODE_DIR, `${id}.txt`);
  const cuts = existsSync(scriptPath) ? readCutMarks(await readFile(scriptPath, "utf8")) : [];

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

  // Clear out the last run's section files first — see staleClips.
  const plan = uploadPlan(episode, id, sections);
  const stale = staleClips(await readdir(resolve(AUDIO_DIR, id)), plan);
  for (const name of stale) await unlink(resolve(AUDIO_DIR, id, name));
  if (stale.length) {
    console.log(`\nRemoved ${stale.length} clip file(s) from a previous split: ${stale.join(", ")}`);
    console.log("They are not part of this cut. Delete them in SitePal too if you uploaded them.");
  }

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

  // The cut is bytes: whole samples, the same instants for every character.
  // The older path used ffmpeg here; the WAVs this pipeline writes are plain
  // PCM and need nothing but arithmetic.
  const sources = new Map();
  const before = new Map();
  const after = new Map();
  for (const row of plan) {
    const section = sections[row.section - 1];
    if (!sources.has(row.source)) sources.set(row.source, await readFile(row.source));
    try {
      if (existsSync(row.file)) before.set(row.clip, await readFile(row.file));
      const clip = sliceWav(sources.get(row.source), section.startsAt, section.endsAt);
      after.set(row.clip, clip);
      await writeFile(row.file, clip);
    } catch (err) {
      console.error(`Could not cut ${row.file}: ${err.message}`);
      process.exit(1);
    }
  }
  const changes = clipChanges(plan.map((r) => r.clip), before, after);

  // The record learns the cut points, so the set knows when to move on. Written
  // here rather than guessed there: the boundaries are a property of the audio
  // that exists, not something to recompute from the words.
  episode.timing = { ...timing, sections: sections.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })) };
  await writeFile(recordPath, JSON.stringify(episode, null, 2) + "\n");

  console.log("Upload these to the SitePal Audio Manager. Each file is named for the clip");
  console.log("it becomes, so the name to type is the filename without .wav.\n");
  // The full path, because a path relative to the repo is not something you can
  // paste into Finder — Michelle went looking for one on 2026-09-21 and could
  // not find it. In Finder, Go > Go to Folder (Cmd-Shift-G) takes this.
  console.log("They are all in this folder:");
  console.log(`  ${resolve(AUDIO_DIR, id)}\n`);
  for (const row of plan) {
    console.log(`  ${row.clip}`);
    console.log(`    ${basename(row.file)}\n`);
  }
  if (sections.length > 1) {
    console.log("Upload all of them. The set plays each character's sections in order, and a");
    console.log("missing one stops the episode where it should have carried on.\n");
  }
  const said = clipChangesReport(changes);
  if (said) console.log(`${said}\n`);
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
