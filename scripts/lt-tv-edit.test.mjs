// Tests for editing an episode by editing its script, run with:
//
//   node scripts/lt-tv-edit.test.mjs
//
// Two things here are worth more than the rest. The first is that a rendered
// script parses back into the episode it was rendered from, exactly — if that
// does not hold, every edit silently changes something nobody asked to change.
// The second is that a line which cannot be read is an ERROR rather than a
// line that quietly vanishes: a dropped line still builds, still records, and
// is only noticed when the episode is on air with a sentence missing.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderScript } from "./lt-tv-episode.mjs";
import { parseScript, applyScript, describeEdit } from "./lt-tv-edit.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

/** The message from a parse that was supposed to fail. */
const parseError = (text) => {
  try {
    parseScript(text);
    return null;
  } catch (err) {
    return err.message;
  }
};

const episode = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/news-2026-W38.sample.json"), "utf8"),
);
const script = renderScript(episode);
const lines = (ep) => ep.segments.flatMap((s) => s.lines);

console.log("\nA rendered script parses back into the same episode:");
const parsed = parseScript(script);
const rebuilt = applyScript(episode, parsed);

check("same segments, same lengths",
  rebuilt.segments.map((s) => `${s.id}:${s.lines.length}`),
  episode.segments.map((s) => `${s.id}:${s.lines.length}`));
ok("every line's words survive", lines(rebuilt).every((l, i) => l.text === lines(episode)[i].text));
ok("so does who says it", lines(rebuilt).every((l, i) => l.actor === lines(episode)[i].actor));
ok("and the voice that goes with them", lines(rebuilt).every((l, i) => l.voiceId === lines(episode)[i].voiceId));
check("the counts come out the same", rebuilt.slate, episode.slate);
check("and the blocks pack the same way",
  rebuilt.blocks.map((b) => `${b.id}/${b.chars}`),
  episode.blocks.map((b) => `${b.id}/${b.chars}`));
check("a round trip reports no edit", describeEdit(episode, rebuilt),
  { reworded: 0, added: 0, removed: 0, aimChanged: 0, cuesChanged: 0 });
check("rendering the rebuilt episode gives back the same script", renderScript(rebuilt), script);

console.log("\ndirectAddress survives, which is the one that cannot be recovered:");
// It decides whether the listener turns or the camera pulls wide. It appears
// nowhere but the > marker, so losing it in the round trip would send every
// line to the room and look like nothing had gone wrong.
ok("some lines are aimed at the other host to begin with", lines(episode).some((l) => l.directAddress));
ok("and some are not", lines(episode).some((l) => !l.directAddress));
ok("each line keeps its aim", lines(rebuilt).every((l, i) => Boolean(l.directAddress) === Boolean(lines(episode)[i].directAddress)));
check("there is exactly one marker per aimed line",
  (script.match(/^\s*\d+\s+> /gm) ?? []).length,
  lines(episode).filter((l) => l.directAddress).length);

const unaimed = script.replace(/^(\s*\d+\s+)> /gm, "$1  ");
const flattened = applyScript(episode, parseScript(unaimed));
ok("removing every marker really does re-aim every line", lines(flattened).every((l) => !l.directAddress));
check("and that is reported, not silent", describeEdit(episode, flattened).aimChanged,
  lines(episode).filter((l) => l.directAddress).length);

console.log("\nRewording a line:");
const target = lines(episode)[2].text;
const reworded = applyScript(episode, parseScript(script.replace(target, "Three stories tonight, and one of them is a fish.")));
check("one line reworded, nothing else", describeEdit(episode, reworded),
  { reworded: 1, added: 0, removed: 0, aimChanged: 0, cuesChanged: 0 });
ok("the word count moves with it", reworded.slate.words !== episode.slate.words);
ok("so does the estimated runtime", reworded.slate.estimatedSeconds !== episode.slate.estimatedSeconds);
ok("and the block that holds it is re-measured",
  reworded.blocks[0].chars !== episode.blocks[0].chars);

console.log("\nAdding and deleting lines:");
const withExtra = script.replace(
  /^(\s*1\s+.*SAINT GR80.*)$/m,
  "$1\n  2    CONNOR     [suspiciously] Is it a fish.",
);
const added = applyScript(episode, parseScript(withExtra));
check("the added line is counted", describeEdit(episode, added).added, 1);
check("the episode is one line longer", lines(added).length, lines(episode).length + 1);
ok("numbering stays contiguous from zero", lines(added).every((l, i) => l.n === i));
ok("no number is reused", new Set(lines(added).map((l) => l.n)).size === lines(added).length);

