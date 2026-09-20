// FROM A PRODUCTION RECORD TO A SLATE RECORD.
//
// The news pipeline and the LT TV slate describe the same episode in different
// vocabularies, because they were built in parallel against the same main.
//
//   The pipeline's record (content/lt-tv/episodes/, the staging area) is
//   nested and holds everything a producer needs: segments, each with its
//   lines, each line with its voice and its reaction cues; recording blocks;
//   the rundown; the sources every number came from.
//
//   The slate's record (src/content/lt-tv/episodes/) is flat and holds only
//   what the site performs: a line start per line, who holds each line, which
//   lines are played to the room, the reaction beats, the SitePal clip names.
//
// This module is the join. It is deliberately one-way: the production record
// is the source of truth and the slate record is derived from it, so the two
// can never disagree about who speaks line 41.
//
// WHAT IT CANNOT KNOW YET. Line starts and the dialogue's end come from real
// audio, which is the audio build (step 3), which is not written. A record
// without them is not broken — `episodeIsPlayable` returns false and the guide
// lists it as "Not recorded yet", which is exactly right for an episode that
// has been written but not recorded. Everything else — speakers, audience
// lines, cues with their offsets — is known the moment the script exists, so
// it is emitted now and the audio build fills in the three missing fields.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";

export const SLATE_DIR = "src/content/lt-tv/episodes";
export const SLATE_INDEX = "src/content/lt-tv/index.js";

/** How far into its line a note may run before the detail view gets unreadable. */
const NOTE_CHARS = 60;

/**
 * The slate record for a production record.
 *
 * @param episode  the pipeline's own record, as `assemble()` returns it
 * @returns a plain object ready to be written as `<id>.json`
 */
export function toSlateRecord(episode) {
  const lines = (episode.segments || []).flatMap((s) => s.lines || []);
  if (!lines.length) throw new Error("the episode has no lines to translate");

  // The pipeline numbers lines across the whole episode already, so the slate's
  // array index and the production record's `n` are the same number. Assert it
  // rather than assume it: every cue below is keyed on that equality.
  lines.forEach((line, i) => {
    if (line.n !== i) {
      throw new Error(`line ${i} is numbered ${line.n}; the two records would disagree about who speaks it`);
    }
  });

  const timing = episode.timing || {};
  const playable = Array.isArray(timing.lineStarts) && timing.lineStarts.length > 0;

  const record = {
    id: slateId(episode),
    showId: episode.show,
    number: episode.number,
    title: episode.title,
    summary: episode.summary,
    airDate: episode.airDate,

    // Which week's news this is. Not part of the slate's schema — the site
    // ignores it — but it is the one fact that identifies a news episode, and
    // losing it here would mean going back to the staging record to ask.
    week: episode.week,

    leadIn: timing.leadIn ?? 2.5,

    // Derived, never restated: the pipeline knows who holds each line, so the
    // listener turns and the camera shots fall out of this array.
    speakers: lines.map((l) => l.actor),

    // NOTE THE INVERSION, because it reads like a typo and is not one. The
    // pipeline's `directAddress` means the speaker is talking AT the other
    // host, so the listener turns to face them. The slate's `audienceLines`
    // means the opposite — the line is played to the room, nobody turns, and
    // the camera pulls back to the two-shot. `buildEpisodeTimeline` skips the
    // gaze for precisely these lines. So an audience line is one that is NOT
    // direct address.
    audienceLines: lines.flatMap((l) => (l.directAddress ? [] : [l.n])),

    cues: lines.flatMap((line) =>
      (line.cues || []).map((cue) => ({
        line: line.n,
        offset: cue.offset,
        actor: cue.actor,
        reaction: cue.reaction,
        duration: cue.duration,
        note: excerpt(line.text),
      })),
    ),
  };

  // The three fields only real audio can supply. Present together or not at
  // all: a half-filled record would read as playable and then play silence.
  if (playable) {
    record.audio = Object.fromEntries(
      Object.entries(episode.cast || {}).map(([actor, c]) => [actor, c.sitepalAudio]),
    );
    record.lineStarts = timing.lineStarts;
    record.dialogueEnd = timing.durationSeconds;
  } else {
    // Deliberately NOT `runtime`: the slate would advertise this in the guide
    // as if it were the length of a recording that does not exist. It is an
    // estimate from a word count, and it is labelled as one.
    record.estimatedRuntime = episode.slate?.runtime ?? null;
  }

  // The chiron's copy, ready for whoever wires LTTvChiron's TICKER_COPY to the
  // record. Carried now so the wiring is a one-line change later.
  if (episode.graphics) record.graphics = episode.graphics;

  // Where every number in this episode came from. The show reads figures out
  // loud; the record should be able to say why it believed each one.
  if (episode.sources?.length) record.sources = episode.sources;

  record.producedFrom = {
    record: `content/lt-tv/episodes/${episode.id}.json`,
    pipeline: episode.provenance?.pipeline ?? null,
    generatedAt: episode.provenance?.generatedAt ?? null,
  };

  return record;
}

