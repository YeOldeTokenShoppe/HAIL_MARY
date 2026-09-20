#!/usr/bin/env node
// REWRITE THE LINES YOU MARKED.
//
//   node scripts/lt-tv-rewrite.mjs roundtable-02
//
// Deleting a bad line leaves a hole; rewriting the whole episode throws away
// the good lines to fix one. This does the third thing: you say what is wrong
// with a line, in the screenplay, and only that line comes back different.
//
// HOW A LINE IS MARKED. The screenplay already ignores anything starting with
// `#`, so the note goes directly under the line it is about:
//
//      42     CONNOR     Nobody rings a bell at the top.
//      # too on-the-nose, and Connor would never explain his own joke
//
// A note starting `#!` is also added to docs/lt-tv-style-notes.md as a
// standing rule, so every future episode is written knowing it. That is the
// difference between fixing this line and never seeing it again.
//
// WHAT IT TOUCHES. The .txt only. Marked lines are replaced, the notes are
// removed, and nothing else in the file moves — same numbering, same cues,
// same everything else. The record is rebuilt when you apply the script, the
// same explicit step as any other edit, so a rewrite you dislike is discarded
// by not applying it.
//
// WHY THE WHOLE SCRIPT IS SENT. A replacement line has to land in a
// conversation: pick up what the other host just said, set up what comes next,
// not repeat a joke from two segments ago. The model is given the episode as
// context and asked to change only the marked lines.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";

import { claude } from "./lt-tv-claude.mjs";
import { LINE_RE, CUE_RE, SEGMENT_RE, parseScript } from "./lt-tv-edit.mjs";
import { showFormat } from "./lt-tv-format.mjs";
import { readStyleNotes, withStyleNotes, rememberStyleNote, STYLE_NOTES_PATH } from "./lt-tv-style-notes.mjs";

const EPISODE_DIR = "content/lt-tv/episodes";
const MODEL = process.env.LT_TV_MODEL || "claude-opus-5";
const MAX_TOKENS = 4000;

// A note is `#` then the text. `#!` means remember it as well as fix it — and
// `# !`, with the space, means the same, because that is what gets typed.
const NOTE_RE = /^\s*#\s*(!)?\s*(.*\S)\s*$/;

const SYSTEM = `You are rewriting individual lines of an animated talk show script.

You are given the whole screenplay for context and a list of lines the producer
has marked, each with their note on what is wrong with it. Rewrite ONLY those
lines.

Every replacement must:
- answer the producer's note for that line
- fit where it sits: pick up the line before it, set up the line after it
- stay in that character's voice
- stay close to the original length, because the runtime is built from it
- be one line of speech with no line breaks, no speaker name, no line number

Delivery directions in square brackets like [dryly] are part of a line and you
may keep, change or drop them. Never write stage directions of any other kind.

Reply with JSON only:
{"replacements":[{"n":42,"text":"the new line"}]}

Every n must be one you were given. Say nothing else.`;

/**
 * Find the marked lines in a screenplay.
 *
 * A note attaches to the nearest dialogue line above it, which is why the
 * header's own `#` lines are never mistaken for notes: nothing has been said
 * yet when they are read.
 *
 * A spoken line can be long, and the natural way to complain about one
 * sentence of it is to press Return in front of that sentence and write the
 * note there. That splits the line in two, and the second half no longer looks
 * like dialogue. So text that can only be the rest of the line above is read
 * as part of it, and the rewrite puts the line back together as one.
 */
export function findMarks(text) {
  const lines = text.split("\n");
  const marks = [];
  let current = null;
  let openLine = null; // the line still able to absorb a stray sentence

  lines.forEach((line, index) => {
    const dialogue = line.match(LINE_RE);
    if (dialogue) {
      const body = dialogue[4];
      current = {
        n: Number(dialogue[1]),
        speaker: dialogue[3],
        text: body,
        prefix: line.slice(0, line.length - body.length),
        index,
        parts: [],
        notes: [],
        noteIndexes: [],
      };
      openLine = current;
      return;
    }

    const note = line.match(NOTE_RE);
    if (note) {
      if (!current) return;
      if (!marks.includes(current)) marks.push(current);
      current.notes.push({ text: note[2], remember: Boolean(note[1]) });
      current.noteIndexes.push(index);
      return;
    }

    // Anything that belongs to the screenplay's own structure ends the line
    // above, and so does a blank: text after one is a new thought, not the
    // rest of a sentence.
    if (!line.trim() || CUE_RE.test(line) || SEGMENT_RE.test(line)) {
      openLine = null;
      return;
    }

    if (!openLine) return;
    openLine.text = `${openLine.text.trim()} ${line.trim()}`;
    openLine.parts.push(index);
  });

  return marks;
}

/**
 * Put the replacements into the screenplay and take the notes out.
 *
 * The line is rebuilt from its own prefix — number, aim marker, padded speaker
 * — rather than reformatted, so a rewritten line is indistinguishable from one
 * the generator wrote and the file still parses.
 */
export function applyRewrites(text, marks, replacements) {
  const byLine = new Map(replacements.map((r) => [r.n, r.text]));
  const lines = text.split("\n");
  const drop = new Set();
  const changed = [];

  for (const mark of marks) {
    const replacement = byLine.get(mark.n);
    if (replacement === undefined) continue;
    lines[mark.index] = `${mark.prefix}${replacement}`;
    // The notes go, and so does any half of the line that was left stranded
    // below one — the replacement is the whole line.
    for (const i of mark.noteIndexes) drop.add(i);
    for (const i of mark.parts) drop.add(i);
    changed.push({ n: mark.n, speaker: mark.speaker, before: mark.text, after: replacement });
  }

  return { text: lines.filter((_, i) => !drop.has(i)).join("\n"), changed };
}

