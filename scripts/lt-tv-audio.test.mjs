// Tests for the audio build's arithmetic, run with:
//
//   node scripts/lt-tv-audio.test.mjs
//
// Every line is rendered on its own and the two character tracks are laid
// out by bytes. The thing most likely to be silently wrong here is that
// layout: an error does not throw, it puts a line in the wrong place, or the
// wrong track, and looks exactly like a mistuned lead-in or the voice bleed
// this design exists to end.
//
// So this builds real PCM buffers of known length, lays them out, assembles
// the tracks, and checks every byte. No API key and no ffmpeg: raw PCM is
// generated here, and its duration is a byte count rather than something only
// a decoder can tell you — which is the reason this step uses PCM at all.

import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  PCM,
  PCM_RATES,
  MODEL_ID,
  pcmSeconds,
  wavHeader,
  tierRefusal,
  beatBytes,
  ACT_BEAT_SECONDS,
  LINE_GAP_SECONDS,
  TAIL_SECONDS,
  PAUSE_MARK_MAX_SECONDS,
  TRIM_KEEP_SECONDS,
  episodeLines,
  linePlan,
  lineRequest,
  lineFingerprint,
  lineCostReport,
  trimSilence,
  fadeEdges,
  layoutLines,
  assembleTracks,
  lineSilences,
  timingFromLayout,
  strandedPauses,
  strandedWarning,
  strandedTakes,
  revoice,
  staleClipsAfterRecord,
  staleClipWarning,
} from "./lt-tv-audio.mjs";
import { wavInfo, sliceWav, perLineRender, layoutLine } from "./lt-tv-split.mjs";
import { planSections, TARGET_SECTION_SECONDS } from "./lt-tv-sections.mjs";
import { CAST } from "./lt-tv-format.mjs";
import { renderScript } from "./lt-tv-episode.mjs";
import { pendingEdits, readPauseMarks, readTakeMarks, readCutMarks } from "./lt-tv-edit.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const frame = () => PCM.channels * PCM.bytesPerSample;
/** A buffer holding exactly this many seconds of audio in the format we use. */
const pcmOf = (seconds) => Buffer.alloc(Math.round(seconds * PCM.sampleRate) * frame());
/** The same, but audibly not silence: a constant sample well above the trim threshold. */
const toneOf = (seconds, level = 8000) => {
  const b = pcmOf(seconds);
  for (let i = 0; i < b.length; i += frame()) b.writeInt16LE(level, i);
  return b;
};

console.log("\nDurations come from byte counts, exactly:");
check("one second", pcmSeconds(pcmOf(1).length), 1);
check("ninety seconds", pcmSeconds(pcmOf(90).length), 90);
check("a fractional second survives", pcmSeconds(pcmOf(2.5).length), 2.5);
ok("a gap is a whole number of samples", beatBytes(0.7) % frame() === 0);
check("and is the length it says it is", pcmSeconds(beatBytes(0.7)), 0.7);

console.log("\nThe WAV header:");
{
  const h = wavHeader(pcmOf(3).length);
  check("is 44 bytes", h.length, 44);
  check("says PCM", h.readUInt16LE(20), 1);
  check("at the rate in force", h.readUInt32LE(24), PCM.sampleRate);
  check("and implies the right duration", h.readUInt32LE(40) / h.readUInt32LE(28), 3);
  const info = wavInfo(Buffer.concat([h, pcmOf(3)]));
  check("and reads back as what it says", [info.sampleRate, info.channels, info.dataOffset, pcmSeconds(info.dataBytes)],
    [PCM.sampleRate, 1, 44, 3]);
}

console.log("\nAgainst the worked sample:");
const episode = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/news-2026-W38.sample.json"), "utf8"),
);
const lineCount = episode.segments.reduce((n, s) => n + s.lines.length, 0);
const plan = linePlan(episode, new Map());
check("one render per line", plan.length, lineCount);
ok("every one carries a voice and words", plan.every((u) => u.voiceId && u.text));
ok("in the episode's order",
  plan.map((u) => u.text).join("|") === episode.segments.flatMap((s) => s.lines).map((l) => l.text).join("|"));
