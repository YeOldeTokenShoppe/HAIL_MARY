// Tests for the camera work — the shot list in episodeTimeline.mjs and the
// framing arithmetic in shotFraming.mjs. Run with:
//
//   node scripts/lt-tv-shots.test.mjs
//
// WHAT IS BEING PROTECTED, and why it can't be caught by looking. /trade
// won't render in the agent sandbox (Firestore gate), so the camera is the
// one thing about LT TV that can't be screenshotted here. That makes the
// grammar — WHEN each shot is cut, and WHERE the lens ends up for it — worth
// pinning in a test rather than trusting to a play-through.
//
// The three ways this goes wrong are all quiet on screen:
//
//   • a shot list that cuts every line whips the camera around; one that
//     never cuts is the locked-off wide we started with;
//   • a line read to the VIEWER that goes wide instead of punching in has the
//     news grammar backwards — an anchor addresses the room in close-up;
//   • a solved shot that pushes past the SitePal face's own resolution keeps
//     dollying in while the face only gets softer.

import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

import {
  buildEpisodeTimeline,
  cameraLookAt,
  conversationGlanceAt,
  conversationPartnerAt,
  shotAt,
  shotSubjectAt,
} from "../src/lib/ltTv/episodeTimeline.mjs";
import {
  SHOT_FRAMING,
  SHOT_NAMES,
  faceScreenPixels,
  isSingleShot,
  solveShot,
} from "../src/lib/ltTv/shotFraming.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

// A two-hander with everything the grammar has to handle: a to-room opener, a
// long alternating exchange (which forces both the punch-in close and the
// pull-back to the pair), a chapter cut, and a to-viewer line inside the show.
const RECORD = {
  id: "unit",
  audio: { Connor: "c1", Monk: "m1" },
  speakers: [
    "Connor", "Monk", "Connor", "Monk", "Connor", "Monk", "Connor",
    "Monk", "Connor", "Monk", "Connor", "Monk", "Connor", "Monk",
  ],
  audienceLines: [0, 8],
  // The last line but one runs 20 seconds, which is what exercises the
  // mid-line cut. Everything else is an even six, so the arithmetic in the
  // assertions below is readable.
  lineStarts: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 92],
  dialogueEnd: 98,
  graphics: { chapters: [{ line: 5, kicker: "NEXT" }] },
};

console.log("\nThe shot list an episode is cut into:");
const t = buildEpisodeTimeline(RECORD);

// Every show opens square on the pair (2026-10-29); the establishing wide is
// a chapter break's shot, not the cold open's.
check("opens on the pair", t.shots[0], { at: 0, subject: null, framing: "two" });

const framings = new Set(t.shots.map((s) => s.framing));
ok("uses the pair between runs of singles", framings.has("two"));
ok("punches in to a close on a long run of singles", framings.has("close"));

// THE PAIR IS THE REACTION SHOT — it is the only framing that shows one host
// taking the other one in, so an episode that almost never cuts to it is an
// episode of talking heads. The news show was the starved case (5 pair shots
// in 47) because its to-camera lines reset the run that triggers the
// pull-back. What is pinned is the floor, not the exact count: the plot is
// Michelle's to set, and a lens angle can move without touching the grammar.
const pairShare = t.shots.filter((s) => s.framing === "two").length / t.shots.length;
ok("cuts back to the pair often enough to carry reactions", pairShare > 0.12);
ok("but doesn't live there — the show is still mostly singles", pairShare < 0.4);

// A line read to the viewer is a single down the lens, not a retreat to wide.
const directShot = t.shots.find((s) => s.framing === "direct");
ok("a to-room line cuts to a direct single", Boolean(directShot));

// A long speech held in close-up pulls out to the PAIR partway through, so the
// second half of it is the other host's reaction rather than more of the same
// face. Line 12 is the 20-second one, cut into at 55% of its length.
const longLine = t.shots.find((s) => Math.abs(s.at - (72 + 20 * 0.55)) < 0.01);
ok("a long close-up pulls out to the pair partway through", longLine?.framing === "two");

// A chapter start is an editorial cut — it goes wide whoever is talking.
const chapterShot = t.shots.find((s) => Math.abs(s.at - (30 + 0.3)) < 0.01);
if (chapterShot) check("a new chapter opens on the establishing wide", chapterShot.framing, "establish");

// No shot is held so briefly it reads as a flicker (chapters aside, which are
// allowed to cut through a held shot).
const gaps = t.shots.slice(1).map((s, i) => ({ gap: s.at - t.shots[i].at, framing: s.framing }));
ok("every shot is held long enough to read", gaps.every((g) => g.gap >= 2.6 - 1e-6 || g.framing === "establish"));

