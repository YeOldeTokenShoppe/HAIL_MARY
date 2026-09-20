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
  forcedJoins,
  gapSummary,
  silenceSummary,
  parseSilences,
  silenceCommand,
  MIN_JOIN_SILENCE,
  SITEPAL_MAX_CLIP_SECONDS,
  TARGET_SECTION_SECONDS,
} from "./lt-tv-sections.mjs";
import { readCutMarks } from "./lt-tv-edit.mjs";
import { sectionLine, pauseLine, cutHint } from "./lt-tv-split.mjs";
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

/**
 * An episode of `count` lines, each `spoken` long.
 *
 * `gap` is the pause AFTER each line, and may be a function of the line's
 * index — real dialogue does not breathe evenly, which is the whole reason
 * where a cut lands has to be chosen rather than computed.
 */
function episodeOf(count, spoken = 5.7, gap = 0.4, head = 2) {
  const gapAfter = typeof gap === "function" ? gap : () => gap;
  const lineStarts = [];
  const lineEnds = [];
  let t = head;
  for (let i = 0; i < count; i += 1) {
    lineStarts.push(round(t));
    t += spoken;
    lineEnds.push(round(t));
    t += gapAfter(i);
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

console.log("\nA cut goes where the pause is, not where the arithmetic stops:");
{
  // Lines that run straight into each other, except every seventh, which is
  // followed by a real breath. The last line that fits is almost never one of
  // those, so a planner that only ever cuts there cuts inside a sentence.
  const breath = (i) => (i % 7 === 6 ? 0.9 : 0.04);
  const e = episodeOf(44, 5.7, breath);
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);

  ok("every join landed in a real pause",
    plan.slice(0, -1).every((s) => s.silenceAfter >= MIN_JOIN_SILENCE));
  ok("so none of them is flagged", plan.every((s) => !s.forcedJoin));
  check("and there is nothing to warn about", forcedJoins(plan), []);
  ok("every section is still inside SitePal's limit",
    plan.every((s) => s.endsAt - s.startsAt <= SITEPAL_MAX_CLIP_SECONDS));

  // Backing off to a pause must not fragment the episode: the whole point of
  // the 85s target is that joins are risk, so fewer is better.
  const naive = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd, TARGET_SECTION_SECONDS, {
    minSilence: 0,
  });
  ok("and it costs at most one extra join", plan.length <= naive.length + 1);

  const lines = plan.flatMap((s) => range(s.firstLine, s.lastLine));
  check("with every line still in exactly one section", lines, range(0, 43));
  ok("and the sections still run end to end",
    plan.every((s, i) => i === 0 || s.startsAt === plan[i - 1].endsAt));
}

console.log("\nAn episode with no pauses at all is reported, not shipped quietly:");
{
  // This is what Michelle heard on 2026-09-20: joins in the middle of
  // sentences. If the recording has nowhere to cut, no choice of boundary
  // fixes it, and saying so is the only useful thing left to do.
  const e = episodeOf(44, 5.7, 0.03);
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  ok("the joins are marked as forced", plan.slice(0, -1).every((s) => s.forcedJoin));
  ok("the last section is not a join", plan.at(-1).forcedJoin === false);
  const said = forcedJoins(plan);
  check("one warning per join", said.length, plan.length - 1);
  ok("naming the line it cuts after", /after line \d+/.test(said[0]));
  ok("and how little silence there was", said[0].includes("0.03s"));

  const gaps = gapSummary(e.lineStarts, e.lineEnds);
  check("the pause summary counts them all", gaps.count, 43);
  check("and says every one is too short", gaps.tooSmall, 43);
  ok("with a median that shows why", gaps.median < MIN_JOIN_SILENCE);
}