/**
 * The slate names episodes `<show>-<NN>` and the guide lists them in that
 * order, so a news episode joins as news-01, news-02. The week it covers lives
 * in `week` rather than in the id — two episodes never collide, because the
 * number is one past however many news records already exist.
 */
export function slateId(episode) {
  return `${episode.show}-${episode.number}`;
}

function excerpt(text) {
  const clean = String(text).replace(/\[[^\]]*\]/g, "").trim();
  return clean.length <= NOTE_CHARS ? clean : `${clean.slice(0, NOTE_CHARS - 1).trimEnd()}…`;
}

/**
 * Write the record and register it in index.js.
 *
 * A record nobody imports is a record the site never shows — bundlers cannot
 * glob a directory at build time, so the import is load-bearing, and
 * lt-tv-check.mjs fails a record that is missing one. Registering is therefore
 * part of writing, not a step to remember afterwards.
 *
 * @returns { path, registered, importLine, arrayLine }
 */
export async function writeSlateRecord(record, { root = process.cwd() } = {}) {
  const path = join(root, SLATE_DIR, `${record.id}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(record, null, 2) + "\n");

  const indexPath = join(root, SLATE_INDEX);
  const source = await readFile(indexPath, "utf8");
  const next = registerEpisode(source, record.id);
  if (next && next !== source) await writeFile(indexPath, next);

  return {
    path,
    registered: Boolean(next),
    importLine: importLineFor(record.id),
    arrayLine: `  ${varNameFor(record.id)},`,
  };
}

const varNameFor = (id) => id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const importLineFor = (id) => `import ${varNameFor(id)} from "./episodes/${id}.json";`;

/**
 * Add an episode's import and its EPISODE_RECORDS entry to index.js.
 *
 * Returns the new source, the source unchanged when it is already registered,
 * or null when the file does not look the way this expects — in which case the
 * caller prints the two lines and a human adds them. Editing a checked-in
 * module from a generator is worth doing only while it can be certain.
 */
export function registerEpisode(source, id) {
  const importLine = importLineFor(id);
  const arrayEntry = varNameFor(id);
  if (source.includes(`./episodes/${id}.json`)) return source; // already there

  const imports = [...source.matchAll(/^import .+ from "\.\/episodes\/.+\.json";$/gm)];
  if (!imports.length) return null;
  const lastImport = imports[imports.length - 1];
  const insertAt = lastImport.index + lastImport[0].length;

  const withImport = `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;

  // The array is the slate's running order, so a new episode goes on the end
  // of it rather than wherever the import landed.
  const array = withImport.match(/const EPISODE_RECORDS = \[\n([\s\S]*?)\n\];/);
  if (!array) return null;
  const entries = array[1];
  const replaced = withImport.replace(
    array[0],
    `const EPISODE_RECORDS = [\n${entries}\n  ${arrayEntry},\n];`,
  );

  // Cheap self-check: if either edit silently did nothing, say so rather than
  // reporting a registration that did not happen.
  if (!replaced.includes(importLine) || !new RegExp(`^\\s*${arrayEntry},$`, "m").test(replaced)) {
    return null;
  }
  return replaced;
}