check("nothing is pushed in front of the first line", plan[0].pauseBefore, 0);
ok("a line inside an act follows the line gap",
  plan.filter((u, i) => i > 0 && !u.opensAct).every((u) => u.pauseBefore === LINE_GAP_SECONDS));
ok("a line that opens an act follows the beat",
  plan.filter((u) => u.opensAct).every((u) => u.pauseBefore === ACT_BEAT_SECONDS));
check("there is one act break per segment boundary",
  plan.filter((u) => u.opensAct).length, episode.segments.length - 1);
ok("the default gap is a breath, not a gulf", LINE_GAP_SECONDS > 0.2 && LINE_GAP_SECONDS < 1);
ok("and the act beat is longer than it", ACT_BEAT_SECONDS > LINE_GAP_SECONDS);

console.log("\nWhat is sent for one line:");
{
  const body = lineRequest(plan[1]);
  check("the words", body.text, plan[1].text);
  check("the dialogue model, tags and all", body.model_id, MODEL_ID);
  // ElevenLabs answers 400 unsupported_model to previous_text / next_text on
  // eleven_v3. Michelle's first real run died on line 0 with exactly that, so
  // the body is the words and the model and nothing else.
  check("and nothing else: v3 refuses the context fields",
    Object.keys(body), ["text", "model_id"]);
}

console.log("\nA kept line is filed under what was sent, not where it sits:");
{
  // A LINE NUMBER IS A POSITION. Lines renumber when one is added above them,
  // and a cache keyed by number handed back the old words under the new
  // number — Michelle heard it as a line she had rewritten read exactly as
  // before. Keyed by content, renumbering costs nothing and rewording costs
  // that line.
  const a = { voiceId: "connor-voice", text: "Paper gains are still gains." };
  const fp = lineFingerprint(a);
  ok("a fingerprint is short enough to be a filename", fp.length === 16);
  check("the same words in the same voice give the same one", lineFingerprint({ ...a, n: 99 }), fp);
  ok("reworded, a different one", lineFingerprint({ ...a, text: "Paper gains are not gains." }) !== fp);
  ok("the same words in the other voice, a different one", lineFingerprint({ ...a, voiceId: "gr80-voice" }) !== fp);
  ok("and at another rate, a different one", lineFingerprint(a, { format: "pcm_44100" }) !== lineFingerprint(a, { format: "pcm_24000" }));

  const kept = new Set([lineFingerprint(plan[0]), lineFingerprint(plan[2])]);
  const report = lineCostReport(plan, (u) => kept.has(lineFingerprint(u)));
  check("the count is what gets sent, not what exists", report.fresh, plan.length - 2);
  check("and what costs nothing", report.reused, 2);
  ok("a reused line says so plainly", report.lines[0].includes("reused free"));
  ok("a sent line says how many characters it is", /\(\d+ characters\)/.test(report.lines[1]));
  check("the characters sent add up", report.chars,
    plan.filter((u, i) => i !== 0 && i !== 2).reduce((n, u) => n + u.text.length, 0));
  check("an episode entirely on disk sends nothing", lineCostReport(plan, () => true).fresh, 0);
}

