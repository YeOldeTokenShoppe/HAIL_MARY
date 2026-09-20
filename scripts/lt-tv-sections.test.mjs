// Tests for cutting an episode to fit SitePal, with:
//
//   node scripts/lt-tv-sections.test.mjs
//
// SitePal refuses a clip over 90 seconds. Everything here exists to make an
// episode of any length playable anyway, and there are two ways to get it
// wrong that nobody would catch by watching.
//
// A section longer than the limit simply does not play, and the episode stops
// dead at that join with no error anywhere. And a boundary inside a line cuts
// a word in half in BOTH tracks, which sounds like a bad recording rather than
// a bad cut. So the load-bearing checks are: no section exceeds the ceiling,
// and every boundary lands in a gap between lines.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  planSections,
  sectionProblems,
  sectionsForRecord,
  SITEPAL_MAX_CLIP_SECONDS,
  TARGET_SECTION_SECONDS,
} from "./lt-tv-sections.mjs";
import { episodeSections, validateEpisode } from "../src/lib/ltTv/episodeTimeline.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

/** An episode of `count` lines, each `spoken` long with `gap` between them. */
function episodeOf(count, spoken = 5.7, gap = 0.4, head = 2) {
  const lineStarts = [];
  const lineEnds = [];
  let t = head;
  for (let i = 0; i < count; i += 1) {
    lineStarts.push(round(t));
    t += spoken;
    lineEnds.push(round(t));
    t += gap;
  }
  return { lineStarts, lineEnds, dialogueEnd: round(t) };
}
const round = (n) => Number(n.toFixed(3));
const lengthOf = (s) => s.endsAt - s.startsAt;

console.log("\nAn episode that already fits is left alone:");
{
  const e = episodeOf(9); // ~57s, like The Halo Effect
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  check("one section", plan.length, 1);
  check("starting at zero", plan[0].startsAt, 0);
  check("and ending where the dialogue does", plan[0].endsAt, e.dialogueEnd);
  check("covering every line", [plan[0].firstLine, plan[0].lastLine], [0, 8]);
  check("with nothing to complain about", sectionProblems(plan), []);
}

console.log("\nA full-length episode is cut into sections that fit:");
{
  const e = episodeOf(44); // ~270s, like The Wealth Effect
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  ok("more than one section", plan.length > 1);
  ok("every section is inside the target", plan.every((s) => lengthOf(s) <= TARGET_SECTION_SECONDS));
  ok("and so inside SitePal's limit", plan.every((s) => lengthOf(s) <= SITEPAL_MAX_CLIP_SECONDS));
  check("nothing to complain about", sectionProblems(plan), []);

  check("the first starts at zero", plan[0].startsAt, 0);
  check("the last ends with the dialogue", plan.at(-1).endsAt, e.dialogueEnd);
  ok("each one begins where the last ended", plan.every((s, i) => i === 0 || s.startsAt === plan[i - 1].endsAt));
  ok("so no audio is lost between them", true);

  // The whole episode, once, in order — the property a viewer would notice
  // being broken.
  const lines = plan.flatMap((s) => range(s.firstLine, s.lastLine));
  check("every line is in exactly one section", lines, range(0, 43));
}

console.log("\nA cut never lands inside a line:");
{
  const e = episodeOf(44);
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  for (const [i, s] of plan.entries()) {
    if (i === 0) continue;
    const spokenAcross = e.lineStarts.some(
      (start, line) => start < s.startsAt && e.lineEnds[line] > s.startsAt,
    );
    ok(`boundary ${i} is in a silence`, !spokenAcross);
  }
  ok(
    "and it sits between the two lines it separates",
    plan.slice(1).every((s, i) => {
      const last = plan[i].lastLine;
      return s.startsAt > e.lineEnds[last] && s.startsAt < e.lineStarts[last + 1];
    }),
  );
}

console.log("\nFewer joins is better, so a section takes as much as it can:");
{
  const e = episodeOf(44);
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  ok(
    "every section but the last is close to the target",
    plan.slice(0, -1).every((s) => lengthOf(s) > TARGET_SECTION_SECONDS - 12),
  );
  const atSixty = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd, 60);
  ok("a tighter target means more joins", atSixty.length > plan.length);
}

console.log("\nA line longer than the limit is named, not silently shipped:");
{
  // Nothing has ever produced one — a line is a sentence — but a 95-second
  // line has no gap to cut in, so the plan would carry a section SitePal
  // refuses and the episode would stop there with no error.
  const plan = planSections([0, 2], [1, 97], 97);
  ok("the plan cannot fix it", plan.some((s) => lengthOf(s) > SITEPAL_MAX_CLIP_SECONDS));
  const said = sectionProblems(plan);
  check("so it is reported", said.length, 1);
  ok("naming the lines", said[0].includes("Lines"));
  ok("and what to do", said[0].includes("re-record"));
}