console.log("\nWhere the lens goes for each shot:");
const heads = { Connor: { x: -0.6, y: 0.42, z: 0 }, Monk: { x: 0.6, y: 0.42, z: 0 } };
const front = { x: 0, y: 0, z: 1 };

for (const name of SHOT_NAMES) {
  const subject = isSingleShot(name) ? "Connor" : null;
  const shot = solveShot({ framing: name, subject, heads, front, aspect: 1.78 });
  ok(`${name}: solves to a pose`, shot && Number.isFinite(shot.distance));
  ok(`${name}: sits in front of the set (+Z)`, shot.eye.z > 0);
  ok(`${name}: never dollies past the desk`, shot.distance >= SHOT_FRAMING.minDistance - 1e-6);
}

// The two singles are a matched CROSS-shot: Connor (screen left of centre)
// is seen from the right, Monk from the left, so each looks across the desk.
const cConnor = solveShot({ framing: "single", subject: "Connor", heads, front, aspect: 1.78 });
const cMonk = solveShot({ framing: "single", subject: "Monk", heads, front, aspect: 1.78 });
ok("Connor's single shoots from screen right", cConnor.eye.x > 0);
ok("Monk's single shoots from screen left", cMonk.eye.x < 0);

// The to-viewer shot and the cross single have to stay readable as DIFFERENT
// shots, and the way they differ is how far round they are swung. The exact
// angles are Michelle's to set on the board (she took `direct` off square to
// 14° on 2026-09-22), so what is pinned here is the ordering, not the numbers.
const direct = solveShot({ framing: "direct", subject: "Connor", heads, front, aspect: 1.78 });
ok(
  "the to-viewer shot is squarer to the set than the cross single",
  Math.abs(SHOT_FRAMING.shots.direct.azimuth) < Math.abs(SHOT_FRAMING.shots.single.azimuth),
);
ok("and is still a single on its subject, not a wide", isSingleShot("direct") && direct.eye.z > 0);

console.log("\nHow close the camera can push before the face softens:");
// The SitePal face is ~195 source pixels tall. A shot whose face lands well
// under that is sharp; a punch-in that lands far over is upscaling.
const closeShot = solveShot({ framing: "close", subject: "Connor", heads, front, aspect: 1.78 });
const px = faceScreenPixels(closeShot.headShare, 1080);
ok("the close reports a face-resolution ratio", Number.isFinite(px.ratio) && px.ratio > 0);
ok("the establishing wide leaves the face well within source", (() => {
  const est = solveShot({ framing: "establish", subject: null, heads, front, aspect: 1.78 });
  return faceScreenPixels(est.headShare, 1080).ratio < 1;
})());

console.log("\nEvery episode on the slate cuts into a sane shot list:");
const dir = resolve("src/content/lt-tv/episodes");
const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const record = JSON.parse(await readFile(join(dir, file), "utf8"));
  const timeline = buildEpisodeTimeline(record);
  if (!timeline) continue; // slate entry, not recorded yet
  const id = record.id;
  ok(`${id}: opens on a wide`, timeline.shots[0].subject === null);
  ok(`${id}: every shot names a known framing`, timeline.shots.every((s) => SHOT_NAMES.includes(s.framing)));
  ok(`${id}: singles name a speaker, wides don't`, timeline.shots.every((s) =>
    isSingleShot(s.framing) ? Boolean(s.subject) : s.subject === null));
  // shotSubjectAt (the tripod feed's older reader) still agrees with shotAt.
  ok(`${id}: the two shot readers agree`, timeline.shots.every((s) =>
    shotSubjectAt(timeline, s.at) === (shotAt(timeline, s.at)?.subject ?? null)));
  const g = timeline.shots.slice(1).map((s, i) => s.at - timeline.shots[i].at);
  const avg = g.reduce((a, b) => a + b, 0) / (g.length || 1);
  ok(`${id}: cuts often enough to feel operated (avg < 20s)`, avg < 20);
  ok(`${id}: doesn't whip around (avg > 4s)`, avg > 4);
  // Same floor on the real slate, where the starvation actually showed up.
  const pair = timeline.shots.filter((s) => s.framing === "two").length / timeline.shots.length;
  ok(`${id}: cuts back to the pair for reactions (>12% of shots)`, pair > 0.12);
}

