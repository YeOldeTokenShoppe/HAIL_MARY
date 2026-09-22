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
  speakers: ["Connor", "Monk", "Connor", "Monk", "Connor", "Monk", "Connor", "Monk", "Connor", "Monk"],
  audienceLines: [0, 8],
  lineStarts: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54],
  dialogueEnd: 60,
  graphics: { chapters: [{ line: 5, kicker: "NEXT" }] },
};

console.log("\nThe shot list an episode is cut into:");
const t = buildEpisodeTimeline(RECORD);

check("opens on the establishing wide", t.shots[0], { at: 0, subject: null, framing: "establish" });

const framings = new Set(t.shots.map((s) => s.framing));
ok("uses the pair between runs of singles", framings.has("two"));
ok("punches in to a close on a long run of singles", framings.has("close"));

// A line read to the viewer is a single down the lens, not a retreat to wide.
const directShot = t.shots.find((s) => s.framing === "direct");
ok("a to-room line cuts to a direct single", Boolean(directShot));

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
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
