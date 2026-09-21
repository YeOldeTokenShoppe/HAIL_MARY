// Tests for the writer's room, with:
//
//   node scripts/lt-tv-room.test.mjs
//
// The room is a conversation, and a conversation cannot be tested. What CAN
// ruin an episode is what the conversation is allowed to do to the file, so
// that is what is here: the changes land on the lines they name, they leave
// everything else exactly as it was, and the screenplay still parses
// afterwards. That last one is the promise — an edit that does not apply is
// only discovered two steps later, when the record is rebuilt.
//
// No model is called. `say()` is the only part that needs one, and what it
// returns goes through validateChanges before it touches anything, which is
// tested here with the replies a model actually gets wrong.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  indexScript,
  validateChanges,
  applyChanges,
  renumber,
  showFromScript,
  titleOf,
  toMessages,
  summarise,
} from "./lt-tv-room.mjs";
import { parseScript, readPauseMarks, LINE_RE, PAUSE_MARK_RE } from "./lt-tv-edit.mjs";
import { renderScript } from "./lt-tv-episode.mjs";
import { showFormat } from "./lt-tv-format.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);
const throws = (label, fn, match) => {
  try {
    fn();
    console.log(`  ✗ ${label}\n      expected it to refuse, and it did not`);
    failures += 1;
  } catch (err) {
    if (match && !String(err.message).includes(match)) {
      console.log(`  ✗ ${label}\n      refused with the wrong reason: ${err.message}`);
      failures += 1;
      return;
    }
    console.log(`  ✓ ${label}`);
  }
};

const EPISODE = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/morality-01.sample.json"), "utf8"),
);
const FORMAT = showFormat(EPISODE.show);
const SCRIPT = renderScript(EPISODE);

/** Every spoken line, in order, for comparing two versions of a script. */
const spoken = (text) =>
  text
    .split("\n")
    .map((l) => l.match(LINE_RE))
    .filter(Boolean)
    .map((m) => `${m[3]}|${m[4]}`);

const BEFORE = spoken(SCRIPT);
const apply = (changes, text = SCRIPT) => applyChanges(text, validateChanges(changes, indexScript(text)));

console.log("\nreading the screenplay");
{
  const entries = indexScript(SCRIPT);
  check("every line is found", entries.length, BEFORE.length);
  check("numbered from zero", entries[0].n, 0);
  ok("the file line is not the line number", entries[0].i !== entries[0].n);
  ok("the speaker is read", entries.every((e) => e.actor === "Connor" || e.actor === "Monk"));
  ok("some line has an animation beat", entries.some((e) => e.cues.length > 0));
  check("the show comes from the title line", showFromScript(SCRIPT), "morality");
  check("and the title with it", titleOf(SCRIPT), EPISODE.title);
  check("an unknown banner falls back", showFromScript("SOMETHING ELSE — Hello"), "news");
}

console.log("\nrewording a line");
{
  const { text, applied } = apply([{ op: "reword", n: 4, text: "[dryly] A different sentence entirely." }]);
  check("one change applied", applied.length, 1);
  check("it says so", summarise(applied), "reworded 4");
  const after = spoken(text);
  check("only that line moved", after.filter((l, i) => l !== BEFORE[i]).length, 1);
  check("and it is the one named", after[4], `${BEFORE[4].split("|")[0]}|[dryly] A different sentence entirely.`);
  parseScript(text, FORMAT);
  console.log("  ✓ it still parses");
}