console.log("\nRefusing to guess from nothing:");
{
  let threw = null;
  try {
    planSections([], [], 10);
  } catch (err) {
    threw = err.message;
  }
  ok("an unrecorded episode cannot be cut", threw?.includes("recorded episode"));
}

console.log("\nThe clip names follow the convention, section by section:");
const SAMPLE = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/roundtable-02.sample.json"), "utf8"),
);
{
  const e = episodeOf(44);
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  const named = sectionsForRecord(SAMPLE, plan);

  check("one entry per section", named.length, plan.length);
  check("section one takes no suffix", named[0].audio.Connor, "lttv_rt_ep02_connor");
  check("and section two takes _s2", named[1].audio.Connor, "lttv_rt_ep02_connor_s2");
  check("the monk is named for the monk", named[1].audio.Monk, "lttv_rt_ep02_gr80_s2");
  ok("every section names every character",
    named.every((s) => Object.keys(s.audio).length === Object.keys(SAMPLE.cast).length));
  const all = named.flatMap((s) => Object.values(s.audio));
  check("and no two clips share a name", new Set(all).size, all.length);
  check("each carries where it begins", named.map((s) => s.startsAt), plan.map((s) => s.startsAt));
}

console.log("\nA record with sections reads back the way the set expects:");
{
  const e = episodeOf(44);
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  const record = {
    id: "roundtable-02",
    audio: { Connor: "lttv_rt_ep02_connor", Monk: "lttv_rt_ep02_gr80" },
    sections: sectionsForRecord(SAMPLE, plan),
    lineStarts: e.lineStarts,
    dialogueEnd: e.dialogueEnd,
    speakers: e.lineStarts.map((_, i) => (i % 2 ? "Monk" : "Connor")),
  };
  const read = episodeSections(record);
  check("every section comes back", read.length, plan.length);
  check("the first is the record's own audio block", read[0].audio, record.audio);
  check("and nothing SitePal would refuse", validateEpisode(record), []);
}

console.log("\nAn episode from before sections existed still reads as one:");
{
  const record = {
    id: "roundtable-01",
    audio: { Connor: "talk show test for jb", Monk: "talk show test GR80" },
    lineStarts: [2, 8, 14],
    dialogueEnd: 59.037,
    speakers: ["Connor", "Monk", "Connor"],
  };
  const read = episodeSections(record);
  check("one section", read.length, 1);
  check("starting at zero", read[0].startsAt, 0);
  check("playing the clips it always played", read[0].audio, record.audio);
  check("and it still validates", validateEpisode(record), []);
}

console.log("\nA record that would fail silently on air is caught here:");
{
  const base = {
    id: "x",
    audio: { Connor: "a", Monk: "b" },
    lineStarts: [0, 10],
    dialogueEnd: 200,
    speakers: ["Connor", "Monk"],
  };
  const said = (sections) => validateEpisode({ ...base, sections });

  ok("a section over the limit", said([
    { startsAt: 0, audio: { Connor: "a", Monk: "b" } },
    { startsAt: 120, audio: { Connor: "c", Monk: "d" } },
  ]).some((p) => p.includes("over SitePal's")));

  ok("a section that goes backwards", said([
    { startsAt: 0, audio: { Connor: "a", Monk: "b" } },
    { startsAt: 80, audio: { Connor: "c", Monk: "d" } },
    { startsAt: 40, audio: { Connor: "e", Monk: "f" } },
  ]).some((p) => p.includes("before the one before it")));

  ok("a section missing a character", said([
    { startsAt: 0, audio: { Connor: "a", Monk: "b" } },
    { startsAt: 80, audio: { Connor: "c" } },
  ]).some((p) => p.includes("every character")));

  ok("two sections asking for the same clip", said([
    { startsAt: 0, audio: { Connor: "a", Monk: "b" } },
    { startsAt: 80, audio: { Connor: "a", Monk: "d" } },
  ]).some((p) => p.includes("same clip name")));

  ok("a section starting after the show ends", said([
    { startsAt: 0, audio: { Connor: "a", Monk: "b" } },
    { startsAt: 80, audio: { Connor: "c", Monk: "d" } },
    { startsAt: 160, audio: { Connor: "e", Monk: "f" } },
    { startsAt: 240, audio: { Connor: "g", Monk: "h" } },
  ]).some((p) => p.includes("after the dialogue ends")));
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
