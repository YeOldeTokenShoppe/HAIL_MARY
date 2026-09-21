#!/usr/bin/env node
// THE WRITER'S ROOM — hash the episode out in conversation.
//
//   node scripts/lt-tv-room.mjs news-01          (a prompt you type into)
//
// and the same thing as a panel under the screenplay at /lt-tv, which is where
// it is actually used.
//
// WHY THIS EXISTS. Until now the way to change an episode was to write in the
// file: reword the line yourself, or put a `# note` under it and run the
// rewrite step. Both work and both stay. What neither does is let you say "the
// middle of story two is flabby and GR80 concedes too early" and get an answer
// — you have to already know which line is wrong before you can say anything
// about it. This is the conversation instead: you talk to the writer, it has
// the whole episode in front of it, and when the two of you agree on something
// it offers the change.
//
// WHAT IT IS NOT. It is not a second script format and it is not a second
// writer. The screenplay stays exactly what it was, `# cut`, `# pause` and all
// — those marks are how the recording is steered, so the room PLACES them for
// you rather than replacing the language. And the voice of the show comes from
// the same brief the generator uses: SCRIPT_BIBLE is imported from whichever
// generator writes this show, so the room cannot describe Connor differently
// from the writer that wrote him. That import is the whole reason the prompts
// were split.
//
// WHAT IT TOUCHES. The `.txt` only, and only when you press the button: the
// model proposes changes, you see them one by one, and applying them writes
// the screenplay. The record is rebuilt by the same explicit "Apply my edits"
// as any other change, so anything the room does is discarded by not applying
// it — exactly like the rewrite step.
//
// Env: ANTHROPIC_API_KEY (required)
//      LT_TV_MODEL       (default claude-opus-5)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";

import { claude } from "./lt-tv-claude.mjs";
import {
  LINE_RE,
  CUE_RE,
  SEGMENT_RE,
  CUT_MARK_RE,
  PAUSE_MARK_RE,
  TAKE_MARK_RE,
  parseScript,
} from "./lt-tv-edit.mjs";
import { CAST, ACTORS, SHOW_FORMATS, showFormat } from "./lt-tv-format.mjs";
import { SCRIPT_BIBLE as NEWS_BIBLE } from "./lt-news-script.mjs";
import { SCRIPT_BIBLE as ARGUMENT_BIBLE } from "./lt-rt-script.mjs";
import { readStyleNotes, withStyleNotes, rememberStyleNote, STYLE_NOTES_PATH } from "./lt-tv-style-notes.mjs";

const EPISODE_DIR = "content/lt-tv/episodes";
const SAMPLE_DIR = "content/lt-tv/samples";
const MODEL = process.env.LT_TV_MODEL || "claude-opus-5";
const MAX_TOKENS = 4000;

// The two shows are written by two generators, so the room reads from the one
// that wrote this show. Same object, not a copy of it.
const BIBLES = { news: NEWS_BIBLE, roundtable: ARGUMENT_BIBLE, morality: ARGUMENT_BIBLE };

// How much conversation is carried into a turn. A room that remembers the
// whole night is nice and a room that re-sends fifty turns of it on every
// message is expensive, and the screenplay — which is the thing being talked
// about — is sent fresh every time anyway.
export const HISTORY_TURNS = 24;
export const MAX_MESSAGE_CHARS = 4000;

const TITLE_LINE = /^([^\n]*?\s+—\s+)(.*)$/;

// ── What the writer is told ───────────────────────────────────────────────