console.log("\nadding and dropping lines");
{
  const { text } = apply([{ op: "add", after: 2, speaker: "saint gr80", text: "A line that was not there.", aimed: true }]);
  const after = spoken(text);
  check("the script is one longer", after.length, BEFORE.length + 1);
  check("the new line is where it was asked for", after[3], "SAINT GR80|A line that was not there.");
  check("what was there is pushed down", after[4], BEFORE[3]);
  ok("it is marked as aimed at the other host", /^\s*3\s+>\s+SAINT GR80\s/.test(text.split("\n").find((l) => l.includes("was not there"))));
  const parsed = parseScript(text, FORMAT);
  check("and it parses as direct address", parsed.segments.flatMap((s) => s.lines)[3].directAddress, true);

  const withCue = indexScript(SCRIPT).find((e) => e.cues.length > 0);
  const dropped = apply([{ op: "drop", n: withCue.n }]).text;
  check("dropping takes the line", spoken(dropped).length, BEFORE.length - 1);
  const beats = (text) => text.split("\n").filter((l) => /^\s+\(\w+ \w+ @/.test(l)).length;
  check("and its animation beats with it", beats(dropped), beats(SCRIPT) - withCue.cues.length);
  parseScript(dropped, FORMAT);
  console.log("  ✓ an orphaned beat would have failed to parse, and did not");
}

console.log("\nrenumbering");
{
  const { text } = apply([{ op: "add", after: 0, speaker: "CONNOR", text: "Inserted." }]);
  const numbers = text
    .split("\n")
    .map((l) => l.match(LINE_RE))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  check("numbers run from zero with no gaps", numbers, numbers.map((_, i) => i));
  check("renumbering an untouched script changes nothing", renumber(SCRIPT), SCRIPT);
}

console.log("\nthe marks the recording reads");
{
  const { text } = apply([{ op: "pause", n: 6, seconds: 1.5 }]);
  check("the pause is on the line it names", readPauseMarks(text).get(6), 1.5);
  ok("written the way the screenplay writes it", text.includes("# pause 1.5s"));
  check("no words changed", spoken(text), BEFORE);

  const changed = apply([{ op: "pause", n: 6, seconds: 0.5 }], text).text;
  // Counted by the mark's own pattern, not by the text "# pause" — the
  // screenplay's header explains the mark, in a line that says it too.
  const pauses = (text) => text.split("\n").filter((l) => PAUSE_MARK_RE.test(l)).length;
  check("asking again replaces it rather than stacking", pauses(changed), 1);
  check("with the new length", readPauseMarks(changed).get(6), 0.5);

  const gone = apply([{ op: "pause", n: 6, seconds: 0 }], changed).text;
  check("and zero takes it out", readPauseMarks(gone).size, 0);

  const cut = apply([{ op: "cut", n: 8, on: true }]).text;
  const lines = cut.split("\n");
  const mark = lines.findIndex((l) => /^\s*#\s*cut\s*$/.test(l));
  ok("a cut goes directly above its line", LINE_RE.exec(lines[mark + 1])?.[1] === "8");
  check("taking it out leaves nothing behind", apply([{ op: "cut", n: 8, on: false }], cut).text, SCRIPT);
  parseScript(cut, FORMAT);
  console.log("  ✓ marks do not stop it parsing");
}

console.log("\nseveral changes at once");
{
  const { text, applied } = apply([
    { op: "reword", n: 2, text: "First." },
    { op: "add", after: 10, speaker: "CONNOR", text: "Middle." },
    { op: "drop", n: 20 },
    { op: "pause", n: 30, seconds: 2 },
  ]);
  check("all four land", applied.length, 4);
  const after = spoken(text);
  check("the reword is at the top", after[2], "CONNOR|First.");
  check("the insert did not move it", after[11], "CONNOR|Middle.");
  check("the drop is below the insert, counted fresh", after.length, BEFORE.length);
  check("the pause still names the right line", readPauseMarks(text).get(30), 2);
  parseScript(text, FORMAT);
  console.log("  ✓ and it parses");
}

console.log("\nthe title and the house notes");
{
  const { text, applied } = apply([{ op: "title", text: "A Better Name" }]);
  check("the title line is rewritten", titleOf(text), "A Better Name");
  check("the banner is untouched", text.split("\n")[0].startsWith("MARKETS & MORALITY — "), true);
  check("no words changed", spoken(text), BEFORE);
  check("it reports what it did", summarise(applied), 'retitled "A Better Name"');

  const rule = apply([{ op: "rule", text: "Connor never explains his own joke." }]);
  check("a house note is handed back rather than written here", rule.rules, ["Connor never explains his own joke."]);
  check("and the screenplay is untouched", rule.text, SCRIPT);
}

console.log("\nwhat it refuses");
{
  const entries = indexScript(SCRIPT);
  const bad = (changes) => () => validateChanges(changes, entries);
  throws("a line that is not in the script", bad([{ op: "reword", n: 9999, text: "x" }]), "not in the script");
  throws("an op it does not have", bad([{ op: "delete-everything", n: 1 }]), "not something the room can do");
  throws("a replacement with a line break in it", bad([{ op: "reword", n: 1, text: "one\ntwo" }]), "more than one line");
  throws("an empty replacement", bad([{ op: "reword", n: 1, text: "   " }]), "came back empty");
  throws("a third character", bad([{ op: "add", after: 1, speaker: "NARRATOR", text: "x" }]), "not on this set");
  throws("a pause longer than the room can hold", bad([{ op: "pause", n: 1, seconds: 45 }]), "0 to 10 seconds");
  throws("a pause that is not a number", bad([{ op: "pause", n: 1, seconds: "a while" }]), "0 to 10 seconds");
  check("and nothing at all is fine", validateChanges(undefined, entries), []);

  // The refusal is of the whole reply. A proposal the producer said yes to
  // must land completely or not at all — half of it is a script she did not
  // agree to and cannot see the shape of.
  throws(
    "one bad change refuses the lot",
    bad([{ op: "reword", n: 1, text: "fine" }, { op: "reword", n: 9999, text: "not" }]),
    "not in the script",
  );
}

console.log("\nthe conversation as the writer receives it");
{
  const turns = toMessages([
    { role: "producer", text: "the middle drags" },
    { role: "writer", text: "agreed, here are three" },
    { role: "note", text: "applied to the script: reworded 12" },
    { role: "producer", text: "better" },
  ]);
  check("her turns and the room's notes are both user turns", turns.map((t) => t.role), ["user", "assistant", "user"]);
  check("a note is folded into the turn beside it", turns[2].content, "[applied to the script: reworded 12]\n\nbetter");
  check("an empty room sends nothing", toMessages([]), []);
  check(
    "a transcript that somehow starts with the writer is trimmed to start with her",
    toMessages([{ role: "writer", text: "hello" }, { role: "producer", text: "hi" }]).map((t) => t.role),
    ["user"],
  );
}

console.log(failures ? `\n${failures} failure(s)\n` : "\nAll good.\n");
process.exit(failures ? 1 : 0);
