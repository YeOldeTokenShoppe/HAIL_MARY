// Tests for pausing and skipping around an episode, with:
//
//   node scripts/lt-tv-transport.test.mjs
//
// WHAT IS BEING PROTECTED. SitePal has no seek: a clip is started at its
// beginning or not at all, and the one exact control it does give is
// freezeToggle, which pauses speech where it stands and resumes from that
// point (docs/sitepal.md). So skipping is done by starting a SECTION — the
// clips an episode is already cut into, because SitePal refuses anything over
// 90 seconds — and everything below is the arithmetic that decides which one.
//
// The three ways this goes wrong are all silent while you watch it:
//
//   • a skip that lands one section off plays the wrong minute and a half;
//   • a landing that forgets to re-seat the cue index either fires every
//     reaction of the skipped minutes in a single frame, or leaves both
//     actors sitting still for the rest of the episode;
//   • a "back" with no grace period is unusable, because a section is ~90
//     seconds and anyone reaching for it a minute in gets thrown a minute and
//     a half further back than they meant.
//
// None of it shows up in a screenshot, so it is checked here.

import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

import {
  buildEpisodeTimeline,
  cueIndexAt,
  episodeIsPlayable,
  sectionBounds,
  sectionIndexAt,
  stepSection,
  SECTION_RESTART_SECONDS,
  SITEPAL_MAX_CLIP_SECONDS,
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

// Three sections, the shape of a real six-minute episode.
const SECTIONS = [
  { startsAt: 0, audio: { Monk: "a1", Connor: "b1" } },
  { startsAt: 88, audio: { Monk: "a2", Connor: "b2" } },
  { startsAt: 174, audio: { Monk: "a3", Connor: "b3" } },
];

console.log("\nWhich part of the episode a second belongs to:");
check("the top of the show", sectionIndexAt(SECTIONS, 0), 0);
check("a second inside the first part", sectionIndexAt(SECTIONS, 40), 0);
// The boundary belongs to the section it opens, or a seek to a section start
// would land in the section before it and play the join twice.
check("a boundary opens its own part", sectionIndexAt(SECTIONS, 88), 1);
check("a hair before it does not", sectionIndexAt(SECTIONS, 87.9), 0);
check("the last part runs to the end", sectionIndexAt(SECTIONS, 400), 2);
check("and before the start is still the first part", sectionIndexAt(SECTIONS, -5), 0);
check("an episode short enough to be one clip has one part",
  sectionIndexAt([{ startsAt: 0 }], 200), 0);
check("nothing to play is not a crash", sectionIndexAt([], 10), 0);
check("nor is a missing list", sectionIndexAt(undefined, 10), 0);

console.log("\nWhere the reaction cues resume from after a jump:");
const CUES = [{ at: 2 }, { at: 12 }, { at: 90 }, { at: 91.5 }, { at: 200 }];
check("at the top, nothing has fired", cueIndexAt(CUES, 0), 0);
check("mid-episode, the ones behind it have", cueIndexAt(CUES, 90), 3);
check("a cue exactly on the second counts as fired", cueIndexAt(CUES, 12), 2);
check("past the end, all of them", cueIndexAt(CUES, 500), 5);
// Jumping BACK is the case the frame loop cannot handle on its own: it walks
// the list forward and never revisits, so the index has to be re-seated.
check("jumping back re-seats to before the later cues", cueIndexAt(CUES, 5), 1);
check("an episode with no cues seats at zero", cueIndexAt([], 40), 0);
check("and so does a record that has none at all", cueIndexAt(undefined, 40), 0);

console.log("\nSkip back and skip forward:");
check("forward from the first part", stepSection(SECTIONS, 30, 1), 1);
check("forward again", stepSection(SECTIONS, 100, 1), 2);
// Off the end is null rather than a clamp: the caller ends the show, because
// a skip past the last part means the viewer is done watching.
check("forward off the end says so", stepSection(SECTIONS, 200, 1), null);
check("back in the first seconds of a part goes to the one before",
  stepSection(SECTIONS, 89, -1), 0);
check("back later in a part starts that part again",
  stepSection(SECTIONS, 120, -1), 1);
check("the grace period is the line between those two",
  stepSection(SECTIONS, 88 + SECTION_RESTART_SECONDS + 0.1, -1), 1);
check("back in the first part restarts it rather than falling off the front",
  stepSection(SECTIONS, 1, -1), 0);
check("with nothing to play there is nowhere to step", stepSection([], 10, 1), null);

console.log("\nThe episode drawn as the parts it really is:");
const timeline = buildEpisodeTimeline({
  id: "test-01",
  audio: { Monk: "a1", Connor: "b1" },
  sections: SECTIONS,
  lineStarts: [0, 10, 90, 180],
  speakers: ["Monk", "Connor", "Monk", "Connor"],
  dialogueEnd: 260,
});
const bounds = sectionBounds(timeline);
check("one block per section", bounds.length, 3);
check("each block ends where the next begins", bounds.map((b) => b.endsAt), [88, 174, 260]);
// The bar is laid out by these widths, so a last block measured to the wrong
// end would draw the whole episode out of proportion.
check("and the last one ends where the dialogue does", bounds[2].endsAt, timeline.dialogueEnd);
check("the blocks add up to the runtime",
  bounds.reduce((sum, b) => sum + b.seconds, 0), 260);

console.log("\nEvery episode on the slate, as something to skip around:");
const SLATE = "src/content/lt-tv/episodes";
const files = (await readdir(resolve(SLATE))).filter((f) => f.endsWith(".json"));
const records = await Promise.all(
  files.map(async (f) => ({ file: f, ...JSON.parse(await readFile(join(resolve(SLATE), f), "utf8")) })),
);
const playable = records.filter(episodeIsPlayable);
ok("something is playable at all", playable.length > 0);
for (const record of playable) {
  const built = buildEpisodeTimeline(record);
  const blocks = sectionBounds(built);
  // A seek asks for a section start and must get that section back. If this
  // ever disagrees, a viewer pressing a block plays a different one.
  ok(`${record.id}: every block seeks to itself`,
    blocks.every((b) => sectionIndexAt(built.sections, b.startsAt) === b.index));
  ok(`${record.id}: the blocks run forwards and none is empty`,
    blocks.every((b, i) => b.seconds > 0 && (i === 0 || b.startsAt > blocks[i - 1].startsAt)));
  // The same ceiling the split enforces, read here from the played record:
  // a block longer than this is a clip SitePal will not play at all.
  ok(`${record.id}: no block is over SitePal's ${SITEPAL_MAX_CLIP_SECONDS}s`,
    blocks.every((b) => b.seconds <= SITEPAL_MAX_CLIP_SECONDS + 0.5));
  // Walking forward with skip-next has to reach the last part and then stop,
  // which is the loop the transport actually runs.
  let at = 0;
  const walked = [0];
  for (let guard = 0; guard < 100; guard += 1) {
    const next = stepSection(built.sections, at, 1);
    if (next === null) break;
    walked.push(next);
    at = built.sections[next].startsAt;
  }
  check(`${record.id}: skipping forward visits each part once`,
    walked, built.sections.map((_, i) => i));
}

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
