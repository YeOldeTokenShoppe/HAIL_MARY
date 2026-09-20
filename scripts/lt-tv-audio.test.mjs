// Tests for the audio build's arithmetic, run with:
//
//   node scripts/lt-tv-audio.test.mjs
//
// The thing most likely to be silently wrong here is the offset arithmetic:
// blocks are generated separately, each timestamped from zero, and laid end to
// end afterwards. An error there does not throw — it desyncs the picture from
// the dialogue, worse the further into the episode you get, and looks exactly
// like a mistuned lead-in.
//
// So this builds real PCM buffers of known length, merges them, and checks the
// timeline that comes out. No API key and no ffmpeg: raw PCM is generated
// here, and its duration is a byte count rather than something only a decoder
// can tell you — which is the reason this step uses PCM in the first place.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PCM,
  PCM_RATES,
  pcmSeconds,
  pcmLooksRight,
  mergeBlocks,
  wavHeader,
  blockInputs,
  timingFromSegments,
  tierRefusal,
} from "./lt-tv-audio.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

/** A buffer holding exactly this many seconds of audio in the format we use. */
const pcmOf = (seconds) =>
  Buffer.alloc(Math.round(seconds * PCM.sampleRate * PCM.channels * PCM.bytesPerSample));

console.log("\nDurations come from byte counts, exactly:");
check("one second", pcmSeconds(pcmOf(1).length), 1);
check("ninety seconds", pcmSeconds(pcmOf(90).length), 90);
check("a fractional second survives", pcmSeconds(pcmOf(2.5).length), 2.5);

console.log("\nLaying blocks end to end:");
// Three blocks. Each one's segments start from zero, as they really do.
const blocks = [
  {
    id: "block-1",
    byteLength: pcmOf(60).length,
    segments: [
      { start_time_seconds: 0, end_time_seconds: 20, voice_id: "a" },
      { start_time_seconds: 21, end_time_seconds: 58, voice_id: "b" },
    ],
  },
  {
    id: "block-2",
    byteLength: pcmOf(90).length,
    segments: [
      { start_time_seconds: 0, end_time_seconds: 40, voice_id: "a" },
      { start_time_seconds: 41, end_time_seconds: 88, voice_id: "b" },
    ],
  },
  {
    id: "block-3",
    byteLength: pcmOf(30.5).length,
    segments: [{ start_time_seconds: 0.5, end_time_seconds: 29, voice_id: "a" }],
  },
];
const merged = mergeBlocks(blocks);

check("the episode is the sum of its blocks", merged.durationSeconds, 180.5);
check(
  "each block knows where it starts",
  merged.blocks.map((b) => b.offsetSeconds),
  [0, 60, 150],
);
check(
  "and how long it is",
  merged.blocks.map((b) => b.durationSeconds),
  [60, 90, 30.5],
);
check(
  "every timestamp is shifted by its own block's offset",
  merged.segments.map((s) => s.start_time_seconds),
  [0, 21, 60, 101, 150.5],
);
check(
  "ends shift with starts",
  merged.segments.map((s) => s.end_time_seconds),
  [20, 58, 100, 148, 179],
);
ok("nothing runs past the end of the episode", merged.segments.every((s) => s.end_time_seconds <= merged.durationSeconds));
ok("time only moves forward", merged.segments.every((s, i, a) => i === 0 || a[i - 1].start_time_seconds <= s.start_time_seconds));
ok("the voice on each line is untouched", merged.segments.map((s) => s.voice_id).join("") === "abab" + "a");

console.log("\nA single block is not a special case:");
const one = mergeBlocks([blocks[0]]);
check("its offset is zero", one.blocks[0].offsetSeconds, 0);
check("its timestamps are unchanged", one.segments.map((s) => s.start_time_seconds), [0, 21]);

console.log("\nCatching a wrong PCM format before it desyncs anything:");
// The failure this guards against: if the real audio were stereo, or 8-bit,
// every duration computed from byte length would be out by a fixed ratio and
// every offset with it. The last timestamp ElevenLabs sends is the check.
ok("audio that covers its last word is accepted", pcmLooksRight(pcmOf(62).length, blocks[0].segments).ok);
ok("a trailing pause is not suspicious", pcmLooksRight(pcmOf(70).length, blocks[0].segments).ok);
ok("audio that stops before its last word is rejected", !pcmLooksRight(pcmOf(30).length, blocks[0].segments).ok);
ok("a 2x error (stereo read as mono) is rejected", !pcmLooksRight(pcmOf(58 * 2 + 20).length, blocks[0].segments).ok);
ok("a block with no segments is not judged", pcmLooksRight(pcmOf(5).length, []).ok);