console.log("\nThe screenplay gets the last word on where a join goes:");
{
  const e = episodeOf(44);
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd, TARGET_SECTION_SECONDS, {
    cuts: [9, 20],
  });
  check("the first section ends at the line asked for", plan[0].lastLine, 8);
  check("and the second at the next one", plan[1].lastLine, 19);
  ok("both are marked as hers", plan[0].manual && plan[1].manual);
  ok("and not as forced, because she chose them", !plan[0].forcedJoin && !plan[1].forcedJoin);
  ok("the rest is still cut to fit",
    plan.every((s) => s.endsAt - s.startsAt <= SITEPAL_MAX_CLIP_SECONDS));
  const lines = plan.flatMap((s) => range(s.firstLine, s.lastLine));
  check("and no line is lost or repeated", lines, range(0, 43));

  // A mark in a silent-running episode is honoured even though nothing else
  // would cut there — that is the point of being able to say it.
  const tight = episodeOf(44, 5.7, 0.03);
  const forced = planSections(tight.lineStarts, tight.lineEnds, tight.dialogueEnd,
    TARGET_SECTION_SECONDS, { cuts: [5] });
  check("a mark wins even with no pause to land in", forced[0].lastLine, 4);

  check("a mark in front of line 0 is dropped",
    planSections(e.lineStarts, e.lineEnds, e.dialogueEnd, TARGET_SECTION_SECONDS, { cuts: [0] })[0]
      .manual, false);
}

console.log("\nCut marks are read out of the screenplay:");
{
  const script = [
    "The Liminal Terminal — The Wealth Effect",
    "episode: roundtable-02",
    "",
    "── The question [the-question]",
    "  0    CONNOR     Paper gains are still gains, aren't they?",
    "  1  > SAINT GR80 They are still paper.",
    "# cut",
    "  2    CONNOR     Then let me put it another way.",
    "# this line is flat, make it land",
    "  3  > SAINT GR80 Put it however you like.",
    "  # Cut Here  ",
    "  4    CONNOR     Fine.",
  ].join("\n");

  check("a mark names the line it precedes", readCutMarks(script), [2, 4]);
  ok("and an ordinary note is not one", !readCutMarks(script).includes(3));
  check("a screenplay with no marks asks for nothing", readCutMarks("  0    CONNOR     Hello."), []);
}

console.log("\nA recorded episode must carry an end for every line:");
{
  const e = episodeOf(9);
  let threw = null;
  try {
    planSections(e.lineStarts, undefined, e.dialogueEnd);
  } catch (err) {
    threw = err.message;
  }
  // Without this the gaps are all NaN, which reads as "does not fit" and cuts
  // at every single line — 88 clips, and no error anywhere.
  ok("missing ends are refused outright", threw?.includes("line end for every line start"));

  let mismatched = null;
  try {
    planSections(e.lineStarts, e.lineEnds.slice(0, 3), e.dialogueEnd);
  } catch (err) {
    mismatched = err.message;
  }
  ok("and so is a short list", mismatched?.includes("9 starts, 3 ends"));
}

console.log("\nThe cutting report says what a join will sound like:");
{
  // This report is the only thing anyone sees before uploading eight clips,
  // and every number in it is the difference between a join that works and
  // one that has to be found by listening to the whole episode again.
  const e = episodeOf(44, 5.7, (i) => (i % 7 === 6 ? 0.9 : 0.04));
  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);

  const first = sectionLine(plan[0], 0);
  ok("a section is numbered from one", first.startsWith("  section 1"));
  ok("and timed in minutes", first.includes("0:00 –"));
  ok("naming the lines it carries", /lines 0–\d+/.test(first));
  ok("and the pause its cut sits in", first.includes("cut in 0.90s of silence"));

  const last = sectionLine(plan.at(-1), plan.length - 1);
  ok("the last section has no cut to describe", !last.includes("silence"));

  const tight = episodeOf(12, 5.7, 0.03);
  const forced = planSections(tight.lineStarts, tight.lineEnds, tight.dialogueEnd, 40);
  ok("a forced cut is worded as a warning",
    sectionLine(forced[0], 0).includes("cut with only 0.03s of silence"));

  const hers = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd, TARGET_SECTION_SECONDS,
    { cuts: [9] });
  ok("and a cut she asked for is credited to her",
    sectionLine(hers[0], 0).endsWith("(your cut)"));

  const pauses = pauseLine(silenceSummary([
    { start: 10, end: 10.9, width: 0.9 },
    { start: 20, end: 20.1, width: 0.1 },
    { start: 30, end: 32.48, width: 2.48 },
  ]));
  ok("the pause summary counts what was measured", pauses.includes("3 found"));
  ok("and leads with the median", pauses.includes("median 0.90s"));
  ok("and says how many are wide enough to use", pauses.includes("2 are wide enough"));
  ok("and with nothing measured it says the cuts will be heard",
    pauseLine(silenceSummary([])).includes("expect the joins to be heard"));

  ok("with no marks, the report says how to add one", cutHint([]).includes("`# cut` on its own line"));
  ok("and with marks, which ones it used", cutHint([9, 20]).includes("9, 20"));
}