/** Refuse anything that would corrupt the screenplay rather than edit it. */
export function validateReplacements(raw, marks) {
  const wanted = new Set(marks.map((m) => m.n));
  const list = Array.isArray(raw?.replacements) ? raw.replacements : null;
  if (!list) throw new Error("The model did not return a replacements list.");

  const clean = [];
  for (const item of list) {
    const n = Number(item?.n);
    if (!wanted.has(n)) throw new Error(`The model rewrote line ${item?.n}, which was not marked.`);
    const text = typeof item?.text === "string" ? item.text.trim() : "";
    if (!text) throw new Error(`The model returned an empty line for ${n}.`);
    if (text.includes("\n")) throw new Error(`The replacement for line ${n} is more than one line.`);
    clean.push({ n, text });
  }
  if (!clean.length) throw new Error("The model returned no replacements.");
  return clean;
}

function resolveScript(argument) {
  const name = basename(argument).replace(/\.(json|txt)$/, "");
  const candidates = argument.includes("/")
    ? [argument.replace(/\.json$/, ".txt")]
    : [resolve(EPISODE_DIR, `${name}.txt`), resolve("content/lt-tv/samples", `${name}.txt`)];
  const txt = candidates.find((p) => existsSync(p));
  if (!txt) {
    throw new Error(`No screenplay for "${argument}". Looked in:\n  ${candidates.join("\n  ")}`);
  }
  return txt;
}

/**
 * Whatever a later apply would refuse to read, or nothing.
 *
 * Needs the record beside the script only to know which show's cast to expect.
 * No record, no check — the rewrite itself still stands.
 */
async function parseErrors(txtPath, text) {
  try {
    const record = JSON.parse(await readFile(txtPath.replace(/\.txt$/, ".json"), "utf8"));
    parseScript(text, showFormat(record.show));
    return [];
  } catch (err) {
    return err.parseErrors ?? [];
  }
}

function requestMessage(script, marks) {
  const asked = marks.map((m) => ({
    n: m.n,
    speaker: m.speaker,
    line: m.text,
    note: m.notes.map((note) => note.text).join(" — "),
  }));
  return `THE SCREENPLAY\n${script}\n\nREWRITE THESE LINES\n${JSON.stringify(asked, null, 2)}`;
}

async function main() {
  const argument = process.argv[2];
  if (!argument) {
    console.error("Usage: node scripts/lt-tv-rewrite.mjs <episode id>");
    console.error("  Mark a line first: put a # note directly under it in the script.");
    process.exit(2);
  }

  const txt = resolveScript(argument);
  const script = await readFile(txt, "utf8");
  const marks = findMarks(script);

  // Nothing marked is not a failure, and must not cost anything: it is what
  // happens when the button is pressed before the notes are written.
  if (!marks.length) {
    console.log(`Nothing marked in ${basename(txt)}, so nothing was rewritten and nothing was spent.`);
    console.log("Put a note starting with # on the line under the one you want changed, then run this again.");
    console.log("  e.g.   # too on-the-nose, and he would never explain his own joke");
    console.log(`Start it with #! to also add it to ${STYLE_NOTES_PATH} for future episodes.`);
    return;
  }

  const noteCount = marks.reduce((n, m) => n + m.notes.length, 0);
  console.log(`${marks.length} line(s) marked, ${noteCount} note(s). Rewrite pass (${MODEL})…`);
  for (const mark of marks) {
    console.log(`  ${String(mark.n).padStart(3)}  ${mark.text}`);
    for (const note of mark.notes) console.log(`       ${note.remember ? "!" : "·"} ${note.text}`);
  }

  const replacements = validateReplacements(
    await claude({
      system: withStyleNotes(SYSTEM, await readStyleNotes()),
      user: requestMessage(script, marks),
      model: MODEL,
      maxTokens: MAX_TOKENS,
    }),
    marks,
  );

  const { text, changed } = applyRewrites(script, marks, replacements);
  await writeFile(txt, text.endsWith("\n") ? text : `${text}\n`);

  // The whole promise of this step is that the file still applies afterwards,
  // so say now if it does not, rather than at the apply two steps later.
  const unreadable = await parseErrors(txt, text);

  console.log(`\nRewrote ${changed.length} line(s) in ${basename(txt)}:\n`);
  for (const c of changed) {
    console.log(`  ${String(c.n).padStart(3)}  ${c.speaker}`);
    console.log(`       was  ${c.before}`);
    console.log(`       now  ${c.after}\n`);
  }

  // The standing rules go in last, after the edit that prompted them landed.
  const remembered = [];
  for (const mark of marks) {
    for (const note of mark.notes) {
      if (!note.remember) continue;
      const result = await rememberStyleNote(note.text);
      remembered.push({ note: note.text, ...result });
    }
  }
  if (remembered.length) {
    console.log(`${STYLE_NOTES_PATH}:`);
    for (const r of remembered) {
      console.log(`  ${r.added ? "added" : `not added (${r.reason})`} — ${r.note}`);
    }
    console.log("");
  }

  const missed = marks.filter((m) => !changed.some((c) => c.n === m.n));
  if (missed.length) {
    console.log(`Left alone, and still marked: ${missed.map((m) => m.n).join(", ")}.`);
  }

  if (unreadable.length) {
    console.log("Heads up — the script will not apply until these are fixed:");
    for (const e of unreadable) console.log(`  ${e}`);
    return;
  }
  console.log("Read it, then apply it: node scripts/lt-tv-edit.mjs " + basename(txt).replace(/\.txt$/, ""));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