console.log("\nThe silence ElevenLabs pads a line with is taken off:");
{
  // The gap in front of a line is the number it says it is only if the line
  // starts where its sound starts. The model pads each render by a varying
  // amount, so the padding goes and a fixed sliver is kept.
  const padded = Buffer.concat([pcmOf(0.4), toneOf(1.0), pcmOf(0.9)]);
  const trimmed = trimSilence(padded);
  const keep = Math.round(TRIM_KEEP_SECONDS * PCM.sampleRate) * frame();
  check("the sound and a sliver on each side survive", trimmed.length, toneOf(1.0).length + 2 * keep);
  ok("what survives is whole samples", trimmed.length % frame() === 0);
  ok("the first kept sample is quiet", Math.abs(trimmed.readInt16LE(0)) < 200);
  ok("and the sound is intact in the middle", trimmed.readInt16LE(Math.floor(trimmed.length / 2 / frame()) * frame()) === 8000);
  check("a line with no padding is untouched", trimSilence(toneOf(0.5)).length, toneOf(0.5).length);
  check("nothing but silence trims to nothing", trimSilence(pcmOf(2)).length, 0);
  // Quiet is not silence. A breath, a soft consonant: kept.
  const soft = Buffer.concat([pcmOf(0.2), toneOf(0.3, 400), toneOf(0.5)]);
  check("a soft opening is kept", trimSilence(soft).length, toneOf(0.8).length + keep);

  const faded = fadeEdges(Buffer.from(toneOf(0.1)));
  check("a fade starts from nothing", faded.readInt16LE(0), 0);
  check("and ends at nothing", faded.readInt16LE(faded.length - frame()), 0);
  ok("and does not touch the middle", faded.readInt16LE(Math.floor(faded.length / 2 / frame()) * frame()) === 8000);
  ok("a tiny buffer does not fade past itself", fadeEdges(Buffer.from(toneOf(0.001))).length === toneOf(0.001).length);
}