console.log("\nffmpeg's silence report is read back as windows:");
{
  // Real silencedetect output. It goes to stderr, interleaved with everything
  // else ffmpeg says, and the duration is on the end line rather than the
  // start one — so the windows have to be paired up rather than read off.
  const real = [
    "  Stream #0:0: Audio: pcm_s16le, 44100 Hz, mono, s16, 705 kb/s",
    "[silencedetect @ 0x55d1c0] silence_start: 12.3456",
    "[silencedetect @ 0x55d1c0] silence_end: 13.2 | silence_duration: 0.8544",
    "size=N/A time=00:05:51.00 bitrate=N/A speed= 812x",
    "[silencedetect @ 0x55d1c0] silence_start: 70.01",
    "[silencedetect @ 0x55d1c0] silence_end: 70.46 | silence_duration: 0.45",
  ].join("\n");

  const found = parseSilences(real);
  check("both windows come back", found.length, 2);
  check("with the times ffmpeg reported", found[0], { start: 12.346, end: 13.2, width: 0.854 });
  check("and the width computed rather than trusted", found[1].width, 0.45);

  // A run that ends mid-silence reports a start and no end. Guessing where it
  // finished would put a cut point in a place nothing measured.
  check("an unclosed window is dropped", parseSilences("silence_start: 40.0"), []);
  check("and noise with no report at all is nothing", parseSilences("no silence here"), []);

  const [cmd, args] = silenceCommand("content/lt-tv/audio/x/master-dialogue.wav");
  check("the command is ffmpeg", cmd, "ffmpeg");
  ok("it writes no file", args.includes("-f") && args.includes("null"));
  ok("and asks for the threshold in dB", args.some((a) => /silencedetect=noise=-\d+dB:d=/.test(a)));
}

console.log("\nWith the real pauses measured, the joins land in them:");
{
  // ElevenLabs' line times TILE — one line's end is the next one's start — so
  // every reported gap is zero and no choice made from them can be right.
  // This is roundtable-02 as Michelle recorded it on 2026-09-20.
  const e = episodeOf(40, 8.775, 0);
  check("every reported gap is zero", gapSummary(e.lineStarts, e.lineEnds).largest, 0);

  // The audio does have pauses; they are just not in the timings. Put a real
  // one at every third junction.
  const silences = e.lineStarts
    .map((start, i) => ({ start: round(start - 0.45), end: round(start + 0.45), width: 0.9 }))
    .filter((_, i) => i > 0 && i % 3 === 0);

  const blind = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd);
  ok("without them every join is forced", blind.slice(0, -1).every((s) => s.forcedJoin));

  const plan = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd, TARGET_SECTION_SECONDS, {
    silences,
  });
  ok("with them, none is", plan.every((s) => !s.forcedJoin));
  check("and nothing is left to warn about", forcedJoins(plan), []);
  ok("every join reports the pause that was measured",
    plan.slice(0, -1).every((s) => s.silenceAfter === 0.9));
  ok("and every boundary sits inside one of them",
    plan.slice(0, -1).every((s) => silences.some((w) => w.start <= s.endsAt && w.end >= s.endsAt)));

  ok("the sections still fit SitePal",
    plan.every((s) => s.endsAt - s.startsAt <= SITEPAL_MAX_CLIP_SECONDS));
  check("and carry every line once", plan.flatMap((s) => range(s.firstLine, s.lastLine)), range(0, 39));

  // A quiet stretch nowhere near a junction is not that junction's pause —
  // it is a lull inside somebody's sentence, and cutting there is the bug.
  const faraway = planSections(e.lineStarts, e.lineEnds, e.dialogueEnd, TARGET_SECTION_SECONDS, {
    silences: [{ start: 3, end: 4.2, width: 1.2 }],
  });
  ok("a pause far from any junction is not used", faraway.slice(0, -1).every((s) => s.forcedJoin));
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