// ── Looking down the lens ────────────────────────────────────────────────
// A news anchor turns to the colleague for their own addressed line, then
// returns to the viewer. Markets & Morality keeps its listener-only turns.
{
  const record = (showId) => ({
    id: `${showId}-t`, showId, audio: { Kip: "kip", Holly: "holly" },
    sections: [{ clips: {}, start: 0, end: 20 }],
    lineStarts: [0.5, 4, 8, 12], dialogueEnd: 16,
    lineEnds: [3.2, 7.2, 11.2, 15.2],
    speakers: ["Kip", "Holly", "Kip", "Holly"],
    audienceLines: [0, 2],
  });
  const news = buildEpisodeTimeline(record("news"));
  const talk = buildEpisodeTimeline(record("morality"));
  if (!news || !talk) {
    ok("the look-to-camera fixture is playable", false);
  } else {
    check("news: both anchors follow the viewer", news.toCamera.map((l) => l.actor), ["Kip", "Holly"]);
    check("news: direct lines cue speaker gaze", news.gazes.map(g => [g.line, g.speaker, g.listener, g.speakerLook]),
      [[1, "Holly", "Kip", true], [3, "Holly", "Kip", true]]);
    check("morality: only the opener", talk.toCamera.map((l) => [l.line, l.actor]), [[0, "Kip"]]);
    for (const actor of ["Kip", "Holly"]) {
      ok(`news: ${actor} follows the viewer on audience lines, lead-in and closing tail`,
        [-2.5, 0, 2, 3.7, 8, 9, 16, 18].every(time => cameraLookAt(news, actor, time) === 1));
      ok(`news: ${actor} faces the camera as soon as speech ends, including the gap`,
        [7.2, 7.99, 15.2, 15.99].every(time => conversationPartnerAt(news, actor, time) === null
          && cameraLookAt(news, actor, time) === 1));
    }
    ok("news: Holly briefly turns to Kip at the start of her addressed line",
      [4, 5, 5.99, 12, 13.99].every(time => conversationPartnerAt(news, "Holly", time) === "Kip"
        && cameraLookAt(news, "Holly", time) === 0));
    ok("news: Holly returns to camera after two seconds while still speaking",
      [6, 6.5, 7.19, 14, 15.19].every(time => conversationPartnerAt(news, "Holly", time) === null
        && cameraLookAt(news, "Holly", time) === 1));
    check("news: Holly alternates the two turn limits", news.gazes.map(g => g.yawDegrees), [45, 75]);
    check("news: the selected angle stays fixed throughout a glance",
      [12, 13, 12.5, 13.99, 12].map(time => conversationGlanceAt(news, "Holly", time)?.yawDegrees),
      [75, 75, 75, 75, 75]);
    ok("news: Kip remains on camera while Holly speaks",
      [4, 5, 7.19, 12, 15.19].every(time => conversationPartnerAt(news, "Kip", time) === null
        && cameraLookAt(news, "Kip", time) === 1));
    check("news: people outside the cast have no camera look", cameraLookAt(news, "Monk", 5), 0);
    check("morality: the opener holds the lens through the lead-in", cameraLookAt(talk, "Kip", 0), 1);
    ok("morality: the opener lets go over the end of the line", cameraLookAt(talk, "Kip", 3.7) < 0.5);
    check("morality: a later line to the room is not", cameraLookAt(talk, "Kip", 9), 0);
    check("morality: the listener does not follow the camera", cameraLookAt(talk, "Holly", 9), 0);
    ok("morality: listeners still turn toward the speaker", talk.gazes.length > 0);
    check("morality: direct lines retain listener-only gaze", conversationPartnerAt(talk, "Kip", 5), null);

    const exchange = buildEpisodeTimeline({ ...record("news"), audienceLines: [0], lineEnds: undefined });
    for (const [time, targets] of [[7.99, [null, null]], [8, ["Holly", null]],
      [8.01, ["Holly", null]], [10, [null, null]], [11.99, [null, null]], [12, [null, "Kip"]], [12.01, [null, "Kip"]]]) {
      check(`news: the finished speaker faces camera during the reply at ${time}s`,
        [conversationPartnerAt(exchange, "Kip", time), conversationPartnerAt(exchange, "Holly", time)],
        targets);
    }
    const shortLine = buildEpisodeTimeline({ ...record("news"), lineEnds: [3.2, 5.25, 11.2, 15.2] });
    check("news: a short spoken line releases the glance before two seconds",
      [conversationPartnerAt(shortLine, "Holly", 5.24), conversationPartnerAt(shortLine, "Holly", 5.25)], ["Kip", null]);
    const alternating = buildEpisodeTimeline({ ...record("news"), audienceLines: [] });
    check("news: each anchor gets both angles independently",
      alternating.gazes.map(g => [g.speaker, g.yawDegrees]),
      [["Kip", 45], ["Holly", 45], ["Kip", 75], ["Holly", 75]]);
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