const withoutOne = script.split("\n").filter((l) => !/^\s*1\s+.*SAINT GR80/.test(l)).join("\n");
const deleted = applyScript(episode, parseScript(withoutOne));
check("the deleted line is counted", describeEdit(episode, deleted).removed, 1);
check("the episode is one line shorter", lines(deleted).length, lines(episode).length - 1);
ok("numbering closes the gap", lines(deleted).every((l, i) => l.n === i));

console.log("\nAnimation beats:");
const firstCued = lines(episode).find((l) => l.cues.length);
ok("the sample has one to test with", Boolean(firstCued));
check("its beat survives the round trip",
  lines(rebuilt).find((l) => l.n === firstCued.n).cues.map((c) => [c.actor, c.reaction, c.offset]),
  firstCued.cues.map((c) => [c.actor, c.reaction, c.offset]));
ok("and gets its clip length back from the reaction table",
  lines(rebuilt).find((l) => l.n === firstCued.n).cues.every((c) => c.duration > 0));

ok("a reaction the character does not have is refused",
  parseError(script.replace(/\(Monk lookAround/, "(Monk moonwalk"))?.includes("no reaction"));
ok("the refusal lists what they can do",
  parseError(script.replace(/\(Monk lookAround/, "(Monk moonwalk"))?.includes("headnod"));
ok("a beat for someone not in the cast is refused",
  parseError(script.replace(/\(Monk lookAround/, "(Gary lookAround"))?.includes("not one of this show's characters"));

console.log("\nWhat the parser refuses to guess at:");
ok("a line it cannot read is an error, not a dropped line",
  parseError(script.replace(/^  2 /m, "  ?? "))?.includes("could not read this"));
ok("the error names the line in the file",
  /line \d+:/.test(parseError(script.replace(/^  2 /m, "  ?? ")) ?? ""));
ok("an unknown segment is refused",
  parseError(script.replace("[cold-open]", "[warm-open]"))?.includes("unknown segment"));
ok("dialogue before any segment heading is refused",
  parseError("  0    CONNOR     Hello.")?.includes("before any segment"));
ok("a beat with no line above it is refused",
  parseError(script.replace(/^── COLD OPEN.*$/m, "$&\n   (Monk headnod @ +0.3s)"))?.includes("no line above it"));

console.log("\nWhat it is relaxed about:");
ok("re-indenting a line does not break it",
  parseScript(script.replace(/^  0    CONNOR/m, "0 CONNOR")).segments[0].lines.length === 6);
ok("a note added with # is ignored",
  parseScript(script.replace(/^── COLD OPEN.*$/m, "# rewrite this bit\n$&")).segments.length === episode.segments.length);
ok("blank lines anywhere are fine",
  parseScript(script.replace(/^── COLD OPEN.*$/m, "\n\n$&\n\n")).segments.length === episode.segments.length);
check("the two-word speaker name is not confused for a one-word one",
  parseScript(script).segments[0].lines.map((l) => l.actor),
  episode.segments[0].lines.map((l) => l.actor));

console.log("\nWhat an edit must not move:");
check("the episode number, which names both SitePal uploads", rebuilt.number, episode.number);
check("the clip names themselves", rebuilt.cast, episode.cast);
check("the air date", rebuilt.airDate, episode.airDate);
check("the sources it was built on", rebuilt.sources, episode.sources);
check("the rundown", rebuilt.rundown.stories?.length ?? 0, episode.rundown.stories?.length ?? 0);
check("the id", rebuilt.id, episode.id);
ok("but it records that it was edited", Boolean(rebuilt.provenance.editedAt));

console.log("\nThe title and the chiron are edited in the script too:");
const retitled = applyScript(episode, parseScript(script.replace(episode.title, "A Different Title")));
check("the title follows the script", retitled.title, "A Different Title");
// The studio's title field writes into this same line, so an emptied line is
// what a half-retyped title looks like — not a request for a nameless episode.
const untitled = applyScript(episode, parseScript(script.replace(episode.title, "   ")));
check("an emptied title line keeps the title it had", untitled.title, episode.title);
const rechironed = applyScript(episode, parseScript(script.replace(episode.graphics.headline, "SOMETHING ELSE ENTIRELY")));
check("so does the chiron", rechironed.graphics.headline, "SOMETHING ELSE ENTIRELY");
check("and the ticker, which is not in the script, is left alone", rechironed.graphics.ticker, episode.graphics.ticker);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
