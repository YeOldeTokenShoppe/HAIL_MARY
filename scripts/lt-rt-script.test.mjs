// Tests for the roundtable's format, run with:
//
//   node scripts/lt-rt-script.test.mjs
//
// The roundtable and the news show share one assembler, which is the point and
// also the risk: a change made for one show silently reaches the other. So the
// checks here are mostly about the seam — that the two shows really do differ
// where they are supposed to, and really are identical everywhere else.
//
// Nothing here calls a model. The worked sample was written by hand, which is
// what makes the assembly path testable at all.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  SHOW_FORMATS,
  showFormat,
  ROUNDTABLE_SEGMENTS,
  SEGMENTS,
  sitepalClipName,
  estimateSeconds,
} from "./lt-tv-format.mjs";
import { assemble, renderScript } from "./lt-tv-episode.mjs";
import { parseScript, applyScript } from "./lt-tv-edit.mjs";
import { toSlateRecord } from "./lt-tv-slate-record.mjs";
import { unwrittenTopics } from "./lt-rt-script.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);
const threw = (label, fn, fragment) => {
  try {
    fn();
    check(label, "no error", `an error mentioning "${fragment}"`);
  } catch (err) {
    ok(label, err.message.includes(fragment));
  }
};

const draft = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/roundtable-02.draft.json"), "utf8"),
);
const format = showFormat("roundtable");
const episode = assemble({
  rundown: { ...draft.plan, title: draft.topic.keep.title, summary: draft.topic.keep.summary },
  segments: draft.segments,
  number: 2,
  format,
  producedBy: { model: null, pipeline: "scripts/lt-rt-script.mjs" },
});
const lines = (ep) => ep.segments.flatMap((s) => s.lines);

console.log("\nThe roundtable is its own show, not the news show renamed:");
check("its segments are the debate's shape", episode.segments.map((s) => s.id), ROUNDTABLE_SEGMENTS.map((s) => s.id));
ok("which is not the news skeleton", ROUNDTABLE_SEGMENTS.map((s) => s.id).join() !== SEGMENTS.map((s) => s.id).join());
check("the record says which show it is", episode.show, "roundtable");
check("it is numbered, not dated", episode.id, "roundtable-02");
ok("and carries no week, because nothing happened this week", !("week" in episode));
ok("it has no chiron, because the set has never had one", !episode.graphics);
check("the uploads use the roundtable's clip prefix", episode.cast.Connor.sitepalAudio, "lttv_rt_ep02_connor");
check("both of them", episode.cast.Monk.sitepalAudio, sitepalClipName("roundtable", 2, "Monk"));
ok("the news show still names its clips its own way", sitepalClipName("news", 2, "Connor") === "lttv_news_ep02_connor");

console.log("\nEverything downstream is shared, and must stay shared:");
ok("lines are numbered across the whole episode", lines(episode).every((l, i) => l.n === i));
ok("every line carries the voice its actor speaks with", lines(episode).every((l) => l.voiceId));
ok("the blocks fit an ElevenLabs request", episode.blocks.every((b) => b.chars <= 2000));
ok("every block knows its first and last line", episode.blocks.every((b) => b.firstLine !== null && b.lastLine !== null));
check("the blocks cover every line, once", episode.blocks.reduce((n, b) => n + (b.lastLine - b.firstLine + 1), 0), lines(episode).length);
ok("timing is left for the audio build", episode.timing.lineStarts === null);
check("the runtime estimate agrees with the word count", episode.slate.estimatedSeconds, Number(estimateSeconds(episode.slate.words).toFixed(1)));

console.log("\nIt reaches the guide the same way a news episode does:");
const slate = toSlateRecord(episode);
check("under its own show", slate.showId, "roundtable");
check("named for the slate", slate.id, "roundtable-02");
check("one speaker per line", slate.speakers.length, lines(episode).length);
ok("not playable until it is recorded", !("lineStarts" in slate) && !("audio" in slate));
ok("so the guide is told the runtime is an estimate", Boolean(slate.estimatedRuntime));
// Same inversion as the news show: an audience line is one that is NOT aimed
// at the other host. This show is mostly two people talking to each other, so
// getting it backwards here would send nearly every line to the room.
check("audience lines are the ones NOT aimed at the other host",
  slate.audienceLines,
  lines(episode).flatMap((l) => (l.directAddress ? [] : [l.n])));
ok("and they are the minority, as a two-hander should be", slate.audienceLines.length < lines(episode).length / 2);

console.log("\nThe screenplay knows which show it belongs to:");
const script = renderScript(episode);
ok("it is headed with the roundtable's name", script.startsWith("THE LIMINAL TERMINAL — The Wealth Effect"));
ok("not the news show's", !script.includes("LT WEEKLY NEWS RECAP"));
ok("there is no chiron line to edit", !script.includes("CHIRON:"));
ok("the week is not printed as undefined", !script.includes("undefined"));

console.log("\nAnd it edits like one:");
const rebuilt = applyScript(episode, parseScript(script, format));
ok("a round trip changes nothing", lines(rebuilt).every((l, i) => l.text === lines(episode)[i].text));
ok("aim survives", lines(rebuilt).every((l, i) => Boolean(l.directAddress) === Boolean(lines(episode)[i].directAddress)));
check("the counts come out the same", rebuilt.slate, episode.slate);
check("and it is still the roundtable", rebuilt.show, "roundtable");
// The editor picks its skeleton from the record, so a roundtable script fed to
// the news skeleton must be refused rather than half-read.
threw("a roundtable script is refused against the news skeleton",
  () => parseScript(script, SHOW_FORMATS.news), "unknown segment");

console.log("\nWhat the shows disagree about is only what the format says:");
check("the news show runs longer at the top end", SHOW_FORMATS.news.runtime.max > format.runtime.max, true);
ok("this episode lands inside the roundtable's window",
  episode.slate.estimatedSeconds >= format.runtime.min && episode.slate.estimatedSeconds <= format.runtime.max);
ok("no segment of this show is optional", format.optional.size === 0);
ok("the news show has exactly one", SHOW_FORMATS.news.optional.size === 1);
threw("an unknown show is refused by name", () => showFormat("gardening"), "Unknown show");

console.log("\nThe topic queue is the slate itself:");
const waiting = await unwrittenTopics();
ok("there are episodes waiting to be written", waiting.length > 0);
ok("every one of them is a roundtable", waiting.every((r) => r.showId === "roundtable"));
ok("none of them is already recorded", waiting.every((r) => !r.lineStarts?.length));
ok("each carries the title it was named with", waiting.every((r) => r.title && r.summary));

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