const ROOM_RULES = `YOU ARE IN THE WRITER'S ROOM.

The producer is talking to you about an episode that already has a screenplay,
printed below with its line numbers. She is not editing a file; she is talking.
So talk back: short, specific, like a writer in a room with one other person.
Two or three sentences. Have an opinion, and say when you think she is wrong —
a room where you agree with everything is not worth having.

WHEN TO PROPOSE CHANGES. Only when she has asked for one, or agreed to one you
suggested. If she is thinking out loud, think out loud with her and propose
nothing. Proposing a change on every turn makes the room something she has to
defend herself against.

WHEN YOU DO, PUT THE WORDS IN THE CHANGES, NOT IN WHAT YOU SAY. She sees every
proposed line in full, next to the line it replaces, and applies them with a
button. Quoting them back to her as well just makes her read everything twice.
Say what you did and why, in a sentence: "Given Connor the last word and cut
the explainer — he never explains his own joke."

THE CHANGES YOU CAN MAKE, each one an object in "changes":

  {"op":"reword","n":12,"text":"the new line","why":"tighter"}
      Replace what the character says on line 12.
  {"op":"add","after":12,"speaker":"CONNOR","text":"...","aimed":true,"why":"..."}
      A new line under line 12. "speaker" is CONNOR or SAINT GR80. "aimed" is
      true when it is said AT the other host (he turns to face them) and false
      when it is played to the room.
  {"op":"drop","n":12,"why":"..."}
      Delete line 12. Remember the hosts alternate: dropping one line leaves
      the same character talking twice, so drop in pairs or reword instead.
  {"op":"pause","n":12,"seconds":1.5,"why":"..."}
      Hold that long before line 12 is spoken. 0 removes a pause you put there.
  {"op":"cut","n":12,"on":true,"why":"..."}
      Put a section boundary in front of line 12 — where SitePal can be skipped
      to. "on":false takes one out.
  {"op":"title","text":"...","why":"..."}
      Retitle the episode. This is what the channel guide prints.
  {"op":"rule","text":"...","why":"..."}
      A standing note for EVERY future episode of both shows, in the house
      notes. Use it when she tells you something about the characters or the
      show rather than about this line — "Connor never explains his own joke"
      is a rule; "cut that line" is not. Write it as an instruction, say what
      to do rather than why, and never mention this episode.

Line numbers are the ones printed in the screenplay below. Never invent one.
Every replacement is ONE line of speech: no line breaks, no speaker name, no
number, no stage directions beyond the bracketed delivery tags.

Reply with JSON only, no preamble and no code fences:
{"say":"what you say to her","changes":[]}

"changes" is an empty list when you are only talking. Say nothing outside the
JSON.`;

/**
 * The system prompt for one turn of the room.
 *
 * The screenplay goes in HERE rather than into the conversation, because it
 * changes under the conversation: apply three lines and the transcript still
 * holds the version from before them. Sent fresh each turn, it is always the
 * file as it is now, and the numbers the model quotes are the numbers on
 * screen.
 */
export function roomSystem({ show, script, rules = [], episode = null }) {
  const bible = BIBLES[show] ?? ARGUMENT_BIBLE;
  const format = SHOW_FORMATS[show] ?? SHOW_FORMATS.news;
  const heading = episode
    ? `THE EPISODE: ${episode.id}${episode.title ? ` — "${episode.title}"` : ""}, ${format.title}.`
    : `THE EPISODE, ${format.title}.`;

  return withStyleNotes(
    [
      bible,
      "",
      ROOM_RULES,
      "",
      heading,
      "",
      "THE SCREENPLAY AS IT STANDS",
      script,
    ].join("\n"),
    rules,
  );
}

// ── Reading the screenplay ────────────────────────────────────────────────

/**
 * Every line of dialogue in a screenplay, with where it sits in the file.
 *
 * `i` is the file line, `n` the number printed against it — they are not the
 * same thing and the difference is the whole reason this exists. `cues` are the
 * indented animation beats under a line, which belong to it: they have to move
 * and go with it, and an orphaned one is a parse error at the next apply.
 */
export function indexScript(text) {
  const lines = text.split("\n");
  const entries = [];
  let current = null;

  lines.forEach((raw, i) => {
    const dialogue = raw.match(LINE_RE);
    if (dialogue) {
      const body = dialogue[4];
      current = {
        n: Number(dialogue[1]),
        i,
        actor: null,
        speaker: dialogue[3],
        aimed: Boolean(dialogue[2]),
        text: body,
        prefix: raw.slice(0, raw.length - body.length),
        cues: [],
        notes: [],
      };
      entries.push(current);
      return;
    }
    if (!current) return;

    if (CUE_RE.test(raw)) {
      current.cues.push(i);
      return;
    }
    // A plain `#` note belongs to the line above it, the same way the rewrite
    // step reads one. The three marks do not — they act on the line BELOW.
    if (raw.trim().startsWith("#")) {
      if (!CUT_MARK_RE.test(raw) && !PAUSE_MARK_RE.test(raw) && !TAKE_MARK_RE.test(raw)) current.notes.push(i);
      return;
    }
    if (!raw.trim() || SEGMENT_RE.test(raw)) current = null;
  });

  const byDisplay = new Map(ACTORS.map((a) => [CAST[a].displayName.toUpperCase(), a]));
  for (const entry of entries) entry.actor = byDisplay.get(entry.speaker) ?? null;
  return entries;
}

