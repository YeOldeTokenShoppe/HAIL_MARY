// Tests for the episode's ON-SCREEN COPY — the chiron's chapters and the
// ticker's crawl. Run with:
//
//   node scripts/lt-tv-chapters.test.mjs
//
// Both are graphics nobody reads aloud, which is exactly what makes them worth
// testing: a wrong chapter puts "CRYPTO" over a story about Treasury yields
// and a wrong ticker item states something the show never verified, and a
// producer watching a run-through would take either for a design choice.
//
// THE LOAD-BEARING CHECK is that a chapter is anchored on a LINE and not on a
// SECOND. Every absolute time in an episode is rewritten by the audio build,
// so a chapter carrying `at: 128.4` goes quietly out of step the first time a
// line is re-rendered — and the fault reads as a mistuned lead-in, which is
// the trap this codebase has already been caught by once. So the chapters go
// through the same lineStarts resolution the reaction cues use, and the test
// re-records the episode at a different speed and asserts the graphics moved
// with it.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildChapters, keepScreenCopy, numbersChecked } from "./lt-tv-chapters.mjs";
import { buildTicker } from "./lt-tv-episode.mjs";
import { toSlateRecord } from "./lt-tv-slate-record.mjs";
import {
  buildEpisodeTimeline,
  chapterIndexAt,
  episodeChapters,
  validateEpisode,
} from "../src/lib/ltTv/episodeTimeline.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const SAMPLE = "content/lt-tv/samples/news-2026-W38.sample.json";
const episode = JSON.parse(await readFile(resolve(SAMPLE), "utf8"));
const chapters = buildChapters(episode);

console.log("\nOne chapter per segment, in running order:");
check("a chapter for every segment", chapters.length, episode.segments.length);
check(
  "in the order the show plays them",
  chapters.map((c) => c.segment),
  episode.segments.map((s) => s.id),
);
check(
  "each starts on its segment's first line",
  chapters.map((c) => c.line),
  episode.segments.map((s) => s.lines[0].n),
);
ok("the episode opens on line 0", chapters[0].line === 0);
ok("line numbers never go backwards", chapters.every((c, i) => i === 0 || c.line > chapters[i - 1].line));

console.log("\nThe copy comes off the rundown, never invented:");
const story1 = episode.rundown.stories.find((s) => s.slot === "story-1");
const lead = chapters.find((c) => c.segment === "story-1");
check("a story's chiron is that story's headline", lead.headline, story1.headline);
check("its plate is the beat it was filed under", lead.kicker, "Macro");
check("the screen carries the story's one concrete fact", lead.screen.lines, [story1.fact]);
const board = chapters.find((c) => c.segment === "the-board");
check("the board lists the week's numbers", board.screen.lines, episode.rundown.board.lines);
check("and quotes the prediction market under them", board.screen.note, episode.rundown.board.market);
const open = chapters.find((c) => c.segment === "cold-open");
check("the cold open sits on the episode's own headline", open.headline, episode.graphics.headline);
check(
  "and shows tonight's running order",
  open.screen.lines,
  episode.rundown.stories.map((s) => s.headline),
);
const everyString = JSON.stringify(chapters);
ok(
  "every headline on screen is one the rundown wrote",
  chapters.every((c) =>
    c.headline === episode.graphics.headline ||
    episode.rundown.stories.some((s) => s.headline === c.headline) ||
    c.headline === "The week in numbers"),
);
ok("nothing empty is drawn", !everyString.includes('"headline":""'));

