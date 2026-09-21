#!/usr/bin/env node
// EDIT AN EPISODE BY EDITING ITS SCRIPT.
//
//   node scripts/lt-tv-edit.mjs news-01
//
// Step 2 writes two files side by side: the episode record, which is JSON and
// which everything downstream reads, and the screenplay, which is the only
// view of an episode a person actually reads. Until now the screenplay was a
// printout — to change a line you found the matching `text` field in the JSON
// and edited that instead, which is tedious enough that it does not get done.
//
// This turns the printout into the source. Edit the .txt, run this, and the
// record is rebuilt from what you wrote.
//
// WHAT IS REBUILT, NOT PATCHED. The record holds a lot of arithmetic derived
// from the words: per-segment word counts, the estimated runtime, and the
// recording blocks, which are packed to fit an ElevenLabs request and will
// re-pack if a segment grows. Patching the text and leaving those stale is the
// obvious way to write this and it is wrong — the blocks would still describe
// the old script. So the parsed lines go back through the SAME `assemble()`
// the generator uses, and every derived field, including the warnings, comes
// out recomputed. Editing a line is exactly as safe as generating it was.
//
// WHAT IS PRESERVED. The rundown, the sources, the air date and the episode
// number are not in the screenplay and are carried over untouched. The number
// especially: it names the slate record and both SitePal uploads, so an edit
// must never move it.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";

import { CAST, ACTORS, REACTIONS, SHOW_FORMATS, showFormat } from "./lt-tv-format.mjs";
import { assemble, renderScript } from "./lt-tv-episode.mjs";
import { toSlateRecord, writeSlateRecord, slateId, SLATE_DIR } from "./lt-tv-slate-record.mjs";

const EPISODE_DIR = "content/lt-tv/episodes";

// Speakers are matched by their display name rather than by column position,
// so re-indenting a line by hand does not break it.
const DISPLAY_TO_ACTOR = new Map(
  ACTORS.map((a) => [CAST[a].displayName.toUpperCase(), a]),
);
const SPEAKER_ALTERNATIVES = [...DISPLAY_TO_ACTOR.keys()]
  .sort((a, b) => b.length - a.length) // longest first: "SAINT GR80" before any prefix of it
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