console.log("\nThe WAV header:");
const data = pcmOf(3).length;
const h = wavHeader(data);
check("is the canonical 44 bytes", h.length, 44);
check("declares RIFF/WAVE", `${h.toString("ascii", 0, 4)}/${h.toString("ascii", 8, 12)}`, "RIFF/WAVE");
check("riff size is everything after the first 8 bytes", h.readUInt32LE(4), 36 + data);
check("format is uncompressed PCM", h.readUInt16LE(20), 1);
check("sample rate matches what we asked for", h.readUInt32LE(24), PCM.sampleRate);
check("channels match", h.readUInt16LE(22), PCM.channels);
check("bit depth matches", h.readUInt16LE(34), PCM.bytesPerSample * 8);
check("byte rate is self-consistent", h.readUInt32LE(28), PCM.sampleRate * PCM.channels * PCM.bytesPerSample);
check("the data chunk declares the payload", h.readUInt32LE(40), data);
// A player reads duration from the header, so header and arithmetic must agree.
check("the header implies the same duration the merge does", h.readUInt32LE(40) / h.readUInt32LE(28), 3);

console.log("\nAgainst the worked sample:");
const episode = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/news-2026-W38.sample.json"), "utf8"),
);
const lineCount = episode.segments.reduce((n, s) => n + s.lines.length, 0);

const inputs = episode.blocks.map((b) => blockInputs(episode, b));
check("every line is sent exactly once", inputs.reduce((n, i) => n + i.length, 0), lineCount);
ok("every input carries a voice", inputs.flat().every((i) => i.voice_id && i.text));
ok(
  "the blocks send the lines in order",
  inputs.flat().map((i) => i.text).join("|") ===
    episode.segments.flatMap((s) => s.lines).map((l) => l.text).join("|"),
);

// Pretend the whole episode came back, and check the timing written into the
// record lines up with the lines it describes.
const fake = episode.segments
  .flatMap((s) => s.lines)
  .map((l, i) => ({ start_time_seconds: i * 5, end_time_seconds: i * 5 + 4, voice_id: l.voiceId }));
const timing = timingFromSegments(episode, fake);
check("one start per line", timing.lineStarts.length, lineCount);
check("one end per line", timing.lineEnds.length, lineCount);
ok("no line ends before it starts", timing.lineStarts.every((s, i) => timing.lineEnds[i] > s));

let threw = null;
try {
  timingFromSegments(episode, fake.slice(0, -1));
} catch (err) {
  threw = err.message;
}
ok("a short segment list is refused rather than mis-assigned", threw?.includes("cannot be trusted"));

// ── recording at a rate the account is actually allowed ───────────────────
//
// 44.1kHz PCM is Pro-tier only, so an account below it must record at another
// rate. The design survives that — joins stay sample-exact — but only if every
// number is derived from the rate in force rather than from 44100 baked in
// somewhere. So the arithmetic is re-run at a second rate and must agree with
// itself just as well.

console.log("\nThe same arithmetic at a rate a smaller plan is allowed:");
const was = PCM.sampleRate;
PCM.sampleRate = 24000;
{
  const secondsOf = (n) => n * PCM.sampleRate * PCM.channels * PCM.bytesPerSample;
  check("a second of audio is a second", pcmSeconds(secondsOf(1)), 1);
  check("and ninety are ninety", pcmSeconds(secondsOf(90)), 90);
  // Why a kept block may not be reused across a rate change: one second
  // recorded at 44.1kHz reads as 1.84 seconds here, and every line after it
  // would be placed that much late.
  check("a 44.1kHz second read at this rate is not a second", pcmSeconds(44100 * 2), 1.8375);

  const q = wavHeader(secondsOf(3));
  check("the header says the rate in force", q.readUInt32LE(24), 24000);
  check("its byte rate follows", q.readUInt32LE(28), 24000 * PCM.channels * PCM.bytesPerSample);
  check("and it still implies the same duration", q.readUInt32LE(40) / q.readUInt32LE(28), 3);

  const at24 = mergeBlocks([
    { id: "a", byteLength: secondsOf(10), segments: [{ start_time_seconds: 0, end_time_seconds: 9 }] },
    { id: "b", byteLength: secondsOf(20), segments: [{ start_time_seconds: 0, end_time_seconds: 19 }] },
  ]);
  check("a block still begins where the one before it ended", at24.blocks[1].offsetSeconds, 10);
  check("and the episode is as long as its blocks", at24.durationSeconds, 30);
  ok("the format cross-check works at this rate too", pcmLooksRight(secondsOf(10), at24.segments.slice(0, 1)).ok);
}
PCM.sampleRate = was;
check("and the rate this run started with is put back", PCM.sampleRate, was);

console.log("\nWhat a plan that cannot have 44.1kHz is told:");
{
  const real = '{"detail":{"type":"authorization_error","code":"subscription_required",' +
    '"message":"Output format \'pcm_44100\' is only available on the Pro tier and above.",' +
    '"status":"output_format_not_allowed"}}';
  const said = tierRefusal(real);
  ok("it is recognised as a plan limit, not a bug", said);
  ok("it names the setting to change", said.includes("LT_TV_PCM_RATE=24000"));
  ok("and where to put it", said.includes(".env.local"));
  ok("and still shows what ElevenLabs actually said", said.includes("Pro tier"));
  check("every rate it offers is one ElevenLabs has", PCM_RATES.includes(24000), true);
  check("an unrelated failure is left alone", tierRefusal('{"detail":"quota exceeded"}'), null);
  check("and so is a plain server error", tierRefusal("Bad Gateway"), null);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