console.log("\nThe studio screen gets copy written for a screen:");
{
  const fact = "Brent rebounded 3.9% to $103.08 on Wednesday after five straight down sessions.";
  const withScreen = structuredClone(episode);
  const s1 = withScreen.rundown.stories.find((s) => s.slot === "story-1");
  s1.fact = fact;
  s1.screen = { headline: "Oil bounces", figure: "$103.08", label: "Brent, Wednesday", points: ["Up 3.9% in a day", "extra"] };
  const s2 = withScreen.rundown.stories.find((s) => s.slot === "story-2");
  s2.screen = { headline: "Short one", figure: "$999", label: "made up", points: ["Invented 42% move", "No numbers here"] };
  withScreen.rundown.board.lines = ["The ten-year closed at 4.96%", "WTI settled at $96.41, down 9.91%"];
  withScreen.rundown.board.screen = ["10-yr  4.96%", "WTI  $96.41 ▼9.9%", "Gold  $7,777.77"];
  const warned = [];
  const built = buildChapters(withScreen, { warn: (m) => warned.push(m) });
  const one = built.find((c) => c.segment === "story-1");
  check("a figure story shows its figure, label and ONE line", [one.screen.figure, one.screen.label, one.screen.lines], ["$103.08", "Brent, Wednesday", ["Up 3.9% in a day"]]);
  check("with the screen's short headline", one.screen.headline, "Oil bounces");
  check("while the chiron keeps the story headline", one.headline, s1.headline);
  const two = built.find((c) => c.segment === "story-2");
  ok("a figure not in the fact is dropped", !two.screen.figure);
  check("and so is a bullet with an unchecked number", two.screen.lines, ["No numbers here"]);
  const boardCard = built.find((c) => c.segment === "the-board");
  check("the board lists short items, checked against its lines", boardCard.screen.lines, ["10-yr  4.96%", "WTI  $96.41 ▼9.9%"]);
  check("every drop is reported", warned.length, 3);
  check("the running order uses the short headlines", built.find((c) => c.segment === "cold-open").screen.lines[0], "Oil bounces");
  ok("authored cards are not marked derived", !one.screen.derived);
  ok("a card built from the fact is", chapters.find((c) => c.segment === "story-1").screen.derived);
}

console.log("\nNumbers are matched as written or rounded, never invented:");
ok("rounded is fine", numbersChecked("Brent $99", "Brent settled at $99.25"));
ok("a thousands comma is fine", numbersChecked("Dow 51,512", "The Dow closed 51,511.59"));
ok("a different number is not", !numbersChecked("Brent $98", "Brent settled at $99.25"));
ok("a label like 10-yr is not a number", numbersChecked("10-yr 4.96%", "the ten-year at 4.96%"));
ok("a 72-year-old in the fact counts", numbersChecked("Ohio man, 72", "A 72-year-old Ohio man"));

console.log("\nA card written onto the slate by hand survives a re-stage:");
{
  const handMade = chapters.map((c) =>
    c.segment === "story-1" ? { ...c, screen: { kicker: c.kicker, headline: "Short", lines: ["a", "b"], note: "" } } : c);
  const kept = keepScreenCopy(chapters, handMade);
  check("the same story keeps its hand-written card", kept.find((c) => c.segment === "story-1").screen.headline, "Short");
  const nextWeek = chapters.map((c) => (c.segment === "story-1" ? { ...c, source: "A different story" } : c));
  check("next week's story-1 does not inherit it", keepScreenCopy(nextWeek, handMade).find((c) => c.segment === "story-1").screen.lines, [story1.fact]);
}

console.log("\nA show with no chiron gets no chapters:");
check("the roundtable stays as it was", buildChapters({ ...episode, graphics: undefined }), []);

console.log("\nStaging carries them onto the slate record:");
const staged = toSlateRecord(episode);
check("the slate record carries the chapters", staged.graphics.chapters.length, chapters.length);
check("and keeps the headline and ticker beside them", staged.graphics.headline, episode.graphics.headline);
ok("a production record needs no re-writing to gain them", !("chapters" in episode.graphics));

console.log("\nAnchored on a line, so a re-record moves the graphics with it:");
// Two recordings of the same script at different speeds. Nothing about the
// chapters changes between them; only lineStarts does.
const lineCount = episode.segments.flatMap((s) => s.lines).length;
const recordAt = (secondsPerLine) => ({
  ...staged,
  lineStarts: Array.from({ length: lineCount }, (_, i) => Number((i * secondsPerLine).toFixed(3))),
  dialogueEnd: lineCount * secondsPerLine,
  audio: { Connor: "a", Monk: "b" },
});
const brisk = episodeChapters(recordAt(4));
const slow = episodeChapters(recordAt(6));
check("the same chapters either way", brisk.map((c) => c.segment), slow.map((c) => c.segment));
check("the lead story lands at 4s a line", brisk.find((c) => c.segment === "story-1").at, lead.line * 4);
check("and later at 6s a line", slow.find((c) => c.segment === "story-1").at, lead.line * 6);
ok("no chapter carries a stored time of its own", chapters.every((c) => !("at" in c)));