console.log("\nLaying the lines out on one timeline:");
// Four lines, two voices, two acts: the shape of every episode.
const small = {
  id: "t",
  cast: { Connor: { voiceId: "c" }, Monk: { voiceId: "m" } },
  segments: [
    { id: "one", lines: [
      { n: 0, actor: "Connor", voiceId: "c", text: "One." },
      { n: 1, actor: "Monk", voiceId: "m", text: "Two." },
    ] },
    { id: "two", lines: [
      { n: 2, actor: "Connor", voiceId: "c", text: "Three." },
      { n: 3, actor: "Monk", voiceId: "m", text: "Four." },
    ] },
  ],
};
{
  const units = linePlan(small, new Map(), { beat: 0.7, gap: 0.4 });
  const lengths = [pcmOf(2).length, pcmOf(1).length, pcmOf(3).length, pcmOf(1.5).length];
  const layout = layoutLines(units, lengths);

  check("the first line starts at zero", layout.lines[0].start, 0);
  check("and ends when its audio does", layout.lines[0].end, 2);
  check("the second follows the line gap", layout.lines[1].start, 2.4);
  check("the third opens an act and follows the beat", layout.lines[2].start, 3.4 + 0.7);
  check("the fourth follows the gap again", layout.lines[3].start, 7.1 + 0.4);
  check("the episode ends after the last line and the tail", layout.durationSeconds,
    Number((7.5 + 1.5 + TAIL_SECONDS).toFixed(3)));
  check("and is exactly that many bytes", pcmSeconds(layout.totalBytes), layout.durationSeconds);
  ok("every offset is whole samples", layout.lines.every((l) => l.offsetBytes % frame() === 0));
  ok("time only moves forward", layout.lines.every((l, i, a) => i === 0 || l.start >= a[i - 1].end));

  const timing = timingFromLayout(layout);
  check("the record gets one start per line", timing.lineStarts, [0, 2.4, 4.1, 7.5]);
  check("and one end", timing.lineEnds, [2, 3.4, 7.1, 9]);
  check("and the length", timing.durationSeconds, layout.durationSeconds);

  check("the pauses are the gaps that were placed, in the cutter's shape",
    lineSilences(layout),
    [{ start: 2, end: 2.4, width: 0.4 }, { start: 3.4, end: 4.1, width: 0.7 }, { start: 7.1, end: 7.5, width: 0.4 }]);

  // Two tracks, and every byte accounted for.
  const audio = new Map([[0, toneOf(2, 1000)], [1, toneOf(1, 2000)], [2, toneOf(3, 3000)], [3, toneOf(1.5, 4000)]]);
  const { tracks, master } = assembleTracks(layout, audio, ["Connor", "Monk"]);
  const connor = tracks.get("Connor");
  const monk = tracks.get("Monk");
  check("each track is the whole episode long", [connor.length, monk.length, master.length],
    [layout.totalBytes, layout.totalBytes, layout.totalBytes]);
  const at = (buf, seconds) => buf.readInt16LE(Math.round(seconds * PCM.sampleRate) * frame());
  check("Connor's track has Connor's first line", at(connor, 1), 1000);
  check("and silence while the Monk speaks", at(connor, 2.9), 0);
  check("the Monk's track has the Monk's line there", at(monk, 2.9), 2000);
  check("and silence while Connor speaks", at(monk, 1), 0);
  check("the fourth line is the Monk's, after the beat", [at(monk, 8), at(connor, 8)], [4000, 0]);
  check("the gaps are silent on every track", [at(connor, 2.2), at(monk, 2.2), at(master, 2.2)], [0, 0, 0]);
  check("and so is the tail", [at(connor, layout.durationSeconds - 0.1), at(monk, layout.durationSeconds - 0.1)], [0, 0]);

  // THE PROPERTY THE SET DEPENDS ON. Each avatar lip-syncs its own track, so
  // the two must never both have sound at once, and together they must be
  // the master. Checked sample by sample rather than assumed.
  let overlap = 0;
  let mismatch = 0;
  for (let i = 0; i < master.length; i += frame()) {
    const c = connor.readInt16LE(i);
    const m = monk.readInt16LE(i);
    if (c !== 0 && m !== 0) overlap += 1;
    if (c + m !== master.readInt16LE(i)) mismatch += 1;
  }
  check("the two tracks never overlap", overlap, 0);
  check("and sum to the master, sample for sample", mismatch, 0);

  let refused = null;
  try { layoutLines(units, lengths.slice(0, 3)); } catch (err) { refused = err.message; }
  ok("a recording count that disagrees with the plan is refused", refused?.includes("not the same episode"));
  refused = null;
  try { assembleTracks(layout, new Map([...audio, [1, toneOf(0.5)]]), ["Connor", "Monk"]); } catch (err) { refused = err.message; }
  ok("and so is audio that does not match its place", refused?.includes("does not match"));
  refused = null;
  try { assembleTracks(layout, audio, ["Connor"]); } catch (err) { refused = err.message; }
  ok("and a speaker with no track", refused?.includes("no track"));

  // The section cutter reads these silences exactly as it read measured ones.
  // Six forty-second lines: two fit a section, a third does not.
  const longer = { ...small, segments: [
    { id: "a", lines: [small.segments[0].lines[0], small.segments[0].lines[1]] },
    { id: "b", lines: [{ ...small.segments[1].lines[0], n: 2 }, { ...small.segments[1].lines[1], n: 3 }] },
    { id: "c", lines: [{ ...small.segments[0].lines[0], n: 4 }, { ...small.segments[0].lines[1], n: 5 }] },
  ] };
  const long = linePlan(longer, new Map(), { beat: 0.7, gap: 0.4 });
  const longLayout = layoutLines(long, long.map(() => pcmOf(40).length));
  const t = timingFromLayout(longLayout);
  const sections = planSections(t.lineStarts, t.lineEnds, t.durationSeconds, TARGET_SECTION_SECONDS,
    { silences: lineSilences(longLayout) });
  ok("a long episode is cut into sections", sections.length > 1);
  ok("and every cut lands in a gap this step placed",
    sections.slice(0, -1).every((s) => lineSilences(longLayout).some((w) => w.start < s.endsAt && s.endsAt < w.end)));
  ok("with the whole gap to land in", sections.slice(0, -1).every((s) => s.silenceAfter >= 0.4 && !s.forcedJoin));
}

