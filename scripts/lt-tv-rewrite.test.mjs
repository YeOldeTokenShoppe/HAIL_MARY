// Tests for rewriting marked lines, with:
//
//   node scripts/lt-tv-rewrite.test.mjs
//
// Two things here can quietly ruin an episode. The first is misreading which
// line a note is about — rewriting line 41 because the note under 42 was read
// as belonging to the line after it. The second is editing the screenplay into
// something that no longer parses, which would only show up two steps later
// when the edit is applied.
//
// So the load-bearing check is a round trip: render a real episode, mark a
// line, rewrite it, and parse the result back. If the file still parses and
// only the marked line differs, the edit was surgical.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { findMarks, applyRewrites, validateReplacements } from "./lt-tv-rewrite.mjs";
import { parseScript } from "./lt-tv-edit.mjs";
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

const EPISODE = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/roundtable-02.sample.json"), "utf8"),
);
const FORMAT = showFormat(EPISODE.show);
const SCRIPT = renderScript(EPISODE);

/** Put a note under the line numbered `n`, the way a person would. */
function mark(script, n, note) {
  const lines = script.split("\n");
  const at = lines.findIndex((l) => new RegExp(`^\\s*${n}\\s`).test(l));
  if (at === -1) throw new Error(`no line ${n} in the sample`);
  lines.splice(at + 1, 0, note);
  return lines.join("\n");
}

// The numbers as the screenplay actually prints them, rather than an
// assumption about where numbering starts.
const [lineA, lineB] = SCRIPT.split("\n")
  .map((l) => l.match(/^\s*(\d+)\s+\S/))
  .filter(Boolean)
  .map((m) => Number(m[1]))
  .slice(0, 2);

console.log("\nThe header's own # lines are not notes:");
check("an unmarked script has nothing marked", findMarks(SCRIPT), []);
ok("even though the header is full of them", SCRIPT.includes("\n# Reword any line"));

console.log("\nA note belongs to the line above it:");
{
  const marks = findMarks(mark(SCRIPT, lineB, "# too on-the-nose"));
  check("one line is marked", marks.length, 1);
  check("and it is the one above the note", marks[0].n, lineB);
  check("with the note attached", marks[0].notes.map((n) => n.text), ["too on-the-nose"]);
  check("and not flagged to remember", marks[0].notes[0].remember, false);
}

console.log("\nA note typed with a space after the hash still counts:");
{
  const marks = findMarks(mark(SCRIPT, lineB, "# ! he explains his own joke"));
  check("the text is the note", marks[0].notes[0].text, "he explains his own joke");
  check("and the space did not lose the marker", marks[0].notes[0].remember, true);
}

console.log("\n#! means remember it too:");
{
  const marks = findMarks(mark(SCRIPT, lineB, "#! he never explains his own joke"));
  check("the text drops the marker", marks[0].notes[0].text, "he never explains his own joke");
  check("and it is flagged", marks[0].notes[0].remember, true);
}

console.log("\nSeveral notes, and several lines:");
{
  const marks = findMarks(mark(mark(SCRIPT, lineB, "# second thought"), lineA, "# first"));
  check("both lines are marked", marks.map((m) => m.n).sort((x, y) => x - y), [lineA, lineB]);
  const two = findMarks(mark(mark(SCRIPT, lineB, "# and colder"), lineB, "# too long"));
  check("two notes on one line stay together", two.length, 1);
  check("both of them", two[0].notes.length, 2);
}

console.log("\nRewriting replaces the line and removes the note:");
const REPLACEMENT = "Nobody rings a bell, and nobody needs to.";
{
  const marked = mark(SCRIPT, lineB, "# too on-the-nose");
  const marks = findMarks(marked);
  const { text, changed } = applyRewrites(marked, marks, [{ n: lineB, text: REPLACEMENT }]);

  check("it reports the change", changed.length, 1);
  check("with what it was", changed[0].before, marks[0].text);
  check("and what it is now", changed[0].after, REPLACEMENT);
  ok("the note is gone", !text.includes("# too on-the-nose"));
  ok("the new words are in", text.includes(REPLACEMENT));
  check("and the file is no longer marked", findMarks(text), []);
}

console.log("\nAnd the screenplay still parses, with only that line different:");
{
  const marked = mark(SCRIPT, lineB, "# too on-the-nose");
  const { text } = applyRewrites(marked, findMarks(marked), [{ n: lineB, text: REPLACEMENT }]);

  const before = parseScript(SCRIPT, FORMAT);
  const after = parseScript(text, FORMAT);

  const flat = (p) => p.segments.flatMap((s) => s.lines);
  check("the same number of lines", flat(after).length, flat(before).length);
  check("the same speakers, in the same order",
    flat(after).map((l) => l.actor), flat(before).map((l) => l.actor));
  check("the same aim markers",
    flat(after).map((l) => l.directAddress), flat(before).map((l) => l.directAddress));
  check("the same cues",
    JSON.stringify(flat(after).map((l) => l.cues)), JSON.stringify(flat(before).map((l) => l.cues)));
  const differing = flat(after).filter((l, i) => l.text !== flat(before)[i].text);
  check("exactly one line differs", differing.length, 1);
  check("and it is the one that was rewritten", differing[0].text, REPLACEMENT);
}