// Exported so the rewrite step can find and replace a line without keeping a
// second idea of what any of these look like — two copies would drift.
export const LINE_RE = new RegExp(`^\\s*(\\d+)\\s+(>\\s*)?(${SPEAKER_ALTERNATIVES})\\s+(\\S.*)$`);
export const CUE_RE = /^\s*\(\s*(\w+)\s+(\w+)\s*@\s*\+?\s*([\d.]+)\s*s\s*\)\s*$/;
export const SEGMENT_RE = /^\s*──\s*(.+?)\s*\[([a-z0-9-]+)\]/;
const CHIRON_RE = /^CHIRON:\s*(.*)$/;
// Built from the shows themselves, so a screenplay cannot be applied to the
// wrong show by way of its title line.
const SHOW_TITLES = Object.values(SHOW_FORMATS)
  .map((f) => f.title.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const TITLE_RE = new RegExp(`^(?:${SHOW_TITLES})\\s*—\\s*(.*)$`);
const EPISODE_RE = /^episode:\s*(\S+)\s*$/;
// The counts line under the title. Recomputed on every write, so it is read
// past rather than read — but matched explicitly, so that a genuine typo in
// the header is still reported instead of quietly skipped.
const STATS_RE = /·.*\bestimated\b.*·.*\bwords\b/;

/**
 * Read a screenplay back into the shape `assemble()` takes.
 *
 * Deliberately strict about structure and lenient about whitespace: a line
 * that looks like dialogue but cannot be read is an error naming the file line,
 * never a silently dropped line. Dropping one silently is the failure that
 * matters here, because the episode would still build and simply be missing a
 * sentence nobody notices until it is on air.
 *
 * @param format — which show's skeleton to validate segment ids against.
 *   Defaults to the news show so an existing caller keeps working.
 * @returns { title, chiron, episodeId, segments: [{ id, lines }] }
 */
export function parseScript(text, format = SHOW_FORMATS.news) {
  const segmentIds = new Set(format.segments.map((s) => s.id));
  const errors = [];
  const segments = [];
  let current = null;
  let lastLine = null;
  let title = null;
  let chiron = null;
  let episodeId = null;

  const raw = text.split("\n");
  for (let i = 0; i < raw.length; i += 1) {
    const source = raw[i];
    const lineNo = i + 1;
    const trimmed = source.trim();

    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    const titleMatch = TITLE_RE.exec(trimmed);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    if (STATS_RE.test(trimmed)) continue;

    const episodeMatch = EPISODE_RE.exec(trimmed);
    if (episodeMatch) {
      episodeId = episodeMatch[1];
      continue;
    }

    const chironMatch = CHIRON_RE.exec(trimmed);
    if (chironMatch) {
      chiron = chironMatch[1].trim();
      continue;
    }

    const segmentMatch = SEGMENT_RE.exec(trimmed);
    if (segmentMatch) {
      const id = segmentMatch[2];
      if (!segmentIds.has(id)) {
        errors.push(`line ${lineNo}: unknown segment "${id}" — this show has ${[...segmentIds].join(", ")}.`);
        current = null;
        continue;
      }
      if (segments.some((s) => s.id === id)) {
        errors.push(`line ${lineNo}: segment "${id}" appears twice.`);
      }
      current = { id, lines: [] };
      segments.push(current);
      lastLine = null;
      continue;
    }

    const cueMatch = CUE_RE.exec(trimmed);
    if (cueMatch) {
      const [, actor, reaction, offset] = cueMatch;
      if (!lastLine) {
        errors.push(`line ${lineNo}: an animation beat with no line above it to attach to.`);
        continue;
      }
      if (!REACTIONS[actor]) {
        errors.push(`line ${lineNo}: "${actor}" is not one of this show's characters (${ACTORS.join(", ")}).`);
        continue;
      }
      if (!(reaction in REACTIONS[actor])) {
        errors.push(
          `line ${lineNo}: ${actor} has no reaction "${reaction}". ` +
            `Valid: ${Object.keys(REACTIONS[actor]).join(", ")}.`,
        );
        continue;
      }
      lastLine.cues.push({ actor, reaction, offset: Number(offset) });
      continue;
    }

    const lineMatch = LINE_RE.exec(source);
    if (lineMatch) {
      const [, , aim, who, body] = lineMatch;
      if (!current) {
        errors.push(`line ${lineNo}: dialogue before any segment heading.`);
        continue;
      }
      lastLine = {
        actor: DISPLAY_TO_ACTOR.get(who),
        text: body.trim(),
        directAddress: Boolean(aim),
        cues: [],
      };
      current.lines.push(lastLine);
      continue;
    }

    errors.push(
      `line ${lineNo}: could not read this. A line of dialogue looks like ` +
        `"  7    SAINT GR80 [dryly] Some words."; put a # in front to make it a note.\n    ${trimmed.slice(0, 80)}`,
    );
  }

  if (errors.length) {
    const err = new Error(`The script could not be read:\n  ${errors.join("\n  ")}`);
    err.parseErrors = errors;
    throw err;
  }

  return { title, chiron, episodeId, segments };
}

/** Every line of an episode, flattened, for comparing two versions of it. */
const allLines = (episode) => episode.segments.flatMap((s) => s.lines);

/**
 * What changed, in terms a person recognises.
 *
 * Compared by position within a segment rather than by line number, because
 * inserting one line at the top would otherwise report every line after it as
 * reworded.
 */
export function describeEdit(before, after) {
  const changes = { reworded: 0, added: 0, removed: 0, aimChanged: 0, cuesChanged: 0 };
  const ids = new Set([...before.segments, ...after.segments].map((s) => s.id));

  for (const id of ids) {
    const was = before.segments.find((s) => s.id === id)?.lines ?? [];
    const now = after.segments.find((s) => s.id === id)?.lines ?? [];
    const shared = Math.min(was.length, now.length);
    for (let i = 0; i < shared; i += 1) {
      if (was[i].text !== now[i].text) changes.reworded += 1;
      if (Boolean(was[i].directAddress) !== Boolean(now[i].directAddress)) changes.aimChanged += 1;
      if (JSON.stringify(was[i].cues.map((c) => [c.actor, c.reaction, c.offset])) !==
          JSON.stringify(now[i].cues.map((c) => [c.actor, c.reaction, c.offset]))) {
        changes.cuesChanged += 1;
      }
    }
    changes.added += Math.max(0, now.length - was.length);
    changes.removed += Math.max(0, was.length - now.length);
  }
  return changes;
}

const anyChange = (c) => c.reworded + c.added + c.removed + c.aimChanged + c.cuesChanged > 0;

/** Rebuild a record from an edited screenplay. Pure, so it is testable. */
export function applyScript(episode, parsed) {
  const format = showFormat(episode.show);
  const rebuilt = assemble({
    rundown: {
      ...episode.rundown,
      // The chiron and the title live in the script, so the script wins —
      // except when the title line has been emptied, which is a title being
      // retyped rather than a decision to have no title. The guide has no
      // sensible way to print a nameless episode, so the record keeps the
      // name it had.
      title: parsed.title?.trim() || episode.title,
      headline: parsed.chiron ?? episode.graphics?.headline,
      ticker: episode.graphics?.ticker,
    },
    segments: parsed.segments,
    week: episode.week,
    brief: {
      id: episode.provenance?.briefId ?? null,
      generatedAt: episode.provenance?.briefGeneratedAt ?? null,
    },
    number: Number(episode.number),
    format,
  });

  return {
    ...rebuilt,
    // Not in the screenplay, and not the editor's to move.
    airDate: episode.airDate,
    summary: episode.summary,
    sources: episode.sources,
    provenance: {
      ...rebuilt.provenance,
      ...episode.provenance,
      editedAt: new Date().toISOString(),
      editedBy: "scripts/lt-tv-edit.mjs",
    },
  };
}

/**
 * A cut mark: `# cut` alone on a line, meaning put a section boundary here.
 *
 * It is a `#` line, so the script parser already ignores it and applying edits
 * is unaffected. The rewrite step has to be told about it, because every other
 * `#` line there is a note about the line above.
 */
export const CUT_MARK_RE = /^\s*#\s*cut(\s+here)?\s*$/i;

/**
 * A pause mark: `# pause 1.2s` alone on a line, meaning wait that long here.
 *
 * WHY THIS IS OURS AND NOT ELEVENLABS'. Text-to-dialogue runs on eleven_v3,
 * and v3 does not support SSML break tags — the `<break time="1.5s" />` that
 * works on Multilingual v2 and the Flash models is simply not available here.
 * What v3 offers instead is ellipses, dashes and audio tags, which colour the
 * DELIVERY rather than insert a measured silence, and their own docs warn that
 * leaning on breaks causes the model to speed up or add artefacts.
 *
 * We can do better than the thing we cannot have: the master is assembled here
 * from raw PCM, so a pause we insert ourselves is an exact number of silent
 * samples, identical every run, with no effect on how a line is read.
 */
export const PAUSE_MARK_RE = /^\s*#\s*pause\s+([\d.]+)\s*s?\s*$/i;

/**
 * A take mark: `# take 2` alone on a line, meaning render the line below it
 * again, and file that rendering separately from the first.
 *
 * A line is kept by its words, so the same words in the same voice are never
 * sent twice — which is right until ElevenLabs puts a stray syllable at the
 * head of a line (Michelle heard a "to" at 2:07 of The Wealth Effect,
 * 2026-09-21) and the only ways to hear it again were to reword the line or
 * delete a cache file by hand. The take number is part of the line's
 * identity instead: take 2 is a new rendering, kept on its own, and
 * recording again reuses it. Not happy with take 2 either: `# take 3`.
 * Take 1, or no mark, is the line as first recorded.
 */
export const TAKE_MARK_RE = /^\s*#\s*take\s+(\d+)\s*$/i;

/**
 * The pauses a screenplay asks for, as line number → seconds.
 *
 * Like a cut mark, this is read from the screenplay rather than stored in the
 * record, because it changes no words: it needs no applying and it works on an
 * episode that is already written. A pause belongs to the line it precedes.
 */
export function readPauseMarks(text) {
  const marks = new Map();
  let pending = null;
  for (const raw of text.split(/\r?\n/)) {
    const mark = raw.match(PAUSE_MARK_RE);
    if (mark) {
      pending = Number(mark[1]);
      continue;
    }
    const line = raw.match(LINE_RE);
    if (!line) continue;
    if (pending !== null) {
      marks.set(Number(line[1]), pending);
      pending = null;
    }
  }
  return marks;
}

/**
 * The line numbers a screenplay asks to be cut in FRONT of.
 *
 * Where an episode is cut for SitePal is chosen from the reported line times,
 * and those are only as good as what ElevenLabs reported. The person listening
 * is the better judge, so a mark in the screenplay wins: put `# cut` on its own
 * line and the boundary goes there, between the line above it and the line
 * below.
 *
 * A mark in front of line 0 is dropped — the first section starts there anyway.
 */
/** The takes a screenplay asks for, as line number → take number (2 and up). */
export function readTakeMarks(text) {
  const marks = new Map();
  let pending = null;
  for (const raw of text.split(/\r?\n/)) {
    const mark = raw.match(TAKE_MARK_RE);
    if (mark) {
      pending = Number(mark[1]);
      continue;
    }
    const line = raw.match(LINE_RE);
    if (!line) continue;
    if (pending !== null) {
      if (pending >= 2) marks.set(Number(line[1]), pending);
      pending = null;
    }
  }
  return marks;
}

export function readCutMarks(text) {
  const marks = [];
  let pending = false;
  for (const raw of text.split(/\r?\n/)) {
    if (PAUSE_MARK_RE.test(raw) || TAKE_MARK_RE.test(raw)) continue;
    if (CUT_MARK_RE.test(raw)) {
      pending = true;
      continue;
    }
    const line = raw.match(LINE_RE);
    if (!line) continue;
    if (pending) {
      const n = Number(line[1]);
      if (n > 0 && !marks.includes(n)) marks.push(n);
      pending = false;
    }
  }
  return marks;
}

/**
 * What the screenplay would change about the record, or null when it matches.
 *
 * Pulled out of the edit run so that OTHER steps can ask the question. The
 * audio build is the one that matters: it renders the record, not the
 * screenplay, so an edit that was saved but never applied is rendered as the
 * old words, silently, for real money. Asking here means asking the same way
 * the editor does rather than by comparing text, which would call a reflowed
 * line an edit.
 *
 * @param scriptName  what to call the screenplay in the mismatch error
 * @param recordName  and the record
 * @returns { rebuilt, changes } | null
 */
export function pendingEdits(episode, scriptText, { scriptName, recordName } = {}) {
  const parsed = parseScript(scriptText, showFormat(episode.show));

  // Applying the wrong file would rebuild an episode out of another episode's
  // words and look like it worked, so the script names the record it came from.
  if (parsed.episodeId && parsed.episodeId !== episode.id) {
    throw new Error(
      `${scriptName || `${parsed.episodeId}.txt`} is the script for ${parsed.episodeId}, ` +
        `but ${recordName || `${episode.id}.json`} is ${episode.id}.`,
    );
  }

  const rebuilt = applyScript(episode, parsed);
  const changes = describeEdit(episode, rebuilt);
  return anyChange(changes) ? { rebuilt, changes } : null;
}

/** An edit summary as a phrase, e.g. "3 line(s) reworded, 1 added". */
export function summariseEdits(changes) {
  return [
    changes.reworded && `${changes.reworded} line(s) reworded`,
    changes.added && `${changes.added} added`,
    changes.removed && `${changes.removed} removed`,
    changes.aimChanged && `${changes.aimChanged} re-aimed`,
    changes.cuesChanged && `${changes.cuesChanged} with changed beats`,
  ]
    .filter(Boolean)
    .join(", ");
}

// ── running it ────────────────────────────────────────────────────────────

function resolvePaths(argument) {
  const name = basename(argument).replace(/\.(json|txt)$/, "");
  const candidates = argument.includes("/")
    ? [argument.replace(/\.txt$/, ".json")]
    : [resolve(EPISODE_DIR, `${name}.json`), resolve("content/lt-tv/samples", `${name}.json`)];
  const json = candidates.find((p) => existsSync(p));
  if (!json) {
    throw new Error(
      `No episode record for "${argument}". Looked in:\n  ${candidates.join("\n  ")}`,
    );
  }
  return { json, txt: json.replace(/\.json$/, ".txt") };
}

async function main() {
  const argument = process.argv[2];
  if (!argument) {
    console.error("Usage: node scripts/lt-tv-edit.mjs <episode id or record path>");
    console.error("  e.g. node scripts/lt-tv-edit.mjs news-01");
    process.exit(2);
  }

  const { json, txt } = resolvePaths(argument);
  if (!existsSync(txt)) {
    throw new Error(`No script beside the record: ${txt}\nRe-run step 2 to write one.`);
  }

  const episode = JSON.parse(await readFile(json, "utf8"));
  // The record names its show, and the show decides which segment headings are
  // legal — so the record is read before the script, not after.
  const pending = pendingEdits(episode, await readFile(txt, "utf8"), {
    scriptName: basename(txt),
    recordName: basename(json),
  });

  if (!pending) {
    console.log("The script matches the record already — nothing to apply.");
    return;
  }
  const { rebuilt, changes } = pending;

  // Once an episode is recorded, the audio is the timing. New words do not
  // have any, and the old timing describes sentences that no longer exist, so
  // it cannot simply be carried over.
  const recorded = Array.isArray(episode.timing?.lineStarts);
  if (recorded && !process.argv.includes("--rerecord")) {
    // Naming only the flag sends whoever is holding a mouse looking for a
    // terminal. The studio offers this exact run as its own button, so the
    // refusal names that first and the flag second.
    console.error(
      `${episode.id} has already been recorded, and these edits would leave the\n` +
        "audio saying something the record no longer claims.\n\n" +
        'In the studio, press "Apply my edits and clear the audio". From a\n' +
        `terminal, that is:\n  npm run lt:edit -- ${episode.id} --rerecord\n\n` +
        "Either way the timing is cleared, which returns the episode to \"Not\n" +
        "recorded yet\" on the guide until you record it again.",
    );
    process.exit(2);
  }
  if (recorded) {
    rebuilt.timing = { lineStarts: null, lineEnds: null, durationSeconds: null, leadIn: episode.timing.leadIn };
  } else {
    rebuilt.timing = { ...rebuilt.timing, leadIn: episode.timing?.leadIn ?? rebuilt.timing.leadIn };
  }

  await writeFile(json, JSON.stringify(rebuilt, null, 2) + "\n");
  await writeFile(txt, renderScript(rebuilt) + "\n");

  console.log(`${episode.id}: ${summariseEdits(changes)}.`);
  console.log(
    `Runtime ${episode.slate.runtime} → ${rebuilt.slate.runtime}, ` +
      `${episode.slate.words} → ${rebuilt.slate.words} words.`,
  );

  const wasBlocks = episode.blocks.map((b) => b.id).join(",");
  const nowBlocks = rebuilt.blocks.map((b) => b.id).join(",");
  if (wasBlocks !== nowBlocks) {
    console.log(`Recording blocks re-packed: ${episode.blocks.length} → ${rebuilt.blocks.length}.`);
  }

  const fresh = rebuilt.warnings.filter((w) => !episode.warnings.includes(w));
  if (fresh.length) {
    console.log(`\n${fresh.length} new warning(s):`);
    for (const w of fresh) console.log(`  · ${w}`);
  }
  const gone = episode.warnings.filter((w) => !rebuilt.warnings.includes(w));
  if (gone.length) console.log(`\n${gone.length} earlier warning(s) no longer apply.`);

  console.log(`\nWrote ${json}`);
  console.log(`Wrote ${txt}`);

  // An episode already on the slate is one the site is showing, so leaving it
  // describing the previous words is worse than not editing at all. An episode
  // NOT on the slate is deliberately left off: adding it is step 2's decision,
  // not a side effect of fixing a typo.
  const onSlate = resolve(SLATE_DIR, `${slateId(rebuilt)}.json`);
  if (existsSync(onSlate)) {
    const { path } = await writeSlateRecord(toSlateRecord(rebuilt));
    console.log(`Refreshed ${path}`);
  } else {
    console.log(`Not on the slate, so nothing to refresh there. Re-run step 2 to add it.`);
  }

  if (recorded) {
    console.log("\nThe timing was cleared. Re-run the audio build before this airs again.");
  }
  console.log("Check it with: node scripts/lt-tv-check.mjs");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