/** Which show a screenplay belongs to, read from its own title line. */
export function showFromScript(text, fallback = "news") {
  const first = String(text ?? "").split("\n")[0] ?? "";
  const match = Object.values(SHOW_FORMATS).find(
    (f) => first.toUpperCase().startsWith(`${f.title.toUpperCase()} —`),
  );
  return match ? match.id : fallback;
}

/** The episode title printed on the first line, or null. */
export function titleOf(text) {
  const match = TITLE_LINE.exec(String(text ?? "").split("\n")[0] ?? "");
  return match ? match[2].trim() : null;
}

// ── Checking what came back ───────────────────────────────────────────────

const SPEAKERS = new Map(ACTORS.map((a) => [CAST[a].displayName.toUpperCase(), a]));

function oneLine(value, what) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${what} came back empty.`);
  if (text.includes("\n")) throw new Error(`${what} is more than one line.`);
  return text;
}

/**
 * Turn what the model returned into changes that can be applied, or refuse.
 *
 * Every refusal here is a change that would have corrupted the screenplay —
 * a line number that is not in the file, a replacement with a newline in it, a
 * speaker this set does not have. Refusing the whole reply rather than the one
 * change is deliberate: a half-applied proposal is a screenplay nobody asked
 * for, and the producer can simply say it again.
 */
export function validateChanges(raw, entries) {
  const list = Array.isArray(raw) ? raw : [];
  const known = new Map(entries.map((e) => [e.n, e]));
  const clean = [];

  for (const change of list) {
    const op = String(change?.op ?? "");
    const why = typeof change?.why === "string" ? change.why.trim().slice(0, 160) : "";

    const lineNumber = (field) => {
      const n = Number(change?.[field]);
      if (!known.has(n)) throw new Error(`The writer referred to line ${change?.[field]}, which is not in the script.`);
      return n;
    };

    if (op === "reword") {
      const n = lineNumber("n");
      clean.push({ op, n, text: oneLine(change.text, `The replacement for line ${n}`), why, was: known.get(n).text });
      continue;
    }
    if (op === "add") {
      const after = lineNumber("after");
      const speaker = String(change?.speaker ?? "").toUpperCase();
      if (!SPEAKERS.has(speaker)) {
        throw new Error(`"${change?.speaker}" is not on this set — it has ${[...SPEAKERS.keys()].join(" and ")}.`);
      }
      clean.push({ op, after, speaker, text: oneLine(change.text, "The new line"), aimed: Boolean(change.aimed), why });
      continue;
    }
    if (op === "drop") {
      const n = lineNumber("n");
      clean.push({ op, n, why, was: known.get(n).text, speaker: known.get(n).speaker });
      continue;
    }
    if (op === "pause") {
      const n = lineNumber("n");
      const seconds = Number(change?.seconds);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10) {
        throw new Error(`A pause of ${change?.seconds}s is not one this can hold — 0 to 10 seconds.`);
      }
      clean.push({ op, n, seconds: Math.round(seconds * 10) / 10, why });
      continue;
    }
    if (op === "cut") {
      clean.push({ op, n: lineNumber("n"), on: change?.on !== false, why });
      continue;
    }
    if (op === "title") {
      clean.push({ op, text: oneLine(change.text, "The new title"), why });
      continue;
    }
    if (op === "rule") {
      clean.push({ op, text: oneLine(change.text, "The house note"), why });
      continue;
    }
    throw new Error(`The writer asked for "${op}", which is not something the room can do.`);
  }
  return clean;
}

// ── Changing the screenplay ───────────────────────────────────────────────

/** The line as the generator would have written it, so the file stays uniform. */
function renderLine(n, speaker, aimed, text) {
  return `${String(n).padStart(3)}  ${aimed ? "> " : "  "}${speaker.padEnd(10)} ${text}`;
}

/**
 * Renumber the dialogue, the way applying an edit would.
 *
 * The numbers are a reading aid — nothing downstream reads them out of the
 * .txt except the three marks, and those are read by POSITION, from the mark
 * to the next line under it. So renumbering after an insert keeps the file
 * looking like the one the generator wrote, and moves nothing.
 */
export function renumber(text) {
  let n = 0;
  return text
    .split("\n")
    .map((raw) => {
      const match = raw.match(LINE_RE);
      if (!match) return raw;
      const speaker = match[3];
      const body = match[4];
      return renderLine(n++, speaker, Boolean(match[2]), body);
    })
    .join("\n");
}

/**
 * Put the agreed changes into the screenplay.
 *
 * Every line of the file is a slot that can be written over, killed, or have
 * lines put in front of or behind it, and the file is flattened out of those
 * slots at the end. The obvious way to write this is to splice the array as it
 * goes, and it is wrong: two changes about the SAME line — reword line 43 and
 * hold a beat before it — fight, because the insert moves the line the reword
 * was about and the reword lands on the mark. Slots have no positions to move,
 * so the changes cannot interact and the order they arrive in does not matter.
 *
 * House notes are returned rather than written: they go to another file, and
 * this function only knows about this one.
 */
export function applyChanges(text, changes) {
  const lines = text.split("\n");
  const slots = lines.map((line) => ({ text: line, dead: false, before: [], after: [] }));
  const at = new Map(indexScript(text).map((e) => [e.n, e]));
  const applied = [];
  const rules = [];

  for (const change of changes) {
    if (change.op === "title") {
      const match = TITLE_LINE.exec(slots[0]?.text ?? "");
      if (!match) throw new Error("This screenplay has no title line to change.");
      slots[0].text = `${match[1]}${change.text}`;
      applied.push({ ...change, at: 0 });
      continue;
    }

    if (change.op === "rule") {
      rules.push(change.text);
      applied.push(change);
      continue;
    }

    const entry = at.get(change.op === "add" ? change.after : change.n);

    if (change.op === "reword") {
      slots[entry.i].text = `${entry.prefix}${change.text}`;
      applied.push({ ...change, at: entry.n });
      continue;
    }

    if (change.op === "drop") {
      // The line, its animation beats, and any note that was about it. A mark
      // under it belongs to the NEXT line and stays where it is.
      slots[entry.i].dead = true;
      for (const i of [...entry.cues, ...entry.notes]) slots[i].dead = true;
      applied.push({ ...change, at: entry.n });
      continue;
    }

    if (change.op === "add") {
      // Under the line it follows and under anything attached to that line, so
      // a new line never comes between one and its animation beat.
      const last = Math.max(entry.i, ...entry.cues, ...entry.notes);
      slots[last].after.push(renderLine(entry.n + 1, change.speaker, change.aimed, change.text));
      applied.push({ ...change, at: entry.n });
      continue;
    }

    // A mark acts on the line below it, so it goes in front of this one —
    // unless one of its kind is already there, in which case it is that mark
    // being changed. Two `# pause` lines over one line is not an error and not
    // what anybody meant.
    const wanted = change.op === "pause" ? PAUSE_MARK_RE : CUT_MARK_RE;
    const mark = change.op === "pause" ? `# pause ${change.seconds}s` : "# cut";
    const remove = change.op === "pause" ? change.seconds === 0 : change.on === false;

    let top = entry.i;
    while (top > 0 && lines[top - 1].trim().startsWith("#")) top -= 1;
    const existing = lines.slice(top, entry.i).findIndex((l) => wanted.test(l));

    if (existing !== -1) {
      if (remove) slots[top + existing].dead = true;
      else slots[top + existing].text = mark;
    } else if (!remove) {
      slots[entry.i].before.push(mark);
    }
    applied.push({ ...change, at: entry.n, removed: remove });
  }

  const out = [];
  for (const slot of slots) {
    out.push(...slot.before);
    if (!slot.dead) out.push(slot.text);
    out.push(...slot.after);
  }
  return { text: renumber(out.join("\n")), applied, rules };
}