// The way a long line actually gets marked: press Return in front of the
// sentence you object to, and write the note there. That splits the line, and
// the second half stops looking like dialogue.
function splitAt(script, n, at, ...notes) {
  const lines = script.split("\n");
  const i = lines.findIndex((l) => new RegExp(`^\\s*${n}\\s`).test(l));
  if (i === -1) throw new Error(`no line ${n} in the sample`);
  const cut = lines[i].indexOf(at);
  if (cut === -1) throw new Error(`"${at}" is not in line ${n}`);
  lines.splice(i, 1, lines[i].slice(0, cut).trimEnd(), notes[0], lines[i].slice(cut), ...notes.slice(1));
  return lines.join("\n");
}

console.log("\nA note in the MIDDLE of a line belongs to that line:");
{
  // Pick a line long enough to have a second sentence to object to.
  const long = parseScript(SCRIPT, FORMAT).segments
    .flatMap((s) => s.lines)
    .map((l, i) => ({ l, i }))
    .find(({ l }) => / [A-Z]/.test(l.text.slice(20)));
  const numbers = SCRIPT.split("\n").map((l) => l.match(/^\s*(\d+)\s+\S/)).filter(Boolean).map((m) => Number(m[1]));
  const n = numbers[long.i];
  const whole = long.l.text;
  const at = whole.slice(20).match(/ ([A-Z][a-z]+)/)[1];
  const stranded = whole.slice(whole.indexOf(at, 20)); // what ends up below the note

  const marked = splitAt(SCRIPT, n, at, "# the first half is corny", "# and so is the second");
  const marks = findMarks(marked);
  check("one line is marked, not two", marks.length, 1);
  check("and it is the line that was split", marks[0].n, n);
  check("its text is the whole line, put back together", marks[0].text, whole);
  check("with both notes on it", marks[0].notes.length, 2);

  const { text, changed } = applyRewrites(marked, marks, [{ n, text: REPLACEMENT }]);
  check("one line changed", changed.length, 1);
  check("and what it replaced was the whole line", changed[0].before, whole);
  ok("the stranded half is gone", !text.split("\n").some((l) => l.trim() === stranded.trim()));

  const after = parseScript(text, FORMAT);
  const before = parseScript(SCRIPT, FORMAT);
  const flat = (p) => p.segments.flatMap((s) => s.lines);
  check("the script still parses, same number of lines", flat(after).length, flat(before).length);
  const differing = flat(after).filter((l, i) => l.text !== flat(before)[i].text);
  check("exactly one line differs", differing.length, 1);
  check("and it is the rewritten one", differing[0].text, REPLACEMENT);
}

console.log("\nStructure is never swallowed as part of a line:");
{
  // A cue, a heading and a blank all end the line above them, so none of them
  // can be absorbed into the line's text by the rule that repairs a split.
  const cueLine = SCRIPT.split("\n").find((l) => /^\s*\(/.test(l));
  const marks = findMarks(mark(SCRIPT, lineB, "# too on-the-nose"));
  ok("a cue is not part of the line above it", !marks[0].text.includes(cueLine.trim()));
  check("and nothing was absorbed at all", marks[0].parts, []);
}

console.log("\nA line the model left alone is left alone:");
{
  const marked = mark(mark(SCRIPT, lineB, "# second"), lineA, "# first");
  const marks = findMarks(marked);
  const { text, changed } = applyRewrites(marked, marks, [{ n: lineA, text: REPLACEMENT }]);
  check("only one was changed", changed.map((c) => c.n), [lineA]);
  check("and the other is still marked, so you can see it was skipped",
    findMarks(text).map((m) => m.n), [lineB]);
}

console.log("\nA reply that would corrupt the script is refused:");
{
  const marks = findMarks(mark(SCRIPT, lineB, "# too on-the-nose"));
  const refuses = (raw) => {
    try {
      validateReplacements(raw, marks);
      return null;
    } catch (err) {
      return err.message;
    }
  };
  ok("no list at all", refuses({}));
  ok("a line that was never marked", refuses({ replacements: [{ n: 999, text: "x" }] }));
  ok("an empty replacement", refuses({ replacements: [{ n: lineB, text: "   " }] }));
  ok("a replacement that is two lines", refuses({ replacements: [{ n: lineB, text: "a\nb" }] }));
  ok("a replacement that is not a string", refuses({ replacements: [{ n: lineB, text: 42 }] }));
  ok("an empty list", refuses({ replacements: [] }));
  check("and a good one is accepted, trimmed",
    validateReplacements({ replacements: [{ n: lineB, text: "  fine  " }] }, marks),
    [{ n: lineB, text: "fine" }]);
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