console.log("\nCutting a track into sections is bytes, not ffmpeg:");
{
  const data = Buffer.concat([toneOf(1, 100), toneOf(1, 200), toneOf(1, 300)]);
  const wav = Buffer.concat([wavHeader(data.length), data]);
  const middle = sliceWav(wav, 1, 2);
  const info = wavInfo(middle);
  check("the slice is the length asked for", pcmSeconds(info.dataBytes), 1);
  check("its header says so", middle.readUInt32LE(40), info.dataBytes);
  check("and it holds the right second", middle.readInt16LE(44), 200);
  check("a slice to the end runs to the end", pcmSeconds(wavInfo(sliceWav(wav, 2, 99)).dataBytes), 1);
  ok("both characters cut at the same sample",
    sliceWav(wav, 1.2345, 2).readUInt32LE(40) === sliceWav(Buffer.concat([wavHeader(data.length), pcmOf(3)]), 1.2345, 2).readUInt32LE(40));
  let refused = null;
  try { sliceWav(wav, 2, 2); } catch (err) { refused = err.message; }
  ok("an empty section is refused", refused?.includes("no audio"));
  refused = null;
  try { wavInfo(Buffer.from("not a wav file at all, not even close")); } catch (err) { refused = err.message; }
  ok("and so is a file that is not a WAV", refused?.includes("Not a WAV"));

  check("render.json from this step is recognised",
    perLineRender({ mode: "lines", lines: [], silences: [] }) !== null, true);
  check("an older master's folder is not", perLineRender(null), null);
  check("nor a marker with nothing in it", perLineRender({ mode: "lines" }), null);
  ok("the layout report names the speaker and the pause",
    layoutLine({ n: 3, actor: "Monk", start: 7.5, end: 9, pauseBefore: 0.4 }, 3).includes("0.40s before it"));
  ok("and the first line has no pause to report",
    !layoutLine({ n: 0, actor: "Connor", start: 0, end: 2, pauseBefore: 0 }, 0).includes("before it"));
}