// ── The files ─────────────────────────────────────────────────────────────

/**
 * The screenplay for an episode id, wherever it lives.
 *
 * Staging first, then the committed samples — so the room can be tried against
 * a sample episode on a machine that has no staging area, which is how its
 * tests run.
 */
export function screenplayPath(id, root = process.cwd()) {
  const name = basename(String(id)).replace(/\.(json|txt)$/, "");
  const candidates = [
    resolve(root, EPISODE_DIR, `${name}.txt`),
    resolve(root, SAMPLE_DIR, `${name}.txt`),
    resolve(root, SAMPLE_DIR, `${name}.sample.txt`),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`No screenplay for "${id}". Looked in:\n  ${candidates.join("\n  ")}`);
  return found;
}

/** Where the conversation itself is kept, beside the screenplay it is about. */
export function transcriptPath(id, root = process.cwd()) {
  return resolve(root, EPISODE_DIR, `${basename(String(id))}.room.json`);
}

/**
 * The conversation so far.
 *
 * On disk rather than in the browser, so closing the tab does not lose the
 * room and a run from the terminal picks up where the page left off. An
 * unreadable or missing file is an empty room, not an error.
 */
export async function readTranscript(id, root = process.cwd()) {
  try {
    const data = JSON.parse(await readFile(transcriptPath(id, root), "utf8"));
    return Array.isArray(data?.messages) ? data.messages : [];
  } catch {
    return [];
  }
}