console.log("\nWhich chapter is on air:");
const timeline = buildEpisodeTimeline(recordAt(4));
check("chapters ride on the timeline", timeline.chapters.length, chapters.length);
check("stopped, the show sits at the top", chapterIndexAt(timeline, 999, false), 0);
check("before the first line lands, the same", chapterIndexAt(timeline, -1, true), 0);
check("one second into the lead story", chapterIndexAt(timeline, lead.line * 4 + 1, true), chapters.indexOf(lead));
check("a frame before it, still the cold open", chapterIndexAt(timeline, lead.line * 4 - 0.01, true), 0);
check("past the last line, the sign-off", chapterIndexAt(timeline, 1e6, true), chapters.length - 1);
check("an episode with no chapters says so", chapterIndexAt({ chapters: [] }, 10, true), -1);

console.log("\nA chapter off the end of the script is reported, not resolved:");
const broken = { ...recordAt(4), graphics: { ...staged.graphics, chapters: [...chapters, { line: 9999, segment: "ghost", headline: "x", kicker: "", screen: {} }] } };
ok("validateEpisode names it", validateEpisode(broken).some((p) => p.includes("graphics.chapters")));
check("and it is dropped rather than drawn at NaN", episodeChapters(broken).length, chapters.length);

console.log("\nThe ticker crawls what the show is NOT covering:");
const brief = { signals: { macro: { headlines: ["Jobless claims fall to a four-month low", "ECB holds its deposit rate"] } } };
const rundown = {
  ticker: ["FOMC HOLDS RATES, STATEMENT LEANS HAWKISH", "Nothing on this ticker is a recommendation"],
  stories: [{ headline: "FOMC holds, statement leans hawkish", fact: "The committee held rates steady for a second meeting." }],
  sidebar: [
    { text: "JOBLESS CLAIMS FALL TO A FOUR-MONTH LOW", source: "Jobless claims fall to a four-month low" },
    { text: "ECB HOLDS ITS DEPOSIT RATE", source: "ECB holds its deposit rate" },
  ],
};
const ticker = buildTicker(rundown, brief);
ok("tonight's story still leads the crawl", ticker.items[0].startsWith("FOMC HOLDS"));
ok("a story the show is not covering follows it", ticker.items.includes("JOBLESS CLAIMS FALL TO A FOUR-MONTH LOW"));
check("the disclaimer is said once, by the code", ticker.items.filter((i) => /recommendation/i.test(i)).length, 1);
check("and it is said last", ticker.items[ticker.items.length - 1], "NOTHING ON THIS TICKER IS A RECOMMENDATION");
check("a clean crawl warns about nothing", ticker.warnings, []);

console.log("\nAnd it is held to the brief:");
const restated = buildTicker({ ...rundown, sidebar: [{ text: "FOMC HOLDS RATES STEADY FOR A SECOND MEETING", source: "x" }] }, brief);
ok("a sidebar item that restates tonight's lead is dropped", !restated.items.some((i) => i.includes("SECOND MEETING")));
ok("and the producer is told why", restated.warnings.some((w) => w.includes("restates a story")));
const ungrounded = buildTicker({ ...rundown, sidebar: [{ text: "SILVER PRICES SURGE ON INDUSTRIAL DEMAND", source: "silver surges" }] }, brief);
// The near miss the first draft of this got wrong: a different central bank
// holding a different rate shares most of its short words with tonight's lead
// and is not the same story.
ok("a near-miss headline on the same beat is NOT mistaken for a restatement", ticker.items.includes("ECB HOLDS ITS DEPOSIT RATE"));
ok("an item that traces to nothing in the brief is flagged", ungrounded.warnings.some((w) => w.includes("cannot be traced")));
ok("but kept, because the check is a heuristic and the producer decides", ungrounded.items.some((i) => i.includes("SILVER")));
check("no brief, no traceability check to run", buildTicker({ ...rundown, sidebar: [{ text: "SILVER PRICES SURGE" }] }, null).warnings, []);
check("duplicates crawl once", buildTicker({ ticker: ["A", "a"] }).items, ["A", "NOTHING ON THIS TICKER IS A RECOMMENDATION"]);

console.log(failures ? `\n${failures} failing\n` : "\nAll good\n");
process.exit(failures ? 1 : 0);