// ── recording at a rate the account is actually allowed ───────────────────
//
// 44.1kHz PCM is Pro-tier only, so an account below it must record at another
// rate. The design survives that — the layout stays sample-exact — but only if
// every number is derived from the rate in force rather than from 44100 baked
// in somewhere. So the arithmetic is re-run at a second rate and must agree
// with itself just as well.
console.log("\nThe same arithmetic at a rate a smaller plan is allowed:");
const was = PCM.sampleRate;
PCM.sampleRate = 24000;
{
  const secondsOf = (n) => n * PCM.sampleRate * PCM.channels * PCM.bytesPerSample;
  check("a second of audio is a second", pcmSeconds(secondsOf(1)), 1);
  check("and ninety are ninety", pcmSeconds(secondsOf(90)), 90);
  // Why a kept line may not be reused across a rate change: one second
  // recorded at 44.1kHz reads as 1.84 seconds here, and every line after it
  // would be placed that much late. The fingerprint carries the rate.
  check("a 44.1kHz second read at this rate is not a second", pcmSeconds(44100 * 2), 1.8375);
  const q = wavHeader(secondsOf(3));
  check("the header says the rate in force", q.readUInt32LE(24), 24000);
  check("and it still implies the same duration", q.readUInt32LE(40) / q.readUInt32LE(28), 3);
  const units = linePlan(small, new Map(), { beat: 0.7, gap: 0.4 });
  const layout = layoutLines(units, [secondsOf(2), secondsOf(1), secondsOf(3), secondsOf(1.5)]);
  check("a line still begins where the gap before it ends", layout.lines[1].start, 2.4);
  check("and the beat is still the beat", layout.lines[2].start, 4.1);
  check("and the gap bytes are whole samples at this rate", beatBytes(0.4) % 2, 0);
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
  const sample = JSON.parse(
    await readFile(resolve("content/lt-tv/samples/roundtable-02.sample.json"), "utf8"),
  );
  delete sample.synthetic; // the sample is refused on its own account

  check(
    "the screenplay a record renders is not an edit",
    pendingEdits(sample, renderScript(sample) + "\n"),
    null,
  );

  const edited = renderScript(sample).replace(
    /^(\s*0\s+)(>\s*)?(\S.*?)(\s\s+)(\S.*)$/m,
    (_, n, aim, who, gap) => `${n}${aim ?? ""}${who}${gap}Something she typed instead.`,
  );
  ok("and a reworded line is", pendingEdits(sample, edited) !== null);

  const dir = await mkdtemp(join(tmpdir(), "lt-tv-audio-"));
  try {
    await mkdir(join(dir, "content/lt-tv/episodes"), { recursive: true });
    await writeFile(
      join(dir, "content/lt-tv/episodes/roundtable-02.json"),
      JSON.stringify(sample, null, 2) + "\n",
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

    // The dry run, on the applied record, reads files and sends nothing.
    await writeFile(join(dir, "content/lt-tv/episodes/roundtable-02.txt"), renderScript(sample) + "\n");
    const dry = await run("node", [resolve("scripts/lt-tv-audio.mjs"), "content/lt-tv/episodes/roundtable-02.json", "--dry-run"], {
      cwd: dir,
      env: { ...process.env, ELEVENLABS_API_KEY: "" },
    });
    ok("a dry run needs no key and ends with nothing spent", dry.stdout.includes("Nothing has been spent"));
    ok("and counts every line as a render on an empty folder",
      dry.stdout.includes(`${lineCountOf(sample)} of ${lineCountOf(sample)} lines would be sent`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
function lineCountOf(ep) { return ep.segments.reduce((n, s) => n + s.lines.length, 0); }

console.log("\nA pause the script asked for:");
{
  // Michelle: "i don't always want the same pause" and "sometimes awkward
  // pauses might be funny too". Every gap is placed by this step, so a mark
  // can go in front of ANY line — not only at an act break, as it had to when
  // the acts were rendered as blocks.
  const all = episodeLines(episode);
  const firstN = all[0].n;
  const inside = all.find((l, i) => i > 0 && l.segmentIndex === all[i - 1].segmentIndex).n;
  const opensAct = all.find((l, i) => i > 0 && l.segmentIndex !== all[i - 1].segmentIndex).n;

  const marked = linePlan(episode, new Map([[inside, 1.5], [opensAct, 2.4]]));
  check("the plan is still one render per line", marked.length, lineCount);
  const a = marked.find((u) => u.n === inside);
  check("a mark inside an act replaces the line gap", a.pauseBefore, 1.5);
  ok("and is marked as coming from the script", a.asked);
  check("its silence is a whole number of samples and the length it says", pcmSeconds(a.bytes), 1.5);
  check("a mark on an act break replaces the beat", marked.find((u) => u.n === opensAct).pauseBefore, 2.4);
  ok("nothing else moves",
    marked.filter((u) => u.n !== inside && u.n !== opensAct).every((u, i) =>
      u.pauseBefore === plan.filter((p) => p.n !== inside && p.n !== opensAct)[i].pauseBefore));
  ok("and a mark changes no words, so nothing is re-recorded for it",
    marked.every((u, i) => lineFingerprint(u) === lineFingerprint(plan[i])));

  // A pause that cannot be placed is said, not dropped.
  const stray = new Map([[99999, 1], [firstN, 1]]);
  check("a mark on a line that does not exist is stranded", strandedPauses(episode, stray).includes(99999), true);
  check("so is one in front of the very first line", strandedPauses(episode, stray).includes(firstN), true);
  check("a mark on a real line is not", strandedPauses(episode, new Map([[inside, 1]])), []);
  const warning = strandedWarning(strandedPauses(episode, stray), episode);
  ok("and the warning names the line number", warning.includes("99999"));
  ok("and says the first-line one is about the start", /starts/.test(warning));
  check("nothing to warn about when nothing is stranded", strandedWarning([], episode), null);
  check("a mark in front of the first line is ignored by the plan too",
    linePlan(episode, new Map([[firstN, 3]]))[0].pauseBefore, 0);

  // THE NUMBERING CONTRACT. The mark is read off the screenplay by the number
  // printed beside the line; the plan places it by the record's `n`. If those
  // two ever stop meaning the same thing, a pause silently lands somewhere
  // else — so the round trip is checked against a real rendered screenplay.
  const page = renderScript(episode)
    .split("\n")
    .flatMap((row) => {
      const num = row.match(/^\s*(\d+)\s+/);
      return num && Number(num[1]) === inside ? ["# pause 1.8s", row] : [row];
    })
    .join("\n");
  const fromPage = linePlan(episode, readPauseMarks(page));
  ok("a mark written on the page lands on the line it was written above",
    fromPage.find((u) => u.pauseBefore === 1.8)?.n === inside);
  ok("and a pause mark is not read as an edit", pendingEdits(episode, page + "\n") === null);

  // A typo here is dead air in a finished episode, so it stops the run before
  // anything is spent rather than after.
  let refused = null;
  try { linePlan(episode, new Map([[inside, 45]])); } catch (err) { refused = err.message; }
  ok("an absurd pause is refused", refused !== null);
  ok("and the refusal names the line and the limit",
    refused.includes(String(inside)) && refused.includes(String(PAUSE_MARK_MAX_SECONDS)));
}

console.log("\nA take mark records one line again without rewording it:");
{
  // Michelle heard a stray "to" at the head of a Connor line (2:07 of The
  // Wealth Effect, 2026-09-21). The words were right, so the cache would
  // hand the same rendering back forever; the only outs were rewording the
  // line or deleting a file by hand. `# take 2` is the third way.
  const all = episodeLines(episode);
  const target = all[3].n;
  const other = all[4].n;
  const takes = readTakeMarks(`# take 2\n${target}  CONNOR  Words.\n# take 1\n${other}  SAINT GR80  More.\n`);
  check("the mark lands on the line below it", [...takes.entries()], [[target, 2]]);
  ok("and take 1 is not a mark, it is the default", !takes.has(other));

  const plan1 = linePlan(episode);
  const plan2 = linePlan(episode, new Map(), { takes: new Map([[target, 2]]) });
  check("every line has a take, 1 unless asked", plan1.every((u) => u.take === 1), true);
  check("the marked line is take 2", plan2.find((u) => u.n === target).take, 2);
  const fp1 = lineFingerprint(plan1.find((u) => u.n === target));
  const fp2 = lineFingerprint(plan2.find((u) => u.n === target));
  ok("take 2 is filed under a different fingerprint", fp1 !== fp2);
  check("take 1 hashes exactly as a line with no take field, so nothing on disk goes stale",
    lineFingerprint({ voiceId: "v", text: "t" }), lineFingerprint({ voiceId: "v", text: "t", take: 1 }));
  ok("and every other line is untouched by the mark",
    plan2.filter((u) => u.n !== target).every((u, i) =>
      lineFingerprint(u) === lineFingerprint(plan1.filter((p) => p.n !== target)[i])));
  check("a take mark is not a pause", plan2.find((u) => u.n === target).pauseBefore,
    plan1.find((u) => u.n === target).pauseBefore);

  // What it costs, said before it is spent: exactly that line.
  const onDisk = new Set(plan1.map((u) => lineFingerprint(u)));
  const report = lineCostReport(plan2, (u) => onDisk.has(lineFingerprint(u)));
  check("a take costs one line", report.fresh, 1);
  ok("and the report says why", report.lines.some((l) => l.includes(`line ${String(target).padStart(2)}`) && l.includes("take 2")));

  // It is a mark, not an edit, and not a note about the line above.
  const page = renderScript(episode)
    .split("\n")
    .flatMap((row) => {
      const num = row.match(/^\s*(\d+)\s+/);
      return num && Number(num[1]) === target ? ["# take 2", row] : [row];
    })
    .join("\n");
  check("written on the page, it lands on the line it was written above",
    [...readTakeMarks(page).entries()], [[target, 2]]);
  ok("a take mark is not read as an edit", pendingEdits(episode, page + "\n") === null);
  check("nor as a cut", readCutMarks(page), []);
  check("nor as a pause", readPauseMarks(page).size, 0);
  check("a mark on a line that does not exist is stranded, not dropped silently",
    strandedTakes(episode, new Map([[99999, 2], [target, 2]])), [99999]);
}

console.log("\nThe voices are the show's, not the record's:");
{
  // Michelle changed the Monk's voice, re-recorded roundtable-02, and it was
  // rendered in the OLD voice — the record stores a voiceId per line, frozen
  // when the episode was written, and nothing compared it to the cast.
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
  ok("the requests ask for the current voice", linePlan(fixed).every((u) => u.voiceId !== STALE));
  check("nothing else about the episode moves",
    JSON.stringify(fixed.segments.flatMap((s) => s.lines).map((l) => l.text)),
    JSON.stringify(episode.segments.flatMap((s) => s.lines).map((l) => l.text)));

  // A stale voice must not be reusable from cache, or half the episode would
  // be in one voice and half in the other.
  const before = lineFingerprint(linePlan(stale).find((u) => u.actor === "Monk"));
  const after = lineFingerprint(linePlan(fixed).find((u) => u.actor === "Monk"));
  ok("and the cached audio cannot survive the change", before !== after);
  check("an episode already on the current voices reports no change", revoice(episode).changes, []);
}

// ── the clips are not written by recording ───────────────────────────────────
// Michelle re-recorded, played lttv_rt_ep02_connor.wav, and heard the fault
// she had just had fixed. The file had not been touched: recording writes the
// tracks, the SPLIT cuts the clips.
console.log("\nThe clip files are the split's, not the recording's:");
{
  const folder = [
    "master-dialogue.wav", "voice-segments.json", "render.json", "lines",
    "lttv_rt_ep02_connor.wav", "lttv_rt_ep02_gr80.wav", "lttv_rt_ep02_connor_s2.wav",
    "connor-sitepal-balanced.wav",
  ];
  check("only the upload clips are called stale",
    staleClipsAfterRecord(folder),
    ["lttv_rt_ep02_connor.wav", "lttv_rt_ep02_connor_s2.wav", "lttv_rt_ep02_gr80.wav"]);
  ok("the master is not one of them", !staleClipsAfterRecord(folder).includes("master-dialogue.wav"));
  ok("nor the full-length track, which recording just rewrote",
    !staleClipsAfterRecord(folder).includes("connor-sitepal-balanced.wav"));
  check("a fresh folder has nothing stale in it", staleClipsAfterRecord(["master-dialogue.wav"]), []);

  const warning = staleClipWarning(staleClipsAfterRecord(folder));
  ok("the warning names the files", warning.includes("lttv_rt_ep02_connor.wav"));
  ok("and says the split is what cuts them", warning.includes("split"));
  ok("and warns before SitePal, not after", warning.includes("SitePal"));
  check("nothing stale means no warning", staleClipWarning([]), null);
  const many = Array.from({ length: 12 }, (_, i) => `lttv_rt_ep02_connor_s${i + 1}.wav`);
  ok("a long list is summarised", staleClipWarning(many).includes("and 8 more"));
  ok("but still says how many there are", staleClipWarning(many).includes("12 clip file"));
}

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