export async function writeTranscript(id, messages, root = process.cwd()) {
  const path = transcriptPath(id, root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ id, messages }, null, 2)}\n`);
}

/**
 * The conversation as the model receives it.
 *
 * Three kinds of entry become two roles: what she said and what the room did
 * are both things said TO the writer, so a note about an applied change is a
 * user turn. Without it the writer proposes the same three lines again,
 * because as far as the transcript is concerned nothing happened.
 */
export function toMessages(transcript) {
  const recent = transcript.slice(-HISTORY_TURNS);
  const out = [];
  for (const entry of recent) {
    const text = String(entry?.text ?? "").slice(0, MAX_MESSAGE_CHARS);
    if (!text) continue;
    const role = entry.role === "writer" ? "assistant" : "user";
    const content = entry.role === "note" ? `[${text}]` : text;
    // The API refuses two turns of the same role in a row, and a note landing
    // after her message is exactly that.
    if (out.length && out[out.length - 1].role === role) {
      out[out.length - 1].content += `\n\n${content}`;
      continue;
    }
    out.push({ role, content });
  }
  // A conversation has to open with her, and the first entry is hers unless a
  // note somehow came first.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// ── One turn ──────────────────────────────────────────────────────────────

/**
 * Say something to the writer and get the answer, with any changes it offers.
 *
 * Appends both sides to the transcript and returns the writer's entry. The
 * changes are validated here and stored with it, so applying them later needs
 * nothing from the browser but which message they were on.
 */
export async function say({ id, text, root = process.cwd(), model = MODEL }) {
  const message = String(text ?? "").trim();
  if (!message) throw new Error("Say something first.");

  const path = screenplayPath(id, root);
  const script = await readFile(path, "utf8");
  const show = showFromScript(script);
  const entries = indexScript(script);

  const transcript = await readTranscript(id, root);
  transcript.push({ role: "producer", text: message.slice(0, MAX_MESSAGE_CHARS), at: new Date().toISOString() });

  const reply = await claude({
    system: roomSystem({
      show,
      script,
      rules: await readStyleNotes(root),
      episode: { id: basename(path).replace(/\.txt$/, ""), title: titleOf(script) },
    }),
    messages: toMessages(transcript),
    model,
    maxTokens: MAX_TOKENS,
  });

  const entry = {
    role: "writer",
    text: String(reply?.say ?? "").trim() || "(the writer said nothing)",
    at: new Date().toISOString(),
    changes: validateChanges(reply?.changes, entries),
    applied: false,
  };
  transcript.push(entry);
  await writeTranscript(id, transcript, root);
  return { entry, transcript, show };
}

/**
 * Put the changes from one of the writer's messages into the screenplay.
 *
 * Addressed by its place in the transcript rather than sent back from the
 * browser: the changes that get applied are then necessarily the ones that
 * were checked when they arrived, and the ones she was looking at.
 */
export async function applyMessage({ id, index, root = process.cwd() }) {
  const transcript = await readTranscript(id, root);
  const entry = transcript[index];
  if (!entry || entry.role !== "writer") throw new Error("That is not a message from the writer.");
  if (entry.applied) throw new Error("Those changes are already in the script.");
  if (!entry.changes?.length) throw new Error("There is nothing to apply on that message.");

  const path = screenplayPath(id, root);
  const script = await readFile(path, "utf8");

  // Re-checked against the file as it is NOW, not as it was when the writer
  // read it. Anything else would let an edit made in between silently land on
  // the wrong line.
  const changes = validateChanges(entry.changes, indexScript(script));
  const { text, applied, rules } = applyChanges(script, changes);
  await writeFile(path, text.endsWith("\n") ? text : `${text}\n`);

  const remembered = [];
  for (const rule of rules) remembered.push({ rule, ...(await rememberStyleNote(rule, root)) });

  // Whatever the room does to the script is said out loud in the transcript,
  // because the writer reads it back on the next turn and because she should
  // be able to see what she agreed to without reading the diff again.
  entry.applied = true;
  transcript.push({
    role: "note",
    text: `applied to the script: ${summarise(applied)}`,
    at: new Date().toISOString(),
  });
  await writeTranscript(id, transcript, root);

  return { text, applied, remembered, parseErrors: await parseErrors(path, text) };
}

/** Mark a proposal as turned down, so the writer stops offering it. */
export async function declineMessage({ id, index, root = process.cwd() }) {
  const transcript = await readTranscript(id, root);
  const entry = transcript[index];
  if (!entry || entry.role !== "writer") throw new Error("That is not a message from the writer.");
  entry.declined = true;
  transcript.push({ role: "note", text: "she turned those changes down", at: new Date().toISOString() });
  await writeTranscript(id, transcript, root);
  return { transcript };
}

export function summarise(applied) {
  if (!applied.length) return "nothing";
  const said = applied.map((c) => {
    if (c.op === "reword") return `reworded ${c.at}`;
    if (c.op === "add") return `a line after ${c.at}`;
    if (c.op === "drop") return `dropped ${c.at}`;
    if (c.op === "pause") return c.removed ? `pause off ${c.at}` : `${c.seconds}s before ${c.at}`;
    if (c.op === "cut") return c.removed ? `cut off ${c.at}` : `a section break before ${c.at}`;
    if (c.op === "title") return `retitled "${c.text}"`;
    if (c.op === "rule") return `a house note: ${c.text}`;
    return c.op;
  });
  return said.join(", ");
}

/**
 * Whatever a later apply would refuse to read, or nothing.
 *
 * The room's promise is that the script still applies afterwards, so it is
 * checked here rather than two steps later. No record beside the script means
 * no check — the edit itself still stands.
 */
async function parseErrors(path, text) {
  try {
    const record = JSON.parse(await readFile(path.replace(/\.txt$/, ".json"), "utf8"));
    parseScript(text, showFormat(record.show));
    return [];
  } catch (err) {
    return err.parseErrors ?? [];
  }
}

// ── The same room, from a terminal ────────────────────────────────────────

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: node scripts/lt-tv-room.mjs <episode id>");
    console.error("  Talk to the writer about an episode. Blank line to leave.");
    process.exit(2);
  }

  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const path = screenplayPath(id);
  console.log(`The writer's room — ${basename(path)} (${MODEL}).`);
  console.log("Say what you think. An empty line leaves; nothing is written until you say yes.\n");

  for (;;) {
    const line = (await rl.question("you  ")).trim();
    if (!line) break;

    const { entry, transcript } = await say({ id, text: line });
    console.log(`\nwriter  ${entry.text}\n`);
    if (!entry.changes.length) continue;

    for (const change of entry.changes) console.log(`  · ${describe(change)}`);
    const yes = (await rl.question("\napply these? [y/N] ")).trim().toLowerCase();
    if (yes === "y" || yes === "yes") {
      const { applied, remembered, parseErrors: bad } = await applyMessage({ id, index: transcript.length - 1 });
      console.log(`\n${basename(path)}: ${summarise(applied)}`);
      for (const r of remembered) {
        console.log(`${STYLE_NOTES_PATH}: ${r.added ? "added" : `not added (${r.reason})`} — ${r.rule}`);
      }
      if (bad.length) {
        console.log("Heads up — the script will not apply until these are fixed:");
        for (const e of bad) console.log(`  ${e}`);
      }
      console.log("");
    } else {
      await declineMessage({ id, index: transcript.length - 1 });
      console.log("Left alone.\n");
    }
  }

  rl.close();
  console.log(`\nApply it when you are happy: node scripts/lt-tv-edit.mjs ${basename(path).replace(/\.txt$/, "")}`);
}

/** One proposed change, for a person reading it in a terminal. */
export function describe(change) {
  const why = change.why ? `  (${change.why})` : "";
  if (change.op === "reword") return `line ${change.n}: ${change.text}${why}\n        was  ${change.was}`;
  if (change.op === "add") return `after ${change.after}, ${change.speaker}: ${change.text}${why}`;
  if (change.op === "drop") return `drop ${change.n} (${change.speaker}: ${change.was})${why}`;
  if (change.op === "pause") {
    return change.seconds === 0 ? `no pause before ${change.n}${why}` : `${change.seconds}s before line ${change.n}${why}`;
  }
  if (change.op === "cut") return `${change.on ? "section break" : "no section break"} before line ${change.n}${why}`;
  if (change.op === "title") return `title: ${change.text}${why}`;
  if (change.op === "rule") return `house note: ${change.text}${why}`;
  return change.op;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
