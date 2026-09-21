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

import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
  blockFingerprint,
  cacheIsUsable,
  beatBytes,
  ACT_BEAT_SECONDS,
  renderPlan,
  unitInputs,
  strandedPauses,
  strandedWarning,
  PAUSE_MARK_MAX_SECONDS,
  revoice,
  lineSpansFromAlignment,
  shiftSpans,
  episodeLineSpans,
  cacheReport,
  costReport,
  staleClipsAfterRecord,
  staleClipWarning,
} from "./lt-tv-audio.mjs";
import { CAST } from "./lt-tv-format.mjs";
import { renderScript } from "./lt-tv-episode.mjs";
import { pendingEdits, readPauseMarks } from "./lt-tv-edit.mjs";

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

console.log("\nRecording refuses a screenplay that was never applied:");
{
  // THE FAILURE THIS PREVENTS COST A WHOLE EPISODE on 2026-09-20. Saving the
  // screenplay does not change the record, and the render reads the record, so
  // an edit that was saved but not applied was rendered as the OLD words, paid
  // for, and never mentioned. It is invisible until you play it back.
  const run = promisify(execFile);
  const episode = JSON.parse(
    await readFile(resolve("content/lt-tv/samples/roundtable-02.sample.json"), "utf8"),
  );
  delete episode.synthetic; // the sample is refused on its own account

  check(
    "the screenplay a record renders is not an edit",
    pendingEdits(episode, renderScript(episode) + "\n"),
    null,
  );

  const edited = renderScript(episode).replace(
    /^(\s*0\s+)(>\s*)?(\S.*?)(\s\s+)(\S.*)$/m,
    (_, n, aim, who, gap) => `${n}${aim ?? ""}${who}${gap}Something she typed instead.`,
  );
  ok("and a reworded line is", pendingEdits(episode, edited) !== null);

  const dir = await mkdtemp(join(tmpdir(), "lt-tv-audio-"));
  try {
    await mkdir(join(dir, "content/lt-tv/episodes"), { recursive: true });
    await writeFile(
      join(dir, "content/lt-tv/episodes/roundtable-02.json"),
      JSON.stringify(episode, null, 2) + "\n",
    );
    await writeFile(join(dir, "content/lt-tv/episodes/roundtable-02.txt"), edited + "\n");

    let failed = null;
    try {
      await run("node", [resolve("scripts/lt-tv-audio.mjs"), "content/lt-tv/episodes/roundtable-02.json"], {
        cwd: dir,
        env: { ...process.env, ELEVENLABS_API_KEY: "not-used-because-it-refuses-first" },
      });
    } catch (err) {
      failed = err;
    }
    ok("the run stops", failed !== null);
    check("without spending anything", failed?.code, 2);
    const said = failed?.stderr ?? "";
    ok("saying the screenplay is ahead of the record", said.includes("not in the record yet"));
    ok("naming the button that fixes it", said.includes("Apply my edits"));
    ok("and the command, for a terminal", said.includes("npm run lt:edit -- roundtable-02"));
    ok("and that no money went", said.includes("Nothing has been spent"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

console.log("\nA kept block is only reused for the words it was recorded from:");
{
  // COST MICHELLE A WHOLE EPISODE on 2026-09-21. `packBlocks` names blocks by
  // POSITION — block-1, block-2 — and re-packs them whenever a segment's
  // length changes, so after an edit `block-2` covers different lines than the
  // block-2 already on disk. Keyed by id alone, the cache handed back the old
  // words under the new block's name, and every later line was then laid out
  // from the old block's duration and the old block's segment list. She heard
  // both: the line she had rewritten read exactly as before, and lines that
  // started in one voice and finished in the other.
  const inputs = [
    { text: "Paper gains are still gains.", voice_id: "connor-voice" },
    { text: "They are still paper.", voice_id: "gr80-voice" },
  ];
  const format = "pcm_24000";
  const fingerprint = blockFingerprint(inputs);

  ok("a fingerprint is short enough to sit in a file", fingerprint.length === 16);
  check("the same words give the same one", blockFingerprint(inputs), fingerprint);
  ok("a reworded line gives a different one",
    blockFingerprint([{ ...inputs[0], text: "Paper gains are not gains." }, inputs[1]]) !== fingerprint);
  ok("and so does the same words in the other voice",
    blockFingerprint([{ ...inputs[0], voice_id: "gr80-voice" }, inputs[1]]) !== fingerprint);
  ok("and so does the same lines in the other order",
    blockFingerprint([inputs[1], inputs[0]]) !== fingerprint);

  const kept = { lt_tv_output_format: format, lt_tv_inputs: fingerprint };
  ok("an unchanged block is reused", cacheIsUsable(kept, { format, fingerprint }).ok);

  const edited = cacheIsUsable(kept, { format, fingerprint: blockFingerprint([inputs[0]]) });
  check("a block whose words changed is not", edited.ok, false);
  ok("and it says so in as many words", edited.why.includes("different words"));

  const rate = cacheIsUsable(kept, { format: "pcm_44100", fingerprint });
  check("nor one recorded at another rate", rate.ok, false);
  ok("naming both rates", rate.why.includes("pcm_24000") && rate.why.includes("pcm_44100"));

  // Everything cached before this check exists cannot be shown to match, and
  // the cost of assuming wrongly is an episode that says the wrong thing.
  const older = cacheIsUsable({ lt_tv_output_format: format }, { format, fingerprint });
  check("and nor is anything kept before fingerprints existed", older.ok, false);
  ok("which it explains rather than just refusing", older.why.includes("predates"));
}

console.log("\nActs are separated by a beat, not butted together:");
{
  // Blocks are only ever split at an act boundary, and they used to be laid
  // end to end to the byte — so the biggest pause in the episode was no pause
  // at all. Michelle heard it on 2026-09-21: "I had jokes prepared." ran
  // straight into "Here is the part people flinch at."
  const second = (n) => Math.round(n * PCM.sampleRate) * PCM.channels * PCM.bytesPerSample;
  const blocks = [
    { id: "block-1", byteLength: second(10), segments: [{ start_time_seconds: 0, end_time_seconds: 9 }] },
    { id: "block-2", byteLength: second(20), segments: [{ start_time_seconds: 0, end_time_seconds: 19 }] },
    { id: "block-3", byteLength: second(5), segments: [{ start_time_seconds: 0, end_time_seconds: 4 }] },
  ];
  const gapBytes = beatBytes(0.7);

  ok("a beat is a whole number of samples",
    gapBytes % (PCM.channels * PCM.bytesPerSample) === 0);
  check("and is the length it says it is", pcmSeconds(gapBytes), 0.7);

  const merged = mergeBlocks(blocks, { gapBytes });
  check("the first act still starts at zero", merged.blocks[0].offsetSeconds, 0);
  check("the second is pushed back by one beat", merged.blocks[1].offsetSeconds, 10.7);
  check("and the third by two", merged.blocks[2].offsetSeconds, 31.4);
  check("the episode is longer by the beats it gained", merged.durationSeconds, 36.4);

  // The master is assembled from the same integer, which is the point: an
  // episode whose audio and timings disagree drifts, and nothing says so.
  const masterBytes = blocks.reduce((n, b) => n + b.byteLength, 0) + gapBytes * (blocks.length - 1);
  check("and the master is exactly that many bytes", pcmSeconds(masterBytes), merged.durationSeconds);

  const lines = merged.segments.map((s) => s.start_time_seconds);
  check("every line after a beat moves with it", lines, [0, 10.7, 31.4]);

  check("without a beat nothing moves", mergeBlocks(blocks).blocks.map((b) => b.offsetSeconds),
    [0, 10, 30]);
  ok("and a one-act episode has nowhere to put one",
    mergeBlocks([blocks[0]], { gapBytes }).durationSeconds === 10);

  ok("the default is a pause rather than a gulf", ACT_BEAT_SECONDS > 0 && ACT_BEAT_SECONDS <= 1.5);
}

console.log("\nA pause the script asked for:");
{
  // Michelle: "i don't always want the same pause" and "sometimes awkward
  // pauses might be funny too". ElevenLabs cannot give us a measured one —
  // text-to-dialogue is eleven_v3 and v3 has no break tag — so a pause ENDS a
  // request and the silence goes in the seam, where it is exact.
  const lines = (episode) => episode.segments.flatMap((s) => s.lines);
  const all = lines(episode);
  const firstN = all[0].n;
  const insideSecondBlock = episode.blocks[1].firstLine + 1;

  const plain = renderPlan(episode, new Map());
  check("with no marks there is one recording per block", plain.length, episode.blocks.length);
  check("and the acts are still separated by the beat",
    plain.slice(1).map((u) => u.pauseBefore),
    plain.slice(1).map(() => ACT_BEAT_SECONDS));
  check("nothing is pushed in front of the first line", plain[0].pauseBefore, 0);

  const marked = renderPlan(episode, new Map([[insideSecondBlock, 1.5]]));
  check("a mark inside a block splits that block in two",
    marked.length, episode.blocks.length + 1);
  const split = marked.find((u) => u.firstLine === insideSecondBlock);
  ok("the new recording starts at the marked line", Boolean(split));
  check("and carries the pause that was asked for", split.pauseBefore, 1.5);
  ok("which is marked as coming from the script", split.asked);
  check("its silence is a whole number of samples and the length it says",
    pcmSeconds(split.bytes), 1.5);
  check("the parts of a split block are named apart",
    marked.filter((u) => u.block === episode.blocks[1].id).map((u) => u.id),
    [`${episode.blocks[1].id}a`, `${episode.blocks[1].id}b`]);

  // The whole point of splitting rather than cutting: no line is lost, moved
  // between recordings, or sent twice.
  check("every line is still sent exactly once, in order",
    marked.flatMap((u) => unitInputs(u)).map((i) => i.text).join("|"),
    all.map((l) => l.text).join("|"));
  ok("every input still carries a voice",
    marked.flatMap((u) => unitInputs(u)).every((i) => i.voice_id && i.text));

  // A mark on a block's own first line changes that act's beat rather than
  // splitting anything.
  const atJoin = renderPlan(episode, new Map([[episode.blocks[1].firstLine, 2.4]]));
  check("a mark on an act break just lengthens that beat", atJoin.length, plain.length);
  check("to exactly what was asked", atJoin[1].pauseBefore, 2.4);

  // The timeline the record is written from, and the master, come from the
  // same integers — this is the arithmetic that desyncs silently if wrong.
  const second = (n) => Math.round(n * PCM.sampleRate) * PCM.channels * PCM.bytesPerSample;
  const built = marked.map((u, i) => ({
    id: u.id,
    byteLength: second(10),
    segments: u.lines.map((_, k) => ({ start_time_seconds: k, end_time_seconds: k + 0.9 })),
  }));
  const gaps = marked.slice(1).map((u) => u.bytes);
  const merged = mergeBlocks(built, { gaps });
  const masterBytes = built.reduce((n, b) => n + b.byteLength, 0) + gaps.reduce((n, g) => n + g, 0);
  check("the master is exactly as long as the timeline says",
    pcmSeconds(masterBytes), merged.durationSeconds);
  check("each recording begins after the pause in front of it",
    merged.blocks.map((b) => b.offsetSeconds),
    marked.reduce((acc, u, i) => {
      acc.push(i === 0 ? 0 : Number((acc[i - 1] + 10 + u.pauseBefore).toFixed(3)));
      return acc;
    }, []));

  // A pause that cannot be placed is said, not dropped.
  const stray = new Map([[99999, 1], [firstN, 1]]);
  check("a mark on a line that does not exist is stranded",
    strandedPauses(episode, stray).includes(99999), true);
  check("so is one in front of the very first line",
    strandedPauses(episode, stray).includes(firstN), true);
  check("a mark inside a block is not",
    strandedPauses(episode, new Map([[insideSecondBlock, 1]])), []);
  const warning = strandedWarning(strandedPauses(episode, stray), episode);
  ok("and the warning names the line number", warning.includes("99999"));
  ok("and says the first-line one is about the start", /starts/.test(warning));
  check("nothing to warn about when nothing is stranded", strandedWarning([], episode), null);

  // THE NUMBERING CONTRACT. The mark is read off the screenplay by the number
  // printed beside the line; the plan splits on the record's `n`. If those two
  // ever stop meaning the same thing, a pause silently lands somewhere else —
  // so the round trip is checked against a real rendered screenplay rather
  // than a hand-made map.
  const page = renderScript(episode)
    .split("\n")
    .flatMap((row) => {
      const num = row.match(/^\s*(\d+)\s+/);
      return num && Number(num[1]) === insideSecondBlock ? ["# pause 1.8s", row] : [row];
    })
    .join("\n");
  const fromPage = renderPlan(episode, readPauseMarks(page));
  const asked = fromPage.find((u) => u.pauseBefore === 1.8);
  ok("a mark written on the page lands on the line it was written above",
    asked && asked.firstLine === insideSecondBlock);
  ok("and a pause mark is not read as an edit",
    pendingEdits(episode, page + "\n") === null);

  // A typo here is dead air in a finished episode, so it stops the run before
  // anything is spent rather than after.
  let refused = null;
  try {
    renderPlan(episode, new Map([[insideSecondBlock, 45]]));
  } catch (err) {
    refused = err.message;
  }
  ok("an absurd pause is refused", refused !== null);
  ok("and the refusal names the line and the limit",
    refused.includes(String(insideSecondBlock)) && refused.includes(String(PAUSE_MARK_MAX_SECONDS)));
}

console.log("\nThe voices are the show's, not the record's:");
{
  // Michelle changed the Monk's voice, re-recorded roundtable-02, and it was
  // rendered in the OLD voice — the record stores a voiceId per line, frozen
  // when the episode was written, and nothing compares it to the cast. It
  // surfaced one step later as the split refusing with "No dialogue segments
  // were found for voice ...", which reads like a corrupt recording.
  const STALE = "fATgBRI8wg5KkDFg8vBd";
  const stale = {
    ...episode,
    segments: episode.segments.map((seg) => ({
      ...seg,
      lines: seg.lines.map((l) => (l.actor === "Monk" ? { ...l, voiceId: STALE } : l)),
    })),
    cast: { ...episode.cast, Monk: { ...episode.cast.Monk, voiceId: STALE } },
  };
  ok("the fixture really is stale", JSON.stringify(stale).includes(STALE));

  const { episode: fixed, changes } = revoice(stale);
  check("the change is noticed once, for the character it affects",
    changes.map((c) => [c.actor, c.was, c.now]),
    [["Monk", STALE, CAST.Monk.voiceId]]);
  ok("no line is left on the old voice", !JSON.stringify(fixed).includes(STALE));
  ok("every line now carries the cast's voice",
    fixed.segments.flatMap((s) => s.lines).every((l) => l.voiceId === CAST[l.actor].voiceId));
  check("and so does the cast block", fixed.cast.Monk.voiceId, CAST.Monk.voiceId);
  ok("the other character is untouched", fixed.cast.Connor.voiceId === episode.cast.Connor.voiceId);

  // What actually goes to ElevenLabs is the thing that was wrong.
  const sent = renderPlan(fixed, new Map()).flatMap((u) => unitInputs(u));
  ok("the request asks for the current voice", sent.every((i) => i.voice_id !== STALE));

  // The words are untouched, so nothing here looks like an edit — which is
  // exactly why this went unnoticed until the split failed.
  check("nothing else about the episode moves",
    JSON.stringify(fixed.segments.flatMap((s) => s.lines).map((l) => l.text)),
    JSON.stringify(episode.segments.flatMap((s) => s.lines).map((l) => l.text)));

  // A stale voice must not be reusable from cache, or half the episode would
  // be in one voice and half in the other.
  const before = blockFingerprint(unitInputs({ lines: stale.segments[0].lines }));
  const after = blockFingerprint(unitInputs({ lines: fixed.segments[0].lines }));
  ok("and the cached audio cannot survive the change", before !== after);

  check("an episode already on the current voices reports no change",
    revoice(episode).changes, []);
}

// ── the exact line times ElevenLabs already knew ─────────────────────────────
// Three bugs came from guessing where one voice stops and the next starts.
// The response carried the answer all along, in `alignment`.
{
  // "Hi. Bye." — two lines, a space between them. Character times are one per
  // character, so the indices below are literal positions in that string.
  const characters = [..."Hi. Bye."];
  const alignment = {
    characters,
    character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 1.0, 1.1, 1.2, 1.3],
    character_end_times_seconds: [0.1, 0.2, 0.3, 1.0, 1.1, 1.2, 1.3, 1.4],
  };
  // End indices as ElevenLabs' own example writes them: the next line's start.
  const exclusive = [
    { character_start_index: 0, character_end_index: 4 },
    { character_start_index: 4, character_end_index: 8 },
  ];
  check("a line's span runs from its first character to its last",
    lineSpansFromAlignment(alignment, exclusive),
    [{ start: 0, end: 0.3 }, { start: 1, end: 1.4 }]);

  // THE POINT OF THE CLAMP. The docs never say which reading is right, so the
  // same spans must come out when the end index is inclusive instead.
  const inclusive = [
    { character_start_index: 0, character_end_index: 3 },
    { character_start_index: 4, character_end_index: 7 },
  ];
  check("and comes out the same whichever way the end index is meant",
    lineSpansFromAlignment(alignment, inclusive),
    lineSpansFromAlignment(alignment, exclusive));

  // The space at index 3 belongs to neither line. Left in, it would stretch
  // line one's end across the pause and leave nothing to cut in.
  ok("the space between the lines belongs to neither",
    lineSpansFromAlignment(alignment, exclusive)[0].end === 0.3);

  check("no alignment means no spans, rather than a guess",
    lineSpansFromAlignment(undefined, exclusive), null);
  check("nor a truncated one", lineSpansFromAlignment({ ...alignment, characters: [] }, exclusive),
    null);

  check("a block's spans move to where the block plays",
    shiftSpans([{ start: 0, end: 0.3 }], 10),
    [{ start: 10, end: 10.3 }]);

  const built = [
    { id: "a", alignment, segments: exclusive },
    { id: "b", alignment, segments: exclusive },
  ];
  const offsets = new Map([["a", 0], ["b", 5]]);
  check("two blocks make one list on the episode's own clock",
    episodeLineSpans(built, { offsets, expected: 4 }),
    [
      { start: 0, end: 0.3 },
      { start: 1, end: 1.4 },
      { start: 5, end: 5.3 },
      { start: 6, end: 6.4 },
    ]);

  // Half an episode of exact spans is worse than none: the splitter would cut
  // some lines exactly and guess at the rest with nothing saying which.
  check("one block without an alignment voids the whole episode",
    episodeLineSpans([built[0], { id: "b", segments: exclusive }], { offsets, expected: 4 }),
    null);
  check("and so does a count that disagrees with the lines",
    episodeLineSpans(built, { offsets, expected: 5 }), null);
  check("and a block with nowhere to play",
    episodeLineSpans(built, { offsets: new Map([["a", 0]]), expected: 4 }), null);
}


// ── what recording again would actually cost ─────────────────────────────────
// The studio's confirm says "this spends an ElevenLabs render" whether or not
// it does, because a button cannot know. Michelle pushed back on exactly that.
{
  const format = `pcm_${PCM.sampleRate}`;
  const fingerprint = "abc123";
  const withTimes = {
    lt_tv_output_format: format,
    lt_tv_inputs: fingerprint,
    alignment: { characters: ["a"], character_start_times_seconds: [0],
      character_end_times_seconds: [0.1] },
  };

  check("a matching block costs nothing",
    cacheReport(withTimes, { format, fingerprint }),
    { reuse: true, why: null, alignment: true });
  check("nothing on disk is a render",
    cacheReport(null, { format, fingerprint }).reuse, false);
  ok("and says so in words rather than a flag",
    cacheReport(null, { format, fingerprint }).why.includes("not been recorded"));
  ok("different words cost a render",
    !cacheReport({ ...withTimes, lt_tv_inputs: "other" }, { format, fingerprint }).reuse);

  // A reusable block can still be missing the exact line times, and that
  // changes what the split will do — so it is reported separately from cost.
  const noTimes = { lt_tv_output_format: format, lt_tv_inputs: fingerprint };
  check("a reusable block with no alignment is still free",
    cacheReport(noTimes, { format, fingerprint }).reuse, true);
  check("but is reported as having no exact times",
    cacheReport(noTimes, { format, fingerprint }).alignment, false);
  ok("an empty alignment does not count as one",
    !cacheReport({ ...noTimes, alignment: { characters: [] } }, { format, fingerprint }).alignment);

  const report = costReport([
    { id: "block-1", reuse: true, why: null, alignment: true },
    { id: "block-2", reuse: true, why: null, alignment: false },
    { id: "block-3", reuse: false, why: "it has not been recorded yet", alignment: false },
  ]);
  check("the count is what gets sent, not what exists", report.fresh, 1);
  check("and what costs nothing", report.reused, 2);
  check("missing line times are counted only among the reused",
    report.missingAlignment, 1);
  ok("a reused block says so plainly", report.lines[0].includes("reused free"));
  ok("a re-recorded one says why", report.lines[2].includes("because"));

  const free = costReport([{ id: "block-1", reuse: true, why: null, alignment: true }]);
  check("an episode entirely on disk sends nothing", free.fresh, 0);
}


// ── the clips are not written by recording ───────────────────────────────────
// Michelle re-recorded, played lttv_rt_ep02_connor.wav, and heard the fault
// she had just had fixed. The file had not been touched: recording writes the
// master, the SPLIT cuts the clips.
{
  const folder = [
    "master-dialogue.wav", "voice-segments.json", "line-spans.json", "block-1.json",
    "lttv_rt_ep02_connor.wav", "lttv_rt_ep02_gr80.wav", "lttv_rt_ep02_connor_s2.wav",
    "connor-sitepal-balanced.wav",
  ];
  check("only the upload clips are called stale",
    staleClipsAfterRecord(folder),
    ["lttv_rt_ep02_connor.wav", "lttv_rt_ep02_connor_s2.wav", "lttv_rt_ep02_gr80.wav"]);
  ok("the master is not one of them",
    !staleClipsAfterRecord(folder).includes("master-dialogue.wav"));
  ok("nor the intermediate balanced track, which the split rewrites anyway",
    !staleClipsAfterRecord(folder).includes("connor-sitepal-balanced.wav"));
  check("a fresh folder has nothing stale in it",
    staleClipsAfterRecord(["master-dialogue.wav"]), []);

  const warning = staleClipWarning(staleClipsAfterRecord(folder));
  ok("the warning names the files", warning.includes("lttv_rt_ep02_connor.wav"));
  ok("and says the split is what cuts them", warning.includes("split"));
  ok("and warns before SitePal, not after", warning.includes("SitePal"));
  check("nothing stale means no warning", staleClipWarning([]), null);

  // A sectioned episode has twelve of these and listing all of them buries
  // the sentence that matters.
  const many = Array.from({ length: 12 }, (_, i) => `lttv_rt_ep02_connor_s${i + 1}.wav`);
  ok("a long list is summarised", staleClipWarning(many).includes("and 8 more"));
  ok("but still says how many there are", staleClipWarning(many).includes("12 clip file"));
}


console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
