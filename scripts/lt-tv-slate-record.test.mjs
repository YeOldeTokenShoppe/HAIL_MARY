// Tests for the production-record → slate-record join, run with:
//
//   node scripts/lt-tv-slate-record.test.mjs
//
// The join's hard part is that a freshly written episode has no audio, so
// lt-tv-check.mjs can only confirm it is a well-formed slate entry — it skips
// every cue and timeline check for a record that is not playable. That leaves
// the interesting half unproven until someone records an episode.
//
// So this fills in synthetic line starts, which is the one thing the audio
// build will add, and then runs the record through the SAME functions the set
// uses: validateEpisode and buildEpisodeTimeline. If the join gets speakers,
// audience lines or cue offsets wrong, the timeline says so here rather than
// on air.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { toSlateRecord, registerEpisode, slateId } from "./lt-tv-slate-record.mjs";
import { planSections, sectionsForRecord } from "./lt-tv-sections.mjs";
import {
  buildEpisodeTimeline,
  episodeIsPlayable,
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
const lines = episode.segments.flatMap((s) => s.lines);
const record = toSlateRecord(episode);

console.log("\nThe mapping:");
check("id follows the slate's <show>-<NN>", record.id, "news-01");
check("id and slateId agree", record.id, slateId(episode));
check("showId is one shows.json knows", record.showId, "news");
check("one speaker per line", record.speakers.length, lines.length);
check("speakers are in line order", record.speakers.slice(0, 4), [
  lines[0].actor,
  lines[1].actor,
  lines[2].actor,
  lines[3].actor,
]);

console.log("\nThe audienceLines inversion:");
// The pipeline's directAddress means "talking AT the other host" — a gaze.
// The slate's audienceLines means "played to the room" — no gaze, camera wide.
// They are complements, and mapping one straight onto the other is the bug
// this asserts against: it sent 50 of 70 lines wide and nearly shipped.
const directAddress = lines.filter((l) => l.directAddress).length;
check(
  "audience lines and direct address partition the episode",
  record.audienceLines.length + directAddress,
  lines.length,
);
ok("a line played to camera is an audience line", record.audienceLines.includes(lines.findIndex((l) => !l.directAddress)));
ok("a line aimed at the other host is not", !record.audienceLines.includes(lines.findIndex((l) => l.directAddress)));
ok("the show still cuts to singles more than it sits wide", record.audienceLines.length < lines.length / 2);

console.log("\nNot playable until the audio build runs:");
ok("no audio", !("audio" in record));
ok("no line starts", !("lineStarts" in record));
ok("the set agrees it is not playable", !episodeIsPlayable(record));
ok("the runtime is labelled an estimate, not advertised as real", "estimatedRuntime" in record && !("runtime" in record));

console.log("\nOnce the audio build fills in the three missing fields:");
// Plausible timing: each line runs as long as its words suggest, in order.
// The real numbers come from ElevenLabs; the SHAPE is what is under test.
let at = 0;
const lineStarts = lines.map((l) => {
  const start = Number(at.toFixed(2));
  at += Math.max(1.2, (l.text.split(/\s+/).length / 145) * 60);
  return start;
});
const dialogueEnd = Number((at + 1).toFixed(2));
// A line ends shortly before the next one starts. Needed because a full-length
// episode does not go up as one clip: SitePal refuses anything over 90
// seconds, so the audio step cuts it into sections and the record carries
// them. A record of this length WITHOUT sections is genuinely broken, and
// validateEpisode says so — which is why they are here rather than omitted.
const lineEnds = lineStarts.map((start, i) =>
  Number(((lineStarts[i + 1] ?? dialogueEnd) - 0.3).toFixed(2)),
);
const sections = planSections(lineStarts, lineEnds, dialogueEnd);
const recorded = {
  ...record,
  audio: Object.fromEntries(
    Object.entries(episode.cast).map(([actor, c]) => [actor, c.sitepalAudio]),
  ),
  sections: sectionsForRecord(episode, sections),
  lineStarts,
  dialogueEnd,
};

ok("the set now calls it playable", episodeIsPlayable(recorded));
check("and finds nothing to complain about", validateEpisode(recorded), []);
ok("it needed more than one clip per character", sections.length > 1);
check("and the first is the plain, unsuffixed name", recorded.sections[0].audio, recorded.audio);
check("a clip the set asks for that nobody uploaded is caught",
  validateEpisode({ ...recorded, sections: recorded.sections.map((x, i) =>
    i === 1 ? { ...x, audio: { Connor: x.audio.Connor } } : x) }).length, 1);

const timeline = buildEpisodeTimeline(recorded, { reactionDurations: {} });
ok("a timeline builds", Boolean(timeline));
check("every cue survived", timeline.cues.length, record.cues.length);
check(
  "one listener turn per line aimed at the other host",
  timeline.gazes.length,
  directAddress,
);
ok("no cue lands after its line is over", timeline.cues.every((c) => {
  const next = lineStarts[c.line + 1] ?? recorded.dialogueEnd;
  return c.at < next;
}));
ok("cues are in playable order", timeline.cues.every((c, i, a) => i === 0 || a[i - 1].at <= c.at));
ok("the camera actually cuts rather than holding one shot", timeline.shots.length > 10);
ok("and it uses both singles and the two-shot", timeline.shots.some((s) => s.subject) && timeline.shots.some((s) => !s.subject));

console.log("\nRegistering it in index.js:");
const INDEX = "src/content/lt-tv/index.js";
const source = await readFile(resolve(INDEX), "utf8");
const added = registerEpisode(source, "news-07");
ok("the import is added", added?.includes('import news07 from "./episodes/news-07.json";'));
ok("the EPISODE_RECORDS entry is added", /^\s*news07,$/m.test(added || ""));
ok("the entry goes last, in slate order", (added || "").indexOf("news07,") > (added || "").indexOf("roundtable06,"));
check("registering twice changes nothing", registerEpisode(added, "news-07"), added);
check("an unrecognisable index.js is refused rather than mangled", registerEpisode("export const nothing = 1;\n", "news-07"), null);

console.log("\nGuards:");
let threw = null;
try {
  toSlateRecord({ ...episode, segments: [] });
} catch (err) {
  threw = err.message;
}
ok("an episode with no lines is refused", threw?.includes("no lines"));

threw = null;
try {
  const broken = structuredClone(episode);
  broken.segments[0].lines[1].n = 99;
  toSlateRecord(broken);
} catch (err) {
  threw = err.message;
}
ok("renumbered lines are refused, not silently mismapped", threw?.includes("disagree about who speaks"));

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
